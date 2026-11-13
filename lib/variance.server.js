// The reads and writes of an invoice's variances (#648): judging them again after a write that
// can move them, and accepting one. The judgments and every word are `lib/variance.js`'s; this is
// the half that reaches Airtable, which is why it is a pair (#184).
//
// ONE PLACE JUDGES A STORED INVOICE'S VARIANCES AGAIN, AND IT ENDS THE ACCEPTANCES IT HAS TO.
// `updateInvoiceAction` and an overage correction's split each recomputed both item flags inline
// until here — `lib/overage.server.js:recomputeInvoiceItemVariance` and a loop in the action —
// and an acceptance resting on figures either write moves has to end in the same pass, or the
// cache says `accepted` about a figure nobody accepted. So both call `judgeInvoiceAgain`, and
// `offline/variance-acceptance.mjs` holds that nothing else writes a flag on a stored row.
// `createInvoiceAction` still sets the flags on the rows it has just made, which no acceptance
// can stand on yet.
//
// WHAT IT READS, AND WHY IT IS LESS THAN THE TWO LOOPS READ. The invoice once, fresh — its
// `Calculated Total` is the rollup the items' edits have just moved, and its `Invoice Items` and
// `Invoice Variance Log` links are the two levels below; the items by those ids; each distinct ordered
// item once by `find`, which carries its `Qty`, `Unit Price` and `Invoiced Qty` together
// (`recordToPOItem`, #235) — the loops read the same record twice per item, once for the price
// and once for the rollup; and the log only when a cache says something is accepted. A `find`
// rather than a batched read for the ordered items because `Invoiced Qty` is a rollup the edit
// has just moved, and `getInvoicedQtyForPOItem`'s freshness was measured through `find`.

import { getInvoiceById, getInvoiceByRecordId, updateInvoice } from "./airtable/invoices";
import { getInvoiceItemsByRecordIds, updateInvoiceItem } from "./airtable/invoiceItems";
import { getPOItemByRecordId } from "./airtable/poItems";
import { createInvoiceVarianceLogEntry, destroyInvoiceVarianceLogEntries, getInvoiceVarianceLogEntries } from "./airtable/invoiceVarianceLog";
import {
    ITEM_VARIANCE_KINDS,
    VARIANCE_EVENTS,
    VARIANCE_KINDS,
    acceptanceAfter,
    acceptedFieldOf,
    checkPriceVariance,
    checkQuantityVariance,
    checkTotalsDiffer,
    latestVarianceEntry,
    varianceFigures,
    varianceState,
} from "./variance";

/** Each distinct ordered item the rows name, by `find`, keyed by record id. */
async function orderedItemsOf(items) {
    const ids = [...new Set(items.map((it) => it.poItem?.[0]).filter(Boolean))];
    const rows = await Promise.all(ids.map((id) => getPOItemByRecordId(id)));
    return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Both item flags, judged as `createInvoiceAction` judges them. An item whose ordered item does
 * not resolve — a link a hand edit emptied — has nothing to be compared against, so both clear.
 */
function itemFlags(item, orderedItem) {
    if (!orderedItem) return { hasPriceVariance: false, hasQuantityVariance: false };
    return {
        hasPriceVariance: checkPriceVariance(item.unitPrice, orderedItem.unitPrice),
        hasQuantityVariance: checkQuantityVariance(orderedItem.invoicedQty || 0, orderedItem.qty),
    };
}

/**
 * The acceptances on one row that end, given the flags the row now carries: each kind whose
 * cache says accepted, and what it becomes — a `Reopened` or `Cleared` row to write, or, where
 * the log's latest row already ends it (a write that failed after its row and before its cache),
 * the cache alone to clear.
 */
function endings({ row, flags, kinds, entries, itemRecordId, figuresOf }) {
    const out = [];
    for (const kind of kinds) {
        if (!row[acceptedFieldOf(kind)]) continue;
        const latest = latestVarianceEntry(entries, kind, itemRecordId);
        const figures = figuresOf(kind);
        if (latest && latest.event !== VARIANCE_EVENTS.accepted) {
            out.push({ kind, event: null, figures });
            continue;
        }
        const accepted = latest ? { vendor: latest.vendorFigure, ours: latest.ourFigure } : null;
        const stands = varianceState({ ...row, ...flags }, kind) !== null;
        const event = acceptanceAfter({ stands, accepted, figures });
        if (event) out.push({ kind, event, figures });
    }
    return out;
}

/**
 * Judge a stored invoice's variances again, after a write that can move them (#623, #648): both
 * flags on its items — every item, or `itemRecordIds` alone — then `Totals Differ` unless
 * `totals` is false, writing what moved; then every acceptance whose figures moved ends, a
 * `Reopened` or `Cleared` row written before its cache is cleared, so a failure between the two
 * leaves the log saying so and the next judgment clears the cache without a second row.
 *
 * `totals: false` IS THE SPLIT'S. An overage correction moves quantity between two items at one
 * price, so the invoice's sum does not move; reading `Calculated Total` straight after the new
 * item is created would read a rollup mid-flight, which the split never did before this either.
 *
 * `recordedByUserId` is the person whose write this follows, or null where none did — an
 * overage correction's order is generated by an approval, with no reader in hand.
 */
export async function judgeInvoiceAgain({ invoiceRecordId, itemRecordIds, totals = true, recordedByUserId = null }) {
    const invoice = await getInvoiceByRecordId(invoiceRecordId);
    const ids = itemRecordIds ? itemRecordIds.filter((id) => invoice.invoiceItems.includes(id)) : invoice.invoiceItems;
    const items = await getInvoiceItemsByRecordIds(ids);
    const ordered = await orderedItemsOf(items);

    const itemFlagsById = new Map();
    for (const item of items) {
        const flags = itemFlags(item, ordered.get(item.poItem?.[0]));
        itemFlagsById.set(item.id, flags);
        if (item.hasPriceVariance !== flags.hasPriceVariance || item.hasQuantityVariance !== flags.hasQuantityVariance) {
            // Both, always — the join #623 split coming back would be one flag written on
            // `price || quantity` (`offline/variance-copy.mjs`).
            await updateInvoiceItem(item.id, {
                hasPriceVariance: flags.hasPriceVariance,
                hasQuantityVariance: flags.hasQuantityVariance,
            });
        }
    }

    let totalsDiffer = invoice.totalsDiffer;
    if (totals) {
        totalsDiffer = checkTotalsDiffer(invoice.invoiceTotal, invoice.calculatedTotal || 0);
        if (invoice.totalsDiffer !== totalsDiffer) await updateInvoice(invoice.id, { totalsDiffer });
    }

    // The acceptances. Read the log only when a cache says something is accepted.
    const anyAccepted =
        (totals && invoice.totalsDifferAccepted) ||
        items.some((it) => ITEM_VARIANCE_KINDS.some((kind) => it[acceptedFieldOf(kind)]));
    if (!anyAccepted) return { ended: [] };
    const entries = await getInvoiceVarianceLogEntries(invoice.invoiceVarianceLog);

    const ended = [];
    for (const item of items) {
        const orderedItem = ordered.get(item.poItem?.[0]);
        const found = endings({
            row: item,
            flags: itemFlagsById.get(item.id),
            kinds: ITEM_VARIANCE_KINDS,
            entries,
            itemRecordId: item.id,
            figuresOf: (kind) => varianceFigures(kind, { item, orderedItem }),
        });
        for (const end of found) {
            await recordEnding({ invoice, itemRecordId: item.id, end, recordedByUserId });
            await updateInvoiceItem(item.id, { [acceptedFieldOf(end.kind)]: false });
            ended.push({ itemRecordId: item.id, ...end });
        }
    }
    if (totals) {
        const found = endings({
            row: invoice,
            flags: { totalsDiffer },
            kinds: ["totals"],
            entries,
            itemRecordId: null,
            figuresOf: (kind) => varianceFigures(kind, { invoice }),
        });
        for (const end of found) {
            await recordEnding({ invoice, itemRecordId: null, end, recordedByUserId });
            await updateInvoice(invoice.id, { totalsDifferAccepted: false });
            ended.push({ itemRecordId: null, ...end });
        }
    }
    return { ended };
}

/** The `Reopened` or `Cleared` row an ending writes; none where the log already says it ended. */
async function recordEnding({ invoice, itemRecordId, end, recordedByUserId }) {
    if (!end.event) return;
    await createInvoiceVarianceLogEntry({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        invoiceItemRecordId: itemRecordId,
        variance: VARIANCE_KINDS[end.kind],
        event: end.event,
        vendorFigure: end.figures.vendor,
        ourFigure: end.figures.ours,
        recordedByUserId,
    });
}

/**
 * Accept one kind of variance on an invoice (#648): on the invoice itself for `totals`, or on
 * each of `itemRecordIds` whose variance of that kind is open — a folded row's members, one row
 * for each, all with the one reason. Each gets its `Accepted` row, holding the two figures it
 * stands on now, and then its cache; a cache that fails to write takes its row back out, so the
 * log never says accepted where the screen does not.
 *
 * Answers `{ stale: true }` when there is nothing open of that kind to accept — the page was
 * drawn before an edit, or another press, moved it — and `{ accepted: n }` otherwise.
 */
export async function acceptVariance({ invoiceId, kind, itemRecordIds, reason, recordedByUserId }) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return { stale: true };

    const targets = [];
    if (kind === "totals") {
        if (varianceState(invoice, "totals") !== "open") return { stale: true };
        targets.push({ itemRecordId: null, figures: varianceFigures("totals", { invoice }) });
    } else {
        // Only the invoice's own items, whatever the form sent: an id from another invoice is
        // ignored rather than written, the edit action's own rule for its rows.
        const own = (itemRecordIds || []).filter((id) => invoice.invoiceItems.includes(id));
        const items = (await getInvoiceItemsByRecordIds(own)).filter((it) => varianceState(it, kind) === "open");
        if (items.length === 0) return { stale: true };
        const ordered = await orderedItemsOf(items);
        for (const item of items) {
            targets.push({ itemRecordId: item.id, figures: varianceFigures(kind, { item, orderedItem: ordered.get(item.poItem?.[0]) }) });
        }
    }

    for (const target of targets) {
        const entry = await createInvoiceVarianceLogEntry({
            invoiceRecordId: invoice.id,
            invoiceId: invoice.invoiceId,
            invoiceItemRecordId: target.itemRecordId,
            variance: VARIANCE_KINDS[kind],
            event: VARIANCE_EVENTS.accepted,
            reason,
            vendorFigure: target.figures.vendor,
            ourFigure: target.figures.ours,
            recordedByUserId,
        });
        try {
            if (target.itemRecordId) await updateInvoiceItem(target.itemRecordId, { [acceptedFieldOf(kind)]: true });
            else await updateInvoice(invoice.id, { totalsDifferAccepted: true });
        } catch (error) {
            // The create-then-delete rollback `createInvoiceAction` uses: this run's own row, gone
            // before the error leaves, so no `Accepted` row stands for a cache that never moved.
            await destroyInvoiceVarianceLogEntries([entry.id]).catch(() => {});
            throw error;
        }
    }
    return { accepted: targets.length };
}

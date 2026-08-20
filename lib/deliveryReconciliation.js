// The read side of #166's two axes, rewritten around #210's stored pairing.
//
// `Invoices."Delivery"` names the delivery an invoice describes, so the join that used
// to be computed is now READ. The old path was `Invoice Items` -> `PO Item` <-
// `Delivery Items`, with the ordered item as the only thing both axes touched, and
// it could not say WHICH delivery answered WHICH invoice — so #166 filled bills
// oldest-first with whatever had been delivered on the ordered item and marked the result
// inferred. The ordered item is still where QUANTITIES are compared, because that
// is the only level both documents carry a quantity for; what changed is that the
// pairing is looked up instead of guessed.
//
// TWO WALKS, NOT ONE, unchanged in shape: the two screens start from opposite ends
// and neither result derives from the other. The invoice axis asks "did what we
// were billed for was delivered"; the delivery axis asks "has what was delivered been billed".
//
// THE BUDGET FELL, AND THE TWO LEVELS THAT WENT ARE THE TWO THE INFERENCE NEEDED.
// Deciding whether THIS invoice was covered used to mean reading every OTHER invoice on
// the same ordered item and its parent's `Issue Date`, to know what order to fill
// them in. With the pairing stored, neither is anybody's business:
//
//   invoice axis (list)                   invoice axis (detail)
//   1  Invoice Items (by record id)       1  PO Items       (by record id)
//   2  Deliveries    (from the invoices'  2  Delivery Items (from PO Items'
//        own `Delivery` links)                 reverse-link)
//   3  Delivery Items (from those         3  Deliveries     (the ONE this invoice
//        deliveries' reverse-link)              matches, from its own link)
//
//   delivery axis
//   1  Delivery Items (by record id)
//   2  Invoices       (from the deliveries' own `Invoices` links)
//   3  Invoice Items  (from those invoices' reverse-link)
//
// So 3 operations on each of the three, down from 5 / 5 / 3 — plus one extra per 50
// ids inside a batched step, the same term #19 and #162 record. The caller already
// holds level 0 (the invoices or the deliveries and their own link arrays), which
// is what makes step 1 free of a query of its own. THESE ARE CEILINGS, NOT FIXED
// NUMBERS: findByRecordIds returns early on an empty id list, so an invoice with no
// delivery matched measures 1 and a delivery nobody has billed measures 1 too.
//
// THE DETAIL'S LEVEL 3 NARROWED IN #232 AND ITS LEVEL 2 DID NOT, which is the whole
// of what that issue cost and saved. Level 3 read every delivery that had touched
// the ordered items, to list them all under each box; it reads the one the invoice
// matches, so an invoice matching none now measures 2 rather than 3. Level 2 still
// reads every slice on those ordered items, because `deliveredBeyondOrder` stays an
// order-scoped fact and only the rows carry `Over Delivered` — so that 1 operation
// is the price of the box keeping an honest statement about the order, and it is
// reported here rather than smoothed.
//
// THE LIST AXIS NO LONGER READS `PO Items` AT ALL, which is the sharpest form of
// the same point. The list needs one fact per invoice — is the delivery here, and
// did it bring everything billed — and both come from the invoice's own quantity
// against the named delivery's slices. What was ORDERED is a third document's
// figure, and only the detail shows it.
//
// The alternative is one or two round trips PER ROW, which #143 established should
// not happen and #162 measured at over 200 for an Admin.
//
// #166 WITHHELD THE DELIVERY AXIS FROM SITE STAFF AND #211 RELEASED IT, so no
// caller here takes a privileged flag. The withholding was real — a page that
// fetched the invoice levels and then declined to render the column would have been
// hiding rather than withholding, so `getDeliveryInvoicing` was simply not called —
// but the line it drew does not survive the reason for it. The deliveries list is
// Job-scoped, and #211 admits an employee to the invoices of any job they are
// assigned to, so "has this been billed" is no longer a fact kept from them one
// screen away. Payment is what stays behind, and no function here reads it.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import this. The pure half is lib/deliveryStatus.js.

import { getInvoiceItemsByRecordIds } from "./airtable/invoiceItems";
import { getPOItemsForReconciliation } from "./airtable/poItems";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getInvoicesByRecordIds } from "./airtable/invoices";
import { linkedDelivery } from "./deliveryInvoiceLink";
import {
    countsTowardStatus,
    invoiceShareStatus,
    orderedItemStatus,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "./deliveryStatus";

/**
 * Invoice Items by record id, with the ordered item flattened to the single value
 * it is in practice.
 *
 * THE READER ITSELF MOVED TO THE TABLE MODULE IN #167, which needs the same level
 * for the overage affordance — a second batched reader for one table is exactly the
 * duplication that drifts. What stays here is the flattening: `countsTowardStatus`
 * and everything downstream of it read `poItemRecordId`, and that is this module's
 * own shape rather than the table's.
 */
async function getInvoiceItems(recordIds) {
    return (await getInvoiceItemsByRecordIds(recordIds)).map((item) => ({
        ...item,
        invoice: item.invoice || [],
        poItemRecordId: (item.poItem || [])[0] ?? null,
    }));
}

/**
 * How much each delivery brought, per ordered item — keyed `delivery::poItem`.
 *
 * THE KEY IS THE PAIR, and that is the whole of what #210 buys on this axis. #166
 * could only total an ordered item's deliveries across every delivery, which is why
 * attributing one to an invoice needed an ordering; keeping the delivery in the key
 * turns the same rows into a lookup.
 *
 * Slices with no `PO Item` are skipped: they name no ordered item, so there is
 * nothing to compare them against. #165 stopped the app writing one, and the
 * reading side still has to survive a link removed by hand.
 */
function deliveredByDeliveryAndOrderedItem(slices) {
    const byPair = new Map();
    for (const slice of slices || []) {
        const deliveryRecordId = slice.delivery?.[0];
        const orderedItemId = slice.poItem?.[0];
        if (!deliveryRecordId || !orderedItemId) continue;
        const key = `${deliveryRecordId}::${orderedItemId}`;
        byPair.set(key, (byPair.get(key) || 0) + (slice.qty || 0));
    }
    return byPair;
}

/**
 * Split a level's delivery slices into within-order and beyond-order totals per
 * ordered item.
 *
 * The whole reason this feature reads `Delivery Items` rather than
 * `PO Items."Delivered Qty"`: that rollup adds the two together and only the rows
 * carry `Over Delivered`. #165 attaches every row, so the rollup is complete — it
 * is simply no longer decomposable, which is what a screen that separates them
 * needs.
 *
 * IT USED TO COLLECT THE PARENT DELIVERIES TOO, AND #232 TOOK THAT OFF. Those ids
 * were what the detail read to list every delivery that touched an ordered item;
 * with the list narrowed to the one delivery the invoice matches, the parent to
 * read comes off the invoice's own link and nothing needs deriving from the slices.
 * The SPLIT is still needed and is why this level is still read in full — see
 * getInvoiceReconciliation on what that costs.
 */
function deliveredByPOItem(deliverySlices) {
    const byOrderedItem = new Map();
    for (const slice of deliverySlices) {
        const orderedItemId = slice.poItem?.[0];
        if (!orderedItemId) continue;
        const acc = byOrderedItem.get(orderedItemId) || { within: 0, beyond: 0 };
        if (slice.overDelivered) acc.beyond += slice.qty || 0;
        else acc.within += slice.qty || 0;
        byOrderedItem.set(orderedItemId, acc);
    }
    return byOrderedItem;
}

/**
 * The delivery status of many invoices at once, for the invoice list.
 *
 * `invoices` are already-loaded invoice objects carrying their `invoiceItems` and
 * `delivery` link arrays — which getAllInvoices() supplies — so this costs no
 * Invoices query of its own.
 *
 * Returns `{ byInvoice, orderedItemsByInvoice }`. `byInvoice` maps invoice record id
 * to the summary lib/deliveryStatus.js produces. An invoice with no invoice items at
 * all gets a summary too, so a caller never has to distinguish "no entry" from
 * "nothing to compare"; and since the chip comes from the link rather than from the
 * invoice items, that summary is still an answer.
 *
 * `orderedItemsByInvoice` IS A LEVEL THIS ALREADY READ AND THREW AWAY (#256), which is
 * the same duplicate-read #216 found on the other side of this module: it made
 * `getDeliveryInvoicing` hand back the `Delivery Items` rows every caller was reading
 * a second time. The invoices are fetched on the line below to compare quantities, they
 * carry the `PO Item` link the invoice-waiting strip selects on, and handing them
 * back costs nothing. Deriving them again in the page would be one more query per 50
 * ids for rows already in memory.
 *
 * It maps to the ordered items an invoice CHARGES, free-text invoice items dropped, so a
 * caller can tell an invoice that charges no order at all from one that charges
 * several — a distinction `summarizeInvoiceStatus` folds away into `excludedCount`
 * and the strip needs whole.
 */
export async function getInvoiceDeliveryStatus(invoices) {
    const byInvoice = new Map();
    const orderedItemsByInvoice = new Map();
    const list = invoices || [];
    if (list.length === 0) return { byInvoice, orderedItemsByInvoice };

    const invoiceItems = await getInvoiceItems(list.flatMap((inv) => inv.invoiceItems || []));

    // Free-text invoice items name no ordered item, so they are dropped from the
    // quantity comparison here and counted per invoice — see countsTowardStatus
    // for why comparing them to nothing would make every invoice with such an
    // invoice item read as short.
    const judged = invoiceItems.filter(countsTowardStatus);
    const excludedByInvoice = new Map();
    for (const item of invoiceItems) {
        if (countsTowardStatus(item)) continue;
        const parent = item.invoice?.[0];
        if (!parent) continue;
        excludedByInvoice.set(parent, (excludedByInvoice.get(parent) || 0) + 1);
    }

    // The deliveries these invoices name, and what each of them brought. Two levels,
    // both batched, both zero when nothing on the page is paired yet.
    const deliveryByInvoice = new Map(list.map((inv) => [inv.id, linkedDelivery(inv)]));
    const deliveries = await getDeliveriesByRecordIds([
        ...new Set([...deliveryByInvoice.values()].filter(Boolean)),
    ]);
    const deliveredByPair = deliveredByDeliveryAndOrderedItem(
        await getDeliveryItemsByRecordIds(deliveries.flatMap((d) => d.deliveryItems || []))
    );

    // THIS INVOICE AGAINST THE DELIVERY IT NAMES, per ordered item. No sibling invoice is
    // read and no ordering is applied — the pairing decides, which is the whole of
    // what #210 changed here.
    const statusesByInvoice = new Map();
    for (const item of judged) {
        const parent = item.invoice?.[0];
        if (!parent) continue;
        const deliveryRecordId = deliveryByInvoice.get(parent) ?? null;
        const status = invoiceShareStatus({
            billed: item.qty,
            delivered: deliveryRecordId
                ? deliveredByPair.get(`${deliveryRecordId}::${item.poItemRecordId}`) || 0
                : 0,
        });
        if (!statusesByInvoice.has(parent)) statusesByInvoice.set(parent, []);
        statusesByInvoice.get(parent).push(status);
    }

    // The ordered items each invoice charges, from the rows already in hand. Built from
    // every invoice item rather than from `judged`, then filtered on the link, so an
    // invoice item that names an ordered item counts here even when
    // `countsTowardStatus` dropped it from the quantity comparison.
    for (const item of invoiceItems) {
        const parent = item.invoice?.[0];
        if (!parent || !item.poItemRecordId) continue;
        if (!orderedItemsByInvoice.has(parent)) orderedItemsByInvoice.set(parent, new Set());
        orderedItemsByInvoice.get(parent).add(item.poItemRecordId);
    }

    for (const inv of list) {
        byInvoice.set(
            inv.id,
            summarizeInvoiceStatus({
                itemStatuses: statusesByInvoice.get(inv.id) || [],
                hasDelivery: Boolean(deliveryByInvoice.get(inv.id)),
                excludedCount: excludedByInvoice.get(inv.id) || 0,
            })
        );
    }
    return {
        byInvoice,
        orderedItemsByInvoice: new Map(
            [...orderedItemsByInvoice].map(([id, set]) => [id, [...set]])
        ),
    };
}

/**
 * Which of these ordered items has anything delivered against it (#256).
 *
 * ONE BATCHED READ, AND IT IS WHY THE STRIP CAN SPLIT ITS ROWS AT ALL. The question
 * a reader wants answered — was this invoice refused a pairing, or has nothing delivered
 * — cannot be answered as asked: `fitRefusal` is pure, is never stored, and runs
 * only inside the two write paths. Re-deriving a refusal per row means
 * `getDeliveriesForInvoice` per invoice, which is five reads each and the per-row shape
 * #143 ruled out. This asks the observable half instead, and `PO Items."Delivery
 * Items"` answers it for every ordered item on the page at once.
 *
 * THE LINK ARRAY IS THE WHOLE ANSWER — no `Delivery Items` level is read. A non-empty
 * array means some slice was allocated against that ordered item, which is all the
 * strip claims. Quantities would need the rows and would let the strip say more than
 * it should: whether what was delivered COVERS what is billed is the matched delivery's
 * question, and this invoice has no match, which is the state being reported.
 *
 * `getPOItemsForReconciliation` already carries the field, so this adds a query per
 * 50 ids and nothing else.
 */
export async function getOrderedItemsWithDelivery(poItemRecordIds) {
    const ids = [...new Set((poItemRecordIds || []).filter(Boolean))];
    if (ids.length === 0) return new Set();

    const poItems = await getPOItemsForReconciliation(ids);
    return new Set(poItems.filter((p) => (p.deliveryItems || []).length > 0).map((p) => p.id));
}

/**
 * One invoice's detail, as ONE ROW PER INVOICE ITEM — including the invoice items that
 * name no ordered item, which say so where they are rather than in a footnote
 * about invoice items the reader cannot see.
 *
 * SCOPED TO THE INVOICE BEING READ (#232), WHICH IS A CHANGE OF FRAME AND NOT OF
 * ARITHMETIC. Every figure a row carries is now this invoice's: `status.invoiced` is
 * what THIS invoice charges, and `status.delivered` is what the delivery it matches
 * brought of that ordered item. The ordered item's own totals used to ride along as
 * `line` — `Billed` being the `Invoiced Qty` rollup across every invoice — and that
 * field is GONE from the row rather than left unread. Two scopes in one row is what
 * produced `HYE-INV-260804-04` reading `Billed 30` while billing 15.
 *
 * TWO FACTS FROM THE ORDERED ITEM SURVIVE, AND THEY TRAVEL ON `status` WHERE THE
 * COPY CAN SEE THEM: `deliveredBeyondOrder` and `billedBeyondOrder`. They are the
 * ordered item's facts and are rendered as one line that says so by name, only when
 * one of them is non-zero. Narrowing them was considered and refused in both
 * directions — see STATUS_COPY.detail.againstOrder, which owns that argument.
 *
 * THE DELIVERY IS RETURNED ONCE, NOT PER ROW, AND THAT FOLLOWS FROM THE LINK'S SHAPE.
 * `Invoices."Delivery"` is single, so every row of one invoice would carry the same
 * document; #233 removed exactly that repetition from the order's page, where a
 * header fact was printed once per row it touched. What stays per row is how much of
 * that delivery answered THAT ordered item, which really does differ row to row.
 * The `named` flag went with the move: a list of one, under this invoice's own
 * heading, has nothing left to mark.
 *
 * The delivery is returned WITHOUT its orders, deliberately. It can carry bills this
 * invoice has nothing to do with, so naming its ordered items here would show orders
 * this invoice never charged — the frame argument #233 recorded from the other side.
 *
 * `invoiceItems` are the invoice's own already-loaded Invoice Items, which the
 * detail page holds anyway, so this adds no query for them.
 * `linkedDeliveryRecordId` comes off the invoice record the page also holds.
 */
export async function getInvoiceReconciliation(invoiceItems, { linkedDeliveryRecordId } = {}) {
    const items = (invoiceItems || []).map((l) => ({
        id: l.id,
        invoiceItemId: l.invoiceItemId,
        poItemRecordId: (l.poItem || [])[0] ?? null,
        itemName: l.itemName,
        size: l.size,
        unit: l.unit,
        qty: l.qty,
    }));

    /** An invoice item with nothing to compare against. Still gets a row. */
    const notComparedRow = (l) => ({
        id: l.id,
        invoiceItemId: l.invoiceItemId,
        itemName: l.itemName || "",
        size: l.size || "",
        unit: l.unit || "",
        poItemId: null,
        // #167 — no ordered item means no material to fold on.
        materialRecordId: null,
        status: null,
    });

    // THE MATCHED DELIVERY, READ BEFORE THE EARLY RETURN SO BOTH BRANCHES HAVE IT.
    // An invoice whose every invoice item is free text still has a `Delivery` field,
    // and the section states what that field holds whether or not anything below it
    // could be judged. Costs nothing when the field is empty, which is the state
    // `fitRefusal` guarantees for such an invoice on the computed path — an invoice
    // charging no ordered item is refused as `noOrderedItem`, so a link here means
    // somebody set it by hand.
    const [delivery = null] = linkedDeliveryRecordId
        ? await getDeliveriesByRecordIds([linkedDeliveryRecordId])
        : [];

    const judged = items.filter(countsTowardStatus);
    if (judged.length === 0) {
        return {
            rows: items.map(notComparedRow),
            excludedCount: items.length,
            summary: summarizeInvoiceStatus({
                itemStatuses: [],
                hasDelivery: Boolean(linkedDeliveryRecordId),
                excludedCount: items.length,
            }),
            delivery,
        };
    }

    const poItems = await getPOItemsForReconciliation([...new Set(judged.map((l) => l.poItemRecordId))]);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    // Every delivery on those ordered items, in one batched read. Two things come out
    // of the same rows: the ordered item's own totals, split on `Over Delivered`,
    // and how much the delivery THIS invoice matches brought.
    //
    // STILL EVERY SLICE, AND #232 DID NOT CHANGE THAT — the honest report is that
    // this level did not shrink. `deliveredBeyondOrder` stays an ORDER-scoped fact, and
    // only the rows carry `Over Delivered`, so the split needs the ordered item's
    // whole history however narrow the screen's frame becomes. Narrowing that fact
    // too would take this read down to the matched delivery's own slices and cost
    // the box its only honest statement about the order; the level below is what
    // moved instead.
    const slices = await getDeliveryItemsByRecordIds(poItems.flatMap((p) => p.deliveryItems || []));
    const deliveredByOrderedItem = deliveredByPOItem(slices);
    const deliveredByPair = deliveredByDeliveryAndOrderedItem(slices);

    // IN THE INVOICE'S OWN INVOICE ITEM ORDER, judged and not-compared
    // interleaved, so the boxes read down the page in the same order as the items
    // table above them.
    const rows = items.map((l) => {
        const orderedItem = countsTowardStatus(l) ? poItemById.get(l.poItemRecordId) : null;
        // A link that resolves to nothing is not a judgeable invoice item either —
        // the same outcome as no link at all, so it takes the same row.
        if (!orderedItem) return notComparedRow(l);

        const delivered = deliveredByOrderedItem.get(orderedItem.id) || { within: 0, beyond: 0 };
        const orderedItemFacts = orderedItemStatus({
            orderedQty: orderedItem.qty,
            invoicedQty: orderedItem.invoicedQty,
            deliveredWithinQty: delivered.within,
            deliveredOverQty: delivered.beyond,
        });

        return {
            // THE INVOICE ITEM'S RECORD ID, WHICH IS THE LANGUAGE THE FOLD SPEAKS
            // (#241). `foldInvoiceItems` states its groups as `rowIds`, record ids
            // off the invoice items the page loaded, so the delivery section's
            // entries join back to these rows on this field —
            // lib/invoiceDeliveryEntries.js. `invoiceItemId` is the human `X ID` and
            // is what the page keys React on; neither substitutes for the other.
            id: l.id,
            invoiceItemId: l.invoiceItemId,
            // The label comes from the ORDERED item, which is the document the
            // comparison is against — the same call lib/deliveryCandidates.js
            // makes for its item labels. A FOLDED ENTRY CANNOT USE IT (#241): a
            // fold can span two ordered items, so there is no single one to name,
            // and the entry takes the invoice item's own frozen copy instead — the
            // source #237 chose, for the same reason.
            itemName: orderedItem.itemName,
            size: orderedItem.size,
            unit: orderedItem.unit || l.unit || "",
            poItemId: orderedItem.poItemId,
            // A `poRecordId` RODE HERE FROM #167 TO #232 AND IS GONE. The screen used
            // it for a per-entry link to the order, which #167 added when the items
            // table dropped its PO column; #232 removed the link — which order an
            // invoice item was billed against is not a delivery fact and is not one a
            // reader of that screen acts on — and #237 took the question, under
            // `Purchase Orders`. Nothing here is #237's to inherit: it reads
            // `Invoice Items."PO"` off the items the page already holds, so this walk
            // was never its source.
            //
            // #167 — #18's item identity, the key the items table folds a split
            // invoice item back together on. Never `Item Name` text. That one stays.
            materialRecordId: orderedItem.material?.[0] ?? null,
            status: {
                ...invoiceShareStatus({
                    billed: l.qty,
                    delivered: linkedDeliveryRecordId
                        ? deliveredByPair.get(`${linkedDeliveryRecordId}::${orderedItem.id}`) || 0
                        : 0,
                }),
                // THE ORDERED ITEM'S TWO EXCEPTION FACTS, CARRIED ON THE SHARE
                // BECAUSE ONE LINE OF COPY STATES THEM TOGETHER. They belong to the
                // ordered item and not to one invoice, which is why
                // `STATUS_COPY.detail.againstOrder` names that frame out loud, and
                // they are also what gates it — so a bare share stays silent about an
                // ordered item it holds no figure from. `ordered` rode along here in
                // #232's first pass, for a leading term that issue then took back
                // out; nothing on this screen reads the ordered quantity now, and
                // `/pos/[poId]` is where it is answered.
                deliveredBeyondOrder: orderedItemFacts.deliveredBeyondOrder,
                billedBeyondOrder: orderedItemFacts.billedBeyondOrder,
            },
        };
    });

    // COUNTED OFF THE ROWS, not off `judged`. An invoice item whose `PO Item` link
    // resolves to nothing took the not-compared row above, so counting the
    // filter's input would let the summary claim a judged invoice item the page
    // does not show.
    const judgedStatuses = rows.filter((r) => r.status).map((r) => r.status);

    return {
        rows,
        excludedCount: rows.length - judgedStatuses.length,
        summary: summarizeInvoiceStatus({
            itemStatuses: judgedStatuses,
            hasDelivery: Boolean(linkedDeliveryRecordId),
            excludedCount: rows.length - judgedStatuses.length,
        }),
        delivery,
    };
}

/**
 * The invoicing status of many deliveries at once, for the deliveries list.
 *
 * CALLED FOR EVERY VIEWER SINCE #211. It used to be the caller's decision, and
 * skipping it was the withholding; the deliveries list is Job-scoped and #211
 * admits an employee to that job's invoices, so there is no viewer left for whom
 * this level is out of bounds. See the module header.
 *
 * `deliveries` are already-loaded delivery objects carrying their `deliveryItems`
 * and `invoices` link arrays, which the list already reads.
 *
 * IT NO LONGER READS `PO Items`, AND THAT IS #210's DOING. The old walk went out to
 * the ordered items to ask whether ANY invoice item hung off them — an existence
 * test over a level shared with every other delivery on the same order. Both sides
 * carry the ordered item's record id directly, so with the pairing stored the join
 * is a comparison between two levels this walk already has.
 *
 * Returns `{ byDelivery, slices }` — a Map of delivery record id -> summary, and
 * THE DELIVERY ITEM ROWS IT READ TO BUILD IT.
 *
 * IT USED TO RETURN THE MAP ALONE, AND THAT COST ITS CALLERS A SECOND READ OF A
 * LEVEL THIS FUNCTION ALREADY HAD IN HAND (#216). `/deliveries` fetched the same
 * slices itself to summarize what was delivered, so one page load read Delivery Items
 * twice — invisible for as long as it stood, because that page carried no
 * `withOpsLabel` and nothing measured it. #216 added the second consumer and the
 * label in the same change, which is what made the duplicate visible at all.
 *
 * A function that reads something and does not hand it back forces the next
 * caller to read it again, so the fix belongs here rather than in a cache at each
 * call site.
 */
export async function getDeliveryInvoicing(deliveries) {
    const byDelivery = new Map();
    const list = deliveries || [];
    if (list.length === 0) return { byDelivery, slices: [] };

    const slices = await getDeliveryItemsByRecordIds(list.flatMap((d) => d.deliveryItems || []));

    // The invoices naming these deliveries, and their invoice items. Both levels are
    // empty — and therefore free — for a delivery nobody has billed yet, which is
    // the state the vendor-chasing worklist is made of.
    const invoices = await getInvoicesByRecordIds([
        ...new Set(list.flatMap((d) => d.invoices || [])),
    ]);
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
    const invoiceItems = await getInvoiceItems(invoices.flatMap((inv) => inv.invoiceItems || []));

    // What the invoices naming ONE delivery charge for, per ordered item. Keyed
    // `delivery::poItem`, the same pairing key the invoice axis uses.
    const deliveryByInvoice = new Map();
    for (const d of list) {
        for (const invoiceRecordId of d.invoices || []) {
            if (invoiceById.has(invoiceRecordId)) deliveryByInvoice.set(invoiceRecordId, d.id);
        }
    }
    const billedByPair = new Map();
    for (const item of invoiceItems) {
        const deliveryRecordId = deliveryByInvoice.get(item.invoice?.[0]);
        if (!deliveryRecordId || !item.poItemRecordId) continue;
        const key = `${deliveryRecordId}::${item.poItemRecordId}`;
        billedByPair.set(key, (billedByPair.get(key) || 0) + (item.qty || 0));
    }

    const orderedItemsByDelivery = new Map();
    for (const slice of slices) {
        const parent = slice.delivery?.[0];
        const orderedItemId = slice.poItem?.[0];
        if (!parent || !orderedItemId) continue;
        if (!orderedItemsByDelivery.has(parent)) orderedItemsByDelivery.set(parent, new Map());
        const forDelivery = orderedItemsByDelivery.get(parent);
        // ONE ENTRY PER DISTINCT ORDERED ITEM, with the delivery's slices summed
        // into it: a delivery can hold two slices of one ordered item — the
        // within-order one and the excess — and counting them as two would make "1
        // of 2 invoiced" out of a single ordered item.
        const entry = forDelivery.get(orderedItemId) || {
            poItemRecordId: orderedItemId,
            delivered: 0,
            billed: billedByPair.get(`${parent}::${orderedItemId}`) || 0,
        };
        entry.delivered += slice.qty || 0;
        forDelivery.set(orderedItemId, entry);
    }

    for (const d of list) {
        byDelivery.set(
            d.id,
            summarizeDeliveryInvoicing([...(orderedItemsByDelivery.get(d.id)?.values() || [])])
        );
    }
    return { byDelivery, slices };
}

// Which PO line a delivered quantity belongs to (#162).
//
// Site staff record an arrival — a vendor, an item, a quantity, a photo of the
// packing list — and never pick a purchase order line. This module is the whole
// of that decision: which lines are candidates, in what order they are filled,
// how one entered quantity becomes several rows, and what happens to a quantity
// no order can absorb.
//
// PURE, AND FOR THREE REASONS RATHER THAN ONE. The obvious two are that
// scripts/tests/offline/delivery-allocation.mjs can pin every clause in CI, and
// that the Server Action re-runs it authoritatively at submit. The third is the
// one that shapes the API: the ENTRY FORM imports this same function to draw its
// pre-submit preview, so what the form promises and what the server writes are
// literally one function rather than two that agree today. That matters here
// more than usual, because there is no allocation-editing UI — a wrong
// allocation is corrected by deleting the delivery and entering it again, so the
// preview is the only chance to notice before the fact.
//
// NOTE THE EXPLICIT `.js` on the import below. The offline tier runs under plain
// `node` with no loader, which cannot resolve the extensionless intra-lib
// imports the rest of the app leaves to Next. lib/materialPriceView.js does the
// same thing for the same reason, and its comment records why deviating from the
// import style beats inlining a rule that already exists.

import { countsAsOrdered } from "./materialPriceView.js";

/**
 * How much of an ordered line has not arrived yet.
 *
 * Deliberately NOT lib/poItemQty.js:remainingQty with `deliveredQty` passed as
 * `invoicedQty`. The arithmetic coincides; the question does not. That one asks
 * "how much is left to invoice" and MUST keep a negative result, because a
 * vendor over-billing is a state the invoice screens surface. This one asks "how
 * much is left to arrive", and a negative result is not a candidate for more
 * arrivals at all — it is over-delivery, which this module handles as its own
 * case rather than as a negative remainder. Two questions, two fields, two
 * rules; sharing the subtraction would only hide which was being asked.
 *
 * Blank/absent inputs count as 0: a PO line with no deliveries has an empty
 * rollup, and Airtable returns undefined rather than 0 for it.
 */
export function undeliveredQty({ qty, deliveredQty }) {
    return (qty || 0) - (deliveredQty || 0);
}

/** Whether this line can still absorb an arrival. */
export function hasUndeliveredQty(line) {
    return undeliveredQty(line) > 0;
}

/**
 * The lines this arrival could possibly belong to — the NARROWED LINE SET.
 *
 * Four conditions, and each is a decision:
 *
 *   - the PO's vendor is the vendor who delivered. A line ordered from someone
 *     else is not this shipment whatever it says.
 *   - the line points at the material the recorder picked. MATCHED ON #18's
 *     `Material` LINK, never on `Item Name` text — the vendor wrote the packing
 *     list and we wrote the PO, so the two strings do not agree, which is the
 *     whole reason the item axis exists. It is also why the recorder picks from
 *     a dropdown rather than typing.
 *   - `countsAsOrdered`, i.e. #18's `Committed Qty` is above zero. This is how a
 *     withdrawn PO's lines are excluded, and it is READ rather than re-derived
 *     from the status string: the which-POs-count rule lives in that one named
 *     Airtable field (see CLAUDE.md), and #19's price screens read it the same
 *     way. It also excludes a Qty 0 line, which has nothing to deliver anyway.
 *     Signature status is deliberately NOT a condition — site sometimes orders
 *     first and the PR and PO follow as a record, so an Awaiting Signature line
 *     must still be able to receive its own arrival.
 *   - if the packing list named a PO, only that PO's lines. A HARD restriction,
 *     not a preference: see planDelivery on why excess never spills.
 *
 * Returned BEFORE the undelivered filter, because the narrowed set is what
 * decides whether an over-delivery row can name a line (planDelivery).
 */
export function selectCandidates({ lines, vendorRecordId, materialRecordId, poRecordId = null }) {
    return (lines || []).filter((line) => {
        if (line.vendorRecordId !== vendorRecordId) return false;
        if (line.materialRecordId !== materialRecordId) return false;
        if (!countsAsOrdered({ committedQty: line.committedQty })) return false;
        if (poRecordId && line.poRecordId !== poRecordId) return false;
        return true;
    });
}

/**
 * Oldest order first.
 *
 * FIFO is the reading site staff already have — "this shipment is against what
 * we ordered before" — and it closes the order that has been waiting longest.
 * It is also stable, which matters because the allocation is never recomputed.
 *
 * The date is the PO's `Created Date`, which is calendar-only, so several orders
 * on one day tie. `PO ID` breaks the tie and is monotonic within a day by
 * construction (lib/ids.js counts that day's POs), then `PO Item ID` orders
 * lines within one PO. Same tie-break chain, and the same reason for it, as
 * lib/materialPriceView.js:sortHistoryRows.
 *
 * A line with no date sorts LAST rather than first: it cannot claim to be the
 * oldest, and putting an undated line at the head of a FIFO queue would let a
 * data gap quietly take priority over a real order.
 */
export function sortCandidates(lines) {
    return [...(lines || [])].sort((a, b) => {
        const da = a.poCreatedDate || "";
        const db = b.poCreatedDate || "";
        if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da.localeCompare(db);
        }
        const pa = a.poId || "";
        const pb = b.poId || "";
        if (pa !== pb) return pa.localeCompare(pb);
        return (a.poItemId || "").localeCompare(b.poItemId || "");
    });
}

/**
 * The whole allocation, in one call. The ONLY entry point callers should use —
 * select, sort and fill are exported for the checks, but reaching for them
 * individually is how a caller ends up filling an unsorted candidate list.
 *
 * Returns:
 *   rows          — one per Delivery Item to create, in creation order:
 *                   { line, qty, over }. `line` is null only on an
 *                   unattributable over-delivery row (see below).
 *   narrowed      — the narrowed line set, for the caller's copy
 *   candidates    — the sorted subset that could absorb quantity
 *   totalUndelivered — how much the candidates could absorb in total
 *   allocated     — how much landed on real lines
 *   over          — how much arrived beyond what was ordered (0 when none)
 *   overAttached  — whether the over row names a line
 *   poRecordIds   — distinct POs the non-over rows drew on
 *
 * ONE QUANTITY BECOMES SEVERAL ROWS, and that is structural rather than
 * cosmetic. A link field carries no quantity, so a single Delivery Item
 * pointing at two PO lines would contribute its FULL Qty to both lines'
 * `Delivered Qty` rollups — a rollup counts the row once per linked parent — and
 * double-count. Splitting 20 into 15 + 5 is what makes the rollup correct.
 *
 * OVER-DELIVERY IS FLAGGED, NEVER REFUSED. The vendor shipped what it shipped,
 * and refusing the entry would mean the arrival is not recorded at all. The
 * excess becomes its OWN row rather than swelling the last allocated row, so the
 * flagged quantity IS the excess and needs no arithmetic to recover, and every
 * unflagged row stays a within-order fact — which is what lets #20 filter on the
 * flag directly.
 *
 * WHETHER THAT ROW NAMES A LINE is the one genuinely ambiguous decision here,
 * and the rule is: only when the narrowed set holds exactly ONE line. Then the
 * excess is attributable — there is a single order it overshot. With two or more
 * orders in play no single one was over-delivered, and writing a guess into
 * `Delivered Qty` would have #20 report it as a fact. Nothing is lost by leaving
 * it unattached, because the row's SIBLINGS already name the orders this arrival
 * drew on; the unattached row records only that the surplus belongs to none of
 * them in particular. It still carries `Material`, `Job` and `Vendor` through
 * the delivery, so it stays visible on the item axis either way.
 *
 * A supplied PO ID does not change that rule, it feeds it: narrowing to one PO
 * usually leaves one line, so the excess attaches to it. If that PO happens to
 * carry two lines of the same material (split quantities are real), the line is
 * ambiguous even though the PO is not — so the row stays unattached and the
 * PO-level fact is recorded on `Deliveries.PO` instead. Two levels of
 * attribution, and each row claims only the level it can support.
 *
 * WHAT THIS DOES NOT DO: re-allocate. The plan is computed once, from one
 * snapshot, and the rows it produces are never revisited. So entering a
 * backdated arrival after a newer one allocates it against whatever is still
 * open at entry time — ORDER OF ENTRY DECIDES, not order of arrival. Accepted
 * rather than solved: re-allocation would mean mutating existing Delivery Items,
 * and there is deliberately no allocation-editing UI. The correction is to
 * delete and re-enter, which is the only correction path anyway.
 */
export function planDelivery({ lines, vendorRecordId, materialRecordId, poRecordId = null, qty }) {
    const narrowed = selectCandidates({ lines, vendorRecordId, materialRecordId, poRecordId });
    const candidates = sortCandidates(narrowed.filter(hasUndeliveredQty));
    const totalUndelivered = candidates.reduce((sum, line) => sum + undeliveredQty(line), 0);

    const wanted = Number(qty);
    // A non-positive or non-numeric quantity plans nothing. The caller refuses
    // it with a message first; this is here so the planner has no undefined
    // behaviour of its own and the check can pin it.
    if (!Number.isFinite(wanted) || wanted <= 0) {
        return {
            rows: [],
            narrowed,
            candidates,
            totalUndelivered,
            allocated: 0,
            over: 0,
            overAttached: false,
            poRecordIds: [],
        };
    }

    const rows = [];
    let left = wanted;
    for (const line of candidates) {
        if (left <= 0) break;
        const take = Math.min(left, undeliveredQty(line));
        if (take <= 0) continue;
        rows.push({ line, qty: take, over: false });
        left -= take;
    }

    const allocated = wanted - left;
    let overAttached = false;
    if (left > 0) {
        const attach = narrowed.length === 1 ? narrowed[0] : null;
        overAttached = Boolean(attach);
        rows.push({ line: attach, qty: left, over: true });
    }

    const poRecordIds = [
        ...new Set(rows.filter((r) => !r.over && r.line).map((r) => r.line.poRecordId)),
    ];

    return {
        rows,
        narrowed,
        candidates,
        totalUndelivered,
        allocated,
        over: left,
        overAttached,
        poRecordIds,
    };
}

// ---------------------------------------------------------------------------
// Copy
//
// Two voices, side by side on purpose, the same arrangement lib/poWithdraw.js
// uses: `preview` addresses the recorder about to act (second person, future),
// `banner` addresses whoever later opens the delivery (third person, past).
// Keeping the pair in one object is the point — a later change to one voice
// cannot quietly leave the other describing the old behaviour.
//
// Each builder returns { key, text }. The key is what the checks pin, so a
// reworded message does not fail a test that was never about wording, while
// choosing the WRONG BRANCH still does.

function poList(rows) {
    return rows
        .filter((r) => r.line)
        .map((r) => `${r.line.poId} ${r.qty}`)
        .join(", ");
}

export const ALLOCATION_COPY = {
    preview: {
        /** More than one order will be drawn on. */
        split: (plan) => ({
            key: "split",
            text:
                `This quantity spans ${plan.poRecordIds.length} purchase orders, so it will be ` +
                `recorded as ${plan.rows.filter((r) => !r.over).length} lines: ${poList(plan.rows.filter((r) => !r.over))}.`,
        }),
        /** Excess, attributable to the single order in play. */
        overAttached: (plan, unit) => {
            const line = plan.rows.find((r) => r.over)?.line;
            return {
                key: "over-attached",
                text:
                    `${plan.over}${unit ? " " + unit : ""} more than the ${plan.totalUndelivered} still ` +
                    `outstanding on ${line?.poId ?? "that order"}. The extra will be recorded against it ` +
                    `and flagged as over-delivery.`,
            };
        },
        /** Excess, with no single order to attribute it to. */
        overUnattached: (plan, unit) => ({
            key: "over-unattached",
            text:
                `${plan.over}${unit ? " " + unit : ""} more than the ${plan.totalUndelivered} still ` +
                `outstanding across ${plan.narrowed.length} orders. The extra will be flagged as ` +
                `over-delivery and not attributed to any one order, because no single order was over-delivered.`,
        }),
        /** Nothing outstanding at all — the fourth state (#162 review). */
        overNothingOutstanding: (plan, unit) => ({
            key: "over-nothing-outstanding",
            text:
                `Everything ordered for this item from this vendor on this job is already recorded as ` +
                `delivered, so all ${plan.over}${unit ? " " + unit : ""} will be flagged as over-delivery. ` +
                `Check the packing list against the order first.`,
        }),
        /**
         * The packing list named a PO and that PO cannot absorb it all. Said
         * separately because the reason it does not spill onto another order is
         * the DOCUMENT, and a recorder holding that document should be told so
         * rather than left to wonder why a later order was not used.
         */
        overPoNarrowed: (plan, unit, poId) => ({
            key: "over-po-narrowed",
            text:
                `${poId} has ${plan.totalUndelivered}${unit ? " " + unit : ""} still outstanding, less than ` +
                `the ${plan.allocated + plan.over} on this packing list. Because the packing list names ` +
                `${poId}, the extra is recorded against it and flagged rather than allocated to another order.`,
        }),
    },
    banner: {
        split: (rows) => ({
            key: "split",
            text: `Recorded across ${
                new Set(rows.filter((r) => !r.over && r.poId).map((r) => r.poId)).size
            } purchase orders.`,
        }),
        overAttached: (qty, unit, poId) => ({
            key: "over-attached",
            text: `Over-delivery — ${qty}${unit ? " " + unit : ""} arrived beyond what ${poId} ordered.`,
        }),
        overUnattached: (qty, unit) => ({
            key: "over-unattached",
            text:
                `Over-delivery — ${qty}${unit ? " " + unit : ""} arrived beyond what was ordered, and could ` +
                `not be attributed to one order.`,
        }),
    },
};

/**
 * The preview messages for one plan, in the order they should be shown.
 *
 * All the branching lives here so neither the form nor the detail page decides
 * which case it is looking at. Returns [] for a plan that allocates cleanly onto
 * one order — silence is right there, because nothing happened that the recorder
 * did not already type.
 */
export function describePlan(plan, { unit = "", poId = null } = {}) {
    const messages = [];
    if (plan.poRecordIds.length > 1) messages.push(ALLOCATION_COPY.preview.split(plan));

    if (plan.over > 0) {
        if (poId) {
            messages.push(ALLOCATION_COPY.preview.overPoNarrowed(plan, unit, poId));
        } else if (plan.candidates.length === 0) {
            messages.push(ALLOCATION_COPY.preview.overNothingOutstanding(plan, unit));
        } else if (plan.overAttached) {
            messages.push(ALLOCATION_COPY.preview.overAttached(plan, unit));
        } else {
            messages.push(ALLOCATION_COPY.preview.overUnattached(plan, unit));
        }
    }

    return messages;
}

// ---------------------------------------------------------------------------
// The item dropdown
//
// These two live HERE rather than in lib/deliveryCandidates.js, where they
// started, and the reason is a bug this move fixes: the entry form is a Client
// Component, and importing anything from deliveryCandidates.js pulls
// lib/airtable/client.js into the browser bundle, where it throws
// `Missing AIRTABLE_API_KEY` at module load. Importing a module EXECUTES it —
// "the readers are never called on this side" is not a defence, and no amount of
// tree-shaking removes a dependency whose evaluation throws.
//
// So the boundary is not "which functions does the client call" but "which
// modules does the client import". Everything the form needs has to be reachable
// without touching lib/airtable/, which is exactly what this module already
// guarantees. They belong here on their own merits too: what the dropdown offers
// is the other half of the allocation decision, and CLAUDE.md documents the two
// side by side.

/**
 * The item dropdown for one vendor: every material that vendor supplied to these
 * lines, with how much is still outstanding.
 *
 * DELIBERATELY WIDER THAN THE ALLOCATION CANDIDATE SET. It lists a material whose
 * orders are already fully delivered, with `outstanding: 0`, instead of dropping
 * it. Narrowing to outstanding-only would make that item VANISH, and the recorder
 * would then land on the "not in the dropdown" message — which says the item may
 * never have been ordered here. That would be false: it was ordered, the app
 * knows it, and it is merely satisfied. Showing it lets the screen say the true
 * thing and flag the entry as over-delivery, which is what "over-delivery is
 * flagged, not blocked" requires.
 *
 * Withdrawn lines ARE excluded, by the same `countsAsOrdered` judgement
 * allocation applies, so an item ordered only on a cancelled PO does not appear.
 * The caller filters by Job first; this only narrows by vendor.
 */
export function buildItemOptions(lines, vendorRecordId) {
    const byMaterial = new Map();

    for (const line of lines || []) {
        if (line.vendorRecordId !== vendorRecordId) continue;
        if (!countsAsOrdered({ committedQty: line.committedQty })) continue;

        const remaining = Math.max(0, undeliveredQty(line));
        const existing = byMaterial.get(line.materialRecordId);
        if (existing) {
            existing.ordered += line.qty || 0;
            existing.delivered += line.deliveredQty || 0;
            existing.outstanding += remaining;
            existing.lineCount += 1;
        } else {
            byMaterial.set(line.materialRecordId, {
                materialRecordId: line.materialRecordId,
                // First line's spelling wins the label, the same first-seen rule
                // Materials itself uses for `Item Name` (#18).
                itemName: line.itemName,
                size: line.size,
                unit: line.unit,
                ordered: line.qty || 0,
                delivered: line.deliveredQty || 0,
                outstanding: remaining,
                lineCount: 1,
            });
        }
    }

    return [...byMaterial.values()].sort((a, b) =>
        `${a.itemName} ${a.size}`.localeCompare(`${b.itemName} ${b.size}`)
    );
}

/** A label for one item option — `Pipe 2" (EA)`, blanks omitted. */
export function itemOptionLabel(option) {
    return [option.itemName, option.size, option.unit ? `(${option.unit})` : ""]
        .filter(Boolean)
        .join(" ");
}

/**
 * The banner messages for a delivery that already exists, from its stored rows.
 *
 * Takes rows as READ BACK from Airtable — `{ qty, over, poId, unit }` — not the
 * plan, because by the time anyone opens the page the plan is gone and the rows
 * are the record. That is also why this cannot share a code path with
 * describePlan: same decisions, different tense, different input.
 */
export function describeDelivery(rows) {
    const messages = [];
    const list = rows || [];
    const orders = new Set(list.filter((r) => !r.over && r.poId).map((r) => r.poId));
    if (orders.size > 1) messages.push(ALLOCATION_COPY.banner.split(list));

    const overRows = list.filter((r) => r.over);
    for (const row of overRows) {
        messages.push(
            row.poId
                ? ALLOCATION_COPY.banner.overAttached(row.qty, row.unit, row.poId)
                : ALLOCATION_COPY.banner.overUnattached(row.qty, row.unit)
        );
    }

    return messages;
}

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

import { countsAsOrdered } from "./poItemQty.js";

/**
 * How much of an ordered line has not arrived yet.
 *
 * Deliberately NOT lib/poItemQty.js:uninvoicedQty with `deliveredQty` passed as
 * `invoicedQty`. The arithmetic coincides; the question does not. That one asks
 * "how much is left to invoice" and MUST keep a negative result, because a
 * vendor over-billing is a state the invoice screens surface. This one asks "how
 * much is left to arrive", and a negative result is not a candidate for more
 * arrivals at all — it is over-delivery, which this module handles as its own
 * case rather than as a negative remainder. Two questions, two fields, two
 * rules; sharing the subtraction would only hide which was being asked.
 *
 * The SCREEN said `outstanding` for this until #181, which was one of two words
 * for the invoice subtraction as well, so the two questions read as one quantity
 * on the two screens even though the code had always kept them apart. It says
 * `undelivered` now, i.e. what this function is called.
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
/**
 * Why a plan could not be written at all (#165). Two reasons, both meaning the
 * narrowed set is empty, i.e. there is no line to attach anything to — and since
 * every row must name a line, the answer is to record nothing and say why.
 *
 * Exported so the action and the form branch on the same value rather than on
 * their own reading of the plan, and so the copy below can be keyed on it.
 */
export const BLOCKED = {
    /** The packing list named a PO, and that PO carries no line for this item. */
    poHasNoLine: "po-has-no-line",
    /** Nothing on this job from this vendor orders this item at all. */
    notOrdered: "not-ordered",
};

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
 * REDRAW ONE ORDERED ITEM'S WITHIN/OVER BOUNDARY FROM ITS SURVIVING ROWS (#206).
 *
 * `Over Delivered` records a judgment made when its row was written, and
 * deleting a delivery can make it false: the row claims material arrived beyond
 * what an order asked for while the line it sits on is no longer over-delivered.
 * Deletion is the only way to correct an item or a quantity
 * (`lib/deliveryDelete.js` says so itself), so that is the ordinary correction
 * path rather than an odd ordering.
 *
 * IT REPRODUCES #162'S CONTRACT, NOT `planDelivery`'S ALLOCATION, and the
 * difference is the whole reason this function is small. The contract is two
 * statements about QUANTITY: the unflagged rows of a line sum to what was
 * ordered, and the flagged rows sum to the excess. Allocation is a larger thing
 * — it also decides WHICH ordered item an arrival attaches to, by FIFO across
 * candidate lines. This deliberately does not redo that: it works inside one
 * line and moves only the boundary. Holding it to "the same rows a fresh
 * allocation would produce" would apply a standard to row boundaries that is
 * already not applied to line attribution, and the rows would differ for that
 * reason alone — an earlier delivery's freed room is not handed back to a later
 * delivery's row, because that would be re-allocating.
 *
 * SO NOTHING IS EVER MERGED. Two adjacent unflagged rows are redundant, not
 * false; the contract counts quantities and says nothing about how few rows
 * carry them. Merging would delete records — and `groupRowsByItem`'s `rowCount`,
 * the only thing that can see the difference, is read by no screen.
 *
 * THE STRADDLING ROW IS SPLIT, NOT ROUNDED. A row that begins inside the order
 * and ends beyond it is the one case where a flag alone cannot state the truth:
 * leaving it unflagged would claim the whole quantity arrived within the order,
 * and flagging it whole would claim the whole quantity was excess. Both are
 * false, and #162's contract is exactly what they break. There is AT MOST ONE
 * such row per line, because every stored row has a positive `Qty` — both of
 * `planDelivery`'s push sites guarantee it — so the running total is strictly
 * increasing and crosses the ordered quantity once.
 *
 * WHICH PIECE KEEPS THE RECORD IS LOAD-BEARING. The existing row is resized to
 * the WITHIN piece and the excess becomes the new row, never the other way
 * round. A new row is minted by `generateChildId`, so it always sorts LAST — and
 * putting the within piece there would leave a line reading `within, over,
 * within`, breaking the property this function relies on. Measured: with the
 * excess as the new row the result is stable under a second run; with the within
 * piece as the new row a second run moves the flag onto a different record,
 * which would silently take it off a row carrying an `Overage PR` link.
 *
 * That ordering also means the link never has to move. The resized row keeps
 * whatever it held and simply stops being flagged, which `isNoLongerOverDelivered`
 * is what reports; the new row is flagged and carries nothing.
 *
 * PURE, and that is load-bearing rather than tidy: the offline tier can only
 * hold this and `planDelivery` to the same contract if neither touches Airtable.
 *
 * Returns the desired state of the rows that already exist, plus the flagged
 * rows that have to be created. A caller applies `rows` first — see
 * lib/deliveryDelete.js for why that order is the safe one.
 */
export function recomputeOverDelivery({ orderedQty, rows } = {}) {
    const ordered = orderedQty || 0;
    const out = { rows: [], splits: [] };
    let filled = 0;

    for (const row of sortRowsByEntryOrder(rows)) {
        const qty = row.qty || 0;
        const room = Math.max(0, ordered - filled);

        if (room >= qty) {
            // Wholly inside the order.
            out.rows.push({ id: row.id, qty, overDelivered: false });
        } else if (room === 0) {
            // Wholly beyond it.
            out.rows.push({ id: row.id, qty, overDelivered: true });
        } else {
            // The one row that crosses. The record keeps the within piece.
            out.rows.push({ id: row.id, qty: room, overDelivered: false });
            out.splits.push({ fromRowId: row.id, qty: qty - room });
        }
        filled += qty;
    }

    return out;
}

/** Rows in the order they were entered — see recomputeOverDelivery on why the id is that order. */
export function sortRowsByEntryOrder(rows) {
    return [...(rows || [])].sort((a, b) =>
        (a.deliveryItemId || "").localeCompare(b.deliveryItemId || "")
    );
}

/**
 * The whole allocation, in one call. The ONLY entry point callers should use —
 * select, sort and fill are exported for the checks, but reaching for them
 * individually is how a caller ends up filling an unsorted candidate list.
 *
 * Returns:
 *   rows          — one per Delivery Item to create, in creation order:
 *                   { line, qty, over }. EVERY row names a line; see the
 *                   invariant below.
 *   blocked       — null, or a reason this arrival cannot be recorded at all
 *   narrowed      — the narrowed line set, for the caller's copy
 *   candidates    — the sorted subset that could absorb quantity
 *   totalUndelivered — how much the candidates could absorb in total
 *   allocated     — how much landed on real lines
 *   over          — how much arrived beyond what was ordered (0 when none)
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
 * THE OVER ROW ALWAYS NAMES A LINE (#165), and it attaches to THE END OF THE
 * FILL ORDER: the last line this arrival actually filled, or — when it filled
 * nothing, because every order for the material is already complete — the last
 * line in the same ordering, i.e. the most recent PO's.
 *
 * #162 left it unattached whenever the narrowed set held more than one line, on
 * the grounds that no single order had been over-delivered and a guess written
 * into `Delivered Qty` would be reported as fact. The cost of NOT attaching
 * turned out to be worse than the imprecision it avoided: an unlinked row is in
 * no line's `Delivered Qty`, so it is invisible on the invoice axis, and a
 * delivery that arrived in full reads as less arrived than was billed. That
 * misreading points at withholding payment, which is the expensive direction to
 * be wrong in. Attaching is imprecise about WHICH order absorbed the surplus;
 * not attaching was wrong about WHETHER the material arrived.
 *
 * THE TAIL IS TAKEN FROM sortCandidates, NOT FROM A SECOND COMPARATOR. Both
 * branches are positions in the one order this module already fills in, so
 * "most recent" is `sortCandidates(...).at(-1)` rather than a reversed copy of
 * the same rule — one comparator, and the two branches read as one sentence:
 * the last line filled, or the last that would have been. A consequence worth
 * naming: sortCandidates deliberately sorts an UNDATED line last so a data gap
 * cannot take FIFO priority, so the tail picks that line as "most recent". That
 * stays coherent under the same reading — last to be filled, last to be blamed —
 * and it is unreachable today: every PO on this base carries a Created Date
 * (measured, 24 of 24).
 *
 * NOT DEPENDENT ON ONE PO HOLDING ONE LINE PER MATERIAL. sortCandidates is a
 * total order, so both branches are defined whether a PO carries one line of a
 * material or five — which is the whole reason #162's `narrowed.length === 1`
 * test is gone rather than widened. It also settles the sub-case #162 could only
 * record at PO level: a PO that carries two lines of the same material now
 * resolves to a line by fill order, so `Deliveries.PO` is no longer carrying
 * that fact alone.
 *
 * A supplied PO ID still HARD-RESTRICTS the choice, unchanged: both branches
 * draw only from `narrowed`, which selectCandidates has already filtered to that
 * PO, so excess never spills onto another order.
 *
 * THE INVARIANT, and the one new outcome it forces: a plan is either BLOCKED or
 * every row it produces names a line. There is one way to have nothing to attach
 * to — the narrowed set is empty — and #162 wrote a row with no link and blank
 * frozen fields for exactly that.
 *
 * WHERE `blocked` IS ACTUALLY REACHABLE, written out because getting it wrong put
 * a false claim in three files at once. NOT FROM THE ENTRY FORM. With a PO in use
 * the form builds its item options from that PO's OWN lines, and both the PO
 * checkbox and the PO input reset the item rows, so a recorder cannot be holding a
 * selection the typed PO does not carry — not even transiently. With no PO the
 * options come from lines already filtered by vendor and `countsAsOrdered`, so
 * every offered material has a candidate. The form refuses these combinations by
 * never offering them, which is why it has no blocked branch of its own.
 *
 * It is reachable at SUBMIT, which is why the refusal lives in the Server Action.
 * That re-runs this from a fresh read, and a PO can be withdrawn while the form
 * sits open: `countsAsOrdered` then drops its lines and the narrowed set empties
 * under a selection that was valid when it was made. A direct call on the action,
 * which needs no form at all, is the other way in. Both end in a refusal carrying
 * the reason rather than an unlinked row — overriding the document the recorder is
 * holding would be worse than asking them to fix it.
 *
 * WHAT THIS DOES NOT DO: re-allocate. The plan is computed once, from one
 * snapshot, and the rows it produces are never revisited. So entering a
 * backdated arrival after a newer one allocates it against whatever is still
 * open at entry time — ORDER OF ENTRY DECIDES, not order of arrival. Accepted
 * rather than solved: re-allocation would mean mutating existing Delivery Items,
 * and there is deliberately no allocation-editing UI. The correction is to
 * delete and re-enter, which is the only correction path anyway.
 *
 * THAT PARAGRAPH NOW HAS ONE EXCEPTION, AND IT WAS WRITTEN WITHOUT SEEING IT.
 * It reasons about BACKDATED ENTRY — an arrival recorded after a newer one —
 * where the plan is imprecise about which order carries a surplus but no stored
 * flag is false. Deleting a delivery is the other half of the same "delete and
 * re-enter" it recommends, and there the flags DO become false: a row can be
 * left claiming an excess on a line that is no longer over-delivered. So #206
 * mutates existing rows on the delete path — see recomputeOverDelivery — and
 * the exception is narrow on purpose. It redraws the within/over boundary
 * inside ONE line and never revisits which line an arrival attached to, so the
 * FIFO attribution this paragraph is really about is still computed once and
 * never revised.
 */
export function planDelivery({ lines, vendorRecordId, materialRecordId, poRecordId = null, qty }) {
    const narrowed = selectCandidates({ lines, vendorRecordId, materialRecordId, poRecordId });
    const candidates = sortCandidates(narrowed.filter(hasUndeliveredQty));
    const totalUndelivered = candidates.reduce((sum, line) => sum + undeliveredQty(line), 0);

    const empty = (blocked = null) => ({
        rows: [],
        blocked,
        narrowed,
        candidates,
        totalUndelivered,
        allocated: 0,
        over: 0,
        poRecordIds: [],
    });

    const wanted = Number(qty);
    // A non-positive or non-numeric quantity plans nothing. The caller refuses
    // it with a message first; this is here so the planner has no undefined
    // behavior of its own and the check can pin it. Not `blocked`: there is
    // nothing wrong with the arrival, only with the number typed for it.
    if (!Number.isFinite(wanted) || wanted <= 0) return empty();

    // Nothing to attach to, so nothing is written. Which reason it is depends
    // only on whether the packing list named a PO, and the two are worth
    // separating because they ask the recorder for different things: fix the PO
    // number, or check whether this item was ordered here at all.
    if (narrowed.length === 0) {
        return empty(poRecordId ? BLOCKED.poHasNoLine : BLOCKED.notOrdered);
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
    if (left > 0) {
        // The end of the fill order: the last line this arrival filled, or the
        // last line it would have filled if any had room. `narrowed` is non-empty
        // here, so the fallback always resolves and the row always names a line.
        const lastFilled = rows.at(-1)?.line ?? null;
        const attach = lastFilled ?? sortCandidates(narrowed).at(-1);
        rows.push({ line: attach, qty: left, over: true });
    }

    const poRecordIds = [
        ...new Set(rows.filter((r) => !r.over && r.line).map((r) => r.line.poRecordId)),
    ];

    return {
        rows,
        blocked: null,
        narrowed,
        candidates,
        totalUndelivered,
        allocated,
        over: left,
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
// cannot quietly leave the other describing the old behavior.
//
// Each builder returns { key, text }. The key is what the checks pin, so a
// reworded message does not fail a test that was never about wording, while
// choosing the WRONG BRANCH still does.
//
// SWEPT IN #166, which is another issue's work reaching into this module on
// purpose. That issue put the same facts on the invoice screens, and the two
// would otherwise have said `arrived` here and `delivered` there for one fact
// whose table is `Deliveries` and whose rollup is `Delivered Qty`. A second name
// makes a reader ask what the difference is, and there is none.
//
// SWEPT AGAIN IN #181, which finished the job on the Airtable side. #166 left the
// field named `Over Delivery` and said renaming it would break a lookup rather
// than fix a word — measured wrong since #167: a rename carries every formula,
// rollup, lookup and view filter with it, because the name is a rendering and the
// field id is the storage. So the field is `Over Delivered` now, a participle like
// `President Signed`, and the only thing the rename could break was a string
// literal in this repo. #181 also retired `outstanding` from this module's copy in
// favor of `undelivered`, for the same one-word-per-fact reason: `Materials` had
// a field of that name holding a DIFFERENT subtraction.

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
                `recorded against ${plan.rows.filter((r) => !r.over).length} ordered items: ${poList(plan.rows.filter((r) => !r.over))}.`,
        }),
        /** Excess, recorded against the last order this arrival filled (#165). */
        overAttached: (plan, unit) => {
            const line = plan.rows.find((r) => r.over)?.line;
            return {
                key: "over-attached",
                text:
                    `${plan.over}${unit ? " " + unit : ""} more than the ${plan.totalUndelivered} still ` +
                    `undelivered on ${line?.poId ?? "that order"}. The extra will be recorded against it ` +
                    `and flagged as over-delivered.`,
            };
        },
        /**
         * Nothing left undelivered at all — the fourth state (#162 review). The
         * builder was `overNothingOutstanding` until #181 retired that word here;
         * `fully delivered` is what the message itself says, which is the better
         * name for the branch anyway. Now says
         * WHERE the excess lands (#165): it goes on the most recent order rather
         * than nowhere, and a recorder should be told which one, since the number
         * on that order's `Delivered Qty` will exceed what it asked for.
         */
        overFullyDelivered: (plan, unit) => {
            const line = plan.rows.find((r) => r.over)?.line;
            return {
                key: "over-fully-delivered",
                text:
                    `Everything ordered for this item from this vendor on this job is already ` +
                    `delivered, so all ${plan.over}${unit ? " " + unit : ""} will be flagged as over-delivered ` +
                    `and recorded against ${line?.poId ?? "the most recent order"}. Check the packing list ` +
                    `against the order first.`,
            };
        },
        /**
         * Nothing can be recorded (#165). Both cases mean there is no line to
         * attach to, and the fix differs, so they are two messages rather than
         * one: the first is a contradiction between the PO number and the item,
         * the second says the item was never ordered here.
         *
         * CONSUMED BY createDeliveryAction, not rendered as a live preview — the
         * form cannot produce a blocked plan (see planDelivery on where `blocked`
         * is reachable). It sits in `preview` rather than `banner` because the
         * voice is right: it addresses the recorder who just acted, about
         * something that will not be recorded, not a later viewer reading history.
         */
        blocked: (plan, { poId = null, label = "" } = {}) =>
            plan.blocked === BLOCKED.poHasNoLine
                ? {
                      key: "blocked-po-has-no-line",
                      text:
                          `${poId ?? "That purchase order"} does not include ${label || "this item"}. ` +
                          `Check the number on the packing list, or clear it to record the arrival ` +
                          `against this job's other orders.`,
                  }
                : {
                      key: "blocked-not-ordered",
                      text:
                          `Nothing on this job orders ${label || "this item"} from this vendor, so there is ` +
                          `no order to record it against.`,
                  },
        /**
         * The packing list named a PO and that PO cannot absorb it all. Said
         * separately because the reason it does not spill onto another order is
         * the DOCUMENT, and a recorder holding that document should be told so
         * rather than left to wonder why a later order was not used.
         */
        overPoNarrowed: (plan, unit, poId) => ({
            key: "over-po-narrowed",
            text:
                `${poId} has ${plan.totalUndelivered}${unit ? " " + unit : ""} still undelivered, less than ` +
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
        // `label` is the item name, supplied only when the delivery holds more
        // than one item — see describeDelivery on why it is conditional.
        overAttached: (qty, unit, poId, label = null) => ({
            key: "over-attached",
            text:
                `Over-delivered — ${qty}${unit ? " " + unit : ""}${label ? " of " + label : ""} ` +
                `delivered beyond what ${poId} ordered.`,
        }),
        /**
         * KEPT AFTER #165, although the planner no longer produces an unattached
         * row. This reads STORED rows, and a stored row is not ours to guarantee:
         * a `PO Item` link removed by hand in Airtable would otherwise render as
         * an attached over-delivery naming no order, or as nothing at all. Showing
         * the unexpected state beats swallowing it — the same call #19's status
         * tag makes for an option nobody registered. Measured at the time of
         * #165: 0 stored rows lack the link.
         */
        overUnattached: (qty, unit, label = null) => ({
            key: "over-unattached",
            text:
                `Over-delivered — ${qty}${unit ? " " + unit : ""}${label ? " of " + label : ""} delivered ` +
                `beyond what was ordered, and could not be attributed to one order.`,
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
export function describePlan(plan, { unit = "", poId = null, label = "" } = {}) {
    // A blocked plan writes nothing, so nothing else it might say is true. One
    // message, and it is the reason (#165).
    if (plan.blocked) return [ALLOCATION_COPY.preview.blocked(plan, { poId, label })];

    const messages = [];
    if (plan.poRecordIds.length > 1) messages.push(ALLOCATION_COPY.preview.split(plan));

    if (plan.over > 0) {
        if (poId) {
            messages.push(ALLOCATION_COPY.preview.overPoNarrowed(plan, unit, poId));
        } else if (plan.candidates.length === 0) {
            messages.push(ALLOCATION_COPY.preview.overFullyDelivered(plan, unit));
        } else {
            // The only remaining case: the excess attaches to the last line
            // filled. There is no unattached branch any more (#165) — every over
            // row names a line, or the plan was blocked above.
            messages.push(ALLOCATION_COPY.preview.overAttached(plan, unit));
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
// "the readers are never called on this side" is not a defense, and no amount of
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
 * lines, with how much of it is still undelivered.
 *
 * DELIBERATELY WIDER THAN THE ALLOCATION CANDIDATE SET. It lists a material whose
 * orders are already fully delivered, with `undelivered: 0`, instead of dropping
 * it. Narrowing to undelivered-only would make that item VANISH, and the recorder
 * would then land on the "not in the dropdown" message — which says the item may
 * never have been ordered here. That would be false: it was ordered, the app
 * knows it, and it is merely satisfied. Showing it lets the screen say the true
 * thing and flag the entry as over-delivery, which is what "over-delivery is
 * flagged, not blocked" requires.
 *
 * Withdrawn lines ARE excluded, by the same `countsAsOrdered` judgment
 * allocation applies, so an item ordered only on a canceled PO does not appear.
 * The caller filters by Job first; this only narrows by vendor.
 */
export function buildItemOptions(lines, vendorRecordId) {
    const byMaterial = new Map();

    for (const line of lines || []) {
        if (line.vendorRecordId !== vendorRecordId) continue;
        if (!countsAsOrdered({ committedQty: line.committedQty })) continue;

        const undelivered = Math.max(0, undeliveredQty(line));
        const existing = byMaterial.get(line.materialRecordId);
        if (existing) {
            existing.ordered += line.qty || 0;
            existing.delivered += line.deliveredQty || 0;
            existing.undelivered += undelivered;
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
                undelivered,
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
 * The options one entry row may offer: everything except what ANOTHER row has
 * already claimed.
 *
 * Same rule as the invoice form's per-line PO Item dropdown (#91) and for the
 * same reason — an item already on the delivery is not a second thing to add, so
 * offering it invites a duplicate that says nothing new. Here it does one more
 * job: quantities for one material are summed before allocation runs, so two rows
 * of it would collapse into one plan and the second row's preview would have
 * nothing of its own to show. Better not to offer the choice.
 *
 * THIS ROW'S OWN SELECTION IS ALWAYS KEPT, whatever the other rows hold. Dropping
 * it would leave a `<select>` whose value matches no option, which renders blank
 * and silently loses what the recorder picked.
 *
 * Pure, and here rather than inline in the form, so the offline tier can pin it —
 * a rule about what a control may offer is still a rule.
 */
export function availableItemOptions(options, rows, index) {
    const claimedElsewhere = new Set(
        (rows || [])
            .filter((_, i) => i !== index)
            .map((r) => r.materialRecordId)
            .filter(Boolean)
    );
    const own = (rows || [])[index]?.materialRecordId ?? null;
    return (options || []).filter(
        (o) => o.materialRecordId === own || !claimedElsewhere.has(o.materialRecordId)
    );
}

// ---------------------------------------------------------------------------
// Reading a recorded delivery back
//
// A delivery holds one row per ALLOCATED SLICE, so the rows are two things at
// once: several items, and several orders per item. Every surface that shows a
// delivery has to collapse that back into items, so the collapse is one function
// here rather than one per screen.

/**
 * The stored rows grouped into the items a person entered, in entry order.
 *
 * Keyed on `materialRecordId` when present — the item axis identity, not the
 * printed name — and on the frozen name/size/unit otherwise, so an
 * unattributable over-delivery row still groups with its own item. Entry order
 * is first-appearance order, which is `Delivery Item ID` order, which is the
 * order the recorder listed them.
 *
 * `qty` sums every slice, so an item split across three orders reads as the one
 * quantity that arrived. `over` is true when ANY of its slices was flagged,
 * because the question a reader is asking is "did more of this arrive than we
 * ordered", not "which slice carried the excess".
 */
export function groupRowsByItem(rows) {
    const byItem = new Map();

    for (const row of rows || []) {
        const key =
            row.materialRecordId ||
            [row.itemName || "", row.size || "", row.unit || ""].join("::");
        const existing = byItem.get(key);
        if (existing) {
            existing.qty += row.qty || 0;
            existing.over = existing.over || Boolean(row.over);
            existing.rowCount += 1;
            if (row.poId) existing.poIds.add(row.poId);
        } else {
            byItem.set(key, {
                key,
                materialRecordId: row.materialRecordId ?? null,
                itemName: row.itemName || "",
                size: row.size || "",
                unit: row.unit || "",
                qty: row.qty || 0,
                over: Boolean(row.over),
                rowCount: 1,
                poIds: new Set(row.poId ? [row.poId] : []),
            });
        }
    }

    return [...byItem.values()];
}

/**
 * A one-line summary of a delivery for a list: the first item in full, then how
 * many more there are.
 *
 * `extraCount` is deliberately a COUNT rather than more names. A list row has one
 * line of space, and the useful thing there is "there is more here than you can
 * see" — the detail page is where the rest belongs. Callers must render it as its
 * own tag, not appended to the label, or `+2` reads as part of the item name.
 *
 * Returns `null` for a delivery with no rows, which is not a state the app can
 * create (allocation always produces at least one row) but is what a caller sees
 * if the rows have not been fetched.
 */
export function summarizeDelivery(rows) {
    const items = groupRowsByItem(rows);
    if (items.length === 0) return null;

    const [first] = items;
    return {
        first: {
            label: [first.itemName, first.size].filter(Boolean).join(" "),
            qty: first.qty,
            unit: first.unit,
        },
        extraCount: items.length - 1,
        itemCount: items.length,
        // Any item over-delivered flags the whole delivery, so a list can carry
        // the same tag the detail page does without re-deriving the condition.
        hasOverDelivery: items.some((i) => i.over),
    };
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

    // ONE MESSAGE PER OVER-DELIVERED ITEM, not per flagged row, and it names the
    // item once a delivery holds more than one. With a single item the name is
    // already the headline and repeating it in the banner is noise; with several,
    // "3 EA delivered beyond what was ordered" does not say beyond what.
    const items = groupRowsByItem(list);
    const nameIt = items.length > 1;
    for (const item of items.filter((i) => i.over)) {
        const overRows = list.filter((r) => r.over && sameItem(r, item));
        const overQty = overRows.reduce((sum, r) => sum + (r.qty || 0), 0);
        // Attached only if every flagged slice of this item names one order —
        // otherwise the honest statement is the unattached one.
        const poIds = new Set(overRows.map((r) => r.poId).filter(Boolean));
        const label = nameIt ? [item.itemName, item.size].filter(Boolean).join(" ") : null;
        messages.push(
            poIds.size === 1 && overRows.every((r) => r.poId)
                ? ALLOCATION_COPY.banner.overAttached(overQty, item.unit, [...poIds][0], label)
                : ALLOCATION_COPY.banner.overUnattached(overQty, item.unit, label)
        );
    }

    return messages;
}

/** Does a stored row belong to this grouped item? Same key rule as groupRowsByItem. */
function sameItem(row, item) {
    if (item.materialRecordId) return row.materialRecordId === item.materialRecordId;
    return (
        (row.itemName || "") === item.itemName &&
        (row.size || "") === item.size &&
        (row.unit || "") === item.unit
    );
}

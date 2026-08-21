// Raising an overage PR from an over-delivery (#167) — the judgment and its copy.
//
// #162 records a delivery, #165 attaches the excess to an ordered item anyway, #166
// shows it. This is the step that squares the RECORD with it: a corrective PR for
// the difference, and once its PO exists the excess moves onto that PO's own
// ordered item — the delivery row is re-attached and its flag clears, and the
// invoice item splits so the overage order is invoiced rather than reading as never
// invoiced.
//
// THE EXCESS NEEDS NO ARITHMETIC, and that is #162's decision paying off: an
// over-delivery is its OWN Delivery Items row whose `Qty` IS the excess ("the
// flagged quantity IS the excess with no arithmetic"). So nothing here subtracts
// ordered from delivered.
//
// WHAT EARNS A CORRECTION IS THE TWO DOCUMENTS AGREEING ABOVE THE ORDER (#265), and
// the flag alone does not. A correction exists because a site ordered more without
// saying so, or because a vendor ships in packs and sent twenty against an order for
// fifteen; in both the vendor delivered what it delivered and invoiced for it, so
// the only thing out of step is the ORDER. A vendor's own mistake — twelve shipped,
// ten charged — is the opposite shape, and a correction raised on it sends the vendor
// an order for material the vendor never charged for.
//
// SO `Over Delivered` KEEPS ITS MEANING AND STOPS BEING SUFFICIENT. More arriving
// than was ordered is a fact about the delivery, true whatever any invoice says, and
// the office should meet it the moment the packing list is entered — waiting for an
// invoice to show it would hand over the information late. What #265 changes is only
// that the flag opens a QUESTION rather than an affordance.
//
// THE COMPARISON IS THE ORDERED ITEM'S TOTALS, NOT ONE DELIVERY'S AND NOT ONE
// INVOICE'S, and three things force it. `Invoiced Qty` is a rollup over the ordered
// item and #166 already measured what summing one invoice does — it reports material
// as uninvoiced when it is invoiced twice over. An excess exists only relative to the
// ORDERED quantity, which is the ordered item's, so a single delivery's figure has
// nothing to compare against. And `Over Delivered` is itself an ordered-item
// judgment: `recomputeOverDelivery` flags a row only once the cumulative fill has
// passed what was ordered. A screen showing one delivery therefore has to SAY which
// figures it compared — see OVERAGE_COPY.
//
// THREE STATES, AND `overageAgreement` IS ALL OF IT: the totals meet above the order
// (a correction is owed), they do not (the vendor's own discrepancy, either
// direction), or nothing charges the ordered item yet (nothing to judge). The third is
// not permanent — `Invoiced Qty` moves the moment an invoice item is created, so the
// answer arrives whichever document is entered second, and no pairing has to be made
// for it.
//
// #219's TIERS AND ITS TWO INFERENCES ARE GONE WITH THIS. They existed to pick a
// document when the app could not tell whether the excess had been invoiced at all: the
// pairing tiered the candidates and `OVERAGE_INFERRED` said which guess had been
// made. Under the agreement rule a correction is owed only where the excess IS
// invoiced, so the document exists by construction and there is nothing to infer.
// What survives is narrower and is not a tier — see candidateInvoices: the candidates
// are the invoices charging at least the excess, the pairing is a PREFERENCE among
// equals, and where two of them differ on price the choice is refused rather than
// taken, because that choice changes a figure on a document sent to a vendor.
//
// THE ORDERING LIVES HERE AND IS PRIVATE (#219). It was #166's, imported from
// lib/deliveryStatus.js back when that module's own inference used it too; #210
// deleted that reader and left the export standing for this module alone, which is
// exactly the shape #182 exists to stop. Keeping it here and NOT exporting it retires
// that exception rather than relocating it. #265 demoted it from a tie-break with
// consequences to one without: among candidates that agree on price, which is quoted
// changes no figure the app computes.
//
// Pure and dependency-free, so scripts/tests/offline/overage.mjs can pin every
// clause.

/**
 * Why a row cannot be corrected. Keys, so a reworded message fails nothing.
 *
 * THREE OF #219's WENT WITH ITS TIERS (#265). `other-delivery-only` said every invoice
 * on the ordered item names a different delivery, which is no longer a refusal at all
 * — those invoices are in `Invoiced Qty` and so are part of the agreement.
 * `several-unpaired-bills` said nothing records which of two unpaired invoices
 * describes this delivery, and the choice it refused is now either unobservable (same
 * price) or refused under `several-prices-differ` (not). And `excess-exceeds-bill`
 * became unreachable: with one invoice on the ordered item, agreement means it charges
 * the whole delivered quantity, which is at least the excess — so nothing is left for
 * that key to say and `spans-invoices` covers the many-invoice case it was split from.
 */
export const OVERAGE_BLOCKED = {
    notOverDelivered: "not-over-delivered",
    // `noOrderedItem` STOOD HERE AND IS GONE (#278). It refused a row whose
    // `PO Item` link had been emptied by hand — a state allocation cannot write
    // (#165) and which that issue measured at 0 rows on this base — and it carried a
    // sentence and a strip chip that named it to a reader who cannot exist: the one
    // person who can empty a link is the one person who can see the base.
    // `overageEligibility` still refuses such a row, silently, under no key.
    alreadyRaised: "already-raised",
    // #265 — the third state. Nothing charges the ordered item, so there is nothing to
    // agree or disagree with yet, and this resolves itself when the invoice is entered.
    noInvoice: "no-invoice",
    // #265 — the second state: what was delivered and what was invoiced do not meet, so
    // the discrepancy is the vendor's rather than the order's. ONE KEY, TWO VOICES —
    // invoiced short of the delivery and invoiced beyond it are opposite errors and the
    // detail names which, but the strip's chip is one because what a reader does about
    // either is take it up with the vendor (#217's density rule).
    documentsDisagree: "documents-disagree",
    spansInvoices: "spans-invoices",
    // #265 — several invoices could supply the quotation and they do not agree on the
    // unit price, so which one is quoted changes the figure on the corrective order.
    // `several-unpaired-bills`'s posture, moved to the axis where the choice is now
    // observable: a choice with consequences and nothing behind it is refused.
    severalPricesDiffer: "several-prices-differ",
    noInvoiceFile: "no-invoice-file",
};

/**
 * The three answers the two documents can give about one ordered item (#265).
 *
 * `agreed` is the only one that earns a correction. The other two are refusals with
 * different actions behind them, which is why they are keys rather than one "cannot"
 * — see OVERAGE_COPY.
 */
export const OVERAGE_AGREEMENT = {
    agreed: "agreed",
    disagree: "disagree",
    noInvoice: "no-invoice",
};

/**
 * WHETHER A CORRECTION IS PENDING IS READ, NEVER STORED — the linked PR's own
 * Status is the source, which is what makes a withdrawal reopen the row with no
 * write anywhere.
 *
 *   none       — no link, or the linked PR was Withdrawn. The row is offerable.
 *   pending    — Draft or In Review. Someone is on it; do not offer it again.
 *   generated  — Approved or PO Signed, so the overage PO exists.
 *
 * An unrecognized status is treated as `pending` rather than `none`: a status
 * option added to the field later must not silently make a live correction
 * offerable a second time. That is the opposite default from #144's denylist, and
 * deliberately so — here admitting what we do not recognize is the harmful
 * direction.
 *
 * READING ONE HOP FURTHER, to the overage PO's own status, for the same reason the
 * PR's status is read rather than a boolean stored. A PR cannot be withdrawn past
 * In Review (#122), so once its PO exists the PR is stuck at `PO Signed` forever —
 * but the PO itself can be withdrawn (#138) while it carries no invoice, which is
 * exactly the `not-applied` state. Without this clause such a row would read as
 * `generated` and never be offerable again, locked out by a correction that no
 * longer exists.
 *
 * `overagePO` is optional; omitting it only means a withdrawn overage order is not
 * noticed.
 */
export function overagePRState(overagePR, overagePO) {
    if (!overagePR?.status) return "none";
    if (overagePR.status === "Withdrawn") return "none";
    if (overagePR.status === "Draft" || overagePR.status === "In Review") return "pending";
    if (overagePR.status === "Approved" || overagePR.status === "PO Signed") {
        // A withdrawn overage order is no correction at all. Reaching here with the
        // excess ALREADY moved is the known gap CLAUDE.md records — `Delivered Qty`
        // has no status condition, so the excess would quietly leave the order book
        // — and it is unreachable today, because an applied overage carries an
        // invoice item and #138 refuses to withdraw a PO that has one.
        return overagePO?.status === "Withdrawn" ? "none" : "generated";
    }
    return "pending";
}

/**
 * Does this row still need a correction raised (#217)?
 *
 * THE STRIP'S SELECTION, AND IT IS A COMPOSITION RATHER THAN A NEW RULE. Both
 * halves already existed as refusals — `notOverDelivered` and `alreadyRaised` — so
 * this states the same judgment from the other side rather than re-deriving it, and
 * it lives here beside them rather than in the screen module that lists the rows.
 * #216's lesson: check whether the rule is written before writing it again.
 *
 * `overagePO` is optional, exactly as `overagePRState` has it: omitting it only
 * means a withdrawn overage order is not noticed, which reads as "still covered"
 * and is the safe direction for a list that offers to raise a second one.
 *
 * A THIRD EXCLUSION SINCE #278, AND IT FOLLOWS FROM THE SILENT REFUSAL RATHER THAN
 * FROM A NEW JUDGMENT. `overageEligibility` refuses a row whose `PO Item` was
 * emptied by hand and now names no key for it, so the strip would have listed such a
 * row with no button and an empty reason cell — a hole in a strip whose one promise
 * is that every row without a button says what has to come first. Excluding it keeps
 * that promise. The docstring above already argued this shape: a label for a row
 * that cannot appear is copy for nothing, and the inverse holds too.
 */
export function awaitsCorrection({ row, overagePR, overagePO } = {}) {
    if (!row?.overDelivered) return false;
    if (!attachedPOItemRecordId(row)) return false;
    return overagePRState(overagePR, overagePO) === "none";
}

/** Which stage a live correction has reached, for the copy that names it (#217). */
export const OVERAGE_STAGE = {
    draft: "draft",
    inReview: "in-review",
    generated: "generated",
};

/**
 * The stage of a correction that already covers an excess (#217).
 *
 * A COPY-ONLY REFINEMENT OF `overagePRState`, NOT A SECOND ANSWER TO IT. That
 * function decides whether a row is offerable and collapses `Draft` and
 * `In Review` deliberately, because for its question they are the same. For a
 * reader deciding whether to WAIT they are not: a draft has been submitted to
 * nobody, while a request in review is with its signers. So this asks that
 * function first and only then reads the status.
 *
 * AN UNRECOGNIZED STATUS READS AS `in-review`, which is `overagePRState`'s own
 * default carried through: it answers `pending` for anything it does not know, and
 * of the two pending voices the in-review one tells the reader to wait rather than
 * to go and nudge a draft nobody submitted. Returns null when no correction is
 * live, which is the state that has no sentence.
 */
export function overageStageKey(overagePR, overagePO) {
    const state = overagePRState(overagePR, overagePO);
    if (state === "none") return null;
    if (state === "generated") return OVERAGE_STAGE.generated;
    return overagePR?.status === "Draft" ? OVERAGE_STAGE.draft : OVERAGE_STAGE.inReview;
}

/**
 * The ordered item this row's excess belongs to, in every state.
 *
 * `Former PO Item ?? PO Item`: before the apply step the row's own `PO Item` IS the
 * one it was allocated against, and afterwards that names the overage order while
 * the provenance link holds the one it left. One expression rather than a branch at
 * each of the four readers.
 *
 * DELIBERATELY NOT `resolveFormerPOItem`, and this is the layer distinction rather
 * than an oversight. The FIELD is named for what it stores, which is always a past
 * value. This FUNCTION is named for the answer it computes — "which ordered item
 * was this delivery originally allocated against" — and of the three candidate
 * adjectives only `original` is true in both states: `former` is false for a row
 * that never moved, and `current` is false for one that did. A reader who searches
 * the base for "original" and finds nothing is why this pair is in CLAUDE.md's
 * screen-word mapping table (#181).
 *
 * THE TWO MEANINGS ARE NOT IDENTICAL, and the premise that keeps them together is on
 * the field's own description: `Former PO Item` is the IMMEDIATELY PREVIOUS value
 * while this is the FIRST, so a row moved twice (A -> B -> C) would part them.
 * Unreachable today — an overage PO Item's Qty equals the excess exactly, so no
 * further excess can arise on it, and a row's Qty is fixed at creation, so the same
 * row cannot become an over-delivery row a second time.
 */
export function resolveOriginalPOItem(row) {
    return row?.formerPOItemRecordId ?? attachedPOItemRecordId(row);
}

/**
 * The ordered item a row is attached to RIGHT NOW.
 *
 * Reads the mapper's own shape — `poItem` is a link array, single-record only by
 * app convention — so nothing here has to be handed a flattened copy. The
 * distinction from resolveOriginalPOItem above matters exactly once: after the
 * apply step this is the OVERAGE order's item and that one is still the original's.
 */
export function attachedPOItemRecordId(row) {
    return (row?.poItem || [])[0] ?? null;
}

/**
 * The delivery this row belongs to (#219).
 *
 * Flattened the same way and for the same reason as the two links above: single-
 * record by app convention, since the Metadata API refuses `prefersSingleRecordLink`.
 * It exists as an accessor rather than inline at each call site because the narrowing
 * is the whole of what #219 changed, and a `row.delivery?.[0]` spelled out four times
 * is four places for one of them to be forgotten.
 */
export function attachedDeliveryRecordId(row) {
    return (row?.delivery || [])[0] ?? null;
}

/**
 * Has the excess actually moved? PROVENANCE IS THE SIGNAL SINCE #206, not the
 * flag — this used to read `!row.overDelivered`, and that stopped being safe the
 * moment anything else was allowed to write `Over Delivered`.
 *
 * `Former PO Item` is written by exactly one thing, `reattachDeliveryItemToPOItem`,
 * in the SAME `update()` that clears the flag and re-attaches the row to the
 * overage order's ordered item. Airtable applies one record write atomically, so
 * the three cannot half-happen: provenance set means the apply step ran, and
 * provenance empty on a row that carries an `Overage PR` link means it did not.
 * `createDeliveryItem` never writes that field, so there is no other way for it
 * to be set. Verified in code, and — since this base carries no overage order at
 * all — measured once in #206 against a throwaway row put through the real
 * re-attachment: one `update()` produced both halves. That was a temporary
 * script, so nothing standing re-measures it; the commit message records the run.
 *
 * WHY IT HAD TO MOVE. #206 recomputes `Over Delivered` when a delivery is
 * deleted, because deletion can make the flag's arithmetic claim false. Reading
 * the applied/not-applied answer off the same field would have made a
 * recomputation forge `applied` — silently erasing the one signal that reports a
 * real failure, since `not-applied` is the only place PO generation's asymmetry
 * ever surfaces. Provenance is beyond a recomputation's reach by construction.
 *
 * THE EQUIVALENCE HOLDS WHILE A ROW MOVES AT MOST ONCE, which is the premise on
 * `Former PO Item`'s own description: an overage PO Item's `Qty` is the excess
 * exactly, so no further excess can arise on it, and a `Delivery Items` row's
 * `Qty` is fixed at creation. If that ever changes, this is still the field that
 * stays correct — the flag is the one that would not.
 *
 * There is still no notification: the apply step sits OUTSIDE PO generation's
 * rollback on purpose, so a failure there leaves the order standing and the
 * asymmetry behind, and the banner is where it shows.
 */
export function isOverageApplied(row) {
    return Boolean(row?.overagePRRecordId) && Boolean(row?.formerPOItemRecordId);
}

/**
 * Is a live correction now covering an excess that no longer matches its row
 * (#206)?
 *
 * WHAT REPLACED CLEARING THE LINK. Deleting a delivery redraws an ordered item's
 * within/over boundary, and a row that was the excess can stop being it — but
 * the `Overage PR` link is never cleared, because delete-then-reenter IS the
 * correction path and a link destroyed mid-edit cannot be restored when the
 * excess reappears seconds later. So the contradiction is reported rather than
 * resolved, as a qualifier composed with whichever banner the correction already
 * has — #166's shape, where `inferred` is a marker beside a chip rather than a
 * fourth value inside it.
 *
 * THE CONDITION IS "THE FLAG WENT", AND THAT IS THE WHOLE OF IT UNDER #206'S
 * SPLIT. When the boundary crosses a linked row, the recomputation resizes that
 * record to its within piece and mints the excess as a new row, so the linked
 * record stops being flagged and this fires. The other shape one might expect —
 * a linked row still flagged but carrying a different quantity from the one its
 * correction covers — cannot be produced by a delete, because the only row a
 * delete resizes is the one that stops being flagged; every other flagged row
 * keeps its quantity untouched. It IS reachable by editing a draft correction's
 * quantity, which is outside this issue and would cost a read of the overage
 * order's own items on every banner render.
 *
 * NOT REACHABLE FOR AN APPLIED CORRECTION, which is why the copy has two voices
 * rather than three. An applied row left the original ordered item and sits
 * alone on the overage order's ordered item, whose `Qty` is the excess exactly,
 * so a recomputation there always finds it within and its flag stays false — and
 * the provenance test, not the flag, is what makes it read as applied. The
 * provenance clause is what keeps this from firing on every applied row.
 */
export function isNoLongerOverDelivered(row) {
    return (
        Boolean(row?.overagePRRecordId) &&
        !row?.formerPOItemRecordId &&
        !row?.overDelivered
    );
}

/**
 * Oldest invoice first: `Issue Date` ascending, tie-broken by `Invoice ID`.
 *
 * #166'S ORDERING, MOVED HERE BY #219 AND NO LONGER EXPORTED. It was written for a
 * question that no longer exists — filling an ordered item's invoices oldest-first with
 * whatever had been delivered — and #210 deleted that reader while leaving the export
 * standing for this module alone. `selectOverageInvoice` is the only thing that has ever
 * needed to order invoices, so it lives beside it and out of reach.
 *
 * IT DECIDES LESS THAN IT DID (#265). #219 called from one of two tiers and refused
 * to order the other, because there an ordering would have chosen between documents
 * nothing had placed. It now runs LAST, over candidates already narrowed to the ones
 * charging at least the excess AND agreeing on the unit price — so what it picks
 * changes no figure this app computes. What it does change is the file and the
 * vendor's own code, which is why the choice is said out loud rather than left silent
 * (#231's argument for its own tie-break, inherited).
 *
 * `Issue Date` is the vendor's own date on their document, so it is the order the
 * invoices were raised in. It is HUMAN-ENTERED AND BACKDATABLE — the property #164
 * learned the hard way when an ID counter read such a field — so a mistyped date
 * changes which of two equal candidates is quoted. Tolerable for exactly the reason
 * above: the two carry the same price against the same ordered item, so a typo moves
 * a filename and not a figure. `Invoice ID` breaks ties and is monotonic within a day
 * by construction (#164).
 *
 * An undated invoice sorts LAST rather than first: it cannot claim to be the oldest,
 * and a data gap must not take priority in an ordering whose whole point is age — the
 * same call sortCandidates and sortLongestWaitingFirst both make.
 *
 * Does not mutate its input.
 */
function sortInvoicesOldestFirst(invoices) {
    return [...(invoices || [])].sort((a, b) => {
        const da = a.issueDate || "";
        const db = b.issueDate || "";
        if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da.localeCompare(db);
        }
        return (a.invoiceId || "").localeCompare(b.invoiceId || "");
    });
}

/**
 * Do the two documents agree above the order, on this ordered item (#265)?
 *
 * THE WHOLE OF THE NEW RULE, IN THREE LINES, and every figure is a total over the
 * ordered item — see the module header for the three reasons that scope is forced.
 * `deliveredQty` and `invoicedQty` are Airtable rollups (`Delivered Qty`,
 * `Invoiced Qty`); `hasInvoice` is whether anything charges the ordered item at all,
 * which is NOT `invoicedQty > 0` — an invoice item of zero would read as absent.
 *
 * `orderedQty` IS TAKEN AND NOT COMPARED, deliberately. The caller reaches this only
 * for a row carrying `Over Delivered`, and `recomputeOverDelivery` sets that flag only
 * once the cumulative fill has passed what was ordered — so `delivered > ordered` is
 * already true and testing it again would be a second implementation of the flag. It
 * is carried because the SENTENCES name it: a reader looking at one delivery has to be
 * told which figures were compared. `offline/overage.mjs` pins the implication as a
 * property of `recomputeOverDelivery` rather than trusting this paragraph.
 *
 * THE TWO DIRECTIONS OF DISAGREEMENT ARE ONE KEY, because both are the vendor's own
 * discrepancy rather than the order's, and both are refused for the same reason: a
 * correction raised on either sends an order for material the two documents do not
 * both account for. Which direction it is belongs to the copy, and
 * `disagreementDirection` below is what names it.
 */
export function overageAgreement({ orderedQty, deliveredQty, invoicedQty, hasInvoice } = {}) {
    if (!hasInvoice) return OVERAGE_AGREEMENT.noInvoice;
    // `delivered > 0` IS WHAT MAKES A MISSING ARGUMENT FAIL CLOSED, and it was found by
    // the check rather than reasoned in: without it a caller that omits the totals
    // reads 0 against 0, which is arithmetic agreement and would have opened the
    // correction — fail-OPEN, on the one path this issue exists to close. A flagged row
    // always has something delivered on its ordered item, so 0 is not a state the data
    // reaches; where it appears the totals were not supplied, and the disagreement
    // voice is true of the figures it was handed either way.
    return (deliveredQty || 0) === (invoicedQty || 0) && (deliveredQty || 0) > 0
        ? OVERAGE_AGREEMENT.agreed
        : OVERAGE_AGREEMENT.disagree;
}

/**
 * Which way a disagreement runs — `invoiced-short` or `invoiced-over` (#265).
 *
 * Two voices under one key, and never both: they are the clamped halves of one
 * subtraction, so exactly one is positive whenever the totals differ. Returns null on
 * agreement, which is the state that has no sentence.
 */
export const DISAGREEMENT = { invoicedShort: "invoiced-short", invoicedOver: "invoiced-over" };

export function disagreementDirection({ deliveredQty, invoicedQty } = {}) {
    const delivered = deliveredQty || 0;
    const invoiced = invoicedQty || 0;
    if (delivered === invoiced) return null;
    return invoiced < delivered ? DISAGREEMENT.invoicedShort : DISAGREEMENT.invoicedOver;
}

/**
 * One entry per INVOICE rather than per invoice item, with its whole charge on this
 * ordered item (#265).
 *
 * FOLDED BECAUSE THE RULE NOW DEPENDS ON IT. `invoicesByOrderedItem` builds one entry
 * per `Invoice Items` row, which is the right projection of the level and the wrong
 * unit for this question: a candidate has to charge at least the excess, and one
 * invoice carrying two rows against one ordered item would be counted as two
 * candidates each holding part of its own charge. #219 read the same shape and only
 * COUNTED entries, so the miscount could not change a figure; here it decides whether
 * a single quotation covers the excess. `lib/invoiceItemFold.js` folds the items TABLE
 * on `Material` plus unit price for a reader; this folds on the invoice for a rule, so
 * the two are different questions rather than a duplication.
 *
 * The representative row is the first in `invoiceItemRecordId` order, so the entry a
 * caller then writes against is stable; `qty` is the sum and every other field comes
 * off records that all belong to one invoice.
 */
export function foldByInvoice(invoices) {
    const byInvoice = new Map();
    for (const entry of invoices || []) {
        if (!entry?.invoiceRecordId) continue;
        const held = byInvoice.get(entry.invoiceRecordId);
        if (!held) {
            byInvoice.set(entry.invoiceRecordId, { ...entry, qty: entry.qty || 0 });
            continue;
        }
        held.qty += entry.qty || 0;
        // The representative stays the lowest invoice item id, so a re-read in a
        // different order picks the same row to split later.
        if ((entry.invoiceItemRecordId || "") < (held.invoiceItemRecordId || "")) {
            byInvoice.set(entry.invoiceRecordId, {
                ...entry,
                qty: held.qty,
            });
        }
    }
    return [...byInvoice.values()];
}

/**
 * Which invoice supplies the quotation, and what stops one being chosen (#265).
 *
 * `invoices` is one entry per invoice item on the ordered item: `{ invoiceItemRecordId,
 * invoiceRecordId, invoiceId, issueDate, qty, unitPrice, hasFile, deliveryRecordId }`
 * — that last one being #210's pairing, flattened by the credentialed side through
 * `lib/deliveryInvoiceLink.js:linkedDelivery` so the flattening rule keeps one home.
 * `deliveryRecordId` on the argument is the row's OWN delivery.
 *
 * FOUR STEPS, AND #219's TIERS ARE NOT AMONG THEM.
 *
 *   1. Fold to one entry per invoice — see foldByInvoice.
 *   2. Keep the ones charging AT LEAST the excess. A request takes one quotation
 *      (#167), so a candidate has to cover the whole of it on its own. With none,
 *      `spansInvoices` — the refusal #167 wrote, now reached by asking every invoice
 *      rather than only the oldest, which is what made `excessExceedsInvoice`
 *      unreachable and retired it.
 *   3. If they disagree on the unit price, REFUSE. The correction quotes a price, so
 *      the choice would change a figure on the order that goes to the vendor, and
 *      nothing here can say which is right — `severalUnpairedInvoices`'s posture on
 *      the axis where the choice is now observable.
 *   4. Otherwise prefer one the pairing places on THIS delivery, then oldest first.
 *
 * STEP 4 IS WHY THE PAIRING SURVIVES AT ALL, and the case is #219's own: an ordered
 * item filled by two deliveries and invoiced by two invoices, each invoice large enough
 * to cover the excess. The excess belongs to the delivery whose row carries the flag,
 * and `Invoices."Delivery"` is the only thing that says which invoice describes it —
 * so ignoring it would quote the other delivery's document at the right price. It is a
 * PREFERENCE rather than a tier: where nothing is recorded the ordering decides and
 * that is not a refusal, because by step 3 the figures are equal either way.
 *
 * `tieBreak` REPORTS WHAT WAS PASSED OVER, never that a choice was hard. It carries
 * the ids so the sentence can name them, in #231's shape: a qualifier that composes
 * with the answer rather than replacing it.
 */
export function selectOverageInvoice({ invoices, excess, deliveryRecordId } = {}) {
    const folded = foldByInvoice(invoices);
    if (folded.length === 0) {
        return { invoice: null, tieBreak: null, blocked: OVERAGE_BLOCKED.noInvoice };
    }

    const covering = folded.filter((b) => (b.qty || 0) >= (excess || 0));
    if (covering.length === 0) {
        return { invoice: null, tieBreak: null, blocked: OVERAGE_BLOCKED.spansInvoices };
    }

    // A price of null is not a price, and it makes the set differ rather than agree —
    // failing closed, since a quotation taken at an unknown price is the one outcome
    // that must not happen quietly.
    const prices = new Set(covering.map((b) => String(b.unitPrice ?? "")));
    if (prices.size > 1) {
        return { invoice: null, tieBreak: null, blocked: OVERAGE_BLOCKED.severalPricesDiffer };
    }

    const named = deliveryRecordId
        ? covering.filter((b) => b.deliveryRecordId === deliveryRecordId)
        : [];
    const preferred = sortInvoicesOldestFirst(named.length > 0 ? named : covering);
    const invoice = preferred[0];
    const passedOver = covering
        .filter((b) => b.invoiceRecordId !== invoice.invoiceRecordId)
        .map((b) => b.invoiceId)
        .filter(Boolean);

    return {
        invoice,
        // Only where something was actually passed over — one candidate chose nothing.
        tieBreak: passedOver.length > 0 ? { chosen: invoice.invoiceId, passedOver } : null,
        blocked: null,
    };
}

/**
 * The signing chain to copy onto a correction, minus anyone inactive (#217 moved
 * the rule here; #167 wrote it).
 *
 * PURE, AND SHARED BY TWO FETCH SHAPES. The write path reads one request's chain
 * fresh before it creates anything; the read path reads every listed request's
 * chain in one batched query. Those are two projections of one table, the shape
 * lib/airtable/poItems.js already carries three of — but the RULE (drop whoever
 * cannot sign, keep the original order, count what went) is one, and it was
 * implemented inside the credentialed module where no offline check could reach it.
 *
 * IT SORTS, AND THE REASON IS THE BATCHED CALLER. `getSignersByPR` orders by
 * `Sequence Order` itself — a comment here used to say it does not, which was false
 * — but a batched read by record id returns whatever order the ids came in, so the
 * ordering has to be applied by whoever owns the rule. Doing it here means neither
 * caller can forget.
 *
 * A signer with no user link is dropped like an inactive one: the turn would belong
 * to nobody, which is the same dead end.
 */
export function selectCopyableSigners(signerRows, activeUserIds) {
    const active = activeUserIds instanceof Set ? activeUserIds : new Set(activeUserIds || []);
    const ordered = [...(signerRows || [])].sort(
        (a, b) => (a?.sequenceOrder ?? 0) - (b?.sequenceOrder ?? 0)
    );
    const keep = ordered.filter((s) => s?.signer?.[0] && active.has(s.signer[0]));

    return { keep, droppedCount: ordered.length - keep.length, originalCount: ordered.length };
}

/**
 * May this row be corrected, and with what.
 *
 * Order matters. `already-raised` is tested before anything about the invoice,
 * because a row someone is already correcting must not be reported as blocked for
 * a reason the reader would then try to fix — the same reasoning
 * getPOWithdrawEligibility gives for testing status before invoices.
 *
 * #265 PUT THE AGREEMENT NEXT, AHEAD OF EVERYTHING ABOUT THE QUOTATION, on that same
 * rule. Where the two documents do not agree there is no correction to raise at all,
 * so telling a reader that an invoice has no file — or that the excess spans two of
 * them — would send them to fix something that is not what stands in the way.
 *
 * `orderedItem` carries the three totals the agreement is read from:
 * `{ orderedQty, deliveredQty, invoicedQty }`. A caller that omits it FAILS CLOSED —
 * `hasInvoice` comes from the invoice list rather than from the figures, so an absent
 * `orderedItem` reads as 0 delivered against whatever is invoiced and refuses as a
 * disagreement. `offline/overage.mjs` pins the one call site by AST.
 *
 * `excess` is the row's own `Qty` (see the module header) and is NOT the ordered
 * item's total beyond the order. The two differ when two deliveries each exceeded the
 * same ordered item; the correction covers the row in hand, which is the row the
 * button was pressed on.
 */
export function overageEligibility({ row, invoices, overagePR, overagePO, orderedItem } = {}) {
    if (!row?.overDelivered) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.notOverDelivered };
    }
    // A SILENT REFUSAL, AND THE ONLY ONE HERE (#278). Every other clause names a key
    // that `OVERAGE_COPY.preview.blocked` turns into a sentence and
    // `OVERAGE_COPY.strip.reason` into a chip; this one deliberately names none, so
    // the button is absent and nothing on the screen explains it. That is the whole
    // of #278's split applied to one branch: the app still refuses a row whose
    // `PO Item` was emptied by hand, because a correction needs an order to correct,
    // and it stops describing a state whose only possible reader emptied the link
    // themselves. `describeOveragePreview` renders nothing for an unknown key, which
    // is the behavior a missing `blocked` already had.
    if (!attachedPOItemRecordId(row)) {
        return { eligible: false, blocked: null };
    }
    if (overagePRState(overagePR, overagePO) !== "none") {
        return { eligible: false, blocked: OVERAGE_BLOCKED.alreadyRaised };
    }

    const figures = {
        orderedQty: orderedItem?.orderedQty || 0,
        deliveredQty: orderedItem?.deliveredQty || 0,
        invoicedQty: orderedItem?.invoicedQty || 0,
        hasInvoice: (invoices || []).length > 0,
    };
    const agreement = overageAgreement(figures);
    if (agreement === OVERAGE_AGREEMENT.noInvoice) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.noInvoice, figures };
    }
    if (agreement === OVERAGE_AGREEMENT.disagree) {
        return {
            eligible: false,
            blocked: OVERAGE_BLOCKED.documentsDisagree,
            // Which voice the refusal takes, and the figures it names.
            disagreement: disagreementDirection(figures),
            figures,
        };
    }

    // #219 — the row's own delivery is the pairing preference, so nothing here has to
    // be told which delivery it is looking at.
    const picked = selectOverageInvoice({
        invoices,
        excess: row.qty,
        deliveryRecordId: attachedDeliveryRecordId(row),
    });
    if (picked.blocked) {
        return { eligible: false, blocked: picked.blocked, figures };
    }
    if (!picked.invoice.hasFile) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.noInvoiceFile, figures };
    }

    return {
        eligible: true,
        blocked: null,
        invoice: picked.invoice,
        // #265 — a qualifier rather than an inference: something WAS passed over, at
        // the same price, so the figures are settled and only the document differs.
        tieBreak: picked.tieBreak,
        figures,
        excess: row.qty || 0,
    };
}

/**
 * Which banner one over-delivery deserves, from the link and the flag alone.
 *
 *   null          — nothing to say (no live correction).
 *   pending       — a correction is being raised; the excess has not moved.
 *   applied       — settled: the excess is on the overage order and invoiced there.
 *   not-applied   — the overage PO exists and the excess never moved. THE ONE
 *                   FAILURE THIS FEATURE CAN LEAVE, and the only place it shows.
 */
export function overageBannerState({ row, overagePR, overagePO } = {}) {
    const state = overagePRState(overagePR, overagePO);
    if (state === "none") return null;
    if (state === "pending") return "pending";
    return isOverageApplied(row) ? "applied" : "not-applied";
}

// ---------------------------------------------------------------------------
// Copy
//
// ONE OBJECT, THREE GROUPS. The first two split on WHICH DOCUMENT IS BEING READ
// rather than on voice or density; #217's `strip` is the one that splits on
// DENSITY, and it says so where it sits. `preview` addresses the person about to raise the
// correction (second person, future), the way ALLOCATION_COPY.preview does.
// `banner` addresses whoever later opens one of THREE documents that all describe
// the same correction from different sides — the overage PR, the overage PO, and
// the original PO — so what varies is which of them is "this one" and therefore
// what still needs explaining.
//
// The state does NOT multiply that: `pending`, `invoiceCaveat` and `notApplied`
// are shared entries appended to whichever first sentence the site chose, so
// three sites × three states stays 3 + 3 rather than 9.
//
// SAME VOCABULARY AS #166: `delivered`, never `arrived`; `ordered item`, never
// `line`, since a `Line` on this base is a child of a Job. And facts, never
// verdicts — nothing here says the vendor over-billed or shipped wrong.

const qtyUnit = (n, unit) => `${n}${unit ? " " + unit : ""}`;
const itemLabel = (f) => [f.itemName, f.size].filter(Boolean).join(" ");

/**
 * What follows the request's own id in the already-covered refusal, per stage
 * (#217). Each says where the correction has got to and therefore whether there is
 * anything to wait for.
 */
const ALREADY_RAISED_SUFFIX = {
    [OVERAGE_STAGE.draft]:
        " already covers this excess and is still a draft, so nobody has been asked to approve it yet.",
    [OVERAGE_STAGE.inReview]:
        " already covers this excess and is in review, so it is with its signers.",
    [OVERAGE_STAGE.generated]:
        " already covers this excess and its order has been generated.",
    // The sentence #167 wrote, kept for a caller that supplies no stage: naming a
    // stage we were not told would be worse than naming none.
    unknown: " already covers this excess.",
};
// #206's qualifier opens the same way in both voices, so the fact is written
// once and only the available action differs below.
const noLongerOverSentence = (f) =>
    `The ${qtyUnit(f.excess, f.unit)} of ${itemLabel(f)} this covers now fits within ` +
    `what ${f.originalPoId} ordered, so delivery ${f.deliveryId} is no longer ` +
    `over-delivered.`;

export const OVERAGE_COPY = {
    preview: {
        /**
         * What the button is about to do. Names every input it takes from
         * somewhere the reader cannot see on this page — the invoice's unit price
         * and its file — because those are what they would otherwise have to
         * trust blindly.
         */
        summary: (f) => ({
            key: "preview-summary",
            text:
                `This will raise a purchase request for ${qtyUnit(f.excess, f.unit)} of ` +
                `${itemLabel(f)} at ${f.unitPriceLabel} each — the excess delivered beyond ` +
                `what ${f.originalPoId} ordered. ${f.invoiceId} is charging for it already, so ` +
                `its file becomes the quotation and its code the vendor quotation code.`,
        }),
        /**
         * #265 — WHAT WAS COMPARED, AND IT IS ON EVERY VOICE OF THE THREE STATES.
         *
         * A reader is looking at ONE delivery and the judgment is the ORDERED ITEM's:
         * two totals across every delivery and every invoice that touched it. Without
         * this line the figures on the page do not add up to the verdict beside them —
         * a delivery of 13 against an order of 10 sits next to a refusal derived from
         * 19 delivered and 4 invoiced, and nothing on the screen says where 19 came
         * from. So the sentence names the order and both totals, and it is the same
         * sentence in all three states because it is the same comparison.
         *
         * `On this order` RATHER THAN `on this ordered item`, and the choice is the
         * reader's vocabulary against the base's. The figures are one ordered item's,
         * but this box already names the order in its summary and the reader has the
         * packing list rather than the schema — so the shorter phrase points at the
         * same thing without teaching a word to read one line. `ordered item` stays
         * the word everywhere it IS the subject.
         */
        compared: (f) => ({
            key: "preview-compared",
            text:
                `Measured across every delivery and invoice on ${f.originalPoId}: ` +
                `${qtyUnit(f.orderedQty, f.unit)} ordered, ` +
                `${qtyUnit(f.deliveredQty, f.unit)} delivered, ` +
                `${qtyUnit(f.invoicedQty, f.unit)} invoiced.`,
        }),
        /**
         * #265 — SOMETHING WAS PASSED OVER, WHICH IS NOT AN INFERENCE.
         *
         * `OVERAGE_INFERRED` and its two voices stood here and are gone with #219's
         * tiers. They said a GUESS had been made about which document charged the
         * excess; there is no such guess now, because a correction is offered only
         * where the excess is invoiced and a candidate has to cover it on its own. What
         * is left is narrower and true: several invoices could have supplied the
         * quotation, they agree on the price so no figure turns on the choice, and the
         * file and the vendor's own code are what differ. #231 made exactly this call
         * for its own tie-break — said out loud, because the two documents are not the
         * same document.
         *
         * It still renders in the `!` marker's place, so the marker's meaning changed
         * with it: it used to mean `inferred` and now means `one of several`.
         */
        tieBreak: (f) => ({
            key: "preview-tie-break",
            text:
                `${f?.chosen ?? "One invoice"} and ` +
                `${(f?.passedOver || []).join(" and ") || "another invoice"} both charge at ` +
                "least this much of the item at the same price, so which one supplies the " +
                `quotation changes no figure — ${f?.chosen ?? "the first"} is the one quoted.`,
        }),
        /**
         * The chain is copied from the original request, minus anyone who is no
         * longer active — a chain that stops at a departed signer cannot be
         * unstuck from inside the app, so it is better to arrive one signer short
         * and say so.
         */
        signersDropped: (n) => ({
            key: "preview-signers-dropped",
            text:
                `${n} signer${n === 1 ? "" : "s"} on the original request ${n === 1 ? "is" : "are"} ` +
                `no longer active and ${n === 1 ? "was" : "were"} left out. Add who should sign ` +
                `before submitting.`,
        }),
        /** Nothing was copied at all, so the draft has no chain yet. */
        signersEmpty: () => ({
            key: "preview-signers-empty",
            text:
                "None of the original request's signers is still active, so the draft opens " +
                "with no signing chain. Assign one before submitting.",
        }),
        /** The draft is editable, which is the point of stopping there. */
        draft: () => ({
            key: "preview-draft",
            text:
                "It opens as a draft, so quantity, price and signers can all be changed before " +
                "it is submitted.",
        }),
        blocked: {
            [OVERAGE_BLOCKED.notOverDelivered]: () => ({
                key: OVERAGE_BLOCKED.notOverDelivered,
                text: "Nothing on this row was delivered beyond the order.",
            }),
            // A  sentence stood here (#278) —  The refusal survives without it and is silent; see
            // .
            /**
             * ALREADY COVERED — AND BY A REQUEST AT A NAMED STAGE (#217).
             *
             * The sentence used to be "X already covers this excess." and stopped
             * there, which answers the wrong question: a reader who finds an excess
             * already covered is deciding whether to WAIT, and a draft nobody
             * submitted, a request with its signers, and an order already generated
             * are three different answers to that. `overageStageKey` picks the
             * voice; `unknown` keeps the original sentence for a caller that did not
             * supply a stage, because a wrong stage would be worse than no stage.
             *
             * RETURNED IN PARTS SO THE ID CAN BE A LINK. Copy stays a pure module
             * with no JSX in it, and the one place that can render a link — the
             * delivery detail's box — composes `prefix`, a link on `prId`, then
             * `suffix`. `text` is the same sentence flattened, for the Server Action
             * that returns a refusal as a plain string. The offline check asserts the
             * two cannot drift.
             */
            [OVERAGE_BLOCKED.alreadyRaised]: (f) => {
                const prId = f?.overagePrId ?? null;
                const suffix = ALREADY_RAISED_SUFFIX[f?.overageStage] ?? ALREADY_RAISED_SUFFIX.unknown;
                return {
                    key: OVERAGE_BLOCKED.alreadyRaised,
                    // Empty, because the request leads the sentence: the link is then
                    // the first thing read rather than something buried mid-line.
                    prefix: "",
                    prId,
                    suffix,
                    text: `${prId ?? "A request"}${suffix}`,
                };
            },
            /**
             * #265 — THE THIRD STATE, AND IT IS A WAIT RATHER THAN A DEAD END. #231
             * pairs in both directions, but this state does not even need the pairing:
             * `Invoiced Qty` moves the moment an invoice item is created, so the
             * judgment arrives whichever document is entered second and the sentence
             * says so instead of naming an action nobody has to take.
             */
            [OVERAGE_BLOCKED.noInvoice]: () => ({
                key: OVERAGE_BLOCKED.noInvoice,
                text:
                    "No invoice charges this ordered item yet, so there is nothing to compare the " +
                    "delivery against. Whether this earns a correction is answered as soon as " +
                    "the office enters the invoice.",
            }),
            /**
             * #265 — THE SECOND STATE, IN TWO VOICES, and the direction is the whole
             * of what differs. Both say the vendor's own two documents do not meet, so
             * a correction would order material they do not both account for; what
             * changes is which figure is short and therefore what a person asks the
             * vendor.
             *
             * IT NAMES THE FIGURES AND NOT THE VERDICT, which is #166's standing rule
             * on this axis: at any one moment "the vendor under-invoiced" and "a second
             * invoice has not arrived" are the same measurement, so the sentence
             * reports the two totals and leaves the reading to a person.
             *
             * The `unknown` voice is ALREADY_RAISED_SUFFIX's shape: a caller that
             * supplies no direction gets the fact without a claim about which way.
             */
            [OVERAGE_BLOCKED.documentsDisagree]: (f) => {
                const totals =
                    `${qtyUnit(f?.deliveredQty ?? 0, f?.unit)} delivered against ` +
                    `${qtyUnit(f?.invoicedQty ?? 0, f?.unit)} invoiced`;
                const tail =
                    f?.disagreement === DISAGREEMENT.invoicedShort
                        ? "The vendor has not invoiced everything it sent, so a correction would " +
                          "order material nobody charged for. Take the difference up with the " +
                          "vendor, or wait for the invoice that covers it."
                        : f?.disagreement === DISAGREEMENT.invoicedOver
                          ? "More is invoiced than was delivered, which is a discrepancy on the " +
                            "invoice rather than an order to correct. Take it up with the vendor."
                          : "The two do not meet, so there is no agreed excess to correct. Take " +
                            "the difference up with the vendor.";
                return {
                    key: OVERAGE_BLOCKED.documentsDisagree,
                    text: `This order has ${totals}. ${tail}`,
                };
            },
            // Out of scope, and the reason is the quotation rather than the
            // arithmetic: two invoices means two files, and a PR takes one. #265
            // WIDENED WHAT IS ASKED AND MADE THE SENTENCE TRUE OF EVERY CASE IT
            // COVERS: it used to say "larger than the oldest invoice", which asked one
            // document; every invoice is asked now, so reaching this means none of
            // them covers the excess on its own.
            [OVERAGE_BLOCKED.spansInvoices]: () => ({
                key: OVERAGE_BLOCKED.spansInvoices,
                text:
                    "No single invoice charges as much of this item as was delivered beyond the " +
                    "order, so the excess spans more than one. There is no one quotation to " +
                    "attach — raise the correction by hand.",
            }),
            /**
             * #265 — several invoices could supply the quotation and they disagree on
             * the unit price, so the choice would change the figure on the corrective
             * order. `severalUnpairedInvoices`'s posture, on the axis where the choice
             * is now observable: refused rather than taken, because what comes out of
             * it goes to a vendor.
             *
             * THE ACTION IS BY HAND rather than a pairing to attach. Attaching one
             * would decide which price is right, and nothing on this screen knows
             * that — so it says the honest thing and leaves the decision where it
             * belongs.
             */
            [OVERAGE_BLOCKED.severalPricesDiffer]: () => ({
                key: OVERAGE_BLOCKED.severalPricesDiffer,
                text:
                    "More than one invoice could supply the quotation and they charge this item at " +
                    "different prices, so which one is quoted would change what the corrective " +
                    "order asks for. Raise the correction by hand at the right price.",
            }),
            [OVERAGE_BLOCKED.noInvoiceFile]: (f) => ({
                key: OVERAGE_BLOCKED.noInvoiceFile,
                text: `${f?.invoiceId ?? "That invoice"} has no file attached, so there is nothing to quote from.`,
            }),
        },
    },

    /**
     * THE STRIP ABOVE THE REQUEST LIST (#217), and this group's axis is DENSITY,
     * which is the departure the header above names.
     *
     * A STRIP ROW IS ONE LINE AT 832px, so a refusal cannot be its sentence: the
     * shortest of them runs to 130 characters. `reason` is therefore a CHIP — a
     * closed set of values a reader learns once, one per refusal, exactly the
     * argument STATUS_COPY.column makes against putting sentences in a list cell.
     * The sentences still exist and are still the delivery detail's; this is the
     * same fact at the density a row has room for.
     *
     * ONE VOICE, AND THE CONDITION IS NARROWER THAN #216 LEFT IT. That issue's rule
     * was that two voices are needed when the strip carries an action. This strip
     * carries one, and still needs a single voice, because the action is available to
     * EVERYONE WHO CAN SEE A ROW: the rows are gated by `canAccessJobDeliveries` and
     * `createOverageDraftAction` re-authorizes on exactly that rule. #176 needed two
     * because its action was Admin-only. So the real condition is not "is there an
     * action" but "can some readers not take it".
     *
     * `explain` NAMES THE CONTROL, WHICH #216's COPY COULD NOT. There the button was
     * Admin-only and the strip was not, so naming it would have described something
     * half the readers could not see. Here every reader of a row can press its
     * button — when the row has one, which is why the sentence says so rather than
     * promising one per row.
     *
     * NO KEYS FOR `notOverDelivered` OR `alreadyRaised`, deliberately: `awaitsCorrection`
     * excludes both, so a label for either would be copy for a row that cannot appear.
     * The offline check asserts that absence rather than trusting it.
     */
    strip: {
        heading: (n) =>
            n === 1
                ? "1 over-delivery has no correction"
                : `${n} over-deliveries have no correction`,
        // `what has to come first` rather than `what is missing`: #166 bars that word
        // outright so nobody has to adjudicate whether a given use means material
        // gone astray or a record not yet made, and the offline sweep covers this
        // sentence.
        explain:
            "Longest wait first. A row with everything it needs raises the correction here; " +
            "the rest say what has to come first.",
        // #265 — SIX WHERE THERE WERE SEVEN, and the disagreement takes ONE chip for
        // both of its directions. The detail's sentence names which way it runs; a
        // chip cannot, and does not need to, because what a reader does about either
        // is take it up with the vendor. Splitting it would put two values in the
        // closed set for one action, which is the density rule read backwards.
        reason: {
            // A  chip stood here and went with its key (#278).
            [OVERAGE_BLOCKED.noInvoice]: "no invoice yet",
            [OVERAGE_BLOCKED.documentsDisagree]: "invoice and delivery disagree",
            [OVERAGE_BLOCKED.spansInvoices]: "spans two invoices",
            [OVERAGE_BLOCKED.severalPricesDiffer]: "invoices differ on price",
            [OVERAGE_BLOCKED.noInvoiceFile]: "invoice has no file",
        },
    },

    banner: {
        /** Reading the corrective request itself. */
        overagePR: (f) => ({
            key: "banner-overage-pr",
            text:
                `This request covers ${qtyUnit(f.excess, f.unit)} of ${itemLabel(f)} delivered ` +
                `beyond what ${f.originalPoId} ordered, on delivery ${f.deliveryId}.`,
        }),
        /** Reading the corrective order. */
        overagePO: (f) => ({
            key: "banner-overage-po",
            text:
                `This order covers ${qtyUnit(f.excess, f.unit)} of ${itemLabel(f)} delivered ` +
                `beyond what ${f.originalPoId} ordered, on delivery ${f.deliveryId}. ` +
                `${f.overagePrId} is the request behind it.`,
        }),
        /**
         * Reading the order that was over-delivered. NAMES THE DELIVERY RATHER
         * THAN CLAIMING "this order was over-delivered", because one delivery can
         * fill two orders of the same material and the excess attaches to the last
         * one filled — so this banner is reachable from an order that was not
         * itself exceeded. Naming the delivery and the item is true either way.
         */
        originalPO: (f) => ({
            key: "banner-original-po",
            text:
                `Delivery ${f.deliveryId} delivered ${qtyUnit(f.excess, f.unit)} of ` +
                `${itemLabel(f)} beyond what was ordered. ${f.overagePrId} covers the ` +
                `difference${f.overagePoId ? ` (${f.overagePoId})` : ""}.`,
        }),

        /** Appended while the correction is still a request. */
        pending: (f) => ({
            key: "banner-pending",
            text:
                `${f.overagePrId} is still being approved, so the excess is still on ` +
                `${f.originalPoId}'s ordered item.`,
        }),
        /**
         * THE ACCOUNTING CAVEAT, and the reason the banner outlives signature. An
         * overage order read on its own looks like a duplicate with no quotation
         * of its own; worse, the invoice attached to it also charges the original
         * order, so nobody reconciling a payment against that invoice can match it
         * to either order's total alone.
         */
        /**
         * #233 — THE FALLBACK IS NOT DEFENSIVE, IT COVERS A STATE THE APP CREATES.
         * `notApplied` beside this one always had `?? "the invoice"` and this one
         * did not, so wherever the facts reach it without an invoice the sentence
         * opened with the literal `null`. The order's own page is such a caller by
         * design: the invoice a correction spans is invoice-derived, so it is
         * withheld from a viewer who is not the office (see
         * `createOverageDraftAction` for the same narrowing), and the banner itself
         * is delivery-derived and shown to everyone. Not observed — no ordered item
         * on this base carries `Former Delivery Items`, measured 2026-08-14, so the
         * applied banner has never rendered here.
         */
        invoiceCaveat: (f) => ({
            key: "banner-invoice-caveat",
            text:
                `${f.invoiceId ?? "The invoice"} charges both orders, so a payment against it ` +
                `will not match ${f.thisPoId ?? "this order"}'s total on its own.`,
        }),
        /**
         * The asymmetry PO generation can leave behind. Says what did not happen
         * and where the excess still is, because there is no notification and this
         * is the only place it surfaces.
         */
        notApplied: (f) => ({
            key: "banner-not-applied",
            text:
                `The excess has not moved yet: ${f.overagePoId ?? "the overage order"} exists, but ` +
                `delivery ${f.deliveryId}'s extra ${qtyUnit(f.excess, f.unit)} is still on ` +
                `${f.originalPoId}'s ordered item and ${f.invoiceId ?? "the invoice"} still charges ` +
                `that order for it.`,
        }),

        /**
         * #206's qualifier: the excess this correction covers is no longer there.
         *
         * TWO VOICES, AND THE DIFFERENCE IS WHETHER THE ACTION IS AVAILABLE. A
         * pending request has been approved by nobody and an unapplied overage
         * order carries no invoice — `linkInvoiceToPO` runs only in the apply
         * step — so #138 admits both. Naming an action the reader cannot take
         * would be worse than saying nothing, which is why there is no `applied`
         * voice: see isNoLongerOverDelivered for why that state cannot arise, and
         * why an unreachable third message is removed rather than written.
         */
        noLongerOverDelivered: {
            pending: (f) => ({
                key: "no-longer-over-delivered",
                text:
                    `${noLongerOverSentence(f)} ${f.overagePrId} has not been approved, so it ` +
                    `can still be withdrawn or deleted.`,
            }),
            "not-applied": (f) => ({
                key: "no-longer-over-delivered",
                text:
                    `${noLongerOverSentence(f)} ${f.overagePoId ?? "The overage order"} carries ` +
                    `no invoice, so it can be withdrawn.`,
            }),
        },
    },
};

/**
 * The marker's sentence for one eligibility, or null when nothing was passed over.
 *
 * ONE PLACE SINCE #217, because there are two screens: the delivery detail and the
 * strip above `/prs` both put the same `!` beside the same button, and each was
 * looking the key up itself — two call sites deciding which sentence a shared marker
 * carries is exactly how the two markers #166 built came to need an assertion that
 * they agreed.
 *
 * #265 CHANGED WHAT IT IS ABOUT AND KEPT ITS ONE HOME. `inferredLabel` read
 * `OVERAGE_INFERRED`, which is gone with #219's tiers; the marker now carries the
 * tie-break, so the function is named for the condition rather than for the retired
 * one. Null on every eligibility with nothing passed over, which is the ordinary case
 * and the state that has no sentence.
 */
export function tieBreakLabel(eligibility) {
    return eligibility?.tieBreak
        ? OVERAGE_COPY.preview.tieBreak(eligibility.tieBreak).text
        : null;
}

/**
 * Every message the preview should show, in order. All the branching lives here so
 * neither the modal nor the Server Action decides which case it is looking at.
 *
 * A blocked row gets TWO messages SINCE #265 — the reason, and what was compared to
 * reach it. That is a departure from describePlan's one-message shape and the reason
 * is the scope: the verdict comes from the ordered item's totals while the reader is
 * looking at one delivery, so the refusal alone would sit beside figures that do not
 * add up to it. The comparison line is second because it is evidence for the sentence
 * above rather than a fact of its own.
 *
 * `notOverDelivered` GETS NO COMPARISON LINE, being the one refusal that would make
 * it false: it does not reach the totals at all, so naming figures would claim a
 * measurement that was never taken. `noOrderedItem` was the second and #278 removed
 * it — a silent refusal renders no line of any kind, so it needs no entry here.
 */
const NO_COMPARISON = [OVERAGE_BLOCKED.notOverDelivered];

export function describeOveragePreview(eligibility, facts = {}) {
    const compared = () =>
        OVERAGE_COPY.preview.compared({ ...facts, ...(eligibility?.figures ?? {}) });

    if (!eligibility?.eligible) {
        const builder = OVERAGE_COPY.preview.blocked[eligibility?.blocked];
        if (!builder) return [];
        const messages = [builder({ ...facts, ...(eligibility?.figures ?? {}), disagreement: eligibility?.disagreement })];
        // `alreadyRaised` keeps its one message too: the excess is somebody's already,
        // so what was compared is not the question a reader has.
        if (
            eligibility?.figures &&
            !NO_COMPARISON.includes(eligibility.blocked) &&
            eligibility.blocked !== OVERAGE_BLOCKED.alreadyRaised
        ) {
            messages.push(compared());
        }
        return messages;
    }

    const messages = [OVERAGE_COPY.preview.summary({ ...facts, excess: eligibility.excess })];
    messages.push(compared());
    // #265 — a qualifier rather than a key lookup: `tieBreak` is either present with
    // the ids its sentence names or absent, so there is no unrecognized value to guard.
    if (eligibility.tieBreak) messages.push(OVERAGE_COPY.preview.tieBreak(eligibility.tieBreak));
    if (facts.signersEmpty) messages.push(OVERAGE_COPY.preview.signersEmpty());
    else if (facts.signersDropped > 0) {
        messages.push(OVERAGE_COPY.preview.signersDropped(facts.signersDropped));
    }
    messages.push(OVERAGE_COPY.preview.draft());
    return messages;
}

/**
 * Every message one banner should show, in order, for one site.
 *
 * `site` is `overagePR` / `overagePO` / `originalPO`. Returns [] when there is
 * nothing to say, so a page renders no empty box.
 */
export function describeOverageBanner({
    site,
    state,
    facts = {},
    noLongerOverDelivered = false,
} = {}) {
    const first = OVERAGE_COPY.banner[site];
    if (!first || !state) return [];

    const messages = [first(facts)];
    if (state === "pending") {
        messages.push(OVERAGE_COPY.banner.pending(facts));
        // No caveat: until the split happens the invoice charges one order only, so
        // saying it spans two would be false.
    } else if (state === "not-applied") {
        messages.push(OVERAGE_COPY.banner.notApplied(facts));
    } else {
        messages.push(OVERAGE_COPY.banner.invoiceCaveat(facts));
    }

    // #206'S QUALIFIER, APPENDED RATHER THAN SUBSTITUTED, so three states plus a
    // qualifier stays 3 + 1 instead of becoming six banners. It comes last
    // because it is the only line that names an action, and an action belongs
    // after the facts it follows from. `applied` has no voice — see
    // isNoLongerOverDelivered for why that combination cannot arise.
    const qualifier = OVERAGE_COPY.banner.noLongerOverDelivered[state];
    if (noLongerOverDelivered && qualifier) messages.push(qualifier(facts));

    return messages;
}

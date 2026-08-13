// Raising an overage PR from an over-delivery (#167) — the judgment and its copy.
//
// #162 records a delivery, #165 attaches the excess to an ordered item anyway, #166
// shows it. This is the step that squares the RECORD with it: a corrective PR for
// the difference, and once its PO exists the excess moves onto that PO's own
// ordered item — the delivery row is re-attached and its flag clears, and the
// invoice item splits so the overage order is billed rather than reading as never
// invoiced.
//
// THE EXCESS NEEDS NO ARITHMETIC, and that is #162's decision paying off: an
// over-delivery is its OWN Delivery Items row whose `Qty` IS the excess ("the
// flagged quantity IS the excess with no arithmetic"). So nothing here subtracts
// ordered from delivered.
//
// WHICH BILL CARRIES THE EXCESS IS READ FROM THE PAIRING FIRST (#219). #210 stored
// `Invoices."Delivery"`, so the candidates are the bills naming the shipment the
// excess actually arrived on rather than every bill on the ordered item — which is
// how a correction could quote a document describing a different arrival, and since
// the quotation, its code and its unit price all come off that bill, the document
// that went out would be wrong rather than merely uncertain.
//
// THE NARROWING IS TIERED RATHER THAN ABSOLUTE, and the reason is that an empty
// pairing is the absence of evidence and not evidence of absence. The vendor emails
// the bill at shipment, so an invoice naming no delivery is #210's ORDINARY state,
// and excluding those would make the correction wait on a field this app leaves
// optional. So: a bill naming ANOTHER shipment is never a candidate, a bill naming
// THIS one always is, and bills naming none are the fallback used only when nothing
// names this one. TIERS ARE NEVER MIXED — a recorded pairing must not lose to an
// unrecorded one under an ordering.
//
// SO TWO THINGS CAN STILL BE INFERRED and they are different facts, which is why
// `OVERAGE_INFERRED` is two keys and not a boolean: this shipment carries more than
// one bill for the ordered item, or nothing names this shipment at all. What is NOT
// reused is `allocateLineToInvoices`'s `determinate` flag, and the reason is that it
// answered a different question: there, determinacy meant the outcome does not
// depend on the order the bills are taken in, so a delivery covering EVERY bill was
// determinate. Here the question is which bill's invoice item the excess quantity
// sits in, and full coverage leaves that wide open.
//
// THE ORDERING LIVES HERE NOW, AND IS PRIVATE (#219). It was #166's, imported from
// lib/deliveryStatus.js back when that module's own inference used it too; #210
// deleted that reader and left the export standing for this module alone, which is
// exactly the shape #182 exists to stop. Moving it here and NOT exporting it retires
// that exception rather than relocating it — nothing outside this file has ever
// needed to order bills.
//
// Pure and dependency-free, so scripts/tests/offline/overage.mjs can pin every
// clause.

/** Why a row cannot be corrected. Keys, so a reworded message fails nothing. */
export const OVERAGE_BLOCKED = {
    notOverDelivered: "not-over-delivered",
    noOrderedItem: "no-ordered-item",
    alreadyRaised: "already-raised",
    noInvoice: "no-invoice",
    // #219 — bills exist on the ordered item and every one of them names a
    // different shipment. Kept apart from `noInvoice` because merging them would
    // make one of the two messages false: something IS billing this ordered item.
    otherDeliveryOnly: "other-delivery-only",
    spansInvoices: "spans-invoices",
    // #219 — one candidate, and it bills less of the item than the excess. Under
    // one shared reason this said "so it spans more than one invoice", which is
    // false whenever there is only one bill to span.
    excessExceedsBill: "excess-exceeds-bill",
    noInvoiceFile: "no-invoice-file",
};

/**
 * Why the chosen bill is an inference (#219). Keys, so a reworded message fails
 * nothing — the same arrangement as OVERAGE_BLOCKED above, and the reason there are
 * two rather than one flag is that the reader acts on them differently: a second
 * bill on this shipment is a coin flip between two documents that both describe this
 * arrival, while no pairing at all means nothing recorded says which arrival the
 * document describes.
 */
export const OVERAGE_INFERRED = {
    severalBills: "several-bills",
    noPairing: "no-pairing",
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
 * The shipment this row belongs to (#219).
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
 * Oldest bill first: `Issue Date` ascending, tie-broken by `Invoice ID`.
 *
 * #166'S ORDERING, MOVED HERE BY #219 AND NO LONGER EXPORTED. It was written for a
 * question that no longer exists — filling an ordered item's bills oldest-first with
 * whatever had arrived — and #210 deleted that reader while leaving the export
 * standing for this module alone. `selectOverageBill` is the only thing that has ever
 * needed to order bills, so it lives beside it and out of reach.
 *
 * `Issue Date` is the vendor's own date on their document, so it is the order the
 * bills were raised in. It is HUMAN-ENTERED AND BACKDATABLE — the property #164
 * learned the hard way when an ID counter read such a field — so a mistyped date
 * changes which bill an inference favors. That is tolerable in a way it was not
 * there: the consequence is a coin-flip landing the other way on an answer already
 * marked as inferred, not a corrupted record. `Invoice ID` breaks ties and is
 * monotonic within a day by construction (#164).
 *
 * An undated invoice sorts LAST rather than first: it cannot claim to be the oldest,
 * and a data gap must not take priority in an ordering whose whole point is age — the
 * same call sortCandidates and sortLongestWaitingFirst both make.
 *
 * Does not mutate its input.
 */
function sortInvoicesOldestFirst(bills) {
    return [...(bills || [])].sort((a, b) => {
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
 * The bills that may carry THIS shipment's excess, oldest first, and why the answer
 * is an inference when it is (#219).
 *
 * THREE TIERS, TAKEN IN ORDER, NEVER MIXED — see the module header for why an empty
 * pairing is not evidence of a wrong shipment. The truthiness guard on
 * `deliveryRecordId` is load-bearing rather than defensive: without it a missing
 * delivery id would compare equal to an unpaired bill's missing one, and the fallback
 * tier would be reported as the pairing tier — an inference announcing itself as a
 * lookup, which is the one direction that must not happen.
 */
function candidateBills(bills, deliveryRecordId) {
    const all = bills || [];

    const namesThisDelivery = deliveryRecordId
        ? all.filter((b) => b.deliveryRecordId === deliveryRecordId)
        : [];
    if (namesThisDelivery.length > 0) {
        return {
            candidates: sortInvoicesOldestFirst(namesThisDelivery),
            // ONE BILL FROM THE PAIRING IS NOT AN INFERENCE, which is the question
            // #219 settles: the stored link says which arrival this document
            // describes, and there is one such document on this ordered item, so
            // nothing is being guessed and the marker comes off.
            inferred:
                namesThisDelivery.length > 1 ? OVERAGE_INFERRED.severalBills : null,
        };
    }

    const namesNoDelivery = all.filter((b) => !b.deliveryRecordId);
    if (namesNoDelivery.length > 0) {
        // INFERRED WHATEVER THE COUNT, unlike the tier above: with nothing named,
        // one bill is still only the bill that HAPPENS to be the one nobody paired.
        return {
            candidates: sortInvoicesOldestFirst(namesNoDelivery),
            inferred: OVERAGE_INFERRED.noPairing,
        };
    }

    return { candidates: [], inferred: null };
}

/**
 * Which bill's invoice item the excess sits in, and whether that had to be inferred.
 *
 * `bills` is one entry per invoice item on the ordered item: `{ invoiceItemRecordId,
 * invoiceRecordId, invoiceId, issueDate, qty, unitPrice, hasFile, deliveryRecordId }`
 * — that last one being #210's pairing, flattened by the credentialed side through
 * `lib/deliveryInvoiceLink.js:linkedDelivery` so the flattening rule keeps one home.
 * `deliveryRecordId` on the argument is the row's OWN shipment.
 *
 * THE EXCESS MUST FIT INSIDE THE CHOSEN BILL'S INVOICE ITEM, and when it does not
 * there are two different reasons, which #219 split because one message covering both
 * was false for half of them. With more than one candidate the excess genuinely spans
 * two of this shipment's bills, and that is out of scope for the QUOTATION rather than
 * the arithmetic: two invoices means two files and a PR takes one. With a single
 * candidate nothing is spanned — the one bill for this arrival simply does not bill
 * all of the excess. Both refuse; only the second used to lie about why.
 */
export function selectOverageBill({ bills, excess, deliveryRecordId } = {}) {
    const all = bills || [];
    const { candidates, inferred } = candidateBills(all, deliveryRecordId);

    if (candidates.length === 0) {
        return {
            bill: null,
            inferred: null,
            blocked:
                all.length === 0
                    ? OVERAGE_BLOCKED.noInvoice
                    : OVERAGE_BLOCKED.otherDeliveryOnly,
        };
    }

    const bill = candidates[0];
    if ((bill.qty || 0) < (excess || 0)) {
        return {
            bill: null,
            inferred,
            blocked:
                candidates.length > 1
                    ? OVERAGE_BLOCKED.spansInvoices
                    : OVERAGE_BLOCKED.excessExceedsBill,
        };
    }
    return { bill, inferred, blocked: null };
}

/**
 * May this row be corrected, and with what.
 *
 * Order matters. `already-raised` is tested before anything about the invoice,
 * because a row someone is already correcting must not be reported as blocked for
 * a reason the reader would then try to fix — the same reasoning
 * getPOWithdrawEligibility gives for testing status before invoices.
 *
 * `excess` is the row's own `Qty` (see the module header).
 */
export function overageEligibility({ row, bills, overagePR, overagePO } = {}) {
    if (!row?.overDelivered) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.notOverDelivered, inferred: null };
    }
    if (!attachedPOItemRecordId(row)) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.noOrderedItem, inferred: null };
    }
    if (overagePRState(overagePR, overagePO) !== "none") {
        return { eligible: false, blocked: OVERAGE_BLOCKED.alreadyRaised, inferred: null };
    }

    // #219 — the candidates come from the row's own shipment, so nothing here has to
    // be told which delivery it is looking at.
    const picked = selectOverageBill({
        bills,
        excess: row.qty,
        deliveryRecordId: attachedDeliveryRecordId(row),
    });
    if (picked.blocked) {
        return { eligible: false, blocked: picked.blocked, inferred: picked.inferred };
    }
    if (!picked.bill.hasFile) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.noInvoiceFile, inferred: picked.inferred };
    }

    return {
        eligible: true,
        blocked: null,
        bill: picked.bill,
        inferred: picked.inferred,
        excess: row.qty || 0,
    };
}

/**
 * Which banner one over-delivery deserves, from the link and the flag alone.
 *
 *   null          — nothing to say (no live correction).
 *   pending       — a correction is being raised; the excess has not moved.
 *   applied       — settled: the excess is on the overage order and billed there.
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
// ONE OBJECT, TWO GROUPS, and the axis is WHICH DOCUMENT IS BEING READ rather
// than voice or density. `preview` addresses the person about to raise the
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
                `what ${f.originalPoId} ordered. ${f.invoiceId} is billing for it already, so ` +
                `its file becomes the quotation and its code the vendor quotation code.`,
        }),
        /**
         * Why the answer above rests on something nothing records — TWO VOICES
         * SINCE #219, one per tier of `candidateBills`, sharing one message key
         * because they are two readings of one qualifier rather than two
         * qualifiers (the arrangement `noLongerOverDelivered` already uses).
         *
         * There is no third voice for the tier that needs none: a single bill
         * naming this shipment is a lookup, and the marker comes off.
         */
        inferred: {
            [OVERAGE_INFERRED.severalBills]: () => ({
                key: "preview-inferred",
                text:
                    "Inferred: this delivery carries more than one bill for this ordered item, " +
                    "so the oldest is treated as carrying the excess.",
            }),
            [OVERAGE_INFERRED.noPairing]: () => ({
                key: "preview-inferred",
                text:
                    "Inferred: no invoice names this delivery, so a bill that names no delivery " +
                    "at all is treated as carrying the excess.",
            }),
        },
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
            [OVERAGE_BLOCKED.noOrderedItem]: () => ({
                key: OVERAGE_BLOCKED.noOrderedItem,
                text:
                    "This row names no ordered item, so there is no order for a correction to " +
                    "be a correction of.",
            }),
            [OVERAGE_BLOCKED.alreadyRaised]: (f) => ({
                key: OVERAGE_BLOCKED.alreadyRaised,
                text: `${f?.overagePrId ?? "A request"} already covers this excess.`,
            }),
            [OVERAGE_BLOCKED.noInvoice]: () => ({
                key: OVERAGE_BLOCKED.noInvoice,
                text:
                    "No invoice bills this ordered item yet. The vendor's invoice is what the " +
                    "correction quotes from, so there is nothing to attach until one is entered.",
            }),
            // #219 — bills exist and every one of them describes another arrival.
            // The available action is the pairing, which this delivery's own Edit
            // page owns and this reader can reach; nothing is promised about an
            // invoice the office has not entered yet.
            [OVERAGE_BLOCKED.otherDeliveryOnly]: () => ({
                key: OVERAGE_BLOCKED.otherDeliveryOnly,
                text:
                    "Every invoice billing this ordered item names a different delivery, so none " +
                    "of them bills what was delivered here. Attach this delivery's own invoice " +
                    "from Edit once the office has entered it.",
            }),
            // Out of scope, and the reason is the quotation rather than the
            // arithmetic: two invoices means two files, and a PR takes one. NARROWED
            // BY #219 to the bills of this delivery, which is also what makes the
            // sentence true — it used to be shown for a single bill, where nothing
            // spans anything.
            [OVERAGE_BLOCKED.spansInvoices]: () => ({
                key: OVERAGE_BLOCKED.spansInvoices,
                text:
                    "The excess is larger than the oldest bill for this delivery, so it spans " +
                    "more than one invoice. There is no single quotation to attach — raise the " +
                    "correction by hand.",
            }),
            // #219 — one bill for this delivery and it does not bill all of the
            // excess. A fact about the quantity, not about spanning: there is
            // nothing to span.
            [OVERAGE_BLOCKED.excessExceedsBill]: () => ({
                key: OVERAGE_BLOCKED.excessExceedsBill,
                text:
                    "The excess is larger than what this delivery's invoice bills for the item, " +
                    "so no single invoice bills all of it — raise the correction by hand.",
            }),
            [OVERAGE_BLOCKED.noInvoiceFile]: (f) => ({
                key: OVERAGE_BLOCKED.noInvoiceFile,
                text: `${f?.invoiceId ?? "That invoice"} has no file attached, so there is nothing to quote from.`,
            }),
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
         * of its own; worse, the invoice attached to it also bills the original
         * order, so nobody reconciling a payment against that invoice can match it
         * to either order's total alone.
         */
        invoiceCaveat: (f) => ({
            key: "banner-invoice-caveat",
            text:
                `${f.invoiceId} bills both orders, so a payment against it will not match ` +
                `${f.thisPoId ?? "this order"}'s total on its own.`,
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
                `${f.originalPoId}'s ordered item and ${f.invoiceId ?? "the invoice"} still bills ` +
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
 * Every message the preview should show, in order. All the branching lives here so
 * neither the modal nor the Server Action decides which case it is looking at.
 *
 * A blocked row gets ONE message — the reason — because nothing else it might say
 * is true, the same shape describePlan uses for a blocked delivery plan.
 */
export function describeOveragePreview(eligibility, facts = {}) {
    if (!eligibility?.eligible) {
        const builder = OVERAGE_COPY.preview.blocked[eligibility?.blocked];
        return builder ? [builder(facts)] : [];
    }

    const messages = [OVERAGE_COPY.preview.summary({ ...facts, excess: eligibility.excess })];
    // #219 — a key rather than a flag, so the same guarded lookup the blocked branch
    // above uses: an unrecognized one renders nothing instead of crashing a screen.
    const inferred = OVERAGE_COPY.preview.inferred[eligibility.inferred];
    if (inferred) messages.push(inferred());
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
        // No caveat: until the split happens the invoice bills one order only, so
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

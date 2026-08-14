// The COMPUTED pairing (#231) — which shipment a bill's ordered items place it on,
// read off what both documents already say instead of off somebody's comparison.
//
// #210 stored the pairing and left it to be filled by hand, from a dropdown when a
// delivery is recorded or from the delivery's edit page afterwards. This module is
// what fills it: an invoice's `Invoice Items` name ordered items and so do a
// delivery's `Delivery Items`, and one invoice sits inside one delivery, so a bill
// whose ordered items all fall inside a shipment's is a candidate for it.
//
// ONE PREDICATE, TWO DIRECTIONS, AND THE PREDICATE IS THE POINT. Either document can
// arrive first, so both entry points look — recording a delivery scans the bills,
// recording an invoice scans the arrivals — and if the two directions could reach
// different answers, whether a pairing got made would depend on which document
// somebody typed in first. So `pairingRefusal` below decides ONE (bill, arrival)
// pair and both directions call it; `planPairings` and `matchArrivalToBill` only
// differ in which side they iterate.
//
// TWO BILLS NOTHING TELLS APART ARE NOT AN AMBIGUITY, AND THAT IS THE THIRD TIME
// ONE CLAUSE HAS SPLIT. `shared-order` began as "another bill charges this ordered
// item"; the bills already ON the shipment left it for capacity; what leaves it now
// is the pair that charges the SAME ordered items in the SAME quantities at the
// SAME prices. Attaching either one leaves the arrival with the same room and gives
// either bill the same #210 mismatch marker, so no figure this app computes comes
// out differently for the two choices. A refusal has to hand a reader something to
// resolve, and there is nothing here to resolve — so one is attached.
//
// WHICH ONE IS ARBITRARY ON PURPOSE, AND THE ORDER CARRIES NO CLAIM. Any total
// order would do; this takes `Invoice ID` because it is already on the option and
// is stable. Deliberately NOT #166's oldest-bill-first, which asserts that the
// earlier bill has the better title to the shipment — the assertion this case
// exists to say cannot be made.
//
// A DIFFERENT QUANTITY IS OBSERVED, SO IT STILL REFUSES. Bills of 10 and 5 against
// an arrival of 15 leave 5 or 10 of room depending on which is attached, and #210's
// marker moves with them, so the pick would be a guess with consequences — which is
// what `shared-order` is for. #219 is not a precedent for widening past that: its
// tie-break sits in the tier where both candidates ALREADY name this delivery, so
// the pairing records what it is choosing between, and in its fallback tier — where
// neither is recorded, which is this case — #219 refuses too.
//
// AND IT IS SAID OUT LOUD, BECAUSE THE TWO DOCUMENTS ARE NOT THE SAME DOCUMENT. The
// rows match; the file and the vendor's own invoice code do not, and those are what
// a person reconciles against. So a tie-broken attachment carries a sentence naming
// what it was chosen over — `PAIRING_COPY.tieBreak`, a QUALIFIER rather than an
// outcome, in the shape #166 gave its own marker: it composes with `matched` and
// `several-attached` instead of doubling them.
//
// WHERE IT IS NOT SAID, RECORDED SO THE SILENCE IS NOT READ AS AN OVERSIGHT. Only
// the moment of telling has it — the delivery form's preview, and the invoice's
// banner on the way in from creation. `/invoices` and the invoice detail do not,
// because whether a pairing was tie-broken is not stored: answering it on a later
// render means reading the vendor's other bills and their `Invoice Items` on screens
// #210 got down to 3 operations. Same shape, and the same answer, as the refusals
// those screens also do not speak.
//
// FOLDING CAME BACK WITH IT, WHICH IS THE COST. Two tied bills are not disjoint, so
// a decision has to count against the room before the next bill is judged, or an
// arrival of 15 would take both bills of 15. `planPairings` folds each attachment
// into the pool as attached to this arrival again. The simplification made when the
// entry form's invoice control went is undone, and the disjointness assertion left
// behind then is exactly what would have caught its absence.
//
// QUANTITY IS NOT PART OF THE TEST, and leaving it out is the whole reason the
// invoice axis still works. A vendor billing 13 and shipping 10 is exactly the
// discrepancy #210's mismatch marker exists to show, and matching on quantity would
// drop such a bill out of consideration so that no marker ever appeared — the
// feature would hide the case it was built to surface. Measured on this base:
// `HYE-INV-260804-07` bills 13 against a shipment of 10 and still pairs.
//
// UNIT PRICE IS PART OF IT, because it is agreed on the order. A bill departing
// from the agreed price is an error to raise with the vendor rather than a bill to
// attach, so it is not a candidate — and it is not ANNOUNCED here, because
// `Invoice Items.Variance Flag` and the `⚠ Variance` badge already say it on the
// invoice's own page, set by the same `checkUnitPriceVariance` this imports. A
// second signal would be one fact rendered twice, which is what took the
// `beyond order` tag off `/invoices` in #166.
//
// THE RULE NEVER JUDGES A PAIRING THAT ALREADY EXISTS. A bill naming a shipment is
// not a candidate — the single side is taken — and where a hand-made pairing
// departs from what this would compute, nothing here says so. Two reasons. #210's
// thesis is that the pairing is a fact somebody knows and the app was guessing at,
// so a marker reading "the app would have said otherwise" inverts that
// relationship. And the disagreement is already on screen: the one such pairing on
// this base (`HYE-INV-260804-03` on `HYE-DL-260804-05`, 7 of `166-DEMO Tee` billed
// against 0 delivered) carries #210's mismatch marker, which fires on the same
// fact that keeps this rule from computing it — a bill charging for material the
// shipment did not bring.
//
// WHAT A FAILURE LEAVES, ON EACH SIDE, because the two writes sit in different
// places and only one of them can lose anything.
//
//   Delivery side — the computed answer is a PRESELECTION on the #210 dropdown,
//   so it is submitted with the form and written by `createDeliveryAction` inside
//   that action's own rollback, exactly where a hand-picked one was written
//   before. A failure there destroys the arrival with it and the recorder retries;
//   nothing partial survives, and this issue changed none of it.
//
//   Invoice side — the write sits OUTSIDE `createInvoiceHandler`'s rollback, in a
//   best-effort block of its own. Three failure points and all three leave the
//   same state: the read throws, the match throws, or `setInvoiceDelivery` throws
//   — the invoice stands, complete and correct, naming no shipment. That is this
//   feature's ordinary state rather than a damaged one: #216's strip above
//   /invoices lists the arrival, the invoice reads `Awaiting delivery`, and the
//   pairing can still be made by hand from the delivery's own Edit page. Nothing
//   half-written is reachable, because the link is one field written in one call
//   and `pairing` keeps its `none` on any throw, so the page reports nothing
//   rather than a match that was not made. What is deliberately NOT done is
//   rolling the invoice back: it is the office's record of a bill that exists, and
//   a derived answer must not undo it — `lib/materialsCache.js`'s posture and
//   #167's about not undoing the approval that produced it.
//
// A RIVAL BILL IS ALWAYS VISIBLE TO WHOEVER IS ASKING, so this needs no unscoped
// read and no second voice for a record outside scope. The derivation, because it
// is load-bearing: a rival shares an ordered item with a candidate, a candidate's
// ordered items all lie inside the arrival, an arrival sits on one Job, and
// `canViewPR` clause 4 admits anyone assigned to that Job — via
// lib/invoiceVisibility.js, which is the walk `getInvoiceLinkCandidates` already
// runs. The PR cannot be a Draft either (clause 1, which would exclude everyone but
// its requester), because ordered items exist only after PO generation. So the
// scoped candidate list IS the rival pool, and a refusal may name what it blocks on.
//
// Pure and dependency-free apart from lib/variance.js, because the entry form
// imports it: an import is an execution, so a module reaching lib/airtable/ crashes
// the browser bundle. BOTH credentialed halves are lib/deliveryInvoiceCandidates.js
// — #210's module already owns the gated read and the guarded write for this
// pairing, and the arrivals a bill may name is the same rule read from the other
// end, so putting it in a near-homonym module of its own would be two homes for one
// rule and a name nobody could tell apart at a glance.

// The `.js` is required, not stylistic: the offline tier runs this module under
// plain `node`, which will not resolve an extension-less relative specifier — the
// same reason lib/deliveryAllocation.js and lib/deliveryStatus.js spell theirs out.
import { checkUnitPriceVariance } from "./variance.js";

/**
 * Why a bill cannot be computed onto an arrival. Keys, so a reworded message fails
 * nothing — the posture LINK_REFUSED and OVERAGE_BLOCKED already take.
 *
 * Only `sharedOrder` is ever spoken. The other six are the ordinary shape of a
 * bill that simply is not this shipment's, and saying so for every invoice on the
 * vendor would bury the one answer that matters. `noRoom` belongs with them rather
 * than with the spoken one deliberately: it is arithmetic with a definite answer,
 * so there is nothing for a reader to resolve.
 */
export const PAIRING_REFUSED = {
    /** No `PO Item` on any of its rows — nothing to place it by. */
    noOrderedItem: "no-ordered-item",
    /** It bills an ordered item this arrival did not bring. */
    notContained: "not-contained",
    /** Some shipment already holds it. The single side is taken. */
    alreadyPaired: "already-paired",
    /** A billed unit price was compared with the order's and is not it. */
    priceDeparts: "price-departs",
    /**
     * A price this rule could not compare at all — the order's is missing from the
     * map a caller passed, or the bill's own row carries none.
     *
     * SPLIT FROM `price-departs` BECAUSE THAT NAME WAS FALSE FOR IT, and the two
     * are different kinds of fact: a departure is a state of the DATA, worth
     * raising with the vendor, while an unanswerable price is a state of the CALL
     * — a caller handing over an incomplete map is a defect in this repo, not
     * something a vendor did. Both fail closed and neither is spoken, so nothing
     * on a screen moves; what moves is that the sentence naming a departure will
     * still be true when there is somewhere to say it.
     *
     * UNREACHABLE ON THIS BASE, AND THE KEY IS NOT EVIDENCE THAT IT IS NOT. Both
     * callers build the map from the very ordered items they then test against —
     * the delivery form and action from this job's ordered items, which is where
     * the arrival's rows come from, and the invoice action from a read of exactly
     * the ordered items the bill charges — and containment is decided before a
     * price is consulted, so an ordered item reaching this clause is always in the
     * map. `PO Items."Unit Price"` is a frozen snapshot and is never blank.
     */
    priceUnknown: "price-unknown",
    /**
     * Bills already on this arrival have claimed everything it brought of an
     * ordered item this one charges. Not an ambiguity — there is no space.
     */
    noRoom: "no-room",
    /** Another bill nobody has placed charges an ordered item this one charges. */
    sharedOrder: "shared-order",
};

/**
 * The outcome keys. `several` and `severalAttached` are opposite answers and belong
 * to opposite directions: an invoice contained in two shipments cannot be placed
 * (`several`, invoice side), while an arrival carrying two bills for different
 * ordered items places both (`severalAttached`, delivery side). One key for the two
 * would have to mean "nothing happened" on one screen and "two things did" on the
 * other.
 */
export const PAIRING = {
    matched: "matched",
    severalAttached: "several-attached",
    several: "several",
    sharedOrder: PAIRING_REFUSED.sharedOrder,
    none: "none",
};

/**
 * The tie-break's key, deliberately NOT a member of `PAIRING`. It is never an
 * outcome — it composes with one — so listing it there would hand `describePairing`
 * a key it must never be given, and would make "the outcome keys" a set with a
 * member that is not one. Screens read it the way they read an outcome's key, to
 * decide how a box is colored.
 */
export const TIE_BREAK = "tie-break";

/**
 * A #210 dropdown option, read as a bill.
 *
 * THE ONE SEAM BETWEEN TWO VOCABULARIES, and it exists so there is no second. The
 * option `getInvoiceLinkCandidates` returns is shaped for the picker and calls the
 * shipment holding a bill `linkedDeliveryRecordId`; this module calls it
 * `pairedDeliveryRecordId`, because its rival clause is about pairing rather than
 * about what a control may offer. Carrying both names on the option would repeat
 * one fact, and teaching a pure rule the picker's field names would tie it to one
 * of its two callers. Both directions build their bills through here, which is also
 * what makes "the same pool in both directions" a property of the code rather than
 * of two call sites agreeing.
 */
export function billFromInvoiceOption(option) {
    return {
        invoiceRecordId: option?.invoiceRecordId ?? null,
        invoiceId: option?.invoiceId ?? null,
        orderedItems: option?.orderedItems || [],
        pairedDeliveryRecordId: option?.linkedDeliveryRecordId ?? null,
    };
}

/** The ordered items a bill charges against, deduplicated. Never `Item Name` text. */
export function orderedItemsBilled(bill) {
    return [...new Set((bill?.orderedItems || []).map((o) => o.poItemRecordId).filter(Boolean))];
}

/** The ordered items an arrival brought, deduplicated. */
export function orderedItemsDelivered(arrival) {
    return [...new Set((arrival?.orderedItems || []).map((o) => o.poItemRecordId).filter(Boolean))];
}

/**
 * How much of one ordered item a document accounts for.
 *
 * SUMMED, NEVER TAKEN FROM ONE ENTRY, and on the arrival's side that is load-
 * bearing rather than defensive: a delivery holds two rows for one ordered item
 * whenever part of it was over-delivered, which is #162's own shape. On the bill's
 * side it is #167's split, where one invoice item became two against two orders.
 */
export function qtyOnOrderedItem(document, poItemRecordId) {
    return (document?.orderedItems || [])
        .filter((o) => o.poItemRecordId === poItemRecordId)
        .reduce((total, o) => total + (o.qty || 0), 0);
}

/**
 * What is left of one ordered item on this arrival, after the bills already on it.
 *
 * THE RULE THAT REPLACED HALF OF `shared-order`, and the distinction is worth
 * stating because it looks like the quantity test this module refuses to make. A
 * bill already attached to this shipment, charging everything the shipment brought
 * of an ordered item, does not make a second bill AMBIGUOUS — it makes it
 * impossible. 15 arrived, one bill claims 15, so a second bill charging that
 * ordered item is not "the one we cannot tell apart", it is one that cannot fit.
 * A computation rather than a refusal, which is why the outcome it produces is
 * silence.
 *
 * IT IS NOT THE FORBIDDEN COMPARISON, AND THE TEST IS WHICH TWO FIGURES MEET.
 * Matching on quantity would ask whether THIS bill's quantity equals what the
 * shipment brought, and that would drop the very bills #210's mismatch marker
 * exists for — a vendor billing 13 against a shipment of 10. This asks whether the
 * shipment's capacity for that ordered item has been spoken for by SOMEBODY ELSE.
 * So the comparison is `> 0`, never `>= billed`: 13 against 10 with nothing else
 * attached leaves 10 of room and still pairs, and the marker then states the
 * shortfall. `offline/delivery-invoice-match.mjs` pins exactly that.
 *
 * NOTHING IS CLAIMED ON AN ARRIVAL THAT DOES NOT EXIST YET. On the entry path
 * `deliveryRecordId` is null, so no bill can be on it — computed as zero rather
 * than compared, since `null === null` would count every unplaced bill as attached.
 */
export function roomOnOrderedItem({ arrival, poItemRecordId, bills, excluding } = {}) {
    const brought = qtyOnOrderedItem(arrival, poItemRecordId);
    const held = arrival?.deliveryRecordId || null;
    if (!held) return brought;

    const claimed = (bills || [])
        .filter((b) => b && b.invoiceRecordId !== excluding && b.pairedDeliveryRecordId === held)
        .reduce((total, b) => total + qtyOnOrderedItem(b, poItemRecordId), 0);

    return brought - claimed;
}

/**
 * Do these two bills charge against any of the same ordered items?
 *
 * NOT `sharesOrderedItem`, WHICH IS TAKEN AND MEANS SOMETHING ELSE.
 * lib/deliveryStatus.js exports that name for "the ordered item this box is about
 * carries another bill" — one argument, a fact about an ordered item. This one
 * takes two bills and asks whether they overlap. One name for two meanings is the
 * collision CLAUDE.md's naming rules single out as worse than an accidental one,
 * because it would be on purpose.
 */
export function chargesSameOrderedItem(a, b) {
    const other = new Set(orderedItemsBilled(b));
    return orderedItemsBilled(a).some((p) => other.has(p));
}

/**
 * Everything a bill says about what it charges for, as one comparable string.
 *
 * TOTAL BY CONSTRUCTION, WHICH IS THE WHOLE REQUIREMENT. Two bills are tied only
 * if nothing here differs, so this has to cover every figure the pairing or #210's
 * marker could read: the ordered items, the quantity on each — SUMMED, because
 * #167's split leaves one bill with two rows — and the prices those rows carry.
 * Ordered items sorted, prices sorted within one, so two bills that list the same
 * rows in a different order are still tied.
 *
 * PRICE IS COMPARED BETWEEN THE TWO BILLS AND NEVER AGAINST THE ORDER, and that
 * distinction is what keeps the rival rule's posture intact. `pairingRefusal`
 * refuses to test a rival for FIT because an agreed price it cannot answer for
 * would fail closed the wrong way; this consults no `agreedPrices` at all, so a
 * tie is decidable for any two bills whatever the caller knows.
 */
export function chargeSignature(bill) {
    return orderedItemsBilled(bill)
        .sort()
        .map((poItemRecordId) => {
            const prices = (bill?.orderedItems || [])
                .filter((o) => o.poItemRecordId === poItemRecordId)
                .map((o) => String(o.unitPrice ?? ""))
                .sort();
            return `${poItemRecordId}:${qtyOnOrderedItem(bill, poItemRecordId)}@${prices.join("/")}`;
        })
        .join(";");
}

/**
 * Two bills nothing this app computes can tell apart.
 *
 * The empty set is never tied to anything, and that is the same trap `fitRefusal`
 * opens with: two bills charging no ordered item at all have equal signatures, and
 * calling them tied would let one of them be attached on the strength of being
 * indistinguishable from the other. `noOrderedItem` already refuses both, so this
 * is the second guard rather than the only one — deliberately, because the caller
 * that reads this for the tie-break message does not go through `fitRefusal`.
 */
export function chargesIdentically(a, b) {
    const signature = chargeSignature(a);
    return signature !== "" && signature === chargeSignature(b);
}

/**
 * The bills nobody has placed that this one is tied with.
 *
 * What the tie-break is decided from AND what its sentence names, from one
 * function, so a message cannot come to describe a set the rule did not use.
 */
export function tiedRivals(bill, bills) {
    return (bills || []).filter(
        (other) =>
            other &&
            other.invoiceRecordId !== bill?.invoiceRecordId &&
            !other.pairedDeliveryRecordId &&
            chargesIdentically(bill, other)
    );
}

/**
 * Does this bill sit inside this arrival, price and all — and if not, why.
 *
 * THE EMPTY SET IS REFUSED EXPLICITLY, and that is the trap this rule is built
 * around rather than an edge case. A bill charging no ordered item at all is
 * vacuously contained in every shipment, so containment alone would attach the two
 * hand-entered free-text invoices on this base to whichever delivery was recorded
 * next. `noOrderedItem` comes FIRST for that reason; nothing downstream may rely on
 * a later clause happening to catch it.
 *
 * A row with no `PO Item` is skipped rather than refused. Freight rides on
 * `Invoices."Shipping Fee"`, but the app's own free-text option is only hidden
 * (#96), so a mixed invoice is reachable — and such a row names no ordered quantity,
 * which is the same exclusion `countsTowardStatus` already makes on the status axis.
 * A bill of ONLY such rows is the empty set above.
 *
 * `agreedPrices` maps ordered-item record id -> the price on the order. Consulted
 * only after containment holds, so the caller need only cover the arrival's own
 * ordered items. A price it cannot answer for FAILS CLOSED, under its own key: an
 * unmatched bill is this feature's ordinary state, and a wrong pairing is not.
 */
export function fitRefusal(bill, arrival, agreedPrices) {
    const billed = orderedItemsBilled(bill);
    if (billed.length === 0) return PAIRING_REFUSED.noOrderedItem;
    if (bill?.pairedDeliveryRecordId) return PAIRING_REFUSED.alreadyPaired;

    const brought = new Set(orderedItemsDelivered(arrival));
    if (!billed.every((p) => brought.has(p))) return PAIRING_REFUSED.notContained;

    for (const charged of bill.orderedItems || []) {
        if (!charged.poItemRecordId) continue;
        const agreed = agreedPrices?.get?.(charged.poItemRecordId);
        if (typeof agreed !== "number" || typeof charged.unitPrice !== "number") {
            return PAIRING_REFUSED.priceUnknown;
        }
        if (checkUnitPriceVariance(charged.unitPrice, agreed)) return PAIRING_REFUSED.priceDeparts;
    }

    return null;
}

/**
 * THE ONE PREDICATE BOTH DIRECTIONS CALL: may this bill be computed onto this
 * arrival, given every bill from the same vendor?
 *
 * `bills` is the whole vendor-narrowed pool, not the candidates — a bill that
 * already NAMES this arrival is not a candidate and is exactly the rival that
 * matters most. That distinction is what a first pass got wrong: filtering rivals
 * to unpaired bills let `HYE-INV-260804-04` be computed onto `HYE-DL-260804-06`
 * while `HYE-INV-260804-05`, already recorded on that shipment, charges the same
 * `166-DEMO Coupling`. That is #166's scenario D and the case #210 exists to get
 * right — the shipment answers ONE of the two bills and the other's material has
 * not arrived — so a rule that attached both would quietly undo it.
 *
 * TWO CLAUSES, AND SPLITTING THEM IS WHAT MADE THE SECOND ONE HONEST. A bill
 * already ON this arrival and a bill nobody has placed were once one rival test,
 * and they are not the same fact. The first is capacity — see `roomOnOrderedItem`
 * — and it is arithmetic with a definite answer: if the shipment's 15 are already
 * claimed, a second bill cannot be this shipment's, and saying "nothing records
 * which of them" would be false, since something does. The second is genuine
 * ambiguity: two bills nobody has placed, both charging an ordered item this
 * shipment brought, and no record of which one it answers.
 *
 * ROOM IS TESTED FIRST, because it is the more specific answer and because it is
 * the one that is not a guess. Where both would fire — a full arrival with two
 * unplaced bills on it — the reader is told there is no space rather than that the
 * app cannot choose, which is the true statement of the two.
 *
 * A RIVAL IS NOT ITSELF TESTED FOR FIT, and the wider rule is the deliberate one.
 * Asking whether the rival would ALSO be contained needs its ordered items priced,
 * and a price this module cannot answer for would then fail closed the WRONG WAY —
 * an unknown rival would stop being a rival and the pairing would be made. So a
 * rival is any other UNPLACED bill charging the same ordered item, which needs no
 * price at all and refuses rather than guesses.
 *
 * EXCEPT ONE THAT IS TIED WITH IT, which is not the same relaxation. `tiedRivals`
 * compares the two BILLS with each other and never either against the order, so it
 * needs no price the caller might not have and cannot fail closed the wrong way:
 * an unknown price makes two bills DIFFER, which leaves them rivals. What it takes
 * out of `shared-order` is the pair whose signatures match exactly — see the header
 * for why the choice between those is not a thing a reader could resolve. Which of
 * them is attached is `planPairings`'s to settle, since it is the one that sees the
 * whole pool; this predicate only stops calling them each other's rival.
 *
 * A BILL PLACED ON ANY SHIPMENT IS NEVER A RIVAL NOW, this one included. On
 * another shipment it was never competing; on THIS one it is answered by capacity
 * instead, which is #219's tier rule keeping its shape — a recorded pairing does
 * not lose to an unrecorded one, it simply consumes the room it recorded.
 *
 * MEASURED, on this base 2026-08-13: the split changes no pairing (6 attach either
 * way) and changes one message — `HYE-INV-260804-04` stopped being told the app
 * could not choose and is now silent, because `HYE-DL-260804-06` brought 15 and
 * `HYE-INV-260804-05` claims all 15. The case #210 exists for is untouched: with
 * both bills unplaced the room is 15 and `shared-order` still fires for both.
 */
export function pairingRefusal({ bill, arrival, bills, agreedPrices } = {}) {
    const fit = fitRefusal(bill, arrival, agreedPrices);
    if (fit) return fit;

    const noRoom = orderedItemsBilled(bill).some(
        (poItemRecordId) =>
            roomOnOrderedItem({
                arrival,
                poItemRecordId,
                bills,
                excluding: bill.invoiceRecordId,
            }) <= 0
    );
    if (noRoom) return PAIRING_REFUSED.noRoom;

    const rival = (bills || []).some(
        (other) =>
            other &&
            other.invoiceRecordId !== bill.invoiceRecordId &&
            !other.pairedDeliveryRecordId &&
            chargesSameOrderedItem(bill, other) &&
            !chargesIdentically(bill, other)
    );

    return rival ? PAIRING_REFUSED.sharedOrder : null;
}

/**
 * The shared tail of both directions: turn the per-candidate verdicts into one
 * outcome.
 *
 * `shared-order` is reported only when it is the reason there is nothing to attach.
 * With a candidate in hand the reader does not need telling that some other bill was
 * considered and dropped, and with a plain `not-contained` everywhere there is
 * nothing to report at all.
 */
function decide(verdicts) {
    const fits = verdicts.filter((v) => v.refusal === null);
    if (fits.length === 1) return { key: PAIRING.matched, candidate: fits[0].candidate, count: 1 };
    if (fits.length > 1) {
        return { key: PAIRING.several, candidate: null, count: fits.length };
    }
    const blocked = verdicts.filter((v) => v.refusal === PAIRING_REFUSED.sharedOrder);
    if (blocked.length > 0) {
        return { key: PAIRING.sharedOrder, candidate: blocked[0].candidate, count: blocked.length };
    }
    return { key: PAIRING.none, candidate: null, count: 0 };
}

/** A stand-in id for an arrival that has no record yet, so decisions can be folded. */
const THIS_ARRIVAL = "__this-arrival__";

/**
 * DIRECTION 1 — recording an arrival: EVERY bill it attaches, not one.
 *
 * THE FORM'S ARITY IS GONE, AND WITH IT THE ONE ASYMMETRY THIS MODULE USED TO
 * CARRY. While the computed answer preselected a control, two candidates meant two
 * values in a one-value field and nothing was attached; the computation happens in
 * the Server Action now, the way `planDelivery` decides an allocation rather than
 * prefilling a picker, so the number of links is the rule's business rather than a
 * widget's. Two bills charging DIFFERENT ordered items one shipment brought are
 * each individually unambiguous, and both are attached. `several` no longer exists
 * on this side — it survives only on the invoice side, where a bill really can be
 * contained in two shipments.
 *
 * FOLDING AND DEDUCTING ARE ONE STEP, NEVER ONE WITHOUT THE OTHER. A decided bill
 * is added to the pool AS ATTACHED to this arrival, which does two things at once:
 * it stops being an unplaced rival, and its quantity starts counting against the
 * room. Doing only the first is the defect — the rival clause goes quiet and
 * nothing takes its place, so an arrival of 15 could take two bills of 15. Pinned
 * offline with a mutation that folds without deducting.
 *
 * IT WAS INERT FOR ONE COMMIT AND IS NOT NOW, WHICH IS WHY THE FOLD IS BACK. With
 * every rival refused, any two bills that attached were disjoint and drew on
 * different room, so folding changed no later answer and this was a filter. TIED
 * bills are the counter-example: they charge the same ordered items, so the first
 * one attached has to take its room out of the arrival before the second is judged,
 * or an arrival of 15 takes two bills of 15. The disjointness assertion left behind
 * when the fold went is what makes that a caught case rather than a discovered one.
 *
 * THE POOL'S ORDER IS STILL IRRELEVANT, BUT NO LONGER FOR FREE. Among untied bills
 * it is provable — a bill attaches only when no other unplaced bill charges an
 * ordered item it charges, so any two that attach are disjoint. Tied bills break
 * that, and which of them attaches is a real choice, so the pass takes them in a
 * total order of its own rather than in the caller's: `Invoice ID`, which is on the
 * option already and means nothing here beyond being stable. The property offline
 * asserts is the same one — reverse the pool, get the same answer — and it now has
 * something to prove. See the header for why the choice itself is unobservable.
 */
export function planPairings({ arrival, bills, agreedPrices } = {}) {
    if (!arrival) return { attach: [], refusals: new Map(), blocked: null, tied: [] };

    const asArrival = { ...arrival, deliveryRecordId: arrival.deliveryRecordId || THIS_ARRIVAL };
    const offered = (bills || []).filter((b) => b?.invoiceRecordId);
    const attach = [];
    const refusals = new Map();

    // The caller's order is not consulted at all — see the doc comment. `invoiceId`
    // is the key and the record id is its fallback, because an option can reach
    // here without one and a comparator has to be total.
    //
    // THE SEPARATOR IS A SPACE FOR THE TOOLING, NOT FOR THE SORT. Any character an
    // `Invoice ID` cannot contain orders these correctly, and a NUL would do it
    // better — it sorts below every printable character, so no id could reach past
    // its own separator. This line carried one by accident and the cost was not the
    // ordering: `grep` reads a file holding a NUL as BINARY and skips it, so this
    // module went silently missing from a repository-wide search for a word it uses.
    // Staying greppable outranks a stronger ordering nothing here needs, and
    // `offline/source-bytes.mjs` is what keeps the next one from being invisible.
    const stableKey = (b) => `${b.invoiceId ?? ""} ${b.invoiceRecordId}`;
    const queue = [...offered].sort((a, b) => (stableKey(a) < stableKey(b) ? -1 : 1));

    // `pool` is what the predicate sees, and it is what the fold rewrites: a decided
    // bill re-enters it holding THIS arrival, so it stops being an unplaced rival and
    // its quantity starts counting against the room in the same step.
    let pool = offered;
    for (const bill of queue) {
        const refusal = pairingRefusal({ bill, arrival: asArrival, bills: pool, agreedPrices });
        if (refusal) {
            refusals.set(bill.invoiceRecordId, refusal);
            continue;
        }
        attach.push(bill);
        pool = pool.map((b) =>
            b.invoiceRecordId === bill.invoiceRecordId
                ? { ...b, pairedDeliveryRecordId: asArrival.deliveryRecordId }
                : b
        );
    }

    // WHAT WAS PASSED OVER, JUDGED AT THE END RATHER THAN AS EACH BILL IS DECIDED,
    // and the difference is not bookkeeping. A tie is only a tie-break when the
    // other bill did not get attached too: an arrival of 30 takes both bills of 15,
    // and nothing was chosen there. So the tied set is read off the ORIGINAL pool —
    // which is where an unplaced twin still looks unplaced — and then narrowed to
    // the ones this pass left unattached.
    const attached = new Set(attach.map((b) => b.invoiceRecordId));
    const tied = attach
        .map((bill) => ({
            chosen: bill,
            passedOver: tiedRivals(bill, offered).filter((o) => !attached.has(o.invoiceRecordId)),
        }))
        .filter((t) => t.passedOver.length > 0);

    // The one refusal worth reporting, on the same rule `decide` uses: it is only
    // news when it is why nothing was attached.
    const blocked =
        attach.length === 0
            ? [...refusals.entries()].find(([, key]) => key === PAIRING_REFUSED.sharedOrder)?.[0] ?? null
            : null;

    return { attach, refusals, blocked, tied };
}

/**
 * What the delivery form previews and the action reports: `planPairings` as an
 * outcome key plus the bills it names.
 *
 * THE TIE-BREAK RIDES ALONG RATHER THAN REPLACING THE KEY, which is the whole
 * reason it is a qualifier. An arrival can attach three bills of which one was
 * tie-broken, so a key saying `tie-break` would have to stop saying that three
 * were attached. `chosen` and `tiedWith` are therefore extra fields on whatever
 * outcome happened, and `describeTieBreak` is the second sentence they word.
 *
 * ONE GROUP IS NAMED, THE FIRST. Two independent ties on one arrival needs two
 * ordered items each billed twice at matching figures; the sentence's work is to
 * send a reader to the delivery's own page, which lists every attachment, so
 * naming the second there rather than here loses nothing a reader could act on.
 */
export function describeArrivalPairings(plan, bills) {
    const attached = plan?.attach || [];
    const [tie] = plan?.tied || [];
    const broken = tie
        ? { chosen: tie.chosen.invoiceId, tiedWith: tie.passedOver.map((b) => b.invoiceId) }
        : { chosen: null, tiedWith: [] };

    if (attached.length === 1) {
        return { key: PAIRING.matched, invoiceIds: [attached[0].invoiceId], count: 1, ...broken };
    }
    if (attached.length > 1) {
        return {
            key: PAIRING.severalAttached,
            invoiceIds: attached.map((b) => b.invoiceId),
            count: attached.length,
            ...broken,
        };
    }
    if (plan?.blocked) {
        const bill = (bills || []).find((b) => b.invoiceRecordId === plan.blocked);
        return {
            key: PAIRING.sharedOrder,
            invoiceIds: [bill?.invoiceId].filter(Boolean),
            count: 1,
            ...broken,
        };
    }
    return { key: PAIRING.none, invoiceIds: [], count: 0, ...broken };
}

/**
 * DIRECTION 2 — recording a bill: which arrival, if any, does it attach to?
 *
 * `arrivals` are the shipments that brought any of the ordered items this bill
 * charges for; anything else cannot contain it. `bills` is the same vendor-wide
 * pool direction 1 takes, so the rival clause sees what it sees there.
 *
 * THE TIE-BREAK IS SIMPLER ON THIS SIDE, BECAUSE THE BILL IS GIVEN. Direction 1
 * chooses which of two tied bills the arrival gets; here the bill is the one being
 * entered, so there is nothing to choose — it attaches, and the twin stays unplaced
 * exactly as it would have if the delivery had been recorded first and lost the
 * `Invoice ID` order. So the two directions can hand the shipment to DIFFERENT
 * members of a tied pair, and that is not the divergence the header forbids: they
 * agree on whether the pair is permissible, and which tied bill got it is the thing
 * this feature has just finished arguing is unobservable.
 */
export function matchArrivalToBill({ bill, arrivals, bills, agreedPrices } = {}) {
    const verdicts = (arrivals || []).map((arrival) => ({
        candidate: arrival,
        refusal: pairingRefusal({ bill, arrival, bills, agreedPrices }),
    }));
    const { key, candidate, count } = decide(verdicts);
    return {
        key,
        deliveryRecordId: key === PAIRING.matched ? candidate.deliveryRecordId : null,
        deliveryId: candidate?.deliveryId ?? null,
        count,
        // Only where something was actually attached: a bill that matched nothing
        // passed over nothing either.
        tieBreak: key === PAIRING.matched && tiedRivals(bill, bills).length > 0,
    };
}

// ---------------------------------------------------------------------------
// Copy
//
// TWO GROUPS, THE ARRANGEMENT ALLOCATION_COPY AND LINK_COPY BOTH USE. `preview`
// addresses the recorder about to submit the delivery form, second person and
// present, beside the allocation preview it sits under; `banner` is what the
// invoice's own page says after the fact, because the invoice form holds no
// delivery data and buying a preview there would mean reading the whole delivery
// axis on a screen where the answer is usually `none` — measured, 6 of 13 unpaired
// invoices on this base have no candidate at all, and an invoice normally arrives
// BEFORE its material.
//
// SO THE ASYMMETRY IS WHEN THE READER IS TOLD, NEVER WHETHER THE PAIRING IS MADE.
// Both directions attach, and both refuse on the same predicate; only the moment
// differs, and it differs because the delivery form already holds both halves of
// the comparison while the invoice form holds neither.
//
// `none` HAS NO ENTRY IN EITHER GROUP, and that is the decision rather than an
// omission. An unpaired invoice is this feature's ordinary state — it is what
// #216's strip above /invoices lists and what the `Awaiting delivery` chip says —
// so a screen announcing that nothing was matched would report the normal case as
// an event. Unlike an allocation, where an unattached row belongs to no ordered
// item at all, nothing is lost by staying quiet.
//
// Same vocabulary as #166: `delivered`, never `arrived`; `ordered item`, never
// `line`; facts rather than verdicts.

export const PAIRING_COPY = {
    preview: {
        /**
         * Attached, and told what was done — `describePlan`'s posture, which states
         * the allocation the form is about to submit rather than asking permission
         * for it. It names the bill because the recorder is checking it against a
         * packing list in their hand.
         *
         * IT CLAIMS ONLY WHAT THIS DIRECTION COMPUTED. The sentence used to end
         * `and nothing else could be its shipment`, which this side never
         * establishes: `planPairings` judges ONE arrival and asks only whether some
         * other unplaced BILL is in the way. Whether a second delivery also contains
         * the bill is direction 2's question, and it has its own outcome for it
         * (`several`) — measured reachable, since two ordered items on this base were
         * each filled by two arrivals. Swapping the word for `delivery` would have
         * carried the over-claim across, so the clause went instead.
         */
        /**
         * IT NAMES A CONTROL THE READER CAN ACTUALLY REACH, which is #206's rule
         * read from the other side: that issue refuses to name an action a reader
         * cannot take, and this one has to name the one they can. All three of
         * these sent the reader to a checkbox on this form until the entry form's
         * invoice control was removed and the sentences were not; the correction is
         * the delivery's own page, which is where #210's plural picker lives and is
         * the only place a computed pairing can now be changed.
         */
        [PAIRING.matched]: (f) => ({
            key: PAIRING.matched,
            text:
                `${f?.invoiceIds?.[0] ?? "One invoice"} bills ordered items this delivery brought ` +
                "and no other invoice bills them, so it is attached. If the packing list names a " +
                "different number, correct it from this delivery's page after recording it.",
        }),
        /**
         * SEVERAL ATTACHED, WHICH IS NOT THE SAME NEWS AS SEVERAL CANDIDATES. Each
         * of these bills charges ordered items no other bill charges, so none of
         * them is a guess — the shipment simply covers more than one document, which
         * is what the n:1 link is for.
         */
        [PAIRING.severalAttached]: (f) => ({
            key: PAIRING.severalAttached,
            text:
                `${(f?.invoiceIds || []).join(" and ") || "Several invoices"} each bill ordered ` +
                "items this delivery brought that no other invoice bills, so all of them are " +
                "attached. Correct that from this delivery's page after recording it.",
        }),
        /**
         * Two bills nobody has placed charge the same ordered item, so which of
         * them this shipment answers is recorded nowhere. It names the one it
         * blocks on, because a rival is always visible to whoever is reading this
         * — see the module header for why that holds by construction.
         *
         * `nobody has attached` IS THE LOAD-BEARING PHRASE, and it is what the
         * capacity clause left this message able to say truthfully. While a bill
         * ALREADY on the shipment counted as a rival, this sentence had to claim
         * nothing recorded which bill the shipment answered — with one of them
         * attached, something did.
         */
        [PAIRING.sharedOrder]: (f) => ({
            key: PAIRING.sharedOrder,
            text:
                `${f?.invoiceIds?.[0] ?? "An invoice"} and another invoice nobody has attached ` +
                "both bill an ordered item this delivery brought, so nothing records which of " +
                "them it answers. Attach the right one from this delivery's page after " +
                "recording it.",
        }),
    },

    banner: {
        /**
         * The invoice's own page after creation. It does not name the delivery: the
         * delivery section below marks it `— this invoice` already, and one fact
         * rendered twice on one screen is what #166 took the `beyond order` tag off
         * `/invoices` for. What the banner adds is WHO decided, which nothing else
         * on the page says.
         */
        [PAIRING.matched]: () => ({
            key: PAIRING.matched,
            text:
                "The delivery below was matched from the ordered items this invoice bills — " +
                "nobody attached it by hand. Detach it from that delivery if it is the wrong one.",
        }),
        /**
         * NO COUNT IN THIS VOICE, unlike the preview's. The outcome reaches this
         * page as a key on a query string and nothing else — copy is this module's,
         * so a query string carrying words would be a second place to reword one,
         * and a second parameter carrying a number would be a second thing to keep
         * in step for a figure the reader cannot act on differently at two than at
         * three.
         */
        [PAIRING.several]: () => ({
            key: PAIRING.several,
            text:
                "More than one delivery brought everything this invoice bills, so none was " +
                "attached. Attach the right one from the delivery's own page.",
        }),
        [PAIRING.sharedOrder]: () => ({
            key: PAIRING.sharedOrder,
            text:
                "A delivery brought everything this invoice bills, but another invoice nobody " +
                "has attached charges the same ordered item, so none was attached. Attach the " +
                "right one from the delivery's own page.",
        }),
    },

    /**
     * THE QUALIFIER, WHICH IS WHY IT IS NOT A THIRD ENTRY IN THE TWO GROUPS ABOVE.
     * Those are keyed by outcome and exactly one of them is ever said; this composes
     * with `matched` and with `several-attached`, so keying it the same way would
     * mean an outcome that has to mean two things at once. Same argument #166 made
     * for its own marker being a marker rather than a fourth chip.
     *
     * IT NAMES BOTH BILLS IN THE PREVIEW AND NEITHER IN THE BANNER, which is the
     * asymmetry those two voices already have. The recorder has the packing list in
     * front of them, so the numbers are what they check against; the invoice's own
     * page is about ONE bill and reaches this outcome through a query string, which
     * carries keys rather than sentences and so has no name to carry.
     */
    tieBreak: {
        preview: (f) => ({
            key: TIE_BREAK,
            text:
                `${f?.chosen ?? "One invoice"} and ` +
                `${(f?.tiedWith || []).join(" and ") || "another invoice"} bill the same ordered ` +
                "items in the same quantities at the same prices, so nothing here tells them " +
                `apart — ${f?.chosen ?? "the first"} is the one attached. Swap them from this ` +
                "delivery's page after recording it if the packing list names the other.",
        }),
        banner: () => ({
            key: TIE_BREAK,
            text:
                "Another invoice bills the same ordered items in the same quantities at the " +
                "same prices, so nothing told the two apart and this one was attached rather " +
                "than that one. Swap them from the delivery's own page if this is the wrong one.",
        }),
    },
};

/**
 * The one sentence an outcome deserves, so no screen invents a second phrasing.
 * Returns null for `none` and for anything unworded, which is what lets a caller
 * write `describePairing(...)?.text` and render nothing.
 */
export function describePairing(outcome, voice = "preview") {
    const group = PAIRING_COPY[voice];
    const builder = group?.[outcome?.key];
    return builder ? builder(outcome) : null;
}

/**
 * The second sentence, when a tie decided which bill was attached — and null the
 * rest of the time, so a screen writes `describeTieBreak(...)?.text` beside
 * `describePairing(...)?.text` and renders one or two lines without a branch.
 *
 * THE CONDITION IS THE FIELD, NEVER A KEY. Direction 1 sets `tiedWith` and
 * direction 2 sets `tieBreak`, because one of them knows the bill it passed over
 * and the other reaches this page through a query string that carries no names.
 * Either is enough to have happened; neither is an outcome.
 */
export function describeTieBreak(outcome, voice = "preview") {
    const broken = Boolean(outcome?.tieBreak) || (outcome?.tiedWith || []).length > 0;
    const builder = PAIRING_COPY.tieBreak[voice];
    return broken && builder ? builder(outcome) : null;
}

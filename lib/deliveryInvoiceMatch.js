// The COMPUTED pairing (#231) — which delivery an invoice's ordered items place it on,
// read off what both documents already say instead of off somebody's comparison.
//
// #210 stored the pairing and left it to be filled by hand, from a dropdown when a
// delivery is recorded or from the delivery's edit page afterwards. This module is
// what fills it: an invoice's `Invoice Items` name ordered items and so do a
// delivery's `Delivery Items`, and one invoice sits inside one delivery, so an invoice
// whose ordered items all fall inside a delivery's is a candidate for it.
//
// ONE PREDICATE, TWO DIRECTIONS, AND THE PREDICATE IS THE POINT. Either document can
// arrive first, so both entry points look — recording a delivery scans the invoices,
// recording an invoice scans the deliveries — and if the two directions could reach
// different answers, whether a pairing got made would depend on which document
// somebody typed in first. So `pairingRefusal` below decides ONE (invoice, delivery)
// pair and both directions call it; `planPairings` and `matchDeliveryToInvoice` only
// differ in which side they iterate.
//
// TWO INVOICES NOTHING TELLS APART ARE NOT AN AMBIGUITY, AND THAT IS THE THIRD TIME
// ONE CLAUSE HAS SPLIT. `shared-order` began as "another invoice charges this ordered
// item"; the invoices already ON the delivery left it for capacity; what leaves it now
// is the pair that charges the SAME ordered items in the SAME quantities at the
// SAME prices. Attaching either one leaves the delivery with the same room and gives
// either bill the same #210 mismatch marker, so no figure this app computes comes
// out differently for the two choices. A refusal has to hand a reader something to
// resolve, and there is nothing here to resolve — so one is attached.
//
// WHICH ONE IS ARBITRARY ON PURPOSE, AND THE ORDER CARRIES NO CLAIM. Any total
// order would do; this takes `Invoice ID` because it is already on the option and
// is stable. Deliberately NOT #166's oldest-bill-first, which asserts that the
// earlier invoice has the better title to the delivery — the assertion this case
// exists to say cannot be made.
//
// A DIFFERENT QUANTITY IS OBSERVED, SO IT STILL REFUSES. Bills of 10 and 5 against
// a delivery of 15 leave 5 or 10 of room depending on which is attached, and #210's
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
// render means reading the vendor's other invoices and their `Invoice Items` on screens
// #210 got down to 3 operations. Same shape, and the same answer, as the refusals
// those screens also do not speak.
//
// FOLDING CAME BACK WITH IT, WHICH IS THE COST. Two tied invoices are not disjoint, so
// a decision has to count against the room before the next invoice is judged, or an
// delivery of 15 would take both invoices of 15. `planPairings` folds each attachment
// into the pool as attached to this delivery again. The simplification made when the
// entry form's invoice control went is undone, and the disjointness assertion left
// behind then is exactly what would have caught its absence.
//
// QUANTITY IS NOT PART OF THE TEST, and leaving it out is the whole reason the
// invoice axis still works. A vendor billing 13 and shipping 10 is exactly the
// discrepancy #210's mismatch marker exists to show, and matching on quantity would
// drop such an invoice out of consideration so that no marker ever appeared — the
// feature would hide the case it was built to surface. Measured when this was
// written: `HYE-INV-260804-07` billed 13 against a delivery of 10 and paired.
//
// UNIT PRICE IS PART OF IT, because it is agreed on the order. An invoice departing
// from the agreed price is an error to raise with the vendor rather than an invoice to
// attach, so it is not a candidate — and it is not ANNOUNCED here, because
// `Invoice Items.Variance Flag` and the `⚠ Variance` badge already say it on the
// invoice's own page, set by the same `checkUnitPriceVariance` this imports. A
// second signal would be one fact rendered twice, which is what took the
// `beyond order` tag off `/invoices` in #166.
//
// THE RULE NEVER JUDGES A PAIRING THAT ALREADY EXISTS. An invoice naming a delivery is
// not a candidate — the single side is taken — and where a hand-made pairing
// departs from what this would compute, nothing here says so. Two reasons. #210's
// thesis is that the pairing is a fact somebody knows and the app was guessing at,
// so a marker reading "the app would have said otherwise" inverts that
// relationship. And the disagreement is already on screen: the one such pairing when
// this was written (`HYE-INV-260804-03` on `HYE-DL-260804-05`, 7 of `166-DEMO Tee`
// billed against 0 delivered) carried #210's mismatch marker, which fires on the same
// fact that keeps this rule from computing it — an invoice charging for material the
// delivery did not bring.
//
// WHAT A FAILURE LEAVES, ON EACH SIDE, because the two writes sit in different
// places and only one of them can lose anything.
//
//   Delivery side — the computed answer is a PRESELECTION on the #210 dropdown,
//   so it is submitted with the form and written by `createDeliveryAction` inside
//   that action's own rollback, exactly where a hand-picked one was written
//   before. A failure there destroys the delivery with it and the recorder retries;
//   nothing partial survives, and this issue changed none of it.
//
//   Invoice side — the write sits OUTSIDE `createInvoiceHandler`'s rollback, in a
//   best-effort block of its own. Three failure points and all three leave the
//   same state: the read throws, the match throws, or `setInvoiceDelivery` throws
//   — the invoice stands, complete and correct, naming no delivery. That is this
//   feature's ordinary state rather than a damaged one: #216's strip above
//   /invoices lists the delivery, the invoice reads `Awaiting delivery`, and the
//   pairing can still be made by hand from the delivery's own Edit page. Nothing
//   half-written is reachable, because the link is one field written in one call
//   and `pairing` keeps its `none` on any throw, so the page reports nothing
//   rather than a match that was not made. What is deliberately NOT done is
//   rolling the invoice back: it is the office's record of an invoice that exists, and
//   a derived answer must not undo it — `lib/materialsCache.js`'s posture and
//   #167's about not undoing the approval that produced it.
//
// A RIVAL INVOICE IS ALWAYS VISIBLE TO WHOEVER IS ASKING, so this needs no unscoped
// read and no second voice for a record outside scope. The derivation, because it
// is load-bearing: a rival shares an ordered item with a candidate, a candidate's
// ordered items all lie inside the delivery, a delivery sits on one Job, and
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
// pairing, and the deliveries an invoice may name is the same rule read from the other
// end, so putting it in a near-homonym module of its own would be two homes for one
// rule and a name nobody could tell apart at a glance.

// The `.js` is required, not stylistic: the offline tier runs this module under
// plain `node`, which will not resolve an extension-less relative specifier — the
// same reason lib/deliveryAllocation.js and lib/deliveryStatus.js spell theirs out.
import { checkUnitPriceVariance } from "./variance.js";

/**
 * Why an invoice cannot be computed onto a delivery. Keys, so a reworded message fails
 * nothing — the posture LINK_REFUSED and OVERAGE_BLOCKED already take.
 *
 * Only `sharedOrder` is ever spoken. The other six are the ordinary shape of a
 * invoice that simply is not this delivery's, and saying so for every invoice on the
 * vendor would bury the one answer that matters. `noRoom` belongs with them rather
 * than with the spoken one deliberately: it is arithmetic with a definite answer,
 * so there is nothing for a reader to resolve.
 */
export const PAIRING_REFUSED = {
    /** No `PO Item` on any of its rows — nothing to place it by. */
    noOrderedItem: "no-ordered-item",
    /** It bills an ordered item this delivery did not bring. */
    notContained: "not-contained",
    /** Some delivery already holds it. The single side is taken. */
    alreadyPaired: "already-paired",
    /** A billed unit price was compared with the order's and is not it. */
    priceDeparts: "price-departs",
    /**
     * A price this rule could not compare at all — the order's is missing from the
     * map a caller passed, or the invoice's own row carries none.
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
     * the delivery's rows come from, and the invoice action from a read of exactly
     * the ordered items the invoice charges — and containment is decided before a
     * price is consulted, so an ordered item reaching this clause is always in the
     * map. `PO Items."Unit Price"` is a frozen snapshot and is never blank.
     */
    priceUnknown: "price-unknown",
    /**
     * Bills already on this delivery have claimed everything it brought of an
     * ordered item this one charges. Not an ambiguity — there is no space.
     */
    noRoom: "no-room",
    /** Another invoice nobody has placed charges an ordered item this one charges. */
    sharedOrder: "shared-order",
};

/**
 * The outcome keys. `several` and `severalAttached` are opposite answers and belong
 * to opposite directions: an invoice contained in two deliveries cannot be placed
 * (`several`, invoice side), while a delivery carrying two invoices for different
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
 * A #210 dropdown option, read as an invoice.
 *
 * THE ONE SEAM BETWEEN TWO VOCABULARIES, and it exists so there is no second. The
 * option `getInvoiceLinkCandidates` returns is shaped for the picker and calls the
 * delivery holding an invoice `linkedDeliveryRecordId`; this module calls it
 * `pairedDeliveryRecordId`, because its rival clause is about pairing rather than
 * about what a control may offer. Carrying both names on the option would repeat
 * one fact, and teaching a pure rule the picker's field names would tie it to one
 * of its two callers. Both directions build their bills through here, which is also
 * what makes "the same pool in both directions" a property of the code rather than
 * of two call sites agreeing.
 */
export function invoiceFromOption(option) {
    return {
        invoiceRecordId: option?.invoiceRecordId ?? null,
        invoiceId: option?.invoiceId ?? null,
        orderedItems: option?.orderedItems || [],
        pairedDeliveryRecordId: option?.linkedDeliveryRecordId ?? null,
    };
}

/** The ordered items an invoice charges against, deduplicated. Never `Item Name` text. */
export function orderedItemsBilled(invoice) {
    return [...new Set((invoice?.orderedItems || []).map((o) => o.poItemRecordId).filter(Boolean))];
}

/** The ordered items a delivery brought, deduplicated. */
export function orderedItemsDelivered(delivery) {
    return [...new Set((delivery?.orderedItems || []).map((o) => o.poItemRecordId).filter(Boolean))];
}

/**
 * How much of one ordered item a document accounts for.
 *
 * SUMMED, NEVER TAKEN FROM ONE ENTRY, and on the delivery's side that is load-
 * bearing rather than defensive: a delivery holds two rows for one ordered item
 * whenever part of it was over-delivered, which is #162's own shape. On the invoice's
 * side it is #167's split, where one invoice item became two against two orders.
 */
export function qtyOnOrderedItem(document, poItemRecordId) {
    return (document?.orderedItems || [])
        .filter((o) => o.poItemRecordId === poItemRecordId)
        .reduce((total, o) => total + (o.qty || 0), 0);
}

/**
 * What is left of one ordered item on this delivery, after the invoices already on it.
 *
 * THE RULE THAT REPLACED HALF OF `shared-order`, and the distinction is worth
 * stating because it looks like the quantity test this module refuses to make. A
 * invoice already attached to this delivery, charging everything the delivery brought
 * of an ordered item, does not make a second invoice AMBIGUOUS — it makes it
 * impossible. 15 delivered, one invoice claims 15, so a second invoice charging that
 * ordered item is not "the one we cannot tell apart", it is one that cannot fit.
 * A computation rather than a refusal, which is why the outcome it produces is
 * silence.
 *
 * IT IS NOT THE FORBIDDEN COMPARISON, AND THE TEST IS WHICH TWO FIGURES MEET.
 * Matching on quantity would ask whether THIS invoice's quantity equals what the
 * delivery brought, and that would drop the very bills #210's mismatch marker
 * exists for — a vendor billing 13 against a delivery of 10. This asks whether the
 * delivery's capacity for that ordered item has been spoken for by SOMEBODY ELSE.
 * So the comparison is `> 0`, never `>= billed`: 13 against 10 with nothing else
 * attached leaves 10 of room and still pairs, and the marker then states the
 * shortfall. `offline/delivery-invoice-match.mjs` pins exactly that.
 *
 * NOTHING IS CLAIMED ON AN DELIVERY THAT DOES NOT EXIST YET. On the entry path
 * `deliveryRecordId` is null, so no invoice can be on it — computed as zero rather
 * than compared, since `null === null` would count every unplaced invoice as attached.
 */
export function roomOnOrderedItem({ delivery, poItemRecordId, invoices, excluding } = {}) {
    const brought = qtyOnOrderedItem(delivery, poItemRecordId);
    const held = delivery?.deliveryRecordId || null;
    if (!held) return brought;

    const claimed = (invoices || [])
        .filter((b) => b && b.invoiceRecordId !== excluding && b.pairedDeliveryRecordId === held)
        .reduce((total, b) => total + qtyOnOrderedItem(b, poItemRecordId), 0);

    return brought - claimed;
}

/**
 * Do these two invoices charge against any of the same ordered items?
 *
 * THE LONGER NAME IS HISTORY, NOT A DISTINCTION STILL BEING DRAWN. #210 could not
 * call this `sharesOrderedItem`, because lib/deliveryStatus.js exported that name for
 * a different question — whether the ordered item one box is about carries a second
 * invoice. #232 deleted that export with the `This bill:` line it decided, so the
 * collision is gone. The name stays: it says plainly that the subject is two invoices
 * rather than one ordered item, which is the only thing the collision was ever
 * standing in for.
 */
export function chargesSameOrderedItem(a, b) {
    const other = new Set(orderedItemsBilled(b));
    return orderedItemsBilled(a).some((p) => other.has(p));
}

/**
 * Everything an invoice says about what it charges for, as one comparable string.
 *
 * TOTAL BY CONSTRUCTION, WHICH IS THE WHOLE REQUIREMENT. Two invoices are tied only
 * if nothing here differs, so this has to cover every figure the pairing or #210's
 * marker could read: the ordered items, the quantity on each — SUMMED, because
 * #167's split leaves one invoice with two rows — and the prices those rows carry.
 * Ordered items sorted, prices sorted within one, so two invoices that list the same
 * rows in a different order are still tied.
 *
 * PRICE IS COMPARED BETWEEN THE TWO INVOICES AND NEVER AGAINST THE ORDER, and that
 * distinction is what keeps the rival rule's posture intact. `pairingRefusal`
 * refuses to test a rival for FIT because an agreed price it cannot answer for
 * would fail closed the wrong way; this consults no `agreedPrices` at all, so a
 * tie is decidable for any two invoices whatever the caller knows.
 */
export function chargeSignature(invoice) {
    return orderedItemsBilled(invoice)
        .sort()
        .map((poItemRecordId) => {
            const prices = (invoice?.orderedItems || [])
                .filter((o) => o.poItemRecordId === poItemRecordId)
                .map((o) => String(o.unitPrice ?? ""))
                .sort();
            return `${poItemRecordId}:${qtyOnOrderedItem(invoice, poItemRecordId)}@${prices.join("/")}`;
        })
        .join(";");
}

/**
 * Two invoices nothing this app computes can tell apart.
 *
 * The empty set is never tied to anything, and that is the same trap `fitRefusal`
 * opens with: two invoices charging no ordered item at all have equal signatures, and
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
 * The invoices nobody has placed that this one is tied with.
 *
 * What the tie-break is decided from AND what its sentence names, from one
 * function, so a message cannot come to describe a set the rule did not use.
 */
export function tiedRivals(invoice, invoices) {
    return (invoices || []).filter(
        (other) =>
            other &&
            other.invoiceRecordId !== invoice?.invoiceRecordId &&
            !other.pairedDeliveryRecordId &&
            chargesIdentically(invoice, other)
    );
}

/**
 * Does this invoice sit inside this delivery, price and all — and if not, why.
 *
 * THE EMPTY SET IS REFUSED EXPLICITLY, and that is the trap this rule is built
 * around rather than an edge case. An invoice charging no ordered item at all is
 * vacuously contained in every delivery, so containment alone would attach the two
 * hand-entered free-text invoices on this base to whichever delivery was recorded
 * next. `noOrderedItem` comes FIRST for that reason; nothing downstream may rely on
 * a later clause happening to catch it.
 *
 * A row with no `PO Item` is skipped rather than refused. Freight rides on
 * `Invoices."Shipping Fee"`, but the app's own free-text option is only hidden
 * (#96), so a mixed invoice is reachable — and such a row names no ordered quantity,
 * which is the same exclusion `countsTowardStatus` already makes on the status axis.
 * An invoice of ONLY such rows is the empty set above.
 *
 * `agreedPrices` maps ordered-item record id -> the price on the order. Consulted
 * only after containment holds, so the caller need only cover the delivery's own
 * ordered items. A price it cannot answer for FAILS CLOSED, under its own key: an
 * unmatched invoice is this feature's ordinary state, and a wrong pairing is not.
 */
export function fitRefusal(invoice, delivery, agreedPrices) {
    const billed = orderedItemsBilled(invoice);
    if (billed.length === 0) return PAIRING_REFUSED.noOrderedItem;
    if (invoice?.pairedDeliveryRecordId) return PAIRING_REFUSED.alreadyPaired;

    const brought = new Set(orderedItemsDelivered(delivery));
    if (!billed.every((p) => brought.has(p))) return PAIRING_REFUSED.notContained;

    for (const charged of invoice.orderedItems || []) {
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
 * THE ONE PREDICATE BOTH DIRECTIONS CALL: may this invoice be computed onto this
 * delivery, given every invoice from the same vendor?
 *
 * `bills` is the whole vendor-narrowed pool, not the candidates — an invoice that
 * already NAMES this delivery is not a candidate and is exactly the rival that
 * matters most. That distinction is what a first pass got wrong: filtering rivals
 * to unpaired invoices let `HYE-INV-260804-04` be computed onto `HYE-DL-260804-06`
 * while `HYE-INV-260804-05`, already recorded on that delivery, charged the same
 * `166-DEMO Coupling`. That is #166's scenario D and the case #210 exists to get
 * right — the delivery answers ONE of the two invoices and the other's material has
 * not delivered — so a rule that attached both would quietly undo it.
 *
 * TWO CLAUSES, AND SPLITTING THEM IS WHAT MADE THE SECOND ONE HONEST. An invoice
 * already ON this delivery and an invoice nobody has placed were once one rival test,
 * and they are not the same fact. The first is capacity — see `roomOnOrderedItem`
 * — and it is arithmetic with a definite answer: if the delivery's 15 are already
 * claimed, a second invoice cannot be this delivery's, and saying "nothing records
 * which of them" would be false, since something does. The second is genuine
 * ambiguity: two invoices nobody has placed, both charging an ordered item this
 * delivery brought, and no record of which one it answers.
 *
 * ROOM IS TESTED FIRST, because it is the more specific answer and because it is
 * the one that is not a guess. Where both would fire — a full delivery with two
 * unplaced invoices on it — the reader is told there is no space rather than that the
 * app cannot choose, which is the true statement of the two.
 *
 * A RIVAL IS NOT ITSELF TESTED FOR FIT, and the wider rule is the deliberate one.
 * Asking whether the rival would ALSO be contained needs its ordered items priced,
 * and a price this module cannot answer for would then fail closed the WRONG WAY —
 * an unknown rival would stop being a rival and the pairing would be made. So a
 * rival is any other UNPLACED invoice charging the same ordered item, which needs no
 * price at all and refuses rather than guesses.
 *
 * EXCEPT ONE THAT IS TIED WITH IT, which is not the same relaxation. `tiedRivals`
 * compares the two INVOICES with each other and never either against the order, so it
 * needs no price the caller might not have and cannot fail closed the wrong way:
 * an unknown price makes two invoices DIFFER, which leaves them rivals. What it takes
 * out of `shared-order` is the pair whose signatures match exactly — see the header
 * for why the choice between those is not a thing a reader could resolve. Which of
 * them is attached is `planPairings`'s to settle, since it is the one that sees the
 * whole pool; this predicate only stops calling them each other's rival.
 *
 * AN INVOICE PLACED ON ANY DELIVERY IS NEVER A RIVAL NOW, this one included. On
 * another delivery it was never competing; on THIS one it is answered by capacity
 * instead, which is #219's tier rule keeping its shape — a recorded pairing does
 * not lose to an unrecorded one, it simply consumes the room it recorded.
 *
 * MEASURED, on this base 2026-08-13: the split changes no pairing (6 attach either
 * way) and changes one message — `HYE-INV-260804-04` stopped being told the app
 * could not choose and is now silent, because `HYE-DL-260804-06` brought 15 and
 * `HYE-INV-260804-05` claims all 15. The case #210 exists for is untouched: with
 * both invoices unplaced the room is 15 and `shared-order` still fires for both.
 */
export function pairingRefusal({ invoice, delivery, invoices, agreedPrices } = {}) {
    const fit = fitRefusal(invoice, delivery, agreedPrices);
    if (fit) return fit;

    const noRoom = orderedItemsBilled(invoice).some(
        (poItemRecordId) =>
            roomOnOrderedItem({
                delivery,
                poItemRecordId,
                invoices,
                excluding: invoice.invoiceRecordId,
            }) <= 0
    );
    if (noRoom) return PAIRING_REFUSED.noRoom;

    const rival = (invoices || []).some(
        (other) =>
            other &&
            other.invoiceRecordId !== invoice.invoiceRecordId &&
            !other.pairedDeliveryRecordId &&
            chargesSameOrderedItem(invoice, other) &&
            !chargesIdentically(invoice, other)
    );

    return rival ? PAIRING_REFUSED.sharedOrder : null;
}

/**
 * The shared tail of both directions: turn the per-candidate verdicts into one
 * outcome.
 *
 * `shared-order` is reported only when it is the reason there is nothing to attach.
 * With a candidate in hand the reader does not need telling that some other invoice was
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

/** A stand-in id for a delivery that has no record yet, so decisions can be folded. */
const THIS_DELIVERY = "__this-arrival__";

/**
 * DIRECTION 1 — recording a delivery: EVERY invoice it attaches, not one.
 *
 * THE FORM'S ARITY IS GONE, AND WITH IT THE ONE ASYMMETRY THIS MODULE USED TO
 * CARRY. While the computed answer preselected a control, two candidates meant two
 * values in a one-value field and nothing was attached; the computation happens in
 * the Server Action now, the way `planDelivery` decides an allocation rather than
 * prefilling a picker, so the number of links is the rule's business rather than a
 * widget's. Two invoices charging DIFFERENT ordered items one delivery brought are
 * each individually unambiguous, and both are attached. `several` no longer exists
 * on this side — it survives only on the invoice side, where an invoice really can be
 * contained in two deliveries.
 *
 * FOLDING AND DEDUCTING ARE ONE STEP, NEVER ONE WITHOUT THE OTHER. A decided invoice
 * is added to the pool AS ATTACHED to this delivery, which does two things at once:
 * it stops being an unplaced rival, and its quantity starts counting against the
 * room. Doing only the first is the defect — the rival clause goes quiet and
 * nothing takes its place, so a delivery of 15 could take two invoices of 15. Pinned
 * offline with a mutation that folds without deducting.
 *
 * IT WAS INERT FOR ONE COMMIT AND IS NOT NOW, WHICH IS WHY THE FOLD IS BACK. With
 * every rival refused, any two invoices that attached were disjoint and drew on
 * different room, so folding changed no later answer and this was a filter. TIED
 * invoices are the counter-example: they charge the same ordered items, so the first
 * one attached has to take its room out of the delivery before the second is judged,
 * or a delivery of 15 takes two invoices of 15. The disjointness assertion left behind
 * when the fold went is what makes that a caught case rather than a discovered one.
 *
 * THE POOL'S ORDER IS STILL IRRELEVANT, BUT NO LONGER FOR FREE. Among untied bills
 * it is provable — an invoice attaches only when no other unplaced invoice charges an
 * ordered item it charges, so any two that attach are disjoint. Tied invoices break
 * that, and which of them attaches is a real choice, so the pass takes them in a
 * total order of its own rather than in the caller's: `Invoice ID`, which is on the
 * option already and means nothing here beyond being stable. The property offline
 * asserts is the same one — reverse the pool, get the same answer — and it now has
 * something to prove. See the header for why the choice itself is unobservable.
 */
export function planPairings({ delivery, invoices, agreedPrices } = {}) {
    if (!delivery) return { attach: [], refusals: new Map(), blocked: null, tied: [] };

    const asDelivery = { ...delivery, deliveryRecordId: delivery.deliveryRecordId || THIS_DELIVERY };
    const offered = (invoices || []).filter((b) => b?.invoiceRecordId);
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
    // bill re-enters it holding THIS delivery, so it stops being an unplaced rival and
    // its quantity starts counting against the room in the same step.
    let pool = offered;
    for (const invoice of queue) {
        const refusal = pairingRefusal({ invoice, delivery: asDelivery, invoices: pool, agreedPrices });
        if (refusal) {
            refusals.set(invoice.invoiceRecordId, refusal);
            continue;
        }
        attach.push(invoice);
        pool = pool.map((b) =>
            b.invoiceRecordId === invoice.invoiceRecordId
                ? { ...b, pairedDeliveryRecordId: asDelivery.deliveryRecordId }
                : b
        );
    }

    // WHAT WAS PASSED OVER, JUDGED AT THE END RATHER THAN AS EACH INVOICE IS DECIDED,
    // and the difference is not bookkeeping. A tie is only a tie-break when the
    // other invoice did not get attached too: a delivery of 30 takes both invoices of 15,
    // and nothing was chosen there. So the tied set is read off the ORIGINAL pool —
    // which is where an unplaced twin still looks unplaced — and then narrowed to
    // the ones this pass left unattached.
    const attached = new Set(attach.map((b) => b.invoiceRecordId));
    const tied = attach
        .map((invoice) => ({
            chosen: invoice,
            passedOver: tiedRivals(invoice, offered).filter((o) => !attached.has(o.invoiceRecordId)),
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
 * outcome key plus the invoices it names.
 *
 * THE TIE-BREAK RIDES ALONG RATHER THAN REPLACING THE KEY, which is the whole
 * reason it is a qualifier. A delivery can attach three invoices of which one was
 * tie-broken, so a key saying `tie-break` would have to stop saying that three
 * were attached. `chosen` and `tiedWith` are therefore extra fields on whatever
 * outcome happened, and `describeTieBreak` is the second sentence they word.
 *
 * ONE GROUP IS NAMED, THE FIRST. Two independent ties on one delivery needs two
 * ordered items each billed twice at matching figures; the sentence's work is to
 * send a reader to the delivery's own page, which lists every attachment, so
 * naming the second there rather than here loses nothing a reader could act on.
 */
export function describeDeliveryPairings(plan, invoices) {
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
        const invoice = (invoices || []).find((b) => b.invoiceRecordId === plan.blocked);
        return {
            key: PAIRING.sharedOrder,
            invoiceIds: [invoice?.invoiceId].filter(Boolean),
            count: 1,
            ...broken,
        };
    }
    return { key: PAIRING.none, invoiceIds: [], count: 0, ...broken };
}

/**
 * DIRECTION 2 — recording an invoice: which delivery, if any, does it attach to?
 *
 * `arrivals` are the deliveries that brought any of the ordered items this invoice
 * charges for; anything else cannot contain it. `bills` is the same vendor-wide
 * pool direction 1 takes, so the rival clause sees what it sees there.
 *
 * THE TIE-BREAK IS SIMPLER ON THIS SIDE, BECAUSE THE INVOICE IS GIVEN. Direction 1
 * chooses which of two tied invoices the delivery gets; here the invoice is the one being
 * entered, so there is nothing to choose — it attaches, and the twin stays unplaced
 * exactly as it would have if the delivery had been recorded first and lost the
 * `Invoice ID` order. So the two directions can hand the delivery to DIFFERENT
 * members of a tied pair, and that is not the divergence the header forbids: they
 * agree on whether the pair is permissible, and which tied invoice got it is the thing
 * this feature has just finished arguing is unobservable.
 */
export function matchDeliveryToInvoice({ invoice, deliveries, invoices, agreedPrices } = {}) {
    const verdicts = (deliveries || []).map((delivery) => ({
        candidate: delivery,
        refusal: pairingRefusal({ invoice, delivery, invoices, agreedPrices }),
    }));
    const { key, candidate, count } = decide(verdicts);
    return {
        key,
        deliveryRecordId: key === PAIRING.matched ? candidate.deliveryRecordId : null,
        deliveryId: candidate?.deliveryId ?? null,
        count,
        // Only where something was actually attached: an invoice that matched nothing
        // passed over nothing either.
        tieBreak: key === PAIRING.matched && tiedRivals(invoice, invoices).length > 0,
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
// axis on a screen where the answer is usually `none` — most unpaired invoices have
// no candidate at all, which lib/deliveryInvoiceCandidates.js records with the date
// it was measured, and an invoice normally arrives BEFORE its material.
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
         * for it. It names the invoice because the recorder is checking it against a
         * packing list in their hand.
         *
         * IT CLAIMS ONLY WHAT THIS DIRECTION COMPUTED. The sentence used to end
         * `and nothing else could be its delivery`, which this side never
         * establishes: `planPairings` judges ONE delivery and asks only whether some
         * other unplaced INVOICE is in the way. Whether a second delivery also contains
         * the invoice is direction 2's question, and it has its own outcome for it
         * (`several`) — measured reachable, since two ordered items on this base were
         * each filled by two deliveries. Swapping the word for `delivery` would have
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
         * of these invoices charges ordered items no other invoice charges, so none of
         * them is a guess — the delivery simply covers more than one document, which
         * is what the n:1 link is for.
         */
        [PAIRING.severalAttached]: (f) => ({
            key: PAIRING.severalAttached,
            text:
                `${(f?.invoiceIds || []).join(" and ") || "Several invoices"} each invoice ordered ` +
                "items this delivery brought that no other invoice bills, so all of them are " +
                "attached. Correct that from this delivery's page after recording it.",
        }),
        /**
         * Two invoices nobody has placed charge the same ordered item, so which of
         * them this delivery answers is recorded nowhere. It names the one it
         * blocks on, because a rival is always visible to whoever is reading this
         * — see the module header for why that holds by construction.
         *
         * `nobody has attached` IS THE LOAD-BEARING PHRASE, and it is what the
         * capacity clause left this message able to say truthfully. While an invoice
         * ALREADY on the delivery counted as a rival, this sentence had to claim
         * nothing recorded which invoice the delivery answered — with one of them
         * attached, something did.
         */
        [PAIRING.sharedOrder]: (f) => ({
            key: PAIRING.sharedOrder,
            text:
                `${f?.invoiceIds?.[0] ?? "An invoice"} and another invoice nobody has attached ` +
                "both invoice an ordered item this delivery brought, so nothing records which of " +
                "them it answers. Attach the right one from this delivery's page after " +
                "recording it.",
        }),
    },

    banner: {
        /**
         * The invoice's own page after creation. It does not name the delivery: the
         * delivery section below states it once beneath its own heading, and one fact
         * rendered twice on one screen is what #166 took the `beyond order` tag off
         * `/invoices` for. What the banner adds is WHO decided, which nothing else
         * on the page says. The section used to mark it inside each box instead —
         * `— this invoice`, then `— attached to this invoice` from #231 — and #232
         * retired the marker with the move, which changes where this sentence points
         * and not whether it is true.
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
     * IT NAMES BOTH INVOICES IN THE PREVIEW AND NEITHER IN THE BANNER, which is the
     * asymmetry those two voices already have. The recorder has the packing list in
     * front of them, so the numbers are what they check against; the invoice's own
     * page is about ONE invoice and reaches this outcome through a query string, which
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
 * The second sentence, when a tie decided which invoice was attached — and null the
 * rest of the time, so a screen writes `describeTieBreak(...)?.text` beside
 * `describePairing(...)?.text` and renders one or two lines without a branch.
 *
 * THE CONDITION IS THE FIELD, NEVER A KEY. Direction 1 sets `tiedWith` and
 * direction 2 sets `tieBreak`, because one of them knows the invoice it passed over
 * and the other reaches this page through a query string that carries no names.
 * Either is enough to have happened; neither is an outcome.
 */
export function describeTieBreak(outcome, voice = "preview") {
    const broken = Boolean(outcome?.tieBreak) || (outcome?.tiedWith || []).length > 0;
    const builder = PAIRING_COPY.tieBreak[voice];
    return broken && builder ? builder(outcome) : null;
}

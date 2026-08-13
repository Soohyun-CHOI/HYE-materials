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
// pair and both directions call it; `matchBillToArrival` and `matchArrivalToBill`
// only differ in which side they iterate.
//
// WHAT IS DELIBERATELY NOT SHARED IS THE ARITY RULE, and it is worth naming because
// it looks like the divergence the paragraph above rules out. A delivery may carry
// several bills (the link is n:1) but the entry form has ONE invoice field, so with
// two candidate bills it attaches nothing and says so; an invoice contained in one
// shipment attaches to it whether or not that shipment already carries another
// bill for different ordered items. That asymmetry is the shape of the form rather
// than a disagreement about whether a pair is permissible — every pair either
// direction makes passes the same predicate.
//
// AND IT DOES NOT CONVERGE, WHICH IS THE COST AND IS RECORDED RATHER THAN HIDDEN.
// Two bills charging DIFFERENT ordered items that one shipment brought are each
// individually unambiguous and are not rivals, so nothing is wrong with either
// pairing — but direction 1 sees two candidates and attaches nothing, and the
// vendor emails its bills before the material arrives, so both are already on hand
// when the delivery is recorded and no later invoice ever fires direction 2. The
// pair stays for a person. It is not an exotic shape: a vendor shipping one load
// against two orders and billing them separately is ordinary.
//
// THE ONE FIELD IS STILL RIGHT HERE, AND THE REASON IS THE DOCUMENT RATHER THAN THE
// LINK. `LINK_COPY.field.label` is `Invoice number on the packing list`, and a
// packing list carries at most one number — a control taking several would ask a
// recorder to transcribe something the document in their hand does not have. The
// arity belongs to the DOCUMENT, not to `Invoices."Delivery"`, which is n:1 and
// says so. #210's own edit page is the surface that is about the delivery RECORD
// rather than about the packing list, and it is already plural: it lists every
// attached bill and offers the rest one at a time. So the manual path is not
// blocked — only the automatic one is, and only in this shape.
//
// WHAT IT WOULD TAKE, so that whoever picks it up is not re-deriving this. Attaching
// several means the screen showing several, because a preview that states what is
// about to be submitted cannot then submit more; that is a control, its copy, an
// `invoiceRecordIds` parameter on `createDeliveryAction`, the guard run per bill,
// and the offline pins on the single write. It also contradicts #231's own body,
// which specifies that several candidates attach nothing, so it is a scope decision
// rather than a correction.
//
// MEASURED 2026-08-13, and the measurement covers this shape rather than only the
// same-ordered-item one: no delivery on this base holds two unpaired contained
// bills, sharing an ordered item or not — 0 pairs either way. The PRECONDITION is
// here though, so this is one record away rather than hypothetical: 4 of 15
// deliveries brought more than one ordered item, and `HYE-DL-260804-10` has one of
// its two billed by `HYE-INV-260804-08` and the other billed by nobody. One
// invoice for `HYE-PO-20260804-14-001` produces it.
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
 * Only `sharedOrder` is ever spoken. The other four are the ordinary shape of a
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
    /** A billed unit price is not the one the order agreed. */
    priceDeparts: "price-departs",
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
 * ordered items. A price it cannot answer for FAILS CLOSED: an unmatched bill is
 * this feature's ordinary state, and a wrong pairing is not.
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
            return PAIRING_REFUSED.priceDeparts;
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
            chargesSameOrderedItem(bill, other)
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
 * A TRANSCRIBED NUMBER BEATS THE COMPUTATION, and it is folded in FIRST. The
 * recorder read it off the packing list in front of them, which is evidence about
 * the document; everything below is an inference from what two records happen to
 * name. So the caller attaches it through its own guard and passes it here as
 * `transcribed`, and it takes its room before any computed bill is judged.
 *
 * THE SEMANTIC CONSEQUENCE, NAMED BECAUSE IT IS A REAL CHANGE. Once the transcribed
 * bill is folded in as attached, a computed bill charging the SAME ordered item
 * stops meeting an unplaced rival and is judged on room alone — so where the
 * transcribed bill claims 10 of an arrival's 15, a computed bill charging 5 now
 * attaches, and before this it was refused. That is not a new standard: it is
 * exactly what already happened when the sharing bill had been attached on an
 * EARLIER run, and the override only makes "an earlier run" into "this one". The
 * conservative alternative — treating an attached bill as a rival again — is the
 * rule Soo corrected, and it would bring back a message that claims nothing records
 * which bill a shipment answers while something does.
 *
 * FOLDING AND DEDUCTING ARE ONE STEP, NEVER ONE WITHOUT THE OTHER. A decided bill
 * is added to the pool AS ATTACHED to this arrival, which does two things at once:
 * it stops being an unplaced rival, and its quantity starts counting against the
 * room. Doing only the first is the defect — the rival clause goes quiet and
 * nothing takes its place, so an arrival of 15 could take two bills of 15. Pinned
 * offline with a mutation that folds without deducting.
 *
 * THE ORDER IS PROVABLY IRRELEVANT AMONG COMPUTED BILLS, so nothing here chooses
 * one. A bill only attaches when no OTHER unplaced bill charges any ordered item it
 * charges, so any two that attach are disjoint, so they never draw on the same
 * room. Two that would compete charge a common ordered item, which makes them each
 * other's rival, which refuses both before room is ever consulted — the same reason
 * and the same posture as #219 refusing to pick between two unpaired bills. So
 * there is no second refusal for "competing candidates": the state is unreachable,
 * and a rule that can never fire is one this repo removes rather than writes.
 * `offline/delivery-invoice-match.mjs` asserts the property by reversing the pool
 * and requiring the same answer.
 */
export function planPairings({ arrival, bills, agreedPrices, transcribed = null } = {}) {
    if (!arrival) return { attach: [], refusals: new Map(), blocked: null };

    const held = arrival.deliveryRecordId || THIS_ARRIVAL;
    const asArrival = { ...arrival, deliveryRecordId: held };
    const attach = [];
    const refusals = new Map();

    // The pool as the rule sees it, with every decision so far standing as an
    // attachment on this arrival.
    let pool = (bills || []).map((bill) =>
        bill.invoiceRecordId && bill.invoiceRecordId === transcribed
            ? { ...bill, pairedDeliveryRecordId: held }
            : bill
    );

    for (const bill of bills || []) {
        if (!bill?.invoiceRecordId || bill.invoiceRecordId === transcribed) continue;
        const refusal = pairingRefusal({ bill, arrival: asArrival, bills: pool, agreedPrices });
        if (refusal) {
            refusals.set(bill.invoiceRecordId, refusal);
            continue;
        }
        attach.push(bill);
        pool = pool.map((other) =>
            other.invoiceRecordId === bill.invoiceRecordId
                ? { ...other, pairedDeliveryRecordId: held }
                : other
        );
    }

    // The one refusal worth reporting, on the same rule `decide` uses: it is only
    // news when it is why nothing was attached.
    const blocked =
        attach.length === 0
            ? [...refusals.entries()].find(([, key]) => key === PAIRING_REFUSED.sharedOrder)?.[0] ?? null
            : null;

    return { attach, refusals, blocked };
}

/**
 * What the delivery form previews and the action reports: `planPairings` as an
 * outcome key plus the bills it names.
 */
export function describeArrivalPairings(plan, bills) {
    const attached = plan?.attach || [];
    if (attached.length === 1) {
        return { key: PAIRING.matched, invoiceIds: [attached[0].invoiceId], count: 1 };
    }
    if (attached.length > 1) {
        return {
            key: PAIRING.severalAttached,
            invoiceIds: attached.map((b) => b.invoiceId),
            count: attached.length,
        };
    }
    if (plan?.blocked) {
        const bill = (bills || []).find((b) => b.invoiceRecordId === plan.blocked);
        return { key: PAIRING.sharedOrder, invoiceIds: [bill?.invoiceId].filter(Boolean), count: 1 };
    }
    return { key: PAIRING.none, invoiceIds: [], count: 0 };
}

/**
 * DIRECTION 2 — recording a bill: which arrival, if any, does it attach to?
 *
 * `arrivals` are the shipments that brought any of the ordered items this bill
 * charges for; anything else cannot contain it. `bills` is the same vendor-wide
 * pool direction 1 takes, so the rival clause sees what it sees there.
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
         * for it. It names the bill because the control right below holds it and the
         * recorder is checking it against a packing list in their hand.
         */
        /**
         * IT NAMES A CONTROL THE READER CAN ACTUALLY REACH, which is #206's rule
         * read from the other side: that issue refuses to name an action a reader
         * cannot take, and this one has to name the one they can. The invoice field
         * sits behind a checkbox now, so `Change it` would point at a control that
         * is not on the screen — the correction is to say how to open it.
         */
        [PAIRING.matched]: (f) => ({
            key: PAIRING.matched,
            text:
                `${f?.invoiceIds?.[0] ?? "One invoice"} bills ordered items this delivery brought ` +
                "and nothing else could be its shipment, so it is attached. If the packing list " +
                "names a different number, tick the box above and enter it.",
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
                "attached. If the packing list names a number, tick the box above and enter it.",
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
                "them it answers. Tick the box above and enter the number on the packing list.",
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

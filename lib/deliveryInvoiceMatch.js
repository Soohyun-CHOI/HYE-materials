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
// direction makes passes the same predicate. Unreachable on this base today:
// measured 2026-08-13, no delivery has more than one candidate bill.
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

/** The outcome keys both directions return. */
export const PAIRING = {
    matched: "matched",
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

/**
 * DIRECTION 1 — recording an arrival: which bill, if any, does it attach?
 *
 * `bills` is every invoice from this arrival's vendor that the caller may see,
 * which lib/deliveryInvoiceCandidates.js already assembles for the dropdown. Vendor
 * is the whole narrowing and deliberately not the Job, for #210's reason: an invoice
 * can bill orders on more than one job.
 */
export function matchBillToArrival({ arrival, bills, agreedPrices } = {}) {
    if (!arrival) return { key: PAIRING.none, invoiceRecordId: null, invoiceId: null, count: 0 };
    const verdicts = (bills || []).map((bill) => ({
        candidate: bill,
        refusal: pairingRefusal({ bill, arrival, bills, agreedPrices }),
    }));
    const { key, candidate, count } = decide(verdicts);
    return {
        key,
        invoiceRecordId: key === PAIRING.matched ? candidate.invoiceRecordId : null,
        invoiceId: candidate?.invoiceId ?? null,
        count,
    };
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
        [PAIRING.matched]: (f) => ({
            key: PAIRING.matched,
            text:
                `${f?.invoiceId ?? "One invoice"} is the only invoice billing ordered items this ` +
                "delivery brought, so it is attached. Change it if the packing list names another.",
        }),
        /**
         * Nothing attached, and the reason. Two bills both fit, and which one
         * describes this shipment is not recorded anywhere — so picking either would
         * be a coin flip written into a field that is read as a fact.
         */
        [PAIRING.several]: (f) => ({
            key: PAIRING.several,
            text:
                `${f?.count ?? "Several"} invoices bill ordered items this delivery brought, and ` +
                "nothing records which of them describes it. Pick the number on the packing list.",
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
                `${f?.invoiceId ?? "An invoice"} and another invoice nobody has attached both ` +
                "bill an ordered item this delivery brought, so nothing records which of them it " +
                "answers. Pick the number on the packing list.",
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

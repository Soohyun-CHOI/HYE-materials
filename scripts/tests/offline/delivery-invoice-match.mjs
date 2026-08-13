// The COMPUTED pairing (#231) — the containment rule, the price gate, the rival
// clause, and the two directions agreeing.
//
// WHY THIS TIER CARRIES MORE THAN ITS SHARE HERE. Only one of the states this rule
// can reach is on the live base, so a browser run can show it working and cannot
// show it declining:
//
//   matched      — 6 of 13 unpaired invoices, reachable and verified in a browser
//                  and through the real Server Action.
//   no-room      — reachable: `HYE-INV-260804-04` against `HYE-DL-260804-06`,
//                  which brought 15 of `166-DEMO Coupling` and whose attached
//                  `HYE-INV-260804-05` charges all 15. Silent, so what a browser
//                  shows there is nothing.
//   shared-order — NOT reachable. Every ordered item on this base carrying two
//                  bills has one of them already attached, so the capacity clause
//                  answers first. Reachable only with the hand-made pairings
//                  removed, which is a simulation rather than a state.
//   several      — NOT reachable. Measured 2026-08-13: no delivery on this base
//                  has more than one candidate bill, so the whole branch exists
//                  only here.
//   price-departs — NOT reachable. One invoice departs from an agreed price
//                  (`HYE-INV-260716-02`, 32.00 billed against 33.89 ordered) and
//                  containment already excludes it, so the gate removes 0 of 15
//                  pairs on live data and changes no verdict there.
//
// So the price gate, `several` and `shared-order` are asserted here or nowhere,
// and each is shown to be capable of failing rather than merely present — see the
// mutation notes on the individual sections.
//
// THE ONE THING MOST WORTH BREAKING IS THE LINE BETWEEN CAPACITY AND A QUANTITY
// MATCH. `roomOnOrderedItem` reads quantities, and the rule this feature must not
// break is that quantities never decide whether a bill is a shipment's. The
// section "capacity is not the quantity match this rule refuses to make" is what
// separates them, and its first check is the whole feature: 13 billed against 10
// delivered pairs, so #210's mismatch marker still has something to mark.
//
// WHAT A PASS DOES NOT PROVE. That either caller passes the right inputs. The form
// builds its arrival from `planDelivery`'s rows and the action builds its bill from
// the submitted items; whether those are the right rows is behavior, measured in a
// browser and in the PR.

import {
    PAIRING,
    PAIRING_COPY,
    PAIRING_REFUSED,
    billFromInvoiceOption,
    chargesSameOrderedItem,
    describePairing,
    fitRefusal,
    matchArrivalToBill,
    describeArrivalPairings,
    planPairings,
    orderedItemsBilled,
    roomOnOrderedItem,
    orderedItemsDelivered,
    pairingRefusal,
} from "../../../lib/deliveryInvoiceMatch.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The computed invoice-to-delivery pairing (#231)";

// One agreed price per ordered item, the shape both callers build.
const PRICES = new Map([
    ["recPOI_A", 10],
    ["recPOI_B", 25],
    ["recPOI_C", 4.5],
]);

/**
 * A bill, as lib/deliveryInvoiceMatch.js reads one. `charges` entries are
 * `[orderedItem, unitPrice]` or `[orderedItem, unitPrice, qty]`; the quantity only
 * matters where the bill is one ALREADY on an arrival, since that is the only
 * thing it is ever read for.
 */
const bill = ({ id = "recINV1", invoiceId = "HYE-INV-260804-07", charges = [["recPOI_A", 10]], paired = null } = {}) => ({
    invoiceRecordId: id,
    invoiceId,
    orderedItems: charges.map(([poItemRecordId, unitPrice, qty = 1]) => ({
        poItemRecordId,
        unitPrice,
        qty,
    })),
    pairedDeliveryRecordId: paired,
});

/**
 * An arrival, likewise. `brought` takes bare ids for the cases where only the SET
 * matters, or `[id, qty]` pairs where the capacity clause is what is under test.
 * The default quantity is deliberately larger than any bill below, so a check that
 * did not mean to exercise capacity does not exercise it by accident.
 */
const arrival = ({ id = "recDL1", deliveryId = "HYE-DL-260804-08", brought = ["recPOI_A"] } = {}) => ({
    deliveryRecordId: id,
    deliveryId,
    orderedItems: brought.map((b) =>
        Array.isArray(b) ? { poItemRecordId: b[0], qty: b[1] } : { poItemRecordId: b, qty: 1000 }
    ),
});

/**
 * Direction 1 as one call, since #231 made it a PLAN rather than a single answer.
 * Every check that used to ask for its outcome key is asking the same question of
 * the same rule; what changed is that the rule may now name several bills.
 */
const outcome1 = (args) => {
    const plan = planPairings(args);
    return {
        ...describeArrivalPairings(plan, args.bills),
        invoiceRecordId: plan.attach.length === 1 ? plan.attach[0].invoiceRecordId : null,
        attached: plan.attach.map((b) => b.invoiceRecordId),
    };
};

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("containment — a bill sits inside a shipment, or it is not its bill:");
    check(
        "every ordered item billed was brought: fits",
        fitRefusal(bill({ charges: [["recPOI_A", 10]] }), arrival({ brought: ["recPOI_A", "recPOI_B"] }), PRICES),
        null
    );
    check(
        "the shipment brought MORE than the bill charges: still fits (n:1)",
        fitRefusal(bill({ charges: [["recPOI_A", 10]] }), arrival({ brought: ["recPOI_A", "recPOI_B"] }), PRICES),
        null
    );
    check(
        "an ordered item billed that the shipment did not bring: refused",
        fitRefusal(
            bill({ charges: [["recPOI_A", 10], ["recPOI_B", 25]] }),
            arrival({ brought: ["recPOI_A"] }),
            PRICES
        ),
        PAIRING_REFUSED.notContained
    );

    // THE VACUOUS-SUBSET TRAP, which is why noOrderedItem is tested FIRST in the
    // production function. Mutation: delete that clause and this check fails while
    // every containment check above still passes — the empty set is contained in
    // everything, so a free-text-only invoice would attach to whatever shipment was
    // recorded next. Two such invoices sit on this base.
    log("");
    log("the empty set is refused explicitly, never vacuously contained:");
    check(
        "a bill charging no ordered item at all",
        fitRefusal(bill({ charges: [] }), arrival(), PRICES),
        PAIRING_REFUSED.noOrderedItem
    );
    check(
        "  and it is refused against an EMPTY shipment too, not just a full one",
        fitRefusal(bill({ charges: [] }), arrival({ brought: [] }), PRICES),
        PAIRING_REFUSED.noOrderedItem
    );
    assert(
        "  so it never reaches `matched` from either direction",
        outcome1({ arrival: arrival(), bills: [bill({ charges: [] })], agreedPrices: PRICES }).key !==
            PAIRING.matched &&
            matchArrivalToBill({
                bill: bill({ charges: [] }),
                arrivals: [arrival()],
                bills: [],
                agreedPrices: PRICES,
            }).key !== PAIRING.matched
    );
    // A row with no `PO Item` is skipped rather than refusing the whole bill — the
    // same exclusion countsTowardStatus makes, and reachable while #96's free-text
    // option is only hidden.
    check(
        "a MIXED bill — one free-text row, one ordered item — is judged on the ordered item",
        fitRefusal(
            { ...bill({ charges: [["recPOI_A", 10]] }), orderedItems: [{ poItemRecordId: null, unitPrice: 40 }, { poItemRecordId: "recPOI_A", unitPrice: 10 }] },
            arrival({ brought: ["recPOI_A"] }),
            PRICES
        ),
        null
    );

    // -----------------------------------------------------------------------
    // Mutation: replace checkUnitPriceVariance(...) with `false` in fitRefusal and
    // the three checks below fail while every containment check keeps passing.
    // NOT reachable on the live base, so this section is the only thing standing
    // between the gate and a silent removal.
    log("");
    log("unit price is agreed on the order, so a bill departing from it is not a candidate:");
    check(
        "billed at the agreed price: fits",
        fitRefusal(bill({ charges: [["recPOI_A", 10]] }), arrival(), PRICES),
        null
    );
    check(
        "billed above the agreed price: refused",
        fitRefusal(bill({ charges: [["recPOI_A", 12.5]] }), arrival(), PRICES),
        PAIRING_REFUSED.priceDeparts
    );
    check(
        "billed below it: refused just the same — the test is a difference, not a direction",
        fitRefusal(bill({ charges: [["recPOI_A", 7]] }), arrival(), PRICES),
        PAIRING_REFUSED.priceDeparts
    );
    // The tolerance is lib/variance.js's, not a second one written here. A cent of
    // float noise is absorbed; two cents is a different price.
    check(
        "a cent of rounding noise is absorbed (checkUnitPriceVariance's own tolerance)",
        fitRefusal(bill({ charges: [["recPOI_A", 10.01]] }), arrival(), PRICES),
        null
    );
    check(
        "two cents is not",
        fitRefusal(bill({ charges: [["recPOI_A", 10.02]] }), arrival(), PRICES),
        PAIRING_REFUSED.priceDeparts
    );
    check(
        "an agreed price the caller cannot answer for FAILS CLOSED",
        fitRefusal(bill({ charges: [["recPOI_A", 10]] }), arrival(), new Map()),
        PAIRING_REFUSED.priceDeparts
    );

    // -----------------------------------------------------------------------
    // The property the whole feature rests on: a vendor billing more than it
    // shipped must still pair, or the mismatch marker #210 built would never fire.
    // Mutation: add any quantity comparison to fitRefusal and this fails.
    log("");
    log("quantity is NOT part of the test — the bill that over-charges still pairs:");
    assert(
        "13 billed against a shipment of 10 pairs (HYE-INV-260804-07's real shape)",
        outcome1({
            arrival: arrival({ brought: ["recPOI_A"] }),
            bills: [bill({ charges: [["recPOI_A", 10]] })],
            agreedPrices: PRICES,
        }).key === PAIRING.matched
    );
    assert(
        "  and nothing in the module reads a quantity at all",
        !/\bqty\b|quantity[A-Z]/.test(
            [orderedItemsBilled, orderedItemsDelivered, fitRefusal, pairingRefusal].map(String).join("\n")
        )
    );

    // -----------------------------------------------------------------------
    log("");
    log("a bill some shipment already holds is not a candidate:");
    check(
        "already paired elsewhere",
        fitRefusal(bill({ paired: "recDL9" }), arrival(), PRICES),
        PAIRING_REFUSED.alreadyPaired
    );
    check(
        "already paired to THIS one — still not a candidate, there is nothing to compute",
        fitRefusal(bill({ paired: "recDL1" }), arrival({ id: "recDL1" }), PRICES),
        PAIRING_REFUSED.alreadyPaired
    );

    // -----------------------------------------------------------------------
    // #166's scenario D, which is the case this clause exists for: one ordered item
    // of 30, two bills of 15, one shipment of 15. Each bill sees exactly one
    // candidate, so "several candidates" never fires — the ambiguity is on the
    // other side of the relation. Mutation: drop the rival clause from
    // pairingRefusal and both bills attach to one shipment, which is the answer
    // #210 established is wrong.
    log("");
    log("the rival clause — two bills charging one ordered item on one shipment:");
    const older = bill({ id: "recINV_OLD", invoiceId: "HYE-INV-260804-04", charges: [["recPOI_A", 10]] });
    const newer = bill({ id: "recINV_NEW", invoiceId: "HYE-INV-260804-05", charges: [["recPOI_A", 10]] });
    const shipment = arrival({ id: "recDL_C", brought: ["recPOI_A"] });

    assert(
        "each bill fits the shipment on its own",
        fitRefusal(older, shipment, PRICES) === null && fitRefusal(newer, shipment, PRICES) === null
    );
    check(
        "but with both in the pool, the older is refused",
        pairingRefusal({ bill: older, arrival: shipment, bills: [older, newer], agreedPrices: PRICES }),
        PAIRING_REFUSED.sharedOrder
    );
    check(
        "and so is the newer — neither wins, because nothing records which",
        pairingRefusal({ bill: newer, arrival: shipment, bills: [older, newer], agreedPrices: PRICES }),
        PAIRING_REFUSED.sharedOrder
    );
    check(
        "recording the arrival attaches nothing and says why",
        outcome1({ arrival: shipment, bills: [older, newer], agreedPrices: PRICES }).key,
        PAIRING.sharedOrder
    );

    // A bill ALREADY ON the shipment is answered by capacity instead, which is the
    // clause that replaced half of this one — see the next section. Here it is only
    // asserted that it is no longer read as an ambiguity.
    const heldElsewhere = bill({ id: "recINV_X", charges: [["recPOI_A", 10]], paired: "recDL_OTHER" });
    check(
        "a rival recorded on ANOTHER shipment does not block — it has been placed",
        pairingRefusal({ bill: older, arrival: shipment, bills: [older, heldElsewhere], agreedPrices: PRICES }),
        null
    );
    check(
        "a bill charging a DIFFERENT ordered item is no rival at all",
        pairingRefusal({
            bill: older,
            arrival: arrival({ id: "recDL_C", brought: ["recPOI_A", "recPOI_B"] }),
            bills: [older, bill({ id: "recINV_Z", charges: [["recPOI_B", 25]] })],
            agreedPrices: PRICES,
        }),
        null
    );

    // -----------------------------------------------------------------------
    // CAPACITY, WHICH TOOK HALF OF `shared-order`. A bill already on the shipment
    // charging everything it brought of an ordered item does not make a second bill
    // ambiguous — it leaves nowhere for it to go. Mutation: delete the noRoom clause
    // in pairingRefusal and the first two fail (the second reverts to shared-order,
    // which would be a false sentence: something DOES record which bill this
    // shipment answers).
    log("");
    log("capacity — what a bill already on the shipment has claimed:");
    const brought15 = arrival({ id: "recDL_R", brought: [["recPOI_A", 15]] });
    const claimsAll = bill({ id: "recINV_FULL", charges: [["recPOI_A", 10, 15]], paired: "recDL_R" });
    const claimsSome = bill({ id: "recINV_PART", charges: [["recPOI_A", 10, 10]], paired: "recDL_R" });
    const wants = bill({ id: "recINV_WANT", charges: [["recPOI_A", 10, 15]] });

    check(
        "15 arrived and a bill on it claims 15: no room",
        pairingRefusal({ bill: wants, arrival: brought15, bills: [wants, claimsAll], agreedPrices: PRICES }),
        PAIRING_REFUSED.noRoom
    );
    check(
        "15 arrived and a bill on it claims 10: 5 left, so it is still a candidate",
        pairingRefusal({ bill: wants, arrival: brought15, bills: [wants, claimsSome], agreedPrices: PRICES }),
        null
    );
    check(
        "  even though it charges 15 against 5 of room — capacity is `> 0`, never `>= billed`",
        roomOnOrderedItem({
            arrival: brought15,
            poItemRecordId: "recPOI_A",
            bills: [wants, claimsSome],
            excluding: "recINV_WANT",
        }),
        5
    );
    check(
        "a bill on ANOTHER shipment claims nothing here",
        roomOnOrderedItem({
            arrival: brought15,
            poItemRecordId: "recPOI_A",
            bills: [bill({ id: "recINV_Y", charges: [["recPOI_A", 10, 15]], paired: "recDL_OTHER" })],
        }),
        15
    );
    // Two slices of one ordered item is #162's own shape — the within-order row and
    // the over-delivery row — and both are quantity that arrived.
    check(
        "an over-delivered arrival counts BOTH its rows as capacity",
        roomOnOrderedItem({
            arrival: arrival({ id: "recDL_S", brought: [["recPOI_A", 10], ["recPOI_A", 3]] }),
            poItemRecordId: "recPOI_A",
            bills: [],
        }),
        13
    );
    // Mutation: drop the `if (!held) return brought;` guard and this fails, because
    // an unplaced bill's null would equal the arrival's null and read as claimed.
    check(
        "on the entry path nothing is claimed, since no bill can be on a delivery that does not exist",
        roomOnOrderedItem({
            arrival: { deliveryRecordId: null, orderedItems: [{ poItemRecordId: "recPOI_A", qty: 15 }] },
            poItemRecordId: "recPOI_A",
            bills: [bill({ id: "recINV_U", charges: [["recPOI_A", 10, 15]] })],
        }),
        15
    );

    // THE LINE BETWEEN CAPACITY AND THE FORBIDDEN QUANTITY MATCH, asserted rather
    // than argued. Mutation: change `<= 0` to `< billed` in pairingRefusal and the
    // first of these fails — which is the whole feature breaking, since that bill
    // is exactly what #210's mismatch marker exists to surface.
    log("");
    log("capacity is not the quantity match this rule refuses to make:");
    const brought10 = arrival({ id: "recDL_M", brought: [["recPOI_A", 10]] });
    const bills13 = bill({ id: "recINV_13", charges: [["recPOI_A", 10, 13]] });
    check(
        "13 billed against 10 delivered, nothing else attached: PAIRS",
        pairingRefusal({ bill: bills13, arrival: brought10, bills: [bills13], agreedPrices: PRICES }),
        null
    );
    check(
        "13 billed against 10 delivered, with 4 already claimed: STILL pairs — 6 of room",
        pairingRefusal({
            bill: bills13,
            arrival: brought10,
            bills: [bills13, bill({ id: "recINV_4", charges: [["recPOI_A", 10, 4]], paired: "recDL_M" })],
            agreedPrices: PRICES,
        }),
        null
    );
    check(
        "13 billed against 10 delivered, all 10 already claimed: no room",
        pairingRefusal({
            bill: bills13,
            arrival: brought10,
            bills: [bills13, bill({ id: "recINV_10", charges: [["recPOI_A", 10, 10]], paired: "recDL_M" })],
            agreedPrices: PRICES,
        }),
        PAIRING_REFUSED.noRoom
    );
    assert(
        "  and `no-room` is never spoken — it is arithmetic, so the outcome is silence",
        matchArrivalToBill({
            bill: bills13,
            arrivals: [brought10],
            bills: [bills13, bill({ id: "recINV_10", charges: [["recPOI_A", 10, 10]], paired: "recDL_M" })],
            agreedPrices: PRICES,
        }).key === PAIRING.none && !PAIRING_COPY.preview[PAIRING_REFUSED.noRoom]
    );

    // -----------------------------------------------------------------------
    // THE PROPERTY THE TWO DIRECTIONS EXIST TO SHARE. If these disagreed, whether a
    // pairing got made would depend on which document somebody typed in first.
    log("");
    log("both directions reach the same verdict on the same pair:");
    const cases = [
        ["a plain fit", [bill()], [arrival()]],
        ["the rival pair", [older, newer], [shipment]],
        ["a rival recorded elsewhere", [older, heldElsewhere], [shipment]],
        ["a price departure", [bill({ charges: [["recPOI_A", 99]] })], [arrival()]],
        ["nothing billed", [bill({ charges: [] })], [arrival()]],
    ];
    for (const [name, pool, arrivals] of cases) {
        const subject = pool[0];
        const forward = pairingRefusal({
            bill: subject,
            arrival: arrivals[0],
            bills: pool,
            agreedPrices: PRICES,
        });
        const backward = pairingRefusal({
            bill: subject,
            arrival: arrivals[0],
            bills: pool,
            agreedPrices: PRICES,
        });
        const viaDirection1 = outcome1({ arrival: arrivals[0], bills: pool, agreedPrices: PRICES });
        const viaDirection2 = matchArrivalToBill({
            bill: subject,
            arrivals,
            bills: pool,
            agreedPrices: PRICES,
        });
        assert(`  ${name}: one predicate, one answer`, forward === backward);
        // The pair is made by direction 2 exactly when the predicate admits it, and
        // by direction 1 exactly when it admits it AND no second bill also fits.
        assert(
            `  ${name}: direction 2 attaches iff the predicate admits`,
            (viaDirection2.key === PAIRING.matched) === (forward === null)
        );
        assert(
            `  ${name}: direction 1 never attaches a pair the predicate refuses`,
            viaDirection1.key !== PAIRING.matched ||
                pairingRefusal({
                    bill: pool.find((b) => b.invoiceRecordId === viaDirection1.invoiceRecordId),
                    arrival: arrivals[0],
                    bills: pool,
                    agreedPrices: PRICES,
                }) === null
        );
    }

    // The one thing that IS asymmetric, and it is the form's arity rather than the
    // rule's judgment. Two bills for DIFFERENT ordered items both belong to one
    // shipment (n:1) — direction 2 attaches each, direction 1 has one field and
    // refuses to choose.
    //
    // PINNED BECAUSE IT DOES NOT CONVERGE, not because it is tidy. The bills arrive
    // before the material, so both are on hand when the delivery is recorded and no
    // later invoice fires direction 2; the pair stays for a person. These checks are
    // what stop that being rediscovered as a bug — the state is deliberate, its cost
    // is in lib/deliveryInvoiceMatch.js's header, and a change of mind has to change
    // them on purpose. Not reachable on this base: measured 2026-08-13, no delivery
    // holds two unpaired contained bills, sharing an ordered item or not.
    log("");
    log("the arity asymmetry, which is the form's and not the rule's:");
    const twoItems = arrival({ id: "recDL_T", brought: ["recPOI_A", "recPOI_B"] });
    const billA = bill({ id: "recINV_A", invoiceId: "HYE-INV-A", charges: [["recPOI_A", 10]] });
    const billB = bill({ id: "recINV_B", invoiceId: "HYE-INV-B", charges: [["recPOI_B", 25]] });
    check(
        "recording the arrival attaches BOTH — the form's one field is gone",
        outcome1({ arrival: twoItems, bills: [billA, billB], agreedPrices: PRICES }).key,
        PAIRING.severalAttached
    );
    check(
        "recording either bill: one candidate shipment, so it attaches",
        matchArrivalToBill({ bill: billA, arrivals: [twoItems], bills: [billA, billB], agreedPrices: PRICES }).key,
        PAIRING.matched
    );
    assert(
        "  and the predicate admits both, so the two directions have not disagreed about a PAIR",
        pairingRefusal({ bill: billA, arrival: twoItems, bills: [billA, billB], agreedPrices: PRICES }) === null &&
            pairingRefusal({ bill: billB, arrival: twoItems, bills: [billA, billB], agreedPrices: PRICES }) === null
    );
    // NEITHER IS THE OTHER'S RIVAL, which is what makes this `several` rather than
    // `shared-order` and is the whole reason it does not converge: nothing is
    // ambiguous, so nothing will ever become less so.
    assert(
        "  neither blocks the other — they charge different ordered items",
        !chargesSameOrderedItem(billA, billB)
    );
    assert(
        "  and it names both, so nothing is silently written or silently dropped",
        // The SET, not the sequence. The action writes one link per bill and the
        // order they go out in is not a fact about anything, so pinning it here
        // would make the order-reversal property below fail on this check alone.
        outcome1({ arrival: twoItems, bills: [billA, billB], agreedPrices: PRICES })
            .attached.slice().sort().join() === "recINV_A,recINV_B"
    );
    assert(
        "  and direction 2 attaches BOTH, one at a time, which is the state a person is left to reproduce",
        matchArrivalToBill({ bill: billA, arrivals: [twoItems], bills: [billA, billB], agreedPrices: PRICES })
            .deliveryRecordId === "recDL_T" &&
            matchArrivalToBill({ bill: billB, arrivals: [twoItems], bills: [billA, billB], agreedPrices: PRICES })
                .deliveryRecordId === "recDL_T"
    );

    // -----------------------------------------------------------------------
    log("");
    log("direction 2 — several shipments could have brought it:");
    check(
        "two shipments each brought everything billed: nothing attached",
        matchArrivalToBill({
            bill: bill(),
            arrivals: [arrival({ id: "recDL1" }), arrival({ id: "recDL2" })],
            bills: [bill()],
            agreedPrices: PRICES,
        }).key,
        PAIRING.several
    );
    check(
        "no shipment brought it: nothing attached and nothing said",
        matchArrivalToBill({
            bill: bill({ charges: [["recPOI_C", 4.5]] }),
            arrivals: [arrival({ brought: ["recPOI_A"] })],
            bills: [],
            agreedPrices: PRICES,
        }).key,
        PAIRING.none
    );
    check(
        "no shipment at all: the same, rather than an error",
        matchArrivalToBill({ bill: bill(), arrivals: [], bills: [], agreedPrices: PRICES }).key,
        PAIRING.none
    );

    // -----------------------------------------------------------------------
    // On the entry path the delivery does not exist yet, so `deliveryRecordId` is
    // null — #210's own reading of the same null. The rule needs no clause for it,
    // and these three are what say so: the same three answers come out with a null
    // record id as with a real one.
    const beingRecorded = {
        deliveryRecordId: null,
        orderedItems: [{ poItemRecordId: "recPOI_A", qty: 15 }],
    };
    log("");
    log("the entry path, where the shipment has no record id yet:");
    check(
        "a lone bill fits, exactly as it would against a saved shipment",
        pairingRefusal({ bill: bill(), arrival: beingRecorded, bills: [bill()], agreedPrices: PRICES }),
        null
    );
    check(
        "  an unplaced rival blocks there too",
        pairingRefusal({ bill: older, arrival: beingRecorded, bills: [older, newer], agreedPrices: PRICES }),
        PAIRING_REFUSED.sharedOrder
    );
    // The one a `null === null` comparison would get wrong: a rival on some OTHER
    // shipment must not read as one on this not-yet-existing shipment.
    check(
        "  and a rival placed on another shipment does not",
        pairingRefusal({
            bill: older,
            arrival: beingRecorded,
            bills: [older, heldElsewhere],
            agreedPrices: PRICES,
        }),
        null
    );

    // -----------------------------------------------------------------------
    log("");
    log("the seam between the dropdown's vocabulary and this module's:");
    const asBill = billFromInvoiceOption({
        invoiceRecordId: "recINV1",
        invoiceId: "HYE-INV-260804-07",
        linkedDeliveryRecordId: "recDL9",
        orderedItems: [{ poItemRecordId: "recPOI_A", unitPrice: 10 }],
    });
    check("linkedDeliveryRecordId becomes pairedDeliveryRecordId", asBill.pairedDeliveryRecordId, "recDL9");
    check(
        "  and the converted option is refused as already paired, which is what that field is for",
        fitRefusal(asBill, arrival(), PRICES),
        PAIRING_REFUSED.alreadyPaired
    );
    check(
        "an option with no ordered items converts to a bill with none, not to undefined",
        orderedItemsBilled(billFromInvoiceOption({ invoiceRecordId: "recX" })).length,
        0
    );

    // -----------------------------------------------------------------------
    log("");
    log("copy — one voice per outcome, and silence for `none`:");
    // ONE VOICE PER DIRECTION THAT CAN REACH THE OUTCOME, which is why this is not
    // "every key has both". `several` is the invoice side's alone — an arrival can
    // no longer have too many candidates, it attaches them — and `several-attached`
    // is the delivery side's, since one invoice is never attached to two shipments.
    assert(
        "the outcomes both directions reach are worded in both voices",
        [PAIRING.matched, PAIRING.sharedOrder].every(
            (key) => PAIRING_COPY.preview[key] && PAIRING_COPY.banner[key]
        )
    );
    assert(
        "  `several-attached` is the delivery side's alone",
        Boolean(PAIRING_COPY.preview[PAIRING.severalAttached]) &&
            !PAIRING_COPY.banner[PAIRING.severalAttached]
    );
    assert(
        "  and `several` is the invoice side's alone",
        Boolean(PAIRING_COPY.banner[PAIRING.several]) && !PAIRING_COPY.preview[PAIRING.several]
    );
    check(
        "`none` has no preview voice",
        describePairing({ key: PAIRING.none }, "preview"),
        null
    );
    check("`none` has no banner voice either", describePairing({ key: PAIRING.none }, "banner"), null);
    check(
        "an unknown key words nothing rather than throwing — the query string is not trusted",
        describePairing({ key: "../../etc/passwd" }, "banner"),
        null
    );
    check("a missing outcome words nothing", describePairing(undefined, "banner"), null);
    check("an unknown voice words nothing", describePairing({ key: PAIRING.matched }, "nowhere"), null);

    const spoken = [PAIRING.matched, PAIRING.severalAttached, PAIRING.several, PAIRING.sharedOrder]
        .flatMap((key) => [
            describePairing({ key, invoiceIds: ["HYE-INV-1", "HYE-INV-2"], count: 2 }, "preview"),
            describePairing({ key, invoiceIds: ["HYE-INV-1", "HYE-INV-2"], count: 2 }, "banner"),
        ])
        .filter(Boolean)
        .map((m) => m.text);
    // #166's vocabulary, enforced here as well as in offline/delivery-status.mjs —
    // this module's copy is new and outside that file's reach.
    for (const [word, why] of [
        ["arriv", "`delivered`, never `arrived`"],
        ["over-billed", "facts, never verdicts"],
        ["short-shipped", "facts, never verdicts"],
        ["missing", "facts, never verdicts"],
    ]) {
        assert(
            `  no message contains "${word}" — ${why}`,
            !spoken.some((t) => t.toLowerCase().includes(word))
        );
    }
    // `line` names a Lines row under a Job. offline/line-vocabulary.mjs bars the
    // bare word from every *_COPY object under lib/, so this is the same rule
    // exercised rather than inspected.
    assert(
        "  no message says `line`",
        !spoken.some((t) => /\bline\b/i.test(t))
    );
    assert(
        "  every message ends in a full stop",
        spoken.every((t) => t.endsWith("."))
    );

    // -----------------------------------------------------------------------
    log("");
    // -----------------------------------------------------------------------
    // FOLDING AND DEDUCTING ARE ONE STEP. A decided bill joins the pool AS
    // ATTACHED to this arrival, which stops it being an unplaced rival AND starts
    // its quantity counting against the room. Doing only the first is the defect:
    // the rival clause goes quiet and nothing replaces it.
    log("");
    log("several attached in one run, and the room each one takes:");
    const twoBrought = arrival({ id: "recDL_F", brought: [["recPOI_A", 15], ["recPOI_B", 10]] });
    const onA = bill({ id: "recINV_A2", invoiceId: "HYE-INV-A2", charges: [["recPOI_A", 10, 15]] });
    const onB = bill({ id: "recINV_B2", invoiceId: "HYE-INV-B2", charges: [["recPOI_B", 25, 10]] });
    check(
        "two bills on different ordered items: both attached",
        planPairings({ arrival: twoBrought, bills: [onA, onB], agreedPrices: PRICES }).attach.length,
        2
    );

    // THE DEFECT, IF FOLDING EVER RAN WITHOUT DEDUCTING. Two bills charging the
    // SAME ordered item are each other's rival, so both are refused and 15 arrived
    // can never take 30 billed — the rival clause is what stops it, not the room.
    // Mutation: drop the fold (leave the pool untouched after a decision) and this
    // stays passing, which is why the transcribed case below is the one that bites.
    const sameItemA = bill({ id: "recINV_S1", invoiceId: "HYE-INV-S1", charges: [["recPOI_A", 10, 15]] });
    const sameItemB = bill({ id: "recINV_S2", invoiceId: "HYE-INV-S2", charges: [["recPOI_A", 10, 15]] });
    const brought15b = arrival({ id: "recDL_G", brought: [["recPOI_A", 15]] });
    check(
        "two bills on the SAME ordered item: neither attached, so 15 never takes 30",
        planPairings({ arrival: brought15b, bills: [sameItemA, sameItemB], agreedPrices: PRICES })
            .attach.length,
        0
    );

    // Two bills that each charge PART of one ordered item are still rivals: nothing
    // records which of them this shipment answers, and "they would both fit" is not
    // an answer to that question.
    const partial = bill({ id: "recINV_S3", invoiceId: "HYE-INV-S3", charges: [["recPOI_A", 10, 10]] });
    const wantsFive = bill({ id: "recINV_S4", invoiceId: "HYE-INV-S4", charges: [["recPOI_A", 10, 5]] });
    check(
        "10 and 5 against an arrival of 15: neither attached, because neither is recorded",
        planPairings({ arrival: brought15b, bills: [partial, wantsFive], agreedPrices: PRICES })
            .attach.length,
        0
    );

    // THE DISJOINTNESS THE ONE-PASS SIMPLIFICATION RESTS ON. planPairings folds no
    // decision back into the pool, which is only safe because two bills that attach
    // never charge a common ordered item — so neither can be the other's rival and
    // neither eats the other's room. Asserted rather than assumed: if an override
    // ever returns, this is what stops the fold being forgotten with it.
    for (const [name, pool, arr] of [
        ["two disjoint bills", [onA, onB], twoBrought],
        ["two on one ordered item", [sameItemA, sameItemB], brought15b],
    ]) {
        const attached = planPairings({ arrival: arr, bills: pool, agreedPrices: PRICES }).attach;
        const overlap = attached.some((x, i) =>
            attached.some((y, j) => i < j && chargesSameOrderedItem(x, y))
        );
        assert(`  ${name}: no two attached bills share an ordered item`, !overlap);
    }

    // THE ORDER IS PROVABLY IRRELEVANT, so reversing the pool must change nothing.
    // A bill attaches only when no OTHER unplaced bill charges any ordered item it
    // charges, so any two that attach are disjoint and never draw on the same room;
    // two that would compete are each other's rival and both refuse before room is
    // consulted. A mutation that reverses the iteration order must break NOTHING —
    // that is what makes this a property rather than a habit.
    log("");
    log("the fold order cannot change the answer:");
    for (const [name, pool, transcribed] of [
        ["two disjoint bills", [onA, onB], null],
        ["two bills on one ordered item", [sameItemA, sameItemB], null],
        ["two partial bills on one ordered item", [partial, wantsFive], null],
    ]) {
        const arr = pool === onA || pool[0] === onA ? twoBrought : brought15b;
        const forward = planPairings({ arrival: arr, bills: pool, agreedPrices: PRICES, transcribed });
        const backward = planPairings({
            arrival: arr,
            bills: [...pool].reverse(),
            agreedPrices: PRICES,
            transcribed,
        });
        assert(
            `  ${name}: same set attached either way`,
            forward.attach.map((b) => b.invoiceRecordId).sort().join() ===
                backward.attach.map((b) => b.invoiceRecordId).sort().join()
        );
    }
    log("anti-vacuity — the rule is seen to say more than one thing:");
    assert(
        "the four fit refusals are all reachable from some input",
        new Set([
            fitRefusal(bill({ charges: [] }), arrival(), PRICES),
            fitRefusal(bill({ paired: "recDL9" }), arrival(), PRICES),
            fitRefusal(bill({ charges: [["recPOI_C", 4.5]] }), arrival({ brought: ["recPOI_A"] }), PRICES),
            fitRefusal(bill({ charges: [["recPOI_A", 99]] }), arrival(), PRICES),
        ]).size === 4
    );
    assert(
        "the six refusal keys are six different values",
        new Set(Object.values(PAIRING_REFUSED)).size === 6
    );
    assert(
        "and only one of them is ever worded, `no-room` deliberately not among them",
        Object.values(PAIRING_REFUSED).filter((key) => PAIRING_COPY.preview[key]).length === 1 &&
            !PAIRING_COPY.preview[PAIRING_REFUSED.noRoom]
    );
    assert(
        "the five outcome keys are five different values",
        new Set(Object.values(PAIRING)).size === 5
    );
    assert(
        "all four of direction 1's outcomes are reachable, so the plan is not a constant",
        new Set([
            outcome1({ arrival: arrival(), bills: [bill()], agreedPrices: PRICES }).key,
            outcome1({ arrival: twoItems, bills: [billA, billB], agreedPrices: PRICES }).key,
            outcome1({ arrival: shipment, bills: [older, newer], agreedPrices: PRICES }).key,
            outcome1({ arrival: arrival(), bills: [], agreedPrices: PRICES }).key,
        ]).size === 4
    );
    assert(
        "chargesSameOrderedItem says both yes and no",
        chargesSameOrderedItem(older, newer) && !chargesSameOrderedItem(billA, billB)
    );
    assert(
        "a matched outcome carries the record id it matched, so the caller has something to write",
        outcome1({ arrival: arrival(), bills: [bill()], agreedPrices: PRICES }).invoiceRecordId ===
            "recINV1" &&
            matchArrivalToBill({ bill: bill(), arrivals: [arrival()], bills: [bill()], agreedPrices: PRICES })
                .deliveryRecordId === "recDL1"
    );
    assert(
        "and a refused one carries null, so a caller cannot write one by accident",
        outcome1({ arrival: shipment, bills: [older, newer], agreedPrices: PRICES }).invoiceRecordId ===
            null &&
            matchArrivalToBill({
                bill: bill(),
                arrivals: [arrival({ id: "recDL1" }), arrival({ id: "recDL2" })],
                bills: [bill()],
                agreedPrices: PRICES,
            }).deliveryRecordId === null
    );
}

if (isMain(import.meta.url)) standalone(title, run);

// The COMPUTED pairing (#231) — the containment rule, the price gate, the rival
// clause, and the two directions agreeing.
//
// WHY THIS TIER CARRIES MORE THAN ITS SHARE HERE. Only one of the states this rule
// can reach is on the live base, so a browser run can show it working and cannot
// show it declining:
//
//   matched      — reachable on live data and verified in a browser
//                  and through the real Server Action.
//   no-room      — reachable: `HYE-INV-260804-04` against `HYE-DL-260804-06`,
//                  which brought 15 of `166-DEMO Coupling` and whose attached
//                  `HYE-INV-260804-05` charges all 15. Silent, so what a browser
//                  shows there is nothing.
//   shared-order — NOT reachable. Every ordered item on this base carrying two
//                  invoices has one of them already attached, so the capacity clause
//                  answers first. Reachable only with the hand-made pairings
//                  removed, which is a simulation rather than a state.
//   several      — NOT reachable. Measured 2026-08-13: no delivery on this base
//                  has more than one candidate invoice, so the whole branch exists
//                  only here.
//   price-departs — NOT reachable. One invoice departs from an agreed price
//                  (`HYE-INV-260716-02`, 32.00 invoiced against 33.89 ordered) and
//                  containment already excludes it, so the gate removes no pair
//                  on live data and changes no verdict there.
//   price-unknown — NOT reachable, and not by accident: both callers build
//                  `agreedPrices` from the very ordered items they then test
//                  against, and containment is decided first. It is a fail-closed
//                  branch against a caller bug, not a data state.
//   tie-break    — NOT reachable. It needs two UNPLACED invoices whose ordered items,
//                  quantities and prices all match; the two pairs on this base
//                  that share an ordered item each have one invoice attached already.
//
// So the price gate, `several`, `shared-order` and the tie-break are asserted here
// or nowhere, and each is shown to be capable of failing rather than merely present
// — see the mutation notes on the individual sections.
//
// THE ONE THING MOST WORTH BREAKING IS THE LINE BETWEEN CAPACITY AND A QUANTITY
// MATCH. `roomOnOrderedItem` reads quantities, and the rule this feature must not
// break is that quantities never decide whether an invoice is a delivery's. The
// section "capacity is not the quantity match this rule refuses to make" is what
// separates them, and its first check is the whole feature: 13 invoiced against 10
// delivered pairs, so #210's mismatch marker still has something to mark.
//
// WHAT A PASS DOES NOT PROVE. That either caller passes the right inputs. The form
// builds its delivery from `planDelivery`'s rows and the action builds its invoice from
// the submitted items; whether those are the right rows is behavior, measured in a
// browser and in the PR.

import {
    PAIRING,
    PAIRING_COPY,
    PAIRING_REFUSED,
    TIE_BREAK,
    invoiceFromOption,
    chargeSignature,
    chargesIdentically,
    chargesSameOrderedItem,
    describePairing,
    describeTieBreak,
    fitRefusal,
    matchDeliveryToInvoice,
    describeDeliveryPairings,
    planPairings,
    orderedItemsInvoiced,
    roomOnOrderedItem,
    orderedItemsDelivered,
    pairingRefusal,
    tiedRivals,
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
 * An invoice, as lib/deliveryInvoiceMatch.js reads one. `charges` entries are
 * `[orderedItem, unitPrice]` or `[orderedItem, unitPrice, qty]`; the quantity only
 * matters where the invoice is one ALREADY on a delivery, since that is the only
 * thing it is ever read for.
 */
const invoice = ({ id = "recINV1", invoiceId = "HYE-INV-260804-07", charges = [["recPOI_A", 10]], paired = null } = {}) => ({
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
 * A delivery, likewise. `brought` takes bare ids for the cases where only the SET
 * matters, or `[id, qty]` pairs where the capacity clause is what is under test.
 * The default quantity is deliberately larger than any invoice below, so a check that
 * did not mean to exercise capacity does not exercise it by accident.
 */
const delivery = ({ id = "recDL1", deliveryId = "HYE-DL-260804-08", brought = ["recPOI_A"] } = {}) => ({
    deliveryRecordId: id,
    deliveryId,
    orderedItems: brought.map((b) =>
        Array.isArray(b) ? { poItemRecordId: b[0], qty: b[1] } : { poItemRecordId: b, qty: 1000 }
    ),
});

/**
 * Direction 1 as one call, since #231 made it a PLAN rather than a single answer.
 * Every check that used to ask for its outcome key is asking the same question of
 * the same rule; what changed is that the rule may now name several invoices.
 */
const outcome1 = (args) => {
    const plan = planPairings(args);
    return {
        ...describeDeliveryPairings(plan, args.invoices),
        invoiceRecordId: plan.attach.length === 1 ? plan.attach[0].invoiceRecordId : null,
        attached: plan.attach.map((b) => b.invoiceRecordId),
    };
};

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("containment — an invoice sits inside a delivery, or it is not its invoice:");
    check(
        "every ordered item invoiced was brought: fits",
        fitRefusal(invoice({ charges: [["recPOI_A", 10]] }), delivery({ brought: ["recPOI_A", "recPOI_B"] }), PRICES),
        null
    );
    check(
        "the delivery brought MORE than the invoice charges: still fits (n:1)",
        fitRefusal(invoice({ charges: [["recPOI_A", 10]] }), delivery({ brought: ["recPOI_A", "recPOI_B"] }), PRICES),
        null
    );
    check(
        "an ordered item invoiced that the delivery did not bring: refused",
        fitRefusal(
            invoice({ charges: [["recPOI_A", 10], ["recPOI_B", 25]] }),
            delivery({ brought: ["recPOI_A"] }),
            PRICES
        ),
        PAIRING_REFUSED.notContained
    );

    // THE VACUOUS-SUBSET TRAP, which is why noOrderedItem is tested FIRST in the
    // production function. Mutation: delete that clause and this check fails while
    // every containment check above still passes — the empty set is contained in
    // everything, so a free-text-only invoice would attach to whatever delivery was
    // recorded next. Two such invoices sit on this base.
    log("");
    log("the empty set is refused explicitly, never vacuously contained:");
    check(
        "an invoice charging no ordered item at all",
        fitRefusal(invoice({ charges: [] }), delivery(), PRICES),
        PAIRING_REFUSED.noOrderedItem
    );
    check(
        "  and it is refused against an EMPTY delivery too, not just a full one",
        fitRefusal(invoice({ charges: [] }), delivery({ brought: [] }), PRICES),
        PAIRING_REFUSED.noOrderedItem
    );
    assert(
        "  so it never reaches `matched` from either direction",
        outcome1({ delivery: delivery(), invoices: [invoice({ charges: [] })], agreedPrices: PRICES }).key !==
            PAIRING.matched &&
            matchDeliveryToInvoice({
                invoice: invoice({ charges: [] }),
                deliveries: [delivery()],
                invoices: [],
                agreedPrices: PRICES,
            }).key !== PAIRING.matched
    );
    // A row with no `PO Item` is skipped rather than refusing the whole invoice — the
    // the same skip the reconciliation walk makes. Unreachable through the app since
    // #278 and kept as a crash guard, which is what a hand-emptied link needs.
    check(
        "a MIXED invoice — one free-text row, one ordered item — is judged on the ordered item",
        fitRefusal(
            { ...invoice({ charges: [["recPOI_A", 10]] }), orderedItems: [{ poItemRecordId: null, unitPrice: 40 }, { poItemRecordId: "recPOI_A", unitPrice: 10 }] },
            delivery({ brought: ["recPOI_A"] }),
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
    log("unit price is agreed on the order, so an invoice departing from it is not a candidate:");
    check(
        "invoiced at the agreed price: fits",
        fitRefusal(invoice({ charges: [["recPOI_A", 10]] }), delivery(), PRICES),
        null
    );
    check(
        "invoiced above the agreed price: refused",
        fitRefusal(invoice({ charges: [["recPOI_A", 12.5]] }), delivery(), PRICES),
        PAIRING_REFUSED.priceDeparts
    );
    check(
        "invoiced below it: refused just the same — the test is a difference, not a direction",
        fitRefusal(invoice({ charges: [["recPOI_A", 7]] }), delivery(), PRICES),
        PAIRING_REFUSED.priceDeparts
    );
    // The tolerance is lib/variance.js's, not a second one written here. A cent of
    // float noise is absorbed; two cents is a different price.
    check(
        "a cent of rounding noise is absorbed (checkUnitPriceVariance's own tolerance)",
        fitRefusal(invoice({ charges: [["recPOI_A", 10.01]] }), delivery(), PRICES),
        null
    );
    check(
        "two cents is not",
        fitRefusal(invoice({ charges: [["recPOI_A", 10.02]] }), delivery(), PRICES),
        PAIRING_REFUSED.priceDeparts
    );
    // A PRICE THAT CANNOT BE COMPARED IS ITS OWN KEY, and the two are separated
    // here or nowhere: both fail closed, both are silent, and neither is reachable
    // on live data, so nothing on a screen would notice them being merged again.
    // What the split protects is the sentence — `price-departs` will be true of a
    // departure when there is finally somewhere to say one. Mutation: return
    // `priceDeparts` from the typeof branch and the two checks below collapse onto
    // one value, which the anti-vacuity count then catches.
    check(
        "an agreed price the caller cannot answer for FAILS CLOSED, under its own key",
        fitRefusal(invoice({ charges: [["recPOI_A", 10]] }), delivery(), new Map()),
        PAIRING_REFUSED.priceUnknown
    );
    check(
        "  and so does an invoice row carrying no price of its own",
        fitRefusal(
            { ...invoice(), orderedItems: [{ poItemRecordId: "recPOI_A", unitPrice: null, qty: 1 }] },
            delivery(),
            PRICES
        ),
        PAIRING_REFUSED.priceUnknown
    );
    assert(
        "  which is NOT what a departure is called — the two keys stay apart",
        PAIRING_REFUSED.priceUnknown !== PAIRING_REFUSED.priceDeparts &&
            fitRefusal(invoice({ charges: [["recPOI_A", 12.5]] }), delivery(), PRICES) ===
                PAIRING_REFUSED.priceDeparts
    );

    // -----------------------------------------------------------------------
    // The property the whole feature rests on: a vendor invoicing more than it
    // shipped must still pair, or the mismatch marker #210 built would never fire.
    // Mutation: add any quantity comparison to fitRefusal and this fails.
    log("");
    log("quantity is NOT part of the test — the invoice that over-charges still pairs:");
    assert(
        "13 invoiced against a delivery of 10 pairs (HYE-INV-260804-07's real shape)",
        outcome1({
            delivery: delivery({ brought: ["recPOI_A"] }),
            invoices: [invoice({ charges: [["recPOI_A", 10]] })],
            agreedPrices: PRICES,
        }).key === PAIRING.matched
    );
    assert(
        "  and nothing in the module reads a quantity at all",
        !/\bqty\b|quantity[A-Z]/.test(
            [orderedItemsInvoiced, orderedItemsDelivered, fitRefusal, pairingRefusal].map(String).join("\n")
        )
    );

    // -----------------------------------------------------------------------
    log("");
    log("an invoice some delivery already holds is not a candidate:");
    check(
        "already paired elsewhere",
        fitRefusal(invoice({ paired: "recDL9" }), delivery(), PRICES),
        PAIRING_REFUSED.alreadyPaired
    );
    check(
        "already paired to THIS one — still not a candidate, there is nothing to compute",
        fitRefusal(invoice({ paired: "recDL1" }), delivery({ id: "recDL1" }), PRICES),
        PAIRING_REFUSED.alreadyPaired
    );

    // -----------------------------------------------------------------------
    // TWO INVOICES NOBODY HAS PLACED, CHARGING ONE ORDERED ITEM FOR DIFFERENT AMOUNTS.
    // The delivery answers one of them and the other's material has not delivered, and
    // nothing records which — so neither is attached. Mutation: drop the rival clause
    // from pairingRefusal and both attach to one delivery, which is the answer #210
    // established is wrong.
    //
    // THE QUANTITIES DIFFER ON PURPOSE, WHICH IS THE WHOLE BOUNDARY OF THIS CLAUSE.
    // Two invoices claiming the SAME quantity of the same ordered item at the same price
    // are tied, and one of them is attached — see the tie-break section. #166's own
    // scenario D (an ordered item of 30, two invoices of 15, one delivery of 15) is
    // exactly that shape and MOVED there in this issue; what is left here is the pair
    // whose choice a reader could observe.
    log("");
    log("the rival clause — two invoices charging one ordered item on one delivery:");
    const older = invoice({ id: "recINV_OLD", invoiceId: "HYE-INV-260804-04", charges: [["recPOI_A", 10, 1]] });
    const newer = invoice({ id: "recINV_NEW", invoiceId: "HYE-INV-260804-05", charges: [["recPOI_A", 10, 2]] });
    const shared = delivery({ id: "recDL_C", brought: ["recPOI_A"] });

    assert(
        "each invoice fits the delivery on its own",
        fitRefusal(older, shared, PRICES) === null && fitRefusal(newer, shared, PRICES) === null
    );
    check(
        "but with both in the pool, the older is refused",
        pairingRefusal({ invoice: older, delivery: shared, invoices: [older, newer], agreedPrices: PRICES }),
        PAIRING_REFUSED.sharedOrder
    );
    check(
        "and so is the newer — neither wins, because nothing records which",
        pairingRefusal({ invoice: newer, delivery: shared, invoices: [older, newer], agreedPrices: PRICES }),
        PAIRING_REFUSED.sharedOrder
    );
    check(
        "recording the delivery attaches nothing and says why",
        outcome1({ delivery: shared, invoices: [older, newer], agreedPrices: PRICES }).key,
        PAIRING.sharedOrder
    );

    // An invoice ALREADY ON the delivery is answered by capacity instead, which is the
    // clause that replaced half of this one — see the next section. Here it is only
    // asserted that it is no longer read as an ambiguity.
    const heldElsewhere = invoice({ id: "recINV_X", charges: [["recPOI_A", 10]], paired: "recDL_OTHER" });
    check(
        "a rival recorded on ANOTHER delivery does not block — it has been placed",
        pairingRefusal({ invoice: older, delivery: shared, invoices: [older, heldElsewhere], agreedPrices: PRICES }),
        null
    );
    check(
        "an invoice charging a DIFFERENT ordered item is no rival at all",
        pairingRefusal({
            invoice: older,
            delivery: delivery({ id: "recDL_C", brought: ["recPOI_A", "recPOI_B"] }),
            invoices: [older, invoice({ id: "recINV_Z", charges: [["recPOI_B", 25]] })],
            agreedPrices: PRICES,
        }),
        null
    );

    // -----------------------------------------------------------------------
    // CAPACITY, WHICH TOOK HALF OF `shared-order`. An invoice already on the delivery
    // charging everything it brought of an ordered item does not make a second invoice
    // ambiguous — it leaves nowhere for it to go. Mutation: delete the noRoom clause
    // in pairingRefusal and the first two fail (the second reverts to shared-order,
    // which would be a false sentence: something DOES record which invoice this
    // delivery answers).
    log("");
    log("capacity — what an invoice already on the delivery has claimed:");
    const brought15 = delivery({ id: "recDL_R", brought: [["recPOI_A", 15]] });
    const claimsAll = invoice({ id: "recINV_FULL", charges: [["recPOI_A", 10, 15]], paired: "recDL_R" });
    const claimsSome = invoice({ id: "recINV_PART", charges: [["recPOI_A", 10, 10]], paired: "recDL_R" });
    const wants = invoice({ id: "recINV_WANT", charges: [["recPOI_A", 10, 15]] });

    check(
        "15 arrived and an invoice on it claims 15: no room",
        pairingRefusal({ invoice: wants, delivery: brought15, invoices: [wants, claimsAll], agreedPrices: PRICES }),
        PAIRING_REFUSED.noRoom
    );
    check(
        "15 arrived and an invoice on it claims 10: 5 left, so it is still a candidate",
        pairingRefusal({ invoice: wants, delivery: brought15, invoices: [wants, claimsSome], agreedPrices: PRICES }),
        null
    );
    check(
        "  even though it charges 15 against 5 of room — capacity is `> 0`, never `>= invoiced`",
        roomOnOrderedItem({
            delivery: brought15,
            poItemRecordId: "recPOI_A",
            invoices: [wants, claimsSome],
            excluding: "recINV_WANT",
        }),
        5
    );
    check(
        "an invoice on ANOTHER delivery claims nothing here",
        roomOnOrderedItem({
            delivery: brought15,
            poItemRecordId: "recPOI_A",
            invoices: [invoice({ id: "recINV_Y", charges: [["recPOI_A", 10, 15]], paired: "recDL_OTHER" })],
        }),
        15
    );
    // Two slices of one ordered item is #162's own shape — the within-order row and
    // the over-delivery row — and both are quantity that was delivered.
    check(
        "an over-delivered delivery counts BOTH its rows as capacity",
        roomOnOrderedItem({
            delivery: delivery({ id: "recDL_S", brought: [["recPOI_A", 10], ["recPOI_A", 3]] }),
            poItemRecordId: "recPOI_A",
            invoices: [],
        }),
        13
    );
    // Mutation: drop the `if (!held) return brought;` guard and this fails, because
    // an unplaced invoice's null would equal the delivery's null and read as claimed.
    check(
        "on the entry path nothing is claimed, since no invoice can be on a delivery that does not exist",
        roomOnOrderedItem({
            delivery: { deliveryRecordId: null, orderedItems: [{ poItemRecordId: "recPOI_A", qty: 15 }] },
            poItemRecordId: "recPOI_A",
            invoices: [invoice({ id: "recINV_U", charges: [["recPOI_A", 10, 15]] })],
        }),
        15
    );

    // THE LINE BETWEEN CAPACITY AND THE FORBIDDEN QUANTITY MATCH, asserted rather
    // than argued. Mutation: change `<= 0` to `< invoiced` in pairingRefusal and the
    // first of these fails — which is the whole feature breaking, since that invoice
    // is exactly what #210's mismatch marker exists to surface.
    log("");
    log("capacity is not the quantity match this rule refuses to make:");
    const brought10 = delivery({ id: "recDL_M", brought: [["recPOI_A", 10]] });
    const invoices13 = invoice({ id: "recINV_13", charges: [["recPOI_A", 10, 13]] });
    check(
        "13 invoiced against 10 delivered, nothing else attached: PAIRS",
        pairingRefusal({ invoice: invoices13, delivery: brought10, invoices: [invoices13], agreedPrices: PRICES }),
        null
    );
    check(
        "13 invoiced against 10 delivered, with 4 already claimed: STILL pairs — 6 of room",
        pairingRefusal({
            invoice: invoices13,
            delivery: brought10,
            invoices: [invoices13, invoice({ id: "recINV_4", charges: [["recPOI_A", 10, 4]], paired: "recDL_M" })],
            agreedPrices: PRICES,
        }),
        null
    );
    check(
        "13 invoiced against 10 delivered, all 10 already claimed: no room",
        pairingRefusal({
            invoice: invoices13,
            delivery: brought10,
            invoices: [invoices13, invoice({ id: "recINV_10", charges: [["recPOI_A", 10, 10]], paired: "recDL_M" })],
            agreedPrices: PRICES,
        }),
        PAIRING_REFUSED.noRoom
    );
    assert(
        "  and `no-room` is never spoken — it is arithmetic, so the outcome is silence",
        matchDeliveryToInvoice({
            invoice: invoices13,
            deliveries: [brought10],
            invoices: [invoices13, invoice({ id: "recINV_10", charges: [["recPOI_A", 10, 10]], paired: "recDL_M" })],
            agreedPrices: PRICES,
        }).key === PAIRING.none && !PAIRING_COPY.preview[PAIRING_REFUSED.noRoom]
    );

    // -----------------------------------------------------------------------
    // THE PROPERTY THE TWO DIRECTIONS EXIST TO SHARE. If these disagreed, whether a
    // pairing got made would depend on which document somebody typed in first.
    log("");
    log("both directions reach the same verdict on the same pair:");
    const cases = [
        ["a plain fit", [invoice()], [delivery()]],
        ["the rival pair", [older, newer], [delivery]],
        ["a rival recorded elsewhere", [older, heldElsewhere], [delivery]],
        ["a price departure", [invoice({ charges: [["recPOI_A", 99]] })], [delivery()]],
        ["a price nobody can answer for", [invoice()], [delivery()], new Map()],
        ["nothing invoiced", [invoice({ charges: [] })], [delivery()]],
        // A TIED PAIR AGREES ABOUT THE PAIR AND NOT ABOUT WHICH INVOICE, which is the
        // one place the two directions part company on purpose: both admit
        // (`older`, `shared`), and direction 1 additionally has to choose. See
        // matchDeliveryToInvoice's own comment for why that is not the divergence the
        // header rules out.
        [
            "a tied pair",
            [older, invoice({ id: "recINV_TWIN", invoiceId: "HYE-INV-260804-06", charges: [["recPOI_A", 10, 1]] })],
            [delivery],
        ],
    ];
    for (const [name, pool, deliveries, prices = PRICES] of cases) {
        const subject = pool[0];
        const forward = pairingRefusal({
            invoice: subject,
            delivery: deliveries[0],
            invoices: pool,
            agreedPrices: prices,
        });
        // THE POOL REVERSED, WHICH IS WHAT MAKES THIS ASSERTION ABLE TO FAIL. It
        // was the same call written twice before, so it compared a value with
        // itself and could not have caught anything; the property worth having is
        // that the predicate reads the pool as a SET, which is also what lets
        // `planPairings` sort it without changing any single verdict.
        const backward = pairingRefusal({
            invoice: subject,
            delivery: deliveries[0],
            invoices: [...pool].reverse(),
            agreedPrices: prices,
        });
        const viaDirection1 = outcome1({ delivery: deliveries[0], invoices: pool, agreedPrices: prices });
        const viaDirection2 = matchDeliveryToInvoice({
            invoice: subject,
            deliveries,
            invoices: pool,
            agreedPrices: prices,
        });
        assert(`  ${name}: the predicate reads the pool as a set`, forward === backward);
        // The pair is made by direction 2 exactly when the predicate admits it, and
        // by direction 1 exactly when it admits it AND no second invoice also fits.
        assert(
            `  ${name}: direction 2 attaches iff the predicate admits`,
            (viaDirection2.key === PAIRING.matched) === (forward === null)
        );
        assert(
            `  ${name}: direction 1 never attaches a pair the predicate refuses`,
            viaDirection1.key !== PAIRING.matched ||
                pairingRefusal({
                    invoice: pool.find((b) => b.invoiceRecordId === viaDirection1.invoiceRecordId),
                    delivery: deliveries[0],
                    invoices: pool,
                    agreedPrices: prices,
                }) === null
        );
    }

    // TWO INVOICES FOR DIFFERENT ORDERED ITEMS THAT ONE DELIVERY BROUGHT. Neither is
    // ambiguous and neither is the other's rival, so both are attached — the n:1
    // link is what that is for. Direction 2 reaches the same place one invoice at a
    // time, which is what makes this an arity difference in the ANSWER rather than
    // a disagreement about a pair. Not reachable on this base: measured 2026-08-13,
    // no delivery holds two unpaired contained invoices, sharing an ordered item or not.
    log("");
    log("one delivery, two invoices, nothing in common:");
    const twoItems = delivery({ id: "recDL_T", brought: ["recPOI_A", "recPOI_B"] });
    const invoiceA = invoice({ id: "recINV_A", invoiceId: "HYE-INV-A", charges: [["recPOI_A", 10]] });
    const invoiceB = invoice({ id: "recINV_B", invoiceId: "HYE-INV-B", charges: [["recPOI_B", 25]] });
    check(
        "recording the delivery attaches BOTH — the form's one field is gone",
        outcome1({ delivery: twoItems, invoices: [invoiceA, invoiceB], agreedPrices: PRICES }).key,
        PAIRING.severalAttached
    );
    check(
        "recording either invoice: one candidate delivery, so it attaches",
        matchDeliveryToInvoice({ invoice: invoiceA, deliveries: [twoItems], invoices: [invoiceA, invoiceB], agreedPrices: PRICES }).key,
        PAIRING.matched
    );
    assert(
        "  and the predicate admits both, so the two directions have not disagreed about a PAIR",
        pairingRefusal({ invoice: invoiceA, delivery: twoItems, invoices: [invoiceA, invoiceB], agreedPrices: PRICES }) === null &&
            pairingRefusal({ invoice: invoiceB, delivery: twoItems, invoices: [invoiceA, invoiceB], agreedPrices: PRICES }) === null
    );
    // NEITHER IS THE OTHER'S RIVAL, which is what makes this `several` rather than
    // `shared-order` and is the whole reason it does not converge: nothing is
    // ambiguous, so nothing will ever become less so.
    assert(
        "  neither blocks the other — they charge different ordered items",
        !chargesSameOrderedItem(invoiceA, invoiceB)
    );
    assert(
        "  and it names both, so nothing is silently written or silently dropped",
        // The SET, not the sequence. The action writes one link per invoice and the
        // order they go out in is not a fact about anything, so pinning it here
        // would make the order-reversal property below fail on this check alone.
        outcome1({ delivery: twoItems, invoices: [invoiceA, invoiceB], agreedPrices: PRICES })
            .attached.slice().sort().join() === "recINV_A,recINV_B"
    );
    assert(
        "  and direction 2 attaches BOTH, one at a time, which is the state a person is left to reproduce",
        matchDeliveryToInvoice({ invoice: invoiceA, deliveries: [twoItems], invoices: [invoiceA, invoiceB], agreedPrices: PRICES })
            .deliveryRecordId === "recDL_T" &&
            matchDeliveryToInvoice({ invoice: invoiceB, deliveries: [twoItems], invoices: [invoiceA, invoiceB], agreedPrices: PRICES })
                .deliveryRecordId === "recDL_T"
    );

    // -----------------------------------------------------------------------
    log("");
    log("direction 2 — several deliveries could have brought it:");
    check(
        "two deliveries each brought everything invoiced: nothing attached",
        matchDeliveryToInvoice({
            invoice: invoice(),
            deliveries: [delivery({ id: "recDL1" }), delivery({ id: "recDL2" })],
            invoices: [invoice()],
            agreedPrices: PRICES,
        }).key,
        PAIRING.several
    );
    check(
        "no delivery brought it: nothing attached and nothing said",
        matchDeliveryToInvoice({
            invoice: invoice({ charges: [["recPOI_C", 4.5]] }),
            deliveries: [delivery({ brought: ["recPOI_A"] })],
            invoices: [],
            agreedPrices: PRICES,
        }).key,
        PAIRING.none
    );
    check(
        "no delivery at all: the same, rather than an error",
        matchDeliveryToInvoice({ invoice: invoice(), deliveries: [], invoices: [], agreedPrices: PRICES }).key,
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
    log("the entry path, where the delivery has no record id yet:");
    check(
        "a lone invoice fits, exactly as it would against a saved delivery",
        pairingRefusal({ invoice: invoice(), delivery: beingRecorded, invoices: [invoice()], agreedPrices: PRICES }),
        null
    );
    check(
        "  an unplaced rival blocks there too",
        pairingRefusal({ invoice: older, delivery: beingRecorded, invoices: [older, newer], agreedPrices: PRICES }),
        PAIRING_REFUSED.sharedOrder
    );
    // The one a `null === null` comparison would get wrong: a rival on some OTHER
    // delivery must not read as one on this not-yet-existing delivery.
    check(
        "  and a rival placed on another delivery does not",
        pairingRefusal({
            invoice: older,
            delivery: beingRecorded,
            invoices: [older, heldElsewhere],
            agreedPrices: PRICES,
        }),
        null
    );

    // -----------------------------------------------------------------------
    log("");
    log("the seam between the dropdown's vocabulary and this module's:");
    const asInvoice = invoiceFromOption({
        invoiceRecordId: "recINV1",
        invoiceId: "HYE-INV-260804-07",
        linkedDeliveryRecordId: "recDL9",
        orderedItems: [{ poItemRecordId: "recPOI_A", unitPrice: 10 }],
    });
    check("linkedDeliveryRecordId becomes pairedDeliveryRecordId", asInvoice.pairedDeliveryRecordId, "recDL9");
    check(
        "  and the converted option is refused as already paired, which is what that field is for",
        fitRefusal(asInvoice, delivery(), PRICES),
        PAIRING_REFUSED.alreadyPaired
    );
    check(
        "an option with no ordered items converts to an invoice with none, not to undefined",
        orderedItemsInvoiced(invoiceFromOption({ invoiceRecordId: "recX" })).length,
        0
    );

    // -----------------------------------------------------------------------
    log("");
    log("copy — one voice per outcome, and silence for `none`:");
    // ONE VOICE PER DIRECTION THAT CAN REACH THE OUTCOME, which is why this is not
    // "every key has both". `several` is the invoice side's alone — a delivery can
    // no longer have too many candidates, it attaches them — and `several-attached`
    // is the delivery side's, since one invoice is never attached to two deliveries.
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
        // The qualifier goes through the same sweep as the outcomes: it is copy in
        // this module and #166's vocabulary does not stop at a key's shape.
        .concat([
            describeTieBreak({ chosen: "HYE-INV-1", tiedWith: ["HYE-INV-2"] }, "preview"),
            describeTieBreak({ tieBreak: true }, "banner"),
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
    // FOLDING AND DEDUCTING ARE ONE STEP. A decided invoice joins the pool AS
    // ATTACHED to this delivery, which stops it being an unplaced rival AND starts
    // its quantity counting against the room. Doing only the first is the defect:
    // the rival clause goes quiet and nothing replaces it.
    log("");
    log("several attached in one run, and the room each one takes:");
    const twoBrought = delivery({ id: "recDL_F", brought: [["recPOI_A", 15], ["recPOI_B", 10]] });
    const onA = invoice({ id: "recINV_A2", invoiceId: "HYE-INV-A2", charges: [["recPOI_A", 10, 15]] });
    const onB = invoice({ id: "recINV_B2", invoiceId: "HYE-INV-B2", charges: [["recPOI_B", 25, 10]] });
    check(
        "two invoices on different ordered items: both attached",
        planPairings({ delivery: twoBrought, invoices: [onA, onB], agreedPrices: PRICES }).attach.length,
        2
    );

    // Two invoices that each charge PART of one ordered item are still rivals: nothing
    // records which of them this delivery answers, and "they would both fit" is not
    // an answer to that question. They are NOT tied — 10 and 5 are different claims,
    // and attaching one rather than the other leaves 5 of room rather than 10.
    const brought15b = delivery({ id: "recDL_G", brought: [["recPOI_A", 15]] });
    const partial = invoice({ id: "recINV_S3", invoiceId: "HYE-INV-S3", charges: [["recPOI_A", 10, 10]] });
    const wantsFive = invoice({ id: "recINV_S4", invoiceId: "HYE-INV-S4", charges: [["recPOI_A", 10, 5]] });
    check(
        "10 and 5 against a delivery of 15: neither attached, because neither is recorded",
        planPairings({ delivery: brought15b, invoices: [partial, wantsFive], agreedPrices: PRICES })
            .attach.length,
        0
    );

    // -----------------------------------------------------------------------
    // THE TIE-BREAK. Two invoices nobody has placed, charging the same ordered items in
    // the same quantities at the same prices: the room left over and #210's mismatch
    // marker come out the same whichever is attached, so there is nothing for a
    // reader to resolve and one is attached.
    //
    // THIS IS #166's SCENARIO D, WHICH USED TO REFUSE — an ordered item of 30, two
    // invoices of 15, one delivery of 15 — so these checks are where a change of mind
    // has to be made on purpose rather than noticed later.
    //
    // Mutation: drop `!chargesIdentically(...)` from the rival clause and the first
    // check goes to 0 attached. Drop the FOLD instead (leave the pool untouched
    // after a decision) and it goes to 2, which is 15 taking 30 — the defect the
    // fold exists for, and the one that had no bite while every rival was refused.
    log("");
    log("the tie-break — two invoices nothing tells apart:");
    const sameItemA = invoice({ id: "recINV_S1", invoiceId: "HYE-INV-S1", charges: [["recPOI_A", 10, 15]] });
    const sameItemB = invoice({ id: "recINV_S2", invoiceId: "HYE-INV-S2", charges: [["recPOI_A", 10, 15]] });
    const tiedPlan = planPairings({
        delivery: brought15b,
        invoices: [sameItemA, sameItemB],
        agreedPrices: PRICES,
    });
    check("15 arrived, two tied invoices of 15: exactly one attached", tiedPlan.attach.length, 1);
    check(
        "  and the other is refused for ROOM, not for doubt — something records which now",
        tiedPlan.refusals.get("recINV_S2"),
        PAIRING_REFUSED.noRoom
    );
    // Indexed defensively throughout this section: a mutation that attaches nothing
    // or reports no tie should be a FAIL with a value beside it, not a throw that
    // takes the rest of the file's checks down with it.
    check(
        "  the pick is `Invoice ID` order, which means nothing beyond being total",
        tiedPlan.attach[0]?.invoiceRecordId ?? null,
        "recINV_S1"
    );
    // The room decides how many, exactly as it does for any other invoice. Two tied
    // invoices of 15 against 30 are both answered by that delivery and both attach —
    // nothing was chosen, so nothing is said.
    const roomFor30 = planPairings({
        delivery: delivery({ id: "recDL_H", brought: [["recPOI_A", 30]] }),
        invoices: [sameItemA, sameItemB],
        agreedPrices: PRICES,
    });
    check("30 arrived, two tied invoices of 15: BOTH attached", roomFor30.attach.length, 2);
    check("  and nothing was passed over, so there is no tie-break to report", roomFor30.tied.length, 0);

    // WHAT COUNTS AS TIED IS EVERY FIGURE EITHER SCREEN COULD READ, so a difference
    // in any one of them puts the pair back under `shared-order`. Mutation: drop the
    // quantity or the price out of `chargeSignature` and one of these flips.
    assert(
        "identical invoices are tied",
        chargesIdentically(sameItemA, sameItemB) && chargeSignature(sameItemA) === chargeSignature(sameItemB)
    );
    for (const [why, other] of [
        ["a different quantity", invoice({ id: "recX1", charges: [["recPOI_A", 10, 14]] })],
        ["a different price", invoice({ id: "recX2", charges: [["recPOI_A", 11, 15]] })],
        [
            "one more ordered item",
            invoice({ id: "recX3", charges: [["recPOI_A", 10, 15], ["recPOI_B", 25, 1]] }),
        ],
    ]) {
        assert(`  ${why} is not tied`, !chargesIdentically(sameItemA, other));
    }
    // The vacuous tie, which is the same trap `noOrderedItem` opens the rule with:
    // two invoices charging nothing have equal signatures and must not be tied, or a
    // free-text invoice would be attached for resembling another one.
    assert(
        "  two invoices charging no ordered item at all are not tied either",
        !chargesIdentically(invoice({ charges: [] }), invoice({ id: "recX4", charges: [] }))
    );
    // Row order within an invoice is not a fact about it — #167's split leaves one invoice
    // holding two rows, and which came back first is Airtable's business.
    assert(
        "  and the order the rows come in does not make two invoices differ",
        chargeSignature(
            invoice({ id: "recX5", charges: [["recPOI_A", 10, 2], ["recPOI_B", 25, 1]] })
        ) ===
            chargeSignature(
                invoice({ id: "recX6", charges: [["recPOI_B", 25, 1], ["recPOI_A", 10, 2]] })
            )
    );
    assert(
        "  an invoice already placed is nobody's tied rival — it was not passed over",
        tiedRivals(sameItemA, [sameItemA, { ...sameItemB, pairedDeliveryRecordId: "recDL_OTHER" }])
            .length === 0
    );

    // THE SENTENCE, which is the only reason the tie-break is visible at all. It
    // names both invoices on the form, because the recorder is holding the packing
    // list; the banner names neither, because it arrives as a flag on a query
    // string. Mutation: return `tied: []` from planPairings and both go silent
    // while every attachment above still happens — which is the failure this
    // section exists to make loud.
    const tiedOutcome = describeDeliveryPairings(tiedPlan, [sameItemA, sameItemB]);
    check("the outcome still reports what was attached", tiedOutcome.key, PAIRING.matched);
    check(
        "  and carries the invoice it was chosen over",
        (tiedOutcome.tiedWith || []).join(),
        "HYE-INV-S2"
    );
    assert(
        "  the preview names both",
        Boolean(describeTieBreak(tiedOutcome, "preview")?.text?.includes("HYE-INV-S1")) &&
            Boolean(describeTieBreak(tiedOutcome, "preview")?.text?.includes("HYE-INV-S2"))
    );
    check(
        "  the banner is reached by a flag instead, and names neither",
        describeTieBreak({ tieBreak: true }, "banner")?.key ?? null,
        TIE_BREAK
    );
    check(
        "  an outcome with no tie words nothing",
        describeTieBreak(
            describeDeliveryPairings(
                planPairings({ delivery: delivery(), invoices: [invoice()], agreedPrices: PRICES }),
                [invoice()]
            ),
            "preview"
        ),
        null
    );
    check("  and neither does a missing one", describeTieBreak(undefined, "banner"), null);
    assert(
        "  it is not an outcome key, so describePairing cannot be handed it",
        !Object.values(PAIRING).includes(TIE_BREAK) &&
            describePairing({ key: TIE_BREAK }, "preview") === null
    );

    // THE DISJOINTNESS THE FOLD IS MEASURED AGAINST. Two attached invoices either
    // charge no common ordered item — the untied case, where the fold changes
    // nothing — or they are tied, which is the case the fold exists for. Anything
    // else attached together would be two rivals on one delivery.
    for (const [name, pool, arr] of [
        ["two disjoint invoices", [onA, onB], twoBrought],
        ["two tied invoices with room for both", [sameItemA, sameItemB], delivery({ id: "recDL_H", brought: [["recPOI_A", 30]] })],
        ["two tied invoices with room for one", [sameItemA, sameItemB], brought15b],
        ["two partial invoices on one ordered item", [partial, wantsFive], brought15b],
    ]) {
        const attached = planPairings({ delivery: arr, invoices: pool, agreedPrices: PRICES }).attach;
        const bad = attached.some((x, i) =>
            attached.some(
                (y, j) => i < j && chargesSameOrderedItem(x, y) && !chargesIdentically(x, y)
            )
        );
        assert(`  ${name}: no two attached invoices are each other's rival`, !bad);
    }

    // THE POOL'S ORDER CANNOT CHANGE THE ANSWER, and it now has something to prove:
    // among tied invoices the pass really does choose, so it chooses in an order of its
    // own rather than the caller's. Mutation: iterate `invoices` instead of the sorted
    // queue and the tied rows below flip with the reversal.
    log("");
    log("the pool's order cannot change the answer:");
    for (const [name, pool, arr] of [
        ["two disjoint invoices", [onA, onB], twoBrought],
        ["two tied invoices", [sameItemA, sameItemB], brought15b],
        ["two partial invoices on one ordered item", [partial, wantsFive], brought15b],
    ]) {
        const forward = planPairings({ delivery: arr, invoices: pool, agreedPrices: PRICES });
        const backward = planPairings({
            delivery: arr,
            invoices: [...pool].reverse(),
            agreedPrices: PRICES,
        });
        assert(
            `  ${name}: same set attached either way`,
            forward.attach.map((b) => b.invoiceRecordId).join() ===
                backward.attach.map((b) => b.invoiceRecordId).join()
        );
    }
    log("anti-vacuity — the rule is seen to say more than one thing:");
    assert(
        "the five fit refusals are all reachable from some input",
        new Set([
            fitRefusal(invoice({ charges: [] }), delivery(), PRICES),
            fitRefusal(invoice({ paired: "recDL9" }), delivery(), PRICES),
            fitRefusal(invoice({ charges: [["recPOI_C", 4.5]] }), delivery({ brought: ["recPOI_A"] }), PRICES),
            fitRefusal(invoice({ charges: [["recPOI_A", 99]] }), delivery(), PRICES),
            fitRefusal(invoice({ charges: [["recPOI_A", 10]] }), delivery(), new Map()),
        ]).size === 5
    );
    assert(
        "the seven refusal keys are seven different values",
        new Set(Object.values(PAIRING_REFUSED)).size === 7
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
            outcome1({ delivery: delivery(), invoices: [invoice()], agreedPrices: PRICES }).key,
            outcome1({ delivery: twoItems, invoices: [invoiceA, invoiceB], agreedPrices: PRICES }).key,
            outcome1({ delivery: shared, invoices: [older, newer], agreedPrices: PRICES }).key,
            outcome1({ delivery: delivery(), invoices: [], agreedPrices: PRICES }).key,
        ]).size === 4
    );
    assert(
        "chargesSameOrderedItem says both yes and no",
        chargesSameOrderedItem(older, newer) && !chargesSameOrderedItem(invoiceA, invoiceB)
    );
    assert(
        "a matched outcome carries the record id it matched, so the caller has something to write",
        outcome1({ delivery: delivery(), invoices: [invoice()], agreedPrices: PRICES }).invoiceRecordId ===
            "recINV1" &&
            matchDeliveryToInvoice({ invoice: invoice(), deliveries: [delivery()], invoices: [invoice()], agreedPrices: PRICES })
                .deliveryRecordId === "recDL1"
    );
    assert(
        "and a refused one carries null, so a caller cannot write one by accident",
        outcome1({ delivery: delivery, invoices: [older, newer], agreedPrices: PRICES }).invoiceRecordId ===
            null &&
            matchDeliveryToInvoice({
                invoice: invoice(),
                deliveries: [delivery({ id: "recDL1" }), delivery({ id: "recDL2" })],
                invoices: [invoice()],
                agreedPrices: PRICES,
            }).deliveryRecordId === null
    );
}

if (isMain(import.meta.url)) standalone(title, run);

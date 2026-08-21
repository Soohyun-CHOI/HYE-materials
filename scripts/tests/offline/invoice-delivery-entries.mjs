// One material, one entry, in an invoice's delivery section (#241) — the fold, the
// added shares, the dropped silent entry and the order-scoped exception.
//
// THE MUTANT THIS FILE EXISTS TO CATCH IS THE QUIET ONE, AND IT IS ASSERTED FIRST.
// This rule's whole failure mode is silence: an entry list that returns nothing
// renders a delivery section that looks exactly like a covered invoice, every normal
// case still passes, and no other check in this repository reads these entries — so a
// file without a "something speaks" assertion would report green over a section that
// had stopped pointing at anything. It is #237's `always agree` and #242's removed
// narrowing at the same station: the feature disappears and the screen still looks
// plausible. `THE QUIET MUTANT` below is built and run, not described.
//
// THE OTHER TWO MUTANTS ARE THE ARITHMETIC ONES, and each is the plausible mistake
// rather than an invented one:
//
//   - RE-CLAMP AT THE FOLDED SCOPE — add the invoiced, add what was delivered, clamp once.
//     It reads like the tidier rule and it is wrong twice over: a surplus on one
//     ordered item cancels a shortfall on another, and the entry then disagrees with
//     the chip, which is computed off the same per-row shares here AND on `/invoices`
//     where nothing is folded. The disagreement is asserted as a property over every
//     fixture, not just on the case that shows it.
//   - ADD THE BEYOND-ORDER TERMS PER MEMBER — they belong to a `PO Items` row, so two
//     charges reaching one ordered item would print its excess twice.
//
// THE ROWS ARE THE WALK'S SHAPE AND THEIR SHARES ARE REAL. Every fixture share comes
// from `invoiceShareStatus`, so the per-pair clamp under test is the production one; a
// hand-written literal would keep passing after that clamp changed. The fold is the
// real `foldInvoiceItems` for the same reason — the join is on its `rowIds`.
//
// WHAT THIS TIER CANNOT SEE is the rendering, so whether the section reads as an
// exception list is a browser finding and is in the pull request. One state is pinned
// ONLY here because the base has no invoice in it: a covered invoice carrying one row
// with no ordered item, where the chip says `Delivered` and a single gray entry says
// why one charge was left out of the comparison.

import { foldInvoiceItems } from "../../../lib/invoiceItemFold.js";
import { invoiceShareStatus, summarizeInvoiceStatus } from "../../../lib/deliveryStatus.js";
import {
    foldedEntryShare,
    invoiceDeliveryEntries,
    orderedItemsCovered,
} from "../../../lib/invoiceDeliveryEntries.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One material, one entry, under an invoice's delivery (#241)";

const MATERIAL = "recMAT_elbow";

/**
 * One raw Invoice Item, as the page hands it to `foldInvoiceItems` — the invoice
 * item's own fields plus the `Material` the reconciliation supplies.
 */
const item = ({
    id,
    material = MATERIAL,
    itemName = "Elbow",
    size = '2"',
    unit = "EA",
    qty = 10,
    unitPrice = 12,
}) => ({ id, invoiceItemId: id, materialRecordId: material, itemName, size, unit, qty, unitPrice });

/**
 * One reconciliation row, as `getInvoiceReconciliation` returns it. `invoiced` and
 * `arrived` go through the production clamp; the two beyond-order terms are grafted
 * on the way the walk grafts them, since they are the ordered item's and not the
 * share's.
 *
 * `rawDelivered` IS NOT A FIELD OF THE WALK'S ROW. It is kept here for the re-clamp
 * mutant alone, which cannot be written without it — the clamp destroys its own
 * input, so re-deriving a share at the folded scope would need the walk to hand the
 * delivery over. That it would take a new field is part of why the real rule adds.
 */
const row = ({
    id,
    poItemId = `${id}-ordered`,
    invoiced = 10,
    delivered = 10,
    invoicedBeyondOrder = 0,
    deliveredBeyondOrder = 0,
    judged = true,
    itemName = "Elbow",
    size = '2"',
    unit = "EA",
}) => ({
    id,
    invoiceItemId: id,
    itemName,
    size,
    unit,
    poItemId: judged ? poItemId : null,
    materialRecordId: judged ? MATERIAL : null,
    rawDelivered: judged ? delivered : null,
    status: judged
        ? { ...invoiceShareStatus({ invoicedQty: invoiced, delivered }), invoicedBeyondOrder, deliveredBeyondOrder }
        : null,
});

/** Raw items and reconciliation rows in, `{ folded, rows }` out. */
function invoice(items, rows) {
    return { folded: foldInvoiceItems(items), rows };
}

// A correction split one charge of 13 across two orders at one price, and the
// delivery brought both slices. Two rows, one folded item, nothing to say.
const SPLIT_COVERED = invoice(
    [item({ id: "rec1", qty: 10 }), item({ id: "rec2", qty: 3 })],
    [
        row({ id: "rec1", poItemId: "poA", invoiced: 10, delivered: 10 }),
        row({ id: "rec2", poItemId: "poB", invoiced: 3, delivered: 3 }),
    ]
);

// The same split, short on the first half: 8 of the 10 arrived.
const SPLIT_SHORT = invoice(
    [item({ id: "rec1", qty: 10 }), item({ id: "rec2", qty: 3 })],
    [
        row({ id: "rec1", poItemId: "poA", invoiced: 10, delivered: 8 }),
        row({ id: "rec2", poItemId: "poB", invoiced: 3, delivered: 3 }),
    ]
);

// THE CROSSED CASE, which is where re-clamping at the folded scope shows itself: the
// first ordered item is 2 short and the second carries 2 the invoice does not charge.
// Reachable through hand-entered data, which this base holds by design.
const SPLIT_CROSSED = invoice(
    [item({ id: "rec1", qty: 10 }), item({ id: "rec2", qty: 3 })],
    [
        row({ id: "rec1", poItemId: "poA", invoiced: 10, delivered: 8 }),
        row({ id: "rec2", poItemId: "poB", invoiced: 3, delivered: 5 }),
    ]
);

// An ordinary invoice no correction touched: three materials, all covered.
const COVERED = invoice(
    [
        item({ id: "rec1", material: "recMAT_1", qty: 10 }),
        item({ id: "rec2", material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41 }),
        item({ id: "rec3", material: "recMAT_3", itemName: "Union", qty: 4, unitPrice: 8 }),
    ],
    [
        row({ id: "rec1", invoiced: 10, delivered: 10 }),
        row({ id: "rec2", invoiced: 7, delivered: 7, itemName: "Tee" }),
        row({ id: "rec3", invoiced: 4, delivered: 4, itemName: "Union" }),
    ]
);

// The same invoice with the middle material short — the anti-vacuity twin of COVERED.
const ONE_SHORT = invoice(
    [
        item({ id: "rec1", material: "recMAT_1", qty: 10 }),
        item({ id: "rec2", material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41 }),
        item({ id: "rec3", material: "recMAT_3", itemName: "Union", qty: 4, unitPrice: 8 }),
    ],
    [
        row({ id: "rec1", invoiced: 10, delivered: 10 }),
        row({ id: "rec2", invoiced: 7, delivered: 3, itemName: "Tee" }),
        row({ id: "rec3", invoiced: 4, delivered: 4, itemName: "Union" }),
    ]
);

// A covered invoice carrying one charge with no ordered item behind it. Not on the
// base: no invoice there matches a delivery AND holds a free-text row.
const COVERED_PLUS_FREE_TEXT = invoice(
    [
        item({ id: "rec1", material: "recMAT_1", qty: 10 }),
        item({ id: "rec9", material: null, itemName: "Freight", size: "", unit: "", qty: 1, unitPrice: 40 }),
    ],
    [
        row({ id: "rec1", invoiced: 10, delivered: 10 }),
        row({ id: "rec9", judged: false, itemName: "Freight", size: "", unit: "" }),
    ]
);

// Two charges against ONE ordered item, folded by price into one entry. #91's
// dropdown exclusion keeps the form from making this; hand-entered data can.
const TWO_CHARGES_ONE_ORDERED_ITEM = invoice(
    [item({ id: "rec1", qty: 5 }), item({ id: "rec2", qty: 5 })],
    [
        row({ id: "rec1", poItemId: "poA", invoiced: 5, delivered: 6, invoicedBeyondOrder: 4 }),
        row({ id: "rec2", poItemId: "poA", invoiced: 5, delivered: 6, invoicedBeyondOrder: 4 }),
    ]
);

// A split whose two ordered items each exceed what was ordered.
const SPLIT_BOTH_BEYOND = invoice(
    [item({ id: "rec1", qty: 10 }), item({ id: "rec2", qty: 3 })],
    [
        row({ id: "rec1", poItemId: "poA", invoiced: 10, delivered: 10, invoicedBeyondOrder: 3 }),
        row({ id: "rec2", poItemId: "poB", invoiced: 3, delivered: 3, invoicedBeyondOrder: 2 }),
    ]
);

const ALL_FIXTURES = [
    ["a covered split", SPLIT_COVERED],
    ["a split short on one half", SPLIT_SHORT],
    ["the crossed split", SPLIT_CROSSED],
    ["an ordinary covered invoice", COVERED],
    ["one material short", ONE_SHORT],
    ["a covered invoice plus a free-text charge", COVERED_PLUS_FREE_TEXT],
    ["two charges on one ordered item", TWO_CHARGES_ONE_ORDERED_ITEM],
    ["a split exceeding both ordered items", SPLIT_BOTH_BEYOND],
];

/** The page's own call, with a delivery matched. */
const entriesOf = (fixture) => invoiceDeliveryEntries({ ...fixture, hasDelivery: true });

/** The chip this invoice's rows produce, which the entries must not contradict. */
const chipOf = (fixture, hasDelivery = true) =>
    summarizeInvoiceStatus({
        itemStatuses: fixture.rows.filter((r) => r.status).map((r) => r.status),
        hasDelivery,
        excludedCount: fixture.rows.filter((r) => !r.status).length,
    }).key;

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    // THE QUIET MUTANT, FIRST, because everything below reads as a pass under it.
    log("THE QUIET MUTANT — a rule that returns nothing looks like a covered invoice:");
    const quiet = () => [];
    const shortEntries = entriesOf(SPLIT_SHORT);
    assert("a real shortfall produces an entry at all", shortEntries.length > 0);
    assert(
        "  so the empty-list mutant disagrees with the rule on `a split short on one half`",
        quiet(SPLIT_SHORT).length !== shortEntries.length
    );
    assert(
        "  and on `one material short`, which is the ordinary invoice's version of it",
        quiet(ONE_SHORT).length !== entriesOf(ONE_SHORT).length
    );
    check(
        "the entry names the material rather than a row",
        shortEntries[0]?.itemName,
        "Elbow"
    );
    assert(
        "the fold really folds these fixtures: 2 rows become 1 item",
        SPLIT_SHORT.folded.length === 1 && SPLIT_SHORT.rows.length === 2
    );

    // -----------------------------------------------------------------------
    log("");
    log("one material, one entry:");
    check("a split short on one half speaks once, not twice", entriesOf(SPLIT_SHORT).length, 1);
    check(
        "  and states the FOLDED shortfall",
        entriesOf(SPLIT_SHORT)[0].copy.verdict.text,
        "2 EA more invoiced than the matched delivery delivered"
    );
    check("a covered split says nothing at all", entriesOf(SPLIT_COVERED).length, 0);
    // The pre-#241 shape, kept as the thing being replaced: one entry per row would
    // have rendered the same name twice on the covered split.
    assert(
        "  where one entry per invoice item would have listed that material twice",
        SPLIT_COVERED.rows.length === 2 &&
            SPLIT_COVERED.rows.every((r) => r.itemName === "Elbow")
    );
    const splitShortShare = foldedEntryShare(SPLIT_SHORT.rows);
    check("a folded entry's share adds what its members invoiced", splitShortShare.invoiced, 13);
    check("  and what they were delivered", splitShortShare.delivered, 11);
    check("  and the shortfall falls out of the two", splitShortShare.invoicedNotDelivered, 2);
    check("  with nothing delivered beyond the invoice, which the clamp guarantees", splitShortShare.deliveredNotInvoiced, 0);

    // -----------------------------------------------------------------------
    log("");
    log("THE RE-CLAMP MUTANT — add the two sides, then clamp once:");
    const reclamped = (fixture) => {
        const judged = fixture.rows.filter((r) => r.status);
        const invoiced = judged.reduce((sum, r) => sum + r.status.invoiced, 0);
        // `rawDelivered` is the fixture's, not the row's — see its comment above.
        const delivered = judged.reduce((sum, r) => sum + r.rawDelivered, 0);
        return invoiceShareStatus({ invoicedQty: invoiced, delivered });
    };
    check(
        "on the crossed split the real rule still reports the shortfall",
        entriesOf(SPLIT_CROSSED)[0]?.copy.verdict?.text,
        "2 EA more invoiced than the matched delivery delivered"
    );
    check("  the mutant reports none", reclamped(SPLIT_CROSSED).invoicedNotDelivered, 0);
    assert(
        "  so one ordered item's surplus cancels another's shortfall — the clamp is per pair",
        reclamped(SPLIT_CROSSED).invoicedNotDelivered !== foldedEntryShare(SPLIT_CROSSED.rows).invoicedNotDelivered
    );
    check("  while the chip, read off the same rows, says mismatch", chipOf(SPLIT_CROSSED), "mismatch");
    assert(
        "  which is the screen the mutant makes: an amber sentence with nothing pointing at it",
        chipOf(SPLIT_CROSSED) === "mismatch" && reclamped(SPLIT_CROSSED).invoicedNotDelivered === 0
    );

    // THE PROPERTY, over every fixture rather than the one case that shows it.
    log("");
    log("the chip and the entries say one thing, on every fixture:");
    for (const [name, fixture] of ALL_FIXTURES) {
        const speaksShort = entriesOf(fixture).some(
            (e) => e.copy.verdict && e.copy.verdict.key !== "not-compared"
        );
        check(`  ${name}`, speaksShort, chipOf(fixture) === "mismatch");
    }

    // -----------------------------------------------------------------------
    log("");
    log("the two beyond-order terms add over DISTINCT ordered items:");
    check(
        "two charges on one ordered item state its excess once",
        entriesOf(TWO_CHARGES_ONE_ORDERED_ITEM)[0]?.copy.againstOrder?.text,
        "Against the ordered item: 4 EA more invoiced"
    );
    const perMember = TWO_CHARGES_ONE_ORDERED_ITEM.rows.reduce(
        (sum, r) => sum + (r.status?.invoicedBeyondOrder || 0),
        0
    );
    assert(
        "  where adding per member would print it twice (8, not 4)",
        perMember === 8 && foldedEntryShare(TWO_CHARGES_ONE_ORDERED_ITEM.rows).invoicedBeyondOrder === 4
    );
    check(
        "two ordered items each exceeding are added, and the subject agrees in number",
        entriesOf(SPLIT_BOTH_BEYOND)[0]?.copy.againstOrder?.text,
        "Against the ordered items: 5 EA more invoiced"
    );
    check("a split covers two ordered items, which is what the plural agrees with", orderedItemsCovered(SPLIT_SHORT.rows), 2);
    check(
        "  and an unfolded entry reads exactly as it did before this issue",
        entriesOf(
            invoice(
                [item({ id: "rec1", qty: 10 })],
                [row({ id: "rec1", invoiced: 10, delivered: 10, invoicedBeyondOrder: 3 })]
            )
        )[0]?.copy.againstOrder?.text,
        "Against the ordered item: 3 EA more invoiced"
    );

    // -----------------------------------------------------------------------
    log("");
    log("a silent entry has no place, and the list is what disagrees:");
    check("an invoice where everything agrees renders no entry", entriesOf(COVERED).length, 0);
    check("  the same invoice with one material short renders exactly one", entriesOf(ONE_SHORT).length, 1);
    check("  and it is the material that is short", entriesOf(ONE_SHORT)[0].itemName, "Tee");
    assert(
        "  which the silent ones would have buried: three items, one fact",
        COVERED.folded.length === 3 && entriesOf(ONE_SHORT).length === 1
    );
    check("entries keep the invoice's own item order", entriesOf(
        invoice(
            [
                item({ id: "rec1", material: "recMAT_1", qty: 10 }),
                item({ id: "rec2", material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41 }),
            ],
            [
                row({ id: "rec1", invoiced: 10, delivered: 2 }),
                row({ id: "rec2", invoiced: 7, delivered: 3, itemName: "Tee" }),
            ]
        )
    ).map((e) => e.itemName).join(","), "Elbow,Tee");

    // -----------------------------------------------------------------------
    log("");
    log("a charge with no ordered item is its own entry and always speaks:");
    const freeText = entriesOf(COVERED_PLUS_FREE_TEXT);
    check("a covered invoice with one free-text charge renders one entry", freeText.length, 1);
    check("  which says why it was left out", freeText[0].copy.verdict.text, "Not compared — no ordered item");
    check("  and the chip above it still reads delivered", chipOf(COVERED_PLUS_FREE_TEXT), "delivered");
    assert(
        "  it is a group of one by the fold's own key, not by anything here",
        COVERED_PLUS_FREE_TEXT.folded.length === 2 &&
            COVERED_PLUS_FREE_TEXT.folded.every((g) => g.rowIds.length === 1)
    );
    check("  and it carries no share to add", foldedEntryShare([COVERED_PLUS_FREE_TEXT.rows[1]]), null);

    // -----------------------------------------------------------------------
    log("");
    log("one tone per entry, which its name wears too (#241):");
    check("a short entry is an exception", entriesOf(SPLIT_SHORT)[0].tone, "exception");
    check(
        "  and it is the verdict's own tone, not a second judgment",
        entriesOf(SPLIT_SHORT)[0].tone,
        entriesOf(SPLIT_SHORT)[0].copy.verdict.tone
    );
    check(
        "an entry with no ordered item behind it is unjudged, not a problem",
        entriesOf(COVERED_PLUS_FREE_TEXT)[0].tone,
        "unjudged"
    );
    assert(
        "  so the two entry kinds do not wear one color",
        entriesOf(SPLIT_SHORT)[0].tone !== entriesOf(COVERED_PLUS_FREE_TEXT)[0].tone
    );
    // The order-scoped aside alone can put an entry in the list: no verdict to read a
    // tone off, and something exceeding an ordered item is why it is there.
    const asideOnly = entriesOf(TWO_CHARGES_ONE_ORDERED_ITEM)[0];
    check("an entry the aside alone admitted has no verdict", asideOnly.copy.verdict, null);
    check("  and is an exception all the same", asideOnly.tone, "exception");
    assert(
        "  which is a default rather than an accident: it speaks only through the aside",
        Boolean(asideOnly.copy.againstOrder) && asideOnly.copy.verdict === null
    );

    // -----------------------------------------------------------------------
    log("");
    log("nothing at all without a matched delivery (#232, unchanged):");
    for (const [name, fixture] of ALL_FIXTURES) {
        check(`  ${name}`, invoiceDeliveryEntries({ ...fixture, hasDelivery: false }).length, 0);
    }
    assert(
        "  including the free-text entry, which speaks whenever the list renders at all",
        entriesOf(COVERED_PLUS_FREE_TEXT).length === 1 &&
            invoiceDeliveryEntries({ ...COVERED_PLUS_FREE_TEXT, hasDelivery: false }).length === 0
    );

    // -----------------------------------------------------------------------
    log("");
    log("the join is on the invoice item's record id:");
    assert(
        "the fold states its membership as `rowIds`, which is what this module reads",
        SPLIT_SHORT.folded.every((g) => Array.isArray(g.rowIds) && g.rowIds.length > 0)
    );
    check(
        "a fold group whose rows are absent contributes no entry",
        invoiceDeliveryEntries({ folded: SPLIT_SHORT.folded, rows: [], hasDelivery: true }).length,
        0
    );
    check("no folded items, no entries", invoiceDeliveryEntries({ hasDelivery: true }).length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

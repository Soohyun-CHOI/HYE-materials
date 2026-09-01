// The two document lists on an order's page (#233) — the fold, the order and the
// copy.
//
// WHAT THIS TIER HAS TO CARRY HERE. The defect this issue removes is invisible to
// a browser on this base: it needs one invoice charging TWO ordered items of one
// order, and `HYE-PO-20260716-03` and `HYE-PO-20260716-02` are the only two that
// have it. So the fold is asserted over shapes the base does not hold — three
// ordered items invoiced by two invoices, a delivery filling two of them, a slice
// belonging to another order — and the browser run confirms the two real ones.
//
// THE ANTI-VACUITY PAIR IS THE POINT OF THIS FILE, not a formality. "One invoice
// charging two ordered items folds to one entry" passes just as well from a fold
// that always returns one entry, or from one that returns none because it read
// nothing. So every folding assertion is stated twice, once where folding does
// something and once where folding must NOT — two invoices on one ordered item
// have to stay two — and the counts are checked rather than the shape.
//
// THE SILENT MUTANT IS NOT FOLDING THE CHILD LIST AT ALL (#266): one line per stored
// row, which is what this page did for three issues. It throws nothing, computes no
// wrong figure and fails no check — the only symptom is a duplicate React key in a
// console, and this tier never renders a page. Same shape as #237's always-agree,
// #242's narrowing removed, #241's always-silent and #238's not-folding, and it is
// asserted FIRST below, on the input every over-delivery writes: two slices against
// ONE ordered item in ONE delivery.
//
// EVERY FIXTURE HERE PUT TWO SLICES ON TWO DIFFERENT ORDERED ITEMS, which is why the
// mutant survived #233 and #235. That shape folds by DOCUMENT and says nothing about
// what happens inside a document, so the file could pass while the list it describes
// printed one material twice.
//
// RUN RATHER THAN ASSERTED. Restoring the pre-#266 grouping — one child per stored
// row, keyed on the ordered item — fails 7 of these checks on the delivery axis, the
// first of them being the first assertion below, and dropping the unit price from the
// charge key fails 3 on the invoice axis. Both were measured on this branch.
//
// AND OVER-DELIVERY IS NOT THE ONLY PRODUCER. `recomputeOverDelivery` splits a
// straddling row on the delete path and `lib/deliveryDelete.js` creates the new piece
// on the same delivery and the same ordered item, so one delivery can hold two
// FLAGGED rows against one ordered item, and — once a deletion frees room — two
// UNFLAGGED ones. Both are inputs below, because an excess figure that read one
// flagged row instead of summing them passes the first and fails the second, and a
// fold that assumed a second row means an excess fails the third.

import {
    PO_DOCUMENTS_COPY,
    foldDeliveriesOnOrder,
    foldInvoicesOnOrder,
} from "../../../lib/poDocuments.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An order's invoices and deliveries, one entry per document (#233)";

/** This order's ordered items, in the order the table renders them. */
const ORDERED = [
    { id: "recPOI_A", poItemId: "HYE-PO-20260716-03-001", itemName: "Item A", size: '1/2"', unit: "EA" },
    { id: "recPOI_B", poItemId: "HYE-PO-20260716-03-002", itemName: "Item B", size: '3"', unit: "EA" },
    { id: "recPOI_C", poItemId: "HYE-PO-20260716-03-003", itemName: "Item C", size: "", unit: "FT" },
];

// #318 — THE FIXTURE CARRIES A DATE WHERE IT CARRIED A FLAG. `Invoices."Paid"` is
// gone from the base and a `Paid Date` is the whole of the payment, so a paid invoice
// here is one with a date. The fold derives its own `paid` from the date's presence,
// which is what the assertions below still read.
const invoice = ({
    id = "recINV1",
    invoiceId = "HYE-INV-260716-03",
    code = "V-118",
    issueDate = "2026-07-16",
    variance = false,
    paidDate = null,
} = {}) => ({
    id,
    invoiceId,
    vendorInvoiceCode: code,
    issueDate,
    varianceFlag: variance,
    paidDate,
});

const invoiceItem = ({ id = "recII1", inv = "recINV1", ordered = "recPOI_A", qty = 230, unitPrice = 13.49, variance = false } = {}) => ({
    id,
    invoice: inv ? [inv] : [],
    poItem: ordered ? [ordered] : [],
    qty,
    unitPrice,
    varianceFlag: variance,
});

const delivery = ({ id = "recDL1", deliveryId = "HYE-DL-260804-06", receivedDate = "2026-07-23" } = {}) => ({
    id,
    deliveryId,
    receivedDate,
});

const deliveryItem = ({ id = "recDI1", dl = "recDL1", ordered = "recPOI_A", qty = 15, over = false } = {}) => ({
    id,
    delivery: dl ? [dl] : [],
    poItem: ordered ? [ordered] : [],
    qty,
    overDelivered: over,
});

/** Are these child rows keyed apart? The defect #266 removed, stated directly. */
function keysAreUnique(rows) {
    const list = rows || [];
    return new Set(list.map((r) => r.key)).size === list.length;
}

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    // FIRST, because the mutant this catches is the one nothing else can see. Every
    // input below puts two rows on ONE ordered item, which is the shape the file's
    // other fixtures never had.
    log("a child list folds WITHIN a document (#266) — the silent mutant first:");
    const overDelivery = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", ordered: "recPOI_A", qty: 10, over: false }),
            deliveryItem({ id: "recDI2", ordered: "recPOI_A", qty: 5, over: true }),
        ],
        deliveries: [delivery()],
    });
    check(
        "one delivery, two slices against ONE ordered item — ONE line",
        overDelivery[0]?.brought.length,
        1
    );
    check("  the quantity is every slice added", overDelivery[0]?.brought[0]?.qty, 15);
    check("  the excess is stated apart from it", overDelivery[0]?.brought[0]?.overQty, 5);
    // The pair. Same delivery, same count of slices, DIFFERENT ordered items — a fold
    // that collapsed everything under a document would pass the case above and fail
    // this one.
    const twoItemsOneDelivery = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", ordered: "recPOI_A", qty: 10 }),
            deliveryItem({ id: "recDI2", ordered: "recPOI_B", qty: 5, over: true }),
        ],
        deliveries: [delivery()],
    });
    check(
        "  and two slices against TWO ordered items stay TWO lines",
        twoItemsOneDelivery[0]?.brought.length,
        2
    );
    check(
        "  each carrying only its own excess, never the other's",
        twoItemsOneDelivery[0]?.brought.map((b) => b.overQty).join(),
        "0,5"
    );

    // THE DEFECT ITSELF, and it is worth asserting as a key rather than only as a
    // count: React keyed these lines on the ordered item's record id, so the unfolded
    // list printed the same key twice and warned in a console no check can read.
    assert(
        "  the lines are keyed apart, which the unfolded list was not",
        keysAreUnique(overDelivery[0]?.brought)
    );

    // TWO FLAGGED ROWS AGAINST ONE ORDERED ITEM — `lib/deliveryDelete.js`'s `6, 6, 6`.
    // An excess figure that read a flagged row instead of summing them says 6.
    check(
        "two FLAGGED slices against one ordered item — the excess sums them",
        foldDeliveriesOnOrder({
            orderedItems: ORDERED,
            deliveryItems: [
                deliveryItem({ id: "recDI1", ordered: "recPOI_A", qty: 6, over: false }),
                deliveryItem({ id: "recDI2", ordered: "recPOI_A", qty: 4, over: true }),
                deliveryItem({ id: "recDI3", ordered: "recPOI_A", qty: 6, over: true }),
            ],
            deliveries: [delivery()],
        })[0]?.brought[0]?.overQty,
        10
    );

    // TWO UNFLAGGED ROWS AGAINST ONE ORDERED ITEM — what a deletion leaves once it
    // frees room and `recomputeOverDelivery` clears a flag beside a row that was
    // already within the order. The fold has to happen and say nothing about excess.
    const noExcess = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", ordered: "recPOI_A", qty: 10, over: false }),
            deliveryItem({ id: "recDI2", ordered: "recPOI_A", qty: 5, over: false }),
        ],
        deliveries: [delivery()],
    });
    check("two UNFLAGGED slices against one ordered item still fold", noExcess[0]?.brought.length, 1);
    check("  the quantity is added", noExcess[0]?.brought[0]?.qty, 15);
    check("  and NOTHING is said about excess", noExcess[0]?.brought[0]?.overQty, 0);
    check("  so the document carries no mark either", noExcess[0]?.overDelivered, false);

    // THE INVOICE AXIS, and the unit price is what makes the pair a pair. The same
    // ordered item at the same price is one entry; at two prices it is two facts, and
    // that is what settles what a folded entry says about a price that differs — it
    // never has to, because the price is part of the key.
    const oneCharge = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_A", qty: 8, unitPrice: 13.49 }),
            invoiceItem({ id: "recII2", ordered: "recPOI_A", qty: 5, unitPrice: 13.49, variance: true }),
        ],
        invoices: [invoice()],
    });
    check("two invoice items on one ordered item at ONE price fold to one", oneCharge[0]?.charges.length, 1);
    check("  the quantity is added", oneCharge[0]?.charges[0]?.qty, 13);
    check("  the price survives the fold, since it is the key", oneCharge[0]?.charges[0]?.unitPrice, 13.49);
    check(
        "  and one flagged member flags the folded entry",
        oneCharge[0]?.charges[0]?.varianceFlag,
        true
    );
    const twoPrices = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_A", qty: 8, unitPrice: 13.49 }),
            invoiceItem({ id: "recII2", ordered: "recPOI_A", qty: 5, unitPrice: 14.0 }),
        ],
        invoices: [invoice()],
    });
    check("  two invoice items at TWO prices stay two", twoPrices[0]?.charges.length, 2);
    assert("  keyed apart by the price alone", keysAreUnique(twoPrices[0]?.charges));
    check(
        "  each keeping its own price rather than one winning",
        twoPrices[0]?.charges.map((c) => c.unitPrice).join(),
        "13.49,14"
    );
    // A missing price is not a price of 0, the normalization lib/invoiceItemFold.js
    // states — so these are two invoice items and neither is `$0.00`.
    check(
        "  and a missing price is not a price of zero",
        foldInvoicesOnOrder({
            orderedItems: ORDERED,
            invoiceItems: [
                invoiceItem({ id: "recII1", ordered: "recPOI_A", unitPrice: 0 }),
                invoiceItem({ id: "recII2", ordered: "recPOI_A", unitPrice: null }),
            ],
            invoices: [invoice()],
        })[0]?.charges.length,
        2
    );

    // -----------------------------------------------------------------------
    log("");
    log("anti-vacuity — the fold reads its inputs and is not a constant:");
    check(
        "no invoice items, no entries",
        foldInvoicesOnOrder({ orderedItems: ORDERED, invoiceItems: [], invoices: [] }).length,
        0
    );
    check(
        "no delivery items, no entries",
        foldDeliveriesOnOrder({ orderedItems: ORDERED, deliveryItems: [], deliveries: [] }).length,
        0
    );
    // The pair that separates "folded correctly" from "always returns one".
    const oneInvoiceTwoItems = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", ordered: "recPOI_B", qty: 13, unitPrice: 41.07 }),
        ],
        invoices: [invoice()],
    });
    const twoInvoicesOneItem = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", inv: "recINV1", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", inv: "recINV2", ordered: "recPOI_A", qty: 15 }),
        ],
        invoices: [invoice(), invoice({ id: "recINV2", invoiceId: "HYE-INV-260804-05" })],
    });
    check("ONE invoice charging two ordered items folds to one entry", oneInvoiceTwoItems.length, 1);
    check(
        "  and folding is not a constant: TWO invoices on one ordered item stay two",
        twoInvoicesOneItem.length,
        2
    );
    check("  the folded entry kept both items rather than one", oneInvoiceTwoItems[0]?.charges.length, 2);
    check("  and each unfolded entry carries exactly its own", twoInvoicesOneItem[0]?.charges.length, 1);

    // The same pair on the delivery axis.
    const oneDeliveryTwoItems = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", ordered: "recPOI_A" }),
            deliveryItem({ id: "recDI2", ordered: "recPOI_B", qty: 13 }),
        ],
        deliveries: [delivery()],
    });
    const twoDeliveriesOneItem = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", dl: "recDL1", ordered: "recPOI_A" }),
            deliveryItem({ id: "recDI2", dl: "recDL2", ordered: "recPOI_A", qty: 5 }),
        ],
        deliveries: [delivery(), delivery({ id: "recDL2", deliveryId: "HYE-DL-260804-07", receivedDate: "2026-07-24" })],
    });
    check("ONE delivery filling two ordered items folds to one entry", oneDeliveryTwoItems.length, 1);
    check(
        "  and TWO deliveries on one ordered item stay two",
        twoDeliveriesOneItem.length,
        2
    );
    check("  the folded entry kept both slices", oneDeliveryTwoItems[0]?.brought.length, 2);

    // -----------------------------------------------------------------------
    // THE HEADER FACTS ARE WHAT THE FOLD EXISTS TO SAY ONCE. Before #233 they were
    // rendered once per row an invoice charged; the entry holds one copy.
    log("");
    log("a header fact appears once per document, not once per item:");
    const paidTwice = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", ordered: "recPOI_B" }),
            invoiceItem({ id: "recII3", ordered: "recPOI_C" }),
        ],
        invoices: [invoice({ paidDate: "2026-08-14", variance: true })],
    });
    check("three charges, one entry", paidTwice.length, 1);
    check("  carrying one `paid`", [paidTwice[0]?.paid].filter(Boolean).length, 1);
    check("  and one header variance", [paidTwice[0]?.varianceFlag].filter(Boolean).length, 1);
    check("  while the three charges survive as three", paidTwice[0]?.charges.length, 3);

    // -----------------------------------------------------------------------
    // Rows reached through this order's ordered items can still name something
    // else, and an entry with no document behind it would be a nameless row.
    log("");
    log("what is dropped rather than rendered without a name:");
    check(
        "an invoice item charging ANOTHER order's ordered item",
        foldInvoicesOnOrder({
            orderedItems: ORDERED,
            invoiceItems: [invoiceItem({ ordered: "recPOI_ELSEWHERE" })],
            invoices: [invoice()],
        }).length,
        0
    );
    check(
        "an invoice item with no ordered item at all (a free-text row)",
        foldInvoicesOnOrder({
            orderedItems: ORDERED,
            invoiceItems: [invoiceItem({ ordered: null })],
            invoices: [invoice()],
        }).length,
        0
    );
    check(
        "an invoice item whose invoice is not in the pool",
        foldInvoicesOnOrder({
            orderedItems: ORDERED,
            invoiceItems: [invoiceItem({ inv: "recINV_MISSING" })],
            invoices: [invoice()],
        }).length,
        0
    );
    // The unattributable over-delivery lib/airtable/deliveryItems.js describes: no
    // `PO Item`, so no order's list can reach it. Asserted so the silence is a
    // decision rather than a surprise.
    check(
        "a delivery item with no ordered item — the unattributable over-delivery",
        foldDeliveriesOnOrder({
            orderedItems: ORDERED,
            deliveryItems: [deliveryItem({ ordered: null })],
            deliveries: [delivery()],
        }).length,
        0
    );

    // -----------------------------------------------------------------------
    log("");
    log("over-delivery folds UP from any slice, never from all of them:");
    const oneSliceOver = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", ordered: "recPOI_A", over: false }),
            deliveryItem({ id: "recDI2", ordered: "recPOI_B", over: true }),
        ],
        deliveries: [delivery()],
    });
    check("one flagged slice marks the delivery", oneSliceOver[0]?.overDelivered, true);
    // BOTH ORDERS, BECAUSE ONE OF THEM PASSES A LAST-SLICE-WINS BUG. A mutation
    // that assigned rather than accumulated survived the case above, where the
    // flagged slice happens to come last; it fails this one, where it comes first.
    check(
        "  and still marks it when the flagged slice comes FIRST",
        foldDeliveriesOnOrder({
            orderedItems: ORDERED,
            deliveryItems: [
                deliveryItem({ id: "recDI1", ordered: "recPOI_A", over: true }),
                deliveryItem({ id: "recDI2", ordered: "recPOI_B", over: false }),
            ],
            deliveries: [delivery()],
        })[0]?.overDelivered,
        true
    );
    check(
        "  and no flagged slice leaves it unmarked",
        foldDeliveriesOnOrder({
            orderedItems: ORDERED,
            deliveryItems: [deliveryItem({ over: false })],
            deliveries: [delivery()],
        })[0]?.overDelivered,
        false
    );

    // -----------------------------------------------------------------------
    // Mutation: reverse either comparator and these flip. The inputs are handed in
    // the WRONG order on purpose, so a fold that simply preserved input order would
    // fail rather than pass by luck.
    log("");
    log("ordering, from inputs deliberately given the wrong way round:");
    const unsorted = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", inv: "recINV_OLD", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", inv: "recINV_NEW", ordered: "recPOI_B" }),
        ],
        invoices: [
            invoice({ id: "recINV_OLD", invoiceId: "HYE-INV-260716-01" }),
            invoice({ id: "recINV_NEW", invoiceId: "HYE-INV-260804-09" }),
        ],
    });
    check(
        "invoices newest first, by `Invoice ID` — the order /invoices uses",
        unsorted.map((i) => i.invoiceId).join(),
        "HYE-INV-260804-09,HYE-INV-260716-01"
    );
    const deliveries = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", dl: "recDL_OLD" }),
            deliveryItem({ id: "recDI2", dl: "recDL_NEW" }),
            deliveryItem({ id: "recDI3", dl: "recDL_UNDATED" }),
        ],
        deliveries: [
            delivery({ id: "recDL_OLD", deliveryId: "HYE-DL-260801-01", receivedDate: "2026-07-01" }),
            delivery({ id: "recDL_NEW", deliveryId: "HYE-DL-260804-06", receivedDate: "2026-07-23" }),
            delivery({ id: "recDL_UNDATED", deliveryId: "HYE-DL-260804-99", receivedDate: "" }),
        ],
    });
    check(
        "deliveries newest first, undated LAST — sortCandidates' call",
        deliveries.map((d) => d.deliveryId).join(),
        "HYE-DL-260804-06,HYE-DL-260801-01,HYE-DL-260804-99"
    );
    // A charge list follows the ORDER's item order, not the order the rows arrived
    // in, so two documents read their charges down the same axis as the table.
    const reversedCharges = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_C" }),
            invoiceItem({ id: "recII2", ordered: "recPOI_A" }),
        ],
        invoices: [invoice()],
    });
    check(
        "charges follow the order's own item order",
        reversedCharges[0]?.charges.map((c) => c.itemName).join(),
        "Item A,Item C"
    );

    // -----------------------------------------------------------------------
    log("");
    log("copy — one voice per fact, and #166's vocabulary:");
    const sentences = [
        PO_DOCUMENTS_COPY.invoices.empty().text,
        PO_DOCUMENTS_COPY.deliveries.empty().text,
        PO_DOCUMENTS_COPY.invoices.charge({ itemName: "Item A", size: '1/2"', unit: "EA", qty: 230, unitPrice: 13.49 }).text,
        PO_DOCUMENTS_COPY.deliveries.brought({ itemName: "Item B", size: '3"', unit: "EA", qty: 13 }).text,
    ];
    const words = [
        ...sentences,
        PO_DOCUMENTS_COPY.invoices.heading,
        PO_DOCUMENTS_COPY.deliveries.heading,
        PO_DOCUMENTS_COPY.badge.paid,
        PO_DOCUMENTS_COPY.badge.notPaid,
        PO_DOCUMENTS_COPY.badge.overDelivered,
    ];
    assert("every builder returns something to render", words.every((w) => w && w.length > 0));
    for (const [word, why] of [
        ["arriv", "`delivered`, never `arrived`"],
        ["delivery", "`delivery` — the table is Deliveries"],
        ["over-billed", "facts, never verdicts"],
        ["missing", "facts, never verdicts"],
    ]) {
        assert(
            `  nothing says "${word}" — ${why}`,
            !words.some((w) => w.toLowerCase().includes(word))
        );
    }
    assert(
        "  nothing says `line`, which names no row of any table (#280)",
        !words.some((w) => /\bline\b/i.test(w))
    );
    assert("  the two empty states end in a full stop", sentences.slice(0, 2).every((t) => t.endsWith(".")));
    // THE TWO VARIANCE BADGES LEFT THIS MODULE IN #179 and are asserted in
    // `offline/variance-copy.mjs` now. They were here as literals pinned to the
    // invoice detail's own words, with a comment saying the agreement mattered more
    // than the strings; that agreement is structural now — one constant, read by
    // this page and by both invoice screens — so a copy of the words here would be
    // the second home the move removed.
    assert(
        "  and this module no longer names either variance kind",
        PO_DOCUMENTS_COPY.badge.headerVariance === undefined &&
            PO_DOCUMENTS_COPY.badge.itemVariance === undefined
    );
    // #309 — A STRING, NOT A BUILDER, and that is the assertion rather than a detail
    // of it. This read `badge.paid({})` and pinned that a paid badge with no date
    // still says `✓ Paid`, which was the whole hazard: one badge with two readings,
    // the shorter of which looked like missing data. The date is stated on the
    // invoice's own page and marked nowhere, so there is no argument left to pass.
    check("the paid badge is one word for one fact", PO_DOCUMENTS_COPY.badge.paid, "✓ Paid");
    assert("  and it is a string rather than a builder", typeof PO_DOCUMENTS_COPY.badge.paid === "string");
    // ANTI-VACUITY: the two badges this pair is read beside are still builders'
    // neighbours in the same object, so `typeof` has to be seen telling them apart.
    assert(
        "  while the entry builders around it are still functions",
        typeof PO_DOCUMENTS_COPY.invoices.charge === "function"
    );

    // -----------------------------------------------------------------------
    log("");
    log("an entry names what its invoice charged, with the figures beside it:");
    const charge = PO_DOCUMENTS_COPY.invoices.charge({
        itemName: "Item A",
        size: '1/2"',
        unit: "EA",
        qty: 230,
        unitPrice: 13.49,
    }).text;
    assert(`  ${charge}`, charge.includes("Item A") && charge.includes("230"));
    // MONEY IS FORMATTED, WHICH IS THE ONE THING THAT MAKES THIS PAGE AGREE WITH
    // ITSELF. The table above it and the invoice detail's items table both go
    // through `formatUSD`; this entry printed the raw number until #233. Pinned on
    // the `$` and the separator rather than on the whole string, so a locale
    // formatter's spacing is not what a check fails on.
    assert(`  the price is formatted, not raw`, charge.includes("$13.49") && !/@ 13\.49/.test(charge));
    check(
        "  and a thousands separator survives the round trip",
        PO_DOCUMENTS_COPY.invoices
            .charge({ itemName: "Item A", qty: 1, unitPrice: 1234.5 })
            .text.includes("$1,234.50"),
        true
    );
    // A charge with no price says nothing about price rather than `$0.00`, which
    // would be a figure the invoice item does not carry.
    assert(
        "  an entry with no unit price prints no money at all",
        !PO_DOCUMENTS_COPY.invoices.charge({ itemName: "Item A", qty: 5 }).text.includes("$")
    );
    const brought = PO_DOCUMENTS_COPY.deliveries.brought({
        itemName: "Item B",
        size: '3"',
        unit: "EA",
        qty: 13,
    }).text;
    assert(`  ${brought}`, brought.includes("Item B") && brought.includes("13"));
    // A blank Size is allowed on a PO Item, and must not leave a dangling space.
    assert(
        "  a blank size leaves no trailing space before the dash",
        PO_DOCUMENTS_COPY.deliveries
            .brought({ itemName: "Item C", size: "", unit: "FT", qty: 4 })
            .text.startsWith("Item C —")
    );
}

if (isMain(import.meta.url)) standalone(title, run);

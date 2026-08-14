// The two document lists on an order's page (#233) — the fold, the order and the
// copy.
//
// WHAT THIS TIER HAS TO CARRY HERE. The defect this issue removes is invisible to
// a browser on this base: it needs one invoice charging TWO ordered items of one
// order, and `HYE-PO-20260716-03` and `HYE-PO-20260716-02` are the only two that
// have it. So the fold is asserted over shapes the base does not hold — three
// ordered items billed by two invoices, an arrival filling two of them, a slice
// belonging to another order — and the browser run confirms the two real ones.
//
// THE ANTI-VACUITY PAIR IS THE POINT OF THIS FILE, not a formality. "One invoice
// charging two ordered items folds to one entry" passes just as well from a fold
// that always returns one entry, or from one that returns none because it read
// nothing. So every folding assertion is stated twice, once where folding does
// something and once where folding must NOT — two invoices on one ordered item
// have to stay two — and the counts are checked rather than the shape.

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

const invoice = ({
    id = "recINV1",
    invoiceId = "HYE-INV-260716-03",
    code = "V-118",
    issueDate = "2026-07-16",
    variance = false,
    paid = false,
    paidDate = "",
} = {}) => ({
    id,
    invoiceId,
    vendorInvoiceCode: code,
    issueDate,
    varianceFlag: variance,
    paid,
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

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
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
    const oneBillTwoItems = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", ordered: "recPOI_B", qty: 13, unitPrice: 41.07 }),
        ],
        invoices: [invoice()],
    });
    const twoBillsOneItem = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", inv: "recINV1", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", inv: "recINV2", ordered: "recPOI_A", qty: 15 }),
        ],
        invoices: [invoice(), invoice({ id: "recINV2", invoiceId: "HYE-INV-260804-05" })],
    });
    check("ONE invoice charging two ordered items folds to one entry", oneBillTwoItems.length, 1);
    check(
        "  and folding is not a constant: TWO invoices on one ordered item stay two",
        twoBillsOneItem.length,
        2
    );
    check("  the folded entry kept both charges rather than one", oneBillTwoItems[0]?.charges.length, 2);
    check("  and each unfolded entry carries exactly its own", twoBillsOneItem[0]?.charges.length, 1);

    // The same pair on the delivery axis.
    const oneArrivalTwoItems = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", ordered: "recPOI_A" }),
            deliveryItem({ id: "recDI2", ordered: "recPOI_B", qty: 13 }),
        ],
        deliveries: [delivery()],
    });
    const twoArrivalsOneItem = foldDeliveriesOnOrder({
        orderedItems: ORDERED,
        deliveryItems: [
            deliveryItem({ id: "recDI1", dl: "recDL1", ordered: "recPOI_A" }),
            deliveryItem({ id: "recDI2", dl: "recDL2", ordered: "recPOI_A", qty: 5 }),
        ],
        deliveries: [delivery(), delivery({ id: "recDL2", deliveryId: "HYE-DL-260804-07", receivedDate: "2026-07-24" })],
    });
    check("ONE delivery filling two ordered items folds to one entry", oneArrivalTwoItems.length, 1);
    check(
        "  and TWO deliveries on one ordered item stay two",
        twoArrivalsOneItem.length,
        2
    );
    check("  the folded entry kept both slices", oneArrivalTwoItems[0]?.brought.length, 2);

    // -----------------------------------------------------------------------
    // THE HEADER FACTS ARE WHAT THE FOLD EXISTS TO SAY ONCE. Before #233 they were
    // rendered once per row an invoice charged; the entry holds one copy.
    log("");
    log("a header fact appears once per document, not once per charge:");
    const paidTwice = foldInvoicesOnOrder({
        orderedItems: ORDERED,
        invoiceItems: [
            invoiceItem({ id: "recII1", ordered: "recPOI_A" }),
            invoiceItem({ id: "recII2", ordered: "recPOI_B" }),
            invoiceItem({ id: "recII3", ordered: "recPOI_C" }),
        ],
        invoices: [invoice({ paid: true, paidDate: "2026-07-27", variance: true })],
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
    const arrivals = foldDeliveriesOnOrder({
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
        arrivals.map((d) => d.deliveryId).join(),
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
        PO_DOCUMENTS_COPY.badge.headerVariance,
        PO_DOCUMENTS_COPY.badge.itemVariance,
        PO_DOCUMENTS_COPY.badge.paid({ paidDate: "2026-07-27" }),
        PO_DOCUMENTS_COPY.badge.notPaid,
        PO_DOCUMENTS_COPY.badge.overDelivered,
    ];
    assert("every builder returns something to render", words.every((w) => w && w.length > 0));
    for (const [word, why] of [
        ["arriv", "`delivered`, never `arrived`"],
        ["shipment", "`delivery` — the table is Deliveries"],
        ["over-billed", "facts, never verdicts"],
        ["missing", "facts, never verdicts"],
    ]) {
        assert(
            `  nothing says "${word}" — ${why}`,
            !words.some((w) => w.toLowerCase().includes(word))
        );
    }
    assert(
        "  nothing says `line`, which names a Job's Lines row",
        !words.some((w) => /\bline\b/i.test(w))
    );
    assert("  the two empty states end in a full stop", sentences.slice(0, 2).every((t) => t.endsWith(".")));
    // The two variance words are on one screen and must not be one word: the
    // header flag compares the invoice's totals, the charge flag compares this
    // charge against the order.
    assert(
        "  the two variance badges are two different words",
        PO_DOCUMENTS_COPY.badge.headerVariance !== PO_DOCUMENTS_COPY.badge.itemVariance
    );
    // EACH IS THE WORD THE INVOICE DETAIL ALREADY USES FOR THAT FLAG, pinned as a
    // literal because the point is agreement across two screens rather than any
    // property of the strings. `⚠ Header Variance` is not a word this issue would
    // have chosen — #179 has already picked `Total mismatch` for it — but coining
    // a better one here would give one flag two screen words, which is the drift
    // that issue exists to remove. It changes on both pages or neither.
    check(
        "  the header badge is the invoice detail's word, unchanged",
        PO_DOCUMENTS_COPY.badge.headerVariance,
        "⚠ Header Variance"
    );
    check(
        "  and the charge badge is its items table's",
        PO_DOCUMENTS_COPY.badge.itemVariance,
        "⚠ Variance"
    );
    check(
        "a paid badge with no date still reads",
        PO_DOCUMENTS_COPY.badge.paid({}),
        "✓ Paid"
    );

    // -----------------------------------------------------------------------
    log("");
    log("a charge names what it charged, with the figures beside it:");
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
    // through `formatUSD`; this charge printed the raw number until #233. Pinned on
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
        "  a charge with no unit price prints no money at all",
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

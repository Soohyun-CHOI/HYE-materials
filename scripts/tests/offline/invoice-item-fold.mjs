// Folding an invoice's split invoice items back into one (#167) — the pure rule.
//
// What a pass does NOT prove: that the `materialRecordId` handed to the fold really
// came from the row's ordered item rather than from somewhere else. That is
// lib/deliveryReconciliation.js's property and is measured credentialed.

import { foldInvoiceItems, foldKey } from "../../../lib/invoiceItemFold.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Invoice item fold — a split line reads as one again (#167)";

const row = (over) => ({
    id: "recA",
    materialRecordId: "recMat1",
    itemName: "Pipe",
    size: '2"',
    unit: "EA",
    qty: 10,
    unitPrice: 12,
    amount: 120,
    ...over,
});

export function run({ check, log, assert }) {
    log("the key is Material + unit price, and both halves are load-bearing:");
    check(
        "same material, same price — one row",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", qty: 2, amount: 24 })]).length,
        1
    );
    check(
        "  quantities sum",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", qty: 2, amount: 24 })])[0].qty,
        12
    );
    check(
        "  and amounts",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", qty: 2, amount: 24 })])[0].amount,
        144
    );
    check(
        "  the unit price is shared by construction, not summed",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", qty: 2, amount: 24 })])[0].unitPrice,
        12
    );
    check(
        "  and it says how many rows it stands for",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", qty: 2, amount: 24 })])[0].rowCount,
        2
    );

    // A vendor invoicing one material at two prices is two facts, and a split cannot
    // change the price — so a price difference means these were never one invoice item.
    check(
        "same material, DIFFERENT price — two rows",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", unitPrice: 13 })]).length,
        2
    );
    check(
        "different material, same price — two rows",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", materialRecordId: "recMat2" })]).length,
        2
    );

    log("");
    log("a row with no Material is never folded, and that is not a fallback:");
    // A split can only produce rows carrying the link, since the overage PO Item
    // gets its Material from #18's cache during the same generation. So a row
    // without one cannot be half of a split, and folding it on name/size/unit could
    // merge two invoice items that were never one.
    const noMaterial = [
        row({ id: "a", materialRecordId: null }),
        row({ id: "b", materialRecordId: null }),
    ];
    check("two identical free-text rows stay two", foldInvoiceItems(noMaterial).length, 2);
    assert(
        "they key on their own record id, so a group of one is structural",
        foldKey({ id: "a", materialRecordId: null }) !== foldKey({ id: "b", materialRecordId: null })
    );
    check("and each reports one row", foldInvoiceItems(noMaterial)[0].rowCount, 1);

    log("");
    log("the key, pinned directly rather than inferred from what merged:");
    check("material + price", foldKey(row({})), "mat::recMat1::12");
    check("a missing price is neither null nor 0", foldKey(row({ unitPrice: undefined })), "mat::recMat1::");
    check("  and 0 is its own price", foldKey(row({ unitPrice: 0 })), "mat::recMat1::0");
    assert("which are different keys", foldKey(row({ unitPrice: undefined })) !== foldKey(row({ unitPrice: 0 })));
    check("no material falls back to the row id", foldKey({ id: "recX", materialRecordId: null }), "row::recX");
    check("nullish does not throw", foldKey(null), "row::");

    log("");
    log("first-appearance order, so a fold never moves a line the reader wanted:");
    const ordered = foldInvoiceItems([
        row({ id: "a", materialRecordId: "recMat2", itemName: "Elbow" }),
        row({ id: "b", materialRecordId: "recMat1", itemName: "Pipe" }),
        row({ id: "c", materialRecordId: "recMat2", itemName: "Elbow" }),
    ]);
    check("two groups", ordered.length, 2);
    check("the first row's group comes first", ordered[0].itemName, "Elbow");
    check("  and it absorbed the later one", ordered[0].rowCount, 2);
    check("the second group keeps its place", ordered[1].itemName, "Pipe");

    log("");
    log("a variance on either half flags the folded row:");
    check(
        "second half flagged",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b", varianceFlag: true })])[0].varianceFlag,
        true
    );
    check(
        "first half flagged",
        foldInvoiceItems([row({ id: "a", varianceFlag: true }), row({ id: "b" })])[0].varianceFlag,
        true
    );
    check(
        "neither",
        foldInvoiceItems([row({ id: "a" }), row({ id: "b" })])[0].varianceFlag,
        false
    );

    log("");
    log("remarks are a human's own words, so distinct ones are kept:");
    const remarked = foldInvoiceItems([
        row({ id: "a", remark: "price agreed by phone" }),
        row({ id: "b", remark: "extra pallet" }),
    ]);
    check("both", remarked[0].remark, "price agreed by phone; extra pallet");
    check(
        "duplicates are not repeated",
        foldInvoiceItems([row({ id: "a", remark: "same" }), row({ id: "b", remark: "same" })])[0].remark,
        "same"
    );
    check(
        "blank ones contribute nothing",
        foldInvoiceItems([row({ id: "a", remark: "" }), row({ id: "b", remark: "  " })])[0].remark,
        ""
    );

    log("");
    log("degenerate inputs:");
    check("no rows", foldInvoiceItems([]).length, 0);
    check("nullish does not throw", foldInvoiceItems(null).length, 0);
    check("a null row is skipped", foldInvoiceItems([null, row({})]).length, 1);
    check("blank fields do not become 'undefined'", foldInvoiceItems([{ id: "x" }])[0].itemName, "");
}

if (isMain(import.meta.url)) standalone(title, run);

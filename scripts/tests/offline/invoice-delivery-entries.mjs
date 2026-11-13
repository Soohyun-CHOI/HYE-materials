// One material, one row, in an invoice's delivery section (#241, #640) — the fold, the
// figures it adds, and the row every item now has.
//
// THE MUTANT THIS FILE EXISTS TO CATCH IS THE QUIET ONE, AND IT IS ASSERTED FIRST. A
// row list that returns nothing renders a delivery section with the chip and the
// deliveries and no table — a page that still looks plausible — and no other check
// reads these rows. #241 returned only rows that disagreed; #640 gives every item a row,
// so "nothing comes back" is now always the defect, and it is built and run below.
//
// THE OTHER TWO MUTANTS ARE THE ARITHMETIC ONES, and each is the plausible mistake:
//
//   - RE-FILL AT THE FOLDED SCOPE — add each side, then compare once. A fold can span
//     an ordered item and its overage order's; adding their totals and comparing would
//     let a surplus on one cover a shortfall on the other, and the row would then
//     disagree with the chip, which reads the per-item `filled` here AND on `/invoices`
//     where nothing is folded. So the row adds what each member was given.
//   - ADD THE ORDERED ITEM'S TOTALS PER MEMBER — they belong to a `PO Items` row, so
//     two invoice items reaching one ordered item would print its totals twice.
//
// THE FOLD IS THE REAL `foldInvoiceItems`, so the join under test is on its own
// `rowIds`; and the chip each fixture is held against is the real
// `summarizeInvoiceStatus`.
//
// WHAT THIS TIER CANNOT SEE is the rendering — that the table reads as one row per item
// with the waiting ones in amber — which is a browser finding in the pull request.

import { foldInvoiceItems } from "../../../lib/invoiceItemFold.js";
import { summarizeInvoiceStatus } from "../../../lib/deliveryStatus.js";
import { foldedEntryFigures, invoiceDeliveryEntries } from "../../../lib/invoiceDeliveryEntries.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One material, one row, under an invoice's delivery (#241, #640)";

const MATERIAL = "recMAT_elbow";

/** One raw Invoice Item, as the page hands it to `foldInvoiceItems`. */
const item = ({ id, material = MATERIAL, itemName = "Elbow", size = '2"', unit = "EA", qty = 10, unitPrice = 12 }) => ({
    id,
    invoiceItemId: id,
    materialRecordId: material,
    itemName,
    size,
    unit,
    qty,
    unitPrice,
});

/**
 * One reconciliation row, as `getInvoiceReconciliation` returns it: this invoice item's
 * own quantity and what the fill gave it, then its ordered item's three totals.
 */
const row = ({ id, poItemRecordId = `${id}-ordered`, qty = 10, filled = 10, ordered = 10, delivered = 10, invoiced = 10 }) => ({
    id,
    invoiceItemId: id,
    poItemRecordId,
    unit: "EA",
    qty,
    filled,
    ordered,
    delivered,
    invoiced,
});

/** The fold and the rows for a fixture of raw items and walk rows. */
const entriesOf = ({ items, rows }) => invoiceDeliveryEntries({ folded: foldInvoiceItems(items), rows });

/** The chip the same rows produce, which a row may never contradict. */
const chipOf = (rows) => summarizeInvoiceStatus({ items: rows.map((r) => ({ qty: r.qty, filled: r.filled })) }).key;

// An ordinary invoice: one item, answered in full.
const COVERED = { items: [item({ id: "recII1" })], rows: [row({ id: "recII1" })] };
// One item still waiting: 200 charged, 150 delivered to date.
const WAITING = {
    items: [item({ id: "recII1", qty: 200 })],
    rows: [row({ id: "recII1", qty: 200, filled: 150, ordered: 200, delivered: 150, invoiced: 200 })],
};
// AN OVERAGE SPLIT: one material on one invoice, charged against an order of 10 and its
// overage order of 2, folded back into one row by the items table's own rule.
const SPLIT = {
    items: [item({ id: "recIIa", qty: 10 }), item({ id: "recIIb", qty: 2 })],
    rows: [
        row({ id: "recIIa", poItemRecordId: "recPOI_orig", qty: 10, filled: 10, ordered: 10, delivered: 10, invoiced: 10 }),
        row({ id: "recIIb", poItemRecordId: "recPOI_over", qty: 2, filled: 0, ordered: 2, delivered: 0, invoiced: 2 }),
    ],
};
// TWO INVOICE ITEMS ON ONE ORDERED ITEM — what #91 keeps the form from making and a
// hand edit can; its totals must be counted once.
const TWO_ON_ONE = {
    items: [item({ id: "recIIx", qty: 4 }), item({ id: "recIIy", qty: 6 })],
    rows: [
        row({ id: "recIIx", poItemRecordId: "recPOI_one", qty: 4, filled: 4, ordered: 10, delivered: 8, invoiced: 10 }),
        row({ id: "recIIy", poItemRecordId: "recPOI_one", qty: 6, filled: 4, ordered: 10, delivered: 8, invoiced: 10 }),
    ],
};
const FIXTURES = { COVERED, WAITING, SPLIT, TWO_ON_ONE };

export function run({ check, assert, log }) {
    log("THE QUIET MUTANT — a rule that returns nothing still renders a plausible page:");
    const silent = () => [];
    for (const [name, fixture] of Object.entries(FIXTURES)) {
        check(`  ${name} has one row per folded item`, entriesOf(fixture).length, foldInvoiceItems(fixture.items).length);
    }
    assert(
        "  so the silent rule disagrees on every fixture",
        Object.values(FIXTURES).every((f) => silent(f).length !== entriesOf(f).length)
    );
    check("a covered invoice still has its row (#640 reversed #241's silence)", entriesOf(COVERED).length, 1);

    log("");
    log("one material, one row, with the four figures:");
    const [split] = entriesOf(SPLIT);
    check("an overage split folds to one row", entriesOf(SPLIT).length, 1);
    check("  this invoice's quantity is both members'", split.figures.qty, 12);
    check("  and what arrived is what each was given", split.figures.filled, 10);
    check("  the ordered totals add across its two ordered items", split.figures.ordered, 12);
    check("  as do delivered", split.figures.delivered, 10);
    check("  and invoiced", split.figures.invoiced, 12);
    check("  over two ordered items", split.figures.orderedItems, 2);
    check("  and the row says so in words", split.copy.thisInvoice.text, "10 of 12 EA delivered");

    log("");
    log("THE RE-FILL MUTANT — add the two sides, then compare once:");
    // A surplus on one member's ordered item must not cover the other's shortfall.
    const SURPLUS = {
        items: [item({ id: "recIIa", qty: 5 }), item({ id: "recIIb", qty: 5 })],
        rows: [
            row({ id: "recIIa", poItemRecordId: "recPOI_a", qty: 5, filled: 5, ordered: 5, delivered: 9, invoiced: 5 }),
            row({ id: "recIIb", poItemRecordId: "recPOI_b", qty: 5, filled: 1, ordered: 5, delivered: 1, invoiced: 5 }),
        ],
    };
    const [surplus] = entriesOf(SURPLUS);
    const refilled = Math.min(surplus.figures.qty, surplus.figures.delivered);
    check("the real row adds what each member was given", surplus.figures.filled, 6);
    assert("  where re-filling the sums would claim all 10", refilled === 10 && refilled !== surplus.figures.filled);

    log("");
    log("the chip and the rows say one thing, on every fixture:");
    for (const [name, fixture] of Object.entries(FIXTURES)) {
        const anyWaiting = entriesOf(fixture).some((e) => e.tone === "waiting");
        check(`  ${name}: a waiting row exactly when the chip waits`, anyWaiting, chipOf(fixture.rows) === "awaiting-delivery");
    }

    log("");
    log("the ordered item's totals add over DISTINCT ordered items:");
    const [twoOnOne] = entriesOf(TWO_ON_ONE);
    check("one ordered item's ordered quantity, counted once", twoOnOne.figures.ordered, 10);
    check("  and its delivered total", twoOnOne.figures.delivered, 8);
    check("  while this invoice's own quantities add", twoOnOne.figures.qty, 10);
    check("  over one ordered item", twoOnOne.figures.orderedItems, 1);
    // ANTI-VACUITY: two DIFFERENT ordered items do add.
    check("two ordered items add", foldedEntryFigures(SPLIT.rows).ordered, 12);
    check("an empty member list has no figures", foldedEntryFigures([]), null);

    log("");
    log("a fold group whose rows all dropped out has no row (#278):");
    // An item whose ordered item did not resolve is dropped by the walk, so its fold
    // group joins to nothing — the crash guard, surviving without a sentence.
    check("no rows, no entries", entriesOf({ items: COVERED.items, rows: [] }).length, 0);
    check("nullish does not throw", invoiceDeliveryEntries().length, 0);

    log("");
    log("one tone per row, which its name wears too:");
    check("a waiting row is waiting", entriesOf(WAITING)[0].tone, "waiting");
    check("  its last cell says how much", entriesOf(WAITING)[0].copy.thisInvoice.text, "150 of 200 EA delivered");
    check("a row answered in full carries no tone", entriesOf(COVERED)[0].tone, undefined);

    log("");
    log("the join is on the invoice item's record id:");
    const renamed = { items: [item({ id: "recII1" })], rows: [{ ...row({ id: "recII1" }), invoiceItemId: "HYE-INV-X-001" }] };
    check("a row joins by its record id, not its printed id", entriesOf(renamed).length, 1);
    const mismatched = { items: [item({ id: "recII1" })], rows: [row({ id: "recII9" })] };
    check("  and a row for another item joins nothing", entriesOf(mismatched).length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

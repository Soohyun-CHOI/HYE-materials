// Ad hoc verification for issue #92 — mirrors app/api/invoices/detect-po/
// route.js's core logic exactly (PDF text -> regex -> getPOById ->
// isPoOpen), against real test PDFs, without going through the browser's
// file input (not scriptable in this environment). Also mirrors
// InvoiceForm.js's single-PO message-building logic exactly, to directly
// verify the actual user-facing text, not just the raw confirmed/
// unconfirmed data.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-detect-po-92.mjs

import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";
import { getPOById, isPoOpen } from "../../lib/airtable/purchaseOrders.js";

const PO_ID_PATTERN = /HYE-PO-\d{8}-\d{2}/g;

async function detectFromFile(path) {
    const bytes = readFileSync(path);
    const parser = new PDFParse({ data: bytes });
    const { pages } = await parser.getText();
    const fullText = pages.map((p) => p.text).join("\n");

    const matches = [...new Set(fullText.match(PO_ID_PATTERN) || [])];
    const lookups = await Promise.all(matches.map((poId) => getPOById(poId)));

    const confirmed = [];
    const unconfirmed = [];
    matches.forEach((poId, i) => {
        const po = lookups[i];
        if (po) {
            confirmed.push({ recordId: po.id, poId: po.poId, vendorId: po.vendor?.[0] || null });
        } else {
            unconfirmed.push(poId);
        }
    });

    const openFlags = await Promise.all(confirmed.map((c) => isPoOpen(c.recordId)));
    confirmed.forEach((c, i) => {
        c.isOpen = openFlags[i];
    });

    return { confirmed, unconfirmed };
}

// Exact copy of InvoiceForm.js's note-building + single-PO message
// template, so this checks the real user-facing string, not just the
// underlying data shape.
function buildSinglePoMessage({ confirmed, unconfirmed }) {
    const closedPos = confirmed.filter((c) => c.isOpen === false);
    const fullyInvoicedNote =
        closedPos.length === 0
            ? ""
            : confirmed.length > 1
                ? ` — already fully invoiced: ${closedPos.map((c) => c.poId).join(", ")} (double-check before submitting)`
                : " — already fully invoiced (double-check before submitting)";
    const unconfirmedNote =
        unconfirmed.length > 0
            ? ` (${unconfirmed.length} unrecognized reference${unconfirmed.length > 1 ? "s" : ""} ignored)`
            : "";
    return `Detected PO: ${confirmed[0].poId} (auto-filled below)${fullyInvoicedNote}${unconfirmedNote}.`;
}

async function run(path, label) {
    const result = await detectFromFile(path);
    console.log(`\n--- ${label} ---`);
    console.log("confirmed:", result.confirmed);
    console.log("unconfirmed:", result.unconfirmed);
    if (result.confirmed.length === 1) {
        console.log("message:", buildSinglePoMessage(result));
    }
}

await run("scripts/demo/output/demo-invoice.pdf", "Case 1: real, fully-invoiced PO alone (HYE-PO-20260716-01)");
await run("scratch/fake-po.pdf", "Case 2: PO-shaped string alone, no real PO (HYE-PO-20261231-99)");
await run("scratch/no-po.pdf", "Case 3: no PO number at all");
await run(
    "scratch/cooccur.pdf",
    "Case 4 (co-occurrence): real open PO (HYE-PO-20260720-01) + a fake PO number (HYE-PO-20261231-99) in the same PDF"
);

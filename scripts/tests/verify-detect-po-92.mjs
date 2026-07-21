// Ad hoc verification for issue #92 — mirrors app/api/invoices/detect-po/
// route.js's core logic exactly (PDF text -> regex -> getPOById ->
// isPoOpen), against three real test PDFs, without going through the
// browser's file input (not scriptable in this environment).
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-detect-po-92.mjs

import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";
import { getPOById, isPoOpen } from "../../lib/airtable/purchaseOrders.js";

const PO_ID_PATTERN = /HYE-PO-\d{8}-\d{2}/g;

async function detectFromFile(path, label) {
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

    console.log(`\n--- ${label} ---`);
    console.log("confirmed:", confirmed);
    console.log("unconfirmed:", unconfirmed);
}

await detectFromFile("scripts/demo/output/demo-invoice.pdf", "Case 1: real, fully-invoiced PO (HYE-PO-20260716-01)");
await detectFromFile("scratch/fake-po.pdf", "Case 2: PO-shaped string, no real PO (HYE-PO-20261231-99)");
await detectFromFile("scratch/no-po.pdf", "Case 3: no PO number at all");

// Ad hoc check for issue #96 (scope item 4) — are there any existing
// Invoice Items with no linked PO Item (i.e. created via the free-text
// "Other" option)? Read-only, no writes.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/check-freetext-invoice-items-96.mjs

import { base, TABLES } from "../../lib/airtable/client.js";

const records = await base(TABLES.INVOICE_ITEMS).select().all();
const freeText = records.filter((r) => (r.get("PO Item") || []).length === 0);

console.log(`Total Invoice Items: ${records.length}`);
console.log(`Free-text (no PO Item link): ${freeText.length}`);
freeText.forEach((r) => {
    console.log(
        `  ${r.get("Invoice Item ID")} — "${r.get("Item Name")}" — Invoice: ${JSON.stringify(r.get("Invoice"))}`
    );
});

// Generates a realistic-looking vendor invoice PDF for a REAL PO record —
// used to demo issue #46 (PDF PO-number auto-detection) live: a PO's ID is
// only known once it's actually generated during a demo (PR -> sign -> PO),
// so this can't be prepared ahead of time. Meant to be run as a single
// quick command in the moment, right after the PO shows up on screen.
//
// Pulls the PO's real Vendor + PO Items from Airtable, so the "vendor
// invoice" being uploaded actually matches what was just created instead
// of generic placeholder line items — the PO # text embedded in the PDF is
// exactly what issue #46's regex (/HYE-PO-\d{8}-\d{2}/g) needs to detect.
//
// Usage (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/make-invoice-pdf.mjs HYE-PO-20260716-01
//
// Output always overwrites scripts/demo/output/demo-invoice.pdf (gitignored)
// -- same path every time, so there's nothing to remember mid-demo besides
// the PO ID itself.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir } from "fs/promises";
import { writeFileSync } from "fs";
import { getPOById } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { getVendorByRecordId } from "../../lib/airtable/vendors.js";
import { getAddressByRecordId } from "../../lib/airtable/addresses.js";

const OUT_DIR = "scripts/demo/output";
const OUT_PATH = `${OUT_DIR}/demo-invoice.pdf`;

async function main() {
    const poId = process.argv[2];
    if (!poId) {
        console.error("Usage: node ... scripts/demo/make-invoice-pdf.mjs <PO_ID>");
        console.error("Example: node ... scripts/demo/make-invoice-pdf.mjs HYE-PO-20260716-01");
        process.exit(1);
    }

    const po = await getPOById(poId);
    if (!po) {
        console.error(
            `No PO found with ID "${poId}" -- check it was typed exactly as shown on screen (case-sensitive), and that PO generation has actually finished.`
        );
        process.exit(1);
    }

    const vendorRecordId = po.vendor?.[0] || null;
    const vendor = vendorRecordId ? await getVendorByRecordId(vendorRecordId) : null;
    const vendorAddress = vendor?.address?.[0] ? await getAddressByRecordId(vendor.address[0]) : null;
    const items = await getItemsByPO(po.id);

    await mkdir(OUT_DIR, { recursive: true });

    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]); // US Letter
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 740;
    const left = 56;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.35, 0.35, 0.35);

    function draw(text, { size = 10, f = font, dy = 16, color = black, x = left } = {}) {
        page.drawText(text, { x, y, size, font: f, color });
        y -= dy;
    }

    draw("INVOICE", { size: 22, f: bold, dy: 26 });
    draw(vendor?.vendorName || "Vendor", { size: 11, f: bold, dy: 14 });
    if (vendorAddress?.formattedAddress) {
        draw(vendorAddress.formattedAddress, { size: 10, color: gray, dy: 28 });
    } else {
        y -= 14;
    }

    const today = new Date().toISOString().slice(0, 10);
    draw(`Invoice #: DEMO-INV-${today.replace(/-/g, "")}`, { size: 10, dy: 14 });
    draw(`Invoice Date: ${today}`, { size: 10, dy: 14 });
    draw("Bill To: HANYANGENG USA INC.", { size: 10, dy: 14 });
    // The one line issue #46 actually needs -- everything else here is
    // just realism dressing.
    draw(`PO #: ${po.poId}`, { size: 12, f: bold, dy: 28 });

    const cols = [
        { label: "Item", x: left },
        { label: "Size", x: left + 150 },
        { label: "Unit", x: left + 200 },
        { label: "Qty", x: left + 245 },
        { label: "Unit Price", x: left + 290 },
        { label: "Amount", x: left + 370 },
    ];
    page.drawLine({ start: { x: left, y: y + 12 }, end: { x: left + 450, y: y + 12 }, thickness: 1, color: black });
    for (const c of cols) page.drawText(c.label, { x: c.x, y, size: 10, font: bold, color: black });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: left + 450, y }, thickness: 1, color: black });
    y -= 16;

    const rows =
        items.length > 0
            ? items
            : [{ itemName: "(no PO Items found on this PO)", size: "", unit: "", qty: "", unitPrice: null, amount: 0 }];
    let computedTotal = 0;
    for (const item of rows) {
        const amount = item.amount ?? (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
        computedTotal += amount;
        const values = [
            item.itemName || "",
            item.size || "",
            item.unit || "",
            item.qty != null ? String(item.qty) : "",
            item.unitPrice != null ? `$${Number(item.unitPrice).toFixed(2)}` : "",
            `$${Number(amount).toFixed(2)}`,
        ];
        values.forEach((val, i) => page.drawText(val, { x: cols[i].x, y, size: 10, font, color: black }));
        y -= 18;
    }

    y -= 4;
    page.drawLine({ start: { x: left, y }, end: { x: left + 450, y }, thickness: 1, color: black });
    y -= 20;
    const total = po.totalAmount ?? computedTotal;
    draw(`Total: $${Number(total).toFixed(2)}`, { size: 12, f: bold, dy: 40 });
    draw("This is a synthetic demo document generated for a live product walkthrough.", {
        size: 9,
        color: gray,
    });

    const bytes = await doc.save();
    writeFileSync(OUT_PATH, bytes);
    console.log(`Wrote ${OUT_PATH} (${bytes.length} bytes) -- PO ${po.poId}, ${items.length} item(s).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

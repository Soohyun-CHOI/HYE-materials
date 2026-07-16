import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir } from "fs/promises";
import { writeFileSync } from "fs";

const OUT_DIR = "C:\\dev\\materials\\scratch";
const OUT_PATH = `${OUT_DIR}\\test-invoice-HYE-PO-20260715-99.pdf`;

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
draw("TESTQA Vendor A", { size: 11, f: bold, dy: 14 });
draw("123 Test Fabrication Way, Round Rock, TX 78681", { size: 10, color: gray, dy: 28 });

draw(`Invoice #: DEMO-INV-9901`, { size: 10, dy: 14 });
draw(`Invoice Date: 2026-07-15`, { size: 10, dy: 14 });
draw(`Bill To: HANYANGENG USA INC.`, { size: 10, dy: 14 });
draw(`PO #: HYE-PO-20260715-99`, { size: 12, f: bold, dy: 28 });

// Line items table
const cols = [
  { label: "Item", x: left, w: 150 },
  { label: "Size", x: left + 150, w: 50 },
  { label: "Unit", x: left + 200, w: 45 },
  { label: "Qty", x: left + 245, w: 45 },
  { label: "Unit Price", x: left + 290, w: 80 },
  { label: "Amount", x: left + 370, w: 80 },
];

const tableTop = y;
page.drawLine({
  start: { x: left, y: tableTop + 12 },
  end: { x: left + 450, y: tableTop + 12 },
  thickness: 1,
  color: black,
});
for (const c of cols) {
  page.drawText(c.label, { x: c.x, y, size: 10, font: bold, color: black });
}
y -= 6;
page.drawLine({ start: { x: left, y }, end: { x: left + 450, y }, thickness: 1, color: black });
y -= 16;

const rows = [
  ["Demo Flange", "3\"", "EA", "40", "$15.00", "$600.00"],
  ["Demo Gasket Kit", "N/A", "SET", "25", "$8.00", "$200.00"],
];
for (const row of rows) {
  row.forEach((val, i) => {
    page.drawText(val, { x: cols[i].x, y, size: 10, font, color: black });
  });
  y -= 18;
}

y -= 4;
page.drawLine({ start: { x: left, y }, end: { x: left + 450, y }, thickness: 1, color: black });
y -= 20;

draw("Total: $800.00", { size: 12, f: bold, dy: 40 });

draw("This is a synthetic test document generated for QA purposes.", {
  size: 9,
  color: gray,
});

const bytes = await doc.save();
writeFileSync(OUT_PATH, bytes);
console.log("Wrote", OUT_PATH, bytes.length, "bytes");

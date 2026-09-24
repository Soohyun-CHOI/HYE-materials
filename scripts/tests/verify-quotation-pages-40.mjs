// The order document carries every quotation on its request — credentialed (#40).
//
// WHY THIS EXISTS BESIDE `offline/po-quotations.mjs`. That file proves the module on
// documents it builds itself. What it cannot reach is the path the order document is
// really made on: quotation files that went into Blob, into Airtable, and come back
// out of Airtable's copy; `generateAndAttachPOPdf` inside the running app, with
// react-pdf's own order pages in front; the upload and the attachment behind it; and
// the retry's refusal as a reader gets it. This makes four orders that way and opens
// what came out.
//
//   A — one photograph, stored on its side and tagged to stand up
//   B — three PDFs, the request's quotation links dragged into reverse order
//   C — a PDF, a photograph and a screenshot
//   D — a good PDF and the 48-byte file `HYE-PR-260915-02-Q01` holds on the base,
//       which is refused, by name, and leaves the order with no document
//   E — a document over the send's ceiling, attached by hand: the order's page says
//       so where the send would be, and offers no send. The page is fetched and
//       read; the send itself is never pressed.
//
// THE SIGNATURE IS WRITTEN, NOT SIGNED, AND THAT IS WHAT KEEPS MAIL AT ZERO.
// `signPOAction` calls `notifyPOSigned`, which emails the requester, before it makes
// the document. This writes the three keys that action writes and drives
// `regeneratePDFAction`, which sends nothing. Both make the document with the one call
// `generateAndAttachPOPdf(po.id)` and nothing else, so it is the document a signature
// would have made. No vendor is mailed: `sendPOToVendorAction` is never called.
//
// EVERY PAGE IS RENDERED TO A PNG BESIDE ITS PDF, under the system temp directory,
// which is what keeps the documents readable after teardown removes the records. The
// photographs and the screenshot carry a colored band along their top edge, and each
// image page is asked where that band landed: a picture drawn on its side puts it on
// the left or the right.
//
// WHAT IT REUSES: one vendor, one discipline and one requester, each of which gains a
// reverse-link and nothing else. Everything else it makes it deletes, and the one
// Blob object it does not own — each order document, uploaded by the app — is looked
// for afterwards by name, since the app's own cleanup is what should remove it.
//
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-quotation-pages-40.mjs
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed or a
// fixture leaked, 2 the dev server was unreachable so no document was made.

import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { list, put } from "@vercel/blob";
import { TABLES, base } from "../../lib/airtable/client.js";
import { createPR, getPRByRecordId, updatePR } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createQuotation } from "../../lib/airtable/quotations.js";
import { getPOByRecordId, updatePO } from "../../lib/airtable/purchaseOrders.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { getAllDisciplines } from "../../lib/airtable/disciplines.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { confirmIngestThenDelete } from "../../lib/blobIngest.js";
import { PO_QUOTATIONS_COPY } from "../../lib/poQuotations.js";
import { MAX_SEND_DOCUMENT_BYTES, SEND_COPY, SEND_REFUSAL } from "../../lib/poSend.js";
import { resolveVerifyCategories } from "./_categories.mjs";
import { createFixtures } from "./_fixtures.mjs";
import { DEFAULT_BASE_URL, callServerAction, serverActionId, sessionCookieFor } from "./_liveApp.mjs";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-quotation-pages-40 — the order document carries every quotation on its request" });

const BASE = DEFAULT_BASE_URL;
const ADMIN_EMAIL = "soo@hanyangengusa.com";
// The vendor #408 reuses, for the same reason: it gains a reverse-link and nothing else.
const VENDOR_RECORD_ID = "recJMkaWAGnohzn4z"; // Lone Star Pipe & Supply

// A4 and the order pages' own size, typed out; the pictures' pages are what
// `lib/poQuotations.js` fits them to, worked by hand here.
const A4 = "595.28x841.89";
const LETTER = "612.00x792.00";

let pass = true;
let incomplete = false;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok, detail = "") {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return ok;
}

const fixtures = createFixtures({
    tag: "V040",
    buckets: [
        // Tagged: every quotation here is created by this script, which writes the
        // run's tag into its vendor code. Deleted first, since request items link to
        // them and the requests hold them.
        { name: "quotations", table: TABLES.QUOTATIONS, label: "Quotation", tagField: "Vendor Quotation Code" },
        // No tagField: written by generatePOForApprovedPR, and nothing this script
        // sets on it is text. Tracked, so a tracked-id re-read is the residue check.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // FOUND BY TAG — PO generation writes these as a side effect (#18), and the tag
        // rides on `Size` since `Item Name` became a lookup (#356).
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            tagField: "Size",
            discoverByTag: true,
            expectAtLeast: 1,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;
const [CATEGORY] = await resolveVerifyCategories();
const FIXTURE_SIZE = `${TAG} 1"`;

// ── the quotation files ─────────────────────────────────────────────────────

/** The band every picture carries along its top edge, and how it is recognized. */
const BAND = "#1d3b8a";
const isBand = (d) => d[0] < 80 && d[1] < 110 && d[2] > 110 && d[2] - d[0] > 60;

/** A page of a paper quotation as a phone would photograph it, upright. */
function uprightQuotation(title, width, height) {
    const c = createCanvas(width, height);
    const g = c.getContext("2d");
    g.fillStyle = "#f7f5ef";
    g.fillRect(0, 0, width, height);
    g.fillStyle = BAND;
    g.fillRect(0, 0, width, Math.round(height * 0.1));
    g.fillStyle = "#ffffff";
    g.font = `bold ${Math.round(height * 0.045)}px sans-serif`;
    g.fillText(`QUOTATION — ${title}`, Math.round(width * 0.05), Math.round(height * 0.065));
    g.fillStyle = "#222222";
    g.font = `${Math.round(height * 0.024)}px sans-serif`;
    const rows = ["2\" SCH40 pipe   EA   12   $14.50", "Clevis hanger   EA   24   $3.10", "Strut channel   EA    8   $21.00", "Freight                      $65.00"];
    rows.forEach((row, i) => g.fillText(row, Math.round(width * 0.06), Math.round(height * (0.2 + i * 0.07))));
    g.fillText("The band above is this page's top edge.", Math.round(width * 0.06), Math.round(height * 0.9));
    return c;
}

/** The same page as the phone STORES it for orientation 6: turned a quarter counter-clockwise. */
function storedForOrientation6(upright) {
    const c = createCanvas(upright.height, upright.width);
    const g = c.getContext("2d");
    g.translate(0, upright.width);
    g.rotate(-Math.PI / 2);
    g.drawImage(upright, 0, 0);
    return c;
}

/** A JPEG with an Exif segment holding one Orientation entry, put after its start marker. */
function withOrientation(jpeg, value) {
    const tiff = new Uint8Array(26);
    const d = new DataView(tiff.buffer);
    tiff.set([0x49, 0x49], 0);
    d.setUint16(2, 42, true);
    d.setUint32(4, 8, true);
    d.setUint16(8, 1, true);
    d.setUint16(10, 0x0112, true);
    d.setUint16(12, 3, true);
    d.setUint32(14, 1, true);
    d.setUint16(18, value, true);
    const payload = new Uint8Array([...Buffer.from("Exif\0\0", "latin1"), ...tiff]);
    const head = new Uint8Array(4);
    new DataView(head.buffer).setUint16(0, 0xffe1);
    new DataView(head.buffer).setUint16(2, payload.length + 2);
    return Buffer.concat([jpeg.subarray(0, 2), head, payload, jpeg.subarray(2)]);
}

async function photograph(title) {
    const stored = storedForOrientation6(uprightQuotation(title, 900, 1200));
    return {
        filename: `${title.toLowerCase().replace(/\s+/g, "-")}.jpg`,
        contentType: "image/jpeg",
        bytes: withOrientation(await stored.encode("jpeg", 85), 6),
    };
}

async function screenshot(title) {
    const c = uprightQuotation(title, 1600, 900);
    return { filename: `${title.toLowerCase().replace(/\s+/g, "-")}.png`, contentType: "image/png", bytes: await c.encode("png") };
}

async function quotationPdf(title, pages, size) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= pages; n++) {
        const page = doc.addPage(size);
        const { width, height } = page.getSize();
        page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: rgb(0.114, 0.231, 0.541) });
        page.drawText(`QUOTATION — ${title} — page ${n} of ${pages}`, { x: 36, y: height - 40, size: 16, font, color: rgb(1, 1, 1) });
        page.drawText(`${Math.round(width)} x ${Math.round(height)} points`, { x: 36, y: height - 100, size: 12, font });
    }
    return {
        filename: `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        contentType: "application/pdf",
        bytes: Buffer.from(await doc.save()),
    };
}

/**
 * A real PDF a little over the send's ceiling: one page, and an unreferenced stream
 * of random bytes a viewer never draws. Random so nothing on the way compresses it.
 */
async function oversizedPdf() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([612, 792]).drawText("An order document larger than an email can carry", { x: 36, y: 740, size: 14, font });
    doc.context.register(doc.context.stream(randomBytes(MAX_SEND_DOCUMENT_BYTES + 512 * 1024)));
    return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/** What React escapes in a text node, undone once rather than guessed at per sentence (#408). */
const decodeHtml = (html) =>
    html
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#x2014;/g, "—")
        .replace(/&amp;/g, "&");

/** The bytes `HYE-PR-260915-02-Q01` holds on the base: a PDF header and a comment. */
const FAKE_387 = {
    filename: "quote-387.pdf",
    contentType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4\n% walked for #387 disagreement fixture\n", "latin1"),
};

// ── the orders ──────────────────────────────────────────────────────────────

async function makeOrder({ key, notes, files, reverseLinks = false, requester, discipline }) {
    const pr = await createPR({
        requesterId: requester.id,
        disciplineId: discipline.id,
        vendorId: VENDOR_RECORD_ID,
        notes: `${TAG} ${notes}`,
    });
    track("prs", pr.id);
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: CATEGORY.label,
        categoryRecordId: CATEGORY.recordId,
        size: FIXTURE_SIZE,
        unit: "EA",
        qty: 3,
        unitPrice: 12,
        remark: "",
    });

    const quotations = [];
    for (const [i, file] of files.entries()) {
        const blob = await put(file.filename, file.bytes, {
            access: "public",
            contentType: file.contentType,
            addRandomSuffix: true,
        });
        fixtures.trackBlob(blob.url);
        const quotation = await createQuotation({
            prRecordId: pr.id,
            prId: pr.prId,
            vendorId: VENDOR_RECORD_ID,
            vendorQuotationCode: `${TAG}-${key}${i + 1}`,
            file: [{ url: blob.url, filename: file.filename }],
        });
        track("quotations", quotation.id);
        quotations.push({ ...quotation, blobUrl: blob.url, filename: file.filename });
    }

    // THE PRODUCTION CLEANUP, and it is what makes the app read Airtable's copy: each
    // object is deleted once Airtable holds the file, as `createPRAction` does.
    const ingest = await confirmIngestThenDelete(
        quotations.map((q) => ({
            table: TABLES.QUOTATIONS,
            recordId: q.id,
            field: "File",
            blobUrl: q.blobUrl,
            attachmentId: q.file?.[0]?.id,
            label: `fixture quotation ${q.quotationId}`,
        }))
    );
    if (quotations.length > 0) {
        check(`${key}: Airtable took every quotation's file`, ingest.filter((r) => r.confirmed && r.deleted).length, quotations.length);
    }

    if (reverseLinks) {
        // The order the base returns a request's quotations in is its link order; the
        // old appendix took the first. Dragging them into reverse makes link order and
        // Quotation ID order disagree, so the document shows which one it followed.
        await base(TABLES.PURCHASE_REQUESTS).update(pr.id, { Quotations: quotations.map((q) => q.id).reverse() });
        const relinked = (await getPRByRecordId(pr.id)).quotationRowIds;
        check(`${key}: the request's links now run in reverse`, relinked.join(","), quotations.map((q) => q.id).reverse().join(","));
    }

    await updatePR(pr.id, { status: "Approved" });
    const generated = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", generated.poRecordId);
    // The three keys `signPOAction` writes, and nothing it sends.
    await updatePO(generated.poRecordId, {
        presidentSigned: true,
        presidentSignedAt: new Date().toISOString(),
        status: "Signed",
    });
    console.log(`  ${key}: ${generated.poId} from ${pr.prId}, quotations ${quotations.map((q) => q.quotationId.slice(-3)).join(" ")}`);
    return { key, notes, pr, poRecordId: generated.poRecordId, poId: generated.poId, quotations };
}

// ── reading what came out ───────────────────────────────────────────────────

const OUT = join(tmpdir(), "hye-40", TAG);

async function openDocument(order) {
    const po = await getPOByRecordId(order.poRecordId);
    const file = po.poPdfFile?.[0];
    if (!file?.url) return null;
    const res = await fetch(file.url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${order.key}-${order.poId}.pdf`), bytes);
    return getDocument({
        data: bytes,
        verbosity: 0,
        standardFontDataUrl: join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + "/",
    }).promise;
}

/** Every page's size, each page rendered to a PNG, and where each picture's band landed. */
async function readPages(order, pdf) {
    const sizes = [];
    const bands = [];
    for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const [, , width, height] = page.view;
        sizes.push(`${width.toFixed(2)}x${height.toFixed(2)}`);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        writeFileSync(join(OUT, `${order.key}-${order.poId}-page${n}.png`), await canvas.encode("png"));
        const at = (x, y) => isBand(context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data);
        const w = canvas.width;
        const h = canvas.height;
        bands.push(
            [at(w / 2, h * 0.03) && "top", at(w / 2, h * 0.97) && "bottom", at(w * 0.03, h / 2) && "left", at(w * 0.97, h / 2) && "right"]
                .filter(Boolean)
                .join("+") || "none"
        );
    }
    return { sizes, bands };
}

/** The order document's own Blob object, which the app should have removed once Airtable held it. */
async function appObjectsLeft(order) {
    const deadline = Date.now() + 30_000;
    let blobs = [];
    do {
        ({ blobs } = await list({ prefix: `${order.poId}-` }));
        if (blobs.length === 0) return [];
        await new Promise((r) => setTimeout(r, 2000));
    } while (Date.now() < deadline);
    return blobs;
}

try {
    console.log(`\nThe fixtures (run ${TAG})`);
    const requester = await getUserByEmail(ADMIN_EMAIL);
    const discipline = (await getAllDisciplines())[0];
    assert("a requester and a discipline resolve", Boolean(requester?.id && discipline?.id));
    const who = { requester, discipline };

    const orders = {
        A: await makeOrder({ key: "A", notes: "one photograph", files: [await photograph("Photo quote")], ...who }),
        B: await makeOrder({
            key: "B",
            notes: "three PDFs, links reversed",
            files: [
                await quotationPdf("First PDF", 2, [595.28, 841.89]),
                await quotationPdf("Second PDF", 1, [612, 792]),
                await quotationPdf("Third PDF", 1, [500, 700]),
            ],
            reverseLinks: true,
            ...who,
        }),
        C: await makeOrder({
            key: "C",
            notes: "a PDF, a photograph and a screenshot",
            files: [await quotationPdf("Mixed PDF", 1, [612, 792]), await photograph("Mixed photo"), await screenshot("Mixed screenshot")],
            ...who,
        }),
        D: await makeOrder({
            key: "D",
            notes: "a good PDF and the 48-byte fixture",
            files: [await quotationPdf("Good PDF", 1, [612, 792]), FAKE_387],
            ...who,
        }),
        E: await makeOrder({ key: "E", notes: "a document over the send's ceiling", files: [], ...who }),
    };

    let cookie = "";
    try {
        cookie = await sessionCookieFor(ADMIN_EMAIL, { baseUrl: BASE });
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    if (cookie) {
        const actionId = await serverActionId(`${BASE}/pos/${orders.A.poId}`, "regeneratePDFAction", { cookie });
        assert("the document control's action is found on an order with no document", Boolean(actionId));
        const generate = (order) => {
            const form = new FormData();
            form.set("poId", order.poId);
            return callServerAction({ pageUrl: `${BASE}/pos/${order.poId}`, actionId, args: [null, form], cookie });
        };

        const expected = {
            // The photograph is 900 by 1200 once turned, so its page is the order's
            // width and 1200 × 595.28 / 900 tall.
            A: { sizes: [A4, A4, "595.28x793.71"], bands: ["none", "none", "top"] },
            // Quotation ID order — first, second, third — although the links now say
            // third, second, first.
            B: { sizes: [A4, A4, A4, A4, LETTER, "500.00x700.00"], bands: ["none", "none", "top", "top", "top", "top"] },
            // The screenshot is 1600 by 900: the order's page on its side, and
            // 900 × 841.89 / 1600 tall.
            C: { sizes: [A4, A4, LETTER, "595.28x793.71", "841.89x473.56"], bands: ["none", "none", "top", "top", "top"] },
        };

        for (const key of ["A", "B", "C"]) {
            console.log(`\n${key} — ${orders[key].notes}`);
            const result = await generate(orders[key]);
            assert(`${key}: the document was made and the reader sent back to the order`, Boolean(result.redirect?.includes(`/pos/${orders[key].poId}`)), result.refusal ?? `HTTP ${result.status}`);
            const pdf = await openDocument(orders[key]);
            assert(`${key}: the order carries a document`, Boolean(pdf));
            if (!pdf) continue;
            const { sizes, bands } = await readPages(orders[key], pdf);
            check(`${key}: its pages, in order`, sizes.join(" "), expected[key].sizes.join(" "));
            // The order's own two pages carry no band; every quotation page does, and
            // on a picture it is only at the top when the picture stands up.
            check(`${key}: where each page's band is`, bands.join(" "), expected[key].bands.join(" "));
            const left = await appObjectsLeft(orders[key]);
            left.forEach((b) => fixtures.trackBlob(b.url));
            check(`${key}: the app removed its own upload once Airtable held the document`, left.length, 0);
        }

        console.log(`\nD — ${orders.D.notes}`);
        const refused = await generate(orders.D);
        const fake = orders.D.quotations[1];
        check(
            "D: the retry names the quotation it cannot append, and why",
            refused.refusal,
            PO_QUOTATIONS_COPY.unreadable([{ quotationId: fake.quotationId, filename: FAKE_387.filename, reason: "damaged" }])
        );
        console.log(`    ${refused.refusal}`);
        const afterRefusal = await getPOByRecordId(orders.D.poRecordId);
        check("D: and the order still has no document", afterRefusal.poPdfFile?.length ?? 0, 0);
        const uploaded = await appObjectsLeft(orders.D);
        uploaded.forEach((b) => fixtures.trackBlob(b.url));
        check("D: nothing was uploaded for it", uploaded.length, 0);
        check("D: the signature stands", afterRefusal.presidentSigned, true);

        console.log(`\nE — ${orders.E.notes}`);
        const pageOf = async (order) => decodeHtml(await (await fetch(`${BASE}/pos/${order.poId}`, { headers: { cookie } })).text());
        // THE CONTROL FIRST: an order whose document fits shows the send, so its
        // absence below is the page's answer rather than a matcher that sees nothing.
        check("A's page, whose document fits, offers the send", (await pageOf(orders.A)).includes(SEND_COPY.button), true);

        const big = await oversizedPdf();
        check("E: the document is over the ceiling", big.length > MAX_SEND_DOCUMENT_BYTES, true);
        const blob = await put(`${orders.E.poId}.pdf`, big, { access: "public", contentType: "application/pdf", addRandomSuffix: true });
        fixtures.trackBlob(blob.url);
        const attached = await updatePO(orders.E.poRecordId, { poPdfFile: [{ url: blob.url, filename: `${orders.E.poId}.pdf` }] });
        const ingest = await confirmIngestThenDelete([
            {
                table: TABLES.PURCHASE_ORDERS,
                recordId: orders.E.poRecordId,
                field: "PO PDF File",
                blobUrl: blob.url,
                attachmentId: attached.poPdfFile?.[0]?.id,
                label: `oversized document ${orders.E.poId}`,
            },
        ]);
        check("E: Airtable took the document", ingest[0]?.confirmed === true, true);
        // The refusal reads Airtable's own `size`, which it fills in once it has the file.
        let size;
        for (let i = 0; i < 30 && !size; i++) {
            size = (await getPOByRecordId(orders.E.poRecordId)).poPdfFile?.[0]?.size;
            if (!size) await new Promise((r) => setTimeout(r, 1000));
        }
        check("E: Airtable reports its size in bytes", size, big.length);
        const oversized = await pageOf(orders.E);
        check("E: the page says the document is larger than an email can carry", oversized.includes(SEND_REFUSAL["too-large"]), true);
        check("  and offers no send", oversized.includes(SEND_COPY.button), false);

        console.log(`\n  the documents and every page are under ${OUT}`);
    }
} catch (err) {
    pass = false;
    console.error(`\nFAILED — ${err.stack || err.message}`);
} finally {
    console.log("\nCleanup");
    const report = await fixtures.teardown({ complete: pass });
    console.log(`  ${fixtures.describe(report)}`);
    const leaked = report.leaked.length > 0;
    console.log(`\n${pass ? "OK" : "SOME CHECKS FAILED"}`);
    process.exit(!pass || leaked ? 1 : incomplete ? 2 : 0);
}

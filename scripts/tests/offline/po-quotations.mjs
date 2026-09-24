// Every quotation on a request, appended behind the order's own pages (#40).
//
// The order document used to carry the request's FIRST quotation, and only when it was
// a PDF, so an image quotation and every second quotation were left out with nothing
// anywhere saying so. `lib/poQuotations.js` appends all of them or refuses by name,
// and this holds seven things about it:
//
//   1  the order is the number in the `Quotation ID`, never the string or the links
//   2  the format is read off the file's contents; its name is never consulted
//   3  the orientation is read by the rules Chromium 152 was measured to follow
//   4  an image's page is its own shape at the order's scale — figures typed out
//   5  the pages as DRAWN: a document `appendQuotations` built, opened and rendered by
//      PDF.js, each picture's four edges compared against Chromium's measured table
//   6  a quotation that cannot be appended is named, with every other one that cannot,
//      and no document comes out
//   7  the document's retry says so, and generation goes through the module
//
// THE SECOND PATH IS A SECOND LIBRARY AND A MEASUREMENT, which is the rule
// `verification.md` records after #351 and #224. pdf-lib writes the document; PDF.js —
// the engine that draws every PDF this app shows — reads and renders it; and what it
// draws is compared with a table typed in from Chromium, which was measured on
// pictures whose four edges were four colors. None of the expected edges is derived
// from the matrices under test, so a wrong matrix and a wrong expectation cannot agree.
//
// WHAT IT CANNOT SEE. A JPEG whose header parses and whose picture data is broken:
// pdf-lib reads only the header, so it is appended and draws as whatever survives. A
// PDF that parses and draws blank. And Airtable, Blob, Next's runtime and a vendor's
// own viewer — `scripts/tests/verify-quotation-pages-40.mjs` makes real documents
// through the running app, and those were opened and looked at.

import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CHILD_KINDS } from "../../../lib/idSequence.js";
import {
    ORDER_PAGE_SIZE,
    PO_QUOTATIONS_COPY,
    QUOTATION_UNREADABLE,
    appendQuotations,
    imageOrientation,
    imagePageSize,
    orderQuotations,
    quotationFormat,
} from "../../../lib/poQuotations.js";
import { callPassesProperty, callsFunction, callsTo, parseFile, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every quotation on the request, appended to the order's document (#40)";

/**
 * MEASURED IN CHROMIUM 152, and the whole reference this file holds the drawing to.
 * A 60 by 40 picture was stored with its top edge red, right green, bottom blue and
 * left yellow, tagged with each orientation in a JPEG's Exif segment and a PNG's
 * `eXIf` chunk, in both byte orders, and read back from the browser: where each stored
 * edge ended up. The three encodings agreed on every row.
 */
const CHROMIUM = {
    1: "top=red right=green bottom=blue left=yellow",
    2: "top=red right=yellow bottom=blue left=green",
    3: "top=blue right=yellow bottom=red left=green",
    4: "top=blue right=green bottom=red left=yellow",
    5: "top=yellow right=blue bottom=green left=red",
    6: "top=yellow right=red bottom=green left=blue",
    7: "top=green right=red bottom=yellow left=blue",
    8: "top=green right=blue bottom=yellow left=red",
};

const PR_ID = "HYE-PR-260924-01";
const SEQ_PREFIX = CHILD_KINDS["Purchase Requests::Quotations"].seqPrefix;

// ── fixtures ─────────────────────────────────────────────────────────────────

/** The measured picture: 60 by 40, each edge its own color. */
function edgesCanvas() {
    const W = 60;
    const H = 40;
    const B = 6;
    const c = createCanvas(W, H);
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#f00";
    g.fillRect(0, 0, W, B);
    g.fillStyle = "#0f0";
    g.fillRect(W - B, B, B, H - 2 * B);
    g.fillStyle = "#00f";
    g.fillRect(0, H - B, W, B);
    g.fillStyle = "#ff0";
    g.fillRect(0, B, B, H - 2 * B);
    return c;
}

const concat = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
};
const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));

/** A TIFF block holding one Orientation entry, shaped as each case needs it. */
function tiff({ value, order = "II", type = 3, count = 1 }) {
    const b = new Uint8Array(26);
    const d = new DataView(b.buffer);
    const le = order === "II";
    b.set(ascii(order), 0);
    d.setUint16(2, 42, le);
    d.setUint32(4, 8, le);
    d.setUint16(8, 1, le);
    d.setUint16(10, 0x0112, le);
    d.setUint16(12, type, le);
    d.setUint32(14, count, le);
    if (type === 4) d.setUint32(18, value, le);
    else d.setUint16(18, value, le);
    d.setUint32(22, 0, le);
    return b;
}

function segment(marker, payload) {
    const head = new Uint8Array(4);
    new DataView(head.buffer).setUint16(0, marker);
    new DataView(head.buffer).setUint16(2, payload.length + 2);
    return concat(head, payload);
}
const exifSegment = (block) => segment(0xffe1, concat(ascii("Exif\0\0"), block));

/** A real JPEG with an Exif segment put straight after its start marker. */
const tagJpeg = (jpeg, block) => concat(jpeg.subarray(0, 2), exifSegment(block), jpeg.subarray(2));

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function chunk(type, data) {
    const body = concat(ascii(type), data);
    let crc = 0xffffffff;
    for (const x of body) crc = CRC_TABLE[(crc ^ x) & 0xff] ^ (crc >>> 8);
    const frame = new Uint8Array(8);
    new DataView(frame.buffer).setUint32(0, data.length);
    const tail = new Uint8Array(4);
    new DataView(tail.buffer).setUint32(0, (crc ^ 0xffffffff) >>> 0);
    return concat(frame.subarray(0, 4), body, tail);
}
/** A real PNG with an `eXIf` chunk after its header, or after its image data. */
function tagPng(png, block, { afterImageData = false } = {}) {
    const at = afterImageData ? png.length - 12 : 8 + 25;
    return concat(png.subarray(0, at), chunk("eXIf", block), png.subarray(at));
}

async function pdfWithPages(count, size) {
    const doc = await PDFDocument.create();
    for (let i = 0; i < count; i++) doc.addPage(size);
    return doc.save();
}

/** A PDF whose trailer names an encryption dictionary, which is what pdf-lib refuses. */
async function encryptedPdf() {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.context.trailerInfo.Encrypt = doc.context.register(
        doc.context.obj({ Filter: "Standard", V: 1, R: 2, P: -4 })
    );
    return doc.save({ useObjectStreams: false });
}

/** The file `HYE-PR-260915-02-Q01` holds on the base: a PDF header and nothing else. */
const FAKE_387 = ascii("%PDF-1.4\n% walked for #387 disagreement fixture\n");
const HEIC = concat(new Uint8Array([0, 0, 0, 0x18]), ascii("ftypheic"), new Uint8Array(16));
const WEBP = concat(ascii("RIFF"), new Uint8Array([0x24, 0, 0, 0]), ascii("WEBPVP8 "), new Uint8Array(16));
const GIF = concat(ascii("GIF89a"), new Uint8Array(16));

function colorAt(d) {
    if (d[0] > 180 && d[1] < 90 && d[2] < 90) return "red";
    if (d[1] > 180 && d[0] < 90 && d[2] < 90) return "green";
    if (d[2] > 180 && d[0] < 90 && d[1] < 90) return "blue";
    if (d[0] > 180 && d[1] > 180 && d[2] < 90) return "yellow";
    return "white";
}

/** Render one page with PDF.js and read the color just inside each edge's middle. */
async function drawnEdges(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.25 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const w = canvas.width;
    const h = canvas.height;
    const at = (x, y) => colorAt(context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data);
    return `top=${at(w / 2, h * 0.04)} right=${at(w * 0.96, h / 2)} bottom=${at(w / 2, h * 0.96)} left=${at(w * 0.04, h / 2)}`;
}

const sizeOf = async (pdf, n) => {
    const [, , width, height] = (await pdf.getPage(n)).view;
    return `${width.toFixed(2)}x${height.toFixed(2)}`;
};

const openPdf = (bytes) => getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;

async function refusalOf(orderBytes, quotations) {
    try {
        await appendQuotations(orderBytes, quotations);
        return null;
    } catch (err) {
        return err;
    }
}

/** The appended document's page count — or, if it was refused, what the refusal said. */
async function appendedPages(orderBytes, quotations) {
    try {
        return (await PDFDocument.load(await appendQuotations(orderBytes, quotations))).getPageCount();
    } catch (err) {
        return `refused: ${(err.quotations || []).map((r) => r.reason).join(", ") || err.message}`;
    }
}

/** The appended document opened in PDF.js, or null when it was refused. */
async function openAppended(orderBytes, quotations) {
    try {
        return await openPdf(await appendQuotations(orderBytes, quotations));
    } catch {
        return null;
    }
}

function namesIn(node) {
    const out = new Set();
    walk(node ?? {}, (n) => {
        if (n.type === "Identifier" || n.type === "JSXIdentifier") out.add(n.name);
    });
    return out;
}

export async function run({ check, assert, log }) {
    const jpeg = await edgesCanvas().encode("jpeg", 95);
    const png = await edgesCanvas().encode("png");
    const orderBytes = await pdfWithPages(2, ORDER_PAGE_SIZE);

    // ── 1. the order ─────────────────────────────────────────────────────────
    log("1  in the order the Quotation ID gives — the number, not the string or the links:");
    check("the quotation sequence carries its Q", SEQ_PREFIX, "Q");
    const linked = [
        { quotationId: `${PR_ID}-Q03` },
        { quotationId: "HYE-PR-TESTQA-01-Q01" },
        { quotationId: `${PR_ID}-Q100` },
        { quotationId: `${PR_ID}-Q01` },
        { quotationId: `${PR_ID}-Q11` },
    ];
    const ordered = orderQuotations(linked, { prId: PR_ID, seqPrefix: SEQ_PREFIX }).map((q) => q.quotationId);
    check(
        "numbered order, with a row that is not this request's own last",
        ordered.join(" "),
        `${PR_ID}-Q01 ${PR_ID}-Q03 ${PR_ID}-Q11 ${PR_ID}-Q100 HYE-PR-TESTQA-01-Q01`
    );
    // ANTI-VACUITY: the fixture reaches the width where a string sort goes wrong, and
    // its link order is not already the answer.
    const byString = linked.map((q) => q.quotationId).filter((id) => id.startsWith(PR_ID)).sort();
    check("  a string sort would have put the hundredth before the eleventh", byString.indexOf(`${PR_ID}-Q100`) < byString.indexOf(`${PR_ID}-Q11`), true);
    assert("  and the link order is not the numbered one", linked.map((q) => q.quotationId).join(" ") !== ordered.join(" "));
    check("  two unnumbered rows keep their link order", orderQuotations([{ quotationId: "b" }, { quotationId: "a" }], { prId: PR_ID, seqPrefix: SEQ_PREFIX }).map((q) => q.quotationId).join(" "), "b a");
    check("  and no quotations is no quotations", orderQuotations(undefined, { prId: PR_ID, seqPrefix: SEQ_PREFIX }).length, 0);

    // ── 2. the format ───────────────────────────────────────────────────────
    log("");
    log("2  the format is read off the file's contents:");
    check("a JPEG", quotationFormat(jpeg), "jpeg");
    check("a PNG", quotationFormat(png), "png");
    check("a PDF", quotationFormat(orderBytes), "pdf");
    check("  one whose header sits behind a little junk", quotationFormat(concat(new Uint8Array(200).fill(0x20), orderBytes)), "pdf");
    check("  but not further in than PDF.js looks", quotationFormat(concat(new Uint8Array(1100).fill(0x20), orderBytes)), null);
    check("a HEIC is none of them", quotationFormat(HEIC), null);
    check("  nor a WebP", quotationFormat(WEBP), null);
    check("  nor a GIF", quotationFormat(GIF), null);
    check("  nor an empty file", quotationFormat(new Uint8Array(0)), null);
    // THE NAME IS NOT CONSULTED, asserted through the appender rather than the sniffer,
    // since that is where a name could have been used: a JPEG called `.png` is drawn as
    // a picture, and a HEIC called `.jpg` is refused as what it is.
    check(
        "a JPEG named .png still becomes a page",
        await appendedPages(orderBytes, [{ quotationId: `${PR_ID}-Q01`, filename: "photo.png", bytes: jpeg }]),
        3
    );
    const heicAsJpeg = await refusalOf(orderBytes, [{ quotationId: `${PR_ID}-Q01`, filename: "photo.jpg", bytes: HEIC }]);
    check("  and a HEIC named .jpg is refused as not a PDF, JPEG or PNG", heicAsJpeg?.quotations?.[0]?.reason, "other-format");

    // ── 3. the orientation ──────────────────────────────────────────────────
    log("");
    log("3  the orientation, by the rules Chromium 152 was measured to follow:");
    const SOI = new Uint8Array([0xff, 0xd8]);
    const SOS = new Uint8Array([0xff, 0xda, 0x00, 0x02]);
    const app0 = segment(0xffe0, ascii("JFIF\0\x01\x01\0\0\x01\0\x01\0\0"));
    const sof0 = segment(0xffc0, new Uint8Array([8, 0, 40, 0, 60, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]));
    const xmp = segment(0xffe1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x='adobe:ns:meta/'/>"));
    const jpegWith = (...parts) => concat(SOI, ...parts, SOS);
    check("a JPEG's Exif orientation", imageOrientation(jpegWith(app0, exifSegment(tiff({ value: 6 }))), "jpeg"), 6);
    check("  in either byte order", imageOrientation(jpegWith(exifSegment(tiff({ value: 3, order: "MM" }))), "jpeg"), 3);
    check("  behind an XMP segment", imageOrientation(jpegWith(xmp, exifSegment(tiff({ value: 6 }))), "jpeg"), 6);
    check("  behind the frame header", imageOrientation(jpegWith(sof0, exifSegment(tiff({ value: 6 }))), "jpeg"), 6);
    check("  typed LONG, it is ignored", imageOrientation(jpegWith(exifSegment(tiff({ value: 6, type: 4 }))), "jpeg"), 1);
    check("  carrying two values, it is ignored", imageOrientation(jpegWith(exifSegment(tiff({ value: 6, count: 2 }))), "jpeg"), 1);
    check("  outside 1 to 8, it is ignored", imageOrientation(jpegWith(exifSegment(tiff({ value: 9 }))), "jpeg"), 1);
    check("  and 0 is not a value", imageOrientation(jpegWith(exifSegment(tiff({ value: 0 }))), "jpeg"), 1);
    check("no Exif segment is upright", imageOrientation(jpegWith(app0), "jpeg"), 1);
    check("a truncated block is upright rather than a throw", imageOrientation(jpegWith(exifSegment(tiff({ value: 6 }).subarray(0, 12))), "jpeg"), 1);
    check("a PNG's eXIf orientation, ahead of its image data", imageOrientation(tagPng(png, tiff({ value: 8 })), "png"), 8);
    check("  behind its image data, it is ignored", imageOrientation(tagPng(png, tiff({ value: 8 }), { afterImageData: true }), "png"), 1);
    check("a PNG with none is upright", imageOrientation(png, "png"), 1);
    check("a PDF has no orientation of this kind", imageOrientation(orderBytes, "pdf"), 1);

    // ── 4. the page an image is drawn on ────────────────────────────────────
    log("");
    log("4  an image's page is its own shape at the order's scale:");
    // TYPED OUT, which is #353's rule for a dimension: in terms of the constant, any
    // value it took would pass.
    check("the order's page is A4", ORDER_PAGE_SIZE.join("x"), "595.28x841.89");
    const page = (width, height, orientation = 1) =>
        imagePageSize({ width, height, orientation }).map((n) => n.toFixed(2)).join("x");
    check("a landscape phone photograph gets the order's page on its side", page(4032, 3024), "793.71x595.28");
    check("  a portrait one, the page upright", page(3024, 4032), "595.28x793.71");
    check("  a landscape one tagged a quarter turn is portrait", page(4032, 3024, 6), "595.28x793.71");
    check("  and the other quarter turn too", page(4032, 3024, 8), "595.28x793.71");
    check("a Letter page scanned at 300 dpi lands near its sheet", page(2550, 3300), "595.28x770.36");
    check("  and an A4 one on it", page(2480, 3508), "595.18x841.89");
    check("a phone screenshot is held to the page's height", page(1170, 2532), "389.03x841.89");
    check("a small picture is enlarged to the same scale", page(400, 300), "793.71x595.28");
    check("a square one is as wide as the order", page(1000, 1000), "595.28x595.28");
    // What the rule replaced, as the header states it: pixels as points.
    check("  where pixels as points would have been this many inches wide", 4032 / 72, 56);

    // ── 5. the pages, drawn ─────────────────────────────────────────────────
    log("");
    log("5  a document built by appendQuotations, rendered by PDF.js:");
    const letterPdf = await pdfWithPages(2, [612, 792]);
    const squarePdf = await pdfWithPages(1, [400, 400]);
    const mixed = orderQuotations(
        [
            { quotationId: `${PR_ID}-Q03`, filename: "photo.jpg", bytes: tagJpeg(jpeg, tiff({ value: 6 })) },
            { quotationId: `${PR_ID}-Q01`, filename: "quote.pdf", bytes: letterPdf },
            { quotationId: `${PR_ID}-Q100`, filename: "scan.png", bytes: tagPng(png, tiff({ value: 8 })) },
            { quotationId: `${PR_ID}-Q11`, filename: "second.pdf", bytes: squarePdf },
        ],
        { prId: PR_ID, seqPrefix: SEQ_PREFIX }
    );
    const mixedPdf = await openAppended(orderBytes, mixed);
    check("the order's two pages, then every quotation's", mixedPdf?.numPages ?? "refused", 7);
    if (mixedPdf) {
        const sizes = [];
        for (let n = 1; n <= mixedPdf.numPages; n++) sizes.push(await sizeOf(mixedPdf, n));
        check(
            "  in Quotation ID order, each PDF at its own size and each picture at its page",
            sizes.join(" "),
            "595.28x841.89 595.28x841.89 612.00x792.00 612.00x792.00 561.26x841.89 400.00x400.00 561.26x841.89"
        );
        check("  the photograph tagged 6 stands up", await drawnEdges(mixedPdf, 5), CHROMIUM[6]);
        check("  the PNG tagged 8 stands up", await drawnEdges(mixedPdf, 7), CHROMIUM[8]);
    }

    // EVERY ORIENTATION, BOTH ENCODINGS, AND THE TWO TAGS A BROWSER IGNORES — drawn.
    const every = [];
    for (let o = 1; o <= 8; o++) {
        every.push({ label: `JPEG ${o}`, expect: CHROMIUM[o], bytes: tagJpeg(jpeg, tiff({ value: o })) });
        every.push({ label: `PNG ${o}`, expect: CHROMIUM[o], bytes: tagPng(png, tiff({ value: o })) });
    }
    every.push({ label: "JPEG, 6 typed LONG", expect: CHROMIUM[1], bytes: tagJpeg(jpeg, tiff({ value: 6, type: 4 })) });
    every.push({ label: "PNG, 6 behind the image data", expect: CHROMIUM[1], bytes: tagPng(png, tiff({ value: 6 }), { afterImageData: true }) });
    const everyPdf = await openAppended(
        orderBytes,
        every.map((e, i) => ({ quotationId: `${PR_ID}-Q${i + 1}`, filename: e.label, bytes: e.bytes }))
    );
    check("one page per picture", everyPdf?.numPages ?? "refused", 2 + every.length);
    for (let i = 0; everyPdf && i < every.length; i++) {
        check(`  ${every[i].label} draws as Chromium does`, await drawnEdges(everyPdf, 3 + i), every[i].expect);
    }
    // ANTI-VACUITY: the rendering is seen to tell orientations apart, and a picture
    // drawn with no turn is seen to be wrong for a phone photograph tagged 6 — which
    // is the defect this module exists to remove.
    assert("the reference tells an upright picture from a turned one", CHROMIUM[1] !== CHROMIUM[6]);
    const untagged = await openAppended(orderBytes, [{ quotationId: `${PR_ID}-Q01`, filename: "a", bytes: jpeg }]);
    check("  the same photograph untagged draws as stored", untagged ? await drawnEdges(untagged, 3) : "refused", CHROMIUM[1]);

    // A VIEW INTO A LARGER BUFFER, which is what a Node Buffer often is. pdf-lib reads a
    // JPEG's header through `bytes.buffer` from offset 0, so the module copies first;
    // the copy is load-bearing, and the direct call shows the hazard is real.
    const pool = new Uint8Array(jpeg.length + 16);
    pool.set(jpeg, 16);
    const view = pool.subarray(16);
    let directThrew = false;
    try {
        await (await PDFDocument.create()).embedJpg(view);
    } catch {
        directThrew = true;
    }
    check("pdf-lib cannot read a JPEG that sits at an offset", directThrew, true);
    check(
        "  and the module appends it anyway",
        await appendedPages(orderBytes, [{ quotationId: `${PR_ID}-Q01`, filename: "a", bytes: view }]),
        3
    );
    check("with no quotations the order's bytes come back untouched", (await appendQuotations(orderBytes, [])) === orderBytes, true);

    // ── 6. the refusal ──────────────────────────────────────────────────────
    log("");
    log("6  a quotation that cannot be appended is named, and nothing comes out:");
    // pdf-lib adds a blank page to a document saved with none, unless told not to.
    const zeroPages = await (await PDFDocument.create()).save({ addDefaultPage: false });
    const refusal = await refusalOf(orderBytes, [
        { quotationId: `${PR_ID}-Q01`, filename: "good.pdf", bytes: letterPdf },
        { quotationId: `${PR_ID}-Q02`, filename: "quote-387.pdf", bytes: FAKE_387 },
        { quotationId: `${PR_ID}-Q03`, filename: null, bytes: null },
        { quotationId: `${PR_ID}-Q04`, filename: "photo.jpg", bytes: HEIC },
        { quotationId: `${PR_ID}-Q05`, filename: "locked.pdf", bytes: await encryptedPdf() },
        { quotationId: `${PR_ID}-Q06`, filename: "empty.pdf", bytes: zeroPages },
    ]);
    check("it throws with the code the retry matches on", refusal?.code, QUOTATION_UNREADABLE);
    check(
        "  naming every one that cannot, in order, and not the one that can",
        (refusal?.quotations || []).map((r) => `${r.quotationId.slice(-3)}:${r.reason}`).join(" "),
        "Q02:damaged Q03:no-file Q04:other-format Q05:protected Q06:damaged"
    );
    const oneBad = await refusalOf(orderBytes, [
        { quotationId: `${PR_ID}-Q01`, filename: "good.pdf", bytes: letterPdf },
        { quotationId: `${PR_ID}-Q02`, filename: "quote-387.pdf", bytes: FAKE_387 },
    ]);
    check("one bad quotation among good ones still stops the document", oneBad?.code, QUOTATION_UNREADABLE);
    // Every reason the appender returns has words, and the fixture above produced all
    // of them — so a fifth reason, or one that lost its phrase, fails here.
    const produced = new Set((refusal?.quotations || []).map((r) => r.reason));
    check("every reason it can give has a phrase", Object.keys(PO_QUOTATIONS_COPY.reason).sort().join(" "), [...produced].sort().join(" "));

    const single = PO_QUOTATIONS_COPY.unreadable(oneBad?.quotations || []);
    check(
        "the sentence for one",
        single,
        "This quotation can't be added to this PO's document: quote-387.pdf (HYE-PR-260924-01-Q02), " +
            "whose file can't be read. No document was made. Ask for a readable PDF, JPEG or PNG to be " +
            "attached to that quotation in Airtable, then generate the document again."
    );
    const several = PO_QUOTATIONS_COPY.unreadable(refusal?.quotations || []);
    assert("the sentence for several speaks of them together", several.startsWith("These quotations can't be added") && /each of them/.test(several));
    assert("  names a quotation with no file by its id alone", several.includes(`${PR_ID}-Q03, which has no file on record`));
    assert("  says nothing was made", /No document was made\./.test(several));
    // THE REMEDY IS OUTSIDE THE APP, because an approved request's quotations are past
    // editing here — the same position `PRECISION_BLOCKED_COPY` is in.
    assert("  names Airtable as where it is fixed", /in Airtable/.test(several));
    assert("  and never says to try again", !/try again/i.test(several) && !/try again/i.test(single));
    assert("the protected case does not say password", !/password/i.test(PO_QUOTATIONS_COPY.reason.protected));

    // ── 7. the retry names it, and generation goes through the module ────────
    log("");
    log("7  the document's retry says which, and the document is built here:");
    const actions = parseFile("app/pos/[poId]/actions.js");
    const retry = resolveFunction(actions.ast, "regeneratePDFAction");
    assert("regeneratePDFAction resolves", retry !== null);
    const retryNames = namesIn(retry);
    check("  it matches on the code", retryNames.has("QUOTATION_UNREADABLE"), true);
    check("  and returns the module's sentence", retryNames.has("PO_QUOTATIONS_COPY"), true);
    // Every other failure is still worth another press, and still says so.
    const retrySource = actions.source.slice(retry?.start ?? 0, retry?.end ?? 0);
    assert("  while any other failure still says to try again", /Please try again\./.test(retrySource));
    // THE AUTOMATIC PATH STAYS SILENT, as #308's does: the signer lands on the order's
    // page, which says the document is missing and offers the control that names why.
    const sign = resolveFunction(actions.ast, "signPOHandler");
    assert("signing resolves", sign !== null);
    check("  and names no quotation itself", namesIn(sign).has("PO_QUOTATIONS_COPY"), false);

    const pdfModule = parseFile("lib/poPdf.js");
    const generate = resolveFunction(pdfModule.ast, "generateAndAttachPOPdf");
    const read = resolveFunction(pdfModule.ast, "readQuotationFiles");
    assert("generateAndAttachPOPdf resolves", generate !== null);
    assert("  and appends through the module", callsFunction(generate, "appendQuotations"));
    assert("  from every quotation, read by readQuotationFiles", callsFunction(generate, "readQuotationFiles"));
    assert("readQuotationFiles orders them by the module's rule", read !== null && callsFunction(read, "orderQuotations"));
    const quotationRead = read ? callsTo(read, "getQuotationsByPR")[0] : null;
    assert("  and hands the request's link array over, so the request is not found twice", Boolean(quotationRead) && callPassesProperty(quotationRead, "rowIds"));
    // ONE MODULE MERGES. poPdf.js used to load and copy PDFs itself; a second merge
    // beside the module is how the old first-PDF-only rule would come back.
    check("poPdf.js loads no PDF itself", callsFunction(pdfModule.ast, "load"), false);
    let importsPdfLib = false;
    walk(pdfModule.ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source.value === "pdf-lib") importsPdfLib = true;
    });
    check("  and does not import pdf-lib", importsPdfLib, false);
    // Every page of the order is rendered at the size an image page is fitted to.
    const sizeAttrs = [];
    walk(pdfModule.ast, (n) => {
        if (n.type === "JSXAttribute" && n.name?.name === "size") sizeAttrs.push(n.value);
    });
    check("the order's pages declare a size", sizeAttrs.length, 2);
    check(
        "  and every one is ORDER_PAGE_SIZE",
        sizeAttrs.every((v) => v?.type === "JSXExpressionContainer" && v.expression?.name === "ORDER_PAGE_SIZE"),
        true
    );
}

if (isMain(import.meta.url)) standalone(title, run);

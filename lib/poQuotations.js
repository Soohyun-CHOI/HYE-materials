// The quotations an order's document carries (#40): every one on the request, in the
// order its `Quotation ID` gives, each turned into pages behind the order's own — and
// what is said when one cannot be.
//
// IT REPLACES AN APPENDIX THAT DROPPED THINGS WITHOUT A WORD. `lib/poPdf.js` read the
// request's FIRST quotation in link order and appended it only when it was a PDF, so
// an image quotation was skipped and a second quotation never reached the vendor, and
// nothing anywhere said either had happened. What goes out now is all of them or no
// document at all.
//
// THE FORMAT IS READ OFF THE FILE'S CONTENTS, NEVER ITS NAME OR ITS DECLARED TYPE.
// The upload routes accept `application/pdf`, `image/jpeg` and `image/png`, but the
// forms pass no content type, so Blob takes it from the file name's extension and
// the check is on that name: a HEIC or WebP file called `.jpg` is stored as
// `image/jpeg`. And three server actions hand Airtable a caller-supplied URL for a
// quotation or an invoice file without asking whose it is, so a file of any kind can
// become a quotation that way too. Reading the bytes makes this module right about
// every one of them wherever it came from, whenever those paths are closed.
//
// AN IMAGE'S PAGE IS THE IMAGE'S SHAPE AT THE ORDER'S OWN SCALE. Its proportions are
// the picture's, once turned, and its size is the largest that fits the order's page
// turned the same way. A phone photograph's pixels as points would make a page 56
// inches wide — a vendor printing at actual size gets one corner of it — and the
// photograph's own density field does not help, since a phone writes 72 or nothing.
// Held to the order's page, every page of the document prints on the paper the order
// does, and a scan whose density was real still comes out within a few percent of
// its sheet: a Letter page scanned at 300 dpi lands at 595 by 770 points against 612
// by 792.
//
// AND IT IS DRAWN THE WAY UP A BROWSER DRAWS IT. pdf-lib reads a JPEG's frame header
// and a PNG's pixels and nothing else, so an EXIF orientation is lost and a photo a
// phone stored on its side prints on its side. The app's own viewer shows the same
// file upright, because Chromium applies the tag to an `<img>`; measured in Chromium
// 152, it applies a JPEG's Exif segment and a PNG's `eXIf` chunk alike, all eight
// values, either byte order. So the tag is read here by the rules that browser was
// measured to follow, and the page is drawn through the matching transform.
// `offline/po-quotations.mjs` renders every orientation with PDF.js and compares it
// against that measurement.

import {
    PDFDocument,
    PageSizes,
    concatTransformationMatrix,
    drawObject,
    popGraphicsState,
    pushGraphicsState,
} from "pdf-lib";
import { sequenceOf } from "./idSequence.js";

/**
 * The order document's page, in points — `lib/poPdf.js` renders every page of the
 * order at this size, and an image quotation's page is fitted to it.
 *
 * ONE VALUE FOR BOTH, so a page size changed for the order cannot leave the pictures
 * behind it fitted to the old one. A4 is what the order has always rendered at;
 * `@react-pdf/renderer`'s `"A4"` and pdf-lib's are the same 595.28 by 841.89.
 */
export const ORDER_PAGE_SIZE = PageSizes.A4;

/**
 * The code a refusal carries out of `appendQuotations`, which the document's retry
 * matches on — a code rather than the message, for #308's reason: the message names
 * quotations and files, and matching on prose breaks when somebody improves it.
 */
export const QUOTATION_UNREADABLE = "quotation-unreadable";

/**
 * A request's quotations in the order their `Quotation ID`s give.
 *
 * BY THE NUMBER, NOT THE STRING. `{PR ID}-Q{seq}` is padded to two digits and widens
 * past them, so a string sort puts `-Q100` ahead of `-Q11`; `sequenceOf` is the one
 * reading of that number, the same one that mints it. Gaps from a Draft's re-saves
 * cost nothing here — only the order matters.
 *
 * NOT THE LINK ORDER. The base returns a request's quotations in the order of its
 * `Quotations` links, which is creation order until somebody drags them in Airtable,
 * and the old appendix took whichever came first. An id that is not one of this
 * request's own sequence — a hand-made row — goes after every one that is, in link
 * order, so it still goes out and cannot jump the queue.
 *
 * `seqPrefix` is passed in rather than looked up: it lives in `lib/idSequence.js`'s
 * `CHILD_KINDS` under the table's name, and the caller holds `TABLES`.
 */
export function orderQuotations(quotations, { prId, seqPrefix }) {
    return (quotations || [])
        .map((quotation, linked) => ({
            quotation,
            linked,
            seq: sequenceOf(quotation?.quotationId, prId, { seqPrefix }),
        }))
        .sort((a, b) => {
            if (a.seq !== null && b.seq !== null && a.seq !== b.seq) return a.seq - b.seq;
            if ((a.seq === null) !== (b.seq === null)) return a.seq === null ? 1 : -1;
            return a.linked - b.linked;
        })
        .map(({ quotation }) => quotation);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_HEADER = "%PDF-";

/**
 * How far into a file a PDF's header may sit — PDF.js, which draws every PDF this
 * app shows, looks this far, so a file it opens as a PDF is one this reads as one.
 */
const PDF_HEADER_WINDOW = 1024;

/**
 * What a file is, read off its first bytes: `"pdf"`, `"jpeg"`, `"png"`, or null for
 * anything else — a HEIC, a WebP, a Word file, an empty one.
 */
export function quotationFormat(bytes) {
    if (!bytes || bytes.length < 3) return null;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
    if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "png";
    const head = String.fromCharCode(...bytes.subarray(0, PDF_HEADER_WINDOW));
    return head.includes(PDF_HEADER) ? "pdf" : null;
}

/**
 * The EXIF orientation a browser draws a JPEG or PNG with, 1 to 8; 1 when it has none.
 *
 * THE RULES ARE WHAT CHROMIUM 152 WAS MEASURED TO DO, not the whole of the EXIF
 * specification, because what this has to match is the picture a reader already saw
 * in the app. A JPEG's first APP1 segment opening `Exif\0\0` anywhere before its scan
 * counts — after an XMP segment and after the frame header both did. A PNG's `eXIf`
 * chunk counts only ahead of the image data: after it, the browser ignored it. And the
 * entry counts only as the specification types it — a SHORT, one of them, 1 to 8:
 * typed LONG, carrying two values, or holding 0 or 9, the browser drew the file as
 * stored.
 */
export function imageOrientation(bytes, format) {
    if (format === "jpeg") return jpegOrientation(bytes);
    if (format === "png") return pngOrientation(bytes);
    return 1;
}

function jpegOrientation(bytes) {
    let pos = 2;
    while (pos + 4 <= bytes.length) {
        if (bytes[pos] !== 0xff) return 1;
        const marker = bytes[pos + 1];
        // A fill byte, or a marker that carries no length.
        if (marker === 0xff) {
            pos += 1;
            continue;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            pos += 2;
            continue;
        }
        // The scan, or the end: nothing after either is read by a browser as metadata.
        if (marker === 0xda || marker === 0xd9) return 1;
        const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
        if (length < 2) return 1;
        const start = pos + 4;
        const end = Math.min(pos + 2 + length, bytes.length);
        if (marker === 0xe1 && isExifHeader(bytes, start)) return tiffOrientation(bytes, start + 6, end);
        pos += 2 + length;
    }
    return 1;
}

function isExifHeader(bytes, at) {
    return (
        bytes[at] === 0x45 && // E
        bytes[at + 1] === 0x78 && // x
        bytes[at + 2] === 0x69 && // i
        bytes[at + 3] === 0x66 && // f
        bytes[at + 4] === 0 &&
        bytes[at + 5] === 0
    );
}

function pngOrientation(bytes) {
    let pos = PNG_SIGNATURE.length;
    while (pos + 8 <= bytes.length) {
        const length = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
        const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
        if (type === "IDAT" || type === "IEND") return 1;
        if (type === "eXIf") return tiffOrientation(bytes, pos + 8, Math.min(pos + 8 + length, bytes.length));
        pos += 12 + length;
    }
    return 1;
}

const ORIENTATION_TAG = 0x0112;
const TIFF_SHORT = 3;

/** The orientation entry of the TIFF block that starts at `at` and ends at `end`. */
function tiffOrientation(bytes, at, end) {
    if (at + 8 > end) return 1;
    const little = bytes[at] === 0x49 && bytes[at + 1] === 0x49;
    const big = bytes[at] === 0x4d && bytes[at + 1] === 0x4d;
    if (!little && !big) return 1;
    const u16 = (o) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
    const u32 = (o) =>
        (little
            ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
            : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
    if (u16(at + 2) !== 42) return 1;
    const ifd = at + u32(at + 4);
    if (ifd + 2 > end) return 1;
    const entries = u16(ifd);
    for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > end) return 1;
        if (u16(entry) !== ORIENTATION_TAG) continue;
        if (u16(entry + 2) !== TIFF_SHORT || u32(entry + 4) !== 1) return 1;
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : 1;
    }
    return 1;
}

/**
 * The page an image is drawn on, `[width, height]` in points: the picture's own
 * proportions once `orientation` has turned it, at the largest size that fits
 * `ORDER_PAGE_SIZE` turned the same way.
 *
 * A picture wider than it is tall gets the order's page on its side, so a landscape
 * photograph is not shrunk to a portrait page's width. Small pictures are enlarged by
 * the same rule, so every image page is at the order's scale rather than at whatever
 * the camera chose.
 */
export function imagePageSize({ width, height, orientation }) {
    const turned = orientation >= 5 && orientation <= 8;
    const w = turned ? height : width;
    const h = turned ? width : height;
    const short = Math.min(...ORDER_PAGE_SIZE);
    const long = Math.max(...ORDER_PAGE_SIZE);
    const [boxWidth, boxHeight] = w > h ? [long, short] : [short, long];
    const scale = Math.min(boxWidth / w, boxHeight / h);
    return [w * scale, h * scale];
}

/**
 * The transform that draws an image, stored as its file holds it, onto a page of
 * `width` by `height` points the way up `orientation` says.
 *
 * An image is drawn into the unit square with its first row at the top, so the plain
 * matrix scales that square to the page. Each other orientation sends the stored
 * edges where the tag puts them: 2 mirrors left and right, 3 turns a half turn, 4
 * mirrors top and bottom, 6 turns a quarter clockwise and 8 counter-clockwise, and 5
 * and 7 are those two mirrored. For 5 to 8 the page is already the turned shape.
 *
 * Not exported, and held by what it draws rather than by its numbers:
 * `offline/po-quotations.mjs` renders a page per orientation with PDF.js and compares
 * it against Chromium, so a matrix and a wrong expectation of it cannot agree.
 */
function orientationMatrix(orientation, width, height) {
    switch (orientation) {
        case 2:
            return [-width, 0, 0, height, width, 0];
        case 3:
            return [-width, 0, 0, -height, width, height];
        case 4:
            return [width, 0, 0, -height, 0, height];
        case 5:
            return [0, -height, -width, 0, width, height];
        case 6:
            return [0, -height, width, 0, 0, height];
        case 7:
            return [0, height, width, 0, 0, 0];
        case 8:
            return [0, height, -width, 0, width, 0];
        default:
            return [width, 0, 0, height, 0, 0];
    }
}

/**
 * The order's own pages followed by every quotation's, as the bytes of one PDF.
 *
 * `quotations` is `[{ quotationId, filename, bytes }]`, already in order, `bytes` null
 * for a quotation with no file on record. A PDF adds all its pages; a JPEG or PNG adds
 * one page, sized and turned as above.
 *
 * ALL OR NOTHING. Every quotation is tried, and if any cannot be appended this
 * throws, carrying `QUOTATION_UNREADABLE` and the list of every one that could not —
 * not just the first, so one repair and one retry is enough. A document missing a
 * quotation is never produced, because it could never be put right: the order's
 * retry refuses to replace a document that exists (#281), so a partial one would go to
 * the vendor as it was.
 *
 * With no quotations the order's bytes come back untouched.
 */
export async function appendQuotations(orderBytes, quotations) {
    if (!quotations || quotations.length === 0) return orderBytes;

    const merged = await PDFDocument.create();
    const order = await PDFDocument.load(orderBytes);
    for (const page of await merged.copyPages(order, order.getPageIndices())) merged.addPage(page);

    const refused = [];
    for (const quotation of quotations) {
        const reason = await appendOne(merged, quotation.bytes);
        if (reason) {
            refused.push({ quotationId: quotation.quotationId, filename: quotation.filename ?? null, reason });
        }
    }
    if (refused.length > 0) {
        const named = refused.map((r) => `${r.quotationId} (${r.reason})`).join(", ");
        throw Object.assign(new Error(`Quotations that cannot be appended: ${named}`), {
            code: QUOTATION_UNREADABLE,
            quotations: refused,
        });
    }
    return merged.save();
}

/** Append one quotation's pages, or say why it cannot be: a key of the copy's `reason`. */
async function appendOne(merged, bytes) {
    if (!bytes || bytes.length === 0) return "no-file";
    const format = quotationFormat(bytes);
    if (!format) return "other-format";
    // A FRESH COPY, because pdf-lib reads a JPEG's header through a DataView over
    // `bytes.buffer` from offset 0 — a view into a larger buffer, which is what a
    // Node Buffer often is, would be read from the wrong place.
    const data = new Uint8Array(bytes);
    try {
        if (format === "pdf") {
            // OPENED PAST ITS ENCRYPTION ONLY TO BE ASKED ABOUT IT. pdf-lib cannot
            // decrypt, and copying from an encrypted file carries its still-encrypted
            // streams into pages that draw as noise — so an encrypted one is refused
            // rather than appended. Asked through `isEncrypted` rather than by catching
            // the refusal `load` throws otherwise: that is a plain `Error` whatever its
            // class claims, since pdf-lib's error subclasses are compiled to ES5 and
            // fail `instanceof`, so only its message would tell it apart.
            const source = await PDFDocument.load(data, { ignoreEncryption: true });
            if (source.isEncrypted) return "protected";
            const indices = source.getPageIndices();
            if (indices.length === 0) return "damaged";
            for (const page of await merged.copyPages(source, indices)) merged.addPage(page);
            return null;
        }
        const image = format === "jpeg" ? await merged.embedJpg(data) : await merged.embedPng(data);
        const orientation = imageOrientation(data, format);
        const [width, height] = imagePageSize({ width: image.width, height: image.height, orientation });
        const page = merged.addPage([width, height]);
        const name = page.node.newXObject("Image", image.ref);
        page.pushOperators(
            pushGraphicsState(),
            concatTransformationMatrix(...orientationMatrix(orientation, width, height)),
            drawObject(name),
            popGraphicsState()
        );
        return null;
    } catch {
        return "damaged";
    }
}

/**
 * What the document's retry says when a quotation cannot be appended.
 *
 * ITS READER CANNOT FIX THIS IN THE APP, AND IT SAYS WHERE THEY CAN. The request is
 * approved by the time its order is signed, and `editAndContinueAction` takes only a
 * request still in review, so a quotation's file is past changing here — the same
 * position `PRECISION_BLOCKED_COPY` is in, which names Airtable for the same reason.
 * And it never says to try again: pressing again fails identically until the file is
 * replaced.
 *
 * EACH QUOTATION IS NAMED AS THE REQUEST'S PAGE SHOWS IT — by its file's name, which
 * is the link there — with its `Quotation ID` beside it, which is what Airtable shows.
 * A quotation with no file is named by the id alone.
 *
 * THE PROTECTED CASE DOES NOT SAY PASSWORD. The app's viewer opens a PDF locked only
 * against editing without asking for anything, so a reader who has just looked at
 * the file would be told something false; what is true of every such file is that its
 * pages cannot be copied into another document.
 */
export const PO_QUOTATIONS_COPY = {
    reason: {
        "no-file": "which has no file on record",
        "other-format": "whose file isn't a PDF, JPEG or PNG",
        damaged: "whose file can't be read",
        protected: "whose file is a protected PDF, and its pages can't be copied into another document",
    },
    unreadable: (refused) => {
        const one = refused.length === 1;
        const named = refused
            .map((r) => {
                const name = r.filename ? `${r.filename} (${r.quotationId})` : r.quotationId;
                return `${name}, ${PO_QUOTATIONS_COPY.reason[r.reason]}`;
            })
            .join("; ");
        return (
            `${one ? "This quotation" : "These quotations"} can't be added to this PO's document: ${named}. ` +
            "No document was made. Ask for a readable PDF, JPEG or PNG to be attached to " +
            `${one ? "that quotation" : "each of them"} in Airtable, then generate the document again.`
        );
    },
};

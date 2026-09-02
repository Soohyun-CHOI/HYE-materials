// Where an uploaded file is reached, and what the screen showing it says (#331).
//
// FIVE FIELDS, ONE ROUTE, AND THE AXIS IS WHAT PICKS THE GATE. Every screen that
// links an uploaded file used to link Airtable's own signed url, which carries a
// fixed expiry stamped when the page rendered — measured on this base at 2h36m from
// the read, and dying at the wall-clock instant the url's own path segment names
// rather than an interval after it. `app/api/files/[axis]/[documentId]/[filename]`
// serves the file instead and re-reads the record on each request, so the href a
// screen renders never goes stale. The axis token below is the whole of what a
// caller supplies about WHICH field: a table name and a field name are not
// addressable, so there is no input the gate has to validate beyond the id, and the
// three gates the five axes sit behind are bound to their axis in one place
// (`app/api/files/.../route.js`'s own map) rather than chosen per request.
//
// WHY THE TOKENS ARE THE TABLES' ROW NOUNS. `naming.md`: a concept with a table
// behind it takes that table's name. The axis names the RECORD whose field is being
// served, so it is the singular row noun and not the plural collection the page
// routes use — `/pos` is a list of orders and `purchase-order` is one of them.
//
// PURE AND IMPORT-FREE, the same reason `lib/uploadLimit.js` and
// `lib/directPurchase.js` are: six screens import this and five of them are
// `"use client"`, so nothing here may reach `lib/airtable/` at any depth. It also
// means the offline tier can load it under plain `node`, which is what lets
// `offline/screen-briefs.mjs` pin the words below.

/**
 * The five fields an uploaded file can be served from, as URL segments.
 *
 * A closed set, so an unknown token misses the route's map and answers before any
 * record is read. `Purchase Orders."Quotation File"` is deliberately absent: it is a
 * Lookup chain onto `Quotations.File` with no reader, and giving it an axis would
 * make one file reachable under two gates.
 */
export const FILE_AXIS = {
    quotation: "quotation",
    purchaseOrder: "purchase-order",
    invoice: "invoice",
    delivery: "delivery",
    directPurchase: "direct-purchase",
};

/**
 * What the viewer calls each one, over the file's own name.
 *
 * NONE OF THESE FIVE WORDS IS COINED HERE. Four are what the screens already say —
 * `pos-poId.md`'s "The purchase order PDF", `invoices-invoiceId.md`'s "The uploaded
 * invoice file", the delivery form's own `Replace the packing list photo` — and the
 * first is the `Quotations` table's row noun. The alternative was one heading per
 * screen, which is five wordings for one component and the drift `naming.md` exists
 * against.
 *
 * TWO AXES SHARE A LABEL AND THAT IS NOT THE BORROWING `naming.md` BARS. A direct
 * purchase's file is a vendor's invoice that has no `Invoices` row yet — the base
 * says so itself, since `Direct Purchases."Vendor Invoice Code"` is the same field
 * name `Invoices` carries — so the word names the same concept rather than a second
 * one. The strip that links it already says `View invoice` and `no invoice number`.
 */
export const FILE_AXIS_LABEL = {
    [FILE_AXIS.quotation]: "Quotation",
    [FILE_AXIS.purchaseOrder]: "Purchase order PDF",
    [FILE_AXIS.invoice]: "Invoice file",
    [FILE_AXIS.delivery]: "Packing list photo",
    [FILE_AXIS.directPurchase]: "Invoice file",
};

/**
 * The content types this route will serve as themselves.
 *
 * THE SAME THREE VALUES THE UPLOAD ROUTES ACCEPT AND NOT THE SAME RULE, which is the
 * measurable condition CLAUDE.md's "one rule, one implementation" asks for before
 * two lists are allowed to exist. The upload allowlist binds what this app WRITES;
 * this one binds what a response from our own origin may CLAIM to be, including a
 * type this app never accepted — an attachment added by hand in Airtable can be
 * anything, and serving attacker-supplied bytes from our origin as `text/html` is
 * stored XSS. They diverge the day a type is accepted for upload that must not be
 * rendered in place, or the day the base holds one nothing here uploaded.
 */
export const SERVABLE_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** How the viewer shows a file: in an image element, in a frame, or not at all. */
export const FILE_RENDER = {
    image: "image",
    document: "document",
    unknown: "unknown",
};

/**
 * Which of those three a content type gets.
 *
 * An unknown type is `unknown` rather than `document`, because a frame is the shape
 * with no failure signal (see FILE_VIEWER_COPY below) and guessing into it is how a
 * reader gets a blank box for a file that was never going to render.
 */
export function fileRenderKind(contentType) {
    const type = String(contentType || "").toLowerCase();
    if (type === "image/jpeg" || type === "image/png") return FILE_RENDER.image;
    if (type === "application/pdf") return FILE_RENDER.document;
    return FILE_RENDER.unknown;
}

/**
 * The href for one file, which every screen builds and nothing stores.
 *
 * THE FILENAME SEGMENT IS NOT MATCHED AND THE RECORD IS THE AUTHORITY. It is there
 * because a browser titles a tab and names a saved file from the URL's last segment,
 * measured both ways: with `Content-Disposition: inline; filename="HYE logo.png"` and
 * no such segment the tab read `HYE-DL-260821-02`, and with it the tab read `HYE
 * logo.png`, space intact. Validating it would 404 a bookmark whose photo has since
 * been replaced, which makes this worse than the link it replaces; ignoring it means
 * a stale segment shows a stale title for one paint while the header and the saved
 * name come off the record.
 */
export function fileHref({ axis, documentId, filename }) {
    const last = filename || documentId || "file";
    return [
        "/api/files",
        encodeURIComponent(axis),
        encodeURIComponent(documentId),
        encodeURIComponent(last),
    ].join("/");
}

/** `Quotation · LSP-OVERINFER-0806.pdf` — what the axis is, then which file. */
export function fileViewerTitle({ axis, filename }) {
    const label = FILE_AXIS_LABEL[axis] || "File";
    return filename ? `${label} · ${filename}` : label;
}

/**
 * The viewer's words.
 *
 * THE DOWNLOAD CONTROL IS ALWAYS PRESENT AND THAT IS THE WHOLE ANSWER TO A VIEWER
 * THAT FAILS SILENTLY, which the issue names as the thing that must not be left to
 * the frame. There is no reliable way to learn that a document did not render, and
 * that is measured rather than assumed: `navigator.pdfViewerEnabled` returned `true`
 * in a browser that then displayed nothing, and `<object type="application/pdf">`'s
 * fallback children stayed hidden while its box sat empty. So nothing branches on
 * detection — the way out is beside the frame in every state, and an empty box is
 * never a dead end.
 *
 * WHICH LEAVES TWO SENTENCES, SPLIT BY WHETHER THE FAILURE CAN BE SEEN. An image
 * reports its own failure (`onerror`, measured firing), so it gets a state. A
 * document reports nothing, so it gets a line that is always there — the one place
 * this app tells a reader what to conclude from seeing nothing.
 */
export const FILE_VIEWER_COPY = {
    /** The control that saves it. Same-origin, so the anchor's own `download` binds. */
    download: "Download",
    close: "Close",
    /** Under a document frame, in every state, because no state can be detected. */
    documentHint: "If nothing appears above, this browser cannot show it here — download it to open it.",
    /** An image that reported an error, which is the one failure with a signal. */
    imageFailed: "This file could not be loaded.",
    /** A type the viewer will not put in a frame at all. */
    notViewable: "This file cannot be shown here — download it to open it.",
};

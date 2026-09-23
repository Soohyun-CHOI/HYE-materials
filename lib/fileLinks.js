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
// `lib/directPurchase.js` are: every component that draws or links a file imports
// this and most of them are `"use client"`, so nothing here may reach
// `lib/airtable/` at any depth. It also
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

/** How a file is drawn: in an image element, as PDF pages, or not at all. */
export const FILE_RENDER = {
    image: "image",
    document: "document",
    unknown: "unknown",
};

/**
 * Which of those three a content type gets.
 *
 * An unknown type is `unknown` rather than `document`, because only a PDF is a
 * document here: the renderer that draws one reads nothing else, so guessing into it
 * would turn a file that was never going to render into a failure sentence rather
 * than the refusal that says to download it.
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
 * The viewer's words, and the words of every control drawn around a file.
 *
 * THE DOWNLOAD CONTROL IS ALWAYS PRESENT, and #331 made it so because a document in a
 * frame could fail with no signal at all: `navigator.pdfViewerEnabled` returned
 * `true` in a browser that then displayed nothing. #433 took the frame away — the
 * app draws a PDF itself now, so a document that does not open is a state it SEES,
 * and it says so in one of two sentences below. The control stays beside every state
 * anyway, since saving and showing are two acts and a design may not merge them.
 *
 * `loadFailed` IS BOTH KINDS' FAILURE. It was the image's sentence while an image was
 * the only kind that reported one, and it names neither kind, so a PDF that will not
 * open says the same thing — the answer to both is the control beside it.
 */
export const FILE_VIEWER_COPY = {
    /** The control that saves it. Same-origin, so the anchor's own `download` binds. */
    download: "Download",
    close: "Close",
    /** While a PDF is opening, which on a large scan is long enough to see. */
    loading: "Opening the file…",
    /** An image that reported an error, or a PDF that would not open. */
    loadFailed: "This file could not be loaded.",
    /**
     * A PDF that asks for a password — the one failure the renderer names. It says
     * nothing about downloading, because the pane has no download: the file there is
     * the reader's own, just picked, and the viewer has the control beside it anyway.
     */
    passwordProtected: "This file is protected by a password and cannot be shown here.",
    /** A type the viewer will not draw at all. */
    notViewable: "This file cannot be shown here — download it to open it.",
    /** The viewer's one page at a time. Not the document lists' `Previous`/`Next`. */
    previousPage: "Previous page",
    nextPage: "Next page",
    pageOf: (page, pages) => `Page ${page} of ${pages}`,
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    /** The pane's return to where it opened: the file as wide as the column. */
    fitWidth: "Fit width",
    /** A quarter turn clockwise, in the pane. */
    rotate: "Rotate",
};

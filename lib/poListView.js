// The view rules for the purchase order list (#168) — the Status column's text,
// and which empty state a viewer gets.
//
// Pure and dependency-free, so the offline tier pins every clause
// (offline/po-list-view.mjs). Same split as lib/materialPriceView.js and
// lib/deliveryStatus.js: the page fetches and gates, this decides what the rows
// look like once it has them.
//
// ORDERING IS NOT HERE. It was a `sortPORows` comparator over `Created Date` with
// `PO ID` as the tie-break; the list now sorts by `PO ID` alone, which Airtable
// does server-side in getAllPOs — exactly as getAllInvoices sorts by `Invoice ID`.
// A PO ID is fixed width and zero-padded, so ID order IS date order, and there is
// nothing left for JS to decide. The comparator's undated-last clause went with
// it: every PO has an ID.

/**
 * What the Status column says.
 *
 * THE STATUS VALUE IS RENDERED VERBATIM, which is deliberate rather than lazy:
 * this column's whole job is to report the field, so the screen word and the
 * Airtable option agree and no row is needed in CLAUDE.md's screen-words table.
 *
 * `Awaiting Signature` GETS NO SPECIAL TREATMENT HERE — no warning, no emphasis.
 * An unsigned purchase order is an ordinary state of a purchase order, not a
 * problem. The combination worth flagging is "unsigned AND already invoiced",
 * which is a fact about the invoice screens rather than this list, and is its own
 * Phase 3 issue.
 *
 * NO DATES AT ALL, which is what makes this column a CLOSED SET a reader learns
 * once and then recognizes — the property #166 identified as the difference
 * between a list cell and a sentence. It carried `Signed 2026-07-27` and
 * `Withdrawn 2026-07-27` first; both dates went, and neither is lost. When a PO
 * was signed is on `/pos/[poId]`, which shows President Signed and its instant,
 * and the list already carries `Created` for the date a reader scans by.
 *
 * That is also why there is no separate Signed column: it would be blank for
 * every unsigned and withdrawn row — 24 of this base's 40 — and the table's
 * declared widths already spend all 832px the page has, so a seventh column
 * would have to take its width from Vendor, the one column with nothing to
 * spare.
 *
 * An unrecognized status is returned as-is rather than swallowed — the same
 * posture as #19's `PO: <status>` tag, so an option added to the field later
 * shows up instead of vanishing.
 */
export function statusLabel(po) {
    const status = po?.status || "";
    return status || "—";
}

/**
 * The three empty states, which are three different facts and must not share a
 * sentence.
 *
 * "Nothing here yet" and "nothing here FOR YOU" are the pair that matters: a
 * viewer who can see no purchase order because none is on their jobs must not be
 * told the company has never raised one. The word "yet" is what makes the first
 * message false in that case, which is why only one of them carries it.
 */
export const EMPTY_COPY = {
    none: "No purchase orders yet. One is generated automatically when a purchase request is fully approved.",
    hidden: "No purchase orders to show. You see a purchase order when you can see the request behind it.",
    filtered: "No purchase orders match these filters.",
};

/**
 * Which of the three applies, or null when there are rows to render.
 *
 * ORDER IS LOAD-BEARING. `filtered` is tested LAST, because a viewer with nothing
 * visible at all would otherwise be told to adjust filters that cannot help them.
 * `totalCount` is every PO on the base before the visibility gate; `visibleCount`
 * is what survived it, before any client-side filter.
 */
export function emptyStateKind({ totalCount, visibleCount, filtersActive }) {
    if (totalCount === 0) return "none";
    if (visibleCount === 0) return "hidden";
    if (filtersActive) return "filtered";
    return null;
}

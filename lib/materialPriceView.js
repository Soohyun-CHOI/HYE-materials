// The view rules for the material price screens (#19).
//
// Everything here is a judgement the two pages would otherwise each make their
// own way: how a typed query becomes match tokens, how vendor rows are ordered,
// which row carries the "lowest" mark and whether it is shown at all, when the
// quantity caveat applies, and whether a history line counts as ordered.
//
// Pure apart from lib/itemNaming.js (itself pure), so
// scripts/tests/offline/material-price-view.mjs pins all of it without
// credentials.
//
// NOTE THE EXPLICIT `.js` ON THAT IMPORT, which is deliberate and is the only
// place in lib/ that does it. The offline tier runs under plain `node` with no
// module loader, and node cannot resolve the extensionless intra-lib imports the
// rest of the app relies on Next to resolve. That is the real reason every other
// offline-safe module is dependency-FREE rather than merely pure — the
// alternative here was inlining normalizeItemText, i.e. a second implementation
// of #18's naming rule, which is worse than a deviation from an import style.

import { normalizeItemText } from "./itemNaming.js";

/** More tokens than this and the query is not a search any more. */
export const MAX_SEARCH_TOKENS = 6;

/**
 * A typed query becomes match tokens through the SAME normalization that decided
 * how the name was stored (#18's normalizeItemText): trim, collapse internal
 * whitespace, case untouched. Lower-casing happens here rather than there
 * because storage must preserve case (the string is printed on the vendor's PO)
 * while matching must ignore it.
 *
 * Tokens are AND-ed by the caller against `Material Label`, which is
 * `Item Name_Size_Unit`. Consequences worth knowing:
 *   - Word order does not matter: `2" pipe` and `pipe 2"` both match `Pipe_2"_EA`.
 *   - Each token is a SUBSTRING match, so `pip` finds `Pipe`. That is the point
 *     — someone half-remembering a name should get there.
 *   - A token can match the size or unit part, so `EA` narrows to EA items.
 *     That is a consequence of matching the label rather than a feature, and it
 *     is acceptable: the user typed it and can see what came back.
 *   - Duplicates are dropped, since AND-ing a token with itself narrows nothing.
 */
export function buildSearchTokens(query) {
    const cleaned = normalizeItemText(query).toLowerCase();
    if (!cleaned) return [];
    return Array.from(new Set(cleaned.split(" ").filter(Boolean))).slice(0, MAX_SEARCH_TOKENS);
}

/**
 * Vendor comparison rows, newest first.
 *
 * NEWEST first rather than cheapest first, deliberately: a three-year-old price
 * that happens to be the lowest would otherwise take the most prominent row on
 * the screen and read as the answer. Recency is the more useful default, and the
 * lowest price is surfaced as a mark instead of as an ordering.
 *
 * A row with no date sorts last — it cannot claim to be recent.
 */
export function sortVendorRows(rows) {
    return [...rows].sort((a, b) => {
        const da = a.latestDate || "";
        const db = b.latestDate || "";
        if (da !== db) return db.localeCompare(da);
        return (a.vendorName || "").localeCompare(b.vendorName || "");
    });
}

/**
 * Which rows hold the lowest unit price — a statement of fact, not a
 * recommendation, which is why ties mark every tied row rather than picking one.
 *
 * Returns an EMPTY set when there is only one vendor row: "lowest of one" tells
 * the reader nothing and would dress a single data point as a comparison. Also
 * empty when no row carries a comparable number.
 *
 * Note what this deliberately does NOT do: it does not normalize for quantity.
 * A lower unit price at a different quantity is not necessarily the better buy,
 * and qtyDiffersAcross below exists so the screen can say so instead of this
 * function pretending to resolve it.
 */
export function lowestPriceRowIds(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return new Set();
    const priced = rows.filter((r) => Number.isFinite(r.unitPrice));
    if (priced.length === 0) return new Set();
    const min = Math.min(...priced.map((r) => r.unitPrice));
    return new Set(priced.filter((r) => r.unitPrice === min).map((r) => r.id));
}

/**
 * Whether these rows were priced at different quantities, in which case their
 * unit prices are not directly comparable and the screen says so. Rows without
 * a quantity are ignored rather than treated as 0 — an unknown quantity is not
 * evidence of a difference.
 */
export function qtyDiffersAcross(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return false;
    const qtys = rows.map((r) => r.qty).filter((q) => Number.isFinite(q));
    if (qtys.length < 2) return false;
    return new Set(qtys).size > 1;
}

/**
 * History lines, newest first.
 *
 * The date is the source PO's `Created Date` — see lib/materialHistory.js for
 * why that field. It is calendar-only, so several POs on one day are
 * indistinguishable by date; the tie-break is PO ID descending, which is
 * monotonic within a day by construction (HYE-PO-YYYYMMDD-##).
 */
export function sortHistoryRows(rows) {
    return [...rows].sort((a, b) => {
        const da = a.date || "";
        const db = b.date || "";
        if (da !== db) return db.localeCompare(da);
        return (b.poId || "").localeCompare(a.poId || "");
    });
}

/**
 * Does this line count as ordered?
 *
 * This reads #18's judgement rather than re-deriving it. `PO Items.Committed Qty`
 * is `IF({PO Status} & "" = "Withdrawn", 0, {Qty})`, so the withdrawn-PO rule
 * already lives in that one Airtable field and is what the Materials rollups
 * traverse. Testing the status string here would be a second implementation of
 * it, and the two would drift the moment a status option is added.
 *
 * Note this is NOT the same as "the PO was withdrawn": a Qty-0 line on a live PO
 * also fails to count. That is why the screen renders the status chip from
 * `PO Status` and uses this only for the "not counted as ordered" note — the
 * label and the judgement come from different fields on purpose, each from the
 * field that actually holds it.
 */
export function countsAsOrdered({ committedQty }) {
    return (committedQty || 0) > 0;
}

// The view rules for the material price screens (#19).
//
// Everything here is a judgment the two pages would otherwise each make their
// own way: how a typed query becomes match tokens, how vendor rows are ordered,
// which row carries the "lowest" mark and whether it is shown at all, and when
// the quantity caveat applies. `countsAsOrdered` lived here until #169 moved it
// to lib/poItemQty.js, which is where a per-item quantity judgment belongs;
// nothing in this file ever recorded that it would.
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
// Issue #281 — the signature axis's allowlist, spelled once. Extension spelled out
// for the same reason the import above is: the offline tier runs under plain `node`
// with no loader.
import { isPOSigned } from "./poUnsigned.js";
// Issue #357 — the separator the composed path joins with, taken from the module
// that owns it rather than spelled here. `Material Label` carries a category path
// since #356, so the separator is now something a reader can type.
import { CATEGORY_LABEL_SEPARATOR } from "./materialCategory.js";

/**
 * The most tokens one query may carry.
 *
 * IT WAS 6, AND A COMPOSED PATH BROKE IT FROM BOTH ENDS (#357). The figure meant
 * "more than this and the query is not a search any more", which was true of a
 * label holding two or three typed words. `Material Label` carries a category
 * path since #356 — a median of 9 words and up to 19 — and a path is printed on
 * the purchase order the vendor reads, so pasting one back to look up its price
 * history is an ordinary thing to do. At 6 that query did not narrow at all: the
 * cap keeps the first tokens, which are the OUTERMOST levels and are shared by
 * every row in the branch, and drops the leaf, which is the only part that
 * identifies. Measured on the base — the whole of
 * `Stainless Steel (SUS) > Tee > SUS 304 > PTFE Lined` returned 25 rows while
 * its last three words returned 2.
 *
 * SO THE FIGURE IS THE LONGEST LABEL A READER CAN PASTE BACK, and it is derived
 * rather than picked: 16 DISTINCT words in the longest committed path — 19
 * before duplicates are dropped, and this function drops them — plus the longest
 * size on the base (`M16 x 1m`, 3) and a unit. `offline/material-price-view.mjs`
 * re-derives the path half from the committed tree every run and the assertion
 * is exactly tight, so a deeper path from a future import fails the check
 * instead of silently truncating a query again.
 *
 * What the cap is FOR is the formula, which grows one `SEARCH()` clause per
 * token — 20 of them is under a kilobyte of query string against Airtable's
 * limit, so the bound is comfortable rather than tight.
 */
export const MAX_SEARCH_TOKENS = 20;

/**
 * The path separator as a reader would type it (#357).
 *
 * `Material Label` held `Item Name_Size_Unit` with the name typed by a requester
 * until #356; it holds the category's composed path now, and the path is what the
 * screen renders as the item's heading. So copying a heading back into the search
 * box is an ordinary thing to do, and it arrives carrying arrows.
 *
 * Derived from `CATEGORY_LABEL_SEPARATOR` rather than written as `">"`, so a
 * change to the separator moves both halves at once — the same property
 * `lib/materialCategory.js` gives the label rule and its Airtable expression.
 */
const PATH_SEPARATOR_TOKEN = CATEGORY_LABEL_SEPARATOR.trim();

/**
 * A typed query becomes match tokens through the SAME normalization that decided
 * how the name was stored (#18's normalizeItemText): trim, collapse internal
 * whitespace, case untouched. Lower-casing happens here rather than there
 * because storage must preserve case (the string is printed on the vendor's PO)
 * while matching must ignore it.
 *
 * Tokens are AND-ed by the caller against `Material Label`, which is
 * `<category path>_Size_Unit` since #356. Consequences worth knowing:
 *   - Word order does not matter: `ball valve 2"` and `2" ball valve` both match
 *     `Stainless Steel (SUS) > Ball Valve > … > SW 600LB_2"_EA`.
 *   - Each token is a SUBSTRING match, so `pip` finds `Pipe`. That is the point
 *     — someone half-remembering a name should get there.
 *   - A token can match the size or unit part, so `EA` narrows to EA items.
 *     That is a consequence of matching the label rather than a feature, and it
 *     is acceptable: the user typed it and can see what came back.
 *   - Duplicates are dropped, since AND-ing a token with itself narrows nothing.
 *
 * THE SEPARATOR IS DROPPED AND NOTHING ELSE ABOUT THE RULE CHANGED (#357). The
 * words a query can reach are the catalog's rather than any requester's now, and
 * a substring rule reads differently against a path: `tee` matches every row
 * under `Stainless Steel (SUS)` through `s-tee-l`. A word-boundary rule was
 * measured against that and REJECTED — it also zeroes `304l` and `40`, which
 * appear in the tree only as the tail of `WP304L` and `SCH40`. The asymmetry is
 * what decides it: a false match is narrowed by typing another word, because
 * every token narrows, and a missing match is recoverable by nothing.
 * `docs/notes/materials.md` carries the figures for both.
 */
export function buildSearchTokens(query) {
    const cleaned = normalizeItemText(query).toLowerCase();
    if (!cleaned) return [];
    const words = cleaned.split(" ").filter((word) => word && word !== PATH_SEPARATOR_TOKEN);
    return Array.from(new Set(words)).slice(0, MAX_SEARCH_TOKENS);
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
 * History rows, newest first.
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
 * The tag for a source PO's status, or null when it needs none.
 *
 * `Signed` is the overwhelming majority of rows, so labeling it says nothing
 * and costs a column's worth of noise on every line. Only the two states a
 * reader has to account for get a tag: an order nobody has signed yet, and one
 * that was withdrawn. Silence therefore means "signed", which is the useful
 * default rather than an omission.
 *
 * EVERY LABEL NAMES ITS SUBJECT ("PO ..."), and that is not decoration. Both
 * screens render this tag beside the VENDOR rather than beside the PO ID it
 * describes — the Order column had no room for both (see CLAUDE.md) — so a bare
 * "Withdrawn" sitting after a vendor name reads as a fact about the VENDOR, i.e.
 * a supplier we no longer buy from. Naming the subject is what the move costs,
 * and it costs ~18px of tag width.
 *
 * `Awaiting Signature` becomes `PO unsigned` rather than being used verbatim:
 * the label has to stay short enough that a long vendor name plus a tag still
 * fits one line.
 *
 * An unrecognized status is shown as `PO: <status>` rather than swallowed — a new
 * option added to the Airtable field should appear on the screen instead of
 * vanishing, which is the failure #144 recorded for a denylist that admitted
 * whatever it did not name. The colon form is used because an arbitrary option
 * name cannot be relied on to read grammatically after a bare "PO".
 */
// ---------------------------------------------------------------------------
// What the search box and its two empty results say (#357)
//
// In a constant rather than in the page's and the form's JSX, because the
// offline tier's vocabulary and brief checks walk copy constants and cannot see
// text inside a component — the gap `docs/briefs/strings/README.md` measures and
// the reason #355 put `CATEGORY_PICKER_COPY` beside the rule it belongs to.
// This module is already imported by a Client Component's page and reaches
// nothing under `lib/airtable/`, so the form can import it too.
// ---------------------------------------------------------------------------

export const MATERIAL_SEARCH_COPY = {
    /**
     * The box's own label, for a screen reader.
     *
     * It said `item name` until #357, which stopped being true when `Item Name`
     * became a lookup of the category's composed path: nobody types the words
     * this box matches, so naming a name told a reader to search for one.
     */
    boxLabel: "Search by category, size or unit",

    /**
     * The example in the empty box, and the pair in the note below it.
     *
     * BOTH CAME OUT OF THE CATALOG RATHER THAN OFF THE OLD SCREEN. The examples
     * were `pipe 2"` and `2" pipe`, which matched 0 of the 34 rows on the base
     * the moment the label became a path — an example that finds nothing teaches
     * the reader that the box is broken. `offline/material-price-view.mjs`
     * asserts these against real composed paths so the next change to the tree
     * cannot leave them behind quietly.
     */
    placeholder: `e.g. ball valve 2"`,
    orderNote: {
        lead: "Every word must appear. Order does not matter —",
        examples: [`ball valve 2"`, `2" ball valve`],
        tail: "find the same item.",
    },

    /**
     * More matches than the page shows.
     *
     * LOAD-BEARING SINCE #357, which is why it is here rather than in JSX. A
     * substring token against a path matches broadly — `tee` reaches every row
     * under `Stainless Steel (SUS)` — and the argument for keeping substring
     * matching is that another word always narrows. This sentence is where the
     * reader is told so.
     */
    truncated: (shown) => `Showing the first ${shown} matches. Add another word to narrow the search.`,

    /**
     * Nothing matched, and WHY — two answers, because the catalog made them
     * different questions (#357).
     *
     * Before #356 the label held the words a requester typed, so a miss had one
     * meaning and no way to say it: the screen could not tell "we do not call it
     * that" from "we have never bought one". The catalog can be asked, so it is
     * — one query, `maxRecords: 1`, only on a miss.
     *
     * The two must not read alike, and neither may read like the empty-index
     * box, which is about a base with nothing on it at all.
     */
    noMatch: (query) => `No item matches “${query}”.`,
    inCatalog:
        "The catalog has a category for those words; no purchase order has put an item under it yet.",
    /**
     * A SIZE ALWAYS LANDS HERE, and the second sentence is what stops that being
     * misleading. The question asked is whether any category's path carries every
     * token, and the tree names no dimension at all — 0 of the 777 paths contain
     * `2"` or `3/4"` — so `pipe 2"` reaches this sentence even though the tree has
     * 70 paths carrying `Pipe`. Narrowing the probe to the tokens that ARE
     * category words was measured and rejected: it cannot tell a size from a word
     * the tree simply does not use, so it would send `cable tray` to the sentence
     * above, which is the one case the two states exist to keep apart.
     *
     * SO THE SECOND HALF IS A FACT RATHER THAN AN INSTRUCTION. `cable tray`
     * reaches this sentence carrying no size at all, and "try it without a size"
     * would be advice about a word that is not there; "a size is never part of a
     * category" is true either way, and it is the thing a reader typing
     * `pipe 2"` does not know.
     */
    notInCatalog:
        "No category in the catalog carries all of those words. Try fewer words — a size is never part of a category.",
};

export function statusTag(poStatus) {
    // Issue #281 — `isPOSigned` rather than `=== "Signed"`. A sent order is signed and
    // then some, so it must be as silent here as a signed one; the fallthrough below
    // would otherwise have tagged it `PO: Sent to Vendor`, which is the "unrecognized
    // status appears rather than vanishing" branch doing its job on a status this
    // function does recognize.
    if (!poStatus || isPOSigned(poStatus)) return null;
    if (poStatus === "Awaiting Signature") return "PO unsigned";
    if (poStatus === "Withdrawn") return "PO withdrawn";
    return `PO: ${poStatus}`;
}

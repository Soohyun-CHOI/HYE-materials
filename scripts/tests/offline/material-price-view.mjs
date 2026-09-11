// The material price screens' view rules (#19).
//
// Pinned here because three of them are decisions that a later "tidy-up" would
// plausibly reverse, each for a reason that sounds good and is wrong:
//   - sorting NEWEST first rather than cheapest first,
//   - showing no "Lowest" mark when there is a single vendor,
//   - marking every tied row rather than picking one.
// Each has a case below so reversing it has to break a named test.
//
// lib/materialPriceView.js imports only lib/itemNaming.js, both pure, which is
// what lets this be offline.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildSearchTokens,
    lowestPriceRowIds,
    qtyDiffersAcross,
    sortHistoryRows,
    sortVendorRows,
    statusTag,
    MATERIAL_SEARCH_COPY,
    MAX_SEARCH_TOKENS,
} from "../../../lib/materialPriceView.js";
import {
    CATEGORY_LABEL_SEPARATOR,
    CATEGORY_LEVELS,
    composeCategoryLabel,
} from "../../../lib/materialCategory.js";
import { parseCsv } from "./material-categories.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Material price view rules (#19)";

const ids = (set) => [...set].sort().join(",");

// Resolved the way `material-categories.mjs` resolves it, and for its reason:
// `_ast.mjs:repoPath` would pull acorn in for a check that parses no JavaScript.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CSV_PATH = "scripts/import/material_categories.csv";

/**
 * The composed path of every committed category, as `Material Label` carries it
 * (#357).
 *
 * READ FROM THE CSV RATHER THAN WRITTEN OUT, because the assertion below is
 * about whether the screen's examples find anything in the REAL tree. A fixture
 * path invented here would agree with an example invented beside it, which is
 * the vacuity `docs/notes/verification.md` names — the check has to be able to
 * fail when HQ's tree changes under an example nobody re-read.
 *
 * One parser, three readers: `parseCsv` is `material-categories.mjs`'s, exported
 * there for `seed-categories.mjs` after a naive `split(",")` read the leaf-code
 * column off by however many commas the name columns carried.
 */
function catalogPaths() {
    const rows = parseCsv(readFileSync(join(REPO_ROOT, CSV_PATH), "utf8"));
    const header = rows[0];
    catalogPaths.cache = rows
        .slice(1)
        .filter((row) => row.length === header.length && row.some(Boolean))
        .map((row) => composeCategoryLabel(Object.fromEntries(header.map((h, i) => [h, row[i]]))));
    return catalogPaths.cache;
}

/**
 * `andSearchAll`'s rule in JavaScript: every token a case-insensitive substring.
 *
 * The formula is built in `lib/airtable/materials.js` and cannot be called here,
 * so this is the second implementation of one predicate — deliberately, and
 * narrowly. What it is for is asking whether a screen's EXAMPLE reaches a real
 * path, which needs the rule applied to data rather than the query string
 * compared to a fixture; `offline/formula-escaping.mjs` is what pins the formula
 * the app actually sends.
 */
function matchingPaths(paths, tokens) {
    if (tokens.length === 0) return [];
    return paths.filter((path) => tokens.every((token) => path.toLowerCase().includes(token)));
}

/**
 * An example query split into the tokens the CATALOG carries and the ones it
 * does not — which is the size, since the tree names no dimension.
 *
 * WHAT THIS CHECK CANNOT ASK, AND THE FIRST ATTEMPT ASKED IT WRONGLY. Whether an
 * example finds a ROW is a fact about the base — `pipe 2"` was the box's example
 * and matched nothing the moment the label became a path, not because `Pipe` is
 * missing from the tree (70 paths carry it) but because nothing at that size had
 * been bought. No offline check can see that, and the first version of this one
 * pretended to by appending a synthetic `_2"_EA` to every path, which handed the
 * size token a match for free and passed on the very example it was written to
 * catch. That belongs to the browser, and #357's pull request carries it.
 *
 * What IS offline is whether the example's words are words the catalog uses —
 * the failure that would make an example unreachable for everyone forever rather
 * than until somebody buys one. `cable tray`, `EMT conduit` and `junction box`
 * are all real materials this company ordered and none of the three is a word in
 * HQ's tree.
 */
function splitExample(query) {
    const tokens = buildSearchTokens(query);
    const inCatalog = tokens.filter((token) => matchingPaths(catalogPaths.cache, [token]).length > 0);
    return { tokens, inCatalog, notInCatalog: tokens.filter((t) => !inCatalog.includes(t)) };
}

export function run({ check, log, assert }) {
    log("buildSearchTokens — the typed query becomes match tokens:");
    check("a single word", buildSearchTokens("pipe").join("|"), "pipe");
    check("case is folded for matching", buildSearchTokens("PIPE").join("|"), "pipe");
    // The same normalization that decided how the name was STORED (#18), so a
    // user's spacing cannot miss a stored value and vice versa.
    check("internal whitespace collapses", buildSearchTokens("SCH   40").join("|"), "sch|40");
    check("ends are trimmed", buildSearchTokens("  pipe  ").join("|"), "pipe");
    check("a quote survives — sizes are written 2\"", buildSearchTokens('2" pipe').join("|"), '2"|pipe');
    check("duplicates are dropped (AND-ing a token twice narrows nothing)", buildSearchTokens("pipe pipe").join("|"), "pipe");
    check("empty query yields no tokens", buildSearchTokens("").length, 0);
    check("whitespace-only yields no tokens", buildSearchTokens("   ").length, 0);
    check("nullish yields no tokens", buildSearchTokens(undefined).length, 0);
    check(
        `capped at ${MAX_SEARCH_TOKENS} tokens`,
        buildSearchTokens(Array.from({ length: MAX_SEARCH_TOKENS + 3 }, (_, i) => `w${i}`).join(" ")).length,
        MAX_SEARCH_TOKENS
    );
    // THE CAP IS DERIVED FROM THE TREE, RE-DERIVED HERE (#357). At 6 it kept a
    // pasted path's outermost levels — shared by every row in the branch — and
    // dropped the leaf, which is the only part that identifies. A path reaches a
    // reader on the purchase order, so pasting one back is an ordinary query, and
    // the cap has to hold the longest one HQ's tree can compose plus the size and
    // unit the label appends. Derived rather than restated, so a deeper path from
    // a future import fails here instead of truncating a query in silence.
    const longestPathWords = Math.max(
        ...catalogPaths().map((path) => buildSearchTokens(path).length)
    );
    check(`the longest committed path is ${longestPathWords} words`, longestPathWords > 0, true);
    assert(
        `the cap holds that path plus a size and a unit (${longestPathWords} + 4 <= ${MAX_SEARCH_TOKENS})`,
        MAX_SEARCH_TOKENS >= longestPathWords + 4
    );

    log("");
    log("buildSearchTokens — the path separator is not a word (#357):");
    // `Material Label` carries a category path since #356 and the screen renders
    // it as the item's heading, so pasting a heading back into the box is an
    // ordinary thing to do. The arrow is on 765 of the 777 committed paths, so it
    // narrows nothing while spending one of six token slots.
    const arrow = CATEGORY_LABEL_SEPARATOR.trim();
    check(
        "an arrow between two words is dropped",
        buildSearchTokens(`Flange ${CATEGORY_LABEL_SEPARATOR} SUS 316L`).join("|"),
        "flange|sus|316l"
    );
    check("an arrow alone is no query at all", buildSearchTokens(arrow).length, 0);
    check(
        "a whole pasted path keeps every word and no arrow",
        buildSearchTokens("Stainless Steel (SUS) > Tee > SUS 304 > PTFE Lined")
            .includes(arrow),
        false
    );
    // Derived from the separator rather than compared to `">"`, so a change to
    // `CATEGORY_LABEL_SEPARATOR` moves this case with it instead of leaving a
    // check that passes about a character the label no longer uses.
    check(
        "the dropped token is the separator's own, not a literal",
        buildSearchTokens(`pipe ${arrow} 2"`).join("|"),
        'pipe|2"'
    );

    log("");
    log("MATERIAL_SEARCH_COPY — the examples are made of the catalog's words (#357):");
    const paths = catalogPaths();
    check(`${CSV_PATH} composes ${paths.length} paths`, paths.length > 0, true);
    const examples = [
        MATERIAL_SEARCH_COPY.placeholder.replace(/^e\.g\. /, ""),
        ...MATERIAL_SEARCH_COPY.orderNote.examples,
    ];
    for (const example of examples) {
        const { inCatalog, notInCatalog } = splitExample(example);
        // Every word but the size has to be one the tree uses, AND they have to
        // land on ONE path together: `flange gasket` is two catalog words on no
        // single row, which is the state the screen's own no-category sentence is
        // about — an example in that state would be unreachable forever.
        check(
            `“${example}” — its category words reach one committed path`,
            matchingPaths(paths, inCatalog).length > 0 && inCatalog.length > 0,
            true
        );
        // And it must span the size segment too, since `Material Label` is the
        // path AND the size AND the unit — an example made only of tree words
        // would demonstrate half of what the box matches.
        check(
            `“${example}” — carries a size, which the tree never names`,
            notInCatalog.length,
            1
        );
    }
    // The pair exists to show that order does not matter, so they must be each
    // other's words. Two examples agreeing by accident would demonstrate nothing.
    const [first, second] = MATERIAL_SEARCH_COPY.orderNote.examples;
    check(
        "the two examples are the same words in a different order",
        buildSearchTokens(first).slice().sort().join("|") ===
            buildSearchTokens(second).slice().sort().join("|"),
        true
    );
    check("the examples are not in the same order", first === second, false);

    log("");
    log("MATERIAL_SEARCH_COPY — a miss says which of two things is true (#357):");
    // The two sentences are the whole point of the extra query, so they must not
    // read alike; a reader who cannot tell them apart is back to the one sentence
    // that said nothing.
    check(
        "the in-catalog and no-category sentences differ",
        MATERIAL_SEARCH_COPY.inCatalog === MATERIAL_SEARCH_COPY.notInCatalog,
        false
    );
    // The in-catalog branch is the one that has to carry WHY there is no price:
    // the list is built by purchase orders, which is the fact the empty-index box
    // carries for a base with nothing on it at all.
    assert(
        "the in-catalog sentence names what builds the list",
        MATERIAL_SEARCH_COPY.inCatalog.includes("purchase order")
    );
    assert(
        "the no-category sentence is about the catalog rather than about buying",
        MATERIAL_SEARCH_COPY.notInCatalog.includes("catalog") &&
            !MATERIAL_SEARCH_COPY.notInCatalog.includes("purchase order")
    );
    // A SIZE ALWAYS REACHES THAT SENTENCE, so it has to say what to do about it.
    // The tree names no dimension — measured here rather than asserted, because
    // the whole caveat rests on it.
    const sizeTokensInTree = ['2"', '3/4"', "300mm"].filter(
        (size) => matchingPaths(paths, [size]).length > 0
    );
    check("no committed path carries a size", sizeTokensInTree.length, 0);
    assert(
        "so the no-category sentence tells the reader to drop the size",
        MATERIAL_SEARCH_COPY.notInCatalog.includes("size")
    );
    check("the query is quoted back to the reader", MATERIAL_SEARCH_COPY.noMatch("pipe"), "No item matches “pipe”.");
    // The truncation line is load-bearing since #357: the argument for keeping a
    // substring rule against a path is that another word always narrows, and this
    // is where the reader is told so.
    assert(
        "the truncation line says another word narrows",
        MATERIAL_SEARCH_COPY.truncated(25).includes("another word")
    );
    check("and it carries the figure it was given", MATERIAL_SEARCH_COPY.truncated(25).includes("25"), true);
    // The four level names are what a path is made of, so a change to the tree's
    // depth would change what a token can reach. Stated here because the examples
    // above rest on it.
    check("a path is composed of four levels", CATEGORY_LEVELS.length, 4);

    log("");
    log("sortVendorRows — NEWEST first, deliberately not cheapest first:");
    const vendorRows = [
        { id: "old-cheap", vendorName: "A", unitPrice: 5, latestDate: "2023-01-01", qty: 10 },
        { id: "new-dear", vendorName: "B", unitPrice: 50, latestDate: "2026-07-01", qty: 10 },
        { id: "mid", vendorName: "C", unitPrice: 20, latestDate: "2025-01-01", qty: 10 },
    ];
    check(
        "the newest row is first even though it is the most expensive",
        sortVendorRows(vendorRows).map((r) => r.id).join(","),
        "new-dear,mid,old-cheap"
    );
    check(
        "same date falls back to vendor name",
        sortVendorRows([
            { id: "z", vendorName: "Zeta", latestDate: "2026-01-01" },
            { id: "a", vendorName: "Alpha", latestDate: "2026-01-01" },
        ])
            .map((r) => r.id)
            .join(","),
        "a,z"
    );
    check(
        "a row with no date sorts last — it cannot claim recency",
        sortVendorRows([
            { id: "undated", vendorName: "A" },
            { id: "dated", vendorName: "B", latestDate: "2020-01-01" },
        ])
            .map((r) => r.id)
            .join(","),
        "dated,undated"
    );
    check("sorting does not mutate the input", vendorRows[0].id, "old-cheap");

    log("");
    log("lowestPriceRowIds — a fact, not a recommendation:");
    check(
        "the cheapest row is marked wherever it sorted",
        ids(lowestPriceRowIds(vendorRows)),
        "old-cheap"
    );
    // "Lowest of one" tells the reader nothing and dresses a single data point
    // as a comparison.
    check("a single vendor row is NOT marked", lowestPriceRowIds([{ id: "only", unitPrice: 7 }]).size, 0);
    check("an empty set of rows is not marked", lowestPriceRowIds([]).size, 0);
    // A tie is still the fact "this is the lowest price", for both rows.
    check(
        "a tie marks every tied row rather than picking one",
        ids(lowestPriceRowIds([
            { id: "a", unitPrice: 10 },
            { id: "b", unitPrice: 10 },
            { id: "c", unitPrice: 12 },
        ])),
        "a,b"
    );
    check(
        "rows without a numeric price are ignored, not treated as 0",
        ids(lowestPriceRowIds([
            { id: "priced", unitPrice: 9 },
            { id: "blank", unitPrice: undefined },
        ])),
        "priced"
    );
    check(
        "no comparable price means no mark",
        lowestPriceRowIds([{ id: "a" }, { id: "b" }]).size,
        0
    );
    check("zero is a real price, not a missing one", ids(lowestPriceRowIds([
        { id: "free", unitPrice: 0 },
        { id: "paid", unitPrice: 3 },
    ])), "free");

    log("");
    log("qtyDiffersAcross — the limit on comparing unit prices:");
    check("same quantity, no caveat", qtyDiffersAcross([{ qty: 10 }, { qty: 10 }]), false);
    check("different quantities, caveat", qtyDiffersAcross([{ qty: 10 }, { qty: 500 }]), true);
    check("one row cannot differ from itself", qtyDiffersAcross([{ qty: 10 }]), false);
    // An unknown quantity is not evidence of a difference.
    check("a missing quantity is ignored", qtyDiffersAcross([{ qty: 10 }, {}]), false);
    check("two missing quantities", qtyDiffersAcross([{}, {}]), false);

    log("");
    log("sortHistoryRows — newest first, PO ID breaks a same-day tie:");
    check(
        "dates order descending",
        sortHistoryRows([
            { id: "a", date: "2025-01-01", poId: "HYE-PO-20250101-01" },
            { id: "b", date: "2026-01-01", poId: "HYE-PO-20260101-01" },
        ])
            .map((r) => r.id)
            .join(","),
        "b,a"
    );
    // Created Date is calendar-only, so this tie is the common case, not an edge
    // one: every PO raised on the same day lands here.
    check(
        "same day falls back to the PO ID's own sequence, descending",
        sortHistoryRows([
            { id: "first", date: "2026-07-29", poId: "HYE-PO-20260729-01" },
            { id: "third", date: "2026-07-29", poId: "HYE-PO-20260729-03" },
            { id: "second", date: "2026-07-29", poId: "HYE-PO-20260729-02" },
        ])
            .map((r) => r.id)
            .join(","),
        "third,second,first"
    );
    check(
        "an undated row sorts last",
        sortHistoryRows([{ id: "undated" }, { id: "dated", date: "2020-01-01" }])
            .map((r) => r.id)
            .join(","),
        "dated,undated"
    );

    log("");
    log("statusTag — silence means Signed:");
    // Signed is nearly every row, so labeling it is noise on every line.
    check("Signed gets no tag", statusTag("Signed"), null);
    check("a blank status gets no tag", statusTag(""), null);
    check("undefined gets no tag", statusTag(undefined), null);
    // Every label names its subject, because the tag renders beside the VENDOR
    // rather than beside the PO ID it describes. A bare "Withdrawn" after a
    // vendor name reads as a fact about the vendor.
    check("Awaiting Signature names the PO and stays short", statusTag("Awaiting Signature"), "PO unsigned");
    check("Withdrawn names the PO too", statusTag("Withdrawn"), "PO withdrawn");
    assert(
        "no label is ambiguous about what it describes",
        ["Awaiting Signature", "Withdrawn", "Late Delivery"].every((s) => statusTag(s).startsWith("PO"))
    );
    // A status option added to the Airtable field later must SHOW rather than
    // vanish — the failure mode #144 recorded for a denylist. Colon form, because
    // an arbitrary option name will not read grammatically after a bare "PO".
    //
    // THIS CASE USED `Sent to Vendor` AS ITS UNKNOWN STATUS AND #281 MADE IT KNOWN,
    // which is the fixture going stale under the code — loudly here, since the
    // function returns null for it now and `null.startsWith` throws. The example is a
    // status this base does not have, so it cannot be overtaken the same way; what it
    // is testing is the fallthrough, not any particular option.
    check("an unknown status shows itself rather than disappearing", statusTag("Late Delivery"), "PO: Late Delivery");
    // #281 — and the two statuses past the signature are both silent, for the same
    // reason `Signed` always was: the tag exists to say a price came from an order
    // that is NOT settled, and a sent order is the most settled there is.
    check("Sent to Vendor gets no tag either", statusTag("Sent to Vendor"), null);
}

if (isMain(import.meta.url)) standalone(title, run);

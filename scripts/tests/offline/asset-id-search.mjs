// Finding an item by its id from the Tools & Equipment list (#541).
//
// THREE THINGS, SPLIT AS THIS AXIS'S CHECKS SPLIT.
//
//   WHICH SEARCH IS AN ID IS PURE (`lib/assetRoutes.js:searchedAssetId`), so it is held by value:
//   the id whole and its label's code, in any case and with spaces round them, a day's
//   thousandth; and the pieces that are no id — a sequence alone, a day, a day with part of a
//   sequence, the token with part of a day, the token run into the day — which the list searches
//   in the names as it did before.
//
//   WHAT THE LIST DOES WITH ONE IS PURE TOO (`lib/assetListView.js:filterAssetCategoryRows` over
//   the rows `summarizeAssetCategories` builds), held over a fixture of two jobs, three kinds and
//   six assets: the item's row stays with its counts whole, and `found` says the item; a fragment
//   and a day search the names, and a name holding the fragment is found by it; an item off the
//   job the list stands on is found nowhere, and the sentence names that job; on all of a
//   reader's jobs the `Job` chip's jobs are where the item is looked for, and each job's option
//   counts it only on its own job; a type taken that leaves the item's row off empties the list;
//   and the address is read the same way. `emptiedListWords` says each by value.
//
//   WHAT NO VALUE CAN SHOW IS READ OFF THE SOURCE: that the list hands the search's Enter the way
//   to the item and draws the way under the band only while something is found; that the page
//   names the job the list stands on for the sentence; that the way is a link to the item's page
//   which asks for its holder only while it is out, and keeps an answer to the id it was asked
//   for; that the frame holds the column head that much lower while the way stands; that the
//   field's Enter is the caller's and an input method's is not; and that the holder's action is
//   gated before it reads, reads by the id the search named, and reads the log only for an item
//   out. Each beside a planted file doing it wrong.
//
// WHAT IT CANNOT SEE. Whether the way stands where 1a draws it and the list narrows in a browser,
// which this tier never opens; and what a view and a search cost against the base — both are
// #541's pull request's, measured on a dev server.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_STATUS } from "../../../lib/assetStatus.js";
import { searchedAssetId } from "../../../lib/assetRoutes.js";
import { ASSET_LIST_COPY, emptiedListWords, filterAssetCategoryRows, readCategoryList, summarizeAssetCategories } from "../../../lib/assetListView.js";
import { parseFile } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Finding an item by its id from the Tools & Equipment list (#541)";

const LIST = "app/(assets)/asset-categories/AssetCategoryList.js";
const PAGE = "app/(assets)/asset-categories/page.js";
const FOUND = "app/(assets)/asset-categories/FoundItem.js";
const ACTIONS = "app/(assets)/asset-categories/actions.js";
const FRAME = "app/components/ListFrame.js";
const CONTROLS = "app/components/Controls.js";

// Three kinds on two jobs. `Saw 430` holds in its name a sequence the welder's id ends in.
const KINDS = [
    { id: "kWelder", itemName: "TIG Welder", level1: "Equipment", level2: "Welding" },
    { id: "kDrill", itemName: "Drill, DeWalt", level1: "Tool", level2: "Power Tool" },
    { id: "kSaw", itemName: "Saw 430", level1: "Tool", level2: "Cutting" },
];
const asset = (assetId, kind, job, status) => ({ id: assetId, assetId, category: [kind], job: [job], status });
const ASSETS = [
    asset("HYE-AST-261019-430", "kWelder", "recJ1", ASSET_STATUS.OUT),
    asset("HYE-AST-261019-431", "kWelder", "recJ1", ASSET_STATUS.IN_STOCK),
    asset("HYE-AST-261019-432", "kWelder", "recJ2", ASSET_STATUS.RETIRED),
    asset("HYE-AST-261018-007", "kDrill", "recJ1", ASSET_STATUS.IN_STOCK),
    asset("HYE-AST-261018-1000", "kDrill", "recJ2", ASSET_STATUS.IN_REPAIR),
    asset("HYE-AST-260909-001", "kSaw", "recJ1", ASSET_STATUS.IN_STOCK),
];
const CHOICE = [
    { id: "recJ1", jobCode: "23-USA-09" },
    { id: "recJ2", jobCode: "25-USA-13" },
];
// One job's rows count its assets alone, as the page builds them; all jobs' count every one.
const onJob = (job) => summarizeAssetCategories(KINDS, ASSETS.filter((each) => each.job[0] === job));
const ALL = summarizeAssetCategories(KINDS, ASSETS);

const ids = (reading) => reading.rows.map((row) => row.id).join(",") || "-";
const foundSaid = (reading) => (reading.found ? `${reading.found.assetId} ${reading.found.itemName} ${reading.found.status}` : "-");
const counted = (reading) => reading.rows.map((row) => `${row.id}:${row.counts.map((c) => c.count).join("/")}`).join(" ");
const emptiedSays = (reading, jobCode = null) => {
    const words = emptiedListWords(reading, { jobCode });
    return `${words.sentence} | ${words.typed} | ${words.clear}`;
};
const JOB_ONE = onJob("recJ1");

/** The whole text of the first function or arrow assigned to `name` in a source, or "". */
function bodyOf(source, name) {
    const start = source.search(new RegExp(`(export (async )?function ${name}\\(|const ${name} = )`));
    if (start < 0) return "";
    const end = source.slice(start).search(/\r?\n(\}|    \};)\r?\n/);
    return end < 0 ? source.slice(start) : source.slice(start, start + end + 4);
}

/** What the holder's action does, in order, off its source. */
function holderReadOf(source) {
    const body = bodyOf(source, "readFoundHolderAction");
    const at = (pattern) => body.search(pattern);
    const gate = at(/await requireUser\(\);/);
    const asked = at(/const asked = searchedAssetId\(assetId\);/);
    const read = at(/await getAssetByAssetId\(asked\)/);
    const outOnly = at(/if \(asset\?\.status !== ASSET_STATUS\.OUT\) return \{ holder: null \};/);
    const log = at(/getAssetLogEntriesByRecordIds\(holderRowIds\(\[asset\]\)\)/);
    const holder = at(/return \{ holder: lastChangeOf\(asset, entries\)\.holder \};/);
    const label = /return withOpsLabel\("readFoundHolderAction", async \(\) => \{/.test(body);
    const ordered = [gate, asked, read, outOnly, log, holder].every((each, index, all) => each >= 0 && (index === 0 || each > all[index - 1]));
    return `${label} ${ordered}`;
}

/** What the way to the item asks for and links to, off its source. */
function foundWayOf(source) {
    return [
        /<Link\s+href=\{assetPath\(assetId\)\}/.test(source),
        /if \(status !== ASSET_STATUS\.OUT \|\| asked\.current\.has\(assetId\)\) return;\s*asked\.current\.add\(assetId\);\s*readFoundHolderAction\(assetId\)\.then\(/.test(source),
        /\(answer\) => setHolders\(\(was\) => \(\{ \.\.\.was, \[assetId\]: answer\?\.holder \?\? null \}\)\)/.test(source),
        /const holder = status === ASSET_STATUS\.OUT \? \(holders\[assetId\] \?\? null\) : null;/.test(source),
        /\}, \[assetId, status\]\);/.test(source),
    ].join(" ");
}

export function run({ check, log }) {
    // ── which search is an id ───────────────────────────────────────────────
    log("which search names an item's id:");
    check(
        "the id whole, in any case and with spaces round it, is that id",
        ["HYE-AST-261019-430", "  hye-ast-261019-430 ", "Hye-Ast-261019-430"].map(searchedAssetId).join(" "),
        "HYE-AST-261019-430 HYE-AST-261019-430 HYE-AST-261019-430"
    );
    check("  and so is its label's code, the id less its token", ["261019-430", " 261019-430  "].map(searchedAssetId).join(" "), "HYE-AST-261019-430 HYE-AST-261019-430");
    check("  a day's thousandth is one, its sequence past the pad", ["261018-1000", "HYE-AST-261018-1000"].map(searchedAssetId).join(" "), "HYE-AST-261018-1000 HYE-AST-261018-1000");
    check(
        "a sequence alone, a day, a day with part of a sequence and a short or long day are none",
        ["430", "261019", "261019-4", "261019-43", "26101-430", "2610199-430"].map((each) => String(searchedAssetId(each))).join(" "),
        "null null null null null null"
    );
    check(
        "  nor the token with part of a day, the token run into the day, the token twice, or more after an id",
        ["HYE-AST-2610", "HYE-AST261019-430", "HYE-AST-HYE-AST-261019-430", "261019-430 x"].map((each) => String(searchedAssetId(each))).join(" "),
        "null null null null"
    );
    check("  nor nothing", [undefined, null, "", "   "].map((each) => String(searchedAssetId(each))).join(" "), "null null null null");

    // ── what the list does with one ─────────────────────────────────────────
    log("");
    log("the list finds the item in the rows it holds, and its row stays:");
    check(
        "each row carries the ids of the assets it counts, by job and then status",
        ALL.map((row) => `${row.id} ${JSON.stringify(row.assetIds)}`).join(" | "),
        'kDrill {"recJ1":{"In stock":["HYE-AST-261018-007"]},"recJ2":{"In repair":["HYE-AST-261018-1000"]}} | ' +
            'kSaw {"recJ1":{"In stock":["HYE-AST-260909-001"]}} | ' +
            'kWelder {"recJ1":{"Out":["HYE-AST-261019-430"],"In stock":["HYE-AST-261019-431"]},"recJ2":{"Retired":["HYE-AST-261019-432"]}}'
    );
    check("  and one job's rows the ids on that job alone", JSON.stringify(JOB_ONE.find((row) => row.id === "kWelder").assetIds), '{"recJ1":{"Out":["HYE-AST-261019-430"],"In stock":["HYE-AST-261019-431"]}}');
    const byId = filterAssetCategoryRows(JOB_ONE, { q: "HYE-AST-261019-430" });
    check("an id whole leaves its item's row, its counts whole, and finds the item", `${ids(byId)} ${counted(byId)} | ${foundSaid(byId)}`, "kWelder kWelder:1/1/0/0 | HYE-AST-261019-430 TIG Welder Out");
    check("  it narrows, it searches, it is an id", `${byId.narrowed} ${byId.searching} ${byId.byId}`, "true true true");
    const byCode = filterAssetCategoryRows(JOB_ONE, { q: " 261019-430 " });
    check("  and so does its label's code, the search held as typed", `${ids(byCode)} ${foundSaid(byCode)} ${JSON.stringify(byCode.held.q)}`, 'kWelder HYE-AST-261019-430 TIG Welder Out " 261019-430 "');
    check(
        "  each chip's option counts the rows the id leaves",
        `${byId.facets.level1.map((o) => `${o.value} ${o.count}`).join(" | ")} / ${byId.facets.level2.map((o) => `${o.value} ${o.count}`).join(" | ")}`,
        "Equipment 1 | Tool 0 / Cutting 0 | Power Tool 0 | Welding 1"
    );
    check("  and the address is read the same way", foundSaid(readCategoryList(JOB_ONE, new URLSearchParams("q=261019-430"))), "HYE-AST-261019-430 TIG Welder Out");

    const fragment = filterAssetCategoryRows(JOB_ONE, { q: "430" });
    check("a sequence alone searches the names, and a name holding it is found by it", `${ids(fragment)} ${foundSaid(fragment)} ${fragment.byId}`, "kSaw - false");
    const day = filterAssetCategoryRows(JOB_ONE, { q: "261019" });
    check("  a day searches the names too, and the kinds with an item that day are not found by it", `${ids(day)} ${foundSaid(day)} ${emptiedSays(day)}`, "- - No items match | 261019 | Clear search");
    const named = filterAssetCategoryRows(JOB_ONE, { q: "welder" });
    check("  and a name is searched as before, finding no item", `${ids(named)} ${foundSaid(named)} ${named.byId}`, "kWelder - false");

    log("");
    log("the list finds an item inside what it shows and nowhere else:");
    const elsewhere = filterAssetCategoryRows(JOB_ONE, { q: "HYE-AST-261019-432" });
    check("an item on another of the reader's jobs is found on no row of this one", `${ids(elsewhere)} ${foundSaid(elsewhere)} ${elsewhere.byId}`, "- - true");
    check("  and the sentence names the job the list looked on", emptiedSays(elsewhere, "23-USA-09"), "No item on 23-USA-09 has the ID | HYE-AST-261019-432 | Clear search");
    const nowhere = filterAssetCategoryRows(ALL, { q: "261019-999" }, { jobs: CHOICE });
    check("  on all of a reader's jobs an id nobody's item carries says the drawing's sentence", emptiedSays(nowhere), "No item has the ID | 261019-999 | Clear search");
    const onAll = filterAssetCategoryRows(ALL, { q: "261019-432" }, { jobs: CHOICE });
    check("on all of them the item is found on whichever job holds it", `${ids(onAll)} ${counted(onAll)} | ${foundSaid(onAll)}`, "kWelder kWelder:1/1/0/1 | HYE-AST-261019-432 TIG Welder Retired");
    check(
        "  and each job's option counts its row only where the item is on that job",
        onAll.jobOptions.map((o) => `${o.label} ${o.count}`).join(" | "),
        "23-USA-09 0 | 25-USA-13 1"
    );
    const offChip = filterAssetCategoryRows(ALL, { q: "261019-432", jobs: ["recJ1"] }, { jobs: CHOICE });
    check("  the Job chip's jobs are where it is looked for: one taken off the item finds nothing", `${ids(offChip)} ${foundSaid(offChip)} ${emptiedSays(offChip)}`, "- - No item has the ID | 261019-432 | Clear all");
    const onChip = filterAssetCategoryRows(ALL, { q: "261019-432", jobs: ["recJ1", "recJ2"] }, { jobs: CHOICE });
    check("  and the item's own job taken finds it, the row counting the jobs taken", `${ids(onChip)} ${counted(onChip)} ${foundSaid(onChip)}`, "kWelder kWelder:1/1/0/1 HYE-AST-261019-432 TIG Welder Retired");
    const offType = filterAssetCategoryRows(JOB_ONE, { q: "261019-430", level1: ["Tool"] });
    check("a type taken that leaves the item's row off empties the list, as drawn", `${ids(offType)} ${foundSaid(offType)} ${emptiedSays(offType, "23-USA-09")}`, "- - No item on 23-USA-09 has the ID | 261019-430 | Clear all");
    const repairIn = filterAssetCategoryRows(ALL, { q: "hye-ast-261018-1000" }, { jobs: CHOICE });
    check("  and a day's thousandth is found as any id is", foundSaid(repairIn), "HYE-AST-261018-1000 Drill, DeWalt In repair");

    check(
        "the words: the search's, the drawing's sentence and the one naming a job",
        [ASSET_LIST_COPY.searchLabel, ASSET_LIST_COPY.noIdMatch, ASSET_LIST_COPY.noIdMatchOn("23-USA-09")].join(" | "),
        "Search items or item IDs | No item has the ID | No item on 23-USA-09 has the ID"
    );

    // ── the source ──────────────────────────────────────────────────────────
    log("");
    log("the wiring, off the source:");
    const list = parseFile(LIST).source;
    check(
        "the list hands the search's Enter the way to what it found, and draws the way only while something is found",
        [
            /const open = \(\) => \{\s*if \(reading\.found\) router\.push\(assetPath\(reading\.found\.assetId\)\);\s*\};/.test(list),
            /onEnter=\{open\}/.test(list),
            /found=\{reading\.found && <FoundItem found=\{reading\.found\} \/>\}/.test(list),
            /const emptied = reading\.rows\.length === 0 \? emptiedListWords\(reading, \{ jobCode \}\) : null;/.test(list),
        ].join(" "),
        "true true true true"
    );
    check("  and the page names the job it stands on, none on all of them", /jobCode=\{scope\.job\?\.jobCode \?\? null\}/.test(parseFile(PAGE).source), true);

    const found = parseFile(FOUND).source;
    check(
        "the way links to the item's page, asks once per id for the holder of an item out alone, and keeps each answer under its id",
        foundWayOf(found),
        "true true true true true"
    );
    check(
        "  where a planted way asking for every item's holder each time, and drawing any answer, is seen",
        foundWayOf(
            "<Link href={assetPath(assetId)}>\n    readFoundHolderAction(assetId).then(\n        (answer) => setHolders((was) => ({ ...was, [assetId]: answer?.holder ?? null })),\n    const holder = holders.last;\n    }, [assetId]);\n"
        ),
        "true false true false false"
    );
    check(
        "  and draws on the design's names for its 40, its 12 inside and its 16 to the chevron, on the Face inside its Edge",
        /className="group flex h-found-item items-center gap-found-item-inline rounded-control border border-selected-border bg-selected px-found-item-inset-x /.test(found) &&
            /<Icon name="chevron-right" className="size-icon shrink-0 text-primary group-hover:text-primary-hover" \/>/.test(found),
        true
    );

    const frame = parseFile(FRAME).source;
    check(
        "the frame holds the column head the way's 40 and the band's 14 lower while it stands",
        [
            /const BAND_FOUND = `\$\{LIST_MEASURE\} pb-control-band-inset-y`;/.test(frame),
            /const UNDER_HEAD_BAND_AND_FOUND =\s*"\[--table-head-top:calc\(var\(--spacing-list-header-inset-top\)\+var\(--height-control-lg\)\+var\(--spacing-list-header-inset-bottom\)\+var\(--height-control\)\+var\(--spacing-control-band-inset-y\)\+var\(--height-found-item\)\+var\(--spacing-control-band-inset-y\)\)\] scroll-pt-\[calc\(var\(--table-head-top\)\+var\(--height-table-header\)\)\]";/.test(
                frame
            ),
        ].join(" "),
        "true true"
    );

    const field = bodyOf(parseFile(CONTROLS).source, "SearchField");
    check(
        "the search field's Enter is the caller's, and an input method's composing Enter is not",
        /onKeyDown=\{\(event\) => \{\s*if \(!onEnter \|\| event\.key !== "Enter" \|\| event\.nativeEvent\.isComposing\) return;\s*event\.preventDefault\(\);\s*onEnter\(\);\s*\}\}/.test(field),
        true
    );

    check("the holder's action is labeled, gates before it reads, reads by the id the search named, and reads the log for an item out alone", holderReadOf(parseFile(ACTIONS).source), "true true");
    check(
        "  where a planted action reading the log before it asks the status is seen",
        holderReadOf(
            'export async function readFoundHolderAction(assetId) {\n    return withOpsLabel("readFoundHolderAction", async () => {\n        await requireUser();\n        const asked = searchedAssetId(assetId);\n        const asset = await getAssetByAssetId(asked);\n        const entries = new Map((await getAssetLogEntriesByRecordIds(holderRowIds([asset]))).map((e) => [e.id, e]));\n        if (asset?.status !== ASSET_STATUS.OUT) return { holder: null };\n        return { holder: lastChangeOf(asset, entries).holder };\n    });\n}\n'
        ),
        "true false"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

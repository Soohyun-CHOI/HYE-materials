// What the two asset list screens show (#339).
//
// THREE THINGS LIVE HERE AND THE THIRD IS WIDER THAN THE OTHER TWO.
//
//   THE COUNT PER STATUS IS DERIVED FROM THE VOCABULARY, NOT WRITTEN OUT. A category's
//   row carries `In stock`, `Out`, `In repair` and `Retired` whatever the assets
//   under it are, so a status nobody has designated reads `0` rather than going
//   missing — the app's own distinction between nothing and no measurement. Writing
//   them out would make a new status appear on no screen and fail nothing; asserting
//   the row's keys ARE `ASSET_STATUS_VALUES` is what closes that, and #531's
//   `In repair` arrived through it.
//
//   THE PAGING IS THE FIRST IN THIS APP, so there is no second implementation to
//   compare it against and the assertions have to be properties rather than
//   examples. The one that matters is reassembly: pages 1..N concatenated are the
//   whole list, in order, with nothing dropped and nothing repeated. An off-by-one
//   in the slice or in the page count fails it at exactly one length, which is why
//   it runs over every length around the boundary rather than one. **Since #442 the
//   size and those lengths are literals** — before it every length was derived from
//   the constant, and only a twelve-row fixture held a figure, by the accident of
//   being two pages at ten — and the source is read for the two things no figure
//   shows: that the screen reads one page, and that its page size is its own number
//   rather than the document lists'.
//
//   THE SELECTION IS WHAT A LABEL RUN IS FOR (#443), and it splits the same way.
//   What a press does to it and what the control says are pure functions, held by
//   value at literal sizes on both sides of the print cap; what no value can show is
//   where it lives — that the server never reads it, that the list is handed only the
//   rows the page read, that the labels' opener and both steps are built from it, and
//   that a press rewrites the address without a render — so those are read off the
//   AST of the page and of the list, each beside a planted screen doing it wrong.
//
//   AND A REGISTRATION LANDS HERE (#449), which splits the same way once more. That
//   what it wrote opens the first page is `pageOfAssets`' newest first, held by
//   value over a category that already fills pages (#463), where `pageHolding` held the
//   page by its edges while the list read oldest first; what the page reads for the
//   account it lands with, what it
//   hands the fork, and what the fork's dismissal does to the address are read off
//   the AST beside planted versions doing each wrong. So is the control that opens
//   the form from the page (#451): what it is handed, what it says, and that no
//   condition stands above it. Since #459 the fork and the notice are dialogs, and
//   the same reading holds when each is open, what closing it answers, the order
//   they stand in, and how the fork opens the registration.
//
//   AND NO ASSET SCREEN PUTS TEXT IN ITS MARKUP. #338 and #340 both state that
//   arrangement in prose — every string an asset screen renders is in a constant,
//   so a vocabulary sweep and scripts/screen-strings.mjs can reach it — and until
//   this file nothing held it. It is asserted over the whole of app/(assets)/ rather
//   than over the two screens this issue adds, because the rule is the axis's and
//   the next screen is the one that will forget it. `/tools` was in fact carrying
//   one, `<h1>Tools</h1>`, from #336 until this issue moved it into the constant.
//
// WHAT IT CANNOT SEE. Whether any of it reaches a browser, which is this tier's
// standing limit — a page renders no rows in a check. In particular it cannot see
// that the counts are right about the base: `summarizeAssetCategories` is exercised on
// literal assets here. **This went on to say `Out` depended on a screen that
// writes a `Checked out` row, which the app did not have; #362 wrote one, and a
// browser has shown the figure since.**
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_EVENT, ASSET_STATUS, ASSET_STATUS_VALUES } from "../../../lib/assetStatus.js";
import { ASSET_COPY } from "../../../lib/assetView.js";
import { ASSET_NOTE_COPY } from "../../../lib/assetNote.js";
import {
    ASSET_LIST_COPY,
    ASSET_LIST_FACETS,
    ASSET_PAGE_SIZE,
    describeSelection,
    emptiedListWords,
    filterAssetCategoryRows,
    idsInScope,
    lastChangeOf,
    latestLogRowIds,
    readAssetListFilters,
    pageOfAssets,
    pageOfAssetCategories,
    pageSelection,
    summarizeAssetCategories,
    togglePage,
    toggleAsset,
    assetListScope,
    assetCategoriesInScope,
    pagerPosition,
} from "../../../lib/assetListView.js";
import { MAX_LABELS_PER_REQUEST } from "../../../lib/assetLabelPage.js";
import { ALL_JOBS, readAssetIds } from "../../../lib/assetRoutes.js";
import { FILTERED_LISTS, axesFor } from "../../../lib/listFilters.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What the two tools list screens show (#339)";

/** Three categories, one of them with nothing under it, named out of alphabetical order. */
const CATEGORIES = [
    { id: "recGrinder", itemName: "angle grinder", assets: ["i1", "i2", "i3"] },
    { id: "recDriver", itemName: "Impact Driver", assets: ["i4"] },
    { id: "recNothing", itemName: "Cordless Drill", assets: [] },
];

const ITEMS = [
    { id: "i1", category: ["recGrinder"], status: ASSET_STATUS.IN_STOCK },
    { id: "i2", category: ["recGrinder"], status: ASSET_STATUS.OUT },
    { id: "i3", category: ["recGrinder"], status: ASSET_STATUS.IN_STOCK },
    { id: "i4", category: ["recDriver"], status: ASSET_STATUS.RETIRED },
];

const rowFor = (rows, itemName) => rows.find((r) => r.itemName === itemName);
const countIn = (row, status) => row.counts.find((c) => c.status === status)?.count;

/** Every string the copy constant holds, builders called with a plausible argument. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(ASSET_LIST_COPY)) {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "function") {
            out.push(value(2), value({ page: 2, pageCount: 3, from: 26, to: 40, total: 40 }));
        }
    }
    return out.filter((s) => typeof s === "string");
}

/**
 * The noun the design replaced (#455), in any number and case.
 *
 * THIS FILE HELD THE OPPOSITE RULE UNTIL THEN — a string here failed for a bare `item`,
 * the tools area's reading of #303. The design put `items` on a tool's own page (its
 * count and its column) and `tool` in every sentence about one, so what a string here
 * may no longer say is the noun it used to require.
 */
const TOOL_ITEM_NOUN = /\btool items?\b/i;

/** The category's own screen, whose read and the rows it hands on section 2b reads off the AST. */
const CATEGORY_SCREEN = "app/(assets)/asset-categories/[categoryRecordId]/page.js";

/** The list on that screen, whose selection section 2b reads off the AST (#443). */
const ASSET_LIST = "app/(assets)/asset-categories/[categoryRecordId]/AssetList.js";

/** The category list, whose opener of the registration dialog section 2b reads off the AST (#456). */
const LIST_SCREEN = "app/(assets)/asset-categories/page.js";

/** The rows that page hands the browser, which the band narrows and the pager divides (#520). */
const CATEGORY_LIST = "app/(assets)/asset-categories/AssetCategoryList.js";

/** The frame both lists are drawn in, its parts, the box and the rail's column (#463). */
const LIST_FRAME = "app/components/ListFrame.js";
const LIST_TABLE = "app/components/ListTable.js";
const CONTROLS = "app/components/Controls.js";
const RAIL = "app/components/Rail.js";

/** The source of the function `name` declares in a parsed file, or "" when there is none. */
function functionSource(parsed, name) {
    let found = "";
    walk(parsed.ast, (n) => {
        if (!found && n.type === "FunctionDeclaration" && n.id?.name === name) found = parsed.source.slice(n.start, n.end);
    });
    return found;
}

/** What a JSX element named `name` is handed for `prop`, as written, each occurrence once. */
function propSources(parsed, name, prop) {
    const out = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== name) return;
        const attribute = n.attributes.find((a) => a.name?.name === prop);
        if (attribute) out.push(attribute.value ? parsed.source.slice(attribute.value.start, attribute.value.end) : "true");
    });
    return out;
}

/** `(await searchParams) ?? {}`, `await searchParams` or `searchParams` — a page's address. */
function isSearchParams(init) {
    let e = init;
    if (e?.type === "LogicalExpression") e = e.left;
    if (e?.type === "AwaitExpression") e = e.argument;
    return e?.type === "Identifier" && e.name === "searchParams";
}

/** `page.ids` for a member read, the bare name for an identifier, else the node's type. */
function nameOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) return `${nameOf(node.object)}.${node.property.name}`;
    return node?.type ?? "none";
}

/**
 * A JSX element's attributes as name and value, a spread of an object the same file binds
 * read as that object's own props (#463): two openers on one page hand one object, so what
 * each is handed is read off the object rather than lost behind the spread.
 */
function attributesOf(openingElement, ast) {
    const out = [];
    for (const attribute of openingElement.attributes) {
        if (attribute.type === "JSXSpreadAttribute" && attribute.argument?.type === "Identifier") {
            let bound = null;
            walk(ast, (n) => {
                if (!bound && n.type === "VariableDeclarator" && n.id?.name === attribute.argument.name && n.init?.type === "ObjectExpression") bound = n.init;
            });
            for (const p of bound?.properties ?? [])
                out.push({ name: p.key?.name, value: p.shorthand ? { type: "Identifier", name: p.key.name } : p.value });
        } else out.push({ name: attribute.name?.name, value: attribute.value });
    }
    return out;
}

/**
 * What a `<RegistrationDialog>` is handed (#456), prop by prop and sorted: a name or a
 * member as `nameOf` reads it, a literal as its value, an object as its own props, and a
 * bare attribute as `true`. The opener carries what the registration's address carried
 * until #456, so these are what the three openers are held to.
 */
function dialogProps(openingElement, ast) {
    // A call reads as its callee and its arguments, so `canRegisterAssets(user, jobs)`
    // is told from a literal `true` and from the same predicate asked of another list;
    // a function handed as an argument reads as `…`, since only its caller matters here.
    // A fallback reads as its two sides and an optional read as one (#565), so the job a
    // list stands on, `scope.job?.id ?? null`, is told from the address's `sp.job`.
    const sourceOf = (node) => {
        if (node?.type === "CallExpression")
            return `${sourceOf(node.callee)}(${node.arguments
                .map((argument) => (argument.type === "ArrowFunctionExpression" ? "…" : sourceOf(argument)))
                .join(", ")})`;
        if (node?.type === "ChainExpression") return sourceOf(node.expression);
        if (node?.type === "MemberExpression" && !node.computed)
            return `${sourceOf(node.object)}${node.optional ? "?." : "."}${node.property.name}`;
        if (node?.type === "LogicalExpression") {
            const side = (each) => (each?.type === "Literal" ? String(each.value) : sourceOf(each));
            return `${side(node.left)} ${node.operator} ${side(node.right)}`;
        }
        return nameOf(node);
    };
    const valueOf = (node) => {
        if (!node) return "true";
        const expression = node.type === "JSXExpressionContainer" ? node.expression : node;
        if (expression?.type === "Literal") return String(expression.value);
        if (expression?.type === "ObjectExpression")
            return `{ ${expression.properties
                .map((p) => (p.shorthand ? p.key.name : `${p.key?.name}: ${sourceOf(p.value)}`))
                .join(", ")} }`;
        return sourceOf(expression);
    };
    return attributesOf(openingElement, ast)
        .map((attribute) => `${attribute.name}: ${valueOf(attribute.value)}`)
        .sort()
        .join(", ");
}

// ---------------------------------------------------------------------------
// the markup scan
// ---------------------------------------------------------------------------

/** The JSX attributes whose value a reader sees. None is in use on this axis. */
const VISIBLE_ATTRIBUTES = new Set(["placeholder", "title", "alt", "aria-label"]);

/**
 * Every piece of text one file writes straight into its markup.
 *
 * THREE SHAPES, BECAUSE REMOVING ONE LEAVES THE OTHER TWO. Bare JSX text is the
 * obvious one; a string literal in an expression container (`{"Tools"}`) renders
 * identically and is what somebody reaches for when a bare word will not parse;
 * and a visible attribute is copy that never appears between tags at all.
 */
function markupText(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "JSXText" && n.value.trim()) found.push(n.value.trim());
        if (
            n.type === "JSXExpressionContainer" &&
            n.expression?.type === "Literal" &&
            typeof n.expression.value === "string" &&
            n.expression.value.trim()
        )
            found.push(n.expression.value.trim());
        if (
            n.type === "JSXAttribute" &&
            VISIBLE_ATTRIBUTES.has(n.name?.name) &&
            n.value?.type === "Literal" &&
            typeof n.value.value === "string" &&
            n.value.value.trim()
        )
            found.push(`${n.name.name}="${n.value.value.trim()}"`);
    });
    return found;
}

/** Every `.js` under app/(assets)/, repo-relative and posix-separated. */
function assetsFiles() {
    const out = [];
    listJsFiles(repoPath("app/(assets)"), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

// ---------------------------------------------------------------------------
// #548: all of a reader's jobs at once
// ---------------------------------------------------------------------------

/**
 * A list on all of a reader's jobs (#548): the scope that stands on them, the counts a row
 * carries per job, the band's `Job` chip that narrows to some of them, and where each screen
 * asks. Called first in `run()`, so an older assertion that throws cannot keep it from printing.
 */
function allJobs548({ check, log }) {
    log("a list may stand on all of a reader's jobs, and the band's Job chip narrows to some of them (#548):");
    const JOBS = [
        { id: "recJ2", jobCode: "26-B", assets: ["a3", "a4", "a5"] },
        { id: "recJ3", jobCode: "26-C", assets: [] },
        { id: "recJ1", jobCode: "26-A", assets: ["a1", "a2"] },
    ];
    const office = { isAdmin: true, assignedJobs: ["recJ2"] };
    const site = { isAdmin: false, assignedJobs: ["recJ1", "recJ3"] };
    const single = { isAdmin: false, assignedJobs: ["recJ2"] };
    const said = (scope) => `${scope.allJobs} ${scope.choice} ${scope.job?.jobCode ?? "-"} ${[...scope.shown].join(",")}`;

    // THE SCOPE, by value: `all` stands on every job the reader may choose between, wherever it
    // stands among the values, and only for a reader with more than one.
    check("the office on all jobs stands on every job, their assets together", said(assetListScope(office, JOBS, ALL_JOBS)), "true all - a1,a2,a3,a4,a5");
    check("  anybody else on all of their own", said(assetListScope(site, JOBS, ALL_JOBS)), "true all - a1,a2");
    check(
        "  `all` among the band's job values still stands on all of them, wherever it stands",
        [said(assetListScope(site, JOBS, [ALL_JOBS, "recJ3"])), said(assetListScope(site, JOBS, ["recJ1", ALL_JOBS]))].join(" | "),
        "true all - a1,a2 | true all - a1,a2"
    );
    check("a reader on one job asking for all is on that job, as for any value not offered", said(assetListScope(single, JOBS, ALL_JOBS)), "false recJ2 26-B a3,a4,a5");
    check("  and a reader on no job on nothing", said(assetListScope({ isAdmin: false }, JOBS, ALL_JOBS)), "false null - ");
    check("an address naming one job, as every address did before, stands on it", said(assetListScope(office, JOBS, "recJ2")), "false recJ2 26-B a3,a4,a5");
    check("  no job asked starts on the first by its code", said(assetListScope(office, JOBS, undefined)), "false recJ1 26-A a1,a2");
    check("  and several jobs without all are a repeated parameter, answered with the first", said(assetListScope(office, JOBS, ["recJ2", "recJ3"])), "false recJ1 26-A a1,a2");

    // THE COUNTS PER JOB each row carries, which the chip adds up in the browser.
    const KINDS = [
        { id: "kSaw", itemName: "Band Saw", level1: "Tool", level2: "Power Tool", assets: ["a1", "a3"] },
        { id: "kDrill", itemName: "Drill", level1: "Tool", level2: "Power Tool", assets: ["a2", "a4"] },
        { id: "kWelder", itemName: "TIG Welder", level1: "Equipment", level2: "Welding", assets: ["a5"] },
    ];
    const ASSETS = [
        { id: "a1", category: ["kSaw"], job: ["recJ1"], status: ASSET_STATUS.IN_STOCK },
        { id: "a2", category: ["kDrill"], job: ["recJ1"], status: ASSET_STATUS.OUT },
        { id: "a3", category: ["kSaw"], job: ["recJ2"], status: ASSET_STATUS.IN_STOCK },
        { id: "a4", category: ["kDrill"], job: ["recJ2"], status: ASSET_STATUS.RETIRED },
        { id: "a5", category: ["kWelder"], job: ["recJ2"], status: ASSET_STATUS.IN_REPAIR },
    ];
    const rows = summarizeAssetCategories(KINDS, ASSETS);
    const counted = (list) => list.map((row) => `${row.id}:${row.counts.map((c) => c.count).join("/")}`).join(" ");
    const perJob = (list) =>
        list.map((row) => `${row.id}:${Object.entries(row.perJob).map(([job, figures]) => `${job}=${figures.join("/")}`).join(",")}`).join(" ");
    check("a row counts its kind on every job it stands on, added up", counted(rows), "kSaw:2/0/0/0 kDrill:0/1/0/1 kWelder:0/0/1/0");
    check(
        "  and carries its counts on each job, in the vocabulary's order",
        perJob(rows),
        "kSaw:recJ1=1/0/0/0,recJ2=1/0/0/0 kDrill:recJ1=0/1/0/0,recJ2=0/0/0/1 kWelder:recJ2=0/0/1/0"
    );
    const jobless = summarizeAssetCategories(KINDS, [...ASSETS, { id: "a6", category: ["kWelder"], job: [], status: ASSET_STATUS.OUT }]);
    check("  an asset with no job is counted on its row and on no job", `${counted(jobless).split(" ")[2]} ${perJob(jobless).split(" ")[2]}`, "kWelder:0/1/1/0 kWelder:recJ2=0/0/1/0");

    // THE `Job` CHIP, by value: what it offers, what taking a job does to the rows and their
    // counts, what narrows nothing, and how it composes with the band's other chips.
    const CHOICE = [
        { id: "recJ1", jobCode: "26-A" },
        { id: "recJ2", jobCode: "26-B" },
        { id: "recJ3", jobCode: "26-C" },
    ];
    const ids = (reading) => reading.rows.map((row) => row.id).join(",");
    const offered = (reading) => reading.jobOptions.map((o) => `${o.label}${o.chosen ? "*" : ""} ${o.count}`).join(" | ");
    const open = filterAssetCategoryRows(rows, {}, { jobs: CHOICE });
    check("the Job chip offers the jobs a row stands on, in the choice's order, each with the rows it would leave", offered(open), "26-A 2 | 26-B 3");
    check("  and narrows nothing until one is taken", `${ids(open)} ${open.narrowed} ${counted(open.rows)}`, "kSaw,kDrill,kWelder false kSaw:2/0/0/0 kDrill:0/1/0/1 kWelder:0/0/1/0");
    const onA = filterAssetCategoryRows(rows, { jobs: ["recJ1"] }, { jobs: CHOICE });
    check("a job taken leaves the rows on it, counting that job's alone", `${ids(onA)} ${counted(onA.rows)} ${onA.narrowed}`, "kSaw,kDrill kSaw:1/0/0/0 kDrill:0/1/0/0 true");
    check("  held by its record id, its own chip still counting each job on its own", `${JSON.stringify(onA.held.jobs)} ${offered(onA)}`, '["recJ1"] 26-A* 2 | 26-B 3');
    const onBoth = filterAssetCategoryRows(rows, { jobs: ["recJ2", "recJ1"] }, { jobs: CHOICE });
    check(
        "  two taken are either, their counts added up, held in the choice's order",
        `${ids(onBoth)} ${counted(onBoth.rows)} ${JSON.stringify(onBoth.held.jobs)}`,
        'kSaw,kDrill,kWelder kSaw:2/0/0/0 kDrill:0/1/0/1 kWelder:0/0/1/0 ["recJ1","recJ2"]'
    );
    const stale = filterAssetCategoryRows(rows, { jobs: [ALL_JOBS, "recJ3", "recNope"] }, { jobs: CHOICE });
    check("a job with nothing on it, one not offered and `all` narrow nothing and are not held", `${ids(stale)} ${stale.narrowed} ${stale.held.jobs.length}`, "kSaw,kDrill,kWelder false 0");
    const noChip = filterAssetCategoryRows(rows, { jobs: ["recJ1"] });
    check("  and with no jobs to offer — a list on one job, or the catalog — the chip offers none and narrows nothing", `${noChip.jobOptions.length} ${ids(noChip)} ${noChip.narrowed}`, "0 kSaw,kDrill,kWelder false");
    const composed = filterAssetCategoryRows(rows, { jobs: ["recJ2"], level1: ["Tool"] }, { jobs: CHOICE });
    check(
        "the Job chip composes with the other chips, each counting under the other",
        `${ids(composed)} ${offered(composed)} / ${composed.facets.level1.map((o) => `${o.value} ${o.count}`).join(" | ")}`,
        "kSaw,kDrill 26-A 2 | 26-B* 2 / Equipment 1 | Tool 2"
    );
    check("  and a search that empties a list held to a job clears everything", emptiedListWords(filterAssetCategoryRows(rows, { q: "zzz", jobs: ["recJ1"] }, { jobs: CHOICE })).clear, "Clear all");
    check(
        "the chip's words: the asset's page's `Job` and its own clear, and `All jobs` the document lists' word",
        [ASSET_LIST_COPY.jobLabel, ASSET_LIST_COPY.clearJobs, axesFor(FILTERED_LISTS[0]).find((axis) => axis.param === "job").words.all, ALL_JOBS].join(" | "),
        "Job | Clear job filter | All jobs | all"
    );

    // WHERE EACH SCREEN ASKS, off the sources, since no figure shows it.
    const choiceSource = parseFile("app/(assets)/JobChoice.js").source;
    check(
        "the job's choice offers `All jobs` first, in the document lists' word, and shows no `Job` before what it holds (#566)",
        [
            /const ALL_JOBS_LABEL = axesFor\(FILTERED_LISTS\[0\]\)\.find\(\(axis\) => axis\.param === "job"\)\.words\.all;/.test(choiceSource),
            /const options = \[\{ value: ALL_JOBS, label: ALL_JOBS_LABEL \}, \.\.\.jobs\.map\(\(\{ id, jobCode \}\) => \(\{ value: id, label: jobCode \}\)\)\];/.test(choiceSource),
            /<Choice\s+look=\{look\}\s+options=\{options\}/.test(choiceSource) && !/<Choice[^>]*\blabel=/.test(choiceSource),
        ].join(" "),
        "true true true"
    );
    const listPage = parseFile(LIST_SCREEN).source;
    check(
        "the list carries the scope's choice, a reader on no job is one with no jobs, and the list is told it is on all of them",
        [
            /const onNoJob = scope\.jobs\.length === 0;/.test(listPage),
            /const job = scope\.choice;/.test(listPage),
            /<AssetCategoryList\s+rows=\{rows\}\s+job=\{job\}\s+jobCode=\{scope\.job\?\.jobCode \?\? null\}\s+allJobs=\{scope\.allJobs\}\s+jobs=\{choosable\}/.test(listPage),
        ].join(" "),
        "true true true"
    );
    const bandFile = parseFile(CATEGORY_LIST).source;
    check(
        "the list hands the band the Job chip's values and its jobs only on all of them, and draws the chip only then",
        [
            /const reading = readCategoryList\(rows, params, \{ allJobs, jobs, q: typed \}\);/.test(bandFile) &&
                /jobs: allJobs \? \(params\?\.getAll\?\.\("job"\) \?\? \[\]\) : \[\] \},\s*\{ jobs: allJobs \? \(jobs \?\? \[\]\) : \[\] \}/.test(parseFile("lib/assetListView.js").source),
            /\{allJobs && \(\s*<FilterChip\s*label=\{COPY\.jobLabel\}\s*options=\{reading\.jobOptions\.map\(/.test(bandFile),
            /values=\{reading\.held\.jobs\}\s*onChange=\{\(values\) => choose\("jobs", values\)\}\s*clearLabel=\{COPY\.clearJobs\}/.test(bandFile),
        ].join(" "),
        "true true true"
    );
    const categoryPage = parseFile(CATEGORY_SCREEN).source;
    check(
        "a category's page carries the scope's choice, and draws each row's job only on all of them",
        [
            /const job = scope\.choice;/.test(categoryPage),
            /showsJob=\{scope\.allJobs\}/.test(categoryPage),
            /\.\.\.\(scope\.allJobs \? \{ jobCode: codeOf\.get\(asset\.job\?\.\[0\]\) \?\? "" \} : \{\}\)/.test(categoryPage),
        ].join(" "),
        "true true true"
    );
    const listFile = parseFile(ASSET_LIST).source;
    check(
        "its list puts the job at 96 after the id on all of them, with the box and without, headed `Job`",
        [
            listFile.includes('"grid-cols-[var(--size-icon)_var(--width-table-id)_var(--width-table-job)_var(--width-table-status)_minmax(0,1fr)_var(--width-table-date)]"'),
            listFile.includes('"grid-cols-[var(--width-table-id)_var(--width-table-job)_var(--width-table-status)_minmax(0,1fr)_var(--width-table-date)]"'),
            /const columns = showsJob \? \(selects \? COLUMNS_WITH_JOB : COLUMNS_WITH_JOB_WITHOUT_BOX\) : selects \? COLUMNS : COLUMNS_WITHOUT_BOX;/.test(listFile),
            /\{COPY\.assetIdLabel\}<\/span>\s*\{showsJob && <span role="columnheader">\{COPY\.jobLabel\}<\/span>\}\s*<span role="columnheader">\{COPY\.statusLabel\}/.test(listFile),
            /\{showsJob && \(\s*<span role="cell" className="min-w-0 truncate text-foreground-muted tabular-nums">\s*\{row\.jobCode\}/.test(listFile),
        ].join(" "),
        "true true true true true"
    );
    const assetPage = parseFile("app/(assets)/assets/[assetId]/page.js").source;
    check(
        "an asset's page holds the asset's own job, whatever list it was opened from, reading none off its address",
        [/job=\{asset\.job\?\.\[0\] \?\? null\}/.test(assetPage), !/ALL_JOBS|searchParams/.test(assetPage)].join(" "),
        "true true"
    );
    log("");
}

export function run({ check, assert, log }) {
    allJobs548({ check, log });

    // ── #522: the status cell centered in its row, as 1d draws it ──────────
    // At the head, so an older assertion that throws cannot keep it from printing. On the row's
    // baseline the 9 mark lifted the status word half a pixel above 1d's.
    check(
        "the status cell stands centered in its row, as 1d draws it (#522)",
        /<span role="cell" className="flex min-w-0 items-baseline gap-gap self-center">\s*<StatusMark status=\{row\.status\} \/>/.test(parseFile(ASSET_LIST).source),
        true
    );

    // ── A row's faces are square, as 1a and 1d draw them ────────────────────
    // Every list row the drawings draw sets its corners at 0, and the link covering it is its
    // box; 0b's sentence gives the hover a Control radius, which the row wore until 2026-10-12.
    // A rounded token of either constant, whatever its size or corner, would round them again.
    {
        const tableSource = parseFile(LIST_TABLE).source;
        const tokensOf = (name) => (tableSource.match(new RegExp(`export const ${name} =\\s*"([^"]*)"`))?.[1] ?? "").split(/\s+/);
        const rounded = (tokens) => tokens.filter((t) => /(^|:)rounded(-|$)/.test(t));
        check(
            "a row's faces and the link that covers it are square, as 1a and 1d draw them",
            [rounded(tokensOf("TABLE_ROW")).join(" "), rounded(tokensOf("TABLE_ROW_LINK")).join(" "), tokensOf("TABLE_ROW").includes("hover:bg-hover-subtle")].join(" | "),
            " |  | true"
        );
    }

    // ── 1: the count per status ─────────────────────────────────────────────
    log("every category carries a count for every status, a zero included:");

    const rows = summarizeAssetCategories(CATEGORIES, ITEMS);
    check("one row per category", rows.length, CATEGORIES.length);
    for (const row of rows) {
        check(
            `  ${row.itemName} carries the whole vocabulary`,
            row.counts.map((c) => c.status).join(", "),
            ASSET_STATUS_VALUES.join(", ")
        );
    }

    const grinder = rowFor(rows, "angle grinder");
    check("two of the grinders are in stock", countIn(grinder, ASSET_STATUS.IN_STOCK), 2);
    check("  one is out", countIn(grinder, ASSET_STATUS.OUT), 1);
    check("  and none is retired", countIn(grinder, ASSET_STATUS.RETIRED), 0);
    check(
        "the counts add up to the assets under it",
        grinder.counts.reduce((sum, c) => sum + c.count, 0),
        3
    );

    // An `Asset Categories` row with nothing under it is a row of zeros rather than a
    // missing row. The list leaves such a row off before it summarizes
    // (`assetCategoriesInScope`, #507), so this holds the function alone.
    const nothing = rowFor(rows, "Cordless Drill");
    assert("a category with no assets is still a row", Boolean(nothing));
    check("  and its counts are a zero per status", nothing.counts.map((c) => c.count).join(), "0,0,0,0");

    // AN ITEM IN REPAIR IS COUNTED IN ITS OWN COLUMN AND NOT IN STOCK (#531): one status at a
    // time, so `In stock` leaves out what is away at its maker, as 1a draws it.
    const repairs = summarizeAssetCategories(
        [{ id: "recWelder", itemName: "TIG Welder", assets: [] }],
        [
            { id: "w1", category: ["recWelder"], status: "In stock" },
            { id: "w2", category: ["recWelder"], status: "In repair" },
            { id: "w3", category: ["recWelder"], status: "In repair" },
            { id: "w4", category: ["recWelder"], status: "Out" },
            { id: "w5", category: ["recWelder"], status: "Retired" },
        ]
    )[0];
    check(
        "an item in repair is counted in its own column and not in stock (#531)",
        repairs.counts.map((c) => `${c.status} ${c.count}`).join(" | "),
        "In stock 1 | Out 1 | In repair 2 | Retired 1"
    );

    check(
        "the order is by name, case-insensitively",
        rows.map((r) => r.itemName).join(" | "),
        "angle grinder | Cordless Drill | Impact Driver"
    );

    // ANTI-VACUITY: the summarizer is seen counting something other than zero for
    // each of the three, so the row above is a fact about the input rather than
    // about a function that returns zeros.
    const everyStatus = summarizeAssetCategories(
        [{ id: "recAll", itemName: "All", assets: [] }],
        ASSET_STATUS_VALUES.map((status, i) => ({ id: `s${i}`, category: ["recAll"], status }))
    )[0];
    assert(
        "  and every status is reachable as a nonzero count",
        everyStatus.counts.every((c) => c.count === 1)
    );
    // EACH ROW CARRIES ITS KIND'S CATEGORY AND TYPE (#507, #514), each under its level's name,
    // and two kinds of one name are told apart by the category and then the type, so a page
    // reads the same on every read. The category stands beside the name (1a, #519); the class
    // rode here while the list drew it as a column, from #507 to #519, and again from #520 for
    // the band's filter by it, until #552 took it off the catalog.
    const kinds = summarizeAssetCategories(
        [
            { id: "recLaserT", itemName: "Laser Level", assetClass: "B", level1: "Tool", level2: "Measuring", assets: [] },
            { id: "recLaserE", itemName: "Laser Level", assetClass: "A", level1: "Equipment", level2: "Measuring", assets: [] },
            { id: "recKnifeX", itemName: "Utility Knife", assetClass: "B", level1: "Tool", level2: "Cutting", assets: [] },
            { id: "recKnifeC", itemName: "Utility Knife", assetClass: "B", level1: "Tool", level2: "Carpentry", assets: [] },
        ],
        []
    );
    check(
        "each row carries its kind's type and category, one name ordered by category and then type",
        kinds.map((r) => `${r.id} ${r.level1}/${r.level2}`).join(" | "),
        "recLaserE Equipment/Measuring | recLaserT Tool/Measuring | recKnifeC Tool/Carpentry | recKnifeX Tool/Cutting"
    );
    check("  and no class, though the kind it is read off carries one (#552)", kinds.map((r) => ("assetClass" in r ? r.assetClass : "none")).join(","), "none,none,none,none");
    check("  and a kind without them says nothing for them", `${rowFor(rows, "angle grinder").level1}|${rowFor(rows, "angle grinder").level2}|`, "||");
    // THE LIST'S COLUMNS, OFF ITS SOURCE (#519): the name, then a count per status (1a). The
    // class, the type and the category were columns between them from #507 and #514.
    const columnHeads = ({ ast, source }) => {
        const heads = [];
        walk(ast, (n) => {
            if (n.type !== "JSXElement" || n.openingElement.name?.name !== "span") return;
            if (!n.openingElement.attributes.some((a) => a.name?.name === "role" && a.value?.value === "columnheader")) return;
            const said = n.children.find((child) => child.type === "JSXExpressionContainer")?.expression;
            heads.push(said ? source.slice(said.start, said.end) : "nothing");
        });
        return heads.join(", ");
    };
    check(
        "the list heads its columns the name and each status",
        columnHeads(parseFile(CATEGORY_LIST)),
        "COPY.nameLabel, status"
    );
    // ONE TRACK PER STATUS, AND THE COUNT IN THE REPEAT IS A LITERAL (#531): a class a
    // stylesheet is built from cannot be computed, so the repeat says 4 and is held to the
    // vocabulary's length — a new status fails here until its track is drawn.
    const countTracks = Number(parseFile(CATEGORY_LIST).source.match(/const COLUMNS = "grid-cols-\[minmax\(0,1fr\)_repeat\((\d+),var\(--width-table-count\)\)\]";/)?.[1]);
    check("  one 96 track per status, four", countTracks, 4);
    check("  as many as the vocabulary holds", countTracks, ASSET_STATUS_VALUES.length);
    check(
        "  and a list with the type left out is seen (anti-vacuity)",
        columnHeads(parseSource('<div><span role="columnheader">{COPY.nameLabel}</span><span role="columnheader">{ASSET_CATEGORY_COPY.levelLabel.level2}</span></div>', "<planted-heads>")),
        "COPY.nameLabel, ASSET_CATEGORY_COPY.levelLabel.level2"
    );
    // An asset whose link did not resolve is counted nowhere rather than
    // throwing — `findByRecordIds` returns fewer rows than it was asked for, and
    // one bad link must not take the whole list down.
    const unlinked = summarizeAssetCategories(CATEGORIES, [...ITEMS, { id: "i9", category: [], status: ASSET_STATUS.OUT }]);
    check(
        "an unlinked asset is counted nowhere",
        unlinked.reduce((sum, r) => sum + r.counts.reduce((s, c) => s + c.count, 0), 0),
        ITEMS.length
    );

    // ── 2: the paging ───────────────────────────────────────────────────────
    log("");
    log("a page holds fifty assets, and the pages are the whole list:");

    // PINNED BY VALUE SINCE #442, where this held only that the size was a whole
    // number under fifty. Every length in the loop was derived from the constant,
    // and the one thing that tied the size down was a twelve-row fixture, by the
    // accident of twelve rows being two pages at ten. Twenty-five from #442 and fifty
    // since #538 (docs/briefs/asset-categories-categoryRecordId.md); moving it is an
    // edit to these literals in the same commit.
    check("a page holds this many assets", ASSET_PAGE_SIZE, 50);
    // Above 50 a page would cost two `findChildRecords` queries instead of one,
    // which is a boundary on this number that is not the design's.
    assert("  and stays inside one batched read of fifty", ASSET_PAGE_SIZE <= 50);
    // AND A PAGE IS WHAT ONE PRESS OF THE PAGE BOX SELECTS (#443), the other boundary
    // that is not the design's. The print control acts only on a selection of at most
    // `MAX_LABELS_PER_REQUEST` — a cap tied to the registration form rather than to
    // this page — so a page larger than that would be a box whose first press leaves
    // the control refusing. It was what one press of print SENT until #443 (#442), and
    // the order held for that reason then. Each figure is pinned by value where it
    // lives; this is the order between them.
    assert("  and fits what one print takes at once", ASSET_PAGE_SIZE <= MAX_LABELS_PER_REQUEST);

    const idsOfLength = (n) => Array.from({ length: n }, (_, i) => `rec${String(i).padStart(3, "0")}`);
    // Literal lengths and literal page counts, on both sides of both edges a page of
    // fifty has inside two hundred.
    for (const [n, pages] of [
        [0, 1],
        [1, 1],
        [49, 1],
        [50, 1],
        [51, 2],
        [100, 2],
        [101, 3],
        [200, 4],
    ]) {
        const all = idsOfLength(n);
        const first = pageOfAssets(all, 1);
        check(`  ${n} assets make ${pages} page${pages === 1 ? "" : "s"}`, first.pageCount, pages);

        // THE ASSERTION THIS FILE IS FOR: every page, in order, is the whole list — newest
        // first since #463, the link array turned over.
        const reassembled = [];
        for (let p = 1; p <= first.pageCount; p++) reassembled.push(...pageOfAssets(all, p).ids);
        check(`    and the pages reassemble into it, newest first`, reassembled.join(), [...all].reverse().join());
        check(`    with the total stating the whole list`, first.total, n);
    }

    // A LIST THAT REALLY SPANS PAGES AT THIS SIZE (#442). This was twelve, which was
    // two pages at ten and one at twenty-five, and fifty-two from #442 to #538, which is
    // two pages at fifty with no middle one. A hundred and two is three pages — two full
    // and two left over, which puts a middle page between the two ends. Its page count is
    // pinned first, so a fixture that stopped spanning pages fails here rather than
    // quietly asking about page 1 three times.
    const hundredTwo = idsOfLength(102);
    check("a hundred and two assets make three pages", pageOfAssets(hundredTwo, 1).pageCount, 3);
    // NEWEST FIRST (#463): the array's last opens page 1, and its first closes the list.
    check("  page 1 holds the newest fifty", pageOfAssets(hundredTwo, 1).ids.length, 50);
    check("  opening on the newest of all", pageOfAssets(hundredTwo, 1).ids[0], "rec101");
    check("  page 2 opens on the fifty-first newest", pageOfAssets(hundredTwo, 2).ids[0], "rec051");
    check("  and closes on the hundredth", pageOfAssets(hundredTwo, 2).ids.at(-1), "rec002");
    check("  and page 3 holds the remaining two", pageOfAssets(hundredTwo, 3).ids.length, 2);
    check("  which are the oldest two, newest first", pageOfAssets(hundredTwo, 3).ids.join(), "rec001,rec000");
    check("  and the link array it was handed is left as it was", hundredTwo[0], "rec000");

    log("");
    log("a page nobody can be on resolves to one they can:");
    for (const [raw, want, why] of [
        [undefined, 1, "no parameter at all"],
        ["", 1, "an empty one"],
        ["abc", 1, "one that is not a number"],
        ["-3", 1, "a negative"],
        ["0", 1, "a zero"],
        ["1.5", 1, "a fraction"],
        ["2", 2, "one in the middle"],
        ["3", 3, "the last one"],
        ["999", 3, "one past the end"],
    ])
        check(`  ${why} lands on page ${want}`, pageOfAssets(hundredTwo, raw).page, want);
    check("an empty category has one page, not none", pageOfAssets([], 1).pageCount, 1);
    check("  and that page is empty", pageOfAssets([], 1).ids.length, 0);

    // WHERE A REGISTRATION LANDS (#449): the first page since #463, because the list reads
    // newest first and what a registration wrote is the newest its category holds. Its assets
    // are appended to the category's link array, so they are seen opening page 1 of a category
    // that already fills a page, the last written first, and a run longer than a page going
    // on to page 2 — which is what the action's landing on page 1 rests on, and
    // `offline/asset-registration.mjs` reads that 1 off its redirect. Until #463 the landing
    // was `pageHolding`'s page, held here by its edges.
    log("");
    log("what a registration wrote opens the first page, newest first:");
    const before = idsOfLength(60);
    const written = Array.from({ length: 14 }, (_, i) => `new${String(i).padStart(3, "0")}`);
    check("  the category already fills a page", pageOfAssets(before, 1).pageCount, 2);
    check(
        "  a registration's fourteen open page 1, the last written first",
        pageOfAssets([...before, ...written], 1).ids.slice(0, 14).join(),
        [...written].reverse().join()
    );
    check("  and the category's newest before them follows", pageOfAssets([...before, ...written], 1).ids[14], "rec059");
    const run = Array.from({ length: 55 }, (_, i) => `run${String(i).padStart(3, "0")}`);
    check(
        "  a run longer than a page fills page 1 and goes on to page 2",
        `${pageOfAssets([...before, ...run], 1).ids.every((id) => id.startsWith("run"))} ${pageOfAssets([...before, ...run], 2).ids.slice(0, 5).join()}`,
        "true run004,run003,run002,run001,run000"
    );

    // ── 2b: the screen reads one page, and its list selects among it (#442, #443) ─
    log("");
    log("the category's screen reads the page it shows and hands the list those rows alone:");
    // TWO CLAIMS REST ON ONE ARGUMENT AND NOTHING HELD IT UNTIL #442. The screen is
    // five operations whatever the category's size (four until #520), and its page box selects one page —
    // and both are true only because the read hands `getAssetsByCategory` the page's
    // ids and the list is handed the rows that read returned. Drop `rowIds` and the
    // screen reads every asset under the category and offers every one of them to the
    // page box, with no figure on screen to show it. Until #443 the second claim was
    // the print link, built on this page from the same read — the labels' opener, in the
    // list, since #457.
    //
    // AND THE PAGE READS NOTHING BUT `page` OFF ITS ADDRESS (#443). What a label run is
    // for is in the address too, and a page that read it could fetch the assets
    // selected on other pages — a fifth operation, and more — without any figure on
    // screen moving. It is the list's to read, on the client; the page never names it.
    const screenFacts = (ast) => {
        let pageBinding = null;
        let readBinding = null;
        let rowIds = null;
        let rowsFrom = null;
        let printLinks = 0;
        let listItemName = null;
        let accountFrom = null;
        let fork = null;
        let notice = null;
        const told = [];
        const mapped = [];
        const addressBindings = new Set();
        const addressReads = new Set();
        walk(ast, (n) => {
            // #449: where the account is read from, what the fork is handed, and which
            // arrays the page maps — the notice's ids are one of them.
            if (n.type === "CallExpression" && n.callee?.name === "readRegistrationAccount")
                accountFrom = (n.arguments[0]?.properties ?? [])
                    .map((p) => `${p.key?.name}: ${nameOf(p.value)}`)
                    .sort()
                    .join(", ");
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationShortfall") {
                fork = n.attributes
                    .map((a) => `${a.name?.name}: ${nameOf(a.value?.expression ?? {})}`)
                    .sort()
                    .join(", ");
                told.push(n.name.name);
            }
            // #455: the notice is a component of its own now, since `Got it` is a press.
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationUnlogged") {
                notice = n.attributes
                    .map((a) => `${a.name?.name}: ${nameOf(a.value?.expression ?? {})}`)
                    .sort()
                    .join(", ");
                told.push(n.name.name);
            }
            if (n.type === "CallExpression" && n.callee?.property?.name === "map") mapped.push(nameOf(n.callee.object));
            if (n.type === "VariableDeclarator" && isSearchParams(n.init)) {
                if (n.id?.type === "Identifier") addressBindings.add(n.id.name);
                if (n.id?.type === "ObjectPattern")
                    for (const p of n.id.properties) if (p.key?.type === "Identifier") addressReads.add(p.key.name);
            }
            // What the list is handed as its rows: the read's binding, mapped.
            if (n.type === "JSXAttribute" && n.name?.name === "rows") {
                const value = n.value?.expression;
                const mapped = value?.type === "CallExpression" && value.callee?.property?.name === "map";
                rowsFrom = mapped ? nameOf(value.callee.object) : nameOf(value ?? {});
            }
            // The labels' opener (#457), which is the list's to draw — it was a link the
            // list built until then, and a page drawing one of its own would open the
            // labels on something other than the selection the list holds.
            if (n.type === "JSXOpeningElement" && n.name?.name === "LabelsDialog") printLinks++;
            if (n.type === "JSXOpeningElement" && n.name?.name === "AssetList") {
                const named = n.attributes.find((a) => a.name?.name === "itemName");
                listItemName = named ? nameOf(named.value?.expression ?? {}) : "none";
            }
            if (
                n.type === "VariableDeclarator" &&
                n.init?.type === "CallExpression" &&
                n.init.callee?.name === "pageOfAssets"
            )
                pageBinding = n.id?.name ?? null;
            // The read may stand alone or sit in a `Promise.all` destructured by
            // position; either way its binding is the name that receives it.
            if (n.type === "VariableDeclarator" && n.init) {
                const init = n.init.type === "AwaitExpression" ? n.init.argument : n.init;
                if (init?.type === "CallExpression" && init.callee?.name === "getAssetsByCategory")
                    readBinding = n.id?.name ?? null;
                const list = init?.type === "CallExpression" ? init.arguments?.[0] : null;
                if (list?.type === "ArrayExpression" && n.id?.type === "ArrayPattern") {
                    list.elements.forEach((element, at) => {
                        if (element?.type === "CallExpression" && element.callee?.name === "getAssetsByCategory")
                            readBinding = n.id.elements[at]?.name ?? null;
                    });
                }
            }
            if (n.type === "CallExpression" && n.callee?.name === "getAssetsByCategory") {
                const option = n.arguments?.[1]?.properties?.find((p) => p.key?.name === "rowIds");
                rowIds = option ? nameOf(option.value) : "none";
            }
        });
        walk(ast, (n) => {
            if (
                n.type === "MemberExpression" &&
                !n.computed &&
                n.object?.type === "Identifier" &&
                addressBindings.has(n.object.name)
            )
                addressReads.add(n.property.name);
        });
        return {
            pageBinding,
            readBinding,
            rowIds,
            rowsFrom,
            printLinks,
            listItemName,
            accountFrom,
            fork,
            notice,
            // The order the two stand in, which is the order their frames close and open in.
            told: told.join(", "),
            mappedFromAddress: mapped.filter((name) => name.includes("unlogged")).join(", "),
            addressReads: [...addressReads].sort(),
        };
    };
    const facts = screenFacts(parseFile(CATEGORY_SCREEN).ast);
    assert("the screen chooses its page through pageOfAssets", facts.pageBinding !== null);
    check("  the read is handed that page's ids", facts.rowIds, `${facts.pageBinding}.ids`);
    check("  and the list is handed the rows that read returned", facts.rowsFrom, facts.readBinding);
    assert("  which is a binding the screen really has", facts.readBinding !== null);
    // AND A REGISTRATION'S ACCOUNT (#449), which this page does read: it is drawn at
    // render and no box or step moves it, so a server read is right for it where it is
    // wrong for the selection. Pinned by name, so a page that began to read `id` fails
    // here even while it read the account as well. `job` is the job the list is narrowed
    // to (#509), read into `assetListScope` before the page is chosen.
    check(
        "the page reads `page`, `job` and a registration's account off its address, and never the selection",
        facts.addressReads.join(", "),
        "asked, job, page, unlogged, unwritten"
    );
    check("  and draws no labels' opener of its own", facts.printLinks, 0);
    // THE LABELS' DIALOG NAMES THE CATEGORY UNDER ITS TITLE (#457), and the name is the one
    // this page read for its heading, handed to the list that draws the opener.
    check("  handing the list the category's name for that dialog", facts.listItemName, "category.itemName");
    // WHAT THE ACCOUNT IS READ THROUGH AND HANDED TO (#449, #455, #459). One reader of the
    // three keys, and both dialogs handed what that reader returned — not the address's
    // values, which would skip the reading that drops a forged count and spells every id
    // once. Each is handed the whole account since #459, because which of them is told
    // depends on both parts (`accountToTell`), and each names the category under its title.
    check(
        "  the account is read through readRegistrationAccount, off the address",
        facts.accountFrom,
        "asked: sp.asked, unlogged: sp.unlogged, unwritten: sp.unwritten"
    );
    // AND, SINCE #456, what the fork's opener needs of the reader: whether they may
    // register, asked once on this page, and the jobs the dialog offers — the same two the
    // page's own opener is handed, so the two openers cannot answer the reader differently.
    // Since #507 the category it opens on is the page's opener's too, and so is the catalog that
    // admits it, and since #565 the job the list stands on; what those three are is read off
    // their declarations below, beside the openers.
    check(
        "  the fork is handed the page opener's tool and catalog, that reading and the page's answer about the reader",
        facts.fork,
        "account: account, canRegister: canRegister, catalog: catalog, category: opened, jobs: assignedJobs, listJobId: listJobId"
    );
    check("  and the notice the category's name and the same reading", facts.notice, "account: account, itemName: category.itemName");
    check("  which the page no longer lists itself", facts.mappedFromAddress, "");
    // THE NOTICE STANDS FIRST (#459): it is told first, and a notice whose answer hands
    // over to the fork has to close before the fork opens, which is tree order.
    check("  the notice stands before the fork", facts.told, "RegistrationUnlogged, RegistrationShortfall");
    // ANTI-VACUITY: a planted page reading one key raw, handing the fork a record id and
    // the address itself, handing the notice the address, putting the fork first and
    // mapping the address's list as well is seen doing all of it.
    const plantedHandoff = screenFacts(
        parseSource(
            "async function renderCategoryPage({ searchParams }) {\n" +
                "  const sp = (await searchParams) ?? {};\n" +
                "  const account = readRegistrationAccount({ unwritten: sp.unwritten });\n" +
                "  return (<>\n" +
                "    <RegistrationShortfall tool={tool.id} account={sp} />\n" +
                "    <RegistrationUnlogged account={sp} />\n" +
                "    <ul>{sp.unlogged.map((id) => <li key={id}>{id}</li>)}</ul>\n" +
                "  </>);\n" +
                "}\n",
            "<planted-handoff>"
        ).ast
    );
    check("  a reader handed one key is seen so", plantedHandoff.accountFrom, "unwritten: sp.unwritten");
    check("  a fork handed a record id and the address is seen so", plantedHandoff.fork, "account: sp, tool: tool.id");
    check("  a notice handed the address is seen so", plantedHandoff.notice, "account: sp");
    check("  the fork put first is seen", plantedHandoff.told, "RegistrationShortfall, RegistrationUnlogged");
    check("  and a list mapped off the address is seen so", plantedHandoff.mappedFromAddress, "sp.unlogged");
    // ANTI-VACUITY: a planted screen that reads the whole category, hands the list the whole
    // link array, reads the selection and prints it itself is seen doing all four, so the
    // answers above are facts about the screen rather than a reader that echoes them.
    const plantedScreen = screenFacts(
        parseSource(
            "async function renderCategoryPage({ searchParams }) {\n" +
                "  const sp = (await searchParams) ?? {};\n" +
                "  const page = pageOfAssets(tool.assets, sp.page);\n" +
                "  const [assets, jobs] = await Promise.all([getAssetsByCategory(tool.id), getAllJobs()]);\n" +
                "  const picked = await getAssetsByAssetIds(sp.id);\n" +
                "  return (<>\n" +
                "    <AssetList rows={tool.assets.map((id) => id)} />\n" +
                "    <LabelsDialog assetIds={picked} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-screen>"
        ).ast
    );
    check("  a read with no page is seen reading none", plantedScreen.rowIds, "none");
    check("  rows from the whole category are seen so", plantedScreen.rowsFrom, "tool.assets");
    check("  a page reading the selection is seen reading it", plantedScreen.addressReads.join(", "), "id, page");
    check("  a labels' opener drawn on the page is seen", plantedScreen.printLinks, 1);
    check("  and a list handed no category's name is seen so", plantedScreen.listItemName, "none");

    // THE LIST'S HALF (#443). The selection is read off the address here and nowhere
    // else, and three things about it hold only in the source: the labels' opener is
    // handed it and not the rows — a link built from it until #457, which took the labels
    // into a dialog — and stands disabled exactly where the list's own sentence says why;
    // the page box acts on the rows it was handed and nothing wider; and every address
    // this file writes carries it, through `history.replaceState` and never the router —
    // which is the difference between a press that costs nothing and one that re-renders
    // the page at five operations.
    const listFacts = (ast, source) => {
        const bindings = new Map();
        let selection = null;
        let readOff = null;
        // What the read stands under (#506): `selects ? read : []` for a list that selects
        // only for a site manager, and `none` for a read made whoever is reading.
        let readUnder = "none";
        let printFrom = null;
        let printDisabled = null;
        let printTitle = null;
        let pageBoxOver = null;
        const categoryPathCalls = [];
        let replaced = 0;
        const routed = [];
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.type === "Identifier") {
                bindings.set(n.id.name, n.init);
                const gated = n.init?.type === "ConditionalExpression" ? n.init : null;
                const read = gated ? gated.consequent : n.init;
                if (read?.type === "CallExpression" && read.callee?.name === "readAssetIds") {
                    selection = n.id.name;
                    // What it is handed: every `id` in the address, or only the first.
                    const argument = read.arguments[0];
                    const method = argument?.type === "CallExpression" ? nameOf(argument.callee).split(".").pop() : null;
                    const literals = argument?.arguments?.map((a) => JSON.stringify(a.value)).join(", ");
                    readOff = method ? `${method}(${literals})` : nameOf(argument ?? {});
                    if (gated) readUnder = `${nameOf(gated.test)} ? read : ${source.slice(gated.alternate.start, gated.alternate.end)}`;
                }
            }
        });
        const origin = (node) => {
            const init = node?.type === "Identifier" ? bindings.get(node.name) : node;
            return init?.type === "CallExpression" && init.callee?.property?.name === "map"
                ? nameOf(init.callee.object)
                : nameOf(node ?? {});
        };
        walk(ast, (n) => {
            if (n.type === "JSXOpeningElement" && n.name?.name === "LabelsDialog") {
                const attribute = (name) => n.attributes.find((a) => a.name?.name === name)?.value?.expression;
                printFrom = origin(attribute("assetIds"));
                const disabled = attribute("disabled");
                printDisabled = disabled && source ? source.slice(disabled.start, disabled.end) : "none";
                const title = attribute("title");
                printTitle = title ? nameOf(title) : "none";
            }
            if (n.type !== "CallExpression") return;
            const callee = nameOf(n.callee);
            if (callee === "togglePage") pageBoxOver = origin(n.arguments[1]);
            // The selection each write carries, and `+job` where its options carry the job
            // the list is narrowed to (#509).
            if (callee === "assetCategoryPath") {
                const options = n.arguments[3];
                const job =
                    options?.type === "ObjectExpression" && options.properties.some((p) => p.key?.name === "job") ? "+job" : "";
                categoryPathCalls.push(n.arguments.length >= 3 ? `${nameOf(n.arguments[2])}${job}` : `${n.arguments.length} arguments`);
            }
            if (callee === "window.history.replaceState") replaced++;
            if (callee === "useRouter" || callee === "redirect" || /^router\./.test(callee)) routed.push(callee);
        });
        return { selection, readOff, readUnder, printFrom, printDisabled, printTitle, pageBoxOver, categoryPathCalls, replaced, routed };
    };
    const listFile = parseFile(ASSET_LIST);
    const list = listFacts(listFile.ast, listFile.source);
    check("the list reads its selection through readAssetIds", list.selection, "selection");
    // `get` would answer with the first id alone, so a selection of three would read as
    // one and print one — a defect no figure on this page shows until print is pressed.
    check("  handed every `id` in the address", list.readOff, 'getAll("id")');
    // A list that selects nothing reads nothing (#506): a copied link's `id` neither marks a
    // row for a reader who is not a site manager nor rides the pager's steps.
    check("  and only for a list that selects, which reads none otherwise (#506)", list.readUnder, "selects ? read : []");
    check("  the labels' opener is handed it", list.printFrom, list.selection);
    // `describeSelection` says why a press would not print — nothing selected, or more
    // than one print takes — and the opener is drawn disabled on exactly that.
    check("  and is disabled where the list's sentence says why", list.printDisabled, "!summary.printable");
    // ITS WORD IS THE DIALOG'S TITLE FROM A CATEGORY'S PAGE, `Print labels`. The opener hands
    // the dialog its title, so the asset page's `Print label` here would title a run
    // of many with one label's word, and no figure on the page would move.
    check("  and says the dialog's word for a run from a category", list.printTitle, "LABEL_COPY.openFromCategory");
    check("  the page box acts on the rows the page handed it", list.pageBoxOver, "rows");
    check(
        "  every address it writes carries a selection — the new one, or the current one on a step — and the job (#509)",
        list.categoryPathCalls.join(", "),
        "next+job, selection+job, selection+job"
    );
    check("  written with history.replaceState", list.replaced, 1);
    check("  and never through the router", list.routed.join(", "), "");
    // ANTI-VACUITY: a planted list doing each of those wrong is seen doing it — the
    // opener handed the rows and never disabled, the page box over a wider list, a step
    // that drops the selection, and the router instead of the history.
    const plantedListFile = parseSource(
        "function AssetList({ categoryRecordId, rows, page, everyId }) {\n" +
            "  const router = useRouter();\n" +
            "  const params = useSearchParams();\n" +
            '  const selection = readAssetIds(params.get("id"));\n' +
            "  const wider = everyId.map((id) => id);\n" +
            "  const press = () => router.replace(assetCategoryPath(categoryRecordId, page, togglePage(selection, wider)));\n" +
            "  return (<>\n" +
            "    <LabelsDialog assetIds={rows.map((row) => row.assetId)} />\n" +
            "    <Link href={assetCategoryPath(categoryRecordId, page + 1)} />\n" +
            "  </>);\n" +
            "}\n",
        "<planted-list>"
    );
    const plantedList = listFacts(plantedListFile.ast, plantedListFile.source);
    check("  a read of the first id alone is seen so", plantedList.readOff, 'get("id")');
    check("  and one made whoever is reading is seen so", plantedList.readUnder, "none");
    check("  an opener handed the rows is seen so", plantedList.printFrom, "rows");
    check("  and one never disabled is seen so", plantedList.printDisabled, "none");
    check("  and one with no title of its own is seen so", plantedList.printTitle, "none");
    check("  a page box over a wider list is seen so", plantedList.pageBoxOver, "everyId");
    check("  a step dropping the selection is seen", plantedList.categoryPathCalls.join(", "), "CallExpression, 2 arguments");
    check("  and the router is seen", plantedList.routed.join(", "), "useRouter, router.replace");
    check("  with no history write", plantedList.replaced, 0);

    // THE FORK'S HALF (#449, #455, #459). `Not now` has to edit the CURRENT address and
    // take the fork's own two keys out of it: an address rebuilt from anything the render
    // was handed would put back a selection the reader has since changed, and deleting
    // `unlogged` too would take the notice's ids with it. `Add 2 more` has to carry the
    // count the fork was handed into the registration dialog — and since #485 it names that
    // count, so its words and the dialog are handed one value — and since #459 the fork is
    // a dialog of its own: open while `accountToTell` tells it and the registration is
    // shut, closed with `Not now` on the close and on Escape as on its own answer, handing
    // focus to the page's heading, and opening the form through the one opening rule
    // behind the one gate. Its title and its sentence are read here too (#485), as the
    // expressions whose values `offline/asset-registration.mjs` holds for a batch that
    // failed. None of that moves a figure, so it is read off the source — and the
    // notice's `Got it` below is held the same way.
    const FORK = "app/(assets)/asset-categories/[categoryRecordId]/RegistrationShortfall.js";
    const NOTICE = "app/(assets)/asset-categories/[categoryRecordId]/RegistrationUnlogged.js";
    const forkFacts = ({ ast, source }) => {
        const text = (node) => (node ? source.slice(node.start, node.end).replace(/\s+/g, " ") : "");
        const deleted = [];
        const added = [];
        let replaced = 0;
        let rebuilt = 0;
        let readsLocation = false;
        const routed = [];
        let opens = null;
        let gate = null;
        let frame = null;
        let told = null;
        let registration = null;
        // The count the answer that goes on names, and the count the form is handed (#485).
        let offers = "none";
        let handed = "none";
        // What the dialog says: its title and its one sentence, as expressions (#485).
        let titled = "none";
        let message = "none";
        const answers = [];
        walk(ast, (n) => {
            if (n.type === "MemberExpression" && nameOf(n) === "window.location.href") readsLocation = true;
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationForm") {
                opens = dialogProps(n);
                const quantity = n.attributes.find((a) => a.name?.name === "quantity");
                if (quantity) handed = text(quantity.value?.expression);
            }
            // The gate and what it says: its props, and the one expression it holds.
            if (n.type === "JSXElement" && n.openingElement.name?.name === "RegistrationOpener") {
                const said = n.children.find((c) => c.type === "JSXExpressionContainer");
                gate = `${dialogProps(n.openingElement)} → ${text(said?.expression)}`;
                if (said?.expression?.type === "CallExpression") offers = said.expression.arguments.map(text).join(", ");
            }
            if (n.type === "JSXElement" && n.openingElement.name?.name === "DialogMessage") {
                const said = n.children.find((c) => c.type === "JSXExpressionContainer");
                if (said) message = text(said.expression);
            }
            // The frame: when it is open, what closing it answers, and whether a press opened it.
            if (n.type === "JSXOpeningElement" && n.name?.name === "DialogFrame") {
                const attribute = (name) => n.attributes.find((a) => a.name?.name === name);
                const unprompted = attribute("unprompted");
                frame = `open: ${text(attribute("open")?.value?.expression)} · onClose: ${text(
                    attribute("onClose")?.value?.expression
                )} · ${unprompted ? "unprompted" : "prompted"}`;
                if (attribute("title")) titled = text(attribute("title").value?.expression);
            }
            // The dialog's own answers, by what each one runs.
            if (n.type === "JSXOpeningElement" && n.name?.name === "Button") {
                const onClick = n.attributes.find((a) => a.name?.name === "onClick");
                answers.push(text(onClick?.value?.expression));
            }
            if (n.type === "VariableDeclarator" && n.id?.name === "told") told = text(n.init);
            if (n.type === "VariableDeclarator" && n.id?.name === "registration") registration = text(n.init);
            if (n.type !== "CallExpression") return;
            const callee = nameOf(n.callee);
            if (/\.searchParams\.delete$/.test(callee)) deleted.push(n.arguments[0]?.value);
            if (/\.searchParams\.(set|append)$/.test(callee)) added.push(n.arguments[0]?.value);
            if (callee === "window.history.replaceState") replaced++;
            if (callee === "assetCategoryPath") rebuilt++;
            if (callee === "useRouter" || /^router\./.test(callee)) routed.push(callee);
        });
        return {
            deleted,
            added,
            replaced,
            rebuilt,
            readsLocation,
            routed,
            opens,
            gate,
            frame,
            told,
            registration,
            offers,
            handed,
            titled,
            message,
            answers: answers.join(", "),
        };
    };
    const fork = forkFacts(parseFile(FORK));
    check("the fork's dismissal takes exactly its own two keys out of the address", fork.deleted.join(", "), "asked, unwritten");
    check("  and puts nothing in", fork.added.join(", "), "");
    check("  editing the current address rather than rebuilding one", `${fork.readsLocation} ${fork.rebuilt}`, "true 0");
    check("  written with history.replaceState", fork.replaced, 1);
    check("  and never through the router", fork.routed.join(", "), "");
    check("it is told when accountToTell says so", fork.told, 'accountToTell(account, address) === "shortfall"');
    check(
        "  open while it is told and the registration is shut, closed as `Not now` closes it, and unprompted",
        fork.frame,
        "open: told && !registration.open · onClose: notNow · unprompted"
    );
    check("  whose own answer that stops is the same `Not now`", fork.answers, "notNow");
    check("its answer that goes on opens through the one opening rule", fork.registration, "useRegistrationOpening()");
    check(
        "  behind the one gate, in the fork's own words",
        fork.gate,
        "canRegister: canRegister, onOpen: registration.start → COPY.registerOthers(account.unwritten)"
    );
    // The category and the catalog are the page's, handed through (#507): the dialog starts on
    // the category's second step, and the reading admits it only while that catalog offers it.
    // So is the job the landing stands on (#565), which its choice starts on when it is the
    // reader's.
    check(
        "  onto the registration form on this tool and its catalog, with the count it was handed",
        fork.opens,
        "catalog: catalog, category: category, jobs: jobs, key: registration.opening, listJobId: listJobId, onClose: registration.close, open: registration.open, quantity: account.unwritten"
    );
    // ONE VALUE FOR THE WORDS AND THE FORM (#485): the answer names how many it will add, and
    // the dialog it opens starts at that count, so both are handed the same expression.
    check("  naming the count it hands the form, one value for both", `${fork.offers} | ${fork.handed}`, "account.unwritten | account.unwritten");
    check(
        "its title and its sentence, from the account it was handed",
        `${fork.titled} · ${fork.message}`,
        "COPY.shortfallHeading(account.unwritten) · COPY.shortfall(account.asked - account.unwritten)"
    );
    // ANTI-VACUITY: a planted fork doing each of those wrong is seen doing it.
    const plantedFork = forkFacts(
        parseSource(
            "function RegistrationShortfall({ categoryRecordId, page, itemName, account, requested, jobs }) {\n" +
                "  const router = useRouter();\n" +
                "  const registration = { open: false };\n" +
                "  const told = account.unwritten > 0;\n" +
                "  const finish = () => {\n" +
                "    const address = new URL(assetCategoryPath(categoryRecordId, page, []), origin);\n" +
                '    address.searchParams.delete("unwritten");\n' +
                '    address.searchParams.delete("unlogged");\n' +
                '    address.searchParams.set("done", "1");\n' +
                "    router.replace(`${address.pathname}${address.search}`);\n" +
                "  };\n" +
                "  return (<>\n" +
                "    <DialogFrame open={told} onClose={() => {}} title={COPY.shortfallHeading(account.asked)}>\n" +
                "      <DialogMessage>{COPY.shortfall(account.unwritten)}</DialogMessage>\n" +
                "      <Button onClick={finish}>{COPY.doneRegistering}</Button>\n" +
                "      <RegistrationOpener canRegister={true} onOpen={() => {}}>{COPY.registerOthers(account.asked)}</RegistrationOpener>\n" +
                "    </DialogFrame>\n" +
                "    <RegistrationForm open={true} onClose={finish} jobs={jobs} tool={{ id: categoryRecordId }} quantity={requested} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-fork>"
        )
    );
    check("  a dismissal taking the notice with it is seen", plantedFork.deleted.join(", "), "unwritten, unlogged");
    check("  a key put in is seen", plantedFork.added.join(", "), "done");
    check("  an address rebuilt from the render is seen", `${plantedFork.readsLocation} ${plantedFork.rebuilt}`, "false 1");
    check("  the router is seen", plantedFork.routed.join(", "), "useRouter, router.replace");
    check("  with no history write", plantedFork.replaced, 0);
    check("  a fork told whatever the address says is seen", plantedFork.told, "account.unwritten > 0");
    check(
        "  a frame open over the registration, closed by an answer that answers nothing, and prompted, is seen",
        plantedFork.frame,
        "open: told · onClose: () => {} · prompted"
    );
    check("  an opening kept by itself is seen", plantedFork.registration, "{ open: false }");
    check(
        "  a gate opened on nothing, naming another count, is seen",
        plantedFork.gate,
        "canRegister: true, onOpen: ArrowFunctionExpression → COPY.registerOthers(account.asked)"
    );
    check(
        "  a form opened on a row of its own making with no catalog, another count and always is seen",
        plantedFork.opens,
        "jobs: jobs, onClose: finish, open: true, quantity: requested, tool: { id: categoryRecordId }"
    );
    check("  the words naming one count and the form handed another are seen", `${plantedFork.offers} | ${plantedFork.handed}`, "account.asked | requested");
    check(
        "  and a title and a sentence counting the wrong things are seen",
        `${plantedFork.titled} · ${plantedFork.message}`,
        "COPY.shortfallHeading(account.asked) · COPY.shortfall(account.unwritten)"
    );

    // THE NOTICE'S HALF (#455, #459). `Got it` is the same act on the other key: the
    // current address, `unlogged` alone out of it, no router. The fork's `asked` and
    // `unwritten` stay, so a reader who takes the notice away is asked the fork's question
    // next. Since #459 it is a dialog told first, closed with `Got it` on the close and on
    // Escape, handing focus to the page's heading, and opening nothing.
    const notice = forkFacts(parseFile(NOTICE));
    check("the notice's dismissal takes exactly `unlogged` out of the address", notice.deleted.join(", "), "unlogged");
    check("  and puts nothing in", notice.added.join(", "), "");
    check("  editing the current address rather than rebuilding one", `${notice.readsLocation} ${notice.rebuilt}`, "true 0");
    check("  written with history.replaceState", notice.replaced, 1);
    check("  never through the router", notice.routed.join(", "), "");
    check("it is told when accountToTell says so", notice.told, 'accountToTell(account, address) === "unlogged"');
    check("  open while it is told, closed as `Got it` closes it, and unprompted", notice.frame, "open: told · onClose: gotIt · unprompted");
    check("  whose one answer is that `Got it`", notice.answers, "gotIt");
    check("  and it opens no registration", `${notice.opens} ${notice.gate}`, "null null");
    // ANTI-VACUITY: a planted notice taking the fork's keys with it, through the router,
    // told whatever the address says, and offering to create them again is seen doing each.
    const plantedNotice = forkFacts(
        parseSource(
            "function RegistrationUnlogged({ account, itemName, jobs }) {\n" +
                "  const router = useRouter();\n" +
                "  const told = account.unlogged.length > 0;\n" +
                "  const dismiss = () => {\n" +
                "    const address = new URL(window.location.href);\n" +
                '    address.searchParams.delete("unlogged");\n' +
                '    address.searchParams.delete("unwritten");\n' +
                "    router.replace(`${address.pathname}${address.search}`);\n" +
                "  };\n" +
                "  return (<>\n" +
                "    <DialogFrame open={told} onClose={dismiss} unprompted><Button onClick={dismiss}>{COPY.gotIt}</Button></DialogFrame>\n" +
                "    <RegistrationForm open={told} onClose={dismiss} jobs={jobs} tool={{ itemName }} quantity={account.unlogged.length} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-notice>"
        )
    );
    check("  a dismissal taking the fork's count with it is seen", plantedNotice.deleted.join(", "), "unlogged, unwritten");
    check("  the router is seen", plantedNotice.routed.join(", "), "useRouter, router.replace");
    check("  a notice told whatever the address says is seen", plantedNotice.told, "account.unlogged.length > 0");
    check(
        "  and an offer to create them again is seen",
        plantedNotice.opens,
        "jobs: jobs, onClose: dismiss, open: told, quantity: account.unlogged.length, tool: { itemName }"
    );

    // THE OPENERS OF THE REGISTRATION DIALOG, ON BOTH SCREENS (#451, #456). A category's page
    // opens it on that category and with no count, in the dialog's own title — `Add items` since
    // #519, `Add tools` from #485 — and the list opens it on no category. Each stands under ONE condition since #506,
    // that the reader is a site manager — the page's `recorder` — and under nothing else: a
    // category with nothing under it keeps its opener, and so does a site manager on no job, whom
    // the opener itself tells why it cannot act (0f). What decides that is one predicate,
    // `canRegisterAssets`, asked by each page and handed down, so no opener answers the
    // reader differently. An opener drawn only beside the list renders this very page on
    // every category this base holds, so none of that shows in a figure and all of it is read
    // off the source. WHICH condition, and not only how many, since #506: a count of one is
    // what an opener gated on the reader's job would read as too.
    const dialogOpeners = (ast) => {
        const found = [];
        const bindings = new Map();
        const skip = new Set(["type", "start", "end", "loc", "range", "parent"]);
        // The keys under which a node's children render only sometimes.
        const branches = {
            ConditionalExpression: ["consequent", "alternate"],
            LogicalExpression: ["right"],
            IfStatement: ["consequent", "alternate"],
        };
        // A condition as it reads, and its negation on the branch taken when it is false.
        const said = (test) => {
            if (!test) return "none";
            if (test.type === "Identifier" || test.type === "MemberExpression") return nameOf(test);
            if (test.type === "Literal") return JSON.stringify(test.value);
            if (test.type === "UnaryExpression") return `${test.operator}${said(test.argument)}`;
            if (test.type === "BinaryExpression" || test.type === "LogicalExpression")
                return `${said(test.left)} ${test.operator} ${said(test.right)}`;
            if (test.type === "CallExpression") return `${nameOf(test.callee)}(…)`;
            return test.type;
        };
        const conditionOf = (node, key) =>
            key === "alternate" ? `!(${said(node.test)})` : node.type === "LogicalExpression" ? said(node.left) : said(node.test);
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.init?.type === "CallExpression")
                bindings.set(n.id.name, nameOf(n.init.callee));
        });
        (function visit(node, under) {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach((child) => visit(child, under));
            if (typeof node.type !== "string") return;
            if (node.type === "JSXOpeningElement" && node.name?.name === "RegistrationDialog") {
                const raw = attributesOf(node, ast).find((a) => a.name === "canRegister")?.value;
                const canRegister = raw?.type === "JSXExpressionContainer" ? raw.expression : raw;
                found.push({
                    handed: dialogProps(node, ast),
                    // What decides whether it may act, followed through a binding the page
                    // asked it into, so a literal and a second predicate both show.
                    asks:
                        canRegister?.type === "CallExpression"
                            ? nameOf(canRegister.callee)
                            : canRegister?.type === "Identifier"
                              ? (bindings.get(canRegister.name) ?? canRegister.name)
                              : nameOf(canRegister ?? {}),
                    conditions: under.length,
                    under: under.join(", ") || "nothing",
                });
            }
            for (const key of Object.keys(node)) {
                if (skip.has(key)) continue;
                visit(node[key], branches[node.type]?.includes(key) ? [...under, conditionOf(node, key)] : under);
            }
        })(ast, []);
        return found;
    };
    // TWO OPENERS EACH SINCE #463, HANDED ONE OBJECT: the head's, under the reader being a site
    // manager alone (#506), and an empty list's second one, bordered, under the branch that
    // draws the empty state as well (1a, 1d). Each hands the job the list stands on since #565.
    const openers = dialogOpeners(parseFile(CATEGORY_SCREEN).ast);
    check("a category's page opens the registration dialog from its head, and from an empty list", openers.length, 2);
    check(
        "  on this tool and its catalog, with no count, in the dialog's own title",
        openers[0]?.handed,
        "canRegister: canRegister, catalog: catalog, category: opened, jobs: assignedJobs, listJobId: listJobId, opener: ASSET_REGISTRATION_COPY.heading"
    );
    check("  asking the one predicate every opener asks", openers[0]?.asks, "canRegisterAssets");
    check("  and under the reader being a site manager alone — not the list's, not a job (#506)", openers[0]?.under, "recorder");
    check(
        "  the empty list's the same opener, bordered, under the empty branch and the same reader",
        `${openers[1]?.handed} | ${openers[1]?.asks} | ${openers[1]?.under}`,
        "canRegister: canRegister, catalog: catalog, category: opened, jobs: assignedJobs, listJobId: listJobId, opener: ASSET_REGISTRATION_COPY.heading, variant: bordered | canRegisterAssets | page.total === 0, recorder"
    );
    // WHAT THE CATEGORY AND THE CATALOG ARE (#507), off their declarations, since `category: opened`
    // above reads alike whatever `opened` is: the row the page read, by the id the action
    // admits and the name its line says — the class it said until #520, and carried unread until
    // #552 — and the catalog the reading admits it from —
    // that one row, while the catalog offers it, as `registrationCatalog` hands a dialog a row,
    // so the second step starts on its levels (#514). And the job is the one the scope stands the
    // list on (#565) — the page's reading of the address, none on all of the reader's jobs — and
    // never the address's own `job`.
    const handedOn = ({ ast, source }) => {
        const declared = {};
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && ["opened", "catalog", "listJobId"].includes(n.id?.name) && !(n.id.name in declared))
                declared[n.id.name] = source.slice(n.init.start, n.init.end).replace(/\s+/g, " ");
        });
        return `${declared.opened ?? "none"} | ${declared.catalog ?? "none"} | ${declared.listJobId ?? "none"}`;
    };
    check(
        "  the tool is the row the page read, the catalog that row while the catalog offers it, and the job the scope's",
        handedOn(parseFile(CATEGORY_SCREEN)),
        "{ id: category.id, itemName: category.itemName } | registrationCatalog([category]) | scope.job?.id ?? null"
    );
    check(
        "  and a page handing a row of its own making, the whole table as its catalog and the address's job, is seen (anti-vacuity)",
        handedOn(parseSource("const opened = { id: sp.tool };\nconst catalog = tools;\nconst listJobId = sp.job;\n", "<planted-handed>")),
        "{ id: sp.tool } | tools | sp.job"
    );
    const listOpeners = dialogOpeners(parseFile(LIST_SCREEN).ast);
    check("the category list opens it from its head, and from an empty list", listOpeners.length, 2);
    // THE CATALOG IS THE WHOLE READ'S (#507), and never the scope's (#509): a kind is the
    // company's, and one off the reader's jobs or with nothing under it is one to add to. And
    // a key since #527, since the page hands it to the list, a client component, among the
    // head's children there. The job is the scope's (#565): the one the list stands on, which
    // the dialog's choice starts on when it is the reader's, and none on all of their jobs.
    check(
        "  on no tool, in the same title, with the whole catalog to pick from — whatever the list's scope (#509, #507)",
        listOpeners[0]?.handed,
        "canRegister: canRegisterAssets(user, allJobs), catalog: registrationCatalog(categories), jobs: assignedJobsFor(user, allJobs).map(…), key: registration, listJobId: scope.job?.id ?? null, opener: ASSET_REGISTRATION_COPY.heading"
    );
    check("  asking the same predicate", listOpeners[0]?.asks, "canRegisterAssets");
    // A READER ON NO JOB MEETS NO OPENER IN THE HEAD (1a2, #522): the design draws the no-job
    // state with the heading alone, where #509 drew the opener locked with why before it.
    check("  and under the reader being a site manager on a job (#506, #522)", listOpeners[0]?.under, "recorder && !onNoJob");
    check(
        "  the empty list's the same opener, bordered, under the empty branch and the same reader",
        `${listOpeners[1]?.handed} | ${listOpeners[1]?.asks} | ${listOpeners[1]?.under}`,
        "canRegister: canRegisterAssets(user, allJobs), catalog: registrationCatalog(categories), jobs: assignedJobsFor(user, allJobs).map(…), listJobId: scope.job?.id ?? null, opener: ASSET_REGISTRATION_COPY.heading, variant: bordered | canRegisterAssets | rows.length === 0, recorder && !onNoJob"
    );
    // The count a suggested tool carried, its link array's length (#456), was held here until
    // #507: a suggestion is a name of the catalog now, beside its category, and how many of a
    // kind there are is its own page's figure alone.
    // ANTI-VACUITY: a planted page carrying an opener in the not-found return, one beside
    // the list only, and one for a reader on a job only is seen doing all three — and the
    // one beside the list is seen handing a record id and a count, saying another word and
    // asking no predicate at all.
    const plantedOpeners = dialogOpeners(
        parseSource(
            "async function renderCategoryPage() {\n" +
                "  if (!tool) return <RegistrationDialog opener={ASSET_REGISTRATION_COPY.heading} canRegister={canRegister} jobs={assignedJobs} tool={{ itemName: name }} />;\n" +
                "  return (<div>\n" +
                "    {page.total === 0 ? <p /> : <RegistrationDialog opener={ASSET_REGISTRATION_COPY.registerOthers} canRegister={true} jobs={assignedJobs} tool={{ itemName: tool.id }} quantity={page.total} />}\n" +
                "    {canRegisterAssets(user, jobs) && <RegistrationDialog opener={ASSET_REGISTRATION_COPY.heading} canRegister={canRegister} jobs={assignedJobs} tool={{ itemName: tool.itemName }} />}\n" +
                "  </div>);\n" +
                "}\n",
            "<planted-opener>"
        ).ast
    );
    check("  three openers are seen as three", plantedOpeners.length, 3);
    check(
        "  each under the condition it is drawn beneath",
        plantedOpeners.map((opener) => opener.conditions).join(", "),
        "1, 1, 1"
    );
    // And named for it (#506), so an opener drawn for a reader on a job reads as that and
    // not as the site manager's one condition.
    check(
        "  and each condition read as it is written, a false branch negated",
        plantedOpeners.map((opener) => opener.under).join(" | "),
        "!tool | !(page.total === 0) | canRegisterAssets(…)"
    );
    check(
        "  a record id, a count and another word are seen handed",
        plantedOpeners[1]?.handed,
        "canRegister: true, jobs: assignedJobs, opener: ASSET_REGISTRATION_COPY.registerOthers, quantity: page.total, tool: { itemName: tool.id }"
    );
    check("  and a literal in place of the predicate is seen", plantedOpeners[1]?.asks, "Literal");

    // ── 2c: this list's page and the document lists' page stay two constants ─
    log("");
    log("the asset lists' page size and the document lists' are two numbers, not one:");
    // FROM #442 BOTH WERE 25, AND #538 IS WHAT THIS CHECK KEPT ONE EDIT: it moved this one
    // to fifty and left the document lists' at 25. They are set for different lists —
    // three short facts a press of the page box selects for printing, against six columns
    // a gate admitted (this said a phone against a monitor, which stopped being true when
    // the asset lists' briefs made them a desk's; corrected per #181). Folding them into
    // one constant makes a change to either move the other, and two numbers that agree
    // are the first thing a pass that names the design's values reaches for — as they
    // may again. So each has to be declared as a number in its own module, and
    // neither module may reach the other: a shared token, an alias and a re-export all
    // fail here. **What retires this** is a design decision that the two are one
    // reader's page, taken where #258 names the design's values — and then this
    // section changes in that commit, with both docstrings and the notes. The values
    // are not pinned here: this one is pinned above, and the document lists derive
    // theirs on purpose (`offline/list-filters.mjs`).
    const declaredAs = (ast, name) => {
        let found = "not declared";
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === name)
                found =
                    n.init?.type === "Literal" && typeof n.init.value === "number" ? "a number" : n.init?.type ?? "empty";
        });
        return found;
    };
    const sourcesNaming = (ast, fragment) => {
        const found = [];
        walk(ast, (n) => {
            if (
                (n.type === "ImportDeclaration" || n.type === "ExportNamedDeclaration" || n.type === "ExportAllDeclaration") &&
                typeof n.source?.value === "string" &&
                n.source.value.includes(fragment)
            )
                found.push(n.source.value);
        });
        return found;
    };
    const assetListAst = parseFile("lib/assetListView.js").ast;
    const listFiltersAst = parseFile("lib/listFilters.js").ast;
    check("ASSET_PAGE_SIZE is declared as a number of its own", declaredAs(assetListAst, "ASSET_PAGE_SIZE"), "a number");
    check("  and LIST_PAGE_SIZE as one of its own", declaredAs(listFiltersAst, "LIST_PAGE_SIZE"), "a number");
    check(
        "  and neither module reaches the other",
        [...sourcesNaming(assetListAst, "listFilters"), ...sourcesNaming(listFiltersAst, "assetListView")].length,
        0
    );
    // ANTI-VACUITY: a fold by a shared token, by an alias of the other and by a
    // re-export are each seen for what they are.
    check(
        "  a shared token reads as a reference, not a number",
        declaredAs(parseSource('import { PAGE_SIZE } from "./tokens.js";\nexport const ASSET_PAGE_SIZE = PAGE_SIZE;\n', "<planted-token>").ast, "ASSET_PAGE_SIZE"),
        "Identifier"
    );
    check(
        "  a re-export reads as no declaration at all",
        declaredAs(parseSource('export { PAGE_SIZE as ASSET_PAGE_SIZE } from "./tokens.js";\n', "<planted-reexport>").ast, "ASSET_PAGE_SIZE"),
        "not declared"
    );
    check(
        "  and a module reaching the other is seen reaching it",
        sourcesNaming(parseSource('import { LIST_PAGE_SIZE } from "./listFilters.js";\n', "<planted-reach>").ast, "listFilters").length,
        1
    );

    // ── 2d: what a press makes of the selection, and when print acts (#443) ─
    log("");
    log("a box selects one entry, the page box this page, and print acts on what one print takes:");
    // Printed ids typed out, three on this page and one that is not — which is the
    // shape every claim below is about, since a selection outlives a page turn.
    const A = "HYE-AST-260909-001";
    const B = "HYE-AST-260909-002";
    const C = "HYE-AST-260909-003";
    const ELSEWHERE = "HYE-AST-260910-001";
    const thisPage = [A, B, C];

    // ASCENDING ID, WHATEVER ORDER THE BOXES WERE PRESSED IN — the order a run prints in,
    // which was the list's own until #463 turned the list newest first and left the
    // selection as it was. ELSEWHERE is a later day, so it sorts after the page even when
    // it was selected first.
    check("a press adds an entry, in ascending id", toggleAsset([ELSEWHERE], B).join(), `${B},${ELSEWHERE}`);
    check("  a second press takes it out again", toggleAsset([B, ELSEWHERE], B).join(), ELSEWHERE);
    check("  and what is left is in ascending id too", toggleAsset([C, A, B], A).join(), `${B},${C}`);
    // BY THE SEQUENCE AS A NUMBER: a day's thousandth asset follows its 999th, where
    // a sort of the strings would put `-1000` first.
    check(
        "a four-digit sequence follows a three-digit one",
        toggleAsset(["HYE-AST-260909-999"], "HYE-AST-260909-1000").join(),
        "HYE-AST-260909-999,HYE-AST-260909-1000"
    );
    check("  and a string that is no id goes last", toggleAsset(["ABC"], A).join(), `${A},ABC`);

    check("this page with none of it selected", pageSelection([ELSEWHERE], thisPage), "none");
    check("  with some of it", pageSelection([B, ELSEWHERE], thisPage), "some");
    check("  with all of it, whatever else is selected", pageSelection([ELSEWHERE, C, A, B], thisPage), "all");
    check("  and a page with no entries has nothing selected", pageSelection([ELSEWHERE], []), "none");

    check(
        "the page box on a page with none selected adds the page",
        togglePage([ELSEWHERE], thisPage).join(),
        `${A},${B},${C},${ELSEWHERE}`
    );
    check(
        "  on a page partly selected it adds the rest and takes nothing out",
        togglePage([C, ELSEWHERE], thisPage).join(),
        `${A},${B},${C},${ELSEWHERE}`
    );
    check(
        "  on a page all selected it takes this page out and keeps the other",
        togglePage([A, ELSEWHERE, B, C], thisPage).join(),
        ELSEWHERE
    );
    // Two left over, arriving out of order as a hand-typed address can, so the order of
    // what is left is a fact this asserts rather than one a single survivor hides.
    const LATER = "HYE-AST-260911-001";
    check(
        "  and what it keeps is in ascending id",
        togglePage([LATER, A, B, C, ELSEWHERE], thisPage).join(),
        `${ELSEWHERE},${LATER}`
    );

    // NOTHING SELECTED DRAWS NO BAR (#463, 0b), so there is no sentence for it and no reason:
    // the bar comes with the first box pressed.
    const noneSelected = describeSelection([], thisPage);
    check("nothing selected: print does not act", noneSelected.printable, false);
    check("  and there is no bar to say anything", `${noneSelected.count} ${noneSelected.reason}`, "0 null");
    check("one selected: print acts", describeSelection([B], thisPage).printable, true);
    check("  and the bar says how many", ASSET_LIST_COPY.selectedCount(describeSelection([B], thisPage).count), "1 selected");
    // Two on this page and one not, so the two counts differ: with one of each, a count
    // of the entries ON this page would read the same here — the one-selected case
    // above catches that swap too, so this is a second path to the claim.
    const across = describeSelection([A, ELSEWHERE, B], thisPage);
    check(
        "some of them not on this page: it says how many are not, after the count",
        `${ASSET_LIST_COPY.selectedCount(across.count)} · ${ASSET_LIST_COPY.notOnPage(across.notOnPage)}`,
        "3 selected · 1 not on this page"
    );
    check("  and counts them", describeSelection([A, ELSEWHERE, B], thisPage).notOnPage, 1);

    // THE CAP'S TWO SIDES, AT LITERAL SIZES, WITH EACH INPUT'S SIZE ASSERTED FIRST. The
    // boundary this is about is DISTINCT ids after the address is read, so the inputs are
    // built through `readAssetIds` and counted before anything is asked of them — a
    // fixture that collapsed to fewer ids would otherwise ask about the wrong side of the
    // edge and pass, which is what #442 found a twelve-row fixture doing to a page size.
    const distinctIds = (n) =>
        readAssetIds(Array.from({ length: n }, (_, at) => `HYE-AST-260909-${String(at + 1).padStart(3, "0")}`));
    const hundred = distinctIds(100);
    const hundredAndOne = distinctIds(101);
    check("a hundred distinct ids read as a hundred", hundred.length, 100);
    check("  and a hundred and one as a hundred and one", hundredAndOne.length, 101);
    check("a selection of a hundred prints", describeSelection(hundred, thisPage).printable, true);
    check("  and one of a hundred and one does not", describeSelection(hundredAndOne, thisPage).printable, false);
    check("  and says why before the control", describeSelection(hundredAndOne, thisPage).reason, "Up to 100 labels per print.");
    check("  where one it takes has no reason", describeSelection(hundred, thisPage).reason, null);
    // The same edge from the address's side: a hundred and one values holding a repeat
    // are a hundred assets, and print.
    const withRepeat = readAssetIds([...hundred, hundred[0].toLowerCase()]);
    check("a hundred and one values with one repeat read as a hundred", withRepeat.length, 100);
    check("  and print", describeSelection(withRepeat, thisPage).printable, true);

    // The address a page of this list lives at moved to lib/assetRoutes.js in
    // #348, with every other address on the axis; `offline/asset-routes.mjs`
    // holds it now.

    // ── 2e: the category list's pages, and the frame both lists are drawn in (#463)
    log("");
    log("the category list pages its rows as a category's own list does, and both are drawn in one frame:");
    // THE CATEGORY LIST PAGES AT THE SAME SIZE BY THE SAME CLAMP, over rows the page already built:
    // reassembly over the lengths around both edges, and the window both lists share.
    const rowsOf = (n) => Array.from({ length: n }, (_, at) => ({ id: `rec${at}` }));
    const listLengths = [0, 1, 49, 50, 51, 99, 100, 101];
    const reassembled = listLengths.filter((n) => {
        const first = pageOfAssetCategories(rowsOf(n), 1);
        const pages = Array.from({ length: first.pageCount }, (_, at) => pageOfAssetCategories(rowsOf(n), at + 1).rows.map((row) => row.id));
        return pages.flat().join() === rowsOf(n).map((row) => row.id).join() && first.pageCount === Math.max(1, Math.ceil(n / 50));
    });
    check("the category list's pages are the whole list, at every length around the edges", reassembled.join(), listLengths.join());
    const second = pageOfAssetCategories(rowsOf(80), "2");
    check("  page 2 of 80 shows the 51st to the 80th", `${second.page}/${second.pageCount} ${second.from}–${second.to} of ${second.total}`, "2/2 50–80 of 80");
    check("  a page past the end is the last, and an unreadable one the first", `${pageOfAssetCategories(rowsOf(51), "9").page} ${pageOfAssetCategories(rowsOf(51), "x").page}`, "2 1");
    const disagreements = [];
    for (const n of [0, 1, 50, 51, 101])
        for (const asked of ["1", "2", "3", "x"]) {
            const categories = pageOfAssetCategories(rowsOf(n), asked);
            const items = pageOfAssets(rowsOf(n).map((row) => row.id), asked);
            if (`${categories.page} ${categories.pageCount} ${categories.from} ${categories.to}` !== `${items.page} ${items.pageCount} ${items.from} ${items.to}`) disagreements.push(`${n}/${asked}`);
        }
    check("  and the two lists' windows agree at every length and page asked", disagreements.join(), "");

    // THE LIST CUTS THE ROWS THE BAND LEFT BY THE PAGE THE ADDRESS ASKS FOR (#520), in the
    // browser, and steps by writing the address with what the band holds and the job — a press
    // that fetches nothing. No pager stands under a list the band has emptied.
    const listScreen = parseFile(CATEGORY_LIST);
    let pagedWith = "none";
    walk(listScreen.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.name === "pageOfAssetCategories") pagedWith = n.arguments.map((a) => listScreen.source.slice(a.start, a.end)).join(", ");
    });
    check("the category list cuts the rows the band left by the page asked for", pagedWith, 'reading.rows, params.get("page")');
    check(
        "  draws the page's rows, and steps by writing the address with the band and the job (#520)",
        `${/\{page\.rows\.map\(\(row\) =>/.test(listScreen.source)} ${propSources(listScreen, "Pager", "previous").join()} ${propSources(listScreen, "Pager", "next").join()} ${/const write = \(filters, toPage = 1\) => window\.history\.replaceState\(null, "", assetCategoriesPath\(toPage, job, filters\)\);/.test(listScreen.source)}`,
        "true {{ onPress: page.page > 1 ? () => write(reading.held, page.page - 1) : undefined, label: COPY.previous }} {{ onPress: page.page < page.pageCount ? () => write(reading.held, page.page + 1) : undefined, label: COPY.next }} true"
    );
    check(
        "  and draws no pager under a list the band has emptied",
        propSources(listScreen, "ListFrame", "footer").map((f) => /^\{\s*!emptied && \(\s*<Pager/.test(f)).join(),
        "true"
    );
    // A list on a job with nothing on it draws no pager, and a band holding the job's chip alone, at
    // the start of the band where the list with rows draws it (1a2, #566).
    const emptyPage = parseFile(LIST_SCREEN).source;
    check(
        "  nor a list on a job with nothing on it, whose band holds the job's chip alone (1a2, #566)",
        [
            /if \(rows\.length === 0\) \{\s*return \(\s*<ListFrame\s+header=/.test(emptyPage),
            (emptyPage.match(/band=/g) ?? []).length,
            /<\/ListHeader>\s*\}\s*band=\{choosable && <JobChoice jobs=\{choosable\} job=\{job\} \/>\}\s*>/.test(emptyPage),
            /footer=/.test(emptyPage),
        ].join(" · "),
        "true · 1 · true · false"
    );

    // A CATEGORY'S LIST FLOATS THE BAR WHILE ANYTHING IS SELECTED, and hands the print control
    // what the selection makes of it, the reason with it.
    const itemList = parseFile(ASSET_LIST);
    check(
        "the tool's list shows the bar while anything is selected, and the end room with it",
        `${propSources(itemList, "SelectionBar", "shown").join()} ${propSources(itemList, "ListFrame", "overlayShown").join()} ${/const selecting = summary\.count > 0;/.test(itemList.source)}`,
        "{selecting} {selecting} true"
    );
    check(
        "  and its print control acts on what one print takes, pointing at the reason the bar draws (#495)",
        `${propSources(itemList, "LabelsDialog", "disabled").join()} ${propSources(itemList, "LabelsDialog", "describedBy").join()} ${propSources(itemList, "LabelsDialog", "assetIds").join()} ${propSources(itemList, "LabelsDialog", "disabledReason").length}`,
        "{!summary.printable} {summary.reason ? reasonId : undefined} {selection} 0"
    );
    check(
        "  which the bar is handed with the id it draws it under",
        `${propSources(itemList, "SelectionBar", "reason").join()} ${propSources(itemList, "SelectionBar", "reasonId").join()}`,
        "{summary.reason} {reasonId}"
    );
    check(
        "  the page box shows this page all, some or none, by the page box's name",
        `${propSources(itemList, "Checkbox", "checked").join(" | ")} ~ ${propSources(itemList, "Checkbox", "indeterminate").join()} ~ ${propSources(itemList, "Checkbox", "label").join(" | ")}`,
        "{pageState === \"all\"} | {selected} ~ {pageState === \"some\"} ~ {COPY.selectPage} | {COPY.selectAsset(row.assetId)}"
    );
    check(
        "  and both steps carry the selection and the job (#509)",
        `${propSources(itemList, "Pager", "previous").join()} ${propSources(itemList, "Pager", "next").join()}`,
        "{{ href: page.page > 1 ? assetCategoryPath(categoryRecordId, page.page - 1, selection, { job }) : null, label: COPY.previous }} {{ href: page.page < page.pageCount ? assetCategoryPath(categoryRecordId, page.page + 1, selection, { job }) : null, label: COPY.next }}"
    );

    // THE FRAME: one lane that holds the rows and stops at its end, a pager whose ground
    // says whether rows run beneath it, and end room that grows by the bar's height.
    const frame = parseFile(LIST_FRAME);
    const frameSource = functionSource(frame, "ListFrame");
    check(
        "the frame marks its root for the column, and scrolls the list in a lane of its own that stops at its end",
        `${/data-list-frame=""/.test(frameSource)} ${/overflow-y-auto overscroll-y-contain \[scrollbar-gutter:stable\] \$\{SCROLL_LANE\}/.test(frameSource)}`,
        "true true"
    );
    check(
        "  rows run beneath the pager until the lane is at its end",
        /function rowsRunBeneath\(lane\) \{\s*return lane\.scrollTop \+ lane\.clientHeight < lane\.scrollHeight - 1;\s*\}/.test(frame.source) && /setBeneath\(rowsRunBeneath\(lane\)\)/.test(frameSource),
        true
    );
    check(
        "  which is when its ground is the Sticky one under a Band, and plain white with no rule otherwise",
        /beneath \? "border-divider-strong bg-background-translucent backdrop-blur-sm" : "border-transparent bg-white"/.test(frameSource),
        true
    );
    check("  and the rows end on the pager's height, and the bar's too while it stands", /className=\{overlayShown \? END_ROOM_WITH_BAR : END_ROOM\}/.test(frameSource), true);
    const rail = parseFile(RAIL);
    check(
        "the column holding a list scrolls nothing and reserves no lane",
        /sm:has-\[>\[data-list-frame\]\]:overflow-y-hidden sm:has-\[>\[data-list-frame\]\]:\[scrollbar-gutter:auto\]/.test(rail.source),
        true
    );
    const barSource = functionSource(frame, "SelectionBar");
    check(
        "the bar clears the selection on Escape, unless a dialog is open to close first",
        /if \(event\.key !== "Escape" \|\| event\.defaultPrevented \|\| document\.querySelector\("dialog\[open\]"\)\) return;\s*onClear\(\);/.test(barSource),
        true
    );
    check("  and while it does not show it cannot be reached", /inert=\{!shown\}/.test(barSource), true);
    // CENTERED FROM THE LIST'S MIDDLE, IT TAKES ITS CONTENT'S WIDTH (#495): a box set from the
    // middle and left to size itself is held to the half beyond it, which cut a past-100 bar.
    check("  at its content's width, which a box set from the list's middle does not take by itself (#495)", /absolute bottom-full left-1\/2 mb-selection-bar-offset flex w-max -translate-x-1\/2/.test(barSource), true);
    // AN ACTION THE SELECTION IS TOO LARGE FOR SAYS WHY BEFORE IT (0b, #495): 14 before the
    // actions, led by a 16 info mark 6 before it in Ink 3, in a column that opens and closes
    // as the second clause does and keeps its words while it closes.
    check(
        "the bar draws an action's reason 14 before the actions, led by the info mark in Ink 3, 6 from it (#495)",
        [
            /gap-selection-bar-reason-gap whitespace-nowrap pr-gap-lg/.test(barSource),
            /<InfoMark size="size-icon" tone="subtle" \/>/.test(barSource),
            /<span id=\{reasonId\} className="text-body-sm text-foreground-subtle tabular-nums">\s*\{lastReason\}/.test(barSource),
        ].join(" "),
        "true true true"
    );
    // ITS FIGURE IS TABULAR (#522), as 1d sets the `100` in `Up to 100 labels per print.`: 0h's
    // every run of figures. The sentence's other words take nothing from it.
    check(
        "the bar's reason sets its figure tabular, as 1d draws it (#522)",
        /<span id=\{reasonId\} className="[^"]*\btabular-nums\b[^"]*">/.test(barSource),
        true
    );
    check(
        "  opening and closing as the second clause does, its words kept while it closes",
        [
            /reason \? "grid-cols-\[1fr\] opacity-100" : "grid-cols-\[0fr\] opacity-0"/.test(barSource),
            /aria-hidden=\{reason \? undefined : true\}/.test(barSource),
            /if \(reason && reason !== lastReason\) setLastReason\(reason\);/.test(barSource),
        ].join(" "),
        "true true true"
    );
    const table = parseFile(LIST_TABLE);
    check(
        "a step at its end is drawn and does not act, and a step with somewhere to go is a link",
        /if \(!href\) \{\s*return \(\s*<button type="button" disabled aria-label=\{label\}/.test(functionSource(table, "PagerStep")) && /<Link href=\{href\} aria-label=\{label\}/.test(functionSource(table, "PagerStep")),
        true
    );
    const checkbox = functionSource(parseFile(CONTROLS), "Checkbox");
    check(
        "the box is the browser's own checkbox under the drawing, named, its mixed state set on the element",
        `${/type="checkbox"/.test(checkbox)} ${/aria-label=\{label\}/.test(checkbox)} ${/if \(box\) box\.indeterminate = indeterminate;/.test(checkbox)}`,
        "true true true"
    );

    // WHAT STANDS OVER WHAT (#501). A row is its own stacking context, so the box it lifts
    // over the link that covers it rises inside the row and stays under the column head; the
    // pager, which the selection bar is drawn in, takes the head's z-index after the lane, so
    // it is the one on top where the two meet; and the rail's Panel covers them all. Until
    // #501 a row was no context of its own, and every row's box — at the head's z-index and
    // later in the document — drew over the head as its row scrolled under it.
    const stackingOf = ({ table: tableFile, frame: frameFile, rail: railFile, controls: controlsFile }) => {
        const constant = (parsed, name) => {
            let value = "";
            walk(parsed.ast, (n) => {
                if (n.type === "VariableDeclarator" && n.id?.name === name && n.init?.type === "Literal") value = String(n.init.value);
            });
            return value.split(/\s+/).filter(Boolean);
        };
        // The classes of the first JSX element under `node` that `picks` takes — a string, or a
        // template's fixed text — with where the element starts in its file.
        const classesOf = (parsed, picks, node = parsed.ast) => {
            let found = null;
            walk(node, (n) => {
                if (found || n.type !== "JSXElement" || !picks(n)) return;
                const value = n.openingElement.attributes.find((a) => a.name?.name === "className")?.value;
                const expression = value?.type === "JSXExpressionContainer" ? value.expression : value;
                const text =
                    expression?.type === "Literal"
                        ? String(expression.value)
                        : expression?.type === "TemplateLiteral"
                          ? expression.quasis.map((q) => q.value.cooked).join(" ")
                          : "";
                found = { tokens: text.split(/\s+/).filter(Boolean), start: n.start };
            });
            return found ?? { tokens: [], start: -1 };
        };
        const named = (name) => (n) => n.openingElement.name?.name === name;
        const holding = (parsed, text) => (n) => parsed.source.slice(n.openingElement.start, n.openingElement.end).includes(text);
        const layer = (tokens) => Number(tokens.find((t) => /^z-\d+$/.test(t))?.slice(2) ?? NaN);
        let checkboxFn = null;
        walk(controlsFile.ast, (n) => {
            if (n.type === "FunctionDeclaration" && n.id?.name === "Checkbox") checkboxFn = n;
        });
        const box = classesOf(controlsFile, named("label"), checkboxFn ?? {});
        const cover = constant(tableFile, "TABLE_ROW_LINK");
        const head = constant(tableFile, "TABLE_HEAD");
        const pager = classesOf(frameFile, holding(frameFile, "PAGER_OVER_ROWS"));
        const lane = classesOf(frameFile, holding(frameFile, "ref={laneRef}"));
        const nav = classesOf(railFile, named("nav"));
        // What holds at the top of the lane (#519): 1d's bar and 1a's head.
        const held = [classesOf(frameFile, holding(frameFile, "ref={topRef}")), classesOf(frameFile, holding(frameFile, 'backdrop-blur-sm">'))];
        return {
            row: constant(tableFile, "TABLE_ROW").includes("isolate"),
            box: `${box.tokens.includes("relative")} ${layer(box.tokens) > 0} ${cover.includes("after:absolute")} ${cover.some((t) => /(^|:)z-/.test(t))}`,
            head: `${head.includes("sticky")} ${layer(head) > 0}`,
            pager: `${pager.tokens.includes("relative")} ${layer(pager.tokens) === layer(head)} ${lane.start >= 0 && pager.start > lane.start}`,
            panel: layer(nav.tokens) > Math.max(layer(head), layer(pager.tokens), ...held.map((h) => layer(h.tokens) || 0)),
        };
    };
    const stack = stackingOf({ table, frame, rail, controls: parseFile(CONTROLS) });
    check("a row is a stacking context of its own, so what it lifts rises inside it and no further (#501)", stack.row, true);
    check("  where the box stands over the link that covers the row, which lifts nothing", stack.box, "true true true false");
    check("the column head holds at the top of the rows, over them", stack.head, "true true");
    check("  the pager over it at its z-index, after the lane, so on top where the two meet", stack.pager, "true true true");
    check("  and the rail's Panel over all of them, what holds at the top of the list too (#519)", stack.panel, true);
    // Anti-vacuity: the reading sees each of those undone in a planted list. The lifted cover
    // is assembled while this runs, so no whole class of it is in a file Tailwind scans.
    const liftedCover = ["after:", "z-10"].join("");
    const plantedStack = stackingOf({
        table: parseSource(
            'export const TABLE_HEAD = "sticky top-0 z-10";\n' +
                'export const TABLE_ROW = "relative box-content";\n' +
                `export const TABLE_ROW_LINK = "after:absolute after:inset-0 ${liftedCover}";`,
            "<planted ListTable>"
        ),
        frame: parseSource(
            "export default function ListFrame() { return <div><div className={`relative z-20 ${PAGER_OVER_ROWS}`} /><div ref={laneRef} /></div>; }",
            "<planted ListFrame>"
        ),
        rail: parseSource('export default function Rail() { return <nav className="absolute z-10" />; }', "<planted Rail>"),
        controls: parseSource('export function Checkbox() { return <label className="flex" />; }', "<planted Controls>"),
    });
    check("  a row that is no context of its own is seen", plantedStack.row, false);
    check("  a box that lifts nothing over a cover that lifts itself is seen", plantedStack.box, "false false true true");
    check("  a pager off the head's layer and before the lane is seen", plantedStack.pager, "true false false");
    check("  and one the rail's Panel does not cover", plantedStack.panel, false);

    // ONE LINE, AND THE FIGURE ALONE ON THE SCREEN (0n, #505). The head is the title and, 8 on
    // along its baseline, the figure at Ink 3, its noun said to assistive tech alone — and
    // under that line a caption where a page hands one, which a category's page does (#507); 32 above
    // it, or the breadcrumb bar's 14 where one stands over it, which the category's page alone
    // says. The pager is 60, its rule counted in the 12 above its controls, and the rows end
    // on that. Under the pointer the bar's clear lifts its Ink 3 to Ink, and a breadcrumb
    // level keeps its Ink 2, a target set in text (0f). Read through one function, so a
    // planted list is judged the same way.
    const headOf = ({ table: tableFile, frame: frameFile, crumb, categoryScreen, listScreen: listFile }) => {
        const header = functionSource(tableFile, "ListHeader");
        const pager = functionSource(tableFile, "Pager");
        let level = "";
        walk(crumb.ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === "LEVEL" && n.init?.type === "Literal") level = String(n.init.value);
        });
        return {
            // The title's line, and under it a caption alone, drawn only where a page hands one
            // (#507) — the control on the right kept centered on the title's line either way.
            line: `${/<div className="flex min-w-0 items-baseline gap-list-count-inline">/.test(header)} ${/<div className="flex min-w-0 flex-col gap-title-stack">\s*<div className="flex min-w-0 items-baseline gap-list-count-inline">[\s\S]*?<\/p>\s*\)\}\s*<\/div>\s*\{caption\}\s*<\/div>/.test(header)}`,
            // The figure stands only where the page hands one (#519): a reader on no job's head
            // is its title alone.
            countGiven: /\{count != null && \(\s*<p className="shrink-0 text-body tabular-nums text-foreground-subtle">/.test(header),
            centered:
                /caption \? "items-start" : "items-center"/.test(header) &&
                /<div className="flex shrink-0 items-center gap-gap">\{children\}<\/div>/.test(header) &&
                !/-mt-/.test(header),
            figure: /<p className="shrink-0 text-body tabular-nums text-foreground-subtle">\s*\{count\}\s*<span className="sr-only">\{` \$\{noun\}`\}<\/span>\s*<\/p>/.test(header),
            top: /underBreadcrumb \? "pt-breadcrumb-stack" : "min-h-\(--height-control-lg\) pt-list-header-inset-top"/.test(header) && /pb-list-header-inset-bottom/.test(header),
            under: `${propSources(categoryScreen, "ListHeader", "underBreadcrumb").join()}|${propSources(listFile, "ListHeader", "underBreadcrumb").join()}`,
            pager: /pt-\[calc\(var\(--spacing-pager-inset-top\)-1px\)\] pb-pager-inset-bottom/.test(pager),
            endRoom: /const END_ROOM = "h-\[calc\(var\(--spacing-pager-inset-top\)\+var\(--height-control\)\+var\(--spacing-pager-inset-bottom\)\)\]";/.test(frameFile.source),
            clear: /rounded-control text-foreground-subtle hover:bg-hover hover:text-foreground-default"/.test(functionSource(frameFile, "SelectionBar")),
            level: `${level.includes("text-foreground-muted")} ${level.includes("hover:bg-hover")} ${!/hover:text-/.test(level)}`,
        };
    };
    const crumbFile = parseFile("app/components/Breadcrumb.js");
    const head = headOf({ table, frame, crumb: crumbFile, categoryScreen: parseFile(CATEGORY_SCREEN), listScreen });
    check("a list's head is one line, the count on the title's baseline 8 on (#505), a caption alone under it (#507)", head.line, "true true");
    check("  its control centered on the title's line, or level with the title's top over a caption (#538)", head.centered, true);
    check("  the figure alone at Ink 3, its noun said to assistive tech alone", head.figure, true);
    check("  and drawn only where the page hands one, a head with nothing to count its title alone (#519)", head.countGiven, true);
    check("  32 above it, or the breadcrumb's 14, and 18 under it — and with no bar over it at least a 36 control's line (#519)", head.top, true);
    check("  the breadcrumb's on the category's page and not on the list", head.under, "true|");
    check("the pager is 60, its rule counted in the 12 above its controls (#505)", head.pager, true);
    check("  and the rows end on that", head.endRoom, true);
    check("the bar's clear lifts to Ink under the pointer (#505)", head.clear, true);
    check("  and a breadcrumb level keeps its Ink 2, taking the Hover face alone", head.level, "true true true");
    const plantedHead = headOf({
        table: parseSource(
            'export function ListHeader() { return <div className="flex min-w-0 flex-col gap-title-stack"><p className="text-body">{count} {noun}</p></div>; }\n' +
                'export function Pager() { return <div className="pt-pager-inset-top pb-pager-inset-bottom" />; }',
            "<planted ListTable>"
        ),
        frame: parseSource(
            'const END_ROOM = "h-[calc(var(--spacing-pager-inset-top)+var(--height-control))]";\n' +
                'export function SelectionBar() { return <button className="rounded-control text-foreground-subtle hover:bg-hover" />; }',
            "<planted ListFrame>"
        ),
        crumb: parseSource('const LEVEL = "text-foreground-muted hover:bg-hover hover:text-foreground-default";', "<planted Breadcrumb>"),
        categoryScreen: parseSource("export default function Page() { return <ListHeader title={t} />; }", "<planted tool page>"),
        listScreen: parseSource("export default function Page() { return <ListHeader title={t} underBreadcrumb />; }", "<planted list>"),
    });
    check("  a two-line head is seen", plantedHead.line, "false false");
    check("  a control left to the head's own centering is seen", plantedHead.centered, false);
    check("  a noun drawn beside the figure is seen", plantedHead.figure, false);
    check("  a head with neither top is seen", plantedHead.top, false);
    check("  the breadcrumb's top on the wrong screen is seen", plantedHead.under, "|true");
    check("  a pager with its rule outside its 12 is seen", plantedHead.pager, false);
    check("  rows ending short of it are seen", plantedHead.endRoom, false);
    check("  a clear that keeps Ink 3 is seen", plantedHead.clear, false);
    check("  and a level that lifts is seen", plantedHead.level, "true true false");

    // ── 2f: which job a reader's lists stand on (#509, #520) ─────────────────
    log("");
    log("a list starts on one job, the first of the reader's by its code until they move:");
    // Three jobs out of their codes' order, the third with nothing on it, over the three
    // categories above — the third of those with nothing under it at all. `i1`–`i4` are the
    // assets `ITEMS` holds.
    const JOBS = [
        { id: "recJ2", jobCode: "26-B", assets: ["i3", "i4"] },
        { id: "recJ3", jobCode: "26-C", assets: [] },
        { id: "recJ1", jobCode: "26-A", assets: ["i1", "i2"] },
    ];
    const office = { isAdmin: true, assignedJobs: ["recJ2"] };
    const site = { isAdmin: false, assignedJobs: ["recJ3", "recJ1"] };
    const said = (scope) => [...scope].join(",");
    const named = (categories) => categories.map((category) => category.id).join(",");
    const jobsOf = (scope) => scope.jobs.map((job) => job.jobCode).join(",");

    // THE OFFICE MAY STAND ON EVERY JOB AND STARTS ON THE FIRST BY ITS CODE, its own assignment
    // notwithstanding. #509 started it from every asset there was, `null`, which went with
    // `All jobs` (#520).
    const whole = assetListScope(office, JOBS, undefined);
    check("the office may stand on every job, by its code, one with nothing on it included", jobsOf(whole), "26-A,26-B,26-C");
    check("  starts on the first, its assignment notwithstanding", `${whole.job?.jobCode} ${said(whole.shown)}`, "26-A i1,i2");
    check("  and lists the categories with an asset there, the one with none left off (#507)", named(assetCategoriesInScope(CATEGORIES, whole.shown)), "recGrinder");
    // ANYBODY ELSE MAY STAND ON THEIR OWN JOBS, AND STARTS ON THE FIRST OF THOSE.
    const own = assetListScope(site, JOBS, undefined);
    check("anybody else may stand on their own jobs, by their code, one with nothing on it included", jobsOf(own), "26-A,26-C");
    check("  starts on the first of them, not on their jobs together", `${own.job?.jobCode} ${said(own.shown)}`, "26-A i1,i2");
    // A CODE'S FIGURES ARE READ AS NUMBERS, so a tenth job comes after a ninth.
    const tenth = assetListScope({ isAdmin: true }, [
        { id: "recT", jobCode: "26-USA-10", assets: [] },
        { id: "recN", jobCode: "26-USA-9", assets: [] },
    ]);
    check("  a code's figures read as a number", jobsOf(tenth), "26-USA-9,26-USA-10");
    // A JOB ASKED FOR IS STOOD ON, ONE WITH NOTHING ON IT INCLUDED.
    const officeOnB = assetListScope(office, JOBS, "recJ2");
    check("the office on a job holds that job's assets", `${officeOnB.job?.jobCode} ${said(officeOnB.shown)}`, "26-B i3,i4");
    check("  and lists the categories with one there, the empty category left off", named(assetCategoriesInScope(CATEGORIES, officeOnB.shown)), "recGrinder,recDriver");
    const siteOnC = assetListScope(site, JOBS, "recJ3");
    check("a job with nothing on it is stood on, and lists no category", `${siteOnC.job?.jobCode} ${named(assetCategoriesInScope(CATEGORIES, siteOnC.shown))}|`, "26-C |");
    // THE JOB ASKED FOR IS A REQUEST: one off the reader's list, one that is no job and a
    // repeated parameter are all answered with the first job, as no job asked is (#520) — the
    // whole of the reader's jobs from #509.
    const asked = (raw) => {
        const scope = assetListScope(site, JOBS, raw);
        return `${scope.job?.jobCode} ${said(scope.shown)}`;
    };
    check("a job off the reader's list is answered with the first", asked("recJ2"), "26-A i1,i2");
    check("  so is one that is no job", asked("recNope"), "26-A i1,i2");
    check("  and a repeated parameter", asked(["recJ3"]), "26-A i1,i2");
    // THE FLAG ALONE: a President who is not marked Admin stands on their own jobs.
    const president = assetListScope({ role: "President", isAdmin: false, assignedJobs: ["recJ2"] }, JOBS);
    check("a President not marked Admin stands on their own jobs", `${jobsOf(president)} ${said(president.shown)}`, "26-B i3,i4");
    const nobody = assetListScope({ isAdmin: false }, JOBS);
    check("  and a reader on no job on nothing", `${nobody.job}|${jobsOf(nobody)}|${said(nobody.shown)}|`, "null|||");
    // A CATEGORY'S OWN LIST IS CUT IN THE LINK ARRAY'S ORDER, BEFORE ANY READ.
    check("ids on the job keep their own order", idsInScope(["i2", "i9", "i1"], own.shown).join(), "i2,i1");
    check("  so a category's page counts only those", pageOfAssets(idsInScope(["i1", "i3", "i2"], own.shown), 1).total, 2);
    // THE COUNTS ARE OVER THE JOB'S ASSETS ALONE.
    const narrowedRows = summarizeAssetCategories(
        assetCategoriesInScope(CATEGORIES, officeOnB.shown),
        ITEMS.filter((item) => officeOnB.shown.has(item.id))
    );
    check(
        "a list counts its job's assets and no other",
        narrowedRows.map((row) => `${row.itemName}:${row.counts.map((c) => c.count).join("/")}`).join(" "),
        "angle grinder:1/0/0/0 Impact Driver:0/0/0/1"
    );

    // BOTH SCREENS ASK THE ONE JUDGMENT, BEFORE ANY ASSET IS READ — the list for which
    // categories and which of their assets, a category's page for which of its assets — which
    // no figure shows, so it is read off the source.
    const scopeUse = (parsed) => {
        const calls = {};
        walk(parsed.ast, (n) => {
            if (n.type !== "CallExpression") return;
            const callee = n.callee?.name;
            if (!["assetListScope", "assetCategoriesInScope", "idsInScope", "pageOfAssets"].includes(callee)) return;
            const args = n.arguments.map((a) => parsed.source.slice(a.start, a.end)).join(", ");
            (calls[callee] ||= []).push(args);
        });
        return Object.keys(calls)
            .sort()
            .map((name) => `${name}(${calls[name].join(" | ")})`)
            .join(" ");
    };
    check(
        "the tool list asks the one judgment, and reads and counts by it",
        scopeUse(parseFile(LIST_SCREEN)),
        "assetCategoriesInScope(categories, scope.shown) assetListScope(user, allJobs, sp.job) idsInScope(category.assets, scope.shown)"
    );
    check(
        "  and a tool's page the same one, cutting its page from it",
        scopeUse(parseFile(CATEGORY_SCREEN)),
        "assetListScope(user, jobs, sp.job) idsInScope(category.assets, scope.shown) pageOfAssets(idsInScope(category.assets, scope.shown), sp.page)"
    );
    // ANTI-VACUITY: a planted page paging the whole link array and counting with no scope is
    // seen doing it.
    check(
        "  a page ignoring the scope is seen",
        scopeUse(parseSource("const page = pageOfAssets(tool.assets, sp.page);\nconst rows = assetCategoriesInScope(tools, null);\n", "<planted-scope>")),
        "assetCategoriesInScope(tools, null) pageOfAssets(tool.assets, sp.page)"
    );

    // ── 3: the words ────────────────────────────────────────────────────────
    log("");
    log("every word both screens say is in the constant:");
    const strings = copyStrings();
    assert(`the constant holds ${strings.length} strings`, strings.length >= 10);
    check("none is empty", strings.filter((s) => !s.trim()).length, 0);
    check(
        "no string says `kind`",
        strings.filter((s) => /\bkinds?\b/i.test(s)).length,
        0
    );
    // THE SWEEP'S CLAIM (#455): nothing here says the noun the design replaced.
    check(
        "no string says `tool item`",
        strings.filter((s) => TOOL_ITEM_NOUN.test(s)).length,
        0
    );
    // The two field labels are the asset page's, not a second spelling — and the name
    // column's head is the list's own since #519, the design's `Name`, where it borrowed the
    // asset page's `Tool`.
    check("the name column's head, the list's own word", ASSET_LIST_COPY.nameLabel, "Name");
    check("  which the asset page no longer carries", "toolLabel" in ASSET_COPY, false);
    for (const [key, label] of [
        ["statusLabel", ASSET_COPY.statusLabel],
        ["jobLabel", ASSET_COPY.jobLabel],
        ["backToTools", ASSET_COPY.backToTools],
    ])
        check(`  ${key} is the asset page's word`, ASSET_LIST_COPY[key], label);
    // A status is a closed vocabulary value and is rendered from it. Spelling one
    // into a sentence here would be a second copy that a narrowing like #335's
    // would leave behind.
    check(
        "no string spells a status",
        strings.filter((s) => ASSET_STATUS_VALUES.some((v) => s.includes(v))).length,
        0
    );
    check("the heading is the axis's name on screen", ASSET_LIST_COPY.heading, "Tools & Equipment");
    // THE DESIGN'S `13 items` (#455): a category's own page counts what is under it as items,
    // and since #519 the category list counts its rows as items too, and the column over each
    // code says `Item ID`.
    check("one item is singular", ASSET_LIST_COPY.total(1), "1 item");
    check("  and two are plural", ASSET_LIST_COPY.total(2), "2 items");
    check("  and none is plural too", ASSET_LIST_COPY.total(0), "0 items");
    check("  the column over each one's code, the design's since #519", ASSET_LIST_COPY.assetIdLabel, "Item ID");
    check(
        "  and the head counts both lists in one noun",
        `${ASSET_LIST_COPY.itemNoun(1)} ${ASSET_LIST_COPY.itemNoun(17)} ${"toolNoun" in ASSET_LIST_COPY}`,
        "item items false"
    );
    // THE TWO EMPTY STATES, which the sweep carried the verb and the noun into. The
    // second's sentence, that an addition had stopped before saving any, went in #507: a
    // category with nothing under it is a catalog row nobody has bought yet, so its heading
    // stands alone. The design's words since #519.
    check(
        "no item at all, a heading and a sentence (1a)",
        `${ASSET_LIST_COPY.noItemsHeading} | ${ASSET_LIST_COPY.noItems}`,
        // `in repair` since #531, where the files of 2026-10-15 still say the three.
        "No items yet | Each item shows here with how many are in stock, out, in repair and retired."
    );
    check(
        "  and a category with nothing under it, its heading (1d, #507)",
        `${ASSET_LIST_COPY.noAssetsHeading} | ${"noToolItems" in ASSET_LIST_COPY}`,
        "Nothing added yet | false"
    );
    check(
        "the pager's two figures, and its steps' names",
        `${ASSET_LIST_COPY.range({ from: 26, to: 40, total: 40 })} | ${ASSET_LIST_COPY.pagePosition({ page: 2, pageCount: 2 })} | ${ASSET_LIST_COPY.previous} | ${ASSET_LIST_COPY.next}`,
        "26–40 of 40 | Page 2 of 2 | Previous page | Next page"
    );
    assert(
        "the position names both figures",
        ASSET_LIST_COPY.pagePosition({ page: 2, pageCount: 3 }).includes("2") &&
            ASSET_LIST_COPY.pagePosition({ page: 2, pageCount: 3 }).includes("3")
    );
    // THE SELECTION'S WORDS (#443), AND NONE NAMES WHAT IS SELECTED. They were written
    // while `tool item` was decided against showing with its replacement still open, so
    // they said neither that nor `item`; #455 settled the word and left them alone. The
    // sentences are pinned in 2d; these are the controls'.
    check("the page box, Design's name for it", ASSET_LIST_COPY.selectPage, "Select this page");
    check("  an entry's box, named by its id", ASSET_LIST_COPY.selectAsset(A), `Select ${A}`);
    check("  the way out", ASSET_LIST_COPY.clearSelection, "Clear selection");
    check("  and the bar's name", ASSET_LIST_COPY.selectionBar, "Selected items");
    check(
        "  and not one of the selection's words says an item, the bar's name aside",
        [
            ASSET_LIST_COPY.selectPage,
            ASSET_LIST_COPY.clearSelection,
            ASSET_LIST_COPY.selectedCount(3),
            ASSET_LIST_COPY.notOnPage(1),
            ASSET_LIST_COPY.printCap(100),
        ].filter((text) => /\bitems?\b/i.test(text)).length,
        0
    );
    assert("the noun matcher finds `tool items`", TOOL_ITEM_NOUN.test("No tools yet. One appears here when somebody registers tool items of it."));
    assert("  and passes the design's `13 items`", !TOOL_ITEM_NOUN.test(ASSET_LIST_COPY.total(13)));

    // ── 4: no asset screen writes text into its markup ──────────────────────
    log("");
    log("no screen under app/(assets)/ puts a word in its markup:");
    const files = assetsFiles();
    assert(`${files.length} files scanned`, files.length >= 4);
    const offenders = [];
    for (const rel of files) {
        for (const text of markupText(parseFile(rel).ast)) offenders.push(`${rel}: ${text}`);
    }
    check(
        `every string comes from a constant${offenders.length ? ` (${offenders.join("; ")})` : ""}`,
        offenders.length,
        0
    );

    // ANTI-VACUITY AND THE MUTATION IN ONE: the heading `/asset-categories` carried until this
    // issue, restored, plus the two shapes a rewrite would reach for instead.
    const planted = parseSource(
        'function Page() {\n' +
            '  return (<div>\n' +
            '    <h1>Tools</h1>\n' +
            '    <p>{"Register tool items"}</p>\n' +
            '    <input placeholder="Tool name" />\n' +
            '    <span>{COPY.heading}</span>\n' +
            '  </div>);\n' +
            '}\n',
        "<planted-markup>"
    );
    const seen = markupText(planted.ast);
    for (const [text, shape] of [
        ["Tools", "bare JSX text"],
        ["Register tool items", "a string literal child"],
        ['placeholder="Tool name"', "a visible attribute"],
    ])
        assert(`  the scanner sees ${shape}`, seen.includes(text));
    check("  and passes a constant through", seen.length, 3);

    // ── #519: the design's latest files on the two lists and the asset's page ──
    log("");
    log("the design's latest files: the pager, the job's three places, the empty states and the caption (#519):");
    // 0b's pager: the one figure where a page shows a single row, and the page and its steps only
    // past one page — one function both pagers ask, so they cannot answer differently.
    check(
        "  the count is the one figure for a single row, a range otherwise",
        `${ASSET_LIST_COPY.range({ from: 1, to: 1, total: 1 })} | ${ASSET_LIST_COPY.range({ from: 26, to: 26, total: 26 })} | ${ASSET_LIST_COPY.range({ from: 1, to: 25, total: 38 })}`,
        "1 of 1 | 26 of 26 | 1–25 of 38"
    );
    check(
        "  the page and its steps stand only past one page",
        `${pagerPosition({ page: 1, pageCount: 1 })} | ${pagerPosition({ page: 2, pageCount: 3 })}`,
        "null | Page 2 of 3"
    );
    const listSource = parseFile(LIST_SCREEN).source;
    const categorySource = parseFile(CATEGORY_SCREEN).source;
    const assetSource = parseFile("app/(assets)/assets/[assetId]/page.js").source;
    const listFrameSource = parseFile("app/(assets)/asset-categories/[categoryRecordId]/AssetList.js").source;
    const categoryListSource = parseFile(CATEGORY_LIST).source;
    check(
        "  and both pagers ask it",
        `${/position=\{pagerPosition\(page\)\}/.test(categoryListSource)} ${/position=\{pagerPosition\(page\)\}/.test(listFrameSource)} ${/pagePosition\(/.test(categoryListSource + listFrameSource)}`,
        "true true false"
    );
    // The job is a choice only for a reader with more than one (1a, 1d, 1f): the list's chip, a
    // category's breadcrumb level and an asset's, each under the one count.
    const choosesJob = (source) => (source.match(/scope\.jobs\.length > 1/g) ?? []).length;
    check(
        "  the job is offered only to a reader on more than one, on all three screens",
        `${choosesJob(listSource)} ${choosesJob(categorySource)} ${choosesJob(assetSource)} ${/scope\.jobs\.length > 0/.test(listSource + categorySource + assetSource)}`,
        "1 1 1 false"
    );
    check(
        "  the list's as a chip starting its band (#566), a category's and an asset's as a breadcrumb level",
        [
            /const choosable = scope\.jobs\.length > 1 \?/.test(listSource) &&
                /band=\{choosable && <JobChoice jobs=\{choosable\} job=\{job\} \/>\}/.test(listSource) &&
                /band=\{\s*<>\s*\{jobs && <JobChoice jobs=\{jobs\} job=\{job\} filters=\{reading\.held\} \/>\}\s*<SearchField/.test(categoryListSource) &&
                ![listSource, categoryListSource].some((source) => /<ListHeader(?:(?!<\/ListHeader>)[\s\S])*<JobChoice/.test(source)),
            /key: "job",\s*control: \(\s*<CategoryJobChoice/.test(categorySource) && !/<ListHeader[\s\S]*?<CategoryJobChoice[\s\S]*?<\/ListHeader>/.test(categorySource),
            /key: "job",\s*control: \(\s*<JobChoice\s+look="crumb"/.test(assetSource),
        ].join(" "),
        "true true true"
    );
    check("  and a planted list offering it to a reader on one job is seen (anti-vacuity)", choosesJob("scope.jobs.length > 0 ? <JobChoice /> : null"), 0);
    // THE EMPTY STATES, the design's words by value and who reads each off the pages (1a2, 1d).
    check(
        "  the words for a reader who adds nothing, for a site manager's empty category, and for a reader on no job",
        [ASSET_LIST_COPY.untilASiteManagerAdds, ASSET_LIST_COPY.untilYouAdd, ASSET_LIST_COPY.noJobHeading, ASSET_LIST_COPY.untilAssigned].join(" | "),
        "Items show here once a site manager adds them. | Items show here once you add them. | No job yet | Items show here once the office assigns you to a job."
    );
    check(
        "  the list: no figure and no job's words but for a reader on no job, the sentence by who reads it, no opener under a reader on no job",
        [
            /const onNoJob = scope\.jobs\.length === 0;/.test(listSource),
            /count=\{onNoJob \? null : 0\}/.test(listSource),
            /\{onNoJob \? COPY\.noJobHeading : COPY\.noItemsHeading\}/.test(listSource),
            /\{onNoJob \? COPY\.untilAssigned : recorder \? COPY\.noItems : COPY\.untilASiteManagerAdds\}/.test(listSource),
            /\{recorder && !onNoJob && \(/.test(listSource),
        ].join(" "),
        "true true true true true"
    );
    check(
        "  a category's page: who fills it, by who reads it",
        /\{recorder \? COPY\.untilYouAdd : COPY\.untilASiteManagerAdds\}/.test(categorySource),
        true
    );
    // ONE SCROLL (0i Chain, #519). The lane holds the whole list: on 1a the head held at the top
    // on the Sticky ground, on 1d the bar held and the head scrolling away under it; the column
    // head holds where the frame says, under the head's least height or under the bar; focus
    // scrolls clear of both and of the pager; and the pager stands outside the lane, after it.
    const frameWhole = parseFile(LIST_FRAME).source;
    const oneScroll = (source) => {
        const frameFn = source.slice(source.indexOf("export default function ListFrame"));
        const lane = frameFn.indexOf("ref={laneRef}");
        const pager = frameFn.indexOf("PAGER_OVER_ROWS");
        const inLane = (pattern) => {
            const at = frameFn.search(pattern);
            return at > lane && at < pager;
        };
        return [
            inLane(/<div ref=\{topRef\} className="sticky top-0 z-10">\s*\{top\}\s*<\/div>\s*<div ref=\{headerRef\}>\{header\}<\/div>/),
            // What the band found by an id stands under its controls, held with them (#541).
            inLane(
                /<div className="sticky top-0 z-10 bg-background-translucent backdrop-blur-sm">\s*\{header\}\s*\{band && <div className=\{BAND\}>\{band\}<\/div>\}\s*\{band && found && <div className=\{BAND_FOUND\}>\{found\}<\/div>\}\s*<\/div>/
            ),
            /const BAND = `\$\{LIST_MEASURE\} flex items-center gap-gap pb-control-band-inset-y`;/.test(source),
            /\$\{\s*top \? UNDER_BAR : band \? \(found \? UNDER_HEAD_BAND_AND_FOUND : UNDER_HEAD_AND_BAND\) : UNDER_HEAD\s*\}/.test(frameFn),
            /const UNDER_HEAD_AND_BAND =\s*"\[--table-head-top:calc\(var\(--spacing-list-header-inset-top\)\+var\(--height-control-lg\)\+var\(--spacing-list-header-inset-bottom\)\+var\(--height-control\)\+var\(--spacing-control-band-inset-y\)\)\] scroll-pt-\[calc\(var\(--table-head-top\)\+var\(--height-table-header\)\)\]";/.test(source),
            /const UNDER_HEAD =\s*"\[--table-head-top:calc\(var\(--spacing-list-header-inset-top\)\+var\(--height-control-lg\)\+var\(--spacing-list-header-inset-bottom\)\)\] scroll-pt-\[calc\(var\(--table-head-top\)\+var\(--height-table-header\)\)\]";/.test(source),
            /const UNDER_BAR = "\[--table-head-top:var\(--height-breadcrumb\)\] scroll-pt-\[calc\(var\(--table-head-top\)\+var\(--height-table-header\)\)\]";/.test(source),
            /\$\{footer \? \(overlayShown \? KEEP_CLEAR_OF_BAR : KEEP_CLEAR_OF_PAGER\) : ""\}/.test(frameFn),
            // Nothing before the pager gives the lane's 8 back: what heads the list stands in it.
            lane >= 0 && pager > lane && !/pr-scrollbar-gutter/.test(frameFn.slice(0, frameFn.lastIndexOf("className", pager))),
        ].join(" ");
    };
    check(
        "  one scroll: 1a's head and its band and 1d's bar held at the top inside the lane, the column head under each, focus clear of them, the pager after the lane",
        oneScroll(frameWhole),
        "true true true true true true true true true"
    );
    check(
        "  and the column head reads where the frame holds it",
        /export const TABLE_HEAD =\s*"sticky top-\(--table-head-top\) z-10 /.test(parseFile(LIST_TABLE).source),
        true
    );
    check(
        "  and a frame holding its head outside the lane, as #463's did, is seen (anti-vacuity)",
        oneScroll(
            'export default function ListFrame() { return <div>{top && <div className="shrink-0 pr-scrollbar-gutter">{top}</div>}<div className="shrink-0">{header}</div><div ref={laneRef} className={`${SCROLL_LANE}`} /><div className={PAGER_OVER_ROWS} /></div>; }'
        ),
        "false false false false false false false false false"
    );
    // A LIST ON FILL SCROLLS IN A REGION OF ITS OWN (0i, 1l, #538): the bar, the head and the band
    // outside the lane and holding still, the column head outside it too and laid over its first
    // 36, its track from under the column head to over the pager, and the pager after the lane.
    // SINCE #552 THE LANE SCROLLS SIDEWAYS TOO (0b Row, 1l of 2026-10-21): the column head in a
    // box of its own that hides what overflows it and takes the lane's offset as the lane moves,
    // the table marked while the lane stands scrolled from its start, and — while the rows run
    // past the lane — the pager under the lane rather than over its foot, the rows ending on no
    // room for it and the track running to the lane's foot. No selection bar rides over the pager
    // since #552 took away `Set class`.
    const fillFrame = (source) => {
        const fn = source.slice(source.indexOf("export function ListFrameFill"));
        const body = fn.slice(0, fn.indexOf("\n}\n"));
        const lane = fn.indexOf("ref={laneRef}");
        const pager = fn.indexOf("PAGER_OVER_ROWS");
        const beforeLane = (pattern) => {
            const at = fn.search(pattern);
            return at >= 0 && at < lane;
        };
        return [
            beforeLane(/\{top && <div className="shrink-0">\{top\}<\/div>\}\s*<div className="shrink-0">\{header\}<\/div>\s*\{band && <div className=\{BAND_FILL\}>\{band\}<\/div>\}/),
            beforeLane(/<div ref=\{headRef\} role="rowgroup" className=\{`shrink-0 overflow-x-hidden \$\{empty \? "-mb-px" : HEAD_OVER_LANE\}`\}>\s*\{columnHead\}\s*<\/div>/),
            /const HEAD_OVER_LANE = "-mb-\[calc\(var\(--height-table-header\)\+1px\)\]";/.test(source) && /<div aria-hidden="true" className="h-table-header" \/>\s*\{children\}/.test(fn),
            /className=\{`min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain \[scrollbar-gutter:stable\] \$\{SCROLL_LANE\} \$\{TRACK_UNDER_HEAD\}/.test(fn),
            /const TRACK_UNDER_HEAD = "\[&::-webkit-scrollbar-track\]:mt-\(--height-table-header\) scroll-pt-\(--height-table-header\)";/.test(source) &&
                /footer && !sideways \? `\$\{TRACK_OVER_PAGER\} \$\{KEEP_CLEAR_OF_PAGER\}` : ""/.test(fn),
            /setSideways\(lane\.scrollWidth > lane\.clientWidth\)/.test(fn) && /setScrolledSideways\(lane\.scrollLeft > 0\)/.test(fn) && /headRef\.current\.scrollLeft = lane\.scrollLeft/.test(fn),
            /data-scrolled-sideways=\{scrolledSideways && laneShown \? "" : undefined\}/.test(fn) && /className=\{`group\/fill /.test(fn),
            lane >= 0 && pager > lane && /\$\{sideways \? "" : PAGER_OVER_ROWS\}/.test(fn) && /\{footer && !sideways && <div aria-hidden="true" className=\{END_ROOM\} \/>\}/.test(fn),
            !/\boverlay/i.test(body),
            /const BAND_FILL = `\$\{LIST_FILL\} flex shrink-0 items-center gap-gap pb-control-band-inset-y`;/.test(source),
        ].join(" ");
    };
    check(
        "  a list on Fill: the head and the band still, the column head over the lane's top and moved with it, the lane both ways, its track between the two, the pager over its foot or under it",
        fillFrame(frameWhole),
        "true true true true true true true true true true"
    );
    check(
        "  and #538's Fill frame, the lane up and down only and a selection bar over the pager, is seen (anti-vacuity)",
        fillFrame(
            'const BAND_FILL = `${LIST_FILL} flex shrink-0 items-center gap-gap pb-control-band-inset-y`;\n' +
                "export function ListFrameFill({ overlay }) { return <div>{top && <div className=\"shrink-0\">{top}</div>}<div className=\"shrink-0\">{header}</div>{band && <div className={BAND_FILL}>{band}</div>}" +
                '<div role="rowgroup" className={`shrink-0 ${empty ? "-mb-px" : HEAD_OVER_LANE}`}>{columnHead}</div>' +
                "<div ref={laneRef} className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] ${SCROLL_LANE} ${TRACK_UNDER_HEAD}`}>{children}</div>" +
                "<div className={`relative z-10 shrink-0 ${PAGER_OVER_ROWS}`}><div className=\"relative mr-scrollbar-gutter\">{overlay}</div></div></div>; }\n}\n"
        ),
        "true false false false false false false false false true"
    );
    // 1l DRAWS ITS ROWS ON FILL: Fill's column head and rows, the head and the pager on the
    // Margin, and no name handed to the bar, since nothing scrolls the head away under it.
    const catalogOnFill = (source) =>
        [
            /<ListFrameFill\b/.test(source) && !/<ListFrame\b/.test(source),
            /className=\{`\$\{TABLE_HEAD_FILL\} \$\{COLUMNS\} \$\{LEAST\}`\}/.test(source),
            /\$\{TABLE_ROW_FILL\} \$\{COLUMNS\} \$\{LEAST\}/.test(source),
            /<ListHeader\b[^>]*\bfill\b/.test(source) && /<Pager\s+fill\b/.test(source),
            !/<Breadcrumb[^>]*\btitle=/.test(source),
        ].join(" ");
    check(
        "  Fill's pager: its count on the Margin and its steps on the rows' text edge, as Fill's row ends its text",
        [
            /\$\{fill \? "pl-page-gutter pr-fill-table-inset-right" : "px-table-bleed"\}/.test(parseFile(LIST_TABLE).source),
            /export const TABLE_ROW_FILL =\s*"[^"]*\bpl-page-gutter pr-\[calc\(var\(--spacing-fill-table-inset-right\)-var\(--spacing-scrollbar-gutter\)\)\]/.test(parseFile(LIST_TABLE).source),
        ].join(" "),
        "true true"
    );
    check(
        "  the catalog is that list: Fill's column head and rows, its head and pager, and no name in its bar",
        catalogOnFill(parseFile("app/(assets)/asset-catalog/CatalogList.js").source),
        "true true true true true"
    );
    check(
        "  and the catalog at the measure under a bar that takes its name is seen (anti-vacuity)",
        catalogOnFill(
            "<ListFrame top={<Breadcrumb levels={l} title={t} />}><div className={`${TABLE_HEAD} ${COLUMNS}`} /><div className={`${TABLE_ROW} ${COLUMNS}`} /><ListHeader title={t} /><Pager range={r} /></ListFrame>"
        ),
        "false false false false false"
    );
    // 1d's NAME IN THE BAR once its head has scrolled under it: measured by the frame, marked on
    // the lane, drawn by the bar under the mark behind a 16 rule 16 either side at 13 and 600,
    // and handed by the category's page alone.
    const crumbSource = parseFile("app/components/Breadcrumb.js").source;
    const nameInBar = ({ frameSource: f, crumb, category, asset }) =>
        [
            /setTitleGone\(head\.getBoundingClientRect\(\)\.bottom <= bar\.getBoundingClientRect\(\)\.bottom\)/.test(f),
            /data-title-gone=\{titleGone \? "" : undefined\}/.test(f) && /group\/list-frame/.test(f),
            /className="pointer-events-none invisible flex min-w-0 items-center opacity-0 transition-\[opacity,visibility\] duration-breadcrumb-title ease-out group-data-title-gone\/list-frame:visible group-data-title-gone\/list-frame:opacity-100"/.test(crumb),
            /<span aria-hidden="true" className="mx-breadcrumb-title-rule-inline h-breadcrumb-title-rule w-px shrink-0 bg-divider" \/>\s*<span className="min-w-0 truncate text-body-sm font-semibold text-foreground-default">\{title\}<\/span>/.test(crumb),
            /title=\{category\.itemName\}\s*\/>/.test(category),
            !/<Breadcrumb[^>]*\btitle=/.test(asset),
        ].join(" ");
    check(
        "  1d's name comes into the bar once its head has gone under it, and an asset's page hands the bar none",
        nameInBar({ frameSource: frameWhole, crumb: crumbSource, category: categorySource, asset: assetSource }),
        "true true true true true true"
    );
    check(
        "  and a name always shown, measured off the title alone, or handed by an asset's page is seen (anti-vacuity)",
        nameInBar({
            frameSource: "setTitleGone(title.getBoundingClientRect().top < 0)",
            crumb: '<div className="flex min-w-0 items-center"><span>{title}</span></div>',
            category: "<Breadcrumb levels={levels} />",
            asset: "<Breadcrumb levels={levels} title={category.itemName} />",
        }),
        "false false false false false false"
    );
    // A DIALOG'S JOB SAYS THE JOB'S NAME AFTER ITS CODE (1b, 1i): the registration from both
    // pages that open it, and the check-out and check-in at a desk — the phone's sheet and foot
    // bar keep the code alone, as 1j draws them.
    const registrationSource = parseFile("app/(assets)/asset-categories/RegistrationDialog.js").source;
    const transitionSource = parseFile("app/(assets)/assets/[assetId]/TransitionDialog.js").source;
    const barSourceForJobs = parseFile("app/(assets)/assets/[assetId]/TransitionBar.js").source;
    const jobNames = ({ registration, transition, bar, list, category }) =>
        [
            /options=\{jobs\.map\(\(job\) => \(\{ value: job\.id, label: job\.jobCode, note: job\.jobName \}\)\)\}/.test(registration),
            /const options = plan\.jobs\.map\(\(job\) => \(\{ value: job\.id, label: job\.jobCode, note: job\.jobName \}\)\);/.test(transition),
            /const options = plan\.jobs\.map\(\(job\) => \(\{ value: job\.id, label: job\.jobCode \}\)\);/.test(bar),
            /jobs: assignedJobsFor\(user, allJobs\)\.map\(\(\{ id, jobCode, jobName \}\) => \(\{ id, jobCode, jobName \}\)\),/.test(list),
            /const assignedJobs = assignedJobsFor\(user, jobs\)\.map\(\(\{ id, jobCode, jobName \}\) => \(\{ id, jobCode, jobName \}\)\);/.test(category),
        ].join(" ");
    check(
        "  a dialog's job says the job's name after its code, the phone's foot bar the code alone, and both pages hand the registration the names",
        jobNames({ registration: registrationSource, transition: transitionSource, bar: barSourceForJobs, list: listSource, category: categorySource }),
        "true true true true true"
    );
    check(
        "  and a dialog offering codes alone, and pages handing no name, are seen (anti-vacuity)",
        jobNames({
            registration: "options={jobs.map((job) => ({ value: job.id, label: job.jobCode }))}",
            transition: "const options = plan.jobs.map((job) => ({ value: job.id, label: job.jobCode }));",
            bar: "const options = plan.jobs.map((job) => ({ value: job.id, label: job.jobCode, note: job.jobName }));",
            list: "jobs: assignedJobsFor(user, allJobs).map(({ id, jobCode }) => ({ id, jobCode })),",
            category: "const assignedJobs = assignedJobsFor(user, jobs).map(({ id, jobCode }) => ({ id, jobCode }));",
        }),
        "false false false false false"
    );
    // THE CAPTION: the type and the category (1d, 1f, 1j), the asset's id first at a desk, the
    // path the caption said from #507 nowhere in it, and since #552 no class after the two.
    const captionSource = parseFile("app/(assets)/CategoryCaption.js").source;
    check(
        "  the caption says the type and the category, after what leads it, and no path and no class",
        [
            /const parts = \[\s*lead,\s*category\?\.level1 \? value\(category\.level1\) : null,\s*category\?\.level2 \? value\(category\.level2\) : null\s*\]\.filter\(Boolean\)/.test(captionSource) &&
                !/assetClass|classOf/.test(captionSource),
            !/pathOf/.test(captionSource),
            /text-foreground-default tabular-nums max-sm:text-foreground-muted/.test(captionSource),
            /<CategoryCaption\s+category=\{category\}\s+lead=\{<span className=\{ID_IN_TEXT\}>\{asset\.assetId\}<\/span>\}/.test(assetSource),
            !/jobCode && \(/.test(assetSource),
        ].join(" "),
        "true true true true true"
    );

    // ── #520: when each item last changed, and who holds one that is out ──────────
    log("");
    log("a category's list says when each item last changed, off its latest log row (#520):");
    // ONE ROW PER ASSET, AND THE NEWEST. The fifth read is one query whatever the histories
    // hold only because the page asks for one row per asset, and it is the right row only
    // because that row is the last of the link array — `newestFirst`'s reading. An older row
    // standing in the read must not answer for an asset whose latest did not come back.
    const LOGGED = [
        { id: "a1", status: ASSET_STATUS.OUT, assetLog: ["l1", "l2", "l3"] },
        { id: "a2", status: ASSET_STATUS.IN_STOCK, assetLog: ["l4"] },
        { id: "a3", status: ASSET_STATUS.OUT, assetLog: ["l5", "l6"] },
        { id: "a4", status: ASSET_STATUS.IN_STOCK, assetLog: [] },
        { id: "a5", status: ASSET_STATUS.RETIRED },
        { id: "a6", status: ASSET_STATUS.OUT, assetLog: ["l1", "l9"] },
    ];
    check("the read asks for each asset's last row, and none for an asset with none", latestLogRowIds(LOGGED).join(","), "l3,l4,l6,l9");
    check("  and nothing for no assets", latestLogRowIds(undefined).length, 0);
    const ENTRIES = new Map([
        ["l1", { id: "l1", event: ASSET_EVENT.CHECKED_OUT, eventAt: "2026-09-01T12:00:00.000Z", checkedOutTo: "Old Holder" }],
        ["l3", { id: "l3", event: ASSET_EVENT.CHECKED_OUT, eventAt: "2026-10-02T15:30:00.000Z", checkedOutTo: "  Jiho   Lee " }],
        ["l4", { id: "l4", event: ASSET_EVENT.CREATED, eventAt: "2026-10-09T20:45:13.558Z" }],
        ["l6", { id: "l6", event: ASSET_EVENT.CHECKED_IN, eventAt: "2026-10-05T09:00:00.000Z" }],
    ]);
    const lastSaid = (asset) => {
        const change = lastChangeOf(asset, ENTRIES);
        return `${change.updatedAt} ${change.holder}`;
    };
    check("an item out says its latest check-out's moment and who it went to", lastSaid(LOGGED[0]), "2026-10-02T15:30:00.000Z Jiho Lee");
    check("  an item in stock its latest moment and nobody", lastSaid(LOGGED[1]), "2026-10-09T20:45:13.558Z null");
    check("  an item out whose latest row is no check-out names nobody", lastSaid(LOGGED[2]), "2026-10-05T09:00:00.000Z null");
    check("  an item with no row says neither", `${lastSaid(LOGGED[3])} | ${lastSaid(LOGGED[4])}`, "null null | null null");
    check("  and one whose latest row did not come back says neither, not an older row's", lastSaid(LOGGED[5]), "null null");
    check("the column says `Updated`, the design's (1d)", ASSET_LIST_COPY.updatedLabel, "Updated");

    // WHERE THE PAGE TAKES THEM FROM, off its source: the ids from the very assets its read
    // returned, one batched read of them outside any loop, and each row spread from
    // `lastChangeOf` over what that read returned — so a page cannot read each asset's whole
    // log, ask for rows its list does not show, or say a moment its read did not bring.
    const logReadFacts = (ast) => {
        const reads = [];
        let readBinding = null;
        let spreadOver = "none";
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.init) {
                const init = n.init.type === "AwaitExpression" ? n.init.argument : n.init;
                if (init?.type === "CallExpression" && init.callee?.name === "getAssetsByCategory") readBinding = n.id?.name ?? null;
            }
            if (n.type === "CallExpression" && n.callee?.property?.name === "map") {
                const body = n.arguments?.[0];
                walk(body ?? {}, (inner) => {
                    if (inner.type === "CallExpression" && /^getAssetLog/.test(inner.callee?.name ?? "")) reads.push("in a loop");
                });
            }
            if (n.type === "CallExpression" && n.callee?.name === "getAssetLogEntriesByRecordIds") {
                const ids = n.arguments?.[0];
                reads.push(ids?.type === "CallExpression" && ids.callee?.name === "latestLogRowIds" ? `latest of ${nameOf(ids.arguments?.[0])}` : `of ${nameOf(ids)}`);
            }
            if (n.type === "SpreadElement" && n.argument?.type === "CallExpression" && n.argument.callee?.name === "lastChangeOf")
                spreadOver = nameOf(n.argument.arguments?.[1]);
        });
        let latestFrom = "none";
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === spreadOver) {
                walk(n.init ?? {}, (inner) => {
                    if (inner.type === "CallExpression" && inner.callee?.name === "getAssetLogEntriesByRecordIds") latestFrom = "the read";
                });
            }
        });
        return { reads: reads.join(", "), readBinding, latestFrom };
    };
    const logFacts = logReadFacts(parseFile(CATEGORY_SCREEN).ast);
    check("the page reads the latest rows of the assets its read returned, once", logFacts.reads, `latest of ${logFacts.readBinding}`);
    check("  and spreads each row from what that read returned", logFacts.latestFrom, "the read");
    // ANTI-VACUITY: a planted page reading each asset's whole log in a loop, and one reading
    // the page's ids and spreading from something else, are each seen.
    const plantedLoop = logReadFacts(
        parseSource(
            "async function renderCategoryPage() {\n" +
                "  const assets = await getAssetsByCategory(category.id, { rowIds: page.ids });\n" +
                "  const logs = await Promise.all(assets.map((asset) => getAssetLogByAsset(asset.id)));\n" +
                "  return <AssetList rows={assets.map((asset) => ({ ...lastChangeOf(asset, logs) }))} />;\n" +
                "}\n",
            "<planted-log-loop>"
        ).ast
    );
    check("  a read per asset is seen in its loop", plantedLoop.reads, "in a loop");
    check("  and rows spread from it are seen not to be the read's", plantedLoop.latestFrom, "none");
    const plantedIds = logReadFacts(
        parseSource(
            "async function renderCategoryPage() {\n" +
                "  const assets = await getAssetsByCategory(category.id, { rowIds: page.ids });\n" +
                "  const latest = await getAssetLogEntriesByRecordIds(page.ids);\n" +
                "  return <AssetList rows={assets.map((asset) => ({ ...lastChangeOf(asset, guessed) }))} />;\n" +
                "}\n",
            "<planted-log-ids>"
        ).ast
    );
    check("  a read of other ids is seen so", plantedIds.reads, "of page.ids");
    check("  and rows spread from something else are seen so", plantedIds.latestFrom, "none");

    // THE READER ASKS FOR THOSE ROWS BY RECORD ID AND THREE FIELDS, and does not throw over
    // one that did not resolve: `findByRecordIds`, where the asset's own page keeps
    // `findChildRecords` for a history that must come back whole.
    const readerSource = functionSource(parseFile("lib/airtable/assetLog.js"), "getAssetLogEntriesByRecordIds");
    check(
        "the reader asks by record id for the event, its moment and who it went to, and nothing more",
        [
            /findByRecordIds\(TABLES\.ASSET_LOG, rowIds \|\| \[\], \{\s*fields: \["Event", "Event At", "Checked Out To"\],\s*\.\.\.\(perQuery \? \{ perQuery \} : \{\}\),\s*pace,\s*\}\)/.test(readerSource),
            !/findChildRecords/.test(readerSource),
        ].join(" "),
        "true true"
    );

    // THE LIST'S COLUMNS (1d, #533): the id, the status at 240 with who holds an `Out` after it,
    // the note taking the room left, and the day at 120 where the job stood — with the box and
    // without.
    const assetListSource = parseFile(ASSET_LIST).source;
    check(
        "the list's columns are the id, the status, the note and the day, with the box and without",
        [
            assetListSource.includes(
                'const COLUMNS = "grid-cols-[var(--size-icon)_var(--width-table-id)_var(--width-table-status)_minmax(0,1fr)_var(--width-table-date)]";'
            ),
            assetListSource.includes('const COLUMNS_WITHOUT_BOX = "grid-cols-[var(--width-table-id)_var(--width-table-status)_minmax(0,1fr)_var(--width-table-date)]";'),
            /\{COPY\.assetIdLabel\}<\/span>\s*\{showsJob && [^\n]*\}\s*<span role="columnheader">\{COPY\.statusLabel\}<\/span>\s*<span role="columnheader">\{COPY\.noteLabel\}<\/span>\s*<span role="columnheader">\{COPY\.updatedLabel\}<\/span>/.test(
                assetListSource
            ),
            // The job is a column on all of a reader's jobs alone (#548), held in #548's block.
            (assetListSource.match(/COPY\.jobLabel|row\.jobCode/g) ?? []).length === 2,
        ].join(" "),
        "true true true true"
    );
    check(
        "  the note in Ink 2 on one line, cut and shown whole above its cell, between the status and the day (#533)",
        [
            /<span role="cell" className="min-w-0 text-foreground-muted">\s*<span data-cut="" className="block truncate">\s*\{row\.note\}\s*<\/span>\s*<\/span>\s*\{\/\*[^]*?\*\/\}\s*<span role="cell" className="text-foreground-muted">\s*<Instant at=\{row\.updatedAt\}/.test(assetListSource),
            /<div key=\{row\.id\} role="row" \{\.\.\.tooltip\.cutProps\(\)\}/.test(assetListSource),
            /const tooltip = useTooltip\(\{ placement: "above" \}\);/.test(assetListSource),
            /\{tooltip\.element\}/.test(assetListSource),
            ASSET_LIST_COPY.noteLabel === ASSET_NOTE_COPY.label,
        ].join(" "),
        "true true true true true"
    );
    check(
        "  an `Out` names who holds it behind 0e's dot, and the day is the reader's, in Ink 2",
        [
            /\{row\.holder && \(\s*<>\s*<Dot \/>\s*<span className="min-w-0 truncate text-foreground-muted">\{row\.holder\}<\/span>/.test(assetListSource),
            /<span role="cell" className="text-foreground-muted">\s*<Instant at=\{row\.updatedAt\} format=\{DAY_FORMAT\} \/>/.test(assetListSource),
        ].join(" "),
        "true true"
    );

    // ── #520: the category list's band ──────────────────────────────────────
    log("");
    log("the category list's band filters by type and category and searches the rows on the job (#520, #552):");
    // Five rows on one job: one category under two types, spelled two ways, and one name a
    // search reaches by two words. Each still carries a class, as a row read before #552 would,
    // which the band reads past.
    const BAND = [
        { id: "r1", itemName: "TIG Welder, Lincoln Electric (TIG 205)", level1: "Equipment", level2: "Welding", assetClass: "A" },
        { id: "r2", itemName: "Band Saw, Makita (2107FW)", level1: "Equipment", level2: "Machining", assetClass: "A" },
        { id: "r3", itemName: "Band Saw, DeWalt", level1: "Tool", level2: "Power Tool", assetClass: "B" },
        { id: "r4", itemName: "End Mill, Orbitalum", level1: "Tool", level2: "machining ", assetClass: "B" },
        { id: "r5", itemName: "Drill, Hilti", level1: "Tool", level2: "Power Tool", assetClass: "A" },
    ];
    const ids = (reading) => reading.rows.map((row) => row.id).join(",");
    const offered = (reading, facet) => reading.facets[facet].map((o) => `${o.value}${o.chosen ? "*" : ""} ${o.count}`).join(" | ");
    const unbanded = filterAssetCategoryRows(BAND, {});
    check("nothing held is every row, narrowing nothing", `${ids(unbanded)} ${unbanded.narrowed}`, "r1,r2,r3,r4,r5 false");
    check("  each facet offers what the rows hold, counted, in order", ASSET_LIST_FACETS.map((f) => offered(unbanded, f)).join(" / "), "Equipment 2 | Tool 3 / Machining 2 | Power Tool 2 | Welding 1");
    const onTools = filterAssetCategoryRows(BAND, { level1: ["Tool"] });
    check("a type narrows to its rows", `${ids(onTools)} ${onTools.narrowed}`, "r3,r4,r5 true");
    check("  its own facet still counts each type on its own", offered(onTools, "level1"), "Equipment 2 | Tool* 3");
    check("  and the categories offered are the type's, in the first row's spelling", offered(onTools, "level2"), "machining 1 | Power Tool 2");
    const stale = filterAssetCategoryRows(BAND, { level1: ["Tool"], level2: ["Welding"] });
    check("a category under no type chosen narrows nothing, and is not held", `${ids(stale)} ${stale.held.level2.length}`, "r3,r4,r5 0");
    check("several values on one facet are any of them", ids(filterAssetCategoryRows(BAND, { level2: ["Power Tool", "welding"] })), "r1,r3,r5");
    check("  facets compose with and", ids(filterAssetCategoryRows(BAND, { level1: ["Tool"], level2: ["Power Tool"] })), "r3,r5");
    const classed = filterAssetCategoryRows(BAND, { level1: ["Tool"], assetClass: ["A"] });
    check(
        "  and a class asked for narrows nothing and is not held, the band's facets the type and the category alone (#552)",
        `${ids(classed)} ${JSON.stringify(classed.held)} ${Object.keys(classed.facets).join(",")}`,
        'r3,r4,r5 {"q":"","level1":["Tool"],"level2":[],"jobs":[]} level1,level2'
    );
    check("a search takes every word, across the name", ids(filterAssetCategoryRows(BAND, { q: "band  DEWALT" })), "r3");
    check("  the category", ids(filterAssetCategoryRows(BAND, { q: "power" })), "r3,r5");
    check("  and the type", ids(filterAssetCategoryRows(BAND, { q: "equipment" })), "r1,r2");
    const searched = filterAssetCategoryRows(BAND, { q: "band" });
    check("  and the counts are under the search", `${offered(searched, "level1")} / ${offered(searched, "level2")}`, "Equipment 1 | Tool 1 / Machining 1 | Power Tool 1 | Welding 0");
    check("  a search alone narrows, and spaces alone do not", `${searched.narrowed} ${filterAssetCategoryRows(BAND, { q: "   " }).narrowed}`, "true false");
    check("a value no row holds is no choice", `${ids(filterAssetCategoryRows(BAND, { level1: ["Vehicle"] }))} ${filterAssetCategoryRows(BAND, { level1: ["Vehicle"] }).narrowed}`, "r1,r2,r3,r4,r5 false");
    check(
        "what the band holds is the values taken, in their spelling, and the search as typed",
        JSON.stringify(filterAssetCategoryRows(BAND, { q: " saw ", level1: ["tool"], level2: ["power tool"] }).held),
        JSON.stringify({ q: " saw ", level1: ["Tool"], level2: ["Power Tool"], jobs: [] })
    );
    check(
        "the address is read under the chips' words, each value once, and a class left on it is read past (#552)",
        JSON.stringify(readAssetListFilters(new URLSearchParams("q=tig&type=Tool&type=Tool&category=%20Power%20%20Tool&class=A&job=recX&page=2"))),
        JSON.stringify({ q: "tig", level1: ["Tool"], level2: ["Power Tool"] })
    );
    check("  and nothing in it reads as nothing", JSON.stringify(readAssetListFilters(new URLSearchParams(""))), JSON.stringify({ q: "", level1: [], level2: [] }));
    const emptiedSays = (reading) => {
        const words = emptiedListWords(reading);
        return `${words.sentence} | ${words.typed} | ${words.clear} ${words.clearsAll}`;
    };
    check("a search that empties the list names what was typed, and clears the search alone", emptiedSays(filterAssetCategoryRows(BAND, { q: " zzz  " })), "No items match | zzz | Clear search false");
    check("  with a chip held too, everything", emptiedSays(filterAssetCategoryRows(BAND, { q: "zzz", level1: ["Tool"] })), "No items match | zzz | Clear all true");
    // Chips alone empty a list only through a category offered with nothing under it, the
    // catalog's (#527): a type and a category the rows hold always leave the rows holding both.
    const chipsAlone = filterAssetCategoryRows(BAND, { level2: ["Cutting"] }, { offers: [{ level1: "Tool", level2: "Cutting" }] });
    check("  and chips alone say these filters", `${chipsAlone.rows.length} | ${emptiedSays(chipsAlone)}`, "0 | No items match these filters | null | Clear all true");
    check(
        "the band's words: the search, each chip's own word and its clear, and the two sentences",
        [
            ASSET_LIST_COPY.searchLabel,
            ASSET_LIST_COPY.clearSearch,
            ASSET_LIST_FACETS.map((f) => `${ASSET_LIST_COPY.facetLabel[f]}: ${ASSET_LIST_COPY.clearFacet[f]}`).join(", "),
            ASSET_LIST_COPY.noneMatch,
            ASSET_LIST_COPY.noneMatchFilters,
            ASSET_LIST_COPY.clearAll,
        ].join(" | "),
        "Search items or item IDs | Clear search | Type: Clear type filter, Category: Clear category filter | No items match | No items match these filters | Clear all"
    );
    check(
        "  a chip's word and its clear for each facet and for no other, the class's gone with its chip (#552)",
        `${Object.keys(ASSET_LIST_COPY.facetLabel).join(" ")} | ${Object.keys(ASSET_LIST_COPY.clearFacet).join(" ")}`,
        "level1 level2 | level1 level2"
    );

    // WHERE THE BAND LIVES, off the sources: the list reads it off the address through the one
    // reader, keeps what is typed while it is typed, narrows once, counts out of the job's rows,
    // and writes every change back with what the band holds; the page reads none of it, and the
    // job's choice offers `All jobs` and the jobs (#548) and carries what the list hands it.
    const bandSource = parseFile(CATEGORY_LIST).source;
    check(
        "the list reads the band off the address, narrows once and counts out of the job's rows",
        [
            /const asked = readAssetListFilters\(params\);\s*const \[typed, setTyped\] = useState\(asked\.q\);\s*const reading = readCategoryList\(rows, params, \{ allJobs, jobs, q: typed \}\);/.test(bandSource),
            /const count = reading\.narrowed \? FILTER_BAR_COPY\.count\(reading\.rows\.length, rows\.length\) : rows\.length;/.test(bandSource),
            /setTyped\(text\);\s*write\(\{ \.\.\.reading\.held, q: text \}\);/.test(bandSource),
            /const choose = \(facet, values\) => write\(\{ \.\.\.reading\.held, \[facet\]: values \}\);/.test(bandSource),
            /if \(!clearsAll\) return search\(""\);\s*setTyped\(""\);\s*write\(\{\}\);/.test(bandSource),
        ].join(" "),
        "true true true true true"
    );
    check(
        "  and draws the search and a chip per facet, each handed its options, its values and its words",
        [
            /<SearchField label=\{COPY\.searchLabel\} value=\{typed\} onChange=\{search\} clearLabel=\{COPY\.clearSearch\} onEnter=\{open\} \/>/.test(bandSource),
            /\{ASSET_LIST_FACETS\.map\(\(facet\) => \(\s*<FilterChip/.test(bandSource),
            /options=\{reading\.facets\[facet\]\.map\(/.test(bandSource) && /values=\{reading\.held\[facet\]\}/.test(bandSource),
            /clearLabel=\{COPY\.clearFacet\[facet\]\}\s*several=\{COPY\.selectedCount\}/.test(bandSource),
        ].join(" "),
        "true true true true"
    );
    const pageSource = parseFile(LIST_SCREEN).source;
    const jobChoiceSource = parseFile("app/(assets)/JobChoice.js").source;
    check(
        "the page reads only the job off the address, and the job's choice offers `All jobs` and the jobs, carrying the band",
        [
            !/readAssetListFilters|sp\.(q|type|category|class|page)\b/.test(pageSource),
            /const options = \[\{ value: ALL_JOBS, label: ALL_JOBS_LABEL \}, \.\.\.jobs\.map\(/.test(jobChoiceSource),
            !/useSearchParams\(|value: "", label/.test(jobChoiceSource),
            /assetCategoriesPath\(1, next, filters\)/.test(jobChoiceSource),
        ].join(" "),
        "true true true true"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

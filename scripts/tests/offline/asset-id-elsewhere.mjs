// Finding an item's id at any job from the Equipment & Tools list's search (#599).
//
// TWO THINGS, SPLIT AS THIS AXIS'S CHECKS SPLIT.
//
//   WHAT THE LIST MAKES OF AN ID AND THE BASE'S ANSWER IS PURE (`lib/assetListView.js:
//   readCategoryList` over the rows `summarizeAssetCategories` builds, and `emptiedListWords`), held
//   by value over rows the page's own composition builds (`assetListScope`, `categoryListRows`) from
//   a fixture of three jobs, three kinds and six items, one deleted — the five cases the issue
//   names: an id on the job the list stands on, found in its rows and asked of nothing; an id at
//   another job, asked of every job and, once answered, the way to it with its job named over rows
//   that stay the job's and say it holds no such id; an id no job holds, said in the drawing's words
//   once answered; a deleted item, which no row carries and the base answers as none; and a name,
//   searched on the chosen job alone and asked of nothing. Then the band's case: an id an item
//   carries though the band leaves it off — on all jobs a `Job` chip taking its job off, a type
//   leaving its row off on all jobs or one — asked of every job, drawn as the line with its job and
//   said as the filters holding none; the chip taking the item's job finding it in its row; an id no
//   row carries saying the drawing's sentence whatever the chip holds; and an id a row carried that
//   the base answers none for. Beside them: all jobs ask nothing for an id no row carries, an answer
//   on a job the choice does not hold, or on the list's own job for an id its rows do not carry,
//   draws no line, an answer is drawn beside its own id alone, and a list nobody searched asks
//   nothing.
//
//   WHAT NO VALUE CAN SHOW IS READ OFF THE SOURCE: that the list asks the one id `readCategoryList`
//   names, once per id, keeps an answer only when it says something, under the id asked; that the
//   line says the job after the name behind the same dot; that the action is gated before it reads,
//   reads the asset by the id the search named through the reader that hands back no deleted asset,
//   reads its kind for the name, and answers a failed read as neither found nor absent; and that the
//   page asks it nothing. Each beside a planted file doing it wrong.
//
// WHAT IT CANNOT SEE. Whether the line stands where 1a draws it, which this tier never opens; and
// what a view and a search cost against the base — both are #599's pull request's, measured on a dev
// server against main.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_STATUS, isShownAsset } from "../../../lib/assetStatus.js";
import { ALL_JOBS } from "../../../lib/assetRoutes.js";
import { assetCategoriesInScope, assetListScope, categoryListRows, emptiedListWords, readCategoryList } from "../../../lib/assetListView.js";
import { parseFile } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Finding an item's id at any job from the Equipment & Tools list's search (#599)";

const LIST = "app/(assets)/asset-categories/AssetCategoryList.js";
const FOUND = "app/(assets)/asset-categories/FoundItem.js";
const ACTIONS = "app/(assets)/asset-categories/actions.js";
const PAGE = "app/(assets)/asset-categories/page.js";
const ASSETS = "lib/airtable/assets.js";

// Five items of three kinds on two of three jobs, and a sixth deleted on the first (#582). `Band Saw`
// stands on the second job alone.
const item = (assetId, kind, job, status) => ({ id: `rec${assetId.slice(-3)}`, assetId, category: [kind], job: [job], status });
const ITEMS = [
    item("HYE-AST-261019-430", "kWelder", "recJ1", ASSET_STATUS.OUT),
    item("HYE-AST-261019-431", "kWelder", "recJ1", ASSET_STATUS.IN_STOCK),
    item("HYE-AST-261019-432", "kWelder", "recJ2", ASSET_STATUS.RETIRED),
    item("HYE-AST-261018-007", "kDrill", "recJ1", ASSET_STATUS.IN_STOCK),
    item("HYE-AST-261018-008", "kSaw", "recJ2", ASSET_STATUS.IN_STOCK),
    item("HYE-AST-261030-002", "kDrill", "recJ1", ASSET_STATUS.DELETED),
];
const holding = (pick) => ITEMS.filter(pick).map((each) => each.id);
const KINDS = [
    { id: "kWelder", itemName: "TIG Welder", level1: "Equipment", level2: "Welding", assets: holding((each) => each.category[0] === "kWelder") },
    { id: "kDrill", itemName: "Drill, DeWalt", level1: "Tool", level2: "Power Tool", assets: holding((each) => each.category[0] === "kDrill") },
    { id: "kSaw", itemName: "Band Saw", level1: "Tool", level2: "Cutting", assets: holding((each) => each.category[0] === "kSaw") },
];
// Every job, each with the items its `Assets` array names, as `getAllJobs` hands them.
const JOB_RECORDS = [
    { id: "recJ1", jobCode: "23-USA-09", assets: holding((each) => each.job[0] === "recJ1") },
    { id: "recJ2", jobCode: "25-USA-13", assets: holding((each) => each.job[0] === "recJ2") },
    { id: "recJ3", jobCode: "26-USA-12", assets: [] },
];
// The jobs the list's choice holds, as the page hands them to the list (`choosable`).
const JOBS = JOB_RECORDS.map(({ id, jobCode }) => ({ id, jobCode }));
// What the status memory hands the page: every item but the deleted one, which
// `lib/airtable/assets.js:getAssetStatuses` leaves out by `isShownAsset` (#582).
const KEPT = new Map(ITEMS.filter(isShownAsset).map((each) => [each.id, { status: each.status, assetId: each.assetId, lastEventAt: null }]));
// The rows the page builds for a job asked — its own composition, scope then rows.
const rowsOn = (rawJob) => {
    const scope = assetListScope({ assignedJobs: ["recJ1"] }, JOB_RECORDS, rawJob);
    return categoryListRows(assetCategoriesInScope(KINDS, scope.shown), scope, KEPT);
};
const JOB_ONE = rowsOn("recJ1");
const ALL = rowsOn(ALL_JOBS);

// What `readFoundElsewhereAction` answers for the item on the second job.
const AT_JOB_TWO = { assetId: "HYE-AST-261019-432", itemName: "TIG Welder", status: ASSET_STATUS.RETIRED, job: "recJ2" };

// The list's reading as `AssetCategoryList` asks it: on the first job, or on all of them. The base answers
// a list since #601 — a serial number may name an item of each of two kinds — so an id's one item and
// its none are written here as the item and null, and handed over as a list of one and an empty one.
const answered = (elsewhere) => Object.fromEntries(Object.entries(elsewhere).map(([text, item]) => [text, item === null ? [] : [item]]));
const read = (rows, search, { allJobs = false, elsewhere = {} } = {}) =>
    readCategoryList(rows, new URLSearchParams(search), { allJobs, jobs: JOBS, job: allJobs ? ALL_JOBS : "recJ1", elsewhere: answered(elsewhere) });

// The rows, the line — id, name, job, status — and the id asked of every job.
const said = (reading) =>
    [
        reading.rows.map((row) => row.id).join(",") || "-",
        reading.found.length > 0 ? reading.found.map((item) => [item.assetId, item.itemName, item.jobCode ?? "-", item.status].join(" · ")).join(" + ") : "-",
        reading.asks ?? "-",
    ].join(" | ");
const sentence = (reading, jobCode) => {
    const words = emptiedListWords(reading, { jobCode });
    return `${words.sentence} | ${words.typed} | ${words.clear}`;
};

/** The whole text of the first function or arrow assigned to `name` in a source, or "". */
function bodyOf(source, name) {
    const start = source.search(new RegExp(`(export (async )?function ${name}\\(|const ${name} = )`));
    if (start < 0) return "";
    const end = source.slice(start).search(/\r?\n(\}|    \};)\r?\n/);
    return end < 0 ? source.slice(start) : source.slice(start, start + end + 4);
}

/** What the list asks and keeps, off its source. */
function listAskOf(source) {
    return [
        /const \[elsewhere, setElsewhere\] = useState\(\{\}\);\s*const askedElsewhere = useRef\(new Set\(\)\);/.test(source),
        /const reading = readCategoryList\(rows, params, \{ allJobs, jobs, q: typed, job, elsewhere \}\);/.test(source),
        /const askElsewhere = \(text\) => \{\s*if \(!text \|\| askedElsewhere\.current\.has\(text\)\) return;\s*askedElsewhere\.current\.add\(text\);\s*readFoundElsewhereAction\(text\)\.then\(/.test(source),
        /if \(answer && Object\.hasOwn\(answer, "found"\)\) setElsewhere\(\(was\) => \(\{ \.\.\.was, \[text\]: answer\.found \}\)\);/.test(source),
        // An id is asked at once, and what may be a serial number once the typing rests (#601).
        /if \(reading\.asksBy !== "serial"\) \{\s*askElsewhere\(text\);\s*return undefined;\s*\}\s*const resting = window\.setTimeout\(\(\) => askElsewhere\(text\), SERIAL_ASK_REST_MS\);\s*return \(\) => window\.clearTimeout\(resting\);\s*\}, \[reading\.asks, reading\.asksBy\]\);/.test(source),
    ].join(" ");
}

/** Where the line says the job, off its source. */
function lineJobOf(source) {
    const name = source.search(/<span className="min-w-0 truncate">\{itemName\}<\/span>/);
    const job = source.search(/\{jobCode && \(\s*<>\s*<Dot \/>\s*<span className="shrink-0 text-foreground-muted tabular-nums">\{jobCode\}<\/span>\s*<\/>\s*\)\}/);
    const status = source.search(/<StatusMark status=\{status\} \/>/);
    return [/const \{ assetId, status, itemName, jobCode = null, serialNumber = null \} = found;/.test(source), name >= 0 && job > name && status > job].join(" ");
}

/** What the action does, in order, off its source. */
function elsewhereReadOf(source) {
    const body = bodyOf(source, "readFoundElsewhereAction");
    const at = (pattern) => body.search(pattern);
    const steps = [
        at(/await requireUser\(\);/),
        at(/const asked = searchedAssetId\(searched\);/),
        at(/const serialNumber = asked \? "" : keptSerial\(searched\);/),
        at(/if \(!asked && serialNumber === ""\) return \{ found: \[\] \};/),
        // An id by its printed id, anything else as a serial number, whole (#601).
        at(/const assets = asked \? \[await getAssetByAssetId\(asked\)\]\.filter\(Boolean\) : await getAssetsBySerialNumber\(serialNumber\);/),
        at(/if \(assets\.length === 0\) return \{ found: \[\] \};/),
        at(/const nameOf = new Map\(\(await getAssetCategoriesByRecordIds\(kindIds\)\)\.map\(\(kind\) => \[kind\.id, kind\.itemName\]\)\);/),
        at(/job: asset\.job\[0\] \?\? null,\s*\.\.\.\(asked \? \{\} : \{ serialNumber: asset\.serialNumber \}\),/),
        at(/return \{ found \};/),
    ];
    const ordered = steps.every((each, index, all) => each >= 0 && (index === 0 || each > all[index - 1]));
    const label = /return withOpsLabel\("readFoundElsewhereAction", async \(\) => \{/.test(body);
    const failure = /\} catch \(error\) \{\s*console\.error\([^)]*\);\s*return \{ unread: true \};\s*\}/.test(body);
    const onlyReader = !/getAssetStatuses|getAssetsByRecordIds|getAssetsByAssetIds|getAllAssetCategories/.test(body);
    return `${label} ${ordered} ${failure} ${onlyReader}`;
}

export function run({ check, log }) {
    // ── the five cases ──────────────────────────────────────────────────────
    log("an id on the job the list stands on:");
    const here = read(JOB_ONE, "q=261019-430");
    check("an id the job holds is found in its rows, no job named, and nothing is asked", said(here), "kWelder | HYE-AST-261019-430 · TIG Welder · - · Out | -");

    log("");
    log("an id at another job:");
    const asked = read(JOB_ONE, "q=261019-432");
    check("an id no item on the one job carries is asked of every job, and nothing is drawn before the answer", said(asked), "- | - | HYE-AST-261019-432");
    check("  meanwhile the sentence names the job the list stands on", sentence(asked, "23-USA-09"), "No item on 23-USA-09 has the ID | 261019-432 | Clear search");
    const there = read(JOB_ONE, "q=261019-432", { elsewhere: { "HYE-AST-261019-432": AT_JOB_TWO } });
    check("the answer is the way to the item with its job named, over rows that stay the job's and empty", said(there), "- | HYE-AST-261019-432 · TIG Welder · 25-USA-13 · Retired | HYE-AST-261019-432");
    check("  and the table still says its job holds no item with the id", sentence(there, "23-USA-09"), "No item on 23-USA-09 has the ID | 261019-432 | Clear search");
    check("  an id typed in any case is asked by its stored spelling", read(JOB_ONE, "q= hye-ast-261019-432 ").asks, "HYE-AST-261019-432");

    log("");
    log("an id no job holds:");
    const nowhere = read(JOB_ONE, "q=261019-999", { elsewhere: { "HYE-AST-261019-999": null } });
    check("an answer of none draws no line", said(nowhere), "- | - | HYE-AST-261019-999");
    check("  and the sentence is the drawing's, naming no job", sentence(nowhere, "23-USA-09"), "No item has the ID | 261019-999 | Clear search");

    log("");
    log("a deleted item:");
    check("a deleted item is one the app does not show", isShownAsset({ status: ASSET_STATUS.DELETED }), false);
    const deleted = read(JOB_ONE, "q=261030-002", { elsewhere: { "HYE-AST-261030-002": null } });
    check(
        "  so no row on its own job carries its id, it is asked of every job, and the base's none says it is on none",
        `${said(deleted)} | ${sentence(deleted, "23-USA-09")}`,
        "- | - | HYE-AST-261030-002 | No item has the ID | 261030-002 | Clear search"
    );
    const assetsSource = parseFile(ASSETS).source;
    check("  the reader by printed id hands back no deleted asset", /return isShownAsset\(asset\) \? asset : null;/.test(bodyOf(assetsSource, "getAssetByAssetId")), true);

    log("");
    log("a name:");
    const named = read(JOB_ONE, "q=saw");
    // A name no row on the job answers is asked of every job as what may be a serial number (#601),
    // once the typing rests — the base finds an item by its number and never by its kind's name, so a
    // kind another job holds is still not found, and the table's sentence is the name's.
    check(
        "a name is searched on the chosen job alone: a kind another job holds is not found, and the text is asked as a serial number (#601)",
        `${said(named)} ${named.asksBy} | ${sentence(named, "23-USA-09")}`,
        "- | - | saw serial | No items match | saw | Clear search"
    );
    check("  and a name the job holds is found in its rows, with no line, and nothing is asked", `${said(read(JOB_ONE, "q=welder"))} ${read(JOB_ONE, "q=welder").asksBy}`, "kWelder | - | - null");

    // ── the band's case ─────────────────────────────────────────────────────
    log("");
    log("an id an item carries though the band leaves it off:");
    // On all jobs with the `Job` chip on the first job alone; the item stands on the second.
    const offChip = read(ALL, "q=261019-432&job=all&job=recJ1", { allJobs: true });
    check("on all jobs an id on a job the Job chip takes off is asked of every job, and nothing is drawn before the answer", said(offChip), "- | - | HYE-AST-261019-432");
    check("  and the sentence says the filters hold no item with it, the control clearing all", sentence(offChip, null), "No item in these filters has the ID | 261019-432 | Clear all");
    const offChipThere = read(ALL, "q=261019-432&job=all&job=recJ1", { allJobs: true, elsewhere: { "HYE-AST-261019-432": AT_JOB_TWO } });
    check(
        "  the answer is the way to the item with its job named, over rows the chip still narrows, and empty",
        `${said(offChipThere)} | ${sentence(offChipThere, null)} | ${offChipThere.held.jobs.join(",")}`,
        "- | HYE-AST-261019-432 · TIG Welder · 25-USA-13 · Retired | HYE-AST-261019-432 | No item in these filters has the ID | 261019-432 | Clear all | recJ1"
    );
    const onChip = read(ALL, "q=261019-432&job=all&job=recJ2", { allJobs: true });
    check("  the chip taking the item's job finds it in its row, and asks nothing", said(onChip), "kWelder | HYE-AST-261019-432 · TIG Welder · - · Retired | -");
    const chipNowhere = read(ALL, "q=261019-999&job=all&job=recJ1", { allJobs: true });
    check("  an id no row carries says the drawing's sentence whatever the chip holds, and asks nothing", `${said(chipNowhere)} | ${sentence(chipNowhere, null)}`, "- | - | - | No item has the ID | 261019-999 | Clear all");
    const typeOff = read(ALL, "q=261019-432&type=Tool", { allJobs: true, elsewhere: { "HYE-AST-261019-432": AT_JOB_TWO } });
    check(
        "on all jobs a type leaving the item's row off is the same: the line, and the filters holding none",
        `${said(typeOff)} | ${sentence(typeOff, null)}`,
        "- | HYE-AST-261019-432 · TIG Welder · 25-USA-13 · Retired | HYE-AST-261019-432 | No item in these filters has the ID | 261019-432 | Clear all"
    );
    const hidden = read(JOB_ONE, "q=261019-430&type=Tool");
    check(
        "on one job an item of its own a type leaves off is asked too, and the sentence says the filters hold none",
        `${said(hidden)} | ${sentence(hidden, "23-USA-09")}`,
        "- | - | HYE-AST-261019-430 | No item in these filters has the ID | 261019-430 | Clear all"
    );
    const hiddenThere = read(JOB_ONE, "q=261019-430&type=Tool", {
        elsewhere: { "HYE-AST-261019-430": { assetId: "HYE-AST-261019-430", itemName: "TIG Welder", status: ASSET_STATUS.OUT, job: "recJ1" } },
    });
    check("  and its answer on the list's own job is the way to it, the job named", said(hiddenThere), "- | HYE-AST-261019-430 · TIG Welder · 23-USA-09 · Out | HYE-AST-261019-430");
    const goneSince = read(ALL, "q=261019-432&job=all&job=recJ1", { allJobs: true, elsewhere: { "HYE-AST-261019-432": null } });
    check("an id a row carried that the base answers none for says the drawing's sentence", `${said(goneSince)} | ${sentence(goneSince, null)}`, "- | - | HYE-AST-261019-432 | No item has the ID | 261019-432 | Clear all");

    // ── around them ─────────────────────────────────────────────────────────
    log("");
    log("where nothing is asked, and answers that draw no line:");
    const allNowhere = read(ALL, "q=261019-999", { allJobs: true });
    check("on all jobs, which are every job, an id the rows do not carry is asked of nothing", said(allNowhere), "- | - | -");
    check("  and says the drawing's sentence", sentence(allNowhere, null), "No item has the ID | 261019-999 | Clear search");
    const allThere = read(ALL, "q=261019-432", { allJobs: true, elsewhere: { "HYE-AST-261019-432": AT_JOB_TWO } });
    check("  an id on any job is found in its row, the line naming no job, whatever answer is held", said(allThere), "kWelder | HYE-AST-261019-432 · TIG Welder · - · Retired | -");
    const typedThere = read(JOB_ONE, "q=261019-432&type=Tool", { elsewhere: { "HYE-AST-261019-432": AT_JOB_TWO } });
    check(
        "on one job an item at another job stands over the rows whatever the chips hold, the job's sentence and the control clearing all",
        `${said(typedThere)} | ${sentence(typedThere, "23-USA-09")}`,
        "- | HYE-AST-261019-432 · TIG Welder · 25-USA-13 · Retired | HYE-AST-261019-432 | No item on 23-USA-09 has the ID | 261019-432 | Clear all"
    );
    const ownJob = read(JOB_ONE, "q=261019-432", { elsewhere: { "HYE-AST-261019-432": { ...AT_JOB_TWO, job: "recJ1" } } });
    check("an answer putting an item its rows do not carry on the list's own job draws no line", said(ownJob), "- | - | HYE-AST-261019-432");
    const goneJob = read(JOB_ONE, "q=261019-432", { elsewhere: { "HYE-AST-261019-432": { ...AT_JOB_TWO, job: "recGone" } } });
    check("  nor one on a job the choice does not hold", said(goneJob), "- | - | HYE-AST-261019-432");
    check("  and neither says the item is on no job", `${ownJob.nowhere} ${goneJob.nowhere} ${sentence(goneJob, "23-USA-09")}`, "false false No item on 23-USA-09 has the ID | 261019-432 | Clear search");
    const otherIds = read(JOB_ONE, "q=261019-432", { elsewhere: { "HYE-AST-261019-999": null, "HYE-AST-261019-431": AT_JOB_TWO } });
    check("an answer is drawn beside its own id alone", `${said(otherIds)} ${otherIds.nowhere}`, "- | - | HYE-AST-261019-432 false");
    const unsearched = read(JOB_ONE, "");
    check("a list nobody searched asks nothing", `${unsearched.asks} ${unsearched.asksBy} ${unsearched.nowhere} ${unsearched.found.length}`, "null null false 0");

    // ── the source ──────────────────────────────────────────────────────────
    log("");
    log("the wiring, off the source:");
    check(
        "the list hands its reading the job and the answers, asks the one id it names once, and keeps an answer that says something under the id asked",
        listAskOf(parseFile(LIST).source),
        "true true true true true"
    );
    check(
        "  where a planted list asking on every render and keeping whatever comes back is seen",
        listAskOf(
            "const [elsewhere, setElsewhere] = useState({});\nconst reading = readCategoryList(rows, params, { allJobs, jobs, q: typed });\nreadFoundElsewhereAction(reading.asks).then(\n    (answer) => setElsewhere(answer),\n}, [reading]);\n"
        ),
        "false false false false false"
    );
    check("the line says the job after the name and before the status, behind the same dot", lineJobOf(parseFile(FOUND).source), "true true");
    check(
        "  where a planted line saying the job after the status is seen",
        lineJobOf(
            'const { assetId, status, itemName } = found;\n<span className="min-w-0 truncate">{itemName}</span>\n<StatusMark status={status} />\n{jobCode && (\n    <>\n        <Dot />\n        <span className="shrink-0 text-foreground-muted tabular-nums">{jobCode}</span>\n    </>\n)}\n'
        ),
        "false false"
    );
    check(
        "the action is labeled, gates before it reads, reads by the id the search named — or by the serial number it may be (#601) — and then its kinds, answers a failed read as neither, and reads no other way",
        elsewhereReadOf(parseFile(ACTIONS).source),
        "true true true true"
    );
    check(
        "  where a planted action reading before its gate, answering a failure as none and reading every status is seen",
        elsewhereReadOf(
            'export async function readFoundElsewhereAction(assetId) {\n    return withOpsLabel("readFoundElsewhereAction", async () => {\n        const asked = searchedAssetId(assetId);\n        if (!asked) return { found: null };\n        try {\n            await getAssetStatuses([]);\n            const asset = await getAssetByAssetId(asked);\n            await requireUser();\n            if (!asset) return { found: null };\n            const [kind] = await getAssetCategoriesByRecordIds(asset.category.slice(0, 1));\n            return { found: { assetId: asset.assetId, itemName: kind?.itemName ?? "", status: asset.status, job: asset.job[0] ?? null } };\n        } catch (error) {\n            console.error("x", error);\n            return { found: null };\n        }\n    });\n}\n'
        ),
        "true false false false"
    );
    check("the page asks it nothing: a view reads what it read before", /readFoundElsewhereAction/.test(parseFile(PAGE).source), false);
}

if (isMain(import.meta.url)) standalone(title, run);

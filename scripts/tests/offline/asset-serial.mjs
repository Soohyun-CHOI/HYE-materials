// An item's serial number (#601): what a typed one keeps, the key two are compared by, who may
// write it, when a press is refused and which item a number is taken by, where the list finds an
// item by it, and where the screens and the action ask.
//
// BY VALUE, THE RULES. `lib/assetSerial.js` is pure, so the kept form, the key — case and the spaces
// around a number tell no two apart, every other character does — the order a press is answered in
// and `serialHolder` over a fixture of kinds and statuses are asserted on inputs; so are
// `planTransition`'s `mayWriteSerial` over readers and statuses, the list's search over rows the
// list's own composition builds, the status memory keeping each number, and every word.
//
// OFF THE SOURCE, THE WIRING. That the action is the note's wrapper and plan with one question more —
// the number read again under a lock keyed by it, the holder asked before the one write — that the
// writer keeps one field and the reader one query; and that the pages hand the number on. Source
// order is not execution order (`_ast.mjs`), and a browser is where the screens are seen.
//
// WHAT IT CANNOT SEE: whether `Assets."Serial Number"` exists on a base, which is
// `scripts/import/ran/add_serial_number_601.mjs`'s read, and what Airtable's `LOWER` and `TRIM` answer,
// which only a query against a base shows (`docs/notes/verification.md`: formulas are outside CI).
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { ASSET_SERIAL_COPY, SERIAL_MAX, keptSerial, readSerialSubmission, serialHolder, serialKey } from "../../../lib/assetSerial.js";
import { ASSET_NOTE_COPY } from "../../../lib/assetNote.js";
import { ASSET_STATUS, ASSET_STATUS_VALUES } from "../../../lib/assetStatus.js";
import { planTransition } from "../../../lib/assetTransition.js";
import { ASSET_LIST_COPY, SERIAL_ASK_REST_MS, emptiedListWords, readCategoryList, summarizeAssetCategories } from "../../../lib/assetListView.js";
import { ALL_JOBS } from "../../../lib/assetRoutes.js";
import { createAssetStatusMemory } from "../../../lib/assetStatusMemory.js";
import { parseFile, parseSource, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An item's serial number: what it keeps, who writes it, which item holds one, and where it is found (#601)";

const ACTIONS = "app/(assets)/assets/[assetId]/actions.js";
const ASSETS = "lib/airtable/assets.js";
const DETAILS = "app/(assets)/assets/[assetId]/ItemDetails.js";
const PROVIDER = "app/(assets)/assets/[assetId]/AssetTransition.js";
const ITEM_PAGE = "app/(assets)/assets/[assetId]/page.js";
const CATEGORY_PAGE = "app/(assets)/asset-categories/[categoryRecordId]/page.js";
const ASSET_LIST = "app/(assets)/asset-categories/[categoryRecordId]/AssetList.js";
const FOUND = "app/(assets)/asset-categories/FoundItem.js";

const J1 = { id: "recJ1", jobCode: "23-USA-09" };
const J2 = { id: "recJ2", jobCode: "25-USA-13" };
const JOBS = [J1, J2];

/** The readers the issue names, each with what marks them. */
const READERS = {
    "site manager on the item's job": { isSiteManager: true, assignedJobs: [J1.id] },
    "site manager on another job": { isSiteManager: true, assignedJobs: [J2.id] },
    "site manager on no job": { isSiteManager: true, assignedJobs: [] },
    "not a site manager, on the item's job": { isSiteManager: false, assignedJobs: [J1.id] },
    "office, not a site manager, on the item's job": { isAdmin: true, isSiteManager: false, assignedJobs: [J1.id] },
};

/** The page handing a width the number, the note and the plan's two answers (#601). */
const HANDED = /serialNumber=\{asset\.serialNumber\} note=\{asset\.note\} mayWriteSerial=\{transition\.mayWriteSerial\} mayWriteNote=\{transition\.mayWriteNote\}/g;

/** A function's own source by name, or the empty string. */
function functionSource({ ast, source }, name) {
    const fn = resolveFunction(ast, name);
    return fn ? source.slice(fn.start, fn.end) : "";
}

/** What the serial number's handler asks and does, read off its source. */
export function serialActionFacts(handler) {
    const lock = handler.indexOf("withKeyLock(");
    const lockEnd = handler.indexOf("\n        });", lock);
    const locked = lock >= 0 && lockEnd > lock ? handler.slice(lock, lockEnd) : "";
    const at = (pattern) => locked.search(pattern);
    const order = [
        at(/const asset = await getAssetByAssetId\(asked\);/),
        at(/const plan = planTransition\(\{ user, jobs: await getAllJobs\(\), status: asset\.status, assetJobId: asset\.job\?\.\[0\], ownerJobId: asset\.ownerJob\?\.\[0\] \}\);/),
        at(/const recording = recordingRefusal\(plan, \{ drawnJobId: String\(formData\.get\("drawnJobId"\) \?\? ""\) \}\);/),
        at(/const answer = readSerialSubmission\(plan, \{ typed, previous: String\(formData\.get\("previous"\) \?\? ""\), stored: asset\.serialNumber \}\);/),
        at(/items: await getAssetsBySerialNumber\(answer\.serialNumber\),/),
        at(/if \(holder\) return \{ refusal: ASSET_SERIAL_COPY\.takenBy\(holder\), takenBy: holder \};/),
        at(/await updateAssetSerialNumber\(\{ assetRecordId: asset\.id, serialNumber: answer\.serialNumber \}\);/),
    ];
    return {
        label: /return withOpsLabel\("updateAssetSerialAction", async \(\) => \{/.test(handler),
        lockedOnTheNumber: /const lockKey = serialKey\(typed\) === "" \? `asset-serial-of:\$\{normalizeItemText\(asked\)\.toLowerCase\(\)\}` : `asset-serial:\$\{serialKey\(typed\)\}`;/.test(handler) && /withKeyLock\(lockKey, async \(\) => \{/.test(handler),
        ordered: order.every((each, index, all) => each >= 0 && (index === 0 || each > all[index - 1])),
        kindAsked: /categoryRecordId: asset\.category\?\.\[0\],/.test(locked) && /assetRecordId: asset\.id,/.test(locked),
        clearedAsksNothing: /if \(answer\.serialNumber !== ""\) \{/.test(locked),
        noEvent: !/createAssetLogEntry|updateAssetCache|updateAssetNote\b/.test(handler),
        refused: /if \(outcome\.refusal\) return refuse\(outcome\.refusal, null, outcome\.takenBy \?\? null\);/.test(handler),
    };
}

export async function run({ check, log }) {
    // ── what a serial number keeps, and the key ─────────────────────────────
    log("what a serial number keeps, and the key two are compared by:");
    check("trimmed, each run of spaces one, its case as typed", JSON.stringify(keptSerial("  b53-AD  2304 217 ")), '"b53-AD 2304 217"');
    check("  and nothing typed is no number", `${JSON.stringify(keptSerial(undefined))} ${JSON.stringify(serialKey("   "))}`, '"" ""');
    check("the key ignores case and the spaces around it", [serialKey(" B53AD2304217 "), serialKey("b53ad2304217")].join(" = "), "b53ad2304217 = b53ad2304217");
    check(
        "  and tells every other character apart: a hyphen, a slash, a dot, a space inside",
        ["B53AD2304217", "B53-AD2304217", "B53/AD2304217", "B53.AD2304217", "B53 AD2304217"].map(serialKey).filter((key, index, all) => all.indexOf(key) === index).length,
        5
    );

    // ── the press, in order ─────────────────────────────────────────────────
    log("");
    log("what a press writing one does, in the note's order:");
    const may = { mayWriteSerial: true };
    const answer = (plan, input) => JSON.stringify(readSerialSubmission(plan, input));
    check("a reader who may not write is answered first, and told nothing", answer({ mayWriteSerial: false }, { typed: "x".repeat(60), previous: "A", stored: "B" }), '{"ended":true}');
    check("  a number somebody else changed is said before a length", answer(may, { typed: "x".repeat(60), previous: "A", stored: "B" }), JSON.stringify({ refusal: ASSET_SERIAL_COPY.changedFirst, stale: true }));
    check("  compared as kept, so a stored one with stray spaces is no change", answer(may, { typed: "C", previous: "A1", stored: " A1 " }), '{"serialNumber":"C"}');
    check(`  past ${SERIAL_MAX} typed is refused, measured on what is typed`, answer(may, { typed: `${"x".repeat(25)}  ${"x".repeat(24)}`, previous: "", stored: "" }), JSON.stringify({ refusal: ASSET_SERIAL_COPY.tooLong }));
    check(`  and ${SERIAL_MAX} is kept`, answer(may, { typed: "x".repeat(SERIAL_MAX), previous: "", stored: "" }), JSON.stringify({ serialNumber: "x".repeat(SERIAL_MAX) }));
    check("  a number kept to the one there writes nothing", answer(may, { typed: "  B53AD2304217 ", previous: "B53AD2304217", stored: "B53AD2304217" }), '{"unchanged":true}');
    check("  but its case changed is a change", answer(may, { typed: "b53ad2304217", previous: "B53AD2304217", stored: "B53AD2304217" }), '{"serialNumber":"b53ad2304217"}');
    check("  a cleared field removes it", answer(may, { typed: "   ", previous: "B53AD2304217", stored: "B53AD2304217" }), '{"serialNumber":""}');
    check("  and a number typed is kept", answer(may, { typed: " J47AD  2210396 ", previous: "", stored: "" }), '{"serialNumber":"J47AD 2210396"}');

    // ── which item holds a number ───────────────────────────────────────────
    log("");
    log("which item already holds a number — the same kind, not itself, not deleted:");
    const it = (id, assetId, kind, status, serialNumber) => ({ id, assetId, category: [kind], status, serialNumber });
    const ITEMS = [
        it("a1", "HYE-AST-261001-001", "kDrill", ASSET_STATUS.IN_STOCK, "B53AD2304217"),
        it("a2", "HYE-AST-261001-002", "kSaw", ASSET_STATUS.OUT, "B53AD2304217"),
        it("a3", "HYE-AST-261001-003", "kDrill", ASSET_STATUS.RETIRED, "R-77"),
        it("a4", "HYE-AST-261001-004", "kDrill", ASSET_STATUS.DELETED, "D-9"),
        it("a5", "HYE-AST-261001-005", "kDrill", ASSET_STATUS.IN_REPAIR, "x-1"),
        it("a6", "HYE-AST-261001-006", "kDrill", ASSET_STATUS.OUT, "x-1"),
        // An item of the kind holding none, which an empty number would otherwise name.
        it("a7", "HYE-AST-261001-007", "kDrill", ASSET_STATUS.IN_STOCK, ""),
    ];
    const holder = (serialNumber, assetRecordId = "aNew", categoryRecordId = "kDrill") => serialHolder({ serialNumber, assetRecordId, categoryRecordId, items: ITEMS }) ?? "none";
    check("the same kind holding it is named", holder("B53AD2304217"), "HYE-AST-261001-001");
    check("  another kind holding it is not", holder("B53AD2304217", "aNew", "kWelder"), "none");
    check("  a saw's own number on a saw names the saw, the drill's being another kind", holder("B53AD2304217", "aNew", "kSaw"), "HYE-AST-261001-002");
    check("  case and the spaces around it do not tell it apart", holder("  b53ad2304217 "), "HYE-AST-261001-001");
    check("  a hyphen does", holder("B53-AD2304217"), "none");
    check("  a retired item still holds its number", holder("r-77"), "HYE-AST-261001-003");
    check("  a deleted one holds none", holder("D-9"), "none");
    check("  the item being written is not its own holder", holder("B53AD2304217", "a1"), "none");
    check("  where two hold it, the lowest printed id, every time", holder("X-1"), "HYE-AST-261001-005");
    check("  and an empty number is held by nobody", holder("  "), "none");

    // ── who may write it ────────────────────────────────────────────────────
    log("");
    log("who may write it — planTransition's mayWriteSerial, reader by reader, status by status:");
    const plan = (reader, status) => planTransition({ user: READERS[reader], jobs: JOBS, status, assetJobId: J1.id, ownerJobId: J1.id });
    const SHOWN = [ASSET_STATUS.IN_STOCK, ASSET_STATUS.OUT, ASSET_STATUS.IN_REPAIR, ASSET_STATUS.RETIRED, ASSET_STATUS.DELETED];
    const row = (reader) => SHOWN.map((status) => `${status}: ${plan(reader, status).mayWriteSerial}`).join(", ");
    check("the item's own job's site manager: in every status the app shows (#612)", row("site manager on the item's job"), "In stock: true, Out: true, In repair: true, Retired: true, Deleted: false");
    for (const reader of Object.keys(READERS).slice(1)) {
        check(`  ${reader}: never`, SHOWN.map((status) => plan(reader, status).mayWriteSerial).join(","), "false,false,false,false,false");
    }
    check(
        "  and on every reader and status it is the note's answer",
        Object.keys(READERS)
            .flatMap((reader) => ASSET_STATUS_VALUES.map((status) => plan(reader, status)))
            .filter((answer) => answer.mayWriteSerial !== answer.mayWriteNote).length,
        0
    );
    check(
        "  an item lent to the reader's job is theirs to write, its owner job's site manager's no longer",
        [
            planTransition({ user: READERS["site manager on another job"], jobs: JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: J2.id, ownerJobId: J1.id }).mayWriteSerial,
            planTransition({ user: READERS["site manager on the item's job"], jobs: JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: J2.id, ownerJobId: J1.id }).mayWriteSerial,
        ].join(" "),
        "true false"
    );

    // ── where the list finds an item by it ──────────────────────────────────
    log("");
    log("the list finds an item by its serial number, whole, on what it stands on, and asks every job of the rest:");
    const KINDS = [
        { id: "kDrill", itemName: "Drill, DeWalt", level1: "Tool", level2: "Power Tool" },
        { id: "kSaw", itemName: "Band Saw", level1: "Tool", level2: "Cutting" },
        { id: "kGauge", itemName: "Gap Gauge", level1: "Tool", level2: "Measuring" },
    ];
    const asset = (assetId, kind, job, status, serialNumber = "") => ({ id: `rec${assetId.slice(-3)}`, assetId, category: [kind], job: [job], status, serialNumber, lastEventAt: null });
    const ON_J1 = [
        asset("HYE-AST-261001-001", "kDrill", J1.id, ASSET_STATUS.IN_STOCK, "B53AD2304217"),
        asset("HYE-AST-261001-002", "kSaw", J1.id, ASSET_STATUS.OUT, "B53AD2304217"),
        asset("HYE-AST-261001-003", "kSaw", J1.id, ASSET_STATUS.IN_STOCK),
    ];
    const ON_J2 = [asset("HYE-AST-261002-001", "kGauge", J2.id, ASSET_STATUS.RETIRED, "J47AD2210396")];
    const ONE_JOB = summarizeAssetCategories(KINDS, ON_J1);
    const EVERY_JOB = summarizeAssetCategories(KINDS, [...ON_J1, ...ON_J2]);
    const read = (rows, search, { allJobs = false, elsewhere = {} } = {}) =>
        readCategoryList(rows, new URLSearchParams(search), { allJobs, jobs: JOBS, job: allJobs ? ALL_JOBS : J1.id, elsewhere });
    const said = (reading) =>
        [
            reading.rows.map((each) => each.id).join(",") || "-",
            reading.found.map((item) => [item.assetId, item.serialNumber ?? "-", item.itemName, item.jobCode ?? "-", item.status].join(" · ")).join(" + ") || "-",
            reading.asks ?? "-",
            reading.asksBy ?? "-",
        ].join(" | ");
    const sentence = (reading, jobCode) => {
        const words = emptiedListWords(reading, { jobCode });
        return `${words.sentence} | ${words.typed}`;
    };
    check("each row carries its items' numbers by job and printed id, and nothing for an item with none", JSON.stringify(ONE_JOB.find((each) => each.id === "kSaw").serials), '{"recJ1":{"HYE-AST-261001-002":"B53AD2304217"}}');
    check(
        "a number on the job finds every item of it there, each kind's row and a line each in the rows' order naming the job, asking nothing",
        said(read(ONE_JOB, "q=b53ad2304217")),
        "kSaw,kDrill | HYE-AST-261001-002 · B53AD2304217 · Band Saw · 23-USA-09 · Out + HYE-AST-261001-001 · B53AD2304217 · Drill, DeWalt · 23-USA-09 · In stock | - | -"
    );
    check("  the spaces around it are no part of it", said(read(ONE_JOB, "q=%20%20B53AD2304217%20")).split(" | ")[0], "kSaw,kDrill");
    check("  a part of it finds no item by it, and is asked as what may be a number", said(read(ONE_JOB, "q=B53AD")), "- | - | B53AD | serial");
    check("  a name is searched as before, and asks nothing", said(read(ONE_JOB, "q=saw")), "kSaw | - | - | -");
    const there = read(ONE_JOB, "q=j47ad2210396");
    check("a number on another job is asked of every job, once the typing rests", said(there), "- | - | j47ad2210396 | serial");
    check("  and until the answer the table's sentence is a name's", sentence(there, J1.jobCode), "No items match | j47ad2210396");
    const answered = read(ONE_JOB, "q=j47ad2210396", {
        elsewhere: { j47ad2210396: [{ assetId: "HYE-AST-261002-001", itemName: "Gap Gauge", status: ASSET_STATUS.RETIRED, job: J2.id, serialNumber: "J47AD2210396" }] },
    });
    check("  the answer is the way to the item, its number, its job and a retired status", said(answered), "- | HYE-AST-261002-001 · J47AD2210396 · Gap Gauge · 25-USA-13 · Retired | j47ad2210396 | serial");
    check("  over the job's emptied rows, which name the job and the number", `${answered.bySerial} ${sentence(answered, J1.jobCode)}`, "true No item on 23-USA-09 has the serial number | j47ad2210396");
    const nowhere = read(ONE_JOB, "q=ZZ9999", { elsewhere: { ZZ9999: [] } });
    check("  a number the base finds on no item says a name's sentence", `${nowhere.nowhere} ${nowhere.bySerial} ${sentence(nowhere, J1.jobCode)}`, "true false No items match | ZZ9999");
    check("on all jobs, which are every job, a number no row carries is asked of nothing", said(read(EVERY_JOB, "q=ZZ9999&job=all", { allJobs: true })), "- | - | - | -");
    check("  and one on any job is found in its row, its line naming the job it is on", said(read(EVERY_JOB, "q=J47AD2210396&job=all", { allJobs: true })), "kGauge | HYE-AST-261002-001 · J47AD2210396 · Gap Gauge · 25-USA-13 · Retired | - | -");
    const offChip = read(EVERY_JOB, `q=J47AD2210396&job=all&job=${J1.id}`, { allJobs: true });
    check("  the Job chip taking its job off asks every job, as an id is asked", said(offChip), "- | - | J47AD2210396 | serial");
    const offChipAnswered = read(EVERY_JOB, `q=J47AD2210396&job=all&job=${J1.id}`, {
        allJobs: true,
        elsewhere: { J47AD2210396: [{ assetId: "HYE-AST-261002-001", itemName: "Gap Gauge", status: ASSET_STATUS.RETIRED, job: J2.id, serialNumber: "J47AD2210396" }] },
    });
    check("  and its answer drawn over the filters' sentence", `${said(offChipAnswered).split(" | ")[1]} | ${sentence(offChipAnswered, null)}`, "HYE-AST-261002-001 · J47AD2210396 · Gap Gauge · 25-USA-13 · Retired | No item in these filters has the serial number | J47AD2210396");
    // A number held twice in a kind — the base may hold what the app would refuse — one of them on a job
    // the `Job` chip takes off: the line is the chip's job's item alone.
    const twice = read(summarizeAssetCategories(KINDS, [...ON_J1, ...ON_J2, asset("HYE-AST-261002-002", "kSaw", J2.id, ASSET_STATUS.IN_STOCK, "B53AD2304217")]), `q=B53AD2304217&job=all&job=${J1.id}`, {
        allJobs: true,
    });
    check("  and the line names the chip's jobs' items alone, where the kind holds the number on another job too", said(twice).split(" | ")[1], "HYE-AST-261001-002 · B53AD2304217 · Band Saw · 23-USA-09 · Out + HYE-AST-261001-001 · B53AD2304217 · Drill, DeWalt · 23-USA-09 · In stock");
    const unsearched = [read(ONE_JOB, ""), read([], "")];
    check("a list nobody searched asks nothing, a job with no rows included", unsearched.map((each) => `${each.asks} ${each.asksBy} ${each.found.length}`).join(" | "), "null null 0 | null null 0");
    check("what may be a number is asked once the typing has rested half a second", SERIAL_ASK_REST_MS, 500);

    // ── the memory keeps each number ────────────────────────────────────────
    log("");
    log("the list's memory keeps each asset's number beside its status, read with it:");
    const memory = createAssetStatusMemory({
        readByIds: async (ids) => ids.map((id) => ({ id, status: ASSET_STATUS.IN_STOCK, assetId: `HYE-AST-${id}`, lastEventAt: null, serialNumber: id === "x1" ? "B53AD2304217" : "" })),
        readChangedSince: async () => [],
        now: () => 0,
    });
    const kept = await memory(["x1", "x2"]);
    check("  a number, and none as the empty string", `${kept.get("x1").serialNumber} | ${JSON.stringify(kept.get("x2").serialNumber)}`, 'B53AD2304217 | ""');

    // ── the words ───────────────────────────────────────────────────────────
    log("");
    log("every word the screens say about a serial number, by value:");
    check("its name, and the desk row's short one", `${ASSET_SERIAL_COPY.label} | ${ASSET_SERIAL_COPY.rowLabel}`, "Serial number | Serial");
    check("  the openings", [ASSET_SERIAL_COPY.addSerial, ASSET_SERIAL_COPY.editSerial, ASSET_SERIAL_COPY.add, ASSET_SERIAL_COPY.edit].join(" | "), "Add serial number | Edit serial number | Add | Edit");
    check("  the actions, the note's", [ASSET_SERIAL_COPY.save, ASSET_SERIAL_COPY.cancel, ASSET_SERIAL_COPY.done, ASSET_SERIAL_COPY.clear].join(" | "), [ASSET_NOTE_COPY.save, ASSET_NOTE_COPY.cancel, ASSET_NOTE_COPY.done, ASSET_NOTE_COPY.clear].join(" | "));
    check("  a number taken, the design's sentence", `${ASSET_SERIAL_COPY.takenBy("HYE-AST-261019-104")} || ${ASSET_SERIAL_COPY.takenRest}`, "HYE-AST-261019-104 already has this serial number. || already has this serial number.");
    check("  too much, and one changed first, Soo's words (#612)", `${ASSET_SERIAL_COPY.tooLong} | ${ASSET_SERIAL_COPY.changedFirst}`, "Use 50 characters or fewer. | Someone else changed this serial number first. Nothing was saved.");
    check("  working, the note's", Object.values(ASSET_SERIAL_COPY.working).join(" | "), "Saving… | Adding… | Removing…");
    check(
        "the list's: the search, 1d's column and the two sentences",
        [ASSET_LIST_COPY.searchLabel, ASSET_LIST_COPY.serialLabel, ASSET_LIST_COPY.noSerialMatchOn("23-USA-09"), ASSET_LIST_COPY.noSerialMatchFiltered].join(" | "),
        "Search items, IDs or serials | Serial number | No item on 23-USA-09 has the serial number | No item in these filters has the serial number"
    );
    // THE FOUND LINE SAYS IT SHORT (1a3, #614): the files of 2026-11-05 draw `Serial` before the
    // number, the desk row's word, where they drew `Serial number`; 1d's column keeps the long one.
    check("the found line's word before the number, the short one (#614)", ASSET_LIST_COPY.foundSerialLabel, "Serial");

    // ── the action ──────────────────────────────────────────────────────────
    log("");
    log("the action, off its source:");
    const actions = parseFile(ACTIONS);
    check("the note's wrapper around a handler nobody can call round it", /export const updateAssetSerialAction = withSiteManagerAction\(refuseNotASiteManager, updateAssetSerialHandler\);/.test(actions.source) && !/export (async )?function updateAssetSerialHandler/.test(actions.source), true);
    const facts = serialActionFacts(functionSource(actions, "updateAssetSerialHandler"));
    check(
        "  labeled, locked on the number, the note's plan and order, the kind asked, a cleared number asking nothing, no event, and a taken number refused naming its holder",
        Object.entries(facts)
            .filter(([, v]) => !v)
            .map(([k]) => k)
            .join(" "),
        ""
    );

    // ── the writer and the reader ───────────────────────────────────────────
    log("");
    log("the writer and the reader:");
    const assets = parseFile(ASSETS);
    const writer = functionSource(assets, "updateAssetSerialNumber");
    check(
        "the writer: one field, in the batch form, cleared with null, refusing a number the app would not keep",
        [
            /await base\(TABLES\.ASSETS\)\.update\(\[\s*\{\s*id: assetRecordId,\s*fields: \{ \[SERIAL_NUMBER_FIELD\]: serialNumber === "" \? null : serialNumber \},\s*\},\s*\]\);/.test(writer),
            /if \(typeof serialNumber !== "string" \|\| serialNumber !== keptSerial\(serialNumber\) \|\| serialNumber\.length > SERIAL_MAX\) \{/.test(writer),
        ].join(" "),
        "true true"
    );
    const reader = functionSource(assets, "getAssetsBySerialNumber");
    check(
        "the reader: one page of one query on the number's key, escaped, handing back no deleted asset",
        [
            /const key = serialKey\(serialNumber\);\s*if \(key === ""\) return \[\];/.test(reader),
            /filterByFormula: `LOWER\(TRIM\(\{Serial Number\}\)\) = "\$\{formulaString\(key\)\}"`, maxRecords: 100 \}\)\s*\.firstPage\(\);/.test(reader),
            /return records\.map\(recordToAsset\)\.filter\(isShownAsset\);/.test(reader),
        ].join(" "),
        "true true true"
    );
    check(
        "every asset read carries its number, none as the empty string — the whole asset and the status memory's facts",
        (assets.source.match(/serialNumber: record\.get\(SERIAL_NUMBER_FIELD\) \?\? "",/g) ?? []).length,
        2
    );

    // ── the screens hand it on ──────────────────────────────────────────────
    log("");
    log("the screens hand it on:");
    const item = parseFile(ITEM_PAGE).source;
    check("the item's page hands it and the plan's answer to both widths", (item.match(HANDED) ?? []).length, 2);
    check("a category's rows carry it off the read they came from, and its list draws it", `${/serialNumber: asset\.serialNumber,/.test(parseFile(CATEGORY_PAGE).source)} ${/\{row\.serialNumber\}/.test(parseFile(ASSET_LIST).source)}`, "true true");
    const provider = parseFile(PROVIDER).source;
    check(
        "the provider holds its answer as the note's, ending a phone's opening the plan stops offering (#614)",
        [
            /const serial = useDetail\(updateAssetSerialAction, \{ field: "serialNumber", assetId, drawnJobId: assetJobRecordId, onSent: \(\) => setLastSent\("serial"\) \}\);/.test(provider),
            /if \(serial\.openOn === "phone" && !plan\.mayWriteSerial\) serial\.end\(\);/.test(provider),
            /serial: serial\.saidInOpening \? null : serial\.sentence,/.test(provider),
            /takenBy: saidInOpening \? \(answer\?\.takenBy \?\? null\) : null,/.test(provider),
        ].join(" "),
        "true true true true"
    );
    const details = parseFile(DETAILS);
    check(
        "the details' part asks the serial number's rule, and draws a number taken only while the field holds it",
        [
            /read: \(input\) => readSerialSubmission\(\{ mayWriteSerial: true \}, input\),/.test(details.source),
            /if \(serialKey\(draft\) !== serialKey\(control\.sentValue\)\) return \{ taken: null, said: null \};/.test(functionSource(details, "serverAnswer")),
            /<span className="font-id tracking-id">\{control\.takenBy\}<\/span> \{ASSET_SERIAL_COPY\.takenRest\}/.test(functionSource(details, "serverAnswer")),
            /\{\(serialNumber \|\| mayWriteSerial\) && <PhoneDetail kind="serial"/.test(functionSource(details, "PhoneDetails")),
        ].join(" "),
        "true true true true"
    );
    check("the found line says the number after the id", /\{serialNumber && \(\s*<>\s*<Dot \/>\s*<span className="shrink-0 text-foreground-subtle">\{ASSET_LIST_COPY\.foundSerialLabel\}<\/span>/.test(parseFile(FOUND).source), true);

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the source readers are seen to fail:");
    const wrong = serialActionFacts(
        "async function updateAssetSerialHandler(prevState, formData) {\n" +
            '    return withOpsLabel("updateAssetSerialAction", async () => {\n' +
            "        const outcome = await withKeyLock(`asset-serial:${asked}`, async () => {\n" +
            "            const asset = await getAssetByAssetId(asked);\n" +
            "            await updateAssetSerialNumber({ assetRecordId: asset.id, serialNumber: answer.serialNumber });\n" +
            "            await createAssetLogEntry({});\n" +
            "        });\n" +
            "    });\n}\n"
    );
    check(
        "  an action with no plan, no holder asked, an event and no refusal is seen so",
        Object.entries(wrong)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(" "),
        "label"
    );
    const plantedPage = parseSource(
        "const a = <><PhoneDetails serialNumber={asset.serialNumber} note={asset.note} mayWriteSerial={false} mayWriteNote={transition.mayWriteNote} />" +
            "<DetailsBlock serialNumber={asset.serialNumber} note={asset.note} mayWriteSerial={transition.mayWriteSerial} mayWriteNote={transition.mayWriteNote} /></>;",
        "<planted>"
    ).source;
    check("  a planted page handing the plan's answer to one width alone is read as one", (plantedPage.match(HANDED) ?? []).length, 1);
}

if (isMain(import.meta.url)) standalone(title, run);

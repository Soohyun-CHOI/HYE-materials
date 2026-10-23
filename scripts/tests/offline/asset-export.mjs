// The Tools & Equipment list as an Excel file (#553).
//
// FOUR THINGS, SPLIT AS THIS AXIS'S CHECKS SPLIT.
//
//   THE PRESS IS PURE (`lib/assetListExport.js:listExport`), handed its four reads, so it runs
//   here over a fixture of three jobs, five kinds and seven assets, and every read it asks for is
//   written down: the office on its first job, on all of them, and on all of them narrowed by the
//   `Job` chip, a type and a search; a site reader asking for a job off theirs and for all of
//   them; a reader on no job; a band that empties the list. Each sheet is held by value, and the
//   two sheets against each other — every first-sheet row is exactly as many second-sheet rows,
//   status for status, of its own type and category — which is a second path to the counts.
//   Since #541 a press on an item's id too: its row and every asset under it, and nothing for an
//   id off the list.
//
//   THE FILE IS READ BACK BY A SECOND LIBRARY. `lib/xlsxWorkbook.js` writes the zip with
//   `node:zlib`; `fflate` unzips it here, since an encoder decoding its own output proves only
//   that it agrees with itself (`verification.md`, #351). Read back: the parts, no formula
//   element anywhere, every text cell an inline string, every value that would start a formula
//   marked `quotePrefix` in a style that says so, the days as the serials Excel counts, the
//   numbers as numbers, and a blank as no cell.
//
//   THE PACE IS PURE (`lib/airtablePace.js`) and runs on a fake clock: seventeen requests, the
//   most a 643-asset export sends, never more than five in any second.
//
//   WHAT NO VALUE CAN SHOW IS READ OFF THE SOURCE: that the action hands `listExport` the user
//   `requireUser` answered, paces every read it hands it, and the session's; that `listExport`
//   reads its rows through the list's own functions and narrows nothing itself; that the list
//   reads its band through the same one; that `findByRecordIds` waits on a pace before each
//   chunk; and that the button sends the address and the reader's zone, says it is busy, says a
//   failure before itself, and stands in the list's head and nowhere else. Each beside a planted
//   file doing it wrong.
//
// WHAT IT CANNOT SEE. Whether Excel, Google Sheets or LibreOffice open the file without a
// warning — #553 opened its files in each and wrote what it saw into the pull request; what a
// press costs against the base, which the dev log's ops line measures; and the download itself.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { strFromU8, unzipSync } from "fflate";
import { XLSX_MEDIA_TYPE, excelDaySerial, startsFormula, workbookBytes } from "../../../lib/xlsxWorkbook.js";
import { AIRTABLE_PAGE_ROWS, AIRTABLE_REQUESTS_PER_SECOND, createRequestPace, pagesOf } from "../../../lib/airtablePace.js";
import { ASSET_EXPORT_COPY, listExport } from "../../../lib/assetListExport.js";
import { ASSET_EVENT, ASSET_STATUS, ASSET_STATUS_VALUES } from "../../../lib/assetStatus.js";
import { knownTimeZone } from "../../../lib/format.js";
import { parseFile, parseSource } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The Tools & Equipment list as an Excel file (#553)";

const ACTION = "app/(assets)/asset-categories/actions.js";
const BUTTON = "app/(assets)/asset-categories/ListExport.js";
const LIST = "app/(assets)/asset-categories/AssetCategoryList.js";
const PAGE = "app/(assets)/asset-categories/page.js";
const EXPORT = "lib/assetListExport.js";
const CLIENT = "lib/airtable/client.js";
const ASSETS = "lib/airtable/assets.js";

// ── the fixture ─────────────────────────────────────────────────────────────

const JOBS = [
    { id: "recJ2", jobCode: "25-USA-13", assets: ["a3", "a4", "a7"] },
    { id: "recJ1", jobCode: "23-USA-09", assets: ["a1", "a2", "a5"] },
    { id: "recJ3", jobCode: "26-USA-12", assets: ["a6"] },
];
const kind = (id, itemName, level1, level2, level3, size, maker, partNumber, assets) => ({ id, itemName, level1, level2, level3, size, maker, partNumber, assets });
const CATEGORIES = [
    kind("recK1", "Band Saw, DeWalt (DCS375)", "Tool", "Power Tool", "Band Saw", "", "DeWalt", "DCS375", ["a1", "a2", "a3"]),
    kind("recK2", "TIG Welder, Lincoln Electric (TIG 205)", "Equipment", "Welding Equipment", "TIG Welder", "", "Lincoln Electric", "TIG 205", ["a4", "a5"]),
    kind("recK3", "Hammer", "Tool", "Hand Tool", "Hammer", "", "", "", ["a6"]),
    kind("recK4", 'Drill 1/2"', "Tool", "Power Tool", "Drill", '1/2"', "", "", ["a7"]),
    // A catalog row nobody has bought (#507): on no list, and in no file.
    kind("recK5", "Grinder", "Tool", "Power Tool", "Grinder", "", "", "", []),
];
const asset = (id, assetId, status, job, category, note, assetLog) => ({ id, assetId, status, job: [job], category: [category], note, assetLog });
const ASSETS_HELD = [
    asset("a1", "HYE-AST-261001-001", ASSET_STATUS.IN_STOCK, "recJ1", "recK1", "", ["l1"]),
    asset("a2", "HYE-AST-261001-002", ASSET_STATUS.OUT, "recJ1", "recK1", "Kept in bay 2", ["l2a", "l2b"]),
    asset("a3", "HYE-AST-261001-003", ASSET_STATUS.RETIRED, "recJ2", "recK1", "", ["l3"]),
    asset("a4", "HYE-AST-261002-001", ASSET_STATUS.IN_REPAIR, "recJ2", "recK2", "", ["l4"]),
    asset("a5", "HYE-AST-261002-002", ASSET_STATUS.IN_STOCK, "recJ1", "recK2", '=HYPERLINK("http://x","y")', ["l5"]),
    asset("a6", "HYE-AST-261003-001", ASSET_STATUS.IN_STOCK, "recJ3", "recK3", "@SUM(A1)", ["l6"]),
    // Out, but its latest entry is a check-in — the cache and the log disagree — so nobody is named.
    asset("a7", "HYE-AST-261004-001", ASSET_STATUS.OUT, "recJ2", "recK4", "", ["l7"]),
];
const entry = (id, event, eventAt, checkedOutTo = null) => ({ id, event, eventAt, checkedOutTo });
const LOG_ROWS = [
    entry("l1", ASSET_EVENT.CREATED, "2026-10-01T15:00:00.000Z"),
    entry("l2a", ASSET_EVENT.CREATED, "2026-10-01T15:00:00.000Z"),
    // 03:30 UTC on the 22nd is the evening of the 21st in Los Angeles.
    entry("l2b", ASSET_EVENT.CHECKED_OUT, "2026-10-22T03:30:00.000Z", "  Dana   K "),
    entry("l3", ASSET_EVENT.RETIRED, "2026-10-05T12:00:00.000Z"),
    entry("l4", ASSET_EVENT.SENT_FOR_REPAIR, "2026-10-10T12:00:00.000Z"),
    entry("l5", ASSET_EVENT.CREATED, "2026-10-02T12:00:00.000Z"),
    entry("l6", ASSET_EVENT.CREATED, "2026-10-03T12:00:00.000Z"),
    entry("l7", ASSET_EVENT.CHECKED_IN, "2026-10-04T12:00:00.000Z"),
];
const OFFICE = { id: "recU1", isAdmin: true, assignedJobs: [] };
const SITE = { id: "recU2", isAdmin: false, assignedJobs: ["recJ1"] };
const NO_JOB = { id: "recU3", isAdmin: false, assignedJobs: [] };
const NOON_22ND = new Date("2026-10-22T12:00:00.000Z");

/** One press over the fixture, with every read written down. */
async function press(user, search, { timeZone = "UTC", now = NOON_22ND } = {}) {
    const asked = { categories: 0, jobs: 0, assets: [], logRows: [] };
    const made = await listExport({
        user,
        search,
        timeZone,
        now,
        read: {
            categories: async () => {
                asked.categories += 1;
                return CATEGORIES;
            },
            jobs: async () => {
                asked.jobs += 1;
                return JOBS;
            },
            assets: async (ids) => {
                asked.assets.push([...ids]);
                return ASSETS_HELD.filter((each) => ids.includes(each.id));
            },
            logRows: async (ids) => {
                asked.logRows.push([...ids]);
                return LOG_ROWS.filter((each) => ids.includes(each.id));
            },
        },
    });
    return { made, asked };
}

const said = (value) => (value === null || value === undefined || value === "" ? "-" : typeof value === "object" ? `${value.month}/${value.day}/${value.year}` : String(value));
const rowsSaid = (sheet) => sheet.rows.map((row) => row.map(said).join(" ; ")).join(" | ");

/**
 * Whether the two sheets agree (#553): each first-sheet row, in order, is the next as many
 * second-sheet rows as its counts add up to, of its own type and category, status for status.
 */
function agreement([list, items]) {
    let at = 0;
    for (const row of list.rows) {
        const counts = row.slice(3);
        const block = items.rows.slice(at, at + counts.reduce((sum, n) => sum + n, 0));
        at += block.length;
        const perStatus = ASSET_STATUS_VALUES.map((status) => block.filter((item) => item[7] === status).length);
        if (perStatus.join("/") !== counts.join("/")) return `${row[0]} counts ${counts.join("/")} but lists ${perStatus.join("/")}`;
        if (block.some((item) => item[1] !== row[1] || item[2] !== row[2])) return `${row[0]} lists an item of another type or category`;
    }
    return at === items.rows.length ? "agree" : `${items.rows.length - at} items under no row`;
}

// ── reading a workbook back ─────────────────────────────────────────────────

const unescapeXml = (text) =>
    text
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&");

/** Every cell of a sheet part: its column, row, style, type and value as written. */
function cellsOf(xml) {
    const cells = [];
    for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = Object.fromEntries([...m[3].matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
        const inner = m[4] ?? "";
        const text = inner.match(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/);
        const number = inner.match(/<v>([\s\S]*?)<\/v>/);
        cells.push({
            col: m[1],
            row: Number(m[2]),
            s: attrs.s ?? "0",
            t: attrs.t ?? null,
            value: text ? unescapeXml(text[1]) : number ? number[1] : null,
            // Whether the text says its edge whitespace is kept, and whether a raw carriage return
            // stands in it, which a reader of XML would turn into a line feed.
            space: /<t xml:space="preserve">/.test(inner),
            rawReturn: /\r/.test(inner),
        });
    }
    return cells;
}

/** The workbook's parts by path, as text. */
function partsOf(bytes) {
    return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([path, data]) => [path, strFromU8(data)]));
}

/** `cellXfs`' entries, in order. */
function cellStyles(stylesXml) {
    return (stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "").match(/<xf [^>]*\/>/g) ?? [];
}

/** The text of one exported function in a source, by name, or "" when there is none. */
function functionText(source, name) {
    const start = source.search(new RegExp(`export (async )?function ${name}\\(`));
    if (start < 0) return "";
    const end = source.slice(start).search(/\r?\n\}\r?\n/);
    return end < 0 ? source.slice(start) : source.slice(start, start + end + 3);
}

// The argument the action hands `listExport` as its user: the name, when that name is declared
// once in the function and from `await requireUser()`, else what it is instead.
function userHanded(actionText) {
    const handed = actionText.match(/listExport\(\{\s*user(?:\s*:\s*([^,\n]+))?,/);
    if (!handed) return "no listExport call";
    if (handed[1]) return `user: ${handed[1].trim()}`;
    const declared = [...actionText.matchAll(/const user = ([^;]+);/g)].map((m) => m[1]);
    return declared.length === 1 && declared[0] === "await requireUser()" ? "the user requireUser answered" : `user from ${declared.join(" and ") || "nowhere"}`;
}

/**
 * A press while the band's search names an item's id (#541): the file is what the list shows —
 * the item's row and every asset under it — and the way to the item is in no sheet. Called first
 * in `run()`, so an older assertion that throws cannot keep it from printing.
 */
async function byId541({ check, log }) {
    log("a press on an item's id, which the list finds the item by (#541):");
    const byId = await press(OFFICE, "q=HYE-AST-261001-002");
    check(
        "the first sheet holds the item's row on the job the list stands on, its counts whole",
        rowsSaid(byId.made.sheets[0]),
        "Band Saw, DeWalt (DCS375) ; Tool ; Power Tool ; 1 ; 1 ; 0 ; 0"
    );
    check("  the second every asset under that row, not the item alone", byId.made.sheets[1].rows.map((row) => row[0]).join(" "), "HYE-AST-261001-002 HYE-AST-261001-001");
    check("  each of them read for its day, and every asset on the job for the counts", `${byId.asked.assets.map((ids) => ids.join(",")).join(" / ")} | ${byId.asked.logRows.map((ids) => ids.join(",")).join(" / ")}`, "a1,a2,a5 | l2b,l1");
    check("  and the two sheets agree", agreement(byId.made.sheets), "agree");
    check("its label's code presses the same file", rowsSaid((await press(OFFICE, "q=261001-002")).made.sheets[1]), rowsSaid(byId.made.sheets[1]));
    const onAll = await press(OFFICE, "job=all&q=261001-003");
    check(
        "on all of the office's jobs the item's row counts every job, and lists every asset under it",
        `${rowsSaid(onAll.made.sheets[0])} | ${onAll.made.sheets[1].rows.map((row) => `${row[0]} ${row[8]}`).join(" ")}`,
        "Band Saw, DeWalt (DCS375) ; Tool ; Power Tool ; 1 ; 1 ; 0 ; 1 | HYE-AST-261001-003 25-USA-13 HYE-AST-261001-002 23-USA-09 HYE-AST-261001-001 23-USA-09"
    );
    const offJob = await press(OFFICE, "q=261001-003");
    check("an item off the job the list stands on is in no sheet", `${offJob.made.sheets[0].rows.length} ${offJob.made.sheets[1].rows.length}`, "0 0");
    const offChip = await press(OFFICE, "job=all&job=recJ1&q=261001-003");
    check("  nor one off the jobs the Job chip takes", `${offChip.made.sheets[0].rows.length} ${offChip.made.sheets[1].rows.length}`, "0 0");
    const offReader = await press(SITE, "job=all&q=HYE-AST-261003-001");
    check("  nor one on a job the reader may not stand on", `${offReader.made.fileName} ${offReader.made.sheets[0].rows.length}`, "Tools & Equipment - 23-USA-09 - 2026-10-22.xlsx 0");
    const sequence = await press(OFFICE, "job=all&q=205");
    check(
        "a sequence alone is searched in the names, so the kind whose name holds it is the file's",
        `${sequence.made.sheets[0].rows.map((row) => row[0]).join(" | ")} ${sequence.made.sheets[1].rows.length}`,
        "TIG Welder, Lincoln Electric (TIG 205) 2"
    );
    log("");
}

export async function run({ check, log, assert }) {
    await byId541({ check, log });

    // ── 1: the press, by value ──────────────────────────────────────────────
    log("one press, over a fixture of three jobs and seven assets:");
    const first = await press(OFFICE, "");
    check("the office on no job asked stands on the first by its code, and the file says so", first.made.fileName, "Tools & Equipment - 23-USA-09 - 2026-10-22.xlsx");
    check("  each read asked once — the catalog, the jobs, the job's assets, their latest rows", `${first.asked.categories} ${first.asked.jobs} ${first.asked.assets.map((ids) => ids.join(",")).join(" / ")} | ${first.asked.logRows.map((ids) => ids.join(",")).join(" / ")}`, "1 1 a1,a2,a5 | l2b,l1,l5");
    check(
        "  the first sheet is the list on that job: each kind, its type, its category and its four counts",
        rowsSaid(first.made.sheets[0]),
        "Band Saw, DeWalt (DCS375) ; Tool ; Power Tool ; 1 ; 1 ; 0 ; 0 | TIG Welder, Lincoln Electric (TIG 205) ; Equipment ; Welding Equipment ; 1 ; 0 ; 0 ; 0"
    );
    check(
        "  the second its assets, newest first under each kind, with the holder of one out and each one's day",
        rowsSaid(first.made.sheets[1]),
        "HYE-AST-261001-002 ; Tool ; Power Tool ; Band Saw ; - ; DeWalt ; DCS375 ; Out ; 23-USA-09 ; Dana K ; Kept in bay 2 ; 10/22/2026 | " +
            "HYE-AST-261001-001 ; Tool ; Power Tool ; Band Saw ; - ; DeWalt ; DCS375 ; In stock ; 23-USA-09 ; - ; - ; 10/1/2026 | " +
            'HYE-AST-261002-002 ; Equipment ; Welding Equipment ; TIG Welder ; - ; Lincoln Electric ; TIG 205 ; In stock ; 23-USA-09 ; - ; =HYPERLINK("http://x","y") ; 10/2/2026'
    );
    check("  and the two sheets agree", agreement(first.made.sheets), "agree");

    const all = await press(OFFICE, "job=all");
    check("on all of the office's jobs the file is named for all of them", all.made.fileName, "Tools & Equipment - All jobs - 2026-10-22.xlsx");
    check(
        "  the first sheet holds every kind with an asset on any, by name, and none with nothing",
        rowsSaid(all.made.sheets[0]),
        'Band Saw, DeWalt (DCS375) ; Tool ; Power Tool ; 1 ; 1 ; 0 ; 1 | Drill 1/2" ; Tool ; Power Tool ; 0 ; 1 ; 0 ; 0 | Hammer ; Tool ; Hand Tool ; 1 ; 0 ; 0 ; 0 | TIG Welder, Lincoln Electric (TIG 205) ; Equipment ; Welding Equipment ; 1 ; 0 ; 1 ; 0'
    );
    check(
        "  the second lists them in the first's order, each kind newest first, each with its own job",
        all.made.sheets[1].rows.map((row) => `${row[0]} ${row[8]} ${said(row[9])}`).join(" | "),
        "HYE-AST-261001-003 25-USA-13 - | HYE-AST-261001-002 23-USA-09 Dana K | HYE-AST-261001-001 23-USA-09 - | HYE-AST-261004-001 25-USA-13 - | HYE-AST-261003-001 26-USA-12 - | HYE-AST-261002-002 23-USA-09 - | HYE-AST-261002-001 25-USA-13 -"
    );
    check("  every asset on them read, once", all.asked.assets.map((ids) => ids.join(",")).join(" / "), "a1,a2,a3,a4,a5,a6,a7");
    check("  and the two sheets agree", agreement(all.made.sheets), "agree");

    const narrowed = await press(OFFICE, "job=all&job=recJ1&type=Tool&q=saw");
    check(
        "the Job chip, a type and a search narrow the file as they narrow the list, the counts the chip's job's",
        rowsSaid(narrowed.made.sheets[0]),
        "Band Saw, DeWalt (DCS375) ; Tool ; Power Tool ; 1 ; 1 ; 0 ; 0"
    );
    check("  the second sheet lists that job's assets of it alone", narrowed.made.sheets[1].rows.map((row) => row[0]).join(" "), "HYE-AST-261001-002 HYE-AST-261001-001");
    check("  every asset on what the list stands on still read, and only the listed ones' rows", `${narrowed.asked.assets.map((ids) => ids.length).join(",")} | ${narrowed.asked.logRows.map((ids) => ids.join(",")).join(" / ")}`, "7 | l2b,l1");
    check("  and the two sheets agree", agreement(narrowed.made.sheets), "agree");

    const second = await press(OFFICE, "job=recJ2");
    check("the office asking for another of its jobs stands on it, and the file says which", second.made.fileName, "Tools & Equipment - 25-USA-13 - 2026-10-22.xlsx");
    check("  holding that job's assets alone", second.made.sheets[1].rows.map((row) => row[0]).join(" "), "HYE-AST-261001-003 HYE-AST-261004-001 HYE-AST-261002-001");

    const elsewhere = await press(SITE, "job=recJ2");
    check("a site reader asking for a job off theirs is answered with theirs, and the file says which", elsewhere.made.fileName, "Tools & Equipment - 23-USA-09 - 2026-10-22.xlsx");
    check("  holding that job's assets alone", elsewhere.made.sheets[1].rows.map((row) => row[0]).join(" "), "HYE-AST-261001-002 HYE-AST-261001-001 HYE-AST-261002-002");
    check("  and no other job's asset is read for them", elsewhere.asked.assets.map((ids) => ids.join(",")).join(" / "), "a1,a2,a5");
    check("  nor on all of them, which a reader on one job is answered as any value not offered", (await press(SITE, "job=all")).made.fileName, "Tools & Equipment - 23-USA-09 - 2026-10-22.xlsx");

    // ANTI-VACUITY for the agreement: a pair whose counts and items part is told apart.
    check(
        "the agreement tells a pair that parts",
        agreement([{ rows: [["Kind", "Tool", "Power Tool", 1, 0, 0, 0]] }, { rows: [["HYE-AST-1", "Tool", "Power Tool", "", "", "", "", ASSET_STATUS.OUT]] }]),
        "Kind counts 1/0/0/0 but lists 0/1/0/0"
    );

    const nobody = await press(NO_JOB, "");
    check("a reader on no job gets no file, and nothing is read past the catalog and the jobs", `${nobody.made} ${nobody.asked.assets.length} ${nobody.asked.logRows.length}`, "null 0 0");

    const emptied = await press(OFFICE, "job=all&q=zzz");
    check("a band that empties the list gives both sheets with their heads alone", `${emptied.made.sheets[0].rows.length} ${emptied.made.sheets[1].rows.length}`, "0 0");

    const west = await press(OFFICE, "", { timeZone: "America/Los_Angeles", now: new Date("2026-10-22T05:00:00.000Z") });
    check("a day is the reader's: the evening of the 21st in Los Angeles, the file named for it", `${said(west.made.sheets[1].rows[0][11])} ${west.made.fileName}`, "10/21/2026 Tools & Equipment - 23-USA-09 - 2026-10-21.xlsx");
    check("  and a zone the runtime does not know is read as UTC", `${knownTimeZone("Mars/Olympus")} ${knownTimeZone("")} ${knownTimeZone("Asia/Seoul")}`, "UTC UTC Asia/Seoul");

    // ── 2: the heads and the words ──────────────────────────────────────────
    log("");
    log("the sheets say the screens' words:");
    check("the sheets are the list's heading and its items", first.made.sheets.map((sheet) => sheet.name).join(" | "), "Tools & Equipment | Items");
    check("  the first's heads are 1a's", first.made.sheets[0].columns.map((c) => c.header).join(" | "), "Name | Type | Category | In stock | Out | In repair | Retired");
    check(
        "  the second's 1d's and the catalog's",
        first.made.sheets[1].columns.map((c) => `${c.header}:${c.kind}`).join(" | "),
        "Item ID:text | Type:text | Category:text | Name:text | Size:text | Maker:text | Part #:text | Status:text | Job:text | Checked out to:text | Note:text | Updated:day"
    );
    check(
        "the button's words",
        [ASSET_EXPORT_COPY.export, ASSET_EXPORT_COPY.exportName, ASSET_EXPORT_COPY.working, ASSET_EXPORT_COPY.failed].join(" | "),
        "Export | Export to Excel | Exporting… | Couldn't export the list. Try again."
    );

    // ── 3: the file, read back by another library ───────────────────────────
    log("");
    log("the file, unzipped by fflate:");
    check("the media type a browser saves it as", XLSX_MEDIA_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const parts = partsOf(workbookBytes(all.made.sheets));
    check(
        "the package holds the parts a reader asks for",
        Object.keys(parts).join(" | "),
        "[Content_Types].xml | _rels/.rels | xl/workbook.xml | xl/_rels/workbook.xml.rels | xl/styles.xml | xl/worksheets/sheet1.xml | xl/worksheets/sheet2.xml"
    );
    check("  the two sheets named in order, the ampersand escaped", [...parts["xl/workbook.xml"].matchAll(/<sheet name="([^"]*)"/g)].map((m) => m[1]).join(" | "), "Tools &amp; Equipment | Items");
    check("  and no part holds a formula", Object.values(parts).filter((xml) => /<f[\s>]/.test(xml)).length, 0);
    const styles = cellStyles(parts["xl/styles.xml"]);
    const quoted = styles.map((xf, index) => (/quotePrefix="1"/.test(xf) ? index : null)).filter((index) => index !== null);
    check("the styles mark one as quotePrefix, words that look like a formula", quoted.join(","), "2");
    check("  and one as the app's day, mm/dd/yyyy", `${/numFmtId="164"/.test(styles[3] ?? "")} ${/<numFmt numFmtId="164" formatCode="mm\/dd\/yyyy"\/>/.test(parts["xl/styles.xml"])}`, "true true");
    const items = cellsOf(parts["xl/worksheets/sheet2.xml"]);
    check(
        "  the header's bold, every head in it",
        `${/fontId="1"/.test(styles[1] ?? "") && /<font><b\/>/.test(parts["xl/styles.xml"])} ${items.filter((cell) => cell.row === 1).map((cell) => cell.s).join("")}`,
        "true 111111111111"
    );
    const textCells = items.filter((cell) => cell.col !== "L");
    check("every text cell on the items sheet is an inline string", textCells.filter((cell) => cell.t !== "inlineStr").length, 0);
    check(
        "  the notes that would start a formula are written as words, quotePrefix'd, and nothing else is",
        items.filter((cell) => cell.s === "2").map((cell) => cell.value).join(" | "),
        '@SUM(A1) | =HYPERLINK("http://x","y")'
    );
    check("  the holder as the history says it", items.filter((cell) => cell.col === "J" && cell.row > 1).map((cell) => cell.value).join(" | "), "Dana K");
    check("  each day a serial under the day's style", items.filter((cell) => cell.col === "L" && cell.row > 1).map((cell) => `${cell.value}:${cell.s}:${cell.t}`).join(" "), "46300:3:null 46317:3:null 46296:3:null 46299:3:null 46298:3:null 46297:3:null 46305:3:null");
    check("  a blank written as no cell: an item with no size, holder or note has none of those cells", items.filter((cell) => cell.row === 4).map((cell) => cell.col).join(" "), "A B C D F G H I L");
    const counts = cellsOf(parts["xl/worksheets/sheet1.xml"]).filter((cell) => cell.row > 1 && ["D", "E", "F", "G"].includes(cell.col));
    check("the counts are figures, a zero included", counts.map((cell) => `${cell.value}${cell.t ?? ""}`).join(" "), "1 1 0 1 0 1 0 0 1 0 0 0 1 0 1 0");
    check("the head held at the top, filtered", [/<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(parts["xl/worksheets/sheet2.xml"]), /<autoFilter ref="A1:L8"\/>/.test(parts["xl/worksheets/sheet2.xml"])].join(" "), "true true");

    log("");
    log("the cell's rule, by value:");
    const HOSTILE = ["=1+1", "+1", "-1", "@SUM(A1)", "\t=1", "\r=1", "\n=1"];
    const PLAIN = [" =1", "a=1", "1-2", "Dana K", "", null];
    check("every first character that starts a formula is caught", HOSTILE.map(startsFormula).join(" "), "true true true true true true true");
    check("  and nothing else is", PLAIN.map(startsFormula).join(" "), "false false false false false false");
    const hostile = cellsOf(
        partsOf(
            workbookBytes([
                {
                    name: "Probe",
                    columns: [{ header: "Text", kind: "text", width: 10 }],
                    rows: [...HOSTILE, 'a & <b> "c"', "ctrl\u0001x", "  edge  "].map((value) => [value]),
                },
            ])
        )["xl/worksheets/sheet1.xml"]
    ).filter((cell) => cell.row > 1);
    check(
        "  each is written back exactly, quotePrefix'd, a leading whitespace kept and a return as a reference",
        hostile.slice(0, HOSTILE.length).map((cell) => `${JSON.stringify(cell.value)}:${cell.s}:${cell.t}:${cell.space}:${cell.rawReturn}`).join(" "),
        '"=1+1":2:inlineStr:false:false "+1":2:inlineStr:false:false "-1":2:inlineStr:false:false "@SUM(A1)":2:inlineStr:false:false ' +
            '"\\t=1":2:inlineStr:true:false "\\r=1":2:inlineStr:true:false "\\n=1":2:inlineStr:true:false'
    );
    check(
        "  markup escaped, a control character dropped, edge spaces kept",
        hostile.slice(HOSTILE.length).map((cell) => `${JSON.stringify(cell.value)}:${cell.s}:${cell.space}`).join(" "),
        '"a & <b> \\"c\\"":0:false "ctrlx":0:false "  edge  ":0:true'
    );
    check("a day's serial counts from 1899-12-30", [excelDaySerial({ year: 2026, month: 10, day: 22 }), excelDaySerial({ year: 2000, month: 1, day: 1 }), excelDaySerial({ year: 1900, month: 3, day: 1 })].join(" "), "46317 36526 61");
    let refused = 0;
    for (const name of ["", "a/b", "x".repeat(32), "[x]"]) {
        try {
            workbookBytes([{ name, columns: [], rows: [] }]);
        } catch {
            refused += 1;
        }
    }
    check("a sheet name Excel refuses is refused before a file is made", refused, 4);

    // ── 4: the pace, on a fake clock ────────────────────────────────────────
    log("");
    log("five requests a second at most:");
    check("the limit and the page", `${AIRTABLE_REQUESTS_PER_SECOND} ${AIRTABLE_PAGE_ROWS} ${pagesOf([])} ${pagesOf(new Array(100))} ${pagesOf(new Array(101))}`, "5 100 1 1 2");
    let clock = 0;
    const begun = [];
    const pace = createRequestPace({ now: () => clock, wait: async (ms) => { clock += ms; } });
    await Promise.all(Array.from({ length: 17 }, async (_, index) => {
        await pace();
        begun.push([index, clock]);
    }));
    const moments = begun.map(([, at]) => at);
    const busiest = Math.max(...moments.map((at) => moments.filter((other) => other >= at && other <= at + 1000).length));
    check("seventeen requests, never more than five in any closed second", busiest, 5);
    check("  five at once, then each a second after the one five before it", moments.join(" "), "0 0 0 0 0 1001 1001 1001 1001 1001 2002 2002 2002 2002 2002 3003 3003");
    let exact = 0;
    const exactPace = createRequestPace({ now: () => exact, wait: async (ms) => { exact += ms; } });
    for (let i = 0; i < 5; i += 1) await exactPace();
    exact = 1000;
    await exactPace();
    check("  a sixth asked exactly a second after the first five waits a millisecond past it", exact, 1001);
    let late = 0;
    const counted = createRequestPace({ now: () => late, wait: async (ms) => { late += ms; } });
    counted.spent(4);
    await counted();
    await counted();
    check("  and pages counted after the fact hold the window as requests do", late, 1001);

    // ── 5: the wiring, off the source ───────────────────────────────────────
    log("");
    log("the wiring, off the source:");
    const actionText = functionText(parseFile(ACTION).source, "exportAssetListAction");
    check("the action hands listExport the user requireUser answered", userHanded(actionText), "the user requireUser answered");
    check(
        "  a planted action handing it another user is seen",
        userHanded("export async function exportAssetListAction() {\n    const user = await requireUser();\n    const made = await listExport({ user: { isAdmin: true }, read });\n}\n"),
        "user: { isAdmin: true }"
    );
    check(
        "  the session's read waits on the pace, and every read it hands is paced",
        [
            /const pace = createRequestPace\(\);\s*await pace\(\);\s*const user = await requireUser\(\);/.test(actionText),
            /await pace\(\);\s*const rows = await read\(\);\s*pace\.spent\(pagesOf\(rows\) - 1\);/.test(actionText),
            /categories: \(\) => paced\(getAllAssetCategories\),\s*jobs: \(\) => paced\(getAllJobs\),/.test(actionText),
            /assets: \(ids\) => getAssetsByRecordIds\(ids, \{ pace \}\),/.test(actionText),
            /logRows: \(ids\) => getAssetLogEntriesByRecordIds\(ids, \{ perQuery: 100, pace \}\),/.test(actionText),
        ].join(" "),
        "true true true true true"
    );
    check("  and the bytes are the workbook of the sheets listExport made", /bytes: workbookBytes\(made\.sheets\)/.test(actionText), true);
    const exportSource = parseFile(EXPORT).source;
    const pressText = functionText(exportSource, "listExport");
    check(
        "listExport stands on the page's scope and reads its rows through the list's own functions",
        [
            /const scope = assetListScope\(user, jobs, jobAsked\(params\)\);/.test(pressText),
            /readCategoryList\(categoryListRows\(shown, scope, kept\), params, \{ allJobs: scope\.allJobs, jobs: scope\.jobs \}\)/.test(pressText),
            /exportedAssets\(reading, countedAssets\(shown, scope, kept\)\)/.test(pressText),
        ].join(" "),
        "true true true"
    );
    const narrowsItself = (source) => /\b(filterAssetCategoryRows|summarizeAssetCategories|matchesTokens|searchTokens)\(/.test(source);
    check("  and narrows nothing itself", narrowsItself(exportSource), false);
    check("  where a planted module narrowing for itself is seen", narrowsItself("const rows = filterAssetCategoryRows(all, filters);\n"), true);
    check(
        "the list reads its band through the same function",
        /const reading = readCategoryList\(rows, params, \{ allJobs, jobs, q: typed \}\);/.test(parseFile(LIST).source) && !narrowsItself(parseFile(LIST).source),
        true
    );
    const clientSource = parseFile(CLIENT).source;
    check(
        "findByRecordIds waits on a pace before each chunk's request",
        /chunks\.map\(async \(chunk\) => \{\s*if \(pace\) await pace\(\);\s*return base\(tableName\)\s*\.select\(\{ filterByFormula: orByRecordId\(chunk\)/.test(clientSource),
        true
    );
    check(
        "the asset reader reads whole, a hundred to a query, paced",
        /export async function getAssetsByRecordIds\(recordIds, \{ pace \} = \{\}\) \{\s*return \(await findByRecordIds\(TABLES\.ASSETS, recordIds, \{ perQuery: 100, pace \}\)\)\.map\(recordToAsset\);\s*\}/.test(parseFile(ASSETS).source),
        true
    );
    const buttonSource = parseFile(BUTTON).source;
    check(
        "the button sends the address and the reader's zone, and downloads what comes back",
        [
            /const answer = await exportAssetListAction\(params\.toString\(\), readerTimeZone\(\)\);/.test(buttonSource),
            /new Blob\(\[answer\.bytes\], \{ type: answer\.type \}\)/.test(buttonSource),
            /link\.download = answer\.fileName;/.test(buttonSource),
        ].join(" "),
        "true true true"
    );
    check(
        "  says it is busy and what it does, and a press that made no file before itself",
        [
            /<Button variant="bordered" busy=\{busy\} busyLabel=\{COPY\.working\} ariaLabel=\{busy \? undefined : COPY\.exportName\} onClick=\{press\}>\s*\{COPY\.export\}\s*<\/Button>/.test(buttonSource),
            /\{failed && <Refusal>\{COPY\.failed\}<\/Refusal>\}\s*<Button/.test(buttonSource),
            /catch \{\s*setFailed\(true\);\s*\}/.test(buttonSource),
        ].join(" "),
        "true true true"
    );
    const listSource = parseFile(LIST).source;
    check(
        "  it stands in the list's head between the catalog and the opener, and nowhere on the page's empty states",
        [/\{catalog\}\s*<ListExport \/>\s*\{opener\}/.test(listSource), /ListExport/.test(parseFile(PAGE).source)].join(" "),
        "true false"
    );
    // ANTI-VACUITY for the source reads: the extractor finds a function and misses one not there.
    assert("  the extractor finds the action's text", actionText.includes("withOpsLabel(\"exportAssetListAction\""));
    check("  and finds nothing for a name not there", functionText(parseSource("export function a() {}\n", "<planted>").source, "b"), "");
}

if (isMain(import.meta.url)) standalone(title, run);

// What the three sites' import judges before it writes (#544), against bases of this check's making.
//
// THE SUBJECT IS `scripts/import/import_site_assets_544_plan.mjs`, the import's judgments apart from
// the base: the list read whole, the ledgers read for what a run has made, the list against what a
// base holds, and the operations an apply would spend. The script itself imports
// `lib/airtable/client.js`, so it is never loaded here; what is held of it is its wiring, off its
// source — that it takes every judgment from the module and registers as the dialog's action does.
//
// FIVE PARTS. The committed list by value — its digest, its rows, its three words — so a list
// changed after the review fails here before it reaches a base. The list's refusals on planted
// files. The plan on a small base, once whole and then one change at a time, each change the one
// refusal or the one answer it should be: an `existing` path held by no row or by two, or set
// aside; a `new` path held, or held by a row the ledger made; an add part's target missing or under
// an item, or written already; a group missing that the run may or may not add; a job missing,
// spelled otherwise or not the recorder's; the day's ids at the three-digit boundary and either
// side of it; a re-run with every item standing, some, too many, or an intent unanswered. The
// committed list against a base made from itself, which is the whole run's plan offline. And the
// forecast's arithmetic, with a page boundary in it.
//
// WHAT IT CANNOT SEE. Whether the base the script reads is shaped as these bases are — that is the
// readers' mapping, `lib/airtable/*.js`, and a run's own read-back; and anything the writers do.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { join } from "path";
import { REPO_ROOT, calleeName, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { catalogPathKey, composeItemName } from "../../../lib/assetCategory.js";
import {
    GROUPS_THIS_RUN_MAY_ADD,
    HEADER,
    HIGHEST_SEQUENCE,
    HOLDS,
    forecast,
    isRunLedgerOf,
    ledgered,
    plan,
    readList,
} from "../../import/import_site_assets_544_plan.mjs";

export const title = "The three sites' import judges the list against the base (#544)";

const SCRIPT_PATH = "scripts/import/import_site_assets_544.mjs";
const PLAN_PATH = "scripts/import/import_site_assets_544_plan.mjs";
const PLAN_SPECIFIER = "./import_site_assets_544_plan.mjs";

/**
 * The committed list's digest, of its text with `\n` endings: the reviewed list less its notes
 * column, which nothing read. The ledgers' run lines carry `12f29602…`, the list's with it.
 */
const LIST_SHA256 = "d311fa141f328972b6c4009455324e3dbcd1214b848e291ca64e4828656cf40f";

/** A list file from rows of cells, each cell quoted where it holds a quote or a comma. */
function csv(rows, header = HEADER) {
    const cell = (value) => (/[",]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    return Buffer.from(`﻿${[header, ...rows.map((row) => row.map(cell).join(","))].join("\n")}\n`, "utf8");
}

/** A catalog row as `lib/airtable/assetCategories.js` maps one — with no class since #552. */
function row(id, [level1, level2, level3, size = "", maker = "", partNumber = ""], { assets = [], discontinued = false } = {}) {
    const levels = { level1, level2, level3, size, maker, partNumber };
    return { id, itemName: composeItemName(levels), assets, ...levels, discontinued };
}

const DRILL = ["Tool", "Power Tools", "Drill", "", "DeWalt", ""];
const SAW = ["Tool", "Power Tools", "Saw"];
const LADDER = ["Tool", "Other Tools", "Ladder"];
const BAND_SAW = ["Tool", "Power Tools", "Band Saw", "", "DeWalt", ""];

/** The small list: an existing path, one new path on two jobs, a new path in a group to add, and an add part. */
const SMALL = [
    ["J-1", ...DRILL, "B", "3", "existing", "A1"],
    ["J-1", ...SAW, "", "", "", "B", "2", "new", "A2"],
    ["J-2", ...SAW, "", "", "", "B", "4", "new", "A3"],
    ["J-2", ...LADDER, "", "", "", "B", "5", "new", "A4"],
    ["J-2", "Tool", "Power Tools", "Band Saw", "", "DeWalt", "DCS375", "B", "1", "existing (add part)", "A5"],
];

/** A base the small list fits: its two rows, one group, two jobs the recorder is on, and an empty day. */
function smallBase(change = {}) {
    const jobs = [
        { id: "recJob1", jobCode: "J-1", assets: [] },
        { id: "recJob2", jobCode: "J-2", assets: [] },
    ];
    return {
        catalog: [row("recDrill", DRILL), row("recBand", BAND_SAW)],
        groups: [{ id: "recGroup", level1: "Tool", level2: "Power Tools" }],
        jobs,
        recorder: { id: "recSoo", status: "Active", assignedJobs: ["recJob1", "recJob2"] },
        standing: [],
        prefix: "HYE-AST-261019",
        dayIds: [],
        list: readList(csv(SMALL)).rows,
        ...change,
    };
}

const NONE = ledgered([]);

/** A day's ids, `-001` to the highest given. */
const day = (highest, prefix = "HYE-AST-261019") => Array.from({ length: highest }, (_, i) => `${prefix}-${String(i + 1).padStart(3, "0")}`);

/** The plan's problems, one string. */
const problemsOf = (read, done = NONE) => plan(read, done).problems.join(" | ");

/** A ledger of the small list's existing row's three assets, with whatever else is asked. */
function ledgerOf(lines, name = "import_site_assets_544-test-1.jsonl") {
    return { name, lines: [{ type: "run", script: "import_site_assets_544", base: "test" }, ...lines] };
}
const A1_ASSETS = [
    { id: "recA1a", assetId: "HYE-AST-261019-001" },
    { id: "recA1b", assetId: "HYE-AST-261019-002" },
    { id: "recA1c", assetId: "HYE-AST-261019-003" },
];
const A1_LINES = [
    { type: "intent", source: "A1", count: 3 },
    { type: "assets", source: "A1", jobRecordId: "recJob1", categoryRecordId: "recDrill", assets: A1_ASSETS },
];
const standingOf = (assets) => assets.map((asset) => ({ id: asset.id, assetId: asset.assetId, assetLog: ["recLog"] }));

export function run({ check, assert, log }) {
    // ── the committed list, by value ─────────────────────────────────────────
    log("the committed list:");
    const list = readList();
    check("  the list reads with no problem", list.problems.join(" | "), "");
    check("  its digest is the reviewed list's", list.sha256, LIST_SHA256);
    check("  the same text with CRLF endings has the same digest", readList(Buffer.from(readFileSync(join(REPO_ROOT, "scripts/import/sources/asset_import_544.csv"), "utf8").replace(/\r?\n/g, "\r\n"), "utf8")).sha256, LIST_SHA256);
    check("  rows", list.rows.length, 70);
    check("  items", list.rows.reduce((sum, r) => sum + r.quantity, 0), 508);
    const words = (word) => list.rows.filter((r) => r.catalog === word).length;
    check("  existing rows", words(HOLDS.EXISTING), 20);
    check("  new rows", words(HOLDS.NEW), 49);
    check("  add part rows", words(HOLDS.ADD_PART), 1);
    check("  its jobs, in order", [...new Set(list.rows.map((r) => r.job))].join(" "), "25-USA-13 26-USA-12 23-USA-09");
    check("  a quoted size is read whole", list.rows.find((r) => r.source === "S4#32")?.size, '1/2"');
    check("  the header ends on the source", HEADER.split(",").at(-1), "source");
    check("  the groups the run may add", GROUPS_THIS_RUN_MAY_ADD.map((g) => `${g.level1} > ${g.level2}`).join(" | "), "Tool > For Welders | Tool > Other Tools");
    check("  the highest sequence a day takes", HIGHEST_SEQUENCE, 999);
    // THE LIST'S CLASS IS READ BY ITS PLACE AND DECIDES NOTHING SINCE #552: the column stays, so the
    // list is still the list handed over, and a row carries it as `listClass` alone.
    check(
        "  its class column read by its place, as the list's own and not the catalog's (#552)",
        `${HEADER.split(",")[7]} ${[...new Set(list.rows.map((r) => r.listClass))].sort().join("/")} ${list.rows.some((r) => "assetClass" in r)}`,
        "class A/B false"
    );

    // ── the list's refusals ──────────────────────────────────────────────────
    log("");
    log("the list's refusals, on planted files:");
    const refusal = (rows, header) => readList(csv(rows, header)).problems.join(" | ");
    const good = SMALL[0];
    check("  the small list reads with no problem", refusal(SMALL), "");
    assert("  a header otherwise is refused", /the header is/.test(refusal([good], HEADER.replace("part_number", "part"))));
    assert("  a short row is refused", /cell\(s\), not 11/.test(refusal([good.slice(0, 10)])));
    assert("  a row with a notes cell after its source is refused", /12 cell\(s\), not 11/.test(refusal([[...good, "a note"]])));
    check("  a quoted cell holding a comma is read whole", readList(csv([["J-1", "Tool", "Power Tools", "Saw, Large", "", "", "", "B", "1", "new", "Q1"]])).rows[0]?.level3, "Saw, Large");
    assert("  stray whitespace is refused", /carries stray whitespace/.test(refusal([["J-1", "Tool", "Power  Tools", ...good.slice(3)]])));
    assert("  a placeholder for empty is refused", /a placeholder for empty/.test(refusal([["J-1", "Tool", "Power Tools", "Drill", "N/A", ...good.slice(5)]])));
    assert("  a quantity of 0 is refused", /is not a whole number above 0/.test(refusal([[...good.slice(0, 8), "0", ...good.slice(9)]])));
    assert("  a quantity not whole is refused", /is not a whole number above 0/.test(refusal([[...good.slice(0, 8), "1.5", ...good.slice(9)]])));
    assert("  a catalog word otherwise is refused", /catalog is "maybe"/.test(refusal([[...good.slice(0, 9), "maybe", ...good.slice(10)]])));
    assert("  an add part with no part number is refused", /names no part number/.test(refusal([[...good.slice(0, 9), "existing (add part)", ...good.slice(10)]])));
    assert("  one source on two rows is refused", /each row needs a source of its own/.test(refusal([good, good])));
    assert("  a list of no rows is refused", /holds no rows/.test(refusal([])));

    // ── the plan on a small base ─────────────────────────────────────────────
    log("");
    log("the plan on a small base:");
    const whole = plan(smallBase(), NONE);
    check("  no problem", whole.problems.join(" | "), "");
    check("  no note", whole.notes.join(" | "), "");
    check("  the group to add", whole.groupsToCreate.map((g) => `${g.level1} > ${g.level2}`).join(" | "), "Tool > Other Tools");
    check("  each new path once, with every row naming it", whole.pathsToCreate.map(({ entry, sources }) => `${entry.level3}:${sources.join("+")}`).join(" | "), "Saw:A2+A3 | Ladder:A4");
    check("  the part number onto the target, the rest of it as the target has it", whole.partsToAdd.map(({ category, entry }) => `${category.id}:${entry.maker}:${entry.partNumber}`).join(" | "), "recBand:DeWalt:DCS375");
    check(
        "  and no new path or part number carries a class (#552)",
        [...whole.pathsToCreate.map(({ entry }) => entry), ...whole.partsToAdd.map(({ entry }) => entry)].some((entry) => "assetClass" in entry),
        false
    );
    check("  each row's catalog row and due", whole.rows.map(({ row: r, category, due }) => `${r.source}:${category?.id ?? "-"}:${due}`).join(" "), "A1:recDrill:3 A2:-:2 A3:-:4 A4:-:5 A5:recBand:1");
    check("  each row's job", whole.rows.map(({ job }) => job.id).join(" "), "recJob1 recJob1 recJob2 recJob2 recJob2");
    check("  the items due", whole.dueTotal, 15);
    check("  the day's last id", whole.last, 15);

    log("  one change at a time:");
    const base = smallBase();
    const withCatalog = (catalog) => smallBase({ catalog });
    check("    existing with no row", problemsOf(withCatalog([base.catalog[1]])), "line 2 (A1): existing, and the catalog holds 0 row(s) on Tool > Power Tools > Drill > DeWalt");
    check("    existing on two rows, one in other case", problemsOf(withCatalog([...base.catalog, row("recDrill2", ["Tool", "power tools", "drill", "", "dewalt", ""])])), "line 2 (A1): existing, and the catalog holds 2 row(s) on Tool > Power Tools > Drill > DeWalt");
    check("    existing on a discontinued row", problemsOf(withCatalog([row("recDrill", DRILL, { discontinued: true }), base.catalog[1]])), "line 2 (A1): its row recDrill is not one a registration may pick (discontinued)");
    const classedA1 = plan(smallBase({ list: readList(csv([[...SMALL[0].slice(0, 7), "A", ...SMALL[0].slice(8)], ...SMALL.slice(1)])).rows }), NONE);
    check("    an existing row's class in the list decides nothing, and is told nothing (#552)", `${classedA1.problems.join(" | ")}|${classedA1.notes.join(" | ")}|${classedA1.rows[0].category?.id}`, "||recDrill");
    check("    a new path the catalog holds", problemsOf(withCatalog([...base.catalog, row("recSaw", SAW)])), 'line 3 (A2): new, and the catalog holds recSaw "Saw" on its path | line 4 (A3): new, and the catalog holds recSaw "Saw" on its path');
    const madeSaw = ledgered([ledgerOf([{ type: "catalog", id: "recSaw" }])]);
    const sawMade = plan(withCatalog([...base.catalog, row("recSaw", SAW)]), madeSaw);
    check("    a new path the ledger made is no problem", sawMade.problems.join(" | "), "");
    check("    and is the rows' catalog row, created no more", `${sawMade.rows[1].category?.id} ${sawMade.pathsToCreate.map(({ entry }) => entry.level3).join(",")}`, "recSaw Ladder");
    check("    an existing row the ledger made is a problem", problemsOf(smallBase(), ledgered([ledgerOf([{ type: "catalog", id: "recDrill" }])])), "line 2 (A1): existing, and its row recDrill is one this script made");
    const twoClasses = plan(smallBase({ list: readList(csv([SMALL[1], [...SMALL[2].slice(0, 7), "A", ...SMALL[2].slice(8)]])).rows }), NONE);
    check(
        "    one new path the list gives two classes is one path, refused nothing (#552)",
        `${twoClasses.problems.join(" | ")}|${twoClasses.pathsToCreate.map(({ entry, sources }) => `${entry.level3}:${sources.join("+")}`).join(" | ")}`,
        "|Saw:A2+A3"
    );
    const classC = plan(smallBase({ list: readList(csv([[...SMALL[1].slice(0, 7), "C", ...SMALL[1].slice(8)]])).rows }), NONE);
    check("    and a class outside the two is no refusal either", classC.problems.join(" | "), "");
    assert(
        "    a new path the catalog's page would refuse is refused",
        /(^| \| )A2: the catalog's page would refuse Saw {2}— Tools > Power Tools > Saw — level1: Choose a type\.$/.test(problemsOf(smallBase({ list: readList(csv([[SMALL[1][0], "Tools", ...SMALL[1].slice(2)]])).rows })))
    );
    check("    an add part target with an item on it",problemsOf(withCatalog([base.catalog[0], row("recBand", BAND_SAW, { assets: ["recX"] })])), "line 6 (A5): add part, and 1 item(s) stand on its target recBand, which the part number would rename");
    const otherSpelling = plan(withCatalog([base.catalog[0], row("recBand", ["Tool", "Power Tools", "band saw", "", "DeWalt", ""])]), NONE);
    check("    an add part keeps its target's spelling", otherSpelling.partsToAdd.map(({ entry }) => `${entry.level3}:${entry.partNumber}`).join(" | "), "band saw:DCS375");
    check("    and tells nothing of a class (#552)", otherSpelling.notes.join(" | "), "");
    check("    an add part with no target",problemsOf(withCatalog([base.catalog[0]])), "line 6 (A5): add part, and the catalog holds 0 row(s) on Tool > Power Tools > Band Saw > DeWalt, its target");
    const partHeld = withCatalog([base.catalog[0], row("recBand", ["Tool", "Power Tools", "Band Saw", "", "DeWalt", "DCS375"])]);
    check("    an add part whose path is held already", problemsOf(partHeld), "line 6 (A5): add part, and the catalog already holds recBand on Tool > Power Tools > Band Saw > DeWalt > DCS375");
    const partWritten = plan(partHeld, ledgered([ledgerOf([{ type: "part", id: "recBand", before: "", after: "DCS375" }])]));
    check("    an add part the ledger wrote is no problem", partWritten.problems.join(" | "), "");
    check("    and is not written again", `${partWritten.partsToAdd.length} ${partWritten.rows[4].category?.id}`, "0 recBand");
    check("    a group missing the run may not add, once for its rows", problemsOf(smallBase({ groups: [] })), "no group holds Tool > Power Tools, and it is not one this run may add — A1, A2, A3, A5");
    check("    the group the run may add, standing already", plan(smallBase({ groups: [...base.groups, { id: "recG2", level1: "Tool", level2: "Other Tools" }] }), NONE).groupsToCreate.length, 0);
    check("    a group spelled otherwise is told", plan(smallBase({ groups: [{ id: "recGroup", level1: "Tool", level2: "power tools" }] }), NONE).notes[0], 'line 2 (A1): the list spells the category "Power Tools" where its group spells "power tools"');
    check("    a job missing", problemsOf(smallBase({ jobs: [base.jobs[0]] })), "job J-2 is not on Jobs");
    check("    a job spelled otherwise", problemsOf(smallBase({ jobs: [base.jobs[0], { id: "recJob2", jobCode: "j-2", assets: [] }] })), "job J-2 is not on Jobs (j-2 is, spelled otherwise)");
    check("    a job on Jobs twice", problemsOf(smallBase({ jobs: [...base.jobs, { id: "recJob3", jobCode: "J-2", assets: [] }] })), "job J-2: 2 rows of Jobs carry that code");
    check("    a job the recorder is not on", problemsOf(smallBase({ recorder: { ...base.recorder, assignedJobs: ["recJob1"] } })), "job J-2: soo@hanyangengusa.com is not assigned to it, and a registration files only on the registrant's own jobs");
    check("    no recorder", problemsOf(smallBase({ recorder: null })), "soo@hanyangengusa.com is not on Users");
    check("    an inactive recorder", problemsOf(smallBase({ recorder: { ...base.recorder, status: "Inactive" } })), "soo@hanyangengusa.com is Inactive, not Active");
    check("    the day ending at -999 is no problem", problemsOf(smallBase({ dayIds: day(984) })), "");
    check("    the day ending at -1000 is refused", problemsOf(smallBase({ dayIds: day(985) })), "HYE-AST-261019 holds 985 id(s), the highest -985, and 15 more would end at -1000: past -999, four digits");
    check("    the day read by its highest, not its count", problemsOf(smallBase({ dayIds: ["HYE-AST-261019-985"] })), "HYE-AST-261019 holds 1 id(s), the highest -985, and 15 more would end at -1000: past -999, four digits");
    check("    another day's ids are not this day's", plan(smallBase({ dayIds: day(985, "HYE-AST-261018") }), NONE).last, 15);
    check("    an id on the day twice", problemsOf(smallBase({ dayIds: ["HYE-AST-261019-001", "HYE-AST-261019-001"] })), "HYE-AST-261019 already holds the id(s) HYE-AST-261019-001 twice");

    log("  a run again, after a ledger:");
    const after = ledgered([ledgerOf(A1_LINES)]);
    const again = plan(smallBase({ standing: standingOf(A1_ASSETS) }), after);
    check("    every item of a row standing: none due", `${again.problems.join(" | ")}|${again.rows[0].due}|${again.dueTotal}`, "|0|12");
    const some = plan(smallBase({ standing: standingOf(A1_ASSETS.slice(0, 2)) }), after);
    check("    some standing: the rest due", some.rows[0].due, 1);
    const gone = plan(smallBase({ standing: [] }), after);
    check("    none standing, the ledger reverted: all due", gone.rows[0].due, 3);
    const tooMany = ledgered([ledgerOf([...A1_LINES, { type: "assets", source: "A1", assets: [{ id: "recA1d", assetId: "HYE-AST-261019-004" }] }])]);
    check("    more standing than asked", problemsOf(smallBase({ standing: standingOf([...A1_ASSETS, { id: "recA1d", assetId: "HYE-AST-261019-004" }]) }), tooMany), "line 2 (A1): 4 of its items stand, more than its 3");
    const open = ledgered([ledgerOf([{ type: "intent", source: "A2", count: 2, at: "T" }])]);
    check("    an intent no answer followed", problemsOf(smallBase(), open), "A2: a registration of 2 began at T (import_site_assets_544-test-1.jsonl) and its answer is not in the ledger — its assets may stand; read the base before running again");
    check("    an answer in a later ledger does not answer it", ledgered([ledgerOf([{ type: "intent", source: "A2" }]), ledgerOf([{ type: "assets", source: "A2", assets: [] }], "b.jsonl")]).unanswered.length, 1);
    check("    an unlogged asset standing is told", plan(smallBase({ standing: [{ id: "recA1a", assetId: "HYE-AST-261019-001", assetLog: [] }] }), after).notes[0], "HYE-AST-261019-001 stands with no Created row — a registration whose log pass failed, which nothing writes late");
    const everything = plan(
        smallBase({
            catalog: [base.catalog[0], row("recBand", ["Tool", "Power Tools", "Band Saw", "", "DeWalt", "DCS375"], { assets: ["recA5"] }), row("recSaw", SAW), row("recLadder", LADDER)],
            groups: [...base.groups, { id: "recG2", level1: "Tool", level2: "Other Tools" }],
            standing: standingOf([...A1_ASSETS, ...["A2a", "A2b", "A3a", "A3b", "A3c", "A3d", "A4a", "A4b", "A4c", "A4d", "A4e", "A5"].map((id) => ({ id: `rec${id}`, assetId: id }))]),
        }),
        ledgered([
            ledgerOf([
                { type: "group", id: "recG2" },
                { type: "catalog", id: "recSaw" },
                { type: "catalog", id: "recLadder" },
                { type: "part", id: "recBand", before: "", after: "DCS375" },
                ...A1_LINES,
                ...["A2", "A3", "A4", "A5"].map((source) => ({ type: "assets", source, assets: { A2: ["A2a", "A2b"], A3: ["A3a", "A3b", "A3c", "A3d"], A4: ["A4a", "A4b", "A4c", "A4d", "A4e"], A5: ["A5"] }[source].map((id) => ({ id: `rec${id}`, assetId: id })) })),
            ]),
        ])
    );
    check("    a run after a whole one: nothing to write", `${everything.problems.join(" | ")}|${everything.groupsToCreate.length} ${everything.pathsToCreate.length} ${everything.partsToAdd.length} ${everything.dueTotal}`, "|0 0 0 0");

    log("  the ledgers a run reads:");
    check("    a run ledger of this script on its base", isRunLedgerOf([{ type: "run", script: "import_site_assets_544", base: "test" }], "test"), true);
    check("    not on another base", isRunLedgerOf([{ type: "run", script: "import_site_assets_544", base: "live" }], "test"), false);
    check("    not a revert's", isRunLedgerOf([{ type: "run", script: "import_site_assets_544 --revert", base: "test" }], "test"), false);

    // ── the committed list against a base made from itself ───────────────────
    log("");
    log("the committed list against a base made from itself:");
    const paths = new Map();
    for (const r of list.rows) {
        if (r.catalog === HOLDS.EXISTING) paths.set(catalogPathKey(r), [r.level1, r.level2, r.level3, r.size, r.maker, r.partNumber]);
        if (r.catalog === HOLDS.ADD_PART) paths.set(catalogPathKey({ ...r, partNumber: "" }), [r.level1, r.level2, r.level3, r.size, r.maker, ""]);
    }
    const catalog = [...paths.values()].map((levels, i) => row(`recC${i}`, levels));
    const pairs = new Map(list.rows.map((r) => [`${r.level1}\n${r.level2}`, { level1: r.level1, level2: r.level2 }]));
    const groups = [...pairs.values()].filter((g) => !GROUPS_THIS_RUN_MAY_ADD.some((pair) => pair.level1 === g.level1 && pair.level2 === g.level2)).map((g, i) => ({ id: `recG${i}`, ...g }));
    const siteJobs = ["25-USA-13", "26-USA-12", "23-USA-09"].map((jobCode, i) => ({ id: `recSite${i}`, jobCode, assets: [] }));
    const self = plan({ catalog, groups, jobs: siteJobs, recorder: { id: "recSoo", status: "Active", assignedJobs: siteJobs.map((j) => j.id) }, standing: [], prefix: "HYE-AST-261019", dayIds: [], list: list.rows }, NONE);
    check("  no problem", self.problems.join(" | "), "");
    check("  no note", self.notes.join(" | "), "");
    // Twenty existing rows on fourteen paths — two weld heads named three times each, the Milwaukee
    // drill and the automatic welder twice each — and the add part's target.
    check("  the catalog rows it was made of", catalog.length, 15);
    check("  the groups to add", self.groupsToCreate.map((g) => `${g.level1} > ${g.level2}`).join(" | "), "Tool > Other Tools | Tool > For Welders");
    check("  the new paths", self.pathsToCreate.length, 46);
    check("  the path four rows name", self.pathsToCreate.find(({ sources }) => sources.length > 1)?.sources.join(" "), "S4#21 S4#26 S4#43 S5#22");
    check("  the one path more than one row names", self.pathsToCreate.filter(({ sources }) => sources.length > 1).length, 1);
    check("  the part number", self.partsToAdd.map(({ category, entry }) => `${category.itemName} → ${entry.partNumber}`).join(" | "), "Band Saw, DeWalt → DCS375");
    check("  the items due", self.dueTotal, 508);
    const dueBy = (code) => self.rows.filter(({ row: r }) => r.job === code).reduce((sum, { due }) => sum + due, 0);
    check("  by job", ["25-USA-13", "26-USA-12", "23-USA-09"].map(dueBy).join(" "), "415 30 63");
    check("  the day's last id", self.last, 508);

    // ── the forecast ─────────────────────────────────────────────────────────
    log("");
    log("the forecast's arithmetic:");
    const small = forecast(whole, smallBase(), NONE);
    check("  each part on the small base", small.lines.map(([, n]) => n).join(" "), "5 2 4 2 1 15 6");
    check("  in all", small.total, 35);
    const one = (quantity, dayIds) => {
        const read = smallBase({ dayIds, list: readList(csv([[...SMALL[0].slice(0, 8), String(quantity), ...SMALL[0].slice(9)]])).rows });
        return forecast(plan(read, NONE), read, NONE).lines[5][1];
    };
    check("  one item on a day of 100 ids: a page and two writes", one(1, day(100)), 3);
    check("  one item on a day of 101 ids: two pages and two writes", one(1, day(101)), 4);
    check("  25 items: a page and three requests of each kind", one(25, []), 7);
    check("  the committed list on a base like the live one", forecast(self, { catalog: { length: 53 }, jobs: { length: 7 }, standing: [], dayIds: [] }, NONE).total, 616);
    // A run after a revert asks for the gone ledger's 508 too, and reads no log of theirs: 637, measured.
    const reverted = ledgered([ledgerOf([{ type: "assets", source: "S0", assets: Array.from({ length: 508 }, (_, i) => ({ id: `recGone${i}`, assetId: `gone-${i}` })) }])]);
    check("  the committed list after a revert of it", forecast(self, { catalog: { length: 53 }, jobs: { length: 7 }, standing: [], dayIds: [] }, reverted).total, 637);

    // ── the script's wiring ──────────────────────────────────────────────────
    log("");
    log("the script takes its judgments from the module and registers as the dialog's action does:");
    const script = parseSource(readFileSync(join(REPO_ROOT, SCRIPT_PATH), "utf8"), SCRIPT_PATH).ast;
    const fromPlan = [];
    const declared = [];
    const calls = [];
    let ownJobs = null;
    walk(script, (node) => {
        if (node.type === "ImportDeclaration" && node.source.value === PLAN_SPECIFIER) fromPlan.push(...node.specifiers.map((s) => s.imported.name));
        if (node.type === "FunctionDeclaration") declared.push(node.id.name);
        if (node.type === "VariableDeclarator" && calleeName(node.init ?? {}) === "assignedJobsFor") ownJobs = node.id.name;
        const name = calleeName(node);
        if (name) calls.push({ name, node });
    });
    for (const name of ["readList", "ledgered", "plan", "forecast", "isRunLedgerOf"]) assert(`  it imports ${name} from the module`, fromPlan.includes(name));
    check("  it declares none of the module's", declared.filter((name) => ["parseCsv", "readList", "ledgered", "plan", "forecast", "isRunLedgerOf"].includes(name)).join(" "), "");
    const called = (name) => calls.filter((c) => c.name === name);
    check("  it registers once, through the registration's two writers", `${called("createAssets").length} ${called("createFirstAssetLogEntries").length}`, "1 1");
    const reading = called("readRegistration")[0]?.node;
    assert("  readRegistration is asked with the recorder's own jobs", ownJobs !== null && reading?.arguments[1]?.type === "Identifier" && reading.arguments[1].name === ownJobs);
    assert("  and before the first write of the registration", reading && reading.start < called("createAssets")[0]?.node.start);
    const planSource = readFileSync(join(REPO_ROOT, PLAN_PATH), "utf8");
    const planImports = [];
    walk(parseSource(planSource, PLAN_PATH).ast, (node) => {
        if (node.type === "ImportDeclaration") planImports.push(node.source.value);
    });
    check("  the module imports nothing that reaches the base", planImports.filter((s) => /airtable\/|airtableOps|protectedTables/.test(s)).join(" "), "");
    assert("  the module's import walk saw its imports", planImports.includes("../../lib/assetCategory.js"));
}

if (isMain(import.meta.url)) standalone(title, run);

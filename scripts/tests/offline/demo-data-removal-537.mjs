// What removing the demo data judges before it writes (#537), on bases of this check's making.
//
// THE SUBJECT IS `scripts/import/remove_demo_data_537_plan.mjs`, the run's judgments apart from the
// base: which rows are the demo's, which kept row refuses the run by pointing at one, the schema it
// refuses, the order rows go and come back in, and whether a row made again reads as it did. The
// script talks to the base, so it is never run here; what is held of it is its wiring, off its
// source — every judgment taken from the plan, `refusesProtectedWrite` asked before each write and
// naming its base, the ledger opened before the first delete, and the one funnel refusing a write
// it was not told of before it sends.
//
// THE LISTS ARE HELD BY VALUE. The jobs' pattern, the vendors and the accounts are what Soo approved
// on 2026-10-21, so each is typed out here rather than read from the module.
//
// WHAT IT CANNOT SEE. Whether the base the script reads is shaped as these are — that is the run's
// own read-back after it removes and after it reverts, which compares every row with its ledger
// line — and whether Airtable takes a file through its upload endpoint, which only a revert shows.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { join } from "path";
import { REPO_ROOT, calleeName, callsBefore, callsTo, parseSource, walk } from "./_ast.mjs";
import { guardCallsWithoutBase, unguardedWrites } from "./protected-tables.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { PROTECTED_TABLES } from "../../protectedTables.mjs";
import {
    DEMO_ACCOUNTS,
    DEMO_JOB_CODE,
    DEMO_MAILBOXES,
    DEMO_VENDORS,
    KEPT_WHOLE,
    OWNED_LINKS,
    REMOVE_ORDER,
    SCRIPT,
    inChunks,
    keyOf,
    planRemoval,
    planRevert,
    remapIds,
    rowDifferences,
    schemaProblems,
    withoutFileAddresses,
    writableFields,
} from "../../import/remove_demo_data_537_plan.mjs";

export const title = "Removing the demo data judges the base first (#537)";

const SCRIPT_PATH = "scripts/import/ran/remove_demo_data_537.mjs";
const PLAN_SPECIFIER = "../remove_demo_data_537_plan.mjs";
const WRITES = ["deleteRecords", "createRecords", "updateRecords", "uploadAttachment"];

// ── a schema: every table, each owned link with a mirror on a kept catalog ──────

const MIRRORS = "Material Categories";

/** The primary fields the revert names rows by, where the cases below read one. */
const PRIMARY = { Jobs: "Job Code", Vendors: "Vendor Name", "Auth Tokens": "Token" };

/** A schema the plan recognizes: every table it names, every owned link, its mirror on `MIRRORS`. */
function schema() {
    const tables = [...REMOVE_ORDER, ...KEPT_WHOLE].map((name, i) => ({
        id: `tbl${String(i).padStart(14, "0")}`,
        name,
        primaryFieldId: `fld${String(i).padStart(10, "0")}name`,
        fields: [{ id: `fld${String(i).padStart(10, "0")}name`, name: PRIMARY[name] ?? "Name", type: "singleLineText" }],
    }));
    const byName = new Map(tables.map((t) => [t.name, t]));
    let n = 0;
    for (const [name, owned] of Object.entries(OWNED_LINKS)) {
        for (const field of owned) {
            const own = `fldOwn${String(n).padStart(11, "0")}`;
            const far = `fldFar${String(n++).padStart(11, "0")}`;
            byName.get(name).fields.push({ id: own, name: field, type: "multipleRecordLinks", options: { inverseLinkFieldId: far } });
            byName.get(MIRRORS).fields.push({ id: far, name: `${name} ${field}`, type: "multipleRecordLinks", options: { inverseLinkFieldId: own } });
        }
    }
    return tables;
}

const tableNamed = (tables, name) => tables.find((t) => t.name === name);

// ── a base: rows as the REST API returns them ───────────────────────────────────

const row = (id, fields) => ({ id, createdTime: "2026-09-11T00:00:00.000Z", fields });

/** A base holding a demo job's documents beside a real job's, every case the rules name. */
function base() {
    return {
        Jobs: [row("jDemo", { "Job Code": "26-DEMO-01" }), row("jDemo3", { "Job Code": "26-DEMO-03" }), row("jReal", { "Job Code": "23-USA-09" }), row("jLook", { "Job Code": "26-DEMO-1" }), row("jLook2", { "Job Code": "126-DEMO-01" })],
        Disciplines: [row("dDemo", { Job: ["jDemo"] }), row("dReal", { Job: ["jReal"] })],
        Vendors: [row("vDemo", { "Vendor Name": "Lone Star Pipe & Supply", Address: ["aVendor"] }), row("vReal", { "Vendor Name": "Swagelok TX" })],
        Addresses: [row("aVendor", { Vendors: ["vDemo"] }), row("aJob", { Jobs: ["jDemo"], Deliveries: ["dlDemo"] }), row("aShared", { Jobs: ["jReal"], Deliveries: ["dlDemo"] })],
        Users: [
            row("uFix", { Email: "Scoped-Fixture@HanyangEngUSA.com", "Assigned Jobs": ["jDemo"] }),
            row("uSoo", { Email: "soo@hanyangengusa.com", "Assigned Jobs": ["jReal"], "PR Signers": ["psDemo"] }),
        ],
        "Purchase Requests": [row("prDemo", { Discipline: ["dDemo"], Requester: ["uFix"], Vendor: ["vDemo"] }), row("prReal", { Discipline: ["dReal"], Requester: ["uSoo"], Vendor: ["vReal"] })],
        "PR Items": [row("piDemo", { PR: ["prDemo"], Category: ["mc1"] }), row("piReal", { PR: ["prReal"], Category: ["mc1"] })],
        "PR Signers": [row("psDemo", { PR: ["prDemo"], Signer: ["uSoo"] })],
        "PR Edit Requests": [],
        "PR Edit Log": [],
        Quotations: [row("qDemo", { PR: ["prDemo"], Vendor: ["vDemo"] })],
        "Purchase Orders": [row("poDemo", { PR: ["prDemo"] }), row("poReal", { PR: ["prReal"] })],
        "PO Items": [row("poiDemo", { PO: ["poDemo"], Material: ["mDemo"] }), row("poiDemo2", { PO: ["poDemo"], Material: ["mShared"] }), row("poiReal", { PO: ["poReal"], Material: ["mShared"] })],
        Materials: [row("mDemo", { "PO Items": ["poiDemo"], Category: ["mc1"] }), row("mShared", { "PO Items": ["poiDemo2", "poiReal"], Category: ["mc1"] })],
        "Material Prices": [row("mpDemo", { Material: ["mDemo"], Vendor: ["vDemo"] }), row("mpReal", { Material: ["mShared"], Vendor: ["vReal"] })],
        Invoices: [row("invDemo", { "Invoice Items": ["iiDemo"], Vendor: ["vDemo"] }), row("invReal", { "Invoice Items": ["iiReal"], Vendor: ["vReal"] })],
        "Invoice Items": [row("iiDemo", { Invoice: ["invDemo"], PO: ["poDemo"], "PO Item": ["poiDemo"] }), row("iiReal", { Invoice: ["invReal"], PO: ["poReal"], "PO Item": ["poiReal"] })],
        Deliveries: [row("dlDemo", { Job: ["jDemo"], "Delivery Address": ["aJob"] }), row("dlReal", { Job: ["jReal"] })],
        "Delivery Items": [row("diDemo", { Delivery: ["dlDemo"], "PO Item": ["poiDemo"] })],
        "Direct Purchases": [row("dpDemo", { Job: ["jDemo3"] })],
        "Auth Tokens": [
            row("tCode", { Token: "tok1", Email: "soo+code471@hanyangengusa.com", Mailbox: "soo@hanyangengusa.com" }),
            row("tLimit", { Token: "tok2", Email: "soo+limit148@hanyangengusa.com", Mailbox: "soo@hanyangengusa.com" }),
            row("tSoo", { Token: "tok3", Email: "soo@hanyangengusa.com", Mailbox: "soo@hanyangengusa.com" }),
        ],
        Assets: [row("asReal", { Job: ["jReal"], Category: ["ac1"] })],
        "Asset Log": [row("alReal", { Asset: ["asReal"], Job: ["jReal"], "Recorded By": ["uSoo"] })],
        "Asset Categories": [row("ac1", { Assets: ["asReal"] })],
        "Asset Category Groups": [],
        "Material Categories": [row("mc1", { "PR Items": ["piDemo", "piReal"], Materials: ["mDemo", "mShared"] })],
    };
}

const removedIds = (plan) => [...plan.remove.values()].flat().map((r) => r.id).sort();

export function run({ check, assert, log }) {
    // ── the lists, by value ─────────────────────────────────────────────────────
    log("the approved lists:");
    check("  the demo's vendors", DEMO_VENDORS.join("; "), "Lone Star Pipe & Supply; Gulf Coast Valve & Fitting; Brazos Metals");
    check(
        "  the demo's accounts",
        DEMO_ACCOUNTS.join("; "),
        "authz-fixture@hanyangengusa.com; scoped-fixture@hanyangengusa.com; name-fixture@hanyangengusa.com; soo+code471@hanyangengusa.com; soo+name473@hanyangengusa.com; soohyun.c@hanyangengusa.com"
    );
    check("  the demo's mailboxes add the one with no account", DEMO_MAILBOXES.filter((m) => !DEMO_ACCOUNTS.includes(m)).join("; "), "soo+limit148@hanyangengusa.com");
    check("  soo@ is no demo account", DEMO_MAILBOXES.includes("soo@hanyangengusa.com"), false);
    for (const code of ["26-DEMO-01", "26-DEMO-02", "26-DEMO-03"]) check(`  ${code} is a demo job`, DEMO_JOB_CODE.test(code), true);
    for (const code of ["23-USA-09", "25-USA-13", "26-USA-12", "UA00001", "26-DEMO-1", "126-DEMO-01", "26-DEMO-01X"]) check(`  ${code} is not`, DEMO_JOB_CODE.test(code), false);

    // ── the order ───────────────────────────────────────────────────────────────
    log("");
    log("the order rows go in:");
    check("  no table holding the site's records is in it", REMOVE_ORDER.filter((t) => PROTECTED_TABLES.includes(t)).join(", "), "");
    check("  and none kept whole", REMOVE_ORDER.filter((t) => KEPT_WHOLE.includes(t)).join(", "), "");
    for (const kept of ["Assets", "Asset Log", "Asset Categories", "Asset Category Groups", "Material Categories"]) assert(`  ${kept} is kept whole`, KEPT_WHOLE.includes(kept));
    check(
        "  the site's records' own links, from their module",
        JSON.stringify({ Assets: OWNED_LINKS.Assets, "Asset Log": OWNED_LINKS["Asset Log"] }),
        JSON.stringify({ Assets: ["Category", "Job"], "Asset Log": ["Asset", "Job", "Recorded By"] })
    );
    const before = (a, b) => REMOVE_ORDER.indexOf(a) !== -1 && REMOVE_ORDER.indexOf(a) < REMOVE_ORDER.indexOf(b);
    for (const [child, parent] of [
        ["Invoice Items", "Invoices"],
        ["Invoice Items", "PO Items"],
        ["Delivery Items", "Deliveries"],
        ["Delivery Items", "PO Items"],
        ["Material Prices", "Materials"],
        ["PR Items", "Quotations"],
        ["PR Signers", "Purchase Requests"],
        ["PO Items", "Materials"],
        ["PO Items", "Purchase Orders"],
        ["Purchase Orders", "Purchase Requests"],
        ["Purchase Requests", "Disciplines"],
        ["Disciplines", "Jobs"],
        ["Deliveries", "Jobs"],
        ["Jobs", "Vendors"],
        ["Vendors", "Addresses"],
        ["Addresses", "Users"],
        ["Users", "Auth Tokens"],
    ]) {
        assert(`  ${child} before ${parent}`, before(child, parent));
    }
    check("  ten rows to a request", inChunks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((c) => c.length).join(","), "10,1");

    // ── the schema ──────────────────────────────────────────────────────────────
    log("");
    log("the schema a run refuses:");
    check("  a schema of every table and owned link passes", schemaProblems(schema()).join("; "), "");
    const withTable = schema();
    withTable.push({ id: "tblNewTable000001", name: "Equipment Rentals", primaryFieldId: "fldX", fields: [] });
    assert("  a table classified nowhere refuses", schemaProblems(withTable).some((p) => p.includes("Equipment Rentals")));
    const withoutTable = schema().filter((t) => t.name !== "Assets");
    assert("  a table missing refuses", schemaProblems(withoutTable).some((p) => p.includes("no table Assets")));
    const twoOwned = schema();
    const users = tableNamed(twoOwned, "Users");
    const jobs = tableNamed(twoOwned, "Jobs");
    const assigned = users.fields.find((f) => f.name === "Assigned Jobs");
    const pic = jobs.fields.find((f) => f.name === "PIC");
    assigned.options.inverseLinkFieldId = pic.id;
    pic.options.inverseLinkFieldId = assigned.id;
    assert("  a pair owned on both sides refuses", schemaProblems(twoOwned).some((p) => p.includes("2 owned sides")));
    const noneOwned = schema();
    tableNamed(noneOwned, "Users").fields.push({ id: "fldUnownedA000001", name: "Watched Jobs", type: "multipleRecordLinks", options: { inverseLinkFieldId: "fldUnownedB000001" } });
    tableNamed(noneOwned, "Jobs").fields.push({ id: "fldUnownedB000001", name: "Watchers", type: "multipleRecordLinks", options: { inverseLinkFieldId: "fldUnownedA000001" } });
    assert("  a pair owned on neither side refuses", schemaProblems(noneOwned).some((p) => p.includes("0 owned sides")));
    const retyped = schema();
    tableNamed(retyped, "Assets").fields.find((f) => f.name === "Job").type = "singleLineText";
    assert("  an owned link that is no link refuses", schemaProblems(retyped).some((p) => p.includes("Assets.Job is a singleLineText")));
    const dropped = schema();
    const assets = tableNamed(dropped, "Assets");
    assets.fields = assets.fields.filter((f) => f.name !== "Job");
    assert("  an owned link missing refuses", schemaProblems(dropped).some((p) => p.includes("Assets has no field Job")));

    // ── which rows are the demo's ───────────────────────────────────────────────
    log("");
    log("which rows are the demo's:");
    const plan = planRemoval(base());
    check(
        "  the rows removed",
        removedIds(plan).join(","),
        ["aJob", "aVendor", "dDemo", "diDemo", "dlDemo", "dpDemo", "iiDemo", "invDemo", "jDemo", "jDemo3", "mDemo", "mpDemo", "piDemo", "poDemo", "poiDemo", "poiDemo2", "prDemo", "psDemo", "qDemo", "tCode", "tLimit", "uFix", "vDemo"].sort().join(",")
    );
    check("  nothing kept points at one in a link of its own", plan.blocking.length, 0);
    assert("  every removed row says why", removedIds(plan).every((id) => typeof plan.why.get(id) === "string" && plan.why.get(id) !== ""));
    check("  a material on a real order too is kept", plan.why.has("mShared"), false);
    check("  an address a real job uses too, and a demo delivery, is kept", plan.why.has("aShared"), false);
    check("  a token is judged by its Email, not its Mailbox", [plan.why.has("tCode"), plan.why.has("tSoo")].join(","), "true,false");
    check("  an account's address is judged in any case", plan.why.has("uFix"), true);
    check("  a real signer loses a mirror only", JSON.stringify(plan.mirrored.get("Users.PR Signers")), JSON.stringify({ rows: 1, links: 1 }));
    check("  so does a catalog row", JSON.stringify(plan.mirrored.get("Material Categories.PR Items")), JSON.stringify({ rows: 1, links: 1 }));
    check("  and that address", JSON.stringify(plan.mirrored.get("Addresses.Deliveries")), JSON.stringify({ rows: 1, links: 1 }));
    check("  rows come out in the order they go", [...plan.remove.keys()].join("|"), REMOVE_ORDER.join("|"));

    // ── a kept row pointing at a demo row refuses ───────────────────────────────
    log("");
    log("a kept row pointing at a demo row in a link of its own:");
    const blockedBy = (mutate) => {
        const b = base();
        mutate(b);
        return planRemoval(b).blocking.map((x) => `${x.table}.${x.field}:${x.id}`).join(",");
    };
    check("  a real user assigned to a demo job", blockedBy((b) => b.Users[1].fields["Assigned Jobs"].push("jDemo")), "Users.Assigned Jobs:uSoo");
    check("  an asset on a demo job", blockedBy((b) => (b.Assets[0].fields.Job = ["jDemo"])), "Assets.Job:asReal");
    check("  an event recorded by a demo account", blockedBy((b) => (b["Asset Log"][0].fields["Recorded By"] = ["uFix"])), "Asset Log.Recorded By:alReal");
    check("  a real request on a demo vendor", blockedBy((b) => (b["Purchase Requests"][1].fields.Vendor = ["vDemo"])), "Purchase Requests.Vendor:prReal");
    check(
        "  a real invoice's item charging a demo order — the item stays, so its own link refuses",
        blockedBy((b) => {
            b["Invoice Items"].push(row("iiMixed", { Invoice: ["invReal"], PO: ["poDemo"] }));
            b.Invoices[1].fields["Invoice Items"].push("iiMixed");
        }),
        "Invoice Items.PO:iiMixed"
    );
    check("  a real job's address that is the demo's", blockedBy((b) => (b.Jobs[2].fields["Delivery Address"] = ["aJob"])), "Jobs.Delivery Address:jReal");
    check("  an address of a real job's that names a demo job too", blockedBy((b) => b.Addresses[2].fields.Jobs.push("jDemo")), "Addresses.Jobs:aShared");

    // ── what a revert makes ─────────────────────────────────────────────────────
    log("");
    log("what a revert makes, and when it refuses:");
    const tables = schema();
    const lines = [{ type: "run", script: SCRIPT }, ...REMOVE_ORDER.flatMap((t) => plan.remove.get(t).map((r) => ({ type: "row", table: t, id: r.id, fields: r.fields })))];
    const left = Object.fromEntries(Object.entries(base()).map(([t, rs]) => [t, rs.filter((r) => !plan.why.has(r.id))]));
    const revert = planRevert(lines, tables, left);
    check("  onto the base the removal left, nothing refuses", revert.refusals.join("; "), "");
    check("  every ledger row is made", revert.creates.length, lines.length - 1);
    const order = [...new Set(revert.creates.map((c) => c.line.table))];
    check("  parents first", order.join("|"), [...REMOVE_ORDER].reverse().filter((t) => order.includes(t)).join("|"));
    const users2 = revert.creates.find((c) => c.line.id === "uFix");
    check("  a user's assignment to a job made later is written after", Object.keys(users2.deferred).join(","), "Assigned Jobs");
    check("  and not with the row", "Assigned Jobs" in users2.fields, false);
    const pr = revert.creates.find((c) => c.line.id === "prDemo");
    check("  a request takes its links to rows made before it with the row", Object.keys(pr.fields).sort().join(","), "Discipline,Requester,Vendor");
    check("  and defers none", Object.keys(pr.deferred).length, 0);
    const mirrorOnly = revert.creates.find((c) => c.line.id === "mDemo");
    check("  a mirror is never written", "PO Items" in mirrorOnly.fields || "PO Items" in mirrorOnly.deferred, false);
    const onto = (mutate) => {
        const b = JSON.parse(JSON.stringify(left));
        mutate(b);
        return planRevert(lines, tables, b).refusals.join("; ");
    };
    assert("  a job code taken since refuses", onto((b) => b.Jobs.push(row("jNew", { "Job Code": "26-DEMO-01" }))).includes("26-demo-01"));
    assert("  an address taken since refuses, in any case", onto((b) => b.Users.push(row("uNew", { Email: "scoped-fixture@hanyangengusa.com" }))).includes("scoped-fixture@hanyangengusa.com"));
    assert("  a kept row gone since refuses", onto((b) => (b["Material Categories"] = [])).includes("mc1"));
    const named = lines.filter((l) => l.type === "row" && keyOf(tableNamed(tables, l.table), l) !== null);
    assert("  six of the ledger's rows carry a name", named.length >= 6);
    assert("  onto the base before the removal, each of them refuses", planRevert(lines, tables, base()).refusals.length >= named.length);
    assert("  a ledger holding a protected table's row refuses", planRevert([...lines, { type: "row", table: "Assets", id: "asX", fields: {} }], tables, left).refusals.some((r) => r.includes("Assets")));

    // ── what a revert writes of a row ───────────────────────────────────────────
    log("");
    log("what a revert writes of a row:");
    const typed = {
        name: "Purchase Requests",
        primaryFieldId: "fldPrId",
        fields: [
            { id: "fldPrId", name: "PR ID", type: "singleLineText" },
            { id: "fldReq", name: "Requester", type: "multipleRecordLinks" },
            { id: "fldItems", name: "PR Items", type: "multipleRecordLinks" },
            { id: "fldTotal", name: "Total Amount", type: "formula" },
            { id: "fldSub", name: "Items Subtotal", type: "rollup" },
            { id: "fldJob", name: "Job", type: "multipleLookupValues" },
            { id: "fldFiles", name: "Quotation Files", type: "multipleLookupValues" },
            { id: "fldAt", name: "Created At", type: "dateTime" },
            { id: "fldStamp", name: "Made", type: "createdTime" },
            { id: "fldFee", name: "Shipping Fee", type: "currency" },
        ],
    };
    check("  the written fields", writableFields(typed).map((f) => f.name).join(","), "PR ID,Requester,Created At,Shipping Fee");
    check("  a user is known by address", keyOf({ name: "Users", primaryFieldId: "f", fields: [{ id: "f", name: "First Name" }] }, row("u", { "First Name": "Soo", Email: "Soo@X.com" })), "soo@x.com");

    // ── a row made again, compared ──────────────────────────────────────────────
    log("");
    log("a row made again, compared with its ledger line:");
    const file = { id: "attOld", url: "https://v5.airtableusercontent.com/x", filename: "q.pdf", size: 48, type: "application/pdf", thumbnails: { small: { url: "https://v5.airtableusercontent.com/t" } } };
    const kept = withoutFileAddresses([file]);
    check("  a file keeps its id, name, size and type and no address", JSON.stringify(kept), JSON.stringify([{ id: "attOld", filename: "q.pdf", size: 48, type: "application/pdf" }]));
    check("  so does a file in a lookup", JSON.stringify(withoutFileAddresses([file, file])).includes("airtableusercontent"), false);
    check("  ids map at any depth", JSON.stringify(remapIds({ a: ["recOld", "recKept"], b: "recOld" }, new Map([["recOld", "recNew"]]))), JSON.stringify({ a: ["recNew", "recKept"], b: "recNew" }));
    const line = { fields: { "PR ID": "HYE-PR-1", Requester: ["uOld"], "PR Items": ["piA", "piB"], "Total Amount": 12, Job: ["26-DEMO-01"], "Quotation Files": kept, "Made": "2026-09-11T00:00:00.000Z", "Shipping Fee": 2 } };
    const map = new Map([["uOld", "uNew"], ["piA", "piA2"], ["piB", "piB2"]]);
    const same = { fields: { "PR ID": "HYE-PR-1", Requester: ["uNew"], "PR Items": ["piB2", "piA2"], "Total Amount": 12, Job: ["26-DEMO-01"], "Quotation Files": [{ ...file, id: "attNew", url: "https://elsewhere" }], "Made": "2026-10-21T00:00:00.000Z", "Shipping Fee": 2 } };
    check("  the row as it was reads the same — a mirror in another order, a file under a new id, a new stamp", rowDifferences(typed, line, same, map).join(","), "");
    check("  a value changed is found", rowDifferences(typed, line, { fields: { ...same.fields, "Shipping Fee": 3 } }, map).join(","), "Shipping Fee");
    check("  a formula reading otherwise is found", rowDifferences(typed, line, { fields: { ...same.fields, "Total Amount": 13 } }, map).join(","), "Total Amount");
    check("  a link to the old id is found", rowDifferences(typed, line, { fields: { ...same.fields, Requester: ["uOld"] } }, map).join(","), "Requester");
    check("  a file of another size is found", rowDifferences(typed, line, { fields: { ...same.fields, "Quotation Files": [{ ...file, size: 49 }] } }, map).join(","), "Quotation Files");
    check("  a field gone is found", rowDifferences(typed, line, { fields: { ...same.fields, "PR ID": undefined } }, map).join(","), "PR ID");
    const emptyLookup = { fields: { ...line.fields, Job: [null] } };
    check("  a lookup of nothing reads as no value", rowDifferences(typed, emptyLookup, { fields: { ...same.fields, Job: undefined } }, map).join(","), "");
    check("  and a lookup of something does not", rowDifferences(typed, emptyLookup, { fields: { ...same.fields, Job: ["26-DEMO-02"] } }, map).join(","), "Job");

    // ── the script's wiring ─────────────────────────────────────────────────────
    log("");
    log("the script's wiring:");
    const source = readFileSync(join(REPO_ROOT, SCRIPT_PATH), "utf8");
    const { ast } = parseSource(source, SCRIPT_PATH);
    const fromPlan = new Set();
    walk(ast, (node) => {
        if (node.type === "ImportDeclaration" && node.source.value === PLAN_SPECIFIER) for (const s of node.specifiers) fromPlan.add(s.imported?.name);
    });
    for (const name of ["planRemoval", "planRevert", "schemaProblems", "rowDifferences", "withoutFileAddresses", "REMOVE_ORDER"]) assert(`  ${name} comes from the plan`, fromPlan.has(name));
    check("  every write has refusesProtectedWrite deciding before it", unguardedWrites(ast, WRITES).join(", "), "");
    check("  and each question names its base", guardCallsWithoutBase(ast).join(", "), "");
    const fn = (name) => {
        let found = null;
        walk(ast, (node) => {
            if (!found && node.type === "FunctionDeclaration" && node.id?.name === name) found = node;
        });
        return found;
    };
    assert("  the removal opens its ledger before its first delete", callsBefore(fn("remove"), "openLedger", "deleteRecords"));
    assert("  and reads the files before it", callsBefore(fn("remove"), "ledgerLine", "openLedger"));
    const firstAt = (root, predicate) => {
        let at = Infinity;
        walk(root, (node) => {
            if (predicate(node) && node.start < at) at = node.start;
        });
        return at;
    };
    const blockingRead = (root) => firstAt(root, (n) => n.type === "MemberExpression" && n.property?.name === "blocking");
    assert("  a blocking row stops the removal before a delete", blockingRead(fn("remove")) < callsTo(fn("remove"), "deleteRecords")[0]?.start);
    const refusalsRead = firstAt(fn("revert"), (n) => n.type === "MemberExpression" && n.object?.name === "refusals" && n.property?.name === "length");
    assert("  a refusal stops the revert before a create", refusalsRead < callsTo(fn("revert"), "createRecords")[0]?.start);
    let request = null;
    walk(ast, (node) => {
        if (!request && node.type === "MethodDefinition" && node.key?.name === "request") request = node;
    });
    const thrown = firstAt(request, (n) => n.type === "ThrowStatement");
    const sent = firstAt(request, (n) => calleeName(n) === "fetch");
    assert("  the funnel refuses an unplanned write before it sends", thrown < sent && sent !== Infinity);
    assert("  and a write is unplanned until a run plans its table", firstAt(request, (n) => n.type === "MemberExpression" && n.property?.name === "writable") < sent);
    check("  no request names typecast", /typecast/.test(source.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "")), false);
}

if (isMain(import.meta.url)) standalone(title, run);

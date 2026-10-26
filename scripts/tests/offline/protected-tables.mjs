// No script writes `Assets` or `Asset Log` on the live base (#531).
//
// THE RULE. The two tables hold the site's records on the live base — every item registered and
// every event recorded against one — and the app's own screens are their one writer there. A
// script that would write a row, a name or a description of either, or empty a table they link
// to, asks `scripts/protectedTables.mjs` first and stops before its first write. This holds the
// module's answer by value, and that every script that could write them asks it.
//
// ON THE LIVE BASE ALONE, AND EVERY QUESTION NAMES ITS BASE (#534). The answer is judged by the
// id of the base the run writes to, so it is held here on both bases by value — refused on
// `LIVE_BASE_ID` and on no base at all, let through on any other — and every call a guarded
// script makes passes a `baseId`, since a call that names none is refused wherever it runs and a
// script that forgot would be a script that could not run on the test base either. A
// description's question reads the base off the address, which it already carries.
//
// A DESCRIPTION ALONE IS THE ONE WRITE THAT GOES THROUGH (#531), and a script that makes one is
// classified `describes`: it imports `refusesBeyondDescriptions`, every `fetch` it makes has that
// guard deciding before it, it names no address but the Metadata API's, and it imports nothing but
// built-ins, the guard's module and `lib/airtableBase.js` — so no row request and no record writer
// of the app is in it.
// The guard's answer is held by value here too, a name beside a description refused among it.
//
// WHICH SCRIPTS COULD, FOUND RATHER THAN LISTED. Every `.mjs`, `.js` and `.py` file under
// `scripts/` is read, and one REACHES the two tables when it names either as a whole string —
// `"Assets"`, `"Asset Log"` — or by `TABLES.ASSETS` / `TABLES.ASSET_LOG`, or by its id on this
// base, or imports `lib/airtable/assets.js` or `lib/airtable/assetLog.js`, or names one of the
// app's four actions that write them — the note's among them since #533, which writes
// `Assets."Note"` from the item's page and is the app's write, not a script's. Each one that reaches is classified in `CLASSIFIED`
// below, and both directions fail: a script that reaches and is not classified, and an entry
// that names a file which no longer reaches. A description that merely mentions assets in a
// sentence is not a whole string and does not reach. This directory is left out: the tier
// creates nothing, by its own contract (`_harness.mjs`).
//
// WHAT "ASKS FIRST" MEANS HERE, AND WHAT IT CANNOT MEAN. A guarded script imports
// `refusesProtectedWrite`, and every call it makes to one of its listed writes has, in the same
// function — or at the top level — an earlier call to it whose answer decides a branch: the test
// of an `if`, or a constant read in one. That is source order, and source order is not execution
// order (`_ast.mjs`): a guard inside `if (false)` passes. The writes are listed per script by
// the call that starts them — `apply` and `revert` in `rename_tools_to_assets_513.mjs`, whose own
// bodies make the requests — so a request made inside a function a listed call reaches is held
// by that call's guard and not by its own. `create_tools_334.py` is Python, which cannot import
// the module: it is held to its own stop, `RENAMED_BY_513`, before its first write.
//
// WHAT IT CANNOT SEE. A script reaching a table through a name it builds at runtime — every
// table of `Object.values(TABLES)`, or a name read off the Metadata API — names neither. No
// script does that and writes today; `wipe_base.mjs`, which empties the tables in its ORDER, asks
// with ORDER itself.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { REPO_ROOT, calleeName, isFunctionNode, parentMap, parseSource, toPosix, walk } from "./_ast.mjs";
import { tableEntriesFromSource } from "./table-field-names.mjs";
import {
    LEDGERED_IMPORT,
    LEDGERED_ROW_FIELDS,
    PROTECTED_LINK_TARGETS,
    PROTECTED_TABLES,
    refusesBeyondDescriptions,
    refusesBeyondLedger,
    refusesProtectedWrite,
} from "../../protectedTables.mjs";
import { LIVE_BASE_ID } from "../../../lib/airtableBase.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "No script writes Assets or Asset Log (#531)";

const GUARD = "refusesProtectedWrite";
const DESCRIPTION_GUARD = "refusesBeyondDescriptions";
const GUARD_MODULE = "scripts/protectedTables.mjs";
const BASE_MODULE = "lib/airtableBase.js";

/** A base that is not the live one, as a test base's id is shaped. */
const OTHER_BASE_ID = "appTestBase00000";

/** The one address a `describes` script may name. */
const META_ROOT = "https://api.airtable.com/v0/meta";

/**
 * The two tables' ids, read off the live base's Metadata API on 2026-10-15 (#531) — and the test
 * base's too, which was made by duplicating it and kept every table and field id (#534).
 */
const PROTECTED_TABLE_IDS = ["tblXtmDonSyOyOvV3", "tblrox7y4akPKdbpF"];

/** The app's actions that write the two tables, which a script driving the live app would name. */
const PROTECTED_ACTIONS = ["recordAssetEventAction", "retireAssetAction", "registerAssetsAction", "updateAssetNoteAction"];

/** The two modules that read and write the two tables. */
const PROTECTED_MODULES = ["lib/airtable/assets.js", "lib/airtable/assetLog.js"];

/**
 * Every script that reaches the two tables, and what holds it. `writes` are the calls that
 * start a write, by callee name — each must have a guard before it in its own function.
 */
const CLASSIFIED = {
    "scripts/tests/verify-tools-schema-334.mjs": { writes: ["create", "createAssetLogEntry"] },
    "scripts/tests/verify-tool-item-ids-335.mjs": { writes: ["create", "register", "destroy"] },
    "scripts/tests/verify-asset-status-memory-560.mjs": { writes: ["create", "update"] },
    "scripts/import/ran/rename_tools_to_assets_513.mjs": { writes: ["apply", "revert"] },
    "scripts/import/ran/replace_asset_catalog_528.mjs": { writes: ["createRecords", "updateRecords", "deleteRecords"] },
    "scripts/demo/remove_demo_catalog_517.mjs": { writes: ["deleteRecords", "create"] },
    "scripts/demo/wipe_base.mjs": { writes: ["destroy"] },
    "scripts/import/ran/create_tools_334.py": { python: true },
    "scripts/import/ran/describe_repair_531.mjs": { describes: true },
    // `Assets."Note"`'s description, the field read and made by nothing here (#533).
    "scripts/import/ran/describe_note_533.mjs": { describes: true },
    // `Assets."Last Event At"` (#540): made on the test base, where the guard lets a create through,
    // and on the live base the hand step's, its description alone sent there.
    "scripts/import/ran/add_last_event_at_540.mjs": { describes: true },
    "scripts/import/ran/import_site_assets_544.mjs": {
        writes: [
            "createAssetCategoryGroup",
            "createAssetCategory",
            "updateAssetCategory",
            "createAssets",
            "createFirstAssetLogEntries",
            "destroy",
            "removeAssetCategory",
        ],
        ledgered: true,
    },
};

/** Every `.mjs`, `.js` and `.py` file under `scripts/`, but this tier's and the module's own. */
function scriptFiles() {
    const out = [];
    (function visit(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) visit(full);
            else if (/\.(mjs|js|py)$/.test(entry.name)) out.push(toPosix(relative(REPO_ROOT, full)));
        }
    })(join(REPO_ROOT, "scripts"));
    return out.filter((path) => !path.startsWith("scripts/tests/offline/") && path !== GUARD_MODULE).sort();
}

/** Whether a JavaScript source reaches the two tables (the header's list). */
export function reachesJs(ast, fromPath) {
    let reaches = false;
    walk(ast, (node) => {
        if (node.type === "Literal" && typeof node.value === "string") {
            if (PROTECTED_TABLES.includes(node.value) || PROTECTED_TABLE_IDS.includes(node.value) || PROTECTED_ACTIONS.includes(node.value)) reaches = true;
        }
        if (node.type === "TemplateLiteral" && node.expressions.length === 0 && PROTECTED_TABLES.includes(node.quasis[0]?.value?.cooked)) reaches = true;
        if (
            node.type === "MemberExpression" &&
            node.object?.name === "TABLES" &&
            (node.property?.name === "ASSETS" || node.property?.name === "ASSET_LOG")
        ) {
            reaches = true;
        }
        if (node.type === "Identifier" && PROTECTED_ACTIONS.includes(node.name)) reaches = true;
        if (node.type === "ImportDeclaration" && typeof node.source.value === "string") {
            const target = toPosix(join(fromPath, "..", node.source.value)).replace(/^\.\//, "");
            if (PROTECTED_MODULES.some((module) => target === module || target === module.replace(/\.js$/, ""))) reaches = true;
        }
    });
    return reaches;
}

/** Whether a Python source names either table as a whole string. */
export function reachesPy(source) {
    return PROTECTED_TABLES.some((table) => new RegExp(`["']${table}["']`).test(source));
}

/** Whether a guard is imported from the module, by its path resolved from the file. */
function importsGuard(ast, fromPath, guard = GUARD) {
    let found = false;
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        const target = toPosix(join(fromPath, "..", node.source.value)).replace(/^\.\//, "");
        if (target !== GUARD_MODULE) return;
        if (node.specifiers.some((s) => s.imported?.name === guard)) found = true;
    });
    return found;
}

/** The nearest function around a node, or the program. */
function scopeOf(node, parents) {
    let cur = parents.get(node);
    while (cur && !isFunctionNode(cur)) cur = parents.get(cur);
    return cur ?? null;
}

/**
 * Whether a guard call's answer decides a branch: it is the test of an `if` or a conditional, or
 * it is negated or joined there, or it initializes a constant that one of those reads.
 */
function decides(call, parents, root) {
    let cur = call;
    let parent = parents.get(cur);
    while (parent && (parent.type === "UnaryExpression" || parent.type === "LogicalExpression")) {
        cur = parent;
        parent = parents.get(cur);
    }
    if ((parent?.type === "IfStatement" || parent?.type === "ConditionalExpression") && parent.test === cur) return true;
    if (parent?.type === "VariableDeclarator" && parent.init === cur && parent.id?.type === "Identifier") {
        const name = parent.id.name;
        let read = false;
        walk(root, (node) => {
            if ((node.type === "IfStatement" || node.type === "ConditionalExpression") && node.test) {
                walk(node.test, (inner) => {
                    if (inner.type === "Identifier" && inner.name === name) read = true;
                });
            }
        });
        return read;
    }
    return false;
}

/**
 * Every listed write in a parsed JavaScript source with no deciding guard before it in its own
 * scope, as `name at offset` — and every listed write the source never makes, which is a stale
 * listing rather than a safe one.
 */
export function unguardedWrites(ast, writes, guard = GUARD) {
    const parents = parentMap(ast);
    const guards = [];
    const calls = [];
    walk(ast, (node) => {
        const name = calleeName(node);
        if (name === guard) guards.push(node);
        else if (writes.includes(name)) calls.push(node);
    });
    const findings = [];
    for (const call of calls) {
        const scope = scopeOf(call, parents);
        const covered = guards.some((guard) => scopeOf(guard, parents) === scope && guard.start < call.start && decides(guard, parents, scope ?? ast));
        if (!covered) findings.push(`${calleeName(call)} at ${call.start}`);
    }
    for (const name of writes) if (!calls.some((call) => calleeName(call) === name)) findings.push(`${name} is never called`);
    return findings;
}

/**
 * Every guard call in a parsed source that names no `baseId`, as `at offset` (#534): its first
 * argument must be an object literal carrying that property, by key, so a spread hiding it is a
 * finding too.
 */
export function guardCallsWithoutBase(ast, guard = GUARD) {
    const findings = [];
    walk(ast, (node) => {
        if (calleeName(node) !== guard) return;
        const arg = node.arguments[0];
        const named =
            arg?.type === "ObjectExpression" &&
            arg.properties.some((prop) => prop.type === "Property" && prop.key?.name === "baseId");
        if (!named) findings.push(`at ${node.start}`);
    });
    return findings;
}

/**
 * What is wrong with a `describes` script (#531): a `fetch` with no deciding description guard
 * before it, an address that is not the Metadata API's, or an import of anything but a built-in
 * and the guard's module.
 */
export function describerFindings(ast, fromPath) {
    const findings = unguardedWrites(ast, ["fetch"], DESCRIPTION_GUARD);
    walk(ast, (node) => {
        const texts =
            node.type === "Literal" && typeof node.value === "string"
                ? [node.value]
                : node.type === "TemplateLiteral"
                  ? node.quasis.map((q) => q.value.cooked ?? "")
                  : [];
        for (const text of texts) {
            if (text.includes("://") && !text.startsWith(META_ROOT)) findings.push(`names ${text}`);
        }
        if (node.type === "ImportDeclaration" && typeof node.source.value === "string") {
            const source = node.source.value;
            const target = toPosix(join(fromPath, "..", source)).replace(/^\.\//, "");
            if (!source.startsWith("node:") && target !== GUARD_MODULE && target !== BASE_MODULE) findings.push(`imports ${source}`);
        }
    });
    return findings;
}

const LEDGER_GUARD = "refusesBeyondLedger";

/**
 * What is wrong with a ledgered script's fence (#544): the function assigned over the SDK's
 * `runAction` — on the instance and on the functor — must ask `refusesBeyondLedger` in the test of an
 * `if` that returns, naming its base and the request, before it hands the request to the funnel it
 * wrapped (`inner.call`), and the script must install it before it loads or reverts.
 */
export function fenceFindings(ast) {
    const findings = [];
    let fenced = null;
    const assigned = [];
    walk(ast, (node) => {
        if (node.type === "VariableDeclarator" && node.id?.name === "fenced" && isFunctionNode(node.init ?? {})) fenced = node.init;
        if (node.type === "AssignmentExpression" && node.left?.property?.name === "runAction" && node.right?.name === "fenced") assigned.push(node.left.object?.name);
    });
    if (!fenced) return ["no function `fenced` to wrap the funnel with"];
    for (const owner of ["instance", "baseFunctor"]) if (!assigned.includes(owner)) findings.push(`${owner}.runAction is not the fence`);
    let guard = null;
    let send = null;
    walk(fenced, (node) => {
        if (node.type === "IfStatement" && !guard) {
            let asks = null;
            walk(node.test, (inner) => {
                if (calleeName(inner) === LEDGER_GUARD) asks = inner;
            });
            let returns = false;
            walk(node.consequent, (inner) => {
                if (inner.type === "ReturnStatement") returns = true;
            });
            if (asks && returns) guard = asks;
        }
        if (node.type === "CallExpression" && node.callee?.object?.name === "inner" && node.callee?.property?.name === "call") send = node;
    });
    if (!guard) findings.push(`the fence asks ${LEDGER_GUARD} in no if that returns`);
    else {
        const keys = (guard.arguments[0]?.properties ?? []).map((p) => p.key?.name);
        for (const key of ["baseId", "request", "allowed"]) if (!keys.includes(key)) findings.push(`the fence's question names no ${key}`);
    }
    if (!send) findings.push("the fence hands nothing to the funnel it wrapped");
    else if (guard && guard.start > send.start) findings.push("the fence sends before it asks");
    const calls = [];
    walk(ast, (node) => {
        const name = calleeName(node);
        if (name === "fenceRequests" || name === "load" || name === "revert") calls.push({ name, start: node.start });
    });
    const install = calls.find((call) => call.name === "fenceRequests");
    if (!install) findings.push("the script never installs the fence");
    else for (const call of calls.filter((c) => c.name !== "fenceRequests")) if (call.start < install.start) findings.push(`${call.name} is called before the fence is installed`);
    return findings;
}

/** What is wrong with a Python script's stop: it must name both tables and stop before it writes. */
export function pythonStopFindings(source) {
    const findings = [];
    const tuple = source.match(/^RENAMED_BY_513 = \(([^)]*)\)/m)?.[1] ?? "";
    for (const table of PROTECTED_TABLES) if (!tuple.includes(`"${table}"`)) findings.push(`RENAMED_BY_513 does not name ${table}`);
    const main = source.slice(source.indexOf("def main():"));
    if (!source.includes("def main():")) return [...findings, "no main()"];
    const stop = main.search(/renamed = \[name for name in RENAMED_BY_513 if find_table\(tables, name\)\]\s+if renamed:[\s\S]*?return 1/);
    if (stop === -1) findings.push("main() does not stop on RENAMED_BY_513");
    const firstWrite = Math.min(...["create_table(", "create_field(", "rename_field("].map((call) => main.indexOf(call)).filter((at) => at !== -1));
    if (!Number.isFinite(firstWrite)) findings.push("main() makes no write to stop before");
    else if (stop === -1 || stop > firstWrite) findings.push("main() writes before it stops");
    return findings;
}

export function run({ check, assert, log }) {
    // ── the names ────────────────────────────────────────────────────────────
    log("the protected tables are the base's, by TABLES:");
    const tables = Object.fromEntries(tableEntriesFromSource().map((entry) => [entry.key, entry.value]));
    assert("TABLES was read", Object.keys(tables).length > 0);
    check("  PROTECTED_TABLES", PROTECTED_TABLES.join(" | "), [tables.ASSETS, tables.ASSET_LOG].join(" | "));
    check("  and they are Assets and Asset Log", PROTECTED_TABLES.join(" | "), "Assets | Asset Log");
    check("  PROTECTED_LINK_TARGETS", PROTECTED_LINK_TARGETS.join(" | "), [tables.ASSET_CATEGORIES, tables.JOBS, tables.USERS].join(" | "));
    check("  and they are what the two link to", PROTECTED_LINK_TARGETS.join(" | "), "Asset Categories | Jobs | Users");
    assert("  the lists are frozen", Object.isFrozen(PROTECTED_TABLES) && Object.isFrozen(PROTECTED_LINK_TARGETS));

    // ── the answer, by value ─────────────────────────────────────────────────
    log("");
    log("refusesProtectedWrite, by value:");
    // On the live base unless a case names another — the base #531's answers were about.
    const ask = (input) => {
        const lines = [];
        const refused = refusesProtectedWrite({ script: "probe", baseId: LIVE_BASE_ID, ...input, log: (line) => lines.push(line) });
        return { refused, lines };
    };
    check("  a write to Assets is refused", ask({ writes: ["Assets"] }).refused, true);
    check("  a write to Asset Log is refused", ask({ writes: ["Asset Log"] }).refused, true);
    check("  a write to both among others is refused", ask({ writes: ["Asset Categories", "Asset Log", "Jobs"] }).refused, true);
    check("  writes to the tables they link to are not", ask({ writes: ["Asset Categories", "Jobs", "Users"] }).refused, false);
    check("  a write to another table is not", ask({ writes: ["Vendors"] }).refused, false);
    check("  nothing named is not", ask({}).refused, false);
    check("  emptying Assets is refused", ask({ wipes: ["Assets"] }).refused, true);
    check("  emptying Asset Categories is refused", ask({ wipes: ["Asset Categories"] }).refused, true);
    check("  emptying Jobs is refused", ask({ wipes: ["Jobs"] }).refused, true);
    check("  emptying Users is refused", ask({ wipes: ["Users"] }).refused, true);
    check("  emptying another table is not", ask({ wipes: ["Vendors", "Invoices"] }).refused, false);
    check("  a name in another case is not one of them", ask({ writes: ["assets", "asset log"] }).refused, false);
    const said = ask({ writes: ["Assets", "Asset Log", "Assets"] }).lines;
    check("  a refusal says two lines", said.length, 2);
    check("  the first names the script, each table once and the base", said[0], "REFUSED, before any write: probe would write Assets and Asset Log on the live base.");
    assert("  the second says why and that nothing was written", /site's records since #531/.test(said[1] ?? "") && /Nothing was written\.$/.test(said[1] ?? ""));
    check("  a run let through says nothing", ask({ writes: ["Vendors"] }).lines.length, 0);
    check("  a wipe names the linked table it reaches", ask({ wipes: ["Vendors", "Jobs"] }).lines[0], "REFUSED, before any write: probe would write Jobs on the live base.");

    log("");
    log("refusesProtectedWrite, by the base it is asked about (#534):");
    check("  a write to Assets on another base goes", ask({ baseId: OTHER_BASE_ID, writes: ["Assets"] }).refused, false);
    check("  a write to Asset Log on another base goes", ask({ baseId: OTHER_BASE_ID, writes: ["Asset Log"] }).refused, false);
    check("  emptying Jobs on another base goes", ask({ baseId: OTHER_BASE_ID, wipes: ["Jobs"] }).refused, false);
    check("  and says nothing", ask({ baseId: OTHER_BASE_ID, writes: ["Assets"] }).lines.length, 0);
    check("  a write to Assets on no named base is refused", ask({ baseId: undefined, writes: ["Assets"] }).refused, true);
    check("  as on an empty one", ask({ baseId: "", writes: ["Assets"] }).refused, true);
    check("  as on one that is not text", ask({ baseId: 0, writes: ["Asset Log"] }).refused, true);
    check(
        "  and says the base is not named",
        ask({ baseId: undefined, writes: ["Assets"] }).lines[0],
        "REFUSED, before any write: probe would write Assets on a base it does not name."
    );
    check("  no base and no protected table is not refused", ask({ baseId: undefined, writes: ["Vendors"] }).refused, false);
    check("  the live id in another case is another base", ask({ baseId: LIVE_BASE_ID.toLowerCase(), writes: ["Assets"] }).refused, false);

    // ── a description alone, by value (#531) ────────────────────────────────
    log("");
    log("refusesBeyondDescriptions, by value:");
    const BASE = `https://api.airtable.com/v0/meta/bases/${LIVE_BASE_ID}`;
    const FIELD = `${BASE}/tables/tblXtmDonSyOyOvV3/fields/fldMpl1xR9Sdwvehg`;
    const TABLE = `${BASE}/tables/tblXtmDonSyOyOvV3`;
    const send = (input) => {
        const lines = [];
        const refused = refusesBeyondDescriptions({ script: "probe", ...input, log: (line) => lines.push(line) });
        return { refused, lines };
    };
    check("  a read of the base's schema goes", send({ method: "GET", url: `${BASE}/tables` }).refused, false);
    check("  a field's description alone goes", send({ method: "PATCH", url: FIELD, body: { description: "x" } }).refused, false);
    check("  a table's description alone goes", send({ method: "PATCH", url: TABLE, body: { description: "x" } }).refused, false);
    check("  an empty description goes, as text", send({ method: "PATCH", url: FIELD, body: { description: "" } }).refused, false);
    check("  a name beside a description is refused", send({ method: "PATCH", url: FIELD, body: { name: "Status", description: "x" } }).refused, true);
    check("  a name alone is refused", send({ method: "PATCH", url: TABLE, body: { name: "Assets" } }).refused, true);
    check("  options are refused", send({ method: "PATCH", url: FIELD, body: { description: "x", options: {} } }).refused, true);
    check("  a body with no description is refused", send({ method: "PATCH", url: FIELD, body: {} }).refused, true);
    check("  a description that is not text is refused", send({ method: "PATCH", url: FIELD, body: { description: null } }).refused, true);
    check("  no body is refused", send({ method: "PATCH", url: FIELD }).refused, true);
    check("  a GET carrying a body is refused", send({ method: "GET", url: `${BASE}/tables`, body: {} }).refused, true);
    check("  a row read is refused", send({ method: "GET", url: `https://api.airtable.com/v0/${LIVE_BASE_ID}/Assets` }).refused, true);
    check("  a row write is refused", send({ method: "PATCH", url: `https://api.airtable.com/v0/${LIVE_BASE_ID}/tblXtmDonSyOyOvV3`, body: { description: "x" } }).refused, true);
    check("  a field created is refused", send({ method: "POST", url: `${TABLE}/fields`, body: { description: "x" } }).refused, true);
    // A body and an address that would go, so the method alone is what refuses these two.
    check("  a DELETE is refused", send({ method: "DELETE", url: FIELD, body: { description: "x" } }).refused, true);
    check("  a POST carrying a description alone is refused", send({ method: "POST", url: FIELD, body: { description: "x" } }).refused, true);
    check("  the field list itself is refused", send({ method: "PATCH", url: `${TABLE}/fields`, body: { description: "x" } }).refused, true);
    check("  another host is refused", send({ method: "GET", url: `https://example.com/v0/meta/bases/${LIVE_BASE_ID}/tables` }).refused, true);
    check("  a query on the schema read is refused", send({ method: "GET", url: `${BASE}/tables?include=x` }).refused, true);
    check("  no address is refused, and says so", send({ method: "GET" }).lines[0], "REFUSED, before sending: probe would send a request with no address.");
    const named = send({ method: "PATCH", url: FIELD, body: { name: "Status", description: "x" } }).lines;
    check("  a refusal says two lines", named.length, 2);
    check("  the first names what went beyond the description", named[0], "REFUSED, before sending: probe would send name beside a description.");
    assert("  the second says nothing was sent", /descriptions alone/.test(named[1] ?? "") && /Nothing was sent\.$/.test(named[1] ?? ""));
    check("  a request let through says nothing", send({ method: "PATCH", url: FIELD, body: { description: "x" } }).lines.length, 0);

    log("");
    log("refusesBeyondDescriptions, by the base in the address (#534):");
    const OTHER = `https://api.airtable.com/v0/meta/bases/${OTHER_BASE_ID}`;
    check("  a name on another base goes", send({ method: "PATCH", url: `${OTHER}/tables/tblXtmDonSyOyOvV3`, body: { name: "Assets" } }).refused, false);
    check("  a field created on another base goes", send({ method: "POST", url: `${OTHER}/tables/tblXtmDonSyOyOvV3/fields`, body: { name: "x" } }).refused, false);
    check(
        "  a row write on another base goes",
        send({ method: "PATCH", url: `https://api.airtable.com/v0/${OTHER_BASE_ID}/tblXtmDonSyOyOvV3`, body: {} }).refused,
        false
    );
    check(
        "  a row read with a query on another base goes",
        send({ method: "GET", url: `https://api.airtable.com/v0/${OTHER_BASE_ID}/Assets?pageSize=1` }).refused,
        false
    );
    check("  and says nothing", send({ method: "DELETE", url: `${OTHER}/tables/tblXtmDonSyOyOvV3` }).lines.length, 0);
    check(
        "  a row read with a query on the live base is refused",
        send({ method: "GET", url: `https://api.airtable.com/v0/${LIVE_BASE_ID}/Assets?pageSize=1` }).refused,
        true
    );
    check(
        "  another base on another host is refused",
        send({ method: "GET", url: `https://example.com/v0/meta/bases/${OTHER_BASE_ID}/tables` }).refused,
        true
    );
    check(
        "  plain http to another base is refused",
        send({ method: "GET", url: `http://api.airtable.com/v0/meta/bases/${OTHER_BASE_ID}/tables` }).refused,
        true
    );
    check("  an address naming no base is refused", send({ method: "GET", url: "https://api.airtable.com/v0/meta/bases" }).refused, true);

    // ── the one script that adds rows there, by value (#544) ────────────────
    log("");
    log("refusesBeyondLedger, by value:");
    const ASSET = (over = {}) => ({ "Asset ID": "HYE-AST-261019-001", Category: ["recCat"], Status: "In stock", Job: ["recJob"], ...over });
    const LOG_ROW = (over = {}) => ({ "Asset Log ID": "HYE-AST-261019-001-001", Asset: ["recMine"], Event: "Created", Job: ["recJob"], "Recorded By": ["recSoo"], "Event At": "2026-10-19T00:00:00.000Z", ...over });
    const made = new Map([["recMine", "HYE-AST-261019-001"]]);
    const fence = (over = {}) => ({ creates: true, created: made, deletes: new Set(), ...over });
    const judge = ({ script = LEDGERED_IMPORT, baseId = LIVE_BASE_ID, method = "post", path = "/Assets/", queryParams = {}, body, allowed = fence() }) => {
        const lines = [];
        const refused = refusesBeyondLedger({ script, baseId, request: { method, path, queryParams, body }, allowed, log: (line) => lines.push(line) });
        return { refused, lines };
    };
    const create = (fields, path = "/Assets/") => ({ path, body: { records: [{ fields }] } });
    check("  the module names the import", LEDGERED_IMPORT, "import_site_assets_544");
    check("  an asset as a registration writes it goes", judge(create(ASSET())).refused, false);
    check("  ten in one request go", judge({ body: { records: Array.from({ length: 10 }, () => ({ fields: ASSET() })) } }).refused, false);
    check("  eleven do not", judge({ body: { records: Array.from({ length: 11 }, () => ({ fields: ASSET() })) } }).refused, true);
    check("  another script's asset does not", judge({ ...create(ASSET()), script: "replace_asset_catalog_528" }).refused, true);
    check("  and says which script may", judge({ ...create(ASSET()), script: "x" }).lines[0], "REFUSED, before sending: x would write Assets, and only import_site_assets_544 adds rows there on the live base.");
    check("  an asset with a field more does not", judge(create(ASSET({ Notes: "x" }))).refused, true);
    const momentless = LOG_ROW();
    delete momentless["Event At"];
    check("  a Created row with a field fewer does not", judge(create(momentless, "/Asset%20Log/")).refused, true);
    check("  a Created row of two recorders does not", judge(create(LOG_ROW({ "Recorded By": ["recSoo", "recX"] }), "/Asset%20Log/")).refused, true);
    check("  an asset not in stock does not", judge(create(ASSET({ Status: "Out" }))).refused, true);
    check("  an asset of four digits does not", judge(create(ASSET({ "Asset ID": "HYE-AST-261019-1000" }))).refused, true);
    check("  an asset of another family does not", judge(create(ASSET({ "Asset ID": "HYE-TL-261019-001" }))).refused, true);
    check("  an asset of two jobs does not", judge(create(ASSET({ Job: ["recJob", "recJob2"] }))).refused, true);
    check("  a create with typecast does not", judge({ body: { records: [{ fields: ASSET() }], typecast: true } }).refused, true);
    check("  a create before the registrations begin does not", judge({ ...create(ASSET()), allowed: fence({ creates: false }) }).refused, true);
    check("  a Created row on an asset this run made goes", judge(create(LOG_ROW(), "/Asset%20Log/")).refused, false);
    check("  a Created row on another asset does not", judge(create(LOG_ROW({ Asset: ["recOther"] }), "/Asset%20Log/")).refused, true);
    check("  a Created row of the wrong id does not", judge(create(LOG_ROW({ "Asset Log ID": "HYE-AST-261019-001-002" }), "/Asset%20Log/")).refused, true);
    check("  a check-out row does not", judge(create(LOG_ROW({ Event: "Checked out" }), "/Asset%20Log/")).refused, true);
    check("  a log row naming whoever it was handed to does not", judge(create(LOG_ROW({ "Checked Out To": "x" }), "/Asset%20Log/")).refused, true);
    check("  a read goes", judge({ method: "get", path: "/Assets" }).refused, false);
    check("  a long read goes", judge({ method: "post", path: "/Asset%20Log/listRecords", body: {} }).refused, false);
    check("  a read of one row goes", judge({ method: "get", path: "/Assets/recX" }).refused, false);
    check("  an update in a batch does not", judge({ method: "patch", path: "/Assets/", body: { records: [{ id: "recMine", fields: { Status: "Out" } }] } }).refused, true);
    check("  an update of one row does not", judge({ method: "patch", path: "/Assets/recMine", body: { fields: {} } }).refused, true);
    check("  a replace does not", judge({ method: "put", path: "/Asset%20Log/", body: { records: [] } }).refused, true);
    const reverting = fence({ creates: false, deletes: new Set(["recMine", "recMine2"]) });
    check("  a delete of the ledger's rows goes", judge({ method: "delete", path: "/Assets", queryParams: { records: ["recMine", "recMine2"] }, allowed: reverting }).refused, false);
    check("  a delete reaching one more does not", judge({ method: "delete", path: "/Assets", queryParams: { records: ["recMine", "recOther"] }, allowed: reverting }).refused, true);
    check("  and names it", judge({ method: "delete", path: "/Assets", queryParams: { records: ["recMine", "recOther"] }, allowed: reverting }).lines[0], "REFUSED, before sending: import_site_assets_544 would delete recOther, which the ledger did not make on the live base.");
    check("  a delete of one row by its address does not", judge({ method: "delete", path: "/Assets/recMine", allowed: reverting }).refused, true);
    check("  a delete during a run does not", judge({ method: "delete", path: "/Assets", queryParams: { records: ["recMine"] } }).refused, true);
    check("  a create during a revert does not", judge({ ...create(ASSET()), allowed: reverting }).refused, true);
    check("  another table is not its question", judge({ method: "patch", path: "/Asset%20Categories/", body: {} }).refused, false);
    check("  the test base is not its question", judge({ method: "patch", path: "/Assets/", baseId: OTHER_BASE_ID }).refused, false);
    check("  no named base is the live one", judge({ method: "patch", path: "/Assets/", baseId: "" }).refused, true);
    check("  a delete naming no ids does not", judge({ method: "delete", path: "/Assets", queryParams: {}, allowed: reverting }).refused, true);
    check("  a refusal says two lines", judge({ method: "patch", path: "/Assets/" }).lines.length, 2);
    assert("  the second says nothing was sent", /Nothing was sent\.$/.test(judge({ method: "patch", path: "/Assets/" }).lines[1] ?? ""));
    check("  and the old question still refuses the import on the two", ask({ script: LEDGERED_IMPORT, writes: ["Assets", "Asset Log"] }).refused, true);

    log("");
    log("the rows the import may create are the registration's writers' own:");
    const written = (path, fn, marker) => {
        const keys = [];
        walk(parseSource(readFileSync(join(REPO_ROOT, path), "utf8"), path).ast, (node) => {
            if (!isFunctionNode(node) || node.id?.name !== fn) return;
            walk(node, (inner) => {
                if (inner.type !== "ObjectExpression" || !inner.properties.some((p) => p.key?.value === marker || p.key?.name === marker)) return;
                for (const p of inner.properties) if (p.type === "Property") keys.push(p.key.value ?? p.key.name);
            });
        });
        return keys;
    };
    const assetKeys = written("lib/airtable/assets.js", "createAssets", "Asset ID");
    check("  Assets: createAssets' row", [...assetKeys].sort().join(", "), [...LEDGERED_ROW_FIELDS.Assets].sort().join(", "));
    const logKeys = [...written("lib/airtable/assetLog.js", "createFirstAssetLogEntries", "Asset Log ID"), ...written("lib/airtable/assetLog.js", "entryFields", "Recorded By")];
    check("  Asset Log: createFirstAssetLogEntries' row and entryFields'", [...logKeys].sort().join(", "), [...LEDGERED_ROW_FIELDS["Asset Log"]].sort().join(", "));
    check("  the module's two tables are the protected two", Object.keys(LEDGERED_ROW_FIELDS).join(" | "), PROTECTED_TABLES.join(" | "));

    // ── the inventory, both ways ─────────────────────────────────────────────
    log("");
    log("every script that reaches the two tables is classified:");
    const files = scriptFiles();
    log(`  ${files.length} script files read`);
    assert("the walk read more than fifty scripts", files.length > 50);
    for (const expected of ["scripts/screen-strings.mjs", "scripts/import/ran/create_tools_334.py", "scripts/demo/seed_full_demo.mjs"]) {
        assert(`  the walk reached ${expected}`, files.includes(expected));
    }
    const reaching = files.filter((path) => {
        const source = readFileSync(join(REPO_ROOT, path), "utf8");
        return path.endsWith(".py") ? reachesPy(source) : reachesJs(parseSource(source, path).ast, path);
    });
    log(`  ${reaching.length} reach: ${reaching.join(", ")}`);
    check("  none reaches unclassified", reaching.filter((path) => !CLASSIFIED[path]).join(", "), "");
    check("  no classified file has stopped reaching", Object.keys(CLASSIFIED).filter((path) => !reaching.includes(path)).join(", "), "");

    log("");
    log("each asks before it writes:");
    for (const [path, entry] of Object.entries(CLASSIFIED)) {
        const source = readFileSync(join(REPO_ROOT, path), "utf8");
        if (entry.python) {
            check(`  ${path} stops on the two tables before it writes`, pythonStopFindings(source).join("; "), "");
            continue;
        }
        const { ast } = parseSource(source, path);
        if (entry.describes) {
            assert(`  ${path} imports ${DESCRIPTION_GUARD} from ${GUARD_MODULE}`, importsGuard(ast, path, DESCRIPTION_GUARD));
            check("    and sends descriptions alone, through it, to the Metadata API", describerFindings(ast, path).join("; "), "");
            continue;
        }
        assert(`  ${path} imports ${GUARD} from ${GUARD_MODULE}`, importsGuard(ast, path));
        check(`    and asks before ${entry.writes.join(", ")}`, unguardedWrites(ast, entry.writes).join("; "), "");
        check("    and every question names its base", guardCallsWithoutBase(ast).join("; "), "");
        if (entry.ledgered) {
            check(`    and is the one script the exception names`, path.replace(/^.*\//, "").replace(/\.mjs$/, ""), LEDGERED_IMPORT);
            assert(`    and imports ${LEDGER_GUARD} from ${GUARD_MODULE}`, importsGuard(ast, path, LEDGER_GUARD));
            check("    and fences the funnel, judging each request before it is sent", fenceFindings(ast).join("; "), "");
        }
    }
    log("");
    log("no other script names the exception:");
    const namers = files.filter((path) => {
        if (path.endsWith(".py")) return false;
        let names = false;
        walk(parseSource(readFileSync(join(REPO_ROOT, path), "utf8"), path).ast, (node) => {
            if (node.type === "Identifier" && (node.name === LEDGER_GUARD || node.name === "LEDGERED_IMPORT")) names = true;
            if (node.type === "Literal" && node.value === LEDGERED_IMPORT && !path.endsWith(`${LEDGERED_IMPORT}.mjs`) && !path.endsWith(`${LEDGERED_IMPORT}_plan.mjs`)) names = true;
        });
        return names;
    });
    check("  the scripts naming refusesBeyondLedger or the import", namers.join(" | "), Object.keys(CLASSIFIED).filter((path) => CLASSIFIED[path].ledgered).join(" | "));
    const wipe = parseSource(readFileSync(join(REPO_ROOT, "scripts/demo/wipe_base.mjs"), "utf8"), "wipe_base").ast;
    let wipesOrder = false;
    walk(wipe, (node) => {
        if (calleeName(node) !== GUARD) return;
        for (const prop of node.arguments[0]?.properties ?? []) {
            if (prop.key?.name === "wipes" && prop.value?.type === "Identifier" && prop.value.name === "ORDER") wipesOrder = true;
        }
    });
    assert("  wipe_base asks with its ORDER as what it empties", wipesOrder);

    // ── the readers see what they are for ────────────────────────────────────
    log("");
    log("anti-vacuity — each reader on planted sources:");
    const planted = (source) => parseSource(source, "planted").ast;
    assert("  a table named as a whole string reaches", reachesJs(planted(`const LOG = { name: "Asset Log" };`), "scripts/demo/x.mjs"));
    assert("  TABLES.ASSETS reaches", reachesJs(planted(`base(TABLES.ASSETS).select();`), "scripts/demo/x.mjs"));
    assert("  a table id reaches", reachesJs(planted(`const T = { A: "tblXtmDonSyOyOvV3" };`), "scripts/import/x.mjs"));
    assert("  an import of the writer's module reaches", reachesJs(planted(`import { createAssets } from "../../lib/airtable/assets.js";`), "scripts/tests/x.mjs"));
    assert("  an action of the app that writes them reaches", reachesJs(planted(`await post("retireAssetAction", []);`), "scripts/tests/x.mjs"));
    assert("  the note's action reaches too (#533)", reachesJs(planted(`await post("updateAssetNoteAction", []);`), "scripts/tests/x.mjs"));
    assert("  a sentence mentioning assets does not", !reachesJs(planted(`const d = "Assets holds the physical tools.";`), "scripts/import/x.mjs"));
    assert("  another table does not", !reachesJs(planted(`base(TABLES.VENDORS).create({});`), "scripts/demo/x.mjs"));
    assert("  Python naming a table reaches", reachesPy(`X = ("Assets",)`));
    assert("  Python in a sentence does not", !reachesPy(`X = "Assets holds tools"`));

    const unguarded = `await base(TABLES.ASSETS).create({});`;
    check("  a write with no guard is found", unguardedWrites(planted(unguarded), ["create"]).length, 1);
    const after = `await base(TABLES.ASSETS).create({}); if (refusesProtectedWrite({ writes: [TABLES.ASSETS] })) process.exit(1);`;
    check("  a guard after the write is found", unguardedWrites(planted(after), ["create"]).length, 1);
    const ignored = `refusesProtectedWrite({ writes: [TABLES.ASSETS] }); await base(TABLES.ASSETS).create({});`;
    check("  a guard whose answer decides nothing is found", unguardedWrites(planted(ignored), ["create"]).length, 1);
    const elsewhere = `function a() { if (refusesProtectedWrite({ writes: ["Assets"] })) return 1; } async function b() { await air.createRecords("x", []); }`;
    check("  a guard in another function is found", unguardedWrites(planted(elsewhere), ["createRecords"]).length, 1);
    const unread = `const refused = refusesProtectedWrite({ writes: ["Assets"] }); await air.deleteRecords("x", []);`;
    check("  a guard's constant read by no branch is found", unguardedWrites(planted(unread), ["deleteRecords"]).length, 1);
    const good = `if (refusesProtectedWrite({ writes: [TABLES.ASSETS] })) process.exit(1); await base(TABLES.ASSETS).create({});`;
    check("  a deciding guard before the write passes", unguardedWrites(planted(good), ["create"]).join("; "), "");
    const goodConst = `const refused = refusesProtectedWrite({ writes: ["Assets"] }); if (refused) { log("no"); } else { await base(TABLES.ASSETS).create({}); }`;
    check("  a guard's constant read by an if passes", unguardedWrites(planted(goodConst), ["create"]).join("; "), "");
    const negated = `async function f() { if (!refusesProtectedWrite({ writes: ["Jobs"] })) await air.createRecords("x", []); }`;
    check("  a negated guard still decides", unguardedWrites(planted(negated), ["createRecords"]).join("; "), "");
    check("  a listed write never made is found", unguardedWrites(planted(good), ["create", "destroy"]).join("; "), "destroy is never called");
    check("  a guard naming no base is found", guardCallsWithoutBase(planted(good)).length, 1);
    const based = `if (refusesProtectedWrite({ script: "x", baseId: base.getId(), writes: [TABLES.ASSETS] })) process.exit(1);`;
    check("  a guard naming its base passes", guardCallsWithoutBase(planted(based)).join("; "), "");
    const spread = `const q = { baseId: "x" }; if (refusesProtectedWrite({ ...q, writes: ["Assets"] })) process.exit(1);`;
    check("  a base hidden in a spread is found", guardCallsWithoutBase(planted(spread)).length, 1);
    check("  a question by variable is found", guardCallsWithoutBase(planted(`if (refusesProtectedWrite(q)) process.exit(1);`)).length, 1);

    const describer = `import { refusesBeyondDescriptions } from "../protectedTables.mjs";
const META_ROOT = "https://api.airtable.com/v0/meta";
async function request(method, path, body) {
    const url = \`\${META_ROOT}\${path}\`;
    if (refusesBeyondDescriptions({ script: "x", method, url, body })) throw new Error("refused");
    return fetch(url, { method });
}`;
    const describerAt = "scripts/import/x.mjs";
    check("  a describer sending through the guard passes", describerFindings(planted(describer), describerAt).join("; "), "");
    check(
        "  a fetch with no guard is found",
        describerFindings(planted(describer.replace(/ {4}if \(refusesBeyondDescriptions[^\n]*\n/, "")), describerAt).join("; "),
        `fetch at ${describer.replace(/ {4}if \(refusesBeyondDescriptions[^\n]*\n/, "").indexOf("fetch(")}`
    );
    check(
        "  a fetch outside the guarded function is found",
        describerFindings(planted(`${describer}\nawait fetch("https://api.airtable.com/v0/meta/bases");`), describerAt).length,
        1
    );
    check(
        "  a row address is found",
        describerFindings(planted(`${describer}\nconst ROWS = "https://api.airtable.com/v0/appAbc/Assets";`), describerAt).join("; "),
        "names https://api.airtable.com/v0/appAbc/Assets"
    );
    check(
        "  an import of the app's client is found",
        describerFindings(planted(`import { base } from "../../lib/airtable/client.js";\n${describer}`), describerAt).join("; "),
        "imports ../../lib/airtable/client.js"
    );
    check("  a built-in import is not", describerFindings(planted(`import { join } from "node:path";\n${describer}`), describerAt).join("; "), "");
    check(
        "  the base's module is not",
        describerFindings(planted(`import { resolveAirtableBase } from "../../lib/airtableBase.js";\n${describer}`), describerAt).join("; "),
        ""
    );

    const fenceGood = `function fenceRequests(baseFunctor) {
    const instance = baseFunctor._base;
    const inner = instance.runAction;
    const fenced = function (method, path, queryParams, body, callback) {
        if (refusesBeyondLedger({ script: "x", baseId: baseFunctor.getId(), request: { method, path }, allowed: {} })) {
            return;
        }
        setTimeout(() => inner.call(instance, method, path, queryParams, body, callback), 0);
    };
    instance.runAction = fenced;
    baseFunctor.runAction = fenced;
}
function main() { fenceRequests(base); return load(); }`;
    check("  a fence asking before it sends passes", fenceFindings(planted(fenceGood)).join("; "), "");
    check("  a fence sending first is found", fenceFindings(planted(fenceGood.replace("        setTimeout(() => inner.call(instance, method, path, queryParams, body, callback), 0);\n", "").replace("        if (refusesBeyondLedger", "        inner.call(instance, method, path, queryParams, body, callback);\n        if (refusesBeyondLedger"))).join("; "), "the fence sends before it asks");
    check("  a fence whose answer returns nothing is found", fenceFindings(planted(fenceGood.replace("            return;\n", "            log(1);\n"))).join("; "), "the fence asks refusesBeyondLedger in no if that returns");
    check("  a fence on the instance alone is found", fenceFindings(planted(fenceGood.replace("    baseFunctor.runAction = fenced;\n", ""))).join("; "), "baseFunctor.runAction is not the fence");
    check("  a question naming no base is found", fenceFindings(planted(fenceGood.replace("baseId: baseFunctor.getId(), ", ""))).join("; "), "the fence's question names no baseId");
    check("  a load before the fence is found", fenceFindings(planted(fenceGood.replace("fenceRequests(base); return load();", "load(); fenceRequests(base);"))).join("; "), "load is called before the fence is installed");
    check("  no fence installed is found", fenceFindings(planted(fenceGood.replace("fenceRequests(base); ", ""))).join("; "), "the script never installs the fence");

    const pyGood =`RENAMED_BY_513 = ("Asset Categories", "Assets", "Asset Log")\ndef main():\n    renamed = [name for name in RENAMED_BY_513 if find_table(tables, name)]\n    if renamed:\n        return 1\n    client.create_table(TOOLS)\n`;
    check("  a Python stop before its write passes", pythonStopFindings(pyGood).join("; "), "");
    const pyLate = pyGood.replace("    renamed =", "    client.create_field(t, f)\n    renamed =");
    check("  a Python write before the stop is found", pythonStopFindings(pyLate).join("; "), "main() writes before it stops");
    const pyNarrow = pyGood.replace(`, "Asset Log")`, ")");
    check("  a Python stop missing a table is found", pythonStopFindings(pyNarrow).join("; "), "RENAMED_BY_513 does not name Asset Log");
}

if (isMain(import.meta.url)) standalone(title, run);

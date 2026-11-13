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
// A FILE THAT ONLY LISTS THE TWO WRITES NOTHING (#575), and is classified `lists`: the wipe's
// tables, `scripts/demo/_wipe_tables.mjs`, name both because the wipe keeps them, and the scripts
// that read those lists are the ones that ask. Such a file imports `lib/airtable/client.js` for
// `TABLES` and nothing else, and makes no call at all — so nothing that could write is in it.
//
// WHICH SCRIPTS COULD, FOUND RATHER THAN LISTED. Every `.mjs`, `.js` and `.py` file under
// `scripts/` is read, and one REACHES the two tables when it names either as a whole string —
// `"Assets"`, `"Asset Log"` — or by `TABLES.ASSETS` / `TABLES.ASSET_LOG`, or by its id on this
// base, or imports `lib/airtable/assets.js` or `lib/airtable/assetLog.js` or a `lists` file, whose
// names it then holds, or names one of the app's five actions that write them — the note's among them since #533, which writes
// `Assets."Note"` from the item's page and is the app's write, not a script's, and the office's job change since #583,
// which moves an asset and its `Created` entry. Each one that reaches is classified in `CLASSIFIED`
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
// with ORDER itself, and so does `reset_demo.mjs`, which runs it.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { REPO_ROOT, calleeName, isFunctionNode, parentMap, parseSource, toPosix, walk } from "./_ast.mjs";
import { tableEntriesFromSource } from "./table-field-names.mjs";
import {
    LEDGERED_IMPORT,
    LEDGERED_ROW_FIELDS,
    OWNER_JOB_FIELD,
    OWNER_JOB_SCHEMA,
    PROTECTED_LINK_TARGETS,
    SERIAL_NUMBER_FIELD,
    SERIAL_NUMBER_SCHEMA,
    PROTECTED_TABLES,
    refusesBeyondDescriptions,
    refusesBeyondLedger,
    refusesProtectedWrite,
} from "../../protectedTables.mjs";
import { SCRIPT as FILL_SCRIPT } from "../../import/fill_owner_job_598_plan.mjs";
import { SCRIPT as MOVE_SCRIPT } from "../../import/serial_from_notes_602_plan.mjs";
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
const PROTECTED_ACTIONS = ["recordAssetEventAction", "retireAssetAction", "registerAssetsAction", "updateAssetNoteAction", "updateAssetSerialAction", "changeAssetJobAction", "deleteAssetAction"];

/**
 * The guard's exports that carry one of the two tables' ids (#598, #601): a script importing one reaches
 * the table it names, by id, with no literal of its own to find.
 */
const TABLE_CARRIERS = Object.entries({ OWNER_JOB_FIELD, SERIAL_NUMBER_FIELD })
    .filter(([, field]) => PROTECTED_TABLE_IDS.includes(field.table))
    .map(([name]) => name);

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
    // What the wipe empties and keeps (#575): it keeps the two, and the two scripts reading it ask.
    "scripts/demo/_wipe_tables.mjs": { lists: true },
    // Runs `wipe_base.mjs --confirm`, and says in its dry run what that empties (#575).
    "scripts/demo/reset_demo.mjs": { writes: ["run"] },
    "scripts/import/ran/create_tools_334.py": { python: true },
    "scripts/import/ran/describe_repair_531.mjs": { describes: true },
    // `Assets."Note"`'s description, the field read and made by nothing here (#533).
    "scripts/import/ran/describe_note_533.mjs": { describes: true },
    // `Assets."Last Event At"` (#540): made on the test base, where the guard lets a create through,
    // and on the live base the hand step's, its description alone sent there.
    "scripts/import/ran/add_last_event_at_540.mjs": { describes: true },
    // `Asset Categories."Asset Statuses"` (#582): a rollup of `Assets."Status"`, made on the test base,
    // and on the live base the hand step's, its description alone sent there.
    "scripts/import/ran/add_asset_statuses_582.mjs": { describes: true },
    // `Assets."Owner Job"` and its far side on `Jobs` (#598): made on both bases by this script, which the
    // guard lets make that one field on the live base and nothing else beyond descriptions.
    "scripts/import/ran/add_owner_job_598.mjs": { describes: true },
    // `Assets."Serial Number"` (#601): made on both bases by this script, which the guard lets make that one
    // field on the live base and nothing else beyond descriptions.
    "scripts/import/ran/add_serial_number_601.mjs": { describes: true },
    // `Assets."Note"` and `."Serial Number"`'s descriptions, which #612 made false: who writes them, in
    // every status the app shows. Descriptions alone, on either base.
    "scripts/import/ran/describe_details_612.mjs": { describes: true },
    // `Assets."Serial Number"`'s description again, one path in it: the #601 script's, which #602 had
    // moved into `ran/` before #612 named it. A description alone, on either base.
    "scripts/import/ran/describe_serial_path_612.mjs": { describes: true },
    // Six fields' descriptions and `Asset Category Groups`' own again, the paths of the scripts each
    // names: every one moved into `ran/` after its description named it (#621). Descriptions alone, on
    // either base.
    "scripts/import/ran/describe_ran_paths_621.mjs": { describes: true },
    // `Assets."Category"`'s description, one clause that named `Invoices."Delivery"` once #640 deleted
    // it; the link fields themselves are only read here, their deletion being a hand step. Descriptions
    // alone, on either base.
    "scripts/import/ran/remove_invoice_delivery_link_640.mjs": { describes: true },
    // `Asset Log."Event"`'s two loan options (#598), made by a row written with typecast and deleted at
    // once on the test base, and refused on the live base, where they are a hand step.
    "scripts/import/ran/add_loan_events_598.mjs": { writes: ["rowRequest"] },
    // `Owner Job` filled from `Job` for the assets standing before #598, and a serial number moved out of
    // each asset's note (#602), on both bases: fenced at the SDK's funnel, which let each update its named
    // fields on the live base until #621 and refuses it every request there since. Each asks with its
    // plan's `SCRIPT`, the name the guard is held to refuse below.
    "scripts/import/ran/fill_owner_job_598.mjs": { fenced: { plan: "scripts/import/fill_owner_job_598_plan.mjs", script: FILL_SCRIPT } },
    "scripts/import/ran/serial_from_notes_602.mjs": { fenced: { plan: "scripts/import/serial_from_notes_602_plan.mjs", script: MOVE_SCRIPT } },
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

/** The files classified `lists`, which a script importing reaches the two through (#575). */
const LIST_FILES = Object.keys(CLASSIFIED).filter((path) => CLASSIFIED[path].lists);

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
            if (LIST_FILES.includes(target)) reaches = true;
            if (target === GUARD_MODULE && node.specifiers.some((specifier) => TABLE_CARRIERS.includes(specifier.imported?.name))) reaches = true;
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

/** The one module a `lists` file may import, for `TABLES`. */
const CLIENT_MODULE = "lib/airtable/client.js";

/**
 * What is wrong with a `lists` file (#575): any call — a function's, a constructor's, a tag's or a
 * dynamic import's — and any import or re-export from anywhere but the client.
 */
export function listerFindings(ast, fromPath) {
    const findings = [];
    walk(ast, (node) => {
        if (node.type === "CallExpression") findings.push(`calls ${calleeName(node) ?? "something"}`);
        if (node.type === "NewExpression" || node.type === "TaggedTemplateExpression" || node.type === "ImportExpression") findings.push(`makes a ${node.type}`);
        if ((node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") && typeof node.source?.value === "string") {
            const target = toPosix(join(fromPath, "..", node.source.value)).replace(/^\.\//, "");
            if (target !== CLIENT_MODULE) findings.push(`imports ${node.source.value}`);
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
        if (name === "fenceRequests" || name === "load" || name === "fill" || name === "move" || name === "revert") calls.push({ name, start: node.start });
    });
    const install = calls.find((call) => call.name === "fenceRequests");
    if (!install) findings.push("the script never installs the fence");
    else for (const call of calls.filter((c) => c.name !== "fenceRequests")) if (call.start < install.start) findings.push(`${call.name} is called before the fence is installed`);
    return findings;
}

/**
 * Where the name a fence asks `refusesBeyondLedger` with comes from (#621): the module its `script`
 * identifier is imported from, resolved from the file — or what stands there instead, so a literal, a
 * second question or a name declared in the file is a finding rather than a name the check never held.
 */
function fenceScriptSource(ast, fromPath) {
    const values = [];
    walk(ast, (node) => {
        if (calleeName(node) !== LEDGER_GUARD) return;
        values.push((node.arguments[0]?.properties ?? []).find((prop) => prop.key?.name === "script")?.value ?? null);
    });
    if (values.length !== 1) return `${values.length} questions`;
    const [value] = values;
    if (value?.type !== "Identifier") return value ? `a ${value.type}` : "no script";
    let source = null;
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration" || !node.specifiers.some((specifier) => specifier.local?.name === value.name)) return;
        source = toPosix(join(fromPath, "..", node.source.value)).replace(/^\.\//, "");
    });
    return source ?? `${value.name}, imported from nowhere`;
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
    // Its owner job its job since #598, as `createAssets` writes a registration.
    const ASSET = (over = {}) => ({ "Asset ID": "HYE-AST-261019-001", Category: ["recCat"], Status: "In stock", Job: ["recJob"], "Owner Job": ["recJob"], ...over });
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
    check("  and says which script may", judge({ ...create(ASSET()), script: "x" }).lines[0], "REFUSED, before sending: x would send POST /Assets/, and only import_site_assets_544 sends one to Assets on the live base.");
    check("  another script's update of a row is refused, the owner job alone among them", judge({ script: "x", method: "patch", path: "/Assets/", body: { records: [{ id: "recA1", fields: { "Owner Job": ["recJob1"] } }] } }).refused, true);
    check("  another script's Asset Log row is refused", judge({ ...create(LOG_ROW(), "/Asset%20Log/"), script: "x" }).refused, true);
    check("  another script's read is refused too", judge({ script: "x", method: "get", path: "/Asset%20Log" }).refused, true);
    check("  an asset whose owner job is not its job does not (#598)", judge(create(ASSET({ "Owner Job": ["recJob2"] }))).refused, true);
    check("  nor one with no owner job (#598)", judge(create(ASSET({ "Owner Job": [] }))).refused, true);
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

    // ── the fill and the move, refused on the live base since #621 ──────────
    log("");
    log("refusesBeyondLedger for #598's fill and #602's move, every request refused on the live base (#621):");
    check("  the fill's plan names the script it asks for", FILL_SCRIPT, "fill_owner_job_598");
    check("  and the move's", MOVE_SCRIPT, "serial_from_notes_602");
    // Each fence as its script fills it (#598, #602) — what the guard let through until #621.
    const filling = { fills: new Map([["recA1", "recJob1"], ["recA2", "recJob2"]]), clears: new Set() };
    const clearing = { fills: new Map(), clears: new Set(["recA1"]) };
    const owner = (id, value) => ({ id, fields: { "Owner Job": value } });
    const moving = { read: new Set(["recS1", "recS3"]), writes: new Map([["recS1", { "Serial Number": "AB-1", Note: null }], ["recS3", { Note: null }]]) };
    const restoring = { read: new Set(["recS1"]), writes: new Map([["recS1", { "Serial Number": null, Note: "S/N AB-1" }]]) };
    const row = (id, fields) => ({ id, fields });
    const fill = (records, allowed = filling, over = {}) => judge({ script: FILL_SCRIPT, method: "patch", path: "/Assets/", body: { records }, allowed, ...over });
    const move = (records, allowed = moving, over = {}) => judge({ script: MOVE_SCRIPT, method: "patch", path: "/Assets/", body: { records }, allowed, ...over });
    check("  the fill's read of Assets is refused", judge({ script: FILL_SCRIPT, method: "get", path: "/Assets", allowed: filling }).refused, true);
    check("  and its long read", judge({ script: FILL_SCRIPT, method: "post", path: "/Assets/listRecords", body: {}, allowed: filling }).refused, true);
    check("  the owner job of a row its run read with none, the job it was read on, is refused", fill([owner("recA1", ["recJob1"])]).refused, true);
    check("  two in one request are", fill([owner("recA1", ["recJob1"]), owner("recA2", ["recJob2"])]).refused, true);
    check(
        "  and the refusal names the script and what it would send",
        fill([owner("recA1", ["recJob1"])]).lines[0],
        "REFUSED, before sending: fill_owner_job_598 would send PATCH /Assets/, and only import_site_assets_544 sends one to Assets on the live base."
    );
    check("  a revert's clearing of a row its ledger filled is refused", fill([owner("recA1", [])], clearing).refused, true);
    check("  the move's read of Assets is refused", judge({ script: MOVE_SCRIPT, method: "get", path: "/Assets", allowed: moving }).refused, true);
    check("  and its long read", judge({ script: MOVE_SCRIPT, method: "post", path: "/Assets/listRecords", body: {}, allowed: moving }).refused, true);
    check("  the planned number and note of a row its run read are refused", move([row("recS1", { "Serial Number": "AB-1", Note: null })]).refused, true);
    check("  a planned note alone is refused", move([row("recS3", { Note: null })]).refused, true);
    check(
        "  and the refusal names the script and what it would send",
        move([row("recS3", { Note: null })]).lines[0],
        "REFUSED, before sending: serial_from_notes_602 would send PATCH /Assets/, and only import_site_assets_544 sends one to Assets on the live base."
    );
    check("  a revert's giving back what its ledger read before is refused", move([row("recS1", { "Serial Number": null, Note: "S/N AB-1" })], restoring).refused, true);
    check("  an Asset Log request of either is refused", `${judge({ script: FILL_SCRIPT, method: "get", path: "/Asset%20Log", allowed: filling }).refused} ${judge({ script: MOVE_SCRIPT, method: "get", path: "/Asset%20Log", allowed: moving }).refused}`, "true true");
    check("  and on no named base each write is", `${fill([owner("recA1", ["recJob1"])], filling, { baseId: "" }).refused} ${move([row("recS3", { Note: null })], moving, { baseId: "" }).refused}`, "true true");
    check("  on the test base the fill's write is no question of the guard's", fill([owner("recA1", ["recJob1"])], filling, { baseId: OTHER_BASE_ID }).refused, false);
    check("  nor the move's", move([row("recS3", { Note: null })], moving, { baseId: OTHER_BASE_ID }).refused, false);
    check("  nor either revert", `${fill([owner("recA1", [])], clearing, { baseId: OTHER_BASE_ID }).refused} ${move([row("recS1", { "Serial Number": null, Note: "S/N AB-1" })], restoring, { baseId: OTHER_BASE_ID }).refused}`, "false false");
    check("  and it says nothing there", fill([owner("recA1", ["recJob1"])], filling, { baseId: OTHER_BASE_ID }).lines.length, 0);

    // ── the one script that makes a field there, by value (#598) ────────────
    log("");
    log("refusesBeyondDescriptions for the owner job's field, by value (#598):");
    const META = `https://api.airtable.com/v0/meta/bases/${LIVE_BASE_ID}`;
    const CREATE_URL = `${META}/tables/${OWNER_JOB_FIELD.table}/fields`;
    const JOBS_FIELD_URL = `${META}/tables/${OWNER_JOB_FIELD.linkedTable}/fields/fldAbc`;
    const link = (over = {}) => ({ name: "Owner Job", type: "multipleRecordLinks", description: "x", options: { linkedTableId: OWNER_JOB_FIELD.linkedTable }, ...over });
    const field = (input, script = OWNER_JOB_SCHEMA) => refusesBeyondDescriptions({ script, log: () => {}, ...input });
    check("  the module names the script, the field and its far side", `${OWNER_JOB_SCHEMA} ${OWNER_JOB_FIELD.name} ${OWNER_JOB_FIELD.inverse}`, "add_owner_job_598 Owner Job Assets (as Owner)");
    check("  and the two tables are Assets and Jobs by their ids", `${OWNER_JOB_FIELD.table} ${OWNER_JOB_FIELD.linkedTable}`, `${PROTECTED_TABLE_IDS[0]} tblGwgHuhTX6rwF1M`);
    check("  the link's create goes, on the live base", field({ method: "POST", url: CREATE_URL, body: link() }), false);
    check("  another script's does not", field({ method: "POST", url: CREATE_URL, body: link() }, "probe"), true);
    check("  another field name does not", field({ method: "POST", url: CREATE_URL, body: link({ name: "Owner" }) }), true);
    check("  another type does not", field({ method: "POST", url: CREATE_URL, body: link({ type: "singleLineText" }) }), true);
    check("  a link to another table does not", field({ method: "POST", url: CREATE_URL, body: link({ options: { linkedTableId: "tblOther" } }) }), true);
    check("  an option more does not", field({ method: "POST", url: CREATE_URL, body: link({ options: { linkedTableId: OWNER_JOB_FIELD.linkedTable, prefersSingleRecordLink: true } }) }), true);
    check("  a key more does not", field({ method: "POST", url: CREATE_URL, body: { ...link(), id: "x" } }), true);
    check("  no description does not", field({ method: "POST", url: CREATE_URL, body: Object.fromEntries(Object.entries(link()).filter(([key]) => key !== "description")) }), true);
    check("  a create on Asset Log does not", field({ method: "POST", url: `${META}/tables/${PROTECTED_TABLE_IDS[1]}/fields`, body: link() }), true);
    check("  the far side's rename goes", field({ method: "PATCH", url: JOBS_FIELD_URL, body: { name: "Assets (as Owner)" } }), false);
    check("  with its description", field({ method: "PATCH", url: JOBS_FIELD_URL, body: { name: "Assets (as Owner)", description: "x" } }), false);
    check("  another far side name does not", field({ method: "PATCH", url: JOBS_FIELD_URL, body: { name: "Assets 2" } }), true);
    check("  options beside it do not", field({ method: "PATCH", url: JOBS_FIELD_URL, body: { name: "Assets (as Owner)", options: {} } }), true);
    check("  a rename on Assets does not", field({ method: "PATCH", url: `${META}/tables/${OWNER_JOB_FIELD.table}/fields/fldAbc`, body: { name: "Assets (as Owner)" } }), true);
    check("  another script's rename does not", field({ method: "PATCH", url: JOBS_FIELD_URL, body: { name: "Assets (as Owner)" } }, "probe"), true);
    check("  a description alone still goes", field({ method: "PATCH", url: JOBS_FIELD_URL, body: { description: "x" } }), false);
    check("  a row write still does not", field({ method: "PATCH", url: `https://api.airtable.com/v0/${LIVE_BASE_ID}/${OWNER_JOB_FIELD.table}`, body: { records: [] } }), true);
    check("  nor a DELETE of the field", field({ method: "DELETE", url: `${CREATE_URL}/fldAbc` }), true);

    // ── and the second, the serial number's single line of text (#601) ──────
    log("");
    log("refusesBeyondDescriptions for the serial number's field, by value (#601):");
    const SERIAL_CREATE_URL = `${META}/tables/${SERIAL_NUMBER_FIELD.table}/fields`;
    const text = (over = {}) => ({ name: "Serial Number", type: "singleLineText", description: "x", ...over });
    const serial = (input, script = SERIAL_NUMBER_SCHEMA) => refusesBeyondDescriptions({ script, log: () => {}, ...input });
    check("  the module names the script and the field, on Assets by its id", `${SERIAL_NUMBER_SCHEMA} ${SERIAL_NUMBER_FIELD.name} ${SERIAL_NUMBER_FIELD.type} ${SERIAL_NUMBER_FIELD.table === PROTECTED_TABLE_IDS[0]}`, "add_serial_number_601 Serial Number singleLineText true");
    check("  the field's create goes, on the live base", serial({ method: "POST", url: SERIAL_CREATE_URL, body: text() }), false);
    check("  another script's does not", serial({ method: "POST", url: SERIAL_CREATE_URL, body: text() }, "probe"), true);
    check("  nor the owner job's script making it", serial({ method: "POST", url: SERIAL_CREATE_URL, body: text() }, OWNER_JOB_SCHEMA), true);
    check("  nor this script making the owner job's link", serial({ method: "POST", url: SERIAL_CREATE_URL, body: link() }), true);
    check("  another field name does not", serial({ method: "POST", url: SERIAL_CREATE_URL, body: text({ name: "Serial" }) }), true);
    check("  another type does not", serial({ method: "POST", url: SERIAL_CREATE_URL, body: text({ type: "multilineText" }) }), true);
    check("  options beside it do not", serial({ method: "POST", url: SERIAL_CREATE_URL, body: text({ options: {} }) }), true);
    check("  no description does not", serial({ method: "POST", url: SERIAL_CREATE_URL, body: { name: "Serial Number", type: "singleLineText" } }), true);
    check("  a create on Asset Log does not", serial({ method: "POST", url: `${META}/tables/${PROTECTED_TABLE_IDS[1]}/fields`, body: text() }), true);
    check("  a rename does not", serial({ method: "PATCH", url: `${SERIAL_CREATE_URL}/fldAbc`, body: { name: "Serial" } }), true);
    check("  a description alone still goes", serial({ method: "PATCH", url: `${SERIAL_CREATE_URL}/fldAbc`, body: { description: "x" } }), false);
    check("  a row write still does not", serial({ method: "PATCH", url: `https://api.airtable.com/v0/${LIVE_BASE_ID}/${SERIAL_NUMBER_FIELD.table}`, body: { records: [] } }), true);
    check("  and on the test base nothing is its question", serial({ method: "POST", url: SERIAL_CREATE_URL.replace(LIVE_BASE_ID, "appTestBase0000001"), body: text({ type: "multilineText" }) }), false);

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
        if (entry.lists) {
            check(`  ${path} only lists them: it imports the client alone and calls nothing`, listerFindings(ast, path).join("; "), "");
            continue;
        }
        if (entry.fenced) {
            // Fenced at the funnel alone (#598, #602): every request it sends is judged as it leaves, so
            // it asks no question of its own before a write, and names no writer of the app's. Since
            // #621 the guard refuses it every request on the live base, by the name it asks with.
            check(`  ${path} asks with its own name`, entry.fenced.script, path.replace(/^.*\//, "").replace(/\.mjs$/, ""));
            assert(`    and imports ${LEDGER_GUARD} from ${GUARD_MODULE}`, importsGuard(ast, path, LEDGER_GUARD));
            check("    and fences the funnel, judging each request before it is sent", fenceFindings(ast).join("; "), "");
            check("    and the name its fence asks with is its plan's", fenceScriptSource(ast, path), entry.fenced.plan);
            check(
                "    which the guard refuses on the live base, a read among its requests",
                refusesBeyondLedger({ script: entry.fenced.script, baseId: LIVE_BASE_ID, request: { method: "get", path: "/Assets" }, log: () => {} }),
                true
            );
            check("    and imports no writer of the two tables", PROTECTED_MODULES.filter((module) => new RegExp(module.replace(/\.js$/, "").replace(/\//g, "\\/")).test(source)).join(", "), "");
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
    check("  the scripts naming refusesBeyondLedger or the import", namers.join(" | "), Object.keys(CLASSIFIED).filter((path) => CLASSIFIED[path].ledgered || CLASSIFIED[path].fenced).sort().join(" | "));
    // The wipe and the reset that runs it (#575) each ask with the ORDER a wipe empties.
    for (const script of ["wipe_base", "reset_demo"]) {
        const ast = parseSource(readFileSync(join(REPO_ROOT, `scripts/demo/${script}.mjs`), "utf8"), script).ast;
        let wipesOrder = false;
        walk(ast, (node) => {
            if (calleeName(node) !== GUARD) return;
            for (const prop of node.arguments[0]?.properties ?? []) {
                if (prop.key?.name === "wipes" && prop.value?.type === "Identifier" && prop.value.name === "ORDER") wipesOrder = true;
            }
        });
        assert(`  ${script} asks with the wipe's ORDER as what it empties`, wipesOrder);
    }

    // ── the readers see what they are for ────────────────────────────────────
    log("");
    log("anti-vacuity — each reader on planted sources:");
    const planted = (source) => parseSource(source, "planted").ast;
    assert("  a table named as a whole string reaches", reachesJs(planted(`const LOG = { name: "Asset Log" };`), "scripts/demo/x.mjs"));
    assert("  TABLES.ASSETS reaches", reachesJs(planted(`base(TABLES.ASSETS).select();`), "scripts/demo/x.mjs"));
    assert("  a table id reaches", reachesJs(planted(`const T = { A: "tblXtmDonSyOyOvV3" };`), "scripts/import/x.mjs"));
    assert("  an import of the writer's module reaches", reachesJs(planted(`import { createAssets } from "../../lib/airtable/assets.js";`), "scripts/tests/x.mjs"));
    assert("  an import of a lists file reaches (#575)", reachesJs(planted(`import { ORDER } from "./_wipe_tables.mjs";`), "scripts/demo/x.mjs"));
    assert("  an import of another file beside it does not", !reachesJs(planted(`import { pick } from "./_demo_ids.mjs";`), "scripts/demo/x.mjs"));
    assert("  an action of the app that writes them reaches", reachesJs(planted(`await post("retireAssetAction", []);`), "scripts/tests/x.mjs"));
    assert("  the note's action reaches too (#533)", reachesJs(planted(`await post("updateAssetNoteAction", []);`), "scripts/tests/x.mjs"));
    assert("  and the serial number's (#601)", reachesJs(planted(`await post("updateAssetSerialAction", []);`), "scripts/tests/x.mjs"));
    assert("  an import of the guard's field carrying a table's id reaches (#601)", reachesJs(planted(`import { SERIAL_NUMBER_FIELD } from "../protectedTables.mjs";`), "scripts/import/x.mjs"));
    assert("  an import of the guard's question alone does not", !reachesJs(planted(`import { refusesBeyondDescriptions } from "../protectedTables.mjs";`), "scripts/import/x.mjs"));
    check("  the carriers are the two fields the guard lets a script make", TABLE_CARRIERS.join(" "), "OWNER_JOB_FIELD SERIAL_NUMBER_FIELD");
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

    const lister = `import { TABLES } from "../../lib/airtable/client.js";\nexport const KEPT = [TABLES.USERS, TABLES.ASSETS];`;
    const listerAt = "scripts/demo/_x.mjs";
    check("  a list naming the two from the client passes", listerFindings(planted(lister), listerAt).join("; "), "");
    check("  a list that calls is found", listerFindings(planted(`${lister}\nKEPT.push(TABLES.ASSET_LOG);`), listerAt).join("; "), "calls push");
    check("  a list that writes is found", listerFindings(planted(`${lister}\nawait base(TABLES.ASSETS).destroy([id]);`), listerAt).join("; "), "calls destroy; calls base");
    check("  a constructor is found", listerFindings(planted(`${lister}\nconst S = new Set(KEPT);`), listerAt).join("; "), "makes a NewExpression");
    check(
        "  an import of a writer is found",
        listerFindings(planted(`import { createAssets } from "../../lib/airtable/assets.js";\n${lister}`), listerAt).join("; "),
        "imports ../../lib/airtable/assets.js"
    );
    check("  a re-export from elsewhere is found", listerFindings(planted(`${lister}\nexport * from "../protectedTables.mjs";`), listerAt).join("; "), "imports ../protectedTables.mjs");

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
    const fencedAt = "scripts/import/ran/x.mjs";
    const fenceNamed = `import { SCRIPT } from "../x_plan.mjs";\n${fenceGood.replace('script: "x"', "script: SCRIPT")}`;
    check("  a fence asking with an imported name reads its module (#621)", fenceScriptSource(planted(fenceNamed), fencedAt), "scripts/import/x_plan.mjs");
    check("  a fence asking with a literal name is found", fenceScriptSource(planted(fenceGood), fencedAt), "a Literal");
    check("  a name declared in the file is found", fenceScriptSource(planted(`${fenceGood.replace('script: "x"', "script: SCRIPT")}\nconst SCRIPT = "x";`), fencedAt), "SCRIPT, imported from nowhere");
    check("  a second question is found", fenceScriptSource(planted(`${fenceNamed}\nrefusesBeyondLedger({ script: "y" });`), fencedAt), "2 questions");

    const pyGood =`RENAMED_BY_513 = ("Asset Categories", "Assets", "Asset Log")\ndef main():\n    renamed = [name for name in RENAMED_BY_513 if find_table(tables, name)]\n    if renamed:\n        return 1\n    client.create_table(TOOLS)\n`;
    check("  a Python stop before its write passes", pythonStopFindings(pyGood).join("; "), "");
    const pyLate = pyGood.replace("    renamed =", "    client.create_field(t, f)\n    renamed =");
    check("  a Python write before the stop is found", pythonStopFindings(pyLate).join("; "), "main() writes before it stops");
    const pyNarrow = pyGood.replace(`, "Asset Log")`, ")");
    check("  a Python stop missing a table is found", pythonStopFindings(pyNarrow).join("; "), "RENAMED_BY_513 does not name Asset Log");
}

if (isMain(import.meta.url)) standalone(title, run);

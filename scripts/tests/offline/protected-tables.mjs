// No script writes `Assets` or `Asset Log` (#531).
//
// THE RULE. The two tables hold the site's records — every item registered and every event
// recorded against one — and the app's own screens are their one writer. A script that would
// write a row, a name or a description of either, or empty a table they link to, asks
// `scripts/protectedTables.mjs` first and stops before its first write. This holds the module's
// answer by value, and that every script that could write them asks it.
//
// WHICH SCRIPTS COULD, FOUND RATHER THAN LISTED. Every `.mjs`, `.js` and `.py` file under
// `scripts/` is read, and one REACHES the two tables when it names either as a whole string —
// `"Assets"`, `"Asset Log"` — or by `TABLES.ASSETS` / `TABLES.ASSET_LOG`, or by its id on this
// base, or imports `lib/airtable/assets.js` or `lib/airtable/assetLog.js`, or names one of the
// app's three actions that write them. Each one that reaches is classified in `CLASSIFIED`
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
import { PROTECTED_LINK_TARGETS, PROTECTED_TABLES, refusesProtectedWrite } from "../../protectedTables.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "No script writes Assets or Asset Log (#531)";

const GUARD = "refusesProtectedWrite";
const GUARD_MODULE = "scripts/protectedTables.mjs";

/** The two tables' ids on this base, read off its Metadata API on 2026-10-15 (#531). */
const PROTECTED_TABLE_IDS = ["tblXtmDonSyOyOvV3", "tblrox7y4akPKdbpF"];

/** The app's actions that write the two tables, which a script driving the live app would name. */
const PROTECTED_ACTIONS = ["recordAssetEventAction", "retireAssetAction", "registerAssetsAction"];

/** The two modules that read and write the two tables. */
const PROTECTED_MODULES = ["lib/airtable/assets.js", "lib/airtable/assetLog.js"];

/**
 * Every script that reaches the two tables, and what holds it. `writes` are the calls that
 * start a write, by callee name — each must have a guard before it in its own function.
 */
const CLASSIFIED = {
    "scripts/tests/verify-tools-schema-334.mjs": { writes: ["create", "createAssetLogEntry"] },
    "scripts/tests/verify-tool-item-ids-335.mjs": { writes: ["create", "register", "destroy"] },
    "scripts/import/rename_tools_to_assets_513.mjs": { writes: ["apply", "revert"] },
    "scripts/import/replace_asset_catalog_528.mjs": { writes: ["createRecords", "updateRecords", "deleteRecords"] },
    "scripts/demo/remove_demo_catalog_517.mjs": { writes: ["deleteRecords", "create"] },
    "scripts/demo/wipe_base.mjs": { writes: ["destroy"] },
    "scripts/import/create_tools_334.py": { python: true },
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

/** Whether the guard is imported from the module, by its path resolved from the file. */
function importsGuard(ast, fromPath) {
    let found = false;
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        const target = toPosix(join(fromPath, "..", node.source.value)).replace(/^\.\//, "");
        if (target !== GUARD_MODULE) return;
        if (node.specifiers.some((s) => s.imported?.name === GUARD)) found = true;
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
export function unguardedWrites(ast, writes) {
    const parents = parentMap(ast);
    const guards = [];
    const calls = [];
    walk(ast, (node) => {
        const name = calleeName(node);
        if (name === GUARD) guards.push(node);
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
    const ask = (input) => {
        const lines = [];
        const refused = refusesProtectedWrite({ script: "probe", ...input, log: (line) => lines.push(line) });
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
    check("  the first names the script and each table once", said[0], "REFUSED, before any write: probe would write Assets and Asset Log.");
    assert("  the second says why and that nothing was written", /site's records since #531/.test(said[1] ?? "") && /Nothing was written\.$/.test(said[1] ?? ""));
    check("  a run let through says nothing", ask({ writes: ["Vendors"] }).lines.length, 0);
    check("  a wipe names the linked table it reaches", ask({ wipes: ["Vendors", "Jobs"] }).lines[0], "REFUSED, before any write: probe would write Jobs.");

    // ── the inventory, both ways ─────────────────────────────────────────────
    log("");
    log("every script that reaches the two tables is classified:");
    const files = scriptFiles();
    log(`  ${files.length} script files read`);
    assert("the walk read more than fifty scripts", files.length > 50);
    for (const expected of ["scripts/screen-strings.mjs", "scripts/import/create_tools_334.py", "scripts/demo/seed_full_demo.mjs"]) {
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
        assert(`  ${path} imports ${GUARD} from ${GUARD_MODULE}`, importsGuard(ast, path));
        check(`    and asks before ${entry.writes.join(", ")}`, unguardedWrites(ast, entry.writes).join("; "), "");
    }
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

    const pyGood = `RENAMED_BY_513 = ("Asset Categories", "Assets", "Asset Log")\ndef main():\n    renamed = [name for name in RENAMED_BY_513 if find_table(tables, name)]\n    if renamed:\n        return 1\n    client.create_table(TOOLS)\n`;
    check("  a Python stop before its write passes", pythonStopFindings(pyGood).join("; "), "");
    const pyLate = pyGood.replace("    renamed =", "    client.create_field(t, f)\n    renamed =");
    check("  a Python write before the stop is found", pythonStopFindings(pyLate).join("; "), "main() writes before it stops");
    const pyNarrow = pyGood.replace(`, "Asset Log")`, ")");
    check("  a Python stop missing a table is found", pythonStopFindings(pyNarrow).join("; "), "RENAMED_BY_513 does not name Asset Log");
}

if (isMain(import.meta.url)) standalone(title, run);

// What the Tools & Equipment list keeps of each asset's status between views (#560).
//
// THREE THINGS, AND THEY SPLIT THE WAY THIS AXIS'S CHECKS ALWAYS SPLIT.
//
//   THE MEMORY IS PURE (`lib/assetStatusMemory.js`), so it is driven here by value: a fake base
//   holding statuses and the moment each was modified, a fake clock, and the two reads the
//   memory is handed — every call it makes to each is recorded, so what a view costs is a count
//   rather than a guess. A first view reads every asset, a later one asks one question about
//   changes from the last, less a minute; a change shows on the next view; an asset not met is
//   read alone; the ten-minute bound reads again what nothing said had changed, and a memory
//   left for ten minutes is dropped whole; an older read never replaces a newer; views at once
//   share a read; and nothing answers an id it was not asked for. Since #541 each answer carries
//   the asset's printed id beside its status, and an id edited in the base shows as a status does.
//
//   WHAT THE LIST COUNTS IS PURE TOO (`lib/assetListView.js:countedAssets`): each asset's kind
//   off its category's array, its job off the scope's (`onJob`), its status and printed id off
//   the memory's answer — held by value over a fixture with two jobs, two kinds, an asset off the
//   scope with a status known, and one whose status nobody answered.
//
//   WHAT NO VALUE CAN SHOW IS READ OFF THE SOURCE: that the list counts what `countedAssets`
//   builds from what `getAssetStatuses` answered; that `lib/airtable/assets.js` makes the
//   memory once, when it loads — one made per call would meet every asset on every view and
//   every figure here would still pass; that its two reads name `Status` and `Asset ID` alone, a
//   hundred ids to a query, and the question is `changedSince` on the same two; and that the
//   memory imports nothing. Each is held beside a planted file doing it wrong.
//
// WHAT IT CANNOT SEE. Whether the base answers the question at once — the freshness the whole
// design rests on — which is Airtable's property and `verify-asset-status-memory-560.mjs`'s to
// measure; and whether a Vercel instance keeps the memory between requests, which no file in
// this repository can show.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { STATUS_CHANGE_OVERLAP_MS, STATUS_KEPT_MS, createAssetStatusMemory } from "../../../lib/assetStatusMemory.js";
import { assetListScope, countedAssets, summarizeAssetCategories } from "../../../lib/assetListView.js";
import { ASSET_STATUS } from "../../../lib/assetStatus.js";
import { ALL_JOBS } from "../../../lib/assetRoutes.js";
import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What the Tools & Equipment list keeps between views (#560)";

const MINUTE = 60 * 1000;
const PAGE = "app/(assets)/asset-categories/page.js";
const ASSETS = "lib/airtable/assets.js";
const MEMORY = "lib/assetStatusMemory.js";
const CLIENT = "lib/airtable/client.js";

/**
 * A base of statuses and their modified moments, a clock, and a memory over them, with every
 * read the memory makes written down. `slow` holds the by-id reads until `release()`.
 */
function rig({ statuses, slow = false } = {}) {
    let t = 1_000_000;
    // Each asset's printed id is its record id's, upper-cased after the token, until renamed.
    // Each asset's latest event is the first of the month until one is logged (#540).
    const base = new Map(
        Object.entries(statuses ?? {}).map(([id, status]) => [
            id,
            { status, assetId: `HYE-AST-${id.toUpperCase()}`, modifiedAt: 0, lastEventAt: "2026-10-01T00:00:00.000Z", loggedAt: 0 },
        ])
    );
    const calls = { reads: [], changes: [] };
    const held = [];
    const rowOf = (id) => ({ id, status: base.get(id).status, assetId: base.get(id).assetId, lastEventAt: base.get(id).lastEventAt });
    // A read answers the base as it stood when the read was sent, however late it lands.
    const readByIds = (ids) => {
        calls.reads.push([...ids]);
        const rows = ids.filter((id) => base.has(id)).map(rowOf);
        if (!slow) return Promise.resolve(rows);
        return new Promise((resolve) => held.push(() => resolve(rows)));
    };
    const readChangedSince = (moment) => {
        calls.changes.push(moment.getTime());
        // The status or the id modified after the moment, or an event logged after it (#540).
        return Promise.resolve([...base].filter(([, row]) => row.modifiedAt > moment.getTime() || row.loggedAt > moment.getTime()).map(([id]) => rowOf(id)));
    };
    const memory = createAssetStatusMemory({ readByIds, readChangedSince, now: () => t });
    return {
        memory,
        calls,
        advance: (ms) => {
            t += ms;
        },
        now: () => t,
        // A write in the base, from any instance or by hand: the status and when it was modified.
        write: (id, status) => base.set(id, { ...base.get(id), status, modifiedAt: t }),
        // A printed id edited by hand, which the question asks about as it asks about a status.
        rename: (id, assetId) => base.set(id, { ...base.get(id), assetId, modifiedAt: t }),
        // An event logged whose status write did not land (\`statusNotUpdated\`): the rollup moves alone.
        logged: (id, at) => base.set(id, { ...base.get(id), lastEventAt: at, loggedAt: t }),
        release: () => held.splice(0).forEach((go) => go()),
        reset: () => {
            calls.reads.length = 0;
            calls.changes.length = 0;
        },
    };
}

const said = (map) => [...map].map(([id, facts]) => `${id}=${facts.status}`).join(" ");
const idsSaid = (map) => [...map].map(([id, facts]) => `${id}=${facts.assetId}`).join(" ");
/** Lets the memory's own continuations run until `ready()` holds, or gives up. */
async function settle(ready) {
    for (let i = 0; i < 50 && !ready(); i += 1) await Promise.resolve();
    return ready();
}
const readsSaid = (calls) => calls.reads.map((ids) => `[${ids.join(",")}]`).join(" ");

/** The top-level statements of a parsed file that call `name`, and every call anywhere. */
function callsOf(parsed, name) {
    const found = [];
    walk(parsed.ast, (node) => {
        if (node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === name) found.push(node);
    });
    return found;
}
function topLevelCalls(parsed, name) {
    const out = [];
    for (const statement of parsed.ast.body) {
        const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        if (declaration?.type !== "VariableDeclaration") continue;
        for (const each of declaration.declarations) {
            const init = each.init;
            if (init?.type === "CallExpression" && init.callee.type === "Identifier" && init.callee.name === name) out.push(each.id.name);
        }
    }
    return out;
}

/**
 * How the list counts, off a page's source: the second argument `summarizeAssetCategories` is
 * handed, written out, and the call whose answer stands for the statuses in it.
 */
function countingOf(parsed) {
    const source = parsed.source;
    // What the rows are made of: the counted assets handed to `summarizeAssetCategories`, or since
    // #553 the call to `categoryListRows`, the one composition the list and its export share.
    const [summarize] = callsOf(parsed, "summarizeAssetCategories");
    const [composed] = callsOf(parsed, "categoryListRows");
    const counted = summarize?.arguments?.[1] ?? composed;
    // What stands for the statuses, `kept` since #541 carried the printed ids beside them.
    let statusesFrom = null;
    walk(parsed.ast, (node) => {
        if (node.type !== "VariableDeclarator" || node.id.type !== "Identifier" || node.id.name !== "kept") return;
        const init = node.init?.type === "AwaitExpression" ? node.init.argument : node.init;
        if (init?.type === "CallExpression") statusesFrom = init.callee.name;
    });
    return `${counted ? source.slice(counted.start, counted.end) : "-"} | kept from ${statusesFrom ?? "-"}`;
}

/** What the memory's two reads are, off `lib/airtable/assets.js`'s source. */
function memoryReadsOf(parsed) {
    const source = parsed.source;
    const [made] = callsOf(parsed, "createAssetStatusMemory");
    const config = made?.arguments?.[0];
    const property = (name) => config?.properties?.find((p) => p.key?.name === name);
    const text = (node) => (node ? source.slice(node.start, node.end).replace(/\s+/g, " ") : "-");
    return {
        byIds: text(property("readByIds")?.value),
        changed: text(property("readChangedSince")?.value),
    };
}

export async function run({ check, log }) {
    // ── the memory, by value ────────────────────────────────────────────────
    log("the memory, over a fake base and a fake clock:");
    check("the overlap is one minute", STATUS_CHANGE_OVERLAP_MS, 60000);
    check("the bound is ten minutes", STATUS_KEPT_MS, 600000);

    const a = rig({ statuses: { a: ASSET_STATUS.IN_STOCK, b: ASSET_STATUS.OUT, c: ASSET_STATUS.IN_STOCK, d: ASSET_STATUS.RETIRED } });
    const firstAt = a.now();
    const first = await a.memory(["a", "b", "c"]);
    check("a server that has met nothing reads every asset asked for, once", readsSaid(a.calls), "[a,b,c]");
    check("  and asks nothing about changes", a.calls.changes.length, 0);
    check("  and answers each", said(first), "a=In stock b=Out c=In stock");

    a.reset();
    a.advance(2 * MINUTE);
    const secondAt = a.now();
    const second = await a.memory(["a", "b", "c"]);
    check("a later view reads no asset again", a.calls.reads.length, 0);
    check("  and asks one question about changes", a.calls.changes.length, 1);
    check("  from the moment the first read was sent, less a minute", a.calls.changes[0], firstAt - 60000);
    check("  answering what it kept", said(second), "a=In stock b=Out c=In stock");

    a.reset();
    a.advance(MINUTE);
    a.write("b", ASSET_STATUS.IN_STOCK);
    a.advance(1000);
    const third = await a.memory(["a", "b", "c"]);
    check("a status changed in the base shows on the next view, whoever changed it", said(third), "a=In stock b=In stock c=In stock");
    check("  from the moment the view before asked, less a minute", a.calls.changes[0], secondAt - 60000);
    check("  and still reads no asset", a.calls.reads.length, 0);

    a.reset();
    const fourth = await a.memory(["a", "d", "x"]);
    check("an asset not met before is read alone, beside an id the base does not hold", readsSaid(a.calls), "[d,x]");
    check("  and the id the base does not hold is left out of the answer", said(fourth), "a=In stock d=Retired");
    a.reset();
    const fifth = await a.memory(["c"]);
    check("nothing answers an id it was not asked for, whatever is kept", said(fifth), "c=In stock");

    // The printed id, kept beside the status since #541 so the list finds an item by it.
    const p = rig({ statuses: { a: ASSET_STATUS.IN_STOCK, b: ASSET_STATUS.OUT } });
    const met = await p.memory(["a", "b"]);
    check("each answer carries the asset's printed id beside its status (#541)", `${idsSaid(met)} | ${said(met)}`, "a=HYE-AST-A b=HYE-AST-B | a=In stock b=Out");

    // The moment the list sorts by, kept beside them since #540, and an event shown on the next view
    // even where nothing modified the status — the question asks by the moment's own value.
    const momentsSaid = (map) => [...map].map(([id, facts]) => `${id}=${facts.lastEventAt}`).join(" ");
    const e = rig({ statuses: { a: ASSET_STATUS.IN_STOCK, b: ASSET_STATUS.OUT } });
    check("each answer carries the asset's latest event's moment (#540)", momentsSaid(await e.memory(["a", "b"])), "a=2026-10-01T00:00:00.000Z b=2026-10-01T00:00:00.000Z");
    e.advance(MINUTE);
    e.logged("b", "2026-10-23T09:00:00.000Z");
    e.advance(1000);
    e.reset();
    const eventSeen = await e.memory(["a", "b"]);
    check(
        "  an event logged with no status written shows on the next view, reading no asset",
        `${momentsSaid(eventSeen)} | ${said(eventSeen)} | ${e.calls.reads.length}`,
        "a=2026-10-01T00:00:00.000Z b=2026-10-23T09:00:00.000Z | a=In stock b=Out | 0"
    );
    p.reset();
    p.advance(MINUTE);
    p.rename("b", "HYE-AST-261019-430");
    p.advance(1000);
    const renamed = await p.memory(["a", "b"]);
    check(
        "  an id edited in the base shows on the next view, as a status does, reading no asset",
        `${idsSaid(renamed)} ${p.calls.changes.length} ${p.calls.reads.length}`,
        "a=HYE-AST-A b=HYE-AST-261019-430 1 0"
    );
    p.reset();
    p.advance(MINUTE);
    const keptSince = await p.memory(["b"]);
    check("  and is answered from memory after, its status with it", `${idsSaid(keptSince)} ${said(keptSince)} ${p.calls.reads.length}`, "b=HYE-AST-261019-430 b=Out 0");
    const bare = createAssetStatusMemory({
        readByIds: async (ids) => ids.map((id) => ({ id, status: ASSET_STATUS.IN_STOCK })),
        readChangedSince: async () => [],
        now: () => 7_000_000,
    });
    check("  a row the base answers with no id is kept with none rather than a guess", idsSaid(await bare(["z"])), "z=null");

    // The bound, and a memory left alone.
    const k = rig({ statuses: { a: ASSET_STATUS.IN_STOCK, b: ASSET_STATUS.OUT } });
    await k.memory(["a"]);
    k.advance(4 * MINUTE);
    await k.memory(["b"]);
    k.reset();
    k.advance(5 * MINUTE);
    await k.memory(["a", "b"]);
    check("a status kept nine minutes is answered from memory", k.calls.reads.length, 0);
    k.reset();
    k.advance(2 * MINUTE);
    await k.memory(["a", "b"]);
    check("a status kept past ten minutes is read again, though nothing said it changed", readsSaid(k.calls), "[a]");
    check("  and one kept less long is not", k.calls.reads.flat().includes("b"), false);

    const g = rig({ statuses: { a: ASSET_STATUS.IN_STOCK } });
    await g.memory(["a"]);
    g.reset();
    g.advance(10 * MINUTE + 1000);
    await g.memory(["a"]);
    check("a memory nobody asked for past ten minutes is read again whole", readsSaid(g.calls), "[a]");
    check("  and asks nothing about the gap", g.calls.changes.length, 0);
    g.reset();
    g.advance(MINUTE);
    await g.memory(["a"]);
    check("  and the view after it asks from that read, less a minute", g.calls.changes[0], g.now() - MINUTE - 60000);

    // An older read never replaces a newer one. A read of `a` is sent, `a` changes, later views'
    // questions answer the change — the overlap re-answering it until a view asks from past it —
    // and only then does the first read land, with the status from before.
    const o = rig({ statuses: { a: ASSET_STATUS.IN_STOCK, b: ASSET_STATUS.IN_STOCK }, slow: true });
    const warming = o.memory(["b"]);
    await settle(() => o.calls.reads.length === 1);
    o.release();
    await warming;
    o.advance(MINUTE);
    const slowRead = o.memory(["a"]);
    const sent = await settle(() => o.calls.reads.length === 2);
    o.advance(1000);
    o.write("a", ASSET_STATUS.OUT);
    o.advance(1000);
    await o.memory(["b"]);
    o.advance(2 * MINUTE);
    await o.memory(["b"]);
    o.advance(1000);
    await o.memory(["b"]);
    o.release();
    const late = await slowRead;
    o.advance(1000);
    const after = await o.memory(["a"]);
    check("a status read earlier does not replace one read later", `${sent} ${said(late)} | ${said(after)}`, "true a=In stock | a=Out");

    // Views at once share a read.
    const s = rig({ statuses: { a: ASSET_STATUS.IN_STOCK, b: ASSET_STATUS.OUT }, slow: true });
    const one = s.memory(["a", "b"]);
    const two = s.memory(["b", "a"]);
    await settle(() => s.calls.reads.length > 0);
    s.release();
    const [answerOne, answerTwo] = await Promise.all([one, two]);
    check("views at once on assets not met share one read of them", readsSaid(s.calls), "[a,b]");
    check("  and each is answered", `${said(answerOne)} | ${said(answerTwo)}`, "a=In stock b=Out | b=Out a=In stock");

    // A read that fails.
    let failing = true;
    const f = createAssetStatusMemory({
        readByIds: async (ids) => {
            if (failing) throw new Error("base down");
            return ids.map((id) => ({ id, status: ASSET_STATUS.IN_STOCK }));
        },
        readChangedSince: async () => [],
        now: () => 5_000_000,
    });
    let refused = "answered";
    try {
        await f(["a"]);
    } catch {
        refused = "refused";
    }
    failing = false;
    let again;
    try {
        again = said(await f(["a"]));
    } catch {
        again = "refused again";
    }
    check("a read that fails fails the view, and the next view reads again", `${refused} | ${again}`, "refused | a=In stock");

    // ── what the list counts, by value ──────────────────────────────────────
    log("");
    log("what the list counts — the kind and the job off the arrays, the status off the memory:");
    const JOBS = [
        { id: "recJ1", jobCode: "26-A", assets: ["a1", "a2"] },
        { id: "recJ2", jobCode: "26-B", assets: ["a3"] },
        { id: "recJ3", jobCode: "26-C", assets: ["a9"] },
    ];
    const KINDS = [
        { id: "recK1", itemName: "Grinder", assets: ["a1", "a3", "a9"] },
        { id: "recK2", itemName: "Welder", assets: ["a2", "a4", "a3"] },
    ];
    const office = { isAdmin: true, assignedJobs: [] };
    const site = { isAdmin: false, assignedJobs: ["recJ1", "recJ2"] };
    const kept = new Map([
        ["a1", { status: ASSET_STATUS.IN_STOCK, assetId: "HYE-AST-261019-001" }],
        ["a2", { status: ASSET_STATUS.OUT, assetId: "HYE-AST-261019-002" }],
        ["a3", { status: ASSET_STATUS.RETIRED, assetId: "HYE-AST-261019-003" }],
        ["a4", { status: ASSET_STATUS.IN_REPAIR, assetId: "HYE-AST-261019-004" }],
    ]);
    const all = assetListScope(site, JOBS, ALL_JOBS);
    // Every job since #593, the site reader's included — a9 on recJ3 among them.
    check("the scope names the job whose array holds each asset", [...all.onJob].map(([id, job]) => `${id}>${job}`).join(" "), "a1>recJ1 a2>recJ1 a3>recJ2 a9>recJ3");
    check("  and one job's scope names that job's alone", [...assetListScope(site, JOBS, "recJ2").onJob].map(([id, job]) => `${id}>${job}`).join(" "), "a3>recJ2");
    const counted = countedAssets(KINDS, all, kept);
    check(
        "each asset is counted with its category's kind, its job's array, its kept status and its printed id (#541)",
        counted.map((x) => `${x.id}:${x.category[0]}:${x.job[0]}:${x.status}:${x.assetId}`).join(" "),
        "a1:recK1:recJ1:In stock:HYE-AST-261019-001 a3:recK1:recJ2:Retired:HYE-AST-261019-003 a2:recK2:recJ1:Out:HYE-AST-261019-002"
    );
    check("  an asset off the scope is not counted, though its status is known", counted.some((x) => x.id === "a4"), false);
    check("  an asset whose status nobody answered is counted nowhere", countedAssets(KINDS, assetListScope(office, JOBS, ALL_JOBS), kept).some((x) => x.id === "a9"), false);
    check("  and an asset under two kinds' arrays is counted once, under the first", counted.filter((x) => x.id === "a3").map((x) => x.category[0]).join(","), "recK1");
    const rows = summarizeAssetCategories(KINDS, counted);
    check(
        "the rows count it, each job's figures under the jobs the reader stands on alone",
        rows.map((row) => `${row.itemName} ${row.counts.map((c) => c.count).join("/")} ${Object.keys(row.perJob).join(",")}`).join(" | "),
        "Grinder 1/0/0/1 recJ1,recJ2 | Welder 0/1/0/0 recJ1"
    );
    check(
        "  and each row carries the assets it counts by printed id, with their jobs and statuses (#541)",
        rows.map((row) => `${row.itemName} ${JSON.stringify(row.assetIds)}`).join(" | "),
        'Grinder {"recJ1":{"In stock":["HYE-AST-261019-001"]},"recJ2":{"Retired":["HYE-AST-261019-003"]}} | Welder {"recJ1":{"Out":["HYE-AST-261019-002"]}}'
    );

    // ── the source ──────────────────────────────────────────────────────────
    log("");
    log("the wiring, off the source:");
    const page = parseFile(PAGE);
    check(
        "the list counts what countedAssets builds from what getAssetStatuses answered",
        countingOf(page),
        "categoryListRows(shownCategories, scope, kept) | kept from getAssetStatuses"
    );
    check(
        // A category with nothing counted under it is left off since #582, so the composition counts first.
        "  through the one composition, summarizeAssetCategories of countedAssets (#553)",
        /export function categoryListRows\(categories, scope, kept\) \{\s*const counted = countedAssets\(categories, scope, kept\);[\s\S]*?return summarizeAssetCategories\([\s\S]*?,\s*counted\s*\);\s*\}/.test(parseFile("lib/assetListView.js").source),
        true
    );
    check(
        "  a planted list counting the assets it read itself fails it",
        countingOf(parseSource("const assets = await getAssetsByRecordIds(ids);\nconst kept = null;\nconst rows = summarizeAssetCategories(shownCategories, assets);\n", "<planted-count>")),
        "assets | kept from -"
    );
    check("  and it reads no asset of its own", callsOf(page, "getAssetsByRecordIds").length + callsOf(page, "getAssetsByCategory").length, 0);

    const assets = parseFile(ASSETS);
    check("lib/airtable/assets.js makes the memory once, when it loads", topLevelCalls(assets, "createAssetStatusMemory").join(",") + ` ${callsOf(assets, "createAssetStatusMemory").length}`, "statusMemory 1");
    const plantedPerCall = parseSource(
        "export async function getAssetStatuses(ids) {\n    const statusMemory = createAssetStatusMemory({});\n    return statusMemory(ids);\n}\n",
        "<planted-memory>"
    );
    check("  a planted reader making one per call fails it", `${topLevelCalls(plantedPerCall, "createAssetStatusMemory").join(",") || "-"} ${callsOf(plantedPerCall, "createAssetStatusMemory").length}`, "- 1");
    check(
        // What it answers leaves a deleted asset out since #582 (`offline/asset-deleted.mjs`).
        "  and the reader answers through it",
        /export async function getAssetStatuses\(recordIds\) \{\s*const kept = await statusMemory\(recordIds\);\s*return new Map\(\[\.\.\.kept\]\.filter\(\(\[, facts\]\) => isShownAsset\(facts\)\)\);\s*\}/.test(assets.source),
        true
    );
    const reads = memoryReadsOf(assets);
    check(
        "the memory reads an asset by id for its Status and its Asset ID alone, a hundred to a query",
        reads.byIds,
        "async (recordIds) => (await findByRecordIds(TABLES.ASSETS, recordIds, { fields: KEPT_FIELDS, perQuery: 100 })).map(recordToStatus)"
    );
    check(
        "  and asks which of the two were modified, or whose latest event happened, since a moment, reading the three alone",
        reads.changed,
        "async (moment) => ( await base(TABLES.ASSETS) .select({ filterByFormula: changedSince(MODIFIED_FIELDS, moment, { momentsAfter: [LAST_EVENT_AT_FIELD] }), fields: KEPT_FIELDS }) .all() ).map(recordToStatus)"
    );
    check(
        "  the fields being Status and Asset ID (#541), and Last Event At (#540)",
        [
            /const STATUS_FIELD = "Status";/.test(assets.source),
            /const ASSET_ID_FIELD = "Asset ID";/.test(assets.source),
            /const MODIFIED_FIELDS = \[STATUS_FIELD, ASSET_ID_FIELD\];/.test(assets.source),
            /const LAST_EVENT_AT_FIELD = "Last Event At";/.test(assets.source),
            /const KEPT_FIELDS = \[\.\.\.MODIFIED_FIELDS, LAST_EVENT_AT_FIELD\];/.test(assets.source),
        ].join(" "),
        "true true true true true"
    );
    check(
        "  and each answer the record's id, its Status, its Asset ID and its Last Event At",
        /function recordToStatus\(record\) \{\s*return \{\s*id: record\.id,\s*status: record\.get\(STATUS_FIELD\),\s*assetId: record\.get\(ASSET_ID_FIELD\),\s*lastEventAt: record\.get\(LAST_EVENT_AT_FIELD\) \?\? null,\s*\};\s*\}/.test(assets.source),
        true
    );

    const client = parseFile(CLIENT);
    check(
        "findByRecordIds takes a hundred ids to a query at most, Airtable's page",
        [
            /const PAGE_ROWS = 100;/.test(client.source),
            /if \(!Number\.isInteger\(perQuery\) \|\| perQuery < 1 \|\| perQuery > PAGE_ROWS\) \{\s*throw new Error/.test(client.source),
            /const chunks = chunked\(ids, perQuery\);/.test(client.source),
        ].join(" "),
        "true true true"
    );
    check("  and fifty unless asked", /export async function findByRecordIds\(tableName, ids, \{ fields, perQuery = BATCH_CHUNK, pace \} = \{\}\)/.test(client.source) && /const BATCH_CHUNK = 50;/.test(client.source), true);

    const memoryFile = parseFile(MEMORY);
    check("the memory imports nothing, so this tier loads it as it is", memoryFile.ast.body.filter((s) => s.type === "ImportDeclaration").length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

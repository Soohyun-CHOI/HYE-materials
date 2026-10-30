// A deleted asset is shown nowhere (#582): one judgment hides it, every read of `Assets` asks it, and
// nothing counts one.
//
// WHY ONE JUDGMENT AND NOT ONE PER SCREEN. The office deletes an item by giving it the status
// `Deleted`, and its row stays so that its printed number stays taken (`lib/ids.js` mints the day's
// highest plus one). So every read of the table meets it, and a screen that forgot to leave it out
// would draw an item the app says never existed. `lib/airtable/assets.js` is the one module that
// reads the table for a screen, and each of its readers asks `isShownAsset` (`lib/assetStatus.js`)
// of what it read; this check holds every reader there to it, holds that nothing else in `app/` or
// `lib/` reads the table but the mint — which must count a deleted row — and holds the two counts
// that come off link arrays rather than off a read: the category list's rows and a catalog row's
// items (`itemCountOf`, over the `Asset Statuses` rollup).
//
// BY VALUE where the rule is pure: `categoryListRows`, `assetStatusesOf`, `itemCountOf` and the
// catalog's rows. OFF THE SOURCE where it is credentialed: the readers, the mint, the removal's
// guard, a kind's page and the asset's page. Source order is not execution order (`_ast.mjs`), and a
// browser is where a deleted item was seen to be gone (`docs/notes/tools.md`).
//
// WHAT IT CANNOT SEE: a read made by a script outside `app/` and `lib/`, which no screen draws, and
// Airtable's own computation of the rollup, which a credentialed read of a row showed.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { isShownAsset } from "../../../lib/assetStatus.js";
import { categoryListRows } from "../../../lib/assetListView.js";
import { assetStatusesOf, itemCountOf } from "../../../lib/assetCategory.js";
import { catalogRows } from "../../../lib/assetCatalog.js";
import { listJsFiles, parseFile, parseSource, repoPath, resolveFunction, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A deleted asset is shown nowhere: one judgment, every read, every count (#582)";

const ASSETS = "lib/airtable/assets.js";
const IDS = "lib/ids.js";
const LOG = "lib/airtable/assetLog.js";
const CATEGORIES = "lib/airtable/assetCategories.js";
const KIND_PAGE = "app/(assets)/asset-categories/[categoryRecordId]/page.js";
const ASSET_PAGE = "app/(assets)/assets/[assetId]/page.js";

/**
 * The calls in a reader that bring rows of `Assets` back from the base — a query, a batched read, a
 * child walk, or the status memory, which is handed one of the first two.
 */
const READS = ["select", "findByRecordIds", "findByFieldValues", "findChildRecords", "getLinkedRecords", "statusMemory"];

/** The writers in the same module, which hand back the row they wrote and read none for a screen. */
const WRITERS = {
    createAssets: "a registration's own rows, In stock as written",
    updateAssetCache: "the row an event just wrote, its caller's own",
    updateAssetJob: "the row the office's job change just wrote",
    updateAssetNote: "the row a note was just written on",
};

/** Each exported function of a module, by name, with what its body reads and whether it asks the judgment. */
function exportedFunctions({ ast, source }) {
    const found = [];
    for (const node of ast.body) {
        const fn = node.type === "ExportNamedDeclaration" ? node.declaration : null;
        if (fn?.type !== "FunctionDeclaration") continue;
        const reads = [];
        walk(fn.body, (n) => {
            if (n.type !== "CallExpression") return;
            const callee = n.callee?.type === "MemberExpression" ? n.callee.property?.name : n.callee?.name;
            if (READS.includes(callee)) reads.push(callee);
        });
        found.push({ name: fn.id.name, reads: [...new Set(reads)], asks: /\bisShownAsset\b/.test(source.slice(fn.start, fn.end)) });
    }
    return found;
}

/** The repo-relative files under `app/` and `lib/` naming `TABLES.ASSETS`, with how many times. */
function tableReaders(files) {
    const out = [];
    for (const rel of files) {
        const { ast } = rel.parsed;
        let n = 0;
        walk(ast, (node) => {
            if (node.type === "MemberExpression" && node.object?.name === "TABLES" && node.property?.name === "ASSETS") n++;
        });
        if (n > 0) out.push(`${rel.path}:${n}`);
    }
    return out.sort();
}

export function run({ check, assert, log }) {
    // ── the readers ─────────────────────────────────────────────────────────
    log("every reader of Assets asks isShownAsset of what it read:");
    const assets = parseFile(ASSETS);
    const fns = exportedFunctions(assets);
    const readers = fns.filter((f) => f.reads.length > 0 && !(f.name in WRITERS));
    check(
        "the readers, found by what they call",
        readers.map((f) => f.name).sort().join(", "),
        "getAssetByAssetId, getAssetStatuses, getAssetsByAssetIds, getAssetsByCategory, getAssetsByRecordIds"
    );
    check("  each asking the judgment", readers.filter((f) => !f.asks).map((f) => f.name).join(", "), "");
    check(
        "  and every other export a writer named here, with why it needs no judgment",
        fns.filter((f) => f.reads.length === 0 || f.name in WRITERS).map((f) => f.name).filter((name) => !(name in WRITERS)).join(", "),
        ""
    );
    check("  each writer still in the module", Object.keys(WRITERS).filter((name) => !fns.some((f) => f.name === name)).join(", "), "");
    assert(
        "a deleted asset by its printed id is null, as a code nothing carries",
        /const asset = recordToAsset\(records\[0\]\);\s*return isShownAsset\(asset\) \? asset : null;/.test(assets.source)
    );
    assert(
        "  the batched readers filter what they map",
        ["findByRecordIds(TABLES.ASSETS, recordIds, { perQuery: 100, pace })).map(recordToAsset).filter(isShownAsset)", "return records.map(recordToAsset).filter(isShownAsset);"].every((text) => assets.source.includes(text)) &&
            (assets.source.match(/\.map\(recordToAsset\)\.filter\(isShownAsset\)/g) ?? []).length === 3
    );
    assert(
        "  and the status memory's answer leaves one out, the memory keeping its status",
        /const kept = await statusMemory\(recordIds\);\s*return new Map\(\[\.\.\.kept\]\.filter\(\(\[, facts\]\) => isShownAsset\(facts\)\)\);/.test(assets.source)
    );

    // ── nothing else reads the table for a screen ───────────────────────────
    log("");
    log("nothing else in app/ or lib/ reads Assets, and the mint counts a deleted row:");
    const files = [...listJsFiles(repoPath("app")), ...listJsFiles(repoPath("lib"))].map((abs) => {
        const path = toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
        return { path, parsed: parseFile(path) };
    });
    check(
        "the files naming the table: the readers' module, the mint, and the log's child ids",
        tableReaders(files).map((entry) => entry.replace(/:\d+$/, "")).join(", "),
        [ASSETS, LOG, IDS].sort().join(", ")
    );
    const logSource = parseFile(LOG).source;
    // A history read with no link array in hand walks to its rows through the asset's own, and hands
    // back the rows: no asset leaves that module.
    check(
        "  the log naming it only as the parent of the ids it mints and of the history it walks",
        (logSource.match(/TABLES\.ASSETS\b/g) ?? []).length,
        (logSource.match(/parentTableName: TABLES\.ASSETS,/g) ?? []).length + (logSource.match(/getLinkedRecords\(TABLES\.ASSETS, assetRecordId, "Asset Log", TABLES\.ASSET_LOG\)/g) ?? []).length
    );
    check("  which is three", (logSource.match(/TABLES\.ASSETS\b/g) ?? []).length, 3);
    const ids = parseFile(IDS);
    const mint = resolveFunction(ids.ast, "generateNextAssetIds");
    const mintSource = mint ? ids.source.slice(mint.start, mint.end) : "";
    assert("  generateNextAssetIds was found", mintSource !== "");
    check(
        "  the mint counting every row of the day, a deleted one's among them, so its number is never minted again",
        `${/return mintDailyIds\(TABLES\.ASSETS, ID_KINDS\.ASSET, count, createFn\);/.test(mintSource)} ${/isShownAsset|shownIn|Deleted|DELETED/.test(ids.source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""))}`,
        "true false"
    );

    // ── the category list's rows ────────────────────────────────────────────
    log("");
    log("the category list's rows count what the reads hand back (categoryListRows):");
    const kinds = [
        { id: "recDrill", itemName: "Drill", assets: ["a1", "a2"] },
        { id: "recSaw", itemName: "Saw", assets: ["a3"] },
        { id: "recLevel", itemName: "Level", assets: ["a4", "a5"] },
    ];
    const scope = { shown: new Set(["a1", "a2", "a3", "a4", "a5"]), onJob: new Map(["a1", "a2", "a3", "a4", "a5"].map((id) => [id, "recJob"])) };
    // `a2` and `a3` were deleted: the status memory's answer leaves them out (`getAssetStatuses`).
    const kept = new Map([
        ["a1", { status: "In stock", assetId: "HYE-AST-261030-001", lastEventAt: null }],
        ["a4", { status: "Retired", assetId: "HYE-AST-261030-004", lastEventAt: null }],
        ["a5", { status: "Out", assetId: "HYE-AST-261030-005", lastEventAt: null }],
    ]);
    const rows = categoryListRows(kinds, scope, kept);
    check("a kind whose only item was deleted is no row", rows.map((row) => row.itemName).join(", "), "Drill, Level");
    check(
        "  a kind with one left counts that one",
        (rows.find((row) => row.itemName === "Drill")?.counts ?? []).map((c) => `${c.status} ${c.count}`).join(", "),
        "In stock 1, Out 0, In repair 0, Retired 0"
    );
    check("  and its printed ids are the one left's", JSON.stringify(rows.find((row) => row.itemName === "Drill")?.assetIds ?? null), '{"recJob":{"In stock":["HYE-AST-261030-001"]}}');
    check("  no row draws a Deleted column", rows.every((row) => row.counts.every((c) => c.status !== "Deleted")), true);
    check(
        "  and with nothing deleted every kind stands, as before",
        categoryListRows(kinds, scope, new Map([...kept, ["a2", { status: "Out" }], ["a3", { status: "In stock" }]])).map((row) => row.itemName).join(", "),
        "Drill, Level, Saw"
    );

    // THE COLUMNS ARE THE STATUSES A SCREEN SHOWS, BY THAT NAME. The list's heads, its export's
    // columns and the summary's counts each iterate `SHOWN_STATUS_VALUES`; one that took the whole
    // vocabulary — under its own name or under this one — would draw a `Deleted` column.
    const columnModules = ["app/(assets)/asset-categories/AssetCategoryList.js", "lib/assetListExport.js", "lib/assetListView.js"];
    check(
        "  the list, its export and the summary import the statuses a screen draws, by their own name and no other",
        columnModules
            .map((path) => {
                const imported = parseFile(path)
                    .ast.body.filter((n) => n.type === "ImportDeclaration" && /assetStatus(\.js)?$/.test(n.source.value))
                    .flatMap((n) => n.specifiers.map((sp) => `${sp.imported?.name}${sp.local.name !== sp.imported?.name ? ` as ${sp.local.name}` : ""}`));
                return `${path}: ${imported.filter((name) => /STATUS_VALUES/.test(name)).join(",")}`;
            })
            .join(" | "),
        columnModules.map((path) => `${path}: SHOWN_STATUS_VALUES`).join(" | ")
    );

    // ── a catalog row's items ───────────────────────────────────────────────
    log("");
    log("how many items stand under a catalog row (itemCountOf, over the Asset Statuses rollup):");
    check("the rollup splits back into its statuses", JSON.stringify(assetStatusesOf("In stock,Deleted,In repair")), '["In stock","Deleted","In repair"]');
    check("  none for a row with none, empty or absent", `${assetStatusesOf("").length} ${assetStatusesOf(undefined).length} ${assetStatusesOf(null).length}`, "0 0 0");
    check("the link less what the app does not show", itemCountOf({ assets: ["a", "b", "c"], assetStatuses: ["In stock", "Deleted", "Retired"] }), 2);
    check("  every item deleted is none", itemCountOf({ assets: ["a", "b"], assetStatuses: ["Deleted", "Deleted"] }), 0);
    check("  a rollup behind the link counts the newest item anyway", itemCountOf({ assets: ["a", "b", "c"], assetStatuses: ["In stock", "Out"] }), 3);
    check("  and a row read with no rollup counts its link", itemCountOf({ assets: ["a", "b"] }), 2);
    check("  never below none", itemCountOf({ assets: [], assetStatuses: ["Deleted"] }), 0);
    let threw = false;
    try {
        itemCountOf({ assets: ["a"], assetStatuses: ["Lost"] });
    } catch {
        threw = true;
    }
    check("  a status outside the vocabulary throws, the judgment's own refusal", threw, true);
    check(
        "the catalog's Items is that count",
        catalogRows([{ id: "recRow", itemName: "Drill", assets: ["a", "b", "c"], assetStatuses: ["Deleted", "Out", "Retired"] }])[0].assetCount,
        2
    );
    const removal = parseFile(CATEGORIES);
    const removeFn = resolveFunction(removal.ast, "removeAssetCategory");
    const removeSource = removeFn ? removal.source.slice(removeFn.start, removeFn.end) : "";
    assert("  and a row is taken out only when it counts none", /if \(itemCountOf\(row\) > 0\) return \{ hasItems: row \};/.test(removeSource) && !/row\.assets\.length/.test(removeSource));
    assert(
        "  the rollup read with every row, by the module's name for it",
        /assetStatuses: assetStatusesOf\(record\.get\(ASSET_STATUSES_FIELD\)\),/.test(removal.source)
    );
    const kindPage = parseFile(KIND_PAGE).source;
    assert(
        "a kind's page reads as empty when every item of the kind was deleted",
        /if \(page\.total === 0 && itemCountOf\(category\) > 0\) \{/.test(kindPage) && !/category\.assets\.length/.test(kindPage)
    );
    const assetPage = parseFile(ASSET_PAGE).source;
    assert(
        "the asset's page answers a deleted item's address as a code no asset carries",
        /const asset = await getAssetByAssetId\(asked\);\s*if \(!asset\) return <AssetNotFound asked=\{asked\} account=\{account\} \/>;/.test(assetPage)
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the readers can fail:");
    const planted = exportedFunctions(
        parseSource(
            "export async function getAssetsByJob(ids) { return (await findByRecordIds(TABLES.ASSETS, ids)).map(recordToAsset); }\n" +
                "export function describeAsset(asset) { return asset.assetId; }\n",
            "<planted-readers>"
        )
    );
    check("  a planted reader that does not ask is seen as a reader that does not ask", planted.filter((f) => f.reads.length > 0 && !f.asks).map((f) => f.name).join(), "getAssetsByJob");
    check("  and a planted export that reads nothing is no reader", planted.filter((f) => f.reads.length === 0).map((f) => f.name).join(), "describeAsset");
    check(
        "  a planted page reading the table is found",
        tableReaders([{ path: "app/planted/page.js", parsed: parseSource('import { base, TABLES } from "@/lib/airtable/client";\nexport default async function P() { await base(TABLES.ASSETS).select().all(); }\n', "<planted-page>") }]).join(),
        "app/planted/page.js:1"
    );
    check("  and isShownAsset is seen to say no", isShownAsset({ status: "Deleted" }), false);
}

if (isMain(import.meta.url)) standalone(title, run);

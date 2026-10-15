// The catalog the office keeps on a page of its own (#527): what a row says, how the band narrows
// the rows, who reaches the page, and who is offered the way to it.
//
// WHAT THIS HOLDS. `lib/assetCatalog.js` by value — every row of the table listed in 1l's order,
// what each says and nothing of its items, the values the band offers beyond what its rows hold,
// the toggle narrowing before anything else is asked, the name typed in full first, and the words.
// And off the source: the page asks `requireAdmin` before it reads anything and draws the
// catalog only for the office; the category list's head draws `Catalog` under the same gate's
// answer, in both of its heads; the groups' reader reads and spells no field; and the toggle is
// one control that is on or off.
//
// WHY THE OFFICE'S GATE IS ASKED THROUGH `requireAdmin` AND READ NOWHERE ON THE AXIS. Every asset
// screen's controls are a site manager's (#506), and `offline/site-manager.mjs` fails a read of
// the office's flag anywhere on the axis but the one #509 admits; the catalog is the office's, so
// its page and its opener ask the app's own Admin gate, which reads the flag in `lib/authz.js`,
// and the axis still reads it once. That check is what fails a page asking the flag itself.
//
// WHAT A PASS DOES NOT PROVE. That the page refuses in a browser, or that a column draws at its
// width — both were seen and are recorded in the pull request. Source shape is not execution: a
// gate inside a branch that never runs would read the same here.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_CATALOG_COPY, catalogOffers, catalogRows, filterCatalogRows } from "../../../lib/assetCatalog.js";
import { callsTo, parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { conditionsOf } from "./site-manager.mjs";

export const title = "The catalog the office keeps on a page of its own (#527)";

const PAGE = "app/(assets)/asset-catalog/page.js";
const LIST = "app/(assets)/asset-catalog/CatalogList.js";
const CATEGORY_LIST_PAGE = "app/(assets)/asset-categories/page.js";
const CATEGORY_LIST = "app/(assets)/asset-categories/AssetCategoryList.js";
const GROUPS_READER = "lib/airtable/assetCategoryGroups.js";
const CONTROLS = "app/components/Controls.js";

/** A row as `recordToAssetCategory` returns it, with `n` items standing under it. */
const category = (id, [level1, level2, level3, size, maker, partNumber], assetClass, n = 0, discontinued = false) => ({
    id,
    itemName: [level3, size].filter(Boolean).join(" ") + (maker ? `, ${maker}` : "") + (partNumber ? ` (${partNumber})` : ""),
    assets: Array.from({ length: n }, (_, i) => `recAsset${id}${i}`),
    level1,
    level2,
    level3,
    size,
    maker,
    partNumber,
    assetClass,
    discontinued,
});

/**
 * A catalog as the office keeps it: three batteries of one name, two band saws in two places, a
 * discontinued cutting machine, two ratchet sizes a word sort would put the wrong way round, a row
 * typed without a type, and a saw blade whose name begins with what the search below types.
 */
const CATEGORIES = [
    category("bat18", ["Tool", "Power Tool", "Battery", "M18", "Milwaukee", ""], "A"),
    category("rat10", ["Tool", "Wrench", "Flexible Ratchet", "10 mm", "", ""], "B", 2),
    category("bat1", ["Tool", "Power Tool", "Battery", "", "DeWalt", ""], "A", 1),
    category("cut", ["Equipment", "Cutting Equipment", "Cutting Machine", "", "AXXAIR", "172"], "A", 0, true),
    category("band", ["Tool", "Power Tool", "Band Saw", "", "Makita", "2107FW"], "B", 2),
    category("rat9", ["Tool", "Wrench", "Flexible Ratchet", "9 mm", "", ""], "B"),
    category("blade", ["Tool", "Power Tool", "Saw Blade", '7-1/4"', "", ""], "B"),
    category("bandEq", ["Equipment", "Cutting Equipment", "Band Saw", "", "", ""], "A"),
    category("bat12", ["Tool", "Power Tool", "Battery", "M12", "Milwaukee", ""], "A", 10),
    category("broken", ["", "Machining", "Bench Grinder", '8"', "", ""], ""),
];

/** The groups: four standing, `Lift Equipment` with nothing filed under it, and two that are no group. */
const GROUPS = [
    { level1: "Tool", level2: "Power Tool" },
    { level1: "Tool", level2: "Wrench" },
    { level1: "Equipment", level2: "Cutting Equipment" },
    { level1: "Equipment", level2: "Lift Equipment" },
    { level1: "Tool", level2: "power tool " },
    { level1: "", level2: "Pressure" },
];

const ids = (rows) => rows.map((row) => row.id).join(",");
const offered = (facet) => facet.map(({ value, count }) => `${value} ${count}`).join(", ");

/**
 * The page's gate as its source states it: how many times it asks `requireAdmin`, whether a
 * refusal returns before anything is read, whether the reads and the list come after that return,
 * and whether the refusal draws the page's own sentence.
 */
export function gateShape({ ast }) {
    const gates = callsTo(ast, "requireAdmin");
    let refusal = null;
    walk(ast, (n) => {
        if (
            n.type === "IfStatement" &&
            n.test?.type === "UnaryExpression" &&
            n.test.operator === "!" &&
            n.test.argument?.type === "Identifier" &&
            n.test.argument.name === "authorized"
        )
            refusal ??= n;
    });
    const returns = [];
    walk(refusal?.consequent ?? {}, (n) => n.type === "ReturnStatement" && returns.push(n));
    let saysWhy = false;
    walk(refusal?.consequent ?? {}, (n) => {
        if (n.type === "MemberExpression" && n.object?.name === "COPY" && n.property?.name === "noAccess") saysWhy = true;
    });
    const after = (node) => Boolean(refusal) && Boolean(node) && node.start > refusal.end;
    const reads = ["getAllAssetCategories", "getAllAssetCategoryGroups"].map((name) => callsTo(ast, name)[0]);
    let list = null;
    walk(ast, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "CatalogList") list ??= n;
    });
    return [
        `asked ${gates.length}`,
        `refused ${Boolean(refusal) && returns.length > 0 && after(gates[0]) === false && gates[0]?.start < refusal.start}`,
        `reads after ${reads.every(after)}`,
        `list after ${after(list)}`,
        `says why ${saysWhy}`,
    ].join(", ");
}

/** What the category list's page binds the gate's answer to, as `name`, or `none`. */
function officeBinding({ ast }) {
    let bound = "none";
    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator" || n.id?.type !== "ObjectPattern") return;
        const init = n.init?.type === "AwaitExpression" ? n.init.argument : n.init;
        if (init?.type !== "CallExpression" || init.callee?.name !== "requireAdmin") return;
        const prop = n.id.properties.find((p) => p.key?.name === "authorized");
        if (prop) bound = prop.value?.name ?? "authorized";
    });
    return bound;
}

/** How many times a file draws `{name}` as an element's child — a prop handed it is not one. */
function drawn({ ast }, name) {
    let count = 0;
    walk(ast, (n) => {
        if (n.type !== "JSXElement" && n.type !== "JSXFragment") return;
        for (const child of n.children) if (child.type === "JSXExpressionContainer" && child.expression?.type === "Identifier" && child.expression.name === name) count++;
    });
    return count;
}

export function run({ check, assert, log }) {
    // ── 1: the rows ──────────────────────────────────────────────────────────
    log("every row of the catalog, in 1l's order, saying what the page shows and nothing of its items:");
    const rows = catalogRows(CATEGORIES);
    check(
        "by name, then size, maker and part number, a run of digits read as a number",
        ids(rows),
        "bandEq,band,bat1,bat12,bat18,broken,cut,rat9,rat10,blade"
    );
    check(
        "  each saying its path, its class, its mark and its count, and none of its items",
        Object.keys(rows[0]).join(", "),
        "id, itemName, level1, level2, level3, size, maker, partNumber, assetClass, discontinued, assetCount"
    );
    check("  every item under a row counted", rows.find((row) => row.id === "bat12")?.assetCount, 10);
    check("  a row typed without a type is listed like any other", rows.find((row) => row.id === "broken")?.level3, "Bench Grinder");
    check(
        "  and only the box's own `true` marks one discontinued",
        catalogRows([category("x", ["Tool", "A", "B", "", "", ""], "A", 0, true), { ...category("y", ["Tool", "A", "C", "", "", ""], "A"), discontinued: "true" }])
            .map((row) => `${row.id} ${row.discontinued}`)
            .join(", "),
        "x true, y false"
    );
    check("  and no catalog lists nothing", catalogRows(undefined).length, 0);

    // ── 2: what the band offers ─────────────────────────────────────────────
    log("");
    log("what the band offers beyond the values its rows hold:");
    check(
        "both types, every standing group, both classes — a group set aside offers nothing",
        catalogOffers(GROUPS)
            .map((offer) => Object.values(offer).join("/"))
            .join(", "),
        "Equipment, Tool, Tool/Power Tool, Tool/Wrench, Equipment/Cutting Equipment, Equipment/Lift Equipment, A, B"
    );

    // ── 3: the band ─────────────────────────────────────────────────────────
    log("");
    log("the band narrows the rows as the category list's does, with the toggle and the name typed in full first:");
    const whole = filterCatalogRows(rows, GROUPS, {});
    check("unnarrowed, every row, and `M` every row", `${ids(whole.rows)} | ${whole.narrowed} | ${whole.total}`, `${ids(rows)} | false | 10`);
    check("  both types offered, counted", offered(whole.facets.level1), "Equipment 2, Tool 7");
    check(
        "  every category, one nothing is filed under at a count of none",
        offered(whole.facets.level2),
        "Cutting Equipment 2, Lift Equipment 0, Machining 1, Power Tool 5, Wrench 2"
    );
    check("  both classes", offered(whole.facets.assetClass), "A 5, B 4");
    const marked = filterCatalogRows(rows, GROUPS, { discontinued: true });
    check(
        "the toggle leaves the discontinued rows, narrows, and holds itself",
        `${ids(marked.rows)} | ${marked.narrowed} | ${marked.held.discontinued} | ${marked.total}`,
        "cut | true | true | 10"
    );
    check("  and every count a chip gives is a count of those", offered(marked.facets.level1), "Equipment 1, Tool 0");
    const underType = filterCatalogRows(rows, GROUPS, { level1: ["Equipment"] });
    check("a type chosen offers its own categories alone, its empty one among them", offered(underType.facets.level2), "Cutting Equipment 2, Lift Equipment 0");
    check(
        "a search over the whole name, the category and the type, the name typed in full first",
        ids(filterCatalogRows(rows, GROUPS, { q: "saw" }).rows),
        "blade,bandEq,band"
    );
    check("  every word typed found somewhere on the row", ids(filterCatalogRows(rows, GROUPS, { q: "battery milwaukee" }).rows), "bat12,bat18");
    check("  and a name typed whole keeps the list's order among its rows", ids(filterCatalogRows(rows, GROUPS, { q: "battery" }).rows), "bat1,bat12,bat18");
    check(
        "a band that leaves no row is narrowed, and says so",
        `${filterCatalogRows(rows, GROUPS, { q: "zzz", discontinued: true }).rows.length} ${filterCatalogRows(rows, GROUPS, { q: "zzz" }).narrowed}`,
        "0 true"
    );

    // ── 4: the words ────────────────────────────────────────────────────────
    log("");
    log("every word the page says, by value:");
    check(
        "the page's own",
        JSON.stringify([
            ASSET_CATALOG_COPY.heading,
            ASSET_CATALOG_COPY.searchLabel,
            ASSET_CATALOG_COPY.discontinued,
            ASSET_CATALOG_COPY.discontinuedOnly,
            ASSET_CATALOG_COPY.clearDiscontinued,
            ASSET_CATALOG_COPY.noneMatch,
            ASSET_CATALOG_COPY.noAccess,
        ]),
        JSON.stringify([
            "Catalog",
            "Search catalog",
            "Discontinued",
            "Discontinued only",
            "Clear discontinued filter",
            "Nothing in the catalog matches",
            "You don't have access to this page. Keeping the catalog is for Admins.",
        ])
    );
    check(
        "  and the columns, in 1l's order, the catalog's words for its levels",
        Object.values(ASSET_CATALOG_COPY.columns).join(", "),
        "Name, Size, Maker, Part #, Category, Type, Class, Items"
    );

    // ── 5: who reaches it, and who is offered the way ───────────────────────
    log("");
    log("the office reaches the page, through the app's Admin gate, and is the one offered the way to it:");
    const page = parseFile(PAGE);
    check(
        "the page asks requireAdmin once and refuses before it reads, saying why",
        gateShape(page),
        "asked 1, refused true, reads after true, list after true, says why true"
    );
    // ANTI-VACUITY: a page reading before its gate, and one never refusing, are each seen.
    check(
        "  a page that reads before it refuses is seen",
        gateShape(
            parseSource(
                "async function r() { const c = await getAllAssetCategories(); const { authorized } = await requireAdmin(); if (!authorized) { return <p>{COPY.noAccess}</p>; } const g = await getAllAssetCategoryGroups(); return <CatalogList rows={c} />; }",
                "<planted-early-read>"
            )
        ),
        "asked 1, refused true, reads after false, list after true, says why true"
    );
    check(
        "  and one that never refuses",
        gateShape(parseSource("async function r() { const { authorized } = await requireAdmin(); return <CatalogList />; }", "<planted-no-refusal>")),
        "asked 1, refused false, reads after false, list after false, says why false"
    );
    const categoryPage = parseFile(CATEGORY_LIST_PAGE);
    check("the category list binds the gate's answer for the office", officeBinding(categoryPage), "office");
    check(
        "  draws `Catalog` under it, and under nothing else",
        conditionsOf(categoryPage.ast, { element: "ButtonLink" })
            .map((under) => under.join(" & "))
            .join(" | "),
        "office"
    );
    // A KEY, AS THE REGISTRATION'S OPENER HAS ONE: the page hands both to the list, a client
    // component, where each stands among the head's children and React warned on every load
    // for the opener that had none.
    check(
        "  to the catalog, in the catalog's word, keyed as the opener beside it is",
        `${/<ButtonLink key="catalog" variant="bordered" href=\{ASSET_CATALOG_PATH\}>\s*\{ASSET_CATALOG_COPY\.heading\}\s*<\/ButtonLink>/.test(categoryPage.source)} ${/<RegistrationDialog key="registration" \{\.\.\.registration\} \/>/.test(categoryPage.source)}`,
        "true true"
    );
    check(
        "  in both of its heads: the empty one, and the list's, handed it",
        `${drawn(categoryPage, "catalog")} ${/catalog=\{catalog\}/.test(categoryPage.source)} ${drawn(parseFile(CATEGORY_LIST), "catalog")}`,
        "1 true 1"
    );
    check(
        "  and an opener drawn for everybody is seen",
        conditionsOf(parseSource("function P() { return <div><ButtonLink href={x}>y</ButtonLink></div>; }", "<planted-open>").ast, { element: "ButtonLink" })
            .map((under) => under.join(" & ") || "OPEN")
            .join(" | "),
        "OPEN"
    );
    assert("the list on the page reads its band through the category list's reader", /readAssetListFilters\(params\)/.test(parseFile(LIST).source));

    // ── 6: the groups' reader ────────────────────────────────────────────────
    log("");
    log("the groups' reader reads, and spells no field:");
    const reader = parseFile(GROUPS_READER);
    const exported = [];
    walk(reader.ast, (n) => {
        if (n.type === "ExportNamedDeclaration" && n.declaration?.id) exported.push(n.declaration.id.name);
    });
    check("its one export", exported.join(", "), "getAllAssetCategoryGroups");
    const uses = [];
    walk(reader.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.object?.callee?.name === "base")
            uses.push(`${reader.source.slice(n.callee.object.arguments[0].start, n.callee.object.arguments[0].end)}.${n.callee.property.name}`);
    });
    check("  a select of the table", uses.join(", "), "TABLES.ASSET_CATEGORY_GROUPS.select");
    check("  taking each level's field from the catalog's names", /record\.get\(ASSET_CATEGORY_FIELDS\[level\]\)/.test(reader.source) && !/"Level [12]"/.test(reader.source), true);

    // ── 7: the toggle ───────────────────────────────────────────────────────
    log("");
    log("`Discontinued only` is one control that is on or off:");
    const controls = parseFile(CONTROLS).source;
    const toggle = controls.slice(controls.indexOf("export function ToggleChip"), controls.indexOf("\n}\n", controls.indexOf("export function ToggleChip")));
    check(
        "a toggle button in both looks, turned either way by one press, with a × that hands focus back",
        [
            /aria-pressed=\{on\}/.test(toggle),
            /onClick=\{\(\) => onChange\(!on\)\}/.test(toggle),
            /onChange\(false\);\s*toggleRef\.current\?\.focus\(\);/.test(toggle),
            /aria-label=\{clearLabel\}/.test(toggle),
        ].join(" "),
        "true true true true"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

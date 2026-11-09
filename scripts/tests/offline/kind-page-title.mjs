// A kind's page names the kind in the browser's tab, and naming it reads nothing (#612).
//
// WHY THIS IS A CHECK. From #339 to #612 every kind's page titled its tab alike — `Tool`, then
// `Item` from #519 — because its address carries a record id and the name is the row's, and
// `generateMetadata` reading the row would read it twice: it runs apart from the page, and the
// Airtable SDK deduplicates nothing. Since #612 the tab says the kind's name before the product's,
// as every other page states its own subject, and `Page not found` for an id no row carries. The
// page hands `generateMetadata` the name it read through one slot per request (React's `cache`), so
// the title costs no operation and the page's read stays inside the page's scope. A redirect is
// rendered twice, the second time the title alone, so the title waits only on a page that started in
// its own render, or a signed-out request would never end. This tier holds:
//
//   1. OFF THE SOURCE, THE TITLE'S SHAPE: no static title, a `generateMetadata` that awaits the
//      slot only once the page has started and calls nothing else, the slot a React `cache`, and
//      the layout's template that puts the product's name after it.
//   2. OFF THE SOURCE, THE PAGE: it marks the slot started before its first await, settles it with
//      the row's name, or the not-found's heading, straight after the read and before anything else
//      is drawn, and settles it empty on every way out, so no title waits on a page that left
//      before reading.
//   3. ANTI-VACUITY: the static title the page had until #612, a `generateMetadata` that reads the
//      row itself, and one that waits whatever started, are each seen.
//
// WHAT IT CANNOT SEE: what a tab says, and that Next starts the page before it asks for the title —
// a browser and requests signed in and out, with a bot's user agent among them, showed both.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_LIST_COPY } from "../../../lib/assetListView.js";
import { parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A kind's page names the kind in its tab and reads nothing to do it (#612)";

const KIND_PAGE = "app/(assets)/asset-categories/[categoryRecordId]/page.js";
const LAYOUT = "app/layout.js";

/** Every name a function's body calls, a member call by its property, sorted and unique. */
function calledNames(fn) {
    const names = new Set();
    walk(fn, (n) => {
        if (n.type !== "CallExpression") return;
        const callee = n.callee;
        if (callee.type === "Identifier") names.add(callee.name);
        else if (callee.type === "MemberExpression" && callee.property?.type === "Identifier") names.add(callee.property.name);
    });
    return [...names].sort().join(", ");
}

/** What a kind's page source does about its tab. */
export function titleFacts(ast, source) {
    let staticTitle = false;
    let reactCache = false;
    walk(ast, (n) => {
        if (n.type === "ExportNamedDeclaration" && n.declaration?.type === "VariableDeclaration") {
            if (n.declaration.declarations.some((d) => d.id?.name === "metadata")) staticTitle = true;
        }
        if (n.type === "ImportDeclaration" && n.source.value === "react" && n.specifiers.some((s) => s.imported?.name === "cache")) reactCache = true;
    });
    const meta = resolveFunction(ast, "generateMetadata");
    const metaSource = meta ? source.slice(meta.start, meta.end) : "";
    const render = resolveFunction(ast, "renderCategoryPage");
    const renderSource = render ? source.slice(render.start, render.end) : "";
    const readAt = renderSource.indexOf("getAssetCategoriesByRecordIds([categoryRecordId])");
    const settleAt = renderSource.indexOf("kindTitle().settle(category ? category.itemName : COPY.pageNotFound);");
    // The not-found branch, a block until #617 and a return of 1h's view since.
    const notFoundAt = renderSource.search(/if \(!category\) (\{|return <PageNotFound \/>;)/);
    const defaultExport = ast.body.find((n) => n.type === "ExportDefaultDeclaration")?.declaration;
    const defaultSource = defaultExport ? source.slice(defaultExport.start, defaultExport.end) : "";
    return {
        staticTitle,
        slot: reactCache && /const kindTitle = cache\(\(\) => \{/.test(source) && /return \{ started: false, named, settle \};/.test(source),
        metadata: meta ? `awaits the slot: ${/const slot = kindTitle\(\);[\s\S]*const title = await slot\.named;/.test(metaSource)}, calls: ${calledNames(meta)}` : "none",
        onlyStarted: /if \(!slot\.started\) return \{\};\s*const title = await slot\.named;/.test(metaSource),
        returns: /return title \? \{ title \} : \{\};/.test(metaSource),
        settled: readAt >= 0 && settleAt > readAt && notFoundAt > settleAt,
        startedFirst: /^async function AssetCategoryPage\(props\) \{\s*(\/\/[^\n]*\s*)*const title = kindTitle\(\);\s*title\.started = true;\s*return withOpsLabel\(/.test(defaultSource),
        everyWayOut: /withOpsLabel\("\/asset-categories\/\[categoryRecordId\]", \(\) => renderCategoryPage\(props\)\.finally\(\(\) => title\.settle\(null\)\)\)/.test(defaultSource),
        settles: (source.match(/\.settle\(/g) ?? []).length,
    };
}

export function run({ check, log }) {
    // ── 1: the title's shape ────────────────────────────────────────────────
    log("the tab's title, off the page's source:");
    const page = parseFile(KIND_PAGE);
    const facts = titleFacts(page.ast, page.source);
    check("no static title, the `Item` every kind's tab said until #612", facts.staticTitle, false);
    check("the slot is React's cache, one per render, not started until the page marks it", facts.slot, true);
    check("generateMetadata awaits the slot and calls nothing that reads", facts.metadata, "awaits the slot: true, calls: kindTitle");
    check("  and waits only once the page has started in its render, so the title-alone render answers at once", facts.onlyStarted, true);
    check("  and titles the tab with what was settled, or leaves the product's name", facts.returns, true);
    const layout = parseFile(LAYOUT);
    check("the layout puts the product's name after the page's own title", /template: `%s · \$\{PRODUCT_NAME\}`/.test(layout.source), true);
    check("an id no row carries is titled as its heading says", ASSET_LIST_COPY.pageNotFound, "Page not found");

    // ── 2: the page ─────────────────────────────────────────────────────────
    log("");
    log("the page settles it from its own read:");
    check("marked started before the page's first await", facts.startedFirst, true);
    check("with the row's name, or the not-found's heading, straight after the read and before either is drawn", facts.settled, true);
    check("and empty on every way out, inside the page's scope", facts.everyWayOut, true);
    check("  in those two places alone", facts.settles, 2);

    // ── 3: anti-vacuity ─────────────────────────────────────────────────────
    log("");
    log("the shapes this refuses are seen:");
    const before = parseSource(
        'export const metadata = { title: "Item" };\n' +
            "export default async function AssetCategoryPage(props) {\n" +
            '  return withOpsLabel("/asset-categories/[categoryRecordId]", () => renderCategoryPage(props));\n' +
            "}\n" +
            "async function renderCategoryPage({ params }) {\n" +
            "  const [[category], jobs] = await Promise.all([getAssetCategoriesByRecordIds([categoryRecordId]), getAllJobs()]);\n" +
            "  if (!category) {\n    return null;\n  }\n" +
            "}\n",
        "<planted-before-612>"
    );
    const old = titleFacts(before.ast, before.source);
    check(
        "  #519's page: a static title, no slot, no generateMetadata, nothing started or settled",
        `${old.staticTitle} | ${old.slot} | ${old.metadata} | ${old.startedFirst} | ${old.settled} | ${old.everyWayOut}`,
        "true | false | none | false | false | false"
    );
    const reading = parseSource(
        "export async function generateMetadata({ params }) {\n" +
            "  const { categoryRecordId } = await params;\n" +
            "  const [category] = await getAssetCategoriesByRecordIds([categoryRecordId]);\n" +
            "  return { title: category?.itemName };\n" +
            "}\n",
        "<planted-reading-title>"
    );
    check(
        "  a generateMetadata reading the row itself is seen reading",
        titleFacts(reading.ast, reading.source).metadata,
        "awaits the slot: false, calls: getAssetCategoriesByRecordIds"
    );
    const waiting = parseSource(
        "export async function generateMetadata() {\n" +
            "  const slot = kindTitle();\n" +
            "  const title = await slot.named;\n" +
            "  return title ? { title } : {};\n" +
            "}\n",
        "<planted-waiting-title>"
    );
    const waits = titleFacts(waiting.ast, waiting.source);
    check("  one that waits whatever started is seen waiting", `${waits.metadata} | ${waits.onlyStarted}`, "awaits the slot: true, calls: kindTitle | false");
}

if (isMain(import.meta.url)) standalone(title, run);

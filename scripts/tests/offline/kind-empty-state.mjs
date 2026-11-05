// A kind's page with none of the kind on its job, and an address no kind carries (1d, #612).
//
// WHY THIS IS A CHECK. From #509 to #612 a kind with items on other jobs and none on the one the page
// stands on drew its head alone, and `Nothing added yet` stood for a kind nobody had bought; since
// #612 the first says `No items on 25-USA-13`, Soo's words, and the second keeps its heading, who
// fills it and the opener. Which one a page draws is `lib/assetListView.js:kindEmptyState`, asked of
// what the page already read — how many it read on its scope, and how many the kind holds at all off
// the row in hand — so telling them apart reads nothing. An address no kind carries says `Page not
// found` since #612, where an item's own page keeps `Item not found`. This tier holds:
//
//   1. BY VALUE, THE JUDGMENT AND ITS WORDS: each of the two empties, the page with items, a kind on
//      no job, and every word either draws, with the not-found's two headings.
//   2. OFF THE SOURCE, THE PAGE: it asks the judgment of those three facts, draws the first empty's
//      heading alone and the second's with who fills it and the opener, the first before the second,
//      and the not-found's heading and way back.
//   3. NO READ ADDED: what the page imports from the base is what it imported before #612, and the
//      judgment awaits nothing.
//   4. ANTI-VACUITY: a page in #509's shape is seen drawing neither empty's words.
//
// WHAT IT CANNOT SEE: what a browser draws, and how many operations a view costs — a browser and the
// dev server's ledger measured both.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_LIST_COPY, kindEmptyState } from "../../../lib/assetListView.js";
import { ASSET_COPY } from "../../../lib/assetView.js";
import { parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A kind's page with none on its job says which empty it is, and an unknown kind is a page not found (1d, #612)";

const KIND_PAGE = "app/(assets)/asset-categories/[categoryRecordId]/page.js";
const VIEW = "lib/assetListView.js";

/** The source of the block an `if` whose test reads `test` opens, braces matched, or "". */
function blockAfter(source, test) {
    const at = source.indexOf(`if (${test}) {`);
    if (at < 0) return "";
    let depth = 0;
    for (let i = source.indexOf("{", at); i < source.length; i++) {
        if (source[i] === "{") depth++;
        if (source[i] === "}" && --depth === 0) return source.slice(at, i + 1);
    }
    return "";
}

/** What a kind's page source draws for each empty and for an unknown kind. */
export function emptyFacts(source) {
    const elsewhere = blockAfter(source, "empty?.elsewhere");
    const none = blockAfter(source, "empty");
    const missing = blockAfter(source, "!category");
    return {
        asks: /const empty = kindEmptyState\(\{ total: page\.total, itemCount: itemCountOf\(category\), jobCode: scope\.job\?\.jobCode \?\? null \}\);/.test(source),
        elsewhere: [
            /<h2 className="text-heading font-semibold">\{empty\.heading\}<\/h2>/.test(elsewhere),
            /untilYouAdd|untilASiteManagerAdds|RegistrationDialog|noAssetsHeading/.test(elsewhere),
        ].join(" "),
        none: [
            /<h2 className="text-heading font-semibold">\{empty\.heading\}<\/h2>/.test(none),
            /\{recording\.adds \? COPY\.untilYouAdd : COPY\.untilASiteManagerAdds\}/.test(none),
            /\{recording\.adds && \(\s*<div className="mt-gap-lg">\s*<RegistrationDialog \{\.\.\.registration\} variant="bordered" \/>/.test(none),
        ].join(" "),
        order: elsewhere !== "" && none !== "" && source.indexOf(elsewhere) < source.indexOf(none),
        missing: [/<h1 className="text-heading font-semibold">\{COPY\.pageNotFound\}<\/h1>/.test(missing), /\{COPY\.backToTools\}/.test(missing)].join(" "),
    };
}

/** The names a source imports from the base's modules, sorted. */
function baseReads(ast) {
    const names = [];
    walk(ast, (n) => {
        if (n.type !== "ImportDeclaration" || !String(n.source.value).startsWith("@/lib/airtable/")) return;
        for (const spec of n.specifiers) names.push(spec.imported?.name ?? spec.local.name);
    });
    return names.sort().join(", ");
}

export function run({ check, log }) {
    // ── 1: the judgment and its words ───────────────────────────────────────
    log("which empty a kind's page draws, by value:");
    const said = (facts) => JSON.stringify(kindEmptyState(facts));
    check("a kind with items on the page's job draws no empty", said({ total: 3, itemCount: 5, jobCode: "25-USA-13" }), "null");
    check(
        "a kind with items on other jobs alone draws the job's own empty, named by its code",
        said({ total: 0, itemCount: 4, jobCode: "25-USA-13" }),
        '{"elsewhere":true,"heading":"No items on 25-USA-13"}'
    );
    check("  and with no job to name, on all jobs, the head alone", said({ total: 0, itemCount: 2, jobCode: null }), '{"elsewhere":true,"heading":null}');
    check(
        "a kind nothing stands under anywhere draws Nothing added yet",
        said({ total: 0, itemCount: 0, jobCode: "25-USA-13" }),
        '{"elsewhere":false,"heading":"Nothing added yet"}'
    );
    check("  whatever the page stands on", said({ total: 0, itemCount: 0, jobCode: null }), '{"elsewhere":false,"heading":"Nothing added yet"}');
    check(
        "every word the two empties and the two not-founds say",
        [
            ASSET_LIST_COPY.noItemsOn("25-USA-13"),
            ASSET_LIST_COPY.noAssetsHeading,
            ASSET_LIST_COPY.untilYouAdd,
            ASSET_LIST_COPY.untilASiteManagerAdds,
            ASSET_LIST_COPY.pageNotFound,
            ASSET_COPY.notFoundHeading,
            ASSET_COPY.backToTools,
        ].join(" | "),
        "No items on 25-USA-13 | Nothing added yet | Items show here once you add them. | Items show here once a site manager adds them. | Page not found | Item not found | Back to Equipment & Tools"
    );
    check("  and the list's copy holds no second not-found heading", "notFoundHeading" in ASSET_LIST_COPY, false);

    // ── 2: the page ─────────────────────────────────────────────────────────
    log("");
    log("the kind's page asks the judgment and draws its answer:");
    const page = parseFile(KIND_PAGE);
    const facts = emptyFacts(page.source);
    check("the page asks it of the count it read, the row's count and the job's code", facts.asks, true);
    check("  the job's own empty: its heading, and no sentence, opener or other heading", facts.elsewhere, "true false");
    check("  the other empty: its heading, who fills it, and the bordered opener", facts.none, "true true true");
    check("  the job's own empty is asked first", facts.order, true);
    check("an unknown kind: Page not found and the way back", facts.missing, "true true");

    // ── 3: no read added ────────────────────────────────────────────────────
    log("");
    log("telling the two empties apart reads nothing:");
    check(
        "the page reads the base through what it read before #612",
        baseReads(page.ast),
        "getAllJobs, getAssetCategoriesByRecordIds, getAssetLogEntriesByRecordIds, getAssetsByRecordIds"
    );
    const view = parseFile(VIEW);
    const judgment = resolveFunction(view.ast, "kindEmptyState");
    const judgmentSource = judgment ? view.source.slice(judgment.start, judgment.end) : "";
    check("  and the judgment is found, and awaits and calls nothing that reads", [judgmentSource !== "", /\bawait\b|\bget[A-Z]\w*\(/.test(judgmentSource)].join(" "), "true false");

    // ── 4: anti-vacuity ─────────────────────────────────────────────────────
    log("");
    log("a page in #509's shape is seen drawing neither:");
    const planted = emptyFacts(
        parseSource(
            "async function renderCategoryPage() {\n" +
                "  if (!category) return <h1 className=\"text-heading font-semibold\">{COPY.notFoundHeading}</h1>;\n" +
                "  if (page.total === 0 && itemCountOf(category) > 0) {\n    return <ListFrame top={top} header={header} />;\n  }\n" +
                "  if (page.total === 0) {\n    return <h2 className=\"text-heading font-semibold\">{COPY.noAssetsHeading}</h2>;\n  }\n" +
                "}\n",
            "<planted-509>"
        ).source
    );
    check("  no judgment asked, no empty of either kind, and the old not-found", `${planted.asks} | ${planted.elsewhere} | ${planted.none} | ${planted.missing}`, "false | false false | false false false | false false");
}

if (isMain(import.meta.url)) standalone(title, run);

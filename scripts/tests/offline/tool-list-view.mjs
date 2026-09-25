// What the two tools list screens show (#339).
//
// THREE THINGS LIVE HERE AND THE THIRD IS WIDER THAN THE OTHER TWO.
//
//   THE COUNT PER STATUS IS DERIVED FROM THE VOCABULARY, NOT WRITTEN OUT. A tool's
//   row carries `In Stock`, `Out` and `Retired` whatever the tool items under it
//   are, so a status nobody has designated reads `0` rather than going missing —
//   the app's own distinction between nothing and no measurement. Writing the
//   three out would make a fourth status appear on no screen and fail nothing;
//   asserting the row's keys ARE `TOOL_STATUS_VALUES` is what closes that.
//
//   THE PAGING IS THE FIRST IN THIS APP, so there is no second implementation to
//   compare it against and the assertions have to be properties rather than
//   examples. The one that matters is reassembly: pages 1..N concatenated are the
//   whole list, in order, with nothing dropped and nothing repeated. An off-by-one
//   in the slice or in the page count fails it at exactly one length, which is why
//   it runs over every length around the boundary rather than one. **Since #442 the
//   size and those lengths are literals** — before it every length was derived from
//   the constant, and only a twelve-row fixture held a figure, by the accident of
//   being two pages at ten — and the source is read for the two things no figure
//   shows: that the screen reads and prints one page, and that its page size is its
//   own number rather than the document lists'.
//
//   AND NO TOOLS SCREEN PUTS TEXT IN ITS MARKUP. #338 and #340 both state that
//   arrangement in prose — every string a tools screen renders is in a constant,
//   so a vocabulary sweep and scripts/screen-strings.mjs can reach it — and until
//   this file nothing held it. It is asserted over the whole of app/(tools)/ rather
//   than over the two screens this issue adds, because the rule is the axis's and
//   the next screen is the one that will forget it. `/tools` was in fact carrying
//   one, `<h1>Tools</h1>`, from #336 until this issue moved it into the constant.
//
// WHAT IT CANNOT SEE. Whether any of it reaches a browser, which is this tier's
// standing limit — a page renders no rows in a check. In particular it cannot see
// that the counts are right about the base: `summarizeTools` is exercised on
// literal tool items here, and whether `Out` ever holds a nonzero figure depends
// on a screen that writes a `Checked Out` row, which this app does not have yet.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { TOOL_STATUS, TOOL_STATUS_VALUES } from "../../../lib/toolStatus.js";
import { TOOL_ITEM_COPY } from "../../../lib/toolItemView.js";
import {
    TOOL_LIST_COPY,
    TOOL_PAGE_SIZE,
    pageOfToolItems,
    summarizeTools,
} from "../../../lib/toolListView.js";
import { MAX_LABELS_PER_REQUEST } from "../../../lib/toolLabelSheet.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What the two tools list screens show (#339)";

/** Three tools, one of them with nothing under it, named out of alphabetical order. */
const TOOLS = [
    { id: "recGrinder", toolName: "angle grinder", toolItems: ["i1", "i2", "i3"] },
    { id: "recDriver", toolName: "Impact Driver", toolItems: ["i4"] },
    { id: "recNothing", toolName: "Cordless Drill", toolItems: [] },
];

const ITEMS = [
    { id: "i1", tool: ["recGrinder"], status: TOOL_STATUS.IN_STOCK },
    { id: "i2", tool: ["recGrinder"], status: TOOL_STATUS.OUT },
    { id: "i3", tool: ["recGrinder"], status: TOOL_STATUS.IN_STOCK },
    { id: "i4", tool: ["recDriver"], status: TOOL_STATUS.RETIRED },
];

const rowFor = (rows, toolName) => rows.find((r) => r.toolName === toolName);
const countIn = (row, status) => row.counts.find((c) => c.status === status)?.count;

/** Every string the copy constant holds, builders called with a plausible argument. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(TOOL_LIST_COPY)) {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "function") {
            out.push(value(2), value({ page: 2, pageCount: 3 }));
        }
    }
    return out.filter((s) => typeof s === "string");
}

/**
 * Every `item`/`items` in a string that is not part of `tool item`.
 *
 * The tools track's own rule, the same matcher `offline/tool-item-view.mjs` uses
 * on the other tools constant: one physical tool is a `tool item` and never a bare
 * `item`, because four other tables on this base hold item rows.
 */
function bareItemWords(text) {
    return [...String(text).matchAll(/\b(items?)\b/gi)].filter(
        (m) => !/tool\s$/i.test(String(text).slice(0, m.index))
    );
}

/** The tool's own screen, whose read and print link section 2b reads off the AST. */
const TOOL_SCREEN = "app/(tools)/tools/[toolRecordId]/page.js";

/** `page.ids` for a member read, the bare name for an identifier, else the node's type. */
function nameOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) return `${nameOf(node.object)}.${node.property.name}`;
    return node?.type ?? "none";
}

// ---------------------------------------------------------------------------
// the markup scan
// ---------------------------------------------------------------------------

/** The JSX attributes whose value a reader sees. None is in use on this axis. */
const VISIBLE_ATTRIBUTES = new Set(["placeholder", "title", "alt", "aria-label"]);

/**
 * Every piece of text one file writes straight into its markup.
 *
 * THREE SHAPES, BECAUSE REMOVING ONE LEAVES THE OTHER TWO. Bare JSX text is the
 * obvious one; a string literal in an expression container (`{"Tools"}`) renders
 * identically and is what somebody reaches for when a bare word will not parse;
 * and a visible attribute is copy that never appears between tags at all.
 */
function markupText(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "JSXText" && n.value.trim()) found.push(n.value.trim());
        if (
            n.type === "JSXExpressionContainer" &&
            n.expression?.type === "Literal" &&
            typeof n.expression.value === "string" &&
            n.expression.value.trim()
        )
            found.push(n.expression.value.trim());
        if (
            n.type === "JSXAttribute" &&
            VISIBLE_ATTRIBUTES.has(n.name?.name) &&
            n.value?.type === "Literal" &&
            typeof n.value.value === "string" &&
            n.value.value.trim()
        )
            found.push(`${n.name.name}="${n.value.value.trim()}"`);
    });
    return found;
}

/** Every `.js` under app/(tools)/, repo-relative and posix-separated. */
function toolsFiles() {
    const out = [];
    listJsFiles(repoPath("app/(tools)"), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

export function run({ check, assert, log }) {
    // ── 1: the count per status ─────────────────────────────────────────────
    log("every tool carries a count for every status, a zero included:");

    const rows = summarizeTools(TOOLS, ITEMS);
    check("one row per tool", rows.length, TOOLS.length);
    for (const row of rows) {
        check(
            `  ${row.toolName} carries the whole vocabulary`,
            row.counts.map((c) => c.status).join(", "),
            TOOL_STATUS_VALUES.join(", ")
        );
    }

    const grinder = rowFor(rows, "angle grinder");
    check("two of the grinders are in stock", countIn(grinder, TOOL_STATUS.IN_STOCK), 2);
    check("  one is out", countIn(grinder, TOOL_STATUS.OUT), 1);
    check("  and none is retired", countIn(grinder, TOOL_STATUS.RETIRED), 0);
    check(
        "the counts add up to the tool items under it",
        grinder.counts.reduce((sum, c) => sum + c.count, 0),
        3
    );

    // A `Tools` row with nothing under it is reachable: registration writes the
    // tool first and #338 rolls back neither write. It is a row of zeros rather
    // than a missing row.
    const nothing = rowFor(rows, "Cordless Drill");
    assert("a tool with no tool items is still a row", Boolean(nothing));
    check("  and its counts are three zeros", nothing.counts.map((c) => c.count).join(), "0,0,0");

    check(
        "the order is by name, case-insensitively",
        rows.map((r) => r.toolName).join(" | "),
        "angle grinder | Cordless Drill | Impact Driver"
    );

    // ANTI-VACUITY: the summarizer is seen counting something other than zero for
    // each of the three, so the row above is a fact about the input rather than
    // about a function that returns zeros.
    const everyStatus = summarizeTools(
        [{ id: "recAll", toolName: "All", toolItems: [] }],
        TOOL_STATUS_VALUES.map((status, i) => ({ id: `s${i}`, tool: ["recAll"], status }))
    )[0];
    assert(
        "  and every status is reachable as a nonzero count",
        everyStatus.counts.every((c) => c.count === 1)
    );
    // A tool item whose link did not resolve is counted nowhere rather than
    // throwing — `findByRecordIds` returns fewer rows than it was asked for, and
    // one bad link must not take the whole list down.
    const unlinked = summarizeTools(TOOLS, [...ITEMS, { id: "i9", tool: [], status: TOOL_STATUS.OUT }]);
    check(
        "an unlinked tool item is counted nowhere",
        unlinked.reduce((sum, r) => sum + r.counts.reduce((s, c) => s + c.count, 0), 0),
        ITEMS.length
    );

    // ── 2: the paging ───────────────────────────────────────────────────────
    log("");
    log("a page holds twenty-five tool items, and the pages are the whole list:");

    // PINNED BY VALUE SINCE #442, where this held only that the size was a whole
    // number under fifty. Every length in the loop was derived from the constant,
    // and the one thing that tied the size down was a twelve-row fixture, by the
    // accident of twelve rows being two pages at ten. It is the design's figure and
    // the design may move it (docs/briefs/tools-toolRecordId.md); moving it is an edit
    // to these literals in the same commit.
    check("a page holds this many tool items", TOOL_PAGE_SIZE, 25);
    // Above 50 a page would cost two `findChildRecords` queries instead of one,
    // which is a boundary on this number that is not the design's.
    assert("  and stays inside one batched read of fifty", TOOL_PAGE_SIZE <= 50);
    // AND A PAGE IS WHAT ONE PRESS OF PRINT SENDS (#442), the other boundary that is
    // not the design's. The tool's screen hands the label screen the tool items on
    // the page it shows, and the label screen prints `MAX_LABELS_PER_REQUEST` at a
    // time — a cap tied to the registration form rather than to this page — so the
    // page has to fit under it or a press prints part of its page. Each figure is
    // pinned by value where it lives; this is the order between them.
    assert("  and fits what the label screen prints at once", TOOL_PAGE_SIZE <= MAX_LABELS_PER_REQUEST);

    const idsOfLength = (n) => Array.from({ length: n }, (_, i) => `rec${String(i).padStart(3, "0")}`);
    // Literal lengths and literal page counts, on both sides of both edges a page of
    // twenty-five has inside a hundred.
    for (const [n, pages] of [
        [0, 1],
        [1, 1],
        [24, 1],
        [25, 1],
        [26, 2],
        [50, 2],
        [51, 3],
        [100, 4],
    ]) {
        const all = idsOfLength(n);
        const first = pageOfToolItems(all, 1);
        check(`  ${n} tool items make ${pages} page${pages === 1 ? "" : "s"}`, first.pageCount, pages);

        // THE ASSERTION THIS FILE IS FOR: every page, in order, is the whole list.
        const reassembled = [];
        for (let p = 1; p <= first.pageCount; p++) reassembled.push(...pageOfToolItems(all, p).ids);
        check(`    and the pages reassemble into it`, reassembled.join(), all.join());
        check(`    with the total stating the whole list`, first.total, n);
    }

    // A LIST THAT REALLY SPANS PAGES AT THIS SIZE (#442). This was twelve, which was
    // two pages at ten and is one at twenty-five: its page-2 assertions fail at this
    // size, and any version of them bent to pass would be asking about a list with
    // no second page. Fifty-two is three pages — two full and two left over, which
    // puts a middle page between the two ends. Its page count is pinned first, so a
    // fixture that stopped spanning pages fails here rather than quietly asking about
    // page 1 three times.
    const fiftyTwo = idsOfLength(52);
    check("fifty-two tool items make three pages", pageOfToolItems(fiftyTwo, 1).pageCount, 3);
    check("  page 1 holds the first twenty-five", pageOfToolItems(fiftyTwo, 1).ids.length, 25);
    check("  page 2 opens on the twenty-sixth", pageOfToolItems(fiftyTwo, 2).ids[0], "rec025");
    check("  and closes on the fiftieth", pageOfToolItems(fiftyTwo, 2).ids.at(-1), "rec049");
    check("  and page 3 holds the remaining two", pageOfToolItems(fiftyTwo, 3).ids.length, 2);
    check("  which are the last two, in order", pageOfToolItems(fiftyTwo, 3).ids.join(), "rec050,rec051");

    log("");
    log("a page nobody can be on resolves to one they can:");
    for (const [raw, want, why] of [
        [undefined, 1, "no parameter at all"],
        ["", 1, "an empty one"],
        ["abc", 1, "one that is not a number"],
        ["-3", 1, "a negative"],
        ["0", 1, "a zero"],
        ["1.5", 1, "a fraction"],
        ["2", 2, "one in the middle"],
        ["3", 3, "the last one"],
        ["999", 3, "one past the end"],
    ])
        check(`  ${why} lands on page ${want}`, pageOfToolItems(fiftyTwo, raw).page, want);
    check("an empty tool has one page, not none", pageOfToolItems([], 1).pageCount, 1);
    check("  and that page is empty", pageOfToolItems([], 1).ids.length, 0);

    // ── 2b: the screen reads one page and prints the same page (#442) ───────
    log("");
    log("the tool's screen reads the page it shows and prints that page:");
    // TWO CLAIMS REST ON ONE ARGUMENT AND NOTHING HELD IT. The screen is four
    // operations whatever the tool's size, and its print control sends one page —
    // and both are true only because the read hands `getToolItemsByTool` the page's
    // ids, and the print link is built from what that read returned. Drop `rowIds`
    // and the screen reads every tool item under the tool and prints every one of
    // them, with no figure on screen to show it. So the call and its argument are
    // read off the source.
    const screenFacts = (ast) => {
        let pageBinding = null;
        let readBinding = null;
        let rowIds = null;
        let printFrom = null;
        walk(ast, (n) => {
            if (
                n.type === "VariableDeclarator" &&
                n.init?.type === "CallExpression" &&
                n.init.callee?.name === "pageOfToolItems"
            )
                pageBinding = n.id?.name ?? null;
            // The read may stand alone or sit in a `Promise.all` destructured by
            // position; either way its binding is the name that receives it.
            if (n.type === "VariableDeclarator" && n.init) {
                const init = n.init.type === "AwaitExpression" ? n.init.argument : n.init;
                if (init?.type === "CallExpression" && init.callee?.name === "getToolItemsByTool")
                    readBinding = n.id?.name ?? null;
                const list = init?.type === "CallExpression" ? init.arguments?.[0] : null;
                if (list?.type === "ArrayExpression" && n.id?.type === "ArrayPattern") {
                    list.elements.forEach((element, at) => {
                        if (element?.type === "CallExpression" && element.callee?.name === "getToolItemsByTool")
                            readBinding = n.id.elements[at]?.name ?? null;
                    });
                }
            }
            if (n.type === "CallExpression" && n.callee?.name === "getToolItemsByTool") {
                const option = n.arguments?.[1]?.properties?.find((p) => p.key?.name === "rowIds");
                rowIds = option ? nameOf(option.value) : "none";
            }
            if (n.type === "CallExpression" && n.callee?.name === "toolItemLabelsPath") {
                const argument = n.arguments?.[0];
                const mapped = argument?.type === "CallExpression" && argument.callee?.property?.name === "map";
                printFrom = mapped ? nameOf(argument.callee.object) : nameOf(argument ?? {});
            }
        });
        return { pageBinding, readBinding, rowIds, printFrom };
    };
    const facts = screenFacts(parseFile(TOOL_SCREEN).ast);
    assert("the screen chooses its page through pageOfToolItems", facts.pageBinding !== null);
    check("  the read is handed that page's ids", facts.rowIds, `${facts.pageBinding}.ids`);
    check("  and the print link is built from what the read returned", facts.printFrom, facts.readBinding);
    assert("  which is a binding the screen really has", facts.readBinding !== null);
    // ANTI-VACUITY: a planted screen that reads the whole tool and prints the whole
    // link array is seen doing both, so the two answers above are facts about the
    // screen rather than a reader that echoes what it expects.
    const plantedScreen = screenFacts(
        parseSource(
            "async function renderToolPage() {\n" +
                "  const page = pageOfToolItems(tool.toolItems, sp.page);\n" +
                "  const [toolItems, jobs] = await Promise.all([getToolItemsByTool(tool.id), getAllJobs()]);\n" +
                "  return <Link href={toolItemLabelsPath(tool.toolItems.map((id) => id))} />;\n" +
                "}\n",
            "<planted-screen>"
        ).ast
    );
    check("  a read with no page is seen reading none", plantedScreen.rowIds, "none");
    check("  and a link built from the whole tool is seen so", plantedScreen.printFrom, "tool.toolItems");

    // ── 2c: this list's page and the document lists' page stay two constants ─
    log("");
    log("the tools page size and the document lists' are two numbers, not one:");
    // SINCE #442 BOTH ARE 25, AND THAT IS WHAT MAKES THIS WORTH A CHECK. They are set
    // for different readers — a phone and three short facts against a monitor and six
    // columns — and this one is also how many labels a press prints. Folding them into
    // one constant makes a design change to either move the other, and two equal
    // numbers in two files is the first thing a pass that names the design's values
    // reaches for. So each has to be declared as a number in its own module, and
    // neither module may reach the other: a shared token, an alias and a re-export all
    // fail here. **What retires this** is a design decision that the two are one
    // reader's page, taken where #258 names the design's values — and then this
    // section changes in that commit, with both docstrings and the notes. The values
    // are not pinned here: this one is pinned above, and the document lists derive
    // theirs on purpose (`offline/list-filters.mjs`).
    const declaredAs = (ast, name) => {
        let found = "not declared";
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === name)
                found =
                    n.init?.type === "Literal" && typeof n.init.value === "number" ? "a number" : n.init?.type ?? "empty";
        });
        return found;
    };
    const sourcesNaming = (ast, fragment) => {
        const found = [];
        walk(ast, (n) => {
            if (
                (n.type === "ImportDeclaration" || n.type === "ExportNamedDeclaration" || n.type === "ExportAllDeclaration") &&
                typeof n.source?.value === "string" &&
                n.source.value.includes(fragment)
            )
                found.push(n.source.value);
        });
        return found;
    };
    const toolListAst = parseFile("lib/toolListView.js").ast;
    const listFiltersAst = parseFile("lib/listFilters.js").ast;
    check("TOOL_PAGE_SIZE is declared as a number of its own", declaredAs(toolListAst, "TOOL_PAGE_SIZE"), "a number");
    check("  and LIST_PAGE_SIZE as one of its own", declaredAs(listFiltersAst, "LIST_PAGE_SIZE"), "a number");
    check(
        "  and neither module reaches the other",
        [...sourcesNaming(toolListAst, "listFilters"), ...sourcesNaming(listFiltersAst, "toolListView")].length,
        0
    );
    // ANTI-VACUITY: a fold by a shared token, by an alias of the other and by a
    // re-export are each seen for what they are.
    check(
        "  a shared token reads as a reference, not a number",
        declaredAs(parseSource('import { PAGE_SIZE } from "./tokens.js";\nexport const TOOL_PAGE_SIZE = PAGE_SIZE;\n', "<planted-token>").ast, "TOOL_PAGE_SIZE"),
        "Identifier"
    );
    check(
        "  a re-export reads as no declaration at all",
        declaredAs(parseSource('export { PAGE_SIZE as TOOL_PAGE_SIZE } from "./tokens.js";\n', "<planted-reexport>").ast, "TOOL_PAGE_SIZE"),
        "not declared"
    );
    check(
        "  and a module reaching the other is seen reaching it",
        sourcesNaming(parseSource('import { LIST_PAGE_SIZE } from "./listFilters.js";\n', "<planted-reach>").ast, "listFilters").length,
        1
    );

    // The address a page of this list lives at moved to lib/toolRoutes.js in
    // #348, with every other address on the axis; `offline/tool-routes.mjs`
    // holds it now.

    // ── 3: the words ────────────────────────────────────────────────────────
    log("");
    log("every word both screens say is in the constant:");
    const strings = copyStrings();
    assert(`the constant holds ${strings.length} strings`, strings.length >= 10);
    check("none is empty", strings.filter((s) => !s.trim()).length, 0);
    check(
        "no string says `kind`",
        strings.filter((s) => /\bkinds?\b/i.test(s)).length,
        0
    );
    check(
        "no string says a bare `item`",
        strings.filter((s) => bareItemWords(s).length > 0).length,
        0
    );
    // The three field labels are the tool item page's, not a second spelling.
    for (const [key, label] of [
        ["toolLabel", TOOL_ITEM_COPY.toolLabel],
        ["statusLabel", TOOL_ITEM_COPY.statusLabel],
        ["jobLabel", TOOL_ITEM_COPY.jobLabel],
        ["backToTools", TOOL_ITEM_COPY.backToTools],
    ])
        check(`  ${key} is the tool item page's word`, TOOL_LIST_COPY[key], label);
    // A status is a closed vocabulary value and is rendered from it. Spelling one
    // into a sentence here would be a second copy that a narrowing like #335's
    // would leave behind.
    check(
        "no string spells a status",
        strings.filter((s) => TOOL_STATUS_VALUES.some((v) => s.includes(v))).length,
        0
    );
    check("the heading is the table's name", TOOL_LIST_COPY.heading, "Tools");
    check("one tool item is singular", TOOL_LIST_COPY.total(1), "1 tool item");
    check("  and two are plural", TOOL_LIST_COPY.total(2), "2 tool items");
    check("  and none is plural too", TOOL_LIST_COPY.total(0), "0 tool items");
    assert(
        "the position names both figures",
        TOOL_LIST_COPY.pagePosition({ page: 2, pageCount: 3 }).includes("2") &&
            TOOL_LIST_COPY.pagePosition({ page: 2, pageCount: 3 }).includes("3")
    );
    assert("the copy scanner finds a planted bare `item`", bareItemWords("Every item on this tool.").length === 1);
    assert("  and does not flag `tool item` or `tool items`", bareItemWords("This tool item and those tool items.").length === 0);

    // ── 4: no tools screen writes text into its markup ──────────────────────
    log("");
    log("no screen under app/(tools)/ puts a word in its markup:");
    const files = toolsFiles();
    assert(`${files.length} files scanned`, files.length >= 4);
    const offenders = [];
    for (const rel of files) {
        for (const text of markupText(parseFile(rel).ast)) offenders.push(`${rel}: ${text}`);
    }
    check(
        `every string comes from a constant${offenders.length ? ` (${offenders.join("; ")})` : ""}`,
        offenders.length,
        0
    );

    // ANTI-VACUITY AND THE MUTATION IN ONE: the heading `/tools` carried until this
    // issue, restored, plus the two shapes a rewrite would reach for instead.
    const planted = parseSource(
        'function Page() {\n' +
            '  return (<div>\n' +
            '    <h1>Tools</h1>\n' +
            '    <p>{"Register tool items"}</p>\n' +
            '    <input placeholder="Tool name" />\n' +
            '    <span>{COPY.heading}</span>\n' +
            '  </div>);\n' +
            '}\n',
        "<planted-markup>"
    );
    const seen = markupText(planted.ast);
    for (const [text, shape] of [
        ["Tools", "bare JSX text"],
        ["Register tool items", "a string literal child"],
        ['placeholder="Tool name"', "a visible attribute"],
    ])
        assert(`  the scanner sees ${shape}`, seen.includes(text));
    check("  and passes a constant through", seen.length, 3);
}

if (isMain(import.meta.url)) standalone(title, run);

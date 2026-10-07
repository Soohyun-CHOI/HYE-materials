// What the two tools list screens show (#339).
//
// THREE THINGS LIVE HERE AND THE THIRD IS WIDER THAN THE OTHER TWO.
//
//   THE COUNT PER STATUS IS DERIVED FROM THE VOCABULARY, NOT WRITTEN OUT. A tool's
//   row carries `In stock`, `Out` and `Retired` whatever the tool items under it
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
//   shows: that the screen reads one page, and that its page size is its own number
//   rather than the document lists'.
//
//   THE SELECTION IS WHAT A LABEL RUN IS FOR (#443), and it splits the same way.
//   What a press does to it and what the control says are pure functions, held by
//   value at literal sizes on both sides of the print cap; what no value can show is
//   where it lives — that the server never reads it, that the list is handed only the
//   rows the page read, that the labels' opener and both steps are built from it, and
//   that a press rewrites the address without a render — so those are read off the
//   AST of the page and of the list, each beside a planted screen doing it wrong.
//
//   AND A REGISTRATION LANDS HERE (#449), which splits the same way once more. That
//   what it wrote opens the first page is `pageOfToolItems`' newest first, held by
//   value over a tool that already fills pages (#463), where `pageHolding` held the
//   page by its edges while the list read oldest first; what the page reads for the
//   account it lands with, what it
//   hands the fork, and what the fork's dismissal does to the address are read off
//   the AST beside planted versions doing each wrong. So is the control that opens
//   the form from the page (#451): what it is handed, what it says, and that no
//   condition stands above it. Since #459 the fork and the notice are dialogs, and
//   the same reading holds when each is open, what closing it answers, the order
//   they stand in, and how the fork opens the registration.
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
// literal tool items here. **This went on to say `Out` depended on a screen that
// writes a `Checked out` row, which the app did not have; #362 wrote one, and a
// browser has shown the figure since.**
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { TOOL_STATUS, TOOL_STATUS_VALUES } from "../../../lib/toolStatus.js";
import { TOOL_ITEM_COPY } from "../../../lib/toolItemView.js";
import {
    TOOL_LIST_COPY,
    TOOL_PAGE_SIZE,
    describeSelection,
    pageOfToolItems,
    pageOfTools,
    pageSelection,
    summarizeTools,
    togglePage,
    toggleToolItem,
} from "../../../lib/toolListView.js";
import { MAX_LABELS_PER_REQUEST } from "../../../lib/toolLabelPage.js";
import { readToolItemIds } from "../../../lib/toolRoutes.js";
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
            out.push(value(2), value({ page: 2, pageCount: 3, from: 26, to: 40, total: 40 }));
        }
    }
    return out.filter((s) => typeof s === "string");
}

/**
 * The noun the design replaced (#455), in any number and case.
 *
 * THIS FILE HELD THE OPPOSITE RULE UNTIL THEN — a string here failed for a bare `item`,
 * the tools area's reading of #303. The design put `items` on a tool's own page (its
 * count and its column) and `tool` in every sentence about one, so what a string here
 * may no longer say is the noun it used to require.
 */
const TOOL_ITEM_NOUN = /\btool items?\b/i;

/** The tool's own screen, whose read and the rows it hands on section 2b reads off the AST. */
const TOOL_SCREEN = "app/(tools)/tools/[toolRecordId]/page.js";

/** The list on that screen, whose selection section 2b reads off the AST (#443). */
const TOOL_ITEM_LIST = "app/(tools)/tools/[toolRecordId]/ToolItemList.js";

/** The tool list, whose opener of the registration dialog section 2b reads off the AST (#456). */
const LIST_SCREEN = "app/(tools)/tools/page.js";

/** The frame both lists are drawn in, its parts, the box and the rail's column (#463). */
const LIST_FRAME = "app/components/ListFrame.js";
const LIST_TABLE = "app/components/ListTable.js";
const CONTROLS = "app/components/Controls.js";
const RAIL = "app/components/Rail.js";

/** The source of the function `name` declares in a parsed file, or "" when there is none. */
function functionSource(parsed, name) {
    let found = "";
    walk(parsed.ast, (n) => {
        if (!found && n.type === "FunctionDeclaration" && n.id?.name === name) found = parsed.source.slice(n.start, n.end);
    });
    return found;
}

/** What a JSX element named `name` is handed for `prop`, as written, each occurrence once. */
function propSources(parsed, name, prop) {
    const out = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== name) return;
        const attribute = n.attributes.find((a) => a.name?.name === prop);
        if (attribute) out.push(attribute.value ? parsed.source.slice(attribute.value.start, attribute.value.end) : "true");
    });
    return out;
}

/** `(await searchParams) ?? {}`, `await searchParams` or `searchParams` — a page's address. */
function isSearchParams(init) {
    let e = init;
    if (e?.type === "LogicalExpression") e = e.left;
    if (e?.type === "AwaitExpression") e = e.argument;
    return e?.type === "Identifier" && e.name === "searchParams";
}

/** `page.ids` for a member read, the bare name for an identifier, else the node's type. */
function nameOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) return `${nameOf(node.object)}.${node.property.name}`;
    return node?.type ?? "none";
}

/**
 * A JSX element's attributes as name and value, a spread of an object the same file binds
 * read as that object's own props (#463): two openers on one page hand one object, so what
 * each is handed is read off the object rather than lost behind the spread.
 */
function attributesOf(openingElement, ast) {
    const out = [];
    for (const attribute of openingElement.attributes) {
        if (attribute.type === "JSXSpreadAttribute" && attribute.argument?.type === "Identifier") {
            let bound = null;
            walk(ast, (n) => {
                if (!bound && n.type === "VariableDeclarator" && n.id?.name === attribute.argument.name && n.init?.type === "ObjectExpression") bound = n.init;
            });
            for (const p of bound?.properties ?? [])
                out.push({ name: p.key?.name, value: p.shorthand ? { type: "Identifier", name: p.key.name } : p.value });
        } else out.push({ name: attribute.name?.name, value: attribute.value });
    }
    return out;
}

/**
 * What a `<RegistrationDialog>` is handed (#456), prop by prop and sorted: a name or a
 * member as `nameOf` reads it, a literal as its value, an object as its own props, and a
 * bare attribute as `true`. The opener carries what the registration's address carried
 * until #456, so these are what the three openers are held to.
 */
function dialogProps(openingElement, ast) {
    // A call reads as its callee and its arguments, so `canRegisterToolItems(user, jobs)`
    // is told from a literal `true` and from the same predicate asked of another list;
    // a function handed as an argument reads as `…`, since only its caller matters here.
    const sourceOf = (node) => {
        if (node?.type === "CallExpression")
            return `${sourceOf(node.callee)}(${node.arguments
                .map((argument) => (argument.type === "ArrowFunctionExpression" ? "…" : sourceOf(argument)))
                .join(", ")})`;
        if (node?.type === "MemberExpression" && !node.computed) return `${sourceOf(node.object)}.${node.property.name}`;
        return nameOf(node);
    };
    const valueOf = (node) => {
        if (!node) return "true";
        const expression = node.type === "JSXExpressionContainer" ? node.expression : node;
        if (expression?.type === "Literal") return String(expression.value);
        if (expression?.type === "ObjectExpression")
            return `{ ${expression.properties
                .map((p) => (p.shorthand ? p.key.name : `${p.key?.name}: ${sourceOf(p.value)}`))
                .join(", ")} }`;
        return sourceOf(expression);
    };
    return attributesOf(openingElement, ast)
        .map((attribute) => `${attribute.name}: ${valueOf(attribute.value)}`)
        .sort()
        .join(", ");
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
    // AND A PAGE IS WHAT ONE PRESS OF THE PAGE BOX SELECTS (#443), the other boundary
    // that is not the design's. The print control acts only on a selection of at most
    // `MAX_LABELS_PER_REQUEST` — a cap tied to the registration form rather than to
    // this page — so a page larger than that would be a box whose first press leaves
    // the control refusing. It was what one press of print SENT until #443 (#442), and
    // the order held for that reason then. Each figure is pinned by value where it
    // lives; this is the order between them.
    assert("  and fits what one print takes at once", TOOL_PAGE_SIZE <= MAX_LABELS_PER_REQUEST);

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

        // THE ASSERTION THIS FILE IS FOR: every page, in order, is the whole list — newest
        // first since #463, the link array turned over.
        const reassembled = [];
        for (let p = 1; p <= first.pageCount; p++) reassembled.push(...pageOfToolItems(all, p).ids);
        check(`    and the pages reassemble into it, newest first`, reassembled.join(), [...all].reverse().join());
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
    // NEWEST FIRST (#463): the array's last opens page 1, and its first closes the list.
    check("  page 1 holds the newest twenty-five", pageOfToolItems(fiftyTwo, 1).ids.length, 25);
    check("  opening on the newest of all", pageOfToolItems(fiftyTwo, 1).ids[0], "rec051");
    check("  page 2 opens on the twenty-sixth newest", pageOfToolItems(fiftyTwo, 2).ids[0], "rec026");
    check("  and closes on the fiftieth", pageOfToolItems(fiftyTwo, 2).ids.at(-1), "rec002");
    check("  and page 3 holds the remaining two", pageOfToolItems(fiftyTwo, 3).ids.length, 2);
    check("  which are the oldest two, newest first", pageOfToolItems(fiftyTwo, 3).ids.join(), "rec001,rec000");
    check("  and the link array it was handed is left as it was", fiftyTwo[0], "rec000");

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

    // WHERE A REGISTRATION LANDS (#449): the first page since #463, because the list reads
    // newest first and what a registration wrote is the newest its tool holds. Its tool
    // items are appended to the tool's link array, so they are seen opening page 1 of a tool
    // that already fills a page, the last written first, and a run longer than a page going
    // on to page 2 — which is what the action's landing on page 1 rests on, and
    // `offline/tool-registration.mjs` reads that 1 off its redirect. Until #463 the landing
    // was `pageHolding`'s page, held here by its edges.
    log("");
    log("what a registration wrote opens the first page, newest first:");
    const before = idsOfLength(30);
    const written = Array.from({ length: 14 }, (_, i) => `new${String(i).padStart(3, "0")}`);
    check("  the tool already fills a page", pageOfToolItems(before, 1).pageCount, 2);
    check(
        "  a registration's fourteen open page 1, the last written first",
        pageOfToolItems([...before, ...written], 1).ids.slice(0, 14).join(),
        [...written].reverse().join()
    );
    check("  and the tool's newest before them follows", pageOfToolItems([...before, ...written], 1).ids[14], "rec029");
    const run = Array.from({ length: 30 }, (_, i) => `run${String(i).padStart(3, "0")}`);
    check(
        "  a run longer than a page fills page 1 and goes on to page 2",
        `${pageOfToolItems([...before, ...run], 1).ids.every((id) => id.startsWith("run"))} ${pageOfToolItems([...before, ...run], 2).ids.slice(0, 5).join()}`,
        "true run004,run003,run002,run001,run000"
    );

    // ── 2b: the screen reads one page, and its list selects among it (#442, #443) ─
    log("");
    log("the tool's screen reads the page it shows and hands the list those rows alone:");
    // TWO CLAIMS REST ON ONE ARGUMENT AND NOTHING HELD IT UNTIL #442. The screen is
    // four operations whatever the tool's size, and its page box selects one page —
    // and both are true only because the read hands `getToolItemsByTool` the page's
    // ids and the list is handed the rows that read returned. Drop `rowIds` and the
    // screen reads every tool item under the tool and offers every one of them to the
    // page box, with no figure on screen to show it. Until #443 the second claim was
    // the print link, built on this page from the same read — the labels' opener, in the
    // list, since #457.
    //
    // AND THE PAGE READS NOTHING BUT `page` OFF ITS ADDRESS (#443). What a label run is
    // for is in the address too, and a page that read it could fetch the tool items
    // selected on other pages — a fifth operation, and more — without any figure on
    // screen moving. It is the list's to read, on the client; the page never names it.
    const screenFacts = (ast) => {
        let pageBinding = null;
        let readBinding = null;
        let rowIds = null;
        let rowsFrom = null;
        let printLinks = 0;
        let listToolName = null;
        let accountFrom = null;
        let fork = null;
        let notice = null;
        const told = [];
        const mapped = [];
        const addressBindings = new Set();
        const addressReads = new Set();
        walk(ast, (n) => {
            // #449: where the account is read from, what the fork is handed, and which
            // arrays the page maps — the notice's ids are one of them.
            if (n.type === "CallExpression" && n.callee?.name === "readRegistrationAccount")
                accountFrom = (n.arguments[0]?.properties ?? [])
                    .map((p) => `${p.key?.name}: ${nameOf(p.value)}`)
                    .sort()
                    .join(", ");
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationShortfall") {
                fork = n.attributes
                    .map((a) => `${a.name?.name}: ${nameOf(a.value?.expression ?? {})}`)
                    .sort()
                    .join(", ");
                told.push(n.name.name);
            }
            // #455: the notice is a component of its own now, since `Got it` is a press.
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationUnlogged") {
                notice = n.attributes
                    .map((a) => `${a.name?.name}: ${nameOf(a.value?.expression ?? {})}`)
                    .sort()
                    .join(", ");
                told.push(n.name.name);
            }
            if (n.type === "CallExpression" && n.callee?.property?.name === "map") mapped.push(nameOf(n.callee.object));
            if (n.type === "VariableDeclarator" && isSearchParams(n.init)) {
                if (n.id?.type === "Identifier") addressBindings.add(n.id.name);
                if (n.id?.type === "ObjectPattern")
                    for (const p of n.id.properties) if (p.key?.type === "Identifier") addressReads.add(p.key.name);
            }
            // What the list is handed as its rows: the read's binding, mapped.
            if (n.type === "JSXAttribute" && n.name?.name === "rows") {
                const value = n.value?.expression;
                const mapped = value?.type === "CallExpression" && value.callee?.property?.name === "map";
                rowsFrom = mapped ? nameOf(value.callee.object) : nameOf(value ?? {});
            }
            // The labels' opener (#457), which is the list's to draw — it was a link the
            // list built until then, and a page drawing one of its own would open the
            // labels on something other than the selection the list holds.
            if (n.type === "JSXOpeningElement" && n.name?.name === "LabelsDialog") printLinks++;
            if (n.type === "JSXOpeningElement" && n.name?.name === "ToolItemList") {
                const named = n.attributes.find((a) => a.name?.name === "toolName");
                listToolName = named ? nameOf(named.value?.expression ?? {}) : "none";
            }
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
        });
        walk(ast, (n) => {
            if (
                n.type === "MemberExpression" &&
                !n.computed &&
                n.object?.type === "Identifier" &&
                addressBindings.has(n.object.name)
            )
                addressReads.add(n.property.name);
        });
        return {
            pageBinding,
            readBinding,
            rowIds,
            rowsFrom,
            printLinks,
            listToolName,
            accountFrom,
            fork,
            notice,
            // The order the two stand in, which is the order their frames close and open in.
            told: told.join(", "),
            mappedFromAddress: mapped.filter((name) => name.includes("unlogged")).join(", "),
            addressReads: [...addressReads].sort(),
        };
    };
    const facts = screenFacts(parseFile(TOOL_SCREEN).ast);
    assert("the screen chooses its page through pageOfToolItems", facts.pageBinding !== null);
    check("  the read is handed that page's ids", facts.rowIds, `${facts.pageBinding}.ids`);
    check("  and the list is handed the rows that read returned", facts.rowsFrom, facts.readBinding);
    assert("  which is a binding the screen really has", facts.readBinding !== null);
    // AND A REGISTRATION'S ACCOUNT (#449), which this page does read: it is drawn at
    // render and no box or step moves it, so a server read is right for it where it is
    // wrong for the selection. Pinned by name, so a page that began to read `id` fails
    // here even while it read the account as well.
    check(
        "the page reads `page` and a registration's account off its address, and never the selection",
        facts.addressReads.join(", "),
        "asked, page, unlogged, unwritten"
    );
    check("  and draws no labels' opener of its own", facts.printLinks, 0);
    // THE LABELS' DIALOG NAMES THE TOOL UNDER ITS TITLE (#457), and the name is the one
    // this page read for its heading, handed to the list that draws the opener.
    check("  handing the list the tool's name for that dialog", facts.listToolName, "tool.toolName");
    // WHAT THE ACCOUNT IS READ THROUGH AND HANDED TO (#449, #455, #459). One reader of the
    // three keys, and both dialogs handed what that reader returned — not the address's
    // values, which would skip the reading that drops a forged count and spells every id
    // once. Each is handed the whole account since #459, because which of them is told
    // depends on both parts (`accountToTell`), and each names the tool under its title.
    check(
        "  the account is read through readRegistrationAccount, off the address",
        facts.accountFrom,
        "asked: sp.asked, unlogged: sp.unlogged, unwritten: sp.unwritten"
    );
    // AND, SINCE #456, what the fork's opener needs of the reader: whether they may
    // register, asked once on this page, and the jobs the dialog offers — the same two the
    // page's own opener is handed, so the two openers cannot answer the reader differently.
    check(
        "  the fork is handed the tool's name, that reading and the page's answer about the reader",
        facts.fork,
        "account: account, canRegister: canRegister, jobs: assignedJobs, toolName: tool.toolName"
    );
    check("  and the notice the tool's name and the same reading", facts.notice, "account: account, toolName: tool.toolName");
    check("  which the page no longer lists itself", facts.mappedFromAddress, "");
    // THE NOTICE STANDS FIRST (#459): it is told first, and a notice whose answer hands
    // over to the fork has to close before the fork opens, which is tree order.
    check("  the notice stands before the fork", facts.told, "RegistrationUnlogged, RegistrationShortfall");
    // ANTI-VACUITY: a planted page reading one key raw, handing the fork a record id and
    // the address itself, handing the notice the address, putting the fork first and
    // mapping the address's list as well is seen doing all of it.
    const plantedHandoff = screenFacts(
        parseSource(
            "async function renderToolPage({ searchParams }) {\n" +
                "  const sp = (await searchParams) ?? {};\n" +
                "  const account = readRegistrationAccount({ unwritten: sp.unwritten });\n" +
                "  return (<>\n" +
                "    <RegistrationShortfall toolName={tool.id} account={sp} />\n" +
                "    <RegistrationUnlogged account={sp} />\n" +
                "    <ul>{sp.unlogged.map((id) => <li key={id}>{id}</li>)}</ul>\n" +
                "  </>);\n" +
                "}\n",
            "<planted-handoff>"
        ).ast
    );
    check("  a reader handed one key is seen so", plantedHandoff.accountFrom, "unwritten: sp.unwritten");
    check("  a fork handed a record id and the address is seen so", plantedHandoff.fork, "account: sp, toolName: tool.id");
    check("  a notice handed the address is seen so", plantedHandoff.notice, "account: sp");
    check("  the fork put first is seen", plantedHandoff.told, "RegistrationShortfall, RegistrationUnlogged");
    check("  and a list mapped off the address is seen so", plantedHandoff.mappedFromAddress, "sp.unlogged");
    // ANTI-VACUITY: a planted screen that reads the whole tool, hands the list the whole
    // link array, reads the selection and prints it itself is seen doing all four, so the
    // answers above are facts about the screen rather than a reader that echoes them.
    const plantedScreen = screenFacts(
        parseSource(
            "async function renderToolPage({ searchParams }) {\n" +
                "  const sp = (await searchParams) ?? {};\n" +
                "  const page = pageOfToolItems(tool.toolItems, sp.page);\n" +
                "  const [toolItems, jobs] = await Promise.all([getToolItemsByTool(tool.id), getAllJobs()]);\n" +
                "  const picked = await getToolItemsByToolItemIds(sp.id);\n" +
                "  return (<>\n" +
                "    <ToolItemList rows={tool.toolItems.map((id) => id)} />\n" +
                "    <LabelsDialog toolItemIds={picked} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-screen>"
        ).ast
    );
    check("  a read with no page is seen reading none", plantedScreen.rowIds, "none");
    check("  rows from the whole tool are seen so", plantedScreen.rowsFrom, "tool.toolItems");
    check("  a page reading the selection is seen reading it", plantedScreen.addressReads.join(", "), "id, page");
    check("  a labels' opener drawn on the page is seen", plantedScreen.printLinks, 1);
    check("  and a list handed no tool's name is seen so", plantedScreen.listToolName, "none");

    // THE LIST'S HALF (#443). The selection is read off the address here and nowhere
    // else, and three things about it hold only in the source: the labels' opener is
    // handed it and not the rows — a link built from it until #457, which took the labels
    // into a dialog — and stands disabled exactly where the list's own sentence says why;
    // the page box acts on the rows it was handed and nothing wider; and every address
    // this file writes carries it, through `history.replaceState` and never the router —
    // which is the difference between a press that costs nothing and one that re-renders
    // the page at four operations.
    const listFacts = (ast, source) => {
        const bindings = new Map();
        let selection = null;
        let readOff = null;
        let printFrom = null;
        let printDisabled = null;
        let printTitle = null;
        let pageBoxOver = null;
        const toolPathCalls = [];
        let replaced = 0;
        const routed = [];
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.type === "Identifier") {
                bindings.set(n.id.name, n.init);
                if (n.init?.type === "CallExpression" && n.init.callee?.name === "readToolItemIds") {
                    selection = n.id.name;
                    // What it is handed: every `id` in the address, or only the first.
                    const source = n.init.arguments[0];
                    const method = source?.type === "CallExpression" ? nameOf(source.callee).split(".").pop() : null;
                    const literals = source?.arguments?.map((a) => JSON.stringify(a.value)).join(", ");
                    readOff = method ? `${method}(${literals})` : nameOf(source ?? {});
                }
            }
        });
        const origin = (node) => {
            const init = node?.type === "Identifier" ? bindings.get(node.name) : node;
            return init?.type === "CallExpression" && init.callee?.property?.name === "map"
                ? nameOf(init.callee.object)
                : nameOf(node ?? {});
        };
        walk(ast, (n) => {
            if (n.type === "JSXOpeningElement" && n.name?.name === "LabelsDialog") {
                const attribute = (name) => n.attributes.find((a) => a.name?.name === name)?.value?.expression;
                printFrom = origin(attribute("toolItemIds"));
                const disabled = attribute("disabled");
                printDisabled = disabled && source ? source.slice(disabled.start, disabled.end) : "none";
                const title = attribute("title");
                printTitle = title ? nameOf(title) : "none";
            }
            if (n.type !== "CallExpression") return;
            const callee = nameOf(n.callee);
            if (callee === "togglePage") pageBoxOver = origin(n.arguments[1]);
            if (callee === "toolPath")
                toolPathCalls.push(n.arguments.length === 3 ? nameOf(n.arguments[2]) : `${n.arguments.length} arguments`);
            if (callee === "window.history.replaceState") replaced++;
            if (callee === "useRouter" || callee === "redirect" || /^router\./.test(callee)) routed.push(callee);
        });
        return { selection, readOff, printFrom, printDisabled, printTitle, pageBoxOver, toolPathCalls, replaced, routed };
    };
    const listFile = parseFile(TOOL_ITEM_LIST);
    const list = listFacts(listFile.ast, listFile.source);
    check("the list reads its selection through readToolItemIds", list.selection, "selection");
    // `get` would answer with the first id alone, so a selection of three would read as
    // one and print one — a defect no figure on this page shows until print is pressed.
    check("  handed every `id` in the address", list.readOff, 'getAll("id")');
    check("  the labels' opener is handed it", list.printFrom, list.selection);
    // `describeSelection` says why a press would not print — nothing selected, or more
    // than one print takes — and the opener is drawn disabled on exactly that.
    check("  and is disabled where the list's sentence says why", list.printDisabled, "!summary.printable");
    // ITS WORD IS THE DIALOG'S TITLE FROM A TOOL'S PAGE, `Print labels`. The opener hands
    // the dialog its title, so the tool item page's `Print label` here would title a run
    // of many with one label's word, and no figure on the page would move.
    check("  and says the dialog's word for a run from a tool", list.printTitle, "LABEL_COPY.openFromTool");
    check("  the page box acts on the rows the page handed it", list.pageBoxOver, "rows");
    check(
        "  every address it writes carries a selection — the new one, or the current one on a step",
        list.toolPathCalls.join(", "),
        "next, selection, selection"
    );
    check("  written with history.replaceState", list.replaced, 1);
    check("  and never through the router", list.routed.join(", "), "");
    // ANTI-VACUITY: a planted list doing each of those wrong is seen doing it — the
    // opener handed the rows and never disabled, the page box over a wider list, a step
    // that drops the selection, and the router instead of the history.
    const plantedListFile = parseSource(
        "function ToolItemList({ toolRecordId, rows, page, everyId }) {\n" +
            "  const router = useRouter();\n" +
            "  const params = useSearchParams();\n" +
            '  const selection = readToolItemIds(params.get("id"));\n' +
            "  const wider = everyId.map((id) => id);\n" +
            "  const press = () => router.replace(toolPath(toolRecordId, page, togglePage(selection, wider)));\n" +
            "  return (<>\n" +
            "    <LabelsDialog toolItemIds={rows.map((row) => row.toolItemId)} />\n" +
            "    <Link href={toolPath(toolRecordId, page + 1)} />\n" +
            "  </>);\n" +
            "}\n",
        "<planted-list>"
    );
    const plantedList = listFacts(plantedListFile.ast, plantedListFile.source);
    check("  a read of the first id alone is seen so", plantedList.readOff, 'get("id")');
    check("  an opener handed the rows is seen so", plantedList.printFrom, "rows");
    check("  and one never disabled is seen so", plantedList.printDisabled, "none");
    check("  and one with no title of its own is seen so", plantedList.printTitle, "none");
    check("  a page box over a wider list is seen so", plantedList.pageBoxOver, "everyId");
    check("  a step dropping the selection is seen", plantedList.toolPathCalls.join(", "), "CallExpression, 2 arguments");
    check("  and the router is seen", plantedList.routed.join(", "), "useRouter, router.replace");
    check("  with no history write", plantedList.replaced, 0);

    // THE FORK'S HALF (#449, #455, #459). `Not now` has to edit the CURRENT address and
    // take the fork's own two keys out of it: an address rebuilt from anything the render
    // was handed would put back a selection the reader has since changed, and deleting
    // `unlogged` too would take the notice's ids with it. `Add 2 more` has to carry the
    // count the fork was handed into the registration dialog — and since #485 it names that
    // count, so its words and the dialog are handed one value — and since #459 the fork is
    // a dialog of its own: open while `accountToTell` tells it and the registration is
    // shut, closed with `Not now` on the close and on Escape as on its own answer, handing
    // focus to the page's heading, and opening the form through the one opening rule
    // behind the one gate. Its title and its sentence are read here too (#485), as the
    // expressions whose values `offline/tool-registration.mjs` holds for a batch that
    // failed. None of that moves a figure, so it is read off the source — and the
    // notice's `Got it` below is held the same way.
    const FORK = "app/(tools)/tools/[toolRecordId]/RegistrationShortfall.js";
    const NOTICE = "app/(tools)/tools/[toolRecordId]/RegistrationUnlogged.js";
    const forkFacts = ({ ast, source }) => {
        const text = (node) => (node ? source.slice(node.start, node.end).replace(/\s+/g, " ") : "");
        const deleted = [];
        const added = [];
        let replaced = 0;
        let rebuilt = 0;
        let readsLocation = false;
        const routed = [];
        let opens = null;
        let gate = null;
        let frame = null;
        let told = null;
        let registration = null;
        // The count the answer that goes on names, and the count the form is handed (#485).
        let offers = "none";
        let handed = "none";
        // What the dialog says: its title and its one sentence, as expressions (#485).
        let titled = "none";
        let message = "none";
        const answers = [];
        walk(ast, (n) => {
            if (n.type === "MemberExpression" && nameOf(n) === "window.location.href") readsLocation = true;
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationForm") {
                opens = dialogProps(n);
                const quantity = n.attributes.find((a) => a.name?.name === "quantity");
                if (quantity) handed = text(quantity.value?.expression);
            }
            // The gate and what it says: its props, and the one expression it holds.
            if (n.type === "JSXElement" && n.openingElement.name?.name === "RegistrationOpener") {
                const said = n.children.find((c) => c.type === "JSXExpressionContainer");
                gate = `${dialogProps(n.openingElement)} → ${text(said?.expression)}`;
                if (said?.expression?.type === "CallExpression") offers = said.expression.arguments.map(text).join(", ");
            }
            if (n.type === "JSXElement" && n.openingElement.name?.name === "DialogMessage") {
                const said = n.children.find((c) => c.type === "JSXExpressionContainer");
                if (said) message = text(said.expression);
            }
            // The frame: when it is open, what closing it answers, and whether a press opened it.
            if (n.type === "JSXOpeningElement" && n.name?.name === "DialogFrame") {
                const attribute = (name) => n.attributes.find((a) => a.name?.name === name);
                const unprompted = attribute("unprompted");
                frame = `open: ${text(attribute("open")?.value?.expression)} · onClose: ${text(
                    attribute("onClose")?.value?.expression
                )} · ${unprompted ? "unprompted" : "prompted"}`;
                if (attribute("title")) titled = text(attribute("title").value?.expression);
            }
            // The dialog's own answers, by what each one runs.
            if (n.type === "JSXOpeningElement" && n.name?.name === "Button") {
                const onClick = n.attributes.find((a) => a.name?.name === "onClick");
                answers.push(text(onClick?.value?.expression));
            }
            if (n.type === "VariableDeclarator" && n.id?.name === "told") told = text(n.init);
            if (n.type === "VariableDeclarator" && n.id?.name === "registration") registration = text(n.init);
            if (n.type !== "CallExpression") return;
            const callee = nameOf(n.callee);
            if (/\.searchParams\.delete$/.test(callee)) deleted.push(n.arguments[0]?.value);
            if (/\.searchParams\.(set|append)$/.test(callee)) added.push(n.arguments[0]?.value);
            if (callee === "window.history.replaceState") replaced++;
            if (callee === "toolPath") rebuilt++;
            if (callee === "useRouter" || /^router\./.test(callee)) routed.push(callee);
        });
        return {
            deleted,
            added,
            replaced,
            rebuilt,
            readsLocation,
            routed,
            opens,
            gate,
            frame,
            told,
            registration,
            offers,
            handed,
            titled,
            message,
            answers: answers.join(", "),
        };
    };
    const fork = forkFacts(parseFile(FORK));
    check("the fork's dismissal takes exactly its own two keys out of the address", fork.deleted.join(", "), "asked, unwritten");
    check("  and puts nothing in", fork.added.join(", "), "");
    check("  editing the current address rather than rebuilding one", `${fork.readsLocation} ${fork.rebuilt}`, "true 0");
    check("  written with history.replaceState", fork.replaced, 1);
    check("  and never through the router", fork.routed.join(", "), "");
    check("it is told when accountToTell says so", fork.told, 'accountToTell(account, address) === "shortfall"');
    check(
        "  open while it is told and the registration is shut, closed as `Not now` closes it, and unprompted",
        fork.frame,
        "open: told && !registration.open · onClose: notNow · unprompted"
    );
    check("  whose own answer that stops is the same `Not now`", fork.answers, "notNow");
    check("its answer that goes on opens through the one opening rule", fork.registration, "useRegistrationOpening()");
    check(
        "  behind the one gate, in the fork's own words",
        fork.gate,
        "canRegister: canRegister, onOpen: registration.start → COPY.registerOthers(account.unwritten)"
    );
    check(
        "  onto the registration form on this tool, with the count it was handed",
        fork.opens,
        "jobs: jobs, key: registration.opening, onClose: registration.close, open: registration.open, quantity: account.unwritten, tool: { toolName }"
    );
    // ONE VALUE FOR THE WORDS AND THE FORM (#485): the answer names how many it will add, and
    // the dialog it opens starts at that count, so both are handed the same expression.
    check("  naming the count it hands the form, one value for both", `${fork.offers} | ${fork.handed}`, "account.unwritten | account.unwritten");
    check(
        "its title and its sentence, from the account it was handed",
        `${fork.titled} · ${fork.message}`,
        "COPY.shortfallHeading(account.unwritten) · COPY.shortfall(account.asked - account.unwritten)"
    );
    // ANTI-VACUITY: a planted fork doing each of those wrong is seen doing it.
    const plantedFork = forkFacts(
        parseSource(
            "function RegistrationShortfall({ toolRecordId, page, toolName, account, requested, jobs }) {\n" +
                "  const router = useRouter();\n" +
                "  const registration = { open: false };\n" +
                "  const told = account.unwritten > 0;\n" +
                "  const finish = () => {\n" +
                "    const address = new URL(toolPath(toolRecordId, page, []), origin);\n" +
                '    address.searchParams.delete("unwritten");\n' +
                '    address.searchParams.delete("unlogged");\n' +
                '    address.searchParams.set("done", "1");\n' +
                "    router.replace(`${address.pathname}${address.search}`);\n" +
                "  };\n" +
                "  return (<>\n" +
                "    <DialogFrame open={told} onClose={() => {}} title={COPY.shortfallHeading(account.asked)}>\n" +
                "      <DialogMessage>{COPY.shortfall(account.unwritten)}</DialogMessage>\n" +
                "      <Button onClick={finish}>{COPY.doneRegistering}</Button>\n" +
                "      <RegistrationOpener canRegister={true} onOpen={() => {}}>{COPY.registerOthers(account.asked)}</RegistrationOpener>\n" +
                "    </DialogFrame>\n" +
                "    <RegistrationForm open={true} onClose={finish} jobs={jobs} tool={{ toolName: toolRecordId }} quantity={requested} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-fork>"
        )
    );
    check("  a dismissal taking the notice with it is seen", plantedFork.deleted.join(", "), "unwritten, unlogged");
    check("  a key put in is seen", plantedFork.added.join(", "), "done");
    check("  an address rebuilt from the render is seen", `${plantedFork.readsLocation} ${plantedFork.rebuilt}`, "false 1");
    check("  the router is seen", plantedFork.routed.join(", "), "useRouter, router.replace");
    check("  with no history write", plantedFork.replaced, 0);
    check("  a fork told whatever the address says is seen", plantedFork.told, "account.unwritten > 0");
    check(
        "  a frame open over the registration, closed by an answer that answers nothing, and prompted, is seen",
        plantedFork.frame,
        "open: told · onClose: () => {} · prompted"
    );
    check("  an opening kept by itself is seen", plantedFork.registration, "{ open: false }");
    check(
        "  a gate opened on nothing, naming another count, is seen",
        plantedFork.gate,
        "canRegister: true, onOpen: ArrowFunctionExpression → COPY.registerOthers(account.asked)"
    );
    check(
        "  a form opened on another record, another count and always is seen",
        plantedFork.opens,
        "jobs: jobs, onClose: finish, open: true, quantity: requested, tool: { toolName: toolRecordId }"
    );
    check("  the words naming one count and the form handed another are seen", `${plantedFork.offers} | ${plantedFork.handed}`, "account.asked | requested");
    check(
        "  and a title and a sentence counting the wrong things are seen",
        `${plantedFork.titled} · ${plantedFork.message}`,
        "COPY.shortfallHeading(account.asked) · COPY.shortfall(account.unwritten)"
    );

    // THE NOTICE'S HALF (#455, #459). `Got it` is the same act on the other key: the
    // current address, `unlogged` alone out of it, no router. The fork's `asked` and
    // `unwritten` stay, so a reader who takes the notice away is asked the fork's question
    // next. Since #459 it is a dialog told first, closed with `Got it` on the close and on
    // Escape, handing focus to the page's heading, and opening nothing.
    const notice = forkFacts(parseFile(NOTICE));
    check("the notice's dismissal takes exactly `unlogged` out of the address", notice.deleted.join(", "), "unlogged");
    check("  and puts nothing in", notice.added.join(", "), "");
    check("  editing the current address rather than rebuilding one", `${notice.readsLocation} ${notice.rebuilt}`, "true 0");
    check("  written with history.replaceState", notice.replaced, 1);
    check("  never through the router", notice.routed.join(", "), "");
    check("it is told when accountToTell says so", notice.told, 'accountToTell(account, address) === "unlogged"');
    check("  open while it is told, closed as `Got it` closes it, and unprompted", notice.frame, "open: told · onClose: gotIt · unprompted");
    check("  whose one answer is that `Got it`", notice.answers, "gotIt");
    check("  and it opens no registration", `${notice.opens} ${notice.gate}`, "null null");
    // ANTI-VACUITY: a planted notice taking the fork's keys with it, through the router,
    // told whatever the address says, and offering to create them again is seen doing each.
    const plantedNotice = forkFacts(
        parseSource(
            "function RegistrationUnlogged({ account, toolName, jobs }) {\n" +
                "  const router = useRouter();\n" +
                "  const told = account.unlogged.length > 0;\n" +
                "  const dismiss = () => {\n" +
                "    const address = new URL(window.location.href);\n" +
                '    address.searchParams.delete("unlogged");\n' +
                '    address.searchParams.delete("unwritten");\n' +
                "    router.replace(`${address.pathname}${address.search}`);\n" +
                "  };\n" +
                "  return (<>\n" +
                "    <DialogFrame open={told} onClose={dismiss} unprompted><Button onClick={dismiss}>{COPY.gotIt}</Button></DialogFrame>\n" +
                "    <RegistrationForm open={told} onClose={dismiss} jobs={jobs} tool={{ toolName }} quantity={account.unlogged.length} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-notice>"
        )
    );
    check("  a dismissal taking the fork's count with it is seen", plantedNotice.deleted.join(", "), "unlogged, unwritten");
    check("  the router is seen", plantedNotice.routed.join(", "), "useRouter, router.replace");
    check("  a notice told whatever the address says is seen", plantedNotice.told, "account.unlogged.length > 0");
    check(
        "  and an offer to create them again is seen",
        plantedNotice.opens,
        "jobs: jobs, onClose: dismiss, open: told, quantity: account.unlogged.length, tool: { toolName }"
    );

    // THE OPENERS OF THE REGISTRATION DIALOG, ON BOTH SCREENS (#451, #456). A tool's page
    // opens it on that tool and with no count, in the dialog's own title — `Add tools` since
    // #485 — and the list opens it on no tool. Each stands under no condition: a
    // tool with nothing under it keeps its opener, and so does a reader on no job, whom
    // the opener itself tells why it cannot act (0f). What decides that is one predicate,
    // `canRegisterToolItems`, asked by each page and handed down, so no opener answers the
    // reader differently. An opener drawn only beside the list renders this very page on
    // every tool this base holds, so none of that shows in a figure and all of it is read
    // off the source.
    const dialogOpeners = (ast) => {
        const found = [];
        const bindings = new Map();
        const skip = new Set(["type", "start", "end", "loc", "range", "parent"]);
        // The keys under which a node's children render only sometimes.
        const branches = {
            ConditionalExpression: ["consequent", "alternate"],
            LogicalExpression: ["right"],
            IfStatement: ["consequent", "alternate"],
        };
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.init?.type === "CallExpression")
                bindings.set(n.id.name, nameOf(n.init.callee));
        });
        (function visit(node, conditions) {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach((child) => visit(child, conditions));
            if (typeof node.type !== "string") return;
            if (node.type === "JSXOpeningElement" && node.name?.name === "RegistrationDialog") {
                const raw = attributesOf(node, ast).find((a) => a.name === "canRegister")?.value;
                const canRegister = raw?.type === "JSXExpressionContainer" ? raw.expression : raw;
                found.push({
                    handed: dialogProps(node, ast),
                    // What decides whether it may act, followed through a binding the page
                    // asked it into, so a literal and a second predicate both show.
                    asks:
                        canRegister?.type === "CallExpression"
                            ? nameOf(canRegister.callee)
                            : canRegister?.type === "Identifier"
                              ? (bindings.get(canRegister.name) ?? canRegister.name)
                              : nameOf(canRegister ?? {}),
                    conditions,
                });
            }
            for (const key of Object.keys(node)) {
                if (skip.has(key)) continue;
                visit(node[key], conditions + (branches[node.type]?.includes(key) ? 1 : 0));
            }
        })(ast, 0);
        return found;
    };
    // TWO OPENERS EACH SINCE #463, HANDED ONE OBJECT: the head's, under no condition, and an
    // empty list's second one, bordered, under the branch that draws the empty state (1a, 1b).
    const openers = dialogOpeners(parseFile(TOOL_SCREEN).ast);
    check("the tool's page opens the registration dialog from its head, and from an empty list", openers.length, 2);
    check(
        "  on this tool, with no count, in the dialog's own title",
        openers[0]?.handed,
        "canRegister: canRegister, jobs: assignedJobs, opener: TOOL_REGISTRATION_COPY.heading, tool: { toolName: tool.toolName }"
    );
    check("  asking the one predicate every opener asks", openers[0]?.asks, "canRegisterToolItems");
    check("  and under no condition — not the list's, not the reader's", openers[0]?.conditions, 0);
    check(
        "  the empty list's the same opener, bordered, under the empty branch alone",
        `${openers[1]?.handed} | ${openers[1]?.asks} | ${openers[1]?.conditions}`,
        "canRegister: canRegister, jobs: assignedJobs, opener: TOOL_REGISTRATION_COPY.heading, tool: { toolName: tool.toolName }, variant: bordered | canRegisterToolItems | 1"
    );
    const listOpeners = dialogOpeners(parseFile(LIST_SCREEN).ast);
    check("the tool list opens it from its head, and from an empty list", listOpeners.length, 2);
    check(
        "  on no tool, in the same title, with the list's tools to suggest",
        listOpeners[0]?.handed,
        "canRegister: canRegisterToolItems(user, allJobs), jobs: assignedJobsFor(user, allJobs).map(…), opener: TOOL_REGISTRATION_COPY.heading, tools: rows.map(…)"
    );
    check("  asking the same predicate", listOpeners[0]?.asks, "canRegisterToolItems");
    check("  and under no condition either", listOpeners[0]?.conditions, 0);
    check(
        "  the empty list's the same opener, bordered, under the empty branch alone",
        `${listOpeners[1]?.handed} | ${listOpeners[1]?.asks} | ${listOpeners[1]?.conditions}`,
        "canRegister: canRegisterToolItems(user, allJobs), jobs: assignedJobsFor(user, allJobs).map(…), opener: TOOL_REGISTRATION_COPY.heading, tools: rows.map(…), variant: bordered | canRegisterToolItems | 1"
    );
    // THE COUNT BESIDE A SUGGESTED TOOL IS ITS LINK ARRAY'S LENGTH (#456) — the figure its
    // own page heads its list with — and never a sum of statuses, so one word says one
    // number on both screens. Read off the object the list hands the dialog for each tool
    // and off the binding that count comes from, since `rows.map(…)` above reads alike
    // whatever the mapping counts.
    const toolsHanded = (parsed) => {
        let count = null;
        let from = null;
        walk(parsed.ast, (n) => {
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationDialog") {
                const raw = attributesOf(n, parsed.ast).find((a) => a.name === "tools")?.value;
                const tools = raw?.type === "JSXExpressionContainer" ? raw.expression : raw;
                const body = tools?.type === "CallExpression" ? tools.arguments[0]?.body : null;
                const property = body?.type === "ObjectExpression" ? body.properties.find((p) => p.key?.name === "count") : null;
                if (property) count = parsed.source.slice(property.value.start, property.value.end);
            }
            if (n.type === "VariableDeclarator" && n.id?.name === "itemCount")
                from = parsed.source.slice(n.init.start, n.init.end).replace(/\s+/g, " ");
        });
        return `${count} from ${from}`;
    };
    check(
        "  each suggested tool counted by its link array, as its own page counts it",
        toolsHanded(parseFile(LIST_SCREEN)),
        "itemCount[row.id] from Object.fromEntries(tools.map((tool) => [tool.id, tool.toolItems.length]))"
    );
    check(
        "  and a count summed from the statuses is seen (anti-vacuity)",
        toolsHanded(
            parseSource(
                "const itemCount = Object.fromEntries(rows.map((row) => [row.id, row.counts[0].count]));\n" +
                    "const x = <RegistrationDialog tools={rows.map((row) => ({ toolName: row.toolName, count: row.counts[0].count + row.counts[1].count }))} />;\n",
                "<planted-tools>"
            )
        ),
        "row.counts[0].count + row.counts[1].count from Object.fromEntries(rows.map((row) => [row.id, row.counts[0].count]))"
    );
    // ANTI-VACUITY: a planted page carrying an opener in the not-found return, one beside
    // the list only, and one for a reader on a job only is seen doing all three — and the
    // one beside the list is seen handing a record id and a count, saying another word and
    // asking no predicate at all.
    const plantedOpeners = dialogOpeners(
        parseSource(
            "async function renderToolPage() {\n" +
                "  if (!tool) return <RegistrationDialog opener={TOOL_REGISTRATION_COPY.heading} canRegister={canRegister} jobs={assignedJobs} tool={{ toolName: name }} />;\n" +
                "  return (<div>\n" +
                "    {page.total === 0 ? <p /> : <RegistrationDialog opener={TOOL_REGISTRATION_COPY.registerOthers} canRegister={true} jobs={assignedJobs} tool={{ toolName: tool.id }} quantity={page.total} />}\n" +
                "    {canRegisterToolItems(user, jobs) && <RegistrationDialog opener={TOOL_REGISTRATION_COPY.heading} canRegister={canRegister} jobs={assignedJobs} tool={{ toolName: tool.toolName }} />}\n" +
                "  </div>);\n" +
                "}\n",
            "<planted-opener>"
        ).ast
    );
    check("  three openers are seen as three", plantedOpeners.length, 3);
    check(
        "  each under the condition it is drawn beneath",
        plantedOpeners.map((opener) => opener.conditions).join(", "),
        "1, 1, 1"
    );
    check(
        "  a record id, a count and another word are seen handed",
        plantedOpeners[1]?.handed,
        "canRegister: true, jobs: assignedJobs, opener: TOOL_REGISTRATION_COPY.registerOthers, quantity: page.total, tool: { toolName: tool.id }"
    );
    check("  and a literal in place of the predicate is seen", plantedOpeners[1]?.asks, "Literal");

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

    // ── 2d: what a press makes of the selection, and when print acts (#443) ─
    log("");
    log("a box selects one entry, the page box this page, and print acts on what one print takes:");
    // Printed ids typed out, three on this page and one that is not — which is the
    // shape every claim below is about, since a selection outlives a page turn.
    const A = "HYE-TL-260909-001";
    const B = "HYE-TL-260909-002";
    const C = "HYE-TL-260909-003";
    const ELSEWHERE = "HYE-TL-260910-001";
    const thisPage = [A, B, C];

    // ASCENDING ID, WHATEVER ORDER THE BOXES WERE PRESSED IN — the order a run prints in,
    // which was the list's own until #463 turned the list newest first and left the
    // selection as it was. ELSEWHERE is a later day, so it sorts after the page even when
    // it was selected first.
    check("a press adds an entry, in ascending id", toggleToolItem([ELSEWHERE], B).join(), `${B},${ELSEWHERE}`);
    check("  a second press takes it out again", toggleToolItem([B, ELSEWHERE], B).join(), ELSEWHERE);
    check("  and what is left is in ascending id too", toggleToolItem([C, A, B], A).join(), `${B},${C}`);
    // BY THE SEQUENCE AS A NUMBER: a day's thousandth tool item follows its 999th, where
    // a sort of the strings would put `-1000` first.
    check(
        "a four-digit sequence follows a three-digit one",
        toggleToolItem(["HYE-TL-260909-999"], "HYE-TL-260909-1000").join(),
        "HYE-TL-260909-999,HYE-TL-260909-1000"
    );
    check("  and a string that is no id goes last", toggleToolItem(["ABC"], A).join(), `${A},ABC`);

    check("this page with none of it selected", pageSelection([ELSEWHERE], thisPage), "none");
    check("  with some of it", pageSelection([B, ELSEWHERE], thisPage), "some");
    check("  with all of it, whatever else is selected", pageSelection([ELSEWHERE, C, A, B], thisPage), "all");
    check("  and a page with no entries has nothing selected", pageSelection([ELSEWHERE], []), "none");

    check(
        "the page box on a page with none selected adds the page",
        togglePage([ELSEWHERE], thisPage).join(),
        `${A},${B},${C},${ELSEWHERE}`
    );
    check(
        "  on a page partly selected it adds the rest and takes nothing out",
        togglePage([C, ELSEWHERE], thisPage).join(),
        `${A},${B},${C},${ELSEWHERE}`
    );
    check(
        "  on a page all selected it takes this page out and keeps the other",
        togglePage([A, ELSEWHERE, B, C], thisPage).join(),
        ELSEWHERE
    );
    // Two left over, arriving out of order as a hand-typed address can, so the order of
    // what is left is a fact this asserts rather than one a single survivor hides.
    const LATER = "HYE-TL-260911-001";
    check(
        "  and what it keeps is in ascending id",
        togglePage([LATER, A, B, C, ELSEWHERE], thisPage).join(),
        `${ELSEWHERE},${LATER}`
    );

    // NOTHING SELECTED DRAWS NO BAR (#463, 0b), so there is no sentence for it and no reason:
    // the bar comes with the first box pressed.
    const noneSelected = describeSelection([], thisPage);
    check("nothing selected: print does not act", noneSelected.printable, false);
    check("  and there is no bar to say anything", `${noneSelected.count} ${noneSelected.reason}`, "0 null");
    check("one selected: print acts", describeSelection([B], thisPage).printable, true);
    check("  and the bar says how many", TOOL_LIST_COPY.selectedCount(describeSelection([B], thisPage).count), "1 selected");
    // Two on this page and one not, so the two counts differ: with one of each, a count
    // of the entries ON this page would read the same here — the one-selected case
    // above catches that swap too, so this is a second path to the claim.
    const across = describeSelection([A, ELSEWHERE, B], thisPage);
    check(
        "some of them not on this page: it says how many are not, after the count",
        `${TOOL_LIST_COPY.selectedCount(across.count)} · ${TOOL_LIST_COPY.notOnPage(across.notOnPage)}`,
        "3 selected · 1 not on this page"
    );
    check("  and counts them", describeSelection([A, ELSEWHERE, B], thisPage).notOnPage, 1);

    // THE CAP'S TWO SIDES, AT LITERAL SIZES, WITH EACH INPUT'S SIZE ASSERTED FIRST. The
    // boundary this is about is DISTINCT ids after the address is read, so the inputs are
    // built through `readToolItemIds` and counted before anything is asked of them — a
    // fixture that collapsed to fewer ids would otherwise ask about the wrong side of the
    // edge and pass, which is what #442 found a twelve-row fixture doing to a page size.
    const distinctIds = (n) =>
        readToolItemIds(Array.from({ length: n }, (_, at) => `HYE-TL-260909-${String(at + 1).padStart(3, "0")}`));
    const hundred = distinctIds(100);
    const hundredAndOne = distinctIds(101);
    check("a hundred distinct ids read as a hundred", hundred.length, 100);
    check("  and a hundred and one as a hundred and one", hundredAndOne.length, 101);
    check("a selection of a hundred prints", describeSelection(hundred, thisPage).printable, true);
    check("  and one of a hundred and one does not", describeSelection(hundredAndOne, thisPage).printable, false);
    check("  and says why before the control", describeSelection(hundredAndOne, thisPage).reason, "Up to 100 labels per print.");
    check("  where one it takes has no reason", describeSelection(hundred, thisPage).reason, null);
    // The same edge from the address's side: a hundred and one values holding a repeat
    // are a hundred tool items, and print.
    const withRepeat = readToolItemIds([...hundred, hundred[0].toLowerCase()]);
    check("a hundred and one values with one repeat read as a hundred", withRepeat.length, 100);
    check("  and print", describeSelection(withRepeat, thisPage).printable, true);

    // The address a page of this list lives at moved to lib/toolRoutes.js in
    // #348, with every other address on the axis; `offline/tool-routes.mjs`
    // holds it now.

    // ── 2e: the tool list's pages, and the frame both lists are drawn in (#463) ─
    log("");
    log("the tool list pages its rows as a tool's own list does, and both are drawn in one frame:");
    // THE TOOL LIST PAGES AT THE SAME 25 BY THE SAME CLAMP, over rows the page already built:
    // reassembly over the lengths around both edges, and the window both lists share.
    const rowsOf = (n) => Array.from({ length: n }, (_, at) => ({ id: `rec${at}` }));
    const toolLengths = [0, 1, 24, 25, 26, 49, 50, 51];
    const reassembled = toolLengths.filter((n) => {
        const first = pageOfTools(rowsOf(n), 1);
        const pages = Array.from({ length: first.pageCount }, (_, at) => pageOfTools(rowsOf(n), at + 1).rows.map((row) => row.id));
        return pages.flat().join() === rowsOf(n).map((row) => row.id).join() && first.pageCount === Math.max(1, Math.ceil(n / 25));
    });
    check("the tool list's pages are the whole list, at every length around the edges", reassembled.join(), toolLengths.join());
    const second = pageOfTools(rowsOf(40), "2");
    check("  page 2 of 40 shows the 26th to the 40th", `${second.page}/${second.pageCount} ${second.from}–${second.to} of ${second.total}`, "2/2 25–40 of 40");
    check("  a page past the end is the last, and an unreadable one the first", `${pageOfTools(rowsOf(26), "9").page} ${pageOfTools(rowsOf(26), "x").page}`, "2 1");
    const disagreements = [];
    for (const n of [0, 1, 25, 26, 51])
        for (const asked of ["1", "2", "3", "x"]) {
            const tools = pageOfTools(rowsOf(n), asked);
            const items = pageOfToolItems(rowsOf(n).map((row) => row.id), asked);
            if (`${tools.page} ${tools.pageCount} ${tools.from} ${tools.to}` !== `${items.page} ${items.pageCount} ${items.from} ${items.to}`) disagreements.push(`${n}/${asked}`);
        }
    check("  and the two lists' windows agree at every length and page asked", disagreements.join(), "");

    // THE LIST PAGE READS ITS PAGE OFF THE ADDRESS AND DRAWS THAT PAGE'S ROWS, its steps
    // through `toolsPath`, and no pager over an empty list.
    const listScreen = parseFile(LIST_SCREEN);
    let pagedWith = "none";
    walk(listScreen.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.name === "pageOfTools") pagedWith = n.arguments.map((a) => listScreen.source.slice(a.start, a.end)).join(", ");
    });
    check("the tool list cuts its built rows by the page asked for", pagedWith, "rows, sp.page");
    check(
        "  draws the page's rows, and steps through toolsPath",
        `${/\{page\.rows\.map\(\(row\) =>/.test(listScreen.source)} ${propSources(listScreen, "Pager", "previous").join()} ${propSources(listScreen, "Pager", "next").join()}`,
        "true {{ href: page.page > 1 ? toolsPath(page.page - 1) : null, label: COPY.previous }} {{ href: page.page < page.pageCount ? toolsPath(page.page + 1) : null, label: COPY.next }}"
    );
    check(
        "  and draws no pager over an empty list",
        propSources(listScreen, "ListFrame", "footer").map((f) => /^\{\s*rows\.length > 0 && \(\s*<Pager/.test(f)).join(),
        "true"
    );

    // THE TOOL'S LIST FLOATS THE BAR WHILE ANYTHING IS SELECTED, and hands the print control
    // what the selection makes of it, the reason with it.
    const itemList = parseFile(TOOL_ITEM_LIST);
    check(
        "the tool's list shows the bar while anything is selected, and the end room with it",
        `${propSources(itemList, "SelectionBar", "shown").join()} ${propSources(itemList, "ListFrame", "overlayShown").join()} ${/const selecting = summary\.count > 0;/.test(itemList.source)}`,
        "{selecting} {selecting} true"
    );
    check(
        "  and its print control acts on what one print takes, pointing at the reason the bar draws (#495)",
        `${propSources(itemList, "LabelsDialog", "disabled").join()} ${propSources(itemList, "LabelsDialog", "describedBy").join()} ${propSources(itemList, "LabelsDialog", "toolItemIds").join()} ${propSources(itemList, "LabelsDialog", "disabledReason").length}`,
        "{!summary.printable} {summary.reason ? reasonId : undefined} {selection} 0"
    );
    check(
        "  which the bar is handed with the id it draws it under",
        `${propSources(itemList, "SelectionBar", "reason").join()} ${propSources(itemList, "SelectionBar", "reasonId").join()}`,
        "{summary.reason} {reasonId}"
    );
    check(
        "  the page box shows this page all, some or none, by the page box's name",
        `${propSources(itemList, "Checkbox", "checked").join(" | ")} ~ ${propSources(itemList, "Checkbox", "indeterminate").join()} ~ ${propSources(itemList, "Checkbox", "label").join(" | ")}`,
        "{pageState === \"all\"} | {selected} ~ {pageState === \"some\"} ~ {COPY.selectPage} | {COPY.selectToolItem(row.toolItemId)}"
    );
    check(
        "  and both steps carry the selection",
        `${propSources(itemList, "Pager", "previous").join()} ${propSources(itemList, "Pager", "next").join()}`,
        "{{ href: page.page > 1 ? toolPath(toolRecordId, page.page - 1, selection) : null, label: COPY.previous }} {{ href: page.page < page.pageCount ? toolPath(toolRecordId, page.page + 1, selection) : null, label: COPY.next }}"
    );

    // THE FRAME: one lane that holds the rows and stops at its end, a pager whose ground
    // says whether rows run beneath it, and end room that grows by the bar's height.
    const frame = parseFile(LIST_FRAME);
    const frameSource = functionSource(frame, "ListFrame");
    check(
        "the frame marks its root for the column, and scrolls its rows in a lane of their own that stops at its end",
        `${/data-list-frame=""/.test(frameSource)} ${/overflow-y-auto overscroll-y-contain \[scrollbar-gutter:stable\] \$\{SCROLL_LANE\}/.test(frameSource)}`,
        "true true"
    );
    check(
        "  rows run beneath the pager until the lane is at its end",
        /setBeneath\(lane\.scrollTop \+ lane\.clientHeight < lane\.scrollHeight - 1\)/.test(frameSource),
        true
    );
    check(
        "  which is when its ground is the Sticky one under a Band, and plain white with no rule otherwise",
        /beneath \? "border-divider-strong bg-background-translucent backdrop-blur-sm" : "border-transparent bg-white"/.test(frameSource),
        true
    );
    check("  and the rows end on the pager's height, and the bar's too while it stands", /className=\{overlayShown \? END_ROOM_WITH_BAR : END_ROOM\}/.test(frameSource), true);
    const rail = parseFile(RAIL);
    check(
        "the column holding a list scrolls nothing and reserves no lane",
        /sm:has-\[>\[data-list-frame\]\]:overflow-y-hidden sm:has-\[>\[data-list-frame\]\]:\[scrollbar-gutter:auto\]/.test(rail.source),
        true
    );
    const barSource = functionSource(frame, "SelectionBar");
    check(
        "the bar clears the selection on Escape, unless a dialog is open to close first",
        /if \(event\.key !== "Escape" \|\| event\.defaultPrevented \|\| document\.querySelector\("dialog\[open\]"\)\) return;\s*onClear\(\);/.test(barSource),
        true
    );
    check("  and while it does not show it cannot be reached", /inert=\{!shown\}/.test(barSource), true);
    // CENTERED FROM THE LIST'S MIDDLE, IT TAKES ITS CONTENT'S WIDTH (#495): a box set from the
    // middle and left to size itself is held to the half beyond it, which cut a past-100 bar.
    check("  at its content's width, which a box set from the list's middle does not take by itself (#495)", /absolute bottom-full left-1\/2 mb-selection-bar-offset flex w-max -translate-x-1\/2/.test(barSource), true);
    // AN ACTION THE SELECTION IS TOO LARGE FOR SAYS WHY BEFORE IT (0b, #495): 14 before the
    // actions, led by a 16 info mark 6 before it in Ink 3, in a column that opens and closes
    // as the second clause does and keeps its words while it closes.
    check(
        "the bar draws an action's reason 14 before the actions, led by the info mark in Ink 3, 6 from it (#495)",
        [
            /gap-selection-bar-reason-gap whitespace-nowrap pr-gap-lg/.test(barSource),
            /<InfoMark size="size-icon" ring=\{1\.5\} tone="subtle" \/>/.test(barSource),
            /<span id=\{reasonId\} className="text-body-sm text-foreground-subtle">\s*\{lastReason\}/.test(barSource),
        ].join(" "),
        "true true true"
    );
    check(
        "  opening and closing as the second clause does, its words kept while it closes",
        [
            /reason \? "grid-cols-\[1fr\] opacity-100" : "grid-cols-\[0fr\] opacity-0"/.test(barSource),
            /aria-hidden=\{reason \? undefined : true\}/.test(barSource),
            /if \(reason && reason !== lastReason\) setLastReason\(reason\);/.test(barSource),
        ].join(" "),
        "true true true"
    );
    const table = parseFile(LIST_TABLE);
    check(
        "a step at its end is drawn and does not act, and a step with somewhere to go is a link",
        /if \(!href\) \{\s*return \(\s*<button type="button" disabled aria-label=\{label\}/.test(functionSource(table, "PagerStep")) && /<Link href=\{href\} aria-label=\{label\}/.test(functionSource(table, "PagerStep")),
        true
    );
    const checkbox = functionSource(parseFile(CONTROLS), "Checkbox");
    check(
        "the box is the browser's own checkbox under the drawing, named, its mixed state set on the element",
        `${/type="checkbox"/.test(checkbox)} ${/aria-label=\{label\}/.test(checkbox)} ${/if \(box\) box\.indeterminate = indeterminate;/.test(checkbox)}`,
        "true true true"
    );

    // WHAT STANDS OVER WHAT (#501). A row is its own stacking context, so the box it lifts
    // over the link that covers it rises inside the row and stays under the column head; the
    // pager, which the selection bar is drawn in, takes the head's z-index after the lane, so
    // it is the one on top where the two meet; and the rail's Panel covers them all. Until
    // #501 a row was no context of its own, and every row's box — at the head's z-index and
    // later in the document — drew over the head as its row scrolled under it.
    const stackingOf = ({ table: tableFile, frame: frameFile, rail: railFile, controls: controlsFile }) => {
        const constant = (parsed, name) => {
            let value = "";
            walk(parsed.ast, (n) => {
                if (n.type === "VariableDeclarator" && n.id?.name === name && n.init?.type === "Literal") value = String(n.init.value);
            });
            return value.split(/\s+/).filter(Boolean);
        };
        // The classes of the first JSX element under `node` that `picks` takes — a string, or a
        // template's fixed text — with where the element starts in its file.
        const classesOf = (parsed, picks, node = parsed.ast) => {
            let found = null;
            walk(node, (n) => {
                if (found || n.type !== "JSXElement" || !picks(n)) return;
                const value = n.openingElement.attributes.find((a) => a.name?.name === "className")?.value;
                const expression = value?.type === "JSXExpressionContainer" ? value.expression : value;
                const text =
                    expression?.type === "Literal"
                        ? String(expression.value)
                        : expression?.type === "TemplateLiteral"
                          ? expression.quasis.map((q) => q.value.cooked).join(" ")
                          : "";
                found = { tokens: text.split(/\s+/).filter(Boolean), start: n.start };
            });
            return found ?? { tokens: [], start: -1 };
        };
        const named = (name) => (n) => n.openingElement.name?.name === name;
        const holding = (parsed, text) => (n) => parsed.source.slice(n.openingElement.start, n.openingElement.end).includes(text);
        const layer = (tokens) => Number(tokens.find((t) => /^z-\d+$/.test(t))?.slice(2) ?? NaN);
        let checkboxFn = null;
        walk(controlsFile.ast, (n) => {
            if (n.type === "FunctionDeclaration" && n.id?.name === "Checkbox") checkboxFn = n;
        });
        const box = classesOf(controlsFile, named("label"), checkboxFn ?? {});
        const cover = constant(tableFile, "TABLE_ROW_LINK");
        const head = constant(tableFile, "TABLE_HEAD");
        const pager = classesOf(frameFile, holding(frameFile, "PAGER_OVER_ROWS"));
        const lane = classesOf(frameFile, holding(frameFile, "ref={laneRef}"));
        const nav = classesOf(railFile, named("nav"));
        return {
            row: constant(tableFile, "TABLE_ROW").includes("isolate"),
            box: `${box.tokens.includes("relative")} ${layer(box.tokens) > 0} ${cover.includes("after:absolute")} ${cover.some((t) => /(^|:)z-/.test(t))}`,
            head: `${head.includes("sticky")} ${layer(head) > 0}`,
            pager: `${pager.tokens.includes("relative")} ${layer(pager.tokens) === layer(head)} ${lane.start >= 0 && pager.start > lane.start}`,
            panel: layer(nav.tokens) > Math.max(layer(head), layer(pager.tokens)),
        };
    };
    const stack = stackingOf({ table, frame, rail, controls: parseFile(CONTROLS) });
    check("a row is a stacking context of its own, so what it lifts rises inside it and no further (#501)", stack.row, true);
    check("  where the box stands over the link that covers the row, which lifts nothing", stack.box, "true true true false");
    check("the column head holds at the top of the rows, over them", stack.head, "true true");
    check("  the pager over it at its z-index, after the lane, so on top where the two meet", stack.pager, "true true true");
    check("  and the rail's Panel over all of them", stack.panel, true);
    // Anti-vacuity: the reading sees each of those undone in a planted list. The lifted cover
    // is assembled while this runs, so no whole class of it is in a file Tailwind scans.
    const liftedCover = ["after:", "z-10"].join("");
    const plantedStack = stackingOf({
        table: parseSource(
            'export const TABLE_HEAD = "sticky top-0 z-10";\n' +
                'export const TABLE_ROW = "relative box-content";\n' +
                `export const TABLE_ROW_LINK = "after:absolute after:inset-0 ${liftedCover}";`,
            "<planted ListTable>"
        ),
        frame: parseSource(
            "export default function ListFrame() { return <div><div className={`relative z-20 ${PAGER_OVER_ROWS}`} /><div ref={laneRef} /></div>; }",
            "<planted ListFrame>"
        ),
        rail: parseSource('export default function Rail() { return <nav className="absolute z-10" />; }', "<planted Rail>"),
        controls: parseSource('export function Checkbox() { return <label className="flex" />; }', "<planted Controls>"),
    });
    check("  a row that is no context of its own is seen", plantedStack.row, false);
    check("  a box that lifts nothing over a cover that lifts itself is seen", plantedStack.box, "false false true true");
    check("  a pager off the head's layer and before the lane is seen", plantedStack.pager, "true false false");
    check("  and one the rail's Panel does not cover", plantedStack.panel, false);

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
    // THE SWEEP'S CLAIM (#455): nothing here says the noun the design replaced.
    check(
        "no string says `tool item`",
        strings.filter((s) => TOOL_ITEM_NOUN.test(s)).length,
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
    // THE DESIGN'S `13 items` (#455): a tool's own page counts what is under it as items,
    // and heads their column the same way.
    check("one item is singular", TOOL_LIST_COPY.total(1), "1 item");
    check("  and two are plural", TOOL_LIST_COPY.total(2), "2 items");
    check("  and none is plural too", TOOL_LIST_COPY.total(0), "0 items");
    check("  the column over each one's code, the design's since #463", TOOL_LIST_COPY.toolItemLabel, "Tool ID");
    check(
        "  and the head counts each list in its own noun",
        `${TOOL_LIST_COPY.toolNoun(1)} ${TOOL_LIST_COPY.toolNoun(17)} ${TOOL_LIST_COPY.itemNoun(1)} ${TOOL_LIST_COPY.itemNoun(0)}`,
        "tool tools item items"
    );
    // THE TWO EMPTY STATES, which the sweep carried the verb and the noun into. The
    // second names the tool and what is under it, so it says `its items` rather than a
    // second `tool` meaning something else in one sentence.
    check(
        "no tool at all, a heading and a sentence (1a)",
        `${TOOL_LIST_COPY.noToolsHeading} | ${TOOL_LIST_COPY.noTools}`,
        "No tools yet | Each tool shows here with how many are in stock, out and retired."
    );
    check(
        "  and a tool with nothing under it (1b)",
        `${TOOL_LIST_COPY.noToolItemsHeading} | ${TOOL_LIST_COPY.noToolItems}`,
        "No items under this tool | If you were adding some, it stopped before any were saved."
    );
    check(
        "the pager's two figures, and its steps' names",
        `${TOOL_LIST_COPY.range({ from: 26, to: 40, total: 40 })} | ${TOOL_LIST_COPY.pagePosition({ page: 2, pageCount: 2 })} | ${TOOL_LIST_COPY.previous} | ${TOOL_LIST_COPY.next}`,
        "26–40 of 40 | Page 2 of 2 | Previous page | Next page"
    );
    assert(
        "the position names both figures",
        TOOL_LIST_COPY.pagePosition({ page: 2, pageCount: 3 }).includes("2") &&
            TOOL_LIST_COPY.pagePosition({ page: 2, pageCount: 3 }).includes("3")
    );
    // THE SELECTION'S WORDS (#443), AND NONE NAMES WHAT IS SELECTED. They were written
    // while `tool item` was decided against showing with its replacement still open, so
    // they said neither that nor `item`; #455 settled the word and left them alone. The
    // sentences are pinned in 2d; these are the controls'.
    check("the page box, Design's name for it", TOOL_LIST_COPY.selectPage, "Select this page");
    check("  an entry's box, named by its id", TOOL_LIST_COPY.selectToolItem(A), `Select ${A}`);
    check("  the way out", TOOL_LIST_COPY.clearSelection, "Clear selection");
    check("  and the bar's name", TOOL_LIST_COPY.selectionBar, "Selected items");
    check(
        "  and not one of the selection's words says an item, the bar's name aside",
        [
            TOOL_LIST_COPY.selectPage,
            TOOL_LIST_COPY.clearSelection,
            TOOL_LIST_COPY.selectedCount(3),
            TOOL_LIST_COPY.notOnPage(1),
            TOOL_LIST_COPY.printCap(100),
        ].filter((text) => /\bitems?\b/i.test(text)).length,
        0
    );
    assert("the noun matcher finds `tool items`", TOOL_ITEM_NOUN.test("No tools yet. One appears here when somebody registers tool items of it."));
    assert("  and passes the design's `13 items`", !TOOL_ITEM_NOUN.test(TOOL_LIST_COPY.total(13)));

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

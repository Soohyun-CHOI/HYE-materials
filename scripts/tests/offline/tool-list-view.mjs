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
//   shows: that the screen reads one page, and that its page size is its own number
//   rather than the document lists'.
//
//   THE SELECTION IS WHAT A LABEL RUN IS FOR (#443), and it splits the same way.
//   What a press does to it and what the control says are pure functions, held by
//   value at literal sizes on both sides of the print cap; what no value can show is
//   where it lives — that the server never reads it, that the list is handed only the
//   rows the page read, that the print link and both steps are built from it, and
//   that a press rewrites the address without a render — so those are read off the
//   AST of the page and of the list, each beside a planted screen doing it wrong.
//
//   AND A REGISTRATION LANDS HERE (#449), which splits the same way once more. Which
//   page it lands on is `pageHolding`, held by value at the edges a page of
//   twenty-five has inside a hundred, with those edges first read off
//   `pageOfToolItems`; what the page reads for the account it lands with, what it
//   hands the fork, and what the fork's dismissal does to the address are read off
//   the AST beside planted versions doing each wrong. So is the control that opens
//   the form from the page (#451): what it is handed, what it says, and that no
//   condition stands above it.
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
// writes a `Checked Out` row, which the app did not have; #362 wrote one, and a
// browser has shown the figure since.**
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { TOOL_STATUS, TOOL_STATUS_VALUES } from "../../../lib/toolStatus.js";
import { TOOL_ITEM_COPY } from "../../../lib/toolItemView.js";
import {
    TOOL_LIST_COPY,
    TOOL_PAGE_SIZE,
    describeSelection,
    pageHolding,
    pageOfToolItems,
    pageSelection,
    summarizeTools,
    togglePage,
    toggleToolItem,
} from "../../../lib/toolListView.js";
import { MAX_LABELS_PER_REQUEST } from "../../../lib/toolLabelSheet.js";
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
            out.push(value(2), value({ page: 2, pageCount: 3 }));
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

    // WHERE A REGISTRATION LANDS (#449): the page holding the first tool item it wrote,
    // whose position is the length the tool's link array had before the batch. THE
    // INPUTS ARE SEEN TO BE EDGES BEFORE ANYTHING IS ASKED OF `pageHolding` — read off
    // `pageOfToolItems`, the other function that decides where a page begins — so each
    // literal below is a claim about a boundary rather than a number that happens to
    // agree, which is what #442 found a twelve-row fixture failing to be.
    log("");
    log("a registration lands on the page holding the first tool item it wrote:");
    const positions = idsOfLength(100);
    check("position 24 is the last page 1 holds", pageOfToolItems(positions, 1).ids.at(-1), positions[24]);
    check("  and 25 the first page 2 holds", pageOfToolItems(positions, 2).ids[0], positions[25]);
    check(
        "  49 the last of page 2, and 50 the first of page 3",
        `${pageOfToolItems(positions, 2).ids.at(-1)} ${pageOfToolItems(positions, 3).ids[0]}`,
        `${positions[49]} ${positions[50]}`
    );
    check("  and 99 the last of page 4", pageOfToolItems(positions, 4).ids.at(-1), positions[99]);
    for (const [position, want] of [
        [0, 1],
        [24, 1],
        [25, 2],
        [49, 2],
        [50, 3],
        [99, 4],
    ])
        check(`  a tool item at position ${position} is on page ${want}`, pageHolding(position), want);
    // A SECOND PATH TO THE SAME ANSWER: every one of a hundred positions is on the page
    // `pageHolding` names, found through `pageOfToolItems`' own slice rather than its
    // arithmetic — which is what fails a divisor or a base drifting from the list's.
    check(
        "  and every one of a hundred is on the page it names",
        positions.filter((id, position) => !pageOfToolItems(positions, pageHolding(position)).ids.includes(id)).length,
        0
    );
    for (const [raw, why] of [
        [-1, "a negative"],
        [2.5, "a fraction"],
        [undefined, "nothing"],
        ["25", "a string"],
    ])
        check(`  ${why} is page 1`, pageHolding(raw), 1);

    // ── 2b: the screen reads one page, and its list selects among it (#442, #443) ─
    log("");
    log("the tool's screen reads the page it shows and hands the list those rows alone:");
    // TWO CLAIMS REST ON ONE ARGUMENT AND NOTHING HELD IT UNTIL #442. The screen is
    // four operations whatever the tool's size, and its page box selects one page —
    // and both are true only because the read hands `getToolItemsByTool` the page's
    // ids and the list is handed the rows that read returned. Drop `rowIds` and the
    // screen reads every tool item under the tool and offers every one of them to the
    // page box, with no figure on screen to show it. Until #443 the second claim was
    // the print link, built on this page from the same read.
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
        let accountFrom = null;
        let fork = null;
        let notice = null;
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
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationShortfall")
                fork = n.attributes
                    .map((a) => `${a.name?.name}: ${nameOf(a.value?.expression ?? {})}`)
                    .sort()
                    .join(", ");
            // #455: the notice is a component of its own now, since `Got it` is a press.
            if (n.type === "JSXOpeningElement" && n.name?.name === "RegistrationUnlogged")
                notice = n.attributes
                    .map((a) => `${a.name?.name}: ${nameOf(a.value?.expression ?? {})}`)
                    .sort()
                    .join(", ");
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
            if (n.type === "CallExpression" && n.callee?.name === "toolItemLabelsPath") printLinks++;
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
            accountFrom,
            fork,
            notice,
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
    check("  and builds no print link of its own", facts.printLinks, 0);
    // WHAT THE ACCOUNT IS READ THROUGH AND HANDED TO (#449, #455). One reader of the
    // three keys, the fork handed the tool's own name and the two figures that reader
    // returned, and the notice handed that reader's ids — not the address's, which would
    // skip the reading that drops a forged count and spells every id once.
    check(
        "  the account is read through readRegistrationAccount, off the address",
        facts.accountFrom,
        "asked: sp.asked, unlogged: sp.unlogged, unwritten: sp.unwritten"
    );
    check(
        "  the fork is handed the tool's name and those two figures",
        facts.fork,
        "asked: account.asked, toolName: tool.toolName, unwritten: account.unwritten"
    );
    check("  and the notice is handed the account's tool items", facts.notice, "toolItemIds: account.unlogged");
    check("  which the page no longer lists itself", facts.mappedFromAddress, "");
    // ANTI-VACUITY: a planted page reading one key raw, handing the fork a record id and
    // the address's own figures, and handing the notice the address's list — then mapping
    // it as well — is seen doing all of it.
    const plantedHandoff = screenFacts(
        parseSource(
            "async function renderToolPage({ searchParams }) {\n" +
                "  const sp = (await searchParams) ?? {};\n" +
                "  const account = readRegistrationAccount({ unwritten: sp.unwritten });\n" +
                "  return (<>\n" +
                "    <RegistrationShortfall toolName={tool.id} asked={sp.asked} unwritten={sp.unwritten} />\n" +
                "    <RegistrationUnlogged toolItemIds={sp.unlogged} />\n" +
                "    <ul>{sp.unlogged.map((id) => <li key={id}>{id}</li>)}</ul>\n" +
                "  </>);\n" +
                "}\n",
            "<planted-handoff>"
        ).ast
    );
    check("  a reader handed one key is seen so", plantedHandoff.accountFrom, "unwritten: sp.unwritten");
    check(
        "  a fork handed a record id and raw figures is seen so",
        plantedHandoff.fork,
        "asked: sp.asked, toolName: tool.id, unwritten: sp.unwritten"
    );
    check("  a notice handed the address's list is seen so", plantedHandoff.notice, "toolItemIds: sp.unlogged");
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
                "  return <ToolItemList rows={tool.toolItems.map((id) => id)} href={toolItemLabelsPath(picked)} />;\n" +
                "}\n",
            "<planted-screen>"
        ).ast
    );
    check("  a read with no page is seen reading none", plantedScreen.rowIds, "none");
    check("  rows from the whole tool are seen so", plantedScreen.rowsFrom, "tool.toolItems");
    check("  a page reading the selection is seen reading it", plantedScreen.addressReads.join(", "), "id, page");
    check("  and a print link built on the page is seen", plantedScreen.printLinks, 1);

    // THE LIST'S HALF (#443). The selection is read off the address here and nowhere
    // else, and three things about it hold only in the source: the print link is built
    // from it and not from the rows; the page box acts on the rows it was handed and
    // nothing wider; and every address this file writes carries it, through
    // `history.replaceState` and never the router — which is the difference between a
    // press that costs nothing and one that re-renders the page at four operations.
    const listFacts = (ast) => {
        const bindings = new Map();
        let selection = null;
        let readOff = null;
        let printFrom = null;
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
            if (n.type !== "CallExpression") return;
            const callee = nameOf(n.callee);
            if (callee === "toolItemLabelsPath") printFrom = origin(n.arguments[0]);
            if (callee === "togglePage") pageBoxOver = origin(n.arguments[1]);
            if (callee === "toolPath")
                toolPathCalls.push(n.arguments.length === 3 ? nameOf(n.arguments[2]) : `${n.arguments.length} arguments`);
            if (callee === "window.history.replaceState") replaced++;
            if (callee === "useRouter" || callee === "redirect" || /^router\./.test(callee)) routed.push(callee);
        });
        return { selection, readOff, printFrom, pageBoxOver, toolPathCalls, replaced, routed };
    };
    const list = listFacts(parseFile(TOOL_ITEM_LIST).ast);
    check("the list reads its selection through readToolItemIds", list.selection, "selection");
    // `get` would answer with the first id alone, so a selection of three would read as
    // one and print one — a defect no figure on this page shows until print is pressed.
    check("  handed every `id` in the address", list.readOff, 'getAll("id")');
    check("  the print link is built from it", list.printFrom, list.selection);
    check("  the page box acts on the rows the page handed it", list.pageBoxOver, "rows");
    check(
        "  every address it writes carries a selection — the new one, or the current one on a step",
        list.toolPathCalls.join(", "),
        "next, selection, selection"
    );
    check("  written with history.replaceState", list.replaced, 1);
    check("  and never through the router", list.routed.join(", "), "");
    // ANTI-VACUITY: a planted list doing each of those wrong is seen doing it — the
    // print link built from the rows, the page box over a wider list, a step that drops
    // the selection, and the router instead of the history.
    const plantedList = listFacts(
        parseSource(
            "function ToolItemList({ toolRecordId, rows, page, everyId }) {\n" +
                "  const router = useRouter();\n" +
                "  const params = useSearchParams();\n" +
                '  const selection = readToolItemIds(params.get("id"));\n' +
                "  const wider = everyId.map((id) => id);\n" +
                "  const press = () => router.replace(toolPath(toolRecordId, page, togglePage(selection, wider)));\n" +
                "  return (<>\n" +
                "    <Link href={toolItemLabelsPath(rows.map((row) => row.toolItemId))} />\n" +
                "    <Link href={toolPath(toolRecordId, page + 1)} />\n" +
                "  </>);\n" +
                "}\n",
            "<planted-list>"
        ).ast
    );
    check("  a read of the first id alone is seen so", plantedList.readOff, 'get("id")');
    check("  a print link from the rows is seen so", plantedList.printFrom, "rows");
    check("  a page box over a wider list is seen so", plantedList.pageBoxOver, "everyId");
    check("  a step dropping the selection is seen", plantedList.toolPathCalls.join(", "), "CallExpression, 2 arguments");
    check("  and the router is seen", plantedList.routed.join(", "), "useRouter, router.replace");
    check("  with no history write", plantedList.replaced, 0);

    // THE FORK'S HALF (#449, #455). `Not now` has to edit the CURRENT address and take the
    // fork's own two keys out of it: an address rebuilt from anything the render was
    // handed would put back a selection the reader has since changed, and deleting
    // `unlogged` too would take the notice's ids with it. `Create the rest` has to carry
    // the count the fork was handed. None of that moves a figure, so it is read off the
    // source — and the notice's `Got it` below is held the same way.
    const FORK = "app/(tools)/tools/[toolRecordId]/RegistrationShortfall.js";
    const NOTICE = "app/(tools)/tools/[toolRecordId]/RegistrationUnlogged.js";
    const forkFacts = (ast) => {
        const deleted = [];
        const added = [];
        let replaced = 0;
        let rebuilt = 0;
        let readsLocation = false;
        const routed = [];
        let linkArgs = null;
        walk(ast, (n) => {
            if (n.type === "MemberExpression" && nameOf(n) === "window.location.href") readsLocation = true;
            if (n.type !== "CallExpression") return;
            const callee = nameOf(n.callee);
            if (/\.searchParams\.delete$/.test(callee)) deleted.push(n.arguments[0]?.value);
            if (/\.searchParams\.(set|append)$/.test(callee)) added.push(n.arguments[0]?.value);
            if (callee === "window.history.replaceState") replaced++;
            if (callee === "toolPath") rebuilt++;
            if (callee === "useRouter" || /^router\./.test(callee)) routed.push(callee);
            if (callee === "registerPath")
                linkArgs = (n.arguments[0]?.properties ?? []).map((p) => `${p.key?.name}: ${nameOf(p.value)}`).join(", ");
        });
        return { deleted, added, replaced, rebuilt, readsLocation, routed, linkArgs };
    };
    const fork = forkFacts(parseFile(FORK).ast);
    check("the fork's dismissal takes exactly its own two keys out of the address", fork.deleted.join(", "), "asked, unwritten");
    check("  and puts nothing in", fork.added.join(", "), "");
    check("  editing the current address rather than rebuilding one", `${fork.readsLocation} ${fork.rebuilt}`, "true 0");
    check("  written with history.replaceState", fork.replaced, 1);
    check("  and never through the router", fork.routed.join(", "), "");
    check("its link opens the form on this tool and the count it was handed", fork.linkArgs, "toolName: toolName, quantity: unwritten");
    // ANTI-VACUITY: a planted fork doing each of those wrong is seen doing it.
    const plantedFork = forkFacts(
        parseSource(
            "function RegistrationShortfall({ toolRecordId, page, toolName, unwritten, requested }) {\n" +
                "  const router = useRouter();\n" +
                "  const finish = () => {\n" +
                "    const address = new URL(toolPath(toolRecordId, page, []), origin);\n" +
                '    address.searchParams.delete("unwritten");\n' +
                '    address.searchParams.delete("unlogged");\n' +
                '    address.searchParams.set("done", "1");\n' +
                "    router.replace(`${address.pathname}${address.search}`);\n" +
                "  };\n" +
                "  return <Link href={registerPath({ toolName, quantity: requested })} />;\n" +
                "}\n",
            "<planted-fork>"
        ).ast
    );
    check("  a dismissal taking the notice with it is seen", plantedFork.deleted.join(", "), "unwritten, unlogged");
    check("  a key put in is seen", plantedFork.added.join(", "), "done");
    check("  an address rebuilt from the render is seen", `${plantedFork.readsLocation} ${plantedFork.rebuilt}`, "false 1");
    check("  the router is seen", plantedFork.routed.join(", "), "useRouter, router.replace");
    check("  with no history write", plantedFork.replaced, 0);
    check("  and a link carrying another count is seen", plantedFork.linkArgs, "toolName: toolName, quantity: requested");

    // THE NOTICE'S HALF (#455). `Got it` is the same act on the other key: the current
    // address, `unlogged` alone out of it, no router. The fork's `asked` and `unwritten`
    // stay, so a reader who takes the notice away is still asked the fork's question.
    const notice = forkFacts(parseFile(NOTICE).ast);
    check("the notice's dismissal takes exactly `unlogged` out of the address", notice.deleted.join(", "), "unlogged");
    check("  and puts nothing in", notice.added.join(", "), "");
    check("  editing the current address rather than rebuilding one", `${notice.readsLocation} ${notice.rebuilt}`, "true 0");
    check("  written with history.replaceState", notice.replaced, 1);
    check("  never through the router", notice.routed.join(", "), "");
    check("  and it opens no form", notice.linkArgs, null);
    // ANTI-VACUITY: a planted notice taking the fork's keys with it, through the router,
    // and offering to create them again is seen doing each.
    const plantedNotice = forkFacts(
        parseSource(
            "function RegistrationUnlogged({ toolItemIds, toolName }) {\n" +
                "  const router = useRouter();\n" +
                "  const dismiss = () => {\n" +
                "    const address = new URL(window.location.href);\n" +
                '    address.searchParams.delete("unlogged");\n' +
                '    address.searchParams.delete("unwritten");\n' +
                "    router.replace(`${address.pathname}${address.search}`);\n" +
                "  };\n" +
                "  return <Link href={registerPath({ toolName, quantity: toolItemIds.length })} />;\n" +
                "}\n",
            "<planted-notice>"
        ).ast
    );
    check("  a dismissal taking the fork's count with it is seen", plantedNotice.deleted.join(", "), "unlogged, unwritten");
    check("  the router is seen", plantedNotice.routed.join(", "), "useRouter, router.replace");
    check("  and an offer to create them again is seen", plantedNotice.linkArgs, "toolName: toolName, quantity: toolItemIds.length");

    // THE CONTROL THAT REGISTERS MORE OF THIS TOOL (#451). It opens the form with this
    // tool's name and no count, in the registration form's words, and it stands under no
    // condition: a tool with nothing under it keeps it, and so does a reader on no job,
    // whom the form itself tells why it cannot take them. A control drawn only beside the
    // list renders this very page on every tool this base holds, so none of that shows in
    // a figure and all of it is read off the source.
    const registerControls = (ast) => {
        const found = [];
        const skip = new Set(["type", "start", "end", "loc", "range", "parent"]);
        // The keys under which a node's children render only sometimes.
        const branches = {
            ConditionalExpression: ["consequent", "alternate"],
            LogicalExpression: ["right"],
            IfStatement: ["consequent", "alternate"],
        };
        (function visit(node, conditions) {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach((child) => visit(child, conditions));
            if (typeof node.type !== "string") return;
            if (node.type === "JSXElement") {
                const href = node.openingElement.attributes.find((a) => a.name?.name === "href")?.value?.expression;
                if (href?.type === "CallExpression" && nameOf(href.callee) === "registerPath")
                    found.push({
                        handed: (href.arguments[0]?.properties ?? [])
                            .map((p) => `${p.key?.name}: ${nameOf(p.value)}`)
                            .join(", "),
                        says: node.children
                            .filter((child) => child.type !== "JSXText" || child.value.trim())
                            .map((child) => nameOf(child.expression ?? child))
                            .join(", "),
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
    const controls = registerControls(parseFile(TOOL_SCREEN).ast);
    check("the page opens the registration form from one control", controls.length, 1);
    check("  handed this tool's name and no count", controls[0]?.handed, "toolName: tool.toolName");
    check("  in the registration form's words for it", controls[0]?.says, "TOOL_REGISTRATION_COPY.registerMore");
    check("  and under no condition — not the list's, not the reader's", controls[0]?.conditions, 0);
    // ANTI-VACUITY: a planted page carrying the control in the not-found return, beside
    // the list only, and for a reader on a job only is seen doing all three — and the one
    // beside the list is seen handing a record id and a count and saying the heading.
    const plantedControls = registerControls(
        parseSource(
            "async function renderToolPage() {\n" +
                "  if (!tool) return <Link href={registerPath({ toolName: name })}>{TOOL_REGISTRATION_COPY.registerMore}</Link>;\n" +
                "  return (<div>\n" +
                "    {page.total === 0 ? <p /> : <Link href={registerPath({ toolName: tool.id, quantity: page.total })}>{TOOL_REGISTRATION_COPY.heading}</Link>}\n" +
                "    {canRegisterToolItems(user, jobs) && <Link href={registerPath({ toolName: tool.toolName })}>{TOOL_REGISTRATION_COPY.registerMore}</Link>}\n" +
                "  </div>);\n" +
                "}\n",
            "<planted-control>"
        ).ast
    );
    check("  three controls are seen as three", plantedControls.length, 3);
    check(
        "  each under the condition it is drawn beneath",
        plantedControls.map((control) => control.conditions).join(", "),
        "1, 1, 1"
    );
    check(
        "  a record id and a count are seen handed",
        plantedControls[1]?.handed,
        "toolName: tool.id, quantity: page.total"
    );
    check("  and the heading's word is seen", plantedControls[1]?.says, "TOOL_REGISTRATION_COPY.heading");

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

    // THE LIST'S ORDER, WHATEVER ORDER THE BOXES WERE PRESSED IN — oldest first, so a
    // sheet reads the way the list does. ELSEWHERE is a later day, so it sorts after the
    // page even when it was selected first.
    check("a press adds an entry, in the list's order", toggleToolItem([ELSEWHERE], B).join(), `${B},${ELSEWHERE}`);
    check("  a second press takes it out again", toggleToolItem([B, ELSEWHERE], B).join(), ELSEWHERE);
    check("  and what is left is in the list's order too", toggleToolItem([C, A, B], A).join(), `${B},${C}`);
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
        "  and what it keeps is in the list's order",
        togglePage([LATER, A, B, C, ELSEWHERE], thisPage).join(),
        `${ELSEWHERE},${LATER}`
    );

    const noneSelected = describeSelection([], thisPage);
    check("nothing selected: print does not act", noneSelected.printable, false);
    check(
        "  and says the label screen's sentence for it",
        noneSelected.sentence,
        "Nothing is selected, so there is nothing to print."
    );
    check("one selected: print acts", describeSelection([B], thisPage).printable, true);
    check("  and says how many", describeSelection([B], thisPage).sentence, "1 selected");
    // Two on this page and one not, so the two counts differ: with one of each, a count
    // of the entries ON this page would read the same here — the one-selected case
    // above catches that swap too, so this is a second path to the claim.
    check(
        "some of them not on this page: it says how many are not",
        describeSelection([A, ELSEWHERE, B], thisPage).sentence,
        "3 selected, 1 not on this page"
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
    check(
        "  and says why",
        describeSelection(hundredAndOne, thisPage).sentence,
        "101 selected, and one print takes at most 100."
    );
    // The same edge from the address's side: a hundred and one values holding a repeat
    // are a hundred tool items, and print.
    const withRepeat = readToolItemIds([...hundred, hundred[0].toLowerCase()]);
    check("a hundred and one values with one repeat read as a hundred", withRepeat.length, 100);
    check("  and print", describeSelection(withRepeat, thisPage).printable, true);

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
    check("  the column over each one's code", TOOL_LIST_COPY.toolItemLabel, "Item");
    // THE TWO EMPTY STATES, which the sweep carried the verb and the noun into. The
    // second names the tool and what is under it, so it says `its items` rather than a
    // second `tool` meaning something else in one sentence.
    check("no tool at all", TOOL_LIST_COPY.noTools, "No tools yet. One appears here when somebody creates it.");
    check(
        "  and a tool with nothing under it",
        TOOL_LIST_COPY.noToolItems,
        "Nothing is recorded under this tool. Creating writes the tool before its items, so one that failed in between leaves the tool with none."
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
    check("the page box", TOOL_LIST_COPY.selectPage, "Select all on this page");
    check("  an entry's box, named by its id", TOOL_LIST_COPY.selectToolItem(A), `Select ${A}`);
    check("  the way out", TOOL_LIST_COPY.clearSelection, "Clear selection");
    check(
        "  and not one of the selection's words says `item`",
        [
            TOOL_LIST_COPY.selectPage,
            TOOL_LIST_COPY.clearSelection,
            TOOL_LIST_COPY.selected({ count: 3, notOnPage: 1 }),
            TOOL_LIST_COPY.selectionOverCap({ count: 101, cap: 100 }),
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

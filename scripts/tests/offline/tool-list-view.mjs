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
//   it runs over every length around the boundary rather than one.
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
    log(`a page holds ${TOOL_PAGE_SIZE} tool items, and the pages are the whole list:`);

    assert("the size is a whole number of rows", Number.isInteger(TOOL_PAGE_SIZE) && TOOL_PAGE_SIZE > 0);
    // Above 50 a page would cost two `findChildRecords` queries instead of one,
    // which is the only hard boundary on this number — the rest is the reader's.
    assert("  and stays inside one batched read", TOOL_PAGE_SIZE <= 50);

    const idsOfLength = (n) => Array.from({ length: n }, (_, i) => `rec${String(i).padStart(3, "0")}`);
    const lengths = [0, 1, TOOL_PAGE_SIZE - 1, TOOL_PAGE_SIZE, TOOL_PAGE_SIZE + 1, 12, TOOL_PAGE_SIZE * 2, 100];
    for (const n of lengths) {
        const all = idsOfLength(n);
        const first = pageOfToolItems(all, 1);
        check(`  ${n} tool items make ${Math.max(1, Math.ceil(n / TOOL_PAGE_SIZE))} page(s)`, first.pageCount, Math.max(1, Math.ceil(n / TOOL_PAGE_SIZE)));

        // THE ASSERTION THIS FILE IS FOR: every page, in order, is the whole list.
        const reassembled = [];
        for (let p = 1; p <= first.pageCount; p++) reassembled.push(...pageOfToolItems(all, p).ids);
        check(`    and the pages reassemble into it`, reassembled.join(), all.join());
        check(`    with the total stating the whole list`, first.total, n);
    }

    const twelve = idsOfLength(12);
    check("page 1 of twelve holds the first ten", pageOfToolItems(twelve, 1).ids.length, TOOL_PAGE_SIZE);
    check("  and page 2 holds the remaining two", pageOfToolItems(twelve, 2).ids.length, 2);
    check("  which are the last two, in order", pageOfToolItems(twelve, 2).ids.join(), "rec010,rec011");

    log("");
    log("a page nobody can be on resolves to one they can:");
    for (const [raw, want, why] of [
        [undefined, 1, "no parameter at all"],
        ["", 1, "an empty one"],
        ["abc", 1, "one that is not a number"],
        ["-3", 1, "a negative"],
        ["0", 1, "a zero"],
        ["1.5", 1, "a fraction"],
        ["2", 2, "one that exists"],
        ["999", 2, "one past the end"],
    ])
        check(`  ${why} lands on page ${want}`, pageOfToolItems(twelve, raw).page, want);
    check("an empty tool has one page, not none", pageOfToolItems([], 1).pageCount, 1);
    check("  and that page is empty", pageOfToolItems([], 1).ids.length, 0);

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

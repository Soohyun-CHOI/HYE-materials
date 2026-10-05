// What the two tools list screens show (#339) — `/tools`, which is every tool
// with a count per status, and `/tools/[toolRecordId]`, which is one tool's
// tool items a page at a time, which of them a label run is for (#443), and
// which of its pages a registration lands on (#449).
//
// PURE AND OFFLINE-SAFE. It imports lib/toolStatus.js, lib/toolItemView.js — which
// imports lib/toolStatus.js in turn since #376 — and, since #443, lib/toolLabelPage.js
// for what one print takes and lib/idSequence.js for the one reading of a sequence,
// all with the extension spelled out, so
// `scripts/tests/offline/tool-list-view.mjs` pins all of it with no credentials.
// Nothing here reaches lib/airtable/, which is also what lets the tool's list — a
// `"use client"` file — import it.
//
// THE FIELD LABELS COME FROM lib/toolItemView.js RATHER THAN BEING RE-SPELLED
// HERE. `Tool`, `Status` and `Job` name the same three fields the tool item's own
// page names, and `← Tools` is the same way back; a second copy of any of them is
// a second word for one fact the first time somebody rewords one. What is below
// is only what these two screens say and that one does not.
//
// EVERY STRING EITHER SCREEN RENDERS IS IN A COPY CONSTANT AND NONE IS IN JSX,
// which is this axis's arrangement since #338 — a word written into a component
// is invisible to the vocabulary checks and to scripts/screen-strings.mjs, so it
// cannot be swept when a word changes, and it is not Design's to reword in one
// place. The check that comes with this issue is what finally holds it: it reads
// every file under app/(tools)/ and fails on any JSX text at all. **This said the
// constant was `TOOL_LIST_COPY`, which stopped being the whole of it**: the print
// control says the labels' own word (#443), and what a registration says where it
// lands (#449) and the control that opens the form from a tool's page (#451) are
// `TOOL_REGISTRATION_COPY`'s — each is the constant of the screen or the dialog the
// words are about. `TOOL_LIST_COPY` is what these two say of their own.

import { TOOL_STATUS_VALUES } from "./toolStatus.js";
import { TOOL_ITEM_COPY } from "./toolItemView.js";
import { MAX_LABELS_PER_REQUEST } from "./toolLabelPage.js";
import { sequenceOf } from "./idSequence.js";

/**
 * How many rows one page of a tools list holds: a tool's tool items, and since #463 the
 * tools themselves, which 0b pages at the same 25 (`Page of rows`).
 *
 * THE FIRST PAGING IN THIS APP (#339). #326 took its shape for the document lists —
 * the page number in the URL, a screen that says which page it is — and could not
 * take the half that divides the read, which `pageOfToolItems` says why. The tool list
 * divides no read either: it counts every tool item to draw any page (`summarizeTools`),
 * so its pages are a slice of rows already in hand (`pageOfTools`).
 *
 * TWENTY-FIVE, THE DESIGN'S FIGURE FOR THE LIST AS IT DREW IT (#442). It was ten
 * until then: an estimate of a screenful of three short facts at 375px, made before
 * any screen was drawn and recorded as the one number on this axis with nothing
 * behind it. The design's figure is not a measurement either — nobody has held this
 * list with a real warehouse in it — and it is the design's to move again when the
 * list is drawn again, which is why docs/briefs/tools-toolRecordId.md states it.
 *
 * WHAT IS NOT THE DESIGN'S IS THE CEILING, AND THERE ARE TWO. The read: any size up
 * to 50 costs exactly one `findChildRecords` query, which is what keeps the screen at
 * four operations, and a fifty-first row is a second query. The print: the page box
 * selects the tool items on the page it is showing (#443), so this is also how many
 * one press of it adds to a run, and the print control acts only on a run of at most
 * `MAX_LABELS_PER_REQUEST` — so a page larger than that is a page box whose first
 * press leaves the print control refusing. Until #443 the print control sent the
 * page itself, and the order between the two figures held for that reason instead.
 * `offline/tool-list-view.mjs` holds the size under both.
 *
 * IT IS NOT `LIST_PAGE_SIZE`, AND SINCE #442 THE TWO ARE BOTH 25 — WHICH IS THE
 * STRONGEST REASON NOT TO FOLD THEM RATHER THAN A REASON TO. This list's row is three
 * short facts and a press of its page box selects the page for a label run; the
 * document lists filter, search and page rows a gate admitted. This said the list was
 * read at a phone width (#336), which stopped being true when its brief made it a
 * desk's; corrected per #181. Each figure was set for its own list, and the two landing on one
 * number is two decisions agreeing today. Folding them makes a design change to
 * either move the other. **The one way they become one number is a design decision
 * that they are one reader's page**, taken where #258 names the design's values,
 * with this paragraph and the one on `LIST_PAGE_SIZE` changed in the same commit —
 * the check fails a fold made any other way. `/materials` has a 25 of its own too,
 * and that is a bound on what a search asks the base for rather than a page at all.
 */
export const TOOL_PAGE_SIZE = 25;

/**
 * Every tool with its count per status, in the order the list renders them.
 *
 * `tools` is the whole `Tools` table and `toolItems` is every tool item those
 * tools name, read in one batch — which is the arrangement `getAllTools` and
 * `getToolItemsByRecordIds` were written for and the reason `Tools` carries no
 * per-status rollup. docs/notes/tools.md has the operation count and the size at
 * which the rollup becomes the cheaper answer.
 *
 * ALL THREE STATUSES ON EVERY ROW, A ZERO INCLUDED. A count of nothing is a
 * measurement and the app already spells it apart from no measurement at all —
 * an absent `Out` would read as "not known" where `0` reads as "none out". It is
 * also what makes a new status impossible to add silently: the row is built from
 * `TOOL_STATUS_VALUES`, so a fourth value appears here without anyone editing
 * this function, and the check asserts the two agree.
 *
 * NO TOTAL PER TOOL, and the reason is `Retired` rather than the issue's wording.
 * A single figure would have to count a retired tool or not count it, and both
 * readings are wanted — what the company holds, and what it has ever bought. The
 * three counts answer both without choosing.
 *
 * BY NAME, CASE-INSENSITIVELY. `Tools` carries no `Created At` and needs no
 * tiebreak: `upsertTool` refuses a second row whose name matches an existing one
 * ignoring case, so no two names can compare equal here.
 *
 * A TOOL ITEM THAT DID NOT RESOLVE IS COUNTED NOWHERE. `findByRecordIds` returns
 * fewer rows rather than throwing, which its own doc warns about; no path in this
 * app produces a link that does not resolve, and the alternative — throwing —
 * would take the whole list down over one row.
 */
export function summarizeTools(tools, toolItems) {
    const counts = new Map();
    for (const item of toolItems || []) {
        const toolRecordId = item?.tool?.[0];
        if (!toolRecordId) continue;
        if (!counts.has(toolRecordId)) counts.set(toolRecordId, new Map());
        const perStatus = counts.get(toolRecordId);
        perStatus.set(item.status, (perStatus.get(item.status) || 0) + 1);
    }

    return (tools || [])
        .map((tool) => ({
            id: tool.id,
            toolName: tool.toolName,
            counts: TOOL_STATUS_VALUES.map((status) => ({
                status,
                count: counts.get(tool.id)?.get(status) || 0,
            })),
        }))
        .sort((a, b) =>
            String(a.toolName).localeCompare(String(b.toolName), "en", { sensitivity: "base" })
        );
}

/**
 * Which tool items one page of a tool's list holds, and where that page sits.
 *
 * ONE FUNCTION FOR THE SLICE AND THE CLAMP, so no call site can take a page
 * without having resolved which page it is. That is `readQuantity`'s shape one
 * screen over (#338) and it is the same reason: a caller that slices for itself
 * is a caller that can slice past the end and render an empty screen for a page
 * that exists.
 *
 * IT TAKES THE PARENT'S LINK ARRAY AND RETURNS IDS, WHICH IS WHAT DIVIDES THE
 * READ. The page is chosen before anything is fetched, so only the ids on it are
 * read — one `findChildRecords` query, whatever the tool's size — and `total`
 * comes from the array's own length for nothing. **#326 cannot do this half**:
 * most document lists admit rows through `canViewPR`, whose ordered rules are not
 * expressible as a query, so a page of records read from the base is not a page
 * of rows a reader sees. Nothing gates a tool item per row (#337), which is what
 * makes dividing the read correct here and not there.
 *
 * OLDEST FIRST, WHICH IS THE ARRAY'S OWN ORDER. A link array is creation order,
 * and `createToolItems` mints contiguous ids under one lock, so that is also
 * ascending `Tool Item ID` — the number a person reads off a label.
 * `findChildRecords` preserves it, and nothing here sorts. Newest first was the
 * alternative and is wrong for a paged list: every registration would push the
 * rows along, so a link to page 2 would name different tool items tomorrow.
 *
 * AN UNREADABLE PAGE IS PAGE 1 AND A PAGE PAST THE END IS THE LAST ONE. A URL is
 * typed, edited and copied, so the parameter is a request rather than a promise;
 * answering it with an empty screen would show a reader nothing and tell them
 * nothing. A tool with no tool items has one page, which is the empty state
 * rather than page 0 of 0.
 */
export function pageOfToolItems(rowIds, rawPage) {
    const ids = Array.isArray(rowIds) ? rowIds : [];
    const { page, pageCount, from, to } = pageWindow(ids.length, rawPage);
    return { page, pageCount, total: ids.length, from, to, ids: ids.slice(from, to) };
}

/**
 * Which tools one page of the tool list holds (#463), and where that page sits — the
 * same clamp and the same 25 as a tool's own list, over rows the page has already built.
 *
 * A SLICE AND NOT A DIVIDED READ: every tool's three counts need every tool item, so the
 * page reads them all whichever page it draws, and paging changes what is drawn and
 * nothing that is read. Ordered by name before it is cut (`summarizeTools`), so a page's
 * edges move only when a tool is created or renamed.
 */
export function pageOfTools(rows, rawPage) {
    const all = Array.isArray(rows) ? rows : [];
    const { page, pageCount, from, to } = pageWindow(all.length, rawPage);
    return { page, pageCount, total: all.length, from, to, rows: all.slice(from, to) };
}

/**
 * Where page `rawPage` of `total` rows starts and ends, the clamp both lists share: an
 * unreadable page is page 1, one past the end the last, and no rows is one page.
 */
function pageWindow(total, rawPage) {
    const pageCount = Math.max(1, Math.ceil(total / TOOL_PAGE_SIZE));
    const asked = /^\d+$/.test(String(rawPage ?? "").trim()) ? Number(rawPage) : 1;
    const page = Math.min(Math.max(asked, 1), pageCount);
    const from = (page - 1) * TOOL_PAGE_SIZE;
    return { page, pageCount, from, to: Math.min(from + TOOL_PAGE_SIZE, total) };
}

/**
 * Which page of a tool's list holds the tool item at this position of its link array
 * (#449), counting from 0.
 *
 * WHERE A REGISTRATION LANDS. A registration's tool items are appended to the tool's
 * link array, so the first one it wrote sits at the position the array's length had
 * before the batch, and the page holding that position is where what it wrote begins.
 * The action asks this rather than dividing by `TOOL_PAGE_SIZE` itself, so where a
 * page begins is decided in the module that decides it for `pageOfToolItems` above —
 * a design moving the size moves the landing with the list.
 *
 * FROM 0, BECAUSE THAT IS WHAT A LENGTH IS: a tool holding twenty-five already puts
 * its next tool item on page 2. Anything that is not a whole number of 0 or more is
 * page 1, `pageOfToolItems`' answer to a page nobody can be on — no caller passes one.
 */
export function pageHolding(position) {
    if (!Number.isInteger(position) || position < 0) return 1;
    return Math.floor(position / TOOL_PAGE_SIZE) + 1;
}

/**
 * The selection in the list's own order: oldest first, which is ascending `Tool Item ID`.
 *
 * THE SELECTION IS A LIST OF PRINTED IDS AND NOTHING ELSE (#443). It rides in the
 * address as `id`, the parameter `/tool-items/labels` took until #457, so the print
 * control opens the labels' dialog on exactly what is selected and the labels print in
 * the address's order. `lib/toolRoutes.js` reads it off the address
 * (`readToolItemIds`) and writes it back (`toolPath`); the functions below are what a
 * press makes of it in between.
 *
 * KEPT IN THE LIST'S ORDER RATHER THAN THE ORDER IT WAS MADE IN, WHICH A BROWSER
 * DECIDED. In the order it was made in, selecting three and then the page put those
 * three at the head of the sheet and the other nine after them — so a person matching
 * stickers to the tools down the list met them out of order. In this order the labels
 * come off the printer the way the list reads (one to a page since #467, where a sheet
 * read that way before), and one selection is one address whatever order its boxes
 * were pressed in.
 *
 * BY THE ID'S DAY AND THEN ITS SEQUENCE AS A NUMBER, NEVER AS A STRING. `nextSequence`
 * widens past the pad, so a day's thousandth tool item is `-1000` and sorts as text
 * ahead of `-999`; `lib/idSequence.js:sequenceOf` is the one reading of a sequence and
 * #40 orders quotations through it for the same reason. The day sorts as text because
 * its stamp is fixed-width. A string that is no tool item's id goes after every id
 * that is one, in the order it came.
 *
 * AND THIS IS THE LIST'S ORDER ONLY BECAUSE `pageOfToolItems`' PREMISE HOLDS: a link
 * array is creation order and `createToolItems` mints contiguous ids under one lock.
 * The paging already rests on that, so this adds no assumption of its own.
 */
function inListOrder(selection) {
    const keyOf = (toolItemId) => {
        const prefix = toolItemId.slice(0, toolItemId.lastIndexOf("-"));
        return { prefix, sequence: sequenceOf(toolItemId, prefix) };
    };
    return [...selection].sort((a, b) => {
        const left = keyOf(a);
        const right = keyOf(b);
        if (left.sequence === null || right.sequence === null)
            return Number(left.sequence === null) - Number(right.sequence === null);
        if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
        return left.sequence - right.sequence;
    });
}

/** What one press on one entry's box makes of the selection: it adds the tool item, or takes it out. */
export function toggleToolItem(selection, toolItemId) {
    return inListOrder(
        selection.includes(toolItemId)
            ? selection.filter((selected) => selected !== toolItemId)
            : [...selection, toolItemId]
    );
}

/**
 * How much of this page is selected — `none`, `some` or `all` of its entries.
 *
 * THIS PAGE'S OWN ANSWER, WHATEVER IS SELECTED ON ANOTHER. A selection outlives a
 * page turn, so what is selected elsewhere is not this page's to show: the page box
 * answers for the entries in front of the reader, and the sentence beside the print
 * control is what counts the rest. A page with no entries has nothing selected.
 */
export function pageSelection(selection, pageToolItemIds) {
    const here = pageToolItemIds.filter((toolItemId) => selection.includes(toolItemId)).length;
    if (here === 0) return "none";
    return here === pageToolItemIds.length ? "all" : "some";
}

/**
 * What a press of the page box makes of the selection: the rest of this page added,
 * or — when all of it is selected already — this page taken out.
 *
 * IT REACHES THIS PAGE AND NO FURTHER, WHICH IS THE PAGING'S CONSEQUENCE RATHER THAN
 * A CHOICE. The screen reads one page of the tool's link array (`pageOfToolItems`
 * above), and the printed ids of the others are unknown without reading them — so a
 * box selecting the whole tool is the read the paging divided, which is also why
 * `docs/briefs/tools-toolRecordId.md` bars printing all of a tool. What is selected
 * on other pages is kept either way.
 *
 * A PARTLY SELECTED PAGE IS COMPLETED RATHER THAN CLEARED, which is what a box in
 * the mixed state does everywhere else.
 */
export function togglePage(selection, pageToolItemIds) {
    if (pageSelection(selection, pageToolItemIds) === "all")
        return inListOrder(selection.filter((toolItemId) => !pageToolItemIds.includes(toolItemId)));
    return inListOrder([...selection, ...pageToolItemIds.filter((toolItemId) => !selection.includes(toolItemId))]);
}

/**
 * What the selection bar says, and whether its print control acts (0b's Selection bar).
 *
 * NOTHING SELECTED DRAWS NO BAR (#463), where until then a sentence and a control that
 * did not act stood over the list: 0b floats the bar while any row is selected and draws
 * nothing otherwise. What the boxes are for is said by the bar the first press brings.
 * **It still never prints "the page"**: the control sent the page it was on until #443,
 * and the page is one press of the page box away, which that press shows.
 *
 * A SELECTION LARGER THAN ONE PRINT DOES NOT PRINT. One print takes
 * `MAX_LABELS_PER_REQUEST`, and the labels' read refuses a longer run outright (#457), so
 * the control refusing first, with why before it (0f Disabled), is what keeps a press from
 * reaching it. It needs a tool with more tool items than one print takes, selected across
 * pages, and 0b draws no such bar; the reason is this app's.
 *
 * THE COUNT IS THE ADDRESS'S, AND NOTHING WAS READ FOR IT. Every selected id is in the
 * address and this page's are in the rows already drawn, so the count and how many are
 * not on this page cost no operation. An id not on this page is not checked against
 * the base, because checking it is a read; the labels' read makes that read anyway
 * and names any id it cannot find.
 */
export function describeSelection(selection, pageToolItemIds) {
    const count = selection.length;
    const notOnPage = selection.filter((toolItemId) => !pageToolItemIds.includes(toolItemId)).length;
    if (count > MAX_LABELS_PER_REQUEST) {
        return { count, notOnPage, printable: false, reason: TOOL_LIST_COPY.printCap(MAX_LABELS_PER_REQUEST) };
    }
    return { count, notOnPage, printable: count > 0, reason: null };
}

// `toolPagePath` was here until #348 and is `lib/toolRoutes.js:toolPath` now,
// with every other address on the axis. What stays here is the paging RULE —
// which rows a page holds and which page a parameter resolves to; where that
// page lives is an address, and this issue's whole point is that the axis's
// addresses are in one file so the next move is one edit.

/**
 * Every word the two list screens render.
 *
 * THE TOOL'S PAGE HAS NO HEADING WORD — its heading is the tool's name, which is
 * the shape the tool item's page already takes with its printed id and the four
 * document detail screens take with theirs.
 */
export const TOOL_LIST_COPY = {
    // The `Tools` table's name, which is the standing rule for a concept with a
    // table behind it and what `/` already says in the link that leads here. It
    // was written into this page's JSX until #339 and is the last string on the
    // axis that was.
    heading: "Tools",

    // The three field labels this axis already has, named here so a screen reads
    // one constant rather than two. `toolLabel` heads the name column on the
    // list; `statusLabel` and `jobLabel` head the two columns beside a tool
    // item's id.
    toolLabel: TOOL_ITEM_COPY.toolLabel,
    statusLabel: TOOL_ITEM_COPY.statusLabel,
    jobLabel: TOOL_ITEM_COPY.jobLabel,
    backToTools: TOOL_ITEM_COPY.backToTools,

    // The column over a tool item's printed id: `Tool ID`, the design's since #463 (1b).
    // It was `Item` from #455, the design's noun then for what a tool's own page lists;
    // the page still counts `13 items`, and the column names the code each one carries.
    toolItemLabel: "Tool ID",

    // THE ONLY EMPTY STATE THIS AXIS CAN REACH, a heading and a sentence under it (1a).
    // The shared brief's three are "nothing exists yet", "nothing you can see" and
    // "nothing matching your filters"; nothing scopes a tools screen by role or job (#337)
    // and this list has no filters, so the second and third have no producer. The
    // sentence says what the list is for, and the opener under it is how a tool comes to
    // exist.
    noToolsHeading: "No tools yet",
    noTools: "Each tool shows here with how many are in stock, out and retired.",

    // A tool standing with nothing under it, which is reachable rather than
    // theoretical: registration writes the `Tools` row first and creates the tool
    // items after it, and #338 rolls back neither. Said as what happened rather
    // than as an error, the way the tool item page says its own missing history (1b).
    noToolItemsHeading: "No items under this tool",
    noToolItems: "If you were creating some, it stopped before any were saved.",

    // How many rows the list holds, which #326 names as the fact every list in
    // this app is missing: without it nothing on screen says whether a reader is
    // looking at everything or at the beginning of it. It is free here — the
    // parent's link array carries the length — and it is a fact about the LIST
    // rather than about what the company holds, which is why it is a single
    // figure where the tool list deliberately has none. `items` is the design's.
    // The header draws the figure and the noun apart (1a, 1b), so each list's noun is
    // its own; `total` is the two as one string, for a sentence.
    itemNoun: (n) => (n === 1 ? "item" : "items"),
    toolNoun: (n) => (n === 1 ? "tool" : "tools"),
    total: (n) => `${n} ${TOOL_LIST_COPY.itemNoun(n)}`,
    // The pager under either list (1a, 1b): which rows this page shows of how many, and
    // which page of how many, with a step each way that a page at its end draws and
    // does not act. The steps are icons, and these are their names.
    range: ({ from, to, total }) => `${from}–${to} of ${total}`,
    pagePosition: ({ page, pageCount }) => `Page ${page} of ${pageCount}`,
    previous: "Previous page",
    next: "Next page",

    // THE SELECTION'S WORDS (#443), AND NONE OF THEM NAMES WHAT IS SELECTED — the way
    // the document lists' pickers say `N selected` (#324). #455 settled the word,
    // `tool` in a sentence and `item` on this page, and had nothing here to undo.
    //
    // The page box's name, Design's (`docs/notes/design-system.md`, answer 3), which
    // still says it reaches this page and not the tool.
    selectPage: "Select this page",
    // An entry's box, named for the id beside it — an accessible name rather than a
    // second visible copy of the id the row already shows.
    selectToolItem: (toolItemId) => `Select ${toolItemId}`,
    // The selection bar (0b): its name, the count, and the second clause after a dot,
    // which comes only while other pages hold part of the selection, since it is what
    // reconciles the count with a page whose boxes show fewer.
    selectionBar: "Selected items",
    selectedCount: (count) => `${count} selected`,
    notOnPage: (count) => `${count} not on this page`,
    // Before a print control that does not act on a selection one print cannot take.
    printCap: (cap) => `One print takes at most ${cap}.`,
    // Every page's selection at once — the bar's clear and its tooltip. The page box
    // already clears one page, so this is the way out of a selection made on pages the
    // reader is no longer on.
    clearSelection: "Clear selection",

    // The same shape every other detail screen uses for a record it cannot find,
    // and here there is one way to reach it: no tool carries this record id.
    // Nothing on this axis is scoped, so unlike the request, order and invoice
    // screens this refusal answers one state rather than standing in for two.
    notFoundHeading: "Tool not found",
};

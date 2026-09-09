// What the two tools list screens show (#339) — `/tools`, which is every tool
// with a count per status, and `/tools/tool/[toolRecordId]`, which is one tool's
// tool items a page at a time.
//
// PURE AND OFFLINE-SAFE. It imports lib/toolStatus.js and lib/toolItemView.js,
// which import nothing themselves, so `scripts/tests/offline/tool-list-view.mjs`
// pins all of it with no credentials. Nothing here reaches lib/airtable/.
//
// THE FIELD LABELS COME FROM lib/toolItemView.js RATHER THAN BEING RE-SPELLED
// HERE. `Tool`, `Status` and `Job` name the same three fields the tool item's own
// page names, and `← Tools` is the same way back; a second copy of any of them is
// a second word for one fact the first time somebody rewords one. What is below
// is only what these two screens say and that one does not.
//
// EVERY STRING EITHER SCREEN RENDERS IS IN `TOOL_LIST_COPY` AND NONE IS IN JSX,
// which is this axis's arrangement since #338 — a word written into a component
// is invisible to the vocabulary checks and to scripts/screen-strings.mjs, so it
// cannot be swept when a word changes, and it is not Design's to reword in one
// place. The check that comes with this issue is what finally holds it: it reads
// every file under app/tools/ and fails on any JSX text at all.

import { TOOL_STATUS_VALUES } from "./toolStatus.js";
import { TOOL_ITEM_COPY } from "./toolItemView.js";

/**
 * How many tool items one page of a tool's list holds.
 *
 * THE FIRST PAGING IN THIS APP, and #326 is the issue that gives the document
 * lists one. What that issue can take from here is the shape — the page number in
 * the URL, one query per page, a screen that says which page it is — and what it
 * cannot take is the half below, which is a property of this axis rather than a
 * preference. Whether the two sizes should be one number is that issue's to
 * decide: these screens are used at a phone width (#336) and the document lists
 * are used at a monitor, so the two are not obviously the same reader's page.
 *
 * TEN BECAUSE OF THE SMALLEST SCREEN THIS AXIS IS USED ON, and the batch does not
 * decide it: any size up to 50 costs exactly one `findChildRecords` query, so the
 * number is chosen for the reader. A row here is three short facts — the printed
 * id, the status, the job — and ten of them is a screenful at 375px.
 *
 * IT IS A VALUE WITH NO MEASUREMENT BEHIND IT, said plainly because everything
 * else on this axis that looks like a number has one. Nobody has held this list
 * on a phone with a real warehouse in it. It is the first number a design pass
 * should re-decide, which is why docs/briefs/tools-tool-toolRecordId.md states it
 * as a fact whose rendering is open rather than leaving it in this file where the
 * design work cannot see it.
 */
export const TOOL_PAGE_SIZE = 10;

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
    const total = ids.length;
    const pageCount = Math.max(1, Math.ceil(total / TOOL_PAGE_SIZE));

    const asked = /^\d+$/.test(String(rawPage ?? "").trim()) ? Number(rawPage) : 1;
    const page = Math.min(Math.max(asked, 1), pageCount);

    const from = (page - 1) * TOOL_PAGE_SIZE;
    return { page, pageCount, total, ids: ids.slice(from, from + TOOL_PAGE_SIZE) };
}

/** The address of one page of a tool's tool items. */
export function toolPagePath(toolRecordId, page) {
    const base = `/tools/tool/${encodeURIComponent(toolRecordId)}`;
    return page > 1 ? `${base}?page=${page}` : base;
}

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

    // The column over a tool item's printed id. It keeps the modifier where the
    // two beside it do not, because `item` alone names a row of four other tables
    // on this base — the one word this axis may never shorten.
    toolItemLabel: "Tool item",

    // THE ONLY EMPTY STATE THIS AXIS CAN REACH. The shared brief's three are
    // "nothing exists yet", "nothing you can see" and "nothing matching your
    // filters"; nothing scopes a tools screen by role or job (#337) and this list
    // has no filters, so the second and third have no producer. The second
    // sentence says how a tool comes to exist, which is the shape
    // `No purchase orders yet. One is generated automatically …` already has.
    noTools: "No tools yet. One appears here when somebody registers tool items of it.",

    // A tool standing with nothing under it, which is reachable rather than
    // theoretical: registration writes the `Tools` row first and creates the tool
    // items after it, and #338 rolls back neither. Said as what happened rather
    // than as an error, the way the tool item page says its own missing history.
    noToolItems:
        "Nothing is recorded under this tool. A registration writes the tool before it " +
        "writes the tool items, so one that failed in between leaves the tool with none.",

    // How many rows the list holds, which #326 names as the fact every list in
    // this app is missing: without it nothing on screen says whether a reader is
    // looking at everything or at the beginning of it. It is free here — the
    // parent's link array carries the length — and it is a fact about the LIST
    // rather than about what the company holds, which is why it is a single
    // figure where the tool list deliberately has none.
    total: (n) => `${n} tool item${n === 1 ? "" : "s"}`,
    pagePosition: ({ page, pageCount }) => `Page ${page} of ${pageCount}`,
    previous: "Previous",
    next: "Next",

    // The same shape every other detail screen uses for a record it cannot find,
    // and here there is one way to reach it: no tool carries this record id.
    // Nothing on this axis is scoped, so unlike the request, order and invoice
    // screens this refusal answers one state rather than standing in for two.
    notFoundHeading: "Tool not found",
};

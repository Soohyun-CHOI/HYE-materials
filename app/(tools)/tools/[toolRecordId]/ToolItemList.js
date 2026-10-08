"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { Checkbox } from "@/app/components/Controls";
import ListFrame, { SelectionBar } from "@/app/components/ListFrame";
import { Pager, TABLE_HEAD, TABLE_ROW, TABLE_ROW_LINK, TABLE_ROW_SELECTED } from "@/app/components/ListTable";
import { TOOL_LABEL_PAGE_COPY as LABEL_COPY } from "@/lib/toolLabelPage";
import {
    TOOL_LIST_COPY as COPY,
    describeSelection,
    pageSelection,
    togglePage,
    toggleToolItem,
} from "@/lib/toolListView";
import { readToolItemIds, toolItemPath, toolPath } from "@/lib/toolRoutes";
import StatusMark from "../../StatusMark";
import LabelsDialog from "../../tool-items/LabelsDialog";

// 1d's columns: the box, the printed id at 240, the status at 160, and the job.
const COLUMNS = "grid-cols-[var(--size-icon)_var(--width-table-id)_var(--width-table-status)_minmax(0,1fr)]";

// One page of a tool's tool items, drawn as 1d's table (#463): a box on each and one for the
// page in the column head, and the selection bar that opens the labels' dialog on what they
// select (#443, #457), over the pager. The page hands down the breadcrumb and the list's head,
// which this frames with the rows.
//
// THE SELECTION IS READ HERE, OFF THE ADDRESS, AND NOT BY THE PAGE — THE OPPOSITE OF
// #373, WHOSE PRECEDENT DOES NOT CARRY OVER. `/login` reads its destination on the
// server and hands the form a prop (app/login/page.js), and that is right there
// because nothing on that screen changes the value during the render's life. A
// selection changes on every press, and a press must not be a render, so the address
// is rewritten with `window.history.replaceState` and no request is made. A prop read
// on the server would then describe the address the page was RENDERED for, and Next
// keeps that render. Read in the installed 16.2.10's own source rather than off the
// documentation:
//
//   - the patched `replaceState` in `next/dist/client/components/app-router.js` copies
//     the current entry's `__PRIVATE_NEXTJS_INTERNALS_TREE` into the entry replacing it
//     (`copyNextJsInternalHistoryState`) and dispatches `ACTION_RESTORE`, whose reducer
//     (`router-reducer/reducers/restore-reducer.js`) restores that same tree with the
//     `renderedSearch` it was drawn for — so the address moves and the tree does not;
//   - and Back to that entry (`onPopState` → `dispatchTraverseAction`) restores the
//     tree stored in it, which is still the one rendered before the presses.
//
// So a prop would hold the selection the page was rendered with while the address held
// the one the reader made, and the screen would show one run while a reload or a copied
// link opened another. MEASURED IN A BROWSER, with the page's own reading handed down
// as a probe prop for the run and removed after it: two boxes pressed, a tool item
// opened, Back — no request reached the server, and the prop still read no selection
// while the address and this component's boxes carried both. `useSearchParams()` reads
// the router's own URL, which is the address, so they cannot disagree. It needs no
// `Suspense` boundary here, which was #373's other reason for avoiding the hook: this
// route is rendered per request, so the hook has the address on the server too, as
// `/materials`' search box already relies on.
//
// NOT `router.replace`, the other way to rewrite an address without a history entry and
// the one the document lists use: it fetches the page again —
// `docs/notes/deliveries-and-invoices.md` measured one `?_rsc` request per write (#325)
// — and this page is four Airtable operations, so every press would cost four. With
// `replaceState` a press costs none, and a reload, a copied link and a step to another
// page all carry the selection because it is in the address.
//
// THE SERVER NEVER SEES IT, WHICH IS WHAT KEEPS THE PAGE AT FOUR OPERATIONS. The page
// hands this component the rows it read for its own page and nothing more; the ids
// selected on other pages exist only in the address, and this file reaches no reader of
// the base (`offline/client-import-safety.mjs`). The page box therefore reaches this
// page and no further, by construction. **The labels' dialog is where the selection
// is read (#457)**: its print control hands the selection to the dialog's read, which
// is the one request a press of it makes — two operations for a run of fifty — and
// which names any id the address carries that no tool item does.
//
// AN ADDRESS LONG ENOUGH TO BE REFUSED IS POSSIBLE AND HAS NOT BEEN SEEN. Each selected
// id adds 21 bytes, so a page is about half a kilobyte and the most one print takes
// about two; nothing stops a selection growing past what prints — the control refuses
// it and the address keeps it — and Node's default header limit, 16,384 bytes measured
// locally, would refuse the request somewhere around seven hundred. That is a tool with
// that many tool items, selected page by page. If it is ever met, the fix is to stop
// the boxes at what one print takes.
//
// EVERY WORD IS IN `TOOL_LIST_COPY` OR `TOOL_LABEL_PAGE_COPY` AND NONE IS IN JSX, this
// axis's rule since #338, held by `offline/tool-list-view.mjs`.
export default function ToolItemList({ toolRecordId, toolName, rows, page, top, header, children }) {
    const params = useSearchParams();
    const selection = readToolItemIds(params.getAll("id"));
    const pageIds = rows.map((row) => row.toolItemId);
    const pageState = pageSelection(selection, pageIds);
    const summary = describeSelection(selection, pageIds);
    const selecting = summary.count > 0;
    const reasonId = useId();

    // THE ONE WRITE, AND IT IS NOT A NAVIGATION — see the header. It keeps the page
    // the reader is on, resolved rather than as typed.
    const replaceSelection = (next) => window.history.replaceState(null, "", toolPath(toolRecordId, page.page, next));
    const clear = () => replaceSelection([]);

    return (
        <ListFrame
            top={top}
            header={header}
            // Which rows this page shows and which page it is, stated whether or not there
            // is a second one: #326 names "nothing on screen says whether a reader is looking
            // at everything or at the beginning of it" as the defect. Both steps carry the
            // selection.
            footer={
                <Pager
                    range={COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                    position={COPY.pagePosition(page)}
                    previous={{ href: page.page > 1 ? toolPath(toolRecordId, page.page - 1, selection) : null, label: COPY.previous }}
                    next={{ href: page.page < page.pageCount ? toolPath(toolRecordId, page.page + 1, selection) : null, label: COPY.next }}
                />
            }
            // The bar comes with the first box pressed and goes with the last (0b): the count,
            // how many are on other pages, the way out, and the print control, which opens the
            // labels' dialog on the selection as it stands, in ascending id, under this
            // tool's name (#457) — and says why it does not act on more than one print takes,
            // in a column of the bar's own that the control points at (#495).
            overlay={
                <SelectionBar
                    shown={selecting}
                    label={COPY.selectionBar}
                    count={summary.count}
                    notOnPage={summary.notOnPage}
                    words={{ count: COPY.selectedCount, notOnPage: COPY.notOnPage }}
                    clearLabel={COPY.clearSelection}
                    onClear={clear}
                    reason={summary.reason}
                    reasonId={reasonId}
                >
                    <LabelsDialog
                        title={LABEL_COPY.openFromTool}
                        toolName={toolName}
                        toolItemIds={selection}
                        disabled={!summary.printable}
                        describedBy={summary.reason ? reasonId : undefined}
                    />
                </SelectionBar>
            }
            overlayShown={selecting}
        >
            <div role="table" aria-label={toolName}>
                {/* This page's box: its state is this page's alone, and a partly selected
                    page shows as mixed, which is a DOM property with no attribute. */}
                <div role="row" className={`${TABLE_HEAD} ${COLUMNS}`}>
                    <span role="columnheader" className="flex self-center">
                        <Checkbox
                            label={COPY.selectPage}
                            checked={pageState === "all"}
                            indeterminate={pageState === "some"}
                            onChange={() => replaceSelection(togglePage(selection, pageIds))}
                        />
                    </span>
                    <span role="columnheader">{COPY.toolItemLabel}</span>
                    <span role="columnheader">{COPY.statusLabel}</span>
                    <span role="columnheader">{COPY.jobLabel}</span>
                </div>
                {/* Newest first, the link array turned over by `pageOfToolItems` (#463).
                    Nothing here sorts. */}
                {rows.map((row) => {
                    const selected = selection.includes(row.toolItemId);
                    return (
                        <div key={row.id} role="row" className={`${TABLE_ROW} ${COLUMNS} ${selected ? TABLE_ROW_SELECTED : ""}`}>
                            <span role="cell" className="flex self-center">
                                <Checkbox
                                    label={COPY.selectToolItem(row.toolItemId)}
                                    checked={selected}
                                    onChange={() => replaceSelection(toggleToolItem(selection, row.toolItemId))}
                                />
                            </span>
                            <span role="cell" className="min-w-0 truncate font-id text-body-sm tracking-id">
                                <Link href={toolItemPath(row.toolItemId)} className={TABLE_ROW_LINK}>
                                    {row.toolItemId}
                                </Link>
                            </span>
                            <span role="cell" className="flex items-baseline gap-gap">
                                <StatusMark status={row.status} />
                                {row.status}
                            </span>
                            <span role="cell" className="min-w-0 truncate">
                                {row.jobCode}
                            </span>
                        </div>
                    );
                })}
            </div>
            {children}
        </ListFrame>
    );
}

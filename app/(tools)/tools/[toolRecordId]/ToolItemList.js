"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TOOL_LABEL_SHEET_COPY as SHEET_COPY } from "@/lib/toolLabelSheet";
import {
    TOOL_LIST_COPY as COPY,
    describeSelection,
    pageSelection,
    togglePage,
    toggleToolItem,
} from "@/lib/toolListView";
import { readToolItemIds, toolItemLabelsPath, toolItemPath, toolPath } from "@/lib/toolRoutes";

// One page of a tool's tool items, a box on each and one for the page, and the print
// control that sends what they select (#443).
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
// page and no further, by construction.
//
// AN ADDRESS LONG ENOUGH TO BE REFUSED IS POSSIBLE AND HAS NOT BEEN SEEN. Each selected
// id adds 21 bytes, so a page is about half a kilobyte and the most one print takes
// about two; nothing stops a selection growing past what prints — the control refuses
// it and the address keeps it — and Node's default header limit, 16,384 bytes measured
// locally, would refuse the request somewhere around seven hundred. That is a tool with
// that many tool items, selected page by page. If it is ever met, the fix is to stop
// the boxes at what one print takes.
//
// EVERY WORD IS IN `TOOL_LIST_COPY` OR `TOOL_LABEL_SHEET_COPY` AND NONE IS IN JSX, this
// axis's rule since #338, held by `offline/tool-list-view.mjs`.
export default function ToolItemList({ toolRecordId, rows, page, pageCount }) {
    const params = useSearchParams();
    const selection = readToolItemIds(params.getAll("id"));
    const pageIds = rows.map((row) => row.toolItemId);
    const pageState = pageSelection(selection, pageIds);
    const summary = describeSelection(selection, pageIds);

    // THE ONE WRITE, AND IT IS NOT A NAVIGATION — see the header. It keeps the page
    // the reader is on, resolved rather than as typed.
    const replaceSelection = (next) =>
        window.history.replaceState(null, "", toolPath(toolRecordId, page, next));

    return (
        <>
            {/* The sentence, the way out and the control stand together (#443). The
                control is drawn when it does not act, because it is what says the
                boxes are for printing; the way out is absent with nothing to clear. */}
            <p>{summary.sentence}</p>
            {summary.count > 0 && (
                <button type="button" onClick={() => replaceSelection([])}>
                    {COPY.clearSelection}
                </button>
            )}
            {summary.printable ? (
                <Link href={toolItemLabelsPath(selection)}>{SHEET_COPY.openFromTool}</Link>
            ) : (
                <span role="link" aria-disabled="true">
                    {SHEET_COPY.openFromTool}
                </span>
            )}

            {/* This page's box: its state is this page's alone, and a partly selected
                page shows as mixed, which is a DOM property with no attribute. */}
            <p>
                <label>
                    <input
                        type="checkbox"
                        checked={pageState === "all"}
                        ref={(box) => {
                            if (box) box.indeterminate = pageState === "some";
                        }}
                        onChange={() => replaceSelection(togglePage(selection, pageIds))}
                    />
                    {COPY.selectPage}
                </label>
            </p>

            {/* Oldest first, which is the link array's own order and so ascending
                `Tool Item ID` — the number a person reads off a label. Nothing sorts. */}
            <ol>
                {rows.map((row) => (
                    <li key={row.id}>
                        <input
                            type="checkbox"
                            aria-label={COPY.selectToolItem(row.toolItemId)}
                            checked={selection.includes(row.toolItemId)}
                            onChange={() => replaceSelection(toggleToolItem(selection, row.toolItemId))}
                        />
                        <dl>
                            <div>
                                <dt>{COPY.toolItemLabel}</dt>
                                <dd>
                                    <Link href={toolItemPath(row.toolItemId)}>{row.toolItemId}</Link>
                                </dd>
                            </div>
                            <div>
                                <dt>{COPY.statusLabel}</dt>
                                <dd>{row.status}</dd>
                            </div>
                            <div>
                                <dt>{COPY.jobLabel}</dt>
                                <dd>{row.jobCode}</dd>
                            </div>
                        </dl>
                    </li>
                ))}
            </ol>

            {/* Which page this is, stated whether or not there is a second one: #326
                names "nothing on screen says whether a reader is looking at everything
                or at the beginning of it" as the defect. The two steps are absent at
                the ends rather than drawn dead, and both carry the selection. */}
            <p>{COPY.pagePosition({ page, pageCount })}</p>
            {page > 1 && <Link href={toolPath(toolRecordId, page - 1, selection)}>{COPY.previous}</Link>}
            {page < pageCount && <Link href={toolPath(toolRecordId, page + 1, selection)}>{COPY.next}</Link>}
        </>
    );
}

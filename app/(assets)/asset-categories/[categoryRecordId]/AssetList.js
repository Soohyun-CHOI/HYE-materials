"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { Checkbox } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import Instant from "@/app/components/Instant";
import ListFrame, { SelectionBar } from "@/app/components/ListFrame";
import { Pager, TABLE_HEAD, TABLE_ROW, TABLE_ROW_LINK, TABLE_ROW_SELECTED } from "@/app/components/ListTable";
import { ASSET_LABEL_PAGE_COPY as LABEL_COPY } from "@/lib/assetLabelPage";
import {
    ASSET_LIST_COPY as COPY,
    describeSelection,
    pagerPosition,
    pageSelection,
    togglePage,
    toggleAsset,
} from "@/lib/assetListView";
import { readAssetIds, assetPath, assetCategoryPath } from "@/lib/assetRoutes";
import { DAY_FORMAT } from "@/lib/format";
import StatusMark from "../../StatusMark";
import LabelsDialog from "../../assets/LabelsDialog";

// 1d's columns since #520: the box, the printed id at 240, the status taking the room left —
// and after an `Out` who holds it — and the day each item last changed at 120. The status
// stood at 160 with the job after it from #463 until 1d drew the day in the job's place.
const COLUMNS = "grid-cols-[var(--size-icon)_var(--width-table-id)_minmax(0,1fr)_var(--width-table-date)]";
// The same three for a reader who selects nothing (#506), with no box to hold room for, as 1d
// draws the list for a reader with no role.
const COLUMNS_WITHOUT_BOX = "grid-cols-[var(--width-table-id)_minmax(0,1fr)_var(--width-table-date)]";

// One page of a category's assets, drawn as 1d's table (#463): a box on each and one for the
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
// as a probe prop for the run and removed after it: two boxes pressed, an asset
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
// — and this page is five Airtable operations since #520, so every press would cost five. With
// `replaceState` a press costs none, and a reload, a copied link and a step to another
// page all carry the selection because it is in the address.
//
// THE SERVER NEVER SEES IT, WHICH IS WHAT KEEPS THE PAGE AT FIVE OPERATIONS. The page
// hands this component the rows it read for its own page and nothing more; the ids
// selected on other pages exist only in the address, and this file reaches no reader of
// the base (`offline/client-import-safety.mjs`). The page box therefore reaches this
// page and no further, by construction. **The labels' dialog is where the selection
// is read (#457)**: its print control hands the selection to the dialog's read, which
// is the one request a press of it makes — two operations for a run of fifty — and
// which names any id the address carries that no asset does.
//
// AN ADDRESS LONG ENOUGH TO BE REFUSED IS POSSIBLE AND HAS NOT BEEN SEEN. Each selected
// id adds 21 bytes, so a page is about half a kilobyte and the most one print takes
// about two; nothing stops a selection growing past what prints — the control refuses
// it and the address keeps it — and Node's default header limit, 16,384 bytes measured
// locally, would refuse the request somewhere around seven hundred. That is a category with
// that many assets, selected page by page. If it is ever met, the fix is to stop
// the boxes at what one print takes.
//
// EVERY WORD IS IN `ASSET_LIST_COPY` OR `ASSET_LABEL_PAGE_COPY` AND NONE IS IN JSX, this
// axis's rule since #338, held by `offline/asset-list-view.mjs`.
//
// A READER WHO PRINTS NO LABELS SELECTS NOTHING (#506). `selects` is the page's answer to
// whether this reader is a site manager, and without it the list draws no box on a row or
// in the column head, and no selection bar — so there is no run to print and no `Escape`
// to clear one — and it reads no selection off the address either, so a copied link's
// `id` neither marks a row nor rides the pager's steps.
//
// THE JOB THE LIST STANDS ON RIDES EVERY WRITE (#509, #520). `job` is the page's, resolved
// from the address by `assetListScope` — a job the reader may not stand on is the first of
// theirs — and a press and a step keep it, so the address goes on naming the list the rows
// came from.
export default function AssetList({ categoryRecordId, itemName, selects, rows, page, job = null, top, header, children }) {
    const params = useSearchParams();
    const selection = selects ? readAssetIds(params.getAll("id")) : [];
    const columns = selects ? COLUMNS : COLUMNS_WITHOUT_BOX;
    const pageIds = rows.map((row) => row.assetId);
    const pageState = pageSelection(selection, pageIds);
    const summary = describeSelection(selection, pageIds);
    const selecting = summary.count > 0;
    const reasonId = useId();

    // THE ONE WRITE, AND IT IS NOT A NAVIGATION — see the header. It keeps the page
    // the reader is on, resolved rather than as typed.
    const replaceSelection = (next) => window.history.replaceState(null, "", assetCategoryPath(categoryRecordId, page.page, next, { job }));
    const clear = () => replaceSelection([]);

    return (
        <ListFrame
            top={top}
            header={header}
            // Which rows this page shows of how many, stated whether or not there is a second
            // page: #326 names "nothing on screen says whether a reader is looking at everything
            // or at the beginning of it" as the defect. Which page it is and the steps stand only
            // past one page (0b, #519). Both steps carry the selection.
            footer={
                <Pager
                    range={COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                    position={pagerPosition(page)}
                    previous={{ href: page.page > 1 ? assetCategoryPath(categoryRecordId, page.page - 1, selection, { job }) : null, label: COPY.previous }}
                    next={{ href: page.page < page.pageCount ? assetCategoryPath(categoryRecordId, page.page + 1, selection, { job }) : null, label: COPY.next }}
                />
            }
            // The bar comes with the first box pressed and goes with the last (0b): the count,
            // how many are on other pages, the way out, and the print control, which opens the
            // labels' dialog on the selection as it stands, in ascending id, under this
            // category's name (#457) — and says why it does not act on more than one print takes,
            // in a column of the bar's own that the control points at (#495).
            overlay={
                selects ? (
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
                            title={LABEL_COPY.openFromCategory}
                            itemName={itemName}
                            assetIds={selection}
                            disabled={!summary.printable}
                            describedBy={summary.reason ? reasonId : undefined}
                        />
                    </SelectionBar>
                ) : null
            }
            overlayShown={selecting}
        >
            <div role="table" aria-label={itemName}>
                {/* This page's box: its state is this page's alone, and a partly selected
                    page shows as mixed, which is a DOM property with no attribute. */}
                <div role="row" className={`${TABLE_HEAD} ${columns}`}>
                    {selects && (
                        <span role="columnheader" className="flex self-center">
                            <Checkbox
                                label={COPY.selectPage}
                                checked={pageState === "all"}
                                indeterminate={pageState === "some"}
                                onChange={() => replaceSelection(togglePage(selection, pageIds))}
                            />
                        </span>
                    )}
                    <span role="columnheader">{COPY.assetIdLabel}</span>
                    <span role="columnheader">{COPY.statusLabel}</span>
                    <span role="columnheader">{COPY.updatedLabel}</span>
                </div>
                {/* Newest first, the link array turned over by `pageOfAssets` (#463).
                    Nothing here sorts. */}
                {rows.map((row) => {
                    const selected = selection.includes(row.assetId);
                    return (
                        <div key={row.id} role="row" className={`${TABLE_ROW} ${columns} ${selected ? TABLE_ROW_SELECTED : ""}`}>
                            {selects && (
                                <span role="cell" className="flex self-center">
                                    <Checkbox
                                        label={COPY.selectAsset(row.assetId)}
                                        checked={selected}
                                        onChange={() => replaceSelection(toggleAsset(selection, row.assetId))}
                                    />
                                </span>
                            )}
                            <span role="cell" className="min-w-0 truncate font-id text-body-sm tracking-id">
                                <Link href={assetPath(row.assetId)} className={TABLE_ROW_LINK}>
                                    {row.assetId}
                                </Link>
                            </span>
                            {/* The status, and after an `Out` who holds it, behind 0e's dot in
                                Ink 2 (1d, #520) — the value only that state has, which the
                                item's own page says beside its status too. Centered in the
                                row as 1d draws it: on the row's baseline its mark lifted the
                                word half a pixel (#522). */}
                            <span role="cell" className="flex min-w-0 items-baseline gap-gap self-center">
                                <StatusMark status={row.status} />
                                <span className="flex min-w-0 items-baseline whitespace-nowrap">
                                    <span className="shrink-0">{row.status}</span>
                                    {row.holder && (
                                        <>
                                            <Dot />
                                            <span className="min-w-0 truncate text-foreground-muted">{row.holder}</span>
                                        </>
                                    )}
                                </span>
                            </span>
                            {/* The day it last changed, in the reader's own zone (#374) and
                                Ink 2, the year written out (#520); nothing for an item whose
                                log holds no row. */}
                            <span role="cell" className="text-foreground-muted">
                                <Instant at={row.updatedAt} format={DAY_FORMAT} />
                            </span>
                        </div>
                    );
                })}
            </div>
            {children}
        </ListFrame>
    );
}

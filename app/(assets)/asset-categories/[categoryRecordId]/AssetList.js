"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { Button, Checkbox } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import Icon from "@/app/components/Icon";
import Instant from "@/app/components/Instant";
import ListFrame, { SelectionBar } from "@/app/components/ListFrame";
import RegistrationAdded from "./RegistrationAdded";
import { Pager, TABLE_HEAD, TABLE_ROW, TABLE_ROW_LINK, TABLE_ROW_SELECTED } from "@/app/components/ListTable";
import { useTooltip } from "@/app/components/Tooltip";
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
import { LabelRunFrame, useLabelRun } from "../../assets/LabelsDialog";

// 1d's columns since the files of 2026-11-04's afternoon (#607): the box, the printed id at 152 and
// the serial number at 160 after it, the status — and after an `Out` who holds it — taking the room
// left from 240, the note's mark in a 16 of its own under no head, and the day each item last changed
// at 120 — 0b's rule, a fixed column the longest value the base holds and 12, rounded up to 8, and a
// serial number's 160 since its length is its maker's. From #601 the id stood at 144, the number at
// 128 and the status at 240, and the note's words took the room left; the id stood at 240 from #533.
// The status took the room left from #520 to #601, and stood at 160 with the job after it from #463.
const COLUMNS =
    "grid-cols-[var(--size-icon)_var(--width-table-id)_var(--width-table-serial)_minmax(var(--width-table-status),1fr)_var(--size-icon)_var(--width-table-date)]";
// The same four for a reader who selects nothing (#506), with no box to hold room for, as 1d
// draws the list for a reader with no role.
const COLUMNS_WITHOUT_BOX =
    "grid-cols-[var(--width-table-id)_var(--width-table-serial)_minmax(var(--width-table-status),1fr)_var(--size-icon)_var(--width-table-date)]";
// On all jobs (1d, #548), the job each item is on at 96 after its serial number, the status
// giving up the room, as 1d draws it. Each a literal, for the stylesheet.
const COLUMNS_WITH_JOB =
    "grid-cols-[var(--size-icon)_var(--width-table-id)_var(--width-table-serial)_var(--width-table-job)_minmax(var(--width-table-status),1fr)_var(--size-icon)_var(--width-table-date)]";
const COLUMNS_WITH_JOB_WITHOUT_BOX =
    "grid-cols-[var(--width-table-id)_var(--width-table-serial)_var(--width-table-job)_minmax(var(--width-table-status),1fr)_var(--size-icon)_var(--width-table-date)]";

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
// hands this component the rows of its own page and nothing more — it reads every item of the
// kind on the scope since #540, to sort them, and cuts the page before handing them on; the ids
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
// A READER WHO PRINTS NO LABELS HERE SELECTS NOTHING (#506, #597). `selects` is the page's
// answer to whether this reader is a site manager on the job the list stands on
// (`listRecording`) — never on another job's list or on all jobs — and without it the list
// draws no box on a row or in the column head, and no selection bar — so there is no run to print and no `Escape`
// to clear one — and it reads no selection off the address either, so a copied link's
// `id` neither marks a row nor rides the pager's steps.
//
// THE ORDER THE PAGE WAS CUT IN RIDES EVERY WRITE TOO (#540): `sort`, the page's reading of the
// address, so a box and a step keep the rows in the order the reader chose.
//
// THE JOB THE LIST STANDS ON RIDES EVERY WRITE (#509, #520). `job` is the page's, resolved
// from the address by `assetListScope` — a job the list does not offer is where it starts — and
// a press and a step keep it, so the address goes on naming the list the rows
// came from. **It may be all jobs (#548)**, and then `showsJob` draws each row's
// job in a column of its own, as 1d draws it on `All jobs` — with no box since #597, where a
// selection there held items on several jobs and one print took them together.
export default function AssetList({ categoryRecordId, itemName, selects, showsJob = false, rows, page, job = null, sort = null, top, header, landing = null, children }) {
    const params = useSearchParams();
    const selection = selects ? readAssetIds(params.getAll("id")) : [];
    const columns = showsJob ? (selects ? COLUMNS_WITH_JOB : COLUMNS_WITH_JOB_WITHOUT_BOX) : selects ? COLUMNS : COLUMNS_WITHOUT_BOX;
    // A row on loan to another job carries no box (#598), so the page's box selects the rest.
    const pageIds = rows.filter((row) => row.loanedTo === null || row.loanedTo === undefined).map((row) => row.assetId);
    const pageState = pageSelection(selection, pageIds);
    const summary = describeSelection(selection, pageIds);
    const selecting = summary.count > 0;
    const reasonId = useId();
    // A cut serial number shows whole above its cell, as a cut catalog cell does, and a note above
    // its mark (0n, #607).
    const tooltip = useTooltip({ placement: "above" });
    // The labels' dialog the bar's control opens (#457), held here and drawn outside the bar, so a
    // refusal that draws the page again without the bar leaves it standing (#616).
    const labels = useLabelRun();

    // THE ONE WRITE, AND IT IS NOT A NAVIGATION — see the header. It keeps the page
    // the reader is on, resolved rather than as typed.
    const replaceSelection = (next) => window.history.replaceState(null, "", assetCategoryPath(categoryRecordId, page.page, next, { job, sort }));
    const clear = () => replaceSelection([]);

    return (
        <>
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
                        previous={{ href: page.page > 1 ? assetCategoryPath(categoryRecordId, page.page - 1, selection, { job, sort }) : null, label: COPY.previous }}
                        next={{ href: page.page < page.pageCount ? assetCategoryPath(categoryRecordId, page.page + 1, selection, { job, sort }) : null, label: COPY.next }}
                    />
                }
                // The bar comes with the first box pressed and goes with the last (0b): the count,
                // how many are on other pages, the way out, and the print control, which opens the
                // labels' dialog on the selection as it stands, in ascending id, under this
                // category's name (#457) — and says why it does not act on more than one print takes,
                // in a column of the bar's own that the control points at (#495).
                // A registration that wrote everything says so over the bar for a moment (1c, #617).
                overlay={
                    selects ? (
                        <>
                        {landing && <RegistrationAdded selected={selection} unwritten={landing.unwritten} unlogged={landing.unlogged} />}
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
                            <Button unavailable={!summary.printable} describedBy={summary.reason ? reasonId : undefined} onClick={() => labels.press(selection)}>
                                {LABEL_COPY.openFromCategory}
                            </Button>
                        </SelectionBar>
                        </>
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
                        <span role="columnheader">{COPY.serialLabel}</span>
                        {showsJob && <span role="columnheader">{COPY.jobLabel}</span>}
                        <span role="columnheader">{COPY.statusLabel}</span>
                        {/* The note's column stands under no head (0n, #607); its name is for assistive tech. */}
                        <span role="columnheader">
                            <span className="sr-only">{COPY.noteLabel}</span>
                        </span>
                        <span role="columnheader">{COPY.updatedLabel}</span>
                    </div>
                    {/* In the order the page cut them in, newest change first or by printed id
                        (`pageOfAssets`, #540). Nothing here sorts. */}
                    {rows.map((row) => {
                        const onLoan = row.loanedTo !== null && row.loanedTo !== undefined;
                        const selected = !onLoan && selection.includes(row.assetId);
                        return (
                            <div key={row.id} role="row" {...tooltip.cutProps()} className={`${TABLE_ROW} ${columns} ${selected ? TABLE_ROW_SELECTED : ""}`}>
                                {/* No box on a row on loan to another job (#598): its label is that
                                    job's to print, so its cell holds the column's room and nothing. */}
                                {selects && (
                                    <span role="cell" className="flex self-center">
                                        {!onLoan && (
                                            <Checkbox
                                                label={COPY.selectAsset(row.assetId)}
                                                checked={selected}
                                                onChange={() => replaceSelection(toggleAsset(selection, row.assetId))}
                                            />
                                        )}
                                    </span>
                                )}
                                <span role="cell" className="min-w-0 truncate font-id text-body-sm tracking-id">
                                    <Link href={assetPath(row.assetId)} className={TABLE_ROW_LINK}>
                                        {row.assetId}
                                    </Link>
                                </span>
                                {/* Its serial number at the row's 14 with even figures and Ink 2 — a maker's
                                    number, which the portal's id face is not for (0h, #607) — cut at its
                                    column's end and shown whole above it under the pointer (1d, #601).
                                    Nothing for an item with none. */}
                                <span role="cell" className="min-w-0 text-foreground-muted tabular-nums">
                                    <span data-cut="" className="block truncate">
                                        {row.serialNumber}
                                    </span>
                                </span>
                                {/* The job it is on, by its code in Ink 2, its figures tabular (1d,
                                    #548) — only while the list is on all jobs. */}
                                {showsJob && (
                                    <span role="cell" className="min-w-0 truncate text-foreground-muted tabular-nums">
                                        {row.jobCode}
                                    </span>
                                )}
                                {/* The status, and after an `Out` who holds it, behind 0e's dot in
                                    Ink 2 (1d, #520) — the value only that state has, which the
                                    item's own page says beside its status too. Centered in the
                                    row as 1d draws it: on the row's baseline its mark lifted the
                                    word half a pixel (#522). */}
                                <span role="cell" className="flex min-w-0 items-baseline gap-gap self-center">
                                    <StatusMark status={row.status} onLoan={onLoan} />
                                    {/* On loan from the job the page stands on (1d, #598): the word and
                                        the job it stands on, in the place a holder takes after `Out`. */}
                                    <span className="flex min-w-0 items-baseline whitespace-nowrap">
                                        <span className="shrink-0">{onLoan ? COPY.onLoanLabel : row.status}</span>
                                        {onLoan && row.loanedTo && (
                                            <>
                                                <Dot />
                                                <span className="min-w-0 truncate text-foreground-muted tabular-nums">{row.loanedTo}</span>
                                            </>
                                        )}
                                        {!onLoan && row.holder && (
                                            <>
                                                <Dot />
                                                <span className="min-w-0 truncate text-foreground-muted">{row.holder}</span>
                                            </>
                                        )}
                                    </span>
                                </span>
                                {/* A note is a 14 speech-bubble mark in Ink 3, centered in its 16, and the
                                    note itself above it under the pointer (0n, 1d, #607) — the row's tooltip,
                                    since the row's link covers the cell; the mark stands over the link, and
                                    assistive tech reads the note from its name. Its words in a column of
                                    their own from #533 until then. Nothing for an item with none. */}
                                <span role="cell" className="flex self-center">
                                    {row.note && (
                                        <span role="img" aria-label={COPY.noteMark(row.note)} data-tip={row.note} className="relative flex h-[var(--text-body--line-height)] w-(--size-icon) items-center justify-center">
                                            <Icon name="message-square" kind="qualifier" className="size-icon-sm" />
                                        </span>
                                    )}
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
                {tooltip.element}
                {children}
            </ListFrame>
            <LabelRunFrame labels={labels} title={LABEL_COPY.openFromCategory} itemName={itemName} />
        </>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { InfoMark } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import Icon from "@/app/components/Icon";
import { LIST_FILL, LIST_MEASURE } from "@/app/components/ListTable";
import { SCROLL_LANE } from "@/app/components/scrollLane";
import { useTooltip } from "@/app/components/Tooltip";

// The pager's own height — its room above and below a 32 control, its rule counted in the
// room above, 60 in all (0b) — is how far it stands over the rows and how much room the rows
// end on, so the last one clears it; the selection
// bar adds its own height, its 8 inside and Edge round a 36 action, and the 12 it floats at
// (0b). Each is written whole for Tailwind to find.
const PAGER_OVER_ROWS = "-mt-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom))]";
const END_ROOM = "h-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom))]";
const END_ROOM_WITH_BAR =
    "h-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom)+var(--spacing-selection-bar-offset)+var(--height-control-lg)+2*var(--spacing-selection-bar-inset)+2px)]";

// Where the column head holds, and what focus scrolls clear of at the top: 1a's head at its
// least — 32 above, a 36 control's line, 18 under — or 1d's 48 bar, the column head's 36
// under either. And at the foot, the pager, and the selection bar over it while it stands.
const UNDER_HEAD =
    "[--table-head-top:calc(var(--spacing-list-header-inset-top)+var(--height-control-lg)+var(--spacing-list-header-inset-bottom))] scroll-pt-[calc(var(--table-head-top)+var(--height-table-header))]";
// 1a's head with its band of controls under it (#520): the band's 32 controls and the 14 under them.
const UNDER_HEAD_AND_BAND =
    "[--table-head-top:calc(var(--spacing-list-header-inset-top)+var(--height-control-lg)+var(--spacing-list-header-inset-bottom)+var(--height-control)+var(--spacing-control-band-inset-y))] scroll-pt-[calc(var(--table-head-top)+var(--height-table-header))]";
const UNDER_BAR = "[--table-head-top:var(--height-breadcrumb)] scroll-pt-[calc(var(--table-head-top)+var(--height-table-header))]";
// A list's band (#520): its controls in a row 8 apart, 14 over the column head.
const BAND = `${LIST_MEASURE} flex items-center gap-gap pb-control-band-inset-y`;
const KEEP_CLEAR_OF_PAGER = "scroll-pb-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom))]";
const KEEP_CLEAR_OF_BAR =
    "scroll-pb-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom)+var(--spacing-selection-bar-offset)+var(--height-control-lg)+2*var(--spacing-selection-bar-inset)+2px)]";

// A list on Fill (#538): its band on the Margin; its column head laid over the lane's top, its 36
// and its rule, which the lane's first 36 is room for; and the bar's track running from under
// the column head to over the pager (0i Track), so the thumb never passes under either.
const BAND_FILL = `${LIST_FILL} flex shrink-0 items-center gap-gap pb-control-band-inset-y`;
const HEAD_OVER_LANE = "-mb-[calc(var(--height-table-header)+1px)]";
const TRACK_UNDER_HEAD = "[&::-webkit-scrollbar-track]:mt-(--height-table-header) scroll-pt-(--height-table-header)";
const TRACK_OVER_PAGER =
    "[&::-webkit-scrollbar-track]:mb-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom))]";

/** Whether rows run beneath what stands at a lane's foot: the lane not yet at its end. */
function rowsRunBeneath(lane) {
    return lane.scrollTop + lane.clientHeight < lane.scrollHeight - 1;
}

/**
 * The frame a list is drawn in (1a, 1d; #463, #519): one scroll from the top of the column to
 * its foot, what heads the list held at the top as the rows pass beneath it, and the pager
 * pinned at the foot over them.
 *
 * WHAT SCROLLS AND WHAT HOLDS IS 0i's AND 0k's. "A list on 1080 is one scroll, its bar running
 * the full height: the page head, the filter band and the column head hold at the top as one
 * Sticky surface, and only the rows pass beneath" — 1a, whose head is `header`. "A record page
 * is one scroll: the breadcrumb bar holds at the top, the header scrolls away with the body" —
 * 1d, a category's page, whose bar is `top`; its column head holds under the bar. The lane's
 * 8 is reserved whether or not the bar shows (0i Gutter), and the scroll stops at its end
 * rather than scrolling the window behind it (0i Chain, `contain`); the column the list sits in
 * steps aside (`Rail.js`), so only one lane is ever drawn. From #463 to #519 the head and the
 * bar stood outside the scroll and the rows scrolled in a lane of their own between the head
 * and the pager, which 0i now gives a list on Fill only.
 *
 * WHERE THE COLUMN HEAD HOLDS IS THE FRAME'S (`--table-head-top`), since only the frame knows
 * what stands over it: 1a's head — its 32 above, a 36 control's line and its 18 under, which is
 * the head's least height — or 1d's 48 bar. The lane keeps what holds at the top, and the pager
 * at the foot, out of the way of what keyboard focus scrolls to (`scroll-padding`).
 *
 * 1d's NAME COMES INTO THE BAR ONCE ITS HEADER HAS SCROLLED UNDER IT, and goes as it comes back
 * (1d): the frame marks the lane `data-title-gone`, and `Breadcrumb.js` draws the name it is
 * handed under that mark. Measured on every scroll, as the pager's ground is.
 *
 * THE PAGER IS THE ENDING, SO THE ROWS END ON NO 40 (0i End). They end on the pager's own
 * height instead, so the last row scrolls clear of it — and on the selection bar's as well
 * while it stands (0b), so no row stays under the bar either. It stands outside the scroll,
 * over its foot, clear of the lane's 8.
 *
 * THE PAGER STANDS OVER THE ROWS AND THE COLUMN HEAD (#501). It takes the head's z-index and
 * comes after the lane, so where a short window brings the two together it is the one on
 * top, as 1d ties them; the selection bar is drawn inside it, so it floats over both; and
 * the rail's Panel covers them all. What holds at the top of the lane takes the same z-index,
 * since nothing it holds over is the column head, and one above it would draw over the Panel,
 * which comes earlier in the document. `ListTable.js` has the order whole.
 *
 * THE PAGER'S GROUND SAYS WHETHER ROWS RUN BENEATH IT (0k Sticky, 0e Band): white at 0.82
 * over the blur and a Band over it while they do, plain white with no rule once the list has
 * ended above it. That is a fact about the scroll position, so it is measured — on every
 * scroll and whenever the lane or the rows change size — and the server renders the ended
 * state, which the first measure corrects. What holds at the top is drawn on the Sticky ground
 * throughout, which over nothing is plain white.
 *
 * `overlay` stands 12 above the pager, centered on the list — the selection bar — and is
 * drawn only with a pager; `overlayShown` is whether it is showing, which the end room
 * follows.
 *
 * `band` IS 1a's FILTER BAND (#520): the list's controls in a row 8 apart under the head, 14
 * over the column head, held at the top with the head as the one Sticky surface 0i draws — so
 * the column head holds under both. A list with no band holds its column head under the head.
 * The catalog drew its band under a bar from #527 until #538 laid it on Fill (`ListFrameFill`).
 */
export default function ListFrame({ top, header, band, footer, overlay, overlayShown = false, children }) {
    const laneRef = useRef(null);
    const topRef = useRef(null);
    const headerRef = useRef(null);
    const [beneath, setBeneath] = useState(false);
    const [titleGone, setTitleGone] = useState(false);

    useEffect(() => {
        const lane = laneRef.current;
        if (!lane) return undefined;
        const measure = () => {
            setBeneath(rowsRunBeneath(lane));
            const bar = topRef.current;
            const head = headerRef.current;
            if (bar && head) setTitleGone(head.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom);
        };
        measure();
        lane.addEventListener("scroll", measure, { passive: true });
        const resized = new ResizeObserver(measure);
        resized.observe(lane);
        for (const child of lane.children) resized.observe(child);
        return () => {
            lane.removeEventListener("scroll", measure);
            resized.disconnect();
        };
    }, []);

    return (
        <div data-list-frame="" className="flex h-full flex-col font-ui text-foreground-default">
            <div
                ref={laneRef}
                data-title-gone={titleGone ? "" : undefined}
                className={`group/list-frame min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] ${SCROLL_LANE} ${
                    top ? UNDER_BAR : band ? UNDER_HEAD_AND_BAND : UNDER_HEAD
                } ${footer ? (overlayShown ? KEEP_CLEAR_OF_BAR : KEEP_CLEAR_OF_PAGER) : ""}`}
            >
                {top ? (
                    <>
                        <div ref={topRef} className="sticky top-0 z-10">
                            {top}
                        </div>
                        <div ref={headerRef}>{header}</div>
                    </>
                ) : (
                    <div className="sticky top-0 z-10 bg-background-translucent backdrop-blur-sm">
                        {header}
                        {band && <div className={BAND}>{band}</div>}
                    </div>
                )}
                <div className={LIST_MEASURE}>{children}</div>
                {footer && <div aria-hidden="true" className={overlayShown ? END_ROOM_WITH_BAR : END_ROOM} />}
            </div>
            {footer && (
                <div className={`relative z-10 shrink-0 pr-scrollbar-gutter ${PAGER_OVER_ROWS}`}>
                    <div className={`${LIST_MEASURE} relative`}>
                        {overlay}
                        <div
                            className={`border-t ${
                                beneath ? "border-divider-strong bg-background-translucent backdrop-blur-sm" : "border-transparent bg-white"
                            }`}
                        >
                            {footer}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * 0b's Selection bar, floating 12 above the pager while any row is selected: a 32 clear and
 * the count at 14 and 600, 8 apart, then a second clause after a dot at 400 and Ink 3 while
 * part of the selection is on other pages, and the actions 14 on, on the Sticky ground with
 * an Edge and the Raised shadow at the Group radius. The clear rests at Ink 3 and lifts to Ink
 * as it fills under the pointer (0f Ink on hover, #505).
 *
 * EACH CLAUSE HOLDS THE WIDTH OF ITS THREE-DIGIT FORM, so the bar changes width only when the
 * second clause or a reason comes or goes, over 160ms; it rises 8 and fades in over the same.
 * Hidden, it is inert and leaves the accessibility tree, so its controls cannot be reached
 * while it does not show. `Escape` clears the selection — except while a dialog is open,
 * which `Escape` closes first (0b).
 *
 * AN ACTION THE SELECTION IS TOO LARGE FOR SAYS WHY BEFORE IT (0b, #495): `reason`, 14 before
 * the actions and led by a 16 info mark 6 before it, at 13 in Ink 3 — 0f's Disabled with the
 * mark the bar's row gives it — and the action points at it as its description through
 * `reasonId`. The selection itself is never refused. The reason opens and closes the way the
 * second clause does, and keeps its words while it closes, so it does not vanish before its
 * column has.
 *
 * IT TAKES ITS CONTENT'S WIDTH (#495). It is centered by standing at the list's middle and
 * moving back half its own width, and a box set from the middle and left to size itself is
 * held to the half of the list beyond it: measured on a 1080 list, a bar past a hundred
 * needed 597 and was held to 572, and the reason's column took the cut.
 */
export function SelectionBar({ shown, label, count, notOnPage, words, clearLabel, onClear, reason, reasonId, children }) {
    const tip = useTooltip({ enabled: shown, placement: "above" });
    // The last reason given, which the column keeps drawing while it closes.
    const [lastReason, setLastReason] = useState(reason ?? "");
    if (reason && reason !== lastReason) setLastReason(reason);

    useEffect(() => {
        if (!shown) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
            onClear();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [shown, onClear]);

    return (
        <div
            role="toolbar"
            aria-label={label}
            inert={!shown}
            className={`absolute bottom-full left-1/2 mb-selection-bar-offset flex w-max -translate-x-1/2 items-center gap-gap-lg rounded-card border border-border bg-background-translucent p-selection-bar-inset shadow-popover backdrop-blur-sm transition-[opacity,translate,visibility] duration-selection-bar ease-out ${
                shown ? "visible translate-y-0 opacity-100" : "invisible translate-y-selection-bar-slide opacity-0"
            }`}
        >
            <div className="flex items-center gap-gap">
                <button
                    type="button"
                    aria-label={clearLabel}
                    onClick={onClear}
                    {...tip.targetProps(clearLabel)}
                    className="flex aspect-square h-control shrink-0 items-center justify-center rounded-control text-foreground-subtle hover:bg-hover hover:text-foreground-default"
                >
                    <Icon name="x" className="size-icon" />
                </button>
                <span className="flex whitespace-nowrap text-body">
                    <span className="grid font-semibold">
                        <span aria-hidden="true" className="invisible col-start-1 row-start-1 tabular-nums">
                            {words.count("000")}
                        </span>
                        <span className="col-start-1 row-start-1 tabular-nums">{words.count(count)}</span>
                    </span>
                    <span
                        aria-hidden={notOnPage > 0 ? undefined : true}
                        className={`grid transition-[grid-template-columns,opacity] duration-selection-bar ease-out ${
                            notOnPage > 0 ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
                        }`}
                    >
                        <span className="flex min-w-0 overflow-hidden">
                            <Dot />
                            <span className="grid text-foreground-subtle">
                                <span aria-hidden="true" className="invisible col-start-1 row-start-1 tabular-nums">
                                    {words.notOnPage("000")}
                                </span>
                                <span className="col-start-1 row-start-1 tabular-nums">{words.notOnPage(notOnPage)}</span>
                            </span>
                        </span>
                    </span>
                </span>
            </div>
            <div className="flex items-center">
                <span
                    aria-hidden={reason ? undefined : true}
                    className={`grid transition-[grid-template-columns,opacity] duration-selection-bar ease-out ${
                        reason ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
                    }`}
                >
                    <span className="min-w-0 overflow-hidden">
                        <span className="flex items-center gap-selection-bar-reason-gap whitespace-nowrap pr-gap-lg">
                            <InfoMark size="size-icon" tone="subtle" />
                            <span id={reasonId} className="text-body-sm text-foreground-subtle tabular-nums">
                                {lastReason}
                            </span>
                        </span>
                    </span>
                </span>
                {children}
            </div>
            {tip.element}
        </div>
    );
}

/**
 * The frame a list on Fill is drawn in (1l, #538): the bar, the head and the band holding still
 * at the top, and the rows scrolling inside a region of their own between the column head and
 * the pager, which lie over its two ends — 0i's "a list on Fill scrolls inside its own region",
 * where a list on 1080 is one scroll (`ListFrame`). The catalog is the one list on Fill, since
 * the files of 2026-10-16 laid it across the column as the Invoices file lays its lists.
 *
 * THE COLUMN HEAD STANDS OUTSIDE THE LANE, OVER ITS TOP, so its ground and its rules reach the
 * window's edge across the lane while a row's reach the lane's edge (0i Track), and the lane's
 * first 36 is room for it to lie over; the bar's track starts under it and ends over the pager,
 * so the thumb passes under neither. The head keeps the Sticky ground throughout, which over the
 * lane's empty top is plain white, as 1l draws it until rows pass beneath.
 *
 * THE LANE SCROLLS UP AND DOWN AND NEVER SIDEWAYS, AS 1l DRAWS IT. With the head outside the
 * lane a sideways scroll would move the rows under a head that stays, so a window too narrow for
 * the catalog's columns cuts them at the lane's edge; the name's column gives way first, since
 * it is the one that takes what the others leave. Until #538 the lane scrolled sideways.
 *
 * WHAT IT SHARES WITH `ListFrame`: the pager pinned over the lane's foot, its ground saying
 * whether rows run beneath (`rowsRunBeneath`), the rows ending on its height and the selection
 * bar's, and focus scrolling clear of both. The selection bar stands centered on the rows, the
 * lane left out, as 1l centers it. `label` names the table, whose head row and rows the frame
 * holds in two parts; the catalog's dialogs stand outside the frame.
 *
 * `empty` IS WHAT A LIST THE BAND EMPTIED SAYS IN THE ROWS' PLACE, under the column head and
 * outside the table, since it is no row; the lane is not drawn while it stands.
 */
export function ListFrameFill({ top, header, band, columnHead, label, footer, overlay, overlayShown = false, empty, children }) {
    const laneRef = useRef(null);
    const [beneath, setBeneath] = useState(false);
    // The lane comes back when the band stops emptying the list, and is measured anew.
    const laneShown = !empty;

    useEffect(() => {
        const lane = laneRef.current;
        if (!lane || !laneShown) return undefined;
        const measure = () => setBeneath(rowsRunBeneath(lane));
        measure();
        lane.addEventListener("scroll", measure, { passive: true });
        const resized = new ResizeObserver(measure);
        resized.observe(lane);
        for (const child of lane.children) resized.observe(child);
        return () => {
            lane.removeEventListener("scroll", measure);
            resized.disconnect();
        };
    }, [laneShown]);

    return (
        <div data-list-frame="" className="flex h-full flex-col font-ui text-foreground-default">
            {top && <div className="shrink-0">{top}</div>}
            <div className="shrink-0">{header}</div>
            {band && <div className={BAND_FILL}>{band}</div>}
            <div role="table" aria-label={label} className={`flex min-h-0 flex-col ${empty ? "shrink-0" : "flex-1"}`}>
                <div role="rowgroup" className={`shrink-0 ${empty ? "-mb-px" : HEAD_OVER_LANE}`}>
                    {columnHead}
                </div>
                {laneShown && (
                    <div
                        ref={laneRef}
                        role="rowgroup"
                        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] ${SCROLL_LANE} ${TRACK_UNDER_HEAD} ${
                            footer ? `${TRACK_OVER_PAGER} ${overlayShown ? KEEP_CLEAR_OF_BAR : KEEP_CLEAR_OF_PAGER}` : ""
                        }`}
                    >
                        <div aria-hidden="true" className="h-table-header" />
                        {children}
                        {footer && <div aria-hidden="true" className={overlayShown ? END_ROOM_WITH_BAR : END_ROOM} />}
                    </div>
                )}
            </div>
            {empty && <div className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] ${SCROLL_LANE}`}>{empty}</div>}
            {footer && (
                <div className={`relative z-10 shrink-0 ${PAGER_OVER_ROWS}`}>
                    <div className="relative mr-scrollbar-gutter">{overlay}</div>
                    <div className={`border-t ${beneath ? "border-divider-strong bg-background-translucent backdrop-blur-sm" : "border-transparent bg-white"}`}>
                        {footer}
                    </div>
                </div>
            )}
        </div>
    );
}

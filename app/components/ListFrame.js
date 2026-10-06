"use client";

import { useEffect, useRef, useState } from "react";
import { InfoMark } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import { LIST_MEASURE } from "@/app/components/ListTable";
import { SCROLL_LANE } from "@/app/components/scrollLane";
import { useTooltip } from "@/app/components/Tooltip";

// The pager's own height — its room above and below a 32 control — is how far it stands
// over the rows and how much room the rows end on, so the last one clears it; the selection
// bar adds its own height, its 8 inside and Edge round a 36 action, and the 12 it floats at
// (0b). Each is written whole for Tailwind to find.
const PAGER_OVER_ROWS = "-mt-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom))]";
const END_ROOM = "h-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom))]";
const END_ROOM_WITH_BAR =
    "h-[calc(var(--spacing-pager-inset-top)+var(--height-control)+var(--spacing-pager-inset-bottom)+var(--spacing-selection-bar-offset)+var(--height-control-lg)+2*var(--spacing-selection-bar-inset)+2px)]";

/**
 * The frame a list is drawn in (1a, 1b; #463): its head held still and its rows scrolled
 * under it in a lane of their own, the column head held at the top of the rows, and the pager
 * pinned at the foot over them.
 *
 * WHAT SCROLLS AND WHAT HOLDS IS 0i's AND 0k's. The breadcrumb bar and the list's head stand
 * outside the scroll; the rows scroll in a lane whose 8 is reserved whether or not the bar
 * shows (0i Gutter), so everything above and below it gives that 8 back to keep one right
 * edge. The rows stop at their end rather than scrolling the window behind them (0i Chain,
 * `contain`), and the column the list sits in steps aside (`Rail.js`), so only one lane is
 * ever drawn.
 *
 * THE PAGER IS THE ENDING, SO THE ROWS END ON NO 40 (0i End). They end on the pager's own
 * height instead, so the last row scrolls clear of it — and on the selection bar's as well
 * while it stands (0b), so no row stays under the bar either.
 *
 * THE PAGER'S GROUND SAYS WHETHER ROWS RUN BENEATH IT (0k Sticky, 0e Band): white at 0.82
 * over the blur and a Band over it while they do, plain white with no rule once the list has
 * ended above it. That is a fact about the scroll position, so it is measured — on every
 * scroll and whenever the lane or the rows change size — and the server renders the ended
 * state, which the first measure corrects.
 *
 * `overlay` stands 12 above the pager, centered on the list — the selection bar — and is
 * drawn only with a pager; `overlayShown` is whether it is showing, which the end room
 * follows.
 */
export default function ListFrame({ top, header, footer, overlay, overlayShown = false, children }) {
    const laneRef = useRef(null);
    const [beneath, setBeneath] = useState(false);

    useEffect(() => {
        const lane = laneRef.current;
        if (!lane) return undefined;
        const measure = () => setBeneath(lane.scrollTop + lane.clientHeight < lane.scrollHeight - 1);
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
            {top && <div className="shrink-0 pr-scrollbar-gutter">{top}</div>}
            <div className="shrink-0">{header}</div>
            <div ref={laneRef} className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] ${SCROLL_LANE}`}>
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
 * an Edge and the Raised shadow at the Group radius.
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
                    className="flex aspect-square h-control shrink-0 items-center justify-center rounded-control text-foreground-subtle hover:bg-hover"
                >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
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
                            <InfoMark size="size-icon" ring={1.5} tone="subtle" />
                            <span id={reasonId} className="text-body-sm text-foreground-subtle">
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

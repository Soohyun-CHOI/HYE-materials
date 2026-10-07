import Link from "next/link";
import Space from "@/app/components/Space";

/**
 * A list's parts as 1a and 1b draw them (#463): the head a list opens with, 0b's Column
 * head and Row, and the pager under the rows. `ListFrame.js` is the frame that holds them
 * still or scrolls them.
 *
 * NO STATE AND NO `"use client"`, BECAUSE A SERVER PAGE DRAWS ITS ROWS FROM HERE. A class
 * string a Server Component imports from a client module arrives as a reference to it rather
 * than as the string, so the constants a server page's rows are built from live in a module
 * both kinds of file can read. The columns are each list's own; what a row and a head ARE is
 * here once.
 *
 * WHAT STANDS OVER WHAT (#501). A row is its own stacking context, so what it lifts — its
 * box, over the link that covers the row — rises inside the row and never past it. Over the
 * rows stands the column head. The pager stands over the head where a short window brings
 * them together, at the head's z-index and later in the document, with the selection bar
 * floating on it (`ListFrame.js`); the rail's Panel covers all three; and a tooltip, a menu
 * or a dialog opens in the top layer over everything. Until #501 a row was no context of its
 * own, so its box and the column head held one z-index in one context, and every box —
 * later in the document — drew over the head as its row scrolled under it.
 */

/** The content's measure inside the column (0b, 1080), with the Margin either side. */
export const LIST_MEASURE = "mx-auto box-content max-w-content px-page-gutter";

/**
 * 0b's Column head: 36 tall on the Sticky ground, held at the top of the rows. A Band runs
 * under it, which it owns with -1 so the first row's rule goes under it, and one over it,
 * drawn inside the 36, since no tab band sits above (0k). Its text is 12 in from the content's
 * edge, as a row's is.
 */
export const TABLE_HEAD =
    "sticky top-0 z-10 -mb-px box-content grid h-table-header items-center gap-x-table-column-inline border-b border-divider-strong bg-background-translucent px-table-bleed text-heading-sm text-foreground-subtle shadow-[inset_0_1px_0_var(--color-divider-strong)] backdrop-blur-sm";

/**
 * 0b's Row: 40 under its 1px Rule, its text 12 in from the content's edge where the rule
 * stops, and a Control-radius face under the pointer and while it is selected — Wash, since a
 * table row counts as bordered (0f), and Face (0c). The drawings set both faces square; 0b
 * gives the hover a Control radius on 1080, and the spec is the one followed. `isolate` makes
 * it a stacking context of its own, so its box stays under the column head (above).
 */
export const TABLE_ROW =
    "relative isolate box-content grid h-table-row content-center items-baseline gap-x-table-column-inline rounded-control px-table-bleed pt-px text-body text-foreground-default before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-divider hover:bg-hover-subtle";

/** A selected row's Face (0c), over the hover's Wash. */
export const TABLE_ROW_SELECTED = "bg-selected hover:bg-selected";

/** A row that is one link: the link's own box stretched over the row, so the row is the target. */
export const TABLE_ROW_LINK = "after:absolute after:inset-0 after:rounded-control";

/**
 * The head a list opens with (1a, 1b): its title, a line counting what it holds — the figure
 * in Ink and the noun at Ink 3, 5 apart — and what it acts with on the right.
 *
 * 0n's FIGURES WHERE THE TWO DRAWINGS PART. 1b sets the line 10 under the title and 20 under
 * the line; 1a sets it 6 under in a 26 box and 18 under, the figure at Ink 3 and the control
 * centered on the pair, where 1b sets its control level with the title. 0n's Header stack is
 * 10, every figure is Ink (0e), and a two-line list header centers its one control (0n), so
 * one head draws both lists that way.
 */
export function ListHeader({ title, count, noun, children }) {
    return (
        <div className="pr-scrollbar-gutter">
            <div
                className={`${LIST_MEASURE} flex items-center justify-between gap-list-header-inline pt-list-header-inset-top pb-list-header-inset-bottom`}
            >
                <div className="flex min-w-0 flex-col gap-title-stack">
                    <h1 className="text-heading-lg">{title}</h1>
                    <p className="text-body text-foreground-subtle">
                        <span className="tabular-nums text-foreground-default">{count}</span>
                        <Space className="w-list-count-inline" />
                        {noun}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-gap">{children}</div>
            </div>
        </div>
    );
}

/**
 * The figures in a line of words, tabular, each in `className` when it is given — the
 * pager's in Ink against its words at Ink 3 (0e: every figure is Ink).
 */
function Figures({ children, className = "" }) {
    return String(children)
        .split(/(\d[\d–]*)/)
        .map((part, index) =>
            index % 2 === 1 ? (
                <span key={index} className={`tabular-nums ${className}`}>
                    {part}
                </span>
            ) : (
                part
            )
        );
}

/** A pager's step: a link while there is a page that way, and a step that does not act at the end (1a, 1b). */
function PagerStep({ href, label, back }) {
    const mark = (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon">
            <path d={back ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
    const look = "flex aspect-square h-control items-center justify-center rounded-control";
    if (!href) {
        return (
            <button type="button" disabled aria-label={label} className={`${look} text-foreground-faint`}>
                {mark}
            </button>
        );
    }
    return (
        <Link href={href} aria-label={label} className={`${look} text-foreground-default hover:bg-hover`}>
            {mark}
        </Link>
    );
}

/**
 * What the foot of a list says (1a, 1b): which rows this page shows of how many on the left,
 * and on the right which page of how many and a step each way, the last chevron's ink on the
 * text's edge. A step at its end is drawn and does not act — the drawings' — where the steps
 * were absent at the ends until #463. The ground under it is the frame's.
 */
export function Pager({ range, position, previous, next }) {
    return (
        <div className="flex items-center justify-between gap-pager-inline px-table-bleed pt-pager-inset-top pb-pager-inset-bottom">
            <p className="text-body-sm text-foreground-subtle">
                <Figures className="text-foreground-default">{range}</Figures>
            </p>
            <div className="flex items-center gap-pager-step-gap">
                <p className="text-body-sm text-foreground-subtle">
                    <Figures className="text-foreground-default">{position}</Figures>
                </p>
                <div className="-mr-pager-step-bleed flex">
                    <PagerStep {...previous} back />
                    <PagerStep {...next} />
                </div>
            </div>
        </div>
    );
}

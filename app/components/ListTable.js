import Link from "next/link";
import Icon from "@/app/components/Icon";

/**
 * A list's parts as 1a and 1d draw them (#463): the head a list opens with, 0b's Column
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
 * The head a list opens with (0n's list header, 1a, 1d): one line — its title, then 8 on
 * along the title's baseline how many rows the list holds, the figure alone at 14, 400 and
 * Ink 3 — and its one control on the right, centered on the title's line. 32 above it, or 14
 * where the breadcrumb bar stands over it (`underBreadcrumb`), and 18 under it.
 *
 * THE FIGURE STANDS ALONE ON THE SCREEN AND NOT FOR ASSISTIVE TECH (#505). The files of
 * 2026-10-07 dropped the noun the head drew beside it since #463; a figure read straight after
 * a heading names nothing it counts, so `noun` follows it unseen, in the list's own word.
 *
 * `caption` IS WHAT A TOOL'S OWN PAGE SAYS UNDER ITS TITLE (#507): what the tool is, where
 * the record header says its caption — 10 under the title (0n Header stack) — and the control
 * stays centered on the title's line, as the record header's actions are. 0n's list header
 * draws no caption; Design is drawing the tool's, and this is the closest until then.
 */
export function ListHeader({ title, count, noun, caption, underBreadcrumb = false, children }) {
    return (
        <div className="pr-scrollbar-gutter">
            <div
                className={`${LIST_MEASURE} flex justify-between gap-list-header-inline pb-list-header-inset-bottom ${
                    caption ? "items-start" : "items-center"
                } ${underBreadcrumb ? "pt-breadcrumb-stack" : "pt-list-header-inset-top"}`}
            >
                <div className="flex min-w-0 flex-col gap-title-stack">
                    <div className="flex min-w-0 items-baseline gap-list-count-inline">
                        <h1 className="min-w-0 text-heading-lg">{title}</h1>
                        <p className="shrink-0 text-body tabular-nums text-foreground-subtle">
                            {count}
                            <span className="sr-only">{` ${noun}`}</span>
                        </p>
                    </div>
                    {caption}
                </div>
                <div
                    className={`flex shrink-0 items-center gap-gap ${
                        caption ? "-mt-[calc((var(--height-control-lg)-var(--text-heading-lg--line-height))/2)]" : ""
                    }`}
                >
                    {children}
                </div>
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

/** A pager's step: a link while there is a page that way, and a step that does not act at the end (1a, 1d). */
function PagerStep({ href, label, back }) {
    const mark = <Icon name={back ? "chevron-left" : "chevron-right"} className="size-icon" />;
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
 * What the foot of a list says (1a, 1d): which rows this page shows of how many on the left,
 * and on the right which page of how many and a step each way, the last chevron's ink on the
 * text's edge. A step at its end is drawn and does not act — the drawings' — where the steps
 * were absent at the ends until #463. The ground under it is the frame's, and so is the
 * 1px rule over it, which 0b's 12 above the controls counts — so 60 in all (#505).
 */
export function Pager({ range, position, previous, next }) {
    return (
        <div className="flex items-center justify-between gap-pager-inline px-table-bleed pt-[calc(var(--spacing-pager-inset-top)-1px)] pb-pager-inset-bottom">
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

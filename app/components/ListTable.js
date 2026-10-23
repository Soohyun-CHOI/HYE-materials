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
 * rows stands the column head, and over that what heads the list in its scroll — 1a's head,
 * 1d's bar (#519). The pager stands over the head where a short window brings
 * them together, at the head's z-index and later in the document, with the selection bar
 * floating on it (`ListFrame.js`); the rail's Panel covers all three; and a tooltip, a menu
 * or a dialog opens in the top layer over everything. Until #501 a row was no context of its
 * own, so its box and the column head held one z-index in one context, and every box —
 * later in the document — drew over the head as its row scrolled under it.
 */

/** The content's measure inside the column (0b, 1080), with the Margin either side. */
export const LIST_MEASURE = "mx-auto box-content max-w-content px-page-gutter";

/**
 * A list on Fill (0b, 0i; 1l since #538): the column's whole width, the Margin either side. Its
 * table stands 4 further in on the right — `--spacing-fill-table-inset-right` from the window's
 * edge, the lane's 8 within it — as every Fill list the files of 2026-10-16 draw has it.
 */
export const LIST_FILL = "px-page-gutter";

/**
 * 0b's Column head: 36 tall on the Sticky ground, held under what heads the list as the rows
 * pass beneath it — where that is, `--table-head-top`, is `ListFrame.js`'s (0i Chain, #519). A
 * Band runs under it, which it owns with -1 so the first row's rule goes under it, and one over
 * it, drawn inside the 36, since no tab band sits above (0k). Its text is 12 in from the
 * content's edge, as a row's is.
 */
export const TABLE_HEAD =
    "sticky top-(--table-head-top) z-10 -mb-px box-content grid h-table-header items-center gap-x-table-column-inline border-b border-divider-strong bg-background-translucent px-table-bleed text-heading-sm text-foreground-subtle shadow-[inset_0_1px_0_var(--color-divider-strong)] backdrop-blur-sm";

/**
 * 0b's Row: 40 under its 1px Rule, its text 12 in from the content's edge where the rule
 * stops, and a square face under the pointer and while it is selected — Wash, since a table
 * row counts as bordered (0f), and Face (0c). Every list 1a and 1d draw sets the row's corners
 * at 0, where 0b's sentence gives the hover a Control radius on 1080; the drawings are followed
 * since 2026-10-12, and the row wore the Control radius until then. `isolate` makes it a
 * stacking context of its own, so its box stays under the column head (above).
 */
export const TABLE_ROW =
    "relative isolate box-content grid h-table-row content-center items-baseline gap-x-table-column-inline px-table-bleed pt-px text-body text-foreground-default before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-divider hover:bg-hover-subtle";

/** A selected row's Face (0c), over the hover's Wash. */
export const TABLE_ROW_SELECTED = "bg-selected hover:bg-selected";

/**
 * The column head and the row of a list on Fill (1l, #538). The head stands outside the rows'
 * lane, over its top, so its ground and its rules reach the window's edge across the lane (0i
 * Track), and holds still while the rows pass beneath; a row runs the lane's width, its face and
 * its rule to the lane's edge, its text 32 in from the left and as far in from the right as the
 * head's, which counts the lane. Otherwise each is the measure's own, above.
 */
export const TABLE_HEAD_FILL =
    "relative z-10 box-content grid h-table-header items-center gap-x-table-column-inline border-b border-divider-strong bg-background-translucent pl-page-gutter pr-fill-table-inset-right text-heading-sm text-foreground-subtle shadow-[inset_0_1px_0_var(--color-divider-strong)] backdrop-blur-sm";

export const TABLE_ROW_FILL =
    "relative isolate box-content grid h-table-row content-center items-baseline gap-x-table-column-inline pt-px pl-page-gutter pr-[calc(var(--spacing-fill-table-inset-right)-var(--spacing-scrollbar-gutter))] text-body text-foreground-default before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-divider hover:bg-hover-subtle";

/**
 * A row that is one link: the link's own box stretched over the row, so the row is the target,
 * square as the row is.
 */
export const TABLE_ROW_LINK = "after:absolute after:inset-0";

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
 * `caption` IS WHAT A CATEGORY'S OWN PAGE SAYS UNDER ITS TITLE (#507): what the category is, 10
 * under the title (0n Header stack), as 1d draws it since #519 — and the control stands level
 * with the title's top, as 1d draws it since 2026-10-16 (#538), where it was centered on the
 * title's line, 2 higher, until then.
 *
 * TWO CONTROLS IN ONE HEAD STAND 12 APART (1a, #519): the job's chip and `Add items`.
 *
 * A HEAD WITH NO BAR OVER IT IS AT LEAST A 36 CONTROL'S LINE TALL (1a, #519), whatever it holds,
 * since it holds at the top of the list's one scroll and the column head holds under it at that
 * height (`ListFrame.js`). It stands in the scroll, so the lane's 8 is already its own.
 *
 * A HEAD WITH NOTHING TO COUNT DRAWS NO FIGURE (#519): `count` left out, the title stands alone,
 * as 1a2 draws the category list for a reader on no job, whose list holds nothing it could
 * hold. A list that holds nothing yet still says `0`.
 *
 * `fill` IS A LIST ON FILL'S HEAD (1l, #538): the column's whole width rather than the measure.
 *
 * `stacked` IS A CATEGORY'S OWN HEAD SINCE #540 (1d, as the files of 2026-10-23 were last sent):
 * its controls in a column at the head's right, as tall as the title and its caption, standing at
 * its foot and 8 apart — `Add items` over the sort, either alone at the foot when the other is not
 * drawn, where the one control stood level with the title's top from #538.
 */
export function ListHeader({ title, count, noun, caption, underBreadcrumb = false, fill = false, stacked = false, children }) {
    return (
        <div
            className={`${fill ? LIST_FILL : LIST_MEASURE} flex justify-between gap-list-header-inline pb-list-header-inset-bottom ${caption ? "items-start" : "items-center"} ${
                underBreadcrumb ? "pt-breadcrumb-stack" : "min-h-(--height-control-lg) pt-list-header-inset-top"
            }`}
        >
            <div className="flex min-w-0 flex-col gap-title-stack">
                <div className="flex min-w-0 items-baseline gap-list-count-inline">
                    <h1 className="min-w-0 text-heading-lg">{title}</h1>
                    {count != null && (
                        <p className="shrink-0 text-body tabular-nums text-foreground-subtle">
                            {count}
                            <span className="sr-only">{` ${noun}`}</span>
                        </p>
                    )}
                </div>
                {caption}
            </div>
            {/* Its controls 8 apart, 0b's Gap within a cluster, as the files of 2026-10-23 draw 1a's
                head (#566); 1a drew them 12 apart from #519 until then. */}
            <div className={`flex shrink-0 gap-gap ${stacked ? "flex-col items-end justify-end self-stretch" : "items-center"}`}>{children}</div>
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

/**
 * A pager's step: a link while there is a page that way, and a step that does not act at the
 * end (1a, 1d). A list whose rows are all in the browser steps by a press instead (`onPress`,
 * #520) — the category list, whose page is a slice of rows it already holds — so a step
 * fetches nothing.
 */
function PagerStep({ href, onPress, label, back }) {
    const mark = <Icon name={back ? "chevron-left" : "chevron-right"} className="size-icon" />;
    const look = "flex aspect-square h-control items-center justify-center rounded-control";
    if (onPress) {
        return (
            <button type="button" aria-label={label} onClick={onPress} className={`${look} text-foreground-default hover:bg-hover`}>
                {mark}
            </button>
        );
    }
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
 *
 * THE PAGE AND ITS STEPS STAND ONLY WHEN THERE IS A SECOND PAGE (0b Pager, #519): `position`
 * left out, the pager is its count alone, still 60, the count holding the controls' height.
 * The caller decides, since it knows how many pages there are.
 *
 * THE COUNT'S PIECES SIT IN ONE SPAN, SO THE BOX THAT CENTERS THEM KEEPS THEIR SPACES (#538).
 * `Figures` hands back the figures and the words between them as siblings, and a flex box
 * makes each run of words an item of its own and drops the spaces at its ends: `1–25 of 25`
 * read `1–25of25` from #519 to #538. The span is the one item, and inside it the pieces are
 * one line of text again; `offline/flex-whitespace.mjs` fails `Figures` placed straight in a
 * flex or grid box.
 *
 * `fill` IS A LIST ON FILL'S PAGER (1l, #538): its count on the Margin, 32 in, and its steps on
 * the rows' text edge, 36 in from the window's — where the measure's stands on its rows' text 12
 * past the measure's edge. 1l draws the last step 12 past that edge where 1d draws it 13; the
 * bleed is one value, 1d's.
 */
export function Pager({ range, position, previous, next, fill = false }) {
    return (
        <div
            className={`flex items-center justify-between gap-pager-inline ${fill ? "pl-page-gutter pr-fill-table-inset-right" : "px-table-bleed"} pt-[calc(var(--spacing-pager-inset-top)-1px)] pb-pager-inset-bottom`}
        >
            <p className="flex h-control items-center text-body-sm text-foreground-subtle">
                <span>
                    <Figures className="text-foreground-default">{range}</Figures>
                </span>
            </p>
            {position && (
                <div className="flex items-center gap-pager-step-gap">
                    <p className="text-body-sm text-foreground-subtle">
                        <Figures className="text-foreground-default">{position}</Figures>
                    </p>
                    <div className="-mr-pager-step-bleed flex">
                        <PagerStep {...previous} back />
                        <PagerStep {...next} />
                    </div>
                </div>
            )}
        </div>
    );
}

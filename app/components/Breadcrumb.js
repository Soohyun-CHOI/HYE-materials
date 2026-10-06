import Link from "next/link";
import { Fragment } from "react";
import { NAVIGATION_COPY as COPY } from "@/lib/navigation";

/*
 * The breadcrumb bar — 0m's Breadcrumb, the way back a screen offers above its title
 * (#460). A tool's page names the list it came from; a tool item's names where it sits
 * under its tool, ending on the code its label prints.
 *
 * ONE LEVEL IS A CHEVRON AND ITS NAME; MORE ARE A PATH SPLIT BY `/` (0m). A level is a
 * link at Ink 2 and 600, an Inline control whose side room is pulled back so its ink
 * meets the Margin, and the chevron is pulled further, so its stroke meets it rather
 * than its box. The screen the bar sits on ends a path, in Ink and not a link.
 *
 * IT HOLDS THE TOP OF THE COLUMN WHILE THE SCREEN RUNS UNDER IT (0k Sticky): white at
 * 0.82 over a blur, which over nothing is plain white. It draws no rule.
 *
 * WHICH SCREENS CARRY ONE IS THE DESIGN'S: a tool's page and a tool item's (1b, 1c, 1d),
 * and not the tool list, which is a section's top, nor a screen saying a record is not
 * there, which keeps its own way back (1l). **Below the phone's edge the tool item page
 * draws the phone's top bar in its place (1f, #463)** and passes `phone={false}`; a tool's
 * page, which the design draws at a desk alone, keeps it at every width.
 *
 * A level is `{ label, href }`, and `current` is the screen's own name when it ends a
 * path. Every word arrives from the caller's constants, and the bar's own two — its
 * name and its separator — from `lib/navigation.js`.
 */

const LEVEL =
    "inline-flex h-control-inline min-w-0 items-center rounded-control px-control-inline-inset-x text-body-sm font-semibold text-foreground-muted hover:bg-hover hover:text-foreground-default";

export default function Breadcrumb({ levels, current, phone = true }) {
    return (
        <nav
            aria-label={COPY.breadcrumb}
            className={`sticky top-0 z-10 flex h-breadcrumb items-center bg-background-translucent px-page-gutter font-ui backdrop-blur-sm ${phone ? "" : "max-sm:hidden"}`}
        >
            {current === undefined && levels.length === 1 ? (
                <Link href={levels[0].href} className={`${LEVEL} -ml-breadcrumb-back-bleed gap-breadcrumb-back-gap`}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm shrink-0">
                        <path d="M9.5 4 5.5 8l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {levels[0].label}
                </Link>
            ) : (
                <ol className="flex min-w-0 items-center gap-gap">
                    {levels.map((level) => (
                        <Fragment key={level.href}>
                            <li className="flex min-w-0">
                                <Link href={level.href} className={`${LEVEL} -mx-control-inline-inset-x`}>
                                    <span className="truncate">{level.label}</span>
                                </Link>
                            </li>
                            <li aria-hidden="true" className="text-body-sm text-foreground-faint">
                                {COPY.separator}
                            </li>
                        </Fragment>
                    ))}
                    <li
                        aria-current="page"
                        className="flex h-control-inline shrink-0 items-center whitespace-nowrap text-body-sm font-semibold text-foreground-default tabular-nums"
                    >
                        {current}
                    </li>
                </ol>
            )}
        </nav>
    );
}

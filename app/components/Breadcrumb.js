import Link from "next/link";
import { Fragment } from "react";
import { NAVIGATION_COPY as COPY } from "@/lib/navigation";
import Icon from "./Icon";

/*
 * The breadcrumb bar — 0m's Breadcrumb, the way back a screen offers above its title
 * (#460). A category's page names the list it came from; an asset's names where it sits
 * under its category, ending on the code its label prints.
 *
 * ONE LEVEL IS A CHEVRON AND ITS NAME; MORE ARE A PATH SPLIT BY `/` (0m). A level is a
 * link at Ink 2 and 600, an Inline control whose side room is pulled back so its ink
 * meets the Margin. It is 0f's target set in text, so under the pointer it takes the
 * Hover face and keeps its Ink 2, as the files of 2026-10-07 draw it; it lifted to Ink
 * until #505. The chevron's box is as wide as its ink — the grid's middle eight
 * columns — so its stroke is what meets the Margin, and its word stands 0b's 8 past
 * it (#502). The screen the bar sits on ends a path, in Ink and not a link.
 *
 * IT HOLDS THE TOP OF THE COLUMN WHILE THE SCREEN RUNS UNDER IT (0k Sticky): white at
 * 0.82 over a blur, which over nothing is plain white. It draws no rule.
 *
 * WHICH SCREENS CARRY ONE IS THE DESIGN'S: a category's page and an asset's (1d, 1f, 1g),
 * and not the category list, which is a section's top, nor a screen saying a record is not
 * there, which keeps its own way back (1h). **Below the phone's edge the asset page
 * draws the phone's top bar in its place (1j, #463)** and passes `phone={false}`; a category's
 * page, which the design draws at a desk alone, keeps it at every width.
 *
 * A level is `{ label, href }`, and `current` is the screen's own name when it ends a
 * path. Every word arrives from the caller's constants, and the bar's own two — its
 * name and its separator — from `lib/navigation.js`.
 *
 * A LEVEL MAY BE A CONTROL RATHER THAN A LINK (#519): `{ key, control }`, the job a reader on
 * several jobs narrows by, which 1d and 1f draw as a level of the path — `Tools & Equipment /
 * 26-USA-06` on a category's page, the job before the category on an asset's. A path with such
 * a level is a path whatever its length, so a category's page with one draws `/` rather than
 * the chevron, and a path need not end on the screen's own name: 1d's ends on the job.
 *
 * A CATEGORY'S PAGE NAMES ITSELF IN THE BAR ONCE ITS TITLE HAS SCROLLED UNDER IT (1d, #519):
 * `title`, after the path behind a 16 Rule 16 either side, at 13 and 600 in Ink, fading in over
 * 160ms and out the same way. Whether it has is `ListFrame.js`'s to measure, which marks its
 * lane; until then the name is hidden, from assistive tech too, which has the heading. An
 * asset's page scrolls its title away with no name coming in (1f), so it hands none.
 */

const LEVEL =
    "inline-flex h-control-inline min-w-0 items-center rounded-control px-control-inline-inset-x text-body-sm font-semibold text-foreground-muted hover:bg-hover";

/** The mark between two levels, Ink 4, 8 either side. */
function Separator() {
    return (
        <li aria-hidden="true" className="text-body-sm text-foreground-faint">
            {COPY.separator}
        </li>
    );
}

export default function Breadcrumb({ levels, current, title, phone = true }) {
    return (
        <nav
            aria-label={COPY.breadcrumb}
            className={`sticky top-0 z-10 flex h-breadcrumb items-center bg-background-translucent px-page-gutter font-ui backdrop-blur-sm ${phone ? "" : "max-sm:hidden"}`}
        >
            {current === undefined && levels.length === 1 && !levels[0].control ? (
                <Link href={levels[0].href} className={`${LEVEL} -mx-control-inline-inset-x gap-gap`}>
                    <Icon name="chevron-left" crop={[8, 8]} className="h-[var(--size-icon-sm)] shrink-0" />
                    {levels[0].label}
                </Link>
            ) : (
                <ol className="flex min-w-0 items-center gap-gap">
                    {levels.map((level, index) => (
                        <Fragment key={level.key ?? level.href}>
                            {index > 0 && <Separator />}
                            <li className="flex min-w-0">
                                {level.control ?? (
                                    <Link href={level.href} className={`${LEVEL} -mx-control-inline-inset-x`}>
                                        <span className="truncate">{level.label}</span>
                                    </Link>
                                )}
                            </li>
                        </Fragment>
                    ))}
                    {current !== undefined && (
                        <>
                            <Separator />
                            <li
                                aria-current="page"
                                className="flex h-control-inline shrink-0 items-center whitespace-nowrap text-body-sm font-semibold text-foreground-default tabular-nums"
                            >
                                {current}
                            </li>
                        </>
                    )}
                </ol>
            )}
            {title && (
                <div className="pointer-events-none invisible flex min-w-0 items-center opacity-0 transition-[opacity,visibility] duration-breadcrumb-title ease-out group-data-title-gone/list-frame:visible group-data-title-gone/list-frame:opacity-100">
                    <span aria-hidden="true" className="mx-breadcrumb-title-rule-inline h-breadcrumb-title-rule w-px shrink-0 bg-divider" />
                    <span className="min-w-0 truncate text-body-sm font-semibold text-foreground-default">{title}</span>
                </div>
            )}
        </nav>
    );
}

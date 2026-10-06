// The design's values: declared once, pinned by value, and read by name only
// where the design's two axes — the tools screens and the sign-in screens — are the
// only callers (#462, #473).
//
// FOUR CLAIMS, AND THE ORDER IS THE ORDER THEY DEPEND ON EACH OTHER.
//   1. `app/designValues.css` DECLARES AND DOES NOTHING ELSE: `@theme` blocks and
//      comments, and no rule that selects an element — a block's keyframes aside,
//      which select nothing and run an animation the block declares (#473).
//      `app/globals.css` imports it right after Tailwind and reads none of it.
//   2. EVERY DECLARATION IS THE DESIGN'S VALUE, typed out below rather than read
//      back from the file, with the relations the design states held beside it —
//      a wash is the foreground in an amount, every shadow and overlay is the
//      shadow ink in an amount, every size carries a line height on the 0.25rem
//      grid — and the ones this repository adds: a length is rem, a whole number of
//      the design's pixels over 16, outside the px kept by convention; no name
//      carries a digit; and no name is a key Tailwind or the app already declares.
//   3. A NAME IS READ ONLY BY A FILE THAT NOTHING OUTSIDE `app/(tools)/` AND
//      `app/login/` CALLS — but for the date, which #463 had drawn on every screen
//      and one component draws (`APP_WIDE`).
//   4. EVERY NAME IS READ, OR WAITS ON AN ISSUE NAMED BESIDE IT — and a face that
//      is read on an axis is loaded by its next/font call in a module that axis
//      reaches.
//
// BY LITERAL, WHICH IS #351's AND #353's LESSON APPLIED BEFORE IT COULD REPEAT.
// A table built from the declaration would pass for any value it held, so the
// figures are the design's, turned into rem and typed here, and a change to one is
// a change to both files in one commit. `verification.md` has the incident that
// taught it.
//
// A KEY ALREADY DECLARED IS A KEY THE MATERIALS SCREENS READ. `text-sm` and the
// app's own `--color-foreground` are both read across them today, so a name that
// took either key would restyle those screens with no change on them. The keys are
// read from Tailwind's own `theme.css` and from the app's other stylesheets rather
// than listed here, since the set that matters is the one the build sees. A value
// equal to one of Tailwind's is not a failure: a ladder the design draws is
// declared whole, and `docs/notes/design-system.md` has why.
//
// WHAT A CLASS READS IS TAILWIND'S ANSWER, NOT A SECOND ONE WRITTEN HERE. Which
// theme variable a utility resolves to is Tailwind's rule — `h-` reads a height,
// `bg-` a color, a variant wraps it, a modifier mixes it — and a copy of that rule
// would drift in the silent direction: a utility family this file did not know
// would be a read nobody saw, on a screen above the axis as easily as on one
// below. So the stylesheet is loaded through `__unstable__loadDesignSystem`, the
// entry point Tailwind's own editor tooling uses, and every token is handed to
// `candidatesToCss`. The lockfile pins the version; an upgrade that moves the
// entry point fails this file at load, which `run-all.mjs` names.
//
//   TWO NAMESPACES HIDE THE NAME IN WHAT THEY EMIT. A shadow utility inlines its
//   value, so a shadow is recognized by the `--tw-shadow` line its own utility
//   produces; and the faces live in `@theme inline`, so a face is recognized by
//   the next/font variable it resolves to. Both are asked of Tailwind as well.
//
// WHO READS IS WHO CALLS, NOT WHERE THE FILE SITS. #460's rail is written where any
// screen could call it and only the tools layout does, so a rule about directories
// would refuse it. The boundary is the import graph instead, walked from every
// route file under `app/`: a file that only the route files of `DESIGN_AXES` reach
// may read a name, a file that any other route file reaches may not — wherever it
// lives — and a file that no route file reaches reads nothing, since nothing
// renders it. Resolution is `unread-exports.mjs`'s `importedPairs`, the same
// reading of a specifier that check makes, rather than a third copy of it.
//
//   THE BOUNDARY WIDENED ONCE, TO THE SIGN-IN SCREENS (#473), AND ON A CONDITION. The
//   two axes may read the names because each has a layout of its own above all of its
//   pages and neither shares a component with the screens above them, so nothing a
//   name styles can reach a screen holding a width container of its own; a component
//   both axes call — `app/components/Controls.js` — may read one, and one any other
//   screen calls may not. **#258 is what widens it to every route file**: those
//   screens take one layout, the root layout applies the faces on its element, and
//   `DESIGN_AXES` gives way to every route file under `app/`, in the commit that does.
//
//   A FACE IS LOADED ON EACH AXIS THAT READS IT. The sign-in screens are outside the
//   tools layout, so a face loaded there does not reach them; a face a file reads is
//   loaded, for every axis whose routes reach that file, by a call in a module that
//   axis reaches and only the design's axes do — `app/faces/`, one module a face.
//
// A NAME THAT IS NOT READ YET WAITS ON THE ISSUE THAT READS IT FIRST, written in
// the table. A waiting name that something reads fails, so the pull request that
// reads it takes the mark out; an issue that lands takes its number out of
// `READERS_TO_COME`, and every name still waiting on it must then be read or
// undeclared. What this cannot see is an issue that lands without taking its
// number out — that pull request is the one editing this table, which is where
// it is caught.
//
// TAILWIND READS THIS FILE FOR CLASS NAMES, so every class planted below is
// assembled while the check runs and appears here only in pieces: a whole one
// spelled in this file would be built into every page's stylesheet
// (`app/components/listTableWidth.js` measured that). The variable names in the
// table are read the same way, which is why every declared variable reaches every
// page's `:root` from the commit that declares it. No rule Tailwind builds from
// the repository reads a name; `docs/notes/design-system.md` has the scan that
// measured it.
//
// WHAT IT CANNOT SEE: anything rendered, a class assembled at runtime in the app,
// a dynamic import(), and whether a face's loader class sits above the element
// reading the face. Those are a browser's. Nor a class left on a name a rename took
// away while the new name has another reader: that class reads nothing and the name
// is still read, so a rename counts its readers file by file before and after it, as
// #498 did, rather than leaving it to this file.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { listJsFiles, parseFile, parseSource, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { importedPairs } from "./unread-exports.mjs";

export const title = "The design's values — declared once, read by name on the tools and sign-in screens (#462, #473)";

const DECLARATION = "app/designValues.css";
const STYLESHEET = "app/globals.css";
const TOOLS_DIR = "app/(tools)/";
const SIGN_IN_DIR = "app/login/";

/**
 * The screens the design is applied to before #258, each by the directory of its route
 * files: the tools axis (#462) and the sign-in steps (#473). #258 replaces this with
 * every route file.
 */
const DESIGN_AXES = [TOOLS_DIR, SIGN_IN_DIR];

/**
 * THE ONE FILE A SCREEN ABOVE THE DESIGN'S AXES MAY REACH AND STILL READ A NAME, AND THE NAMES
 * IT MAY READ (#463). The date's notation — its dimmed slashes and the room before its time —
 * is drawn on every screen by that issue's decision, and `app/components/Instant.js` is the one
 * component that draws a date, on the materials screens as on the tools axis. So it reads the
 * four date names and nothing else, the check holds both halves, and an entry that no screen
 * above the axes reaches, or that reads none of its names, fails as stale. **#258 is what makes
 * it redundant**: the boundary becomes every route file, and this goes with it.
 */
const APP_WIDE = {
    "app/components/Instant.js": [
        "--opacity-date-separator",
        "--spacing-date-separator-inline",
        "--spacing-date-time-inline",
        "--spacing-mobile-date-time-inline",
    ],
};

/** Tailwind's own keyframes, which an animation declared here may run without declaring them. */
const TAILWIND_KEYFRAMES = ["spin", "ping", "pulse", "bounce"];

/**
 * The issues that read a name next. An issue that lands takes its number out, and
 * every name still waiting on it then has to be read or undeclared. #456 took its own
 * number out when the frame and the controls it opens began reading theirs. #459 took
 * its own out as well, and it was written here as waiting on nothing, which 1k's
 * drawing did not bear out: its notice lists ids in the id face on a dialog's summary,
 * so it was the first reader of three names marked for #457 and declared the three the
 * summary needed. #460 took its own out with the rail, the breadcrumb and the tooltip:
 * it read three of #457's first, handed the tooltip above a target and a column's End
 * to #463, left the Panel's wash to #457, which takes out what the spec dropped, and
 * undeclared the account's two with the account. #457 took its own out with the labels'
 * dialog, which read the three names still marked for it, and undeclared the Panel's
 * wash, which nothing draws since the files of 2026-10-01 put nothing behind a Panel.
 * #478 drew the account and declared its two again, and its menu and avatar read three
 * names marked for #463 first: the menu's two widths and Face hover.
 * #458 took its own out with the tool item page's dialogs and 1f's three sheets: they
 * read the sheets' names and the phone's type, fields and buttons, and seven of #463's
 * first — the sheet button, the sheet that confirms and Red's hover — and the foot bar
 * went to the issues that draw one: its room, its 50 button and the pill to #473, whose
 * step pages draw them now, and the pill's chevron side and a field's icon to #463's
 * tool item page. The foot bar's shadow was undeclared, since 0a now draws it none.
 * #473 took its own out with the sign-in steps: they read five of the six names #458
 * marked for it — the foot bar's room above and below, its 50 button and the pill — and
 * three of #463's first, the Page title at both widths and a phone field's gap, and the
 * foot bar's 12 between its rows went to #463's tool item page, since no step page has
 * two. The steps declared their own names with them and read the account's avatar for an
 * address chip's.
 * #463 took its own out with the tool item page and the two lists, which read the eight
 * names still marked for it — 0b's row, column head and bleed, a list head's 20 above it,
 * and the selection bar's four — and declared the lists' own with them, 1a and 1b's
 * figures where the spec states none, and 0j's Badge and 0e's Ink 5 for the checkbox.
 * #495 declared eight with their readers when the design's final files reached the merged
 * screens — the account menu's offset and entrance, a menu's head, a selection bar's reason,
 * the phone menu's account row and its room, and the resend control's spinner track — renamed
 * the sign-in page's refusal gap for the line a dialog draws the same way now,
 * `--spacing-refusal-gap`, and undeclared the 4 the resend control pulled left, which pulls
 * its whole 8 now.
 * No issue is marked to read a name next.
 */
const READERS_TO_COME = [];

/**
 * Every declaration in `app/designValues.css`, by value, with the issue that reads
 * it first — `null` once a screen reads it. A two-element row is a part of the
 * size above it (its line height, tracking or weight) and is read with that size.
 * A length is the design's px over 16; the design-system notes carry the px.
 */
const VALUES = [
    // 0a · Control
    ["--height-control-lg", "2.25rem", null],
    ["--height-control", "2rem", null],
    ["--height-control-sm", "1.875rem", null],
    ["--height-control-inline", "1.625rem", null],
    ["--height-dialog-close", "1.75rem", null],
    ["--size-icon", "1rem", null],
    ["--size-checkbox-mark", "0.75rem", null],
    ["--size-icon-sm", "0.875rem", null],
    ["--spacing-control-inline-inset-x", "0.5rem", null],
    ["--spacing-control-inset-x", "0.625rem", null],
    ["--spacing-control-lg-inset-x", "1rem", null],
    // A sign-in page's field and action, and the line under any field (#473).
    ["--height-control-xl", "2.5rem", null],
    ["--spacing-control-xl-inset-x", "0.75rem", null],
    ["--spacing-input-message-stack", "0.375rem", null],
    ["--min-width-menu", "8.75rem", null],
    ["--max-width-menu", "17.5rem", null],
    ["--spacing-menu-offset", "0.375rem", null],
    ["--spacing-menu-inset", "0.3125rem", null],
    // 0a Menu's head, which names what follows (#495).
    ["--spacing-menu-heading-inset-y", "0.375rem", null],
    // 0b · Layout
    ["--container-content", "67.5rem", null],
    ["--spacing-page-gutter", "2rem", null],
    ["--spacing-gap", "0.5rem", null],
    ["--spacing-gap-lg", "0.875rem", null],
    ["--spacing-nav-gap", "0.6875rem", null],
    ["--spacing-list-header-inset-top", "1.25rem", null],
    ["--height-table-row", "2.5rem", null],
    ["--spacing-table-bleed", "0.75rem", null],
    ["--height-table-header", "2.25rem", null],
    ["--spacing-selection-bar-offset", "0.75rem", null],
    ["--spacing-selection-bar-inset", "0.5rem", null],
    ["--spacing-selection-bar-slide", "0.5rem", null],
    ["--transition-duration-selection-bar", "160ms", null],
    // The mark that leads an action's reason in the bar (#495).
    ["--spacing-selection-bar-reason-gap", "0.375rem", null],
    // 1a and 1b's drawings, where the spec states no figure — #463's lists.
    ["--spacing-list-header-inset-bottom", "1.25rem", null],
    ["--spacing-list-header-inline", "2.5rem", null],
    ["--spacing-list-count-inline", "0.3125rem", null],
    ["--spacing-table-column-inline", "1.25rem", null],
    ["--width-table-count", "6rem", null],
    ["--width-table-id", "15rem", null],
    ["--width-table-status", "10rem", null],
    ["--spacing-pager-inset-top", "1rem", null],
    ["--spacing-pager-inset-bottom", "1.25rem", null],
    ["--spacing-pager-inline", "1.5rem", null],
    ["--spacing-pager-step-gap", "0.625rem", null],
    ["--spacing-pager-step-bleed", "0.8125rem", null],
    ["--spacing-list-empty-state-inset-top", "15rem", null],
    // 0c · Blue
    ["--color-selected", "#F0F9FF", null],
    ["--color-selected-hover", "#E6F5FF", null],
    ["--color-primary", "oklch(0.487 0.216 257)", null],
    ["--color-primary-hover", "oklch(0.437 0.211 257)", null],
    ["--color-primary-disabled", "color-mix(in oklab, var(--color-primary) 40%, transparent)", null],
    // 0d · Red
    ["--color-danger-subtle", "#FFF4F5", null],
    ["--color-danger", "#DC0015", null],
    ["--color-danger-hover", "oklch(0.512 0.205 27)", null],
    // 0e · Ink
    ["--color-foreground-default", "oklch(0.255 0.013 265)", null],
    ["--color-foreground-muted", "oklch(0.405 0.013 265)", null],
    ["--color-foreground-subtle", "oklch(0.505 0.012 265)", null],
    ["--color-foreground-faint", "oklch(0.760 0.010 265)", null],
    ["--color-checkbox-border", "oklch(0.800 0.010 265)", null],
    ["--spacing-separator-inline", "0.5625rem", null],
    ["--color-divider-subtle", "oklch(0.946 0.005 265)", null],
    ["--color-divider", "oklch(0.928 0.006 265)", null],
    ["--color-divider-strong", "oklch(0.896 0.007 265)", null],
    ["--color-border", "oklch(0.888 0.008 265)", null],
    ["--color-border-focus", "oklch(0.640 0.010 265)", null],
    ["--color-hover-subtle", "color-mix(in oklab, var(--color-foreground-default) 3%, transparent)", null],
    ["--color-background-muted", "color-mix(in oklab, var(--color-foreground-default) 4.5%, transparent)", null],
    ["--color-hover", "color-mix(in oklab, var(--color-foreground-default) 5.5%, transparent)", null],
    ["--color-scrollbar-thumb", "color-mix(in oklab, var(--color-foreground-default) 20%, transparent)", null],
    ["--color-scrollbar-thumb-hover", "color-mix(in oklab, var(--color-foreground-default) 34%, transparent)", null],
    // 0f · States
    ["--width-number-input", "7.5rem", null],
    ["--spacing-stepper-inset-x", "0.1875rem", null],
    // A busy action (#473); its turn and its track are the drawings', not the spec's.
    ["--transition-delay-busy", "300ms", null],
    ["--size-spinner", "1rem", null],
    ["--animate-spinner", "spin 0.7s linear infinite", null],
    ["--color-spinner-track", "color-mix(in oklab, currentColor 35%, transparent)", null],
    // 0g · Status
    ["--size-status-indicator", "0.5625rem", null],
    ["--stroke-width-status-ring", "1.5px", null],
    // 0h · Type
    ["--text-heading-lg", "1.5rem", null],
    ["--text-heading-lg--line-height", "2rem"],
    ["--text-heading-lg--letter-spacing", "-0.012em"],
    ["--text-heading-lg--font-weight", "600"],
    ["--text-heading", "1rem", null],
    ["--text-heading--line-height", "1.5rem"],
    ["--text-body", "0.875rem", null],
    ["--text-body--line-height", "1.25rem"],
    ["--text-body-sm", "0.8125rem", null],
    ["--text-body-sm--line-height", "1.25rem"],
    ["--text-heading-sm", "0.75rem", null],
    ["--text-heading-sm--line-height", "1rem"],
    ["--text-heading-sm--font-weight", "600"],
    // The wordmark in the rail, Bricolage Grotesque since the files of 2026-10-01 (#460).
    ["--text-brand", "1rem", null],
    ["--text-brand--line-height", "1.5rem"],
    ["--text-brand--font-weight", "500"],
    ["--text-brand-lg", "1.25rem", null],
    ["--text-brand-lg--line-height", "1.75rem"],
    ["--text-brand-lg--font-weight", "500"],
    ["--tracking-id", "-0.02em", null],
    ["--tracking-brand", "-0.03em", null],
    // A date, on every screen (#463), and the one name group a file the screens above the
    // tools axis reach may read — `APP_WIDE` below. From the drawings, not the spec.
    ["--opacity-date-separator", "45%", null],
    ["--spacing-date-separator-inline", "1.5px", null],
    ["--spacing-date-time-inline", "0.5625rem", null],
    ["--spacing-mobile-date-time-inline", "0.5rem", null],
    ["--font-ui", "var(--font-instrument-sans), system-ui, sans-serif", null],
    ["--font-id", "var(--font-fragment-mono), ui-monospace, monospace", null],
    ["--font-brand", "var(--font-bricolage-grotesque), sans-serif", null],
    // 0i · Scroll — a column's End is the column's, and #463 draws the columns.
    ["--spacing-scrollbar-gutter", "8px", null],
    ["--spacing-scrollbar-inset", "1px", null],
    ["--spacing-scroll-inset-bottom", "2.5rem", null],
    // 0j · Radius
    ["--radius-preview", "0.125rem", null],
    ["--radius-badge", "0.25rem", null],
    ["--radius-control", "0.5rem", null],
    ["--radius-card", "0.625rem", null],
    ["--radius-dialog", "0.75rem", null],
    // 0k · Elevation
    ["--color-elevation", "oklch(0.22 0.025 265)", null],
    ["--color-background-translucent", "oklch(1 0 0 / 0.82)", null],
    ["--color-dialog-overlay", "color-mix(in oklab, var(--color-elevation) 40%, transparent)", null],
    [
        "--shadow-popover",
        "0 8px 24px color-mix(in oklab, var(--color-elevation) 10%, transparent), 0 1px 2px color-mix(in oklab, var(--color-elevation) 6%, transparent)",
        null,
    ],
    ["--shadow-drawer", "0 12px 48px color-mix(in oklab, var(--color-elevation) 16%, transparent)", null],
    ["--shadow-dialog", "0 24px 60px color-mix(in oklab, var(--color-elevation) 24%, transparent)", null],
    [
        "--shadow-preview",
        "0 0 0 1px color-mix(in oklab, var(--color-elevation) 6%, transparent), 0 2px 8px color-mix(in oklab, var(--color-elevation) 8%, transparent)",
        null,
    ],
    ["--spacing-tooltip-inset-top", "0.1875rem", null],
    ["--spacing-tooltip-inset-x", "0.5625rem", null],
    ["--spacing-tooltip-inset-bottom", "0.25rem", null],
    // Above a target, which no rail icon is; the next tooltip on the axis is #463's.
    ["--spacing-tooltip-offset", "0.375rem", null],
    ["--spacing-tooltip-rail-offset", "0.625rem", null],
    ["--transition-delay-tooltip", "360ms", null],
    // From the drawings' stylesheet, not the spec (#460).
    ["--transition-duration-tooltip", "120ms", null],
    // 0l · Modal
    ["--container-dialog", "26.25rem", null],
    ["--spacing-dialog-gutter", "1.75rem", null],
    ["--spacing-dialog-inset", "1.5rem", null],
    ["--spacing-dialog-header-stack", "1.25rem", null],
    ["--spacing-dialog-inline", "0.75rem", null],
    ["--spacing-dialog-close-bleed", "0.25rem", null],
    ["--spacing-dialog-header-inline", "1rem", null],
    ["--spacing-dialog-title-stack", "0.125rem", null],
    ["--spacing-dialog-summary-inset-y", "1rem", null],
    ["--spacing-dialog-summary-inset-x", "1.125rem", null],
    ["--spacing-dialog-summary-stack", "0.25rem", null],
    // A message about a whole dialog or page, its mark to its sentence — the sign-in page's
    // name until #495, when 0l set a dialog's the same way.
    ["--spacing-refusal-gap", "0.375rem", null],
    ["--container-dialog-preview", "48.75rem", null],
    ["--height-dialog-preview", "32.5rem", null],
    ["--width-dialog-preview-pane", "27.5rem", null],
    ["--spacing-dialog-preview-stack", "1.25rem", null],
    ["--spacing-dialog-preview-inline", "0.75rem", null],
    ["--spacing-dialog-column-stack", "1.5rem", null],
    ["--spacing-dialog-column-list-stack", "0.25rem", null],
    ["--size-dialog-step", "1.25rem", null],
    // 0m · Navigation
    ["--width-rail", "3.5rem", null],
    ["--width-rail-expanded", "15.5rem", null],
    ["--spacing-rail-inset", "0.75rem", null],
    ["--transition-duration-rail", "200ms", null],
    ["--ease-rail", "cubic-bezier(0.2, 0, 0, 1)", null],
    // From the drawings, not the spec (#460).
    ["--spacing-rail-stack", "0.125rem", null],
    ["--spacing-rail-divider-stack", "0.625rem", null],
    // The account at the rail's foot (#478), declared again with its first reader.
    ["--height-account", "3rem", null],
    ["--size-avatar", "1.5rem", null],
    // From the drawings, not the spec (#478).
    ["--spacing-account-gap", "0.625rem", null],
    ["--spacing-account-inset-right", "0.75rem", null],
    ["--spacing-account-name-stack", "0.0625rem", null],
    ["--size-account-chevron", "0.8125rem", null],
    ["--transition-duration-avatar", "90ms", null],
    // 0m's account menu, beside a collapsed button and growing in (#495).
    ["--spacing-account-menu-offset-x", "0.5rem", null],
    ["--animate-account-menu", "account-menu-in 120ms ease-out", null],
    ["--height-breadcrumb", "3rem", null],
    // From the drawings, not the spec (#460).
    ["--spacing-breadcrumb-back-bleed", "0.75rem", null],
    ["--spacing-breadcrumb-back-gap", "0.125rem", null],
    // 0n · Record page
    ["--spacing-record-header-stack", "1.5rem", null],
    ["--spacing-breadcrumb-stack", "0.875rem", null],
    ["--spacing-title-stack", "0.625rem", null],
    ["--spacing-subtitle-stack", "0.75rem", null],
    ["--spacing-heading-sm-stack", "0.75rem", null],
    // The record rail on 1080 (#463), which #462 left undeclared, its label block and the
    // history beside it; all but the rail's three from the drawings, not the spec.
    ["--spacing-record-header-inline", "3.5rem", null],
    ["--width-record-rail", "21rem", null],
    ["--spacing-record-rail-inline", "2rem", null],
    ["--spacing-record-rail-inset-left", "1.75rem", null],
    ["--spacing-label-block-stack", "1rem", null],
    ["--spacing-label-preview-inset-x", "1rem", null],
    ["--spacing-label-preview-inset-y", "1.75rem", null],
    ["--width-label-fact-term", "4rem", null],
    ["--spacing-label-fact-inline", "0.75rem", null],
    ["--spacing-label-fact-stack", "0.25rem", null],
    ["--width-log-track", "1.25rem", null],
    ["--size-log-dot", "0.375rem", null],
    ["--spacing-log-dot-inset-top", "0.4375rem", null],
    ["--spacing-log-rule-inset-top", "1.25rem", null],
    ["--spacing-log-rule-overhang", "0.1875rem", null],
    ["--spacing-log-line-stack", "0.1875rem", null],
    ["--spacing-log-stack", "1.5rem", null],
    ["--max-width-empty-state", "27.5rem", null],
    // 0o · Sign-in page (#473); the name fields' 12 and the caret's height are the drawings'.
    // Its chip's avatar is the account's, above.
    ["--container-sign-in", "22.5rem", null],
    ["--spacing-sign-in-inset-top", "16.75rem", null],
    ["--spacing-sign-in-brand-stack", "2.5rem", null],
    ["--spacing-sign-in-title-stack", "0.5rem", null],
    ["--spacing-sign-in-header-stack", "2rem", null],
    ["--spacing-sign-in-form-stack", "1.5rem", null],
    ["--spacing-sign-in-form-inline", "0.75rem", null],
    ["--spacing-avatar-chip-inset-left", "0.25rem", null],
    ["--spacing-avatar-chip-inset-right", "0.75rem", null],
    ["--size-code-slot", "3.25rem", null],
    ["--spacing-code-group-inline", "1rem", null],
    ["--spacing-code-slot-inset-top", "0.125rem", null],
    ["--text-code-slot", "1.375rem", null],
    ["--text-code-slot--line-height", "1.75rem"],
    ["--text-code-slot--font-weight", "500"],
    ["--width-code-caret", "0.125rem", null],
    ["--height-code-caret", "1.5rem", null],
    ["--animate-code-caret", "code-caret-blink 1s steps(1) infinite", null],
    // The resend control's spinner, whose words are Accent (#495).
    ["--color-code-resend-spinner-track", "color-mix(in oklab, currentColor 25%, transparent)", null],
    // Tools 0a · App — #458's sheets and #473's step pages read theirs, and #463's tool item
    // page the foot bar's 12 between its rows.
    ["--spacing-mobile-gutter", "1rem", null],
    ["--height-mobile-top-bar", "3.5rem", null],
    ["--spacing-mobile-top-bar-inset-right", "0.25rem", null],
    ["--size-mobile-top-bar-icon", "1.5rem", null],
    // The top bar's soft edge (#463), the bottom bar's again on the bar above; the fade is the drawings'.
    ["--spacing-mobile-top-bar-bleed", "1.5rem", null],
    ["--transition-duration-mobile-top-bar", "160ms", null],
    ["--spacing-mobile-bottom-bar-inset-top", "1rem", null],
    ["--spacing-mobile-bottom-bar-inset-bottom", "1.25rem", null],
    ["--spacing-mobile-bottom-bar-stack", "0.75rem", null],
    // The bottom bar on the keyboard and its soft edge (#473); the fade is the drawings'.
    ["--spacing-mobile-bottom-bar-keyboard-inset-bottom", "0.75rem", null],
    ["--spacing-mobile-bottom-bar-bleed", "1.5rem", null],
    ["--transition-duration-mobile-bottom-bar", "160ms", null],
    ["--spacing-mobile-touch-target", "3rem", null],
    ["--text-mobile-heading-lg", "1.375rem", null],
    ["--text-mobile-heading-lg--line-height", "1.75rem"],
    ["--text-mobile-heading-lg--letter-spacing", "-0.012em"],
    ["--text-mobile-heading-lg--font-weight", "600"],
    ["--text-mobile-heading", "1.0625rem", null],
    ["--text-mobile-heading--line-height", "1.5rem"],
    ["--text-mobile-body", "1rem", null],
    ["--text-mobile-body--line-height", "1.5rem"],
    ["--text-mobile-body-sm", "0.9375rem", null],
    ["--text-mobile-body-sm--line-height", "1.25rem"],
    ["--text-mobile-body-xs", "0.875rem", null],
    ["--text-mobile-body-xs--line-height", "1.25rem"],
    ["--text-mobile-heading-sm", "0.8125rem", null],
    ["--text-mobile-heading-sm--line-height", "1.25rem"],
    ["--text-mobile-heading-sm--font-weight", "600"],
    ["--text-mobile-brand", "1.0625rem", null],
    ["--text-mobile-brand--line-height", "1.5rem"],
    ["--text-mobile-brand--font-weight", "500"],
    ["--height-mobile-button", "3.125rem", null],
    ["--height-mobile-dialog-button", "3rem", null],
    ["--size-mobile-spinner", "1.25rem", null],
    ["--height-mobile-input", "3.125rem", null],
    ["--spacing-mobile-input-inset-x", "1rem", null],
    ["--size-mobile-input-icon", "1.125rem", null],
    ["--spacing-mobile-input-gap", "0.625rem", null],
    ["--color-mobile-input-background", "color-mix(in oklab, var(--color-foreground-default) 5.5%, transparent)", null],
    ["--spacing-mobile-field-stack", "1.25rem", null],
    // From the drawings, not the spec (#458).
    ["--size-mobile-input-clear-icon", "0.9375rem", null],
    // The clear ×'s target, a phone field's refusal and the alert (#473); the target is the
    // drawings'.
    ["--spacing-mobile-input-clear-inset-right", "0.375rem", null],
    ["--spacing-mobile-input-message-inset-x", "0.25rem", null],
    ["--spacing-mobile-input-message-gap", "0.375rem", null],
    ["--spacing-mobile-alert-inset-y", "0.875rem", null],
    ["--spacing-mobile-alert-inset-x", "1rem", null],
    ["--size-mobile-alert-icon", "1.125rem", null],
    ["--spacing-mobile-alert-gap", "0.625rem", null],
    ["--height-mobile-chip", "2.25rem", null],
    ["--spacing-mobile-chip-inset-x", "0.875rem", null],
    ["--spacing-mobile-chip-inset-right", "0.75rem", null],
    ["--size-mobile-chip-chevron", "0.6875rem", null],
    ["--spacing-mobile-avatar-chip-inset-left", "0.375rem", null],
    ["--size-mobile-status-indicator", "0.625rem", null],
    ["--radius-mobile-control", "0.75rem", null],
    ["--radius-mobile-drawer", "1.75rem", null],
    ["--opacity-mobile-pressed", "50%", null],
    ["--spacing-mobile-top-bar-stack", "1rem", null],
    ["--spacing-mobile-title-stack", "1.375rem", null],
    ["--spacing-mobile-stack", "2rem", null],
    // A phone's sign-in page (#473); the caret's height is the drawings'.
    ["--spacing-mobile-sign-in-inset-top", "4.5rem", null],
    ["--spacing-mobile-sign-in-brand-stack", "2rem", null],
    ["--spacing-mobile-code-stack", "1.5rem", null],
    ["--spacing-mobile-code-help-stack", "1.25rem", null],
    ["--height-mobile-code-caret", "1.625rem", null],
    ["--size-mobile-log-dot", "0.375rem", null],
    ["--spacing-mobile-log-gap", "0.75rem", null],
    ["--spacing-mobile-log-stack", "1.25rem", null],
    ["--size-mobile-log-icon", "0.875rem", null],
    // 1f's history, 1g's notice and its screen for a code no tool carries (#463), from the
    // drawings, not the spec.
    ["--width-mobile-log-track", "0.75rem", null],
    ["--spacing-mobile-log-dot-inset-top", "0.5625rem", null],
    ["--spacing-mobile-log-rule-inset-top", "1.375rem", null],
    ["--spacing-mobile-log-rule-overhang", "0.25rem", null],
    ["--spacing-mobile-title-alert-stack", "0.25rem", null],
    ["--size-mobile-empty-state-icon", "2.5rem", null],
    ["--spacing-mobile-empty-state-inset-x", "2rem", null],
    ["--spacing-mobile-empty-state-inset-bottom", "6rem", null],
    ["--max-width-mobile-empty-state", "17.5rem", null],
    ["--width-mobile-drawer-handle", "2.25rem", null],
    ["--height-mobile-drawer-handle", "0.25rem", null],
    ["--spacing-mobile-drawer-inset-top", "0.75rem", null],
    ["--spacing-mobile-drawer-title-inset-y", "0.875rem", null],
    ["--height-mobile-drawer-row", "3.5rem", null],
    ["--spacing-mobile-drawer-row-inset-y", "0.9375rem", null],
    ["--spacing-mobile-drawer-row-inset-x", "1rem", null],
    ["--spacing-mobile-drawer-inset-bottom", "1.25rem", null],
    ["--shadow-mobile-drawer", "0 -12px 48px color-mix(in oklab, var(--color-elevation) 16%, transparent)", null],
    ["--color-mobile-drawer-overlay", "color-mix(in oklab, var(--color-elevation) 24%, transparent)", null],
    // From the drawings, not the spec (#458).
    ["--size-mobile-drawer-row-icon", "1.0625rem", null],
    ["--spacing-mobile-drawer-heading-stack", "0.25rem", null],
    ["--spacing-mobile-drawer-header-action-inset-x", "0.75rem", null],
    // The sheet that confirms gives every sheet's actions their arrangement (#458).
    ["--spacing-mobile-drawer-body-stack", "1.25rem", null],
    ["--spacing-mobile-drawer-action-stack", "0.75rem", null],
    ["--spacing-mobile-confirm-inset-top", "1.5rem", null],
    ["--spacing-mobile-confirm-title-stack", "0.25rem", null],
    ["--spacing-mobile-confirm-id-stack", "0.875rem", null],
    ["--width-mobile-menu", "14.5rem", null],
    ["--spacing-mobile-menu-gutter", "0.75rem", null],
    ["--spacing-mobile-menu-offset", "0.25rem", null],
    ["--spacing-mobile-menu-row-inset-x", "1rem", null],
    // The account the top bar's menu ends on (#495).
    ["--height-mobile-menu-account", "3.5rem", null],
    ["--spacing-mobile-menu-account-inset-y", "0.5rem", null],
];

/**
 * The lengths that stay px: what is drawn in px by convention. The ring is a
 * stroke, and the scrollbar's lane is the browser's own, whose width follows no
 * text size, so the clearance inside it follows it. The room either side of a
 * date's slash is a fraction of a pixel, which no whole number of the design's
 * pixels over 16 states (#463). Every shadow stays px too, and is not a length.
 */
const PX_KEPT = ["--stroke-width-status-ring", "--spacing-scrollbar-gutter", "--spacing-scrollbar-inset", "--spacing-date-separator-inline"];

/**
 * The three faces: the only names in `@theme inline`, each resolving to the
 * variable its next/font call sets. A face that is read on an axis needs that call,
 * with that `variable`, in a file that axis reaches and only the design's axes do.
 */
const FACES = {
    "--font-ui": { loader: "Instrument_Sans", variable: "--font-instrument-sans" },
    "--font-id": { loader: "Fragment_Mono", variable: "--font-fragment-mono" },
    "--font-brand": { loader: "Bricolage_Grotesque", variable: "--font-bricolage-grotesque" },
};

/** The route files Next renders from, under `app/`. A file one of them reaches is on a page. */
const ROUTE_FILE = /^app\/(.*\/)?(page|layout|template|loading|error|not-found|default|global-error|route)\.js$/;

/** The design axis a route file is on, by its directory, or null for any other route. */
const axisOf = (rel) => DESIGN_AXES.find((dir) => rel.startsWith(dir)) ?? null;
const onDesignAxis = (rel) => axisOf(rel) !== null;
const isToolsFile = (rel) => axisOf(rel) === TOOLS_DIR;

const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// ─────────────────────────────────────────────────────────────────────────────
// The declaration
// ─────────────────────────────────────────────────────────────────────────────

/** Where the brace opened at `open` closes, the index after it. */
function blockEnd(text, open) {
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
    }
    return j;
}

/**
 * The top level of a declaration file: its `@theme` blocks with their
 * declarations and the keyframes inside them, and anything else — which the file
 * must not have. Comments are stripped first, so a comment may say anything.
 *
 * A KEYFRAMES BLOCK INSIDE `@theme` IS TAILWIND'S WAY TO DECLARE WHAT AN ANIMATION
 * RUNS (#473): it selects no element, and Tailwind emits it only once an animation
 * naming it is read. So it is taken out of the block whole and named, rather than
 * read as a stray, and the run below holds every one to an animation that runs it.
 */
export function parseDeclaration(css) {
    const text = withoutComments(css);
    const blocks = [];
    const other = [];
    let i = 0;
    while (i < text.length) {
        if (/\s/.test(text[i])) {
            i++;
            continue;
        }
        const rest = text.slice(i);
        const theme = /^@theme(\s+inline)?\s*\{/.exec(rest);
        if (theme) {
            const j = blockEnd(text, i + theme[0].length - 1);
            let body = text.slice(i + theme[0].length, j - 1);
            const keyframes = [];
            for (let at = body.search(/@keyframes\s/); at !== -1; at = body.search(/@keyframes\s/)) {
                const head = /^@keyframes\s+([A-Za-z0-9_-]+)\s*\{/.exec(body.slice(at));
                if (!head) break;
                const end = blockEnd(body, at + head[0].length - 1);
                keyframes.push(head[1]);
                body = body.slice(0, at) + body.slice(end);
            }
            const declarations = [];
            for (const piece of body.split(";")) {
                const trimmed = piece.trim();
                if (!trimmed) continue;
                const colon = trimmed.indexOf(":");
                declarations.push(
                    colon > 0 && trimmed.startsWith("--")
                        ? { name: trimmed.slice(0, colon).trim(), value: trimmed.slice(colon + 1).trim().replace(/\s+/g, " ") }
                        : { stray: trimmed }
                );
            }
            // `@theme inline` bakes each value into its utility, so the value resolves
            // where the utility is used rather than at `:root`.
            blocks.push({ resolvedAtUse: Boolean(theme[1]), declarations, keyframes });
            i = j;
            continue;
        }
        const end = text.indexOf(";", i);
        other.push((end === -1 ? rest : text.slice(i, end)).trim().slice(0, 80));
        i = end === -1 ? text.length : end + 1;
    }
    return { blocks, other };
}

/** Every custom property a stylesheet declares, comments aside. */
const keysOf = (css) => new Set([...withoutComments(css).matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));

// ─────────────────────────────────────────────────────────────────────────────
// Tailwind, asked what a token reads
// ─────────────────────────────────────────────────────────────────────────────

const requireFromRepo = createRequire(join(REPO_ROOT, "package.json"));

/** The app's own stylesheet, loaded the way the build loads it. */
async function loadDesignSystem(stylesheet = STYLESHEET) {
    const tailwind = requireFromRepo("tailwindcss");
    const path = join(REPO_ROOT, stylesheet);
    return tailwind.__unstable__loadDesignSystem(readFileSync(path, "utf8"), {
        base: dirname(path),
        async loadStylesheet(id, base) {
            const file = id === "tailwindcss" ? requireFromRepo.resolve("tailwindcss/index.css") : resolve(base, id);
            return { path: file, base: dirname(file), content: readFileSync(file, "utf8") };
        },
    });
}

/**
 * For each token, the declared names it reads: the variables its CSS refers to,
 * a shadow by its `--tw-shadow` line, and a face by the variable it resolves to.
 * Anything Tailwind does not know as a utility reads nothing.
 */
function makeReader(ds, declaredNames) {
    const shadowDeclarations = new Map();
    for (const name of declaredNames) {
        if (!name.startsWith("--shadow-")) continue;
        const css = ds.candidatesToCss([`shadow-${name.slice("--shadow-".length)}`])[0] ?? "";
        const declaration = css.match(/--tw-shadow:[^;]*;/)?.[0];
        if (declaration) shadowDeclarations.set(name, declaration);
    }
    const faceByVariable = new Map(Object.entries(FACES).map(([face, { variable }]) => [variable, face]));

    const cache = new Map();
    return function readsOf(tokens) {
        const fresh = [...new Set(tokens)].filter((t) => !cache.has(t));
        if (fresh.length > 0) {
            const css = ds.candidatesToCss(fresh);
            fresh.forEach((token, k) => {
                const reads = new Set();
                const out = css[k];
                if (out) {
                    for (const [, v] of out.matchAll(/var\((--[a-z0-9-]+)/gi)) {
                        if (declaredNames.has(v)) reads.add(v);
                        if (faceByVariable.has(v)) reads.add(faceByVariable.get(v));
                    }
                    for (const [name, declaration] of shadowDeclarations) if (out.includes(declaration)) reads.add(name);
                }
                cache.set(token, reads);
            });
        }
        const all = new Set();
        for (const t of tokens) for (const name of cache.get(t)) all.add(name);
        return all;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// The corpus and who calls it
// ─────────────────────────────────────────────────────────────────────────────

function cssFiles(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) cssFiles(full, out);
        else if (entry.name.endsWith(".css")) out.push(full);
    }
    return out;
}

const repoRelative = (abs) => toPosix(relative(REPO_ROOT, abs));

/** Every string a module holds — literals and template chunks, never comments. */
function stringsOf(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        else if (n.type === "TemplateElement") out.push(n.value.cooked ?? n.value.raw);
    });
    return out;
}

const tokensOf = (strings) => strings.flatMap((s) => s.split(/\s+/)).filter(Boolean);

function varRefsOf(text, declaredNames) {
    const out = new Set();
    for (const [, v] of text.matchAll(/var\((--[a-z0-9-]+)/gi)) if (declaredNames.has(v)) out.add(v);
    return out;
}

/** Every next/font/google call and the `variable` it passes, by the name it imports. */
function loadersOf(rel, ast) {
    const locals = new Map();
    walk(ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source?.value === "next/font/google") {
            for (const s of n.specifiers) if (s.type === "ImportSpecifier") locals.set(s.local.name, s.imported.name);
        }
    });
    const out = [];
    walk(ast, (n) => {
        if (n.type !== "CallExpression" || n.callee?.type !== "Identifier" || !locals.has(n.callee.name)) return;
        const options = n.arguments[0];
        const variable = options?.type === "ObjectExpression"
            ? options.properties.find((p) => p.key?.name === "variable" && p.value?.type === "Literal")?.value.value
            : undefined;
        out.push({ file: rel, imported: locals.get(n.callee.name), variable });
    });
    return out;
}

/** Forward reach from every route file: for each file, the route files that reach it. */
function routesReaching(graph) {
    const reachedBy = new Map();
    for (const route of [...graph.keys()].filter((f) => ROUTE_FILE.test(f))) {
        const seen = new Set();
        const stack = [route];
        while (stack.length > 0) {
            const file = stack.pop();
            if (seen.has(file)) continue;
            seen.add(file);
            if (!reachedBy.has(file)) reachedBy.set(file, new Set());
            reachedBy.get(file).add(route);
            for (const next of graph.get(file) ?? []) stack.push(next);
        }
    }
    return reachedBy;
}

// ─────────────────────────────────────────────────────────────────────────────
// The judgment — pure, so the planted cases below go through the same code
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `waiting` maps every tracked name to the issue it waits on, or null once read.
 * `sources` maps a name to the names its value mixes in. Returns what was read
 * and every failure, each a sentence naming the file.
 */
export function judge({ waiting, sources, readsByFile, routesByFile, loaders, readersToCome, appWide = APP_WIDE }) {
    const failures = [];
    const read = new Set();
    // For each face, the design axes whose routes reach a file that reads it.
    const faceAxes = new Map(Object.keys(FACES).map((face) => [face, new Set()]));
    for (const [file, names] of readsByFile) {
        if (names.size === 0) continue;
        const routes = [...(routesByFile.get(file) ?? [])];
        const above = routes.filter((r) => !onDesignAxis(r));
        // #463 — the one file every screen may reach and read the names it is allowed.
        const allowed = appWide[file];
        if (above.length > 0 && allowed) {
            const beyond = [...names].filter((name) => !allowed.includes(name));
            if (beyond.length > 0) failures.push(`${file} reads ${beyond.join(", ")}, which it is not allowed on every screen`);
            for (const name of names) if (allowed.includes(name)) read.add(name);
        } else if (above.length > 0) {
            failures.push(`${file} reads ${[...names].join(", ")} and ${above.sort()[0]} calls it`);
        } else if (routes.length > 0) {
            for (const name of names) {
                read.add(name);
                for (const route of routes) faceAxes.get(name)?.add(axisOf(route));
            }
        }
    }
    // A value mixing another name in reads it, for as long as the value is read.
    let grew = true;
    while (grew) {
        grew = false;
        for (const [name, used] of sources) {
            if (!read.has(name)) continue;
            for (const source of used) {
                if (!read.has(source)) {
                    read.add(source);
                    grew = true;
                }
            }
        }
    }
    // A stale exception: a file no screen above the axes reaches needs none, and one that
    // reads none of its names has nothing to be excepted for.
    for (const [file, allowed] of Object.entries(appWide)) {
        const routes = [...(routesByFile.get(file) ?? [])];
        if (!routes.some((r) => !onDesignAxis(r))) failures.push(`${file} is excepted for every screen and no screen above the axes reaches it`);
        if (!allowed.some((name) => readsByFile.get(file)?.has(name))) failures.push(`${file} is excepted for every screen and reads none of its names`);
    }
    for (const [name, issue] of waiting) {
        if (issue !== null && !readersToCome.includes(issue)) failures.push(`${name} waits on #${issue}, which is not an issue still to come`);
        if (read.has(name) && issue !== null) failures.push(`${name} is read and still waits on #${issue}`);
        if (!read.has(name) && issue === null) failures.push(`${name} is declared and nothing reads it`);
    }
    for (const [face, { loader, variable }] of Object.entries(FACES)) {
        for (const axis of faceAxes.get(face)) {
            const loaded = loaders.some((l) => {
                const routes = [...(routesByFile.get(l.file) ?? [])];
                return (
                    l.imported === loader &&
                    l.variable === variable &&
                    routes.length > 0 &&
                    routes.every(onDesignAxis) &&
                    routes.some((route) => axisOf(route) === axis)
                );
            });
            if (!loaded) failures.push(`${face} is read on ${axis} and no file it reaches, and only the design's axes reach, loads ${loader} into ${variable}`);
        }
    }
    return { read, failures };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, assert, log }) {
    const tracked = VALUES.filter((row) => row.length === 3);
    const declaredNames = new Set(VALUES.map(([name]) => name));

    // ── 1: the declaration and its import ────────────────────────────────────
    log("app/designValues.css declares and does nothing else:");
    const parsed = parseDeclaration(readFileSync(join(REPO_ROOT, DECLARATION), "utf8"));
    check("  statements other than @theme blocks", parsed.other.join(" | "), "");
    const stray = parsed.blocks.flatMap((b) => b.declarations.filter((d) => d.stray).map((d) => d.stray));
    check("  anything in a @theme block that is not a custom property", stray.join(" | "), "");
    const declared = new Map();
    const resolvedAtUse = [];
    for (const block of parsed.blocks) {
        for (const d of block.declarations) {
            if (!d.name) continue;
            assert(`  ${d.name} is declared once`, !declared.has(d.name));
            declared.set(d.name, d.value);
            if (block.resolvedAtUse) resolvedAtUse.push(d.name);
        }
    }
    check("  the names in @theme inline are the three faces", resolvedAtUse.sort().join(" "), Object.keys(FACES).sort().join(" "));

    // #473 — a block's keyframes are what an animation it declares runs, and nothing else:
    // each one is run by an animation declared here, and each animation runs keyframes
    // declared here or Tailwind's own. #495 added the account menu's entrance.
    const keyframes = parsed.blocks.flatMap((b) => b.keyframes);
    const animations = [...declared].filter(([name]) => name.startsWith("--animate-"));
    const runs = (value) => value.split(/\s+/)[0];
    check("  the keyframes declared are the account menu's entrance and the caret's blink", keyframes.join(" "), "account-menu-in code-caret-blink");
    check(
        "  every keyframes is run by an animation declared here",
        keyframes.filter((k) => !animations.some(([, value]) => runs(value) === k)).join(" "),
        ""
    );
    check(
        "  and every animation runs keyframes declared here or Tailwind's own",
        animations.filter(([, value]) => !keyframes.includes(runs(value)) && !TAILWIND_KEYFRAMES.includes(runs(value))).map(([n]) => n).join(" "),
        ""
    );

    const globals = withoutComments(readFileSync(join(REPO_ROOT, STYLESHEET), "utf8"));
    const statements = globals.split(";").map((s) => s.trim()).filter(Boolean);
    check("  app/globals.css opens with Tailwind, then the declaration", statements.slice(0, 2).join("; "), '@import "tailwindcss"; @import "./designValues.css"');
    check("  and imports the declaration once", globals.split("./designValues.css").length - 1, 1);
    check("  and reads none of its names", [...varRefsOf(globals, declaredNames)].join(" "), "");

    // ── 2: every value is the design's ───────────────────────────────────────
    log("");
    log("every declaration is the design's value, and the relations the design states hold:");
    check("  declared names are exactly the table's", [...declared.keys()].sort().join(" "), [...declaredNames].sort().join(" "));
    for (const [name, value] of VALUES) check(`  ${name}`, declared.get(name), value);

    check("  no name carries a digit", [...declaredNames].filter((n) => /\d/.test(n)).join(" "), "");

    const mixes = (value) => [...value.matchAll(/color-mix\(in oklab, var\((--[a-z0-9-]+)\) [\d.]+%, transparent\)/g)].map((m) => m[1]);
    const washes = [
        "--color-hover-subtle",
        "--color-background-muted",
        "--color-hover",
        "--color-scrollbar-thumb",
        "--color-scrollbar-thumb-hover",
        "--color-mobile-input-background",
    ];
    for (const name of washes) check(`  ${name} is the foreground in an amount`, mixes(declared.get(name) ?? "").join(" "), "--color-foreground-default");
    const lifted = VALUES.filter(([n]) => n.startsWith("--shadow-") || /^--color-.*-overlay$/.test(n)).map(([n]) => n);
    for (const name of lifted) {
        const used = mixes(declared.get(name) ?? "");
        assert(`  ${name} is the shadow ink in amounts`, used.length > 0 && used.every((u) => u === "--color-elevation"));
    }
    const sizes = tracked.filter(([n]) => n.startsWith("--text-")).map(([n]) => n);
    for (const size of sizes) {
        const leading = declared.get(`${size}--line-height`) ?? "";
        assert(`  ${size} carries a line height on the 0.25rem grid (${leading})`, leading.endsWith("rem") && Number.isInteger(parseFloat(leading) / 0.25));
        const tracking = declared.get(`${size}--letter-spacing`);
        if (tracking) assert(`  ${size} is tracked negative only because it is 21px or more`, parseFloat(declared.get(size)) * 16 >= 21 && tracking.startsWith("-"));
    }
    for (const [name] of VALUES.filter((row) => row.length === 2)) {
        const owner = name.replace(/--(line-height|letter-spacing|font-weight)$/, "");
        assert(`  ${name} belongs to a size in the table`, owner !== name && tracked.some(([n]) => n === owner));
    }

    // A length is rem: the design's px over 16, and the design draws whole pixels.
    const lengths = [...declared].filter(([, v]) => /^-?[\d.]+(px|rem)$/.test(v));
    assert(`  the declaration holds ${lengths.length} lengths`, lengths.length > 100);
    check("  a length in px is one kept in px by convention", lengths.filter(([, v]) => v.endsWith("px")).map(([n]) => n).sort().join(" "), [...PX_KEPT].sort().join(" "));
    check("  every rem is a whole number of the design's pixels over 16", lengths.filter(([, v]) => v.endsWith("rem") && !Number.isInteger(parseFloat(v) * 16)).map(([n, v]) => `${n} ${v}`).join(" | "), "");

    // A key already declared is a key the materials screens read.
    const tailwindKeys = keysOf(readFileSync(requireFromRepo.resolve("tailwindcss/theme.css"), "utf8"));
    const otherStylesheets = ["app", "components"].flatMap((d) => cssFiles(join(REPO_ROOT, d))).map(repoRelative).filter((f) => f !== DECLARATION);
    const appKeys = new Set(otherStylesheets.flatMap((rel) => [...keysOf(readFileSync(join(REPO_ROOT, rel), "utf8"))]));
    assert("  Tailwind's own keys are read, the ones the materials screens use among them", ["--text-sm", "--radius-lg", "--font-sans", "--color-red-500"].every((k) => tailwindKeys.has(k)));
    assert("  and so are the app's own", ["--color-foreground", "--color-background", "--font-sans", "--font-mono"].every((k) => appKeys.has(k)));
    check("  no name is a key Tailwind already declares", [...declaredNames].filter((n) => tailwindKeys.has(n)).join(" "), "");
    check("  no name is a key the app's other stylesheets declare", [...declaredNames].filter((n) => appKeys.has(n)).join(" "), "");

    // ── the oracle, seen to work before anything is claimed with it ──────────
    log("");
    log("Tailwind is asked what a token reads, and is seen to answer right:");
    const ds = await loadDesignSystem();
    const readsOf = makeReader(ds, declaredNames);
    // Assembled here, so the class never appears whole in a file the scanner reads.
    const cls = (...parts) => parts.join("");
    const sees = (token, expected) =>
        check(`  ${token} reads`, [...readsOf([token])].sort().join(" "), [...expected].sort().join(" "));
    sees(cls("h-", "control-lg"), ["--height-control-lg"]);
    sees(cls("flex-", "row"), []);
    // A derived value is read by its own name; what it mixes in is the judgment's.
    sees(cls("hover", ":", "bg-", "hover-subtle"), ["--color-hover-subtle"]);
    sees(cls("bg-", "foreground-default", "/3"), ["--color-foreground-default"]);
    sees(cls("max-", "sm", ":", "h-", "mobile-button"), ["--height-mobile-button"]);
    sees(cls("max-", "sm", ":", "hidden"), []);
    sees(cls("shadow-", "dialog"), ["--shadow-dialog", "--color-elevation"]);
    sees(cls("font-", "ui"), ["--font-ui"]);
    sees(cls("text-", "heading-lg"), [
        "--text-heading-lg",
        "--text-heading-lg--line-height",
        "--text-heading-lg--letter-spacing",
        "--text-heading-lg--font-weight",
    ]);
    // Tailwind's own names for a value no ladder holds read none of these.
    sees(cls("font-", "medium"), []);
    sees(cls("rounded-", "full"), []);
    sees(cls("text-", "zinc-500"), []);
    sees("Choose", []);

    // ── the corpus, the graph and the reads ──────────────────────────────────
    log("");
    log("the corpus and the graph are seen to reach what they should:");
    const jsFiles = ["app", "components", "lib"].flatMap((d) => (existsSync(join(REPO_ROOT, d)) ? listJsFiles(join(REPO_ROOT, d)) : [])).map(repoRelative);
    const graph = new Map();
    const readsByFile = new Map();
    const loaders = [];
    for (const rel of jsFiles) {
        let ast;
        try {
            ast = parseFile(rel).ast;
        } catch (err) {
            assert(`${rel} parses (an unparsed file is an unchecked file): ${err.message}`, false);
            continue;
        }
        graph.set(rel, new Set([...importedPairs(rel, ast)].map((p) => p.slice(0, p.lastIndexOf("::")))));
        const strings = stringsOf(ast);
        const reads = readsOf(tokensOf(strings));
        for (const s of strings) for (const v of varRefsOf(s, declaredNames)) reads.add(v);
        readsByFile.set(rel, reads);
        loaders.push(...loadersOf(rel, ast));
    }
    for (const rel of otherStylesheets) {
        const css = readFileSync(join(REPO_ROOT, rel), "utf8");
        graph.set(rel, new Set([...css.matchAll(/@import\s+"(\.[^"]+)"/g)].map(([, spec]) => toPosix(join(dirname(rel), spec)))));
        readsByFile.set(rel, varRefsOf(withoutComments(css), declaredNames));
    }
    const routesByFile = routesReaching(graph);
    assert(`  parsed ${jsFiles.length} modules and ${otherStylesheets.length} stylesheets`, jsFiles.length > 150 && otherStylesheets.length >= 2);
    assert("  the tools layout is a route file that reaches itself", routesByFile.get("app/(tools)/layout.js")?.has("app/(tools)/layout.js"));
    assert("  the root layout reaches app/globals.css", routesByFile.get(STYLESHEET)?.has("app/layout.js"));
    // The labels' stylesheet is reached through the dialog's import from both pages that
    // open it (#457), where it was the labels' page's own until then.
    assert(
        "  the labels' stylesheet is reached from both pages that open the dialog",
        ["app/(tools)/tools/[toolRecordId]/page.js", "app/(tools)/tool-items/[toolItemId]/page.js"].every((route) =>
            routesByFile.get("app/(tools)/tool-items/labels.css")?.has(route)
        )
    );
    assert("  a component shared by both axes is reached from each", (() => {
        const routes = [...(routesByFile.get("app/components/Instant.js") ?? [])];
        return routes.some(isToolsFile) && routes.some((r) => !isToolsFile(r));
    })());
    assert("  the labels' face loader is found, variable and all", loaders.some((l) => l.imported === "Inconsolata" && l.variable === "--font-label-code"));
    // #473 — the design's faces load in `app/faces/`, one module a face, and the first of
    // them is found there and reached by both axes' layouts: the loader judgment below is
    // asked against a real call, on each axis.
    assert(
        "  and the UI face's, in the module that loads it",
        loaders.some((l) => l.file === "app/faces/ui.js" && l.imported === "Instrument_Sans" && l.variable === "--font-instrument-sans")
    );
    assert(
        "  which both axes' layouts reach",
        ["app/(tools)/layout.js", "app/login/layout.js"].every((layout) => routesByFile.get("app/faces/ui.js")?.has(layout))
    );
    assert("  the sign-in layout is a route file that reaches itself", routesByFile.get("app/login/layout.js")?.has("app/login/layout.js"));
    assert("  and the controls are reached from both axes and from no other", (() => {
        const routes = [...(routesByFile.get("app/components/Controls.js") ?? [])];
        return routes.some(isToolsFile) && routes.some((r) => axisOf(r) === SIGN_IN_DIR) && routes.every(onDesignAxis);
    })());

    // ── 3 and 4: who reads, and every name read or waiting ───────────────────
    const waiting = new Map(tracked.map(([name, , issue]) => [name, issue]));
    const sources = new Map(tracked.map(([name, value]) => [name, varRefsOf(value, declaredNames)]));
    const { read, failures } = judge({ waiting, sources, readsByFile, routesByFile, loaders, readersToCome: READERS_TO_COME });

    log("");
    log("a name is read only where the design's axes are the only callers, and every name is read or waits:");
    check("  failures", failures.join("\n    "), "");
    log(`  ${read.size} names read, ${[...waiting.values()].filter((i) => i !== null).length} waiting`);
    for (const issue of READERS_TO_COME) {
        log(`    #${issue} reads ${[...waiting].filter(([, i]) => i === issue).length} first`);
    }

    // ── the judgment, seen to fail where it should ───────────────────────────
    log("");
    log("the judgment fails each planted case and passes its repair:");
    const plantedName = "--height-control-lg";
    const plant = ({ file, routes, names = [plantedName], issue = 463, loaderFile = null, loaderRoutes = ["app/(tools)/layout.js"], appWide = {} }) =>
        judge({
            appWide,
            waiting: new Map(names.map((name) => [name, issue])),
            sources: new Map(),
            readsByFile: new Map([[file, new Set(names)]]),
            routesByFile: new Map([
                [file, new Set(routes)],
                ...(loaderFile ? [[loaderFile, new Set(loaderRoutes)]] : []),
            ]),
            loaders: loaderFile ? [{ file: loaderFile, imported: "Instrument_Sans", variable: "--font-instrument-sans" }] : [],
            readersToCome: READERS_TO_COME,
        }).failures;
    const shared = "app/components/PlantedRail.js";
    assert(
        "  a shared file only the tools layout calls reads, so a waiting name it reads is stale",
        plant({ file: shared, routes: ["app/(tools)/layout.js"] }).some((f) => f.includes("still waits on #463"))
    );
    check("  and once the mark is gone it passes", plant({ file: shared, routes: ["app/(tools)/layout.js"], issue: null }).join(" | "), "");
    assert(
        "  the same file called by a screen above the axis fails, wherever it lives",
        plant({ file: shared, routes: ["app/(tools)/layout.js", "app/page.js"], issue: null }).some((f) => f.includes("app/page.js calls it"))
    );
    assert(
        "  a file no route reaches reads nothing, so a name only it reads is unread",
        plant({ file: shared, routes: [], issue: null }).some((f) => f.includes("nothing reads it"))
    );
    assert(
        "  a name waiting on an issue that is not to come fails",
        plant({ file: shared, routes: [], issue: 999 }).some((f) => f.includes("#999"))
    );
    assert(
        "  a face read with no loader on the axis fails",
        plant({ file: shared, routes: ["app/(tools)/layout.js"], names: ["--font-ui"], issue: null }).some((f) => f.includes("loads Instrument_Sans"))
    );
    check(
        "  and its loader in a file only the tools axis reaches repairs it",
        plant({ file: shared, routes: ["app/(tools)/layout.js"], names: ["--font-ui"], issue: null, loaderFile: "app/(tools)/layout.js" }).join(" | "),
        ""
    );
    // #473 — the second axis, held the same three ways and one more: a face is loaded on
    // each axis that reads it, so one loaded for the tools screens alone does not reach a
    // sign-in screen.
    check(
        "  a file only the sign-in screens call reads too",
        plant({ file: shared, routes: ["app/login/page.js", "app/login/confirm/page.js"], issue: null }).join(" | "),
        ""
    );
    assert(
        "  and called by a screen above both axes as well, it fails",
        plant({ file: shared, routes: ["app/login/page.js", "app/prs/page.js"], issue: null }).some((f) => f.includes("app/prs/page.js calls it"))
    );
    assert(
        "  a face the sign-in screens read, loaded only where the tools axis reaches, fails",
        plant({ file: shared, routes: ["app/login/page.js"], names: ["--font-ui"], issue: null, loaderFile: "app/faces/ui.js" }).some((f) =>
            f.includes(`read on ${SIGN_IN_DIR}`)
        )
    );
    check(
        "  and loaded where the sign-in layout reaches too, it passes",
        plant({
            file: shared,
            routes: ["app/login/page.js", "app/(tools)/tools/page.js"],
            names: ["--font-ui"],
            issue: null,
            loaderFile: "app/faces/ui.js",
            loaderRoutes: ["app/(tools)/layout.js", "app/login/layout.js"],
        }).join(" | "),
        ""
    );
    assert(
        "  but a loader a screen above the axes reaches does not count",
        plant({
            file: shared,
            routes: ["app/login/page.js"],
            names: ["--font-ui"],
            issue: null,
            loaderFile: "app/faces/ui.js",
            loaderRoutes: ["app/login/layout.js", "app/layout.js"],
        }).some((f) => f.includes("loads Instrument_Sans"))
    );

    // #463 — THE ONE EXCEPTION, held both ways: a file excepted for every screen reads its own
    // names wherever it is called, a name outside its list still fails, and an exception
    // nothing above the axes reaches, or one that reads none of its names, is stale.
    const dateName = "--opacity-date-separator";
    const plantedDate = "app/components/PlantedDate.js";
    check(
        "  a file excepted for every screen reads its own names, called by a screen above the axes",
        plant({ file: plantedDate, routes: ["app/(tools)/layout.js", "app/prs/page.js"], names: [dateName], issue: null, appWide: { [plantedDate]: [dateName] } }).join(" | "),
        ""
    );
    assert(
        "  and a name outside its list still fails",
        plant({ file: plantedDate, routes: ["app/prs/page.js"], names: [dateName, plantedName], issue: null, appWide: { [plantedDate]: [dateName] } }).some((f) =>
            f.includes("not allowed on every screen")
        )
    );
    assert(
        "  an exception no screen above the axes reaches is stale",
        plant({ file: plantedDate, routes: ["app/(tools)/layout.js"], names: [dateName], issue: null, appWide: { [plantedDate]: [dateName] } }).some((f) =>
            f.includes("no screen above the axes reaches it")
        )
    );
    assert(
        "  as is one that reads none of its names",
        plant({ file: plantedDate, routes: ["app/prs/page.js"], names: [plantedName], issue: null, appWide: { [plantedDate]: [dateName] } }).some((f) =>
            f.includes("reads none of its names")
        )
    );

    // The keyframes parser, seen to take a block's keyframes out whole and to leave a rule
    // outside every block where claim 1 finds it.
    const plantedCss = parseDeclaration(
        "@theme {\n  --a: 1rem;\n  @keyframes blink {\n    50% { opacity: 0; }\n  }\n  --b: 2rem;\n}\n.page { color: red; }\n"
    );
    check("  a block's keyframes are named and taken out", plantedCss.blocks[0].keyframes.join(" "), "blink");
    check("  the declarations either side survive", plantedCss.blocks[0].declarations.map((d) => d.name ?? d.stray).join(" "), "--a --b");
    assert("  and a rule outside any block is still found", plantedCss.other.some((o) => o.startsWith(".page")));

    // A planted module read end to end, so the reading of strings is seen too.
    const planted = parseSource(`export const X = () => <div className="${cls("h-", "control-lg")} ${cls("max-", "sm", ":", "h-", "mobile-button")}" />;`, "<planted>").ast;
    check(
        "  a planted module's className reads through the same path",
        [...readsOf(tokensOf(stringsOf(planted)))].sort().join(" "),
        ["--height-control-lg", "--height-mobile-button"].sort().join(" ")
    );
}

if (isMain(import.meta.url)) standalone(title, run);

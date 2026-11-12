// The design's values: declared once, pinned by value, read by name — by any file a
// route reaches since #258 — and the ground, the ink and the faces applied once, by
// the root layout (#462, #473, #258).
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
//   3. THE GROUND, THE INK AND THE FACES ARE APPLIED ONCE, BY THE ROOT LAYOUT (#258):
//      `app/layout.js` sets each face's variable on `<html>` and White, Ink and the UI
//      face on `<body>`, no other layout applies any of them, no file but the root
//      layout imports a face's module, and `app/globals.css` names no face of its own.
//   4. EVERY NAME IS READ, OR WAITS ON AN ISSUE NAMED BESIDE IT — and every face a
//      name reads is loaded by its next/font call in `app/faces/`, which the root
//      layout reaches, while no other face is loaded but the label's own.
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
// A NAME IS READ BY WHAT A ROUTE REACHES. The import graph is walked from every
// route file under `app/`, and a file no route file reaches reads nothing, since
// nothing renders it, so a name only such a file reads is unread. Resolution is
// `unread-exports.mjs`'s `importedPairs`, the same reading of a specifier that check
// makes, rather than a third copy of it.
//
//   UNTIL #258 THE WALK WAS ALSO A BOUNDARY, and that is what it no longer is. A file
//   that only the asset screens' route files reached might read a name (#462), and
//   from #473 the sign-in steps' too, while a file any other route file reached might
//   not, wherever it lived: the screens above the assets axis each held a width
//   container of their own and drew in the stylesheet's Arial, so a name styling a
//   component they shared would have restyled them with no design to answer to. #258
//   gathered every screen into the root layout, which applies the faces on its own
//   element, and moved those containers into the one box a screen the design has not
//   drawn stands in (`offline/undrawn-pages.mjs` holds it), so any file a route
//   reaches may read a name. The date's four names, which `Instant.js` alone could
//   read on every screen (#463), needed their exception no longer and it went.
//
//   A FACE IS LOADED ONCE AND APPLIED ONCE. The root layout imports the three
//   modules in `app/faces/` and sets their variables on `<html>`, so every route
//   loads every face; a face a name reads needs its call there, with its variable,
//   and a call loading a face no name reads fails, which is what Geist Sans and Geist
//   Mono were from the template until #258. The label's Inconsolata is the one other
//   call: the label's measured face, loaded by the dialog that prints it (#457).
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

export const title = "The design's values — declared once, read by name, the faces applied once (#462, #473, #258)";

const DECLARATION = "app/designValues.css";
const STYLESHEET = "app/globals.css";
const ROOT_LAYOUT = "app/layout.js";
const FACES_DIR = "app/faces/";

/**
 * The one face loaded outside `app/faces/`, and why: the label's code is set in Inconsolata,
 * the label's own measured face rather than the design's, loaded by the dialog that draws and
 * prints the labels (#457, `tools.md`).
 */
const OWN_FACES = [{ file: "app/(assets)/assets/LabelsDialog.js", imported: "Inconsolata" }];

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
 * #458 took its own out with the asset page's dialogs and 1f's three sheets: they
 * read the sheets' names and the phone's type, fields and buttons, and seven of #463's
 * first — the sheet button, the sheet that confirms and Red's hover — and the foot bar
 * went to the issues that draw one: its room, its 50 button and the pill to #473, whose
 * step pages draw them now, and the pill's chevron side and a field's icon to #463's
 * asset page. The foot bar's shadow was undeclared, since 0a now draws it none.
 * #473 took its own out with the sign-in steps: they read five of the six names #458
 * marked for it — the foot bar's room above and below, its 50 button and the pill — and
 * three of #463's first, the Page title at both widths and a phone field's gap, and the
 * foot bar's 12 between its rows went to #463's asset page, since no step page has
 * two. The steps declared their own names with them and read the account's avatar for an
 * address chip's.
 * #463 took its own out with the asset page and the two lists, which read the eight
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
    // Every mark's line, whatever its size (#502).
    ["--stroke-width-icon", "1.25px", null],
    // A mark's ink is what it does beside its words (0a Icon box, the files of 2026-11-05, #614):
    // a qualifier in Ink 3, a current or chosen mark in Accent, each by the ink's own name.
    ["--color-icon-subtle", "var(--color-foreground-subtle)", null],
    ["--color-icon-selected", "var(--color-primary)", null],
    ["--spacing-control-inline-inset-x", "0.5rem", null],
    ["--spacing-control-inset-x", "0.625rem", null],
    ["--spacing-control-lg-inset-x", "1rem", null],
    // 1a's 32 button under a list its band emptied (#520).
    ["--spacing-control-md-inset-x", "0.8125rem", null],
    // A sign-in page's field and action, and the line under any field (#473).
    ["--height-control-xl", "2.5rem", null],
    ["--spacing-input-inset-x", "0.75rem", null],
    ["--spacing-input-message-stack", "0.375rem", null],
    // A field's count at the end of the line under it, at both widths (0a Note, #533).
    ["--spacing-field-count-inline", "0.75rem", null],
    // 1l's New mark and 0f's segmented row (#527).
    ["--spacing-input-mark-inset-right", "3.25rem", null],
    ["--spacing-segmented-inset", "0.125rem", null],
    ["--spacing-segmented-option-inset-x", "0.375rem", null],
    ["--transition-duration-segmented", "200ms", null],
    ["--ease-segmented", "cubic-bezier(0.2, 0, 0, 1)", null],
    ["--min-width-menu", "8.75rem", null],
    ["--max-width-menu", "17.5rem", null],
    // The most 1l's two kinds of list stand before they scroll in their lanes (#555).
    ["--max-height-catalog-field-list", "14.25rem", null],
    ["--max-height-catalog-filter-list", "21.25rem", null],
    // The most 1a's band lists stand before they scroll in their lanes (#566).
    ["--max-height-category-list-filter-list", "15rem", null],
    ["--spacing-menu-offset", "0.375rem", null],
    ["--spacing-menu-inset", "0.3125rem", null],
    // 0a Menu's head, which names what follows (#495).
    ["--spacing-menu-heading-inset-y", "0.375rem", null],
    // 0a Menu's value at an option's end, and 1a's band: its filter chips, its search field and
    // the × that empties either (#520).
    ["--spacing-menu-value-inline", "1.5rem", null],
    ["--spacing-menu-box-gap", "0.625rem", null],
    ["--size-filter-chip-chevron", "0.75rem", null],
    ["--spacing-filter-chip-inset-right", "0.5rem", null],
    ["--width-list-search", "16.25rem", null],
    ["--spacing-search-icon-inset", "0.6875rem", null],
    ["--spacing-search-inset-left", "2rem", null],
    ["--spacing-search-inset-right", "1.8125rem", null],
    ["--width-clear-button", "1.5rem", null],
    ["--size-clear-icon", "0.8125rem", null],
    ["--spacing-ghost-inset-x", "0.625rem", null],
    // 1a's head and band as the files of 2026-10-23 draw them (#566): `Catalog`, faced behind its
    // book, and the job's chip at the band's start behind its pin, with the list it opens.
    ["--spacing-faced-inset-left", "0.625rem", null],
    ["--spacing-faced-inset-right", "0.75rem", null],
    ["--min-width-job-chip", "8rem", null],
    ["--spacing-job-chip-inset-left", "0.5625rem", null],
    ["--spacing-job-chip-inset-right", "0.5rem", null],
    ["--size-job-chip-chevron", "0.75rem", null],
    ["--min-width-job-chip-list", "10rem", null],
    // The sort on 1a, 1d and 1l (#540): its room either side of its mark and its chevron, the
    // chevron, and the room its list's options keep for the check.
    ["--spacing-sort-inset-left", "0.4375rem", null],
    ["--spacing-sort-inset-right", "0.5rem", null],
    ["--size-sort-chevron", "0.75rem", null],
    ["--spacing-sort-check-gap", "0.625rem", null],
    // 0b · Layout
    ["--container-content", "67.5rem", null],
    ["--spacing-page-gutter", "2rem", null],
    ["--spacing-gap", "0.5rem", null],
    ["--spacing-gap-lg", "0.875rem", null],
    ["--spacing-nav-gap", "0.6875rem", null],
    // 0b's Gap inside a 32 control and its Band padding, which 1a's band reads (#520).
    ["--spacing-control-icon-gap", "0.375rem", null],
    ["--spacing-control-band-inset-y", "0.875rem", null],
    ["--height-table-row", "2.5rem", null],
    ["--spacing-table-bleed", "0.75rem", null],
    ["--height-table-header", "2.25rem", null],
    ["--spacing-selection-bar-offset", "0.75rem", null],
    ["--spacing-selection-bar-inset", "0.5rem", null],
    ["--spacing-selection-bar-slide", "0.5rem", null],
    ["--transition-duration-selection-bar", "160ms", null],
    // The mark that leads an action's reason in the bar (#495).
    ["--spacing-selection-bar-reason-gap", "0.375rem", null],
    // The pager's 60 (#505): 12 above its controls, its rule counted, and 16 under them.
    ["--spacing-pager-inset-top", "0.75rem", null],
    ["--spacing-pager-inset-bottom", "1rem", null],
    // 1a and 1d's drawings, where the spec states no figure — #463's lists.
    ["--spacing-table-column-inline", "1.25rem", null],
    // 1a's counts at 56 since the files of 2026-10-23 (#566), 96 until then.
    ["--width-table-count", "3.5rem", null],
    ["--width-table-id", "9.5rem", null],
    ["--width-table-serial", "10rem", null],
    // The job's column, on all of a reader's jobs (1d, #548).
    ["--width-table-job", "6rem", null],
    // The status's column, held again beside the note's (1d, #533).
    ["--width-table-status", "15rem", null],
    ["--width-table-date", "7.5rem", null],
    // 1l's columns, the catalog's own (#527), as the drawing of 2026-10-21 lays them by 0b Row's
    // rule (#552): the name and the three free-text columns at their least, the rest fixed. The
    // class's column and its field in the dialog went with the class.
    ["--min-width-catalog-name", "20rem", null],
    ["--width-catalog-size", "6rem", null],
    ["--min-width-catalog-maker", "7.5rem", null],
    ["--min-width-catalog-part-number", "8rem", null],
    ["--min-width-catalog-category", "8.5rem", null],
    ["--width-catalog-type", "5.5rem", null],
    ["--width-catalog-items", "3rem", null],
    // How far in a list on Fill sets its table from the window's edge (1l, #538).
    ["--spacing-fill-table-inset-right", "2.25rem", null],
    ["--spacing-catalog-preview-stack", "0.125rem", null],
    ["--spacing-pager-inline", "1.5rem", null],
    ["--spacing-pager-step-gap", "0.625rem", null],
    ["--spacing-pager-step-bleed", "0.8125rem", null],
    ["--spacing-fill-pager-step-bleed", "0.75rem", null],
    ["--spacing-list-empty-state-inset-top", "15rem", null],
    ["--spacing-list-empty-state-band-inset-top", "12.125rem", null],
    // What a list says once its band has emptied it (1a, #520).
    ["--spacing-list-emptied-inset-y", "3.75rem", null],
    ["--spacing-list-emptied-stack", "0.75rem", null],
    ["--spacing-list-emptied-id-inline", "0.12em", null],
    // Under the sentence of a page the reader may no longer use (0b Row, 1l `Not Admin, closed`, #616).
    ["--spacing-closed-page-inset-bottom", "3rem", null],
    // The way to the item a search found by its id, under the band (1a, #541).
    ["--height-found-item", "2.5rem", null],
    ["--spacing-found-item-inset-x", "0.75rem", null],
    ["--spacing-found-item-inline", "1rem", null],
    // 0c · Blue
    ["--color-selected", "#F0F9FF", null],
    ["--color-selected-hover", "#E6F5FF", null],
    ["--color-selected-border", "#C1DEFD", null],
    ["--color-primary", "oklch(0.487 0.216 257)", null],
    ["--color-primary-hover", "oklch(0.437 0.211 257)", null],
    ["--color-primary-disabled", "color-mix(in oklab, var(--color-primary) 40%, transparent)", null],
    // 0d · Red
    ["--color-danger-subtle", "#FFF4F5", null],
    ["--color-danger", "#DC0015", null],
    ["--color-danger-hover", "oklch(0.512 0.205 27)", null],
    // A red commitment that cannot act, as Tools 54 holds a dialog's it refused (#616).
    ["--color-danger-disabled", "color-mix(in oklab, var(--color-danger) 40%, transparent)", null],
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
    // The Wash made opaque, for the name column a table holds at its start (0b Row, #552).
    ["--color-pinned-column-hover", "color-mix(in srgb, var(--color-foreground-default) 3%, white)", null],
    ["--color-background-muted", "color-mix(in oklab, var(--color-foreground-default) 4.5%, transparent)", null],
    ["--color-hover", "color-mix(in oklab, var(--color-foreground-default) 5.5%, transparent)", null],
    ["--color-scrollbar-thumb", "color-mix(in oklab, var(--color-foreground-default) 20%, transparent)", null],
    ["--color-scrollbar-thumb-hover", "color-mix(in oklab, var(--color-foreground-default) 34%, transparent)", null],
    // 0f · States
    ["--width-number-input", "7.5rem", null],
    ["--spacing-stepper-inset-x", "0.1875rem", null],
    // A busy action (#473); its turn and its track are the drawings', not the spec's.
    ["--transition-delay-busy", "300ms", null],
    ["--transition-delay-held", "100ms", null],
    ["--size-spinner", "1rem", null],
    ["--animate-spinner", "spin 0.7s linear infinite", null],
    ["--color-spinner-track", "color-mix(in oklab, currentColor 35%, transparent)", null],
    // The track on an action with no fill, its Ink at 20% (#616).
    ["--color-unfilled-spinner-track", "color-mix(in oklab, currentColor 20%, transparent)", null],
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
    // A date, on every screen (#463), which `Instant.js` alone could read on the screens above
    // the assets axis until #258 opened every name to every file. From the drawings, not the spec.
    ["--opacity-date-separator", "45%", null],
    // 1f's toast draws a moment's slashes at 60% on its Ink ground (#614).
    ["--opacity-toast-date-separator", "60%", null],
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
    // 0k's Toast (#566), 1a's export failure: the spec's but for its 2 between the two buttons.
    [
        "--shadow-toast",
        "0 8px 24px color-mix(in oklab, var(--color-elevation) 16%, transparent), 0 1px 2px color-mix(in oklab, var(--color-elevation) 10%, transparent)",
        null,
    ],
    ["--height-toast", "2.75rem", null],
    ["--spacing-toast-inset-left", "0.875rem", null],
    ["--spacing-toast-inset-right", "0.375rem", null],
    ["--spacing-toast-inline", "1rem", null],
    ["--spacing-toast-action-gap", "0.125rem", null],
    ["--spacing-toast-offset", "1.5rem", null],
    ["--spacing-added-toast-offset", "4.875rem", null],
    ["--transition-duration-toast", "200ms", null],
    ["--color-toast-hover", "oklch(1 0 0 / 0.12)", null],
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
    // A dialog that searches a list and picks from it (0l, 0f, 1b; #520).
    ["--container-dialog-search", "30rem", null],
    ["--height-dialog-search", "30.625rem", null],
    ["--height-dialog-search-row", "3.5rem", null],
    ["--spacing-dialog-search-inset-top", "0.25rem", null],
    ["--spacing-dialog-header-inset-bottom", "1rem", null],
    ["--spacing-dialog-search-icon-bleed", "0.1875rem", null],
    ["--spacing-dialog-filter-inline", "0.375rem", null],
    ["--spacing-dialog-result-bleed", "0.75rem", null],
    ["--spacing-dialog-result-inline", "0.875rem", null],
    ["--spacing-dialog-results-inset-top", "0.5rem", null],
    ["--spacing-dialog-results-inset-bottom", "0.75rem", null],
    ["--spacing-dialog-results-empty-inset-top", "6rem", null],
    ["--min-width-dialog-chip", "4.5rem", null],
    // 0m · Navigation
    ["--width-rail", "3.5rem", null],
    ["--width-rail-expanded", "15.5rem", null],
    ["--spacing-rail-inset", "0.75rem", null],
    ["--transition-duration-rail", "200ms", null],
    ["--ease-rail", "cubic-bezier(0.2, 0, 0, 1)", null],
    // From the drawings, not the spec (#460).
    ["--spacing-rail-stack", "0.125rem", null],
    // From the final files' drawings, where a rule with 10 either side stood under the toggle
    // until #501.
    ["--spacing-rail-header-stack", "1rem", null],
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
    // From the drawings, not the spec (#519): the chevron after a breadcrumb level that opens
    // the job's list, its gap from the word and how far it runs into the level's side room.
    ["--size-breadcrumb-chevron", "0.75rem", null],
    ["--spacing-breadcrumb-chevron-gap", "0.375rem", null],
    ["--spacing-breadcrumb-chevron-bleed", "0.1875rem", null],
    ["--height-breadcrumb-title-rule", "1rem", null],
    ["--spacing-breadcrumb-title-rule-inline", "1rem", null],
    ["--transition-duration-breadcrumb-title", "160ms", null],
    // 0n · Record page
    ["--spacing-record-header-stack", "1.5rem", null],
    ["--spacing-breadcrumb-stack", "0.875rem", null],
    // 0n's list header, one line (#505).
    ["--spacing-list-header-inset-top", "2rem", null],
    ["--spacing-list-header-inset-bottom", "1.125rem", null],
    ["--spacing-list-header-inline", "2.5rem", null],
    ["--spacing-list-count-inline", "0.5rem", null],
    // A list header's controls stand at 0b's Gap since #566, which undeclared #519's 12 between them.
    ["--spacing-title-stack", "0.625rem", null],
    ["--spacing-subtitle-stack", "0.75rem", null],
    ["--spacing-heading-sm-stack", "0.75rem", null],
    // The record rail on 1080 (#463), which #462 left undeclared, its label block and the
    // history beside it; all but the rail's three from the drawings, not the spec.
    ["--spacing-record-header-inline", "3.5rem", null],
    // How far the record header's actions stand above its title's top (1f, #538).
    ["--spacing-record-header-actions-bleed", "0.1875rem", null],
    // Add note's face past its plus mark, and the mark to its word (1f, #533).
    ["--spacing-note-add-bleed-left", "0.3125rem", null],
    ["--spacing-note-add-gap", "0.375rem", null],
    ["--spacing-details-label-inline", "1rem", null],
    ["--spacing-details-row-stack", "0.75rem", null],
    ["--spacing-details-edit-inline", "0.875rem", null],
    ["--spacing-details-add-bleed-left", "0.5rem", null],
    ["--spacing-details-actions-stack", "0.75rem", null],
    ["--spacing-details-block-stack", "2.5rem", null],
    ["--width-record-rail", "21rem", null],
    ["--spacing-record-rail-inline", "2rem", null],
    ["--spacing-record-rail-inset-left", "1.75rem", null],
    ["--spacing-label-block-stack", "1rem", null],
    ["--spacing-label-preview-inset-x", "1rem", null],
    ["--spacing-label-preview-inset-y", "1.75rem", null],
    ["--spacing-label-caption-stack", "0.5rem", null],
    ["--width-log-track", "1.25rem", null],
    ["--size-log-dot", "0.375rem", null],
    ["--spacing-log-dot-inset-top", "0.4375rem", null],
    ["--spacing-log-rule-inset-top", "1.25rem", null],
    ["--spacing-log-rule-overhang", "0.1875rem", null],
    ["--spacing-log-line-stack", "0.1875rem", null],
    ["--spacing-log-stack", "1.5rem", null],
    // Every empty list's and not-found screen's sentence at 480 since the files of 2026-10-23
    // (1a2, 1d, 1h; #566), 440 until then.
    ["--max-width-empty-state", "30rem", null],
    // 0o · Sign-in page (#473); the name fields' 12 and the caret's height are the drawings'.
    // Its chip's avatar is the account's, above.
    ["--container-sign-in", "22.5rem", null],
    // 0o's Column is a share of the window since the files of 2026-10-22 (#554): 24% for a step,
    // and 10% above and below one whose column holds a list, each held between two figures.
    ["--spacing-sign-in-inset-top", "clamp(4rem, 24dvh, 15rem)", null],
    ["--spacing-sign-in-list-step-inset-y", "clamp(3rem, 10dvh, 7rem)", null],
    ["--spacing-sign-in-brand-stack", "2.5rem", null],
    ["--spacing-sign-in-title-stack", "0.5rem", null],
    ["--spacing-sign-in-header-stack", "2rem", null],
    ["--spacing-sign-in-form-stack", "1.5rem", null],
    ["--spacing-sign-in-form-inline", "0.75rem", null],
    // The job step's list at a desk (Sign in 1l, #554).
    ["--spacing-sign-in-list-stack", "0.75rem", null],
    ["--spacing-sign-in-list-inset-y", "0.25rem", null],
    ["--spacing-sign-in-list-note-stack", "1rem", null],
    ["--spacing-sign-in-list-empty-inset-y", "2.5rem", null],
    ["--size-sign-in-check-mark", "0.6875rem", null],
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
    // Tools 0a · App — #458's sheets and #473's step pages read theirs, and #463's asset
    // page the foot bar's 12 between its rows.
    ["--spacing-mobile-gutter", "1rem", null],
    ["--height-mobile-top-bar", "3.5rem", null],
    ["--spacing-mobile-top-bar-inset-right", "0.25rem", null],
    ["--size-mobile-top-bar-icon", "1.5rem", null],
    // The top bar's soft edge (#463), the bottom bar's again on the bar above; the fade is the drawings'.
    ["--spacing-mobile-top-bar-bleed", "1.5rem", null],
    ["--transition-duration-mobile-top-bar", "160ms", null],
    // Either side of the name the top bar fades in (0a, #538).
    ["--spacing-mobile-top-bar-title-inset-x", "3.5rem", null],
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
    // The clear ×'s mark, 18 since Tools 0a's Field row gave it (#607).
    ["--size-mobile-input-clear-icon", "1.125rem", null],
    // The clear ×'s mark inside its target's end, on every phone field (#607), a phone field's
    // refusal and the alert (#473).
    ["--spacing-mobile-input-clear-inset-right", "0.75rem", null],
    ["--spacing-mobile-input-message-inset-x", "0.25rem", null],
    ["--spacing-mobile-input-message-gap", "0.375rem", null],
    ["--spacing-mobile-alert-inset-y", "0.875rem", null],
    ["--spacing-mobile-alert-inset-x", "1rem", null],
    ["--size-mobile-alert-icon", "1.125rem", null],
    ["--spacing-mobile-alert-gap", "0.625rem", null],
    ["--height-mobile-chip", "2.25rem", null],
    ["--spacing-mobile-chip-inset-x", "0.875rem", null],
    ["--spacing-mobile-chip-inset-right", "0.75rem", null],
    ["--spacing-mobile-avatar-chip-inset-left", "0.375rem", null],
    ["--size-mobile-status-indicator", "0.625rem", null],
    ["--radius-mobile-control", "0.75rem", null],
    ["--radius-mobile-drawer", "1.75rem", null],
    ["--opacity-mobile-pressed", "50%", null],
    // The title block 4 under the top bar since the files of 2026-10-16 (#538), where it was 16.
    ["--spacing-mobile-top-bar-stack", "0.25rem", null],
    ["--spacing-mobile-title-stack", "1.375rem", null],
    // The title block's lines on a phone, 4 apart (0a, #538): the id over the name, the caption under it,
    // and the item's job under that behind its pin, 14 (1j, #597).
    ["--spacing-mobile-title-block-stack", "0.25rem", null],
    // The phone's note line a writer presses, past its text either side and above and below (0a Note, 1j; #533).
    ["--spacing-mobile-note-bleed-x", "0.75rem", null],
    ["--spacing-mobile-note-bleed-y", "0.875rem", null],
    ["--spacing-mobile-detail-bleed-outer", "1.375rem", null],
    ["--spacing-mobile-detail-bleed-inner", "0.375rem", null],
    ["--spacing-mobile-stack", "2rem", null],
    // A phone's sign-in page (#473); the caret's height is the drawings'.
    ["--spacing-mobile-sign-in-inset-top", "4.5rem", null],
    ["--spacing-mobile-sign-in-brand-stack", "2rem", null],
    ["--spacing-mobile-code-stack", "1.5rem", null],
    ["--spacing-mobile-code-help-stack", "1.25rem", null],
    // The job step's list on a phone (Sign in 1k, #554).
    ["--spacing-mobile-sign-in-search-inset-y", "0.5rem", null],
    ["--spacing-mobile-sign-in-search-bleed", "1.5rem", null],
    ["--height-mobile-sign-in-option", "4rem", null],
    ["--spacing-mobile-sign-in-option-inline", "1rem", null],
    ["--size-mobile-sign-in-check", "1.5rem", null],
    ["--size-mobile-sign-in-check-mark", "0.875rem", null],
    ["--spacing-mobile-sign-in-list-empty-inset-y", "2rem", null],
    ["--height-mobile-code-caret", "1.625rem", null],
    ["--size-mobile-log-dot", "0.375rem", null],
    ["--spacing-mobile-log-gap", "0.75rem", null],
    ["--spacing-mobile-log-stack", "1.25rem", null],
    ["--size-mobile-log-icon", "0.875rem", null],
    // Either side of the arrow between a loan's two jobs (#598).
    ["--spacing-mobile-log-route-gap", "0.375rem", null],
    // 1j's history, 1k's notice and its screen for a code no asset carries (#463), from the
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
    ["--height-mobile-name-sheet-list", "12.125rem", null],
    ["--shadow-mobile-drawer", "0 -12px 48px color-mix(in oklab, var(--color-elevation) 16%, transparent)", null],
    ["--color-mobile-drawer-overlay", "color-mix(in oklab, var(--color-elevation) 24%, transparent)", null],
    // From the drawings, not the spec (#458).
    ["--size-mobile-drawer-row-icon", "1.0625rem", null],
    ["--spacing-mobile-drawer-heading-stack", "0.25rem", null],
    // The lending's sheet's line under its title (#598).
    ["--spacing-mobile-drawer-subtitle-stack", "0.25rem", null],
    ["--spacing-mobile-drawer-header-action-inset-x", "0.75rem", null],
    // The 16 spinner the Done holds in its words' width, its Accent at 25% (#616).
    ["--color-mobile-drawer-header-action-spinner-track", "color-mix(in oklab, currentColor 25%, transparent)", null],
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
 * stroke, and so is every mark's line, the one 1.25 at any size (#502); the
 * scrollbar's lane is the browser's own, whose width follows no text size, so the
 * clearance inside it follows it. The room either side of a date's slash is a
 * fraction of a pixel, which no whole number of the design's pixels over 16 states
 * (#463). Every shadow stays px too, and is not a length.
 */
const PX_KEPT = ["--stroke-width-status-ring", "--stroke-width-icon", "--spacing-scrollbar-gutter", "--spacing-scrollbar-inset", "--spacing-date-separator-inline"];

/**
 * The three faces: the only names in `@theme inline`, each resolving to the
 * variable its next/font call sets. A face a name reads needs that call, with that
 * `variable`, in a module in `app/faces/` the root layout reaches.
 */
const FACES = {
    "--font-ui": { loader: "Instrument_Sans", variable: "--font-instrument-sans" },
    "--font-id": { loader: "Fragment_Mono", variable: "--font-fragment-mono" },
    "--font-brand": { loader: "Bricolage_Grotesque", variable: "--font-bricolage-grotesque" },
};

/** The route files Next renders from, under `app/`. A file one of them reaches is on a page. */
const ROUTE_FILE = /^app\/(.*\/)?(page|layout|template|loading|error|not-found|default|global-error|route)\.js$/;

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

/**
 * The app's own stylesheet, loaded the way the build loads it. `phone-screens-still.mjs`
 * asks it too (#568), so a second loader cannot read the stylesheet another way.
 */
export async function loadDesignSystem(stylesheet = STYLESHEET) {
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
 * `sources` maps a name to the names its value mixes in. `faceImporters` maps each module
 * in `app/faces/` to the files importing it. Returns what was read and every failure, each
 * a sentence naming the file.
 */
export function judge({ waiting, sources, readsByFile, routesByFile, loaders, readersToCome, faceImporters = new Map() }) {
    const failures = [];
    const read = new Set();
    // A file a route reaches reads its names; one no route reaches is rendered nowhere.
    for (const [file, names] of readsByFile) {
        if (names.size === 0 || (routesByFile.get(file)?.size ?? 0) === 0) continue;
        for (const name of names) read.add(name);
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
    for (const [name, issue] of waiting) {
        if (issue !== null && !readersToCome.includes(issue)) failures.push(`${name} waits on #${issue}, which is not an issue still to come`);
        if (read.has(name) && issue !== null) failures.push(`${name} is read and still waits on #${issue}`);
        if (!read.has(name) && issue === null) failures.push(`${name} is declared and nothing reads it`);
    }
    // A face a name reads is loaded in `app/faces/`, into its variable, where the root layout
    // reaches the call.
    for (const [face, { loader, variable }] of Object.entries(FACES)) {
        if (!read.has(face)) continue;
        const loaded = loaders.some(
            (l) => l.imported === loader && l.variable === variable && l.file.startsWith(FACES_DIR) && routesByFile.get(l.file)?.has(ROOT_LAYOUT)
        );
        if (!loaded) failures.push(`${face} is read and no module in ${FACES_DIR} the root layout reaches loads ${loader} into ${variable}`);
    }
    // No other face is loaded: a call loads a face a name resolves to, in `app/faces/`, or is
    // the label's own.
    for (const l of loaders) {
        if (OWN_FACES.some((own) => own.file === l.file && own.imported === l.imported)) continue;
        const face = Object.entries(FACES).find(([, f]) => f.loader === l.imported && f.variable === l.variable)?.[0];
        if (!face) failures.push(`${l.file} loads ${l.imported}, which no name reads`);
        else if (!l.file.startsWith(FACES_DIR)) failures.push(`${l.file} loads ${l.imported}, which ${FACES_DIR} loads`);
        else if (!read.has(face)) failures.push(`${l.file} loads ${l.imported}, and nothing reads ${face}`);
    }
    // And the root layout is the one file applying them: no other file imports a face's module.
    for (const [module, importers] of faceImporters) {
        if (!importers.has(ROOT_LAYOUT)) failures.push(`the root layout does not import ${module}`);
        const others = [...importers].filter((f) => f !== ROOT_LAYOUT).sort();
        if (others.length > 0) failures.push(`${others.join(", ")} imports ${module}, which the root layout alone applies`);
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
    // #258 — the stylesheet names no face: no rule sets one, which outside every layer would
    // beat the root layout's classes as its `body` rule's Arial did, and no `--font-` key makes
    // one Tailwind's default, as Geist's two did.
    check(
        "  and names no face of its own",
        [...globals.matchAll(/font-family\s*:[^;}]*|--font-[\w-]+\s*:[^;}]*/g)].map((m) => m[0].trim()).join(" | "),
        ""
    );

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
    for (const name of washes) check(`  ${name} is the foreground in an amount`, mixes(declared.get(name) ?? "").join(" "), "--color-foreground-default");    // A column held over a row under the pointer stands on the Wash made opaque (0b Row, #552):
    // the same amount of the foreground over white, mixed in sRGB as the browser composites the
    // Wash over a white row, so the held column and the row beside it read as one ground.
    const amountOver = (value, space, over) => value.match(new RegExp(`^color-mix\\(in ${space}, var\\(--color-foreground-default\\) ([\\d.]+)%, ${over}\\)$`))?.[1] ?? null;
    check(
        "  the held column's ground under the pointer is the Wash's amount of the foreground over white",
        amountOver(declared.get("--color-pinned-column-hover") ?? "", "srgb", "white"),
        amountOver(declared.get("--color-hover-subtle") ?? "", "oklab", "transparent")
    );
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
    const otherStylesheets = cssFiles(join(REPO_ROOT, "app")).map(repoRelative).filter((f) => f !== DECLARATION);
    const appKeys = new Set(otherStylesheets.flatMap((rel) => [...keysOf(readFileSync(join(REPO_ROOT, rel), "utf8"))]));
    assert("  Tailwind's own keys are read, the ones the materials screens use among them", ["--text-sm", "--radius-lg", "--font-sans", "--color-red-500"].every((k) => tailwindKeys.has(k)));
    // The app's own are its two template colors since #258 took Geist's two faces out.
    assert("  and so are the app's own", ["--color-foreground", "--color-background"].every((k) => appKeys.has(k)));
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
    const jsFiles = ["app", "lib"].flatMap((d) => (existsSync(join(REPO_ROOT, d)) ? listJsFiles(join(REPO_ROOT, d)) : [])).map(repoRelative);
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
    assert("  the root layout is a route file that reaches itself", routesByFile.get(ROOT_LAYOUT)?.has(ROOT_LAYOUT));
    assert("  and reaches app/globals.css", routesByFile.get(STYLESHEET)?.has(ROOT_LAYOUT));
    // The labels' stylesheet is reached through the dialog's import from both pages that
    // open it (#457), where it was the labels' page's own until then.
    assert(
        "  the labels' stylesheet is reached from both pages that open the dialog",
        ["app/(assets)/asset-categories/[categoryRecordId]/page.js", "app/(assets)/assets/[assetId]/page.js"].every((route) =>
            routesByFile.get("app/(assets)/assets/labels.css")?.has(route)
        )
    );
    assert("  a component every kind of screen shares is reached from an asset screen and a document's", (() => {
        const routes = [...(routesByFile.get("app/components/Instant.js") ?? [])];
        return routes.some((r) => r.startsWith("app/(assets)/")) && routes.some((r) => r.startsWith("app/prs/"));
    })());
    assert("  the labels' face loader is found, variable and all", loaders.some((l) => l.imported === "Inconsolata" && l.variable === "--font-label-code"));
    // #473 — the design's faces load in `app/faces/`, one module a face, and the first of
    // them is found there and reached by the root layout (#258): the loader judgment below is
    // asked against a real call.
    assert(
        "  and the UI face's, in the module that loads it",
        loaders.some((l) => l.file === "app/faces/ui.js" && l.imported === "Instrument_Sans" && l.variable === "--font-instrument-sans")
    );
    assert("  which the root layout reaches", routesByFile.get("app/faces/ui.js")?.has(ROOT_LAYOUT));
    assert("  the sign-in layout is a route file that reaches itself", routesByFile.get("app/login/layout.js")?.has("app/login/layout.js"));
    const faceModules = jsFiles.filter((rel) => rel.startsWith(FACES_DIR));
    const faceImporters = new Map(faceModules.map((m) => [m, new Set([...graph].filter(([, to]) => to.has(m)).map(([from]) => from))]));
    check("  the faces' modules are the three", faceModules.sort().join(" "), ["app/faces/brand.js", "app/faces/id.js", "app/faces/ui.js"].join(" "));

    // ── 3: the ground, the ink and the faces, applied once ───────────────────
    log("");
    log("the root layout applies the ground, the ink and the faces, and no other layout does:");
    const rootAst = parseFile(ROOT_LAYOUT).ast;
    const elementClass = (ast, tag) => {
        let found = null;
        walk(ast, (n) => {
            if (found || n.type !== "JSXElement" || n.openingElement.name?.name !== tag) return;
            const v = n.openingElement.attributes.find((a) => a.name?.name === "className")?.value;
            if (v?.type === "Literal") found = { tokens: v.value.split(/\s+/), holes: [] };
            else if (v?.expression?.type === "TemplateLiteral")
                found = {
                    tokens: v.expression.quasis.flatMap((q) => q.value.cooked.split(/\s+/)).filter(Boolean),
                    holes: v.expression.expressions.map((e) => (e.type === "MemberExpression" ? `${e.object.name}.${e.property.name}` : e.type)),
                };
        });
        return found ?? { tokens: [], holes: [] };
    };
    const faceLocals = new Map();
    walk(rootAst, (n) => {
        if (n.type === "ImportDeclaration" && String(n.source.value).startsWith("@/app/faces/"))
            for (const s of n.specifiers) faceLocals.set(s.local.name, `app/faces/${String(n.source.value).split("/").pop()}.js`);
    });
    const html = elementClass(rootAst, "html");
    check(
        "  <html> carries each face's variable, from its module",
        html.holes.map((h) => `${faceLocals.get(h.split(".")[0]) ?? "?"}:${h.split(".")[1]}`).sort().join(" "),
        ["app/faces/brand.js:variable", "app/faces/id.js:variable", "app/faces/ui.js:variable"].join(" ")
    );
    const GROUND = [cls("bg-", "white"), cls("font-", "ui"), cls("text-", "foreground-default")];
    check("  <body> takes White, Ink and the UI face", GROUND.map((t) => elementClass(rootAst, "body").tokens.includes(t)).join(" "), "true true true");
    const otherLayouts = jsFiles.filter((rel) => /(^|\/)layout\.js$/.test(rel) && rel !== ROOT_LAYOUT);
    assert("  another layout is found, the sign-in steps'", otherLayouts.includes("app/login/layout.js"));
    const applying = otherLayouts.filter((rel) => {
        const tokens = tokensOf(stringsOf(parseFile(rel).ast));
        return GROUND.some((t) => tokens.includes(t)) || /\b\w+Face\.variable\b/.test(parseFile(rel).source);
    });
    check("  no other layout applies any of them", applying.join(" "), "");

    // ── 4: every name read or waiting, and the faces loaded where they are applied ──
    const waiting = new Map(tracked.map(([name, , issue]) => [name, issue]));
    const sources = new Map(tracked.map(([name, value]) => [name, varRefsOf(value, declaredNames)]));
    const { read, failures } = judge({ waiting, sources, readsByFile, routesByFile, loaders, readersToCome: READERS_TO_COME, faceImporters });

    log("");
    log("every name is read or waits, every face read is loaded once, and no other face is:");
    check("  failures", failures.join("\n    "), "");
    log(`  ${read.size} names read, ${[...waiting.values()].filter((i) => i !== null).length} waiting`);
    for (const issue of READERS_TO_COME) {
        log(`    #${issue} reads ${[...waiting].filter(([, i]) => i === issue).length} first`);
    }

    // ── the judgment, seen to fail where it should ───────────────────────────
    log("");
    log("the judgment fails each planted case and passes its repair:");
    const plantedName = "--height-control-lg";
    const UI_CALL = { imported: "Instrument_Sans", variable: "--font-instrument-sans" };
    const plant = ({ file, routes, names = [plantedName], issue = 463, calls = [], faceImporters = new Map() }) =>
        judge({
            faceImporters,
            waiting: new Map(names.map((name) => [name, issue])),
            sources: new Map(),
            readsByFile: new Map([[file, new Set(names)], ...calls.map((c) => [c.file, new Set()])]),
            routesByFile: new Map([[file, new Set(routes)], ...calls.map((c) => [c.file, new Set(c.routes)])]),
            loaders: calls.map(({ file: callFile, imported, variable }) => ({ file: callFile, imported, variable })),
            readersToCome: READERS_TO_COME,
        }).failures;
    const shared = "app/components/PlantedRail.js";
    // #258 — any file a route reaches reads its names, wherever the route is: a materials
    // screen's as much as a tool's, which the boundary refused until then.
    assert(
        "  a file a route reaches reads, so a waiting name it reads is stale",
        plant({ file: shared, routes: ["app/prs/page.js"] }).some((f) => f.includes("still waits on #463"))
    );
    check("  and once the mark is gone it passes, a screen above the assets axis calling it", plant({ file: shared, routes: ["app/prs/page.js", "app/layout.js"], issue: null }).join(" | "), "");
    assert(
        "  a file no route reaches reads nothing, so a name only it reads is unread",
        plant({ file: shared, routes: [], issue: null }).some((f) => f.includes("nothing reads it"))
    );
    assert(
        "  a name waiting on an issue that is not to come fails",
        plant({ file: shared, routes: [], issue: 999 }).some((f) => f.includes("#999"))
    );
    const uiCall = (callFile, routes) => ({ file: callFile, routes, ...UI_CALL });
    assert(
        "  a face read with no call loading it fails",
        plant({ file: shared, routes: [ROOT_LAYOUT], names: ["--font-ui"], issue: null }).some((f) => f.includes("loads Instrument_Sans"))
    );
    check(
        "  and its call in app/faces/, which the root layout reaches, repairs it",
        plant({ file: shared, routes: [ROOT_LAYOUT], names: ["--font-ui"], issue: null, calls: [uiCall("app/faces/ui.js", [ROOT_LAYOUT])] }).join(" | "),
        ""
    );
    assert(
        "  but a call only another layout reaches does not count",
        plant({ file: shared, routes: [ROOT_LAYOUT], names: ["--font-ui"], issue: null, calls: [uiCall("app/faces/ui.js", ["app/login/layout.js"])] }).some((f) =>
            f.includes("loads Instrument_Sans")
        )
    );
    assert(
        "  nor one outside app/faces/, which is a second place the face loads",
        plant({
            file: shared,
            routes: [ROOT_LAYOUT],
            names: ["--font-ui"],
            issue: null,
            calls: [uiCall("app/faces/ui.js", [ROOT_LAYOUT]), uiCall(ROOT_LAYOUT, [ROOT_LAYOUT])],
        }).some((f) => f.includes(`${ROOT_LAYOUT} loads Instrument_Sans, which ${FACES_DIR} loads`))
    );
    // Geist, as the root layout loaded it until #258: a face no name reads.
    assert(
        "  a call loading a face no name reads fails",
        plant({
            file: shared,
            routes: [ROOT_LAYOUT],
            issue: null,
            calls: [{ file: ROOT_LAYOUT, routes: [ROOT_LAYOUT], imported: "Geist", variable: "--font-geist-sans" }],
        }).some((f) => f.includes("loads Geist, which no name reads"))
    );
    assert(
        "  as does a face's own call when nothing reads its name",
        plant({ file: shared, routes: [ROOT_LAYOUT], issue: null, calls: [uiCall("app/faces/ui.js", [ROOT_LAYOUT])] }).some((f) =>
            f.includes("nothing reads --font-ui")
        )
    );
    check(
        "  and the label's own face passes",
        plant({
            file: shared,
            routes: [ROOT_LAYOUT],
            issue: null,
            calls: [{ ...OWN_FACES[0], routes: ["app/(assets)/assets/[assetId]/page.js"], variable: "--font-label-code" }],
        }).join(" | "),
        ""
    );
    assert(
        "  a face's module another layout imports fails, the root layout alone applying it",
        plant({ file: shared, routes: [], issue: null, faceImporters: new Map([["app/faces/ui.js", new Set([ROOT_LAYOUT, "app/login/layout.js"])]]) }).some((f) =>
            f.includes("app/login/layout.js imports app/faces/ui.js")
        )
    );
    assert(
        "  as does one the root layout does not import",
        plant({ file: shared, routes: [], issue: null, faceImporters: new Map([["app/faces/id.js", new Set(["app/(assets)/layout.js"])]]) }).some((f) =>
            f.includes("the root layout does not import app/faces/id.js")
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

// The width every list table is held to, and the one place it is decided (#183).
//
// WHERE 52rem COMES FROM, which is the question this module exists to answer. A
// list page's shell is `mx-auto w-full max-w-4xl p-8`: `max-w-4xl` is 56rem and
// `p-8` takes 2rem off each side, so the content box is 52rem — 832px at
// 16px/rem, which is the figure every width measurement on these screens was
// taken at. That subtraction was written out in full in TWO table comments and
// cited by number in nine more places, and one of the nine had already gone
// false: `/pos` re-cut a column in #314 and four sentences went on saying the
// row summed to 52rem when it summed to 45.
//
// THE CONSTANT IS THE FLOOR, NOT THE SUM OF ANY colgroup. `w-full` alone lets a
// `table-fixed` shrink below its declared columns, and the one flexible column
// absorbs the shortfall — measured at 375px on the material screens, where
// Vendor collapsed to nothing and every row went from 29px to 69px. The minimum
// holds the desktop layout and hands the overflow to the `overflow-x-auto`
// wrapper each of the five sits in, so the page body never scrolls sideways.
// What a table's own columns add up to is that table's decision and is recorded
// in its own `colgroup` comment: `/deliveries` and `/invoices` re-cut to exactly
// 52rem, and `/pos` declares 58.25rem and scrolls inside its container on
// purpose (#235, #311, #314).
//
// THE FIVE THAT CARRY IT are `/deliveries`, `/invoices`, `/pos`, `/materials`
// and `/materials/[materialId]`. **A table on a page with a different shell does
// NOT take this class** — `/deliveries/[deliveryId]` is `max-w-3xl` and declares
// its own `min-w-[32rem]`, which is a different budget and not a stale copy of
// this one. `scripts/tests/offline/list-table-width.mjs` reads the shell of
// every page that imports this and fails one that is not `max-w-4xl` + `p-8`,
// so the sentence above cannot quietly stop being true.
//
// KEEP THE CLASS ONE WHOLE LITERAL. `min-w-[52rem]` is a Tailwind arbitrary
// value, generated only because the scanner finds that exact string in a source
// file; interpolating the figure into the class name produces no rule at all,
// and a missing min-width is invisible until somebody narrows a window. Verified
// against the production build rather than the dev server, whose scanner runs
// differently: `npm run build` emits `.min-w-\[52rem\]{min-width:52rem}` with
// this file as the only source of the string.
//
//   AND THE SCANNER READS COMMENTS, IN EVERY DIRECTORY, WHICH IS THE CONSTRAINT
//   ON EDITING THIS FILE AND ITS CHECK. Measured on this issue by diffing two
//   production builds: the word `Nrem` written inside a class-shaped token in a
//   sentence in `scripts/tests/offline/list-table-width.mjs` — prose, in a
//   directory that ships nothing — added a real `min-width:Nrem` rule to the
//   stylesheet every page loads. It is dead weight rather than a defect, and it
//   is invisible unless somebody compares builds. So a comment here may name a
//   class the app really uses and must not invent one to illustrate a point.
//
// PURE ON PURPOSE. `/deliveries` and `/pos` render their lists from
// `"use client"` components, so nothing here may import anything — same rule as
// `app/components/modalStyles.js`, which is this module's shape one concern
// over.

/**
 * The class every list table wears. One string, identical at all five call
 * sites before this module existed, so importing it renders the same bytes.
 */
export const LIST_TABLE_CLASS = "w-full min-w-[52rem] table-fixed text-sm";

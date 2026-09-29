// The sheet a tool label is printed on (#353): the stock's dimensions, the
// arithmetic that turns modules and points into millimeters, the face the printed
// code is measured in, and every word the screen says.
//
// THE STOCK IS NOT CHOSEN YET, AND THAT IS WHY THIS FILE EXISTS. Nobody has
// confirmed which printer the site has, so no adhesive stock has been bought. The
// layout is therefore built against a sheet with the dimensions in ONE place: when
// the real stock arrives, `LABEL_STOCK` changes and nothing under
// `app/(tools)/tool-items/labels/` is reopened. Every figure any caller needs is
// derived from that object rather than written down a second time.
//
// AND #412 TOOK THAT ONE STEP FURTHER: THE GRID IS DERIVED TOO. #353 typed the
// columns, the rows and the two pitches into `LABEL_STOCK` because they were a real
// product's published geometry. No product has these dimensions — they come from
// the symbol — so `LABEL_GRID` computes how many fit from the page, the margin, the
// label and the gap, and `CELLS_PER_SHEET` follows. A real stock's own count then
// has something to be checked against rather than merely replacing it.
//
// WHAT #412 CHANGED, AND IT INVERTED WHICH END OF THIS FILE IS THE INPUT. #353 took
// a label size from a product and derived the module from it. The label goes on a
// wrench handle, so the module and the readable code go to their floors and the
// LABEL is what comes out. `moduleSizeMm` still turns a label into a module; what
// moved is that the label is chosen to make it land on the floor rather than
// wherever a product put it.
//
// AND #431 STACKED THE CODE UNDER THE SYMBOL, WHICH TURNED THE SIDE IT READS. Side
// by side, the height was the side only the symbol spanned; stacked, it is the
// WIDTH, so that is what `moduleSizeMm` reads, and the height is the symbol, a gap
// and one em of code. The label was 16.8 x 20.42 mm there, against 30.3 x 16.8 side
// by side and 66.675 x 25.4 on the product #353 started from.
//
// AND #453 SIZED IT FOR TODAY'S SYMBOL ALONE, WHICH IS THE DESIGN'S LABEL WITH THE
// CODE AT ITS FLOOR. The version headroom and the gap both went, and the label is
// 15.2 x 17.32 mm. The design drew 15.2 x 17.2, which is the same label with the code
// at 2.0 mm; six points is 2.1167, and at 17.2 the code under today's symbol runs
// into the bottom inset. `VERSION_HEADROOM` carries why the headroom went and
// `LABEL_GAP_MM` why the gap did.
//
// WHICH LEAVES THE SYMBOL NO SLACK, AND THAT IS THE POINT AND A HAZARD AT ONCE. The
// widest symbol is today's, 13.2 mm against 13.2 mm of width, so `symbolBox`'s
// comparison across is an equality; down, it has 0.0033 mm more, which is only the
// label's height rounded up to a hundredth from what the code's point size comes to.
// The equality holds as written — every figure is a sum of the same few constants
// and the floats land on the same value, checked rather than assumed — but a
// constant changed by a hundredth would put a `<=` on the wrong side of a rounding
// step with nothing on screen to show it. The module reaches its floor the same way:
// 13.2 / 33 comes to 0.39999999999999997, and it is the multiplication by a hundred
// inside `moduleSizeMm` that rounds it back to 0.4 before the floor is taken;
// dividing by 0.01 instead reports 0.39, measured. **Nothing has been observed doing
// either.** The check pins the module, the budgets and the `fits` verdicts by value,
// which is what would catch them.
//
// SIZED BY THE MODULE AND NEVER BY THE SYMBOL, which is the contract #351 handed
// over. A QR symbol's side grows four modules per version, so a box of fixed
// millimeters renders a larger version's modules thinner while a fixed millimeters
// PER MODULE renders a larger symbol. Only the second stays scannable. So
// `moduleSizeMm` is the value this file computes and the symbol's printed size is
// whatever that times its own side count comes to.
//
// AND IT IS SIZED FOR TODAY'S VERSION AND NO OTHER, WHICH MAKES THE HOST'S LENGTH
// WHAT DECIDES WHETHER A LABEL PRINTS (#453). #353 held two versions of headroom,
// against a four-digit daily sequence and a longer host; **#411 removed the first** —
// the address is 31 characters against a capacity of 38, so a five-digit sequence is
// still version 2, measured — and #412 kept one step for the host. #453 took that one
// as well, so a symbol a version larger than today's does not fit and is not drawn,
// and the only address that builds one is a host longer than seventeen characters.
// `VERSION_HEADROOM` carries why, and the condition for putting the step back.
//
// BOTH FLOORS ARE CITATIONS AND NEITHER IS A MEASUREMENT, AND #412 MADE THE TWO
// READ ALIKE. `MIN_MODULE_MM` and the code's floor were set together in #353 and
// only the first was recorded as quoted; the second carried no source and no
// condition for revisiting it, which is how a number nobody can act on survives.
// Both now say where they come from and both reopen on the same event — a sheet
// printed on paper and read by a phone, which nothing in this repository can do.
// **#453 did not take that event away**, though a Vercel domain drawing no sheet can
// read as though it had: a local server's address is version 2 at the production
// geometry, so a sheet printed from one is the measurement. `VERSION_HEADROOM` says
// how. **The code's floor is in points since #431** (`MIN_ID_FONT_PT`), the unit the
// convention it cites is stated in. `offline/tool-label-sheet.mjs` holds the
// derived module against its floor, so a stock too small to carry a scannable
// symbol fails a check rather than printing a sheet nobody can scan.
// **docs/notes/tools.md records the reopening condition.**
//
// AND BESIDE THE TWO CITATIONS SITS ONE MEASUREMENT (#431). The character width is
// the advance of the face the code prints in, which `LABEL_CODE_TYPEFACE` names —
// so unlike the floors it reopens on a change of face rather than on a printed
// sheet.
//
// PURE, AND ITS ONE IMPORT IS THE POINT RATHER THAN AN EXCEPTION. The screen's
// selection is client state, so the component that draws the sheet is a
// `"use client"` file and imports this for the geometry and the copy — which means
// nothing here may reach `lib/toolLabelQR.js`, since that module imports `qrcode`
// and would land the whole encoder in the browser bundle. **The symbol's side
// count arrives as an ARGUMENT for exactly that reason**, and the face is loaded
// by the page rather than here for a neighboring one: `next/font` exists only
// inside Next's compiler, so this file names the face and the page loads it. What
// it does import is `lib/toolRegistration.js`, which is as pure as this file and
// is where the cap comes from; the extension is spelled out so the offline tier
// can load both under plain `node` (lib/materialPriceView.js's precedent, #19).

import { MAX_TOOL_ITEMS_PER_REGISTRATION } from "./toolRegistration.js";

/**
 * The tool items one request may print, capped at the largest registration.
 *
 * THE TWO NUMBERS ARE ONE NUMBER ON PURPOSE. The whole reason this screen exists
 * is that a registration's whole run reaches it in one press — since #449 it lands on
 * its tool's page with every id it minted selected, and that page's print control
 * sends them here; until then its own answer linked straight here — so a cap below
 * `MAX_TOOL_ITEMS_PER_REGISTRATION` would silently drop the tail of the largest
 * registration anybody can make. It is imported rather than restated, so the two
 * cannot drift.
 *
 * AND IT BOUNDS WHAT A TOOL'S OWN PAGE MAY SEND (#442, #443). That screen's print
 * control sends what its list has selected, and `lib/toolListView.js` imports this
 * so the control refuses a selection larger than one request prints rather than
 * sending one whose tail this screen would drop. Its page box selects a page at a
 * time, so a page may not hold more than this either — `TOOL_PAGE_SIZE` is 25
 * against 100, and `offline/tool-list-view.mjs` holds the order of the two. Until
 * #443 that page sent the page it was showing and nothing imported this there. The
 * tool item's own page sends one, which nothing here needs to hold.
 */
export const MAX_LABELS_PER_REQUEST = MAX_TOOL_ITEMS_PER_REGISTRATION;

/**
 * The adhesive stock a sheet is printed on, and the only place its figures live.
 *
 * NO PRODUCT HAS THESE DIMENSIONS, WHICH IS WHY THEY ARE HERE RATHER THAN QUOTED.
 * #353 used Avery 5160 — 30 labels of 1 x 2-5/8 inch — because a sheet had to come
 * from somewhere and an office printer takes that one. #412 sizes the label from
 * the symbol instead, so what is below is a die-cut nobody sells yet: the smallest
 * label the module floor and the readable code allow, on the paper an office
 * printer already holds. `labelSizeMm` is where the two numbers come from, and the
 * check requires these to satisfy it.
 *
 * THE COUNT IS NOT HERE, AND THAT IS THE CHANGE WORTH KNOWING. `columns`, `rows`
 * and the two pitches were typed into this object while they were a product's
 * published geometry; they are `LABEL_GRID` now, computed from the page, the
 * margin, the label and the gap. **When a real stock is bought its own count goes
 * back in and the derivation becomes the thing that checks it**, which is the
 * opposite direction from a figure being overwritten.
 *
 * `page` is the CSS `@page size` keyword, and it is the one figure here that is
 * spelled twice: `@page size` cannot read a custom property, so `labels.css`
 * carries the literal and the check compares the two. Changing stock therefore
 * touches this object and that one keyword.
 */
export const LABEL_STOCK = {
    page: "letter",
    pageWidthMm: 215.9,
    pageHeightMm: 279.4,
    /**
     * The edge a printer cannot reach, on all four sides.
     *
     * ONE FIGURE RATHER THAN A TOP AND A LEFT, because nothing about this stock is
     * a product's asymmetric die-cut any more. 10 mm clears the non-printable edge
     * an office printer leaves, and `LABEL_GRID` requires the far side to keep at
     * least this much as well — which is what makes the count well defined.
     */
    marginMm: 10,
    /** The label itself. See `labelSizeMm` for where the two come from. */
    labelWidthMm: 15.2,
    labelHeightMm: 17.32,
    /** Between neighboring die-cuts, so a blade has somewhere to land. */
    columnGapMm: 2,
    rowGapMm: 2,
};

/**
 * How many of those labels a sheet holds, and where the next one starts.
 *
 * DERIVED RATHER THAN TYPED (#412) — see `LABEL_STOCK`. A column fits when the
 * label plus its gap still leaves the far margin, so the count is the number of
 * pitches that fit in the page less both margins, plus the last label itself.
 * `offline/tool-label-sheet.mjs` requires the answer to be MAXIMAL: one more of
 * either would put the far margin under `marginMm`.
 */
function fitCount(availableMm, sizeMm, gapMm) {
    return Math.floor((availableMm + gapMm) / (sizeMm + gapMm));
}

export const LABEL_GRID = {
    columns: fitCount(
        LABEL_STOCK.pageWidthMm - LABEL_STOCK.marginMm * 2,
        LABEL_STOCK.labelWidthMm,
        LABEL_STOCK.columnGapMm
    ),
    rows: fitCount(
        LABEL_STOCK.pageHeightMm - LABEL_STOCK.marginMm * 2,
        LABEL_STOCK.labelHeightMm,
        LABEL_STOCK.rowGapMm
    ),
    /** Corner to corner between neighbors — the label plus the gap after it. */
    columnPitchMm: LABEL_STOCK.labelWidthMm + LABEL_STOCK.columnGapMm,
    rowPitchMm: LABEL_STOCK.labelHeightMm + LABEL_STOCK.rowGapMm,
};

/** Label positions on one sheet. */
export const CELLS_PER_SHEET = LABEL_GRID.columns * LABEL_GRID.rows;

/**
 * What to ask a supplier for, composed rather than typed.
 *
 * THE STOCK HAS NO PRODUCT NAME NOW, so the screen states the geometry instead —
 * which is what a person would search a supplier for, and which cannot drift from
 * the dimensions above because it is built from them. When a real stock is bought,
 * its name is what belongs here.
 */
export const LABEL_STOCK_NAME = `${LABEL_STOCK.labelWidthMm} x ${LABEL_STOCK.labelHeightMm} mm die-cut`;

/**
 * How far inside a label's die-cut edge anything may be printed.
 *
 * A sheet does not feed perfectly straight and a die-cut is not perfectly placed,
 * so ink at the very edge of a label lands on the liner instead. This is the
 * allowance for both, and it is what the symbol's size is computed against rather
 * than the label's full height.
 */
export const LABEL_SAFE_INSET_MM = 1.0;

/**
 * Between the symbol and the code under it.
 *
 * ZERO SINCE #453, AND THE FIGURE IS THE DESIGN'S. The margin the specification asks
 * for is the quiet zone, and the SVG already paints it white on every side of the
 * symbol, so the code's line box can start where the symbol's box ends: its ink sits
 * a further 0.23 mm down (#431's measurement of the face), 1.83 mm from the nearest
 * dark module against the 1.6 the specification requires. Nor is a gap a tolerance —
 * the symbol and the code are one raster printed in one pass, so nothing can register
 * one against the other, and what a die-cut or a feed can miss is
 * `LABEL_SAFE_INSET_MM`'s. So the 1.5 mm this held from #353 was a layout choice with
 * no source, carried from beside the symbol to under it by #431, and the design drew
 * none. Adding one back is the design's to do, and it makes the label taller by the
 * same amount.
 */
export const LABEL_GAP_MM = 0;

/**
 * Versions of growth the printed size must absorb — see the header.
 *
 * ZERO SINCE #453, WHERE #412 HELD ONE AND #353 TWO. Each step was held against a
 * claimant on the address. #411 retired the sequence — a five-digit daily sequence is
 * still version 2, measured — and #412 kept one step for the host. The path, the
 * code, the error-correction level and the library are all held to version 2 by
 * `offline/tool-label-qr.mjs`, so the only address that reaches version 3 is a host
 * longer than seventeen characters.
 *
 * WHAT THAT STEP BOUGHT, AGAINST WHAT IT COST. #412's reason stands as arithmetic: the
 * module is at its floor, so a version step can only be a bigger label, and with no
 * headroom `symbolBox` refuses the symbol and the screen draws no label for it. What
 * it protected is narrower than that sentence reads. A permanent host moves by a
 * decision, and docs/notes/tools.md records a host move as a reprint of every label
 * already glued to a tool — so the step bought reprinting onto the same die-cut. What
 * it cost was 1.6 mm on the narrow side of every label, and that is the side that
 * decides whether the sticker goes on a wrench: a handle between 15.2 and 16.8 mm was
 * refused for it. The one host it let print was a Vercel domain, which no label may be
 * printed from.
 *
 * SO THE HOST'S LENGTH DECIDES WHETHER A LABEL PRINTS, AND IT HAS TO BE SETTLED BEFORE
 * THE FIRST ONE IS. `hyeusa.com` is ten characters and version 2 holds a host of
 * seventeen beside today's code. `portal.hyeusa.com` is exactly seventeen, so a
 * subdomain reaches the edge — and there the room is spent, so the thousandth tool
 * item of a day steps the version. **A permanent host longer than seventeen
 * characters is the condition for putting this back to 1**, and the label grows 1.6 mm
 * each way with it.
 *
 * AND IT DOES NOT CLOSE THE MEASUREMENT BOTH FLOORS WAIT ON. With a Vercel domain
 * drawing no sheet, printing can look as though it has become impossible. It has not:
 * a local server's address is version 2 — `HTTP://LOCALHOST:3100/T/260909-004` is 34
 * characters — so a sheet printed from one is today's geometry exactly, and a phone
 * decoding it is the reading `MIN_MODULE_MM` and `MIN_ID_FONT_PT` reopen on. The phone
 * cannot open the address it decodes, and the measurement does not need it to.
 */
export const VERSION_HEADROOM = 0;

/** Modules a version step adds to a side, from the specification. */
const MODULES_PER_VERSION = 4;

/**
 * The floor a printed module may not go under. A citation, not a measurement.
 *
 * 0.4 mm is the figure widely published as the practical minimum for a phone
 * camera resolving a printed QR module. It is here as a guard on the derivation
 * rather than as a fact this repository established: what would settle it is
 * printing a sheet and scanning it, which nobody has done — and which a sheet
 * printed from a local server still allows since #453, the local address being
 * version 2 at this geometry (see `VERSION_HEADROOM`).
 *
 * **IT IS ALSO THE TARGET SINCE #412**, not only the floor. #353 derived the module
 * from a product's label and landed at 0.57 mm; this label is sized so the
 * derivation lands here, because the label has to go on a wrench handle and every
 * hundredth above the floor is width the sticker does not have.
 */
export const MIN_MODULE_MM = 0.4;

/**
 * The smallest the readable code may be set, in points. A citation, not a
 * measurement.
 *
 * 6 pt is the size print convention holds as the smallest legible in printed
 * matter. It is a FONT SIZE — the em, which is what this constant sets — and the
 * convention states it as one, so the value and its source say the same thing.
 * Like the module floor above it is a bound this repository took from outside
 * rather than established, and it settles the same way: a sheet printed on paper
 * and read at the distance the code is actually read at.
 *
 * **2.0 mm UNTIL #431, WHICH IS 5.67 pt, AND NOT BY INTENT.** Every other dimension
 * on the label is in millimeters and this one followed them, which put it just
 * under the floor it stood for. Its sentence called it the height below which an
 * office printer stops holding a character's strokes apart, which reads as the
 * height of the ink; the convention underneath it speaks of a font size, and
 * moving the unit is what makes the two agree. The screen sets the code in points,
 * and the millimeters are worked out below, where the arithmetic adds them up.
 *
 * **2.5 mm UNTIL #412, AND THAT CHANGE WAS THE READING DISTANCE.** #353 set both
 * floors for a label read at arm's length; this one is read in the hand, off a tool
 * somebody is holding.
 */
export const MIN_ID_FONT_PT = 6;

/** Millimeters in a point: 25.4 to the inch, over 72 points to the inch. */
const MM_PER_PT = 25.4 / 72;

/**
 * The code's floor in millimeters, which is what the label's arithmetic adds.
 *
 * It lands on no hundredth — 2.1167 mm — and that is why `labelSizeMm` rounds the
 * label up and `labelBudget` leaves the two things the code needs unrounded.
 */
const ID_FONT_MM = MIN_ID_FONT_PT * MM_PER_PT;

/**
 * Characters in the code a label prints, which is what its width is budgeted for.
 *
 * TEN SINCE #411, WHERE IT WAS THE `Tool Item ID`'s SEVENTEEN. The label prints the
 * id less its `HYE-TL-` token — `lib/toolRoutes.js:labelCodeFor` — because those
 * seven characters are on every tool item and separate none of them.
 *
 * **IT DECIDES NO DIMENSION SINCE #431.** Beside the symbol, the code's width was a
 * term in the label's long side and #412 sized the label down onto it; under the
 * symbol it shares the symbol's width, and ten characters at the floor take
 * 10.58 mm of the 13.2 mm there. What this figure holds now is the fit, and the
 * room is twelve characters at the floor, which is a five-digit daily sequence
 * exactly. It was thirteen until #453 took the headroom's 1.6 mm off the width.
 */
const ID_CHARACTERS = 10;

/**
 * Width of one character as a fraction of the font size. A measurement, not an
 * estimate.
 *
 * 0.5 is the advance of `LABEL_CODE_TYPEFACE`: 500 of the face's 1000 units to the
 * em, the same for every digit and for the hyphen, read out of the font file the
 * app serves. In a browser `260909-004` renders 10.58 mm wide at the floor, which
 * is ten of those characters exactly. A monospace face has one advance, so there is
 * nothing to average and no margin to leave.
 *
 * **IT REOPENS WHEN THE FACE DOES.** The figure belongs to one face at its default
 * width, and another face, a width axis or any letter-spacing is another figure — so
 * `offline/tool-label-sheet.mjs` holds the face the page loads to the one named
 * here and pins both by value, and changing either means measuring this again.
 *
 * **0.6 UNTIL #431, AN OVER-ESTIMATE HELD WHILE NO FACE WAS PICKED.** The
 * measurement it cited, #412's 0.534, was Arial: nothing on the tools screens set a
 * face, so the code inherited `globals.css`'s body font, and a figure read in that
 * state was standing in for a settled one.
 */
const CHARACTER_WIDTH_RATIO = 0.5;

/**
 * The face the printed code is set in, and the one `CHARACTER_WIDTH_RATIO` was
 * measured against.
 *
 * THE DESIGN'S CHOICE, HERE BECAUSE THE WIDTH BUDGET DEPENDS ON IT (#431). It is
 * spelled twice, as `LABEL_STOCK.page` is: `next/font` takes the face as a static
 * import in the page that loads it, so `app/(tools)/tool-items/labels/page.js`
 * carries the loader and `offline/tool-label-sheet.mjs` compares the two.
 */
export const LABEL_CODE_TYPEFACE = "Inconsolata";

/**
 * Millimeters per QR module, derived from the stock rather than chosen.
 *
 * THE LABEL'S WIDTH IS WHAT BINDS IT (#431). The code sits under the symbol, so the
 * width is the side nothing but the symbol and two safe insets span, and it has to
 * hold the LARGEST symbol the headroom admits rather than today's — which since
 * #453 are one symbol. Rounded DOWN to a hundredth of a millimeter, so the fit can
 * never be lost to a rounding step.
 *
 * `sideModules` is the symbol's side INCLUDING its quiet zone — `QR_SIDE_MODULES`,
 * not `QR_SYMBOL_MODULES`. Passing the smaller one would size the box to the
 * symbol proper and crop the four modules of margin the SVG carries, which is the
 * one thing #351 asked this issue not to do.
 *
 * IT READ THE HEIGHT UNTIL #431, while the code sat beside the symbol and the
 * height was the side only the symbol spanned. The two sides leave the symbol
 * 13.2 mm and 13.2033 mm, which floor to the same module, so no figure can tell
 * which one this reads and the check reads the side off the AST instead. The label
 * is chosen so the answer lands on `MIN_MODULE_MM` — see `labelSizeMm`, the same
 * arithmetic solved the other way round — and keeping this pointed at the stock is
 * what lets a real stock, when one is bought, give a better module without this
 * function being edited.
 */
export function moduleSizeMm({ sideModules, versionsOfHeadroom = VERSION_HEADROOM }) {
    const widest = sideModules + versionsOfHeadroom * MODULES_PER_VERSION;
    const available = LABEL_STOCK.labelWidthMm - LABEL_SAFE_INSET_MM * 2;
    return Math.floor((available / widest) * 100) / 100;
}

/**
 * The smallest label the two floors allow, which is where `LABEL_STOCK` came from.
 *
 * `moduleSizeMm` SOLVED THE OTHER WAY ROUND, AND HAVING BOTH IS THE POINT. That one
 * takes a label and reports the module; this one takes the floors and reports the
 * label. `offline/tool-label-sheet.mjs` requires the stock to satisfy this, so the
 * dimensions typed into `LABEL_STOCK` and the arithmetic that produced them are two
 * paths to one pair of numbers rather than one path and a comment.
 *
 * THE WIDTH IS THE SYMBOL, AND THE HEIGHT IS THE SYMBOL, THE GAP AND ONE EM OF CODE,
 * which is the stacked arrangement the sheet draws (#431), with a gap of nothing
 * since #453. One em because the
 * code's line box is set to its size — `LabelSheet.js` gives the two the same name —
 * so the code claims exactly its point size, in millimeters. The code's WIDTH is no
 * term here: at the floor it is narrower than the symbol, and `labelBudget` is
 * where that is checked.
 *
 * ROUNDED UP TO A HUNDREDTH, which is `moduleSizeMm`'s rounding turned round for
 * the same reason: a die-cut a fraction smaller than its parts is the failure. The
 * point size lands on no hundredth, so this is the rounding that moves a figure —
 * the height comes to 17.3167 mm and the label is 17.32.
 */
export function labelSizeMm({ sideModules, versionsOfHeadroom = VERSION_HEADROOM }) {
    const widestSymbolMm = (sideModules + versionsOfHeadroom * MODULES_PER_VERSION) * MIN_MODULE_MM;
    return {
        widestSymbolMm: round2(widestSymbolMm),
        widthMm: ceilHundredth(widestSymbolMm + LABEL_SAFE_INSET_MM * 2),
        heightMm: ceilHundredth(widestSymbolMm + LABEL_GAP_MM + ID_FONT_MM + LABEL_SAFE_INSET_MM * 2),
    };
}

/**
 * What one label's parts come to, so a check can add them up.
 *
 * THE POINT IS THAT THE SUM IS ASSERTABLE. A layout can be drawn wrong in ways no
 * offline check can see, but whether the pieces FIT is arithmetic — and if they do
 * not, nothing the design does can stop the symbol and the code from overlapping,
 * which would print ink into the quiet zone. So this returns the budget and
 * `offline/tool-label-sheet.mjs` requires it to balance for the widest symbol.
 *
 * THE TWO THINGS THE CODE NEEDS ARE NOT ROUNDED (#431). Its size arrives in points
 * and its millimeters land on no hundredth, and a need rounded to any step can come
 * out smaller than it is, which is the one direction a budget may not be wrong in.
 * Every room here is a sum of figures exact to a hundredth, so rounding one only
 * strips float noise.
 */
export function labelBudget({ sideModules, versionsOfHeadroom = VERSION_HEADROOM }) {
    // `moduleMm` rather than `module`, which Next reserves — eslint's
    // `no-assign-module-variable` catches it and this repo keeps that job clean.
    const moduleMm = moduleSizeMm({ sideModules, versionsOfHeadroom });
    const widestSide = sideModules + versionsOfHeadroom * MODULES_PER_VERSION;
    return {
        moduleMm,
        /** The box today's symbol occupies, quiet zone included. */
        symbolMm: round2(sideModules * moduleMm),
        /** The box the largest symbol this size absorbs occupies. */
        widestSymbolMm: round2(widestSide * moduleMm),
        /** Height and width a label may print inside. */
        usableHeightMm: round2(LABEL_STOCK.labelHeightMm - LABEL_SAFE_INSET_MM * 2),
        usableWidthMm: round2(LABEL_STOCK.labelWidthMm - LABEL_SAFE_INSET_MM * 2),
        /** What is left under the widest symbol and the gap, which the code sits in. */
        textHeightMm: round2(
            LABEL_STOCK.labelHeightMm - LABEL_SAFE_INSET_MM * 2 - widestSide * moduleMm - LABEL_GAP_MM
        ),
        /** What the code needs at its floor: one em tall, its line box being its size. */
        minIdHeightMm: ID_FONT_MM,
        /** And across, which the usable width under the symbol must clear. */
        minIdWidthMm: ID_CHARACTERS * CHARACTER_WIDTH_RATIO * ID_FONT_MM,
    };
}

/**
 * The box ONE symbol occupies, from ITS OWN side count rather than from the
 * constant the module size was derived against.
 *
 * THIS IS THE WHOLE CONTRACT AND THE FIRST IMPLEMENTATION GOT IT WRONG, measured
 * in a browser rather than reasoned about. Every label's box was sized from
 * `QR_SIDE_MODULES` — today's version — so a symbol that came back a version
 * larger was scaled INTO that box: the SVG carries a `viewBox` and no width, so 37
 * modules rendered in an 18.81 mm square put each module at 0.508 mm instead of
 * 0.57. That is a version step making the modules thinner, which is the exact
 * failure sizing by the module exists to prevent, and it was invisible on screen.
 *
 * So the box is per label. `buildToolItemQR` reports the side count it actually
 * produced and this multiplies it by the stock's fixed millimeters per module, so a
 * longer address prints a LARGER symbol at the same module width.
 *
 * `fits` is what stops the other half of that failure being silent: a label crops
 * its overflow, and a cropped QR code is unscannable with nothing to see. Beyond
 * the headroom the size was derived for, the screen says so instead.
 *
 * ACROSS AND DOWN BOTH, THOUGH THE TWO COME OUT ALIKE (#431). Across, the symbol has
 * the width less two insets; down, the height less the insets, the gap and the
 * code's em. Those are 13.2 and 13.2033 mm, so either clause alone returns every
 * verdict today, and the check reads both clauses off the AST rather than trusting
 * the verdicts to notice one going.
 */
export function symbolBox({ sideModules, moduleMm }) {
    const boxMm = round2(sideModules * moduleMm);
    return {
        boxMm,
        fits:
            boxMm <= LABEL_STOCK.labelWidthMm - LABEL_SAFE_INSET_MM * 2 &&
            boxMm <= LABEL_STOCK.labelHeightMm - LABEL_SAFE_INSET_MM * 2 - LABEL_GAP_MM - ID_FONT_MM,
    };
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

/**
 * The smallest hundredth not under `value`, for a die-cut dimension.
 *
 * The four-decimal step first is what keeps float noise from rounding an exact
 * figure up: `0.1 + 0.2` arrives as 0.30000000000000004, which a bare ceiling
 * would make 0.31.
 */
function ceilHundredth(value) {
    return Math.ceil(Math.round(value * 10000) / 100) / 100;
}

/**
 * Where one label position sits on its sheet, in millimeters from the page corner.
 *
 * Absolute placement rather than a grid, because the offsets are the stock's own
 * and a gap that a grid would distribute is a gap the die-cut already fixed.
 */
export function cellPosition(indexOnSheet) {
    const row = Math.floor(indexOnSheet / LABEL_GRID.columns);
    const column = indexOnSheet % LABEL_GRID.columns;
    return {
        leftMm: round2(LABEL_STOCK.marginMm + column * LABEL_GRID.columnPitchMm),
        topMm: round2(LABEL_STOCK.marginMm + row * LABEL_GRID.rowPitchMm),
    };
}

/**
 * The first label position a sheet prints onto, 1-based, clamped to the sheet.
 *
 * PARTLY USED SHEETS ARE THE ORDINARY CASE RATHER THAN AN EDGE. A registration is
 * usually a handful of tools, so a run of six labels leaves nearly the whole sheet —
 * and the next run would waste another sheet if printing always started at the
 * top. A person looking at a part-used sheet counts to the first free label, which
 * is why this is a POSITION and not a count of ones to skip.
 *
 * It clamps rather than refusing, which is `pageOfToolItems`' shape (#339) for the
 * same reason: the value arrives from a control a person can type into.
 */
export function readStartPosition(raw) {
    const value = Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(value)) return 1;
    return Math.min(Math.max(value, 1), CELLS_PER_SHEET);
}

/**
 * How the selected labels fall onto sheets, offset by the start position.
 *
 * Returns one entry per sheet, each carrying its own cells: a cell is either a
 * label or a blank held open before the start position. Blanks exist only on the
 * first sheet, because a run that spills over starts at the top of the next one.
 */
export function paginateLabels(labels, startPosition) {
    const start = readStartPosition(startPosition);
    const cells = [...Array.from({ length: start - 1 }, () => null), ...labels];
    const sheets = [];
    for (let at = 0; at < cells.length; at += CELLS_PER_SHEET) {
        sheets.push(cells.slice(at, at + CELLS_PER_SHEET));
    }
    return sheets;
}

/**
 * Every word this screen says.
 *
 * None is in JSX: a string written into a component is invisible to the vocabulary
 * checks and to `scripts/screen-strings.mjs`, so it cannot be swept when a word
 * changes. The screen words are the design's since #455 — a `Tool Items` row is a
 * `tool` in a sentence — and this said `tool` and `tool item`, never a bare `item`,
 * until then; docs/notes/naming.md holds the row.
 */
export const TOOL_LABEL_SHEET_COPY = {
    heading: "Print tool labels",

    // `openFromRegistration` WAS HERE (#353) AND WENT WITH THE ANSWER IT STOOD ON
    // (#449). A registration lands on its tool's page with what it wrote selected, so
    // the control below is the one that prints those labels, and the words for opening
    // this screen are the two that remain.
    /**
     * From a tool's own page, where it sends what the list has selected (#443).
     *
     * IT NAMES NO RANGE, AND THAT IS THE ISSUE'S WHOLE POINT. It read `…for the tool
     * items on this page` while the control sent the page it was on, because nothing
     * on the screen showed that range and the words had to. The range is the boxes
     * and the count beside this control now, so words restating it would be a second
     * account of one fact that a design could let drift from the first.
     */
    openFromTool: "Print labels",
    /**
     * From one tool item's own page (#352).
     *
     * IT SAYS `PRINT` RATHER THAN `REPRINT`, AND THE SCREEN DOES NOT KNOW WHICH IT
     * IS. Nothing in this base records whether a sticker was ever printed or stuck
     * on, so a control promising a re-print states something the app cannot check —
     * and the two readers this screen has both want the same act: somebody whose
     * label has worn through, and somebody printing one for the first time. `the
     * label` is definite because a tool item has exactly one.
     *
     * It is a link to this screen rather than a print control of its own, so it gets
     * the start position a part-used sheet needs — which is the common case whether
     * or not the label existed before.
     */
    openFromToolItem: "Print the label",

    /**
     * Nothing was named in the address.
     *
     * It named a registration as well until #449, which stopped a registration opening
     * this screen: one lands on its tool's own page, and that is where a run is
     * selected. `Nothing` rather than `No tool` since #455: the sentence goes on to
     * name a tool's own page, so a first `tool` meaning one of its tools would make
     * one word stand for two things in it.
     */
    noneRequested: "Nothing was named to print. Open this from a tool's own page.",
    /** Every id named in the address is a tool item this base does not hold. */
    noneFound: "None of those tools exists.",

    selectionHeading: "Which labels to print",
    /** Beside each candidate, so a run can leave one out without a new address. */
    include: "Include",
    // `selectAll` AND `selectNone` WERE HERE AND WENT. Every label the address
    // named starts included, so select-all named the state the screen already
    // opens in; select-none reached only the state the screen refuses to print
    // from, which the sentence below already names. The per-label include is the
    // one control of the three that reaches a state a reader wants.
    //
    // A tool's own page says it too (#443), where the print control refuses the same
    // empty selection — so the two screens a run passes through refuse it in one voice.
    nothingSelected: "Nothing is selected, so there is nothing to print.",

    startLabel: "Start at label position",
    startHint: `1 to ${CELLS_PER_SHEET}, counting across the sheet. Use it to print onto a sheet whose first labels have already been peeled off.`,

    print: "Print",

    /** Stated so nobody prints a sheet of stickers pointing at a host that dies. */
    hostLabel: "Each symbol will encode",
    hostWarningTitle: "This is not the address a label should carry",
    hostWarning:
        "A symbol encodes the host it was printed from, so a label printed here points at this host for as long as the sticker lasts. Print onto adhesive stock only from the address the app will keep.",

    /** A builder rather than a label plus a colon, because a bare `:` in JSX is
     *  markup text and `offline/tool-list-view.mjs` fails the axis on one. */
    stock: ({ name }) => `Stock: ${name}`,
    /**
     * A run that does not fit one sheet says so before it is sent.
     *
     * IT NAMES NO STOCK SINCE #412. It read `…sheets of Avery 5160.`, which worked
     * while the stock had a product name; the stock is named by its geometry now,
     * and a geometry at the end of this sentence reads as a measurement of the
     * sheet rather than of the label. The line above states it once, which is
     * where a reader looks for it.
     */
    sheetCount: ({ sheets, labels }) =>
        `${labels} label${labels === 1 ? "" : "s"} across ${sheets} sheet${sheets === 1 ? "" : "s"}.`,
    /** More ids were named than one request prints. */
    overCap: ({ requested, cap }) =>
        `${requested} tools were named and this prints ${cap} at a time, so the first ${cap} are below.`,
    /** Named in the address, absent from the base — never silently dropped. */
    missing: ({ toolItemIds }) =>
        `Not on this base, so no label is offered for ${toolItemIds.join(", ")}.`,
    /**
     * A symbol grown past what this stock's module size was derived to absorb.
     *
     * A label crops what overflows it and a cropped symbol is unscannable with
     * nothing to see, so this is said rather than drawn.
     *
     * IT NAMES THE HOST AND PRESCRIBES NOTHING SINCE #453. It read `The address is
     * now long enough that these symbols no longer fit this stock … Larger stock is
     * what fixes it.` while only a longer permanent host could reach it. With no
     * version of headroom, every host past seventeen characters does — a Vercel
     * domain among them — and there nothing ever fitted, and the fix is printing from
     * the host a label should carry, which the warning above the sheet already says.
     * The sentence cannot tell a wrong host from a longer right one, so it states the
     * cause both share.
     */
    symbolTooLarge: ({ toolItemIds }) =>
        `The address from this host is long enough that these symbols do not fit this stock, so their labels are not drawn: ${toolItemIds.join(", ")}.`,
};

// The page a tool label prints as (#353, #467): the tape it is cut from, the
// arithmetic that turns modules and points into millimeters, the face the printed
// code is measured in, how much larger the dialog draws it, and every word the dialog
// says.
//
// ONE LABEL IS ONE PAGE, AND THE PAGE'S SIZE IS THE LABEL'S (#467). The labels go to
// a label printer that takes 12 mm tape and cuts after every page, reached through
// the browser's own print dialog. Until #467 this file laid a Letter sheet of
// die-cut labels out, with a start position for a sheet already part used; the sheet
// went, and its grid, its start position and the blanks the position held open went
// with it. docs/notes/tools.md carries the sheet's history.
//
// THE PAGES ARE DRAWN IN A DIALOG SINCE #457, over the page that opens it — a tool's
// own page for what its list has selected, a tool item's for its one label — where
// they were the screen `/tool-items/labels` until then. What a page is did not move:
// the dialog draws each at twice its size and prints it at its own.
//
// WHAT IS AN INPUT, AND EVERYTHING ELSE IS DERIVED. The tape's width is the label's
// height, because the page runs across the tape; the label's width is how much tape
// one label takes, 11 mm, a round figure chosen for the cut; the module and the
// code's size are the two floors a print proved; the extent of the code's ink is the
// face's. The rest is arithmetic on those. The symbol, 33 modules at 0.29 mm, is
// 9.57 mm; the code's height is its ink, 0.642 em of 5 pt, 1.1324 mm; what the tape
// leaves above and below the two is split evenly, 0.6488 mm; and what the width
// leaves beside the symbol, 0.715 mm each side. `LABEL_STOCK` holds the stock's two
// inputs and nothing derived from them, so no figure in it can come apart from the
// one it would have been derived from.
//
// WHAT WAS PRINTED AND READ IS 10.87 x 12 mm, AND THIS DRAWS 11 x 12. The print that
// proved the floors had 0.65 mm on all four sides, which is the width four equal
// margins give — the tape less the code's height, `labelSizeMm` below. 11 mm moves
// the side margins alone, from 0.65 to 0.715 mm, which was judged to need no second
// print: the symbol, the code and the margins above and below are the print's.
//
// A VERSION STEP HAS ONLY THE MARGINS TO TAKE FROM. The tape fixes the height and the
// cut fixes the width, so a symbol one version larger — 37 modules, 10.73 mm, which a
// host longer than seventeen characters builds — would leave 0.135 mm either side of
// it at 11 mm, where there is 0.715, and 0.069 mm above and below, where there is
// 0.649. Nothing has printed those, so the label absorbs no version step and such a
// symbol is named rather than drawn (`VERSION_HEADROOM`, `symbolBox`).
//
// AND A CODE LONGER THAN TEN CHARACTERS HAS ONLY THE SIDE MARGINS. **Not observed.**
// Ten characters at 5 pt are 8.82 mm under a 9.57 mm symbol. The thousandth tool item
// of a day prints eleven (`260909-1000`, 9.70 mm), which overhangs the symbol by
// 0.07 mm each side and leaves 0.65 mm to either edge — the side margin the print
// had; twelve leave 0.21 mm, and thirteen are wider than the label. `labels.css` lets
// the code overhang its box rather than clipping it, and no day on this base has
// reached a thousand.
//
// SIZED BY THE MODULE AND NEVER BY THE SYMBOL, which is the contract #351 handed
// over. A QR symbol's side grows four modules per version, so a box of fixed
// millimeters renders a larger version's modules thinner while a fixed millimeters
// PER MODULE renders a larger symbol. Only the second stays scannable, so every box
// is its own symbol's side count times `MIN_MODULE_MM`.
//
// BOTH FLOORS ARE MEASUREMENTS SINCE #467, where they were citations. What was
// printed and what read it is at each constant, and docs/notes/tools.md carries the
// record.
//
// PURE, AND ITS ONE IMPORT IS THE POINT RATHER THAN AN EXCEPTION. The dialog is a
// `"use client"` file and imports this for the geometry and the copy — which means
// nothing here may reach `lib/toolLabelQR.js`, since that module imports `qrcode` and
// would land the whole encoder in the browser bundle. **The symbol's side count
// arrives as an ARGUMENT for exactly that reason**, and the face is loaded by the
// dialog rather than here for a neighboring one: `next/font` exists only inside Next's
// compiler, so this file names the face and the dialog loads it. What it does import is
// `lib/toolRegistration.js`, which is as pure as this file and is where the cap comes
// from; the extension is spelled out so the offline tier can load both under plain
// `node` (lib/materialPriceView.js's precedent, #19).

import { MAX_TOOL_ITEMS_PER_REGISTRATION } from "./toolRegistration.js";

/**
 * The tool items one print may hold, capped at the largest registration.
 *
 * THE TWO NUMBERS ARE ONE NUMBER ON PURPOSE. The whole reason the labels exist as one
 * run is that a registration's whole run reaches them in one press — since #449 it
 * lands on its tool's page with every id it minted selected, and that page's print
 * control opens the dialog on them; until then its own answer linked straight to the
 * labels' screen — so a cap below `MAX_TOOL_ITEMS_PER_REGISTRATION` would silently
 * drop the tail of the largest registration anybody can make. It is imported rather
 * than restated, so the two cannot drift.
 *
 * AND IT BOUNDS WHAT A TOOL'S OWN PAGE MAY OPEN THE DIALOG ON (#442, #443, #457). That
 * page's print control opens it on what the list has selected, and
 * `lib/toolListView.js` imports this so the control refuses a selection larger than
 * one print rather than opening on one; `readToolItemLabelsAction` refuses a longer
 * one as well, for a caller with no page. Its page box selects a page at a time, so a
 * page may not hold more than this either — `TOOL_PAGE_SIZE` is 25 against 100, and
 * `offline/tool-list-view.mjs` holds the order of the two. Until #443 that page sent
 * the page it was showing and nothing imported this there. The tool item's own page
 * opens the dialog on one, which nothing here needs to hold.
 */
export const MAX_LABELS_PER_REQUEST = MAX_TOOL_ITEMS_PER_REGISTRATION;

/**
 * The stock a label is printed on: its two inputs, and nothing derived (#467).
 *
 * THE TAPE IS THE LABEL PRINTER'S, AND ITS WIDTH IS THE LABEL'S HEIGHT. The page runs
 * across the tape, so the symbol and the code under it stack from one edge of the
 * tape to the other, and the margins above and below are what the tape leaves them.
 *
 * THE WIDTH IS HOW MUCH TAPE ONE LABEL TAKES before the printer cuts, and it is a
 * choice rather than a result: 11 mm, a round length for the cut. Four equal margins
 * would make it 10.87 mm (`labelSizeMm`), which is the label a print proved; the
 * extra 0.13 mm goes to the two side margins and nothing else.
 *
 * NO DERIVED FIGURE BELONGS HERE. A figure the arithmetic produces, typed in beside
 * the inputs it comes from, is a second place for one number, and the two can
 * disagree with nothing to say so — so the symbol's box and the margins are
 * `labelBudget`'s, and `offline/tool-label-page.mjs` fails a third member here.
 *
 * `@page size` cannot read a custom property, so `labels.css` spells these two as
 * its page size and the same check compares them.
 */
export const LABEL_STOCK = {
    tapeWidthMm: 12,
    labelWidthMm: 11,
};

// `LABEL_STOCK_NAME` WAS HERE (#353) AND WENT WITH THE STOCK LINE IT NAMED (#457). It
// said `12 mm tape`, the one thing a person loading the printer had to get right while
// the screen said `Stock: …` above the labels; the dialog says the label's size
// instead, `11 × 12 mm` — `TOOL_LABEL_PAGE_COPY.size`, built from the same two
// figures — beside the count, which is how the design gives a print's size in text.

/**
 * How much larger the dialog draws a label than it prints (#457).
 *
 * THE DESIGN'S: 1e draws each page 22 × 24 mm, its symbol 19.14 mm and its code at
 * 10 pt, and 0p says a label on screen is drawn at whatever size reads in its place,
 * with the print size given in text. A label at its own size is 42 px across, which
 * was the screen until #457.
 *
 * ON THE SCREEN ONLY, AND THE PAGE IS NOT DRAWN TWICE. The dialog sets this as a
 * custom property and `labels.css` zooms the label's page by it on screen and by 1 at
 * print, so the page a reader looks at is the page that prints, at its own size —
 * no figure inside the page changes, and nothing here is a second drawing of it.
 */
export const LABEL_PREVIEW_SCALE = 2;

/**
 * Between the symbol and the code under it.
 *
 * ZERO SINCE #453, AND THE FIGURE IS THE DESIGN'S. The margin the specification asks
 * for is the quiet zone, and the SVG already paints it white on every side of the
 * symbol, so the code can start where the symbol's box ends. Since #467 its ink
 * starts exactly there — the code is set by its baseline (`ID_INK_ABOVE_EM`) — so
 * the nearest ink is the four modules of quiet zone away from the nearest dark
 * module, 1.16 mm, which is what the specification requires. Nor is a gap a
 * tolerance: the symbol and the code are one raster printed in one pass, so nothing
 * registers one against the other. The 1.5 mm this held from #353 was a layout choice
 * with no source, and the design draws none. Adding one back is the design's to do,
 * and on tape it takes its height out of the margins above and below.
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
 * ON TAPE A STEP IS PAID FOR IN MARGINS, AND THAT IS WHAT KEEPS THIS AT ZERO (#467).
 * The tape fixes the label's height and the cut its width, so four more modules a
 * side cannot make the label bigger the way they could on a sheet: at 11 mm they
 * leave 0.135 mm either side of the symbol and 0.069 mm above and below it, against
 * 0.715 and 0.649 today, and no print has had margins that thin. A tape wide enough to
 * keep today's margins round a version-3 symbol, or a print proving thinner ones, is
 * what putting this back to 1 would need.
 *
 * AND THE HOST NEEDS NONE OF IT. `app.hyeusa.com` is fourteen characters, so the
 * printed address is 35 and version 2 holds 38: three characters are left, which a
 * six-digit daily sequence fills. A host longer than seventeen characters would step
 * the version, and moving the host is a reprint of every label already glued to a
 * tool in any case (docs/notes/tools.md).
 *
 * THE FLOORS WERE MEASURED AT THIS ADDRESS'S GEOMETRY, a version-2 symbol of 33
 * modules a side. A local server's address — `HTTP://LOCALHOST:3100/T/260909-004`, 34
 * characters — is version 2 as well, so a label printed from one is today's label
 * exactly and a phone decoding it is a reading of both floors, though it cannot open
 * the address it decodes.
 */
export const VERSION_HEADROOM = 0;

/** Modules a version step adds to a side, from the specification. */
const MODULES_PER_VERSION = 4;

/**
 * The floor a printed module may not go under, and the module the label prints at.
 * A measurement since #467.
 *
 * 0.29 mm IS THE MODULE OF A LABEL THE LABEL PRINTER PRINTED AND A PHONE DECODED:
 * 10.87 x 12 mm with 0.65 mm on all four sides, a 33-module symbol of 9.57 mm, and the
 * code under it at `MIN_ID_FONT_PT`. No smaller module is recorded from that printer.
 * On the office printer a 0.273 mm module decoded as well, which says the phone is not
 * what stops at 0.29 mm on paper printed that finely — and is not this printer's
 * floor, which is why it is recorded rather than used.
 *
 * IT IS ALSO WHAT THE LABEL PRINTS AT, as it has been since #412, but no longer
 * because width is short. On tape the module moves nothing but the margins: a larger
 * one would take from margins no print has had, and a smaller one would print a
 * symbol not recorded from this printer. The print fixed one geometry, and this is
 * its module.
 *
 * **0.4 mm UNTIL #467**, the figure widely published as the practical minimum for a
 * phone camera resolving a printed QR module, held as a citation because nothing in
 * this repository could print one.
 */
export const MIN_MODULE_MM = 0.29;

/**
 * The smallest the readable code may be set, in points. A measurement since #467.
 *
 * 5 pt IS THE SIZE THE CODE PRINTED AT ON THAT LABEL, and it read — on the label
 * printer, under the symbol `MIN_MODULE_MM` describes. On the office printer a code of
 * 5.1 pt read as well. It is a FONT SIZE — the em, which is what this constant sets.
 *
 * **6 pt UNTIL #467**, the size print convention holds as the smallest legible in
 * printed matter; 2.0 mm until #431, which is 5.67 pt, and 2.5 mm until #412, set for
 * a label read at arm's length where this one is read in the hand.
 */
export const MIN_ID_FONT_PT = 5;

/** Millimeters in a point: 25.4 to the inch, over 72 points to the inch. */
const MM_PER_PT = 25.4 / 72;

/** The code's size in millimeters, 1.7639 mm — the em its ink is measured in. */
const ID_FONT_MM = MIN_ID_FONT_PT * MM_PER_PT;

/**
 * How far the code's ink reaches above its baseline, in ems of its size (#467).
 *
 * READ OUT OF THE FACE'S OWN OUTLINES. In the file `next/font` serves for
 * `LABEL_CODE_TYPEFACE`, the ten digits and the hyphen run from −11 to 631 of the
 * face's 1000 units — `8` is the tallest, and `0`, `3` and `5` reach lowest — so the
 * ink is 0.631 em above the baseline and 0.011 em below it. **#431 cited 0.641 and
 * 0.016**, and those were a canvas's raster bounds of the same glyphs rather than
 * their outlines: the canvas reports 0.640625 and 0.015625, measured again.
 *
 * THE CODE IS SET BY ITS BASELINE AT THIS DEPTH, which is what makes its ink its whole
 * height. A CSS line puts the baseline wherever the face's ascent and descent place it,
 * after the browser rounds them — measured, a 5 pt line 0.642 em tall has its baseline
 * at 0.600 em, which lifts the ink 0.055 mm into the symbol's box — so the component
 * draws the code as SVG text whose baseline `labelBudget` places this far below the
 * symbol's box.
 */
export const ID_INK_ABOVE_EM = 0.631;

/** How far it reaches below its baseline — see `ID_INK_ABOVE_EM`. */
const ID_INK_BELOW_EM = 0.011;

/**
 * The code's height, which is its ink and nothing above or below it (#467).
 *
 * 0.642 em of 5 pt, 1.1324 mm. It was one em until #467 — the code's line box set to
 * its size — and the label then counted room above and below the ink that nothing was
 * printed in. On tape that room is margin, so the height counts the ink alone.
 */
export const ID_HEIGHT_MM = (ID_INK_ABOVE_EM + ID_INK_BELOW_EM) * ID_FONT_MM;

/**
 * Characters in the code a label prints, which is what its width is budgeted for.
 *
 * TEN SINCE #411, WHERE IT WAS THE `Tool Item ID`'s SEVENTEEN. The label prints the
 * id less its `HYE-TL-` token — `lib/toolRoutes.js:labelCodeFor` — because those
 * seven characters are on every tool item and separate none of them.
 *
 * **IT DECIDES NO DIMENSION SINCE #431.** Under the symbol the code shares the
 * symbol's width, and since #467 ten characters at 5 pt take 8.82 mm of the 9.57 mm
 * there. Eleven, which a day's thousandth tool item prints, are wider than the symbol
 * and take their overhang from the side margins — see the header.
 */
const ID_CHARACTERS = 10;

/**
 * Width of one character as a fraction of the font size. A measurement, not an
 * estimate.
 *
 * 0.5 is the advance of `LABEL_CODE_TYPEFACE`: 500 of the face's 1000 units to the
 * em, the same for every digit and for the hyphen, read out of the font file the
 * app serves. A monospace face has one advance, so there is nothing to average and no
 * margin to leave.
 *
 * **IT REOPENS WHEN THE FACE DOES.** The figure belongs to one face at its default
 * width, at 400 and with no letter-spacing — the two the print read (#467), which
 * `labels.css` sets on the code rather than leaving them to inheritance — so another
 * face, a width axis, a weight or any letter-spacing is another figure, and
 * `offline/tool-label-page.mjs` holds the face the dialog loads to the one named here
 * and pins both by value.
 *
 * **0.6 UNTIL #431, AN OVER-ESTIMATE HELD WHILE NO FACE WAS PICKED.** The
 * measurement it cited, #412's 0.534, was Arial: nothing on the tools screens set a
 * face, so the code inherited `globals.css`'s body font, and a figure read in that
 * state was standing in for a settled one.
 */
const CHARACTER_WIDTH_RATIO = 0.5;

/**
 * The face the printed code is set in, and the one `CHARACTER_WIDTH_RATIO` and the
 * extent of its ink were measured against.
 *
 * THE DESIGN'S CHOICE, HERE BECAUSE THE LABEL'S ARITHMETIC DEPENDS ON IT (#431). It
 * is spelled twice: `next/font` takes the face as a static import in the file that
 * loads it, so `app/(tools)/tool-items/LabelsDialog.js` carries the loader — the
 * labels' page did until #457 — and `offline/tool-label-page.mjs` compares the two.
 */
export const LABEL_CODE_TYPEFACE = "Inconsolata";

/**
 * The label four equal margins give, which is the one a print proved (#467).
 *
 * THE TAPE FIXES THE HEIGHT AND THE FLOORS FIX THE SYMBOL AND THE CODE, so what the
 * tape's width leaves is split evenly above and below them, and giving the sides the
 * same makes the label the tape less the code's height — 10.8676 mm, and 10.87 rounded
 * up to a hundredth, as a label a fraction smaller than its parts is the failure. That
 * width does not move with the symbol: a larger one takes from the margins exactly
 * what it adds to itself.
 *
 * THIS IS NOT THE LABEL `LABEL_STOCK` DESCRIBES, AND THE DIFFERENCE IS THE POINT.
 * `labelWidthMm` is 11, a round length for the cut; this is the label the print had,
 * and `offline/tool-label-page.mjs` holds the stock's width at or over it, so no side
 * margin is ever under the print's.
 */
export function labelSizeMm({ sideModules, versionsOfHeadroom = VERSION_HEADROOM }) {
    const widestSymbolMm = round2((sideModules + versionsOfHeadroom * MODULES_PER_VERSION) * MIN_MODULE_MM);
    const marginMm = (LABEL_STOCK.tapeWidthMm - widestSymbolMm - LABEL_GAP_MM - ID_HEIGHT_MM) / 2;
    return {
        widestSymbolMm,
        marginMm,
        widthMm: ceilHundredth(widestSymbolMm + marginMm * 2),
        heightMm: LABEL_STOCK.tapeWidthMm,
    };
}

/**
 * What one label's parts come to on the stock, so a check can add them up and the
 * page can draw them.
 *
 * THE MARGINS ARE WHAT IS LEFT, AND THEY ARE LEFT FOR THE WIDEST SYMBOL THE LABEL IS
 * SIZED FOR. Across, the stock's width less that symbol, halved; down, the tape less
 * the symbol, the gap and the code's height, halved. Nothing is rounded but the
 * symbol's box, to a hundredth, which strips only the float noise of a side count
 * times a module: a margin is whatever the inputs leave, and rounding one would draw
 * a label a fraction off the arithmetic that sized it.
 */
export function labelBudget({ sideModules, versionsOfHeadroom = VERSION_HEADROOM }) {
    // `moduleMm` rather than `module`, which Next reserves — eslint's
    // `no-assign-module-variable` catches it and this repo keeps that job clean.
    const moduleMm = MIN_MODULE_MM;
    const widestSymbolMm = round2((sideModules + versionsOfHeadroom * MODULES_PER_VERSION) * moduleMm);
    const marginYMm = (LABEL_STOCK.tapeWidthMm - widestSymbolMm - LABEL_GAP_MM - ID_HEIGHT_MM) / 2;
    return {
        moduleMm,
        /** The box today's symbol occupies, quiet zone included. */
        symbolMm: round2(sideModules * moduleMm),
        /** The box the largest symbol the label is sized for occupies. */
        widestSymbolMm,
        /** Either side of the symbol: what the cut leaves. */
        marginXMm: (LABEL_STOCK.labelWidthMm - widestSymbolMm) / 2,
        /** Above the symbol and below the code: what the tape leaves. */
        marginYMm,
        /**
         * The code's baseline, down from the label's top edge: the margin, the symbol,
         * the gap, and the code's ink above its baseline. The component sets the code
         * here, so its ink starts where the symbol's box ends.
         */
        idBaselineMm: marginYMm + widestSymbolMm + LABEL_GAP_MM + ID_INK_ABOVE_EM * ID_FONT_MM,
        /** What the code needs at its floor: its ink, top to bottom. */
        minIdHeightMm: ID_HEIGHT_MM,
        /** And across, which the symbol's width over it has to clear. */
        minIdWidthMm: ID_CHARACTERS * CHARACTER_WIDTH_RATIO * ID_FONT_MM,
    };
}

/**
 * The box ONE symbol occupies, from ITS OWN side count rather than from the
 * constant the label was sized for.
 *
 * THIS IS THE WHOLE CONTRACT AND THE FIRST IMPLEMENTATION GOT IT WRONG, measured
 * in a browser rather than reasoned about. Every label's box was sized from
 * `QR_SIDE_MODULES` — today's version — so a symbol that came back a version
 * larger was scaled INTO that box: the SVG carries a `viewBox` and no width, so 37
 * modules rendered in an 18.81 mm square put each module at 0.508 mm instead of
 * 0.57. That is a version step making the modules thinner, which is the exact
 * failure sizing by the module exists to prevent, and it was invisible on screen.
 *
 * So the box is per label: `buildToolItemQR` reports the side count it actually
 * produced and this multiplies it by the label's millimeters per module, so a longer
 * address prints a LARGER symbol at the same module width.
 *
 * `fits` IS WHETHER THAT SYMBOL IS NO LARGER THAN THE ONE THE LABEL IS SIZED FOR,
 * which is the budget's. The margins are what that symbol leaves, so a larger one
 * would print into margins no print has had rather than overflow anything a layout
 * could see — and a label crops what does overflow it, and a cropped symbol is
 * unscannable with nothing to show. The dialog says so instead — `describeLabelRun`
 * below. It compared the symbol against a die-cut's two rooms until #467, when the
 * margins became what is left rather than a tolerance given.
 */
export function symbolBox({ sideModules, budget }) {
    const boxMm = round2(sideModules * budget.moduleMm);
    return { boxMm, fits: boxMm <= budget.widestSymbolMm };
}

/**
 * What the dialog shows for one run (#457): the pages it draws and prints, how many of
 * the run those are, and the two reasons a label in it does not print.
 *
 * A RUN IS WHAT THE OPENER HANDED OVER, read for it on the server: `labels`, each a
 * tool item's printed code and its symbol with the side count that symbol came out at;
 * `missing`, the codes named that no tool item carries; and `sideModules`, today's
 * symbol's, which sizes the label (`labelBudget`). It arrives as data because the
 * symbol is drawn by `lib/toolLabelQR.js`, which no `"use client"` file may import.
 *
 * A LABEL PRINTS WHEN ITS SYMBOL FITS, and one that does not is in the run and on no
 * page. Its symbol is too large because the host it encodes is long, and every symbol
 * built from one host comes out one size, so in practice either all of a run fits or
 * none of it does. The design draws no state for it (1e) and the dialog says it in the
 * place it names the codes not found, in one sentence about the host — so `tooLarge`
 * is how many, which only the sentence's number reads.
 *
 * `named` IS EVERY CODE THE RUN NAMED, the ones that print and the ones that do not, so
 * the count reads `3 of 5 labels` whenever some do not and `5 labels` when all do.
 */
export function describeLabelRun({ sideModules, labels, missing }) {
    const budget = labelBudget({ sideModules });
    const pages = labels.filter((label) => symbolBox({ sideModules: label.sideModules, budget }).fits);
    return {
        budget,
        pages,
        printing: pages.length,
        named: labels.length + missing.length,
        missing,
        tooLarge: labels.length - pages.length,
    };
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

/**
 * The smallest hundredth not under `value`, for a label's dimension.
 *
 * The four-decimal step first is what keeps float noise from rounding an exact
 * figure up: `0.1 + 0.2` arrives as 0.30000000000000004, which a bare ceiling
 * would make 0.31.
 */
function ceilHundredth(value) {
    return Math.ceil(Math.round(value * 10000) / 100) / 100;
}

/**
 * Every word the dialog says (#457), and the two controls that open it.
 *
 * None is in JSX: a string written into a component is invisible to the vocabulary
 * checks and to `scripts/screen-strings.mjs`, so it cannot be swept when a word
 * changes. The screen words are the design's since #455 — a `Tool Items` row is a
 * `tool` in a sentence — and this said `tool` and `tool item`, never a bare `item`,
 * until then; docs/notes/naming.md holds the row. The dialog's are 1e's since #457.
 *
 * WHAT WENT WITH THE SCREEN (#457), and why each did rather than moving into the
 * dialog. `heading`, `Print tool labels`, was the route's: the dialog is titled by the
 * control that opens it. `noneRequested` answered an address naming nothing, and there
 * is no address. `include` and `selectionHeading` were the per-label include, which
 * trimmed a run arriving on another screen — the dialog stands over the list that makes
 * the run, so a label is left out there. `stock` and `labelCount` were `Stock: 12 mm
 * tape` and `4 labels, one to a page.`, which `count` and `size` say as 1e does.
 * `overCap` named a state a tool's page refuses first. `missing` and `noneFound` are
 * `notFound` and `noLabels`. `nothingSelected` is a tool's page's own now
 * (`TOOL_LIST_COPY`): the dialog never opens on nothing, so that page is the one screen
 * that refuses an empty selection.
 */
export const TOOL_LABEL_PAGE_COPY = {
    // `openFromRegistration` WAS HERE (#353) AND WENT WITH THE ANSWER IT STOOD ON
    // (#449). A registration lands on its tool's page with what it wrote selected, so
    // the control below is the one that prints those labels, and the words for opening
    // the labels are the two that remain.
    /**
     * From a tool's own page, where it opens the dialog on what the list has selected
     * (#443, #457) — and the dialog's title when that page opens it.
     *
     * IT NAMES NO RANGE, AND THAT IS #443's WHOLE POINT. It read `…for the tool items
     * on this page` while the control sent the page it was on, because nothing on the
     * screen showed that range and the words had to. The range is the boxes and the
     * count beside this control now, so words restating it would be a second account
     * of one fact that a design could let drift from the first.
     */
    openFromTool: "Print labels",
    /**
     * From one tool item's own page (#352), and the dialog's title when that page opens
     * it. `Print label` since #457, the design's, where it said `Print the label`.
     *
     * IT SAYS `PRINT` RATHER THAN `REPRINT`, AND THE PAGE DOES NOT KNOW WHICH IT IS.
     * Nothing in this base records whether a sticker was ever printed or stuck on, so a
     * control promising a re-print states something the app cannot check — and the two
     * readers it has both want the same act: somebody whose label has worn through, and
     * somebody printing one for the first time. It stands for every status, `Retired`
     * included, for the reason a retired tool item keeps its symbol (#352).
     *
     * IT OPENS THE DIALOG RATHER THAN PRINTING, because the dialog owns the label's page
     * and the print rule, so a label is drawn in one place whichever page asks.
     */
    openFromToolItem: "Print label",
    /**
     * What either opener says while a tool's page reads the labels it will open on (0f
     * Working, #495) — to assistive tech alone, since the opener shows its spinner in its
     * label's place. The press reads and opens rather than printing, so its word is the work
     * being done, the way `Continue` gives way to `Sending…`.
     */
    working: "Loading…",

    /** The pages' list, named for a reader that meets it as a list (1e). */
    pages: "Pages",
    /** One page in it, by its place in the run and the code it prints. */
    page: ({ page, code }) => `Page ${page}, ${code}`,
    /**
     * Where the pages would be, when none prints (1e): every code the run named is on no
     * tool item, or every symbol is too large for the label.
     */
    noLabels: "No labels to print.",

    /**
     * How many labels a press prints, of how many the run named (1e).
     *
     * `of` APPEARS ONLY WHEN THE TWO DIFFER, so `5 labels` is a run that prints whole and
     * `3 of 5 labels` one that does not. The count is what the print dialog's page count
     * has to agree with — a label to a page since #467 — so it names no pages beside it.
     * The noun follows the larger figure: `1 of 2 labels`, `0 of 1 label`.
     */
    count: ({ printing, named }) => {
        const unit = named === 1 ? "label" : "labels";
        return printing === named ? `${named} ${unit}` : `${printing} of ${named} ${unit}`;
    },
    // `between`, THE DOT BETWEEN THE COUNT AND THE SIZE, WAS HERE (#457) AND WENT TO `Dot.js`
    // (#495), whose room either side is a space the text holds: drawn with padding, the two
    // clauses copied and were read as `1 label11 × 12 mm`. The mark is not a word, so no
    // copy constant holds it.
    /**
     * The size a label prints at, beside the count — the print size in text, which is
     * how 0p says the screen gives it while it draws a label larger. Built from
     * `LABEL_STOCK`, the cut across and the tape down, so it cannot drift from the
     * page the stylesheet prints.
     */
    size: `${LABEL_STOCK.labelWidthMm} × ${LABEL_STOCK.tapeWidthMm} mm`,

    /**
     * The codes the run named that no tool item carries, said above them (1e) — never
     * silently dropped, since a short run printed in silence leaves somebody counting
     * stickers. Only an address somebody typed carries one: a tool's page reads its
     * selection off its own address and does not ask the base about it (#443).
     */
    notFound: (count) => `${count} code${count === 1 ? "" : "s"} not found`,
    /**
     * A symbol larger than the one the label is sized for, said in the place the codes
     * not found are named.
     *
     * A label crops what overflows it and a cropped symbol is unscannable with nothing
     * to see, so this is said rather than drawn. On tape since #467 the larger symbol
     * would overflow nothing but the margins no print has had, and it is refused for
     * the same reason. 1e draws no state for it, and the dialog borrows the shape of a
     * run with nothing on record: no page, the count, and this sentence (#457).
     *
     * IT NAMES THE HOST AND PRESCRIBES NOTHING SINCE #453. It read `The address is
     * now long enough that these symbols no longer fit this stock … Larger stock is
     * what fixes it.` while only a longer permanent host could reach it. With no
     * version of headroom, every host past seventeen characters does — a Vercel
     * domain among them — and there nothing ever fitted, and the fix is printing from
     * the host a label should carry. The sentence cannot tell a wrong host from a
     * longer right one, so it states the cause both share. **It said `this stock` and
     * named the tool items until #457**: the dialog names no stock, and the count above
     * it already says how many do not print; `the label stock` is the tool item page's
     * own line under its symbol, which says this of one.
     *
     * AND IT STANDS WITHOUT THE HOST LINE AND THE WARNING THAT WENT IN #454. It
     * leaned on the one for what `this host` meant and on the other for the fix. The
     * host it means is the one the page is served from, which the tool item page's
     * own line under its symbol has named the same way since #453 with no host line
     * above it; and prescribing nothing rests on the reason above alone. What answers
     * a wrong host is docs/notes/tools.md's rule and what answers a longer right one
     * is `VERSION_HEADROOM`, and neither is an act the dialog offers.
     */
    symbolTooLarge: (count) =>
        count === 1
            ? "The address from this host is long enough that this symbol does not fit the label stock, so its label does not print."
            : "The address from this host is long enough that these symbols do not fit the label stock, so their labels do not print.",

    // `startLabel` AND `startHint` WERE HERE (#353) AND WENT WITH THE SHEET (#467).
    // They named the first label position a part-used sheet still had and the range a
    // sheet held; a label printer cuts after every page, so no label is ever printed
    // onto a run somebody has already peeled from.

    // `hostLabel`, `hostWarningTitle` AND `hostWarning` WERE HERE (#353) AND WENT
    // TOGETHER (#454). The screen named the host each symbol would encode and, under
    // it, warned that this was not the address a label should carry. The warning
    // showed on every host, since nothing in the app knows which one is permanent, so
    // on the host the app keeps it would be false above every sheet — and before then
    // the reader it would stop is the one who already knows. The host line alone was
    // the same guard speaking to the same reader. The page still reads the host,
    // because the symbol encodes it, and docs/notes/tools.md holds the rule the two
    // stood for.

    /**
     * What to do in the browser's print dialog, while something prints (1e).
     *
     * THE SECOND STEP IS THE ONE NO CSS CAN TAKE. `@page` makes the browser's default
     * scale the right one — the page box is the label — but a person can still set
     * another, and every dimension on the tape would be multiplied by it; `labels.css`
     * says so in its header, and this is where the reader meets it.
     */
    hintHeading: "In the print dialog",
    hintSteps: ["Choose your label printer.", "Keep scale at 100%."],

    cancel: "Cancel",
    /**
     * The commitment, carrying how many it prints (0l: a commitment that acts on a
     * count the dialog knows carries it). With none to print it is drawn disabled and
     * says the dialog's title instead, as 1e draws `Print labels`.
     */
    print: ({ labels }) => `Print ${labels} label${labels === 1 ? "" : "s"}`,
};

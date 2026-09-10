// The sheet a tool label is printed on (#353): the stock's dimensions, the
// arithmetic that turns modules into millimeters, and every word the screen says.
//
// THE STOCK IS NOT CHOSEN YET, AND THAT IS WHY THIS FILE EXISTS. Nobody has
// confirmed which printer the site has, so no adhesive stock has been bought. The
// layout is therefore built against an office-printer sheet with the dimensions in
// ONE place: when the real stock arrives, `LABEL_STOCK` changes and nothing under
// `app/(tools)/tool-items/labels/` is reopened. Every figure any caller needs is
// derived from that object rather than written down a second time.
//
// SIZED BY THE MODULE AND NEVER BY THE SYMBOL, which is the contract #351 handed
// over. A QR symbol's side grows four modules per version, so a box of fixed
// millimeters renders a larger version's modules thinner while a fixed millimeters
// PER MODULE renders a larger symbol. Only the second stays scannable. So
// `moduleSizeMm` is the value this file computes and the symbol's printed size is
// whatever that times its own side count comes to.
//
// AND IT IS SIZED FOR TWO VERSIONS ABOVE TODAY'S, WHICH IS NOT CAUTION BUT
// ARITHMETIC. #351 measured the printed address at exactly version 2's capacity —
// 38 alphanumeric characters of 38 — so a four-digit daily sequence or a host one
// character longer is already version 3, and the production host is not settled.
// `VERSION_HEADROOM` is the answer: the module is small enough that the largest
// symbol still fits the label, which makes a version step a bigger symbol rather
// than a label that no longer fits its stock.
//
// THE MODULE SIZE IS BOUNDED BELOW BY A CITATION AND NOT BY A MEASUREMENT.
// `MIN_MODULE_MM` is the practical floor widely published for a phone camera
// reading a printed symbol; nothing in this repository measured it, and nothing
// could — it takes a real print and a real phone. `offline/tool-label-sheet.mjs`
// holds the derived module against it, so a stock too small to carry a scannable
// symbol fails a check rather than printing a sheet nobody can scan.
// **docs/notes/tools.md records that this number reopens the day somebody prints a
// sheet and scans it.**
//
// PURE, AND ITS ONE IMPORT IS THE POINT RATHER THAN AN EXCEPTION. The screen's
// selection is client state, so the component that draws the sheet is a
// `"use client"` file and imports this for the geometry and the copy — which means
// nothing here may reach `lib/toolLabelQR.js`, since that module imports `qrcode`
// and would land the whole encoder in the browser bundle. **The symbol's side
// count arrives as an ARGUMENT for exactly that reason.** What it does import is
// `lib/toolRegistration.js`, which is as pure as this file and is where the cap
// comes from; the extension is spelled out so the offline tier can load both under
// plain `node` (lib/materialPriceView.js's precedent, #19).

import { MAX_TOOL_ITEMS_PER_REGISTRATION } from "./toolRegistration.js";

/**
 * The tool items one request may print, capped at the largest registration.
 *
 * THE TWO NUMBERS ARE ONE NUMBER ON PURPOSE. The whole reason this screen exists
 * is that a registration hands its minted ids straight to it, so a cap below
 * `MAX_TOOL_ITEMS_PER_REGISTRATION` would silently drop the tail of the largest
 * registration anybody can make. It is imported rather than restated, so the two
 * cannot drift.
 */
export const MAX_LABELS_PER_REQUEST = MAX_TOOL_ITEMS_PER_REGISTRATION;

/**
 * The adhesive stock a sheet is printed on, and the only place its figures live.
 *
 * AVERY 5160 AS THE DEFAULT, being the sheet an office printer takes: 30 labels
 * of 1 x 2-5/8 inch on US Letter, three across and ten down. Every number below is
 * that product's published geometry converted to millimeters, and they are
 * internally consistent rather than taken on trust — `offline/tool-label-sheet.mjs`
 * adds the margins and the pitches back up and requires the page to come out.
 *
 * `page` is the CSS `@page size` keyword, and it is the one figure here that is
 * spelled twice: `@page size` cannot read a custom property, so `labels.css`
 * carries the literal and the check compares the two. Changing stock therefore
 * touches this object and that one keyword.
 */
export const LABEL_STOCK = {
    /** What the stock is, for a reader who has to buy more of it. */
    name: "Avery 5160",
    page: "letter",
    pageWidthMm: 215.9,
    pageHeightMm: 279.4,
    /** Where the first label's top-left corner sits on the page. */
    marginTopMm: 12.7,
    marginLeftMm: 4.7625,
    labelWidthMm: 66.675,
    labelHeightMm: 25.4,
    /** Corner to corner between neighbors — the label plus the gap after it. */
    columnPitchMm: 69.85,
    rowPitchMm: 25.4,
    columns: 3,
    rows: 10,
};

/** Label positions on one sheet. */
export const CELLS_PER_SHEET = LABEL_STOCK.columns * LABEL_STOCK.rows;

/**
 * How far inside a label's die-cut edge anything may be printed.
 *
 * A sheet does not feed perfectly straight and a die-cut is not perfectly placed,
 * so ink at the very edge of a label lands on the liner instead. This is the
 * allowance for both, and it is what the symbol's size is computed against rather
 * than the label's full height.
 */
export const LABEL_SAFE_INSET_MM = 1.0;

/** Between the symbol and the text beside it. */
export const LABEL_GAP_MM = 1.5;

/**
 * Versions of growth the printed size must absorb — see the header.
 *
 * Two, and each one adds four modules to a side.
 */
export const VERSION_HEADROOM = 2;

/** Modules a version step adds to a side, from the specification. */
const MODULES_PER_VERSION = 4;

/**
 * The floor a printed module may not go under. A citation, not a measurement.
 *
 * 0.4 mm is the figure published for a phone camera reading a printed symbol at
 * arm's length. It is here as a guard on the derivation rather than as a fact this
 * repository established: what would settle it is printing a sheet and scanning it,
 * which nobody has done.
 */
export const MIN_MODULE_MM = 0.4;

/** The smallest the readable id may be printed. See `labelBudget`. */
export const MIN_ID_FONT_MM = 2.5;

/** Characters in a `Tool Item ID`, which is what the id's width is budgeted for. */
const ID_CHARACTERS = 17;

/**
 * Width of one character as a fraction of the font size, for a budget only.
 *
 * CONSERVATIVE RATHER THAN EXACT, AND MEASURED TO BE SO. The id renders 23.46 mm
 * wide at the 2.5 mm floor in a browser, which is a ratio of about 0.55, so 0.6
 * over-estimates by roughly a tenth. That is the direction a budget should be
 * wrong in: the check requires the id to fit at this ratio, so a pass means it
 * really fits. It is not a claim about any particular typeface — the face is the
 * design's, and a wider one is what the margin is for.
 */
const CHARACTER_WIDTH_RATIO = 0.6;

/**
 * Millimeters per QR module, derived from the stock rather than chosen.
 *
 * THE LABEL'S HEIGHT IS WHAT BINDS IT. The symbol is square and this stock is
 * wider than it is tall, so the height less two safe insets is the whole budget,
 * and it has to hold the LARGEST symbol rather than today's. Rounded DOWN to a
 * hundredth of a millimeter, so the fit can never be lost to a rounding step.
 *
 * `sideModules` is the symbol's side INCLUDING its quiet zone — `QR_SIDE_MODULES`,
 * not `QR_SYMBOL_MODULES`. Passing the smaller one would size the box to the
 * symbol proper and crop the four modules of margin the SVG carries, which is the
 * one thing #351 asked this issue not to do.
 */
export function moduleSizeMm({ sideModules, versionsOfHeadroom = VERSION_HEADROOM }) {
    const widest = sideModules + versionsOfHeadroom * MODULES_PER_VERSION;
    const available = LABEL_STOCK.labelHeightMm - LABEL_SAFE_INSET_MM * 2;
    return Math.floor((available / widest) * 100) / 100;
}

/**
 * What one label's parts come to, so a check can add them up.
 *
 * THE POINT IS THAT THE SUM IS ASSERTABLE. A layout can be drawn wrong in ways no
 * offline check can see, but whether the pieces FIT is arithmetic — and if they do
 * not, nothing the design does can stop the symbol and the text from overlapping,
 * which would print ink into the quiet zone. So this returns the budget and
 * `offline/tool-label-sheet.mjs` requires it to balance for the widest symbol.
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
        /** What is left for the id and the tool's name once the widest symbol sits. */
        textWidthMm: round2(
            LABEL_STOCK.labelWidthMm - LABEL_SAFE_INSET_MM * 2 - widestSide * moduleMm - LABEL_GAP_MM
        ),
        /** What the id needs at its floor, which is what the width above must clear. */
        minIdWidthMm: round2(ID_CHARACTERS * CHARACTER_WIDTH_RATIO * MIN_ID_FONT_MM),
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
 */
export function symbolBox({ sideModules, moduleMm }) {
    const boxMm = round2(sideModules * moduleMm);
    const budget = LABEL_STOCK.labelWidthMm - LABEL_SAFE_INSET_MM * 2 - LABEL_GAP_MM;
    return {
        boxMm,
        fits:
            boxMm <= LABEL_STOCK.labelHeightMm - LABEL_SAFE_INSET_MM * 2 &&
            boxMm <= budget - ID_CHARACTERS * CHARACTER_WIDTH_RATIO * MIN_ID_FONT_MM,
    };
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

/**
 * Where one label position sits on its sheet, in millimeters from the page corner.
 *
 * Absolute placement rather than a grid, because the offsets are the stock's own
 * and a gap that a grid would distribute is a gap the die-cut already fixed.
 */
export function cellPosition(indexOnSheet) {
    const row = Math.floor(indexOnSheet / LABEL_STOCK.columns);
    const column = indexOnSheet % LABEL_STOCK.columns;
    return {
        leftMm: round2(LABEL_STOCK.marginLeftMm + column * LABEL_STOCK.columnPitchMm),
        topMm: round2(LABEL_STOCK.marginTopMm + row * LABEL_STOCK.rowPitchMm),
    };
}

/**
 * The first label position a sheet prints onto, 1-based, clamped to the sheet.
 *
 * PARTLY USED SHEETS ARE THE ORDINARY CASE RATHER THAN AN EDGE. A registration is
 * usually a handful of tools, so a run of six labels leaves twenty-four positions
 * on a thirty-label sheet — and the next run would waste another sheet if printing
 * always started at the top. A person looking at a part-used sheet counts to the
 * first free label, which is why this is a POSITION and not a count of ones to
 * skip.
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
 * changes. The screen words are `tool` and `tool item`, never a bare `item`.
 */
export const TOOL_LABEL_SHEET_COPY = {
    heading: "Print tool labels",

    /** The control that opens this screen, said the same way in every place. */
    openFromRegistration: "Print labels for these tool items",
    openFromTool: "Print labels for the tool items on this page",
    /**
     * From one tool item's own page (#352), where the act is a REPRINT.
     *
     * The word says so rather than saying `Print`, because that page is reached by
     * somebody holding a tool whose sticker has worn through — the label exists and
     * this replaces it. It is a link to this screen rather than a print control of
     * its own, so a reprint gets the start position a part-used sheet needs, which
     * is exactly the case a reprint is.
     */
    openFromToolItem: "Reprint this label",

    /** Nothing was named in the address. */
    noneRequested: "No tool item was named to print. Open this from a registration or from a tool's own page.",
    /** Every id named in the address is a tool item this base does not hold. */
    noneFound: "None of those tool items exists.",

    selectionHeading: "Which labels to print",
    /** Beside each candidate, so a run can leave one out without a new address. */
    include: "Include",
    selectAll: "Select all",
    selectNone: "Select none",
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
    /** A run that does not fit one sheet says so before it is sent. */
    sheetCount: ({ sheets, labels }) =>
        `${labels} label${labels === 1 ? "" : "s"} across ${sheets} sheet${sheets === 1 ? "" : "s"} of ${LABEL_STOCK.name}.`,
    /** More ids were named than one request prints. */
    overCap: ({ requested, cap }) =>
        `${requested} tool items were named and this prints ${cap} at a time, so the first ${cap} are below.`,
    /** Named in the address, absent from the base — never silently dropped. */
    missing: ({ toolItemIds }) =>
        `Not on this base, so no label is offered for ${toolItemIds.join(", ")}.`,
    /**
     * A symbol grown past what this stock's module size was derived to absorb.
     *
     * A label crops what overflows it and a cropped symbol is unscannable with
     * nothing to see, so this is said rather than drawn.
     */
    symbolTooLarge: ({ toolItemIds }) =>
        `The address is now long enough that these symbols no longer fit this stock, so their labels are not drawn: ${toolItemIds.join(", ")}. Larger stock is what fixes it.`,
};

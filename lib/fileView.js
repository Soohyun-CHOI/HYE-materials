// How a drawn file is sized, turned and sharpened, on every surface that draws one
// (#433).
//
// PURE AND IMPORT-FREE, for the reason `lib/fileLinks.js` is: every component that
// draws a file or a control around one is client code, and the offline tier loads
// this under plain `node` to hold the arithmetic below by value.
//
// ONE SCALE FOR A PICTURE AND A PAGE, AND IT IS RELATIVE TO THE WIDTH. A zoom of 1 is
// the file drawn as wide as the room it is in, and every other step is a multiple of
// that. The alternative was PDF.js's own convention, where 100% is a page at its
// printed size — and that has no meaning for a phone photograph 4,000 pixels wide,
// which is the other half of what these two surfaces draw. One toolbar that means two
// different things by `100%` is the thing the issue exists to take away, so the
// readout is a multiple of the fitted width for both kinds, and `Fit width` is the
// same act on both.

/**
 * The two ways a surface lays a document out: one page at a time, which is the
 * viewer, or every page one under the next, which is the pane on `/invoices/new`.
 *
 * TWO LAYOUTS OF ONE RENDERER RATHER THAN TWO RENDERERS. The surfaces differ in their
 * controls and in which pages are on screen; how a page is drawn is one rule, and a
 * second component drawing it would be the second implementation CLAUDE.md bars.
 */
export const FILE_LAYOUT = {
    page: "page",
    scroll: "scroll",
};

/**
 * The steps the zoom controls move through. `1` is the fitted width and is where
 * both surfaces open.
 *
 * FIXED STEPS RATHER THAN A FACTOR PER CLICK, so a reader who goes in twice and out
 * twice is back where they started, and so the page is redrawn once per click rather
 * than once per animation frame. Three times the fitted width is the top because
 * that is where the pane's 576px column puts a Letter page's 8-point figures at
 * about 24px, which is past the size anyone needs to read a scan and short of the
 * point where the canvas budget below starts giving sharpness away.
 */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** The next step in, or the same zoom at the top. */
export function zoomIn(zoom) {
    return ZOOM_STEPS.find((step) => step > zoom) ?? zoom;
}

/** The next step out, or the same zoom at the bottom. */
export function zoomOut(zoom) {
    return [...ZOOM_STEPS].reverse().find((step) => step < zoom) ?? zoom;
}

/** What the readout between the two buttons says. */
export function zoomLabel(zoom) {
    return `${Math.round(zoom * 100)}%`;
}

/** A quarter turn clockwise. The pane is the only surface that turns a file. */
export function nextRotation(rotation) {
    return (rotation + 90) % 360;
}

/** A width and height as they stand once turned. */
export function turnedSize({ width, height, rotation }) {
    return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * The width a file is drawn at, in CSS pixels.
 *
 * `natural` is the file's own width once turned — a page's width in points, or a
 * photograph's in pixels — and `room` is the width of the column it sits in.
 *
 * A PAGE ALWAYS FILLS THE ROOM, A PICTURE NEVER GROWS PAST ITSELF AT `1`. A page has
 * no natural size on a screen, so the fitted width is the only honest starting
 * point; a picture does, and one narrower than the column was drawn at its own size
 * before this issue and still is — `An image is still drawn as one`. Past `1` both
 * are multiplied alike, so a small photograph can still be enlarged.
 */
export function drawnWidth({ natural, room, zoom, grow }) {
    const fitted = grow ? room : Math.min(natural, room);
    return fitted * zoom;
}

/**
 * The most canvas pixels one page may hold.
 *
 * 16,777,216 is 4096 squared, the ceiling iOS Safari puts on a canvas's area; over
 * it the canvas draws nothing and reports nothing, which is the one failure this
 * issue exists to be rid of. PDF.js's own viewer defaults to twice this, and that
 * is a desktop figure.
 */
export const MAX_CANVAS_PIXELS = 16_777_216;

/**
 * How many device pixels a CSS pixel of the page gets.
 *
 * THE DEVICE'S OWN RATIO, UNTIL THE PAGE WOULD NOT FIT IN THE BUDGET. A canvas drawn
 * at one pixel per CSS pixel on a screen of ratio 2 is stretched by the browser and
 * every figure on it is soft, so the page is drawn at the ratio and shown at its CSS
 * size. At the top of the zoom steps on a wide surface that would pass the budget,
 * and there the ratio gives way rather than the canvas — softer at 3x rather than
 * blank.
 */
export function canvasRatio({ width, height, devicePixelRatio }) {
    const wanted = devicePixelRatio > 0 ? devicePixelRatio : 1;
    const area = width * height;
    if (!(area > 0)) return wanted;
    return Math.min(wanted, Math.sqrt(MAX_CANVAS_PIXELS / area));
}

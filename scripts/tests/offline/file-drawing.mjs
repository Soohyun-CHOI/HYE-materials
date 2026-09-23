// A PDF is drawn by one module, which no screen loads until it draws one (#433).
//
// THREE PROPERTIES OF THE RENDERER THAT BREAK WITHOUT BREAKING ANYTHING. Each one
// fails silently in a way no screen shows and no other check sees:
//
//   1  THE ENGINE IN EVERY BUNDLE. `pdfjs-dist` is ~400 KB of script and a 1 MB
//      worker, reached only by a dynamic import inside `PdfPages.js`, which is itself
//      loaded through `next/dynamic` with `ssr: false`. One static import — of the
//      engine anywhere, or of the renderer from `FileFrame` — puts it on the eight
//      screens that link a file, all of which render fine and simply got heavier.
//      `ssr: false` is also what keeps the server pass from compiling the renderer,
//      and dropping it brought back a build warning, measured: the worker URL
//      matched `next.config.mjs`'s server externals, which list `pdfjs-dist` for
//      `pdf-parse`. A warning in a build log is not a failure anybody sees.
//   2  A SECOND PAGE RENDERER. The issue asks that the viewer and the pane differ in
//      their controls and share one rule for drawing a page. A second module calling
//      PDF.js's `TextLayer` is a second rule, and the two would diverge exactly
//      where it matters: whether the copyable text sits on the glyphs.
//   3  THE ARITHMETIC. The zoom steps, the fitted width and the canvas budget are
//      pure, so they are held here by value — with literals rather than expressions
//      over the constants, since `verification.md` records a check whose every
//      assertion moved with the constant it was checking and passed a mutation.
//
// WHAT IT CANNOT SEE, in this tier's standing terms: that a page actually rendered,
// that the text layer sits on the glyphs, or that the worker loads in a production
// build. Those were checked in a browser and are written into the PR.

import {
    FILE_LAYOUT,
    MAX_CANVAS_PIXELS,
    ZOOM_STEPS,
    canvasRatio,
    drawnWidth,
    nextRotation,
    turnedSize,
    zoomIn,
    zoomLabel,
    zoomOut,
} from "../../../lib/fileView.js";
import { listJsFiles, parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { join, relative } from "node:path";

export const title = "A PDF is drawn by one module, loaded only where one is drawn (#433)";

const RENDERER = "app/components/PdfPages.js";
const FRAME = "app/components/FileFrame.js";
const ENGINE = "pdfjs-dist";

/** Every source file a bundle can reach, as repo-relative paths. */
function sourceFiles() {
    return ["app", "lib", "components"]
        .flatMap((dir) => listJsFiles(join(REPO_ROOT, dir)))
        .map((abs) => toPosix(relative(REPO_ROOT, abs)))
        .sort();
}

/** The string a static or dynamic import names, or null. */
function importSource(node) {
    if (node.type === "ImportDeclaration") return node.source?.value ?? null;
    if (node.type === "ImportExpression" && node.source?.type === "Literal") return node.source.value;
    return null;
}

const isEngine = (src) => typeof src === "string" && (src === ENGINE || src.startsWith(`${ENGINE}/`));
const isRenderer = (src) =>
    typeof src === "string" && (src === "@/app/components/PdfPages" || /(^|\/)PdfPages(\.js)?$/.test(src));

export function run({ check, assert, log }) {
    let ok = true;
    const fail = () => {
        ok = false;
    };

    const files = sourceFiles();
    const staticEngine = [];
    const dynamicEngine = [];
    const staticRenderer = [];
    const dynamicRenderer = [];
    const textLayerFiles = new Set();
    let workerUrls = 0;

    for (const rel of files) {
        const { ast } = parseFile(rel);
        walk(ast, (n) => {
            const src = importSource(n);
            if (isEngine(src)) (n.type === "ImportDeclaration" ? staticEngine : dynamicEngine).push(rel);
            if (isRenderer(src)) (n.type === "ImportDeclaration" ? staticRenderer : dynamicRenderer).push(rel);
            if (n.type === "Identifier" && n.name === "TextLayer") textLayerFiles.add(rel);
            if (
                n.type === "MemberExpression" &&
                !n.computed &&
                n.property?.name === "TextLayer"
            ) {
                textLayerFiles.add(rel);
            }
            // `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` — the form
            // both bundlers emit as an asset of its own.
            if (
                n.type === "NewExpression" &&
                n.callee?.name === "URL" &&
                isEngine(n.arguments?.[0]?.value) &&
                n.arguments?.[1]?.type === "MemberExpression" &&
                n.arguments[1].object?.type === "MetaProperty" &&
                n.arguments[1].property?.name === "url"
            ) {
                workerUrls += 1;
            }
        });
    }

    // --- anti-vacuity: the walk reached the tree and the two files ---------
    log("");
    log("the walk reached the sources, and the two files this is about:");
    if (!assert(`the walk found a non-trivial tree (${files.length})`, files.length > 150)) fail();
    if (!assert(`  including ${RENDERER}`, files.includes(RENDERER))) fail();
    if (!assert(`  and ${FRAME}`, files.includes(FRAME))) fail();

    // --- 1: the engine and the renderer are loaded on demand ---------------
    log("");
    log("1  no screen loads PDF.js until it draws a PDF:");
    if (!check("static imports of pdfjs-dist anywhere", staticEngine.join(", ") || "none", "none")) fail();
    // A FOUND THING rather than an absence, so an import the walk cannot see — a
    // parse that stopped reporting `ImportExpression` — fails here instead of
    // passing the line above.
    if (!check("dynamic imports of pdfjs-dist", dynamicEngine.join(", ") || "none", RENDERER)) fail();
    if (!check("  and the worker is a URL the bundler resolves, in that file", workerUrls, 1)) fail();
    if (!check("static imports of the renderer", staticRenderer.join(", ") || "none", "none")) fail();
    if (!check("dynamic imports of the renderer", dynamicRenderer.join(", ") || "none", FRAME)) fail();

    // `dynamic(() => import(...PdfPages), { ssr: false })` in the frame, read off the
    // AST: the call's options object must carry `ssr` set to the literal `false`.
    let ssrOff = false;
    walk(parseFile(FRAME).ast, (n) => {
        if (n.type !== "CallExpression" || n.callee?.name !== "dynamic") return;
        let loadsRenderer = false;
        walk(n.arguments?.[0], (m) => {
            if (m.type === "ImportExpression" && isRenderer(m.source?.value)) loadsRenderer = true;
        });
        const options = n.arguments?.[1];
        const ssr = options?.type === "ObjectExpression"
            ? options.properties.find((p) => p.key?.name === "ssr")
            : null;
        if (loadsRenderer && ssr?.value?.type === "Literal" && ssr.value.value === false) ssrOff = true;
    });
    if (!assert("the frame loads the renderer with `ssr: false`", ssrOff)) fail();

    // --- 2: one module draws a page -----------------------------------------
    log("");
    log("2  one module draws a page:");
    if (!check("files that reach PDF.js's TextLayer", [...textLayerFiles].join(", ") || "none", RENDERER)) fail();

    // --- 3: the arithmetic, by value ---------------------------------------
    log("");
    log("3  the zoom, the fit and the canvas budget:");
    if (!check("the zoom steps", ZOOM_STEPS.join(","), "0.5,0.75,1,1.25,1.5,2,3")) fail();
    if (!check("  one step in from the fitted width", zoomIn(1), 1.25)) fail();
    if (!check("  one step out from it", zoomOut(1), 0.75)) fail();
    if (!check("  the top stays the top", zoomIn(3), 3)) fail();
    if (!check("  the bottom stays the bottom", zoomOut(0.5), 0.5)) fail();
    if (!check("  in twice and out twice is where it started", zoomOut(zoomOut(zoomIn(zoomIn(1)))), 1)) fail();
    if (!check("  the readout", zoomLabel(1.25), "125%")) fail();
    if (!check("a quarter turn past the last is upright", nextRotation(270), 0)) fail();
    if (!check("a turned page swaps its sides", JSON.stringify(turnedSize({ width: 612, height: 792, rotation: 90 })), '{"width":792,"height":612}')) fail();
    if (!check("a page fills the column at 1", drawnWidth({ natural: 612, room: 576, zoom: 1, grow: true }), 576)) fail();
    if (!check("  and a narrow page still fills it", drawnWidth({ natural: 300, room: 576, zoom: 1, grow: true }), 576)) fail();
    if (!check("a small picture keeps its own width at 1", drawnWidth({ natural: 300, room: 576, zoom: 1, grow: false }), 300)) fail();
    if (!check("  a wide one fits the column", drawnWidth({ natural: 4000, room: 576, zoom: 1, grow: false }), 576)) fail();
    if (!check("  and a step multiplies the fit", drawnWidth({ natural: 4000, room: 576, zoom: 2, grow: false }), 1152)) fail();
    if (!check("the canvas budget is 4096 squared", MAX_CANVAS_PIXELS, 16777216)) fail();
    if (!check("a page inside the budget gets the device's ratio", canvasRatio({ width: 576, height: 745, devicePixelRatio: 2 }), 2)) fail();
    // 2496 x 3230 CSS pixels at ratio 2 would be 32.2 million device pixels; the
    // budget allows sqrt(16777216 / 8062080) = 1.4426 of them per CSS pixel.
    const capped = canvasRatio({ width: 2496, height: 3230, devicePixelRatio: 2 });
    if (!check("a page past it gives up ratio rather than drawing blank", capped.toFixed(4), "1.4426")) fail();
    if (!check("an unknown ratio is taken as 1", canvasRatio({ width: 100, height: 100, devicePixelRatio: 0 }), 1)) fail();
    if (!check("the two layouts", Object.values(FILE_LAYOUT).join(","), "page,scroll")) fail();

    return ok;
}

if (isMain(import.meta.url)) standalone(title, run);

// Every mark drawn from one source, as the design draws it (#502).
//
// FOUR CLAIMS, AND EACH IS ONE THE ISSUE'S BODY MAKES.
//   1. ONE SOURCE: every `<svg>` under `app/`, `components/` and `lib/` — as JSX or in a
//      string — is drawn by `app/components/Icon.js` or by a file `NOT_MARKS` names with the
//      reason it is no mark, and an entry whose file draws none is stale. So the next icon
//      cannot be drawn path by path where it is needed, which is how every mark the design
//      first drew came to be copied out by hand.
//   2. THE FRAME: the design's 0a Icon box — Lucide's 24 grid, `currentColor`, round caps and
//      joins, every shape stroked non-scaling at `stroke-icon`, which reads the one line
//      `app/designValues.css` declares — and a mark hidden from assistive tech that takes a
//      shape, a crop and classes and nothing that could name it.
//   3. THE SHAPES, BY VALUE: each is typed below as the design's files of 2026-10-07 draw it,
//      `search-x` as Lucide 0.532.0 has it, since those files do not draw it yet. A table
//      read back from the module would pass for any shape it held, so a shape changes in
//      both files in one commit — `design-values.mjs`' rule for the design's figures.
//   4. THE CALLS: each names a shape the module has, every shape is drawn somewhere, and each
//      call is given a size — a mark given none is an `<svg>` at the browser's 300 by 150.
//      Which file draws which marks is typed below too, so a mark that goes missing from a
//      screen fails here rather than on the screen.
//
// WHAT IT CANNOT SEE: whether a mark renders at the size it is given, in the ink around it
// and with the line its stroke resolves to — a class is Tailwind's to resolve and a page a
// browser's to draw, so those are measured in a browser and written into the pull request;
// whether the shape a call names is the one the design draws at that place; and a shape
// assembled at runtime under a name no literal spells.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every mark drawn from one source, as the design draws it (#502)";

const ICON_MODULE = "app/components/Icon.js";

/**
 * The files that draw an `<svg>` that is not a mark, each with why. A file here that stops
 * drawing one is a stale entry and fails.
 */
const NOT_MARKS = {
    "app/(tools)/StatusMark.js": "a status dot, which the design's 0a says is not an icon",
    "app/(tools)/tool-items/LabelsDialog.js": "a printed label's face and the symbol on it, the label's own drawing",
    "lib/toolLabelQR.js": "the QR symbol a label carries, built as a string",
    "app/prs/[prId]/SignerProgressBar.js": "the arcs of a request's send-backs, a chart and no mark",
    "app/prs/new/PRForm.js": "a materials screen's own mark, until #258 draws those screens from the design",
};

/**
 * Every shape, element by element, as the design's files draw it — Lucide's, as Lucide stood
 * from 0.416.0 to 0.532.0, with `circle-alert`'s two strokes written as paths where Lucide has
 * lines. `search-x` is Lucide 0.532.0's, unchanged from 0.416.0 to 1.52.0, which Design settled
 * 1g-c's mark as and its files of 2026-10-07 do not draw yet.
 */
const DESIGN_SHAPES = {
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
    "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
    "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
    "chevron-up": [["path", { d: "m18 15-6-6-6 6" }]],
    "circle-alert": [
        ["circle", { cx: "12", cy: "12", r: "10" }],
        ["path", { d: "M12 8v4" }],
        ["path", { d: "M12 16h.01" }],
    ],
    "clipboard-list": [
        ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }],
        ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
        ["path", { d: "M12 11h4" }],
        ["path", { d: "M12 16h4" }],
        ["path", { d: "M8 11h.01" }],
        ["path", { d: "M8 16h.01" }],
    ],
    ellipsis: [
        ["circle", { cx: "12", cy: "12", r: "1" }],
        ["circle", { cx: "19", cy: "12", r: "1" }],
        ["circle", { cx: "5", cy: "12", r: "1" }],
    ],
    "file-text": [
        ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
        ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
        ["path", { d: "M10 9H8" }],
        ["path", { d: "M16 13H8" }],
        ["path", { d: "M16 17H8" }],
    ],
    info: [
        ["circle", { cx: "12", cy: "12", r: "10" }],
        ["path", { d: "M12 16v-4" }],
        ["path", { d: "M12 8h.01" }],
    ],
    "map-pin": [
        ["path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" }],
        ["circle", { cx: "12", cy: "10", r: "3" }],
    ],
    minus: [["path", { d: "M5 12h14" }]],
    "panel-left": [
        ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
        ["path", { d: "M9 3v18" }],
    ],
    plus: [
        ["path", { d: "M5 12h14" }],
        ["path", { d: "M12 5v14" }],
    ],
    receipt: [
        ["path", { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" }],
        ["path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" }],
        ["path", { d: "M12 17.5v-11" }],
    ],
    "search-x": [
        ["path", { d: "m13.5 8.5-5 5" }],
        ["path", { d: "m8.5 8.5 5 5" }],
        ["circle", { cx: "11", cy: "11", r: "8" }],
        ["path", { d: "m21 21-4.3-4.3" }],
    ],
    tag: [
        ["path", { d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" }],
        ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor" }],
    ],
    truck: [
        ["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" }],
        ["path", { d: "M15 18H9" }],
        ["path", { d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" }],
        ["circle", { cx: "17", cy: "18", r: "2" }],
        ["circle", { cx: "7", cy: "18", r: "2" }],
    ],
    user: [
        ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
        ["circle", { cx: "12", cy: "7", r: "4" }],
    ],
    wrench: [
        ["path", { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" }],
    ],
    x: [
        ["path", { d: "M18 6 6 18" }],
        ["path", { d: "m6 6 12 12" }],
    ],
};

/** Which marks each file draws, so a mark gone from a screen is a failure here. */
const MARKS_BY_FILE = {
    "app/(tools)/tool-items/[toolItemId]/MoreActions.js": ["ellipsis"],
    "app/(tools)/tool-items/[toolItemId]/NameSheet.js": ["x"],
    "app/(tools)/tool-items/[toolItemId]/TransitionBar.js": ["map-pin", "user"],
    "app/(tools)/tool-items/[toolItemId]/page.js": ["map-pin", "search-x", "user"],
    "app/components/Breadcrumb.js": ["chevron-left"],
    "app/components/Controls.js": ["check", "chevron-down", "circle-alert", "info", "minus", "plus", "x"],
    "app/components/DialogFrame.js": ["check", "x"],
    "app/components/ListFrame.js": ["x"],
    "app/components/ListTable.js": ["chevron-left", "chevron-right"],
    "app/components/Menu.js": ["check"],
    "app/components/Rail.js": ["clipboard-list", "file-text", "panel-left", "receipt", "tag", "truck", "wrench"],
    "app/components/RailAccount.js": ["chevron-up"],
};

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const jsxNameOf = (element) => (element.openingElement.name.type === "JSXIdentifier" ? element.openingElement.name.name : null);
const attributesOf = (element) => element.openingElement.attributes;

/** Every `<svg>` a parsed file draws: JSX elements, and strings or templates that write one. */
export function svgsIn(ast) {
    let count = 0;
    walk(ast, (n) => {
        if (n.type === "JSXElement" && jsxNameOf(n) === "svg") count++;
        if (n.type === "Literal" && typeof n.value === "string" && n.value.includes("<svg")) count++;
        if (n.type === "TemplateElement" && (n.value.cooked ?? n.value.raw).includes("<svg")) count++;
    });
    return count;
}

/**
 * The judgment of claim 1, pure: `drawing` maps each file to how many `<svg>` it draws. Every
 * file drawing one is the module or an entry of `notMarks`, and every entry draws one.
 */
export function judgeOneSource({ drawing, notMarks, module }) {
    const failures = [];
    for (const [file, count] of drawing) {
        if (count > 0 && file !== module && !(file in notMarks)) failures.push(`${file} draws ${count} <svg> outside ${module}`);
    }
    for (const file of Object.keys(notMarks)) {
        if (!(drawing.get(file) > 0)) failures.push(`${file} is listed as drawing no mark and draws no <svg>`);
    }
    if (!(drawing.get(module) > 0)) failures.push(`${module} draws no <svg>`);
    return failures;
}

/** A literal-valued object expression as a plain object; anything else is null. */
function plainObject(node) {
    if (node?.type !== "ObjectExpression") return null;
    const out = {};
    for (const p of node.properties) {
        if (p.type !== "Property" || p.value.type !== "Literal") return null;
        out[p.key.type === "Identifier" ? p.key.name : p.key.value] = p.value.value;
    }
    return out;
}

/** The module's `SHAPES`, read off its AST into the form `DESIGN_SHAPES` is typed in. */
export function shapesIn(ast) {
    let shapes = null;
    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator" || n.id?.name !== "SHAPES" || n.init?.type !== "ObjectExpression") return;
        shapes = {};
        for (const p of n.init.properties) {
            const key = p.key.type === "Identifier" ? p.key.name : p.key.value;
            shapes[key] = p.value.elements.map((pair) => [pair.elements[0].value, plainObject(pair.elements[1])]);
        }
    });
    return shapes;
}

/** A shape as one comparable string: its elements in order, each one's attributes sorted. */
const shapeKey = (elements) => JSON.stringify(elements.map(([tag, attrs]) => [tag, Object.entries(attrs ?? {}).sort(([a], [b]) => a.localeCompare(b))]));

/** The judgment of claim 3, pure: the same names, and each name the same shape. */
export function judgeShapes({ shapes, design }) {
    const failures = [];
    for (const name of Object.keys(design)) {
        if (!(name in shapes)) failures.push(`${name} is missing from the module`);
        else if (shapeKey(shapes[name]) !== shapeKey(design[name])) failures.push(`${name} is not the design's shape`);
    }
    for (const name of Object.keys(shapes)) if (!(name in design)) failures.push(`${name} is no shape the design draws`);
    return failures;
}

/** What the frame says, read off the module's default export. */
export function frameOf(ast, source) {
    let fn = null;
    walk(ast, (n) => {
        if (n.type === "ExportDefaultDeclaration" && n.declaration?.type === "FunctionDeclaration") fn = n.declaration;
    });
    if (!fn) return null;
    const param = fn.params[0];
    const props = param?.type === "ObjectPattern" ? param.properties.map((p) => (p.type === "RestElement" ? "...rest" : p.key.name)) : [];
    // The frame is its one `<svg>`, and a shape is the one element it draws besides.
    let svg = null;
    let shape = null;
    walk(fn.body, (n) => {
        if (n.type !== "JSXElement") return;
        if (jsxNameOf(n) === "svg") svg ??= n;
        else shape ??= n;
    });
    const attrs = (element) => {
        const out = {};
        for (const a of element ? attributesOf(element) : []) {
            if (a.type === "JSXSpreadAttribute") out["..."] = source.slice(a.argument.start, a.argument.end);
            else if (a.value?.type === "Literal") out[a.name.name] = a.value.value;
            else if (a.value?.type === "JSXExpressionContainer") out[a.name.name] = source.slice(a.value.expression.start, a.value.expression.end).replace(/\s+/g, " ");
        }
        return out;
    };
    return { props, svg: attrs(svg), shape: attrs(shape) };
}

/** The class tokens a call's `className` spells, through a parameter's default where it interpolates one. */
function classTokens(expression, fn) {
    const tokens = [];
    const add = (text) => tokens.push(...String(text).split(/\s+/).filter(Boolean));
    walk(expression, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") add(n.value);
        if (n.type === "TemplateElement") add(n.value.cooked ?? n.value.raw);
        if (n.type === "Identifier" && fn) {
            for (const p of fn.params[0]?.type === "ObjectPattern" ? fn.params[0].properties : []) {
                if (p.type === "Property" && p.key.name === n.name && p.value.type === "AssignmentPattern" && p.value.right.type === "Literal") add(p.value.right.value);
            }
        }
    });
    return tokens;
}

/**
 * Every `<Icon>` a parsed file draws: the names it can take — a literal, the literals of an
 * expression, and the values of an object it reads by key — whether it is given a size, its
 * crop, and any attribute besides the three the frame takes.
 */
export function iconCallsIn(ast, source) {
    const objects = new Map();
    walk(ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && plainObject(n.init)) objects.set(n.id.name, plainObject(n.init));
    });
    const functions = [];
    walk(ast, (n) => {
        if (/Function/.test(n.type)) functions.push(n);
    });
    const enclosing = (node) => functions.filter((f) => f.start <= node.start && node.end <= f.end).sort((a, b) => b.start - a.start)[0];
    const calls = [];
    walk(ast, (n) => {
        if (n.type !== "JSXElement" || jsxNameOf(n) !== "Icon") return;
        const call = { names: [], sized: false, crop: null, extra: [] };
        for (const a of attributesOf(n)) {
            if (a.type === "JSXSpreadAttribute") {
                call.extra.push("...");
                continue;
            }
            const name = a.name.name;
            const value = a.value?.type === "JSXExpressionContainer" ? a.value.expression : a.value;
            if (name === "name") {
                walk(value, (v) => {
                    if (v.type === "Literal" && typeof v.value === "string") call.names.push(v.value);
                    if (v.type === "MemberExpression" && v.object.type === "Identifier" && objects.has(v.object.name)) call.names.push(...Object.values(objects.get(v.object.name)));
                });
            } else if (name === "className") {
                const tokens = classTokens(value, enclosing(n));
                call.sized = tokens.some((t) => /^size-/.test(t) || /^h-/.test(t));
                call.classTokens = tokens;
            } else if (name === "crop") call.crop = source.slice(value.start, value.end);
            else call.extra.push(name);
        }
        if (call.crop !== null) call.sized = call.classTokens?.some((t) => /^h-/.test(t)) ?? false;
        calls.push(call);
    });
    return calls;
}

/** The judgment of claim 4, pure: `callsByFile` maps a file to what `iconCallsIn` read off it. */
export function judgeCalls({ callsByFile, shapeNames }) {
    const failures = [];
    const used = new Set();
    for (const [file, calls] of callsByFile) {
        for (const call of calls) {
            if (call.names.length === 0) failures.push(`${file} draws a mark whose name no literal spells`);
            for (const name of call.names) {
                used.add(name);
                if (!shapeNames.includes(name)) failures.push(`${file} draws "${name}", which is no shape`);
            }
            if (!call.sized) failures.push(`${file} draws ${call.names.join("/")} with no size`);
            for (const extra of call.extra) failures.push(`${file} gives ${call.names.join("/")} ${extra === "..." ? "a spread" : `\`${extra}\``}, which a mark does not take`);
        }
    }
    for (const name of shapeNames) if (!used.has(name)) failures.push(`"${name}" is drawn nowhere`);
    return failures;
}

export function run({ check, assert, log }) {
    const files = ["app", "components", "lib"].flatMap((d) => listJsFiles(repoPath(d))).map(repoRelative).sort();
    const drawing = new Map();
    const callsByFile = new Map();
    for (const rel of files) {
        const { ast, source } = parseFile(rel);
        drawing.set(rel, svgsIn(ast));
        if (rel !== ICON_MODULE) {
            const calls = iconCallsIn(ast, source);
            if (calls.length > 0) callsByFile.set(rel, calls);
        }
    }

    // ── 1: one source ────────────────────────────────────────────────────────
    log("every <svg> in the tree is the module's or no mark:");
    check("  none drawn anywhere else, and no stale entry", judgeOneSource({ drawing, notMarks: NOT_MARKS, module: ICON_MODULE }).join(" | "), "");
    check(
        "  the files that draw one",
        [...drawing].filter(([, count]) => count > 0).map(([file]) => file).join(" | "),
        [ICON_MODULE, ...Object.keys(NOT_MARKS)].sort().join(" | ")
    );

    // ── 2: the frame ─────────────────────────────────────────────────────────
    const icon = parseFile(ICON_MODULE);
    const frame = frameOf(icon.ast, icon.source);
    log("");
    log("the frame every mark is drawn in (0a Icon box):");
    check("  it takes a shape, a crop and classes, and nothing else", frame?.props.join(" "), "name crop className");
    check("  on Lucide's 24 grid, a crop keeping its full height", frame?.svg.viewBox, 'crop ? `${crop[0]} 0 ${crop[1]} 24` : "0 0 24 24"');
    check(
        "  in the ink around it, with round caps and joins and no fill",
        [frame?.svg.stroke, frame?.svg.strokeLinecap, frame?.svg.strokeLinejoin, frame?.svg.fill].join(" "),
        "currentColor round round none"
    );
    check("  hidden from assistive tech", frame?.svg["aria-hidden"], "true");
    check(
        "  its line the one name, a cropped mark drawing past its box at its crop's width",
        [frame?.svg.className, frame?.svg.style].join(" | "),
        '`stroke-icon ${crop ? "overflow-visible" : ""} ${className}` | crop ? { aspectRatio: `${crop[1]} / 24` } : undefined'
    );
    check("  and every shape stroked so the line does not scale", [frame?.shape.vectorEffect, frame?.shape["..."]].join(" "), "non-scaling-stroke attributes");

    // ── 3: the shapes ────────────────────────────────────────────────────────
    const shapes = shapesIn(icon.ast) ?? {};
    log("");
    log("each shape is the design's, by value:");
    check("  the module's shapes", Object.keys(shapes).join(" "), Object.keys(DESIGN_SHAPES).join(" "));
    check("  each the design's own", judgeShapes({ shapes, design: DESIGN_SHAPES }).join(" | "), "");

    // ── 4: the calls ─────────────────────────────────────────────────────────
    log("");
    log("every mark a screen draws names a shape and is given a size:");
    check("  each a shape, each sized, nothing more, and every shape drawn", judgeCalls({ callsByFile, shapeNames: Object.keys(shapes) }).join(" | "), "");
    check(
        "  the marks each file draws",
        [...callsByFile].map(([file, calls]) => `${file}: ${[...new Set(calls.flatMap((c) => c.names))].sort().join(" ")}`).join(" | "),
        Object.entries(MARKS_BY_FILE)
            .map(([file, names]) => `${file}: ${names.join(" ")}`)
            .join(" | ")
    );
    check(
        "  the one cropped mark is 1b's chevron, the grid's 8 to 16",
        [...callsByFile].flatMap(([file, calls]) => calls.filter((c) => c.crop !== null).map((c) => `${file}: ${c.names.join("/")} ${c.crop}`)).join(" | "),
        "app/components/Breadcrumb.js: chevron-left [8, 8]"
    );

    // ── anti-vacuity ─────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    log(`  the walk read ${files.length} files and ${[...callsByFile.values()].flat().length} marks`);
    assert("  more than two hundred files", files.length > 200);
    const planted = (source) => parseSource(source, "<planted-icons>");
    const plantedFile = "app/planted/Screen.js";
    check(
        "  an <svg> drawn outside the module is reported",
        judgeOneSource({ drawing: new Map([[ICON_MODULE, 1], [plantedFile, svgsIn(planted("export const A = () => <svg viewBox=\"0 0 16 16\" />;\n").ast)]]), notMarks: {}, module: ICON_MODULE }).join(" | "),
        `${plantedFile} draws 1 <svg> outside ${ICON_MODULE}`
    );
    check("  and one written into a string", svgsIn(planted("export const s = `<svg viewBox=\"0 0 9 9\"></svg>`;\n").ast), 1);
    check(
        "  an entry whose file draws none is stale",
        judgeOneSource({ drawing: new Map([[ICON_MODULE, 1], [plantedFile, 0]]), notMarks: { [plantedFile]: "planted" }, module: ICON_MODULE }).join(" | "),
        `${plantedFile} is listed as drawing no mark and draws no <svg>`
    );
    check(
        "  a shape that strays from the design's is reported",
        judgeShapes({ shapes: { ...DESIGN_SHAPES, x: [["path", { d: "M4 4l8 8M12 4l-8 8" }]] }, design: DESIGN_SHAPES }).join(" | "),
        "x is not the design's shape"
    );
    check(
        "  and one the design does not draw",
        judgeShapes({ shapes: { ...DESIGN_SHAPES, star: [["path", { d: "M12 2v20" }]] }, design: DESIGN_SHAPES }).join(" | "),
        "star is no shape the design draws"
    );
    const callsOf = (source) => {
        const { ast } = planted(source);
        return new Map([[plantedFile, iconCallsIn(ast, source)]]);
    };
    const names = Object.keys(DESIGN_SHAPES);
    const allDrawn = names.map((n) => `<Icon name="${n}" className="size-icon" />`).join("");
    check(
        "  a mark naming no shape is reported",
        judgeCalls({ callsByFile: callsOf(`export const A = () => <>${allDrawn}<Icon name="chevron-dwn" className="size-icon" /></>;\n`), shapeNames: names }).join(" | "),
        `${plantedFile} draws "chevron-dwn", which is no shape`
    );
    check(
        "  and one given no size",
        judgeCalls({ callsByFile: callsOf(`export const A = () => <>${allDrawn}<Icon name="x" className="shrink-0" /></>;\n`), shapeNames: names }).join(" | "),
        `${plantedFile} draws x with no size`
    );
    check(
        "  and one given a name of its own",
        judgeCalls({ callsByFile: callsOf(`export const A = () => <>${allDrawn}<Icon name="x" aria-label="Close" className="size-icon" /></>;\n`), shapeNames: names }).join(" | "),
        `${plantedFile} gives x \`aria-label\`, which a mark does not take`
    );
    check(
        "  and a shape drawn nowhere",
        judgeCalls({ callsByFile: callsOf(`export const A = () => <>${names.filter((n) => n !== "tag").map((n) => `<Icon name="${n}" className="size-icon" />`).join("")}</>;\n`), shapeNames: names }).join(" | "),
        '"tag" is drawn nowhere'
    );
    check(
        "  a name read off an object by key counts every value it holds",
        iconCallsIn(planted('const MARKS = { a: "x", b: "check" };\nexport const A = ({ k }) => <Icon name={MARKS[k]} className="size-icon" />;\n').ast, "")
            .flatMap((c) => c.names)
            .join(" "),
        "x check"
    );
    check(
        "  and a size given through a parameter's default counts",
        iconCallsIn(planted('export function M({ size = "size-icon" }) {\n    return <Icon name="info" className={`${size} shrink-0`} />;\n}\n').ast, "")[0]?.sized,
        true
    );
    check(
        "  but a cropped mark needs a height, which a size does not stand in for",
        iconCallsIn(planted('export const A = () => <Icon name="chevron-left" crop={[8, 8]} className="size-icon" />;\n').ast, 'export const A = () => <Icon name="chevron-left" crop={[8, 8]} className="size-icon" />;\n')[0]?.sized,
        false
    );
}

if (isMain(import.meta.url)) standalone(title, run);

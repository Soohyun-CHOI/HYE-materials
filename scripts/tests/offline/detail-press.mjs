// What a press on an item's line washes on a phone, and how far its target reaches (#607).
//
// WHY THIS IS A CHECK. #601 made each of the phone's two lines on an item's page a press at least
// 48 tall, the serial number's reaching 22 above its text and the note's 22 below, and drew that
// reach as the button's own box — so a press washed all 48 of it, 22 in the room between the
// status and the number, in the Wash #533 gave the note's line. The files of 2026-11-04's
// afternoon wash the line 6 above
// and below its text and 12 past it, in Hover, "however far its target reaches" (Tools 0a Note),
// and reach the rest of the target with the button's `::after`. This tier never opens a page, so
// it asks Tailwind what each class the button carries draws and does the arithmetic:
//
//   1. THE FACE: the button's own box past its text — 6 above and below and 12 either side — in
//      every pairing, given back by its margins, so the line stands where its text does; no least
//      height on it, rounded at the phone's 12, and Hover under `:active` as the one face it
//      takes.
//   2. THE TARGET: the button's `::after`, an absolute box as wide as the face reaching on past
//      it — alone 14 above and below the text, paired the serial number's 22 above and 6 below
//      and the note's 6 above and 22 below — so each is the 48 a target takes on a line of 20,
//      and the two paired targets meet across the 12 between the lines without covering it twice.
//   3. EVERY LINE TAKES THEM: the one button `PhoneDetail` draws reads `DETAIL_PRESS` and the
//      target its pairing names, and `PhoneDetails` names the pairings so.
//
// WHAT IT CANNOT SEE. That a press on the target holds the button `:active` — a pseudo-element is
// pressed as its element, and WebKit applies `:active` under a finger only with a touch handler
// on the way up, which React's root listener is (`touch-menu-rows.mjs`); and what a phone draws.
// A browser at 373 × 810 under touch measured both against the files, and a phone is where they
// are seen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "A press on an item's line washes 6 around its text, its target reaching on (#607)";

const DETAILS = "app/(assets)/assets/[assetId]/ItemDetails.js";
const PAIRINGS = ["alone", "upper", "lower"];

const tokensOf = (text) => String(text).split(/\s+/).filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// What the file hands the button
// ─────────────────────────────────────────────────────────────────────────────

const stringOf = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : null);

/** `DETAIL_PRESS` and `DETAIL_TARGET`'s pairings, read off the file's top level. */
export function pressClasses(ast) {
    let press = null;
    const target = {};
    for (const statement of ast.body) {
        if (statement.type !== "VariableDeclaration") continue;
        for (const d of statement.declarations) {
            if (d.id?.name === "DETAIL_PRESS") press = stringOf(d.init);
            if (d.id?.name === "DETAIL_TARGET" && d.init?.type === "ObjectExpression")
                for (const p of d.init.properties) target[p.key.name ?? p.key.value] = stringOf(p.value);
        }
    }
    return { press, target };
}

/** Problems with how the phone's lines take those classes, in words. */
export function pressWiring({ ast, source }) {
    const problems = [];
    let detail = null;
    let details = null;
    walk(ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name === "PhoneDetail") detail = n;
        if (n.type === "FunctionDeclaration" && n.id?.name === "PhoneDetails") details = n;
    });
    if (!detail) return ["no PhoneDetail"];
    const targetParam = detail.params[0]?.properties?.find((p) => p.key?.name === "target");
    if (!targetParam) problems.push("PhoneDetail takes no target");
    const buttons = [];
    walk(detail, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "button") buttons.push(n);
    });
    const className = buttons.length === 1 ? buttons[0].attributes.find((a) => a.name?.name === "className")?.value?.expression : null;
    const reads = className ? source.slice(className.start, className.end) : "";
    if (buttons.length !== 1) problems.push(`PhoneDetail draws ${buttons.length} buttons`);
    else if (reads !== "`${DETAIL_PRESS} ${DETAIL_TARGET[target]}`") problems.push(`its button reads ${reads || "nothing"}`);
    const body = details ? source.slice(details.start, details.end) : "";
    if (!/kind="serial"[^>]*target=\{paired \? "upper" : "alone"\}/.test(body)) problems.push("the serial number's line is not the upper one when paired");
    if (!/kind="note"[^>]*target=\{paired \? "lower" : "alone"\}/.test(body)) problems.push("the note's line is not the lower one when paired");
    return problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// What Tailwind draws for them, in px
// ─────────────────────────────────────────────────────────────────────────────

/** Arithmetic over numbers, `+ - * /` and parentheses — a `calc()` once its lengths are numbers. */
export function evaluate(text) {
    const tokens = text.match(/\d*\.?\d+|[-+*/()]/g) ?? [];
    let at = 0;
    const peek = () => tokens[at];
    const take = () => tokens[at++];
    const factor = () => {
        const t = take();
        if (t === "(") {
            const v = sum();
            take();
            return v;
        }
        if (t === "-") return -factor();
        if (t === "+") return factor();
        const v = Number(t);
        if (Number.isNaN(v)) throw new Error(`not a number in ${text}`);
        return v;
    };
    const product = () => {
        let v = factor();
        while (peek() === "*" || peek() === "/") v = take() === "*" ? v * factor() : v / factor();
        return v;
    };
    const sum = () => {
        let v = product();
        while (peek() === "+" || peek() === "-") v = take() === "+" ? v + product() : v - product();
        return v;
    };
    const value = sum();
    if (at !== tokens.length) throw new Error(`could not read ${text}`);
    return value;
}

/** Tailwind, asked what a class draws and what a length comes to. */
export function tailwindReader(ds) {
    const cache = new Map();
    const cssOf = (token) => {
        if (!cache.has(token)) cache.set(token, (ds.candidatesToCss([token])[0] ?? "").split("@property")[0]);
        return cache.get(token);
    };
    /** A length in px: each theme variable resolved, rem at 16, then the arithmetic. */
    const px = (value) => {
        let text = String(value);
        for (let i = 0; i < 4 && /var\(/.test(text); i++)
            text = text.replace(/var\((--[\w-]+)\)/g, (_, name) => {
                const resolved = ds.resolveThemeValue(name);
                if (resolved == null) throw new Error(`${name} resolves to nothing`);
                return `(${resolved})`;
            });
        text = text.replace(/calc\(/g, "(").replace(/(\d*\.?\d+)rem\b/g, (_, n) => String(Number(n) * 16)).replace(/(\d*\.?\d+)px\b/g, "$1");
        return Math.round(evaluate(text) * 1000) / 1000;
    };
    return { cssOf, px, resolve: (name) => ds.resolveThemeValue(name) };
}

/** Each declaration a class sets, sorted by where: on the face, on its `::after`, or under a state. */
export function declarationsOf(cssOf, tokens) {
    const face = {};
    const after = {};
    const states = [];
    for (const token of tokens) {
        const css = cssOf(token);
        const declarations = [...css.matchAll(/([\w-]+):\s*([^;{}]+);/g)].map(([, property, value]) => [property, value.trim()]).filter(([property]) => property !== "content");
        const state = /&:([\w-]+)\s*\{/.exec(css)?.[1];
        const where = /&::after\s*\{/.test(css) ? after : state ? null : /&/.test(css) ? null : face;
        if (where) for (const [property, value] of declarations) where[property] = value;
        else for (const [property, value] of declarations) states.push({ token, state: state ?? "other", property, value });
    }
    return { face, after, states };
}

const sides = (decl, block, start, end) => [decl[start] ?? decl[block], decl[end] ?? decl[block]];

/** One pairing's face and target, in px from its text, read off what Tailwind draws. */
export function geometry(tw, tokens) {
    const { face, after, states } = declarationsOf(tw.cssOf, tokens);
    const read = (v) => (v === undefined ? null : tw.px(v));
    const [padTop, padBottom] = sides(face, "padding-block", "padding-top", "padding-bottom").map(read);
    const [padLeft, padRight] = sides(face, "padding-inline", "padding-left", "padding-right").map(read);
    const [marTop, marBottom] = sides(face, "margin-block", "margin-top", "margin-bottom").map(read);
    const [marLeft, marRight] = sides(face, "margin-inline", "margin-left", "margin-right").map(read);
    const [afterTop, afterBottom] = sides(after, "inset-block", "top", "bottom").map(read);
    const [afterLeft, afterRight] = sides(after, "inset-inline", "left", "right").map(read);
    return {
        face: { above: padTop ?? 0, below: padBottom ?? 0, left: padLeft ?? 0, right: padRight ?? 0 },
        givenBack: marTop === -(padTop ?? 0) && marBottom === -(padBottom ?? 0) && marLeft === -(padLeft ?? 0) && marRight === -(padRight ?? 0),
        leastHeight: face["min-height"] ?? null,
        position: face.position ?? null,
        radius: face["border-radius"] ? tw.px(face["border-radius"]) : null,
        after: { position: after.position ?? null, left: afterLeft, right: afterRight },
        target:
            after.position === "absolute" && afterTop !== null && afterBottom !== null
                ? { above: (padTop ?? 0) - afterTop, below: (padBottom ?? 0) - afterBottom }
                : { above: padTop ?? 0, below: padBottom ?? 0 },
        states: states.map((s) => `${s.state} ${s.property} ${s.value}`).sort(),
        line: tokens.includes("text-mobile-body-sm") ? tw.px("var(--text-mobile-body-sm--line-height)") : null,
    };
}

const faceText = (g) => `${g.face.above} ${g.face.below} ${g.face.left} ${g.face.right}`;
const targetText = (g) => `${g.target.above} ${g.target.below}`;

// ─────────────────────────────────────────────────────────────────────────────
// The check
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, log }) {
    const tw = tailwindReader(await loadDesignSystem());
    const file = parseFile(DETAILS);
    const classes = pressClasses(file.ast);
    const of = (classesRead) =>
        Object.fromEntries(PAIRINGS.map((pairing) => [pairing, geometry(tw, tokensOf(`${classesRead.press ?? ""} ${classesRead.target[pairing] ?? ""}`))]));
    const lines = of(classes);

    log("the face — what a press washes:");
    check("  the file hands the button a press and a target for each pairing", [classes.press !== null, ...PAIRINGS.map((p) => typeof classes.target[p] === "string")].join(" "), "true true true true");
    check("  6 above and below the text and 12 either side, in every pairing", PAIRINGS.map((p) => `${p} ${faceText(lines[p])}`).join(" | "), "alone 6 6 12 12 | upper 6 6 12 12 | lower 6 6 12 12");
    check("  given back by its margins, so the line stands where its text does", PAIRINGS.map((p) => lines[p].givenBack).join(" "), "true true true");
    check("  with no least height of its own", PAIRINGS.map((p) => lines[p].leastHeight ?? "none").join(" "), "none none none");
    check("  rounded at the phone's 12", PAIRINGS.map((p) => lines[p].radius).join(" "), "12 12 12");
    check("  and Hover under :active, the one face it takes", [...new Set(PAIRINGS.flatMap((p) => lines[p].states))].join(" | "), "active background-color var(--color-hover)");
    check("  Hover is Ink at 5.5%, as the files draw a press there", tw.resolve("--color-hover"), "color-mix(in oklab, var(--color-foreground-default) 5.5%, transparent)");

    log("the target — the button's ::after, past the face:");
    check("  an absolute box on a positioned face, as wide as the face", PAIRINGS.map((p) => `${lines[p].position} ${lines[p].after.position} ${lines[p].after.left} ${lines[p].after.right}`).join(" | "), "relative absolute 0 0 | relative absolute 0 0 | relative absolute 0 0");
    check("  alone 14 above and below; paired, the serial number's 22 up and the note's 22 down", PAIRINGS.map((p) => `${p} ${targetText(lines[p])}`).join(" | "), "alone 14 14 | upper 22 6 | lower 6 22");
    check("  each the 48 a target takes on its line", PAIRINGS.map((p) => lines[p].line + lines[p].target.above + lines[p].target.below).join(" "), "48 48 48");
    check("  and the paired two meet across the 12 between the lines", lines.upper.target.below + lines.lower.target.above, 12);

    log("every line takes them:");
    check("  PhoneDetail's one button reads the press and its pairing's target, and PhoneDetails pairs them so", pressWiring(file).join("; "), "");

    // Anti-vacuity: #601's shape, the button's own box as the target and the Wash under a press,
    // is seen for what it is, and so is a target with no `::after`. Every planted class is
    // assembled while this runs, so Tailwind, which reads `scripts/` for class names, never
    // builds one into the app's stylesheet.
    log("anti-vacuity — this check is seen to be able to fail:");
    const cls = (...parts) => parts.join("");
    const shape601 = {
        press: [cls("-mx-", "mobile-note-bleed-x"), "flex", cls("min-h-", "mobile-touch-target"), "rounded-mobile-control", cls("px-", "mobile-note-bleed-x"), "text-mobile-body-sm", cls("active:", "bg-hover-subtle")].join(" "),
        target: {
            alone: [cls("-my-", "mobile-note-bleed-y"), cls("py-", "mobile-note-bleed-y")].join(" "),
            upper: [cls("-mt-", "mobile-detail-bleed-outer"), cls("-mb-", "mobile-detail-bleed-inner"), cls("pt-", "mobile-detail-bleed-outer"), cls("pb-", "mobile-detail-bleed-inner")].join(" "),
            lower: [cls("-mt-", "mobile-detail-bleed-inner"), cls("-mb-", "mobile-detail-bleed-outer"), cls("pt-", "mobile-detail-bleed-inner"), cls("pb-", "mobile-detail-bleed-outer")].join(" "),
        },
    };
    const planted = of(shape601);
    check("  #601's face is seen reaching as far as its target", PAIRINGS.map((p) => `${p} ${faceText(planted[p])}`).join(" | "), "alone 14 14 12 12 | upper 22 6 12 12 | lower 6 22 12 12");
    check("  with its least height", planted.upper.leastHeight, "var(--spacing-mobile-touch-target)");
    check("  and the Wash under a press", planted.upper.states.join(" | "), "active background-color var(--color-hover-subtle)");
    const noAfter = of({ press: classes.press.replace(cls("after:", "absolute"), ""), target: classes.target });
    check("  a target with no absolute ::after is seen as the face alone", PAIRINGS.map((p) => targetText(noAfter[p])).join(" | "), "6 6 | 6 6 | 6 6");
    const swapped = parseSource(
        file.source.replace('target={paired ? "upper" : "alone"}', 'target={paired ? "lower" : "alone"}').replace("${DETAIL_TARGET[target]}", "${DETAIL_TARGET.alone}"),
        "<planted ItemDetails>"
    );
    check("  and a line that reads one pairing for all, or the wrong one, is seen", pressWiring(swapped).join("; "), "its button reads `${DETAIL_PRESS} ${DETAIL_TARGET.alone}`; the serial number's line is not the upper one when paired");
    check("  the arithmetic is the arithmetic", [evaluate("(0.375*16)-(1.375*16)"), evaluate("((6)*-1)"), evaluate("100/4+2*3")].join(" "), "-16 -6 31");
}

if (isMain(import.meta.url)) standalone(title, run);

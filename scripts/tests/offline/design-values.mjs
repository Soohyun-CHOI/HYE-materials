// The design's values: declared once, pinned by value, and read by name only
// where the tools axis is the only caller (#462).
//
// FOUR CLAIMS, AND THE ORDER IS THE ORDER THEY DEPEND ON EACH OTHER.
//   1. `app/designValues.css` DECLARES AND DOES NOTHING ELSE: `@theme` blocks,
//      `@custom-variant` lines and comments, and no rule that selects an element.
//      `app/globals.css` imports it right after Tailwind and reads none of it.
//   2. EVERY DECLARATION IS THE DESIGN'S VALUE, typed out below rather than read
//      back from the file, with the relations the design states held beside it:
//      a wash is the ink in an amount, every shadow is the shadow ink in an amount,
//      every size carries a line height on the 4 grid, and no name carries a digit.
//   3. A NAME IS READ ONLY BY A FILE THAT NOTHING OUTSIDE `app/(tools)/` CALLS.
//   4. EVERY NAME IS READ, OR WAITS ON AN ISSUE NAMED BESIDE IT — and a face that
//      is read is loaded by its next/font call where it is read.
//
// BY LITERAL, WHICH IS #351's AND #353's LESSON APPLIED BEFORE IT COULD REPEAT.
// A table built from the declaration would pass for any value it held, so the
// figures are the design's, typed here, and a change to one is a change to both
// files in one commit. `verification.md` has the incident that taught it.
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
// route file under `app/`: a file that only `app/(tools)/` route files reach may
// read a name, a file that any other route file reaches may not — wherever it
// lives — and a file that no route file reaches reads nothing, since nothing
// renders it. Resolution is `unread-exports.mjs`'s `importedPairs`, the same
// reading of a specifier that check makes, rather than a third copy of it.
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
// page's `:root` from the commit that declares it. The one rule that reads one,
// `.fill-rule`, Tailwind builds from an SVG attribute in `public/`, and no element
// carries it — `docs/notes/design-system.md` has the measurement.
//
// WHAT IT CANNOT SEE: anything rendered, a class assembled at runtime in the app,
// a dynamic import(), and whether a face's loader class sits above the element
// reading the face. Those are a browser's.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { listJsFiles, parseFile, parseSource, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { importedPairs } from "./unread-exports.mjs";

export const title = "The design's values — declared once, read by name on the tools axis (#462)";

const DECLARATION = "app/designValues.css";
const STYLESHEET = "app/globals.css";
const TOOLS_DIR = "app/(tools)/";

/**
 * The issues that read a name next. An issue that lands takes its number out, and
 * every name still waiting on it then has to be read or undeclared. #459 waits on
 * nothing today: it follows #456's dialog frame and reads no name first.
 */
const READERS_TO_COME = [456, 457, 458, 459, 460, 463];

/**
 * Every declaration in `app/designValues.css`, by value, with the issue that reads
 * it first — `null` once a screen reads it. A two-element row is a part of the
 * size above it (its line height, tracking or weight) and is read with that size.
 */
const VALUES = [
    // 0a · Control
    ["--height-commitment", "36px", 456],
    ["--height-control", "32px", 457],
    ["--height-nested", "30px", 456],
    ["--height-in-text", "26px", 460],
    ["--height-close", "28px", 456],
    ["--size-icon", "16px", 460],
    ["--size-icon-nested", "14px", 456],
    ["--spacing-side-summary", "8px", 457],
    ["--spacing-side-control", "10px", 463],
    ["--spacing-side-commitment", "16px", 456],
    ["--min-width-menu", "140px", 463],
    ["--max-width-menu", "280px", 463],
    ["--spacing-menu-offset", "6px", 463],
    ["--spacing-menu-inset", "5px", 463],
    // 0b · Layout
    ["--container-content", "1080px", 463],
    ["--spacing-margin", "32px", 460],
    ["--spacing-within", "8px", 456],
    ["--spacing-between", "14px", 456],
    ["--spacing-nav-icon", "11px", 460],
    ["--spacing-band-type", "20px", 463],
    ["--height-row", "40px", 463],
    ["--spacing-row-reach", "12px", 463],
    ["--height-column-head", "36px", 463],
    ["--spacing-selection-bar", "12px", 463],
    ["--spacing-selection-bar-inset", "8px", 463],
    ["--spacing-selection-bar-rise", "8px", 463],
    ["--transition-duration-selection-bar", "160ms", 463],
    // 0c · Blue
    ["--color-blue-face", "#F0F9FF", 460],
    ["--color-blue-face-hover", "#E6F5FF", 463],
    ["--color-blue-accent", "oklch(0.487 0.216 257)", 456],
    ["--color-blue-accent-hover", "oklch(0.437 0.211 257)", 456],
    ["--color-blue-accent-disabled", "color-mix(in oklab, var(--color-blue-accent) 40%, transparent)", 456],
    // 0d · Red
    ["--color-red-face", "#FFF4F5", 463],
    ["--color-red-accent", "#DC0015", 456],
    ["--color-red-accent-hover", "oklch(0.512 0.205 27)", 463],
    // 0e · Ink
    ["--color-ink", "oklch(0.255 0.013 265)", 456],
    ["--color-ink-context", "oklch(0.405 0.013 265)", 456],
    ["--color-ink-caption", "oklch(0.505 0.012 265)", 456],
    ["--color-ink-inert", "oklch(0.760 0.010 265)", 457],
    ["--color-inner-rule", "oklch(0.946 0.005 265)", 458],
    ["--color-rule", "oklch(0.928 0.006 265)", 457],
    ["--color-band", "oklch(0.896 0.007 265)", 463],
    ["--color-edge", "oklch(0.888 0.008 265)", 456],
    ["--color-edge-focus", "oklch(0.640 0.010 265)", 456],
    ["--color-wash", "color-mix(in oklab, var(--color-ink) 3%, transparent)", 456],
    ["--color-field", "color-mix(in oklab, var(--color-ink) 4.5%, transparent)", 456],
    ["--color-hover", "color-mix(in oklab, var(--color-ink) 5.5%, transparent)", 456],
    ["--color-thumb", "color-mix(in oklab, var(--color-ink) 20%, transparent)", 460],
    ["--color-thumb-hover", "color-mix(in oklab, var(--color-ink) 34%, transparent)", 460],
    // 0f · States
    ["--width-number-field", "120px", 456],
    ["--spacing-step-inset", "3px", 456],
    // 0g · Status
    ["--size-status-mark", "9px", 463],
    ["--stroke-width-status-ring", "1.5px", 463],
    // 0h · Type
    ["--text-page-title", "24px", 463],
    ["--text-page-title--line-height", "32px"],
    ["--text-page-title--letter-spacing", "-0.012em"],
    ["--text-page-title--font-weight", "600"],
    ["--text-section", "16px", 456],
    ["--text-section--line-height", "24px"],
    ["--text-reading", "14px", 456],
    ["--text-reading--line-height", "20px"],
    ["--text-beside", "13px", 456],
    ["--text-beside--line-height", "20px"],
    ["--text-head", "12px", 457],
    ["--text-head--line-height", "16px"],
    ["--text-head--font-weight", "600"],
    ["--text-wordmark", "17px", 460],
    ["--text-wordmark--line-height", "24px"],
    ["--text-wordmark--font-weight", "500"],
    ["--font-weight-page", "400", 456],
    ["--font-weight-value", "500", 456],
    ["--font-weight-title", "600", 456],
    ["--tracking-id", "-0.02em", 457],
    ["--font-text", "var(--font-instrument-sans), system-ui, sans-serif", 456],
    ["--font-id", "var(--font-fragment-mono), ui-monospace, monospace", 457],
    ["--font-wordmark", "var(--font-fraunces), Georgia, serif", 460],
    // 0i · Scroll
    ["--spacing-scrollbar", "8px", 460],
    ["--spacing-scrollbar-clearance", "2px", 460],
    ["--spacing-end", "40px", 460],
    // 0j · Radius
    ["--radius-pill", "999px", 458],
    ["--radius-mark", "2px", 457],
    ["--radius-control", "8px", 456],
    ["--radius-group", "10px", 463],
    ["--radius-surface", "12px", 456],
    // 0k · Elevation
    ["--color-shadow-ink", "oklch(0.22 0.025 265)", 456],
    ["--color-sticky", "oklch(1 0 0 / 0.82)", 460],
    ["--backdrop-blur-sticky", "8px", 460],
    ["--color-backdrop-modal", "color-mix(in oklab, var(--color-shadow-ink) 40%, transparent)", 456],
    ["--color-backdrop-panel", "color-mix(in oklab, var(--color-shadow-ink) 10%, transparent)", 460],
    [
        "--shadow-raised",
        "0 8px 24px color-mix(in oklab, var(--color-shadow-ink) 10%, transparent), 0 1px 2px color-mix(in oklab, var(--color-shadow-ink) 6%, transparent)",
        463,
    ],
    ["--shadow-panel", "0 12px 48px color-mix(in oklab, var(--color-shadow-ink) 16%, transparent)", 460],
    ["--shadow-modal", "0 24px 60px color-mix(in oklab, var(--color-shadow-ink) 24%, transparent)", 456],
    [
        "--shadow-preview",
        "0 0 0 1px color-mix(in oklab, var(--color-shadow-ink) 6%, transparent), 0 2px 8px color-mix(in oklab, var(--color-shadow-ink) 8%, transparent)",
        457,
    ],
    ["--spacing-tooltip-top", "3px", 460],
    ["--spacing-tooltip-x", "9px", 460],
    ["--spacing-tooltip-bottom", "4px", 460],
    ["--spacing-tooltip-offset", "6px", 460],
    ["--spacing-tooltip-rail", "10px", 460],
    ["--transition-delay-tooltip", "360ms", 460],
    // 0l · Modal
    ["--container-dialog", "420px", 456],
    ["--spacing-dialog-clear", "28px", 456],
    ["--spacing-dialog", "24px", 456],
    ["--spacing-dialog-head", "20px", 456],
    ["--spacing-dialog-pair", "12px", 456],
    ["--spacing-close-pull", "4px", 456],
    // 0m · Navigation
    ["--width-rail", "56px", 460],
    ["--width-rail-open", "248px", 460],
    ["--spacing-rail-inset", "12px", 460],
    ["--transition-duration-rail", "200ms", 460],
    ["--ease-rail", "cubic-bezier(0.2, 0, 0, 1)", 460],
    ["--height-account", "48px", 460],
    ["--size-avatar", "24px", 460],
    ["--height-breadcrumb", "48px", 460],
    // 0n · Record page
    ["--spacing-record-header", "24px", 463],
    ["--spacing-under-breadcrumb", "14px", 463],
    ["--spacing-header-title", "10px", 463],
    ["--spacing-header-status", "12px", 463],
    ["--spacing-block-name", "12px", 463],
    // Tools 0a · App
    ["--spacing-phone-margin", "16px", 458],
    ["--height-phone-top-bar", "56px", 463],
    ["--spacing-phone-top-bar-end", "4px", 463],
    ["--size-phone-bar-icon", "24px", 463],
    ["--spacing-phone-foot-bar-top", "16px", 458],
    ["--spacing-phone-foot-bar-bottom", "20px", 458],
    ["--spacing-phone-foot-bar-gap", "12px", 458],
    ["--shadow-phone-foot-bar", "0 -1px 12px color-mix(in oklab, var(--color-shadow-ink) 6%, transparent)", 458],
    ["--spacing-phone-target", "48px", 458],
    ["--text-phone-title", "22px", 463],
    ["--text-phone-title--line-height", "28px"],
    ["--text-phone-title--letter-spacing", "-0.012em"],
    ["--text-phone-title--font-weight", "600"],
    ["--text-phone-bar", "17px", 458],
    ["--text-phone-bar--line-height", "24px"],
    ["--text-phone-event", "16px", 458],
    ["--text-phone-event--line-height", "24px"],
    ["--text-phone-beside", "15px", 458],
    ["--text-phone-beside--line-height", "20px"],
    ["--text-phone-log-detail", "14px", 463],
    ["--text-phone-log-detail--line-height", "20px"],
    ["--text-phone-block-name", "13px", 458],
    ["--text-phone-block-name--line-height", "20px"],
    ["--text-phone-block-name--font-weight", "600"],
    ["--height-phone-button", "50px", 458],
    ["--height-phone-dialog-button", "48px", 463],
    ["--height-phone-field", "50px", 458],
    ["--spacing-phone-field-x", "16px", 458],
    ["--size-phone-field-icon", "18px", 458],
    ["--spacing-phone-field-icon", "10px", 458],
    ["--height-phone-pill", "36px", 458],
    ["--spacing-phone-pill-x", "14px", 458],
    ["--spacing-phone-pill-chevron", "12px", 458],
    ["--size-phone-status-mark", "10px", 463],
    ["--radius-phone-control", "12px", 458],
    ["--radius-phone-sheet", "28px", 458],
    ["--opacity-phone-pressed", "50%", 458],
    ["--spacing-phone-title-top", "16px", 463],
    ["--spacing-phone-title-bottom", "22px", 463],
    ["--spacing-phone-section", "32px", 463],
    ["--size-phone-log-dot", "6px", 463],
    ["--spacing-phone-log-dot", "12px", 463],
    ["--spacing-phone-log-entry", "20px", 463],
    ["--size-phone-log-icon", "14px", 463],
    ["--width-phone-sheet-handle", "36px", 458],
    ["--height-phone-sheet-handle", "4px", 458],
    ["--spacing-phone-sheet-handle", "12px", 458],
    ["--spacing-phone-sheet-title", "14px", 458],
    ["--height-phone-sheet-row", "56px", 458],
    ["--spacing-phone-sheet-row-y", "15px", 458],
    ["--spacing-phone-sheet-row-x", "16px", 458],
    ["--spacing-phone-sheet-foot", "20px", 458],
    ["--shadow-phone-sheet", "0 -12px 48px color-mix(in oklab, var(--color-shadow-ink) 16%, transparent)", 458],
    ["--color-backdrop-phone-sheet", "color-mix(in oklab, var(--color-shadow-ink) 24%, transparent)", 458],
    ["--spacing-phone-confirm-top", "24px", 463],
    ["--spacing-phone-confirm-id", "4px", 463],
    ["--spacing-phone-confirm-sentence", "14px", 463],
    ["--spacing-phone-confirm-actions", "20px", 463],
    ["--spacing-phone-confirm-stack", "12px", 463],
    ["--width-phone-menu", "232px", 463],
    ["--spacing-phone-menu-end", "12px", 463],
    ["--spacing-phone-menu-offset", "4px", 463],
    ["--spacing-phone-menu-row-x", "16px", 463],
];

/**
 * The three faces: the only names in `@theme inline`, each resolving to the
 * variable its next/font call sets. A face that is read needs that call, with
 * that `variable`, in a file only the tools axis reaches.
 */
const FACES = {
    "--font-text": { loader: "Instrument_Sans", variable: "--font-instrument-sans" },
    "--font-id": { loader: "Fragment_Mono", variable: "--font-fragment-mono" },
    "--font-wordmark": { loader: "Fraunces", variable: "--font-fraunces" },
};

/** The two variants, by the media condition each selects and the issue that reads it first. */
const VARIANTS = [
    ["phone", "(width < 40rem)", 458],
    ["rail-push", "(width >= 80rem)", 460],
];

/** The route files Next renders from, under `app/`. A file one of them reaches is on a page. */
const ROUTE_FILE = /^app\/(.*\/)?(page|layout|template|loading|error|not-found|default|global-error|route)\.js$/;

const isToolsFile = (rel) => rel.startsWith(TOOLS_DIR);

// ─────────────────────────────────────────────────────────────────────────────
// The declaration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The top level of a declaration file: its `@theme` blocks with their
 * declarations, its `@custom-variant` lines, and anything else — which the file
 * must not have. Comments are stripped first, so a comment may say anything.
 */
export function parseDeclaration(css) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = [];
    const variants = [];
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
            let depth = 1;
            let j = i + theme[0].length;
            while (j < text.length && depth > 0) {
                if (text[j] === "{") depth++;
                else if (text[j] === "}") depth--;
                j++;
            }
            const body = text.slice(i + theme[0].length, j - 1);
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
            blocks.push({ resolvedAtUse: Boolean(theme[1]), declarations });
            i = j;
            continue;
        }
        const end = text.indexOf(";", i);
        const statement = (end === -1 ? rest : text.slice(i, end)).trim();
        const variant = /^@custom-variant\s+([a-z-]+)\s+\(@media\s+(\([^()]*\))\)$/.exec(statement);
        if (variant && !statement.includes("{")) variants.push({ name: variant[1], condition: variant[2] });
        else other.push(statement.slice(0, 80));
        i = end === -1 ? text.length : end + 1;
    }
    return { blocks, variants, other };
}

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

/** A token's variants: every segment before its last, split outside brackets. */
function variantsOf(token) {
    const segments = [];
    let depth = 0;
    let start = 0;
    for (let k = 0; k < token.length; k++) {
        const c = token[k];
        if (c === "[" || c === "(") depth++;
        else if (c === "]" || c === ")") depth--;
        else if (c === ":" && depth === 0) {
            segments.push(token.slice(start, k));
            start = k + 1;
        }
    }
    return segments;
}

/**
 * For each token, the declared names it reads: the variables its CSS refers to,
 * a shadow by its `--tw-shadow` line, a face by the variable it resolves to, and a
 * variant by name. Anything Tailwind does not know as a utility reads nothing.
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
    const variantNames = new Set(VARIANTS.map(([name]) => name));

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
                    for (const variant of variantsOf(token)) if (variantNames.has(variant)) reads.add(`@${variant}`);
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
 * `waiting` maps every tracked name (a variant as `@name`) to the issue it waits
 * on, or null once read. `sources` maps a name to the names its value mixes in.
 * Returns what was read and every failure, each a sentence naming the file.
 */
export function judge({ waiting, sources, readsByFile, routesByFile, loaders, readersToCome }) {
    const failures = [];
    const read = new Set();
    for (const [file, names] of readsByFile) {
        if (names.size === 0) continue;
        const routes = [...(routesByFile.get(file) ?? [])];
        const above = routes.filter((r) => !isToolsFile(r));
        if (above.length > 0) {
            failures.push(`${file} reads ${[...names].join(", ")} and ${above.sort()[0]} calls it`);
        } else if (routes.length > 0) {
            for (const name of names) read.add(name);
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
    for (const [name, issue] of waiting) {
        if (issue !== null && !readersToCome.includes(issue)) failures.push(`${name} waits on #${issue}, which is not an issue still to come`);
        if (read.has(name) && issue !== null) failures.push(`${name} is read and still waits on #${issue}`);
        if (!read.has(name) && issue === null) failures.push(`${name} is declared and nothing reads it`);
    }
    for (const [face, { loader, variable }] of Object.entries(FACES)) {
        if (!read.has(face)) continue;
        const loaded = loaders.some(
            (l) =>
                l.imported === loader &&
                l.variable === variable &&
                [...(routesByFile.get(l.file) ?? [])].length > 0 &&
                [...routesByFile.get(l.file)].every(isToolsFile)
        );
        if (!loaded) failures.push(`${face} is read and no file only the tools axis reaches loads ${loader} into ${variable}`);
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
    check("  statements other than @theme blocks and @custom-variant lines", parsed.other.join(" | "), "");
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

    const globals = readFileSync(join(REPO_ROOT, STYLESHEET), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const statements = globals.split(";").map((s) => s.trim()).filter(Boolean);
    check("  app/globals.css opens with Tailwind, then the declaration", statements.slice(0, 2).join("; "), '@import "tailwindcss"; @import "./designValues.css"');
    check("  and imports the declaration once", globals.split("./designValues.css").length - 1, 1);
    check("  and reads none of its names", [...varRefsOf(globals, declaredNames)].join(" "), "");

    // ── 2: every value is the design's ───────────────────────────────────────
    log("");
    log("every declaration is the design's value, and the relations the design states hold:");
    check("  declared names are exactly the table's", [...declared.keys()].sort().join(" "), [...declaredNames].sort().join(" "));
    for (const [name, value] of VALUES) check(`  ${name}`, declared.get(name), value);
    const variantsDeclared = parsed.variants.map((v) => `${v.name} ${v.condition}`).join(" | ");
    check("  the variants and the edge each selects", variantsDeclared, VARIANTS.map(([n, c]) => `${n} ${c}`).join(" | "));

    check("  no name carries a digit", [...declaredNames, ...VARIANTS.map(([n]) => n)].filter((n) => /\d/.test(n)).join(" "), "");

    const mixes = (value) => [...value.matchAll(/color-mix\(in oklab, var\((--[a-z0-9-]+)\) [\d.]+%, transparent\)/g)].map((m) => m[1]);
    const washes = ["--color-wash", "--color-field", "--color-hover", "--color-thumb", "--color-thumb-hover"];
    for (const name of washes) check(`  ${name} is the ink in an amount`, mixes(declared.get(name) ?? "").join(" "), "--color-ink");
    const lifted = VALUES.filter(([n]) => n.startsWith("--shadow-") || n.startsWith("--color-backdrop-")).map(([n]) => n);
    for (const name of lifted) {
        const used = mixes(declared.get(name) ?? "");
        assert(`  ${name} is the shadow ink in amounts`, used.length > 0 && used.every((u) => u === "--color-shadow-ink"));
    }
    const sizes = tracked.filter(([n]) => n.startsWith("--text-")).map(([n]) => n);
    for (const size of sizes) {
        const leading = parseFloat(declared.get(`${size}--line-height`));
        assert(`  ${size} carries a line height on the 4 grid (${leading}px)`, Number.isInteger(leading / 4));
        const tracking = declared.get(`${size}--letter-spacing`);
        if (tracking) assert(`  ${size} is tracked negative only because it is 21px or more`, parseFloat(declared.get(size)) >= 21 && tracking.startsWith("-"));
    }
    for (const [name] of VALUES.filter((row) => row.length === 2)) {
        const owner = name.replace(/--(line-height|letter-spacing|font-weight)$/, "");
        assert(`  ${name} belongs to a size in the table`, owner !== name && tracked.some(([n]) => n === owner));
    }

    // ── the oracle, seen to work before anything is claimed with it ──────────
    log("");
    log("Tailwind is asked what a token reads, and is seen to answer right:");
    const ds = await loadDesignSystem();
    const readsOf = makeReader(ds, declaredNames);
    // Assembled here, so the class never appears whole in a file the scanner reads.
    const cls = (...parts) => parts.join("");
    const sees = (token, expected) =>
        check(`  ${token} reads`, [...readsOf([token])].sort().join(" "), [...expected].sort().join(" "));
    sees(cls("h-", "commitment"), ["--height-commitment"]);
    sees(cls("flex-", "row"), []);
    // A derived value is read by its own name; what it mixes in is the judgment's.
    sees(cls("hover", ":", "bg-", "wash"), ["--color-wash"]);
    sees(cls("bg-", "ink", "/3"), ["--color-ink"]);
    sees(cls("phone", ":", "h-", "phone-button"), ["--height-phone-button", "@phone"]);
    sees(cls("max-", "sm", ":", "hidden"), []);
    sees(cls("shadow-", "modal"), ["--shadow-modal", "--color-shadow-ink"]);
    sees(cls("font-", "text"), ["--font-text"]);
    sees(cls("text-", "page-title"), [
        "--text-page-title",
        "--text-page-title--line-height",
        "--text-page-title--letter-spacing",
        "--text-page-title--font-weight",
    ]);
    sees(cls("text-", "zinc-500"), []);
    sees("Choose", []);

    // ── the corpus, the graph and the reads ──────────────────────────────────
    log("");
    log("the corpus and the graph are seen to reach what they should:");
    const jsFiles = ["app", "components", "lib"].flatMap((d) => (existsSync(join(REPO_ROOT, d)) ? listJsFiles(join(REPO_ROOT, d)) : [])).map(repoRelative);
    const styleFiles = ["app", "components"].flatMap((d) => cssFiles(join(REPO_ROOT, d))).map(repoRelative).filter((f) => f !== DECLARATION);
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
    for (const rel of styleFiles) {
        const css = readFileSync(join(REPO_ROOT, rel), "utf8");
        graph.set(rel, new Set([...css.matchAll(/@import\s+"(\.[^"]+)"/g)].map(([, spec]) => toPosix(join(dirname(rel), spec)))));
        readsByFile.set(rel, varRefsOf(css.replace(/\/\*[\s\S]*?\*\//g, ""), declaredNames));
    }
    const routesByFile = routesReaching(graph);
    assert(`  parsed ${jsFiles.length} modules and ${styleFiles.length} stylesheets`, jsFiles.length > 150 && styleFiles.length >= 2);
    assert("  the tools layout is a route file that reaches itself", routesByFile.get("app/(tools)/layout.js")?.has("app/(tools)/layout.js"));
    assert("  the root layout reaches app/globals.css", routesByFile.get(STYLESHEET)?.has("app/layout.js"));
    assert(
        "  the label page reaches its stylesheet",
        routesByFile.get("app/(tools)/tool-items/labels/labels.css")?.has("app/(tools)/tool-items/labels/page.js")
    );
    assert("  a component shared by both axes is reached from each", (() => {
        const routes = [...(routesByFile.get("app/components/Instant.js") ?? [])];
        return routes.some(isToolsFile) && routes.some((r) => !isToolsFile(r));
    })());
    assert("  the label page's face loader is found, variable and all", loaders.some((l) => l.imported === "Inconsolata" && l.variable === "--font-label-code"));

    // ── 3 and 4: who reads, and every name read or waiting ───────────────────
    const waiting = new Map([
        ...tracked.map(([name, , issue]) => [name, issue]),
        ...VARIANTS.map(([name, , issue]) => [`@${name}`, issue]),
    ]);
    const sources = new Map(tracked.map(([name, value]) => [name, varRefsOf(value, declaredNames)]));
    const { read, failures } = judge({ waiting, sources, readsByFile, routesByFile, loaders, readersToCome: READERS_TO_COME });

    log("");
    log("a name is read only where the tools axis is the only caller, and every name is read or waits:");
    check("  failures", failures.join("\n    "), "");
    log(`  ${read.size} names read, ${[...waiting.values()].filter((i) => i !== null).length} waiting`);
    for (const issue of READERS_TO_COME) {
        log(`    #${issue} reads ${[...waiting].filter(([, i]) => i === issue).length} first`);
    }

    // ── the judgment, seen to fail where it should ───────────────────────────
    log("");
    log("the judgment fails each planted case and passes its repair:");
    const plantedName = "--height-commitment";
    const plant = ({ file, routes, names = [plantedName], issue = 456, loaderFile = null }) =>
        judge({
            waiting: new Map(names.map((name) => [name, issue])),
            sources: new Map(),
            readsByFile: new Map([[file, new Set(names)]]),
            routesByFile: new Map([
                [file, new Set(routes)],
                ...(loaderFile ? [[loaderFile, new Set(["app/(tools)/layout.js"])]] : []),
            ]),
            loaders: loaderFile ? [{ file: loaderFile, imported: "Instrument_Sans", variable: "--font-instrument-sans" }] : [],
            readersToCome: READERS_TO_COME,
        }).failures;
    const shared = "app/components/PlantedRail.js";
    assert(
        "  a shared file only the tools layout calls reads, so a waiting name it reads is stale",
        plant({ file: shared, routes: ["app/(tools)/layout.js"] }).some((f) => f.includes("still waits on #456"))
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
        plant({ file: shared, routes: ["app/(tools)/layout.js"], names: ["--font-text"], issue: null }).some((f) => f.includes("loads Instrument_Sans"))
    );
    check(
        "  and its loader in a file only the tools axis reaches repairs it",
        plant({ file: shared, routes: ["app/(tools)/layout.js"], names: ["--font-text"], issue: null, loaderFile: "app/(tools)/layout.js" }).join(" | "),
        ""
    );

    // A planted module read end to end, so the reading of strings is seen too.
    const planted = parseSource(`export const X = () => <div className="${cls("h-", "commitment")} ${cls("phone", ":", "h-", "phone-button")}" />;`, "<planted>").ast;
    check(
        "  a planted module's className reads through the same path",
        [...readsOf(tokensOf(stringsOf(planted)))].sort().join(" "),
        ["--height-commitment", "--height-phone-button", "@phone"].sort().join(" ")
    );
}

if (isMain(import.meta.url)) standalone(title, run);

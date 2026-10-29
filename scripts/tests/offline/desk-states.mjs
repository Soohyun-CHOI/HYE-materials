// `Add note` under the pointer and the rail's current section, as the files of 2026-10-27
// draw them (#584).
//
// WHAT THE CLASSES DRAW IN A STATE, READ THROUGH TAILWIND. A control's look in a state is
// the rules whose conditions hold there — under the pointer, in the expanded rail, on the
// current section — and a property the most specific of them set. So each class is handed
// to Tailwind, the state each of its rules stands under is read off the rule's nesting, and
// each value is resolved through the theme the way the stylesheet resolves it. What is held
// is the drawing's figure, not a class name: `Add note` on the Face in Accent hover, `Edit`
// beside it on the Hover, and the expanded rail's current section at 500 in Ink on the Face,
// the other rows and the collapsed rail as they were.
//
// WHAT IT CANNOT SEE. Which rule wins when two equally specific classes disagree — it names
// both rather than choosing, so a tie fails rather than passing on a guess — and anything
// only a browser draws. The issue's walk measured both in the app at 1440.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "Add note under the pointer and the rail's current section, as the design draws them (#584)";

const NOTE = "app/(assets)/assets/[assetId]/AssetNote.js";
const RAIL = "app/components/Rail.js";

/**
 * The figures the files of 2026-10-27 give (`Tools - new direction.dc (42).html`): 1f's `Add
 * note` at rest and under the pointer, and `Edit` beside a note under it; 0m's section row,
 * the current one on the Face at 500 in Ink, the others in Ink 2 at 500.
 */
const DRAWING = {
    face: "#F0F9FF",
    accent: "oklch(0.487 0.216 257)",
    accentHover: "oklch(0.437 0.211 257)",
    ink: "oklch(0.255 0.013 265)",
    ink2: "oklch(0.405 0.013 265)",
    ink3: "oklch(0.505 0.012 265)",
    hover: "color-mix(in oklab, oklch(0.255 0.013 265) 5.5%, transparent)",
    rowWeight: "500",
};

/** The states a rule's nesting can stand under here, by the selector Tailwind writes for each. */
const CONDITIONS = [
    ["hover", /^&:hover$/],
    ["expanded", /^&:is\(:where\(\.group\)\[data-expanded\] \*\)$/],
    ["current", /^&\[data-current\]$/],
    ["not-current", /^&:not\(\*\[data-current\]\)$/],
];

/**
 * Each declaration a class's CSS makes, with the conditions its rule stands under. The class's
 * own selector and the pointer's `@media (hover: hover)` are no condition here, since every
 * state read is a mouse's; a nesting this file does not know is one no state holds.
 */
export function rulesOf(css) {
    const rules = [];
    const stack = [];
    for (const raw of String(css).split("\n")) {
        const line = raw.trim();
        if (line.endsWith("{")) {
            const head = line.slice(0, -1).trim();
            if (head.startsWith("@property")) stack.push("skip");
            else if (head.startsWith(".") || head === "@media (hover: hover)") stack.push(null);
            else stack.push(CONDITIONS.find(([, re]) => re.test(head))?.[0] ?? `unknown ${head}`);
        } else if (line === "}") stack.pop();
        else if (!stack.includes("skip")) {
            const declaration = /^([a-z-]+):\s*(.+);$/.exec(line);
            if (declaration) rules.push({ conditions: stack.filter(Boolean), property: declaration[1], value: declaration[2] });
        }
    }
    return rules;
}

/** A value with every `var(--name)` the theme declares put in its place, the way the stylesheet resolves it. */
export function resolvedWith(themeValue) {
    const resolve = (value) => {
        const next = value.replace(/var\((--[a-z0-9-]+)\)/gi, (whole, name) => themeValue(name) ?? whole);
        return next === value ? value : resolve(next);
    };
    return resolve;
}

/**
 * What `tokens` draw in `state` (a set of the conditions above): for each of a face's three
 * properties, the value the applicable rules with the most conditions set, or every value
 * they set when they disagree.
 */
export function drawnIn(cssOf, resolve, tokens, state) {
    const holds = (condition) => (condition === "not-current" ? !state.has("current") : state.has(condition));
    const set = new Map();
    for (const token of tokens) {
        for (const rule of rulesOf(cssOf(token))) {
            if (!rule.conditions.every(holds)) continue;
            set.set(rule.property, [...(set.get(rule.property) ?? []), rule]);
        }
    }
    return ["background-color", "color", "font-weight"]
        .map((property) => {
            const rules = set.get(property) ?? [];
            const most = Math.max(-1, ...rules.map((rule) => rule.conditions.length));
            const values = [...new Set(rules.filter((rule) => rule.conditions.length === most).map((rule) => resolve(rule.value)))];
            return `${property} ${values.length > 0 ? values.join(" or ") : "none"}`;
        })
        .join(" | ");
}

/** The classes of the first element `isIt` picks, its `className` a string. */
function classesOf(parsed, isIt) {
    let tokens = null;
    walk(parsed.ast, (n) => {
        if (tokens || n.type !== "JSXElement" || !isIt(n)) return;
        const className = n.openingElement.attributes.find((a) => a.name?.name === "className")?.value?.value;
        tokens = String(className ?? "").split(/\s+/).filter(Boolean);
    });
    return tokens ?? [];
}

const named = (element, name) => element.openingElement.name?.name === name;
const attributeSource = (parsed, element, name) => {
    const value = element.openingElement.attributes.find((a) => a.name?.name === name)?.value;
    return value ? parsed.source.slice(value.start, value.end) : null;
};
const saysAddNote = (element) =>
    element.children.some((child) => child.type === "JSXExpressionContainer" && child.expression?.property?.name === "addNote");

/** `Add note` and `Edit`, the desk's two openers of a note, off a parsed `AssetNote.js`. */
export function noteOpeners(parsed) {
    return {
        add: classesOf(parsed, (n) => named(n, "button") && saysAddNote(n)),
        edit: classesOf(parsed, (n) => named(n, "button") && attributeSource(parsed, n, "aria-label") === "{COPY.editNote}"),
    };
}

/** A section's row, off a parsed `Rail.js`: the link carrying `data-current`. */
export function sectionRow(parsed) {
    return classesOf(parsed, (n) => named(n, "Link") && attributeSource(parsed, n, "data-current") !== null);
}

const face = ({ background = "none", color, weight = "none" }) => `background-color ${background} | color ${color} | font-weight ${weight}`;

export async function run({ check, log }) {
    const ds = await loadDesignSystem();
    const cache = new Map();
    const cssOf = (token) => {
        if (!cache.has(token)) cache.set(token, ds.candidatesToCss([token])[0] ?? "");
        return cache.get(token);
    };
    const resolve = resolvedWith((name) => ds.resolveThemeValue(name));
    const at = (tokens, ...conditions) => drawnIn(cssOf, resolve, tokens, new Set(conditions));

    log("Add note takes the Face and Accent hover under the pointer, and Edit beside it the Hover:");
    const openers = noteOpeners(parseFile(NOTE));
    check("  Add note at rest", at(openers.add), face({ color: DRAWING.accent, weight: "600" }));
    check("  Add note under the pointer", at(openers.add, "hover"), face({ background: DRAWING.face, color: DRAWING.accentHover, weight: "600" }));
    check("  Edit at rest", at(openers.edit), face({ color: DRAWING.ink, weight: "600" }));
    check("  Edit under the pointer, as before", at(openers.edit, "hover"), face({ background: DRAWING.hover, color: DRAWING.ink, weight: "600" }));

    log("the expanded rail's current section is at 500 in Ink on the Face, and every other row as it was:");
    const row = sectionRow(parseFile(RAIL));
    check("  the current section, expanded", at(row, "expanded", "current"), face({ background: DRAWING.face, color: DRAWING.ink, weight: DRAWING.rowWeight }));
    check("  and under the pointer, unchanged", at(row, "expanded", "current", "hover"), face({ background: DRAWING.face, color: DRAWING.ink, weight: DRAWING.rowWeight }));
    check("  another section, expanded", at(row, "expanded"), face({ color: DRAWING.ink2, weight: DRAWING.rowWeight }));
    check("  and under the pointer", at(row, "expanded", "hover"), face({ background: DRAWING.hover, color: DRAWING.ink, weight: DRAWING.rowWeight }));
    check("  the current section, collapsed, its word out of sight", at(row, "current"), face({ background: DRAWING.face, color: DRAWING.accent, weight: DRAWING.rowWeight }));
    check("  another section, collapsed", at(row), face({ color: DRAWING.ink3, weight: DRAWING.rowWeight }));

    // ANTI-VACUITY: the readers find each element and see the states main drew — `Add note`
    // washed at Hover in Accent, the current section at 600 — and a tie, a nesting the file does
    // not know and a value no theme holds are each seen rather than read past.
    const plantedNote = parseSource(
        'export default function N() { return <><button aria-label={COPY.editNote} className="text-foreground-default hover:bg-hover">{COPY.edit}</button><button className="text-primary hover:bg-hover">{COPY.addNote}</button></>; }',
        "<planted AssetNote>"
    );
    const plantedOpeners = noteOpeners(plantedNote);
    check(
        "  a planted Add note washing at Hover is seen",
        at(plantedOpeners.add, "hover"),
        face({ background: DRAWING.hover, color: DRAWING.accent })
    );
    const plantedRow = sectionRow(
        parseSource(
            'export default function R() { return <Link data-current={c ? "" : undefined} className="font-medium data-current:bg-selected group-data-expanded:data-current:font-semibold group-data-expanded:data-current:text-foreground-default" />; }',
            "<planted Rail>"
        )
    );
    check("  a planted current section at 600 is seen", at(plantedRow, "expanded", "current"), face({ background: DRAWING.face, color: DRAWING.ink, weight: "600" }));
    check("  two equally specific weights are named, not chosen", at(["font-medium", "font-semibold"]), face({ color: "none", weight: "500 or 600" }));
    check(
        "  a nesting the file does not know holds in no state",
        rulesOf(".x {\n  &:focus-visible {\n    color: red;\n  }\n}\n").map((rule) => rule.conditions.join()).join(),
        "unknown &:focus-visible"
    );
    check("  a variable no theme declares is left as written", resolve("var(--color-nowhere)"), "var(--color-nowhere)");
}

if (isMain(import.meta.url)) standalone(title, run);

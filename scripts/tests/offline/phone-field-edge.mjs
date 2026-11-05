// A phone field's × ends on the field's edge with its ink 16 inside, and a field with an edge takes
// Edge focus while it holds the caret (#607).
//
// WHY THIS IS A CHECK. Tools 0a's Field row says it since the files of 2026-11-04's afternoon: "a
// clear × at the end once it holds a value: an 18 mark at Ink 3 whose ink ends 16 from the field's
// edge, its 48 target ending on that edge. A field with an edge takes Edge focus while it holds the
// caret. The one field in a sheet is filled … and keeps its look while it holds the caret." The ×
// had been a 15 mark centered in a target ending 6 inside a bordered field's edge and 2 inside a
// sheet field's. This tier never opens a page, so it asks Tailwind what each class draws and does
// the arithmetic:
//
//   1. THE ×: `FIELD_CLEAR_LOOK`'s three phone looks — a 48 target whose end meets the field's
//      outer edge, the field's 16 of room and its 1px Edge where it draws one, or laid over the end
//      of the foot bar's name field, which opens a sheet (1j-a); the mark at its end, 12 in and 18
//      wide, so the x's ink, which Lucide draws from 6 to 18 of 24 with a round cap of half the
//      1.25 line, ends 16 from the field's edge.
//   2. WHICH FIELD TAKES WHICH: the bordered phone fields — `TextInput` at `xl` and the job step's
//      search — the bordered look, `SheetInput`, which draws no edge, the sheet's, and the foot
//      bar's name field the one laid over it once it holds a name, its value stopping 10 before.
//   3. A DESK'S IS A SEARCH'S ALONE (Soo, 2026-11-05): the job step's search draws a list search's
//      above the phone's edge (1l), filling the field's height inside its edge with its words
//      stopping clear of it, and the bordered phone look is drawn below the edge alone.
//   4. EDGE FOCUS: each bordered phone field turns its Edge to Edge focus while it holds the caret,
//      and the sheet's field changes nothing.
//
// WHAT IT CANNOT SEE: what a phone draws. A browser at 373 × 810 measured the × against the files.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";
import { evaluate } from "./detail-press.mjs";

export const title = "A phone field's × ends on its edge, its ink 16 in, and an edged field takes Edge focus (#607)";

const CONTROLS = "app/components/Controls.js";
const JOBS = "app/login/jobs/JobsForm.js";
const BAR = "app/(assets)/assets/[assetId]/TransitionBar.js";
const tokensOf = (text) => String(text).split(/\s+/).filter(Boolean);
/** Every class token in a piece of source's string and template literals. */
const classTokens = (source) =>
    tokensOf(
        [...[...source.matchAll(/"([^"]*)"/g)].map((m) => m[1]), ...[...source.matchAll(/`([^`]*)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, " "))].join(" ")
    );

/** Lucide's x is drawn from 6 to 18 of its 24, with a round cap of half the 1.25px line past each end. */
const X_INK_INSET = 6 / 24;
const HALF_LINE = 1.25 / 2;

/** The × looks, each its button's classes and its mark's, read off `FIELD_CLEAR_LOOK`. */
export function clearLooks(ast, source) {
    const looks = {};
    // A look's classes are a string, a name for one, or a template of the two (`SEARCH_CLEAR`).
    const strings = {};
    walk(ast, (n) => {
        if (n.type === "VariableDeclarator" && n.init?.type === "Literal" && typeof n.init.value === "string") strings[n.id.name] = n.init.value;
    });
    const text = (node) => {
        if (node?.type === "Literal") return String(node.value);
        if (node?.type === "Identifier") return strings[node.name] ?? "";
        if (node?.type === "TemplateLiteral") return node.quasis.map((q, i) => q.value.cooked + (i < node.expressions.length ? text(node.expressions[i]) : "")).join("");
        return "";
    };
    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator" || n.id?.name !== "FIELD_CLEAR_LOOK") return;
        for (const p of n.init.properties) {
            const get = (key) => p.value.properties.find((q) => q.key.name === key)?.value;
            const mark = get("mark");
            looks[p.key.name] = {
                button: text(get("button")),
                mark: mark ? (source.slice(mark.start, mark.end).match(/className="([^"]*)"/)?.[1] ?? "") : "",
            };
        }
    });
    return looks;
}

/** Each `<name …>` a source draws, by the props it is handed. */
export function propsOf(ast, name) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === name) found.push(n.attributes.map((a) => a.name?.name ?? "…").sort().join(","));
    });
    return found;
}

/** Tailwind, asked what a class draws, and a length in px. */
function reader(ds) {
    const cssOf = (token) => (ds.candidatesToCss([token])[0] ?? "").split("@property")[0];
    const px = (value) => {
        let text = String(value);
        for (let i = 0; i < 4 && /var\(/.test(text); i++) text = text.replace(/var\((--[\w-]+)\)/g, (_, name) => `(${ds.resolveThemeValue(name)})`);
        text = text.replace(/calc\(/g, "(").replace(/(\d*\.?\d+)rem\b/g, (_, n) => String(Number(n) * 16)).replace(/(\d*\.?\d+)px\b/g, "$1");
        return Math.round(evaluate(text) * 1000) / 1000;
    };
    const declared = (tokens, property) => {
        let value = null;
        for (const token of tokens) {
            const m = new RegExp(`(?<![\\w-])${property}:\\s*([^;]+);`).exec(cssOf(token));
            if (m) value = m[1].trim();
        }
        return value;
    };
    return { cssOf, px, declared };
}

/** Where a look's × stands in a field of `room` px and an Edge of `edge` px: its target's end and the ink's. */
export function placeOf(tw, look, { room, edge }) {
    const tokens = tokensOf(look.button);
    const size = tw.px(tw.declared(tokens, "width") ?? "0");
    const marginRight = tw.px(tw.declared(tokens, "margin-right") ?? tw.declared(tokens, "margin-inline") ?? "0");
    const laid = tw.declared(tokens, "position") === "absolute";
    const paddingRight = tw.px(tw.declared(tokens, "padding-right") ?? tw.declared(tokens, "padding-inline") ?? "0");
    const justify = tw.declared(tokens, "justify-content");
    const mark = tw.px(tw.declared(tokensOf(look.mark), "width") ?? "0");
    // The target's end, measured in from the field's outer edge — where a look laid over the field
    // puts it, or where the field's room and Edge leave it; the mark sits at the target's end when
    // justified there and in its middle when centered.
    const targetEnd = laid ? tw.px(tw.declared(tokens, "right") ?? "0") : room + edge + marginRight;
    const markEnd = targetEnd + (justify === "flex-end" ? paddingRight : (size - mark) / 2);
    const inkEnd = Math.round((markEnd + mark * X_INK_INSET - HALF_LINE) * 1000) / 1000;
    return { size, targetEnd, mark, inkEnd };
}

export async function run({ check, log }) {
    const tw = reader(await loadDesignSystem());
    const controls = parseFile(CONTROLS);
    const looks = clearLooks(controls.ast, controls.source);
    const room = tw.px("var(--spacing-mobile-input-inset-x)");
    const bordered = placeOf(tw, looks.phone ?? { button: "", mark: "" }, { room, edge: 1 });
    const filled = placeOf(tw, looks.sheet ?? { button: "", mark: "" }, { room, edge: 0 });
    const text = (p) => `${p.size} ${p.targetEnd} ${p.mark} ${Math.round(p.inkEnd)}`;

    log("the ×, as the field's room and its Edge leave it:");
    check("  a field's room is 16", room, 16);
    check("  on a field with an Edge, a 48 target ending on the edge and an 18 mark whose ink ends 16 in", text(bordered), "48 0 18 16");
    check("  on the one field in a sheet, which draws none, the same", text(filled), "48 0 18 16");
    const overField = placeOf(tw, looks.sheetField ?? { button: "", mark: "" }, { room, edge: 1 });
    check("  laid over the end of the foot bar's name field, the same", text(overField), "48 0 18 16");
    check("  the ink's end, to the hundredth, Lucide's x and its round cap", `${bordered.inkEnd} ${filled.inkEnd} ${overField.inkEnd}`, "15.875 15.875 15.875");
    check("  and laid over it, the target stands in the field's middle", ["top-1/2", "-translate-y-1/2"].map((t) => tokensOf(looks.sheetField?.button ?? "").includes(t)).join(" "), "true true");

    log("which field takes which:");
    const textInput = controls.source.slice(controls.source.indexOf("export function TextInput"), controls.source.indexOf("export function FieldClear"));
    const sheetInput = controls.source.slice(controls.source.indexOf("export function SheetInput"), controls.source.indexOf("export function SheetField"));
    const sheetField = controls.source.slice(controls.source.indexOf("export function SheetField"), controls.source.indexOf("export function SheetChip"));
    const jobs = parseFile(JOBS).source;
    const band = jobs.slice(jobs.indexOf("function SearchBand"), jobs.indexOf("function useHiddenEdges"));
    check(
        "  the bordered phone fields take the bordered look, and the sheet's field the sheet's",
        [/<FieldClear look="phone"/.test(textInput), /<FieldClear look="phone"/.test(band), /<FieldClear look="sheet"/.test(sheetInput)].join(" "),
        "true true true"
    );
    check(
        "  each takes the 16 of room the × is measured from, and an Edge only where it says so",
        [
            /max-sm:px-mobile-input-inset-x/.test(controls.source.match(/TEXT_INPUT_SIZE = \{[^}]*?xl: "([^"]*)"/)?.[1] ?? "") && /rounded-control border bg-white/.test(textInput),
            /max-sm:border max-sm:border-border max-sm:bg-white max-sm:px-mobile-input-inset-x/.test(band),
            /bg-mobile-input-background px-mobile-input-inset-x/.test(sheetInput) && !classTokens(sheetInput.slice(sheetInput.indexOf("return ("))).some((t) => /^(max-sm:)?border(-|$)/.test(t)),
        ].join(" "),
        "true true true"
    );

    check(
        "  the name field lays it over its end once it holds a value and is handed onClear, in a frame drawn below the phone's edge alone",
        [
            /const clearable = Boolean\(onOpen && onClear && value\) && !formBusy;/.test(sheetField),
            /<div className="relative sm:hidden">/.test(sheetField),
            /\{clearable && <FieldClear look="sheetField"/.test(sheetField),
        ].join(" "),
        "true true true"
    );
    check(
        "  and as it goes, focus goes to the field, quiet after a press, in a frame that stays drawn",
        [/ref=\{openerRef\}/.test(sheetField), /focus=\{\(\) => moveFocus\(openerRef\.current\)\}/.test(sheetField), /if \(!onClear\) return opener;/.test(sheetField)].join(" "),
        "true true true"
    );
    const valueEnd = tw.px(tw.declared(classTokens(sheetField).filter((t) => t.startsWith("pr-[")), "padding-right") ?? "0") + 1;
    check("  its value stops 10 before the ×'s target", Math.round((valueEnd - overField.size) * 1000) / 1000, 10);
    check("  and the foot bar's name field is handed it, with the name sheet's word for it", propsOf(parseFile(BAR).ast, "SheetField").join(" | "), "clearLabel,icon,onClear,onOpen,placeholder,value");

    log("a desk's × is a search's alone:");
    check("  the job step's search draws the phone's below the edge and a desk's above it", [/<FieldClear look="phone"/.test(band), /<FieldClear look="deskSearch"/.test(band)].join(" "), "true true");
    check("  a desk's is a list search's, drawn above the phone's edge alone", looks.deskSearch?.button ?? "", `${looks.search?.button ?? "?"} max-sm:hidden`);
    const searchClasses = tokensOf(looks.search?.button ?? "");
    check(
        "  which fills its field's height inside the 1px edge, at its right end, 24 wide",
        [tw.declared(searchClasses, "inset-block"), tw.px(tw.declared(searchClasses, "right") ?? "0"), tw.px(tw.declared(searchClasses, "width") ?? "0")].join(" "),
        "1px 1 24"
    );
    check("  and the job step's words stop 29 from the field's end at a desk, clear of it", tw.px(tw.declared(classTokens(band).filter((t) => /^sm:pr-/.test(t)), "padding-right") ?? "0"), 29);
    check(
        "  the bordered phone look is drawn below the edge alone",
        ["hidden", "max-sm:inline-flex"].map((t) => tokensOf(looks.phone?.button ?? "").includes(t)).join(" "),
        "true true"
    );

    log("Edge focus while a field holds the caret:");
    const focusFace = (tokens) =>
        tokens
            .filter((t) => /focus-within/.test(t))
            .map((t) => tw.cssOf(t))
            .some((css) => /:focus-within/.test(css) && /border-color: var\(--color-border-focus\)/.test(css));
    check(
        "  each bordered phone field turns its Edge to Edge focus, and the sheet's field keeps its look",
        [focusFace(classTokens(textInput)), focusFace(classTokens(band)), classTokens(sheetInput.slice(sheetInput.indexOf("return ("))).some((t) => /focus/.test(t))].join(" "),
        "true true false"
    );

    // Anti-vacuity: main's looks, the 15 mark centered in a target ending 6 and 2 inside the edge, are
    // seen for what they drew. Each planted class is assembled while this runs, so Tailwind, which
    // reads `scripts/` for class names, never builds one into the app's stylesheet.
    log("anti-vacuity — this check is seen to be able to fail:");
    const cls = (...parts) => parts.join("");
    const before = {
        phone: { button: [cls("-mr-[calc(var(--spacing-mobile-input-inset-x)-", "0.375rem)]"), "size-mobile-touch-target", "flex", "items-center", "justify-center"].join(" "), mark: cls("size-[", "0.9375rem]") },
        sheet: { button: [cls("-mr-[calc(var(--spacing-mobile-input-inset-x)-", "0.125rem)]"), "size-mobile-touch-target", "flex", "items-center", "justify-center"].join(" "), mark: cls("size-[", "0.9375rem]") },
    };
    check(
        "  main's × is seen ending 7 and 2 in from the field's edge, its 15 mark's ink 27 and 22 in",
        `${text(placeOf(tw, before.phone, { room, edge: 1 }))} | ${text(placeOf(tw, before.sheet, { room, edge: 0 }))}`,
        "48 7 15 27 | 48 2 15 22"
    );
    check("  and a bordered field with no Edge focus is seen", focusFace(["border-border"]), false);
    check(
        "  a × laid 8 in from the field's edge is seen",
        text(placeOf(tw, { button: ["absolute", cls("right-", "2"), "size-mobile-touch-target", "justify-end", "pr-mobile-input-clear-inset-right"].join(" "), mark: "size-mobile-input-clear-icon" }, { room, edge: 1 })),
        "48 8 18 24"
    );
    check("  as is a name field handed no clear", propsOf(parseSource("<SheetField value={name} onOpen={open} />", "p").ast, "SheetField").join(), "onOpen,value");
}

if (isMain(import.meta.url)) standalone(title, run);

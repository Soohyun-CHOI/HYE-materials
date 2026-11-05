// A press on the button that opened a menu closes it, in every browser (#607).
//
// WHY THIS IS A CHECK. A menu closes as focus leaves it for anything but itself and its button
// (`ActionMenu`), and each menu button's click closed its menu when it was open and opened it when
// it was not. Safari gives a pressed button no focus: the press took focus off the menu's item and
// put it nowhere, the menu closed as the button went down, and the same press's click found it
// shut and opened it again — on Soo's phone `More actions` would not close from its own button, and
// at a desk in Safari no menu button would. Chrome moves focus to the button, which the menu lets
// through, so a desk browser, this repository's own included, never showed it. This tier never
// opens a page, so it holds what the fix turns on:
//
//   1. THE JUDGMENT, BY VALUE: `openerPress` closes what was open as the press began or is open
//      still, and opens otherwise, and a key's click reads no note a press left. Each browser's
//      order of events is played through it — Chrome's, Safari's, and a press that never clicked
//      before Enter — and the judgment before #607 is played too, to be seen reopening in Safari.
//   2. THE PRESS: `useOpenerPress` notes `open` on `pointerdown`, which comes before any focus
//      moves, asks `openerPress` of the click's own event, and spends the note.
//   3. EVERY OPENER TAKES IT: every component drawing an `ActionMenu`, found twice — by its JSX and
//      by its text — and the rail's toggle, whose Panel a blur closes the same way. Each button
//      takes the press's `onPointerDown` and hands it the state it says is open, and its click asks
//      the press and reads no state of its own. Each menu button shows its menu open on its face,
//      and the asset page's `More actions` does so as the files draw it: Hover at a desk, the field
//      wash in Ink on a phone.
//
// WHAT IT CANNOT SEE. Where a browser puts focus on a press, and in what order its events come:
// Safari's focus going nowhere was played in a browser by a stand-in that does with a press on a
// button what WebKit does, and a phone is where the real one is seen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { clickFromKeys, openerPress } from "../../../lib/controls.js";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "A press on the button that opened a menu closes it, in every browser (#607)";

const MENU = "app/components/Menu.js";
const RAIL = "app/components/Rail.js";
const MORE_ACTIONS = "app/(assets)/assets/[assetId]/MoreActions.js";

const tokensOf = (text) => String(text).split(/\s+/).filter(Boolean);
const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const isFunction = (n) => n?.type === "FunctionDeclaration" || n?.type === "FunctionExpression" || n?.type === "ArrowFunctionExpression";
const attribute = (opening, name) => opening?.attributes.find((a) => a.name?.name === name);
const expressionOf = (opening, name) => attribute(opening, name)?.value?.expression ?? null;
const squeeze = (text) => text.replace(/\s+/g, " ").trim();

// ─────────────────────────────────────────────────────────────────────────────
// The judgment, played
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A menu's state through a browser's events, as the press notes it and the judgment reads it:
 * `pointerdown` notes whether it is open; focus moving to the button keeps it, as Chrome does;
 * focus going nowhere closes an open one, as Safari's press does; a click — `detail` 1 for a
 * press, 0 for Enter — is judged and spends the note. Ends on whether the menu is open.
 */
export function play(events, { open: startOpen, judge = openerPress }) {
    let open = startOpen;
    let note = false;
    for (const event of events) {
        if (event === "pointerdown") note = open;
        else if (event === "focus-nowhere") open = false;
        else if (event === "click" || event === "enter") {
            const verdict = judge({ open, openAtPress: note, byKeys: clickFromKeys({ detail: event === "enter" ? 0 : 1 }) });
            note = false;
            open = verdict === "open";
        }
    }
    return open ? "open" : "shut";
}

/** The judgment before #607: the click read the menu as it found it. */
const before607 = ({ open }) => (open ? "close" : "open");

// ─────────────────────────────────────────────────────────────────────────────
// The press
// ─────────────────────────────────────────────────────────────────────────────

/** What is wrong with `useOpenerPress`, in words. */
export function pressHook({ ast, source }) {
    let fn = null;
    walk(ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name === "useOpenerPress") fn = n;
    });
    if (!fn) return ["no useOpenerPress"];
    const open = fn.params[0]?.name;
    let note = null;
    walk(fn, (n) => {
        if (n.type === "VariableDeclarator" && n.init?.callee?.name === "useRef" && n.init.arguments[0]?.value === false) note = n.id.name;
    });
    if (!open || !note) return ["it holds no note of a press"];
    let returned = null;
    walk(fn.body, (n) => {
        if (n.type === "ReturnStatement" && n.argument?.type === "ObjectExpression") returned ??= n.argument;
    });
    const property = (name) => returned?.properties.find((p) => p.key?.name === name)?.value ?? null;
    const problems = [];
    const down = property("onPointerDown");
    if (!down || squeeze(source.slice(down.body.start, down.body.end)) !== `{ ${note}.current = ${open}; }`) problems.push("onPointerDown does not note whether the menu was open as the press began");
    const closes = property("closes");
    const event = closes?.params?.[0]?.name;
    const body = closes ? squeeze(source.slice(closes.body.start, closes.body.end)) : "";
    // The one call to `openerPress`, handed the state, the note and the click's own word.
    let asks = -1;
    walk(closes, (m) => {
        if (m.type !== "CallExpression" || m.callee?.name !== "openerPress" || m.arguments[0]?.type !== "ObjectExpression") return;
        const handed = Object.fromEntries(m.arguments[0].properties.map((p) => [p.key.name, squeeze(source.slice(p.value.start, p.value.end))]));
        if (handed.open === open && handed.openAtPress === `${note}.current` && handed.byKeys === `clickFromKeys(${event})`) asks = m.start - closes.body.start;
    });
    const spends = source.slice(closes?.body.start ?? 0, closes?.body.end ?? 0).indexOf(`${note}.current = false;`);
    if (!event || asks < 0) problems.push("its click does not ask openerPress of the note and of itself");
    if (spends < 0 || spends < asks) problems.push("its click does not spend the note");
    if (!/return verdict === "close";/.test(body)) problems.push("its click does not say whether it closes");
    return problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// The openers
// ─────────────────────────────────────────────────────────────────────────────

/** The component holding a node. */
function componentOf(parents, node) {
    let at = parents.get(node);
    while (at && !isFunction(at)) at = parents.get(at);
    return at;
}

/** Every component drawing an `ActionMenu`, with its menu button and the state the menu shows on. */
export function menuOpeners(files) {
    const found = [];
    for (const { relPath, ast } of files) {
        const parents = parentMap(ast);
        walk(ast, (n) => {
            if (n.type !== "JSXElement" || n.openingElement.name?.name !== "ActionMenu") return;
            const component = componentOf(parents, n);
            let button = null;
            walk(component, (m) => {
                if (m.type === "JSXOpeningElement" && attribute(m, "aria-haspopup")?.value?.value === "menu") button = m;
            });
            found.push({ relPath, component, button, state: expressionOf(n.openingElement, "shown")?.name ?? null });
        });
    }
    return found;
}

/** The rail's toggle, with the state it says is expanded. */
export function railToggle({ ast }) {
    let button = null;
    walk(ast, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "button" && expressionOf(n, "ref")?.name === "toggleRef") button = n;
    });
    let component = null;
    walk(ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name === "Rail") component = n;
    });
    return { relPath: RAIL, component, button, state: expressionOf(button, "aria-expanded")?.name ?? null };
}

/** What is wrong with how an opener takes the press, in words. */
export function openerProblems({ component, button, state }) {
    if (!component || !button) return ["no button opens it"];
    if (!state) return ["it says no state is open"];
    const problems = [];
    let press = null;
    walk(component, (m) => {
        if (m.type === "VariableDeclarator" && m.init?.callee?.name === "useOpenerPress") press = { name: m.id.name, handed: m.init.arguments[0]?.name ?? null };
    });
    if (!press) return ["it takes no press"];
    if (press.handed !== state) problems.push(`its press is handed ${press.handed}, not ${state}`);
    if (expressionOf(button, "aria-expanded")?.name !== state) problems.push(`its button does not say ${state} is open`);
    const down = expressionOf(button, "onPointerDown");
    if (!(down?.type === "MemberExpression" && down.object.name === press.name && down.property.name === "onPointerDown")) problems.push("its button notes no press");
    const click = expressionOf(button, "onClick");
    const event = click?.params?.[0]?.name;
    let asks = 0;
    let reads = false;
    walk(click, (m) => {
        if (m.type === "CallExpression" && m.callee?.object?.name === press.name && m.callee.property?.name === "closes" && m.arguments[0]?.name === event) asks += 1;
        if (m.type === "Identifier" && m.name === state) reads = true;
    });
    if (!event || asks !== 1) problems.push("its click does not ask the press, once, of itself");
    if (reads) problems.push(`its click reads ${state} itself`);
    return problems;
}

/** The class strings a button's className can carry, constants read through. */
function buttonClasses(ast, button) {
    const constants = new Map();
    for (const statement of ast.body) {
        const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        if (declaration?.type !== "VariableDeclaration") continue;
        for (const d of declaration.declarations) if (d.id?.type === "Identifier" && d.init) constants.set(d.id.name, d.init);
    }
    const strings = [];
    const collect = (node) =>
        walk(node, (m) => {
            if (m.type === "Literal" && typeof m.value === "string") strings.push(m.value);
            if (m.type === "TemplateElement") strings.push(m.value.cooked ?? "");
            if (m.type === "Identifier" && constants.has(m.name)) collect(constants.get(m.name));
        });
    const className = attribute(button, "className")?.value;
    if (className) collect(className);
    return strings;
}

/** What a class string draws while its button says its menu is open, through Tailwind. */
function openFaces(cssOf, strings) {
    const faces = [];
    for (const token of tokensOf(strings.join(" "))) {
        const css = cssOf(token);
        if (!/\[aria-expanded="true"\]/.test(css)) continue;
        for (const [, property, value] of css.matchAll(/(?<![\w-])(background-color|color):\s*([^;]+);/g)) faces.push(`${property} ${value.trim()}`);
    }
    return [...new Set(faces)].sort().join(" | ");
}

// ─────────────────────────────────────────────────────────────────────────────
// The check
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, log }) {
    log("the judgment, by value:");
    const table = [];
    for (const open of [false, true]) for (const openAtPress of [false, true]) for (const byKeys of [false, true]) table.push(`${+open}${+openAtPress}${+byKeys} ${openerPress({ open, openAtPress, byKeys })}`);
    check(
        "  open, open at the press, by keys: closes what is open or was at the press, unless a key clicked",
        table.join(" | "),
        "000 open | 001 open | 010 close | 011 open | 100 close | 101 close | 110 close | 111 close"
    );
    check("  Chrome: the press moves focus to the button, and the click closes the open menu", play(["pointerdown", "click"], { open: true }), "shut");
    check("  Safari: the press puts focus nowhere, the menu closes, and the click keeps it shut", play(["pointerdown", "focus-nowhere", "click"], { open: true }), "shut");
    check("  a press on the button of a shut menu opens it, in either", [play(["pointerdown", "click"], { open: false }), play(["pointerdown", "focus-nowhere", "click"], { open: false })].join(" "), "open open");
    check("  a press that never clicked, and then Enter on the shut menu's button, opens it", play(["pointerdown", "focus-nowhere", "enter"], { open: true }), "open");
    check("  and a second press after it is judged by its own note", play(["pointerdown", "focus-nowhere", "pointerdown", "click"], { open: true }), "open");

    log("the press:");
    const menu = parseFile(MENU);
    check("  useOpenerPress notes the menu on pointerdown, asks openerPress of the click, and spends the note", pressHook(menu).join("; "), "");

    log("every opener takes it:");
    const appFiles = listJsFiles(repoPath("app")).map((abs) => parseFile(repoRelative(abs)));
    const openers = menuOpeners(appFiles);
    const byText = listJsFiles(repoPath("app"))
        .filter((abs) => /<ActionMenu\b/.test(readFileSync(abs, "utf8")))
        .map(repoRelative)
        .sort();
    check("  every file drawing an ActionMenu is found by its JSX, as by its text", [...new Set(openers.map((o) => o.relPath))].sort().join(" | "), byText.join(" | "));
    check("  and they are the three menu buttons", openers.map((o) => o.relPath).sort().join(" | "), "app/(assets)/assets/[assetId]/MoreActions.js | app/components/Menu.js | app/components/RailAccount.js");
    const rail = railToggle(parseFile(RAIL));
    const every = [...openers, rail];
    check(
        "  each, and the rail's toggle, notes the press, hands it its open state and asks it on click",
        every
            .map((o) => [o.relPath, openerProblems(o)])
            .filter(([, problems]) => problems.length)
            .map(([relPath, problems]) => `${relPath}: ${problems.join(", ")}`)
            .join(" | "),
        ""
    );

    const ds = await loadDesignSystem();
    const cache = new Map();
    const cssOf = (token) => {
        if (!cache.has(token)) cache.set(token, ds.candidatesToCss([token])[0] ?? "");
        return cache.get(token);
    };
    const parsed = new Map(appFiles.map((f) => [f.relPath, f]));
    check(
        "  each menu button, or what it holds, shows its menu open on a face",
        openers
            .filter((o) => {
                const strings = [];
                walk(o.component, (m) => {
                    if (m.type === "JSXOpeningElement") strings.push(...buttonClasses(parsed.get(o.relPath).ast, m));
                });
                return !openFaces(cssOf, strings);
            })
            .map((o) => o.relPath)
            .join(" | "),
        ""
    );
    const more = openers.find((o) => o.relPath === MORE_ACTIONS);
    const looks = expressionOf(more?.button, "className");
    const phoneDesk = looks?.type === "ConditionalExpression" && looks.test.name === "phone" ? [looks.consequent.value, looks.alternate.value] : [null, null];
    check(
        "  More actions shows it at a desk on Hover, and on a phone on the field wash in Ink, as the files draw it",
        `desk ${openFaces(cssOf, [phoneDesk[1] ?? ""])} || phone ${openFaces(cssOf, [phoneDesk[0] ?? ""])}`,
        "desk background-color var(--color-hover) || phone background-color var(--color-background-muted) | color var(--color-foreground-default)"
    );

    // Anti-vacuity: the shape before #607, a press that notes nothing, a hook that asks the click
    // as it finds it, and a desk button with no face while open are each seen.
    log("anti-vacuity — this check is seen to be able to fail:");
    check("  the judgment before #607 is seen reopening the menu in Safari, and not in Chrome", [play(["pointerdown", "focus-nowhere", "click"], { open: true, judge: before607 }), play(["pointerdown", "click"], { open: true, judge: before607 })].join(" "), "open shut");
    const plantOpener = (down, click) =>
        openerProblems(
            railToggle(
                parseSource(
                    `export default function Rail() { const [expanded, setExpanded] = useState(false); const press = useOpenerPress(expanded); ` +
                        `return <button ref={toggleRef} aria-expanded={expanded} ${down} onClick={${click}} />; }`,
                    "<planted Rail>"
                )
            )
        ).join(", ");
    check("  an opener whose click reads its own state, as each did before, is seen", plantOpener("onPointerDown={press.onPointerDown}", "() => setExpanded((was) => !was)"), "its click does not ask the press, once, of itself");
    check("  one asking the press but reading its state too is seen", plantOpener("onPointerDown={press.onPointerDown}", "(event) => setExpanded(expanded ? false : !press.closes(event))"), "its click reads expanded itself");
    check("  one that notes no press is seen", plantOpener("", "(event) => setExpanded(!press.closes(event))"), "its button notes no press");
    check("  and the rail's own shape passes", plantOpener("onPointerDown={press.onPointerDown}", "(event) => setExpanded(!press.closes(event))"), "");
    const plantedHook = menu.source.replace("openAtPress.current = open;", "").replace("openAtPress.current = false;", "");
    check(
        "  a press that notes nothing and a click that spends nothing are seen",
        pressHook(parseSource(plantedHook, "<planted Menu>")).join("; "),
        "onPointerDown does not note whether the menu was open as the press began; its click does not spend the note"
    );
    const deskOpen = ["aria-expanded:", "bg-hover"].join("");
    check("  a desk More actions with no face while open is seen", openFaces(cssOf, [String(phoneDesk[1]).replace(deskOpen, "")]), "");
}

if (isMain(import.meta.url)) standalone(title, run);

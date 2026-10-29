// A menu opened by a finger opens with no row shaded (#578).
//
// WHY THIS IS A CHECK. `ActionMenu` moves focus onto an item as it opens, and on a phone Safari
// marked that item `focus-visible`, so the asset page's `More actions` opened on its first row
// shaded — `Send for repair`, or `Sign out` where the menu held nothing else. A desk browser's
// phone mode does not show it, and this tier never opens a page, so it holds what the fix turns
// on:
//
//   1. UNDER A FINGER A ROW TAKES ITS FACE WHILE HELD, AND UNDER FOCUS ONLY IN A KEYED MENU.
//      Every class an item can carry — its own className and every constant that expression
//      reads — is asked of Tailwind, and each rule setting a background or a color under a state
//      (`:hover`, `:focus-visible`, `:focus`, `:active`) is sorted by the hand its media query
//      names. Under `(pointer: coarse)`, or under no hand at all, only `:active` and a `:focus`
//      inside `[data-keyed]` may stand, and each tone has both: Hover for a plain item, red on
//      red's Face for 0f's Destructive. The hand and not the width, since a phone on its side is
//      past the phone's edge and opens the desk's menu, as a field's 16 is the hand's (#568).
//   2. UNDER A MOUSE NOTHING MOVED. Under `not (pointer: coarse)` each tone's faces are the ones
//      #501 left, held by value — Hover under `:hover` and `:focus-visible`, red on red's Face for
//      the destructive item — and no item carries a face under a mouse that is not a tone's.
//   3. WHO SAYS A KEY OPENED IT. `ActionMenu` takes `keyed` as a press (`false`) unless told,
//      sets `data-keyed` from it as it opens, before focus lands, and again on every key that
//      moves focus; every component drawing an `ActionMenu` hands it `keyed` from a state its
//      opener sets to `true` on an arrow and, on a click, to what `clickFromKeys` says of that
//      click — true for Enter and Space, which are the button's own click, held by value.
//   4. FOCUS STILL MOVES TO AN ITEM AS THE MENU OPENS, the one `focusOn` names, once it shows.
//
// WHAT IT CANNOT SEE. Whether a phone reports `pointer: coarse`; whether its browser applies
// `:active` under a finger — WebKit does only with a touch handler on the way up
// (webkit.org/b/138816), which React's listener at the root is; and why Safari marked the item
// `focus-visible` at all. A real phone is where each is seen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { clickFromKeys } from "../../../lib/controls.js";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "A menu opened by a finger opens with no row shaded (#578)";

const MENU = "app/components/Menu.js";
const STATE = /&:(hover|focus-visible|focus|active)\b/;
const FACE_DECLARATION = /(?<![\w-])(background-color|color):\s*([^;]+);/g;

const tokensOf = (text) => String(text).split(/\s+/).filter(Boolean);
const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const isFunction = (n) => n?.type === "FunctionDeclaration" || n?.type === "FunctionExpression" || n?.type === "ArrowFunctionExpression";
const attribute = (opening, name) => opening.attributes.find((a) => a.name?.name === name);

// ─────────────────────────────────────────────────────────────────────────────
// What an item carries, and what Tailwind makes of it
// ─────────────────────────────────────────────────────────────────────────────

/** The file's top-level constants, by name. */
function topLevelConstants(ast) {
    const constants = new Map();
    for (const statement of ast.body) {
        const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        if (declaration?.type !== "VariableDeclaration") continue;
        for (const d of declaration.declarations) if (d.id?.type === "Identifier" && d.init) constants.set(d.id.name, d.init);
    }
    return constants;
}

/**
 * Every class a menu item can carry: the strings in its own className and in every top-level
 * constant that expression reads, followed through the constants they read in turn.
 */
export function itemClasses({ ast }) {
    const constants = topLevelConstants(ast);
    let className = null;
    walk(ast, (n) => {
        if (n.type === "JSXOpeningElement" && attribute(n, "role")?.value?.value === "menuitem") className = attribute(n, "className")?.value ?? null;
    });
    const tokens = new Set();
    const reads = new Set();
    const collect = (node) =>
        walk(node, (m) => {
            if (m.type === "Literal" && typeof m.value === "string") for (const t of tokensOf(m.value)) tokens.add(t);
            if (m.type === "TemplateElement") for (const t of tokensOf(m.value.cooked ?? "")) tokens.add(t);
            if (m.type === "Identifier" && constants.has(m.name) && !reads.has(m.name)) {
                reads.add(m.name);
                collect(constants.get(m.name));
            }
        });
    if (className) collect(className);
    return { tokens: [...tokens], reads: [...reads].sort().join(" | ") };
}

/** Each tone's classes, read off `ITEM_FACE` by its keys. */
export function toneClasses({ ast }) {
    const face = topLevelConstants(ast).get("ITEM_FACE");
    const tones = {};
    for (const property of face?.properties ?? []) {
        const texts = [];
        walk(property.value, (m) => {
            if (m.type === "Literal" && typeof m.value === "string") texts.push(m.value);
        });
        tones[property.key.name ?? property.key.value] = tokensOf(texts.join(" "));
    }
    return tones;
}

/** Every rule a class sets a background or a color in under a state, and the hand it is for. */
export function facesOf(cssOf, tokens) {
    const faces = [];
    for (const token of tokens) {
        const css = cssOf(token);
        const state = STATE.exec(css)?.[1];
        if (!state) continue;
        const media = [...css.matchAll(/@media ([^{]+?)\s*\{/g)].map((m) => m[1]);
        const hand = media.includes("not (pointer: coarse)") ? "mouse" : media.includes("(pointer: coarse)") ? "finger" : "any";
        const keyed = /\[data-keyed\]/.test(css);
        for (const [, property, value] of css.matchAll(FACE_DECLARATION)) faces.push({ token, hand, state, keyed, property, value: value.trim() });
    }
    return faces;
}

const faceText = (f) => `${f.state}${f.keyed ? " keyed" : ""} ${f.property} ${f.value}`;
const summary = (faces) => [...new Set(faces.map(faceText))].sort().join(" | ");
const underFinger = (faces) => faces.filter((f) => f.hand !== "mouse");
const underMouse = (faces) => faces.filter((f) => f.hand !== "finger");

/** The classes that would shade a row under a finger outside a press or a keyed focus. */
export function fingerStrays(faces) {
    const allowed = (f) => (f.state === "active" && !f.keyed) || (f.state === "focus" && f.keyed);
    return [...new Set(underFinger(faces).filter((f) => !allowed(f)).map((f) => f.token))].sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Who says a key opened the menu
// ─────────────────────────────────────────────────────────────────────────────

const callArgs = (node, name) => {
    const calls = [];
    walk(node, (m) => {
        if (m.type === "CallExpression" && m.callee?.type === "Identifier" && m.callee.name === name) calls.push(m.arguments);
    });
    return calls;
};
const literalArg = (args, index) => (args[index]?.type === "Literal" ? args[index].value : undefined);

/** What `ActionMenu` does with `keyed`, and where focus goes as it opens; problems, in words. */
export function menuWiring({ ast, source }) {
    let fn = null;
    walk(ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name === "ActionMenu") fn = n;
    });
    if (!fn) return ["no ActionMenu"];
    const body = source.slice(fn.start, fn.end);
    const problems = [];
    const keyedParam = fn.params[0]?.properties?.find((p) => p.key?.name === "keyed");
    if (!(keyedParam?.value?.type === "AssignmentPattern" && keyedParam.value.right.value === false)) problems.push("keyed is not a press unless told");
    const shows = body.indexOf("list.showPopover()");
    const says = body.indexOf('list.toggleAttribute("data-keyed", keyed);');
    const focuses = body.indexOf('menuItems[focusOn === "last" ? menuItems.length - 1 : 0]?.focus();');
    if (shows < 0 || focuses < shows) problems.push("focus does not move to the item focusOn names once the menu shows");
    if (says < 0 || says < shows || says > focuses) problems.push("data-keyed is not said from keyed as it opens, before focus lands");
    let deps = [];
    walk(fn, (m) => {
        const callback = m.type === "CallExpression" && m.callee?.name === "useLayoutEffect" ? m.arguments[0] : null;
        if (callback && source.slice(callback.start, callback.end).includes("showPopover")) deps = (m.arguments[1]?.elements ?? []).map((e) => e.name);
    });
    if (!deps.includes("keyed")) problems.push("the opening effect does not run again for keyed");
    const keys = body.slice(body.indexOf("const onKeyDown"), body.indexOf("const onBlur"));
    const closes = keys.indexOf('onClose("escape");');
    const marks = keys.indexOf('listRef.current.toggleAttribute("data-keyed", true);');
    const moves = keys.indexOf("menuItems[next]?.focus();");
    if (marks < 0 || marks < closes || marks > moves) problems.push("a key moving focus does not mark the menu keyed");
    return problems;
}

/** Every component drawing an `ActionMenu`, and what is wrong with how it says a key opened it. */
export function openerWiring(files) {
    const found = [];
    for (const { relPath, ast } of files) {
        const parents = parentMap(ast);
        walk(ast, (n) => {
            if (n.type !== "JSXElement" || n.openingElement.name?.name !== "ActionMenu") return;
            let component = parents.get(n);
            while (component && !isFunction(component)) component = parents.get(component);
            const problems = [];
            const handed = attribute(n.openingElement, "keyed")?.value?.expression;
            if (handed?.type !== "Identifier") {
                problems.push("hands no keyed");
                found.push({ relPath, problems });
                return;
            }
            let held = false;
            let setter = null;
            walk(component, (m) => {
                if (m.type === "VariableDeclarator" && m.id?.type === "ArrayPattern" && m.id.elements[0]?.name === handed.name) {
                    held = m.init?.callee?.name === "useState" && m.init.arguments[0]?.value === false;
                    setter = m.id.elements[1]?.name ?? null;
                }
            });
            if (!held) problems.push(`${handed.name} is not a state that starts as a press`);
            let openOn = null;
            walk(component, (m) => {
                if (m.type === "VariableDeclarator" && m.id?.name === "openOn" && isFunction(m.init)) openOn = m.init;
            });
            const byKey = openOn?.params[1]?.name;
            if (!openOn || !byKey || !callArgs(openOn.body, setter).some((args) => args[0]?.name === byKey)) problems.push("openOn does not set it from how it opened");
            let opener = null;
            walk(component, (m) => {
                if (m.type === "JSXOpeningElement" && attribute(m, "aria-haspopup")?.value?.value === "menu") opener = m;
            });
            const handler = (name) => attribute(opener ?? { attributes: [] }, name)?.value?.expression ?? null;
            const click = handler("onClick");
            const clicked = click?.params?.[0]?.name;
            const byClick = callArgs(click, "openOn").map((args) => args[1]);
            const asksClick = byClick.length === 1 && byClick[0]?.callee?.name === "clickFromKeys" && Boolean(clicked) && byClick[0].arguments[0]?.name === clicked;
            if (!asksClick) problems.push("its click does not ask clickFromKeys of itself");
            const fromKeys = callArgs(handler("onKeyDown"), "openOn").map((args) => literalArg(args, 1));
            if (fromKeys.join() !== "true") problems.push(`its key opens with ${JSON.stringify(fromKeys)}`);
            found.push({ relPath, problems });
        });
    }
    return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// The check
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, log }) {
    const ds = await loadDesignSystem();
    const cache = new Map();
    const cssOf = (token) => {
        if (!cache.has(token)) cache.set(token, ds.candidatesToCss([token])[0] ?? "");
        return cache.get(token);
    };
    const menu = parseFile(MENU);
    const item = itemClasses(menu);
    const faces = facesOf(cssOf, item.tokens);
    const tones = toneClasses(menu);
    const toneFaces = Object.fromEntries(Object.entries(tones).map(([tone, tokens]) => [tone, facesOf(cssOf, tokens)]));

    log("under a finger a row takes its face while held, and under focus only in a keyed menu:");
    check("  no class an item carries shades it under a finger by the pointer or the browser's focus", fingerStrays(faces).join(" "), "");
    check("  the tones are a plain item and 0f's Destructive", Object.keys(tones).sort().join(" "), "danger plain");
    check(
        "  a plain item takes Hover while held and under a keyed focus",
        summary(underFinger(toneFaces.plain ?? [])),
        "active background-color var(--color-hover) | focus keyed background-color var(--color-hover)"
    );
    check(
        "  a destructive item takes red on red's Face while held and under a keyed focus",
        summary(underFinger(toneFaces.danger ?? [])),
        "active background-color var(--color-danger-subtle) | active color var(--color-danger) | focus keyed background-color var(--color-danger-subtle) | focus keyed color var(--color-danger)"
    );

    log("under a mouse nothing moved:");
    check(
        "  a plain item takes Hover under the pointer and focus-visible, as #501 left it",
        summary(underMouse(toneFaces.plain ?? [])),
        "focus-visible background-color var(--color-hover) | hover background-color var(--color-hover)"
    );
    check(
        "  a destructive item takes red on red's Face under the pointer and focus-visible, as #501 left it",
        summary(underMouse(toneFaces.danger ?? [])),
        "focus-visible background-color var(--color-danger-subtle) | focus-visible color var(--color-danger) | hover background-color var(--color-danger-subtle) | hover color var(--color-danger)"
    );
    const toneTokens = new Set(Object.values(tones).flat());
    check(
        "  and no item carries a face under a mouse that is not a tone's",
        [...new Set(underMouse(faces).filter((f) => !toneTokens.has(f.token)).map((f) => f.token))].join(" "),
        ""
    );

    log("who says a key opened it:");
    check("  ActionMenu takes keyed as a press unless told, says it as it opens and on every key that moves focus, and still moves focus", menuWiring(menu).join("; "), "");
    const appFiles = listJsFiles(repoPath("app")).map((abs) => parseFile(repoRelative(abs)));
    const openers = openerWiring(appFiles);
    check(
        "  every component drawing an ActionMenu is found",
        openers.map((o) => o.relPath).sort().join(" | "),
        "app/(assets)/assets/[assetId]/MoreActions.js | app/components/Menu.js | app/components/RailAccount.js"
    );
    check("  a click no press stands behind is the keys', and a press or a tap is not", [0, 1, 2].map((detail) => clickFromKeys({ detail })).join(" "), "true false false");
    check(
        "  and each hands it keyed, from what its click says of itself and true from its arrows",
        openers
            .filter((o) => o.problems.length)
            .map((o) => `${o.relPath}: ${o.problems.join(", ")}`)
            .join(" | "),
        ""
    );

    // Anti-vacuity: the reading reaches every constant the item reads, and sees each wrong shape
    // planted beside it. Every planted class is assembled while this runs, so Tailwind, which
    // reads `scripts/` for class names, never builds it into the app's stylesheet.
    log("anti-vacuity — this check is seen to be able to fail:");
    check("  the reading reaches every constant an item reads", item.reads, "DANGER_AT_REST | DETAIL_ITEM | ITEM_FACE | ITEM_LOOK");
    check("  and finds every tone's classes among an item's", [...toneTokens].filter((t) => !item.tokens.includes(t)).join(" "), "");
    const cls = (...parts) => parts.join(":");
    const plantedItem = (plain) =>
        parseSource(`const ITEM_FACE = { plain: "${plain}" };\nexport function ActionMenu() { return <button role="menuitem" className={ITEM_FACE.plain} />; }`, "<planted Menu>");
    const plantedStrays = (plain) => fingerStrays(facesOf(cssOf, itemClasses(plantedItem(plain)).tokens)).join(" ");
    check("  a face under the pointer for every hand is seen", plantedStrays(cls("hover", "bg-hover")), cls("hover", "bg-hover"));
    check("  one under focus-visible for a finger is seen", plantedStrays(cls("pointer-coarse", "focus-visible", "bg-hover")), cls("pointer-coarse", "focus-visible", "bg-hover"));
    check("  one under focus for a finger outside a keyed menu is seen", plantedStrays(cls("pointer-coarse", "focus", "bg-hover")), cls("pointer-coarse", "focus", "bg-hover"));
    check("  and the held and the keyed faces are not", plantedStrays(`${cls("pointer-coarse", "active", "bg-hover")} ${cls("pointer-coarse", "in-data-keyed", "focus", "bg-hover")}`), "");
    check(
        "  a tone with no face while held is seen",
        summary(underFinger(facesOf(cssOf, toneClasses(plantedItem(cls("pointer-coarse", "in-data-keyed", "focus", "bg-hover"))).plain))),
        "focus keyed background-color var(--color-hover)"
    );
    const plantedMenu = menu.source
        .replace('list.toggleAttribute("data-keyed", keyed);', "")
        .replace('listRef.current.toggleAttribute("data-keyed", true);', "")
        .replace('menuItems[focusOn === "last" ? menuItems.length - 1 : 0]?.focus();', "");
    check(
        "  a menu that says nothing of keys and moves no focus is seen",
        menuWiring(parseSource(plantedMenu, "<planted Menu>")).join("; "),
        "focus does not move to the item focusOn names once the menu shows; data-keyed is not said from keyed as it opens, before focus lands; a key moving focus does not mark the menu keyed"
    );
    const plantedOpener = (click, key) =>
        openerWiring([
            {
                relPath: "app/planted.js",
                ast: parseSource(
                    `function O() { const [keyed, setKeyed] = useState(false); const openOn = (where, byKey) => { setKeyed(byKey); }; ` +
                        `return <><button aria-haspopup="menu" onClick={(event) => openOn("first", ${click})} onKeyDown={() => openOn(where, ${key})} /><ActionMenu keyed={keyed} /></>; }`,
                    "<planted opener>"
                ).ast,
            },
        ])
            .flatMap((o) => o.problems)
            .join(", ");
    check("  an opener that takes every click for a press is seen", plantedOpener("false", "true"), "its click does not ask clickFromKeys of itself");
    check("  and one that asks the click passes", plantedOpener("clickFromKeys(event)", "true"), "");
}

if (isMain(import.meta.url)) standalone(title, run);

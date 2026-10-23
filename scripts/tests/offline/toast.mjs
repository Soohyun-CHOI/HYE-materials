// 0k's toast (#566), read off `app/components/Toast.js`.
//
// WHAT THIS FILE IS FOR. The toast is 0k's Toast drawn once — 1a's export failure is its first
// caller — and what it is held to is what the design's row and CLAUDE.md's rule for anything
// opening over the page say: the look by its names, the top layer and the content area it centers
// on, a failure that stays until it is dismissed or its action taken, `Escape`, focus handed back
// to its opener, and no word of its own. The export's own words and wiring are
// `offline/asset-export.mjs`'s.
//
// WHAT IT CANNOT SEE. Anything rendered: where the toast lands, that a screen reader announces
// it, that focus really returns. The browser run in the pull request is where those were looked
// at (`docs/notes/tools.md`).
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "0k's toast — the look, the top layer, Escape and focus (#566)";

const TOAST = "app/components/Toast.js";

/** The tokens of a class string, sorted, for comparing a look by value. */
const tokens = (classes) => (classes ?? "").split(/\s+/).filter(Boolean).sort().join(" ");

/** What the toast's source says, part by part. */
export function toastFacts({ ast, source }) {
    let root = null;
    const texts = [];
    walk(ast, (n) => {
        if (n.type === "JSXText" && n.value.trim()) texts.push(n.value.trim());
        if (n.type !== "JSXElement") return;
        const attrs = n.openingElement.attributes;
        const role = attrs.find((a) => a.name?.name === "role");
        if (role?.value?.value === "alert") root = n;
    });
    const attr = (element, name) => element?.openingElement.attributes.find((a) => a.name?.name === name)?.value;
    const button = source.match(/const TOAST_BUTTON = "([^"]*)";/)?.[1] ?? null;
    const escape = source.slice(source.indexOf("const onKeyDown"), source.indexOf("document.addEventListener(\"keydown\", onKeyDown)"));
    return {
        root: tokens(attr(root, "className")?.value),
        popover: attr(root, "popover")?.value ?? null,
        layer: [
            /useLayoutEffect\(\(\) => \{[\s\S]*?place\(\);\s*if \(!toast\.matches\(":popover-open"\)\) toast\.showPopover\(\);/.test(source),
            /const column = toast\.closest\("\[data-content-area\]"\);\s*const box = column \? column\.getBoundingClientRect\(\) : \{ left: 0, width: window\.innerWidth \};\s*toast\.style\.left = `\$\{box\.left \+ box\.width \/ 2\}px`;/.test(source),
            /const observer = new ResizeObserver\(place\);\s*if \(column\) observer\.observe\(column\);/.test(source),
        ].join(" "),
        line: /<span className="flex items-center gap-gap text-body">\s*<Icon name="circle-alert" className="size-icon shrink-0" \/>\s*\{line\}\s*<\/span>/.test(source),
        button: tokens(button),
        actions: [
            /<div className="flex items-center gap-toast-action-gap">/.test(source),
            /<button type="button" onClick=\{\(\) => closeToast\(toastRef\.current, opener, onAction\)\} className=\{`\$\{TOAST_BUTTON\} px-ghost-inset-x text-body font-semibold`\}>\s*\{action\}\s*<\/button>/.test(source),
            /<button type="button" aria-label=\{dismissLabel\} onClick=\{\(\) => closeToast\(toastRef\.current, opener, onDismiss\)\} className=\{`\$\{TOAST_BUTTON\} aspect-square`\}>\s*<Icon name="x" className="size-icon-sm" \/>\s*<\/button>/.test(source),
        ].join(" "),
        escape: /if \(event\.key !== "Escape" \|\| event\.defaultPrevented \|\| document\.querySelector\("dialog\[open\]"\)\) return;\s*closeToast\(toastRef\.current, opener, onDismiss\);/.test(escape),
        handsBack: /function closeToast\(toast, opener, then\) \{\s*if \(toast\?\.contains\(document\.activeElement\)\) opener\?\.current\?\.focus\(\);\s*then\(\);\s*\}/.test(source),
        staysUp: /if \(!shown\) return null;/.test(source) && !/setTimeout|setInterval/.test(source),
        texts: texts.join(" | "),
    };
}

/** Each file under `app/` that marks an element as the content area. */
const markers = () =>
    listJsFiles(repoPath("app"))
        .map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1))
        .filter((rel) => /data-content-area=/.test(readFileSync(repoPath(rel), "utf8")))
        .join(" ");

export function run({ check, assert, log }) {
    const real = parseFile(TOAST);
    const facts = toastFacts(real);

    log("the toast is 0k's, by its names:");
    check(
        "the Ink ground, 44, the Group radius under Toast's shadow, 14 and 6 inside, 16 from its line to its action, white and unbroken",
        facts.root,
        tokens(
            "inset-auto bottom-0 mx-0 mt-0 mb-toast-offset h-toast -translate-x-1/2 items-center gap-toast-inline overflow-visible rounded-card bg-foreground-default pr-toast-inset-right pl-toast-inset-left font-ui whitespace-nowrap text-white shadow-toast open:flex"
        )
    );
    check("  its line led by a 16 alert mark 8 before it, at 14", facts.line, true);
    check("  its action and its dismiss faceless 32s in white at the Control radius, filling at Toast's hover", facts.button, tokens("flex h-control shrink-0 items-center justify-center rounded-control text-white hover:bg-toast-hover"));
    check("  the action at 14 and 600 with a ghost's 10 either side, then the dismiss's 14 ×, 2 apart", facts.actions, "true true true");

    log("");
    log("it opens in the top layer, on the content area:");
    check("a manual popover", facts.popover, "manual");
    check("  shown as it is drawn, at the middle of the rail's column, and placed again as the column changes width", facts.layer, "true true true");
    check("  and the rail's column is the one content area marked", markers(), "app/components/Rail.js");

    log("");
    log("a failure stays, and closes as anything over the page does:");
    check("its caller says whether it shows, and nothing times it out", facts.staysUp, true);
    check("  Escape closes it, unless a dialog is open to close first", facts.escape, true);
    check("  whatever closes it while focus is inside hands focus to its opener first", facts.handsBack, true);
    // The opener 1a hands it is `Export`, a `Button`, which hands its `ref` to the button it draws.
    const controls = parseFile("app/components/Controls.js").source;
    const buttonFn = controls.slice(controls.indexOf("export function Button("), controls.indexOf("export function ButtonLink("));
    check(
        "  and a Button hands its ref to the button it draws",
        [/^export function Button\(\{[^}]*\bref, onClick, children \}\)/.test(buttonFn), /<button\s+ref=\{ref\}\s+type=\{type\}/.test(buttonFn)].join(" "),
        "true true"
    );
    check("  it says no word of its own", facts.texts, "");

    // ANTI-VACUITY: each reading fails on a toast planted without what it reads.
    log("");
    log("anti-vacuity — the readings fail on a planted toast:");
    const planted = (from, to) => toastFacts(parseSource(real.source.replace(from, to), "<planted>"));
    assert("  one that times itself out is seen", planted("if (!shown) return null;", "if (!shown) return null;\n    setTimeout(onDismiss, 4000);").staysUp === false);
    assert("  one that closes on Escape over an open dialog is seen", planted(' || document.querySelector("dialog[open]")', "").escape === false);
    assert("  one that leaves focus to fall is seen", planted("opener?.current?.focus();", "").handsBack === false);
    assert("  one that says a word of its own is seen", planted("{action}", "{action} now").texts === "now");
    // The `place` callback's lookup, the one followed by `const box`, matched over either line ending:
    // a checkout made with `core.autocrlf` holds CRLF, where a planted `\n` matched nothing.
    assert("  one centered on the window is seen", planted(/toast\.closest\("\[data-content-area\]"\);(?=\r?\n\s*const box)/, "null;").layer !== "true true true");
}

if (isMain(import.meta.url)) standalone(title, run);

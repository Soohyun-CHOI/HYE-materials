// Dark mode is removed, and stays removed until it is put back on purpose (#218).
//
// DELETE THIS FILE WHEN DARK MODE IS REINTRODUCED. It is a guard on a decision,
// not on a property of the code, and the decision is expected to be revisited:
// #218 removed the variants rather than moving them behind tokens because there
// is no token layer yet, and the Design System milestone is where a second set
// of values gets decided once, behind names that already exist. On the commit
// that reintroduces them this check is the thing standing in the way, and the
// right response is to remove it rather than to widen it or add an exemption.
// Nothing else in this tier has that property, which is why it is said here in
// the first paragraph rather than in a footnote.
//
// WHAT IT GUARDS, IN THREE PARTS. #218 removed 343 `dark:` variants from 44
// files and the `prefers-color-scheme` block in app/globals.css that turned
// them on, and added `color-scheme: light` in its place. Each part is checked
// separately because any one of them alone is a defect: variants with no switch
// are dead weight; a switch with no variants leaves the browser honoring a
// preference the styles no longer answer; and neither, with no `color-scheme`,
// still leaves the browser deciding for the chrome it paints itself. Nothing
// else in CI can see any of it — the offline tier reads source and never
// renders, so it cannot see color at all, which is the gap #218 was raised
// about.
//
// SCOPE IS `app/` + `components/`, plus the repository-root build configuration
// for the switch. That is where screens live, and it is what lets this check
// carry no exemption list: this file spells the forbidden token in its own
// source and sits under `scripts/`, outside the scan, so it needs no
// self-exemption — the same move product-name.mjs and us-english.mjs make.
//
// WHAT IT CANNOT SEE: an inline `style` attribute, a color set from JavaScript,
// a `<meta name="color-scheme">` written by a library, and anything a dependency
// ships. It matches source text, so it proves the token is absent rather than
// proving a rendered page is light. That was measured in a browser once, under
// an emulated dark preference, and the numbers are in #218's pull request.
//
// WHY `color-scheme: light` IS REQUIRED RATHER THAN MERELY ALLOWED. Left unset,
// the used value is `normal`, which is not "light" — it hands the decision to
// the browser for everything the page does not paint, and a `<select>` popup, a
// scrollbar and a date picker are all painted by the browser. So an app that
// paints every one of its own pixels light and says nothing is still half
// removed: its styles no longer answer the preference and the browser goes on
// honoring it. One declaration closes that, and it is the third of the three
// switch candidates #218's issue body names, which is why requiring it belongs
// here and not in a later design decision.
//
// WHAT THAT DECLARATION DOES AND DOES NOT BUY. It does not prove the UA chrome
// renders light — nothing in this repository can read that, and #218 could not
// either. What it does is remove the need to read it: the question stops being
// "which way does the browser lean" and becomes "what did the page ask for",
// and the answer is now in one line under version control. This check asserts
// the line exists, which is the part a file-only tier can honestly hold.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Dark mode — no variants, no switch, one declared appearance (#218)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCANNED_DIRS = ["app", "components"];

// Built from parts so the token does not appear in this file as the very
// string the scan forbids — the scan does not read this file, but a grep by a
// person looking for stragglers should not land here first.
const VARIANT = new RegExp(`\\b${"dark"}:[A-Za-z0-9_:\\-[\\]/.%#()]+`, "g");

// What selects the appearance, as opposed to what expresses it.
//
// The third pattern requires the VALUE to mention dark, and refuses to match
// inside `prefers-color-scheme`. That is not leniency: `color-scheme: light` is
// the opposite of a switch, it is the declaration this app now carries, and it
// is asserted as REQUIRED further down. Forbidding the property outright would
// have made those two checks contradict each other.
const SWITCHES = [
    { name: "prefers-color-scheme media query", re: /prefers-color-scheme/g },
    { name: "Tailwind darkMode setting", re: /darkMode/g },
    { name: "color-scheme declaration selecting dark", re: /(?<!prefers-)color-scheme\s*:[^;}\n]*dark/g },
];

// Root files that could turn the appearance on without living under app/.
const ROOT_CONFIGS = ["postcss.config.mjs", "tailwind.config.js", "tailwind.config.mjs", "tailwind.config.ts"];

function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx|mjs|css)$/.test(entry)) out.push(full);
    }
    return out;
}

export function run({ check, assert, log }) {
    const files = SCANNED_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));
    const sources = new Map(
        files.map((f) => [relative(REPO_ROOT, f).replaceAll("\\", "/"), readFileSync(f, "utf8")])
    );
    for (const c of ROOT_CONFIGS) {
        const p = join(REPO_ROOT, c);
        if (existsSync(p)) sources.set(c, readFileSync(p, "utf8"));
    }

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // "No variants found" and "read no files" print the same result, and
    // client-import-safety.mjs shipped in the second state once. So the scan is
    // made to prove it reaches files, that it reaches the stylesheet the switch
    // lived in, and that the pattern still fires on a planted line.
    log("anti-vacuity — the scan is shown to reach files and to match:");
    assert(`walked ${sources.size} files under ${SCANNED_DIRS.join("/ + ")}/ and root config`, sources.size > 50);
    assert("reached app/globals.css, where the switch lived", sources.has("app/globals.css"));
    const seesClassName = [...sources.values()].filter((s) => s.includes("className")).length;
    assert(`and matching works — "className" found in ${seesClassName} files`, seesClassName > 30);
    const planted = `<div className="bg-white ${"dark"}:bg-black p-2" />`;
    assert("the variant pattern fires on a planted line", (planted.match(VARIANT) || []).length === 1);
    assert("the switch pattern fires on a planted line", /prefers-color-scheme/.test("@media (prefers-color-scheme: dark) {"));

    // ── the variants ────────────────────────────────────────────────────────
    log("");
    log("variants — what expressed the second appearance:");
    const variants = [];
    for (const [path, src] of sources) {
        src.split("\n").forEach((line, i) => {
            VARIANT.lastIndex = 0;
            let m;
            while ((m = VARIANT.exec(line))) variants.push(`${path}:${i + 1} ${m[0]}`);
        });
    }
    variants.slice(0, 15).forEach((v) => log(`    ${v}`));
    check(
        `occurrences${variants.length ? ` (${variants.length}, first: ${variants[0]})` : ""}`,
        variants.length,
        0
    );

    // ── the switch ──────────────────────────────────────────────────────────
    log("");
    log("switch — what would turn it on, checked separately because any one part alone is a defect:");
    for (const { name, re } of SWITCHES) {
        const hits = [];
        for (const [path, src] of sources) {
            re.lastIndex = 0;
            if (re.test(src)) hits.push(path);
        }
        check(`${name}${hits.length ? ` (${hits.join(", ")})` : ""}`, hits.length, 0);
    }

    // ── the declaration that closes the other half ──────────────────────────
    // Asserted on the `:root` block rather than anywhere in the file, because
    // `color-scheme` inherits from the element that declares it and a rule
    // buried in some component selector would leave the document root at
    // `normal` — which is the state this whole section exists to rule out. The
    // absence of this line is invisible in every other way: nothing renders
    // wrong, nothing fails, the UA just quietly goes back to deciding.
    log("");
    log("the declaration that says this app has one appearance:");
    const css = sources.get("app/globals.css") ?? "";
    const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
    assert("app/globals.css declares a :root block", !!rootBlock);
    assert(
        "and it declares color-scheme: light",
        /color-scheme\s*:\s*light\s*;/.test(rootBlock?.[1] ?? "")
    );

    // ── the light values the body still needs ───────────────────────────────
    // Removing the media block leaves :root as the only definition of these.
    // If a later edit drops them the page loses its background entirely, which
    // is a different failure from dark mode coming back and is worth its own line.
    log("");
    log("the light values the switch used to override are still defined:");
    assert("--background is defined at :root", /--background:\s*#\w+/.test(css));
    assert("--foreground is defined at :root", /--foreground:\s*#\w+/.test(css));
    assert("and body still reads them", /background:\s*var\(--background\)/.test(css));
}

if (isMain(import.meta.url)) standalone(title, run);

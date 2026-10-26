// Every path CLAUDE.md names exists (#575).
//
// CLAUDE.md states the rules about the code as it stands and names the files that hold them: a
// module in the service layer list, the check that enforces a rule, the notes file to read first.
// A file that moves or goes leaves the rule pointing at nothing, and nothing fails when one does:
// #575 found the notes listing `lib/airtable/tools.js` among the lock's callers after #507 had
// deleted it, and naming scripts at the addresses #572 had moved them from.
//
// CLAUDE.md ALONE, AND THE NOTES ARE LEFT OUT ON A MEASUREMENT. CLAUDE.md carries no history by
// its own rule ("No phase, milestone or branch status, ever"), so every path in it is a present
// one: on the tree #575 began from, all 177 distinct paths in it resolved and none needed telling
// apart. The notes are where history goes. Of the 1,369 paths in them rooted at a top-level
// directory, 140 did not resolve, 101 of those in `tools.md` alone, and most are records — a
// script before #572 moved it into `ran/`, a module before #513 renamed it — true of the issue
// that wrote them. Holding the notes to this would mean marking each such record apart from a
// present path, by a convention none of those files uses, so it is not done; the present paths
// #575 met in the notes it read were corrected by hand.
//
// WHAT COUNTS AS A PATH. A span in backticks with no whitespace that is rooted at a top-level
// directory (`app/`, `lib/`, `scripts/`, `docs/`, `public/`, `components/`, `.github/`), a check
// named as CLAUDE.md names checks (`offline/x.mjs`, under `scripts/tests/`), or a notes file named
// bare (`naming.md`, under `docs/notes/`). A `path:name` names a binding as well, which has to
// appear in the file as a whole word. A span holding `*`, `{`, `<` or `…` is a pattern, not a path.
//
// WHAT IT CANNOT SEE. A bare file name — `Menu.js` after `app/components/Controls.js` — names no
// directory, so it is skipped rather than guessed at; a path written without backticks; and
// whether what a sentence says about a file that exists is true, which is every other kind of
// drift. A record naming a path that has gone fails here, and the place for a record is the notes.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { existsSync, readFileSync } from "node:fs";
import { repoPath } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every path CLAUDE.md names exists (#575)";

const ROOTED = /^(app|lib|scripts|docs|public|components|\.github)\//;
const PATTERN = /[*{<…]/;

/** Every span CLAUDE.md puts in backticks, in order. */
export function spansOf(text) {
    return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/** The repo path a span names and the binding it names in it, or null when it names no path. */
export function pathOf(span) {
    if (/\s/.test(span) || PATTERN.test(span)) return null;
    const [path, binding = null, ...rest] = span.split(":");
    if (rest.length > 0) return null;
    if (ROOTED.test(path)) return { span, path, binding };
    if (/^offline\/[\w.-]+\.mjs$/.test(path)) return { span, path: `scripts/tests/${path}`, binding };
    if (/^[a-z-]+\.md$/.test(path)) return { span, path: `docs/notes/${path}`, binding };
    return null;
}

/** What is wrong with each named path: a file that is not there, or a binding not in it. */
export function findingsOf(named, exists = (path) => existsSync(repoPath(path)), read = (path) => readFileSync(repoPath(path), "utf8")) {
    const findings = [];
    for (const { span, path, binding } of named) {
        if (!exists(path)) {
            findings.push(`${span}: no ${path}`);
            continue;
        }
        if (binding === null || path.endsWith("/")) continue;
        const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`(^|[^\\w$])${escaped}($|[^\\w$])`).test(read(path))) findings.push(`${span}: ${path} has no ${binding}`);
    }
    return findings;
}

export function run({ check, assert, log }) {
    const claude = readFileSync(repoPath("CLAUDE.md"), "utf8");
    const spans = spansOf(claude);
    const named = spans.map(pathOf).filter(Boolean);
    const unique = [...new Map(named.map((n) => [n.span, n])).values()];

    log(`${spans.length} spans in backticks; ${named.length} name a path, ${unique.length} distinct`);
    const kinds = {
        rooted: unique.filter((n) => ROOTED.test(n.span)).length,
        offline: unique.filter((n) => n.span.startsWith("offline/")).length,
        notes: unique.filter((n) => n.path.startsWith("docs/notes/") && !n.span.startsWith("docs/")).length,
        bindings: unique.filter((n) => n.binding !== null).length,
    };
    log(`  ${kinds.rooted} rooted, ${kinds.offline} checks by their short name, ${kinds.notes} notes files by name, ${kinds.bindings} naming a binding`);

    // ANTI-VACUITY. "Nothing is missing" is also what a parse that found nothing reports, so the
    // parse has to be seen to find each kind, and its count of one prefix is held against a
    // second count made without the span pattern at all.
    log("");
    log("anti-vacuity — the spans were really read:");
    for (const [kind, count] of Object.entries(kinds)) assert(`  CLAUDE.md names at least one path of the kind ${kind}`, count > 0);
    for (const known of ["lib/airtable/client.js", "offline/notes-index.mjs", "naming.md", "lib/poPdf.js:HYE_BUYER_NAME"]) {
        assert(`  the parse found ${known}`, unique.some((n) => n.span === known));
    }
    check("  every `lib/ in the text begins a span the parse read", spans.filter((s) => s.startsWith("lib/")).length, claude.split("`lib/").length - 1);

    log("");
    log("every path CLAUDE.md names exists, and every binding it names is in its file:");
    check("  findings", findingsOf(unique).join("; ") || "none", "none");

    // The predicates on planted spans, so a check that passes is one that could have failed.
    log("");
    log("anti-vacuity — the predicates on planted spans:");
    check("  a check by its short name is under scripts/tests/", pathOf("offline/x.mjs")?.path, "scripts/tests/offline/x.mjs");
    check("  a notes file by its name is under docs/notes/", pathOf("naming.md")?.path, "docs/notes/naming.md");
    check("  a binding is split off its path", JSON.stringify(pathOf("lib/ids.js:mintDailyIds")), JSON.stringify({ span: "lib/ids.js:mintDailyIds", path: "lib/ids.js", binding: "mintDailyIds" }));
    check("  a pattern is no path", pathOf("lib/airtable/{table}.js"), null);
    check("  a glob is no path", pathOf("scripts/tests/verify-*.mjs"), null);
    check("  a bare file name is no path", pathOf("Menu.js"), null);
    check("  a sentence is no path", pathOf("lib/ids.js and more"), null);
    check("  a path that is not there is found", findingsOf([pathOf("lib/airtable/tools.js")]).join("; "), "lib/airtable/tools.js: no lib/airtable/tools.js");
    check("  a binding that is not in its file is found", findingsOf([pathOf("lib/ids.js:upsertTool")]).join("; "), "lib/ids.js:upsertTool: lib/ids.js has no upsertTool");
    check("  a binding met only inside a longer word is found", findingsOf([pathOf("lib/ids.js:mintDaily")]).join("; "), "lib/ids.js:mintDaily: lib/ids.js has no mintDaily");
    check("  a binding in its file passes", findingsOf([pathOf("lib/ids.js:mintDailyIds")]).join("; "), "");
    check("  a directory passes", findingsOf([pathOf("app/(assets)/")]).join("; "), "");
}

if (isMain(import.meta.url)) standalone(title, run);

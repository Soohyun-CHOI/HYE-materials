// The CLAUDE.md / docs/notes split (no issue — branch `claude-md-split`).
//
// CLAUDE.md is loaded into every session before any work starts, so its size is a
// standing tax on every task. The reasoning behind each area moved to
// `docs/notes/`, and CLAUDE.md keeps an index binding each file to the source
// paths it governs. This check defends the two failure modes that split creates:
// an index row pointing at nothing, and a notes file nobody points at. Either one
// makes the reasoning unreachable, which is worse than leaving it inline — inline
// text is at least found by reading.
//
// IT ALSO ENFORCES THE CEILING, and that is the part that keeps this from being a
// one-off tidy-up. #211 alone added 8,798 bytes to CLAUDE.md; at that rate the
// split is undone in twenty-six issues. `Where new writing goes` states the
// routing rule, and this asserts the outcome.
//
// HOW BYTES ARE COUNTED: the file's size on disk, `statSync().size`, which is what
// `wc -c` reports and what a session actually loads. That includes CRLF line
// endings — this repo's working tree uses them, so a count that normalized to LF
// would read ~300 bytes lighter than the real file and the two numbers would drift
// apart. No normalization, no stripping.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { REPO_ROOT, repoPath, toPosix } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "CLAUDE.md index and the docs/notes split";

/** The ceiling, in bytes on disk. Raising this is not the fix — see the module note. */
const CLAUDE_MAX_BYTES = 55000;

/** Turn one index glob into a matcher. Only `**` and `*` are used in the index. */
function globToRegExp(glob) {
    let out = "";
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === "*" && glob[i + 1] === "*") {
            out += ".*";
            i++;
            if (glob[i + 1] === "/") i++;
        } else if (c === "*") {
            out += "[^/]*";
        } else if ("\\^$.|?+()[]{}".includes(c)) {
            out += "\\" + c;
        } else {
            out += c;
        }
    }
    return new RegExp("^" + out + "$");
}

/**
 * Every file under app/, lib/ and scripts/, POSIX-separated and repo-relative.
 *
 * EVERY file, not every `.js` — `listJsFiles` from _ast.mjs was the first version
 * of this and it reported `scripts/**` as matching nothing, because that tree is
 * `.mjs` and `.py`. A glob check whose corpus is narrower than the globs is a
 * false alarm generator, which trains people to ignore it.
 */
function repoPaths(dir = null, out = []) {
    if (dir === null) {
        for (const d of ["app", "lib", "scripts"]) repoPaths(repoPath(d), out);
        return out;
    }
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const abs = `${dir}/${e.name}`;
        if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name === "output") continue;
            repoPaths(abs, out);
        } else {
            out.push(toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
        }
    }
    return out;
}

export async function run({ check, log, assert }) {
    const claudeAbs = repoPath("CLAUDE.md");
    const claude = readFileSync(claudeAbs, "utf8");

    // --- the ceiling ------------------------------------------------------
    log("the size ceiling, counted as bytes on disk:");
    const bytes = statSync(claudeAbs).size;
    log(`  CLAUDE.md is ${bytes} bytes; the ceiling is ${CLAUDE_MAX_BYTES}`);
    assert(
        `CLAUDE.md is at or under ${CLAUDE_MAX_BYTES} bytes — if this fails, MOVE A SECTION to docs/notes/ rather than raising the number`,
        bytes <= CLAUDE_MAX_BYTES
    );

    // --- the index parses -------------------------------------------------
    log("");
    log("the index binds files to paths:");
    const rows = [];
    for (const line of claude.split("\n").map((l) => l.replace(/\r$/, ""))) {
        if (!line.startsWith("|") || line.startsWith("|---")) continue;
        const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length !== 2) continue;
        const notes = [...cells[1].matchAll(/docs\/notes\/([a-z-]+\.md)/g)].map((m) => m[1]);
        if (notes.length === 0) continue;
        const globs = [...cells[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
        rows.push({ globs, notes, raw: line });
    }
    // ANTI-VACUITY: two absences are also what a failed parse reports, so the
    // parse has to be seen to have found something before any "nothing is
    // missing" assertion below can mean anything.
    assert("the index was parsed and has rows", rows.length > 0);
    check("index rows found", rows.length > 0, true);

    // --- every notes file is reachable from the index ---------------------
    log("");
    log("every docs/notes file is reachable from the index:");
    const notesDir = repoPath("docs/notes");
    assert("docs/notes/ exists", existsSync(notesDir));
    const onDisk = readdirSync(notesDir).filter((f) => f.endsWith(".md")).sort();
    assert("docs/notes/ is not empty", onDisk.length > 0);

    const inTable = new Set(rows.flatMap((r) => r.notes));
    const anywhere = new Set(inTable);
    for (const m of claude.matchAll(/docs\/notes\/([a-z-]+\.md)/g)) anywhere.add(m[1]);

    const orphans = onDisk.filter((f) => !anywhere.has(f));
    check("no notes file nobody points at", orphans.length === 0 ? "none" : orphans.join(", "), "none");

    // STRICTER, AND THE TABLE IS WHY: a prose mention is found by someone already
    // reading CLAUDE.md top to bottom, which is exactly what this split stops
    // anyone from doing. The table is the only thing consulted by path, so a file
    // bound to source paths has to be IN IT, not merely mentioned near it.
    // `backlog.md` is the one exception and is named here rather than inferred —
    // it is read when picking work up, not when editing a path.
    const PROSE_ONLY = new Set(["backlog.md"]);
    const notIndexed = onDisk.filter((f) => !inTable.has(f) && !PROSE_ONLY.has(f));
    check(
        "every path-bound notes file is in the index table",
        notIndexed.length === 0 ? "none" : notIndexed.join(", "),
        "none"
    );

    const dangling = [...anywhere].filter((f) => !onDisk.includes(f));
    check("no index entry pointing at a missing file", dangling.length === 0 ? "none" : dangling.join(", "), "none");

    // --- every glob matches at least one real path ------------------------
    log("");
    log("every glob in the index matches a real path:");
    const paths = repoPaths();
    assert("the repo walk found paths at all", paths.length > 0);
    const empty = [];
    for (const row of rows) {
        for (const g of row.globs) {
            // A row's left cell may name an activity rather than a path; those
            // carry no slash and no star and are not globs.
            if (!g.includes("/") && !g.includes("*")) continue;
            const re = globToRegExp(g);
            if (!paths.some((p) => re.test(p))) empty.push(g);
        }
    }
    check("no glob matching nothing", empty.length === 0 ? "none" : empty.join(", "), "none");

    // --- the @ import that would undo the split ---------------------------
    log("");
    log("nothing is pulled back in at session start:");
    // An `@path` reference is loaded eagerly by Claude Code, which would restore
    // the whole cost this split exists to remove.
    const atImports = [...claude.matchAll(/(^|\s)@(docs|lib|app|scripts)\//g)].map((m) => m[0].trim());
    check(
        "CLAUDE.md uses no @path import syntax",
        atImports.length === 0 ? "none" : atImports.join(", "),
        "none"
    );

    // --- anti-vacuity, stated as its own group ---------------------------
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // Each assertion above is of the form "no X". A broken parse, a wrong
    // directory or a bad glob compiler reports exactly that, so each mechanism
    // is proved to work on a case where the answer is known.
    assert("the glob compiler matches a path that exists", globToRegExp("lib/**").test("lib/ids.js"));
    assert("  and rejects one that does not", !globToRegExp("lib/**").test("app/page.js"));
    assert("the notes directory listing found files", onDisk.length >= 5);
    assert("the index table references at least one file per notes file bar the backlog", inTable.size >= onDisk.length - 1);
}

if (isMain(import.meta.url)) await standalone(title, run);

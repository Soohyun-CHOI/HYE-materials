// What code a credentialed run covered (#172).
//
// A `verify-*.mjs` run prints its findings and nothing about the tree it ran
// against, so a result pasted into a pull request or kept in a terminal cannot be
// tied to a commit afterwards — establishing which code a past run covered means
// running it again, at hundreds of Airtable operations. Every script in this tier
// opens with this header, including the two that deliberately compute no verdict:
// provenance is about which code ran, not about whether it passed.
//
// SEVEN SCRIPTS CARRIED THEIR OWN COPY AND THEY HAD DIVERGED THREE WAYS. Four
// returned `{ dirty: boolean, dirtyCount: number }` and rendered the count; two
// returned `{ dirty: number }` and rendered that; and `verify-deliveries-162.mjs`
// held the first shape while rendering `${git.dirty && git.dirtyCount}`, which
// produced the right number only because `true && 3` is 3. This module keeps ONE
// count and no boolean, which is what removes that class of bug: a second field
// derived from the first is a second thing to keep in step.
//
// ── ONE SUBPROCESS, THREE FACTS ─────────────────────────────────────────────
//
// `git status --porcelain=v2 --branch` answers the commit, the branch and the
// dirty entries together, where the copies it replaces called `rev-parse HEAD`
// and `status --porcelain` separately. The branch is new here and is provenance
// too: a run on a branch is a run against work that may never have merged.
//
// ── WHAT "DIRTY" COUNTS, AND WHY IGNORED FILES ARE NOT IN IT ────────────────
//
// `--porcelain` reports modified tracked files and untracked files that are not
// gitignored. Both belong: a new module under `lib/`, or a new script in this
// directory, changes what ran and the commit does not name it.
//
// TURNING ON `--ignored` WOULD DESTROY THE SIGNAL RATHER THAN SHARPEN IT, and
// that is measured rather than argued. This tier cannot run at all without
// `.env.local`, which is gitignored — so with ignored files counted, every
// credentialed run would report DIRTY and the word would stop meaning anything.
// The same exclusion is what keeps a run from being marked dirty for writing its
// own `.airtable-ops.jsonl` ledger, or for the author having drafted
// `commit-msg.txt` and `pr-body.md` beside it. On a clean checkout of this
// repository `git status --porcelain` returns zero lines while fourteen ignored
// entries sit at the root, which is the whole of why the default is right.
//
// ── THE COLLAPSE, AND THE SENTENCE IT REPLACES ──────────────────────────────
//
// Every copy this module replaces printed `N uncommitted file(s)`, and that was
// FALSE whenever an untracked directory was present: git reports one entry for
// the directory rather than one per file inside it, so three new files under one
// new directory were announced as "1 uncommitted file". Measured, not reasoned
// about.
//
// The collapse is git's and does not change, so what changes is the reading. The
// count is of ENTRIES, the entries themselves are listed rather than summarized,
// and an untracked directory says on its own line that it stands for contents
// git did not enumerate. Listing them is the stronger form anyway: a number
// nobody can audit becomes the actual paths, which is what a reader of a pasted
// run wants. Walking the directory to recover a file count is deliberately NOT
// done — that would be a second answer to a question git has already answered,
// with its own ignore rules to drift (#195's lesson, one level down).
//
// IT ASKS ABOUT ITS OWN LOCATION RATHER THAN ABOUT THE WORKING DIRECTORY, which
// is what makes the answer the code that ran: `REPO_ROOT` is resolved from this
// module's URL, so a script started from anywhere reports the repository the
// module was imported out of. Measured by running a caller from a different
// directory and getting this repository's commit back.
//
// ── WITH NO GIT, OR OUTSIDE A CHECKOUT ──────────────────────────────────────
//
// Neither of two failures is acceptable: throwing would make a missing `git`
// stop a run that has nothing to do with git, and printing nothing would let a
// run with no provenance look exactly like a run with good provenance. So both
// fields print UNKNOWN in capitals with the cost spelled out beside them, and
// the exit code is untouched — the header is provenance and never a verdict.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const RULE = "=".repeat(72);

/**
 * The commit, the branch and the dirty entries, or an `error` when git could not
 * answer. `dirtyEntries` is the list; there is no separate boolean and no
 * separate count, because both are readable off the array.
 */
export function gitProvenance() {
    try {
        const out = execFileSync("git", ["status", "--porcelain=v2", "--branch"], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            maxBuffer: 1 << 26,
        });
        return parseStatus(out);
    } catch (err) {
        return { commit: null, branch: null, dirtyEntries: null, error: String(err?.message ?? err) };
    }
}

/**
 * Pull the three facts out of `--porcelain=v2 --branch`.
 *
 * Header lines are `# branch.oid <sha>` and `# branch.head <name>`, where the
 * name is the literal `(detached)` on a detached HEAD. Entry lines carry the
 * path at a per-kind offset: `1` and `u` are ordinary and unmerged changes,
 * `2` is a rename whose line holds the new path and then a tab and the old one,
 * and `?` is untracked, where the rest of the line IS the path. The offsets are
 * git's documented field order rather than a guess, and the path is left exactly
 * as git printed it — including the C-quoting it applies to an unusual name,
 * which is unambiguous and is not this module's to undo.
 */
function parseStatus(out) {
    let commit = null;
    let branch = null;
    const dirtyEntries = [];

    for (const raw of out.split("\n")) {
        const info = raw.trimEnd();
        if (!info) continue;

        if (info.startsWith("# branch.oid ")) {
            commit = info.slice("# branch.oid ".length);
            continue;
        }
        if (info.startsWith("# branch.head ")) {
            branch = info.slice("# branch.head ".length);
            continue;
        }
        if (info.startsWith("#")) continue;

        const kind = info[0];
        if (kind === "?") {
            dirtyEntries.push({ code: "??", path: info.slice(2) });
        } else if (kind === "1" || kind === "u") {
            const fields = info.split(" ");
            const skip = kind === "1" ? 8 : 10;
            dirtyEntries.push({ code: fields[1], path: fields.slice(skip).join(" ") });
        } else if (kind === "2") {
            const fields = info.split(" ");
            dirtyEntries.push({ code: fields[1], path: fields.slice(9).join(" ").split("\t")[0] });
        }
    }

    return { commit, branch, dirtyEntries, error: null };
}

/** At most this many entries are listed before the rest are counted. */
const MAX_LISTED = 10;

/**
 * Print the run's provenance box and return the facts, so a caller that wants to
 * say something else about them can.
 *
 * `title` is the script's own one-line subject. `extra` is any further rows it
 * owns — `verify-airtable-ops-190.mjs` pins an Airtable client version, which is
 * a fact about that run and not about provenance, so it rides here rather than
 * being pushed into this module.
 */
export function printProvenance({ title, extra = [] } = {}) {
    const git = gitProvenance();

    console.log(RULE);
    if (title) console.log(title);

    if (git.error !== null) {
        console.log("commit    UNKNOWN — git did not answer here");
        console.log(`tree      UNKNOWN — this run cannot be tied to a tree (${git.error})`);
    } else {
        const where = git.branch ? `  (${git.branch})` : "";
        console.log(`commit    ${git.commit ?? "UNKNOWN"}${where}`);

        const entries = git.dirtyEntries;
        if (entries.length === 0) {
            console.log("tree      clean — the commit above identifies exactly what ran");
        } else {
            console.log(
                `tree      DIRTY — ${entries.length} ${entries.length === 1 ? "entry" : "entries"}; ` +
                    "the commit above does not identify what ran"
            );
            for (const { code, path } of entries.slice(0, MAX_LISTED)) {
                // An untracked path ending in a separator is a DIRECTORY git
                // collapsed, and saying so is the correction this header exists
                // to carry: the copies it replaces called this one "file".
                const collapsed = code === "??" && path.endsWith("/");
                const note = collapsed ? "   (directory — git lists it as one entry, not its contents)" : "";
                console.log(`            ${code.padEnd(2)}  ${path}${note}`);
            }
            if (entries.length > MAX_LISTED) {
                console.log(`            … and ${entries.length - MAX_LISTED} more`);
            }
        }
    }

    for (const row of extra) console.log(row);
    console.log(`ran at    ${new Date().toISOString()}`);
    console.log(RULE);

    return git;
}

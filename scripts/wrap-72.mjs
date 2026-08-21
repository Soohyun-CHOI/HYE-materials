// The 72-char wrap rule, executable (#210).
//
// CLAUDE.md's Git workflow rules say commit bodies and PR descriptions wrap at 72
// characters, table rows and fenced blocks included, and NEVER inside a backtick
// span. That rule was stated in prose and broken four times in one PR body, because
// it is read at one moment and applied at another: wrapping is mechanical, so a
// prose rule cannot catch a mechanical slip. This is the rule as a function.
//
// A BACKTICK SPAN IS ONE UNBREAKABLE TOKEN, and that is the whole of what a plain
// 72-char wrapper gets wrong. A broken span renders as literal backticks instead of
// code, so the text on GitHub is wrong rather than untidy. Tracked on backtick
// PARITY rather than matched with a regex, so a span holding spaces, quotes, a
// colon or a full stop stays whole — every one of the four that broke did.
//
// PATCHING ONE LONG LINE IS THE OTHER WAY IT GOES WRONG. Splitting a single line
// pushes the overflow onto the next one, which then needs splitting, and so on; the
// unit of wrapping has to be the whole paragraph. That is why this reflows blocks
// rather than lines.
//
// A SPAN CAN BE TOO LONG TO BE INLINE AT ALL. `Mismatch: this invoice charges more
// than the delivery it names delivered.` is 73 characters with its backticks and 71
// without, so no wrapping saves it — it has to move to a fenced block. This cannot
// do that rewrite (where the fence goes is a judgment about the prose), so it
// REPORTS the span and leaves the line long, which is the honest failure.
//
// WHAT IT NEVER TOUCHES, because wrapping them would break them: fenced content,
// table rows, headings, and a commit message's subject line. Those are checked and
// reported instead — the rule counts them toward 72 but nothing may reflow them.
//
// Plain node, no dependencies, no credentials, no network — a dev tool rather than a
// check, which is why it sits at the top of scripts/ beside esm-ext-loader.mjs
// rather than in either test tier. `wrapText` and `findViolations` are exported so a
// standing offline check can pin them without a second copy of the rule; until one
// exists, `--check` is what a hook or a hand run calls.
//
//   node scripts/wrap-72.mjs commit-msg.txt          # rewrite in place
//   node scripts/wrap-72.mjs pr-body.md --check      # report only, exit 1 if bad
//   node scripts/wrap-72.mjs --self-test             # prove it can fail

import { openSync, ftruncateSync, writeSync, closeSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const WIDTH = 72;

/** Character count, not byte count — an em dash is one column, not three. */
const width = (s) => [...s].length;

const isFence = (l) => l.trim().startsWith("```");
const isHeading = (l) => l.startsWith("#");
const isTableRow = (l) => l.trim().startsWith("|");
const isListItem = (l) => /^\s*[-*] /.test(l);

/**
 * Split text into wrapping tokens, where a backtick span is ONE token.
 *
 * Walks on parity: a word carrying an odd number of backticks flips whether we are
 * inside a span, and while inside, words are appended to the token already open.
 * A regex over `` `...` `` would miss an unclosed span, which is exactly the state a
 * broken line leaves behind.
 */
export function tokenize(text) {
    const out = [];
    let open = false;
    for (const w of text.split(/\s+/).filter(Boolean)) {
        if (open) out[out.length - 1] += " " + w;
        else out.push(w);
        if ((w.match(/`/g) || []).length % 2 === 1) open = !open;
    }
    return out;
}

/**
 * Wrap one paragraph's worth of text to `max` columns, keeping spans whole.
 *
 * `first` and `hanging` are the prefixes for the first line and the rest, which is
 * how a list item keeps its `- ` marker and gains a two-space continuation.
 *
 * A token wider than the budget goes on a line of its own rather than being split.
 * That line is then over-long, and findViolations is what says so — silently
 * breaking the span would be the one thing this exists to prevent.
 */
export function wrapText(text, { max = WIDTH, first = "", hanging = "" } = {}) {
    const lines = [];
    let cur = first;
    let empty = true;
    for (const token of tokenize(text)) {
        const candidate = empty ? cur + token : cur + " " + token;
        if (!empty && width(candidate) > max) {
            lines.push(cur);
            cur = hanging + token;
        } else {
            cur = candidate;
            empty = false;
        }
    }
    if (!empty) lines.push(cur);
    return lines;
}

/**
 * Reflow a whole document.
 *
 * `subjectFirst` leaves line 1 alone — a commit message's subject is one line by
 * definition, so wrapping it would produce a body line masquerading as a subject.
 * The caller passes it for commit-msg.txt and not for a PR description, whose first
 * line is `Closes #N`.
 */
export function wrapDocument(source, { max = WIDTH, subjectFirst = false } = {}) {
    const lines = source.split("\n");
    const out = [];
    let i = 0;
    let inFence = false;

    if (subjectFirst && lines.length > 0) {
        out.push(lines[0]);
        i = 1;
    }

    while (i < lines.length) {
        const line = lines[i];

        if (isFence(line)) {
            inFence = !inFence;
            out.push(line);
            i++;
            continue;
        }
        // Fenced content, blank lines, headings and table rows are passed through:
        // the rule counts them toward 72 but nothing may reflow them.
        if (inFence || line.trim() === "" || isHeading(line) || isTableRow(line)) {
            out.push(line);
            i++;
            continue;
        }

        if (isListItem(line)) {
            const marker = line.match(/^(\s*[-*] )/)[1];
            const body = [line.slice(marker.length)];
            i++;
            // Continuation lines of one item are indented and are not themselves
            // items; a blank line or a new marker ends it.
            while (i < lines.length && /^\s\s+\S/.test(lines[i]) && !isListItem(lines[i])) {
                body.push(lines[i].trim());
                i++;
            }
            out.push(
                ...wrapText(body.join(" "), {
                    max,
                    first: marker,
                    hanging: " ".repeat(width(marker)),
                })
            );
            continue;
        }

        // A paragraph: every following line that is not one of the shapes above.
        const block = [line];
        i++;
        while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            !isFence(lines[i]) &&
            !isHeading(lines[i]) &&
            !isTableRow(lines[i]) &&
            !isListItem(lines[i])
        ) {
            block.push(lines[i]);
            i++;
        }
        out.push(...wrapText(block.join(" "), { max }));
    }

    return out.join("\n");
}

/**
 * Every place the document still breaks the rule, as one entry per line.
 *
 * TWO KINDS, and both have to be reported rather than fixed. An over-long line the
 * wrapper could not shorten holds a token wider than the budget — a long span, a URL
 * or a table cell. A broken span is one whose backticks do not close on their own
 * line, which after a wrap can only mean the source had an unclosed backtick.
 */
export function findViolations(source, { max = WIDTH } = {}) {
    const lines = source.split("\n");
    const problems = [];
    let inFence = false;
    lines.forEach((line, index) => {
        const n = index + 1;
        if (isFence(line)) {
            inFence = !inFence;
        } else if (!inFence && (line.match(/`/g) || []).length % 2 === 1) {
            problems.push({ line: n, kind: "broken-span", text: line });
        }
        if (width(line) > max) {
            problems.push({ line: n, kind: "too-long", columns: width(line), text: line });
        }
    });
    return problems;
}

/**
 * Rewrite a file in place: truncate and refill the SAME file, never unlink it.
 * The PR-body workflow depends on that — see the note in CLAUDE.md's Git workflow
 * rules about pr-body.md.
 */
function rewriteInPlace(path, text) {
    const fd = openSync(path, "r+");
    try {
        ftruncateSync(fd, 0);
        writeSync(fd, text, 0, "utf8");
    } finally {
        closeSync(fd);
    }
}

/**
 * Fixtures that prove the wrapper does the two things it exists for, and that its
 * reporter can say no. Kept in the tool rather than in a test file so `--self-test`
 * works from a clean checkout; a standing offline check would import the exports
 * above and pin the same cases.
 */
const SELF_TEST = [
    {
        name: "a backtick span is not split",
        input:
            "The extractor took the `Deliveries` and `Delivery Items` bullets both " +
            "inside the section that quoted them.",
        expect: (out) => findViolations(out).length === 0 && out.includes("`Delivery Items`"),
    },
    {
        name: "a span holding a full stop and spaces stays whole",
        input:
            "Its accessible name is `Mismatch: this invoice charges more than it " +
            "names.` and the chip is `Delivered`.",
        expect: (out) =>
            out.includes("`Mismatch: this invoice charges more than it names.`") &&
            !findViolations(out).some((p) => p.kind === "broken-span"),
    },
    {
        name: "a span too wide to be inline is reported, never broken",
        input:
            "The name is `Mismatch: this invoice charges more than the delivery it " +
            "names delivered.` exactly.",
        expect: (out) =>
            findViolations(out).some((p) => p.kind === "too-long") &&
            !findViolations(out).some((p) => p.kind === "broken-span"),
    },
    {
        name: "a table row is passed through, not reflowed",
        input: "| Check | Result |\n|---|---|\n| `npm test` | 1463 pass, 26 files |",
        expect: (out) => out.split("\n").length === 3 && out.startsWith("| Check | Result |"),
    },
    {
        name: "fenced content is passed through",
        input: "```\nMismatch: this invoice charges more than the delivery it names.\n```",
        expect: (out) => out.split("\n").length === 3,
    },
    {
        name: "a list item keeps its marker and gains a hanging indent",
        input:
            "- The delivery axis as a quantity comparison per ordered item, which " +
            "is what the invoices naming this delivery charge.",
        expect: (out) => out.startsWith("- ") && out.split("\n")[1].startsWith("  "),
    },
    {
        name: "the reporter can say no — an unclosed span is caught",
        input: "This has `an unclosed span",
        expect: (out) => findViolations(out).some((p) => p.kind === "broken-span"),
    },
];

function selfTest() {
    let pass = true;
    for (const t of SELF_TEST) {
        const out = wrapDocument(t.input);
        const ok = t.expect(out);
        if (!ok) pass = false;
        console.log(`  ${ok ? "PASS" : "FAIL"}  ${t.name}`);
        if (!ok) console.log(`        got:\n${out}`);
    }
    console.log(pass ? "\nOK — the wrapper does what it claims" : "\nSELF-TEST FAILED");
    return pass ? 0 : 1;
}

function main(argv) {
    const args = argv.slice(2);
    if (args.includes("--self-test")) return selfTest();

    const checkOnly = args.includes("--check");
    const paths = args.filter((a) => !a.startsWith("--"));
    if (paths.length === 0) {
        console.error(
            "usage: node scripts/wrap-72.mjs <file>... [--check]\n" +
                "       node scripts/wrap-72.mjs --self-test"
        );
        return 2;
    }

    let bad = 0;
    for (const path of paths) {
        const source = readFileSync(path, "utf8");
        // A commit message's first line is its subject and cannot be wrapped.
        const wrapped = wrapDocument(source, { subjectFirst: /commit-msg/.test(path) });
        const problems = findViolations(wrapped);

        if (!checkOnly && wrapped !== source) rewriteInPlace(path, wrapped);
        const verb = checkOnly ? "would rewrap" : "rewrapped";
        const changed = wrapped === source ? "unchanged" : verb;
        console.log(`${path}: ${changed}, ${problems.length} problem(s)`);

        for (const p of problems) {
            bad++;
            if (p.kind === "broken-span") {
                console.log(`  line ${p.line}: backtick span left open — ${p.text.trim()}`);
            } else {
                console.log(
                    `  line ${p.line}: ${p.columns} columns — a token is wider than ` +
                        `${WIDTH}, so move it to a fenced block`
                );
            }
        }
    }
    return bad > 0 ? 1 : 0;
}

// Exit codes follow the repo's convention: 0 all clear, 1 something failed, 2 a
// part could not run (here: no file to work on).
//
// RESOLVED PATHS RATHER THAN A STRING COMPARE, which is _harness.mjs:isMain's own
// shape and the reason it exists: on Windows `import.meta.url` is
// `file:///C:/...` with three slashes while a hand-built `file://` + argv[1] has
// two, so the naive compare is false and the tool silently does nothing. Copied
// rather than imported, because a dev tool must not depend on the test tier.
const isMain =
    Boolean(process.argv[1]) &&
    resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(main(process.argv));

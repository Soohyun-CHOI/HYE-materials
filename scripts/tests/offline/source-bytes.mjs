// A tracked file has to stay greppable (#231, widened in #195).
//
// WHY THIS IS WORTH A CHECK, and the answer is the failure mode rather than the
// frequency. `grep` decides a file is BINARY when it finds a NUL byte in it, and
// a binary file is skipped with no message unless someone passed `-a`. So one
// invisible byte does not corrupt the file, break the build, fail eslint, or
// change what the module does — it removes the file from every repository-wide
// search, silently and completely. Nothing else in this tier notices: every
// offline check reads with `readFileSync`, which is indifferent to NULs.
//
// IT HAPPENED TWICE, WHICH IS WHY THE COST IS KNOWN RATHER THAN IMAGINED.
// `lib/deliveryInvoiceMatch.js` carried one inside a template literal — a sort
// key's separator, where a NUL is functionally the BETTER character, since it
// orders below every printable one. The module was then missing from a
// repository-wide count of a word it uses thirty-two times, and the count came
// back looking complete. The separator is a space now and says why in its own
// comment. `lib/airtableOps.js` was the first: one commit with its store's key
// separator written as a literal byte. It is an escape sequence there now, and
// `docs/notes/airtable-access.md` carries that incident rather than this file,
// because what it threatens is the field-rename procedure — "rename, then grep
// the old name and fix every hit" holds only if grep can see every file.
//
// ---------------------------------------------------------------------------
// #195 REPLACED THE SCOPE WITH A PROPERTY, AND THE SCOPE WAS HIDING LIVE SOURCE
//
// This walked `app`, `lib`, `scripts`, `docs` for `.js|.jsx|.mjs|.md|.py`, and
// its header argued that scoping by extension is what kept the exemption list
// empty — binary assets excluded by not being those. That was true and it was
// not free. Measured: 24 of 415 tracked files sat outside it, and they are not
// all assets. `CLAUDE.md` is at the repo ROOT, so the file every session loads
// first was never scanned. Neither was `.github/workflows/checks.yml`, which
// defines CI. Neither was `components/ConfirmDialog.js` — a `.js` file in a
// directory that was simply not on the list, where a NUL would have been
// invisible to this check and to every grep at once.
//
// So the scope is gone and the subject is every tracked file. What replaces the
// extension list has no list and no threshold in it:
//
//   a NUL-bearing file is TEXT if it carries a UTF-16/UTF-32 BOM, or if its
//   bytes decode as strict UTF-8; otherwise it is a genuine binary and passes.
//
// A NUL is a valid UTF-8 code point, which is what makes the second clause work:
// source that has gone binary by accident still decodes cleanly, while a real
// `.ico` or `.ttf` is full of byte sequences that are not valid UTF-8. Measured
// on every NUL-bearing tracked file plus the synthetic accident:
//
//   app/favicon.ico            00 00 01 00   no BOM   invalid UTF-8   binary
//   assets/fonts/*.ttf         00 01 00 00   no BOM   invalid UTF-8   binary
//   scripts/import/req*.txt    ff fe 23 00   utf-16le                 text
//   a .js with a stray NUL     (source)      no BOM   VALID UTF-8     text
//
// GIT'S OWN VERDICT WAS THE NON-OBVIOUS ALTERNATIVE AND IT DOES NOT WORK.
// `git diff --numstat` reports `-` for all three real files above, so it calls
// the accident and the two binaries the same thing. Git samples the first 8000
// bytes; ripgrep quits at a NUL wherever it sits — measured on two synthetic
// files, one at byte 9453 diffing as 162 lines of text and one at byte 13
// diffing as `-`. That gap is exactly why `lib/airtableOps.js` looked fine in a
// diff while grep found nothing in it.
//
// WHAT IT CANNOT SEE: a genuine binary whose bytes happen to be valid UTF-8
// would be reported as text. That is the safe direction — it costs somebody a
// look, where the reverse is a file silently outside every sweep.
// ---------------------------------------------------------------------------
// "GREP" IS THREE TOOLS, THEY DO NOT AGREE, AND NO ONE OF THEM IS SAFE FOR BOTH
// FAILURE MODES. That is the reason this check defers to none of them.
//
// Measured on one real file (`components/ConfirmDialog.js`) put into each state
// in turn, searching for a word it contains:
//
//                    a raw NUL, no BOM          stored as UTF-16LE + BOM
//   ripgrep 14.1.1   traversal prints NOTHING   finds it, with the line
//                    (explicit path: "binary
//                    file matches", no line)
//   GNU grep 3.0     "Binary file ... matches"  finds nothing at all
//   git grep         "Binary file ... matches"  finds nothing at all
//
// So the blindness is not nested, it is CROSSED. ripgrep is the only one that
// reads a BOM'd file — it transcodes to UTF-8 before binary detection, so the
// NULs are gone before anything looks — and it is also the only one that loses a
// stray-NUL file completely rather than naming it. A sweep is a traversal, which
// is ripgrep's silent case; and a sweep that pipes matches into a fixer gets no
// line from any of the three in the left-hand column.
//
// A file in either state is therefore visible-or-not BY TOOL CHOICE, which is
// worse than uniformly invisible: the rename procedure's safety argument would
// rest on which grep somebody happened to reach for, and nothing records that.
// Deferring to ripgrep's verdict would have let `scripts/import/requirements.txt`
// pass — the state this file's own header used to record as legitimate.
//
// ONLY THE NUL, DELIBERATELY. It is the byte with the tooling consequence; a ban
// on control characters generally would have to excuse tab, newline and carriage
// return on the first file it read, which is the shape this header declines.
//
// THIS FILE SPELLS NO NUL, in an escape sequence or otherwise — every one below
// is a numeric byte, and the separator `trackedFiles` splits on is built with
// `String.fromCharCode`. A check that hunts for grep-invisible files must not
// become one, and that is not hypothetical here: #195's drafts spelled the
// escape inside a string literal, the editor that wrote them emitted the byte
// itself, and this check caught its own replacement twice before it was right.
// ---------------------------------------------------------------------------
// WHY IT ASKS GIT FOR THE FILE LIST
//
// The first check in this tier to run a subprocess, which is worth a sentence
// rather than a silent precedent. The subject is exactly "the files the
// repository has", and a walk written here would be a SECOND answer to that,
// with its own ignore rules and its own drift — which is the defect one level
// up: #187 found `npx eslint .` linting two vendored files under a gitignored
// `.venv`, because a flat config does not read `.gitignore`. The walk this file
// used to do had the same shape and the measurement above is what it cost.
//
// The tier boundary is untouched: `git ls-files` needs no credentials, no
// network and no environment variable, and an empty answer is caught by the
// anti-vacuity assertions rather than read as a clean tree.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every tracked file is text `grep` will read (#231/#195)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// The byte itself, built numerically so this file never contains one.
const NUL = String.fromCharCode(0);

// Text stored in an encoding that writes a NUL beside most characters. UTF-32LE
// is listed before UTF-16LE on purpose: both open `FF FE`, so the longer
// signature has to be tested first or every UTF-32LE file reads as UTF-16LE.
const TEXT_BOMS = [
    { name: "utf-32le", bytes: [0xff, 0xfe, 0x00, 0x00] },
    { name: "utf-32be", bytes: [0x00, 0x00, 0xfe, 0xff] },
    { name: "utf-16le", bytes: [0xff, 0xfe] },
    { name: "utf-16be", bytes: [0xfe, 0xff] },
];

/**
 * Where the first NUL is, or -1. A Buffer rather than a string, because reading
 * as utf8 first would be asking the thing under test to describe itself.
 */
export function firstNulByte(buffer) {
    return buffer.indexOf(0);
}

/**
 * What a grep would make of these bytes.
 *
 * "greppable" — no NUL, nothing to decide.
 * "text"      — carries a NUL and is text anyway, so a sweep would miss it.
 * "binary"    — carries a NUL and is not text; no sweep wants its contents.
 *
 * A pure function over a buffer, which is what lets the assertions below feed it
 * bytes written beside the claim rather than plant files in the tree.
 */
export function classify(buffer) {
    const at = firstNulByte(buffer);
    if (at === -1) return { verdict: "greppable", at };

    const bom = TEXT_BOMS.find((b) => b.bytes.every((v, i) => buffer[i] === v));
    if (bom) {
        return { verdict: "text", at, why: `stored as ${bom.name}, which writes a NUL beside most characters` };
    }

    try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return { verdict: "binary", at };
    }
    return { verdict: "text", at, why: `valid UTF-8 carrying a raw NUL byte at byte ${at}` };
}

/** Every path `git ls-files` reports, NUL-separated so a space cannot split one. */
function trackedFiles() {
    const out = execFileSync("git", ["ls-files", "-z"], {
        cwd: REPO_ROOT,
        maxBuffer: 1 << 28,
        encoding: "buffer",
    });
    return out.toString("utf8").split(NUL).filter(Boolean);
}

/** A second, independent enumeration: .js files under one directory, by readdir. */
function walkJs(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkJs(full, out);
        else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
}

export function run({ check, assert, log }) {
    // ── anti-vacuity, on bytes written here rather than on files ────────────
    // "No file holds a NUL" and "no file was read" print the same result, and
    // with a discriminator in the way there is a second thing to prove: that a
    // genuine binary PASSES, or the check is the old absolute wearing a costume.
    log("anti-vacuity — the detector answers both ways, and the discriminator both ways:");
    check("it finds a planted NUL", firstNulByte(Buffer.from([0x61, 0x00, 0x62])), 1);
    check("and reports -1 for ordinary text", firstNulByte(Buffer.from("const a = 1;\n")), -1);

    check("ordinary source is greppable", classify(Buffer.from("const FIELD = \"Job\";\n")).verdict, "greppable");

    // The lib/airtableOps.js accident: valid UTF-8, no BOM, one raw byte.
    const strayNul = Buffer.concat([
        Buffer.from("const SEP = \""),
        Buffer.from([0x00]),
        Buffer.from("\";\nconst FIELD = \"Delivery Address Used\";\n"),
    ]);
    check("UTF-8 source carrying a raw NUL is text, not binary", classify(strayNul).verdict, "text");

    // The requirements.txt accident: a BOM and a NUL beside every ASCII byte.
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("requests==2.34.2\r\n", "utf16le")]);
    check("UTF-16LE text is text, not binary", classify(utf16).verdict, "text");

    // THE HALF THE OLD SCOPE GOT FOR FREE AND THIS ONE HAS TO EARN. These are
    // the opening bytes of the two real binaries this repo tracks, each followed
    // by a sequence that is not valid UTF-8 (0xC3 opens a two-byte sequence and
    // 0x28 cannot continue one; 0xF8 is never a valid lead byte).
    const ico = Buffer.from([0x00, 0x00, 0x01, 0x00, 0xc3, 0x28, 0xa0, 0xa1]);
    check("an .ico's bytes are binary", classify(ico).verdict, "binary");
    const ttf = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xf8, 0xa1, 0xa1, 0xa1]);
    check("a .ttf's bytes are binary", classify(ttf).verdict, "binary");
    // Both carry their NUL at byte 0, which is also where a UTF-32BE BOM starts,
    // so the two questions are seen to be separate rather than one test twice.
    assert("a NUL at byte 0 does not by itself mean text", classify(ico).verdict !== "text");

    // ── the tree ────────────────────────────────────────────────────────────
    log("");
    log("no tracked file is text a grep would skip:");

    const tracked = trackedFiles();
    const withNul = [];
    const offenders = [];
    let unreadable = 0;

    for (const rel of tracked) {
        let buffer;
        try {
            buffer = readFileSync(join(REPO_ROOT, rel));
        } catch {
            // A path in the index with nothing on disk — a staged deletion. Not
            // this check's subject, but counted so it cannot hide the tree.
            unreadable++;
            continue;
        }
        const { verdict, why } = classify(buffer);
        if (verdict === "greppable") continue;
        withNul.push({ rel, verdict });
        if (verdict === "text") offenders.push({ rel, why });
    }

    log(`  ${tracked.length} tracked files, ${withNul.length} carrying a NUL, ${unreadable} not on disk`);
    for (const { rel, verdict } of withNul) log(`    ${verdict.padEnd(9)} ${rel}`);

    for (const { rel, why } of offenders) {
        assert(`  ${rel} — ${why}. Re-encode it as UTF-8, or write the byte as an escape sequence`, false);
    }
    check("files a grep would read as binary", offenders.length, 0);

    // ── the enumeration itself ──────────────────────────────────────────────
    // `git ls-files` returning nothing reports exactly what a clean tree
    // reports, and a count above zero is not enough: #224's rule is that a
    // second path to the same number has to be a SECOND PATH. So the .js files
    // under app/ and lib/ are walked with readdir and required to be in git's
    // answer — two enumerations, one agreement.
    log("");
    log("anti-vacuity — the enumeration is seen to have found the tree:");
    assert(`git ls-files returned a non-trivial tree (${tracked.length})`, tracked.length > 100);

    const trackedSet = new Set(tracked.map((p) => p.split("/").join(sep)));
    const walked = [...walkJs(join(REPO_ROOT, "app")), ...walkJs(join(REPO_ROOT, "lib"))].map((p) =>
        relative(REPO_ROOT, p)
    );
    assert(`the readdir walk found .js files of its own (${walked.length})`, walked.length > 50);
    const missing = walked.filter((p) => !trackedSet.has(p));
    check("and every one of them is in git's answer", missing.length, 0);
    for (const m of missing.slice(0, 5)) log(`    not tracked: ${m}`);

    // The module that carried the second incident is in the set, or this check
    // would have passed on the day the byte went in.
    assert(
        "the file that carried one is in scope",
        tracked.some((f) => f.endsWith("deliveryInvoiceMatch.js"))
    );
    // And so are the three the old extension scope could not see, named because
    // losing them again would be silent — a scope narrowing is not a failure.
    for (const f of ["CLAUDE.md", ".github/workflows/checks.yml", "components/ConfirmDialog.js"]) {
        assert(`  and so is ${f}, which the extension scope never reached`, tracked.includes(f));
    }
    // The NUL branch has to be reached on a real file, or the loop above is
    // untested against real bytes. This repo tracks two binaries; if both ever
    // leave, this fails and whoever removed them decides what the control is
    // rather than discovering the check had quietly stopped looking.
    assert(`the sweep reached the NUL branch on a real file (${withNul.length})`, withNul.length > 0);
}

if (isMain(import.meta.url)) standalone(title, run);

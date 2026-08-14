// A source file has to stay greppable (#231).
//
// WHY THIS IS WORTH A CHECK, and the answer is the failure mode rather than the
// frequency. `grep` decides a file is BINARY when it finds a NUL byte in it, and
// a binary file is skipped with no message unless someone passed `-a`. So one
// invisible byte does not corrupt the file, break the build, fail eslint, or
// change what the module does — it removes the file from every repository-wide
// search, silently and completely. Nothing else in this tier notices: every
// offline check reads with `readFileSync`, which is indifferent to NULs.
//
// IT HAPPENED, WHICH IS WHY THE COST IS KNOWN RATHER THAN IMAGINED.
// `lib/deliveryInvoiceMatch.js` carried one inside a template literal — a sort
// key's separator, where a NUL is functionally the BETTER character, since it
// orders below every printable one. The module was then missing from a
// repository-wide count of a word it uses thirty-two times, and the count came
// back looking complete. The separator is a space now and says why in its own
// comment.
//
// THE SCOPE IS BY EXTENSION, AND THAT IS WHAT KEEPS THE EXEMPTION LIST EMPTY.
// The files this protects are the ones a person greps for a word: `.js`, `.jsx`,
// `.mjs`, `.md`, `.py`. Binary assets are excluded by not being those, and so is
// the one text file in this repository that legitimately holds NULs —
// `scripts/import/requirements.txt` is UTF-16LE, BOM and all, which is a pip
// file nobody searches for prose. Recorded rather than exempted, because an
// exemption list is a thing that rots (#171) and this check has none.
//
// ONLY THE NUL, DELIBERATELY. It is the byte with the tooling consequence; a ban
// on control characters generally would have to excuse tab, newline and carriage
// return on the first file it read, which is the shape this header just declined.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every source file is text `grep` will read (#231)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCANNED_DIRS = ["app", "lib", "scripts", "docs"];
const SOURCE = /\.(js|jsx|mjs|md|py)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (SOURCE.test(entry)) out.push(full);
    }
    return out;
}

/**
 * Where the first NUL is, or -1. A Buffer rather than a string, because reading
 * as utf8 first would be asking the thing under test to describe itself.
 */
export function firstNulByte(buffer) {
    return buffer.indexOf(0);
}

export function run({ check, assert, log }) {
    const files = SCANNED_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // "No file holds a NUL" and "no file was read" print the same result. Both
    // halves are proved before anything is claimed absent: the walk reaches
    // files, and the detector says yes and no.
    log("anti-vacuity — the walk reaches files and the detector answers both ways:");
    assert(`walked ${files.length} source files under ${SCANNED_DIRS.join("/ + ")}/`, files.length > 100);
    check("it finds a planted NUL", firstNulByte(Buffer.from([0x61, 0x00, 0x62])), 1);
    check("and reports -1 for ordinary text", firstNulByte(Buffer.from("const a = 1;\n")), -1);
    // The module that carried one is in the set being walked, or this check
    // would have passed on the day the byte went in.
    assert(
        "the file that carried one is in scope",
        files.some((f) => f.endsWith("deliveryInvoiceMatch.js"))
    );

    // ── the scan ────────────────────────────────────────────────────────────
    log("");
    log("no source file holds a NUL byte:");
    const offenders = files
        .map((f) => ({ file: relative(REPO_ROOT, f).replaceAll("\\", "/"), at: firstNulByte(readFileSync(f)) }))
        .filter((r) => r.at >= 0);
    for (const { file, at } of offenders) {
        assert(`  ${file} holds a NUL at byte ${at} — grep will skip this file`, false);
    }
    check("files grep would read as binary", offenders.length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

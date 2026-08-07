// The product is named in one place, and the superseded names are gone (#201).
//
// TWO ASSERTIONS, and the second is the one the issue actually asked for. The
// first is that neither superseded name survives anywhere under `app/` or
// `lib/`. The second is that the current name appears as a literal in exactly
// ONE file — lib/productName.js — because "the old name is gone" is satisfied
// just as well by writing the new one out at seven sites, which is the state
// that let the names drift apart to begin with.
//
// SCOPE IS `app/` + `lib/`, THE SAME BOUNDARY offline/formula-escaping.mjs
// DRAWS, and here it does a second job: it is what lets this check have NO
// EXEMPTION LIST. Documentation legitimately has to spell a superseded name —
// CLAUDE.md records what the names were, and a commit message quotes them — and
// every one of those sites is outside the scope, so none of them needs excusing.
// #171 records how fast an exemption list rots, and #174 records a blanket ban
// blocking a legitimate use; a scope that makes both unnecessary beats either.
// This file is under scripts/, so it does not scan itself and needs no
// self-exemption for the names spelled below.
//
// WHAT THIS CANNOT SEE: docs, commit messages, the Airtable base, and anything
// under scripts/ — none of which reaches a person using the app. And it matches
// text, so it proves the string is absent, not that the rendered page is right.
// The tab titles themselves were read in a browser once, by hand.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, standalone } from "./_harness.mjs";
import { PRODUCT_NAME, SIGN_IN_TITLE } from "../../../lib/productName.js";

export const title = "Product name — one owner, and the superseded names are gone (#201)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCANNED_DIRS = ["app", "lib"];

// The names this app used to call itself. Spelled out because being able to
// find them again is the whole job — a sweep that cannot name what it looks for
// has nothing to look for.
const SUPERSEDED_NAMES = ["Material Workflow Automation", "Material PO Automation"];

// The one file allowed to contain the product name as a literal.
const NAME_OWNER = "lib/productName.js";

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx|mjs)$/.test(entry)) out.push(full);
    }
    return out;
}

export function run({ check, assert, log }) {
    const files = SCANNED_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));
    const sources = new Map(
        files.map((f) => [relative(REPO_ROOT, f).replaceAll("\\", "/"), readFileSync(f, "utf8")])
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // A walk that silently found nothing would report every name as absent and
    // pass for exactly the wrong reason. client-import-safety.mjs earned this
    // the hard way — its first version resolved no paths at all and all 29 of
    // its checks passed. So the traversal is made to prove it can see.
    log("anti-vacuity — the scan is shown to reach files before anything is claimed absent:");
    assert(`walked ${sources.size} source files under ${SCANNED_DIRS.join("/ + ")}/`, sources.size > 100);
    assert(
        `and reached the one file that does hold the name (${NAME_OWNER})`,
        sources.has(NAME_OWNER)
    );
    // A string this scan is KNOWN to contain, so a search that finds nothing is
    // distinguishable from a scan that reads nothing.
    const seesKnownString = [...sources.values()].filter((s) => s.includes("requireUser")).length;
    assert(`and matching works — "requireUser" found in ${seesKnownString} of them`, seesKnownString > 10);

    // ── the superseded names are gone ───────────────────────────────────────
    log("");
    log("superseded names — zero occurrences, the evidence a rename takes here:");
    for (const old of SUPERSEDED_NAMES) {
        const hits = [...sources.entries()].filter(([, src]) => src.includes(old)).map(([p]) => p);
        check(`"${old}" occurrences${hits.length ? ` (${hits.join(", ")})` : ""}`, hits.length, 0);
    }

    // ── one owner ───────────────────────────────────────────────────────────
    // Searched by VALUE rather than by a copy of the string, so a later rename
    // of PRODUCT_NAME keeps this assertion meaningful instead of pinning it to
    // a name that is no longer the product's.
    log("");
    log(`one owner — "${PRODUCT_NAME}" is a literal in exactly one file:`);
    const owners = [...sources.entries()]
        .filter(([, src]) => src.includes(PRODUCT_NAME))
        .map(([p]) => p);
    check(`files containing the product name (${owners.join(", ") || "none"})`, owners.length, 1);
    check("and it is the module that exports it", owners[0], NAME_OWNER);

    // ── the two surfaces that must say the same thing ───────────────────────
    // The magic-link email's subject and /login's <h1> are one sentence. Both
    // read SIGN_IN_TITLE, so the identity holds by construction rather than by
    // anyone remembering — this pins that it is still DERIVED and not a second
    // literal that happens to match today.
    log("");
    log("sign-in line — derived from the product name, not a second copy of it:");
    assert(`SIGN_IN_TITLE ("${SIGN_IN_TITLE}") contains the product name`, SIGN_IN_TITLE.includes(PRODUCT_NAME));
    assert(
        "the email subject reads SIGN_IN_TITLE rather than a literal",
        /subject:\s*SIGN_IN_TITLE\b/.test(sources.get("lib/email.js") ?? "")
    );
    assert(
        "/login's heading reads SIGN_IN_TITLE rather than a literal",
        /<h1[^>]*>\{SIGN_IN_TITLE\}<\/h1>/.test(sources.get("app/login/page.js") ?? "")
    );

    // ── the legal name is not this constant ─────────────────────────────────
    // The product name and the company's legal name have different owners and
    // must never move together: HYE_BUYER_NAME is what a vendor reads on the
    // purchase order. Pinned so a later sweep of one cannot quietly take the
    // other with it.
    log("");
    log("the buyer name on the PO is untouched and separate:");
    const poPdf = sources.get("lib/poPdf.js") ?? "";
    assert("lib/poPdf.js still declares HYE_BUYER_NAME", /const HYE_BUYER_NAME = "HANYANGENG USA INC\.";/.test(poPdf));
    assert("and does not import the product name", !poPdf.includes("productName"));
}

if (isMain(import.meta.url)) standalone(title, run);

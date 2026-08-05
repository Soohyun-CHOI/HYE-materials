// `Edit Log."Field"` choices in Airtable vs lib/editLogFields.js — credentialed
// tier (#181).
//
// The companion to scripts/tests/offline/edit-log-fields.mjs, and the half that
// one cannot do. That check proves the code's enumeration has not grown without
// someone being told to create the choice; this proves the FIELD offers every
// label the code can send. Neither subsumes the other, and the gap between them
// is not hypothetical: #181 deleted the `Rate` choice by hand — the Metadata API
// cannot write a select's option list at all — and every file-only check stayed
// green through it. Exactly the shape of `DRUM` on PR Items, which is what
// verify-unit-options-18.mjs exists for.
//
// WHY A MISSING CHOICE IS WORTH A SCRIPT. `createEditLogEntry` dropped its
// `typecast` in #181, so a label with no matching choice no longer auto-creates
// one — it fails the write with INVALID_MULTIPLE_CHOICE_OPTIONS. And that throw
// costs the whole turn, not a log line: both call sites sit inside
// editAndContinueAction's try, whose catch reverts every touched item, the
// Shipping Fee, the Quotations created that turn and the signer's own status,
// then returns "Something went wrong saving your changes. Please try again." —
// advice that is wrong FOREVER for this cause, since no retry can succeed until
// someone adds the choice in the UI. So the drift this notices is a signing turn
// that dies with a misleading message, not a cosmetic mismatch.
//
// THE POSTURE ON AN EXTRA CHOICE DIFFERS FROM verify-unit-options-18.mjs, and
// deliberately. There, an option no code can write is drift full stop — there is
// no legitimate reason for a 20th unit to exist. Here #181's rule makes one
// legitimate: `Field` points at a COLUMN'S IDENTITY, so a renamed field takes its
// log rows with it (that is why `Rate` is gone), but a field DELETED and replaced
// by a different one leaves its old rows pointing at an identity that no longer
// exists, and those rows keep their old option permanently. Such a choice can
// never be written again and is still correct.
//
// That is decidable from the DATA rather than from judgement, which is why this
// reads the rows too:
//   - an extra choice HELD by at least one row  -> reported, not failed. It is
//     history the log is entitled to keep, and deleting it would blank an audit
//     row's subject.
//   - an extra choice held by NO row            -> failed. Nothing legitimizes
//     it: no code can send it and no record depends on it, which is `DRUM`'s
//     exact shape — a hand edit, or a rename whose cleanup stopped halfway.
//
// Reads schema and records. CREATES NOTHING, in Airtable or anywhere else, so
// there is no fixture to clean up and no cleanup section below — safe to run
// against the shared base at any time, and safe to interrupt.
//
// Run from the repo root:
//   node --env-file=.env.local scripts/tests/verify-edit-log-fields-181.mjs
//
// No module loader needed and no dev server: lib/editLogFields.js imports
// nothing, so unlike its Unit counterpart this reaches no extensionless
// intra-lib import (that one needs the loader precisely because client.js does
// — see its header). The table name is therefore hard-coded rather than read
// from TABLES, which would drag in lib/airtable/client.js and its own relative
// import for the sake of one string this script otherwise never touches.
//
// BE HONEST ABOUT WHAT THAT COSTS: the name here is a SECOND COPY of what
// TABLES.EDIT_LOG holds, and nothing checks that the two agree. Renaming the
// table in Airtable and updating client.js would leave this script pointing at
// a name the base no longer has. The trade is acceptable only because the
// failure is loud and immediate — "table not found" fails the run, and a run
// that cannot find its table can never read as a pass — and because a table
// rename is far rarer than the field-level drift this exists to catch. If a
// third script wants the same string, import TABLES and take the loader.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete (could not
// reach the base).

import { execSync } from "child_process";
import { EDIT_LOG_FIELD_LABELS } from "../../lib/editLogFields.js";

const TABLE = "Edit Log";
const FIELD = "Field";

let pass = true;
let incomplete = false;

const log = (m) => console.log(m);
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function fail(label) {
    pass = false;
    log(`  FAIL  ${label}`);
}
let reported = 0;
function report(label) {
    reported += 1;
    log(`  NOTE  ${label}`);
}

// ---------------------------------------------------------------------------
// Header. A past run is only evidence if it can be tied to a tree, so the commit
// and whether it was dirty are printed before anything else runs. A dirty tree
// does not fail the run — it is normal to verify work in progress — but it means
// the commit alone does not identify what was tested. Same block as
// verify-invoice-ids-164.mjs and verify-deliveries-162.mjs (#172).
function gitContext() {
    try {
        const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        const dirtyFiles = status.split("\n").filter((l) => l.trim().length > 0);
        return { head, dirty: dirtyFiles.length > 0, dirtyCount: dirtyFiles.length };
    } catch (err) {
        return { head: "unknown", dirty: null, error: String(err?.message ?? err) };
    }
}

const git = gitContext();
console.log("=".repeat(72));
console.log(`verify-edit-log-fields-181 — ${TABLE}."${FIELD}" choices vs lib/editLogFields.js`);
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty
          ? `tree      DIRTY — ${git.dirtyCount} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));
console.log(`\nLabels the code can write (${EDIT_LOG_FIELD_LABELS.length}): ${EDIT_LOG_FIELD_LABELS.join(", ")}\n`);

try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const key = process.env.AIRTABLE_API_KEY;

    // -----------------------------------------------------------------------
    // Schema read. The Metadata API is the only way to see a select's option
    // list; the record API shows only what records happen to hold, which is
    // precisely how an unheld option stays hidden.
    let tables = null;
    try {
        const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
            headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
        tables = (await res.json()).tables;
    } catch (err) {
        incomplete = true;
        log(`  SKIP  could not read the base schema: ${err.message}`);
        log("        needs AIRTABLE_API_KEY + AIRTABLE_BASE_ID (schema.bases:read scope).");
    }

    if (tables) {
        const table = tables.find((t) => t.name === TABLE);
        const field = table?.fields.find((f) => f.name === FIELD);

        if (!table) {
            fail(`table "${TABLE}" not found in this base`);
        } else if (!field) {
            // Renaming this field without updating the code is the other way the
            // pair drifts, and it is a real problem rather than an incomplete run.
            fail(`${TABLE}."${FIELD}" not found — renamed without updating lib/airtable/editLog.js?`);
        } else {
            check(`${TABLE}."${FIELD}" is a singleSelect`, field.type, "singleSelect");

            const choices = (field.options?.choices || []).map((c) => c.name);
            const missing = EDIT_LOG_FIELD_LABELS.filter((l) => !choices.includes(l));
            const extra = choices.filter((c) => !EDIT_LOG_FIELD_LABELS.includes(c));

            log(`  live choices (${choices.length}): ${choices.join(", ")}`);
            log("");

            // THE ONE THAT DECIDES WHETHER AN EDIT TURN SURVIVES. Named
            // individually so the output says WHICH label has no choice.
            check(
                "every writable label exists as a choice",
                missing.join(",") || "(none)",
                "(none)"
            );
            if (missing.length) {
                log(
                    `        create ${missing.map((m) => `"${m}"`).join(", ")} on ${TABLE}."${FIELD}" in the`
                );
                log("        Airtable UI — the Metadata API cannot write a select's option list");
                log("        (measured, 422), and until then editing that field fails the whole turn.");
            }

            // -------------------------------------------------------------------
            // Extra choices. Legitimate only as history, so ask the rows.
            let records = null;
            try {
                const res = await fetch(
                    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?pageSize=100`,
                    { headers: { Authorization: `Bearer ${key}` } }
                );
                if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
                records = (await res.json()).records;
            } catch (err) {
                incomplete = true;
                log(`  SKIP  could not read ${TABLE} rows, so an extra choice cannot be judged: ${err.message}`);
            }

            if (extra.length === 0) {
                // Today's state, and the previous commit measured it once by hand
                // — seven labels, seven choices. Asserting it is what turns that
                // one-off observation into a property that keeps holding.
                check("no choice beyond what the code can write", extra.join(",") || "(none)", "(none)");
                check(
                    "choice count matches the label count exactly",
                    choices.length,
                    EDIT_LOG_FIELD_LABELS.length
                );
                // Display order only — a reordering breaks no write. Checked only
                // in this branch: a legitimate historical choice may sit anywhere,
                // so order stops being a meaningful equality once one exists.
                check(
                    "same order as the module (display only)",
                    choices.join(","),
                    EDIT_LOG_FIELD_LABELS.join(",")
                );
            } else if (records) {
                const heldCount = (name) =>
                    records.filter((r) => r.fields?.[FIELD] === name).length;
                for (const name of extra) {
                    const n = heldCount(name);
                    if (n > 0) {
                        // The rule from #181: a field deleted and replaced leaves
                        // its old rows pointing at an identity that is gone, and
                        // they keep this option for good.
                        report(
                            `"${name}" is not writable but ${n} row(s) hold it — history, kept on purpose ` +
                                `if the field it named was DELETED rather than renamed (a rename takes its rows with it)`
                        );
                    } else {
                        fail(
                            `"${name}" is writable by nothing and held by no row — a hand edit, or a rename ` +
                                `whose cleanup stopped halfway; delete it in the Airtable UI`
                        );
                    }
                }
            }

            // -------------------------------------------------------------------
            // Census, for the reader rather than as an assertion: which labels are
            // actually exercised. A label with no rows is not a problem — nobody
            // may have edited that field yet.
            if (records) {
                log("");
                log(`  ${TABLE} rows: ${records.length}`);
                const blank = records.filter((r) => !r.fields?.[FIELD]).length;
                check(`no row has an empty "${FIELD}"`, blank, 0);
                for (const label of choices) {
                    const n = records.filter((r) => r.fields?.[FIELD] === label).length;
                    log(`    ${String(n).padStart(3)}  ${label}`);
                }
            }
        }
    }
} catch (err) {
    // An unexpected throw is not a clean "found a problem" — say so and exit 2,
    // never 0, so an aborted run cannot read as a pass.
    incomplete = true;
    log(`\n  SKIP  run did not complete: ${err?.stack ?? err}`);
}

console.log("\n" + "=".repeat(72));
if (!pass) {
    console.log("SOME CHECKS FAILED");
    process.exit(1);
}
if (incomplete) {
    console.log("NO FAILURES, BUT THE RUN WAS INCOMPLETE — treat as unverified");
    process.exit(2);
}
// Worded off `reported` rather than fixed, because "exactly" would be false with
// a historical choice standing — and a success line that over-claims is how a
// tolerated exception turns into an unnoticed one.
console.log(
    reported === 0
        ? `OK — ${TABLE}."${FIELD}" offers exactly the labels the code can write`
        : `OK — every writable label has a choice; ${reported} historical choice(s) noted above, ` +
              `each held by rows and writable by nothing`
);
process.exit(0);

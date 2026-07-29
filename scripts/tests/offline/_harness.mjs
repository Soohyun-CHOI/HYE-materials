// Shared plumbing for the offline check tier (issue #152).
//
// Every file in this directory is a STANDING check: it must run with plain
// `node`, with no environment variables, no Airtable, no Vercel Blob, no dev
// server, and it must create nothing. That is the whole point of the tier —
// the checks that decay silently (source-shape assertions, pure predicates)
// were previously welded into scripts that write to the shared Airtable base,
// so reaching them cost credentials and fixtures, so nobody ran them, so
// breakage stayed invisible. #147 broke six of them and it took a human
// asking to find out.
//
// The boundary is not a preference, it is measurable: lib/airtable/client.js
// throws "Missing AIRTABLE_API_KEY" at module load, so any module that
// imports it transitively cannot be used here. That currently excludes
// lib/poWithdraw.js, lib/blobIngest.js and lib/ids.js, and therefore keeps
// their pure predicates out of this tier — see CLAUDE.md for that follow-up.
//
// Contract for a file in this directory:
//   export const title = "..."            // one line, shown as the section head
//   export function run({ check, log })   // returns nothing; use check()/log()
//   ...then the standalone footer:
//   if (isMain(import.meta.url)) standalone(title, run);
//
// `run` may be async. A file whose name starts with "_" is a helper and is
// skipped by the runner.

import { resolve } from "path";
import { fileURLToPath } from "url";

/**
 * A reporter shared by the runner and by standalone execution, so a check
 * reads identically either way. `check` returns the boolean so a caller can
 * branch on it; `failed` counts what went wrong.
 */
export function createReporter({ prefix = "  " } = {}) {
    const state = { failed: 0, total: 0 };
    return {
        state,
        log: (message) => console.log(`${prefix}${message}`),
        check(label, actual, expected) {
            state.total++;
            const ok = actual === expected;
            if (!ok) state.failed++;
            console.log(
                `${prefix}${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
            );
            return ok;
        },
        // For a claim that isn't an equality — the message carries the detail.
        assert(label, ok) {
            state.total++;
            if (!ok) state.failed++;
            console.log(`${prefix}${ok ? "PASS" : "FAIL"}  ${label}`);
            return Boolean(ok);
        },
    };
}

/** Was this module the process entry point? */
export function isMain(moduleUrl) {
    return Boolean(process.argv[1]) && resolve(process.argv[1]) === resolve(fileURLToPath(moduleUrl));
}

/**
 * Run one offline check file on its own. Exits 0 when clean and 1 when not,
 * so it is usable as a gate rather than something whose output has to be read.
 */
export async function standalone(title, run) {
    console.log(title);
    const reporter = createReporter();
    await run(reporter);
    const { failed, total } = reporter.state;
    console.log("\n" + "=".repeat(60));
    console.log(failed === 0 ? `OK — ${total} checks passed` : `FAILED — ${failed} of ${total} checks`);
    process.exit(failed === 0 ? 0 : 1);
}

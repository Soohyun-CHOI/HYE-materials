// The offline check tier — what `npm test` runs, and what CI runs on push.
//
// Issue #152. The problem this solves is not "a check was wrong", it is that
// the cheap checks were welded to the expensive ones. Source-shape assertions
// and pure predicates lived in scripts that write to the shared Airtable base,
// so reaching them cost credentials and fixtures, so nobody ran them, so a
// refactor could invalidate six of them and nothing said a word (#147 did
// exactly that). Splitting by execution cost is what makes the cheap tier
// runnable often enough to be worth having.
//
// Everything here runs with plain `node`: no environment variables, no
// Airtable, no Vercel Blob, no dev server, and nothing is created. Adding a
// file to this directory puts it in CI — the directory is SCANNED, not listed,
// because a check that has to be registered somewhere is a check that can be
// forgotten (the lesson from #147's hard-coded four-route list).
//
//   node scripts/tests/offline/run-all.mjs      # or: npm test
//
// Exit codes match the convention #147 set: 0 all clear, 1 something failed.
// There is no 2 here — nothing in this tier can be "unable to run"; that state
// belongs to the credentialed scripts, which report it themselves.
//
// The credentialed tier is NOT run from here and is not meant to be automated:
// scripts/tests/verify-*.mjs need .env.local, write fixtures to the shared base,
// and some need a dev server. They stay human-initiated, and each one runs its
// own offline counterpart first so a manual run is still complete.

import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createReporter } from "./_harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// Files beginning with "_" are shared helpers, and this runner is not its own
// subject. Everything else in the directory must be a check.
const files = readdirSync(HERE)
    .filter((f) => f.endsWith(".mjs") && !f.startsWith("_") && f !== "run-all.mjs")
    .sort();

if (files.length === 0) {
    console.error("No offline checks found — expected at least one .mjs in this directory.");
    process.exit(1);
}

/**
 * Name what went wrong when a check file cannot even be loaded.
 *
 * This exists because the raw failure is misleading in the specific way that
 * teaches people to ignore CI. A check that imports an env-coupled module dies
 * with `ERR_MODULE_NOT_FOUND: Cannot find module .../lib/airtable/client`
 * (this tier runs without the extension loader) or, with the loader,
 * `Missing AIRTABLE_API_KEY`. Both read as "the environment is broken", so the
 * honest response would be to go fix the environment — when the actual fact is
 * that the check does not belong in this tier.
 */
function diagnoseLoadFailure(err) {
    const message = String(err?.message ?? err);
    if (/Missing AIRTABLE_API_KEY/i.test(message) || /lib[\\/]airtable/i.test(message)) {
        return {
            headline: "is NOT offline — it, or something it imports, reaches lib/airtable/",
            advice:
                "This tier must run with no credentials. lib/airtable/client.js throws at module load " +
                "without AIRTABLE_API_KEY, so anything importing it transitively belongs in the " +
                "credentialed tier (scripts/tests/verify-*.mjs). See CLAUDE.md, Verification tiers.",
        };
    }
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
        return {
            headline: "could not resolve an import",
            advice:
                "If the missing specifier is a package (acorn, acorn-jsx), the dev dependencies this " +
                "tier parses with are not installed — run `npm ci`. If it is a repo file, the path is wrong.",
        };
    }
    return {
        headline: "threw while being loaded",
        advice: "A check file must be importable on its own, with no environment and no side effects.",
    };
}

let failedTotal = 0;
let checkTotal = 0;
const results = [];

for (const file of files) {
    let mod;
    try {
        // pathToFileURL, not the bare path: on Windows an absolute path is not a
        // valid ESM specifier ("protocol 'c:'").
        mod = await import(pathToFileURL(join(HERE, file)).href);
    } catch (err) {
        const { headline, advice } = diagnoseLoadFailure(err);
        console.log(`\n${file}`);
        console.log(`  FAIL  ${file} ${headline}`);
        console.log(`        cause: ${String(err?.message ?? err).split("\n")[0]}`);
        console.log(`        ${advice}`);
        failedTotal++;
        checkTotal++;
        results.push({ file, failed: 1, total: 1 });
        // Keep going: one unloadable file must not hide the other checks'
        // results, which is what an uncaught throw here used to do.
        continue;
    }

    // A file that doesn't meet the contract is a failure, not something to
    // skip: silently ignoring it would be the same gap as not scanning at all.
    if (typeof mod.run !== "function") {
        console.log(`\n${file}`);
        console.log(`  FAIL  ${file} exports no run() — every offline check must export run({ check, log })`);
        failedTotal++;
        results.push({ file, failed: 1, total: 1 });
        continue;
    }

    console.log(`\n${mod.title || file}`);
    const reporter = createReporter();
    // A check file that throws mid-run must cost its own file, not the whole
    // tier. It used to propagate and abort the process, so the checks after it
    // — including every other file — reported nothing at all, and the summary
    // never printed. That matters more since #143 gave canViewPR a deliberate
    // throw for a caller that omits required fields: a future check written
    // without them should fail one line, not hide 100 passes.
    try {
        await mod.run(reporter);
    } catch (err) {
        console.log(`  FAIL  ${file} threw partway through: ${String(err?.message ?? err).split("\n")[0]}`);
        reporter.state.failed++;
        reporter.state.total++;
    }
    const { failed, total } = reporter.state;
    failedTotal += failed;
    checkTotal += total;
    results.push({ file, failed, total });
}

console.log("\n" + "=".repeat(60));
for (const r of results) {
    console.log(`  ${r.failed === 0 ? "ok  " : "FAIL"}  ${r.file}  (${r.total - r.failed}/${r.total})`);
}
console.log("=".repeat(60));
console.log(
    failedTotal === 0
        ? `OK — ${checkTotal} checks passed across ${files.length} files`
        : `FAILED — ${failedTotal} of ${checkTotal} checks across ${files.length} files`
);
process.exit(failedTotal === 0 ? 0 : 1);

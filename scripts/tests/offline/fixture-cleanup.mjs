// The credentialed tier's fixture-cleanup contract, asserted on source (#171).
//
// Sixteen `verify-*.mjs` scripts hand-rolled the same cleanup loop and two of them
// lost their own fixtures, in two different ways: a `Promise.allSettled` whose
// results were discarded and then the parent deleted anyway (which stranded two
// parentless PO Items), and no `try` around the body at all (which left 100
// records on the shared base across four aborted runs). #171 replaced all sixteen
// with scripts/tests/_fixtures.mjs. This check is what stops the seventeenth from
// starting over.
//
// NO EXEMPTION LIST, DELIBERATELY. CLAUDE.md's reason for making the offline
// runner SCAN its directory rather than list files applies here twice over:
// anything that has to be registered somewhere gets forgotten, and a list of
// exemptions-with-reasons is the first thing to rot. If a script genuinely cannot
// use the helper, that is a signal the HELPER is wrong — stop and fix the helper,
// or ask, rather than adding a line here.
//
// THE `Promise.allSettled` BAN IS BROADER THAN THE DEFECT, deliberately. The
// defect is a loop that DISCARDS settled results, and deciding that would mean
// proving a binding is never read — a check that has to prove that can be wrong
// quietly, which this file's own first version was: it walked a wrapper instead of
// the tree and would have passed every assertion in it for the wrong reason.
// Banning the identifier cannot be gamed, and its cost lands at the call site
// where it is visible.
//
// That cost has been paid once, by verify-token-and-lock-174.mjs (#174), which
// needs all three outcomes of a deliberately rejecting lock call and inspects
// every one. It captures them by hand, and reads more explicitly than the banned
// form would. Revisit if a use appears where writing it by hand is worse than the
// risk of narrowing — not on a count of instances.
//
// WHAT THIS CANNOT PROVE, which is most of what matters:
//   - Source order is not execution order. Seeing `fixtures.teardown(` after the
//     body's `try` does not mean it ran; a `return` above it, or an exception in
//     the middle of teardown, both pass here.
//   - That the tracked ids are ALL the ids a run created. A script that creates a
//     record and never calls `track` passes — the tag census is what catches that,
//     and only at run time.
//   - That the helper was configured with the right tables, links or tag fields. A
//     bucket pointing at the wrong table is invisible here and reports a clean
//     census, which is exactly the vacuity the residue measurement exists for.
//   - Anything about Vercel Blob, or about whether a delete actually happened.
// Only the credentialed tier's census-then-residue pair proves a row is gone. A
// pass here means nothing cheap regressed in the SHAPE of these scripts.

import { readdirSync } from "fs";
import { isMain, standalone } from "./_harness.mjs";
import { parseFile, parseSource, repoPath, walk } from "./_ast.mjs";

export const title = "Fixture-cleanup contract across the credentialed tier (#171)";

const TESTS_DIR = "scripts/tests";

function verifyScripts() {
    return readdirSync(repoPath(TESTS_DIR))
        .filter((f) => f.startsWith("verify-") && f.endsWith(".mjs"))
        .sort();
}

export function run({ check, assert, log }) {
    const files = verifyScripts();
    assert(`found verify-*.mjs scripts to check (${files.length})`, files.length > 0);

    // ANTI-VACUITY. If the scan or the parse silently yielded nothing, every
    // assertion below would pass by never running. So one file whose properties
    // are known must be SEEN to have them.
    let sawAdopter = false;
    let sawDestroyer = false;

    for (const name of files) {
        const rel = `${TESTS_DIR}/${name}`;
        let ast;
        let src;
        try {
            // parseFile returns { ast, source } — walking the WRAPPER instead of the
            // tree makes `walk` return at its first line, every count read 0, and
            // every check below pass for the wrong reason. That is not a
            // hypothetical: it is what the first version of this file did, and the
            // two anti-vacuity assertions at the bottom are what caught it.
            ({ ast, source: src } = parseFile(rel));
        } catch (err) {
            assert(`${name} parses — ${err.message}`, false);
            continue;
        }

        // Collect the shapes from the AST, so a comment mentioning any of these
        // cannot satisfy or trip the check. Both of the remaining
        // `Promise.allSettled` mentions in this tier are in prose about the defect.
        let destroyCalls = 0;
        let allSettled = 0;
        let emptyCatch = 0;
        let teardownAt = null;
        let earliestExitAt = null;

        walk(ast, (node) => {
            if (node.type === "CatchClause" && node.body?.body?.length === 0) emptyCatch += 1;
            if (node.type !== "CallExpression") return;
            const callee = node.callee;
            if (callee?.type === "MemberExpression" && callee.property?.name === "destroy") destroyCalls += 1;
            if (
                callee?.type === "MemberExpression" &&
                callee.property?.name === "allSettled" &&
                callee.object?.name === "Promise"
            ) {
                allSettled += 1;
            }
            if (callee?.type === "MemberExpression" && callee.property?.name === "teardown") {
                if (teardownAt === null || node.start < teardownAt) teardownAt = node.start;
            }
            if (
                callee?.type === "MemberExpression" &&
                callee.object?.name === "process" &&
                callee.property?.name === "exit"
            ) {
                if (earliestExitAt === null || node.start < earliestExitAt) earliestExitAt = node.start;
            }
        });

        const importsHelper = /from\s+"\.\/_fixtures\.mjs"/.test(src);
        const createsRecords = importsHelper || destroyCalls > 0;

        if (createsRecords) {
            sawAdopter = sawAdopter || importsHelper;
            check(`${name} imports the fixture helper`, importsHelper, true);
            assert(`${name} calls fixtures.teardown()`, teardownAt !== null);
        }

        // THE H1 SHAPE, banned outright rather than only in a cleanup region.
        // Deleting a batch and discarding every result is how an orphan is made,
        // and there is no place in this tier where that is the right call: the
        // helper reports per record. Zero across the tier today.
        check(`${name} has no Promise.allSettled`, allSettled, 0);

        // A `catch {}` with nothing in it is the other swallow — the one that made
        // `del(url).catch(() => {})` and `destroy(id).catch(() => {})` invisible.
        check(`${name} has no empty catch block`, emptyCatch, 0);

        // A `try` catches a throw; it does not catch `process.exit`. So an exit
        // above the cleanup call skips cleanup outright, which is the 100-record
        // failure in another costume. Files that use `process.exitCode` instead
        // have no exit call at all and pass trivially.
        if (teardownAt !== null && earliestExitAt !== null) {
            assert(
                `${name} does not call process.exit before its cleanup`,
                earliestExitAt > teardownAt
            );
        }

        if (destroyCalls > 0) {
            sawDestroyer = true;
            log(
                `  ${name}: ${destroyCalls} direct destroy call(s) — deliberate in-test ` +
                    "deletions, and this file still goes through the helper for cleanup"
            );
        }
    }

    // The two anti-vacuity assertions. Without these, a scan that returned only
    // read-only scripts would report every check above as passing.
    assert("at least one script was seen importing the helper", sawAdopter);
    assert(
        "at least one script was seen calling .destroy() directly, so that arm ran",
        sawDestroyer
    );

    // ── the helper's own delete path (#191) ─────────────────────────────────
    //
    // Everything above is about the ADOPTERS. These are about `_fixtures.mjs`
    // itself, and they are here rather than in a file of their own because the
    // subject is the same contract: how this tier removes what it made.
    //
    // They are source shape, which is all that is available — `_fixtures.mjs`
    // imports the Airtable client and throws at module load without a key, so
    // this tier cannot call `teardown` and cannot see a batch happen. What a
    // credentialed run proves instead is in the pull request: 64 rows in 64
    // requests before, 14 batch requests after, residue 0 both times.
    log("");
    log("the helper batches its deletes, and falls back per record (#191):");

    const helper = parseFile(`${TESTS_DIR}/_fixtures.mjs`);

    // Airtable's ceiling for one delete request. A literal, so changing it is a
    // deliberate edit rather than a value that drifted out of a comment.
    let batchSize = null;
    walk(helper.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "DELETE_BATCH_SIZE") batchSize = n.init?.value ?? null;
    });
    check("  DELETE_BATCH_SIZE is Airtable's ceiling of ten", batchSize, 10);

    // NO `destroy` IN THE HELPER PASSES A SCALAR, which is one assertion doing two
    // jobs. The batch path must send a list or nothing is batched at all; and the
    // one-at-a-time FALLBACK must send a one-element list rather than the bare id,
    // because the two forms answer differently for a record that is already gone
    // — measured, `DELETE /Table?records[]=recX` answers 404 naming the record
    // while `DELETE /Table/recX` answers 403 with the permission sentence
    // `residueState` documents as indistinguishable from a dead credential. A
    // regression to the scalar form in either place would keep working and quietly
    // lose the diagnosis.
    //
    // IT BANS THE SCALAR SHAPES RATHER THAN CERTIFYING ARRAYNESS, because source
    // shape cannot do the latter: the batch call passes `chunk.map(…)`, which is a
    // CallExpression that happens to return an array, and no parser can say that.
    // What it CAN say is that the argument is not the thing the scalar form takes
    // — a bare identifier, or a property read like `row.id`.
    const SCALAR_SHAPES = new Set(["Identifier", "MemberExpression", "Literal"]);
    const destroyArgs = [];
    walk(helper.ast, (n) => {
        if (
            n.type === "CallExpression" &&
            n.callee?.type === "MemberExpression" &&
            n.callee.property?.name === "destroy"
        ) {
            destroyArgs.push(n.arguments[0]?.type ?? "(none)");
        }
    });
    assert(`  the helper calls .destroy() at all (${destroyArgs.length})`, destroyArgs.length > 0);
    check(
        "  and no call passes a scalar id — every one is the batch form",
        destroyArgs.filter((t) => SCALAR_SHAPES.has(t)).length,
        0
    );

    // CHILDREN BEFORE PARENTS SURVIVES THE REGROUPING. Batching moved the
    // deletes out of a per-parent loop into one flush per table, and the thing
    // that must not move with it is the order: every child of a bucket goes
    // before every parent of that bucket, or a parent is removed over the top of
    // rows that still point at it. The child flush passes the table it is
    // iterating; the parent flush passes the bucket's own.
    const flushes = [];
    walk(helper.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "Identifier" && n.callee.name === "deleteRows") {
            const arg = n.arguments[0];
            const named =
                arg?.type === "Identifier"
                    ? arg.name
                    : arg?.type === "MemberExpression"
                      ? `${arg.object?.name}.${arg.property?.name}`
                      : arg?.type;
            flushes.push({ at: n.start, named });
        }
    });
    // AND IT IS SOURCE ORDER, with this file's own standing caveat: swapping the
    // two statements fails these, while a runtime short-circuit that leaves them
    // where they are does not. Both mutations were run; only the first is caught.
    flushes.sort((a, b) => a.at - b.at);
    check("  there are two flushes, children and parents", flushes.length, 2);
    check("  the first is the child tables", flushes[0]?.named, "table");
    check("  and the second is the bucket's own table", flushes[1]?.named, "b.table");

    // ANTI-VACUITY for the three above: the detector is shown reading a scalar
    // destroy as a scalar, so "every call passes an array" is not what an empty
    // walk reports.
    const scalar = parseSource('base(t).destroy(id);\nbase(t).destroy([id]);\n', "<synthetic-scalar>");
    const seen = [];
    walk(scalar.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "destroy") seen.push(n.arguments[0]?.type);
    });
    check("  the detector reads a bare id as a scalar shape", SCALAR_SHAPES.has(seen[0]), true);
    check("    and a one-element list as not one", SCALAR_SHAPES.has(seen[1]), false);
}

if (isMain(import.meta.url)) standalone(title, run);

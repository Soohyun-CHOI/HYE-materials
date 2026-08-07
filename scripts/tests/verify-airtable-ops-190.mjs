// The Airtable operation counter against the real base — credentialed (#190).
//
// The companion to scripts/tests/offline/airtable-ops.mjs, and the half that one
// cannot do. That check proves the classifier names the six request shapes
// correctly, that the guards throw, that the double-wrap guard holds and that
// AsyncLocalStorage carries a label across an await. None of that requires the
// counter to have ever seen a real request. THIS is where it does.
//
// WHY THAT GAP MATTERS MORE HERE THAN USUAL. A counter that reads 0 is
// indistinguishable from an efficient app — the whole reason #19's instrument
// carries a `> 0` assertion, and the reason its own comment calls that assertion
// "the thing that turns this from a check that can lie into one that fails
// loudly". #19 also records the two ways such a measurement silently read 0
// before it read anything, and this file adds the two that would produce a WRONG
// number rather than a zero: a request path nobody counted (the write side) and a
// label context that is lost, which sends everything to `unlabeled` and looks
// exactly like a call site nobody has labeled yet.
//
// Parts:
//   A — a real read is counted, and counted as the right kind on the right table.
//   B — SO IS A REAL WRITE. create/update/destroy are the half #190 exists to
//       add: verify-material-price-19.mjs hooks _selectRecords/_findRecordById,
//       which cannot see any of them.
//   C — attribution end to end. The offline check proves the ALS mechanism; this
//       proves the WRAPPER runs inside it, through the real SDK.
//   D — CALIBRATION AT THE TRANSPORT. An operation is one logical request and
//       Airtable bills HTTP attempts, so lib/airtableOps.js calls its numbers a
//       floor. This measures the gap instead of leaving it a caveat, by counting
//       `https.request` — the only layer that sees airtable's 429 retry, since
//       run_action.js recurses into its own module-local function rather than
//       back through Base#runAction.
//   E — CROSS-CHECK against #19's instrument, with the expected relationship
//       stated BEFORE the comparison. The two layers are not 1:1 by design and
//       agreeing on small fixtures would prove nothing on its own, so the
//       divergence is also forced and measured.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-airtable-ops-190.mjs
//
// Fixtures: one Addresses row, created, updated and destroyed inside this run
// through scripts/tests/_fixtures.mjs (#171). Everything else is read-only.
// Creates nothing in Vercel Blob, consumes no token, mints no session.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base,
// 2 clean but incomplete.

import { execSync } from "child_process";
import https from "node:https";
import { base, TABLES } from "../../lib/airtable/client.js";
import {
    PINNED_AIRTABLE_VERSION,
    UNLABELED,
    formatSnapshot,
    resetOps,
    snapshot,
    withOpsLabel,
} from "../../lib/airtableOps.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
let incomplete = null;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return Boolean(ok);
}
function note(label) {
    console.log(`  NOTE  ${label}`);
}

// Same block as verify-edit-log-fields-181.mjs and verify-invoice-ids-164.mjs
// (#172): a past run is only evidence if it can be tied to a tree.
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
console.log("verify-airtable-ops-190 — the operation counter against the live base");
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty
          ? `tree      DIRTY — ${git.dirtyCount} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`airtable  pinned at ${PINNED_AIRTABLE_VERSION}`);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));

/**
 * #19's INSTRUMENT, DELIBERATELY A SECOND COPY.
 *
 * CLAUDE.md's "One rule, one implementation" is about one JUDGMENT having one
 * implementation. This is not that: it is a second MEASUREMENT of the same
 * quantity at a different layer, and sharing an implementation with the thing it
 * cross-checks would defeat the entire point of Part E. It hooks the Table
 * PROTOTYPE's `_selectRecords`/`_findRecordById` — see verify-material-price-19
 * .mjs for why those two names and not `select`/`find` (per-instance) or the
 * global `fetch` (captured at module load).
 *
 * A harness may depend on a dependency's private names. offline/airtable-ops.mjs
 * asserts no module under app/ or lib/ does.
 */
function instrumentCallLayer() {
    const tableProto = Object.getPrototypeOf(base(TABLES.USERS));
    const original = { select: tableProto._selectRecords, find: tableProto._findRecordById };
    if (typeof original.select !== "function" || typeof original.find !== "function") {
        throw new Error(
            "verify-airtable-ops-190: airtable's Table prototype no longer exposes " +
                "_selectRecords/_findRecordById — Part E's cross-check needs updating"
        );
    }
    const counts = { select: 0, find: 0 };
    tableProto._selectRecords = function (...args) {
        counts.select++;
        return original.select.apply(this, args);
    };
    tableProto._findRecordById = function (...args) {
        counts.find++;
        return original.find.apply(this, args);
    };
    return {
        counts,
        restore() {
            tableProto._selectRecords = original.select;
            tableProto._findRecordById = original.find;
        },
    };
}

/**
 * Count real HTTP attempts around one call.
 *
 * `https.request` is where node-fetch@2.7.0 issues them — index.js:1452 reads
 * `.request` off the module object AT CALL TIME (`(options.protocol === 'https:'
 * ? https : http).request`), which is exactly why this patch is visible where a
 * patch of airtable's captured `fetch_1.default` is not: that one is a private
 * object built inside run_action.js's closure by `__importDefault`, and fetch.js
 * exports a plain function, so there is no shared object to reach.
 *
 * This is the ONLY layer that sees a 429 retry. Base#runAction hands off to
 * run_action.js's module-local `runAction`, whose 429 branch recurses into
 * ITSELF, so a retried request passes the counter once. Nor can the callback see
 * it: that branch never calls the callback, it only recurses.
 */
async function countHttp(fn) {
    const original = https.request;
    let attempts = 0;
    https.request = function (...args) {
        attempts += 1;
        return original.apply(this, args);
    };
    try {
        const result = await fn();
        return { result, attempts };
    } finally {
        https.request = original;
    }
}

/** Operations counted around one call, by kind. */
async function countOps(fn) {
    resetOps();
    const result = await fn();
    const snap = snapshot();
    const byKind = {};
    for (const row of snap.rows) byKind[row.kind] = (byKind[row.kind] || 0) + row.count;
    return { result, total: snap.total, byKind, rows: snap.rows, byLabel: snap.byLabel };
}

const fixtures = createFixtures({
    tag: "V190",
    buckets: [{ name: "addresses", table: TABLES.ADDRESSES, label: "Address", tagField: "Address Label" }],
});
const TAG = fixtures.TAG;

let complete = false;
try {
    // -----------------------------------------------------------------------
    console.log("\nPart A — a real read is counted");
    // The base's own Users table, read-only. Small enough to be one page, which
    // Part E depends on knowing.
    const readA = await countOps(() => base(TABLES.USERS).select({ fields: [] }).all());
    console.log(`  reading ${TABLES.USERS} (${readA.result.length} rows): ${readA.total} ops ${JSON.stringify(readA.byKind)}`);

    // THE HEADLINE ANTI-VACUITY. Everything below compares numbers; if the
    // instrument sees nothing, every one of those comparisons is 0 === 0.
    assert(`the counter observed real operations (${readA.total} > 0)`, readA.total > 0);
    check("a select is counted as a list", readA.byKind.list, 1);
    assert("and nothing was classified as unknown", (readA.byKind.unknown ?? 0) === 0);
    check("attributed to the right table", readA.rows[0]?.table, TABLES.USERS);

    const findA = await countOps(() => base(TABLES.USERS).find(readA.result[0].id));
    check("a find is counted as a find", findA.byKind.find, 1);
    check("and costs exactly one operation", findA.total, 1);

    // -----------------------------------------------------------------------
    console.log("\nPart B — and so is a real write");
    // The half no instrument in this repo has ever seen. #19's layer hooks the
    // two READ methods; create/update/destroy do not pass through either.
    //
    // Written through the raw client rather than through lib/airtable/addresses
    // .js's createAddress, because what is under test is the client's own request
    // funnel and a service wrapper would only add a layer to reason about.
    const created = await countOps(() =>
        base(TABLES.ADDRESSES).create({ "Address Label": `${TAG} ops counter fixture` })
    );
    const addressId = created.result.id;
    fixtures.track("addresses", addressId);
    check("a create is counted as a create", created.byKind.create, 1);
    check("and costs exactly one operation", created.total, 1);

    const updated = await countOps(() => base(TABLES.ADDRESSES).update(addressId, { City: "Ops" }));
    check("a single-record update is counted as an update", updated.byKind.update, 1);

    const destroyed = await countOps(() => base(TABLES.ADDRESSES).destroy(addressId));
    check("a single-record destroy is counted as a destroy", destroyed.byKind.destroy, 1);
    // Only after it really went, so a failed destroy still reaches teardown.
    fixtures.untrack("addresses", addressId);

    // The distinction #191 needs: every destroy in this app is one-at-a-time, so
    // a `destroy` count is a record count. A batched one would read as
    // `destroy-batch` and cover up to 10 records in a single operation.
    note("every write above is single-record — a batched update or destroy would read as update-batch / destroy-batch");

    // -----------------------------------------------------------------------
    console.log("\nPart C — attribution, end to end");
    // THE FAILURE THIS RULES OUT IS NOT A ZERO, IT IS A PLAUSIBLE WRONG ANSWER.
    // If the ALS context were lost between withOpsLabel and the wrapper, every
    // operation would land in `unlabeled` — which is also what a call site nobody
    // has labeled yet looks like, so the totals would stay right and the
    // breakdown would quietly become useless. The offline check proves the ALS
    // mechanism in isolation; only a real request through the real SDK proves the
    // wrapper is inside the scope.
    resetOps();
    await withOpsLabel("/verify-190-scope", async () => {
        await base(TABLES.USERS).select({ fields: [], maxRecords: 1 }).all();
        await base(TABLES.USERS).find(readA.result[0].id);
    });
    const labeled = snapshot();
    check("both operations landed under the label", labeled.byLabel["/verify-190-scope"], 2);
    assert("and none fell into the unlabeled bucket", labeled.byLabel[UNLABELED] === undefined);

    // The other direction: an unlabeled call really is unlabeled, so the bucket
    // means what it says rather than being unreachable.
    resetOps();
    await base(TABLES.USERS).select({ fields: [], maxRecords: 1 }).all();
    check("an operation outside any scope is unlabeled", snapshot().byLabel[UNLABELED], 1);

    // -----------------------------------------------------------------------
    console.log("\nPart D — calibration: operations vs real HTTP attempts");
    // lib/airtableOps.js calls its numbers a floor. This is the measurement that
    // makes that a figure rather than a hedge.
    resetOps();
    const calibration = await countHttp(async () => {
        await base(TABLES.USERS).select({ fields: [] }).all();
        await base(TABLES.USERS).find(readA.result[0].id);
        await base(TABLES.JOBS).select({ fields: [], maxRecords: 1 }).all();
        return snapshot().total;
    });
    const countedOps = calibration.result;
    console.log(`  ${countedOps} operations counted, ${calibration.attempts} HTTP requests actually issued`);
    assert(`the transport instrument observed real requests (${calibration.attempts} > 0)`, calibration.attempts > 0);
    if (calibration.attempts === countedOps) {
        check("1 operation = 1 HTTP request on this run — no retries, no hidden pagination", calibration.attempts, countedOps);
        note("so the counter's floor equals the billed figure WHILE the base is not rate-limited; a 429 would raise attempts and not operations");
    } else {
        // Not a failure: this is the gap the module documents, and measuring it is
        // the point. It fails only if attempts are FEWER, which would mean the
        // counter is counting something that never left the process.
        note(`operations and HTTP requests differ by ${calibration.attempts - countedOps} — retries or pagination; the counted figure is a floor, as documented`);
        assert(
            `HTTP requests are never fewer than counted operations (${calibration.attempts} >= ${countedOps})`,
            calibration.attempts >= countedOps
        );
    }

    // -----------------------------------------------------------------------
    console.log("\nPart E — cross-check against #19's instrument");
    // THE EXPECTED RELATIONSHIP, STATED BEFORE THE COMPARISON. Agreement is only
    // evidence if disagreement was possible and predicted:
    //   find:  EQUAL, always. A find is one request and cannot paginate.
    //   list:  this layer >= #19's. It counts one operation per PAGE; #19's counts
    //          one per select() CALL. They coincide only while every select fits
    //          inside one page (Airtable's is 100 records).
    console.log("  expected: find counts EQUAL; list counts equal only while no select paginates");
    resetOps();
    const probe = instrumentCallLayer();
    let mine;
    try {
        await base(TABLES.USERS).select({ fields: [] }).all();
        await base(TABLES.USERS).find(readA.result[0].id);
        mine = snapshot();
    } finally {
        probe.restore();
    }
    const mineByKind = {};
    for (const row of mine.rows) mineByKind[row.kind] = (mineByKind[row.kind] || 0) + row.count;
    console.log(`  this layer: list ${mineByKind.list ?? 0}, find ${mineByKind.find ?? 0} — #19's layer: select ${probe.counts.select}, find ${probe.counts.find}`);
    assert(`both instruments saw something (${mine.total} and ${probe.counts.select + probe.counts.find})`, mine.total > 0 && probe.counts.select + probe.counts.find > 0);
    check("find counts agree exactly", mineByKind.find ?? 0, probe.counts.find);
    check("and on a single-page select the list counts agree too", mineByKind.list ?? 0, probe.counts.select);

    // NOW FORCE THE DIVERGENCE, so the agreement above is a measurement rather
    // than a coincidence of small fixtures. `pageSize: 1` makes Airtable's own
    // offset pagination issue one request per record: #19's layer still counts
    // one select, this one counts every page. Using pageSize rather than hunting
    // for a 100-row table makes it deterministic and costs a handful of ops.
    const rowCount = readA.result.length;
    if (rowCount < 2) {
        incomplete = `${TABLES.USERS} has ${rowCount} row(s), so pagination could not be forced`;
        note(incomplete);
    } else {
        resetOps();
        const probe2 = instrumentCallLayer();
        let paged;
        try {
            await base(TABLES.USERS).select({ fields: [], pageSize: 1 }).all();
            paged = snapshot();
        } finally {
            probe2.restore();
        }
        const pagedList = paged.rows.reduce((n, r) => n + (r.kind === "list" ? r.count : 0), 0);
        console.log(`  paginated at pageSize 1 over ${rowCount} rows — this layer: list ${pagedList}, #19's layer: select ${probe2.counts.select}`);
        check("#19's layer still counts one select", probe2.counts.select, 1);
        check("this layer counts one operation per page", pagedList, rowCount);
        assert(
            `so the two layers genuinely diverge as predicted (${pagedList} vs ${probe2.counts.select})`,
            pagedList > probe2.counts.select
        );
        note("which is why the query budgets in verify-material-price-19.mjs are call counts, and these are request counts");
    }

    resetOps();
    complete = true;
} catch (err) {
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(60));
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
// Everything since the last reset, which is the TEARDOWN's own cost and nothing
// else — the parts above each reset before measuring. Reported rather than
// asserted at 0, which was this footer's first and wrong claim: the fixture
// helper's census and residue passes are themselves Airtable operations, and a
// figure for what verification housekeeping costs is worth having.
console.log("\nOperations the fixture teardown itself spent:");
console.log(formatSnapshot());
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);

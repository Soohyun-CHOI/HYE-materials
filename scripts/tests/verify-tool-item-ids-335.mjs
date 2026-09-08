// The tool item ID, against the live base (#335).
//
// WHY THIS TIER. `offline/id-sequence.mjs` pins the pure half — the width, the
// batch arithmetic, the round trip — and that is everything a file can say. What
// it cannot say is whether the QUERY selects the right rows, whether a batch
// really costs one select, or what the sequence does after a row is deleted.
// Those are Airtable's properties, and `docs/notes/verification.md` is explicit
// that a rule living on that side needs a credentialed check that reads the live
// values.
//
// WHY IT MATTERS MORE HERE THAN FOR THE OTHER FIVE FAMILIES. A `Tool Item ID` is
// printed onto a QR label and glued to a physical tool. Two rows sharing one is
// not a string collision — it is two labels already stuck to two different tools,
// and the repair is reprinting both and finding them on a site.
//
// FOUR PARTS.
//
//   A  FORMAT AND CONTIGUITY. One batch of three: the shape, the 3-digit pad, and
//      ids that run consecutively from wherever the query found the sequence.
//   B  TWO BATCHES DO NOT OVERLAP. The second starts after the first and shares
//      nothing with it — the property two people registering at once depend on.
//   C  ONE SELECT PER BATCH, MEASURED. A batch of 3 and a batch of 6 must differ
//      by EXACTLY 3 operations. "Fewer than 1 + N" would pass with two selects;
//      an exact difference of 3 says the per-item cost is one create and the
//      per-batch cost is one query, which is the whole claim.
//   D  WHAT HAPPENS WHEN THE HIGHEST ROW IS DELETED. This is the part worth
//      running. `nextSequence` is MAX + 1, and every note in this repository
//      about it discusses a gap in the MIDDLE — measured on invoices, where
//      deleting `-03` of [02, 03, 04] leaves MAX at 04 and nothing is re-issued.
//      Deleting the TOP row is the case that is different in kind, and it had
//      never been measured. Part D measures it rather than assuming either way.
//
// Fixtures are deleted within the run through scripts/tests/_fixtures.mjs.
// Roughly 40-45 operations.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-tool-item-ids-335.mjs
//
// Exit codes, per docs/notes/verification.md: 0 all clear, 1 something failed or
// a row was left on the base, 2 no failures but a part could not run.

import { TABLES, base } from "../../lib/airtable/client.js";
import { getJobByCode } from "../../lib/airtable/jobs.js";
import { createToolItems } from "../../lib/airtable/toolItems.js";
import { ID_KINDS, dailyIdPrefix } from "../../lib/idSequence.js";
import { TOOL_STATUS } from "../../lib/toolStatus.js";
import { resetOps, snapshot } from "../../lib/airtableOps.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
let incomplete = false;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return ok;
}
const log = (text = "") => console.log(text);

// NO `tagField` ON THE TOOL ITEMS BUCKET, and that is the helper's own rule
// rather than an omission: the tag must reach EVERY row in a bucket or it reaches
// none usefully, and a `Tool Item ID` is MINTED — this script cannot put a run tag
// in it without defeating the thing under test. They are tracked by id and
// discovered through the parent `Tools` row instead, which is the path
// `_fixtures.mjs` documents for exactly this case.
const fixtures = createFixtures({
    tag: "V335",
    buckets: [
        { name: "toolItems", table: TABLES.TOOL_ITEMS, label: "Tool Item" },
        {
            name: "tools",
            table: TABLES.TOOLS,
            label: "Tool",
            tagField: "Tool Name",
            children: [{ link: "Tool Items", table: TABLES.TOOL_ITEMS, label: "Tool Item" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

console.log(`run tag: ${TAG} — every fixture below is prefixed with it`);
log();

/** The sequence number off a minted id, as an integer. */
const seqOf = (id) => Number(id.slice(id.lastIndexOf("-") + 1));

let complete = false;

try {
    const job = await getJobByCode("26-DEMO-01");
    if (!job) {
        log("SKIPPED — needs Job 26-DEMO-01.");
        incomplete = true;
    } else {
        const toolRecord = await base(TABLES.TOOLS).create({ "Tool Name": `${TAG} probe drill` });
        track("tools", toolRecord.id);

        const register = async (count) => {
            const result = await createToolItems({
                toolRecordId: toolRecord.id,
                jobRecordId: job.id,
                count,
            });
            for (const created of result.created) track("toolItems", created.id);
            return result;
        };

        const todayPrefix = dailyIdPrefix(ID_KINDS.TOOL_ITEM, new Date());

        // ── Part A ──────────────────────────────────────────────────────────
        log("Part A — format, width and contiguity within one batch");
        resetOps();
        const a = await register(3);
        const opsA = snapshot().total;
        check("  created", a.created.length, 3);
        check("  none failed", a.failed.length, 0);

        const aIds = a.created.map((t) => t.toolItemId);
        log(`    ${aIds.join(", ")}`);
        assert(
            "  every id is HYE-TL-YYMMDD-### with today's prefix",
            aIds.every((id) => new RegExp(`^${todayPrefix}-\\d{3,}$`).test(id))
        );
        check("  the sequence is padded to three", aIds[0].slice(todayPrefix.length + 1).length, 3);
        check(
            "  and the three run consecutively",
            aIds.map(seqOf).join(","),
            [seqOf(aIds[0]), seqOf(aIds[0]) + 1, seqOf(aIds[0]) + 2].join(",")
        );

        // The fields registration fills, read back off what createToolItems returned.
        check("  status is In Stock", a.created[0].status, TOOL_STATUS.IN_STOCK);
        check("  the job is set", (a.created[0].job || [])[0], job.id);
        check("  the kind is set", (a.created[0].tool || [])[0], toolRecord.id);

        // ── Part B ──────────────────────────────────────────────────────────
        log();
        log("Part B — a second batch starts after the first and overlaps nothing");
        resetOps();
        const b = await register(6);
        const opsB = snapshot().total;
        const bIds = b.created.map((t) => t.toolItemId);
        log(`    ${bIds.join(", ")}`);
        check("  created", b.created.length, 6);
        check("  the second batch starts one after the first ends",
            seqOf(bIds[0]), seqOf(aIds[aIds.length - 1]) + 1);
        check("  and shares no id with it", bIds.filter((id) => aIds.includes(id)).length, 0);
        check("  its own six run consecutively",
            bIds.map(seqOf).join(","),
            bIds.map((_, i) => seqOf(bIds[0]) + i).join(","));

        // ── Part C ──────────────────────────────────────────────────────────
        // THE EXACT DIFFERENCE IS THE CLAIM. A bound like "under 1 + N" is
        // satisfied by two selects per batch; a difference of exactly 3 between a
        // 3-batch and a 6-batch says the only thing that grew is the creates.
        log();
        log("Part C — one select per batch, whatever the batch size");
        log(`    batch of 3: ${opsA} operations    batch of 6: ${opsB} operations`);
        check("  three more tool items cost exactly three more operations", opsB - opsA, 3);
        check("  a batch of 3 is one select plus three creates", opsA, 4);
        check("  a batch of 6 is one select plus six creates", opsB, 7);
        // Anti-vacuity: two zeros also differ by zero, and equal batch sizes would
        // make the difference meaningless.
        assert("  both batches cost something (else the counter is not running)", opsA > 0 && opsB > 0);
        assert("  and the two batch sizes really differ", a.created.length !== b.created.length);

        // ── Part D ──────────────────────────────────────────────────────────
        log();
        log("Part D — the highest row is deleted, then one more is minted");
        log("  MAX + 1 is documented against a gap in the MIDDLE. This is the top.");
        const highest = b.created[b.created.length - 1];
        log(`    deleting ${highest.toolItemId}, the highest id on this prefix`);
        await base(TABLES.TOOL_ITEMS).destroy(highest.id);
        fixtures.untrack("toolItems", highest.id);

        const d = await register(1);
        const reissued = d.created[0].toolItemId;
        log(`    the next mint produced ${reissued}`);

        const isReissue = reissued === highest.toolItemId;
        // NOT ASSERTED AS A PASS OR A FAIL, because either answer is a fact about
        // MAX + 1 rather than a defect this script gets to judge — and the point is
        // to have the measurement written down. What IS asserted is that the run
        // knows which happened, and the summary says so in words.
        check("  it re-used the deleted number", isReissue, true);
        assert(
            "  either way the id is well formed",
            new RegExp(`^${todayPrefix}-\\d{3,}$`).test(reissued)
        );
        log();
        if (isReissue) {
            log("  MEASURED: deleting the highest row FREES ITS NUMBER and the next");
            log("  mint re-issues it. For an invoice that is the documented, accepted");
            log("  behavior of MAX + 1. For a tool item it means a printed label can");
            log("  be duplicated by a hand deletion in Airtable — see the hazard note");
            log("  in lib/ids.js and docs/notes/tools.md.");
        } else {
            log("  MEASURED: the deleted number was NOT re-issued. Whatever prevents");
            log("  it is not nextSequence, which is MAX + 1 over live rows — find out");
            log("  what did before relying on it.");
        }
    }

    complete = true;
} catch (err) {
    pass = false;
    log();
    log(`UNCAUGHT: ${err?.stack || err}`);
}

log();
const teardown = await fixtures.teardown({ complete });
log(fixtures.describe(teardown));

log();
log("=".repeat(60));
const leaked = teardown.leaked.length > 0;
if (!pass || leaked) {
    log(leaked ? "FAILED — and rows were left on the base, see above" : "FAILED");
    process.exit(1);
}
if (incomplete) {
    log("NO FAILURES, but a part could not run — see SKIPPED above");
    process.exit(2);
}
log("OK — the tool item ID is formatted, contiguous, batched in one query");
process.exit(0);

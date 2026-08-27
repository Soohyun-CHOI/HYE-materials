// Demo data for looking at #176 in a browser.
//
// #176 puts a strip above /pos listing approved purchase requests that have no
// purchase order. NONE existed on this base: measured before seeding, 40 PRs were
// Approved or PO Signed and every one of them had an order, so the strip had only
// its empty state to show and the empty state is invisible by design.
//
// THIS STATE CANNOT BE REACHED THROUGH THE APP, WHICH IS WHY THE STATUS IS
// WRITTEN DIRECTLY. Generation runs inside the approving action, synchronously,
// and the action does not roll the approval back when it throws — so in
// production an Approved PR with no PO is what a FAILED generation leaves behind.
// A seed cannot fail on purpose: calling the real approve path always produces
// the order. The only way to stand the state up is to set `Status` to `Approved`
// and not call generatePOForApprovedPR at all.
//
// THAT IS NOT A NEW LIBERTY. seed_delivery_status_166.mjs does the same write —
// `updatePR(pr.id, { status: "Approved" })` — and then generates; this one stops
// one line earlier. seed_material_prices.mjs goes further and writes
// `Created Date` on a PO through the raw table. Direct field writes are what
// demo scripts are allowed and lib/ is not, which is the split
// docs/notes/verification.md draws.
//
// ⚠ ONCE THIS HAS RUN, THE /pos STRIP ON THIS BASE IS NEVER EMPTY AGAIN. The
// rows it creates are ordinary records and this repo does not delete records as
// tidying-up, so the empty state — which is the NORMAL state of this feature and
// the one a reader most needs to recognize — becomes unobservable here. #176
// looked at it before running this, in that order and deliberately, and that is
// the only chance a single base gets. Anyone who needs the empty state again
// wants a different base or a temporary `Status` change on these two PRs, and
// the second is a hand edit to seeded demo data rather than something this
// script offers.
//
// SKIP-IF-EXISTS KEYED ON THE STATE ITSELF, not on a marker row. Every other
// seed here checks for its own first Materials row; this one creates no PO, so
// it creates no Materials row to check for. It asks the production rule instead —
// selectPRsAwaitingPO over getApprovedPRs, the same two functions /pos calls —
// which also means a real failed generation counts as already-seeded and this
// script will not pile demo rows on top of a genuine one.

import { getAllJobs } from "../../lib/airtable/jobs.js";
import { getAllDisciplines } from "../../lib/airtable/disciplines.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { createPR, updatePR, getApprovedPRs } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { selectPRsAwaitingPO } from "../../lib/poListView.js";

const JOB_CODE = "26-DEMO-01";
const VENDOR_NAME = "Lone Star Pipe & Supply";
const SIZE = '2"';
const UNIT = "EA";

// TWO, NOT ONE, AND THE SECOND EARNS ITS COST. One row proves the strip renders;
// two prove the things #176 actually decided — that the heading pluralizes, and
// that the order is ascending by PR ID, which a single row cannot show either
// way. Both are raised the same day, so their IDs differ only in the sequence
// and the ascending order is visible as -01 above -02.
const ORDERS = [
    { itemName: "176-DEMO Gate Valve", qty: 4, unitPrice: 125 },
    { itemName: "176-DEMO Check Valve", qty: 2, unitPrice: 240 },
];

console.log("=".repeat(72));
console.log("seed_po_backlog_176 — an approved request with no purchase order");
console.log("=".repeat(72));

const [jobs, disciplines, vendors, users] = await Promise.all([
    getAllJobs(),
    getAllDisciplines(),
    getAllVendors(),
    getActiveUsers(),
]);

const job = jobs.find((j) => j.jobCode === JOB_CODE);
if (!job) throw new Error(`no job ${JOB_CODE} — run scripts/demo/seed_demo_fixtures.mjs first`);
const discipline = disciplines.find((l) => l.jobId === job.id);
if (!discipline) throw new Error(`job ${JOB_CODE} has no Discipline — run seed_demo_fixtures.mjs first`);
const vendor = vendors.find((v) => v.vendorName === VENDOR_NAME);
if (!vendor) throw new Error(`no vendor "${VENDOR_NAME}" — run seed_demo_fixtures.mjs first`);
const requester = users[0];
if (!requester) throw new Error("no active user to raise the PRs as");

console.log(`job      ${job.jobCode}`);
console.log(`discipline ${discipline.disciplineLabel}`);
console.log(`vendor   ${vendor.vendorName}`);
console.log(`as       ${requester.userName} <${requester.email}>`);

// Declared before the skip check, because the skip path prints the guide too —
// the temporal-dead-zone trap seed_delivery_status_166.mjs's header records.
const created = [];

const already = selectPRsAwaitingPO(await getApprovedPRs());
if (already.length > 0) {
    console.log(
        `\nAlready seeded — ${already.length} approved request(s) already have no purchase order: ` +
            `${already.map((pr) => pr.prId).join(", ")}. Nothing created.`
    );
    printGuide();
    process.exit(0);
}

for (const order of ORDERS) {
    const pr = await createPR({
        requesterId: requester.id,
        disciplineId: discipline.id,
        vendorId: vendor.id,
        notes: "176-DEMO fixture — approved, PO generation failed",
    });
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: order.itemName,
        size: SIZE,
        unit: UNIT,
        qty: order.qty,
        unitPrice: order.unitPrice,
        remark: "",
    });
    // THE WHOLE POINT IS THE LINE THAT IS NOT HERE. seed_delivery_status_166.mjs
    // calls generatePOForApprovedPR next; this does not, which leaves exactly what
    // a thrown generation leaves.
    await updatePR(pr.id, { status: "Approved" });
    created.push(pr.prId);
    console.log(`  raised and approved ${pr.prId} — ${order.itemName}, no PO`);
}

printGuide();

function printGuide() {
    const ids = created.length ? created : already.map((pr) => pr.prId);
    console.log("\n" + "-".repeat(72));
    console.log("WHERE TO LOOK");
    console.log("-".repeat(72));
    console.log(`
/pos, signed in as an Admin (soo@hanyangengusa.com)
  A strip above the table: "${ids.length} approved requests have no purchase order",
  then "Generation failed when the request was approved. Generate the order here."
  One row per request — ${ids.join(", ") || "(ids unknown on a re-run)"} — each with
  a Generate PO button. Oldest PR ID first.

/pos, signed in as scoped-fixture@hanyangengusa.com (Employee, non-Admin,
assigned ${JOB_CODE})
  The same strip and the same rows, because canViewPR admits them through the
  job assignment — but the second sentence reads "Ask the office to generate it."
  and there is NO button. That pair is the thing to look at: the strip reports to
  everyone who can see the request and offers the action only to whoever can take
  it.

/prs/<one of the ids above>
  The Purchase Order section now says generation FAILED rather than that it
  "hasn't completed yet". The Admin retry is unchanged and still lives here.

Pressing Generate PO from either screen fixes the row and removes it from the
strip. There is no way back on this base — see the warning in this file's header.
`);
}

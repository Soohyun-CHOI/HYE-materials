// An item lent to another job and returned to the job that owns it (#598).
//
// WHAT THIS IS DEFENDING. An item belongs to the job it was registered on, `Assets."Owner Job"`, and
// stands on `Assets."Job"`. A site manager on the owner job lends an item in stock there to another
// job, where it is in stock and recorded on as that job's own; a site manager there returns it to its
// owner, and it is lent on by nobody. A retirement takes the owner job, so an item retired on loan goes
// back to its owner as it ends (Soo). The owner's list counts it as On loan outside Total, the job it
// stands on counts it as its own, and all jobs count it once. One judgment decides the offers —
// `lib/assetTransition.js:planTransition` — and each place that could drift from it is held here.
//
// SO IT HOLDS:
//
//   1. THE JUDGMENT BY VALUE: six readers over an item on its owner job and on loan, in each status,
//      with no owner job, and with no other job to lend to — `mayLend`, `lendJobs`, `mayReturn`,
//      `onLoan` and what else the plan offers.
//   2. WHERE EACH EVENT'S ROW GOES (`rowJob`): a lending the job chosen, a return and a retirement the
//      owner job, the rest the item's own — a retirement on loan included.
//   3. A PRESS BY VALUE (`readLend`, `readReturn`): the order of the refusals, a lending left half done
//      finished with no second entry, another job refused there, and nothing lent on.
//   4. THE LIST'S COUNT BY VALUE: the owner's On loan outside Total, the borrower's own, all jobs once,
//      the `Job` chip, a search by the lent item's id, a kind's page's row and its box, the export.
//   5. THE WRITES OFF THEIR SOURCE: the two actions' wrapper, fresh plan and latest entry, the entry
//      before the item and only where due, the item's write caught and named, no `writeEvent`; the
//      provider, the menu, the dialog and the sheet, the return's question, the page's caption and its
//      history's route; the registration and the office's change writing `Owner Job`.
//   6. THE FILL'S PLAN BY VALUE (`scripts/import/fill_owner_job_598_plan.mjs`).
//   7. EVERY WORD by value, from the copy constants.
//
// WHAT A PASS DOES NOT PROVE. That a page draws any of it, or what a press costs against the base —
// the browser walk and the dev log, written into the pull request. The fences on the live base are
// `offline/protected-tables.mjs`'s; the vocabulary's maps `offline/asset-status.mjs`'s.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { assetListScope, categoryListRows, countColumns, holderRowIds, loanedTo, readCategoryList, assetCategoriesInScope, idsInScope } from "../../../lib/assetListView.js";
import { ASSET_TRANSITION_COPY, lendStart, planTransition, readLend, readRetirement, readReturn, rowJob } from "../../../lib/assetTransition.js";
import { ASSET_COPY, loanRoute, logRowFacts } from "../../../lib/assetView.js";
import { ASSET_EXPORT_COPY, listExport } from "../../../lib/assetListExport.js";
import { ASSET_EVENT, ASSET_STATUS } from "../../../lib/assetStatus.js";
import { ALL_JOBS } from "../../../lib/assetRoutes.js";
import { fillLine, fillsByJob, inBatches, planFill, planRevert } from "../../import/fill_owner_job_598_plan.mjs";
import { callsTo, insideTry, parseFile, parseSource, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An item lent to another job and returned to its owner (#598)";

const ACTIONS = "app/(assets)/assets/[assetId]/actions.js";
const PROVIDER = "app/(assets)/assets/[assetId]/AssetTransition.js";
const MENU = "app/(assets)/assets/[assetId]/MoreActions.js";
const LEND = "app/(assets)/assets/[assetId]/LendDialog.js";
const RETURN = "app/(assets)/assets/[assetId]/ReturnConfirm.js";
const PAGE = "app/(assets)/assets/[assetId]/page.js";
const CAPTION = "app/(assets)/CategoryCaption.js";
const KIND_LIST = "app/(assets)/asset-categories/[categoryRecordId]/AssetList.js";
const KIND_PAGE = "app/(assets)/asset-categories/[categoryRecordId]/page.js";
const ASSETS = "lib/airtable/assets.js";
const JOBS_MODULE = "lib/airtable/jobs.js";

const OWNER = { id: "recO", jobCode: "25-USA-13" };
const BORROWER = { id: "recB", jobCode: "26-USA-12" };
const OTHER = { id: "recC", jobCode: "23-USA-09" };
const JOBS = [OWNER, BORROWER, OTHER];

/** The readers the issue names. */
const READERS = {
    "site manager on the owner": { isSiteManager: true, assignedJobs: [OWNER.id] },
    "site manager on the borrower": { isSiteManager: true, assignedJobs: [BORROWER.id] },
    "site manager on both": { isSiteManager: true, assignedJobs: [BORROWER.id, OWNER.id] },
    "site manager on another": { isSiteManager: true, assignedJobs: [OTHER.id] },
    "not a site manager, on the owner": { isSiteManager: false, assignedJobs: [OWNER.id] },
    "the office, not a site manager": { isAdmin: true, isSiteManager: false, assignedJobs: [OWNER.id] },
};

const plan = (reader, { status = ASSET_STATUS.IN_STOCK, job = OWNER.id, owner = OWNER.id, latest = null, jobs = JOBS } = {}) =>
    planTransition({ user: READERS[reader] ?? reader, jobs, status, assetJobId: job, ownerJobId: owner, latest });
const offers = (p) =>
    [
        p.records ? "records" : "reads",
        p.mayLend ? `lend(${p.lendJobs.map((j) => j.jobCode).join(",")})` : null,
        p.mayReturn ? "return" : null,
        p.event ? `press ${p.event}` : null,
        p.onLoan ? `on loan from ${p.ownerJobCode}` : null,
    ]
        .filter(Boolean)
        .join(" · ");

export function run({ check, assert, log }) {
    // ── 1: who may lend, who may return, by value ───────────────────────────
    log("the judgment, by value (planTransition):");
    const atHome = Object.keys(READERS).map((who) => `${who}: ${offers(plan(who))}`).join(" | ");
    check(
        "an item in stock on its owner job: lent by a site manager there, to every other job by code",
        atHome,
        [
            "site manager on the owner: records · lend(23-USA-09,26-USA-12) · press Checked out",
            "site manager on the borrower: reads",
            "site manager on both: records · lend(23-USA-09,26-USA-12) · press Checked out",
            "site manager on another: reads",
            "not a site manager, on the owner: reads",
            "the office, not a site manager: reads",
        ].join(" | ")
    );
    const onLoan = Object.keys(READERS).map((who) => `${who}: ${offers(plan(who, { job: BORROWER.id }))}`).join(" | ");
    check(
        "an item in stock on loan: returned by a site manager on the borrower, lent on by nobody, read by the owner",
        onLoan,
        [
            "site manager on the owner: reads · on loan from 25-USA-13",
            "site manager on the borrower: records · return · press Checked out · on loan from 25-USA-13",
            "site manager on both: records · return · press Checked out · on loan from 25-USA-13",
            "site manager on another: reads · on loan from 25-USA-13",
            "not a site manager, on the owner: reads · on loan from 25-USA-13",
            "the office, not a site manager: reads · on loan from 25-USA-13",
        ].join(" | ")
    );
    const statuses = [ASSET_STATUS.IN_STOCK, ASSET_STATUS.OUT, ASSET_STATUS.IN_REPAIR, ASSET_STATUS.RETIRED];
    check(
        "only from stock, at home and on loan",
        statuses
            .map((status) => `${status}: ${plan("site manager on the owner", { status }).mayLend}/${plan("site manager on the borrower", { status, job: BORROWER.id }).mayReturn}`)
            .join(" | "),
        "In stock: true/true | Out: false/false | In repair: false/false | Retired: false/false"
    );
    check("  a borrowed item out offers its check-in, as the borrower's own", plan("site manager on the borrower", { status: ASSET_STATUS.OUT, job: BORROWER.id }).event, ASSET_EVENT.CHECKED_IN);
    check("  and may be sent for repair and retired in stock, as the borrower's own", `${plan("site manager on the borrower", { job: BORROWER.id }).maySendForRepair} ${plan("site manager on the borrower", { job: BORROWER.id }).mayRetire} ${plan("site manager on the borrower", { job: BORROWER.id }).mayWriteNote}`, "true true true");
    check("an item with no owner job, standing before the fill, is lent by nobody", offers(plan("site manager on the owner", { owner: null })), "records · press Checked out");
    check("  nor returned, nor on loan", `${plan("site manager on the owner", { owner: null }).mayReturn} ${plan("site manager on the owner", { owner: null }).onLoan}`, "false false");
    check("a base with no other job lends to none", offers(plan("site manager on the owner", { jobs: [OWNER] })), "records · press Checked out");
    check("  the jobs a lending offers are a list's, less the owner", JSON.stringify(plan("site manager on the owner").lendJobs), JSON.stringify([{ id: OTHER.id, jobCode: OTHER.jobCode }, { id: BORROWER.id, jobCode: BORROWER.jobCode }]));
    check(
        "  the very jobs a list stands on, asked of the same reader, the owner left out",
        plan("site manager on the owner").lendJobs.map((j) => j.id).join(),
        assetListScope(READERS["site manager on the owner"], JOBS, null).jobs.map((j) => j.id).filter((id) => id !== OWNER.id).join()
    );
    check("the owner job's code rides the plan for the caption and the question", `${plan("site manager on the borrower", { job: BORROWER.id }).ownerJobCode} ${plan("site manager on the borrower", { job: BORROWER.id }).jobCode}`, "25-USA-13 26-USA-12");

    // ── a loan left half done ───────────────────────────────────────────────
    log("");
    log("a loan left half done (pendingLoan):");
    const lentEntry = { event: ASSET_EVENT.LENT, job: [BORROWER.id] };
    const returnedEntry = { event: ASSET_EVENT.RETURNED_TO_OWNER, job: [OWNER.id] };
    check("a Lent entry on a job the item does not stand on, while it stands on its owner", JSON.stringify(plan("site manager on the owner", { latest: lentEntry }).pendingLoan), JSON.stringify({ event: "Lent", jobId: BORROWER.id }));
    check("  none once the item stands where the entry says", plan("site manager on the borrower", { job: BORROWER.id, latest: lentEntry }).pendingLoan, null);
    check(
        "  nor while it stands on neither its owner nor the entry's job, nor has no owner job",
        `${plan("site manager on another", { job: OTHER.id, latest: lentEntry }).pendingLoan} ${plan("site manager on the owner", { owner: null, latest: lentEntry }).pendingLoan}`,
        "null null"
    );
    check("a Returned to owner entry on the owner while the item stands elsewhere", JSON.stringify(plan("site manager on the borrower", { job: BORROWER.id, latest: returnedEntry }).pendingLoan), JSON.stringify({ event: "Returned to owner", jobId: OWNER.id }));
    check("  none once it is back", plan("site manager on the owner", { latest: returnedEntry }).pendingLoan, null);
    check("  nor one on a job that is not its owner", plan("site manager on the borrower", { job: BORROWER.id, latest: { event: ASSET_EVENT.RETURNED_TO_OWNER, job: [OTHER.id] } }).pendingLoan, null);
    check("  and no other entry is a loan half done", plan("site manager on the owner", { latest: { event: ASSET_EVENT.CHECKED_IN, job: [BORROWER.id] } }).pendingLoan, null);
    check("  nor anything with no latest entry", plan("site manager on the owner").pendingLoan, null);

    // ── 2: where each event's row goes ──────────────────────────────────────
    log("");
    log("where each event's row goes (rowJob, JOB_SOURCE_OF_EVENT):");
    const loaned = plan("site manager on the borrower", { job: BORROWER.id });
    check(
        "on loan: the scans and the repair the borrower's, a return and a retirement the owner's, a lending the job chosen",
        [ASSET_EVENT.CHECKED_OUT, ASSET_EVENT.CHECKED_IN, ASSET_EVENT.SENT_FOR_REPAIR, ASSET_EVENT.RETURNED_FROM_REPAIR, ASSET_EVENT.RETIRED, ASSET_EVENT.RETURNED_TO_OWNER, ASSET_EVENT.LENT, ASSET_EVENT.CREATED]
            .map((event) => `${event}: ${rowJob(loaned, event, { chosenJobId: OTHER.id })}`)
            .join(" | "),
        "Checked out: recB | Checked in: recB | Sent for repair: recB | Returned from repair: recB | Retired: recO | Returned to owner: recO | Lent: recC | Created: null"
    );
    check("a retirement at home moves nothing", rowJob(plan("site manager on the owner"), ASSET_EVENT.RETIRED), OWNER.id);
    check("an item with no owner job retires where it is", rowJob(plan("site manager on the owner", { owner: null }), ASSET_EVENT.RETIRED), OWNER.id);
    check("a retirement on loan takes the owner job back (Soo)", JSON.stringify(readRetirement(loaned, { drawnJobId: BORROWER.id })), JSON.stringify({ jobRecordId: OWNER.id, refusal: null }));

    // ── 3: a press, by value ────────────────────────────────────────────────
    log("");
    log("a press, by value (readLend, readReturn):");
    const home = plan("site manager on the owner");
    const said = (answer) => JSON.stringify(answer);
    const writes = (jobRecordId, entry) => said({ jobRecordId, writesEntry: entry, writesAsset: true, refusal: null, stale: false });
    const refused = (refusal, stale = false) => said({ jobRecordId: null, writesEntry: false, writesAsset: false, refusal, stale });
    check("a lending writes its entry and the item, on the job chosen", said(readLend(home, { drawnJobId: OWNER.id, jobId: BORROWER.id })), writes(BORROWER.id, true));
    check("  none chosen is the design's sentence", said(readLend(home, { drawnJobId: OWNER.id, jobId: "" })), refused("Choose a job."));
    check("  the owner job itself is no choice", said(readLend(home, { drawnJobId: OWNER.id, jobId: OWNER.id })), refused("Choose a job."));
    check("  a job no list offers is none", said(readLend(home, { drawnJobId: OWNER.id, jobId: "recGone" })), refused("Choose a job."));
    check("  whose item it is now is asked first", said(readLend(home, { drawnJobId: BORROWER.id, jobId: "" })), refused("This item is on 25-USA-13 now. Nothing was saved."));
    check("  a page drawn before somebody checked it out is stale", said(readLend(plan("site manager on the owner", { status: ASSET_STATUS.OUT }), { drawnJobId: OWNER.id, jobId: BORROWER.id })), refused("Someone else recorded this first. Nothing was saved.", true));
    check("  a retired item says the terminal sentence", said(readLend(plan("site manager on the owner", { status: ASSET_STATUS.RETIRED }), { drawnJobId: OWNER.id, jobId: BORROWER.id })), refused("This item is retired."));
    check("nothing is lent on: the borrower's press is stale", said(readLend(loaned, { drawnJobId: BORROWER.id, jobId: OTHER.id })), refused("Someone else recorded this first. Nothing was saved.", true));
    check("  and the owner's, once lent, no longer theirs to record", said(readLend(plan("site manager on the owner", { job: BORROWER.id }), { drawnJobId: OWNER.id, jobId: OTHER.id })), refused("Only 26-USA-12 can record this item. Nothing was saved."));
    const halfLent = plan("site manager on the owner", { latest: lentEntry });
    check("a lending left half done is finished to its job with no second entry", said(readLend(halfLent, { drawnJobId: OWNER.id, jobId: BORROWER.id })), writes(BORROWER.id, false));
    check(
        "  another job refused, naming the one to finish with",
        said(readLend(halfLent, { drawnJobId: OWNER.id, jobId: OTHER.id })),
        refused("The item wasn't fully lent to 26-USA-12. Lend it again to finish.")
    );
    check("  and its dialog opens on that job, a fresh one on none", `${lendStart(halfLent)}|${lendStart(home)}`, `${BORROWER.id}|`);
    check("a return writes its entry and the item, on the owner job", said(readReturn(loaned, { drawnJobId: BORROWER.id })), writes(OWNER.id, true));
    check("  a page drawn before a check-out is stale", said(readReturn(plan("site manager on the borrower", { status: ASSET_STATUS.OUT, job: BORROWER.id }), { drawnJobId: BORROWER.id })), refused("Someone else recorded this first. Nothing was saved.", true));
    check("  one returned by somebody else since is no longer the reader's", said(readReturn(plan("site manager on the borrower"), { drawnJobId: BORROWER.id })), refused("Only 25-USA-13 can record this item. Nothing was saved."));
    check("  and an item at home is none to return", said(readReturn(home, { drawnJobId: OWNER.id })), refused("Someone else recorded this first. Nothing was saved.", true));
    check("a return left half done writes the item alone", said(readReturn(plan("site manager on the borrower", { job: BORROWER.id, latest: returnedEntry }), { drawnJobId: BORROWER.id })), writes(OWNER.id, false));

    // ── 4: the list's count, by value ───────────────────────────────────────
    log("");
    log("the list's count, by value (assetListScope, categoryListRows, readCategoryList):");
    // The owner owns a1, a2 and the two it lent, a3 in stock and a4 out at the borrower; the borrower
    // stands on those two and its own b1; another job holds c1 of another kind.
    const jobs = [
        { ...OWNER, assets: ["a1", "a2"], ownedAssets: ["a1", "a2", "a3", "a4"] },
        { ...BORROWER, assets: ["a3", "a4", "b1"], ownedAssets: ["b1"] },
        { ...OTHER, assets: ["c1"], ownedAssets: ["c1"] },
    ];
    const kinds = [
        { id: "recK1", itemName: "Drill", level1: "Tool", level2: "Power tools", assets: ["a1", "a2", "a3", "a4", "b1"] },
        { id: "recK2", itemName: "Saw", level1: "Tool", level2: "Power tools", assets: ["c1"] },
    ];
    const facts = (status, assetId, lastEventAt) => ({ status, assetId, lastEventAt });
    const kept = new Map([
        ["a1", facts("In stock", "HYE-AST-261001-001", "2026-10-01T12:00:00.000Z")],
        ["a2", facts("Retired", "HYE-AST-261001-002", "2026-10-02T12:00:00.000Z")],
        ["a3", facts("In stock", "HYE-AST-261001-003", "2026-10-20T12:00:00.000Z")],
        ["a4", facts("Out", "HYE-AST-261001-004", "2026-10-05T12:00:00.000Z")],
        ["b1", facts("In stock", "HYE-AST-261002-001", "2026-10-03T12:00:00.000Z")],
        ["c1", facts("In stock", "HYE-AST-261003-001", "2026-10-04T12:00:00.000Z")],
    ]);
    const reader = { isSiteManager: true, assignedJobs: [OWNER.id] };
    const rowsOn = (rawJob) => {
        const scope = assetListScope(reader, jobs, rawJob);
        return { scope, rows: categoryListRows(assetCategoriesInScope(kinds, scope.shown), scope, kept) };
    };
    const countsOf = (row) => `${row.itemName}: ${row.counts.map((c) => c.count).join("/")} on loan ${row.onLoan}`;
    const owner = rowsOn(OWNER.id);
    check("the owner's scope shows its own and the two it lent", `${[...owner.scope.shown].join(",")} lent ${[...owner.scope.lent].join(",")}`, "a1,a2,a3,a4 lent a3,a4");
    check("  and counts them On loan, in no status", owner.rows.map(countsOf).join(" | "), "Drill: 1/0/0/1 on loan 2");
    const ownerRead = readCategoryList(owner.rows, new URLSearchParams(""), { allJobs: false });
    check("  outside its Total", ownerRead.rows.map((row) => row.total).join(), "1");
    check("  its latest change the lent item's", ownerRead.rows[0].updatedAt, "2026-10-20T12:00:00.000Z");
    check("  and no printed id of theirs on its rows", JSON.stringify(owner.rows[0].assetIds), JSON.stringify({ recO: { "In stock": ["HYE-AST-261001-001"], Retired: ["HYE-AST-261001-002"] } }));
    const borrower = rowsOn(BORROWER.id);
    check("the borrower counts them as its own, its Total holding them", `${borrower.rows.map(countsOf).join(" | ")} total ${readCategoryList(borrower.rows, new URLSearchParams(""), {}).rows.map((r) => r.total).join()}`, "Drill: 2/1/0/0 on loan 0 total 3");
    check("  its scope lending nothing", borrower.scope.lent.size, 0);
    const all = rowsOn(ALL_JOBS);
    check("all jobs count every item once, where it stands", all.rows.map(countsOf).join(" | "), "Drill: 3/1/0/1 on loan 0 | Saw: 1/0/0/0 on loan 0");
    check(
        "  every item of the kind counted exactly once",
        all.rows[0].counts.reduce((sum, c) => sum + c.count, 0) + all.rows[0].onLoan,
        kinds[0].assets.length
    );
    check("  and all jobs lend nothing", all.scope.lent.size, 0);
    const chip = readCategoryList(all.rows, new URLSearchParams(`job=${ALL_JOBS}&job=${OWNER.id}`), { allJobs: true, jobs: JOBS });
    check("the Job chip on the owner counts what stands there, nothing on loan", chip.rows.map((row) => `${row.itemName}: ${row.counts.map((c) => c.count).join("/")} on loan ${row.onLoan} total ${row.total}`).join(" | "), "Drill: 1/0/0/1 on loan 0 total 1");
    check(
        "a search by a lent item's id on the owner's list asks every job, the item standing elsewhere",
        `${readCategoryList(owner.rows, new URLSearchParams("q=HYE-AST-261001-003"), { allJobs: false, jobs: JOBS, job: OWNER.id }).asks}`,
        "HYE-AST-261001-003"
    );
    check("  and on the borrower's it is found in its row", readCategoryList(borrower.rows, new URLSearchParams("q=HYE-AST-261001-003"), { allJobs: false, jobs: JOBS, job: BORROWER.id }).found[0]?.status, "In stock");
    check(
        "the columns: On loan before Retired on one job, none on all",
        `${countColumns({ allJobs: false }).map((c) => (c.onLoan ? "On loan" : c.status)).join(",")} | ${countColumns({ allJobs: true }).map((c) => (c.onLoan ? "On loan" : c.status)).join(",")}`,
        "In stock,Out,In repair,On loan,Retired | In stock,Out,In repair,Retired"
    );
    const read = (id, job) => ({ id, job: [job], status: kept.get(id).status, assetLog: [`${id}-log`] });
    check(
        "a kind's page on the owner names the job a lent item stands on, and none for its own",
        ["a1", "a3", "a4"].map((id) => `${id}: ${JSON.stringify(loanedTo(owner.scope, read(id, id === "a1" ? OWNER.id : BORROWER.id)))}`).join(" | "),
        'a1: null | a3: "26-USA-12" | a4: "26-USA-12"'
    );
    check("  and on the borrower's none is on loan", loanedTo(borrower.scope, read("a3", BORROWER.id)), null);
    check("  a lent item out has no holder read on the owner's page", JSON.stringify(holderRowIds([read("a4", BORROWER.id)], owner.scope.lent)), "[]");
    check("  and has it read on the borrower's", JSON.stringify(holderRowIds([read("a4", BORROWER.id)], borrower.scope.lent)), '["a4-log"]');
    check("  the owner's kind page reads every item it owns of the kind", idsInScope(kinds[0].assets, owner.scope.shown).join(","), "a1,a2,a3,a4");

    // ── the export, by value ────────────────────────────────────────────────
    return exportAndRest({ check, assert, log, jobs, kinds, kept });
}

async function exportAndRest({ check, assert, log, jobs, kinds, kept }) {
    log("");
    log("the export on the owner's list (listExport):");
    const whole = (id, job, owner) => ({ id, assetId: kept.get(id).assetId, status: kept.get(id).status, job: [job], ownerJob: [owner], category: [kinds.find((k) => k.assets.includes(id)).id], note: "", assetLog: [`${id}-log`], lastEventAt: kept.get(id).lastEventAt });
    const askedRows = [];
    const held = [whole("a1", OWNER.id, OWNER.id), whole("a2", OWNER.id, OWNER.id), whole("a3", BORROWER.id, OWNER.id), whole("a4", BORROWER.id, OWNER.id), whole("b1", BORROWER.id, BORROWER.id), whole("c1", OTHER.id, OTHER.id)];
    const made = await listExport({
        user: { isSiteManager: true, assignedJobs: [OWNER.id] },
        search: `job=${OWNER.id}`,
        timeZone: "UTC",
        now: new Date("2026-10-22T12:00:00.000Z"),
        read: {
            categories: async () => kinds,
            jobs: async () => jobs,
            assets: async (ids) => held.filter((asset) => ids.includes(asset.id)),
            logRows: async (ids) => {
                askedRows.push(...ids);
                return ids.map((id) => ({ id, event: "Checked out", eventAt: "2026-10-21T15:00:00.000Z", checkedOutTo: "Dana K" }));
            },
        },
    });
    const [list, items] = made.sheets;
    check("the first sheet counts the lent two On loan, outside Total", `${list.columns.map((c) => c.header).join(",")} | ${list.rows.map((row) => row.join(",")).join(" | ")}`, "Name,Type,Category,In stock,Out,In repair,On loan,Retired,Total | Drill,Tool,Power tools,1,0,0,2,1,1");
    const at = (header) => items.columns.findIndex((c) => c.header === header);
    check(
        "the second lists every item it owns of the kind, each with its job, its owner job and its status there",
        items.rows.map((row) => `${row[0]} ${row[at("Job")]} ${row[at("Owner job")]} ${row[at("Status")]}`).join(" | "),
        "HYE-AST-261001-003 26-USA-12 25-USA-13 In stock | HYE-AST-261001-004 26-USA-12 25-USA-13 Out | HYE-AST-261001-002 25-USA-13 25-USA-13 Retired | HYE-AST-261001-001 25-USA-13 25-USA-13 In stock"
    );
    check("  the owner job's head the export's own word, after Job", `${items.columns[at("Job") + 1].header} ${ASSET_EXPORT_COPY.ownerJob}`, "Owner job Owner job");
    check(
        "  the lent one out has its holder read and named where it stands, as the page does not",
        `${askedRows.join(",")} | ${items.rows.map((row) => row[at("Checked out to")] ?? "").join(",")}`,
        "a4-log | ,Dana K,,"
    );

    // ── 5: the writes, off their source ─────────────────────────────────────
    log("");
    log("the writes, off their source:");
    const actions = parseFile(ACTIONS);
    const handlerOf = (name) => {
        const node = resolveFunction(actions.ast, name);
        return { node, source: node ? actions.source.slice(node.start, node.end) : "" };
    };
    for (const [action, handler, event, read] of [
        ["lendAssetAction", "lendAssetHandler", "LENT", "readLend"],
        ["returnAssetToOwnerAction", "returnAssetToOwnerHandler", "RETURNED_TO_OWNER", "readReturn"],
    ]) {
        const { source } = handlerOf(handler);
        assert(`${action} is a site manager's, round a handler nobody can call`, new RegExp(`export const ${action} = withSiteManagerAction\\(${handler}\\);`).test(actions.source) && !new RegExp(`export async function ${handler}\\b`).test(actions.source));
        assert(`  ${action}'s scope its own name, the asset read by its printed id`, new RegExp(`withOpsLabel\\("${action}",`).test(source) && /const asset = await getAssetByAssetId\(String\(formData\.get\("assetId"\) \?\? ""\)\);/.test(source));
        assert(`  planned on a fresh read with its latest entry, then asked ${read}`, /const plan = await planLoan\(\{ user, asset \}\);/.test(source) && new RegExp(`const answer = ${read}\\(plan,`).test(source));
        assert(
            `  a stale press said as 1k says it, any refusal before a write, then writeLoan with ${event}`,
            new RegExp(`if \\(answer\\.stale\\) return refuseStale\\(\\{ asset, refusal: answer\\.refusal, attempted: ASSET_EVENT\\.${event} \\}\\);\\s*if \\(answer\\.refusal\\) return refuse\\(answer\\.refusal\\);`).test(source) &&
                source.indexOf("if (answer.refusal)") < source.indexOf("await writeLoan(") &&
                new RegExp(`event: ASSET_EVENT\\.${event},`).test(source)
        );
        check(`  ${action} calls no writeEvent, which would write a second entry`, /writeEvent\(/.test(source), false);
    }
    const planLoan = handlerOf("planLoan").source;
    assert(
        "the plan reads the job list and the latest entry together, and hands both and the owner job on",
        /const latestId = asset\.assetLog\?\.at\(-1\);/.test(planLoan) &&
            /await Promise\.all\(\[getAllJobs\(\), latestId \? getAssetLogByAsset\(asset\.id, \{ rowIds: \[latestId\] \}\) : \[\]\]\)/.test(planLoan) &&
            /ownerJobId: asset\.ownerJob\?\.\[0\],\s*latest: rows\[0\] \?\? null,/.test(planLoan)
    );
    const writeLoan = handlerOf("writeLoan");
    const entryCall = callsTo(writeLoan.node ?? {}, "createAssetLogEntry")[0];
    const cacheCall = callsTo(writeLoan.node ?? {}, "updateAssetCache")[0];
    check(
        "writeLoan writes the entry where due, then the item, its write caught and the entry's not",
        `${/if \(answer\.writesEntry\) \{\s*await createAssetLogEntry\(/.test(writeLoan.source)} ${Boolean(entryCall && cacheCall && entryCall.start < cacheCall.start)} ${entryCall ? insideTry(writeLoan.node, entryCall) : "none"} ${cacheCall ? insideTry(writeLoan.node, cacheCall) : "none"}`,
        "true true false true"
    );
    assert(
        "  the item's job the answer's and its status the event's, a failed write named and never written back",
        /await updateAssetCache\(\{ assetRecordId: asset\.id, status: statusAfterEvent\(event\), jobRecordId: answer\.jobRecordId \}\);/.test(writeLoan.source) &&
            /\} catch \(error\) \{\s*console\.error\([\s\S]*?return refuse\(halfDone\);\s*\}/.test(writeLoan.source) &&
            callsTo(writeLoan.node ?? {}, "updateAssetCache").length === 1
    );
    check("  writeLoan is no entry point", /export (async )?function writeLoan|export const writeLoan/.test(actions.source), false);
    // The three older actions plan with the owner job too, which a retirement on loan writes, and so
    // does the serial number's (#601), the note's twin.
    check(
        "every plan an action makes names the item's owner job",
        `${(actions.source.match(/ownerJobId: asset\.ownerJob\?\.\[0\]/g) ?? []).length} ${callsTo(actions.ast, "planTransition").length}`,
        "5 5"
    );
    assert("the retirement writes the job readRetirement answers, the owner job on loan", /const \{ jobRecordId, refusal \} = readRetirement\(plan,/.test(actions.source) && /event: ASSET_EVENT\.RETIRED,\s*jobRecordId,/.test(actions.source));

    // The provider, the menu and the two openings.
    const provider = parseFile(PROVIDER).source;
    assert(
        "the provider holds both answers and draws the return's question while the plan offers it",
        /useActionState\(lendAssetAction, null\)/.test(provider) &&
            /useActionState\(returnAssetToOwnerAction, null\)/.test(provider) &&
            /\{plan\.mayReturn && \(\s*<ReturnConfirm/.test(provider) &&
            /ownerJobCode=\{plan\.ownerJobCode \?\? ""\}\s*jobCode=\{plan\.jobCode \?\? ""\}/.test(provider)
    );
    assert(
        "  ending a lending and a return the plan no longer offers",
        /if \(lendingOn !== null && !plan\.mayLend\) endLending\(\);/.test(provider) && /if \(returning && !plan\.mayReturn\) endReturning\(\);/.test(provider)
    );
    assert(
        "  and saying each where its opening stands or under the status",
        /lend: lendSaidInDialog \? null : lendSentence,/.test(provider) && /return: returnSaidInDialog \? null : returnSentence,/.test(provider) && /refusal: lendSaidInDialog \? lendSentence : null,/.test(provider)
    );
    const menu = parseFile(MENU).source;
    assert(
        "the menu offers a loan's line on the plan's word, after the sending and before the office's",
        /const mayLend = Boolean\(transition\?\.plan\.mayLend\);/.test(menu) &&
            /const mayReturn = Boolean\(transition\?\.plan\.mayReturn\);/.test(menu) &&
            menu.indexOf('key: "repair"') < menu.indexOf('key: "lend"') &&
            menu.indexOf('key: "lend"') < menu.indexOf('key: "return"') &&
            menu.indexOf('key: "return"') < menu.indexOf('key: "job"') &&
            menu.indexOf('key: "return"') < menu.indexOf("const ends = [")
    );
    assert(
        "  each line there only on its own word, under the control's own name",
        /\.\.\.\(mayLend\s*\?\s*\[\s*\{\s*key: "lend",\s*label: ASSET_TRANSITION_COPY\.control\[ASSET_EVENT\.LENT\],/.test(menu) &&
            /\.\.\.\(mayReturn\s*\?\s*\[\s*\{\s*key: "return",\s*label: ASSET_TRANSITION_COPY\.control\[ASSET_EVENT\.RETURNED_TO_OWNER\],/.test(menu)
    );
    assert(
        "  the lending opening this width's own, the return its question",
        /transition\.lend\.start\(phone \? "phone" : "desk"\);/.test(menu) && /transition\.openReturn\(\);/.test(menu) && /\{mayLend && \(phone \? <LendSheet \/> : <LendDialog \/>\)\}/.test(menu)
    );
    check("  and a desk's rule over the retirement under a loan's line, a phone's none", /const ruled = mayChangeJob \|\| \(!phone && \(mayLend \|\| mayReturn\)\);/.test(menu), true);
    const lend = parseFile(LEND);
    for (const name of ["LendForm", "LendRows"]) {
        const node = resolveFunction(lend.ast, name);
        const body = node ? lend.source.slice(node.start, node.end) : "";
        assert(`${name} opens where lendStart says and asks readLend of the job chosen and the page's job`, /useState\(\(\) => lendStart\(plan\)\)/.test(body) && /const answer = readLend\(plan, \{ drawnJobId, jobId \}\);/.test(body));
        assert(`  ${name} sends nothing on a refusal, and sends the job chosen through the provider`, /if \(answer\.refusal\) \{\s*setPressed\(true\);[\s\S]*?return;\s*\}\s*lend\.send\(lendForm\(\{ assetId, drawnJobId, jobId \}\)\);/.test(body));
        assert(`  ${name} offers the plan's lendJobs and says whose it stays`, /plan\.lendJobs\.map/.test(body) && /COPY\.lendHelp\(\{ ownerJobCode: plan\.ownerJobCode \?\? "" \}\)/.test(body));
    }
    assert("  the phone's a sheet with its commitment at its foot, no Done at its head", /sheet\s+closesOnBackdrop/.test(lend.source) && !/done=\{/.test(lend.source));
    const returned = parseFile(RETURN).source;
    assert(
        "the return's question: its title, its sentence and its commitment the copy's, posting the drawn job",
        /title=\{COPY\.returnHeading\(\{ itemName, assetId, ownerJobCode \}\)\}/.test(returned) &&
            /COPY\.returnBody\(\{ ownerJobCode, jobCode \}\)/.test(returned) &&
            /\{COPY\.returnSubmit\}/.test(returned) &&
            /<input type="hidden" name="drawnJobId" value=\{drawnJobId \?\? ""\} \/>/.test(returned) &&
            !/variant="danger"/.test(returned)
    );

    // The page: the plan's loan facts, the caption, the route.
    const page = parseFile(PAGE).source;
    assert("the page plans with the owner job and its newest entry", /ownerJobId: asset\.ownerJob\?\.\[0\],\s*latest: history\[0\] \?\? null,/.test(page));
    assert(
        "  says On loan from at a desk while the plan says the item is on loan, and on a phone's job line",
        /ownerJob=\{transition\.onLoan \? transition\.ownerJobCode : null\}/.test(page) && /\{transition\.onLoan && transition\.ownerJobCode && \(/.test(page) && /<LoanedFrom ownerJob=/.test(page)
    );
    assert(
        "  and draws a loan entry's route from loanRoute, named off the job list",
        /route: routeCodes\(loanRoute\(rows, index\), jobCodeById\),/.test(page) && /<Icon name="arrow-right"/.test(page) && /\{COPY\.historyRouteArrow\}/.test(page)
    );
    const caption = parseFile(CAPTION).source;
    assert("the caption's On loan from is the copy's, before the owner job's code", /\{ASSET_COPY\.onLoanFrom\}<\/span> \{ownerJob\}/.test(caption));
    const kindList = parseFile(KIND_LIST).source;
    assert(
        "a kind's page row on loan says On loan and the job, carries no box, and its page box leaves it out",
        /\{onLoan \? COPY\.onLoanLabel : row\.status\}/.test(kindList) &&
            /\{!onLoan && \(\s*<Checkbox/.test(kindList) &&
            /const pageIds = rows\.filter\(\(row\) => row\.loanedTo === null \|\| row\.loanedTo === undefined\)\.map\(\(row\) => row\.assetId\);/.test(kindList)
    );
    assert("  handed loanedTo by its page, which reads no holder for one", /loanedTo: loanedTo\(scope, asset\),/.test(parseFile(KIND_PAGE).source) && /holderRowIds\(assets, scope\.lent\)/.test(parseFile(KIND_PAGE).source));
    const assets = parseFile(ASSETS).source;
    assert(
        "the registration writes the owner job with the job, and the office's change both, and nothing else writes it",
        /Job: \[jobRecordId\],\s*(\/\/[^\n]*\s*)?"Owner Job": \[jobRecordId\],/.test(assets) &&
            /fields: \{ Job: \[jobRecordId\], "Owner Job": \[jobRecordId\] \}/.test(assets) &&
            (assets.match(/"Owner Job": \[/g) ?? []).length === 2
    );
    check("  read as ownerJob on every asset, and the far side on every job", `${/ownerJob: record\.get\("Owner Job"\) \|\| \[\],/.test(assets)} ${/ownedAssets: record\.get\("Assets \(as Owner\)"\) \|\| \[\],/.test(parseFile(JOBS_MODULE).source)}`, "true true");
    // ANTI-VACUITY: a planted writer of the owner job is counted.
    check("  a third writer would be seen", ([...assets.matchAll(/"Owner Job": \[/g)].length + (parseSource('base(T).update([{ id, fields: { "Owner Job": [x] } }]);', "<planted>").source.match(/"Owner Job": \[/g) ?? []).length), 3);

    // ── the history's route ─────────────────────────────────────────────────
    log("");
    log("a loan's route in the history (loanRoute, logRowFacts):");
    const history = [
        { event: ASSET_EVENT.RETURNED_TO_OWNER, job: [OWNER.id] },
        { event: ASSET_EVENT.CHECKED_IN, job: [BORROWER.id] },
        { event: ASSET_EVENT.LENT, job: [BORROWER.id] },
        { event: ASSET_EVENT.CREATED, job: [OWNER.id] },
    ];
    check(
        "each loan entry runs from the job of the entry before it to its own, and no other entry has one",
        history.map((row, index) => JSON.stringify(loanRoute(history, index))).join(" | "),
        '{"from":"recB","to":"recO"} | null | {"from":"recO","to":"recB"} | null'
    );
    check("  a loan entry with none before it has no from", JSON.stringify(loanRoute([{ event: ASSET_EVENT.LENT, job: [BORROWER.id] }], 0)), '{"from":null,"to":"recB"}');
    check(
        "  and its entry carries the route as a fact, a check-out none even handed one",
        `${logRowFacts({ event: ASSET_EVENT.LENT, eventAt: "x", recordedByName: "y", route: { from: "a", to: "b" } }).map((f) => f.key).join(",")} | ${logRowFacts({ event: ASSET_EVENT.CHECKED_IN, eventAt: "x", recordedByName: "y", route: { from: "a", to: "b" } }).map((f) => f.key).join(",")}`,
        "event,eventAt,recordedBy,route | event,eventAt,recordedBy"
    );

    // ── 6: the fill's plan, by value ────────────────────────────────────────
    log("");
    log("the owner job's fill (fill_owner_job_598_plan.mjs):");
    const rows = [
        { id: "r1", assetId: "A1", status: "In stock", job: ["recO"], ownerJob: [] },
        { id: "r2", assetId: "A2", status: "Out", job: ["recB"] },
        { id: "r3", assetId: "A3", status: "In stock", job: ["recO"], ownerJob: ["recO"] },
        { id: "r4", assetId: "A4", status: "In stock", job: [], ownerJob: [] },
        { id: "r5", assetId: "A5", status: "Deleted", job: ["recO", "recB"], ownerJob: [] },
        { id: "r6", assetId: "A6", status: "Deleted", job: ["recC"] },
    ];
    const planned = planFill(rows);
    check("every row with no owner job and one job takes that job, a deleted one included", planned.fills.map((f) => `${f.id}:${f.jobId}`).join(" "), "r1:recO r2:recB r6:recC");
    check("  a row already owned, one on no job and one on two are left and said", planned.held.map((h) => `${h.id}:${h.why}`).join(" "), "r3:owned r4:no job r5:several jobs");
    check("  counted by job", JSON.stringify(fillsByJob(planned.fills)), '[{"jobId":"recO","count":1},{"jobId":"recB","count":1},{"jobId":"recC","count":1}]');
    check("  each fill's ledger line before and after", JSON.stringify(fillLine(planned.fills[0])), '{"type":"fill","id":"r1","assetId":"A1","before":[],"after":["recO"]}');
    check("  ten rows to a request", inBatches(Array.from({ length: 23 }, (_, i) => i)).map((b) => b.length).join(","), "10,10,3");
    const ledger = [{ type: "run" }, ...planned.fills.map(fillLine)];
    const now = [{ id: "r1", ownerJob: ["recO"] }, { id: "r2", ownerJob: ["recC"] }];
    const back = planRevert(ledger, now);
    check("a revert clears a row still holding what it wrote", back.clears.map((c) => c.id).join(), "r1");
    check("  and leaves one changed since and one gone, said", back.held.map((h) => `${h.id}:${h.why}`).join(" "), "r2:changed since r6:not on the base");

    // ── 7: every word ───────────────────────────────────────────────────────
    log("");
    log("every word a loan adds:");
    const C = ASSET_TRANSITION_COPY;
    check("the menu's two lines", `${C.control[ASSET_EVENT.LENT]} | ${C.control[ASSET_EVENT.RETURNED_TO_OWNER]}`, "Lend to another job | Return to owner");
    check("the lending's label, its choice, its line, its refusal and its commitment", [C.lendJobLabel, C.lendJobUnchosen, C.lendHelp({ ownerJobCode: "26-USA-01" }), C.lendNoneChosen, C.lendSubmit, C.working[ASSET_EVENT.LENT]].join(" | "), "Job | Choose a job | 26-USA-01 keeps owning it until it's returned. | Choose a job. | Lend | Lending…");
    check(
        "the return's question",
        [C.returnHeading({ itemName: "Battery M18, Milwaukee", assetId: "HYE-AST-260909-004", ownerJobCode: "26-USA-07" }), C.returnHeading({ itemName: "", assetId: "HYE-AST-260909-004", ownerJobCode: "26-USA-07" }), C.returnBody({ ownerJobCode: "26-USA-07", jobCode: "26-USA-06" }), C.returnSubmit, C.working[ASSET_EVENT.RETURNED_TO_OWNER]].join(" | "),
        "Return Battery M18, Milwaukee to 26-USA-07? | Return HYE-AST-260909-004 to 26-USA-07? | It goes back to 26-USA-07's list, and 26-USA-06 can no longer record it. | Return item | Returning…"
    );
    check("a lending left half done, naming the job it went to (#612)", C.lendHalfDone({ to: "26-USA-12" }), "The item wasn't fully lent to 26-USA-12. Lend it again to finish.");
    check("a return left half done, naming no job (#612)", C.returnHalfDone, "The item wasn't fully returned. Return it again to finish.");
    check("the page's and the list's words", [ASSET_COPY.onLoanFrom, ASSET_COPY.onLoan, ASSET_COPY.historyRouteArrow, ASSET_COPY.historyTo].join(" | "), "On loan from | On loan | → | to");
    check("what got in front of a loan", C.moved({ by: "Jisoo Park", event: ASSET_EVENT.LENT, at: "2026-10-05T13:50:00.000Z", attempted: ASSET_EVENT.CHECKED_OUT })[0], "Jisoo Park already lent this to another job on ");
}

if (isMain(import.meta.url)) standalone(title, run);

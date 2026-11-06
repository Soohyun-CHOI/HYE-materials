// An item is recorded on by its own job's site managers, and by nobody else (#597).
//
// WHAT THIS IS DEFENDING. An item's job is the one it sits on, `Assets."Job"`, and only a site
// manager assigned to that job records on it — checks it out or in, sends it for repair and takes
// it back, retires it, writes its note and prints its label. Until #597 a site manager recorded on
// every item, and a check-out or a check-in asked which of their jobs it was on and could move the
// item there. The rule has one judgment, `lib/assetJob.js:recordsOn`, and four places it reaches:
// the asset page's plan, the three actions behind its controls on a fresh read, a list's
// `Add items` and label boxes, and the label read. Each could be written apart from the others and
// drift without anything failing, so this file holds them to the one answer.
//
// SO IT HOLDS FOUR THINGS:
//
//   1. THE JUDGMENT BY VALUE: six readers over three jobs and the item with none — a site manager
//      on the item's job, on another, on two and on none, a reader who is not one, and the office
//      as and as not a site manager — and `planTransition`'s `records` being that answer for each.
//   2. A LIST BY VALUE (`listRecording`): on the reader's own job's list the opener and the boxes,
//      on another's neither, and on all jobs the opener alone — and since #610 only for a site
//      manager holding a job the list holds, so one on no job is offered nothing on any list.
//   3. THE THREE ACTIONS OFF THEIR SOURCE: each plans on the item's job as read, compares the job
//      the page was drawn on and writes none the form names, and a refusal about whose item it is
//      is said; the retirement a status got in front of says nothing, as it did.
//   4. THE LABEL READ: it asks each item it reads, and names the codes off the reader's jobs
//      beside the codes no asset carries rather than drawing their labels.
//
// WHAT A PASS DOES NOT PROVE. That a control is missing from a page as drawn, or that a refusal is
// said under the status after a re-render — browser measurements recorded in the pull request. The
// transition's own offers, status by status, are `offline/asset-transition.mjs`'s; a page's gates
// over its controls `offline/site-manager.mjs`'s; the jobs a registration offers
// `offline/asset-record-jobs.mjs`'s.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { recordsOn } from "../../../lib/assetJob.js";
import { assetListScope, listRecording } from "../../../lib/assetListView.js";
import { ASSET_TRANSITION_COPY, planTransition } from "../../../lib/assetTransition.js";
import { ASSET_LABEL_PAGE_COPY, describeLabelRun } from "../../../lib/assetLabelPage.js";
import { QR_SIDE_MODULES } from "../../../lib/assetLabelQR.js";
import { ALL_JOBS } from "../../../lib/assetRoutes.js";
import { ASSET_STATUS } from "../../../lib/assetStatus.js";
import { callsTo, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An item is recorded on by its own job's site managers alone (#597)";

const RECORD = "app/(assets)/assets/[assetId]/actions.js";
const LABELS = "app/(assets)/assets/actions.js";

const A = { id: "recJ1", jobCode: "23-USA-09", assets: ["a1"] };
const B = { id: "recJ2", jobCode: "25-USA-13", assets: ["a2"] };
const C = { id: "recJ3", jobCode: "26-USA-12", assets: ["a3"] };
const JOBS = [A, B, C];

/** The readers the issue names, each with what marks them. */
const READERS = {
    "site manager on 23-USA-09": { isSiteManager: true, assignedJobs: [A.id] },
    "site manager on two": { isSiteManager: true, assignedJobs: [B.id, A.id] },
    "site manager on none": { isSiteManager: true, assignedJobs: [] },
    "not a site manager, on 23-USA-09": { isSiteManager: false, assignedJobs: [A.id] },
    "office, not a site manager, on 23-USA-09": { isAdmin: true, isSiteManager: false, assignedJobs: [A.id] },
    "office, a site manager on 26-USA-12": { isAdmin: true, isSiteManager: true, assignedJobs: [C.id] },
};

/** Every `formData.get("…")` key a function's source reads, in order. */
function formKeys(source) {
    return [...source.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]);
}

/** A handler's own source by name, or the empty string. */
function handlerSource(parsed, name) {
    const fn = resolveFunction(parsed.ast, name);
    return fn ? parsed.source.slice(fn.start, fn.end) : "";
}

/** Each `planTransition({ … assetJobId: X … })` inside a source, as X's text. */
function plannedOn(parsed, name) {
    const fn = resolveFunction(parsed.ast, name);
    const found = [];
    walk(fn ?? {}, (n) => {
        if (n.type !== "CallExpression" || n.callee?.name !== "planTransition") return;
        const prop = n.arguments[0]?.properties?.find((p) => p.key?.name === "assetJobId");
        found.push(prop ? parsed.source.slice(prop.value.start, prop.value.end) : "no item's job");
    });
    return found.join(" | ") || "no plan";
}

export function run({ check, assert, log }) {
    // ── 1: the judgment, by value ─────────────────────────────────────────────
    log("who records on an item, by the item's job:");
    const on = (user) => [A, B, C].filter((job) => recordsOn(user, job.id)).map((job) => job.jobCode).join(",") || "none";
    check(
        "a site manager records on the items on their own jobs alone, and nobody else on any",
        Object.entries(READERS).map(([name, user]) => `${name}: ${on(user)}`).join(" | "),
        "site manager on 23-USA-09: 23-USA-09 | site manager on two: 23-USA-09,25-USA-13 | site manager on none: none | " +
            "not a site manager, on 23-USA-09: none | office, not a site manager, on 23-USA-09: none | office, a site manager on 26-USA-12: 26-USA-12"
    );
    check(
        "  an item with no job is nobody's, however it is missing",
        [undefined, null, "", ["recJ1"], 7].map((job) => recordsOn(READERS["site manager on 23-USA-09"], job)).join(","),
        "false,false,false,false,false"
    );
    check("  nor is any item a missing reader's", `${recordsOn(null, A.id)} ${recordsOn(undefined, A.id)} ${recordsOn({ isSiteManager: true }, A.id)}`, "false false false");
    check("  and the mark is the mark, not anything truthy", recordsOn({ isSiteManager: "yes", assignedJobs: [A.id] }, A.id), false);
    // ONE JUDGMENT: what the asset page offers asks it of the item's job, for every reader and job.
    const disagree = Object.entries(READERS).flatMap(([name, user]) =>
        [A, B, C, { id: null }].flatMap((job) => {
            const plan = planTransition({ user, jobs: JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: job.id });
            return plan.records === recordsOn(user, job.id) && Boolean(plan.event) === plan.records ? [] : [`${name} on ${job.jobCode ?? "no job"}`];
        })
    );
    check("the asset page's plan is that answer, item by item, and offers a press only on it", disagree.join(" | "), "");
    check(
        "  and names the item's job for a refusal to say",
        (() => {
            const plan = planTransition({ user: READERS["site manager on none"], jobs: JOBS, status: ASSET_STATUS.OUT, assetJobId: B.id });
            return `${plan.jobId} ${plan.jobCode} ${plan.refusal}`;
        })(),
        "recJ2 25-USA-13 null"
    );

    // ── 2: a list, by value ───────────────────────────────────────────────────
    log("");
    log("what a list offers to record, by the job it stands on:");
    const offers = (user, job) => {
        const r = listRecording(user, assetListScope(user, JOBS, job));
        return `${r.adds ? "add" : "-"}/${r.selects ? "boxes" : "-"}`;
    };
    check(
        "on 23-USA-09's, on 26-USA-12's, and on all jobs",
        Object.entries(READERS).map(([name, user]) => `${name}: ${[A.id, C.id, ALL_JOBS].map((job) => offers(user, job)).join(" ")}`).join(" | "),
        "site manager on 23-USA-09: add/boxes -/- add/- | site manager on two: add/boxes -/- add/- | site manager on none: -/- -/- -/- | " +
            "not a site manager, on 23-USA-09: -/- -/- -/- | office, not a site manager, on 23-USA-09: -/- -/- -/- | office, a site manager on 26-USA-12: -/- add/boxes add/-"
    );
    // ON ALL JOBS THE OPENER ASKS A JOB TO ADD ONTO AMONG THE JOBS THE LIST HOLDS (#610): a site
    // manager on no job is offered nothing there, as on one job, and neither is one whose only
    // assignment is a job the list does not hold — one #488 would take off the choice — since the
    // registration's choice is drawn from those same jobs.
    const offGone = { isSiteManager: true, assignedJobs: ["recJ9"] };
    check(
        "  on all jobs, a site manager whose only job the list does not hold is offered nothing, and one beside it the opener",
        `${offers(offGone, ALL_JOBS)} ${offers({ isSiteManager: true, assignedJobs: ["recJ9", C.id] }, ALL_JOBS)}`,
        "-/- add/-"
    );
    check("  a list on no job at all offers nothing", JSON.stringify(listRecording(READERS["site manager on 23-USA-09"], { job: null, allJobs: false })), '{"adds":false,"selects":false}');
    check("  and a list with no scope nothing either", JSON.stringify(listRecording(READERS["site manager on 23-USA-09"], undefined)), '{"adds":false,"selects":false}');

    // ── 3: the three actions, off their source ───────────────────────────────
    log("");
    log("the three actions plan on the item's job, compare the drawn one, and write none the form names:");
    const record = parseFile(RECORD);
    const handlers = ["recordAssetEventHandler", "retireAssetHandler", "updateAssetNoteHandler"];
    check(
        "each plans on the item's own job as just read",
        handlers.map((name) => `${name}: ${plannedOn(record, name)}`).join(" | "),
        handlers.map((name) => `${name}: asset.job?.[0]`).join(" | ")
    );
    check(
        "  and reads off the form no job but the one the page was drawn on",
        handlers.map((name) => `${name}: ${formKeys(handlerSource(record, name)).join(",")}`).join(" | "),
        "recordAssetEventHandler: assetId,event,drawnJobId,checkedOutTo,event | retireAssetHandler: assetId,drawnJobId | updateAssetNoteHandler: assetId,drawnJobId,note,previous"
    );
    const note = handlerSource(record, "updateAssetNoteHandler");
    assert(
        "the note asks whose item it is before its own rule, and says the answer",
        /const recording = recordingRefusal\(plan, \{ drawnJobId: String\(formData\.get\("drawnJobId"\) \?\? ""\), attempted: null \}\);\s*if \(recording\) return \{ refusal: recording \};/.test(note) &&
            note.indexOf("recordingRefusal(") < note.indexOf("readNoteSubmission(")
    );
    const retire = handlerSource(record, "retireAssetHandler");
    assert(
        "the retirement a status got in front of says the item is retired, and one whose item is not the reader's is said (#614)",
        /if \(refusal\) return refuse\(refusal\);/.test(retire) && !/refuse\(null\)/.test(retire)
    );
    check(
        "the two readers the event and the retirement ask compare the drawn job first",
        ["readSubmission", "readRetirement"].map((name) => callsTo(resolveFunction(parseFile("lib/assetTransition.js").ast, name), "recordingRefusal").length).join(" "),
        "1 1"
    );
    check(
        "  and the sentences they say, by value",
        [
            ASSET_TRANSITION_COPY.notYours({ jobCode: B.jobCode, attempted: "Checked out" }),
            ASSET_TRANSITION_COPY.movedTo({ jobCode: B.jobCode, attempted: "Checked in" }),
            ASSET_TRANSITION_COPY.notYours({ jobCode: B.jobCode, attempted: null }),
        ].join(" | "),
        "Only 25-USA-13 can record this item. Nothing was saved. | This item is on 25-USA-13 now. Your check-in wasn't saved. | Only 25-USA-13 can record this item. Nothing was saved."
    );

    // ── 4: the label read ────────────────────────────────────────────────────
    log("");
    log("the label read prints the labels of items on the reader's own jobs alone:");
    const labels = parseFile(LABELS);
    const read = handlerSource(labels, "readAssetLabelsHandler");
    assert("it reads the reader beside the items", /const \[user, assets\] = await Promise\.all\(\[requireUser\(\), named\.length > 0 \? getAssetsByAssetIds\(named\) : \[\]\]\);/.test(read));
    assert(
        "  asks each item it found whether it is the reader's, before building its label",
        /if \(!recordsOn\(user, asset\.job\?\.\[0\]\)\) \{\s*elsewhere\.push\(namedCode\(assetId\)\);\s*continue;\s*\}\s*labels\.push\(await buildAssetLabel/.test(read)
    );
    assert("  and hands the codes off their jobs back beside the ones not found", /return \{ sideModules: QR_SIDE_MODULES, labels, missing, elsewhere \};/.test(read));
    const labelRun = describeLabelRun({ sideModules: QR_SIDE_MODULES, labels: [], missing: ["260909-001"], elsewhere: ["260909-002", "260909-003"] });
    check("a run counts the codes off the reader's jobs among those it named", `${labelRun.named} ${labelRun.printing} ${labelRun.elsewhere.join(",")}`, "3 0 260909-002,260909-003");
    check("  and a run handed none counts none, the asset page's own run among them", describeLabelRun({ sideModules: QR_SIDE_MODULES, labels: [], missing: [] }).elsewhere.length, 0);
    check("  said in the app's words", `${ASSET_LABEL_PAGE_COPY.notYours(1)} | ${ASSET_LABEL_PAGE_COPY.notYours(2)}`, "1 item not on your jobs | 2 items not on your jobs");

    // ── anti-vacuity ─────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    const planted = parseSource(
        "async function h(formData) { const plan = planTransition({ user, jobs, status }); const a = formData.get(\"jobId\"); }\n",
        "<planted-handler>"
    );
    check("  a handler planning on no item's job is seen", plannedOn(planted, "h"), "no item's job");
    check("  and a form job it reads is seen", formKeys(planted.source).join(","), "jobId");
    check("  a missing handler reads as none", plannedOn(planted, "absent"), "no plan");
    // A judgment that forgot the mark, or one that forgot the job, would answer otherwise here.
    check(
        "  the judgment tells the mark and the job apart",
        `${recordsOn({ isSiteManager: false, assignedJobs: [A.id] }, A.id)} ${recordsOn({ isSiteManager: true, assignedJobs: [A.id] }, B.id)} ${recordsOn({ isSiteManager: true, assignedJobs: [A.id] }, A.id)}`,
        "false false true"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

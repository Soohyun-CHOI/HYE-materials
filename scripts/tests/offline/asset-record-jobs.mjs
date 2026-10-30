// What a reader records against is their own jobs, whatever the lists let them view (#593).
//
// WHAT THIS IS DEFENDING. #593 stood every reader's asset lists on every job: the jobs
// `lib/assetListView.js:assetListScope` answers are the company's, for the office and for anybody
// else alike. The jobs a site manager RECORDS against stayed their own assignments, as
// `lib/assetJob.js:assignedJobsFor` reads them — the registration's choice and what its action
// admits, a check-out's and a check-in's job, whether a repair, a retirement or a note may be
// written at all, the names a check-out offers, and whether the list's head offers `Add items`.
// Until #593 the two were the same jobs for anybody but the office, so a recording path reading
// the view's answer was right by accident; now they part, and such a path would widen with the
// view and fail nothing. This file is what pairs them.
//
// SO IT HOLDS TWO THINGS:
//
//   1. BY VALUE, over three jobs and six readers — a site manager on two, on one and on none, the
//      office on none, the office as a site manager on one, and a reader who records nothing:
//      every reader views every job, and each records on their own alone. The office's job change
//      (#583) is the one act whose jobs ARE the list's, by design, and it is held as the office's.
//   2. OFF THE SOURCE: which files import `assetListScope`, each with its reason, so no recording
//      module or action is among them; what the recording actions hand the registration and the
//      plan; and what the three pages hand and draw their recording controls under — nothing the
//      scope answered but the job a list stands on, which the registration's choice takes only
//      through the reader's assignments (`chosenJobId`).
//
// WHAT A PASS DOES NOT PROVE. That a control is drawn or missing on a page as rendered, which is a
// browser measurement recorded in the pull request; and the transition's own planning, status by
// status, which is `offline/asset-transition.mjs`'s.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { assetListScope } from "../../../lib/assetListView.js";
import { assignedJobsFor, chosenJobId } from "../../../lib/assetJob.js";
import { ASSET_REGISTRATION_COPY, canRegisterAssets, readRegistration } from "../../../lib/assetRegistration.js";
import { ASSET_TRANSITION_COPY, planTransition } from "../../../lib/assetTransition.js";
import { planOfficeActs } from "../../../lib/assetOfficeActs.js";
import { ASSET_EVENT, ASSET_STATUS } from "../../../lib/assetStatus.js";
import { listJsFiles, parentMap, parseFile, parseSource, repoPath, resolveFunction, toPosix, walk } from "./_ast.mjs";
import { conditionsOf } from "./site-manager.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What a reader records against is their own jobs, whatever they view (#593)";

const LIST = "app/(assets)/asset-categories/page.js";
const CATEGORY = "app/(assets)/asset-categories/[categoryRecordId]/page.js";
const ITEM = "app/(assets)/assets/[assetId]/page.js";
const REGISTER = "app/(assets)/asset-categories/actions.js";
const RECORD = "app/(assets)/assets/[assetId]/actions.js";

/**
 * Every file that imports `assetListScope`, and why. One more fails until it is here — a recording
 * module or action reading the view's jobs is the thing this file exists to stop.
 */
const SCOPE_READERS = {
    [LIST]: "the category list, which stands on the scope's job",
    [CATEGORY]: "a category's page, the same",
    [ITEM]: "an asset's page, for its breadcrumb's job (#519, #581)",
    "lib/assetListExport.js": "the list's export, a read of what the list shows (#553)",
    "lib/assetOfficeActs.js": "the office's job change, whose jobs are the list's by design (#583)",
};

/** The elements a site manager records with, on the three pages. */
const RECORDING_ELEMENTS = ["RegistrationDialog", "RegistrationShortfall", "RegistrationUnlogged", "LabelsDialog", "AssetTransition"];

/** The bindings the pages feed those elements from. */
const RECORDING_BINDINGS = ["registration", "opener", "canRegister", "assignedJobs", "listJobId", "transition", "recentRows", "recorder"];

/** Every file under app/ and lib/ importing `name`, as a repo-relative path. */
function importersOf(name) {
    const root = toPosix(repoPath("."));
    const files = ["app", "lib"].flatMap((dir) => listJsFiles(repoPath(dir)).map((abs) => toPosix(abs).slice(root.length + 1)));
    return files.filter((rel) => importsName(parseFile(rel).ast, name)).sort();
}

/** Whether a module imports `name` from anywhere. */
function importsName(ast, name) {
    return ast.body.some((n) => n.type === "ImportDeclaration" && n.specifiers.some((s) => s.imported?.name === name));
}

/**
 * Every read of the scope (`scope.x`) that feeds a recording control: inside one of its bindings,
 * or an attribute of one of its elements. Each as `where: scope.x`, in source order.
 */
export function scopeFeeds(parsed) {
    const parents = parentMap(parsed.ast);
    const found = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "MemberExpression" || n.object?.type !== "Identifier" || n.object.name !== "scope") return;
        for (let at = parents.get(n); at; at = parents.get(at)) {
            if (at.type === "VariableDeclarator" && RECORDING_BINDINGS.includes(at.id?.name)) {
                found.push(`${at.id.name}: scope.${n.property.name}`);
                return;
            }
            if (at.type === "JSXOpeningElement" && RECORDING_ELEMENTS.includes(at.name?.name)) {
                found.push(`<${at.name.name}>: scope.${n.property.name}`);
                return;
            }
        }
    });
    return found;
}

/** The conditions every recording element on a page is drawn under, each occurrence's joined. */
function recordingConditions(ast) {
    return RECORDING_ELEMENTS.flatMap((element) => conditionsOf(ast, { element }).map((under) => `${element}[${under.join(" && ")}]`));
}

/** What a binding is written as, its whitespace folded, or "not bound". */
function bound(parsed, name) {
    let text = "not bound";
    walk(parsed.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === name && n.init) text = parsed.source.slice(n.init.start, n.init.end).replace(/\s+/g, " ");
    });
    return text;
}

/** Each `planTransition({ … jobs: X … })` call inside a handler, as `jobs: X`. */
function planJobs(parsed, handler) {
    const fn = resolveFunction(parsed.ast, handler);
    const found = [];
    walk(fn ?? {}, (n) => {
        if (n.type !== "CallExpression" || n.callee?.name !== "planTransition") return;
        const jobs = n.arguments[0]?.properties?.find((p) => p.key?.name === "jobs");
        found.push(jobs ? `jobs: ${parsed.source.slice(jobs.value.start, jobs.value.end)}` : "no jobs");
    });
    return found.join(" | ") || "no plan";
}

export function run({ check, log }) {
    // ── 1: by value ──────────────────────────────────────────────────────────
    log("every reader views every job, and records on their own alone:");
    const A = { id: "recJ1", jobCode: "23-USA-09", assets: ["a1"] };
    const B = { id: "recJ2", jobCode: "25-USA-13", assets: ["a2"] };
    const C = { id: "recJ3", jobCode: "26-USA-12", assets: ["a3"] };
    const JOBS = [C, A, B];
    const READERS = {
        "site manager on two": { isAdmin: false, isSiteManager: true, assignedJobs: [B.id, A.id] },
        "site manager on one": { isAdmin: false, isSiteManager: true, assignedJobs: [B.id] },
        "site manager on none": { isAdmin: false, isSiteManager: true, assignedJobs: [] },
        "office on none": { isAdmin: true, isSiteManager: false, assignedJobs: [] },
        "office, a site manager on one": { isAdmin: true, isSiteManager: true, assignedJobs: [C.id] },
        "reader who records nothing": { isAdmin: false, isSiteManager: false, assignedJobs: [A.id] },
    };
    const codes = (jobs) => jobs.map((job) => job.jobCode).join(",") || "none";
    const each = (answer) => Object.entries(READERS).map(([name, user]) => `${name}: ${answer(user)}`).join(" | ");

    check(
        "the jobs a list may stand on are every job, for every reader",
        each((user) => codes(assetListScope(user, JOBS, null).jobs)),
        each(() => "23-USA-09,25-USA-13,26-USA-12")
    );
    check(
        "  and a list with no job asked starts on the first of their own, or on all of them",
        each((user) => {
            const scope = assetListScope(user, JOBS, null);
            return scope.allJobs ? "all" : scope.job.jobCode;
        }),
        "site manager on two: 23-USA-09 | site manager on one: 25-USA-13 | site manager on none: all | " +
            "office on none: all | office, a site manager on one: 26-USA-12 | reader who records nothing: 23-USA-09"
    );
    check(
        "the jobs a check-out or a check-in may be recorded on are their own, and nobody else's",
        each((user) => codes(planTransition({ user, jobs: JOBS, status: ASSET_STATUS.IN_STOCK }).jobs)),
        "site manager on two: 23-USA-09,25-USA-13 | site manager on one: 25-USA-13 | site manager on none: none | " +
            "office on none: none | office, a site manager on one: 26-USA-12 | reader who records nothing: none"
    );
    check(
        "  so what a check-out offers, and to whom it says why not",
        each((user) => {
            const plan = planTransition({ user, jobs: JOBS, status: ASSET_STATUS.IN_STOCK });
            return plan.event ?? (plan.refusal === ASSET_TRANSITION_COPY.noJob ? "no job" : "nothing");
        }),
        `site manager on two: ${ASSET_EVENT.CHECKED_OUT} | site manager on one: ${ASSET_EVENT.CHECKED_OUT} | site manager on none: no job | ` +
            `office on none: nothing | office, a site manager on one: ${ASSET_EVENT.CHECKED_OUT} | reader who records nothing: nothing`
    );
    check(
        "  and whether a repair, a retirement or a note may be written at all",
        each((user) => {
            const plan = planTransition({ user, jobs: JOBS, status: ASSET_STATUS.IN_STOCK });
            return [plan.maySendForRepair, plan.mayRetire, plan.mayWriteNote].map(Number).join("");
        }),
        "site manager on two: 111 | site manager on one: 111 | site manager on none: 000 | " +
            "office on none: 000 | office, a site manager on one: 111 | reader who records nothing: 000"
    );
    check(
        "the jobs a registration offers, and whether it is offered, are their own",
        each((user) => `${canRegisterAssets(user, JOBS)} ${codes(assignedJobsFor(user, JOBS))}`),
        "site manager on two: true 23-USA-09,25-USA-13 | site manager on one: true 25-USA-13 | site manager on none: false none | " +
            "office on none: false none | office, a site manager on one: true 26-USA-12 | reader who records nothing: true 23-USA-09"
    );
    // ON ANOTHER'S JOB: the list stands there for every reader, and the registration opened over it
    // starts on none of a reader's several, or on their one, and never on the job the list is on.
    const onC = (user) => chosenJobId(assignedJobsFor(user, JOBS), assetListScope(user, JOBS, C.id).job?.id ?? null);
    check(
        "a list on another's job stands there, and a registration opened over it starts on their own",
        `${assetListScope(READERS["site manager on two"], JOBS, C.id).job.jobCode} | ${onC(READERS["site manager on two"]) || "none"} ${onC(READERS["site manager on one"])}`,
        `26-USA-12 | none ${B.id}`
    );
    const registration = (user, jobId) => readRegistration({ categoryRecordId: "recKind", quantity: "1", jobId }, assignedJobsFor(user, JOBS), [{ id: "recKind" }]);
    check(
        "  and what the action admits is their own: another's job refused, their own taken",
        `${registration(READERS["site manager on two"], C.id).fields?.jobId} | ${registration(READERS["site manager on two"], A.id).registration?.job?.jobCode}`,
        `${ASSET_REGISTRATION_COPY.jobNotYours} | 23-USA-09`
    );
    check("  and nothing for a site manager on none, whatever the list stands on", registration(READERS["site manager on none"], A.id).error, ASSET_REGISTRATION_COPY.noJob);
    // THE OFFICE'S ONE ACT WHOSE JOBS ARE THE LIST'S (#583), and nobody else's.
    const created = [{ id: "recEntry", event: ASSET_EVENT.CREATED, job: [A.id] }];
    check(
        "the office's job change offers the list's jobs, to the office alone",
        each((user) => codes(planOfficeActs({ user, log: created, jobs: JOBS }).jobs)),
        "site manager on two: none | site manager on one: none | site manager on none: none | " +
            "office on none: 23-USA-09,25-USA-13,26-USA-12 | office, a site manager on one: 23-USA-09,25-USA-13,26-USA-12 | reader who records nothing: none"
    );

    // ── 2: off the source ─────────────────────────────────────────────────────
    log("");
    log("no recording module or action reads the jobs a list may stand on:");
    check("the files importing assetListScope are the five with a reason, and no other", importersOf("assetListScope").join(" | "), Object.keys(SCOPE_READERS).sort().join(" | "));
    check(
        "  and a planted recording module importing it is seen (anti-vacuity)",
        importsName(parseSource('import { assetListScope } from "./assetListView.js";\n', "<planted-import>").ast, "assetListScope"),
        true
    );

    const register = parseFile(REGISTER);
    const registerHandler = resolveFunction(register.ast, "registerAssetsHandler");
    let admitted = "no readRegistration";
    walk(registerHandler ?? {}, (n) => {
        if (n.type === "CallExpression" && n.callee?.name === "readRegistration") admitted = register.source.slice(n.arguments[1].start, n.arguments[1].end);
    });
    check("the registration's action admits the reader's own jobs", admitted, "assignedJobsFor(user, allJobs)");
    const record = parseFile(RECORD);
    check(
        "  the check-out, the check-in, the repair and the retirement, and the note, each plan from the whole job list, which the plan narrows",
        ["recordAssetEventHandler", "retireAssetHandler", "updateAssetNoteHandler"].map((handler) => `${handler}: ${planJobs(record, handler)}`).join(" | "),
        "recordAssetEventHandler: jobs: await getAllJobs() | retireAssetHandler: jobs: await getAllJobs() | updateAssetNoteHandler: jobs: await getAllJobs()"
    );

    log("");
    log("the pages hand and draw their recording controls off the reader's own jobs:");
    const list = parseFile(LIST);
    const category = parseFile(CATEGORY);
    const item = parseFile(ITEM);
    check(
        "the scope feeds a recording control only as the job a list stands on, the registration's start",
        [LIST, CATEGORY, ITEM].map((file) => `${file}: ${scopeFeeds(parseFile(file)).join(", ") || "none"}`).join(" | "),
        `${LIST}: registration: scope.job | ${CATEGORY}: listJobId: scope.job | ${ITEM}: none`
    );
    check(
        "  no recording control on the three pages is drawn under anything the scope answered",
        [list, category, item].flatMap((page) => recordingConditions(page.ast)).filter((under) => /scope|onNoJob/.test(under)).join(" | "),
        ""
    );
    check(
        "  and the list's opener asks the reader's own jobs, as a category's page does",
        `${recordingConditions(list.ast).join(" | ")} || ${bound(category, "canRegister")} | ${bound(category, "assignedJobs")}`,
        "RegistrationDialog[recorder && registration.canRegister] | RegistrationDialog[rows.length === 0 && recorder && registration.canRegister] || " +
            "canRegisterAssets(user, jobs) | assignedJobsFor(user, jobs).map(({ id, jobCode, jobName }) => ({ id, jobCode, jobName }))"
    );
    check(
        "an asset's page plans from the whole job list and offers the names its plan's jobs gave",
        `${bound(item, "transition")} | ${bound(item, "recentRows")}`,
        "planTransition({ user, jobs, status: asset.status }) | transition.event === ASSET_EVENT.CHECKED_OUT ? await getRecentCheckOuts({ jobCodes: transition.jobs.map((job) => job.jobCode) }) : []"
    );
    // ANTI-VACUITY: a page drawing its opener under the scope's job count, handing the dialog the
    // scope's jobs and offering names off them is seen doing each.
    const planted = parseSource(
        "function P() {\n" +
            "  const registration = { jobs: scope.jobs, listJobId: scope.job?.id ?? null };\n" +
            "  const recentRows = getRecentCheckOuts({ jobCodes: scope.jobs.map((job) => job.jobCode) });\n" +
            "  return <div>{recorder && scope.jobs.length > 0 && <RegistrationDialog {...registration} />}<LabelsDialog jobs={scope.jobs} /></div>;\n" +
            "}\n",
        "<planted-page>"
    );
    check(
        "  a planted page feeding its controls off the scope is seen, each read and the condition",
        `${scopeFeeds(planted).join(", ")} | ${recordingConditions(planted.ast).join(" | ")}`,
        "registration: scope.jobs, registration: scope.job, recentRows: scope.jobs, <LabelsDialog>: scope.jobs | " +
            "RegistrationDialog[recorder && scope.jobs.length > 0] | LabelsDialog[]"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

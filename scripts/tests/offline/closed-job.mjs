// A closed job is offered nowhere a job is newly chosen, and refused there by the same rule (#488).
//
// WHAT THIS FILE HOLDS, and each claim is a different kind of thing.
//
//   1. THE RULE, BY VALUE. `lib/closedJob.js` is pure: whether a job is closed (its `Closed Date`
//      holds a day), the jobs a new choice offers (the open ones and the one a record already
//      names, `held`), the refusal of a closed one in its two forms, the Equipment & Tools screens'
//      bare (#667), which of two sentences says a choice is empty
//      because every job has closed, and every word. The direct-purchase request's held job is
//      `lib/prKind.js:requestJobId`'s and is pinned beside it.
//   2. ONE READING OF THE FIELD. `lib/airtable/jobs.js` maps `Closed Date` on both of its readers
//      that the choosing places read, and no other file under `app/` or `lib/` names the field or
//      reads `closedDate` off a job: every judgment of it is this module's.
//   3. EVERY PLACE A JOB IS CHOSEN ASKS IT, AND EVERY OTHER READER OF THE JOBS IS NAMED. Every file
//      under `app/` and `lib/` that reads the jobs (`getAllJobs`, `getJobByRecordId`) is either a
//      place a job is newly chosen, which must call what asks the rule, or one that only shows a
//      job, listed with why. A new reader that is neither fails, and so does a stale entry — so a
//      new screen choosing a job cannot skip the rule without a line here saying it does not
//      choose. The four writes that read a job off the request each ask the refusal before their
//      write and outside every `try`, the request's two pass the draft they re-target, and the two
//      screens whose choice closed jobs can empty say why, in words their briefs quote.
//
// WHAT IT CANNOT SEE. Source shape is not execution (`_ast.mjs`): a call inside `if (false)` passes.
// Whether a closed job is missing from each drawn choice, whether the Equipment & Tools list still
// offers it and whether a draft keeps it are browser work, walked on the test base for #488.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync, existsSync } from "fs";
import { relative } from "path";
import { CLOSED_JOB_COPY, closedJobRefusal, isClosed, noOpenJob, offeredJobs } from "../../../lib/closedJob.js";
import { requestJobId } from "../../../lib/prKind.js";
import { callsBefore, callsTo, insideTry, listJsFiles, parentMap, parseFile, parseSource, repoPath, resolveFunction, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A closed job is offered nowhere a job is newly chosen, and refused there (#488)";

const OPEN_A = { id: "recA", jobCode: "26-USA-01", closedDate: null };
const SHUT_B = { id: "recB", jobCode: "26-USA-02", closedDate: "2026-11-02" };
const OPEN_C = { id: "recC", jobCode: "26-USA-03" };
const SHUT_D = { id: "recD", jobCode: "26-USA-04", closedDate: "2026-12-31" };
const JOBS = [OPEN_A, SHUT_B, OPEN_C, SHUT_D];
const codes = (jobs) => jobs.map((job) => job.jobCode).join(" ") || "none";

/**
 * EVERY PLACE A JOB IS NEWLY CHOSEN, each with the calls that ask the rule there — directly, or
 * through the module function that does (`LIB_ASKS`). Pages and their actions both: the page draws
 * the choice, and the action is reachable without it.
 */
const CHOOSES = [
    ["a purchase request", "app/prs/new/page.js", ["offeredJobs", "noOpenJob", "requestJobId"]],
    ["a purchase request", "app/prs/new/actions.js", ["closedJobRefusal", "requestJobId"]],
    ["a delivery", "app/deliveries/new/page.js", ["offeredJobs", "noOpenJob"]],
    ["a delivery", "app/deliveries/new/actions.js", ["closedJobRefusal"]],
    ["a direct purchase", "app/api/jobs/route.js", ["offeredJobs"]],
    ["a direct purchase", "app/invoices/new/actions.js", ["closedJobRefusal"]],
    ["an asset's registration", "app/(assets)/asset-categories/page.js", ["registrationJobs", "listRecording"]],
    ["an asset's registration", "app/(assets)/asset-categories/[categoryRecordId]/page.js", ["registrationJobs", "listRecording"]],
    ["an asset's registration", "app/(assets)/asset-categories/actions.js", ["readRegistration"]],
    ["an asset's lending and change of job", "app/(assets)/assets/[assetId]/page.js", ["planTransition", "planOfficeActs"]],
    ["an asset's lending", "app/(assets)/assets/[assetId]/actions.js", ["planTransition", "readLend"]],
    ["an asset's change of job", "app/(assets)/assets/[assetId]/officeActions.js", ["planOfficeActs", "readJobChange"]],
    ["the sign-in job step", "app/login/jobs/page.js", ["jobsOffered"]],
    ["the sign-in job step", "app/login/jobs/actions.js", ["chosenJobIds"]],
    ["a new address", "app/addresses/new/page.js", ["offeredJobs"]],
    ["a new address", "app/addresses/new/actions.js", ["offeredJobs"]],
    ["a new discipline", "app/admin/disciplines/new/page.js", ["offeredJobs"]],
    ["a new discipline", "app/admin/disciplines/new/actions.js", ["closedJobRefusal"]],
    // #677 — where a send goes: the page offers the open jobs' addresses, and the write refuses a
    // closed job read afresh. The send's action reads no job itself; its module does.
    ["a send's destination", "app/materials/[jobCode]/[materialId]/page.js", ["destinationChoices"]],
    ["a send's destination", "lib/materialTransit.server.js", ["destinationRefusal"]],
];

/** The module functions the places above reach the rule through, and what each asks of it. */
const LIB_ASKS = [
    ["lib/assetRegistration.js", "registrationJobs", "offeredJobs"],
    ["lib/assetRegistration.js", "readRegistration", "offeredJobs"],
    ["lib/assetRegistration.js", "readRegistration", "closedJobRefusal"],
    ["lib/assetListView.js", "listRecording", "isClosed"],
    ["lib/assetTransition.js", "planTransition", "offeredJobs"],
    ["lib/assetTransition.js", "readLend", "closedJobRefusal"],
    ["lib/assetOfficeActs.js", "planOfficeActs", "offeredJobs"],
    ["lib/assetOfficeActs.js", "readJobChange", "closedJobRefusal"],
    ["lib/userJobs.js", "jobsOffered", "offeredJobs"],
    ["lib/materialTransit.js", "destinationChoices", "offeredJobs"],
    ["lib/materialTransit.js", "destinationRefusal", "isClosed"],
];

/** EVERY OTHER READER OF THE JOBS, and why it chooses none: each shows a job a record already names. */
const SHOWS = [
    ["app/prs/page.js", "the list's job filter and the strips of what waits on a job's request"],
    ["app/prs/[prId]/page.js", "the request's own job"],
    ["app/pos/page.js", "the list's job column and filter"],
    ["app/pos/[poId]/page.js", "the order's own job"],
    ["app/invoices/page.js", "the list's job column and filter"],
    ["app/deliveries/page.js", "the list's job column and filter"],
    ["app/deliveries/[deliveryId]/page.js", "the delivery's own job"],
    ["app/deliveries/[deliveryId]/edit/page.js", "the delivery's own job, which an edit does not change"],
    ["lib/materialPriceView.server.js", "the job each price's order was raised on"],
    ["app/materials/page.js", "the jobs whose inventory a reader may open, closed ones too (#675)"],
    ["app/materials/[jobCode]/page.js", "the job whose inventory it is"],
    ["lib/materialStock.server.js", "the job whose stock an issue and a delivery's delete read again"],
    ["lib/deliveryAddress.server.js", "the delivery's own job, which a correction of its address does not change and refuses closed (#680)"],
    ["lib/poGeneration.js", "the request's job, for the order's PIC and manager"],
    ["lib/poPdf.js", "the order's job, printed on its document"],
];

/** The four writes that read the job they are about to name, each before its first write. */
const WRITES = [
    ["app/deliveries/new/actions.js", "createDeliveryAction", "createDelivery"],
    ["app/invoices/new/actions.js", "createDirectPurchaseHandler", "createDirectPurchase"],
    ["app/admin/disciplines/new/actions.js", null, "createDiscipline"],
    ["app/prs/new/actions.js", "jobRefusal", null],
];

/** The files under `app/` and `lib/` (not `lib/airtable/`) that import a reader of the jobs. */
function jobReaders() {
    const out = [];
    for (const dir of ["app", "lib"]) {
        for (const full of listJsFiles(repoPath(dir))) {
            const rel = toPosix(relative(repoPath("."), full));
            if (rel.startsWith("lib/airtable/")) continue;
            const { ast } = parseFile(rel);
            const reads = ast.body.some(
                (n) =>
                    n.type === "ImportDeclaration" &&
                    /(^@\/lib\/airtable\/jobs$|\/airtable\/jobs(\.js)?$)/.test(n.source.value) &&
                    n.specifiers.some((s) => ["getAllJobs", "getJobByRecordId"].includes(s.imported?.name))
            );
            if (reads) out.push(rel);
        }
    }
    return out.sort();
}

/** Files under `app/` and `lib/` that read `.closedDate` off something, or name `Closed Date`. */
function fieldReaders() {
    const members = [];
    const names = [];
    for (const dir of ["app", "lib"]) {
        for (const full of listJsFiles(repoPath(dir))) {
            const rel = toPosix(relative(repoPath("."), full));
            const { ast } = parseFile(rel);
            walk(ast, (n) => {
                if (n.type === "MemberExpression" && !n.computed && n.property?.name === "closedDate") members.push(rel);
                if (n.type === "Literal" && n.value === "Closed Date") names.push(rel);
            });
        }
    }
    return { members: [...new Set(members)].sort(), names: [...new Set(names)].sort() };
}

/**
 * Whether the answer of `call` decides a return inside `fn`: the call returned itself, or bound to a
 * name an `if (name) return …` reads.
 */
function answered(fn, call) {
    if (!fn || !call) return false;
    const parents = parentMap(fn);
    if (parents.get(call)?.type === "ReturnStatement") return true;
    const declarator = parents.get(call);
    if (declarator?.type !== "VariableDeclarator" || declarator.id?.type !== "Identifier") return false;
    let found = false;
    walk(fn, (n) => {
        if (n.type !== "IfStatement" || n.test?.type !== "Identifier" || n.test.name !== declarator.id.name) return;
        const body = n.consequent?.type === "BlockStatement" ? n.consequent.body[0] : n.consequent;
        if (body?.type === "ReturnStatement") found = true;
    });
    return found;
}

/** The source of what `name` is declared as inside `node`, its whitespace folded, or "not bound". */
function boundText(parsed, node, name) {
    let text = "not bound";
    walk(node, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.id.name === name && n.init) {
            text = parsed.source.slice(n.init.start, n.init.end).replace(/\s+/g, " ");
        }
    });
    return text;
}

/** The sentences a brief does not quote, its lines read as one run of words as a brief wraps them. */
function briefQuotes(path, sentences) {
    const brief = readFileSync(repoPath(path), "utf8").replace(/\s+/g, " ");
    return sentences.filter((sentence) => !brief.includes(sentence));
}

export function run({ check, assert, log }) {
    // ── 1: the rule, by value ─────────────────────────────────────────────────
    log("whether a job is closed, and what a new choice offers:");
    check(
        "a day closes a job, whichever day; no day, a blank or anything but a string leaves it open",
        [SHUT_B, SHUT_D, OPEN_A, OPEN_C, { closedDate: "" }, { closedDate: 20261102 }, null, undefined].map(isClosed).join(" "),
        "true true false false false false false false"
    );
    check("a choice offers the open jobs, in their order", codes(offeredJobs(JOBS)), "26-USA-01 26-USA-03");
    check("  and the one a record already names, closed or not", codes(offeredJobs(JOBS, SHUT_D.id)), "26-USA-01 26-USA-03 26-USA-04");
    check("  or several", codes(offeredJobs(JOBS, [SHUT_B.id, null, "", SHUT_D.id])), "26-USA-01 26-USA-02 26-USA-03 26-USA-04");
    check("  a held id naming no job adds none", codes(offeredJobs(JOBS, "recGone")), "26-USA-01 26-USA-03");
    check("  and a missing list offers none", codes(offeredJobs(undefined)), "none");
    check(
        "a write naming a closed job is refused by its code, a held one is not, nor an open one",
        [closedJobRefusal(SHUT_B), closedJobRefusal(SHUT_B, SHUT_B.id), closedJobRefusal(SHUT_B, [OPEN_A.id, SHUT_B.id]), closedJobRefusal(OPEN_A)].join(" | "),
        "26-USA-02 is closed. |  |  | "
    );
    check("  a job with no code is still said", closedJobRefusal({ id: "recX", closedDate: "2026-11-02" }), "That job is closed.");
    check("  and no job is no refusal of this rule's", `${closedJobRefusal(null)} ${closedJobRefusal(undefined)}`, "null null");
    check(
        "the Equipment & Tools screens say the same words bare (#667), a held job and an open one still no refusal",
        [
            CLOSED_JOB_COPY.assetRefusal("26-USA-02"),
            closedJobRefusal(SHUT_B, [], CLOSED_JOB_COPY.assetRefusal),
            closedJobRefusal({ id: "recX", closedDate: "2026-11-02" }, [], CLOSED_JOB_COPY.assetRefusal),
            closedJobRefusal(SHUT_B, SHUT_B.id, CLOSED_JOB_COPY.assetRefusal),
            closedJobRefusal(OPEN_A, [], CLOSED_JOB_COPY.assetRefusal),
        ].join(" | "),
        "26-USA-02 is closed | 26-USA-02 is closed | That job is closed |  | "
    );

    log("");
    log("why a choice is empty, when every job a reader may use has closed:");
    check("a reader who may use none is the screen's own case", noOpenJob(JOBS, []), null);
    check("  one with an open job among theirs is offered it", noOpenJob(JOBS, [OPEN_A, SHUT_B]), null);
    check("  one whose own have all closed is told theirs have", noOpenJob(JOBS, [SHUT_B, SHUT_D]), "yours");
    check("  and one who may use every job, that every job has", noOpenJob([SHUT_B, SHUT_D], [SHUT_B, SHUT_D]), "every");
    check(
        "the words, typed out",
        [
            CLOSED_JOB_COPY.refusal("26-USA-02"),
            CLOSED_JOB_COPY.noOpenJob.delivery.every,
            CLOSED_JOB_COPY.noOpenJob.delivery.yours,
            CLOSED_JOB_COPY.noOpenJob.request.every,
            CLOSED_JOB_COPY.noOpenJob.request.yours,
        ].join(" | "),
        "26-USA-02 is closed. | " +
            "Every job is closed, so there is nothing to record a delivery against. | " +
            "Every job you are assigned to is closed, so there is nothing to record a delivery against. An Admin can add you to a job in Airtable. | " +
            "Every job is closed, so there is no job to raise a request on. | " +
            "Every job you are assigned to is closed, so there is no job to raise a request on. An Admin can add you to a job in Airtable."
    );

    log("");
    log("the job a request already stands on (requestJobId):");
    const withPurchases = [{ ...OPEN_A, directPurchases: ["recDp1"] }, { ...SHUT_B, directPurchases: ["recDp2"] }];
    check("its discipline's, when it has one", requestJobId({ jobId: OPEN_A.id, directPurchaseIds: ["recDp2"] }, withPurchases), OPEN_A.id);
    check("  before it has one, the job its direct purchase was recorded on", requestJobId({ jobId: "", directPurchaseIds: ["recDp2"] }, withPurchases), SHUT_B.id);
    check("  and none for a request on no job yet", `${requestJobId({ jobId: "" }, withPurchases)} ${requestJobId({ directPurchaseIds: ["recGone"] }, withPurchases)} ${requestJobId(undefined, undefined)}`, "null null null");

    // ── 2: one reading of the field ───────────────────────────────────────────
    log("");
    log("one reading of the field:");
    const jobsModule = readFileSync(repoPath("lib/airtable/jobs.js"), "utf8");
    check(
        "lib/airtable/jobs.js maps Closed Date on both readers the choices read",
        ["getJobByRecordId", "getAllJobs"]
            .map((name) => {
                const fn = resolveFunction(parseSource(jobsModule, "lib/airtable/jobs.js").ast, name);
                return `${name}: ${(jobsModule.slice(fn?.start ?? 0, fn?.end ?? 0).match(/closedDate: record\.get\("Closed Date"\) \?\? null/g) || []).length}`;
            })
            .join(", "),
        "getJobByRecordId: 1, getAllJobs: 1"
    );
    const readers = fieldReaders();
    check("  and no other file names the field", readers.names.join(" "), "lib/airtable/jobs.js");
    check("  nor reads closedDate off a job but the rule's own module", readers.members.join(" "), "lib/closedJob.js");

    // ── 3: every place a job is chosen asks it ────────────────────────────────
    log("");
    log("every place a job is newly chosen asks the rule:");
    for (const [place, file, asks] of CHOOSES) {
        if (!existsSync(repoPath(file))) {
            check(`${place}: ${file}`, "gone", "asks");
            continue;
        }
        const { ast } = parseFile(file);
        const missing = asks.filter((name) => callsTo(ast, name).length === 0);
        check(`${place}: ${file}`, missing.join(" ") || "asks", "asks");
    }
    for (const [file, fn, callee] of LIB_ASKS) {
        assert(`  ${file}:${fn} asks ${callee}`, callsTo(resolveFunction(parseFile(file).ast, fn) ?? {}, callee).length > 0);
    }
    // #667 — THE ASSET READERS SAY THE REFUSAL BARE AND EVERY OTHER WRITE WITH ITS PERIOD, and the two
    // forms stand only while the other screens' one-line notices keep theirs, so that is read too.
    const formOf = (call) => {
        const words = call?.arguments?.[2];
        if (!call) return "no call";
        if (!words) return "default";
        return words.type === "MemberExpression" ? `${words.object?.name}.${words.property?.name}` : words.type;
    };
    check(
        "  the Equipment & Tools readers say the refusal bare (#667)",
        LIB_ASKS.filter(([, , callee]) => callee === "closedJobRefusal")
            .map(([file, fn]) => `${fn} ${formOf(callsTo(resolveFunction(parseFile(file).ast, fn) ?? {}, "closedJobRefusal")[0])}`)
            .join(" | "),
        "readRegistration CLOSED_JOB_COPY.assetRefusal | readLend CLOSED_JOB_COPY.assetRefusal | readJobChange CLOSED_JOB_COPY.assetRefusal"
    );
    check(
        "  and every other write says it in the default form, with its period",
        WRITES.map(([file, fnName]) => {
            const { ast } = parseFile(file);
            return formOf(callsTo((fnName ? resolveFunction(ast, fnName) : ast) ?? {}, "closedJobRefusal")[0]);
        }).join(" "),
        "default default default default"
    );
    check(
        "  two forms only while /deliveries/new still says `Select a job.` — once it does not, `refusal` drops its period and `assetRefusal` goes",
        readFileSync(repoPath("app/deliveries/new/actions.js"), "utf8").includes('"Select a job."'),
        true
    );

    log("");
    log("every other reader of the jobs is named, with why:");
    const listed = new Set([...CHOOSES.map(([, file]) => file), ...SHOWS.map(([file]) => file)]);
    const found = jobReaders();
    check("a reader of the jobs that is neither a place choosing one nor named as showing one", found.filter((file) => !listed.has(file)).join(" ") || "none", "none");
    check("  a line naming a file that shows a job and reads none", SHOWS.filter(([file]) => !found.includes(file)).map(([file]) => file).join(" ") || "none", "none");
    check("  a line naming a place that is gone", CHOOSES.filter(([, file]) => !existsSync(repoPath(file))).map(([, file]) => file).join(" ") || "none", "none");
    // AN INDEPENDENT COUNT OF THE SAME READERS, by the import's text rather than the parse, so a walk
    // that silently found fewer files than there are cannot pass the lines above with nothing to say.
    const byText = [];
    for (const dir of ["app", "lib"]) {
        for (const full of listJsFiles(repoPath(dir))) {
            const rel = toPosix(relative(repoPath("."), full));
            if (rel.startsWith("lib/airtable/")) continue;
            if (/import \{[^}]*\b(getAllJobs|getJobByRecordId)\b[^}]*\} from "[^"]*airtable\/jobs(\.js)?";/.test(readFileSync(full, "utf8"))) byText.push(rel);
        }
    }
    check("  the parse finds every reader the import's text names", `${found.length}: ${found.join(" ")}`, `${byText.length}: ${byText.sort().join(" ")}`);
    assert("  and there are readers to find", byText.length > 20);

    log("");
    log("each write that reads its job refuses a closed one before writing:");
    for (const [file, fnName, writer] of WRITES) {
        const { ast } = parseFile(file);
        const fn = fnName ? resolveFunction(ast, fnName) : ast;
        const call = callsTo(fn ?? {}, "closedJobRefusal")[0];
        const where = `${file}${fnName ? `:${fnName}` : ""}`;
        assert(`${where} asks closedJobRefusal`, Boolean(call));
        check(`  ${where}: outside every try`, Boolean(call) && insideTry(fn, call), false);
        if (writer) assert(`  ${where}: before ${writer}`, callsBefore(fn, "closedJobRefusal", writer));
        assert(`  ${where}: and its answer is returned`, answered(fn, call));
    }
    // THE REQUEST'S HELD JOB, ON BOTH SIDES: the page offers the jobs it may use less the closed but
    // the draft's own, and the save asks the refusal of the same draft's job, through one function.
    const requestPage = parseFile("app/prs/new/page.js");
    const renderPage = resolveFunction(requestPage.ast, "renderNewPRPage");
    check(
        "the request page offers the open jobs, says why when there are none, and keeps the draft's own closed one apart",
        ["offered", "noOpenJobAs", "heldJobId", "heldClosed"].map((name) => boundText(requestPage, renderPage, name)).join(" | "),
        "offeredJobs(reachableJobs) | noOpenJob(jobs, reachableJobs) | initialDraft ? requestJobId(initialDraft, jobs) : null | " +
            "reachableJobs.find((j) => j.id === heldJobId && !offered.includes(j)) ?? null"
    );
    check(
        "  handing it with the draft it belongs to",
        boundText(requestPage, renderPage, "heldJob"),
        "heldClosed ? { ...heldClosed, mine: assignedJobIds.has(heldClosed.id), draftRecordId: initialDraft.recordId } : null"
    );
    // THE FORM OFFERS IT WHILE IT EDITS THAT DRAFT AND NO OTHER, which is the record a save re-targets
    // and so the draft the actions keep the job for: a reader who declines the resume prompt is
    // writing a new request, which the server refuses a closed job.
    const requestFormShape = parseFile("app/prs/new/PRForm.js");
    const formBody = requestFormShape.ast;
    check(
        "  and the form offers it only while it edits that draft, among its own group",
        ["heldNow", "mineOffered", "othersOffered"].map((name) => boundText(requestFormShape, formBody, name)).join(" | "),
        "heldJob && draftRecordId === heldJob.draftRecordId ? heldJob : null | " +
            "useMemo(() => (heldNow?.mine ? [...(myJobs || []), heldNow] : myJobs || []), [myJobs, heldNow]) | " +
            "useMemo(() => (heldNow && !heldNow.mine ? [...(otherJobs || []), heldNow] : otherJobs || []), [otherJobs, heldNow])"
    );
    let rendersOffered = 0;
    walk(formBody, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "map" && ["mineOffered", "othersOffered"].includes(n.callee.object?.name)) rendersOffered++;
        if (n.type === "CallExpression" && n.callee?.property?.name === "map" && ["myJobs", "otherJobs"].includes(n.callee.object?.name)) rendersOffered -= 10;
    });
    check("  drawing its options from those and never from the page's lists alone", rendersOffered, 3);
    const requestJudge = parseFile("app/prs/new/actions.js");
    const judge = resolveFunction(requestJudge.ast, "jobRefusal");
    const judgeCall = callsTo(judge ?? {}, "closedJobRefusal")[0];
    const judgeHeld = judgeCall?.arguments?.[1];
    check(
        "  and the save refuses a closed job but the one its draft stands on",
        `${boundText(requestJudge, judge, "held")} | ${judgeHeld ? requestJudge.source.slice(judgeHeld.start, judgeHeld.end) : "none"}`,
        "existing ? requestJobId({ jobId: existing.job?.[0], directPurchaseIds: existing.directPurchaseRowIds }, jobs) : null | held"
    );
    const requestForm = parseFile("app/prs/new/PRForm.js");
    let drawsNotice = false;
    walk(requestForm.ast, (n) => {
        if (n.type !== "LogicalExpression" || n.left?.name !== "noOpenJobNotice" || n.right?.type !== "JSXElement") return;
        walk(n.right, (m) => {
            if (m.type === "JSXExpressionContainer" && m.expression?.name === "noOpenJobNotice") drawsNotice = true;
        });
    });
    let handsNotice = "none";
    walk(requestPage.ast, (n) => {
        if (n.type === "JSXAttribute" && n.name?.name === "noOpenJobNotice") handsNotice = requestPage.source.slice(n.value.expression.start, n.value.expression.end);
    });
    check(
        "  the page hands the form the request's sentence, and the form draws it",
        `${handsNotice} | ${drawsNotice}`,
        "noOpenJobAs ? CLOSED_JOB_COPY.noOpenJob.request[noOpenJobAs] : null | true"
    );
    const requestActions = parseFile("app/prs/new/actions.js").ast;
    for (const name of ["saveDraftAction", "createPRAction"]) {
        const call = callsTo(resolveFunction(requestActions, name) ?? {}, "jobRefusal")[0];
        const third = call?.arguments?.[2];
        check(
            `${name} hands jobRefusal the draft it re-targets, which keeps its own job`,
            third?.type === "MemberExpression" ? `${third.object?.name}.${third.property?.name}` : "none",
            "resumed.existing"
        );
    }

    log("");
    log("the two screens a closed job can leave with no choice say why, and their briefs quote it:");
    check("docs/briefs/deliveries-new.md", briefQuotes("docs/briefs/deliveries-new.md", Object.values(CLOSED_JOB_COPY.noOpenJob.delivery)).join(" | ") || "quotes both", "quotes both");
    check("docs/briefs/prs-new.md", briefQuotes("docs/briefs/prs-new.md", Object.values(CLOSED_JOB_COPY.noOpenJob.request)).join(" | ") || "quotes both", "quotes both");
    check("  and the refusal's shape is quoted where a job is chosen", briefQuotes("docs/briefs/prs-new.md", ["`{Job Code} is closed.`"]).join("") || "quoted", "quoted");

    // ── anti-vacuity: each reading tells the right shape from the wrong one ─────
    log("");
    log("anti-vacuity — each reading tells the right shape from the wrong one:");
    const planted = parseSource(
        [
            "async function late() { await createDelivery({}); const closed = closedJobRefusal(job); if (closed) return closed; }",
            "async function wrapped() { try { const closed = closedJobRefusal(job); } catch {} await createDelivery({}); }",
            "async function unread() { const closed = closedJobRefusal(job); await createDelivery({}); }",
            "function reads(job) { return job.closedDate ? 1 : 0; }",
        ].join("\n"),
        "planted"
    );
    check("a refusal after the write is seen as late", callsBefore(resolveFunction(planted.ast, "late"), "closedJobRefusal", "createDelivery"), false);
    const wrapped = resolveFunction(planted.ast, "wrapped");
    check("  and one inside a try as inside it", insideTry(wrapped, callsTo(wrapped, "closedJobRefusal")[0]), true);
    const unread = resolveFunction(planted.ast, "unread");
    const late = resolveFunction(planted.ast, "late");
    check("  an answer nobody returns on is seen, and one returned on", `${answered(unread, callsTo(unread, "closedJobRefusal")[0])} ${answered(late, callsTo(late, "closedJobRefusal")[0])}`, "false true");
    let plantedMember = 0;
    walk(planted.ast, (n) => {
        if (n.type === "MemberExpression" && !n.computed && n.property?.name === "closedDate") plantedMember++;
    });
    check("  a closedDate read off a job is seen", plantedMember, 1);
    check("  a choice that asks nothing is seen missing its call", callsTo(parseSource("const jobs = await getAllJobs();").ast, "offeredJobs").length, 0);
}

if (isMain(import.meta.url)) await standalone(title, run);

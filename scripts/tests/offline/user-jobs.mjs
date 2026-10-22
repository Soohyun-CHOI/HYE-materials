// Asking a reader with no job which jobs they work on, and what that may write (#554).
//
// WHAT THIS IS DEFENDING. The job step writes `Users."Assigned Jobs"` from the app, on the live
// base, on real people's rows — until #554 that field was set by hand and by the demo seed
// alone. So the claims below are about what the write may reach rather than about the screen:
// the row is the session's own, it is written only while it holds no job, the reader is one the
// step is for, and the payload is that one field and nothing a Role, a flag or a Status could
// ride in on. #531's guard on `Assets` and `Asset Log` is for scripts; this is the app's own
// write, and this file is its fence.
//
// AND WHO IS ASKED, WHICH IS A GATE IN `requireUser()` LIKE THE NAME'S (#381). Asked after the
// name and never of a nameless reader, reached through the builder rather than a spelled
// address — `user-name.mjs`'s assertion 3, one step on — and costing no read: the predicate is
// a pure module, called here, that answers from the row the session already holds.
//
// FIXED-TEXT LABELS, so a mutation that changes a value fails its label rather than renaming it.
//
// WHAT A PASS DOES NOT PROVE. Source shape is not execution (`docs/notes/verification.md`): a
// write after an early return passes the order the AST reads, and nothing here reaches the base
// or draws the step. The browser walk in the pull request is what showed the step asked and the
// row written; this holds that nothing cheap moved the fence.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { callsBefore, callsTo, listJsFiles, parseFile, parseSource, repoPath, resolveFunction, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { chosenJobIds, isJobsStep, jobRows, jobsOffered, jobsPath, JOBS_PARAM, needsJobs, USER_JOBS_COPY } from "../../../lib/userJobs.js";

export const title = "Asking a reader with no job for their jobs, and the one field it writes (#554)";

const OWNER = "lib/userJobs.js";
const GATE = "lib/authz.js";
const PAGE = "app/login/jobs/page.js";
const ACTION = "app/login/jobs/actions.js";
const FORM = "app/login/jobs/JobsForm.js";
const LAYOUT = "app/login/layout.js";
const MAPPER = "lib/airtable/users.js";

/** Every `.js` under these — and every `.mjs`, which `listJsFiles` leaves out — repo-relative and POSIX-separated. */
function filesUnder(dirs) {
    const root = toPosix(repoPath("."));
    const modules = (dir) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
            const full = join(dir, entry.name);
            if (entry.isDirectory()) return modules(full);
            return entry.name.endsWith(".mjs") ? [full] : [];
        });
    return dirs.flatMap((dir) => [...listJsFiles(repoPath(dir)), ...modules(repoPath(dir))].map((abs) => toPosix(abs).slice(root.length + 1)));
}

/** The keys of every `fields: { … }` object a write call inside `fn` carries, one list per call. */
export function writtenFields(fn) {
    const writes = [];
    walk(fn, (node) => {
        if (node.type !== "CallExpression" || node.callee?.type !== "MemberExpression") return;
        const verb = node.callee.property?.name;
        if (verb !== "update" && verb !== "create") return;
        const keys = [];
        walk(node.arguments[0] ?? {}, (inner) => {
            if (inner.type !== "Property" || (inner.key?.name ?? inner.key?.value) !== "fields") return;
            if (inner.value?.type !== "ObjectExpression") return;
            for (const p of inner.value.properties) keys.push(p.key?.type === "Literal" ? p.key.value : p.key?.name);
        });
        writes.push(keys.sort());
    });
    return writes;
}

/**
 * Whether `fn` reads its row before it writes and returns without writing when the row holds a
 * job: the first read comes before the first write, and between them an `if` that names
 * `Assigned Jobs` returns.
 */
export function readsBeforeWriting(fn, source) {
    const read = callsTo(fn, "findByRecordIds")[0];
    const write = callsTo(fn, "update")[0];
    if (!read || !write || read.start > write.start) return false;
    let guarded = false;
    walk(fn, (node) => {
        if (node.type !== "IfStatement" || node.start < read.start || node.end > write.start) return;
        const test = source.slice(node.test.start, node.test.end);
        const returns = node.consequent.type === "ReturnStatement" || node.consequent.body?.some?.((s) => s.type === "ReturnStatement");
        if (test.includes('"Assigned Jobs"') && returns) guarded = true;
    });
    return guarded;
}

/**
 * What an action does with its reader: the name bound to `await requireUser()`, whether the
 * writer is handed that binding's `.id` and nothing else, whether `needsJobs` is asked before the
 * write, and the names the form is read by.
 */
export function actionShape(fn) {
    let reader = null;
    walk(fn, (node) => {
        if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier") return;
        const call = node.init?.type === "AwaitExpression" ? node.init.argument : null;
        if (call?.type === "CallExpression" && call.callee?.name === "requireUser") reader = node.id.name;
    });
    const writes = callsTo(fn, "assignFirstJobs");
    const ownRow = writes.length > 0 && writes.every((call) => {
        const row = call.arguments[0];
        return row?.type === "MemberExpression" && row.object?.name === reader && row.property?.name === "id";
    });
    const formReads = [];
    walk(fn, (node) => {
        if (node.type !== "CallExpression" || node.callee?.type !== "MemberExpression") return;
        if (node.callee.object?.name !== "formData") return;
        const arg = node.arguments[0];
        formReads.push(arg?.type === "Identifier" ? arg.name : JSON.stringify(arg?.value ?? null));
    });
    return { reader, writes: writes.length, ownRow, asksFirst: callsBefore(fn, "needsJobs", "assignFirstJobs"), formReads: [...new Set(formReads)].sort() };
}

/** The functions in a file that write `Assigned Jobs`, by name. */
export function assignedJobsWriters(ast) {
    const found = [];
    walk(ast, (node) => {
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
        if (decl?.type !== "FunctionDeclaration") return;
        if (writtenFields(decl).some((keys) => keys.includes("Assigned Jobs"))) found.push(decl.id.name);
    });
    return [...new Set(found)].sort();
}

export function run({ check, assert, log }) {
    // ── 1: who is asked, called ─────────────────────────────────────────────
    log("who is asked for their jobs, called:");
    const employee = { firstName: "Jane", lastName: "Doe", email: "jane@x.com", role: "Employee", isAdmin: false, assignedJobs: [] };
    check("a named employee with no job is asked", needsJobs(employee), true);
    check("  and one whose row has no job field at all", needsJobs({ ...employee, assignedJobs: undefined }), true);
    check("  but not one holding a job", needsJobs({ ...employee, assignedJobs: ["recJob1"] }), false);
    check("  nor the office", needsJobs({ ...employee, isAdmin: true }), false);
    check("  nor the President", needsJobs({ ...employee, role: "President" }), false);
    check("  nor a reader with no name yet, whose name is asked first", needsJobs({ ...employee, firstName: "" }), false);
    check("  and a flag that is merely truthy is not the office", needsJobs({ ...employee, isAdmin: "true" }), true);

    log("");
    log("the step's address, through its builder:");
    check("the builder answers the step's own address", isJobsStep(jobsPath(null)), true);
    check("  and carries a destination through", jobsPath("/assets/HYE-AST-260909-004"), "/login/jobs?destination=%2Fassets%2FHYE-AST-260909-004");
    check("  while refusing one that points out of the app", jobsPath("//evil.example"), "/login/jobs");
    check("  and one back into the sign-in flow", jobsPath("/login/name"), "/login/jobs");
    check("  the step with its destination is the step", isJobsStep("/login/jobs?destination=/asset-categories"), true);
    check("  where the name step is not", isJobsStep("/login/name"), false);

    log("");
    log("what is offered and what is kept, called:");
    const jobs = [
        { id: "recC", jobCode: "26-USA-10", jobName: "Madera solar field" },
        { id: "recA", jobCode: "26-USA-9", jobName: "Merced school annex" },
        { id: "recB", jobCode: "24-USA-07", jobName: "Sacramento rail yard" },
    ];
    check("every job, by code, a run of digits read as a number", jobsOffered(jobs).map((j) => j.jobCode).join(" "), "24-USA-07 26-USA-9 26-USA-10");
    check("a choice keeps jobs alone, once each, in code order", chosenJobIds(["recC", "recX", "recB", "recC", "recUser"], jobs).join(" "), "recB recC");
    check("  and nothing chosen keeps nothing", chosenJobIds([], jobs).length, 0);
    const list = (args) => jobRows({ jobs, ...args }).rows.map((r) => `${r.jobCode}${r.on ? "*" : ""}`).join(" ");
    check("an empty search lists every job, the chosen marked", list({ chosen: ["recA"] }), "24-USA-07 26-USA-9* 26-USA-10");
    check("  a search lists what carries every word, in code and name", list({ query: "solar 26" }), "26-USA-10");
    check("  and keeps the jobs chosen before it at the top", list({ chosen: ["recB"], pinned: ["recB"], query: "solar" }), "24-USA-07* 26-USA-10");
    check("  where one chosen during it is not kept", list({ chosen: ["recA"], pinned: [], query: "solar" }), "26-USA-10");
    check("  and one kept that the search finds too is listed once, among the matches", list({ chosen: ["recB", "recC"], pinned: ["recB", "recC"], query: "solar" }), "24-USA-07* 26-USA-10*");
    check("  and a search finding nothing says so", jobRows({ jobs, query: "fremont" }).noMatch, true);
    check("  under the rows it keeps", list({ chosen: ["recB"], pinned: ["recB"], query: "fremont" }), "24-USA-07*");

    log("");
    log("the step's words, typed out:");
    check("its heading", USER_JOBS_COPY.heading, "Choose your jobs");
    check("its sentence", USER_JOBS_COPY.sentence, "Pick every job you work on.");
    check("its search, named and shown", USER_JOBS_COPY.search, "Search jobs");
    check("its list's name", USER_JOBS_COPY.list, "Jobs");
    check("a search that finds nothing", `${USER_JOBS_COPY.noneMatch} ${USER_JOBS_COPY.echo(" fremont ")}`, "No jobs match “fremont”");
    check("its action with nothing chosen", USER_JOBS_COPY.action(0), "Continue");
    check("  with one", USER_JOBS_COPY.action(1), "Continue with 1 job");
    check("  and with two", USER_JOBS_COPY.action(2), "Continue with 2 jobs");
    check("while it saves", USER_JOBS_COPY.working, "Saving…");
    check("nothing chosen", USER_JOBS_COPY.refusal.none, "Choose at least one job.");
    check("a write that did not happen", USER_JOBS_COPY.refusal.failed, "Couldn't save your jobs. Try again.");
    check("the field each job is sent in", JOBS_PARAM, "job");

    // ── 2: the gate, by its imported identifiers, after the name ────────────
    log("");
    log("`requireUser()` asks after the name, through the builder, reading nothing:");
    const gate = parseFile(GATE);
    const gateImports = new Set(
        gate.ast.body
            .filter((n) => n.type === "ImportDeclaration" && /(^|\/)userJobs(\.js)?$/.test(String(n.source.value)))
            .flatMap((n) => n.specifiers.map((s) => s.imported?.name ?? s.local.name))
    );
    check("lib/authz.js imports the three", [...gateImports].sort().join(" "), "isJobsStep jobsPath needsJobs");
    const askJobs = resolveFunction(gate.ast, "askForJobsIfMissing");
    assert("  askForJobsIfMissing resolves", Boolean(askJobs));
    for (const name of ["needsJobs", "isJobsStep", "jobsPath"]) assert(`  and calls ${name}`, Boolean(askJobs) && callsTo(askJobs, name).length === 1);
    const asked = new Set();
    walk(askJobs ?? {}, (n) => {
        if (n.type === "CallExpression") asked.add(n.callee?.type === "Identifier" ? n.callee.name : n.callee?.property?.name);
    });
    check("  and calls nothing that could read the base", [...asked].sort().join(" "), "get headers isJobsStep jobsPath needsJobs redirect");
    const requireUserFn = resolveFunction(gate.ast, "requireUser");
    const nameAsk = callsTo(requireUserFn ?? {}, "askForNameIfMissing");
    const jobsAsk = callsTo(requireUserFn ?? {}, "askForJobsIfMissing");
    check("requireUser asks for the jobs once", jobsAsk.length, 1);
    assert("  after it asks for the name", nameAsk.length === 1 && jobsAsk.length === 1 && nameAsk[0].start < jobsAsk[0].start);
    const owner = parseFile(OWNER);
    assert("  and the predicate asks the name first", callsTo(resolveFunction(owner.ast, "needsJobs") ?? {}, "needsName").length === 1);
    const spelled = [];
    walk(gate.ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string" && n.value.includes("/login/jobs")) spelled.push(n.value);
    });
    check("the step's address spelled in lib/authz.js", spelled.length, 0);
    const probe = [];
    walk(parseSource('redirect("/login/jobs");').ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string" && n.value.includes("/login/jobs")) probe.push(n);
    });
    assert("  and a planted literal is caught", probe.length === 1);
    check(
        "the predicate's module imports pure modules alone",
        owner.ast.body.filter((n) => n.type === "ImportDeclaration").map((n) => n.source.value).sort().join(" "),
        "./assetCategory.js ./loginDestination.js ./searchTokens.js ./userName.js"
    );

    // ── 3: the page sends on anybody the step is not for ────────────────────
    log("");
    log("the step's page asks the same question before it reads the jobs:");
    const page = parseFile(PAGE);
    const render = resolveFunction(page.ast, "renderJobsStepPage");
    assert("its render resolves", Boolean(render));
    assert("  it resolves the reader first", callsBefore(render ?? {}, "requireUser", "getAllJobs"));
    assert("  and sends on anybody it is not for before reading them", callsBefore(render ?? {}, "needsJobs", "getAllJobs") && callsBefore(render ?? {}, "redirect", "getAllJobs"));

    // ── 4: the action writes the session's row, asked first, by two names ───
    log("");
    log("the action writes the reader's own row, and only once it has asked:");
    const action = parseFile(ACTION);
    const handler = resolveFunction(action.ast, "chooseJobsAction");
    const shape = actionShape(handler ?? {});
    check("the reader is the session's", shape.reader, "user");
    check("  the action writes through the one writer, once", shape.writes, 1);
    assert("  and hands it the session's row id and nothing else", shape.ownRow);
    assert("  after asking whether the reader is one the step is for", shape.asksFirst);
    check("  and reads the form by these names alone", shape.formReads.join(" "), "DESTINATION_PARAM JOBS_PARAM");
    check(
        "  and imports nothing else from the users table",
        action.ast.body
            .filter((n) => n.type === "ImportDeclaration" && /lib\/airtable\/users$/.test(String(n.source.value)))
            .flatMap((n) => n.specifiers.map((s) => s.imported.name))
            .join(" "),
        "assignFirstJobs"
    );

    // ── 5: the writer: one field, only on a row holding none ────────────────
    log("");
    log("the writer writes `Assigned Jobs` alone, and only to a row holding none:");
    const users = parseFile(MAPPER);
    const writer = resolveFunction(users.ast, "assignFirstJobs");
    assert("assignFirstJobs resolves", Boolean(writer));
    check("  its one write carries this one field", JSON.stringify(writtenFields(writer ?? {})), JSON.stringify([["Assigned Jobs"]]));
    assert("  and it reads the row first and returns on a job held", readsBeforeWriting(writer ?? {}, users.source));
    const appFiles = filesUnder(["app", "lib"]);
    const writers = appFiles.flatMap((rel) => assignedJobsWriters(parseFile(rel).ast).map((name) => `${rel}:${name}`));
    check("the app's writers of the field", writers.join(" "), "lib/airtable/users.js:addAssignedJob lib/airtable/users.js:assignFirstJobs");
    const callers = filesUnder(["app", "lib", "scripts"]).filter((rel) => rel !== MAPPER && callsTo(parseFile(rel).ast, "assignFirstJobs").length > 0);
    check("  and the one place the step's writer is called", callers.join(" "), ACTION);

    // ── 6: the list's two looks, read off the files ─────────────────────────
    log("");
    log("the list marks itself, the frame reads the mark, and the action is drawn once a width:");
    const layout = parseFile(LAYOUT).source;
    check(
        "the frame stands a list's column at 10% above and below",
        ["items-stretch", "pt-sign-in-list-step-inset-y", "pb-sign-in-list-step-inset-y"].map((u) => layout.includes(`sm:has-[[data-sign-in-list]]:${u}`)).join(" "),
        "true true true"
    );
    const form = parseFile(FORM).source;
    assert("  and the step's form carries the mark", /<form data-sign-in-list=""/.test(form));
    const desk = form.match(/<div className=\{`max-sm:hidden[^]*?<\/Button>/)?.[0] ?? "";
    const phone = form.match(/<div className="sm:hidden">[^]*?<\/Button>/)?.[0] ?? "";
    assert("at a desk the action is disabled while nothing is chosen", /disabled=\{count === 0\}/.test(desk));
    assert("  and on a phone it is never disabled", phone.length > 0 && !/disabled=/.test(phone));

    // ── anti-vacuity: each detector says yes where the answer is known ──────
    log("");
    log("anti-vacuity — each detector is seen to find what it looks for:");
    const planted = parseSource(
        [
            'export async function setRole(id) {',
            '    await base(T).update([{ id, fields: { "Assigned Jobs": [], Role: "President" } }]);',
            "}",
            "export async function blind(id, jobs) {",
            '    await base(T).update([{ id, fields: { "Assigned Jobs": jobs } }]);',
            "    const [r] = await findByRecordIds(T, [id]);",
            "}",
        ].join("\n")
    );
    check("  a second field riding the write is seen", JSON.stringify(writtenFields(resolveFunction(planted.ast, "setRole"))), JSON.stringify([["Assigned Jobs", "Role"]]));
    assert("  a write before its read is seen", !readsBeforeWriting(resolveFunction(planted.ast, "blind"), planted.source));
    check("  and both planted writers are found", assignedJobsWriters(planted.ast).join(" "), "blind setRole");
    const forged = parseSource(
        [
            "export async function forged(prevState, formData) {",
            "    const user = await requireUser();",
            '    await assignFirstJobs(formData.get("user"), []);',
            "    if (!needsJobs(user)) return {};",
            "}",
        ].join("\n")
    );
    const forgedShape = actionShape(resolveFunction(forged.ast, "forged"));
    assert("  a row id taken from the form is seen", !forgedShape.ownRow);
    assert("  and a write before the question", !forgedShape.asksFirst);
    check("  and a form read by a literal name", forgedShape.formReads.join(" "), '"user"');
}

if (isMain(import.meta.url)) standalone(title, run);

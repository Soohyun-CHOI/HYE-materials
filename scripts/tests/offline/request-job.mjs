// A request goes on a job its requester may act on (#639).
//
// WHAT THIS FILE HOLDS, and each claim is a different kind of thing.
//
//   1. THE RULE, on the readers the request form has. It is
//      `lib/deliveryAccess.js:canAccessJobDeliveries` — a person's own `Assigned Jobs`,
//      every job for the office and the President — and `delivery-access.mjs` pins it for
//      the axis it was written for. The cases are restated here as a request's, so a
//      change made for deliveries that would move what a request may be raised on fails
//      in the file that names the request.
//   2. THE TWO WRITES ASK IT. `saveDraftAction` and `createPRAction` each call
//      `jobRefusal` with the session's user and the discipline the submission names,
//      outside every `try`, before `persistPRFromForm`, and let its answer decide a
//      return. The submit asks it before `findDuplicatePR` too, whose warning names
//      another request on the discipline, who raised it and when. `jobRefusal` reads the
//      disciplines and asks the rule of the discipline's `jobId`, and the brief quotes
//      the sentence it answers with.
//   3. THE SCREEN OFFERS WHAT THE RULE ADMITS. The page builds both job lists out of
//      `accessibleJobs` rather than out of the whole table, and the form draws a draft's
//      job the reader is not offered as a `disabled` option, only while it is the one
//      chosen. The discipline the actions judge, and the vendor beside it, are sent from
//      the form's state by hidden inputs, since a select React has reset sends nothing.
//
// WHAT IT CANNOT SEE. Source order is not execution order (`_ast.mjs`): a call inside
// `if (false)` passes. Whether a refused save writes nothing, whether the dropdown draws
// one list or two groups, and which words reach the red line are browser work, walked on
// the test base for #639. That the `Discipline` a request stores is the one judged rests
// on `persistPRFromForm` writing the parsed `disciplineId`, which nothing here reads.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { accessibleJobs, canAccessJobDeliveries } from "../../../lib/deliveryAccess.js";
import { callsBefore, callsTo, insideTry, parseFile, parseSource, repoPath, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A request goes on a job its requester may act on (#639)";

const ON_SITE = "recJobSite";
const ELSEWHERE = "recJobElsewhere";

const requester = { id: "recU1", role: "Employee", isAdmin: false, assignedJobs: [ON_SITE] };
const office = { id: "recU2", role: "Employee", isAdmin: true, assignedJobs: [] };
const president = { id: "recU3", role: "President", isAdmin: false, assignedJobs: [] };

/** The declarator binding `name` inside `fn`, or null. */
function declaratorOf(fn, name) {
    let found = null;
    walk(fn, (n) => {
        if (!found && n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.id.name === name) found = n;
    });
    return found;
}

/** The name bound to `await <callee>(...)` inside `fn`, or null. */
function boundAwaitOf(fn, callee) {
    let name = null;
    walk(fn, (n) => {
        if (name || n.type !== "VariableDeclarator" || n.init?.type !== "AwaitExpression") return;
        const call = n.init.argument;
        if (call?.type === "CallExpression" && call.callee?.name === callee && n.id?.type === "Identifier") {
            name = n.id.name;
        }
    });
    return name;
}

/** Does an `if (name) return ...` sit inside `fn`? */
function returnsOn(fn, name) {
    let found = false;
    walk(fn, (n) => {
        if (n.type !== "IfStatement" || n.test?.type !== "Identifier" || n.test.name !== name) return;
        const body = n.consequent?.type === "BlockStatement" ? n.consequent.body[0] : n.consequent;
        if (body?.type === "ReturnStatement") found = true;
    });
    return found;
}

/** Is `name` declared inside `fn` as `<source>.filter(...)`, and what is `<source>`? */
function filteredFrom(fn, name) {
    const init = declaratorOf(fn, name)?.init;
    if (init?.type !== "CallExpression" || init.callee?.type !== "MemberExpression") return null;
    if (init.callee.property?.name !== "filter" || init.callee.object?.type !== "Identifier") return null;
    return init.callee.object.name;
}

/** JSX attribute `name` on an opening element, or undefined. */
function attr(element, name) {
    return (element.attributes || []).find((a) => a.type === "JSXAttribute" && a.name?.name === name);
}

/** For each `<input type="hidden" name={field}>`, the identifier its `value` reads. */
function hiddenInputsNamed(parsed, field) {
    const out = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== "input") return;
        if (attr(n, "type")?.value?.value !== "hidden" || attr(n, "name")?.value?.value !== field) return;
        out.push(attr(n, "value")?.value?.expression?.name ?? null);
    });
    return out;
}

/** The `name` of the `<select id={id}>`, null when it has none, undefined when no such select. */
function selectNameOf(parsed, id) {
    let found;
    walk(parsed.ast, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== "select" || attr(n, "id")?.value?.value !== id) return;
        found = attr(n, "name")?.value?.value ?? null;
    });
    return found;
}

/**
 * The `<option>` elements whose `value` is `{<object>.id}`, each with whether it carries
 * `disabled` and whether the expression rendering it compares `jobId` with that same id.
 */
function optionsValued(parsed, objectName) {
    const out = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "LogicalExpression" && n.type !== "JSXElement") return;
        const element = n.type === "LogicalExpression" ? n.right : n;
        if (element?.type !== "JSXElement" || element.openingElement?.name?.name !== "option") return;
        const attrs = element.openingElement.attributes || [];
        const value = attrs.find((a) => a.name?.name === "value")?.value?.expression;
        if (value?.type !== "MemberExpression" || value.object?.name !== objectName || value.property?.name !== "id") return;
        if (n.type === "JSXElement" && out.some((o) => o.element === element)) return;
        let guarded = false;
        if (n.type === "LogicalExpression") {
            walk(n.left, (m) => {
                if (
                    m.type === "BinaryExpression" &&
                    m.operator === "===" &&
                    m.left?.name === "jobId" &&
                    m.right?.type === "MemberExpression" &&
                    m.right.object?.name === objectName &&
                    m.right.property?.name === "id"
                ) {
                    guarded = true;
                }
            });
        }
        const existing = out.find((o) => o.element === element);
        if (existing) existing.guarded = existing.guarded || guarded;
        else out.push({ element, disabled: attrs.some((a) => a.name?.name === "disabled"), guarded });
    });
    return out;
}

export function run({ check, assert, log }) {
    // ── 1: the rule, as a request's ───────────────────────────────────────
    log("a request may be raised on a job the rule admits, and no other:");
    check("a requester on their own job", canAccessJobDeliveries(requester, ON_SITE), true);
    check("  not on a job they are not assigned to", canAccessJobDeliveries(requester, ELSEWHERE), false);
    check("the office on a job of nobody's", canAccessJobDeliveries(office, ELSEWHERE), true);
    check("the President on a job of nobody's", canAccessJobDeliveries(president, ELSEWHERE), true);
    check("a discipline with no job is nobody's, the office's included", canAccessJobDeliveries(office, null), false);
    const jobs = [
        { id: ON_SITE, jobCode: "26-A" },
        { id: ELSEWHERE, jobCode: "26-B" },
    ];
    check("a requester is offered their own job alone", accessibleJobs(requester, jobs).map((j) => j.jobCode).join(), "26-A");
    check("the office every job", accessibleJobs(office, jobs).map((j) => j.jobCode).join(), "26-A,26-B");

    // ── 2: the two writes ask it ───────────────────────────────────────────
    log("");
    log("both writes ask it of the discipline they name, before they write:");
    const actions = parseFile("app/prs/new/actions.js");
    const judge = resolveFunction(actions.ast, "jobRefusal");
    assert("jobRefusal exists", Boolean(judge));
    assert("  and reads the disciplines the form's picker was built from", callsTo(judge, "getAllDisciplines").length > 0);
    const asked = callsTo(judge, "canAccessJobDeliveries")[0];
    assert("  and asks canAccessJobDeliveries", Boolean(asked));
    const [askedUser, askedJob] = asked?.arguments ?? [];
    check("  of the user it was handed", askedUser?.name, "user");
    check("  and of the discipline's job", askedJob?.type === "MemberExpression" ? askedJob.property?.name : null, "jobId");

    for (const name of ["saveDraftAction", "createPRAction"]) {
        const fn = resolveFunction(actions.ast, name);
        assert(`${name} exists`, Boolean(fn));
        const call = callsTo(fn, "jobRefusal")[0];
        assert(`  ${name} asks jobRefusal`, Boolean(call));
        check(`  with the session's user`, call?.arguments?.[0]?.name, "user");
        check(`  which is requireUser()'s`, boundAwaitOf(fn, "requireUser"), "user");
        const discipline = call?.arguments?.[1];
        const namesDiscipline =
            discipline?.name === "disciplineId" ||
            (discipline?.type === "MemberExpression" && discipline.property?.name === "disciplineId");
        assert(`  and the discipline the submission names`, namesDiscipline);
        assert(`  before it persists`, callsBefore(fn, "jobRefusal", "persistPRFromForm"));
        check(`  outside every try`, Boolean(call) && insideTry(fn, call), false);
        const bound = boundAwaitOf(fn, "jobRefusal");
        assert(`  and its answer is returned (${bound})`, Boolean(bound) && returnsOn(fn, bound));
    }
    const submit = resolveFunction(actions.ast, "createPRAction");
    assert(
        "the submit asks it before the duplicate check names another request",
        callsBefore(submit, "jobRefusal", "findDuplicatePR")
    );
    // THE BRIEF QUOTES THE REFUSAL, AND NOTHING ELSE HOLDS THAT QUOTE: `screen-briefs.mjs`
    // checks quoted words only for a brief a design file draws, and this one is not. So the
    // sentence is read off the source and looked for in the brief — this file holds no
    // word of its own, and rewording the refusal without the brief fails here.
    const refusal = declaratorOf(actions.ast, "JOB_NOT_OFFERED")?.init;
    assert("the refusal is one string", refusal?.type === "Literal" && typeof refusal.value === "string");
    const brief = readFileSync(repoPath("docs/briefs/prs-new.md"), "utf8");
    assert(`  and docs/briefs/prs-new.md quotes it (${refusal?.value})`, brief.includes(`\`${refusal?.value}\``));

    // ── 3: the screen offers what the rule admits ──────────────────────────
    log("");
    log("the screen offers the jobs the rule admits:");
    const page = parseFile("app/prs/new/page.js");
    const render = resolveFunction(page.ast, "renderNewPRPage");
    assert("renderNewPRPage exists", Boolean(render));
    const offered = callsTo(render, "accessibleJobs")[0];
    assert("  and asks accessibleJobs", Boolean(offered));
    check("  of requireUser()'s user", offered?.arguments?.[0]?.name, "user");
    check("  bound as offeredJobs", declaratorOf(render, "offeredJobs")?.init?.callee?.name, "accessibleJobs");
    check("myJobs is narrowed from what it offers", filteredFrom(render, "myJobs"), "offeredJobs");
    check("otherJobs is narrowed from what it offers", filteredFrom(render, "otherJobs"), "offeredJobs");

    const form = parseFile("app/prs/new/PRForm.js");
    // WHAT THE JUDGMENT IS ASKED OF IS WHAT THE FORM HOLDS. A select React's reset has
    // landed on its placeholder submits nothing, so the discipline and the vendor go from
    // state through hidden inputs, and the two selects carry no `name` to send a second,
    // empty entry beside them.
    for (const field of ["disciplineId", "vendorId"]) {
        const fromState = hiddenInputsNamed(form, field);
        check(`${field} is submitted by one hidden input`, fromState.length, 1);
        check(`  holding the state of the same name`, fromState[0], field);
        check(`  and its select names nothing`, selectNameOf(form, field), null);
    }
    const unoffered = optionsValued(form, "unofferedJob");
    check("the form draws a draft's unoffered job as one option", unoffered.length, 1);
    check("  disabled, so it cannot be chosen again", unoffered[0]?.disabled, true);
    check("  and only while it is the job chosen", unoffered[0]?.guarded, true);

    // ── anti-vacuity: each reading can see the shape it rules out ─────────
    log("");
    log("anti-vacuity — each reading tells the right shape from the wrong one:");
    const planted = parseSource(
        [
            "async function late() { await persistPRFromForm(); const no = await jobRefusal(user, id); }",
            "async function early() { const no = await jobRefusal(user, id); if (no) return no; await persistPRFromForm(); }",
            "async function wrapped() { try { await jobRefusal(user, id); } catch {} }",
            "function whole() { const offeredJobs = accessibleJobs(user, jobs); const myJobs = jobs.filter(Boolean); }",
        ].join("\n"),
        "planted actions"
    );
    check("a judgment after the write is seen as late", callsBefore(resolveFunction(planted.ast, "late"), "jobRefusal", "persistPRFromForm"), false);
    check("  and one before it as early", callsBefore(resolveFunction(planted.ast, "early"), "jobRefusal", "persistPRFromForm"), true);
    check("an answer left unread is seen", returnsOn(resolveFunction(planted.ast, "late"), "no"), false);
    check("  and one returned on", returnsOn(resolveFunction(planted.ast, "early"), "no"), true);
    const wrapped = resolveFunction(planted.ast, "wrapped");
    check("a judgment inside a try is seen", insideTry(wrapped, callsTo(wrapped, "jobRefusal")[0]), true);
    check("a list narrowed from the whole table is seen", filteredFrom(resolveFunction(planted.ast, "whole"), "myJobs"), "jobs");
    const plantedForm = parseSource(
        [
            "const a = <select>{unofferedJob && <option value={unofferedJob.id}>x</option>}</select>;",
            "const b = <select>{unofferedJob && jobId === unofferedJob.id && <option value={unofferedJob.id} disabled>x</option>}</select>;",
        ].join("\n"),
        "planted form"
    );
    const plantedOptions = optionsValued(plantedForm, "unofferedJob");
    check("both planted options are found", plantedOptions.length, 2);
    check("  an enabled one is seen as enabled", plantedOptions[0]?.disabled, false);
    check("  an unguarded one is seen as unguarded", plantedOptions[0]?.guarded, false);
    check("  and the right one as both", `${plantedOptions[1]?.disabled} ${plantedOptions[1]?.guarded}`, "true true");
    const plantedFields = parseSource(
        '<form><select id="vendorId" name="vendorId" value={vendorId} /><input type="hidden" name="vendorId" value={other} /></form>',
        "planted fields"
    );
    check("a named select is seen", selectNameOf(plantedFields, "vendorId"), "vendorId");
    check("  and a hidden input reading other state", hiddenInputsNamed(plantedFields, "vendorId")[0], "other");
}

if (isMain(import.meta.url)) await standalone(title, run);

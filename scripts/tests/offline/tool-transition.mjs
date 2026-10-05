// Checking a tool item out and back in (#362).
//
// WHAT THIS FILE IS FOR. The transition is one press on the screen a scan lands
// on, so almost everything that could go wrong with it is silent: a control
// offered where the status allows nothing, a job admitted that is not the
// actor's, or — the one that would be worst — the app writing the OPPOSITE event
// from the one the button named, because the page was stale and the action took
// the form's word for it. None of that fails a render and none of it fails a
// type check.
//
// THE HALF THAT IS NOT A PURE FUNCTION IS READ OFF THE ACTION'S AST, WHICH IS
// #352's ANSWER TO A TRAP THIS AXIS FELL INTO THREE TIMES. #351, #353 and #352
// each wrote an assertion in terms of the constant it was checking, and each
// time a mutation moved the constant and the assertion with it. Naming the
// functions the action must call has the same weakness one level up: `event`,
// `formData.get("event")` and `"Checked out"` are all "an argument to
// createToolLogEntry", and only reading the ARGUMENT tells them apart. So the
// call sites are parsed and the argument's own source text is compared.
//
// AND #378 ADDED A THIRD THING IN THE SAME FAMILY: a refusal that returns and no
// more leaves every server-rendered fact on the screen as it was, so the sentence
// is true and everything around it is not. That one is held as a return's SHAPE —
// no `{ error }` built outside the one helper — because the name half of it passes
// with four calls to the helper standing beside a fifth branch doing it by hand.
//
// AND #458 PUT BOTH TRANSITIONS AND THE RETIREMENT IN DIALOGS, which is a fourth: the
// dialog asks `readSubmission` before it sends, so what keeps the rule one
// implementation is which function the dialog calls and what it reads into it — held
// off the dialog's source the way the action's arguments are, beside what a check-in
// asks first (`asksBeforeRecording`, by value) and the three parts of 1f's phone
// screen the dialogs open, which #463's foot bar opens later as they are.
//
// AND #463 GAVE THE PAGE TWO DRAWINGS OF ONE TRANSITION — a desk's header and a phone's
// foot bar — one answer between them (`ToolItemTransition.js`), and a refusal for a press
// somebody else's scan got in front of that names them. So the foot bar is held to the same
// reader the dialog is, the provider to the open rule the dialog had, the menu that holds
// the retirement to handing focus back, and the action to reading the row it names.
//
// WHAT IT CANNOT SEE. Whether any of it reaches a browser, which is this tier's
// standing limit; whether the two Airtable writes actually land; source order is
// not execution order, so "the log row is written before the cache" is a fact
// about the file rather than about the request; and — the one #378 leans on
// hardest — whether `refresh()` re-renders anything at all. That the framework
// does what its own source says it does was measured in a browser and recorded in
// the pull request, not here.
//
// AND WHAT IS NOT HERE BY DESIGN: the status and event vocabularies and the two
// maps between them. Those are offline/tool-status.mjs's, because they are
// vocabulary rather than screen — a fourth status has to visit both maps, and a
// check beside this screen would leave the pair half guarded.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { TOOL_EVENT, TOOL_STATUS, TOOL_STATUS_VALUES, EVENT_OFFERED_BY_STATUS } from "../../../lib/toolStatus.js";
import { TOOL_ITEM_COPY } from "../../../lib/toolItemView.js";
import { TOOL_JOB_COPY, chosenJobId } from "../../../lib/toolJob.js";
import {
    RECENT_NAMES_SHOWN,
    TOOL_TRANSITION_COPY,
    asksBeforeRecording,
    fieldRefusals,
    jobMoveNotice,
    narrowNames,
    offeredNames,
    planTransition,
    readRetirement,
    readSubmission,
    recentNamesFor,
} from "../../../lib/toolTransition.js";
import { callsBefore, callsTo, insideTry, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What a person may record against a tool item (#362, #363, #458, #463)";

const ACTION = "app/(tools)/tool-items/[toolItemId]/actions.js";
const DIALOG = "app/(tools)/tool-items/[toolItemId]/TransitionDialog.js";
const PROVIDER = "app/(tools)/tool-items/[toolItemId]/ToolItemTransition.js";
const BAR = "app/(tools)/tool-items/[toolItemId]/TransitionBar.js";
const REFUSAL = "app/(tools)/tool-items/[toolItemId]/TransitionRefusal.js";
const OPENER = "app/(tools)/tool-items/[toolItemId]/MoreActions.js";
const CONFIRM = "app/(tools)/tool-items/[toolItemId]/RetirementConfirm.js";
const JOB_SHEET = "app/(tools)/tool-items/[toolItemId]/JobSheet.js";
const NAME_SHEET = "app/(tools)/tool-items/[toolItemId]/NameSheet.js";
const PAGE = "app/(tools)/tool-items/[toolItemId]/page.js";

const JOB_A = { id: "recJobA", jobCode: "26-DEMO-01" };
const JOB_B = { id: "recJobB", jobCode: "26-DEMO-02" };
const ALL_JOBS = [JOB_A, JOB_B];

/** An actor assigned to the jobs named. */
const actor = (...jobs) => ({ id: "recUser", assignedJobs: jobs.map((j) => j.id) });

/**
 * A complete check-out submission, minus the job (#376).
 *
 * The name is spread into every case below rather than typed per call, so the
 * assertions about the EVENT and the JOB stay about those and are not quietly
 * testing the name as well. The cases that are about the name supply their own.
 */
const CHECKING_OUT = { event: TOOL_EVENT.CHECKED_OUT, checkedOutTo: "Dana K" };

/** One `Checked out` row as `recentNamesFor` reads them. */
const checkOut = (checkedOutTo, jobCode, eventAt) => ({
    event: TOOL_EVENT.CHECKED_OUT,
    jobCode,
    eventAt,
    checkedOutTo,
});

/** Every string the copy constant can produce, builders called with plausible input. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(TOOL_TRANSITION_COPY)) {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "object" && value) out.push(...Object.values(value));
    }
    out.push(TOOL_TRANSITION_COPY.moved({ by: "Jisoo Park", event: TOOL_EVENT.CHECKED_OUT, when: "09/25/2026 2:14 PM", attempted: TOOL_EVENT.CHECKED_OUT }));
    out.push(TOOL_TRANSITION_COPY.moved({ attempted: TOOL_EVENT.CHECKED_IN }));
    out.push(TOOL_TRANSITION_COPY.movesJob({ from: JOB_B.jobCode, to: JOB_A.jobCode }));
    out.push(TOOL_TRANSITION_COPY.retireHeading({ toolName: "DEMO Rotary Hammer", toolItemId: "HYE-TL-261001-022" }));
    out.push(
        TOOL_TRANSITION_COPY.statusNotUpdated({
            toolItemId: "HYE-TL-260909-004",
            event: TOOL_EVENT.CHECKED_OUT,
            status: TOOL_STATUS.IN_STOCK,
        })
    );
    return out.filter((s) => typeof s === "string");
}

/**
 * The noun the design replaced (#455), in any number and case.
 *
 * THIS FILE HELD THE OPPOSITE RULE UNTIL THEN, failing a bare `item` as the tools area's
 * reading of #303. The design says `tool` in every sentence about one — `Retire this
 * tool` above all — so what a string here may no longer say is the noun it used to
 * require.
 */
const TOOL_ITEM_NOUN = /\btool items?\b/i;

/**
 * The source text of `propName` in the object argument of every call to `fnName`.
 *
 * THE ARGUMENT AND NOT THE NAME, which is the whole point of this file's AST half.
 * A check asserting that `createToolLogEntry` is CALLED passes with the event
 * taken straight off the form, which is the defect. Returning the value's own
 * source distinguishes `event` from `formData.get("event")` from `"Checked out"`.
 */
function argumentSource({ ast, source }, fnName, propName) {
    let found = null;
    for (const call of callsTo(ast, fnName)) {
        for (const arg of call.arguments) {
            if (arg?.type !== "ObjectExpression") continue;
            const prop = arg.properties.find((p) => p.key?.name === propName);
            if (prop) found = source.slice(prop.value.start, prop.value.end);
        }
    }
    return found;
}

/** The function declared under `name` anywhere in a file — a default export included — or null. */
function functionNamed(ast, name) {
    let found = null;
    walk(ast, (n) => {
        if (!found && n.type === "FunctionDeclaration" && n.id?.name === name) found = n;
    });
    return found;
}

/** The source text a variable named `name` is initialized to inside `scope`, or null. */
function initSource(scope, source, name) {
    let found = null;
    walk(scope, (n) => {
        if (!found && n.type === "VariableDeclarator" && n.id?.name === name && n.init) found = source.slice(n.init.start, n.init.end);
    });
    return found;
}

/**
 * The source text of `attr` on every element named `tag` inside `scope` — `true` for an
 * attribute with no value — so `{transition}` and `{transition.event}` read apart.
 */
function attributeSources(scope, source, tag, attr) {
    const out = [];
    walk(scope, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== tag) return;
        const found = n.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === attr);
        if (found) out.push(found.value ? source.slice(found.value.start, found.value.end) : "true");
    });
    return out;
}

/** How many JSX attributes named `attr` a file carries anywhere, on any element. */
function attributeCount(ast, attr) {
    let count = 0;
    walk(ast, (n) => {
        if (n.type === "JSXAttribute" && n.name?.name === attr) count++;
    });
    return count;
}

/** The source of every argument the calls to `fnName` inside `scope` are handed, joined per call. */
function callArguments(scope, source, fnName) {
    return callsTo(scope, fnName).map((call) => call.arguments.map((a) => source.slice(a.start, a.end)).join(", "));
}

/** Where a named import comes from, or null if the module does not import it. */
function importedFrom({ ast }, name) {
    let from = null;
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue;
        if (node.specifiers.some((s) => s.local?.name === name)) from = node.source.value;
    }
    return from;
}

/**
 * Every `return { error: … }` that builds its object where it stands.
 *
 * THE SHAPE AND NOT THE NAME, which is this file's own rule applied one level
 * along. A refusal that goes through `refuse` is a call; one that slips past it is
 * an object literal in a return, and what tells them apart is what the returned
 * expression IS. An assertion that `refuse` is called somewhere passes with four
 * call sites standing beside a fifth branch that does it by hand — and that fifth
 * branch is a sentence on a page nothing re-rendered, which is #378 exactly.
 */
function inlineErrorReturns({ ast }) {
    const found = [];
    walk(ast, (n) => {
        if (n.type !== "ReturnStatement" || n.argument?.type !== "ObjectExpression") return;
        if (n.argument.properties.some((p) => p.key?.name === "error")) found.push(n);
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── 1: what a status and a person are offered ──────────────────────────
    log("the one transition a status allows, for a person with a job:");
    const inStock = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK });
    check("a stocked tool item offers a check-out", inStock.event, TOOL_EVENT.CHECKED_OUT);
    check("  with no refusal", inStock.refusal, null);
    check("  and only the actor's own job", inStock.jobs.map((j) => j.jobCode).join(","), "26-DEMO-01");

    const out = planTransition({ user: actor(JOB_A, JOB_B), jobs: ALL_JOBS, status: TOOL_STATUS.OUT });
    check("one that is out offers a check-in", out.event, TOOL_EVENT.CHECKED_IN);
    check("  and both of the actor's jobs", out.jobs.map((j) => j.jobCode).join(","), "26-DEMO-01,26-DEMO-02");
    // The job list is the whole table and the plan narrows it. A plan handing back
    // every job would be a picker offering sites the actor is not on, which no
    // assertion above would notice.
    check("  never a job that is not theirs", out.jobs.length, 2);
    const oneJob = planTransition({ user: actor(JOB_B), jobs: ALL_JOBS, status: TOOL_STATUS.OUT });
    check("  and one assignment yields one", oneJob.jobs.map((j) => j.jobCode).join(","), "26-DEMO-02");

    // ── 2: the two refusals, and which of them wins ────────────────────────
    log("");
    log("and the two refusals:");
    const retired = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.RETIRED });
    check("a retired tool item offers nothing", retired.event, null);
    check("  and says so, in the design's sentence (#463)", retired.refusal, TOOL_TRANSITION_COPY.noTransition);
    check("  with no jobs to choose from", retired.jobs.length, 0);

    const noJob = planTransition({ user: actor(), jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK });
    check("somebody on no job is refused", noJob.event, null);
    check("  in the screen's own words", noJob.refusal, TOOL_TRANSITION_COPY.noJob);
    assert("  which say what to do rather than what went wrong", noJob.refusal.includes("Ask for"));
    // A person with no jobs and a user object with none at all are the same state,
    // and the second is what a caller that forgot to select the field produces.
    check("  and a user with no field at all reads the same", planTransition({ user: {}, jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK }).refusal, TOOL_TRANSITION_COPY.noJob);

    // THE ORDER IS THE ASSERTION HERE. Telling somebody with no assignment to go
    // and get one, in front of a tool item that would refuse them anyway, is a
    // true sentence pointing at the wrong problem.
    const both = planTransition({ user: actor(), jobs: ALL_JOBS, status: TOOL_STATUS.RETIRED });
    check("a retired tool item answers before the reader is asked about", both.refusal, TOOL_TRANSITION_COPY.noTransition);
    assert("  rather than the no-job sentence", both.refusal !== TOOL_TRANSITION_COPY.noJob);

    // A status the vocabulary does not hold throws rather than silently offering
    // nothing, which is lib/toolStatus.js's guarantee reaching this caller.
    let threw = null;
    try {
        planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: "In Repair" });
    } catch (err) {
        threw = err.message;
    }
    assert("a status outside the vocabulary throws", Boolean(threw));

    // ── 3: the submission is compared, never taken ─────────────────────────
    log("");
    log("what a submission has to match:");
    const good = readSubmission(inStock, { ...CHECKING_OUT, jobId: JOB_A.id });
    check("the offered event and the actor's own job pass", good.refusal, null);
    check("  and what comes back is the PLAN's event", good.event, TOOL_EVENT.CHECKED_OUT);
    check("  with the job resolved from the plan's list", good.job.jobCode, "26-DEMO-01");

    const stale = readSubmission(inStock, { ...CHECKING_OUT, event: TOOL_EVENT.CHECKED_IN, jobId: JOB_A.id });
    check("a submission naming the other event is refused", stale.event, null);
    // THE SENTENCE CARRIES WHAT A FRESHLY RENDERED PAGE CANNOT SAY (#378), and the
    // three assertions are the three halves of that. A refused press and a
    // successful one both end on a flipped control and one more history entry, so
    // the first two are what tell them apart; the third is this issue's own point,
    // and without it the instruction could come back with nothing failing. The
    // status is deliberately NOT named — the header above it says so, freshly.
    assert("  saying that the press was not saved", /wasn't saved/i.test(stale.refusal));
    assert("  and that the change on screen is somebody else's", /somebody else/i.test(stale.refusal));
    // AND IT SAYS IT IS THE STALE ONE (#463), which is what the action reads the latest entry
    // for: the design names who recorded first and when (1g), which this function cannot know.
    check("  marked as the stale refusal", stale.stale, true);
    check("  naming the press it refused", stale.refusal, TOOL_TRANSITION_COPY.moved({ attempted: TOOL_EVENT.CHECKED_IN }));
    assert(
        "  and asking for no reload, because the action refreshes as it refuses",
        !/(reload|refresh|open it again|out of date)/i.test(stale.refusal)
    );
    assert("  and naming no status, which the page states directly above it", !stale.refusal.includes(TOOL_STATUS.IN_STOCK));
    // THE POINT OF THAT REFUSAL, stated as an assertion rather than only in prose:
    // without it the action would derive `Checked in` from the stored status and
    // record the opposite of what the button said.
    check("  never falling through to the derived event", stale.job, null);

    check("an event the vocabulary does not hold is refused", readSubmission(inStock, { ...CHECKING_OUT, event: "Job Changed", jobId: JOB_A.id }).event, null);
    check("an empty event is refused", readSubmission(inStock, { ...CHECKING_OUT, event: "", jobId: JOB_A.id }).event, null);

    const otherJob = readSubmission(inStock, { ...CHECKING_OUT, jobId: JOB_B.id });
    check("a job the actor is not on is refused", otherJob.refusal, TOOL_JOB_COPY.notYours);
    // A JOB NOT CHOSEN IS NOT A JOB REFUSED (#463): the foot bar's press can arrive with none,
    // and its answer is the design's word for a field left at its placeholder (1j).
    check("  while no job at all is one not chosen yet", readSubmission(inStock, { ...CHECKING_OUT, jobId: "" }).refusal, TOOL_JOB_COPY.noneChosen);
    check("  and neither is the stale refusal", readSubmission(inStock, { ...CHECKING_OUT, jobId: JOB_B.id }).stale, false);

    // ── 3b: a check-out cannot be recorded without a name (#376) ───────────
    log("");
    log("who the tool went to, which only a check-out carries:");
    const noName = readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "", jobId: JOB_A.id });
    check("a check-out with no name is refused", noName.refusal, TOOL_TRANSITION_COPY.nameRequired);
    check("  and writes nothing", `${noName.event}|${noName.checkedOutTo}`, "null|null");
    // WHITESPACE IS NOT A NAME. The value is normalized before it is judged, so the
    // field a person tabbed through and the field they put two spaces in reach the
    // same sentence — without this the second would write a blank-looking row that
    // every screen renders as an empty pair.
    check(
        "  as is a name of nothing but whitespace",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "   ", jobId: JOB_A.id }).refusal,
        TOOL_TRANSITION_COPY.nameRequired
    );
    // THE STORED VALUE IS NORMALIZED AND ITS CASE IS KEPT, which is #18's split
    // exactly: whitespace is fixed in what is written because a formula cannot
    // collapse an internal run, and case is folded only where two names are
    // compared. The name on a purchase order is not ours to retype and neither is
    // a person's.
    check(
        "  a name is trimmed and its inner runs collapsed",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "  Mike   R  ", jobId: JOB_A.id }).checkedOutTo,
        "Mike R"
    );
    check(
        "  and its case is left alone",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "mIKE r", jobId: JOB_A.id }).checkedOutTo,
        "mIKE r"
    );

    // A CHECK-IN CARRIES NOBODY, AND A NAME SUBMITTED WITH ONE IS DROPPED RATHER
    // THAN REFUSED — the treatment the submitted EVENT already gets, and the only
    // one that cannot be turned into a way of writing a recipient onto a row that
    // must not have one. A refusal would have been the other option and is worse:
    // it would answer a forged field with a sentence about it.
    const checkingIn = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.OUT });
    const forgedName = readSubmission(checkingIn, {
        event: TOOL_EVENT.CHECKED_IN,
        jobId: JOB_A.id,
        checkedOutTo: "Dana K",
    });
    check("a check-in passes with a name attached", forgedName.refusal, null);
    check("  and the name does not survive it", forgedName.checkedOutTo, null);
    check(
        "  while a check-in with none is unaffected",
        readSubmission(checkingIn, { event: TOOL_EVENT.CHECKED_IN, jobId: JOB_A.id }).refusal,
        null
    );

    // THE ORDER OF THE REFUSALS, WHICH IS `planTransition`'s: what the app knows
    // before what the person typed. A submission that is BOTH stale and nameless
    // hears about the page, not about the name — otherwise somebody fixes the name
    // and presses again into the same refusal.
    check(
        "a stale page is answered before a missing name",
        readSubmission(inStock, { event: TOOL_EVENT.CHECKED_IN, jobId: JOB_A.id, checkedOutTo: "" }).refusal,
        TOOL_TRANSITION_COPY.moved({ attempted: TOOL_EVENT.CHECKED_IN })
    );
    check(
        "  and so is a job that is not the actor's",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "", jobId: JOB_B.id }).refusal,
        TOOL_JOB_COPY.notYours
    );

    // ── 3b': both fields at once, for the foot bar (#463) ─────────────────
    // A PHONE'S PRESS IS ANSWERED UNDER THE FIELD IT IS ABOUT, both when both are missing (1g),
    // and the reader is the one `readSubmission` reads — so the two cannot disagree.
    log("");
    log("what is wrong with each field, both at once:");
    const onTwo = planTransition({ user: actor(JOB_A, JOB_B), jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK });
    const bothMissing = fieldRefusals(onTwo, { jobId: "", checkedOutTo: "  " });
    check(
        "nothing chosen and no name are both answered",
        `${bothMissing.jobRefusal} | ${bothMissing.nameRefusal}`,
        `${TOOL_JOB_COPY.noneChosen} | ${TOOL_TRANSITION_COPY.nameRequired}`
    );
    check("  a job that is not the reader's says so", fieldRefusals(onTwo, { jobId: "recJobZ", checkedOutTo: "Dana K" }).jobRefusal, TOOL_JOB_COPY.notYours);
    const bothGiven = fieldRefusals(onTwo, { jobId: JOB_B.id, checkedOutTo: "  Dana   K " });
    check(
        "  and both given refuse nothing, the job resolved and the name normalized",
        `${bothGiven.jobRefusal} | ${bothGiven.nameRefusal} | ${bothGiven.job?.jobCode} | ${bothGiven.name}`,
        "null | null | 26-DEMO-02 | Dana K"
    );
    check("  a check-in asks no name", fieldRefusals(out, { jobId: JOB_A.id, checkedOutTo: "" }).nameRefusal, null);
    check("  and readSubmission reads the same two", callsTo(resolveFunction(parseFile("lib/toolTransition.js").ast, "readSubmission"), "fieldRefusals").length, 1);

    // ── 3c: the names a job offers, folded and narrowed (#376) ─────────────
    log("");
    log("the names this job has recently handed tools to:");
    const ROWS = [
        checkOut("Dana K", JOB_A.jobCode, "2026-09-14T10:00:00.000Z"),
        checkOut("Mike R", JOB_A.jobCode, "2026-09-12T10:00:00.000Z"),
        checkOut("mike  r", JOB_A.jobCode, "2026-09-13T10:00:00.000Z"),
        checkOut("Pat T", JOB_A.jobCode, "2026-09-11T10:00:00.000Z"),
        checkOut("Sam B", JOB_B.jobCode, "2026-09-15T10:00:00.000Z"),
        { event: TOOL_EVENT.CHECKED_IN, jobCode: JOB_A.jobCode, eventAt: "2026-09-16T10:00:00.000Z" },
        { event: TOOL_EVENT.RETIRED, jobCode: JOB_A.jobCode, eventAt: "2026-09-17T10:00:00.000Z", checkedOutTo: "Ghost G" },
    ];
    const names = recentNamesFor(ROWS, { jobCode: JOB_A.jobCode });
    check("most recent first", names.join(" | "), "Dana K | mike r | Pat T");
    // ONE ENTRY PER PERSON, ON THE KEY THE WHOLE APP TYPES AGAINST. `Mike R` and
    // `mike  r` are one person; without the fold the sheet offers both and the list
    // argues with itself. The SPELLING is the most recent one, which is why the
    // answer above is `mike r` and not `Mike R`.
    assert("  one entry per person however it was typed", names.length === 3);
    check("  and the spelling is the most recent", names[1], "mike r");
    check("  with its inner run collapsed", names.filter((n) => n.includes("  ")).length, 0);
    // ONLY THIS JOB, AND ONLY `Checked out` ROWS. The other job's name is in the
    // same list the page loaded, because a picker can move between them; a row of
    // another event with a name is a defect upstream and is ignored rather than
    // shown.
    assert("  nobody from the other job", !names.includes("Sam B"));
    assert("  and nothing off a row that is not a check-out", !names.includes("Ghost G"));
    check(
        "the other job answers with its own",
        recentNamesFor(ROWS, { jobCode: JOB_B.jobCode }).join(" | "),
        "Sam B"
    );
    check("no job chosen yet offers nobody", recentNamesFor(ROWS, { jobCode: undefined }).length, 0);
    check("and a job nothing has gone out on is empty", recentNamesFor(ROWS, { jobCode: "26-DEMO-09" }).length, 0);

    log("");
    log("and what typing narrows them to:");
    check("nothing typed is the whole list", narrowNames(names, "").join(" | "), "Dana K | mike r | Pat T");
    check("  as is whitespace", narrowNames(names, "  ").length, 3);
    check("a fragment matches inside a name", narrowNames(names, "r").join(" | "), "mike r");
    check("  ignoring case", narrowNames(names, "MIKE").join(" | "), "mike r");
    check("  and spacing", narrowNames(names, "mike  r").join(" | "), "mike r");
    check("a fragment nobody carries matches nobody", narrowNames(names, "zz").length, 0);
    // THE SHOWN COUNT IS A DISPLAY CHOICE OVER THE WHOLE LIST, which is what lets
    // the brief hand the number to Design: a name below the cut is one keystroke
    // away rather than absent, so the cut costs nothing that typing does not undo.
    // Three, which is what 1f's name sheet lists (#458).
    check("a few are offered before anybody types", RECENT_NAMES_SHOWN, 3);
    // AND WHAT IS OFFERED IS ONE FUNCTION FOR BOTH WIDTHS (#458): the dialog's
    // suggestions and the name sheet's rows are `offeredNames` of one list.
    const six = ["Ana P", "Ben Q", "Cal R", "Dee S", "Eli T", "Fae U"];
    check("nothing typed offers the first few", offeredNames(six, "").join(" | "), "Ana P | Ben Q | Cal R");
    check("  as does a field of spaces", offeredNames(six, "   ").join(" | "), "Ana P | Ben Q | Cal R");
    // Four names carry an `e`, one more than the cut, so a cut applied to what typing
    // narrowed would show here.
    check("something typed offers every name it matches, past the cut", offeredNames(six, "e").join(" | "), "Ben Q | Dee S | Eli T | Fae U");
    check("  and nothing typed into no list offers nothing", offeredNames(undefined, "").length, 0);

    // A refused plan is not re-litigated by a well-formed submission — which is
    // what a forged POST against a retired tool item looks like.
    const forged = readSubmission(retired, { ...CHECKING_OUT, jobId: JOB_A.id });
    check("a refused plan refuses whatever is submitted", forged.event, null);
    check("  in the plan's own words", forged.refusal, retired.refusal);

    // AND THE `never taken` HALF IS UNREACHABLE BEHAVIORALLY, WHICH IS WHY IT IS
    // READ OFF THE SOURCE. The function returns only when the two events are equal,
    // so handing back the submitted one instead of the plan's is invisible to every
    // assertion above — measured by mutation, which passed 81 of 81. It stops being
    // invisible the moment somebody loosens the comparison, and by then the value
    // flowing through is the form's. So the return is parsed.
    const module_ = parseFile("lib/toolTransition.js");
    const readFn = resolveFunction(module_.ast, "readSubmission");
    assert("readSubmission was found", readFn !== null);
    const returns = [];
    walk(readFn, (n) => {
        if (n.type !== "ReturnStatement" || n.argument?.type !== "ObjectExpression") return;
        returns.push(
            Object.fromEntries(
                n.argument.properties.map((p) => [
                    p.key?.name,
                    module_.source.slice(p.value.start, p.value.end),
                ])
            )
        );
    });
    const success = returns.filter((r) => r.refusal === "null");
    check("it has one return that is not a refusal", success.length, 1);
    check("  and that one hands back the PLAN's event", success[0]?.event, "plan.event");
    assert(`  never the submitted one (${returns.length} returns read)`, returns.length >= 3);

    // ── 4: the sentence for a transition that moves the tool item ──────────
    log("");
    log("the one place two `Job` values meet on this screen:");
    const moved = jobMoveNotice({ from: "26-DEMO-02", to: "26-DEMO-01" });
    assert("a different job says so", Boolean(moved));
    assert("  naming where it was", moved.includes("26-DEMO-02"));
    assert("  and where it is going", moved.includes("26-DEMO-01"));
    check("the same job says nothing", jobMoveNotice({ from: "26-DEMO-01", to: "26-DEMO-01" }), null);
    check("an unchosen picker says nothing", jobMoveNotice({ from: "26-DEMO-01", to: undefined }), null);
    check("and a tool item whose job did not resolve says nothing", jobMoveNotice({ from: undefined, to: "26-DEMO-01" }), null);

    // ── 5: the words ───────────────────────────────────────────────────────
    log("");
    log("every word this screen adds:");
    const strings = copyStrings();
    assert(`the constant holds ${strings.length} strings`, strings.length >= 8);
    check("none is empty", strings.filter((s) => !s.trim()).length, 0);
    // THE SWEEP'S CLAIM (#455): nothing here says the noun the design replaced.
    const oldNoun = strings.filter((s) => TOOL_ITEM_NOUN.test(s));
    check(
        `no string says \`tool item\`${oldNoun.length ? ` (${JSON.stringify(oldNoun[0])})` : ""}`,
        oldNoun.length,
        0
    );
    // The two sentences the sweep carried the noun into, by value.
    check("the terminal sentence, the design's (1f)", TOOL_TRANSITION_COPY.noTransition, "Nothing more can be recorded here.");
    // THE STALE PRESS IN 1g's WORDS (#463), the person in full and the moment in the app's
    // notation where the design says `a moment ago`, the noun hyphenated and the verb not.
    check(
        "  the press somebody else's scan got in front of",
        TOOL_TRANSITION_COPY.moved({ by: "Jisoo Park", event: TOOL_EVENT.CHECKED_OUT, when: "09/25/2026 2:14 PM", attempted: TOOL_EVENT.CHECKED_OUT }),
        "Jisoo Park checked this out on 09/25/2026 2:14 PM. Your check-out wasn't saved."
    );
    check(
        "  naming nobody when nobody resolved",
        TOOL_TRANSITION_COPY.moved({ by: null, event: TOOL_EVENT.CHECKED_IN, when: "09/25/2026 2:14 PM", attempted: TOOL_EVENT.CHECKED_OUT }),
        "Somebody else checked this in on 09/25/2026 2:14 PM. Your check-out wasn't saved."
    );
    check(
        "  and no entry at all when none was read",
        TOOL_TRANSITION_COPY.moved({ attempted: TOOL_EVENT.CHECKED_IN }),
        "Somebody else scanned this first. Your check-in wasn't saved."
    );
    check(
        "  and the one for a move",
        TOOL_TRANSITION_COPY.movesJob({ from: "26-DEMO-02", to: "26-DEMO-01" }),
        "This tool was last scanned on 26-DEMO-02. Recording this on 26-DEMO-01 moves it there."
    );
    // `kind` is the notes' explanatory word for what separates `Tools` from
    // `Tool Items` and names no row (#338); `transition` is this issue's, for the
    // act. Neither may reach a screen.
    check("no string says `kind`", strings.filter((s) => /\bkinds?\b/i.test(s)).length, 0);
    check("no string says `transition`", strings.filter((s) => /\btransitions?\b/i.test(s)).length, 0);

    // THE CONTROL IS BUILT FROM THE VOCABULARY, so an event a status can offer
    // cannot arrive without a word for it. That is `summarizeTools`' argument for
    // drawing all three counts, and it is the assertion a fifth event would fail.
    const offerable = [...new Set(Object.values(EVENT_OFFERED_BY_STATUS).filter(Boolean))];
    const wordless = offerable.filter((e) => !TOOL_TRANSITION_COPY.control[e]);
    check(`every offerable event has a control word${wordless.length ? ` (${wordless})` : ""}`, wordless.length, 0);
    const spare = Object.keys(TOOL_TRANSITION_COPY.control).filter((e) => !offerable.includes(e));
    check(`and no control word for an event no status offers${spare.length ? ` (${spare})` : ""}`, spare.length, 0);
    check("the imperative and not the participle", TOOL_TRANSITION_COPY.control[TOOL_EVENT.CHECKED_OUT], "Check out");
    check("  in both directions", TOOL_TRANSITION_COPY.control[TOOL_EVENT.CHECKED_IN], "Check in");
    assert(
        "  which is not the string the log stores",
        TOOL_TRANSITION_COPY.control[TOOL_EVENT.CHECKED_OUT] !== TOOL_EVENT.CHECKED_OUT
    );
    // WHAT THE DIALOG'S COMMITMENT SAYS WHILE ITS EVENT IS ON ITS WAY (#469), keyed by the
    // event as the control is, so a fifth event cannot arrive without one either: 0f's
    // Working, the control's own verb in its `-ing` form with an ellipsis, the particle kept.
    check("every offerable event has a working word", offerable.filter((e) => !TOOL_TRANSITION_COPY.working[e]).join(", "), "");
    check(
        "  and no working word for an event no status offers",
        Object.keys(TOOL_TRANSITION_COPY.working).filter((e) => !offerable.includes(e)).join(", "),
        ""
    );
    check("a check-out on its way", TOOL_TRANSITION_COPY.working[TOOL_EVENT.CHECKED_OUT], "Checking out…");
    check("  and a check-in", TOOL_TRANSITION_COPY.working[TOOL_EVENT.CHECKED_IN], "Checking in…");
    // WHAT THE LATEST ENTRY DID AND WHAT THE PRESS WAS (#463), keyed by the event as the
    // control is, so a fifth event cannot arrive without them.
    check(
        "every offerable event has an act and a noun",
        offerable.filter((e) => !TOOL_TRANSITION_COPY.movedAct[e] || !TOOL_TRANSITION_COPY.eventNoun[e]).join(", "),
        ""
    );
    check("  the noun hyphenated, as the design writes it since 2026-10-05", Object.values(TOOL_TRANSITION_COPY.eventNoun).join(" | "), "check-out | check-in");
    check("  and the act a verb with none", Object.values(TOOL_TRANSITION_COPY.movedAct).join(" | "), "checked this out | checked this in");

    // IMPORTED RATHER THAN RE-SPELLED. Three words are the same control and the
    // same rule on two screens, so a second copy is a second word for one fact the
    // first time somebody rewords one. Asserted as equality with the source rather
    // than by value, because what is being held is that they cannot drift apart.
    check("the `Job` label is the tool item page's own", TOOL_TRANSITION_COPY.jobLabel, TOOL_ITEM_COPY.jobLabel);
    // The two picker words moved to lib/toolJob.js in #363 with the rule they
    // belong to; `offline/tool-job.mjs` holds both screens reading them, so what
    // stays here is only that this screen does.
    check("the unchosen option is the shared one", TOOL_TRANSITION_COPY.jobUnchosen, TOOL_JOB_COPY.unchosen);
    check("and so is the not-your-job refusal", TOOL_TRANSITION_COPY.jobNotYours, TOOL_JOB_COPY.notYours);
    // `noJob` is deliberately NOT shared: the sentence names the act, and
    // registering a tool item and recording an event against one are two acts.
    assert("but the no-job sentence is this screen's own", TOOL_TRANSITION_COPY.noJob.includes("record this on"));

    // The failure sentence has to carry all three facts a person can act on.
    const half = TOOL_TRANSITION_COPY.statusNotUpdated({
        toolItemId: "HYE-TL-260909-004",
        event: TOOL_EVENT.CHECKED_OUT,
        status: TOOL_STATUS.IN_STOCK,
    });
    assert("a failed status write names the tool item", half.includes("HYE-TL-260909-004"));
    assert("  says the event is on the record", half.includes(TOOL_EVENT.CHECKED_OUT) && half.includes("recorded"));
    assert("  says what everybody else will read", half.includes(TOOL_STATUS.IN_STOCK));
    assert("  and says pressing again fixes it", half.includes("Do it again"));

    // ── 6: the actions, read off their own call sites ──────────────────────
    log("");
    log("the scan action derives what it writes, and never takes the form's word:");
    const action = parseFile(ACTION);
    const fn = resolveFunction(action.ast, "recordToolItemEventAction");
    assert("the action was found", fn !== null);
    const MUST_CALL = [
        "requireUser",
        "getToolItemByToolItemId",
        "planTransition",
        "readSubmission",
        "readRetirement",
        "writeEvent",
        "createToolLogEntry",
        "statusAfterEvent",
        "updateToolItemCache",
    ];
    const uncalled = MUST_CALL.filter((name) => callsTo(action.ast, name).length === 0);
    check(
        `it calls all ${MUST_CALL.length} of the functions this rule needs${uncalled.length ? ` (${uncalled})` : ""}`,
        uncalled.length,
        0
    );

    // THE PLAN IS BUILT FROM THE STORED STATUS. Passing a submitted one would make
    // the offer a fact about the form, and every refusal below it vacuous — and it
    // would pass any assertion that only asks whether `planTransition` is called.
    check("the plan reads the stored status", argumentSource(action, "planTransition", "status"), "toolItem.status");
    // AND THE SUBMISSION IS WHERE THE FORM'S WORD GOES, which is the other half of
    // the same claim: the form is read, into the comparison, and nowhere else.
    const submitted = argumentSource(action, "readSubmission", "event");
    assert(`the submitted event reaches the comparison (${submitted})`, /formData/.test(String(submitted)));

    // ── 6b: the two writes, in the one function both actions share ─────────
    // THEY MOVED OUT OF THIS ACTION IN #363, which extracted `writeEvent` rather
    // than letting the retirement copy thirty lines of ordering, try boundary and
    // failure report. So the assertions follow them: the ordering and the try are
    // facts about that function now, and what each ACTION owes is the argument it
    // arrives with.
    log("");
    log("the two writes, and the one function both actions share:");
    const writeFn = resolveFunction(action.ast, "writeEvent");
    assert("the shared writer was found", writeFn !== null);
    assert("  and it is not exported, so it is no Server Action", !/export\s+async\s+function\s+writeEvent/.test(action.source));

    // THE LOG ROW'S EVENT IS THE ONE IT WAS HANDED. This is the assertion the
    // whole AST half exists for: `event`, `formData.get("event")` and
    // `"Checked out"` are all arguments to this call, and only the argument's
    // source tells them apart.
    const written = argumentSource(action, "createToolLogEntry", "event");
    check("the log row records the event it was handed", written, "event");
    assert("  not the form's", !/formData/.test(String(written)));
    assert("  and not a literal", !/^["']/.test(String(written)));

    // THE STATUS IS THE MAP'S ANSWER AND NEVER A LITERAL, the rule lib/airtable/
    // toolItems.js states from the other side.
    const cached = argumentSource(action, "updateToolItemCache", "status");
    check("the cache takes the map's answer", cached, "statusAfterEvent(event)");
    assert("  rather than a spelled status", !/^["']/.test(String(cached)));

    // AND THE WRITER REFUSES A BLANK, WHICH IS WHERE THE NEVER-BLANK INVARIANT IS
    // ACTUALLY HELD (#363). `createToolLogEntry` wrote `Job: []` for a missing
    // value, which nothing could reach while every caller resolved a job out of
    // the actor's own assignments; a retirement inherits `Tool Items."Job"`, a
    // field the schema lets be empty, so the hole became reachable. It throws
    // now, the way `createToolItems` does. Read off that module's source, since
    // it imports `lib/airtable/client.js` and this tier cannot load it.
    const writer = parseFile("lib/airtable/toolLog.js");
    // THE THIRD IS THE EVENT, AND A RENAME IS WHY (#455). A key renamed in `TOOL_EVENT` with
    // one call site left behind reads `undefined`, which drops out of the request body —
    // so the no-typecast refusal never fires and the row lands with no `Event`. The
    // writer refuses anything outside the vocabulary, that included.
    for (const [what, guard] of [
        ["a missing job", 'if (!jobRecordId) throw new Error("toolLog: a Job is required");'],
        ["a missing recorder", 'if (!recordedByUserId) throw new Error("toolLog: a Recorded By is required");'],
        ["an event outside the vocabulary, a missing one included", "if (!TOOL_EVENT_VALUES.includes(event)) {"],
    ])
        assert(`the writer throws on ${what}`, writer.source.includes(guard));
    // AND THE VOCABULARY IT ASKS IS THE MODULE'S, not a list spelled beside the guard,
    // which would be the second copy a rename leaves behind.
    assert(
        "  reading the event list from lib/toolStatus.js",
        /import \{[^}]*\bTOOL_EVENT_VALUES\b[^}]*\} from "\.\.\/toolStatus"/.test(writer.source)
    );
    check(
        "  and writes both links unconditionally",
        [/Job: \[jobRecordId\]/, /"Recorded By": \[recordedByUserId\]/].filter((re) => !re.test(writer.source)).length,
        0
    );
    check(
        "  with no conditional left to write an empty one",
        (writer.source.match(/\?\s*\[\w+\]\s*:\s*\[\]/g) || []).length,
        0
    );

    // THE LOG GOES FIRST. A cache written with no row behind it loses the event
    // with nowhere else holding it; a row with a stale cache is recoverable and is
    // reported. Source order, which is this tier's limit and is stated as such.
    assert("the log row is written before the cache", callsBefore(writeFn, "createToolLogEntry", "updateToolItemCache"));
    // AND ONLY THE CACHE WRITE IS INSIDE THE TRY. A log write inside it would be
    // swallowed by the same catch and reported as a status that did not move,
    // which is the opposite of what happened.
    const [logCall] = callsTo(writeFn, "createToolLogEntry");
    const [cacheCall] = callsTo(writeFn, "updateToolItemCache");
    assert("the cache write is inside the try", insideTry(writeFn, cacheCall));
    assert("  and the log write is not", !insideTry(writeFn, logCall));

    // ── 6c: each action's own arguments, and what stands after the write ───
    log("");
    log("what each action hands the writer, and what it does with the answer:");
    for (const [name, expectedEvent, reader] of [
        ["recordToolItemEventAction", "event", "readSubmission"],
        ["retireToolItemAction", "TOOL_EVENT.RETIRED", "readRetirement"],
    ]) {
        const own = resolveFunction(action.ast, name);
        assert(`${name} was found`, own !== null);
        assert(`  it reads its submission with ${reader}`, callsTo(own, reader).length === 1);
        // THE EVENT EACH ONE WRITES, READ OFF ITS OWN CALL. The scan action hands
        // over the identifier the plan produced; the retirement hands over the
        // vocabulary's constant, because there is one direction and nothing to
        // derive. A literal `"Retired"` here would mint an option off the palette
        // the first time somebody mistyped it — which is what `createToolLogEntry`
        // has a no-literal rule for.
        const handed = argumentSource({ ast: own, source: action.source }, "writeEvent", "event");
        check(`  and hands the writer ${expectedEvent}`, handed, expectedEvent);
        assert("  never a string literal", !/^["']/.test(String(handed)));

        // AND THE ANSWER IS BOUND AND RETURNED BEFORE THE REDIRECT, so a failed
        // cache write reports instead of landing on a page that says it worked.
        // The try lives in `writeEvent` now, so the position assertion #362 wrote
        // against it becomes this one: a bound call, a return between the two, and
        // the redirect last.
        let bound = false;
        walk(own, (n) => {
            if (n.type !== "VariableDeclarator" || !n.init) return;
            if (/writeEvent\(/.test(action.source.slice(n.init.start, n.init.end))) bound = true;
        });
        assert("  the writer's answer is bound rather than discarded", bound);
        const [w] = callsTo(own, "writeEvent");
        const [redirectCall] = callsTo(own, "redirect");
        assert("  the redirect was found", Boolean(w && redirectCall));
        assert("  and stands after the write", w.start < redirectCall.start);
        let returnsBetween = 0;
        walk(own, (n) => {
            if (n.type === "ReturnStatement" && n.start > w.end && n.start < redirectCall.start) returnsBetween++;
        });
        assert("  with a return between them, so a failure never reaches it", returnsBetween > 0);
    }

    // NOTHING BUT THE TOOL ITEM'S ID CROSSES THE WIRE FOR A RETIREMENT. One
    // direction means nothing a stale page could have named wrongly; and the job
    // is the tool item's own, so a form field for either would be a value the
    // action then had to decide whether to trust.
    const retireFn = resolveFunction(action.ast, "retireToolItemAction");
    const retireSource = action.source.slice(retireFn.start, retireFn.end);
    const read = [...retireSource.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]);
    check(`the retirement reads only the tool item id off the form (${read.join()})`, read.join(), "toolItemId");
    // AND ITS JOB IS THE TOOL ITEM'S, READ OFF THE CALL SITE. This is the
    // argument-and-not-the-name assertion for #363's reversal: `plan.jobs[0].id`
    // and a form value are both "an argument to readRetirement", and only the
    // argument's own source tells them from the cached link.
    check(
        "the retirement's job is the tool item's own",
        argumentSource({ ast: retireFn, source: action.source }, "readRetirement", "currentJobRecordId"),
        "toolItem.job?.[0]"
    );

    // ── 6d: a refusal refreshes as it refuses (#378) ───────────────────────
    //
    // WHAT THIS CATCHES THAT NOTHING ELSE CAN. A Server Action that only returns
    // re-renders nothing, so a refusal written straight into a branch is a true
    // sentence standing on a page that contradicts it — the status, the control's
    // direction and the history all still reading what they did before the press.
    // Nothing fails: not a type check, not a render, and not one assertion above.
    // So the shape is held here, and held as a SHAPE: what is asserted is that no
    // return outside the helper builds `{ error }` itself, which is the one move a
    // new refusal could make to slip past it.
    log("");
    log("every refusal goes through one place, and that place re-renders the page:");
    check("`refresh` comes from next/cache", importedFrom(action, "refresh"), "next/cache");
    const refuseFn = resolveFunction(action.ast, "refuse");
    assert("the refusal helper was found", refuseFn !== null);
    assert(
        "  and is not exported, so it is no Server Action",
        !/export\s+(async\s+)?function\s+refuse/.test(action.source)
    );
    check("  it refreshes", callsTo(refuseFn, "refresh").length, 1);

    const inside = (node) => node.start > refuseFn.start && node.end < refuseFn.end;
    const inline = inlineErrorReturns(action).filter((n) => !inside(n));
    check(
        `nothing outside it builds \`{ error }\` on the spot${inline.length ? ` (${inline.length})` : ""}`,
        inline.length,
        0
    );
    for (const name of ["recordToolItemEventAction", "retireToolItemAction", "writeEvent"])
        assert(`  ${name} refuses through it`, callsTo(resolveFunction(action.ast, name), "refuse").length > 0);

    // AND THE SUCCESS PATH IS UNTOUCHED, WHICH IS THE SAME CLAIM FROM THE OTHER
    // SIDE. A redirect is a navigation and discards the client state it leaves, so
    // it is right where there is nothing to keep; after a refusal there is exactly
    // one thing to keep, and it is the sentence. An action refreshing on its way to
    // a redirect would be re-rendering a page it is about to leave. `calleeName`
    // reads a method call too, so a `router.refresh()` anywhere here is counted.
    const refreshCalls = callsTo(action.ast, "refresh");
    check("the module refreshes in exactly one place", refreshCalls.length, 1);
    // The count is re-asserted rather than assumed: with the call removed
    // altogether there is no node to ask about, and a check that throws there
    // reports as a broken file rather than as a failing claim.
    assert(
        "  and that place is the helper, never a path that redirects",
        refreshCalls.length === 1 && inside(refreshCalls[0])
    );

    // ANTI-VACUITY: the three detectors, each shown finding what it is asserted not
    // to find. An absence and a walk that sees nothing are the same result.
    const planted = parseSource(
        'import { refresh } from "next/dist/server/web/spec-extension/revalidate";\n' +
            "export async function act() {\n" +
            "  if (stale) return { error: COPY.moved };\n" +
            "  refresh();\n" +
            "  redirect(path);\n" +
            "}\n",
        "<refusal-built-by-hand>"
    );
    check(
        "  the import detector reads the source it was given",
        importedFrom(planted, "refresh"),
        "next/dist/server/web/spec-extension/revalidate"
    );
    check("  the return detector sees a hand-built refusal", inlineErrorReturns(planted).length, 1);
    const onSuccess = parseSource(
        "function refuse(error) { refresh(); return { error }; }\n" +
            "export async function act() { refresh(); redirect(path); }\n",
        "<refresh-on-the-success-path>"
    );
    const plantedRefuse = resolveFunction(onSuccess.ast, "refuse");
    const plantedCalls = callsTo(onSuccess.ast, "refresh");
    check("  a refresh on the success path is counted", plantedCalls.length, 2);
    assert(
        "  and is seen to stand outside the helper",
        plantedCalls.some((c) => !(c.start > plantedRefuse.start && c.end < plantedRefuse.end))
    );

    // ── 6e: the name reaches the row from the reader, not the form (#376) ──
    //
    // THE SAME TRAP THIS FILE'S AST HALF EXISTS FOR, one argument along.
    // `checkedOutTo`, `formData.get("checkedOutTo")` and a literal are all "an
    // argument to createToolLogEntry", and only the argument's own source tells
    // them apart. The reader is what normalizes the value and what drops it on a
    // check-in, so a form value reaching the writer directly would write an
    // untrimmed name and would put one on a row that must not carry one.
    log("");
    log("who the tool went to reaches the row through the reader:");
    const submittedName = argumentSource(action, "readSubmission", "checkedOutTo");
    assert(`the form's name reaches the reader (${submittedName})`, /formData/.test(String(submittedName)));
    const handedName = argumentSource(action, "writeEvent", "checkedOutTo");
    check("  and the reader's answer reaches the writer", handedName, "checkedOutTo");
    assert("  never the form's", !/formData/.test(String(handedName)));
    const writtenName = argumentSource(action, "createToolLogEntry", "checkedOutTo");
    check("  which is what the log row records", writtenName, "checkedOutTo");
    // THE RETIREMENT HANDS OVER NOTHING, which is the same claim from the other
    // side: one direction, no recipient, and no field for a forged submission to
    // fill. Asserted as an absence on ITS OWN call rather than on the module, since
    // the scan action's call is in the same file.
    const retireOwn = resolveFunction(action.ast, "retireToolItemAction");
    check(
        "  and a retirement hands the writer no name at all",
        argumentSource({ ast: retireOwn, source: action.source }, "writeEvent", "checkedOutTo"),
        null
    );

    // BOTH DIRECTIONS ARE HELD AT THE WRITER, which is where a never-blank
    // invariant is actually kept — `Job` is the precedent two guards up, and #363
    // is what taught it: that one was unreachable until a caller stopped resolving
    // the value itself.
    for (const [what, guard] of [
        ["a check-out with no name", 'if (isCheckOut && !checkedOutTo) {'],
        ["a name on any other event", 'if (!isCheckOut && checkedOutTo) {'],
    ])
        assert(`the writer refuses ${what}`, writer.source.includes(guard));
    // AND IT OMITS THE FIELD RATHER THAN WRITING IT EMPTY, so a blank cell means
    // the row was never given a name — the distinction the mapper preserves and
    // the one a `Checked Out To: ""` would destroy.
    assert(
        "  and omits the field on an event that carries none",
        /\.\.\.\(isCheckOut \? \{ "Checked Out To": checkedOutTo \} : \{\}\)/.test(writer.source)
    );

    // THE READER'S OWN SHAPE. The filter has to name the event and the jobs, the
    // ordering is the rule `recentNamesFor` re-applies, and the cap is what makes
    // it one operation — asserted here because none of the three is visible to a
    // behavioral test without credentials.
    const reader = resolveFunction(writer.ast, "getRecentCheckOuts");
    assert("the recent-names reader was found", reader !== null);
    const readerSource = writer.source.slice(reader.start, reader.end);
    assert("  it narrows to the jobs it was given", /orByField\("Job", codes\)/.test(readerSource));
    assert("  and to check-outs alone", /\{Event\} = "\$\{formulaString\(TOOL_EVENT\.CHECKED_OUT\)\}"/.test(readerSource));
    assert("  skipping rows that carry no name", /\{Checked Out To\} != ""/.test(readerSource));
    assert("  newest first", /direction: "desc"/.test(readerSource));
    assert("  and capped, which is what keeps it one operation", /maxRecords: RECENT_CHECK_OUT_ROWS/.test(readerSource));

    // ── 6f: a stale press names who recorded first, read as it refuses (#463) ─
    // THE DESIGN'S SENTENCE NAMES THE PERSON AND THE MOMENT (1g), which only the latest entry
    // knows, so the action reads it for the stale refusal and for nothing else — two
    // operations on a path a person meets rarely, and none on any other.
    log("");
    log("a stale press is answered with who recorded first, read off the latest entry:");
    const scanFn = resolveFunction(action.ast, "recordToolItemEventAction");
    const scanSource = action.source.slice(scanFn.start, scanFn.end);
    const staleAt = scanSource.indexOf('if (stale) return refuseStale({ toolItem, refusal, attempted: String(formData.get("event") ?? "") });');
    assert("the scan action answers a stale press through refuseStale, naming the press", staleAt > -1);
    assert("  before any other refusal is said", staleAt > -1 && staleAt < scanSource.indexOf("if (refusal) return refuse(refusal);"));
    const staleFn = resolveFunction(action.ast, "refuseStale");
    assert("refuseStale was found", staleFn !== null);
    assert("  and is not exported, so it is no Server Action", !/export\s+(async\s+)?function\s+refuseStale/.test(action.source));
    const staleSource = staleFn ? action.source.slice(staleFn.start, staleFn.end) : "";
    assert(
        "  it reads the latest row, the link array's last, as one id",
        staleSource.includes("const latestId = toolItem.toolLog?.at(-1);") &&
            staleSource.includes("getToolLogByToolItem(toolItem.id, { rowIds: [latestId] })")
    );
    assert("  names who recorded it in full", staleSource.includes("by: actorName(recorder) || null"));
    assert("  hands over the row's own event and moment", staleSource.includes("event: latest.event, at: latest.eventAt ?? null, attempted"));
    check("  and says every answer through refuse", callsTo(staleFn ?? {}, "refuse").length, 3);
    check("  where retireToolItemAction asks no such read", callsTo(resolveFunction(action.ast, "retireToolItemAction"), "refuseStale").length, 0);

    // ── 7: the page offers and refuses in one place ────────────────────────
    log("");
    log("the page renders the refusal where the controls would be:");
    const page = parseFile(PAGE);
    const pageCalls = new Set();
    walk(page.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "Identifier") pageCalls.add(n.callee.name);
    });
    assert("the page asks the same function the action asks", pageCalls.has("planTransition"));
    check(
        "the plan reads the tool item's stored status here too",
        argumentSource(page, "planTransition", "status"),
        "toolItem.status"
    );
    // BOTH CONTROLS STAND IN THE BRANCH WHERE THERE IS NO REFUSAL, and neither is
    // rendered unconditionally — a page that drew either one for a retired tool
    // item or for somebody with no job would be promising what the action
    // refuses. #363 put a second control in the same branch, so the assertion
    // names both rather than the one that happened to be there.
    let guarded = false;
    walk(page.ast, (n) => {
        if (n.type !== "ConditionalExpression") return;
        const test = page.source.slice(n.test.start, n.test.end);
        const alternate = page.source.slice(n.alternate.start, n.alternate.end);
        if (/refusal/.test(test) && /TransitionDialog/.test(alternate) && /MoreActions/.test(alternate)) guarded = true;
    });
    assert("both controls stand in the branch where there is no refusal", guarded);
    // AND EACH IS THEN ASKED FOR SEPARATELY, because the two answers come from two
    // maps that agree only on today's three statuses. Deriving one control's
    // presence from the other's would be the coincidence lib/toolStatus.js records.
    assert("the transition control is gated on the offered event", /\{transition\.event && <TransitionDialog /.test(page.source));
    // `More actions` holds the retirement at both widths (#463): beside the transition at a
    // desk, in the top bar on a phone — each asked of the plan's own answer.
    check(
        "  and More actions, which holds the retirement, on its own answer at both widths",
        (page.source.match(/\{transition\.mayRetire && <MoreActions( phone)? \/>\}/g) ?? []).join(" | "),
        "{transition.mayRetire && <MoreActions phone />} | {transition.mayRetire && <MoreActions />}"
    );
    // A RETIRED TOOL SHOWS NOTHING IN THE ACTIONS' PLACE AT A DESK (1c); any other refusal is
    // said there, and a phone's foot bar says the terminal one.
    assert(
        "  a desk says the refusal where the controls would be, but for a status that allows nothing",
        /transition\.refusal !== TRANSITION_COPY\.noTransition && \(\s*<p[^>]*>\{transition\.refusal\}<\/p>/.test(page.source)
    );
    // THE TRANSITION IS HANDED THE PLAN THE PAGE REACHED (#458), which its dialog asks
    // `readSubmission` of before it sends — the event the page offered and the jobs it
    // narrowed, never a decision of the dialog's own — and the tool item's job so the
    // dialog can say when the two differ. The retirement is handed the tool's name, which
    // its question asks with.
    // THE PROVIDER IS HANDED THE PLAN (#463), which both drawings and the question read.
    check("the transition is handed the plan the page reached", attributeSources(page.ast, page.source, "ToolItemTransition", "plan").join(), "{transition}");
    assert("  and the tool item's current job", /currentJobCode=\{/.test(page.source));
    check("the retirement is handed the tool's name", attributeSources(page.ast, page.source, "ToolItemTransition", "toolName").join(), "{tool?.toolName}");

    // ── 7b: what a transition asks before it records (#458) ────────────────
    // A CHECK-OUT RECORDS A NAME, SO IT ALWAYS ASKS; a check-in asks only a person on
    // several jobs, and for a person on one it is the press it always was. The design
    // draws exactly that split (1c, 1d, 1e), and it is #338's job rule and #376's name
    // rule rather than a new one — so it is held by value, and the component is held
    // to asking it.
    log("");
    log("a transition asks first only what the page cannot know:");
    const outOnOne = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.OUT });
    const inStockOnTwo = planTransition({ user: actor(JOB_A, JOB_B), jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK });
    check("a check-out asks, on one job", asksBeforeRecording(inStock), true);
    check("  and on several", asksBeforeRecording(inStockOnTwo), true);
    check("a check-in on one job records on the press", asksBeforeRecording(outOnOne), false);
    check("  and on several asks which", asksBeforeRecording(out), true);

    const dialog = parseFile(DIALOG);
    const dialogFn = functionNamed(dialog.ast, "TransitionDialog");
    const formFn = functionNamed(dialog.ast, "TransitionForm");
    assert("the transition and its dialog were found", Boolean(dialogFn && formFn));
    const dialogSource = dialog.source.slice(dialogFn.start, dialogFn.end);
    const formSource = dialog.source.slice(formFn.start, formFn.end);
    check("it asks that of the plan it was handed", callArguments(dialogFn, dialog.source, "asksBeforeRecording").join(" | "), "plan");
    check("  and the press posts the one job there is", initSource(dialogFn, dialog.source, "one"), "onlyJob(plan.jobs)");
    check("  through its own hidden field", attributeSources(dialogFn, dialog.source, "input", "value").join(" | "), "{toolItemId} | {plan.event} | {one.id}");
    check("the press is bound to the action only when it records on the press", attributeSources(dialogFn, dialog.source, "form", "action").join(), "{asks ? undefined : formAction}");
    // ONE BUTTON FOR THE PRESS AND THE OPENER, so a refusal that turns one into the other
    // — it re-renders the page in place (#378) — leaves focus on the control the reader
    // opened the dialog from. A landing's redirect throws the page's state away whichever.
    check("the press and the opener are one button", attributeSources(dialogFn, dialog.source, "Button", "type").join(), '"submit"');
    check("  saying the event's own word", [...dialogSource.matchAll(/COPY\.control\[([^\]]+)\]/g)].map((m) => m[1]).join(), "plan.event");
    // BUSY WHILE IT SENDS, NEVER DISABLED (#463): 0f's Working on the press, so focus stays on it
    // until the answer comes, where a disabled press gave focus up to the document.
    check("  and busy while a press is sending, never disabled", `${attributeSources(dialogFn, dialog.source, "Button", "busy").join()} ${attributeSources(dialogFn, dialog.source, "Button", "disabled").length}`, "{!asks && pending} 0");
    check("  saying its event's working word", attributeSources(dialogFn, dialog.source, "Button", "busyLabel").join(), "{asks ? undefined : COPY.working[plan.event]}");

    // ── 7c: the dialog asks the action's own reader before it sends (#458) ─
    // WHAT A SUBMISSION MAY BE IS ONE FUNCTION, ASKED TWICE — #456's rule for the
    // registration, here for the transition. The form's own `name.trim()` guard was a
    // second rule beside `readSubmission`; the dialog asks `readSubmission` of what it
    // would send, and its commitment acts only when that answer refuses nothing.
    log("");
    log("the dialog asks readSubmission before it sends, and the action asks again:");
    const submitSource = initSource(formFn, dialog.source, "submit") ?? "";
    assert("its submit prevents the default", /event\.preventDefault\(\)/.test(submitSource));
    assert(
        "  reads what it would send with readSubmission",
        /readSubmission\(plan, \{[\s\S]*formData\.get\("event"\)[\s\S]*formData\.get\("jobId"\)[\s\S]*formData\.get\("checkedOutTo"\)[\s\S]*\}\)/.test(submitSource)
    );
    const refusesAt = submitSource.indexOf("if (answer.refusal) return;");
    assert("  and sends only after that refuses nothing", refusesAt > -1 && refusesAt < submitSource.indexOf("onSend(formData)"));
    check("the frame submits through it", attributeSources(formFn, dialog.source, "DialogFrame", "onSubmit").join(), "{submit}");
    // NOTHING IN IT IS DISABLED FOR THE SENDING (#469): the frame's `busy` draws the
    // commitment's Working and locks `Cancel`, so the one `disabled` left is the commitment's
    // own — it cannot act until `readSubmission` takes what is chosen (0f Disabled).
    check(
        "the commitment acts only when readSubmission takes what is chosen",
        attributeSources(formFn, dialog.source, "Button", "disabled").join(" | "),
        "{Boolean(reading.refusal)}"
    );
    check(
        "  and gives way to its event's working word while it sends",
        attributeSources(formFn, dialog.source, "Button", "busyLabel").join(" | "),
        "{COPY.working[plan.event]}"
    );
    check("  reading the dialog's own choice and name", initSource(formFn, dialog.source, "reading"), "readSubmission(plan, { event: plan.event, jobId: kept, checkedOutTo: name })");
    let trims = 0;
    walk(dialog.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.object?.name === "name" && n.callee.property?.name === "trim") trims++;
    });
    check("no rule of the dialog's own, and no required attribute either", `${trims} ${attributeCount(dialog.ast, "required")}`, "0 0");
    check("the name is asked only of a check-out", initSource(formFn, dialog.source, "asksName"), "plan.event === TOOL_EVENT.CHECKED_OUT");
    assert(
        "  and both of its controls stand under that",
        /\{asksName && \(\s*<Field label=\{COPY\.checkedOutToLabel\}>/.test(formSource) && /\{asksName && \(\s*<NameSheet/.test(formSource)
    );
    check("the move notice is asked of jobMoveNotice", callArguments(formFn, dialog.source, "jobMoveNotice").join(), "{ from: currentJobCode, to: chosen?.jobCode }");
    check("  and said under the job", attributeSources(formFn, dialog.source, "Field", "note").join(), "{jobMoveNotice({ from: currentJobCode, to: chosen?.jobCode })}");
    // WITH ONE JOB IT IS ALREADY CHOSEN AND WITH SEVERAL NOTHING IS (0l), from the one
    // spelling of "one assignment". The tool item's own job is not chosen for a person
    // on several: they are asked because the app does not know which site they are at.
    assert("the job starts on the one there is, or on none, from onlyJob", /useState\(\(\) => onlyJob\(plan\.jobs\)\?\.id \?\? ""\)/.test(formSource));
    // A CHOSEN JOB THE PLAN NO LONGER HOLDS STARTS THERE AGAIN (#469): a refusal re-renders
    // the page in place (#378), and the jobs it plans with can be fewer than the dialog opened
    // with. Seen in a browser before this: below the phone's edge with one job left, a stated
    // field saying `Choose a job` that nothing could open, over a commitment that could not act.
    // THE RULE IS `chosenJobId` SINCE #463, which the foot bar asks of its own choice too.
    check("  and a chosen job the plan no longer holds takes the same start again", initSource(formFn, dialog.source, "kept"), "chosenJobId(plan.jobs, jobId)");
    assert(
        "    whenever the plan stops holding it, before the choice is read",
        /if \(kept !== jobId\) setJobId\(kept\);/.test(formSource) && formSource.indexOf("setJobId(kept)") < formSource.indexOf("const chosen =")
    );
    check("    a choice still held is kept", chosenJobId(ALL_JOBS, JOB_B.id), JOB_B.id);
    check("    one taken away goes back to the one job there is", chosenJobId([JOB_A], JOB_B.id), JOB_A.id);
    check("    or to none of several", chosenJobId(ALL_JOBS, "recGone"), "");
    check("    and nothing chosen of one job is that job", chosenJobId([JOB_A], ""), JOB_A.id);

    // ── 7d: open while it is what the page offers, and where a refusal stands ─
    log("");
    log("the dialog is open while the page still offers what it opened for:");
    // THE OPEN RULE AND THE ANSWER ARE THE PROVIDER'S SINCE #463, which both drawings read.
    const provider = parseFile(PROVIDER);
    const providerFn = functionNamed(provider.ast, "ToolItemTransition");
    assert("the provider was found", providerFn !== null);
    const providerSource = providerFn ? provider.source.slice(providerFn.start, providerFn.end) : "";
    check("open while the offered event is the one it was opened for", initSource(providerFn ?? {}, provider.source, "open"), "openedFor !== null && openedFor === plan.event");
    // THE OPENING ENDS WITH ITS EVENT, so the same event offered again does not open it. A
    // landing's redirect throws the page's state away, the opening with it; a refusal
    // re-renders in place (#378), and two that flip the status out and back would find
    // `openedFor` still naming the event and open the dialog with nobody asking.
    const endsAt = providerSource.indexOf("if (openedFor !== null && openedFor !== plan.event) setOpenedFor(null);");
    assert("  and the opening ends with that event, before open is read", endsAt > -1 && endsAt < providerSource.indexOf("const open ="));
    assert("  holding the one answer both drawings read", providerSource.includes("const [answer, formAction, pending] = useActionState(recordToolItemEventAction, null);"));
    // A REFUSAL IS THE ACTION'S LAST ANSWER, read as it is: a press that lands leaves no
    // answer behind it to hide, since its redirect throws the state away. A stale one is
    // turned into 1g's sentence in the reader's zone; any other is the action's sentence.
    const sentenceFn = functionNamed(provider.ast, "useRefusalSentence");
    const sentenceSource = sentenceFn ? provider.source.slice(sentenceFn.start, sentenceFn.end) : "";
    assert(
        "a refusal is the action's last answer, a stale one named in the reader's zone",
        /const when = useReaderInstant\(answer\?\.moved\?\.at \?\? null\);/.test(sentenceSource) &&
            /if \(answer\.moved\) return COPY\.moved\(\{ \.\.\.answer\.moved, when \}\);/.test(sentenceSource) &&
            /return answer\.error \?\? null;/.test(sentenceSource)
    );
    check("  which the dialog reads", initSource(dialogFn, dialog.source, "refusal"), "useRefusalSentence(answer)");
    const refusalFile = parseFile(REFUSAL);
    assert("a refusal stands under the status only while the dialog is closed", /if \(!sentence \|\| open\) return null;/.test(refusalFile.source));
    check(
        "  as a desk's refusal line and a phone's notice, one at each width",
        `${/<div className="max-sm:hidden">\s*<Refusal>\{sentence\}<\/Refusal>/.test(refusalFile.source)} ${/sm:hidden">\s*<Notice>\{sentence\}<\/Notice>/.test(refusalFile.source)}`,
        "true true"
    );
    check("  and above the dialog's actions while it is open", attributeSources(dialogFn, dialog.source, "TransitionForm", "refusal").join(), "{open ? refusal : null}");
    check("  which the frame says there", attributeSources(formFn, dialog.source, "DialogActions", "refusal").join(), "{refusal}");
    check(
        "the dialog is a sheet below the phone's edge and busy while it sends",
        `${attributeSources(formFn, dialog.source, "DialogFrame", "sheet").join()} ${attributeSources(formFn, dialog.source, "DialogFrame", "busy").join()}`,
        "true {pending}"
    );
    check("  and nothing behind it closes it, since it holds what was typed", attributeSources(formFn, dialog.source, "DialogFrame", "closesOnBackdrop").length, 0);
    check("each opening starts from what the plan hands it", attributeSources(dialogFn, dialog.source, "TransitionForm", "key").join(), "{opening}");

    // ── 7e: each width asks in its own drawing (#458) ──────────────────────
    // AT A DESK the job is 0a's choice and the name the registration's combobox (1j),
    // its suggestions this job's recent names under the name sheet's own head; BELOW
    // THE PHONE'S EDGE each is a field that opens one of 1f's sheets. One state behind
    // both, so what a sheet chose is what the dialog sends.
    log("");
    log("each width asks in its own drawing, from one state:");
    assert("at a desk the job is 0a's choice, drawn only from the phone's edge up", /<div className="max-sm:hidden">\s*<Choice\s+name="jobId"/.test(formSource));
    assert("  and the name the registration's combobox", /<div className="max-sm:hidden">\s*<Combobox\s+name="checkedOutTo"/.test(formSource));
    check("  headed with the name sheet's own words", attributeSources(formFn, dialog.source, "Combobox", "heading").join(), "{COPY.recentHeading}");
    check(
        "below it each opens one of 1f's sheets",
        attributeSources(formFn, dialog.source, "SheetField", "onOpen").join(" | "),
        '{several ? () => setSheet("job") : undefined} | {() => setSheet("name")}'
    );
    check("  the job sheet only for a person on several jobs", /\{several && \(\s*<JobSheet/.test(formSource), true);
    check("  each sheet open only while the dialog is", attributeSources(formFn, dialog.source, "JobSheet", "open").concat(attributeSources(formFn, dialog.source, "NameSheet", "open")).join(" | "), '{open && sheet === "job"} | {open && sheet === "name"}');
    check(
        "the names offered are one list on both widths",
        `${attributeSources(formFn, dialog.source, "Combobox", "suggestions").join()} | ${attributeSources(formFn, dialog.source, "NameSheet", "names").join()}`,
        "{offered.map((person) => ({ label: person }))} | {offered}"
    );
    check("  narrowed and cut by offeredNames", initSource(formFn, dialog.source, "offered"), "offeredNames(recent, name)");
    check("  out of the chosen job's recent names", initSource(formFn, dialog.source, "recent"), "recentNamesFor(recentCheckOuts, { jobCode: chosen?.jobCode })");
    check("one value behind the field and its sheet", `${attributeSources(formFn, dialog.source, "Combobox", "onChange").join()} ${attributeSources(formFn, dialog.source, "NameSheet", "onChange").join()}`, "{setName} {setName}");

    // ── 7f: the phone's foot bar, which asks the same reader (#463) ───────
    // 1f's FOOT BAR KEEPS ITS PRESS AND ANSWERS UNDER THE FIELDS (1g): what a submission may be
    // is `readSubmission` before anything is sent, the field refusals are `fieldRefusals`, and
    // they show once a press asked for that event. The bar is busy while it sends and never
    // disabled, takes the dialog's job rule, and draws no move notice.
    log("");
    log("the phone's foot bar asks the same reader and answers under its fields:");
    const bar = parseFile(BAR);
    const barFn = functionNamed(bar.ast, "TransitionBar");
    assert("the foot bar was found", barFn !== null);
    const barSource = barFn ? bar.source.slice(barFn.start, barFn.end) : "";
    const barSubmit = initSource(barFn ?? {}, bar.source, "submit") ?? "";
    assert(
        "its submit reads what it would send with readSubmission",
        /readSubmission\(plan, \{[\s\S]*formData\.get\("event"\)[\s\S]*formData\.get\("jobId"\)[\s\S]*formData\.get\("checkedOutTo"\)[\s\S]*\}\)/.test(barSubmit)
    );
    const barRefusesAt = barSubmit.indexOf("if (answer.refusal) {");
    assert("  and sends only after that refuses nothing", barRefusesAt > -1 && barRefusesAt < barSubmit.indexOf("send(formData)"));
    check("its field refusals are fieldRefusals of its own choice and name", initSource(barFn ?? {}, bar.source, "refusals"), "fieldRefusals(plan, { jobId: kept, checkedOutTo: name })");
    check(
        "  each said under its field once a press asked for this event",
        attributeSources(barFn ?? {}, bar.source, "Field", "refusal").join(" | "),
        "{pressed ? refusals.jobRefusal : null} | {pressed ? refusals.nameRefusal : null}"
    );
    check("  where pressed is a press for the event offered now", initSource(barFn ?? {}, bar.source, "pressed"), "pressedFor === plan.event");
    check("its press submits, is never disabled, and says its event's working word", `${attributeSources(barFn ?? {}, bar.source, "Button", "type").join()} ${attributeSources(barFn ?? {}, bar.source, "Button", "disabled").length} ${attributeSources(barFn ?? {}, bar.source, "Button", "busyLabel").join()}`, '"submit" 0 {COPY.working[plan.event]}');
    check("  at the phone's size", attributeSources(barFn ?? {}, bar.source, "Button", "size").join(), '"xl"');
    check("  while what it holds is busy with it", attributeSources(barFn ?? {}, bar.source, "FormBusy", "busy").join(), "{pending}");
    check("its job takes the dialog's rule", initSource(barFn ?? {}, bar.source, "kept"), "chosenJobId(plan.jobs, jobId)");
    assert("  restarted whenever the plan stops holding it, before the choice is read", /if \(kept !== jobId\) setJobId\(kept\);/.test(barSource) && barSource.indexOf("setJobId(kept)") < barSource.indexOf("const chosen ="));
    check("it draws no move notice, which is the desk's dialog's", callsTo(barFn ?? {}, "jobMoveNotice").length, 0);
    check("its pill opens the job sheet only for a person on several jobs", attributeSources(barFn ?? {}, bar.source, "SheetChip", "onOpen").join(), '{several ? () => setSheet("job") : undefined}');
    check("  and its name field the name sheet", attributeSources(barFn ?? {}, bar.source, "SheetField", "onOpen").join(), '{() => setSheet("name")}');
    assert("  the name asked only of a check-out", /\{asksName && \(\s*<Field label=\{COPY\.checkedOutToLabel\}/.test(barSource) && /\{asksName && \(\s*<NameSheet/.test(barSource));
    check("with nothing to record it says the plan's refusal in the press's place", /\{plan\.refusal\}<\/p>/.test(barSource), true);
    check("  drawn below the phone's edge alone", attributeSources(barFn ?? {}, bar.source, "BottomBar", "phoneOnly").join(" | "), "true | true");

    // ── 8: retiring — the second answer the plan carries (#363) ────────────
    log("");
    log("which statuses offer a retirement, and to whom:");
    check("a stocked tool item may be retired", inStock.mayRetire, true);
    check("one that is out may be too", out.mayRetire, true);
    // THE `Out` CASE IS COVERED HERE RATHER THAN IN A BROWSER, and that is a
    // conclusion rather than a shortcut: the page renders both controls under one
    // test on `refusal` and never reads the status, so `In stock` and `Out` take a
    // provably identical path. Retiring a second tool item to watch it would have
    // recorded a check-out that never happened.
    check(
        "and the two are offered on identical terms",
        `${inStock.mayRetire}|${inStock.refusal}|${out.mayRetire}|${out.refusal}`,
        "true|null|true|null"
    );
    check("a retired one may not be retired again", retired.mayRetire, false);
    check("  and somebody on no job may not retire at all", noJob.mayRetire, false);

    log("");
    log("and where a retirement's job comes from, which is not the actor:");
    // THE ROW INHERITS THE TOOL ITEM'S OWN JOB. Taking the actor's would write a
    // site the tool had never been on — measured on this base before the branch
    // merged, where `HYE-TL-260909-004` was checked in on one job and retired on
    // another. `Recorded By` is what answers who did it.
    const goodRetire = readRetirement(inStock, { currentJobRecordId: JOB_B.id });
    check("it passes", goodRetire.refusal, null);
    check("  and hands back the tool item's own job", goodRetire.jobRecordId, JOB_B.id);
    // THE ACTOR'S ASSIGNMENTS DO NOT REACH IT, which is the assertion with teeth:
    // the plan above was built for somebody on JOB_A only, and the answer is
    // JOB_B because that is where the tool item was.
    assert("  even when the actor is not assigned to it", !inStock.jobs.some((j) => j.id === JOB_B.id));
    check(
        "  so a tool item on the actor's own job reads that instead",
        readRetirement(inStock, { currentJobRecordId: JOB_A.id }).jobRecordId,
        JOB_A.id
    );

    // A refused plan refuses whatever it is handed, which is also how a stale page
    // is answered: somebody who retired this first makes the fresh plan terminal.
    check("a retired tool item refuses", readRetirement(retired, { currentJobRecordId: JOB_A.id }).jobRecordId, null);
    check("  in the plan's own words", readRetirement(retired, { currentJobRecordId: JOB_A.id }).refusal, retired.refusal);
    check("and somebody on no job is refused too", readRetirement(noJob, { currentJobRecordId: JOB_A.id }).refusal, TOOL_TRANSITION_COPY.noJob);
    // NEITHER AN EVENT NOR A JOB IS TAKEN OR COMPARED, which is where this parts
    // from `readSubmission` twice over. The returned shape says so: no event,
    // and a record id rather than a job the caller could have named.
    assert("the answer carries a job record id and a refusal and no event", !("event" in goodRetire));
    assert("  and no job object, since none was chosen", !("job" in goodRetire));

    // THE TERMINAL GUARD IS UNREACHABLE ON TODAY'S VOCABULARY AND IS ASSERTED ON
    // THE SOURCE FOR EXACTLY THAT REASON. A status is un-retirable only when it
    // is terminal, and a terminal status has already produced `plan.refusal`, so
    // the second guard never fires — measured by mutation, which passed 153 of
    // 153 with it deleted. What it protects is a directly-callable Server Action
    // against a FOURTH status that offers a scan and forbids a retirement, which
    // is the one shape that would reach it. An unasserted guard for an
    // unreachable state is one a later pass deletes as dead, so it is held here
    // rather than left to a behavior no input can produce.
    assert(
        "the terminal guard is in the source even though no input reaches it",
        /if \(!plan\.mayRetire\)/.test(module_.source)
    );

    // ── 9: the words the question says ─────────────────────────────────────
    log("");
    log("what the retirement's question says before it happens:");
    // THE DESIGN'S WORDS (#455, #458): `tool` for the object, a title that asks and
    // names the record — 0l's Confirm and Tools 0a's sheet that confirms, the same
    // words at both widths — and a confirm that names what it retires.
    check("the opener names its object", TOOL_TRANSITION_COPY.retireOpener, "Retire this tool");
    const heading = TOOL_TRANSITION_COPY.retireHeading({ toolName: "DEMO Rotary Hammer", toolItemId: "HYE-TL-261001-022" });
    check("the title asks and names the tool", heading, "Retire DEMO Rotary Hammer?");
    check(
        "  and a tool item whose tool did not resolve is named by its id",
        TOOL_TRANSITION_COPY.retireHeading({ toolName: undefined, toolItemId: "HYE-TL-261001-022" }),
        "Retire HYE-TL-261001-022?"
    );
    check("the confirm names what it retires", TOOL_TRANSITION_COPY.retireSubmit, "Retire tool");
    check("  and says the verb alone, -ing, while it is on its way (#469)", TOOL_TRANSITION_COPY.retireWorking, "Retiring…");
    check("and the way out is the app's own word", TOOL_TRANSITION_COPY.cancel, "Cancel");
    // THE OPENER AND THE TRANSITION CONTROL MAY NOT READ ALIKE, which is half of
    // what keeps a once-ever act from looking like a dozens-a-day one. The other
    // half is what each opens, asserted on the components below.
    assert(
        "the opener does not read like the transition control",
        TOOL_TRANSITION_COPY.retireOpener !== TOOL_TRANSITION_COPY.control[TOOL_EVENT.CHECKED_OUT] &&
            TOOL_TRANSITION_COPY.retireOpener.includes("this tool")
    );
    // THE BODY IS AN ACCOUNT OF WHAT THE ACT ENDS, which `_shared.md` names as the point
    // of a confirmation and 0l's Confirm asks for: the design's sentence (1c, 1f).
    const body = TOOL_TRANSITION_COPY.retireBody;
    check(
        "the sentence is the design's",
        body,
        "It will be removed from inventory, and no more check-outs or check-ins can be recorded. This can't be undone."
    );
    // IT ASKS FOR NO REASON, which is the rule #363 retired rather than
    // implemented. A field for one would be the first thing to come back, so the
    // absence is asserted rather than left to be noticed.
    const retireStrings = [TOOL_TRANSITION_COPY.retireOpener, heading, body];
    check("no word of it asks for a reason", retireStrings.filter((s) => /\breasons?\b/i.test(s)).length, 0);
    check("  and none asks for a note", retireStrings.filter((s) => /\bnotes?\b/i.test(s)).length, 0);

    // THE TRANSITION'S OWN WORDS SINCE #458: the field's example and the name sheet's,
    // which are the design's (1c, 1f), and the missing-name refusal, which is 1g's.
    check("the name field's example", TOOL_TRANSITION_COPY.namePlaceholder, "e.g. Jane Doe");
    check("the head of the recent names, on both widths", TOOL_TRANSITION_COPY.recentHeading, "Recently at this job");
    check("the name sheet's end", TOOL_TRANSITION_COPY.sheetDone, "Done");
    check("  and the name of its clear mark", TOOL_TRANSITION_COPY.clearName, "Clear");
    check("a check-out with no name is answered in 1g's words", TOOL_TRANSITION_COPY.nameRequired, "Enter a name to check out.");

    // THE TERMINAL SENTENCE WIDENED WITH THE SCREEN. #362 wrote it as
    // `no check-out or check-in to record`, which enumerated two of three absent
    // controls once a retire control stood beside them.
    // AND SINCE #463 IT NAMES NO STATUS EITHER: the design's sentence states the end, and the
    // status stands directly above it.
    const terminal = TOOL_TRANSITION_COPY.noTransition;
    assert("the terminal sentence states the end rather than listing what is missing", /nothing more can be recorded/i.test(terminal));
    check("  naming no control", terminal.match(/check-(out|in)/g)?.length ?? 0, 0);
    check("  and no status", TOOL_STATUS_VALUES.filter((status) => terminal.includes(status)).length, 0);

    // ── 10: the question, on the design's frame (#458) ─────────────────────
    // ONE COMPONENT FOR BOTH WIDTHS: 0l's Confirm at a desk and Tools 0a's sheet that
    // confirms on a phone. Escape, focus back to the opener and nothing closing it while
    // it sends are the frame's — `offline/dialog-frame.mjs` holds those once for every
    // dialog — so what is held here is what this question hands the frame.
    log("");
    log("the retirement's question is 0l's Confirm, and a sheet that confirms on a phone:");
    const confirm = parseFile(CONFIRM);
    const opener = parseFile(OPENER);
    check(
        "its title asks with the tool's name and the line under it is the id",
        `${attributeSources(confirm.ast, confirm.source, "DialogFrame", "title").join()} | ${attributeSources(confirm.ast, confirm.source, "DialogFrame", "recordId").join()}`,
        "{COPY.retireHeading({ toolName, toolItemId })} | {toolItemId}"
    );
    check(
        "  a sheet that confirms below the phone's edge, which a press behind it closes there",
        `${attributeSources(confirm.ast, confirm.source, "DialogFrame", "sheet").join()} ${attributeSources(confirm.ast, confirm.source, "DialogFrame", "closesOnBackdrop").join()}`,
        "true true"
    );
    check("  and nothing closes it while it sends", attributeSources(confirm.ast, confirm.source, "DialogFrame", "busy").join(), "{pending}");
    check(
        "its commitment is filled red and submits, beside a way out",
        attributeSources(confirm.ast, confirm.source, "Button", "variant").join(" | "),
        '"bordered" | "danger"'
    );
    check("  the commitment the submit", attributeSources(confirm.ast, confirm.source, "Button", "type").join(), '"submit"');
    check("  giving way to its working word while it sends", attributeSources(confirm.ast, confirm.source, "Button", "busyLabel").join(), "{COPY.retireWorking}");
    check("  and neither button disabled for the sending (#469)", attributeSources(confirm.ast, confirm.source, "Button", "disabled").join(" | "), "");
    check("  which sends through a transition", callsTo(confirm.ast, "startTransition").length, 1);
    check("neither file draws on the old frame", [confirm, opener].filter((f) => /modalStyles/.test(f.source)).length, 0);
    check("the question is the provider's, opened from either More actions", `${attributeSources(provider.ast, provider.source, "RetirementConfirm", "open").join()} ${attributeSources(provider.ast, provider.source, "RetirementConfirm", "onClose").join()}`, "{retiring} {() => setRetiring(false)}");
    // THE WAY OUT IS ONE WORD ON ALL THREE DIALOGS — the check-out's and the check-in's,
    // which are one component, and the retirement's — read off the button that says it,
    // since the value alone holds whatever the screens print in its place.
    check(
        "the way out says it on all three dialogs",
        [dialog, confirm].map((f) => /<Button variant="bordered"[^>]*>\s*\{COPY\.cancel\}\s*<\/Button>/.test(f.source)).join(" "),
        "true true"
    );
    // IT TAKES NO INPUT AT ALL, which is two decisions rather than one. No reason
    // — the rule requiring one was retired with its field. And no job — the row
    // inherits the tool item's own, so the page asks that question once instead
    // of twice, which is the defect that found the rule.
    assert("it asks for no reason field", !/textarea/i.test(confirm.source));
    assert("  and offers no job control", !/<Choice|<select|<SheetField|<JobSheet/.test(confirm.source));
    assert("  nor a hidden job", !/name="jobId"/.test(confirm.source));
    assert("  nor a label for one", !/COPY\.jobLabel|COPY\.jobUnchosen/.test(confirm.source));
    assert("  and shows no job-move line, which is the transition's", callsTo(confirm.ast, "jobMoveNotice").length === 0);
    // The only thing it posts is which tool item, so the action has nothing to
    // trust but the id it looks up.
    check("it posts only the tool item id", [...confirm.source.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).join(), "toolItemId");
    // A MENU ITEM BEHIND `More actions` (#463), the design's place for an act a scan is not
    // for: 0f's Destructive, saying the opener's words, and handing focus to its button before
    // the question opens, so every way out of the question comes back to the button.
    check("the opener is a menu button named More actions", `${attributeSources(opener.ast, opener.source, "button", "aria-haspopup").join()} ${attributeSources(opener.ast, opener.source, "button", "aria-label").join()}`, '"menu" {word}');
    check("  its name the copy's own", initSource(opener.ast, opener.source, "word"), "TOOL_ITEM_COPY.moreActions");
    assert("  its one item the opener's words, a destructive one", /label: TOOL_TRANSITION_COPY\.retireOpener,\s*tone: "danger",/.test(opener.source));
    assert("  which hands focus to its button before the question opens", /buttonRef\.current\?\.focus\(\);\s*setOpen\(false\);\s*openRetirement\(\);/.test(opener.source));
    // AND THE TRANSITION'S DIALOG STILL ASKS FOR A JOB, because a scan is the actor
    // handling the tool. One question on the screen rather than none is the point.
    assert("the transition's dialog keeps its job choice", /<Choice\s+name="jobId"/.test(dialog.source));

    // ── 10b: 1f's job sheet and name sheet, the parts a foot bar opens (#458) ─
    // DRAWN AS 1f DRAWS THEM AND OPENED BY WHATEVER HOLDS A JOB OR ASKS FOR A NAME —
    // the check-out's dialog today, #463's foot bar later. So what is held is what each
    // asks of its opener and does with an answer, and that each closes on a press behind
    // it as 1f draws.
    log("");
    log("1f's job sheet and name sheet are parts any opener can open:");
    const jobSheet = parseFile(JOB_SHEET);
    const nameSheet = parseFile(NAME_SHEET);
    check(
        "the job sheet is a sheet that closes on a press behind it",
        `${attributeSources(jobSheet.ast, jobSheet.source, "DialogFrame", "sheet").join()} ${attributeSources(jobSheet.ast, jobSheet.source, "DialogFrame", "closesOnBackdrop").join()}`,
        "true true"
    );
    assert("  a row chooses and puts the sheet away", /onChoose\(option\.value\);\s*onClose\(\);/.test(jobSheet.source));
    assert("  and the row already chosen is the one checked", /chosen: option\.value === value/.test(jobSheet.source));
    check(
        "the name sheet closes on a press behind it and on its handle, and ends in Done",
        ["sheet", "closesOnBackdrop", "onHandlePress", "done"].map((a) => attributeSources(nameSheet.ast, nameSheet.source, "DialogFrame", a).join()).join(" | "),
        "true | true | {onClose} | {{ label: COPY.sheetDone, onPress: onClose }}"
    );
    assert("  its field the one field in a sheet: filled, with an Accent caret", /bg-mobile-input-background/.test(nameSheet.source) && /caret-primary/.test(nameSheet.source));
    assert("  the keyboard's done key puts it away", /if \(event\.key !== "Enter"\) return;\s*event\.preventDefault\(\);\s*onClose\(\);/.test(nameSheet.source));
    assert("  with a clear mark once it holds a value, named for a screen reader", /\{value && \(\s*<button[\s\S]*?aria-label=\{COPY\.clearName\}/.test(nameSheet.source));
    assert("  every keystroke handed back to the opener", /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/.test(nameSheet.source));
    // THE HEAD GOES WITH ITS ROWS. A typed name that matches none of them leaves no list,
    // as the desk's closes on no suggestion, where a head over nothing was what a browser
    // showed first; and the sentence for a job with none is for that job alone.
    assert("  the list absent until a job is chosen, and once typing leaves it no row", /\{jobChosen && names\.length > 0 && \(/.test(nameSheet.source));
    assert("  a job nothing has gone out on saying so in place of the rows", /\{jobChosen && !hasRecent && \(\s*<p[^>]*>\s*\{COPY\.noRecentNames\}/.test(nameSheet.source));
    assert("  the rows headed as the dialog's suggestions are", /\{COPY\.recentHeading\}/.test(nameSheet.source));
    assert("  and a name picked is the opener's and puts the sheet away", /onChange\(name\);\s*onClose\(\);/.test(nameSheet.source));
    check("neither sheet draws on the old frame", [jobSheet, nameSheet].filter((f) => /modalStyles/.test(f.source)).length, 0);
    // AND THE FOOT BAR OPENS THEM AS THEY ARE (#463), which is what #458 built them for.
    check(
        "the foot bar opens both, as they are",
        `${attributeSources(barFn ?? {}, bar.source, "JobSheet", "open").join()} | ${attributeSources(barFn ?? {}, bar.source, "NameSheet", "open").join()}`,
        '{sheet === "job"} | {sheet === "name"}'
    );

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // THE ARGUMENT READER IS SHOWN TELLING THE THREE SHAPES APART on planted
    // source, because "it read `event`" and "it read nothing and returned the
    // expected string by accident" are not distinguishable from a PASS. This is
    // the mutation the four assertions above are written against, run in-file.
    {
        const planted = parseSource(
            'createToolLogEntry({ event: String(formData.get("event") ?? "") });\n' +
                'updateToolItemCache({ status: "Out" });\n' +
                "planTransition({ status: submittedStatus });\n",
            "<planted-swap>"
        );
        check("  a form-fed event reads as the form's", argumentSource(planted, "createToolLogEntry", "event"), 'String(formData.get("event") ?? "")');
        check("  a spelled status reads as a literal", argumentSource(planted, "updateToolItemCache", "status"), '"Out"');
        check("  and a submitted status is not the stored one", argumentSource(planted, "planTransition", "status"), "submittedStatus");
    }
    // A missing property has to read as MISSING rather than as the expected value,
    // or every argument assertion passes on a call that dropped the field.
    check("  a call with no such property reads null", argumentSource(parseSource("f({ other: 1 });", "<planted>"), "f", "status"), null);
    // The ordering reader is shown saying NO on the reversed pair.
    {
        const reversed = parseSource(
            "async function a() { await updateToolItemCache({}); await createToolLogEntry({}); }",
            "<planted-order>"
        );
        assert("  a reversed pair reads as reversed", !callsBefore(resolveFunction(reversed.ast, "a"), "createToolLogEntry", "updateToolItemCache"));
    }
    // The copy scanner is seen finding a planted bare noun, since zero is also what
    // a broken matcher reports.
    assert("the noun matcher finds `tool item`", TOOL_ITEM_NOUN.test("Retire this tool item?"));
    assert("  and passes the design's `tool`", !TOOL_ITEM_NOUN.test(TOOL_TRANSITION_COPY.retireOpener) && !TOOL_ITEM_NOUN.test(heading));
    // THE JSX READERS ARE SHOWN TELLING A PROP FROM ITS NEIGHBOUR (#458), because "it read
    // `{transition}`" and "it read nothing" are one PASS otherwise: a planted page handing
    // the dialog the event rather than the plan, and a dialog whose open rule is loosened.
    {
        const planted = parseSource(
            "function TransitionDialog() { const open = openedFor !== null; return <TransitionForm key={opening} refusal={refusal} plan={transition.event} />; }",
            "<planted-props>"
        );
        check("  a prop reads as its own source", attributeSources(planted.ast, planted.source, "TransitionForm", "plan").join(), "{transition.event}");
        check("  a prop nothing passes reads as absent", attributeSources(planted.ast, planted.source, "TransitionForm", "busy").length, 0);
        check("  and a loosened rule reads as loosened", initSource(planted.ast, planted.source, "open"), "openedFor !== null");
        check("  a call's arguments read as their own source", callArguments(parseSource("asksBeforeRecording(plan.jobs);", "<planted-call>").ast, "asksBeforeRecording(plan.jobs);", "asksBeforeRecording").join(), "plan.jobs");
    }
    // The pure half is shown producing two different answers from two statuses, so
    // the section-1 equalities are not one constant compared with itself.
    assert(
        "planTransition really reads the status it is given",
        planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK }).event !==
            planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.OUT }).event
    );
}

if (isMain(import.meta.url)) await standalone(title, run);

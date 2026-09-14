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
// `formData.get("event")` and `"Checked Out"` are all "an argument to
// createToolLogEntry", and only reading the ARGUMENT tells them apart. So the
// call sites are parsed and the argument's own source text is compared.
//
// AND #378 ADDED A THIRD THING IN THE SAME FAMILY: a refusal that returns and no
// more leaves every server-rendered fact on the screen as it was, so the sentence
// is true and everything around it is not. That one is held as a return's SHAPE —
// no `{ error }` built outside the one helper — because the name half of it passes
// with four calls to the helper standing beside a fifth branch doing it by hand.
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

import { TOOL_EVENT, TOOL_STATUS, EVENT_OFFERED_BY_STATUS } from "../../../lib/toolStatus.js";
import { TOOL_ITEM_COPY } from "../../../lib/toolItemView.js";
import { TOOL_JOB_COPY } from "../../../lib/toolJob.js";
import {
    RECENT_NAMES_SHOWN,
    TOOL_TRANSITION_COPY,
    jobMoveNotice,
    narrowNames,
    planTransition,
    readRetirement,
    readSubmission,
    recentNamesFor,
} from "../../../lib/toolTransition.js";
import { callsBefore, callsTo, insideTry, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What a person may record against a tool item (#362, #363)";

const ACTION = "app/(tools)/tool-items/[toolItemId]/actions.js";
const FORM = "app/(tools)/tool-items/[toolItemId]/ToolTransitionForm.js";
const MODAL = "app/(tools)/tool-items/[toolItemId]/RetireToolItemForm.js";
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

/** One `Checked Out` row as `recentNamesFor` reads them. */
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
    out.push(TOOL_TRANSITION_COPY.noTransition({ status: TOOL_STATUS.RETIRED }));
    out.push(TOOL_TRANSITION_COPY.movesJob({ from: JOB_B.jobCode, to: JOB_A.jobCode }));
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
 * Every `item`/`items` in a string that is not part of `tool item`.
 *
 * The tools track's own rule: one physical tool is a `tool item` and never a bare
 * `item`, because four other tables on this base hold item rows. Same matcher as
 * offline/tool-item-view.mjs, on this screen's other constant.
 */
function bareItemWords(text) {
    return [...String(text).matchAll(/\b(items?)\b/gi)].filter(
        (m) => !/tool\s$/i.test(String(text).slice(0, m.index))
    );
}

/**
 * The source text of `propName` in the object argument of every call to `fnName`.
 *
 * THE ARGUMENT AND NOT THE NAME, which is the whole point of this file's AST half.
 * A check asserting that `createToolLogEntry` is CALLED passes with the event
 * taken straight off the form, which is the defect. Returning the value's own
 * source distinguishes `event` from `formData.get("event")` from `"Checked Out"`.
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
    assert("  and says so, naming the status", retired.refusal.includes(TOOL_STATUS.RETIRED));
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
    assert("a retired tool item answers before the reader is asked about", both.refusal.includes(TOOL_STATUS.RETIRED));
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
    assert("  saying that nothing was recorded", /nothing was recorded/i.test(stale.refusal));
    assert("  and that the change on screen is somebody else's", /somebody else/i.test(stale.refusal));
    assert(
        "  and asking for no reload, because the action refreshes as it refuses",
        !/(reload|refresh|open it again|out of date)/i.test(stale.refusal)
    );
    assert("  and naming no status, which the page states directly above it", !stale.refusal.includes(TOOL_STATUS.IN_STOCK));
    // THE POINT OF THAT REFUSAL, stated as an assertion rather than only in prose:
    // without it the action would derive `Checked In` from the stored status and
    // record the opposite of what the button said.
    check("  never falling through to the derived event", stale.job, null);

    check("an event the vocabulary does not hold is refused", readSubmission(inStock, { ...CHECKING_OUT, event: "Job Changed", jobId: JOB_A.id }).event, null);
    check("an empty event is refused", readSubmission(inStock, { ...CHECKING_OUT, event: "", jobId: JOB_A.id }).event, null);

    const otherJob = readSubmission(inStock, { ...CHECKING_OUT, jobId: JOB_B.id });
    check("a job the actor is not on is refused", otherJob.refusal, TOOL_JOB_COPY.notYours);
    check("  as is no job at all", readSubmission(inStock, { ...CHECKING_OUT, jobId: "" }).refusal, TOOL_JOB_COPY.notYours);

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
        TOOL_TRANSITION_COPY.moved
    );
    check(
        "  and so is a job that is not the actor's",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "", jobId: JOB_B.id }).refusal,
        TOOL_JOB_COPY.notYours
    );

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
    // ONLY THIS JOB, AND ONLY `Checked Out` ROWS. The other job's name is in the
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
    assert("the sheet shows a few before anybody types", RECENT_NAMES_SHOWN > 0);
    assert("  fewer than a job will accumulate", RECENT_NAMES_SHOWN < 10);

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
    const bare = strings.filter((s) => bareItemWords(s).length > 0);
    check(
        `no bare \`item\` where the noun is a tool item${bare.length ? ` (${JSON.stringify(bare[0])})` : ""}`,
        bare.length,
        0
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
    // `"Checked Out"` are all arguments to this call, and only the argument's
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
    for (const [what, guard] of [
        ["a job", 'if (!jobRecordId) throw new Error("createToolLogEntry: a Job is required");'],
        ["a recorder", 'if (!recordedByUserId) throw new Error("createToolLogEntry: a Recorded By is required");'],
    ])
        assert(`the writer throws on a missing ${what}`, writer.source.includes(guard));
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

    // ── 7: the page offers and refuses in one place ────────────────────────
    log("");
    log("the page renders the refusal where the control would be:");
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
        if (/refusal/.test(test) && /ToolTransitionForm/.test(alternate) && /RetireToolItemForm/.test(alternate))
            guarded = true;
    });
    assert("both controls stand in the branch where there is no refusal", guarded);
    // AND EACH IS THEN ASKED FOR SEPARATELY, because the two answers come from two
    // maps that agree only on today's three statuses. Deriving one control's
    // presence from the other's would be the coincidence lib/toolStatus.js records.
    assert("the transition control is gated on the offered event", /\{transition\.event && \(/.test(page.source));
    assert("  and the retire control on its own answer", /\{transition\.mayRetire && \(/.test(page.source));

    // The form takes the event the page offered rather than deciding for itself,
    // and takes the tool item's own job so it can say when the two differ.
    const form = parseFile(FORM);
    const formSource = form.source;
    assert("the form is handed the offered event", /event=\{transition\.event\}/.test(page.source));
    assert("  and the tool item's current job", /currentJobCode=\{/.test(page.source));
    assert("the form names its word from the control map", /COPY\.control\[event\]/.test(formSource));
    assert("  and asks jobMoveNotice rather than comparing inline", callsTo(form.ast, "jobMoveNotice").length === 1);

    // THE FORM REFUSES WITH THE APP'S SENTENCE RATHER THAN THE BROWSER'S. A
    // `required` attribute would hand the refusal to a bubble this app does not
    // word and Design cannot style, and the sentence would then exist only for a
    // submission the screen did not produce.
    // ASKED OF THE GUARD AND NOT OF THE FILE. A count over the whole component
    // passed until the sheet's own key handler needed one too, which is the shape
    // this file's header warns about one level down: an assertion phrased as a
    // total is an assertion about whatever else the file happens to contain.
    let guardFn = null;
    walk(form.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "guard") guardFn = n.init;
    });
    assert("the form's guard was found", guardFn !== null);
    assert("  and it cancels the submit", callsTo(guardFn, "preventDefault").length === 1);
    assert("  which is what the form's action runs through", /onSubmit=\{guard\}/.test(formSource));
    assert("  and says so in the app's own words", /COPY\.nameRequired/.test(formSource));
    assert(
        "  with no `required` attribute doing it instead",
        !/name="checkedOutTo"[\s\S]{0,200}?required/.test(formSource)
    );
    // AND THE CONTROL IS ONLY THERE FOR THE EVENT THAT CARRIES A NAME, which is the
    // page's own arrangement one level down: a check-in asks nobody.
    assert("the control is gated on the event", /askingForName && \(/.test(formSource));
    assert(
        "  which is the check-out",
        /const askingForName = event === TOOL_EVENT\.CHECKED_OUT;/.test(formSource)
    );

    // ── 8: retiring — the second answer the plan carries (#363) ────────────
    log("");
    log("which statuses offer a retirement, and to whom:");
    check("a stocked tool item may be retired", inStock.mayRetire, true);
    check("one that is out may be too", out.mayRetire, true);
    // THE `Out` CASE IS COVERED HERE RATHER THAN IN A BROWSER, and that is a
    // conclusion rather than a shortcut: the page renders both controls under one
    // test on `refusal` and never reads the status, so `In Stock` and `Out` take a
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

    // ── 9: the words the modal says ────────────────────────────────────────
    log("");
    log("what the modal says before it happens:");
    check("the opener names its object", TOOL_TRANSITION_COPY.retireOpener, "Retire this tool item");
    check("the heading repeats it as a question", TOOL_TRANSITION_COPY.retireHeading, "Retire this tool item?");
    check("the confirm drops the modifier the heading supplied", TOOL_TRANSITION_COPY.retireSubmit, "Retire");
    check("and the way out is the app's own word", TOOL_TRANSITION_COPY.retireCancel, "Cancel");
    // THE OPENER AND THE TRANSITION CONTROL MAY NOT READ ALIKE, which is half of
    // what keeps a once-ever act from looking like a dozens-a-day one. The other
    // half is structural and is asserted on the components below.
    assert(
        "the opener does not read like the transition control",
        TOOL_TRANSITION_COPY.retireOpener !== TOOL_TRANSITION_COPY.control[TOOL_EVENT.CHECKED_OUT] &&
            TOOL_TRANSITION_COPY.retireOpener.includes("tool item")
    );
    // THE BODY IS AN ACCOUNT OF WHAT BECOMES TRUE, which `_shared.md` names as the
    // point of a confirmation. Three facts and the app's one ending.
    const body = TOOL_TRANSITION_COPY.retireBody;
    assert("the body says it leaves the count", body.includes("stops counting"));
    assert("  that nothing more can be recorded", body.includes("nothing more can be"));
    assert("  that the record stays", body.includes("history stay"));
    assert("  and ends the way every irreversible act in this app ends", body.endsWith("This cannot be undone."));
    // IT ASKS FOR NO REASON, which is the rule #363 retired rather than
    // implemented. A field for one would be the first thing to come back, so the
    // absence is asserted rather than left to be noticed.
    const retireStrings = [TOOL_TRANSITION_COPY.retireOpener, TOOL_TRANSITION_COPY.retireHeading, body];
    check("no word of it asks for a reason", retireStrings.filter((s) => /\breasons?\b/i.test(s)).length, 0);
    check("  and none asks for a note", retireStrings.filter((s) => /\bnotes?\b/i.test(s)).length, 0);

    // THE TERMINAL SENTENCE WIDENED WITH THE SCREEN. #362 wrote it as
    // `no check-out or check-in to record`, which enumerated two of three absent
    // controls once a retire control stood beside them.
    const terminal = TOOL_TRANSITION_COPY.noTransition({ status: TOOL_STATUS.RETIRED });
    assert("the terminal sentence names the status", terminal.includes(TOOL_STATUS.RETIRED));
    assert("  and states the end rather than listing what is missing", terminal.includes("nothing more can be recorded"));
    check("  naming no control", terminal.match(/check-(out|in)/g)?.length ?? 0, 0);

    // ── 10: the modal, and the keyboard rule this axis is the second to keep ─
    log("");
    log("the modal is a modal, and it closes the way CLAUDE.md requires:");
    const modal = parseFile(MODAL);
    const modalCalls = new Set();
    walk(modal.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "Identifier") modalCalls.add(n.callee.name);
    });
    // AN OVERLAY RATHER THAN A PARAGRAPH. Without the shared chrome this would be
    // inline content, which would quietly undo the decision that it is a modal at
    // all — and the classes come from the app's single source rather than from a
    // value invented on an axis that carries none.
    assert("it uses the shared backdrop", /MODAL_BACKDROP/.test(modal.source));
    assert("  and the shared card", /MODAL_CARD/.test(modal.source));
    assert(
        "  imported from the one place that holds them",
        /from "@\/app\/components\/modalStyles"/.test(modal.source)
    );
    // THE KEYBOARD RULE, WHICH ONLY ONE OTHER OVERLAY IN THIS APP HONORS. Escape
    // closes it, and focus goes back to the control that opened it. Read as three
    // separate facts, because any one of them can be dropped on its own.
    assert("`Escape` closes it", /e\.key === "Escape"/.test(modal.source));
    assert("  through a keydown listener that is removed again", /removeEventListener\("keydown"/.test(modal.source));
    assert("  focus goes back to the opener", /openerRef\.current\?\.focus\(\)/.test(modal.source));
    assert("  and the card takes focus when it opens", /cardRef\.current\?\.focus\(\)/.test(modal.source));
    assert("it is announced as a dialog", /role="dialog"/.test(modal.source) && /aria-modal="true"/.test(modal.source));
    // AN OPENER RATHER THAN A SUBMIT, which is the structural half of the weight
    // difference: pressing the control on the page acts on nothing.
    assert("the opener is a button that opens rather than submits", /type="button"\s+ref=\{openerRef\}/.test(modal.source));
    assert("  and the confirm is the submit inside the card", /type="submit"/.test(modal.source));
    // Never yanked out from under a submit, which is WithdrawPOForm's rule and
    // reaches `Escape` here as well as `Cancel`.
    assert("it refuses to close while a submit is in flight", /if \(pending\) return;/.test(modal.source));
    // IT TAKES NO INPUT AT ALL, which is two decisions rather than one. No reason
    // — the rule requiring one was retired with its field. And no job — the row
    // inherits the tool item's own, so the page asks that question once instead
    // of twice, which is the defect that found the rule.
    assert("it asks for no reason field", !/textarea/i.test(modal.source));
    assert("  and offers no job picker", !/<select/.test(modal.source));
    assert("  nor a hidden job", !/name="jobId"/.test(modal.source));
    assert("  nor a label for one", !/COPY\.jobLabel|COPY\.jobUnchosen/.test(modal.source));
    assert("  and shows no job-move line, which is the transition's", callsTo(modal.ast, "jobMoveNotice").length === 0);
    // The only thing it posts is which tool item, so the action has nothing to
    // trust but the id it looks up.
    const posted = [...modal.source.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    check(`the form posts only the tool item id (${posted.join()})`, posted.join(), "toolItemId");
    // AND THE TRANSITION FORM STILL ASKS, because a scan is the actor handling
    // the tool. One picker on the screen rather than none is the point.
    assert("the transition form keeps its picker", /<select/.test(formSource));

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
    assert("the copy scanner finds a planted bare `item`", bareItemWords("Every item on this order.").length === 1);
    assert("  and does not flag `tool item` or `tool items`", bareItemWords("This tool item and those tool items.").length === 0);
    // The pure half is shown producing two different answers from two statuses, so
    // the section-1 equalities are not one constant compared with itself.
    assert(
        "planTransition really reads the status it is given",
        planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.IN_STOCK }).event !==
            planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: TOOL_STATUS.OUT }).event
    );
}

if (isMain(import.meta.url)) await standalone(title, run);

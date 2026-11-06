// Checking an asset out and back in (#362).
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
// createAssetLogEntry", and only reading the ARGUMENT tells them apart. So the
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
// asks first (`asksBeforeRecording`, by value) and the three parts of 1j's phone
// screen the dialogs open, which #463's foot bar opens later as they are.
//
// AND #463 GAVE THE PAGE TWO DRAWINGS OF ONE TRANSITION — a desk's header and a phone's
// foot bar — one answer between them (`AssetTransition.js`), and a refusal for a press
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
// maps between them. Those are offline/asset-status.mjs's, because they are
// vocabulary rather than screen — a fourth status has to visit both maps, and a
// check beside this screen would leave the pair half guarded.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_EVENT, ASSET_STATUS, ASSET_STATUS_VALUES, EVENT_OFFERED_BY_STATUS, LOAN_MOVES_FROM_STATUS, MAY_SEND_FOR_REPAIR_FROM_STATUS } from "../../../lib/assetStatus.js";
import { ASSET_COPY } from "../../../lib/assetView.js";
import {
    RECENT_NAMES_SHOWN,
    ASSET_TRANSITION_COPY,
    asksBeforeRecording,
    fieldRefusals,
    matchedPart,
    namesAreRecent,
    narrowNames,
    offeredNames,
    planTransition,
    readRetirement,
    readSubmission,
    recentNamesFor,
    recordingRefusal,
} from "../../../lib/assetTransition.js";
import { callsBefore, callsTo, insideTry, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { existsSync } from "node:fs";

export const title = "What a person may record against an asset (#362, #363, #458, #463, #531)";

const ACTION = "app/(assets)/assets/[assetId]/actions.js";
const DIALOG = "app/(assets)/assets/[assetId]/TransitionDialog.js";
const FORM = "app/(assets)/assets/[assetId]/TransitionForm.js";
const PROVIDER = "app/(assets)/assets/[assetId]/AssetTransition.js";
const BAR = "app/(assets)/assets/[assetId]/TransitionBar.js";
const REFUSAL = "app/(assets)/assets/[assetId]/TransitionRefusal.js";
const OPENER = "app/(assets)/assets/[assetId]/MoreActions.js";
const CONFIRM = "app/(assets)/assets/[assetId]/RetirementConfirm.js";
const NAME_SHEET = "app/(assets)/assets/[assetId]/NameSheet.js";
const PAGE = "app/(assets)/assets/[assetId]/page.js";

const JOB_A = { id: "recJobA", jobCode: "26-DEMO-01" };
const JOB_B = { id: "recJobB", jobCode: "26-DEMO-02" };
const ALL_JOBS = [JOB_A, JOB_B];

/**
 * An actor assigned to the jobs named — a site manager (#506), since nobody else is offered
 * anything to record, and every case below is about what a site manager is offered.
 */
const actor = (...jobs) => ({ id: "recUser", isSiteManager: true, assignedJobs: jobs.map((j) => j.id) });

/** A reader on the jobs named who is not a site manager (#506). */
const nonSiteManager = (...jobs) => ({ id: "recReader", assignedJobs: jobs.map((j) => j.id) });

/**
 * A complete check-out submission, minus the job (#376).
 *
 * The name is spread into every case below rather than typed per call, so the
 * assertions about the EVENT and the JOB stay about those and are not quietly
 * testing the name as well. The cases that are about the name supply their own.
 */
const CHECKING_OUT = { event: ASSET_EVENT.CHECKED_OUT, checkedOutTo: "Dana K" };

/** One `Checked out` row as `recentNamesFor` reads them. */
const checkOut = (checkedOutTo, jobCode, eventAt) => ({
    event: ASSET_EVENT.CHECKED_OUT,
    jobCode,
    eventAt,
    checkedOutTo,
});

/** Every string the copy constant can produce, builders called with plausible input. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(ASSET_TRANSITION_COPY)) {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "object" && value) out.push(...Object.values(value));
    }
    // The stale sentence is parts since #495, its moment one of them: the words are the rest.
    for (const parts of [
        ASSET_TRANSITION_COPY.moved({ by: "Jisoo Park", event: ASSET_EVENT.CHECKED_OUT, at: "2026-10-05T13:50:00.000Z", attempted: ASSET_EVENT.CHECKED_OUT }),
        ASSET_TRANSITION_COPY.moved({ attempted: ASSET_EVENT.CHECKED_IN }),
    ])
        out.push(...parts);
    out.push(ASSET_TRANSITION_COPY.noPermission);
    out.push(ASSET_TRANSITION_COPY.movedTo({ jobCode: JOB_B.jobCode }));
    out.push(ASSET_TRANSITION_COPY.retireHeading({ itemName: "DEMO Rotary Hammer", assetId: "HYE-AST-261001-022" }));
    out.push(ASSET_TRANSITION_COPY.statusNotUpdated);
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
 * The words a sentence takes to say what may no longer be done to an item (#612): a negation,
 * a measure of what is left, or an act. The retired item's sentence stands under its serial
 * number and note, which still write, so it takes none of them.
 */
const CLAIMS_AN_END = /\b(no|not|nothing|none|never|cannot|can['’]t|won['’]t|any|anything|more|longer|locked|final|records?|recorded|edit(s|ed)?|chang(e|es|ed)|writ(e|es|ten)|sav(e|es|ed)|add(s|ed)?)\b/i;

/**
 * The source text of `propName` in the object argument of every call to `fnName`.
 *
 * THE ARGUMENT AND NOT THE NAME, which is the whole point of this file's AST half.
 * A check asserting that `createAssetLogEntry` is CALLED passes with the event
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
    // ── #531: sending an item for repair and taking it back ────────────────
    // At the head of the check, so nothing older that throws keeps these from printing.
    // The plan, the submission, the words and where each control stands, by value and off
    // the sources; the vocabulary and its maps are `offline/asset-status.mjs`'s.
    {
        log("sending an item for repair and taking it back (#531):");
        const site = actor(JOB_A, JOB_B);
        // The item on JOB_A unless said otherwise: its job decides who records on it since #597.
        const planOf = (user, status, assetJobId = JOB_A.id) => planTransition({ user, jobs: ALL_JOBS, status, assetJobId });
        const shape = (plan) => `${plan.event}/${plan.maySendForRepair}/${plan.mayRetire}/${plan.records}/${plan.refusal}`;
        check(
            "a site manager on the item's job is offered, status by status",
            ASSET_STATUS_VALUES.map((status) => `${status}: ${shape(planOf(site, status))}`).join(", "),
            "In stock: Checked out/true/true/true/null, Out: Checked in/false/true/true/null, In repair: Returned from repair/false/true/true/null, " +
                `Retired: null/false/false/true/${ASSET_TRANSITION_COPY.noTransition}, Deleted: null/false/false/true/${ASSET_TRANSITION_COPY.noTransition}`
        );
        check(
            "  a reader who is not a site manager is offered no sending, on any status",
            ASSET_STATUS_VALUES.map((status) => planOf(nonSiteManager(JOB_A, JOB_B), status).maySendForRepair).join(","),
            "false,false,false,false,false"
        );
        // A site manager on no job is told nothing since #597, where a sentence told them to ask for
        // an assignment: the item's job, under its title, says whose it is.
        check("  and a site manager on no job is offered nothing on an item in repair, and told nothing (#597)", shape(planOf(actor(), ASSET_STATUS.IN_REPAIR)), "null/false/false/false/null");
        check("  nor the sending from stock", shape(planOf(actor(), ASSET_STATUS.IN_STOCK)), "null/false/false/false/null");

        const fromStock = planOf(site, ASSET_STATUS.IN_STOCK);
        const away = planOf(site, ASSET_STATUS.IN_REPAIR);
        const outPlan = planOf(site, ASSET_STATUS.OUT);
        const read = (plan, input) => {
            const r = readSubmission(plan, input);
            return `${r.event}/${r.jobRecordId}/${r.checkedOutTo}/${r.stale}/${r.refusal}`;
        };
        log("");
        log("what a repair's submission may be, and which job its row takes:");
        check("a sending from stock takes the item's job", read(fromStock, { event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_A.id }), "Sent for repair/recJobA/null/false/null");
        check(
            "  a submitted job and name beside it are dropped",
            read(fromStock, { event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_A.id, jobId: JOB_B.id, checkedOutTo: "Dana K" }),
            "Sent for repair/recJobA/null/false/null"
        );
        check(
            "the return takes the item's job too, for a reader on two jobs who chose none",
            read(away, { event: ASSET_EVENT.RETURNED_FROM_REPAIR, drawnJobId: JOB_A.id, jobId: "" }),
            "Returned from repair/recJobA/null/false/null"
        );
        const nothingSaved = ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.SENT_FOR_REPAIR });
        check("an item that is out may not be sent: a stale page", read(outPlan, { event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_A.id }), `null/null/null/true/${nothingSaved}`);
        check("  nor one already in repair", read(away, { event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_A.id }), `null/null/null/true/${nothingSaved}`);
        check(
            "  nor may one in repair be checked out",
            read(away, { ...CHECKING_OUT, drawnJobId: JOB_A.id }),
            `null/null/null/true/${ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.CHECKED_OUT })}`
        );
        check(
            "  nor one in stock returned",
            read(fromStock, { event: ASSET_EVENT.RETURNED_FROM_REPAIR, drawnJobId: JOB_A.id }),
            `null/null/null/true/${ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.RETURNED_FROM_REPAIR })}`
        );
        // A CHECK-OUT TAKES THE ITEM'S JOB TOO SINCE #597, where it took the reader's chosen one.
        check(
            "  and a check-out from stock takes the item's job too, a submitted job dropped (#597)",
            read(fromStock, { ...CHECKING_OUT, drawnJobId: JOB_A.id, jobId: JOB_B.id }),
            "Checked out/recJobA/Dana K/false/null"
        );
        check(
            "a reader who does not record on the item is refused a sending, told they may not (#597, #614)",
            read(planOf(actor(), ASSET_STATUS.IN_STOCK), { event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_A.id }),
            `null/null/null/false/${ASSET_TRANSITION_COPY.noPermission}`
        );

        log("");
        log("what the press asks before it records:");
        check(
            "the return and, since #597, a check-in record on the press however many jobs the reader holds; a check-out asks a name",
            `${asksBeforeRecording(away)} ${asksBeforeRecording(planOf(actor(JOB_A), ASSET_STATUS.IN_REPAIR))} ${asksBeforeRecording(fromStock)} ${asksBeforeRecording(outPlan)} ${asksBeforeRecording(planOf(actor(JOB_A), ASSET_STATUS.OUT))}`,
            "false false true false false"
        );
        const awayFields = fieldRefusals(away, { checkedOutTo: "" });
        check("  and the return's field refuses nothing, and names no job field", `${awayFields.nameRefusal}|${"jobRefusal" in awayFields}`, "null|false");

        log("");
        log("the words, by value:");
        check(
            "the two controls, the design's",
            `${ASSET_TRANSITION_COPY.control[ASSET_EVENT.SENT_FOR_REPAIR]} | ${ASSET_TRANSITION_COPY.control[ASSET_EVENT.RETURNED_FROM_REPAIR]}`,
            "Send for repair | Return from repair"
        );
        check(
            "  their working words",
            `${ASSET_TRANSITION_COPY.working[ASSET_EVENT.SENT_FOR_REPAIR]} | ${ASSET_TRANSITION_COPY.working[ASSET_EVENT.RETURNED_FROM_REPAIR]}`,
            "Sending for repair… | Returning from repair…"
        );
        check(
            "a press a sending got in front of",
            JSON.stringify(ASSET_TRANSITION_COPY.moved({ by: "Jisoo Park", event: ASSET_EVENT.SENT_FOR_REPAIR, at: "2026-10-15T14:00:00.000Z", attempted: ASSET_EVENT.CHECKED_OUT })),
            JSON.stringify(["Jisoo Park already sent this for repair on ", { at: "2026-10-15T14:00:00.000Z" }, ". Your check-out wasn't saved."])
        );
        check(
            "  a return a return got in front of, which names no noun",
            JSON.stringify(ASSET_TRANSITION_COPY.moved({ by: "Jisoo Park", event: ASSET_EVENT.RETURNED_FROM_REPAIR, at: "2026-10-15T14:00:00.000Z", attempted: ASSET_EVENT.RETURNED_FROM_REPAIR })),
            JSON.stringify(["Jisoo Park already returned this from repair on ", { at: "2026-10-15T14:00:00.000Z" }, ". Nothing was saved."])
        );
        // NOT `scanned`: in this app a scan is a check-out or a check-in, and whoever got in
        // front of a repair's press may have done either, sent it or retired it. Soo's words since #614.
        check("  and a sending refused with no entry read", nothingSaved, "Someone else updated this item first. Nothing was saved.");
        check(
            "  and a return",
            ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.RETURNED_FROM_REPAIR }),
            "Someone else updated this item first. Nothing was saved."
        );
        check(
            "  the same sentence when the latest entry did not resolve",
            JSON.stringify(ASSET_TRANSITION_COPY.moved({ by: "Jisoo Park", attempted: ASSET_EVENT.SENT_FOR_REPAIR })),
            JSON.stringify(["Someone else updated this item first. Nothing was saved."])
        );
        check(
            "  while a scan's still says it was scanned",
            ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.CHECKED_OUT }),
            "Someone else scanned this first. Your check-out wasn't saved."
        );

        log("");
        log("the action, off its source:");
        const action = parseFile(ACTION);
        const recordFn = resolveFunction(action.ast, "recordAssetEventAction");
        // THE ITEM'S OWN JOB, READ FRESH, IS THE ONLY JOB THE ROW TAKES (#597): the plan is built on
        // it, and the form's word for the job is the page's, compared and never written.
        check("the plan is built on the item's own job as read", argumentSource({ ast: recordFn, source: action.source }, "planTransition", "assetJobId"), "asset.job?.[0]");
        check(
            "  the submission read with the job the page was drawn on, compared",
            argumentSource({ ast: recordFn, source: action.source }, "readSubmission", "drawnJobId"),
            'String(formData.get("drawnJobId") ?? "")'
        );
        check("  and no submitted job to write", argumentSource({ ast: recordFn, source: action.source }, "readSubmission", "jobId"), null);
        check("  and the row takes the job the submission hands back", argumentSource({ ast: recordFn, source: action.source }, "writeEvent", "jobRecordId"), "jobRecordId");

        log("");
        log("where each control stands, off the sources:");
        const provider = parseFile(PROVIDER).source;
        assert(
            "the provider holds which event is on its way, set by every send, which is then the one sent last (#583)",
            /const send = \(formData, via\) => \{\s*setSending\(String\(formData\.get\("event"\) \?\? ""\)\);\s*setLastSent\("event"\);\s*setEventVia\(via\);\s*if \(via === "dialog"\) setEventSentFor\(opening\);\s*if \(via === "desk"\) pressedOn\.current = document\.activeElement instanceof HTMLElement \? document\.activeElement : null;\s*startTransition\(\(\) => formAction\(formData\)\);\s*\};/.test(provider)
        );
        assert("  and splits the wait: the press's, and the menu's sending", /pending: pending && !repairing,\s*repairPending: pending && repairing,/.test(provider) && /const repairing = sending === ASSET_EVENT\.SENT_FOR_REPAIR;/.test(provider));
        assert(
            "  the menu's sending posts the asset, the job the page was drawn on and the event (#597)",
            /sendForRepair: \(via\) => \{\s*const formData = new FormData\(\);\s*formData\.set\("assetId", assetId\);\s*formData\.set\("drawnJobId", assetJobRecordId \?\? ""\);\s*formData\.set\("event", ASSET_EVENT\.SENT_FOR_REPAIR\);\s*send\(formData, via\);\s*\},/.test(provider)
        );
        const opener = parseFile(OPENER).source;
        assert("More actions offers it only where the plan does", /const maySendForRepair = Boolean\(transition\?\.plan\.maySendForRepair\);/.test(opener) && /\.\.\.\(maySendForRepair\s*\?/.test(opener));
        assert(
            "  above the retirement, in the control's words, handing focus to its button and sending",
            /key: "repair",\s*label: ASSET_TRANSITION_COPY\.control\[ASSET_EVENT\.SENT_FOR_REPAIR\],\s*onSelect: \(\) => \{\s*buttonRef\.current\?\.focus\(\);\s*setOpen\(false\);\s*transition\.sendForRepair\(phone \? "phone" : "desk"\);/.test(opener) &&
                opener.indexOf('key: "repair"') < opener.indexOf('key: "retire"')
        );
        // The office's deletion is the second Destructive line since #582, an end as the retirement is.
        assert(
            "  in the menu's plain tone, the retirement and the deletion alone Destructive",
            (opener.match(/tone: "danger"/g) ?? []).length === 2 && /key: "retire",[^}]*tone: "danger"/.test(opener) && /key: "delete",[^}]*tone: "danger"/.test(opener) && !/key: "repair",[^}]*tone:/.test(opener)
        );
        assert(
            "  and the button busy while it is on its way: said, turned away, and the spinner over its dots",
            /const busy = Boolean\(transition\?\.repairPending\);/.test(opener) &&
                /aria-busy=\{busy \|\| undefined\}\s*aria-disabled=\{busy \|\| undefined\}\s*data-busy=\{busy \|\| undefined\}/.test(opener) &&
                /if \(busy\) return;/.test(opener) &&
                /<ButtonLabel size=\{phone \? "xl" : "lg"\} on="unfilled" busyLabel=\{ASSET_TRANSITION_COPY\.working\[ASSET_EVENT\.SENT_FOR_REPAIR\]\}>/.test(opener)
        );
        const dialogSource = parseFile(DIALOG).source;
        assert(
            "the desk's press posts no job but the one the page was drawn on (#597)",
            /\{!asks && \(\s*<>\s*<input type="hidden" name="assetId" value=\{assetId\} \/>\s*<input type="hidden" name="drawnJobId" value=\{drawnJobId \?\? ""\} \/>\s*<input type="hidden" name="event" value=\{plan\.event\} \/>\s*<\/>\s*\)\}/.test(dialogSource) &&
                !/name="jobId"/.test(dialogSource)
        );
        assert("  says which event it sends", /if \(!asks\) \{\s*sends\(plan\.event, "desk"\);\s*return;\s*\}/.test(dialogSource));
        assert("  and locks while the menu's sending is on its way", /<FormBusy busy=\{repairPending \? "action" : false\}>/.test(dialogSource));
        const barSource = parseFile(BAR).source;
        assert(
            "the foot bar draws no job pill and posts no job but the one the page was drawn on (#597)",
            !/name="jobId"|SheetChip|JobSheet|jobLabel|pressTakesJob/.test(barSource) && /<input type="hidden" name="drawnJobId" value=\{drawnJobId \?\? ""\} \/>/.test(barSource)
        );
        const pageSource = parseFile(PAGE).source;
        assert(
            "the desk's header draws More actions for a sending, a loan's line, a retirement or the office's acts (#583, #582, #598), and nothing for a status that allows nothing",
            /const menuActs = transition\.maySendForRepair \|\| transition\.mayLend \|\| transition\.mayReturn \|\| transition\.mayRetire \|\| officeActs;/.test(pageSource) &&
                /\{menuActs && <MoreActions \/>\}/.test(pageSource) &&
                /\{!transition\.refusal && \(transition\.event \|\| menuActs\) && \(/.test(pageSource)
        );
        log("");
    }

    // ── 0: whether this reader records on this item at all (#506, #597) ────
    // A READER WHO DOES NOT RECORD ON THE ITEM IS OFFERED NOTHING AND TOLD NOTHING, on every
    // status: no event, no retirement and no refusal, which is what draws neither a control nor
    // a sentence for them at a desk or on a phone. That was a reader who is not a site manager
    // (#506); since #597 it is a site manager the item's job is not one of too — on another job or
    // on none — who reads the item as anybody does, its job under its title saying whose it is.
    // Asked before the status, so a retired item's sentence is not theirs either — and first here
    // as it is in `planTransition`, so a plan offering a site manager nothing fails these lines
    // rather than throwing in the ones below.
    log("whether this reader records on this item at all:");
    const offeredTo = (user, assetJobId = JOB_A.id) =>
        ASSET_STATUS_VALUES.map((status) => {
            const plan = planTransition({ user, jobs: ALL_JOBS, status, assetJobId });
            return `${status}: ${plan.event}/${plan.mayRetire}/${plan.records}/${plan.refusal}`;
        }).join(", ");
    const nothing = ASSET_STATUS_VALUES.map((status) => `${status}: null/false/false/null`).join(", ");
    check("a reader who is not a site manager is offered nothing and told nothing, on every status (#506)", offeredTo(nonSiteManager(JOB_A, JOB_B)), nothing);
    check("  nor one on no job, who is not told to ask for one", offeredTo(nonSiteManager()), nothing);
    // The office's flag opens the office's screens and nothing here: an Admin, and the
    // President, who are not site managers record nothing (#506) — `soo@` is all three.
    check("  nor the office or the President, who are not site managers", offeredTo({ ...nonSiteManager(JOB_A), isAdmin: true, role: "President" }), nothing);
    check("  nor a site manager on another job, since #597", offeredTo(actor(JOB_B)), nothing);
    check("  nor one on no job, who was told to ask for one until #597", offeredTo(actor()), nothing);
    check("  nor the office marked a site manager, on a job not the item's", offeredTo({ ...actor(JOB_B), isAdmin: true }), nothing);
    check("  nor anybody on an item with no job", offeredTo(actor(JOB_A, JOB_B), null), nothing);
    // ANTI-VACUITY: the same reader marked a site manager on the item's job is offered what the
    // status allows, so "nothing" above is the role's and the job's answer rather than every
    // reader's — and the site manager on another job, the item moved to theirs, is offered it too.
    const each = `${ASSET_STATUS.IN_STOCK}: ${ASSET_EVENT.CHECKED_OUT}/true/true/null, ${ASSET_STATUS.OUT}: ${ASSET_EVENT.CHECKED_IN}/true/true/null, ${ASSET_STATUS.IN_REPAIR}: ${ASSET_EVENT.RETURNED_FROM_REPAIR}/true/true/null, ${ASSET_STATUS.RETIRED}: null/false/true/${ASSET_TRANSITION_COPY.noTransition}, ${ASSET_STATUS.DELETED}: null/false/true/${ASSET_TRANSITION_COPY.noTransition}`;
    check("  while the same reader marked a site manager is offered each status's own", offeredTo({ ...nonSiteManager(JOB_A, JOB_B), isSiteManager: true }), each);
    check("  and the site manager on another job, the item on theirs", offeredTo(actor(JOB_B), JOB_B.id), each);

    // ── 1: what a status offers a site manager on the item's job ───────────
    log("");
    log("the one transition a status allows, for a site manager on the item's job:");
    const inStock = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_A.id });
    check("a stocked asset offers a check-out", inStock.event, ASSET_EVENT.CHECKED_OUT);
    check("  with no refusal", inStock.refusal, null);
    check("  and names the item's job, by its record and its code", `${inStock.records} ${inStock.jobId} ${inStock.jobCode}`, "true recJobA 26-DEMO-01");

    const out = planTransition({ user: actor(JOB_A, JOB_B), jobs: ALL_JOBS, status: ASSET_STATUS.OUT, assetJobId: JOB_B.id });
    check("one that is out offers a check-in", out.event, ASSET_EVENT.CHECKED_IN);
    // THE ITEM'S JOB AND NEVER THE READER'S (#597): a reader on two jobs is not offered a choice
    // of them, and the plan names the one the item sits on, which is not their first.
    check("  on the item's job, not the reader's first", `${out.jobId} ${out.jobCode}`, "recJobB 26-DEMO-02");
    check("  and carries no jobs to choose from, as it did until #597", "jobs" in out, false);

    // ── 2: the refusals, and which of them wins ────────────────────────────
    log("");
    log("and what refuses:");
    const retired = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.RETIRED, assetJobId: JOB_A.id });
    check("a retired asset offers nothing", retired.event, null);
    check("  and says so, in the terminal sentence (#463, #612)", retired.refusal, ASSET_TRANSITION_COPY.noTransition);

    const noJob = planTransition({ user: actor(), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_A.id });
    check("somebody on no job is offered nothing", noJob.event, null);
    check("  and told nothing since #597, where they were told to ask for a job", noJob.refusal, null);
    check("  the plan saying they do not record here", noJob.records, false);
    // A person with no jobs and a user object with none at all are the same state,
    // and the second is what a caller that forgot to select the field produces.
    check(
        "  and a user with no field at all reads the same",
        JSON.stringify(planTransition({ user: { isSiteManager: true }, jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_A.id })),
        JSON.stringify(noJob)
    );
    check("  as does the transition's sentence that told them, gone with #597", "noJob" in ASSET_TRANSITION_COPY, false);

    // THE ORDER IS THE ASSERTION HERE. A retired item on another job tells its reader nothing —
    // they read it as anybody does — where on their own job the terminal sentence is theirs.
    const elsewhereRetired = planTransition({ user: actor(JOB_B), jobs: ALL_JOBS, status: ASSET_STATUS.RETIRED, assetJobId: JOB_A.id });
    check("a retired item on another job says nothing to a site manager not on it", elsewhereRetired.refusal, null);

    // A status the vocabulary does not hold throws rather than silently offering
    // nothing, which is lib/assetStatus.js's guarantee reaching this caller.
    let threw = null;
    try {
        planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: "Lost", assetJobId: JOB_A.id });
    } catch (err) {
        threw = err.message;
    }
    assert("a status outside the vocabulary throws", Boolean(threw));

    // ── 3: the submission is compared, never taken ─────────────────────────
    log("");
    log("what a submission has to match:");
    const good = readSubmission(inStock, { ...CHECKING_OUT, drawnJobId: JOB_A.id });
    check("the offered event on the job the page was drawn on passes", good.refusal, null);
    check("  and what comes back is the PLAN's event", good.event, ASSET_EVENT.CHECKED_OUT);
    check("  with the item's own job", good.jobRecordId, "recJobA");

    const stale = readSubmission(inStock, { ...CHECKING_OUT, event: ASSET_EVENT.CHECKED_IN, drawnJobId: JOB_A.id });
    check("a submission naming the other event is refused", stale.event, null);
    // THE SENTENCE CARRIES WHAT A FRESHLY RENDERED PAGE CANNOT SAY (#378), and the
    // three assertions are the three halves of that. A refused press and a
    // successful one both end on a flipped control and one more history entry, so
    // the first two are what tell them apart; the third is this issue's own point,
    // and without it the instruction could come back with nothing failing. The
    // status is deliberately NOT named — the header above it says so, freshly.
    assert("  saying that the press was not saved", /wasn't saved/i.test(stale.refusal));
    assert("  and that the change on screen is someone else's", /someone else/i.test(stale.refusal));
    // AND IT SAYS IT IS THE STALE ONE (#463), which is what the action reads the latest entry
    // for: the design names who recorded first and when (1k), which this function cannot know.
    check("  marked as the stale refusal", stale.stale, true);
    check("  naming the press it refused", stale.refusal, ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.CHECKED_IN }));
    assert(
        "  and asking for no reload, because the action refreshes as it refuses",
        !/(reload|refresh|open it again|out of date)/i.test(stale.refusal)
    );
    assert("  and naming no status, which the page states directly above it", !stale.refusal.includes(ASSET_STATUS.IN_STOCK));
    // THE POINT OF THAT REFUSAL, stated as an assertion rather than only in prose:
    // without it the action would derive `Checked in` from the stored status and
    // record the opposite of what the button said.
    check("  never falling through to the derived event", stale.jobRecordId, null);

    check("an event the vocabulary does not hold is refused", readSubmission(inStock, { ...CHECKING_OUT, event: "Job Changed", drawnJobId: JOB_A.id }).event, null);
    check(
        "  saying someone else recorded it first, as no press names it (#531)",
        readSubmission(inStock, { ...CHECKING_OUT, event: "Job Changed", drawnJobId: JOB_A.id }).refusal,
        "Someone else updated this item first. Nothing was saved."
    );
    check("an empty event is refused", readSubmission(inStock, { ...CHECKING_OUT, event: "", drawnJobId: JOB_A.id }).event, null);

    // ── 3a: whether the press is still the reader's, compared before anything else (#597) ─────
    // THE JOB IS NEVER THE FORM'S: the row takes the item's own as the action read it, and the
    // form's only job is the one the page was drawn on, compared and never written. Since #614
    // the job is asked first and the reader second, each cause its own sentence (Soo).
    log("");
    log("whether the press is still the reader's, before anything about the press (#597, #614):");
    check("a job the form names is dropped, the item's taken", readSubmission(inStock, { ...CHECKING_OUT, drawnJobId: JOB_A.id, jobId: JOB_B.id }).jobRecordId, "recJobA");
    const movedOn = planTransition({ user: actor(JOB_A, JOB_B), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_B.id });
    const moved = readSubmission(movedOn, { ...CHECKING_OUT, drawnJobId: JOB_A.id });
    check(
        "a page drawn on the job the item has left is refused, saying where it is now and that nothing was saved",
        `${moved.event} ${moved.jobRecordId} ${moved.stale} | ${moved.refusal}`,
        "null null false | This item moved to 26-DEMO-02. Nothing was saved."
    );
    check("  though the reader is on the job it moved to", movedOn.records, true);
    check("  and a form carrying no drawn job reads as drawn on none", readSubmission(movedOn, { ...CHECKING_OUT }).refusal, ASSET_TRANSITION_COPY.movedTo({ jobCode: "26-DEMO-02" }));
    const takenOff = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_B.id });
    check(
        "an item moved to a job the reader is not on says where it is, the job asked before the reader (#614)",
        readSubmission(takenOff, { ...CHECKING_OUT, drawnJobId: JOB_A.id }).refusal,
        "This item moved to 26-DEMO-02. Nothing was saved."
    );
    check(
        "  and one that did not move, the reader no longer on its job, says they may not (#614)",
        readSubmission(takenOff, { ...CHECKING_OUT, drawnJobId: JOB_B.id }).refusal,
        "You no longer have permission to update this item. Nothing was saved."
    );
    check(
        "  as does one whose reader is no longer a site manager",
        readSubmission(planTransition({ user: { ...actor(JOB_B), isSiteManager: false }, jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_B.id }), { ...CHECKING_OUT, drawnJobId: JOB_B.id }).refusal,
        "You no longer have permission to update this item. Nothing was saved."
    );
    check(
        "  before a status that allows nothing",
        readSubmission(planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.RETIRED, assetJobId: JOB_B.id }), { ...CHECKING_OUT, drawnJobId: JOB_B.id }).refusal,
        "You no longer have permission to update this item. Nothing was saved."
    );
    check(
        "  and a move before a stale page",
        readSubmission(movedOn, { ...CHECKING_OUT, event: ASSET_EVENT.CHECKED_IN, drawnJobId: JOB_A.id }).refusal,
        "This item moved to 26-DEMO-02. Nothing was saved."
    );
    check(
        "the reading is recordingRefusal's, null on the plan the page drew",
        `${recordingRefusal(inStock, { drawnJobId: JOB_A.id })} | ${recordingRefusal(movedOn, { drawnJobId: JOB_A.id })} | ${recordingRefusal(takenOff, { drawnJobId: JOB_B.id })}`,
        "null | This item moved to 26-DEMO-02. Nothing was saved. | You no longer have permission to update this item. Nothing was saved."
    );
    check("  and the sentence for an item moved to no job says only what was not saved", ASSET_TRANSITION_COPY.movedTo({ jobCode: null }), "Nothing was saved.");
    // EITHER CAUSE ENDS ON `Nothing was saved.` WHATEVER WAS PRESSED (#614), and names no press.
    check(
        "  a check-out, a check-in and a sending refused for either cause say the same sentence (#614)",
        [
            readSubmission(movedOn, { ...CHECKING_OUT, drawnJobId: JOB_A.id }).refusal,
            readSubmission(movedOn, { ...CHECKING_OUT, event: ASSET_EVENT.CHECKED_IN, drawnJobId: JOB_A.id }).refusal,
            readSubmission(movedOn, { ...CHECKING_OUT, event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_A.id }).refusal,
            readSubmission(takenOff, { ...CHECKING_OUT, drawnJobId: JOB_B.id }).refusal,
            readSubmission(takenOff, { ...CHECKING_OUT, event: ASSET_EVENT.SENT_FOR_REPAIR, drawnJobId: JOB_B.id }).refusal,
        ].join(" | "),
        "This item moved to 26-DEMO-02. Nothing was saved. | This item moved to 26-DEMO-02. Nothing was saved. | This item moved to 26-DEMO-02. Nothing was saved. | You no longer have permission to update this item. Nothing was saved. | You no longer have permission to update this item. Nothing was saved."
    );

    // ── 3b: a check-out cannot be recorded without a name (#376) ───────────
    log("");
    log("who the asset went to, which only a check-out carries:");
    const noName = readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "", drawnJobId: JOB_A.id });
    check("a check-out with no name is refused", noName.refusal, ASSET_TRANSITION_COPY.nameRequired);
    check("  and writes nothing", `${noName.event}|${noName.checkedOutTo}`, "null|null");
    // WHITESPACE IS NOT A NAME. The value is normalized before it is judged, so the
    // field a person tabbed through and the field they put two spaces in reach the
    // same sentence — without this the second would write a blank-looking row that
    // every screen renders as an empty pair.
    check(
        "  as is a name of nothing but whitespace",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "   ", drawnJobId: JOB_A.id }).refusal,
        ASSET_TRANSITION_COPY.nameRequired
    );
    // THE STORED VALUE IS NORMALIZED AND ITS CASE IS KEPT, which is #18's split
    // exactly: whitespace is fixed in what is written because a formula cannot
    // collapse an internal run, and case is folded only where two names are
    // compared. The name on a purchase order is not ours to retype and neither is
    // a person's.
    check(
        "  a name is trimmed and its inner runs collapsed",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "  Mike   R  ", drawnJobId: JOB_A.id }).checkedOutTo,
        "Mike R"
    );
    check(
        "  and its case is left alone",
        readSubmission(inStock, { ...CHECKING_OUT, checkedOutTo: "mIKE r", drawnJobId: JOB_A.id }).checkedOutTo,
        "mIKE r"
    );

    // A CHECK-IN CARRIES NOBODY, AND A NAME SUBMITTED WITH ONE IS DROPPED RATHER
    // THAN REFUSED — the treatment the submitted EVENT already gets, and the only
    // one that cannot be turned into a way of writing a recipient onto a row that
    // must not have one. A refusal would have been the other option and is worse:
    // it would answer a forged field with a sentence about it.
    const checkingIn = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.OUT, assetJobId: JOB_A.id });
    const forgedName = readSubmission(checkingIn, {
        event: ASSET_EVENT.CHECKED_IN,
        drawnJobId: JOB_A.id,
        checkedOutTo: "Dana K",
    });
    check("a check-in passes with a name attached", forgedName.refusal, null);
    check("  and the name does not survive it", forgedName.checkedOutTo, null);
    check(
        "  while a check-in with none is unaffected",
        readSubmission(checkingIn, { event: ASSET_EVENT.CHECKED_IN, drawnJobId: JOB_A.id }).refusal,
        null
    );

    // THE ORDER OF THE REFUSALS, WHICH IS `planTransition`'s: what the app knows
    // before what the person typed. A submission that is BOTH stale and nameless
    // hears about the page, not about the name — otherwise somebody fixes the name
    // and presses again into the same refusal.
    check(
        "a stale page is answered before a missing name",
        readSubmission(inStock, { event: ASSET_EVENT.CHECKED_IN, drawnJobId: JOB_A.id, checkedOutTo: "" }).refusal,
        ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.CHECKED_IN })
    );
    check(
        "  and so is an item no longer the reader's (#597)",
        readSubmission(takenOff, { ...CHECKING_OUT, checkedOutTo: "", drawnJobId: JOB_B.id }).refusal,
        "You no longer have permission to update this item. Nothing was saved."
    );

    // ── 3b': the one field a press can leave empty (#463, #597) ───────────
    // A PHONE'S PRESS IS ANSWERED UNDER THE FIELD IT IS ABOUT (1k), and the reader is the one
    // `readSubmission` reads — so the two cannot disagree. There were two fields until #597, the
    // job's and the name's; the job is the item's own now.
    log("");
    log("what is wrong with the name:");
    const missing = fieldRefusals(inStock, { checkedOutTo: "  " });
    check("no name is answered, and no job field is", `${missing.nameRefusal} | ${Object.keys(missing).join(",")}`, `${ASSET_TRANSITION_COPY.nameRequired} | name,nameRefusal`);
    const given = fieldRefusals(inStock, { jobId: JOB_B.id, checkedOutTo: "  Dana   K " });
    check("  and a name given refuses nothing, normalized, whatever job the form names", `${given.nameRefusal} | ${given.name}`, "null | Dana K");
    check("  a check-in asks no name", fieldRefusals(out, { checkedOutTo: "" }).nameRefusal, null);
    check("  and readSubmission reads the same", callsTo(resolveFunction(parseFile("lib/assetTransition.js").ast, "readSubmission"), "fieldRefusals").length, 1);

    // ── 3c: the names a job offers, folded and narrowed (#376) ─────────────
    log("");
    log("the names this job has recently handed assets to:");
    const ROWS = [
        checkOut("Dana K", JOB_A.jobCode, "2026-09-14T10:00:00.000Z"),
        checkOut("Mike R", JOB_A.jobCode, "2026-09-12T10:00:00.000Z"),
        checkOut("mike  r", JOB_A.jobCode, "2026-09-13T10:00:00.000Z"),
        checkOut("Pat T", JOB_A.jobCode, "2026-09-11T10:00:00.000Z"),
        checkOut("Sam B", JOB_B.jobCode, "2026-09-15T10:00:00.000Z"),
        { event: ASSET_EVENT.CHECKED_IN, jobCode: JOB_A.jobCode, eventAt: "2026-09-16T10:00:00.000Z" },
        { event: ASSET_EVENT.RETIRED, jobCode: JOB_A.jobCode, eventAt: "2026-09-17T10:00:00.000Z", checkedOutTo: "Ghost G" },
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
    // ONLY THIS JOB, AND ONLY `Checked out` ROWS. The page reads the item's job's rows alone
    // since #597, where it read every job the reader was on while a picker could move between
    // them; the rule stays here, so a row of another job is never one of this job's names. A row
    // of another event with a name is a defect upstream and is ignored rather than shown.
    assert("  nobody from the other job", !names.includes("Sam B"));
    assert("  and nothing off a row that is not a check-out", !names.includes("Ghost G"));
    check(
        "the other job answers with its own",
        recentNamesFor(ROWS, { jobCode: JOB_B.jobCode }).join(" | "),
        "Sam B"
    );
    // A row with no job of its own beside them, so an item whose job did not resolve matching it
    // is something the answer would show.
    check(
        "an item whose job did not resolve offers nobody",
        recentNamesFor([...ROWS, checkOut("Nobody N", undefined, "2026-09-18T10:00:00.000Z")], { jobCode: undefined }).length,
        0
    );
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
    // Three, which is what 1j's name sheet lists (#458).
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
    // WHAT IS OFFERED IS THE RECENT LIST WHILE NOTHING IS TYPED, which is what its head names
    // (#495): the head stands over that list and goes once somebody types.
    check("the recent names are what is offered while nothing is typed", `${namesAreRecent("")} ${namesAreRecent("   ")}`, "true true");
    check("  and not once a fragment is", namesAreRecent("e"), false);
    // THE PART A FRAGMENT MATCHED, SET AT 600 (#495): where the narrowing found it, on its fold,
    // at a word's start when it starts one and otherwise its first place.
    const marked = (name, typed) => {
        const part = matchedPart(name, typed);
        return part ? `${part.before}[${part.match}]${part.after}` : "none";
    };
    check("a typed fragment is marked where it matched", marked("Mike Torres", "tor"), "Mike [Tor]res");
    check("  ignoring case, the name's own case kept", marked("Mike Torres", "MIKE"), "[Mike] Torres");
    check("  at a word's start before an earlier place inside a word", marked("Anna Nash", "na"), "Anna [Na]sh");
    check("  and inside a word when it starts none", marked("Dana K", "an"), "D[an]a K");
    check("  spacing folded, as the narrowing folds it", marked("mike r", "mike  r"), "[mike r]");
    check("nothing typed marks nothing", marked("Dana K", "  "), "none");
    check("  nor does a fragment the name does not hold", marked("Dana K", "zz"), "none");

    // A refused plan is not re-litigated by a well-formed submission — which is
    // what a forged POST against a retired asset looks like.
    const forged = readSubmission(retired, { ...CHECKING_OUT, drawnJobId: JOB_A.id });
    check("a refused plan refuses whatever is submitted", forged.event, null);
    check("  in the plan's own words", forged.refusal, retired.refusal);

    // AND THE `never taken` HALF IS UNREACHABLE BEHAVIORALLY, WHICH IS WHY IT IS
    // READ OFF THE SOURCE. The function returns only when the two events are equal,
    // so handing back the submitted one instead of the plan's is invisible to every
    // assertion above — measured by mutation, which passed 81 of 81. It stops being
    // invisible the moment somebody loosens the comparison, and by then the value
    // flowing through is the form's. So the return is parsed.
    const module_ = parseFile("lib/assetTransition.js");
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
    // ONE SINCE #597, where #531 made two — a repair's with the asset's job and a scan's with the
    // chosen one: every event a press or the menu sends records on the item's own job now.
    check("it has one return that is not a refusal, every event's (#597)", success.length, 1);
    check("  and it hands back the PLAN's offer", success.map((r) => r.event).join(" "), "offered");
    assert(
        "  which is the plan's press or its repair, matched to the submission and never taken from it (#531)",
        /const offered = \[plan\.event, plan\.maySendForRepair \? ASSET_EVENT\.SENT_FOR_REPAIR : null\]\.find\(\s*\(candidate\) => candidate !== null && candidate === event\s*\);/.test(module_.source)
    );
    // The job the event's source names since #598 (`rowJob`): the item's own for every event this
    // reads, `JOB_SOURCE_OF_EVENT`'s answer, which `offline/asset-loan.mjs` holds by value.
    check("  carrying the job its event's source names, the plan's (#597, #598)", success.map((r) => r.jobRecordId).join(" | "), "rowJob(plan, offered)");
    check("  and the job it compares is the drawn one, read by recordingRefusal first", callsTo(readFn, "recordingRefusal").length, 1);
    assert(`  never the submitted one (${returns.length} returns read)`, returns.length >= 3);

    // ── 4: no sentence for a transition that moves the asset (#597) ──────
    // THE ONE PLACE TWO `Job` VALUES MET ON THIS SCREEN WENT WITH #597: the dialog's chosen job
    // and the item's, said apart under the field when a check-out or a check-in would move it. No
    // event a press offers moves an item now, so the sentence and its function are gone.
    log("");
    log("no event the page offers moves the item, and nothing says one would (#597):");
    check("the move notice is gone", `${/export function jobMoveNotice\b/.test(module_.source)} ${"movesJob" in ASSET_TRANSITION_COPY}`, "false false");
    check("  and no pressing helper asks whose job a press takes", /export function pressTakesJob\b/.test(module_.source), false);

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
    check("the terminal sentence, the status itself (#612)", ASSET_TRANSITION_COPY.noTransition, "This item is retired.");
    // THE STALE PRESS IN 1k's WORDS (#463), the person in full, `already` and the moment as
    // a part the page draws in the reader's zone since the design's final files (#495), the
    // noun hyphenated and the verb not.
    check(
        "  the press somebody else's scan got in front of",
        JSON.stringify(ASSET_TRANSITION_COPY.moved({ by: "Jisoo Park", event: ASSET_EVENT.CHECKED_OUT, at: "2026-10-05T13:50:00.000Z", attempted: ASSET_EVENT.CHECKED_OUT })),
        JSON.stringify(["Jisoo Park already checked this out on ", { at: "2026-10-05T13:50:00.000Z" }, ". Your check-out wasn't saved."])
    );
    check(
        "  naming nobody when nobody resolved",
        JSON.stringify(ASSET_TRANSITION_COPY.moved({ by: null, event: ASSET_EVENT.CHECKED_IN, at: "2026-09-25T19:14:00.000Z", attempted: ASSET_EVENT.CHECKED_OUT })),
        JSON.stringify(["Someone else already checked this in on ", { at: "2026-09-25T19:14:00.000Z" }, ". Your check-out wasn't saved."])
    );
    check(
        "  and no entry at all when none was read",
        JSON.stringify(ASSET_TRANSITION_COPY.moved({ attempted: ASSET_EVENT.CHECKED_IN })),
        JSON.stringify(["Someone else scanned this first. Your check-in wasn't saved."])
    );
    check("  nor an event read with its moment", JSON.stringify(ASSET_TRANSITION_COPY.moved({ by: "Jisoo Park", at: "2026-10-05T13:50:00.000Z", attempted: ASSET_EVENT.CHECKED_OUT })), JSON.stringify(["Someone else scanned this first. Your check-out wasn't saved."]));
    check("  that last the one sentence the action answers with", ASSET_TRANSITION_COPY.someoneFirst({ attempted: ASSET_EVENT.CHECKED_IN }), "Someone else scanned this first. Your check-in wasn't saved.");
    // WHETHER THE PRESS IS STILL THE READER'S (#597), Soo's words since #614, which the files draw
    // otherwise: one per cause, each ending on `Nothing was saved.` whatever was pressed.
    check("  an item no longer the reader's", ASSET_TRANSITION_COPY.noPermission, "You no longer have permission to update this item. Nothing was saved.");
    check("  and one moved since the page was drawn", ASSET_TRANSITION_COPY.movedTo({ jobCode: "26-DEMO-02" }), "This item moved to 26-DEMO-02. Nothing was saved.");
    // `kind` is the notes' explanatory word for what separates `Asset Categories` from
    // `Assets` and names no row (#338); `transition` is this issue's, for the
    // act. Neither may reach a screen.
    check("no string says `kind`", strings.filter((s) => /\bkinds?\b/i.test(s)).length, 0);
    check("no string says `transition`", strings.filter((s) => /\btransitions?\b/i.test(s)).length, 0);

    // THE CONTROL IS BUILT FROM THE VOCABULARY, so an event a status can offer
    // cannot arrive without a word for it. That is `summarizeAssetCategories`' argument for
    // drawing every count, and it is the assertion a new event fails. What is offered is the
    // press's event of each status and, since #531, `Sent for repair` from the menu, and since
    // #598 a loan's two from it.
    const offerable = [
        ...new Set([
            ...Object.values(EVENT_OFFERED_BY_STATUS).filter(Boolean),
            ...(Object.values(MAY_SEND_FOR_REPAIR_FROM_STATUS).some(Boolean) ? [ASSET_EVENT.SENT_FOR_REPAIR] : []),
            ...(Object.values(LOAN_MOVES_FROM_STATUS).some(Boolean) ? [ASSET_EVENT.LENT, ASSET_EVENT.RETURNED_TO_OWNER] : []),
        ]),
    ];
    check("the events a person may be offered", offerable.join(" | "), "Checked out | Checked in | Returned from repair | Sent for repair | Lent | Returned to owner");
    const wordless = offerable.filter((e) => !ASSET_TRANSITION_COPY.control[e]);
    check(`every offerable event has a control word${wordless.length ? ` (${wordless})` : ""}`, wordless.length, 0);
    const spare = Object.keys(ASSET_TRANSITION_COPY.control).filter((e) => !offerable.includes(e));
    check(`and no control word for an event no status offers${spare.length ? ` (${spare})` : ""}`, spare.length, 0);
    check("the imperative and not the participle", ASSET_TRANSITION_COPY.control[ASSET_EVENT.CHECKED_OUT], "Check out");
    check("  in both directions", ASSET_TRANSITION_COPY.control[ASSET_EVENT.CHECKED_IN], "Check in");
    assert(
        "  which is not the string the log stores",
        ASSET_TRANSITION_COPY.control[ASSET_EVENT.CHECKED_OUT] !== ASSET_EVENT.CHECKED_OUT
    );
    // WHAT THE DIALOG'S COMMITMENT SAYS WHILE ITS EVENT IS ON ITS WAY (#469), keyed by the
    // event as the control is, so a fifth event cannot arrive without one either: 0f's
    // Working, the control's own verb in its `-ing` form with an ellipsis, the particle kept.
    check("every offerable event has a working word", offerable.filter((e) => !ASSET_TRANSITION_COPY.working[e]).join(", "), "");
    check(
        "  and no working word for an event no status offers",
        Object.keys(ASSET_TRANSITION_COPY.working).filter((e) => !offerable.includes(e)).join(", "),
        ""
    );
    check("a check-out on its way", ASSET_TRANSITION_COPY.working[ASSET_EVENT.CHECKED_OUT], "Checking out…");
    check("  and a check-in", ASSET_TRANSITION_COPY.working[ASSET_EVENT.CHECKED_IN], "Checking in…");
    // WHAT THE LATEST ENTRY DID AND WHAT THE PRESS WAS (#463), keyed by the event as the
    // control is, so a fifth event cannot arrive without them.
    check(
        "every offerable event has an act",
        offerable.filter((e) => !ASSET_TRANSITION_COPY.movedAct[e]).join(", "),
        ""
    );
    // A NOUN FOR THE SCANS ALONE (#531): a refused repair says `Nothing was saved.`, which
    // names no noun the repair has none for.
    check("  and the scans a noun", Object.keys(ASSET_TRANSITION_COPY.eventNoun).join(" | "), "Checked out | Checked in");
    // WHAT GOT IN FRONT WITH NO ENTRY READ (#531), keyed by the press as the act is.
    check(
        "every offerable event says what got in front of it",
        offerable.filter((e) => !ASSET_TRANSITION_COPY.firstAct[e]).join(", "),
        ""
    );
    check(
        "  the scans `scanned this` and the repair's and the loan's `updated this item` (#598, #614)",
        Object.entries(ASSET_TRANSITION_COPY.firstAct).map(([e, act]) => `${e}: ${act}`).join(" | "),
        "Checked out: scanned this | Checked in: scanned this | Sent for repair: updated this item | Returned from repair: updated this item | Lent: updated this item | Returned to owner: updated this item"
    );
    check("  the noun hyphenated, as the design writes it since 2026-10-05", Object.values(ASSET_TRANSITION_COPY.eventNoun).join(" | "), "check-out | check-in");
    check(
        "  and the act a verb with none",
        Object.values(ASSET_TRANSITION_COPY.movedAct).join(" | "),
        "checked this out | checked this in | sent this for repair | returned this from repair | lent this to another job | returned this to its owner"
    );

    // IMPORTED RATHER THAN RE-SPELLED. `Checked out to` is the history entry's word and this
    // control's, so a second copy is a second word for one fact the first time somebody rewords
    // one. The `Job` label and the picker's two were imported beside it until #597 took the job
    // out of the transition, and the no-job sentence was this screen's own until then.
    check("the name's label is the asset page's own", ASSET_TRANSITION_COPY.checkedOutToLabel, ASSET_COPY.checkedOutToLabel);
    check(
        "  and none of the job's words remain (#597)",
        ["jobLabel", "jobUnchosen", "jobNotYours", "jobNoneChosen", "noJob"].filter((key) => key in ASSET_TRANSITION_COPY).join(" | "),
        ""
    );

    // The failure sentence, Soo's since #612: the act is not whole, and doing it again finishes it.
    check("a failed status write, said by value (#612, #614)", ASSET_TRANSITION_COPY.statusNotUpdated, "This wasn't fully saved. Try again to finish.");

    // ── 6: the actions, read off their own call sites ──────────────────────
    log("");
    log("the scan action derives what it writes, and never takes the form's word:");
    const action = parseFile(ACTION);
    const fn = resolveFunction(action.ast, "recordAssetEventAction");
    assert("the action was found", fn !== null);
    const MUST_CALL = [
        "requireUser",
        "getAssetByAssetId",
        "planTransition",
        "readSubmission",
        "readRetirement",
        "writeEvent",
        "createAssetLogEntry",
        "statusAfterEvent",
        "updateAssetCache",
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
    check("the plan reads the stored status", argumentSource(action, "planTransition", "status"), "asset.status");
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
    const written = argumentSource(action, "createAssetLogEntry", "event");
    check("the log row records the event it was handed", written, "event");
    assert("  not the form's", !/formData/.test(String(written)));
    assert("  and not a literal", !/^["']/.test(String(written)));

    // THE STATUS IS THE MAP'S ANSWER AND NEVER A LITERAL, the rule lib/airtable/
    // assets.js states from the other side.
    const cached = argumentSource(action, "updateAssetCache", "status");
    check("the cache takes the map's answer", cached, "statusAfterEvent(event)");
    assert("  rather than a spelled status", !/^["']/.test(String(cached)));

    // AND THE WRITER REFUSES A BLANK, WHICH IS WHERE THE NEVER-BLANK INVARIANT IS
    // ACTUALLY HELD (#363). `createAssetLogEntry` wrote `Job: []` for a missing
    // value, which nothing could reach while every caller resolved a job out of
    // the actor's own assignments; a retirement inherits `Assets."Job"`, a
    // field the schema lets be empty, so the hole became reachable. It throws
    // now, the way `createAssets` does. Read off that module's source, since
    // it imports `lib/airtable/client.js` and this tier cannot load it.
    const writer = parseFile("lib/airtable/assetLog.js");
    // THE THIRD IS THE EVENT, AND A RENAME IS WHY (#455). A key renamed in `ASSET_EVENT` with
    // one call site left behind reads `undefined`, which drops out of the request body —
    // so the no-typecast refusal never fires and the row lands with no `Event`. The
    // writer refuses anything outside the vocabulary, that included.
    for (const [what, guard] of [
        ["a missing job", 'if (!jobRecordId) throw new Error("assetLog: a Job is required");'],
        ["a missing recorder", 'if (!recordedByUserId) throw new Error("assetLog: a Recorded By is required");'],
        ["an event outside the vocabulary, a missing one included", "if (!ASSET_EVENT_VALUES.includes(event)) {"],
    ])
        assert(`the writer throws on ${what}`, writer.source.includes(guard));
    // AND THE VOCABULARY IT ASKS IS THE MODULE'S, not a list spelled beside the guard,
    // which would be the second copy a rename leaves behind.
    assert(
        "  reading the event list from lib/assetStatus.js",
        /import \{[^}]*\bASSET_EVENT_VALUES\b[^}]*\} from "\.\.\/assetStatus"/.test(writer.source)
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
    assert("the log row is written before the cache", callsBefore(writeFn, "createAssetLogEntry", "updateAssetCache"));
    // AND ONLY THE CACHE WRITE IS INSIDE THE TRY. A log write inside it would be
    // swallowed by the same catch and reported as a status that did not move,
    // which is the opposite of what happened.
    const [logCall] = callsTo(writeFn, "createAssetLogEntry");
    const [cacheCall] = callsTo(writeFn, "updateAssetCache");
    assert("the cache write is inside the try", insideTry(writeFn, cacheCall));
    assert("  and the log write is not", !insideTry(writeFn, logCall));

    // ── 6c: each action's own arguments, and what stands after the write ───
    log("");
    log("what each action hands the writer, and what it does with the answer:");
    for (const [name, expectedEvent, reader] of [
        ["recordAssetEventAction", "event", "readSubmission"],
        ["retireAssetAction", "ASSET_EVENT.RETIRED", "readRetirement"],
    ]) {
        const own = resolveFunction(action.ast, name);
        assert(`${name} was found`, own !== null);
        assert(`  it reads its submission with ${reader}`, callsTo(own, reader).length === 1);
        // THE EVENT EACH ONE WRITES, READ OFF ITS OWN CALL. The scan action hands
        // over the identifier the plan produced; the retirement hands over the
        // vocabulary's constant, because there is one direction and nothing to
        // derive. A literal `"Retired"` here would mint an option off the palette
        // the first time somebody mistyped it — which is what `createAssetLogEntry`
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

    // NOTHING BUT THE ASSET'S ID AND THE JOB THE PAGE WAS DRAWN ON CROSS THE WIRE FOR A
    // RETIREMENT. One direction means nothing a stale page could have named wrongly; and the
    // job is the asset's own, so the drawn one is compared and never written (#597).
    const retireFn = resolveFunction(action.ast, "retireAssetAction");
    const retireSource = action.source.slice(retireFn.start, retireFn.end);
    const read = [...retireSource.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]);
    check(`the retirement reads only the asset id and the drawn job off the form (${read.join()})`, read.join(), "assetId,drawnJobId");
    // AND ITS JOB IS THE ASSET'S, READ OFF THE CALL SITE. This is the
    // argument-and-not-the-name assertion for #363's reversal: a form value and the
    // cached link are both "an argument", and only the argument's own source tells them apart.
    check("the retirement's plan is built on the asset's own job", argumentSource({ ast: retireFn, source: action.source }, "planTransition", "assetJobId"), "asset.job?.[0]");
    check(
        "  and the drawn job only compared",
        argumentSource({ ast: retireFn, source: action.source }, "readRetirement", "drawnJobId"),
        'String(formData.get("drawnJobId") ?? "")'
    );
    // A RETIREMENT SOMEBODY GOT IN FRONT OF SAYS `This item is retired.` SINCE #614, the plan's terminal
    // sentence: at a desk its question stands across the page drawn again and says it, on a phone the
    // Notice does. Until #614 it said nothing (#378), the question going with its opener.
    assert(
        "  a terminal refusal said as any other refusal is, the question's or the status's (#614)",
        /if \(refusal\) return refuse\(refusal\);/.test(retireSource) && !/refuse\(null\)/.test(retireSource)
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
    for (const name of ["recordAssetEventAction", "retireAssetAction", "updateAssetNoteAction", "writeEvent"])
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
    // argument to createAssetLogEntry", and only the argument's own source tells
    // them apart. The reader is what normalizes the value and what drops it on a
    // check-in, so a form value reaching the writer directly would write an
    // untrimmed name and would put one on a row that must not carry one.
    log("");
    log("who the asset went to reaches the row through the reader:");
    const submittedName = argumentSource(action, "readSubmission", "checkedOutTo");
    assert(`the form's name reaches the reader (${submittedName})`, /formData/.test(String(submittedName)));
    const handedName = argumentSource(action, "writeEvent", "checkedOutTo");
    check("  and the reader's answer reaches the writer", handedName, "checkedOutTo");
    assert("  never the form's", !/formData/.test(String(handedName)));
    const writtenName = argumentSource(action, "createAssetLogEntry", "checkedOutTo");
    check("  which is what the log row records", writtenName, "checkedOutTo");
    // THE RETIREMENT HANDS OVER NOTHING, which is the same claim from the other
    // side: one direction, no recipient, and no field for a forged submission to
    // fill. Asserted as an absence on ITS OWN call rather than on the module, since
    // the scan action's call is in the same file.
    const retireOwn = resolveFunction(action.ast, "retireAssetAction");
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
    assert("  and to check-outs alone", /\{Event\} = "\$\{formulaString\(ASSET_EVENT\.CHECKED_OUT\)\}"/.test(readerSource));
    assert("  skipping rows that carry no name", /\{Checked Out To\} != ""/.test(readerSource));
    assert("  newest first", /direction: "desc"/.test(readerSource));
    assert("  and capped, which is what keeps it one operation", /maxRecords: RECENT_CHECK_OUT_ROWS/.test(readerSource));

    // ── 6f: a stale press names who recorded first, read as it refuses (#463) ─
    // THE DESIGN'S SENTENCE NAMES THE PERSON AND THE MOMENT (1k), which only the latest entry
    // knows, so the action reads it for the stale refusal and for nothing else — two
    // operations on a path a person meets rarely, and none on any other.
    log("");
    log("a stale press is answered with who recorded first, read off the latest entry:");
    const scanFn = resolveFunction(action.ast, "recordAssetEventAction");
    const scanSource = action.source.slice(scanFn.start, scanFn.end);
    const staleAt = scanSource.indexOf('if (stale) return refuseStale({ asset, refusal, attempted: String(formData.get("event") ?? "") });');
    assert("the scan action answers a stale press through refuseStale, naming the press", staleAt > -1);
    assert("  before any other refusal is said", staleAt > -1 && staleAt < scanSource.indexOf("if (refusal) return refuse(refusal);"));
    const staleFn = resolveFunction(action.ast, "refuseStale");
    assert("refuseStale was found", staleFn !== null);
    assert("  and is not exported, so it is no Server Action", !/export\s+(async\s+)?function\s+refuseStale/.test(action.source));
    const staleSource = staleFn ? action.source.slice(staleFn.start, staleFn.end) : "";
    assert(
        "  it reads the latest row, the link array's last, as one id",
        staleSource.includes("const latestId = asset.assetLog?.at(-1);") &&
            staleSource.includes("getAssetLogByAsset(asset.id, { rowIds: [latestId] })")
    );
    assert("  names who recorded it in full", staleSource.includes("by: actorName(recorder) || null"));
    assert("  hands over the row's own event and moment", staleSource.includes("event: latest.event, at: latest.eventAt ?? null, attempted"));
    check("  and says every answer through refuse", callsTo(staleFn ?? {}, "refuse").length, 3);
    check("  where retireAssetAction asks no such read", callsTo(resolveFunction(action.ast, "retireAssetAction"), "refuseStale").length, 0);

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
        "the plan reads the asset's stored status here too",
        argumentSource(page, "planTransition", "status"),
        "asset.status"
    );
    // BOTH CONTROLS STAND IN THE BRANCH WHERE THERE IS NO REFUSAL, and neither is
    // rendered unconditionally — a page that drew either one for a retired asset
    // would be promising what the action refuses. #363 put a second control in the
    // same branch, so the assertion names both rather than the one that happened to be
    // there. It is a conjunction since #597, when the refusal's own branch went with the
    // sentence it drew for a site manager on no job.
    let guarded = false;
    walk(page.ast, (n) => {
        if (n.type !== "LogicalExpression" || n.operator !== "&&") return;
        const left = page.source.slice(n.left.start, n.left.end);
        const right = page.source.slice(n.right.start, n.right.end);
        if (/^!transition\.refusal && /.test(left) && /TransitionDialog/.test(right) && /MoreActions/.test(right)) guarded = true;
    });
    assert("both controls stand in the branch where there is no refusal", guarded);
    // AND EACH IS THEN ASKED FOR SEPARATELY, because the two answers come from two
    // maps that agree only on today's four statuses. Deriving one control's
    // presence from the other's would be the coincidence lib/assetStatus.js records.
    assert("the transition control is gated on the offered event", /\{transition\.event && <TransitionDialog /.test(page.source));
    // `More actions` holds the retirement beside the transition at a desk, asked of the plan's
    // own answer (#463); on a phone it stands in every top bar, the page's and the one over a
    // code no asset carries, since its menu ends on the account (#495).
    check(
        "  and More actions holds the retirement at a desk on its own answer, and stands in every phone top bar (#495)",
        `${(page.source.match(/\{menuActs && <MoreActions \/>\}/g) ?? []).length} ${(page.source.match(/<MoreActions phone account=\{account\} \/>/g) ?? []).length}`,
        "1 2"
    );
    // A RETIRED ASSET SHOWS NOTHING IN THE ACTIONS' PLACE AT A DESK (1f), and a phone's foot bar
    // says the terminal sentence. NO OTHER PLAN SAYS ONE SINCE #597: the sentence a site manager on
    // no job met there went, since they read the item as anybody does (1f `Another job`, 1j-d).
    assert(
        "  a desk says no plan's sentence in the actions' place (#597)",
        !/\{transition\.refusal\}/.test(page.source) && importedFrom(page, "TRANSITION_COPY") === null
    );
    assert("  the office's acts standing in the one branch, with no sentence beside them (#583, #582)", /const officeActs = office\.mayChangeJob \|\| office\.mayDelete;/.test(page.source));
    // THE TRANSITION IS HANDED THE PLAN THE PAGE REACHED (#458), which its dialog asks
    // `readSubmission` of before it sends — the event the page offered and the jobs it
    // narrowed, never a decision of the dialog's own — and the asset's job so the
    // dialog can say when the two differ. The retirement is handed its category's name, which
    // its question asks with.
    // THE PROVIDER IS HANDED THE PLAN (#463), which both drawings and the question read.
    check("the transition is handed the plan the page reached", attributeSources(page.ast, page.source, "AssetTransition", "plan").join(), "{transition}");
    // AND THE ITEM'S JOB AS THE PAGE WAS DRAWN, which every form posts for the action to compare
    // (#597) — where the dialog was handed the job's code to say a move, which #597 took away.
    check("  and the item's job, as the page was drawn", attributeSources(page.ast, page.source, "AssetTransition", "assetJobRecordId").join(), "{asset.job?.[0] ?? null}");
    check("  and no current job for a move notice", /currentJobCode=\{/.test(page.source), false);
    check("the retirement is handed its category's name", attributeSources(page.ast, page.source, "AssetTransition", "itemName").join(), "{category?.itemName}");

    // ── 7b: what a transition asks before it records (#458) ────────────────
    // A CHECK-OUT RECORDS A NAME, SO IT ALWAYS ASKS; a check-in records on the press — for a
    // person on any number of jobs since #597, where one on several was asked which (1i, gone
    // from the files of 2026-11-02). It is #376's name rule, held by value, and the component is
    // held to asking it.
    log("");
    log("a transition asks first only what the page cannot know:");
    const outOnOne = planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.OUT, assetJobId: JOB_A.id });
    const inStockOnTwo = planTransition({ user: actor(JOB_A, JOB_B), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_A.id });
    check("a check-out asks, on one job", asksBeforeRecording(inStock), true);
    check("  and on several", asksBeforeRecording(inStockOnTwo), true);
    check("a check-in on one job records on the press", asksBeforeRecording(outOnOne), false);
    check("  and on several too, since #597", asksBeforeRecording(out), false);

    const dialog = parseFile(DIALOG);
    const form = parseFile(FORM);
    const dialogFn = functionNamed(dialog.ast, "TransitionDialog");
    const formFn = functionNamed(form.ast, "TransitionForm");
    assert("the transition and its dialog were found", Boolean(dialogFn && formFn));
    const dialogSource = dialog.source.slice(dialogFn.start, dialogFn.end);
    const formSource = form.source.slice(formFn.start, formFn.end);
    check("it asks that of the plan it was handed", callArguments(dialogFn, dialog.source, "asksBeforeRecording").join(" | "), "plan");
    // THE PRESS POSTS NO JOB TO WRITE SINCE #597, where it posted the one job a person on one
    // held: the item's job as the page was drawn, which the action compares and never writes.
    check("  and the press posts the asset, the job the page was drawn on and the event", attributeSources(dialogFn, dialog.source, "input", "value").join(" | "), '{assetId} | {drawnJobId ?? ""} | {plan.event}');
    check("  and no job of its own choosing", initSource(dialogFn, dialog.source, "one"), null);
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
    const submitSource = initSource(formFn, form.source, "submit") ?? "";
    assert("its submit prevents the default", /event\.preventDefault\(\)/.test(submitSource));
    assert(
        "  reads what it would send with readSubmission, the drawn job among it and no job to write (#597)",
        /readSubmission\(plan, \{[\s\S]*formData\.get\("event"\)[\s\S]*formData\.get\("drawnJobId"\)[\s\S]*formData\.get\("checkedOutTo"\)[\s\S]*\}\)/.test(submitSource) &&
            !/formData\.get\("jobId"\)/.test(submitSource)
    );
    const refusesAt = submitSource.indexOf("if (answer.refusal) {");
    assert("  and sends only after that refuses nothing", refusesAt > -1 && refusesAt < submitSource.indexOf("onSend(formData)"));
    // A REFUSED PRESS IS SAID FIELD BY FIELD AND TAKES FOCUS TO THE FIRST (#522): 1i draws the
    // commitment live, 0l answers a press on an incomplete form in each missing field's place,
    // and 1k-b draws the caret in the refused field.
    assert(
        "  a refused press marks the event pressed and hands its form to the refusal focus, before it returns (#522)",
        /if \(answer\.refusal\) \{\s*setPressedFor\(plan\.event\);\s*focusRefused\(event\.currentTarget\);\s*return;\s*\}/.test(submitSource)
    );
    check("  the focus is the controls' one rule for it (#522)", initSource(formFn, form.source, "focusRefused"), "useRefusalFocus()");
    check("the frame submits through it", attributeSources(formFn, form.source, "DialogFrame", "onSubmit").join(), "{submit}");
    // NOTHING IN IT IS DISABLED (#469, #522): the frame's `busy` draws the commitment's Working
    // and locks `Cancel`, and since #522 the commitment acts whatever is chosen — 1i draws it
    // live and 0l says a commitment stays live while the form is incomplete — where it was held
    // at 0f's 40% until `readSubmission` took what was chosen.
    check("the commitment is never disabled, as 1i and 0l draw it (#522)", attributeSources(formFn, form.source, "Button", "disabled").length, 0);
    check(
        "  and gives way to its event's working word while it sends",
        attributeSources(formFn, form.source, "Button", "busyLabel").join(" | "),
        "{COPY.working[plan.event]}"
    );
    check("its field refusal is fieldRefusals of its name, as the foot bar's is (#522, #597)", initSource(formFn, form.source, "refusals"), "fieldRefusals(plan, { checkedOutTo: name })");
    check(
        "  said under its field once a press asked for this event (#522)",
        attributeSources(formFn, form.source, "Field", "refusal").join(" | "),
        "{pressed ? refusals.nameRefusal : null}"
    );
    check("  where pressed is a press for the event offered now (#522)", initSource(formFn, form.source, "pressed"), "pressedFor === plan.event");
    let trims = 0;
    for (const each of [dialog, form]) {
        walk(each.ast, (n) => {
            if (n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.object?.name === "name" && n.callee.property?.name === "trim") trims++;
        });
    }
    check("no rule of the dialog's own, and no required attribute either", `${trims} ${attributeCount(dialog.ast, "required") + attributeCount(form.ast, "required")}`, "0 0");
    // THE DIALOG IS A CHECK-OUT'S ALONE SINCE #597 — a check-in asks nothing — so its one field,
    // the name, stands in it whatever else, and nothing about a job does: no choice, no sheet to
    // choose from, no start for one, no move notice under it.
    assert(
        "the name's two controls stand in the dialog",
        /<Field label=\{COPY\.checkedOutToLabel\}[^>]*>/.test(formSource) && /<NameSheet\b/.test(formSource)
    );
    check("  and nothing of a job (#597)", /\bChoice\b|JobSheet|chosenJobId|onlyJob|jobMoveNotice|jobLabel|plan\.jobs/.test(dialog.source + form.source), false);
    check("  the recent names are the item's job's", callArguments(formFn, form.source, "recentNamesFor").join(), "recentCheckOuts, { jobCode: plan.jobCode }");

    // ── 7d: open while it is what the page offers, and where a refusal stands ─
    log("");
    log("the dialog is open while the page still offers what it opened for:");
    // THE OPEN RULE AND THE ANSWER ARE THE PROVIDER'S SINCE #463, which both drawings read.
    const provider = parseFile(PROVIDER);
    const providerFn = functionNamed(provider.ast, "AssetTransition");
    assert("the provider was found", providerFn !== null);
    const providerSource = providerFn ? provider.source.slice(providerFn.start, providerFn.end) : "";
    // THE DIALOG STANDS UNTIL THE READER CLOSES IT (#614), whatever the page drawn again offers: a
    // landing's redirect throws the page's state away, the opening with it, and a refusal re-renders
    // in place (#378) under a dialog that says it. Until #614 the opening ended with the event it was
    // opened for, and its sentence moved under the status.
    check("open while the opening stands, whatever the page drawn again offers (#614)", initSource(providerFn ?? {}, provider.source, "open"), "openedFor !== null");
    assert(
        "  and only the reader's close ends it (#614)",
        (providerSource.match(/setOpenedFor\(null\)/g) ?? []).length === 1 && /onClose=\{\(\) => setOpenedFor\(null\)\}/.test(providerSource)
    );
    assert("  holding the one answer both drawings read", providerSource.includes("const [answer, formAction, pending] = useActionState(recordAssetEventAction, null);"));
    // A REFUSAL IS THE ACTION'S LAST ANSWER, read as it is: a press that lands leaves no
    // answer behind it to hide, since its redirect throws the state away. A stale one is
    // turned into 1k's sentence in the reader's zone; any other is the action's sentence.
    const sentenceFn = functionNamed(provider.ast, "useRefusalSentence");
    const sentenceSource = sentenceFn ? provider.source.slice(sentenceFn.start, sentenceFn.end) : "";
    assert(
        "a refusal is the action's last answer, a stale one drawn with its moment in the reader's zone, inside the sentence (#495)",
        /if \(answer\.moved\) \{\s*return COPY\.moved\(answer\.moved\)\.map\(\(part, index\) =>\s*typeof part === "string" \? <Fragment key=\{index\}>\{part\}<\/Fragment> : <Instant key=\{index\} at=\{part\.at\} sentence \/>/.test(
            sentenceSource
        ) && /return answer\.error \?\? null;/.test(sentenceSource)
    );
    check("  which the provider reads for the dialog, the toast and the status (#614)", initSource(providerFn, provider.source, "transitionSentence"), "useRefusalSentence(answer)");
    const refusalFile = parseFile(REFUSAL);
    // WHAT STANDS UNDER THE STATUS IS THE PROVIDER'S TO SAY SINCE #583, which holds both answers:
    // the one sent last, unless a dialog of its own says it.
    assert(
        "a refusal stands under the status unless the desk's dialog that sent it or its toast says it (#614)",
        /event: eventSaidInDialog \|\| eventVia === "desk" \? null : transitionSentence,/.test(provider.source) &&
            /const eventSaidInDialog = open && eventVia === "dialog" && eventSentFor === opening;/.test(provider.source) &&
            /statusSentence: said\[lastSent \?\? "event"\],/.test(provider.source) &&
            /const transitionSentence = useRefusalSentence\(answer\);/.test(provider.source) &&
            /const \{ statusSentence: sentence \} = useAssetTransition\(\);\s*if \(!sentence\) return null;/.test(refusalFile.source)
    );
    check(
        "  as a phone's notice alone, a desk saying it in the dialog or the toast (#614)",
        `${!/<Refusal\b/.test(refusalFile.source)} ${/<div className="mt-mobile-title-alert-stack sm:hidden">\s*<Notice>\{sentence\}<\/Notice>/.test(refusalFile.source)}`,
        "true true"
    );
    check("  and above the dialog's actions while the opening that sent it stands (#614)", attributeSources(providerFn, provider.source, "TransitionForm", "refusal").join(), "{eventSaidInDialog ? transitionSentence : null}");
    check("  which the frame says there", attributeSources(formFn, form.source, "DialogActions", "refusal").join(), "{refusal}");
    check(
        "the dialog is a sheet below the phone's edge and busy while it sends",
        `${attributeSources(formFn, form.source, "DialogFrame", "sheet").join()} ${attributeSources(formFn, form.source, "DialogFrame", "busy").join()}`,
        "true {pending}"
    );
    check("  and nothing behind it closes it, since it holds what was typed", attributeSources(formFn, form.source, "DialogFrame", "closesOnBackdrop").length, 0);
    check("each opening starts from what the plan hands it", attributeSources(providerFn, provider.source, "TransitionForm", "key").join(), "{opening}");
    // A PAGE DRAWN AGAIN ON ANOTHER JOB ENDS EVERY OPENING A READER RECORDS FROM (#597), so a press
    // refused because the item moved is said under the status whichever control sent it.
    assert(
        "a page drawn on another job ends a phone's openings alone — the retirement's, a loan's two, the note's and the serial number's — and a desk's stand (#597, #598, #601, #614)",
        /if \(drawnOn !== assetJobRecordId\) \{\s*setDrawnOn\(assetJobRecordId\);\s*for \(const each of \[retiring, lending, returning\]\) if \(phone\(each\)\) each\.end\(\);\s*if \(note\.openOn === "phone"\) note\.end\(\);\s*if \(serial\.openOn === "phone"\) serial\.end\(\);\s*\}/.test(providerSource)
    );

    // ── 7e: each width asks in its own drawing (#458) ──────────────────────
    // AT A DESK the name is the registration's combobox (1b), its suggestions the item's job's
    // recent names under the name sheet's own head; BELOW THE PHONE'S EDGE it is a field that
    // opens 1j's name sheet. One state behind both, so what the sheet chose is what the dialog
    // sends. The job was 0a's choice at a desk and a field opening 1j's job sheet below the edge
    // until #597.
    log("");
    log("each width asks in its own drawing, from one state:");
    assert("at a desk the name is the registration's combobox, drawn only from the phone's edge up", /<div className="max-sm:hidden">\s*<Combobox\s+name="checkedOutTo"/.test(formSource));
    check(
        "  headed with the name sheet's own words while nothing is typed (#495)",
        attributeSources(formFn, form.source, "Combobox", "heading").join(),
        "{namesAreRecent(name) ? COPY.recentHeading : undefined}"
    );
    check("below it the field opens 1j's name sheet", attributeSources(formFn, form.source, "SheetField", "onOpen").join(" | "), "{() => setNaming(true)}");
    check("  open only while the dialog is", attributeSources(formFn, form.source, "NameSheet", "open").join(" | "), "{open && naming}");
    check(
        "the names offered are one list on both widths, each with what is typed marked (#495)",
        `${attributeSources(formFn, form.source, "Combobox", "suggestions").join()} | ${attributeSources(formFn, form.source, "NameSheet", "names").join()}`,
        "{offered.map((person) => ({ label: person, match: matchedPart(person, name) }))} | {offered}"
    );
    check("  narrowed and cut by offeredNames", initSource(formFn, form.source, "offered"), "offeredNames(recent, name)");
    check("  out of the item's job's recent names (#597)", initSource(formFn, form.source, "recent"), "recentNamesFor(recentCheckOuts, { jobCode: plan.jobCode })");
    check("one value behind the field and its sheet", `${attributeSources(formFn, form.source, "Combobox", "onChange").join()} ${attributeSources(formFn, form.source, "NameSheet", "onChange").join()}`, "{setName} {setName}");

    // ── 7f: the phone's foot bar, which asks the same reader (#463) ───────
    // 1j's FOOT BAR KEEPS ITS PRESS AND ANSWERS UNDER ITS FIELD (1k): what a submission may be
    // is `readSubmission` before anything is sent, the field refusal is `fieldRefusals`, and it
    // shows once a press asked for that event. The bar is busy while it sends and never
    // disabled, and since #597 asks no job: its pill and the job sheet went (1j-a).
    log("");
    log("the phone's foot bar asks the same reader and answers under its fields:");
    const bar = parseFile(BAR);
    const barFn = functionNamed(bar.ast, "TransitionBar");
    assert("the foot bar was found", barFn !== null);
    const barSource = barFn ? bar.source.slice(barFn.start, barFn.end) : "";
    const barSubmit = initSource(barFn ?? {}, bar.source, "submit") ?? "";
    assert(
        "its submit reads what it would send with readSubmission, the drawn job among it and no job to write (#597)",
        /readSubmission\(plan, \{[\s\S]*formData\.get\("event"\)[\s\S]*formData\.get\("drawnJobId"\)[\s\S]*formData\.get\("checkedOutTo"\)[\s\S]*\}\)/.test(barSubmit) &&
            !/formData\.get\("jobId"\)/.test(barSubmit)
    );
    const barRefusesAt = barSubmit.indexOf("if (answer.refusal) {");
    assert("  and sends only after that refuses nothing, said to be a phone's (#614)", barRefusesAt > -1 && barRefusesAt < barSubmit.indexOf('send(formData, "phone")'));
    assert(
        "  a refused press hands its form to the refusal focus, so the first refused field takes it (1k-b, #522)",
        /if \(answer\.refusal\) \{\s*setPressedFor\(plan\.event\);\s*focusRefused\(event\.currentTarget\);\s*return;\s*\}/.test(barSubmit)
    );
    check("  the bar's focus is the controls' one rule for it (#522)", initSource(barFn ?? {}, bar.source, "focusRefused"), "useRefusalFocus()");
    check("its field refusal is fieldRefusals of its name (#597)", initSource(barFn ?? {}, bar.source, "refusals"), "fieldRefusals(plan, { checkedOutTo: name })");
    check(
        "  said under its field once a press asked for this event",
        attributeSources(barFn ?? {}, bar.source, "Field", "refusal").join(" | "),
        "{pressed ? refusals.nameRefusal : null}"
    );
    check("  where pressed is a press for the event offered now", initSource(barFn ?? {}, bar.source, "pressed"), "pressedFor === plan.event");
    check("its press submits, is never disabled, and says its event's working word", `${attributeSources(barFn ?? {}, bar.source, "Button", "type").join()} ${attributeSources(barFn ?? {}, bar.source, "Button", "disabled").length} ${attributeSources(barFn ?? {}, bar.source, "Button", "busyLabel").join()}`, '"submit" 0 {COPY.working[plan.event]}');
    check("  at the phone's size", attributeSources(barFn ?? {}, bar.source, "Button", "size").join(), '"xl"');
    check("  while what it holds is busy with it, or locked while the menu's sending is on its way (#531)", attributeSources(barFn ?? {}, bar.source, "FormBusy", "busy").join(), '{repairPending ? "action" : pending}');
    check("it holds no job: no pill, no job sheet, no choice to keep (#597)", /SheetChip|JobSheet|chosenJobId|onlyJob|jobMoveNotice|plan\.jobs/.test(bar.source), false);
    check("  the names the item's job's", callArguments(barFn ?? {}, bar.source, "recentNamesFor").join(), "recentCheckOuts, { jobCode: plan.jobCode }");
    check("its name field opens the name sheet", attributeSources(barFn ?? {}, bar.source, "SheetField", "onOpen").join(), "{() => setNaming(true)}");
    assert("  the name asked only of a check-out", /\{asksName && \(\s*<Field label=\{COPY\.checkedOutToLabel\}/.test(barSource) && /\{asksName && \(\s*<NameSheet/.test(barSource));
    check("with nothing to record it says the plan's refusal in the press's place", /\{plan\.refusal\}<\/p>/.test(barSource), true);
    check("  drawn below the phone's edge alone", attributeSources(barFn ?? {}, bar.source, "BottomBar", "phoneOnly").join(" | "), "true | true");
    // WHAT A DESK'S DIALOG WAS GIVEN COMES TO THE BAR WHEN THE WINDOW CROSSES INTO IT (#495):
    // the frame closes a dialog its page stops drawing, the dialog hands its name to the
    // provider first, and the bar takes each handing-over once, as its own. Its job went with it
    // until #597.
    check(
        "a desk's dialog the frame closes undrawn carries its name (#495, #597)",
        `${attributeSources(formFn, form.source, "DialogFrame", "onHidden").join()} | ${attributeSources(providerFn, provider.source, "TransitionForm", "onCarry").join()}`,
        "{() => onCarry({ name })} | {({ name }) => setCarried({ name })}"
    );
    check("  which the provider keeps, a new object each time", /onCarry=\{\(\{ name \}\) => setCarried\(\{ name \}\)\}/.test(provider.source), true);
    assert(
        "  and the bar takes each handing-over once, as its own name",
        /if \(carried !== taken\) \{\s*setTaken\(carried\);\s*if \(carried\) setName\(carried\.name\);\s*\}/.test(barSource)
    );

    // ── 8: retiring — the second answer the plan carries (#363) ────────────
    log("");
    log("which statuses offer a retirement, and to whom:");
    check("a stocked asset may be retired", inStock.mayRetire, true);
    check("one that is out may be too", out.mayRetire, true);
    // THE `Out` CASE IS COVERED HERE RATHER THAN IN A BROWSER, and that is a
    // conclusion rather than a shortcut: the page renders both controls under one
    // test on `refusal` and never reads the status, so `In stock` and `Out` take a
    // provably identical path. Retiring a second asset to watch it would have
    // recorded a check-out that never happened.
    check(
        "and the two are offered on identical terms",
        `${inStock.mayRetire}|${inStock.refusal}|${out.mayRetire}|${out.refusal}`,
        "true|null|true|null"
    );
    check("a retired one may not be retired again", retired.mayRetire, false);
    check("  and somebody on no job may not retire at all", noJob.mayRetire, false);
    check("  nor a site manager on another job (#597)", planTransition({ user: actor(JOB_B), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_A.id }).mayRetire, false);

    log("");
    log("and where a retirement's job comes from, which is not the actor:");
    // THE ROW INHERITS THE ASSET'S OWN JOB. Taking the actor's would write a
    // site the asset had never been on — measured on this base before the branch
    // merged, where `HYE-TL-260909-004`, `HYE-AST-260909-004` since #513, was checked in on one job and retired on
    // another. `Recorded By` is what answers who did it.
    const goodRetire = readRetirement(out, { drawnJobId: JOB_B.id });
    check("it passes", goodRetire.refusal, null);
    check("  and hands back the asset's own job", goodRetire.jobRecordId, JOB_B.id);
    // THE ACTOR'S ASSIGNMENTS DO NOT CHOOSE IT, which is the assertion with teeth: the plan was
    // built for somebody on JOB_A and JOB_B with the item on JOB_B, and the answer is JOB_B
    // because that is where the asset is, not the first of theirs.
    check("  never the actor's first", readRetirement(inStock, { drawnJobId: JOB_A.id }).jobRecordId, JOB_A.id);

    // A refused plan refuses whatever it is handed, which is also how a stale page
    // is answered: somebody who retired this first makes the fresh plan terminal.
    check("a retired asset refuses", readRetirement(retired, { drawnJobId: JOB_A.id }).jobRecordId, null);
    check("  in the plan's own words", readRetirement(retired, { drawnJobId: JOB_A.id }).refusal, retired.refusal);
    // WHETHER THE PRESS IS STILL THE READER'S, before the status (#597, #614): a site manager not on
    // its job is told they may not, and a page drawn on the job it has left where it is now.
    check("and a reader the item's job is not one of is refused, told they may not", readRetirement(noJob, { drawnJobId: JOB_A.id }).refusal, "You no longer have permission to update this item. Nothing was saved.");
    check("  and a page drawn on the job it left", readRetirement(movedOn, { drawnJobId: JOB_A.id }).refusal, "This item moved to 26-DEMO-02. Nothing was saved.");
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
    check("the opener names its object", ASSET_TRANSITION_COPY.retireOpener, "Retire this item");
    const heading = ASSET_TRANSITION_COPY.retireHeading({ itemName: "DEMO Rotary Hammer", assetId: "HYE-AST-261001-022" });
    check("the title asks and names the asset", heading, "Retire DEMO Rotary Hammer?");
    check(
        "  and an asset whose tool did not resolve is named by its id",
        ASSET_TRANSITION_COPY.retireHeading({ itemName: undefined, assetId: "HYE-AST-261001-022" }),
        "Retire HYE-AST-261001-022?"
    );
    check("the confirm names what it retires", ASSET_TRANSITION_COPY.retireSubmit, "Retire item");
    check("  and says the verb alone, -ing, while it is on its way (#469)", ASSET_TRANSITION_COPY.retireWorking, "Retiring…");
    check("and the way out is the app's own word", ASSET_TRANSITION_COPY.cancel, "Cancel");
    // THE OPENER AND THE TRANSITION CONTROL MAY NOT READ ALIKE, which is half of
    // what keeps a once-ever act from looking like a dozens-a-day one. The other
    // half is what each opens, asserted on the components below.
    assert(
        "the opener does not read like the transition control",
        ASSET_TRANSITION_COPY.retireOpener !== ASSET_TRANSITION_COPY.control[ASSET_EVENT.CHECKED_OUT] &&
            ASSET_TRANSITION_COPY.retireOpener.includes("this item")
    );
    // THE BODY IS AN ACCOUNT OF WHAT THE ACT ENDS, which `_shared.md` names as the point
    // of a confirmation and 0l's Confirm asks for: the design's sentence (1f, 1j).
    const body = ASSET_TRANSITION_COPY.retireBody;
    check(
        "the sentence is the design's",
        body,
        "It will be removed from inventory, and no more check-outs or check-ins can be recorded. This can't be undone."
    );
    // IT ASKS FOR NO REASON, which is the rule #363 retired rather than
    // implemented. A field for one would be the first thing to come back, so the
    // absence is asserted rather than left to be noticed.
    const retireStrings = [ASSET_TRANSITION_COPY.retireOpener, heading, body];
    check("no word of it asks for a reason", retireStrings.filter((s) => /\breasons?\b/i.test(s)).length, 0);
    check("  and none asks for a note", retireStrings.filter((s) => /\bnotes?\b/i.test(s)).length, 0);

    // THE TRANSITION'S OWN WORDS SINCE #458: the field's example and the name sheet's,
    // which are the design's (1f, 1j), and the missing-name refusal, which is 1k's.
    check("the name field's example", ASSET_TRANSITION_COPY.namePlaceholder, "e.g. Jane Doe");
    check("the head of the recent names, on both widths", ASSET_TRANSITION_COPY.recentHeading, "Recently at this job");
    check("the name sheet's end", ASSET_TRANSITION_COPY.sheetDone, "Done");
    check("  and the name of its clear mark", ASSET_TRANSITION_COPY.clearName, "Clear");
    check("a check-out with no name is answered in the desk dialog's words, at both widths (#612)", ASSET_TRANSITION_COPY.nameRequired, "Enter a name.");

    // THE TERMINAL SENTENCE WIDENED WITH THE SCREEN. #362 wrote it as
    // `no check-out or check-in to record`, which enumerated two of three absent
    // controls once a retire control stood beside them.
    // AND SINCE #463 IT NAMES NO STATUS EITHER: the status stands directly above it.
    // SINCE #612 IT IS THE STATUS ITSELF, Soo's: the design's `Nothing more can be recorded
    // here.` stopped being true once the page it stands on writes the item's serial number
    // and note in every status, so the sentence says what the item is and nothing of what
    // may still be written — no negation, no act and no measure of what is left, any of
    // which would read as covering the two lines above it.
    const terminal = ASSET_TRANSITION_COPY.noTransition;
    check(
        "the terminal sentence says the item is retired (#612)",
        new RegExp(`\\bis ${ASSET_STATUS.RETIRED}\\.$`, "i").test(terminal),
        true
    );
    check("  and claims no end, beside the serial number and note that still write", CLAIMS_AN_END.test(terminal), false);
    check(
        "  the words a claim takes are seen in the sentences it replaced",
        ["Nothing more can be recorded here.", "No more check-outs or check-ins can be recorded.", "This item is retired and can't be edited."].filter((s) => CLAIMS_AN_END.test(s)).length,
        3
    );

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
        "{COPY.retireHeading({ itemName, assetId })} | {assetId}"
    );
    check(
        "  a sheet that confirms below the phone's edge, which a press behind it closes there",
        `${attributeSources(confirm.ast, confirm.source, "DialogFrame", "sheet").join()} ${attributeSources(confirm.ast, confirm.source, "DialogFrame", "closesOnBackdrop").join()}`,
        "true true"
    );
    // THE PROVIDER'S WAIT SINCE #597, which holds the retirement's answer as it holds the deletion's.
    check("  and nothing closes it while it sends", attributeSources(confirm.ast, confirm.source, "DialogFrame", "busy").join(), "{busy}");
    check(
        "its commitment is filled red and submits, beside a way out",
        attributeSources(confirm.ast, confirm.source, "Button", "variant").join(" | "),
        '"bordered" | "danger"'
    );
    check("  the commitment the submit", attributeSources(confirm.ast, confirm.source, "Button", "type").join(), '"submit"');
    check("  giving way to its working word while it sends", attributeSources(confirm.ast, confirm.source, "Button", "busyLabel").join(), "{COPY.retireWorking}");
    check("  and neither button disabled for the sending (#469)", attributeSources(confirm.ast, confirm.source, "Button", "disabled").join(" | "), "");
    // IT SENDS THROUGH THE PROVIDER SINCE #597, which holds the answer the question went with
    // until then, so a retirement refused because the item is no longer the reader's is said under
    // the status after the question has gone.
    check("  which sends through the provider's one answer", `${callsTo(confirm.ast, "send").length} ${callsTo(confirm.ast, "useActionState").length}`, "1 0");
    assert(
        "  the provider holding it, said in the question while the opening that sent it stands",
        /const \[retireAnswer, retireFormAction, retirePending\] = useActionState\(retireAssetAction, null\);/.test(provider.source) &&
            /const retiring = useOpening\(retireAnswer, retirePending\);/.test(provider.source) &&
            /refusal=\{retiring\.said \? retireSentence : null\}/.test(provider.source) &&
            /retire: retiring\.said \? null : retireSentence,/.test(provider.source)
    );
    assert(
        "  and a phone's opening the plan or its answer ends counts as a new one, so its answer moves under the status (#614)",
        /if \(phone\(retiring\) && \(!plan\.mayRetire \|\| retiring\.answered\)\) retiring\.end\(\);/.test(provider.source) &&
            /end: \(\) => \{\s*setOn\(null\);\s*setCount\(\(n\) => n \+ 1\);\s*\},/.test(provider.source)
    );
    check("neither file draws on the old frame", [confirm, opener].filter((f) => /modalStyles/.test(f.source)).length, 0);
    check("the question is the provider's, opened from either More actions", `${attributeSources(provider.ast, provider.source, "RetirementConfirm", "open").join()} ${attributeSources(provider.ast, provider.source, "RetirementConfirm", "onClose").join()}`, "{retiring.on !== null} {retiring.close}");
    // THE WAY OUT IS ONE WORD ON ALL THREE DIALOGS — the check-out's and the check-in's,
    // which are one component, and the retirement's — read off the button that says it,
    // since the value alone holds whatever the screens print in its place.
    check(
        "the way out says it on all three dialogs",
        [form, confirm].map((f) => /<Button variant="bordered"[^>]*>\s*\{COPY\.cancel\}\s*<\/Button>/.test(f.source)).join(" "),
        "true true"
    );
    // IT TAKES NO INPUT AT ALL, which is two decisions rather than one. No reason
    // — the rule requiring one was retired with its field. And no job — the row
    // inherits the asset's own, as every event's does since #597.
    assert("it asks for no reason field", !/textarea/i.test(confirm.source));
    assert("  and offers no job control", !/<Choice|<select|<SheetField|<JobSheet/.test(confirm.source));
    assert("  nor a hidden job to write", !/name="jobId"/.test(confirm.source));
    assert("  nor a label for one", !/COPY\.jobLabel|COPY\.jobUnchosen/.test(confirm.source));
    // It posts which asset, and the asset's job as the page was drawn (#597), which the action
    // compares and never writes — so it has nothing to trust but the id it looks up.
    check("it posts the asset id and the job the page was drawn on", [...confirm.source.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).join(), "assetId,drawnJobId");
    // A MENU ITEM BEHIND `More actions` (#463), the design's place for an act a scan is not
    // for: 0f's Destructive, saying the opener's words, and handing focus to its button before
    // the question opens, so every way out of the question comes back to the button.
    check("the opener is a menu button named More actions", `${attributeSources(opener.ast, opener.source, "button", "aria-haspopup").join()} ${attributeSources(opener.ast, opener.source, "button", "aria-label").join()}`, '"menu" {word}');
    check("  its name the copy's own", initSource(opener.ast, opener.source, "word"), "ASSET_COPY.moreActions");
    assert("  its retirement item the opener's words, a destructive one", /label: ASSET_TRANSITION_COPY\.retireOpener,\s*tone: "danger",/.test(opener.source));
    assert(
        "  which hands focus to its button before the question opens",
        /buttonRef\.current\?\.focus\(\);\s*setOpen\(false\);\s*transition\.openRetirement\(phone \? "phone" : "desk"\);/.test(opener.source)
    );
    // ON A PHONE THE MENU ENDS ON THE ACCOUNT (#495), under a rule when the retirement stands
    // above it and alone when the record takes no action, and the retirement is offered only
    // where the plan allows it — the screen of a code no asset carries has no plan at all.
    assert(
        "  the retirement offered only where the plan allows it, with no plan at all read as none (#495)",
        /const mayRetire = Boolean\(transition\?\.plan\.mayRetire\);/.test(opener.source) && /\.\.\.\(mayRetire\s*\?/.test(opener.source)
    );
    assert(
        "  and a phone's menu ending on the account, its email the detail, posting the sign-out (#495)",
        /\.\.\.\(phone && account\s*\?/.test(opener.source) &&
            /label: NAVIGATION_COPY\.account\.signOut,\s*detail: account\.email,\s*separated: true,\s*type: "submit",\s*form: formId,/.test(opener.source) &&
            /\{phone && account && <form id=\{formId\} action="\/api\/auth\/logout" method="POST" hidden \/>\}/.test(opener.source)
    );
    // AND THE TRANSITION'S DIALOG ASKS FOR NO JOB SINCE #597, where it kept its job choice because
    // a scan was the actor handling the asset: an item records on the job it sits on now.
    assert("the transition's dialog keeps no job choice (#597)", !/<Choice\b|name="jobId"/.test(dialog.source + form.source));

    // ── 10b: 1j's name sheet, the part a foot bar opens (#458) ─────────────
    // DRAWN AS 1j DRAWS IT AND OPENED BY WHATEVER ASKS FOR A NAME — the check-out's dialog and
    // #463's foot bar. So what is held is what it asks of its opener and does with an answer,
    // and that it closes on a press behind it as 1j draws. 1j's job sheet stood beside it until
    // #597 took the job out of the transition, and its file with it.
    log("");
    log("1j's name sheet is a part any opener can open:");
    const nameSheet = parseFile(NAME_SHEET);
    check("the job sheet is gone (#597)", existsSync(new URL("../../../app/(assets)/assets/[assetId]/JobSheet.js", import.meta.url)), false);
    // Its handle closes it as every sheet's does, which is the frame's since #580 and
    // `offline/sheet-drag.mjs`'s to hold.
    check(
        "the name sheet closes on a press behind it, and ends in Done",
        ["sheet", "closesOnBackdrop", "done"].map((a) => attributeSources(nameSheet.ast, nameSheet.source, "DialogFrame", a).join()).join(" | "),
        "true | true | {{ label: COPY.sheetDone, onPress: onClose }}"
    );
    // ITS FIELD IS `SheetInput` SINCE THE NOTE SHEET TYPED INTO ONE TOO (#533): the sheet hands it
    // the opener's value and change, `onClose` as its done key, and the clear mark's name, and
    // the part holds the look, the done key, the clear mark and the keystrokes.
    const controls = parseFile("app/components/Controls.js");
    const sheetInputNode = resolveFunction(controls.ast, "SheetInput");
    const sheetInput = sheetInputNode ? controls.source.slice(sheetInputNode.start, sheetInputNode.end) : "";
    check(
        "  its field the one field in a sheet, handed what it types into and how it ends",
        ["value", "onChange", "onDone", "label", "clearLabel"].map((a) => attributeSources(nameSheet.ast, nameSheet.source, "SheetInput", a).join()).join(" | "),
        "{value} | {onChange} | {onClose} | {COPY.checkedOutToLabel} | {COPY.clearName}"
    );
    assert("  the field filled, with an Accent caret", /bg-mobile-input-background/.test(sheetInput) && /caret-primary/.test(sheetInput));
    assert("  the keyboard's done key ends it", /if \(event\.key !== "Enter"\) return;\s*event\.preventDefault\(\);\s*if \(!locked\) onDone\(\);/.test(sheetInput));
    assert(
        "  with a clear mark once it holds a value, named for a screen reader — the field's own clear (#605)",
        /\{clearable && <FieldClear look="sheet" label=\{clearLabel\} onChange=\{onChange\} focus=\{\(\) => ref\.current\?\.focus\(\)\} \/>\}/.test(sheetInput) &&
            /const clearable = Boolean\(value\) && !locked;/.test(sheetInput)
    );
    assert("  every keystroke handed back to the opener", /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/.test(sheetInput));
    // THE ROWS STAND ONLY UNDER A HEAD, AND THE HEAD IS THE LIST'S JUDGMENT (#589). Before a
    // job is chosen and on a job with no recent names the list's space is empty, and the head
    // says what the rows are — `offline/name-sheet-list.mjs` holds the five states by value and
    // the space's one height. Until #589 the head and its rows went when a typed name matched
    // none, and a job with none said so in a sentence of its own.
    assert("  the rows absent on a job with no recent names, under the list's head", /const rows = head \? names : \[\];/.test(nameSheet.source) && /\{rows\.length > 0 && \(\s*<SheetRows\s+rows=\{rows\.map\(/.test(nameSheet.source));
    assert("  the head the list's judgment, `nameListHead`, over the rows (#589)", /const head = nameListHead\(\{ hasRecent, typed: value, offered: names \}\);/.test(nameSheet.source) && /\{head && \(\s*<p[^>]*>\s*\{head\}/.test(nameSheet.source));
    assert("  and no sentence of the list's own besides its head (#589)", !/<p[^>]*>\s*\{COPY\.\w+\}\s*<\/p>/.test(nameSheet.source));
    assert("  and each row marking what is typed (#495)", /match: matchedPart\(name, value\),/.test(nameSheet.source));
    assert("  and a name picked is the opener's and puts the sheet away", /onChange\(name\);\s*onClose\(\);/.test(nameSheet.source));
    check("it draws on no old frame", /modalStyles/.test(nameSheet.source), false);
    // AND THE FOOT BAR OPENS IT AS IT IS (#463), which is what #458 built it for.
    check("the foot bar opens it, as it is", attributeSources(barFn ?? {}, bar.source, "NameSheet", "open").join(), "{naming}");

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // THE ARGUMENT READER IS SHOWN TELLING THE THREE SHAPES APART on planted
    // source, because "it read `event`" and "it read nothing and returned the
    // expected string by accident" are not distinguishable from a PASS. This is
    // the mutation the four assertions above are written against, run in-file.
    {
        const planted = parseSource(
            'createAssetLogEntry({ event: String(formData.get("event") ?? "") });\n' +
                'updateAssetCache({ status: "Out" });\n' +
                "planTransition({ status: submittedStatus });\n",
            "<planted-swap>"
        );
        check("  a form-fed event reads as the form's", argumentSource(planted, "createAssetLogEntry", "event"), 'String(formData.get("event") ?? "")');
        check("  a spelled status reads as a literal", argumentSource(planted, "updateAssetCache", "status"), '"Out"');
        check("  and a submitted status is not the stored one", argumentSource(planted, "planTransition", "status"), "submittedStatus");
    }
    // A missing property has to read as MISSING rather than as the expected value,
    // or every argument assertion passes on a call that dropped the field.
    check("  a call with no such property reads null", argumentSource(parseSource("f({ other: 1 });", "<planted>"), "f", "status"), null);
    // The ordering reader is shown saying NO on the reversed pair.
    {
        const reversed = parseSource(
            "async function a() { await updateAssetCache({}); await createAssetLogEntry({}); }",
            "<planted-order>"
        );
        assert("  a reversed pair reads as reversed", !callsBefore(resolveFunction(reversed.ast, "a"), "createAssetLogEntry", "updateAssetCache"));
    }
    // The copy scanner is seen finding a planted bare noun, since zero is also what
    // a broken matcher reports.
    assert("the noun matcher finds `tool item`", TOOL_ITEM_NOUN.test("Retire this tool item?"));
    assert("  and passes the design's `tool`", !TOOL_ITEM_NOUN.test(ASSET_TRANSITION_COPY.retireOpener) && !TOOL_ITEM_NOUN.test(heading));
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
        planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.IN_STOCK, assetJobId: JOB_A.id }).event !==
            planTransition({ user: actor(JOB_A), jobs: ALL_JOBS, status: ASSET_STATUS.OUT, assetJobId: JOB_A.id }).event
    );
}

if (isMain(import.meta.url)) await standalone(title, run);

// Registering tool items — the pure half (#338).
//
// WHAT THIS FILE IS FOR. `lib/toolRegistration.js` holds one judgment that two
// readers reach independently: the dialog previews whether a typed name names a
// tool that already exists, and the action decides whether to create a second
// `Tools` row. If those two ever disagree, the screen tells somebody they are
// adding to an existing tool while the write coins a new one — and nothing
// fails, because the two answers are never compared at runtime. So the key is
// one function and this file pins it. **Since #456 the same holds for what a
// submission may be**: the dialog refuses it before sending anything and the action
// refuses it again, both through `readRegistration`, which is pinned here by value.
//
// THE JOB RULE IT USED TO PIN IS `offline/tool-job.mjs`'s SINCE #363, and so is
// the deliberate disagreement with `lib/deliveryAccess.js:accessibleJobs`.
// `assignedJobsFor` left `lib/toolRegistration.js` when the retirement made it
// three write paths' rule rather than this screen's. What section 4 keeps is
// `canRegisterToolItems`, which really is this dialog's own question.
//
// WHAT IT CANNOT SEE. Whether Airtable agrees. The lookup this key stands in for
// is `LOWER(TRIM({Tool Name})) = LOWER(TRIM(…))`, and that comparison lives in a
// credentialed module — this tier never loads `lib/airtable/`. #338 measured the
// live behavior read-only (Airtable's `=` is CASE-SENSITIVE, and neither form
// collapses an internal whitespace run) and that measurement is in
// `docs/notes/tools.md` and in `getToolByName`'s own header. Nothing here can
// re-measure it, and a green run is not evidence that the two halves match.
//
// It also cannot see rendering, which is this tier's standing limit: that the
// preview, the suggestions and the dialog itself reach a browser at all is checked
// with a real session and recorded in the pull request.
//
// AND SINCE #449 IT HOLDS WHERE A REGISTRATION LANDS, in the same two halves. What
// the dialog opens at and what a landing's account reads as are pure, held by value
// at their edges. Where the action sends the person — which record, which page,
// which tool items selected and what account beside them — is in a module this tier
// cannot load (the action reaches lib/airtable/), and naming the calls would be
// satisfied by every wrong version of them, so the redirect's ARGUMENTS and the
// dialog's submission are read off the AST, each beside a planted file doing it
// wrong. **This said the two failures themselves could never be run here, and #470
// made that false**: a batch that stops short and a log pass that stops are still
// unreachable without breaking the base, but what decides their account is
// `lib/airtableBatch.js` now, which imports nothing — so section 9 runs a
// registration's two passes against a fake base and reads the landing they produce,
// and section 8 holds that the action and the two writers are wired the way section 9
// assumes.
//
// AND SINCE #459 WHICH PART OF A LANDING'S ACCOUNT IS TOLD, by value: each part is a
// dialog, one at a time and the notice first, while the page found it and its key is
// still on the address. What each dialog does with the answer is read off the source in
// `offline/tool-list-view.mjs`, beside the rest of the page.
//
// AND SINCE #455 THE WORDS ARE THE DESIGN'S, pinned by value — `tool` for what the act
// makes, and the act `add` since #485 where #455 made it `create` — and since #456 the
// dialog's own words with them. The scanner that failed a bare `item` here went with the
// rule it held: that rule was the tools area's stricter reading of #303, and the design
// reversed it. What replaces it is the sweep's own claim, that no string in the constant
// says `tool item`. `offline/tool-screen-words.mjs` holds the verb across every tools
// screen.
//
// AND SINCE #469 WHAT THE COMMITMENT SAYS: the count it will add, by value through the
// reading the press makes, and `Adding…` while it sends — read off the dialog as the
// expressions that decide them, with no button disabled for the sending. What the frame
// does with its busy state is `offline/dialog-frame.mjs`'s.
//
// AND SINCE #485 HOW MANY THE FORK'S ANSWER OFFERS: the count not written, which is also
// the count the dialog it opens starts at — by value here, through `openingCount`, and in
// what a failed batch leaves on its landing (section 9). That the fork hands the one value
// to both is `offline/tool-list-view.mjs`'s, off the source.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { normalizeItemText } from "../../../lib/itemNaming.js";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    MAX_TOOL_SUGGESTIONS,
    TOOL_REGISTRATION_COPY,
    accountToTell,
    canRegisterToolItems,
    matchExistingTool,
    openingCount,
    readQuantity,
    readRegistration,
    readRegistrationAccount,
    suggestTools,
    toolNameKey,
} from "../../../lib/toolRegistration.js";
import { TOOL_JOB_COPY } from "../../../lib/toolJob.js";
import { toolPath } from "../../../lib/toolRoutes.js";
import { createInBatches } from "../../../lib/airtableBatch.js";
import { childKind, formatSequentialIds, nextChildId } from "../../../lib/idSequence.js";
import { callsTo, insideTry, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { fakeBase } from "./_fakeBase.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title =
    "Registering tool items — the pure half, where a registration lands, and what a failed batch makes of it (#338, #449, #455, #456, #459, #469, #470, #485)";

/** The action whose redirect section 8 reads, and the dialog whose submission it reads. */
const ACTION = "app/(tools)/tools/actions.js";
const DIALOG = "app/(tools)/tools/RegistrationDialog.js";
/** The two writers a registration calls, whose wiring section 8 reads (#470). */
const TOOL_ITEMS = "lib/airtable/toolItems.js";
const TOOL_LOG = "lib/airtable/toolLog.js";

/** A builder's parts (#456) as the one string a reader sees. */
const joined = (parts) => parts.map((part) => (typeof part === "string" ? part : part.emphasis)).join("");

/** Every string the copy constant can produce, builders called with real input. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(TOOL_REGISTRATION_COPY)) {
        if (typeof value === "string") out.push(value);
    }
    out.push(joined(TOOL_REGISTRATION_COPY.matchesExisting({ toolName: "Impact Driver", items: "13 items" })));
    out.push(TOOL_REGISTRATION_COPY.quantityHelp(100));
    out.push(TOOL_REGISTRATION_COPY.quantityInvalid(100), TOOL_REGISTRATION_COPY.quantityTooMany(100));
    out.push(TOOL_REGISTRATION_COPY.submit(null), TOOL_REGISTRATION_COPY.submit(1), TOOL_REGISTRATION_COPY.submit(5));
    out.push(TOOL_REGISTRATION_COPY.shortfallHeading({ created: 3, asked: 5 }));
    for (const n of [1, 4]) {
        out.push(TOOL_REGISTRATION_COPY.shortfall(n), TOOL_REGISTRATION_COPY.registerOthers(n));
        out.push(TOOL_REGISTRATION_COPY.unloggedHeading(n), TOOL_REGISTRATION_COPY.unlogged(n));
    }
    return out;
}

/** `tool.id` for a member read, the bare name for an identifier, else the node's type. */
function nameOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) return `${nameOf(node.object)}.${node.property.name}`;
    return node?.type ?? "none";
}

/**
 * The noun the design replaced (#455), in any number and case.
 *
 * WHAT IT REPLACED IS THE OPPOSITE RULE. This file failed a bare `item` until #455, as
 * the tools area's reading of #303; the design put `item` on a tool's own page and
 * `tool` in every sentence about one, so what a string here may no longer say is the
 * noun it used to require.
 */
const TOOL_ITEM_NOUN = /\btool items?\b/i;

export async function run({ check, assert, log }) {
    // ── 1: two spellings of one name are one key ────────────────────────────
    log("one tool name, however it is typed:");
    const canonical = toolNameKey("Impact Driver");
    for (const [what, typed] of [
        ["the same string", "Impact Driver"],
        ["lowercased", "impact driver"],
        ["uppercased", "IMPACT DRIVER"],
        ["with outer space", "  Impact Driver  "],
        ["with a doubled internal space", "Impact  Driver"],
        ["with a tab inside", "Impact\tDriver"],
        ["all four at once", "  impact \t driver "],
    ])
        check(`  ${what}`, toolNameKey(typed), canonical);

    // The other half of #18's split, and the reason the key is not the stored
    // value: case is fixed in the COMPARISON and never in what is written, because
    // the stored string is the only copy of what somebody typed.
    check(
        "the stored value keeps its case",
        normalizeItemText("  DeWalt  20V   SDS-Max "),
        "DeWalt 20V SDS-Max"
    );
    assert(
        "  so the key and the stored value are not the same string",
        toolNameKey("DeWalt 20V") !== normalizeItemText("DeWalt 20V")
    );

    // ── 2: the preview finds what the write would find ──────────────────────
    log("");
    log("the dialog's preview and the write reach one verdict:");
    const tools = [
        { id: "recA", toolName: "Impact Driver" },
        { id: "recB", toolName: "Angle Grinder" },
    ];
    check("a differently cased name matches", matchExistingTool("IMPACT driver", tools)?.id, "recA");
    check("  and one with extra spacing", matchExistingTool(" Angle  Grinder ", tools)?.id, "recB");
    check("a name nothing holds matches nothing", matchExistingTool("Rotary Hammer", tools), null);
    check("an empty name matches nothing", matchExistingTool("   ", tools), null);
    check("and no list matches nothing", matchExistingTool("Impact Driver", []), null);

    // ── 2b: what a partly typed name suggests (#456) ────────────────────────
    // THE DESIGN'S RULE, AT ITS EDGES: every tool whose name holds what is typed, on the
    // write's own key, in the list's order, five at most — and none for a name typed in
    // full, which the preview answers instead. The five is pinned first, because the
    // edge below is its.
    log("");
    log("a partly typed name suggests the tools whose names hold it, five at most:");
    check("the most a name suggests", MAX_TOOL_SUGGESTIONS, 5);
    const shelf = [
        { toolName: "Angle Grinder 4\"", count: 4 },
        { toolName: "Band Saw", count: 2 },
        { toolName: "Chop Saw, 14\"", count: 3 },
        { toolName: "Core Drill", count: 2 },
        { toolName: "Cordless Drill, DeWalt", count: 13 },
        { toolName: "Magnetic Drill", count: 3 },
        { toolName: "Pipe Cutter, Hydraulic", count: 2 },
        { toolName: "Plasma Cutter", count: 1 },
        { toolName: "Rotary Hammer Drill", count: 1 },
        { toolName: "Torque Wrench", count: 7 },
    ];
    const names = (typed) => suggestTools(typed, shelf).map((tool) => tool.toolName).join(" | ");
    check("a word inside names, in the list's order", names("saw"), "Band Saw | Chop Saw, 14\"");
    check("  whatever its case and spacing", names("  CHOP   saw "), "Chop Saw, 14\"");
    check(
        "  and no more than five of the six it holds",
        names("r"),
        "Angle Grinder 4\" | Core Drill | Cordless Drill, DeWalt | Magnetic Drill | Pipe Cutter, Hydraulic"
    );
    check("a name typed in full suggests nothing", names("band saw"), "");
    check("  nor does nothing typed", names("   "), "");
    check("  nor a word no tool holds", names("chainsaw"), "");
    // The count each suggestion says is its own, handed through untouched.
    check("each suggestion keeps its count", suggestTools("cordless", shelf)[0]?.count, 13);

    // ── 3: how many one submission may write ───────────────────────────────
    log("");
    log("the quantity, and the ceiling one invocation can carry:");
    check("a plain 1", readQuantity("1").count, 1);
    check("  and the ceiling itself", readQuantity(String(MAX_TOOL_ITEMS_PER_REGISTRATION)).count, MAX_TOOL_ITEMS_PER_REGISTRATION);
    for (const [what, raw] of [
        ["nothing", ""],
        ["only spaces", "   "],
        ["zero", "0"],
        ["a negative", "-4"],
        ["a fraction", "1.5"],
        ["a word", "six"],
    ])
        check(`  ${what} is refused with the range`, `${readQuantity(raw).count} ${readQuantity(raw).refusal}`, "null Enter 1 to 100.");
    check(
        "  and one over the ceiling with the ceiling alone",
        `${readQuantity(String(MAX_TOOL_ITEMS_PER_REGISTRATION + 1)).count} ${readQuantity(String(MAX_TOOL_ITEMS_PER_REGISTRATION + 1)).refusal}`,
        "null Max 100 at a time."
    );
    // THE WAY OUT IS IN THE WORDS: the ceiling is on one submission, so the refusal says
    // `at a time`, and the find-or-create path lands the rest under the same tool.
    assert("the ceiling refusal says the rest can follow", TOOL_REGISTRATION_COPY.quantityTooMany(100).includes("at a time"));

    // ── 4: who may use this dialog at all ──────────────────────────────────
    // THE JOB RULE ITSELF MOVED TO `offline/tool-job.mjs` IN #363, with the
    // function it is about: three write paths read it now, so a check named for
    // this screen was asserting about a module the other two would not think to
    // look in. What stays here is this dialog's own question — whether the person
    // in front of it may use it — which is `canRegisterToolItems` and nothing
    // else, and which every opener asks (#456).
    log("");
    log("whether this person may use the dialog:");
    const jobs = [
        { id: "job1", jobCode: "26-DEMO-01" },
        { id: "job2", jobCode: "26-DEMO-02" },
    ];
    const onOne = { assignedJobs: ["job2"], isAdmin: false, role: "Employee" };
    const adminOnNone = { assignedJobs: [], isAdmin: true, role: "Employee" };
    const presidentOnNone = { assignedJobs: [], isAdmin: false, role: "President" };

    check("an Admin on no job may not register", canRegisterToolItems(adminOnNone, jobs), false);
    check("a President on no job may not either", canRegisterToolItems(presidentOnNone, jobs), false);
    check("an Employee on one job may", canRegisterToolItems(onOne, jobs), true);
    check("and neither may somebody with no user at all", canRegisterToolItems(undefined, jobs), false);

    // ── 5: the copy ────────────────────────────────────────────────────────
    log("");
    log("every word a registration can say:");
    const strings = copyStrings();
    assert(`the constant yielded ${strings.length} strings`, strings.length > 20);
    check("none is empty", strings.filter((s) => !s || !s.trim()).length, 0);
    check(
        "none renders `undefined` or `NaN` from a builder",
        strings.filter((s) => /undefined|NaN/.test(s)).length,
        0
    );
    // THE SWEEP'S CLAIM (#455): the design's noun is `tool`, so nothing here says the
    // one it replaced. The whole constant, builders called, rather than a list of keys —
    // a key added later is held without anybody remembering to name it.
    const oldNoun = strings.filter((s) => TOOL_ITEM_NOUN.test(s));
    check(
        `no string says \`tool item\`${oldNoun.length ? ` (${JSON.stringify(oldNoun[0])})` : ""}`,
        oldNoun.length,
        0
    );
    // THE FORM'S OWN ACCOUNT IS GONE (#449), AND THE ADDRESS'S OPENER WITH IT (#456): a
    // registration lands on its tool's page, whose selection names every id it wrote, and
    // a tool's own page opens the dialog in its title rather than in words of its own.
    check(
        "no word is left for the form's own account or the address's own opener",
        ["registered", "ids", "shortCount", "registerMore", "quantityMissing", "quantityNotWhole"]
            .filter((key) => key in TOOL_REGISTRATION_COPY)
            .join(", "),
        ""
    );
    // THE DESIGN'S WORDS, BY VALUE (#455, #456), AND THE ACT'S VERB `add` (#485). The title
    // is also the list's and a tool's page's opener, so the three are one string; the submit
    // names what it adds.
    check("the title, which both openers that begin a registration say", TOOL_REGISTRATION_COPY.heading, "Add tools");
    check("  the line under it, opened on no tool", TOOL_REGISTRATION_COPY.intro, "Each one gets its own ID and label.");
    check("  the name's label", TOOL_REGISTRATION_COPY.nameLabel, "Tool name");
    check("  and its placeholder", TOOL_REGISTRATION_COPY.namePlaceholder, "e.g. Impact Driver, Milwaukee");
    check("  the count's label", TOOL_REGISTRATION_COPY.quantityLabel, "Quantity");
    check("  and its help", TOOL_REGISTRATION_COPY.quantityHelp(100), "Up to 100");
    check("  the job's label", TOOL_REGISTRATION_COPY.jobLabel, "Job");
    check("  and its choice left empty, the picker's own word", TOOL_REGISTRATION_COPY.jobUnchosen, TOOL_JOB_COPY.unchosen);
    // THE SUBMIT NAMES WHAT IT MAKES BY ITS COUNT (#469, 1j) — and only a count the press
    // takes: the dialog hands it `readQuantity`'s count for what the field holds, so the
    // words over a count the press would refuse say the act alone, as 1j's Refused does.
    check("  the submit, for one", TOOL_REGISTRATION_COPY.submit(1), "Add 1 tool");
    check("  for several", TOOL_REGISTRATION_COPY.submit(5), "Add 5 tools");
    check("  at the ceiling", TOOL_REGISTRATION_COPY.submit(100), "Add 100 tools");
    check("  and over a count the press would refuse", TOOL_REGISTRATION_COPY.submit(null), "Add tools");
    for (const [raw, expected, why] of [
        ["1", "Add 1 tool", "  the field's 1, read as the press reads it"],
        [" 12 ", "Add 12 tools", "  a dozen, its spaces trimmed as the press trims them"],
        ["100", "Add 100 tools", "  the ceiling, typed"],
        ["", "Add tools", "  nothing typed"],
        ["0", "Add tools", "  zero"],
        ["101", "Add tools", "  one past the ceiling"],
        ["140", "Add tools", "  1j's refused 140"],
    ])
        check(why, TOOL_REGISTRATION_COPY.submit(readQuantity(raw).count), expected);
    check("  and while it is on its way, 0f's -ing word with no count", TOOL_REGISTRATION_COPY.working, "Adding…");
    check("  and the way out", TOOL_REGISTRATION_COPY.cancel, "Cancel");
    // THE PREVIEW (#456): a tool that exists, with its count in the words its own page
    // heads its list with, and a name that coins one.
    check(
        "the preview for a tool that exists",
        joined(TOOL_REGISTRATION_COPY.matchesExisting({ toolName: "Impact Driver", items: "13 items" })),
        "Adds to Impact Driver, which already has 13 items"
    );
    check(
        "  with the tool and its count as the parts the note sets in Ink",
        TOOL_REGISTRATION_COPY.matchesExisting({ toolName: "T", items: "N" })
            .filter((part) => typeof part !== "string")
            .map((part) => part.emphasis)
            .join(", "),
        "T, N"
    );
    check("  and for one that does not", TOOL_REGISTRATION_COPY.newTool, "Creates a new tool");
    // EACH FIELD'S REFUSAL, AND THE ONE ABOUT THE WHOLE DIALOG (#456).
    check("a name left empty", TOOL_REGISTRATION_COPY.nameMissing, "Enter a tool name.");
    check("  a count out of range", TOOL_REGISTRATION_COPY.quantityInvalid(100), "Enter 1 to 100.");
    check("  a count past the ceiling", TOOL_REGISTRATION_COPY.quantityTooMany(100), "Max 100 at a time.");
    check("  a job not chosen, the picker's own word", TOOL_REGISTRATION_COPY.jobNoneChosen, TOOL_JOB_COPY.noneChosen);
    check("  a job not the reader's, the picker's own word", TOOL_REGISTRATION_COPY.jobNotYours, TOOL_JOB_COPY.notYours);
    check("nothing written", TOOL_REGISTRATION_COPY.noneWritten, "Couldn't add the tools. Try again.");
    check("why an opener cannot act, for a reader on no job", TOOL_REGISTRATION_COPY.noJob, "Ask the office to assign you to a job");
    // WHAT A REGISTRATION SAYS WHERE IT LANDS, pinned by value. The fork's title, its one
    // sentence and its two answers, one going on and one stopping — and the notice, whose
    // one control dismisses it and repairs nothing, because nothing repairs what it names.
    // Each is a dialog since #459, and each sentence is 1k's as far as it goes: what 1k
    // adds about the ones that were added is the selection's to say (#321). The answer that
    // goes on names how many are left since #485, and says `more` at one as at two.
    check("the fork's title", TOOL_REGISTRATION_COPY.shortfallHeading({ created: 3, asked: 5 }), "3 of 5 tools added");
    check("  its sentence", TOOL_REGISTRATION_COPY.shortfall(2), "2 couldn't be added.");
    check("  at one", TOOL_REGISTRATION_COPY.shortfall(1), "1 couldn't be added.");
    check("  the answer that goes on, naming how many are left", TOOL_REGISTRATION_COPY.registerOthers(2), "Add 2 more");
    check("  and that answer at one", TOOL_REGISTRATION_COPY.registerOthers(1), "Add 1 more");
    check("  and the one that stops", TOOL_REGISTRATION_COPY.doneRegistering, "Not now");
    check("the notice's title", TOOL_REGISTRATION_COPY.unloggedHeading(2), "2 tools have no creation date");
    check("  at one", TOOL_REGISTRATION_COPY.unloggedHeading(1), "1 tool has no creation date");
    check(
        "  its sentence, which says that nothing repairs it",
        TOOL_REGISTRATION_COPY.unlogged(2),
        "Only the creation date wasn't saved for these 2, and it can't be added later."
    );
    check(
        "  at one",
        TOOL_REGISTRATION_COPY.unlogged(1),
        "Only the creation date wasn't saved for this one, and it can't be added later."
    );
    check("  and the control that takes it away", TOOL_REGISTRATION_COPY.gotIt, "Got it");
    // 1k'S TWO CONFIRMATIONS ARE NOT TAKEN, and a sweep that took the design's words whole
    // would bring them in: where the created ones are, and that all were created.
    check(
        "  no sentence says where the created ones are or that all were",
        copyStrings().filter((s) => /saved and selected|work as usual/.test(s)).join(" | "),
        ""
    );

    // ── 6: what the dialog opens at, and what a submission is (#449, #456) ────
    log("");
    log("the dialog opens on a count its submit would take, and one reading refuses a submission:");
    // THE CEILING IS PINNED FIRST, because the edge below is its: 100 opens as itself and
    // 101 at one only while one submission may write a hundred.
    check("one submission writes at most", MAX_TOOL_ITEMS_PER_REGISTRATION, 100);
    check("the offer's count opens as itself", openingCount(4), 4);
    check("  and the ceiling does", openingCount(100), 100);
    for (const [raw, why] of [
        [undefined, "nothing handed over — the list's and a tool's page's"],
        [101, "one over the ceiling"],
        [0, "zero"],
        [2.5, "a fraction"],
        ["four", "a word"],
    ])
        check(`  ${why} opens at one`, openingCount(raw), 1);
    // THE FORK'S ANSWER NAMES THE COUNT ITS DIALOG OPENS AT (#485). The fork hands both the
    // count not written — `offline/tool-list-view.mjs` reads that off the source — so over
    // every count a shortfall can carry, from one to one short of the ceiling, the words, the
    // count the dialog starts at and the commitment it then shows name one number.
    for (const [unwritten, expected, why] of [
        [1, "Add 1 more → Add 1 tool", "the fork's answer names the count its dialog opens at, at the smallest shortfall"],
        [2, "Add 2 more → Add 2 tools", "  at 1k's two"],
        [99, "Add 99 more → Add 99 tools", "  and at the largest a shortfall can carry"],
    ])
        check(
            why,
            `${TOOL_REGISTRATION_COPY.registerOthers(unwritten)} → ${TOOL_REGISTRATION_COPY.submit(readQuantity(String(openingCount(unwritten))).count)}`,
            expected
        );

    const reading = (submitted, offered = jobs) => JSON.stringify(readRegistration(submitted, offered));
    const good = { toolName: "  Impact Driver ", quantity: "5", jobId: "job2" };
    check(
        "a submission it takes is the trimmed name, the count and the job",
        reading(good),
        JSON.stringify({ registration: { toolName: "Impact Driver", count: 5, job: jobs[1] } })
    );
    check("a reader on no job is refused the whole registration", reading(good, []), JSON.stringify({ error: TOOL_REGISTRATION_COPY.noJob }));
    check("  a name of nothing under the name", reading({ ...good, toolName: "   " }), JSON.stringify({ fields: { toolName: "Enter a tool name." } }));
    check("  a count past the ceiling under the count", reading({ ...good, quantity: "140" }), JSON.stringify({ fields: { quantity: "Max 100 at a time." } }));
    check("  no job chosen under the job", reading({ ...good, jobId: "" }), JSON.stringify({ fields: { jobId: TOOL_JOB_COPY.noneChosen } }));
    check("  a job not the reader's under the job", reading({ ...good, jobId: "job9" }), JSON.stringify({ fields: { jobId: TOOL_JOB_COPY.notYours } }));
    check(
        "  and every field at once, as the design draws them",
        Object.keys(JSON.parse(reading({ toolName: "", quantity: "", jobId: "" })).fields).join(", "),
        "toolName, quantity, jobId"
    );
    // WHAT A FORM HANDS OVER IS `FormData.get`'s: a missing key is null, never a crash.
    check(
        "  a field the form never sent reads as missing",
        Object.keys(JSON.parse(reading({ toolName: null, quantity: null, jobId: null })).fields).join(", "),
        "toolName, quantity, jobId"
    );

    // ── 7: what a landing's account reads as (#449) ─────────────────────────
    log("");
    log("a registration's landing carries what it could not show, and nothing it cannot have:");
    // A SHORTFALL IS A PAIR SINCE #455: how many were asked for, and how many of those
    // were not written. `1 ≤ unwritten < asked ≤ the ceiling`, read as one value, since
    // `3 of 5 tools added` is false the moment either half is.
    const accountOf = (asked, unwritten) => {
        const account = readRegistrationAccount({ asked, unwritten });
        return `${account.asked}/${account.unwritten}`;
    };
    check("five asked, two not written", accountOf("5", "2"), "5/2");
    check("  the smallest shortfall there is, one of two", accountOf("2", "1"), "2/1");
    check("  and the largest, one written of the most one submission asks for", accountOf("100", "99"), "100/99");
    for (const [asked, unwritten, why] of [
        ["5", "5", "none written, which stays in the dialog rather than landing,"],
        ["5", "0", "none unwritten, which is no shortfall,"],
        ["5", "6", "more unwritten than asked for"],
        ["101", "100", "more asked for than one submission may write"],
        ["1", "1", "one asked for and not written"],
        [undefined, "2", "a count with nothing asked beside it"],
        ["5", undefined, "an asked with no count"],
        ["5", "1.5", "a fraction"],
        ["five", "2", "a word"],
        [["5"], "2", "a repeated key"],
        ["5", ["2"], "  and a repeated count"],
    ])
        check(`  ${why} offers nothing`, accountOf(asked, unwritten), "0/0");
    check(
        "the unlogged ids read as the selection does, canonical and each once",
        readRegistrationAccount({
            unlogged: ["hye-tl-260928-014", "HYE-TL-260928-014 ", "HYE-TL-260928-015"],
        }).unlogged.join(),
        "HYE-TL-260928-014,HYE-TL-260928-015"
    );
    check("  one as a string", readRegistrationAccount({ unlogged: "HYE-TL-260928-014" }).unlogged.join(), "HYE-TL-260928-014");
    check("  and none as none", readRegistrationAccount({}).unlogged.length, 0);
    // THE WRITE AND THE READ AGREE: what `toolPath` puts on a landing is what this takes
    // off it, and the selection beside it comes through untouched.
    const landed = new URLSearchParams(
        toolPath("recAbc", 2, ["HYE-TL-260928-014", "HYE-TL-260928-015"], {
            asked: 5,
            unwritten: 3,
            unlogged: ["HYE-TL-260928-015"],
        }).split("?")[1]
    );
    const readBack = readRegistrationAccount({
        asked: landed.get("asked"),
        unwritten: landed.get("unwritten"),
        unlogged: landed.getAll("unlogged"),
    });
    check(
        "  a landing toolPath writes reads back as the same account",
        `${readBack.asked} ${readBack.unwritten} ${readBack.unlogged.join()}`,
        "5 3 HYE-TL-260928-015"
    );
    check("  beside the same selection", landed.getAll("id").join(), "HYE-TL-260928-014,HYE-TL-260928-015");

    // ── 7b: which part of it is told, one at a time (#459) ───────────────────
    log("");
    log("a landing's account is told a part at a time, the notice first, while its key stands:");
    // THE ACCOUNT IS WHAT THE PAGE READ AND THE ADDRESS IS AS IT STANDS NOW. Both parts
    // are asked of each: a part is told only while the page found it and its key is still
    // on the address, which each answer edits by deleting its own keys and no others.
    const both = { asked: 5, unwritten: 2, unlogged: ["HYE-TL-260928-015"] };
    const shortfallOnly = { ...both, unlogged: [] };
    const unloggedOnly = { ...both, asked: 0, unwritten: 0 };
    const nothing = { asked: 0, unwritten: 0, unlogged: [] };
    const addressOf = (query) => new URLSearchParams(query);
    const full = "id=HYE-TL-260928-014&asked=5&unwritten=2&unlogged=HYE-TL-260928-015";
    check("both on a landing: the notice first", accountToTell(both, addressOf(full)), "unlogged");
    check(
        "  and once `Got it` takes `unlogged` out, the fork",
        accountToTell(both, addressOf("id=HYE-TL-260928-014&asked=5&unwritten=2")),
        "shortfall"
    );
    check(
        "  and once `Not now` takes the fork's two out as well, nothing",
        accountToTell(both, addressOf("id=HYE-TL-260928-014")),
        null
    );
    // Each answer is independent: taking the fork's keys out first leaves the notice.
    check(
        "  the fork's keys gone and the notice's standing still tells the notice",
        accountToTell(both, addressOf("id=HYE-TL-260928-014&unlogged=HYE-TL-260928-015")),
        "unlogged"
    );
    check("a shortfall alone is the fork", accountToTell(shortfallOnly, addressOf(full)), "shortfall");
    check("unlogged tools alone are the notice", accountToTell(unloggedOnly, addressOf(full)), "unlogged");
    check("an account with nothing in it tells nothing, whatever the address says", accountToTell(nothing, addressOf(full)), null);
    check(
        "  and a key the page did not find, a forged count, is not a part either",
        accountToTell(readRegistrationAccount({ asked: "5", unwritten: "5" }), addressOf("asked=5&unwritten=5")),
        null
    );
    // ANTI-VACUITY: the order is seen to be a choice rather than an accident of the input —
    // with the notice's part empty the same address tells the fork, so "unlogged" above
    // is the notice winning over a fork that was there to be told.
    assert(
        "  the fork is told on the same address once the notice's part is empty",
        accountToTell(both, addressOf(full)) !== accountToTell(shortfallOnly, addressOf(full))
    );

    // ── 8: where the action sends the person, and how the dialog submits (#449, #456) ─
    log("");
    log("a registration that wrote anything lands on its tool, and one that did not stays in the dialog:");
    const landingFacts = (ast) => {
        const facts = { found: false, redirects: 0, returns: [], toolFrom: null, unloggedFrom: null, readFrom: null };
        const action = resolveFunction(ast, "registerToolItemsAction");
        if (!action) return facts;
        facts.found = true;
        walk(action, (n) => {
            // `const { tool } = await upsertTool(…)` — where the record id comes from.
            if (n.type === "VariableDeclarator" && n.id?.type === "ObjectPattern") {
                const init = n.init?.type === "AwaitExpression" ? n.init.argument : n.init;
                if (n.id.properties.some((p) => p.key?.name === "tool")) facts.toolFrom = nameOf(init?.callee ?? {});
            }
            // `const reading = readRegistration({ … }, jobs)` — what the submission is read by,
            // and the list its job is admitted from.
            if (n.type === "VariableDeclarator" && n.id?.name === "reading" && n.init?.type === "CallExpression")
                facts.readFrom = `${nameOf(n.init.callee)}(…, ${nameOf(n.init.arguments[1] ?? {})})`;
            if (n.type === "VariableDeclarator" && n.id?.name === "jobs" && n.init) {
                const init = n.init.type === "AwaitExpression" ? n.init.argument : n.init;
                if (init?.type === "CallExpression") facts.jobsFrom = nameOf(init.callee);
            }
            if (n.type === "ReturnStatement" && n.argument?.type === "ObjectExpression")
                facts.returns.push(n.argument.properties.map((p) => p.key?.name).join("+"));
            if (n.type === "ReturnStatement" && n.argument?.type === "Identifier") facts.returns.push(n.argument.name);
            // #470: `const { unlogged } = await createFirstToolLogEntries(…)` — whose answer
            // the landing's unlogged names are. Until then it was a list a catch pushed into.
            if (n.type === "VariableDeclarator" && n.id?.type === "ObjectPattern" && n.id.properties.some((p) => p.key?.name === "unlogged")) {
                const init = n.init?.type === "AwaitExpression" ? n.init.argument : n.init;
                facts.unloggedFrom = nameOf(init?.callee ?? {});
            }
        });
        // #470: WHAT THE LOG PASS IS HANDED — the tool items `createToolItems` answered with,
        // the chosen job and the reader — read off the one call, and where it stands. The
        // event it writes is the writer's own since #470, read in the writers' block below.
        const logCall = callsTo(action, "createFirstToolLogEntries")[0];
        const logArgument = (name) => nameOf(logCall?.arguments[0]?.properties?.find((p) => p.key?.name === name)?.value ?? {});
        facts.logged = `${logArgument("toolItems")} ${logArgument("jobRecordId")} ${logArgument("recordedByUserId")}`;
        const redirects = callsTo(action, "redirect");
        facts.redirects = redirects.length;
        const call = redirects[0];
        if (!call) return facts;
        facts.inTry = insideTry(action, call);
        const path = call.arguments[0];
        facts.target = nameOf(path?.callee ?? {});
        const [record, page, selected, account] = path?.arguments ?? [];
        facts.record = nameOf(record ?? {});
        // A number is read as its value, since a landing names its page with one (#463).
        facts.page =
            page?.type === "Literal"
                ? String(page.value)
                : page?.type === "CallExpression"
                  ? `${nameOf(page.callee)}(${nameOf(page.arguments[0] ?? {})})`
                  : nameOf(page ?? {});
        facts.selected =
            selected?.type === "CallExpression" && selected.callee?.property?.name === "map"
                ? `${nameOf(selected.callee.object)} → ${nameOf(selected.arguments[0]?.body ?? {})}`
                : nameOf(selected ?? {});
        const propertyOf = (name) => account?.properties?.find((p) => p.key?.name === name)?.value;
        facts.asked = nameOf(propertyOf("asked") ?? {});
        const unwritten = propertyOf("unwritten");
        facts.unwritten =
            unwritten?.type === "BinaryExpression"
                ? `${nameOf(unwritten.left)} ${unwritten.operator} ${nameOf(unwritten.right)}`
                : nameOf(unwritten ?? {});
        facts.unlogged = nameOf(propertyOf("unlogged") ?? {});
        // THE REFUSAL FOR A BATCH THAT WROTE NOTHING, and that it stands before the
        // redirect in the source — which is not execution order, and is what this tier has.
        facts.guardBefore = false;
        let guardAt = -1;
        walk(action, (n) => {
            if (n.type !== "IfStatement" || n.start > call.start) return;
            const test = n.test;
            const empty =
                test?.type === "BinaryExpression" &&
                nameOf(test.left) === "created.length" &&
                test.operator === "===" &&
                test.right?.value === 0;
            const refuses =
                n.consequent?.type === "ReturnStatement" &&
                n.consequent.argument?.properties?.map((p) => p.key?.name).join() === "error";
            if (empty && refuses) {
                facts.guardBefore = true;
                guardAt = n.start;
            }
        });
        // #470: the log pass after that refusal — a batch that wrote nothing has nothing to
        // log — and before the redirect, which carries its answer.
        facts.logBetween = Boolean(logCall) && guardAt >= 0 && logCall.start > guardAt && logCall.start < call.start;
        return facts;
    };
    const land = landingFacts(parseFile(ACTION).ast);
    assert(`${ACTION} declares registerToolItemsAction`, land.found);
    check("it reads the submission through the dialog's own reading", land.readFrom, "readRegistration(…, jobs)");
    check("  against the reader's own jobs", land.jobsFrom, "assignedJobsFor");
    check("its log pass is handed what it created, the chosen job and the reader (#470)", land.logged, "created job.id user.id");
    check("  after the refusal of an empty batch and before the redirect", land.logBetween, true);
    check("it redirects once", land.redirects, 1);
    check("  to a tool's page", land.target, "toolPath");
    check("  the tool upsertTool found or made", `${land.record} from ${land.toolFrom}`, "tool.id from upsertTool");
    check("  on the list's first page, where what it wrote begins (#463)", land.page, "1");
    check("  selecting every tool item it created, by printed id", land.selected, "created → toolItem.toolItemId");
    check("  carrying as asked what the submission asked for (#455)", land.asked, "count");
    check("  counting as unwritten what was asked for less what was created", land.unwritten, "count - created.length");
    check("  and naming as unlogged what the log pass answers (#470)", `${land.unlogged} from ${land.unloggedFrom}`, "unlogged from createFirstToolLogEntries");
    check("the redirect is outside every try", land.inTry, false);
    check("  a batch that wrote nothing refuses before it", land.guardBefore, true);
    // WHAT IT RETURNS IS A REFUSAL AND NOTHING ELSE: the reading's own answer when it took
    // nothing, and the one about the whole dialog when the batch wrote nothing.
    check("  and every value the action returns is a refusal", [...new Set(land.returns)].join(", "), "reading, error");
    // ANTI-VACUITY: a planted action doing each of those wrong is seen doing it — the
    // record from another reader and another binding, a page past the first, a
    // selection of another list, a shortfall of the whole count, an unlogged list read
    // off something other than the log pass, a log pass handed another list, job and
    // reader and run after the redirect, the redirect inside a try, the refusal after
    // it, the old account returned, and a submission read by a check of its own against
    // every job on the base.
    const plantedLanding = landingFacts(
        parseSource(
            "export async function registerToolItemsAction(prevState, formData) {\n" +
                "  return withOpsLabel('registerToolItemsAction', async () => {\n" +
                "    const jobs = await getAllJobs();\n" +
                "    const reading = readQuantity(formData.get('quantity'), allJobs);\n" +
                "    const { tool } = await getToolByName(toolName);\n" +
                "    const { created } = await createToolItems({ toolRecordId: tool.id, jobRecordId: job.id, count });\n" +
                "    const logged = [];\n" +
                "    const { unlogged } = await readUnlogged(created);\n" +
                "    try {\n" +
                "      redirect(toolPath(job.id, 2, logged, { asked: created.length, unwritten: count, unlogged: created }));\n" +
                "    } catch { logged.push(1); }\n" +
                "    await createFirstToolLogEntries({ toolItems: logged, jobRecordId: tool.id, recordedByUserId: job.id });\n" +
                "    if (created.length === 0) return { error: 'x' };\n" +
                "    return { toolItemIds: created };\n" +
                "  });\n" +
                "}\n",
            "<planted-landing>"
        ).ast
    );
    check("  a submission read by another check, against another list, is seen", plantedLanding.readFrom, "readQuantity(…, allJobs)");
    check("  a job list not narrowed to the reader is seen", plantedLanding.jobsFrom, "getAllJobs");
    check("  a log pass handed another list, job and reader is seen", plantedLanding.logged, "logged tool.id job.id");
    check("  a log pass after the redirect is seen", plantedLanding.logBetween, false);
    check("  a redirect to another record is seen", `${plantedLanding.record} from ${plantedLanding.toolFrom}`, "job.id from getToolByName");
    check("  a page from another figure is seen", plantedLanding.page, "2");
    check("  a selection of anything but what was created is seen", plantedLanding.selected, "logged");
    check("  an asked figure that is what was created is seen", plantedLanding.asked, "created.length");
    check("  a shortfall of the whole count is seen", plantedLanding.unwritten, "count");
    check(
        "  an unlogged list read off anything but the log pass's answer is seen",
        `${plantedLanding.unlogged} from ${plantedLanding.unloggedFrom}`,
        "created from readUnlogged"
    );
    check("  a redirect inside a try is seen", plantedLanding.inTry, true);
    check("  a refusal after the redirect is seen", plantedLanding.guardBefore, false);
    check("  and the old account returned is seen", [...new Set(plantedLanding.returns)].join(", "), "error, toolItemIds");

    // #470: THE TWO WRITERS A REGISTRATION CALLS, read off their own sources, since both
    // reach lib/airtable/client.js. What section 9 runs is `lib/airtableBatch.js` and the
    // ID rule; what makes that the registration is that these hand them their rows —
    // the tool items inside the day-prefix lock, awaited before the lock's callback
    // returns, and the first log rows minted with no read and named back as unlogged.
    log("");
    log("the two writers hand the batch writer their rows (#470):");
    const writerFacts = ({ ast, source }) => {
        const text = (node) => (node ? source.slice(node.start, node.end).replace(/\s+/g, " ") : "none");
        const facts = {};
        const items = resolveFunction(ast, "createToolItems");
        if (items) {
            const [mint] = callsTo(items, "generateNextToolItemIds");
            const callback = mint?.arguments[1];
            const [write] = callback ? callsTo(callback, "createRecords") : [];
            facts.itemsWrite = write ? `${text(write.arguments[0])}, ${text(write.arguments[1])}, ${text(write.arguments[2])}` : "none";
            let awaited = false;
            walk(callback ?? {}, (n) => {
                if (n.type === "AwaitExpression" && n.argument === write) awaited = true;
            });
            facts.itemsAwaited = awaited;
            let created = "none";
            walk(callback ?? {}, (n) => {
                if (n.type === "Property" && n.key?.name === "created") created = text(n.value);
            });
            facts.created = created;
        }
        const first = resolveFunction(ast, "createFirstToolLogEntries");
        if (first) {
            const [mint] = callsTo(first, "generateFirstChildIds");
            const config = (name) => text(mint?.arguments[0]?.properties?.find((p) => p.key?.name === name)?.value);
            facts.firstMint = `${config("parentTableName")} ${config("parentLinkFieldName")} ${config("parents")}`;
            const callback = mint?.arguments[1];
            const [write] = callback ? callsTo(callback, "createRecords") : [];
            facts.logWrite = write ? `${text(write.arguments[0])}, ${text(write.arguments[1])}` : "none";
            let unlogged = "none";
            walk(callback ?? {}, (n) => {
                if (n.type === "Property" && n.key?.name === "unlogged") unlogged = text(n.value);
            });
            facts.unlogged = unlogged;
            const [fields] = callsTo(first, "entryFields");
            facts.event = text(fields?.arguments[0]?.properties?.find((p) => p.key?.name === "event")?.value);
            facts.perRow = callsTo(first, "generateChildId").length + callsTo(first, "createToolLogEntry").length;
        }
        return facts;
    };
    const itemsWriter = writerFacts(parseFile(TOOL_ITEMS));
    check(
        "createToolItems writes its tool items through createRecords",
        itemsWriter.itemsWrite,
        'TABLES.TOOL_ITEMS, "Tool Item ID", toolItemIds'
    );
    check("  awaited inside the day-prefix lock's callback", itemsWriter.itemsAwaited, true);
    check("  answering as created exactly what was written", itemsWriter.created, "written.map(({ record }) => recordToToolItem(record))");
    const logWriter = writerFacts(parseFile(TOOL_LOG));
    check(
        "createFirstToolLogEntries mints each first row with no read",
        logWriter.firstMint,
        'TABLES.TOOL_ITEMS "Tool Log" toolItems.map((toolItem) => ({ prefix: toolItem.toolItemId, childRecordIds: toolItem.toolLog }))'
    );
    check("  writes the rows through createRecords", logWriter.logWrite, 'TABLES.TOOL_LOG, "Tool Log ID"');
    check("  names as unlogged what did not land", logWriter.unlogged, "unwritten.map(({ toolItem }) => toolItem.toolItemId)");
    check("  writes the vocabulary's first event (#455)", logWriter.event, "TOOL_EVENT.CREATED");
    check("  and mints nothing one row at a time", logWriter.perRow, 0);
    const plantedWriters = writerFacts(
        parseSource(
            "export async function createToolItems({ count }) {\n" +
                "  return generateNextToolItemIds(count, (toolItemIds) => {\n" +
                "    createRecords(TABLES.TOOL_LOG, 'Tool Item ID', toolItemIds, rowOf);\n" +
                "    return { created: toolItemIds };\n" +
                "  });\n" +
                "}\n" +
                "export async function createFirstToolLogEntries({ toolItems }) {\n" +
                "  entryFields({ event: 'Created' });\n" +
                "  for (const toolItem of toolItems) await createToolLogEntry({ toolItem });\n" +
                "  return generateFirstChildIds({ parentTableName: TABLES.TOOL_LOG, parentLinkFieldName: 'Tool Log', parents: [] }, async (ids) => {\n" +
                "    const { written } = await createRecords(TABLES.TOOL_ITEMS, 'Tool Log ID', ids, rowOf);\n" +
                "    return { unlogged: written.map(({ item }) => item) };\n" +
                "  });\n" +
                "}\n",
            "<planted-writers>"
        )
    );
    check("  a write to another table is seen", plantedWriters.itemsWrite, "TABLES.TOOL_LOG, 'Tool Item ID', toolItemIds");
    check("  a write the lock's callback does not wait for is seen", plantedWriters.itemsAwaited, false);
    check("  created answered as what was minted is seen", plantedWriters.created, "toolItemIds");
    check("  a first row minted under another parent is seen", plantedWriters.firstMint, "TABLES.TOOL_LOG 'Tool Log' []");
    check("  unlogged read off what was written is seen", plantedWriters.unlogged, "written.map(({ item }) => item)");
    check("  an event spelled as a string is seen", plantedWriters.event, "'Created'");
    check("  and a row minted one at a time is seen", plantedWriters.perRow, 1);

    // THE DIALOG'S HALF (#456). It submits through its own handler, which prevents the
    // default, asks `readRegistration` before anything is sent and returns on a refusal,
    // and only then hands the fields to the action inside a transition — the path React
    // 19 does not reset — with no `action` prop anywhere, since a dialog is never open
    // before hydration. What it says is read off what the reading and the action answered,
    // as `fields` and `error`; its three fields start from what the opener handed over.
    // Opened on a tool, the tool is the line under the title and its name goes as it
    // stands; a tool's count is said in its own page's words; a reader who may not
    // register meets a disabled opener with the reason; and it is open only while the
    // address is the one it was opened at. Each is read as the expression that decides it,
    // since naming the call or the prop would be satisfied by every wrong version of it.
    const dialogFacts = ({ ast, source }) => {
        const text = (node) => (node ? source.slice(node.start, node.end).replace(/\s+/g, " ") : "");
        const facts = {
            saidReads: new Set(),
            starts: {},
            guardedFirst: null,
            submitsThrough: null,
            subtitle: null,
            actionProps: 0,
            openWhile: null,
            address: null,
            gate: null,
            nameField: [],
            totals: [],
            commitment: null,
            disabledBySending: 0,
        };
        walk(ast, (n) => {
            if (n.type === "JSXAttribute" && n.name?.name === "action") facts.actionProps++;
            // The commitment (#469): what it says, and the word it gives way to while the frame
            // is busy — and any button made to wait by being disabled while the dialog sends.
            if (n.type === "JSXElement" && n.openingElement.name?.name === "Button") {
                const attribute = (name) => n.openingElement.attributes.find((a) => a.name?.name === name);
                if (attribute("type")?.value?.value === "submit") {
                    const said = n.children.find((child) => child.type === "JSXExpressionContainer")?.expression;
                    facts.commitment = `${text(said) || "nothing"} · ${text(attribute("busyLabel")?.value?.expression) || "no working word"}`;
                }
                if (/\bpending\b/.test(text(attribute("disabled")?.value?.expression))) facts.disabledBySending++;
            }
            if (n.type === "JSXOpeningElement" && n.name?.name === "DialogFrame") {
                const attribute = (name) => n.attributes.find((a) => a.name?.name === name)?.value?.expression;
                facts.submitsThrough = nameOf(attribute("onSubmit") ?? {});
                facts.subtitle = text(attribute("subtitle"));
            }
            if (n.type === "MemberExpression" && !n.computed && n.object?.type === "Identifier" && n.object.name === "said")
                facts.saidReads.add(n.property.name);
            if (n.type === "ChainExpression" && n.expression?.type === "MemberExpression") {
                const member = n.expression;
                if (member.object?.type === "Identifier" && member.object.name === "said") facts.saidReads.add(member.property.name);
            }
            // What each of the three fields starts from, by the state it is bound to.
            if (
                n.type === "VariableDeclarator" &&
                n.id?.type === "ArrayPattern" &&
                n.init?.type === "CallExpression" &&
                n.init.callee?.name === "useState"
            ) {
                const field = n.id.elements[0]?.name;
                if (["toolName", "count", "jobId"].includes(field)) {
                    const first = n.init.arguments[0];
                    facts.starts[field] = text(first?.type === "ArrowFunctionExpression" ? first.body : first);
                }
            }
            // Whether it is open, and the address compared with the one it was opened at.
            if (n.type === "VariableDeclarator" && n.id?.name === "open") facts.openWhile = text(n.init);
            if (n.type === "VariableDeclarator" && n.id?.name === "address") facts.address = text(n.init);
            // The refusal at the opener: what it asks, and the control it draws instead.
            if (n.type === "IfStatement") {
                let button = null;
                walk(n.consequent, (inner) => {
                    if (!button && inner.type === "JSXOpeningElement" && inner.name?.name === "Button") button = inner;
                });
                if (button)
                    facts.gate = `${text(n.test)} → Button ${button.attributes
                        .map((a) => (a.value ? `${a.name?.name}: ${text(a.value.expression ?? a.value)}` : a.name?.name))
                        .join(", ")}`;
            }
            // Where the name is asked for, and where it goes as it stands.
            if (n.type === "ConditionalExpression")
                for (const [side, branch] of [
                    ["then", n.consequent],
                    ["else", n.alternate],
                ])
                    walk(branch, (inner) => {
                        if (inner.type !== "JSXOpeningElement") return;
                        const value = (name) => inner.attributes.find((a) => a.name?.name === name)?.value?.value;
                        if (value("name") === "toolName")
                            facts.nameField.push(`${text(n.test)} ${side}: ${inner.name?.name}${value("type") ? ` ${value("type")}` : ""}`);
                    });
            // A tool's count, in the words its own page heads its list with.
            if (n.type === "CallExpression" && nameOf(n.callee) === "TOOL_LIST_COPY.total") facts.totals.push(text(n.arguments[0]));
        });
        // The submit handler: its first call after the default is prevented is the reading,
        // and the transition that sends the fields comes after a return on a refusal. It is
        // a function inside the component, so it is found by its binding.
        let submit = null;
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === "submit" && /Function/.test(n.init?.type ?? "")) submit = n.init;
        });
        if (submit) {
            const calls = [];
            walk(submit, (n) => {
                if (n.type === "CallExpression") calls.push(nameOf(n.callee));
            });
            const read = calls.indexOf("readRegistration");
            const sent = calls.indexOf("startTransition");
            let refusesBeforeSending = false;
            walk(submit, (n) => {
                if (n.type === "IfStatement" && nameOf(n.test?.argument ?? {}) === "reading.registration") refusesBeforeSending = true;
            });
            let dispatched = false;
            for (const transition of callsTo(submit, "startTransition"))
                walk(transition.arguments[0] ?? {}, (inner) => {
                    if (inner.type === "CallExpression" && inner.callee?.name === "formAction") dispatched = true;
                });
            facts.guardedFirst = `${calls.includes("event.preventDefault") ? "prevents the default" : "lets the default run"} · ${
                read >= 0 && (sent < 0 || read < sent) && refusesBeforeSending ? "reads before sending" : "sends unread"
            } · ${dispatched ? "dispatches in a transition" : "dispatches nothing itself"}`;
        }
        return {
            ...facts,
            saidReads: [...facts.saidReads].sort().join(", "),
            nameField: facts.nameField.sort().join(" | "),
            totals: facts.totals.sort().join(", "),
        };
    };
    const dialog = dialogFacts(parseFile(DIALOG));
    check("the dialog submits through its own handler, handed to the frame", dialog.submitsThrough, "submit");
    check(
        "  which prevents the default, reads before sending and dispatches in a transition",
        dialog.guardedFirst,
        "prevents the default · reads before sending · dispatches in a transition"
    );
    check("  with no action prop anywhere", dialog.actionProps, 0);
    check("  and says only what the reading or the action refused", dialog.saidReads, "error, fields");
    // The one job there is comes from `onlyJob` since #458, the one spelling of "one
    // assignment" the transition's dialog starts from too (`offline/tool-job.mjs`).
    check(
        "its fields start from what the opener handed over: the tool, the count, and the one job there is",
        `${dialog.starts.toolName} | ${dialog.starts.count} | ${dialog.starts.jobId}`,
        'tool ? tool.toolName : "" | String(openingCount(quantity)) | onlyJob(jobs)?.id ?? ""'
    );
    check("opened on a tool, the tool is the line under the title", dialog.subtitle, "tool ? tool.toolName : COPY.intro");
    check("  and its name goes as it stands, with no field to type it in", dialog.nameField, "tool else: Combobox | tool then: input hidden");
    check("a tool's count, suggested or matched, is in its own page's words", dialog.totals, "existing.count, suggestion.count");
    check(
        "a reader who may not register meets the opener disabled, with why before it",
        dialog.gate,
        // In the look its opener asks for (#463): an empty list's second opener is bordered.
        "!canRegister → Button variant: variant, disabled, disabledReason: COPY.noJob"
    );
    check(
        "and it is open only while the address is the one it was opened at",
        `${dialog.openWhile} where address = ${dialog.address}`,
        "openedAt !== null && openedAt === address where address = useSearchParams().toString()"
    );
    // ITS COMMITMENT NAMES ITS COUNT AS THE PRESS WILL READ IT, AND SAYS IT IS SENDING (#469):
    // the words through `readQuantity`, the one reading of a count, and its working word —
    // `Adding…` since #485 — handed over for the frame's busy state, with no button disabled
    // while the dialog sends: a disabled one gives focus up to the document, which the
    // frame's state exists to stop.
    check(
        "its commitment names the count the press would take, and gives way to its working word",
        dialog.commitment,
        "COPY.submit(readQuantity(count).count) · COPY.working"
    );
    check("  and no button of it is disabled while it sends", dialog.disabledBySending, 0);
    // ANTI-VACUITY: a planted dialog bound through `action`, sending before it reads,
    // reading the action's old account, starting its fields from literals, naming no tool,
    // asking a name it was handed, counting in another figure, gating on something else and
    // staying open over a moved address is seen doing each.
    const plantedDialog = dialogFacts(
        parseSource(
            "function RegistrationDialog({ canRegister }) {\n" +
                "  const address = useSearchParams().toString();\n" +
                "  const open = openedAt !== null;\n" +
                "  if (canRegister === false) return <Button disabled>{opener}</Button>;\n" +
                "}\n" +
                "function RegistrationForm({ quantity }) {\n" +
                "  const [state, formAction] = useActionState(registerToolItemsAction, null);\n" +
                '  const [toolName] = useState("");\n' +
                '  const [count] = useState("1");\n' +
                '  const [jobId] = useState("");\n' +
                "  const said = state;\n" +
                "  const submit = (event) => { startTransition(() => formAction(new FormData(event.currentTarget))); const reading = readRegistration({}, []); };\n" +
                "  return <DialogFrame onSubmit={submit} subtitle={COPY.intro}><form action={formAction}>{said?.error}{said?.toolItemIds}" +
                '{false ? <input type="hidden" name="toolName" /> : <Combobox name="toolName" suggestions={s.map((x) => ({ detail: String(x.count) }))} />}' +
                '<Button type="submit" disabled={pending}>{COPY.submit(Number(count))}</Button>' +
                "</form></DialogFrame>;\n" +
                "}\n",
            "<planted-dialog>"
        )
    );
    check("  an action prop is seen", plantedDialog.actionProps, 1);
    check("  a handler sending before it reads is seen", plantedDialog.guardedFirst, "lets the default run · sends unread · dispatches in a transition");
    check("  an old account read is seen", plantedDialog.saidReads, "error, toolItemIds");
    check(
        "  fields started from literals are seen",
        `${plantedDialog.starts.toolName} | ${plantedDialog.starts.count} | ${plantedDialog.starts.jobId}`,
        '"" | "1" | ""'
    );
    check("  a line under the title that names no tool is seen", plantedDialog.subtitle, "COPY.intro");
    check("  a name asked for whatever the dialog was opened on is seen", plantedDialog.nameField, "false else: Combobox | false then: input hidden");
    check("  a count in another figure is seen", plantedDialog.totals, "");
    check("  a gate on something else, with no reason, is seen", plantedDialog.gate, "canRegister === false → Button disabled");
    check(
        "  and a dialog that stays open over a moved address is seen",
        `${plantedDialog.openWhile} where address = ${plantedDialog.address}`,
        "openedAt !== null where address = useSearchParams().toString()"
    );
    check("  a commitment naming a count the press never read, with no working word, is seen", plantedDialog.commitment, "COPY.submit(Number(count)) · no working word");
    check("  and one disabled while the dialog sends is seen", plantedDialog.disabledBySending, 1);

    // ── 9: a registration's failures, run against a fake base (#470) ─────────
    // What a landing says after a batch fails is decided by `lib/airtableBatch.js`, which
    // imports nothing, so a registration's two passes run here as section 8 reads them
    // wired: its tool items minted as one contiguous run and written ten to a request,
    // then a first log row for each that landed — its id `nextChildId` over no siblings —
    // written the same way. The account they leave goes onto a landing through `toolPath`
    // and is read back the way the tool's page reads it, so each assertion is about what
    // the reader is told. The fake is `airtable-batch.mjs`' own (`_fakeBase.mjs`). **The fork
    // is said whole since #485** — its title, its sentence and the answer that goes on, each
    // built from the account as `RegistrationShortfall.js` builds it, which
    // `offline/tool-list-view.mjs` reads off that file — because a browser can draw that
    // dialog only from an address typed by hand, and this is where a failed batch is the one
    // that wrote it.
    log("");
    log("a registration whose batch fails says how many were written, and which have no first row (#470):");
    const FIRST_ROW = childKind("Tool Items", "Tool Log");
    const printed = (from, to) =>
        Array.from({ length: to - from + 1 }, (_, i) => `HYE-TL-261001-${String(from + i).padStart(3, "0")}`).join(" ");
    const register = async (count, { toolAnswer, logAnswer } = {}) => {
        const toolBase = fakeBase({ idField: "Tool Item ID", answer: toolAnswer });
        const tools = await createInBatches(formatSequentialIds("HYE-TL-261001", 1, count, { padLength: 3 }), {
            idField: "Tool Item ID",
            rowOf: (toolItemId) => ({ "Tool Item ID": toolItemId }),
            create: toolBase.create,
            readBack: toolBase.readBack,
        });
        const created = tools.written.map(({ item }) => item);
        const logBase = fakeBase({ idField: "Tool Log ID", answer: logAnswer });
        const logs = await createInBatches(created, {
            idField: "Tool Log ID",
            rowOf: (toolItemId) => ({ "Tool Log ID": nextChildId(FIRST_ROW, toolItemId, []) }),
            create: logBase.create,
            readBack: logBase.readBack,
        });
        const address = new URLSearchParams(
            toolPath("recTool", 1, created, { asked: count, unwritten: count - created.length, unlogged: logs.unwritten }).split("?")[1]
        );
        const account = readRegistrationAccount({
            asked: address.get("asked"),
            unwritten: address.get("unwritten"),
            unlogged: address.getAll("unlogged"),
        });
        const told = (query = address) => accountToTell(account, query);
        const said =
            account.unwritten > 0
                ? `${TOOL_REGISTRATION_COPY.shortfallHeading({ created: account.asked - account.unwritten, asked: account.asked })} — ${TOOL_REGISTRATION_COPY.shortfall(account.unwritten)} — ${TOOL_REGISTRATION_COPY.registerOthers(account.unwritten)}`
                : "";
        return { created, account, address, told, said, rows: [...logBase.held.keys()] };
    };
    const without = (address, key) => {
        const next = new URLSearchParams(address);
        next.delete(key);
        if (key === "unwritten") next.delete("asked");
        return next;
    };
    {
        const refused = await register(25, { toolAnswer: (n) => (n === 1 ? { land: 0 } : null) });
        check("a tool items request refused whole: what landed before it is selected", refused.address.getAll("id").join(" "), printed(1, 10));
        check("  and the fork says the rest, and offers it", refused.said, "10 of 25 tools added — 15 couldn't be added. — Add 15 more");
        check("  with nothing unlogged, since every one written has its first row", `${refused.told()} ${refused.account.unlogged.length}`, "shortfall 0");
    }
    {
        const lost = await register(25, { toolAnswer: (n, rows) => (n === 1 ? { land: rows.length } : null) });
        check("its answer lost after the rows landed: the read-back selects twenty", lost.address.getAll("id").join(" "), printed(1, 20));
        check("  and the fork says five, and offers them", lost.said, "20 of 25 tools added — 5 couldn't be added. — Add 5 more");
        check("  each of the twenty with its first row, minted with no read", `${lost.rows.length} ${lost.rows[0]} ${lost.rows[19]}`, "20 HYE-TL-261001-001-001 HYE-TL-261001-020-001");
    }
    {
        const unlogged = await register(12, { logAnswer: (n) => (n === 1 ? { land: 0 } : null) });
        check("a first rows request refused whole: every tool item selected", unlogged.address.getAll("id").join(" "), printed(1, 12));
        check("  no shortfall to offer", `${unlogged.account.asked}/${unlogged.account.unwritten}`, "0/0");
        check("  and the notice names exactly the two without a row", unlogged.account.unlogged.join(" "), printed(11, 12));
        check("  told as the notice", `${unlogged.told()} — ${TOOL_REGISTRATION_COPY.unloggedHeading(unlogged.account.unlogged.length)}`, "unlogged — 2 tools have no creation date");
        check("  and after `Got it`, nothing", unlogged.told(without(unlogged.address, "unlogged")), null);
    }
    {
        const logLost = await register(12, { logAnswer: (n, rows) => (n === 1 ? { land: rows.length } : null) });
        check("its answer lost after the rows landed: no tool item is named, and nothing told", `${logLost.account.unlogged.length} ${logLost.told()}`, "0 null");
    }
    {
        const both = await register(25, {
            toolAnswer: (n) => (n === 2 ? { land: 0 } : null),
            logAnswer: (n) => (n === 1 ? { land: 0 } : null),
        });
        check("both passes failing: the notice first, naming the second ten", `${both.told()} ${both.account.unlogged.join(" ")}`, `unlogged ${printed(11, 20)}`);
        check("  then the fork, for the five never written", `${both.told(without(both.address, "unlogged"))} — ${both.said}`, "shortfall — 20 of 25 tools added — 5 couldn't be added. — Add 5 more");
    }

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // Most assertions above are equalities against a canonical value, and a key
    // function that returned a constant would satisfy every one of them.
    assert(
        "the key tells two different tools apart",
        toolNameKey("Impact Driver") !== toolNameKey("Angle Grinder")
    );
    assert(
        "  and does not collapse a name that merely starts the same",
        toolNameKey("Impact Driver") !== toolNameKey("Impact Driver XR")
    );
    assert("the key of nothing is empty", toolNameKey("   ") === "");
    // The refusal detector is seen to refuse and to admit, since "every bad value
    // is refused" is also what a function returning a refusal always would give.
    assert("a good quantity is NOT refused", readQuantity("7").refusal === null);
    assert("  and a good submission is taken", Boolean(readRegistration(good, jobs).registration));
    // The suggestions are seen to find something, since an empty answer is also what a
    // filter keeping nothing returns for every name above that suggests none.
    assert("a partly typed name finds a suggestion", suggestTools("drill", shelf).length > 0);
    // The noun matcher is seen finding the replaced noun in either number and any case,
    // and passing the design's, since zero is also what a broken regex reports.
    assert("the noun matcher finds `tool items`", TOOL_ITEM_NOUN.test("Say how many tool items to register."));
    assert("  and `Tool item`", TOOL_ITEM_NOUN.test("Tool item not found"));
    assert(
        "  and passes the design's `tools` and `items`",
        !TOOL_ITEM_NOUN.test("Say how many tools to create.") && !TOOL_ITEM_NOUN.test("13 items")
    );
    assert("the ceiling is a positive whole number", Number.isInteger(MAX_TOOL_ITEMS_PER_REGISTRATION) && MAX_TOOL_ITEMS_PER_REGISTRATION > 0);
}

if (isMain(import.meta.url)) await standalone(title, run);

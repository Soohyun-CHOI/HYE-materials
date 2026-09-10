// Registering tool items (#338) — the pure half of the tools track's first write
// screen: what makes two typed names one tool, how many tool items one
// submission may create, which jobs the person registering may file them
// against, and every word the screen says.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE FORM. That is lib/prItemMerge.js's
// shape and it is the reason this module exists rather than the rule living in
// the action: the person typing a name has to see that it matched a tool that
// already exists BEFORE they submit, and the server has to reach the same
// verdict afterwards. One key, two readers, no second implementation.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` with the extension spelled
// out, which is the lib/materialPriceView.js precedent (#19): the offline tier
// runs under plain `node` with no loader, and the alternative was a second copy
// of #18's naming rule. Nothing here reaches lib/airtable/, so the form can
// import it — an import is an execution, and a credentialed module in a
// "use client" file is a browser crash rather than a lint error.
//
// EVERY STRING THE SCREEN RENDERS IS IN `TOOL_REGISTRATION_COPY` AND NONE IS IN
// JSX. A word written into a component is invisible to the vocabulary checks and
// to scripts/screen-strings.mjs, so a screen with copy in its markup cannot be
// swept. Putting them here also makes them Design's to reword in one place,
// which is the whole arrangement docs/briefs/_shared.md opens by describing.
//
// THE NAME WAS NARROWER THAN THE CONTENTS FROM #362 TO #363, AND IS NOT ANY
// MORE. `assignedJobsFor` and the two picker words were never about registering
// anything — they are the tools axis's rule for which job an actor may file an
// event against — so #362 recorded the divergence and wrote down the condition
// for moving them: a third caller. #363's retirement was the third, and they
// are `lib/toolJob.js` now. What stayed is `canRegisterToolItems`, whose name
// and screen really are this one's: it is the form asking whether this person
// may use it, and it reads the moved function to answer.

import { normalizeItemText } from "./itemNaming.js";
import { TOOL_JOB_COPY, assignedJobsFor } from "./toolJob.js";

/**
 * The key two typed tool names have to share to be one tool.
 *
 * NORMALIZE THEN LOWERCASE, AND THE SPLIT BETWEEN THE TWO IS #18's. Whitespace
 * is fixed in the STORED value — `normalizeItemText` trims and collapses
 * internal runs — because a formula cannot collapse an internal run, and case is
 * fixed only in the COMPARISON, because the stored string is the only copy of
 * what somebody typed and `DeWalt`, `20V` and `SDS-Max` are correct as written.
 *
 * MEASURED, AND THIS IS WHY THE LOOKUP CANNOT BE A BARE `=` (#338). Airtable's
 * `=` on a text field is CASE-SENSITIVE: `{Vendor Name} = "brazos metals"`
 * returned 0 rows against a stored `Brazos Metals`, as did the uppercased form,
 * while `LOWER(TRIM({Vendor Name})) = LOWER(TRIM(…))` returned 1 for both. Two
 * places in this repository claimed the opposite and both are corrected — the
 * consequence of believing it was that `impact driver` would have created a
 * second tool beside `Impact Driver` and split that tool's count in two, which
 * is the defect the duplicate gate exists to prevent.
 *
 * `LOWER(TRIM(…))` STILL CANNOT COLLAPSE AN INTERNAL RUN — measured in the same
 * pass, `Brazos  Metals` matched 0 rows either way — so the normalization on the
 * write side is load-bearing rather than tidy, exactly as itemNaming.js says.
 */
export function toolNameKey(toolName) {
    return normalizeItemText(toolName).toLowerCase();
}

/**
 * The tool an already-loaded list holds under this name, or null.
 *
 * The form's preview and nothing else — the ACTION asks Airtable, because a list
 * the browser loaded moments ago cannot answer whether a tool exists now. So
 * this is the same key reaching the same verdict on stale data, which is what
 * makes the preview honest without making it authoritative.
 */
export function matchExistingTool(toolName, tools) {
    const key = toolNameKey(toolName);
    if (!key) return null;
    return (tools || []).find((tool) => toolNameKey(tool.toolName) === key) || null;
}

/**
 * The most tool items one submission may create.
 *
 * DERIVED FROM ONE INVOCATION'S BUDGET RATHER THAN CHOSEN. A registration costs
 * three Airtable operations per tool item — the tool item's own create, plus the
 * parent find and the create that `createToolLogEntry` makes for its `Registered`
 * row — and Airtable admits five requests a second, so a hundred tool items is
 * on the order of a minute against a Vercel function's 300-second ceiling.
 * Measured at 12: see docs/notes/tools.md for the figure and for the condition
 * under which batching the creates would move this number.
 *
 * IT IS A CEILING ON ONE SUBMISSION AND NOT ON A TOOL. Registering more than
 * this many of one kind is repeating the form, which lands the rest under the
 * same tool — the find-or-create path is what makes that the ordinary case
 * rather than a workaround, and the refusal says so.
 */
export const MAX_TOOL_ITEMS_PER_REGISTRATION = 100;

/**
 * How many tool items a submitted quantity asks for, or the refusal.
 *
 * ONE FUNCTION FOR BOTH, so no call site can read the count without having
 * consulted the refusal. The shape is `lib/uploadLimit.js:uploadLimitRefusal`'s
 * with the parsed value carried along, because the parse and the bound are the
 * same judgment: a value that will not parse has no count to check.
 *
 * The form's own input is a number with a minimum, and this exists because a
 * Server Action is directly callable — the control constrains a person, not a
 * caller.
 */
export function readQuantity(raw) {
    const text = String(raw ?? "").trim();
    if (text === "") return { count: null, refusal: TOOL_REGISTRATION_COPY.quantityMissing };
    if (!/^\d+$/.test(text) || Number(text) < 1) {
        return { count: null, refusal: TOOL_REGISTRATION_COPY.quantityNotWhole };
    }
    const count = Number(text);
    if (count > MAX_TOOL_ITEMS_PER_REGISTRATION) {
        return {
            count: null,
            refusal: TOOL_REGISTRATION_COPY.quantityTooMany({
                requested: count,
                limit: MAX_TOOL_ITEMS_PER_REGISTRATION,
            }),
        };
    }
    return { count, refusal: null };
}

/** Whether this person may register at all: they need a job to register onto. */
export function canRegisterToolItems(user, jobs) {
    return assignedJobsFor(user, jobs).length > 0;
}

/**
 * Every word the registration screen renders.
 *
 * THE ACCOUNT OF WHAT WAS WRITTEN NAMES EVERY MINTED ID RATHER THAN COUNTING
 * THEM, and that is the one entry here with a reason outside wording. A
 * `Tool Item ID` is printed onto a sticker and glued to a tool, so a count
 * cannot be acted on — the ids are the deliverable of the submission. Each one
 * links to its own screen, and since #339 they are reachable after a reload too:
 * `/tools` lists the tool this registration landed under and that tool's page
 * lists these rows. Leaving this page was the end of seeing them until then.
 */
export const TOOL_REGISTRATION_COPY = {
    heading: "Register tool items",
    intro: "One tool name, and how many of them were bought.",

    nameLabel: "Tool name",
    quantityLabel: "How many",
    jobLabel: "Job",
    // The picker's own two words, read from lib/toolJob.js since #363 rather
    // than spelled here. The keys are unchanged, so this form did not move.
    jobUnchosen: TOOL_JOB_COPY.unchosen,
    submit: "Register",

    // The preview, which is the same verdict the action reaches a moment later.
    // Both voices exist because the two outcomes are different acts: one names a
    // tool the company already owns, the other coins one.
    matchesExisting: (toolName) =>
        `${toolName} is already a tool. These tool items join the ones already under it.`,
    newTool: (toolName) => `${toolName} is a tool nobody has registered yet.`,

    nameMissing: "A tool name is required.",
    quantityMissing: "Say how many tool items to register.",
    quantityNotWhole: "How many has to be a whole number, 1 or more.",
    quantityTooMany: ({ requested, limit }) =>
        `${requested} is more than one registration can write. Register up to ${limit} ` +
        `at a time and repeat for the rest — they land under the same tool.`,

    // A person with no assignment cannot register, and the screen says what to do
    // rather than what went wrong: there is no self-service path to a job
    // assignment, so the only next step is asking for one.
    noJob:
        "You are not assigned to a job, so there is no job to register a tool item against. " +
        "Ask for a job assignment first.",
    jobNotYours: TOOL_JOB_COPY.notYours,

    registered: ({ toolName, jobCode, toolItemIds }) =>
        `Registered ${toolItemIds.length} tool item${toolItemIds.length === 1 ? "" : "s"} ` +
        `of ${toolName} on ${jobCode}.`,
    ids: "Print a label for each of these:",
    // A short count, and the two facts a person needs from it: what stands, and
    // that it stands on purpose. Retrying writes the rest under the same tool.
    shortCount: ({ requested, created }) =>
        `${created} of ${requested} were written. The rest were not, and what was ` +
        `written stays — the ids above are spent. Register the remaining ` +
        `${requested - created} again.`,
    // The one state where a tool item exists and its history does not. `Tool
    // Items` carries no `Created At`, so the `Registered` row is the only place
    // the moment lives, and a row without one cannot be repaired by writing a
    // late one: its `Event At` would state a time that is not when the tool item
    // came into existence.
    unlogged:
        "These tool items were written but their registration was not recorded, " +
        "so nothing holds the moment they came into existence:",
};

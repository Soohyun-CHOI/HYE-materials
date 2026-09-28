// Registering tool items (#338) — the pure half of the tools track's first write
// screen: what makes two typed names one tool, how many tool items one
// submission may create, whether the person in front of the form may use it,
// what the form opens filled with and what a registration's landing carries
// (#449), and every word a registration says. **The first line listed which jobs
// the person registering may file against, which went to lib/toolJob.js in #363**
// — the paragraph at the foot of this header says so and the list did not.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE FORM. That is lib/prItemMerge.js's
// shape and it is the reason this module exists rather than the rule living in
// the action: the person typing a name has to see that it matched a tool that
// already exists BEFORE they submit, and the server has to reach the same
// verdict afterwards. One key, two readers, no second implementation.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js`, `./toolJob.js` and, since
// #449, `./toolRoutes.js`, each with the extension spelled out, which is the
// lib/materialPriceView.js precedent (#19): the offline tier runs under plain `node`
// with no loader, and the alternative was a second copy of #18's naming rule.
// Nothing here reaches lib/airtable/, so the form and the offer a registration
// lands with can import it — an import is an execution, and a credentialed module in
// a "use client" file is a browser crash rather than a lint error.
//
// IT MAY NOT IMPORT `./toolListView.js`, AND THE REASON IS A CYCLE THAT WOULD FAIL IN
// ONE LOAD ORDER ONLY. That module imports `./toolLabelSheet.js`, which reads
// `MAX_TOOL_ITEMS_PER_REGISTRATION` from this one at its top level — so a bundle
// that loaded this module before the other two, as the form's does, would evaluate
// that line before the ceiling exists and throw, while every other order would pass.
// That is why the page a registration lands on is asked of `pageHolding` by the
// action rather than composed here with the rest of the landing.
//
// EVERY STRING A REGISTRATION RENDERS IS IN `TOOL_REGISTRATION_COPY` AND NONE IS IN
// JSX — on the form, and on the tool's own page, where a registration lands since #449
// and which opens the form since #451. A word written into a component is invisible
// to the vocabulary checks and to scripts/screen-strings.mjs, so a screen with copy in
// its markup cannot be swept. Putting them here also makes them Design's to reword in
// one place, which is the whole arrangement docs/briefs/_shared.md opens by describing.
//
// THE NAME WAS NARROWER THAN THE CONTENTS FROM #362 TO #363, AND IS NOT ANY
// MORE. `assignedJobsFor` and the two picker words were never about registering
// anything — they are the tools axis's rule for which job an actor may file an
// event against — so #362 recorded the divergence and wrote down the condition
// for moving them: a third caller. #363's retirement was the third, and they
// are `lib/toolJob.js` now. What stayed is `canRegisterToolItems`, whose name
// and screen really are this one's: it is the form asking whether this person
// may use it, and it reads the moved function to answer.

import { textMatchKey } from "./itemNaming.js";
import { TOOL_JOB_COPY, assignedJobsFor } from "./toolJob.js";
import { readToolItemIds } from "./toolRoutes.js";

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
 *
 * THE COMPOSITION MOVED IN #376 AND THIS NAME DID NOT. A recipient's name is the
 * second typed string on this axis folded the same way, so the two halves are
 * `itemNaming.js:textMatchKey` now and this calls it. The identifier stays because
 * it is about a TOOL's name — one subject of a rule that has two — which is the
 * same reading that left `canRegisterToolItems` here when `assignedJobsFor` went.
 */
export function toolNameKey(toolName) {
    return textMatchKey(toolName);
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
 * What the form opens with: a tool's name, a count, both or neither — and a count it was
 * not given starts at 1 (#449, #451).
 *
 * THE ADDRESS A TOOL'S OWN PAGE OFFERS, AND THE ONE A REGISTRATION THAT FELL SHORT
 * OFFERS THERE. `lib/toolRoutes.js:registerPath` writes both — the name alone from the
 * page's own control (#451), the name and the count not written from the fork (#449) —
 * and this reads them for the page, which hands both values to the form as where its
 * two fields start. They are a SUGGESTION — the person can change either before
 * anything is written — so this decides only what is safe to start from.
 *
 * THE COUNT GOES THROUGH `readQuantity`, so the form never opens on a number its own
 * submit would refuse: a typed or copied `quantity=150` starts at 1 rather than at a
 * value the action turns down. **A count the address does not carry starts at 1 as
 * well**, which is where the form starts when nothing is named at all, so an address
 * with no count and one with a count the form refuses open alike. The name is trimmed
 * and nothing more, because it stands for what the person would have typed — the
 * action normalizes it, and the preview says whether it names a tool that exists.
 *
 * ONLY A SINGLE STRING IS TAKEN. A Server Component's `searchParams` hands a repeated
 * key over as an array, and nothing this app writes repeats either key, so an array is
 * somebody editing an address and starts the field as though nothing were there.
 */
export function readRegistrationPrefill({ toolName, quantity } = {}) {
    const { count } = typeof quantity === "string" ? readQuantity(quantity) : { count: null };
    return {
        toolName: typeof toolName === "string" ? toolName.trim() : "",
        quantity: count ?? 1,
    };
}

/**
 * A registration's account, off the address of the tool's page it landed on (#449).
 *
 * WHAT THE LANDING CANNOT SHOW, AND NEITHER IS A CONFIRMATION. The selection it arrives
 * with is what was written, and that arrival is the whole confirmation (#321). These
 * are the two things it cannot show: `unwritten`, how many were asked for and not
 * written, and `unlogged`, which of the tool items it wrote have no `Registered` row.
 * `/invoices/[invoiceId]?paired=` is the same shape one axis over — an account of how a
 * record came to be that the record does not hold.
 *
 * A VALUE, NEVER A SENTENCE, AND ONE IT CANNOT HAVE SAYS NOTHING. `unwritten` is a whole
 * number from 1 to one short of the ceiling: a registration that wrote none never
 * lands, because the form refuses instead, and one that wrote everything has nothing to
 * offer. Anything else — 0, the ceiling, a fraction, a word, a repeated key — is 0, and
 * the offer is absent. `unlogged` is read the way the selection is, canonical and each
 * once. **Neither is checked against the base**, so a hand-edited address can name a
 * tool item that does have a history; that is `paired`'s standing property too, and no
 * address this app writes does it.
 */
export function readRegistrationAccount({ unwritten, unlogged } = {}) {
    const text = typeof unwritten === "string" ? unwritten.trim() : "";
    const count = /^\d+$/.test(text) ? Number(text) : 0;
    return {
        unwritten: count >= 1 && count < MAX_TOOL_ITEMS_PER_REGISTRATION ? count : 0,
        unlogged: readToolItemIds(unlogged),
    };
}

/**
 * Every word a registration says — on the form, and on the tool's page it lands on.
 *
 * WHAT IT WROTE IS SAID BY WHERE IT LANDS, AND NOT HERE (#449). The form used to state
 * an account naming every minted id, because nowhere else held those ids together; a
 * registration lands on its tool's page with them selected now, which names each one,
 * survives a reload and is one press from their labels. So the words below say only
 * what that landing cannot: that fewer were written than asked for, which of what was
 * written has no history, and — on the form — that nothing was. They live here rather
 * than in `TOOL_LIST_COPY` because they are about a registration wherever they are
 * drawn, the way that page's print control says the label screen's word — which is
 * also why the control on that page that opens this form says a word from here (#451).
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

    // NOTHING WAS WRITTEN, SO THE FORM STAYS (#449). A registration that writes no tool
    // item has nothing to land on — its tool's page would show no selection and nothing
    // to print — so this arrives in the one slot every refusal uses. The tool it named
    // exists either way, since #338 finds or creates it before the first tool item, so
    // what registering again does is true in both cases; a tool standing with none is
    // what `/tools` and that tool's own page already say in their own words.
    noneWritten: (requested) =>
        requested === 1
            ? "The one asked for was not written. Registering again writes it under the same tool."
            : `None of the ${requested} asked for were written. Registering again writes them under the same tool.`,

    // THE CONTROL A TOOL'S OWN PAGE OPENS THIS FORM FROM (#451), with that tool's name
    // filled in and no count, since nothing on that page knows how many were bought. Not
    // the heading, which is `/tools`' word for opening the form on no tool and whose
    // `tool items` is decided against appearing anywhere new (#378). It says `more of
    // this tool` where the fork below says `the other N`, because this one begins a
    // registration and that one finishes one: the two open one form, and a landing that
    // fell short shows both.
    registerMore: "Register more of this tool",

    // WHAT A REGISTRATION THAT FELL SHORT SAYS WHERE IT LANDS (#449), AND IT IS A FORK
    // RATHER THAN A NOTICE: the two controls after it are its two answers. It says how
    // many and that what was written stands — that is the selection on the same page —
    // and names no noun, the way the list's own words name none (#378).
    shortfall: (unwritten) =>
        `${unwritten} ${unwritten === 1 ? "was" : "were"} not written. What was written stays.`,
    // The answer that goes on. It opens this form with the tool's name and the count
    // filled in (`lib/toolRoutes.js:registerPath`), so its verb is this form's own.
    registerOthers: (unwritten) => `Register the other ${unwritten}`,
    // The answer that stops, and its words are the pair of the one above: one goes on
    // registering and one ends it, which is what says the choice is about the shortfall
    // and not about the notice that can stand beside it.
    doneRegistering: "Done registering",

    // The one state where a tool item exists and its history does not, named where a
    // registration lands and with nothing offered (#449). `Tool Items` carries no
    // `Created At`, so the `Registered` row is the only place the moment lives, and a
    // row without one cannot be repaired by writing a late one: its `Event At` would
    // state a time that is not when the tool item was entered. What is lost is the
    // moment somebody entered the tool rather than the moment it was bought, which is
    // why it says `entered` where it said `came into existence` until #449.
    unlogged:
        "These were written, but their registration was not recorded, " +
        "so nothing holds the moment they were entered:",
};

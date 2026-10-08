// Registering tool items (#338) — the pure half of the tools track's first write
// dialog: what makes two typed names one tool, which tools a typed name suggests, how
// many tool items one submission may create, whether the person in front of it may use
// it, what the dialog opens at and what it submits (#456), what a registration's landing
// carries (#449) and which of it is told first (#459), and every word a registration
// says. **The first line listed which jobs the person registering may file against,
// which went to lib/toolJob.js in #363** — the paragraph at the foot of this header says
// so and the list did not.
//
// APPLIED BY THE ACTION, PREVIEWED AND GUARDED BY THE DIALOG. That is lib/prItemMerge.js's
// shape and it is the reason this module exists rather than the rule living in
// the action: the person typing a name has to see that it matched a tool that
// already exists BEFORE they submit, and the server has to reach the same
// verdict afterwards. One key, two readers, no second implementation. **What a
// submission may be is the same arrangement since #456**: `readRegistration` refuses it
// in the dialog before anything is sent and in the action again, one function for both.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js`, `./toolJob.js` and, since
// #449, `./toolRoutes.js`, each with the extension spelled out, which is the
// lib/materialPriceView.js precedent (#19): the offline tier runs under plain `node`
// with no loader, and the alternative was a second copy of #18's naming rule.
// Nothing here reaches lib/airtable/, so the dialog and the offer a registration
// lands with can import it — an import is an execution, and a credentialed module in
// a "use client" file is a browser crash rather than a lint error.
//
// IT MAY NOT IMPORT `./toolListView.js`, AND THE REASON IS A CYCLE THAT WOULD FAIL IN
// ONE LOAD ORDER ONLY. That module imports `./toolLabelPage.js`, which reads
// `MAX_TOOL_ITEMS_PER_REGISTRATION` from this one at its top level — so a bundle
// that loaded this module before the other two, as the dialog's does, would evaluate
// that line before the ceiling exists and throw, while every other order would pass.
// That is why a tool's count, which the preview says as the figure a tool's page heads
// its list with and the noun that head speaks (`TOOL_LIST_COPY.total`), is handed to `matchesExisting` by the dialog
// rather than built here (#456). The page a registration lands on was asked of that
// module's `pageHolding` by the action for the same reason, until #463 made it the
// first page.
//
// EVERY STRING A REGISTRATION RENDERS IS IN `TOOL_REGISTRATION_COPY` AND NONE IS IN
// JSX — in the dialog, and on the tool's own page, where a registration lands since
// #449 and which opens the dialog since #451. A word written into a component is
// invisible to the vocabulary checks and to scripts/screen-strings.mjs, so a screen with
// copy in its markup cannot be swept. Putting them here also makes them Design's to
// reword in one place, which is the whole arrangement docs/briefs/_shared.md opens by
// describing.
//
// THE NAME WAS NARROWER THAN THE CONTENTS FROM #362 TO #363, AND IS NOT ANY
// MORE. `assignedJobsFor` and the two picker words were never about registering
// anything — they are the tools axis's rule for which job an actor may file an
// event against — so #362 recorded the divergence and wrote down the condition
// for moving them: a third caller. #363's retirement was the third, and they
// are `lib/toolJob.js` now. What stayed is `canRegisterToolItems`, whose name
// and screen really are this one's: it is the three openers asking whether this
// person may use the dialog, and it reads the moved function to answer.
//
// THE SCREEN SAYS `add` AND THIS MODULE SAYS `register`, AND THAT IS A RECORDED
// DIVERGENCE RATHER THAN A SWEEP LEFT HALF DONE (#455, #485). Putting tools into stock
// is `add` on the screen since #485, whether the name typed is a tool the company has
// or a new one, where it was the design's `create` from #455; the identifiers keep
// `register`, the code's word for one act across three tables, which has not moved
// while the screen's word moved twice — and `create` is also the prefix every
// single-table writer in lib/airtable/ carries, two of which this act calls. `create`
// stays below only where it names something else: `Creates a new tool`, which says the
// name typed coins a `Tools` row, and the creation date, the moment the log's `Created`
// row records. docs/notes/naming.md holds the row, and `offline/tool-screen-words.mjs`
// holds that no string a tools screen renders says `register` and names each one that
// still says `create`, which is what keeps either word from reaching a screen through
// the next string written beside it. The design's noun is the same kind of change: a
// `Tool Items` row is a `tool` in these sentences, never a `tool item`.

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
 * The dialog's preview and nothing else — the ACTION asks Airtable, because a list
 * the browser loaded moments ago cannot answer whether a tool exists now. So
 * this is the same key reaching the same verdict on stale data, which is what
 * makes the preview honest without making it authoritative.
 */
export function matchExistingTool(toolName, tools) {
    const key = toolNameKey(toolName);
    if (!key) return null;
    return (tools || []).find((tool) => toolNameKey(tool.toolName) === key) || null;
}

/** The most tools a typed name suggests at once — the design's five (1b). */
export const MAX_TOOL_SUGGESTIONS = 5;

/**
 * The tools a partly typed name suggests (#456): each one whose name holds what is
 * typed, compared on `toolNameKey` so case and spacing are ignored as the write ignores
 * them, in the order the list hands them over, at most `MAX_TOOL_SUGGESTIONS`.
 *
 * A NAME TYPED IN FULL SUGGESTS NOTHING, which is the design's rule and the reason the
 * preview can take the list's place: the tool it names is already the answer, and the
 * line under the field says so (`matchesExisting`). A suggestion is a way to reach the
 * spelling a tool already has, so that buying more of one lands under it rather than
 * beside it — which the find-or-create write would do anyway for a name that differs
 * only in case or spacing, and could not do for one that differs in a word.
 */
export function suggestTools(typed, tools) {
    const key = toolNameKey(typed);
    if (!key) return [];
    return (tools || [])
        .filter((tool) => {
            const own = toolNameKey(tool.toolName);
            return own !== key && own.includes(key);
        })
        .slice(0, MAX_TOOL_SUGGESTIONS);
}

/**
 * The most tool items one submission may create.
 *
 * DERIVED FROM ONE INVOCATION'S BUDGET, WHICH SINCE #470 NO LONGER BINDS IT. A
 * registration cost three Airtable operations per tool item until then — the tool
 * item's own create, plus the parent find and the create `createToolLogEntry` made
 * for its `Created` row — and Airtable admits five requests a second, so a hundred
 * tool items was on the order of a minute against a Vercel function's 300-second
 * ceiling (measured at 12, docs/notes/tools.md). Both writes go ten to a request
 * now, and a hundred is 24 operations. **What holds it at 100 is what says it**: the
 * dialog (`Up to 100`, `Max 100 at a time.`) and `MAX_LABELS_PER_REQUEST`, which is
 * this number so the largest registration prints in one press. Moving it is a change
 * to both, and #470 changed no screen.
 *
 * IT IS A CEILING ON ONE SUBMISSION AND NOT ON A TOOL. Registering more than
 * this many of one kind is repeating the dialog, which lands the rest under the
 * same tool — the find-or-create path is what makes that the ordinary case
 * rather than a workaround, and the refusal's `at a time` says so.
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
 * TWO REFUSALS AND NOT THREE SINCE #456, WHICH ARE THE DESIGN'S. Nothing typed, a
 * value that is not a whole number and one under 1 are one refusal, naming the range;
 * a whole number past the ceiling is the other, naming only the ceiling, because that
 * reader counted right and asked for too many at once.
 *
 * The dialog's own field keeps digits and nothing else, and this exists because a
 * Server Action is directly callable — the control constrains a person, not a
 * caller.
 */
export function readQuantity(raw) {
    const text = String(raw ?? "").trim();
    if (!/^\d+$/.test(text) || Number(text) < 1) {
        return { count: null, refusal: TOOL_REGISTRATION_COPY.quantityInvalid(MAX_TOOL_ITEMS_PER_REGISTRATION) };
    }
    const count = Number(text);
    if (count > MAX_TOOL_ITEMS_PER_REGISTRATION) {
        return { count: null, refusal: TOOL_REGISTRATION_COPY.quantityTooMany(MAX_TOOL_ITEMS_PER_REGISTRATION) };
    }
    return { count, refusal: null };
}

/**
 * Whether this site manager may register: they need a job to register onto. The three
 * openers ask this — the list's, a tool's page's and the offer's — and a site manager it
 * refuses meets each of them drawn and disabled, with the reason before it (#451, #456).
 * **Whether there is an opener at all is asked first, of `isSiteManager` (#506)**: a reader
 * who is not a site manager is drawn none, whatever their jobs, so this never answers for
 * them.
 */
export function canRegisterToolItems(user, jobs) {
    return assignedJobsFor(user, jobs).length > 0;
}

/**
 * The count the dialog opens at: the one its opener hands it, when the submit would take
 * that count, and 1 otherwise (#449, #451, #456).
 *
 * THE OFFER A REGISTRATION THAT FELL SHORT MAKES HANDS IT HOW MANY WERE NOT WRITTEN, and
 * every other opener hands it nothing — the list names no tool, and a tool's own page
 * knows nothing about how many were bought. It goes through `readQuantity`, so the dialog
 * never opens on a count its own submit would refuse; the offer's count is already
 * bounded by `readRegistrationAccount`, so what this guards is a caller, not a reader.
 * **It read an address until #456** — `readRegistrationPrefill`, off `/tools/new`'s
 * query — and the address went with the route: each opener hands the dialog what the
 * address carried, and nothing is written to the address at all.
 */
export function openingCount(quantity) {
    return readQuantity(quantity == null ? "" : String(quantity)).count ?? 1;
}

/**
 * What a registration submits, read or refused (#456) — in the dialog before anything is
 * sent, and in the action again, because a Server Action is directly callable.
 *
 * `jobs` are the reader's own assignments, `assignedJobsFor`'s answer: none refuses the
 * whole registration, and otherwise the submitted job has to be one of them. Every other
 * refusal is about one field and is keyed by that field's name, so the dialog says each
 * under the field it is about (0l): a name, a count, a job — all of them at once, as the
 * design draws them, rather than the first that fails.
 *
 * THE JOB IS NEVER TAKEN FROM THE FORM'S WORD FOR IT. What arrives is a Job record id,
 * and it is admitted only if it is one of `jobs` — so a forged submission cannot file a
 * tool item against a site the actor is not on. None chosen and one not theirs are two
 * refusals, because the first reader has not chosen yet and the second chose wrongly.
 */
export function readRegistration({ toolName, quantity, jobId } = {}, jobs = []) {
    if (jobs.length === 0) return { error: TOOL_REGISTRATION_COPY.noJob };

    const fields = {};
    const name = typeof toolName === "string" ? toolName.trim() : "";
    if (!name) fields.toolName = TOOL_REGISTRATION_COPY.nameMissing;

    const { count, refusal } = readQuantity(quantity);
    if (refusal) fields.quantity = refusal;

    const chosen = typeof jobId === "string" ? jobId : "";
    const job = jobs.find((candidate) => candidate.id === chosen) ?? null;
    if (!chosen) fields.jobId = TOOL_REGISTRATION_COPY.jobNoneChosen;
    else if (!job) fields.jobId = TOOL_REGISTRATION_COPY.jobNotYours;

    if (Object.keys(fields).length > 0) return { fields };
    return { registration: { toolName: name, count, job } };
}

/**
 * A registration's account, off the address of the tool's page it landed on (#449).
 *
 * WHAT THE LANDING CANNOT SHOW, AND NONE OF IT IS A CONFIRMATION. The selection it
 * arrives with is what was written, and that arrival is the whole confirmation (#321).
 * These are the things it cannot show: `unwritten`, how many were asked for and not
 * written; `asked`, how many were asked for at all, which the fork's first sentence
 * needs beside it (#455); and `unlogged`, which of the tool items it wrote have no
 * first log row. `/invoices/[invoiceId]?paired=` is the same shape one axis over — an
 * account of how a record came to be that the record does not hold.
 *
 * `asked` RIDES WITH `unwritten` AND IS NOT READ FROM THE SELECTION, although the
 * landing's selection is exactly what was written. The page never reads `id` — the
 * list rewrites it without a render (`ToolItemList.js`), and a page reading it would
 * describe an address the reader has since changed — so the figure the fork's title,
 * `3 of 5 tools added`, needs arrives as a fact of the registration, which is what it
 * is: how many were asked for does not move when a box is pressed.
 *
 * A VALUE, NEVER A SENTENCE, AND ONE IT CANNOT HAVE SAYS NOTHING. A shortfall is
 * `1 ≤ unwritten < asked ≤ the ceiling`: at least one was not written, at least one was
 * — a registration that wrote none never lands, because the dialog refuses instead — and
 * no submission asks for more than one may write. Anything else — a pair that breaks
 * that, a fraction, a word, a repeated key, either one missing — reads as no shortfall,
 * and the offer is absent. `unlogged` is read the way the selection is, canonical and
 * each once. **None of it is checked against the base**, so a hand-edited address can
 * name a tool item that does have a history; that is `paired`'s standing property too,
 * and no address this app writes does it.
 */
export function readRegistrationAccount({ asked, unwritten, unlogged } = {}) {
    const whole = (raw) => {
        const text = typeof raw === "string" ? raw.trim() : "";
        return /^\d+$/.test(text) ? Number(text) : 0;
    };
    const askedCount = whole(asked);
    const unwrittenCount = whole(unwritten);
    const shortfall =
        unwrittenCount >= 1 && unwrittenCount < askedCount && askedCount <= MAX_TOOL_ITEMS_PER_REGISTRATION;
    return {
        asked: shortfall ? askedCount : 0,
        unwritten: shortfall ? unwrittenCount : 0,
        unlogged: readToolItemIds(unlogged),
    };
}

/**
 * Which part of a landing's account is told now — `"unlogged"`, `"shortfall"` or null
 * (#459). Each part is a dialog over the tool's page, and a dialog is one at a time.
 *
 * THE NOTICE FIRST, AND THE REASON IS WHERE THE FORK'S ANSWER CAN GO. The design draws
 * each part as a dialog and never the two together. `Add 2 more` can end on another
 * landing, and a landing carries its own registration's account and no other, so a notice
 * waiting behind the fork would be dropped unseen; the notice's one answer stays on this
 * page. So the part that cannot leave is told before the one that can.
 *
 * WHAT THERE IS COMES FROM THE PAGE'S READING, AND WHAT IS STILL UNANSWERED FROM THE
 * ADDRESS AS IT STANDS. `account` is `readRegistrationAccount`'s, off the address the page
 * rendered for; `address` is the address now, which each answer edits by deleting its own
 * keys and no others. So a part is told while the page found it and its key is still
 * there: `Got it` takes `unlogged` out and the fork follows, `Not now` takes `unwritten`
 * with `asked`, and a reload between them opens whichever is left. The two readings can
 * differ by an answer and by nothing else, since nothing but an answer edits the address
 * while a modal dialog leaves the page behind it inert.
 */
export function accountToTell({ unwritten, unlogged }, address) {
    if (unlogged.length > 0 && address.has("unlogged")) return "unlogged";
    if (unwritten > 0 && address.has("unwritten")) return "shortfall";
    return null;
}

/**
 * Every word a registration says — in the dialog, and on the tool's page it lands on.
 *
 * WHAT IT WROTE IS SAID BY WHERE IT LANDS, AND NOT HERE (#449). The form used to state
 * an account naming every minted id, because nowhere else held those ids together; a
 * registration lands on its tool's page with them selected now, which names each one,
 * survives a reload and is one press from their labels. So the words below say only
 * what that landing cannot: that fewer were written than asked for, which of what was
 * written has no history, and — in the dialog — that nothing was. They live here rather
 * than in `TOOL_LIST_COPY` because they are about a registration wherever they are
 * drawn, the way that page's print control says the labels' dialog's word — which is
 * also why the controls on that page that open the dialog say words from here.
 *
 * THE DESIGN'S WORDS SINCE #455, THE DIALOG'S OWN SINCE #456, AND `add` FOR THE ACT
 * SINCE #485. #455 took `create` for the act and `tool` for what one makes, so a string
 * that said `tool items` and `register` said `tools` and `create`; and a sentence that met
 * the tool and its tools at once was restructured so one word never names both in it.
 * #456 drew the form as the design's dialog (1j) and took what the dialog says with it —
 * the line under its title, the field's label, placeholder and help, the preview, each
 * field's refusal and the one about the whole dialog. #485 made the act `add` in every
 * string here that names it — the openers and the title, the commitment and its working
 * word, the refusal when nothing was written, and the fork's title, sentence and answer —
 * and left the two that name something else (the header has them). The keys still say
 * `register`, which is the header's divergence.
 */
export const TOOL_REGISTRATION_COPY = {
    // The word for opening the dialog, on every opener that begins a registration — the
    // list's and a tool's own page's (1a, 1d), and the second one an empty list draws — and
    // still the dialog's title, so an opener and what it opens cannot drift apart (#338).
    // `Add tools` since #485, where it was the design's `New tools` from #455.
    heading: "Add tools",
    // The line under the title when the dialog is opened on no tool (1b). Opened on a
    // tool — from its page, or from the offer after a registration that fell short —
    // that line is the tool's name instead, and there is no name to type.
    intro: "Each one gets its own ID and label.",

    nameLabel: "Tool name",
    namePlaceholder: "e.g. Impact Driver, Milwaukee",
    // The line under the name while nothing is typed (1b, #495): what the field does with a
    // name the company already has, said before anybody types one. The preview below takes
    // its place once a name is typed, and a refusal takes the place of either.
    nameHelp: "Use an existing name to add to that tool.",
    quantityLabel: "Quantity",
    quantityHelp: (limit) => `Up to ${limit}`,
    jobLabel: "Job",
    // The picker's own words, read from lib/toolJob.js since #363 rather than spelled
    // here. The keys are unchanged, so the dialog reads them as the form did.
    jobUnchosen: TOOL_JOB_COPY.unchosen,
    // THE COMMITMENT NAMES WHAT IT WILL ADD BY ITS COUNT (#469, 1b): `Add 1 tool`,
    // `Add 5 tools` — `Create` until #485. It is handed `readQuantity`'s count for what the
    // field holds — the verdict the press itself will reach — so while the field holds
    // nothing, 0 or more than one submission may write, it says the act alone, `Add tools`,
    // as 1b draws it under `Max 100 at a time.`, and it never names a count the press would
    // refuse. It said the act alone whatever the count until #469.
    submit: (count) => (count === null ? "Add tools" : count === 1 ? "Add 1 tool" : `Add ${count} tools`),
    // What it says while the registration is on its way (0f Working): the act's verb in its
    // `-ing` form with an ellipsis and no count, `Adding…` since #485.
    working: "Adding…",
    cancel: "Cancel",

    // THE PREVIEW, which is the same verdict the action reaches a moment later, said
    // under the name while no suggestion list stands there (1b). Two voices because the
    // two outcomes are different acts: one adds to a tool the company already owns,
    // the other coins one. THE FIRST IS PARTS RATHER THAN A STRING, because the tool and
    // its count are in Ink inside a line at Ink 2 — a string would leave the component
    // to find them in it. `items` is the figure that tool's own page heads its list
    // with and the noun its head speaks (`TOOL_LIST_COPY.total`), handed in by the dialog, so one figure
    // under one word cannot read two ways on two screens.
    matchesExisting: ({ toolName, items }) => ["Adds to ", { emphasis: toolName }, ", which already has ", { emphasis: items }],
    newTool: "Creates a new tool",

    // Each refusal about one field, said under that field in red (0l) — the design's
    // (1b). `Enter 1 to 100.` answers nothing typed, a word and a zero alike; `Max 100 at
    // a time.` answers a count past the ceiling, and `at a time` is what says the rest
    // can follow in another registration under the same tool.
    nameMissing: "Enter a tool name.",
    quantityInvalid: (limit) => `Enter 1 to ${limit}.`,
    quantityTooMany: (limit) => `Max ${limit} at a time.`,
    jobNoneChosen: TOOL_JOB_COPY.noneChosen,
    jobNotYours: TOOL_JOB_COPY.notYours,

    // WHY AN OPENER CANNOT ACT, BESIDE IT (#456). A person with no assignment cannot
    // register, so every opener is drawn disabled with this before it (0f), and the
    // dialog does not open. It says what to do rather than what went wrong: there is no
    // self-service path to a job assignment, and the design's words name who assigns
    // one. #455 sent back `Join a job to create tools` for naming an act nobody here can
    // perform; this is the design's answer. The action says it too, as a refusal of the
    // whole registration, since a Server Action is reachable without a screen.
    noJob: "Ask the office to assign you to a job",

    // NOTHING WAS WRITTEN, SO THE DIALOG STAYS (#449). A registration that writes no tool
    // item has nothing to land on — its tool's page would show no selection and nothing
    // to print — so this is the refusal about the whole dialog, above its actions, with
    // everything typed still there. The design's words (1b, `Create failed`), with the act's
    // verb since #485. The tool it named exists either way, since #338 finds or creates it
    // before the first tool item; a tool standing with none is what `/tools` and that
    // tool's own page already say.
    noneWritten: "Couldn't add the tools. Try again.",

    // WHAT A REGISTRATION THAT FELL SHORT SAYS WHERE IT LANDS (#449), AND IT IS A FORK
    // RATHER THAN A NOTICE: the two controls after it are its two answers. A dialog of its
    // own since #459, the design's 1c, in the act's verb since #485.
    //
    // 1c's FINAL COMPOSITION SINCE #495: how many were not added is the title, and its one
    // sentence says the rest were added and are the selection on this page. Until then the
    // title was how many of how many were added and the sentence how many were not, and the
    // half saying where the added ones are was left out, as a line repeating the selection
    // off the address (#321); it came back by decision, since the fork is the account of a
    // shortfall rather than a confirmation (#449), and the address carries both counts it
    // needs — `asked` beside `unwritten` (`readRegistrationAccount`). What was added is the
    // one less the other, at least one, so both read in the singular at one.
    shortfallHeading: (unwritten) => (unwritten === 1 ? "1 tool couldn't be added" : `${unwritten} tools couldn't be added`),
    shortfall: (added) =>
        added === 1
            ? "The other 1 was added and is selected on this page."
            : `The other ${added} were added and are selected on this page.`,
    // THE ANSWER THAT GOES ON NAMES HOW MANY ARE LEFT (#485). It puts the fork away and
    // opens the registration dialog on the tool (#459), handed the count that was not
    // written — the one the fork opens that dialog at, so the words and the dialog name one
    // number. `Add 1 more` at one, since `more` takes no plural. It said `Create the rest`
    // from #455 to #485, with no count, where `Register the other N` had carried one.
    registerOthers: (unwritten) => `Add ${unwritten} more`,
    // The answer that stops, and what the fork's close and Escape answer too (#459). It
    // ends the question the fork asks and nothing else, so the notice keeps its own answer.
    doneRegistering: "Not now",

    // The one state where a tool item exists and its history does not, named where a
    // registration lands (#449). `Tool Items` carries no `Created At`, so the log's first
    // row is the only place the moment lives, and a row without one cannot be repaired
    // by writing a late one: its `Event At` would state a time that is not when the tool
    // was created. THE DESIGN GAVE IT A CONTROL IN #455, `Got it`, which takes the
    // notice away and repairs nothing — the difference from the fork is that nothing
    // here is a choice, not that nothing here can be dismissed. A dialog of its own since
    // #459, told before the fork's: its title, its one sentence and then `unlogged`'s ids
    // in the dialog's summary, the way the list names every tool. The sentence ends on
    // this paragraph's reason said to the reader, 1c's words; 1c opens it with how many
    // were added, which a landing with no shortfall does not carry — it has `unlogged` and
    // the selection, and the page never counts the selection (#443) — so that half is not
    // here, where the fork's came back (#495).
    unloggedHeading: (n) => (n === 1 ? "1 tool has no creation date" : `${n} tools have no creation date`),
    unlogged: (n) =>
        n === 1
            ? "Only the creation date wasn't saved for this one, and it can't be added later."
            : `Only the creation date wasn't saved for these ${n}, and it can't be added later.`,
    gotIt: "Got it",
};

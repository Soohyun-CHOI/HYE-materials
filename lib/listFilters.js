// What the four document lists filter by (#324).
//
// THE BARS GREW BY COPYING, WHICH IS WHY THIS IS ONE MODULE AND NOT FOUR. `/prs`
// and `/pos` each carried a job picker, a reader's-own toggle and a status select;
// `/deliveries` carried one checkbox; `/invoices` carried nothing. No list filtered
// by vendor, though every one of them heads a `Vendor` column. None of that was
// decided — each bar was written with the screen that needed it and the next screen
// copied whichever neighbor was open, which is the same fact #314 found three ways
// in the columns beside them.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE RULE, WHICH IS THIS ISSUE'S AND NOT AN EARLIER ONE'S
//
// A closed set a list renders takes one of two shapes.
//
//   A FILTER, when its values are states the document is simply IN. The list keeps
//   its own order, and an empty result means nothing matches.
//
//   A STRIP'S SUBJECT, when its values lie along a WAIT whose end is the good one.
//   A strip is ordered longest-wait-first and renders nothing at all when empty,
//   because an empty worklist means there is nothing left to do while an empty log
//   means nothing arrived.
//
// THAT LAST SENTENCE IS #216's AND IS THE ONLY PART OF THE RULE WITH A PRECEDENT.
// That issue moved `?unbilled=1` off `/deliveries` and made it a strip above
// `/invoices`, on exactly that ground: "a log reads newest first and its empty state
// means nothing delivered, a chasing list reads oldest first and its empty state
// means there is nothing left to do". It moved one filter and wrote down why. The
// general rule is this issue's, generalized FROM that reason — a reader who goes to
// #216 finds the one move and its grounds, which is what is there.
//
// A WAIT IS RECOGNIZED BY DEGREES — `Awaiting X` -> `Partly X` -> `X`. A binary fact
// with no middle is a state, not a wait. That is what splits payment across two
// lists rather than leaving it to taste: an ORDER's payment aggregates the invoices
// charging it, so it has a `Partly paid` and is a wait; an INVOICE holds `Paid Date`
// itself, so it is binary and is a state. The app already draws them apart — a chip
// in the shared palette on `/pos`, a word in the `Status` column on `/invoices`.
//
// A FACT MAY TAKE BOTH SHAPES, AND OFTEN SHOULD. #256's strip counts invoices that
// also have rows in the table directly beneath it, and `/pos` carries a status
// filter alongside two strips about statuses. The strip carries the queue and the
// filter carries the property. What a fact may not do is take NEITHER, which is what
// makes this a partition rather than a preference.
//
// WHAT THE RULE PRODUCES, AXIS BY AXIS, is in `docs/notes/deliveries-and-invoices.md`
// — including the one axis it produces that this issue does not build.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT A LIST SEARCHES, WHICH IS THE SAME KIND OF DECISION AND IS SETTLED HERE TOO
// (#325). A reader holding a printed document types what is on it and does not know
// which field they are naming, so the box takes the names ON THE ROW: the document's
// own id, any second name the document's OWN row carries, and the two subjects every
// one of these lists heads a column for — the vendor and the job.
//
// AND IT DOES NOT REACH INTO ANOTHER DOCUMENT TO BORROW A NAME. That is the line, and
// three candidates fall on the far side of it: `Deliveries."Packing List PO"` is a
// LINK, so what a delivery holds is a reference rather than a name; a request's
// quotation code is on the `Quotations` row and its direct-purchase code on the
// `Direct Purchases` row. Allowing any of them opens the whole chain — a delivery by
// its order, an order by its request, a request by its quotation — and the chain is
// the app. What makes the vendor and the job different is that they are the row's
// SUBJECTS rather than the next document along: a row is "this document, for this
// job, from this vendor", which is how a person says it out loud and what #314 gave
// all four lists a column for. `docs/notes/deliveries-and-invoices.md` has the
// derivation and what each of the three would have cost.
//
// ─────────────────────────────────────────────────────────────────────────────
// PURE, AND IT HAS TO STAY THAT WAY. Four Client Components import this, so an
// import that reached `lib/airtable/` would throw `Missing AIRTABLE_API_KEY` in the
// browser. It imported nothing at all until #325 and now imports one pure module with
// the extension spelled out, which is what keeps the offline tier able to pin every
// clause under plain `node`. The per-list OPTION VALUES — which jobs, which vendors,
// which statuses — are the pages' and are passed in; what lives here is which axes a
// list carries, what each is called, how they compose, and what the screen says.

import { matchesTokens, searchTokens } from "./searchTokens.js";

/**
 * The four control kinds, and the only four.
 *
 * WHICH KIND AN AXIS TAKES IS PRODUCED BY THE AXIS, NOT CHOSEN PER SCREEN. A set of
 * records the reader picks from is a `picker` (searchable, several at once, because
 * the reader works across jobs and chases vendors one at a time and one control
 * serves both). A closed set of values with more than one meaningful side is a
 * `select`. A flag whose only useful narrowing is one-directional is a `toggle` —
 * there is no reader who wants "everything except mine".
 *
 * THE FOURTH IS #325's AND IS THE ONE WHOSE VALUES ARE NOT A SET AT ALL. A `search`
 * takes typed text and matches it against several of the row's own strings at once,
 * which is why it is a kind rather than a picker over some new list: there is nothing
 * to enumerate, nothing for `parseFilters` to intersect a URL against, and the reader
 * may name a thing no control could offer — a vendor's own invoice number is on no
 * screen in this app outside the invoice itself.
 *
 * A PICKER AND THE BOX BOTH NARROW BY VENDOR AND NEITHER REPLACES THE OTHER. The
 * picker is a closed list the reader can see and take several from; the box is free
 * text that also reaches an id and a second name. They compose like any other pair of
 * axes — see `matchesFilters`.
 */
export const CONTROL = {
    search: "search",
    picker: "picker",
    select: "select",
    toggle: "toggle",
};

/**
 * Which key on a pre-shaped row each parameter reads.
 *
 * THE ROWS ARE SHAPED ON THE SERVER AND THE BROWSER READS A KEY — the arrangement
 * `/prs` already used for `isMine` so a requester's identity never reaches the
 * client, and `/pos` for its three chips. Nothing here judges anything; the judgment
 * ran one file up.
 *
 * EXPORTED SINCE #382, AND ITS ONE IMPORTER IS A CHECK. Declaring an axis is half
 * the work and shaping the key is the other half, in another file, with nothing
 * pairing them: a list that declares `mine` and never sets `isMine` draws a live
 * control that narrows to nothing, and every assertion about the declaration passes.
 * `offline/list-filters.mjs` reads this against the four pages' own row objects,
 * which is `offline/job-column.mjs`'s shape — "remove the render, leave the read, and
 * nothing anywhere fails" — one axis over.
 *
 * THE SEARCH AXIS IS NOT IN HERE, AND IT STRUCTURALLY CANNOT BE (#325). Every entry
 * above is one key for one parameter whatever the route; a search reads SEVERAL keys
 * and a DIFFERENT set per list — `/invoices` matches a second name the other three
 * have not got. So that axis names its own keys, in `LIST_AXES`, and the check reads
 * `axis.keys` where it reads this for the other three kinds. The pairing it protects
 * is the same one and is stronger for being plural: a list that declares a search and
 * a page that shapes four of its five keys fails.
 */
export const ROW_KEY = {
    job: "jobId",
    vendor: "vendorId",
    mine: "isMine",
    status: "status",
    kind: "kind",
    over: "hasOverDelivery",
};

/**
 * Every word a picker says, built from its noun.
 *
 * BUILT RATHER THAN WRITTEN OUT, so a third picker coins no strings by hand and the
 * two that exist cannot drift into saying the same thing two ways.
 */
function pickerWords(noun, plural) {
    return {
        all: `All ${noun}s`,
        search: `Search ${noun}s…`,
        clear: `Clear ${noun}s`,
        empty: `No matching ${noun}s.`,
        label: plural,
        selected: (n) => `${n} selected`,
    };
}

const JOB = { param: "job", control: CONTROL.picker, words: pickerWords("job", "Jobs") };
const VENDOR = { param: "vendor", control: CONTROL.picker, words: pickerWords("vendor", "Vendors") };

/**
 * The search box, built from the names it takes and the row keys that hold them.
 *
 * `names` IS WHAT THE BOX SAYS AND `keys` IS WHAT IT MATCHES, AND THE TWO ARE NOT
 * 1:1 — a job is one name over two keys, because a reader may type either half of
 * `26-DEMO-01 — Alpha` and the picker beside the box already shows them both. They
 * are one declaration so that what the screen promises and what the code does cannot
 * drift: the label is generated from the same array the matcher walks.
 *
 * ONE STRING FOR THE LABEL AND THE PLACEHOLDER. A box that says one thing to a screen
 * reader and another in the input is two strings for one promise, and the ellipsis the
 * pickers wear would read as part of `Vendor Invoice #`. So `Search by …` is written
 * once, and the names inside it are the app's own words: `PR ID`, `Invoice ID` and
 * `Vendor Invoice #` are what the columns and the invoice screens already say, and
 * `vendor` and `job` are the pickers' own nouns. `/deliveries` is the one list whose
 * first name is not its column head — the column says `Delivery` and the value is a
 * `Delivery ID` — because this sentence counts what a reader can TYPE rather than
 * what the heading above it says.
 */
function searchWords(names) {
    const what =
        names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
    return { label: `Search by ${what}` };
}
const search = (names, keys) => ({
    param: "q",
    control: CONTROL.search,
    names,
    keys,
    words: searchWords(names),
});

/**
 * The two keys every one of these four rows carries for its subjects.
 *
 * SPELLED ONCE BECAUSE ALL FOUR LISTS SEARCH THEM, which is what #314 made true: every
 * document list heads a `Vendor` column and a `Job` column, so the values are already
 * resolved on the server for the cells and the picker labels and the search costs no
 * read for either. `jobName` is the one key here that no CELL renders — the column
 * shows the code — but the job picker's option label has carried the name since #324,
 * on the ground that `26-DEMO-01` is a house format nobody can pick by, so it is a
 * name this screen already shows the reader.
 */
const SUBJECT_KEYS = ["vendorName", "jobCode", "jobName"];
const SUBJECT_NAMES = ["vendor", "job"];

/** The reader's-own toggle, whose label names the field it reads. */
const mine = (label) => ({ param: "mine", control: CONTROL.toggle, label });
/** The list's own state select. `Status` on all three, matching each one's column. */
const status = () => ({ param: "status", control: CONTROL.select, label: "Status" });

/**
 * Which axes each list carries, in the order they are drawn and written to the URL.
 *
 * THE SUBJECT AXES COME FIRST AND ARE SHARED: job and vendor are facts every one of
 * these four documents holds, and the reader's own is the third on all four of them.
 * Then the list's own state axes.
 *
 * THE READER'S-OWN TOGGLE IS ON EVERY LIST SINCE #382, AND IT WAS A FACT ABOUT THE
 * SCHEMA THAT IT WAS NOT. `/invoices` carried three controls where the others carried
 * four or five, because `Invoices` held neither a requester nor a recorder and there
 * was no axis for a control to read. That issue gave the table a `Recorded By` — the
 * same field and the same word `Deliveries` has — so the ground for the exception went
 * with it. Nothing about the screen was ever the reason.
 *
 * `Requested by me` IS ONE WORD ON TWO LISTS, AND `Raised by me` WAS NOT AVAILABLE.
 * Both read `Purchase Requests."Requester"` — on `/prs` from the row itself, on
 * `/pos` from the request behind the order. `raise` is what a person does to a
 * REQUEST, and an order is generated when a request is fully approved, so nobody
 * raises one: `Raised by me` is false of an order row. `Requested by me` is true of
 * both — a request I requested, and the order for material I requested — and on
 * `/prs` it matches that list's own `Requester` column head exactly, where
 * `Raised by me` introduces a verb no column uses.
 *
 * `Recorded by me` IS A DIFFERENT WORD BECAUSE IT IS A DIFFERENT FIELD, and since
 * #382 it is one word on two lists exactly as `Requested by me` is. `Deliveries` and
 * `Invoices` both carry `Recorded By`, neither of which is a requester, and the
 * participle follows the field name — `docs/notes/naming.md`'s convention for a
 * checkbox. So the four lists say two words for two fields rather than four for four,
 * and which word a list says is read off the field it narrows by.
 *
 * THE SEARCH COMES FIRST, AHEAD OF THE SUBJECT AXES (#325), AND THE ORDER IS SEMANTIC
 * RATHER THAN THE ORDER THE AXES WERE ADDED IN — which is why #382 inserted `mine`
 * into the middle of three of these rows rather than appending it. The box is the one
 * control that names the ROW; everything after it narrows by a property of one. So a
 * bar reads left to right as "which document, then which of its facts", and a URL is
 * written in the same order.
 *
 * ONLY `/invoices` SEARCHES A SECOND NAME, AND THAT IS THE SCHEMA'S DOING RATHER THAN
 * THE SCREEN'S. `Invoices."Vendor Invoice Code"` is the one human-entered second name
 * any of these four tables holds: `Purchase Requests` and `Deliveries` have none, and
 * `Purchase Orders` has none either — what the vendor receives is the PDF we send,
 * with our own `PO ID` printed on it, so our name is the only one an order is called.
 */
export const LIST_AXES = {
    "/prs": [
        search(["PR ID", ...SUBJECT_NAMES], ["prId", ...SUBJECT_KEYS]),
        JOB,
        VENDOR,
        mine("Requested by me"),
        status(),
        // #272's two marks, as a filter. The kind is read from two of the request's
        // OWN reverse-link arrays and no field of another document — so it is a state
        // the request is in rather than a wait, and `lib/prKind.js` already wrote down
        // that it is filterable here precisely because `/prs` narrows over rows it
        // holds rather than asking the base.
        { param: "kind", control: CONTROL.select, label: "Kind" },
    ],
    "/pos": [
        search(["PO ID", ...SUBJECT_NAMES], ["poId", ...SUBJECT_KEYS]),
        JOB,
        VENDOR,
        mine("Requested by me"),
        status(),
    ],
    "/deliveries": [
        search(["Delivery ID", ...SUBJECT_NAMES], ["deliveryId", ...SUBJECT_KEYS]),
        JOB,
        VENDOR,
        mine("Recorded by me"),
        // #181 renamed the field's rendering to this word, and it is the same word the
        // delivery's own row already wears. An over-delivery does not end and its
        // absence is not "done", so it is a state rather than a wait; the WAIT it
        // creates — an excess with no request raised for it — is #217's strip on
        // `/prs`, which is the same fact in the other shape.
        { param: "over", control: CONTROL.toggle, label: "Over-delivered" },
    ],
    "/invoices": [
        search(
            ["Invoice ID", "Vendor Invoice #", ...SUBJECT_NAMES],
            ["invoiceId", "vendorInvoiceCode", ...SUBJECT_KEYS]
        ),
        JOB,
        VENDOR,
        mine("Recorded by me"),
        status(),
    ],
};

/** Every route that carries a bar, for a caller that needs to walk them. */
export const FILTERED_LISTS = Object.keys(LIST_AXES);

/**
 * The parameter names a filter may use, and the one still held for work not done here.
 *
 * `q` WAS RESERVED AND #325 SPENT IT. That reservation is what kept this issue from
 * having to rewrite what was already in the URL, and the name was inherited rather
 * than coined — `/materials` has called a search term `q` since #19, so the app has
 * one name for one thing across two screens that match by the same rule. It is an
 * entry in `offline/url-parameters.mjs`'s inventory now, on all four routes, which is
 * what the reservation's own note said would have to happen when a screen read it.
 *
 * `page` IS STILL RESERVED, for #326, and is still deliberately out of that inventory:
 * an entry there must be read by its screen and nothing reads this one yet.
 * `/tools/[toolRecordId]` already calls a slice `page`, so it is inherited too.
 */
export const FILTER_PARAMS = ["q", "job", "vendor", "status", "kind", "mine", "over"];
export const RESERVED_PARAMS = { page: "page" };

/**
 * Every word the bar says that is not an axis label or an option.
 *
 * THE COUNT IS `/deliveries`'s, WIDENED TO FOUR. That list already said `3 of 40`
 * beside its checkbox and no other list said anything, so a reader could not tell a
 * filter that removed two rows from one that removed two hundred. It renders only
 * when something is active, which is the same condition the clear control has.
 */
export const FILTER_BAR_COPY = {
    clearAll: "Clear all filters",
    allOption: "All",
    count: (shown, total) => `${shown} of ${total}`,
};

/**
 * The three empty states, per list.
 *
 * THREE BECAUSE THEY ARE THREE DIFFERENT FACTS, which is the rule
 * `lib/poListView.js` stated when `/pos` was written and the only list that obeyed
 * it. "Nothing here yet" and "nothing here FOR YOU" are the pair that matters: the
 * word `yet` is what makes the first false for a reader whose scope is empty, so
 * only `none` carries it.
 *
 * TWO LISTS WERE SAYING IT WRONG AND ONE OF THEM WAS LYING. `/prs` had two sentences
 * and folded `none` into `hidden`, which its own brief recorded as not
 * distinguishing them. `/deliveries` told a reader with jobs but no deliveries on
 * them `No deliveries recorded yet.` — the exact sentence the rule bars, said to
 * someone whose company has plenty. Both are corrected here; the `yet` rule is not
 * new, only newly obeyed.
 *
 * `/deliveries` KEEPS ITS OWN TEACHING IN BOTH SENTENCES. Its `hidden` is the app's
 * only screen that tells a reader how to get access, and it names Airtable because
 * there is no user-administration screen; its `none` states the one rule of the
 * feature — the packing list photo is what makes a delivery a record — at the moment
 * a reader has nothing else to look at.
 */
/**
 * What each list calls its own rows, for the sentences that are mechanical.
 *
 * ONE NOUN RATHER THAN FOUR SENTENCES WRITTEN OUT, which is `pickerWords`' move one
 * constant over: #325 needs three narrowing sentences per list instead of one, and
 * twelve strings by hand is twelve chances to punctuate a quotation differently. The
 * `filtered` sentences below are byte-identical to the ones #324 shipped.
 */
const LIST_NOUN = {
    "/prs": "purchase requests",
    "/pos": "purchase orders",
    "/deliveries": "deliveries",
    "/invoices": "invoices",
};

/** The shape all three narrowing sentences share: what was asked for, and nothing left. */
const narrowed = (route, asked) => `No ${LIST_NOUN[route]} match ${asked}.`;

export const LIST_EMPTY_COPY = {
    "/prs": {
        none: "No purchase requests yet. Raise one and it appears here once it is submitted.",
        hidden:
            "No purchase requests to show. You see a request you raised, one on a job you are " +
            "assigned to, or one you are asked to sign.",
        filtered: narrowed("/prs", "these filters"),
    },
    "/pos": {
        none:
            "No purchase orders yet. One is generated automatically when a purchase request is " +
            "fully approved.",
        hidden:
            "No purchase orders to show. You see a purchase order when you can see the request " +
            "behind it.",
        filtered: narrowed("/pos", "these filters"),
    },
    "/deliveries": {
        none:
            "No deliveries recorded yet. Record one as material is delivered — the packing list " +
            "photo is what makes it a record.",
        hidden:
            "No deliveries to show. You see a delivery when it is on a job you are assigned to. " +
            "An Admin can add you to a job in Airtable.",
        filtered: narrowed("/deliveries", "these filters"),
    },
    "/invoices": {
        none: "No invoices yet.",
        hidden:
            "No invoices to show. You see an invoice when it charges a purchase order you raised " +
            "or one on a job you are assigned to.",
        filtered: narrowed("/invoices", "these filters"),
    },
};

/**
 * Which of the three applies, or null when there are rows to render.
 *
 * ORDER IS LOAD-BEARING. `filtered` is tested LAST, because a reader with nothing
 * visible at all would otherwise be told to adjust filters that cannot help them.
 * `totalCount` is every record on the base before the visibility gate; `visibleCount`
 * is what survived it, before any filter.
 *
 * Moved here from `lib/poListView.js`, where it served one list. The judgment did not
 * change; the other three lists became callers.
 */
export function emptyStateKind({ totalCount, visibleCount, filtersActive }) {
    if (totalCount === 0) return "none";
    if (visibleCount === 0) return "hidden";
    if (filtersActive) return "filtered";
    return null;
}

/**
 * The sentence a reader gets, which is where an emptied search says so (#325).
 *
 * THERE IS NO FOURTH KIND AND THAT IS A DECISION. The box is a control in this bar and
 * the value it matches is held by the document, so #324's own rule makes it a filter
 * rather than a new kind of fact — `emptyStateKind` is untouched and still answers the
 * three questions it answered: is the base empty, is this reader's scope empty, is
 * something narrowing.
 *
 * WHAT IS NEW IS THAT THE THIRD SENTENCE NAMES THE NARROWING. A typed term is the one
 * control whose exact content the reader can get wrong — a mistyped digit, a vendor's
 * number for an invoice nobody has entered — so `these filters` alone would send
 * somebody to check dropdowns they never touched. And a reader who has narrowed twice
 * is told so, because neither half on its own would be true:
 *
 *   No invoices match these filters.
 *   No invoices match “ABC-1029”.
 *   No invoices match “ABC-1029” and these filters.
 *
 * NO SECOND SENTENCE EXPLAINING THE MISS, WHICH `/materials` HAS AND THIS CANNOT. That
 * box asks the catalog whether the words exist at all, so it can tell "we do not call
 * it that" from "we have never bought one". Here the two candidates are a typo and a
 * document nobody has entered, and nothing on the base distinguishes them — the pair
 * this list CAN tell apart is already `none` and `hidden`.
 */
export function emptyStateText(route, kind, state) {
    const copy = LIST_EMPTY_COPY[route];
    if (!copy || !kind) return null;
    if (kind !== "filtered") return copy[kind] ?? null;
    const query = searchTerm(route, state);
    if (!query) return copy.filtered;
    const quoted = `“${query}”`;
    return narrowed(route, otherFiltersActive(route, state) ? `${quoted} and these filters` : quoted);
}

/**
 * Whether the bar is drawn at all.
 *
 * IT READS THE ROWS BEFORE ANY FILTER, AND THAT IS THE WHOLE POINT OF THE FUNCTION
 * RATHER THAN AN INLINE TEST. Keying the bar off what survived the filters takes it
 * off the screen exactly when a filter has emptied the list — which is the one state
 * where the reader needs `Clear all filters`, and it leaves them editing the address
 * bar to get out. The invariant is that `emptyStateKind` returning `filtered` implies
 * this returning true, and `offline/list-filters.mjs` walks it exhaustively rather
 * than trusting the reading.
 *
 * A reader with nothing in scope gets no bar: there is nothing to narrow, and a live
 * control over "no purchase orders yet" is what `/prs` and `/pos` drew before this.
 */
export function showsFilterBar({ visibleCount }) {
    return visibleCount > 0;
}

/** The axes one list carries, or an empty list for a route that carries none. */
export function axesFor(route) {
    return LIST_AXES[route] ?? [];
}

/**
 * A select's choices, which are usually their own labels and sometimes are not.
 *
 * A STATUS IS RENDERED VERBATIM AND A KIND IS NOT. `Purchase Orders."Status"` puts
 * its own option text on the screen, so the value and the label are one string and
 * writing them twice would be two places for one word. A request's kind is a key
 * `lib/prKind.js` derives — `direct-purchase` is not a word any screen says — so
 * that axis passes `{ value, label }` and takes its labels from `PR_KIND_COPY`,
 * which is where the two marks already live.
 */
export function choiceValue(choice) {
    return typeof choice === "string" ? choice : choice.value;
}
export function choiceLabel(choice) {
    return typeof choice === "string" ? choice : choice.label;
}

/**
 * A picker's options, taken from the rows the reader can already see.
 *
 * OPTIONS COME FROM THE VISIBLE ROWS ON ALL FOUR LISTS, which is `/pos`'s rule rather
 * than `/prs`'s. That list offered every job the reader was ASSIGNED to, which is
 * wrong in both directions: an assignment with no request on it is an option that
 * empties the table, and a request reachable without an assignment — a signer's, an
 * edit-request recipient's — is a row that cannot be filtered to. Reading the rows
 * has neither failure and leaks nothing, since every value named is already in a
 * column this reader is looking at.
 *
 * A ROW WHOSE ID OR LABEL IS MISSING CONTRIBUTES NO OPTION, rather than an option
 * that reads as a dash. Sorted by label, because that is what the reader is scanning.
 */
export function pickerOptions(rows, idKey, labelFor) {
    const byId = new Map();
    for (const row of rows ?? []) {
        const id = row?.[idKey];
        if (!id || byId.has(id)) continue;
        const label = labelFor(row);
        if (label) byId.set(id, label);
    }
    return [...byId]
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * What a job reads as inside a picker: the code, and the name when there is one.
 *
 * THE CODE ALONE IS WHAT THE COLUMN SHOWS AND IT IS NOT ENOUGH TO PICK BY. `26-DEMO-01`
 * is a house format, matched rather than read, so the picker carries the name as well
 * and the search runs over both — which is what the job dropdown has always done. It
 * is here rather than in each page because four lists draw this one option now, and a
 * separator spelled four times is four chances to spell it differently.
 */
export function jobOptionLabel(jobCode, jobName) {
    if (!jobCode) return null;
    return jobName ? `${jobCode} — ${jobName}` : jobCode;
}

/** Which values one axis will accept, given the options the server computed. */
function allowedValues(axis, choices) {
    if (axis.control === CONTROL.picker) return new Set((choices ?? []).map((c) => c.id));
    if (axis.control === CONTROL.select) return new Set((choices ?? []).map(choiceValue));
    return null;
}

/**
 * Whether one axis is narrowing anything, which is one question asked in four places.
 *
 * THE SEARCH ANSWERS WITH ITS TOKENS RATHER THAN WITH ITS STRING, so a box holding
 * nothing but spaces is idle. The alternative — `Boolean(value)` — draws the count and
 * the clear control, says `0 of 40`, and quotes a run of spaces back at the reader in
 * an empty-state sentence. `searchTokens` already folds whitespace, so asking it is
 * asking the matcher what it would do.
 */
function axisActive(axis, value) {
    if (axis.control === CONTROL.search) return searchTokens(value).length > 0;
    if (axis.control === CONTROL.picker) return (value?.length ?? 0) > 0;
    if (axis.control === CONTROL.select) return Boolean(value);
    return value === true;
}

/** The search axis one list carries, or null — three of the four kinds have none. */
function searchAxis(route) {
    return axesFor(route).find((axis) => axis.control === CONTROL.search) ?? null;
}

/** The term as a sentence should quote it: tidied, and empty unless it would narrow. */
function searchTerm(route, state) {
    const axis = searchAxis(route);
    if (!axis) return "";
    const value = state?.[axis.param];
    if (!axisActive(axis, value)) return "";
    return String(value).trim().replace(/\s+/g, " ");
}

/** Whether anything BUT the box is narrowing — what decides the third sentence's tail. */
function otherFiltersActive(route, state) {
    return axesFor(route).some(
        (axis) => axis.control !== CONTROL.search && axisActive(axis, state?.[axis.param])
    );
}

/**
 * A fresh, wholly unfiltered state for one list.
 *
 * THE STATE IS PLAIN AND SERIALIZABLE — an array per picker, a string per select, a
 * boolean per toggle — so the server's parse crosses to the browser unchanged and
 * becomes the client's `useState` with no conversion step. A `Set` would not survive
 * that boundary, and a pair of converters on either side of it is two more places for
 * a new axis to be forgotten. Selections are a handful by construction, so `includes`
 * costs nothing worth a second shape.
 */
export function emptyFilters(route) {
    const state = {};
    for (const axis of axesFor(route)) {
        if (axis.control === CONTROL.picker) state[axis.param] = [];
        // A search and a select are both the empty string idle, for the same reason:
        // that is what an `<input>` and a `<select>` each hold when nothing is chosen,
        // so the state crosses to the browser and becomes the control's value with no
        // conversion step.
        else if (axis.control === CONTROL.select || axis.control === CONTROL.search)
            state[axis.param] = "";
        else state[axis.param] = false;
    }
    return state;
}

/**
 * The filter state a URL asks for, dropped to what this reader's options allow.
 *
 * EVERY VALUE IS CHECKED AGAINST THE OPTIONS THE SERVER COMPUTED, so a forged or
 * stale `?job=` in a pasted link is dropped before it reaches the browser. That was
 * already true of `job` and `status` on the two lists that had them; it is the rule
 * for every axis now. A picker takes a repeated parameter, a select one value, and a
 * toggle the literal `1` — absence is the unfiltered state and nothing ever encodes
 * "all", so a bare URL is the whole list.
 *
 * `options` IS THE SAME OBJECT THE BAR RENDERS FROM — `[{ id, label }]` per picker
 * and a list of choices per select — so the set a value is checked against and the
 * set a reader can pick from are one thing by construction. Two lists would be two
 * places to forget an axis, and the forgetting would be silent in exactly one
 * direction: a value accepted that no control can produce.
 */
export function parseFilters(route, searchParams, options = {}) {
    const sp = searchParams ?? {};
    const state = emptyFilters(route);
    for (const axis of axesFor(route)) {
        const raw = sp[axis.param];
        const allowed = allowedValues(axis, options[axis.param]);
        // THE SEARCH IS THE ONE AXIS WITH NOTHING TO INTERSECT AGAINST, and that is the
        // kind rather than a gap in the validation. Its values are not a set — the
        // reader may type a vendor's own invoice number, which no control in this app
        // offers — so there is no options list a URL could be checked against. Nothing
        // is lost: the term never reaches Airtable and never widens the gated rows, so
        // a forged `?q=` narrows this reader's own list and does nothing else. A
        // repeated `?q=a&q=b` arrives as an array and is refused rather than joined,
        // because one box holds one term.
        if (axis.control === CONTROL.search) {
            state[axis.param] = typeof raw === "string" ? raw : "";
        } else if (axis.control === CONTROL.picker) {
            const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
            state[axis.param] = [...new Set(values.filter((v) => allowed.has(v)))];
        } else if (axis.control === CONTROL.select) {
            state[axis.param] = allowed.has(raw) ? raw : "";
        } else {
            state[axis.param] = raw === "1";
        }
    }
    return state;
}

/**
 * Whether any axis is narrowing anything.
 *
 * THE BOX COUNTS, so `N of M` and `Clear all filters` appear for a typed term exactly
 * as they do for a picked job — and `Clear all filters` empties the box too, which is
 * what "all" has to mean for a control sitting in this bar.
 */
export function filtersActive(route, state) {
    return axesFor(route).some((axis) => axisActive(axis, state?.[axis.param]));
}

/**
 * Whether one pre-shaped row survives the whole bar.
 *
 * AXES COMPOSE WITH AND, AND A PICKER'S OWN SELECTION WITH OR. Two jobs selected
 * means either job; a job and a vendor selected means both. That is what the two
 * existing bars already did, stated once instead of three times.
 *
 * A ROW WHOSE AXIS VALUE IS ABSENT SURVIVES ONLY WHILE THAT AXIS IS UNSELECTED, and
 * there is deliberately no `(none)` option to reach it with. All four documents
 * require a vendor at creation and three of the four require a job, so the case is a
 * broken record rather than a state; the fourth is an invoice whose walk found two
 * jobs and named neither, which `docs/briefs/invoices.md` records as a state no
 * reader has met. An option for a case nobody has met is a word coined for nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SEARCH IS AN AXIS LIKE THE REST, SO A TYPED NAME AND A CHOSEN ONE COMPOSE WITH
 * AND (#325). Typing `Acme` with the vendor picker set to `Beta Supply` returns
 * nothing, which is right: the reader said two different things, and the count beside
 * `Clear all filters` is how they see it and get out. Neither control touches the
 * other — the box does not preselect a picker and a picker does not fill the box —
 * because one narrowing silently rewriting another would put a state in a shared link
 * that the screen never showed.
 *
 * ITS OWN TOKENS COMPOSE WITH AND ACROSS THE WHOLE ROW, NOT WITHIN ONE FIELD. The
 * row's several names are joined into ONE haystack, so `Acme 2608` finds an invoice
 * from Acme whose id carries 2608 — two tokens, two fields, one row. Three reasons,
 * and the third decides it:
 *
 *   THE PREMISE OF THE BOX IS THAT THE READER DOES NOT KNOW THE FIELDS. Requiring one
 *   field to hold every token is requiring them to, and the most ordinary thing a
 *   person holding a document types — a vendor and a number — would find nothing.
 *
 *   THE ASYMMETRY (#357's, and the reason substring beat word-boundary there). Joining
 *   can only ADD matches, and an unwanted one is narrowed by typing another word;
 *   per-field can only LOSE them, and a missing match is recoverable by nothing.
 *
 *   `/materials` ALREADY MATCHES ACROSS FIELDS AND THE TWO BOXES MUST NOT DIVERGE.
 *   Its haystack is `Material Label`, itself a concatenation of category path, size
 *   and unit, and `buildSearchTokens` records the consequence in as many words: a
 *   token may land in the size or the unit part, "acceptable: the user typed it and
 *   can see what came back". Choosing per-field here would make one rule behave two
 *   ways on identical input, which is what converging the tokenizer was for.
 *
 * JOINING ON A SPACE IS ENOUGH AND NEEDS NO SEPARATOR CHARACTER. A token never
 * contains a space — `searchTokens` split on one — so nothing can straddle two joined
 * values. A nullish key contributes nothing rather than the string `null`; a rendering
 * fallback the row already carries (`—`, `Unknown vendor`) is searchable, which is a
 * consequence of matching the strings the columns show rather than a feature, and the
 * reader can see what came back.
 */
export function matchesFilters(route, state, row) {
    return axesFor(route).every((axis) => {
        const value = state?.[axis.param];
        if (axis.control === CONTROL.search) {
            const tokens = searchTokens(value);
            if (!tokens.length) return true;
            const haystack = axis.keys
                .map((key) => row?.[key])
                .filter((held) => held !== null && held !== undefined)
                .join(" ");
            return matchesTokens(haystack, tokens);
        }
        const held = row?.[ROW_KEY[axis.param]];
        if (axis.control === CONTROL.picker) return !value?.length || value.includes(held);
        if (axis.control === CONTROL.select) return !value || held === value;
        return value !== true || held === true;
    });
}

/** The rows one bar admits, in the order they arrived. */
export function applyFilters(route, state, rows) {
    return (rows ?? []).filter((row) => matchesFilters(route, state, row));
}

/**
 * The query string a state produces, in the axis order the list declares.
 *
 * ONE STATE, ONE URL. Building from the declaration rather than from a hand-written
 * sequence per client is what makes two readers who picked the same filters able to
 * compare links, and it is what keeps a new axis from landing in a different place
 * on each of the four screens.
 */
export function filterQuery(route, state) {
    const params = new URLSearchParams();
    for (const axis of axesFor(route)) {
        const value = state?.[axis.param];
        // A box holding only whitespace writes nothing, for the reason nothing ever
        // encodes "all": a bare URL and a cleared one have to be one string for one
        // screen, and `?q=%20` is a third.
        if (axis.control === CONTROL.search) {
            if (axisActive(axis, value)) params.set(axis.param, value);
        } else if (axis.control === CONTROL.picker)
            (value ?? []).forEach((v) => params.append(axis.param, v));
        else if (axis.control === CONTROL.select) {
            if (value) params.set(axis.param, value);
        } else if (value === true) params.set(axis.param, "1");
    }
    return params.toString();
}

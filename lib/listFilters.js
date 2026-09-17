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
// PURE, AND IT HAS TO STAY THAT WAY. Four Client Components import this, so an
// import that reached `lib/airtable/` would throw `Missing AIRTABLE_API_KEY` in the
// browser. It imports nothing at all, which also lets the offline tier pin every
// clause under plain `node`. The per-list OPTION VALUES — which jobs, which vendors,
// which statuses — are the pages' and are passed in; what lives here is which axes a
// list carries, what each is called, how they compose, and what the screen says.

/**
 * The three control kinds, and the only three.
 *
 * WHICH KIND AN AXIS TAKES IS PRODUCED BY THE AXIS, NOT CHOSEN PER SCREEN. A set of
 * records the reader picks from is a `picker` (searchable, several at once, because
 * the reader works across jobs and chases vendors one at a time and one control
 * serves both). A closed set of values with more than one meaningful side is a
 * `select`. A flag whose only useful narrowing is one-directional is a `toggle` —
 * there is no reader who wants "everything except mine".
 */
export const CONTROL = {
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
 */
export const LIST_AXES = {
    "/prs": [
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
    "/pos": [JOB, VENDOR, mine("Requested by me"), status()],
    "/deliveries": [
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
    "/invoices": [JOB, VENDOR, mine("Recorded by me"), status()],
};

/** Every route that carries a bar, for a caller that needs to walk them. */
export const FILTERED_LISTS = Object.keys(LIST_AXES);

/**
 * The parameter names a filter may use, and the two held for work not done here.
 *
 * RESERVED RATHER THAN BUILT. #325 gives these lists a search and #326 gives them a
 * page, and both are behind the design pass — but the names are settled now, so
 * neither issue has to rewrite what is in the URL today. `q` is what `/materials`
 * already calls a search term and `page` is what `/tools/[toolRecordId]` already
 * calls a slice, so both are inherited rather than coined. They are deliberately NOT
 * in `offline/url-parameters.mjs`'s inventory: an entry there must be read by its
 * screen, and nothing reads these yet.
 */
export const FILTER_PARAMS = ["job", "vendor", "status", "kind", "mine", "over"];
export const RESERVED_PARAMS = { search: "q", page: "page" };

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
export const LIST_EMPTY_COPY = {
    "/prs": {
        none: "No purchase requests yet. Raise one and it appears here once it is submitted.",
        hidden:
            "No purchase requests to show. You see a request you raised, one on a job you are " +
            "assigned to, or one you are asked to sign.",
        filtered: "No purchase requests match these filters.",
    },
    "/pos": {
        none:
            "No purchase orders yet. One is generated automatically when a purchase request is " +
            "fully approved.",
        hidden:
            "No purchase orders to show. You see a purchase order when you can see the request " +
            "behind it.",
        filtered: "No purchase orders match these filters.",
    },
    "/deliveries": {
        none:
            "No deliveries recorded yet. Record one as material is delivered — the packing list " +
            "photo is what makes it a record.",
        hidden:
            "No deliveries to show. You see a delivery when it is on a job you are assigned to. " +
            "An Admin can add you to a job in Airtable.",
        filtered: "No deliveries match these filters.",
    },
    "/invoices": {
        none: "No invoices yet.",
        hidden:
            "No invoices to show. You see an invoice when it charges a purchase order you raised " +
            "or one on a job you are assigned to.",
        filtered: "No invoices match these filters.",
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
        else if (axis.control === CONTROL.select) state[axis.param] = "";
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
        if (axis.control === CONTROL.picker) {
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

/** Whether any axis is narrowing anything. */
export function filtersActive(route, state) {
    return axesFor(route).some((axis) => {
        const value = state?.[axis.param];
        if (axis.control === CONTROL.picker) return (value?.length ?? 0) > 0;
        if (axis.control === CONTROL.select) return Boolean(value);
        return value === true;
    });
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
 */
export function matchesFilters(route, state, row) {
    return axesFor(route).every((axis) => {
        const value = state?.[axis.param];
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
        if (axis.control === CONTROL.picker) (value ?? []).forEach((v) => params.append(axis.param, v));
        else if (axis.control === CONTROL.select) {
            if (value) params.set(axis.param, value);
        } else if (value === true) params.set(axis.param, "1");
    }
    return params.toString();
}

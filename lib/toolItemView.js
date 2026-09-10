// What one tool item's page shows (#340) — the facts a `Tool Log` row renders,
// and every word the screen says.
//
// PURE AND OFFLINE-SAFE, importing nothing: `scripts/tests/offline/
// tool-item-view.mjs` pins it with no credentials, and the page is the only
// caller.
//
// WHAT A LOG ROW SHOWS IS FOUR FACTS, ALWAYS ALL FOUR, IN ONE ORDER. Stating
// that in code rather than only in the brief is what makes it checkable — a
// design that hides one, or that folds a repeated `Job` away, is undoing a
// decision rather than styling one.
//
// IT WAS FIVE UNTIL #363, AND THE FIFTH WENT WITH ITS FIELD. `Tool Log."Notes"`
// existed for one thing: the reason a `Retired` event would require. That
// requirement was weighed and dropped — see docs/notes/tools.md — so the pair,
// the drops-when-blank rule and the assertions holding it all went in one
// commit, and the field itself comes off the base by hand.
//
// THAT LEAVES THIS MODULE WITH ONE RULE FEWER AND ITS REASON FOR EXISTING
// INTACT, which is worth saying because the question was asked. It was never
// only `logRowFacts`: it also owns `TOOL_ITEM_COPY`, which lib/toolListView.js
// and lib/toolTransition.js both read out of rather than re-spelling, and
// `EVENT_AT_FORMAT` with the measured condition for merging it. And the
// decisive half is structural — the page imports lib/airtable/, so a rule moved
// into it leaves the offline tier altogether, which is the same reason
// lib/toolStatus.js was split out of lib/airtable/toolItems.js.
//
// WHAT IS DELIBERATELY NOT HERE: any comparison between `Tool Items."Status"` /
// `"Job"` and what the log implies. Those two fields are caches of the last log
// row, and a screen sentence for a disagreement would need a reader to know what
// a cache is, a design for where it sits, a brief entry and a check.
// `docs/notes/tools.md` already records that the fields are derived; the page
// reads them and says nothing about their provenance.
//
// **THIS PARAGRAPH ALSO SAID THE DISAGREEMENT WAS REACHABLE ONLY BY EDITING
// AIRTABLE BY HAND, AND #362 MADE THAT FALSE.** That transition writes the log
// row and then the cache, two writes with no transaction between them, so a
// failure in the second leaves exactly this state — by an app path, with nobody
// having touched the base. The conclusion did not move and the other three costs
// above are why. Three things carry it instead of a comparison here: the action
// names the state to the one person who can act on it and logs the record id, the
// next press writes the same event again and the two agree, and nothing else on
// the axis has to learn what a cache is. Deriving the status HERE would still be
// wrong for its own reason — the two list screens read the cache, so this page
// would be the one surface saying something different about where a tool item is.
//
// EVERY STRING THE SCREEN RENDERS IS BELOW AND NONE IS IN JSX, which is this
// axis's arrangement since #338: a word written into a component is invisible to
// the vocabulary checks and to `scripts/screen-strings.mjs`, so it cannot be
// swept when a word changes, and it is not Design's to reword in one place.

/**
 * The facts one `Tool Log` row renders, in order, as label-and-value pairs.
 *
 * Values arrive already resolved — a person's name rather than a record id, a
 * job code rather than a link — because resolving them is a read and this module
 * makes none.
 *
 * ALL FOUR ARE ALWAYS THERE, AND EACH IS AN INVARIANT OF THE BASE RATHER THAN A
 * VALUE THIS MODULE MAY JUDGE. `Event` is a closed select written with no
 * `typecast`; `Event At` is stamped by the writer; `Job` is on every row and
 * never blank, which is the invariant that makes the previous row's job the
 * previous job and is why no `Former Job` is stored; and `Recorded By` is
 * written on every path that appends a row. A blank one is a defect upstream,
 * so the pair renders empty rather than disappearing and taking the defect with
 * it.
 *
 * THERE IS NO FIFTH AND NOTHING DROPS SINCE #363. `Notes` was the exception —
 * optional, absent on a `Registered` row, omitted rather than drawn empty — and
 * the field is gone from the base along with the rule it was kept for.
 *
 * A REPEATED `Job` IS NOT NOISE. A tool item that has never left its job carries
 * the same job on every row, and that is the normal reading rather than
 * something to collapse.
 */
export function logRowFacts({ event, eventAt, recordedByName, jobCode }) {
    return [
        { key: "event", label: TOOL_ITEM_COPY.eventLabel, value: event },
        { key: "eventAt", label: TOOL_ITEM_COPY.eventAtLabel, value: formatEventAt(eventAt) },
        { key: "job", label: TOOL_ITEM_COPY.jobLabel, value: jobCode },
        { key: "recordedBy", label: TOOL_ITEM_COPY.recordedByLabel, value: recordedByName },
    ];
}

/**
 * The parts of a moment a log entry shows: a date and a time to the minute.
 *
 * THE SAME FIVE OPTIONS `/prs/[prId]`'s HISTORY ALREADY PASSES, which is the only
 * other history in this app and is what the brief named as the precedent while this
 * screen still printed the stored value. That value is a UTC instant to the
 * millisecond — the longest and most machine-shaped string on the page — and what
 * an entry carries is a moment somebody reads, so seconds and milliseconds are
 * noise at the resolution a tool moves.
 *
 * A FOURTH COPY OF THESE OPTIONS, AND THE DUPLICATION IS DELIBERATE. The same
 * object is written out at three call sites already (`/prs/[prId]`'s history and
 * `/prs/new`'s two draft labels), so extracting one formatter would edit three
 * screens in another area to serve this one. **The measurable condition for
 * merging:** a fifth site, or the first screen that needs a different resolution —
 * at which point the set becomes a decision worth one module rather than a habit.
 * Until then this is the fourth, named and pinned, rather than an inline literal
 * nothing can see.
 */
export const EVENT_AT_FORMAT = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
};

/**
 * One `Tool Log` row's moment, as a reader sees it.
 *
 * IT RENDERS IN THE SERVER'S TIMEZONE, NOT THE READER'S, and that is inherited
 * rather than chosen: this page is a Server Component and so is `/prs/[prId]`, so
 * `toLocaleString` resolves against wherever the render happened — UTC on Vercel.
 * Naming it here because the string no longer says so: the stored value carried a
 * `Z` and this does not, so a reader on a site cannot tell from the page which zone
 * they are reading. Fixing it needs either a client boundary on the one screen this
 * axis draws for a phone or a stored offset, and neither is this decision.
 *
 * AN UNPARSEABLE VALUE COMES BACK UNCHANGED rather than as `Invalid Date`. A blank
 * is what an empty pair renders from, and a stored string this cannot read is more
 * honestly shown as itself than as a formatter's complaint — the four facts of a
 * log row never drop, so there is always a pair to fill.
 */
export function formatEventAt(eventAt) {
    if (eventAt === null || eventAt === undefined) return eventAt;
    const at = new Date(eventAt);
    if (Number.isNaN(at.getTime())) return eventAt;
    return at.toLocaleString(undefined, EVENT_AT_FORMAT);
}

/**
 * Every word the tool item's page renders.
 *
 * THE PAGE HAS NO HEADING WORD — its heading is the `Tool Item ID`, which is the
 * shape the four document detail screens already take, and here it is also the
 * string printed on the label the reader is holding.
 */
export const TOOL_ITEM_COPY = {
    toolLabel: "Tool",
    statusLabel: "Status",
    jobLabel: "Job",

    // The symbol section (#352). It is here for a reader to SEE what a reprinted
    // label will carry, not to be scanned off the screen: somebody who typed the id
    // because the sticker had worn through is already on this page, so a scan of it
    // would return them where they are, and the scan that does work is Phase 3's.
    // That is why the heading names the label rather than the code.
    labelHeading: "Label",
    // A VISIBLE ATTRIBUTE, so it may not be written into the JSX —
    // `offline/tool-list-view.mjs` fails an `alt` literal on this axis. It also
    // doubles as the failure state: an image that cannot load shows its alt, and
    // the one way this one fails is a session that expired between the render and
    // the fetch. So it names the thing rather than describing the picture.
    symbolAlt: "QR label for this tool item",
    // The symbol is drawn at the size it prints at, which is a fact rather than a
    // style — see the brief. This says so, because a reader comparing it against
    // the sticker in their hand needs to know the comparison is meant.
    printedSizeNote: "Shown at the size it prints.",

    historyHeading: "History",
    eventLabel: "Event",
    eventAtLabel: "When",
    recordedByLabel: "Recorded by",
    // `notesLabel` was here and went with `Tool Log."Notes"` in #363.

    // A tool item exists and its history does not, which #338 can leave behind:
    // its registration writes the tool item and then the first log row, and a
    // failure between the two is reported but not repaired. Said as what is
    // missing rather than as an error, because the row itself is sound — it has
    // its printed id, its status and its job.
    noHistory:
        "Nothing has been recorded against this tool item, so nothing holds when it " +
        "came into existence.",

    // The same shape every other detail screen in this app uses for a record it
    // cannot find, and here there is only one way to reach it: no tool item
    // carries this id. Nothing on this axis is scoped by role or job, so unlike
    // the request, order and invoice screens this refusal answers one state
    // rather than standing in for two.
    notFoundHeading: "Tool item not found",
    backToTools: "← Tools",
};

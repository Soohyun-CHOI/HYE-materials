// What one tool item's page shows (#340) — the facts a `Tool Log` row renders,
// and every word the screen says.
//
// PURE AND OFFLINE-SAFE: `scripts/tests/offline/tool-item-view.mjs` pins it with
// no credentials. **It imported nothing at all until #376**, which needed the
// event vocabulary to decide whether a row carries a fifth fact — so it imports
// `./toolStatus.js` with the extension spelled out, the precedent
// `lib/toolTransition.js` already sets for this tier's loaderless `node`. The
// alternative was comparing against a spelled `"Checked Out"`, which is the
// literal `createToolLogEntry` has a rule against, or asking the page to decide,
// which is the arrangement #374 argued out of this module.
//
// WHAT A LOG ROW SHOWS IS FOUR FACTS, ALWAYS ALL FOUR, IN ONE ORDER — AND A
// FIFTH ON A `Checked Out` ROW AND NOWHERE ELSE (#376). Stating that in code
// rather than only in the brief is what makes it checkable: a design that hides
// one of the four, or that folds a repeated `Job` away, is undoing a decision
// rather than styling one.
//
// IT WAS FIVE UNTIL #363 AND THE FIFTH WENT WITH ITS FIELD, WHICH IS A DIFFERENT
// SHAPE FROM THE ONE #376 ADDED — and the difference is the whole reason one was
// deleted and one was built. `Tool Log."Notes"` existed for one thing, the reason
// a `Retired` event would require; that requirement was weighed and dropped, so
// the field had no rule left and no row had ever filled it. It was OPTIONAL on
// every event, which means nothing could be asserted about when it should be
// there. `Checked Out To` is a FUNCTION OF THE EVENT: always present on one of the
// four and always absent on the other three, enforced at the writer in both
// directions, so the check asks over the whole vocabulary and a fifth event cannot
// arrive without deciding which side it is on. An always-empty field and a field
// whose presence is a rule are not the same thing to keep.
//
// THAT LEAVES THIS MODULE WITH ONE RULE FEWER AND ITS REASON FOR EXISTING
// INTACT, which is worth saying because the question was asked. It was never
// only `logRowFacts`: it also owns `TOOL_ITEM_COPY`, which lib/toolListView.js
// and lib/toolTransition.js both read out of rather than re-spelling. It owned
// `EVENT_AT_FORMAT` too, with the measured condition for merging it, and #374
// was that condition firing — the options are `lib/format.js:INSTANT_FORMAT`
// now and a moment is drawn by `app/components/Instant.js`. And the
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

// The one import this module has, and what it is for: whether a row carries the
// fifth fact is a question about the EVENT, so the vocabulary has to be in hand.
import { TOOL_EVENT } from "./toolStatus.js";

/**
 * What a fact's value IS, for the one of the four that is not a printable string
 * (#374).
 *
 * A pair with no `kind` carries text the page prints. The one that carries this
 * holds a stored instant, which only a browser can resolve into a zone — so the
 * page draws it rather than printing it. Naming the kind on the pair keeps that
 * knowledge in the module that owns the row: the alternative was the page
 * testing `fact.key === "eventAt"`, which puts the row's shape in the screen.
 */
export const FACT_KIND = Object.freeze({ instant: "instant" });

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
 * THE FIFTH IS THE EVENT'S, NOT THE ROW'S (#376). A `Checked Out` row carries who
 * the tool went to and the other three carry nobody, so the pair is decided by the
 * event rather than by whether a value happens to be there. That is what makes it
 * unlike `Notes`, which was optional everywhere and is why this module can state
 * the rule instead of testing for a blank: a missing name on a check-out is a
 * defect upstream, and it renders empty rather than disappearing and taking the
 * defect with it — the same treatment the four above get.
 *
 * IT COMES LAST because the four before it are what every row answers, and a
 * design reading the list top-down meets the common shape first.
 *
 * A REPEATED `Job` IS NOT NOISE. A tool item that has never left its job carries
 * the same job on every row, and that is the normal reading rather than
 * something to collapse.
 */
export function logRowFacts({ event, eventAt, recordedByName, jobCode, checkedOutTo }) {
    return [
        { key: "event", label: TOOL_ITEM_COPY.eventLabel, value: event },
        // #374 — THE RAW INSTANT, AND THE PAIR SAYS SO. Every other fact here
        // is a string the page prints; this one is a moment, and a moment can
        // only be resolved into a zone by the browser the reader is holding. So
        // the value stays as stored and `kind` is what tells the page to draw it
        // through `app/components/Instant.js` rather than printing it. The four
        // facts, their order and their never-dropping are unchanged.
        { key: "eventAt", kind: FACT_KIND.instant, label: TOOL_ITEM_COPY.eventAtLabel, value: eventAt },
        { key: "job", label: TOOL_ITEM_COPY.jobLabel, value: jobCode },
        { key: "recordedBy", label: TOOL_ITEM_COPY.recordedByLabel, value: recordedByName },
        ...(event === TOOL_EVENT.CHECKED_OUT
            ? [{ key: "checkedOutTo", label: TOOL_ITEM_COPY.checkedOutToLabel, value: checkedOutTo }]
            : []),
    ];
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
    // #376 — ON A `Checked Out` ENTRY AND NOWHERE ELSE, and the same words the
    // control that wrote it says. `lib/toolTransition.js` reads this out rather
    // than spelling its own, which is the arrangement that module's header
    // describes for the three it already borrows: one fact, one word, wherever it
    // is shown. The screen, the field on the base and the history entry all say
    // `Checked out to`.
    checkedOutToLabel: "Checked out to",
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

// What one tool item's page shows (#340) — the facts a `Tool Log` row renders,
// and every word the screen says.
//
// PURE AND OFFLINE-SAFE, importing nothing: `scripts/tests/offline/
// tool-item-view.mjs` pins it with no credentials, and the page is the only
// caller.
//
// THE ONE RULE HERE IS WHICH OF A LOG ROW'S FACTS APPEAR. Four of the five are
// on every row and the fifth is the ordinary absence, and stating that in code
// rather than only in the brief is what makes it checkable — a design that draws
// `Notes` as always present, or that folds a repeated `Job` away, is undoing a
// decision rather than styling one.
//
// WHAT IS DELIBERATELY NOT HERE: any comparison between `Tool Items."Status"` /
// `"Job"` and what the log implies. Those two fields are caches of the last log
// row, so a disagreement is reachable only by editing Airtable by hand — which
// this base forbids — and the only writer of the caches is the code that writes
// the row. A screen sentence for that state would need a reader to know what a
// cache is, a design for where it sits, a brief entry and a check, all for
// something no path produces. `docs/notes/tools.md` already records that the
// fields are derived; the page reads them and says nothing about their
// provenance.
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
 * FOUR ARE ALWAYS THERE AND `Notes` IS THE ONE THAT DROPS. `Event` is a closed
 * select written with no `typecast`; `Event At` is stamped by the writer;
 * `Job` is on every row and never blank, which is the invariant that makes the
 * previous row's job the previous job and is why no `Former Job` is stored; and
 * `Recorded By` is written on every path that appends a row. `Notes` is optional
 * and blank is the ordinary case — a `Registered` row carries none — so it is
 * omitted rather than rendered empty. `docs/notes/tools.md` records the pending
 * rule that a `Retired` event should require one, which nothing enforces yet.
 *
 * A REPEATED `Job` IS NOT NOISE. A tool item that has never left its job carries
 * the same job on every row, and that is the normal reading rather than
 * something to collapse.
 */
export function logRowFacts({ event, eventAt, recordedByName, jobCode, notes }) {
    const facts = [
        { key: "event", label: TOOL_ITEM_COPY.eventLabel, value: event },
        { key: "eventAt", label: TOOL_ITEM_COPY.eventAtLabel, value: eventAt },
        { key: "job", label: TOOL_ITEM_COPY.jobLabel, value: jobCode },
        { key: "recordedBy", label: TOOL_ITEM_COPY.recordedByLabel, value: recordedByName },
    ];
    const note = String(notes ?? "").trim();
    if (note) facts.push({ key: "notes", label: TOOL_ITEM_COPY.notesLabel, value: note });
    return facts;
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

    historyHeading: "History",
    eventLabel: "Event",
    eventAtLabel: "When",
    recordedByLabel: "Recorded by",
    notesLabel: "Notes",

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

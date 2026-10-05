// What one tool item's page shows (#340) — the facts a `Tool Log` row renders,
// and every word the screen says.
//
// PURE AND OFFLINE-SAFE: `scripts/tests/offline/tool-item-view.mjs` pins it with
// no credentials. **It imported nothing at all until #376**, which needed the
// event vocabulary to decide whether a row carries a fifth fact — so it imports
// `./toolStatus.js` with the extension spelled out, the precedent
// `lib/toolTransition.js` already sets for this tier's loaderless `node`. The
// alternative was comparing against a spelled `"Checked out"`, which is the
// literal `createToolLogEntry` has a rule against, or asking the page to decide,
// which is the arrangement #374 argued out of this module.
//
// WHAT A LOG ROW SHOWS IS FOUR FACTS, ALWAYS ALL FOUR — AND A FIFTH ON A
// `Checked out` ROW AND NOWHERE ELSE (#376). Stating that in code rather than
// only in the brief is what makes it checkable: a design that hides one of the
// four, or that folds a repeated `Job` away, is undoing a decision rather than
// styling one. **Where each stands is the design's since #463**, which lays an
// entry out one way at a desk and another on a phone (1c, 1f) and labels none of
// them; the facts are handed over in one order and the page places them.
//
// AND #463 PUT THE REST OF WHAT THE PAGE READS OFF ITS HISTORY HERE: the order the
// entries stand in, who holds a tool that is out, when a retired one was retired,
// and the mark each status is drawn with. All four are rules over rows the page
// already has, so each is a function rather than a line of the page.
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
// fifth fact is a question about the EVENT, so the vocabulary has to be in hand —
// and since #463 so are the statuses, which the marks and the holder are asked of.
import { TOOL_EVENT, TOOL_STATUS } from "./toolStatus.js";
import { normalizeItemText } from "./itemNaming.js";

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
 * The facts one `Tool Log` row renders, in one order, as key-and-value pairs.
 *
 * Values arrive already resolved — a person's name rather than a record id, a
 * job code rather than a link — because resolving them is a read and this module
 * makes none.
 *
 * NO LABELS SINCE #463. Each pair carried the word a definition list printed beside
 * it — `Event`, `When`, `Job`, `Recorded by` — and the design draws an entry with
 * none: the event, the person it went to after `to`, the moment, the job and who
 * recorded it after `by`, the two words in `TOOL_ITEM_COPY` (1c, 1f). The page reads
 * the pairs by key and lays them out per width.
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
 * THE FIFTH IS THE EVENT'S, NOT THE ROW'S (#376). A `Checked out` row carries who
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
        { key: "event", value: event },
        // #374 — THE RAW INSTANT, AND THE PAIR SAYS SO. Every other fact here
        // is a string the page prints; this one is a moment, and a moment can
        // only be resolved into a zone by the browser the reader is holding. So
        // the value stays as stored and `kind` is what tells the page to draw it
        // through `app/components/Instant.js` rather than printing it. The four
        // facts, their order and their never-dropping are unchanged.
        { key: "eventAt", kind: FACT_KIND.instant, value: eventAt },
        { key: "job", value: jobCode },
        { key: "recordedBy", value: recordedByName },
        ...(event === TOOL_EVENT.CHECKED_OUT ? [{ key: "checkedOutTo", value: checkedOutTo }] : []),
    ];
}

/**
 * The history in the order the page draws it: the newest entry first (#463).
 *
 * THE DESIGN'S ORDER, AND IT TURNED #340's AROUND. The history read oldest first, as
 * `/prs/[prId]`'s does, so it began where the tool item did; the design draws the
 * latest scan at the top on both widths (1c, 1f), which is the one a reader standing
 * over the tool came to check. The rows arrive in `findChildRecords`' order — the link
 * array's, which is creation order and for an append-only table chronological — so the
 * newest first is that order turned over, with no timestamp parsed. **A tool's own list
 * takes the same turn** (`pageOfToolItems`, 1b), over its `Tool Items` array: one
 * judgment of what a link array's order means, so it is made here once.
 */
export function newestFirst(rows) {
    return [...(rows || [])].reverse();
}

/**
 * Who holds a tool item that is out: the name its latest entry checked it out to, or
 * null (#463).
 *
 * THE VALUE ONLY ONE STATE HAS, beside the status (0n, 1d, 1f): `Out` and the person.
 * It is read off the LATEST entry and nothing older — when that entry is not a
 * check-out, the cached status and the log disagree (`statusNotUpdated`'s state) and an
 * older name would be a guess; the status still says `Out` and no one is named. A
 * check-out written before the app asked for a name names no one either.
 */
export function currentHolder(newestFirstRows, status) {
    if (status !== TOOL_STATUS.OUT) return null;
    const latest = newestFirstRows?.[0];
    if (latest?.event !== TOOL_EVENT.CHECKED_OUT) return null;
    return normalizeItemText(latest.checkedOutTo) || null;
}

/**
 * When a retired tool item was retired: its latest entry's moment when that entry is the
 * retirement, or null (#463) — the other value only one state has, which the desk draws
 * after `Retired` (1c).
 */
export function retiredAt(newestFirstRows, status) {
    if (status !== TOOL_STATUS.RETIRED) return null;
    const latest = newestFirstRows?.[0];
    return latest?.event === TOOL_EVENT.RETIRED ? latest.eventAt ?? null : null;
}

/**
 * The mark each status is drawn with (0g, #463): `settled` a solid dot, the state a
 * tool rests at in stock; `open` a ring, out and waiting to come back; `ended` the ring
 * struck through, the design's shape for the one end.
 *
 * KEYED BY THE STATUS AND TOTAL OVER IT, so a fourth status cannot arrive without a
 * shape — `summarizeTools`' argument for drawing all three counts. The shapes are drawn
 * by `app/(tools)/StatusMark.js`; their ink is Ink 3 whatever the status (0g).
 */
export const STATUS_MARK = Object.freeze({
    [TOOL_STATUS.IN_STOCK]: "settled",
    [TOOL_STATUS.OUT]: "open",
    [TOOL_STATUS.RETIRED]: "ended",
});

/**
 * Every word the tool item's page renders.
 *
 * THE PAGE'S HEADING IS THE TOOL'S NAME SINCE #463, the design's (1c, 1f): the record's
 * name, which is the shape 0n gives a record page, with the `Tool Item ID` under it at
 * a desk and in the top bar on a phone. It was the `Tool Item ID` itself until then —
 * the string printed on the label the reader is holding — and that string is still the
 * first thing either width shows beside the name. So the page has no heading word here.
 */
export const TOOL_ITEM_COPY = {
    toolLabel: "Tool",
    statusLabel: "Status",
    jobLabel: "Job",

    // The label block (#352), in the record rail at a desk (#463). It is here for a
    // reader to SEE what a reprinted label will carry, not to be scanned off the screen:
    // somebody who typed the id because the sticker had worn through is already on this
    // page, so a scan of it would return them where they are. That is why the heading
    // names the label rather than the code. A phone draws no label block (1f): a label is
    // printed at a desk.
    labelHeading: "Label",
    // THE PREVIEW'S NAME, AND THE FIRST SCREEN TO GIVE IT ONE (#463). It was written as an
    // `<img>`'s `alt` for #351's endpoint, which #352 deleted in the commit that added it,
    // and from then until #463 the page inlined the symbol's markup with no accessible name
    // at all — which #455 found in a browser, leaving whether the symbol took this or hid
    // as a copy of the heading to the design. The design draws the label as the label's own
    // page, the dialog's drawing, and gives it no name; an image takes one or hides, and it
    // takes this, since the code under the symbol is nothing a heading says. It stays out of
    // the JSX: `offline/tool-list-view.mjs` fails an attribute literal on this axis.
    symbolAlt: "QR label for this tool",
    // THE PRINT SIZE, IN TEXT (0p, #463), under the label drawn at whatever size reads in
    // its place — twice its size, the dialog's preview. Until then the page drew the symbol
    // alone at the size it prints at and said so in a sentence; the two figures are the
    // design's account of the same fact.
    sizeLabel: "Size",
    symbolLabel: "Symbol",
    symbolSize: (mm) => `${mm} mm`,
    // #453 — IN THE LABEL'S PLACE WHEN THE SYMBOL DOES NOT FIT THE STOCK. The label absorbs
    // no version step, so a host past seventeen characters builds a symbol the labels'
    // dialog will not print, and a drawing of the label and its size would then be the one
    // false thing on the page. It names the host for the reason that dialog's own sentence
    // does: a Vercel domain is the ordinary way here, and the fix there is printing from
    // the host a label should carry.
    symbolTooLargeNote:
        "The address from this host is long enough that this symbol does not fit the label stock, so it does not print.",

    historyHeading: "History",
    // THE TWO WORDS AN ENTRY CARRIES SINCE #463, which drew it without the labels the
    // facts had — `Checked out to Dana K` and `by Soo Choi` (1c, 1f). A word and not a
    // label: each joins the value after it to the line before it, at Ink 3.
    historyTo: "to",
    historyBy: "by",
    // #376 — WHO A TOOL WENT TO, and the same words the control that wrote it says.
    // `lib/toolTransition.js` reads this out rather than spelling its own, which is the
    // arrangement that module's header describes for the three it already borrows: one
    // fact, one word, wherever it is shown. The field on the base and the control both say
    // `Checked out to`, and the history reads `Checked out to Dana K` with this word's
    // `to` (1c).
    checkedOutToLabel: "Checked out to",
    // `notesLabel` was here and went with `Tool Log."Notes"` in #363. `eventLabel`,
    // `eventAtLabel` and `recordedByLabel` went with #463, which draws an entry unlabeled.

    // A tool item exists and its history does not, which #338 can leave behind: its
    // registration writes the tool item and then the first log row, and a failure between
    // the two is reported but not repaired. The design's words since #463 (1c, 1g); it said
    // what the missing row cost — that nothing holds when the tool was created — and the
    // design states the absence alone.
    noHistory: "No history yet",

    // THE ACCESSIBLE NAME OF THE BUTTON THAT OPENS THE RETIREMENT, at both widths (#463), and
    // the desk's tooltip on it, one string as the rail's icons are. The design names the
    // phone's `More`; a name nobody sees follows this app's rule, and the two buttons open one
    // menu, so one name.
    moreActions: "More actions",

    // A code no tool item carries — a scan of a label for one that is gone, or a code typed
    // wrong off a worn label. Nothing on this axis is scoped by role or job, so unlike the
    // request, order and invoice screens this answers one state rather than standing in for
    // two. **The design's words since #463** (1l, 1g): `tool` at last, and a sentence that
    // points at the label in the reader's hand, which #455 asked for. The desk names the code
    // asked for, set in the id face; a phone came from a scan and has the code in its top bar.
    notFoundHeading: "Tool not found",
    notFoundCode: { before: "No tool has the code ", after: ". Check it against the label." },
    notFoundScanned: "No tool has this code. Check it against the label and scan again.",
    backToTools: "Back to Tools",
};

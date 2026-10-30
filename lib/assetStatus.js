// The two closed vocabularies the assets track writes (#334, narrowed in #335, widened
// by #531 and #582) — where an asset can be, what can happen to one, and the eight maps
// over them: the status each event leaves behind, the event each status offers its page's
// one press (#362), whether `Retired` may be designated from it (#363), whether it may
// be sent for repair (#531), where each event's row takes its job from (#531),
// whether its note may be written (#533), whether its kind's total counts it (#569), and
// whether the app shows it at all (#582).
//
// ALL EIGHT ARE HERE BECAUSE THEY ARE ONE VOCABULARY SEEN FROM EIGHT SIDES, AND NO TWO
// OF THEM DERIVE FROM EACH OTHER. Three events land on `In stock`, so the first has no
// inverse; `Created` is offered by nothing, so the second is not the first read
// backwards; the third and the fourth ask about a transition a person chooses from a
// menu where the second asks about the page's press, and they part on `In stock`,
// which offers a check-out and may be sent for repair; the fifth splits the events
// on a line none of the others draws; the sixth asks about no event at all, and
// parts from the press on `In repair`; the seventh asks what a count holds rather
// than what anybody may do, and answers as the third does today, which is the
// coincidence the third's own doc warns about; and the eighth asks whether an asset is
// there at all, and parts from the seventh on `Retired`. So a new status or a new event
// has to visit all eight, and putting one of them beside the screen that reads it would
// leave the others unvisited. `offline/asset-status.mjs` pins them together for the same
// reason.
//
// WHY THIS IS ITS OWN MODULE, and not part of lib/airtable/assets.js where the
// writes live: that file imports lib/airtable/client.js, which throws
// `Missing AIRTABLE_TEST_API_KEY` at module load, so a plain `node` check cannot see
// anything inside it. Both of these lists have to be readable by two checks — the
// offline one that compares them against the option lists the creation script
// sends, and the credentialed one that compares them against the live fields.
// Same measured reason lib/authzWrap.js was split out of lib/authz.js (#147),
// lib/airtableFormula.js out of client.js (#159), lib/idSequence.js out of
// lib/ids.js (#164) and lib/editLogFields.js out of a Server Action (#181).
//
// IMPORTS NOTHING, and must not start. The offline tier runs under plain `node`
// with no loader.
//
// NEITHER LIST CAN BE EDITED AFTER THE FIELD EXISTS. Measured and recorded in
// docs/notes/airtable-access.md: a PATCH carrying `options.choices` on a
// singleSelect is refused 422 in every shape tried, so the choices go in on field
// CREATE or they go in by hand in the Airtable UI. That is why
// scripts/tests/offline/asset-status.mjs pins these values against the creation
// script's payload rather than trusting the two to agree, and it is the whole
// cost of getting a vocabulary wrong — #335 narrowed these lists and paid it by
// deleting and recreating two tables.
//
// A RENAME IS THE ONE HAND EDIT THAT COSTS NO ROW, AND #455 MADE ONE. `Registered`
// became `Created` by editing the option's text in the Airtable UI: a cell holds its
// choice by id, so every row that held it reads the new name, where adding a new
// option and deleting the old would have emptied each of them.
// docs/notes/airtable-access.md has the rule and why it was not tried the other way.
// #463 made three more the same way, when the design set the statuses and the events
// in sentence case: `In Stock` is `In stock`, `Checked Out` and `Checked In` are
// `Checked out` and `Checked in`.
//
// WHAT #335 REMOVED AND #531 BROUGHT BACK. #335 took `In Repair`, `Sent to Repair` and
// `Returned from Repair` off with `Lost` and `Found`, on the ground that a broken tool
// was thrown away rather than repaired; the sites send broken items back to their maker
// now, so #531 added `In repair`, `Sent for repair` and `Returned from repair`, by hand
// in the Airtable UI in sentence case. Nothing records where an item went or why: it
// always goes to its maker. `Lost` and `Found` stay gone — nobody reports an individual
// asset missing. `Job Changed` is gone for a different reason: the fact it recorded is
// already in the log twice over, since an asset moving site shows up as a check-out on
// one job and the next check-in on another. docs/notes/tools.md has the full argument
// and the consequence for `Assets."Job"`.

/**
 * Where an asset can be. One axis, five values, exactly one held at a time, in the order
 * the category list draws its counts (1a) — the four it draws, `SHOWN_STATUS_VALUES`.
 *
 * `In stock` and `Out` are the pair a scan moves between. `In repair` is an asset away at
 * its maker (#531): sent from stock and returned to it, and on its job the whole time.
 * `Retired` is the end an asset the company held comes to, and `Deleted` (#582) the end of
 * one it never did — registered by mistake, and deleted by the office while nothing but its
 * creation had happened to it. Each is named for the event that designates it.
 *
 * `Deleted` IS A STATUS AND NOT A REMOVED ROW, AND THE LABEL IS WHY (#582). The next number a
 * day's registration mints is the day's highest plus one (`lib/ids.js`), so a row taken off
 * the base would hand its number, already printed on a label, to the next asset. A row that
 * stays keeps the number taken, and keeps who deleted it and when on its `Deleted` entry. It is
 * the one status no screen shows (`SHOWN_BY_STATUS`): an item deleted is treated as one that
 * never existed, which is where it parts from `Retired`, counted among what the company bought.
 *
 * `Retired` COVERS TWO REAL HAPPENINGS AND NOTHING RECORDS WHICH, WHICH IS A
 * DECISION RATHER THAN A GAP (#363). An asset thrown away because it broke and an
 * asset found missing at a stock check are one fact on this axis — the company no
 * longer holds it — and this app has no question that reads the difference.
 * `Tool Log."Notes"` used to be named as the place it would live; that field is
 * gone, and docs/notes/tools.md carries why the distinction was weighed and
 * dropped rather than overlooked. Without the status a discarded asset would sit
 * `In stock` forever and the count would be wrong, and the only other way to
 * correct that is deleting the record, which takes the log with it.
 *
 * SENTENCE CASE SINCE #463, THE DESIGN'S, AND THE BASE CARRIES IT. A screen prints a
 * status as stored, so the screen word and the option are one string, and when the
 * design set the asset screens' words in sentence case the option was renamed in
 * place to match (docs/notes/naming.md). The materials axis keeps its title case —
 * `Purchase Orders."Status"` spells `Sent to Vendor`, `Purchase Requests."Status"`
 * `In Review` — until a design sets that axis's words; each axis takes its own when
 * its design does.
 */
export const ASSET_STATUS = {
    IN_STOCK: "In stock",
    OUT: "Out",
    IN_REPAIR: "In repair",
    RETIRED: "Retired",
    DELETED: "Deleted",
};

/** The five, as the option list `Assets."Status"` must offer, in its order. */
export const ASSET_STATUS_VALUES = Object.values(ASSET_STATUS);

/**
 * What can happen to an asset. One row of `Asset Log` per occurrence.
 *
 * `Created` IS THE FIRST ROW OF EVERY ASSET'S HISTORY, and it exists because
 * `Assets` carries no `Created At` (#334). That field was left off on the ground
 * that the log's first row holds the instant — so without an event naming the act
 * there is nowhere at all that answers when an asset came into existence, and
 * the field would have to come back. `Checked in` was the alternative and reads
 * wrong: it means an asset came back into stock, and one just created has never been
 * out.
 *
 * IT WAS `Registered` UNTIL #455, WHICH TOOK THE DESIGN'S WORD. The history prints the
 * stored value, so the event is the screen word and the base had to carry the change;
 * the key follows the value, because a key that names one string and holds another
 * is the false identifier this module exists to prevent. The code's word for the act
 * is still `register` (docs/notes/naming.md) — the event is a value on the base, and
 * the base says `Created`.
 *
 * IT IS ALSO NOT A FICTION. There is a real interval between creating an asset
 * and the first scan — the label has to be printed and stuck on — so the `In stock`
 * it leaves behind is a true statement about an asset sitting on a bench, not a
 * placeholder.
 *
 * THE NAMING SHAPES. `Retired` is named for the state it leaves the asset in, so the
 * event and the status are the same string, and `Deleted` (#582) is the second of that
 * kind, an end the office designates too. The
 * rest carry an action name of their own, because the person recording is performing an
 * act rather than declaring a state: `Checked out`, `Checked in`, and since #531
 * `Sent for repair` and `Returned from repair` — the past of the control's own words,
 * `Send for repair` and `Return from repair`, which the design matched on purpose. So
 * the repair's status is `In repair` and neither event is. `Created` is a case of its
 * own — an act with no status of its own name — which is why the map below is needed
 * rather than being derivable from the two lists.
 *
 * SENTENCE CASE, THE DESIGN'S, SINCE #463. #455 kept the base's title case where the
 * design wrote `Checked out`, on the ground that a sentence-cased select value would
 * be a decision for the whole app; #463 took the decision for this axis, and the two
 * options were renamed in place so the history, which prints them as stored, says
 * the design's words. `offline/asset-status.mjs` holds the casing.
 */
export const ASSET_EVENT = {
    CREATED: "Created",
    CHECKED_OUT: "Checked out",
    CHECKED_IN: "Checked in",
    SENT_FOR_REPAIR: "Sent for repair",
    RETURNED_FROM_REPAIR: "Returned from repair",
    RETIRED: "Retired",
    DELETED: "Deleted",
};

/** The seven, as the option list `Asset Log."Event"` must offer, in the base's order. */
export const ASSET_EVENT_VALUES = Object.values(ASSET_EVENT);

/**
 * The status each event leaves the asset in.
 *
 * TOTAL AND WITH NO ESCAPE VALUE. Every event moves the status, so there is no
 * entry meaning "leave it alone" — #334 had one, `Job Changed`, and #335 removed
 * both the event and the null with it. That matters beyond tidiness: the null was
 * the first of three reasons `Assets."Status"` is written by this app rather
 * than computed by an Airtable formula, and it is gone. The other two stand and
 * are in docs/notes/tools.md; the conclusion is unchanged and the argument for it
 * is one shorter.
 *
 * NOT DERIVABLE FROM THE TWO LISTS, which is why it is a map rather than a
 * lookup by name. Three events land on `In stock`, two events share their string with the
 * status they leave — `Retired` and `Deleted` — and `Created` names no status at all.
 */
export const STATUS_AFTER_EVENT = {
    [ASSET_EVENT.CREATED]: ASSET_STATUS.IN_STOCK,
    [ASSET_EVENT.CHECKED_OUT]: ASSET_STATUS.OUT,
    [ASSET_EVENT.CHECKED_IN]: ASSET_STATUS.IN_STOCK,
    [ASSET_EVENT.RETIRED]: ASSET_STATUS.RETIRED,
    [ASSET_EVENT.SENT_FOR_REPAIR]: ASSET_STATUS.IN_REPAIR,
    [ASSET_EVENT.RETURNED_FROM_REPAIR]: ASSET_STATUS.IN_STOCK,
    [ASSET_EVENT.DELETED]: ASSET_STATUS.DELETED,
};

/**
 * The event an asset in this status offers its page's one press, or `null` for none
 * (#362) — what a scan of its label opens on.
 *
 * THE OTHER DIRECTION FROM `STATUS_AFTER_EVENT`, AND IT IS NOT ITS INVERSE. That
 * map answers "what did this event leave behind"; this one answers "what may a
 * person do to an asset that is here now". Three events land on `In stock`, so
 * the inverse is not a function at all — and `Created` is offered by nothing,
 * because creating an asset makes the row rather than moving one that exists.
 *
 * `In repair` OFFERS ITS RETURN (#531), because the page an item comes back to is the one
 * its label opens and the return is the one thing to record there: it cannot be checked
 * out while it is away. What is chosen from a menu rather than pressed — sending one for
 * repair, retiring one — is the two maps below.
 *
 * THE `null` IS NOT THE ESCAPE VALUE #335 REMOVED, and the difference is worth
 * being exact about because the word looks the same. That one meant "this event
 * happened and left the status alone", which was a hole in the vocabulary. This
 * one means "this status offers nothing", which is a fact about `Retired` and `Deleted`
 * (#582) — the two ends there are, by design; a deleted asset is drawn nowhere, so
 * nothing could press it anyway.
 *
 * TOTAL OVER `ASSET_STATUS_VALUES`, WHICH IS WHAT MAKES A NEW STATUS LOUD. An
 * entry per status, `Retired`'s written out rather than left absent, so adding a
 * status without deciding what it offers is a missing key and a throw rather
 * than a screen quietly offering `Checked out` to something that cannot take it.
 * That is `summarizeAssetCategories`' argument for drawing every count, one level up.
 */
export const EVENT_OFFERED_BY_STATUS = {
    [ASSET_STATUS.IN_STOCK]: ASSET_EVENT.CHECKED_OUT,
    [ASSET_STATUS.OUT]: ASSET_EVENT.CHECKED_IN,
    [ASSET_STATUS.IN_REPAIR]: ASSET_EVENT.RETURNED_FROM_REPAIR,
    [ASSET_STATUS.RETIRED]: null,
    [ASSET_STATUS.DELETED]: null,
};

/**
 * The event this status offers, or `null`.
 *
 * THROWS ON A STATUS OUTSIDE THE VOCABULARY, which is `statusAfterEvent`'s whole
 * value one function up and is the same failure it guards against: a status the
 * map has no entry for would read `undefined`, which is falsy, so the screen
 * would offer nothing and the action would refuse — an asset nobody can move
 * and no message saying why. This fails at the call, naming the module to edit.
 *
 * A `null` IS AN ANSWER AND NOT A MISS. `Retired` has an entry and it is `null`,
 * so the two are told apart by `hasOwnProperty` rather than by truthiness.
 */
export function eventOfferedBy(status) {
    if (!Object.prototype.hasOwnProperty.call(EVENT_OFFERED_BY_STATUS, status)) {
        throw new Error(
            `assetStatus: "${status}" is not an Assets status — ` +
                `add it to ASSET_STATUS in lib/assetStatus.js, say what it offers in ` +
                `EVENT_OFFERED_BY_STATUS, and add the option in Airtable by hand`
        );
    }
    return EVENT_OFFERED_BY_STATUS[status];
}

/**
 * Whether a person may designate `Retired` from this status (#363).
 *
 * A THIRD MAP RATHER THAN A READING OF THE SECOND, AND THE COINCIDENCE IS WHY IT
 * IS WORTH SAYING. `eventOfferedBy` returns `null` for exactly the status this
 * one returns `false` for, so `!eventOfferedBy(status)` would answer today's
 * question correctly and would be wrong for a reason nothing would show: that
 * map is about the page's press, and this one is about what a person chooses
 * from a menu. A status that offers no press but can still be retired would
 * silently lose its control.
 *
 * TOTAL OVER `ASSET_STATUS_VALUES`, for `EVENT_OFFERED_BY_STATUS`' reason: a
 * status with no entry is a throw rather than an inherited answer.
 *
 * `Retired` IS `false`, AND IT IS TERMINAL RATHER THAN MERELY DONE.
 * Nothing at all is recorded against a retired asset — not a scan, not a
 * second retirement — which is what the screen's one sentence says in place of
 * every control. `Deleted` is the other `false` (#582): nothing is recorded against an
 * asset the app treats as never having existed.
 *
 * EVERY OTHER IS `true`, INCLUDING `Out` AND `In repair`. An asset that broke on a site is
 * retired from there; refusing it would force somebody to record a check-in that
 * never happened, which is the argument #341 made about reassignment before that
 * issue closed. And one its maker gives up on is retired while it is away (#531), for
 * the same reason: a return that did not happen is not recorded to make room for it.
 */
export const MAY_RETIRE_FROM_STATUS = {
    [ASSET_STATUS.IN_STOCK]: true,
    [ASSET_STATUS.OUT]: true,
    [ASSET_STATUS.IN_REPAIR]: true,
    [ASSET_STATUS.RETIRED]: false,
    [ASSET_STATUS.DELETED]: false,
};

/**
 * Whether `Retired` may be designated from this status.
 *
 * THROWS ON A STATUS OUTSIDE THE VOCABULARY, which is `eventOfferedBy`'s reason
 * one function up: `undefined` is falsy, so a missing entry would hide the
 * control and refuse the write with nothing saying why.
 */
export function mayRetireFrom(status) {
    if (!Object.prototype.hasOwnProperty.call(MAY_RETIRE_FROM_STATUS, status)) {
        throw new Error(
            `assetStatus: "${status}" is not an Assets status — ` +
                `add it to ASSET_STATUS in lib/assetStatus.js, say whether it may be retired in ` +
                `MAY_RETIRE_FROM_STATUS, and add the option in Airtable by hand`
        );
    }
    return MAY_RETIRE_FROM_STATUS[status];
}

/**
 * Whether an asset in this status may be sent for repair (#531).
 *
 * FROM STOCK AND NOWHERE ELSE. An item is sent to its maker from the shelf it is on: one
 * that is out is checked in first, since the check-in is a thing that happens on a site
 * and skipping it would leave the log saying the item is still with whoever had it; one
 * already in repair offers its return instead; a retired one offers nothing, nor a deleted one.
 *
 * A FOURTH MAP RATHER THAN A READING OF ANOTHER. It is chosen from the menu beside the
 * press — the design draws `Send for repair` above `Retire this item` (1f, 1j) — so it is
 * what a person chooses rather than what the page's press offers, and it parts from the
 * retirement's map on `Out` and `In repair`. No confirmation: the next press, the return,
 * undoes it, as the check-in undoes a check-out.
 *
 * TOTAL OVER `ASSET_STATUS_VALUES`, for `EVENT_OFFERED_BY_STATUS`' reason.
 */
export const MAY_SEND_FOR_REPAIR_FROM_STATUS = {
    [ASSET_STATUS.IN_STOCK]: true,
    [ASSET_STATUS.OUT]: false,
    [ASSET_STATUS.IN_REPAIR]: false,
    [ASSET_STATUS.RETIRED]: false,
    [ASSET_STATUS.DELETED]: false,
};

/**
 * Whether an asset in this status may be sent for repair.
 *
 * THROWS ON A STATUS OUTSIDE THE VOCABULARY, which is `mayRetireFrom`'s reason.
 */
export function maySendForRepairFrom(status) {
    if (!Object.prototype.hasOwnProperty.call(MAY_SEND_FOR_REPAIR_FROM_STATUS, status)) {
        throw new Error(
            `assetStatus: "${status}" is not an Assets status — ` +
                `add it to ASSET_STATUS in lib/assetStatus.js, say whether it may be sent for repair in ` +
                `MAY_SEND_FOR_REPAIR_FROM_STATUS, and add the option in Airtable by hand`
        );
    }
    return MAY_SEND_FOR_REPAIR_FROM_STATUS[status];
}

/**
 * Whether an asset in this status may have its note written — added, changed or cleared
 * (#533).
 *
 * WHILE IT IS IN STOCK OR OUT, AND NOT WHILE IT IS AWAY OR ENDED. The note is what tells one
 * item from the others of its kind on the site that holds it — a cracked case, the crate it
 * is kept in — so it is written while the item is on a job, and the design draws it so: the
 * line holding `Add a note`, or the note under a target, from stock and while out (1f, 1j-a,
 * 1j-b), and neither for an item in repair or a retired one (1f, 1j-e, 1j-c). A retired item's
 * note stands as it was and is read (1j-c); nothing more is recorded against it, `Retired`'s
 * rule. One in repair is at its maker, and where it went and why is what #531 left unrecorded,
 * which a note written then would start recording; the note it left with stands, read. A
 * deleted one is read by nobody (#582).
 *
 * A SIXTH MAP RATHER THAN A READING OF ANOTHER. A note is no event, so it is not the press's
 * question, and it parts from the press on `In repair`, which offers its return; and from the
 * retirement's on the same status, which may be retired.
 *
 * TOTAL OVER `ASSET_STATUS_VALUES`, for `EVENT_OFFERED_BY_STATUS`' reason.
 */
export const MAY_WRITE_NOTE_IN_STATUS = {
    [ASSET_STATUS.IN_STOCK]: true,
    [ASSET_STATUS.OUT]: true,
    [ASSET_STATUS.IN_REPAIR]: false,
    [ASSET_STATUS.RETIRED]: false,
    [ASSET_STATUS.DELETED]: false,
};

/**
 * Whether an asset in this status may have its note written.
 *
 * THROWS ON A STATUS OUTSIDE THE VOCABULARY, which is `mayRetireFrom`'s reason.
 */
export function mayWriteNoteIn(status) {
    if (!Object.prototype.hasOwnProperty.call(MAY_WRITE_NOTE_IN_STATUS, status)) {
        throw new Error(
            `assetStatus: "${status}" is not an Assets status — ` +
                `add it to ASSET_STATUS in lib/assetStatus.js, say whether its note may be written in ` +
                `MAY_WRITE_NOTE_IN_STATUS, and add the option in Airtable by hand`
        );
    }
    return MAY_WRITE_NOTE_IN_STATUS[status];
}

/**
 * Whether an asset in this status counts in its kind's `Total` on the category list and in
 * its export (#569): how many of a kind the company still holds.
 *
 * EVERY STATUS BUT `Retired`. An item out on a site is the company's, and so is one away at
 * its maker; a retired one is not — thrown away or found missing, one fact on this axis
 * (`ASSET_STATUS`). So a kind's total is its `In stock`, `Out` and `In repair` added up, and
 * what the company has ever bought of it is that and its `Retired`, all four still on the row.
 * A deleted one is neither (#582): the company never held it, and no list reaches it to count
 * (`shownIn`), so its `false` here is the answer a count would give if one ever did.
 *
 * A SEVENTH MAP RATHER THAN A READING OF ANOTHER, AND ITS ANSWERS ARE THE RETIREMENT'S TODAY.
 * `mayRetireFrom` is `false` for exactly the status this one leaves out, the coincidence that
 * map's own doc draws against the press's: it is about what a person may choose, and this
 * about what a count holds, so a status that may not be retired and is still the company's
 * would be read out of every total.
 *
 * TOTAL OVER `ASSET_STATUS_VALUES`, for `EVENT_OFFERED_BY_STATUS`' reason: a new status says
 * whether a kind's total holds it.
 */
export const COUNTED_IN_TOTAL_BY_STATUS = {
    [ASSET_STATUS.IN_STOCK]: true,
    [ASSET_STATUS.OUT]: true,
    [ASSET_STATUS.IN_REPAIR]: true,
    [ASSET_STATUS.RETIRED]: false,
    [ASSET_STATUS.DELETED]: false,
};

/**
 * Whether an asset in this status counts in its kind's total.
 *
 * THROWS ON A STATUS OUTSIDE THE VOCABULARY, which is `mayRetireFrom`'s reason: `undefined`
 * is falsy, so a missing entry would leave the status out of every total with nothing saying why.
 */
export function countedInTotal(status) {
    if (!Object.prototype.hasOwnProperty.call(COUNTED_IN_TOTAL_BY_STATUS, status)) {
        throw new Error(
            `assetStatus: "${status}" is not an Assets status — ` +
                `add it to ASSET_STATUS in lib/assetStatus.js, say whether a kind's total counts it in ` +
                `COUNTED_IN_TOTAL_BY_STATUS, and add the option in Airtable by hand`
        );
    }
    return COUNTED_IN_TOTAL_BY_STATUS[status];
}

/**
 * Whether the app shows an asset in this status anywhere at all (#582): its page, every list
 * and count, a search by its id, the export and a label run.
 *
 * EVERY STATUS BUT `Deleted`. A deleted asset is one registered by mistake and taken back before
 * anything happened to it, so the app treats it as one that never existed — to the office as to a
 * site — where a retired one is still counted among what the company bought. Its row stays on the
 * base so that its number stays taken (`ASSET_STATUS`), which leaves every read of `Assets` to hide
 * it, and `lib/airtable/assets.js` asks this of every asset each of its readers hands back, so a
 * screen never meets one; a scan of its label reads as a code no asset carries.
 *
 * AN EIGHTH MAP RATHER THAN A READING OF ANOTHER. The total's map leaves `Retired` out as well,
 * and the press's and the retirement's answer nothing for both ends; this one asks whether the
 * asset is there to be counted or pressed at all, and parts from each of them on `Retired`.
 *
 * TOTAL OVER `ASSET_STATUS_VALUES`, for `EVENT_OFFERED_BY_STATUS`' reason: a new status says
 * whether the app shows it, rather than vanishing from every list with nothing saying why.
 */
export const SHOWN_BY_STATUS = {
    [ASSET_STATUS.IN_STOCK]: true,
    [ASSET_STATUS.OUT]: true,
    [ASSET_STATUS.IN_REPAIR]: true,
    [ASSET_STATUS.RETIRED]: true,
    [ASSET_STATUS.DELETED]: false,
};

/**
 * Whether the app shows an asset in this status.
 *
 * THROWS ON A STATUS OUTSIDE THE VOCABULARY, which is `mayRetireFrom`'s reason and weighs more
 * here: `undefined` is falsy, so a status the map has no entry for would take its assets off
 * every screen with nothing saying why.
 */
export function shownIn(status) {
    if (!Object.prototype.hasOwnProperty.call(SHOWN_BY_STATUS, status)) {
        throw new Error(
            `assetStatus: "${status}" is not an Assets status — ` +
                `add it to ASSET_STATUS in lib/assetStatus.js, say whether the app shows it in ` +
                `SHOWN_BY_STATUS, and add the option in Airtable by hand`
        );
    }
    return SHOWN_BY_STATUS[status];
}

/**
 * Whether the app shows this asset (#582): `shownIn` asked of its stored status — the question
 * every reader of `Assets` asks of every asset it hands back (`lib/airtable/assets.js`), handed
 * anything carrying a `status`.
 *
 * AN ASSET WITH NO STATUS AT ALL IS SHOWN, AS IT WAS BEFORE THE QUESTION EXISTED. Nothing in the app
 * writes one — a registration writes `In stock` — so only a hand edit in Airtable leaves a blank,
 * and there is no status to hide it by; the list leaves it uncounted as it always did
 * (`lib/assetListView.js:countedAssets`). A status outside the vocabulary still throws.
 */
export function isShownAsset(asset) {
    const status = asset?.status;
    return status === undefined || status === null || status === "" || shownIn(status);
}

/**
 * The statuses an asset the app shows can hold, in `ASSET_STATUS_VALUES`' order (#582): what the
 * category list draws a count of, its export a column of and the status mark a shape for. A
 * reading of `SHOWN_BY_STATUS`, so a status that map hides is drawn nowhere, and one it shows is
 * drawn without anybody editing a screen — #531's `In repair` arrived on the list that way.
 */
export const SHOWN_STATUS_VALUES = ASSET_STATUS_VALUES.filter((status) => shownIn(status));

/** Where an event's `Asset Log` row takes its job from: the person recording, or the asset. */
export const JOB_SOURCE = Object.freeze({ ACTOR: "actor", ASSET: "asset" });

/**
 * Where each event's row takes its job from (#363, #531).
 *
 * THE INVARIANT IS ONE AND THE MECHANISMS ARE TWO, and this is the map that says which is
 * whose. The job on a row is where the asset was at that event (docs/notes/tools.md). An
 * event that moves the asset between jobs learns that from the person, whose hands it is
 * in: a registration, a check-out and a check-in take the job from the actor's own
 * `Users."Assigned Jobs"`. An event that leaves the asset on its job learns it from the
 * asset: a retirement moves nothing (#363), and a repair takes the item to its maker and
 * back to the job it left (#531) — so the row inherits `Assets."Job"`, and the person
 * recording needs only to be on a job at all, which is the retirement's rule. A deletion
 * (#582) moves nothing either, and the office that designates it need be on no job.
 *
 * TOTAL OVER `ASSET_EVENT_VALUES`, so a new event cannot arrive without saying which.
 */
export const JOB_SOURCE_OF_EVENT = {
    [ASSET_EVENT.CREATED]: JOB_SOURCE.ACTOR,
    [ASSET_EVENT.CHECKED_OUT]: JOB_SOURCE.ACTOR,
    [ASSET_EVENT.CHECKED_IN]: JOB_SOURCE.ACTOR,
    [ASSET_EVENT.RETIRED]: JOB_SOURCE.ASSET,
    [ASSET_EVENT.SENT_FOR_REPAIR]: JOB_SOURCE.ASSET,
    [ASSET_EVENT.RETURNED_FROM_REPAIR]: JOB_SOURCE.ASSET,
    [ASSET_EVENT.DELETED]: JOB_SOURCE.ASSET,
};

/**
 * Where this event's row takes its job from.
 *
 * THROWS ON AN EVENT OUTSIDE THE VOCABULARY, which is `statusAfterEvent`'s reason: an
 * unknown event reading `undefined` would be taken as neither, and a row could go out with
 * the wrong job.
 */
export function jobSourceOf(event) {
    if (!Object.prototype.hasOwnProperty.call(JOB_SOURCE_OF_EVENT, event)) {
        throw new Error(
            `assetStatus: "${event}" is not an Asset Log event — ` +
                `add it to ASSET_EVENT in lib/assetStatus.js, say where its job comes from in JOB_SOURCE_OF_EVENT, ` +
                `and add the option in Airtable by hand`
        );
    }
    return JOB_SOURCE_OF_EVENT[event];
}

/**
 * The status to write after `event`.
 *
 * TAKES NO CURRENT STATUS, and used to (#334). The parameter existed so an event
 * mapping to `null` could leave the field as it found it; with no such event
 * there is nothing for it to do, and a parameter no caller's value can affect is
 * the kind of thing this repository removes rather than keeps against a future
 * that may not come.
 *
 * SO WHAT IS LEFT IS THE THROW, and that is the function's whole value. An event
 * outside the vocabulary would otherwise read `undefined` and reach a
 * `singleSelect` written with no `typecast`, which fails at Airtable with a
 * message about option permissions; this fails first, at the call, naming the
 * module to edit. A silent no-op is how a scan appears to work and records
 * nothing.
 */
export function statusAfterEvent(event) {
    if (!Object.prototype.hasOwnProperty.call(STATUS_AFTER_EVENT, event)) {
        throw new Error(
            `assetStatus: "${event}" is not an Asset Log event — ` +
                `add it to ASSET_EVENT in lib/assetStatus.js, and to the Airtable option list by hand`
        );
    }
    return STATUS_AFTER_EVENT[event];
}

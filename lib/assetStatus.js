// The two closed vocabularies the assets track writes (#334, narrowed in #335, widened
// by #531) — where an asset can be, what can happen to one, and the five maps over
// them: the status each event leaves behind, the event each status offers its page's
// one press (#362), whether `Retired` may be designated from it (#363), whether it may
// be sent for repair (#531), and where each event's row takes its job from (#531).
//
// ALL FIVE ARE HERE BECAUSE THEY ARE ONE VOCABULARY SEEN FROM FIVE SIDES, AND NO TWO
// OF THEM DERIVE FROM EACH OTHER. Three events land on `In stock`, so the first has no
// inverse; `Created` is offered by nothing, so the second is not the first read
// backwards; the third and the fourth ask about a transition a person chooses from a
// menu where the second asks about the page's press, and they part on `In stock`,
// which offers a check-out and may be sent for repair; and the fifth splits the events
// on a line none of the others draws. So a new status or a new event has to visit all
// five, and putting one of them beside the screen that reads it would leave the others
// unvisited. `offline/asset-status.mjs` pins them together for the same reason.
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
 * Where an asset can be. One axis, four values, exactly one held at a time, in the order
 * the category list draws its counts (1a).
 *
 * `In stock` and `Out` are the pair a scan moves between. `In repair` is an asset away at
 * its maker (#531): sent from stock and returned to it, and on its job the whole time.
 * `Retired` is the only end, and the only status named for the event that designates it.
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
};

/** The four, as the option list `Assets."Status"` must offer, in its order. */
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
 * event and the status are the same string, and it is the only one of that kind. The
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
};

/** The six, as the option list `Asset Log."Event"` must offer, in the base's order. */
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
 * lookup by name. Three events land on `In stock`, one event and one status share
 * the string `Retired`, and `Created` names no status at all.
 */
export const STATUS_AFTER_EVENT = {
    [ASSET_EVENT.CREATED]: ASSET_STATUS.IN_STOCK,
    [ASSET_EVENT.CHECKED_OUT]: ASSET_STATUS.OUT,
    [ASSET_EVENT.CHECKED_IN]: ASSET_STATUS.IN_STOCK,
    [ASSET_EVENT.RETIRED]: ASSET_STATUS.RETIRED,
    [ASSET_EVENT.SENT_FOR_REPAIR]: ASSET_STATUS.IN_REPAIR,
    [ASSET_EVENT.RETURNED_FROM_REPAIR]: ASSET_STATUS.IN_STOCK,
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
 * one means "this status offers nothing", which is a fact about `Retired` — the
 * only end there is, by design.
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
 * `Retired` IS THE ONLY `false`, AND IT IS TERMINAL RATHER THAN MERELY DONE.
 * Nothing at all is recorded against a retired asset — not a scan, not a
 * second retirement — which is what the screen's one sentence says in place of
 * every control.
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
 * already in repair offers its return instead; a retired one offers nothing.
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
 * recording needs only to be on a job at all, which is the retirement's rule.
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

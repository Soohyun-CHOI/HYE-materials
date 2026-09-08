// The two closed vocabularies the tools track writes (#334) — where a tool item
// can be, what can happen to one, and which of the first each of the second
// leaves behind.
//
// WHY THIS IS ITS OWN MODULE, and not part of lib/airtable/toolItems.js where the
// writes will live: that file imports lib/airtable/client.js, which throws
// `Missing AIRTABLE_API_KEY` at module load, so a plain `node` check cannot see
// anything inside it. Both of these lists have to be readable by two checks — the
// offline one that compares them against the option lists the creation script
// sends, and any later credentialed one that compares them against the live
// fields. Same measured reason lib/authzWrap.js was split out of lib/authz.js
// (#147), lib/airtableFormula.js out of client.js (#159), lib/idSequence.js out
// of lib/ids.js (#164) and lib/editLogFields.js out of a Server Action (#181).
//
// IMPORTS NOTHING, and must not start. The offline tier runs under plain `node`
// with no loader.
//
// THIS IS ALSO THE ANSWER TO "WHY DOES THE APP WRITE `Tool Items.Status` RATHER
// THAN AN AIRTABLE FORMULA", and STATUS_AFTER_EVENT is the whole argument in one
// object. The status is a cache of the last `Tool Log` row, but it is not a COPY
// of one: the two vocabularies are different sizes and `Job Changed` is a last row
// that leaves the status alone. Turning an event into a status is therefore a
// mapping, which is workflow logic, which CLAUDE.md keeps out of Airtable
// formulas. See docs/notes/tools.md for the two platform reasons underneath that
// one.
//
// NEITHER LIST CAN BE EDITED AFTER THE FIELD EXISTS. Measured and recorded in
// docs/notes/airtable-access.md: a PATCH carrying `options.choices` on a
// singleSelect is refused 422 in every shape tried, so the choices go in on field
// CREATE or they go in by hand in the Airtable UI. That is why
// scripts/tests/offline/tool-status.mjs pins these values against the creation
// script's payload rather than trusting the two to agree.

/**
 * Where a tool item can be. One axis, five values, exactly one held at a time.
 *
 * `In Stock` and `Out` are the pair a scan moves between; the other three are set
 * from a screen. `Lost` is NOT terminal — a lost tool turns up, which is what the
 * `Found` event is for — and `Retired` is the only end.
 *
 * TITLE CASE WITH LOWERCASE PARTICLES, which is this base's convention rather
 * than a choice made here: `Purchase Orders."Status"` spells `Sent to Vendor` and
 * `Awaiting Signature`, and `Purchase Requests."Status"` spells `In Review`. A
 * preposition is lowercase unless it is the first or last word.
 */
export const TOOL_STATUS = {
    IN_STOCK: "In Stock",
    OUT: "Out",
    IN_REPAIR: "In Repair",
    LOST: "Lost",
    RETIRED: "Retired",
};

/** The five, as the option list `Tool Items."Status"` must offer. */
export const TOOL_STATUS_VALUES = Object.values(TOOL_STATUS);

/**
 * What can happen to a tool item. One row of `Tool Log` per occurrence.
 *
 * TWO NAMING SHAPES, AND THE SPLIT IS WHICH ONES A PERSON DESIGNATES. A
 * transition somebody chooses on a screen is named for the state it leaves the
 * tool in, so the event and the status are the same string: `Lost` and
 * `Retired`. A transition that
 * happens by SCANNING carries an action name of its own, because the person
 * scanning is performing an act rather than declaring a state: `Checked Out`,
 * `Checked In`.
 *
 * `Lost` IS NOT `Marked Lost`, AND THAT IS THE RULE RATHER THAN AN OMISSION.
 * `Retired` already stands as the same string on both axes, so prefixing only the
 * other one would be an exception dressed as consistency. Nothing is lost by the
 * collision: an event and a status are different fields on different tables, and
 * STATUS_AFTER_EVENT below is where the two meet, in code, unambiguously.
 *
 * The three repair and recovery events keep their own names because none of them
 * is its own status — `Sent to Repair` leaves the tool `In Repair`, and `Returned
 * from Repair` and `Found` both leave it `In Stock`.
 */
export const TOOL_EVENT = {
    CHECKED_OUT: "Checked Out",
    CHECKED_IN: "Checked In",
    SENT_TO_REPAIR: "Sent to Repair",
    RETURNED_FROM_REPAIR: "Returned from Repair",
    LOST: "Lost",
    FOUND: "Found",
    RETIRED: "Retired",
    JOB_CHANGED: "Job Changed",
};

/** The eight, as the option list `Tool Log."Event"` must offer. */
export const TOOL_EVENT_VALUES = Object.values(TOOL_EVENT);

/**
 * The status each event leaves the tool item in — `null` for an event that moves
 * something other than the status.
 *
 * `Job Changed` IS THE ONLY `null`, AND IT IS THE LOAD-BEARING ENTRY. A tool
 * outlives the project it was bought for, so a job change is a real event with a
 * real row, and it is the case that makes "the status is the last row" false as
 * stated: reading the last row's `Event` into `Tool Items."Status"` would write
 * `Job Changed` into a field whose vocabulary does not contain it. Anything that
 * proposes to compute this field on the Airtable side has to answer this entry
 * first.
 *
 * `Found` IS THE ONE EVENT WHOSE RESULTING STATUS IS A JUDGMENT rather than a
 * reading of the event's own name, so it is worth stating why it is `In Stock`.
 * A tool that turns
 * up is accounted for again but is not thereby back at work; if it is in fact on
 * a site, the scan that puts it there is a `Checked Out` and says so. Restoring
 * whatever status preceded the `Lost` was the alternative, and it is refused
 * because it needs the log walked backwards — which is the work this cached field
 * exists to avoid.
 */
export const STATUS_AFTER_EVENT = {
    [TOOL_EVENT.CHECKED_OUT]: TOOL_STATUS.OUT,
    [TOOL_EVENT.CHECKED_IN]: TOOL_STATUS.IN_STOCK,
    [TOOL_EVENT.SENT_TO_REPAIR]: TOOL_STATUS.IN_REPAIR,
    [TOOL_EVENT.RETURNED_FROM_REPAIR]: TOOL_STATUS.IN_STOCK,
    [TOOL_EVENT.LOST]: TOOL_STATUS.LOST,
    [TOOL_EVENT.FOUND]: TOOL_STATUS.IN_STOCK,
    [TOOL_EVENT.RETIRED]: TOOL_STATUS.RETIRED,
    [TOOL_EVENT.JOB_CHANGED]: null,
};

/**
 * The status to write after `event`, given what the tool item holds now.
 *
 * The coalesce is the whole function, and it belongs here rather than at a call
 * site: an event that moves no status has to leave the field as it found it, and
 * a caller writing `STATUS_AFTER_EVENT[event]` directly would write `null` over a
 * live value. Throws on an event outside the vocabulary rather than returning the
 * current status, because a silent no-op is how a scan appears to work and
 * records nothing.
 */
export function statusAfterEvent(event, currentStatus) {
    if (!Object.prototype.hasOwnProperty.call(STATUS_AFTER_EVENT, event)) {
        throw new Error(
            `toolStatus: "${event}" is not a Tool Log event — ` +
                `add it to TOOL_EVENT in lib/toolStatus.js, and to the Airtable option list by hand`
        );
    }
    return STATUS_AFTER_EVENT[event] ?? currentStatus;
}

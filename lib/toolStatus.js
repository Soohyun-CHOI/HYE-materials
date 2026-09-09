// The two closed vocabularies the tools track writes (#334, narrowed in #335) —
// where a tool item can be, what can happen to one, and which of the first each
// of the second leaves behind.
//
// WHY THIS IS ITS OWN MODULE, and not part of lib/airtable/toolItems.js where the
// writes live: that file imports lib/airtable/client.js, which throws
// `Missing AIRTABLE_API_KEY` at module load, so a plain `node` check cannot see
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
// scripts/tests/offline/tool-status.mjs pins these values against the creation
// script's payload rather than trusting the two to agree, and it is the whole
// cost of getting a vocabulary wrong — #335 narrowed these lists and paid it by
// deleting and recreating two tables.
//
// WHAT #335 REMOVED, because a reader meeting a four-value event list will
// otherwise wonder what a tool in for repair is: `In Repair`, `Lost` and `Found`
// are gone because those things do not happen here — a broken tool is thrown away
// and replaced rather than repaired, and nobody reports an individual tool item
// missing. `Job Changed` is gone for a different reason: the fact it recorded is
// already in the log twice over, since a tool moving site shows up as a check-out
// on one job and the next check-in on another. docs/notes/tools.md has the full
// argument and the consequence for `Tool Items."Job"`.

/**
 * Where a tool item can be. One axis, three values, exactly one held at a time.
 *
 * `In Stock` and `Out` are the pair a scan moves between. `Retired` is the only
 * end, and it is the only status a person designates rather than scans.
 *
 * `Retired` COVERS TWO REAL EVENTS AND THAT IS DELIBERATE: a tool thrown away
 * because it broke, and a tool found missing at a stock check. Both are the one
 * fact this axis cares about — it is no longer something the company holds — and
 * which of the two it was goes in `Tool Log."Notes"`. Without it a discarded tool
 * would sit `In Stock` forever and the count would be wrong, and the only other
 * way to correct that is deleting the record, which takes the log with it.
 *
 * TITLE CASE WITH LOWERCASE PARTICLES, which is this base's convention rather
 * than a choice made here: `Purchase Orders."Status"` spells `Sent to Vendor` and
 * `Awaiting Signature`, and `Purchase Requests."Status"` spells `In Review`. A
 * preposition is lowercase unless it is the first or last word.
 */
export const TOOL_STATUS = {
    IN_STOCK: "In Stock",
    OUT: "Out",
    RETIRED: "Retired",
};

/** The three, as the option list `Tool Items."Status"` must offer. */
export const TOOL_STATUS_VALUES = Object.values(TOOL_STATUS);

/**
 * What can happen to a tool item. One row of `Tool Log` per occurrence.
 *
 * `Registered` IS THE FIRST ROW OF EVERY TOOL ITEM'S HISTORY, and it exists
 * because `Tool Items` carries no `Created At` (#334). That field was left off on
 * the ground that the log's first row holds the instant — so without an event
 * naming registration there is nowhere at all that answers when a tool item came
 * into existence, and the field would have to come back. `Checked In` was the
 * alternative and reads wrong: it means a tool came back into stock, and a tool
 * being registered has never been out.
 *
 * IT IS ALSO NOT A FICTION. There is a real interval between registering a tool
 * item and the first scan — the label has to be printed and stuck on — so the
 * `In Stock` it leaves behind is a true statement about a tool sitting on a
 * bench, not a placeholder.
 *
 * TWO NAMING SHAPES, AND THE SPLIT IS WHICH ONES A PERSON DESIGNATES. A
 * transition somebody chooses on a screen is named for the state it leaves the
 * tool in, so the event and the status are the same string: `Retired`, which is
 * the only one left of that kind. A transition that happens by SCANNING carries
 * an action name of its own, because the person scanning is performing an act
 * rather than declaring a state: `Checked Out`, `Checked In`. `Registered` is a
 * third case — an act with no status of its own name, which is why the map below
 * is needed rather than being derivable from the two lists.
 */
export const TOOL_EVENT = {
    REGISTERED: "Registered",
    CHECKED_OUT: "Checked Out",
    CHECKED_IN: "Checked In",
    RETIRED: "Retired",
};

/** The four, as the option list `Tool Log."Event"` must offer. */
export const TOOL_EVENT_VALUES = Object.values(TOOL_EVENT);

/**
 * The status each event leaves the tool item in.
 *
 * TOTAL AND WITH NO ESCAPE VALUE. Every event moves the status, so there is no
 * entry meaning "leave it alone" — #334 had one, `Job Changed`, and #335 removed
 * both the event and the null with it. That matters beyond tidiness: the null was
 * the first of three reasons `Tool Items."Status"` is written by this app rather
 * than computed by an Airtable formula, and it is gone. The other two stand and
 * are in docs/notes/tools.md; the conclusion is unchanged and the argument for it
 * is one shorter.
 *
 * NOT DERIVABLE FROM THE TWO LISTS, which is why it is a map rather than a
 * lookup by name. Two events land on `In Stock`, one event and one status share
 * the string `Retired`, and `Registered` names no status at all.
 */
export const STATUS_AFTER_EVENT = {
    [TOOL_EVENT.REGISTERED]: TOOL_STATUS.IN_STOCK,
    [TOOL_EVENT.CHECKED_OUT]: TOOL_STATUS.OUT,
    [TOOL_EVENT.CHECKED_IN]: TOOL_STATUS.IN_STOCK,
    [TOOL_EVENT.RETIRED]: TOOL_STATUS.RETIRED,
};

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
            `toolStatus: "${event}" is not a Tool Log event — ` +
                `add it to TOOL_EVENT in lib/toolStatus.js, and to the Airtable option list by hand`
        );
    }
    return STATUS_AFTER_EVENT[event];
}

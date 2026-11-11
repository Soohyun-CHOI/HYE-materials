// An item's serial number (#601) — the number its maker gave it, on a line of its own: what a typed
// one becomes, the key two are compared by, when a press writing one is refused, which item a number
// is already taken by, and every word the screens say about it.
//
// ONE OF THE ITEM'S DETAILS, AS THE NOTE IS, AND NOT AN EVENT. `Assets."Serial Number"` is one field
// written in place (#533's shape): writing it appends no `Asset Log` row, moves neither `Status` nor
// `Job`, and records nobody. So who may write it is the note's answer — `planTransition`'s
// `mayWriteSerial`, a site manager on the item's own job (#597) in every status the app shows
// (`lib/assetStatus.js:mayWriteDetailsIn`, #612) — and a press is answered in the note's order
// (`lib/assetNote.js:readDetailSubmission`), the two details one rule with two keepers.
//
// WHAT IT ADDS IS THAT A NUMBER IS ONE ITEM'S WITHIN ITS KIND. Two items of one `Category` cannot
// hold one serial number; two kinds may, since two makers number apart. The key is the kept number
// in lower case (`serialKey`): case and the spaces around it do not tell two numbers apart, and
// every other character does — a hyphen, a slash, a dot — since a maker's number is what is printed.
// A deleted item (#582) holds no number, and a retired one still does: it is still the company's
// record of that object. **The action reads the base again as it saves and asks `serialHolder`**,
// so a number taken since the page was drawn is refused as one taken before.
//
// WHAT A SERIAL NUMBER KEEPS IS THE APP'S TIDY, `normalizeItemText`: trimmed, each run of spaces one
// space, its case as typed — every typed value's on this axis, the note's and the catalog's. So `A  B`
// and `A B` are one number, a doubled space being a slip of typing rather than the maker's.
//
// PURE AND OFFLINE-SAFE. It imports ./assetNote.js, ./assetStatus.js and ./typedText.js with the
// extension spelled out, the axis's precedent for the offline tier's loaderless `node`; nothing here
// reaches lib/airtable/, so the screens — `"use client"` files — import it, and so does
// `lib/airtable/assets.js`, whose writer holds the limit as its backstop.
//
// EVERY STRING A SCREEN RENDERS ABOUT A SERIAL NUMBER IS IN `ASSET_SERIAL_COPY` AND NONE IS IN JSX,
// held by `offline/asset-list-view.mjs`.

import { ASSET_NOTE_COPY, readDetailSubmission } from "./assetNote.js";
import { isShownAsset } from "./assetStatus.js";
import { normalizeItemText } from "./typedText.js";

/**
 * The most a serial number may hold, in characters. The files draw no limit and no count; this is
 * the app's, held so a paste cannot fill a column and an export cell, and it is wider than any
 * maker's number seen on the site's items.
 */
export const SERIAL_MAX = 50;

/** A serial number as it is kept: trimmed, each run of spaces one space, its case as typed. */
export function keptSerial(value) {
    return normalizeItemText(value);
}

/**
 * The key two serial numbers are compared by: the kept number in lower case, so case and the
 * spaces around it tell no two apart and every other character does. The empty string is no number.
 */
export function serialKey(value) {
    return keptSerial(value).toLowerCase();
}

/**
 * What a press writing a serial number does, in the note's order (`readDetailSubmission`):
 * `{ ended: true }`, `{ refusal, stale: true }`, `{ refusal }`, `{ unchanged: true }`, or
 * `{ serialNumber }` — the empty string for one cleared. Whether another item holds it is the
 * action's next question, asked of the base it reads again (`serialHolder`), since the page's
 * answer is only as fresh as the page.
 */
export function readSerialSubmission(plan, input) {
    const answer = readDetailSubmission(Boolean(plan?.mayWriteSerial), input, serialDetail());
    return Object.hasOwn(answer, "value") ? { serialNumber: answer.value } : answer;
}

/**
 * The printed id of the item already holding `serialNumber` among `items` — `{ id, assetId,
 * status, category, serialNumber }` as the base answered them — or null: one of the same kind
 * (`categoryRecordId`), not the item being written (`assetRecordId`), shown by the app (a deleted
 * one is not, #582; a retired one is), whose number has the same key. Several are possible only
 * where something went round this rule — a write by hand in Airtable, two saves at one moment on two
 * servers — and the lowest printed id is named, so a press names the same item every time.
 */
export function serialHolder({ serialNumber, assetRecordId, categoryRecordId, items }) {
    const key = serialKey(serialNumber);
    if (key === "" || !categoryRecordId) return null;
    const holders = (items || [])
        .filter((item) => item?.id !== assetRecordId && isShownAsset(item) && item?.category?.[0] === categoryRecordId && serialKey(item?.serialNumber) === key)
        .map((item) => item.assetId)
        .filter((assetId) => typeof assetId === "string")
        .sort();
    return holders[0] ?? null;
}

/**
 * Every word the screens say about a serial number (#601) — the asset's page at both widths, 1d's
 * column, 1a's search and its export.
 */
export const ASSET_SERIAL_COPY = {
    // THE VALUE'S NAME (1d, 0a Value line): 1d's column head, the name a phone's line gives
    // assistive tech, and the export's column. Sentence case, as every word on this axis is,
    // where the field is `Assets."Serial Number"`.
    label: "Serial number",
    // THE DESK'S ROW SAYS IT SHORT (1f, 1g): `Serial` beside the value in `Details`, where `Note` is
    // the row under it — the design's word, which names the field in the column it has — and the
    // found line before the number (1a3), since the files of 2026-11-05 (#614).
    rowLabel: "Serial",

    // THE TWO OPENINGS (1f, 1j-a, 1j-b, 1j-b3): with none, the phone's line reads `Add serial number`
    // in Ink 3, the sheet is titled so and the desk's `Add` is named so; with one, the sheet is `Edit
    // serial number`, and the desk's `Edit` and the phone's line are named so.
    addSerial: "Add serial number",
    editSerial: "Edit serial number",
    add: ASSET_NOTE_COPY.add,
    edit: ASSET_NOTE_COPY.edit,
    save: ASSET_NOTE_COPY.save,
    cancel: ASSET_NOTE_COPY.cancel,
    done: ASSET_NOTE_COPY.done,
    clear: ASSET_NOTE_COPY.clear,

    // THE REFUSAL FOR A NUMBER ANOTHER ITEM OF THE KIND HOLDS (1f `Serial number taken`, 1j-b3, 0a
    // Value line): its printed id in the mono face, then the rest. The id is plain text and names no
    // link, as the files draw it.
    takenBy: (assetId) => `${assetId} already has this serial number.`,
    takenRest: "already has this serial number.",

    // THE FIELD'S LIMIT, WHICH THE FILES DO NOT DRAW: the note's sentence for its own figure.
    tooLong: `Use ${SERIAL_MAX} characters or fewer.`,

    // A NUMBER SOMEBODY ELSE CHANGED WHILE THIS ONE WAS BEING WRITTEN — the note's sentence for its
    // own value, which the files do not draw either.
    changedFirst: "Someone else changed this serial number first. Nothing was saved.",

    // WHAT A SENDING SAYS WHILE IT IS ON ITS WAY (0f Working): the note's words, a cleared field a
    // removal, a first number an addition, anything else a save.
    working: ASSET_NOTE_COPY.working,
};

/** The serial number as a detail: its keeper, its limit and its two refusals. */
function serialDetail() {
    return { keep: keptSerial, max: SERIAL_MAX, tooLong: ASSET_SERIAL_COPY.tooLong, changedFirst: ASSET_SERIAL_COPY.changedFirst };
}

// What `serial_from_notes_602.mjs` judges, apart from the base it judges (#602): the serial number a
// note holds, what the note keeps without it, which items take theirs and which are left and why,
// what the ledger says of each, and what a revert takes back.
//
// ONE RULE, SOO'S, AND NO LIST TO REVIEW. Every item not deleted whose note holds a number takes it
// into `Serial Number`, and the note keeps what is left; a note the run is told to skip, whole, is
// left as it is (`--skip-note`, compared as a note is kept and case aside). The values skipped are
// the run's arguments and never this file's. A preview prints counts, and the write is bound to the
// preview it follows (`planDigest`): a base that moved between the two is written nothing.
//
// WHERE A NOTE HOLDS A NUMBER (`findSerial`). The note is read as a note is kept (`keptNote`). A
// label — `S/N`, `SN`, `Serial`, `Serial No`, `Serial Number`, `Serial #` — names the token after it;
// `SN` and `Serial` only with a separator after them, since a number may itself begin with the
// letters. With no label, a note that is one token is that token, letters alone included, since a
// maker may number with letters; a note of several words gives its first token of four characters or
// more holding a digit, and one with none gives none — so a shelf's `rack 2` is no number. What the
// note keeps is the rest, the separators at its ends dropped, kept as a note keeps — cleared, written
// as null, when nothing is left.
//
// WHAT IS LEFT UNWRITTEN. An item already holding another number. A number another item of its kind
// holds, or another note of its kind gives — `lib/assetSerial.js:serialHolder`'s rule, a deleted item
// aside and a retired one counting — since which item it belongs to is a site's question; both notes
// stay as they are. An item already holding this number has its note cleaned and its number left.
//
// WHAT IS MARKED AND STILL WRITTEN (`uncertainties`): a number shorter than four characters, one
// standing beside other words with no label, one sharing a piece of four or more characters holding
// a digit with its kind's part number — the model number printed beside a maker's serial — and one in
// a store listing label's shape, `X00` and seven more, which every item bought from one listing
// shares. The preview counts them; nothing here stops them.
//
// A MODULE OF ITS OWN SO THE OFFLINE TIER CAN HOLD IT (`offline/asset-serial-from-notes-602.mjs`).
// The script imports `lib/airtable/client.js`, which throws without credentials. It imports
// `lib/assetNote.js`, `lib/assetSerial.js` and `lib/assetStatus.js` with the extension spelled out,
// as the offline tier's loaderless `node` needs, so a note and a number are kept here as the app
// keeps them.

import { keptNote } from "../../lib/assetNote.js";
import { SERIAL_MAX, keptSerial, serialHolder, serialKey } from "../../lib/assetSerial.js";
import { isShownAsset } from "../../lib/assetStatus.js";

export const SCRIPT = "serial_from_notes_602";

/** The two fields a run writes, by the names the base gives them. */
export const FIELDS = Object.freeze({ serialNumber: "Serial Number", note: "Note" });

/** Airtable's ceiling on the rows one request writes. */
export const ROWS_PER_REQUEST = 10;

/** A label naming the number after it: `S/N` with or without a separator, the others only with one. */
const LABEL = /(?:^|[\s,;([])(S\/N|S\.N\.|SN|SERIAL(?:\s+(?:NO\.?|NUMBER|NUM|#))?|SER\.?\s*#)(?:\s*[:#_=.-]\s*|\s+|(?<=S\/N))(?=[A-Za-z0-9])/i;

/** A token: letters and digits, joined by a hyphen, a slash or a dot. */
const TOKEN = /[A-Za-z0-9]+(?:[-/.][A-Za-z0-9]+)*/g;

/** What may stand at either end of what a note keeps, and is dropped there. */
const EDGE = /^[\s,;:_.#|/–—-]+|[\s,;:_.#|/–—-]+$/g;

/** A store listing label's shape: `X00` and seven letters or digits. */
const LISTING_LABEL = /^X00[A-Z0-9]{7}$/i;

/** The shortest number not marked: shorter than this is as likely initials as a maker's number. */
export const SHORTEST_NUMBER = 4;

/**
 * The number a note holds, or null: `{ number, rest, labeled, alone }` — the number as written, what
 * the note keeps without it (`""` for nothing), whether a label named it, and whether it is the whole
 * note. `note` is read as a note is kept.
 */
export function findSerial(note) {
    const text = keptNote(note);
    if (text === "") return null;
    const label = text.match(LABEL);
    if (label) {
        const at = label.index + label[0].length;
        const number = text.slice(at).match(TOKEN)[0];
        const start = label.index + label[0].indexOf(label[1]);
        return { number, rest: restOf(text, start, at + number.length), labeled: true, alone: false };
    }
    const tokens = [...text.matchAll(TOKEN)];
    if (tokens.length === 1 && tokens[0][0] === text) return { number: text, rest: "", labeled: false, alone: true };
    const first = tokens.find((token) => /\d/.test(token[0]) && token[0].length >= SHORTEST_NUMBER);
    if (!first) return null;
    return { number: first[0], rest: restOf(text, first.index, first.index + first[0].length), labeled: false, alone: false };
}

/** The note without `[start, end)`: an emptied bracket and the separators at its ends dropped, kept as a note keeps. */
function restOf(text, start, end) {
    const rest = `${text.slice(0, start)} ${text.slice(end)}`.replace(/\(\s*\)|\[\s*\]/g, " ").replace(/([,;:])(?:\s*[,;:])+/g, "$1");
    return keptNote(keptNote(rest).replace(EDGE, ""));
}

/** The pieces of a number or a part number two may share: four or more characters holding a digit, in lower case. */
function pieces(value) {
    return String(value ?? "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((piece) => piece.length >= SHORTEST_NUMBER && /\d/.test(piece));
}

/**
 * Why a number found in a note is marked, in this order, or none: `short`, `beside words`, `part
 * number`, `listing label`. `found` is `findSerial`'s answer and `partNumbers` the part numbers of the
 * item's kind.
 */
export function uncertainties(found, partNumbers = []) {
    const number = keptSerial(found?.number);
    const marks = [];
    if (number.length < SHORTEST_NUMBER) marks.push("short");
    if (!found?.labeled && !found?.alone) marks.push("beside words");
    const own = pieces(number);
    const shares = (partNumbers || []).some((part) => (serialKey(part) !== "" && serialKey(part) === serialKey(number)) || pieces(part).some((piece) => own.includes(piece)));
    if (shares) marks.push("part number");
    if (LISTING_LABEL.test(number)) marks.push("listing label");
    return marks;
}

/** A field's value as the base answers it, an empty one as null. */
const stored = (value) => (value === undefined || value === null || value === "" ? null : value);

/**
 * What a run writes and leaves (#602). `rows` are the assets as read — `{ id, assetId, status,
 * category, note, serialNumber }`, `category` an array of record ids — `skipNotes` the notes the run
 * was told to skip, and `partNumbersOf` a category's record id to its part numbers.
 *
 * `moves`, each `{ id, assetId, status, number, noteAfter, writesSerial, fields, before, marks }`:
 * `fields` what is written, by the base's names — the number, unless the item holds it already, and
 * the note, null when cleared — and `before` those fields as read. `held`, each `{ id, assetId, why,
 * holder? }`: `another number`, `repeats in kind`, `no kind` or `too long`. `skipped` and `unfound`,
 * each `{ id, assetId }`: a note the run was told to skip, and one holding no number. `unmatched` the
 * skip notes no note matched. A deleted item is in none of them.
 */
export function planMove(rows, { skipNotes = [], partNumbersOf = () => [] } = {}) {
    const shown = (rows || []).filter((row) => isShownAsset(row));
    const skipKeys = new Map(skipNotes.map((note) => [keptNote(note).toLowerCase(), note]));
    const matched = new Set();
    const skipped = [];
    const unfound = [];
    const candidates = [];
    for (const row of shown) {
        const note = keptNote(row.note);
        if (note === "") continue;
        if (skipKeys.has(note.toLowerCase())) {
            matched.add(note.toLowerCase());
            skipped.push({ id: row.id, assetId: row.assetId });
            continue;
        }
        const found = findSerial(note);
        if (!found) {
            unfound.push({ id: row.id, assetId: row.assetId });
            continue;
        }
        const kind = Array.isArray(row.category) && row.category.length === 1 ? row.category[0] : null;
        candidates.push({ row, found, number: keptSerial(found.number), kind });
    }

    const givers = new Map();
    for (const { number, kind } of candidates) if (kind) givers.set(`${kind}\n${serialKey(number)}`, (givers.get(`${kind}\n${serialKey(number)}`) ?? 0) + 1);
    const items = shown.map((row) => ({ id: row.id, assetId: row.assetId, status: row.status, category: row.category, serialNumber: row.serialNumber }));

    const moves = [];
    const held = [];
    for (const { row, found, number, kind } of candidates) {
        const leave = (why, more = {}) => held.push({ id: row.id, assetId: row.assetId, why, ...more });
        const existing = keptSerial(row.serialNumber);
        if (existing !== "" && serialKey(existing) !== serialKey(number)) {
            leave("another number");
            continue;
        }
        if (number.length > SERIAL_MAX) {
            leave("too long");
            continue;
        }
        if (!kind) {
            leave("no kind");
            continue;
        }
        if (givers.get(`${kind}\n${serialKey(number)}`) > 1) {
            leave("repeats in kind");
            continue;
        }
        const holder = serialHolder({ serialNumber: number, assetRecordId: row.id, categoryRecordId: kind, items });
        if (holder) {
            leave("repeats in kind", { holder });
            continue;
        }
        const writesSerial = existing === "";
        const fields = { ...(writesSerial ? { [FIELDS.serialNumber]: number } : {}), [FIELDS.note]: found.rest === "" ? null : found.rest };
        const before = Object.fromEntries(Object.keys(fields).map((field) => [field, stored(field === FIELDS.note ? row.note : row.serialNumber)]));
        moves.push({ id: row.id, assetId: row.assetId, status: row.status ?? null, number, noteAfter: found.rest, writesSerial, fields, before, marks: uncertainties(found, partNumbersOf(kind)) });
    }
    const unmatched = [...skipKeys].filter(([key]) => !matched.has(key)).map(([, note]) => note);
    return { moves, held, skipped, unfound, unmatched };
}

/** What a preview prints and the stop is judged on: counts alone, no note and no number. */
export function planCounts({ moves, held, skipped, unfound }) {
    const tally = (list, key) => {
        const counts = {};
        for (const each of list) for (const value of [].concat(each[key])) counts[value] = (counts[value] ?? 0) + 1;
        return counts;
    };
    return {
        writes: moves.length,
        serialWritten: moves.filter((move) => move.writesSerial).length,
        noteCleared: moves.filter((move) => move.noteAfter === "").length,
        noteKept: moves.filter((move) => move.noteAfter !== "").length,
        held: held.length,
        heldWhy: tally(held, "why"),
        marked: moves.filter((move) => move.marks.length > 0).length,
        marks: tally(moves.filter((move) => move.marks.length > 0), "marks"),
        skipped: skipped.length,
        unfound: unfound.length,
    };
}

/**
 * The plan as a write is bound to it: each row written and the fields it takes, each row left and why,
 * each skipped. A write whose plan reads otherwise than the preview's writes nothing.
 */
export function planDigest({ moves, held, skipped }) {
    const byId = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    return JSON.stringify({
        moves: moves.map((move) => [move.id, move.fields, move.before]).sort(byId),
        held: held.map((each) => [each.id, each.why]).sort(byId),
        skipped: skipped.map((each) => [each.id]).sort(byId),
    });
}

/** The ledger's line for one row written, on disk before the request carrying it leaves. */
export function moveLine(move) {
    return { type: "move", id: move.id, assetId: move.assetId, before: move.before, after: move.fields };
}

/**
 * What a revert of one ledger restores and leaves (#602): `restores`, each `{ id, assetId, fields,
 * line }` — a row whose every field the ledger wrote still holds what it wrote, given back what it
 * held before — and `held`, each `{ id, assetId, why }`: a row gone from the base or changed since,
 * left and said. `lines` are the ledger's, `rows` the assets as read now.
 */
export function planRevert(lines, rows) {
    const byId = new Map((rows || []).map((row) => [row.id, row]));
    const restores = [];
    const held = [];
    for (const line of (lines || []).filter((each) => each?.type === "move")) {
        const row = byId.get(line.id);
        if (!row) {
            held.push({ id: line.id, assetId: line.assetId, why: "not on the base" });
            continue;
        }
        const now = { [FIELDS.serialNumber]: stored(row.serialNumber), [FIELDS.note]: stored(row.note) };
        const same = Object.keys(line.after ?? {}).every((field) => now[field] === line.after[field]);
        if (!same) held.push({ id: line.id, assetId: line.assetId, why: "changed since" });
        else restores.push({ id: line.id, assetId: line.assetId, fields: line.before, line: { type: "restore", id: line.id, assetId: line.assetId, before: line.after, after: line.before } });
    }
    return { restores, held };
}

/** Whether each row a ledger wrote reads back as written: the ids of those that do not. */
export function notAsWritten(lines, rows) {
    const byId = new Map((rows || []).map((row) => [row.id, row]));
    return (lines || [])
        .filter((line) => line?.type === "move" || line?.type === "restore")
        .filter((line) => {
            const row = byId.get(line.id);
            const now = { [FIELDS.serialNumber]: stored(row?.serialNumber), [FIELDS.note]: stored(row?.note) };
            return !row || Object.keys(line.after ?? {}).some((field) => now[field] !== line.after[field]);
        })
        .map((line) => line.id);
}

/** The pieces of a list, `size` to a piece. */
export function inBatches(items, size = ROWS_PER_REQUEST) {
    return Array.from({ length: Math.ceil((items || []).length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/**
 * The SDK funnel's callback for `request`, wrapped so the ids of the rows a read of `table` answers
 * with are added to `into` before the caller sees them — what the fence calls the rows this run read.
 * Any other request's callback is handed back as it is.
 */
export function collectingReads(request, callback, { table, into }) {
    const [, segment = "", rest = ""] = String(request?.path ?? "").split("/");
    const verb = String(request?.method ?? "").toLowerCase();
    const reads = decodeURIComponent(segment) === table && (verb === "get" || (verb === "post" && rest === "listRecords"));
    if (!reads) return callback;
    return (error, response, body) => {
        if (!error) for (const record of body?.records ?? []) if (typeof record?.id === "string") into.add(record.id);
        callback(error, response, body);
    };
}

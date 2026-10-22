// What the Tools & Equipment list keeps of each asset's status between views (#560).
//
// WHY IT EXISTS. The list counts each kind by status, so every view needed every asset's
// `Status` on what it stands on — read fifty to a query, which grew with every item added:
// 6 reads for a job of 143, 12 for 415, 16 for all of a reader's 643 (#548's figures, and
// #560's). A view now asks the base only what has CHANGED since the last view, which is one
// query whatever stands under the list, and reads an asset in full only the first time this
// server meets it and once the bound below has passed.
//
// ONLY THE STATUS IS KEPT. Which job an asset is on and which kind it is come off the link
// arrays the list reads on every view anyway — `Jobs."Assets"` and `Asset Categories."Assets"`,
// measured current on the first read after a create and a move (#560) — so a move, a
// recategorizing and a deletion show at once whoever made them, and the only fact this module
// can hold out of date is one it is asked about.
//
// THE BASE IS ASKED WHAT CHANGED, AND NO WRITE CLEARS ANYTHING HERE. This memory is one server
// instance's, and nothing routes a reader's next view to the instance that took their write, so
// a write clearing its own instance's memory would leave another's standing. Asking the base
// instead sees a write from any instance and a change made by hand in Airtable alike: the
// question is every asset whose `Status` was modified after a moment (`changedSince`,
// `LAST_MODIFIED_TIME`), and #560 measured it answering a write made a fraction of a second
// earlier, ten times of ten. **Every view asks it**, since only an answer sent after a write
// landed can contain that write.
//
// THE QUESTION OVERLAPS THE LAST ONE BY A MINUTE (`STATUS_CHANGE_OVERLAP_MS`). It asks from the
// moment the previous question was sent, less the overlap, so a change the base had not yet
// answered for when the previous question was sent — or whose time the base's clock and this
// server's put a few seconds apart — is asked about again. What the overlap re-reads is a
// minute's changes, which is few rows and one query.
//
// NOTHING IS KEPT LONGER THAN TEN MINUTES WITHOUT BEING READ AGAIN (`STATUS_KEPT_MS`). The
// question above should leave nothing behind; the bound is for whatever it might — a clock
// further out than the overlap, a change Airtable does not stamp, an asset restored from the
// trash — so that nothing this module holds is out of date for longer than it. **And a
// memory nobody asked for ten minutes is dropped whole** rather than asked what changed across
// the gap, since every status it holds is past the bound by then and the question would only
// read changes nobody will be told.
//
// A STATUS READ EARLIER NEVER REPLACES ONE READ LATER. Two views on one instance can read at
// once, and the answer to the first sent can arrive second; each status is kept with the moment
// its read was sent, and an older one is not written over a newer.
//
// ASSETS BEING READ ARE READ ONCE. A few people opening a list together on a server that has
// not met its assets share the one read of them, rather than reading them once each — the case
// #560 was raised about.
//
// WHAT IT ANSWERS IS ONLY WHAT IT IS ASKED. It holds no reader and no job, and hands back the
// statuses of the ids it was given and no others, so a reader is counted on their own scope
// (`lib/assetListView.js:assetListScope`) whatever this server has met for somebody else.
//
// PURE AND OFFLINE-SAFE: it imports nothing, and is handed its two reads and its clock, so
// `scripts/tests/offline/asset-status-memory.mjs` drives it with fakes. The instance the list
// reads through is `lib/airtable/assets.js:getAssetStatuses`', made once when that module loads.

/** How far each question about changes reaches back past the previous one (#560). */
export const STATUS_CHANGE_OVERLAP_MS = 60 * 1000;

/** How long a status is answered from memory before it is read again (#560). */
export const STATUS_KEPT_MS = 10 * 60 * 1000;

/**
 * A memory of asset statuses, read through `readByIds(ids)` — every id's `{ id, status }` the
 * base holds — and `readChangedSince(date)` — the `{ id, status }` of every asset whose status
 * was modified after `date`. `now()` is the clock, in milliseconds.
 *
 * Answers a function: `statusesOf(recordIds)` resolves to a Map of each id to its status, an id
 * the base does not hold left out — which `lib/assetListView.js:countedAssets` counts nowhere,
 * as a read that did not resolve always was.
 */
export function createAssetStatusMemory({ readByIds, readChangedSince, now = () => Date.now() }) {
    // Each asset's status and the moment the read that gave it was sent.
    const kept = new Map();
    // The read in flight for each id being read, answering a Map of what it read.
    const reading = new Map();
    // When the last question about changes was sent, or the first read; null while nothing is
    // kept.
    let askedAt = null;

    const keep = (rows, sentAt) => {
        const answered = new Map();
        for (const row of rows || []) {
            if (!row?.id || !row.status) continue;
            answered.set(row.id, row.status);
            const held = kept.get(row.id);
            if (held && held.readAt > sentAt) continue;
            kept.set(row.id, { status: row.status, readAt: sentAt });
        }
        return answered;
    };

    return async function statusesOf(recordIds) {
        const ids = [...new Set((recordIds || []).filter(Boolean))];
        const startedAt = now();

        // A memory nobody asked for past the bound holds nothing still answerable.
        if (askedAt !== null && startedAt - askedAt > STATUS_KEPT_MS) {
            kept.clear();
            askedAt = null;
        }
        if (askedAt !== null) {
            const changed = await readChangedSince(new Date(askedAt - STATUS_CHANGE_OVERLAP_MS));
            keep(changed, startedAt);
            askedAt = Math.max(askedAt, startedAt);
        }

        const fresh = new Map();
        const toRead = [];
        for (const id of ids) {
            const held = kept.get(id);
            if (held && held.readAt >= startedAt - STATUS_KEPT_MS) fresh.set(id, held.status);
            else if (!reading.has(id)) toRead.push(id);
        }
        if (toRead.length > 0) {
            const sentAt = now();
            const read = Promise.resolve()
                .then(() => readByIds(toRead))
                .then((rows) => {
                    const answered = keep(rows, sentAt);
                    if (askedAt === null) askedAt = sentAt;
                    return answered;
                });
            for (const id of toRead) reading.set(id, read);
            read.finally(() => {
                for (const id of toRead) if (reading.get(id) === read) reading.delete(id);
            }).catch(() => {});
        }

        const asked = new Set(ids);
        const pending = [...new Set(ids.filter((id) => !fresh.has(id) && reading.has(id)).map((id) => reading.get(id)))];
        for (const answered of await Promise.all(pending)) {
            for (const [id, status] of answered) if (asked.has(id) && !fresh.has(id)) fresh.set(id, status);
        }
        return new Map(ids.filter((id) => fresh.has(id)).map((id) => [id, fresh.get(id)]));
    };
}

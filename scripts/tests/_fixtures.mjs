// Fixture bookkeeping for the credentialed tier (#171) — tracking, ordered
// deletion, per-record reporting, and the measurement that the deletion worked.
//
// WHY THIS EXISTS. There were 16 hand-rolled copies of this cleanup loop and two
// of them lost their own fixtures, in two different ways. verify-blob-lifecycle-
// 140.mjs dropped a PO's items with a `Promise.allSettled` whose results it
// discarded and then deleted the PO anyway, stranding two rows that had to be
// found by hand in #162. verify-deliveries-162.mjs had no `try` around its body,
// so a throw skipped cleanup entirely and four aborted runs left 100 records on
// the shared base. Neither was special; they were the two copies that happened to
// be wrong. CLAUDE.md's "One rule, one implementation" is the whole argument.
//
// WHAT IT DOES NOT OWN: THE EXIT CODE. A leak is returned as a result and each
// script maps it to its own verdict, for two reasons. verify-variance-15.mjs has
// no `pass` variable to set — it deliberately computes no verdict about the thing
// under test — and inverting control flow in the three scripts that already lower
// their own `pass` from a failed delete (164, 166, 167) would rewrite working code
// to no end. The helper reports; the caller decides.
//
// CHILDREN BEFORE PARENTS, AND TWO REFINEMENTS THAT ARE NOT THE SAME THING:
//
//   1. A failed CHILD DELETE keeps the parent. The five scripts that used
//      `Promise.allSettled` deleted the parent regardless, which is precisely how
//      an orphan is made. A reported parent-plus-child pair is recoverable by
//      hand; an orphaned child had to be hunted for.
//   2. A failed PARENT READ skips the parent. Discovering children through
//      `find(id).catch(() => null)` turns a failed read into an EMPTY child list
//      rather than an unknown one, and the parent then goes anyway. That is a
//      different defect from (1) with the same outcome, and it is why the read
//      failure is reported rather than swallowed.
//
// MEASURED, NOT INFERRED. Calling destroy is not evidence that a row is gone, so
// teardown() measures twice: a census BEFORE deleting, which must find the rows
// this run created, and a residue check AFTER, which must find none. "Found n,
// then found 0" is evidence. "Found 0" is not evidence of anything — it is also
// what a query against the wrong field, the wrong table or a mis-escaped value
// returns, which is the shape of the `require()`-in-an-`.mjs` incident that made
// 29 offline checks pass for the wrong reason. A census that finds nothing while
// rows were tracked is reported as VACUOUS and that bucket falls back to
// re-reading its tracked ids, so a broken query degrades to the slower check
// instead of to silence.
//
// The census uses `prefixMatch`/`formulaString` from lib/airtableFormula.js
// rather than string concatenation (#159): the tag is interpolated into a
// filterByFormula, and there is one escape for that in this repo.
//
// WHERE THE TAG CANNOT REACH, named rather than left to be discovered:
//   - `Purchase Orders` — written by generatePOForApprovedPR, and a script sets
//     no text field on it. Always tracked, so tracked-id re-reads cover it.
//   - `Invoice-PO Link` — its primary field is an autoNumber and it carries no
//     text at all, so nothing can be tagged. Reached only as a discovered child.
//   - `PO Items`, `Materials`, `Material Prices` — written by production code, so
//     a tag reaches them only by flowing through a field the script does control
//     (an item name on the PR), which is what 162 does. Where a caller declares
//     no tagField for them, tracked-id re-reads are the only check.
//
// WHAT IT STILL DOES NOT COVER: INTERRUPTION. `try`/`finally` does not run on
// SIGINT or SIGTERM, and these scripts wait on real ceilings — a 15s poll in 162,
// a 10s confirm ceiling in 140 — so the window for Ctrl-C is wide. Handling that
// needs signal handlers plus re-entrancy protection plus a guarantee an async
// teardown finishes, which is a different mechanism from this contract; this
// helper is its precondition, because a signal handler needs one thing to call.
// Deliberately out of #171's scope and left with a home to come back to.

import { base } from "../../lib/airtable/client.js";
import { prefixMatch } from "../../lib/airtableFormula.js";

/**
 * One run's fixtures.
 *
 * `buckets` is ORDERED, and the order is the deletion order — children first.
 * Each entry:
 *   name      the key callers pass to track()/untrack()
 *   table     TABLES.X
 *   label     what the log calls one record
 *   tagField  a text field this run stamps with the tag, or omitted when none
 *             can reach (see the list above); enables the cheap census
 *   children  [{ link, table, label }] discovered through the parent's link
 *             field at cleanup time, deleted immediately before their parent
 *   discoverByTag
 *             the ids come from the tag query rather than from track(), for rows
 *             PRODUCTION CODE created that this script never holds an id for —
 *             the Materials and Material Prices rows PO generation writes as a
 *             side effect (#18). Requires tagField. 162/166/167 did this with a
 *             full-table `.all()` filtered in JS; one filterByFormula is both
 *             cheaper and the same query the residue check already needs.
 */
export function createFixtures({ tag, buckets }) {
    if (!tag) throw new Error("createFixtures: a run tag is required");
    if (!Array.isArray(buckets) || buckets.length === 0) {
        throw new Error("createFixtures: buckets must be a non-empty ordered array");
    }

    // Base36 of the clock, the shape 162 established. Long enough to tell two
    // runs apart on the same day, short enough to sit inside an item name.
    const TAG = `${tag}-${Date.now().toString(36).toUpperCase()}`;
    const byName = new Map(buckets.map((b) => [b.name, b]));
    const tracked = new Map(buckets.map((b) => [b.name, []]));

    function bucket(name) {
        const b = byName.get(name);
        // A typo'd bucket name would otherwise track into nothing and read as a
        // clean run — the same silent shape as a wrong field name in a tag query.
        if (!b) throw new Error(`fixtures: unknown bucket "${name}"`);
        return b;
    }

    /**
     * Remember a record this run created. Returns the id, so it composes.
     *
     * DEDUPED, and that is not tidiness — it is a correctness fix a real script
     * caught. verify-delivery-status-166.mjs tracks the same invoice from two
     * places, which its own hand-rolled `track` deduped. Without that, teardown
     * deletes the record on the first pass and on the second tries to read it for
     * its children; Airtable answers a gone record with "You are not authorized to
     * perform this operation", which is indistinguishable from a real permission
     * failure, so the run reported a leak for a row it had just deleted. Tracking
     * the same id twice is a caller convenience, never a signal.
     */
    const track = (name, id) => {
        bucket(name);
        const list = tracked.get(name);
        if (id && !list.includes(id)) list.push(id);
        return id;
    };

    /**
     * Forget a record this run deleted ON PURPOSE, as part of what it tests.
     *
     * A FIRST-CLASS OPERATION, not an edge case: verify-invoice-ids-164.mjs
     * destroys an invoice in Part E to prove a deleted sequence number is not
     * re-minted, and verify-deliveries-162.mjs deletes a delivery through the
     * production path in Part F. Without this the residue check reports a leak
     * for a row the test meant to remove, and a residue check that cries wolf is
     * one that gets ignored.
     */
    const untrack = (name, id) => {
        bucket(name);
        tracked.set(name, tracked.get(name).filter((x) => x !== id));
    };

    const ids = (name) => [...tracked.get(bucket(name).name)];

    /**
     * A Vercel Blob object this run uploaded (#171).
     *
     * IN SCOPE because it is the same swallow on another shared store: 167 logged
     * `blob already gone or unreachable (${e.message})`, which cannot tell the
     * harmless case from the leak, and 140 wraps its `del` in
     * `catch { /* already gone *\/ }`. The residue equivalent costs one call —
     * `head()` throws once an object is gone, so an object that still answers
     * `head` after `del` is a leak, measured rather than assumed.
     */
    const blobs = [];
    const trackBlob = (url) => {
        if (url && !blobs.includes(url)) blobs.push(url);
        return url;
    };
    /** Read back, for a check that asks whether a url is one this run uploaded. */
    const blobUrls = () => [...blobs];

    async function tagQuery(b) {
        const records = await base(b.table)
            .select({ filterByFormula: prefixMatch(b.tagField, TAG) })
            .all();
        return records.map((r) => r.id);
    }

    /** Is this record still there? `find` throws once it is gone. */
    async function stillThere(table, id) {
        try {
            await base(table).find(id);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Census, delete, residue — in that order, printing as it goes.
     *
     * Returns { leaked, unknown, vacuous, deleted, censusCounts, residueCounts }.
     * `leaked` is what a caller maps to its verdict; the rest is for the log and
     * for a caller that wants to say something more specific.
     */
    async function teardown({ log = console.log, warn = console.error } = {}) {
        const leaked = [];
        const unknown = [];
        const vacuous = [];
        const censusCounts = {};
        const residueCounts = {};
        let deleted = 0;

        // --- census -----------------------------------------------------------
        // Before deleting anything, prove the query that will later assert zero
        // can actually see this run's rows.
        for (const b of buckets) {
            if (!b.tagField) continue;
            if (b.discoverByTag) {
                // Nothing was tracked, so there is no superset to check — but the
                // census still has to see rows before the residue check can mean
                // anything, and here it doubles as the delete list.
                try {
                    const found = await tagQuery(b);
                    censusCounts[b.name] = found.length;
                    tracked.set(b.name, found);
                } catch (err) {
                    vacuous.push({ bucket: b.name, reason: `census query failed: ${err.message}` });
                }
                continue;
            }
            const trackedHere = tracked.get(b.name);
            let found;
            try {
                found = await tagQuery(b);
            } catch (err) {
                vacuous.push({ bucket: b.name, reason: `census query failed: ${err.message}` });
                continue;
            }
            censusCounts[b.name] = found.length;
            if (trackedHere.length > 0 && found.length === 0) {
                // The query is wrong, not the base. Fall back rather than trust it.
                vacuous.push({
                    bucket: b.name,
                    reason: `tag query on "${b.tagField}" found 0 rows while ${trackedHere.length} were tracked`,
                });
                continue;
            }
            // A superset, not an equality: discovered children carry the tag too
            // and are never tracked, so the census legitimately finds more.
            const missing = trackedHere.filter((id) => !found.includes(id));
            if (missing.length > 0) {
                vacuous.push({
                    bucket: b.name,
                    reason: `tag query missed ${missing.length} tracked id(s): ${missing.join(", ")}`,
                });
            }
        }
        for (const v of vacuous) {
            warn(`  census UNRELIABLE: ${v.bucket} — ${v.reason}; falling back to tracked-id re-reads`);
        }
        // PRINTED, not just returned. "Found n, then found 0" is only evidence if
        // both halves are in the log — a census that silently found nothing looks
        // exactly like a clean run, which is the failure this measurement exists
        // to rule out.
        const censusParts = buckets.map((b) => {
            const n = tracked.get(b.name).length;
            if (!b.tagField || vacuousBuckets().has(b.name)) return `${b.name} ${n} by tracked id`;
            if (b.discoverByTag) return `${b.name} ${censusCounts[b.name]} found by tag`;
            return `${b.name} ${censusCounts[b.name]} tagged`;
        });
        log(`  census (tag ${TAG}): ${censusParts.join(", ")}`);

        function vacuousBuckets() {
            return new Set(vacuous.map((v) => v.bucket));
        }

        // --- delete -----------------------------------------------------------
        const unreliable = vacuousBuckets();

        for (const b of buckets) {
            for (const id of ids(b.name)) {
                let childrenFailed = false;

                if (b.children?.length) {
                    let parent = null;
                    try {
                        parent = await base(b.table).find(id);
                    } catch (err) {
                        // REFINEMENT 2. A failed read makes the child list unknown,
                        // not empty, so the parent is not deleted over the top of it.
                        unknown.push({ table: b.table, id, label: b.label, reason: err.message });
                        leaked.push({ table: b.table, id, label: b.label, reason: `parent read failed: ${err.message}` });
                        warn(`  cleanup SKIPPED: ${b.label} ${id} — could not read its children (${err.message}); remove it and them manually`);
                        continue;
                    }
                    for (const spec of b.children) {
                        for (const childId of parent.get(spec.link) || []) {
                            try {
                                await base(spec.table).destroy(childId);
                                deleted += 1;
                                log(`  deleted ${spec.label} ${childId}`);
                            } catch (err) {
                                childrenFailed = true;
                                leaked.push({ table: spec.table, id: childId, label: spec.label, reason: err.message });
                                warn(`  cleanup FAILED: ${spec.label} ${childId} — remove manually: ${err.message}`);
                            }
                        }
                    }
                }

                if (childrenFailed) {
                    // REFINEMENT 1. Keeping the parent leaves a findable pair
                    // instead of an orphan.
                    leaked.push({ table: b.table, id, label: b.label, reason: "kept: a child delete failed" });
                    warn(`  cleanup SKIPPED: ${b.label} ${id} — kept so its undeleted children are not orphaned`);
                    continue;
                }

                try {
                    await base(b.table).destroy(id);
                    deleted += 1;
                    log(`  deleted ${b.label} ${id}`);
                } catch (err) {
                    leaked.push({ table: b.table, id, label: b.label, reason: err.message });
                    warn(`  cleanup FAILED: ${b.label} ${id} — remove manually: ${err.message}`);
                }
            }
        }

        // --- residue ----------------------------------------------------------
        // The other half of the measurement. A bucket whose census was reliable
        // is checked with one query; everything else is re-read per tracked id.
        for (const b of buckets) {
            const useTag = b.tagField && !unreliable.has(b.name);
            if (useTag) {
                try {
                    const left = await tagQuery(b);
                    residueCounts[b.name] = left.length;
                    for (const id of left) {
                        if (leaked.some((l) => l.id === id)) continue; // already reported
                        leaked.push({ table: b.table, id, label: b.label, reason: "still present after cleanup" });
                        warn(`  residue: ${b.label} ${id} survived cleanup — remove manually`);
                    }
                } catch (err) {
                    warn(`  residue check could not run for ${b.name}: ${err.message}`);
                }
                continue;
            }
            let left = 0;
            for (const id of ids(b.name)) {
                if (leaked.some((l) => l.id === id)) continue;
                if (await stillThere(b.table, id)) {
                    left += 1;
                    leaked.push({ table: b.table, id, label: b.label, reason: "still present after cleanup" });
                    warn(`  residue: ${b.label} ${id} survived cleanup — remove manually`);
                }
            }
            residueCounts[b.name] = left;
        }
        log(
            `  residue: ${buckets.map((b) => `${b.name} ${residueCounts[b.name] ?? 0}`).join(", ")}` +
                ` — every bucket must read 0`
        );

        // --- Vercel Blob ------------------------------------------------------
        // Imported only when there is something to delete, so a script that
        // uploads nothing does not pay for the dependency.
        if (blobs.length > 0) {
            let blobApi = null;
            try {
                blobApi = await import("@vercel/blob");
            } catch (err) {
                warn(`  blob cleanup could not run (${err.message}) — ${blobs.length} object(s) may remain`);
            }
            for (const url of blobs) {
                if (!blobApi) {
                    leaked.push({ table: "vercel-blob", id: url, label: "blob", reason: "cleanup could not run" });
                    continue;
                }
                try {
                    await blobApi.del(url);
                } catch (err) {
                    // Not fatal on its own: `del` is idempotent, so the head()
                    // below is what decides whether anything is still there.
                    warn(`  blob del reported ${err.message} — ${url}`);
                }
                let present = false;
                try {
                    await blobApi.head(url);
                    present = true;
                } catch {
                    present = false; // head throws once the object is gone
                }
                if (present) {
                    leaked.push({ table: "vercel-blob", id: url, label: "blob", reason: "still present after del" });
                    warn(`  residue: blob ${url} survived del — remove manually`);
                } else {
                    deleted += 1;
                    log(`  deleted blob ${url}`);
                }
            }
        }

        return { leaked, unknown, vacuous, deleted, censusCounts, residueCounts };
    }

    /**
     * The two lines a caller prints. Kept here so 16 scripts cannot come to word
     * the same outcome 16 ways — and separate from the feature verdict on
     * purpose: as verify-invoice-ids-164.mjs stood, a leak printed
     * `SOME CHECKS FAILED`, which is the right exit code attached to a sentence
     * that sends the reader looking at the feature instead of at the base.
     */
    function describe(report) {
        if (report.leaked.length === 0) {
            return `CLEANUP CLEAN — ${report.deleted} record(s) deleted, none left on the base`;
        }
        return (
            `CLEANUP INCOMPLETE — ${report.leaked.length} record(s) left on the base ` +
            `(listed above; tag ${TAG})`
        );
    }

    return { TAG, track, untrack, trackBlob, blobUrls, ids, teardown, describe };
}

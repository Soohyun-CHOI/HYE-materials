// Blob object lifecycle (issue #140). Every upload path in this app writes
// the file to Vercel Blob first and then hands Airtable the URL, so Airtable
// fetches the bytes and keeps its own copy — the copy of record. That leaves
// the Blob object with no further purpose, and until #140 nothing deleted it.
//
// This module owns the whole confirm-then-delete sequence so no call site
// restates it: wait until Airtable has actually taken the file, then delete
// the object we created. Callers run it at the END of their transaction, once
// every write has succeeded — not straight after the attachment write. A
// rollback (invoice creation, PR persist, edit-and-continue all roll their
// writes back) must leave the object alive so the user's retry can re-submit
// the same URL; deleting at ingest time would turn a failure the user didn't
// cause into "upload the file again".
//
// Cleanup is best-effort by design. It never throws and it never fails the
// caller's action: by the time it runs, Airtable already holds the file, so
// the user's work is safe and a leftover object is a housekeeping problem,
// not a data problem.

import { del } from "@vercel/blob";
import { base } from "./airtable/client";

// Measured on this base (2026-07-27, 5 samples, 200ms polling): Airtable
// replaced the submitted URL with its own after 825/890/913/959/943 ms —
// always the third poll, never a miss. The interval below is a little wider
// than that measurement so a single confirm stays under Airtable's 5 req/s
// per-base budget (3.3 req/s) while still catching a ~900ms ingest in ~3
// polls; the ceiling is ~10x the slowest observed ingest, so it only fires
// when something is actually wrong rather than merely slow.
export const INGEST_POLL_INTERVAL_MS = 300;
export const INGEST_CONFIRM_TIMEOUT_MS = 10000;

// Which store an object belongs to — NOT the ingest signal (see
// isIngested below for that). Used only to skip URLs that were never ours to
// delete: a Draft re-opened later carries Airtable's own attachment URL
// instead of a Blob one (lib/prDraft.js), and re-saving it must not try to
// delete anything. Same host predicate the detect-po SSRF guard uses.
const OUR_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isOurBlobUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname.endsWith(OUR_BLOB_HOST_SUFFIX);
    } catch {
        return false;
    }
}

/**
 * Has Airtable taken THIS file? The signal is that the attachment we wrote no
 * longer carries the URL we submitted — Airtable replaces it with its own once
 * the bytes are stored. That property is what we actually mean, so it's
 * compared directly rather than by matching Airtable's current CDN hostname
 * (which is versioned) or by waiting for a populated size.
 *
 * Keyed on the attachment id, not on "no attachment carries our URL": the
 * attachment write response already returns an id for the pending file, and
 * that id survives the ingest (measured). Without the id, a field that still
 * holds an EARLIER file satisfies "none of them is ours" and the object gets
 * deleted for an ingest that never happened — the first version of this
 * module had exactly that hole, and verify-blob-lifecycle-140.mjs caught it.
 *
 * A missing id is deliberately NOT ingested: Airtable answers the attachment
 * write with a success and drops the file silently when it can't fetch the URL
 * (confirmed — a write pointing at a deleted object returned success and left
 * the field empty 30s later). Treating that as pending sends it to the timeout
 * branch (object kept, logged) instead of deleting the last copy of the file.
 */
function isIngested(files, attachmentId, submittedUrl) {
    if (!Array.isArray(files)) return false;
    const ours = files.find((f) => f.id === attachmentId);
    if (!ours) return false;
    return ours.url !== submittedUrl;
}

/**
 * Deletes one Blob object, swallowing any failure. Used on its own by the
 * PO PDF path when the attachment write throws — no ingest will follow a
 * failed write, so the object can go immediately.
 */
export async function deleteBlobBestEffort(blobUrl, label = "blob") {
    if (!isOurBlobUrl(blobUrl)) return false;
    try {
        await del(blobUrl);
        return true;
    } catch (err) {
        // An orphan, not a failure the user should see.
        console.error(`[blob cleanup] couldn't delete ${label} (${blobUrl}) — orphan left behind`, err);
        return false;
    }
}

/**
 * For each target: poll its Airtable record until the attachment stops
 * carrying our Blob URL, then delete the object.
 *
 * targets: [{ table, recordId, field, blobUrl, attachmentId, label }]
 *   table/recordId/field — where the attachment landed
 *   blobUrl              — exactly the URL handed to Airtable
 *   attachmentId         — the id Airtable returned for that attachment in the
 *                          write response (record.get(field)[0].id); without
 *                          it the target is skipped and the object kept, since
 *                          the ingest can't be attributed
 *
 * Targets are processed one at a time on purpose: a PR can carry several
 * quotations, and polling them in parallel would multiply the request rate
 * against Airtable's per-base budget. The cost is ~1s of wall time per
 * ingested file, paid at the end of the action.
 *
 * On timeout the object is KEPT and the outcome logged: a late ingest would
 * fetch a URL we'd already deleted, so one orphan is strictly better than an
 * attachment that resolves to nothing. Never throws; returns one result per
 * target for callers that want to assert on it (see
 * scripts/tests/verify-blob-lifecycle-140.mjs).
 */
export async function confirmIngestThenDelete(targets) {
    const results = [];

    for (const target of Array.isArray(targets) ? targets : []) {
        const { table, recordId, field, blobUrl, attachmentId, label = "blob" } = target || {};
        if (!table || !recordId || !field || !attachmentId || !isOurBlobUrl(blobUrl)) {
            results.push({ label, blobUrl, confirmed: false, deleted: false, skipped: true });
            continue;
        }

        const startedAt = Date.now();
        let confirmed = false;
        while (Date.now() - startedAt < INGEST_CONFIRM_TIMEOUT_MS) {
            let files;
            try {
                const record = await base(table).find(recordId);
                files = record.get(field);
            } catch (err) {
                // A read failure says nothing about the ingest, so keep the
                // object and stop: the next poll would likely fail the same way.
                console.error(`[blob cleanup] couldn't re-read ${label} to confirm ingest`, err);
                break;
            }
            if (isIngested(files, attachmentId, blobUrl)) {
                confirmed = true;
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, INGEST_POLL_INTERVAL_MS));
        }

        if (!confirmed) {
            console.error(
                `[blob cleanup] ingest not confirmed for ${label} within ${INGEST_CONFIRM_TIMEOUT_MS}ms — keeping ${blobUrl}`
            );
            results.push({ label, blobUrl, confirmed: false, deleted: false, waitedMs: Date.now() - startedAt });
            continue;
        }

        const deleted = await deleteBlobBestEffort(blobUrl, label);
        results.push({ label, blobUrl, confirmed: true, deleted, waitedMs: Date.now() - startedAt });
    }

    return results;
}

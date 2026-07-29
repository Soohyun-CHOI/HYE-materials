// When a re-saved Draft may keep its existing Quotation record (issue #142).
//
// The bug this names: persistPRFromForm rebuilds a Draft's children from form
// state, and for a Quotation that means handing Airtable the url the form is
// carrying. For an entry hydrated from a re-opened Draft that url is
// Airtable's OWN signed url, good for about two hours. Past that window the
// attachment write still returns success and silently leaves the field empty
// (CLAUDE.md, File uploads), so re-saving a Draft the next morning deleted the
// quotation file with no error anywhere.
//
// Refreshing the url immediately before re-submitting was rejected as the fix:
// it narrows the window instead of closing it, and it leaves the same rule
// ("re-upload the file on every save") in place. The rule here is instead
// "an attachment that did not change is not rewritten".
//
// Deliberately pure and dependency-free, so the offline check tier can pin it
// (scripts/tests/offline/quotation-reuse.mjs). The caller computes the two
// facts, because both come from places this module should not reach into:
// which records the PR actually has right now, and whether a url belongs to
// our Blob store (lib/blobIngest.js:isOurBlobUrl, which is not importable
// without credentials).

/**
 * May this form entry keep the Quotation record it came from?
 *
 * recordId      — the stored record this entry was hydrated from, "" when the
 *                 entry was added in this session (lib/prDraft.js supplies it)
 * isLiveRecord  — that record is still among the PR's Quotations. False means
 *                 there is nothing left to keep, and it does not take anyone
 *                 editing Airtable: the same Draft open in two tabs, one of
 *                 which REPLACES a file and saves, is enough. A replacement is
 *                 a destroy-and-create, so that entry's record id changes and
 *                 the other tab is holding a dead one. (Hand-deleting the
 *                 record does it too, but that is the rarer path.) Such an
 *                 entry falls back to the create path with a url that may
 *                 have expired — the hole this rule narrows rather than
 *                 closes; see CLAUDE.md's Draft re-save follow-up.
 * isFreshUpload — the entry's url is one of ours, i.e. the Requester picked a
 *                 new file in this session. True means the entry genuinely has
 *                 new bytes and must be written; the url is a Blob one that
 *                 Airtable can fetch, so writing it is safe.
 *
 * All three conditions are about the SAME form entry, which is what makes the
 * answer trustworthy: recordId and url travel in one object through the form
 * (PRForm keeps them together when a file is replaced and splices the whole
 * object when an entry is removed), so they cannot come to describe different
 * records.
 */
export function shouldReuseQuotation({ recordId, isLiveRecord, isFreshUpload }) {
    return Boolean(recordId) && Boolean(isLiveRecord) && !isFreshUpload;
}

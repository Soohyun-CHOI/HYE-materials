// When a re-saved Draft may keep its existing Quotation record (issue #142), what
// a save does with every quotation entry it is handed (#438), and what the form
// does with those entries once the draft they came from is gone (#440).
//
// The bug this names: persistPRFromForm rebuilds a Draft's children from form
// state, and for a Quotation that means handing Airtable the url the form is
// carrying. For an entry hydrated from a re-opened Draft that url is
// Airtable's OWN signed url, good for about two hours. Past that window the
// attachment write still returns success and silently leaves the field empty
// (docs/notes/uploads-and-drafts.md), so re-saving a Draft the next morning deleted the
// quotation file with no error anywhere.
//
// Refreshing the url immediately before re-submitting was rejected as the fix:
// it narrows the window instead of closing it, and it leaves the same rule
// ("re-upload the file on every save") in place. The rule here is instead
// "an attachment that did not change is not rewritten".
//
// Deliberately pure and dependency-free, so the offline check tier can pin it
// (scripts/tests/offline/quotation-reuse.mjs). The caller computes the facts,
// because they come from places this module should not reach into: which records
// the PR actually has right now, which is a read, and whether a url belongs to our
// Blob store, which is lib/fileSource.js:isOurBlobUrl and answers from the
// deployment's own environment. That predicate is importable offline since #438;
// taking its answer as an argument keeps this module free of the environment, so a
// check hands it a fact rather than a store.

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
 *                 entry fell back to the create path with a url that may have
 *                 expired until #438, which refuses it instead — see
 *                 planQuotationEntry below.
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

/** What a save does with one quotation entry — planQuotationEntry's answers. */
export const QUOTATION_ENTRY = Object.freeze({
    /** No file and no code: dropped, which is #72's rule for a fully empty entry. */
    skip: "skip",
    /** Kept as the record it came from. Its url is never written. */
    reuse: "reuse",
    /** A new Quotations record, from a file on our store or from a code alone. */
    create: "create",
    /** Names a record the Draft no longer has, and carries a url that is not ours. */
    changedElsewhere: "changed-elsewhere",
    /** Names no record, and carries a url that is not ours. */
    notOurFile: "not-our-file",
});

/**
 * What a save does with one quotation entry (#142, #438). The last two answers are
 * refusals, and the caller asks for every entry before it writes anything, so a
 * refused save leaves the Draft exactly as it was.
 *
 * THE ENTRY THAT KEEPS ITS RECORD IS WHY NO URL NEEDS AN EXCEPTION. A quotation a
 * reopened Draft keeps is judged by its record id — among this Draft's own
 * Quotations right now — and its url is never handed to Airtable, so the one url
 * that is not our Blob and still belongs never reaches a write. Every url that
 * would be written is held to our store, which is the whole rule. A url Airtable
 * issued for another record, or one copied from anywhere, falls to the create path
 * like any other and is refused there.
 *
 * TWO REFUSALS BECAUSE TWO THINGS HAPPENED. An entry naming a record the Draft no
 * longer has is the same Draft saved from another tab after that tab replaced or
 * removed a file — the one refusal here a reader can meet on a screen, and the
 * sentence for it is QUOTATION_REUSE_COPY's. An entry naming no record came from
 * nowhere the form can put a url, so it is a direct call, and the caller gives it
 * the sentence it gives a missing file.
 *
 * hasFile / hasCode — the entry carries a url / a Vendor Quotation Code
 * isOurFile         — that url is on our Blob store (lib/fileSource.js)
 * recordId, isLiveRecord — as shouldReuseQuotation takes them
 */
export function planQuotationEntry({ recordId, hasFile, hasCode, isLiveRecord, isOurFile }) {
    if (!hasFile && !hasCode) return QUOTATION_ENTRY.skip;
    if (shouldReuseQuotation({ recordId, isLiveRecord, isFreshUpload: isOurFile })) {
        return QUOTATION_ENTRY.reuse;
    }
    if (hasFile && !isOurFile) {
        return recordId && !isLiveRecord ? QUOTATION_ENTRY.changedElsewhere : QUOTATION_ENTRY.notOurFile;
    }
    return QUOTATION_ENTRY.create;
}

/**
 * The request form's quotation entries once the draft they were saving onto is gone
 * (#440) — deleted from this tab's own list, or from anywhere else, which a save
 * learns as `OWN_DRAFT_REFUSAL.gone`. Returns `{ entries, filesDropped }`.
 *
 * WITHOUT THIS THE NEXT SAVE IS REFUSED, AND IT WAS, ON THE SAME-TAB PATH TOO. The form
 * lets go of the draft's record id so the next save creates a request, but an entry it
 * hydrated from that draft still carries the draft's Quotation record id and
 * Airtable's url for its file. With no draft behind the save, that record is not among
 * its quotations, so `planQuotationEntry` answers `changedElsewhere` and the save is
 * refused with a sentence telling the reader to reopen a draft that no longer exists —
 * which is what deleting an open draft that had a quotation file did from #438 on.
 *
 * SO EVERY ENTRY LOSES ITS RECORD ID, and one whose file came from the draft loses the
 * file as well: that file is Airtable's copy on a record that is gone, and a url that
 * is not ours is refused on the way in (#438) rather than re-read. What tells the two
 * kinds of file apart is `quotationId` on the file object (#331) — a file picked in
 * this session replaced the object and took it with it, so a fresh upload is kept.
 * The typed Vendor Quotation Code stays either way.
 */
export function detachQuotations(entries) {
    let filesDropped = 0;
    const detached = entries.map((entry) => {
        const fromDraft = Boolean(entry.file?.quotationId);
        if (fromDraft) filesDropped += 1;
        return { ...entry, recordId: "", file: fromDraft ? { status: "idle" } : entry.file };
    });
    return { entries: detached, filesDropped };
}

export const QUOTATION_REUSE_COPY = {
    /**
     * The same Draft saved from another tab after that tab replaced or removed one
     * of its quotations (#438). The shape of the invoice form's `One of the
     * selected POs no longer exists. Reload the form and try again.` — what
     * happened, then the one move that works. Reopening shows the Draft as it is
     * now; a save from here would otherwise put back a quotation it no longer has.
     */
    changedElsewhere: "One of this draft's quotations was changed in another tab. Reopen the draft and try again.",
};

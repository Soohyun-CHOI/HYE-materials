// shouldReuseQuotation — when a re-saved Draft keeps its Quotation record.
//
// Pinned here because the condition is a data-loss rule (#142), not a
// convenience. Getting it wrong in the permissive direction rewrites an
// attachment from an expiring url and silently empties the field; getting it
// wrong in the restrictive direction is merely wasteful. A future
// "simplification" that drops one of the three terms is exactly what this
// catches.
//
// lib/quotationReuse.js imports nothing, which is why this can be an offline
// check at all — the caller computes the facts precisely so the rule itself
// stays reachable without credentials.
//
// #438 ADDED THE WHOLE ENTRY'S FATE, and its mutant is the permissive one again:
// a plan that lets an entry naming a dead record, or naming none, carry a url that
// is not ours through to `create` hands Airtable an address it will fetch and keep.
// So the refusals are asserted first among the new cases, and the reuse case beside
// them, since that is the one url that is not ours and still belongs.
//
// #440 ADDED WHAT THE FORM DOES ONCE ITS DRAFT IS GONE, and the first assertion there
// is the defect itself: an entry the form kept after its draft was deleted is refused
// by the plan above, which is how deleting an open draft that had a quotation file
// left the next save with nowhere to go.

import {
    QUOTATION_ENTRY,
    QUOTATION_REUSE_COPY,
    detachQuotations,
    planQuotationEntry,
    shouldReuseQuotation,
} from "../../../lib/quotationReuse.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Draft re-save — shouldReuseQuotation (#142), each entry's fate (#438), and letting go of a gone draft (#440)";

export function run({ check }) {
    // The case the bug was: hydrated from a Draft, file untouched, so the url
    // is Airtable's own and about to expire. Must be reused, never rewritten.
    check(
        "hydrated entry, file untouched -> reuse",
        shouldReuseQuotation({ recordId: "recQ1", isLiveRecord: true, isFreshUpload: false }),
        true
    );

    // The Requester picked a new file on an existing entry. Genuinely new
    // bytes, and the url is a Blob one Airtable can fetch, so it is written.
    check(
        "hydrated entry, file replaced -> do not reuse",
        shouldReuseQuotation({ recordId: "recQ1", isLiveRecord: true, isFreshUpload: true }),
        false
    );

    // Added in this session: nothing to reuse.
    check(
        "new entry -> do not reuse",
        shouldReuseQuotation({ recordId: "", isLiveRecord: false, isFreshUpload: true }),
        false
    );

    // The record no longer exists, so keeping a reference to it would preserve
    // nothing. The realistic way in is two tabs on one Draft where the other
    // replaced a file and saved (a replacement is destroy-and-create, so the
    // id this tab holds is dead), not someone hand-deleting the record.
    check(
        "hydrated entry whose record is gone -> do not reuse",
        shouldReuseQuotation({ recordId: "recGone", isLiveRecord: false, isFreshUpload: false }),
        false
    );

    // A code-only Draft entry (no file was ever attached) still names a real
    // record, and reusing it leaves its empty File field alone rather than
    // rewriting it.
    check(
        "code-only hydrated entry -> reuse",
        shouldReuseQuotation({ recordId: "recQ2", isLiveRecord: true, isFreshUpload: false }),
        true
    );

    // Every term is load-bearing: dropping any one of them changes an answer
    // above, so none of them is decoration.
    check(
        "missing recordId alone is enough to refuse",
        shouldReuseQuotation({ recordId: "", isLiveRecord: true, isFreshUpload: false }),
        false
    );
    check(
        "a fresh upload alone is enough to refuse",
        shouldReuseQuotation({ recordId: "recQ1", isLiveRecord: true, isFreshUpload: true }),
        false
    );
    check(
        "a dead record alone is enough to refuse",
        shouldReuseQuotation({ recordId: "recQ1", isLiveRecord: false, isFreshUpload: false }),
        false
    );

    // Shape robustness: the form serializes recordId as "" and the callers pass
    // whatever Set.has()/isOurBlobUrl() returned, so undefined must not read as
    // permission.
    check(
        "undefined recordId refuses",
        shouldReuseQuotation({ recordId: undefined, isLiveRecord: true, isFreshUpload: false }),
        false
    );
    check(
        "undefined isLiveRecord refuses",
        shouldReuseQuotation({ recordId: "recQ1", isLiveRecord: undefined, isFreshUpload: false }),
        false
    );
    check("an empty argument object refuses", shouldReuseQuotation({}), false);

    // ── #438 — what a save does with each entry ────────────────────────────────
    const plan = (facts) =>
        planQuotationEntry({ recordId: "", hasFile: false, hasCode: false, isLiveRecord: false, isOurFile: false, ...facts });

    // THE TWO REFUSALS FIRST: the url would reach Airtable and is not ours.
    check(
        "an entry naming a record the draft no longer has, url not ours -> refused as changed elsewhere",
        plan({ recordId: "recGone", hasFile: true, isLiveRecord: false, isOurFile: false }),
        QUOTATION_ENTRY.changedElsewhere
    );
    check(
        "an entry naming no record, url not ours -> refused as not our file",
        plan({ recordId: "", hasFile: true, isOurFile: false }),
        QUOTATION_ENTRY.notOurFile
    );
    check(
        "  and a code beside it does not rescue it",
        plan({ recordId: "", hasFile: true, hasCode: true, isOurFile: false }),
        QUOTATION_ENTRY.notOurFile
    );

    // THE ONE URL THAT IS NOT OURS AND STILL BELONGS: kept by its record, never written.
    check(
        "hydrated entry whose record is live, file untouched -> reuse",
        plan({ recordId: "recQ1", hasFile: true, isLiveRecord: true, isOurFile: false }),
        QUOTATION_ENTRY.reuse
    );
    check(
        "  and a live code-only entry is reused too",
        plan({ recordId: "recQ2", hasCode: true, isLiveRecord: true }),
        QUOTATION_ENTRY.reuse
    );

    check(
        "a file this session uploaded, no record -> create",
        plan({ recordId: "", hasFile: true, isOurFile: true }),
        QUOTATION_ENTRY.create
    );
    check(
        "a replaced file on a live entry -> create",
        plan({ recordId: "recQ1", hasFile: true, isLiveRecord: true, isOurFile: true }),
        QUOTATION_ENTRY.create
    );
    check(
        "a file uploaded again on an entry whose record went -> create, not refused",
        plan({ recordId: "recGone", hasFile: true, isLiveRecord: false, isOurFile: true }),
        QUOTATION_ENTRY.create
    );
    check(
        "a code with no file on a dead record -> create, since no url reaches Airtable",
        plan({ recordId: "recGone", hasCode: true, isLiveRecord: false }),
        QUOTATION_ENTRY.create
    );
    check("no file and no code -> skip (#72)", plan({ recordId: "recQ1", isLiveRecord: true }), QUOTATION_ENTRY.skip);

    // The answers are a closed set, and every one of them is reachable above.
    check(
        "the plan's answers are exactly five",
        Object.values(QUOTATION_ENTRY).sort().join(","),
        "changed-elsewhere,create,not-our-file,reuse,skip"
    );

    check(
        "the sentence a reader meets for the two-tab case",
        QUOTATION_REUSE_COPY.changedElsewhere,
        "One of this draft's quotations was changed in another tab. Reopen the draft and try again."
    );

    // ── #440 — the entries once the draft they came from is gone ───────────────
    // Three entries as the form holds them: one hydrated from the draft and never
    // touched, one hydrated and then given a new file this session, one added fresh.
    // `isOurFile` is what the save would compute for each url.
    const fromDraft = {
        recordId: "recQ1",
        file: { status: "done", url: "https://v5.airtableusercontent.com/q.pdf", filename: "q.pdf", quotationId: "HYE-PR-1-Q01" },
        vendorQuotationCode: "VQ-1",
    };
    const replaced = {
        recordId: "recQ2",
        file: { status: "done", url: "https://ours.public.blob.vercel-storage.com/q2.pdf", filename: "q2.pdf" },
        vendorQuotationCode: "VQ-2",
    };
    const fresh = { recordId: "", file: { status: "done", url: "https://ours.public.blob.vercel-storage.com/q3.pdf" }, vendorQuotationCode: "" };
    const saved = (entry, isOurFile) =>
        plan({
            recordId: entry.recordId,
            hasFile: Boolean(entry.file?.url),
            hasCode: Boolean(entry.vendorQuotationCode),
            // No draft behind the save, so no record is among its quotations.
            isLiveRecord: false,
            isOurFile,
        });

    // THE DEFECT, SHOWN RATHER THAN DESCRIBED: this is what the list's own delete left
    // the form holding, and the next save refused it.
    check(
        "an entry the form kept after its draft went is refused on the next save",
        saved(fromDraft, false),
        QUOTATION_ENTRY.changedElsewhere
    );
    const { entries, filesDropped } = detachQuotations([fromDraft, replaced, fresh]);
    check("letting go empties the one file that came from the draft", filesDropped, 1);
    check("  and every entry loses its record id", entries.map((e) => e.recordId).join(","), ",,");
    check("  the draft's own file is gone from its entry", entries[0].file.status, "idle");
    check("  its typed code stays", entries[0].vendorQuotationCode, "VQ-1");
    check("  a file picked this session is kept", entries[1].file.url, replaced.file.url);
    check("  and so is a fresh entry's", entries[2].file.url, fresh.file.url);
    // And the save that follows creates what it can and refuses nothing.
    check("the emptied entry saves as a code on a new quotation", saved(entries[0], false), QUOTATION_ENTRY.create);
    check("  the replaced one as a new quotation", saved(entries[1], true), QUOTATION_ENTRY.create);
    check("  and the fresh one likewise", saved(entries[2], true), QUOTATION_ENTRY.create);
    check("the entries it was handed are not changed in place", fromDraft.recordId, "recQ1");
    check("a draft with no quotation files drops nothing", detachQuotations([fresh]).filesDropped, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

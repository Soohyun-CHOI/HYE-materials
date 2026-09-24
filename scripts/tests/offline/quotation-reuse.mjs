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

import {
    QUOTATION_ENTRY,
    QUOTATION_REUSE_COPY,
    planQuotationEntry,
    shouldReuseQuotation,
} from "../../../lib/quotationReuse.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Draft re-save — shouldReuseQuotation (#142) and each entry's fate (#438)";

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
}

if (isMain(import.meta.url)) standalone(title, run);

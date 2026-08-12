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
// check at all — the caller computes the two facts precisely so the rule itself
// stays reachable without credentials.

import { shouldReuseQuotation } from "../../../lib/quotationReuse.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Draft re-save — shouldReuseQuotation (#142)";

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
}

if (isMain(import.meta.url)) standalone(title, run);

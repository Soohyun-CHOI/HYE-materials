// Shared PR row-visibility rule (#119, extracted in #132, widened in #143).
// One source of truth for "may this user see this PR" — used by the
// submitted-PR list (app/prs/page.js) to filter rows, by the PR detail page
// (app/prs/[prId]/page.js) to gate the whole page, and by the PO detail page
// (app/pos/[poId]/page.js) to gate a PO through its parent PR. Pure: no
// Airtable calls, callers pass the already-loaded user and PR.
//
// The rule, in order:
//
//   1. A **Draft** is visible only to the Requester who is writing it —
//      before anyone else, including President/Admin. Every other Draft
//      surface is already private that way (the resume prompt and the drafts
//      list both read getDraftsByRequester), and nothing in the app links to
//      someone else's Draft, so this closes the one route that existed rather
//      than removing a path anyone uses. An unsubmitted PR is not yet a
//      record of anything; its assigned signers have nothing to sign.
//   2. President/Admin see every submitted PR.
//   3. The Requester sees their own.
//   4. Anyone assigned to the PR's Job sees it.
//   5. A **signer on this PR's chain** sees it (#143).
//   6. The **recipient of a correction request on this PR** sees it (#143).
//
// 5 and 6 exist because without them the gate would cut the signing chain:
// neither a signer nor a correction recipient is guaranteed to be assigned to
// the PR's Job, and a participant who cannot open the PR cannot take their
// turn — the chain stops there. Both are deliberately **status-agnostic**: a
// signer who already approved, one pushed back to Pending by a correction, and
// the recipient of a correction that is already Resolved all keep access. Two
// reasons. It would be strange to be locked out of a document you signed; and
// every chain action ends in `redirect()` back to this same PR page
// (app/prs/[prId]/actions.js), so access that expired at the moment of acting
// would bounce the actor straight into a refusal.
//
// How 5 and 6 are answered without a query: both sides of each relation
// already carry the child record ids as link arrays, so membership is a set
// intersection. `Users."PR Signers"` lists the signer rows naming this user
// and `Purchase Requests."PR Signers"` lists this PR's; if they overlap, the
// user signs this PR. Same shape for `Correction Requests (Sent To)`. That
// keeps this function pure and adds **zero** Airtable reads to either page —
// the list in particular stays one pass over rows it already has, with no
// per-row round trip. Same reasoning as recordToPR's `purchaseOrders`.
//
// What the intersection cannot do is read a child's fields, so 6 cannot filter
// on `Status`. That costs nothing here because status-agnostic is what we
// want anyway (above); it would cost one read per correction row otherwise.
//
// Note on `Sent To` ambiguity: CLAUDE.md records that it holds a single user
// id and cannot say whether a correction went to someone *as a signer* or *as
// the Requester* when they are both. That ambiguity is about the recipient's
// capacity, not their identity, and 6 only asks "is this user the recipient",
// so it does not reach this decision.

/** Do two link arrays share any record id? */
function intersects(a, b) {
    const seen = new Set(a);
    return b.some((id) => seen.has(id));
}

// Clauses 5 and 6 read data the caller has to supply, and a caller that omits
// it must not be answered — it must be told.
//
// Missing arrays would otherwise deny, which looks like the safe direction and
// is not: the result is a signer unable to open the PR they are meant to sign,
// which is precisely the stalled chain those two clauses exist to prevent, and
// it would fail with no error to trace. So an absent array is treated as a
// programming error rather than as a state.
//
// recordToUser and recordToPR both default these to [], so `undefined` can
// only mean the object never went through a mapper. Every production caller
// does today (app/prs/page.js, app/prs/[prId]/page.js, app/pos/[poId]/page.js
// — all three take the PR from lib/airtable/purchaseRequests.js and the user
// from requireUser -> getUserByRecordId), which makes this unreachable now and
// a tripwire for the next call site.
//
// What it deliberately cannot catch: Airtable omits an empty link field, so a
// PR with genuinely no signers also arrives as undefined and the mapper's
// `|| []` is what makes it []. "Empty" and "not selected" are therefore
// indistinguishable downstream, and a hypothetical field-limited select would
// pass this check while silently disabling both clauses.
function requireChainFields(user, pr) {
    const missing = [
        Array.isArray(user.signerRowIds) ? null : "user.signerRowIds",
        Array.isArray(user.correctionRowIds) ? null : "user.correctionRowIds",
        Array.isArray(pr.signerRowIds) ? null : "pr.signerRowIds",
        Array.isArray(pr.correctionRowIds) ? null : "pr.correctionRowIds",
    ].filter(Boolean);

    if (missing.length > 0) {
        throw new Error(
            `canViewPR: missing chain field(s) ${missing.join(", ")} — the user and PR must come from ` +
                `recordToUser/recordToPR (lib/airtable/users.js, lib/airtable/purchaseRequests.js), which ` +
                `supply them. Answering without them would refuse a signer access to their own PR (#143).`
        );
    }
}

export function canViewPR(user, pr) {
    if (!user || !pr) return false;

    // A Draft belongs to whoever is still writing it. Deliberately ahead of
    // the President/Admin short-circuit below.
    if (pr.status === "Draft") return pr.requester?.[0] === user.id;

    if (user.role === "President" || user.isAdmin === true) return true;

    // Optional chaining keeps this safe for a PR missing a requester/job (it
    // simply fails both ownership checks — the safe default); an empty
    // Assigned Jobs list still leaves the "raised it" half, so a user always
    // sees their own.
    if (pr.requester?.[0] === user.id) return true;
    if ((user.assignedJobs || []).includes(pr.job?.[0])) return true;

    // Only now does the answer depend on the link arrays, so this is the point
    // to insist on them — a decision already reached above never needed them.
    requireChainFields(user, pr);

    // #143 — chain participation, either role.
    if (intersects(user.signerRowIds, pr.signerRowIds)) return true;
    if (intersects(user.correctionRowIds, pr.correctionRowIds)) return true;

    return false;
}

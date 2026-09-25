// Who raised a request, whether the reader is them, and what a write onto a draft
// that is not theirs is told (#440).
//
// `Purchase Requests."Requester"` is a link, so the mapper hands back an ARRAY, and
// every screen and action that asked "is this the reader's request" used to spell the
// answer for itself. Ten sites compared the array's first element with the reader;
// one — `getDraftsByRequester`, since #248 — asked whether the array CONTAINED them.
// The two agree on every row this app can write, and the day they disagree a person
// sees a draft on `/prs/new` that saving then refuses. So the meaning lives here and
// nothing else reads the field: `offline/pr-requester.mjs` fails a read of
// `.requester` anywhere under `app/` or `lib/` outside this file.
//
// THE REQUESTER IS THE FIRST LINKED USER, AND FOUR THINGS DECIDE THAT.
//   - The schema wants one. `Requester` carries `prefersSingleRecordLink: true`, the
//     app's one writer (`createPR`) links exactly one user, and every one of the base's
//     41 requests held one on 2026-09-25. So no stored answer moved.
//   - The places that cannot be plural already read the first. The signing chain's
//     requester turn is ONE user (`lib/prSigning.js`), and the mail that turn sends
//     has one recipient. Membership would hand a second linked user — reachable only
//     by a paste or an API write — the right to withdraw, delete, save and send the
//     order to the vendor, while the chain went on waiting for the first: one request,
//     two meanings of its requester. With the first element that second user can do
//     nothing and nothing waits on them.
//   - #248 chose membership to answer exactly what the walk it replaced answered
//     (`Users."Purchase Requests"`, a reverse link that lists a request under every
//     user it names). That was a refactor's proof obligation, and nothing reads that
//     link any more.
//   - "Exactly one or nobody" was weighed and refused. It would hide such a draft from
//     its own requester and stop the chain at the requester's turn, which is the
//     refusal-that-looks-safe `lib/prVisibility.js` records declining for its own
//     clauses.
//
// Pure and import-free, so the offline tier pins every clause and a Client Component
// may import it.

/** The record id of the user who raised this request, or null. */
export function requesterOf(pr) {
    return pr?.requester?.[0] ?? null;
}

/** Did this user raise this request? False for a missing user or request. */
export function isRequester(user, pr) {
    const requesterId = requesterOf(pr);
    return requesterId !== null && requesterId === user?.id;
}

/** Why a reader may not write onto a request as their own draft — the two answers. */
export const OWN_DRAFT_REFUSAL = Object.freeze({
    /** No request of the reader's by that id: absent, never theirs, or not a request. */
    gone: "gone",
    /** The reader's own request, and it has left Draft. */
    submitted: "submitted",
});

/**
 * May this reader save, submit or delete this request as their own draft?
 * Null when they may; otherwise one of `OWN_DRAFT_REFUSAL`.
 *
 * IDENTITY IS ASKED BEFORE STATUS, which is the whole of what keeps the second
 * answer from saying anything about someone else's request. Another person's request,
 * in any status, answers exactly as an id that resolves to nothing does — the ordinary
 * not-found posture CLAUDE.md sets for a record outside a reader's scope, and a PR ID
 * is a daily sequence anyone can guess. `submitted` is only ever said to the requester,
 * who can already open their own request in every status (`canViewPR`).
 *
 * WHY IT IS ONE JUDGMENT FOR THREE WRITES. Saving and submitting re-target the draft a
 * form is holding, and deleting removes it; all three are "is this the reader's own
 * Draft", so all three answer in the same words. `deleteDraftAction` asked status first
 * and told a stranger `You can only delete your own drafts.` until this issue.
 */
export function ownDraftRefusal(user, pr) {
    if (!isRequester(user, pr)) return OWN_DRAFT_REFUSAL.gone;
    if (pr.status !== "Draft") return OWN_DRAFT_REFUSAL.submitted;
    return null;
}

export const OWN_DRAFT_COPY = {
    /**
     * `deleteDraftAction`'s words for a draft it could not find, kept, and now the
     * answer for every id that is not the reader's own request. The request form does
     * not show it for a save: it lets go of the draft and says so in `detached`.
     */
    gone: "That draft no longer exists.",
    /**
     * The reader's own draft, submitted in the meantime — from a second tab, or from
     * this one before the browser went back. Nothing here offers to save it as a new
     * draft, because the result would be a second request for what is already in
     * review; the one move that works is to open the one that exists.
     */
    submitted: "This draft has already been submitted. Open it from the PR list.",
    /**
     * The form, once the draft it was holding is gone — deleted from this tab's own
     * list or from somewhere else. It keeps what was typed and saves it as a new
     * request. This sentence was written straight into the form until #440 gave it a
     * second case to cover.
     */
    detached: "The saved draft was deleted. Your changes are still here and will be saved as a new PR.",
    /**
     * The same, when the draft's own quotation files went with it. A file the form
     * hydrated from the draft is Airtable's copy on a record that no longer exists, so
     * a new request cannot carry it (#438) and the entry is emptied instead; its
     * `Vendor Quotation Code` stays.
     */
    detachedWithoutFiles:
        "The saved draft was deleted, and its quotation files with it — attach them again. Everything else is still here and will be saved as a new PR.",
};

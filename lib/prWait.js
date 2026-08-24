// How far a record waiting for a purchase request has got (#272).
//
// TWO STRIPS ASK THIS, WHICH IS WHY IT IS NOT INSIDE EITHER. An over-delivery
// waits for an overage request; a direct purchase waits for one too. Both sit
// above `/prs`, both are ordered longest wait first, and both had to answer the
// same question about a request that exists but has not been submitted.
//
// THE DEFECT THIS EXISTS TO CLOSE, and it was live in #167 before this issue.
// `awaitsOverageRequest` dropped a row from the strip the moment ANY request
// covered it, Draft included. So the first person to press the button took the
// excess off everyone else's screen, and if they then closed the tab, the row was
// invisible: a Draft is visible to its requester alone (`canViewPR`'s first
// clause), the strip had let it go, and nothing else on any screen said the
// excess was still unsettled. The direct purchase would have inherited exactly
// that, since the claim also links the row to a Draft.
//
// SO LISTING AND OFFERING ARE TWO QUESTIONS. They were one because a Draft was
// assumed to mean somebody was working on it; the assumption is what cost the
// row. A record is LISTED until the request it produced has been submitted, and
// the button is OFFERED only while no request covers it at all. Between them is
// the state this module names: someone has a draft, nobody has been asked to
// approve it, and the row says so with their name on it.
//
// A WITHDRAWN REQUEST IS NO REQUEST, which is #167's own rule for the overage
// side (`overagePRState`) carried here unchanged: withdrawal reopens the record
// for a fresh attempt, and that is the whole reason neither side stores a boolean.
//
// Pure and import-free: both strips are rendered from server components but the
// copy is read in the browser, and the offline tier pins the rule.

/** How far the request raised from a waiting record has got. */
export const WAIT_STAGE = {
    /** Nothing covers it — or what did was withdrawn. Offer the control. */
    none: "none",
    /** Somebody has a draft and has not submitted it. List it, offer nothing. */
    draft: "draft",
    /** It is in review or beyond, so `/prs` carries it. Let the row go. */
    raised: "raised",
};

/**
 * The stage of the request a waiting record produced, from that request alone.
 *
 * AN UNKNOWN STATUS READS AS `raised`, and the safe direction here is the
 * opposite of `overagePRState`'s: that function decides whether to OFFER, so its
 * unknown means "do not offer twice"; this one decides whether to LIST, and a
 * status this app does not know is still a request somebody can find on `/prs`.
 * Neither answer loses the fact, because the claim re-reads the link rather than
 * the stage before it writes.
 */
export function waitStage(pr) {
    if (!pr) return WAIT_STAGE.none;
    if (pr.status === "Withdrawn") return WAIT_STAGE.none;
    if (pr.status === "Draft") return WAIT_STAGE.draft;
    return WAIT_STAGE.raised;
}

/** Is this record still on its strip? */
export function stillWaiting(pr) {
    return waitStage(pr) !== WAIT_STAGE.raised;
}

/** May the control that raises the request be offered for it? */
export function requestOfferable(pr) {
    return waitStage(pr) === WAIT_STAGE.none;
}

export const WAIT_COPY = {
    /**
     * The chip a listed-but-unoffered row carries, on both strips.
     *
     * IT NAMES THE PERSON, because what a reader does about it is go and ask
     * them — the row is not blocked on anything the app can report, it is blocked
     * on somebody finishing. That is also why it is a chip rather than a sentence:
     * the strip's density rule (`OVERAGE_COPY.strip`) puts refusals in one line,
     * and this one fits in three words.
     *
     * THE NAME IS `Users."User Name"`, which is what every other screen prints for
     * a person — the PR list's Requester column, the history timeline, the signer
     * chain. It is the email's local part today (`chkim`), because a Users row is
     * created by a first sign-in and nothing else sets it; a real display name is
     * one edit per row in Airtable and improves every screen at once. Inventing a
     * second way to name people here would be the thing to avoid.
     */
    draftChip: (name) => (name ? `draft with ${name}` : "draft, not submitted"),
};

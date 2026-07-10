// Pure signing-chain logic shared by app/prs/[prId]'s Server Actions. No
// Airtable calls here — callers fetch PR/PR Signers/Correction Requests
// first, pass the plain data in, and act on the plain data returned.
//
// Current Signer Step semantics: 1..N is a PR Signer's Sequence Order.
// 0 is a sentinel meaning "the Requester's turn" — set only when a signer
// returns a PR for correction and targets the Requester (who isn't
// necessarily one of the PR Signers). Nothing else ever sets it to 0, so
// whenever it's 0 there is always exactly one Pending Correction Request
// with Sent To = the Requester (see computeAdvance below, which relies on
// that invariant).

export const REQUESTER_STEP = 0;

/**
 * Resolves whose turn it currently is.
 * Returns { type: "requester", userId } | { type: "signer", userId,
 * prSignerRecordId, sequenceOrder } | null (step points at a signer that
 * no longer exists — shouldn't happen, but callers should treat null as
 * "nobody can act right now" rather than crash).
 */
export function getCurrentTurn(pr, signers) {
    if (pr.currentSignerStep === REQUESTER_STEP) {
        const requesterId = pr.requester?.[0];
        return requesterId ? { type: "requester", userId: requesterId } : null;
    }

    const signer = signers.find((s) => s.sequenceOrder === pr.currentSignerStep);
    if (!signer) return null;

    return {
        type: "signer",
        userId: signer.signer?.[0] ?? null,
        prSignerRecordId: signer.id,
        sequenceOrder: signer.sequenceOrder,
    };
}

/**
 * The candidate list for "Return for correction"'s target picker: the
 * Requester (always first/default — per product decision, returning to the
 * Requester is by far the most common case) plus every signer at or before
 * the current signer's own position (Sequence Order <= current — "any
 * earlier signer, including themselves").
 */
export function getReturnTargets(pr, signers, currentSequenceOrder) {
    const targets = [{ type: "requester", value: "requester", userId: pr.requester?.[0] ?? null }];

    signers
        .filter((s) => s.sequenceOrder <= currentSequenceOrder)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .forEach((s) => {
            targets.push({
                type: "signer",
                value: s.id,
                userId: s.signer?.[0] ?? null,
                sequenceOrder: s.sequenceOrder,
            });
        });

    return targets;
}

/**
 * Finds the Pending Correction Request (if any) that the given actor is
 * currently expected to resolve. There can be more than one Pending
 * Correction Request on a PR at once (a return can itself be returned
 * further before the first one resolves — a stack, not just one slot), so
 * this matches by Sent To rather than assuming "the most recent Pending
 * one" — Current Signer Step always points at whoever's Correction Request
 * is the one to resolve right now, so matching by Sent To is exact.
 */
export function findPendingCorrectionForActor(correctionRequests, actorUserId) {
    const pending = correctionRequests.filter(
        (c) => c.status === "Pending" && (c.sentTo || []).includes(actorUserId)
    );
    if (pending.length === 0) return null;

    // Tie-break on the (rare/shouldn't-happen) chance of more than one
    // simultaneous match: the most recently requested one is the one whose
    // turn it actually is right now.
    return pending.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];
}

/**
 * Shared "what happens after Approve or Edit-and-continue completes"
 * logic. Both actions finish a turn the same way:
 *   - If the actor was resuming from a return-for-correction (there's a
 *     Pending Correction Request addressed to them), resolve it and jump
 *     back to whoever initiated that return — "resumes from where it
 *     paused," not the next sequential signer.
 *   - Otherwise, advance to the next Sequence Order, or mark the PR fully
 *     Approved if this was the last signer.
 *
 * Requester turns (Current Signer Step: 0) always fall into the first
 * branch — see the REQUESTER_STEP comment above for why that's guaranteed.
 */
export function computeAdvance({ turn, signers, correctionRequests }) {
    const pendingCorrection = findPendingCorrectionForActor(correctionRequests, turn.userId);

    if (pendingCorrection) {
        const initiatorId = pendingCorrection.initiatedBy?.[0];
        const initiatorSigner = signers.find((s) => (s.signer || [])[0] === initiatorId);

        if (!initiatorSigner) {
            throw new Error("Could not resolve who to resume the signing chain to.");
        }

        return {
            resolveCorrectionId: pendingCorrection.id,
            nextStep: initiatorSigner.sequenceOrder,
            prApproved: false,
        };
    }

    if (turn.type === "requester") {
        // Invariant violated — see REQUESTER_STEP comment.
        throw new Error("Requester's turn with no pending correction to resolve.");
    }

    const next = signers
        .filter((s) => s.sequenceOrder > turn.sequenceOrder)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];

    if (next) {
        return { resolveCorrectionId: null, nextStep: next.sequenceOrder, prApproved: false };
    }

    return { resolveCorrectionId: null, nextStep: null, prApproved: true };
}

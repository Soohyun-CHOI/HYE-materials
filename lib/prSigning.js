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
/**
 * Per-step display state for the PR detail page's linear progress bar
 * (issue #81) — Requester + each Signer, in Sequence Order. Does NOT
 * include the PO Signed step: that's driven by po/pr.status, which this
 * module (pr/signers/correctionRequests only) doesn't have — see
 * SignerProgressBar.js for how that final step is derived.
 *
 * "reached" (a step's category !== "not-reached") drives both a step's
 * own border style AND the arrow feeding into it: once a step has ever
 * held the turn, the segment leading to it is solid from then on,
 * regardless of whether the ball later moved backward past it (e.g. a
 * later signer returning to an earlier one doesn't undo the segments in
 * between — they were already delivered).
 *
 * Categories:
 *   - "current": this step holds pr.currentSignerStep right now.
 *   - "done": Approved or Edited — treated the same (both mean "this
 *     step's turn is finished, chain moved on"); per CLAUDE.md, editing
 *     after signing does NOT invalidate approval, so this never changes
 *     because of a correction happening elsewhere in the chain.
 *   - "paused": Returned — this step acted before, but the ball moved
 *     further back due to a correction and hasn't returned to them yet.
 *   - "not-reached": never been current, never acted (still Pending).
 *
 * The Requester step never has a "paused" category: Return for
 * correction requires turn.type === "signer" (see
 * returnForCorrectionAction), so the Requester can never push the ball
 * earlier than themselves — their only states are "current" (it's their
 * turn) or "done" (anything else, including having already resolved an
 * earlier return to them).
 */
export function getSignerChainProgress(pr, signers, correctionRequests) {
    const orderedSigners = [...signers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    const requesterStep = {
        type: "requester",
        sequenceOrder: REQUESTER_STEP,
        userId: pr.requester?.[0] ?? null,
        category:
            pr.status === "In Review" && pr.currentSignerStep === REQUESTER_STEP ? "current" : "done",
    };

    const signerSteps = orderedSigners.map((s) => {
        let category;
        if (pr.status === "In Review" && s.sequenceOrder === pr.currentSignerStep) {
            category = "current";
        } else if (s.status === "Approved" || s.status === "Edited") {
            category = "done";
        } else if (s.status === "Returned") {
            category = "paused";
        } else {
            category = "not-reached";
        }
        return {
            type: "signer",
            sequenceOrder: s.sequenceOrder,
            userId: s.signer?.[0] ?? null,
            prSignerRecordId: s.id,
            confirmationType: s.confirmationType,
            category,
        };
    });

    const steps = [requesterStep, ...signerSteps];

    // Correction arcs are a mid-review affordance — they only make sense
    // while the chain is live. Once the PR leaves "In Review" (Approved / PO
    // Signed, or Withdrawn per issue #122), any still-Pending Correction
    // Request is frozen history, not an in-progress return, so no arc is
    // drawn: a withdrawn (or completed) PR reads as ended, never mid-flight.
    // The steps themselves already fall back to non-"current" categories
    // because "current" requires Status === "In Review" (see above).
    //
    // Only Pending Correction Requests get an arc — Resolved ones are
    // history, which the History timeline already covers (issue #81's
    // "the bar shows current state only" design). initiatedBy is always
    // a signer (returnForCorrectionAction requires turn.type ===
    // "signer"), but sentTo can be the Requester or any earlier signer,
    // including the initiator themselves (getReturnTargets allows
    // returning to "any earlier signer, including themselves").
    //
    // Known ambiguity: Correction Requests.Sent To stores only a user
    // id, not which *role* (Requester vs a specific Signer slot) was
    // picked in getReturnTargets — and nothing stops a Requester from
    // also being one of their own PR's signers (the signer picker in
    // app/prs/new/page.js doesn't exclude them). If that same person is
    // targeted, we can't tell from stored data alone whether "Requester"
    // or "Signer N" was chosen. We default to the signer interpretation
    // (checked first) since it's the more specific/informative one and
    // avoids drawing a misleading arc all the way back to the Requester
    // box for what was actually a same-person, adjacent-step return.
    // This only affects the arc's visual endpoint for this rare overlap
    // case — computeAdvance's own state machine never hits this
    // ambiguity, since it always resolves the *current* turn's pending
    // correction using pr.currentSignerStep's already-known role, not by
    // re-deriving it from Sent To.
    const arcs = (pr.status === "In Review" ? correctionRequests : [])
        .filter((c) => c.status === "Pending")
        .map((c) => {
            const initiatorSigner = orderedSigners.find((s) => (s.signer || [])[0] === c.initiatedBy?.[0]);
            if (!initiatorSigner) return null;

            const targetSigner = orderedSigners.find((s) => (s.signer || [])[0] === c.sentTo?.[0]);
            const isRequesterTarget = !targetSigner && c.sentTo?.[0] === pr.requester?.[0];
            const to = targetSigner ? targetSigner.sequenceOrder : isRequesterTarget ? REQUESTER_STEP : undefined;
            if (to === undefined) return null;

            return { correctionRequestId: c.id, from: initiatorSigner.sequenceOrder, to };
        })
        .filter(Boolean);

    return { steps, arcs };
}

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

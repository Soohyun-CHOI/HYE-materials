"use client";

import { useState } from "react";
import ApproveForm from "./ApproveForm";
import EditAndContinueForm from "./EditAndContinueForm";
import ReturnForCorrectionForm from "./ReturnForCorrectionForm";

// Progressive disclosure: one screen, three entry points that each reveal
// their own sub-form in place rather than separate pages — Approve/Return
// aren't offered on the Requester's turn (Current Signer Step: 0), since
// there's nobody earlier to return to and "approving" isn't meaningful for
// the person who authored the PR; see lib/prSigning.js's REQUESTER_STEP.
export default function SigningPanel({ prId, turn, items, returnTargets, usersById, confirmationType }) {
    const [mode, setMode] = useState(null);
    // Issue #66 — label only, not a workflow branch: the underlying action
    // is always approveAction either way.
    const isAgreement = confirmationType === "Agreement";

    if (mode === "approve") {
        return <ApproveForm prId={prId} isAgreement={isAgreement} onCancel={() => setMode(null)} />;
    }
    if (mode === "edit") {
        return <EditAndContinueForm prId={prId} items={items} onCancel={() => setMode(null)} />;
    }
    if (mode === "return") {
        return (
            <ReturnForCorrectionForm
                prId={prId}
                targets={returnTargets}
                usersById={usersById}
                onCancel={() => setMode(null)}
            />
        );
    }

    return (
        <div className="flex flex-wrap gap-3">
            {turn.type === "signer" && (
                <button
                    type="button"
                    onClick={() => setMode("approve")}
                    className="rounded bg-foreground px-4 py-2 text-background"
                >
                    {isAgreement ? "Agree" : "Approve"}
                </button>
            )}
            <button
                type="button"
                onClick={() => setMode("edit")}
                className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            >
                Edit and continue
            </button>
            {turn.type === "signer" && (
                <button
                    type="button"
                    onClick={() => setMode("return")}
                    className="rounded border border-red-300 px-4 py-2 text-red-700 dark:border-red-800"
                >
                    Return for correction
                </button>
            )}
        </div>
    );
}

import { headers } from "next/headers";
import { getUserByRecordId } from "./airtable/users";
import { sendSignerTurnEmail } from "./email";

async function getBaseUrl() {
    const h = await headers();
    const host = h.get("host");
    const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
    return `${protocol}://${host}`;
}

/**
 * Best-effort "it's your turn" notification for whoever the signing chain
 * now points at (see lib/prSigning.js:getCurrentTurn). Never throws — a
 * failed send must not block or roll back the PR action that triggered it
 * (create/approve/edit-and-continue/return-for-correction), since the
 * Airtable state change this is notifying about is already durably
 * committed by the time this runs. Errors are logged, not surfaced.
 *
 * Scope: only the "next signer" case (per product decision) — no
 * notification when a PR reaches its final Approved state.
 */
export async function notifyCurrentTurn({ pr, turn, context }) {
    if (!turn) return;

    try {
        const user = await getUserByRecordId(turn.userId);
        if (!user?.email) return;

        const baseUrl = await getBaseUrl();
        await sendSignerTurnEmail({
            to: user.email,
            prId: pr.prId,
            prUrl: `${baseUrl}/prs/${pr.prId}`,
            context,
        });
    } catch (err) {
        console.error("notifyCurrentTurn failed (non-fatal)", err);
    }
}

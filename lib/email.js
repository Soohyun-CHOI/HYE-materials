import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY in environment variables");
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends the magic-link signup/login email. verifyUrl points at
 * /api/auth/verify?token=... — clicking it completes sign-in on whichever
 * browser/device opens it, not necessarily the one that requested it.
 */
export async function sendMagicLinkEmail({ to, verifyUrl }) {
    // The Resend SDK returns { data, error } instead of throwing on API
    // errors (invalid key, unverified sending domain, etc.) — it does NOT
    // reject the promise, so this has to be checked explicitly or a failed
    // send silently looks like a success to the caller.
    const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Material PO Automation <onboarding@resend.dev>",
        to,
        subject: "Sign in to Material PO Automation",
        html: `
            <p>Click the link below to sign in. This link expires in 15 minutes and can only be used once.</p>
            <p><a href="${verifyUrl}">Sign in to Material PO Automation</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `,
    });

    if (error) {
        throw new Error(`Failed to send sign-in email: ${error.message || error}`);
    }
}

/**
 * Sends the "it's your turn" email to whoever the PR signing chain now
 * points at. Throws on a real send failure, same as sendMagicLinkEmail —
 * it's the caller's job (lib/notifications.js:notifyCurrentTurn) to decide
 * that a failed notification shouldn't block the PR action that triggered
 * it, not this function's.
 */
export async function sendSignerTurnEmail({ to, prId, prUrl, context }) {
    const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Material PO Automation <onboarding@resend.dev>",
        to,
        subject: `Action needed: PR ${prId}`,
        html: `
            <p>It's your turn to review <strong>${prId}</strong>.</p>
            ${context ? `<p>${context}</p>` : ""}
            <p><a href="${prUrl}">Open ${prId}</a></p>
        `,
    });

    if (error) {
        throw new Error(`Failed to send signer-turn email: ${error.message || error}`);
    }
}

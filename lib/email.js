import { Resend } from "resend";
import { PRODUCT_NAME, SIGN_IN_TITLE } from "./productName";
import { TOKEN_TTL_MINUTES } from "./authTokenState";

if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY in environment variables");
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * The From header for every send here — one constant rather than the same
 * expression inlined at each of the four call sites, which is how the product
 * name came to be written out four times in this file (#201).
 *
 * `EMAIL_FROM` stays OPTIONAL. Only `RESEND_API_KEY` is fail-fast at module
 * load above; making a second variable required would be a change to this
 * module's failure mode rather than a rename, so it is left as its own
 * decision. The fallback keeps `onboarding@resend.dev` — Resend's sandbox
 * address, which always accepts a send — because falling back to a real company
 * domain would fail wherever that domain is not verified for the deployment.
 * Only the display name is the product's.
 *
 * Read once at module load rather than per send, which is the one behavioral
 * difference from the four inline copies. It matches how `RESEND_API_KEY` is
 * read six lines up, and nothing mutates `process.env` in this app.
 */
const FROM_ADDRESS = process.env.EMAIL_FROM || `${PRODUCT_NAME} <onboarding@resend.dev>`;

/**
 * Sends the magic-link signup/login email. `confirmUrl` points at
 * /login/confirm?token=... — opening it shows a confirmation page and consumes
 * nothing; pressing the button there completes sign-in, on whichever
 * browser/device opened it rather than the one that requested it.
 *
 * THE COPY CARRIES THE EXTRA STEP because the recipient's instruction changed
 * (#203): the link alone no longer signs anyone in. The last paragraph states
 * that directly, which is both the honest description of the new behavior and
 * the reassurance someone needs who did not request the email.
 */
export async function sendMagicLinkEmail({ to, confirmUrl }) {
    // The Resend SDK returns { data, error } instead of throwing on API
    // errors (invalid key, unverified sending domain, etc.) — it does NOT
    // reject the promise, so this has to be checked explicitly or a failed
    // send silently looks like a success to the caller.
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: SIGN_IN_TITLE,
        html: `
            <p>Open the link below, then press Confirm sign-in on the page that opens.</p>
            <p><a href="${confirmUrl}">${SIGN_IN_TITLE}</a></p>
            <p>The link expires in ${TOKEN_TTL_MINUTES} minutes and can only be used once. Opening it does not sign you in on its own, so if you didn't request this you can ignore this email.</p>
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
        from: FROM_ADDRESS,
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

/**
 * Sends the "PO awaiting signature" email to the President once a PO is
 * generated from a fully-approved PR. Same throw-on-real-failure contract
 * as sendSignerTurnEmail — lib/notifications.js:notifyPOAwaitingSignature
 * decides that a failed send shouldn't block PO generation, not this
 * function's job.
 */
export async function sendPOAwaitingSignatureEmail({ to, prId, poId, poUrl, vendorName, totalAmount }) {
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: `Action needed: PO ${poId} awaiting your signature`,
        html: `
            <p><strong>${poId}</strong> (from ${prId}) is ready for your signature.</p>
            <p>Vendor: ${vendorName}<br>Total Amount: ${totalAmount}</p>
            <p><a href="${poUrl}">Open ${poId}</a></p>
        `,
    });

    if (error) {
        throw new Error(`Failed to send PO-awaiting-signature email: ${error.message || error}`);
    }
}

/**
 * Sends the "PO signed" email to the PR's Requester once the President
 * signs the generated PO. Same throw-on-real-failure contract as the other
 * send functions here — lib/notifications.js:notifyPOSigned handles the
 * non-fatal decision.
 */
export async function sendPOSignedEmail({ to, prId, poId, prUrl, vendorName, totalAmount }) {
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: `PO ${poId} signed — ${prId} is confirmed`,
        html: `
            <p><strong>${prId}</strong>'s PO (<strong>${poId}</strong>) has been signed.</p>
            <p>Vendor: ${vendorName}<br>Total Amount: ${totalAmount}</p>
            <p><a href="${prUrl}">Open ${prId}</a></p>
        `,
    });

    if (error) {
        throw new Error(`Failed to send PO-signed email: ${error.message || error}`);
    }
}

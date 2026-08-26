import { Resend } from "resend";
import { PRODUCT_NAME, SIGN_IN_TITLE } from "./productName";
import { TOKEN_TTL_MINUTES } from "./authTokenState";

if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY in environment variables");
}

/**
 * THE DOMAIN IS VERIFIED, SO MAIL DELIVERS TO ANY ADDRESS — and it was sandbox-only
 * for most of this project's life.
 *
 * The history is here rather than in CLAUDE.md because of what it is FOR: several
 * decisions elsewhere were made under the old constraint and read oddly without it —
 * `verify-authz.mjs` skipping the email step, the fixture accounts having no mailbox,
 * `FROM_ADDRESS` below still falling back to Resend's sandbox address. A reader who
 * meets one of those and wonders why comes to this module; a reader who only needs to
 * know that mail arrives is told that where the rest of the auth rules are. Moved in
 * the routing pass after #263.
 */
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
 *
 * THE WORDS ARE THE CALLER'S SINCE #292, from
 * `lib/poUnsigned.js:AWAITING_SIGNATURE_COPY`, and the wording did not change with the
 * move. What changed is the FIGURE: this body interpolated `totalAmount` exactly as it
 * arrived, and it arrived raw, so the President read `260` where every screen reads
 * `$260.00`. A body assembled in this module cannot be called by a check — the module
 * throws at load without `RESEND_API_KEY` — so the third mail that carries money
 * followed the two before it out. The two that carry none stay here.
 */
export async function sendPOAwaitingSignatureEmail({ to, subject, html }) {
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
    });

    if (error) {
        throw new Error(`Failed to send PO-awaiting-signature email: ${error.message || error}`);
    }
}

/**
 * Sends the signed PO to the vendor, with the order document attached (#281).
 *
 * THE FIRST SEND HERE THAT LEAVES THE COMPANY, and the three ways it differs from
 * the four above all follow from that.
 *
 * `replyTo` IS THE POINT, NOT A COURTESY. `From` has to stay `FROM_ADDRESS` because
 * Resend only sends from a verified domain, so the person who pressed the button
 * cannot appear as the sender; without `Reply-To` a vendor's reply would land on the
 * `From` mailbox, which nobody reads.
 *
 * THE WORDS ARE THE CALLER'S. `subject` and `html` arrive built, from
 * `lib/poSend.js:SEND_COPY.mail`, so that `offline/line-vocabulary.mjs` can read
 * them — it walks `*_COPY` constants and cannot see HTML written into this file,
 * which is where the other four keep theirs. A vendor would not recognize a wrong
 * word the way a colleague would, so this is the one that has to be checkable.
 *
 * NO NON-FATAL WRAPPER, AND THAT IS WHY IT IS NOT IN `lib/notifications.js`. Every
 * function there swallows a failure because "the Airtable state change this is
 * notifying about is already durably committed by the time this runs" — its own
 * words. Here nothing is committed yet: the send IS the action, so it throws like
 * its four siblings and `sendPOToVendorAction` surfaces the failure to whoever
 * pressed the button.
 */
export async function sendPOToVendorEmail({ to, replyTo, subject, html, attachment }) {
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        replyTo,
        subject,
        html,
        attachments: [{ filename: attachment.filename, content: attachment.content }],
    });

    if (error) {
        throw new Error(`Failed to send PO-to-vendor email: ${error.message || error}`);
    }
}

/**
 * Sends the "your order is signed, place it" email to the PR's Requester once the
 * President signs the generated PO. Same throw-on-real-failure contract as the other
 * send functions here — lib/notifications.js:notifyPOSigned handles the non-fatal
 * decision.
 *
 * THE WORDS ARE THE CALLER'S SINCE #290, which is `sendPOToVendorEmail`'s shape and
 * not a new one. This mail stopped being a notice and became an instruction — sending
 * the order is placing it, and #281 made that the requester's own act — so it had to
 * carry the ORDER's url where it carried the request's. Assembling it here would put
 * the body somewhere no check can call: this module throws at load without
 * `RESEND_API_KEY`, so the offline tier cannot import it, and a caller that forgot to
 * pass the url would produce a mail whose link reads `undefined` while every check
 * stayed green. `lib/poSend.js:SIGNED_NOTICE_COPY` is a pure builder for exactly that
 * reason.
 */
export async function sendPOSignedEmail({ to, subject, html }) {
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
    });

    if (error) {
        throw new Error(`Failed to send PO-signed email: ${error.message || error}`);
    }
}

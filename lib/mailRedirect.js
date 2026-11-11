// Where a mail goes outside production (#633): every one but a sign-in to the one address the
// run names in `EMAIL_REDIRECT_TO`, its subject naming whom it was meant for, or nowhere.
//
// WHY. Local development and every preview deployment reach the test base, and the test base is
// a copy of the live one with `Users` and `Vendors` in it (#534), so the addresses a flow mails
// there are real people's. A request walked on a preview would mail its signers their turn, the
// President the order to sign and the requester the signed notice, and `sendPOToVendorEmail`
// would mail the vendor the order — which is placing it (#281). Outside production none of them
// reaches the person the row names.
//
// WHAT GOES WHERE:
//   - The production deployment (`lib/deployment.js`): the message as the sender built it, the
//     same object, so production sends exactly what it sent before #633.
//   - A sign-in mail, in every run: as built. It goes to the address its own reader typed, on
//     the company domain, which is nobody else's — and a redirected one would sign nobody in.
//   - Anything else, with `EMAIL_REDIRECT_TO` set: to that address alone, `cc` and `bcc`
//     dropped, the subject prefixed with every address it was meant for. The body, the
//     attachments and `replyTo` are the sender's own, so what arrives is what production would
//     have sent with only the envelope changed.
//   - Anything else, with it unset or blank: nothing is sent, and `lib/email.js` logs that it
//     was not, naming the subject and not the people.
//
// WHY THE SUBJECT AND NOT THE BODY. The address has to be seen in the mail, and the subject is
// what an inbox list shows; a line put on top of the body would be markup built here around a
// value from the base, which this module would then have to escape, a second time beside
// `lib/authTokenState.js`'s escape — and the text part would need its own line. The subject is
// plain text in every client, so the body stays the builder's, byte for byte.
//
// AMBIGUITY READS AS NOT PRODUCTION (`lib/deployment.js`), and a redirect that cannot be read
// sends nothing, so a mistake here lands in a log or in one mailbox the run named, never in a
// real person's.
//
// PURE, and its one import spells its extension out, so `offline/mail-redirect.mjs` calls it
// under plain `node`; `lib/email.js` throws at load without `RESEND_API_KEY` and cannot be
// called there. That check holds every send in `lib/email.js` to asking this first.

import { isProductionDeployment } from "./deployment.js";

/** The variable naming the one address a mail goes to outside production, and read nowhere else. */
const REDIRECT_VARIABLE = "EMAIL_REDIRECT_TO";

/** Every word a redirected or withheld mail says. */
export const MAIL_REDIRECT_COPY = {
    subject: ({ meantFor, subject }) => `[Meant for ${meantFor}] ${subject}`,
    notSent: ({ subject }) =>
        `Mail not sent: this run is not the production deployment and ${REDIRECT_VARIABLE} is unset — "${subject}"`,
};

/** The address `env` names, trimmed, or null when it names none. */
function redirectAddress(env) {
    const value = env?.[REDIRECT_VARIABLE];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

/** Every address a message is meant for — `to`, `cc` and `bcc`, each a string or a list. */
function recipientsOf(message) {
    return [message.to, message.cc, message.bcc].flat().filter((address) => typeof address === "string" && address !== "");
}

/**
 * The message to hand Resend, or null when none may be sent. `message` is Resend's own shape;
 * `signIn` marks the sign-in mail, the one that goes as built in every run.
 */
export function routeMail(message, { signIn = false } = {}, env = process.env) {
    if (signIn || isProductionDeployment(env)) return message;
    const to = redirectAddress(env);
    if (to === null) return null;
    const routed = {
        ...message,
        to,
        subject: MAIL_REDIRECT_COPY.subject({ meantFor: recipientsOf(message).join(", "), subject: message.subject }),
    };
    // Taken out, so a redirected mail copies nobody.
    delete routed.cc;
    delete routed.bcc;
    return routed;
}

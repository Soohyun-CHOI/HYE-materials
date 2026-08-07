/**
 * The product's own name, in one place (#201).
 *
 * The app used to refer to itself by two different names, neither of which was
 * what the company calls it, and one of them was written out four times in
 * `lib/email.js` alone. Nothing owned the string, which is why they could
 * diverge; this module is that owner, so the next surface needing the name
 * imports it instead of typing it. (The superseded names are recorded in
 * CLAUDE.md rather than here, because `offline/product-name.mjs` fails on either
 * of them appearing anywhere under `app/` or `lib/` — including in a comment.
 * Keeping the guard free of an exemption list is worth more than keeping the
 * history in this file, and CLAUDE.md is where this repo puts history anyway.)
 *
 * NOT THE COMPANY'S LEGAL NAME, and the two must never move together.
 * `lib/poPdf.js:HYE_BUYER_NAME` is "HANYANGENG USA INC." — the entity a vendor
 * sees on the purchase order that leaves the company, which is a question about
 * the company's letterhead rather than about this app's title. The same applies
 * to the `Bill To:` lines in the two invoice-PDF scripts. A rename here is a
 * product decision; a rename there is a legal one, and they have different
 * owners.
 *
 * ITS OWN MODULE RATHER THAN A CONSTANT IN `lib/email.js`, for a measured
 * reason and not tidiness: `app/login/page.js` is a Client Component, and
 * `lib/email.js` throws `Missing RESEND_API_KEY` at module load — so importing
 * the name from there would put an unconditional browser crash behind a string,
 * which is exactly the trap #162 recorded (an import is an execution). This
 * module imports nothing, so every surface can reach it and the offline tier can
 * pin it.
 */
export const PRODUCT_NAME = "HYE USA Portal";

/**
 * One sentence, two surfaces: the magic-link email's subject and the `<h1>` on
 * `/login`. The identity is the point rather than a coincidence — the login page
 * is where that email lands, so arriving on a screen headed by the same line is
 * what tells a signer the link took them where it said it would. Two literals
 * could drift; one constant cannot.
 */
export const SIGN_IN_TITLE = `Sign in to ${PRODUCT_NAME}`;

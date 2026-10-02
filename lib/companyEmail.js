/**
 * The company's address as the sign-in's email field takes it (#473): what the field
 * keeps of what was typed, pasted or filled in, the address that leaves it, whether an
 * address a request names is one, and the one sentence the field says when it is not.
 *
 * THE FIELD TAKES ONLY THE PART BEFORE THE DOMAIN, WHICH IT SHOWS FIXED BESIDE IT. So a
 * company address arriving whole — pasted, or filled in by the browser — loses its `@` and
 * its domain, and one at any other domain stays whole for the field to refuse. Nothing is
 * sent for a refused field: the screen asks `companyAddress` before it asks for an email.
 *
 * THE DOMAIN IS THE CALLER'S, AND IT IS `ALLOWED_EMAIL_DOMAIN`. `lib/auth.js` reads that
 * variable, once and failing at load without it, and asks `isCompanyAddress` of every
 * address a request names; `app/login/page.js` takes the same value from it and hands it
 * to the form, which asks the other three. So no file spells the domain — the field's
 * suffix and its sentence included — and the browser and the server cannot disagree about
 * what a company address is: `offline/company-email.mjs` holds both call sites and fails a
 * domain written anywhere under `app/` or `lib/`.
 *
 * THE SERVER'S QUESTION GREW A CLAUSE HERE. It was one `endsWith` against the domain, so
 * an address that was only the `@` and the domain, or one with a space in it, went on to
 * make an `Auth Tokens` row and fail at the mail; it asks the part before the domain the
 * field's question too now. The screen never sends such a value, so only a direct request
 * meets the difference.
 *
 * PURE AND IMPORT-FREE, because a Client Component reads it — `app/login/LoginForm.js` —
 * and the offline tier calls it.
 */

/**
 * What may stand before the `@`: letters, figures, and `.`, `_`, `+` and `-`. The `+` is a
 * subaddress, such as the `soo+code471@` the code step was walked with (#471).
 */
const LOCAL_PART = /^[A-Za-z0-9._+-]+$/;

const suffixOf = (domain) => `@${String(domain ?? "").toLowerCase()}`;

/**
 * What the field keeps of a value: a company address, its case and the spaces around it
 * aside, loses its `@` and its domain, and anything else stays exactly as it came — so
 * typing goes on character by character, and an address at another domain stays whole.
 */
export function emailFieldValue(raw, domain) {
    const value = String(raw ?? "");
    const trimmed = value.trim();
    const suffix = suffixOf(domain);
    return trimmed.toLowerCase().endsWith(suffix) ? trimmed.slice(0, -suffix.length) : value;
}

/**
 * Does the field hold a whole address? Only one at another domain can be there, since a
 * company address loses its domain on the way in — and while one is, the fixed suffix
 * steps aside.
 */
export function namesAnotherDomain(value) {
    return String(value ?? "").includes("@");
}

/** The address the field stands for, or null when what it holds cannot come before the domain. */
export function companyAddress(value, domain) {
    const local = String(value ?? "").trim();
    return LOCAL_PART.test(local) ? `${local}${suffixOf(domain)}` : null;
}

/** Is this an address at the company's domain? The question every sign-in request is asked. */
export function isCompanyAddress(email, domain) {
    if (typeof email !== "string") return false;
    const suffix = suffixOf(domain);
    if (!email.toLowerCase().endsWith(suffix)) return false;
    return LOCAL_PART.test(email.slice(0, -suffix.length));
}

/** The field's one refusal, its domain the same value the suffix shows. */
export const COMPANY_EMAIL_COPY = {
    otherDomain: (domain) => `Use your ${suffixOf(domain)} address.`,
};

// The name this app prints for a user, and the one place that decides it (#381).
//
// TWO RENDERINGS, AND A CALL SITE PICKS BY WHAT IT IS DOING RATHER THAN BY WHAT
// IT KNOWS. `userName` is the first name and is what a screen REPORTING a person
// prints — the requester column, the signer bar, a history line, `Recorded by`,
// a tool log row. `fullUserName` is `First Last` and belongs to two kinds of
// place: where a person is CHOSEN from a list, and where somebody outside this
// company reads the result. Everything else is the first name.
//
// WHY THE SPLIT IS DRAWN THERE. Two people can share a first name — this base
// already carries two addresses that would produce one (`soo@` and
// `soohyun.c@`), and `/login/confirm`'s own note records that one person can
// hold two addresses here. Where the app merely NAMES somebody the ambiguity is
// recoverable: the reader clicks the row. Where the app asks somebody to CHOOSE,
// picking the wrong person routes a signing chain to them, which is expensive
// and awkward to undo — so the pickers carry both names and the collision cannot
// arise. No detection, no conditional label, nothing to go stale.
//
// THE RESIDUAL RISK, NAMED BECAUSE IT HAS NEVER BEEN OBSERVED. Two Active users
// with the same first name make a REPORTING surface ambiguous — `Waiting on Soo`
// with two Soos on the chain. The company has nine accounts on this base and no
// such pair exists yet. If one appears and the ambiguity bites, the change is to
// this module and to nothing else, which is the property the split buys.
//
// WHY A VENDOR READS THE FULL NAME. `lib/poPdf.js` puts a person's name in the
// buyer's PIC block, the notify party and the signature block of the purchase
// order a vendor receives, and `sendPOToVendorAction` signs the order email with
// it. A signature block reading `Soo` is not a signature, and a vendor is
// outside the set of people who know this office by first name.
//
// THE FALLBACK IS WHAT MAKES THE MIGRATION COST NOTHING. A `Users` row was
// created with `email.split("@")[0]` as its name until this issue, so every row
// on this base holds its own login handle. `clear_user_first_names_381.mjs`
// empties those so their owners are asked at their next sign-in — and because
// this module falls back to exactly that string, clearing them changes no
// rendered character anywhere. Each person's screens improve when that person
// types their name.
//   ITS END CONDITION, so it is a thing that ends rather than drift: when no
//   Active user has a blank `First Name`, the fallback has no reader and both
//   this function and `emailLocalPart` can go. Nothing in the offline tier can
//   see that — it never reads the base — so the day to check is the day somebody
//   asks why a name looks like an address.
//
// PURE AND OFFLINE-SAFE. It imports one module, spelled with its extension so
// plain `node` resolves it, which is what lets `offline/user-name.mjs` call
// these functions rather than only read them.

import { normalizeItemText } from "./itemNaming.js";
import { DESTINATION_PARAM, safeDestination } from "./loginDestination.js";

/**
 * The address a reader is sent to when their row has no first name.
 *
 * UNDER `/login` ON PURPOSE. It is the third step of one flow — request the
 * link, confirm it, say who you are — and the sign-in screens already read as
 * one flow by sharing a heading. It also buys one thing for free:
 * `lib/loginDestination.js` bars `/login` and everything under it from being a
 * destination, so a sign-in can never deliver a reader back into this step.
 */
const NAME_PATH = "/login/name";

/**
 * The name step, carrying where the reader was going.
 *
 * `requireUser()` builds this, exactly as it builds `signInPath` for a reader
 * with no session at all — the destination survives the extra step rather than
 * being dropped at the one point in the flow that was added last.
 *
 * IT CALLS THE PREDICATE ITSELF, which is #373's rule for this parameter rather
 * than a precaution: `safeDestination` is applied wherever a destination is
 * accepted and not once, so no caller of any builder can put an unjudged value
 * into a URL. This is the third builder and it obeys the same rule.
 */
export function namePath(destination) {
    const safe = safeDestination(destination);
    return safe ? `${NAME_PATH}?${DESTINATION_PARAM}=${encodeURIComponent(safe)}` : NAME_PATH;
}

/**
 * Is this address the name step itself?
 *
 * WHAT IT STOPS IS A REDIRECT LOOP, and it is a predicate rather than a
 * comparison at the call site for #373's own reason: `lib/authz.js` must not
 * spell this address, or an assertion naming it would be worth nothing — rename
 * the constant and both sides move together, green. The gate takes the
 * identifier; this module owns the string.
 *
 * The stamped address carries its search string, so the path is compared alone.
 */
export function isNameStep(path) {
    return String(path ?? "").split("?")[0] === NAME_PATH;
}

/** The longest either name may be. Long enough for any real one, short enough
 *  that a column cannot be blown open by a paste. */
export const MAX_NAME_LENGTH = 60;

/**
 * The local part of an address — the string this app printed for a person
 * before anybody was asked their name, and the fallback while nobody has been.
 *
 * IT IDENTIFIES A PERSON ONLY BECAUSE ONE DOMAIN IS ADMITTED, which is
 * `lib/auth.js`'s constraint rather than this module's: `ALLOWED_EMAIL_DOMAIN`
 * holds one value, so no two users can share a local part. The day that becomes
 * a list, `chkim@a` and `chkim@b` both read as `chkim` and this fallback stops
 * identifying anybody — see docs/notes/authorization.md.
 */
function emailLocalPart(email) {
    return String(email ?? "").split("@")[0];
}

/** Has this person not been asked their name yet? */
export function needsName(user) {
    return !normalizeItemText(user?.firstName);
}

/**
 * What a screen prints when it NAMES a person: the first name.
 *
 * Returns "" for no user at all, so a call site keeps whatever dash it already
 * renders for an absent link rather than this module inventing a second one.
 */
export function userName(user) {
    if (!user) return "";
    return normalizeItemText(user.firstName) || emailLocalPart(user.email);
}

/**
 * What a picker and a vendor-facing document print: `First Last`.
 *
 * A row holding only a first name yields only that. Both are required at the
 * name step, so that state is reachable only by a hand edit in Airtable.
 */
export function fullUserName(user) {
    if (!user) return "";
    const first = normalizeItemText(user.firstName);
    const last = normalizeItemText(user.lastName);
    if (!first) return emailLocalPart(user.email);
    return [first, last].filter(Boolean).join(" ");
}

/**
 * The modules allowed to render a full name, declared here and asserted against
 * the real import sites by `offline/user-name.mjs`.
 *
 * TWO PLACES ON PURPOSE, which is `offline/file-route.mjs`'s shape: a list that
 * only described what the code does would pass whatever the code did. The check
 * reads this and reads the imports, and requires them to agree — so moving a
 * surface out of the first name means saying so here, and a file that quietly
 * starts printing both names fails.
 */
export const FULL_NAME_SURFACES = {
    "lib/poPdf.js": "the purchase order a vendor receives — PIC, notify party, signature block",
    "app/pos/[poId]/actions.js": "the order email a vendor receives, signed by its sender",
    "app/prs/new/SignerList.js": "the signer picker — a person is CHOSEN here",
    "app/prs/[prId]/ReturnForCorrectionForm.js": "the send-back picker — a person is CHOSEN here",
};

/**
 * Everything the name step says.
 *
 * IN A CONSTANT RATHER THAN IN JSX so the words can be PINNED. This said
 * `scripts/screen-strings.mjs` cannot see a string written into an element,
 * which is false and has been since #288: that extractor reports a bare text
 * node as `[JSXText]`, so a vocabulary sweep finds one. What a JSX literal
 * cannot have is a pin — `offline/screen-briefs.mjs` holds a brief's quoted
 * words against the constant that produces them, and for a string in an element
 * it falls back to asking whether the literal appears anywhere under `app/`,
 * which proves the string is somewhere rather than that it is still this
 * screen's. That file's own header says so; corrected here on sight (#181).
 *
 * THE HEADING IS NOT HERE. This screen carries `SIGN_IN_TITLE`, the same line
 * the sign-in screen and the confirmation carry, so the three steps of one flow
 * read as one flow — `docs/briefs/login.md` records that agreement.
 */
export const USER_NAME_COPY = {
    /** Why a screen the reader did not ask for is in front of them. */
    body: "Before you go on, tell the app what to call you.",
    /** What the two answers are for. The second is why a last name is asked at all. */
    note: "Screens name you by your first name. Your full name goes on the purchase orders and order emails vendors receive.",
    firstLabel: "First name",
    lastLabel: "Last name",
    action: "Save and continue",
    saving: "Saving...",
    refusal: {
        first: "Enter your first name.",
        last: "Enter your last name.",
        tooLong: `Keep each name under ${MAX_NAME_LENGTH} characters.`,
        failed: "That could not be saved. Try again.",
    },
};

/**
 * The one judgment on a submitted pair: both present, neither too long.
 *
 * Returns `{ firstName, lastName }` normalized, or `{ error }` — the shape the
 * action returns to `useActionState`, so the screen renders one sentence and the
 * action decides nothing about wording.
 */
export function judgeName({ firstName, lastName }) {
    const first = normalizeItemText(firstName);
    const last = normalizeItemText(lastName);
    if (!first) return { error: USER_NAME_COPY.refusal.first };
    if (!last) return { error: USER_NAME_COPY.refusal.last };
    if (first.length > MAX_NAME_LENGTH || last.length > MAX_NAME_LENGTH) {
        return { error: USER_NAME_COPY.refusal.tooLong };
    }
    return { firstName: first, lastName: last };
}

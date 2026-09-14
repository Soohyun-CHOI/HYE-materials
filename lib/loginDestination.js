// Where a signed-out reader was headed, and the one predicate that judges it
// (#373).
//
// THE FLOW IS TWO STEPS AND THE DESTINATION HAS TO CROSS BOTH. `requireUser()`
// sends a reader with no session to `/login`; the sign-in link then arrives by
// email, lands on `/login/confirm`, and only the button there mints the session
// (#203, which moved consumption to a POST so a mail scanner cannot spend the
// token). So the address the reader asked for has to survive the mail round trip,
// and it does that as a URL parameter carried by the two builders below.
//
// WHAT THAT COSTS, STATED HERE BECAUSE THIS IS WHERE THE LINK IS BUILT: the
// destination is IN THE EMAIL. It sits in the recipient's mailbox for as long as
// they keep the message, it is in whatever their provider retains, and mail gets
// forwarded — so `/tool-items/HYE-TL-260909-004` is an internal address of this
// app now readable outside it. That is the whole reason the sign-in link is
// longer than it used to be. It is a real cost and it was weighed against keeping
// the destination on the `Auth Tokens` row instead; `docs/notes/authorization.md`
// carries that comparison. **The constraint it puts on this file: whatever these
// builders put into a link is in a mailbox forever, so nothing else goes in one.**
//
// PURE AND OFFLINE-SAFE, WHICH IS LOAD-BEARING RATHER THAN TIDY. It imports
// nothing at all, so `offline/login-destination.mjs` can call the predicate
// directly under plain `node`, and `proxy.js` — which runs before the app — can
// import the header name from the same place `lib/authz.js` reads it.

/** The URL parameter every hop of the sign-in flow carries the destination in. */
export const DESTINATION_PARAM = "destination";

/**
 * The request header `proxy.js` stamps the address onto, and the only way
 * `requireUser()` can know where the reader was.
 *
 * NEXT GIVES A SERVER COMPONENT NO WAY TO ASK, which is measured rather than
 * assumed: `next/dist/server/request/pathname.js` exists and is
 * `createServerPathnameForMetadata`, reachable only from metadata resolution;
 * `headers()` carries no path on a document request; `next-url` is set by the
 * client router on RSC navigations only, so a QR scan — a hard navigation — never
 * has one; and `x-matched-path` is Vercel's, absent under `next dev`. So the
 * value has to be put there, and `proxy.js` is what puts it.
 *
 * A CLIENT CAN SEND A HEADER OF THIS NAME AND IT DOES NOT MATTER. The proxy
 * SETS rather than appends, so a stamped value always replaces a supplied one;
 * and on a path the proxy does not match, a supplied value still has to pass
 * `safeDestination` below, which leaves a reader able to send their own browser
 * to another page of this same app.
 */
export const REQUEST_PATH_HEADER = "x-request-path";

/** The sign-in screen, and the confirmation the mail lands on. */
export const SIGN_IN_PATH = "/login";
export const CONFIRM_PATH = "/login/confirm";

/**
 * Where a reader goes when there is no destination, or when the one supplied is
 * refused. The two cases are deliberately one outcome — see `safeDestination`.
 */
export const DEFAULT_DESTINATION = "/";

/**
 * Parsed against this, and then required to have come back with it. Any host,
 * scheme or protocol-relative form embedded in the value resolves away from it.
 */
const SAME_ORIGIN_PROBE = "https://destination.invalid";

/**
 * Addresses that are inside this app and still not somewhere to land.
 *
 * `/login` covers the confirmation under it, so signing in cannot deliver the
 * reader back to the sign-in flow they just finished. `/api` is not a screen:
 * nothing under it can even produce a destination, because a Route Handler
 * cannot call `requireUser()` at all (`docs/notes/authorization.md`), so a value
 * naming one arrived by hand.
 */
const NOT_A_LANDING = [SIGN_IN_PATH, "/api"];

/**
 * Anything below a space, and the delete character.
 *
 * WRITTEN AS CODE POINTS RATHER THAN AS A CHARACTER CLASS, because the class is
 * spelled with the characters it matches: a unicode escape for a control
 * character, typed into a source file by anything but a person, lands as the
 * real character, and `offline/source-bytes.mjs` then reports the file as one
 * `grep` will skip. This one was caught that way on its first run.
 */
const isControlCharacter = (character) => {
    const code = character.codePointAt(0);
    return code < 0x20 || code === 0x7f;
};

/**
 * The one judgment on a destination: is this an address within this app?
 *
 * IT IS APPLIED WHEREVER A DESTINATION IS ACCEPTED, NOT ONCE. Both builders
 * below call it, so no caller can put an unjudged value into a URL; the sign-in
 * screen and the confirmation call it before rendering one, so a refused value
 * never reaches a form; and `POST /api/auth/verify` calls it again before
 * redirecting, which is the call that actually protects anything — that endpoint
 * is reachable directly, and it is the only place a destination turns into a
 * redirect.
 *
 * A REFUSED VALUE IS NULL AND NOT AN ERROR, so a destination that fails ends at
 * `DEFAULT_DESTINATION` — exactly where a reader with no destination ends.
 * Distinguishing the two would need a sentence saying which address was refused,
 * which is copy this app does not have and which would show a stranger opening a
 * shared link where somebody else was going.
 *
 * WHAT IT ACCEPTS IS ORIGIN-SAFETY AND NOT EXISTENCE. `/nothing-here` passes and
 * resolves to this app's own not-found screen; the property being defended is
 * that a destination cannot become a way OUT of this app, which is what an open
 * redirect is. Matching against the app's route templates was the alternative and
 * is refused: `lib/` holds no list of them, so it would be a second copy of the
 * route table, and a page added later would be dropped by a check nobody can see
 * firing.
 *
 * The parse also NORMALIZES — dot segments collapse, a backslash resolves the way
 * a browser resolves it, and a fragment is dropped, since a fragment never
 * reaches the server that has to act on this.
 */
export function safeDestination(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    // A path, and not a protocol-relative one. The parse below catches these too;
    // they are stated first because they are what an open redirect is attempted
    // with, and a reader of this function should meet them before the mechanics.
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
    if ([...value].some(isControlCharacter)) return null;

    let url;
    try {
        url = new URL(value, SAME_ORIGIN_PROBE);
    } catch {
        return null;
    }
    if (url.origin !== SAME_ORIGIN_PROBE) return null;

    const path = `${url.pathname}${url.search}`;
    const barred = NOT_A_LANDING.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
    );
    return barred ? null : path;
}

/**
 * The sign-in screen, carrying where the reader was going.
 *
 * `requireUser()` builds this, and so does the confirmation's own way back: a
 * reader whose link expired presses `Request a new sign-in link`, and the
 * destination survives that rather than being lost at the last step.
 */
export function signInPath(destination) {
    const safe = safeDestination(destination);
    return safe ? `${SIGN_IN_PATH}?${DESTINATION_PARAM}=${encodeURIComponent(safe)}` : SIGN_IN_PATH;
}

/**
 * The confirmation, carrying the token and — when there is one — the destination.
 *
 * This is what goes into the email, and it is also what every refusal from
 * `POST /api/auth/verify` returns to, so a refused attempt does not cost the
 * reader their destination.
 *
 * EACH BRANCH IS A WHOLE URL RATHER THAN A BASE PLUS A CONDITIONAL FRAGMENT, and
 * that is for a reader of `offline/url-parameters.mjs` as much as for a reader of
 * this function: that check reads a parameter's key out of the static text of the
 * template it sits in, so a separator assembled at runtime would make both keys
 * invisible to it and this app's parameter inventory would quietly stop covering
 * its own sign-in link.
 *
 * A TOKENLESS CALL STILL KEEPS THE DESTINATION, which is the fourth branch and
 * the reason there are four: "a refusal does not cost the reader their
 * destination" is a rule with no exception, and a submission carrying no token —
 * which this app's own form cannot make — would otherwise be the one case where
 * it did.
 */
export function confirmPath({ token, destination } = {}) {
    const safe = safeDestination(destination);

    if (typeof token !== "string" || token.length === 0) {
        return safe ? `${CONFIRM_PATH}?${DESTINATION_PARAM}=${encodeURIComponent(safe)}` : CONFIRM_PATH;
    }
    if (!safe) return `${CONFIRM_PATH}?token=${encodeURIComponent(token)}`;
    return `${CONFIRM_PATH}?token=${encodeURIComponent(token)}&${DESTINATION_PARAM}=${encodeURIComponent(safe)}`;
}

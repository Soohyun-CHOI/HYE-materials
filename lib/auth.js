import { withKeyLock } from "./airtable/client";
import { consumeAuthCode, consumeAuthToken, createAuthToken, getRecentSignInRows } from "./airtable/authTokens";
import { getUserByEmail, createUser } from "./airtable/users";
import { CODE_STATES, SIGN_IN_COPY } from "./authTokenState";
import { isCompanyAddress } from "./companyEmail";
import { sendMagicLinkEmail } from "./email";
import { confirmPath } from "./loginDestination";
import { clearPendingSignIn, createSession, readPendingSignIn, writePendingSignIn } from "./session";
import { ipKeyOf, judgeSignInRequest, mailboxOf, SIGN_IN_LOOKBACK_MS } from "./signInLimit";

if (!process.env.ALLOWED_EMAIL_DOMAIN) {
    throw new Error("Missing ALLOWED_EMAIL_DOMAIN in environment variables");
}

/**
 * The one domain a sign-in may use, read once here and nowhere else (#473).
 *
 * EXPORTED FOR THE SIGN-IN SCREEN, which shows it fixed beside the email field and says
 * it in the field's one refusal: `app/login/page.js` reads it from here and hands it to
 * the form, so the screen spells no domain and judges the field with the same function
 * this module asks of a request — `lib/companyEmail.js`.
 */
export const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN.toLowerCase();

/**
 * Step 1 of the sign-in: validates the domain, issues a row, emails its link and
 * its code. Deliberately does NOT touch the Users table yet — a Users record only
 * gets created once the row is actually spent (see `startSession` below), so an
 * unconfirmed signup attempt never creates an orphaned Employee row for an email
 * nobody has proven they control.
 *
 * AND IT BINDS THIS BROWSER TO THE ROW (#471), last and only once the email is
 * out, so a failed send leaves no browser waiting for a code nobody received. The
 * binding is what makes the code the asking browser's alone; `lib/session.js`
 * carries what it holds and why it is a cookie. A second request replaces it. It
 * holds when this request arrived as well, which `Resend email`'s wait counts from
 * on a page drawn again (#148).
 *
 * AND IT HOLDS EVERY REQUEST TO #148's CEILINGS FIRST, which is the one place they are
 * held: all four controls that ask for an email reach this function and nothing else
 * sends one. One read of the rows sharing this mailbox or this IP, the judgment in
 * `lib/signInLimit.js`, and only then the row — so a refused request makes no row,
 * sends nothing and leaves the binding alone, and the code of the email this browser
 * already holds still works. It answers `{ limited: true, retryAt }` and nothing more,
 * from counts of rows every company address makes alike. The read and the write share
 * the mailbox's lock, which makes the count exact within one process; across two, a
 * ceiling can be passed by as many requests as arrive together.
 *
 * `forwardedFor` IS `x-forwarded-for` AS THE ROUTE RECEIVED IT, and `ipKeyOf` decides what
 * of it counts; the row stores only its hash.
 */
export async function requestMagicLink(email, { baseUrl, destination, forwardedFor }) {
    if (!isCompanyAddress(email, ALLOWED_EMAIL_DOMAIN)) {
        throw new Error("Email must be a company address");
    }

    const requestedAt = Date.now();
    const ipKey = ipKeyOf(forwardedFor);
    const asked = await withKeyLock(`sign-in-mailbox:${mailboxOf(email)}`, async () => {
        const now = Date.now();
        const since = new Date(now - SIGN_IN_LOOKBACK_MS).toISOString();
        const verdict = judgeSignInRequest(await getRecentSignInRows({ email, ipKey, since }), now);
        if (verdict.limited) return verdict;
        return { limited: false, row: await createAuthToken(email, { ipKey }) };
    });
    if (asked.limited) return asked;

    // Points at the confirmation PAGE, not at the consuming endpoint (#203).
    // Opening this URL reads the token and spends nothing, so a mail security
    // scanner following the link ahead of the recipient leaves it usable.
    //
    // AND IT CARRIES THE DESTINATION ACROSS THE MAIL ROUND TRIP (#373), which is
    // the only hop of the sign-in flow that leaves this app. `confirmPath` is
    // what judges the value and what decides whether it appears at all, so this
    // function spells no parameter of its own; `lib/loginDestination.js` records
    // what putting an internal address into a mailbox costs.
    //
    // THE MAIL GOES AS HTML AND AS PLAIN TEXT, BOTH FROM ONE BUILDER (#473), so the two
    // parts cannot word the sign-in differently; a client that shows no HTML reads the
    // link as a sentence and its URL.
    const { token, code, recordId } = asked.row;
    const confirmUrl = `${baseUrl}${confirmPath({ token, destination })}`;
    await sendMagicLinkEmail({
        to: email,
        subject: SIGN_IN_COPY.mail.subject,
        html: SIGN_IN_COPY.mail.html({ email, confirmUrl, code }),
        text: SIGN_IN_COPY.mail.text({ email, confirmUrl, code }),
    });
    await writePendingSignIn({ authTokenRecordId: recordId, email, requestedAt });
    return { limited: false };
}

/**
 * Step 3 since #203, and unchanged by it: consumes the token, finds or creates
 * the User, starts a session. Throws if the token is invalid/expired/already
 * used. What moved is only what reaches this — a form POST from
 * /login/confirm rather than the recipient's own click on a GET.
 */
export async function verifyMagicLink(token) {
    const result = await consumeAuthToken(token);
    if (!result) {
        throw new Error("This link is invalid or has expired");
    }
    return startSession(result.email);
}

/**
 * The other way to finish the same request (#471): the code the email carries,
 * typed into the browser that asked for it. Returns the attempt's state, and
 * starts the session only when the code matched.
 *
 * THE ROW IS THE BINDING'S, never anything the submission names — see
 * `consumeAuthCode` for what that buys. A code that signed in forgets the binding,
 * so the screen that asked goes back to asking for an address.
 */
export async function signInWithCode(typed) {
    const pending = await readPendingSignIn();
    const result = await consumeAuthCode(pending?.authTokenRecordId, typed);
    if (result.state !== CODE_STATES.VALID) return result;

    const session = await startSession(result.email);
    await clearPendingSignIn();
    return { state: result.state, ...session };
}

/**
 * How a spent row becomes a session, for the link and the code alike (#471). One
 * function, so what follows a sign-in cannot differ by the way in: both land
 * wherever the reader was going, and a first-time signer meets the name step there
 * because `requireUser()` asks, not because either path does.
 *
 * The find-or-create is wrapped in withKeyLock keyed by the normalized
 * email — without it, two rows for the same brand-new email spent close together
 * (the reader asked for a second email and then used both) could each see "no
 * existing user" and each call createUser, creating two duplicate Employee
 * records for one person. Same read-then-write race as
 * generateChildId/upsertMaterial, same fix.
 */
async function startSession(email) {
    const userId = await withKeyLock(`user-email:${email.toLowerCase()}`, async () => {
        const existing = await getUserByEmail(email);
        if (existing) return existing.id;

        // NAMELESS ON PURPOSE (#381). This passed `email.split("@")[0]` as the
        // user's name, so `bsws9803` arrived looking like one and nobody was
        // ever asked. The row is created with no name now; `requireUser()` sends
        // its owner to the name step on the first page they reach, which is the
        // first moment in this flow where the address has been proven.
        const created = await createUser({ email });
        return created.id;
    });

    await createSession(userId);
    return { userId, email };
}

import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth";
import { safeDestination } from "@/lib/loginDestination";
import { readPendingSignIn } from "@/lib/session";
import { resendWaitLeft } from "@/lib/signInLimit";
import { withOpsLabel } from "@/lib/airtableOps";
import LoginForm from "./LoginForm";

/**
 * The sign-in screen, and the destination it holds on to (#373).
 *
 * IT BECAME A SERVER COMPONENT IN THIS ISSUE AND THE ALTERNATIVE IS WHY. The
 * screen now carries where the reader was going, which arrives as a URL
 * parameter; reading one from a Client Component means `useSearchParams()`, and
 * that needs a `Suspense` boundary — the exact pair #203 removed when the
 * `?error=` messages left. So the page reads the parameter on the server, judges
 * it once, and hands the form a value it can only pass along. The form itself is
 * unchanged and still a Client Component, in `LoginForm.js` beside this file.
 *
 * WHICH MEANS THIS PAGE OPENS AN OPS SCOPE AND ITS EXEMPTION IS GONE. It was the
 * one entry point in the app excused from #224's rule, on the ground that it was
 * the only Client Component page and `lib/airtableOps.js` is a forbidden root for
 * the browser bundle. That ground no longer exists, so the exemption was deleted
 * rather than left standing with a reason that had become false. The page still
 * makes no Airtable call — the scope opens anyway, which is `/t/[labelCode]`'s
 * precedent: `withOpsLabel` logs in a `finally`, so a read added here later is
 * counted without anyone remembering to.
 *
 * NOTHING ON THE SCREEN SAYS WHERE THE READER WAS GOING, and that is a decision
 * rather than an omission: a refused destination and no destination at all are
 * one outcome (`lib/loginDestination.js`), so there is no second case to word,
 * and `/login` is reachable by anyone — a shared link naming somebody else's
 * destination would show it to whoever opened it.
 *
 * AND IT OPENS ON THE CODE STEP WHEN THIS BROWSER IS WAITING FOR ONE (#471). The
 * email step binds the browser to the email it asked for (`lib/session.js`), and
 * this page reads that binding, so a phone that dropped the tab while its owner
 * went to the mail app comes back to the field the code goes in rather than to a
 * blank address. It reads a cookie and not the row: the address is in the
 * binding, and what the row says is the code's own answer when one is typed —
 * so the page still makes no Airtable call.
 *
 * AND IT HANDS THE FORM THE COMPANY'S DOMAIN (#473), which the email field shows
 * fixed beside it and says in its one refusal. It is `lib/auth.js`'s
 * `ALLOWED_EMAIL_DOMAIN`, the value every request is judged against, so the screen
 * spells no domain of its own. The page draws nothing around the form: the column,
 * the wordmark and the faces are `app/login/layout.js`'s, for all three steps.
 *
 * AND WHAT IS LEFT OF `Resend email`'s WAIT (#148), from the time the binding holds,
 * so a code step drawn again mid-wait counts on rather than starting over or offering
 * the control early. Measured here and handed on as a length, not an instant, so the
 * form's first render and the server's draw the same figure.
 */
export default async function LoginPage(props) {
    return withOpsLabel("/login", () => renderLoginPage(props));
}

async function renderLoginPage({ searchParams }) {
    const { destination } = await searchParams;
    const pending = await readPendingSignIn();

    return (
        <LoginForm
            destination={safeDestination(destination) ?? ""}
            pendingEmail={pending?.email ?? ""}
            resendWaitMs={resendWaitLeft(pending?.requestedAt)}
            domain={ALLOWED_EMAIL_DOMAIN}
        />
    );
}

import { safeDestination } from "@/lib/loginDestination";
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
 * makes no Airtable call — the scope opens anyway, which is `/t/[toolItemId]`'s
 * precedent: `withOpsLabel` logs in a `finally`, so a read added here later is
 * counted without anyone remembering to.
 *
 * NOTHING ON THE SCREEN SAYS WHERE THE READER WAS GOING, and that is a decision
 * rather than an omission: a refused destination and no destination at all are
 * one outcome (`lib/loginDestination.js`), so there is no second case to word,
 * and `/login` is reachable by anyone — a shared link naming somebody else's
 * destination would show it to whoever opened it.
 */
export default async function LoginPage(props) {
    return withOpsLabel("/login", () => renderLoginPage(props));
}

async function renderLoginPage({ searchParams }) {
    const { destination } = await searchParams;

    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <LoginForm destination={safeDestination(destination) ?? ""} />
        </div>
    );
}

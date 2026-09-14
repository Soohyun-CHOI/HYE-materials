import { requireUser } from "@/lib/authz";
import { redirect } from "next/navigation";
import { DEFAULT_DESTINATION, safeDestination } from "@/lib/loginDestination";
import { needsName } from "@/lib/userName";
import { SIGN_IN_TITLE } from "@/lib/productName";
import { withOpsLabel } from "@/lib/airtableOps";
import NameForm from "./NameForm";

/**
 * The third step of the sign-in flow: what to call this person (#381).
 *
 * WHY IT IS AFTER THE TOKEN AND NOT BEFORE IT. Asking on `/login` would take a
 * name from somebody who has not yet shown they control the address, and the
 * answer would then have to cross the mail round trip — either in the link,
 * which `lib/loginDestination.js` forbids anything else from riding, or on the
 * `Auth Tokens` row, which #373 weighed and refused for a value that lives
 * fifteen minutes. Asking on `/login/confirm` has the same problem one step
 * later, on the one page a mail scanner opens. Here the address is proven, the
 * session exists, and the row that will carry the name is already on the base.
 *
 * NOBODY IS SENT HERE TWICE. `requireUser()` asks whether the row has a first
 * name and redirects only when it does not, which costs no Airtable operation —
 * the record is already in hand. This page is excluded from that redirect by
 * `isNameStep`, which is what stops it bouncing against itself.
 *
 * AND A NAMED READER IS SENT AWAY RATHER THAN OFFERED THE FORM. Leaving it open
 * would quietly make this a name-EDITING screen, which is a different thing with
 * a different question behind it (who may change whose name, and what happens to
 * the documents already carrying the old one). Correcting a typo is an Airtable
 * edit until an issue decides that.
 *
 * IT CARRIES THE DESTINATION THROUGH, so a reader who was scanning a tool label
 * lands on the tool item rather than on the root screen. Judged here so a
 * refused value never reaches the form, and judged again in the action, which is
 * the call that protects anything — a Server Action is reachable directly.
 */
export default async function NameStepPage(props) {
    return withOpsLabel("/login/name", () => renderNameStepPage(props));
}

async function renderNameStepPage({ searchParams }) {
    const user = await requireUser();
    const { destination: asked } = await searchParams;
    const destination = safeDestination(asked);

    if (!needsName(user)) redirect(destination ?? DEFAULT_DESTINATION);

    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-sm">
                {/* The line the two screens before this one carry, from the same
                    constant (#201) — three steps of one flow reading as one
                    flow, which is what `docs/briefs/login.md` records of the
                    first two. */}
                <h1 className="text-2xl font-semibold">{SIGN_IN_TITLE}</h1>
                <NameForm destination={destination ?? ""} />
            </div>
        </div>
    );
}

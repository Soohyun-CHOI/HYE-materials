import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllAddresses } from "@/lib/airtable/addresses";
import { ADDRESS_CREATION_COPY as COPY } from "@/lib/addressCreation";
import { withOpsLabel } from "@/lib/airtableOps";
import AddressForm from "./AddressForm";

export const metadata = { title: COPY.heading };

/**
 * Creating an address (#384) — the first create screen outside `/admin`, and the
 * path #385's picker needs for an address that does not exist yet.
 *
 * ANY ACTIVE SESSION, NOT ADMIN, AND THE THREE ADMIN CREATES ARE THE CONTRAST.
 * Gating something to Admin scopes it to the OFFICE rather than to a higher trust
 * tier (CLAUDE.md), and where a delivery goes is not a fact the office holds — the
 * site staffer who talked to the vendor is the one who knows it. A job code is an
 * accounting artifact and a vendor is a commercial relationship, which is why
 * those two are the office's to author; a place is neither. `/deliveries/new`,
 * `/tools/new` and `createOverageDraftAction` are the precedent: site work takes
 * `requireUser()` plus whatever per-record rule applies, and there is none here.
 * An Admin gate would also make this a dead end for the exact reader it is built
 * for, since #385 sends a requester here from the request form.
 *
 * TWO LISTS, TWO OPERATIONS, NEITHER PER ROW. `getAllAddresses` is the whole table
 * in one query — the places a company ships to are bounded by its sites and its
 * suppliers, the `Vendors` and `Tools` shape — and it is what lets the form warn
 * about a label that is already taken at no query cost per keystroke AND list what
 * a job already ships to without a second question. `getAllJobs` is the one-query
 * shape `/deliveries/new` and `/tools/new` both use.
 *
 * `?from=` IS A REQUEST WAITING FOR THIS ADDRESS (#385), AND IT IS JUDGED BY
 * NOTHING HERE ON PURPOSE. It is a `PR ID` rather than an address, so there is no
 * destination for a predicate to judge — the way back is `/prs/new?draft=<it>`,
 * which this app builds, and that screen resolves the id against the READER'S OWN
 * drafts, so a forged one simply matches nothing and the form opens empty. That
 * is `lib/loginDestination.js`'s problem avoided rather than solved again: nothing
 * arrives that could become a way out of the app.
 *
 * EVERY JOB, NOT THE READER'S OWN, WHICH IS `/prs/new`'s CALL AND NOT A NEW ONE.
 * That screen offers every job to every requester — its own comment says the
 * assigned ones sort first "without ever hiding the rest" — so a job's identity is
 * not scoped in this app and a job's address list cannot leak one. Scoping here
 * would refuse a requester the job they are about to raise a request against.
 * `assignedJobsFor` is deliberately not reached for: that is the tools axis's rule
 * for which job an EVENT may be filed against, which is a different question.
 */
export default async function NewAddressPage(props) {
    return withOpsLabel("/addresses/new", () => renderNewAddressPage(props));
}

async function renderNewAddressPage({ searchParams }) {
    const user = await requireUser();

    const { job: jobCode, from: fromPrId } = await searchParams;
    const [jobs, addresses] = await Promise.all([getAllJobs(), getAllAddresses()]);

    // GROUPED TOWARD THE READER'S OWN ASSIGNMENTS AND HIDING NONE, which is
    // `/prs/new`'s partition and not a second rule: same control, same reader, and
    // #385 sends them here from that form. It costs no query — `requireUser()` has
    // already returned the record `assignedJobs` is on. **The grouping is the whole
    // of what an assignment does on this screen**, because what it would gate is
    // not an act: see the page header.
    const assignedJobIds = new Set(user.assignedJobs || []);
    const byCode = (a, b) => (a.jobCode || "").localeCompare(b.jobCode || "", "en-US");
    const myJobs = jobs.filter((j) => assignedJobIds.has(j.id)).sort(byCode);
    const otherJobs = jobs.filter((j) => !assignedJobIds.has(j.id)).sort(byCode);

    // #385 SENDS THE JOB IT ALREADY KNOWS, AS A JOB CODE. The code rather than the
    // record id because that is the identifier this app prints — every document
    // list heads a column `Job` and puts the code in it — and because a record id
    // in a URL is the defect `docs/notes/naming.md` records against
    // `/tools/[toolRecordId]` and says not to repeat. Resolving it costs nothing:
    // the list is already in hand. An unknown code preselects nothing rather than
    // refusing, which is the same outcome as arriving with no parameter at all —
    // the job is a convenience here, not the subject of the screen.
    const initialJobId = jobs.find((candidate) => candidate.jobCode === jobCode)?.id ?? "";

    return (
        <div className="mx-auto w-full max-w-sm p-8">
            <h1 className="text-2xl font-semibold">{COPY.heading}</h1>
            <p className="mt-2 text-sm text-zinc-600">{COPY.intro}</p>

            <AddressForm
                myJobs={myJobs}
                otherJobs={otherJobs}
                addresses={addresses}
                initialJobId={initialJobId}
                fromPrId={typeof fromPrId === "string" ? fromPrId : ""}
            />
        </div>
    );
}

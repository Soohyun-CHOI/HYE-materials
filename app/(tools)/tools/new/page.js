import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllTools } from "@/lib/airtable/tools";
import { assignedJobsFor } from "@/lib/toolJob";
import {
    TOOL_REGISTRATION_COPY as COPY,
    canRegisterToolItems,
    readRegistrationPrefill,
} from "@/lib/toolRegistration";
import { withOpsLabel } from "@/lib/airtableOps";
import ToolRegistrationForm from "./ToolRegistrationForm";

export const metadata = { title: "Register tool items" };

/**
 * The tools track's first write screen (#338), and the first screen on this base
 * that creates a `Tools` row.
 *
 * TWO LISTS, TWO OPERATIONS, NEITHER PER ROW. `getAllTools` is the whole table in
 * one query — a company's tool catalog is bounded by what it has bought, which is
 * tens of rows and the `Vendors` shape — and it is what lets the form preview a
 * name matching a tool that already exists at no query cost per keystroke.
 * `getAllJobs` is the same one-query shape `/deliveries` uses, so a person on
 * several jobs costs no more than a person on one.
 *
 * A PERSON ON NO JOB IS REFUSED HERE RATHER THAN AT THE SUBMIT, and the refusal
 * is the screen rather than a message beside a form they cannot use.
 * `Tool Items."Job"` is required and app-enforced, and the job comes from the
 * actor's own assignments with no office clause — so somebody with none has
 * nothing to register a tool item against, and the copy says what to do about it
 * rather than what went wrong. The action re-derives the same answer, because a
 * Server Action is reachable without this page.
 *
 * THE ADDRESS MAY NAME A TOOL AND A COUNT (#449), and that is where the form's two
 * fields start — the offer a registration that fell short makes on its tool's page
 * opens this with that tool and the count it did not write. Read here and handed down,
 * which is #373's shape: nothing on this screen rewrites the address while it is open.
 * It costs no operation, and the screen says nothing about why the fields are filled,
 * so a reload opens the same suggestion and a copied link is a request rather than an
 * account of somebody else's registration (#321).
 *
 * NO WIDTH, NO COLOR, NO SPACING — see the form's header and #336's layout.
 */
export default async function RegisterToolItemsPage(props) {
    return withOpsLabel("/tools/new", () => renderRegisterToolItemsPage(props));
}

async function renderRegisterToolItemsPage({ searchParams }) {
    const user = await requireUser();
    const [tools, allJobs] = await Promise.all([getAllTools(), getAllJobs()]);

    if (!canRegisterToolItems(user, allJobs)) {
        return (
            <div>
                <h1>{COPY.heading}</h1>
                <p>{COPY.noJob}</p>
            </div>
        );
    }

    const sp = (await searchParams) ?? {};
    const prefill = readRegistrationPrefill({ toolName: sp.toolName, quantity: sp.quantity });

    return (
        <div>
            <h1>{COPY.heading}</h1>
            <p>{COPY.intro}</p>
            <ToolRegistrationForm
                tools={tools}
                jobs={assignedJobsFor(user, allJobs)}
                prefill={prefill}
            />
        </div>
    );
}

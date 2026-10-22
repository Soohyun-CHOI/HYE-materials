import { requireUser } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getAllJobs } from "@/lib/airtable/jobs";
import { DEFAULT_DESTINATION, safeDestination } from "@/lib/loginDestination";
import { jobsOffered, needsJobs } from "@/lib/userJobs";
import { withOpsLabel } from "@/lib/airtableOps";
import JobsForm from "./JobsForm";

/**
 * The step after the name: which jobs this person works on (#554, Sign in 1k and 1l).
 *
 * WHY A STEP AND NOT A SCREEN SOMEBODY OPENS. A person's jobs were set by hand in Airtable, so
 * whoever signed in before the office got to it stood on `No job yet` with nothing to do. The
 * question is asked where the name is (#381), before anything else, by `requireUser()`; once a
 * job is saved the reader is never sent here again, and their jobs are the office's to change.
 *
 * A READER WHO HOLDS A JOB IS SENT ON, NOT OFFERED THE LIST, and so are the office and the
 * President, who are never asked. Leaving the form open would make this the screen that changes
 * a person's jobs, which is the office's decision and a different screen.
 *
 * TWO READS: the session, and every job there is (`getAllJobs`, one query per hundred jobs).
 * Every job is offered — which ones a person works on is theirs to say — in code order.
 *
 * IT CARRIES THE DESTINATION THROUGH, judged here and again in the action, as the name step
 * does: a reader who scanned an asset's label lands on the asset.
 */
export default async function JobsStepPage(props) {
    return withOpsLabel("/login/jobs", () => renderJobsStepPage(props));
}

async function renderJobsStepPage({ searchParams }) {
    const user = await requireUser();
    const { destination: asked } = await searchParams;
    const destination = safeDestination(asked);

    if (!needsJobs(user)) redirect(destination ?? DEFAULT_DESTINATION);

    const jobs = jobsOffered(await getAllJobs());
    return <JobsForm jobs={jobs} destination={destination ?? ""} />;
}

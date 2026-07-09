"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getJobByCode } from "@/lib/airtable/jobs";
import { createLine } from "@/lib/airtable/lines";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form.
//
// Bound to useActionState (see LineForm.js), so it takes (prevState,
// formData) and returns { error } on a bad Job Code instead of throwing —
// a thrown error here has no error boundary to land on gracefully (this
// form has no client JS otherwise) and surfaces as Next's generic "A
// server error occurred" page instead of telling the admin what to fix.
export async function createLineAction(prevState, formData) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        throw new Error("Not authorized");
    }

    const jobCode = formData.get("jobCode");
    const job = await getJobByCode(jobCode);
    if (!job) {
        return { error: `No Job found with Job Code "${jobCode}"` };
    }

    const { lineLabel } = await createLine({
        jobRecordId: job.id,
        lineName: formData.get("lineName"),
    });

    redirect(`/admin/lines/new?created=${encodeURIComponent(lineLabel)}`);
}

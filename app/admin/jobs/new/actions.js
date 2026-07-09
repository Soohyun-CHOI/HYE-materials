"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { createJob } from "@/lib/airtable/jobs";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form.
export async function createJobAction(formData) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        throw new Error("Not authorized");
    }

    const { jobCode } = await createJob({
        jobCode: formData.get("jobCode"),
        jobName: formData.get("jobName"),
        businessUnit: formData.get("businessUnit"),
    });

    redirect(`/admin/jobs/new?created=${encodeURIComponent(jobCode)}`);
}

"use server";

import { redirect } from "next/navigation";
import { withAdminAction } from "@/lib/authz";
import { createJob } from "@/lib/airtable/jobs";
import { withOpsLabel } from "@/lib/airtableOps";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form. Issue #147: the check is the
// wrapper, so the body below is unreachable without it — the refusal stays a
// throw, as it was.
export const createJobAction = withAdminAction(
    () => {
        throw new Error("Not authorized");
    },
    async (formData) => {
        return withOpsLabel("createJobAction", async () => {
            const { jobCode } = await createJob({
                jobCode: formData.get("jobCode"),
                jobName: formData.get("jobName"),
                businessUnit: formData.get("businessUnit"),
            });

            redirect(`/admin/jobs/new?created=${encodeURIComponent(jobCode)}`);
        });
    }
);

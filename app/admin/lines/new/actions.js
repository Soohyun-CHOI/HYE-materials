"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getJobByCode } from "@/lib/airtable/jobs";
import { createLine } from "@/lib/airtable/lines";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form.
export async function createLineAction(formData) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        throw new Error("Not authorized");
    }

    const jobCode = formData.get("jobCode");
    const job = await getJobByCode(jobCode);
    if (!job) {
        throw new Error(`No Job found with Job Code "${jobCode}"`);
    }

    const { lineLabel } = await createLine({
        jobRecordId: job.id,
        lineName: formData.get("lineName"),
    });

    redirect(`/admin/lines/new?created=${encodeURIComponent(lineLabel)}`);
}

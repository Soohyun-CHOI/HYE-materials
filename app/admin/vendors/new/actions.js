"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { createVendor } from "@/lib/airtable/vendors";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form.
export async function createVendorAction(formData) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        throw new Error("Not authorized");
    }

    const { vendorName } = await createVendor({
        vendorName: formData.get("vendorName"),
        picName: formData.get("picName"),
        picPhone: formData.get("picPhone"),
        picEmail: formData.get("picEmail"),
    });

    redirect(`/admin/vendors/new?created=${encodeURIComponent(vendorName)}`);
}

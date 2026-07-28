"use server";

import { redirect } from "next/navigation";
import { withAdminAction } from "@/lib/authz";
import { createVendor } from "@/lib/airtable/vendors";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form. Issue #147: the check is the
// wrapper, so the body below is unreachable without it — the refusal stays a
// throw, as it was.
export const createVendorAction = withAdminAction(
    () => {
        throw new Error("Not authorized");
    },
    async (formData) => {
        const { vendorName } = await createVendor({
            vendorName: formData.get("vendorName"),
            picName: formData.get("picName"),
            picPhone: formData.get("picPhone"),
            picEmail: formData.get("picEmail"),
        });

        redirect(`/admin/vendors/new?created=${encodeURIComponent(vendorName)}`);
    }
);

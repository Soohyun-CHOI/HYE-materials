"use server";

import { redirect } from "next/navigation";
import { withAdminAction } from "@/lib/authz";
import { createVendor } from "@/lib/airtable/vendors";
import { withOpsLabel } from "@/lib/airtableOps";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form. Issue #147: the check is the
// wrapper, so the body below is unreachable without it.
//
// THE REFUSAL THROWS, AND #185 REPLACED "as it was" WITH A REASON. This page is a
// Server Component that hands the action straight to `<form action={…}>`, a binding
// that discards the return value — so there is no `state` for a returned `{ error }`
// to land in and no error slot on the screen at all. That is also why this handler
// has no `{ error }` return of its own: it creates and redirects. The sibling at
// `/admin/disciplines/new` returns, because its form goes through `useActionState`.
// **A thrown message is not screen copy here**: this app has no `error.js` or
// `global-error.js` anywhere, so nothing in it renders one — see
// `docs/notes/authorization.md` for what changes on the day that stops being true.
export const createVendorAction = withAdminAction(
    () => {
        throw new Error("Not authorized");
    },
    async (formData) => {
        return withOpsLabel("createVendorAction", async () => {
            const { vendorName } = await createVendor({
                vendorName: formData.get("vendorName"),
                picName: formData.get("picName"),
                picPhone: formData.get("picPhone"),
                picEmail: formData.get("picEmail"),
            });

            redirect(`/admin/vendors/new?created=${encodeURIComponent(vendorName)}`);
        });
    }
);

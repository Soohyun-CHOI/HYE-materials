"use server";

import { redirect } from "next/navigation";
import { withAdminAction } from "@/lib/authz";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { createDiscipline } from "@/lib/airtable/disciplines";
import { withOpsLabel } from "@/lib/airtableOps";

// Server Actions are directly callable regardless of what the page renders
// (e.g. via devtools), so the admin check must happen here too, not just in
// the page component that renders the form.
//
// Bound to useActionState (see DisciplineForm.js), so it takes (prevState,
// formData) and returns { error } on a bad Job Code instead of throwing —
// a thrown error here has no error boundary to land on gracefully (this
// form has no client JS otherwise) and surfaces as Next's generic "A
// server error occurred" page instead of telling the admin what to fix.
// Issue #147 — the authz refusal deliberately stays a throw even though the
// validation failures below return { error }: the note above is about what a
// *bad Job Code* should do to a form with no client JS, not about an
// unauthorized caller, who has no form open to render into. Aligning the two
// would change what a user sees and is its own decision.
// Issue #185 — RETURNED, BECAUSE THE CALL SITE BINDS THE RETURN. `DisciplineForm.js`
// reads this action through `useActionState`, so its refusal lands in `state` and the
// form's own red box renders it — the same box the two validation refusals below
// already use, which is why this conversion adds no place for a design to draw. It
// threw until then, which made one action refuse two ways: authorization off the
// screen and validation on it. `/admin/jobs/new` and `/admin/vendors/new` keep the
// throw for the opposite reason, and it is a real one — their pages hand the action
// straight to `<form action={…}>`, which discards whatever it returns.
export const createDisciplineAction = withAdminAction(
    () => ({ error: "Not authorized." }),
    async (prevState, formData) => {
        return withOpsLabel("createDisciplineAction", async () => {
            // Issue #30 — the form now submits a Job record id chosen from a
            // dropdown of existing Jobs, not a free-text Job Code. The UI can only
            // offer real Jobs, but a forged/stale direct call could still submit one
            // that doesn't exist, so re-verify existence server-side — the UI
            // constraint doesn't replace this guarantee (issue #29's non-existent-Job
            // rejection, now keyed on the record id). getJobByRecordId throws on an
            // unknown/malformed id (Airtable 404/422), so a forged id is caught and
            // surfaced as the same graceful { error } the form renders, not a 500.
            const jobId = formData.get("jobId");
            let job = null;
            try {
                job = jobId ? await getJobByRecordId(jobId) : null;
            } catch {
                job = null;
            }
            if (!job) {
                return { error: "That Job doesn't exist. Pick one from the list." };
            }

            const { disciplineLabel } = await createDiscipline({
                jobRecordId: job.id,
                disciplineName: formData.get("disciplineName"),
            });

            redirect(
                `/admin/disciplines/new?created=${encodeURIComponent(disciplineLabel)}`
            );
        });
    }
);

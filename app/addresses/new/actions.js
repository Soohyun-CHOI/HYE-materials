"use server";

import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { createAddressIfLabelFree } from "@/lib/airtable/addresses";
import {
    ADDRESS_CREATION_COPY,
    ADDRESS_COUNTRIES,
    DEFAULT_COUNTRY,
    readAddressFields,
} from "@/lib/addressCreation";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Record a place this company ships to (#384).
 *
 * NOT WRAPPED, AND THE EXEMPTION'S REASON IS "SESSION AND NOTHING ELSE" RATHER
 * THAN AN AXIS. Every other `requireUser()` action on this base names a
 * per-record comparison that does the real authorizing — the delivery's job, the
 * request's requester, the tool item's job. There is none here and the exemption
 * says so instead of borrowing a reason: an address carries no owner, no money
 * and no authorization, so whoever may use this app may record one. What decides
 * it is the page's own argument — Admin means the office, and where material has
 * to go is the site's fact, not the office's.
 *
 * REFUSES BY RETURNING `{ error }` BECAUSE THE CALL SITE BINDS (#185).
 * AddressForm.js reads this through `useActionState`, so a refusal lands in
 * `state` and the form renders it in the one slot it already has.
 *
 * THE JOB IS RESOLVED AGAINST THE LIST RATHER THAN TRUSTED, even though nothing
 * about it is a permission: an id that names no job would go into
 * `Addresses."Jobs"` and fail the whole create at Airtable, which is not a thing
 * to discover from a stack trace. It is also where the `Job Code` in the success
 * line comes from. Blank is the ordinary case — a vendor's own address belongs to
 * no job.
 *
 * AN ID THAT RESOLVES TO NOTHING IS DROPPED RATHER THAN REFUSED, which is what
 * the page does with an unknown `?job=` and is the same judgment: the job is a
 * convenience on this screen and not its subject, so losing it must not lose the
 * address somebody typed. The reader is told — the account of what was written
 * names the job when there is one and does not when there is not — so a job that
 * vanished between the render and the submit is visible in the answer rather than
 * in a refusal with no copy behind it.
 *
 * THE DUPLICATE VERDICT IS REACHED TWICE ON PURPOSE. The form previews it against
 * the list the browser loaded, which cannot say whether a label is taken NOW;
 * `createAddressIfLabelFree` asks Airtable under a lock. One sentence is returned
 * either way, so the preview and the refusal cannot word the same collision two
 * ways.
 */
export async function createAddressAction(prevState, formData) {
    return withOpsLabel("createAddressAction", async () => {
        await requireUser();

        const { values, refusal } = readAddressFields({
            addressLabel: formData.get("addressLabel"),
            line1: formData.get("line1"),
            line2: formData.get("line2"),
            city: formData.get("city"),
            state: formData.get("state"),
            zipCode: formData.get("zipCode"),
        });
        if (refusal) return { error: refusal };

        const submittedJobId = String(formData.get("jobId") ?? "");
        const job = submittedJobId
            ? (await getAllJobs()).find((candidate) => candidate.id === submittedJobId) ?? null
            : null;

        const { address, existing } = await createAddressIfLabelFree({
            ...values,
            // A submitted value that is not one of the field's options is replaced
            // rather than passed on: nothing here uses `typecast`, so Airtable
            // would refuse the whole create and the person would lose an address
            // they typed over a dropdown they cannot reach from the screen.
            country: ADDRESS_COUNTRIES.includes(formData.get("country"))
                ? formData.get("country")
                : DEFAULT_COUNTRY,
            jobRecordIds: job ? [job.id] : [],
        });

        if (existing) return { error: ADDRESS_CREATION_COPY.labelTaken(existing.addressLabel) };

        return { addressLabel: address.addressLabel, jobCode: job?.jobCode ?? null };
    });
}

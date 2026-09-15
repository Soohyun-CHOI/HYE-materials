import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllAddresses } from "@/lib/airtable/addresses";
import { getDeliveryCandidates } from "@/lib/deliveryCandidates";
import { getInvoiceLinkCandidates } from "@/lib/deliveryInvoiceCandidates";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";
import { withOpsLabel } from "@/lib/airtableOps";
import DeliveryForm from "./DeliveryForm";

export const metadata = { title: "Record a delivery" };

/**
 * Record a delivery (#162).
 *
 * ONE PAGE. The job is a dropdown alongside the vendor and the item rather than a
 * step you navigate through first — the same shape as the invoice form, where
 * vendor and PO are selects on the one page. Everything narrows from the job:
 * the vendor picker holds only vendors that job ordered from, and the item
 * dropdown only what that vendor supplied.
 *
 * That works because getDeliveryCandidates batches ACROSS jobs — the walk down to
 * PO Items costs ~5 queries whether the viewer is on one job or all 36 — so the
 * page can hand the form every candidate ordered item at once and let it filter
 * client-side. Fetching per job would have been ~6 queries each, over 200 for an
 * Admin, which is what forced the first version to navigate.
 *
 * The candidate ordered items go to the client on purpose. lib/deliveryAllocation.js is
 * pure, so the form imports the very function the Server Action re-runs and draws
 * an accurate preview with no extra endpoint to authorize. Nothing in the payload
 * is privileged: it is the ordered items of jobs the viewer is already scoped to.
 */
// Labeled for #190 — see the note in app/prs/page.js. Measured because CLAUDE.md
// makes a specific claim about it (~5 queries for all 36 jobs, batched across
// jobs rather than per job), and confirming or falsifying a written claim is
// worth more than a fresh number.
export default async function NewDeliveryPage() {
    return withOpsLabel("/deliveries/new", () => renderNewDeliveryPage());
}

async function renderNewDeliveryPage() {
    const user = await requireUser();

    // Entry is open to anyone assigned to the Job, plus the office — narrowed
    // through the same predicate createDeliveryAction re-checks per record, so the
    // dropdown cannot offer a job the action would then refuse.
    const jobs = jobsFor(user, await getAllJobs());

    if (jobs.length === 0) {
        return (
            <div className="mx-auto w-full max-w-3xl p-8">
                <h1 className="text-2xl font-semibold">Record a delivery</h1>
                <p className="mt-4 text-sm text-zinc-600">
                    You are not assigned to any job yet, so there is nothing to record a delivery
                    against. An Admin can add you to a job in Airtable.
                </p>
                <Link href="/deliveries" className="mt-6 inline-block text-sm underline">
                    All deliveries
                </Link>
            </div>
        );
    }

    // #387 — ONE `list` FOR BOTH HALVES OF THE ADDRESS CONTROL: the label the
    // default renders under, and every option the picker offers. The whole table in
    // one query is `getAllAddresses`'s own shape — the places a company ships to are
    // bounded by its sites and its suppliers, four rows today — and it is what
    // `/prs/new` already pays for the same control. The DEFAULT itself costs
    // nothing: each candidate ordered item carries its order's address id already
    // (lib/deliveryCandidates.js), so what this buys is the words, not the answer.
    const [{ orderedItems, vendorNameById }, addresses] = await Promise.all([
        getDeliveryCandidates(jobs),
        getAllAddresses(),
    ]);

    // #210 — the invoices this viewer may pair a delivery with, narrowed up front to
    // the vendors that actually supplied these jobs so the batched reads stay small.
    // GATED PER RECORD through lib/invoiceVisibility.js rather than by a rule of its
    // own: a dropdown of invoice numbers is a surface that shows invoices. The form
    // narrows again to the vendor chosen, client-side, off this same list — the
    // arrangement the candidate ORDERED ITEMS already use.
    const invoiceOptions = await getInvoiceLinkCandidates(user, {
        vendorRecordIds: [
            ...new Set(orderedItems.map((item) => item.vendorRecordId).filter(Boolean)),
        ],
    });

    return (
        <div className="mx-auto w-full max-w-3xl p-8">
            <h1 className="text-2xl font-semibold">Record a delivery</h1>
            <p className="mt-1 text-sm text-zinc-600">
                What was delivered, and on which job. The app works out which order it belongs to.
            </p>

            <DeliveryForm
                // #387 — `deliveryAddress` rides along, because `addressOptions`
                // groups by the addresses a JOB uses and that is a union of
                // `Addresses."Jobs"` and the job's own default link.
                jobs={jobs.map((j) => ({
                    id: j.id,
                    jobCode: j.jobCode,
                    jobName: j.jobName,
                    deliveryAddress: j.deliveryAddress || [],
                }))}
                orderedItems={orderedItems}
                addresses={addresses}
                // A Map cannot cross the server/client boundary; a plain object can.
                vendorNames={Object.fromEntries(vendorNameById)}
                invoiceOptions={invoiceOptions}
            />

            <Link href="/deliveries" className="mt-8 inline-block text-sm underline">
                All deliveries
            </Link>
        </div>
    );
}

import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllPOs } from "@/lib/airtable/purchaseOrders";
import { getPRsByRecordIds } from "@/lib/airtable/purchaseRequests";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllLines } from "@/lib/airtable/lines";
import { canViewPR } from "@/lib/prVisibility";
import { statusLabel } from "@/lib/poListView";
import { withOpsLabel } from "@/lib/airtableOps";
import POListClient from "./POListClient";

export const metadata = { title: "Purchase Orders" };

// Purchase orders had no list (#168): a PO was reachable only through the PR that
// generated it, and /api/pos/search is Admin-only. Delivery status is out of
// scope here — that is #169, and it needed this page first.
//
// ACCESS IS THE PR LIST'S, NOT THE INVOICE LIST'S. Any active session reaches
// this page, and each row is then gated per record by canViewPR against the PO's
// parent PR — the same rule and the same shared function /pos/[poId] uses (#132).
// The two existing lists differ on this: /invoices is President-or-Admin for the
// whole page, because invoicing is office work. A purchase order is not.
//
// A refused row is simply absent. There is no "you may not see this" message,
// matching /pos/[poId], which renders the ordinary not-found text rather than
// confirming that a record exists outside someone's scope.
const STATUSES = ["Awaiting Signature", "Signed", "Withdrawn"];

// Labeled for #190, and NOT because every screen is — attribution there is
// opt-in, and /invoices, /deliveries and /materials are still unlabeled by
// design. This one is labeled because #168's cost claim is a COMPARISON WITH
// /prs: that page spends 7 operations and three of them are one `Users: find`
// per distinct requester, where this page resolves every level in a batch. The
// comparison is only a measurement if both ends are labeled, and #190's counter
// landed after this page did, so the label could not be added with the page.
//
// An outer wrapper, so the page's own logic keeps its indentation, and the route
// TEMPLATE, so repeated loads aggregate into one row. Same shape as
// app/prs/page.js.
export default async function POListPage(props) {
    return withOpsLabel("/pos", () => renderPOListPage(props));
}

async function renderPOListPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;

    // SIX OPERATIONS, AND NONE OF THEM IS PER ROW. Each fetches a whole level
    // keyed on ids from the level above, which is the property #143 established
    // and #190 measured /prs failing — that page resolves one requester at a time,
    // so three of its seven operations are `Users: find`. getPRsByRecordIds is the
    // batched reader (findByRecordIds under it) and it maps through recordToPR, so
    // the rows carry the signerRowIds/correctionRowIds canViewPR needs for clauses
    // 5 and 6. getLinkedRecords is deliberately not used anywhere here: it re-finds
    // the parent on every call, which is why /prs/[prId] reads one PR five times.
    //
    // Lines is the sixth and buys one thing: the Line NAME. A PR's `line` is a link
    // and gives a record id, exactly as `job` does, so the column cannot be built
    // without it — the same reason /prs fetches Lines for the same column.
    const [pos, vendors, jobs, lines] = await Promise.all([
        getAllPOs(),
        getAllVendors(),
        getAllJobs(),
        getAllLines(),
    ]);
    const parentPrIds = [...new Set(pos.map((po) => po.pr?.[0]).filter(Boolean))];
    const prs = await getPRsByRecordIds(parentPrIds);

    const prById = new Map(prs.map((pr) => [pr.id, pr]));
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.vendorName]));
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const lineById = new Map(lines.map((l) => [l.id, l]));

    // THE GATE. A PO with no parent PR is refused rather than shown: every PO in
    // this app is generated from one (strict 1:1), so a missing parent is a broken
    // record, and there is no rule by which anyone is entitled to see it.
    const visible = pos.filter((po) => {
        const pr = prById.get(po.pr?.[0]);
        return pr ? canViewPR(user, pr) : false;
    });

    // Already in PO ID descending order — Airtable sorted it in getAllPOs, the way
    // /invoices sorts by Invoice ID. Nothing re-sorts here, so `map` preserves it.
    const rows = visible.map((po) => {
        const pr = prById.get(po.pr?.[0]);
        const jobId = pr?.job?.[0] ?? null;
        return {
            id: po.id,
            poId: po.poId,
            vendorName: vendorNameById.get(po.vendor?.[0]) || "—",
            jobId,
            jobCode: jobById.get(jobId)?.jobCode || null,
            lineName: lineById.get(pr?.line?.[0])?.lineName || null,
            total: po.totalAmount ?? po.itemsSubtotal ?? 0,
            // The raw value drives the filter; the rendered text is the column.
            status: po.status || "",
            statusText: statusLabel(po),
            // A PO carries no requester of its own — it is the parent PR's
            // (#138). Resolved here so the requester's identity never reaches
            // the client, the same way /prs resolves isMine server-side.
            isMine: pr?.requester?.[0] === user.id,
        };
    });

    // JOB FILTER OPTIONS COME FROM THE VISIBLE ROWS, NOT FROM THE VIEWER'S
    // ASSIGNMENTS, and that is a deliberate divergence from /prs. There, options
    // are the Jobs a user is assigned to, so a PR visible only through canViewPR's
    // clause 5 or 6 — a signer, or a correction recipient, neither of which
    // implies assignment — appears in the list and cannot be filtered to. CLAUDE.md
    // records that as a known inconsistency whose obvious fix is a UI decision.
    // This is that fix, made where the page is new rather than by changing /prs.
    // It leaks nothing: every job named here is already on a row the viewer can
    // see, in a column they can read.
    const jobOptions = [...new Map(
        rows
            .filter((r) => r.jobId && r.jobCode)
            .map((r) => [r.jobId, { id: r.jobId, jobCode: r.jobCode, jobName: jobById.get(r.jobId)?.jobName }])
    ).values()].sort((a, b) => a.jobCode.localeCompare(b.jobCode));

    // Initial filter state parsed from the URL, so refresh, a shared link and the
    // back button all restore the view. Intersected with the options above, so a
    // forged ?job in a pasted URL is dropped before it reaches the client.
    const jobOptionIds = new Set(jobOptions.map((j) => j.id));
    const rawJob = sp?.job;
    const initialSelectedJobs = (Array.isArray(rawJob) ? rawJob : rawJob ? [rawJob] : []).filter((id) =>
        jobOptionIds.has(id)
    );

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <h1 className="text-2xl font-semibold">Purchase Orders</h1>

            <POListClient
                rows={rows}
                jobOptions={jobOptions}
                statuses={STATUSES}
                // Every PO on the base, before the visibility gate — the ONLY
                // thing that tells "none exist yet" apart from "none for you".
                totalCount={pos.length}
                initialSelectedJobs={initialSelectedJobs}
                initialStatus={STATUSES.includes(sp?.status) ? sp.status : ""}
                initialMine={sp?.mine === "1"}
            />
        </div>
    );
}

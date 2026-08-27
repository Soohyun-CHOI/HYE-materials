import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllPOs } from "@/lib/airtable/purchaseOrders";
import { getApprovedPRs, getPRsByRecordIds } from "@/lib/airtable/purchaseRequests";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllLines } from "@/lib/airtable/lines";
import { getPOItemsByRecordIds } from "@/lib/airtable/poItems";
import { canViewPR } from "@/lib/prVisibility";
import { selectPOsAwaitingSend, selectPRsAwaitingPO, statusLabel } from "@/lib/poListView";
import { PO_SENT_STATUS } from "@/lib/poSend";
import {
    daysWaiting,
    describePOColumn,
    describePOInvoicingColumn,
    sortLongestWaitingFirst,
    summarizePODeliveryStatus,
    summarizePOInvoicingStatus,
} from "@/lib/deliveryStatus";
import { withOpsLabel } from "@/lib/airtableOps";
import POListClient from "./POListClient";
import AwaitingPOStrip from "./AwaitingPOStrip";
import AwaitingSendStrip from "./AwaitingSendStrip";

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
// Issue #281 added the fourth. This list is BOTH the filter chips and the validator
// for `?status=`, so an option missing from it is a state nobody can filter for and a
// link nobody can share — the row still renders unfiltered, which is what made the
// omission quiet. In the order an order passes through them.
const STATUSES = ["Awaiting Signature", "Signed", PO_SENT_STATUS, "Withdrawn"];

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
// app/prs/page.js. #169 added the seventh and eighth operations; see below.
export default async function POListPage(props) {
    return withOpsLabel("/pos", () => renderPOListPage(props));
}

async function renderPOListPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;

    // SEVEN OPERATIONS, AND NONE OF THEM IS PER ROW. Each fetches a whole level
    // keyed on ids from the level above, which is the property #143 established
    // and #190 measured /prs failing — that page resolves one requester at a time,
    // so three of its seven operations are `Users: find`. getPRsByRecordIds is the
    // batched reader (findByRecordIds under it) and it maps through recordToPR, so
    // the rows carry the signerRowIds/correctionRowIds canViewPR needs for clauses
    // 5 and 6. getLinkedRecords is deliberately not used anywhere here: it re-finds
    // the parent on every call, which is why /prs/[prId] reads one PR five times.
    //
    // Lines buys one thing: the Line NAME. A PR's `line` is a link and gives a
    // record id, exactly as `job` does, so the column cannot be built without it —
    // the same reason /prs fetches Lines for the same column.
    //
    // getApprovedPRs is #176's and is the seventh. It cannot be derived from the
    // six above: the strip's subject is approved requests that produced NO order,
    // so every one of them is absent from `pos` by definition. It is one select
    // filtered on `Status`, so it grows one query per 100 approved requests and
    // never with the number of rows the strip draws.
    const [pos, vendors, jobs, lines, approvedPRs] = await Promise.all([
        getAllPOs(),
        getAllVendors(),
        getAllJobs(),
        getAllLines(),
        getApprovedPRs(),
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

    // THE DELIVERY LEVEL, IN ONE READ FOR THE WHOLE PAGE (#169). getAllPOs already
    // returned each PO's `PO Items` reverse-link array — core link data that costs
    // nothing extra to expose, which is why #19 put it on the mapper — so the ids
    // are in hand and one findByRecordIds fetches every ordered item of every VISIBLE
    // order. Gathering from `visible` rather than from `pos` is deliberate: a
    // viewer's refused rows must not put their ordered items on the wire either.
    //
    // This is the opposite shape from the one #193 exists to remove. That is
    // getLinkedRecords' 1 + N — a find() for the parent and a find() per child;
    // this is zero per row, one query per 50 ids, so the page goes six to eight. What
    // grows it is the number of ORDERED ITEMS, at one query per fifty, never the
    // number of rows rendered.
    const poItemRecordIds = visible.flatMap((po) => po.poItems || []);
    const poItems = await getPOItemsByRecordIds(poItemRecordIds);

    const linesByPO = new Map();
    for (const item of poItems) {
        const poRecordId = item.po?.[0];
        if (!poRecordId) continue;
        if (!linesByPO.has(poRecordId)) linesByPO.set(poRecordId, []);
        linesByPO.get(poRecordId).push({
            orderedQty: item.qty,
            deliveredQty: item.deliveredQty,
            // #235 — the invoicing chip's own quantity. Free: this reader already
            // returns the whole record, so the field costs no query and the two
            // chips are folded from one list of ordered items.
            invoicedQty: item.invoicedQty,
            committedQty: item.committedQty,
        });
    }

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
            // #169 — the same function the detail page calls, so the row a reader
            // clicks and the page they land on cannot describe one order
            // differently. Resolved to a chip here rather than in the Client
            // Component, because the copy lives in lib/deliveryStatus.js and
            // nothing under app/ should hold a second copy of it.
            //
            // TRUE SINCE #233 AND NOT BEFORE: #169 wrote this sentence while the
            // detail page had the `Delivered` column and no chip, so the function
            // had one caller. That page calls it now, beside its `Deliveries`
            // heading.
            deliveryChip: describePOColumn(summarizePODeliveryStatus(linesByPO.get(po.id) || [])),
            // #235 — the invoicing axis's own chip, resolved here for the reason the
            // delivery one is: the copy lives in lib/deliveryStatus.js and the client
            // component never sees a quantity. Every viewer of a row reads it, which
            // needs no branch because this list has none — an order is visible or it
            // is not, and what a vendor invoiced is readable by whoever may read the
            // order behind it (#211).
            invoicingChip: describePOInvoicingColumn(
                summarizePOInvoicingStatus(linesByPO.get(po.id) || [])
            ),
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

    // #176 — THE STRIP IS GATED BY THE SAME RULE AS THE TABLE, canViewPR, and the
    // gate is applied to the requests rather than to the orders because there are
    // no orders here to gate. A viewer who can see none of them gets no strip,
    // which is the same answer they get for the table's rows and for the same
    // reason: a refused row is absent rather than announced.
    //
    // Job, Line and Vendor come out of the three maps the table already built, so
    // the strip adds no read of its own beyond the one select above.
    const awaitingPO = selectPRsAwaitingPO(approvedPRs.filter((pr) => canViewPR(user, pr)));
    const awaitingPORows = awaitingPO.map((pr) => ({
        id: pr.id,
        prId: pr.prId,
        jobCode: jobById.get(pr.job?.[0])?.jobCode || null,
        lineName: lineById.get(pr.line?.[0])?.lineName || null,
        vendorName: vendorNameById.get(pr.vendor?.[0]) || null,
    }));

    // #295 — SIGNED ORDERS NOBODY HAS SENT, AND NOT ONE NEW READ. The orders are
    // `visible`, so the strip inherits the table's gate rather than applying a second
    // one; `Sent At`, `President Signed At` and `President Signed` all ride on
    // recordToPO already (#281 put the first there), and Job, Line and Vendor come out
    // of the three maps the table built. `Sent By` is deliberately absent: the send
    // writes it in the same operation as `Sent At`, so every row here has none, and a
    // column naming the person would cost a Users read per row to name nobody.
    //
    // The server's day, taken once so every row is measured against the same one —
    // app/invoices/page.js's shape, and `daysWaiting` documents what it does and does
    // not promise.
    const today = new Date().toISOString().slice(0, 10);
    const awaitingSendRows = sortLongestWaitingFirst(
        selectPOsAwaitingSend(visible).map((po) => {
            const pr = prById.get(po.pr?.[0]);
            const jobId = pr?.job?.[0] ?? null;
            // BOTH NAMES, AND NEITHER IS REDUNDANT (#256's rule for this comparator).
            // `waitingSince` is what the shared sort orders by and holds the INSTANT,
            // which orders exactly; `signedDate` is what the row renders and is the
            // calendar day, because `daysWaiting` subtracts two dates and the strip
            // prints the day it counted from.
            const signedDate = po.presidentSignedAt ? po.presidentSignedAt.slice(0, 10) : "";
            return {
                poId: po.poId,
                waitingSince: po.presidentSignedAt || "",
                signedDate,
                // The tie-break, sort-only: nothing renders it.
                createdKey: po.poId || "",
                jobCode: jobById.get(jobId)?.jobCode || null,
                lineName: lineById.get(pr?.line?.[0])?.lineName || null,
                vendorName: vendorNameById.get(po.vendor?.[0]) || null,
                daysWaiting: daysWaiting(signedDate, today),
            };
        })
    );

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

            {/* Above the list, because the thing it reports cannot be IN the
                list: an approved request with no order has no row here. Renders
                nothing at all when there is nothing, which is the normal case. */}
            <AwaitingPOStrip rows={awaitingPORows} isAdmin={user.isAdmin === true} />

            {/* #295 — second of the two, in the order the document chain runs: a
                request that never became an order, then an order that never reached
                its vendor. Each renders nothing on its own count, so a reader meets
                one, both or neither. */}
            <AwaitingSendStrip rows={awaitingSendRows} />

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

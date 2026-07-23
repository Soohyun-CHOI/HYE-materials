import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getPRById } from "@/lib/airtable/purchaseRequests";
import { getSignersByPR } from "@/lib/airtable/prSigners";
import { getItemsByPR } from "@/lib/airtable/prItems";
import { getCorrectionRequestsByPR } from "@/lib/airtable/correctionRequests";
import { getEditLogByPR } from "@/lib/airtable/editLog";
import { getQuotationsByPR } from "@/lib/airtable/quotations";
import { getUserByRecordId } from "@/lib/airtable/users";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllLines } from "@/lib/airtable/lines";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { getCurrentTurn, getReturnTargets } from "@/lib/prSigning";
import { formatUSD } from "@/lib/format";
import ItemsSummaryRows from "@/app/components/ItemsSummaryRows";
import SigningPanel from "./SigningPanel";
import GeneratePOForm from "./GeneratePOForm";
import SignerProgressBar from "./SignerProgressBar";
import WithdrawPRForm from "./WithdrawPRForm";

const DONE_MESSAGES = {
    submitted: "Submitted for review.",
    approved: "Recorded your approval.",
    edited: "Saved your changes.",
    returned: "Sent back for correction.",
    "po-generated": "Generated the Purchase Order.",
    withdrawn: "Withdrew this PR.",
};

export default async function PRDetailPage({ params, searchParams }) {
    const user = await requireUser();
    const { prId } = await params;
    const { done } = await searchParams;

    const pr = await getPRById(prId);
    if (!pr) {
        return <div className="p-8">PR not found.</div>;
    }

    const [signers, items, quotations, correctionRequests, editLog, vendors, lines, jobs] =
        await Promise.all([
            getSignersByPR(pr.id),
            getItemsByPR(pr.id),
            getQuotationsByPR(pr.id),
            getCorrectionRequestsByPR(pr.id),
            getEditLogByPR(pr.id),
            getAllVendors(),
            getAllLines(),
            getAllJobs(),
        ]);

    const po = pr.purchaseOrders?.[0] ? await getPOByRecordId(pr.purchaseOrders[0]) : null;

    const userIds = new Set(
        [
            pr.requester?.[0],
            ...signers.map((s) => s.signer?.[0]),
            ...correctionRequests.flatMap((c) => [c.initiatedBy?.[0], c.sentTo?.[0]]),
            ...editLog.map((e) => e.changedBy?.[0]),
        ].filter(Boolean)
    );
    const userList = await Promise.all([...userIds].map((id) => getUserByRecordId(id)));
    const usersById = Object.fromEntries(userList.filter(Boolean).map((u) => [u.id, u]));

    const vendorsById = Object.fromEntries(vendors.map((v) => [v.id, v]));
    const linesById = Object.fromEntries(lines.map((l) => [l.id, l]));
    const jobsById = Object.fromEntries(jobs.map((j) => [j.id, j]));

    // Issue #67 — same fallback labeling as the creation form: the
    // Vendor Quotation Code once entered, else a positional placeholder
    // so the column/dropdown is never blank. Only shown once there's an
    // actual choice among Quotations to display (see the Items table and
    // EditAndContinueForm below).
    const quotationLabel = (q, i) => q.vendorQuotationCode || `Quotation ${i + 1}`;
    const quotationLabelsById = Object.fromEntries(
        quotations.map((q, i) => [q.id, quotationLabel(q, i)])
    );

    const turn = pr.status === "In Review" ? getCurrentTurn(pr, signers) : null;
    const isMyTurn = !!turn && turn.userId === user.id;

    const vendorName = vendorsById[pr.vendor?.[0]]?.vendorName || "—";
    const lineLabel = linesById[pr.line?.[0]]?.lineLabel || "—";
    // Job is a Lookup through Line -> Lines.Job (itself a link field), so
    // pr.job is a raw Job record ID, not display text — resolve it the
    // same way as Vendor/Line above.
    const job = jobsById[pr.job?.[0]];
    const jobDisplay = job ? `${job.jobCode} — ${job.jobName}` : "—";
    const requesterName = usersById[pr.requester?.[0]]?.userName || "—";

    // Read-only trail of the full signing chain (issue #9): every source
    // table already existed (PR Signers.Signed At, Correction Requests,
    // Edit Log) — this just merges them into one chronological timeline
    // instead of leaving them as three disconnected lists a reader would
    // have to cross-reference by hand. "Resolved by" isn't a field on
    // Correction Requests, but is always the Sent To person (resolving
    // only ever happens as a side effect of that person's own turn), so
    // that's inferred rather than stored.
    const historyEntries = [
        // Issue #105 — Created At is now a real timestamp (migrated from
        // the old date-only "Created Date"), so it renders with a clock
        // time like every other entry below.
        { at: pr.createdAt, text: `${requesterName} created the PR` },
        ...signers
            .filter((s) => s.signedAt)
            .map((s) => {
                const name = usersById[s.signer?.[0]]?.userName || "Unknown";
                // "Edited" isn't an Approval or Agreement itself (issue
                // #66), so it keeps its own label regardless of
                // confirmationType — only a genuine "Approved" status
                // splits into "approved"/"agreed" by tag.
                const verb =
                    s.status === "Edited"
                        ? "edited and continued"
                        : s.confirmationType === "Agreement"
                          ? "agreed"
                          : "approved";
                return { at: s.signedAt, text: `${name} ${verb} (step ${s.sequenceOrder})` };
            }),
        ...correctionRequests.flatMap((c) => {
            const initiator = usersById[c.initiatedBy?.[0]]?.userName || "Unknown";
            const target = usersById[c.sentTo?.[0]]?.userName || "Unknown";
            const entries = [
                {
                    at: c.requestedAt,
                    text: `${initiator} returned it to ${target} for correction: "${c.notes}"`,
                },
            ];
            if (c.resolvedAt) {
                entries.push({ at: c.resolvedAt, text: `${target} resolved the correction` });
            }
            return entries;
        }),
        ...editLog.map((e) => {
            const name = usersById[e.changedBy?.[0]]?.userName || "Unknown";
            return {
                at: e.changedAt,
                text: `${name} changed ${e.fieldName}: "${e.oldValue}" → "${e.newValue}"${
                    e.notes ? ` (${e.notes})` : ""
                }`,
            };
        }),
        // Issue #122 — the terminal withdrawal event, only ever the
        // Requester's own action (withdrawAction gates on requester + In
        // Review), sorted into the timeline by its Withdrawn At stamp.
        ...(pr.withdrawnAt
            ? [{ at: pr.withdrawnAt, text: `${requesterName} withdrew the PR` }]
            : []),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{pr.prId}</h1>
                {/* Always the unfiltered full list — returning to a filtered
                    list is the back button's job (the filter URL is preserved
                    there), so this link deliberately carries no filter params. */}
                <Link href="/prs" className="text-sm underline">
                    ← All PRs
                </Link>
            </div>

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Amount</p>
                <p className="text-3xl font-semibold">
                    {formatUSD(pr.totalAmount ?? pr.itemsSubtotal)}
                </p>
            </div>

            <div className="mt-4 space-y-1 text-sm">
                <p>
                    Status: <strong>{pr.status}</strong>
                </p>
                <p>Job: {jobDisplay}</p>
                <p>Line: {lineLabel}</p>
                <p>Vendor: {vendorName}</p>
                <p>Requester: {requesterName}</p>
                {pr.notes && <p>Notes: {pr.notes}</p>}
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Items</h2>
                <table className="mt-2 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Item</th>
                            <th className="pr-2">Size</th>
                            <th className="pr-2">Unit</th>
                            <th className="pr-2 text-right">Qty</th>
                            <th className="pr-2 text-right">Unit Price</th>
                            <th className="pr-2 text-right">Amount</th>
                            <th className="pr-2">Remark</th>
                            {/* Issue #67 — only earns its keep with an
                                actual choice among 2+ Quotations; with 0 or
                                1, every item resolves to the same one. */}
                            {quotations.length >= 2 && <th className="pr-2">Quotation</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-2">{it.itemName}</td>
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.unit}</td>
                                <td className="py-1 pr-2 text-right">{it.qty}</td>
                                <td className="py-1 pr-2 text-right">{it.unitPrice}</td>
                                <td className="py-1 pr-2 text-right">{it.amount}</td>
                                <td className="py-1 pr-2">{it.remark}</td>
                                {quotations.length >= 2 && (
                                    <td className="py-1 pr-2">
                                        {quotationLabelsById[it.quotation?.[0]] || "—"}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                    <ItemsSummaryRows
                        itemsSubtotal={pr.itemsSubtotal}
                        shippingFee={pr.shippingFee}
                        totalAmount={pr.totalAmount}
                        labelColSpan={5}
                        trailingColSpan={quotations.length >= 2 ? 2 : 1}
                    />
                </table>
            </div>

            {quotations.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-lg font-semibold">Quotations</h2>
                    <ul className="mt-2 space-y-1 text-sm">
                        {quotations.map((q) => {
                            // Airtable's own copy of the file — the URL it
                            // returns is a short-lived signed URL (~2
                            // hours, confirmed empirically), not the
                            // original Vercel Blob URL from upload time.
                            // See CLAUDE.md's "Quotation file upload"
                            // section for why this link can go stale on a
                            // page loaded from a bookmark/old tab.
                            const file = q.file?.[0];
                            return (
                                <li key={q.id}>
                                    {file ? (
                                        <a href={file.url} target="_blank" rel="noreferrer" className="underline">
                                            {file.filename || q.quotationId}
                                        </a>
                                    ) : (
                                        q.quotationId
                                    )}
                                    {q.vendorQuotationCode && ` (Vendor code: ${q.vendorQuotationCode})`}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Signers</h2>
                <div className="mt-2">
                    <SignerProgressBar
                        pr={pr}
                        signers={signers}
                        correctionRequests={correctionRequests}
                        po={po}
                        usersById={usersById}
                    />
                </div>
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">History</h2>
                <ol className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {historyEntries.map((entry, i) => (
                        <li key={i}>
                            <span className="text-zinc-400 dark:text-zinc-500">
                                {new Date(entry.at).toLocaleString(undefined, {
                                    year: "numeric",
                                    month: "numeric",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                            </span>{" "}
                            — {entry.text}
                        </li>
                    ))}
                </ol>
            </div>

            {(pr.status === "Approved" || pr.status === "PO Signed") && (
                <div className="mt-8">
                    <h2 className="text-lg font-semibold">Purchase Order</h2>
                    {po ? (
                        <p className="mt-2 text-sm">
                            <a href={`/pos/${po.poId}`} className="underline">
                                {po.poId}
                            </a>{" "}
                            — <strong>{po.status}</strong>
                        </p>
                    ) : (
                        <div className="mt-2 space-y-2">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                PO generation hasn&apos;t completed yet for this PR.
                            </p>
                            <GeneratePOForm prId={pr.prId} />
                        </div>
                    )}
                </div>
            )}

            {pr.status === "In Review" && (
                <div className="mt-8">
                    {isMyTurn ? (
                        <SigningPanel
                            prId={pr.prId}
                            turn={turn}
                            items={items}
                            quotations={quotations}
                            shippingFee={pr.shippingFee}
                            returnTargets={
                                turn.type === "signer" ? getReturnTargets(pr, signers, turn.sequenceOrder) : []
                            }
                            usersById={usersById}
                            confirmationType={
                                turn.type === "signer"
                                    ? signers.find((s) => s.id === turn.prSignerRecordId)?.confirmationType
                                    : null
                            }
                        />
                    ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Waiting on {turn ? usersById[turn.userId]?.userName || "someone" : "someone"} to
                            act.
                        </p>
                    )}
                </div>
            )}

            {/* Issue #122 — the Requester can withdraw their own PR while it's
                still in review, independent of whose turn it currently is (so
                this sits outside the turn-gated SigningPanel above). Allowed
                only from In Review this pass; requester-only, re-checked
                server-side in withdrawAction regardless of this gate. */}
            {pr.status === "In Review" && pr.requester?.[0] === user.id && (
                <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <WithdrawPRForm prId={pr.prId} />
                </div>
            )}
        </div>
    );
}

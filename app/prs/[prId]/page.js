import { requireUser } from "@/lib/authz";
import { getPRById } from "@/lib/airtable/purchaseRequests";
import { getSignersByPR } from "@/lib/airtable/prSigners";
import { getItemsByPR } from "@/lib/airtable/prItems";
import { getCorrectionRequestsByPR } from "@/lib/airtable/correctionRequests";
import { getUserByRecordId } from "@/lib/airtable/users";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllLines } from "@/lib/airtable/lines";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getCurrentTurn, getReturnTargets } from "@/lib/prSigning";
import SigningPanel from "./SigningPanel";

const DONE_MESSAGES = {
    approved: "Recorded your approval.",
    edited: "Saved your changes.",
    returned: "Sent back for correction.",
};

export default async function PRDetailPage({ params, searchParams }) {
    const user = await requireUser();
    const { prId } = await params;
    const { done } = await searchParams;

    const pr = await getPRById(prId);
    if (!pr) {
        return <div className="p-8">PR not found.</div>;
    }

    const [signers, items, vendors, lines, jobs] = await Promise.all([
        getSignersByPR(pr.id),
        getItemsByPR(pr.id),
        getAllVendors(),
        getAllLines(),
        getAllJobs(),
    ]);

    const userIds = new Set(
        [pr.requester?.[0], ...signers.map((s) => s.signer?.[0])].filter(Boolean)
    );
    const userList = await Promise.all([...userIds].map((id) => getUserByRecordId(id)));
    const usersById = Object.fromEntries(userList.filter(Boolean).map((u) => [u.id, u]));

    const vendorsById = Object.fromEntries(vendors.map((v) => [v.id, v]));
    const linesById = Object.fromEntries(lines.map((l) => [l.id, l]));
    const jobsById = Object.fromEntries(jobs.map((j) => [j.id, j]));

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

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">{pr.prId}</h1>

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            <div className="mt-4 space-y-1 text-sm">
                <p>
                    Status: <strong>{pr.status}</strong>
                </p>
                <p>Job: {jobDisplay}</p>
                <p>Line: {lineLabel}</p>
                <p>Vendor: {vendorName}</p>
                <p>Requester: {requesterName}</p>
                {pr.notes && <p>Notes: {pr.notes}</p>}
                <p>Total Amount: {pr.totalAmount ?? 0}</p>
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
                            <th className="pr-2 text-right">Rate</th>
                            <th className="pr-2 text-right">Amount</th>
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-2">{it.itemName}</td>
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.unit}</td>
                                <td className="py-1 pr-2 text-right">{it.qty}</td>
                                <td className="py-1 pr-2 text-right">{it.rate}</td>
                                <td className="py-1 pr-2 text-right">{it.amount}</td>
                                <td className="py-1 pr-2">{it.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Signers</h2>
                <ol className="mt-2 space-y-1 text-sm">
                    {pr.status === "In Review" && pr.currentSignerStep === 0 && (
                        <li className="font-medium">Requester ({requesterName}) ← current</li>
                    )}
                    {signers
                        .slice()
                        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                        .map((s) => {
                            const u = usersById[s.signer?.[0]];
                            const isCurrent =
                                pr.status === "In Review" && pr.currentSignerStep === s.sequenceOrder;
                            return (
                                <li key={s.id} className={isCurrent ? "font-medium" : ""}>
                                    {s.sequenceOrder}. {u?.userName || "Unknown"} ({u?.role}) — {s.status}
                                    {isCurrent ? " ← current" : ""}
                                </li>
                            );
                        })}
                </ol>
            </div>

            {pr.status === "In Review" && (
                <div className="mt-8">
                    {isMyTurn ? (
                        <SigningPanel
                            prId={pr.prId}
                            turn={turn}
                            items={items}
                            returnTargets={
                                turn.type === "signer" ? getReturnTargets(pr, signers, turn.sequenceOrder) : []
                            }
                            usersById={usersById}
                        />
                    ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Waiting on {turn ? usersById[turn.userId]?.userName || "someone" : "someone"} to
                            act.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

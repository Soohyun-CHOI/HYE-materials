import { Fragment } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { canViewPR } from "@/lib/prVisibility";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getInvoicingStatusByPO, getItemsByPO } from "@/lib/airtable/poItems";
import { getItemsByPOItem } from "@/lib/airtable/invoiceItems";
import { getInvoiceByRecordId } from "@/lib/airtable/invoices";
import { getPRByRecordId } from "@/lib/airtable/purchaseRequests";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import { formatUSD } from "@/lib/format";
import { describeOverageBanner } from "@/lib/overage";
import { getOverageBannerFactsForPO } from "@/lib/overagePR";
import ItemsSummaryRows from "@/app/components/ItemsSummaryRows";
import {
    getPOWithdrawEligibility,
    getWithdrawCopy,
    isPOWithdrawn,
    WITHDRAW_REFUSAL,
} from "@/lib/poWithdraw";
import SignForm from "./SignForm";
import RegeneratePDFForm from "./RegeneratePDFForm";
import WithdrawPOForm from "./WithdrawPOForm";

const DONE_MESSAGES = {
    signed: "Signed the PO.",
    "pdf-regenerated": "Regenerated the PDF.",
    withdrawn: "Withdrew this PO.",
};

// Viewing is row-scoped (issue #132): President/Admin see every PO; any other
// active user sees a PO only for a PR they raised or on their assigned Job —
// the same rule as the PR list (#119), shared via canViewPR. Invoice-derived
// data (Invoiced/Uninvoiced + the per-item invoice-line breakdown) and the
// sign/regenerate write controls stay President/Admin-only; the PO PDF is
// visible to everyone who can see the PO (site staff place the order from it).
export default async function PODetailPage({ params, searchParams }) {
    const user = await requireUser();
    const isPrivileged = user.role === "President" || user.isAdmin === true;
    const { poId } = await params;
    const { done } = await searchParams;

    const po = await getPOById(poId);
    if (!po) {
        return <div className="p-8">PO not found.</div>;
    }

    // Purchase Orders.Vendor is a Lookup through PR -> Purchase Requests.
    // Vendor, itself a link field (confirmed via Airtable's field config
    // during #10's design) — po.vendor is a raw Vendor record ID, not
    // display text, same gotcha as Purchase Requests.Job. Resolve via the
    // PR chain instead of trusting the Lookup's raw value. This PR is also
    // what the visibility gate reads (requester + Job), so it's fetched
    // before the gate — no extra query.
    const pr = await getPRByRecordId(po.pr[0]);

    // A PO the viewer isn't entitled to reads as not-found, not a role-style
    // "not authorized": never confirm a PO exists for a PR/Job outside their
    // scope. Server-side — the security boundary, not a hidden link.
    if (!canViewPR(user, pr)) {
        return <div className="p-8">PO not found.</div>;
    }

    // Issue #138 — withdrawal is the requester's own action (the requester of
    // the parent PR; a PO carries no requester of its own, and needs none).
    // Eligibility comes from the one shared predicate, and the same
    // president-signature branch drives both the modal wording and the
    // banner below, resolved once here.
    const isRequester = pr.requester?.[0] === user.id;
    const withdrawn = isPOWithdrawn(po);
    const withdrawCopy = getWithdrawCopy(po.presidentSigned);
    const withdrawEligibility = isRequester ? getPOWithdrawEligibility(po) : null;

    const [job, vendor, ourPic, ourManager] = await Promise.all([
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
        pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        po.ourPic?.[0] ? getUserByRecordId(po.ourPic[0]) : null,
        po.ourManager?.[0] ? getUserByRecordId(po.ourManager[0]) : null,
    ]);

    // Invoiced/Uninvoiced (#48) and the per-item invoice-line breakdown (#15)
    // are invoice-derived. The invoice pages are President/Admin-only (route
    // protection), so a plain employee viewing their own PO must not obtain
    // that data through this page. Non-privileged viewers fetch plain PO Items
    // only; the invoice fetches below never run, so the data never leaves
    // Airtable — a server-side omission, not a client-side hide.
    let itemsWithInvoiceLines;
    let invoiceByRecordId = new Map();
    if (isPrivileged) {
        const items = await getInvoicingStatusByPO(po.id);
        itemsWithInvoiceLines = await Promise.all(
            items.map(async (it) => ({
                ...it,
                invoiceLines: await getItemsByPOItem(it.id),
            }))
        );
        const invoiceRecordIds = [
            ...new Set(
                itemsWithInvoiceLines.flatMap((it) =>
                    it.invoiceLines.map((line) => line.invoice?.[0]).filter(Boolean)
                )
            ),
        ];
        const invoiceRecords = await Promise.all(invoiceRecordIds.map((id) => getInvoiceByRecordId(id)));
        invoiceByRecordId = new Map(invoiceRecords.map((inv) => [inv.id, inv]));
    } else {
        const items = await getItemsByPO(po.id);
        itemsWithInvoiceLines = items.map((it) => ({ ...it, invoiceLines: [] }));
    }

    // Issue #167 — the overage banner, from whichever side this order is on: its own
    // PR is the correction, or one of its ordered items is where an excess came from.
    // The second case reads the PO Items' own provenance reverse-link rather than
    // walking the shared Delivery, so an arrival that filled two orders cannot put
    // the banner on the one that was not exceeded. Delivery data either way, so it is
    // not withheld from a non-privileged viewer — but the invoice it names IS invoice
    // data, and that is the same narrowing the delivery page makes deliberately
    // (see createOverageDraftAction).
    const overageBanners = await getOverageBannerFactsForPO(po, itemsWithInvoiceLines);

    const pdfFile = po.poPdfFile?.[0];

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">{po.poId}</h1>


            {/* Issue #167 — the overage banner. EVERY WORD OF IT IS DERIVED from
                Delivery Items."Overage PR" and its provenance link, so nothing about
                a correction is stored as state: withdrawing the request reopens the
                row on its own, and a settled one is told apart from "the order
                exists but the excess never moved" by the flag alone.

                IT STAYS AFTER SIGNATURE, which is the point rather than an
                oversight. An overage order read on its own looks like a duplicate
                with no quotation of its own, and the invoice attached to it also
                bills the original order — so a payment against that invoice matches
                neither order's total alone, and whoever reconciles it needs telling
                exactly once, here. */}
            {overageBanners.map((banner) =>
                describeOverageBanner({ site: banner.site, state: banner.state, facts: banner.facts }).map(
                    (m) => (
                        <p
                            key={`${banner.rowId}-${m.key}`}
                            className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        >
                            {m.text}
                        </p>
                    )
                )
            )}

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            {/* Issue #138 — the terminal state, stated to whoever opens the
                page rather than to whoever acted: third person, past tense,
                paired in lib/poWithdraw.js with the second-person modal
                wording so the two can't drift. Sits above the money and the
                items, since "this order was called off" changes how every
                figure below it should be read. */}
            {withdrawn && (
                <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                    <p>{withdrawCopy.banner}</p>
                    {po.withdrawnAt && (
                        <p className="mt-1 text-xs">
                            Withdrawn at {new Date(po.withdrawnAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Amount</p>
                <p className="text-3xl font-semibold">
                    {formatUSD(po.totalAmount ?? po.itemsSubtotal)}
                </p>
            </div>

            <div className="mt-4 space-y-1 text-sm">
                <p>
                    Status: <strong>{po.status}</strong>
                </p>
                <p>PR: {pr.prId}</p>
                <p>Job: {job ? `${job.jobCode} — ${job.jobName}` : "—"}</p>
                <p>Vendor: {vendor?.vendorName || "—"}</p>
                <p>Our PIC: {ourPic?.userName || "—"}</p>
                <p>Our Manager: {ourManager?.userName || "—"}</p>
                {/* Internal-only field (CLAUDE.md) — Primary/Alternate tracking,
                    not shown to non-privileged viewers (#132). */}
                {isPrivileged && <p>Delivery Address Used: {po.deliveryAddressUsed || "—"}</p>}
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
                            {/* Invoice-derived (#48) — President/Admin only (#132). */}
                            {isPrivileged && <th className="pr-2 text-right">Invoiced</th>}
                            {isPrivileged && <th className="pr-2 text-right">Uninvoiced</th>}
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsWithInvoiceLines.map((it) => (
                            <Fragment key={it.id}>
                                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                                    <td className="py-1 pr-2">{it.itemName}</td>
                                    <td className="py-1 pr-2">{it.size}</td>
                                    <td className="py-1 pr-2">{it.unit}</td>
                                    <td className="py-1 pr-2 text-right">{it.qty}</td>
                                    <td className="py-1 pr-2 text-right">{it.unitPrice}</td>
                                    <td className="py-1 pr-2 text-right">{it.amount}</td>
                                    {isPrivileged && (
                                        <td className="py-1 pr-2 text-right">{it.invoicedQty}</td>
                                    )}
                                    {isPrivileged && (
                                        <td
                                            className={
                                                it.uninvoicedQty < 0
                                                    ? "py-1 pr-2 text-right text-red-600"
                                                    : "py-1 pr-2 text-right"
                                            }
                                        >
                                            {it.uninvoicedQty}
                                            {it.uninvoicedQty < 0 && " (over)"}
                                        </td>
                                    )}
                                    <td className="py-1 pr-2">{it.remark}</td>
                                </tr>
                                {it.invoiceLines.length > 0 && (
                                    <tr className="border-t border-dashed border-zinc-200 dark:border-zinc-800">
                                        <td colSpan={9} className="py-1 pl-4 text-xs text-zinc-500">
                                            <ul className="space-y-0.5">
                                                {it.invoiceLines.map((line) => {
                                                    const parentInvoice = invoiceByRecordId.get(line.invoice?.[0]);
                                                    return (
                                                        <li key={line.id}>
                                                            {parentInvoice?.invoiceId ? (
                                                                <Link
                                                                    href={`/invoices/${parentInvoice.invoiceId}`}
                                                                    className="underline"
                                                                >
                                                                    {parentInvoice.invoiceId}
                                                                </Link>
                                                            ) : (
                                                                "—"
                                                            )}
                                                            : Qty {line.qty} @ {line.unitPrice}
                                                            {line.varianceFlag && (
                                                                <span className="ml-1 rounded bg-red-100 px-1 text-red-700 dark:bg-red-950 dark:text-red-400">
                                                                    ⚠ Line Variance
                                                                </span>
                                                            )}
                                                            {parentInvoice?.varianceFlag && (
                                                                <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                                                    ⚠ Header Variance
                                                                </span>
                                                            )}
                                                            {parentInvoice?.paid ? (
                                                                <span className="ml-1 rounded bg-green-100 px-1 text-green-700 dark:bg-green-950 dark:text-green-400">
                                                                    ✓ Paid {parentInvoice.paidDate || ""}
                                                                </span>
                                                            ) : (
                                                                <span className="ml-1 rounded bg-zinc-100 px-1 text-zinc-500 dark:bg-zinc-900">
                                                                    Not paid
                                                                </span>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                    {/* Trailing columns after Amount: privileged has
                        Invoiced + Uninvoiced + Remark (3); non-privileged has
                        only Remark (1). */}
                    <ItemsSummaryRows
                        itemsSubtotal={po.itemsSubtotal}
                        shippingFee={po.shippingFee}
                        totalAmount={po.totalAmount}
                        labelColSpan={5}
                        trailingColSpan={isPrivileged ? 3 : 1}
                    />
                </table>
                <p className="mt-2 text-xs text-zinc-500">
                    Shipping Fee is a frozen copy from the PR — compare against each invoice&apos;s
                    own Shipping Fee at reconciliation time.
                </p>
            </div>

            {/* Signing/regeneration are President-only write actions, so those
                controls render only for privileged viewers. The PO PDF itself
                is visible to everyone who can see the PO (#132) — site staff
                place the order from it — so the download link is outside the
                privileged gate. */}
            <div className="mt-8">
                {po.presidentSigned ? (
                    <div className="space-y-2 text-sm">
                        <p>
                            Signed at {po.presidentSignedAt ? new Date(po.presidentSignedAt).toLocaleString() : "—"}
                        </p>
                        {/* Issue #138 — an already-generated PDF stays
                            downloadable on a withdrawn PO: the PO did exist
                            and was signed, so that document is audit trail.
                            Only *new* documents are refused — the
                            regeneration control disappears (and
                            regeneratePDFAction refuses it regardless of what
                            renders here). */}
                        {pdfFile ? (
                            <a href={pdfFile.url} target="_blank" rel="noreferrer" className="underline">
                                {pdfFile.filename || "PO PDF"}
                            </a>
                        ) : withdrawn ? (
                            <p className="text-zinc-600 dark:text-zinc-400">
                                No PO document is on file, and none will be generated now that this PO is
                                withdrawn.
                            </p>
                        ) : isPrivileged ? (
                            <div className="space-y-2">
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    PDF generation hasn&apos;t completed yet for this PO.
                                </p>
                                <RegeneratePDFForm poId={po.poId} />
                            </div>
                        ) : (
                            <p className="text-zinc-600 dark:text-zinc-400">
                                The PO document isn&apos;t available yet.
                            </p>
                        )}
                    </div>
                ) : withdrawn ? (
                    /* Issue #138 — no SignForm for a withdrawn PO: signing
                       would write Status back to "Signed" and resurrect it.
                       signPOAction refuses it too, this just doesn't offer a
                       button that can only fail. */
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        This PO was never signed.
                    </p>
                ) : isPrivileged ? (
                    <SignForm poId={po.poId} />
                ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        This PO hasn&apos;t been signed yet.
                    </p>
                )}
            </div>

            {/* Issue #138 — the requester's own control, so it sits OUTSIDE
                the isPrivileged gate above (site staff place the vendor order
                and are the ones who decide not to; they're typically neither
                President nor Admin). Both refusals come from the one shared
                predicate: a wrong status renders nothing at all (there is
                nothing the requester can do from a status outside the
                withdrawable list, and promising a path that doesn't exist is
                worse than silence),
                while a linked invoice explains what would have to happen
                first rather than showing a dead control. Re-validated in
                withdrawPOAction regardless of this gate. */}
            {isRequester && withdrawEligibility.reason !== "wrong-status" && (
                <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    {withdrawEligibility.eligible ? (
                        <WithdrawPOForm
                            poId={po.poId}
                            title={withdrawCopy.modal.title}
                            body={withdrawCopy.modal.body(po.poId)}
                        />
                    ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {WITHDRAW_REFUSAL["invoice-linked"]}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

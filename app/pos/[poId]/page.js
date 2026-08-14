import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { canViewPR } from "@/lib/prVisibility";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getInvoicingStatusByPO, getItemsByPO } from "@/lib/airtable/poItems";
import { getInvoiceItemsByRecordIds } from "@/lib/airtable/invoiceItems";
import { getInvoicesByRecordIds } from "@/lib/airtable/invoices";
import { getDeliveryItemsByRecordIds } from "@/lib/airtable/deliveryItems";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import {
    PO_DOCUMENTS_COPY,
    foldDeliveriesOnOrder,
    foldInvoicesOnOrder,
} from "@/lib/poDocuments";
import { getPRByRecordId } from "@/lib/airtable/purchaseRequests";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import { formatUSD } from "@/lib/format";
import { describeOverageBanner } from "@/lib/overage";
import { getOverageBannerFactsForPO } from "@/lib/overagePR";
import { undeliveredQty } from "@/lib/deliveryAllocation";
import { withOpsLabel } from "@/lib/airtableOps";
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

// The route param IS the human-readable ID, so the tab names the record for
// ZERO Airtable operations (#201) — this reads the URL and nothing else.
export async function generateMetadata({ params }) {
    const { poId } = await params;
    return { title: poId };
}

const DONE_MESSAGES = {
    signed: "Signed the PO.",
    "pdf-regenerated": "Regenerated the PDF.",
    withdrawn: "Withdrew this PO.",
};

// Labeled for #190, the way #200 labeled /pos and app/prs/page.js labels /prs.
// An outer wrapper, so the page's own body keeps its indentation, and the route
// TEMPLATE, so repeated loads aggregate into one row rather than forty. #169
// added it because this page's cost was unmeasurable without it: the counter
// writes a per-scope record only for a labeled render, so an unlabeled page
// contributes to the process total and to nothing a reader can attribute.
export default async function PODetailPage(props) {
    return withOpsLabel("/pos/[poId]", () => renderPODetailPage(props));
}

// Viewing is row-scoped (issue #132): President/Admin see every PO; any other
// active user sees a PO only for a PR they raised or on their assigned Job —
// the same rule as the PR list (#119), shared via canViewPR. Invoice-derived
// data (Invoiced/Uninvoiced + the per-item invoice-item breakdown) and the
// sign/regenerate write controls stay President/Admin-only; the PO PDF is
// visible to everyone who can see the PO (site staff place the order from it).
// Delivered/Undelivered are NOT in that set (#169): delivery-derived, so every
// viewer who can see the order sees them.
async function renderPODetailPage({ params, searchParams }) {
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

    // Invoiced/Uninvoiced (#48) and the invoices charging this order (#15, #233)
    // are invoice-derived. The invoice pages were President/Admin-only when that
    // line was drawn, so a plain employee viewing their own PO must not obtain
    // that data through this page. Non-privileged viewers fetch plain PO Items
    // only; the invoice fetches below never run, so the data never leaves
    // Airtable — a server-side omission, not a client-side hide.
    //
    // #211 MOVED THE LINE THIS RESTS ON AND THIS PAGE HAS NOT FOLLOWED, which is
    // recorded rather than quietly kept: lib/airtable/poItems.js says that issue
    // retired the President-or-Admin gate on the reconciliation projection because
    // what a vendor billed is readable by anyone who may read the order behind it,
    // and left `Paid` as the narrower replacement. So this gate now withholds MORE
    // than the rule requires. Over-withholding is the safe direction, and widening
    // it is a decision about who sees an order's billing rather than a consequence
    // of a layout change — docs/notes/backlog.md carries it.
    const orderedItems = isPrivileged
        ? await getInvoicingStatusByPO(po.id)
        : await getItemsByPO(po.id);

    // #233 — the deliveries that filled this order. TWO BATCHED READS for the whole
    // page: the ordered items already carry their `Delivery Items` ids, so this is
    // one query per 50 rows and none per row. Delivery-derived, so every viewer who
    // can see the order sees them — #169's line, unchanged.
    const deliveryItems = await getDeliveryItemsByRecordIds([
        ...new Set(orderedItems.flatMap((it) => it.deliveryItems || [])),
    ]);
    const deliveries = await getDeliveriesByRecordIds([
        ...new Set(deliveryItems.map((d) => d.delivery?.[0]).filter(Boolean)),
    ]);
    const deliveriesOnOrder = foldDeliveriesOnOrder({ orderedItems, deliveryItems, deliveries });

    // #233 — and the invoices charging it, two more batched reads and only for the
    // office. This replaces one `getItemsByPOItem` per ordered item plus one
    // `getInvoiceByRecordId` per invoice: both were `getLinkedRecords`' 1 + N, the
    // shape docs/notes/airtable-access.md measured on this page and left for #191.
    // An empty id list costs nothing — findByRecordIds returns early — so an order
    // nothing has billed pays for neither level.
    let invoicesOnOrder = [];
    if (isPrivileged) {
        const invoiceItems = await getInvoiceItemsByRecordIds([
            ...new Set(orderedItems.flatMap((it) => it.invoiceItems || [])),
        ]);
        const invoices = await getInvoicesByRecordIds([
            ...new Set(invoiceItems.map((i) => i.invoice?.[0]).filter(Boolean)),
        ]);
        invoicesOnOrder = foldInvoicesOnOrder({ orderedItems, invoiceItems, invoices });
    }

    // Issue #167 — the overage banner, from whichever side this order is on: its own
    // PR is the correction, or one of its ordered items is where an excess came from.
    // The second case reads the PO Items' own provenance reverse-link rather than
    // walking the shared Delivery, so an arrival that filled two orders cannot put
    // the banner on the one that was not exceeded. Delivery data either way, so it is
    // not withheld from a non-privileged viewer — but the invoice it names IS invoice
    // data, and that is the same narrowing the delivery page makes deliberately
    // (see createOverageDraftAction).
    const overageBanners = await getOverageBannerFactsForPO(po, orderedItems);

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
                describeOverageBanner({
                    site: banner.site,
                    state: banner.state,
                    facts: banner.facts,
                    noLongerOverDelivered: banner.noLongerOverDelivered,
                }).map(
                    (m) => (
                        <p
                            key={`${banner.rowId}-${m.key}`}
                            className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
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
                <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <p>{withdrawCopy.banner}</p>
                    {po.withdrawnAt && (
                        <p className="mt-1 text-xs">
                            Withdrawn at {new Date(po.withdrawnAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
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
                            {/* Delivery-derived (#169), so EVERY viewer who can see
                                the order sees these — the same category as the
                                `Material` link and #167's provenance reverse-link,
                                and the reason recordToPOItem now carries
                                `Delivered Qty`. They sit before the invoice pair so
                                a non-privileged viewer's columns stay contiguous. */}
                            <th className="pr-2 text-right">Delivered</th>
                            <th className="pr-2 text-right">Undelivered</th>
                            {/* Invoice-derived (#48) — President/Admin only (#132). */}
                            {isPrivileged && <th className="pr-2 text-right">Invoiced</th>}
                            {isPrivileged && <th className="pr-2 text-right">Uninvoiced</th>}
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orderedItems.map((it) => (
                                <tr key={it.id} className="border-t border-zinc-200">
                                    <td className="py-1 pr-2">{it.itemName}</td>
                                    <td className="py-1 pr-2">{it.size}</td>
                                    <td className="py-1 pr-2">{it.unit}</td>
                                    <td className="py-1 pr-2 text-right">{it.qty}</td>
                                    <td className="py-1 pr-2 text-right">{it.unitPrice}</td>
                                    <td className="py-1 pr-2 text-right">{it.amount}</td>
                                    <td className="py-1 pr-2 text-right">{it.deliveredQty ?? 0}</td>
                                    {/* NEGATIVE IS TREATED EXACTLY AS Uninvoiced
                                        TREATS IT, two columns to the right: red,
                                        with `(over)`. The two perform the same
                                        subtraction against the same `Qty` and a
                                        negative means the same thing in both — more
                                        arrived, or more was billed, than was
                                        ordered. Signaling differently for one sign
                                        would imply a distinction neither column
                                        makes, and `(over)` is this base's own word
                                        for it (`Delivery Items."Over Delivered"`). */}
                                    <td
                                        className={
                                            undeliveredQty({ qty: it.qty, deliveredQty: it.deliveredQty }) < 0
                                                ? "py-1 pr-2 text-right text-red-600"
                                                : "py-1 pr-2 text-right"
                                        }
                                    >
                                        {undeliveredQty({ qty: it.qty, deliveredQty: it.deliveredQty })}
                                        {undeliveredQty({ qty: it.qty, deliveredQty: it.deliveredQty }) < 0 && " (over)"}
                                    </td>
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
                        ))}
                    </tbody>
                    {/* Trailing columns after Amount: privileged has Delivered +
                        Undelivered + Invoiced + Uninvoiced + Remark (5);
                        non-privileged has Delivered + Undelivered + Remark (3).
                        The enumeration said 3 and 1 until #233 — #169 put its two
                        columns to the left of Invoiced and moved the VALUES from 3
                        and 1 without moving the list that explains them.

                        #233 RETIRED THE THIRD OF #169's HAND-COUNTED CONSTANTS.
                        The invoice breakdown row that carried `colSpan={11}` is
                        gone with the per-row placement; the header cells and this
                        pair keep their values, since no column changed. */}
                    <ItemsSummaryRows
                        itemsSubtotal={po.itemsSubtotal}
                        shippingFee={po.shippingFee}
                        totalAmount={po.totalAmount}
                        labelColSpan={5}
                        trailingColSpan={isPrivileged ? 5 : 3}
                    />
                </table>
                <p className="mt-2 text-xs text-zinc-500">
                    Shipping Fee is a frozen copy from the PR — compare against each invoice&apos;s
                    own Shipping Fee at reconciliation time.
                </p>
            </div>

            {/* #233 — THE DOCUMENTS THIS ORDER'S TABLE WAS ALREADY COUNTING, each
                named once. Deliveries first, matching the column order above, where
                #169 put the delivery pair before the invoice pair.

                BOTH SECTIONS ALWAYS RENDER FOR A VIEWER ENTITLED TO THEM, empty or
                not: this is the page a reader comes to in order to reconcile, so an
                absent section cannot be told apart from a section that found
                nothing. #210 made the same call on the delivery detail — empty is a
                reading, and the sentence says which.

                THE INVOICE SECTION IS ABSENT ENTIRELY for a non-privileged viewer
                rather than empty, because "nothing has billed this order" is itself
                invoice information. Same server-side omission as the columns. */}
            <div className="mt-6">
                <h2 className="text-lg font-semibold">{PO_DOCUMENTS_COPY.deliveries.heading}</h2>
                {deliveriesOnOrder.length === 0 ? (
                    <p className="mt-1 text-sm text-zinc-600">
                        {PO_DOCUMENTS_COPY.deliveries.empty().text}
                    </p>
                ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                        {deliveriesOnOrder.map((d) => (
                            <li key={d.deliveryRecordId}>
                                <p className="flex flex-wrap items-center gap-x-2">
                                    {d.deliveryId ? (
                                        <Link
                                            href={`/deliveries/${encodeURIComponent(d.deliveryId)}`}
                                            className="underline"
                                        >
                                            {d.deliveryId}
                                        </Link>
                                    ) : (
                                        "—"
                                    )}
                                    <span className="text-zinc-500">{d.receivedDate || "—"}</span>
                                    {d.overDelivered && (
                                        <span className="rounded bg-amber-100 px-1 text-xs text-amber-700">
                                            {PO_DOCUMENTS_COPY.badge.overDelivered}
                                        </span>
                                    )}
                                </p>
                                <ul className="mt-0.5 pl-4 text-xs text-zinc-500">
                                    {d.brought.map((b) => (
                                        <li key={b.orderedItemRecordId}>
                                            {PO_DOCUMENTS_COPY.deliveries.brought(b).text}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {isPrivileged && (
                <div className="mt-6">
                    <h2 className="text-lg font-semibold">{PO_DOCUMENTS_COPY.invoices.heading}</h2>
                    {invoicesOnOrder.length === 0 ? (
                        <p className="mt-1 text-sm text-zinc-600">
                            {PO_DOCUMENTS_COPY.invoices.empty().text}
                        </p>
                    ) : (
                        <ul className="mt-2 space-y-2 text-sm">
                            {invoicesOnOrder.map((inv) => (
                                <li key={inv.invoiceRecordId}>
                                    <p className="flex flex-wrap items-center gap-x-2">
                                        {inv.invoiceId ? (
                                            <Link
                                                href={`/invoices/${encodeURIComponent(inv.invoiceId)}`}
                                                className="underline"
                                            >
                                                {inv.invoiceId}
                                            </Link>
                                        ) : (
                                            "—"
                                        )}
                                        {inv.vendorInvoiceCode && (
                                            <span className="text-zinc-500">{inv.vendorInvoiceCode}</span>
                                        )}
                                        <span className="text-zinc-500">{inv.issueDate || "—"}</span>
                                        {inv.varianceFlag && (
                                            <span className="rounded bg-amber-100 px-1 text-xs text-amber-700">
                                                {PO_DOCUMENTS_COPY.badge.totalVariance}
                                            </span>
                                        )}
                                        {/* Payment is President-or-Admin (#211), which
                                            this whole section already is. If the gate
                                            above ever widens, this badge does NOT go
                                            with it — see the header of this file. */}
                                        {inv.paid ? (
                                            <span className="rounded bg-green-100 px-1 text-xs text-green-700">
                                                {PO_DOCUMENTS_COPY.badge.paid(inv)}
                                            </span>
                                        ) : (
                                            <span className="rounded bg-zinc-100 px-1 text-xs text-zinc-500">
                                                {PO_DOCUMENTS_COPY.badge.notPaid}
                                            </span>
                                        )}
                                    </p>
                                    <ul className="mt-0.5 pl-4 text-xs text-zinc-500">
                                        {inv.charges.map((c) => (
                                            <li key={c.orderedItemRecordId}>
                                                {PO_DOCUMENTS_COPY.invoices.charge(c).text}
                                                {c.varianceFlag && (
                                                    <span className="ml-1 rounded bg-red-100 px-1 text-red-700">
                                                        {PO_DOCUMENTS_COPY.badge.itemVariance}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

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
                            <p className="text-zinc-600">
                                No PO document is on file, and none will be generated now that this PO is
                                withdrawn.
                            </p>
                        ) : isPrivileged ? (
                            <div className="space-y-2">
                                <p className="text-zinc-600">
                                    PDF generation hasn&apos;t completed yet for this PO.
                                </p>
                                <RegeneratePDFForm poId={po.poId} />
                            </div>
                        ) : (
                            <p className="text-zinc-600">
                                The PO document isn&apos;t available yet.
                            </p>
                        )}
                    </div>
                ) : withdrawn ? (
                    /* Issue #138 — no SignForm for a withdrawn PO: signing
                       would write Status back to "Signed" and resurrect it.
                       signPOAction refuses it too, this just doesn't offer a
                       button that can only fail. */
                    <p className="text-sm text-zinc-600">
                        This PO was never signed.
                    </p>
                ) : isPrivileged ? (
                    <SignForm poId={po.poId} />
                ) : (
                    <p className="text-sm text-zinc-600">
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
                <div className="mt-8 border-t border-zinc-200 pt-6">
                    {withdrawEligibility.eligible ? (
                        <WithdrawPOForm
                            poId={po.poId}
                            title={withdrawCopy.modal.title}
                            body={withdrawCopy.modal.body(po.poId)}
                        />
                    ) : (
                        <p className="text-sm text-zinc-600">
                            {WITHDRAW_REFUSAL["invoice-linked"]}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { canViewPR } from "@/lib/prVisibility";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getInvoicingStatusByPO } from "@/lib/airtable/poItems";
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
// #179 — the two variance kinds, named where the predicates that set them live.
import { VARIANCE_COPY } from "@/lib/variance";
import { describeOverageBanner } from "@/lib/overage";
import { getOverageBannerFactsForPO } from "@/lib/overagePR";
// #266 — `overPortion` is the `(N over)` the delivery detail's folded row already
// prints; this page appends that same word to its own folded row rather than
// coining a second one.
import { ALLOCATION_COPY, undeliveredQty } from "@/lib/deliveryAllocation";
import {
    describePOColumn,
    describePOInvoicingColumn,
    summarizePODeliveryStatus,
    summarizePOInvoicingStatus,
} from "@/lib/deliveryStatus";
import { withOpsLabel } from "@/lib/airtableOps";
import ItemsSummaryRows from "@/app/components/ItemsSummaryRows";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import {
    getPOWithdrawEligibility,
    getWithdrawCopy,
    isPOWithdrawn,
    WITHDRAW_REFUSAL,
} from "@/lib/poWithdraw";
import { getPOSendEligibility, SEND_COPY } from "@/lib/poSend";
import SignForm from "./SignForm";
import RegeneratePDFForm from "./RegeneratePDFForm";
import WithdrawPOForm from "./WithdrawPOForm";
import SendToVendorForm from "./SendToVendorForm";

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
    // Issue #281 — the send's own confirmation. Names the vendor rather than the
    // address: the address is on the record right below it, and this line is gone on
    // reload while that one stays.
    sent: "Sent this PO to the vendor.",
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
// the same rule as the PR list (#119), shared via canViewPR. The PO PDF is
// visible to everyone who can see the PO (site staff place the order from it).
//
// THE HAZARD #233 WROTE HERE IS THE ONE #235 WALKED INTO, so this paragraph is
// the record of it happening rather than a warning about it. That issue said
// `Paid` rode on `isPrivileged` with everything else invoice-derived and was the
// one thing to split before the gate was ever widened — the two sharing one flag
// only because the flag had never moved. The gate moved: what a vendor invoiced is
// readable by anyone who may read the order behind it (#211, on
// `getPOItemsForReconciliation`), so the `Invoiced` column, the invoices charging
// this order and the invoicing chip above them are open to every viewer who can
// see the order. `Paid` did not move, and it is on its own flag now.
//
// SO THERE ARE TWO FLAGS AND THEY ARE EQUAL TODAY. `seesPayment` is
// President-or-Admin and gates the payment badge alone. `isOffice` is the same
// people and gates what has nothing to do with invoicing: the internal
// `Delivery Address Used` field (#132) and the sign/regenerate write controls.
// Naming them apart is the whole of the fix #233 asked for — the next issue that
// widens one of them cannot take the other along without saying so.
//
// `Delivered` WAS NEVER IN THAT SET (#169): delivery-derived, so every viewer who
// can see the order sees it — and since #233 so are the deliveries that filled
// the order and the chip above them, on the same line. This said
// `Delivered/Undelivered` until that issue removed the second column.
async function renderPODetailPage({ params, searchParams }) {
    const user = await requireUser();
    // Two names, one predicate — see this file's header on why they are separate.
    const isOffice = user.role === "President" || user.isAdmin === true;
    const seesPayment = user.role === "President" || user.isAdmin === true;
    // Issue #281 — the two write axes, each named for the action it renders. `isOffice`
    // stays for the two READ-side narrowings (the internal address line and payment),
    // which really are President-or-Admin; every write control now matches its own
    // action's gate instead, which is what this page was getting wrong.
    const isPresident = user.role === "President";
    const isAdmin = user.isAdmin === true;
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

    // Issue #281 — `sentBy` joins the three users this page already resolves in one
    // batch, so naming who sent the order costs one more id in a fetch that was
    // happening anyway rather than a read of its own. The vendor is in the same
    // batch, which is why the send control can show the address it would use for
    // nothing: this page has resolved the vendor since #10.
    const [job, vendor, ourPic, ourManager, sentBy] = await Promise.all([
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
        pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        po.ourPic?.[0] ? getUserByRecordId(po.ourPic[0]) : null,
        po.ourManager?.[0] ? getUserByRecordId(po.ourManager[0]) : null,
        po.sentBy?.[0] ? getUserByRecordId(po.sentBy[0]) : null,
    ]);
    const sentByName = sentBy?.userName || null;

    // Issue #281 — resolved once here, for the same reason the withdrawal pair is:
    // the control and its refusal read one answer. The address comes from the vendor
    // this page already loaded, so the `no-address` branch costs nothing.
    const sendEligibility = getPOSendEligibility({ po, vendorEmail: vendor?.picEmail });

    // Invoiced/Uninvoiced (#48) and the invoices charging this order (#15, #233)
    // are invoice-derived. The invoice pages were President/Admin-only when that
    // line was drawn, so a plain employee viewing their own PO must not obtain
    // that data through this page. Non-privileged viewers fetch plain PO Items
    // only; the invoice fetches below never run, so the data never leaves
    // Airtable — a server-side omission, not a client-side hide.
    //
    // #235 FOLLOWED THE LINE #211 MOVED, so there is one projection rather than a
    // branch. This page withheld the invoicing figures from a non-privileged viewer
    // while `getPOItemsForReconciliation` had already stopped being
    // President-or-Admin, on the ground that what a vendor invoiced is readable by
    // anyone who may read the order behind it; the branch was the last of that
    // over-withholding. One call for everyone also means the page cannot come to
    // judge its own chip from two different field sets.
    const orderedItems = await getInvoicingStatusByPO(po.id);

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

    // #169's OWN CHIP, FINALLY CALLED FROM HERE. That issue wrote
    // `summarizePODeliveryStatus` "shared by /pos and /pos/[poId] so the row a
    // reader clicks and the page they land on cannot describe one order
    // differently", and `/pos` says the same about the detail page beside its own
    // call — but this page never imported the module, so both sentences were false
    // for four issues. #233 makes them true rather than deleting them.
    //
    // NO NEW READ ON EITHER PATH. `orderedItemDelivery` wants `orderedQty`,
    // `deliveredQty` and `committedQty`, and `recordToPOItem` carries all three, so
    // the privileged and employee projections both already hold what this needs.
    // The shape below is the one `/pos` builds for the same call.
    const deliveryChip = describePOColumn(
        summarizePODeliveryStatus(
            orderedItems.map((it) => ({
                orderedQty: it.qty,
                deliveredQty: it.deliveredQty,
                committedQty: it.committedQty,
            }))
        )
    );

    // #233 — and the invoices charging it, two more batched reads. This replaces one
    // `getItemsByPOItem` per ordered item plus one
    // `getInvoiceByRecordId` per invoice: both were `getLinkedRecords`' 1 + N, the
    // shape docs/notes/airtable-access.md measured on this page and left for #191.
    // An empty id list costs nothing — findByRecordIds returns early — so an order
    // nothing has invoiced pays for neither level.
    // #235 — FOR EVERY VIEWER NOW. Two batched reads that the employee path did not
    // pay before, which is the measured cost of opening the gate rather than a side
    // effect: an order with nothing invoiced still pays for neither level, since
    // findByRecordIds returns early on an empty id list.
    const invoiceItems = await getInvoiceItemsByRecordIds([
        ...new Set(orderedItems.flatMap((it) => it.invoiceItems || [])),
    ]);
    const invoices = await getInvoicesByRecordIds([
        ...new Set(invoiceItems.map((i) => i.invoice?.[0]).filter(Boolean)),
    ]);
    const invoicesOnOrder = foldInvoicesOnOrder({ orderedItems, invoiceItems, invoices });

    // #235 — the invoicing chip, beside the `Invoices` heading the way #233 put the
    // delivery one beside `Deliveries`. Same shape as `/pos` builds, from the same
    // three fields the ordered items already carry, so it costs no read of its own.
    const invoicingChip = describePOInvoicingColumn(
        summarizePOInvoicingStatus(
            orderedItems.map((it) => ({
                orderedQty: it.qty,
                invoicedQty: it.invoicedQty,
                committedQty: it.committedQty,
            }))
        )
    );

    // Issue #167 — the overage banner, from whichever side this order is on: its own
    // PR is the correction, or one of its ordered items is where an excess came from.
    // The second case reads the PO Items' own provenance reverse-link rather than
    // walking the shared Delivery, so a delivery that filled two orders cannot put
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
                charges the original order — so a payment against that invoice matches
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
                {isOffice && <p>Delivery Address Used: {po.deliveryAddressUsed || "—"}</p>}
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
                                the order sees this — the same category as the
                                `Material` link and #167's provenance reverse-link,
                                and the reason recordToPOItem now carries
                                `Delivered Qty`. It sits before the invoice one so
                                a non-privileged viewer's columns stay contiguous.

                                #233 TOOK `Undelivered` AND `Uninvoiced` OUT. Each
                                was its row's own `Qty` minus the column beside it,
                                so the reader can do the subtraction and the table
                                carries the two figures rather than four. What that
                                could have cost is the over signal, which used to
                                ride on those two cells going negative; it moved to
                                these two rather than going with them. */}
                            <th className="pr-2 text-right">Delivered</th>
                            {/* Invoice-derived (#48), and shown to every viewer who
                                can see the order since #235 — the line #211 drew and
                                this page had not followed.

                                THIS HEAD AND THE CHIP BELOW NOW READ THE SAME WORD,
                                and that is not a collision to fix. `Invoiced` here is
                                a quantity's name; the chip beside `Invoices` is one of
                                a closed set of three. The delivery axis has had the
                                identical pair since #233 — a `Delivered` column under
                                a `Delivered` chip — and the shapes keep them apart. */}
                            <th className="pr-2 text-right">Invoiced</th>
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
                                    {/* #233 — through formatUSD, like the Total
                                        Amount above and the invoice detail's own
                                        items table. This page was the exception. */}
                                    <td className="py-1 pr-2 text-right">{formatUSD(it.unitPrice)}</td>
                                    <td className="py-1 pr-2 text-right">{formatUSD(it.amount)}</td>
                                    {/* THE OVER SIGNAL RODE ON `Undelivered` AND
                                        `Uninvoiced` GOING NEGATIVE, and it moved here
                                        with those columns' removal rather than going
                                        with them (#233) — otherwise an over-delivery
                                        and an over-invoicing would have left the table
                                        entirely, and this is the only place in the
                                        change where information could have been lost.

                                        THE PAIR IS STILL TREATED IDENTICALLY, which
                                        is the rule #169 wrote here: the two perform
                                        the same subtraction against the same `Qty`
                                        and a negative means the same thing in both —
                                        more delivered, or more invoiced, than was
                                        ordered. Signaling differently for one would
                                        imply a distinction neither makes, and
                                        `(over)` is this base's own word for it
                                        (`Delivery Items."Over Delivered"`).

                                        THE PREDICATE IS THE SAME ONE, read off the
                                        named subtraction rather than re-derived as
                                        `delivered > qty` here: `undeliveredQty` and
                                        `uninvoicedQty` own those two figures, and
                                        the column moving is no reason for the page
                                        to acquire a second answer to either. */}
                                    <td
                                        className={
                                            undeliveredQty({ qty: it.qty, deliveredQty: it.deliveredQty }) < 0
                                                ? "py-1 pr-2 text-right text-red-600"
                                                : "py-1 pr-2 text-right"
                                        }
                                    >
                                        {it.deliveredQty ?? 0}
                                        {undeliveredQty({ qty: it.qty, deliveredQty: it.deliveredQty }) < 0 && " (over)"}
                                    </td>
                                    <td
                                        className={
                                            it.uninvoicedQty < 0
                                                ? "py-1 pr-2 text-right text-red-600"
                                                : "py-1 pr-2 text-right"
                                        }
                                    >
                                        {it.invoicedQty}
                                        {it.uninvoicedQty < 0 && " (over)"}
                                    </td>
                                    <td className="py-1 pr-2">{it.remark}</td>
                                </tr>
                        ))}
                    </tbody>
                    {/* Trailing columns after Amount: Delivered + Invoiced +
                        Remark, three for everybody since #235 took the privilege
                        branch off this table. The enumeration said 3 and 1 while the
                        values were 5 and 3 — #169 put its two columns to the left of
                        Invoiced and moved the VALUES without moving the list that
                        explains them, which is how a hand-counted constant rots.

                        #233 TOUCHED ALL THREE OF #169's HAND-COUNTED CONSTANTS.
                        The invoice breakdown row that carried `colSpan={11}` is
                        gone with the per-row placement, the header cells lost
                        `Undelivered` and `Uninvoiced`, and the trailing count
                        went 5 to 3 for a privileged viewer and 3 to 2 for
                        everyone else.

                        #235 THEN REMOVED THE SECOND OF EACH PAIR. There is no
                        privilege branch left in this table — every `th` and
                        every `td` above renders unconditionally — so one count
                        serves both viewers and the table is 9 columns wide for
                        all of them. A wrong value here still misaligns the
                        footer silently and no offline check can see it, so it is
                        counted in a browser; what changed is that there is one
                        number to count rather than two to keep in step.
                        Corrected here per #181 by #260, which found this saying
                        9 and 8. */}
                    <ItemsSummaryRows
                        itemsSubtotal={po.itemsSubtotal}
                        shippingFee={po.shippingFee}
                        totalAmount={po.totalAmount}
                        labelColSpan={5}
                        trailingColSpan={3}
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

                BOTH SECTIONS ALWAYS RENDER, empty or not: this is the page a reader
                comes to in order to reconcile, so an absent section cannot be told
                apart from a section that found nothing. #210 made the same call on
                the delivery detail — empty is a reading, and the sentence says
                which.

                THE INVOICE SECTION WAS ABSENT ENTIRELY FOR A NON-PRIVILEGED VIEWER
                UNTIL #235, on the ground that "nothing has invoiced this order" is
                itself invoice information — the same server-side omission the
                columns above were making. That premise is what #235 overturned:
                what a vendor invoiced is readable by anyone who may read the order
                behind it (#211), so this section now renders for every viewer who
                reaches this page, exactly as those columns now do.

                WHAT SURVIVES OF IT SITS ONE LEVEL DOWN, on the payment badge inside
                this section: a viewer without `seesPayment` reads neither `Paid` nor
                `Not paid`, because there the absence of a badge really is the answer
                to a question they are not being shown. The principle was sound and
                only its subject was wrong, which is why it moved rather than went.
                Corrected here per #181 by #260, in the branch that found it. */}
            <div className="mt-6">
                {/* THE CHIP FOLDS THE TABLE ABOVE, NOT THE LIST BELOW IT, which is
                    the one thing about this placement that could be misread.
                    `summarizePODeliveryStatus` counts ORDERED ITEMS whose delivered
                    quantity has reached what was ordered — the `Delivered` column —
                    and knows nothing about how many documents brought them.

                    IT SITS HERE BECAUSE THE INVOICE DETAIL PUTS ITS CHIP BESIDE THE
                    `Delivery` heading, so the two screens read with one grammar, and
                    because "is it all here" is the question a reader arrives at just
                    before the deliveries themselves. Delivery-derived, so no gate —
                    #169's line, and the same reason the `Delivered` column has none.

                    The tone comes from `describePOColumn` through `StatusChip`, which
                    is presentational only; this page picks no color. */}
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{PO_DOCUMENTS_COPY.deliveries.heading}</h2>
                    <StatusChip chip={deliveryChip} />
                </div>
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
                                {/* ONE ROW PER ORDERED ITEM (#266), which this list
                                    claimed to be while rendering one per stored row.
                                    An over-delivery writes the within piece and the
                                    excess against the SAME ordered item, so one
                                    material delivered once read as two lines and
                                    the ordered item's record id — the key — appeared
                                    twice.

                                    THE FIGURE SAYS WHICH PART, WHICH IS WHY THE FOLD
                                    NEEDS IT. Before the fold this line carried no
                                    over signal at all and needed none: the excess was
                                    a line of its own. Folded, the quantity is the
                                    within piece plus the excess, so without the
                                    figure the fold would quietly absorb the excess
                                    into a total and leave only the document-level
                                    badge, which says neither which item nor how much.

                                    AMBER, NOT THE RED `(over)` IN THE TABLE ABOVE,
                                    and the distinction is by SCOPE rather than by
                                    page. Red there says an ordered item is over —
                                    every delivery counted. This is one delivery's
                                    contribution to one ordered item, the same fact
                                    the badge two lines up carries in amber, and the
                                    same fact #238 prints in amber one frame down.
                                    Coloring the total instead would say the part that
                                    delivered inside the order is a problem too. */}
                                <ul className="mt-0.5 pl-4 text-xs text-zinc-500">
                                    {d.brought.map((b) => (
                                        <li key={b.key}>
                                            {PO_DOCUMENTS_COPY.deliveries.brought(b).text}
                                            {b.overQty > 0 && (
                                                <span className="ml-1 whitespace-nowrap text-amber-700">
                                                    {ALLOCATION_COPY.table.overPortion(b.overQty).text}
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

            {/* #235 — NO LONGER GATED. What a vendor invoiced is readable by anyone who
                may read the order behind it (#211); `Paid` inside is the one thing
                that kept its own line, on `seesPayment`. The chip beside the heading
                is this order's invoicing state, in the placement #233 gave the
                delivery one. */}
            <div className="mt-6">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{PO_DOCUMENTS_COPY.invoices.heading}</h2>
                    <StatusChip chip={invoicingChip} />
                </div>
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
                                            {VARIANCE_COPY.header}
                                        </span>
                                    )}
                                    {/* Payment is President-or-Admin (#211), and it
                                        is the ONLY thing in this section that is.
                                        The gate above widened in #235 and this
                                        badge did not go with it — which is exactly
                                        what this file's header warned would have
                                        to be prevented, so `seesPayment` is its
                                        own flag now. A viewer without it reads
                                        neither word: not `Paid`, not `Not paid`,
                                        since the absence of a payment badge is
                                        itself the answer to a question they are
                                        not being shown. */}
                                    {seesPayment &&
                                        (inv.paid ? (
                                            <span className="rounded bg-green-100 px-1 text-xs text-green-700">
                                                {PO_DOCUMENTS_COPY.badge.paid(inv)}
                                            </span>
                                        ) : (
                                            <span className="rounded bg-zinc-100 px-1 text-xs text-zinc-500">
                                                {PO_DOCUMENTS_COPY.badge.notPaid}
                                            </span>
                                        ))}
                                </p>
                                {/* ONE ROW PER ORDERED ITEM AND PRICE (#266), the
                                    delivery list's fold with the unit price joined to
                                    the key — so two charges at different prices
                                    stay two facts and a folded one's `@ price` is
                                    exact rather than a choice between two.

                                    NOTHING IN THE APP PRODUCES TWO CHARGES ON ONE
                                    ORDERED ITEM, which is worth saying because the
                                    issue reached for #167's split and that is not the
                                    producer: the split re-points the excess onto the
                                    OVERAGE order's ordered item, and this list admits
                                    only this order's, so each page sees one half. #91
                                    stops the form. A record edited by hand is what
                                    reaches it, the same ground #241 gives for treating
                                    the same shape defensively. */}
                                <ul className="mt-0.5 pl-4 text-xs text-zinc-500">
                                    {inv.charges.map((c) => (
                                        <li key={c.key}>
                                            {PO_DOCUMENTS_COPY.invoices.charge(c).text}
                                            {c.varianceFlag && (
                                                <span className="ml-1 rounded bg-red-100 px-1 text-red-700">
                                                    {VARIANCE_COPY.item}
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

            {/* EACH CONTROL NOW RENDERS ON EXACTLY ITS OWN ACTION'S GATE (#281).
                This block gated all three write controls on `isOffice`
                (President-or-Admin) while signing and regeneration were both
                President-only actions, so an Admin who is not the President saw two
                buttons that could only throw — five of eleven users on this base.
                Signing narrowed to the President; regeneration widened to Admin,
                because the office is the side that handles the order document; and
                #281's send control is Admin for the same reason. The PO PDF itself is
                visible to everyone who can see the PO (#132) — site staff place the
                order from it — so the download link stays outside every gate. */}
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
                            <div className="space-y-3">
                                <a href={pdfFile.url} target="_blank" rel="noreferrer" className="underline">
                                    {pdfFile.filename || "PO PDF"}
                                </a>
                                {/* Issue #281 — the send sits beside the download
                                    because they are two things to do with one
                                    document, and the reader who mails it is the one
                                    who was downloading it to mail it by hand. Once
                                    sent, the record replaces the control: a second
                                    send is refused, so there is no button to show and
                                    the three facts of the send go in its place.
                                    Everyone who can see the order sees that record —
                                    whether the vendor has it is not office-only. */}
                                {po.sentAt ? (
                                    <p className="text-zinc-600">
                                        {SEND_COPY.sent({
                                            address: po.sentTo || "—",
                                            when: new Date(po.sentAt).toLocaleString(),
                                            by: sentByName,
                                        })}
                                    </p>
                                ) : isAdmin ? (
                                    sendEligibility.eligible ? (
                                        <SendToVendorForm poId={po.poId} address={vendor?.picEmail} />
                                    ) : (
                                        <p className="text-amber-700">
                                            {SEND_COPY.refusal[sendEligibility.reason]}
                                        </p>
                                    )
                                ) : null}
                            </div>
                        ) : withdrawn ? (
                            <p className="text-zinc-600">
                                No PO document is on file, and none will be generated now that this PO is
                                withdrawn.
                            </p>
                        ) : isAdmin ? (
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
                ) : isPresident ? (
                    <SignForm poId={po.poId} />
                ) : (
                    <p className="text-sm text-zinc-600">
                        This PO hasn&apos;t been signed yet.
                    </p>
                )}
            </div>

            {/* Issue #138 — the requester's own control, so it sits OUTSIDE
                the isOffice gate above (site staff place the vendor order
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
                        /* Issue #281 — keyed on the reason rather than assuming
                           `invoice-linked`, which was the only refusal that reached
                           here. A sent order is the second, and it is #138's own
                           decision becoming visible: that issue put `Sent to Vendor`
                           out of withdrawal's reach because by then calling the order
                           off involves the vendor, and #144 then removed the status
                           so no order could reach the refusal. Writing the status
                           gives it a reader. */
                        <p className="text-sm text-zinc-600">
                            {WITHDRAW_REFUSAL[withdrawEligibility.reason]}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

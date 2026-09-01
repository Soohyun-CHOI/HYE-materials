import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { canViewPR } from "@/lib/prVisibility";
import { getPRById } from "@/lib/airtable/purchaseRequests";
import { getSignersByPR } from "@/lib/airtable/prSigners";
import { getItemsByPR } from "@/lib/airtable/prItems";
import { getCorrectionRequestsByPR } from "@/lib/airtable/correctionRequests";
import { getEditLogByPR } from "@/lib/airtable/editLog";
import { getQuotationsByPR } from "@/lib/airtable/quotations";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllDisciplines } from "@/lib/airtable/disciplines";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { getCurrentTurn, getReturnTargets } from "@/lib/prSigning";
import { describeOverageBanner } from "@/lib/overage";
import { PR_KIND, PR_KIND_COPY, prKind } from "@/lib/prKind";
import { awaitingPOCopy } from "@/lib/poListView";
import { getOverageBannerFacts } from "@/lib/overagePR";
import { formatUSD } from "@/lib/format";
import { withOpsLabel } from "@/lib/airtableOps";
import ItemsSummaryRows from "@/app/components/ItemsSummaryRows";
import SigningPanel from "./SigningPanel";
import GeneratePOForm from "./GeneratePOForm";
import SignerProgressBar from "./SignerProgressBar";
import WithdrawPRForm from "./WithdrawPRForm";

// The route param IS the human-readable ID, so the tab names the record for
// ZERO Airtable operations (#201) — this reads the URL and nothing else.
export async function generateMetadata({ params }) {
    const { prId } = await params;
    return { title: prId };
}

// Labeled for #190 — see the note in app/prs/page.js. This page reads five child
// levels, and the label is what showed it was paying five parent re-finds and one
// find per child row and per person to do it (#193). It reads the ids off the
// request record now and each level is one query.
export default async function PRDetailPage(props) {
    return withOpsLabel("/prs/[prId]", () => renderPRDetailPage(props));
}

async function renderPRDetailPage({ params }) {
    const user = await requireUser();
    const { prId } = await params;

    const pr = await getPRById(prId);
    if (!pr) {
        return <div className="p-8">PR not found.</div>;
    }

    // Issue #143 — viewing is row-scoped, by the same rule the PR list (#119)
    // and the PO detail page (#132) already use. Until now this page opened on
    // a session alone, which made both of those reachable around: the list's
    // rule did not apply to anyone who knew a PR ID, and #132's PO gate reads
    // the parent PR, so the PR it protects could simply be opened directly.
    //
    // A PR the viewer isn't entitled to reads as not-found, not as "not
    // authorized" — the same wording and the same reasoning as the PO page:
    // never confirm that a PR exists outside someone's scope. Placed before
    // the loads below, so a refusal also stops doing the work.
    if (!canViewPR(user, pr)) {
        return <div className="p-8">PR not found.</div>;
    }

    // Issue #193 — every child level is read from the ids `pr` already carries,
    // so none of these five re-finds the request. They did, once each, which is
    // why this render used to fetch the same Purchase Requests row six times.
    // recordToPR exposes all five arrays for exactly this (#143 put two of them
    // there for canViewPR; #193 added the rest), and each level is then one
    // query rather than one find per row.
    const [signers, items, quotations, correctionRequests, editLog, vendors, disciplines, jobs] =
        await Promise.all([
            getSignersByPR(pr.id, { rowIds: pr.signerRowIds }),
            getItemsByPR(pr.id, { rowIds: pr.itemRowIds }),
            getQuotationsByPR(pr.id, { rowIds: pr.quotationRowIds }),
            getCorrectionRequestsByPR(pr.id, { rowIds: pr.correctionRowIds }),
            getEditLogByPR(pr.id, { rowIds: pr.editLogRowIds }),
            getAllVendors(),
            getAllDisciplines(),
            getAllJobs(),
        ]);

    const po = pr.purchaseOrders?.[0] ? await getPOByRecordId(pr.purchaseOrders[0]) : null;

    // Issue #167 — is this request an overage correction? Free on every ordinary PR:
    // the reverse-link recordToPR exposes is empty unless a delivery row points here,
    // and getOverageBannerFacts returns before its first query in that case.
    // Issue #272 — what kind of request a signer is looking at, read from the two
    // reverse-links recordToPR already carries. Free on every request, ordinary ones
    // included, and stored nowhere: see lib/prKind.js.
    const kind = prKind(pr);

    const overageBanners =
        (await getOverageBannerFacts(pr))?.map((banner) => ({
            ...banner,
            site: "overagePR",
            facts: { ...banner.facts, thisPoId: banner.facts.overagePoId },
        })) ?? [];

    const userIds = new Set(
        [
            pr.requester?.[0],
            ...signers.map((s) => s.signer?.[0]),
            ...correctionRequests.flatMap((c) => [c.initiatedBy?.[0], c.sentTo?.[0]]),
            ...editLog.map((e) => e.changedBy?.[0]),
        ].filter(Boolean)
    );
    // Issue #193 — one query for the whole set rather than one find per person.
    // The Set above is already the deduplicated id list, so this is the batched
    // reader's exact shape. The body of #193 names this fan-out only for the PR
    // LIST; it is on this page too, over four sources instead of one.
    const userList = await getUsersByRecordIds([...userIds]);
    const usersById = Object.fromEntries(userList.map((u) => [u.id, u]));

    const vendorsById = Object.fromEntries(vendors.map((v) => [v.id, v]));
    const disciplineById = Object.fromEntries(disciplines.map((d) => [d.id, d]));
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
    // Issue #134 — the PO-generation retry is Admin-only (generatePOAction),
    // so its control renders only for Admins; otherwise the action and its UI
    // would sit at different levels.
    const isAdmin = user.isAdmin === true;

    const vendorName = vendorsById[pr.vendor?.[0]]?.vendorName || "—";
    const disciplineLabel = disciplineById[pr.discipline?.[0]]?.disciplineLabel || "—";
    // Job is a Lookup through Discipline -> Disciplines.Job (itself a link field),
    // so pr.job is a raw Job record ID, not display text — resolve it the
    // same way as Vendor/Discipline above.
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
                text: `${name} changed ${e.field}: "${e.oldValue}" → "${e.newValue}"${
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
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold">{pr.prId}</h1>
                    {/* #272 — the same mark the list carries, in the same words. */}
                    {PR_KIND_COPY.chip[kind] && (
                        <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
                            {PR_KIND_COPY.chip[kind]}
                        </span>
                    )}
                </div>
                {/* Always the unfiltered full list — returning to a filtered
                    list is the back button's job (the filter URL is preserved
                    there), so this link deliberately carries no filter params. */}
                <Link href="/prs" className="text-sm underline">
                    ← All PRs
                </Link>
            </div>


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

            {/* Issue #272 — the direct-purchase kind's own sentence, in the slot the
                overage banner uses, because the two kinds are answering the same
                question for a signer: what am I actually approving. The overage kind
                has no sentence of its own here on purpose — its banner above already
                says more than one could, and two voices for one fact is what this
                slot exists to avoid.

                Every word is derived: the vendor is already resolved for the panel
                below, and the invoice's own number is the quotation's
                `Vendor Quotation Code`, which the claim wrote and this page already
                loaded. So the sentence costs no read. */}
            {kind === PR_KIND.directPurchase && (
                <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {
                        PR_KIND_COPY.signer[PR_KIND.directPurchase]({
                            vendorName,
                            vendorInvoiceCode: quotations[0]?.vendorQuotationCode || "",
                        }).text
                    }
                </p>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
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
                <p>Discipline: {disciplineLabel}</p>
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
                            <tr key={it.id} className="border-t border-zinc-200">
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
                <ol className="mt-2 space-y-1 text-sm text-zinc-600">
                    {historyEntries.map((entry, i) => (
                        <li key={i}>
                            <span className="text-zinc-400">
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
                            {/* Issue #293 — `Link` and `encodeURIComponent`, matching
                                the request list's link above and the order page's
                                three. This was a plain `<a>`, so the two pages
                                pointed at each other by two mechanisms while
                                looking identical; #293 gave the order page its link
                                back to here and closed the pair. */}
                            <Link href={`/pos/${encodeURIComponent(po.poId)}`} className="underline">
                                {po.poId}
                            </Link>{" "}
                            — <strong>{po.status}</strong>
                        </p>
                    ) : (
                        <div className="mt-2 space-y-2">
                            {/* #176 — this said "PO generation hasn't completed
                                yet", which reads as work in progress. Generation
                                runs synchronously inside the approving action and
                                is never retried on its own, so a PR showing this
                                has already failed and `yet` was telling the reader
                                to wait for something that will not arrive. The
                                sentence is lib/poListView.js's, shared with the
                                /pos strip so the two screens cannot describe one
                                state differently. `count` is 1 because this page
                                is one request; only the second half is read. */}
                            <p className="text-sm text-zinc-600">
                                {awaitingPOCopy({ count: 1, isAdmin }).explain}
                            </p>
                            {isAdmin && <GeneratePOForm prId={pr.prId} />}
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
                        <p className="text-sm text-zinc-600">
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
                <div className="mt-8 border-t border-zinc-200 pt-6">
                    <WithdrawPRForm prId={pr.prId} />
                </div>
            )}
        </div>
    );
}

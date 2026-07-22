import { getPRById } from "./airtable/purchaseRequests";
import { getItemsByPR } from "./airtable/prItems";
import { getQuotationsByPR } from "./airtable/quotations";
import { getSignersByPR } from "./airtable/prSigners";

/**
 * Reload contract for the PR Draft Support milestone (issue #72). Assembles
 * a PR and its children back into the exact shape PRForm initializes its
 * client state from, so a saved Draft can be re-opened and edited. Defined
 * here even though the callers arrive later: #73 (resume-prompt on
 * re-entry) and #74 (drafts list page) both load a draft through this.
 *
 * Returns null if no PR has the given PR ID. Works on any PR regardless of
 * Status, but is only meaningful for Drafts (a submitted PR is read-only in
 * the form sense).
 *
 * Note on quotation files: q.file[0].url is Airtable's own short-lived
 * signed URL (~2h — see CLAUDE.md's Quotation file note), so a Draft
 * re-opened long after saving may carry a stale file URL. Same known quirk
 * as the PR detail page's Quotations list.
 */
export async function loadPRDraft(prId) {
    const pr = await getPRById(prId);
    if (!pr) return null;

    const [items, quotations, signers] = await Promise.all([
        getItemsByPR(pr.id),
        getQuotationsByPR(pr.id),
        getSignersByPR(pr.id),
    ]);

    // getLinkedRecords doesn't sort, so impose a stable order. Child IDs
    // ({PR ID}-{seq}, quotations {PR ID}-Q{seq}) sort lexicographically into
    // creation order. Quotation order matters: item.quotationIndex is an
    // index into this same array (mirrors PRForm's quotations state).
    const orderedItems = [...items].sort((a, b) =>
        (a.prItemId || "").localeCompare(b.prItemId || "")
    );
    const orderedQuotations = [...quotations].sort((a, b) =>
        (a.quotationId || "").localeCompare(b.quotationId || "")
    );
    const quotationIndexById = Object.fromEntries(
        orderedQuotations.map((q, i) => [q.id, i])
    );

    return {
        prId: pr.prId,
        recordId: pr.id,
        status: pr.status,
        // pr.job is the Line -> Job Lookup (a Job record id), which is what
        // PRForm's Job selector is keyed on — no extra lookup needed.
        jobId: pr.job?.[0] || "",
        lineId: pr.line?.[0] || "",
        vendorId: pr.vendor?.[0] || "",
        shippingFee: pr.shippingFee ?? "",
        notes: pr.notes || "",
        items: orderedItems.map((it) => ({
            itemName: it.itemName || "",
            size: it.size || "",
            unit: it.unit || "",
            qty: it.qty ?? "",
            unitPrice: it.unitPrice ?? "",
            remark: it.remark || "",
            quotationIndex:
                it.quotation?.[0] != null ? quotationIndexById[it.quotation[0]] ?? null : null,
        })),
        signers: signers.map((s) => ({
            userId: s.signer?.[0] || "",
            confirmationType: s.confirmationType || "Approval",
        })),
        quotations: orderedQuotations.map((q) => ({
            url: q.file?.[0]?.url,
            filename: q.file?.[0]?.filename,
            vendorQuotationCode: q.vendorQuotationCode || "",
        })),
    };
}

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
 * Note on quotation files: q.file[0].url is Airtable's own signed URL, which
 * dies at a wall-clock instant its own path segment names (see
 * `docs/notes/uploads-and-drafts.md` for the observation), so a Draft re-opened
 * long after saving carries a dead file URL. It must never be re-submitted as
 * an attachment: Airtable answers such a write with success and silently leaves
 * the field empty, which is the data loss #142 fixes.
 *
 * `recordId` per quotation exists for exactly that reason (#142). It lets the
 * save path recognize an entry the Requester never re-uploaded and keep the
 * existing Quotation record instead of rebuilding it from this URL. Without
 * it the form had no way to say "this is the same file" and every re-save
 * re-submitted the URL.
 *
 * `quotationId` is what the form RENDERS from (#331) and it is the reason the
 * url is no longer rendered at all: the file opens through this app's own route,
 * which re-reads the record per request. The url still travels because
 * `shouldReuseQuotation` judges on it — an entry whose url is not one of ours is
 * the one the Requester did not touch — so the two fields answer two questions
 * and neither can stand in for the other.
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
        // pr.job is the Discipline -> Job Lookup (a Job record id), which is what
        // PRForm's Job selector is keyed on — no extra lookup needed.
        jobId: pr.job?.[0] || "",
        disciplineId: pr.discipline?.[0] || "",
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
            // #142 — the identity of the stored record, so a re-save can reuse
            // it rather than rebuilding it from the expiring url below.
            recordId: q.id,
            // #331 — the document id the form builds a file href from. Its own id
            // rather than the record id, because that is what the route takes and
            // what a person reads.
            quotationId: q.quotationId,
            url: q.file?.[0]?.url,
            filename: q.file?.[0]?.filename,
            fileType: q.file?.[0]?.type,
            vendorQuotationCode: q.vendorQuotationCode || "",
        })),
    };
}

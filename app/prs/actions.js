"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/authz";
import { getDirectPurchasesByRecordIds } from "@/lib/airtable/directPurchases";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { claimDirectPurchase, describeClaimRefusal } from "@/lib/directPurchaseClaim";
import { DIRECT_PURCHASE_COPY } from "@/lib/directPurchase";
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Raise the purchase request for one direct purchase (#272).
 *
 * JOB-SCOPED, NOT OFFICE-GATED, and that is the whole point of the hand-off: the
 * office recorded the purchase because it could not raise the request, and the
 * person who can is at the site that bought the material. The rule is
 * `canAccessJobDeliveries`, which is the same per-record axis
 * `createOverageDraftAction` uses for the strip beside this one — see
 * `docs/notes/naming.md` for why that function's name says `Deliveries` while a
 * second axis now asks it.
 *
 * A ROW OUTSIDE THE VIEWER'S JOBS READS AS GONE rather than as refused, the
 * posture every row-scoped surface here takes: never confirm that a record exists
 * outside somebody's scope.
 *
 * RE-READS AND RE-JUDGES EVERYTHING. A Server Action is directly callable, so the
 * button having rendered proves nothing; and the strip in front of somebody may be
 * minutes old, so the claim another site raised in the meantime lands here as a
 * refusal naming them rather than as a second Draft.
 */
export async function claimDirectPurchaseAction(prevState, formData) {
    return withOpsLabel("claimDirectPurchaseAction", async () => {
        const user = await requireUser();
        const recordId = formData.get("directPurchaseId");
        if (!recordId) return { error: DIRECT_PURCHASE_COPY.refused.gone };

        let directPurchase;
        try {
            // findByRecordIds throws on an id that does not resolve, which is what a
            // stale page or a forged field produces.
            [directPurchase] = await getDirectPurchasesByRecordIds([recordId]);
        } catch {
            return { error: DIRECT_PURCHASE_COPY.refused.gone };
        }
        if (!directPurchase) return { error: DIRECT_PURCHASE_COPY.refused.gone };
        if (!canAccessJobDeliveries(user, directPurchase.job?.[0])) {
            return { error: DIRECT_PURCHASE_COPY.refused.gone };
        }

        const refusal = await describeClaimRefusal(directPurchase);
        if (refusal) return { error: refusal };

        let result;
        try {
            result = await claimDirectPurchase({ user, directPurchase });
        } catch (err) {
            console.error("claimDirectPurchaseAction failed", err);
            return { error: "Couldn't open the request draft. Please try again." };
        }

        // Issue #140 — the END of this action's transaction: every write has landed,
        // so Airtable holds the quotation file and the Blob object can go. Never
        // inside claimDirectPurchase, whose rollback has to leave the same url
        // available to a retry. Scheduled rather than awaited, which also survives
        // the redirect below throwing.
        after(() => confirmIngestThenDelete(result.blobCleanups));

        // Straight into the existing Draft resume path (#72), which loadPRDraft
        // hydrates — here that means the vendor and the quotation, with the line, the
        // items and the signers left for the requester.
        redirect(`/prs/new?draft=${encodeURIComponent(result.pr.prId)}`);
    });
}

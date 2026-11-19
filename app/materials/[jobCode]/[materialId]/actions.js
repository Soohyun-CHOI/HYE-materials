"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { getAddressByRecordId } from "@/lib/airtable/addresses";
import { getMaterialByRecordId } from "@/lib/airtable/materials";
import { INVENTORY_COPY, canAccessJobInventory, readQty } from "@/lib/materialStock";
import { recordIssue } from "@/lib/materialStock.server";

const REFUSALS = INVENTORY_COPY.refusals;

/**
 * Issue materials from an address (#675). A `requireUser()` exemption in the endpoint inventory:
 * who may is `canAccessJobInventory` for the job the form names — an Admin on every job, a site
 * manager on their own — asked here per record, which no role wrapper covers. Whether the address
 * holds it is `recordIssue`'s, under its lock and again after its write.
 *
 * EVERY CALL SITE BINDS THE RETURN (`useActionState`), so a refusal returns `{ error }`. The page
 * is refreshed whether the issue stood or was refused for the stock, since either way the counts
 * on it may be out of date — the stock refusal is the sentence that says so (#378).
 */
export async function issueMaterialsAction(prevState, formData) {
    return withOpsLabel("issueMaterialsAction", async () => {
        const user = await requireUser();
        const jobRecordId = String(formData.get("jobRecordId") ?? "");
        const materialRecordId = String(formData.get("materialRecordId") ?? "");
        const addressRecordId = String(formData.get("addressRecordId") ?? "");
        if (!canAccessJobInventory(user, jobRecordId)) return { error: REFUSALS["not-allowed"] };

        let result;
        try {
            result = await recordIssue({
                jobRecordId,
                materialRecordId,
                addressRecordId,
                qty: readQty(formData.get("qty")),
                eventDate: String(formData.get("eventDate") ?? ""),
                recordedByUserId: user.id,
            });
        } catch (error) {
            console.error("issueMaterialsAction failed", error);
            return { error: REFUSALS.failed };
        }

        if (result.refusal === "more-than-stock") {
            const [material, address] = await Promise.all([
                getMaterialByRecordId(materialRecordId).catch(() => null),
                getAddressByRecordId(addressRecordId).catch(() => null),
            ]);
            refresh();
            return { error: REFUSALS["more-than-stock"](Math.max(0, result.inStock), material?.unit ?? "", address?.addressLabel ?? "that address") };
        }
        if (result.refusal) return { error: REFUSALS[result.refusal] };

        refresh();
        return { issued: result.entry.materialLogId };
    });
}

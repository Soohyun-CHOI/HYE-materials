"use server";

import { refresh } from "next/cache";
import { requireUser, withAdminAction } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { getAddressByRecordId } from "@/lib/airtable/addresses";
import { getMaterialByRecordId } from "@/lib/airtable/materials";
import { INVENTORY_COPY, canAccessJobInventory, readFigure, readQty } from "@/lib/materialStock";
import { recordCountEdit, recordIssue } from "@/lib/materialStock.server";
import { TRANSIT_COPY, todayIn } from "@/lib/materialTransit";
import { recordReceipt, recordSend, recordSendCancel, recordWriteOff } from "@/lib/materialTransit.server";

const REFUSALS = INVENTORY_COPY.refusals;
const TRANSIT_REFUSALS = TRANSIT_COPY.refusals;
const WRITE_OFF_COPY = TRANSIT_COPY.writeOff;

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

/**
 * Edit a material's count at an address (#678): the count typed, the figure the page drew there,
 * a reason and any notes. A `requireUser()` exemption, `issueMaterialsAction`'s: who may is
 * `canAccessJobInventory` for the job the form names, asked here per record. Whether the stock is
 * still the figure drawn, and stands at the count after the write, is `recordCountEdit`'s. The day
 * recorded is the reader's today, in the zone the press sends, as a cancel's is (#677).
 *
 * EVERY CALL SITE BINDS THE RETURN (`useActionState`), so a refusal returns `{ error }`; one saying
 * the stock moved is said over a fresh render, since the figures on the page are out of date.
 */
export async function editCountAction(prevState, formData) {
    return withOpsLabel("editCountAction", async () => {
        const user = await requireUser();
        const words = INVENTORY_COPY.countEdit.refusals;
        const jobRecordId = String(formData.get("jobRecordId") ?? "");
        const materialRecordId = String(formData.get("materialRecordId") ?? "");
        const addressRecordId = String(formData.get("addressRecordId") ?? "");
        if (!canAccessJobInventory(user, jobRecordId)) return { error: words["not-allowed"] };

        let result;
        try {
            result = await recordCountEdit({
                jobRecordId,
                materialRecordId,
                addressRecordId,
                countedQty: readQty(formData.get("countedQty")),
                shownQty: readFigure(formData.get("shownQty")),
                reason: String(formData.get("reason") ?? ""),
                notes: String(formData.get("notes") ?? ""),
                eventDate: todayIn(String(formData.get("timeZone") ?? "")),
                recordedByUserId: user.id,
            });
        } catch (error) {
            console.error("editCountAction failed", error);
            return { error: words.failed };
        }

        if (result.ok) {
            refresh();
            return { edited: result.entry.materialLogId };
        }
        let sentence = words[result.refusal];
        if (typeof sentence === "function") {
            const [unit, address] = await Promise.all([unitOf(materialRecordId), getAddressByRecordId(addressRecordId).catch(() => null)]);
            sentence = sentence(result.inStock, unit, address?.addressLabel ?? "that address");
        }
        if (STALE.has(result.refusal)) refresh();
        return { error: sentence };
    });
}

/** A material's unit, for a sentence naming a quantity; "" when it cannot be read. */
async function unitOf(materialRecordId) {
    if (!materialRecordId) return "";
    return (await getMaterialByRecordId(materialRecordId).catch(() => null))?.unit ?? "";
}

/**
 * The refusals that say the page is out of date — the stock, the destination, what is left in
 * transit, the send itself — and so are said over a fresh render (#378); the rest are about what
 * was typed and leave the page as it is.
 */
const STALE = new Set(["more-than-stock", "destination-gone", "destination-closed", "destination-not-on-job", "more-than-in-transit", "send-gone", "nothing-in-transit", "changed", "raced"]);

/**
 * Send materials from one of the job's addresses to an address of an open job (#677). A
 * `requireUser()` exemption, `issueMaterialsAction`'s: who may is `canAccessJobInventory` on the
 * job the material leaves, asked here and again in `recordSend`, which also holds the address it
 * leaves to what it has, as an issue does. The reader's today is their own zone's, sent with the
 * press, so a day sent can't be later than theirs.
 */
export async function sendMaterialsAction(prevState, formData) {
    return withOpsLabel("sendMaterialsAction", async () => {
        const user = await requireUser();
        const words = TRANSIT_REFUSALS.send;
        const fromJobRecordId = String(formData.get("jobRecordId") ?? "");
        const materialRecordId = String(formData.get("materialRecordId") ?? "");
        const fromAddressRecordId = String(formData.get("fromAddressRecordId") ?? "");
        if (!canAccessJobInventory(user, fromJobRecordId)) return { error: words["not-allowed"] };

        let result;
        try {
            result = await recordSend({
                user,
                fromJobRecordId,
                fromAddressRecordId,
                toJobRecordId: String(formData.get("toJobRecordId") ?? ""),
                toAddressRecordId: String(formData.get("toAddressRecordId") ?? ""),
                materialRecordId,
                qty: readQty(formData.get("qty")),
                sentDate: String(formData.get("sentDate") ?? ""),
                today: todayIn(String(formData.get("timeZone") ?? "")),
            });
        } catch (error) {
            console.error("sendMaterialsAction failed", error);
            return { error: words.failed };
        }

        if (result.ok) {
            refresh();
            return { sent: result.entry.materialLogId };
        }
        let sentence = words[result.refusal];
        if (result.refusal === "more-than-stock") {
            const [unit, address] = await Promise.all([unitOf(materialRecordId), getAddressByRecordId(fromAddressRecordId).catch(() => null)]);
            sentence = sentence(Math.max(0, result.inStock), unit, address?.addressLabel ?? "that address");
        } else if (result.refusal === "destination-closed") {
            sentence = sentence(result.toJob?.jobCode);
        } else if (result.refusal === "destination-not-on-job") {
            sentence = sentence(result.toAddress?.addressLabel ?? "That address", result.toJob?.jobCode ?? "the job");
        }
        if (STALE.has(result.refusal)) refresh();
        return { error: sentence };
    });
}

/**
 * The sentence for a refusal about one send, its figures filled in: what is left of it in transit,
 * in its material's unit, or the day it was sent.
 */
async function sendRefusalSentence(words, result) {
    const sentence = words[result.refusal];
    if (typeof sentence !== "function") return sentence;
    if (result.refusal === "before-sent") return sentence(result.send?.sentDate ?? "");
    return sentence(Math.max(0, result.send?.remaining ?? 0), await unitOf(result.send?.materialRecordId));
}

/**
 * Receive what arrived of a send (#677), at the address it was sent to. A `requireUser()`
 * exemption, `issueMaterialsAction`'s: who may is `canAccessJobInventory` on the job the send went
 * to, which only the send itself names, so `recordReceipt` asks it once the send is read — under
 * the send's lock, with what is left in transit read again after the write.
 */
export async function receiveMaterialsAction(prevState, formData) {
    return withOpsLabel("receiveMaterialsAction", async () => {
        const user = await requireUser();
        const words = TRANSIT_REFUSALS.receive;
        let result;
        try {
            result = await recordReceipt({
                user,
                sentRecordId: String(formData.get("sentRecordId") ?? ""),
                qty: readQty(formData.get("qty")),
                receivedDate: String(formData.get("receivedDate") ?? ""),
                today: todayIn(String(formData.get("timeZone") ?? "")),
            });
        } catch (error) {
            console.error("receiveMaterialsAction failed", error);
            return { error: words.failed };
        }
        if (result.ok) {
            refresh();
            return { received: result.entry.materialLogId };
        }
        if (STALE.has(result.refusal)) refresh();
        return { error: await sendRefusalSentence(words, result) };
    });
}

/**
 * Take back what has not arrived of a send (#677), to the address it left. A `requireUser()`
 * exemption, `issueMaterialsAction`'s: who may is `canAccessJobInventory` on the job the send left,
 * asked by `recordSendCancel` once the send is read.
 */
export async function cancelSendAction(prevState, formData) {
    return withOpsLabel("cancelSendAction", async () => {
        const user = await requireUser();
        const words = TRANSIT_REFUSALS.cancel;
        let result;
        try {
            result = await recordSendCancel({
                user,
                sentRecordId: String(formData.get("sentRecordId") ?? ""),
                qty: readQty(formData.get("qty")),
                today: todayIn(String(formData.get("timeZone") ?? "")),
            });
        } catch (error) {
            console.error("cancelSendAction failed", error);
            return { error: words.failed };
        }
        if (result.ok) {
            refresh();
            return { canceled: result.entry.materialLogId };
        }
        if (STALE.has(result.refusal)) refresh();
        return { error: await sendRefusalSentence(words, result) };
    });
}

/**
 * Write off all that never arrived of a send (#677) — the office's alone, so `withAdminAction`,
 * and `recordWriteOff` asks again. Every call site binds the return, so a refusal returns
 * `{ error }` (#185), over a fresh render since the page that offered the control is out of date.
 */
export const writeOffMaterialsAction = withAdminAction(() => {
    refresh();
    return { error: WRITE_OFF_COPY.noAccess };
}, writeOffMaterialsHandler);

async function writeOffMaterialsHandler(prevState, formData) {
    return withOpsLabel("writeOffMaterialsAction", async () => {
        const user = await requireUser();
        const words = TRANSIT_REFUSALS.writeOff;
        let result;
        try {
            result = await recordWriteOff({
                user,
                sentRecordId: String(formData.get("sentRecordId") ?? ""),
                qty: readQty(formData.get("qty")),
                today: todayIn(String(formData.get("timeZone") ?? "")),
            });
        } catch (error) {
            console.error("writeOffMaterialsAction failed", error);
            return { error: words.failed };
        }
        if (result.ok) {
            refresh();
            return { writtenOff: result.entry.materialLogId };
        }
        if (STALE.has(result.refusal)) refresh();
        return { error: await sendRefusalSentence(words, result) };
    });
}

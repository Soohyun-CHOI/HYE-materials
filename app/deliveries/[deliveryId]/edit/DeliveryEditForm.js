"use client";

import { useActionState, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
    attachDeliveryInvoiceAction,
    detachDeliveryInvoiceAction,
    replaceDeliveryPhotoAction,
    updateDeliveryAction,
} from "../actions";
import {
    LINK_COPY,
    availableInvoiceOptions,
    invoiceOptionLabel,
} from "@/lib/deliveryInvoiceLink";

// EVERY IMPORT HERE MUST BE CLIENT-SAFE. lib/deliveryInvoiceLink.js is pure and
// dependency-free for exactly this reason; its credentialed half is a separate
// module (lib/deliveryInvoiceCandidates.js), because importing a module EXECUTES it
// and anything reaching lib/airtable/client.js throws `Missing AIRTABLE_API_KEY` in
// the browser. scripts/tests/offline/client-import-safety.mjs fails on the mistake.

/**
 * The four editable things on a recorded delivery: the received date and the note
 * (#162), the photo (#162), and the invoice this shipment is billed by (#210).
 *
 * FOUR SEPARATE FORMS, not one save. For the photo that is #142's rule made
 * structural rather than remembered: a combined save would carry the current
 * attachment's url in its payload and rewrite the field on every save, and
 * re-submitting an url Airtable issued returns success while silently emptying the
 * field once it has expired. Here the photo is written only by the action that
 * received a fresh upload, and replaceDeliveryPhoto refuses anything that is not one
 * of our own Blob urls. For the invoice the reason is different and simpler: attach
 * and detach are two claims about two records, so one control that quietly did both
 * would move a bill between shipments in a single submit nobody reviewed.
 */
export default function DeliveryEditForm({
    deliveryId,
    receivedDate,
    notes,
    vendorName,
    vendorRecordId,
    attachedInvoices = [],
    invoiceOptions = [],
}) {
    const [detailsState, saveDetails, savingDetails] = useActionState(updateDeliveryAction, {});
    const [photoState, savePhoto, savingPhoto] = useActionState(replaceDeliveryPhotoAction, {});
    const [attachState, attachInvoice, attaching] = useActionState(attachDeliveryInvoiceAction, {});
    const [detachState, detachInvoice, detaching] = useActionState(detachDeliveryInvoiceAction, {});
    const [photo, setPhoto] = useState({ status: "empty" });
    const [pickedInvoice, setPickedInvoice] = useState("");

    // Narrowed and ordered by the shared rule, so this screen and the entry form
    // cannot come to offer different sets.
    const options = useMemo(
        () => availableInvoiceOptions(invoiceOptions, { vendorRecordId }),
        [invoiceOptions, vendorRecordId]
    );
    const attachedIds = new Set(attachedInvoices.map((inv) => inv.invoiceRecordId));

    async function onPhotoChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhoto({ status: "uploading", filename: file.name });
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/deliveries/upload",
            });
            setPhoto({ status: "done", url: blob.url, filename: file.name });
        } catch (err) {
            setPhoto({ status: "error", filename: file.name, error: err.message });
        }
    }

    return (
        <div className="mt-6">
            <form action={saveDetails} className="space-y-4">
                <input type="hidden" name="deliveryId" value={deliveryId} />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="editReceivedDate" className="block text-sm font-medium">
                            Received Date
                        </label>
                        <input
                            id="editReceivedDate"
                            name="receivedDate"
                            type="date"
                            defaultValue={receivedDate}
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="editNotes" className="block text-sm font-medium">
                        Notes
                    </label>
                    <textarea
                        id="editNotes"
                        name="notes"
                        rows={2}
                        defaultValue={notes}
                        placeholder="Damage, a partial pallet, who signed for it…"
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                </div>
                {detailsState?.error && (
                    <p className="text-sm text-red-700">{detailsState.error}</p>
                )}
                <button
                    type="submit"
                    disabled={savingDetails}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                    {savingDetails ? "Saving…" : "Save"}
                </button>
            </form>

            <form action={savePhoto} className="mt-6 space-y-3">
                <input type="hidden" name="deliveryId" value={deliveryId} />
                <input type="hidden" name="packingListUrl" value={photo.url || ""} />
                <input type="hidden" name="packingListFilename" value={photo.filename || ""} />
                <div>
                    <label htmlFor="replacePhoto" className="block text-sm font-medium">
                        Replace the packing list photo
                    </label>
                    <input
                        id="replacePhoto"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={onPhotoChange}
                        className="mt-1 block w-full text-sm"
                    />
                    {photo.status === "uploading" && (
                        <p className="mt-1 text-xs text-zinc-500">Uploading {photo.filename}…</p>
                    )}
                    {photo.status === "error" && (
                        <p className="mt-1 text-xs text-red-700">
                            Upload failed: {photo.error}
                        </p>
                    )}
                </div>
                {photoState?.error && (
                    <p className="text-sm text-red-700">{photoState.error}</p>
                )}
                <button
                    type="submit"
                    disabled={savingPhoto || photo.status !== "done"}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                    {savingPhoto ? "Replacing…" : "Replace photo"}
                </button>
            </form>

            {/* --- #210: the invoice this shipment is billed by ------------------ */}
            <div className="mt-8 border-t border-zinc-200 pt-6">
                <h2 className="text-sm font-medium">Invoices</h2>
                <p className="mt-1 text-xs text-zinc-500">
                    {LINK_COPY.field.oneEach().text}
                </p>

                {attachedInvoices.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-600">
                        None attached yet.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-2">
                        {attachedInvoices.map((inv) => (
                            <li key={inv.invoiceRecordId} className="flex items-center gap-3 text-sm">
                                <span>
                                    {[inv.vendorInvoiceCode, inv.invoiceId].filter(Boolean).join(" · ")}
                                </span>
                                {/* Its own form per row: the action takes one
                                    invoice, and a single form with a changing hidden
                                    field would make which row was submitted depend
                                    on render order. */}
                                <form action={detachInvoice}>
                                    <input type="hidden" name="deliveryId" value={deliveryId} />
                                    <input
                                        type="hidden"
                                        name="invoiceRecordId"
                                        value={inv.invoiceRecordId}
                                    />
                                    <button
                                        type="submit"
                                        disabled={detaching}
                                        className="text-xs underline disabled:opacity-50"
                                    >
                                        {detaching ? "Detaching…" : "Detach"}
                                    </button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
                {detachState?.error && (
                    <p className="mt-2 text-sm text-red-700">
                        {detachState.error}
                    </p>
                )}

                {options.length === 0 ? (
                    <p className="mt-4 text-sm text-amber-700">
                        {LINK_COPY.field.emptyList({ vendorName }).text}
                    </p>
                ) : (
                    <form action={attachInvoice} className="mt-4 space-y-3">
                        <input type="hidden" name="deliveryId" value={deliveryId} />
                        <div>
                            <label htmlFor="attachInvoice" className="block text-sm font-medium">
                                Attach an invoice
                            </label>
                            <select
                                id="attachInvoice"
                                name="invoiceRecordId"
                                value={pickedInvoice}
                                onChange={(e) => setPickedInvoice(e.target.value)}
                                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                            >
                                <option value="">Select an invoice…</option>
                                {options.map((o) => (
                                    <option
                                        key={o.invoiceRecordId}
                                        value={o.invoiceRecordId}
                                        // An invoice on ANOTHER delivery is listed and
                                        // unselectable, naming where it went — #162's
                                        // fully-delivered item, one level up. One
                                        // already on THIS delivery is above instead.
                                        disabled={
                                            Boolean(o.linkedDeliveryRecordId) &&
                                            !attachedIds.has(o.invoiceRecordId)
                                        }
                                    >
                                        {invoiceOptionLabel(o)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {attachState?.error && (
                            <p className="text-sm text-red-700">
                                {attachState.error}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={attaching || !pickedInvoice}
                            className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                            {attaching ? "Attaching…" : "Attach invoice"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

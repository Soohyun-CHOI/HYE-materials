"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { replaceDeliveryPhotoAction, updateDeliveryAction } from "./actions";

/**
 * The three editable things on a recorded delivery (#162): the received date, the
 * note, and the photo.
 *
 * TWO SEPARATE FORMS, not one save. That is #142's rule made structural rather
 * than remembered: a combined save would carry the current attachment's url in its
 * payload and rewrite the field on every save, and re-submitting an url Airtable
 * issued returns success while silently emptying the field once it has expired.
 * Here the photo is written only by the action that received a fresh upload, and
 * replaceDeliveryPhoto refuses anything that is not one of our own Blob urls.
 */
export default function DeliveryEditForm({ deliveryId, receivedDate, notes }) {
    const [detailsState, saveDetails, savingDetails] = useActionState(updateDeliveryAction, {});
    const [photoState, savePhoto, savingPhoto] = useActionState(replaceDeliveryPhotoAction, {});
    const [photo, setPhoto] = useState({ status: "empty" });

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
        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="text-lg font-medium">Correct the record</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                Only the received date, the note and the photo can be changed here.
            </p>

            <form action={saveDetails} className="mt-4 space-y-4">
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
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                </div>
                {detailsState?.error && (
                    <p className="text-sm text-red-700 dark:text-red-500">{detailsState.error}</p>
                )}
                <button
                    type="submit"
                    disabled={savingDetails}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
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
                        <p className="mt-1 text-xs text-red-700 dark:text-red-500">
                            Upload failed: {photo.error}
                        </p>
                    )}
                </div>
                {photoState?.error && (
                    <p className="text-sm text-red-700 dark:text-red-500">{photoState.error}</p>
                )}
                <button
                    type="submit"
                    disabled={savingPhoto || photo.status !== "done"}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                    {savingPhoto ? "Replacing…" : "Replace photo"}
                </button>
            </form>
        </div>
    );
}

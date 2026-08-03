"use client";

import { useActionState, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { createDeliveryAction } from "./actions";
import { planDelivery, describePlan } from "@/lib/deliveryAllocation";
import { itemOptionLabel } from "@/lib/deliveryCandidates";

/**
 * Two shapes, one form (#162).
 *
 * WITHOUT a PO number the recorder chooses the vendor and then the item, in that
 * order, because the item list is vendor-narrowed. WITH one, the PO fixes the
 * vendor — the packing list already says who shipped — so the vendor picker
 * disappears and the item list narrows to that PO's lines. Fewer decisions, and
 * the ones left cannot contradict the document.
 *
 * THE PREVIEW RUNS THE PRODUCTION ALLOCATION. planDelivery is pure, so this
 * imports the same function createDeliveryAction re-runs on submit; what the form
 * promises and what the server writes cannot be two implementations that drift.
 * It is still only a preview — the server re-reads and re-allocates, because a PO
 * can be withdrawn or another arrival recorded while this page sits open.
 *
 * lib/deliveryCandidates.js is imported here for itemOptionLabel only, which is
 * pure; the module's Airtable readers are never called on this side.
 */
export default function DeliveryForm({ jobRecordId, jobCode, vendors, lines, itemsByVendor }) {
    const [state, formAction, pending] = useActionState(createDeliveryAction, {});

    const [hasPoNumber, setHasPoNumber] = useState(false);
    const [poId, setPoId] = useState("");
    const [vendorId, setVendorId] = useState(vendors.length === 1 ? vendors[0].id : "");
    const [materialId, setMaterialId] = useState("");
    const [qty, setQty] = useState("");
    const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState("");
    const [photo, setPhoto] = useState({ status: "empty" });

    // A typed PO number fixes the vendor. Resolved from the lines the page
    // already sent, so no round trip — and an unrecognized number simply leaves
    // the vendor unset, which the server refuses with a specific message rather
    // than this form guessing.
    const matchedPoLines = useMemo(() => {
        const wanted = poId.trim().toUpperCase();
        if (!wanted) return [];
        return lines.filter((l) => (l.poId || "").toUpperCase() === wanted);
    }, [poId, lines]);

    const poFixedVendorId = matchedPoLines[0]?.vendorRecordId ?? "";
    const usingPo = hasPoNumber && Boolean(poId.trim());
    const effectiveVendorId = usingPo ? poFixedVendorId : vendorId;
    const poRecordId = usingPo ? matchedPoLines[0]?.poRecordId ?? null : null;

    // With a PO in play the item list is that PO's lines; otherwise every material
    // the vendor has supplied to this job. Both are wider than the allocation
    // candidate set on purpose: a fully delivered item stays listed, with 0
    // outstanding, so the screen can say what is actually true about it instead of
    // hiding it behind "not in the dropdown".
    const itemOptions = useMemo(() => {
        if (usingPo) {
            const byMaterial = new Map();
            for (const line of matchedPoLines) {
                const remaining = Math.max(0, (line.qty || 0) - (line.deliveredQty || 0));
                const existing = byMaterial.get(line.materialRecordId);
                if (existing) {
                    existing.outstanding += remaining;
                } else {
                    byMaterial.set(line.materialRecordId, {
                        materialRecordId: line.materialRecordId,
                        itemName: line.itemName,
                        size: line.size,
                        unit: line.unit,
                        outstanding: remaining,
                    });
                }
            }
            return [...byMaterial.values()];
        }
        return effectiveVendorId ? itemsByVendor[effectiveVendorId] || [] : [];
    }, [usingPo, matchedPoLines, effectiveVendorId, itemsByVendor]);

    const selectedItem = itemOptions.find((o) => o.materialRecordId === materialId) || null;

    const plan = useMemo(() => {
        if (!effectiveVendorId || !materialId) return null;
        const parsed = Number(qty);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        return planDelivery({
            lines,
            vendorRecordId: effectiveVendorId,
            materialRecordId: materialId,
            poRecordId,
            qty: parsed,
        });
    }, [lines, effectiveVendorId, materialId, poRecordId, qty]);

    const messages = plan
        ? describePlan(plan, { unit: selectedItem?.unit || "", poId: usingPo ? poId.trim() : null })
        : [];

    const vendorHasNoOrders = Boolean(effectiveVendorId) && itemOptions.length === 0;

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

    const canSubmit =
        !pending &&
        photo.status === "done" &&
        Boolean(effectiveVendorId) &&
        Boolean(materialId) &&
        Number(qty) > 0 &&
        Boolean(receivedDate);

    return (
        <form action={formAction} className="mt-6 space-y-6">
            <input type="hidden" name="jobRecordId" value={jobRecordId} />
            <input type="hidden" name="vendorRecordId" value={effectiveVendorId} />
            <input type="hidden" name="materialRecordId" value={materialId} />
            <input type="hidden" name="poId" value={usingPo ? poId.trim() : ""} />
            <input type="hidden" name="packingListUrl" value={photo.url || ""} />
            <input type="hidden" name="packingListFilename" value={photo.filename || ""} />

            {/* --- Shape switch ------------------------------------------------ */}
            <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={hasPoNumber}
                        onChange={(e) => {
                            setHasPoNumber(e.target.checked);
                            setMaterialId("");
                            if (!e.target.checked) setPoId("");
                        }}
                    />
                    The packing list shows a PO number
                </label>

                {hasPoNumber && (
                    <div className="mt-3">
                        <label htmlFor="poIdInput" className="block text-sm font-medium">
                            PO number
                        </label>
                        <input
                            id="poIdInput"
                            value={poId}
                            onChange={(e) => {
                                setPoId(e.target.value);
                                setMaterialId("");
                            }}
                            placeholder="HYE-PO-YYYYMMDD-##"
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        {poId.trim() && matchedPoLines.length === 0 && (
                            <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                                No purchase order {poId.trim()} on {jobCode}. Check the number on the
                                packing list, or clear this box and pick the vendor instead.
                            </p>
                        )}
                        {matchedPoLines.length > 0 && (
                            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                                Vendor:{" "}
                                <span className="font-medium">
                                    {vendors.find((v) => v.id === poFixedVendorId)?.vendorName ??
                                        "Unknown vendor"}
                                </span>{" "}
                                — taken from {poId.trim()}, so it cannot disagree with the order.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* --- Vendor (only when no PO fixes it) --------------------------- */}
            {!usingPo && (
                <div>
                    <label htmlFor="vendorSelect" className="block text-sm font-medium">
                        Vendor who delivered
                    </label>
                    <select
                        id="vendorSelect"
                        value={vendorId}
                        onChange={(e) => {
                            setVendorId(e.target.value);
                            setMaterialId("");
                        }}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                        <option value="">Select a vendor…</option>
                        {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.vendorName}
                            </option>
                        ))}
                    </select>
                    {vendors.length === 0 && (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            No purchase order on {jobCode} has reached this app yet, so there is
                            nothing to record a delivery against. If site placed the order directly,
                            the purchase request and PO have to exist here first — raise the PR now
                            and record the delivery once its PO is generated. Keep the packing list
                            until then.
                        </p>
                    )}
                </div>
            )}

            {/* --- Item -------------------------------------------------------- */}
            <div>
                <label htmlFor="itemSelect" className="block text-sm font-medium">
                    Item
                </label>
                <select
                    id="itemSelect"
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                    disabled={!effectiveVendorId || itemOptions.length === 0}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <option value="">
                        {effectiveVendorId ? "Select an item…" : "Pick a vendor first…"}
                    </option>
                    {itemOptions.map((o) => (
                        <option key={o.materialRecordId} value={o.materialRecordId}>
                            {itemOptionLabel(o)}
                            {" — "}
                            {o.outstanding > 0 ? `${o.outstanding} outstanding` : "none outstanding"}
                        </option>
                    ))}
                </select>

                {/* Dead end (b)/(c): this vendor has no order on this job. */}
                {vendorHasNoOrders && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                        No purchase order on {jobCode} names this vendor. If site placed this order
                        directly, the purchase request and PO have to exist here before the delivery
                        can be recorded against them — raise the PR now, and record the delivery once
                        its PO is generated. Keep the packing list until then.
                    </p>
                )}

                {/* Dead end (a): the item is genuinely not on the list. */}
                {effectiveVendorId && itemOptions.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                        This list holds only materials from purchase orders on this job for this
                        vendor. If it was ordered from a different vendor, change the vendor above.
                        An order placed before this app recorded deliveries will not appear here —
                        keep the packing list and tell the office.
                    </p>
                )}

                {/* The fourth state: ordered, but already fully delivered. */}
                {selectedItem && selectedItem.outstanding === 0 && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                        Everything ordered from this vendor for this item on this job is already
                        recorded as delivered. Recording this will be flagged as over-delivery —
                        check the packing list against the order first.
                    </p>
                )}
            </div>

            {/* --- Quantity, date --------------------------------------------- */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="qtyInput" className="block text-sm font-medium">
                        Quantity that arrived{selectedItem?.unit ? ` (${selectedItem.unit})` : ""}
                    </label>
                    <input
                        id="qtyInput"
                        name="qty"
                        type="number"
                        min="1"
                        step="1"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                </div>
                <div>
                    <label htmlFor="receivedDateInput" className="block text-sm font-medium">
                        Received Date
                    </label>
                    <input
                        id="receivedDateInput"
                        name="receivedDate"
                        type="date"
                        value={receivedDate}
                        onChange={(e) => setReceivedDate(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                </div>
            </div>

            {/* --- Allocation preview ----------------------------------------- */}
            {plan && (
                <div className="rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                    <p className="font-medium">This will be recorded as:</p>
                    <ul className="mt-2 space-y-1">
                        {plan.rows.map((row, i) => (
                            <li key={i} className="flex justify-between gap-4">
                                <span>
                                    {row.line ? row.line.poId : "Not against any order"}
                                    {row.over && (
                                        <span className="ml-2 text-amber-700 dark:text-amber-500">
                                            over-delivery
                                        </span>
                                    )}
                                </span>
                                <span className="tabular-nums">
                                    {row.qty}
                                    {selectedItem?.unit ? ` ${selectedItem.unit}` : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {messages.length > 0 && (
                        <div className="mt-3 space-y-1 text-amber-700 dark:text-amber-500">
                            {messages.map((m) => (
                                <p key={m.key}>{m.text}</p>
                            ))}
                        </div>
                    )}
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
                        The app decides which order a delivery belongs to. Correcting an item or a
                        quantity later means deleting this delivery and entering it again.
                    </p>
                </div>
            )}

            {/* --- Packing list photo ----------------------------------------- */}
            <div>
                <label htmlFor="photoInput" className="block text-sm font-medium">
                    Packing list photo
                </label>
                <input
                    id="photoInput"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={onPhotoChange}
                    className="mt-1 block w-full text-sm"
                />
                {photo.status === "uploading" && (
                    <p className="mt-1 text-xs text-zinc-500">Uploading {photo.filename}…</p>
                )}
                {photo.status === "done" && (
                    <p className="mt-1 text-xs text-green-700 dark:text-green-500">
                        {photo.filename} attached
                    </p>
                )}
                {photo.status === "error" && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-500">
                        Upload failed: {photo.error}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="notesInput" className="block text-sm font-medium">
                    Notes <span className="font-normal text-zinc-500">(optional)</span>
                </label>
                <textarea
                    id="notesInput"
                    name="notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Damage, a partial pallet, who signed for it…"
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
            </div>

            {state?.error && (
                <p className="text-sm text-red-700 dark:text-red-500">{state.error}</p>
            )}

            <button
                type="submit"
                disabled={!canSubmit}
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
                {pending ? "Recording…" : "Record delivery"}
            </button>
        </form>
    );
}

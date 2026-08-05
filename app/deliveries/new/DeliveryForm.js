"use client";

import { useActionState, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { createDeliveryAction } from "./actions";
import {
    availableItemOptions,
    buildItemOptions,
    describePlan,
    itemOptionLabel,
    planDelivery,
} from "@/lib/deliveryAllocation";

// EVERY IMPORT HERE MUST BE CLIENT-SAFE. lib/deliveryAllocation.js imports only
// lib/materialPriceView.js -> lib/itemNaming.js, none of which reach
// lib/airtable/. That is load-bearing rather than incidental: this file used to
// import itemOptionLabel from lib/deliveryCandidates.js, which pulls in
// lib/airtable/client.js, and client.js throws `Missing AIRTABLE_API_KEY` at
// module load — so selecting a job blew up in the browser. Importing a module
// EXECUTES it; "the readers are never called on this side" was not a defence.
// scripts/tests/offline/client-import-safety.mjs now fails on any such import.

const EMPTY_ROW = { materialRecordId: "", qty: "" };

/**
 * One page: a header that narrows, then a repeating list of items (#162).
 *
 * A packing list usually names SEVERAL items from one vendor on one day, so the
 * item rows repeat the way the invoice form's do. What does not repeat is the
 * header — job, vendor, optional PO number, date, photo — because those are
 * properties of the arrival, not of a line.
 *
 * Job -> vendor -> items, each narrowing the next. WITHOUT a PO number the
 * recorder picks the vendor and then the items, in that order, because the item
 * list is vendor-narrowed. WITH one, the PO fixes the vendor — the packing list
 * already says who shipped — so the vendor picker disappears and the item list
 * narrows to that PO's lines. Fewer decisions, and the ones left cannot
 * contradict the document.
 *
 * THE PREVIEW RUNS THE PRODUCTION ALLOCATION, per row. planDelivery is pure, so
 * this calls the same function createDeliveryAction re-runs on submit; what the
 * form promises and what the server writes cannot be two implementations that
 * drift. It is still only a preview — the server re-reads and re-allocates,
 * because a PO can be withdrawn or another arrival recorded while this page sits
 * open.
 */
export default function DeliveryForm({ jobs, lines, vendorNames }) {
    const [state, formAction, pending] = useActionState(createDeliveryAction, {});

    // A single accessible job is preselected: making someone choose from a list of
    // one is a step with no decision in it.
    const [jobRecordId, setJobRecordId] = useState(jobs.length === 1 ? jobs[0].id : "");
    const [hasPoNumber, setHasPoNumber] = useState(false);
    const [poId, setPoId] = useState("");
    const [vendorId, setVendorId] = useState("");
    const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
    const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState("");
    const [photo, setPhoto] = useState({ status: "empty" });

    const selectedJob = jobs.find((j) => j.id === jobRecordId) || null;

    // Everything below narrows within the selected job's lines, so no downstream
    // control can offer something from another job.
    const jobLines = useMemo(
        () => (jobRecordId ? lines.filter((l) => l.jobRecordId === jobRecordId) : []),
        [lines, jobRecordId]
    );

    const vendors = useMemo(() => {
        const ids = new Set(jobLines.map((l) => l.vendorRecordId).filter(Boolean));
        return [...ids]
            .map((id) => ({ id, vendorName: vendorNames[id] ?? "Unknown vendor" }))
            .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    }, [jobLines, vendorNames]);

    // A typed PO number fixes the vendor, resolved from the lines the page already
    // sent — no round trip. An unrecognized number leaves the vendor unset, which
    // the server refuses with a specific message rather than this form guessing.
    const matchedPoLines = useMemo(() => {
        const wanted = poId.trim().toUpperCase();
        if (!wanted) return [];
        return jobLines.filter((l) => (l.poId || "").toUpperCase() === wanted);
    }, [poId, jobLines]);

    const poFixedVendorId = matchedPoLines[0]?.vendorRecordId ?? "";
    const usingPo = hasPoNumber && Boolean(poId.trim());
    const effectiveVendorId = usingPo ? poFixedVendorId : vendorId;
    const poRecordId = usingPo ? matchedPoLines[0]?.poRecordId ?? null : null;

    // With a PO in play the item list is that PO's lines; otherwise every material
    // the vendor supplied to this job. Both are wider than the allocation candidate
    // set on purpose — a fully delivered item stays listed, with 0 undelivered, so
    // the screen can say what is true about it instead of hiding it behind "not in
    // the dropdown".
    const itemOptions = useMemo(
        () => buildItemOptions(usingPo ? matchedPoLines : jobLines, effectiveVendorId),
        [usingPo, matchedPoLines, jobLines, effectiveVendorId]
    );
    const optionByMaterial = useMemo(
        () => new Map(itemOptions.map((o) => [o.materialRecordId, o])),
        [itemOptions]
    );

    /**
     * One plan per material. The dropdowns stop a material appearing on two rows
     * (availableItemOptions), so in practice this is one plan per row — but the
     * grouping stays, mirroring the action, which sums duplicates because a Server
     * Action is callable regardless of what this form rendered.
     */
    const plansByMaterial = useMemo(() => {
        if (!effectiveVendorId) return new Map();
        const wanted = new Map();
        for (const row of rows) {
            const q = Number(row.qty);
            if (!row.materialRecordId || !Number.isFinite(q) || q <= 0) continue;
            wanted.set(row.materialRecordId, (wanted.get(row.materialRecordId) || 0) + q);
        }
        const out = new Map();
        for (const [material, qty] of wanted) {
            out.set(
                material,
                planDelivery({
                    lines: jobLines,
                    vendorRecordId: effectiveVendorId,
                    materialRecordId: material,
                    poRecordId,
                    qty,
                })
            );
        }
        return out;
    }, [rows, jobLines, effectiveVendorId, poRecordId]);

    // Nothing left to add once every option is on a row, so the control that would
    // add an unfillable row is disabled rather than left to produce one.
    const allItemsClaimed =
        itemOptions.length > 0 &&
        new Set(rows.map((r) => r.materialRecordId).filter(Boolean)).size >= itemOptions.length;

    const vendorHasNoItems = Boolean(effectiveVendorId) && itemOptions.length === 0;

    function pickJob(id) {
        setJobRecordId(id);
        // Everything downstream was narrowed by the old job, so none of it can
        // survive the change.
        setVendorId("");
        setPoId("");
        setHasPoNumber(false);
        setRows([{ ...EMPTY_ROW }]);
    }

    function pickVendor(id) {
        setVendorId(id);
        setRows([{ ...EMPTY_ROW }]);
    }

    function updateRow(index, field, value) {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    }
    function addRow() {
        setRows((prev) => [...prev, { ...EMPTY_ROW }]);
    }
    function removeRow(index) {
        setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
    }

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

    const filledRows = rows.filter((r) => r.materialRecordId && Number(r.qty) > 0);
    // NO BLOCKED-PLAN BRANCH HERE, and that is measured rather than assumed (#165).
    // This form cannot produce one: with a PO in use the item options are built
    // from that PO's OWN lines (see itemOptions above), and both the checkbox and
    // the PO input reset the rows, so a selection made before the PO was typed
    // cannot survive into a mismatch either. Every material a row can hold
    // therefore has a candidate line, so planDelivery never returns `blocked`.
    // The refusal lives in createDeliveryAction, which is where it is reachable —
    // a PO can be withdrawn while this form sits open, and the action re-reads.
    const canSubmit =
        !pending &&
        photo.status === "done" &&
        Boolean(jobRecordId) &&
        Boolean(effectiveVendorId) &&
        filledRows.length > 0 &&
        filledRows.length === rows.filter((r) => r.materialRecordId || r.qty !== "").length &&
        Boolean(receivedDate);

    const inputClass =
        "mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

    return (
        <form action={formAction} className="mt-6 space-y-6">
            <input type="hidden" name="jobRecordId" value={jobRecordId} />
            <input type="hidden" name="vendorRecordId" value={effectiveVendorId} />
            <input type="hidden" name="poId" value={usingPo ? poId.trim() : ""} />
            <input type="hidden" name="itemsJson" value={JSON.stringify(filledRows)} />
            <input type="hidden" name="packingListUrl" value={photo.url || ""} />
            <input type="hidden" name="packingListFilename" value={photo.filename || ""} />

            {/* --- Job ---------------------------------------------------------- */}
            <div>
                <label htmlFor="jobSelect" className="block text-sm font-medium">
                    Job
                </label>
                <select
                    id="jobSelect"
                    value={jobRecordId}
                    onChange={(e) => pickJob(e.target.value)}
                    className={inputClass}
                >
                    <option value="">Select a job…</option>
                    {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                            {j.jobCode}
                            {j.jobName ? ` — ${j.jobName}` : ""}
                        </option>
                    ))}
                </select>
            </div>

            {/* --- Optional PO number ------------------------------------------- */}
            <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={hasPoNumber}
                        disabled={!jobRecordId}
                        onChange={(e) => {
                            setHasPoNumber(e.target.checked);
                            setRows([{ ...EMPTY_ROW }]);
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
                                setRows([{ ...EMPTY_ROW }]);
                            }}
                            placeholder="HYE-PO-YYYYMMDD-##"
                            className={inputClass}
                        />
                        {poId.trim() && matchedPoLines.length === 0 && (
                            <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                                No purchase order {poId.trim()} on{" "}
                                {selectedJob?.jobCode ?? "this job"}. Check the number on the packing
                                list, or clear this box and pick the vendor instead.
                            </p>
                        )}
                        {matchedPoLines.length > 0 && (
                            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                                Vendor:{" "}
                                <span className="font-medium">
                                    {vendorNames[poFixedVendorId] ?? "Unknown vendor"}
                                </span>{" "}
                                — taken from {poId.trim()}, so it cannot disagree with the order.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* --- Vendor (only when no PO fixes it) ---------------------------- */}
            {!usingPo && (
                <div>
                    <label htmlFor="vendorSelect" className="block text-sm font-medium">
                        Vendor who delivered
                    </label>
                    <select
                        id="vendorSelect"
                        value={vendorId}
                        onChange={(e) => pickVendor(e.target.value)}
                        disabled={!jobRecordId || vendors.length === 0}
                        className={`${inputClass} disabled:opacity-50`}
                    >
                        <option value="">
                            {jobRecordId ? "Select a vendor…" : "Pick a job first…"}
                        </option>
                        {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.vendorName}
                            </option>
                        ))}
                    </select>
                    {jobRecordId && vendors.length === 0 && (
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                            No purchase order on {selectedJob?.jobCode} has reached this app yet, so
                            there is nothing to record a delivery against. If site placed the order
                            directly, the purchase request and PO have to exist here first — raise the
                            PR now and record the delivery once its PO is generated. Keep the packing
                            list until then.
                        </p>
                    )}
                </div>
            )}

            {/* --- Items -------------------------------------------------------- */}
            <div>
                <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-medium">Items on the packing list</h2>
                    <button
                        type="button"
                        onClick={addRow}
                        disabled={!effectiveVendorId || itemOptions.length === 0 || allItemsClaimed}
                        title={
                            allItemsClaimed
                                ? "Every item this vendor supplied to this job is already on the delivery"
                                : undefined
                        }
                        className="text-sm underline disabled:opacity-50"
                    >
                        + Add item
                    </button>
                </div>

                {vendorHasNoItems && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                        No purchase order on {selectedJob?.jobCode} names this vendor. If site placed
                        this order directly, the purchase request and PO have to exist here before the
                        delivery can be recorded against them — raise the PR now, and record the
                        delivery once its PO is generated. Keep the packing list until then.
                    </p>
                )}

                <div className="mt-2 space-y-3">
                    {rows.map((row, i) => {
                        const option = optionByMaterial.get(row.materialRecordId) || null;
                        const plan = plansByMaterial.get(row.materialRecordId) || null;
                        // An item another row already claimed is not offered here —
                        // same rule as the invoice form's per-line PO Item dropdown
                        // (#91). This row's own selection always stays, or the
                        // select would render blank and lose it.
                        const rowOptions = availableItemOptions(itemOptions, rows, i);
                        // The preview belongs to the material. The dropdowns keep a
                        // material off two rows, so this is normally the only row
                        // for it; the guard stays because a duplicate arriving some
                        // other way must not print the same allocation twice.
                        const isFirstOfMaterial =
                            rows.findIndex((r) => r.materialRecordId === row.materialRecordId) === i;
                        const messages =
                            plan && isFirstOfMaterial
                                ? describePlan(plan, {
                                      unit: option?.unit || "",
                                      poId: usingPo ? poId.trim() : null,
                                  })
                                : [];

                        return (
                            <div
                                key={i}
                                className="rounded border border-zinc-200 p-3 dark:border-zinc-800"
                            >
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label
                                            htmlFor={`item-${i}`}
                                            className="block text-xs text-zinc-500"
                                        >
                                            Item
                                        </label>
                                        <select
                                            id={`item-${i}`}
                                            value={row.materialRecordId}
                                            onChange={(e) =>
                                                updateRow(i, "materialRecordId", e.target.value)
                                            }
                                            disabled={!effectiveVendorId || itemOptions.length === 0}
                                            className={`${inputClass} disabled:opacity-50`}
                                        >
                                            <option value="">
                                                {effectiveVendorId
                                                    ? "Select an item…"
                                                    : "Pick a vendor first…"}
                                            </option>
                                            {rowOptions.map((o) => (
                                                <option
                                                    key={o.materialRecordId}
                                                    value={o.materialRecordId}
                                                >
                                                    {itemOptionLabel(o)}
                                                    {" — "}
                                                    {o.undelivered > 0
                                                        ? `${o.undelivered} undelivered`
                                                        : "fully delivered"}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-32">
                                        <label
                                            htmlFor={`qty-${i}`}
                                            className="block text-xs text-zinc-500"
                                        >
                                            Qty{option?.unit ? ` (${option.unit})` : ""}
                                        </label>
                                        <input
                                            id={`qty-${i}`}
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={row.qty}
                                            onChange={(e) => updateRow(i, "qty", e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => removeRow(i)}
                                            disabled={rows.length === 1}
                                            aria-label={`Remove item ${i + 1}`}
                                            className="px-2 py-2 text-sm text-zinc-500 disabled:opacity-30"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                {/* The fourth state: ordered, but already fully delivered. */}
                                {option && option.undelivered === 0 && (
                                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                                        Everything ordered from this vendor for this item on this job
                                        is already delivered. Recording it will be flagged as
                                        over-delivered — check the packing list against the order.
                                    </p>
                                )}

                                {plan && isFirstOfMaterial && (
                                    <div className="mt-2 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-900">
                                        <ul className="space-y-0.5">
                                            {plan.rows.map((r, k) => (
                                                <li key={k} className="flex justify-between gap-4">
                                                    <span>
                                                        {r.line ? r.line.poId : "Not against any order"}
                                                        {r.over && (
                                                            <span className="ml-2 text-amber-700 dark:text-amber-500">
                                                                over-delivered
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {r.qty}
                                                        {option?.unit ? ` ${option.unit}` : ""}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        {messages.map((m) => (
                                            <p
                                                key={m.key}
                                                className="mt-1 text-amber-700 dark:text-amber-500"
                                            >
                                                {m.text}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {effectiveVendorId && itemOptions.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                        This list holds only materials from purchase orders on this job for this
                        vendor. If something was ordered from a different vendor, record it as its own
                        delivery. An order placed before this app recorded deliveries will not appear
                        here — keep the packing list and tell the office.
                    </p>
                )}
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                    The app decides which order each item belongs to. Correcting an item or a quantity
                    later means deleting this delivery and entering it again.
                </p>
            </div>

            {/* --- Date, photo, notes ------------------------------------------- */}
            <div className="grid grid-cols-2 gap-4">
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
                        className={inputClass}
                    />
                </div>
            </div>

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
                    className={inputClass}
                />
            </div>

            {state?.error && <p className="text-sm text-red-700 dark:text-red-500">{state.error}</p>}

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

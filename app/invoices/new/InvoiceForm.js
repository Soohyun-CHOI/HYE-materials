"use client";

import { useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { upload } from "@vercel/blob/client";
import { createInvoiceAction } from "./actions";

// poItemTouched: false until the user (or #57's auto-default below) makes
// an explicit choice in the PO Item dropdown — distinguishes "still
// unset" from "deliberately Other (free text)", both of which otherwise
// collapse to poItemRecordId: "". unitPriceEditing: whether the Unit
// Price lock (#57) is currently open for a linked PO Item; irrelevant
// (and ignored) once poItemRecordId is empty, since free-text lines were
// never locked to begin with.
const EMPTY_ITEM = {
    itemName: "",
    qty: "",
    unitPrice: "",
    poRecordId: "",
    poItemRecordId: "",
    poItemTouched: false,
    unitPriceEditing: false,
    remark: "",
};

// Issue #57 — items with remaining un-invoiced qty first (stable, so
// relative order within each group is untouched), fully-invoiced/over-
// invoiced pushed to the bottom rather than hidden.
function sortByRemaining(poItems) {
    return [...poItems].sort((a, b) => {
        const aOpen = a.remainingQty > 0 ? 0 : 1;
        const bOpen = b.remainingQty > 0 ? 0 : 1;
        return aOpen - bOpen;
    });
}

// Issue #57 — the one place that decides whether a line gets defaulted to
// its PO's first (Remaining-sorted) item. Pure function of (item, cache)
// rather than a setItems side effect, so it's usable both the moment a
// line's poRecordId is first assigned/changed (addItem, updateItem,
// applyPoSelection's single-PO-force branch — cases where that PO's items
// may *already* be cached from earlier in the session) and again later
// when a fetch that was still in flight at that moment finishes
// (applyDefaultPoItemSelection). Never touches a line once poItemTouched
// is true, or one with no PO / whose PO's items aren't loaded yet.
function defaultedItem(item, cache) {
    if (item.poItemTouched || !item.poRecordId) return item;
    const entry = cache[item.poRecordId];
    if (!entry || entry.status !== "done" || entry.items.length === 0) return item;
    const first = entry.items[0];
    return {
        ...item,
        poItemRecordId: first.id,
        itemName: first.itemName,
        unitPrice: first.rate != null ? String(first.rate) : item.unitPrice,
    };
}
const inputClass =
    "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-black";

// "PDF Upload" vs "Manual Entry" (added after the initial build) is a
// single form/single state tree with two tabs, not two separate forms —
// PDF or hand-typed, it's the same underlying task (entering an invoice),
// and switching tabs must never lose whatever's already been
// attached/detected/typed. So `activeTab` only ever changes which order
// these render helpers appear in below — every one of them reads/writes
// the exact same state regardless of which tab is active, and PO
// detection (issue #46) always runs on any file upload in either tab
// (a product decision — detection is harmless best-effort, so there's no
// real reason to disable it just because someone started on the Manual
// tab).
const TABS = [
    { id: "pdf", label: "PDF Upload" },
    { id: "manual", label: "Manual Entry" },
];

// The common case (per product decision) is one PO with several invoices —
// an invoice spanning several POs is the supported edge case, not the
// default flow. So "PO" is picked once at the header and seeds every new
// line item's PO, rather than forcing an independent pick on every single
// line — but each line's PO can still be changed on its own for the edge
// case, since Invoice Items each carry their own required PO link.
export default function InvoiceForm({ vendors, pos }) {
    const [state, formAction, pending] = useActionState(createInvoiceAction, null);
    // Default "pdf" — the primary path most people try first.
    const [activeTab, setActiveTab] = useState("pdf");

    // Local copy, not just the prop directly — issue #46's detection can
    // confirm a PO that was created *after* this page's initial server-side
    // getAllPOs() fetch (e.g. approved moments earlier in the same
    // session), which wouldn't be in `pos` yet. Without this, the <select>
    // would have no matching <option> for a detected PO: the browser then
    // visually renders some other option as "selected" while the real
    // value silently stays correct underneath — a misleading display, not
    // just a cosmetic gap, since the user has no reason to notice the
    // mismatch and fix it before submitting.
    const [posList, setPosList] = useState(pos);
    const [vendorId, setVendorId] = useState("");
    // Header PO is multi-select — this invoice can cover more than one PO
    // (the supported edge case). `poPickerValue` is just the "add a PO"
    // dropdown's own pending value, mirroring SignerList.js's add-then-
    // clear pattern; it never itself represents which POs are selected.
    const [selectedPoIds, setSelectedPoIds] = useState([]);
    const [poPickerValue, setPoPickerValue] = useState("");
    const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
    // Unlike Quotations (#34), the Invoice file is required, not optional —
    // every received vendor invoice must be kept on file — so submit stays
    // disabled until this reaches "done" rather than letting the form
    // proceed without one. Same client-side direct-upload pattern as
    // Quotations otherwise: uploads the moment it's picked (background),
    // never blocks on Server Action body-size limits.
    const [invoiceFile, setInvoiceFile] = useState({ status: "idle" });
    // Issue #46 — best-effort, informational only: null | { level: "info" |
    // "warning", message }. Never blocks anything; the manual Vendor/PO
    // pickers below are the same controls this just pre-fills, so whatever
    // it sets is still fully editable before submit.
    const [poDetection, setPoDetection] = useState(null);
    // Issue #51 — { [poRecordId]: { status: "loading"|"done"|"error", items } }.
    // Keyed indefinitely, never evicted on remove: unlike posList above, PO
    // Items are a frozen snapshot taken at PO-generation time (CLAUDE.md —
    // no edit path exists anywhere in this codebase), so a PO that's
    // removed and re-added mid-session can safely reuse what's already
    // cached instead of re-fetching. The status field exists purely so a
    // failed request doesn't get mistaken for "this PO genuinely has zero
    // items" — an "error" entry is retried the next time that PO re-enters
    // selectedPoIds.
    const [poItemsCache, setPoItemsCache] = useState({});
    // Issue #57 — Shipping Fee/Amount Due were plain uncontrolled inputs
    // (read only via FormData at submit) until now; they need to be
    // controlled state so the calculated-total preview can react to them
    // live. `amountDue` is renamed `vendorStatedTotal` here to match its
    // real role (the ground-truth figure from the vendor's own document,
    // still submitted under the `amountDue` form field/Airtable column —
    // only the label and local variable name change).
    const [vendorStatedTotal, setVendorStatedTotal] = useState("");
    const [shippingFee, setShippingFee] = useState("");
    const [tariffEnabled, setTariffEnabled] = useState(false);
    const [tariff, setTariff] = useState("");
    // "Show all / search closed POs" — deliberately separate from posList/
    // posForVendor: a result only ever gets merged into posList (below),
    // never used to render its own results UI, so the existing "Select a
    // PO to add..." dropdown stays the single place a PO is ever chosen
    // from (same principle as #46's detection reusing that same dropdown).
    const [showClosedSearch, setShowClosedSearch] = useState(false);
    const [closedSearchQuery, setClosedSearchQuery] = useState("");
    const [closedSearchStatus, setClosedSearchStatus] = useState("idle");
    const [closedSearchResultCount, setClosedSearchResultCount] = useState(0);
    const closedSearchTimeoutRef = useRef(null);

    async function handleInvoiceFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setInvoiceFile({ status: "uploading", filename: file.name });
        setPoDetection(null);
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/invoices/upload",
            });
            setInvoiceFile({ status: "done", url: blob.url, filename: file.name });
            await detectAndApplyPOs(blob.url);
        } catch (err) {
            setInvoiceFile({ status: "error", filename: file.name, error: err.message });
        }
    }

    async function detectAndApplyPOs(blobUrl) {
        try {
            const res = await fetch("/api/invoices/detect-po", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blobUrl }),
            });
            const { confirmed = [], unconfirmed = [], vendorConflict = false } = await res.json();

            if (vendorConflict) {
                setPoDetection({
                    level: "warning",
                    message: `Found PO references from more than one Vendor (${confirmed
                        .map((c) => c.poId)
                        .join(", ")}) — please verify and select manually below.`,
                });
                return;
            }

            if (confirmed.length === 0) {
                if (unconfirmed.length > 0) {
                    setPoDetection({
                        level: "warning",
                        message: `Found what looks like a PO number (${unconfirmed.join(
                            ", "
                        )}) but no matching PO exists — check it wasn't mistyped, or select manually below.`,
                    });
                }
                return; // Nothing to auto-fill — falls back to manual entry as-is.
            }

            // Merge any confirmed PO that isn't already in posList — see
            // the posList comment above for why this can happen (a PO
            // created after this page's own data was fetched).
            setPosList((prev) => {
                const missing = confirmed.filter((c) => !prev.some((po) => po.id === c.recordId));
                if (missing.length === 0) return prev;
                return [
                    ...prev,
                    ...missing.map((c) => ({ id: c.recordId, poId: c.poId, vendorId: c.vendorId })),
                ];
            });

            // Detection is more authoritative than an early Vendor guess —
            // the item PO pickers are Vendor-scoped (see posForVendor
            // below), so the detected PO can't even be selected until the
            // matching Vendor is set.
            if (confirmed[0].vendorId) {
                setVendorId(confirmed[0].vendorId);
            }

            applyPoSelection(confirmed.map((c) => c.recordId));

            if (confirmed.length === 1) {
                setPoDetection({
                    level: "info",
                    message: `Detected PO: ${confirmed[0].poId} (auto-filled below).`,
                });
            } else {
                // Multi-PO case: applyPoSelection already resets any item
                // whose PO fell out of the new selection, but there's still
                // no single "default" to seed a brand-new invoice's blank
                // row with — so scaffold one item row per detected PO
                // instead, each pre-set to a different one. Only if every
                // current item is still untouched (no name/qty/price
                // entered), so this never overwrites real input from
                // someone who uploaded the file after already starting to
                // fill the form in.
                setItems((prev) => {
                    const pristine = prev.every((item) => !item.itemName && !item.qty && !item.unitPrice);
                    if (!pristine) return prev;
                    return confirmed.map((c) =>
                        defaultedItem({ ...EMPTY_ITEM, poRecordId: c.recordId }, poItemsCache)
                    );
                });
                const unconfirmedNote =
                    unconfirmed.length > 0
                        ? ` (${unconfirmed.length} unrecognized reference${unconfirmed.length > 1 ? "s" : ""} ignored)`
                        : "";
                setPoDetection({
                    level: "info",
                    message: `Detected ${confirmed.length} POs: ${confirmed
                        .map((c) => c.poId)
                        .join(", ")} — auto-filled below, verify each item's assignment.${unconfirmedNote}`,
                });
            }
        } catch (err) {
            // Silent — convenience feature only, manual entry is always
            // available regardless of whether this request itself failed.
            console.error("PO detection request failed", err);
        }
    }

    const posForVendor = useMemo(
        () => posList.filter((po) => po.vendorId === vendorId),
        [posList, vendorId]
    );
    // What each item's own PO <select> is allowed to offer — restricted to
    // the header's selection, not the full Vendor PO list, since an item
    // can only belong to a PO this invoice actually claims to cover.
    const selectedPos = useMemo(
        () => posList.filter((po) => selectedPoIds.includes(po.id)),
        [posList, selectedPoIds]
    );

    // Single sync point for every way the header PO selection can change —
    // manual add, manual remove, or issue #46's detection setting it
    // wholesale. Exactly one PO selected means there's no real choice left
    // for any line, so every item is forced to it (the per-item picker
    // isn't even rendered in that case — see renderItemsSection). Two or
    // more means each item keeps its own PO *if* it's still one of the
    // selected ones, otherwise it's reset to unset rather than silently
    // reassigned to something the user didn't pick.
    function applyPoSelection(newSelectedPoIds) {
        // Issue #51 — newly-selected POs need their PO Items loaded before
        // the per-item dropdown (renderItemsSection) has anything to show.
        // Computed against the current selectedPoIds closure, not derived
        // inside a useEffect, to match this component's existing style of
        // one imperative sync point rather than reactive watchers.
        const added = newSelectedPoIds.filter((id) => !selectedPoIds.includes(id));
        added.forEach((id) => ensurePoItemsLoaded(id));

        setSelectedPoIds(newSelectedPoIds);
        if (newSelectedPoIds.length === 1) {
            const only = newSelectedPoIds[0];
            setItems((prev) =>
                prev.map((item) => {
                    // Already on the surviving PO — leave poItemRecordId/
                    // poItemTouched alone, just let defaultedItem fill in a
                    // default if it's still pristine and the cache is
                    // ready. Actually changing PO (the other branch this
                    // collapsed from) needs the same reset updateItem's
                    // manual PO change uses — a poItemRecordId from the PO
                    // this line is leaving is never valid for `only`.
                    if (item.poRecordId === only) return defaultedItem(item, poItemsCache);
                    return defaultedItem(
                        {
                            ...item,
                            poRecordId: only,
                            poItemRecordId: "",
                            poItemTouched: false,
                            unitPriceEditing: false,
                        },
                        poItemsCache
                    );
                })
            );
        } else {
            setItems((prev) =>
                prev.map((item) =>
                    newSelectedPoIds.includes(item.poRecordId) ? item : { ...item, poRecordId: "" }
                )
            );
        }
    }

    // Fetch-if-missing, guarded against duplicate in-flight requests for
    // the same PO. Never re-fetches a "done" entry (see poItemsCache
    // comment above for why that's safe) but always retries an "error" one.
    function ensurePoItemsLoaded(poRecordId) {
        setPoItemsCache((prev) => {
            const entry = prev[poRecordId];
            if (entry && (entry.status === "done" || entry.status === "loading")) return prev;
            fetchPoItems(poRecordId);
            return { ...prev, [poRecordId]: { status: "loading", items: [] } };
        });
    }

    async function fetchPoItems(poRecordId) {
        try {
            const res = await fetch(`/api/pos/${poRecordId}/items`);
            if (!res.ok) throw new Error("Request failed");
            const { items: rawItems } = await res.json();
            const sorted = sortByRemaining(rawItems);
            setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "done", items: sorted } }));
            applyDefaultPoItemSelection(poRecordId, sorted);
        } catch (err) {
            console.error("Failed to load PO Items for", poRecordId, err);
            setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "error", items: [] } }));
        }
    }

    // Issue #57 — once a PO's items finish loading, any line still pointing
    // at that PO with poItemTouched still false gets defaulted to the
    // first item in Remaining-sorted order — a UI affordance making clear
    // the dropdown is the primary path, not a guess at the correct item.
    // Thin wrapper around defaultedItem: builds a one-PO cache override so
    // it only ever touches lines pointing at this poRecordId, using data
    // that (per the caller, fetchPoItems) isn't in poItemsCache state yet.
    function applyDefaultPoItemSelection(poRecordId, sortedItems) {
        if (sortedItems.length === 0) return;
        const cacheOverride = { [poRecordId]: { status: "done", items: sortedItems } };
        setItems((prev) => prev.map((item) => defaultedItem(item, cacheOverride)));
    }

    function handleVendorChange(e) {
        const newVendorId = e.target.value;
        setVendorId(newVendorId);
        // POs picked under the previous Vendor almost certainly don't
        // belong to the new one — clear rather than leave stale, now-
        // invalid selections sitting in state.
        setPoPickerValue("");
        applyPoSelection([]);
    }

    function handleAddPo() {
        if (!poPickerValue) return;
        applyPoSelection([...selectedPoIds, poPickerValue]);
        setPoPickerValue("");
    }

    function handleRemovePo(poId) {
        applyPoSelection(selectedPoIds.filter((id) => id !== poId));
    }

    // Issue #57 — debounced (300ms), server-side on every keystroke after
    // the pause, never a client-side filter over posList. A result is only
    // ever merged into posList (same "merge what's missing" pattern #46's
    // detection already uses) — there's no separate results list rendered
    // here, so the existing "Select a PO to add..." dropdown stays the one
    // place a PO is ever picked from.
    function handleClosedSearchChange(e) {
        const q = e.target.value;
        setClosedSearchQuery(q);
        if (closedSearchTimeoutRef.current) clearTimeout(closedSearchTimeoutRef.current);

        if (!q.trim()) {
            setClosedSearchStatus("idle");
            return;
        }

        setClosedSearchStatus("loading");
        closedSearchTimeoutRef.current = setTimeout(() => runClosedSearch(q), 300);
    }

    async function runClosedSearch(q) {
        try {
            const res = await fetch(`/api/pos/search?q=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error("Request failed");
            const { pos: results } = await res.json();
            setPosList((prev) => {
                const missing = results.filter((r) => !prev.some((po) => po.id === r.id));
                if (missing.length === 0) return prev;
                return [...prev, ...missing];
            });
            setClosedSearchResultCount(results.length);
            setClosedSearchStatus("done");
        } catch (err) {
            console.error("PO search failed", err);
            setClosedSearchStatus("error");
        }
    }

    function addItem() {
        // Issue #57 — routed through defaultedItem too: the new row's PO
        // (selectedPoIds[0]) may already have its items cached from
        // earlier in the session, in which case there's no fetch here to
        // trigger applyDefaultPoItemSelection later — this is the only
        // chance to default it.
        const fresh = { ...EMPTY_ITEM, poRecordId: selectedPoIds[0] || "" };
        setItems((prev) => [...prev, defaultedItem(fresh, poItemsCache)]);
    }

    function removeItem(index) {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }

    function updateItem(index, field, value) {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;
                if (field === "poRecordId") {
                    // Issue #51 — a PO Item picked under the line's previous
                    // PO almost certainly doesn't belong to the new one
                    // (same reasoning as handleVendorChange clearing PO
                    // selection above). Item Name is left as-is rather than
                    // cleared — it becomes ordinary editable free text
                    // instead of a stale-but-still-accurate label.
                    // Issue #57 — poItemTouched/unitPriceEditing reset too,
                    // and routed through defaultedItem: the new PO's items
                    // might already be cached (e.g. switching back to a PO
                    // used earlier on this same invoice), in which case
                    // there's no fetch here to trigger the default later.
                    return defaultedItem(
                        {
                            ...item,
                            poRecordId: value,
                            poItemRecordId: "",
                            poItemTouched: false,
                            unitPriceEditing: false,
                        },
                        poItemsCache
                    );
                }
                return { ...item, [field]: value };
            })
        );
    }

    // Issue #51 — the single sync point for a line's PO Item choice.
    // Selecting a real PO Item copies its name (and, per #57, its Rate
    // into Unit Price, freshly re-locked) in; selecting empty means
    // "Other (free text)". Issue #57 — poItemTouched is set true on any
    // explicit choice here (including Other), so applyDefaultPoItemSelection
    // never later overwrites a deliberate pick with its own default.
    function updatePoItemSelection(index, poItemRecordId) {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;
                if (!poItemRecordId) {
                    return { ...item, poItemRecordId: "", poItemTouched: true };
                }
                const candidates = poItemsCache[item.poRecordId]?.items || [];
                const matched = candidates.find((poItem) => poItem.id === poItemRecordId);
                return {
                    ...item,
                    poItemRecordId,
                    poItemTouched: true,
                    itemName: matched ? matched.itemName : item.itemName,
                    unitPrice: matched && matched.rate != null ? String(matched.rate) : item.unitPrice,
                    unitPriceEditing: false,
                };
            })
        );
    }

    const itemsTotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        return sum + qty * unitPrice;
    }, 0);

    // Issue #57 — sanity-check preview only, never what's stored (Amount
    // Due/vendorStatedTotal is). Tariff only counts once the optional
    // field is actually shown, matching what's actually submitted.
    const calculatedTotal =
        itemsTotal + (parseFloat(shippingFee) || 0) + (tariffEnabled ? parseFloat(tariff) || 0 : 0);
    const totalsMismatch =
        vendorStatedTotal !== "" &&
        !Number.isNaN(parseFloat(vendorStatedTotal)) &&
        Math.abs(parseFloat(vendorStatedTotal) - calculatedTotal) > 0.01;

    function renderHeaderFields() {
        return (
            <div className="space-y-4">
                <div>
                    <label htmlFor="vendorId" className="block text-sm font-medium">
                        Vendor
                    </label>
                    <select
                        id="vendorId"
                        name="vendorId"
                        value={vendorId}
                        onChange={handleVendorChange}
                        required
                        className={fieldClass}
                    >
                        <option value="" disabled>
                            Select a Vendor
                        </option>
                        {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.vendorName}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="vendorInvoiceCode" className="block text-sm font-medium">
                        Vendor Invoice #
                    </label>
                    <input
                        id="vendorInvoiceCode"
                        name="vendorInvoiceCode"
                        placeholder="The vendor's own invoice number, as printed on their document"
                        className={fieldClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="issueDate" className="block text-sm font-medium">
                            Issue Date
                        </label>
                        <input type="date" id="issueDate" name="issueDate" required className={fieldClass} />
                    </div>
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium">
                            Due Date
                        </label>
                        <input type="date" id="dueDate" name="dueDate" className={fieldClass} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="amountDue" className="block text-sm font-medium">
                            Vendor&apos;s Stated Total
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="amountDue"
                            name="amountDue"
                            required
                            value={vendorStatedTotal}
                            onChange={(e) => setVendorStatedTotal(e.target.value)}
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="shippingFee" className="block text-sm font-medium">
                            Shipping Fee
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="shippingFee"
                            name="shippingFee"
                            value={shippingFee}
                            onChange={(e) => setShippingFee(e.target.value)}
                            className={fieldClass}
                        />
                    </div>
                </div>

                <div>
                    {!tariffEnabled ? (
                        <button
                            type="button"
                            onClick={() => setTariffEnabled(true)}
                            className="text-xs text-zinc-500 underline"
                        >
                            + Add Tariff
                        </button>
                    ) : (
                        <div>
                            <label htmlFor="tariff" className="block text-sm font-medium">
                                Tariff
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                id="tariff"
                                name="tariff"
                                value={tariff}
                                onChange={(e) => setTariff(e.target.value)}
                                className={fieldClass}
                            />
                        </div>
                    )}

                    {/* Issue #57 — sanity check, not enforcement: Amount Due
                        (Vendor's Stated Total) is still what gets stored and
                        submitted regardless of whether it agrees with this
                        preview. Catches a vendor's own arithmetic error or a
                        missed line — the calculation alone can't. */}
                    <p className="mt-2 text-xs text-zinc-500">
                        Calculated total (Items + Shipping{tariffEnabled ? " + Tariff" : ""}):{" "}
                        {calculatedTotal.toFixed(2)}
                    </p>
                    {totalsMismatch && (
                        <p className="mt-1 text-xs text-amber-700">
                            Vendor&apos;s Stated Total ({(parseFloat(vendorStatedTotal) || 0).toFixed(2)}) doesn&apos;t
                            match the calculated total ({calculatedTotal.toFixed(2)}) — double-check before
                            submitting.
                        </p>
                    )}
                </div>

                <div>
                    <span className="block text-sm font-medium">PO</span>
                    <p className="mt-1 text-xs text-zinc-500">
                        Pick every PO this invoice covers. One PO fills in every line below
                        automatically; two or more lets each line pick which one it belongs to.
                    </p>

                    {selectedPoIds.length > 0 && (
                        <ul className="mt-2 space-y-1">
                            {selectedPos.map((po) => (
                                <li
                                    key={po.id}
                                    className="flex items-center justify-between rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                                >
                                    <span>{po.poId}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePo(po.id)}
                                        className="text-red-600"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-2 flex gap-2">
                        <select
                            value={poPickerValue}
                            onChange={(e) => setPoPickerValue(e.target.value)}
                            disabled={!vendorId}
                            className={fieldClass}
                        >
                            <option value="">
                                {vendorId ? "Select a PO to add..." : "Select a Vendor first"}
                            </option>
                            {posForVendor
                                .filter((po) => !selectedPoIds.includes(po.id))
                                .map((po) => (
                                    <option key={po.id} value={po.id}>
                                        {po.poId}
                                    </option>
                                ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleAddPo}
                            disabled={!poPickerValue}
                            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
                        >
                            Add
                        </button>
                    </div>

                    {/* Issue #57 — the dropdown above only ever offers open
                        POs (posForVendor, derived from posList, which loads
                        open-only by default). This is the escape hatch for
                        the rare extra/adjustment invoice against an
                        already-fully-invoiced PO — search results merge into
                        posList so they show up in that same dropdown rather
                        than a separate results UI. */}
                    <div className="mt-2">
                        <button
                            type="button"
                            onClick={() => setShowClosedSearch((v) => !v)}
                            className="text-xs text-zinc-500 underline"
                        >
                            {showClosedSearch ? "Hide search" : "Show all / search closed POs"}
                        </button>
                        {showClosedSearch && (
                            <div className="mt-2">
                                <input
                                    type="text"
                                    placeholder="Search by PO number..."
                                    value={closedSearchQuery}
                                    onChange={handleClosedSearchChange}
                                    className={fieldClass}
                                />
                                {closedSearchStatus === "loading" && (
                                    <p className="mt-1 text-xs text-zinc-500">Searching...</p>
                                )}
                                {closedSearchStatus === "error" && (
                                    <p className="mt-1 text-xs text-red-600">Search failed — try again.</p>
                                )}
                                {closedSearchStatus === "done" && (
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {closedSearchResultCount === 0
                                            ? "No matching POs."
                                            : `Found ${closedSearchResultCount} — matching POs now appear in the picker above.`}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    function renderFileSection() {
        return (
            <div>
                <h2 className="text-lg font-semibold">Invoice File</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    The vendor&apos;s original invoice document — required, every received invoice is kept on file.
                </p>
                <div className="mt-2 space-y-2">
                    <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleInvoiceFileChange}
                        className="block text-sm"
                    />
                    {invoiceFile.status === "uploading" && (
                        <p className="text-sm text-zinc-500">Uploading {invoiceFile.filename}...</p>
                    )}
                    {invoiceFile.status === "done" && (
                        <p className="text-sm text-green-700">
                            Uploaded{" "}
                            <a href={invoiceFile.url} target="_blank" rel="noreferrer" className="underline">
                                {invoiceFile.filename}
                            </a>
                        </p>
                    )}
                    {invoiceFile.status === "error" && (
                        <p className="text-sm text-red-600">
                            Upload failed: {invoiceFile.error}. Pick a different file to continue —
                            the invoice can&apos;t be created without one.
                        </p>
                    )}
                    {invoiceFile.status === "idle" && (
                        <p className="text-sm text-zinc-500">No file attached yet.</p>
                    )}
                    {poDetection && (
                        <p
                            className={
                                poDetection.level === "warning"
                                    ? "text-sm text-amber-700"
                                    : "text-sm text-blue-700"
                            }
                        >
                            {poDetection.message}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    function renderItemsSection() {
        return (
            <div>
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="mt-2 space-y-3">
                    {items.map((item, i) => {
                        const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                        // The per-item PO picker only makes sense (and only
                        // renders) once the header has claimed 2+ POs —
                        // with exactly one selected, applyPoSelection()
                        // already forced every item to it, so there's no
                        // real choice left to show.
                        const showPoPicker = selectedPoIds.length >= 2;
                        // Issue #51 — the PO Item dropdown can't be scoped
                        // until the line actually has a PO (either forced
                        // by the header's single-PO case, or picked via
                        // showPoPicker above); until then this falls back
                        // to the old plain free-text input.
                        const poItemsEntry = item.poRecordId ? poItemsCache[item.poRecordId] : null;
                        const poItemOptions = poItemsEntry?.items || [];
                        // Issue #57 — only meaningful once a real PO Item is
                        // linked; "Other" lines have nothing to compare
                        // against, so neither the Unit Price lock nor the
                        // Qty warning ever applies to them.
                        const linkedPoItem = item.poItemRecordId
                            ? poItemOptions.find((p) => p.id === item.poItemRecordId)
                            : null;
                        const qtyExceedsRemaining =
                            linkedPoItem != null &&
                            linkedPoItem.remainingQty != null &&
                            (parseFloat(item.qty) || 0) > linkedPoItem.remainingQty;
                        const unitPriceLocked = !!item.poItemRecordId && !item.unitPriceEditing;
                        const showRemark = item.unitPriceEditing || qtyExceedsRemaining;
                        return (
                            <div key={i} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                                <div
                                    className={
                                        showPoPicker
                                            ? "grid grid-cols-2 gap-2 sm:grid-cols-4"
                                            : "grid grid-cols-2 gap-2 sm:grid-cols-3"
                                    }
                                >
                                    {item.poRecordId ? (
                                        <div className="space-y-1">
                                            <select
                                                value={item.poItemRecordId}
                                                onChange={(e) => updatePoItemSelection(i, e.target.value)}
                                                className={inputClass + " w-full"}
                                            >
                                                <option value="">Other (free text)</option>
                                                {poItemOptions.map((poItem) => (
                                                    <option key={poItem.id} value={poItem.id}>
                                                        {poItem.itemName}
                                                        {poItem.size ? ` — ${poItem.size}` : ""}
                                                        {poItem.remainingQty != null
                                                            ? ` (Remaining: ${poItem.remainingQty})`
                                                            : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            {poItemsEntry?.status === "loading" && (
                                                <p className="text-xs text-zinc-500">Loading PO items...</p>
                                            )}
                                            {poItemsEntry?.status === "error" && (
                                                <p className="text-xs text-red-600">
                                                    Couldn&apos;t load this PO&apos;s items — use &quot;Other&quot; or
                                                    re-pick the PO to retry.
                                                </p>
                                            )}
                                            {!item.poItemRecordId && (
                                                <input
                                                    placeholder="Item Name"
                                                    required
                                                    value={item.itemName}
                                                    onChange={(e) => updateItem(i, "itemName", e.target.value)}
                                                    className={inputClass + " w-full"}
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            placeholder="Item Name"
                                            required
                                            value={item.itemName}
                                            onChange={(e) => updateItem(i, "itemName", e.target.value)}
                                            className={inputClass}
                                        />
                                    )}
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        required
                                        value={item.qty}
                                        onChange={(e) => updateItem(i, "qty", e.target.value)}
                                        className={inputClass}
                                    />
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Unit Price"
                                            required
                                            disabled={unitPriceLocked}
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                                            className={inputClass + " flex-1"}
                                        />
                                        {unitPriceLocked && (
                                            <button
                                                type="button"
                                                onClick={() => updateItem(i, "unitPriceEditing", true)}
                                                className="shrink-0 text-xs text-zinc-500 underline"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                    {showPoPicker && (
                                        <select
                                            required
                                            value={item.poRecordId}
                                            onChange={(e) => updateItem(i, "poRecordId", e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="" disabled>
                                                PO
                                            </option>
                                            {selectedPos.map((po) => (
                                                <option key={po.id} value={po.id}>
                                                    {po.poId}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {qtyExceedsRemaining && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        Qty ({item.qty}) exceeds this PO Item&apos;s remaining un-invoiced quantity (
                                        {linkedPoItem.remainingQty}) — not blocked, but worth a note below.
                                    </p>
                                )}
                                {showRemark && (
                                    <input
                                        placeholder="Remark — why this differs from the PO"
                                        value={item.remark}
                                        onChange={(e) => updateItem(i, "remark", e.target.value)}
                                        className={inputClass + " mt-2 w-full"}
                                    />
                                )}
                                <div className="mt-2 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                    <span>Amount (preview): {amount.toFixed(2)}</span>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(i)}
                                            className="text-red-600"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={addItem}
                    className="mt-3 rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
                >
                    + Add item
                </button>
                <p className="mt-2 text-sm font-medium">Items total (preview): {itemsTotal.toFixed(2)}</p>
            </div>
        );
    }

    return (
        <form action={formAction} className="mt-6 space-y-8">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            <div className="flex gap-2 border-b border-zinc-300 dark:border-zinc-700">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={
                            activeTab === tab.id
                                ? "border-b-2 border-foreground px-3 pb-2 text-sm font-semibold"
                                : "px-3 pb-2 text-sm text-zinc-500"
                        }
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Same state, same fields, every time — the tab only ever
                reorders these three blocks. PDF Upload leads with the file
                (and whatever it auto-fills below); Manual Entry leads with
                the fields to fill in by hand, with the still-required file
                attachment last. */}
            {activeTab === "pdf" ? (
                <>
                    {renderFileSection()}
                    {renderHeaderFields()}
                    {renderItemsSection()}
                </>
            ) : (
                <>
                    {renderHeaderFields()}
                    {renderItemsSection()}
                    {renderFileSection()}
                </>
            )}

            <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
            {invoiceFile.status === "done" && (
                <>
                    <input type="hidden" name="invoiceFileUrl" value={invoiceFile.url} />
                    <input type="hidden" name="invoiceFileFilename" value={invoiceFile.filename} />
                </>
            )}

            <button
                type="submit"
                disabled={pending || invoiceFile.status !== "done"}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending
                    ? "Submitting..."
                    : invoiceFile.status === "uploading"
                        ? "Uploading file..."
                        : invoiceFile.status !== "done"
                            ? "Attach the invoice file to continue"
                            : "Create Invoice"}
            </button>
        </form>
    );
}

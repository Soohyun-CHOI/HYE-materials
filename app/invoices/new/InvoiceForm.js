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

// Issue #57 redesign — one PO header slot's full state: which PO (if any)
// it holds, plus its own independent "Show all / search closed POs"
// toggle and whatever that toggle's combobox currently has typed/found.
// Bundled together (rather than parallel arrays keyed by index) since
// they always change together and only ever matter per-slot.
const EMPTY_SLOT = { poRecordId: "", searchMode: false, query: "", results: [], status: "idle" };

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
// replacePoSlots — cases where that PO's items may *already* be cached
// from earlier in the session) and again later when a fetch that was
// still in flight at that moment finishes (applyDefaultPoItemSelection).
// Never touches a line once poItemTouched is true, or one with no PO / //
// whose PO's items aren't loaded yet.
function defaultedItem(item, cache) {
    if (item.poItemTouched || !item.poRecordId) return item;
    const entry = cache[item.poRecordId];
    if (!entry || entry.status !== "done" || entry.items.length === 0) return item;
    const first = entry.items[0];
    return {
        ...item,
        poItemRecordId: first.id,
        itemName: first.itemName,
        unitPrice: first.unitPrice != null ? String(first.unitPrice) : item.unitPrice,
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

const CONFIRM_PO_CHANGE_MESSAGE =
    "PO를 바꾸면 지금까지 입력한 항목이 모두 사라집니다. 계속하시겠습니까?";

// The common case (per product decision) is one PO with several invoices —
// an invoice spanning several POs is the supported edge case, not the
// default flow. So the header owns one always-visible PO slot, and
// "+ Add another PO" (minimal-presence, see renderHeaderFields) is the
// deliberate extra step needed to reveal a second one.
export default function InvoiceForm({ vendors, pos }) {
    const [state, formAction, pending] = useActionState(createInvoiceAction, null);
    // Default "pdf" — the primary path most people try first.
    const [activeTab, setActiveTab] = useState("pdf");

    // Local copy, not just the prop directly — issue #46's detection can
    // confirm a PO that was created *after* this page's initial server-side
    // getOpenPOs() fetch (e.g. approved moments earlier in the same
    // session, or a closed PO surfaced via #57's search), which wouldn't
    // be in `pos` yet. Without this, the <select> would have no matching
    // <option> for it: the browser then visually renders some other
    // option as "selected" while the real value silently stays correct
    // underneath — a misleading display, not just a cosmetic gap, since
    // the user has no reason to notice the mismatch and fix it before
    // submitting.
    const [posList, setPosList] = useState(pos);
    const [vendorId, setVendorId] = useState("");
    // Issue #57 redesign — replaces the old selectedPoIds/poPickerValue
    // add-then-clear pair. Always at least one slot (poSlots[0], the
    // header's always-visible picker); index 1+ only exist once "+ Add
    // another PO" has been clicked. See replacePoSlots/handleSlotChange
    // below for the single sync point every slot mutation goes through.
    const [poSlots, setPoSlots] = useState([{ ...EMPTY_SLOT }]);
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
    // items" — an "error" entry is retried the next time that PO is
    // assigned to a slot again.
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
    // One debounce timer per slot index, since each slot's search toggle
    // is independent.
    const slotSearchTimeoutsRef = useRef({});

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
            // the posList comment above for why this can happen.
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

            // Issue #57 — detection is an automatic side effect of a file
            // upload, not a user click, so it must never trigger the same
            // window.confirm() a manual PO swap does. Only applies while
            // the form is genuinely untouched (no PO picked in any slot,
            // no item content) — otherwise it backs off entirely rather
            // than silently overwriting real work or popping a dialog the
            // user didn't ask for.
            const pristine =
                poSlots.every((s) => !s.poRecordId) &&
                items.every((item) => !item.itemName && !item.qty && !item.unitPrice);

            if (!pristine) {
                setPoDetection({
                    level: "info",
                    message: `Detected PO${confirmed.length > 1 ? "s" : ""}: ${confirmed
                        .map((c) => c.poId)
                        .join(", ")} — not auto-applied since a PO or items are already entered. Select manually above if needed.`,
                });
                return;
            }

            const newSlots = confirmed.map((c) => ({ ...EMPTY_SLOT, poRecordId: c.recordId }));
            setPoSlots(newSlots);
            newSlots.forEach((s) => ensurePoItemsLoaded(s.poRecordId));

            if (newSlots.length === 1) {
                const only = newSlots[0].poRecordId;
                setItems((prev) =>
                    prev.map((item) => defaultedItem({ ...item, poRecordId: only }, poItemsCache))
                );
                setPoDetection({
                    level: "info",
                    message: `Detected PO: ${confirmed[0].poId} (auto-filled below).`,
                });
            } else {
                // Multi-PO case: scaffold one item row per detected PO,
                // each pre-set to a different one, rather than leaving a
                // single blank row with no default PO to seed it with.
                setItems(
                    confirmed.map((c) =>
                        defaultedItem({ ...EMPTY_ITEM, poRecordId: c.recordId }, poItemsCache)
                    )
                );
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
    // Every PO currently occupying a header slot — what each item's own
    // PO <select> is allowed to offer (restricted to the header's
    // selection, not the full Vendor PO list, since an item can only
    // belong to a PO this invoice actually claims to cover), and what
    // each slot's own dropdown excludes so the same PO can't be picked
    // twice across two slots.
    const selectedPoIds = useMemo(
        () => poSlots.map((s) => s.poRecordId).filter(Boolean),
        [poSlots]
    );
    const selectedPos = useMemo(
        () => posList.filter((po) => selectedPoIds.includes(po.id)),
        [posList, selectedPoIds]
    );

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
        setVendorId(e.target.value);
        // POs picked under the previous Vendor almost certainly don't
        // belong to the new one — reset silently (no confirm dialog here;
        // that's specific to a deliberate PO swap within the same Vendor,
        // not this already-existing, already-silent Vendor-change reset).
        replacePoSlots([{ ...EMPTY_SLOT }]);
    }

    // Issue #57 — the actual "PO changed, items get wiped" side effect,
    // shared by every path that ends up truly replacing a slot's PO
    // (handleSlotChange when the slot wasn't already empty, handleRemoveSlot
    // for a slot that had a PO, Vendor change). Always resets items to a
    // single fresh row — never a partial/targeted cleanup — since a swap
    // at the header can invalidate any item's PO Item link, not just one.
    function replacePoSlots(newSlots) {
        setPoSlots(newSlots);
        const activeIds = newSlots.map((s) => s.poRecordId).filter(Boolean);
        const only = activeIds.length === 1 ? activeIds[0] : "";
        const fresh = { ...EMPTY_ITEM, poRecordId: only };
        setItems([defaultedItem(fresh, poItemsCache)]);
        activeIds.forEach((id) => ensurePoItemsLoaded(id));
    }

    // Only prompts if there's actually something to lose — an empty
    // invoice's items array (still just the pristine single blank row)
    // means "replace" and "confirm-then-replace" produce an identical
    // result, so skipping the popup in that case isn't a shortcut, it's
    // just not asking a question with only one real answer.
    function confirmIfDirty(proceed) {
        const dirty = items.some((item) => item.itemName || item.qty || item.unitPrice);
        if (dirty && !window.confirm(CONFIRM_PO_CHANGE_MESSAGE)) {
            return;
        }
        proceed();
    }

    // Issue #57 — single sync point for a slot's <select> or its search
    // combobox picking a PO. A still-empty slot getting its first-ever
    // value doesn't touch any items (there's nothing that value could be
    // orphaning), so it skips both the confirm dialog and the items wipe —
    // only an actual *replacement* of an already-chosen PO goes through
    // confirmIfDirty + replacePoSlots.
    function handleSlotChange(slotIndex, newValue) {
        const previousValue = poSlots[slotIndex].poRecordId;
        const nextSlots = poSlots.map((s, i) =>
            i === slotIndex ? { ...EMPTY_SLOT, poRecordId: newValue } : s
        );

        if (!previousValue) {
            setPoSlots(nextSlots);
            if (newValue) {
                ensurePoItemsLoaded(newValue);
                const activeIds = nextSlots.map((s) => s.poRecordId).filter(Boolean);
                if (activeIds.length === 1) {
                    setItems((prev) =>
                        prev.map((item) => defaultedItem({ ...item, poRecordId: newValue }, poItemsCache))
                    );
                }
            }
            return;
        }

        confirmIfDirty(() => replacePoSlots(nextSlots));
    }

    function handleRemoveSlot(slotIndex) {
        const previousValue = poSlots[slotIndex].poRecordId;
        const nextSlots = poSlots.filter((_, i) => i !== slotIndex);

        if (!previousValue) {
            setPoSlots(nextSlots);
            return;
        }

        confirmIfDirty(() => replacePoSlots(nextSlots));
    }

    // Purely additive — reveals an empty slot, doesn't touch any existing
    // PO or item, so no confirm dialog applies here.
    function handleAddSlot() {
        setPoSlots((prev) => [...prev, { ...EMPTY_SLOT }]);
    }

    function handleToggleSlotSearch(slotIndex) {
        const timeouts = slotSearchTimeoutsRef.current;
        if (timeouts[slotIndex]) clearTimeout(timeouts[slotIndex]);
        setPoSlots((prev) =>
            prev.map((s, i) =>
                i === slotIndex
                    ? { ...s, searchMode: !s.searchMode, query: "", results: [], status: "idle" }
                    : s
            )
        );
    }

    // Debounced (300ms), server-side on every keystroke after the pause,
    // never a client-side filter over posList. Results merge into posList
    // (same "merge what's missing" pattern #46's detection already uses)
    // so a picked result is still a valid <option> if the slot's toggle
    // gets switched back off afterward.
    function handleSlotSearchChange(slotIndex, query) {
        setPoSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, query } : s)));

        const timeouts = slotSearchTimeoutsRef.current;
        if (timeouts[slotIndex]) clearTimeout(timeouts[slotIndex]);

        if (!query.trim()) {
            setPoSlots((prev) =>
                prev.map((s, i) => (i === slotIndex ? { ...s, status: "idle", results: [] } : s))
            );
            return;
        }

        setPoSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, status: "loading" } : s)));
        timeouts[slotIndex] = setTimeout(() => runSlotSearch(slotIndex, query), 300);
    }

    async function runSlotSearch(slotIndex, query) {
        try {
            const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error("Request failed");
            const { pos: results } = await res.json();
            setPosList((prev) => {
                const missing = results.filter((r) => !prev.some((po) => po.id === r.id));
                if (missing.length === 0) return prev;
                return [...prev, ...missing];
            });
            setPoSlots((prev) =>
                prev.map((s, i) => (i === slotIndex ? { ...s, status: "done", results } : s))
            );
        } catch (err) {
            console.error("PO search failed", err);
            setPoSlots((prev) =>
                prev.map((s, i) => (i === slotIndex ? { ...s, status: "error", results: [] } : s))
            );
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
    // Selecting a real PO Item copies its name (and, per #57, its
    // Unit Price, freshly re-locked) in; selecting empty means
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
                    unitPrice: matched && matched.unitPrice != null ? String(matched.unitPrice) : item.unitPrice,
                    unitPriceEditing: false,
                };
            })
        );
    }

    // Issue #57 — reverts the Unit Price lock back to the linked PO
    // Item's original Unit Price (re-derived from poItemsCache rather than
    // stored separately — the link itself never changed while editing,
    // just the typed value) and clears whatever Remark was written for
    // the edit, re-locking the field.
    function handleCancelUnitPriceEdit(index) {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;
                const candidates = poItemsCache[item.poRecordId]?.items || [];
                const matched = candidates.find((p) => p.id === item.poItemRecordId);
                return {
                    ...item,
                    unitPrice: matched && matched.unitPrice != null ? String(matched.unitPrice) : item.unitPrice,
                    unitPriceEditing: false,
                    remark: "",
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

    // Issue #57 layout follow-up — extracted so the same slot rendering
    // can be called once inline (poSlots[0], next to Vendor) and again for
    // any additional slots below; no behavior changed from before, just
    // where it's invoked from.
    function renderPoSlot(slot, slotIndex) {
        const optionsForSlot = posForVendor.filter(
            (po) => po.id === slot.poRecordId || !selectedPoIds.includes(po.id)
        );
        // Same exclusion as optionsForSlot above — a search result for a PO
        // another slot already holds isn't a valid pick here, so it's
        // filtered out rather than letting two slots end up pointing at the
        // same PO.
        const visibleResults = slot.results.filter(
            (po) =>
                po.vendorId === vendorId &&
                (po.id === slot.poRecordId || !selectedPoIds.includes(po.id))
        );
        return (
            <div key={slotIndex} className="flex items-start gap-2">
                <div className="flex-1">
                    {slot.searchMode ? (
                        <div>
                            <input
                                type="text"
                                placeholder="Search all POs by number..."
                                value={slot.query}
                                onChange={(e) => handleSlotSearchChange(slotIndex, e.target.value)}
                                disabled={!vendorId}
                                className={fieldClass}
                            />
                            {slot.status === "loading" && (
                                <p className="mt-1 text-xs text-zinc-500">Searching...</p>
                            )}
                            {slot.status === "error" && (
                                <p className="mt-1 text-xs text-red-600">Search failed — try again.</p>
                            )}
                            {slot.status === "done" && (
                                <ul className="mt-1 divide-y divide-zinc-200 rounded border border-zinc-300 text-sm dark:divide-zinc-800 dark:border-zinc-700">
                                    {visibleResults.length === 0 ? (
                                        <li className="px-3 py-1.5 text-zinc-500">No matching POs.</li>
                                    ) : (
                                        visibleResults.map((po) => (
                                            <li key={po.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSlotChange(slotIndex, po.id)}
                                                    className="block w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                                                >
                                                    {po.poId}
                                                </button>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <select
                            value={slot.poRecordId}
                            onChange={(e) => handleSlotChange(slotIndex, e.target.value)}
                            disabled={!vendorId}
                            className={fieldClass}
                        >
                            <option value="">{vendorId ? "Select a PO..." : "Select a Vendor first"}</option>
                            {optionsForSlot.map((po) => (
                                <option key={po.id} value={po.id}>
                                    {po.poId}
                                </option>
                            ))}
                        </select>
                    )}
                    <label className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                        <input
                            type="checkbox"
                            checked={slot.searchMode}
                            onChange={() => handleToggleSlotSearch(slotIndex)}
                        />
                        Show all / search closed POs
                    </label>
                </div>
                {slotIndex > 0 && (
                    <button
                        type="button"
                        onClick={() => handleRemoveSlot(slotIndex)}
                        className="mt-2 shrink-0 text-xs text-red-600"
                    >
                        Remove
                    </button>
                )}
            </div>
        );
    }

    function renderHeaderFields() {
        return (
            <div className="space-y-4">
                {/* Issue #57 layout follow-up — Vendor and the primary PO
                    slot sit side by side, directly under the file upload
                    section above (see the tab-order comment near the
                    bottom): the common path is "attach PDF, both auto-
                    fill" or "pick Vendor, PO narrows to it" — putting them
                    in the same row makes that pairing visible at a glance. */}
                <div className="grid grid-cols-2 gap-4">
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
                        <span className="block text-sm font-medium">PO</span>
                        {renderPoSlot(poSlots[0], 0)}
                    </div>
                </div>

                {poSlots.length > 1 && (
                    <div className="space-y-3">{poSlots.slice(1).map((slot, i) => renderPoSlot(slot, i + 1))}</div>
                )}
                {/* Minimal presence, per issue #57 — the exception path for
                    an invoice spanning more than one PO, not a feature to
                    advertise alongside the primary Vendor/PO row above. */}
                <button type="button" onClick={handleAddSlot} className="text-xs text-zinc-400 underline">
                    + Add another PO
                </button>

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
                        // with exactly one selected, every item is forced
                        // to it, so there's no real choice left to show.
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
                                                {poItemOptions.map((poItem) => (
                                                    <option key={poItem.id} value={poItem.id}>
                                                        {poItem.itemName}
                                                        {poItem.size ? ` — ${poItem.size}` : ""}
                                                        {poItem.remainingQty != null
                                                            ? ` (Remaining: ${poItem.remainingQty})`
                                                            : ""}
                                                    </option>
                                                ))}
                                                {/* Issue #57 — moved to the end of the list, a
                                                    deliberate choice rather than the default. */}
                                                <option value="">Other (free text)</option>
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
                                        {item.poItemRecordId && item.unitPriceEditing && (
                                            <button
                                                type="button"
                                                onClick={() => handleCancelUnitPriceEdit(i)}
                                                className="shrink-0 text-xs text-zinc-500 underline"
                                            >
                                                Cancel
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

    // Issue #57 layout follow-up — moved below Items (was previously part
    // of renderHeaderFields, above Items). Shipping Fee and Vendor's
    // Stated Total sit side by side; Tariff, when added, takes the middle
    // slot between them rather than a separate row, so the row is 2
    // columns normally and 3 once Tariff is added — flex-1 on each column
    // means the widths reflow automatically either way, no fixed grid to
    // keep in sync with tariffEnabled.
    function renderTotalsSection() {
        return (
            <div>
                <div className="flex gap-4">
                    <div className="flex-1">
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
                        {/* Issue #69, updated #78 — reference only, no
                            computed variance: only shown for the common
                            single-PO case, since an invoice spanning several
                            POs has no single PO Shipping Fee to compare
                            against. */}
                        {selectedPos.length === 1 && selectedPos[0].shippingFee != null && (
                            <p className="mt-1 text-xs text-zinc-500">
                                PO&apos;s Shipping Fee: {selectedPos[0].shippingFee}
                            </p>
                        )}
                    </div>
                    {tariffEnabled && (
                        <div className="flex-1">
                            <label htmlFor="tariff" className="block text-sm font-medium">
                                Tariff
                            </label>
                            <div className="mt-1 flex items-center gap-1">
                                <input
                                    type="number"
                                    step="0.01"
                                    id="tariff"
                                    name="tariff"
                                    value={tariff}
                                    onChange={(e) => setTariff(e.target.value)}
                                    className={inputClass + " flex-1"}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTariffEnabled(false);
                                        setTariff("");
                                    }}
                                    className="shrink-0 text-xs text-zinc-500 underline"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex-1">
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
                </div>

                {!tariffEnabled && (
                    <button
                        type="button"
                        onClick={() => setTariffEnabled(true)}
                        className="mt-2 text-xs text-zinc-500 underline"
                    >
                        + Add Tariff
                    </button>
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
                reorders these four blocks. PDF Upload leads with the file
                (and whatever it auto-fills below); Manual Entry leads with
                the fields to fill in by hand, with the still-required file
                attachment last. Totals stays pinned right after Items in
                both orders. */}
            {activeTab === "pdf" ? (
                <>
                    {renderFileSection()}
                    {renderHeaderFields()}
                    {renderItemsSection()}
                    {renderTotalsSection()}
                </>
            ) : (
                <>
                    {renderHeaderFields()}
                    {renderItemsSection()}
                    {renderTotalsSection()}
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

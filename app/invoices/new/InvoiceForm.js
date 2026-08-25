"use client";

import { useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { upload } from "@vercel/blob/client";
import { createInvoiceAction, createDirectPurchaseAction } from "./actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
// Issue #198 — pure and import-free, so a client component may hold it; the judgment
// itself already ran on the server and every PO here carries its answer as `unsigned`.
import { UNSIGNED_COPY, poOptionLabel } from "@/lib/poUnsigned";
import { PO_ORIGIN, claimDetected, poOptionsForSlot } from "@/lib/poPickerOptions";
// Issue #244 — same category as the two above: pure and import-free. This one is
// the per-item half of what leaves an order open, and the sort below was an
// inline copy of it.
import { hasUninvoicedQty } from "@/lib/poItemQty";
// Issue #272 — pure and import-free, same category again: the words for the way
// out of an invoice with no order, and the one predicate the modal and
// `createDirectPurchaseAction` both ask so they cannot disagree about it.
import { DIRECT_PURCHASE_COPY, directPurchaseBlocked } from "@/lib/directPurchase";
// Issue #254 — the same category again, and the one that closes a divergence
// rather than avoiding one: `lib/variance.js` imports nothing at all, so the
// predicate the saved flag is set by is reachable from here. The form used to
// carry its own threshold for the same comparison.
import { VARIANCE_COPY, checkHeaderVariance } from "@/lib/variance";

// poItemTouched: false until the user (or #57's auto-default below) makes an
// explicit choice in the PO Item dropdown. It distinguished "still unset" from
// "deliberately Other (free text)" until #278 removed the second; what it
// separates now is a pick from an auto-default, which is what keeps
// `applyDefaultsAcrossItems` idempotent. unitPriceEditing: whether the Unit
// Price lock (#57) is currently open for a linked PO Item.
//
// `poItemRecordId: ""` IS A STATE OF THE FORM AND NOT OF A SAVED CHARGE (#278).
// A row holds it before its PO is picked, while that PO's items load, and when
// #91 leaves it nothing to claim — none of which may be submitted, which
// `createInvoiceAction` refuses and the row itself explains. THE ROW REALLY DOES
// EXPLAIN ALL THREE SINCE #272: the first two still offered a free-text
// `Item Name` box, which is the half of the free-text charge #278 did not reach.
// Nothing but the ordered item writes `itemName` now.
const EMPTY_ITEM = {
    itemName: "",
    // Issue #84 — frozen copies from the linked PO Item, same as itemName/
    // unitPrice: never manually entered, never editable.
    size: "",
    unit: "",
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

// Issue #57 — items with uninvoiced qty left first (stable, so
// relative order within each group is untouched), fully-invoiced/over-
// invoiced pushed to the bottom rather than hidden.
//
// Issue #244 — the test was `uninvoicedQty > 0` written out here, which was the
// last hand-typed copy of hasUninvoicedQty anywhere. It is the same rule the base
// now answers with for whole orders, and #244 removed the predicate's other
// caller, so leaving a copy of it on this very screen was the duplication worth
// closing while the question was open. It reads the same figures the sort always
// had: `qty` and `invoicedQty` both ride on each cached PO Item, from
// getInvoicingStatusByPO, so this costs nothing.
function sortByUninvoiced(poItems) {
    return [...poItems].sort((a, b) => {
        const aOpen = hasUninvoicedQty({ qty: a.qty, invoicedQty: a.invoicedQty }) ? 0 : 1;
        const bOpen = hasUninvoicedQty({ qty: b.qty, invoicedQty: b.invoicedQty }) ? 0 : 1;
        return aOpen - bOpen;
    });
}

// Issue #57 — the one place that decides whether an invoice item gets defaulted to
// its PO's first (Uninvoiced-sorted) item. Pure function of (item, cache)
// rather than a setItems side effect, so it's usable both the moment a
// invoice item's poRecordId is first assigned/changed (addItem, updateItem,
// replacePoSlots — cases where that PO's items may *already* be cached
// from earlier in the session) and again later when a fetch that was
// still in flight at that moment finishes (applyDefaultPoItemSelection).
// Never touches an invoice item once poItemTouched is true, or one with no PO / //
// whose PO's items aren't loaded yet.
// Issue #91 — usedElsewhere (a Set of PO Item record IDs already claimed
// by sibling invoice items) is now honored here too, not just in the rendered
// dropdown: without this, auto-defaulting a second untouched invoice item pointed
// at the same PO would silently pick the exact same "first" item the
// first invoice item already got, resurfacing the bug the dropdown filter alone
// doesn't cover. Falls back to the invoice item as-is if every item for this PO
// is already claimed elsewhere.
function defaultedItem(item, cache, usedElsewhere = new Set()) {
    if (item.poItemTouched || !item.poRecordId) return item;
    const entry = cache[item.poRecordId];
    if (!entry || entry.status !== "done" || entry.items.length === 0) return item;
    const first = entry.items.find((poItem) => !usedElsewhere.has(poItem.id));
    if (!first) return item;
    return {
        ...item,
        poItemRecordId: first.id,
        itemName: first.itemName,
        size: first.size || "",
        unit: first.unit || "",
        unitPrice: first.unitPrice != null ? String(first.unitPrice) : item.unitPrice,
    };
}

// Issue #91 — applies defaultedItem across a whole list of invoice items in
// order, so an invoice item's auto-default takes into account whatever the ones
// before it in the same pass just claimed (rather than each computing its
// default in isolation and possibly colliding on the same PO Item). Must
// stay idempotent — safe to run more than once over invoice items that are
// already (auto-)defaulted, not just ones still blank — since
// poItemTouched never becomes true from an auto-default alone, so a
// second pass over the same invoice items is always possible (e.g. a duplicate
// fetch resolving twice). Each invoice item's own current poItemRecordId is
// excluded from what counts as "used by a sibling" while computing its
// own default — otherwise re-running this over an already-correctly-
// defaulted invoice item would see that invoice item's own pick reflected in `used` and
// bump it to the next item instead of leaving it alone.
function applyDefaultsAcrossItems(itemsList, cache) {
    const used = new Set();
    itemsList.forEach((item) => {
        if (item.poItemRecordId) used.add(item.poItemRecordId);
    });
    return itemsList.map((item) => {
        const usedBySiblings = item.poItemRecordId
            ? new Set([...used].filter((id) => id !== item.poItemRecordId))
            : used;
        const next = defaultedItem(item, cache, usedBySiblings);
        if (next.poItemRecordId) used.add(next.poItemRecordId);
        return next;
    });
}

// Issue #91 — PO Item IDs already claimed by every invoice item except the one at
// exceptIndex (pass -1 for "none", e.g. a brand-new invoice item not in the list
// yet) — what a single invoice item's own default/selection must avoid colliding
// with.
function usedElsewhereIds(itemsList, exceptIndex) {
    return new Set(
        itemsList
            .filter((_, idx) => idx !== exceptIndex)
            .map((it) => it.poItemRecordId)
            .filter(Boolean)
    );
}

const inputClass =
    "rounded border border-zinc-300 px-2 py-1 disabled:opacity-50";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50";

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

// Shared by both triggers that reset items the same way (a direct PO
// change, or a Vendor change that swaps the PO indirectly) — names
// whichever field the user actually touched, rather than a single
// hardcoded "PO" wording used for both.
const confirmChangeMessage = (subject) =>
    `Changing the ${subject} will clear the items you've entered so far. Continue?`;

// `SHOW_OTHER_ITEM_OPTION` STOOD HERE AND IS GONE (#278). It hid an `Other (free
// text)` choice from the PO Item select and had been false since #96, which left
// the backend path standing and said flipping it back was the whole of
// re-exposing the option. #278 decided the option is not a feature: only a
// purchase request takes typed items, a `PO Items` row is a snapshot of one, and
// an `Invoice Items` row is chosen from those — so a charge with no ordered item
// behind it is not a state this app has, and the twenty-two branches that
// described one went with the flag.
//
// REMOVING THE FLAG WAS NOT THE WHOLE OF CLOSING IT, WHICH IS WHY THIS NOTE IS
// HERE RATHER THAN IN THE PULL REQUEST. The flag gated one `<option>`; a second
// path reached the same state with the flag untouched, and it is closed below at
// `noOrderedItemLeft` and in `createInvoiceAction`.

// The common case (per product decision) is one PO with several invoices —
// an invoice spanning several POs is the supported edge case, not the
// default flow. So the header owns one always-visible PO slot, and
// "+ Add another PO" (minimal-presence, see renderHeaderFields) is the
// deliberate extra step needed to reveal a second one.
export default function InvoiceForm({ vendors, pos }) {
    const [state, formAction, pending] = useActionState(createInvoiceAction, null);
    // Issue #272 — its own form and its own state, because it cannot be nested
    // inside the invoice form and a `formAction` override on a button would have
    // nowhere to put a refusal. The modal renders after `</form>`, beside
    // ConfirmDialog, for the same reason.
    const [dpState, dpFormAction, dpPending] = useActionState(createDirectPurchaseAction, {});
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
    // Replaces window.confirm() — { proceed, subject } | null. Set by
    // confirmIfDirty when items has actually diverged from its auto-
    // inserted default; the ConfirmDialog rendered below runs `proceed`
    // on confirm, or just clears this on cancel.
    const [pendingConfirm, setPendingConfirm] = useState(null);
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
    // Issue #187 — what the user TYPED, which is not what the field shows.
    // The displayed `shippingFee` is derived below from this and the flag
    // underneath it, and this half is read only once that flag is true —
    // so a changed prefill never has to overwrite a real edit.
    const [shippingFeeEdit, setShippingFeeEdit] = useState("");
    // Issue #91 — whether the user has directly edited Shipping Fee since
    // the last time it was (re)defaulted. Same idiom as items' own
    // poItemTouched: distinguishes "still showing an auto-prefill" from
    // "deliberately set/cleared", so a prefill never clobbers a real edit.
    const [shippingFeeTouched, setShippingFeeTouched] = useState(false);
    const [tariffEnabled, setTariffEnabled] = useState(false);
    const [tariff, setTariff] = useState("");
    // Issue #283 — the second optional term, in the first one's shape. Two flags
    // rather than one, because the two are independent facts about the vendor's
    // document: an invoice can state a duty with no tax, a tax with no duty, or
    // both.
    const [salesTaxEnabled, setSalesTaxEnabled] = useState(false);
    const [salesTax, setSalesTax] = useState("");
    // Issue #272 — CONTROLLED ONLY BECAUSE A SECOND FORM NEEDS THEM. Both were
    // uncontrolled inputs that `createInvoiceAction` read straight off the
    // FormData; the direct-purchase modal is its own form, so the two facts it
    // copies off the vendor's document have to be readable from state. Nothing
    // else about them changed.
    const [vendorInvoiceCode, setVendorInvoiceCode] = useState("");
    const [issueDate, setIssueDate] = useState("");
    // The modal itself: whether it is open, the job picked in it, the note, and
    // the job list fetched when it opens. FETCHED THERE RATHER THAN ON THE PAGE:
    // the office reaches this on the rare invoice with no order to charge, so
    // loading every job on every page load would spend a read on all the others
    // (`GET /api/jobs`, the same on-demand shape as #57's PO search).
    const [dpOpen, setDpOpen] = useState(false);
    const [dpJobId, setDpJobId] = useState("");
    const [dpNotes, setDpNotes] = useState("");
    const [dpJobs, setDpJobs] = useState({ status: "idle", jobs: [] });
    // One debounce timer per slot index, since each slot's search toggle
    // is independent.
    const slotSearchTimeoutsRef = useRef({});
    // Issue #91 — a ref, not state: ensurePoItemsLoaded needs a
    // synchronous check-and-mark that never starts the same PO's fetch
    // twice, but a setState updater isn't a safe place for that (React can
    // invoke an updater more than once — e.g. Strict Mode deliberately
    // double-invokes updaters in dev to catch exactly this kind of
    // impurity). fetchPoItems used to be called as a side effect inside
    // setPoItemsCache's updater, so a double-invoke fired it twice,
    // racing two independent defaulting passes against each other and
    // occasionally landing on the second PO Item instead of the first.
    const poItemsFetchStartedRef = useRef(new Set());
    // Issue #99 — a snapshot of `items` as of the last *automatic*
    // mutation (initial default row, PO-forced defaulting, PO Items
    // finishing loading, detection auto-fill) — never updated by a
    // user-driven one (addItem, removeItem, updateItem,
    // updatePoItemSelection, handleCancelUnitPriceEdit). Comparing current
    // `items` against this is the single source of truth for "has the
    // user actually changed anything", regardless of whether the compare
    // happens mid-load, right after load, or long after real edits —
    // replacing the old itemName/qty/unitPrice truthiness check, which
    // couldn't tell an auto-filled value from a typed one.
    const autoInsertedItemsRef = useRef(JSON.stringify([{ ...EMPTY_ITEM }]));

    // Issue #272 — the jobs are fetched the first time the modal opens and kept
    // for the rest of the session: the list is small, it does not change while a
    // form is open, and a second open should not spend a second read. `idle`
    // means never asked, which is what makes that test one line.
    async function openDirectPurchase() {
        setDpOpen(true);
        if (dpJobs.status !== "idle") return;
        setDpJobs({ status: "loading", jobs: [] });
        try {
            const res = await fetch("/api/jobs");
            if (!res.ok) throw new Error(`jobs ${res.status}`);
            const { jobs = [] } = await res.json();
            setDpJobs({ status: "done", jobs });
        } catch (err) {
            console.error("could not load the job list", err);
            setDpJobs({ status: "error", jobs: [] });
        }
    }

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
            const {
                confirmed = [],
                unconfirmed = [],
                withdrawn = [],
                vendorConflict = false,
            } = await res.json();

            // Issue #138 — a detected PO that has been withdrawn. Reported,
            // never auto-selected: nothing can be invoiced against it. The
            // wording has to be distinguishable from a failed detection,
            // because the two mean opposite things — this PO number was
            // printed on an invoice that actually delivered, so either the
            // vendor shipped against a canceled order or the withdrawal was
            // a mistake. Either way a person has to sort it out, so it reads
            // as a warning whatever else detection turned up.
            const withdrawnNote =
                withdrawn.length > 0
                    ? ` ${withdrawn.map((w) => w.poId).join(", ")} ${
                          withdrawn.length > 1 ? "are" : "is"
                      } withdrawn, so no invoice can be entered against ${
                          withdrawn.length > 1 ? "them" : "it"
                      } and ${
                          withdrawn.length > 1 ? "they weren't" : "it wasn't"
                      } selected — confirm with the vendor before continuing.`
                    : "";
            // Issue #92 — previously only ever surfaced in the multi-PO
            // branch below; a single confirmed PO with co-occurring
            // unconfirmed references silently dropped them. Computed up here
            // with withdrawnNote so every branch can share both.
            const unconfirmedNote =
                unconfirmed.length > 0
                    ? ` (${unconfirmed.length} unrecognized reference${unconfirmed.length > 1 ? "s" : ""} ignored)`
                    : "";
            // Issue #198 — a detected PO the President has not signed. The inverse of
            // the withdrawn note above in the one clause that matters: this PO WAS
            // selected. The wording is UNSIGNED_COPY's rather than this file's, so the
            // vocabulary check can read it, and the tone is deliberately not raised —
            // see that module for why an unsigned order is not a warning here.
            const unsignedNote =
                confirmed.some((c) => c.unsigned)
                    ? UNSIGNED_COPY.detected(confirmed.filter((c) => c.unsigned).map((c) => c.poId)).text
                    : "";

            if (vendorConflict) {
                setPoDetection({
                    level: "warning",
                    message: `Found PO references from more than one Vendor (${confirmed
                        .map((c) => c.poId)
                        .join(", ")}) — please verify and select manually below.${withdrawnNote}`,
                });
                return;
            }

            if (confirmed.length === 0) {
                if (withdrawn.length > 0) {
                    // Issue #138 — no selectable PO, but emphatically not a
                    // detection failure: say which PO was found and that it's
                    // withdrawn.
                    setPoDetection({
                        level: "warning",
                        message: `No PO on this invoice can be invoiced against.${withdrawnNote}${unconfirmedNote}`,
                    });
                } else if (unconfirmed.length > 0) {
                    // Issue #92, case 2 — a PO-number-looking string was
                    // found, but no real PO matches it.
                    setPoDetection({
                        level: "warning",
                        message: `Found what looks like a PO number (${unconfirmed.join(
                            ", "
                        )}) but no matching PO exists — check it wasn't mistyped, or select manually below.`,
                    });
                } else {
                    // Issue #92, case 3 — nothing PO-number-like was found
                    // at all (also covers the PDF fetch/parse itself
                    // failing — the route's catch below returns this same
                    // empty shape, indistinguishable to the user either
                    // way). Deliberately neutral wording, not "mismatch"
                    // styled: there's nothing to validate, just nothing to
                    // auto-fill.
                    setPoDetection({
                        level: "info",
                        message: "Auto-detection didn't find a PO number in this file — select the PO manually below.",
                    });
                }
                return; // Nothing to auto-fill — falls back to manual entry as-is.
            }

            // Issue #92, case 1 — a matched PO that's already fully
            // invoiced (every PO Item's cumulative invoiced Qty already
            // meets its ordered Qty), independent of PO.Status. Computed
            // server-side (detect-po/route.js), since #244 by reading the
            // order's own `Uninvoiced Items` off the record the route already
            // fetched, so this is just reading a flag already on each
            // confirmed entry.
            // Non-blocking — an unusual but legitimate scenario (e.g. a
            // correction or late add-on charge) — so it only ever changes
            // the message's tone (level: "warning"), never what auto-fills.
            const closedPos = confirmed.filter((c) => c.isOpen === false);
            // Only spells out which PO IDs when there's more than one
            // confirmed PO to disambiguate between — with just one, it was
            // already just named earlier in the same message.
            const fullyInvoicedNote =
                closedPos.length === 0
                    ? ""
                    : confirmed.length > 1
                        ? ` — already fully invoiced: ${closedPos.map((c) => c.poId).join(", ")} (double-check before submitting)`
                        : " — already fully invoiced (double-check before submitting)";
            const detectionLevel = closedPos.length > 0 || withdrawn.length > 0 ? "warning" : "info";

            // Merge any confirmed PO that isn't already in posList — see
            // the posList comment above for why this can happen.
            setPosList((prev) => {
                const missing = confirmed.filter((c) => !prev.some((po) => po.id === c.recordId));
                // Issue #242 — detection also CLAIMS an order the list already holds,
                // or the banner would name a PO the dropdown stopped offering. The
                // rule is lib/poPickerOptions.js:claimDetected, which hands back the
                // same array when it changed nothing.
                const claimed = claimDetected(prev, confirmed.map((c) => c.recordId));
                if (missing.length === 0 && claimed === prev) return prev;
                return [
                    ...claimed,
                    // Issue #198 — `unsigned` comes along, or a PO that reached the
                    // list only through detection would read as unsigned in the
                    // banner and as nothing in the select directly below it.
                    //
                    // Issue #242 — and `origin` comes along, because the narrowing
                    // rule has to tell this merge from the search's. A detected order
                    // stays offered while unselected: the non-pristine branch below
                    // names it and says to pick it manually.
                    ...missing.map((c) => ({
                        id: c.recordId,
                        poId: c.poId,
                        vendorId: c.vendorId,
                        unsigned: c.unsigned,
                        origin: PO_ORIGIN.detected,
                    })),
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
                    level: detectionLevel,
                    message: `Detected PO${confirmed.length > 1 ? "s" : ""}: ${confirmed
                        .map((c) => c.poId)
                        .join(", ")}${fullyInvoicedNote}${unconfirmedNote} — not auto-applied since a PO or items are already entered. Select manually above if needed.${withdrawnNote}`,
                });
                return;
            }

            const newSlots = confirmed.map((c) => ({ ...EMPTY_SLOT, poRecordId: c.recordId }));
            setPoSlots(newSlots);
            newSlots.forEach((s) => ensurePoItemsLoaded(s.poRecordId));

            if (newSlots.length === 1) {
                const only = newSlots[0].poRecordId;
                setItems((prev) => {
                    const next = applyDefaultsAcrossItems(
                        prev.map((item) => ({ ...item, poRecordId: only })),
                        poItemsCache
                    );
                    autoInsertedItemsRef.current = JSON.stringify(next);
                    return next;
                });
                setPoDetection({
                    level: detectionLevel,
                    message: `Detected PO: ${confirmed[0].poId} (auto-filled below)${fullyInvoicedNote}${unconfirmedNote}.${withdrawnNote}${unsignedNote}`,
                });
            } else {
                // Multi-PO case: scaffold one item row per detected PO,
                // each pre-set to a different one, rather than leaving a
                // single blank row with no default PO to seed it with.
                const nextItems = confirmed.map((c) =>
                    defaultedItem({ ...EMPTY_ITEM, poRecordId: c.recordId }, poItemsCache)
                );
                setItems(nextItems);
                autoInsertedItemsRef.current = JSON.stringify(nextItems);
                setPoDetection({
                    level: detectionLevel,
                    message: `Detected ${confirmed.length} POs: ${confirmed
                        .map((c) => c.poId)
                        .join(", ")} — auto-filled below, verify each item's assignment.${fullyInvoicedNote}${unconfirmedNote}${withdrawnNote}${unsignedNote}`,
                });
            }
        } catch (err) {
            // Silent — convenience feature only, manual entry is always
            // available regardless of whether this request itself failed.
            console.error("PO detection request failed", err);
        }
    }

    // Issue #91 — most-recently-created first, since the PO someone just
    // generated is the common case being invoiced. Sorted by PO ID text,
    // not Created Date: that field is date-only (no time), so same-day POs
    // would otherwise tie and fall back to arbitrary API order. PO ID
    // (HYE-PO-YYYYMMDD-##) is fixed-width and zero-padded throughout, so a
    // plain string sort already gives the exact chronological + same-day-
    // sequence order — no timestamp needed. Sorted here rather than once
    // at the getOpenPOs() source, since posList also grows from PO
    // detection and the "search closed POs" toggle, both of which just
    // append whatever's missing without re-sorting.
    const posForVendor = useMemo(
        () =>
            posList
                .filter((po) => po.vendorId === vendorId)
                .sort((a, b) => (a.poId < b.poId ? 1 : a.poId > b.poId ? -1 : 0)),
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
    // Issue #99 — Items stays locked (visible but faded/disabled, not
    // hidden — so the overall shape of the invoice is visible right away)
    // until at least one PO is chosen and every currently-selected PO's
    // items have actually finished loading. Mirrors the existing Vendor-
    // before-PO gating. Requiring *every* selectedPoId to be "done" (not
    // just the first) keeps this simple for the multi-PO case, at the
    // cost of Items staying locked slightly longer than strictly
    // necessary if only one of several POs is still loading.
    const itemsReady =
        selectedPoIds.length > 0 &&
        selectedPoIds.every((id) => poItemsCache[id]?.status === "done");

    // Issue #91 — prefills Shipping Fee from the single selected PO's own
    // Shipping Fee, in addition to (not replacing) the reference text
    // below the field — still fully editable. Only while untouched — once
    // the user edits (or replacePoSlots resets the touched flag on a real
    // PO swap), this never overwrites it again. Always resolves to a
    // concrete value while untouched (falls back to "" when the new
    // selection has no single-PO fee to prefill from) rather than only
    // ever setting a value and never clearing one — otherwise switching
    // from a PO with a fee to one without (or to no/multiple POs) would
    // silently leave the previous PO's stale fee sitting in the field.
    // Read off selectedPos rather than threaded into every place poSlots
    // can change (handleSlotChange's first-pick branch, replacePoSlots,
    // detection's own setPoSlots call), since selectedPos already reacts
    // correctly to all of them.
    //
    // Issue #187 — this WAS a useEffect calling setShippingFee, and it was
    // the single error `npx eslint .` reported on this repo
    // (react-hooks/set-state-in-effect). The rule is right here rather
    // than a style to argue with: while untouched the state was a copy of
    // something already in state, so every PO change rendered the previous
    // PO's fee first and only then re-rendered with the new one. Deriving
    // it removes that second render and needs no dependency array. The two
    // values are what make it work — the prefill and the edit are separate
    // and the flag picks one, so nothing ever has to overwrite the other.
    const prefilledShippingFee =
        selectedPos.length === 1 && selectedPos[0].shippingFee != null
            ? String(selectedPos[0].shippingFee)
            : "";
    const shippingFee = shippingFeeTouched ? shippingFeeEdit : prefilledShippingFee;

    // Fetch-if-missing, guarded against duplicate in-flight requests for
    // the same PO via the ref above (never a setState updater — see its
    // comment for why). Never re-fetches a "done" entry (see poItemsCache
    // comment above for why that's safe) but always retries an "error" one.
    function ensurePoItemsLoaded(poRecordId) {
        if (poItemsFetchStartedRef.current.has(poRecordId)) return;
        poItemsFetchStartedRef.current.add(poRecordId);
        setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "loading", items: [] } }));
        fetchPoItems(poRecordId);
    }

    async function fetchPoItems(poRecordId) {
        try {
            const res = await fetch(`/api/pos/${poRecordId}/items`);
            if (!res.ok) throw new Error("Request failed");
            const { items: rawItems } = await res.json();
            const sorted = sortByUninvoiced(rawItems);
            setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "done", items: sorted } }));
            applyDefaultPoItemSelection(poRecordId, sorted);
        } catch (err) {
            console.error("Failed to load PO Items for", poRecordId, err);
            setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "error", items: [] } }));
            poItemsFetchStartedRef.current.delete(poRecordId);
        }
    }

    // Issue #57 — once a PO's items finish loading, any invoice item still pointing
    // at that PO with poItemTouched still false gets defaulted to the
    // first item in Uninvoiced-sorted order — a UI affordance making clear
    // the dropdown is the primary path, not a guess at the correct item.
    // Thin wrapper around defaultedItem: builds a one-PO cache override so
    // it only ever touches invoice items pointing at this poRecordId, using data
    // that (per the caller, fetchPoItems) isn't in poItemsCache state yet.
    function applyDefaultPoItemSelection(poRecordId, sortedItems) {
        if (sortedItems.length === 0) return;
        const cacheOverride = { [poRecordId]: { status: "done", items: sortedItems } };
        setItems((prev) => {
            const next = applyDefaultsAcrossItems(prev, cacheOverride);
            autoInsertedItemsRef.current = JSON.stringify(next);
            return next;
        });
    }

    // Issue #99 — Vendor change swaps the PO (and wipes items) exactly the
    // same way a direct PO change does, so it now goes through the same
    // confirmIfDirty gate instead of resetting silently — previously the
    // asymmetry meant a genuine in-progress edit could get wiped with no
    // warning just because the swap happened to come from the Vendor
    // picker instead of the PO picker.
    function handleVendorChange(e) {
        const newVendorId = e.target.value;
        confirmIfDirty(() => {
            setVendorId(newVendorId);
            // POs picked under the previous Vendor almost certainly don't
            // belong to the new one — same reset replacePoSlots always
            // does on a real swap.
            replacePoSlots([{ ...EMPTY_SLOT }]);
        }, "Vendor");
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
        const nextItems = [defaultedItem(fresh, poItemsCache)];
        setItems(nextItems);
        autoInsertedItemsRef.current = JSON.stringify(nextItems);
        activeIds.forEach((id) => ensurePoItemsLoaded(id));
        // Issue #91 — a real PO swap gets a fresh Shipping Fee prefill
        // opportunity too, same as items resetting above.
        setShippingFeeTouched(false);
    }

    // Issue #99 — "dirty" now means items has actually diverged from its
    // last auto-inserted snapshot (see autoInsertedItemsRef), not just
    // "some field happens to be non-empty" — an auto-filled default looked
    // identical to real content under the old check, firing the warning
    // even when nothing had been touched. Only prompts if there's actually
    // something to lose.
    // Issue: confirmation now goes through the in-app ConfirmDialog below
    // instead of window.confirm() — unlike that native call, showing a
    // React modal can't block synchronously, so a dirty check defers
    // `proceed` into pendingConfirm state and runs it only once the user
    // actually clicks through (handled by the dialog's onConfirm below).
    function confirmIfDirty(proceed, subject) {
        const dirty = JSON.stringify(items) !== autoInsertedItemsRef.current;
        if (dirty) {
            setPendingConfirm({ proceed, subject });
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
                    setItems((prev) => {
                        const next = applyDefaultsAcrossItems(
                            prev.map((item) => ({ ...item, poRecordId: newValue })),
                            poItemsCache
                        );
                        autoInsertedItemsRef.current = JSON.stringify(next);
                        return next;
                    });
                }
            }
            return;
        }

        confirmIfDirty(() => replacePoSlots(nextSlots), "PO");
    }

    function handleRemoveSlot(slotIndex) {
        const previousValue = poSlots[slotIndex].poRecordId;
        const nextSlots = poSlots.filter((_, i) => i !== slotIndex);

        if (!previousValue) {
            setPoSlots(nextSlots);
            return;
        }

        confirmIfDirty(() => replacePoSlots(nextSlots), "PO");
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
                // Issue #242 — tagged, so the dropdown can stop offering these once
                // no slot holds them. They stay in the list either way: removing a
                // record is what would break a result picked a moment later.
                return [...prev, ...missing.map((r) => ({ ...r, origin: PO_ORIGIN.search }))];
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
        // Issue #91 — excludes whatever every existing invoice item already has
        // selected, so a fresh "+ Add item" invoice item never auto-defaults to a
        // PO Item that's already on the invoice.
        setItems((prev) => {
            const fresh = { ...EMPTY_ITEM, poRecordId: selectedPoIds[0] || "" };
            return [...prev, defaultedItem(fresh, poItemsCache, usedElsewhereIds(prev, -1))];
        });
    }

    function removeItem(index) {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }

    function updateItem(index, field, value) {
        setItems((prev) => {
            const used = usedElsewhereIds(prev, index);
            return prev.map((item, i) => {
                if (i !== index) return item;
                if (field === "poRecordId") {
                    // Issue #51 — a PO Item picked under the invoice item's previous
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
                    // Issue #91 — used excludes sibling invoice items' PO Items, so
                    // this never re-defaults onto one already claimed.
                    return defaultedItem(
                        {
                            ...item,
                            poRecordId: value,
                            poItemRecordId: "",
                            poItemTouched: false,
                            unitPriceEditing: false,
                        },
                        poItemsCache,
                        used
                    );
                }
                return { ...item, [field]: value };
            });
        });
    }

    // Issue #51 — the single sync point for an invoice item's PO Item choice.
    // Selecting a PO Item copies its name (and, per #57, its Unit Price, freshly
    // re-locked, plus per #84, its Size/Unit) in.
    // Issue #57 — poItemTouched is set true on any explicit choice here, so
    // applyDefaultPoItemSelection never later overwrites a deliberate pick with
    // its own default.
    //
    // NO EMPTY BRANCH SINCE #278. The select's only options are ordered items, so
    // it cannot emit `""` any more; the branch that stood here read an empty value
    // as "Other (free text)" and cleared Size/Unit for it. A defensive early
    // return would be a guard for a value nothing sends.
    function updatePoItemSelection(index, poItemRecordId) {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;
                const candidates = poItemsCache[item.poRecordId]?.items || [];
                const matched = candidates.find((poItem) => poItem.id === poItemRecordId);
                return {
                    ...item,
                    poItemRecordId,
                    poItemTouched: true,
                    itemName: matched ? matched.itemName : item.itemName,
                    size: matched?.size || "",
                    unit: matched?.unit || "",
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
    //
    // #283 — THIS IS THE CLIENT-SIDE TWIN OF THE ISSUE'S OWN BUG, which is why
    // `offline/invoice-money-terms.mjs` asserts on this declaration by name. A
    // term that reaches the form and the screen but not this sum makes the
    // preview read low, and a reader comparing it against the vendor's document
    // then sees a disagreement the vendor did not cause — the same shape as the
    // Airtable formula missing the term, one layer up.
    const calculatedTotal =
        itemsTotal +
        (parseFloat(shippingFee) || 0) +
        (tariffEnabled ? parseFloat(tariff) || 0 : 0) +
        (salesTaxEnabled ? parseFloat(salesTax) || 0 : 0);
    // Issue #254 — THE JUDGMENT IS `lib/variance.js`'s, AND WHAT IS SHARED IS THE
    // TOLERANCE RATHER THAN THE INPUTS. This read `> 0.01` (#57) while the flag
    // stored on the saved record needed five dollars or one percent (#15), so an
    // invoice could be warned about here and then carry no mark at all — which
    // reads as the discrepancy having been resolved.
    //
    // THE SUM STAYS THIS FORM'S OWN and has to: there is no rollup in a browser,
    // and the backend's figure is Airtable's `Calculated Total` re-read after the
    // charges are linked. The two cannot always see the same number, so passing
    // this form's own two figures to the shared predicate is the whole of what
    // one rule can mean here — `calculatedTotal` above is the same binding the
    // label renders, so the warning and the preview cannot come apart.
    const totalsMismatch =
        vendorStatedTotal !== "" &&
        !Number.isNaN(parseFloat(vendorStatedTotal)) &&
        checkHeaderVariance(parseFloat(vendorStatedTotal), calculatedTotal);
    // Issue #91 — same sanity-check idea as totalsMismatch, scoped to
    // Shipping Fee vs. the single selected PO's own figure: the field
    // stays freely editable (prefilled, not locked), so this is what
    // catches it having quietly drifted from the PO's reference value.
    const shippingFeeMismatch =
        selectedPos.length === 1 &&
        selectedPos[0].shippingFee != null &&
        shippingFee !== "" &&
        !Number.isNaN(parseFloat(shippingFee)) &&
        Math.abs(parseFloat(shippingFee) - selectedPos[0].shippingFee) > 0.01;

    // Issue #57 layout follow-up — extracted so the same slot rendering
    // can be called once inline (poSlots[0], next to Vendor) and again for
    // any additional slots below; no behavior changed from before, just
    // where it's invoked from.
    function renderPoSlot(slot, slotIndex) {
        // Issue #242 — the two rules this list obeys are one function now
        // (lib/poPickerOptions.js): a slot may not offer an order another slot holds,
        // and a searched order is offered only while a slot holds it. Derived here
        // rather than pruned out of `posList` on the search toggle, so no gesture can
        // leave the state disagreeing with it and nothing a picked result needs is
        // ever removed.
        const optionsForSlot = poOptionsForSlot({ posForVendor, slot, selectedPoIds });
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
                                <ul className="mt-1 divide-y divide-zinc-200 rounded border border-zinc-300 text-sm">
                                    {visibleResults.length === 0 ? (
                                        <li className="px-3 py-1.5 text-zinc-500">No matching POs.</li>
                                    ) : (
                                        visibleResults.map((po) => (
                                            <li key={po.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSlotChange(slotIndex, po.id)}
                                                    className="block w-full px-3 py-1.5 text-left hover:bg-zinc-100"
                                                >
                                                    {poOptionLabel(po)}
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
                                    {poOptionLabel(po)}
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
                <div className="flex items-center justify-between gap-4">
                    <button type="button" onClick={handleAddSlot} className="text-xs text-zinc-400 underline">
                        + Add another PO
                    </button>
                    {/* Issue #272 — THE WAY OUT, AND IT IS ALWAYS HERE. One of the two
                        dead ends is a judgment only the reader can make — an order
                        matched, and its ordered items are not what this invoice charges
                        for — so there is no state to reveal a control on. It sits with
                        the order picker because that is where a reader runs out of
                        orders, next to #57's search toggle, which is the other escape
                        hatch from the same control. */}
                    <button
                        type="button"
                        onClick={openDirectPurchase}
                        className="text-xs underline"
                    >
                        {DIRECT_PURCHASE_COPY.affordance}
                    </button>
                </div>

                <div>
                    <label htmlFor="vendorInvoiceCode" className="block text-sm font-medium">
                        Vendor Invoice #
                    </label>
                    <input
                        id="vendorInvoiceCode"
                        name="vendorInvoiceCode"
                        placeholder="The vendor's own invoice number, as printed on their document"
                        value={vendorInvoiceCode}
                        onChange={(e) => setVendorInvoiceCode(e.target.value)}
                        className={fieldClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="issueDate" className="block text-sm font-medium">
                            Issue Date
                        </label>
                        <input
                            type="date"
                            id="issueDate"
                            name="issueDate"
                            required
                            value={issueDate}
                            onChange={(e) => setIssueDate(e.target.value)}
                            className={fieldClass}
                        />
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

    /**
     * Issue #272 — recording the invoice as a direct purchase.
     *
     * ITS OWN FORM, RENDERED OUTSIDE THE INVOICE FORM. Forms cannot nest, and a
     * `formAction` override on a button inside the invoice form would return into
     * nothing: `useActionState` belongs to the form, so a refusal would be silently
     * dropped. The two hidden fields the invoice form already carries are therefore
     * restated here off the same state — one source, two readers.
     *
     * IT ASKS FOR THE TWO THINGS THE DOCUMENT CANNOT SUPPLY. The Job is what puts
     * the row in front of a site and the office learns it by telephone; the note is
     * what that call leaves behind, and it is the only thing the site's list can say
     * about what was bought, since no items are recorded here.
     */
    function renderDirectPurchaseModal() {
        const fileUrl = invoiceFile.status === "done" ? invoiceFile.url : "";
        const blocked = directPurchaseBlocked({ vendorId, fileUrl, jobId: dpJobId });
        const pickedJob = dpJobs.jobs.find((job) => job.id === dpJobId);

        return (
            <div className={MODAL_BACKDROP}>
                <div className={`${MODAL_CARD} max-w-lg`}>
                    <h2 className="text-lg font-medium">{DIRECT_PURCHASE_COPY.modal.heading}</h2>
                    <div className="mt-3 space-y-2 text-sm text-zinc-600">
                        <p>{DIRECT_PURCHASE_COPY.modal.summary({ vendorInvoiceCode }).text}</p>
                        <p>{DIRECT_PURCHASE_COPY.modal.abandons.text}</p>
                    </div>

                    <form action={dpFormAction} className="mt-4 space-y-3">
                        <input type="hidden" name="vendorId" value={vendorId} />
                        <input type="hidden" name="invoiceFileUrl" value={fileUrl} />
                        <input type="hidden" name="invoiceFileFilename" value={invoiceFile.filename || ""} />
                        <input type="hidden" name="vendorInvoiceCode" value={vendorInvoiceCode} />
                        <input type="hidden" name="issueDate" value={issueDate} />
                        {/* Display text for the confirmation the office lands on, out of
                            the list this modal already fetched. The id is the fact and
                            the action carries that; this is what saves a read to turn a
                            record id back into a job code. */}
                        <input type="hidden" name="jobCode" value={pickedJob?.jobCode || ""} />

                        <div>
                            <label htmlFor="dpJob" className="block text-sm font-medium">
                                Job
                            </label>
                            <p className="text-xs text-zinc-500">
                                {DIRECT_PURCHASE_COPY.modal.job({ jobKnown: false }).text}
                            </p>
                            <select
                                id="dpJob"
                                name="jobId"
                                value={dpJobId}
                                onChange={(e) => setDpJobId(e.target.value)}
                                disabled={dpJobs.status !== "done"}
                                className={fieldClass}
                            >
                                <option value="">
                                    {dpJobs.status === "loading"
                                        ? "Loading jobs..."
                                        : dpJobs.status === "error"
                                          ? "Couldn't load the jobs — close this and try again"
                                          : "Select a Job"}
                                </option>
                                {dpJobs.jobs.map((job) => (
                                    <option key={job.id} value={job.id}>
                                        {job.jobCode} — {job.jobName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="dpNotes" className="block text-sm font-medium">
                                Notes
                            </label>
                            <p className="text-xs text-zinc-500">{DIRECT_PURCHASE_COPY.modal.notes.text}</p>
                            <textarea
                                id="dpNotes"
                                name="notes"
                                rows={3}
                                value={dpNotes}
                                onChange={(e) => setDpNotes(e.target.value)}
                                className={fieldClass}
                            />
                        </div>

                        {/* The refusal a reader can act on, in the order they would fix
                            them, and the same predicate the action re-asks — so this
                            button never offers what the server declines. */}
                        {blocked && (
                            <p className="text-sm text-amber-700">{DIRECT_PURCHASE_COPY.blocked[blocked]}</p>
                        )}
                        {dpState?.error && <p className="text-sm text-red-700">{dpState.error}</p>}

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDpOpen(false)}
                                disabled={dpPending}
                                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                            >
                                {DIRECT_PURCHASE_COPY.modal.cancel}
                            </button>
                            <button
                                type="submit"
                                disabled={dpPending || Boolean(blocked)}
                                className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
                            >
                                {dpPending ? "Recording..." : DIRECT_PURCHASE_COPY.modal.confirm}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    function renderFileSection() {
        return (
            <div>
                <h2 className="text-lg font-semibold">Invoice File</h2>
                <p className="text-sm text-zinc-600">
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
        // Issue #99 — locked (visible but faded/disabled, not hidden — so
        // the shape of the invoice is visible right away) until a PO is
        // chosen and its items have finished loading. Fixes two things at
        // once: the item dropdown briefly rendering with zero options
        // before the first real item loads, and Item Name being a live
        // free-text box before any PO (and thus any PO Item list to
        // constrain it) even exists.
        const locked = !itemsReady;
        return (
            <div>
                <h2 className="text-lg font-semibold">Items</h2>
                {locked && (
                    <p className="mt-1 text-xs text-zinc-500">
                        {selectedPoIds.length === 0
                            ? "Select a PO above to add items."
                            : selectedPoIds.some((id) => poItemsCache[id]?.status === "error")
                                ? "Couldn't load this PO's items — try re-selecting the PO."
                                : "Loading PO items..."}
                    </p>
                )}
                <div className={locked ? "mt-2 space-y-3 opacity-50" : "mt-2 space-y-3"}>
                    {items.map((item, i) => {
                        const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                        // The per-item PO picker only makes sense (and only
                        // renders) once the header has claimed 2+ POs —
                        // with exactly one selected, every item is forced
                        // to it, so there's no real choice left to show.
                        const showPoPicker = selectedPoIds.length >= 2;
                        // Issue #51 — the PO Item dropdown can't be scoped
                        // until the invoice item actually has a PO (either forced
                        // by the header's single-PO case, or picked via
                        // showPoPicker above); until then this falls back
                        // to the old plain free-text input.
                        const poItemsEntry = item.poRecordId ? poItemsCache[item.poRecordId] : null;
                        const poItemOptions = poItemsEntry?.items || [];
                        // Issue #91 — once a PO Item is picked on one invoice item,
                        // it shouldn't still be pickable on another invoice item of
                        // the same invoice. Always keeps this invoice item's own
                        // current selection available regardless — same
                        // "selected value needs a matching <option>"
                        // concern as posList's own comment above.
                        const usedElsewhere = usedElsewhereIds(items, i);
                        const availablePoItemOptions = poItemOptions.filter(
                            (poItem) => poItem.id === item.poItemRecordId || !usedElsewhere.has(poItem.id)
                        );
                        // Issue #278 — THE SECOND PATH TO A CHARGE WITH NO ORDERED
                        // ITEM, and the one removing `SHOW_OTHER_ITEM_OPTION` does
                        // not close. #91 keeps one ordered item to one row of one
                        // invoice, so a row pointed at a PO whose every ordered item
                        // a sibling row has already claimed has nothing left to
                        // pick: `defaultedItem` returns it untouched with an empty
                        // `poItemRecordId`, this filter comes back empty, and the
                        // select renders with no options at all.
                        //
                        // #99's COMMENT BELOW SAYS THAT COMBINATION WAS FIXED, AND
                        // IT FIXED ONE CAUSE OF IT. There it was a PO picked whose
                        // items had not finished loading, which `!locked` now
                        // covers; the same empty select above the same free-text box
                        // survived for this cause, because the items ARE loaded and
                        // every one of them is spoken for. Same symptom, different
                        // cause, and only the first had a guard.
                        //
                        // The row says why rather than offering a box that
                        // `createInvoiceAction` will refuse — this repo names what a
                        // reader cannot do where they would try it (#232) and marks
                        // a choice it still offers (#198), so silently accepting a
                        // typed name and rejecting it on submit is the shape both
                        // of those decisions are against.
                        const noOrderedItemLeft =
                            !locked && Boolean(item.poRecordId) && availablePoItemOptions.length === 0;
                        // Issue #57 — only meaningful once a real PO Item is linked,
                        // and since #278 that is every saved charge.
                        const linkedPoItem = item.poItemRecordId
                            ? poItemOptions.find((p) => p.id === item.poItemRecordId)
                            : null;
                        const qtyExceedsUninvoiced =
                            linkedPoItem != null &&
                            linkedPoItem.uninvoicedQty != null &&
                            (parseFloat(item.qty) || 0) > linkedPoItem.uninvoicedQty;
                        const unitPriceLocked = !!item.poItemRecordId && !item.unitPriceEditing;
                        const showRemark = item.unitPriceEditing || qtyExceedsUninvoiced;
                        return (
                            <div key={i} className="rounded border border-zinc-300 p-3">
                                <div
                                    className={
                                        showPoPicker
                                            ? "grid grid-cols-2 gap-2 sm:grid-cols-4"
                                            : "grid grid-cols-2 gap-2 sm:grid-cols-3"
                                    }
                                >
                                    {/* Issue #99 — the PO Item select only ever renders once
                                        this row's PO is actually loaded (`!locked`); while no PO
                                        is chosen yet, or one is chosen but still loading, this
                                        falls to the single plain Item Name box below instead —
                                        previously both rendered at once (an empty, 0-option
                                        select stacked above a free-text box) whenever a PO was
                                        picked but poItemRecordId hadn't been auto-filled yet. The
                                        old per-row "Loading PO items..."/error messages here are
                                        gone too — always dead once `!locked` guarantees every
                                        selected PO's fetch already succeeded; the section-level
                                        message above now covers both. */}
                                    {item.poRecordId && !locked ? (
                                        <div className="space-y-1">
                                            <select
                                                value={item.poItemRecordId}
                                                onChange={(e) => updatePoItemSelection(i, e.target.value)}
                                                className={inputClass + " w-full"}
                                            >
                                                {availablePoItemOptions.map((poItem) => (
                                                    <option key={poItem.id} value={poItem.id}>
                                                        {poItem.itemName}
                                                        {poItem.size ? ` — ${poItem.size}` : ""}
                                                        {poItem.uninvoicedQty != null
                                                            ? ` (Uninvoiced: ${poItem.uninvoicedQty})`
                                                            : ""}
                                                    </option>
                                                ))}
                                                {/* An `Other (free text)` option stood here, moved
                                                    to the end of the list by #57 and hidden by #96.
                                                    It is gone with the flag (#278) — see the note
                                                    where that constant was. */}
                                            </select>
                                            {/* Issue #84 — reference-only, frozen from the linked
                                                PO Item at selection time; no input, no edit path.
                                                A mismatch here means the wrong PO Item was picked,
                                                not a value to correct in place. */}
                                            {item.poItemRecordId && (item.size || item.unit) && (
                                                <p className="text-xs text-zinc-500">
                                                    Size: {item.size || "—"} · Unit: {item.unit || "—"}
                                                </p>
                                            )}
                                            {/* Issue #278 — a free-text Item Name box stood here,
                                                on `!item.poItemRecordId`. It was the other half of
                                                the option above, and the only way to reach it now
                                                is the exhausted-PO state, which says what happened
                                                instead. */}
                                            {noOrderedItemLeft && (
                                                <p className="text-xs text-amber-700">
                                                    Every item on this purchase order is already on
                                                    another charge of this invoice. Pick a different
                                                    purchase order for this charge, or remove it.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        /* Issue #272 — THE OTHER FREE-TEXT `Item Name` BOX, and the one
                                           #278 did not reach. It removed the box on
                                           `!item.poItemRecordId` and left this one, on
                                           `!item.poRecordId`, where the row's own purchase order has
                                           not been picked yet — reachable whenever the header holds
                                           two orders, since then each row picks its own. Whatever was
                                           typed here could never survive: choosing the order
                                           overwrites `itemName` from the ordered item, and submitting
                                           without one is refused by `createInvoiceAction`. It was
                                           `required` as well, so the browser blocked the submit and
                                           pointed at a name when what was missing was an order.

                                           A DISABLED SELECT RATHER THAN NOTHING, so the row keeps the
                                           shape #99 kept it for, and its one option names the
                                           prerequisite the way the PO slot's `Select a Vendor first`
                                           already does. The long form of the same fact is the
                                           section-level message above; this is the short one, which
                                           is the density split the strip chips make. */
                                        <select
                                            disabled
                                            value=""
                                            className={inputClass + " w-full"}
                                        >
                                            <option value="">
                                                {locked ? "Select a PO above" : "Pick this charge's PO first"}
                                            </option>
                                        </select>
                                    )}
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        required
                                        disabled={locked}
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
                                            disabled={locked || unitPriceLocked}
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                                            className={inputClass + " flex-1"}
                                        />
                                        {unitPriceLocked && (
                                            <button
                                                type="button"
                                                onClick={() => updateItem(i, "unitPriceEditing", true)}
                                                disabled={locked}
                                                className="shrink-0 text-xs text-zinc-500 underline disabled:opacity-50"
                                            >
                                                Edit
                                            </button>
                                        )}
                                        {item.poItemRecordId && item.unitPriceEditing && (
                                            <button
                                                type="button"
                                                onClick={() => handleCancelUnitPriceEdit(i)}
                                                disabled={locked}
                                                className="shrink-0 text-xs text-zinc-500 underline disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                    {showPoPicker && (
                                        <select
                                            required
                                            disabled={locked}
                                            value={item.poRecordId}
                                            onChange={(e) => updateItem(i, "poRecordId", e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="" disabled>
                                                PO
                                            </option>
                                            {selectedPos.map((po) => (
                                                <option key={po.id} value={po.id}>
                                                    {poOptionLabel(po)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {qtyExceedsUninvoiced && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        Qty ({item.qty}) exceeds this PO Item&apos;s uninvoiced quantity (
                                        {linkedPoItem.uninvoicedQty}) — not blocked, but worth a note below.
                                    </p>
                                )}
                                {showRemark && (
                                    <input
                                        placeholder="Remark — why this differs from the PO"
                                        disabled={locked}
                                        value={item.remark}
                                        onChange={(e) => updateItem(i, "remark", e.target.value)}
                                        className={inputClass + " mt-2 w-full"}
                                    />
                                )}
                                <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                                    <span>Amount (preview): {amount.toFixed(2)}</span>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(i)}
                                            disabled={locked}
                                            className="text-red-600 disabled:opacity-50"
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
                    disabled={locked}
                    className="mt-3 rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
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
    //
    // #283 — Sales Tax is the fourth slot, after Tariff, and `flex-1` is what
    // makes a second optional term cost nothing here: the row is 2, 3 or 4
    // columns and no branch counts them. Its order matches the invoice detail's
    // totals footer and the Calculated Total formula's own argument order, so
    // the three places that enumerate these terms enumerate them alike.
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
                            onChange={(e) => {
                                setShippingFeeTouched(true);
                                setShippingFeeEdit(e.target.value);
                            }}
                            className={fieldClass}
                        />
                        {/* Issue #69, updated #78/#91 — reference only, no
                            computed variance: only shown for the common
                            single-PO case, since an invoice spanning several
                            POs has no single PO Shipping Fee to compare
                            against. Kept alongside the prefill above (not
                            replaced by it) — the field is still freely
                            editable, so this is what catches a since-edited
                            value quietly drifting from the PO's own figure. */}
                        {selectedPos.length === 1 && selectedPos[0].shippingFee != null && (
                            <p className="mt-1 text-xs text-zinc-500">
                                PO&apos;s Shipping Fee: {selectedPos[0].shippingFee}
                            </p>
                        )}
                        {shippingFeeMismatch && (
                            <p className="mt-1 text-xs text-amber-700">
                                Shipping Fee ({(parseFloat(shippingFee) || 0).toFixed(2)}) doesn&apos;t match the
                                PO&apos;s Shipping Fee ({selectedPos[0].shippingFee}) — double-check before
                                submitting.
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
                    {salesTaxEnabled && (
                        <div className="flex-1">
                            <label htmlFor="salesTax" className="block text-sm font-medium">
                                Sales Tax
                            </label>
                            <div className="mt-1 flex items-center gap-1">
                                <input
                                    type="number"
                                    step="0.01"
                                    id="salesTax"
                                    name="salesTax"
                                    value={salesTax}
                                    onChange={(e) => setSalesTax(e.target.value)}
                                    className={inputClass + " flex-1"}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSalesTaxEnabled(false);
                                        setSalesTax("");
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

                {/* #283 — one reveal control per absent term, in the same order as
                    the slots they open. Each is present exactly when its own term
                    is not in the sum, so the pair also states which terms this
                    invoice is being recorded WITHOUT. */}
                {(!tariffEnabled || !salesTaxEnabled) && (
                    <div className="mt-2 flex items-center gap-4">
                        {!tariffEnabled && (
                            <button
                                type="button"
                                onClick={() => setTariffEnabled(true)}
                                className="text-xs text-zinc-500 underline"
                            >
                                + Add Tariff
                            </button>
                        )}
                        {!salesTaxEnabled && (
                            <button
                                type="button"
                                onClick={() => setSalesTaxEnabled(true)}
                                className="text-xs text-zinc-500 underline"
                            >
                                + Add Sales Tax
                            </button>
                        )}
                    </div>
                )}

                {/* Issue #57 — sanity check, not enforcement: Amount Due
                    (Vendor's Stated Total) is still what gets stored and
                    submitted regardless of whether it agrees with this
                    preview. Catches a vendor's own arithmetic error or a
                    missed charge — the calculation alone can't.

                    #283 — THE TERM LIST IS GONE FROM THE LABEL, and the reason is
                    that a list with optional members has only two states and both
                    are wrong: fixed, it omits a term that is in the sum; complete,
                    it grows a word every time a term is added, and two optional
                    terms already make four spellings of one label. So the label
                    names the figure and the terms are named where their figures
                    are — which is what the invoice detail's totals footer already
                    does with the same computation, one row per term and no row for
                    an absent one.

                    WHAT THIS GIVES UP, stated because it was the list's real work:
                    `Vendor's Stated Total` sits in the same row as the three terms
                    and is not one of them, and the parenthetical was the only thing
                    saying so. What carries it now is the two words themselves —
                    `Calculated` against `Stated` — and, at the moment the question
                    actually arises, the mismatch line below, which puts the two
                    figures on opposite sides of one comparison. If that proves not
                    to be enough, the fix is a word on the stated-total field, not a
                    term list back on this one. */}
                <p className="mt-2 text-xs text-zinc-500">
                    Calculated total: {calculatedTotal.toFixed(2)}
                </p>
                {/* #254 — the sentence is `lib/variance.js`'s now, unchanged in
                    wording. Written here as element text it was invisible to the
                    vocabulary check, which reads `*_COPY` strings and nothing
                    else, and it belongs beside the predicate that decides when it
                    appears. */}
                {totalsMismatch && (
                    <p className="mt-1 text-xs text-amber-700">
                        {VARIANCE_COPY.headerBeforeSaving(
                            (parseFloat(vendorStatedTotal) || 0).toFixed(2),
                            calculatedTotal.toFixed(2)
                        )}
                    </p>
                )}
            </div>
        );
    }

    return (
        <>
        <form action={formAction} className="mt-6 space-y-8">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            <div className="flex gap-2 border-b border-zinc-300">
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
                disabled={pending || invoiceFile.status !== "done" || !itemsReady}
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

        {dpOpen && renderDirectPurchaseModal()}

        <ConfirmDialog
            open={pendingConfirm !== null}
            message={pendingConfirm ? confirmChangeMessage(pendingConfirm.subject) : ""}
            onConfirm={() => {
                const proceed = pendingConfirm?.proceed;
                setPendingConfirm(null);
                proceed?.();
            }}
            onCancel={() => setPendingConfirm(null)}
        />
        </>
    );
}

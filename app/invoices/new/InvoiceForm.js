"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { upload } from "@vercel/blob/client";
import { refuseOversizeUpload } from "@/lib/uploadLimit";
import { createInvoiceAction, createDirectPurchaseAction } from "./actions";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
// Issue #422 — the document this form transcribes, drawn beside it, in the box that
// took the file in the first place. It is drawn by the component the file viewer
// uses, so a file is drawn one way in this app; `./PaneFile.js` holds it with the
// pane's own toolbar (#433), and the classes, the breakpoint and the box's one
// sentence are `./filePane.js`.
import PaneFile from "./PaneFile";
import { FILE_AXIS, FILE_RENDER, fileRenderKind, fileViewerTitle } from "@/lib/fileLinks";
import {
    FILE_DROP_BOX,
    FILE_DROP_BOX_OVER,
    FILE_PANE,
    FILE_PANE_COPY,
    FILE_SLOT,
    FILE_SLOT_TOOLBAR_ROOM,
    FORM_COLUMN,
    FORM_COLUMNS,
} from "./filePane";
// Issue #198 — pure and import-free, so a client component may hold it; the judgment
// itself already ran on the server and every PO here carries its answer as `unsigned`.
import { UNSIGNED_COPY, poOptionLabel } from "@/lib/poUnsigned";
import { PO_ORIGIN, claimDetected, poOptionsForSlot } from "@/lib/poPickerOptions";
// Issue #660 — the same category: pure, so what this form says about an item's quantity
// and what `createInvoiceAction` writes are one spread. It took over #244's
// `hasUninvoicedQty` sort, which ordered one order's items with the uninvoiced first;
// `spreadChoices` orders the choices that way across every order.
import { INVOICE_SPREAD_COPY, spreadChoices, spreadInvoiceItems } from "@/lib/invoiceSpread";
// Issue #272 — pure and import-free, same category again: the words for the way
// out of an invoice with no order, and the one predicate the modal and
// `createDirectPurchaseAction` both ask so they cannot disagree about it.
import { DIRECT_PURCHASE_COPY, directPurchaseBlocked } from "@/lib/directPurchase";
// Issue #254 — the same category again, and the one that closes a divergence
// rather than avoiding one: `lib/variance.js` imports nothing at all, so the
// predicate the saved flag is set by is reachable from here. The form used to
// carry its own threshold for the same comparison.
import { VARIANCE_COPY, checkTotalsDiffer } from "@/lib/variance";

// #660 — AN ITEM IS ENTERED AS THE VENDOR WROTE IT: a choice of material at an ordered
// price from the header's orders (`lib/invoiceSpread.js:spreadChoices`), a quantity and a
// unit price, and no order. Saving spreads it over the ordered items of that choice, oldest
// order first; this form shows no spread and says one thing about it — a quantity past what
// the orders have uninvoiced. `key` is the choice's.
//
// choiceTouched: false until the user picks a choice. An untouched item shows the default
// `applyDefaultsAcrossItems` derives for it on every render — #187's derivation, so a choice
// arriving with an order's items needs no second write — and an edit to the item keeps what
// it was showing. unitPriceEditing: whether the Unit Price lock (#57) is open.
//
// `key: ""` IS A STATE OF THE FORM AND NOT OF A SAVED ITEM (#278): before an order is picked
// and while its items load, none of which may be submitted, which `createInvoiceAction`
// refuses. Nothing but a choice writes `itemName`.
const EMPTY_ITEM = {
    key: "",
    itemName: "",
    // Issue #84 — frozen copies from the chosen ordered items, same as itemName/
    // unitPrice: never manually entered, never editable.
    size: "",
    maker: "",
    unit: "",
    qty: "",
    unitPrice: "",
    choiceTouched: false,
    unitPriceEditing: false,
    remark: "",
};

// Issue #57 redesign — one PO header slot's full state: which PO (if any)
// it holds, plus its own independent "Show all / search closed POs"
// toggle and whatever that toggle's combobox currently has typed/found.
// Bundled together (rather than parallel arrays keyed by index) since
// they always change together and only ever matter per-slot.
const EMPTY_SLOT = { poRecordId: "", searchMode: false, query: "", results: [], status: "idle" };

// The fields an item takes from its choice. Size, Maker and Unit are the ordered items'
// frozen copies (#84); the unit price is the ordered one until the lock is opened (#57).
function withChoice(item, choice) {
    return {
        ...item,
        key: choice.key,
        itemName: choice.itemName,
        size: choice.size || "",
        maker: choice.maker || "",
        unit: choice.unit || "",
        unitPrice: choice.unitPrice != null ? String(choice.unitPrice) : item.unitPrice,
        unitPriceEditing: false,
    };
}

// Issue #57 — an untouched item shows the first choice no other item shows, those with
// something uninvoiced first (`spreadChoices`' order). #91 kept a sibling's pick out of a
// row's own list as well; #660 drops that half, because a vendor can write one material
// twice and both items have to be enterable — what is kept is only that a NEW row does not
// open on a choice already on the form. Applied across the list in order, so each default
// sees what the ones above it took, and idempotent, since `choiceTouched` never becomes true
// from a default. An item whose choice the orders no longer hold, or that has none, takes
// the first free one.
function applyDefaultsAcrossItems(itemsList, choices) {
    const keys = new Set(choices.map((c) => c.key));
    const used = new Set(itemsList.filter((it) => it.choiceTouched && keys.has(it.key)).map((it) => it.key));
    return itemsList.map((item) => {
        if (item.choiceTouched && keys.has(item.key)) return item;
        const kept = item.key && keys.has(item.key) && !used.has(item.key) ? choices.find((c) => c.key === item.key) : null;
        const choice = kept ?? choices.find((c) => !used.has(c.key));
        if (!choice) return { ...item, key: "", choiceTouched: false };
        used.add(choice.key);
        return item.key === choice.key ? item : withChoice({ ...item, choiceTouched: false }, choice);
    });
}

// What the spread needs of one of an order's ordered items, as `/api/pos/[poRecordId]/items`
// returns it, with the order it is on (`lib/invoiceSpread.js`).
function orderedItemForSpread(poItem, po) {
    return {
        id: poItem.id,
        poItemId: poItem.poItemId,
        poRecordId: po?.id ?? null,
        poId: po?.poId ?? null,
        poCreatedDate: po?.createdDate ?? null,
        materialRecordId: poItem.material?.[0] ?? null,
        itemName: poItem.itemName,
        size: poItem.size,
        maker: poItem.maker,
        unit: poItem.unit,
        qty: poItem.qty,
        unitPrice: poItem.unitPrice,
        invoicedQty: poItem.invoicedQty,
    };
}

const inputClass =
    "rounded border border-zinc-300 px-2 py-1 disabled:opacity-50";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50";

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
// an `Invoice Items` row is chosen from those — so an invoice item with no ordered
// item behind it is not a state this app has, and the twenty-two branches that
// described one went with the flag.
//
// REMOVING THE FLAG WAS NOT THE WHOLE OF CLOSING IT, WHICH IS WHY THIS NOTE IS
// HERE RATHER THAN IN THE PULL REQUEST. The flag gated one `<option>`; a second
// path reached the same state with the flag untouched — a row whose order #91 had
// left nothing to claim — and #278 closed it with a sentence on the row and a
// refusal in `createInvoiceAction`. #660 took the path itself away: an item
// chooses from every order's choices and no row's choice is taken out of
// another's list, so the list cannot run out. The refusal stays, for an item
// with no choice at all.

/**
 * One file as a `FileList`, the only shape a file input's `files` accepts.
 *
 * A NEW LIST FOR EVERY HAND-OFF, BECAUSE THE CONTROL KEEPS THE ONE IT IS GIVEN.
 * Measured in Chromium: after `input.files = list`, the input's `files` is that same
 * object, and emptying the control empties it in place — the `DataTransfer` it came
 * from reads zero files too. So the form holds the `File` and never a list; a list
 * handed to a control once would be empty the next time it was needed.
 */
function fileListOf(file) {
    const list = new DataTransfer();
    list.items.add(file);
    return list.files;
}

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
    //
    // Issue #422 — `previewUrl` and `contentType` ride ON this object rather than
    // beside it, so the pane and the lines under the file input cannot come to
    // describe two different files. Every path that replaces this state carries both
    // forward or drops both: an upload that fails keeps the pane, because the file is
    // fine and the retry is to pick it again, and a file refused for its size leaves
    // no pane, because the form is then holding nothing it could attach.
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
    // Items are a frozen snapshot taken at PO-generation time (the PO Items
    // entry in docs/notes/data-model.md — no edit path exists anywhere in
    // this codebase), so a PO that's removed and re-added mid-session can
    // safely reuse what's already cached instead of re-fetching. The status
    // field exists purely so a failed request doesn't get mistaken for "this
    // PO genuinely has zero items" — an "error" entry is retried the next
    // time that PO is assigned to a slot again.
    const [poItemsCache, setPoItemsCache] = useState({});
    // Issue #57 — Shipping Fee/Invoice Total were plain uncontrolled inputs
    // (read only via FormData at submit) until now; they need to be
    // controlled state so the calculated-total preview can react to them
    // live. #623 named the field, the form field, this state and its label
    // `Invoice Total` alike: the ground-truth figure from the vendor's own
    // document. It was `amountDue` here, `vendorStatedTotal` in this state and
    // `Vendor's Stated Total` on the label until then.
    const [invoiceTotal, setInvoiceTotal] = useState("");
    // Issue #187 — what the user TYPED, which is not what the field shows.
    // The displayed `shippingFee` is derived below from this and the flag
    // underneath it, and this half is read only once that flag is true —
    // so a changed prefill never has to overwrite a real edit.
    const [shippingFeeEdit, setShippingFeeEdit] = useState("");
    // Issue #91 — whether the user has directly edited Shipping Fee since
    // the last time it was (re)defaulted. Same idiom as items' own
    // choiceTouched: distinguishes "still showing an auto-prefill" from
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
    // mutation (the initial row, and the one row a PO swap resets to; since
    // #660 a default choice is derived on render and never written, so loading
    // an order's items mutates nothing) — never updated by a user-driven one
    // (addItem, removeItem, updateItem, updateChoice,
    // handleCancelUnitPriceEdit). Comparing current
    // `items` against this is the single source of truth for "has the
    // user actually changed anything", regardless of whether the compare
    // happens mid-load, right after load, or long after real edits —
    // replacing the old itemName/qty/unitPrice truthiness check, which
    // couldn't tell an auto-filled value from a typed one.
    const autoInsertedItemsRef = useRef(JSON.stringify([{ ...EMPTY_ITEM }]));
    // Issue #422 — the object URL the pane is currently drawing, held for its own
    // revocation. A ref rather than the state above, because the two things that
    // release it cannot read that state: the catch below runs before its own setState
    // has landed, and the unmount effect closes over the first render's copy.
    const previewUrlRef = useRef(null);
    // Issue #422 — the file control itself, so the box can open it. One input, so
    // there is one place a picked file arrives from whichever control was used.
    const fileInputRef = useRef(null);
    // The same control where the `Invoice File` section draws it, below the
    // breakpoint. Held only so `showHeldFile` can reach it.
    const sectionFileInputRef = useRef(null);
    // The file the form holds. Set where a file is accepted and read only by
    // `showHeldFile`, so a control that was bypassed or emptied is given back the file
    // the rest of the form describes.
    const heldFileRef = useRef(null);
    // Whether a dragged file is over the box. The box's only state.
    const [draggingFile, setDraggingFile] = useState(false);

    // Issue #422 — one object URL at a time, and none after this form is gone. Every
    // replacement revokes in handleInvoiceFileChange, so what is left for unmount is
    // the last one; the effect takes no dependencies deliberately, since a preview
    // that survives to the end of the form is exactly what it is for.
    useEffect(() => {
        return () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

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

    /**
     * Issue #422 — three ways in, one rule.
     *
     * The file control below, the box in the pane and a file dropped on that box all
     * end here, because what has to happen to a picked file — the size guard, the
     * preview, the upload, the detection — is one sequence and was one before there
     * was more than one way to start it.
     */
    async function handleInvoiceFileChange(e) {
        const file = e.target.files?.[0];
        // A dialog dismissed without a choice. Chromium empties the control and fires
        // `change` for it, and nothing about the form changed — the pane, the upload
        // and the line under the heading all still describe the file — so that file
        // goes back onto the control that has just stopped naming it.
        if (!file) {
            showHeldFile();
            return;
        }
        await acceptFile(file);
    }

    function handleFileDrop(e) {
        e.preventDefault();
        setDraggingFile(false);
        acceptFile(e.dataTransfer?.files?.[0]);
    }

    /**
     * Issue #422 — both file controls name the file the form holds, whatever last
     * touched either of them.
     *
     * THREE THINGS LEFT A CONTROL NAMING SOMETHING ELSE BESIDE AN ATTACHED FILE, AND
     * THIS IS THE ONE ANSWER TO ALL OF THEM. A drop never passes through a control. A
     * dialog canceled in Chromium empties the control it opened from, and the change
     * that fires carries no file. And a pick goes through one control only, so the
     * one the other width hides keeps naming an older file, or none — measured: after
     * a pick below the breakpoint and a drop above it, the hidden control still named
     * the first file. In each case the form's own state is right and a control is
     * wrong, so what is corrected is the controls.
     *
     * ASSIGNING `files` FIRES NOTHING, and that is what makes this safe to call from
     * inside a change handler: measured, neither `change` nor `input` was dispatched,
     * so the file is not uploaded again and detection does not run again. Neither
     * input carries a `name`, so nothing is submitted from them either.
     */
    function showHeldFile() {
        if (!heldFileRef.current) return;
        for (const input of [fileInputRef.current, sectionFileInputRef.current]) {
            if (input) input.files = fileListOf(heldFileRef.current);
        }
    }

    async function acceptFile(file) {
        if (!file) return;

        // Held before anything else, a refused file included: a file picked through
        // a control stays named on it when it is refused, so a dropped one and one on
        // the other control are named the same way.
        heldFileRef.current = file;
        showHeldFile();

        // Issue #422 — the file this one replaces is not on the screen any more, so
        // its address is released here rather than waiting for the document to go.
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setInvoiceFile({ status: "uploading", filename: file.name });
        setPoDetection(null);
        try {
            refuseOversizeUpload(file);
            // Issue #422 — AFTER the guard and before the upload. After, because a
            // file refused for its size is not going to be attached and must not be
            // drawn; before, because the pane is what the reader types from and
            // waiting for the round trip would withhold it for the second the upload
            // takes. Both setState calls are in one synchronous tick, so the state
            // set above never reaches a render without this.
            const previewUrl = URL.createObjectURL(file);
            previewUrlRef.current = previewUrl;
            const preview = { previewUrl, contentType: file.type };
            setInvoiceFile({ status: "uploading", filename: file.name, ...preview });
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/invoices/upload",
            });
            setInvoiceFile({ status: "done", url: blob.url, filename: file.name, ...preview });
            await detectAndApplyPOs(blob.url);
        } catch (err) {
            // The pane survives a failed upload and not a refused file, which is the
            // same split `previewUrlRef` already holds: it is null when the guard
            // threw and set when the network did.
            setInvoiceFile({
                status: "error",
                filename: file.name,
                error: err.message,
                previewUrl: previewUrlRef.current,
                contentType: file.type,
            });
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
            // correction or a late add-on) — so it only ever changes
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
                        .join(", ")}${fullyInvoicedNote}${unconfirmedNote} — not auto-applied since a PO or items are already entered. Select manually below if needed.${withdrawnNote}`,
                });
                return;
            }

            const newSlots = confirmed.map((c) => ({ ...EMPTY_SLOT, poRecordId: c.recordId }));
            setPoSlots(newSlots);
            newSlots.forEach((s) => ensurePoItemsLoaded(s.poRecordId));

            // #660 — NO ITEM IS SET HERE: an item shows its default choice once the orders'
            // items load, derived on render, so the pristine items above stay as they are.
            if (newSlots.length === 1) {
                setPoDetection({
                    level: detectionLevel,
                    message: `Detected PO: ${confirmed[0].poId} (auto-filled below)${fullyInvoicedNote}${unconfirmedNote}.${withdrawnNote}${unsignedNote}`,
                });
            } else {
                // Multi-PO case. It scaffolded one item row per detected PO until #660, each
                // on its own order; an item is the vendor's now and is spread over every
                // order, so the one pristine row stands and the vendor's items are entered
                // as written.
                setPoDetection({
                    level: detectionLevel,
                    message: `Detected ${confirmed.length} POs: ${confirmed
                        .map((c) => c.poId)
                        .join(", ")} — auto-filled below, verify each item.${fullyInvoicedNote}${unconfirmedNote}${withdrawnNote}${unsignedNote}`,
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
    // (HYE-PO-YYMMDD-##) is fixed-width and zero-padded throughout, so a
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
    // Every PO currently occupying a header slot — the orders every item is
    // spread over (#660; each item picked one of them until then), and what
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

    // #660 — THE CHOICES, THE ITEMS AS SHOWN, AND THEIR SPREAD, all derived on render. The
    // choices are the selected orders' ordered items grouped by material and ordered price;
    // an untouched item shows the default `applyDefaultsAcrossItems` gives it; and the spread
    // is `createInvoiceAction`'s own function over what was fetched, read here for one thing:
    // an item whose quantity runs past what its orders have uninvoiced. What is submitted is
    // `shownItems`, so a default is what saves.
    const orderedItemsForSpread = useMemo(
        () =>
            itemsReady
                ? selectedPoIds.flatMap((id) =>
                      (poItemsCache[id]?.items || []).map((p) =>
                          orderedItemForSpread(p, posList.find((po) => po.id === id))
                      )
                  )
                : [],
        [itemsReady, selectedPoIds, poItemsCache, posList]
    );
    const choices = useMemo(() => spreadChoices(orderedItemsForSpread), [orderedItemsForSpread]);
    const shownItems = useMemo(() => applyDefaultsAcrossItems(items, choices), [items, choices]);
    const spread = useMemo(
        () =>
            spreadInvoiceItems({
                entries: shownItems.map((it) => ({ key: it.key, qty: parseFloat(it.qty) || 0 })),
                orderedItems: orderedItemsForSpread,
            }),
        [shownItems, orderedItemsForSpread]
    );

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
            // #660 — stored as fetched: `spreadChoices` orders the choices across every order,
            // and an item's default is derived on render, so nothing here sets an item.
            setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "done", items: rawItems } }));
        } catch (err) {
            console.error("Failed to load PO Items for", poRecordId, err);
            setPoItemsCache((prev) => ({ ...prev, [poRecordId]: { status: "error", items: [] } }));
            poItemsFetchStartedRef.current.delete(poRecordId);
        }
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
        const nextItems = [{ ...EMPTY_ITEM }];
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
            // #660 — the items take their choices from every order on render, so a
            // first pick sets nothing on them.
            if (newValue) ensurePoItemsLoaded(newValue);
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

    // Issue #57 — a new row shows the first choice no other row shows, derived on render
    // (`applyDefaultsAcrossItems`), so it is added blank.
    function addItem() {
        setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    }

    function removeItem(index) {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }

    // #660 — AN EDIT KEEPS THE ITEM AS IT WAS SHOWN. An untouched item's choice is derived on
    // render, so the row a reader typed into stores that choice with the typed value; a
    // later order joining the header cannot then move a quantity onto another material.
    function updateItem(index, field, value) {
        setItems((prev) => prev.map((item, i) => (i === index ? { ...(shownItems[i] ?? item), [field]: value } : item)));
    }

    // Issue #51 — the single sync point for an item's choice. Choosing copies its name, its
    // Size/Maker/Unit (#84) and its ordered Unit Price, freshly re-locked (#57); since #660 the
    // choice is a material at an ordered price across every order, not one order's item.
    // `choiceTouched` keeps a deliberate pick from the defaults.
    function updateChoice(index, key) {
        const choice = choices.find((c) => c.key === key);
        if (!choice) return;
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...withChoice(shownItems[i] ?? item, choice), choiceTouched: true } : item))
        );
    }

    // Issue #57 — reverts the Unit Price lock back to the choice's ordered Unit Price
    // (re-derived from the choices rather than stored separately — the choice never
    // changed while editing, just the typed value) and clears whatever Remark was written
    // for the edit, re-locking the field.
    function handleCancelUnitPriceEdit(index) {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item;
                const shown = shownItems[i] ?? item;
                const choice = choices.find((c) => c.key === shown.key);
                return {
                    ...shown,
                    unitPrice: choice && choice.unitPrice != null ? String(choice.unitPrice) : shown.unitPrice,
                    unitPriceEditing: false,
                    remark: "",
                };
            })
        );
    }

    const itemsTotal = shownItems.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        return sum + qty * unitPrice;
    }, 0);

    // Issue #57 — sanity-check preview only, never what's stored (Invoice
    // Total is). Tariff only counts once the optional
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
    // items are linked. The two cannot always see the same number, so passing
    // this form's own two figures to the shared predicate is the whole of what
    // one rule can mean here — `calculatedTotal` above is the same binding the
    // label renders, so the warning and the preview cannot come apart.
    // #623 — the comparison is made only once a figure is typed, and then it has one
    // of two answers: Totals differ, or Totals agree.
    const totalsCompared = invoiceTotal !== "" && !Number.isNaN(parseFloat(invoiceTotal));
    const totalsMismatch = totalsCompared && checkTotalsDiffer(parseFloat(invoiceTotal), calculatedTotal);
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
                    section above (see the block-order comment near the
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

    /**
     * Issue #422 — the control itself, drawn wherever the layout puts it.
     *
     * TWO CALL SITES AND ONE CONTROL. Below the breakpoint it is in the `Invoice
     * File` section, where it has always been; above it, it is under the box in the
     * pane, because that is where the file is. Only one of the two is ever visible —
     * each sits inside something the other width hides — and both hand the same
     * function the same thing. **They are still two inputs holding two selections**,
     * which is why `showHeldFile` puts every accepted file on both: the hidden one is
     * the one a reader sees the moment the window crosses the breakpoint.
     */
    function renderFileInput(ref) {
        return (
            <input
                ref={ref}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={handleInvoiceFileChange}
                className="block text-sm"
            />
        );
    }

    /**
     * Issue #422 — WHAT THIS SECTION KEEPS AT A WIDE VIEWPORT IS WHAT IT SAYS, NOT
     * WHAT IT DOES. The control moved into the pane, where the file is; the heading,
     * the line saying why a file is required, the upload's own state and the
     * detection message stay here in the text column. That is not only a placement:
     * the detection message runs to three lines and changes length, and under the box
     * it would resize the box every time a file was attached — which is the one thing
     * the reserved box is for.
     */
    function renderFileSection() {
        return (
            <div>
                <h2 className="text-lg font-semibold">Invoice File</h2>
                <p className="text-sm text-zinc-600">
                    The vendor&apos;s original invoice document — required, every received invoice is kept on file.
                </p>
                <div className="mt-2 space-y-2">
                    <div className="xl:hidden">{renderFileInput(sectionFileInputRef)}</div>
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

    /**
     * Issue #422 — the vendor's document, beside the form that transcribes it.
     *
     * IT IS NOT DRAWN FROM THE UPLOADED COPY. The file is at a Blob URL by the time
     * this renders, and the pane still draws the reader's own bytes: an object URL
     * costs no request at all, it is ready before the upload finishes, and it is
     * gone with the document rather than being an address that exists. `/api/files`
     * is not an option either way — it re-reads a record per request and there is no
     * invoice record until this form is submitted.
     *
     * TO THE LEFT OF THE FORM, AND LAST IN THE DOCUMENT. `filePane.js` carries why
     * those two are not the same order.
     *
     * THE COLUMN IS DRAWN BEFORE THERE IS A FILE, AND THAT IS WHAT MAKES IT THE
     * CONTROL. An empty box stands in the document's exact place and takes the file:
     * dropped on it, or picked through the dialog it opens when clicked. So the
     * reader is not told where the document will go, they are shown, and the page
     * does not rearrange itself at the moment of attaching.
     *
     * A FILE THAT CANNOT BE DRAWN LEAVES THE BOX AS IT WAS. `notViewable` is the
     * viewer's answer for a type it will not draw, and the viewer was opened on
     * purpose so it may not open empty. Here the box is a control before it is a
     * picture: leaving it standing keeps the way to pick another file where it was,
     * and the section opposite already says which file is attached.
     *
     * A FILE DROPPED ON THE DRAWN DOCUMENT REPLACES IT (#433). It did not while a
     * frame drew it — a frame is another document, and a drop on it went to the
     * browser's own viewer — and the page this app draws now is part of this one, so
     * the drop reaches the column's handler like a drop anywhere else in it. The
     * dashed highlight is still the empty box's alone: over a drawn file there is no
     * box to light up. The file control stays under the column in every state, which
     * is what keeps the column one size and the one way to replace a file from the
     * keyboard.
     */
    function renderFilePane() {
        const kind = fileRenderKind(invoiceFile.contentType);
        const drawable = invoiceFile.previewUrl && kind !== FILE_RENDER.unknown;
        return (
            <aside
                className={FILE_PANE}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!drawable) setDraggingFile(true);
                }}
                onDragLeave={() => setDraggingFile(false)}
                onDrop={handleFileDrop}
            >
                {/* A drawn file brings its toolbar into the slot's last row; the box
                    leaves that row empty, so both are drawn at one size. */}
                <div className={drawable ? FILE_SLOT : `${FILE_SLOT} ${FILE_SLOT_TOOLBAR_ROOM}`}>
                    {drawable ? (
                        <PaneFile
                            key={invoiceFile.previewUrl}
                            href={invoiceFile.previewUrl}
                            kind={kind}
                            title={fileViewerTitle({ axis: FILE_AXIS.invoice, filename: invoiceFile.filename })}
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={draggingFile ? FILE_DROP_BOX_OVER : FILE_DROP_BOX}
                        >
                            {FILE_PANE_COPY.drop}
                        </button>
                    )}
                </div>
                <div className="mt-2 shrink-0">{renderFileInput(fileInputRef)}</div>
            </aside>
        );
    }

    function renderItemsSection() {
        // Issue #99 — locked (visible but faded/disabled, not hidden — so
        // the shape of the invoice is visible right away) until a PO is
        // chosen and its items have finished loading.
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
                    {shownItems.map((item, i) => {
                        const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                        // #660 — the one thing this screen says about the spread: an item whose
                        // quantity runs past what its orders have uninvoiced, under the item, in
                        // place of #57's warning and the Remark box it asked for. The spread is
                        // `createInvoiceAction`'s own function, so the item saved is the item
                        // described.
                        const over = !locked && item.key ? spread[i] : null;
                        const unitPriceLocked = !!item.key && !item.unitPriceEditing;
                        return (
                            <div key={i} className="rounded border border-zinc-300 p-3">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {/* #660 — ONE LIST OF CHOICES ACROSS EVERY ORDER, AND NO ORDER PER
                                        ITEM. A material ordered on two orders at one price is one
                                        choice and the save spreads it over both; one ordered at two
                                        prices is two, each naming its orders and its price, which is
                                        the one case the office enters an item per order. Nothing is
                                        taken out of a row's list because another row chose it: a
                                        vendor can write one material twice. That is why #278's
                                        `noOrderedItemLeft` sentence went — a list that never shrinks
                                        cannot run out — and why #91's per-row exclusion did. Until a
                                        PO's items load the row keeps #99's shape with a disabled
                                        select naming what is missing (#272). */}
                                    {!locked ? (
                                        <div className="space-y-1">
                                            <select
                                                value={item.key}
                                                onChange={(e) => updateChoice(i, e.target.value)}
                                                className={inputClass + " w-full"}
                                            >
                                                {!item.key && (
                                                    <option value="" disabled>
                                                        {INVOICE_SPREAD_COPY.placeholder}
                                                    </option>
                                                )}
                                                {choices.map((choice) => (
                                                    <option key={choice.key} value={choice.key}>
                                                        {INVOICE_SPREAD_COPY.choice(choice)}
                                                    </option>
                                                ))}
                                            </select>
                                            {/* Issue #84 — reference-only, frozen from the chosen ordered
                                                items; no input, no edit path. */}
                                            {item.key && (item.size || item.maker || item.unit) && (
                                                <p className="text-xs text-zinc-500">
                                                    Size: {item.size || "—"} · Maker: {item.maker || "—"} · Unit: {item.unit || "—"}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <select disabled value="" className={inputClass + " w-full"}>
                                            <option value="">Select a PO above</option>
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
                                        {item.key && item.unitPriceEditing && (
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
                                </div>
                                {over && over.over > 0 && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        {INVOICE_SPREAD_COPY.over({ over: over.over, left: over.left, unit: item.unit })}
                                    </p>
                                )}
                                {item.unitPriceEditing && (
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
                                    {shownItems.length > 1 && (
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
                        <label htmlFor="invoiceTotal" className="block text-sm font-medium">
                            Invoice Total
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="invoiceTotal"
                            name="invoiceTotal"
                            required
                            value={invoiceTotal}
                            onChange={(e) => setInvoiceTotal(e.target.value)}
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

                {/* Issue #57 — sanity check, not enforcement: Invoice Total
                    (Invoice Total) is still what gets stored and
                    submitted regardless of whether it agrees with this
                    preview. Catches a vendor's own arithmetic error or a
                    missed item — the calculation alone can't.

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
                    `Invoice Total` sits in the same row as the three terms
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
                {/* #254 — the sentence is `lib/variance.js`'s. Written here as
                    element text it was invisible to the vocabulary check, which
                    reads `*_COPY` strings and nothing else, and it belongs beside
                    the predicate that decides when it appears.

                    #623 — AND THE COMPARISON SAYS SO WHEN IT PASSES, as the design's
                    form draws it: `Totals agree` where the warning would stand, once
                    an Invoice Total is typed. Neutral, because nothing is asked of
                    the reader; a stored invoice whose totals agree carries no mark. */}
                {totalsMismatch ? (
                    <p className="mt-1 text-xs text-amber-700">
                        {VARIANCE_COPY.totalsBeforeSaving(
                            (parseFloat(invoiceTotal) || 0).toFixed(2),
                            calculatedTotal.toFixed(2)
                        )}
                    </p>
                ) : (
                    totalsCompared && (
                        <p className="mt-1 text-xs text-zinc-500">{VARIANCE_COPY.totalsAgree}</p>
                    )
                )}
            </div>
        );
    }

    // Issue #422 — two columns from the first paint, because the second one is the
    // file control and not a preview of one. `filePane.js` says what that changed.
    return (
        <>
        <div className={FORM_COLUMNS}>
        <form action={formAction} className={`mt-6 space-y-8 ${FORM_COLUMN}`}>
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            {/* Issue #327 — one order of blocks and no tabs. The file comes first,
                since nothing can be submitted without it and what it fills in is
                what the fields below would otherwise be typed into. */}
            {renderFileSection()}
            {renderHeaderFields()}
            {renderItemsSection()}
            {renderTotalsSection()}

            <input type="hidden" name="itemsJson" value={JSON.stringify(shownItems)} />
            {/* #660 — the header's orders, which the save spreads every item over. */}
            <input type="hidden" name="poRecordIdsJson" value={JSON.stringify(selectedPoIds)} />
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
        {renderFilePane()}
        </div>

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

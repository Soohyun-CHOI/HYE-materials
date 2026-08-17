// Which purchase orders one slot's PO dropdown may offer (#242).
//
// THE LIST THE DROPDOWN DRAWS FROM GROWS AND NEVER SHRANK. `InvoiceForm`'s `posList`
// starts as the vendor's open orders from the server and is merged into by two
// paths: #46's detection, and #57's search escape hatch. Turning the search off
// clears the slot's query, results and status and leaves the list as the search left
// it, so an invoice form on which somebody searched once went on offering every order
// the search returned — closed ones among them — in a control whose default set is the
// open orders for that vendor. #198 is what made that visible rather than what caused
// it: an unsigned marker on the results told the closed orders apart from the ones
// that belong there.
//
// SO A SEARCHED ORDER IS OFFERED WHILE A SLOT HOLDS IT, AND OTHERWISE NOT. The claim
// is narrow on purpose. `handleSlotChange` resets the slot to `EMPTY_SLOT` when a
// result is picked, which closes that slot's search and drops its results in the same
// write — so from the moment a searched order matters, the slot holds it, and there is
// no other state in which anything needs it. An earlier draft of this rule also kept
// whatever an OPEN search still listed; that would have re-created the defect one slot
// over, since a second slot's dropdown would then widen because somebody searched in
// the first.
//
// DERIVED AT RENDER, NOT PRUNED FROM THE STATE, and the difference is what makes the
// rule survive gestures nobody thought about. Pruning on the toggle would have to
// leave alone whatever another slot's open results still list, and would need the same
// hook again on slot removal and on a vendor change; each miss strands orders in the
// list forever. Deriving is idempotent, so no sequence of toggles can leave the state
// in a shape this rule disagrees with, and nothing is ever removed — which is what
// keeps a picked result renderable, the failure `posList` exists to prevent
// (`InvoiceForm.js`, its own comment).
//
// ORIGIN IS EXPLICIT BECAUSE THE TWO MERGES MUST BE TOLD APART. Detection merges an
// order and, in its non-pristine branch, leaves it unselected while telling the reader
// to pick it manually — so a rule that kept only what a slot holds would delete the
// affordance #46 built and #198 marked. The merges therefore tag what they add.
// Shape was the alternative — only search results carry `shippingFee` — and that is
// an accident of two projections rather than a statement about provenance.
//
// PURE AND IMPORT-FREE, so a client component may hold it and
// scripts/tests/offline/po-picker-options.mjs can pin it.

/**
 * Where an entry in the form's PO list came from. An entry with no origin is the
 * page's own server-side set, which is the baseline and always eligible.
 */
export const PO_ORIGIN = {
    /** #57's escape hatch. Offered only while a slot holds it. */
    search: "search",
    /** #46's detection. Offered whether or not a slot holds it. */
    detected: "detected",
};

/**
 * Re-tag as detected every searched entry this detection confirmed.
 *
 * WITHOUT THIS THE RULE HAS A HOLE. Searching for a closed order without picking it
 * and then uploading a file that quotes it leaves the entry tagged `search`, so the
 * banner would name an order the dropdown no longer offers — the affordance #46 built
 * and #198 marked, broken by the narrowing rather than by detection. Detection claims
 * an order whether or not the list already had one.
 *
 * RETURNS THE SAME ARRAY WHEN NOTHING CHANGED, so the caller can keep React's state
 * identity and skip the render — the shape its merge already relies on.
 */
export function claimDetected(posList, confirmedRecordIds) {
    const ids = new Set(confirmedRecordIds || []);
    let changed = false;

    const next = (posList || []).map((po) => {
        if (po?.origin === PO_ORIGIN.search && ids.has(po.id)) {
            changed = true;
            return { ...po, origin: PO_ORIGIN.detected };
        }
        return po;
    });

    return changed ? next : posList || [];
}

/**
 * The options for ONE slot's dropdown, in the order given.
 *
 * `posForVendor` is the list already narrowed to the selected vendor and sorted
 * (#91's ordering, which stays where it is — this decides membership, not order).
 * `slot` is that slot's own state and `selectedPoIds` every order any slot holds,
 * this one included.
 *
 * THE SLOT'S OWN ORDER IS ADMITTED FIRST AND THAT TEST CANNOT MOVE. `selectedPoIds`
 * contains this slot's own pick by construction, so without the first clause the
 * exclusion below would hide the very order the slot is displaying — and a `<select>`
 * whose value has no matching option renders some other option as selected while the
 * real value stays correct underneath, which is a misleading screen rather than a
 * cosmetic gap. It also carries the claim rule's whole other half: an order a slot
 * holds is never dropped for being searched.
 */
export function poOptionsForSlot({ posForVendor, slot, selectedPoIds } = {}) {
    const held = slot?.poRecordId || "";
    const taken = selectedPoIds || [];

    return (posForVendor || []).filter((po) => {
        if (!po) return false;
        // 1. This slot's own order, whatever its origin.
        if (po.id && po.id === held) return true;
        // 2. An order another slot holds is not a valid pick here.
        if (taken.includes(po.id)) return false;
        // 3. A searched order nothing holds has no claim to be here.
        if (po.origin === PO_ORIGIN.search) return false;
        return true;
    });
}

// What one slot's PO dropdown may offer (#242) — the claim rule, the exclusion, and
// detection's claim over a searched order.
//
// THIS FILE EXISTS BECAUSE THE DEFECT IS A STATE TRANSITION AND THE FIX IS A PURE
// FUNCTION. The offline tier renders nothing, so the sequence a person walks — search,
// pick nothing, close, look at the dropdown — is a browser finding and is in the pull
// request. What lives here is the rule that sequence exercises, including the two
// cases a screen on this base cannot show: a second slot's open search, and detection
// confirming an order the search had already surfaced.
//
// THE FIRST MUTANT IS THE QUIET ONE, in the sense #237 named for its `always agree`:
// take the narrowing away and the form returns to the behavior this issue is about —
// every searched order still offered — and NOTHING else complains. The screen looks
// ordinary, no other check reads this list, and the dropdown simply carries orders
// that do not belong to it. So the assertion that catches it is stated first and by
// name.

import { PO_ORIGIN, claimDetected, poOptionsForSlot } from "../../../lib/poPickerOptions.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What a slot's PO dropdown may offer (#242)";

/** The page's own set: three open orders for this vendor, no origin. */
const OPEN_A = { id: "recOpenA", poId: "HYE-PO-20260817-11" };
const OPEN_B = { id: "recOpenB", poId: "HYE-PO-20260817-10" };
const OPEN_C = { id: "recOpenC", poId: "HYE-PO-20260817-09" };
/** Merged by #57's search. */
const SEARCHED = { id: "recSearched", poId: "HYE-PO-20260722-02", origin: PO_ORIGIN.search };
const SEARCHED_2 = { id: "recSearched2", poId: "HYE-PO-20260716-08", origin: PO_ORIGIN.search };
/** Merged by #46's detection. */
const DETECTED = { id: "recDetected", poId: "HYE-PO-20260804-12", origin: PO_ORIGIN.detected };

const LIST = [OPEN_A, OPEN_B, OPEN_C, SEARCHED, SEARCHED_2, DETECTED];
const slot = (poRecordId = "", extra = {}) => ({ poRecordId, searchMode: false, results: [], ...extra });
const ids = (list) => list.map((po) => po.id);

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("the quiet mutant — take the narrowing away and nothing else notices:");
    const noNarrowing = ({ posForVendor, slot: s, selectedPoIds }) =>
        (posForVendor || []).filter((po) => po.id === s.poRecordId || !(selectedPoIds || []).includes(po.id));
    const real = poOptionsForSlot({ posForVendor: LIST, slot: slot(), selectedPoIds: [] });
    const mutant = noNarrowing({ posForVendor: LIST, slot: slot(), selectedPoIds: [] });
    check("a searched order nothing holds is not offered", ids(real).includes(SEARCHED.id), false);
    check("  and the mutant offers it — the behavior #242 is about", ids(mutant).includes(SEARCHED.id), true);
    assert("  so the two disagree, which is what makes this file the guard", mutant.length !== real.length);

    // -----------------------------------------------------------------------
    log("anti-vacuity — the rule keeps and drops, and reads its input:");
    check("nothing in, nothing out", poOptionsForSlot({}).length, 0);
    check("the page's own orders are all offered", ids(real).join(","), "recOpenA,recOpenB,recOpenC,recDetected");
    check("  which is four of six, so it is not a pass-through", real.length, 4);
    assert("  and the order given is the order returned", ids(real)[0] === OPEN_A.id && ids(real)[3] === DETECTED.id);

    // -----------------------------------------------------------------------
    log("the slot's own order is offered — the clause that cannot move:");
    // `selectedPoIds` contains this slot's own pick, so without the first clause the
    // exclusion would hide the order the slot is displaying.
    const holdingOpen = poOptionsForSlot({
        posForVendor: LIST,
        slot: slot(OPEN_B.id),
        selectedPoIds: [OPEN_B.id],
    });
    check("an order this slot holds stays offered", ids(holdingOpen).includes(OPEN_B.id), true);
    const noSelfAllowance = ({ posForVendor, slot: s, selectedPoIds }) =>
        (posForVendor || []).filter(
            (po) => !(selectedPoIds || []).includes(po.id) && po.origin !== PO_ORIGIN.search
        );
    assert(
        "  and a mutant without that clause loses it, leaving a select whose value has no option",
        !ids(noSelfAllowance({ posForVendor: LIST, slot: slot(OPEN_B.id), selectedPoIds: [OPEN_B.id] })).includes(OPEN_B.id)
    );
    // The same clause carries the claim rule's other half.
    const holdingSearched = poOptionsForSlot({
        posForVendor: LIST,
        slot: slot(SEARCHED.id),
        selectedPoIds: [SEARCHED.id],
    });
    check("a SEARCHED order this slot holds stays offered", ids(holdingSearched).includes(SEARCHED.id), true);
    check("  while the other searched one still does not", ids(holdingSearched).includes(SEARCHED_2.id), false);

    // -----------------------------------------------------------------------
    log("an order another slot holds is not a valid pick here:");
    const twoSlots = poOptionsForSlot({
        posForVendor: LIST,
        slot: slot(OPEN_A.id),
        selectedPoIds: [OPEN_A.id, OPEN_C.id],
    });
    check("this slot's own is offered", ids(twoSlots).includes(OPEN_A.id), true);
    check("  and the other slot's is not", ids(twoSlots).includes(OPEN_C.id), false);
    check("  and a third open order still is", ids(twoSlots).includes(OPEN_B.id), true);

    // -----------------------------------------------------------------------
    log("detection's orders are offered unselected — #198's affordance:");
    check("a detected order nothing holds is offered", ids(real).includes(DETECTED.id), true);
    const narrowEverything = ({ posForVendor, slot: s, selectedPoIds }) =>
        (posForVendor || []).filter((po) => po.id === s.poRecordId || !(selectedPoIds || []).includes(po.id))
            .filter((po) => po.id === s.poRecordId || !po.origin);
    assert(
        "  and a mutant that narrows by any origin drops it, which would undo #46's manual-pick banner",
        !ids(narrowEverything({ posForVendor: LIST, slot: slot(), selectedPoIds: [] })).includes(DETECTED.id)
    );

    // -----------------------------------------------------------------------
    log("two slots, one search — the case that chose deriving over pruning:");
    // Slot A closed its search; slot B still has the order in open results. Nothing
    // holds it, so A does not offer it — the defect would otherwise reappear one slot
    // over. The record is still THERE, which is what lets B pick it.
    const slotA = slot("", { searchMode: false });
    const slotB = slot("", { searchMode: true, results: [SEARCHED] });
    check(
        "slot A does not offer what only slot B's open results list",
        ids(poOptionsForSlot({ posForVendor: LIST, slot: slotA, selectedPoIds: [] })).includes(SEARCHED.id),
        false
    );
    assert("  and slot B renders its results rather than its dropdown", slotB.searchMode === true);
    // The pick resets that slot to EMPTY_SLOT with the id set (handleSlotChange), so
    // the search closes and the results go in the same write — from that moment the
    // slot holds it and the first clause offers it.
    check(
        "once slot B holds it, slot B offers it",
        ids(poOptionsForSlot({ posForVendor: LIST, slot: slot(SEARCHED.id), selectedPoIds: [SEARCHED.id] })).includes(SEARCHED.id),
        true
    );
    // And the alternative design — pruning the record out of the list when a search
    // closes — fails exactly here, which is why nothing is removed.
    const prunedList = LIST.filter((po) => po.origin !== PO_ORIGIN.search);
    check(
        "  whereas a list pruned of searched orders cannot offer it at all",
        ids(poOptionsForSlot({ posForVendor: prunedList, slot: slot(SEARCHED.id), selectedPoIds: [SEARCHED.id] })).includes(SEARCHED.id),
        false
    );

    // -----------------------------------------------------------------------
    log("detection claims a searched order the list already held:");
    const claimed = claimDetected(LIST, [SEARCHED.id]);
    check("the entry is re-tagged", claimed.find((po) => po.id === SEARCHED.id).origin, PO_ORIGIN.detected);
    check("  and is then offered unselected", ids(poOptionsForSlot({ posForVendor: claimed, slot: slot(), selectedPoIds: [] })).includes(SEARCHED.id), true);
    check("  while the untouched searched one is not", ids(poOptionsForSlot({ posForVendor: claimed, slot: slot(), selectedPoIds: [] })).includes(SEARCHED_2.id), false);
    check("nothing else moved", claimed.length, LIST.length);
    check("  and the page's own entries keep having no origin", claimed[0].origin, undefined);
    assert("the same array comes back when nothing changed, so React can skip the render", claimDetected(LIST, ["recNoSuchPO"]) === LIST);
    assert("  and a fresh array when something did", claimDetected(LIST, [SEARCHED.id]) !== LIST);
    check("a detected order already tagged as such is left alone", claimDetected(LIST, [DETECTED.id]) === LIST, true);
    check("no list at all is handled", claimDetected(null, ["recAnything"]).length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

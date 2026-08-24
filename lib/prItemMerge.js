// Two identical item rows are one PR Item (#170).
//
// A PR SHOULD NOT CARRY THE SAME ITEM TWICE. Rows agreeing on name, size, unit,
// unit price, remark and quotation are one item with a combined quantity, and the
// form merges them ON SAVE rather than letting the PO snapshot copy both. What is
// downstream of one duplicated row is a duplicated `PO Items` row, and #18's
// `Material` link — keyed on name, size and unit — then points two of them at one
// material, which is the state a delivery has to be attributed against.
//
// MERGING IS NOT FOLDING, and the three modules that fold are not reusable here.
// `lib/invoiceItemFold.js` (#241), `lib/invoiceDeliveryEntries.js` (#241) and
// `groupRowsByItemAndOrder` (#238) all leave the records alone and regroup them for
// one screen, because the split they read is REAL: an overage split and an
// over-delivery boundary are per-row judgments the data has to keep. Here there is
// no judgment on the row and nothing to preserve — two identical rows are one item
// typed twice, so the write is where it gets fixed and no screen has to fold
// anything afterwards.
//
// THE KEY IS SIX FIELDS AND ITS NORMALIZATION IS #18's, NOT ITS OWN:
//
//   - `Item Name` and `Size` compare through `normalizeItemText` AND lower case.
//     The stored value keeps its case (#18: the string is printed on the PO PDF and
//     `SCH 40 PVC` is correct as written), but `getMaterialByKey` looks a material
//     up with `LOWER(TRIM(...))` and `upsertMaterial` locks on the lower-cased
//     triple — so `Pipe` and `pipe` ARE one material. Leaving them as two rows
//     would produce exactly the two-ordered-items-one-material state this issue
//     exists to remove, which is why the comparison follows the lookup rather than
//     the storage.
//   - `Unit` is a canonical single select, so variance cannot occur; it is trimmed
//     and lower-cased anyway to keep the three text fields under one rule.
//   - `Unit Price` compares as a NUMBER: `10` and `10.00` are one price. A blank or
//     unparseable price is one value rather than `NaN`, which never equals itself —
//     a Draft save runs no per-item validation, so two price-less rows are
//     reachable and must merge.
//   - `Remark` is trimmed and its internal whitespace collapsed, and its CASE IS
//     KEPT SIGNIFICANT. Nothing forces otherwise here, and a remark is prose the
//     vendor reads: merging `URGENT` into `urgent` would silently drop one human's
//     words. The asymmetry with the name is deliberate — the name's insensitivity
//     is forced by the Material lookup, and no such force applies to a note.
//   - `Quotation` is part of what makes two rows the same row, since a merge across
//     two quotations would drop one of the links #67 put there. Same grade of fact
//     as the unit price: one material quoted twice is two quotes, and which one a
//     row cites is what a person needs when checking the PR against the vendor's
//     paper.
//
// THE SURVIVING ROW IS THE FIRST ONE, and it keeps its own text. A later row
// differing only in case contributes its quantity and nothing else, so the spelling
// the requester typed first is what reaches the vendor.
//
// AN EMPTY ROW IS NOT MERGED INTO ANYTHING. `isEmptyItemRow` already drops those at
// write time, and there is no `Material` link on a `PR Item` to fall back on the way
// #241's fold does — every field of a PR row is typed text. So a row with nothing in
// it takes no part: it is passed through untouched and left for the write to skip.
//
// Pure and dependency-free except for #18's own normalizer, which is what lets both
// the Server Action and the form (a Client Component) read one rule —
// `scripts/tests/offline/pr-item-merge.mjs` pins it.

import { normalizeItemText } from "./itemNaming.js";

/**
 * A row the Requester never touched, which is not persisted as an item.
 *
 * MOVED HERE FROM `app/prs/new/actions.js` BY #170 rather than restated: the merge
 * needs the same test, the action still needs it at write time, and two copies of
 * "is this row empty" would be free to disagree — the first draft of this module had
 * one that forgot `unit`. Unchanged in behavior; a row with only a Unit picked is
 * still not empty, since picking one is touching the row.
 */
export function isEmptyItemRow(item) {
    return !(
        (item?.itemName && String(item.itemName).trim()) ||
        (item?.size && String(item.size).trim()) ||
        item?.unit ||
        (item?.qty !== "" && item?.qty != null) ||
        (item?.unitPrice !== "" && item?.unitPrice != null) ||
        (item?.remark && String(item.remark).trim())
    );
}

/**
 * The merge key for one row. Exported so a check can pin it directly rather than
 * inferring it from what did or did not merge.
 *
 * Returns null for a blank row, which is what takes it out of the merge.
 */
export function mergeKey(row) {
    if (!row || isEmptyItemRow(row)) return null;

    const name = normalizeItemText(row.itemName).toLowerCase();
    const size = normalizeItemText(row.size).toLowerCase();
    const unit = String(row.unit ?? "").trim().toLowerCase();
    const price = Number.parseFloat(row.unitPrice);
    // A missing price is a value, not a mismatch — see the header.
    const priceKey = Number.isFinite(price) ? String(price) : "";
    // Case is significant here and only here.
    const remark = normalizeItemText(row.remark);
    const quotation = row.quotationIndex ?? "";

    return [name, size, unit, priceKey, remark, quotation].join("::");
}

/**
 * Merge the rows that agree on everything, summing their quantities.
 *
 * Returns a new array in FIRST APPEARANCE order — the order the requester listed
 * them, so a merge never moves a row somebody was looking at. Blank rows are
 * preserved in place and never merged.
 *
 * `qty` sums as a NUMBER when both sides parse; a row whose quantity is blank or
 * unparseable contributes nothing to the sum, and a group whose quantities all fail
 * to parse keeps the first row's raw value rather than inventing a 0. That matters
 * on a Draft, which is saved without per-item validation.
 */
export function mergeIdenticalItems(rows) {
    const out = [];
    const indexByKey = new Map();

    for (const row of rows || []) {
        const key = mergeKey(row);
        if (key === null) {
            out.push(row);
            continue;
        }

        const at = indexByKey.get(key);
        if (at === undefined) {
            indexByKey.set(key, out.length);
            out.push({ ...row });
            continue;
        }

        const kept = out[at];
        const a = Number.parseFloat(kept.qty);
        const b = Number.parseFloat(row.qty);
        if (Number.isFinite(a) || Number.isFinite(b)) {
            kept.qty = (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
        }
    }

    return out;
}

/**
 * What the merge would do to these rows, for a form that has to say so before the
 * save rather than after it.
 *
 * `merging` counts the rows that will disappear into an earlier one, so 0 means
 * nothing will change and the form stays silent.
 */
export function describeMerge(rows) {
    const list = rows || [];
    const merged = mergeIdenticalItems(list);
    return { rows: list.length, merged: merged.length, merging: list.length - merged.length };
}

// ---------------------------------------------------------------------------
// Copy
//
// In a `*_COPY` constant rather than written into the form's JSX, so
// `offline/line-vocabulary.mjs` can read it — that check walks copy constants and
// cannot see text inside a component.

export const PR_ITEM_MERGE_COPY = {
    /**
     * SAID BEFORE THE SAVE, NOT AFTER IT, and that is forced rather than chosen:
     * `saveDraftAction` returns a confirmation and the form does not re-hydrate its
     * item rows from the saved records (only re-opening a Draft does), so a merge
     * announced afterwards would describe rows the person is still looking at
     * unmerged. Stated as what WILL happen, in the plainest count available.
     *
     * IT NAMES NO ROW NUMBERS. The rows that merge are adjacent in meaning rather
     * than on screen, and numbering them would go stale the moment somebody deletes
     * a row above — the form has no row numbers of its own anyway.
     *
     * THE COUNT IS THE ROWS THAT DISAPPEAR, which is the one figure that stays true
     * however the duplicates are grouped. `n + 1 items are identical` was written
     * first and is false for two separate pairs, where three rows do not agree with
     * each other.
     */
    willMerge: (n) => ({
        key: "will-merge",
        text:
            n === 1
                ? "Two items are identical — they will be saved as one item, with the quantities added."
                : `${n} items repeat an item above them — each will be saved into that item, with the quantities added.`,
    }),
};

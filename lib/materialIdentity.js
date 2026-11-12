// What makes two ordered items the same material (#356): the category, the size,
// the maker (#629) and the unit, and how each of the four is compared — and the
// one line a screen or a sentence names an item by.
//
// WHY THIS IS A MODULE AND NOT THREE COPIES. The rule had three implementations
// and they had to agree or the item axis silently splits one material into two
// rows with separate price histories behind them: `upsertMaterial`'s lock key,
// `lib/materialsCache.js`'s within-one-PO grouping key, and the
// `filterByFormula` `getMaterialByKey` builds. The first two are now this file's
// `materialIdentityKey`; the third is built in `lib/airtable/materials.js` from
// this file's `materialIdentityParts`, so all three normalize through one
// function. They were hand-copied before #356 and agreed by inspection; that
// issue changed the rule, which is the moment CLAUDE.md's "one rule, one
// implementation" section names for collapsing them.
//
// WHAT STAYS SEPARATE, AND THE CONDITION IS STRUCTURAL RATHER THAN PROVISIONAL.
// The formula TEXT is not generated here. `offline/formula-escaping.mjs` accepts
// a `filterByFormula` that is a template literal whose every interpolation is an
// escape-builder call from `lib/airtableFormula.js`, or a bare call to a
// whole-formula builder FROM THAT MODULE — so a complete predicate built here
// would fail it closed, correctly, because the check cannot see whether anything
// inside was escaped. The split is therefore: this file owns the VALUES, and the
// query owns the text that escapes them. `lib/materialCategory.js` is the
// neighbouring shape, where the Airtable expression IS generated because nothing
// interpolates a caller's value into it.
//
// THE AXES ARE NOT COMPARED ALIKE, AND THAT IS THE SUBSTANCE OF #356:
//
//   - `Category Code` is EXACT. It is a leaf code from `Material Categories`,
//     picked on the request form and never typed on any path this app offers, so
//     there are no two spellings to reconcile — which is the whole point of
//     keying on it. It replaced `Item Name`, whose case-insensitive comparison
//     existed precisely because a requester typed it.
//   - `Size` is case-insensitive and whitespace-collapsed. It is still free text,
//     so `3/4"` and `3/4 "` and `3/4"` are one size, and **Size is where the
//     remaining duplication lives** — `lib/prItemMerge.js` says the same thing
//     from the request side.
//   - `Maker` is compared as `Size` is, for the same reason: a requester types it
//     beside the size, optionally, so `Kitz` and `KITZ ` are one maker (#629). A
//     blank maker is the empty string, which is what every material made before
//     #629 holds, so an item naming no maker is still the material it was — and
//     one naming a maker is a material of its own, with its own prices.
//   - `Unit` is trimmed and lower-cased too. The 19-value select makes variance
//     unreachable through the app, and it is folded anyway for the reason
//     `prItemMerge.js` gives for the same field: `DRUM` is the precedent for an
//     option added by hand in Airtable that no file-only check can see, and a
//     `ea` beside `EA` would split a material in two.
//
// THE STORED VALUE KEEPS ITS CASE. `materialIdentityParts` hands back the size,
// maker and unit to WRITE as well as the key to compare on, and the written size
// and maker are `normalizeItemText`'s output with their case untouched — #18's rule, because
// that string reaches the vendor on the purchase order and the stored value is
// the only copy. Case-insensitivity belongs at the lookup, where it is
// reversible.
//
// Offline-safe: the one import spells its extension out, because this tier runs
// under plain `node` with no loader and cannot resolve the extensionless imports
// the rest of the app leaves to Next (`docs/notes/verification.md`).

import { normalizeItemText } from "./typedText.js";

/**
 * The four values that identify a material, each in the form it is compared
 * and stored in.
 *
 * `categoryCode` arrives from `Materials."Category Code"` (a lookup, so a
 * single-element array off a record) or from a `Material Categories` row's own
 * `Level 4 Code`; either way it is one string by the time it gets here.
 */
export function materialIdentityParts({ categoryCode, size, maker, unit }) {
    return {
        categoryCode: String(categoryCode ?? "").trim(),
        size: normalizeItemText(size),
        maker: normalizeItemText(maker),
        unit: String(unit ?? "").trim(),
    };
}

/**
 * One material's identity as a single comparable string, or `null` when there is
 * no category.
 *
 * NULL IS A REFUSAL RATHER THAN A FIFTH KEY, and it is what stops a caller
 * keying on nothing. A material with no category has no `Item Name` at all once
 * that field is a lookup, so a row created without one is nameless and its
 * `Material Label` is `_Size_Maker_Unit` — `upsertMaterial` throws on it and
 * `collectMaterialsCacheEntries` skips and reports it before reaching there.
 * Returning a key built from an empty code would instead make every category-less
 * ordered item one material.
 */
export function materialIdentityKey(input) {
    const parts = materialIdentityParts(input);
    if (!parts.categoryCode) return null;
    return [
        "material",
        parts.categoryCode,
        parts.size.toLowerCase(),
        parts.maker.toLowerCase(),
        parts.unit.toLowerCase(),
    ].join("::");
}

/**
 * The one line an item is named by on a screen or in a sentence (#629): its name and
 * its size, then a comma and its maker — `Ball Valve 2"`, `Ball Valve 2", Kitz`,
 * `Ball Valve, Kitz` — each part left out where it is blank, with what stands before
 * it. "" when all three are, so a caller says its own `—` or `That item`.
 *
 * THE ASSET CATALOG'S SHAPE, ONE AXIS OVER. `lib/assetCategory.js` names an item
 * `{Level 3} {Size}, {Maker} ({Part Number})`, a comma before the maker and none
 * without one, and a reader of this app meets both; a maker juxtaposed with a size
 * reads as more of the size.
 *
 * HERE BECAUSE IT NAMES WHAT THIS FILE IDENTIFIES. Two ordered items of one category
 * and unit are one material exactly when their sizes and makers agree under the rule
 * above, so a line carrying the name, the size and the maker tells apart what the item
 * axis tells apart — the unit is said beside it, where a screen puts it. Thirteen
 * call sites joined the name and the size by hand until this did, two of them as one
 * function written twice; a maker added to each would have been thirteen copies of a
 * rule with a comma in it.
 */
export function itemLabel(item) {
    const { itemName, size, maker } = item ?? {};
    const head = [itemName, size].filter(Boolean).join(" ");
    if (!maker) return head;
    return head ? `${head}, ${maker}` : maker;
}

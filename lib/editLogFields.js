// Which fields an Edit Log row can be about (#181) — the labels, and the item
// keys they are keyed on.
//
// WHY THIS IS ITS OWN MODULE, and not part of app/prs/[prId]/actions.js where
// these lived: that file is a `"use server"` module and pulls next/navigation, so
// no plain `node` script can import it. Every value here has to be readable by
// two checks — the offline one that fails when a label is added, and the
// credentialed one that compares them against the live `Edit Log."Field"` option
// list — and before this split the offline check had to PARSE the Server Action
// as text to see them, while the credentialed half could not be written at all.
// Same measured reason lib/authzWrap.js was split out of lib/authz.js (#147),
// lib/airtableFormula.js out of client.js (#159) and lib/idSequence.js out of
// lib/ids.js (#164): a rule stuck behind a module-load side effect cannot be
// pinned, so it moves.
//
// IMPORTS NOTHING, and must not start. The offline tier runs under plain `node`
// with no loader and no credentials, and anything reaching lib/airtable/client.js
// throws `Missing AIRTABLE_API_KEY` at module load.
//
// THE LABELS ARE THE WHOLE VOCABULARY THE CODE CAN SEND, which is the property
// both checks rest on. `Edit Log."Field"` is a singleSelect with no `typecast`
// behind it since #181, so a label that is not already a choice does not
// mislabel a row — it fails the write, and the failure takes the whole edit turn
// with it (see lib/airtable/editLog.js on the blast radius). An enumeration that
// missed one would make both checks quietly incomplete, so there is deliberately
// nowhere else for such a string to live: createEditLogEntry's call sites pass
// values from here and never a literal, which offline/edit-log-fields.mjs
// asserts on the AST.

/**
 * The item fields an Edit and continue turn diffs, mapped to the option value
 * logged for each. Keys are PR Item shapes as the form and updateItem use them;
 * values are the `Edit Log."Field"` choices.
 *
 * `Remark` IS here even though #61's duplicate-match deliberately ignores it —
 * these are two different questions. That one asks whether two PRs are the same
 * request; this one asks what changed and is answerable about any field.
 */
export const ITEM_FIELD_LABELS = {
    itemName: "Item Name",
    size: "Size",
    unit: "Unit",
    qty: "Qty",
    unitPrice: "Unit Price",
    remark: "Remark",
};

/**
 * The keys of the map above, DERIVED rather than restated.
 *
 * These were two hand-maintained lists in the Server Action, and every diffed
 * key is looked up in the label map one step later — so a key present here and
 * absent there would send `Field: undefined` to a singleSelect. Deriving makes
 * that unrepresentable instead of merely unlikely, which is cheaper than a check
 * for it. Insertion order is the declaration order above, so the diff still
 * walks the fields in the order a reader sees them on the form.
 */
export const ITEM_FIELDS = Object.keys(ITEM_FIELD_LABELS);

/**
 * The one PR-level field that is logged (#69). Not an item field, so it is not
 * in the map — but it IS a label the code sends, so it belongs to the
 * enumeration below and is exported rather than typed as a literal at the call
 * site.
 */
export const SHIPPING_FEE_LABEL = "Shipping Fee";

/**
 * Every label createEditLogEntry can write, which is exactly what
 * `Edit Log."Field"` must offer as choices.
 *
 * The credentialed check asserts that each of these exists on the live field;
 * the offline check asserts that this list has not grown without someone being
 * told to create the choice first. Neither direction is optional: a label with
 * no choice fails an edit turn at runtime, and a choice no label can reach is
 * either history the log is entitled to keep or a hand edit nobody recorded —
 * see scripts/tests/verify-edit-log-fields-181.mjs on how those two are told
 * apart.
 */
export const EDIT_LOG_FIELD_LABELS = [
    ...Object.values(ITEM_FIELD_LABELS),
    SHIPPING_FEE_LABEL,
];

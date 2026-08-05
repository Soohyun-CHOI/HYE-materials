// The labels createEditLogEntry can write must all exist as `Edit Log."Field"`
// choices — this is the half that can be checked without credentials (#181).
//
// WHAT #181 CHANGED AND WHY THIS EXISTS. createEditLogEntry used to write with
// `typecast: true`, so a label that was not yet a choice got auto-created. That
// hid a real cost: typecast gives every option it creates the same default
// color and nothing can recolor it, which is why `Unit Price` and `Shipping Fee`
// sat off the palette the other choices walk until they were corrected BY HAND
// in the Airtable UI. Removing it makes an unregistered label fail the write
// instead — measured, `INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient
// permissions to create new select option`.
//
// THE BLAST RADIUS IS THE WHOLE TURN, which is why a comment was not enough.
// The call sites sit inside editAndContinueAction's try, and its catch reverts
// every touched item, the Shipping Fee, the new Quotations and the signer's own
// status, then returns "Something went wrong saving your changes. Please try
// again." — advice that would be wrong forever for this cause, since the retry
// cannot succeed until someone adds the option in the Airtable UI.
//
// SO WHY NOT MAKE THE LOG BEST-EFFORT, the shape lib/materialsCache.js uses to
// keep a derived artifact from undoing the thing that produced it? Because that
// artifact is re-derivable and this one is not. A materials cache can be rebuilt
// from PO Items and a PO PDF regenerated from its PO, but an Edit Log entry
// records the OLD value, which stops existing the moment updateItem lands.
// Best-effort here would apply a price change and lose the only record of what
// it changed — a hole in the evidence trail this table exists to be. Failing the
// turn is the correct trade; the label set never drifting is the fix.
//
// TWO DIRECTIONS, TWO TIERS, and this file is only one of them. A label added in
// code with no matching choice is caught here, in CI, on the push that adds it.
// A CHOICE DELETED IN AIRTABLE leaves every file untouched and cannot be seen
// from here at all — that needs the live option list, and it is
// scripts/tests/verify-edit-log-fields-181.mjs. Same split as the Unit pair
// (offline/unit-options.mjs proves the files agree, verify-unit-options-18.mjs
// proves the fields do), and neither half subsumes the other: #181 deleted the
// `Rate` choice by hand, because no API can, and this check stayed green.
//
// SINCE THE LABELS MOVED TO lib/ (#181) this imports them instead of parsing the
// Server Action as text. What still has to be read as source is the SHAPE of the
// call sites — that none of them passes a literal, which is what keeps the
// enumeration complete — and that no `typecast` has come back.

import { parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import {
    EDIT_LOG_FIELD_LABELS,
    ITEM_FIELDS,
    ITEM_FIELD_LABELS,
    SHIPPING_FEE_LABEL,
} from "../../../lib/editLogFields.js";

export const title = "Edit Log labels — every one must be an existing `Field` choice (#181)";

const ACTIONS = "app/prs/[prId]/actions.js";
const SERVICE = "lib/airtable/editLog.js";

// EVERY LABEL THE CODE CAN WRITE. A DELIBERATE SECOND COPY of what
// lib/editLogFields.js exports, and it has to stay one: comparing that module to
// itself would pass unconditionally. What this guards is a label being ADDED,
// which is the moment to create the choice in the Airtable UI first — the
// Metadata API cannot write a select's option list at all (measured, 422 on
// `options.choices`), so no code path can do it for you, and shipping the label
// without the choice does not mislabel anything, it blocks the edit turn.
//
// The credentialed script compares the same module against the live field, so it
// needs no copy; this one is the CI tripwire, which is why it keeps one.
const EXPECTED_LABELS = [
    "Item Name",
    "Size",
    "Unit",
    "Qty",
    "Unit Price",
    "Remark",
    "Shipping Fee",
];

/** Literal `field:` values handed to createEditLogEntry — there must be none. */
function literalFieldArguments(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type !== "CallExpression") return;
        if (n.callee?.name !== "createEditLogEntry") return;
        const arg = n.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        for (const p of arg.properties) {
            if (p.type !== "Property") continue;
            const key = p.key?.name ?? p.key?.value;
            if (key === "field" && p.value?.type === "Literal") found.push(p.value.value);
        }
    });
    return found;
}

/** How many `field:` properties reach createEditLogEntry at all. */
function fieldArgumentCount(ast) {
    let n = 0;
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        if (node.callee?.name !== "createEditLogEntry") return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        for (const p of arg.properties) {
            if (p.type !== "Property") continue;
            if ((p.key?.name ?? p.key?.value) === "field") n += 1;
        }
    });
    return n;
}

export function run({ check, log }) {
    log("the module's enumeration:");
    // The message names the remedy, because the failure is otherwise a puzzle:
    // the label is fine, the code is fine, and Airtable is the thing short a
    // choice.
    check(
        `every writable label is registered here (create the Airtable choice first): ${EDIT_LOG_FIELD_LABELS.join(", ")}`,
        [...EDIT_LOG_FIELD_LABELS].sort().join("|"),
        [...EXPECTED_LABELS].sort().join("|")
    );
    check("no label appears twice", new Set(EDIT_LOG_FIELD_LABELS).size, EDIT_LOG_FIELD_LABELS.length);
    check("the PR-level label is in the enumeration", EDIT_LOG_FIELD_LABELS.includes(SHIPPING_FEE_LABEL), true);
    // Derived, not restated — a diffed key with no label would send
    // `Field: undefined` to a singleSelect. Pinned so the derivation is not
    // quietly replaced by a second hand-typed list.
    check("ITEM_FIELDS is exactly the label map's keys", ITEM_FIELDS.join(","), Object.keys(ITEM_FIELD_LABELS).join(","));
    check("no label is blank or untrimmed", EDIT_LOG_FIELD_LABELS.filter((l) => l !== l.trim() || !l).length, 0);

    log("");
    log("call-site shape — what keeps that enumeration complete:");
    const { ast } = parseFile(ACTIONS);
    const literals = literalFieldArguments(ast);
    // A literal here would be a label living outside lib/editLogFields.js, which
    // both checks would then be blind to. `Shipping Fee` was exactly that until
    // #181 exported it as SHIPPING_FEE_LABEL.
    check(
        `no createEditLogEntry call passes a literal label${literals.length ? ` (found ${literals.join(", ")})` : ""}`,
        literals.length,
        0
    );
    check("createEditLogEntry is still called with a `field`", fieldArgumentCount(ast) > 0, true);

    log("");
    log("the typecast that used to paper over a missing choice:");
    const { ast: serviceAst } = parseFile(SERVICE);
    let typecasts = 0;
    walk(serviceAst, (n) => {
        if (n.type !== "Property") return;
        if ((n.key?.name ?? n.key?.value) === "typecast") typecasts += 1;
    });
    // Pinned so it cannot come back quietly. Restoring it would trade a blocked
    // turn for an unrecolorable option and a canonical list that rots — the
    // trade #181 measured and rejected.
    check("lib/airtable/editLog.js passes no typecast", typecasts, 0);
}

if (isMain(import.meta.url)) standalone(title, run);

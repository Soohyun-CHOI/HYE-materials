// The labels createEditLogEntry can write must all exist as `Edit Log."Field"`
// choices — pinned here because the consequence of one that does not is a
// blocked signing turn, not a missing log line (#181).
//
// WHAT #181 CHANGED AND WHY THIS EXISTS. createEditLogEntry used to write with
// `typecast: true`, so a label that was not yet a choice got auto-created. That
// hid a real cost: typecast gives every option it creates the same default
// color and nothing can recolor it, which is why `Unit Price` and `Shipping Fee`
// sit off the palette the other six choices walk. Removing it makes an
// unregistered label fail the write instead — measured,
// `INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient permissions to create new
// select option`.
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
// turn is the correct trade; the fix is for the label set never to drift.
//
// AND WHY THE CHECK IS HERE rather than a guard in the action: what would be
// wrong is the AIRTABLE option list, which the app would have to fetch per edit
// to know. Validating a label against ITEM_FIELD_LABELS is circular — that is
// where the label came from. So the pin belongs in a check, and the file is read
// as TEXT because app/prs/[prId]/actions.js is a "use server" module that pulls
// next/navigation: importing it under plain node fails, the same reason
// offline/unit-options.mjs parses the Python script instead of running it.
//
// WHAT THIS CANNOT SEE, by construction: whether the choices are actually on the
// field. Someone deleting one by hand in Airtable leaves every file untouched
// and passes here — the same blind spot offline/unit-options.mjs records, and
// the same answer: that comparison needs the Metadata API and the credentialed
// tier. No credentialed script reads Edit Log today, so that half is a real gap.

import { parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Edit Log labels — every one must be an existing `Field` choice (#181)";

const ACTIONS = "app/prs/[prId]/actions.js";
const SERVICE = "lib/airtable/editLog.js";

// EVERY LABEL THE CODE CAN WRITE, and this list is the pin: adding one to
// ITEM_FIELD_LABELS (or passing a new literal to createEditLogEntry) fails here
// until it is added below too. That is the moment to create the choice in the
// Airtable UI first — the Metadata API cannot write a select's option list at
// all (measured, 422 on `options.choices`), so there is no code path that can
// do it for you, and shipping the label without the choice blocks the edit
// action rather than mislabelling anything.
//
// `Rate` is deliberately NOT here. It is a choice on the field, held by three
// pre-#78 rows, but no code writes it any more — this list is what the code can
// SEND, not what the field offers.
const EXPECTED_LABELS = [
    "Item Name",
    "Size",
    "Unit",
    "Qty",
    "Unit Price",
    "Remark",
    "Shipping Fee",
];

/** The string values of a top-level `const NAME = { ... }` object literal. */
function objectLiteralValues(ast, name) {
    let values = null;
    walk(ast, (n) => {
        if (
            n.type === "VariableDeclarator" &&
            n.id?.name === name &&
            n.init?.type === "ObjectExpression"
        ) {
            values = n.init.properties
                .filter((p) => p.type === "Property" && p.value?.type === "Literal")
                .map((p) => p.value.value);
        }
    });
    return values;
}

/** Literal `field:` values handed to createEditLogEntry — the non-map call sites. */
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

export function run({ check, log }) {
    const { ast } = parseFile(ACTIONS);

    log("labels the code can write:");
    const mapped = objectLiteralValues(ast, "ITEM_FIELD_LABELS");
    check("ITEM_FIELD_LABELS is a parsable object literal", Array.isArray(mapped), true);

    const literals = literalFieldArguments(ast);
    check("createEditLogEntry has at least one literal-label call site", literals.length > 0, true);

    const writable = [...new Set([...(mapped ?? []), ...literals])].sort();
    const expected = [...EXPECTED_LABELS].sort();

    // The message names the remedy, because the failure is otherwise a puzzle:
    // the label is fine, the code is fine, and Airtable is the thing that is
    // short a choice.
    check(
        `every writable label is registered here (add the Airtable choice first): ${writable.join(", ")}`,
        writable.join("|"),
        expected.join("|")
    );
    check("no label is written twice under different spellings", writable.length, expected.length);

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

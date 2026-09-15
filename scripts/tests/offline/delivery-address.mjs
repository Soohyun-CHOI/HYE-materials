// Where a delivery actually arrived (#387).
//
// WHAT THIS FILE HOLDS, and the mutants it exists for are all quiet ones.
//
//   1. The default is what the orders AGREE on. The mutants are a first-wins pick
//      (`orderedItems[0]`'s address), which silently resolves a disagreement the
//      recorder should have seen, and treating an order with no address as a
//      rival, which turns every ordinary mixed delivery into a conflict.
//   2. It never falls back to the job's default address. That fallback costs one
//      token, reads as a kindness, and is the live job read the four issues of
//      this chain exist to remove — so it is asserted on the AST rather than
//      trusted to a comment.
//   3. The action REQUIRES one and re-derives nothing. Re-deriving would record
//      where the orders say the material should have gone rather than where the
//      recorder said it went, which is the distinction the field draws.
//   4. `Delivery Address` has exactly ONE writer. Not because a second one would
//      break allocation — it would not — but because the field moves stock from
//      the next issue on, and one writer is what keeps that decision from being
//      undone by a path nobody weighed it against.
//   5. The delete path does not carry the address, and the reason is structural:
//      a split row keeps its source's DELIVERY, so the address is inherited rather
//      than copied. Putting it in the copy list would be one value in two places.
//
// WHAT IT CANNOT SEE.
//
//   - Whether anything RENDERS. The control, its three sentences and the gray/amber
//     split are browser work, and all of it was walked.
//   - Whether `Deliveries."Delivery Address"` exists on the base. No offline check
//     reads the base in either direction (docs/notes/verification.md);
//     `scripts/import/add_delivery_address_387.mjs` is what asks.
//   - Whether a delivery can actually reach two orders with different addresses.
//     That is a fact about the base, not about this code; the browser walk built
//     the case rather than assuming it.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ADDRESS_CHOICE_COPY } from "../../../lib/addressChoice.js";
import { DELIVERY_ADDRESS_COPY, deliveryAddressDefault } from "../../../lib/deliveryAddress.js";
import { parseFile, parseSource, walk, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Where a delivery actually arrived (#387)";

/** Every `OBJ.key` member expression in a file, as `key` strings. */
function memberKeys(parsed, objectName) {
    const keys = new Set();
    walk(parsed.ast, (n) => {
        if (n.type !== "MemberExpression" || n.object?.name !== objectName) return;
        if (n.property?.name) keys.add(n.property.name);
    });
    return keys;
}

/**
 * Does this subtree read `<object>.<property>`, however it is spelled?
 *
 * ON THE AST AND NOT ON THE TEXT, for the reason #386's own check had to learn:
 * every module here carries a comment saying what it deliberately does NOT read,
 * so a text matcher fails on the explanation of the rule it is enforcing. Optional
 * chaining is free — acorn gives `job?.deliveryAddress` the same `MemberExpression`
 * shape, with the `?.` on the node rather than in the object/property pair.
 */
function readsMember(node, objectName, propertyName) {
    let found = false;
    walk(node, (n) => {
        if (n.type !== "MemberExpression") return;
        if (n.object?.name === objectName && n.property?.name === propertyName) found = true;
    });
    return found;
}

/** Does this subtree carry `value` as a string literal? */
function namesLiteral(node, value) {
    let found = false;
    walk(node, (n) => {
        if (n.type === "Literal" && n.value === value) found = true;
    });
    return found;
}

/** An ordered item as the plan hands it over — only the two keys the rule reads. */
const on = (poRecordId, deliveryAddressRecordId) => ({ poRecordId, deliveryAddressRecordId });

export function run({ check, assert, log }) {
    // ── 1: the default is what the orders agree on ─────────────────────────
    log("the default is the address every order that has one agrees on:");
    check("nothing planned yet", deliveryAddressDefault([]).state, "empty");
    check("  and it offers no address", deliveryAddressDefault([]).addressId, null);
    check("one order, one address", deliveryAddressDefault([on("po1", "a1")]).state, "agreed");
    check("  and that is the default", deliveryAddressDefault([on("po1", "a1")]).addressId, "a1");
    // ONE ORDER CONTRIBUTES ONCE however many of its ordered items were touched,
    // which is what makes `orderCount` a count of ORDERS rather than of rows — the
    // figure the copy renders a singular or a plural from.
    const twoItemsOneOrder = deliveryAddressDefault([on("po1", "a1"), on("po1", "a1")]);
    check("two ordered items of one order", twoItemsOneOrder.orderCount, 1);
    check("  still agreed", twoItemsOneOrder.state, "agreed");
    const twoOrdersAgreeing = deliveryAddressDefault([on("po1", "a1"), on("po2", "a1")]);
    check("two orders naming one address", twoOrdersAgreeing.state, "agreed");
    check("  counted as two", twoOrdersAgreeing.orderCount, 2);
    check("  and not partly", twoOrdersAgreeing.partly, false);

    // THE MUTANT THIS SECTION EXISTS FOR. A first-wins pick answers every case
    // above identically and differs only here, where the recorder is the one who
    // should decide.
    const rivals = deliveryAddressDefault([on("po1", "a1"), on("po2", "a2")]);
    check("two orders naming different addresses", rivals.state, "disagree");
    check("  and nothing is preselected", rivals.addressId, null);

    // AN ORDER WITH NO ADDRESS IS NOT A RIVAL. 34 of the 35 orders on this base
    // record none, so reading silence as disagreement would make every mixed
    // delivery read as a conflict.
    const partly = deliveryAddressDefault([on("po1", "a1"), on("po2", null)]);
    check("one order names an address and the other says nothing", partly.state, "agreed");
    check("  the one that spoke is the default", partly.addressId, "a1");
    check("  and the gap is reported", partly.partly, true);

    const silent = deliveryAddressDefault([on("po1", null), on("po2", null)]);
    check("no order names one", silent.state, "no-order-address");
    check("  so there is no default", silent.addressId, null);
    check("  and both orders are counted", silent.orderCount, 2);
    // An ordered item the plan could not attach contributes no order at all, which
    // is the `Delivery Items` row with no `PO Item` this base already carries.
    check("an ordered item with no order is skipped", deliveryAddressDefault([on(null, "a1")]).state, "empty");

    // ── 2: it never falls back to the job ──────────────────────────────────
    log("");
    log("nothing defaults from the job's own address:");
    const rule = parseFile("lib/deliveryAddress.js");
    // The rule takes ONE argument and it is the ordered items, so a job fallback
    // cannot be added without changing the call site too — which is what gives the
    // assertion below something to catch.
    check("the rule takes one argument", deliveryAddressDefault.length, 1);
    assert("  and never names a job's address", !readsMember(rule.ast, "job", "deliveryAddress"));
    // THE WHOLE FILE, not the component node: `DeliveryForm` is a default export
    // and `resolveFunction` does not resolve one, and the wider scope is the
    // stronger claim anyway — a helper outside the component must not reach for the
    // job's address either.
    const form = parseFile("app/deliveries/new/DeliveryForm.js");
    assert("it calls the rule", /deliveryAddressDefault\(/.test(form.source));
    // THE MUTANT: `|| selectedJob?.deliveryAddress?.[0]` beside the default. The
    // form holds the job — `addressOptions` needs it for the first group — so the
    // fallback is in scope and costs no read, which is exactly why it needs an
    // assertion rather than a comment.
    assert(
        "  and never reads the job's address as a default",
        !readsMember(form.ast, "selectedJob", "deliveryAddress")
    );
    assert(
        "  though the job IS in hand for the picker's first group",
        /addressOptions\(selectedJob/.test(form.source)
    );

    // ── 3: required at submit, and the action re-derives nothing ───────────
    log("");
    log("the action requires an address and computes none:");
    const actions = parseFile("app/deliveries/new/actions.js");
    const create = resolveFunction(actions.ast, "createDeliveryAction");
    assert("createDeliveryAction exists", Boolean(create));
    const createSrc = actions.source.slice(create.start, create.end);
    assert("it refuses a missing address", /ADDRESS_CHOICE_COPY\.required/.test(createSrc));
    assert("  and one that names no row", /ADDRESS_CHOICE_COPY\.unknown/.test(createSrc));
    // ONE FACT, ONE SENTENCE ACROSS TWO FORMS. `/prs/new` asks the same question of
    // the same table, so the refusals are imported rather than re-coined — a second
    // wording would be two sentences for one refusal the first time either moved.
    assert("  from the shared constant rather than a literal", !/Pick a delivery address/.test(createSrc));
    // RE-DERIVING WOULD RECORD THE WRONG FACT: where the orders say the material
    // should have gone, rather than where the recorder said it went.
    assert("  and it never recomputes the default", !/deliveryAddressDefault/.test(actions.source));
    assert("  it passes what arrived on the form", /deliveryAddressRecordId: deliveryAddressId/.test(createSrc));

    // ── 4: one writer ──────────────────────────────────────────────────────
    log("");
    log("the field has exactly one writer:");
    const table = parseFile("lib/airtable/deliveries.js");
    // Two literals: the read in `recordToDelivery` and the write in `createDelivery`.
    // A third is either a second writer or a second reader, and both are worth
    // stopping — the shape `Packing List File`'s own writer count already has.
    let literals = 0;
    walk(table.ast, (n) => {
        if (n.type === "Literal" && n.value === "Delivery Address") literals += 1;
    });
    check("`Delivery Address` appears twice in the table module", literals, 2);
    const update = resolveFunction(table.ast, "updateDelivery");
    assert("updateDelivery exists", Boolean(update));
    assert(
        "  and takes no address parameter",
        !readsMember(update, "fields", "Delivery Address") &&
            !namesLiteral(update, "Delivery Address")
    );
    const createRow = resolveFunction(table.ast, "createDelivery");
    assert("createDelivery writes it", namesLiteral(createRow, "Delivery Address"));

    // ── 5: the delete path does not carry it ───────────────────────────────
    log("");
    log("the delete path neither restores nor copies the address:");
    const del = parseFile("lib/deliveryDelete.js");
    // It destroys the header, so there is nothing to restore; and the rows it
    // re-creates on a split are `Delivery Items`, which carry no address.
    assert("nothing in the delete path names the field", !namesLiteral(del.ast, "Delivery Address"));
    assert("  nor the mapper key", !readsMember(del.ast, "delivery", "deliveryAddress"));
    // THE STRUCTURAL REASON, ASSERTED RATHER THAN EXPLAINED. A split row is created
    // on its SOURCE ROW's delivery, so it inherits that delivery's address instead
    // of copying it. A mutant that created the split on any other delivery would
    // part the two, which is the shape a restore list gets wrong.
    assert(
        "a split row is created on its source row's own delivery",
        /deliveryRecordId: from\.delivery\?\.\[0\]/.test(del.source)
    );

    // ── 6: the words ───────────────────────────────────────────────────────
    log("");
    log("what the control says, and where each word comes from:");
    // THE LABEL, THE PLACEHOLDER AND THE GROUP HEADINGS ARE NOT HERE, and their
    // absence is the assertion: they belong to `/prs/new`'s constant and this screen
    // imports them, so re-coining one would show up as a new key rather than as a
    // silent second wording.
    for (const borrowed of ["label", "pickerUnchosen", "groupOnJob", "groupOthers", "required", "unknown"]) {
        check(`  \`${borrowed}\` is borrowed, not re-coined`, borrowed in DELIVERY_ADDRESS_COPY, false);
        assert(`    and ADDRESS_CHOICE_COPY has it`, borrowed in ADDRESS_CHOICE_COPY);
    }
    const readByForm = memberKeys(form, "DELIVERY_ADDRESS_COPY");
    const unread = Object.keys(DELIVERY_ADDRESS_COPY).filter((k) => !readByForm.has(k));
    check(
        `every key is read by the form${unread.length ? ` (${unread.join(", ")})` : ""}`,
        unread.length,
        0
    );
    // `taken` IS A CLAIM ABOUT THE VALUE AND THE OTHER TWO ARE ABOUT THE ORDERS, so
    // only `taken` stands down once the recorder has overridden the default. Found
    // by walking the form: `Cedar Park Shop` sat under `Taken from the order this
    // delivery attaches to.`, which was false about the control it was under. The
    // other two say what the orders did, which a pick does not change.
    assert(
        "the `taken` sentence stands down once the recorder has picked",
        /addressDefault\.state === "agreed" && !pickedAddressId/.test(form.source)
    );
    for (const aboutTheOrders of ["no-order-address", "disagree"]) {
        assert(
            `  and \`${aboutTheOrders}\` does not, being about the orders`,
            new RegExp(`addressDefault\\.state === "${aboutTheOrders}" &&\\s*\\(`).test(form.source)
        );
    }
    const borrowedRead = memberKeys(form, "ADDRESS_CHOICE_COPY");
    for (const key of ["label", "pickerUnchosen", "groupOnJob", "groupOthers"]) {
        assert(`  the form renders ADDRESS_CHOICE_COPY.${key}`, borrowedRead.has(key));
    }
    // The singular and the plural are different sentences rather than one with an
    // `(s)`, which is `DELETE_COPY`'s shape on the same axis.
    assert("one order and several get different sentences", DELIVERY_ADDRESS_COPY.taken(1) !== DELIVERY_ADDRESS_COPY.taken(2));
    assert("  and so do the two silences", DELIVERY_ADDRESS_COPY.noOrderAddress(1) !== DELIVERY_ADDRESS_COPY.noOrderAddress(2));
    // NO KEY MAY START WITH `use` — a lint rule rather than a wording one, since
    // `COPY.useX()` in a component reads as a conditional HOOK call to
    // `react-hooks/rules-of-hooks`. See docs/notes/naming.md.
    const hookish = Object.keys(DELIVERY_ADDRESS_COPY).filter((k) => /^use[A-Z]/.test(k));
    check(`no copy key reads as a React hook${hookish.length ? ` (${hookish.join(", ")})` : ""}`, hookish.length, 0);
    // `arrived` IS BARRED IN COPY AND KEPT IN PROSE, which `offline/line-vocabulary.mjs`
    // states as its own scope — #166 chose `delivered` for this act. Asserted here as
    // well because this module's whole subject is the word, so a future edit reaching
    // for the natural phrasing should fail on its own file first.
    const strings = Object.values(DELIVERY_ADDRESS_COPY).flatMap((v) =>
        typeof v === "function" ? [v(1), v(2)] : [v]
    );
    check("no sentence says `arrived`", strings.filter((s) => /arriv/i.test(s)).length, 0);
    assert("and one of them says `delivered`", strings.some((s) => /delivered/.test(s)));

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — every matcher is seen to be able to say no:");
    // Sections 2 and 5 rest on one walk saying no. If it cannot say YES, the
    // fallback and the copy-list assertions are vacuous.
    const plantedFallback = parseSource(
        "const id = picked || selectedJob?.deliveryAddress?.[0];\n",
        "<planted-fallback>"
    );
    assert(
        "the job-address walk finds the fallback exactly",
        readsMember(plantedFallback.ast, "selectedJob", "deliveryAddress")
    );
    check(
        "  but not the order's",
        readsMember(
            parseSource("const a = po.deliveryAddress?.[0];\n", "<planted-po>").ast,
            "selectedJob",
            "deliveryAddress"
        ),
        false
    );
    assert(
        "the literal walk finds a planted field name",
        namesLiteral(parseSource('const f = "Delivery Address";\n', "<planted-field>").ast, "Delivery Address")
    );
    check(
        "  and does not match a different field",
        namesLiteral(parseSource('const f = "Delivery Address Used";\n', "<planted-other>").ast, "Delivery Address"),
        false
    );
    // The key reader has to find keys, or section 6's inventory passes for a file
    // it failed to parse.
    const planted = parseSource("const A = () => <p>{DELIVERY_ADDRESS_COPY.disagree}</p>;\n", "<planted-keys>");
    check("a member expression is seen", [...memberKeys(planted, "DELIVERY_ADDRESS_COPY")].join(), "disagree");
    check("  and a key nothing reads is not invented", memberKeys(planted, "DELIVERY_ADDRESS_COPY").has("partly"), false);
    // And the rule has to answer more than one way, or section 1 is what a constant
    // reports. Four distinct states over four inputs.
    const states = new Set(
        [[], [on("po1", "a1")], [on("po1", "a1"), on("po2", "a2")], [on("po1", null)]].map(
            (input) => deliveryAddressDefault(input).state
        )
    );
    check("the rule reaches four states", states.size, 4);
    assert("the constant holds the control's words", Object.keys(DELIVERY_ADDRESS_COPY).length === 4);
}

if (isMain(import.meta.url)) await standalone(title, run);

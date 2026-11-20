// Where a delivery actually arrived (#387), and correcting it (#680).
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
//   4. `Delivery Address` has TWO writers, `createDelivery` and #680's
//      `setDeliveryAddress`, and the date-and-note save is neither. Not because a
//      third would break allocation — it would not — but because the field moves
//      stock, and a third path would move it with no refusal below zero and no row
//      on the delivery's activity. `setDeliveryAddress` has one caller, the correction.
//   5. The delete path does not carry the address, and the reason is structural:
//      a split row keeps its source's DELIVERY, so the address is inherited rather
//      than copied. Putting it in the copy list would be one value in two places.
//   7. A DELIVERY STANDS AT ONE OF ITS JOB'S ADDRESSES (#680). The form lists the
//      job's alone, an agreed order address off the job is no default, a job with
//      none says so, and the action refuses an address off the job. The mutant is
//      the request form's list put back, which would let stock be counted where
//      the job has no address.
//   8. THE CORRECTION (#680): its refusals in their order, the list it offers, the
//      words it shares rather than re-coins, and its write's shape — who and the
//      job open asked before the write, the stock read before it and again after
//      it with the old address written back, the activity row out of the lock, and
//      a delete taking the delivery's rows before the delivery.
//
// WHAT IT CANNOT SEE.
//
//   - Whether anything RENDERS. The control, its three sentences and the gray/amber
//     split are browser work, and all of it was walked.
//   - Whether `Deliveries."Delivery Address"` exists on the base. No offline check
//     reads the base in either direction (docs/notes/verification.md);
//     `scripts/import/ran/add_delivery_address_387.mjs` is what asks.
//   - Whether a delivery can actually reach two orders with different addresses.
//     That is a fact about the base, not about this code; the browser walk built
//     the case rather than assuming it.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ADDRESS_CHOICE_COPY } from "../../../lib/addressChoice.js";
import {
    DELIVERY_ADDRESS_COPY,
    DELIVERY_ADDRESS_CORRECTION_COPY,
    addAddressPath,
    correctionOptions,
    correctionRefusal,
    correctionRefusalText,
    deliveryAddressDefault,
} from "../../../lib/deliveryAddress.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, resolveFunction, callsTo, insideCallTo } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Where a delivery actually arrived, and correcting it (#387, #680)";

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
    // #680 — AN AGREED ADDRESS OFF THE JOB IS NO DEFAULT: a request may name any address and its
    // order freezes it, while a delivery stands at one of its job's.
    const offJob = deliveryAddressDefault([on("po1", "a9")], ["a1", "a2"]);
    check("the orders agree on an address that is not the job's", offJob.state, "not-on-job");
    check("  and nothing is preselected", offJob.addressId, null);
    check("  with the orders still counted", offJob.orderCount, 1);
    check("an agreed address that is the job's is still the default", deliveryAddressDefault([on("po1", "a1")], ["a1", "a2"]).addressId, "a1");
    check("  and two orders off the job still disagree first", deliveryAddressDefault([on("po1", "a8"), on("po2", "a9")], ["a1"]).state, "disagree");

    // ── 2: it never falls back to the job ──────────────────────────────────
    log("");
    log("nothing defaults from the job's own address:");
    const rule = parseFile("lib/deliveryAddress.js");
    // The rule takes ONE required argument and it is the ordered items, so a job
    // fallback cannot be added without changing the call site too — which is what
    // gives the assertion below something to catch. #680's second, the job's address
    // ids, can turn a default down and never supply one (section 1 above).
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
        "  though the job IS in hand for the picker's list",
        /addressesOnJob\(selectedJob/.test(form.source)
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

    // ── 4: two writers ─────────────────────────────────────────────────────
    log("");
    log("the field has two writers, and the second has one caller:");
    const table = parseFile("lib/airtable/deliveries.js");
    // Three literals: the read in `recordToDelivery`, the write in `createDelivery` and
    // the write in `setDeliveryAddress` (#680). A fourth is either a third writer or a
    // second reader, and both are worth stopping — the shape `Packing List File`'s own
    // writer count already has.
    let literals = 0;
    walk(table.ast, (n) => {
        if (n.type === "Literal" && n.value === "Delivery Address") literals += 1;
    });
    check("`Delivery Address` appears three times in the table module", literals, 3);
    const setAddress = resolveFunction(table.ast, "setDeliveryAddress");
    assert("setDeliveryAddress writes it", Boolean(setAddress) && namesLiteral(setAddress, "Delivery Address"));
    // ONE CALLER, THE CORRECTION: a second would move a delivery's stock with no refusal below
    // zero and no row on its activity.
    const setters = [];
    for (const dir of ["app", "lib"]) {
        for (const full of listJsFiles(repoPath(dir))) {
            const rel = toPosix(full.slice(repoPath(".").length + 1));
            if (rel === "lib/airtable/deliveries.js") continue;
            if (callsTo(parseFile(rel).ast, "setDeliveryAddress").length > 0) setters.push(rel);
        }
    }
    check("  and the correction is its one caller", setters.join(" "), "lib/deliveryAddress.server.js");
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
    // Every key is read by the form, but the refusal of an address off the job, which is the
    // action's and the correction's (#680).
    const readByForm = memberKeys(form, "DELIVERY_ADDRESS_COPY");
    const unread = Object.keys(DELIVERY_ADDRESS_COPY).filter((k) => !readByForm.has(k));
    check("every key is read by the form but the refusal", unread.join(" "), "offJob");
    assert("  which the action gives", memberKeys(actions, "DELIVERY_ADDRESS_COPY").has("offJob"));
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
    for (const key of ["label", "pickerUnchosen"]) {
        assert(`  the form renders ADDRESS_CHOICE_COPY.${key}`, borrowedRead.has(key));
    }
    // ONE LIST SINCE #680, THE JOB'S OWN: the request form's two groups are not drawn here.
    for (const key of ["groupOnJob", "groupOthers"]) {
        check(`  and not ADDRESS_CHOICE_COPY.${key}, the request form's group`, borrowedRead.has(key), false);
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

    // ── 7: a delivery stands at one of its job's addresses ─────────────────
    log("");
    log("a delivery stands at one of its job's addresses (#680):");
    assert("the form lists the job's addresses alone", /addressesOnJob\(selectedJob, addresses\)/.test(form.source));
    check("  and never every address, the request form's list", /addressOptions\(/.test(form.source), false);
    // ON THE CALL'S OWN SECOND ARGUMENT: the list's options are drawn from `jobAddresses.map(`
    // further down, so a text match from the call onward finds that and passes without it.
    const defaultCall = callsTo(form.ast, "deliveryAddressDefault")[0];
    const secondArgument = defaultCall?.arguments?.[1];
    assert(
        "  and hands the job's addresses to the default",
        Boolean(secondArgument) && /^jobAddresses\.map\(/.test(form.source.slice(secondArgument.start, secondArgument.end))
    );
    assert("a job with none says so, with the way to add one", memberKeys(form, "DELIVERY_ADDRESS_COPY").has("noJobAddress") && /addAddressPath\(selectedJob\.jobCode\)/.test(form.source));
    check("  which opens the address form on the job", addAddressPath("26-DEMO-01"), "/addresses/new?job=26-DEMO-01");
    check("  its job named", DELIVERY_ADDRESS_COPY.noJobAddress("26-DEMO-01").startsWith("26-DEMO-01 "), true);
    const offJobAt = createSrc.indexOf("DELIVERY_ADDRESS_COPY.offJob");
    assert("the action refuses an address off the job", offJobAt > 0 && /isAddressOnJob\(job, addresses, deliveryAddressId\)/.test(createSrc));
    assert("  before it writes anything", offJobAt > 0 && offJobAt < createSrc.indexOf("createDelivery("));

    // ── 8: the correction ──────────────────────────────────────────────────
    log("");
    log("correcting a recorded delivery's address (#680):");
    const job = { id: "job1", jobCode: "J-1", deliveryAddress: ["a1"] };
    const addresses = [
        { id: "a1", addressLabel: "Yard", jobs: [] },
        { id: "a2", addressLabel: "Gate 3", jobs: ["job1"] },
        { id: "a3", addressLabel: "Shop", jobs: ["job2"] },
    ];
    const ask = (over) => correctionRefusal({ job, addresses, standingAddressId: "a1", shownAddressId: "a1", chosenAddressId: "a2", ...over });
    check("another of the job's addresses is accepted", ask({}), null);
    check("  none picked", ask({ chosenAddressId: "" }), "required");
    check("  one that names no address", ask({ chosenAddressId: "a9" }), "unknown");
    check("  a page drawn before the address changed", ask({ shownAddressId: "a2", chosenAddressId: "a2" }), "moved");
    check("  the address it already stands at", ask({ chosenAddressId: "a1" }), "same");
    check("  an address that is not the job's", ask({ chosenAddressId: "a3" }), "off-job");
    // THE ORDER IS PART OF THE RULE: a stale page is refused as stale before what it picked is
    // judged, so its reader is shown the delivery as it stands rather than told to pick again.
    check("  a stale page picking an address off the job is refused as stale", ask({ shownAddressId: "a2", chosenAddressId: "a3" }), "moved");
    check("it offers the job's addresses less the one it stands at", correctionOptions(job, addresses, "a1").map((a) => a.id).join(" "), "a2");
    check("  and all of the job's for a delivery standing off the job", correctionOptions(job, addresses, "a3").map((a) => a.id).join(" "), "a2 a1");
    check("  and nothing for a job with no other", correctionOptions({ id: "job3", deliveryAddress: ["a3"] }, addresses, "a3").length, 0);
    // ONE FACT, ONE SENTENCE: the refusals the entry form already gives are its own words here.
    check(
        "its refusals the entry form shares are the entry form's words",
        ["required", "unknown", "off-job"].map((k) => correctionRefusalText(k)).join(" | "),
        [ADDRESS_CHOICE_COPY.required, ADDRESS_CHOICE_COPY.unknown, DELIVERY_ADDRESS_COPY.offJob].join(" | ")
    );
    const ownKeys = ["same", "moved", "below-zero", "failed"];
    check("  and each of its own has words of its own", new Set(ownKeys.map((k) => correctionRefusalText(k, { names: "Pipe", addressLabel: "Yard" }))).size, 4);
    check(
        "  the one below zero names the material and the address it leaves",
        /Pipe at Yard below zero/.test(correctionRefusalText("below-zero", { names: "Pipe", addressLabel: "Yard" })),
        true
    );
    const correctionStrings = [
        ...Object.values(DELIVERY_ADDRESS_CORRECTION_COPY).filter((v) => typeof v === "string"),
        ...ownKeys.map((k) => correctionRefusalText(k, { names: "Pipe", addressLabel: "Yard" })),
    ];
    check("  and none says `arrived`", correctionStrings.filter((t) => /arriv/i.test(t)).length, 0);

    log("the correction's write, by its shape:");
    const server = parseFile("lib/deliveryAddress.server.js");
    const correct = resolveFunction(server.ast, "correctDeliveryAddress");
    assert("correctDeliveryAddress exists", Boolean(correct));
    const first = (name) => callsTo(correct, name)[0]?.start ?? -1;
    const writes = callsTo(correct, "setDeliveryAddress");
    const firstWrite = writes[0]?.start ?? -1;
    assert("it asks who before it writes", first("canAccessJobDeliveries") > 0 && first("canAccessJobDeliveries") < firstWrite);
    assert("  and whether the job is closed", first("closedJobRefusal") > 0 && first("closedJobRefusal") < firstWrite);
    assert("  and the pure refusals", first("correctionRefusal") > 0 && first("correctionRefusal") < firstWrite);
    assert("it reads the stock before its write", first("readShortfallWithout") > 0 && first("readShortfallWithout") < firstWrite);
    const afterRead = first("readBelowZeroAt");
    assert("  and again after it", firstWrite > 0 && afterRead > firstWrite);
    const logRow = callsTo(correct, "createDeliveryLogEntry")[0];
    const backWithin = writes.filter((w) => w.start > afterRead && (!logRow || w.start < logRow.start));
    assert(
        "  and writes the address it left back when that is below zero",
        backWithin.some((w) => /standingAddressId/.test(server.source.slice(w.start, w.end)))
    );
    assert("all of that under one lock on the delivery", writes.filter((w) => !logRow || w.start < logRow.start).every((w) => insideCallTo(correct, w, "withKeyLock")));
    assert("the activity row is written out of the lock, two locks never nested", Boolean(logRow) && !insideCallTo(correct, logRow, "withKeyLock"));
    const logSrc = logRow ? server.source.slice(logRow.start, logRow.end) : "";
    assert("  as an Address corrected row naming both addresses", /DELIVERY_LOG_EVENTS\.ADDRESS_CORRECTED/.test(logSrc) && /formerAddressRecordId/.test(logSrc) && /addressRecordId: chosenAddressId/.test(logSrc));
    assert("  and a failed row takes the address back", writes.some((w) => logRow && w.start > logRow.start));
    const editActions = parseFile("app/deliveries/[deliveryId]/actions.js");
    const correctAction = resolveFunction(editActions.ast, "correctDeliveryAddressAction");
    assert(
        "the action is the correction's, and refreshes a stale page as it refuses",
        Boolean(correctAction) && callsTo(correctAction, "correctDeliveryAddress").length === 1 && callsTo(correctAction, "refresh").length === 1
    );
    const deleting = parseFile("lib/deliveryDelete.js");
    const deleteFn = resolveFunction(deleting.ast, "deleteDeliveryAsUser");
    const logGone = callsTo(deleteFn, "destroyDeliveryLogEntries")[0]?.start ?? -1;
    const parentGone = callsTo(deleteFn, "destroy").map((c) => c.start).at(-1) ?? -1;
    assert("a delete takes the delivery's activity rows before the delivery", logGone > 0 && logGone < parentGone);

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
    // reports. Five distinct states over five inputs.
    const states = new Set(
        [[[]], [[on("po1", "a1")]], [[on("po1", "a1"), on("po2", "a2")]], [[on("po1", null)]], [[on("po1", "a9")], ["a1"]]].map(
            (args) => deliveryAddressDefault(...args).state
        )
    );
    check("the rule reaches five states", states.size, 5);
    assert("the constant holds the control's words", Object.keys(DELIVERY_ADDRESS_COPY).length === 8);
    // Section 8's refusal rule has to answer null as well as every key, or its checks are what a
    // constant reports.
    const j = { id: "j" };
    check(
        "the correction's rule reaches six answers",
        new Set([
            correctionRefusal({ job: j, addresses: [{ id: "x", jobs: ["j"] }, { id: "y", jobs: ["j"] }], standingAddressId: "x", shownAddressId: "x", chosenAddressId: "y" }),
            correctionRefusal({ job: j, addresses: [], chosenAddressId: "" }),
            correctionRefusal({ job: j, addresses: [], chosenAddressId: "z" }),
            correctionRefusal({ job: j, addresses: [{ id: "y", jobs: [] }], standingAddressId: "x", shownAddressId: "w", chosenAddressId: "y" }),
            correctionRefusal({ job: j, addresses: [{ id: "x", jobs: ["j"] }], standingAddressId: "x", shownAddressId: "x", chosenAddressId: "x" }),
            correctionRefusal({ job: j, addresses: [{ id: "y", jobs: [] }], standingAddressId: "x", shownAddressId: "x", chosenAddressId: "y" }),
        ]).size,
        6
    );
    // The lock walk has to be able to say yes and no, or "out of the lock" is what a walk that
    // finds nothing reports.
    const plantedLock = parseSource("async function f() { await withKeyLock(k, async () => { a(); }); b(); }\n", "<planted-lock>");
    const plantedFn = resolveFunction(plantedLock.ast, "f");
    check("the lock walk finds a call inside the lock", insideCallTo(plantedFn, callsTo(plantedFn, "a")[0], "withKeyLock"), true);
    check("  and not one after it", insideCallTo(plantedFn, callsTo(plantedFn, "b")[0], "withKeyLock"), false);
}

if (isMain(import.meta.url)) await standalone(title, run);

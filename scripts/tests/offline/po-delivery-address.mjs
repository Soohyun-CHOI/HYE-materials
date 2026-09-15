// Where an order's material goes (#386).
//
// WHAT THIS FILE HOLDS. Every claim here is about ONE DIRECTION OF READING — the
// order keeps what the request said — and each mutant that breaks it is quiet.
//
//   1. `orderDeliveryAddressId` answers from the request and from nothing else.
//      The mutant is a fallback: `?? job.deliveryAddress[0]` makes every order
//      with no address print the job's, which is the behavior this issue removes
//      and which no screen would report as wrong.
//   2. Generation calls it, and its own source never names a job's address. `job`
//      is in hand there for `Our PIC` and `Our Manager`, so the fallback is one
//      token away and costs no read — which is exactly why it needs an assertion
//      rather than a comment.
//   3. The purchase order PDF resolves the ORDER's link. It resolved the job's
//      until this issue, so a regeneration re-answered the question and editing a
//      job's default address silently changed what an already-sent document said.
//   4. `createPO` OMITS the field when there is no address rather than writing an
//      empty array. Both "work"; the second writes a value the request never had.
//   5. The screen's two strings: the label is `/prs/new`'s own word, pinned by
//      value, and the sentence renders only when there is no address.
//
// WHAT IT CANNOT SEE.
//
//   - Whether anything RENDERS. The address on `/pos/[poId]`, the sentence under
//     it, and the `*Deliver To` block on the generated PDF are all browser work,
//     and all three were walked.
//   - Whether `Purchase Orders."Delivery Address"` exists on the base, or whether
//     `Delivery Address Used` has been deleted. No offline check reads the base in
//     either direction (docs/notes/verification.md);
//     `scripts/import/add_po_delivery_address_386.mjs` is what asks, and
//     `offline/table-field-names.mjs` holds that no reference names the old one.
//   - What an order generated BEFORE #385 holds. That is a fact about 34 rows and
//     not about this code; the script asserts all 34 carry one select value, which
//     is what makes deleting that field lossless.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ADDRESS_CHOICE_COPY } from "../../../lib/addressChoice.js";
import { PO_ADDRESS_COPY, orderDeliveryAddressId } from "../../../lib/poDeliveryAddress.js";
import { parseFile, parseSource, walk, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Where an order's material goes (#386)";

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
 * Does this subtree read `job.deliveryAddress`, however it is spelled?
 *
 * ON THE AST AND NOT ON THE TEXT, and the reason is this file's own subject. Every
 * module it asserts about carries a COMMENT saying what it used to read — that is
 * how a decision survives in this repository — so a text matcher fails on the
 * explanation of the rule it is enforcing. Measured: the first cut of this check
 * did exactly that, twice, on prose written three commits earlier in this issue.
 * `table-field-names.mjs`'s header states the same distinction one axis over — a
 * comment may cite a name, a reference may not.
 *
 * Optional chaining costs nothing here: acorn gives `job?.deliveryAddress` the same
 * `MemberExpression` shape as `job.deliveryAddress`, with the `?.` recorded on the
 * node rather than in the object/property pair.
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

const PR_WITH_ADDRESS = { id: "pr1", deliveryAddress: ["a1"] };
const PR_NO_ADDRESS = { id: "pr2", deliveryAddress: [] };
const PR_BEFORE_THE_FIELD = { id: "pr3" };

export function run({ check, assert, log }) {
    // ── 1: the request is the only source ──────────────────────────────────
    log("the id an order freezes comes from the request and nowhere else:");
    check("a request that named one", orderDeliveryAddressId(PR_WITH_ADDRESS), "a1");
    // Three shapes of "none", because the link arrives as `[]` from the mapper,
    // as `undefined` from anything that projected the field away, and as no
    // request at all from a caller that lost it. All three freeze nothing.
    check("a request that named none", orderDeliveryAddressId(PR_NO_ADDRESS), null);
    check("  one with no array at all", orderDeliveryAddressId(PR_BEFORE_THE_FIELD), null);
    check("  and no request", orderDeliveryAddressId(null), null);
    // THE FUNCTION TAKES NO JOB, which is the rule stated as a signature. A
    // fallback cannot be added without changing the call site too, so the
    // assertion below has something to catch.
    check("it takes one argument", orderDeliveryAddressId.length, 1);

    // ── 2: generation calls it, and never asks the job ─────────────────────
    log("");
    log("generation freezes the request's address and does not fall back:");
    const generation = parseFile("lib/poGeneration.js");
    const generate = resolveFunction(generation.ast, "generatePOForApprovedPR");
    assert("generatePOForApprovedPR exists", Boolean(generate));
    const generateSrc = generation.source.slice(generate.start, generate.end);
    assert("it calls the rule", /orderDeliveryAddressId\(pr\)/.test(generateSrc));
    assert("  and passes it as createPO's address", /deliveryAddressId:\s*orderDeliveryAddressId\(/.test(generateSrc));
    // THE MUTANT THIS EXISTS FOR. `job` is loaded in this function already, so
    // `?? job?.deliveryAddress?.[0]` costs no read and looks like a repair. It is
    // the pre-#385 behavior, and an order would then follow a job its requester
    // never named — under a vendor who has the PDF.
    assert("  and never reads the job's own address", !readsMember(generate, "job", "deliveryAddress"));
    // The job IS loaded here, so the assertion above is about a reachable mistake
    // rather than about a variable that is not in scope.
    assert("  though the job is in hand for the two contacts", /getJobByRecordId\(/.test(generateSrc));

    // ── 3: the document reads the order's link ─────────────────────────────
    log("");
    log("the purchase order PDF resolves the order's own address:");
    const pdf = parseFile("lib/poPdf.js");
    const generateAndAttach = resolveFunction(pdf.ast, "generateAndAttachPOPdf");
    assert("generateAndAttachPOPdf exists", Boolean(generateAndAttach));
    const pdfSrc = pdf.source.slice(generateAndAttach.start, generateAndAttach.end);
    assert("it resolves po.deliveryAddress", readsMember(generateAndAttach, "po", "deliveryAddress"));
    // What it did until this issue, and the reason it is an assertion rather than
    // a note: the document is regenerable, so a job edit would move a ship-to a
    // vendor had already been emailed.
    assert("  and not the job's", !readsMember(generateAndAttach, "job", "deliveryAddress"));
    // The job is still loaded for `PJT`, so again the mutant is in scope.
    assert("  though the job is still loaded for the project name", /getJobByRecordId\(/.test(pdfSrc));
    // ONE READ EITHER WAY. The whole change is which id is handed to the same
    // function, which is what makes the operation count unchanged — asserted so a
    // later edit that adds a second address read has to say so.
    const addressReads = (pdfSrc.match(/getAddressByRecordId\(/g) || []).length;
    check("two address reads, the delivery one and the vendor's", addressReads, 2);

    // ── 4: no address writes no field ──────────────────────────────────────
    log("");
    log("an order with no address writes no value rather than an empty one:");
    const orders = parseFile("lib/airtable/purchaseOrders.js");
    const create = resolveFunction(orders.ast, "createPO");
    assert("createPO exists", Boolean(create));
    const createSrc = orders.source.slice(create.start, create.end);
    assert(
        "the field is spread in only when there is an id",
        /\.\.\.\(deliveryAddressId\s*\?\s*\{\s*"Delivery Address":\s*\[deliveryAddressId\]\s*\}\s*:\s*\{\}\)/.test(
            createSrc
        )
    );
    // The two link parameters beside it DO write `[]`, and that difference is the
    // point rather than an inconsistency: those clear a value the caller is
    // authoritative about, and this one is a value the request never had.
    assert("  unlike the two contacts, which write an empty array", /ourPicId\s*\?\s*\[ourPicId\]\s*:\s*\[\]/.test(createSrc));
    // AND THE SELECT IS NOT ADDRESSED ANY MORE. A leftover would 422 the create the
    // moment the field is deleted by hand, which is a hand step this repository
    // deliberately allows to lag its own commit. On the AST, so the comment in
    // `recordToPO` that says what the field used to be does not fail its own rule.
    assert("the retired select is addressed nowhere here", !namesLiteral(orders.ast, "Delivery Address Used"));
    assert("  nor at generation", !namesLiteral(generation.ast, "Delivery Address Used"));
    // AND NOTHING READS THE OLD MAPPER KEY EITHER. `deliveryAddressUsed` was on
    // `recordToPO` and on `createPO`'s parameter list, and a caller still passing it
    // would be silently ignored by the object spread rather than failing.
    let usesOldKey = false;
    for (const parsed of [orders, generation]) {
        walk(parsed.ast, (n) => {
            if (n.type === "Identifier" && n.name === "deliveryAddressUsed") usesOldKey = true;
        });
    }
    check("nor the identifier it travelled under", usesOldKey, false);

    // ── 5: the two words the screen says ───────────────────────────────────
    log("");
    log("the screen's words, and where they come from:");
    // ONE WORD FOR ONE THING ACROSS TWO SCREENS, pinned by VALUE rather than by
    // import. `/prs/new` owns the picking rule and this screen owns a frozen copy,
    // so a shared module for one string would make the order's page depend on the
    // form's; what matters is that the two never diverge, and this fails if either
    // is reworded alone.
    check("the label is the word /prs/new uses", PO_ADDRESS_COPY.label, ADDRESS_CHOICE_COPY.label);
    const page = parseFile("app/pos/[poId]/page.js");
    const read = memberKeys(page, "PO_ADDRESS_COPY");
    const unread = Object.keys(PO_ADDRESS_COPY).filter((k) => !read.has(k));
    check(
        `every key is read by the screen${unread.length ? ` (${unread.join(", ")})` : ""}`,
        unread.length,
        0
    );
    // THE SENTENCE IS CONDITIONAL AND THE VALUE IS NOT. An order with an address
    // must not be told its document shows none, and an order without one must
    // still render the block's em dash — the same `|| "—"` every line there uses.
    assert(
        "the sentence renders only when there is no address",
        /\{!deliveryAddress && \(/.test(page.source)
    );
    assert(
        "  and the value line renders the label with an em dash fallback",
        /PO_ADDRESS_COPY\.label\}: \{deliveryAddress\?\.addressLabel \|\| "—"\}/.test(page.source)
    );
    // It is the LABEL and not the formatted address, which is what `/prs/[prId]`
    // renders for the same link. The PDF is the one surface that prints the street.
    assert("the page renders the label", /deliveryAddress\?\.addressLabel/.test(page.source));
    assert("  and not the formatted address", !/deliveryAddress\?\.formattedAddress/.test(page.source));
    // NO KEY MAY START WITH `use` — a lint rule rather than a wording one, since
    // `COPY.useX()` in a component reads as a conditional HOOK call to
    // `react-hooks/rules-of-hooks`. See docs/notes/naming.md.
    const hookish = Object.keys(PO_ADDRESS_COPY).filter((k) => /^use[A-Z]/.test(k));
    check(`no copy key reads as a React hook${hookish.length ? ` (${hookish.join(", ")})` : ""}`, hookish.length, 0);
    // The sentence says what the dash cannot rather than restating it — the half
    // that can be mechanized is that it names the document and the act.
    assert("the sentence names the document", /purchase order PDF/.test(PO_ADDRESS_COPY.none));
    assert("  and what to do instead", /vendor/.test(PO_ADDRESS_COPY.none));

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — every matcher is seen to be able to say no:");
    // Sections 2 and 3 rest on one walk saying no. If it cannot say YES, both
    // `and never reads the job's own address` assertions are vacuous and the
    // fallback they exist to catch would ship green.
    const plantedFallback = parseSource(
        "const id = orderDeliveryAddressId(pr) ?? job?.deliveryAddress?.[0];\n",
        "<planted-fallback>"
    );
    assert("the job-address walk finds the fallback exactly", readsMember(plantedFallback.ast, "job", "deliveryAddress"));
    const plantedPlain = parseSource("const a = job.deliveryAddress[0];\n", "<planted-plain>");
    assert("  and a plain read of the same pair", readsMember(plantedPlain.ast, "job", "deliveryAddress"));
    // And says no to the order's and the request's, or every assertion above fails
    // for the wrong reason and the source would have to be rewritten to pass.
    check(
        "  but not the order's",
        readsMember(parseSource("const a = po.deliveryAddress?.[0];\n", "<planted-po>").ast, "job", "deliveryAddress"),
        false
    );
    check(
        "  nor the request's",
        readsMember(parseSource("const a = pr?.deliveryAddress?.[0];\n", "<planted-pr>").ast, "job", "deliveryAddress"),
        false
    );
    // And the literal walk, which is what holds the retired field name.
    assert(
        "the literal walk finds a planted field name",
        namesLiteral(parseSource('const f = "Delivery Address Used";\n', "<planted-field>").ast, "Delivery Address Used")
    );
    check(
        "  and does not match the live one",
        namesLiteral(parseSource('const f = "Delivery Address";\n', "<planted-live>").ast, "Delivery Address Used"),
        false
    );
    // The key reader has to find keys, or section 5's inventory passes for a file
    // it failed to parse.
    const planted = parseSource(
        "const A = () => <p>{PO_ADDRESS_COPY.label}</p>;\n",
        "<planted-keys>"
    );
    check("a member expression is seen", [...memberKeys(planted, "PO_ADDRESS_COPY")].join(), "label");
    check("  and a key nothing reads is not invented", memberKeys(planted, "PO_ADDRESS_COPY").has("none"), false);
    // And the rule has to answer both ways, or section 1 is what a constant reports.
    assert(
        "the rule answers both ways",
        orderDeliveryAddressId(PR_WITH_ADDRESS) !== orderDeliveryAddressId(PR_NO_ADDRESS)
    );
    // The constant is carrying a screen rather than being an empty object every
    // clause above passes against.
    assert("the constant holds both strings", Object.keys(PO_ADDRESS_COPY).length === 2);
}

if (isMain(import.meta.url)) await standalone(title, run);

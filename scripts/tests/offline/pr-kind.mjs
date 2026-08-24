// What kind of request this is, and the mark that says so (#272).
//
// THE SILENT MUTANT THIS EXISTS FOR: a deriver that answers the same kind for
// every request. Make `prKind` always return `ordinary` and no chip appears
// anywhere — which is exactly what the screen looks like on the ordinary day, so
// nothing about it reads as broken. Make it always return one of the other two and
// every row carries one word, which reads as a design decision rather than a bug.
// No page fails, no test of anything else notices, and the signer this issue
// exists for is back to reading `Notes`.
//
// SO THE FIRST ASSERTION IS THAT THE THREE INPUTS PRODUCE THREE DIFFERENT ANSWERS,
// before any per-kind detail. It is the same shape #237's always-agree, #241's
// always-silent and #242's removed narrowing each needed, and the same shape
// `pr-wait.mjs` opens with one module over.
//
// The kind is read from two reverse-links and stored nowhere, so these fixtures
// are the whole input: a request carrying `Overage Delivery Items`, one carrying
// `Direct Purchases`, and one carrying neither.

import { PR_KIND, PR_KIND_COPY, prKind } from "../../../lib/prKind.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A request's kind — three decisions, two links, no field (#272)";

const ordinary = { prId: "HYE-PR-260824-01" };
const overage = { prId: "HYE-PR-260824-02", overageDeliveryItemRowIds: ["recDI1"] };
const direct = { prId: "HYE-PR-260824-03", directPurchaseRowIds: ["recDP1"] };
const both = {
    prId: "HYE-PR-260824-04",
    overageDeliveryItemRowIds: ["recDI1"],
    directPurchaseRowIds: ["recDP1"],
};

export function run({ check, assert, log }) {
    // ── the mutant, first ───────────────────────────────────────────────────
    log("three inputs, three kinds — a deriver that always answers the same is the defect:");
    const answers = [prKind(ordinary), prKind(overage), prKind(direct)];
    assert("the three answers are distinct", new Set(answers).size === 3);
    assert(
        "  and none of them is a constant the others share",
        answers.every((a, i) => answers.every((b, j) => i === j || a !== b))
    );
    check("nothing linked", prKind(ordinary), PR_KIND.ordinary);
    check("an over-delivery points at it", prKind(overage), PR_KIND.overage);
    check("a direct purchase points at it", prKind(direct), PR_KIND.directPurchase);

    // ── precedence ──────────────────────────────────────────────────────────
    log("");
    log("both links at once — unreachable, and pinned anyway:");
    // Each kind is created by one action from one record, so this cannot arise
    // through the app. It is pinned because "cannot happen" is not a reason to
    // leave the answer to the order two clauses happen to be written in.
    check("the overage link wins", prKind(both), PR_KIND.overage);
    assert(
        "  which is not merely the first property of the object",
        prKind({ directPurchaseRowIds: ["recDP1"], overageDeliveryItemRowIds: ["recDI1"] }) ===
            PR_KIND.overage
    );

    // ── shape robustness ────────────────────────────────────────────────────
    log("");
    log("an empty array is not a link:");
    check("empty overage array", prKind({ overageDeliveryItemRowIds: [] }), PR_KIND.ordinary);
    check("empty direct array", prKind({ directPurchaseRowIds: [] }), PR_KIND.ordinary);
    check("a request with no arrays at all", prKind({}), PR_KIND.ordinary);
    check("null does not throw", prKind(null), PR_KIND.ordinary);
    check("undefined does not throw", prKind(undefined), PR_KIND.ordinary);

    // ── the chip ────────────────────────────────────────────────────────────
    log("");
    log("the mark, and the silence that is also an answer:");
    check("ordinary carries none", PR_KIND_COPY.chip[PR_KIND.ordinary], null);
    check("the overage kind", PR_KIND_COPY.chip[PR_KIND.overage], "Overage");
    check("the direct-purchase kind", PR_KIND_COPY.chip[PR_KIND.directPurchase], "Direct purchase");
    // The other half of the mutant: a chip set whose values collapse into one word
    // renders on every exceptional row and says nothing.
    const chips = Object.values(PR_KIND_COPY.chip).filter(Boolean);
    check("two words, not one repeated", new Set(chips).size, chips.length);
    assert("and neither is empty", chips.every((c) => c.trim().length > 0));
    // #227/#269's vocabulary, on a set that is new: neither word may borrow a noun a
    // table already owns, and `correction` is barred outright (#272's own sweep).
    assert(
        "no chip says correction",
        chips.every((c) => !/correct/i.test(c))
    );
    assert(
        "no chip calls a row a line",
        chips.every((c) => !/\blines?\b/i.test(c))
    );

    // ── the signer's sentence ───────────────────────────────────────────────
    log("");
    log("what a signer reads on the request itself:");
    const sentence = PR_KIND_COPY.signer[PR_KIND.directPurchase]({
        vendorName: "Lone Star Pipe & Supply",
        vendorInvoiceCode: "INV-4471",
    }).text;
    assert("it names the vendor", sentence.includes("Lone Star Pipe & Supply"));
    assert("  and the vendor's own document", sentence.includes("INV-4471"));
    // The reason this issue exists: the decision differs, so the sentence has to say
    // what approving means rather than merely labeling the request.
    assert("  and says what approving it means", /accepts a purchase already made/.test(sentence));
    const bare = PR_KIND_COPY.signer[PR_KIND.directPurchase]({}).text;
    assert("it still reads with no facts at all", bare.length > 40 && !bare.includes("undefined"));
    assert("  and drops the clause it cannot fill", !bare.includes("is the vendor's own invoice"));

    // THE OVERAGE KIND HAS NO SENTENCE, AND THAT IS THE DECISION. #167's banner is
    // already on that page and says more than a kind sentence could; a second one
    // would be two voices for one fact. Asserted so that adding one is a deliberate
    // act rather than a tidy-looking symmetry.
    check("the overage kind has none", PR_KIND_COPY.signer[PR_KIND.overage], undefined);
    check("nor does the ordinary kind", PR_KIND_COPY.signer[PR_KIND.ordinary], undefined);

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the fixtures really carry what the rule reads:");
    assert("the overage fixture has a link", overage.overageDeliveryItemRowIds.length === 1);
    assert("the direct fixture has one", direct.directPurchaseRowIds.length === 1);
    assert("the ordinary fixture has neither", !ordinary.overageDeliveryItemRowIds && !ordinary.directPurchaseRowIds);
    // And the rule is reading THOSE fields rather than anything else on the record:
    // renaming either key in the mapper must change the answer, which is what this
    // says without reaching into lib/airtable/.
    check(
        "a link under any other name is not a kind",
        prKind({ someOtherLink: ["recX"], overagePRRecordId: "recY" }),
        PR_KIND.ordinary
    );
}

if (isMain(import.meta.url)) standalone(title, run);

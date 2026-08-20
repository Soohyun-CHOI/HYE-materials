// The two invoice variance kinds are two words (#179).
//
// THE QUIET MUTANT IS ONE WORD FOR BOTH, and it is asserted first. That is not a
// hypothetical: it is the state this issue found, where the list said `⚠ Variance`
// for the header flag and the detail's items table said the same for the item flag,
// so one word meant one thing on the row a reader clicked and another on the page
// they landed on. Setting the two constants back to one value restores it exactly,
// every screen still renders, and nothing else in this repository would notice —
// the station #237's `always agree`, #242's removed narrowing, #241's always-silent
// list and #238's unfolded table stand at.
//
// THE SECOND FAILURE IS SLOWER AND IS CHECKED ON THE SOURCE: a call site going back
// to a literal. One page renders the constant and another types the old string, and
// the two drift apart again without either being wrong on its own. So no file under
// `app/` may contain the retired words at all — the same scan-and-no-exemptions
// shape `us-english.mjs` and `product-name.mjs` use, and for the same reason.
//
// `Mismatch` IS THE DELIVERY AXIS'S AND IS BARRED HERE. #232 made it a chip value
// for an invoice against the delivery matched to it, on these same two screens; taking
// it for a variance would put one word on two axes of one page, which is this
// issue's own defect pointed the other way.

import { readFileSync } from "node:fs";
import { VARIANCE_COPY, checkHeaderVariance, checkUnitPriceVariance } from "../../../lib/variance.js";
import { listJsFiles, repoPath, toPosix } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The two invoice variance kinds are two words (#179)";

/** The words this issue retired. Neither may survive under `app/`. */
const RETIRED = ["⚠ Variance", "Header Variance", "has variance flags"];

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("THE QUIET MUTANT — one word for both kinds is the screen #179 found:");
    const oneWord = { ...VARIANCE_COPY, item: "⚠ Variance", header: "⚠ Variance" };
    assert("the two kinds are two different words", VARIANCE_COPY.item !== VARIANCE_COPY.header);
    assert(
        "  so the one-word mutant disagrees with the rule",
        oneWord.item === oneWord.header && VARIANCE_COPY.item !== VARIANCE_COPY.header
    );
    assert(
        "  and neither is a prefix of the other, which would read as one word qualified",
        !VARIANCE_COPY.item.includes(VARIANCE_COPY.header) &&
            !VARIANCE_COPY.header.includes(VARIANCE_COPY.item)
    );
    check("the charge kind names what it was compared against", VARIANCE_COPY.item, "⚠ Order variance");
    check("the document kind asks for the check it is", VARIANCE_COPY.header, "⚠ Check the total");

    // -----------------------------------------------------------------------
    log("");
    log("the two grammars, which are the distinction rather than decoration:");
    // A state names a thing; an instruction starts with a verb. The header kind is an
    // internal arithmetic check and asks for a second look; the item kind is an
    // external fact that stays true until somebody takes it up with the vendor.
    assert(
        "the document kind reads as an instruction",
        /^⚠ (Check|Recheck|Double-check)\b/.test(VARIANCE_COPY.header)
    );
    assert(
        "the charge kind reads as a state, not an instruction",
        !/^⚠ (Check|Recheck|Double-check|Review|Look)\b/.test(VARIANCE_COPY.item)
    );
    // Both predicates compare an ABSOLUTE difference, so neither word may claim a
    // direction — `Over-billed` was the first draft of the item one and would have
    // been false half the time it appeared.
    assert(
        "the predicates are both two-sided",
        checkHeaderVariance(80, 100) && checkHeaderVariance(120, 100) &&
            checkUnitPriceVariance(9, 10) && checkUnitPriceVariance(11, 10)
    );
    for (const word of ["over", "under", "more", "less", "short"]) {
        assert(
            `  so neither word says "${word}"`,
            ![VARIANCE_COPY.item, VARIANCE_COPY.header].some((w) =>
                new RegExp(`\\b${word}`, "i").test(w)
            )
        );
    }

    // -----------------------------------------------------------------------
    log("");
    log("`Mismatch` stays the delivery axis's (#232):");
    const everyString = [
        VARIANCE_COPY.item,
        VARIANCE_COPY.header,
        VARIANCE_COPY.headerDetail("$1.00", "$2.00"),
        VARIANCE_COPY.itemPrompt().text,
    ];
    assert(
        "no variance copy takes that word",
        !everyString.some((t) => /mismatch/i.test(t))
    );
    assert("every builder returns something to render", everyString.every((t) => t && t.length > 0));

    // -----------------------------------------------------------------------
    log("");
    log("the sentence and the badge cannot drift apart:");
    const detail = VARIANCE_COPY.headerDetail("$17,576.24", "$18,596.84");
    assert("the detail sentence leads with the badge's own label", detail.startsWith(VARIANCE_COPY.header));
    assert("  and states both figures", detail.includes("$17,576.24") && detail.includes("$18,596.84"));
    assert("  naming which is the vendor's and which is ours", /Amount Due/.test(detail) && /Calculated Total/.test(detail));

    // -----------------------------------------------------------------------
    log("");
    log("the invoice-level prompt is the item kind's voice:");
    const prompt = VARIANCE_COPY.itemPrompt().text;
    check("its key is stable for a call site", VARIANCE_COPY.itemPrompt().key, "order-variance-prompt");
    assert("it names the order, which is the kind it speaks for", /order/i.test(prompt));
    assert(
        "  it does not name the total, which the red box states with figures",
        !/calculated total|amount due/i.test(prompt)
    );
    // #211 lifted this out of the Payment section, so most of its readers cannot pay.
    // The action has to be one they can take, with payment as the deadline rather
    // than the act — #232's grammar in the amber box further up the same page.
    assert("it asks for something any reader can do", /check it against the order/i.test(prompt));
    assert(
        "  and payment is when, not what",
        /before this invoice is paid/i.test(prompt) && !/confirming payment/i.test(prompt)
    );

    // -----------------------------------------------------------------------
    log("");
    log("no screen types either word for itself:");
    let scanned = 0;
    const offenders = [];
    for (const file of listJsFiles(repoPath("app"))) {
        const rel = toPosix(file).split("/materials/").pop();
        const source = readFileSync(file, "utf8");
        scanned++;
        // A COMMENT MAY CITE A RETIRED WORD — that is how this repository records
        // what a change replaced, and #232's own layout comments quote the old badge
        // by name. So the scan reads what is left after comments are removed, block
        // and line alike. A per-item test was tried first and could not see the
        // inside of a `{/* … */}` block, which is the shape those citations take.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        for (const word of RETIRED) {
            if (code.includes(word)) offenders.push(`${rel}: ${word}`);
        }
    }
    assert(`scanned ${scanned} files under app/`, scanned > 20);
    check("nothing renders a retired variance word", offenders.join(" | "), "");
    // ANTI-VACUITY: the scan must be able to see a word that IS there, or "no
    // offenders" is just what this loop always says.
    const canSee = listJsFiles(repoPath("app")).some((file) =>
        readFileSync(file, "utf8").includes("VARIANCE_COPY")
    );
    assert("and the scan reads files that really do name the constant", canSee);
}

if (isMain(import.meta.url)) standalone(title, run);

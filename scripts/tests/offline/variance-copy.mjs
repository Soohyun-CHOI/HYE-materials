// An invoice's variances are three names, and its totals one pair (#179, #623, #640).
//
// THE QUIET MUTANT IS ONE WORD FOR TWO KINDS, and it is asserted first. That is not a
// hypothetical: it is the state #179 found, where the list said `⚠ Variance` for the
// header flag and the detail's items table said the same for the item flag, so one
// word meant one thing on the row a reader clicked and another on the page they
// landed on. Setting two constants back to one value restores it exactly, every
// screen still renders, and nothing else in this repository would notice.
//
// THREE SINCE #640, IN THE THREE-WAY MATCH'S WORDS: `⚠ Price variance` and
// `⚠ Quantity variance` for an item against its order, and `⚠ Totals differ` for the
// invoice against itself, with `Totals agree` when the comparison passes. #623 named a
// fourth, `Delivery variance` — the invoice against the one delivery
// `Invoices."Delivery"` named — and #640 retired it with the pairing: compared
// cumulatively, less delivered than invoiced is a wait (`Awaiting delivery`), and the
// word is barred below so it cannot come back. The two variances are one noun with a
// qualifier each, so the property held here is that they do not share one; the totals
// pair shares its subject and differs in the verb. #179 had named the item kind
// `⚠ Order variance` over a flag that held either cause, and the totals kind
// `⚠ Check the total`, an instruction.
//
// THE SECOND FAILURE IS SLOWER AND IS CHECKED ON THE SOURCE: a call site going back
// to a literal, or to a word since retired. So no file under `app/` or `lib/` may
// contain a retired word outside a comment — the same scan-and-no-exemptions shape
// `us-english.mjs` and `product-name.mjs` use, and for the same reason.

import { readFileSync } from "node:fs";
import { VARIANCE_COPY, checkTotalsDiffer, checkPriceVariance, checkQuantityVariance } from "../../../lib/variance.js";
import { STATUS_COPY } from "../../../lib/deliveryStatus.js";
import { callPassesProperty, callsTo, listJsFiles, parseFile, repoPath, resolveFunction, toPosix } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An invoice's variances are three names, and its totals one pair (#179, #623, #640)";

/**
 * The words retired from the screens, as what a screen string would hold. `Mismatch`
 * is matched as a quoted or element-text string, never as a substring, since
 * `totalsMismatch` and `stepMismatch` are identifiers rather than words a reader meets;
 * the rest carry a space, which no identifier does.
 */
const RETIRED = [
    { word: "⚠ Variance", test: (code) => code.includes("⚠ Variance") },
    { word: "Header Variance", test: (code) => code.includes("Header Variance") },
    { word: "has variance flags", test: (code) => code.includes("has variance flags") },
    { word: "Check the total", test: (code) => code.includes("Check the total") },
    { word: "Mismatch", test: (code) => /["'`>]\s*Mismatch\b/.test(code) },
    { word: "Order variance", test: (code) => /Order variance/i.test(code) },
    { word: "Total variance", test: (code) => /Total variance/i.test(code) },
    { word: "Stated Total", test: (code) => /Stated Total/i.test(code) },
    { word: "Amount due", test: (code) => /Amount due/i.test(code) },
    // #640 — the invoice against one delivery, word and key, retired with the pairing.
    { word: "Delivery variance", test: (code) => /Delivery variance/i.test(code) },
    { word: "delivery-variance", test: (code) => code.includes("delivery-variance") },
];

/** A file's code with its comments, block and line, taken out. */
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Which retired words a source holds outside its comments. */
const retiredIn = (source) => {
    const code = withoutComments(source);
    return RETIRED.filter((r) => r.test(code)).map((r) => r.word);
};

export function run({ check, assert, log }) {
    const price = VARIANCE_COPY.price;
    const quantity = VARIANCE_COPY.quantity;
    const differ = VARIANCE_COPY.totalsDiffer;
    const agree = VARIANCE_COPY.totalsAgree;
    const variances = [price, quantity];
    const all = [price, quantity, differ, agree];

    // -----------------------------------------------------------------------
    log("THE QUIET MUTANT — one word for two kinds is the screen #179 found:");
    const oneWord = { ...VARIANCE_COPY, price: "⚠ Variance", totalsDiffer: "⚠ Variance" };
    assert("the item's two badges are two different words", price !== quantity);
    assert(
        "  so the one-word mutant disagrees with the rule",
        oneWord.price === oneWord.totalsDiffer && price !== differ
    );
    check("  and the four words are four", new Set(all).size, 4);
    assert(
        "  and none is a prefix of another, which would read as one word qualified",
        all.every((a) => all.every((b) => a === b || !b.includes(a)))
    );

    // -----------------------------------------------------------------------
    log("");
    log("the three-way match's names (#623):");
    check("an item's unit price against its order's", price, "⚠ Price variance");
    check("what an ordered item has been invoiced against what it ordered", quantity, "⚠ Quantity variance");
    // #640 — the invoice's delivery chip is no variance: two values, a match and a wait.
    check(
        "the invoice's delivery chip names no variance",
        Object.values(STATUS_COPY.column.invoice)
            .map((build) => build().text)
            .join(", "),
        "Matched, Awaiting delivery"
    );
    check("the invoice's own two totals, apart", differ, "⚠ Totals differ");
    check("  and together", agree, "Totals agree");
    // ONE NOUN AND A QUALIFIER EACH for the three variances. The qualifier is the whole
    // distinction, so two kinds sharing one would be one word on two facts again.
    const qualifier = (word) => /^(?:⚠ )?(\w+) variance$/.exec(word)?.[1] ?? null;
    assert("each variance is its qualifier and the noun `variance`", variances.every((w) => qualifier(w) !== null));
    check("  and the two do not share a qualifier", new Set(variances.map(qualifier)).size, 2);
    // THE TOTALS PAIR IS ONE SUBJECT AND TWO VERBS, and only the one that asks for a look
    // carries the look-at-this glyph.
    assert("the two totals words share their subject", /^(?:⚠ )?Totals /.test(differ) && /^Totals /.test(agree));
    assert("  and only the disagreement carries the glyph", differ.startsWith("⚠") && !agree.includes("⚠"));
    for (const [kind, word] of [["price", price], ["quantity", quantity], ["totals", differ]]) {
        assert(
            `the ${kind} word reads as a state, not an instruction`,
            !/^(?:⚠ )?(Check|Recheck|Double-check|Review|Look)\b/.test(word)
        );
    }
    // The price and totals predicates compare an ABSOLUTE difference, so no word may
    // claim a direction — `Over-billed` was the first draft of the item word and would
    // have been false half the time it appeared.
    assert(
        "the price and totals predicates are both two-sided",
        checkTotalsDiffer(80, 100) && checkTotalsDiffer(120, 100) &&
            checkPriceVariance(9, 10) && checkPriceVariance(11, 10)
    );
    assert(
        "  and the quantity one fires past what was ordered and not at it",
        checkQuantityVariance(11, 10) && !checkQuantityVariance(10, 10) && !checkQuantityVariance(9, 10)
    );
    for (const word of ["over", "under", "more", "less", "short"]) {
        assert(`  so no word says "${word}"`, !all.some((w) => new RegExp(`\\b${word}`, "i").test(w)));
    }

    // -----------------------------------------------------------------------
    log("");
    log("every writer judges an item's two variances apart and writes both (#623):");
    // THE QUIET MUTANT OF THE SPLIT IS THE JOIN COMING BACK. One flag set on
    // `price || quantity` renders, passes every word above and stores a price variance
    // for a row that only went over — the state #623 recomputed the test base out of.
    // Three writers set the flags, and each is held to both predicates and both fields.
    const WRITERS = [
        ["the create action", "app/invoices/new/actions.js", "createInvoiceAction"],
        ["the edit action", "app/invoices/[invoiceId]/actions.js", "updateInvoiceAction"],
        ["an overage's split", "lib/overage.server.js", "recomputeInvoiceItemVariance"],
    ];
    for (const [who, file, name] of WRITERS) {
        const fn = resolveFunction(parseFile(file).ast, name);
        assert(`${who} resolves`, Boolean(fn));
        if (!fn) continue;
        assert(`  ${who} asks the price predicate`, callsTo(fn, "checkPriceVariance").length > 0);
        assert(`  ${who} asks the quantity predicate`, callsTo(fn, "checkQuantityVariance").length > 0);
        const writes = callsTo(fn, "updateInvoiceItem").filter(
            (c) => callPassesProperty(c, "hasPriceVariance") || callPassesProperty(c, "hasQuantityVariance")
        );
        assert(
            `  and every write of a flag ${who} makes carries both`,
            writes.length > 0 &&
                writes.every((c) => callPassesProperty(c, "hasPriceVariance") && callPassesProperty(c, "hasQuantityVariance"))
        );
    }

    // -----------------------------------------------------------------------
    log("");
    log("the retired words are gone from the copy:");
    const everyString = [
        ...all,
        VARIANCE_COPY.totalsDetail("$1.00", "$2.00"),
        VARIANCE_COPY.totalsBeforeSaving("1.00", "2.00"),
        VARIANCE_COPY.itemPrompt().text,
        ...Object.values(STATUS_COPY.column.invoice).map((f) => f().text),
    ];
    check(
        "no variance copy or invoice chip says one",
        everyString.filter((t) => RETIRED.some((r) => r.test(JSON.stringify(t)))).join(" | "),
        ""
    );
    assert("every builder returns something to render", everyString.every((t) => t && t.length > 0));

    // -----------------------------------------------------------------------
    log("");
    log("the sentences and the badge cannot drift apart:");
    const detail = VARIANCE_COPY.totalsDetail("$17,576.24", "$18,596.84");
    assert("the detail sentence leads with the badge's own label", detail.startsWith(differ));
    assert("  and states both figures", detail.includes("$17,576.24") && detail.includes("$18,596.84"));
    assert("  naming which is the vendor's and which is ours", /Invoice Total/.test(detail) && /Calculated Total/.test(detail));
    const typing = VARIANCE_COPY.totalsBeforeSaving("670.00", "660.00");
    assert("the form's sentence leads with the same label", typing.startsWith(differ));
    assert("  names the figure as its field is labeled", /Invoice Total \(670\.00\)/.test(typing));
    assert("  and still addresses the person typing", /before submitting/.test(typing));

    // -----------------------------------------------------------------------
    log("");
    log("the invoice-level prompt is the items' voice:");
    const prompt = VARIANCE_COPY.itemPrompt().text;
    check("its key is stable for a call site", VARIANCE_COPY.itemPrompt().key, "item-variance-prompt");
    assert("it names the order, which both item kinds are compared against", /order/i.test(prompt));
    assert(
        "  it does not name the totals, which the red box states with figures",
        !/calculated total|invoice total/i.test(prompt)
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
    log("no screen types a retired word for itself:");
    let scanned = 0;
    let scannedLib = 0;
    const offenders = [];
    for (const file of [...listJsFiles(repoPath("app")), ...listJsFiles(repoPath("lib"))]) {
        const rel = toPosix(file).split("/").slice(-3).join("/");
        scanned++;
        if (toPosix(file).startsWith(toPosix(repoPath("lib")))) scannedLib++;
        // A COMMENT MAY CITE A RETIRED WORD — that is how this repository records
        // what a change replaced, and #232's own layout comments quote the old badge
        // by name. So the scan reads what is left after comments are removed, block
        // and line alike. A per-item test was tried first and could not see the
        // inside of a `{/* … */}` block, which is the shape those citations take.
        for (const word of retiredIn(readFileSync(file, "utf8"))) offenders.push(`${rel}: ${word}`);
    }
    // `lib/` is where most of the words live, so the scan has to be seen reaching it.
    assert("scanned the files under app/ and lib/", scanned - scannedLib > 100 && scannedLib > 50);
    check("nothing renders a retired variance word", offenders.join(" | "), "");
    // ANTI-VACUITY: the scan must be able to see a word that IS there, or "no
    // offenders" is just what this loop always says — and must not see an identifier
    // or a comment, or the exemptions it refuses would be needed after all.
    check("  it sees a retired chip word in a string", retiredIn('const chip = "Mismatch";').join(","), "Mismatch");
    check("  and in element text", retiredIn("<span>Mismatch</span>").join(","), "Mismatch");
    check("  and the retired instruction", retiredIn('const b = "⚠ Check the total";').join(","), "Check the total");
    check("  and the joined item word", retiredIn('const b = "⚠ Order variance";').join(","), "Order variance");
    check("  and the old label for the vendor's figure", retiredIn("<label>Amount Due</label>").join(","), "Amount due");
    check("  but not an identifier that holds the letters", retiredIn("const totalsMismatch = a !== b;").join(","), "");
    check("  nor a comment citing the word", retiredIn("// the chip said `Mismatch` until #623\nconst x = 1;").join(","), "");
    const canSee = listJsFiles(repoPath("app")).some((file) => readFileSync(file, "utf8").includes("VARIANCE_COPY"));
    assert("and the scan reads files that really do name the constant", canSee);
}

if (isMain(import.meta.url)) standalone(title, run);

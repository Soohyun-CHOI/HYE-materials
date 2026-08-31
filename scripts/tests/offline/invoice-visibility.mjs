// Employee access to the invoice routes (#211), and payment open to every reader of
// the row (#309) — source shape, on the AST.
//
// WHY THIS TIER CANNOT IMPORT THE MODULE IT IS ABOUT. lib/invoiceVisibility.js
// reaches lib/airtable/*, which throws `Missing AIRTABLE_API_KEY` at module load,
// so the offline tier can neither call `getVisibleInvoiceIds` nor read
// `seesEveryInvoice`. What it can do is read the source, and the things worth
// pinning here are structural anyway:
//
//   1  THE RULE IS NOT REIMPLEMENTED. The judgment is canViewPR and must stay
//      canViewPR. A second predicate in the new module would be a second answer to
//      one question, and nothing behavioral would notice for as long as the two
//      happened to agree — which is exactly the shape CLAUDE.md's "one rule, one
//      implementation" records this repo being bitten by twice.
//   2  READING PAYMENT AND RECORDING IT ASK DIFFERENT QUESTIONS. #211 had no need to
//      tell them apart: one answer stood behind both, so `seesEveryInvoice` decided
//      whether the payment line rendered as well as whether the walk could be
//      skipped. #309 opened the read and left the write where it was, and the two are
//      now one nesting apart on `/invoices/[invoiceId]` — an ungated section with
//      `user.isAdmin` inside it. THAT IS THE QUIET MUTANT THIS FILE EXISTS FOR:
//      collapse them back into one condition and the read gate and the write gate are
//      one expression again, so opening the read opens the control, and every other
//      check in the tier still passes. Assertion 3 is the answer — a privilege-tested
//      branch may not carry the payment fact on ONE side only.
//   3  THE PAYMENT SURFACE IS ENUMERABLE. A reader of `.paid` is one grep away from
//      being found and zero warnings away from being added, so the set of files
//      allowed to read it is listed here and a new one fails until it is registered.
//      That is #147's enumerated-inventory shape and #201's scoped-ban shape: the
//      check does not judge the new reader, it forces someone to. **It is a list of
//      FILES, so on its own it cannot see one file left gated** — which is exactly
//      what `/pos/[poId]` was, holding an inline `seesPayment` that no sweep over
//      `seesEveryInvoice` call sites would have reached. Assertion 3 runs per payment
//      READ rather than per file, which is what finds it.
//
// WHAT A PASS DOES NOT PROVE. That a refusal actually refuses. Source shape is not
// execution — a gate inside `if (false)` satisfies every assertion below. Whether a
// non-privileged session is admitted to the right invoices, shown payment, and shown
// no control for it is measured in a browser with the two fixture accounts, and that
// measurement is recorded in the PR rather than here.

import { REPO_ROOT, listJsFiles, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Invoice visibility (#211), and payment with no gate of its own (#309)";

// EVERY FILE UNDER app/ AND lib/ THAT MAY READ `.paid`, with the reason. Read as:
// this is the whole payment surface. Adding a file here is a decision about who reads
// payment; adding one without registering it fails.
//
// SINCE #309 THE REASONS SAY WHO, AND FIVE OF THE EIGHT CHANGED. Every entry that
// said "privileged", "gated" or "President-or-Admin" was describing a line that has
// been reversed: the reads are open and the one gate left is the write's. The list
// still cannot tell whether a reader is gated, which is assertion 3's job.
const PAID_READERS = {
    "app/invoices/page.js":
        "the Status column — the payment word and the header variance badge, both open (#309)",
    "app/invoices/[invoiceId]/page.js":
        "the Payment section, open, with the Admin form and the read-only sentence inside it",
    "app/invoices/[invoiceId]/PaidForm.js":
        "the Admin-only toggle itself — the one WRITE control, rendered on user.isAdmin",
    "app/invoices/[invoiceId]/actions.js":
        "updatePaidAction, the WRITE — withAdminAction, the gate that form is paired with",
    "app/pos/[poId]/page.js":
        "the badge on the order's invoice list, open (#309) — it held the last inline gate",
    "lib/poDocuments.js":
        "the fold that builds that list — pure, and reached by every reader of the page (#233)",
    "lib/airtable/invoices.js": "the mapper — where the field is read off the record",
    "lib/deliveryDelete.js":
        "the third voice of the delete confirmation, offered to whoever may delete (#309)",
    "lib/deliveryStatus.js":
        "the order's payment judgment and the copy keyed by its verdict — #311's, and nothing else in the file",
};

/**
 * `lib/deliveryStatus.js` MAY NAME PAYMENT IN THREE PLACES AND NOWHERE ELSE (#311).
 *
 * #211 took this file OFF the payment surface and this file asserted the absence by
 * name, because "absent" is also what a broken scan reports. #311 puts it back — the
 * order's payment state is a judgment and judgments live here beside their two
 * siblings — so the named absence would have to be deleted, and deleting an assertion
 * is how a property stops being held. This replaces it with the narrower one that is
 * actually true: the file is on the surface for one axis, and a payment read anywhere
 * outside these three containers is a second answer starting.
 */
const PAYMENT_CONTAINERS = ["invoicePayment", "summarizePOPaymentStatus", "poPayment"];

export async function run({ check, log, assert }) {
    // --- 1: the rule is canViewPR, not a copy of it -----------------------
    log("the gate defers to #119's rule rather than restating it (AST):");
    const { ast } = parseFile("lib/invoiceVisibility.js");

    let importsPrVisibility = false;
    const imported = new Set();
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        if (node.source.value !== "./prVisibility") return;
        importsPrVisibility = true;
        for (const spec of node.specifiers) imported.add(spec.imported?.name ?? spec.local.name);
    });
    assert("lib/invoiceVisibility.js imports ./prVisibility", importsPrVisibility);
    assert("  and takes canViewPR from it", imported.has("canViewPR"));

    let callsCanViewPR = false;
    walk(ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name === "canViewPR") callsCanViewPR = true;
    });
    assert("  and actually calls it", callsCanViewPR);

    // A predicate of its own would not fail anything for as long as it agreed with
    // canViewPR, which is the whole hazard. These are the fields canViewPR decides
    // on; touching one here means a second implementation has started.
    const OWN_RULE_FIELDS = ["assignedJobs", "signerRowIds", "correctionRowIds", "requester"];
    const restated = [];
    walk(ast, (node) => {
        if (node.type !== "MemberExpression") return;
        const name = node.property?.name;
        if (OWN_RULE_FIELDS.includes(name)) restated.push(name);
    });
    check(
        "it reads none of canViewPR's own inputs",
        restated.length === 0 ? "none" : restated.join(","),
        "none"
    );
    // `Draft` is clause 1 and belongs to canViewPR alone. A status string here would
    // mean this module had started deciding visibility for itself.
    let namesDraft = false;
    walk(ast, (node) => {
        if (node.type === "Literal" && node.value === "Draft") namesDraft = true;
    });
    assert("and it does not name the Draft status", !namesDraft);

    // --- 1b: #210's dropdown defers to the same walk -----------------------
    //
    // A DROPDOWN OF INVOICE NUMBERS IS A SURFACE THAT SHOWS INVOICES, so it gates per
    // record. The shortcut that was actually tempting here is worth naming, because
    // it is free and it is wrong: getDeliveryCandidates already holds every purchase
    // order on the viewer's jobs, so "an invoice invoicing one of those orders" costs
    // nothing — and it is a SECOND answer to the visibility question that would
    // disagree with the first, since canViewPR also admits a requester, a signer and
    // the recipient of a correction request, none of whom need a Job assignment.
    log("");
    log("#210's invoice dropdown gates through the same walk, not a copy of it:");
    const candidates = parseFile("lib/deliveryInvoiceCandidates.js");
    const candidateImports = new Set();
    let importsVisibility = false;
    walk(candidates.ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        if (node.source.value !== "./invoiceVisibility") return;
        importsVisibility = true;
        for (const spec of node.specifiers) candidateImports.add(spec.imported?.name ?? spec.local.name);
    });
    assert("lib/deliveryInvoiceCandidates.js imports ./invoiceVisibility", importsVisibility);
    assert("  and takes the walk from it", candidateImports.has("getVisibleInvoiceIds"));

    const candidateCalls = new Set();
    walk(candidates.ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name) candidateCalls.add(node.callee.name);
    });
    assert("  and calls it on the READ side", candidateCalls.has("getVisibleInvoiceIds"));
    // Twice, in fact, and the second time is the point: the dropdown having rendered
    // proves nothing, so the guard re-runs the walk from a fresh read before any write.
    let visibilityCallCount = 0;
    walk(candidates.ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name === "getVisibleInvoiceIds") {
            visibilityCallCount += 1;
        }
    });
    check("the read and the guard each run it", visibilityCallCount, 2);

    // The same fields the module above may not touch. A comparison of its own here
    // would not fail anything for as long as it happened to agree.
    const candidateRestated = [];
    walk(candidates.ast, (node) => {
        if (node.type !== "MemberExpression") return;
        if (OWN_RULE_FIELDS.includes(node.property?.name)) candidateRestated.push(node.property.name);
    });
    check(
        "it reads none of canViewPR's own inputs either",
        candidateRestated.length === 0 ? "none" : candidateRestated.join(","),
        "none"
    );
    // The tempting shortcut, named so it fails rather than being caught by review.
    // Reaching for the candidate ORDERED ITEMS here is what a second answer looks like.
    let reachesCandidateOrderedItems = false;
    walk(candidates.ast, (node) => {
        if (node.type === "ImportDeclaration" && node.source.value === "./deliveryCandidates") {
            reachesCandidateOrderedItems = true;
        }
    });
    assert("and it does not narrow by the job's own order lines instead", !reachesCandidateOrderedItems);

    // THE ANSWER IS HANDED TO THE PREDICATE, and this covers the COST of how that is
    // enforced rather than enforcing it. `invoiceLinkRefusal` requires `visible` and
    // THROWS when it is missing, which is what makes the gate fail closed — a check
    // over call sites could not do that, since source shape is not execution. What the
    // throw leaves behind is that a caller which forgot it fails at runtime as a 500
    // instead of failing CI, so the one call site is pinned here, beside the other
    // call-site claims, rather than in the pure module's own file.
    let refusalCalls = 0;
    let refusalCallsWithVisible = 0;
    walk(candidates.ast, (node) => {
        if (node.type !== "CallExpression" || node.callee?.name !== "invoiceLinkRefusal") return;
        refusalCalls += 1;
        const arg = node.arguments[0];
        if (arg?.type !== "ObjectExpression") return;
        if (arg.properties.some((p) => p.key?.name === "visible")) refusalCallsWithVisible += 1;
    });
    // ANTI-VACUITY first: "every call passes it" is also true of no calls at all.
    assert("the module calls invoiceLinkRefusal at least once", refusalCalls > 0);
    check("and every call passes `visible`", refusalCallsWithVisible, refusalCalls);

    // --- 2: the old route gate is gone from both invoice routes -----------
    log("");
    log("neither invoice route carries the President-or-Admin route gate any more:");
    // The old gate was an inline `user.role === "President" || user.isAdmin === true`
    // that refused the WHOLE page. The same expression is legitimate elsewhere as a
    // privilege question, so what is asserted is that neither of these files asks it
    // inline. **The two files then diverge, and #309 was why.** The list still asked
    // `seesEveryInvoice`, for the one thing it was then for: skipping the walk's reads.
    // The detail page loads the invoice items it renders anyway, so it never had that
    // shortcut to take — it imported the helper to gate the Payment section, and
    // payment has no gate, so the call and the import are both gone.
    //
    // **#314 CONVERGED THEM AGAIN, AND THIS ASSERTION IS INVERTED RATHER THAN DELETED.**
    // The list needs the walk's RECORDS for its `Job` column — an invoice holds no job,
    // so the only route to one is the order and the request behind it — and it needs
    // them whoever is reading. So the cost shortcut is gone from the page and with it
    // the last privilege question on the screen. Deleting the assertion would have left
    // that unheld, and what replaces it is the stronger claim in the same place: NEITHER
    // invoice route asks who the reader is, at all. A call reappearing on this page is
    // a cost decision being made where a rendered fact is derived, which is the mutant
    // `offline/job-column.mjs` exists for and this line is its first tripwire.
    for (const relPath of ["app/invoices/page.js", "app/invoices/[invoiceId]/page.js"]) {
        const parsed = parseFile(relPath);
        let inlineRoleTest = false;
        walk(parsed.ast, (node) => {
            if (node.type === "Literal" && node.value === "President") inlineRoleTest = true;
        });
        assert(`${relPath} does not test the role string inline`, !inlineRoleTest);
        assert(
            `  and asks seesEveryInvoice nowhere either (#314)`,
            !callsNamed(parsed.ast).has("seesEveryInvoice")
        );
    }
    // ANTI-VACUITY for the pair above: "nobody calls it" is also what a broken call
    // finder reports, so the finder is shown finding it where it really is. Both live
    // sites are in the module this file is about, which is where the question belongs.
    const helperCalls = callsNamed(parseFile("lib/invoiceVisibility.js").ast);
    assert("  the call finder still finds seesEveryInvoice in the module that owns it", helperCalls.has("seesEveryInvoice"));

    // Each page must GATE, not merely ask — the helper alone would answer "may this
    // viewer see every invoice", which is not the row question. The two take different
    // exports of one walk since #314: the detail wants the verdict and nothing else,
    // the list wants the records the walk resolved. Both reach `canViewPR` through the
    // same code, which is what keeps them one gate rather than two.
    const detail = parseFile("app/invoices/[invoiceId]/page.js");
    let detailWalks = false;
    walk(detail.ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name === "getVisibleInvoiceIds") {
            detailWalks = true;
        }
    });
    assert("the detail page runs the row walk, not just the role question", detailWalks);

    const list = parseFile("app/invoices/page.js");
    let listWalks = false;
    walk(list.ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name === "resolveInvoiceScope") {
            listWalks = true;
        }
    });
    assert("and so does the list, through the shape that hands the records back", listWalks);

    // --- 3: the read and the write ask different questions (#309) ----------
    //
    // THE RULE, IN ONE SENTENCE: a branch whose test asks a PRIVILEGE question may
    // not have the payment fact on one side only. So `{privileged && <Payment/>}`
    // fails — the payment is in the consequent and there is no alternate — while
    // `user.isAdmin ? <PaidForm paid={…}/> : <p>{invoice.paid …}</p>` passes, because
    // a reader who cannot record it still reads it. The write control is allowed to
    // branch; the fact is not allowed to disappear with it.
    //
    // WHY PER READ AND NOT PER FILE. The inventory below is files, and a file-level
    // rule cannot see one screen left gated while the others open — which is the
    // shape `/pos/[poId]` was in, with an inline `seesPayment` that no sweep over
    // `seesEveryInvoice` would have reached. This one walks every branch in every
    // registered file, so the reachable surface is what is asserted.
    log("");
    log("no payment read sits on one side of a privilege test (#309):");
    const branched = [];
    for (const relPath of Object.keys(PAID_READERS)) {
        const parsed = parseFile(relPath);
        const locals = privilegeLocals(parsed.ast);
        for (const branch of privilegeBranches(parsed.ast, locals)) {
            const inConsequent = readsPayment(branch.consequent);
            const inAlternate = readsPayment(branch.alternate);
            if (inConsequent === inAlternate) continue;
            const side = inConsequent ? "consequent" : "alternate";
            branched.push(`${relPath}:${lineOf(parsed.source, branch.node.start)} (${side} only)`);
        }
    }
    check(
        `payment reads behind a privilege branch${branched.length ? ` (${branched.join("; ")})` : ""}`,
        branched.length,
        0
    );

    // AND THE WRITE CONTROL IS STILL GATED, which is the other half: the rule above is
    // equally satisfied by rendering `PaidForm` to everybody. Its condition has to be
    // the one `updatePaidAction` is wrapped with — #185's pair rule, read off the
    // control rather than off the action.
    const detailAst = parseFile("app/invoices/[invoiceId]/page.js").ast;
    const formTotal = countJsxElements(detailAst, "PaidForm");
    const formGated = privilegeBranches(detailAst, privilegeLocals(detailAst))
        .filter((b) => adminTest(b.test))
        .reduce((n, b) => n + countJsxElements(b.consequent, "PaidForm"), 0);
    assert("the detail page renders PaidForm at all", formTotal > 0);
    check("and every PaidForm sits inside a test on isAdmin", formGated, formTotal);

    // ANTI-VACUITY, BOTH DIRECTIONS. "No file has the shape" and "the detector never
    // ran" are the same result, so the detector is shown saying YES on a planted
    // violation and NO on the real pairing it must not flag. The planted source is the
    // exact mutant: the read gate and the write gate collapsed into one condition.
    log("");
    log("anti-vacuity — the branch detector is seen deciding both ways:");
    const mutant = parseSource(
        "const privileged = seesEveryInvoice(user);\n" +
            "export default function P({ invoice }) {\n" +
            "  return <div>{privileged && <span>{invoice.paid ? 'Paid' : 'Unpaid'}</span>}</div>;\n" +
            "}\n",
        "<mutant>"
    );
    const mutantFindings = privilegeBranches(mutant.ast, privilegeLocals(mutant.ast)).filter(
        (b) => readsPayment(b.consequent) !== readsPayment(b.alternate)
    );
    assert("a payment read behind `privileged &&` is reported", mutantFindings.length === 1);
    const paired = parseSource(
        "export default function P({ user, invoice }) {\n" +
            "  return user.isAdmin\n" +
            "    ? <Form paid={invoice.paid} />\n" +
            "    : <p>{invoice.paid ? 'Paid' : 'Not paid yet.'}</p>;\n" +
            "}\n",
        "<paired>"
    );
    const pairedFindings = privilegeBranches(paired.ast, privilegeLocals(paired.ast)).filter(
        (b) => readsPayment(b.consequent) !== readsPayment(b.alternate)
    );
    assert("  and the same fact on both sides of an isAdmin test is not", pairedFindings.length === 0);
    // The privilege half has to be seen too: a branch on something else must not be
    // collected at all, or the rule above would be reporting every ternary in the app.
    const unrelated = parseSource(
        "export default function P({ invoice }) {\n" +
            "  return <span>{invoice.paid ? 'Paid' : 'Unpaid'}</span>;\n" +
            "}\n",
        "<unrelated>"
    );
    check(
        "  a branch on the payment fact itself is no privilege test",
        privilegeBranches(unrelated.ast, privilegeLocals(unrelated.ast)).length,
        0
    );
    // AND THE DERIVED VALUE IS PINNED, because this rule's first version reported
    // `/invoices`' empty-state ternary: a local whose CONTENT privilege decided is not
    // a local that holds the answer. Both halves, so neither the taint nor the
    // predicate itself can come back.
    const derived = parseSource(
        "const rows = seesEveryInvoice(user) ? [] : await load();\n" +
            "const office = user.isAdmin === true;\n",
        "<derived>"
    );
    const derivedLocals = privilegeLocals(derived.ast);
    assert("a local privilege only SHAPED is not a privilege answer", !derivedLocals.has("rows"));
    assert("  while one that holds the answer is", derivedLocals.has("office"));

    // --- 4: the payment surface, enumerated ------------------------------
    log("");
    log("every reader of `.paid` under app/ and lib/ is registered (#211's inventory):");
    const found = paidReaders();
    const unregistered = found.filter((f) => !(f in PAID_READERS));
    check(
        "no unregistered reader",
        unregistered.length === 0 ? "none" : unregistered.join(", "),
        "none"
    );
    // A STALE ENTRY IS ALSO A FAILURE, the way #147 fails a stale exemption: a list
    // that outlives what it describes turns into a blanket permission nobody reads.
    const stale = Object.keys(PAID_READERS).filter((f) => !found.includes(f));
    check("no stale entry", stale.length === 0 ? "none" : stale.join(", "), "none");

    // The file #211 took OFF this surface. Named rather than merely absent, because
    // "absent" is also what a broken scan reports.
    assert("lib/overagePR.js reads no payment field", !found.includes("lib/overagePR.js"));

    // ITS PAIR WAS `lib/deliveryStatus.js` AND #311 PUT THAT FILE BACK ON, so the
    // named absence is replaced rather than dropped — see PAYMENT_CONTAINERS.
    log("");
    log("lib/deliveryStatus.js names payment only in #311's judgment and its copy:");
    const statusFile = parseFile("lib/deliveryStatus.js");
    const total = countPaymentReads(statusFile.ast);
    const inside = namedContainers(statusFile.ast, PAYMENT_CONTAINERS).reduce(
        (n, node) => n + countPaymentReads(node),
        0
    );
    assert("  the file reads payment at all", total > 0);
    check("  and every one of them is inside a payment container", total - inside, 0);
    check("  all three containers were found", namedContainers(statusFile.ast, PAYMENT_CONTAINERS).length, 3);
    // NO `paidDate` ANYWHERE IN IT, which is #311's no-figure rule as source shape:
    // the badge says a set is late and never how late, because a day count belongs to
    // one invoice while the badge is about a set.
    let namesPaidDate = false;
    walk(statusFile.ast, (node) => {
        if (node.type === "Identifier" && node.name === "paidDate") namesPaidDate = true;
        if (node.type === "Literal" && node.value === "Paid Date") namesPaidDate = true;
    });
    assert("  and it names no payment DATE, so the badge can carry no figure", !namesPaidDate);
    // ANTI-VACUITY: the container finder has to be seen missing one it is not given.
    check(
        "  the container finder returns nothing for a name that is not there",
        namedContainers(statusFile.ast, ["noSuchContainer"]).length,
        0
    );

    // --- 5: the delete confirmation asks nobody's privilege (#309) ----------
    //
    // THIS SECTION IS INVERTED RATHER THAN DELETED. It held that
    // `resolveDeleteCopy` names `seesPayment` and that the flag defaults to FALSE, so
    // a caller who forgot it under-disclosed. The line that made the flag right is
    // reversed: the reader of that modal reaches the invoices behind the delivery's
    // own rows by the page's own gate, so a flag here would be a gate on payment of
    // payment's own. Deleting the assertions would have left the removal unpinned, so
    // what is asserted now is the ABSENCE of a privilege parameter — the flag cannot
    // come back without a decision.
    log("");
    log("the delete confirmation takes no privilege parameter:");
    const del = parseFile("lib/deliveryDelete.js");
    let namesSeesPayment = false;
    walk(del.ast, (node) => {
        if (node.type === "Identifier" && node.name === "seesPayment") namesSeesPayment = true;
    });
    assert("lib/deliveryDelete.js names no seesPayment identifier", !namesSeesPayment);
    // THE SIGNATURE, not merely the absence of a name: an options object called
    // anything else would be the same gate under a different word.
    const resolveParams = paramNames(del.ast, "resolveDeleteCopy");
    check("resolveDeleteCopy takes the record and its rows, and nothing else", resolveParams.join(","), "delivery,items");
    // And the call site passes exactly those two, so the page cannot hand it a third.
    const detailCall = resolveDeleteCopyArgs(parseFile("app/deliveries/[deliveryId]/page.js").ast);
    check("the delivery detail passes two arguments", detailCall, 2);
    // ANTI-VACUITY: the reader has to be seen counting a real signature, or "two" is
    // what a failed lookup reports as readily as a correct one.
    check(
        "  the parameter reader works on a known signature",
        paramNames(parseSource("function f(a, b, c) {}", "<probe>").ast, "f").join(","),
        "a,b,c"
    );
    assert("  and returns nothing for a name it cannot find", paramNames(del.ast, "noSuchExport") === null);

    // --- ANTI-VACUITY: this check can fail --------------------------------
    // Every assertion above is of the form "X is absent" or "Y is present", and both
    // are what a broken traversal reports. So the traversal is made to prove it
    // reached something first.
    log("");
    log("anti-vacuity — the scan is seen to find what it is scanning for:");
    assert("the `.paid` scan found readers at all", found.length > 0);
    check("and it found the mapper, which must always be one", found.includes("lib/airtable/invoices.js"), true);
    // If `walk` silently visited nothing, every "does not contain" assertion above
    // would pass. This proves it visits: the module does import from ./prVisibility,
    // and it does contain the identifier the flag check looks for elsewhere.
    assert("the AST walk visits import declarations", importsPrVisibility);
    assert("  and call expressions", callsCanViewPR);
    // A control: a token that IS in the file must be found by the same walk that
    // reports the forbidden ones absent.
    let sawKnownIdentifier = false;
    walk(ast, (node) => {
        if (node.type === "Identifier" && node.name === "getVisibleInvoiceIds") {
            sawKnownIdentifier = true;
        }
    });
    assert("  and identifiers, so an absence above is a real absence", sawKnownIdentifier);
}

// The shapes payment reaches code in — five since #309 added the JSX prop, and
// `isPaymentNode` below is where they are read. `.paid` alone was the first version of
// this scan and it MISSED TWO REGISTERED FILES — the Airtable mapper, where the
// field arrives as `record.get("Paid")`, and the toggle form, where it arrives as a
// destructured prop. The anti-vacuity assertion below is what caught that, which is
// the reason it is in this file rather than a note about how careful the scan is.
const PAID_NAMES = new Set(["paid", "paidDate"]);
const PAID_LITERALS = new Set(["paid", "paidDate", "Paid", "Paid Date"]);

/**
 * Every file under app/ and lib/ that touches the payment fact, repo-relative and
 * POSIX-separated.
 *
 * ON THE AST RATHER THAN BY GREP, so prose does not count. Several files in this
 * repo explain at length that payment is withheld — this one included — and a
 * comment about a rule must not read as a violation of it. That is the same
 * correction #203's source-shape check had to make when a page's own doc comment
 * named the function it was asserting the page never calls.
 *
 * Matched on EXACT names, never substrings: `Unpaid`, `paid-updated` and a sentence
 * containing the word are not payment reads, and a substring match would make this
 * list unmaintainable rather than strict.
 */
function paidReaders() {
    const out = new Set();
    for (const dir of ["app", "lib"]) {
        for (const abs of listJsFiles(repoPath(dir))) {
            const rel = toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
            let reads = false;
            try {
                reads = readsPayment(parseFile(rel).ast);
            } catch {
                // A file this tier cannot parse must not silently become "clean" —
                // offline/source-shape.mjs fails outright on an unparsed file, and
                // the safe direction here is to report it as a reader so somebody
                // looks at it.
                reads = true;
            }
            if (reads) out.add(rel);
        }
    }
    return [...out].sort();
}

/**
 * Does anything in this subtree touch the payment fact?
 *
 * ONE DEFINITION, TWO CALLERS (#309). The inventory asks it of a whole file; the
 * privilege-branch rule asks it of one side of one branch. A second copy of these
 * four shapes would let the two disagree about what a payment read IS, which is the
 * failure mode that would make the branch rule quietly vacuous while the inventory
 * kept passing.
 */
function readsPayment(node) {
    if (!node) return false;
    let reads = false;
    walk(node, (n) => {
        if (!reads && isPaymentNode(n)) reads = true;
    });
    return reads;
}

/**
 * Is THIS ONE NODE a payment read? The five shapes payment reaches code in.
 *
 * Split out of `readsPayment` by #311, which needed to COUNT them per node rather
 * than ask whether a subtree holds one. One definition, two walkers — a second copy
 * of the shapes would let "does this file read payment" and "where in it" disagree,
 * and the second question is the one that replaced a deleted assertion.
 */
function isPaymentNode(n) {
    switch (n.type) {
        // invoice.paid, parentInvoice?.paidDate
        case "MemberExpression":
            return !n.computed && PAID_NAMES.has(n.property?.name);
        // { paid, paidDate } in a signature, `paid:` in an object,
        // and `"Paid":` in an Airtable field map.
        case "Property":
            return PAID_NAMES.has(n.key?.name) || PAID_LITERALS.has(n.key?.value);
        // record.get("Paid"), fields["Paid Date"]
        case "Literal":
            return PAID_LITERALS.has(n.value);
        // a bare `paid` local, which is how the write action holds it
        case "Identifier":
            return PAID_NAMES.has(n.name);
        // `paid={invoice.paid}` on a component — the write control's own prop,
        // which is the one shape the four above miss: a JSXAttribute is not a
        // Property. Without it, collapsing the read and the write into one
        // condition would leave `<PaidForm paid={…}/>` looking payment-free.
        case "JSXAttribute":
            return PAID_NAMES.has(n.name?.name);
        default:
            return false;
    }
}

/** How many payment reads a subtree holds, counting each NODE once (#311). */
function countPaymentReads(node) {
    let n = 0;
    walk(node, (candidate) => {
        if (isPaymentNode(candidate)) n += 1;
    });
    return n;
}

/**
 * The function declarations, arrow assignments and object properties in this file
 * whose name is one of `names` — the containers a payment read is allowed inside.
 */
function namedContainers(ast, names) {
    const out = [];
    walk(ast, (node) => {
        if (node.type === "FunctionDeclaration" && names.includes(node.id?.name)) out.push(node);
        if (node.type === "VariableDeclarator" && names.includes(node.id?.name) && node.init) {
            out.push(node.init);
        }
        if (node.type === "Property" && names.includes(node.key?.name ?? node.key?.value)) {
            out.push(node.value);
        }
    });
    return out;
}

/** Every function name this subtree calls. */
function callsNamed(ast) {
    const names = new Set();
    walk(ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name) names.add(node.callee.name);
    });
    return names;
}

/**
 * The locals in this file that HOLD a privilege answer.
 *
 * Resolved from the INITIALIZER rather than from a name list, so `privileged`,
 * `isOffice`, `seesPayment` and whatever the next one is called are all found by what
 * they are assigned. A name list would be an exemption list under another word, and
 * #201 records how fast one of those rots.
 *
 * HOLDS, NOT MERELY DEPENDS ON, and the difference is what makes the rule usable.
 * The first version taints any declarator whose initializer MENTIONS a privilege
 * term, and `/invoices` shows why that is wrong: `invoiceItems` is
 * `seesEveryInvoice(user) ? [] : await …`, so the taint runs on through `visibleIds`
 * to `invoices`, and the empty-state ternary `invoices.length === 0 ? … : …` reads as
 * a privilege gate over the whole table. It is not — its value is rows, and privilege
 * decided only what they cost. So the shapes admitted are the BOOLEAN ones: the
 * predicate call, a comparison or a logical over privilege terms, a negation, and a
 * pure alias of another such local. A privilege term inside a ternary's test, or
 * passed as an argument, produces a value that is not the answer.
 */
function privilegeLocals(ast) {
    const locals = new Set();
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier") return;
        if (node.init && holdsPrivilegeAnswer(node.init, locals)) locals.add(node.id.name);
    });
    return locals;
}

/** Is this initializer the privilege answer itself, rather than something shaped by it? */
function holdsPrivilegeAnswer(node, locals) {
    if (!node) return false;
    switch (node.type) {
        case "CallExpression":
            return PRIVILEGE_CALLS.has(node.callee?.name);
        case "MemberExpression":
            return PRIVILEGE_FIELDS.has(node.property?.name);
        case "Identifier":
            return locals.has(node.name);
        case "UnaryExpression":
            return node.operator === "!" && holdsPrivilegeAnswer(node.argument, locals);
        case "LogicalExpression":
            return (
                holdsPrivilegeAnswer(node.left, locals) ||
                holdsPrivilegeAnswer(node.right, locals)
            );
        case "BinaryExpression":
            return (
                holdsPrivilegeAnswer(node.left, locals) ||
                holdsPrivilegeAnswer(node.right, locals) ||
                node.left?.value === "President" ||
                node.right?.value === "President"
            );
        default:
            return false;
    }
}

/** Does this expression ask who the reader is? */
function asksPrivilege(node, locals = new Set()) {
    if (!node) return false;
    let asks = false;
    walk(node, (n) => {
        if (asks) return;
        if (n.type === "CallExpression" && PRIVILEGE_CALLS.has(n.callee?.name)) asks = true;
        if (n.type === "MemberExpression" && PRIVILEGE_FIELDS.has(n.property?.name)) asks = true;
        if (n.type === "Identifier" && locals.has(n.name)) asks = true;
        if (n.type === "Literal" && n.value === "President") asks = true;
    });
    return asks;
}

/** Is this test the WRITE's own gate — `updatePaidAction`'s `isAdmin`? */
function adminTest(node) {
    let admin = false;
    walk(node, (n) => {
        if (n.type === "MemberExpression" && n.property?.name === "isAdmin") admin = true;
        if (n.type === "Identifier" && n.name === "isAdmin") admin = true;
    });
    return admin;
}

const PRIVILEGE_CALLS = new Set(["seesEveryInvoice", "requireAdmin", "requirePresident"]);
const PRIVILEGE_FIELDS = new Set(["isAdmin", "role"]);

/**
 * Every branch in this subtree whose test asks a privilege question, as
 * `{ node, test, consequent, alternate }`.
 *
 * The three shapes a gate is written in: a ternary, a `&&`, and an `if`. A `&&` has
 * no alternate, which is why the commonest gate — `{privileged && <Payment/>}` — is
 * caught by a rule about SIDES rather than by one about tests.
 */
function privilegeBranches(ast, locals) {
    const out = [];
    walk(ast, (node) => {
        if (node.type === "ConditionalExpression" || node.type === "IfStatement") {
            if (asksPrivilege(node.test, locals)) {
                out.push({
                    node,
                    test: node.test,
                    consequent: node.consequent,
                    alternate: node.alternate ?? null,
                });
            }
            return;
        }
        if (node.type === "LogicalExpression" && node.operator === "&&") {
            if (asksPrivilege(node.left, locals)) {
                out.push({ node, test: node.left, consequent: node.right, alternate: null });
            }
        }
    });
    return out;
}

/** How many `<Name …>` elements this subtree opens. */
function countJsxElements(node, name) {
    let n = 0;
    walk(node, (candidate) => {
        if (candidate.type === "JSXOpeningElement" && candidate.name?.name === name) n += 1;
    });
    return n;
}

/** The parameter names of a named function or arrow, or null if there is none. */
function paramNames(ast, name) {
    let params = null;
    walk(ast, (node) => {
        if (params) return;
        if (node.type === "FunctionDeclaration" && node.id?.name === name) params = node.params;
        if (node.type === "VariableDeclarator" && node.id?.name === name) {
            const init = node.init;
            if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
                params = init.params;
            }
        }
    });
    if (!params) return null;
    return params.map((p) => (p.type === "Identifier" ? p.name : `<${p.type}>`));
}

/** How many arguments the one `resolveDeleteCopy(...)` call site passes. */
function resolveDeleteCopyArgs(ast) {
    let count = null;
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        if (node.callee?.name !== "resolveDeleteCopy") return;
        count = node.arguments.length;
    });
    return count;
}

/** 1-indexed line of a character offset, so a finding names something openable. */
function lineOf(source, offset) {
    return source.slice(0, offset).split("\n").length;
}

if (isMain(import.meta.url)) await standalone(title, run);

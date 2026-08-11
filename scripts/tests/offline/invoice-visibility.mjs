// Employee access to the invoice routes, and the payment line (#211) — source
// shape, on the AST.
//
// WHY THIS TIER CANNOT IMPORT THE MODULE IT IS ABOUT. lib/invoiceVisibility.js
// reaches lib/airtable/*, which throws `Missing AIRTABLE_API_KEY` at module load,
// so the offline tier can neither call `getVisibleInvoiceIds` nor read
// `seesEveryInvoice`. What it can do is read the source, and the two things worth
// pinning here are structural anyway:
//
//   1  THE RULE IS NOT REIMPLEMENTED. The judgement is canViewPR and must stay
//      canViewPR. A second predicate in the new module would be a second answer to
//      one question, and nothing behavioural would notice for as long as the two
//      happened to agree — which is exactly the shape CLAUDE.md's "one rule, one
//      implementation" records this repo being bitten by twice.
//   2  THE PAYMENT LINE IS ENUMERABLE. `Paid` is President-or-Admin, and a line
//      that leaks anywhere is not a line. A reader of `.paid` is one grep away from
//      being found and zero warnings away from being added, so the set of files
//      allowed to read it is listed here and a new one fails until it is registered.
//      That is #147's enumerated-inventory shape and #201's scoped-ban shape: the
//      check does not judge the new reader, it forces someone to.
//
// WHAT A PASS DOES NOT PROVE. That a refusal actually refuses. Source shape is not
// execution — a gate inside `if (false)` satisfies every assertion below. Whether a
// non-privileged session is admitted to the right invoices and shown no payment is
// measured in a browser with the two fixture accounts, and that measurement is
// recorded in the PR rather than here.

import { REPO_ROOT, listJsFiles, parseFile, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { readFileSync } from "node:fs";

export const title = "Invoice visibility and the payment line (#211)";

// EVERY FILE UNDER app/ AND lib/ THAT MAY READ `.paid`, with the reason. Read as:
// this is the whole surface the payment line has to hold. Adding a file here is a
// decision about that line; adding one without registering it fails.
const PAID_READERS = {
    "app/invoices/page.js":
        "the Status column, rendered only for a privileged viewer (#211)",
    "app/invoices/[invoiceId]/page.js":
        "the Payment section, rendered only for a privileged viewer (#211)",
    "app/invoices/[invoiceId]/PaidForm.js":
        "the Admin-only toggle itself — reached only from the gated section",
    "app/invoices/[invoiceId]/actions.js":
        "updatePaidAction, the WRITE — withAdminAction, so it is the line's own gate",
    "app/pos/[poId]/page.js":
        "the per-line invoice breakdown, inside #132's isPrivileged branch",
    "lib/airtable/invoices.js": "the mapper — where the field is read off the record",
    "lib/deliveryDelete.js":
        "the third voice of the delete confirmation, behind #211's seesPayment flag",
};

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

    // --- 2: the old route gate is gone from both invoice routes -----------
    log("");
    log("neither invoice route carries the President-or-Admin route gate any more:");
    // The old gate was an inline `user.role === "President" || user.isAdmin === true`
    // that refused the WHOLE page. The same expression is legitimate elsewhere as a
    // privilege question, so what is asserted is that these two files ask it through
    // the shared helper instead of inline.
    for (const relPath of ["app/invoices/page.js", "app/invoices/[invoiceId]/page.js"]) {
        const parsed = parseFile(relPath);
        let inlineRoleTest = false;
        let usesHelper = false;
        walk(parsed.ast, (node) => {
            if (node.type === "Literal" && node.value === "President") inlineRoleTest = true;
            if (node.type === "CallExpression" && node.callee?.name === "seesEveryInvoice") {
                usesHelper = true;
            }
        });
        assert(`${relPath} does not test the role string inline`, !inlineRoleTest);
        assert(`  and asks seesEveryInvoice instead`, usesHelper);
    }

    // The detail page must GATE, not merely ask — the helper alone would answer
    // "may this viewer see every invoice", which is not the row question.
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
        if (node.type === "CallExpression" && node.callee?.name === "getVisibleInvoiceIds") {
            listWalks = true;
        }
    });
    assert("and so does the list", listWalks);

    // --- 3: the payment line, enumerated ---------------------------------
    log("");
    log("every reader of `.paid` under app/ and lib/ is registered (#211's line):");
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

    // The two files #211 took OFF this surface. Named rather than merely absent,
    // because "absent" is also what a broken scan reports.
    assert("lib/overagePR.js reads no payment field", !found.includes("lib/overagePR.js"));
    assert("lib/deliveryStatus.js reads none either", !found.includes("lib/deliveryStatus.js"));

    // --- 4: the delete confirmation asks before it discloses ---------------
    log("");
    log("the delete confirmation's paid voice is behind a flag:");
    const del = parseFile("lib/deliveryDelete.js");
    let hasSeesPayment = false;
    walk(del.ast, (node) => {
        if (node.type === "Identifier" && node.name === "seesPayment") hasSeesPayment = true;
    });
    assert("lib/deliveryDelete.js names seesPayment", hasSeesPayment);
    // Defaulting to true would make a caller that forgets the flag over-disclose,
    // which is the direction that matters.
    const delSource = readFileSync(repoPath("lib/deliveryDelete.js"), "utf8");
    assert("and it defaults to false", delSource.includes("seesPayment = false"));

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

// The four shapes payment reaches code in. `.paid` alone was the first version of
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
                const { ast } = parseFile(rel);
                walk(ast, (node) => {
                    if (reads) return;
                    switch (node.type) {
                        // invoice.paid, parentInvoice?.paidDate
                        case "MemberExpression":
                            if (!node.computed && PAID_NAMES.has(node.property?.name)) reads = true;
                            return;
                        // { paid, paidDate } in a signature, `paid:` in an object,
                        // and `"Paid":` in an Airtable field map.
                        case "Property":
                            if (PAID_NAMES.has(node.key?.name)) reads = true;
                            else if (PAID_LITERALS.has(node.key?.value)) reads = true;
                            return;
                        // record.get("Paid"), fields["Paid Date"]
                        case "Literal":
                            if (PAID_LITERALS.has(node.value)) reads = true;
                            return;
                        // a bare `paid` local, which is how the write action holds it
                        case "Identifier":
                            if (PAID_NAMES.has(node.name)) reads = true;
                            return;
                        default:
                            return;
                    }
                });
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

if (isMain(import.meta.url)) await standalone(title, run);

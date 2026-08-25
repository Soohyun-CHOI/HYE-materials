// Sending a signed order to the vendor (#281).
//
// THE QUIET MUTANT IS A FAILED SEND RECORDED AS A SUCCESS, and it is not a
// hypothetical — `lib/email.js` wrote the trap into its own comment years before this
// issue: the Resend SDK "returns { data, error } instead of throwing on API errors …
// so this has to be checked explicitly or a failed send silently looks like a success
// to the caller." Put a record beside that and the screen claims the vendor has an
// order that never left the building, which is worse than the gap this issue closes.
// It has two shapes and both are asserted: the sender not checking `error`, and the
// action writing whether or not the send returned. Every other check in this tier
// stays green through either.
//
// THE SECOND MUTANT IS A GATE THAT LIVES ONLY ON THE BUTTON. A Server Action is
// directly callable, so a withdrawn or unsigned order has to be refused by the action
// regardless of what the page rendered — the rule #138 states for signing and
// regeneration, and mailing the order to the vendor is the strongest form of a new
// document. Asserted as "the predicate runs before the send", plus the predicate's own
// five refusals, which are behavioral because `lib/poSend.js` is pure.
//
// WHAT THIS TIER CANNOT SEE, and it is the one thing that has to be added by hand:
// the `Sent to Vendor` option on `Purchase Orders.Status`. Airtable refuses an option
// list PATCH (measured: 422 `INVALID_REQUEST_UNKNOWN`), so the option is a UI edit,
// exactly as #138's was. Nothing here can tell whether it exists — a write of a
// missing select option fails at the Airtable call, which on this path happens AFTER
// the mail has gone. `PO_SENT_STATUS` is pinned below so the code's spelling cannot
// drift from the option's; that the option is there at all is proved only by a send.

import { readFileSync } from "node:fs";
import {
    getPOSendEligibility,
    PO_SENT_STATUS,
    SEND_COPY,
    SEND_REFUSAL,
} from "../../../lib/poSend.js";
import { isPOSigned, PO_SIGNED_STATUSES } from "../../../lib/poUnsigned.js";
import { callsBefore, callsFunction, parseFile, repoPath, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Sending a signed order to the vendor (#281)";

const ACTIONS = "app/pos/[poId]/actions.js";
const EMAIL = "lib/email.js";

/** A sendable order, and the one field each case spoils. */
const SENDABLE = {
    status: "Signed",
    presidentSigned: true,
    poPdfFile: [{ url: "https://example.invalid/po.pdf", filename: "HYE-PO-20260101-01.pdf" }],
    sentAt: null,
};

export function run({ check, assert, log }) {
    // ── 1. the send has to fail loudly ──────────────────────────────────────
    log("THE QUIET MUTANT — a failed send that the record calls a success:");
    const email = parseFile(EMAIL);
    const sender = resolveFunction(email.ast, "sendPOToVendorEmail");
    assert("lib/email.js exports sendPOToVendorEmail", sender !== null);
    // The SDK resolves with an error rather than rejecting, so the only thing that
    // turns a failed send into a failed call is this throw.
    let throwsOnError = false;
    if (sender) {
        const src = readFileSync(repoPath(EMAIL), "utf8").slice(sender.start, sender.end);
        throwsOnError = /if\s*\(\s*error\s*\)\s*\{[\s\S]*?throw\b/.test(src);
    }
    assert("  and throws when the SDK hands back an error", throwsOnError);
    // ANTI-VACUITY: the matcher has to be seen to reject a sender that ignores it,
    // which is the mutation this assertion exists for.
    assert(
        "  the matcher rejects a sender that drops the check",
        !/if\s*\(\s*error\s*\)\s*\{[\s\S]*?throw\b/.test(
            "const { error } = await resend.emails.send({});\nreturn;"
        )
    );
    // And every sibling still does it, so this is the file's contract rather than one
    // function's habit.
    for (const fn of [
        "sendMagicLinkEmail",
        "sendSignerTurnEmail",
        "sendPOAwaitingSignatureEmail",
        "sendPOSignedEmail",
    ]) {
        const node = resolveFunction(email.ast, fn);
        const src = node ? readFileSync(repoPath(EMAIL), "utf8").slice(node.start, node.end) : "";
        check(`  ${fn} checks it too`, /if\s*\(\s*error\s*\)\s*\{[\s\S]*?throw\b/.test(src), true);
    }

    // ── 2. and the record has to come after it ──────────────────────────────
    log("");
    log("the record is written after the send, never beside it:");
    const actions = parseFile(ACTIONS);
    const handler = resolveFunction(actions.ast, "sendPOToVendorHandler");
    assert("sendPOToVendorHandler resolves", handler !== null);
    if (handler) {
        assert(
            "the send precedes the write — a send that throws never reaches updatePO",
            callsBefore(handler, "sendPOToVendorEmail", "updatePO")
        );
        // ANTI-VACUITY for the ordering test: it must be seen to say no in the other
        // direction, or "A before B" is what it reports for any pair it can find.
        assert(
            "  and the ordering test is not symmetric",
            !callsBefore(handler, "updatePO", "sendPOToVendorEmail")
        );
        // The status and the three facts go in one write, so a crash cannot leave a
        // sent order with no timestamp or a timestamp with no status.
        const src = readFileSync(repoPath(ACTIONS), "utf8").slice(handler.start, handler.end);
        const writes = (src.match(/updatePO\(/g) || []).length;
        check("one write, not one per field", writes, 1);
        for (const key of ["status", "sentAt", "sentBy", "sentTo"]) {
            check(`  it carries ${key}`, new RegExp(`\\b${key}:`).test(src), true);
        }
    }

    // ── 3. the gate is in the action, not on the button ─────────────────────
    log("");
    log("THE SECOND MUTANT — a gate the page has and the action does not:");
    if (handler) {
        assert(
            "the eligibility predicate runs before the send",
            callsBefore(handler, "getPOSendEligibility", "sendPOToVendorEmail")
        );
        check(
            "  and the action re-derives no rule of its own",
            callsFunction(handler, "isPOWithdrawn"),
            false
        );
    }
    // The predicate's own refusals, behavioral because the module is pure.
    check("a sendable order is sendable", getPOSendEligibility({ po: SENDABLE, vendorEmail: "a@b.co" }).eligible, true);
    const cases = [
        ["withdrawn", { ...SENDABLE, status: "Withdrawn" }, "a@b.co"],
        ["unsigned", { ...SENDABLE, presidentSigned: false }, "a@b.co"],
        ["no-document", { ...SENDABLE, poPdfFile: [] }, "a@b.co"],
        ["no-address", SENDABLE, ""],
        ["already-sent", { ...SENDABLE, sentAt: "2026-08-25T10:00:00.000Z" }, "a@b.co"],
    ];
    for (const [reason, po, vendorEmail] of cases) {
        const verdict = getPOSendEligibility({ po, vendorEmail });
        check(`  refused: ${reason}`, verdict.reason, reason);
        assert(`    and not eligible`, verdict.eligible === false);
    }
    // A withdrawn order that is ALSO unsigned reports withdrawn — the narrower fact,
    // the same ordering rule getPOWithdrawEligibility states for its own two tests.
    check(
        "  withdrawn wins over unsigned, which is the order a reader would fix them in",
        getPOSendEligibility({ po: { ...SENDABLE, status: "Withdrawn", presidentSigned: false }, vendorEmail: "a@b.co" }).reason,
        "withdrawn"
    );
    // `already-sent` reads the timestamp and not the status, so a hand edit to one
    // cannot re-open a send.
    check(
        "  a sent order stays refused even if its status was edited back",
        getPOSendEligibility({ po: { ...SENDABLE, status: "Signed", sentAt: "2026-08-25T10:00:00.000Z" }, vendorEmail: "a@b.co" }).reason,
        "already-sent"
    );

    // ── 4. the copy ─────────────────────────────────────────────────────────
    log("");
    log("every refusal the predicate can return has words:");
    const reasons = new Set(cases.map(([r]) => r));
    for (const r of reasons) {
        assert(`  ${r} has a sentence`, typeof SEND_REFUSAL[r] === "string" && SEND_REFUSAL[r].length > 0);
    }
    check("and no sentence for a reason nothing returns", Object.keys(SEND_REFUSAL).length, reasons.size);
    // THE TWO FAILURE MESSAGES SAY OPPOSITE THINGS AND MUST NOT BE SWAPPED. One says
    // nothing was sent; the other says the vendor has it. A reader acting on the wrong
    // one either sends twice or never sends at all.
    assert(
        "the send failure says nothing was sent",
        /nothing was sent/i.test(SEND_COPY.sendFailed)
    );
    assert(
        "the record failure says the vendor has it, and not to send again",
        /the vendor has it/i.test(SEND_COPY.recordFailed) &&
            /do not send it again/i.test(SEND_COPY.recordFailed)
    );
    assert("  so the two cannot be confused", SEND_COPY.sendFailed !== SEND_COPY.recordFailed);
    // The record of the send names all three fields it reads.
    const sent = SEND_COPY.sent({ address: "alex@example.com", when: "8/25/2026, 10:00 AM", by: "Soo Choi" });
    assert("the sent line names the address", sent.includes("alex@example.com"));
    assert("  and when", sent.includes("8/25/2026, 10:00 AM"));
    assert("  and who", sent.includes("Soo Choi"));
    // ONE SEND, SO NO `last`. A resend is refused, which is what lets this sentence
    // name the send rather than the most recent one — the wording would be a promise
    // the field cannot keep if resending were ever allowed without a history.
    assert("  and does not call itself the last one", !/\blast\b/i.test(sent));
    // A missing actor drops the clause rather than printing an em dash.
    assert(
        "a send with no actor on record still reads",
        !SEND_COPY.sent({ address: "a@b.co", when: "now", by: null }).includes("by ")
    );

    log("");
    log("the mail says what a vendor needs and no more:");
    const subject = SEND_COPY.mail.subject({ poId: "HYE-PO-20260101-01", buyerName: "HANYANGENG USA INC." });
    assert("the subject names the order", subject.includes("HYE-PO-20260101-01"));
    assert("  and the buyer, since From carries the product instead", subject.includes("HANYANGENG USA INC."));
    const html = SEND_COPY.mail.html({
        poId: "HYE-PO-20260101-01",
        buyerName: "HANYANGENG USA INC.",
        vendorName: "Lone Star Pipe & Supply",
        totalAmount: "$1,234.00",
        senderName: "Soo Choi",
    });
    // THE BUYER NAME ENDS IN ITS OWN ABBREVIATING PERIOD, AND THE FIRST SEND WENT OUT
    // SAYING `HANYANGENG USA INC..` — the name's period plus the sentence's. It is the
    // sentence's subject now, so the word after it is always a lowercase verb.
    assert("the buyer name is never followed by a period", !html.includes("HANYANGENG USA INC.."));
    assert("  and nothing else doubles one either", !/\.\./.test(html) && !/\.\./.test(subject));
    // THE TEMPLATE MUST NOT INSPECT THE NAME, which is what the two easier fixes would
    // have done — stripping a trailing period, or appending one conditionally. A name
    // that does NOT end in a period has to read just as well, and that is what proves
    // no branch is in there.
    const plainBuyer = SEND_COPY.mail.html({
        poId: "HYE-PO-20260101-01",
        buyerName: "ACME SUPPLY CO",
        vendorName: "Lone Star Pipe & Supply",
        totalAmount: "$1,234.00",
        senderName: "Soo Choi",
    });
    assert("a buyer name with no trailing period reads the same way", plainBuyer.includes("ACME SUPPLY CO has issued"));
    assert("  and gains no period of its own", !plainBuyer.includes("ACME SUPPLY CO."));
    assert("  and doubles nothing", !/\.\./.test(plainBuyer));
    // ANTI-VACUITY: the double-period matcher has to be seen to catch the sentence
    // that actually shipped.
    assert(
        "the matcher would have caught the sentence that went out",
        /\.\./.test("Attached is purchase order X from HANYANGENG USA INC.. The order total is $1.00.")
    );
    assert("the body greets the vendor by name", html.includes("Lone Star Pipe & Supply"));
    assert("  names the order and its total once each", html.includes("HYE-PO-20260101-01") && html.includes("$1,234.00"));
    // THE LAST LINE IS WHAT Reply-To IS FOR, SAID OUT LOUD. A vendor who does not know
    // a reply reaches a person will look up a phone number instead.
    assert("  and says a reply reaches the sender", /repl/i.test(html) && html.includes("Soo Choi"));
    // IT MUST NOT RESTATE THE ORDER. The attachment is the order; a mail that listed
    // the items would be a second version of the same figures.
    assert("  it does not itemize", !/qty|unit price|<table|<li>/i.test(html));
    // The vocabulary rules the check for copy constants cannot reach into HTML for.
    for (const barred of [/\bshipment/i, /\barrival/i, /\bbill(s|ed|ing)?\b/i, /\blines?\b/i]) {
        assert(`  and carries no barred word (${barred})`, !barred.test(html) && !barred.test(subject));
    }
    // US English, which `offline/us-english.mjs` covers for app/ and lib/ but which is
    // worth pinning where a vendor reads it.
    for (const brit of ["cancelling", "organisation", "authorised", "despatch"]) {
        assert(`  and no British spelling (${brit})`, !html.includes(brit) && !subject.includes(brit));
    }

    // ── 5. the status name, and the signature axis it joins ─────────────────
    log("");
    log("the status this writes, and what now counts as signed:");
    // PINNED BY VALUE because the Airtable option is a hand edit — Airtable refuses an
    // option-list PATCH — so this string and the option have no shared source. A typo
    // here is a write that fails after the mail has already gone.
    check("the status a send writes", PO_SENT_STATUS, "Sent to Vendor");
    check("the signed set is signed-and-beyond", PO_SIGNED_STATUSES.join("|"), "Signed|Sent to Vendor");
    assert("a sent order counts as signed", isPOSigned("Sent to Vendor"));
    assert("  as does a signed one", isPOSigned("Signed"));
    assert("  and an unsigned one does not", !isPOSigned("Awaiting Signature"));
    assert("  nor a withdrawn one", !isPOSigned("Withdrawn"));
    // AN ALLOWLIST, so a status option added later does not silently count as signed.
    assert("  nor an option nobody has added yet", !isPOSigned("Late Delivery"));
}

if (isMain(import.meta.url)) standalone(title, run);

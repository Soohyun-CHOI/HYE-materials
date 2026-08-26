// Pointing the PO-signed mail at the order it announces (#290).
//
// THE QUIET MUTANT IS A LINK ASSEMBLED FROM AN ARGUMENT NOBODY PASSED. The mail now
// carries the order's url, and nothing about a missing one is an error: the builder
// interpolates `undefined`, the mail goes, `notifyPOSigned` swallows nothing because
// nothing threw, the signature succeeds, and the reader gets a dead link to the one
// screen they now have work on. It is caught here twice, because one assertion cannot
// reach both halves — the BUILDER is asserted behaviorally (a body assembled without
// the url says `undefined`, which is the shape to fail on) and the CALL SITE is
// asserted on the source (the property is passed, by name). Neither is redundant: the
// behavioral half cannot see what `lib/notifications.js` passes, and the source half
// cannot see what the words then say.
//
// WHICH IS ALSO WHY THE COPY IS IN `lib/poSend.js` AND NOT IN `lib/email.js`.
// That module throws at load without `RESEND_API_KEY`, so this tier can never import
// it and can never CALL a body written inside it — the whole behavioral half of the
// mutant above would be unreachable. #281 moved the vendor mail's words out for a
// different reason (a vendor would not recognize a wrong word); this is the second
// reason, and the other three sends stay where they are.
//
// THE SECOND MUTANT IS A MAIL WHOSE SENTENCE AND WHOSE DESTINATION DISAGREE. Nothing
// breaks when copy says "send this to the vendor" over a link to the purchase request:
// the mail arrives, the link works, and the reader lands one document away from the
// page the sentence is about. That is exactly the defect #290 exists to fix, so both
// halves are pinned — the words say what is waiting, and the single href is the
// order's.
//
// AND IT NAMES THE ACT RATHER THAN THE CONTROL, WHICH IS THE ASSERTION THAT LOOKS
// BACKWARDS. Quoting `SEND_COPY.button` would be the natural cross-pin — a renamed
// button could not then leave the mail naming a control that is not there. It is
// deliberately NOT done: `notifyPOSigned` fires BEFORE `generateAndAttachPOPdf` in
// `signPOAction`, and that step can fail, so at the moment this mail is written nobody
// knows whether the page will offer `Send to vendor` or the control that makes the
// missing document (#281's `documentMissing` branch). The mail points at the page and
// the page explains itself.
//
// THE FIFTH SECTION IS NOT ABOUT THIS MAIL. `lib/email.js`'s senders take a
// destructured bag and interpolate it into a template, so every one of them can drop a
// fact silently in the way described above. The contract asserted there — every
// parameter a sender declares is referenced in its body — is the file-level form of
// this issue's mutant, and it is a source assertion because this tier cannot import
// that module to call anything in it.

import { readFileSync } from "node:fs";
import { SEND_COPY, SIGNED_NOTICE_COPY } from "../../../lib/poSend.js";
import {
    callPassesProperty,
    callsTo,
    parseFile,
    parseSource,
    repoPath,
    resolveFunction,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Pointing the PO-signed mail at the order (#290)";

const EMAIL = "lib/email.js";
const NOTIFICATIONS = "lib/notifications.js";

/** One signed order, as the mail sees it. */
const NOTICE = {
    poId: "HYE-PO-20260101-01",
    prId: "HYE-PR-260101-01",
    poUrl: "https://portal.example.com/pos/HYE-PO-20260101-01",
    vendorName: "Lone Star Pipe & Supply",
    // A NUMBER SINCE #292 — the builder formats it. Every assertion about the money
    // itself is in offline/mail-money.mjs, which owns that rule for all five senders.
    totalAmount: 220,
};

/** Every href in a body, in source order. */
function hrefs(html) {
    return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

/**
 * The names a function actually references, as against the ones it declares.
 * Property keys and member accesses are excluded, or `poUrl` would count itself
 * every time the mail wrote `{ poUrl: … }` somewhere else.
 */
function referencedNames(fn) {
    const skip = new Set();
    walk(fn.body, (n) => {
        if (n.type === "Property" && !n.shorthand && !n.computed) skip.add(n.key);
        if (n.type === "MemberExpression" && !n.computed) skip.add(n.property);
    });
    const names = new Set();
    walk(fn.body, (n) => {
        if (n.type === "Identifier" && !skip.has(n)) names.add(n.name);
    });
    return names;
}

/** The names a function's first destructured parameter declares. */
function declaredNames(fn) {
    const first = fn.params[0];
    if (first?.type !== "ObjectPattern") return [];
    return first.properties.map((p) => p.key?.name).filter(Boolean);
}

export function run({ check, assert, log }) {
    // ── 1. it is an instruction now, and it was a notice ─────────────────────
    log("the mail says what is waiting on the reader:");
    const subject = SIGNED_NOTICE_COPY.subject({ poId: NOTICE.poId });
    const html = SIGNED_NOTICE_COPY.html(NOTICE);
    // `Action needed:` is the form the two sends that already ask for something use,
    // so a reader who has met one recognizes this without reading it.
    assert("the subject asks for something", subject.startsWith("Action needed:"));
    assert("  and names the order it is about", subject.includes(NOTICE.poId));
    assert("  and the act, so the subject line alone is actionable", /send/i.test(subject));
    // THE SENTENCE #281's WHOLE GATE RESTS ON. A requester who does not know that
    // sending the order is placing it has no reason to think this is their work.
    assert(
        "the body says that sending the order is what places it",
        /sending the order to the vendor is what places it/i.test(html)
    );
    assert("  and that placing it is the next step", /next step/i.test(html));
    // ANTI-VACUITY: the matcher has to reject the notice this mail used to be, or
    // "it reads as an instruction" is what it would report for any body at all.
    const oldNotice = "<p><strong>HYE-PR-260101-01</strong>'s PO has been signed.</p>";
    assert(
        "  and the matchers reject the notice it replaced",
        !/next step/i.test(oldNotice) && !/is what places it/i.test(oldNotice)
    );

    // ── 2. the destination is the order and nothing else ─────────────────────
    log("");
    log("THE SECOND MUTANT — an instruction over a link to the request:");
    check("one link, not two", hrefs(html).length, 1);
    check("  and it is the order's url", hrefs(html)[0], NOTICE.poUrl);
    assert("  no path to a purchase request anywhere in the body", !/\/prs/.test(html));
    // ANTI-VACUITY: the same matcher has to catch the link that was there, which is
    // the only thing that makes its silence here evidence.
    assert(
        "  and that matcher catches the link this issue removed",
        /\/prs/.test('<p><a href="https://x/prs/HYE-PR-260101-01">Open HYE-PR-260101-01</a></p>')
    );
    // THE REQUEST SURVIVES AS AN IDENTIFIER. A requester knows their own PR ID and has
    // never seen this PO ID, which is generated — without it the mail names nothing
    // they recognize.
    assert("the request is still named in the text", html.includes(NOTICE.prId));
    assert("  and the order is named too", html.includes(NOTICE.poId));

    log("");
    log("THE QUIET MUTANT — the builder's half:");
    assert("a fully-built body says `undefined` nowhere", !html.includes("undefined"));
    // The mutation itself: drop the url the caller is supposed to pass. The mail is
    // still assembled, still sends, and still cannot be acted on.
    const missing = SIGNED_NOTICE_COPY.html({ ...NOTICE, poUrl: undefined });
    assert(
        "  and a body built without the order's url is caught saying it",
        missing.includes("undefined") && hrefs(missing)[0] === "undefined"
    );

    // ── 3. …and the call site's half ────────────────────────────────────────
    log("");
    log("the call site passes it, which no behavioral check can see:");
    const notifications = parseFile(NOTIFICATIONS);
    const notify = resolveFunction(notifications.ast, "notifyPOSigned");
    assert("notifyPOSigned resolves", notify !== null);
    const build = notify ? callsTo(notify, "html")[0] : null;
    assert("  and builds the body from SIGNED_NOTICE_COPY.html", build !== undefined && build !== null);
    if (build) {
        for (const prop of ["poId", "prId", "poUrl", "vendorName", "totalAmount"]) {
            check(`  it passes ${prop}`, callPassesProperty(build, prop), true);
        }
        // ANTI-VACUITY: the property test must be seen to say no, or it reports true
        // for every name asked of it and the mutation above passes.
        check("  and says no to one nobody passes", callPassesProperty(build, "prUrl"), false);
    }
    if (notify) {
        const src = readFileSync(repoPath(NOTIFICATIONS), "utf8").slice(notify.start, notify.end);
        // The url's SHAPE, not just its presence: a property named poUrl holding the
        // request's path is the same defect one level in.
        assert("the url it passes is an order's", /poUrl:\s*`\$\{baseUrl\}\/pos\//.test(src));
        assert("  and the request's path is gone from this function", !src.includes("/prs/"));
        // #292 TOOK THE MONEY ASSERTION THAT STOOD HERE, AND THE RULE DID NOT GO WITH
        // IT — it moved one layer down. This file asserted `totalAmount: formatUSD(`
        // at this call site, which was exactly the fix #290 made; #292 put the
        // formatting inside the builder, so a correct call site now passes the field
        // unformatted and that assertion would fail on the fix. What it stood for is
        // `offline/mail-money.mjs`'s, over all five senders, where the same property
        // is pinned by SHAPE rather than by the call around it.
    }

    // ── 4. the act, never the control ───────────────────────────────────────
    log("");
    log("it names the act and not the button, because the button may not be there:");
    // signPOAction fires this BEFORE generateAndAttachPOPdf, and that step can fail —
    // so the page may offer the control that makes the missing document instead.
    assert("the mail does not quote the send control's label", !html.includes(SEND_COPY.button));
    assert("  and asks for the act instead", /send it to the vendor/i.test(html));
    // ANTI-VACUITY: the label has to be a thing this check could have found.
    assert("  and that label is a real string to have found", SEND_COPY.button.length > 0);
    assert(
        "  nor does it promise a document is attached or ready",
        !/attach/i.test(html) && !/\bpdf\b/i.test(html)
    );

    // ── 5. the vocabulary, where the check for copy constants can reach it ───
    log("");
    log("both strings are readable by the vocabulary rules:");
    for (const barred of [/\bshipment/i, /\barrival/i, /\barrived\b/i, /\bbill(s|ed|ing)?\b/i, /\blines?\b/i]) {
        assert(`  no barred word (${barred})`, !barred.test(html) && !barred.test(subject));
    }
    for (const brit of ["cancelling", "organisation", "authorised", "despatch", "whilst"]) {
        assert(`  no British spelling (${brit})`, !html.includes(brit) && !subject.includes(brit));
    }
    // The product's name belongs to the From header and to nothing else (#201), and a
    // mail body is one of the places it would look natural and be wrong.
    assert("  and the body does not name the product", !/HYE USA Portal/.test(html));

    // ── 6. the file-level form of the same mutant ───────────────────────────
    log("");
    log("every sender in lib/email.js uses every fact it is given:");
    const email = parseFile(EMAIL);
    const SENDERS = [
        "sendMagicLinkEmail",
        "sendSignerTurnEmail",
        "sendPOAwaitingSignatureEmail",
        "sendPOToVendorEmail",
        "sendPOSignedEmail",
    ];
    for (const name of SENDERS) {
        const fn = resolveFunction(email.ast, name);
        assert(`${name} resolves`, fn !== null);
        if (!fn) continue;
        const declared = declaredNames(fn);
        assert(`  ${name} takes a destructured bag`, declared.length > 0);
        const referenced = referencedNames(fn);
        const dropped = declared.filter((n) => !referenced.has(n));
        check(`  and drops none of its ${declared.length}`, dropped.join(","), "");
    }
    // ANTI-VACUITY: a parameter that goes nowhere has to be visible to this, or the
    // section is five passes about nothing. The planted sender drops one fact and puts
    // the same word somewhere the walker must not count — a property key and a member
    // access — which is what `referencedNames` excludes them for.
    const planted = resolveFunction(
        parseSource(
            "async function probe({ to, dropped, used }) {\n" +
                "  return send({ to, dropped: used, body: `${used}` , extra: used.dropped });\n" +
                "}"
        ).ast,
        "probe"
    );
    assert("the walker resolves the planted sender", planted !== null);
    if (planted) {
        const missed = declaredNames(planted).filter((n) => !referencedNames(planted).has(n));
        check("  and reports the fact it drops", missed.join(","), "dropped");
    }

    // #290 — the sender writes no words of its own any more, which is what makes the
    // builder the single place the body can be got wrong. Same shape #281 gave
    // sendPOToVendorEmail.
    const signed = resolveFunction(email.ast, "sendPOSignedEmail");
    if (signed) {
        const src = readFileSync(repoPath(EMAIL), "utf8").slice(signed.start, signed.end);
        assert("sendPOSignedEmail assembles no HTML", !src.includes("<p>") && !src.includes("<a "));
        check("  and takes the words already built", declaredNames(signed).join(","), "to,subject,html");
    }
}

if (isMain(import.meta.url)) standalone(title, run);

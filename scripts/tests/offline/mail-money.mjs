// Every money figure the app emails (#292).
//
// THE QUIET MUTANT IS THE SIXTH MAIL, NOT THE FIVE THAT EXIST. #290 found the
// order-signed mail printing `220.00000000000003` and routed that one figure through
// `formatUSD`; #292 found the same shape on the mail asking the President to sign, two
// issues and one reader later. Fixing three bodies changes nothing about the next one:
// somebody adds a seventh sender, interpolates a total the way the file's own
// neighbours did, and no check, no type and no screen says a word. So the FIRST thing
// asserted here is not about money at all — it is that the inventory of senders in
// `lib/email.js` is complete, and a new one fails this file until it is classified as
// carrying a figure or not.
//
// WHAT IS STRUCTURAL AND WHAT IS ENUMERATED, kept apart because only one of them
// holds on its own. **Structural:** money reaches a mail only as a NUMBER handed to a
// pure copy builder, which renders it — so no sender takes a money parameter and no
// call site has a formatting step to forget. **Enumerated:** which senders carry money
// at all, which is the table below. The structural half is what makes the fix
// permanent for the three mails that exist; the enumerated half is what notices a
// fourth.
//
// WHY THE BODIES HAVE TO BE PURE BUILDERS AT ALL, since it looks like ceremony:
// `lib/email.js` throws at module load without `RESEND_API_KEY`, so this tier can
// never import it. A body assembled in there can be read as source and never CALLED,
// which means no check can ever ask what figure it would print. #290 moved the first
// mail out for that reason and #292 generalized it: a mail carrying a figure is a
// builder, a mail carrying none stays where its own issue put it.
//
// THE SECOND MUTANT IS THE RIGHT CALL WITH THE WRONG VALUE. `itemsSubtotal` instead of
// `totalAmount` formats just as prettily, and a formatted string passed where a number
// belongs coerces to `$0.00` in silence — `formatUSD` does `Number(value) || 0`. Both
// are one assertion: the money property at each call site has to be the order's own
// field, not a call around it and not a literal.
//
// WHAT THIS CANNOT SEE, and it is the price of an inventory keyed on names. The money
// test for a no-money sender is a list of money-ish parameter names, so a seventh mail
// that carries a figure in a parameter called `figure` passes clause 2 — it still
// fails the inventory until somebody classifies it, and the classification is where a
// human has to be honest. Nothing here reads a mail that has been sent, either: what a
// reader received is proved by sending one and looking, which is in the pull request.

import { readFileSync } from "node:fs";
import { SEND_COPY, SIGNED_NOTICE_COPY } from "../../../lib/poSend.js";
import { AWAITING_SIGNATURE_COPY } from "../../../lib/poUnsigned.js";
import { formatUSD } from "../../../lib/format.js";
import { callsTo, parseFile, parseSource, repoPath, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every money figure the app emails (#292)";

const EMAIL = "lib/email.js";
const NOTIFICATIONS = "lib/notifications.js";
const SEND_ACTION = "app/pos/[poId]/actions.js";

/**
 * THE INVENTORY. Every `send*Email` exported by `lib/email.js`, and whether it puts a
 * money figure in front of a reader. A sender missing from here fails this file, and
 * so does an entry with no sender — the shape `offline/edit-log-fields.mjs` uses for
 * the label list and `line-vocabulary.mjs` for the surviving identifiers.
 */
const SENDERS = {
    sendMagicLinkEmail: {
        money: false,
        why: "a link and a TTL in minutes; no figure of any kind",
    },
    sendSignerTurnEmail: {
        money: false,
        why:
            "a request id and a link. `context` is free text and its one caller passes" +
            " a human's correction note, so nothing the app computes reaches it",
    },
    sendPOAwaitingSignatureEmail: {
        money: true,
        builder: "lib/poUnsigned.js:AWAITING_SIGNATURE_COPY",
        why: "the order's total, for the President deciding whether to sign",
    },
    sendPOToVendorEmail: {
        money: true,
        builder: "lib/poSend.js:SEND_COPY.mail",
        why: "the order's total, named once so a vendor can see the right document came",
    },
    sendPOSignedEmail: {
        money: true,
        builder: "lib/poSend.js:SIGNED_NOTICE_COPY",
        why: "the order's total, so the requester recognizes the order they must place",
    },
};

/** Parameter names that would mean a sender is being handed money. */
const MONEY_NAMES = [
    "totalAmount",
    "amount",
    "amountDue",
    "subtotal",
    "itemsSubtotal",
    "total",
    "unitPrice",
    "price",
    "shippingFee",
    "tariff",
    "salesTax",
];

/** The exported `send*Email` names a source file declares. */
function senderNames(ast) {
    const found = [];
    for (const node of ast.body) {
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : null;
        if (decl?.type === "FunctionDeclaration" && /^send.*Email$/.test(decl.id?.name || "")) {
            found.push(decl.id.name);
        }
    }
    return found.sort();
}

/** The names a function's first destructured parameter declares. */
function declaredNames(fn) {
    const first = fn.params[0];
    if (first?.type !== "ObjectPattern") return [];
    return first.properties.map((p) => p.key?.name).filter(Boolean);
}

/** The `totalAmount` property node inside a builder call, with its source text. */
function moneyProperty({ relPath, fn, callee }) {
    const source = readFileSync(repoPath(relPath), "utf8");
    for (const call of callsTo(fn, callee)) {
        let found = null;
        walk(call, (n) => {
            if (n.type === "Property" && n.key?.name === "totalAmount" && !found) found = n;
        });
        if (found) return { node: found.value, text: source.slice(found.value.start, found.value.end) };
    }
    return null;
}

export function run({ check, assert, log }) {
    // ── 1. the inventory, which is what sees a mail nobody has written yet ───
    log("THE QUIET MUTANT — a sender this file has never heard of:");
    const email = parseFile(EMAIL);
    const declared = senderNames(email.ast);
    const classified = Object.keys(SENDERS).sort();
    check("every sender in lib/email.js is classified here", declared.join(","), classified.join(","));
    assert("  and there are senders to classify at all", declared.length > 0);
    // ANTI-VACUITY: the enumeration has to be seen finding one it does not know, or
    // "the lists match" is what it reports for a walker that finds nothing.
    const planted = senderNames(
        parseSource(
            "export async function sendMagicLinkEmail({ to }) {}\n" +
                "export async function sendOverdueInvoiceEmail({ to, amountDue }) {}\n"
        ).ast
    );
    assert("the walker finds a sender that is not in the table", planted.includes("sendOverdueInvoiceEmail"));
    assert(
        "  and a table missing it would not match",
        planted.join(",") !== Object.keys(SENDERS).sort().join(",")
    );
    // Every classification carries its reason, so the next reader inherits the count
    // rather than redoing it.
    for (const [name, entry] of Object.entries(SENDERS)) {
        assert(`  ${name}: ${entry.money ? "money" : "no money"} — ${entry.why}`, Boolean(entry.why));
    }

    // ── 2. no sender is handed money, whatever it carries ───────────────────
    log("");
    log("money reaches a mail as words, never as a figure a sender interpolates:");
    for (const name of declared) {
        const fn = resolveFunction(email.ast, name);
        assert(`${name} resolves`, fn !== null);
        if (!fn) continue;
        const params = declaredNames(fn);
        const money = params.filter((p) => MONEY_NAMES.includes(p));
        check(`  ${name} takes no money parameter`, money.join(","), "");
        // A money-carrying mail takes its words already built — the only shape in
        // which this tier can ask what figure it prints.
        if (SENDERS[name]?.money) {
            assert(`  and ${name} takes subject and html`, params.includes("subject") && params.includes("html"));
            const src = readFileSync(repoPath(EMAIL), "utf8").slice(fn.start, fn.end);
            assert(`  and assembles no body of its own`, !src.includes("<p>"));
        }
    }
    // ANTI-VACUITY: the money-name filter has to reject the parameter list this issue
    // removed, or clause 2 passes for any function at all.
    assert(
        "the money-name filter catches the parameter list #292 took out",
        ["to", "prId", "poId", "poUrl", "vendorName", "totalAmount"].filter((p) => MONEY_NAMES.includes(p))
            .length === 1
    );

    // ── 3. each builder renders its own figure ──────────────────────────────
    log("");
    log("every mail that shows money formats it inside the builder:");
    const BUILDERS = [
        {
            label: "AWAITING_SIGNATURE_COPY",
            html: (totalAmount) =>
                AWAITING_SIGNATURE_COPY.html({
                    poId: "HYE-PO-20260101-01",
                    prId: "HYE-PR-260101-01",
                    poUrl: "https://portal.example.com/pos/HYE-PO-20260101-01",
                    vendorName: "Lone Star Pipe & Supply",
                    totalAmount,
                }),
        },
        {
            label: "SIGNED_NOTICE_COPY",
            html: (totalAmount) =>
                SIGNED_NOTICE_COPY.html({
                    poId: "HYE-PO-20260101-01",
                    prId: "HYE-PR-260101-01",
                    poUrl: "https://portal.example.com/pos/HYE-PO-20260101-01",
                    vendorName: "Lone Star Pipe & Supply",
                    totalAmount,
                }),
        },
        {
            label: "SEND_COPY.mail",
            html: (totalAmount) =>
                SEND_COPY.mail.html({
                    poId: "HYE-PO-20260101-01",
                    buyerName: "HANYANGENG USA INC.",
                    vendorName: "Lone Star Pipe & Supply",
                    totalAmount,
                    senderName: "Soo Choi",
                }),
        },
    ];
    // THE FLOAT IS THE CASE NO REAL SEND ON THIS BASE REPRODUCES, so it is proved here.
    // `220.00000000000003` is what `Total Amount` holds for a 200 × 1.10 order, and it
    // is the figure that actually went out before #290.
    for (const b of BUILDERS) {
        const raw = b.html(220.00000000000003);
        assert(`${b.label} renders the float as money`, raw.includes("$220.00"));
        assert(`  and never as its own digits`, !raw.includes("220.00000000000003"));
        const whole = b.html(260);
        assert(`  a whole number gains the symbol and the cents`, whole.includes("$260.00"));
        assert(`    and does not print bare`, !/[^$.,\d]260(?![.,\d])/.test(whole.replace("$260.00", "")));
        // A STRING WHERE A NUMBER BELONGS IS LOST, NOT ECHOED, which is why clause 4
        // pins the call sites rather than trusting them.
        const stringy = b.html("$260.00");
        assert(`  a pre-formatted string is silently lost`, !stringy.includes("$260.00") && stringy.includes("$0.00"));
    }
    // `formatUSD` IS UNCHANGED BY THIS ISSUE AND ITS BLANK RULE IS PINNED HERE, because
    // the builders now inherit it: a total nobody could read prints as a confident
    // zero, which is the ambiguity `purchase-orders.md` records under #292 and does not
    // fix. A later change to that rule should have to walk past this line.
    check("formatUSD renders a missing value as zero", formatUSD(null), "$0.00");
    check("  and undefined the same way", formatUSD(undefined), "$0.00");
    check("  and a real figure as money", formatUSD(220.00000000000003), "$220.00");

    // ── 4. the call sites hand over the field itself ────────────────────────
    log("");
    log("THE SECOND MUTANT — the right builder with the wrong value:");
    const CALL_SITES = [
        { relPath: NOTIFICATIONS, fn: "notifyPOAwaitingSignature", callee: "html" },
        { relPath: NOTIFICATIONS, fn: "notifyPOSigned", callee: "html" },
        { relPath: SEND_ACTION, fn: "sendPOToVendorAction", callee: "html" },
    ];
    for (const site of CALL_SITES) {
        const parsed = parseFile(site.relPath);
        const fn = resolveFunction(parsed.ast, site.fn);
        assert(`${site.fn} resolves`, fn !== null);
        if (!fn) continue;
        const money = moneyProperty({ relPath: site.relPath, fn, callee: site.callee });
        assert(`  ${site.fn} passes a total`, money !== null);
        if (!money) continue;
        // The order's own field, so neither a sibling figure nor a rendering of it can
        // stand in: `po.itemsSubtotal` reads as money and is the wrong money, and
        // `formatUSD(po.totalAmount)` is a string this builder would drop.
        check(`  and it is the order's total`, money.text, "po.totalAmount");
        check(`    passed as the field rather than a call`, money.node.type, "MemberExpression");
    }
    // ANTI-VACUITY: both mutations have to be things this test says no to.
    assert("the shape test rejects a sibling figure", "po.itemsSubtotal" !== "po.totalAmount");
    assert(
        "  and rejects a formatted string",
        parseSource("f({ totalAmount: formatUSD(po.totalAmount) })").ast.body[0].expression.arguments[0]
            .properties[0].value.type === "CallExpression"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

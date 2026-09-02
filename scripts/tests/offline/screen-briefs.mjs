// The screen briefs describe the screens that exist (#260).
//
// docs/briefs/ is the design work's only input — it runs in a tool that does not
// read this repository, so a brief that has gone stale is not corrected by anyone
// noticing the code. That is the failure this check exists for, and it is a
// different failure from the ones the rest of this tier watches: nothing breaks, no
// screen misrenders, and the wrong document is simply believed.
//
// WHAT IT CANNOT SEE, said here rather than in a footnote, because it is most of
// what a brief asserts:
//
//   1. Whether a screen renders what its brief says it renders. The offline tier
//      reads source and pure functions and never renders a page, so a fact this
//      check confirms is present in a CONSTANT may still not reach a browser. That
//      gap is stated in CLAUDE.md and is not narrowed here.
//   2. Whether a conditional is really conditional. "What it carries only
//      sometimes" is the most load-bearing section of every brief — #232 and #241
//      silenced things that a designer will otherwise draw as always present — and
//      it is prose about rendering, which this tier cannot reach at all.
//   3. Whether the readership claims hold. Source shape is not execution: a gate
//      inside `if (false)` satisfies a structural check, so "who reaches it" is
//      verified by authz-structure.mjs at the shape level and by a browser with the
//      two fixture accounts, never here.
//   4. Two copy constants cannot be loaded at all. lib/poWithdraw.js and
//      lib/deliveryDelete.js both import lib/airtable/*, which throws at module
//      load without credentials, so DELETE_COPY and WITHDRAW_COPY are outside this
//      tier by the same boundary that keeps every credentialed module out. The
//      briefs mark their words as tier 2 for that reason and this check falls back
//      to the weaker question — does the literal still appear under app/ — which
//      proves the string is somewhere rather than that it is still the constant's
//      value.
//
// A word written straight into JSX gets that same weaker treatment, and #227's
// sweep does not reach it either — recorded in docs/notes against the phrase
// `— attached to this invoice`.
//
// THE FILENAME IS DERIVED, NOT TYPED, which is the property that lets the first
// assertion be an exact equality in both directions. A brief's name comes from the
// route template the same way `withOpsLabel`'s label does, so a name cannot
// disagree with the screen it is about, and there is no exemption list to go stale.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { listJsFiles, repoPath, toPosix, REPO_ROOT } from "./_ast.mjs";
import { listEntryPoints, countEntryPointFiles, routeTemplate } from "./_entrypoints.mjs";
import {
    STATUS_COPY,
    AWAITING_INVOICE_COPY,
    AWAITING_DELIVERY_COPY,
    orderedItemStatus,
} from "../../../lib/deliveryStatus.js";
import { ITEM_PRECISION_COPY, VARIANCE_COPY } from "../../../lib/variance.js";
import { AWAITING_PO_COPY, AWAITING_SEND_COPY, EMPTY_COPY } from "../../../lib/poListView.js";
import { CONFIRM_COPY } from "../../../lib/authTokenState.js";
import { PO_DOCUMENTS_COPY } from "../../../lib/poDocuments.js";
import { LINK_COPY } from "../../../lib/deliveryInvoiceLink.js";
import { ALLOCATION_COPY } from "../../../lib/deliveryAllocation.js";
import { OVERAGE_COPY } from "../../../lib/overage.js";
import { DIRECT_PURCHASE_COPY } from "../../../lib/directPurchase.js";
import { WAIT_COPY } from "../../../lib/prWait.js";
import { PR_KIND_COPY } from "../../../lib/prKind.js";
import { RESTORE, ROLLBACK_COPY } from "../../../lib/rollbackReport.js";
import { MAX_UPLOAD_BYTES, UPLOAD_LIMIT_COPY } from "../../../lib/uploadLimit.js";
import { FILE_AXIS_LABEL, FILE_VIEWER_COPY } from "../../../lib/fileLinks.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The screen briefs describe the screens that exist (#260)";

const BRIEFS_DIR = "docs/briefs";

/** The shared brief, and the README. Neither is a screen. */
const NON_SCREEN = new Set(["_shared.md", "README.md"]);

/**
 * A route template's brief filename. The one hand-held case is "/", which has no
 * segment to name it after; every other route is mechanical.
 */
export function briefFileName(route) {
    if (route === "/") return "root.md";
    return route.replace(/^\//, "").replace(/\//g, "-").replace(/[[\]]/g, "") + ".md";
}

/**
 * The status object handed to every copy builder below — BUILT BY THE JUDGMENT
 * RATHER THAN WRITTEN OUT (#274).
 *
 * IT WAS A LITERAL AND THAT LITERAL WAS A SILENT FAILURE. Two copies of
 * `{ invoiced, billedNotDelivered, delivered, billedBeyondOrder, deliveredBeyondOrder }`
 * stood at the two call sites, naming fields of `orderedItemStatus`'s shape as INPUT
 * keys. #274 renamed two of those fields; had the literals not been renamed with
 * them, every builder would have read `undefined` and this file would still have
 * passed 36 of 36 — the tone set stays seven whatever the figures are, and no pinned
 * sentence carries one. Measured before the fix: `15 EA more invoiced …` became
 * `undefined EA more invoiced …`, and `Against the ordered item:` dropped its
 * invoiced term entirely while every check stayed green.
 *
 * Deriving it removes the hazard rather than documenting it: the producer names the
 * keys, so a rename carries them. The four figures are exactly the old literal's —
 * ordered 25 and invoiced 30 put 5 beyond the order, 12 within plus 3 over put 15
 * delivered and 15 not invoiced. `ordered` and `deliveredWithin` come along unread.
 */
const SAMPLE_STATUS = orderedItemStatus({
    orderedQty: 25,
    invoicedQty: 30,
    deliveredWithinQty: 12,
    deliveredOverQty: 3,
});

/** The four sections every screen brief carries, in this order. */
const REQUIRED_HEADINGS = [
    "## What it answers",
    "## What it always carries",
    "## What it carries only sometimes",
    "## What must agree elsewhere",
];

/** Every `tone` a STATUS_COPY builder can return, walked rather than grepped. */
function tonesInStatusCopy() {
    const tones = new Set();
    const sample = SAMPLE_STATUS;
    const visit = (value) => {
        if (typeof value === "function") {
            try {
                const result = value(sample, "EA");
                if (result?.tone) tones.add(result.tone);
            } catch {
                /* a builder with another shape carries no tone */
            }
        } else if (value && typeof value === "object") {
            Object.values(value).forEach(visit);
        }
    };
    visit(STATUS_COPY);
    return tones;
}

/**
 * Every string a copy constant can produce — its literals AND its builders' output.
 *
 * The builders matter more than the literals: most of the sentences a brief quotes
 * are returned by a function, so a version of this that walked only literals would
 * have almost nothing to compare against and would pass by looking at very little.
 */
function stringsFrom(value, out = []) {
    const sample = SAMPLE_STATUS;
    if (typeof value === "string") {
        out.push(value);
    } else if (typeof value === "function") {
        for (const args of [[sample, "EA"], [1], []]) {
            try {
                const r = value(...args);
                if (r === undefined) continue;
                stringsFrom(r, out);
                break;
            } catch {
                /* try the next shape */
            }
        }
    } else if (value && typeof value === "object") {
        Object.values(value).forEach((v) => stringsFrom(v, out));
    }
    return out;
}

/**
 * The sentences the briefs quote FROM a loadable constant, named explicitly.
 *
 * WHY A LIST RATHER THAN A SWEEP, and this was measured: the first version asked of
 * every backticked phrase in every brief whether some constant still held it, and
 * flagged 140 of them. Almost all were screen text written straight into JSX, a
 * field name, or a placeholder — tier 3 in the briefs' own terms — and no filter
 * separates "a phrase that should be in a constant" from "a phrase that never was"
 * without naming one of the two sets. So the set is named.
 *
 * The failure this catches is the one that matters: a constant reworded while a
 * brief goes on quoting the old sentence to a designer. A quotation ADDED to a brief
 * and not added here is uncovered rather than wrongly passed, and the count logged
 * below is what makes that coverage visible instead of assumed.
 */
const PINNED = [
    "⚠ Order variance",
    "⚠ Check the total",
    // #254 — the third string in the same constant, and the one whose whole reason
    // for existing separately is a tense. `invoices-new.md` quotes it with `N` where
    // the builder puts a figure, so it is pinned without them, as the sentences
    // below are.
    "doesn't match the calculated total",
    // #254 — the two refusals that hold the threshold's premise up. Both briefs
    // quote them verbatim, and they are the only place the app states the rule to a
    // reader, so a rewording that left a brief behind would be telling a designer
    // about a message the app no longer sends.
    //
    // #303 — THEY SAID `charge` AND THIS PIN IS WHY THE BRIEFS FOLLOWED. The noun
    // moved to `item` when an `Invoice Items` row took its own table's name; both
    // briefs quote these two, and the pin is what turned a copy edit into a failing
    // check until they did.
    "Every item's quantity has to be a whole number.",
    "Every item's unit price has to be a whole number of cents.",
    // #303 — the invoice-level prompt, whose noun moved with them. `_shared.md`
    // called it a locked word and quoted it nowhere, so it was the pair's third
    // string and the only one a rewording could have taken silently.
    "⚠ An item on this invoice differs from what its order agreed",
    // #274 — THE THREE `_shared.md` CALLS TIER 1 AND NOTHING PINNED. Its status
    // section quotes four sentences from `lib/deliveryStatus.js` as locked words;
    // only `Not compared — no ordered item` above was ever pinned, so the other
    // three could be reworded in the constant while the brief went on quoting the
    // old wording to a designer. This issue reworded all three, which is the moment
    // to close it. Each is pinned WITHOUT its figure, because the brief writes `N`
    // where a builder puts a number — the pin is the wording, which is what a
    // redesign may not change.
    "⚠ This invoice charges more than the delivery matched to it delivered",
    "more invoiced than the matched delivery delivered",
    "invoiced, none of it delivered by the matched delivery",
    "Longest wait first. No invoice yet covers what these deliveries brought.",
    "Longest wait first. Nothing has confirmed the material these invoices charge for.",
    // #263 — THE THRESHOLD SENTENCE, PINNED WITHOUT ITS FIGURE like the three above,
    // and for a reason this one makes sharper: the brief writes `N` where the constant
    // interpolates `AWAITING_DELIVERY_DAYS`, so a pin carrying the number would fail
    // the day the threshold is tuned — which is the one edit its own docstring says to
    // expect. The wording is what a redesign may not change; the figure is meant to.
    "Only invoices that have waited",
    "nothing delivered yet",
    "delivered, not matched",
    "No invoice charges this order yet.",
    "Nothing has been delivered against this order yet.",
    "No purchase orders yet. One is generated automatically when a purchase request is fully approved.",
    "No purchase orders to show. You see a purchase order when you can see the request behind it.",
    "No purchase orders match these filters.",
    "Generation failed when the request was approved. Generate the order here.",
    // #295 — the second strip on `/pos`. Pinned like the other strips' lines and
    // without the figure, which the heading interpolates. The last clause is the one
    // that has to survive a rewording: it is why the state matters, and #281 is the
    // only place a reader learns that sending IS placing the order.
    "received these, and sending one to the vendor is what places the order.",
    "This sign-in link has already been used.",
    "This sign-in link has expired. Sign-in links last 15 minutes.",
    "Press the button to finish signing in on this device.",
    "Confirm sign-in",
    "That invoice no longer exists.",
    "No invoice from this vendor has been entered yet, so there is nothing to attach.",
    "One invoice belongs to one delivery, so one already attached elsewhere is",
    "Nothing on this job orders this item from this vendor, so there is no order to",
    "✓ Paid",
    "Not paid",
    "Over-delivered",
    // #311 — THE PAYMENT AXIS, AND TWO OF ITS FIVE STRINGS ARE PINNABLE. `Not paid`
    // is already above and now carries this axis too, which is the convergence this
    // issue made: the invoice list said `Unpaid`, the order detail's badge said
    // `Not paid`, and a third surface would have made three words for one fact.
    //
    // `Paid` IS DELIBERATELY NOT PINNED, AND THE REASON IS THE MATCHER. A pin passes
    // when the string appears anywhere in a loadable constant and anywhere in a
    // brief, and `Paid` is a substring of `✓ Paid` two lines up — so pinning it would
    // assert nothing that entry does not already assert, while reading as coverage.
    // The dash is out for the same reason it always is: `absent` is not a word.
    "Partly paid",
    "⚠ Overdue",
    // #316 — THE SAME BADGE ONE SCOPE DOWN, AND BOTH PINS ARE WORDING WITHOUT A
    // FIGURE, as the four above are. `⚠ Overdue` is already pinned and now carries two
    // scopes: the order list's whole badge, and the first word of the invoice list's,
    // which opens with it so one fact does not become two names across three screens.
    // What this adds is the part that is only the invoice's — the separator before the
    // day count, and the clause the sentence states it against. Neither carries the
    // number, which is the one thing in both strings meant to change per row.
    "⚠ Overdue ·",
    "past its due date",
    // #272 — THE STRIP ABOVE `/prs` WAS QUOTED IN A BRIEF AND PINNED NOWHERE, and
    // this issue is what found it: the vocabulary sweep reworded the heading, the
    // explanation and the block heading on the delivery detail, and every check
    // stayed green while `prs.md` went on quoting the old sentences to a designer.
    // That is the exact drift this list exists to catch, so the strip's own words
    // join it. The heading is pinned without its figure, as the three above are.
    // A PIN MUST NOT CROSS THE BRIEF'S OWN LINE WRAP, which is why the second of
    // these starts mid-sentence: the briefs wrap at 72 characters and this one
    // breaks after `A`, so the longer form matched the constant and not the brief.
    // #331 — THE VIEWER'S WORDS, AND FOUR OF THE NINE ARE DELIBERATELY NOT HERE.
    // `_shared.md` gained an `Uploaded files` block quoting all of them; these are
    // the ones a pin can actually hold. `Quotation`, `Invoice file`, `Download` and
    // `Close` are words this app uses in other constants, so a pin on one would go on
    // passing after the viewer stopped saying it — the same matcher objection that
    // keeps `Paid` off this list. The two labels below are distinctive enough that a
    // rewording fails.
    "Purchase order PDF",
    "Packing list photo",
    // The three sentences that stand in for a file, pinned on their distinctive
    // clause rather than whole: the briefs wrap, and the first of these is long
    // enough that the full sentence would match the constant and not the brief.
    // The first one is the load-bearing one — it is not a state and cannot be, since
    // nothing can detect that a document failed to render, so a design that turns it
    // into a conditional is drawing something unreachable.
    "this browser cannot show it here",
    "This file cannot be shown here",
    "This file could not be loaded.",
    "over-deliveries are waiting for a request",
    "row with everything it needs raises the request here",
    // The five chips the same paragraph names. `prs.md` used to say how many there
    // were and was wrong twice; it names them now, which is only worth doing if the
    // names are held to the constant.
    "no invoice yet",
    "invoice and delivery disagree",
    "spans two invoices",
    "invoices differ on price",
    "invoice has no file",
    // #272 — the second strip's own words, pinned as the first strip's now are, and
    // the chip they share. `draft with` is pinned without a name for the reason the
    // heading above is pinned without its figure: the brief writes an example where
    // the constant interpolates.
    "direct purchases are waiting for a request",
    "recorded these from a vendor's invoice",
    // The way out of an invoice with no order, and the modal it opens. The label was
    // reworded once already — `Bought without an order?` spent `order` on the act of
    // ordering, which `Purchase Orders` owns and the site had in fact done — so it is
    // exactly the kind of string a brief goes on quoting after the screen has moved.
    "No PO for this invoice?",
    "Record a direct purchase",
    "no invoice number",
    "View invoice",
    "draft with",
    // #272 — the kind marks. Two words rather than one repeated is what the offline
    // check pins; that the BRIEFS still quote them is what this pins, and the two
    // together are what stops a designer being handed a word the app no longer says.
    "Overage",
    "Direct purchase",
    "rather than authorizing a new one",
    // #188 — the three refusals a rollback that did not finish returns, pinned by
    // the clause that carries the whole decision: a reader who follows the ordinary
    // failure's advice here commits the edit and destroys the record of it. The
    // three differ only in the act, so all three are pinned rather than one standing
    // for the set — a rewording that reached two of them is the likelier drift.
    "Do not save again",
    "Do not approve again",
    "Do not send it back again",
    "Ask for these to be corrected in Airtable",
    // #146 — the one refusal five screens share, pinned WITHOUT either figure for the
    // reason the threshold sentence above is: the briefs write where the sizes go, and
    // both of them are meant to move. The file's size moves per file; the limit moves
    // the day somebody raises it, which `lib/uploadLimit.js` exists to make possible.
    // What a redesign may not change is the wording, and this is the one string in the
    // app that five briefs quote at once.
    "This file is larger than the upload limit",
];

export function run({ check, assert, log }) {
    const dir = repoPath(BRIEFS_DIR);
    assert(`${BRIEFS_DIR}/ exists`, existsSync(dir));
    const onDisk = readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert("the briefs directory is not empty", onDisk.length > 0);

    const screenFiles = onDisk.filter((f) => !NON_SCREEN.has(f));
    // LINE ENDINGS NORMALIZED, AND THIS WAS A LIVE DEFECT (#256). The structural scan
    // below looks for "\n## …\n"; this working tree is CRLF, so it matched nothing and
    // reported every brief as missing every section. It passed in the branch that added
    // it because the files had just been written with LF and only became CRLF on the
    // checkout after the merge — a check that is green for its author and red for
    // everyone after. Normalizing once here is what notes-index.mjs already does to
    // CLAUDE.md, and it makes every matcher below indifferent to the ending.
    const briefText = new Map(
        onDisk.map((f) => [
            f,
            readFileSync(repoPath(`${BRIEFS_DIR}/${f}`), "utf8").replace(/\r\n/g, "\n"),
        ])
    );

    // --- one brief per page, both directions -----------------------------
    log("every page has a brief and every brief has a page:");
    const parseErrors = [];
    const { entries } = listEntryPoints({ onParseError: (m) => parseErrors.push(m) });
    check("every file under the scan roots parsed", parseErrors.length === 0 ? "none" : parseErrors.join("; "), "none");

    const routes = entries.filter((e) => e.kind === "page").map((e) => routeTemplate(e.file));
    assert("the enumeration found pages at all", routes.length > 0);

    // ANTI-VACUITY, and the reason is _entrypoints.mjs's own: an assertion that
    // asks "did it find any pages" cannot see an enumeration that finds SOME.
    // countEntryPointFiles() counts page.js BY NAME and shares no predicate with
    // the enumeration, so it has to disagree if the enumeration ever narrows.
    const byName = countEntryPointFiles();
    check("the enumeration found as many pages as there are page.js files", routes.length, byName.page);

    const expected = new Set(routes.map(briefFileName));
    const missing = [...expected].filter((f) => !screenFiles.includes(f)).sort();
    check("no page without a brief", missing.length === 0 ? "none" : missing.join(", "), "none");

    const extra = screenFiles.filter((f) => !expected.has(f)).sort();
    check("no brief without a page", extra.length === 0 ? "none" : extra.join(", "), "none");

    // --- each brief declares the route its filename claims ---------------
    log("");
    log("each brief's own Route line agrees with its filename:");
    const routeMismatches = [];
    for (const [file, text] of briefText) {
        if (NON_SCREEN.has(file)) continue;
        const declared = text.match(/^Route:\s*`([^`]+)`/m)?.[1];
        if (!declared) routeMismatches.push(`${file}: no Route line`);
        else if (briefFileName(declared) !== file) routeMismatches.push(`${file}: declares ${declared}`);
    }
    check(
        "no brief whose Route line and filename disagree",
        routeMismatches.length === 0 ? "none" : routeMismatches.join("; "),
        "none"
    );

    const noReader = [...briefText]
        .filter(([f]) => !NON_SCREEN.has(f))
        .filter(([, t]) => !/^Who reaches it:/m.test(t))
        .map(([f]) => f);
    check("no brief without a `Who reaches it` line", noReader.length === 0 ? "none" : noReader.join(", "), "none");

    // --- the four sections ------------------------------------------------
    log("");
    log("each brief carries the four sections, in order:");
    const structureFailures = [];
    for (const [file, text] of briefText) {
        if (NON_SCREEN.has(file)) continue;
        let cursor = -1;
        for (const heading of REQUIRED_HEADINGS) {
            const at = text.indexOf(`\n${heading}\n`);
            if (at === -1) {
                structureFailures.push(`${file}: missing "${heading}"`);
                break;
            }
            if (at < cursor) {
                structureFailures.push(`${file}: "${heading}" out of order`);
                break;
            }
            cursor = at;
        }
    }
    check(
        "no brief missing a section or carrying them out of order",
        structureFailures.length === 0 ? "none" : structureFailures.join("; "),
        "none"
    );

    // --- the tone vocabulary ---------------------------------------------
    log("");
    log("the shared brief lists exactly the tones the code can produce:");
    const shared = briefText.get("_shared.md");
    assert("_shared.md is present", Boolean(shared));

    const tones = tonesInStatusCopy();
    // The two verdict tones come from the same module and the same walk; asserting
    // the count here is what makes a tone SILENTLY DROPPED from STATUS_COPY visible,
    // since a shrunken set would otherwise agree with a shrunken brief.
    // SIX SINCE #278, WHICH TOOK `unjudged` WITH ITS ONLY PRODUCER — the verdict for a
    // charge with no ordered item. This count is what makes a tone silently DROPPED
    // visible, since a shrunken set would otherwise agree with a shrunken brief, so
    // the number moving is the point rather than an inconvenience.
    check("STATUS_COPY reaches six tones", tones.size, 6);

    const unlisted = [...tones].filter((t) => !shared.includes(`\`${t}\``)).sort();
    check("no tone the shared brief does not name", unlisted.length === 0 ? "none" : unlisted.join(", "), "none");

    // The other direction: a tone the brief invents, or one left behind by a
    // rename in the code. Backticked single words in the two tone tables only.
    const claimed = [...shared.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
    assert("the tone tables were parsed", claimed.length > 0);
    const notReal = claimed.filter((t) => !tones.has(t)).sort();
    check("no tone named in the brief that the code cannot produce", notReal.length === 0 ? "none" : notReal.join(", "), "none");

    // --- quoted words are still the constants' words ----------------------
    log("");
    log("every word the shared brief quotes is still what the constant holds:");
    const loadable = [
        ...stringsFrom(VARIANCE_COPY),
        ...stringsFrom(ITEM_PRECISION_COPY),
        ...stringsFrom(EMPTY_COPY),
        ...stringsFrom(CONFIRM_COPY),
        ...stringsFrom(PO_DOCUMENTS_COPY),
        ...stringsFrom(LINK_COPY),
        ...stringsFrom(STATUS_COPY),
        ...stringsFrom(AWAITING_INVOICE_COPY),
        ...stringsFrom(AWAITING_DELIVERY_COPY),
        ...stringsFrom(AWAITING_PO_COPY),
        ...stringsFrom(AWAITING_SEND_COPY),
        ...stringsFrom(ALLOCATION_COPY),
        ...stringsFrom(OVERAGE_COPY),
        ...stringsFrom(DIRECT_PURCHASE_COPY),
        ...stringsFrom(WAIT_COPY),
        ...stringsFrom(PR_KIND_COPY),
        // #331 — the viewer's five labels and its three stand-in sentences. Plain
        // values, so `stringsFrom` needs no help with them.
        ...stringsFrom(FILE_AXIS_LABEL),
        ...stringsFrom(FILE_VIEWER_COPY),
        // #188 — CALLED WITH A REAL LIST RATHER THAN LEFT TO `stringsFrom`, whose
        // three probe shapes cannot supply one: every one of them makes the builder
        // throw, so the sentence a brief quotes would silently be absent from
        // `loadable` and its pin would fail for the wrong reason.
        ...Object.values(ROLLBACK_COPY).map((v) => v.clean),
        ...Object.values(ROLLBACK_COPY).map((v) => v.incomplete([RESTORE.items])),
        // #146 — called with real byte counts for the same reason: the builder takes
        // two numbers, and `stringsFrom`'s probe shapes would render the figures as
        // `NaN` rather than throw, which is the quieter of the two failures.
        UPLOAD_LIMIT_COPY.tooLarge({ bytes: 25_480_000, limitBytes: MAX_UPLOAD_BYTES }),
    ];
    assert("the copy constants yielded strings", loadable.length > 20);
    // AND NO `STATUS_COPY` SENTENCE RENDERED `undefined`, WHICH IS WHAT A STALE INPUT
    // KEY LOOKS LIKE (#274). This is the assertion the literal sample lacked, and it
    // is name-free on purpose: it does not ask whether one field is spelled right, it
    // asks whether every builder got a figure at all. `SAMPLE_STATUS` being derived is
    // what makes it hold; this is what would say so if a future sample stopped being.
    //
    // SCOPED TO `STATUS_COPY`, WHICH IS THE ONLY CONSTANT THE SAMPLE IS FOR. Eleven
    // other builders take a facts object of their own and are probed with the sample
    // anyway — `stringsFrom` tries three argument shapes and keeps the first that does
    // not throw — so they render `undefined` by design and always have. Widening this
    // to `loadable` would fail on eleven strings that are nobody's defect.
    const statusFigures = stringsFrom(STATUS_COPY).filter((s) => s.includes("undefined"));
    check(
        `STATUS_COPY sentences rendering \`undefined\` from a sample key that no longer exists${
            statusFigures.length ? ` (first: ${JSON.stringify(statusFigures[0])})` : ""
        }`,
        statusFigures.length,
        0
    );

    // Each pinned sentence has to be BOTH still in a constant and still in a brief.
    // Either half alone would miss the drift: a constant reworded leaves the brief
    // lying to a designer, and a brief rewritten leaves the constant unquoted.
    const goneFromCode = PINNED.filter((s) => !loadable.some((v) => v.includes(s)));
    check(
        "no pinned sentence the constants no longer hold",
        goneFromCode.length === 0 ? "none" : goneFromCode.join(" | "),
        "none"
    );

    const goneFromBriefs = PINNED.filter((s) => ![...briefText.values()].some((t) => t.includes(s)));
    check(
        "no pinned sentence missing from every brief",
        goneFromBriefs.length === 0 ? "none" : goneFromBriefs.join(" | "),
        "none"
    );

    // Coverage, stated rather than implied: how much of what the loadable constants
    // can say is pinned at all. A reader deciding whether to trust this section
    // should see the fraction, not infer it from a row of PASSes.
    const sentences = [...new Set(loadable.filter((s) => s.length >= 12 && /\s/.test(s)))];
    log(`  ${PINNED.length} sentences pinned, of ${sentences.length} the loadable constants can produce`);
    log("  the rest are uncovered — a brief may quote one and this check will not notice");

    // --- tier 2: the two credentialed constants --------------------------
    log("");
    log("the two words no offline check can load still appear under app/:");
    // WITHDRAW_COPY and DELETE_COPY cannot be imported here — see the module note.
    // So the question narrows to whether the literal survives in the tree at all.
    const appSources = listJsFiles(repoPath("app"))
        .concat(listJsFiles(repoPath("lib")))
        .map((abs) => readFileSync(abs, "utf8"));
    assert("app/ and lib/ sources were read", appSources.length > 20);
    const TIER_TWO = ["This cannot be undone.", "no further signing", "Withdraw this PO?"];
    const absent = TIER_TWO.filter((s) => !appSources.some((src) => src.includes(s)));
    check("no tier-2 phrase missing from the tree", absent.length === 0 ? "none" : absent.join(" | "), "none");

    // --- anti-vacuity -----------------------------------------------------
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // Every assertion above is of the form "no X". Each mechanism is proved on a
    // case whose answer is known, because a broken deriver, an unreadable directory
    // and a failed walk all report exactly "no X" too.
    // THE SECTION MATCHER SURVIVES BOTH LINE ENDINGS, which is the assertion whose
    // absence let #260's version be green for one branch and red thereafter. Run on
    // built strings rather than on a file, so it holds however git checks the tree out.
    const sample = (nl) => `# T${nl}${nl}${REQUIRED_HEADINGS.join(`${nl}x${nl}`)}${nl}`;
    const findsAll = (text) => REQUIRED_HEADINGS.every((h) => text.includes(`\n${h}\n`));
    assert("the section matcher finds headings in LF text", findsAll(sample("\n")));
    assert("  and in CRLF text once normalized", findsAll(sample("\r\n").replace(/\r\n/g, "\n")));
    assert("  and would MISS them unnormalized", !findsAll(sample("\r\n")));

    assert("the deriver names a static route", briefFileName("/prs") === "prs.md");
    assert("  a dynamic segment", briefFileName("/pos/[poId]") === "pos-poId.md");
    assert("  a nested dynamic route", briefFileName("/invoices/[invoiceId]/edit") === "invoices-invoiceId-edit.md");
    assert("  and the one hand-held case", briefFileName("/") === "root.md");
    assert("the deriver does NOT collapse two routes to one name", briefFileName("/prs/new") !== briefFileName("/prs"));
    assert("the tone walk found a chip tone", tonesInStatusCopy().has("complete"));
    assert("  and a verdict tone", tonesInStatusCopy().has("exception"));
    assert("  and rejects one nobody defines", !tonesInStatusCopy().has("catastrophe"));
    assert("a fabricated sentence is in no constant", !loadable.some((s) => s.includes("Everything is fine here")));
    assert("  and a pinned one is", loadable.some((s) => s.includes("⚠ Check the total")));
    assert("the brief set is the size the app is", screenFiles.length === byName.page);
    assert("both non-screen files are present", NON_SCREEN.size === onDisk.length - screenFiles.length);
    // The repo walk is real: this file is under scripts/ and so must NOT be in it.
    assert("the app/lib walk excludes this tier", !toPosix(REPO_ROOT + "/scripts").includes("/app/"));
}

if (isMain(import.meta.url)) await standalone(title, run);

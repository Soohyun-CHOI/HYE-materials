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
import { VARIANCE_COPY } from "../../../lib/variance.js";
import { EMPTY_COPY, AWAITING_PO_COPY } from "../../../lib/poListView.js";
import { CONFIRM_COPY } from "../../../lib/authTokenState.js";
import { PO_DOCUMENTS_COPY } from "../../../lib/poDocuments.js";
import { LINK_COPY } from "../../../lib/deliveryInvoiceLink.js";
import { ALLOCATION_COPY } from "../../../lib/deliveryAllocation.js";
import { OVERAGE_COPY } from "../../../lib/overage.js";
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
    "nothing delivered yet",
    "delivered, not matched",
    "No invoice charges this order yet.",
    "Nothing has been delivered against this order yet.",
    "No purchase orders yet. One is generated automatically when a purchase request is fully approved.",
    "No purchase orders to show. You see a purchase order when you can see the request behind it.",
    "No purchase orders match these filters.",
    "Generation failed when the request was approved. Generate the order here.",
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
    // #272 — THE STRIP ABOVE `/prs` WAS QUOTED IN A BRIEF AND PINNED NOWHERE, and
    // this issue is what found it: the vocabulary sweep reworded the heading, the
    // explanation and the block heading on the delivery detail, and every check
    // stayed green while `prs.md` went on quoting the old sentences to a designer.
    // That is the exact drift this list exists to catch, so the strip's own words
    // join it. The heading is pinned without its figure, as the three above are.
    // A PIN MUST NOT CROSS THE BRIEF'S OWN LINE WRAP, which is why the second of
    // these starts mid-sentence: the briefs wrap at 72 characters and this one
    // breaks after `A`, so the longer form matched the constant and not the brief.
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
        ...stringsFrom(EMPTY_COPY),
        ...stringsFrom(CONFIRM_COPY),
        ...stringsFrom(PO_DOCUMENTS_COPY),
        ...stringsFrom(LINK_COPY),
        ...stringsFrom(STATUS_COPY),
        ...stringsFrom(AWAITING_INVOICE_COPY),
        ...stringsFrom(AWAITING_DELIVERY_COPY),
        ...stringsFrom(AWAITING_PO_COPY),
        ...stringsFrom(ALLOCATION_COPY),
        ...stringsFrom(OVERAGE_COPY),
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

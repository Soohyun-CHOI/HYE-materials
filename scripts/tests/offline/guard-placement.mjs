// Call-site shape: guards before side effects, cleanup outside rollbacks.
//
// Consolidated here by #152 from two places that asserted the same KIND of
// property about production call sites: verify-po-withdraw-138.mjs Part A
// (a withdrawn-PO guard runs before the write it protects) and
// verify-blob-lifecycle-140.mjs Part A (Blob cleanup is scheduled, and sits
// outside the rollback that must leave the object alive).
//
// They are one file now for a specific reason. Both were text matching over
// `export async function NAME`, both broke when #147 wrapped ten exports, and
// keeping them in separate issue-scoped scripts meant the next refactor would
// break several files independently and silently. One file, one AST layer, one
// place to fix. Per-check issue tags below keep the provenance.
//
// These are the assertions that cannot be reached behaviourally from node:
// every subject is a Server Action or Route Handler, which needs an
// iron-session cookie and a request scope. Where that changes, prefer the
// behavioural check — see _ast.mjs's note on source order vs execution order,
// which is exactly what these still cannot distinguish.

import {
    callPassesProperty,
    callsBefore,
    callsFunction,
    callsTo,
    firstCallPosition,
    firstPositionOf,
    insideCallTo,
    insideTry,
    isAwaited,
    parseFile,
    resolveFunction,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Call-site shape — guards before side effects, cleanup outside rollbacks";

const CLEANUP = "confirmIngestThenDelete";

// Blob cleanup call sites (#140). One row per production function, so adding a
// fifth upload path means adding a row rather than editing assertions.
//   cleansUp           — calls the shared helper at all
//   collectsTargets    — pushes onto blobCleanups instead of cleaning up itself
//   scheduled          — the cleanup call is inside an after(() => ...)
//   outsideTry         — the cleanup call has no enclosing try block
//   afterInReviewFlip  — cleanup comes after the Draft -> In Review write
//   attachmentId       — its target names the attachment being confirmed
const CLEANUP_SITES = [
    {
        file: "app/prs/new/actions.js",
        fn: "persistPRFromForm",
        cleansUp: false,
        collectsTargets: true,
        attachmentId: true,
    },
    { file: "app/prs/new/actions.js", fn: "saveDraftAction", cleansUp: true, scheduled: true },
    {
        file: "app/prs/new/actions.js",
        fn: "createPRAction",
        cleansUp: true,
        scheduled: true,
        outsideTry: true,
        afterInReviewFlip: true,
    },
    {
        file: "app/prs/[prId]/actions.js",
        fn: "editAndContinueAction",
        cleansUp: true,
        scheduled: true,
        outsideTry: true,
        attachmentId: true,
    },
    {
        file: "app/invoices/new/actions.js",
        fn: "createInvoiceAction",
        cleansUp: true,
        scheduled: true,
        outsideTry: true,
        attachmentId: true,
    },
    {
        file: "lib/poPdf.js",
        fn: "generateAndAttachPOPdf",
        cleansUp: true,
        scheduled: true,
        attachmentId: true,
    },
];

// Withdrawn-PO guards (#138): each must precede the side effect it protects.
const WITHDRAW_GUARDS = [
    {
        file: "app/pos/[poId]/actions.js",
        fn: "signPOAction",
        gate: "isPOWithdrawn",
        work: "updatePO",
        why: "signing a withdrawn PO would write Status back to Signed and advance the PR",
    },
    {
        file: "app/pos/[poId]/actions.js",
        fn: "regeneratePDFAction",
        gate: "isPOWithdrawn",
        work: "generateAndAttachPOPdf",
        why: "a fresh PO PDF for a cancelled order is the confusion Withdrawn exists to prevent",
    },
    {
        file: "app/invoices/new/actions.js",
        fn: "createInvoiceAction",
        gate: "isPOWithdrawn",
        work: "createInvoice",
        why: "an invoice must not be linked to a withdrawn PO",
    },
];

/** A call like `obj.prop(...)`, matched on both halves. */
function memberCalls(node, objName, propName) {
    const found = [];
    walk(node, (n) => {
        if (n.type !== "CallExpression") return;
        const c = n.callee;
        if (
            c?.type === "MemberExpression" &&
            c.object?.type === "Identifier" &&
            c.object.name === objName &&
            c.property?.name === propName
        ) {
            found.push(n);
        }
    });
    return found.sort((a, b) => a.start - b.start);
}

/**
 * Resolve a function, failing loudly rather than returning an empty body. The
 * old text extractor returned "" for an unresolvable name and every assertion
 * built on it quietly became false; that is the bug this file exists to not
 * repeat, so a name that cannot be resolved is itself a failed check.
 */
function bodyOf({ ast }, fn, file, reporter) {
    const node = resolveFunction(ast, fn);
    if (!node) {
        reporter.assert(`${file} — ${fn}: function body could not be resolved`, false);
        return null;
    }
    return node;
}

export function run(reporter) {
    const { check, assert, log } = reporter;
    const parsed = new Map();
    const fileOf = (rel) => {
        if (!parsed.has(rel)) parsed.set(rel, parseFile(rel));
        return parsed.get(rel);
    };

    log("Blob cleanup placement (#140):");
    for (const site of CLEANUP_SITES) {
        const src = fileOf(site.file);
        const fn = bodyOf(src, site.fn, site.file, reporter);
        if (!fn) continue;
        const tag = `${site.fn}`;

        if (site.cleansUp === false) {
            check(`${tag} does NOT clean up mid-transaction`, callsFunction(fn, CLEANUP), false);
        } else {
            check(`${tag} calls the shared cleanup helper`, callsFunction(fn, CLEANUP), true);
        }

        if (site.collectsTargets) {
            assert(`${tag} collects targets on blobCleanups instead`, memberCalls(fn, "blobCleanups", "push").length > 0);
        }

        const cleanupCall = callsTo(fn, CLEANUP)[0];

        if (site.scheduled) {
            assert(
                `${tag} schedules cleanup inside after(() => ...)`,
                Boolean(cleanupCall) && insideCallTo(fn, cleanupCall, "after")
            );
            assert(
                `${tag} does not await cleanup inline`,
                Boolean(cleanupCall) && !isAwaited(fn, cleanupCall)
            );
        }

        if (site.outsideTry) {
            // The real property, not the old string proxy: a rollback must
            // leave the object alive for the user's retry, so the cleanup call
            // must have no enclosing try.
            assert(
                `${tag} cleanup has no enclosing try (rollback leaves the object alive)`,
                Boolean(cleanupCall) && !insideTry(fn, cleanupCall)
            );
        }

        if (site.afterInReviewFlip) {
            const flip = firstPositionOf(
                fn,
                (n) => n.type === "Property" && n.key?.name === "status" && n.value?.value === "In Review"
            );
            const cleanupAt = firstCallPosition(fn, CLEANUP);
            assert(
                `${tag} cleans up after the Draft -> In Review flip`,
                flip !== -1 && cleanupAt !== -1 && cleanupAt > flip
            );
        }

        if (site.attachmentId) {
            // A target is built either inline in the cleanup call
            // (createInvoiceAction, generateAndAttachPOPdf) or pushed onto
            // blobCleanups and handed over later (persistPRFromForm,
            // editAndContinueAction). The property is "every target this
            // function builds names its attachment", so both shapes count.
            const targetSites = [
                ...(cleanupCall ? [cleanupCall] : []),
                ...memberCalls(fn, "blobCleanups", "push"),
            ];
            assert(
                `${tag} names the attachment it confirms (attachmentId on its target)`,
                targetSites.length > 0 && targetSites.some((c) => callPassesProperty(c, "attachmentId"))
            );
        }
    }

    // The opposite direction, and the no-restatement rule (#140).
    const poPdf = fileOf("lib/poPdf.js");
    check("lib/poPdf.js deletes the object when the attachment write throws", callsFunction(poPdf.ast, "deleteBlobBestEffort"), true);
    assert(
        "lib/poPdf.js no longer returns { url: blob.url } (a URL it may have deleted)",
        firstPositionOf(
            poPdf.ast,
            (n) =>
                n.type === "ReturnStatement" &&
                n.argument?.type === "ObjectExpression" &&
                n.argument.properties.some(
                    (p) =>
                        p.key?.name === "url" &&
                        p.value?.type === "MemberExpression" &&
                        p.value.object?.name === "blob" &&
                        p.value.property?.name === "url"
                )
        ) === -1
    );
    for (const rel of ["app/prs/new/actions.js", "app/prs/[prId]/actions.js", "app/invoices/new/actions.js"]) {
        check(`${rel} does not call del() itself`, callsFunction(fileOf(rel).ast, "del"), false);
    }

    log("");
    log("Withdrawn-PO guards (#138):");
    for (const g of WITHDRAW_GUARDS) {
        const fn = bodyOf(fileOf(g.file), g.fn, g.file, reporter);
        if (!fn) continue;
        assert(`${g.fn}: ${g.gate}() precedes ${g.work}() — ${g.why}`, callsBefore(fn, g.gate, g.work));
    }

    // withdrawPOAction owns no decision and no write of its own: every refusal
    // path has to be the shared one in lib/poWithdraw.js.
    const poActions = fileOf("app/pos/[poId]/actions.js");
    const withdrawFn = bodyOf(poActions, "withdrawPOAction", "app/pos/[poId]/actions.js", reporter);
    if (withdrawFn) {
        assert(
            "withdrawPOAction gates the session before calling the shared write path",
            callsBefore(withdrawFn, "requireUser", "withdrawPOAsRequester")
        );
        check("withdrawPOAction contains no updatePO of its own", callsFunction(withdrawFn, "updatePO"), false);
    }

    // detect-po must classify a withdrawn PO before it can become a candidate.
    const detectPo = fileOf("app/api/invoices/detect-po/route.js");
    const detectFn = bodyOf(detectPo, "POST", "app/api/invoices/detect-po/route.js", reporter);
    if (detectFn) {
        const guardAt = firstCallPosition(detectFn, "isPOWithdrawn");
        const pushAt = memberCalls(detectFn, "confirmed", "push")[0]?.start ?? -1;
        assert(
            "detect-po classifies withdrawn before pushing a confirmed candidate",
            guardAt !== -1 && pushAt !== -1 && guardAt < pushAt
        );
    }

    // The PO page must consume the shared predicate rather than re-deriving the
    // rule from status literals.
    const poPage = fileOf("app/pos/[poId]/page.js");
    check("PO page uses the shared eligibility predicate", callsFunction(poPage.ast, "getPOWithdrawEligibility"), true);
    assert(
        "PO page hardcodes no withdrawable-status literal",
        firstPositionOf(poPage.ast, (n) => n.type === "Literal" && n.value === "Awaiting Signature") === -1
    );

    // Both invoice-side PO queries must name the excluded status. Counted as
    // interpolations inside a template literal rather than as bare identifier
    // references, so the constant's own declaration doesn't inflate the count
    // and a mention in a comment cannot contribute at all.
    const poTable = fileOf("lib/airtable/purchaseOrders.js");
    let interpolations = 0;
    walk(poTable.ast, (n) => {
        if (n.type !== "TemplateLiteral") return;
        for (const expr of n.expressions) {
            if (expr.type === "Identifier" && expr.name === "PO_WITHDRAWN_STATUS") interpolations++;
        }
    });
    check(
        "getAllPOs and searchPOs both interpolate PO_WITHDRAWN_STATUS into their filterByFormula",
        interpolations,
        2
    );
}

if (isMain(import.meta.url)) standalone(title, run);

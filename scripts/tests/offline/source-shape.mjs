// Source shape: guards before side effects, cleanup outside rollbacks, one
// writer per attachment field.
//
// RENAMED FROM guard-placement.mjs BY #181, because half of what it holds is not
// about a guard and had not been for a while. #142's "Quotations.File is written
// in exactly one function" and #162's "Packing List File has exactly two writers,
// one each" are writer counts on a module, not the placement of a gate — and
// CLAUDE.md had already made this file the home of "source-shape checks",
// which is the category all of them are in. The exported title said `Call-site
// shape` before the filename caught up, which is the drift #181 is about.
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

export const title =
    "Source shape — guards before side effects, cleanup outside rollbacks, one writer per attachment";

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
    // #162's two paths. The create path rolls back, so its cleanup must sit
    // outside the try for the retry to re-submit the same url; the photo-replace
    // path has nothing to roll back but still defers, for the same reason every
    // other site does — the recorder is not held for ~1s of ingest polling.
    {
        file: "app/deliveries/new/actions.js",
        fn: "createDeliveryAction",
        cleansUp: true,
        scheduled: true,
        outsideTry: true,
        attachmentId: true,
    },
    {
        file: "app/deliveries/[deliveryId]/actions.js",
        fn: "replaceDeliveryPhotoAction",
        cleansUp: true,
        scheduled: true,
        outsideTry: true,
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
    for (const rel of [
        "app/prs/new/actions.js",
        "app/prs/[prId]/actions.js",
        "app/invoices/new/actions.js",
        "app/deliveries/new/actions.js",
        "app/deliveries/[deliveryId]/actions.js",
    ]) {
        check(`${rel} does not call del() itself`, callsFunction(fileOf(rel).ast, "del"), false);
    }

    log("");
    log("Attachment writes (#142):");
    // #142's structural guarantee. Re-submitting an attachment url Airtable
    // handed us hours earlier returns success and empties the field, so the
    // number of places that can write Quotations.File is the thing to hold
    // down. createQuotation writes it from a freshly uploaded Blob url;
    // updateQuotation deliberately has no file parameter, and a re-save that
    // keeps a file keeps the whole record rather than rewriting the field.
    const quotationsTable = fileOf("lib/airtable/quotations.js");
    const fileWrites = [];
    walk(quotationsTable.ast, (n) => {
        if (n.type === "Property" && (n.key?.name === "File" || n.key?.value === "File")) {
            fileWrites.push(n);
        }
    });
    check("lib/airtable/quotations.js writes the File field in exactly one place", fileWrites.length, 1);
    const createQuotationFn = resolveFunction(quotationsTable.ast, "createQuotation");
    assert(
        "that one write is inside createQuotation",
        Boolean(createQuotationFn) &&
            fileWrites.length === 1 &&
            fileWrites[0].start > createQuotationFn.start &&
            fileWrites[0].start < createQuotationFn.end
    );
    const updateQuotationFn = resolveFunction(quotationsTable.ast, "updateQuotation");
    assert(
        "updateQuotation exists and touches no attachment field",
        Boolean(updateQuotationFn) &&
            firstPositionOf(
                updateQuotationFn,
                (n) => n.type === "Property" && (n.key?.name === "File" || n.key?.value === "File")
            ) === -1
    );

    // The same rule on the delivery side (#162), where the photo IS editable in
    // place — so `Packing List File` has TWO writers rather than one, and the
    // shape that makes that safe is what these checks pin. createDelivery writes
    // it at creation; replaceDeliveryPhoto is the narrow second writer and must
    // call isOurBlobUrl, which is what makes #142's failure mode (re-submitting an
    // url Airtable issued) unreachable by construction rather than by discipline;
    // updateDelivery, which the in-place edit of date and note goes through, must
    // not touch the field at all.
    const deliveriesTable = fileOf("lib/airtable/deliveries.js");
    const isPackingListKey = (n) =>
        n.type === "Property" &&
        (n.key?.name === "Packing List File" || n.key?.value === "Packing List File");
    const packingListWrites = [];
    walk(deliveriesTable.ast, (n) => {
        if (isPackingListKey(n)) packingListWrites.push(n);
    });
    check(
        "lib/airtable/deliveries.js writes Packing List File in exactly two places",
        packingListWrites.length,
        2
    );
    const createDeliveryFn = resolveFunction(deliveriesTable.ast, "createDelivery");
    const replacePhotoFn = resolveFunction(deliveriesTable.ast, "replaceDeliveryPhoto");
    const within = (node, fn) => Boolean(fn) && node.start > fn.start && node.start < fn.end;
    assert(
        "one write is inside createDelivery",
        packingListWrites.filter((w) => within(w, createDeliveryFn)).length === 1
    );
    assert(
        "the other is inside replaceDeliveryPhoto",
        packingListWrites.filter((w) => within(w, replacePhotoFn)).length === 1
    );
    check(
        "replaceDeliveryPhoto refuses a url that is not ours (isOurBlobUrl)",
        Boolean(replacePhotoFn) && callsFunction(replacePhotoFn, "isOurBlobUrl"),
        true
    );
    const updateDeliveryFn = resolveFunction(deliveriesTable.ast, "updateDelivery");
    assert(
        "updateDelivery exists and touches no attachment field",
        Boolean(updateDeliveryFn) && firstPositionOf(updateDeliveryFn, isPackingListKey) === -1
    );

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

    // THE STATUS CONDITION IS BUILT ONCE AND READ TWICE (#168). This used to
    // require the opposite — PO_WITHDRAWN_STATUS interpolated TWICE, once in each
    // invoice-side query — which pinned the duplication rather than the rule. Both
    // readers feed the same screen (the invoice form's picker and its search
    // escape hatch), so a condition changed on one side would have made the
    // dropdown hide a PO the search finds. Counted as interpolations inside a
    // template literal, so a mention in a comment cannot contribute.
    const poTable = fileOf("lib/airtable/purchaseOrders.js");
    let statusInterpolations = 0;
    let fragmentUses = 0;
    walk(poTable.ast, (n) => {
        if (n.type !== "TemplateLiteral") return;
        for (const expr of n.expressions) {
            if (expr.type !== "Identifier") continue;
            if (expr.name === "PO_WITHDRAWN_STATUS") statusInterpolations++;
            if (expr.name === "PO_NOT_WITHDRAWN") fragmentUses++;
        }
    });
    check(
        "the excluded status is interpolated in exactly one place — the shared fragment",
        statusInterpolations,
        1
    );
    check(
        "and both invoice-side readers interpolate that fragment",
        fragmentUses,
        2
    );

    // HAVING NO FILTER IS getAllPOs's CONTRACT (#168), and the failure mode is why
    // it is worth a check rather than a comment. The /pos list shows what it is
    // given; add a status condition here and the matching rows stop appearing with
    // nothing on screen to say a row was withheld. A list cannot show its own
    // omissions, so nobody would notice.
    const allPOs = resolveFunction(poTable.ast, "getAllPOs");
    assert("getAllPOs resolves", allPOs !== null);
    if (allPOs) {
        let filters = 0;
        walk(allPOs, (n) => {
            if (n.type !== "Property") return;
            const key = n.key;
            const name = key?.type === "Identifier" ? key.name : key?.type === "Literal" ? key.value : null;
            if (name === "filterByFormula") filters++;
        });
        check("getAllPOs builds no filterByFormula — every status reaches /pos", filters, 0);

        // AND IT SORTS BY `PO ID` DESCENDING, server-side, the way getAllInvoices
        // sorts by `Invoice ID`. That ordering is why /pos shows no Created column
        // at all: a PO ID is fixed width and zero-padded, so ID order IS date
        // order. Drop the sort and the list silently falls back to Airtable's own
        // order, with no date on screen to make the loss visible.
        let sortsByPoId = false;
        walk(allPOs, (n) => {
            if (n.type !== "Property") return;
            const key = n.key?.type === "Identifier" ? n.key.name : n.key?.value;
            if (key !== "sort") return;
            const text = poTable.source.slice(n.start, n.end);
            if (/PO ID/.test(text) && /desc/.test(text)) sortsByPoId = true;
        });
        assert("getAllPOs sorts by PO ID descending — the list shows no date of its own", sortsByPoId);
    }

    // ── the confirmation page reads a token and never spends it (#203) ──────
    //
    // THIS IS THE WHOLE OF ISSUE #203, ASSERTED AS AN ABSENCE. Mail security
    // scanners open links in delivered messages before the recipient does, so
    // while /api/auth/verify consumed the single-use token on GET, the scanner
    // spent it and the recipient was shown the invalid-or-expired error. The fix
    // is that opening the page consumes nothing — which is exactly the kind of
    // property a later reader undoes in good faith, thinking the extra press is
    // redundant ceremony rather than the point.
    //
    // Asserted on the AST of the page rather than on the route, because the route
    // is SUPPOSED to consume: what must not happen is a GET path reaching it.
    // offline/auth-token-state.mjs pins the verdict this page renders; this pins
    // that it reaches the verdict without writing anything.
    const confirmPage = parseFile("app/login/confirm/page.js");
    assert("the confirmation page parses", confirmPage !== null);
    if (confirmPage) {
        // Imported names, from the AST rather than from the text. A raw
        // `source.includes` was tried first and failed on this page's own doc
        // comment, which names both functions in the course of explaining why it
        // must not call them — the same trap #201's product-name check sprang on
        // a comment written in the same commit. Prose about a rule is not a
        // violation of it, and only the AST can tell the two apart.
        const imported = new Set();
        walk(confirmPage.ast, (n) => {
            if (n.type !== "ImportDeclaration") return;
            for (const s of n.specifiers ?? []) {
                if (s.local?.name) imported.add(s.imported?.name ?? s.local.name);
            }
        });

        for (const consumer of ["consumeAuthToken", "verifyMagicLink"]) {
            check(
                `/login/confirm never calls ${consumer} — a GET must not spend the token`,
                callsTo(confirmPage.ast, consumer).length,
                0
            );
            check(`and never imports ${consumer} either`, imported.has(consumer), false);
        }
        // ANTI-VACUITY: the two absences above are also what an empty file, a
        // wrong path or a failed parse would report. So the read this page DOES
        // make is asserted present — if getAuthTokenRecord ever stops being
        // called here, the checks above have stopped describing a page that reads
        // a token at all, and should fail rather than keep passing.
        check(
            "but it does call getAuthTokenRecord — the read-only lookup",
            callsTo(confirmPage.ast, "getAuthTokenRecord").length,
            1
        );
    }
}

if (isMain(import.meta.url)) standalone(title, run);

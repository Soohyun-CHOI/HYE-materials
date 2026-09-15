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
// These are the assertions that cannot be reached behaviorally from node:
// every subject is a Server Action or Route Handler, which needs an
// iron-session cookie and a request scope. Where that changes, prefer the
// behavioral check — see _ast.mjs's note on source order vs execution order,
// which is exactly what these still cannot distinguish.

import { readFileSync } from "node:fs";
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
    repoPath,
    resolveFunction,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title =
    "Source shape — guards before side effects, cleanup outside rollbacks, one writer per attachment";

const CLEANUP = "confirmIngestThenDelete";

// The two values `Users."Role"` takes. Used only to assert that requireAdmin
// names NEITHER of them (#196) — the Admin gate and the role gate must not
// quietly converge on one predicate.
const ROLES = new Set(["President", "Employee"]);

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
        why: "a fresh PO PDF for a canceled order is the confusion Withdrawn exists to prevent",
    },
    {
        file: "app/invoices/new/actions.js",
        fn: "createInvoiceAction",
        gate: "isPOWithdrawn",
        work: "createInvoice",
        why: "an invoice must not be linked to a withdrawn PO",
    },
    {
        file: "app/pos/[poId]/actions.js",
        // #281 renamed this: the action is a plain export calling requireUser() now
        // rather than a wrapped handler, so there is no separate handler to name.
        fn: "sendPOToVendorAction",
        // #281 reaches the same rule through its own predicate rather than a second
        // isPOWithdrawn call, so the gate named here is that predicate. What matters
        // is unchanged: the withdrawal test runs before the side effect.
        gate: "getPOSendEligibility",
        work: "sendPOToVendorEmail",
        why: "mailing a canceled order to the vendor is the strongest form of a new document",
    },
];

// Each write control on /pos/[poId] renders on exactly its own action's gate (#281).
// The page had all three on President-or-Admin while two of the actions were
// President-only, so an Admin saw buttons that could only throw. A page condition and
// an action's own gate are in different files, so nothing but this pairs them.
//
// TWO SHAPES, BECAUSE THE TWO AXES ARE NOT THE SAME KIND. Signing is a role, so its
// gate is a wrapper and `wrapper` names it. The two document controls are the
// requester-or-office axis, which no wrapper covers, so their gate is a predicate
// called in the body and `gate` names that instead — the `withdrawPOAction` shape, and
// the reason both are exemptions in `authz-structure.mjs`.
const PO_CONTROL_GATES = [
    { form: "SignForm", pageFlag: "isPresident", wrapper: "withPresidentAction", export: "signPOAction" },
    { form: "RegeneratePDFForm", pageFlag: "canSend", gate: "canSendPOToVendor", export: "regeneratePDFAction" },
    { form: "SendToVendorForm", pageFlag: "canSend", gate: "canSendPOToVendor", export: "sendPOToVendorAction" },
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
 * The property names read off a binding called `objName`, as one sorted string
 * (#196). Returned as a VALUE rather than a set so a call site compares it with
 * `check` and states the whole answer: a walk that collected nothing reports ""
 * and fails, where an "does not read X" assertion passes for free.
 */
function propsReadOff(node, objName) {
    const names = new Set();
    walk(node, (n) => {
        if (
            n.type === "MemberExpression" &&
            !n.computed &&
            n.object?.type === "Identifier" &&
            n.object.name === objName &&
            n.property?.type === "Identifier"
        ) {
            names.add(n.property.name);
        }
    });
    return [...names].sort().join(",");
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
    log("Invoices.\"Delivery\" — ONE writer, and it is not the header editor (#210):");
    // A WRITER COUNT, the same category as the two above, and the reason it is worth
    // pinning is the AUTHORIZATION rather than the field. `updateInvoice` is the
    // office's header-correction path and every caller of it is Admin-only (#117);
    // this pairing is written from the DELIVERY side by a Job-scoped action, because
    // the packing list is where it is known. One function with both axes on it would
    // make the narrower one unenforceable — so the pairing gets its own narrow writer,
    // the shape setPOItemMaterial and replaceDeliveryPhoto already have.
    const invoicesTable = fileOf("lib/airtable/invoices.js");
    const isDeliveryKey = (n) =>
        n.type === "Property" && (n.key?.name === "Delivery" || n.key?.value === "Delivery");
    const deliveryLinkWrites = [];
    walk(invoicesTable.ast, (n) => {
        if (isDeliveryKey(n)) deliveryLinkWrites.push(n);
    });
    check(
        "lib/airtable/invoices.js writes Delivery in exactly one place",
        deliveryLinkWrites.length,
        1
    );
    const setInvoiceDeliveryFn = resolveFunction(invoicesTable.ast, "setInvoiceDelivery");
    assert(
        "and that place is setInvoiceDelivery",
        deliveryLinkWrites.filter((w) => within(w, setInvoiceDeliveryFn)).length === 1
    );
    const updateInvoiceFn = resolveFunction(invoicesTable.ast, "updateInvoice");
    assert(
        "updateInvoice exists and never touches the pairing",
        Boolean(updateInvoiceFn) && firstPositionOf(updateInvoiceFn, isDeliveryKey) === -1
    );
    // ANTI-VACUITY: `isDeliveryKey` must be able to find something, or the two
    // assertions above are satisfied by a matcher that matches nothing. The write it
    // does find is the one inside the narrow writer, which is the positive case.
    assert("the Delivery-key matcher found a write at all", deliveryLinkWrites.length > 0);

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

    // ── a submitted Job is resolved before a Discipline is created (#196) ─────
    //
    // #29's guarantee, kept on #30's record id: the dropdown can only offer real
    // Jobs, so what this defends against is a forged or stale direct call, and the
    // property is the ORDER — resolve, refuse, and only then create.
    //
    // IT REPLACED verify-line-job-dropdown-30.mjs, whose header said in as many
    // words that it mirrored this guard 1:1. Its resolveJobGuard re-typed the
    // try/catch into the script and ran four cases against the copy, which says
    // nothing about the action: the copy answers the same way whether or not the
    // action still resolves anything. The Admin gate that script explicitly did NOT
    // claim ("verified by inspection, not here") is authz-structure.mjs's, which
    // proves the export is withAdminAction with the wrapper's own arity.
    //
    // EXERCISING THE REAL ACTION WAS AVAILABLE AND IS DELIBERATELY LEFT ALONE.
    // verify-invoice-pairing-231.mjs reaches a Server Action over HTTP, and soo@ is
    // both Admin and named, so this one is reachable today. #250 owns settling that
    // harness against the heaviest write there is; a second one grown here for an
    // input check would be the duplication that issue exists to avoid.
    log("");
    log("A submitted Job is resolved before a Discipline is created (#196/#30):");
    const disciplineActions = "app/admin/disciplines/new/actions.js";
    const disciplineFn = bodyOf(fileOf(disciplineActions), "createDisciplineAction", disciplineActions, reporter);
    if (disciplineFn) {
        assert(
            "  createDisciplineAction resolves the submitted Job before creating anything",
            callsBefore(disciplineFn, "getJobByRecordId", "createDiscipline")
        );
        // ANTI-VACUITY: callsBefore is false when EITHER call is absent, so the
        // clause above is also what a renamed creator reports. Naming both halves
        // makes a rename fail as a rename rather than as an ordering violation.
        check("  and calls getJobByRecordId at all", callsFunction(disciplineFn, "getJobByRecordId"), true);
        check("  and calls createDiscipline at all", callsFunction(disciplineFn, "createDiscipline"), true);
    }

    // ── each write control's render condition matches its action's gate (#281) ──
    log("");
    log("PO controls render on exactly their own action's gate (#281):");
    // COMMENTS STRIPPED BEFORE MATCHING, which is not tidiness: the windows below
    // measure the distance from a flag to the element it guards, and this page
    // explains every one of those decisions in a block comment sitting exactly
    // between them. Measuring code, not prose. `variance-copy.mjs` strips for the
    // same reason on a different question.
    const stripComments = (src) => src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
    const poPageSrc = stripComments(readFileSync(repoPath("app/pos/[poId]/page.js"), "utf8"));
    const poActionsSrc = readFileSync(repoPath("app/pos/[poId]/actions.js"), "utf8");
    for (const g of PO_CONTROL_GATES) {
        // The JSX condition immediately before the control, as source text: a
        // `{flag ? <Form …` or `flag && <Form …`. Text rather than AST because what
        // is being pinned is which flag guards which element, and the flags are
        // plain identifiers whose names are the whole claim.
        const rendered = new RegExp(`${g.pageFlag}\\s*(\\?|&&)[\\s\\S]{0,400}?<${g.form}\\b`).test(poPageSrc);
        check(`  ${g.form} renders on ${g.pageFlag}`, rendered, true);
        // And no OTHER flag guards it, which is the half that caught #281's defect:
        // the page said isOffice and the action said President.
        //
        // `isOffice` LEFT THIS SET IN #384, WITH THE PAGE'S LAST READ-SIDE
        // NARROWING. That flag guarded one line, the internal `Delivery Address
        // Used` field, and #384 removed the line — so the page declares two flags
        // now and a third name here would make every `and not on isOffice` clause
        // pass for free, which is exactly what the binding assertion below exists
        // to stop. The historical sentence above is unchanged: it records what
        // #281 found, not what the page says today.
        for (const other of ["isPresident", "canSend"]) {
            if (other === g.pageFlag) continue;
            const wrong = new RegExp(`${other}\\s*(\\?|&&)[\\s\\S]{0,200}?<${g.form}\\b`).test(poPageSrc);
            check(`    and not on ${other}`, wrong, false);
        }
        if (g.wrapper) {
            const wrapped = new RegExp(`export const ${g.export} = ${g.wrapper}\\b`).test(poActionsSrc);
            check(`  ${g.export} is ${g.wrapper}`, wrapped, true);
        } else {
            // A predicate gate, so what is pinned is that the action asks it and asks
            // it BEFORE doing anything — the wrapper's guarantee, spelled out.
            const fn = bodyOf(fileOf("app/pos/[poId]/actions.js"), g.export, "app/pos/[poId]/actions.js", reporter);
            check(`  ${g.export} asks ${g.gate}`, fn ? callsFunction(fn, g.gate) : false, true);
            check(
                `    after requireUser and before its own work`,
                fn ? callsBefore(fn, "requireUser", g.gate) : false,
                true
            );
        }
    }
    // ANTI-VACUITY: the matcher has to be able to say NO, or every clause above is
    // what it reports for any pair. `isPresident` does not guard the send control.
    assert(
        "the pairing matcher rejects a control guarded by the wrong flag",
        !/isPresident\s*(\?|&&)[\s\S]{0,200}?<SendToVendorForm\b/.test(poPageSrc)
    );
    // And the flags it is choosing between must all be defined on the page, or a
    // renamed one would make every "not on X" clause pass for free.
    for (const flag of ["isPresident", "canSend"]) {
        assert(`  ${flag} is a real binding on the page`, new RegExp(`const ${flag} =`).test(poPageSrc));
    }
    // AND THE FLAG THAT LEFT MUST STAY GONE (#384), which is the same assertion
    // read the other way: `isOffice` was declared for one read-side narrowing and
    // nothing else, so a re-appearance is either that line coming back without its
    // issue or a write control being re-gated on the office. #386 puts the address
    // back in the identity block for EVERY reader, so it needs no flag.
    assert(
        "  isOffice is not declared on the page — its one read-side narrowing went in #384",
        !/const isOffice =/.test(poPageSrc)
    );
    // #281 — the document control's contract matches what the page offers: it refuses
    // an order that already has one. The page renders it only inside the `!pdfFile`
    // branch, so the overwrite the old docstring promised was never reachable, and the
    // PO document is only a partial snapshot — a second generation reads live party
    // data. See docs/notes/purchase-orders.md.
    const regenFn = bodyOf(
        fileOf("app/pos/[poId]/actions.js"),
        "regeneratePDFAction",
        "app/pos/[poId]/actions.js",
        reporter
    );
    assert(
        "regeneratePDFAction refuses an order that already has its document",
        regenFn
            ? /po\.poPdfFile\?\.\[0\]/.test(poActionsSrc.slice(regenFn.start, regenFn.end))
            : false
    );

    // ── the role gates compare what their names say (#196) ────────────────────
    //
    // THIS REPLACED A MIRROR RATHER THAN JOINING ONE. verify-po-visibility-132.mjs
    // reproduced requirePresident()'s gate as a local ["President"].includes(role)
    // and asserted against that copy, so it answered the same way whether or not the
    // real gate agreed — and #171 found its Admin case had been passing "Employee"
    // under a label reading Admin for weeks. Two thirds of what it claimed were
    // already held, by three checks with three different scopes: authz-structure.mjs
    // proves signPOAction is gated AT ALL, the table above proves the gate is the
    // PRESIDENT one, and authz-wrappers.mjs proves a throwing gate never runs the
    // body. What NOTHING held is the third — that an Admin is not a President —
    // which is exactly the clause the mirror got wrong.
    //
    // THAT FIRST SCOPE IS NARROWER THAN IT READS, AND IT WAS MEASURED HERE RATHER
    // THAN ASSUMED. Rewriting signPOAction as withAdminAction leaves
    // authz-structure.mjs green — `wrapped by withAdminAction, 2 arg(s)` is a pass,
    // because that check asks whether an export is wrapped by one of the three and
    // never which one an endpoint should have. The table above is what fails it.
    //
    // AND A CREDENTIALED RUN CANNOT HOLD IT EITHER, measured on the base rather than
    // reasoned about: all five accounts there that are Admin and not President have
    // no name, so since #381 requireUser() sends them to /login/name, and what comes
    // back from a forged sign call is the name step rather than the gate — the PO
    // stays unsigned for the wrong reason, which is the shape #171 was raised about.
    // Naming one of those rows would be writing a colleague's name on their behalf.
    // So the cheap check here covers precisely what the expensive one cannot.
    //
    // WHAT IT CANNOT SEE is whether `user.role` holds what Airtable holds. It reads
    // the comparison, never the value arriving at it.
    log("");
    log("Role gates compare what their names say (#196):");
    const authzFile = fileOf("lib/authz.js");
    const presidentFn = bodyOf(authzFile, "requirePresident", "lib/authz.js", reporter);
    if (presidentFn) {
        const roleCalls = callsTo(presidentFn, "requireRole");
        check("  requirePresident asks requireRole exactly once", roleCalls.length, 1);
        const args = roleCalls[0]?.arguments;
        check("  with exactly one argument", args?.length, 1);
        // A LITERAL IS THE CLAUSE THAT MATTERS. requireRole accepts an array, so
        // ["President", "Admin"] is still one argument — reading the node type is
        // what refuses it, where an `includes("President")` test would not.
        check(
            "  and that argument is the string President",
            args?.[0]?.type === "Literal" ? args[0].value : `<${args?.[0]?.type}>`,
            "President"
        );
    }

    // POSITIVE EQUALITIES RATHER THAN ABSENCES, which is the anti-vacuity: a walk
    // that collected nothing reports "" and fails these, where "requireRole does not
    // read isAdmin" would pass for free. Each gate is pinned from its own side, so
    // the two cannot converge on one predicate without one of them failing.
    const roleFn = bodyOf(authzFile, "requireRole", "lib/authz.js", reporter);
    if (roleFn) {
        check("  requireRole reads exactly this off the user", propsReadOff(roleFn, "user"), "role");
    }
    const adminFn = bodyOf(authzFile, "requireAdmin", "lib/authz.js", reporter);
    if (adminFn) {
        check("  requireAdmin reads exactly this off the user", propsReadOff(adminFn, "user"), "isAdmin");
        check(
            "  and names no role at all",
            firstPositionOf(adminFn, (n) => n.type === "Literal" && ROLES.has(n.value)),
            -1
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

    // THE STATUS CONDITION IS BUILT ONCE AND READ BY EVERY INVOICE-SIDE QUERY
    // (#168). This used to require the opposite — PO_WITHDRAWN_STATUS interpolated
    // TWICE, once in each invoice-side query — which pinned the duplication rather
    // than the rule. The readers feed the same screen (the invoice form's picker
    // and its search escape hatch), so a condition changed on one side would have
    // made the dropdown hide a PO the search finds. Counted as interpolations
    // inside a template literal, so a mention in a comment cannot contribute.
    //
    // THREE SINCE #244, not two. getOpenPOs used to inherit the condition by
    // calling getPOsExceptWithdrawn and filtering its result per record; now that
    // openness is a filter too, it carries both halves in one formula of its own.
    // The number is what has to move when a reader is added — that is the check
    // working, and a reader that hardcoded the status instead would leave it at 2.
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
        "and all three invoice-side readers interpolate that fragment",
        fragmentUses,
        3
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

    // ── #206's qualifier reaches the screen ─────────────────────────────────
    //
    // WHY THIS EXISTS AT ALL: `describeOverageBanner` takes
    // `noLongerOverDelivered` with a DEFAULT OF FALSE, so a render site that
    // forgets it loses the qualifier silently — no error, no empty box, just a
    // banner that never says the correction has come adrift. Nothing else would
    // catch it. offline/overage.mjs calls `describeOverageBanner` directly, so it
    // passes whatever the pages do or do not; and the browser cannot show it,
    // because this base carries no correction to attach a banner to.
    //
    // The producers are the other half and are checked below: three of them set
    // the property, and each has to read the row its own site is about.
    const bannerSites = ["app/prs/[prId]/page.js", "app/pos/[poId]/page.js"];
    let bannerCallsSeen = 0;
    for (const rel of bannerSites) {
        const page = parseFile(rel);
        assert(`${rel} parses`, page !== null);
        if (!page) continue;
        const calls = callsTo(page.ast, "describeOverageBanner");
        check(`${rel} renders the banner exactly once`, calls.length, 1);
        for (const call of calls) {
            bannerCallsSeen++;
            assert(
                `  and passes noLongerOverDelivered — without it the qualifier is dead`,
                callPassesProperty(call, "noLongerOverDelivered")
            );
            // ANTI-VACUITY: callPassesProperty walks the whole call, so a check
            // that always answered true would pass the assertion above. A name
            // that is NOT passed must therefore answer false.
            assert(
                `  and the property test can say no`,
                !callPassesProperty(call, "noLongerOverDeliveredTypo")
            );
        }
    }
    check("both banner sites were seen", bannerCallsSeen, 2);

    // Every producer sets it, or a site receives `undefined` and the default
    // silently applies. Three, because getOverageBannerFactsForPO has two paths.
    const overageReads = parseFile("lib/overagePR.js");
    assert("lib/overagePR.js parses", overageReads !== null);
    if (overageReads) {
        let setters = 0;
        walk(overageReads.ast, (n) => {
            if (n.type !== "Property") return;
            const key = n.key?.name ?? n.key?.value;
            if (key === "noLongerOverDelivered") setters++;
        });
        check("all three banner-fact producers set the qualifier", setters, 3);
    }

    // ── the quantities reach the employee-facing mapper (#169, #235) ───────
    //
    // WHAT THIS STANDS IN FOR IS AN ACCESS QUESTION, NOT A SHAPE ONE. #169's premise
    // was that delivered quantity is delivery-derived and must not be withheld with
    // the invoice-derived fields #132 kept from a non-privileged viewer of
    // /pos/[poId]. #235 RETIRED THE OTHER HALF: what a vendor invoiced is readable by
    // anyone who may read the order behind it (#211), so `invoicedQty` belongs here
    // too and this file no longer asserts its absence. The property is still checked
    // where it is decided — a field absent from this mapper is withheld from
    // everyone regardless of what a page renders — and the page's own gate is now
    // proved in a browser with `scoped-fixture@`, which the base does have a session
    // for since #211's fixture pair.
    const poItemsModule = parseFile("lib/airtable/poItems.js");
    assert("lib/airtable/poItems.js parses", poItemsModule !== null);
    if (poItemsModule) {
        const mapper = resolveFunction(poItemsModule.ast, "recordToPOItem");
        assert("recordToPOItem resolves", mapper !== null);
        if (mapper) {
            const fields = new Set();
            walk(mapper, (n) => {
                if (n.type !== "Property") return;
                const key = n.key?.type === "Identifier" ? n.key.name : n.key?.value;
                if (key) fields.add(key);
            });
            for (const field of ["deliveredQty", "committedQty", "invoicedQty"]) {
                assert(`recordToPOItem carries ${field}, which no viewer is withheld`, fields.has(field));
            }
            // ANTI-VACUITY. The assertions above also pass if `walk` collected every
            // Property in the file, or if the resolver handed back something larger
            // than this mapper. `invoicedQty` used to be the field that proved the
            // set was this function's own, by being absent; it is present now, so the
            // proof moves to a field that belongs to a DIFFERENT mapper in the same
            // file — `getPOItemsForReconciliation` carries `invoiceItems` and this
            // one must not, since a chip needs the total rather than the rows.
            assert(
                "and does NOT carry invoiceItems, which is another mapper's field",
                !fields.has("invoiceItems")
            );
        }
    }
}

if (isMain(import.meta.url)) standalone(title, run);

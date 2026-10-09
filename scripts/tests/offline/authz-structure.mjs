// Endpoint inventory — every export wrapped, or exempt with a reason.
//
// Moved here by #152 from scripts/tests/verify-authz-structure.mjs, and now
// built on the shared _ast.mjs layer rather than its own copy of a parser and
// a walker. Behavior is unchanged; #147's history is below.
//
// #147 replaced a substring search for `requireAdminApi(` over four hard-coded
// paths. A comment satisfied it, a real call whose refusal Response was then
// discarded satisfied it, and a route added later was not a subject of it at
// all, so it reported green regardless of the state of the code.
//
// ---------------------------------------------------------------------------
// WHAT A PASS PROVES, AND WHAT IT DOES NOT
//
// For a WRAPPED export: that the gate cannot be skipped and cannot run late.
// The handler is an argument the wrapper decides whether to call, so "the gate
// comes first" is structural — there is no ordering left for this check to
// verify, and none for an author to get wrong.
//
// IT DOES NOT SAY WHICH GATE, and #196 measured that rather than inferring it:
// rewriting signPOAction as withAdminAction leaves this check green, because
// `wrapped by withAdminAction, 2 arg(s)` is a pass. The question of whether an
// endpoint has the gate it should have is not asked here at all — for the three
// PO controls it is offline/source-shape.mjs's PO_CONTROL_GATES, which pairs each
// action's wrapper with the flag its control renders on. Nothing asks it for the
// rest of the inventory.
//
// For an EXEMPT export: only that the named helper is called somewhere inside
// the exported function. ORDER IS NOT CHECKED. The old substring check compared
// gateIdx < workIdx; nothing here replaces that comparison, so an exempt route
// that does work before its gate still passes.
//
// That is not hypothetical. /api/invoices/upload and /api/quotations/upload
// both call request.json() at the top of the handler, BEFORE authorization,
// because their gate has to run inside handleUpload's onBeforeGenerateToken
// callback. They pass this check anyway, correctly — this is the check's exact
// scope, not a defect in it.
//
// So an exemption buys strictly less than a wrapper. That is the second reason
// to keep the exemption list short, the first being that every entry is a
// precedent the next author can copy.
//
// WHERE THE REQUIRE_USER_AXIS COMPARISON IS HELD FOR A REQUEST, SINCE #440. That
// reason says the authorization is "the record-by-record comparison in the body", and
// nothing here reads the body — which is how `saveDraftAction` and `createPRAction`
// carried the exemption while comparing nothing. `offline/owner-before-write.mjs`
// inventories every read of a request by id and requires, of each one a write
// follows, that the declared judgment is asked about that record first. It holds the
// comparison's presence and order where the record compared is a request, which
// reaches an order's writes through the request behind the order; the delivery axis,
// which compares a job, is still held by nothing but its exemptions here. THE TOOLS
// AXIS LEFT THIS LIST IN #506: its four actions are a site manager's and are wrapped by
// `withSiteManagerAction`, and the job each body still compares is held where the
// body's planners are — `offline/asset-transition.mjs` for the scan and the retirement,
// `offline/asset-registration.mjs` for the registration.
// ---------------------------------------------------------------------------

import { REPO_ROOT, callsFunction, listJsFiles, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { collectExports, listEntryPoints } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Endpoint inventory — every export wrapped, or exempt with a reason (#134/#147)";

// The wrappers lib/authz.js exports, and how many arguments each takes. The
// arity is checked too: it is what stops a call site from reaching past the
// binding in lib/authz.js and supplying its own gate.
const WRAPPERS = {
    withAdminApi: 1,
    withAdminAction: 2,
    withPresidentAction: 1,
    // #506 — the handler alone: its refusal is bound in lib/authz.js, one answer for all
    // four of the axis's actions, so a call site has no position to supply one in either.
    withSiteManagerAction: 1,
};

// The method set and the scan roots moved to _entrypoints.mjs with the
// enumeration in #224 — including the reason lib/ is scanned at all, which is
// that a "use server" file appearing there must not be invisible.

const REQUIRE_USER_AXIS =
    "Session + per-record/per-turn ownership, not a role. requireUser() already cannot be dropped (it redirects), " +
    "and the actual authorization is the record-by-record comparison in the body. A wrapper here would cover the " +
    "half that was never at risk and leave the deciding half uncovered, while looking like coverage.";

// #162's two axes. Both are the requireUser shape above — session plus a
// per-record comparison — but they compare different things, and saying which
// keeps an exemption from reading as a blanket "deliveries are exempt".
const DELIVERY_JOB_AXIS =
    "Session + membership of the delivery's Job, not a role. requireUser() already cannot be dropped (it " +
    "redirects), and the actual authorization is canAccessJobDeliveries (lib/deliveryAccess.js) compared per " +
    "record in the body — an axis no role helper covers, since a site employee assigned to the Job must pass and " +
    "an Admin on no job must too. Same shape as withdrawPOAction (#138).";

// #338's axis stood here, TOOL_JOB_AXIS, as the fourth of this mixed shape — session plus
// the submitted job being one the actor's own Users."Assigned Jobs" names — with three
// exports on it, and #457's TOOL_LABEL_READ_AXIS beside it for the labels' read, whose
// gate was the session alone. #506 made all four a site manager's, which is a ROLE, so
// they are wrapped by `withSiteManagerAction` and neither reason is anybody's any more.
// The job comparison they described is still in the bodies, and its derivation — no
// office clause, a retirement inheriting the asset's own job — is in
// docs/notes/tools.md and lib/assetJob.js, where the code it is about is.

// #384's, AND IT IS THE ONE ENTRY ON THIS LIST WITH NO PER-RECORD COMPARISON
// BEHIND IT — which is why it is a constant of its own rather than a fifth reader
// of REQUIRE_USER_AXIS. That reason claims "the actual authorization is the
// record-by-record comparison in the body", and borrowing it here would state
// something untrue about this export and make the list's shortest entry read as
// its strongest. An exemption is a precedent a future author copies, so the one
// case where a session really is the whole gate has to say so.
const SESSION_ONLY_AXIS =
    "Session and nothing else, which is the whole gate rather than half of one. An `Addresses` row carries no " +
    "owner, no money and no authorization — nothing on it is anybody's to be refused against — so there is no " +
    "per-record comparison to make and none is implied. What decides that a session is enough is the operating " +
    "convention rather than a predicate: `Is Admin` scopes an endpoint to the OFFICE (CLAUDE.md), and where " +
    "material has to be delivered is the site's fact, so withAdminAction would refuse the requester this screen " +
    "exists for — #385 sends one here from the request form when the address they need has no row yet. Compare " +
    "/api/quotations/upload, which is any-active-user on the same reading.";

// #281's axis, and the third of this mixed shape after the two delivery ones.
const PO_DOCUMENT_AXIS =
    "Session + either the requester of the order's purchase request or the office, not a role. " +
    "requireUser() already cannot be dropped (it redirects), and the deciding comparison is " +
    "canSendPOToVendor (lib/poSend.js) per record in the body — no role helper covers it, since the " +
    "requester passes on identity while the office passes on being the office. Same mixed shape as " +
    "canAccessJobDeliveries. Sending an order with its document attached IS placing the order, which is why " +
    "the requester is on it at all (#138's symmetry); the office is on it because not sending stops the work " +
    "where not withdrawing stops nothing.";

const DELIVERY_AUTHOR_AXIS =
    "Session + authorship, not a role. The Job scope is checked first so someone outside it learns nothing, then " +
    "canDeleteDelivery (lib/deliveryDelete.js) decides on author-or-Admin inside the shared write path. Admin is " +
    "one branch of that predicate rather than the gate, so withAdminAction would refuse the author — who is " +
    "typically neither President nor Admin — and admit nobody it should.";

// #331's axis, and the one exemption in this list whose weakness is named in
// another file rather than tolerated here. Every other entry is one gate that a
// wrapper does not fit; this one is FIVE fields behind THREE gates in one export,
// which is precisely the shape "the helper is called somewhere inside" cannot
// speak to.
const FILE_ROUTE_AXIS =
    "Session + one of three per-record gates, chosen by the axis segment, not a role. Route Handlers cannot use " +
    "requireUser() (redirect() is for the page-render pipeline), so the session comes from getActiveUser() and " +
    "the deciding comparison is canViewPR for a quotation and an order document, getVisibleInvoiceIds for an " +
    "invoice file, and canAccessJobDeliveries for a packing list photo and a direct purchase's file. No wrapper " +
    "fits: withAdminApi would refuse the site staff every one of those gates admits. " +
    "WHAT THIS EXEMPTION CANNOT SAY, and the reason it is not the whole coverage: a pass here means getActiveUser " +
    "is named somewhere inside GET, which one gate for all five satisfies exactly as well as five for five — no " +
    "screen would change and nothing here would fail. offline/file-route.mjs holds that instead, by comparing " +
    "each axis's declared gate against the gate its own opener calls.";

// #351's tool-label QR endpoint had an entry here and both went in #352, which is
// worth a note rather than a silent deletion: it was the one exemption in this list
// whose reasoning was a CONTRAST with FILE_ROUTE_AXIS above, and that contrast is
// the reusable part. **One gate and no field to select is what makes an exemption
// the whole coverage** — "the named helper is called somewhere inside the export"
// says everything there is to say — where `/api/files` has five fields behind three
// gates in one export, so the same sentence says almost nothing and
// `offline/file-route.mjs` had to hold the difference. Keep that test when the next
// exemption is weighed; the route it was written about is gone because its symbol is
// rendered inline by the page that had already read the record.

const UPLOAD_CALLBACK_GATE =
    "the gate has to run inside handleUpload's onBeforeGenerateToken callback, which rejects by throwing rather " +
    "than by returning a Response, so wrapping the export would answer 401/403 where the client currently gets the " +
    "400 that handleUpload's catch produces. Note what this shape costs, and that this check does NOT catch it: " +
    "request.json() runs at the top of the handler, BEFORE authorization. These two routes are the only place in " +
    "the inventory where a gate runs after any work at all.";

// Every endpoint NOT wrapped, with the reason. This list is the check's real
// coverage. `mustCall` keeps an exemption from being a free pass — the named
// helper must actually be called inside the exported function, verified on the
// AST rather than in the text.
const EXEMPTIONS = [
    {
        file: "app/api/auth/request/route.js",
        name: "POST",
        reason:
            "Public by design: this is how someone with no session asks for a magic link. There is no caller to " +
            "authorize. Since #471 it also binds the asking browser to the email it sent, so it refuses a " +
            "cross-origin submission — a page elsewhere must not be able to leave a visitor waiting on its own email.",
    },
    {
        file: "app/api/auth/request/route.js",
        name: "DELETE",
        reason:
            "Public by design (#471): forgets which sign-in email this browser is waiting on, which is the code " +
            "step's way back to the address. It touches only the caller's own cookie, and having none is not an error.",
    },
    {
        file: "app/api/auth/code/route.js",
        name: "POST",
        reason:
            "Public by design (#471): spends a sign-in row with the code its email carries, and starts the session. " +
            "The code is the credential, and it is checked against the row the ASKING browser is bound to by a " +
            "sealed cookie, never one the submission names. It refuses a cross-origin submission first, for the " +
            "verify route's reason: a code authenticates a request but not the submitter's intent.",
    },
    {
        file: "app/api/auth/logout/route.js",
        name: "POST",
        reason: "Public by design: destroys whatever session is present, and having none is not an error.",
    },
    {
        file: "app/api/auth/verify/route.js",
        name: "POST",
        reason:
            "Public by design: consumes a single-use token and starts the session. The token is the credential. " +
            "POST rather than GET since #203, because a GET that consumed the token was spent by mail security " +
            "scanners before the recipient clicked. It additionally refuses a cross-origin submission, which the " +
            "token cannot answer for: the token authenticates the request but not the submitter's intent.",
    },
    {
        file: "app/api/files/[axis]/[documentId]/[filename]/route.js",
        name: "GET",
        mustCall: "getActiveUser",
        reason: FILE_ROUTE_AXIS,
    },
    {
        file: "app/api/invoices/upload/route.js",
        name: "POST",
        mustCall: "requireAdminApi",
        reason: `Admin-only, but not wrappable at the export: ${UPLOAD_CALLBACK_GATE}`,
    },
    {
        file: "app/api/quotations/upload/route.js",
        name: "POST",
        mustCall: "getActiveUser",
        reason: `Any-active-user rather than Admin, so no Admin wrapper applies, and ${UPLOAD_CALLBACK_GATE}`,
    },
    {
        file: "app/api/deliveries/upload/route.js",
        name: "POST",
        mustCall: "getActiveUser",
        reason:
            "Any-active-user rather than Admin (recording a delivery is site work, open to anyone assigned to the " +
            "Job), so no Admin wrapper applies. The Job itself CANNOT be checked here — the upload happens before " +
            `the form is submitted, so this route does not know which Job the photo will belong to, and the Job ` +
            `membership check lives in createDeliveryAction instead. And ${UPLOAD_CALLBACK_GATE}`,
    },
    { file: "app/pos/[poId]/actions.js", name: "withdrawPOAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    {
        file: "app/pos/[poId]/actions.js",
        name: "sendPOToVendorAction",
        mustCall: "requireUser",
        reason: PO_DOCUMENT_AXIS,
    },
    {
        file: "app/pos/[poId]/actions.js",
        name: "regeneratePDFAction",
        mustCall: "requireUser",
        reason:
            `${PO_DOCUMENT_AXIS} Issue #281 — the SECOND action on that predicate, and it is there because ` +
            `sending needs a document to attach: a requester who may send but must ask somebody else to ` +
            `generate is blocked with no signal that they are. It was withPresidentAction until this issue.`,
    },
    { file: "app/prs/[prId]/actions.js", name: "approveAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/[prId]/actions.js", name: "editAndContinueAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/[prId]/actions.js", name: "returnForCorrectionAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/[prId]/actions.js", name: "withdrawAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    {
        file: "app/login/name/actions.js",
        name: "setUserNameAction",
        mustCall: "requireUser",
        reason:
            "#381 — session, and an ownership that is STRUCTURAL rather than compared: the only record this can " +
            "reach is the caller's own session's row, because the record id comes from requireUser()'s return and " +
            "from nothing the submission carries. So there is no per-record comparison to write and no role that " +
            "would fit — a name is not an Admin decision. The narrowest of the requireUser axis, and the one " +
            "place in it where a wrapper would cover everything and still be wrong.",
    },
    {
        file: "app/addresses/new/actions.js",
        name: "createAddressAction",
        mustCall: "requireUser",
        reason: SESSION_ONLY_AXIS,
    },
    { file: "app/prs/new/actions.js", name: "saveDraftAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/new/actions.js", name: "deleteDraftAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/new/actions.js", name: "createPRAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/deliveries/new/actions.js", name: "createDeliveryAction", mustCall: "requireUser", reason: DELIVERY_JOB_AXIS },
    { file: "app/deliveries/[deliveryId]/actions.js", name: "updateDeliveryAction", mustCall: "requireUser", reason: DELIVERY_JOB_AXIS },
    { file: "app/deliveries/[deliveryId]/actions.js", name: "replaceDeliveryPhotoAction", mustCall: "requireUser", reason: DELIVERY_JOB_AXIS },
    { file: "app/deliveries/[deliveryId]/actions.js", name: "deleteDeliveryAction", mustCall: "requireUser", reason: DELIVERY_AUTHOR_AXIS },
    {
        file: "app/deliveries/[deliveryId]/actions.js",
        name: "attachDeliveryInvoiceAction",
        mustCall: "requireUser",
        reason:
            `${DELIVERY_JOB_AXIS} Issue #210 — TWO per-record axes rather than one, ` +
            "and neither is a role. The Job comparison admits it to the delivery; the " +
            "invoice it is about is then gated per record through " +
            "lib/invoiceVisibility.js, so a caller cannot pair an invoice they may not " +
            "read. Both re-run from a fresh read inside " +
            "lib/deliveryInvoiceCandidates.js, because an invoice can be paired with " +
            "another delivery while the form sits open.",
    },
    {
        file: "app/deliveries/[deliveryId]/actions.js",
        name: "detachDeliveryInvoiceAction",
        mustCall: "requireUser",
        reason:
            `${DELIVERY_JOB_AXIS} Issue #210 — the same two axes as the attach action ` +
            "above, minus the vendor test: a pairing that somehow crossed vendors has " +
            "to stay detachable, or the refusal would lock in the state it objects to.",
    },
    {
        file: "app/deliveries/[deliveryId]/actions.js",
        name: "createOverageDraftAction",
        mustCall: "requireUser",
        reason:
            `${DELIVERY_JOB_AXIS} Issue #167 — deliberately Job-scoped rather than ` +
            "Admin, because raising the overage request is site work. That NARROWED " +
            "#166, which withheld invoice existence from site staff on the deliveries " +
            "list, while this action and its preview reveal that the over-delivered " +
            "ordered item is invoiced, by which invoice and at what unit price — none of " +
            "which can be hidden from someone raising a request quoted from it. #211 " +
            "then released that column to every viewer, so the contrast is gone while " +
            "the reasoning the disclosure rests on is not. It also re-derives " +
            "eligibility from a fresh read, so a request raised in another tab " +
            "lands as a refusal rather than a second Draft.",
    },
    {
        file: "app/prs/actions.js",
        name: "claimDirectPurchaseAction",
        mustCall: "requireUser",
        reason:
            `${DELIVERY_JOB_AXIS} Issue #272 — the SECOND axis to ask that function, ` +
            "and deliberately not Admin: the office recorded the direct purchase " +
            "precisely because it could not raise the request, so gating this to the " +
            "office would hand it back to the people who cannot act on it. A row " +
            "outside the viewer's jobs reads as gone rather than refused, and the " +
            "claim re-reads the row so one raised in another tab lands as a refusal " +
            "naming its holder rather than as a second Draft.",
    },
];

function wrapperOf(init) {
    if (!init || init.type !== "CallExpression" || init.callee?.type !== "Identifier") return null;
    const name = init.callee.name;
    if (!(name in WRAPPERS)) return null;
    return { name, argCount: init.arguments.length, expectedArgs: WRAPPERS[name] };
}

export function run({ check, assert, log }) {
    let ok = true;
    const fail = (msg) => {
        ok = false;
        assert(msg, false);
    };

    // #224 moved the enumeration to _entrypoints.mjs, where the ops-label check
    // reads the same list. Nothing about THIS check's judgment moved: pages are
    // dropped here because a page carries its authorization in its own body
    // rather than in a wrapper, which is why this inventory never had them.
    // Verified pure by diffing this check's whole output across the extraction.
    const { entries } = listEntryPoints({ onParseError: fail });
    const inventory = entries
        .filter((e) => e.kind !== "page")
        .map((e) => ({ file: e.file, name: e.name, init: e.init, ast: e.ast, surface: e.kind }));

    log(`inventory: ${inventory.length} endpoint exports across ${new Set(inventory.map((e) => e.file)).size} files`);

    const exemptKey = (f, n) => `${f}::${n}`;
    const exemptionsByKey = new Map(EXEMPTIONS.map((e) => [exemptKey(e.file, e.name), e]));
    const usedExemptions = new Set();
    let wrappedCount = 0;

    for (const entry of inventory) {
        const key = exemptKey(entry.file, entry.name);
        const wrapper = wrapperOf(entry.init);
        const exemption = exemptionsByKey.get(key);

        if (wrapper) {
            wrappedCount++;
            // Ordering needs no assertion here: the wrapper owns the call.
            if (
                !check(
                    `${entry.file} — ${entry.name} wrapped by ${wrapper.name}, ${wrapper.expectedArgs} arg(s)`,
                    wrapper.argCount,
                    wrapper.expectedArgs
                )
            ) {
                ok = false;
            }
            if (exemption) {
                fail(`${entry.file} — ${entry.name} is wrapped AND exempt; delete the stale exemption`);
                usedExemptions.add(key);
            }
            continue;
        }

        if (!exemption) {
            fail(
                `${entry.file} — ${entry.name} (${entry.surface}) is neither wrapped by one of ` +
                    `${Object.keys(WRAPPERS).join("/")} nor listed as an exemption in this file`
            );
            continue;
        }

        usedExemptions.add(key);
        if (exemption.mustCall) {
            // Presence only — see the scope note at the top of this file: order
            // is deliberately NOT asserted for an exempt export.
            const target = collectExports(entry.ast).find((e) => e.name === entry.name);
            if (
                !assert(
                    `${entry.file} — ${entry.name} exempt, and still calls ${exemption.mustCall}() (presence, not order)`,
                    Boolean(target?.node) && callsFunction(target.node, exemption.mustCall)
                )
            ) {
                ok = false;
            }
        } else {
            assert(`${entry.file} — ${entry.name} exempt (no gate expected)`, true);
        }
    }

    for (const [key] of exemptionsByKey) {
        if (!usedExemptions.has(key)) {
            fail(`stale exemption for ${key}: no such export in the inventory`);
        }
    }

    log(`summary: ${wrappedCount} wrapped, ${EXEMPTIONS.length} exempt, ${inventory.length} total`);

    // ── A LAYOUT GATES NOTHING AND STARTS NO USER READ (#478) ───────────────
    // Next renders a layout once and keeps it across every navigation under it, so a
    // gate in one stands in front of the first page only — the gate is each page's own
    // `requireUser()`. And a read a layout starts is made outside every page's ops scope,
    // counted and attributed to nobody. A layout that draws who is reading takes the read
    // the page's gate already made, through `takePageUser`, which reads nothing.
    log("");
    log("no layout gates or reads a user; one that draws the reader takes the page's read:");
    const sessionCalls = (ast) => {
        const out = [];
        walk(ast, (n) => {
            if (n.type === "CallExpression" && n.callee?.type === "Identifier" && SESSION_CALLS.includes(n.callee.name)) {
                out.push(n.callee.name);
            }
        });
        return out;
    };
    const layouts = listJsFiles(repoPath("app"))
        .map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1))
        .filter((rel) => /(^|\/)layout\.js$/.test(rel));
    assert("  the layouts were found, the root's among them", layouts.includes("app/layout.js") && layouts.length > 1);
    for (const rel of layouts) {
        if (!check(`  ${rel} calls no gate and no reader`, sessionCalls(parseFile(rel).ast).join(" "), "")) ok = false;
    }
    // ANTI-VACUITY: the walk sees a gate and a reader planted in a layout's body.
    check(
        "  a planted gate and reader are seen",
        sessionCalls(parseSource("export default async function L() { await requireUser(); return getActiveUser(); }", "<planted>").ast).join(" "),
        "requireUser getActiveUser"
    );
    return ok;
}

/** The gates and readers that resolve a session — what a layout may not call (#478). */
const SESSION_CALLS = ["requireUser", "requireAdmin", "requireAdminApi", "getActiveUser", "getCurrentUser"];

if (isMain(import.meta.url)) standalone(title, run);

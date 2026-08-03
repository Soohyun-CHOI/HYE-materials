// Endpoint inventory — every export wrapped, or exempt with a reason.
//
// Moved here by #152 from scripts/tests/verify-authz-structure.mjs, and now
// built on the shared _ast.mjs layer rather than its own copy of a parser and
// a walker. Behaviour is unchanged; #147's history is below.
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
// ---------------------------------------------------------------------------

import { join } from "path";
import {
    callsFunction,
    listJsFiles,
    parseFile,
    REPO_ROOT,
    toPosix,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Endpoint inventory — every export wrapped, or exempt with a reason (#134/#147)";

// The wrappers lib/authz.js exports, and how many arguments each takes. The
// arity is checked too: it is what stops a call site from reaching past the
// binding in lib/authz.js and supplying its own gate.
const WRAPPERS = {
    withAdminApi: 1,
    withAdminAction: 2,
    withPresidentAction: 1,
};

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

// Scanned in full. Deliberately not narrowed to the directories that happen to
// pass: app/ holds every route and action, and lib/ is included so a
// "use server" file appearing there is not invisible.
const SCAN_ROOTS = ["app", "lib"];

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

const DELIVERY_AUTHOR_AXIS =
    "Session + authorship, not a role. The Job scope is checked first so someone outside it learns nothing, then " +
    "canDeleteDelivery (lib/deliveryDelete.js) decides on author-or-Admin inside the shared write path. Admin is " +
    "one branch of that predicate rather than the gate, so withAdminAction would refuse the author — who is " +
    "typically neither President nor Admin — and admit nobody it should.";

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
        reason: "Public by design: this is how someone with no session asks for a magic link. There is no caller to authorize.",
    },
    {
        file: "app/api/auth/logout/route.js",
        name: "POST",
        reason: "Public by design: destroys whatever session is present, and having none is not an error.",
    },
    {
        file: "app/api/auth/verify/route.js",
        name: "GET",
        reason: "Public by design: consumes a single-use token and starts the session. The token is the credential.",
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
    { file: "app/prs/[prId]/actions.js", name: "approveAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/[prId]/actions.js", name: "editAndContinueAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/[prId]/actions.js", name: "returnForCorrectionAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/[prId]/actions.js", name: "withdrawAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/new/actions.js", name: "saveDraftAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/new/actions.js", name: "deleteDraftAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/prs/new/actions.js", name: "createPRAction", mustCall: "requireUser", reason: REQUIRE_USER_AXIS },
    { file: "app/deliveries/new/actions.js", name: "createDeliveryAction", mustCall: "requireUser", reason: DELIVERY_JOB_AXIS },
    { file: "app/deliveries/[deliveryId]/actions.js", name: "updateDeliveryAction", mustCall: "requireUser", reason: DELIVERY_JOB_AXIS },
    { file: "app/deliveries/[deliveryId]/actions.js", name: "replaceDeliveryPhotoAction", mustCall: "requireUser", reason: DELIVERY_JOB_AXIS },
    { file: "app/deliveries/[deliveryId]/actions.js", name: "deleteDeliveryAction", mustCall: "requireUser", reason: DELIVERY_AUTHOR_AXIS },
];

function directivesOf(body) {
    const out = [];
    for (const node of Array.isArray(body) ? body : []) {
        if (node.type !== "ExpressionStatement") break;
        const v = node.directive ?? (node.expression?.type === "Literal" ? node.expression.value : null);
        if (typeof v !== "string") break;
        out.push(v);
    }
    return out;
}

const hasUseServerDirective = (ast) => directivesOf(ast.body).includes("use server");

// Function-level "use server" — an inline Server Action declared inside a
// component rather than in an actions.js module. None exist today, and this
// finds any that appear: they are directly callable like every other action,
// so one showing up unwrapped should fail rather than pass by not being looked
// for. The fix for a hit is to move it into an actions.js file and wrap it, or
// to add an exemption with a reason.
function findInlineServerActions(ast) {
    const found = [];
    walk(ast, (n) => {
        const isFn =
            n.type === "FunctionDeclaration" ||
            n.type === "FunctionExpression" ||
            n.type === "ArrowFunctionExpression";
        if (isFn && n.body?.type === "BlockStatement" && directivesOf(n.body.body).includes("use server")) {
            found.push(n.id?.name || "<anonymous inline action>");
        }
    });
    return found;
}

// Every export, with whatever it was initialized to. A re-export specifier
// carries no initializer, so it lands as unwrapped and has to be justified —
// the safe default.
function collectExports(ast) {
    const found = [];
    for (const node of ast.body) {
        if (node.type === "ExportDefaultDeclaration") {
            found.push({ name: "default", init: node.declaration, node });
        } else if (node.type === "ExportNamedDeclaration") {
            if (node.declaration?.type === "FunctionDeclaration") {
                found.push({ name: node.declaration.id.name, init: null, node });
            } else if (node.declaration?.type === "VariableDeclaration") {
                for (const d of node.declaration.declarations) {
                    found.push({ name: d.id.name, init: d.init, node });
                }
            } else if (node.specifiers?.length) {
                for (const s of node.specifiers) {
                    found.push({ name: s.exported.name, init: null, node });
                }
            }
        }
    }
    return found;
}

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

    const inventory = [];
    for (const root of SCAN_ROOTS) {
        for (const abs of listJsFiles(join(REPO_ROOT, root))) {
            const rel = toPosix(abs.slice(REPO_ROOT.length + 1));
            let parsed;
            try {
                parsed = parseFile(rel);
            } catch (err) {
                // Loud, not skipped: an unparsed file is an unchecked file.
                fail(err.message);
                continue;
            }
            const { ast } = parsed;

            for (const name of findInlineServerActions(ast)) {
                inventory.push({ file: rel, name, init: null, ast, surface: "inline action" });
            }

            const isRoute = /^app\/api\/.*\/route\.js$/.test(rel);
            const isAction = hasUseServerDirective(ast);
            if (!isRoute && !isAction) continue;

            for (const exp of collectExports(ast)) {
                if (isRoute && !HTTP_METHODS.has(exp.name)) continue;
                inventory.push({ file: rel, name: exp.name, init: exp.init, ast, surface: isRoute ? "route" : "action" });
            }
        }
    }

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
    return ok;
}

if (isMain(import.meta.url)) standalone(title, run);

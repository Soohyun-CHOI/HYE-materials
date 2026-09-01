// Every URL parameter is read by the screen it lands on, and none of them confirms (#321).
//
// WHAT THIS FILE IS FOR, IN THREE SENTENCES. Nineteen actions redirected to the
// document they had just written and appended `?done=<key>`, and five screens read
// that key back to draw a green line saying what the reader had just done. #321
// removed the line on the ground that the arrival already says it — a create lands on
// the document it made, an edit on the one it changed — and the parameter with it.
// What is left is a URL that carries only what a reader can act on, and two ways for
// that to rot silently.
//
//   THE SILENT MUTANT IS A HALF-REMOVAL. Take the line off a screen and leave the
//   action appending the parameter: the URL carries something nobody reads, no check
//   fails, no screen changes, and the next reader to see `?done=updated` in an address
//   bar concludes there is a feature behind it. Assertion 1 is that mutant, and it
//   compares CODE TO CODE rather than code to a list — every parameter a redirect
//   appends has to be read by the page it lands on.
//
//   THE REVERSE MUTANT IS THE OTHER HALF. Take the parameter off the action and leave
//   the screen reading it: the condition is false forever, the screen never changes,
//   and nothing says so. `offline/job-column.mjs` names the same shape one axis over —
//   "remove the render, leave the read, and the screen is right, the budget is
//   unchanged and nothing anywhere fails". Assertion 2 is that mutant, and it needs
//   the inventory below, because a parameter written by a `<Link>` or by a magic-link
//   mail has no redirect for assertion 1 to find.
//
//   AND ASSERTION 3 IS THE ISSUE ITSELF. `done` appears nowhere: not appended, not
//   read, not as a map of sentences keyed by what just happened.
//
// FOUR SCREENS KEEP A CONFIRMATION AND THAT IS WHY THIS IS A RULE RATHER THAN A BAN.
// The line goes where the arrival answers; it stays where the arrival answers nothing,
// and there are four such places. `/invoices/new` records a direct purchase and comes
// back to an empty form (#272) — the request it raised belongs to the site and cannot
// be entered here until it is approved and its order signed, so there is no document
// to land on. The three admin create forms have no detail screen at all: `Jobs`,
// `Vendors` and `Disciplines` are reached only through the records that link them, so
// the action returns to the same empty form. Assertion 4 holds all four, and it is
// also this file's whole-file anti-vacuity: a detector reporting zero everywhere would
// report zero for these too.
//
// WHAT A PASS DOES NOT PROVE. That a screen renders — this tier reads source and never
// draws a page, so a parameter removed from the code could still be reaching a browser
// through a cached build. It also does not prove that the arrival is legible, which is
// the whole premise: that a reader landing on a document can tell the write happened
// is a judgment made in a browser, once per action, and recorded in the pull request.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isPageFile, routeTemplate } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every URL parameter is read by the screen it lands on, and none confirms (#321)";

/**
 * Every parameter any screen in this app may carry, and what it is for.
 *
 * WHY AN INVENTORY AT ALL, given that assertion 1 compares code to code. Because the
 * reverse direction has no second piece of code to compare against: a page that reads
 * `sp.status` is right or wrong depending on whether anything still writes `status`,
 * and the writer may be a `<Link href>`, a client mirroring its filters with
 * `router.replace`, or a link inside an email — none of which a redirect scan sees. So
 * the read side is held to a list, and the list is what says which of those it is.
 *
 * THE THREE GROUPS ARE THREE DIFFERENT ANSWERS TO "what happens on a reload", which is
 * the question #321 was about. A FILTER re-renders the same rows, which is correct and
 * is why it is in the URL at all. A NAVIGATION re-opens the same form on the same
 * draft or token. A ONE-TIME ACCOUNT repeats itself, which is the defect the
 * confirmation line was removed for — these four are the places where saying nothing
 * would be worse, and each one's entry says why it is not a confirmation.
 *
 * `job` IS TWO PARAMETERS WITH ONE NAME AND THAT IS DELIBERATE ENOUGH TO RECORD. On
 * `/prs` it is a Job RECORD ID and repeats; on `/invoices/new` it is a Job CODE and
 * appears once. Nothing reads both, so nothing can confuse them — but a reader of this
 * table would, which is what these two rows are for.
 */
const CARRIED = [
    // ── list filters, mirrored into the URL by the list's own client ────────
    { route: "/prs", param: "job", note: "job filter; repeatable; a Job record id, intersected with the reader's accessible jobs" },
    { route: "/prs", param: "status", note: "status filter, one of the five Purchase Requests values" },
    { route: "/prs", param: "mine", note: "`1` narrows to the reader's own requests" },
    // THE PO LIST CARRIES THREE, AND THIS CHECK IS WHAT SAID SO. #321's own reading of
    // the code found one — a grep for `sp.` misses `sp?.job` and `sp?.mine`, which is
    // how the list came to be written down as narrower than it is. Assertion 2's second
    // direction reported both on the first run.
    { route: "/pos", param: "job", note: "job filter; repeatable; intersected with the job options this reader can see" },
    { route: "/pos", param: "status", note: "status filter, one of the four Purchase Orders values" },
    { route: "/pos", param: "mine", note: "`1` narrows to the orders behind the reader's own requests" },
    { route: "/deliveries", param: "over", note: "`1` narrows to deliveries carrying an over-delivery" },
    { route: "/materials", param: "q", note: "the search term, tokenized by lib/materialPriceView.js; an empty one is the unsearched screen rather than a filter matching everything" },

    // ── navigation: which record the form opens on ──────────────────────────
    { route: "/prs/new", param: "draft", note: "the saved Draft to resume (#72/#74); written by a Link on the drafts list and by both actions that raise one" },
    { route: "/login/confirm", param: "token", note: "the magic-link token; written by lib/auth.js into the mail and by the verify route on every refusal" },

    // ── a one-time account of something the screen does not otherwise say ───
    {
        route: "/invoices/[invoiceId]",
        param: "paired",
        note: "#231 — which delivery the app matched to this invoice at creation. NOT a confirmation: the standing answer below is the delivery section, and this says how the match was reached, which nothing else on the page holds",
    },
    { route: "/invoices/[invoiceId]", param: "tied", note: "#231 — `1` when a tie-break decided the pairing above; a bare flag, never a count" },
    {
        route: "/invoices/new",
        param: "recorded",
        note: "#272 — the Direct Purchase ID just written. The arrival is an empty form, because the request this raises belongs to the site and the invoice cannot be entered until it is approved and its order signed",
    },
    { route: "/invoices/new", param: "job", note: "#272 — the Job CODE the direct purchase was filed against, named in the same sentence" },
    { route: "/admin/jobs/new", param: "created", note: "the Job Code just written. A Job has no detail screen, so the action returns to the same empty form" },
    { route: "/admin/vendors/new", param: "created", note: "the Vendor Name just written; same shape" },
    { route: "/admin/disciplines/new", param: "created", note: "the Discipline Label just written; same shape" },
];

/** The four screens that keep a line, and the text each still renders. */
const KEEPS_A_LINE = [
    // The sentence itself is DIRECT_PURCHASE_COPY.recorded's and is built, so what is
    // asserted here is that the page still calls the builder — the words are that
    // module's and `offline/pr-kind.mjs` is where they are pinned.
    { page: "app/invoices/new/page.js", renders: "DIRECT_PURCHASE_COPY" },
    { page: "app/admin/jobs/new/page.js", renders: "Created job " },
    { page: "app/admin/vendors/new/page.js", renders: "Created vendor " },
    { page: "app/admin/disciplines/new/page.js", renders: "Created discipline " },
];

/** The parameter this issue retired. Barred by name, everywhere. */
const RETIRED = "done";

const SCANNED_DIRS = ["app", "lib"];

// ---------------------------------------------------------------------------
// reading the source
// ---------------------------------------------------------------------------

/** Every `.js` under app/ and lib/, repo-relative and posix-separated. */
function scannedFiles() {
    const out = [];
    for (const dir of SCANNED_DIRS) listJsFiles(repoPath(dir), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

/** Every route template the app serves as a PAGE. Route Handlers carry no reader. */
function pageRoutes() {
    return scannedFiles().filter(isPageFile).map(routeTemplate);
}

/**
 * The route a file belongs to: its own if it is a page, else the nearest ancestor
 * directory that holds one.
 *
 * THIS IS WHAT ATTRIBUTES A CLIENT COMPONENT'S `URLSearchParams` TO A SCREEN. The four
 * list clients each sit beside the `page.js` they are the body of, so the directory
 * walk is exact rather than a guess — and a component that moved away from its page
 * would resolve to the wrong route loudly (a parameter attributed to a screen that
 * does not read it) rather than quietly.
 */
function routeOfFile(rel) {
    let dir = dirname(rel);
    while (dir && dir !== "." && dir !== "app") {
        if (existsSync(repoPath(join(dir, "page.js")))) return routeTemplate(`${dir}/page.js`);
        dir = dirname(dir);
    }
    return existsSync(repoPath("app/page.js")) && dir === "app" ? "/" : null;
}

/** Module-level `const NAME = "...";` string values, for a path assembled from one. */
function moduleStrings(ast) {
    const out = new Map();
    for (const node of ast.body) {
        if (node.type !== "VariableDeclaration") continue;
        for (const d of node.declarations) {
            if (d.id.type === "Identifier" && d.init?.type === "Literal" && typeof d.init.value === "string")
                out.set(d.id.name, d.init.value);
        }
    }
    return out;
}

/**
 * The static text of a string or template, with each interpolation replaced by `*`.
 *
 * A module const standing where a path should be is RESOLVED rather than starred —
 * `app/api/auth/verify/route.js` builds every one of its refusals as
 * `` `${CONFIRM_PATH}?token=…` ``, so starring it would lose the only route that
 * writer names.
 */
function staticText(node, consts) {
    if (node?.type === "Literal" && typeof node.value === "string") return node.value;
    if (node?.type !== "TemplateLiteral") return null;
    let out = "";
    node.quasis.forEach((q, i) => {
        out += q.value.cooked ?? "";
        if (i < node.expressions.length) {
            const e = node.expressions[i];
            const resolved = e.type === "Identifier" ? consts.get(e.name) : null;
            out += resolved ?? "*";
        }
    });
    return out;
}

/** Every `key` in a `?key=` or `&key=` occurrence of one static text. */
function queryKeysIn(text) {
    return [...String(text).matchAll(/[?&]([A-Za-z][A-Za-z0-9_-]*)=/g)].map((m) => m[1]);
}

/**
 * Which known route a path-shaped static text names, or null.
 *
 * SUFFIX RATHER THAN EQUALITY, because a path is not always written from the root:
 * `lib/auth.js` builds the magic link as `` `${baseUrl}/login/confirm?token=…` ``, so
 * the text starts with a starred segment. `/` is matched exactly and never as a
 * suffix, since every path ends with it.
 */
function routeOfPath(text, routes) {
    const path = String(text).split("?")[0];
    if (!path.startsWith("/") && !path.includes("/")) return null;
    const segs = path.split("/").filter(Boolean);
    for (const route of routes) {
        if (route === "/") {
            if (path === "/") return route;
            continue;
        }
        const want = route.split("/").filter(Boolean);
        if (want.length > segs.length) continue;
        const tail = segs.slice(segs.length - want.length);
        const fits = want.every(
            (w, i) => w === tail[i] || (w.startsWith("[") && (tail[i] === "*" || tail[i].includes("*")))
        );
        if (fits) return route;
    }
    return null;
}

const isFunction = (n) =>
    n?.type === "FunctionDeclaration" ||
    n?.type === "FunctionExpression" ||
    n?.type === "ArrowFunctionExpression";

/** Walk one scope's own nodes, stopping at every nested function boundary. */
function walkOwnScope(root, visit) {
    (function step(n, isRoot) {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach((c) => step(c, false));
        if (typeof n.type !== "string") return;
        if (!isRoot && isFunction(n)) return;
        visit(n);
        for (const key of Object.keys(n)) {
            if (key === "loc" || key === "range" || key === "parent") continue;
            step(n[key], false);
        }
    })(root, true);
}

/** The module body plus every function body, each as its OWN scope. */
function scopes(ast) {
    const out = [ast];
    walk(ast, (n) => {
        if (isFunction(n)) out.push(n);
    });
    return out;
}

/**
 * Every (route, param) this file WRITES into a URL.
 *
 * A KEY IS PLACED BY ITS OWN TEXT WHERE IT CAN BE, AND BY ITS SCOPE OTHERWISE, and the
 * split is what makes the attribution exact rather than plausible. `?token=` sits in
 * the same template as `/login/confirm` and needs no scope at all; `.set("paired", …)`
 * and the `&job=` fragment carry no path, so they take the single route their own
 * function redirects to. Only when that fails does the file's own route stand in,
 * which is what puts a list client's mirrored filters on the list.
 *
 * NESTED FUNCTIONS ARE THEIR OWN SCOPES, WHICH IS NOT A DETAIL. A list client's row
 * `<Link>` names the DETAIL route, and the `useEffect` that mirrors the filter names no
 * route at all — walking the component whole would put `over` on
 * `/deliveries/[deliveryId]`. The first version did exactly that.
 *
 * AN `/api/` PATH IS NOT A SCREEN AND ITS KEYS ARE DROPPED. `InvoiceForm` fetches
 * `/api/pos/search?q=…`, which is a Route Handler's own parameter and has no reader
 * this file's second assertion could ever be about.
 */
function writtenParameters(rel, ast, routes) {
    const consts = moduleStrings(ast);
    const found = [];
    for (const scope of scopes(ast)) {
        const targets = new Set();
        const deferred = new Set();
        const placed = [];
        walkOwnScope(scope, (n) => {
            const text = staticText(n, consts);
            if (typeof text === "string") {
                const path = text.split("?")[0];
                const route = path.includes("/") ? routeOfPath(text, routes) : null;
                if (route) targets.add(route);
                const keys = queryKeysIn(text);
                if (keys.length && !/(^|[^a-z])\/api\//.test(path)) {
                    if (route) placed.push(...keys.map((param) => ({ param, route })));
                    else keys.forEach((k) => deferred.add(k));
                }
            }
            if (
                n.type === "CallExpression" &&
                n.callee?.type === "MemberExpression" &&
                n.callee.property?.name === "set" &&
                n.arguments[0]?.type === "Literal" &&
                typeof n.arguments[0].value === "string"
            )
                deferred.add(n.arguments[0].value);
        });
        for (const { param, route } of placed) found.push({ rel, param, route });
        if (!deferred.size) continue;
        const scoped = targets.size === 1 ? [...targets][0] : null;
        for (const param of deferred)
            found.push({
                rel,
                param,
                route: scoped ?? routeOfFile(rel),
                unplaceable: !scoped && targets.size > 1,
            });
    }
    const seen = new Set();
    return found.filter((f) => {
        const k = `${f.route}|${f.param}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

/**
 * Every parameter a file READS off the URL, by name.
 *
 * THREE SHAPES, ALL OF WHICH ARE IN USE. A destructured `await searchParams` names its
 * keys directly; a whole `sp` is read a property at a time, which is what the four list
 * screens do; and `useSearchParams()` on the client reads through `.get()`, which is
 * `/materials`'s search box. A fourth shape would be invisible here, which is why
 * assertion 2 runs in both directions — an entry nothing reads fails as loudly as a
 * read of nothing.
 */
function readParameters(ast) {
    const params = new Set();
    const wholeLocals = new Set();
    const getLocals = new Set();

    const isSearchParams = (init) => {
        let e = init;
        if (e?.type === "LogicalExpression") e = e.left;
        if (e?.type === "AwaitExpression") e = e.argument;
        return e?.type === "Identifier" && e.name === "searchParams";
    };

    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator") return;
        if (isSearchParams(n.init)) {
            if (n.id.type === "ObjectPattern") {
                for (const p of n.id.properties)
                    if (p.type === "Property" && p.key.type === "Identifier") params.add(p.key.name);
            } else if (n.id.type === "Identifier") wholeLocals.add(n.id.name);
        }
        if (
            n.id.type === "Identifier" &&
            n.init?.type === "CallExpression" &&
            n.init.callee?.name === "useSearchParams"
        )
            getLocals.add(n.id.name);
    });

    walk(ast, (n) => {
        if (
            n.type === "MemberExpression" &&
            n.object?.type === "Identifier" &&
            wholeLocals.has(n.object.name) &&
            !n.computed &&
            n.property?.type === "Identifier"
        )
            params.add(n.property.name);
        if (
            n.type === "CallExpression" &&
            n.callee?.type === "MemberExpression" &&
            n.callee.object?.type === "Identifier" &&
            getLocals.has(n.callee.object.name) &&
            n.callee.property?.name === "get" &&
            n.arguments[0]?.type === "Literal"
        )
            params.add(n.arguments[0].value);
    });

    return [...params];
}

/** Every string literal, template quasi and JSX text in a file. */
function allText(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        if (n.type === "TemplateElement") out.push(n.value.cooked ?? "");
        if (n.type === "JSXText") out.push(n.value);
    });
    return out;
}

export function run({ check, assert, log }) {
    const routes = pageRoutes();
    assert(`the app serves ${routes.length} pages`, routes.length > 0);

    const files = scannedFiles();
    const parsed = files.map((rel) => ({ rel, ...parseFile(rel) }));

    const written = parsed.flatMap(({ rel, ast }) => writtenParameters(rel, ast, routes));
    const readBy = new Map();
    for (const { rel, ast } of parsed) {
        const got = readParameters(ast);
        if (got.length) readBy.set(rel, got);
    }
    // A route's readers are its page plus anything under its directory — the client
    // that mirrors the filters reads none of them itself, but `/materials`'s search box
    // does, so the read side is a union per route rather than a page-only lookup.
    const readByRoute = new Map();
    for (const [rel, got] of readBy) {
        const route = isPageFile(rel) ? routeTemplate(rel) : routeOfFile(rel);
        if (!route) continue;
        readByRoute.set(route, new Set([...(readByRoute.get(route) || []), ...got]));
    }

    // ── 1: nothing is appended that the arrival does not read ───────────────
    log("every parameter this app writes into a URL is read by the screen it lands on:");
    assert(
        `${written.length} written parameters found`,
        written.length > 0
    );
    // A key with no path of its own, in a scope that redirects to two different routes,
    // would be attributed by a coin toss. There are none; if one appears, the fix is to
    // give it a path rather than to widen this.
    const unplaceable = written.filter((w) => w.unplaceable);
    check(
        `every key is placed by a path or by one target${unplaceable.length ? ` (${unplaceable.map((a) => `${a.rel}:${a.param}`).join(", ")})` : ""}`,
        unplaceable.length,
        0
    );
    const unread = written.filter((w) => !readByRoute.get(w.route)?.has(w.param));
    check(
        `every one is read${unread.length ? ` (${unread.map((w) => `${w.route}?${w.param} from ${w.rel}`).join("; ")})` : ""}`,
        unread.length,
        0
    );

    // ANTI-VACUITY AND THE MUTATION IN ONE: the retired redirect, restored. Written out
    // here rather than committed to a file, which is `parseSource`'s stated purpose —
    // the detector has to be seen finding `done` on the route it used to land on, and
    // seen calling it unread.
    const restored = parseSource(
        "export async function signPOAction(poId) {\n" +
            "  const po = await getPOById(poId);\n" +
            "  redirect(`/pos/${po.poId}?done=signed`);\n" +
            "}\n",
        "<restored-confirmation>"
    );
    const restoredWrites = writtenParameters("app/pos/[poId]/actions.js", restored.ast, routes);
    assert(
        "the retired redirect is seen, on the route it landed on",
        restoredWrites.some((w) => w.route === "/pos/[poId]" && w.param === "done")
    );
    assert(
        "  and it is reported unread, because no screen reads `done` any more",
        restoredWrites
            .filter((w) => w.param === "done")
            .every((w) => !readByRoute.get(w.route)?.has(w.param))
    );
    // The detector's other three shapes, each seen working, so a zero above is a fact
    // about the repository rather than about the walk.
    const shapes = parseSource(
        'const p = new URLSearchParams();\n' +
            'p.set("over", "1");\n' +
            'router.replace(`${pathname}?${p.toString()}`);\n' +
            'const link = `${baseUrl}/login/confirm?token=${t}`;\n' +
            'redirect("/invoices/new?recorded=" + id);\n',
        "<shapes>"
    );
    const shapeWrites = writtenParameters("app/deliveries/DeliveriesListClient.js", shapes.ast, routes);
    for (const [param, why] of [
        ["over", "a URLSearchParams key"],
        ["token", "a key on a path built from a base url"],
        ["recorded", "a key in a plain string"],
    ])
        assert(`  the detector reads ${why}`, shapeWrites.some((w) => w.param === param));

    // ── 2: nothing is read that nothing writes ──────────────────────────────
    log("");
    log("and the inventory and the screens agree in both directions:");
    const carried = new Set(CARRIED.map((c) => `${c.route}|${c.param}`));
    const readPairs = [...readByRoute].flatMap(([route, ps]) => [...ps].map((p) => `${route}|${p}`));
    const undeclared = readPairs.filter((k) => !carried.has(k));
    check(
        `every parameter a screen reads is in the inventory${undeclared.length ? ` (${undeclared.join(", ")})` : ""}`,
        undeclared.length,
        0
    );
    const unreadEntries = CARRIED.filter((c) => !readByRoute.get(c.route)?.has(c.param));
    check(
        `and every entry is read by its screen${unreadEntries.length ? ` (${unreadEntries.map((c) => `${c.route}?${c.param}`).join(", ")})` : ""}`,
        unreadEntries.length,
        0
    );
    check("the inventory has no duplicate rows", carried.size, CARRIED.length);
    assert("and every entry says what it is for", CARRIED.every((c) => c.note.length > 20));

    // ANTI-VACUITY: the reverse mutant, which is a READ with nothing behind it. A page
    // going on reading a parameter no action sends is the failure `offline/
    // job-column.mjs` names for a column — the screen is right, the budget is
    // unchanged, and the condition is false forever.
    const stillReading = parseSource(
        "async function renderPODetailPage({ params, searchParams }) {\n" +
            "  const { done } = await searchParams;\n" +
            "  return <div>{done}</div>;\n" +
            "}\n",
        "<still-reading>"
    );
    assert("a screen still reading `done` is reported", readParameters(stillReading.ast).includes("done"));
    const wholeObject = parseSource(
        "async function page({ searchParams }) {\n" +
            "  const sp = (await searchParams) ?? {};\n" +
            "  return <div>{sp.over}{sp?.done}</div>;\n" +
            "}\n",
        "<whole-object>"
    );
    const wholeRead = readParameters(wholeObject.ast);
    assert(
        "  and so is one reading it a property at a time",
        wholeRead.includes("done") && wholeRead.includes("over")
    );

    // ── 3: `done` is gone ───────────────────────────────────────────────────
    log("");
    log("`done` is not written, not read, and not a map of sentences (#321):");
    check(
        "no scope writes it",
        written.filter((w) => w.param === RETIRED).length,
        0
    );
    check(
        "no screen reads it",
        [...readBy.values()].flat().filter((p) => p === RETIRED).length,
        0
    );
    // The third place it lived. Five screens carried a `?done=` fragment or a
    // `DONE_MESSAGES` map, and either would survive the two assertions above if the
    // other half were removed first — a map with no reader, or a fragment in a comment
    // describing a redirect that no longer exists.
    const residue = [];
    for (const { rel, ast } of parsed) {
        if (readFileSync(repoPath(rel), "utf8").includes("DONE_MESSAGES")) residue.push(`${rel}: DONE_MESSAGES`);
        for (const t of allText(ast)) if (/[?&]done=/.test(t)) residue.push(`${rel}: ${t.trim().slice(0, 40)}`);
    }
    check(
        `no residue under app/ or lib/${residue.length ? ` (${residue.join("; ")})` : ""}`,
        residue.length,
        0
    );
    assert(
        "  and the residue detector sees a planted one",
        /[?&]done=/.test(allText(parseSource("const u = `/prs/${id}?done=edited`;", "<planted>").ast).join(" "))
    );

    // ── 4: the four screens the arrival does not answer for ─────────────────
    log("");
    log("the four screens whose action lands on no document still say what it wrote:");
    for (const { page, renders } of KEEPS_A_LINE) {
        const source = readFileSync(repoPath(page), "utf8");
        assert(`${page} still renders \`${renders}\``, source.includes(renders));
        const read = readParameters(parseFile(page).ast);
        const route = routeTemplate(page);
        const owned = CARRIED.filter((c) => c.route === route).map((c) => c.param);
        assert(
            `  and reads ${owned.join(" + ")} to do it`,
            owned.length > 0 && owned.every((p) => read.includes(p))
        );
    }
}

if (isMain(import.meta.url)) standalone(title, run);

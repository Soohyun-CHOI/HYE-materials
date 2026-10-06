// The navigation the design settled (#460): the sections the rail carries, which one a
// screen is in, the one string a collapsed icon says twice, and the frame's edges.
//
// SIX CLAIMS.
//   1. THE SECTIONS ARE THE DESIGN'S, IN ITS ORDER, LESS THE ONE WITH NO SCREEN. Typed
//      out here — word, address and order — and every address one the app serves.
//      `Office` is not among them: `app/admin/` holds four forms and no page listing
//      them, so the section would have nowhere to open.
//   2. EVERY ROUTE THE APP SERVES IS IN ONE SECTION OR NONE, AND THE TABLE BELOW SAYS
//      WHICH. `currentOf` reads a section off an address, and the table is literal, so
//      a page added without a line here fails rather than landing in whatever section
//      its first segment happens to fall into. Both directions are compared.
//   3. A COLLAPSED ICON'S TOOLTIP AND ITS NAME ARE ONE EXPRESSION. Read off the rail's
//      AST: a section link's `aria-label`, its visible word and its tooltip are the one
//      `word`, and the toggle's name and tooltip the one `toggleWord`. Values could not
//      hold this — two constants holding the same string pass a value check and drift
//      apart the first time one of them is edited.
//   4. ONLY THE TOOLS LAYOUT CALLS THE RAIL, AND ONLY THE TWO PAGES THE DESIGN DRAWS
//      ONE ON CALL THE BREADCRUMB. #258 moves the rail to the root layout, and this
//      assertion moves with it in that commit.
//   5. THE EDGES: the rail is not drawn below the phone's edge, never prints, stores
//      nothing in the browser and spells no breakpoint — and its print rules are three
//      named ones, none of them a `display`, which is what lets #457's print change a
//      dialog's ancestors' display without meeting a rule of this file's.
//   6. THE ACCOUNT AT THE RAIL'S FOOT SAYS WHO IS READING, FROM THE PAGE'S OWN READ
//      (#478). What it says, by value, for each kind of reader the base holds; its
//      button's name and tooltip one expression, read off its AST as the icons' are;
//      the tools layout handing it `takePageUser()` and reading no user of its own; and
//      its one item posting where the root screen's `Sign out` posts.
//
// WHAT IT CANNOT SEE: anything rendered — a width, the Panel over the screen, the
// tooltip's delay, focus, a print — and the order the account's take depends on, which
// is the framework's at run time. Those were measured in a browser, in PDFs and on a
// production build, and `docs/notes/tools.md` carries the figures. It reads source.
//
// TAILWIND READS THIS FILE FOR CLASS NAMES, so every class it names is assembled while
// it runs (`offline/design-values.mjs` has why).
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { NAVIGATION_COPY, NAVIGATION_SECTIONS, accountOf, currentOf } from "../../../lib/navigation.js";
import { TOOLS_PATH, TOOLS_ROUTES } from "../../../lib/toolRoutes.js";
import { TOOL_LIST_COPY } from "../../../lib/toolListView.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isPageFile, routeTemplate } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { importedPairs } from "./unread-exports.mjs";

export const title = "The navigation the design settled — sections, the current one, one name per icon (#460)";

const RAIL = "app/components/Rail.js";
const ACCOUNT = "app/components/RailAccount.js";
const BREADCRUMB = "app/components/Breadcrumb.js";
const ROOT_PAGE = "app/page.js";
const TOOLS_LAYOUT = "app/(tools)/layout.js";
const TOOL_PAGE = "app/(tools)/tools/[toolRecordId]/page.js";
const TOOL_ITEM_PAGE = "app/(tools)/tool-items/[toolItemId]/page.js";
const MORE_ACTIONS = "app/(tools)/tool-items/[toolItemId]/MoreActions.js";

/** The design's sections less `Office`: key, word, address, in its order. */
const SECTIONS = [
    ["purchase-requests", "Purchase requests", "/prs"],
    ["purchase-orders", "Purchase orders", "/pos"],
    ["invoices", "Invoices", "/invoices"],
    ["deliveries", "Deliveries", "/deliveries"],
    ["tools", "Tools", "/tools"],
    ["material-prices", "Material prices", "/materials"],
];

/** Every route the app serves, and the section it is in — `null` for none. */
const SECTION_OF_ROUTE = {
    "/": null,
    "/addresses/new": null,
    "/admin/categories/new": null,
    "/admin/disciplines/new": null,
    "/admin/jobs/new": null,
    "/admin/vendors/new": null,
    "/deliveries": "deliveries",
    "/deliveries/[deliveryId]": "deliveries",
    "/deliveries/[deliveryId]/edit": "deliveries",
    "/deliveries/new": "deliveries",
    "/invoices": "invoices",
    "/invoices/[invoiceId]": "invoices",
    "/invoices/[invoiceId]/edit": "invoices",
    "/invoices/new": "invoices",
    "/login": null,
    "/login/confirm": null,
    "/login/name": null,
    "/materials": "material-prices",
    "/materials/[materialId]": "material-prices",
    "/pos": "purchase-orders",
    "/pos/[poId]": "purchase-orders",
    "/prs": "purchase-requests",
    "/prs/[prId]": "purchase-requests",
    "/prs/new": "purchase-requests",
    // The address a label prints draws nothing and sits outside the rail's layout (#478).
    "/t/[labelCode]": null,
    "/tool-items/[toolItemId]": "tools",
    "/tools": "tools",
    "/tools/[toolRecordId]": "tools",
};

/** An address a route template answers: each dynamic segment given a plain value. */
const addressOf = (template) => template.replace(/\[[^\]]+\]/g, "sample1");

/** Which sections an address makes current, as `key:mark`. */
const marksFor = (address) =>
    NAVIGATION_SECTIONS.map((s) => [s.key, currentOf(s, address)])
        .filter(([, mark]) => mark)
        .map(([key, mark]) => `${key}:${mark}`);

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);

/** The routes the app serves, from the page files. */
function servedRoutes() {
    return listJsFiles(repoPath("app")).map(repoRelative).filter(isPageFile).map(routeTemplate).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// The rail's source, read for claim 3 and 5
// ─────────────────────────────────────────────────────────────────────────────

const jsxName = (el) => el.openingElement?.name?.name;
const attrOf = (el, name) => el.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name);
const identIn = (attr) => (attr?.value?.type === "JSXExpressionContainer" && attr.value.expression.type === "Identifier" ? attr.value.expression.name : null);

/** A name or a member chain as its source spells it — `words.label` — or null. */
function chainOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) {
        const object = chainOf(node.object);
        return object ? `${object}.${node.property.name}` : null;
    }
    return null;
}

/**
 * The account's one-string rule, judged on a parsed `RailAccount`: the menu button's
 * `aria-label` and the argument its tooltip is shown with are one expression. Returns
 * a sentence per failure.
 */
export function judgeAccountName(ast) {
    let button = null;
    walk(ast, (n) => {
        if (n.type === "JSXElement" && jsxName(n) === "button" && attrOf(n, "aria-haspopup")) button = n;
    });
    if (!button) return ["no menu button found"];
    const failures = [];
    const label = attrOf(button, "aria-label")?.value;
    const name = label?.type === "JSXExpressionContainer" ? chainOf(label.expression) : null;
    if (!name) failures.push("the menu button's aria-label is not one expression");
    let tip = null;
    walk(button.openingElement, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "targetProps") tip = chainOf(n.arguments[0]) ?? "(not one expression)";
    });
    if (tip !== name) failures.push(`its tooltip reads ${tip} where its name reads ${name}`);
    return failures;
}

/** The argument a `{...x.targetProps(arg)}` spread hands over, as an identifier name. */
function tooltipArg(el) {
    for (const a of el.openingElement.attributes) {
        if (a.type !== "JSXSpreadAttribute") continue;
        const call = a.argument;
        if (call?.type === "CallExpression" && call.callee?.property?.name === "targetProps") {
            return call.arguments[0]?.type === "Identifier" ? call.arguments[0].name : "(not an identifier)";
        }
    }
    return null;
}

/** The identifier a child `{x}` of some descendant of `el` renders, the visible word. */
function shownWords(el) {
    const out = [];
    walk(el, (n) => {
        if (n.type === "JSXExpressionContainer" && n.expression?.type === "Identifier") out.push(n.expression.name);
    });
    return out;
}

/**
 * The one-string rule, judged on a parsed rail: every way a section link and the
 * toggle are named reads the same identifier. Returns a sentence per failure.
 */
export function judgeOneName(ast) {
    const failures = [];
    const elements = [];
    walk(ast, (n) => {
        if (n.type === "JSXElement") elements.push(n);
    });
    const link = elements.find((el) => jsxName(el) === "Link");
    const toggle = elements.find((el) => jsxName(el) === "button" && attrOf(el, "aria-expanded"));
    if (!link) failures.push("no section link found");
    if (!toggle) failures.push("no toggle found");
    if (link) {
        const name = identIn(attrOf(link, "aria-label"));
        const tip = tooltipArg(link);
        if (!name) failures.push("a section link's aria-label is not one identifier");
        if (tip !== name) failures.push(`a section link's tooltip reads ${tip} where its name reads ${name}`);
        if (!shownWords(link).includes(name)) failures.push(`a section link does not show ${name} as its word`);
        // `word` is the section's own word, not a second spelling of it.
        let bound = null;
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === name) bound = n.init;
        });
        const readsSections =
            bound?.type === "MemberExpression" && bound.computed && bound.object?.property?.name === "sections";
        if (!readsSections) failures.push(`${name} is not read off the copy's sections`);
    }
    if (toggle) {
        const name = identIn(attrOf(toggle, "aria-label"));
        const tip = tooltipArg(toggle);
        if (!name) failures.push("the toggle's aria-label is not one identifier");
        if (tip !== name) failures.push(`the toggle's tooltip reads ${tip} where its name reads ${name}`);
    }
    return failures;
}

/** Every `className` string literal in a parsed file, by the JSX element carrying it. */
function classNames(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type !== "JSXElement") return;
        const cls = attrOf(n, "className");
        if (cls?.value?.type === "Literal") out.push({ name: jsxName(n), tokens: cls.value.value.split(/\s+/) });
    });
    return out;
}

/** Every identifier and string in a parsed file, to say what it never names. */
function namesAndStrings(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Identifier" || n.type === "JSXIdentifier") out.push(n.name);
        else if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        else if (n.type === "TemplateElement") out.push(n.value.cooked ?? "");
    });
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, assert, log }) {
    // Assembled, so no whole class appears in a file Tailwind scans.
    const cls = (...parts) => parts.join("");

    // ── 1: the sections ──────────────────────────────────────────────────────
    log("the sections are the design's, in its order, less the one with no screen:");
    check(
        "  key, word and address, in order",
        JSON.stringify(NAVIGATION_SECTIONS.map((s) => [s.key, NAVIGATION_COPY.sections[s.key], s.href])),
        JSON.stringify(SECTIONS)
    );
    check("  every word belongs to a section", Object.keys(NAVIGATION_COPY.sections).join(" "), SECTIONS.map(([k]) => k).join(" "));
    check("  no section says Office", JSON.stringify(NAVIGATION_COPY).includes("Office"), false);
    check("  Tools says the list's own heading", NAVIGATION_COPY.sections.tools, TOOL_LIST_COPY.heading);
    check("  and opens the list", NAVIGATION_SECTIONS.find((s) => s.key === "tools").href, TOOLS_PATH);
    check(
        "  and owns the first segment of every tools screen",
        NAVIGATION_SECTIONS.find((s) => s.key === "tools").segments.join(" "),
        "tools tool-items"
    );
    assert(
        "  and TOOLS_ROUTES really starts with those, the printed address not among them",
        TOOLS_ROUTES.some((r) => r.startsWith("/tool-items/")) && !TOOLS_ROUTES.some((r) => r.startsWith("/t/"))
    );

    const routes = servedRoutes();
    assert(`  the app's routes were read (${routes.length})`, routes.length > 20 && routes.includes("/tools"));
    for (const [, , href] of SECTIONS) assert(`  ${href} is a route the app serves`, routes.includes(href));

    log("");
    log("the words, by value:");
    check("  the rail's name", NAVIGATION_COPY.rail, "Sections");
    check("  the toggle collapsed", NAVIGATION_COPY.expand, "Expand navigation");
    check("  the toggle expanded", NAVIGATION_COPY.collapse, "Collapse navigation");
    check("  the breadcrumb's name", NAVIGATION_COPY.breadcrumb, "Breadcrumb");
    check("  the mark between two levels", NAVIGATION_COPY.separator, "/");

    // ── 2: every route in one section or none ───────────────────────────────
    log("");
    log("every route the app serves is in one section or none, and the table says which:");
    check("  no route the table does not classify", routes.filter((r) => !(r in SECTION_OF_ROUTE)).join(" "), "");
    check("  no route the table names that the app does not serve", Object.keys(SECTION_OF_ROUTE).filter((r) => !routes.includes(r)).join(" "), "");
    for (const route of routes) {
        const want = SECTION_OF_ROUTE[route];
        const href = want && SECTIONS.find(([k]) => k === want)[2];
        const mark = want ? `${want}:${route === href ? "page" : "true"}` : "";
        check(`  ${route}`, marksFor(addressOf(route)).join(" "), mark);
    }
    check("  a query does not move the page", marksFor("/tools?page=2&id=HYE-TL-260909-001").join(" "), "tools:page");
    check("  a segment is matched whole", marksFor("/toolshed").join(" "), "");
    check("  nor a prefix of one", marksFor("/prs-archive/1").join(" "), "");

    // ── 3: one string per collapsed icon ─────────────────────────────────────
    log("");
    log("a collapsed icon's tooltip and its name are one expression:");
    const railAst = parseFile(RAIL).ast;
    check("  the rail", judgeOneName(railAst).join(" | "), "");
    const planted = (link, toggle) =>
        judgeOneName(
            parseSource(
                `const word = COPY.sections[section.key]; const toggleWord = COPY.expand;
                 const a = <Link aria-label={word} {...tip.targetProps(${link})}><span>{word}</span></Link>;
                 const b = <button aria-expanded={x} aria-label={toggleWord} {...tip.targetProps(${toggle})} />;`,
                "<planted>"
            ).ast
        );
    check("  a planted rail that agrees passes", planted("word", "toggleWord").join(" | "), "");
    assert("  a link whose tooltip reads another string fails", planted("other", "toggleWord").some((f) => f.includes("tooltip reads other")));
    assert("  a toggle whose tooltip reads another string fails", planted("word", "COPY.expand").length > 0);
    assert(
        "  a word spelled rather than read off the sections fails",
        judgeOneName(parseSource(`const word = "Tools"; const a = <Link aria-label={word} {...tip.targetProps(word)}><span>{word}</span></Link>; const b = <button aria-expanded={x} aria-label={t} {...tip.targetProps(t)} />;`, "<planted>").ast).some((f) => f.includes("not read off"))
    );

    // Every section has its icon, and no icon is for a section that is not there.
    let iconKeys = null;
    walk(railAst, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "SECTION_ICONS") {
            iconKeys = n.init.properties.map((p) => p.key.name ?? p.key.value);
        }
    });
    check("  an icon for every section and none besides", (iconKeys ?? []).join(" "), SECTIONS.map(([k]) => k).join(" "));

    // ── 4: who calls the rail and the breadcrumb ─────────────────────────────
    log("");
    log("only the tools layout calls the rail, and only the two pages the design draws one on call the breadcrumb:");
    const appFiles = ["app", "components", "lib"].flatMap((d) => listJsFiles(repoPath(d))).map(repoRelative);
    const importers = (target) =>
        appFiles.filter((rel) => [...importedPairs(rel, parseFile(rel).ast)].some((p) => p.startsWith(`${target}::`))).sort();
    check("  the rail's callers", importers(RAIL).join(" "), TOOLS_LAYOUT);
    check("  the breadcrumb's callers", importers(BREADCRUMB).join(" "), [TOOL_ITEM_PAGE, TOOL_PAGE].sort().join(" "));
    assert("  and the walk finds a component's callers at all", importers("app/components/DialogFrame.js").length > 2);

    // The tool item page ends its path on the code its label prints (1c).
    let currentCall = null;
    walk(parseFile(TOOL_ITEM_PAGE).ast, (n) => {
        if (n.type === "JSXElement" && jsxName(n) === "Breadcrumb") currentCall = attrOf(n, "current")?.value?.expression;
    });
    check("  the tool item's path ends on its label code", currentCall?.callee?.name ?? null, "labelCodeFor");

    // ── 5: the edges ─────────────────────────────────────────────────────────
    log("");
    log("the rail is not drawn below the phone's edge, never prints, stores nothing, spells no breakpoint:");
    const railClasses = classNames(railAst);
    const holding = (token) => railClasses.filter((c) => c.tokens.includes(token));
    const slot = holding(cls("max-sm", ":hidden"));
    check("  one element hides the rail below the phone's edge", slot.length, 1);
    assert("  and the same element never prints", slot[0]?.tokens.includes(cls("print", ":hidden")));
    const frame = holding(cls("sm", ":h-dvh"));
    check("  one element is the frame, held to the window from the phone's edge up", frame.length, 1);
    assert("  and gives the window's height up in print", frame[0]?.tokens.includes(cls("print", ":h-auto")));
    // Every print rule in the file, the column's constant included, is one of these
    // three — none sets a display, which is what #457's print changes on an ancestor.
    const railStrings = namesAndStrings(railAst);
    const printRules = (strings) => [...new Set(strings.flatMap((s) => s.split(/\s+/)).filter((t) => t.startsWith(cls("print", ":"))))].sort();
    check(
        "  its only print rules hide the rail and let the frame and the column run on",
        printRules(railStrings).join(" "),
        [cls("print", ":h-auto"), cls("print", ":hidden"), cls("print", ":overflow-visible")].join(" ")
    );
    const stores = ["localStorage", "sessionStorage", "cookie", "cookies", "indexedDB"];
    check("  it stores nothing in the browser", railStrings.filter((s) => stores.includes(s)).join(" "), "");
    const breakpoint = (s) => /\b(1280|80rem|matchMedia|innerWidth)\b/.test(s);
    check("  it spells no breakpoint", railStrings.filter(breakpoint).join(" "), "");
    // Anti-vacuity for the last three: the walk sees what a planted file names.
    const planted5 = namesAndStrings(
        parseSource(`localStorage.setItem("rail", "1"); matchMedia("(width >= 80rem)"); const c = "flex ${cls("print", ":block")}";`, "<planted>").ast
    );
    assert("  a planted store is seen", planted5.includes("localStorage"));
    assert("  a planted breakpoint is seen", planted5.filter(breakpoint).length === 2);
    check("  a planted print rule is seen", printRules(planted5).join(" "), cls("print", ":block"));

    // ── 6: the account at the rail's foot (#478) ─────────────────────────────
    log("");
    log("the account says who is reading, in one string, from the page's own read:");
    // Each kind of reader the base holds — `soo@` is the President and the office both.
    const reader = (email, role, isAdmin) => accountOf({ email, role, isAdmin });
    check(
        "  an office reader, as the design draws one",
        JSON.stringify(reader("lee@hanyangengusa.com", "Employee", true)),
        JSON.stringify({ name: "lee", email: "lee@hanyangengusa.com", initial: "l", role: "Admin", label: "lee, Admin" })
    );
    check("  the President who is the office too", reader("soo@hanyangengusa.com", "President", true).label, "soo, President, Admin");
    check("  the President alone", reader("soo@hanyangengusa.com", "President", false).role, "President");
    check("  a reader who is neither", reader("minjae.seo@hanyangengusa.com", "Employee", false).label, "minjae.seo, Employee");
    check("  the avatar takes the address's first letter as it is spelled", reader("Kji9408@hanyangengusa.com", "Employee", false).initial, "K");
    check("  the menu's one word", NAVIGATION_COPY.account.signOut, "Sign out");
    check("  the office's word", NAVIGATION_COPY.account.admin, "Admin");

    const accountAst = parseFile(ACCOUNT).ast;
    check("  the account's name and its tooltip", judgeAccountName(accountAst).join(" | "), "");
    const plantedAccount = (tip) =>
        judgeAccountName(
            parseSource(`const b = <button aria-haspopup="menu" aria-label={words.label} {...tip.targetProps(${tip})} />;`, "<planted>").ast
        );
    check("  a planted button that agrees passes", plantedAccount("words.label").join(" | "), "");
    assert("  one whose tooltip reads another expression fails", plantedAccount("words.name").length > 0);
    check("  only the rail draws it", importers(ACCOUNT).join(" "), RAIL);

    // #495 — the account's menu is 0m's: the reader's email heads it, it opens above an
    // expanded row and beside a collapsed button, and the button holds its hover while open.
    const accountSource = parseFile(ACCOUNT).source;
    const menuAttr = (name) => {
        let found = null;
        walk(accountAst, (n) => {
            if (n.type !== "JSXElement" || jsxName(n) !== "ActionMenu") return;
            const value = attrOf(n, name)?.value;
            if (value?.type === "JSXExpressionContainer") found = accountSource.slice(value.expression.start, value.expression.end);
            else if (value?.type === "Literal") found = JSON.stringify(value.value);
        });
        return found;
    };
    check("  its menu is headed with the reader's email (0m, #495)", menuAttr("heading"), "words.email");
    check("  and opens above an expanded row and beside a collapsed button", menuAttr("placement"), 'expanded ? "above" : "beside"');
    let shapeHanded = null;
    walk(railAst, (n) => {
        if (n.type === "JSXElement" && jsxName(n) === "RailAccount") shapeHanded = attrOf(n, "expanded")?.value?.expression?.name ?? null;
    });
    check("  which shape it is the rail says", shapeHanded, "expanded");
    const accountClasses = classNames(accountAst);
    const accountButton = accountClasses.find((c) => c.name === "button")?.tokens ?? [];
    const avatar = accountClasses.find((c) => c.tokens.includes("size-avatar"))?.tokens ?? [];
    check(
        "  the row's corner is the Control's, not the Group's",
        ["group-data-expanded:rounded-control", "group-data-expanded:rounded-card"].map((t) => accountButton.includes(t)).join(" "),
        "true false"
    );
    check(
        "  and while its menu is open the row holds Hover and the collapsed avatar Face hover",
        [
            accountButton.includes("group-data-expanded:aria-expanded:bg-hover"),
            avatar.includes("group-aria-expanded/account:bg-selected-hover"),
            avatar.includes("group-data-expanded:group-aria-expanded/account:bg-selected"),
        ].join(" "),
        "true true true"
    );

    // The layout hands the rail the page's read and reads nobody itself.
    const layoutCalls = [];
    walk(parseFile(TOOLS_LAYOUT).ast, (n) => {
        if (n.type === "CallExpression" && n.callee.type === "Identifier") layoutCalls.push(n.callee.name);
    });
    check("  the tools layout takes the page's read", layoutCalls.filter((name) => name === "takePageUser").length, 1);
    check(
        "  and calls no reader or gate of its own",
        layoutCalls.filter((name) => ["getActiveUser", "getCurrentUser", "requireUser", "requireAdmin"].includes(name)).join(" "),
        ""
    );

    // Its one item posts where the root screen's `Sign out` does.
    const formActions = (rel) => {
        const out = [];
        walk(parseFile(rel).ast, (n) => {
            if (n.type === "JSXElement" && jsxName(n) === "form") {
                const action = attrOf(n, "action")?.value?.value;
                const method = attrOf(n, "method")?.value?.value;
                if (action) out.push(`${method} ${action}`);
            }
        });
        return out;
    };
    check("  the account's form", formActions(ACCOUNT).join(" | "), "POST /api/auth/logout");
    check("  is the root screen's", formActions(ROOT_PAGE).join(" | "), formActions(ACCOUNT).join(" | "));
    check("  and the phone's top-bar menu posts there too (#495)", formActions(MORE_ACTIONS).join(" | "), formActions(ROOT_PAGE).join(" | "));
}

if (isMain(import.meta.url)) standalone(title, run);

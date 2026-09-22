// What the four document lists filter by, and what their bar says (#324).
//
// THE BARS GREW BY COPYING AND THIS FILE IS WHAT STOPS THEM DOING IT AGAIN. `/prs`
// and `/pos` carried three controls each, `/deliveries` one and `/invoices` none, and
// no list filtered by vendor though all four head a `Vendor` column. What is pinned
// here is the settled answer: which axes each list carries, what each one is called,
// how they compose, what the URL holds, and which of three sentences a reader gets
// when nothing is left.
//
// THREE THINGS THIS FILE EXISTS FOR IN PARTICULAR.
//
//   THE BAR'S VISIBILITY INVARIANT. The bar is drawn from the rows a reader has
//   BEFORE any filter. Key it off the rows after and it vanishes exactly when a
//   filter has emptied the list — which is the one moment `Clear all filters` is what
//   the reader needs, and it leaves them editing the address bar to get out. The
//   implication is walked exhaustively below rather than read off the code.
//
//   THE WORDS. A label written into the bar's JSX is a string no other check can see:
//   `offline/screen-briefs.mjs` pins what a brief QUOTES, and `scripts/screen-strings.mjs`
//   lists what a screen renders without holding anything to it. So the two shared
//   components are asserted to hold no copy at all — everything they draw arrives as a
//   prop — and the words only a filter bar says are asserted to appear nowhere else
//   under `app/` or `lib/`. That is `offline/product-name.mjs`'s shape, applied to a
//   vocabulary rather than to one name.
//
//   THE FOUR CLIENTS AGREEING. Each list renders the shared bar, filters through the
//   shared predicate and reads its empty state from the shared copy — and holds no
//   `URLSearchParams` and no `router.replace` of its own, which is what four copies of
//   one mechanism looked like before this.
//
// WHAT A PASS DOES NOT PROVE. That anything renders: this tier reads source and
// judges pure functions, and never opens a page. Whether the bar actually appears
// over an emptied list, whether a forged `?job=` is really dropped before paint, and
// whether the count beside `Clear all filters` is right are browser facts, checked
// with the two fixture accounts and recorded in the pull request.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { isMain, standalone } from "./_harness.mjs";
import { REPO_ROOT, listJsFiles, parseFile, repoPath, toPosix, walk } from "./_ast.mjs";
import {
    CONTROL,
    FILTERED_LISTS,
    FILTER_BAR_COPY,
    FILTER_PARAMS,
    LIST_EMPTY_COPY,
    RESERVED_PARAMS,
    ROW_KEY,
    applyFilters,
    axesFor,
    choiceLabel,
    choiceValue,
    emptyFilters,
    emptyStateKind,
    emptyStateText,
    filterQuery,
    filtersActive,
    jobOptionLabel,
    matchesFilters,
    parseFilters,
    pickerOptions,
    showsFilterBar,
} from "../../../lib/listFilters.js";
// #325 — imported to BUILD the rejected alternative below, not to re-test the
// tokenizer. `offline/search-tokens.mjs` is where the rule itself is pinned.
import { matchesTokens, searchTokens } from "../../../lib/searchTokens.js";
import { PR_KIND, PR_KIND_CHOICES, PR_KIND_COPY } from "../../../lib/prKind.js";
import { INVOICE_PAYMENT_WORDS } from "../../../lib/deliveryStatus.js";

export const title = "What the four document lists filter by, and what the bar says (#324)";

/**
 * The settled answer, by value.
 *
 * SUBJECT AXES FIRST AND SHARED: job and vendor are facts every one of these four
 * documents holds, and the reader's own is the third wherever the document has an
 * author. Then each list's own state axis. Written out here rather than derived from
 * the module, so changing what a list filters by is an edit in two places and a
 * decision rather than a slip.
 */
const SETTLED = {
    "/prs": [
        // #325 — FIRST, AND THE POSITION IS SEMANTIC. The box names the ROW; every axis
        // after it narrows by a property of one.
        ["q", CONTROL.search],
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["mine", CONTROL.toggle],
        ["status", CONTROL.select],
        ["kind", CONTROL.select],
    ],
    "/pos": [
        ["q", CONTROL.search],
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["mine", CONTROL.toggle],
        ["status", CONTROL.select],
    ],
    "/deliveries": [
        ["q", CONTROL.search],
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["mine", CONTROL.toggle],
        ["over", CONTROL.toggle],
    ],
    "/invoices": [
        ["q", CONTROL.search],
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        // #382 — the axis this list did not have. `Invoices` held neither a requester
        // nor a recorder, so there was nothing for a control to read; the field
        // arrived and the exception went with it.
        ["mine", CONTROL.toggle],
        ["status", CONTROL.select],
    ],
};

/**
 * What each list's box says and what it matches, by value (#325).
 *
 * TWO ARRAYS PER LIST BECAUSE THEY ARE TWO CLAIMS. `names` is a promise printed in the
 * box and `keys` is what the matcher walks, and the defect they exist to catch is one
 * drifting from the other — a box that offers `Vendor Invoice #` and a matcher that
 * never reads it, or the reverse, which is a list quietly searching something it never
 * said it would.
 *
 * THE THREE NAMES THAT ARE DELIBERATELY ABSENT are held further down, by name, because
 * an exclusion nobody wrote down gets re-added by the next reader.
 */
const SEARCHES = {
    "/prs": {
        names: ["PR ID", "vendor", "job"],
        keys: ["prId", "vendorName", "jobCode", "jobName"],
    },
    "/pos": {
        names: ["PO ID", "vendor", "job"],
        keys: ["poId", "vendorName", "jobCode", "jobName"],
    },
    "/deliveries": {
        names: ["Delivery ID", "vendor", "job"],
        keys: ["deliveryId", "vendorName", "jobCode", "jobName"],
    },
    "/invoices": {
        names: ["Invoice ID", "Vendor Invoice #", "vendor", "job"],
        keys: ["invoiceId", "vendorInvoiceCode", "vendorName", "jobCode", "jobName"],
    },
};

/** What each box says, one string serving as its label and its placeholder. */
const SEARCH_LABELS = {
    "/prs": "Search by PR ID, vendor or job",
    "/pos": "Search by PO ID, vendor or job",
    "/deliveries": "Search by Delivery ID, vendor or job",
    "/invoices": "Search by Invoice ID, Vendor Invoice #, vendor or job",
};

/**
 * The names no list searches, and why — the far side of #325's line.
 *
 * ALL THREE ARE ANOTHER DOCUMENT'S NAME REACHED THROUGH A LINK, which is what the rule
 * bars: allow one and the whole chain follows, a delivery by its order and an order by
 * its request and a request by its quotation. Held as row keys because that is the
 * shape the mutant takes — somebody adds the key to a page and the name to an axis.
 */
const NOT_SEARCHED = [
    ["packingListPO", "a delivery holds a LINK to an order, not a name of its own"],
    ["vendorQuotationCode", "the code is on the `Quotations` row, not the request's"],
    ["directPurchaseId", "a direct purchase's own name, not the request it raised"],
];

/** The label each reader's-own toggle wears: two words for two fields, over four lists. */
const MINE_LABELS = {
    "/prs": "Requested by me",
    "/pos": "Requested by me",
    "/deliveries": "Recorded by me",
    "/invoices": "Recorded by me",
};

/** The four list clients, and the two components they share. */
const CLIENTS = [
    "app/prs/PRListClient.js",
    "app/pos/POListClient.js",
    "app/deliveries/DeliveriesListClient.js",
    "app/invoices/InvoicesListClient.js",
];
const SHARED = ["app/components/ListFilterBar.js", "app/components/PickerFilter.js"];
const PAGES = [
    "app/prs/page.js",
    "app/pos/page.js",
    "app/deliveries/page.js",
    "app/invoices/page.js",
];

/** Where each vocabulary legitimately lives. Everywhere else is the mutant. */
const OWNERS = new Set(["lib/listFilters.js"]);

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

/** Every `.js` under app/ and lib/, repo-relative and posix-separated. */
function scannedFiles() {
    const out = [];
    for (const dir of ["app", "lib"]) listJsFiles(repoPath(dir), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

export function run({ check, assert, log }) {
    // ── 1: which axes each list carries ─────────────────────────────────────
    log("the four lists carry the axes this issue settled:");
    check(
        "the lists with a bar are the four document lists",
        FILTERED_LISTS.slice().sort().join(" "),
        "/deliveries /invoices /pos /prs"
    );
    for (const [route, want] of Object.entries(SETTLED)) {
        const got = axesFor(route).map((a) => [a.param, a.control]);
        check(
            `${route} carries ${want.map(([p]) => p).join(" + ")}`,
            JSON.stringify(got),
            JSON.stringify(want)
        );
    }

    // THE SHARED AXES, ASSERTED AS SHARED rather than read off the four rows above —
    // "these are on every one of them" is the claim, and a row-by-row table states it
    // four times without ever saying it once.
    //
    // `mine` JOINED THE OTHER TWO IN #382 AND WAS THE ONE EXCEPTION UNTIL THEN.
    // `/invoices` had no reader's-own toggle because `Invoices` carried no author
    // field at all — `Deliveries` has `Recorded By`, `Purchase Requests` has
    // `Requester`, and that table had neither. It has the first of those now, so the
    // ground for the exception went with the schema change and the three subject axes
    // are three.
    //
    // `q` JOINS THEM IN #325 AND IS THE FOURTH SHARED AXIS. What differs between the
    // lists is which NAMES it takes, not whether it is there: every one of these
    // documents has an id somebody can be holding.
    for (const param of ["q", "job", "vendor", "mine"]) {
        assert(
            `${param} is on all four lists`,
            FILTERED_LISTS.every((route) => axesFor(route).some((a) => a.param === param))
        );
    }

    // ── 1b: what each list searches ─────────────────────────────────────────
    log("");
    log("each box says what it matches, and matches what it says (#325):");
    for (const [route, want] of Object.entries(SEARCHES)) {
        const axis = axesFor(route).find((a) => a.control === CONTROL.search);
        check(`${route} searches ${want.names.join(" + ")}`, axis.names.join(" + "), want.names.join(" + "));
        check(`  off the row's ${want.keys.join(", ")}`, axis.keys.join(","), want.keys.join(","));
        // THE LABEL IS BUILT FROM `names`, so a name added to the matcher appears in the
        // box without anybody writing a sentence. Pinned by value as well, because
        // "built from the array" is true of a builder that punctuates it wrongly.
        check(`  and the box reads \`${SEARCH_LABELS[route]}\``, axis.words.label, SEARCH_LABELS[route]);
        assert(
            "  every name it says is in the sentence it draws",
            want.names.every((name) => axis.words.label.includes(name))
        );
    }
    // THE THREE SUBJECT KEYS ARE SHARED AND THE ID IS NOT, which is the whole shape of
    // the decision: a vendor and a job are facts every one of these rows holds and
    // every one of these lists heads a column for (#314), and the id and the second
    // name are the document's own.
    for (const route of FILTERED_LISTS) {
        const axis = axesFor(route).find((a) => a.control === CONTROL.search);
        assert(
            `${route} searches the vendor and the job`,
            ["vendorName", "jobCode", "jobName"].every((key) => axis.keys.includes(key))
        );
    }
    check(
        "only /invoices searches a second name",
        FILTERED_LISTS.filter((r) =>
            axesFor(r)
                .find((a) => a.control === CONTROL.search)
                .keys.includes("vendorInvoiceCode")
        ).join(","),
        "/invoices"
    );
    // The far side of the line, by name. `docs/notes/deliveries-and-invoices.md` has
    // what each of the three would have cost.
    for (const [key, why] of NOT_SEARCHED) {
        assert(
            `no list searches \`${key}\` — ${why}`,
            FILTERED_LISTS.every((r) =>
                axesFor(r).every((a) => a.control !== CONTROL.search || !a.keys.includes(key))
            )
        );
    }

    // ── 2: the parameter names ──────────────────────────────────────────────
    log("");
    log("every axis uses a declared parameter, and two names are held for later:");
    for (const route of FILTERED_LISTS) {
        const params = axesFor(route).map((a) => a.param);
        assert(`${route} names each parameter once`, new Set(params).size === params.length);
        assert(
            `  and every one of them is declared`,
            params.every((p) => FILTER_PARAMS.includes(p))
        );
    }
    check(
        "no declared parameter is unused",
        FILTER_PARAMS.filter((p) => !FILTERED_LISTS.some((r) => axesFor(r).some((a) => a.param === p)))
            .join(", "),
        ""
    );
    // #325 SPENT THE SEARCH RESERVATION AND #326 STILL HOLDS THE PAGE. What is left
    // reserved is `page`, and the assertion is unchanged for it: a filter taking that
    // name is what this stops. Both names were inherited rather than coined — `q` from
    // `/materials` and `page` from `/tools/[toolRecordId]` — so the app says one word
    // for one thing across screens that do the same thing.
    for (const [what, name] of Object.entries(RESERVED_PARAMS)) {
        assert(
            `\`${name}\` is reserved for the ${what} and is no axis's parameter`,
            !FILTER_PARAMS.includes(name)
        );
    }
    check("only `page` is still held back", Object.keys(RESERVED_PARAMS).join(","), "page");
    assert("and `q` is a declared parameter now, not a reserved one", FILTER_PARAMS.includes("q"));

    // ── 3: parsing a URL ────────────────────────────────────────────────────
    log("");
    log("a URL is read back against the options the server computed:");
    const prsOptions = {
        job: [
            { id: "recJobA", label: "26-A — Alpha" },
            { id: "recJobB", label: "26-B — Beta" },
        ],
        vendor: [{ id: "recVenA", label: "Alpha Supply" }],
        status: ["In Review", "Approved"],
        kind: PR_KIND_CHOICES,
    };
    const parsed = parseFilters(
        "/prs",
        { job: ["recJobA", "recJobB", "recForged"], vendor: "recVenA", status: "Approved", mine: "1", kind: PR_KIND.overage },
        prsOptions
    );
    check("a repeated picker parameter keeps every allowed value", parsed.job.join(","), "recJobA,recJobB");
    check("  and drops one the options do not hold", parsed.job.includes("recForged"), false);
    check("a single picker value still arrives as a list", parsed.vendor.join(","), "recVenA");
    check("a select takes its value", parsed.status, "Approved");
    check("  and a kind select takes a key rather than a label", parsed.kind, PR_KIND.overage);
    check("a toggle reads the literal 1", parsed.mine, true);

    const refused = parseFilters(
        "/prs",
        { job: "recNope", status: "Withdrawn", mine: "true", kind: "ordinary" },
        prsOptions
    );
    check("an unknown picker id is dropped", refused.job.length, 0);
    check("a status outside the options is dropped", refused.status, "");
    check("anything but `1` leaves a toggle off", refused.mine, false);
    // `ordinary` HAS NO OPTION AND MUST NOT BE REACHABLE BY URL EITHER. The chip is
    // deliberately silent for it, so a filter admitting the key would be the one place
    // a reader met a word the app does not have.
    check("the ordinary kind is not selectable", refused.kind, "");

    // #325 — THE ONE AXIS WITH NO OPTIONS TO INTERSECT AGAINST. Its values are not a
    // set, so nothing is dropped; what is refused is a SHAPE, because one box holds one
    // term and `?q=a&q=b` arrives as an array.
    check(
        "a search term is taken as typed",
        parseFilters("/prs", { q: "HYE-PR-2608" }, prsOptions).q,
        "HYE-PR-2608"
    );
    check(
        "  case and spacing survive the parse, because the box shows them back",
        parseFilters("/prs", { q: "  Acme  2608 " }, prsOptions).q,
        "  Acme  2608 "
    );
    check("a repeated q is refused rather than joined", parseFilters("/prs", { q: ["a", "b"] }, prsOptions).q, "");
    check("and an absent one is the unsearched box", parseFilters("/prs", {}, prsOptions).q, "");

    check(
        "an empty URL is the unfiltered list",
        JSON.stringify(parseFilters("/prs", {}, prsOptions)),
        JSON.stringify(emptyFilters("/prs"))
    );
    assert("  and nothing about it is active", !filtersActive("/prs", parseFilters("/prs", {}, prsOptions)));

    // ── 4: composition ──────────────────────────────────────────────────────
    log("");
    log("axes compose with AND, and a picker's own selection with OR:");
    // Every row carries the four keys `/prs`'s box reads as well as the four its other
    // axes do, so one set of rows serves both halves of the composition.
    const rows = [
        { id: "a", prId: "HYE-PR-260803-01", vendorName: "Acme Supply", jobCode: "26-A", jobName: "Alpha", jobId: "recJobA", vendorId: "recVenA", isMine: true, status: "Approved", kind: PR_KIND.ordinary },
        { id: "b", prId: "HYE-PR-260803-02", vendorName: "Acme Supply", jobCode: "26-B", jobName: "Beta", jobId: "recJobB", vendorId: "recVenA", isMine: false, status: "Approved", kind: PR_KIND.overage },
        { id: "c", prId: "HYE-PR-260804-01", vendorName: "Beta Pipe", jobCode: "26-B", jobName: "Beta", jobId: "recJobB", vendorId: "recVenB", isMine: true, status: "In Review", kind: PR_KIND.ordinary },
        { id: "d", prId: "HYE-PR-260804-02", vendorName: null, jobCode: null, jobName: null, jobId: null, vendorId: null, isMine: false, status: "In Review", kind: PR_KIND.ordinary },
    ];
    const ids = (state) => applyFilters("/prs", state, rows).map((r) => r.id).join("");
    const base = emptyFilters("/prs");
    check("no filter admits every row", ids(base), "abcd");
    check("two jobs selected means either job", ids({ ...base, job: ["recJobA", "recJobB"] }), "abc");
    check("one job narrows to it", ids({ ...base, job: ["recJobA"] }), "a");
    check("a job and a vendor together mean both", ids({ ...base, job: ["recJobB"], vendor: ["recVenA"] }), "b");
    check("a toggle narrows to the true rows", ids({ ...base, mine: true }), "ac");
    check("a select narrows to its value", ids({ ...base, status: "In Review" }), "cd");
    check("three axes at once", ids({ ...base, job: ["recJobB"], mine: true, status: "In Review" }), "c");
    // A ROW WITH NOTHING ON AN AXIS SURVIVES ONLY WHILE THAT AXIS IS UNSELECTED, and
    // there is deliberately no option that reaches it — see `matchesFilters`.
    check("a row with no job is admitted while the job axis is idle", ids({ ...base, mine: false }), "abcd");
    check("  and excluded by any job selection", ids({ ...base, job: ["recJobA", "recJobB"] }).includes("d"), false);
    assert(
        "matchesFilters and applyFilters agree row for row",
        rows.every((r) => matchesFilters("/prs", { ...base, job: ["recJobB"] }, r) === ids({ ...base, job: ["recJobB"] }).includes(r.id))
    );

    // ── 4b: the box, and the AND that crosses fields ────────────────────────
    log("");
    log("the box matches across the row's names, and composes with the controls beside it:");
    check("an idle box narrows nothing", ids({ ...base, q: "" }), "abcd");
    check("  and neither does one holding only spaces", ids({ ...base, q: "   " }), "abcd");
    check("one token against the id", ids({ ...base, q: "260803" }), "ab");
    check("  the same token typed in lower case", ids({ ...base, q: "hye-pr-260803" }), "ab");
    check("one token against the vendor's name", ids({ ...base, q: "acme" }), "ab");
    check("one against the job's code", ids({ ...base, q: "26-A" }), "a");
    check("  and one against the job's name, which no column shows", ids({ ...base, q: "alpha" }), "a");
    check("a substring of a name, not a prefix of it", ids({ ...base, q: "lph" }), "a");
    // THE DECISION #325 HAD TO MAKE, RUN. `acme 2608` is a vendor and a fragment of an
    // id — two tokens that no single field holds together — and it is the most ordinary
    // thing a person reading a document aloud types.
    check("two tokens landing in two different fields", ids({ ...base, q: "acme 2608" }), "ab");
    check("  order does not matter", ids({ ...base, q: "2608 acme" }), "ab");
    check("  and a third token narrows again", ids({ ...base, q: "acme 2608 beta" }), "b");
    check("a token nothing carries admits nothing", ids({ ...base, q: "zzz" }), "");
    // A TYPED NAME AND A CHOSEN ONE ARE TWO NARROWINGS, NOT ONE. Neither control
    // rewrites the other, so saying two different things returns nothing.
    check("the box and a picker compose with AND", ids({ ...base, q: "acme", vendor: ["recVenA"] }), "ab");
    check("  and contradicting them returns nothing", ids({ ...base, q: "acme", vendor: ["recVenB"] }), "");
    check("the box and a select", ids({ ...base, q: "acme", status: "Approved" }), "ab");
    check("  the box and a toggle", ids({ ...base, q: "acme", mine: true }), "a");
    // A row whose vendor and job are missing is still reachable by its own id, which is
    // what filtering the nullish keys out of the haystack buys.
    check("a row with no vendor or job still matches its id", ids({ ...base, q: "260804-02" }), "d");
    assert(
        "  and `null` never reaches the haystack as a word",
        ids({ ...base, q: "null" }) === ""
    );

    // ── 5: the URL a state produces ─────────────────────────────────────────
    log("");
    log("one state, one URL, in the order the list declares its axes:");
    check(
        "the unfiltered state writes nothing",
        filterQuery("/prs", emptyFilters("/prs")),
        ""
    );
    check(
        "the search leads, a picker repeats, and the rest follow in axis order",
        decodeURIComponent(
            filterQuery("/prs", {
                ...base,
                q: "HYE-PR-2608",
                job: ["recJobA", "recJobB"],
                vendor: ["recVenA"],
                mine: true,
                status: "Approved",
                kind: PR_KIND.overage,
            })
        ),
        "q=HYE-PR-2608&job=recJobA&job=recJobB&vendor=recVenA&mine=1&status=Approved&kind=overage"
    );
    // A BOX HOLDING ONLY WHITESPACE WRITES NOTHING, for the reason nothing ever encodes
    // "all": a bare URL and a cleared one have to be one string for one screen, and
    // `?q=%20` would be a third.
    assert("an empty box writes no parameter", !filterQuery("/prs", { ...base, q: "" }).includes("q="));
    assert("  nor does one holding only spaces", !filterQuery("/prs", { ...base, q: "  " }).includes("q="));
    // NOTHING EVER ENCODES "ALL". A parameter whose value means "unfiltered" would put
    // `?status=` in a shared link and make a bare URL and a cleared one different
    // strings for one screen.
    assert(
        "a cleared select writes no parameter",
        !filterQuery("/prs", { ...base, status: "" }).includes("status")
    );
    assert(
        "an off toggle writes no parameter",
        !filterQuery("/prs", { ...base, mine: false }).includes("mine")
    );
    // ROUND TRIP: what a bar writes is what the next load reads.
    const roundTrip = { ...base, q: "acme 2608", job: ["recJobB"], vendor: ["recVenA"], status: "Approved", mine: true };
    const qs = new URLSearchParams(filterQuery("/prs", roundTrip));
    check(
        "a URL the bar wrote parses back to the same state",
        JSON.stringify(
            parseFilters(
                "/prs",
                {
                    q: qs.get("q"),
                    job: qs.getAll("job"),
                    vendor: qs.getAll("vendor"),
                    status: qs.get("status"),
                    mine: qs.get("mine"),
                },
                prsOptions
            )
        ),
        JSON.stringify(roundTrip)
    );
    // THE TERM SURVIVES ITS SPACE, which is the one character a query carries that no
    // other parameter does. `URLSearchParams` writes it as `+` and reads it back as a
    // space, so the round trip above is what says the shared link works.
    assert("  including the space between two tokens", qs.get("q") === "acme 2608");

    // ── 6: the three empty states ───────────────────────────────────────────
    log("");
    log("three empty states, because they are three different facts:");
    check("no record exists at all", emptyStateKind({ totalCount: 0, visibleCount: 0, filtersActive: false }), "none");
    check("some exist but none is visible", emptyStateKind({ totalCount: 12, visibleCount: 0, filtersActive: false }), "hidden");
    check("visible rows the filters excluded", emptyStateKind({ totalCount: 12, visibleCount: 5, filtersActive: true }), "filtered");
    check("rows to render means no empty state", emptyStateKind({ totalCount: 12, visibleCount: 5, filtersActive: false }), null);
    // ORDER IS LOAD-BEARING. A reader who can see nothing must not be told to adjust
    // filters that cannot help them, so `filtered` loses to both others.
    check("nothing visible beats an active filter", emptyStateKind({ totalCount: 12, visibleCount: 0, filtersActive: true }), "hidden");
    check("an empty base beats both", emptyStateKind({ totalCount: 0, visibleCount: 0, filtersActive: true }), "none");

    check(
        "all four lists have all three sentences",
        Object.keys(LIST_EMPTY_COPY).sort().join(" "),
        "/deliveries /invoices /pos /prs"
    );
    for (const [route, copy] of Object.entries(LIST_EMPTY_COPY)) {
        check(`${route} has three`, Object.keys(copy).sort().join(","), "filtered,hidden,none");
        // THE WORD THAT WOULD MAKE IT A LIE. `yet` claims the company has never made
        // one of these, which is false for a reader who simply cannot see any — and
        // `/deliveries` was saying exactly that to a reader whose jobs hold none.
        assert(`  ${route}'s none-exist sentence says 'yet'`, /\byet\b/.test(copy.none));
        assert(`  and its nothing-visible sentence does not`, !/\byet\b/.test(copy.hidden));
        assert(
            `  its nothing-visible sentence explains the gate`,
            /you see|assigned to/i.test(copy.hidden)
        );
        for (const [kind, text] of Object.entries(copy)) {
            assert(`  the ${kind} sentence is a sentence`, /^[A-Z].*\.$/.test(text.trim()));
        }
    }
    // The twelve are twelve, not four repeated three times.
    const sentences = Object.values(LIST_EMPTY_COPY).flatMap((c) => Object.values(c));
    check("no two lists share a sentence", new Set(sentences).size, sentences.length);

    // ── 6b: the narrowing sentence names the search (#325) ──────────────────
    //
    // NO FOURTH KIND. The box is a control in this bar and the value it matches is held
    // by the document, so #324's own rule makes it a filter — `emptyStateKind` is
    // untouched above and still answers its three questions. What is new is that the
    // third sentence says WHICH narrowing emptied the list, because a typed term is the
    // one whose content the reader can get wrong.
    log("");
    log("and the narrowing sentence names the term, and says when filters are on too:");
    // THE FOUR `filtered` SENTENCES ARE BUILT FROM A NOUN NOW AND MUST NOT HAVE MOVED.
    // Written out here as literals, which is the only way to catch a builder that
    // punctuates or pluralizes differently from the strings #324 shipped.
    const FILTERED_SENTENCES = {
        "/prs": "No purchase requests match these filters.",
        "/pos": "No purchase orders match these filters.",
        "/deliveries": "No deliveries match these filters.",
        "/invoices": "No invoices match these filters.",
    };
    for (const [route, want] of Object.entries(FILTERED_SENTENCES)) {
        check(`${route}'s filters-only sentence is unchanged`, LIST_EMPTY_COPY[route].filtered, want);
        const idle = emptyFilters(route);
        check(
            `  and is what an emptied bar with no term says`,
            emptyStateText(route, "filtered", idle),
            want
        );
    }
    const searched = { ...emptyFilters("/invoices"), q: "ABC-1029" };
    check(
        "a term alone is quoted back",
        emptyStateText("/invoices", "filtered", searched),
        "No invoices match “ABC-1029”."
    );
    check(
        "  and a term beside a filter says both",
        emptyStateText("/invoices", "filtered", { ...searched, job: ["recJobA"] }),
        "No invoices match “ABC-1029” and these filters."
    );
    check(
        "  a picker alone is back to the plain sentence",
        emptyStateText("/invoices", "filtered", { ...emptyFilters("/invoices"), job: ["recJobA"] }),
        "No invoices match these filters."
    );
    check(
        "the quoted term is tidied, never echoed raw",
        emptyStateText("/prs", "filtered", { ...emptyFilters("/prs"), q: "  Acme   2608 " }),
        "No purchase requests match “Acme 2608”."
    );
    // THE OTHER TWO KINDS ARE UNTOUCHED BY THE TERM. A reader who can see nothing at all
    // must not be told about a search that cannot help them — which is `emptyStateKind`'s
    // ordering rule reaching the sentence as well as the kind.
    for (const kind of ["none", "hidden"]) {
        check(
            `the ${kind} sentence ignores the box`,
            emptyStateText("/invoices", kind, searched),
            LIST_EMPTY_COPY["/invoices"][kind]
        );
    }
    check("and no kind at all is no sentence", emptyStateText("/invoices", null, searched), null);
    // THE QUOTATION MARKS ARE `/materials`' OWN, which is the app's one other search
    // miss. Two shapes of quote for one kind of sentence is the drift this catches.
    assert(
        "the term is quoted the way the other search box quotes one",
        emptyStateText("/invoices", "filtered", searched).includes("“ABC-1029”")
    );

    // ── 7: the bar's visibility invariant ───────────────────────────────────
    log("");
    log("the bar is drawn from the rows BEFORE any filter, and never from what survived:");
    // WALKED EXHAUSTIVELY RATHER THAN READ. The mutant is one character — `shown`
    // where `rows` belongs — and it takes the bar away exactly when a filter has
    // emptied the list, leaving the reader no `Clear all filters` to press.
    let cases = 0;
    for (const totalCount of [0, 1, 12]) {
        for (const visibleCount of [0, 1, 5]) {
            for (const filtersActiveNow of [false, true]) {
                if (visibleCount > totalCount) continue;
                cases += 1;
                const kind = emptyStateKind({ totalCount, visibleCount, filtersActive: filtersActiveNow });
                if (kind !== "filtered") continue;
                assert(
                    `  a filtered empty state at ${totalCount}/${visibleCount} still draws the bar`,
                    showsFilterBar({ visibleCount }) === true
                );
            }
        }
    }
    assert("the walk covered the whole grid", cases >= 12);
    check("no rows in scope means no bar", showsFilterBar({ visibleCount: 0 }), false);
    check("one row in scope means a bar", showsFilterBar({ visibleCount: 1 }), true);
    // AND IT TAKES NOTHING ELSE. A `showsFilterBar` that also read the filtered count
    // would pass every assertion above and still be the defect.
    assert(
        "it is a function of the in-scope count alone",
        showsFilterBar({ visibleCount: 3, shownCount: 0, filtersActive: true }) ===
            showsFilterBar({ visibleCount: 3 })
    );

    // ── 8: the words ────────────────────────────────────────────────────────
    log("");
    log("every word the bar says comes from the module, and nothing else says them:");
    for (const [route, label] of Object.entries(MINE_LABELS)) {
        const axis = axesFor(route).find((a) => a.param === "mine");
        check(`${route}'s toggle reads \`${label}\``, axis.label, label);
    }
    // TWO WORDS FOR TWO FIELDS, OVER FOUR LISTS — and which word a list says is read
    // off the field it narrows by, never off the screen. `/prs` and `/pos` read
    // `Purchase Requests."Requester"`, on the row and through the parent order, so
    // they must not be two words. `/deliveries` and `/invoices` read a `Recorded By`,
    // which is a different field and therefore a different word; the participle
    // follows the field name, per `docs/notes/naming.md`. #382 made the second pair a
    // pair — that list said nothing at all until it had a field to say it about.
    check("the two request-side lists say the same thing", MINE_LABELS["/prs"], MINE_LABELS["/pos"]);
    check(
        "and so do the two recorder-side lists",
        MINE_LABELS["/deliveries"],
        MINE_LABELS["/invoices"]
    );
    assert(
        "and the two pairs are not one word",
        MINE_LABELS["/deliveries"] !== MINE_LABELS["/prs"]
    );
    // `Raised by me` IS FALSE OF AN ORDER ROW and is barred by name. Nobody raises a
    // purchase order — it is generated when a request is fully approved, and #138
    // records that a PO carries no requester of its own.
    for (const label of Object.values(MINE_LABELS)) {
        assert(`\`${label}\` does not claim the row was raised`, !/raised/i.test(label));
    }

    check("the status axis is called Status wherever it appears",
        FILTERED_LISTS.filter((r) => axesFor(r).some((a) => a.param === "status"))
            .map((r) => axesFor(r).find((a) => a.param === "status").label)
            .join("|"),
        "Status|Status|Status"
    );

    // The pickers' words are BUILT from their noun, so a third picker coins none by
    // hand and the two that exist cannot drift into saying one thing two ways.
    const job = axesFor("/prs").find((a) => a.param === "job");
    const vendor = axesFor("/prs").find((a) => a.param === "vendor");
    check("the job picker's summary", job.words.all, "All jobs");
    check("the vendor picker's summary", vendor.words.all, "All vendors");
    check("both count their selection the same way", job.words.selected(2), vendor.words.selected(2));
    for (const [noun, words] of [["job", job.words], ["vendor", vendor.words]]) {
        assert(`the ${noun} picker names its noun in all four of its strings`,
            [words.all, words.search, words.clear, words.empty].every((s) => s.includes(noun))
        );
    }

    // The two select vocabularies that are not their own labels.
    check(
        "the kind select offers the two marks and not a third",
        PR_KIND_CHOICES.map((c) => `${choiceValue(c)}=${choiceLabel(c)}`).join(" "),
        `${PR_KIND.overage}=Overage ${PR_KIND.directPurchase}=Direct purchase`
    );
    assert(
        "  and each label is the mark the list already renders",
        PR_KIND_CHOICES.every((c) => choiceLabel(c) === PR_KIND_COPY.chip[choiceValue(c)])
    );
    assert("  ordinary has no option, because it has no word", PR_KIND_COPY.chip[PR_KIND.ordinary] === null);
    check(
        "the invoice list's status select offers the two payment words",
        `${INVOICE_PAYMENT_WORDS.paid}/${INVOICE_PAYMENT_WORDS.notPaid}`,
        "Paid/Not paid"
    );

    // A string only a filter bar says, appearing anywhere else, is the mutant this
    // whole issue is about: a bar assembled screen by screen.
    // #325 — the four boxes' one string each. Built from the names each list searches,
    // and pinned by value in SEARCH_LABELS above; here they join the vocabulary no file
    // outside `lib/listFilters.js` may hold.
    const searchLabels = FILTERED_LISTS.map(
        (route) => axesFor(route).find((a) => a.control === CONTROL.search).words.label
    );
    const BAR_ONLY = [
        ...searchLabels,
        job.words.all,
        job.words.search,
        job.words.clear,
        job.words.empty,
        vendor.words.all,
        vendor.words.search,
        vendor.words.clear,
        vendor.words.empty,
        FILTER_BAR_COPY.clearAll,
        ...sentences,
    ];
    const strays = [];
    for (const rel of scannedFiles()) {
        if (OWNERS.has(rel)) continue;
        // Joined on a newline, which none of the searched strings contains, so no
        // match can straddle two of them.
        const text = allText(parseFile(rel).ast).join("\n");
        for (const word of BAR_ONLY) if (text.includes(word)) strays.push(`${rel}: ${word}`);
    }
    check(
        `no bar string is written outside lib/listFilters.js${strays.length ? ` (${strays.join("; ")})` : ""}`,
        strays.length,
        0
    );

    // THE TWO SHARED COMPONENTS HOLD NO COPY AT ALL. Everything they draw arrives as a
    // prop, so a label typed into their JSX is the exact shape this check exists for —
    // and it is the shape no other check in this repository can see.
    const labels = FILTERED_LISTS.flatMap((r) => axesFor(r).map((a) => a.label).filter(Boolean));
    const inShared = [];
    for (const rel of SHARED) {
        const text = allText(parseFile(rel).ast).join("\n");
        for (const word of [...labels, ...BAR_ONLY, FILTER_BAR_COPY.allOption])
            if (text.includes(word)) inShared.push(`${rel}: ${word}`);
    }
    check(
        `neither shared component holds a label or a sentence${inShared.length ? ` (${inShared.join("; ")})` : ""}`,
        inShared.length,
        0
    );

    // ── 9: the four clients agree ───────────────────────────────────────────
    log("");
    log("each list renders the shared bar and holds no mechanism of its own:");
    for (const rel of CLIENTS) {
        const source = readFileSync(repoPath(rel), "utf8");
        // `emptyStateText` REPLACED `LIST_EMPTY_COPY` HERE IN #325. The clients read a
        // constant straight off the map until the third sentence had to name a term, and
        // a branch written into four JSX files is four places for one rule — so the
        // module composes the sentence and each client asks for it.
        for (const needed of ["ListFilterBar", "useListFilters", "applyFilters", "emptyStateKind", "showsFilterBar", "emptyStateText"])
            assert(`${rel} uses ${needed}`, source.includes(needed));
        // AND NONE OF THEM REACHES PAST IT TO THE RAW COPY, which would be a client
        // rendering the plain sentence where the composed one belongs.
        assert(`  and does not read LIST_EMPTY_COPY directly`, !source.includes("LIST_EMPTY_COPY"));
        // FOUR COPIES OF ONE URL SYNC IS WHAT THIS REPLACED. The hook owns both, so a
        // client holding either is a copy growing back.
        for (const banned of ["URLSearchParams", "router.replace", "useSearchParams"])
            assert(`  and holds no ${banned}`, !source.includes(banned));
    }
    for (const rel of PAGES) {
        const source = readFileSync(repoPath(rel), "utf8");
        assert(`${rel} parses the URL against its own options`, source.includes("parseFilters"));
        assert(`  and builds its pickers from the visible rows`, source.includes("pickerOptions"));
    }

    // ── 9b: the page shapes the key every axis it declares reads (#382) ──────
    //
    // DECLARING AN AXIS IS HALF THE WORK AND THE OTHER HALF IS IN ANOTHER FILE, with
    // nothing until now pairing them. `matchesFilters` reads `row[ROW_KEY[param]]`, and
    // a row that carries no such key is `undefined` — which passes every picker and
    // select while they are idle and fails every one of them the moment a reader picks
    // something. So a list declaring `mine` whose page never sets `isMine` draws a live
    // control that narrows to nothing, and section 1 above still passes: the
    // declaration is right and the rows are wrong.
    //
    // THE SAME MUTANT `offline/job-column.mjs` NAMES ONE AXIS OVER — "remove the
    // render, leave the read, and the screen is right, the budget is unchanged and
    // nothing anywhere fails". It was reachable here because #382 added an axis to a
    // list, which is the one edit that can produce it.
    //
    // IT READS THE PAGES' OWN OBJECT LITERALS rather than a list of key names, so
    // nothing here has to be updated when a key is renamed — `ROW_KEY` is imported
    // from the module that decides it, and both sides move together.
    log("");
    log("and each page shapes the row key every axis it declares will read:");
    for (const rel of PAGES) {
        const route = `/${rel.split("/")[1]}`;
        const keys = new Set();
        walk(parseFile(rel).ast, (n) => {
            if (n.type !== "Property" || n.computed) return;
            const name = n.key?.name ?? n.key?.value;
            if (typeof name === "string") keys.add(name);
        });
        for (const axis of axesFor(route)) {
            // #325 — A SEARCH NAMES ITS OWN KEYS AND THERE ARE SEVERAL. `ROW_KEY` is one
            // key per parameter whatever the route, and a search reads a different set
            // per list, so that axis carries `keys` and this reads them. The pairing is
            // the same one and is stronger for being plural: a page shaping four of the
            // five keys `/invoices` searches fails here, and the box would otherwise
            // have gone on promising `Vendor Invoice #` and matching nothing.
            const wanted = axis.control === CONTROL.search ? axis.keys : [ROW_KEY[axis.param]];
            for (const key of wanted) {
                assert(`${rel} sets \`${key}\` for its \`${axis.param}\` axis`, keys.has(key));
            }
        }
    }
    // ANTI-VACUITY: the property walk has to be seen saying no. `/invoices` declares no
    // `over` axis and its page shapes no `hasOverDelivery`, so the key ROW_KEY holds for
    // an axis that list does not carry is the one this detector must not find.
    const invoiceKeys = new Set();
    walk(parseFile("app/invoices/page.js").ast, (n) => {
        if (n.type !== "Property" || n.computed) return;
        const name = n.key?.name ?? n.key?.value;
        if (typeof name === "string") invoiceKeys.add(name);
    });
    assert("the property walk found the invoice list's own keys", invoiceKeys.has(ROW_KEY.mine));
    assert("  and says no to a key that list has no axis for", !invoiceKeys.has(ROW_KEY.over));

    // ── 10: the detectors are seen working ──────────────────────────────────
    log("");
    log("anti-vacuity — every detector above is seen to be able to fail:");
    // The bar-visibility mutant, run rather than described.
    const brokenBar = ({ shownCount }) => shownCount > 0;
    assert(
        "a bar keyed off the filtered rows is caught",
        brokenBar({ shownCount: 0 }) === false &&
            emptyStateKind({ totalCount: 9, visibleCount: 4, filtersActive: true }) === "filtered"
    );
    // The stray-word detector, against a planted literal.
    assert(
        "the stray-word scan sees a planted label",
        allText(parseFile("lib/listFilters.js").ast).join("\n").includes(FILTER_BAR_COPY.clearAll)
    );
    // The composition, against a predicate that ORs its axes instead of ANDing them.
    const orAxes = (state, row) =>
        axesFor("/prs").some((a) => {
            const v = state[a.param];
            if (a.control === CONTROL.picker) return v.length && v.includes(row[a.param === "job" ? "jobId" : "vendorId"]);
            return false;
        });
    assert(
        "an OR over axes admits a row AND rejects",
        orAxes({ ...base, job: ["recJobA"], vendor: ["recVenB"] }, rows[0]) === true &&
            matchesFilters("/prs", { ...base, job: ["recJobA"], vendor: ["recVenB"] }, rows[0]) === false
    );
    // The option builders, which are what keep a picker from offering a row nobody has.
    check(
        "pickerOptions takes its ids from the rows and sorts by label",
        pickerOptions(rows, "jobId", (r) => (r.jobId === "recJobA" ? "26-A" : "26-B"))
            .map((o) => `${o.id}:${o.label}`)
            .join(" "),
        "recJobA:26-A recJobB:26-B"
    );
    check("  and drops a row with no id", pickerOptions(rows, "jobId", () => "x").length, 2);
    check("  and one whose label comes back empty", pickerOptions(rows, "jobId", () => null).length, 0);
    check("a job with no name is its code alone", jobOptionLabel("26-A", ""), "26-A");
    check("  and with one, both", jobOptionLabel("26-A", "Alpha"), "26-A — Alpha");
    check("  and no code is no option", jobOptionLabel("", "Alpha"), null);

    // #325's COMPOSITION DECISION, BUILT AS ITS ALTERNATIVE AND RUN. Per-field AND —
    // every token inside ONE of the row's names — is the rule this issue weighed and
    // rejected, and on the query it was rejected for it answers differently. Written out
    // here rather than described, because "we chose the other one" is not a check.
    const perField = (query, row) => {
        const axis = axesFor("/prs").find((a) => a.control === CONTROL.search);
        const tokens = searchTokens(query);
        return axis.keys.some((key) => matchesTokens(row?.[key], tokens));
    };
    assert(
        "a per-field AND loses `acme 2608` where the shipped rule finds it",
        perField("acme 2608", rows[0]) === false &&
            matchesFilters("/prs", { ...base, q: "acme 2608" }, rows[0]) === true
    );
    assert(
        "  and the two agree when one name holds every token",
        perField("acme supply", rows[0]) === true &&
            matchesFilters("/prs", { ...base, q: "acme supply" }, rows[0]) === true
    );
    // The joined haystack cannot be matched ACROSS its boundary, which is what makes a
    // plain space enough of a separator: a token never contains one.
    assert(
        "no token straddles two joined names",
        matchesFilters("/prs", { ...base, q: "01acme" }, rows[0]) === false
    );

    // The plural key walk of 9b, seen saying no. `/prs` searches four keys and not the
    // fifth `/invoices` does, so a page shaping only some of them is the mutant.
    const prsSearch = axesFor("/prs").find((a) => a.control === CONTROL.search);
    assert(
        "the search key walk is plural and list-specific",
        prsSearch.keys.length === 4 && !prsSearch.keys.includes("vendorInvoiceCode")
    );
    // The label builder, seen producing a different sentence from different names, so
    // the four pinned strings above are a fact about the declaration rather than about
    // a builder that ignores its argument.
    assert(
        "the box's sentence is built from the names it is given",
        SEARCH_LABELS["/invoices"] !== SEARCH_LABELS["/prs"] &&
            SEARCH_LABELS["/invoices"].includes("Vendor Invoice #") &&
            !SEARCH_LABELS["/prs"].includes("Vendor Invoice #")
    );
}

if (isMain(import.meta.url)) standalone(title, run);

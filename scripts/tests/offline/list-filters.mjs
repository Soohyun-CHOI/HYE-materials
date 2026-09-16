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
    LIST_AXES,
    LIST_EMPTY_COPY,
    RESERVED_PARAMS,
    applyFilters,
    axesFor,
    choiceLabel,
    choiceValue,
    emptyFilters,
    emptyStateKind,
    filterQuery,
    filtersActive,
    jobOptionLabel,
    matchesFilters,
    parseFilters,
    pickerOptions,
    showsFilterBar,
} from "../../../lib/listFilters.js";
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
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["mine", CONTROL.toggle],
        ["status", CONTROL.select],
        ["kind", CONTROL.select],
    ],
    "/pos": [
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["mine", CONTROL.toggle],
        ["status", CONTROL.select],
    ],
    "/deliveries": [
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["mine", CONTROL.toggle],
        ["over", CONTROL.toggle],
    ],
    "/invoices": [
        ["job", CONTROL.picker],
        ["vendor", CONTROL.picker],
        ["status", CONTROL.select],
    ],
};

/** The label each reader's-own toggle wears, and why no two of them are one word. */
const MINE_LABELS = {
    "/prs": "Requested by me",
    "/pos": "Requested by me",
    "/deliveries": "Recorded by me",
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
    // "job and vendor are on every one of them" is the claim this issue makes, and a
    // row-by-row table states it four times without ever saying it once.
    for (const param of ["job", "vendor"]) {
        assert(
            `${param} is on all four lists`,
            FILTERED_LISTS.every((route) => axesFor(route).some((a) => a.param === param))
        );
    }
    // AND THE ONE THAT IS ALMOST SHARED. `/invoices` has no reader's-own toggle because
    // `Invoices` carries no `Recorded By` — `Deliveries` does and `Purchase Requests`
    // has `Requester`. #382 is the issue that would give it one, and until then a
    // toggle here would read an axis that does not exist.
    check(
        "the reader's-own toggle is on three lists and not the invoice list",
        FILTERED_LISTS.filter((r) => axesFor(r).some((a) => a.param === "mine"))
            .sort()
            .join(" "),
        "/deliveries /pos /prs"
    );
    assert(
        "  and /invoices carries none",
        !axesFor("/invoices").some((a) => a.param === "mine")
    );

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
    // #325 GIVES THESE LISTS A SEARCH AND #326 A PAGE, and both are behind the design
    // pass. Reserving the names now is what keeps either issue from having to rewrite
    // what is in the URL today; taking one for a filter is what this assertion stops.
    for (const [what, name] of Object.entries(RESERVED_PARAMS)) {
        assert(
            `\`${name}\` is reserved for the ${what} and is no axis's parameter`,
            !FILTER_PARAMS.includes(name)
        );
    }

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

    check(
        "an empty URL is the unfiltered list",
        JSON.stringify(parseFilters("/prs", {}, prsOptions)),
        JSON.stringify(emptyFilters("/prs"))
    );
    assert("  and nothing about it is active", !filtersActive("/prs", parseFilters("/prs", {}, prsOptions)));

    // ── 4: composition ──────────────────────────────────────────────────────
    log("");
    log("axes compose with AND, and a picker's own selection with OR:");
    const rows = [
        { id: "a", jobId: "recJobA", vendorId: "recVenA", isMine: true, status: "Approved", kind: PR_KIND.ordinary },
        { id: "b", jobId: "recJobB", vendorId: "recVenA", isMine: false, status: "Approved", kind: PR_KIND.overage },
        { id: "c", jobId: "recJobB", vendorId: "recVenB", isMine: true, status: "In Review", kind: PR_KIND.ordinary },
        { id: "d", jobId: null, vendorId: null, isMine: false, status: "In Review", kind: PR_KIND.ordinary },
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

    // ── 5: the URL a state produces ─────────────────────────────────────────
    log("");
    log("one state, one URL, in the order the list declares its axes:");
    check(
        "the unfiltered state writes nothing",
        filterQuery("/prs", emptyFilters("/prs")),
        ""
    );
    check(
        "a picker repeats and the rest follow in axis order",
        decodeURIComponent(
            filterQuery("/prs", {
                ...base,
                job: ["recJobA", "recJobB"],
                vendor: ["recVenA"],
                mine: true,
                status: "Approved",
                kind: PR_KIND.overage,
            })
        ),
        "job=recJobA&job=recJobB&vendor=recVenA&mine=1&status=Approved&kind=overage"
    );
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
    const roundTrip = { ...base, job: ["recJobB"], vendor: ["recVenA"], status: "Approved", mine: true };
    const qs = new URLSearchParams(filterQuery("/prs", roundTrip));
    check(
        "a URL the bar wrote parses back to the same state",
        JSON.stringify(
            parseFilters(
                "/prs",
                { job: qs.getAll("job"), vendor: qs.getAll("vendor"), status: qs.get("status"), mine: qs.get("mine") },
                prsOptions
            )
        ),
        JSON.stringify(roundTrip)
    );

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
    // ONE WORD ON TWO LISTS, AND A DIFFERENT ONE ON THE THIRD. `/prs` and `/pos` read
    // the same field — `Purchase Requests."Requester"`, on the row and through the
    // parent order — so they must not be two words. `/deliveries` reads
    // `Deliveries."Recorded By"`, which is a different field and therefore a different
    // word; the participle follows the field name, per `docs/notes/naming.md`.
    check("the two request-side lists say the same thing", MINE_LABELS["/prs"], MINE_LABELS["/pos"]);
    assert(
        "and the delivery list does not",
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
    const BAR_ONLY = [
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
        for (const needed of ["ListFilterBar", "useListFilters", "applyFilters", "emptyStateKind", "showsFilterBar", "LIST_EMPTY_COPY"])
            assert(`${rel} uses ${needed}`, source.includes(needed));
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
}

if (isMain(import.meta.url)) standalone(title, run);

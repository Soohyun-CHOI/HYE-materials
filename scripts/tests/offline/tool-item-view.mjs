// What one tool item's page shows (#340).
//
// WHAT THIS FILE IS FOR. `logRowFacts` states which of a `Tool Log` row's facts
// reach the screen, and every one of them is an invariant of the base rather
// than a choice: `Event` is a closed select, `Event At` is stamped by the
// writer, `Job` is on every row and never blank — the invariant that makes the
// previous row's job the previous job, and the reason no `Former Job` is stored
// — and `Recorded By` is written on every path that appends. A change that
// dropped one would read as a styling decision and would in fact be undoing one
// of those; nothing else in this tier would notice, because the tier cannot
// render a page.
//
// IT WAS FIVE FACTS UNTIL #363. `Notes` was the optional one, and that field is
// deleted from the base along with the rule it was carried for — the reason a
// `Retired` event was to require, which that issue weighed and dropped. Section
// 2 asserts the opposite claim now: four is the whole list and a value handed
// in beside them does not reach the screen.
//
// WHAT IT CANNOT SEE. Whether any of it reaches a browser, which is this tier's
// standing limit, and whether the page reads the caches rather than deriving
// them — that is a fact about the page's imports, not about this module.
//
// AND WHAT IS NOT HERE BY DESIGN: no assertion about `Tool Items."Status"`
// disagreeing with the log. Nothing in the app can produce that state — the only
// writer of the caches is the code that writes the row, and breaking them means
// editing Airtable by hand, which this base forbids — so there is no function to
// pin and no screen sentence to hold.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { TOOL_EVENT } from "../../../lib/toolStatus.js";
import { FACT_KIND, TOOL_ITEM_COPY, logRowFacts } from "../../../lib/toolItemView.js";
import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

/** The screen this file is about, read off the AST for section 5. */
const PAGE = "app/(tools)/tool-items/[toolItemId]/page.js";

export const title = "What one tool item's page shows (#340)";

/** A row with every fact filled, which is what registration actually writes. */
const FULL_ROW = {
    event: TOOL_EVENT.REGISTERED,
    eventAt: "2026-09-09T15:14:26.537Z",
    recordedByName: "scoped-fixture",
    jobCode: "26-DEMO-01",
};

const keysOf = (row) => logRowFacts(row).map((fact) => fact.key);

/** Every string the copy constant holds. */
const copyStrings = () => Object.values(TOOL_ITEM_COPY).filter((v) => typeof v === "string");

/**
 * Every `item`/`items` in a string that is not part of `tool item`.
 *
 * The tools track's own rule: one physical tool is a `tool item` and never a bare
 * `item`, because four other tables on this base hold item rows.
 * `offline/item-row-nouns.mjs` holds the app-wide version over screen strings;
 * this holds it inside the one constant every string on this screen comes from.
 */
function bareItemWords(text) {
    return [...String(text).matchAll(/\b(items?)\b/gi)].filter(
        (m) => !/tool\s$/i.test(String(text).slice(0, m.index))
    );
}

export function run({ check, assert, log }) {
    // ── 1: the order, which is the reading order of a row ───────────────────
    log("a log row's facts, in the order the screen renders them:");
    check(
        "a row carries four, event first",
        keysOf(FULL_ROW).join(","),
        "event,eventAt,job,recordedBy"
    );
    check(
        "the labels come from the copy constant",
        logRowFacts(FULL_ROW).map((f) => f.label).join(" / "),
        "Event / When / Job / Recorded by"
    );
    // The three that pass through untouched. The moment does not, so it is asserted
    // on its own below — its rendering depends on the runtime's locale and zone, and
    // a string pinned here would pass on this machine and fail in CI.
    check(
        "and the values are the ones handed in",
        logRowFacts(FULL_ROW).filter((f) => f.key !== "eventAt").map((f) => f.value).join(" / "),
        "Registered / 26-DEMO-01 / scoped-fixture"
    );

    // ── 2: nothing drops, and no fifth arrives ─────────────────────────────
    // THERE WAS A FIFTH UNTIL #363 AND IT WENT WITH ITS FIELD. `Notes` was
    // optional, absent on a `Registered` row, and omitted rather than drawn
    // empty; `Tool Log."Notes"` is deleted from the base, so the pair, the
    // drops-when-blank rule and the assertions holding it went together. What
    // replaces them is the opposite claim: a row this function is handed extra
    // keys still renders four, so a value quietly reintroduced would not reach
    // the screen without somebody editing this module.
    log("");
    log("four is the whole list, and nothing a caller adds joins it:");
    check("an extra key is not rendered", keysOf({ ...FULL_ROW, notes: "why it went" }).join(","), "event,eventAt,job,recordedBy");
    check("  nor several", keysOf({ ...FULL_ROW, notes: "x", reason: "y" }).length, 4);
    check("no label says `Notes`", logRowFacts({ ...FULL_ROW, notes: "x" }).filter((f) => f.label === "Notes").length, 0);
    assert("and the copy constant carries no notes label", !("notesLabel" in TOOL_ITEM_COPY));

    // ── 2b: the fifth, which belongs to one event (#376) ───────────────────
    //
    // NOT `Notes` COMING BACK, AND THE DIFFERENCE IS WHAT MAKES THIS CHECKABLE AT
    // ALL. That field was optional on every event and no row ever filled it, so
    // there was no rule to assert — only the absence above. `Checked Out To` is a
    // function of the event: present on exactly one of the four and absent on the
    // other three, held in both directions by `createToolLogEntry`. So this asks
    // over the WHOLE vocabulary rather than about the one row it was added for,
    // and a fifth event cannot arrive without this failing until somebody decides
    // which side it is on.
    log("");
    log("and a fifth on a check-out, on no other event:");
    const withName = (event) => keysOf({ ...FULL_ROW, event, checkedOutTo: "Dana K" });
    check(
        "a check-out carries it last",
        withName(TOOL_EVENT.CHECKED_OUT).join(","),
        "event,eventAt,job,recordedBy,checkedOutTo"
    );
    check(
        "  labeled with the words the control that wrote it says",
        logRowFacts({ ...FULL_ROW, event: TOOL_EVENT.CHECKED_OUT, checkedOutTo: "Dana K" }).at(-1).label,
        TOOL_ITEM_COPY.checkedOutToLabel
    );
    check(
        "  and holding the name",
        logRowFacts({ ...FULL_ROW, event: TOOL_EVENT.CHECKED_OUT, checkedOutTo: "Dana K" }).at(-1).value,
        "Dana K"
    );
    const others = Object.values(TOOL_EVENT).filter((e) => e !== TOOL_EVENT.CHECKED_OUT);
    assert(`  and the other ${others.length} events do not, even handed one`, others.length === 3);
    for (const event of others)
        check(`  ${event} carries four`, withName(event).join(","), "event,eventAt,job,recordedBy");
    // THE EVENT DECIDES, NOT THE VALUE. A check-out with no name renders the pair
    // empty rather than dropping it — the same treatment the four above get, and
    // the reason is theirs: a missing one is a defect upstream and hiding it would
    // take the defect with it.
    check(
        "a check-out with no name still carries the pair",
        keysOf({ ...FULL_ROW, event: TOOL_EVENT.CHECKED_OUT }).join(","),
        "event,eventAt,job,recordedBy,checkedOutTo"
    );
    // ANTI-VACUITY FOR THE LOOP ABOVE: the vocabulary really is what it is read
    // from, so a check that iterated an empty list would fail here rather than
    // reporting three silent passes.
    assert(
        "the vocabulary this is asked over is the real one",
        Object.values(TOOL_EVENT).length === 4 && Object.values(TOOL_EVENT).includes(TOOL_EVENT.CHECKED_OUT)
    );

    // ── 3: all four are on every row ───────────────────────────────────────
    log("");
    log("all four are on every row, whatever they hold:");
    // Each of the four is an invariant of the base rather than a value this
    // module may judge — a blank one is a defect upstream, and hiding it would
    // hide the defect. `Job` is the sharpest: the absence of blanks is what makes
    // the previous row's job readable as the previous job.
    for (const key of ["event", "eventAt", "job", "recordedBy"]) {
        const blanked = { ...FULL_ROW, [key === "job" ? "jobCode" : key === "recordedBy" ? "recordedByName" : key]: "" };
        assert(`  a blank ${key} still renders its pair`, keysOf(blanked).includes(key));
        const missing = { ...FULL_ROW };
        delete missing[key === "job" ? "jobCode" : key === "recordedBy" ? "recordedByName" : key];
        assert(`  and a missing ${key} does too`, keysOf(missing).includes(key));
    }
    check("an empty row still carries the four", keysOf({}).join(","), "event,eventAt,job,recordedBy");

    // ── 4: the copy ────────────────────────────────────────────────────────
    log("");
    log("every word the screen can say:");
    const strings = copyStrings();
    assert(`the constant holds ${strings.length} strings`, strings.length >= 10);
    check("none is empty", strings.filter((s) => !s.trim()).length, 0);
    const bare = strings.filter((s) => bareItemWords(s).length > 0);
    check(
        `no bare \`item\` where the noun is a tool item${bare.length ? ` (${JSON.stringify(bare[0])})` : ""}`,
        bare.length,
        0
    );
    // The two sentences this screen owns that no other screen has. The first is
    // #338's reachable state — a tool item written whose first log row was not —
    // and it says what is missing rather than that something failed.
    assert(
        "the empty-history sentence names what is lost",
        TOOL_ITEM_COPY.noHistory.includes("came into existence")
    );
    assert(
        "the not-found heading names a tool item",
        TOOL_ITEM_COPY.notFoundHeading.includes("Tool item")
    );
    assert("the way back names the screen it opens", TOOL_ITEM_COPY.backToTools.includes("Tools"));
    // `kind` is the notes' explanatory word for what separates `Tools` from
    // `Tool Items` and names no row, so it may not reach a screen (#338).
    check("no string says `kind`", strings.filter((s) => /\bkinds?\b/i.test(s)).length, 0);

    // ── 4b: the moment, a date and a time and nothing finer ────────────────
    log("");
    log("a log entry's moment is handed over as stored, for a browser to resolve (#374):");
    // THE PAIR CARRIES THE RAW INSTANT NOW, AND THE `kind` IS WHAT SAYS SO. This
    // module formatted it until #374, which is what made the page state a moment
    // in the SERVER's zone — see `offline/instant-rendering.mjs` for where the
    // options went and what holds them. What stays here is this module's own
    // claim: the four facts, their order, and that exactly one of them is a
    // moment rather than a string the page prints.
    const ISO = "2026-09-09T15:14:26.537Z";
    const moment = logRowFacts({ event: "Checked Out", eventAt: ISO, recordedByName: "chkim", jobCode: "26-DEMO-01" })
        .find((fact) => fact.key === "eventAt");
    check("the moment is handed over unformatted", moment.value, ISO);
    check("  and is marked as one", moment.kind, FACT_KIND.instant);
    // Anti-vacuity: `kind` has to tell the four APART, or marking one says nothing.
    check(
        "  the other three carry no kind",
        logRowFacts({ event: "e", eventAt: ISO, recordedByName: "r", jobCode: "j" })
            .filter((fact) => fact.kind !== undefined).length,
        1
    );

    // ── 5: the symbol, and the two things this page must NOT do (#352) ─────
    log("");
    log("the symbol is built here and printed elsewhere:");
    const page = parseFile(PAGE);
    const imports = [];
    walk(page.ast, (n) => {
        if (n.type === "ImportDeclaration") imports.push(n.source.value);
    });
    const names = [];
    walk(page.ast, (n) => {
        if (n.type === "Identifier") names.push(n.name);
    });
    // CALLED, NOT MERELY NAMED. An identifier list is satisfied by the import line
    // on its own — measured: deleting the reprint link's call left
    // `toolItemLabelsPath` in `names` and the assertion passed. So anything this
    // page must DO is asserted as a call site.
    const called = new Set();
    walk(page.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "Identifier") called.add(n.callee.name);
    });

    // BUILT, NOT FETCHED. #351's endpoint spent two operations — the session and
    // this record — and the page has both in hand before the symbol exists, so the
    // import is the whole decision. A regression to an image would be silent: the
    // symbol looks identical and the page just costs two more operations.
    assert("the page imports the builder", imports.some((from) => from.endsWith("toolLabelQR")));
    assert("  and calls it", called.has("buildToolItemQR"));
    check(
        "  naming no fetched address, since that route is gone",
        names.filter((name) => name === "toolItemQRPath" || name === "QR_ROUTE").length,
        0
    );

    // SIZED BY THIS SYMBOL'S OWN SIDE COUNT, which is #353's measured defect one
    // screen over: the module size is derived once for the stock, and passing the
    // constant to the BOX scales a larger version into today's box and thins its
    // modules.
    //
    // THE ARGUMENT IS READ, NOT THE NAME. Asserting that `symbolBox`, `labelBudget`
    // and `QR_SIDE_MODULES` all APPEAR would pass with the two arguments swapped,
    // which is the defect — a check that names what it is looking for and then
    // cannot tell the two apart is the trap #351 and #353 each fell into once. So
    // the `sideModules` each call receives is read off the call site.
    const sideModulesArgOf = (fn) => {
        let found = null;
        walk(page.ast, (n) => {
            if (n.type !== "CallExpression" || n.callee?.name !== fn) return;
            const arg = n.arguments?.[0];
            if (arg?.type !== "ObjectExpression") return;
            const prop = arg.properties.find((p) => p.key?.name === "sideModules");
            if (!prop) return;
            found =
                prop.value.type === "Identifier"
                    ? prop.value.name
                    : prop.value.type === "MemberExpression"
                      ? `${prop.value.object?.name}.${prop.value.property?.name}`
                      : prop.value.type;
        });
        return found;
    };
    check("the module size is derived from the constant", sideModulesArgOf("labelBudget"), "QR_SIDE_MODULES");
    check("  and the box from this symbol's own count", sideModulesArgOf("symbolBox"), "symbol.sideModules");
    // ANTI-VACUITY: the reader is shown telling the two apart on a planted swap, so
    // the two checks above are a fact about the call sites rather than about a
    // reader that returns the same thing whatever it is given.
    {
        const planted = parseSource(
            "const a = labelBudget({ sideModules: symbol.sideModules });\n" +
                "const b = symbolBox({ sideModules: QR_SIDE_MODULES, moduleMm });\n",
            "<planted-swap>"
        );
        const read = (fn) => {
            let got = null;
            walk(planted.ast, (n) => {
                if (n.type !== "CallExpression" || n.callee?.name !== fn) return;
                const prop = n.arguments[0].properties.find((p) => p.key?.name === "sideModules");
                got = prop.value.type === "Identifier" ? prop.value.name : `${prop.value.object?.name}.${prop.value.property?.name}`;
            });
            return got;
        };
        check("  a swapped pair reads as swapped", `${read("labelBudget")}|${read("symbolBox")}`, "symbol.sideModules|QR_SIDE_MODULES");
    }

    // PRINTS NOTHING ITSELF, which is what keeps "the same physical object as the
    // original" true by construction rather than by comparison: the reprint is the
    // sheet screen, so there is no second layout to drift. A print path here would
    // also be a reprint without a start position, and a reprint is the archetypal
    // part-used sheet.
    assert("it links to the sheet screen", called.has("toolItemLabelsPath"));
    check(
        "  and implements no print path of its own",
        [
            imports.some((from) => from.endsWith(".css")) ? "a stylesheet" : "",
            names.includes("print") ? "a print call" : "",
            page.source.includes("@page") ? "a page box" : "",
            page.source.includes("window.print") ? "window.print" : "",
        ].filter(Boolean).join(", "),
        ""
    );

    // The words, and the one that is a VISIBLE ATTRIBUTE so it may not be a literal
    // in the JSX — `offline/tool-list-view.mjs` fails an `alt` on this axis, and it
    // doubles as what a reader sees when a symbol cannot load.
    assert("the section names the label", TOOL_ITEM_COPY.labelHeading === "Label");
    assert("the alt names the thing rather than the picture", TOOL_ITEM_COPY.symbolAlt.includes("tool item"));
    assert("and the printed-size note says so", TOOL_ITEM_COPY.printedSizeNote.includes("prints"));

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // The page reader is shown finding something it would have to miss for the
    // three zeros above to be vacuous, and the print detector is shown firing on a
    // planted print path.
    assert("the page reader really read the page", called.has("logRowFacts") && imports.length > 5);
    assert(
        "  and the print detector sees a planted one",
        parseSource('const a = 1; window.print();\n', "<planted-print>").source.includes("window.print")
    );
    // Section 2 and 3 are counts of a fixed-length list, so the reader has to be
    // shown following the VALUES rather than reporting a constant: two different
    // rows must produce two different readings.
    assert(
        "the facts really carry the row's own values",
        logRowFacts(FULL_ROW)[0].value !== logRowFacts({ ...FULL_ROW, event: TOOL_EVENT.RETIRED })[0].value
    );
    // The key list has to be a real reading of the returned facts rather than a
    // constant, so a reordering must be visible to it.
    assert("the key reader follows the returned order", keysOf(FULL_ROW)[0] === "event" && keysOf(FULL_ROW)[2] === "job");
    // The copy scanner is seen finding a planted bare noun, since zero is also
    // what a broken matcher reports.
    assert("the copy scanner finds a planted bare `item`", bareItemWords("Every item on this order.").length === 1);
    assert("  and does not flag `tool item` or `tool items`", bareItemWords("This tool item and those tool items.").length === 0);
}

if (isMain(import.meta.url)) await standalone(title, run);

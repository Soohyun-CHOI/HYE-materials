// What one tool item's page shows (#340, #463).
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
// AND #463 GAVE THE PAGE THE DESIGN'S LOOK, WHICH MOVED FOUR THINGS INTO THE MODULE AND
// THIS FILE WITH THEM: the order the history stands in (the newest entry first), who holds
// a tool that is out, when a retired one was retired, and the mark each status is drawn
// with — each a rule over rows the page already has. The facts lost their labels, which the
// design draws none of; the page's heading became the tool's name; and the label stands in
// the record rail drawn as the labels' dialog draws its page, with the print size in text
// where a sentence said the symbol was drawn at it. Section 5 reads those off the page.
//
// WHAT IT CANNOT SEE. Whether any of it reaches a browser, which is this tier's
// standing limit, and whether the page reads the caches rather than deriving
// them — that is a fact about the page's imports, not about this module.
//
// AND WHAT IS NOT HERE BY DESIGN: no assertion about `Tool Items."Status"`
// disagreeing with the log. Breaking the caches by hand is forbidden on this
// base and the one app path that leaves them disagreeing is the action's report
// (`statusNotUpdated`), so there is no function here to pin and no screen sentence
// to hold — `currentHolder` reads only the latest row and names nobody when it
// is not a check-out, which section 2c asserts.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { TOOL_EVENT, TOOL_STATUS, TOOL_STATUS_VALUES } from "../../../lib/toolStatus.js";
import {
    FACT_KIND,
    STATUS_MARK,
    TOOL_ITEM_COPY,
    currentHolder,
    logRowFacts,
    newestFirst,
    retiredAt,
} from "../../../lib/toolItemView.js";
import { callsTo, parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

/** The screen this file is about, read off the AST for section 5. */
const PAGE = "app/(tools)/tool-items/[toolItemId]/page.js";
const STATUS_MARK_FILE = "app/(tools)/StatusMark.js";

export const title = "What one tool item's page shows (#340, #463)";

/** A row with every fact filled, which is what creating a tool item actually writes. */
const FULL_ROW = {
    event: TOOL_EVENT.CREATED,
    eventAt: "2026-09-09T15:14:26.537Z",
    recordedByName: "scoped-fixture",
    jobCode: "26-DEMO-01",
};

const keysOf = (row) => logRowFacts(row).map((fact) => fact.key);

/** Every string the copy constant holds, its nested values and its builders' answers included. */
const copyStrings = () => {
    const out = [];
    for (const value of Object.values(TOOL_ITEM_COPY)) {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "object" && value) out.push(...Object.values(value));
    }
    out.push(TOOL_ITEM_COPY.symbolSize(9.57));
    return out.filter((s) => typeof s === "string");
};

/**
 * The noun the design replaced (#455), in any number and case.
 *
 * THIS FILE HELD THE OPPOSITE RULE UNTIL THEN, failing a bare `item` as the tools
 * area's reading of #303. The design says `tool` in every sentence about one, so what
 * a string here may no longer say is the noun it used to require — and since #463 no
 * string says it at all: the not-found heading was the one remainder, left for the
 * design, and the design's `Tool not found` took its place.
 */
const TOOL_ITEM_NOUN = /\btool items?\b/i;

/** A history row as the page hands it over, by event, at a moment. */
const row = (event, eventAt, extra = {}) => ({ id: `${event}-${eventAt}`, event, eventAt, ...extra });

export function run({ check, assert, log }) {
    // ── 1: the order, the canonical one the page places from ────────────────
    log("a log row's facts, in the order they are handed over:");
    check("a row carries four, event first", keysOf(FULL_ROW).join(","), "event,eventAt,job,recordedBy");
    // NO LABELS SINCE #463: the design draws an entry with none, so a pair carrying one would
    // be a word nothing renders.
    check("  and no pair carries a label", logRowFacts(FULL_ROW).filter((f) => "label" in f).length, 0);
    // The three that pass through untouched. The moment does not, so it is asserted
    // on its own below — its rendering depends on the runtime's zone, and a string
    // pinned here would pass on this machine and fail in CI.
    check(
        "and the values are the ones handed in",
        logRowFacts(FULL_ROW).filter((f) => f.key !== "eventAt").map((f) => f.value).join(" / "),
        "Created / 26-DEMO-01 / scoped-fixture"
    );

    // ── 2: nothing drops, and no fifth arrives ─────────────────────────────
    // THERE WAS A FIFTH UNTIL #363 AND IT WENT WITH ITS FIELD. `Notes` was
    // optional, absent on a first row, and omitted rather than drawn
    // empty; `Tool Log."Notes"` is deleted from the base, so the pair, the
    // drops-when-blank rule and the assertions holding it went together. What
    // replaces them is the opposite claim: a row this function is handed extra
    // keys still renders four, so a value quietly reintroduced would not reach
    // the screen without somebody editing this module.
    log("");
    log("four is the whole list, and nothing a caller adds joins it:");
    check("an extra key is not rendered", keysOf({ ...FULL_ROW, notes: "why it went" }).join(","), "event,eventAt,job,recordedBy");
    check("  nor several", keysOf({ ...FULL_ROW, notes: "x", reason: "y" }).length, 4);
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
    check("a check-out carries it last", withName(TOOL_EVENT.CHECKED_OUT).join(","), "event,eventAt,job,recordedBy,checkedOutTo");
    check(
        "  holding the name",
        logRowFacts({ ...FULL_ROW, event: TOOL_EVENT.CHECKED_OUT, checkedOutTo: "Dana K" }).at(-1).value,
        "Dana K"
    );
    const others = Object.values(TOOL_EVENT).filter((e) => e !== TOOL_EVENT.CHECKED_OUT);
    assert(`  and the other ${others.length} events do not, even handed one`, others.length === 3);
    for (const event of others) check(`  ${event} carries four`, withName(event).join(","), "event,eventAt,job,recordedBy");
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

    // ── 2c: the order the history stands in, and the values only one state has (#463) ─
    log("");
    log("the history newest first, and what the latest entry says about the status:");
    const oldestFirst = [
        row(TOOL_EVENT.CREATED, "2026-09-09T15:00:00.000Z"),
        row(TOOL_EVENT.CHECKED_OUT, "2026-09-10T15:00:00.000Z", { checkedOutTo: "Sungho  Lim" }),
        row(TOOL_EVENT.CHECKED_IN, "2026-09-14T15:00:00.000Z"),
        row(TOOL_EVENT.CHECKED_OUT, "2026-09-22T15:00:00.000Z", { checkedOutTo: " Dana K " }),
    ];
    const history = newestFirst(oldestFirst);
    check("the newest entry first, the order the rows came in turned over", history.map((r) => r.eventAt.slice(5, 10)).join(" "), "09-22 09-14 09-10 09-09");
    check("  leaving the rows it was handed in their order", oldestFirst[0].event, TOOL_EVENT.CREATED);
    check("  and no history is none", newestFirst(undefined).length, 0);
    check("a tool that is out is held by the name its latest entry checked it out to", currentHolder(history, TOOL_STATUS.OUT), "Dana K");
    check("  nobody holds one in stock", currentHolder(history, TOOL_STATUS.IN_STOCK), null);
    // THE LATEST ENTRY AND NOTHING OLDER: a cache saying `Out` over a latest entry that is
    // not a check-out is the state a failed cache write leaves, and an older name would be
    // a guess at who has it.
    check("  and nobody is named when the latest entry is not a check-out", currentHolder(newestFirst(oldestFirst.slice(0, 3)), TOOL_STATUS.OUT), null);
    check("  nor when the check-out carries no name", currentHolder([row(TOOL_EVENT.CHECKED_OUT, "2026-09-22T15:00:00.000Z")], TOOL_STATUS.OUT), null);
    const retiredHistory = newestFirst([...oldestFirst, row(TOOL_EVENT.RETIRED, "2026-09-18T17:12:00.000Z")]);
    check("a retired tool was retired at its retirement's moment", retiredAt(retiredHistory, TOOL_STATUS.RETIRED), "2026-09-18T17:12:00.000Z");
    check("  and a tool in any other status was not", retiredAt(retiredHistory, TOOL_STATUS.IN_STOCK), null);
    check("  nor one whose latest entry is not the retirement", retiredAt(history, TOOL_STATUS.RETIRED), null);

    // ── 2d: the mark each status is drawn with (#463) ──────────────────────
    log("");
    log("each status has its mark, and the map is total over the vocabulary:");
    check("in stock is settled, out is open, retired is ended", TOOL_STATUS_VALUES.map((s) => STATUS_MARK[s]).join(" "), "settled open ended");
    check("  with no mark for a status that does not exist", Object.keys(STATUS_MARK).filter((s) => !TOOL_STATUS_VALUES.includes(s)).length, 0);
    const markFile = parseFile(STATUS_MARK_FILE);
    // THE COMPONENT DRAWS EACH SHAPE AT EACH WIDTH AND ASKS THE MAP, so a status the map
    // names draws, and a fourth shape in the map draws nothing until the file draws it.
    assert("  drawn from the map, at the desk's 9 and the phone's 10", /const shape = STATUS_MARK\[status\];/.test(markFile.source) && /box: 9,/.test(markFile.source) && /box: 10,/.test(markFile.source));
    assert("  its ring 1.5 on both", (markFile.source.match(/className="stroke-status-ring"/g) ?? []).length === 4);

    // ── 3: all four are on every row ───────────────────────────────────────
    log("");
    log("all four are on every row, whatever they hold:");
    // Each of the four is an invariant of the base rather than a value this
    // module may judge — a blank one is a defect upstream, and hiding it would
    // hide the defect. `Job` is the sharpest: the absence of blanks is what makes
    // the previous row's job readable as the previous job.
    for (const key of ["event", "eventAt", "job", "recordedBy"]) {
        const field = key === "job" ? "jobCode" : key === "recordedBy" ? "recordedByName" : key;
        assert(`  a blank ${key} still renders its pair`, keysOf({ ...FULL_ROW, [field]: "" }).includes(key));
        const missing = { ...FULL_ROW };
        delete missing[field];
        assert(`  and a missing ${key} does too`, keysOf(missing).includes(key));
    }
    check("an empty row still carries the four", keysOf({}).join(","), "event,eventAt,job,recordedBy");

    // ── 4: the copy ────────────────────────────────────────────────────────
    log("");
    log("every word the screen can say:");
    const strings = copyStrings();
    assert(`the constant holds ${strings.length} strings`, strings.length >= 15);
    check("none is empty", strings.filter((s) => !s.trim()).length, 0);
    // THE SWEEP'S CLAIM (#455), WITH NO REMAINDER SINCE #463: the not-found heading was the
    // one string still saying the replaced noun, left for the design, and it is the design's.
    check("no string says `tool item`", strings.filter((s) => TOOL_ITEM_NOUN.test(s)).join(" | "), "");
    // THE DESIGN'S WORDS (1c, 1g, 1l), typed out here so a rewording reaches this file.
    check("the empty history", TOOL_ITEM_COPY.noHistory, "No history yet");
    check("a code no tool carries, at a desk", `${TOOL_ITEM_COPY.notFoundHeading} | ${TOOL_ITEM_COPY.notFoundCode.before}HYE-TL-260909-099${TOOL_ITEM_COPY.notFoundCode.after}`, "Tool not found | No tool has the code HYE-TL-260909-099. Check it against the label.");
    check("  and after a scan", TOOL_ITEM_COPY.notFoundScanned, "No tool has this code. Check it against the label and scan again.");
    check("  with the way back", TOOL_ITEM_COPY.backToTools, "Back to Tools");
    check("the label's print size, in text", `${TOOL_ITEM_COPY.sizeLabel} | ${TOOL_ITEM_COPY.symbolLabel} ${TOOL_ITEM_COPY.symbolSize(9.57)}`, "Size | Symbol 9.57 mm");
    check("an entry's two words", `${TOOL_ITEM_COPY.historyTo} | ${TOOL_ITEM_COPY.historyBy} | ${TOOL_ITEM_COPY.between}`, "to | by | ·");
    check("the retirement's button, at both widths", TOOL_ITEM_COPY.moreActions, "More actions");
    check("  and the label's name for assistive tech", TOOL_ITEM_COPY.symbolAlt, "QR label for this tool");
    // `kind` is the notes' explanatory word for what separates `Tools` from
    // `Tool Items` and names no row, so it may not reach a screen (#338).
    check("no string says `kind`", strings.filter((s) => /\bkinds?\b/i.test(s)).length, 0);

    // ── 4b: the moment, a date and a time and nothing finer ────────────────
    log("");
    log("a log entry's moment is handed over as stored, for a browser to resolve (#374):");
    // THE PAIR CARRIES THE RAW INSTANT, AND THE `kind` IS WHAT SAYS SO. This module
    // formatted it until #374, which is what made the page state a moment in the
    // SERVER's zone — see `offline/instant-rendering.mjs` for where the options went and
    // what holds them, the design's notation (#463) among them.
    const ISO = "2026-09-09T15:14:26.537Z";
    const moment = logRowFacts({ event: TOOL_EVENT.CHECKED_OUT, eventAt: ISO, recordedByName: "chkim", jobCode: "26-DEMO-01" }).find(
        (fact) => fact.key === "eventAt"
    );
    check("the moment is handed over unformatted", moment.value, ISO);
    check("  and is marked as one", moment.kind, FACT_KIND.instant);
    // Anti-vacuity: `kind` has to tell the four APART, or marking one says nothing.
    check(
        "  the other three carry no kind",
        logRowFacts({ event: "e", eventAt: ISO, recordedByName: "r", jobCode: "j" }).filter((fact) => fact.kind !== undefined).length,
        1
    );

    // ── 5: the page, read off its source ───────────────────────────────────
    log("");
    log("the page draws what the module decides:");
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
    const initOf = (name) => {
        let found = null;
        walk(page.ast, (n) => {
            if (!found && n.type === "VariableDeclarator" && n.id?.name === name && n.init) found = page.source.slice(n.init.start, n.init.end);
        });
        return found;
    };

    // THE HEADING IS THE TOOL'S NAME (#463), the record's name as 0n and 1f draw it, and the
    // id where the tool did not resolve — and there is one `h1`, set at each width's size,
    // since the dialogs hand focus to the page's heading.
    check("the heading is the tool's name, or the id where no tool resolved", initOf("name"), "tool?.toolName || toolItem.toolItemId");
    const headings = [];
    walk(page.ast, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "h1") {
            const parent = n;
            headings.push(parent);
        }
    });
    check("  one heading for both widths on the page, and one on the screen for a code no tool carries", headings.length, 2);
    assert("  the page's reads that name", /<h1 className="text-heading-lg max-sm:text-mobile-heading-lg">\{name\}<\/h1>/.test(page.source));
    // THE CLAUSES A LINE SETS APART ARE APART IN THE TEXT TOO (#463): the dot's 9 either side
    // is a `Space` each, so the id and the job, and an entry's moment, job and recorder, copy
    // and are read as words — padding alone read `HYE-TL-260909-00726-DEMO-01`. Read off
    // `Dot`, and the page draws the dot nowhere else.
    const dotReading = (parsed) => {
        let found = "none";
        walk(parsed.ast, (n) => {
            if (n.type !== "FunctionDeclaration" || n.id?.name !== "Dot") return;
            const parts = [];
            walk(n.body, (m) => {
                if (m.type !== "JSXOpeningElement") return;
                const cls = m.attributes.find((a) => a.name?.name === "className")?.value?.value ?? "";
                const hidden = m.attributes.some((a) => a.name?.name === "aria-hidden");
                parts.push(`${m.name?.name}${cls ? ` ${cls}` : ""}${hidden ? " hidden" : ""}`);
            });
            found = parts.join(" + ");
        });
        return found;
    };
    check("the dot between two clauses is a Space either side of a dot nobody reads", dotReading(page), "Space w-separator-inline + span text-foreground-faint hidden + Space w-separator-inline");
    check("  and the page draws the dot nowhere else", page.source.split("COPY.between").length - 1, 1);
    // ANTI-VACUITY: the padded dot this replaced is read as one.
    check(
        "  where a padded dot is read so",
        dotReading(parseSource('function Dot() {\n    return <span aria-hidden="true" className="inline-block px-separator-inline">·</span>;\n}\n', "<planted-dot>")),
        "span inline-block px-separator-inline hidden"
    );
    // THE HISTORY, NEWEST FIRST, AND WHAT THE LATEST ENTRY SAYS, from the module's rules on
    // the rows in hand — no read of their own.
    check("the history is drawn newest first", initOf("history"), "newestFirst(log)");
    check("  who holds a tool that is out is the module's answer", initOf("holder"), "currentHolder(history, toolItem.status)");
    check("  and when a retired one was retired", initOf("retired"), "retiredAt(history, toolItem.status)");
    // WHO RECORDED AN ENTRY IS NAMED FOR WHAT THEY DID (#463), in full.
    assert("each entry names its recorder in full", /people\.map\(\(person\) => \[person\.id, actorName\(person\)\]\)/.test(page.source));
    check("  and the facts it places are logRowFacts'", callsTo(page.ast, "logRowFacts").length, 1);

    // THE LABEL'S SYMBOL, BUILT HERE RATHER THAN FETCHED (#352). #351's endpoint spent two
    // operations — the session and this record — and the page has both in hand before the
    // symbol exists, so the import is the whole decision. ITS LABEL, SINCE #457 — the symbol
    // and the code it prints, through the builder the labels' read calls too — so the label
    // drawn in the rail and the page its dialog draws are one object built once.
    assert("the page imports the builder", imports.some((from) => from.endsWith("toolLabelQR")));
    assert("  and calls it for its label", called.has("buildToolItemLabel"));
    check("  naming no fetched address, since that route is gone", names.filter((name) => name === "toolItemQRPath" || name === "QR_ROUTE").length, 0);

    // SIZED BY THIS SYMBOL'S OWN SIDE COUNT, which is #353's measured defect one
    // screen over: the budget is sized once for the label, and passing the constant
    // to the BOX scales a larger version into today's box and thins its modules.
    //
    // THE ARGUMENT IS READ, NOT THE NAME. Asserting that `symbolBox`, `labelBudget`
    // and `QR_SIDE_MODULES` all APPEAR would pass with the two arguments swapped,
    // which is the defect — a check that names what it is looking for and then
    // cannot tell the two apart is the trap #351 and #353 each fell into once. So
    // the `sideModules` each call receives is read off the call site.
    const sideModulesArgOf = (parsed, fn) => {
        let found = null;
        walk(parsed.ast, (n) => {
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
    check("the module size is derived from the constant", sideModulesArgOf(page, "labelBudget"), "QR_SIDE_MODULES");
    check("  and the box from this symbol's own count", sideModulesArgOf(page, "symbolBox"), "label.sideModules");
    // AND THE BOX IS ASKED OF THE BUDGET THE PAGE SIZED (#467), since `fits` is whether
    // the symbol is no larger than the one that budget was sized for: handed anything
    // else, `symbolBox` throws as the page renders, which this tier would never see.
    const budgetHanded = (parsed) => {
        let bound = "none";
        let handed = "none";
        walk(parsed.ast, (n) => {
            if (n.type === "VariableDeclarator" && n.init?.type === "CallExpression" && n.init.callee?.name === "labelBudget" && n.id.type === "Identifier")
                bound = n.id.name;
            if (n.type === "CallExpression" && n.callee?.name === "symbolBox") {
                const prop = n.arguments[0]?.properties?.find((p) => p.key?.name === "budget");
                handed = prop ? (prop.value.type === "Identifier" ? prop.value.name : prop.value.type) : "nothing";
            }
        });
        return `${bound} -> ${handed}`;
    };
    check("  and is handed the budget labelBudget made", budgetHanded(page), "budget -> budget");
    check(
        "  where a call handed a module size alone is seen handing no budget",
        budgetHanded(parseSource("const { moduleMm } = labelBudget({ sideModules: QR_SIDE_MODULES });\nconst b = symbolBox({ sideModules: symbol.sideModules, moduleMm });\n", "<planted-no-budget>")),
        "none -> nothing"
    );
    // ANTI-VACUITY: the reader is shown telling the two apart on a planted swap, so
    // the two checks above are a fact about the call sites rather than about a
    // reader that returns the same thing whatever it is given.
    {
        const planted = parseSource(
            "const a = labelBudget({ sideModules: symbol.sideModules });\n" + "const b = symbolBox({ sideModules: QR_SIDE_MODULES, budget });\n",
            "<planted-swap>"
        );
        check("  a swapped pair reads as swapped", `${sideModulesArgOf(planted, "labelBudget")}|${sideModulesArgOf(planted, "symbolBox")}`, "symbol.sideModules|QR_SIDE_MODULES");
    }

    // THE RAIL DRAWS THE LABEL AS THE DIALOG DRAWS ITS PAGE, AND ONLY WHEN IT FITS (#463,
    // #453). The drawing is `LabelPreview` — the dialog's own page at its preview scale —
    // handed the label and the budget this render built, so the two drawings are one; the
    // figure beside `Symbol` is `symbolBox`'s answer, and a millimeter typed in its place
    // would stop following the stock and the version the day either moves (#412). A host
    // past seventeen characters builds a symbol the labels refuse, so the drawing and its
    // size are the ones asked about `fits`, and the sentence about the host stands in their
    // place. This tier renders none of it, so all of it is read off the page.
    const railReading = (parsed) => {
        const found = { binding: "none", preview: "none", symbol: "none", verdict: "none" };
        const text = (node) => (node ? parsed.source.slice(node.start, node.end) : "none");
        walk(parsed.ast, (n) => {
            if (n.type === "VariableDeclarator" && n.init?.type === "CallExpression" && n.init.callee?.name === "symbolBox" && n.id.type === "ObjectPattern")
                found.binding = n.id.properties.map((p) => `${p.key.name}: ${p.value.name}`).join(", ");
            if (n.type === "JSXOpeningElement" && n.name?.name === "LabelPreview")
                found.preview = n.attributes.map((a) => `${a.name?.name}=${text(a.value)}`).join(" ");
            if (n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.property?.name === "symbolSize")
                found.symbol = n.arguments.map(text).join(", ");
            if (n.type === "ConditionalExpression" && /^symbolFits$/.test(text(n.test)))
                found.verdict = `${/LabelPreview/.test(text(n.consequent))} ${/symbolTooLargeNote/.test(text(n.alternate))}`;
        });
        return found;
    };
    const rail = railReading(page);
    check("the box and the verdict both come from symbolBox", rail.binding, "boxMm: symbolMm, fits: symbolFits");
    check("  the rail draws the label as the dialog does, from this render's label and budget", rail.preview, "label={label} budget={budget} name={COPY.symbolAlt}");
    check("  says the symbol's size from the box", rail.symbol, "symbolMm");
    check("  and draws both only when it fits, the host's sentence otherwise", rail.verdict, "true true");
    // ANTI-VACUITY: a page typing the size and drawing whatever the verdict is read so.
    const plantedRail = railReading(
        parseSource(
            "const { boxMm: symbolMm } = symbolBox({ sideModules: label.sideModules, budget });\n" +
                'const a = <aside><LabelPreview label={other} />{COPY.symbolSize("9.57")}</aside>;\n',
            "<planted-rail>"
        )
    );
    check("  a rail ignoring them is read that way", `${plantedRail.binding} | ${plantedRail.preview} | ${plantedRail.symbol} | ${plantedRail.verdict}`, 'boxMm: symbolMm | label={other} | "9.57" | none');

    // PRINTS NOTHING ITSELF, which is what keeps "the same physical object as the
    // original" true by construction rather than by comparison: the reprint is the
    // labels' dialog, so there is no second layout to drift.
    //
    // AND IT OPENS THE DIALOG ON ITS OWN LABEL, AS IT BUILT IT (#457): the run is that
    // one label and no code missing, so opening it reads nothing, and the words are the
    // ones its control and the dialog's title share. Read off the opener's props.
    const opener = (parsed) => {
        let found = "none";
        walk(parsed.ast, (n) => {
            if (n.type !== "JSXOpeningElement" || n.name?.name !== "LabelsDialog") return;
            const prop = (name) => n.attributes.find((a) => a.name?.name === name)?.value;
            const run = prop("run")?.expression;
            const part = (key) => {
                const value = run?.properties?.find((p) => p.key?.name === key)?.value;
                if (!value) return "none";
                if (value.type === "ArrayExpression") return `[${value.elements.map((e) => e?.name ?? e?.type).join(", ")}]`;
                return value.name ?? value.type;
            };
            const title = prop("title")?.expression;
            found = [
                title ? `${title.object?.name}.${title.property?.name}` : "none",
                `sideModules ${part("sideModules")}`,
                `labels ${part("labels")}`,
                `missing ${part("missing")}`,
                prop("toolItemIds") ? "reads ids" : "reads none",
            ].join(" | ");
        });
        return found;
    };
    check(
        "it opens the labels' dialog on the label it built",
        opener(page),
        "LABEL_COPY.openFromToolItem | sideModules QR_SIDE_MODULES | labels [label] | missing [] | reads none"
    );
    // ANTI-VACUITY: an opener handed ids to read, as a tool's page hands them, is seen so.
    check(
        "  where one handed ids to read is seen reading them",
        opener(parseSource("const a = <LabelsDialog title={COPY.openFromTool} toolItemIds={ids} />;\n", "<planted-opener>")),
        "COPY.openFromTool | sideModules none | labels none | missing none | reads ids"
    );
    check(
        "  and implements no print path of its own",
        [
            imports.some((from) => from.endsWith(".css")) ? "a stylesheet" : "",
            names.includes("print") ? "a print call" : "",
            page.source.includes("@page") ? "a page box" : "",
            page.source.includes("window.print") ? "window.print" : "",
        ]
            .filter(Boolean)
            .join(", "),
        ""
    );

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    assert("the page reader really read the page", called.has("logRowFacts") && imports.length > 5);
    assert("  and the print detector sees a planted one", parseSource("const a = 1; window.print();\n", "<planted-print>").source.includes("window.print"));
    // Section 2 and 3 are counts of a fixed-length list, so the reader has to be
    // shown following the VALUES rather than reporting a constant: two different
    // rows must produce two different readings.
    assert("the facts really carry the row's own values", logRowFacts(FULL_ROW)[0].value !== logRowFacts({ ...FULL_ROW, event: TOOL_EVENT.RETIRED })[0].value);
    // The key list has to be a real reading of the returned facts rather than a
    // constant, so a reordering must be visible to it.
    assert("the key reader follows the returned order", keysOf(FULL_ROW)[0] === "event" && keysOf(FULL_ROW)[2] === "job");
    // The copy scanner is seen finding a planted bare noun, since zero is also what
    // a broken matcher reports.
    assert("the noun matcher finds `tool item`", TOOL_ITEM_NOUN.test("Tool item not found"));
    assert("  and passes the design's `tool`", !TOOL_ITEM_NOUN.test(TOOL_ITEM_COPY.notFoundHeading));
    // The order and the holder are seen to read the rows, not a constant.
    assert("the order and the holder follow the rows", newestFirst(oldestFirst)[0] !== newestFirst(oldestFirst.slice(0, 3))[0] && currentHolder(history, TOOL_STATUS.OUT) !== currentHolder(newestFirst(oldestFirst.slice(0, 2)), TOOL_STATUS.OUT));
}

if (isMain(import.meta.url)) await standalone(title, run);

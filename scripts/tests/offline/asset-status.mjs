// The assets track's two closed vocabularies, and the three mappings over them
// (#334; the second added by #362 and the third by #363).
//
// WHAT THIS GUARDS AND WHY IT IS WORTH A CHECK. `Assets."Status"` and
// `Asset Log."Event"` are singleSelect fields, and an existing select's option
// list CANNOT be written through the Metadata API at all — a PATCH carrying
// `options.choices` is refused 422 in every shape tried, measured and recorded in
// docs/notes/airtable-access.md. So the values and their COLORS go in on field
// CREATE or they go in by hand, and the create payload lives in a Python script
// that cannot import the JS module holding the same values. That duplication is
// structural and cannot be removed; agreement between the two is checkable, and
// this is the check. Exactly `offline/unit-options.mjs`'s situation and remedy.
//
// It also pins the mapping, which is the load-bearing part of the design. The
// status is described as a cache of the last `Asset Log` row, and the reason that
// cannot be an Airtable formula was one entry: `Job Changed`, a last row that
// left the status alone. #335 removed that event, so that reason is gone and the
// conclusion now stands on two facts about Airtable instead — see
// docs/notes/tools.md. What this file pins in its place is that no status is a
// dead option, and the assertion says at length what that does NOT prove.
//
// #362 AND #363 ADDED THE OTHER TWO AND THEY ARE PINNED HERE RATHER THAN BESIDE
// THE SCREEN THAT READS THEM. Both are vocabulary — total over the statuses,
// closed over the events — so a fourth status has to visit all three maps, and
// a check living next to the transition screen would leave them half guarded.
// The two status maps agree on today's three values and the agreement is
// asserted rather than derived, because they answer different questions and
// would part on a fourth. What is NOT here is anything about that screen: which
// words it says and which refusals it produces are
// offline/asset-transition.mjs's.
//
// Offline-safe: lib/assetStatus.js imports nothing, and the Python side is read as
// TEXT and parsed, never executed.
//
// WHAT THIS CANNOT SEE, by construction: what the Airtable fields actually hold.
// A choice added or renamed by hand in the Airtable UI leaves both files
// untouched and passes here — the `DRUM` failure one axis over. That comparison
// needs the Metadata API and lives in scripts/tests/verify-tools-schema-334.mjs.

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
    EVENT_OFFERED_BY_STATUS,
    MAY_RETIRE_FROM_STATUS,
    STATUS_AFTER_EVENT,
    ASSET_EVENT,
    ASSET_EVENT_VALUES,
    ASSET_STATUS,
    ASSET_STATUS_VALUES,
    eventOfferedBy,
    mayRetireFrom,
    statusAfterEvent,
} from "../../../lib/assetStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Tool status and event vocabularies, and the maps between them (#334, #362, #363)";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY_PATH = resolve(HERE, "../../import/create_tools_334.py");

/**
 * Pull a top-level Python list of `{"name": ..., "color": ...}` dicts out of the
 * source text, as `[name, color]` pairs.
 *
 * Anchored to the start of a line so a mention of the same constant inside the
 * module docstring cannot be what gets matched. Returns null when the constant is
 * not found at all, which the anti-vacuity assertion below is what catches — "the
 * parse found nothing" and "the lists agree" must never look the same.
 */
function pythonChoiceList(source, name) {
    const block = source.match(new RegExp(`^${name}\\s*=\\s*\\[([\\s\\S]*?)^\\]`, "m"));
    if (!block) return null;
    return Array.from(
        block[1].matchAll(/\{\s*"name":\s*"([^"]*)",\s*"color":\s*"([^"]*)"\s*\}/g),
        (m) => [m[1], m[2]]
    );
}

export function run({ check, log, assert }) {
    // ── the two vocabularies, by value ──────────────────────────────────────
    // Spelled out rather than derived from the module: this is the pin, and a pin
    // that reads its subject asserts nothing. These are the strings printed into
    // Airtable's option lists, and after field CREATE no API can change them.
    log("the three statuses, in order:");
    check("ASSET_STATUS_VALUES", ASSET_STATUS_VALUES.join(" | "), "In stock | Out | Retired");
    check("three and no more", ASSET_STATUS_VALUES.length, 3);
    assert("no duplicates", new Set(ASSET_STATUS_VALUES).size === ASSET_STATUS_VALUES.length);

    log("");
    log("the four events, in order:");
    // `Created` WAS `Registered` UNTIL #455, and the two scans were `Checked Out` and
    // `Checked In` until #463, each renamed in the Airtable UI with the rows
    // following it — see lib/assetStatus.js's header.
    check("ASSET_EVENT_VALUES", ASSET_EVENT_VALUES.join(" | "),
        "Created | Checked out | Checked in | Retired");
    check("four and no more", ASSET_EVENT_VALUES.length, 4);
    assert("no duplicates", new Set(ASSET_EVENT_VALUES).size === ASSET_EVENT_VALUES.length);

    // ── sentence case, the design's (#463) ──────────────────────────────────
    // The first word capitalized and every later one lowercase, which is how the
    // design writes a status and an event on every asset screen. It was the base's
    // title case until #463 (`Sent to Vendor`, read off `Purchase Orders."Status"`),
    // and the materials axis still is: the axis whose words the design settles
    // takes them, and `docs/notes/naming.md` says so. Held by value because the
    // option list cannot be corrected through the API — a casing slip is a hand
    // edit in the UI, though an option renamed in place carries every row with it
    // (#455, docs/notes/airtable-access.md). What this guards is the hand edit,
    // which is still one nobody should have to make.
    log("");
    log("sentence case (the design's, since #463):");
    const sentenceCased = (value) =>
        value.split(" ").every((word, i) =>
            i === 0 ? /^[A-Z][a-z]*$/.test(word) : word === word.toLowerCase());
    const miscased = [...ASSET_STATUS_VALUES, ...ASSET_EVENT_VALUES]
        .filter((value) => !sentenceCased(value));
    check("values cased against the convention", miscased.length, 0);
    for (const m of miscased) log(`    ${m}`);
    assert(
        "  and the rule is seen to say NO (else it is an empty predicate)",
        !sentenceCased("Checked Out") && !sentenceCased("in stock") && sentenceCased("In stock")
    );

    // ── the mapping ─────────────────────────────────────────────────────────
    log("");
    log("every event maps into the status vocabulary:");
    const statuses = new Set(ASSET_STATUS_VALUES);
    const unmapped = ASSET_EVENT_VALUES.filter(
        (e) => !Object.prototype.hasOwnProperty.call(STATUS_AFTER_EVENT, e)
    );
    check("events with no entry in STATUS_AFTER_EVENT", unmapped.length, 0);
    for (const e of unmapped) log(`    ${e}`);

    const stray = Object.keys(STATUS_AFTER_EVENT).filter((e) => !ASSET_EVENT_VALUES.includes(e));
    check("entries naming an event that does not exist", stray.length, 0);

    // NO `null` IS ALLOWED ANY MORE. #334 had one — `Job Changed`, an event that
    // moved the job and left the status alone — and #335 removed the event and the
    // escape value with it. An entry that is null now is an event nobody decided
    // the meaning of.
    const badTarget = Object.entries(STATUS_AFTER_EVENT).filter(([, s]) => !statuses.has(s));
    check("entries pointing outside the status vocabulary", badTarget.length, 0);
    for (const [e, s] of badTarget) log(`    ${e} -> ${JSON.stringify(s)}`);

    // ── every status is produced by some event ──────────────────────────────
    // THE REPLACEMENT FOR AN ASSERTION #335 DELETED, and what it does and does not
    // hold is worth being exact about, because the two are easy to confuse.
    //
    // WHAT IT HOLDS: a status no event can produce is a dead option. It stands in
    // the select, it takes a slot in a per-status count that is always zero, it
    // offers a list filter that returns nothing, and no code path can ever set it.
    // That is checkable and this checks it.
    //
    // WHAT IT DOES NOT HOLD, AND THIS IS THE PART TO READ BEFORE TRUSTING A PASS:
    // it is NOT the rule #335 applied. What that issue removed was statuses nobody
    // would ever DESIGNATE — an asset here is thrown away rather than repaired, and
    // nobody reports one lost — and `In Repair` was perfectly reachable, from
    // `Sent to Repair`, right up until it was deleted. So this assertion would have
    // passed on the old vocabulary and passes on the new one, and it cannot tell
    // which of the two is right. Whether an event describes something that actually
    // happens on a site is not a property of this source tree; it is a question for
    // a person who has watched the work. **A green run here is not evidence that
    // the vocabulary is justified**, and the next person to add a status should not
    // read it as one — the justification is in docs/notes/tools.md, in prose,
    // because that is the only form it has.
    //
    // The assertion it replaced is gone with its subject: #334 asserted that exactly
    // one event mapped to `null` and that it was `Job Changed`, which was the first
    // of three reasons the app writes `Assets."Status"` itself. #335 removed the
    // event, so the null went, so the assertion had nothing left to be about. The
    // conclusion survives on the other two reasons, neither of which is checkable
    // here either — both are facts about Airtable.
    log("");
    log("every status is produced by at least one event (no dead option):");
    const produced = new Set(Object.values(STATUS_AFTER_EVENT));
    for (const status of ASSET_STATUS_VALUES) {
        const by = Object.entries(STATUS_AFTER_EVENT)
            .filter(([, s]) => s === status)
            .map(([e]) => e);
        assert(`  ${status} <- ${by.join(", ") || "NOTHING"}`, by.length > 0);
    }
    check("statuses no event produces", ASSET_STATUS_VALUES.filter((s) => !produced.has(s)).length, 0);
    // Anti-vacuity: the reachability set has to be seen saying NO, or "every status
    // is produced" is the vacuous truth of an empty vocabulary.
    assert(
        "  and the reachability set rejects a status that is not in the map",
        !produced.has("In Repair") && produced.size > 0
    );

    // ── the one string both vocabularies share ──────────────────────────────
    // Worth pinning now that it is 1 of 4 rather than 2 of 8: an event and a status
    // spelling the same word is a deliberate coincidence, not drift. `Retired` is a
    // transition a person designates, so it is named for the state it arrives at;
    // everything else is either a scan (named for the act) or `Created` (named
    // for an act with no status of its own).
    log("");
    log("`Retired` is the one string both vocabularies carry:");
    const shared = ASSET_EVENT_VALUES.filter((e) => ASSET_STATUS_VALUES.includes(e));
    check("shared strings", shared.join(", "), ASSET_STATUS.RETIRED);
    check("and there is exactly one", shared.length, 1);

    log("");
    log("statusAfterEvent applies the map:");
    check("creating one puts it in stock",
        statusAfterEvent(ASSET_EVENT.CREATED), ASSET_STATUS.IN_STOCK);
    check("a check-out sends it out",
        statusAfterEvent(ASSET_EVENT.CHECKED_OUT), ASSET_STATUS.OUT);
    check("a check-in brings it back",
        statusAfterEvent(ASSET_EVENT.CHECKED_IN), ASSET_STATUS.IN_STOCK);
    check("retiring is the only end",
        statusAfterEvent(ASSET_EVENT.RETIRED), ASSET_STATUS.RETIRED);
    // The signature took a second argument until #335 — the current status, so a
    // null entry could leave the field alone. With no null entry nothing reads it.
    check("it takes one argument", statusAfterEvent.length, 1);

    let threw = null;
    try {
        statusAfterEvent("Job Changed");
    } catch (err) {
        threw = err.message;
    }
    // `Job Changed` on purpose: it was a real event until #335 and is exactly the
    // shape of the mistake — a call site left behind by a narrowed vocabulary.
    assert("an event outside the vocabulary throws rather than no-opping", Boolean(threw));
    assert("  and the throw names the module to edit", (threw || "").includes("lib/assetStatus.js"));

    // ── the other direction: what a status offers next (#362) ───────────────
    // PINNED BY VALUE, WHICH IS #351's AND #353's LESSON APPLIED BEFORE IT COULD BE
    // REPEATED A THIRD TIME. Writing this as `EVENT_OFFERED_BY_STATUS[ASSET_STATUS
    // .IN_STOCK] === ASSET_EVENT.CHECKED_OUT` is an expression over the very
    // constants under test: rename both halves and all of it passes. The literals
    // are a second path, so a rename has to reach this file in the same commit.
    log("");
    log("what each status offers next, by value:");
    check("In stock offers", EVENT_OFFERED_BY_STATUS["In stock"], "Checked out");
    check("Out offers", EVENT_OFFERED_BY_STATUS["Out"], "Checked in");
    check("Retired offers", EVENT_OFFERED_BY_STATUS["Retired"], null);
    check("three entries and no more", Object.keys(EVENT_OFFERED_BY_STATUS).length, 3);

    // TOTAL OVER THE STATUS VOCABULARY. A fourth status with no entry is what this
    // catches, and it is the whole reason `Retired`'s `null` is written out rather
    // than left absent: without it, "has an entry" and "offers nothing" would be
    // one state and a new status would inherit the terminal answer in silence.
    log("");
    log("and the map is total over the status vocabulary:");
    const unofferedStatuses = ASSET_STATUS_VALUES.filter(
        (s) => !Object.prototype.hasOwnProperty.call(EVENT_OFFERED_BY_STATUS, s)
    );
    check("statuses with no entry", unofferedStatuses.length, 0);
    const strayStatuses = Object.keys(EVENT_OFFERED_BY_STATUS).filter(
        (s) => !ASSET_STATUS_VALUES.includes(s)
    );
    check("entries naming a status that does not exist", strayStatuses.length, 0);
    const badOffer = Object.values(EVENT_OFFERED_BY_STATUS).filter(
        (e) => e !== null && !ASSET_EVENT_VALUES.includes(e)
    );
    check("entries offering an event that does not exist", badOffer.length, 0);

    // THE TWO MAPS ARE NOT INVERSES, WHICH IS WHY BOTH EXIST. Two events land on
    // `In stock`, so inverting `STATUS_AFTER_EVENT` is not a function; and
    // `Created` is offered by no status, because creating an asset makes the row
    // rather than moving one. A later pass tempted to derive one map from the other
    // fails here rather than shipping a screen that offers `Created`.
    log("");
    log("the two maps are not each other's inverse:");
    const intoInStock = Object.entries(STATUS_AFTER_EVENT)
        .filter(([, s]) => s === ASSET_STATUS.IN_STOCK)
        .map(([e]) => e);
    check("events landing on In stock", intoInStock.length, 2);
    const offered = new Set(Object.values(EVENT_OFFERED_BY_STATUS).filter(Boolean));
    assert("  so no status can offer both of them", offered.size === 2);
    assert("`Created` is offered by no status", !offered.has(ASSET_EVENT.CREATED));

    // AND EVERY OFFER MOVES THE ASSET. An offer whose event leaves the status
    // where it was is a control that does nothing and a log row that records a
    // non-event — reachable by one wrong entry in either map, and invisible to
    // every assertion above, which only ask that the values exist.
    log("");
    log("every offer lands somewhere else:");
    for (const [status, event] of Object.entries(EVENT_OFFERED_BY_STATUS)) {
        if (!event) continue;
        assert(`  ${status} -> ${event} -> ${statusAfterEvent(event)}`, statusAfterEvent(event) !== status);
    }
    // The pair is a round trip rather than two one-way streets: what a check-out
    // leaves offers the check-in that undoes it. That is what makes the transition
    // correctable, which is why #362 made it one press and not a modal, under the
    // rule CLAUDE.md held until #459.
    check(
        "the pair is a round trip",
        eventOfferedBy(statusAfterEvent(eventOfferedBy(ASSET_STATUS.IN_STOCK))),
        ASSET_EVENT.CHECKED_IN
    );
    check(
        "  in both directions",
        statusAfterEvent(eventOfferedBy(statusAfterEvent(eventOfferedBy(ASSET_STATUS.IN_STOCK)))),
        ASSET_STATUS.IN_STOCK
    );

    log("");
    log("eventOfferedBy applies the map:");
    check("it takes one argument", eventOfferedBy.length, 1);
    check("a stocked asset is checked out", eventOfferedBy(ASSET_STATUS.IN_STOCK), ASSET_EVENT.CHECKED_OUT);
    check("one that is out is checked in", eventOfferedBy(ASSET_STATUS.OUT), ASSET_EVENT.CHECKED_IN);
    check("and a retired one offers nothing", eventOfferedBy(ASSET_STATUS.RETIRED), null);

    let statusThrew = null;
    try {
        eventOfferedBy("In Repair");
    } catch (err) {
        statusThrew = err.message;
    }
    // `In Repair` on purpose: it was a real status until #335 and is exactly the
    // shape of the mistake this guards — a value left behind by a narrowed
    // vocabulary, or a fourth one added to the base by hand.
    assert("a status outside the vocabulary throws rather than offering nothing", Boolean(statusThrew));
    assert("  and the throw names the module to edit", (statusThrew || "").includes("lib/assetStatus.js"));
    // ANTI-VACUITY FOR THE `null`: "offers nothing" and "is not a status" have to be
    // two answers, or the throw above is indistinguishable from `Retired`'s entry
    // and the totality assertion is checking nothing.
    assert("  so a null answer is not how an unknown status is reported", eventOfferedBy("Retired") === null);

    // ── the third map: which statuses may be retired (#363) ────────────────
    // BY VALUE AGAIN, for the reason two sections up: an assertion written in
    // terms of `ASSET_STATUS` is an expression over the constant under test.
    log("");
    log("which statuses a person may retire from, by value:");
    check("In stock", MAY_RETIRE_FROM_STATUS["In stock"], true);
    check("Out", MAY_RETIRE_FROM_STATUS["Out"], true);
    check("Retired", MAY_RETIRE_FROM_STATUS["Retired"], false);
    check("three entries and no more", Object.keys(MAY_RETIRE_FROM_STATUS).length, 3);
    const unretirable = ASSET_STATUS_VALUES.filter(
        (s) => !Object.prototype.hasOwnProperty.call(MAY_RETIRE_FROM_STATUS, s)
    );
    check("statuses with no entry", unretirable.length, 0);
    const strayRetire = Object.keys(MAY_RETIRE_FROM_STATUS).filter((s) => !ASSET_STATUS_VALUES.includes(s));
    check("entries naming a status that does not exist", strayRetire.length, 0);
    check(
        "every entry is a boolean",
        Object.values(MAY_RETIRE_FROM_STATUS).filter((v) => typeof v !== "boolean").length,
        0
    );

    // `Out` IS RETIRABLE, WHICH IS THE ONE ENTRY WITH A REASON OUTSIDE THE
    // VOCABULARY. An asset that broke on a site is retired from there; refusing it
    // would force somebody to record a check-in that never happened. It is also
    // the whole of what a browser could have shown about that path — the page
    // renders both controls under one test on the plan's refusal and never reads
    // the status — so the assertion below is where that case is covered.
    assert("an asset that is out may still be retired", mayRetireFrom(ASSET_STATUS.OUT));
    check(
        "and it is offered on exactly the same terms as one in stock",
        `${mayRetireFrom(ASSET_STATUS.IN_STOCK)}|${mayRetireFrom(ASSET_STATUS.OUT)}`,
        "true|true"
    );

    // THE TWO STATUS MAPS AGREE TODAY AND THAT IS A MEASUREMENT, NOT A
    // DERIVATION. `eventOfferedBy` returns null for exactly the status this one
    // refuses, so `!eventOfferedBy(s)` would answer today's question — and would
    // be wrong for a fourth status that offers no scan and can still be retired.
    // Asserting the agreement rather than deriving one from the other is what
    // makes that a visible change instead of a silent one.
    log("");
    log("the two status maps agree on all three values, which is measured rather than assumed:");
    for (const status of ASSET_STATUS_VALUES) {
        check(
            `  ${status}: offers ${eventOfferedBy(status) ?? "nothing"}, retirable ${mayRetireFrom(status)}`,
            Boolean(eventOfferedBy(status)),
            mayRetireFrom(status)
        );
    }
    assert("  and they are two objects, so a fourth status has to answer both", EVENT_OFFERED_BY_STATUS !== MAY_RETIRE_FROM_STATUS);

    // EXACTLY ONE TERMINAL STATUS, which is what the screen's single sentence in
    // place of every control is about.
    const terminal = ASSET_STATUS_VALUES.filter((s) => !eventOfferedBy(s) && !mayRetireFrom(s));
    check("terminal statuses", terminal.join(","), "Retired");

    let retireThrew = null;
    try {
        mayRetireFrom("In Repair");
    } catch (err) {
        retireThrew = err.message;
    }
    assert("a status outside the vocabulary throws rather than reading false", Boolean(retireThrew));
    assert("  and the throw names the module to edit", (retireThrew || "").includes("lib/assetStatus.js"));
    assert("  so false is not how an unknown status is reported", mayRetireFrom("Retired") === false);

    // ── the Python creation payload says the same thing ─────────────────────
    // The half that cannot be fixed after the fact. `create_tools_334.py` sends
    // these lists on field CREATE and no later API call can correct them.
    log("");
    log("the creation script's option lists match, names and colors and order:");
    const py = readFileSync(PY_PATH, "utf8");
    const pyStatus = pythonChoiceList(py, "TOOL_STATUS_CHOICES");
    const pyEvent = pythonChoiceList(py, "TOOL_EVENT_CHOICES");

    // ANTI-VACUITY, AND IT IS THE ASSERTION THIS FILE MOST NEEDS. A regex that
    // matches nothing returns an empty list, and "the lists agree" would then be
    // trivially true of two empties — the exact trap `line-vocabulary.mjs` documents
    // for its own source parser. So the parse is proved to have found something
    // before anything is compared with it.
    assert("the parser found TOOL_STATUS_CHOICES in the Python source", Array.isArray(pyStatus));
    assert("the parser found TOOL_EVENT_CHOICES in the Python source", Array.isArray(pyEvent));
    check("  status choices parsed", (pyStatus || []).length, 3);
    check("  event choices parsed", (pyEvent || []).length, 4);
    assert(
        "  and the parser is seen to say NO on a name that is not there",
        pythonChoiceList(py, "TOOL_NOT_A_CONSTANT") === null
    );

    check(
        "status names, in order",
        (pyStatus || []).map(([n]) => n).join(" | "),
        ASSET_STATUS_VALUES.join(" | ")
    );
    check(
        "event names, in order",
        (pyEvent || []).map(([n]) => n).join(" | "),
        ASSET_EVENT_VALUES.join(" | ")
    );

    // The colors are checked here rather than only in the script's own verify step
    // because they are the part with no second chance: `typecast` gives every option
    // it creates the same default color and nothing can recolor it afterwards, which
    // is how two `Edit Log` options sat off the palette until somebody fixed them by
    // hand (#181).
    // THE COLOR RULE LOST ITS RED IN #335. It was "walk the palette skipping red and
    // gray, red for the negative value, gray for the terminal one" — and with
    // `In Repair` and `Lost` gone there is no negative value on either axis. What is
    // left is the walk plus gray for the end, and red being ABSENT is now part of
    // the rule rather than an accident: a red option would claim a meaning this
    // vocabulary does not have.
    const paletteRule = [
        ["In stock", "blueLight2"], ["Out", "cyanLight2"], ["Retired", "grayLight2"],
    ];
    check(
        "status colors walk the palette, gray for the end",
        JSON.stringify(pyStatus), JSON.stringify(paletteRule)
    );
    const eventRule = [
        ["Created", "blueLight2"], ["Checked out", "cyanLight2"],
        ["Checked in", "tealLight2"], ["Retired", "grayLight2"],
    ];
    check("event colors do the same", JSON.stringify(pyEvent), JSON.stringify(eventRule));
    check("  gray marks the terminal value and nothing else",
        [...(pyStatus || []), ...(pyEvent || [])]
            .filter(([n, c]) => c === "grayLight2" && n !== "Retired").length, 0);
    check("  and no option is red any more",
        [...(pyStatus || []), ...(pyEvent || [])].filter(([, c]) => c === "redLight2").length, 0);

    log("");
    log(`  ${ASSET_STATUS_VALUES.length} statuses and ${ASSET_EVENT_VALUES.length} events, pinned in two files`);
    log("  what this CANNOT say: what the live Airtable option lists hold —");
    log("  that is scripts/tests/verify-tools-schema-334.mjs");
}

if (isMain(import.meta.url)) standalone(title, run);

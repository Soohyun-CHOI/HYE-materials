// The tools track's two closed vocabularies, and the two mappings between them
// (#334; the second added by #362).
//
// WHAT THIS GUARDS AND WHY IT IS WORTH A CHECK. `Tool Items."Status"` and
// `Tool Log."Event"` are singleSelect fields, and an existing select's option
// list CANNOT be written through the Metadata API at all — a PATCH carrying
// `options.choices` is refused 422 in every shape tried, measured and recorded in
// docs/notes/airtable-access.md. So the values and their COLORS go in on field
// CREATE or they go in by hand, and the create payload lives in a Python script
// that cannot import the JS module holding the same values. That duplication is
// structural and cannot be removed; agreement between the two is checkable, and
// this is the check. Exactly `offline/unit-options.mjs`'s situation and remedy.
//
// It also pins the mapping, which is the load-bearing part of the design. The
// status is described as a cache of the last `Tool Log` row, and the reason that
// cannot be an Airtable formula was one entry: `Job Changed`, a last row that
// left the status alone. #335 removed that event, so that reason is gone and the
// conclusion now stands on two facts about Airtable instead — see
// docs/notes/tools.md. What this file pins in its place is that no status is a
// dead option, and the assertion says at length what that does NOT prove.
//
// #362 ADDED THE OTHER DIRECTION AND IT IS PINNED HERE RATHER THAN BESIDE THE
// SCREEN THAT READS IT. `EVENT_OFFERED_BY_STATUS` is vocabulary — total over the
// statuses, closed over the events — so a fourth status has to visit both maps,
// and a check living next to the transition screen would leave the pair half
// guarded. What is NOT here is anything about that screen: which words it says
// and which refusals it produces are offline/tool-transition.mjs's.
//
// Offline-safe: lib/toolStatus.js imports nothing, and the Python side is read as
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
    STATUS_AFTER_EVENT,
    TOOL_EVENT,
    TOOL_EVENT_VALUES,
    TOOL_STATUS,
    TOOL_STATUS_VALUES,
    eventOfferedBy,
    statusAfterEvent,
} from "../../../lib/toolStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Tool status and event vocabularies, and the maps between them (#334, #362)";

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
    check("TOOL_STATUS_VALUES", TOOL_STATUS_VALUES.join(" | "), "In Stock | Out | Retired");
    check("three and no more", TOOL_STATUS_VALUES.length, 3);
    assert("no duplicates", new Set(TOOL_STATUS_VALUES).size === TOOL_STATUS_VALUES.length);

    log("");
    log("the four events, in order:");
    check("TOOL_EVENT_VALUES", TOOL_EVENT_VALUES.join(" | "),
        "Registered | Checked Out | Checked In | Retired");
    check("four and no more", TOOL_EVENT_VALUES.length, 4);
    assert("no duplicates", new Set(TOOL_EVENT_VALUES).size === TOOL_EVENT_VALUES.length);

    // ── title case with lowercase particles ─────────────────────────────────
    // The base's own convention, read off `Purchase Orders."Status"` (`Sent to
    // Vendor`) rather than invented here: every word is capitalized except a
    // preposition that is neither first nor last. Held by value because the option
    // list cannot be corrected through the API — a casing slip is a hand edit in
    // the UI plus a rewrite of every row that carries the old string.
    log("");
    log("title case, particles lowercase (the base's own convention):");
    const PARTICLES = new Set(["to", "from", "of", "on", "in", "for", "with", "at", "by"]);
    const miscased = [];
    for (const value of [...TOOL_STATUS_VALUES, ...TOOL_EVENT_VALUES]) {
        const words = value.split(" ");
        words.forEach((word, i) => {
            const isEdge = i === 0 || i === words.length - 1;
            const shouldBeLower = !isEdge && PARTICLES.has(word.toLowerCase());
            const ok = shouldBeLower ? word === word.toLowerCase() : /^[A-Z]/.test(word);
            if (!ok) miscased.push(`${value}: "${word}"`);
        });
    }
    check("words cased against the convention", miscased.length, 0);
    for (const m of miscased) log(`    ${m}`);
    assert(
        "  and the rule is seen to say NO (else it is an empty predicate)",
        !/^[A-Z]/.test("to") && PARTICLES.has("to")
    );

    // ── the mapping ─────────────────────────────────────────────────────────
    log("");
    log("every event maps into the status vocabulary:");
    const statuses = new Set(TOOL_STATUS_VALUES);
    const unmapped = TOOL_EVENT_VALUES.filter(
        (e) => !Object.prototype.hasOwnProperty.call(STATUS_AFTER_EVENT, e)
    );
    check("events with no entry in STATUS_AFTER_EVENT", unmapped.length, 0);
    for (const e of unmapped) log(`    ${e}`);

    const stray = Object.keys(STATUS_AFTER_EVENT).filter((e) => !TOOL_EVENT_VALUES.includes(e));
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
    // would ever DESIGNATE — a tool here is thrown away rather than repaired, and
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
    // of three reasons the app writes `Tool Items."Status"` itself. #335 removed the
    // event, so the null went, so the assertion had nothing left to be about. The
    // conclusion survives on the other two reasons, neither of which is checkable
    // here either — both are facts about Airtable.
    log("");
    log("every status is produced by at least one event (no dead option):");
    const produced = new Set(Object.values(STATUS_AFTER_EVENT));
    for (const status of TOOL_STATUS_VALUES) {
        const by = Object.entries(STATUS_AFTER_EVENT)
            .filter(([, s]) => s === status)
            .map(([e]) => e);
        assert(`  ${status} <- ${by.join(", ") || "NOTHING"}`, by.length > 0);
    }
    check("statuses no event produces", TOOL_STATUS_VALUES.filter((s) => !produced.has(s)).length, 0);
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
    // everything else is either a scan (named for the act) or `Registered` (named
    // for an act with no status of its own).
    log("");
    log("`Retired` is the one string both vocabularies carry:");
    const shared = TOOL_EVENT_VALUES.filter((e) => TOOL_STATUS_VALUES.includes(e));
    check("shared strings", shared.join(", "), TOOL_STATUS.RETIRED);
    check("and there is exactly one", shared.length, 1);

    log("");
    log("statusAfterEvent applies the map:");
    check("registration puts it in stock",
        statusAfterEvent(TOOL_EVENT.REGISTERED), TOOL_STATUS.IN_STOCK);
    check("a check-out sends it out",
        statusAfterEvent(TOOL_EVENT.CHECKED_OUT), TOOL_STATUS.OUT);
    check("a check-in brings it back",
        statusAfterEvent(TOOL_EVENT.CHECKED_IN), TOOL_STATUS.IN_STOCK);
    check("retiring is the only end",
        statusAfterEvent(TOOL_EVENT.RETIRED), TOOL_STATUS.RETIRED);
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
    assert("  and the throw names the module to edit", (threw || "").includes("lib/toolStatus.js"));

    // ── the other direction: what a status offers next (#362) ───────────────
    // PINNED BY VALUE, WHICH IS #351's AND #353's LESSON APPLIED BEFORE IT COULD BE
    // REPEATED A THIRD TIME. Writing this as `EVENT_OFFERED_BY_STATUS[TOOL_STATUS
    // .IN_STOCK] === TOOL_EVENT.CHECKED_OUT` is an expression over the very
    // constants under test: rename both halves and all of it passes. The literals
    // are a second path, so a rename has to reach this file in the same commit.
    log("");
    log("what each status offers next, by value:");
    check("In Stock offers", EVENT_OFFERED_BY_STATUS["In Stock"], "Checked Out");
    check("Out offers", EVENT_OFFERED_BY_STATUS["Out"], "Checked In");
    check("Retired offers", EVENT_OFFERED_BY_STATUS["Retired"], null);
    check("three entries and no more", Object.keys(EVENT_OFFERED_BY_STATUS).length, 3);

    // TOTAL OVER THE STATUS VOCABULARY. A fourth status with no entry is what this
    // catches, and it is the whole reason `Retired`'s `null` is written out rather
    // than left absent: without it, "has an entry" and "offers nothing" would be
    // one state and a new status would inherit the terminal answer in silence.
    log("");
    log("and the map is total over the status vocabulary:");
    const unofferedStatuses = TOOL_STATUS_VALUES.filter(
        (s) => !Object.prototype.hasOwnProperty.call(EVENT_OFFERED_BY_STATUS, s)
    );
    check("statuses with no entry", unofferedStatuses.length, 0);
    const strayStatuses = Object.keys(EVENT_OFFERED_BY_STATUS).filter(
        (s) => !TOOL_STATUS_VALUES.includes(s)
    );
    check("entries naming a status that does not exist", strayStatuses.length, 0);
    const badOffer = Object.values(EVENT_OFFERED_BY_STATUS).filter(
        (e) => e !== null && !TOOL_EVENT_VALUES.includes(e)
    );
    check("entries offering an event that does not exist", badOffer.length, 0);

    // THE TWO MAPS ARE NOT INVERSES, WHICH IS WHY BOTH EXIST. Two events land on
    // `In Stock`, so inverting `STATUS_AFTER_EVENT` is not a function; and
    // `Registered` is offered by no status, because registration creates the row
    // rather than moving one. A later pass tempted to derive one map from the other
    // fails here rather than shipping a screen that offers `Registered`.
    log("");
    log("the two maps are not each other's inverse:");
    const intoInStock = Object.entries(STATUS_AFTER_EVENT)
        .filter(([, s]) => s === TOOL_STATUS.IN_STOCK)
        .map(([e]) => e);
    check("events landing on In Stock", intoInStock.length, 2);
    const offered = new Set(Object.values(EVENT_OFFERED_BY_STATUS).filter(Boolean));
    assert("  so no status can offer both of them", offered.size === 2);
    assert("`Registered` is offered by no status", !offered.has(TOOL_EVENT.REGISTERED));

    // AND EVERY OFFER MOVES THE TOOL ITEM. An offer whose event leaves the status
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
    // correctable, which is the whole reason it is one press and not a modal.
    check(
        "the pair is a round trip",
        eventOfferedBy(statusAfterEvent(eventOfferedBy(TOOL_STATUS.IN_STOCK))),
        TOOL_EVENT.CHECKED_IN
    );
    check(
        "  in both directions",
        statusAfterEvent(eventOfferedBy(statusAfterEvent(eventOfferedBy(TOOL_STATUS.IN_STOCK)))),
        TOOL_STATUS.IN_STOCK
    );

    log("");
    log("eventOfferedBy applies the map:");
    check("it takes one argument", eventOfferedBy.length, 1);
    check("a stocked tool item is checked out", eventOfferedBy(TOOL_STATUS.IN_STOCK), TOOL_EVENT.CHECKED_OUT);
    check("one that is out is checked in", eventOfferedBy(TOOL_STATUS.OUT), TOOL_EVENT.CHECKED_IN);
    check("and a retired one offers nothing", eventOfferedBy(TOOL_STATUS.RETIRED), null);

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
    assert("  and the throw names the module to edit", (statusThrew || "").includes("lib/toolStatus.js"));
    // ANTI-VACUITY FOR THE `null`: "offers nothing" and "is not a status" have to be
    // two answers, or the throw above is indistinguishable from `Retired`'s entry
    // and the totality assertion is checking nothing.
    assert("  so a null answer is not how an unknown status is reported", eventOfferedBy("Retired") === null);

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
        TOOL_STATUS_VALUES.join(" | ")
    );
    check(
        "event names, in order",
        (pyEvent || []).map(([n]) => n).join(" | "),
        TOOL_EVENT_VALUES.join(" | ")
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
        ["In Stock", "blueLight2"], ["Out", "cyanLight2"], ["Retired", "grayLight2"],
    ];
    check(
        "status colors walk the palette, gray for the end",
        JSON.stringify(pyStatus), JSON.stringify(paletteRule)
    );
    const eventRule = [
        ["Registered", "blueLight2"], ["Checked Out", "cyanLight2"],
        ["Checked In", "tealLight2"], ["Retired", "grayLight2"],
    ];
    check("event colors do the same", JSON.stringify(pyEvent), JSON.stringify(eventRule));
    check("  gray marks the terminal value and nothing else",
        [...(pyStatus || []), ...(pyEvent || [])]
            .filter(([n, c]) => c === "grayLight2" && n !== "Retired").length, 0);
    check("  and no option is red any more",
        [...(pyStatus || []), ...(pyEvent || [])].filter(([, c]) => c === "redLight2").length, 0);

    log("");
    log(`  ${TOOL_STATUS_VALUES.length} statuses and ${TOOL_EVENT_VALUES.length} events, pinned in two files`);
    log("  what this CANNOT say: what the live Airtable option lists hold —");
    log("  that is scripts/tests/verify-tools-schema-334.mjs");
}

if (isMain(import.meta.url)) standalone(title, run);

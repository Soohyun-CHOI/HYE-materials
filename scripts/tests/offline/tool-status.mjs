// The tools track's two closed vocabularies, and the one mapping between them
// (#334).
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
// cannot be an Airtable formula is one entry: `Job Changed` is a last row that
// leaves the status alone. If that entry ever stops being the only `null`, the
// argument for writing the field from the app has changed and somebody should
// have to say so.
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
    STATUS_AFTER_EVENT,
    TOOL_EVENT,
    TOOL_EVENT_VALUES,
    TOOL_STATUS,
    TOOL_STATUS_VALUES,
    statusAfterEvent,
} from "../../../lib/toolStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Tool status and event vocabularies, and the map between them (#334)";

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
    log("the five statuses, in order:");
    check("TOOL_STATUS_VALUES", TOOL_STATUS_VALUES.join(" | "),
        "In Stock | Out | In Repair | Lost | Retired");
    check("five and no more", TOOL_STATUS_VALUES.length, 5);
    assert("no duplicates", new Set(TOOL_STATUS_VALUES).size === TOOL_STATUS_VALUES.length);

    log("");
    log("the eight events, in order:");
    check("TOOL_EVENT_VALUES", TOOL_EVENT_VALUES.join(" | "),
        "Checked Out | Checked In | Sent to Repair | Returned from Repair | Lost | Found | Retired | Job Changed");
    check("eight and no more", TOOL_EVENT_VALUES.length, 8);
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
    log("every event maps into the status vocabulary, or to null:");
    const statuses = new Set(TOOL_STATUS_VALUES);
    const unmapped = TOOL_EVENT_VALUES.filter(
        (e) => !Object.prototype.hasOwnProperty.call(STATUS_AFTER_EVENT, e)
    );
    check("events with no entry in STATUS_AFTER_EVENT", unmapped.length, 0);
    for (const e of unmapped) log(`    ${e}`);

    const stray = Object.keys(STATUS_AFTER_EVENT).filter((e) => !TOOL_EVENT_VALUES.includes(e));
    check("entries naming an event that does not exist", stray.length, 0);

    const badTarget = Object.entries(STATUS_AFTER_EVENT).filter(
        ([, s]) => s !== null && !statuses.has(s)
    );
    check("entries pointing outside the status vocabulary", badTarget.length, 0);
    for (const [e, s] of badTarget) log(`    ${e} -> ${JSON.stringify(s)}`);

    // THE ENTRY THE WHOLE DESIGN RESTS ON. `Tool Items."Status"` is written by this
    // app rather than computed by Airtable because turning an event into a status is
    // a mapping and not a copy — and this is the case that proves it: a last row
    // whose own name is not a status at all. A second null, or this one moving,
    // means the claim in lib/toolStatus.js's header needs re-arguing.
    log("");
    log("exactly one event leaves the status alone, and it is the job change:");
    const nulls = Object.entries(STATUS_AFTER_EVENT).filter(([, s]) => s === null).map(([e]) => e);
    check("events mapping to null", nulls.join(", "), TOOL_EVENT.JOB_CHANGED);
    check("and there is only one", nulls.length, 1);

    log("");
    log("statusAfterEvent applies it:");
    check("a job change keeps the status it found",
        statusAfterEvent(TOOL_EVENT.JOB_CHANGED, TOOL_STATUS.OUT), TOOL_STATUS.OUT);
    check("  including when the tool is retired",
        statusAfterEvent(TOOL_EVENT.JOB_CHANGED, TOOL_STATUS.RETIRED), TOOL_STATUS.RETIRED);
    check("a check-out sends it out",
        statusAfterEvent(TOOL_EVENT.CHECKED_OUT, TOOL_STATUS.IN_STOCK), TOOL_STATUS.OUT);
    check("a check-in brings it back",
        statusAfterEvent(TOOL_EVENT.CHECKED_IN, TOOL_STATUS.OUT), TOOL_STATUS.IN_STOCK);
    check("repair is its own state",
        statusAfterEvent(TOOL_EVENT.SENT_TO_REPAIR, TOOL_STATUS.OUT), TOOL_STATUS.IN_REPAIR);
    check("and returning from it is stock",
        statusAfterEvent(TOOL_EVENT.RETURNED_FROM_REPAIR, TOOL_STATUS.IN_REPAIR), TOOL_STATUS.IN_STOCK);
    // Lost is not terminal, which is the issue's own words and is the whole reason
    // `Found` exists as an event.
    check("lost is a state, not an end",
        statusAfterEvent(TOOL_EVENT.LOST, TOOL_STATUS.OUT), TOOL_STATUS.LOST);
    check("and a found tool is accounted for again",
        statusAfterEvent(TOOL_EVENT.FOUND, TOOL_STATUS.LOST), TOOL_STATUS.IN_STOCK);
    check("retired is the only end",
        statusAfterEvent(TOOL_EVENT.RETIRED, TOOL_STATUS.IN_STOCK), TOOL_STATUS.RETIRED);

    let threw = null;
    try {
        statusAfterEvent("Marked Lost", TOOL_STATUS.OUT);
    } catch (err) {
        threw = err.message;
    }
    assert("an event outside the vocabulary throws rather than no-opping", Boolean(threw));
    assert("  and the throw names the module to edit", (threw || "").includes("lib/toolStatus.js"));

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
    check("  status choices parsed", (pyStatus || []).length, 5);
    check("  event choices parsed", (pyEvent || []).length, 8);
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
    const paletteRule = [
        ["In Stock", "blueLight2"], ["Out", "cyanLight2"], ["In Repair", "tealLight2"],
        ["Lost", "redLight2"], ["Retired", "grayLight2"],
    ];
    check(
        "status colors walk the palette, red for the negative and gray for the end",
        JSON.stringify(pyStatus), JSON.stringify(paletteRule)
    );
    const eventColors = Object.fromEntries(pyEvent || []);
    check("  the event list uses the same red", eventColors["Lost"], "redLight2");
    check("  and the same gray", eventColors["Retired"], "grayLight2");
    assert(
        "  and no other event borrows either",
        (pyEvent || []).filter(([, c]) => c === "redLight2" || c === "grayLight2").length === 2
    );

    log("");
    log(`  ${TOOL_STATUS_VALUES.length} statuses and ${TOOL_EVENT_VALUES.length} events, pinned in two files`);
    log("  what this CANNOT say: what the live Airtable option lists hold —");
    log("  that is scripts/tests/verify-tools-schema-334.mjs");
}

if (isMain(import.meta.url)) standalone(title, run);

// What one tool item's page shows (#340).
//
// WHAT THIS FILE IS FOR. `logRowFacts` states which of a `Tool Log` row's five
// facts reach the screen, and four of them are invariants of the base rather
// than choices: `Event` is a closed select, `Event At` is stamped by the writer,
// `Job` is on every row and never blank — the invariant that makes the previous
// row's job the previous job, and the reason no `Former Job` is stored — and
// `Recorded By` is written on every path that appends. `Notes` is the one that is
// ordinarily absent. A change that dropped one of the four, or that rendered
// `Notes` as an empty pair, would read as a styling decision and would in fact be
// undoing one of those; nothing else in this tier would notice, because the tier
// cannot render a page.
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
import { TOOL_ITEM_COPY, logRowFacts } from "../../../lib/toolItemView.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What one tool item's page shows (#340)";

/** A row with every fact filled, which is what registration actually writes. */
const FULL_ROW = {
    event: TOOL_EVENT.REGISTERED,
    eventAt: "2026-09-09T15:14:26.537Z",
    recordedByName: "scoped-fixture",
    jobCode: "26-DEMO-01",
    notes: "Bought with the second batch",
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
        "a full row carries five, event first",
        keysOf(FULL_ROW).join(","),
        "event,eventAt,job,recordedBy,notes"
    );
    check(
        "the labels come from the copy constant",
        logRowFacts(FULL_ROW).map((f) => f.label).join(" / "),
        "Event / When / Job / Recorded by / Notes"
    );
    check(
        "and the values are the ones handed in",
        logRowFacts(FULL_ROW).map((f) => f.value).join(" / "),
        "Registered / 2026-09-09T15:14:26.537Z / 26-DEMO-01 / scoped-fixture / Bought with the second batch"
    );

    // ── 2: `Notes` is the one that drops ───────────────────────────────────
    log("");
    log("`Notes` is absent in the ordinary case and is the only fact that drops:");
    for (const [what, notes] of [
        ["undefined", undefined],
        ["null", null],
        ["an empty string", ""],
        ["only spaces", "   "],
        ["only a tab", "\t"],
    ])
        check(`  ${what} drops the pair`, keysOf({ ...FULL_ROW, notes }).length, 4);

    check("a note is trimmed rather than dropped", logRowFacts({ ...FULL_ROW, notes: "  seen  " }).at(-1).value, "seen");
    check("  and a registration row, which carries none, is four", keysOf({ ...FULL_ROW, notes: "" }).join(","), "event,eventAt,job,recordedBy");

    // ── 3: the other four never drop ───────────────────────────────────────
    log("");
    log("the other four are on every row, whatever they hold:");
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

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // Assertions 2 and 3 are counts, and a function returning a fixed list would
    // satisfy one of them however it was broken. So the two directions are proved
    // against each other on the same input.
    assert("a row with a note carries five", logRowFacts(FULL_ROW).length === 5);
    assert("  and the same row without one carries four", logRowFacts({ ...FULL_ROW, notes: "" }).length === 4);
    assert("the fifth is the note and nothing else", logRowFacts(FULL_ROW).at(-1).key === "notes");
    // The key list has to be a real reading of the returned facts rather than a
    // constant, so a reordering must be visible to it.
    assert("the key reader follows the returned order", keysOf(FULL_ROW)[0] === "event" && keysOf(FULL_ROW)[2] === "job");
    // The copy scanner is seen finding a planted bare noun, since zero is also
    // what a broken matcher reports.
    assert("the copy scanner finds a planted bare `item`", bareItemWords("Every item on this order.").length === 1);
    assert("  and does not flag `tool item` or `tool items`", bareItemWords("This tool item and those tool items.").length === 0);
}

if (isMain(import.meta.url)) await standalone(title, run);

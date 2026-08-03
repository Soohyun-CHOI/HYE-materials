// Canonical Unit list — the two hand-maintained copies must agree (#18).
//
// CLAUDE.md has recorded the risk since #83 in the only form available to it:
// a sentence in lib/units.js and another in add_unit_options.py, each asking
// the next author to remember the other. A plain Python script cannot import a
// JS module, so the duplication is structural and cannot be removed — but
// "they still match" is checkable, and this is the check. #18 made it worth
// having: Materials became the fourth table keyed on these values, and its
// natural key includes Unit, so a list that drifts out of step there does not
// merely mislabel a row, it splits one material into two cache rows.
//
// Offline-safe: lib/units.js imports nothing, and the Python side is read as
// TEXT and parsed, never executed — so this needs no Python, no credentials
// and no Airtable.
//
// What this canNOT see, by construction: what the Airtable fields actually
// hold. A choice added by hand in Airtable (this is exactly how a 20th option,
// DRUM, appeared on PR Items and on no other table) leaves both files
// untouched and passes here. That comparison needs the Metadata API and lives
// in scripts/tests/verify-unit-options-18.mjs.

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { CANONICAL_UNITS } from "../../../lib/units.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Canonical Unit list — lib/units.js vs add_unit_options.py (#18)";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY_PATH = resolve(HERE, "../../import/add_unit_options.py");

// Every table that carries the shared Unit select. Hard-coded rather than read
// from lib/airtable/client.js's TABLES, which would drag the Airtable client —
// and its throw-at-import env check — into the offline tier.
//
// A DELIBERATE SECOND COPY, and it must stay one. Reading the list out of
// add_unit_options.py and comparing it to itself would pass unconditionally;
// what this guards is a target being DROPPED from the script, which would leave
// that table's Unit field short of options with nothing to say so. So adding a
// table costs an entry here as well as there — that is the pin doing its job,
// not the pin being in the way.
const EXPECTED_TARGET_TABLES = [
    "PR Items",
    "PO Items",
    "Invoice Items",
    "Materials",
    "Delivery Items",
];

/**
 * Pull a top-level Python list literal out of the source text. Anchored to the
 * start of a line so a mention of the same name inside the module docstring or
 * inside a comprehension cannot be what gets matched.
 */
function pythonListLiteral(source, name) {
    const block = source.match(new RegExp(`^${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`, "m"));
    if (!block) return null;
    return Array.from(block[1].matchAll(/"([^"]*)"/g), (m) => m[1]);
}

export function run({ check, assert, log }) {
    const source = readFileSync(PY_PATH, "utf8");
    const pyUnits = pythonListLiteral(source, "CANONICAL_UNITS");
    const pyTables = pythonListLiteral(source, "TARGET_TABLES");

    // Do this BEFORE any comparison. If a rename or a reformat made the regex
    // miss, both extractions would come back empty and every equality below
    // would pass by comparing nothing to nothing — the failure mode this tier
    // exists to refuse. A vacuous pass is worse than no check.
    assert("parsed a non-empty CANONICAL_UNITS from add_unit_options.py", (pyUnits?.length || 0) > 0);
    assert("parsed a non-empty TARGET_TABLES from add_unit_options.py", (pyTables?.length || 0) > 0);
    assert("lib/units.js CANONICAL_UNITS is non-empty", CANONICAL_UNITS.length > 0);
    if (!pyUnits?.length || !pyTables?.length) {
        log("  -> cannot compare further; fix the parse above first");
        return;
    }

    check("same number of units in both copies", pyUnits.length, CANONICAL_UNITS.length);

    // Order too, not just membership: the two lists are read side by side by
    // anyone changing them, and a silent reordering makes a real difference
    // impossible to spot in review.
    check("same units in the same order", pyUnits.join(","), CANONICAL_UNITS.join(","));

    // A duplicate would be invisible to the comparison above if it existed on
    // both sides, and on the Python side it would quietly cost one of the
    // scratch-record writes its purpose.
    check("no duplicates in lib/units.js", new Set(CANONICAL_UNITS).size, CANONICAL_UNITS.length);
    check("no duplicates in add_unit_options.py", new Set(pyUnits).size, pyUnits.length);

    // Every value must be usable as an Airtable select option name. An empty
    // string is the specific one that matters: Materials/PR Items/PO Items all
    // omit the field rather than send "" precisely because Airtable treats it
    // as a request to create an empty option (#111).
    check(
        "no empty or untrimmed values",
        CANONICAL_UNITS.filter((u) => u !== u.trim() || u === "").length,
        0
    );

    // Pins the script's full target list. Dropping a table there would leave
    // its Unit field short of options, and no writer on this path uses
    // typecast, so the first record carrying a missing unit fails its write
    // outright rather than inventing an option — the failure is loud but it
    // lands on a user, not here.
    check(
        `add_unit_options.py targets all ${EXPECTED_TARGET_TABLES.length} Unit tables, in order`,
        pyTables.join(","),
        EXPECTED_TARGET_TABLES.join(",")
    );
}

if (isMain(import.meta.url)) standalone(title, run);

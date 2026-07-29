// Canonical Unit option list (issue #83) shared by the Unit single-select on
// PR Items, PO Items, Invoice Items and Materials (issue #18 added the
// fourth). Kept in one place so there's a single source of truth for the JS
// side rather than duplicating the 19 values per form.
//
// scripts/import/add_unit_options.py keeps its own copy of this same list
// (a plain Python script can't import a JS module) -- if this list ever
// changes, update both places. scripts/tests/offline/unit-options.mjs fails
// if they drift, so "update both places" is checked rather than remembered;
// scripts/tests/verify-unit-options-18.mjs checks the four Airtable fields
// against this list, which no file-only check can see.
export const CANONICAL_UNITS = [
    "EA", "FT", "SET", "LS", "LOT", "M", "ROLL", "PCS", "SHEET", "M/D",
    "FIT", "SQFT", "IN", "Lengths", "KG", "PSI", "TUBES", "PACK", "ST",
];

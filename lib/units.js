// Canonical Unit option list (issue #83) shared by every PR Items/PO
// Items/Invoice Items Unit dropdown in this app. Kept in one place so
// there's a single source of truth for the JS side rather than
// duplicating the 19 values per form.
//
// scripts/import/add_unit_options.py keeps its own copy of this same list
// (a plain Python script can't import a JS module) -- if this list ever
// changes, update both places.
export const CANONICAL_UNITS = [
    "EA", "FT", "SET", "LS", "LOT", "M", "ROLL", "PCS", "SHEET", "M/D",
    "FIT", "SQFT", "IN", "Lengths", "KG", "PSI", "TUBES", "PACK", "ST",
];

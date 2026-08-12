// normalizeItemText — how an item's Name and Size are stored (#18).
//
// Pinned because this function decides whether two people typing the same
// material get one Materials row or two, and because its NON-goals are as
// load-bearing as its goals. The cases below are split accordingly: what it
// unifies, and what it deliberately leaves alone. The second group is not a
// list of bugs — it is the limit of this approach, written down so the next
// person reads it here instead of assuming the normalizer is smarter than it is.
//
// lib/itemNaming.js imports nothing, which is what lets this be offline.

import { normalizeItemText } from "../../../lib/itemNaming.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Item text normalization — normalizeItemText (#18)";

export function run({ check, log }) {
    log("what it unifies:");
    check("leading/trailing space is trimmed", normalizeItemText("  Pipe  "), "Pipe");
    check("an internal run collapses to one space", normalizeItemText("SCH  40   PVC"), "SCH 40 PVC");
    check("tabs and newlines count as whitespace", normalizeItemText("Pipe\t\n 2in"), "Pipe 2in");
    check("a non-breaking space collapses too", normalizeItemText("Pipe  Elbow"), "Pipe Elbow");
    check("nullish becomes an empty string", normalizeItemText(undefined), "");
    check("null becomes an empty string, not the word", normalizeItemText(null), "");
    check("whitespace-only becomes empty", normalizeItemText("   "), "");
    check("already-clean text is untouched (idempotent)", normalizeItemText("SCH 40 PVC"), "SCH 40 PVC");
    check(
        "applying it twice changes nothing further",
        normalizeItemText(normalizeItemText("  SCH  40  ")),
        normalizeItemText("  SCH  40  ")
    );

    log("");
    log("what it deliberately does NOT do — case is preserved:");
    // This string is printed on the PO PDF sent to the vendor and the stored
    // value is the only copy, so a case pass would be an irreversible edit to a
    // document. Case-insensitivity is the lookup's job instead:
    // getMaterialByKey compares LOWER(TRIM(...)) on both sides.
    check("upper-case abbreviations survive", normalizeItemText("SCH 40 PVC"), "SCH 40 PVC");
    check("mixed case survives", normalizeItemText("304SS Nipple"), "304SS Nipple");
    check("it does not title-case", normalizeItemText("npt coupling"), "npt coupling");
    check(
        "two spellings differing only by case stay different strings",
        normalizeItemText("PVC Pipe") === normalizeItemText("pvc pipe"),
        false
    );

    log("");
    log("what it does NOT unify at all — these still make separate materials:");
    // Each of these is a real way the same physical item gets typed twice. None
    // is solved by whitespace normalization, and none should be guessed at by
    // string rules: an item catalog with a dropdown is what actually fixes
    // them. Stated as cases so the limit is visible rather than assumed.
    check(
        "abbreviations: inch vs in vs \"",
        new Set(['2 inch Pipe', '2 in Pipe', '2" Pipe'].map(normalizeItemText)).size,
        3
    );
    check(
        "word order",
        normalizeItemText("SCH 40 PVC Pipe") === normalizeItemText("PVC Pipe SCH 40"),
        false
    );
    check(
        "singular vs plural",
        normalizeItemText("Elbow") === normalizeItemText("Elbows"),
        false
    );
    check(
        "punctuation and hyphens",
        normalizeItemText("SCH-40") === normalizeItemText("SCH 40"),
        false
    );
    check(
        "a typo is still a different material",
        normalizeItemText("Coupling") === normalizeItemText("Couplng"),
        false
    );
}

if (isMain(import.meta.url)) standalone(title, run);

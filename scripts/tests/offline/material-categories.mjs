// The committed category tree, and the label rule over it (#354).
//
// WHAT THIS TIER CAN AND CANNOT SEE HERE. The label a category actually carries
// is an Airtable formula, so nothing in this directory has ever computed one and
// nothing here can — that comparison is `verify-material-categories-354.mjs`,
// which reads live rows. What IS reachable is the other half of the pair: the
// committed CSV, the JS implementation of the rule, and the formula TEXT that
// `lib/materialCategory.js` generates from the same constants. So this file
// holds the source of the tree against the rule, and the rule against the text
// the base is given; the credentialed check holds the text against what the base
// then computes.
//
// THE CSV IS AN INPUT TO THE BASE, WHICH IS WHY ITS SHAPE IS ASSERTED AT ALL.
// 427 of the 777 rows carry a leading zero at every level, and a code column
// read as a number turns `01` into `1` and misfiles everything under it. Nothing
// downstream would say so: the import writes strings, Airtable stores strings,
// and the wrong string looks exactly like the right one. So the leading zeros
// are asserted where they can still be seen as text.
//
// THE NON-NESTING ASSERTION IS THE ODD ONE AND IT IS DELIBERATE. It states that
// the codes are NOT hierarchical — 11 of 777 rows have a leaf code that does not
// begin with its parent's — because the tempting implementation of "find the
// categories under this branch" is to slice a code, and it would silently lose
// those 11. A category is narrowed by its stored level columns. If HQ ever
// regularizes the tree this assertion fails, which is the right outcome: the
// decision to read codes as hierarchical should be taken, not inherited.
//
// THE CSV GAINED TWO COLUMNS IN #415 AND ONLY ONE OF THEM REACHES THE BASE.
// `Item Name` is the readable name of each leaf and is imported into a stored
// text field; `Template` records which of the eight shapes HQ wrote that name
// with. **`Template` IS PROVENANCE FOR WHOEVER MAINTAINS THE CATALOG AND NOT A
// VALUE THIS APP HAS ANY READING OF** — it is carried in the committed file on
// purpose and left out of the import on purpose, so the assertion below exists to
// stop the next reader concluding the import forgot it. The name itself is stored
// rather than composed because those eight templates are not one rule: `Tube, SUS
// 304, AP` takes three levels in order, `Tank Fabrication & Installation, Custom
// Fabrication & Delivery` takes two out of order, and others append a word no
// level holds.
//
// AND THE TWO PROPERTIES THE NAME HAS TO KEEP ARE HELD HERE (#415): every row
// names something, and no two rows name the same thing. The second is the new
// invariant — a screen can call a material by one name only if one name picks out
// one category — and #416 builds on it. Both are shown to fail under a mutation
// below, because "every row has a name" and "the traversal found no rows" are the
// same result.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    CATEGORY_ITEM_NAME,
    CATEGORY_LABEL_FORMULA,
    CATEGORY_LABEL_SEPARATOR,
    CATEGORY_LABEL_SKIPPED,
    CATEGORY_LEAF_CODE,
    CATEGORY_LEVELS,
    composeCategoryLabel,
} from "../../../lib/materialCategory.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Material categories — the committed tree and its label (#354)";

const CSV_PATH = "scripts/import/material_categories.csv";

// Resolved here rather than through `_ast.mjs:repoPath`, which would pull acorn
// in for a check that parses no JavaScript.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * The figures are typed out rather than derived from the file, so a change to
 * the tree changes them in the same commit — the rule
 * `offline/tool-label-sheet.mjs` sets for a value a check could otherwise
 * restate from its own input and always agree with.
 */
const ROWS = 777;
const CODE_WIDTHS = [2, 4, 7, 10];
const ROWS_WITH_A_LEADING_ZERO = 427;
const ROWS_WHOSE_CODES_DO_NOT_NEST = 11;
const NAMES_WITH_A_SPACED_SLASH = 28;
/** The top of HQ's own leaf numbering, against the 901 a branch-made path starts at. */
const HIGHEST_HQ_LEAF_TAIL = 33;
/** Of the 11 rows breaking prefix nesting, the ones that break it at the LEAF. */
const LEAVES_NOT_PREFIXED = 2;
/**
 * The column the CSV carries and the base does not (#415) — which of HQ's eight
 * templates produced that row's `Item Name`. Named here rather than inline so the
 * assertion that nothing imports it can name the same string it checks for.
 */
const CSV_PROVENANCE_COLUMN = "Template";
const CSV_TEMPLATE_SHAPES = 8;
/** Rows whose readable name happens to equal their composed label (#415). */
const NAMES_EQUAL_TO_THEIR_LABEL = 12;

/**
 * RFC 4180 enough for this file: quoted cells, embedded commas, CRLF.
 *
 * EXPORTED FOR `seed-categories.mjs` RATHER THAN COPIED, and the copy is what
 * that check tried first: a naive `split(",")` reads the leaf-code column off by
 * however many commas the NAME columns before it contain, so `0108042001` came
 * back as a code the catalog does not have. 28 names carry a comma or a slash.
 * One parser, two readers.
 */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c !== '"') cell += c;
            else if (text[i + 1] === '"') { cell += '"'; i++; }
            else quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === ",") { row.push(cell); cell = ""; }
        else if (c === "\r") continue;
        else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
        else cell += c;
    }
    if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
    return rows;
}

export function run({ check, log }) {
    const text = readFileSync(join(REPO_ROOT, CSV_PATH), "utf8");
    const parsed = parseCsv(text);
    const header = parsed[0];
    const cells = parsed.slice(1).filter((r) => r.some((c) => c !== ""));
    const rows = cells.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));

    const levelColumns = CATEGORY_LEVELS.flatMap((l) => [l.code, l.name]);
    const codeColumns = CATEGORY_LEVELS.map((l) => l.code);
    const nameColumns = CATEGORY_LEVELS.map((l) => l.name);
    // The level names AND the leaf's own readable name. SEPARATE FROM
    // `nameColumns` rather than folded into it, because the assertions below
    // about the label are about the four LEVELS the label is composed from —
    // widening that list made the spaced-slash census read 62 and the formula
    // coverage read false, both correctly, and both about a column the label
    // never touches. The whitespace rule is the one that really is about all
    // five.
    const typedColumns = [...nameColumns, CATEGORY_ITEM_NAME];
    const columns = [CATEGORY_ITEM_NAME, ...levelColumns, CSV_PROVENANCE_COLUMN];

    log("the committed source:");
    check(`${CSV_PATH} parses to ${ROWS} rows`, rows.length, ROWS);
    check("its header is the ten columns, in order", header.join(","), columns.join(","));
    check(
        "every cell of every row is filled",
        cells.filter((r) => r.length === columns.length && r.every((c) => c !== "")).length,
        ROWS
    );
    check(
        "no name carries leading, trailing or doubled whitespace",
        rows.filter((r) => typedColumns.some((c) => r[c] !== r[c].trim() || /\s{2}/.test(r[c]))).length,
        0
    );

    log("");
    log("the readable name, and the two properties it has to keep (#415):");
    const itemNames = rows.map((r) => r[CATEGORY_ITEM_NAME]);
    check("every row names something", itemNames.filter((n) => n.trim() !== "").length, ROWS);
    check("and no two rows name the same thing", new Set(itemNames).size, ROWS);
    // WHY THE NAME IS STORED AND NOT A SECOND FORMULA, asserted rather than
    // claimed. If the label rule produced it, this count would be `ROWS`. The 12
    // that DO agree are the rows whose label collapses to one segment — `PFA`,
    // `Aluminum`, `Chemicals` — so the agreement is a coincidence of short paths
    // and not a rule with exceptions. The figure is typed out for the reason the
    // others in this file are: a change to the catalog changes it in the same
    // commit rather than being restated from the input and always agreeing.
    check(
        "the label rule does not produce the name",
        rows.filter((r) => r[CATEGORY_ITEM_NAME] === composeCategoryLabel(r)).length,
        NAMES_EQUAL_TO_THEIR_LABEL
    );
    check(
        "  so most rows name something the path does not",
        rows.filter((r) => r[CATEGORY_ITEM_NAME] !== composeCategoryLabel(r)).length,
        ROWS - NAMES_EQUAL_TO_THEIR_LABEL
    );
    // THE MUTANTS, BUILT AND RUN. "Every row names something" and "the traversal
    // found no rows" are the same result, and a duplicate is the failure that
    // looks exactly like healthy data — neither assertion above can be trusted
    // until it is seen to fail.
    const blanked = itemNames.map((n, i) => (i === 0 ? "" : n));
    check("a blanked name fails the first", blanked.filter((n) => n.trim() !== "").length === ROWS, false);
    const duplicated = itemNames.map((n, i) => (i === 0 ? itemNames[1] : n));
    check("a duplicated name fails the second", new Set(duplicated).size === ROWS, false);
    check("  and the real column passes both", itemNames.filter((n) => n.trim() !== "").length === ROWS && new Set(itemNames).size === ROWS, true);

    // THE COLUMN THAT IS CARRIED AND NOT IMPORTED — see the header. It is named
    // here so a reader meeting it in the CSV is told it is deliberate rather than
    // concluding the import dropped it.
    check(`${CSV_PROVENANCE_COLUMN} is in the file`, header.includes(CSV_PROVENANCE_COLUMN), true);
    check(
        "  and nothing in the module names it, so nothing imports it",
        [CATEGORY_ITEM_NAME, CATEGORY_LEAF_CODE, ...levelColumns].includes(CSV_PROVENANCE_COLUMN),
        false
    );
    check(
        `  it carries ${CSV_TEMPLATE_SHAPES} shapes, which is why the name is stored and not composed`,
        new Set(rows.map((r) => r[CSV_PROVENANCE_COLUMN])).size,
        CSV_TEMPLATE_SHAPES
    );

    log("");
    log("the codes are text, and the leading zeros are the reason:");
    for (const [index, level] of CATEGORY_LEVELS.entries()) {
        check(
            `${level.code} is ${CODE_WIDTHS[index]} digits on every row`,
            rows.filter((r) => r[level.code].length === CODE_WIDTHS[index] && /^\d+$/.test(r[level.code])).length,
            ROWS
        );
    }
    check(
        "rows whose every code begins with a zero",
        rows.filter((r) => codeColumns.every((c) => r[c].startsWith("0"))).length,
        ROWS_WITH_A_LEADING_ZERO
    );

    log("");
    log("the leaf code is the natural key, and it is not a path:");
    check("Level 4 Code is the leaf", CATEGORY_LEAF_CODE, "Level 4 Code");
    check(
        "every leaf code is distinct",
        new Set(rows.map((r) => r[CATEGORY_LEAF_CODE])).size,
        ROWS
    );
    // Stated as a count so it cannot pass by finding nothing, and named in the
    // log so the next reader can go and look at them.
    const notNested = rows.filter(
        (r) =>
            !r["Level 2 Code"].startsWith(r["Level 1 Code"]) ||
            !r["Level 3 Code"].startsWith(r["Level 2 Code"]) ||
            !r["Level 4 Code"].startsWith(r["Level 3 Code"])
    );
    check(
        "a code does NOT encode its ancestors — slicing one is not a way to reach a parent",
        notNested.length,
        ROWS_WHOSE_CODES_DO_NOT_NEST
    );
    log(`  the ${notNested.length} are: ${notNested.map((r) => r[CATEGORY_LEAF_CODE]).join(", ")}`);

    log("");
    log("the 900 block a branch-made path uses is free, which is the premise:");
    // WHAT IS ASSERTED IS THE PREMISE, NOT THE PRACTICE, and the distinction is
    // the whole judgment here. The convention — a path added by this branch takes
    // its parent's code plus a three-digit number from 901 — is something we
    // keep, not something the data has; asserting it against live rows would be
    // a false claim about HQ's tree the day HQ uses the range. What IS a
    // property of the committed file is that the range is free, and that is the
    // only thing the convention rests on. So this fails exactly when a future
    // import from HQ reaches into the block, which is the moment to re-decide
    // rather than a moment to paper over.
    const tails = rows.map((r) => Number(r[CATEGORY_LEAF_CODE].slice(-3)));
    check("every leaf code ends in three digits", tails.every(Number.isFinite), true);
    check(
        "no committed leaf code uses the 900 block",
        tails.filter((n) => n >= 900).length,
        0
    );
    // Typed out rather than derived, so a tree that grows into the range moves
    // this number in the same commit. The margin is the point: 33 against 901 is
    // not a near miss.
    check("the highest last-three HQ uses", Math.max(...tails), HIGHEST_HQ_LEAF_TAIL);
    // The convention appends to the parent's code, so every path this branch
    // adds is prefixed by its level-3 code — which makes the leaf level MORE
    // conformant rather than adding an exception to the 11 above.
    check(
        "leaf codes not prefixed by their level-3 code",
        rows.filter((r) => !r["Level 4 Code"].startsWith(r["Level 3 Code"])).length,
        LEAVES_NOT_PREFIXED
    );

    log("");
    log("the rule, on values rather than on the constants that hold it:");
    const path = (...names) => Object.fromEntries(nameColumns.map((c, i) => [c, names[i]]));
    check(
        "all four levels join when all four differ",
        composeCategoryLabel(path("PVC", "Pipe", "SCH80", "Socket")),
        "PVC > Pipe > SCH80 > Socket"
    );
    check(
        "a level reading Standard drops out",
        composeCategoryLabel(path("PVC", "Fitting", "Standard", "Socket")),
        "PVC > Fitting > Socket"
    );
    check(
        "a level reading Other drops out",
        composeCategoryLabel(path("PVC", "Fitting", "Other", "Socket")),
        "PVC > Fitting > Socket"
    );
    check(
        "a level repeating the one before it drops out",
        composeCategoryLabel(path("PVC", "Pipe", "Pipe", "Socket")),
        "PVC > Pipe > Socket"
    );
    check(
        "a blank level drops out",
        composeCategoryLabel(path("PVC", "Pipe", "", "Socket")),
        "PVC > Pipe > Socket"
    );
    // The clause the two readings of the rule disagree about: Level 3 is
    // dropped as Standard, so Level 4 is compared against Level 2 — the segment
    // last KEPT — and drops too. Comparing against the previous LEVEL would
    // emit `PVC > Pipe > Pipe`.
    check(
        "a level repeating the last one KEPT drops out, across a dropped level",
        composeCategoryLabel(path("PVC", "Pipe", "Standard", "Pipe")),
        "PVC > Pipe"
    );
    check(
        "the first level is kept even when it reads Standard",
        composeCategoryLabel(path("Standard", "Pipe", "SCH80", "Socket")),
        "Standard > Pipe > SCH80 > Socket"
    );

    log("");
    log("the rule over the committed tree:");
    const labels = rows.map(composeCategoryLabel);
    check("every label is distinct", new Set(labels).size, ROWS);
    check("no label is empty", labels.filter((l) => l !== "").length, ROWS);
    // Anti-vacuity for everything above: if the parse had produced undefined
    // cells, or the rule had stopped dropping anything, these would move.
    check("some label is shorter than four segments", labels.some((l) => l.split(CATEGORY_LABEL_SEPARATOR).length < 4), true);
    check("some label is four segments", labels.some((l) => l.split(CATEGORY_LABEL_SEPARATOR).length === 4), true);
    for (const word of ["Standard", "Other"]) {
        check(
            `the tree really contains ${word}, so its clause is exercised`,
            rows.some((r) => nameColumns.some((c) => r[c] === word)),
            true
        );
    }

    log("");
    log("the separator, and why it is not a slash:");
    check("the separator is a spaced angle bracket", CATEGORY_LABEL_SEPARATOR, " > ");
    check(
        "no name contains an angle bracket, so the join is injective",
        rows.filter((r) => nameColumns.some((c) => r[c].includes(">"))).length,
        0
    );
    check(
        "distinct names that DO contain a spaced slash",
        new Set(rows.flatMap((r) => nameColumns.map((c) => r[c])).filter((n) => n.includes(" / "))).size,
        NAMES_WITH_A_SPACED_SLASH
    );

    log("");
    log("the formula text handed to the base says what the rule says:");
    check("it is generated, not typed — every level name appears", nameColumns.every((c) => CATEGORY_LABEL_FORMULA.includes(`{${c}}`)), true);
    check("no level CODE reaches the label", codeColumns.some((c) => CATEGORY_LABEL_FORMULA.includes(`{${c}}`)), false);
    check("it carries the separator", CATEGORY_LABEL_FORMULA.includes('" > "'), true);
    for (const word of ["Standard", "Other"]) {
        check(`it drops ${word}`, CATEGORY_LABEL_FORMULA.includes(`"${word}"`), true);
    }
    // Every string literal in the formula, paired left to right — the text
    // contains no escaped quote, so this is exact. `""` is the blank guard and
    // the empty branch of each IF; everything else must be the separator or a
    // skipped word, or the base is being told to drop something the rule does
    // not drop.
    const quoted = [...CATEGORY_LABEL_FORMULA.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    check(
        "it names no string the rule does not name",
        quoted.filter(
            (s) => s !== "" && s !== CATEGORY_LABEL_SEPARATOR && !CATEGORY_LABEL_SKIPPED.includes(s)
        ).length,
        0
    );
    check("and it does name some", quoted.length > 0, true);
    check("the two words are the whole skip list", CATEGORY_LABEL_SKIPPED.join(","), "Standard,Other");
}

if (isMain(import.meta.url)) standalone(title, run);

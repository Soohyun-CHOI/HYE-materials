// No repository reference names a table or field the base does not have (#280).
//
// A TABLE OR FIELD RENAME HAS A WINDOW, AND THIS FILE IS WHAT CLOSES IT. `TABLES`
// holds display NAMES — `DISCIPLINES: "Disciplines"` — so `base(TABLES.DISCIPLINES)`
// resolves by text, and so does every `record.get("Discipline Name")`. Rename the
// base and the repository is wrong until it follows; rename the repository and it is
// wrong until the base does. #280's whole procedure is that both halves ship in one
// commit, which keeps the window on one developer's machine.
//
// WHAT MAKES THAT WINDOW DANGEROUS IS THAT `npm test` CANNOT SEE IT. No file under
// `scripts/tests/offline/` imports anything from `lib/airtable/` — that is the tier
// boundary `verification.md` states, since `client.js` throws at module load without
// credentials — so nothing here has ever consulted the base and nothing here can.
// **MEASURED DURING #280: with all five base renames applied and the repository
// untouched, `npm test` passed 3019 of 3019 checks across 50 files while
// `base("Lines")` returned 403 on every one of the five paths that read it.** Green
// is blind in both directions: source consistent with itself says nothing about
// source consistent with the base.
//
// SO THIS CHECK ASKS THE ONE QUESTION THE TIER CAN ANSWER — is any SUPERSEDED name
// still used as a table or field reference? It cannot ask whether the base agrees
// (that needs credentials, and `verify-*` is where that lives); it can hold that no
// revision of this repository names something a previous rename removed. That turns
// a runtime-only failure into a failing check, which is the difference between a
// sweep proved and a sweep claimed.
//
// IT IS A DIFFERENT AXIS FROM `offline/line-vocabulary.mjs`, and both are needed.
// That file asks what a WORD is allowed to mean, over copy, prose and identifiers.
// This one asks what a STRING is allowed to address, over the positions where a
// string reaches Airtable. A comment may cite `Lines` as the name a table used to
// have — this file's own header does — and that must not fail; a `record.get("Line
// Name")` must.
//
// THE SUPERSEDED LIST IS THE FILE'S WHOLE JUDGMENT, and it grows by one entry per
// rename rather than being derived: what a name was BEFORE is not recoverable from
// the tree, which is exactly why the check is possible at all. Each entry carries
// the issue that retired it.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { listJsFiles, parseFile, parseSource, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "No reference names a retired table or field (#280)";

/** Where a string reaches Airtable, and nothing else, over `app/` + `lib/`. */
const SCANNED_DIRS = ["app", "lib"];

/**
 * Names the base no longer has, with what retired each.
 *
 * `Line 1` and `Line 2` are NOT here and must never be: they are live `Addresses`
 * fields whose names merely start with the same word.
 */
const RETIRED = {
    Lines: "#280 — the table is `Disciplines`",
    "Line Name": "#280 — the field is `Discipline Name`",
    "Line Label": "#280 — the field is `Discipline Label`",
    Line: "#280 — the `Purchase Requests` link is `Discipline`",
};

/**
 * The names a reference may use, parsed out of `TABLES` rather than imported.
 *
 * Same reason `line-vocabulary.mjs` parses it: `lib/airtable/client.js` throws at
 * module load without credentials.
 */
export function tableNamesFromSource(relPath = "lib/airtable/client.js") {
    const names = [];
    let ast;
    try {
        ({ ast } = parseFile(relPath));
    } catch {
        return names;
    }
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== "TABLES" || node.init?.type !== "ObjectExpression") return;
        for (const prop of node.init.properties) {
            if (prop.value?.type === "Literal" && typeof prop.value.value === "string") {
                names.push(prop.value.value);
            }
        }
    });
    return names;
}

/**
 * Every string in a position that ADDRESSES Airtable, with its file and line.
 *
 * FIVE POSITIONS, WHICH IS THE ENUMERATION `airtable-access.md` ALREADY MAKES: "the
 * only thing a rename breaks is a string literal in this repo, and those are
 * enumerable: `record.get("...")`, a `filterByFormula` fragment, a `fields:`
 * projection, a `parentLinkFieldName`." This adds the sixth the base-name half
 * needs — a table argument — and drops nothing.
 *
 *   1  `base(X)` / `findByRecordIds(X, …)` / `findChildRecords(X, …)` /
 *      `findByFieldValues(X, …)` / `getLinkedRecords(…, X, Y)` — a table.
 *   2  `record.get("…")` — a field.
 *   3  a `fields:` array of field names.
 *   4  a `filterByFormula` string, where a field appears as `{Name}`.
 *   5  an object key written as a string literal in a `create`/`update` payload.
 *
 * POSITION 5 IS THE LOOSE ONE and it is loose on purpose: a quoted key anywhere is
 * collected, because `{ "Discipline Name": x }` is indistinguishable from any other
 * quoted key without knowing the call it sits in. The cost is over-collection, which
 * costs nothing here — a quoted key that happens to equal a retired name is worth a
 * second look wherever it is.
 */
export function airtableStrings(relPath) {
    try {
        const { ast, source } = parseFile(relPath);
        return collect(ast, source);
    } catch {
        return [];
    }
}

/** The same collector over a source string, so its positions can be proved. */
export function airtableStringsFromSource(source) {
    return collect(parseSource(source).ast, source);
}

function collect(ast, source) {
    const out = [];
    const lineOf = (offset) => source.slice(0, offset).split("\n").length;
    const add = (value, node, position) => {
        if (typeof value === "string") out.push({ value, position, line: lineOf(node.start) });
    };

    const TABLE_ARG_FIRST = new Set([
        "base",
        "findByRecordIds",
        "findChildRecords",
        "findByFieldValues",
    ]);

    walk(ast, (node) => {
        // 1 — a table argument.
        if (node.type === "CallExpression") {
            const name =
                node.callee?.type === "Identifier"
                    ? node.callee.name
                    : node.callee?.property?.name;
            if (TABLE_ARG_FIRST.has(name)) {
                const a = node.arguments?.[0];
                if (a?.type === "Literal") add(a.value, a, `${name}() table`);
            }
            if (name === "getLinkedRecords") {
                for (const a of node.arguments || []) {
                    if (a?.type === "Literal") add(a.value, a, "getLinkedRecords() name");
                }
            }
            // 2 — record.get("Field")
            if (name === "get") {
                const a = node.arguments?.[0];
                if (a?.type === "Literal") add(a.value, a, "record.get()");
            }
        }
        // 3 and 4 and 5 — a `fields:` array, a formula string, a quoted key.
        if (node.type === "Property") {
            const key = node.key?.name ?? node.key?.value;
            if (key === "fields" && node.value?.type === "ArrayExpression") {
                for (const el of node.value.elements || []) {
                    if (el?.type === "Literal") add(el.value, el, "fields: projection");
                }
            }
            if (key === "filterByFormula") {
                walk(node.value, (n) => {
                    if (n.type === "Literal" && typeof n.value === "string") {
                        for (const m of n.value.matchAll(/\{([^}]+)\}/g)) {
                            out.push({
                                value: m[1],
                                position: "filterByFormula field",
                                line: lineOf(n.start),
                            });
                        }
                    } else if (n.type === "TemplateElement") {
                        for (const m of (n.value.cooked ?? "").matchAll(/\{([^}]+)\}/g)) {
                            out.push({
                                value: m[1],
                                position: "filterByFormula field",
                                line: lineOf(node.start),
                            });
                        }
                    }
                });
            }
            if (node.key?.type === "Literal" && typeof node.key.value === "string") {
                add(node.key.value, node.key, "quoted payload key");
            }
        }
    });
    return out;
}

export function run({ check, assert, log }) {
    const files = SCANNED_DIRS.flatMap((dir) =>
        listJsFiles(repoPath(dir)).map((abs) => abs.split("\\").join("/"))
    );
    const rel = (abs) => abs.slice(abs.indexOf("/" + SCANNED_DIRS[0] + "/") + 1) || abs;

    const collected = [];
    for (const abs of files) {
        const relPath = abs.slice(abs.lastIndexOf("/app/") >= 0 ? abs.lastIndexOf("/app/") + 1 : 0);
        const path = relPath.includes("/lib/")
            ? relPath.slice(relPath.lastIndexOf("/lib/") + 1)
            : relPath;
        for (const s of airtableStrings(path)) collected.push({ ...s, file: path });
    }

    // ── anti-vacuity, first ─────────────────────────────────────────────────
    // "No retired name is referenced" and "no reference was read" are the same
    // result, so the collector has to be seen working before its answer means
    // anything. Each of the positions it claims is proved on a live name.
    log("the collector reaches every position it claims:");
    assert(`walked ${files.length} files under ${SCANNED_DIRS.join(" + ")}`, files.length > 100);
    assert(`collected ${collected.length} Airtable references`, collected.length > 200);
    const positions = new Set(collected.map((c) => c.position));
    for (const p of ["record.get()", "quoted payload key", "fields: projection", "filterByFormula field"]) {
        assert(`  ${p} is reached in the real tree`, positions.has(p));
    }
    // A LITERAL TABLE ARGUMENT IS PROVED ON A SNIPPET, BECAUSE THE TREE HAS NONE —
    // every `base(...)` in this repo passes `TABLES.X`, which is the property that
    // makes one constant the single place a table is named. The position still has to
    // be watched: `base("Disciplines")` is what somebody writes in a hurry, and it
    // would be invisible to a check that only ever saw the shapes already present.
    // So the matcher is exercised where the answer is known instead.
    const probe = airtableStringsFromSource(
        [
            'base("Lines").select();',
            'findByRecordIds("Lines", ids);',
            'getLinkedRecords("Lines", id, "Purchase Requests", T);',
        ].join("\n")
    );
    const probePositions = new Set(probe.map((c) => c.position));
    assert("  base() table is reached, on a snippet", probePositions.has("base() table"));
    assert(
        "  and so are the batched readers",
        probePositions.has("findByRecordIds() table") &&
            probePositions.has("getLinkedRecords() name")
    );
    assert(
        "  and the snippet's names are the retired ones this rule is about",
        probe.filter((c) => RETIRED[c.value]).length >= 3
    );
    assert("  no literal table argument in the real tree", !positions.has("base() table"));
    // And on LIVE names, so the collector is reading the real tree rather than
    // returning something that happens to satisfy a lookup.
    const values = new Set(collected.map((c) => c.value));
    assert("  and it sees live names", values.has("Disciplines") && values.has("Discipline Name"));
    assert("  including one on another table", values.has("Item Name") || values.has("Qty"));

    // ── the rule ────────────────────────────────────────────────────────────
    log("");
    log("no reference names a table or field a rename retired:");
    const hits = collected.filter((c) => RETIRED[c.value]);
    for (const h of hits) {
        log(`  ${h.file}:${h.line}  [${h.position}]  ${JSON.stringify(h.value)}  — ${RETIRED[h.value]}`);
    }
    check("references to a retired name", hits.length, 0);
    // The matcher has to be seen to say YES, or the pass above is a pass of an empty
    // predicate. Planted rather than found: `Line Name` is in `RETIRED`, so a
    // reference carrying it is what a regression looks like.
    assert(
        "  a planted reference to a retired field is caught",
        [{ value: "Line Name" }].filter((c) => RETIRED[c.value]).length === 1
    );
    assert(
        "  and a live field of the same table is not",
        !RETIRED["Discipline Name"] && !RETIRED["Line 1"] && !RETIRED["Line 2"]
    );

    // ── every retired name has a live replacement in TABLES or in the tree ──
    // What stops `RETIRED` becoming a list of words nobody can act on: the entry
    // says what the name IS now, and for a table that name has to be in `TABLES`.
    log("");
    log("each retired table name has a live successor:");
    const tables = tableNamesFromSource();
    assert(`parsed ${tables.length} names out of TABLES without importing it`, tables.length >= 20);
    assert("  and the parse resolves real names", tables.includes("Disciplines"));
    const stillPresent = Object.keys(RETIRED).filter((n) => tables.includes(n));
    check(
        `retired names still in TABLES${stillPresent.length ? ` (${stillPresent.join(", ")})` : ""}`,
        stillPresent.length,
        0
    );

    log("");
    log(
        `  ${Object.keys(RETIRED).length} retired names, ${collected.length} references ` +
            `read across ${files.length} files`
    );
    log("  what this CANNOT say: whether the base agrees — no offline check reads it");
}

if (isMain(import.meta.url)) standalone(title, run);

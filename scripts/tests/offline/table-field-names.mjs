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
// #333 ADDED A SECOND RULE, AND IT IS ABOUT THE CONSTANT RATHER THAN THE NAME. Every
// `TABLES` key is the SCREAMING_SNAKE of its own value, 22 of 22, and a table rename
// is precisely when that stops being true: `EDIT_LOG: "PR Edit Log"` addresses the
// right table, resolves, and passes everything above while telling every reader of
// `TABLES.EDIT_LOG` that the base has a table called `Edit Log`. The key is derived
// from the value here rather than listed, so the rule is applied and not restated.
// It cannot ask the thing #333 actually decided — that a child table is named for
// its parent — because nothing in the tree says which table is whose child.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { listJsFiles, parseFile, parseSource, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "No reference names a retired table or field (#280, #333)";

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
    // #318 — THE FIRST ENTRY HERE THAT IS A DELETION RATHER THAN A RENAME, and it is
    // the same question either way: does any reference address a name the base does
    // not have. `Invoices."Paid"` was a checkbox beside `Paid Date`, and a date is the
    // whole of the payment now — so a reader of the flag would judge every invoice
    // unpaid, silently, on a base where no record disagrees today.
    //
    // `Paid Date` is NOT here and must never be: it is the live field this replaced
    // the flag with, and it merely starts with the same word — the trap `Line 1` and
    // `Line 2` already document one entry up.
    Paid: "#318 — the fact is `Paid Date`; there is no flag",
    // #333 — TWO TABLES AND SEVEN NAMES, WHICH IS WHAT A CHILD-TABLE RENAME COSTS.
    // A table's own name is one entry; what travels with it is its primary field and
    // every reverse link naming it, and those live on OTHER tables — two on
    // `Purchase Requests`, three on `Users` — which is exactly the set a sweep that
    // greps only the renamed table's own file would miss. One of the five, `Users."PR
    // Edit Requests (Sent To)"`, is read by `recordToUser` and feeds `canViewPR`
    // clause 6, so missing it would have refused a signer their own request.
    //
    // `PR Edit Requests`, `PR Edit Log` and their `… ID` fields are NOT here and must
    // never be: they are the live successors, and `Edit Log` is the substring trap
    // `Line 1` documents at the top — a reference to `PR Edit Log` contains it, which
    // is why every entry here is matched whole rather than by prefix.
    "Correction Requests": "#333 — the table is `PR Edit Requests`",
    "Correction Request ID": "#333 — the field is `PR Edit Request ID`",
    "Correction Requests (Sent To)": "#333 — the `Users` link is `PR Edit Requests (Sent To)`",
    "Correction Requests (Initiated)": "#333 — the `Users` link is `PR Edit Requests (Initiated)`",
    "Edit Log": "#333 — the table is `PR Edit Log`",
    "Edit Log ID": "#333 — the field is `PR Edit Log ID`",
};

/**
 * The names a reference may use, parsed out of `TABLES` rather than imported.
 *
 * Same reason `line-vocabulary.mjs` parses it: `lib/airtable/client.js` throws at
 * module load without credentials.
 */
export function tableNamesFromSource(relPath = "lib/airtable/client.js") {
    return tableEntriesFromSource(relPath).map((e) => e.value);
}

/**
 * The same literal, as `{ key, value }` pairs — what the key rule below needs.
 *
 * Split out rather than inlined because a name and its constant are two questions:
 * everything above asks whether a NAME is live, and the rule at the bottom asks
 * whether the KEY still spells it.
 */
export function tableEntriesFromSource(relPath = "lib/airtable/client.js") {
    const entries = [];
    let ast;
    try {
        ({ ast } = parseFile(relPath));
    } catch {
        return entries;
    }
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== "TABLES" || node.init?.type !== "ObjectExpression") return;
        for (const prop of node.init.properties) {
            const key = prop.key?.name ?? prop.key?.value;
            if (prop.value?.type === "Literal" && typeof prop.value.value === "string") {
                entries.push({ key, value: prop.value.value });
            }
        }
    });
    return entries;
}

/** `PR Edit Requests` → `PR_EDIT_REQUESTS`. The whole of the key convention. */
export function keyForTableName(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

/**
 * Every `TABLES.<KEY>` a file names, with its line.
 *
 * THIS EXISTS BECAUSE THE POSITIONS ABOVE CANNOT SEE A TABLE THIS REPOSITORY
 * ADDRESSES CORRECTLY (#333). `base(TABLES.X)` is the shape every call site in this
 * repo uses — the anti-vacuity below asserts there is no literal table argument
 * anywhere — so the collector that catches a retired NAME never reads a table
 * reference at all. What it misses is the same defect one indirection up: a rename
 * moves the `TABLES` key, and a call site left on the old key is `base(undefined)`.
 *
 * IT WAS A LIVE DEFECT IN #333's OWN BRANCH, which is why the check is here rather
 * than proposed. `TABLES.EDIT_LOG` survived in `editAndContinueAction`'s rollback,
 * where the whole offline tier passed 3469 of 3469 over it: `npm test` never
 * evaluates `TABLES`, `client-import-safety.mjs` only walks imports, and the
 * `TABLES.X` resolution in `id-sequence.mjs` covers `generateChildId` call sites
 * only. The path it sat on is a rollback, so it would have run first on a failed
 * Edit-and-continue turn — the branch that exists to keep an edit's evidence — and
 * `base(undefined)` throws inside a catch.
 */
export function tableConstantRefs(relPath) {
    const out = [];
    let ast, source;
    try {
        ({ ast, source } = parseFile(relPath));
    } catch {
        return out;
    }
    const lineOf = (offset) => source.slice(0, offset).split("\n").length;
    walk(ast, (node) => {
        if (node.type !== "MemberExpression") return;
        if (node.object?.type !== "Identifier" || node.object.name !== "TABLES") return;
        const key = node.property?.name;
        if (key) out.push({ key, line: lineOf(node.start) });
    });
    return out;
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
    // A FIELD ENTRY PASSES THE TABLE TEST BY NOT BEING A TABLE, so #318's says what it
    // is instead: the successor is addressed by the tree, which is the only evidence
    // this tier can offer that a retired field was replaced rather than dropped.
    assert(
        "  and the field #318 retired has its successor addressed in the tree",
        collected.some((c) => c.value === "Paid Date")
    );
    // #333's five field entries, the same way. FOUR OF THE FIVE, AND THE FIFTH IS THE
    // HONEST PART: `Users."PR Edit Requests (Initiated)"` is read by nothing in this
    // repository — it was renamed so the pair on `Users` says one word, not to keep
    // anything working — so requiring it here would be requiring a reference that
    // should not exist. Naming that rather than quietly dropping it is the point.
    for (const successor of [
        "PR Edit Request ID",
        "PR Edit Log ID",
        "PR Edit Requests",
        "PR Edit Requests (Sent To)",
        "PR Edit Log",
    ]) {
        assert(
            `  and #333's successor ${JSON.stringify(successor)} is addressed in the tree`,
            collected.some((c) => c.value === successor)
        );
    }
    assert(
        "  while the one nothing reads is deliberately not required",
        !collected.some((c) => c.value === "PR Edit Requests (Initiated)")
    );
    check(
        `retired names still in TABLES${stillPresent.length ? ` (${stillPresent.join(", ")})` : ""}`,
        stillPresent.length,
        0
    );

    // ── the TABLES key spells its own value ─────────────────────────────────
    // #333's rule made mechanical. A child table is named for its parent, which no
    // check can ask; that its CONSTANT still names the table is the half that can be,
    // and it is the half a rename actually gets wrong — `EDIT_LOG: "PR Edit Log"`
    // compiles, resolves, and passes every other check in this tier while telling
    // every reader of `TABLES.EDIT_LOG` that the base has a table called `Edit Log`.
    // True 22 of 22 before this issue, so the convention is being pinned rather than
    // introduced.
    log("");
    log("every TABLES key is the SCREAMING_SNAKE of its own value:");
    const entries = tableEntriesFromSource();
    assert(`parsed ${entries.length} key/value pairs`, entries.length >= 20);
    const mismatched = entries.filter((e) => e.key !== keyForTableName(e.value));
    for (const e of mismatched) {
        log(`  ${e.key}: ${JSON.stringify(e.value)} — expected ${keyForTableName(e.value)}`);
    }
    check("keys that do not spell their value", mismatched.length, 0);
    // The derivation has to be seen to say NO, or the pass above is a pass of an empty
    // predicate — and it has to say YES on the two shapes that are not plain words.
    assert(
        "  a key left behind by a rename is caught",
        keyForTableName("PR Edit Log") !== "EDIT_LOG"
    );
    assert(
        "  a hyphen and a two-word name both derive correctly",
        keyForTableName("Invoice-PO Link") === "INVOICE_PO_LINK" &&
            keyForTableName("PR Edit Requests") === "PR_EDIT_REQUESTS"
    );

    // ── every TABLES.<KEY> a call site names actually exists ────────────────
    // The other half of a table rename, and the one that got past #333's own sweep.
    // See tableConstantRefs' docstring for what the tier could not see and why the
    // path it survived on was the worst available.
    log("");
    log("every TABLES.<KEY> a call site names is a key TABLES has:");
    const keys = new Set(entries.map((e) => e.key));
    const refs = [];
    for (const abs of files) {
        const relPath = abs.slice(abs.lastIndexOf("/app/") >= 0 ? abs.lastIndexOf("/app/") + 1 : 0);
        const path = relPath.includes("/lib/")
            ? relPath.slice(relPath.lastIndexOf("/lib/") + 1)
            : relPath;
        for (const r of tableConstantRefs(path)) refs.push({ ...r, file: path });
    }
    assert(`read ${refs.length} TABLES.<KEY> references`, refs.length > 50);
    assert("  and the reader resolves live keys", refs.some((r) => keys.has(r.key)));
    const dangling = refs.filter((r) => !keys.has(r.key));
    for (const d of dangling) log(`  ${d.file}:${d.line}  TABLES.${d.key} — no such key`);
    check("references to a key TABLES does not have", dangling.length, 0);
    // Planted, because "none dangling" and "none read" are the same result: the key a
    // rename leaves behind is what a regression looks like, and it must be seen. This
    // is #333's actual defect, spelled as the data the predicate is given.
    assert(
        "  a reference left behind by a rename is caught",
        [{ key: "EDIT_LOG" }, { key: "CORRECTION_REQUESTS" }].filter((r) => !keys.has(r.key))
            .length === 2
    );

    log("");
    log(
        `  ${Object.keys(RETIRED).length} retired names, ${collected.length} references ` +
            `read across ${files.length} files`
    );
    log("  what this CANNOT say: whether the base agrees — no offline check reads it");
}

if (isMain(import.meta.url)) standalone(title, run);

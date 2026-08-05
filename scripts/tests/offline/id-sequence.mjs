// The sequence rule for a generated ID — daily families and child IDs (#164).
//
// #164 was one wrong field name inside one query: `generateNextInvoiceId` built
// `HYE-INV-{today}-{seq}` while counting `IS_SAME({Issue Date}, TODAY(), 'day')`,
// the VENDOR's date off their document — so the count was almost always 0 and
// every invoice entered on one day got `-01`. Nothing in the repo could see that,
// because the rule was four inline formulas inside a module the offline tier
// cannot import (lib/ids.js reaches lib/airtable/client.js, which throws at module
// load). The rule now lives in lib/idSequence.js, which imports nothing, and this
// is what pins it.
//
// CHILD IDS JOINED IT AFTERWARDS, and the sentence that brought them was #164's
// own: a count is the next free number only while nothing has been deleted.
// generateChildId counted the parent's link array, so one Draft re-save — which
// creates the new generation before destroying the old, deliberately — left the
// low numbers free and the next child re-issued a live one. That is not
// hypothetical on this base: `HYE-PR-260722-09` holds exactly one PR Item, `-002`,
// and exactly one Quotation, `-Q02`.
//
// Three parts. 1 and 2 are the arrangement formula-escaping.mjs uses:
//   1. BEHAVIOR of the pure rule — prefixes, the population membership test, the
//      max-not-count sequence for both shapes, and the predicate prefixMatch
//      builds.
//   2. SOURCE SHAPE of lib/ids.js — that no daily counter reads a date field any
//      more, and that generateChildId reads its siblings' IDs rather than the
//      array's length. Parsed, not text-matched.
//   3. EVERY generateChildId CALL SITE under lib/, enumerated rather than listed,
//      so a ninth child table cannot ship with an unregistered ID shape or still
//      passing a shape of its own (which would now be silently ignored).
//
// Parts 2 and 3 are here rather than in source-shape.mjs, which CLAUDE.md names
// as the home for source-shape checks, and the reason is scope: that file is about
// one KIND of claim (a guard runs before the side effect it protects, cleanup sits
// outside a rollback) and shares one helper table for it. These assert things about
// one rule's implementation, and they belong next to that rule's behavior so a
// reader sees both halves of what "the sequence is the highest one taken" means.
//
// WHAT A PASS DOES NOT PROVE. Parts 2 and 3 are source shape, so they prove
// lib/ids.js does not NAME a date field in a formula and does not TEXTUALLY count
// an array length — not that the query Airtable ran counted the right rows.
// Whether FIND(...) = 1 selects the day's siblings, and whether a parent's link
// array is populated in time to be counted, are Airtable's properties: both are
// measured in scripts/tests/verify-invoice-ids-164.mjs, which also creates two
// invoices in one run, and three children with the middle one deleted.

import {
    CHILD_KINDS,
    ID_KINDS,
    SEQ_PAD_LENGTH,
    childKeyFor,
    childKind,
    dailyIdPrefix,
    dailyStamp,
    formatSequentialId,
    nextSequence,
} from "../../../lib/idSequence.js";
import { prefixMatch } from "../../../lib/airtableFormula.js";
import { isMain, standalone } from "./_harness.mjs";
import { REPO_ROOT, listJsFiles, parseFile, repoPath, toPosix, walk } from "./_ast.mjs";

export const title = "ID sequences — the counted population, for daily and child IDs (#164)";

/**
 * A local noon date, built from components so the assertions hold in any
 * timezone. dailyStamp reads LOCAL getters (unchanged from the helpers it
 * replaced, because the Vercel process clock is UTC and production must not
 * move), so a `new Date("2026-08-03T...Z")` literal would drift west of GMT.
 */
const AUG_3 = new Date(2026, 7, 3, 12, 0, 0);
const JAN_9 = new Date(2026, 0, 9, 12, 0, 0);

/** Every date field that has ever been counted, plus the ones nearby. */
const DATE_FIELD_NAMES = [
    "Issue Date",
    "Created At",
    "Created Date",
    "Received Date",
    "Due Date",
    "Paid Date",
    "President Signed At",
    "Withdrawn At",
];

export function run({ check, log, assert }) {
    // --- Part 1: the rule itself ----------------------------------------
    log("the daily stamp (local getters, date passed in so this is pinnable):");
    check("2-digit year", dailyStamp(AUG_3, 2), "260803");
    check("4-digit year — PO only", dailyStamp(AUG_3, 4), "20260803");
    check("month and day are zero-padded", dailyStamp(JAN_9, 2), "260109");
    check("defaults to 2 digits", dailyStamp(AUG_3), "260803");

    log("");
    log("one prefix per family:");
    check("PR", dailyIdPrefix(ID_KINDS.PR, AUG_3), "HYE-PR-260803");
    check("PO keeps the 4-digit year", dailyIdPrefix(ID_KINDS.PO, AUG_3), "HYE-PO-20260803");
    check("Invoice", dailyIdPrefix(ID_KINDS.INVOICE, AUG_3), "HYE-INV-260803");
    check("Delivery", dailyIdPrefix(ID_KINDS.DELIVERY, AUG_3), "HYE-DL-260803");

    // The lengths the issue and CLAUDE.md both wrote down wrong. Recorded as
    // measurements rather than as a constant anything reads: `LEFT({Invoice ID},
    // 13)` matched 0 rows on the live base because the prefix is 14 characters,
    // and four families would need four such numbers. Nothing hard-codes a length
    // now, and these are here so the claim stays checkable.
    log("");
    log("prefix lengths — the reason no length is hard-coded anywhere:");
    check("Invoice prefix is 14 chars, not the 13 #164 was filed with", dailyIdPrefix(ID_KINDS.INVOICE, AUG_3).length, 14);
    check("PR is 13", dailyIdPrefix(ID_KINDS.PR, AUG_3).length, 13);
    check("PO is 15", dailyIdPrefix(ID_KINDS.PO, AUG_3).length, 15);
    check("Delivery is 13", dailyIdPrefix(ID_KINDS.DELIVERY, AUG_3).length, 13);

    log("");
    log("the ID field each family counts — never a date field:");
    check("PR", ID_KINDS.PR.idField, "PR ID");
    check("PO", ID_KINDS.PO.idField, "PO ID");
    check("Invoice", ID_KINDS.INVOICE.idField, "Invoice ID");
    check("Delivery", ID_KINDS.DELIVERY.idField, "Delivery ID");
    // The defect as a property rather than as four equalities: whatever a kind
    // names, it must not be one of the fields a date lives in.
    const kinds = Object.entries(ID_KINDS);
    assert(
        "no kind names a date field (the #164 defect, as a property)",
        kinds.every(([, kind]) => !DATE_FIELD_NAMES.includes(kind.idField))
    );
    assert("all four families are registered", kinds.length === 4);

    log("");
    log("assembling an ID:");
    check("padded to two digits", formatSequentialId("HYE-INV-260803", 2), "HYE-INV-260803-02");
    check("and the pad width is the shared constant", SEQ_PAD_LENGTH, 2);
    // Widening rather than wrapping or colliding. padStart does not truncate.
    check("past 99 the sequence widens, it does not wrap", formatSequentialId("HYE-INV-260803", 100), "HYE-INV-260803-100");

    log("");
    log("the sequence is MAX + 1, not count + 1:");
    check("an empty table starts at 1", nextSequence([], "HYE-INV-260803"), 1);
    check("nullish is an empty table", nextSequence(null, "HYE-INV-260803"), 1);
    check("no sibling starts at 1", nextSequence(["HYE-INV-260802-07"], "HYE-INV-260803"), 1);
    check(
        "consecutive siblings continue",
        nextSequence(["HYE-INV-260803-01", "HYE-INV-260803-02"], "HYE-INV-260803"),
        3
    );
    // The live gaps #164 measured: HYE-INV-260716 holds [02, 03] and
    // HYE-INV-260727 holds [03, 04], so count + 1 is a number that already exists
    // in both. This is the case that makes max load-bearing rather than tidy.
    check(
        "a gap from a deleted row is stepped over, not reused",
        nextSequence(["HYE-INV-260716-02", "HYE-INV-260716-03"], "HYE-INV-260716"),
        4
    );
    check(
        "the other measured gap",
        nextSequence(["HYE-INV-260727-03", "HYE-INV-260727-04"], "HYE-INV-260727"),
        5
    );
    check("order does not matter", nextSequence(["HYE-INV-260803-05", "HYE-INV-260803-01"], "HYE-INV-260803"), 6);
    check("a hand-typed 99 pushes the next one to 100", nextSequence(["HYE-PO-20260715-99"], "HYE-PO-20260715"), 100);

    log("");
    log("membership: the formula narrows, this function decides:");
    // A row the server-side FIND admits but that is not a sibling. Over-matching
    // must cost rows, never corrupt a number.
    check(
        "a longer date segment is not a sibling",
        nextSequence(["HYE-INV-260803X-09"], "HYE-INV-260803"),
        1
    );
    // A child ID is not a sibling: the parent alone decides the answer, and the
    // child adds nothing on top of it. (It would take a cross-table query to see
    // one here at all — this pins the rule, not a reachable case.)
    check(
        "a child ID under a sibling contributes nothing",
        nextSequence(["HYE-INV-260803-01", "HYE-INV-260803-01-001"], "HYE-INV-260803"),
        2
    );
    check(
        "and a child ID on its own is ignored entirely",
        nextSequence(["HYE-INV-260803-01-001"], "HYE-INV-260803"),
        1
    );
    check("a non-numeric tail is ignored", nextSequence(["HYE-INV-260803-QA"], "HYE-INV-260803"), 1);
    check("the bare prefix with no sequence is ignored", nextSequence(["HYE-INV-260803"], "HYE-INV-260803"), 1);
    check("a blank ID is ignored", nextSequence(["", null, undefined], "HYE-INV-260803"), 1);
    check("a non-string is ignored", nextSequence([42, {}], "HYE-INV-260803"), 1);
    // The hand-made fixtures on this base. `HYE-PR-TESTQA-99` is inert against
    // every generated prefix because a generated date segment is digits.
    check(
        "the TESTQA fixtures cannot be siblings of a generated prefix",
        nextSequence(["HYE-PR-TESTQA-01", "HYE-PR-TESTQA-99"], "HYE-PR-260803"),
        1
    );

    log("");
    log("the predicate (prefixMatch, in lib/airtableFormula.js):");
    check(
        "an anchored FIND, not a LEFT with a magic length",
        prefixMatch("Invoice ID", "HYE-INV-260803"),
        'FIND("HYE-INV-260803", {Invoice ID}) = 1'
    );
    check(
        "the prefix is escaped like any other interpolated value",
        prefixMatch("Invoice ID", 'HYE-INV-2608"03'),
        'FIND("HYE-INV-2608\\"03", {Invoice ID}) = 1'
    );
    const refuses = (fn) => {
        try {
            fn();
            return "accepted";
        } catch {
            return "refused";
        }
    };
    // FIND("", x) is 1 for every row, i.e. the whole table — the answer the OR
    // builders' FALSE() exists to avoid. Refuse rather than emit it.
    check("an empty prefix is refused, not matched against everything", refuses(() => prefixMatch("Invoice ID", "")), "refused");
    check("a nullish prefix is refused", refuses(() => prefixMatch("Invoice ID", null)), "refused");
    check("a braced field name is refused, as everywhere else", refuses(() => prefixMatch("F}{", "HYE")), "refused");

    // --- Part 1b: child IDs, the same rule with a seqPrefix ---------------
    log("");
    log("child IDs — one nextSequence for both shapes:");
    // The plain child sequence. Same function, same max rule.
    check(
        "a dense child sequence continues",
        nextSequence(["HYE-PR-260710-07-001", "HYE-PR-260710-07-002"], "HYE-PR-260710-07"),
        3
    );
    // THE LIVE CASE. HYE-PR-260722-09 holds exactly one PR Item, -002, because a
    // Draft re-save created the new generation before deleting the old one. Under
    // count + 1 the next item was -002 again.
    check(
        "the measured live gap: one item at -002, next is -003 not -002",
        nextSequence(["HYE-PR-260722-09-002"], "HYE-PR-260722-09"),
        3
    );
    check(
        "and its Quotation counterpart, one at -Q02",
        nextSequence(["HYE-PR-260722-09-Q02"], "HYE-PR-260722-09", { seqPrefix: "Q" }),
        3
    );

    // Two independent sequences under one parent. Neither may see the other, or a
    // PR with 2 items and 1 quotation would number the next quotation Q03.
    const bothShapes = ["HYE-PR-260722-09-001", "HYE-PR-260722-09-002", "HYE-PR-260722-09-Q01"];
    check("Q rows are invisible to the plain sequence", nextSequence(bothShapes, "HYE-PR-260722-09"), 3);
    check(
        "and plain rows are invisible to the Q sequence",
        nextSequence(bothShapes, "HYE-PR-260722-09", { seqPrefix: "Q" }),
        2
    );
    check("no siblings starts at 1", nextSequence([], "HYE-PR-260710-07", { seqPrefix: "Q" }), 1);
    // A wrong idField reads undefined off every sibling; generateChildId throws on
    // that rather than letting it look like a childless parent, but the pure
    // function still has to treat it as "no siblings" rather than crashing.
    check("undefined ids are ignored, not crashed on", nextSequence([undefined, undefined], "HYE-PR-260710-07"), 1);

    log("");
    log("assembling a child ID:");
    check(
        "3 digits, no label",
        formatSequentialId("HYE-PR-260710-07", 1, { padLength: 3 }),
        "HYE-PR-260710-07-001"
    );
    check(
        "2 digits and a Q label",
        formatSequentialId("HYE-PR-260710-07", 1, { padLength: 2, seqPrefix: "Q" }),
        "HYE-PR-260710-07-Q01"
    );
    // Round-trip: what formatSequentialId writes, nextSequence must read back.
    // This is the property that makes one module cover both shapes; a mismatch
    // between the writer and the reader is exactly how a duplicate is minted.
    log("");
    log("round trip — every registered shape writes what nextSequence reads:");
    for (const [link, kind] of Object.entries(CHILD_KINDS)) {
        const opts = { padLength: kind.padLength, seqPrefix: kind.seqPrefix };
        const first = formatSequentialId("PARENT-01", 1, opts);
        const second = formatSequentialId("PARENT-01", 2, opts);
        const back = nextSequence([first, second], "PARENT-01", { seqPrefix: kind.seqPrefix });
        check(`${link} (${first})`, back, 3);
    }

    log("");
    log("the child registry:");
    check("all eight child relations are registered", Object.keys(CHILD_KINDS).length, 8);
    check("Quotations is the only labeled sequence",
        Object.values(CHILD_KINDS).filter((k) => k.seqPrefix).length, 1);
    check("and the only one padded to 2", Object.values(CHILD_KINDS).filter((k) => k.padLength === 2).length, 1);
    assert(
        "every entry names an ID field, never a date or a link field",
        Object.values(CHILD_KINDS).every((k) => /^[\w /]+ ID$/.test(k.idField))
    );

    // The key is `Parent Table::Link Field`, because 7 of the 8 link-field names
    // are carried by more than one table on this base (measured 2026-08-03).
    assert(
        "every key is a parent::field pair, not a bare field name",
        Object.keys(CHILD_KINDS).every((key) => key.split("::").length === 2 && key.split("::").every(Boolean))
    );
    check("childKeyFor builds the same key the registry uses",
        childKeyFor("Purchase Requests", "PR Items"), "Purchase Requests::PR Items");
    assert("and that key resolves", Boolean(childKind("Purchase Requests", "PR Items")));
    // The shared names, as the reason the pair exists. Each of these is a real
    // link field on a second table; registering it would have collided under the
    // old key.
    check(
        "Quotations.\"PR Items\" is a different relation from Purchase Requests'",
        refuses(() => childKind("Quotations", "PR Items")),
        "refused"
    );
    check(
        "PO Items.\"Delivery Items\" likewise",
        refuses(() => childKind("PO Items", "Delivery Items")),
        "refused"
    );
    check(
        "Materials.\"PO Items\" likewise",
        refuses(() => childKind("Materials", "PO Items")),
        "refused"
    );
    check("an unregistered pair throws rather than defaulting",
        refuses(() => childKind("Purchase Requests", "Notes")), "refused");
    check("a missing link field throws", refuses(() => childKind("Purchase Requests", undefined)), "refused");
    check("so does a missing parent table", refuses(() => childKind(undefined, "PR Items")), "refused");

    // DUPLICATE KEYS CANNOT BE SEEN FROM THE IMPORTED OBJECT. Two identical keys
    // in an object literal are not an error: the later wins at parse time and the
    // earlier is gone, so Object.keys reports one entry and every check that reads
    // the imported object agrees with it. The only place the duplicate still
    // exists is the source, so it has to be counted there.
    log("");
    log("duplicate registry keys — counted on the AST, since the object cannot show them:");
    const seq = parseFile("lib/idSequence.js");
    let registryProps = null;
    walk(seq.ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== "CHILD_KINDS" || node.init?.type !== "ObjectExpression") return;
        registryProps = node.init.properties
            .filter((p) => p.type === "Property")
            .map((p) => (p.key.type === "Literal" ? p.key.value : p.key.name));
    });
    assert("found the CHILD_KINDS object literal in the source", Array.isArray(registryProps));
    check("the source lists as many entries as the object exposes",
        registryProps?.length, Object.keys(CHILD_KINDS).length);
    const dupes = (registryProps ?? []).filter((k, i, all) => all.indexOf(k) !== i);
    assert(
        dupes.length === 0
            ? "no key is written twice (a repeat would be silently discarded)"
            : `written twice, and the later silently wins: ${[...new Set(dupes)].join(", ")}`,
        dupes.length === 0
    );

    // --- Part 2: lib/ids.js's shape --------------------------------------
    log("");
    log("lib/ids.js — no daily counter reads a date field (parsed, fail-closed):");

    const ids = parseFile("lib/ids.js");

    // Every filterByFormula in the file, and every string literal in it. A
    // reintroduced `IS_SAME({Issue Date}, TODAY(), 'day')` is caught by both.
    const formulas = [];
    const literals = [];
    walk(ids.ast, (node) => {
        if (node.type === "Property") {
            const name = node.key?.type === "Identifier" ? node.key.name : node.key?.value;
            if (name === "filterByFormula") formulas.push(ids.source.slice(node.value.start, node.value.end));
        }
        if (node.type === "Literal" && typeof node.value === "string") literals.push(node.value);
        if (node.type === "TemplateElement") literals.push(node.value.cooked ?? "");
    });

    assert("it still builds a filterByFormula at all (else this check is inert)", formulas.length > 0);
    check("exactly one, shared by all four families", formulas.length, 1);
    check("and it is a bare prefixMatch() call", formulas[0], "prefixMatch(kind.idField, prefix)");

    const named = DATE_FIELD_NAMES.filter((field) => literals.some((text) => text.includes(`{${field}}`)));
    assert(
        named.length === 0
            ? "no date field is referenced in any formula string"
            : `a date field is back in a formula: ${named.join(", ")}`,
        named.length === 0
    );
    assert(
        "TODAY() is gone — Airtable is no longer asked what day it is",
        !literals.some((text) => text.includes("TODAY()"))
    );
    assert("IS_SAME is gone with it", !literals.some((text) => text.includes("IS_SAME")));

    // The four generators must go through the shared helper, or "one rule" is a
    // comment rather than a fact. Each body is one return of mintDailyId(...).
    const GENERATORS = ["generateNextPRId", "generateNextPOId", "generateNextInvoiceId", "generateNextDeliveryId"];
    const delegating = [];
    walk(ids.ast, (node) => {
        if (node.type !== "FunctionDeclaration" || !GENERATORS.includes(node.id?.name)) return;
        const body = ids.source.slice(node.body.start, node.body.end);
        if (/\breturn mintDailyId\(/.test(body)) delegating.push(node.id.name);
    });
    check("all four generators delegate to the one helper", delegating.length, GENERATORS.length);
    for (const name of GENERATORS) {
        assert(`${name} delegates`, delegating.includes(name));
    }

    // The pure rule must not be re-implemented here — that is the duplication the
    // split exists to prevent, and it would be invisible to Part 1.
    let importsSequence = false;
    walk(ids.ast, (node) => {
        if (node.type === "ImportDeclaration" && /idSequence/.test(node.source.value)) importsSequence = true;
    });
    assert("and take the rule from lib/idSequence.js rather than restating it", importsSequence);

    // generateChildId must read the siblings' own ID field, not the array length.
    const childBody = (() => {
        let src = null;
        walk(ids.ast, (node) => {
            if (node.type === "FunctionDeclaration" && node.id?.name === "generateChildId") {
                src = ids.source.slice(node.body.start, node.body.end);
            }
        });
        return src;
    })();
    assert("generateChildId exists", Boolean(childBody));
    assert("it batches the siblings through findByRecordIds", /findByRecordIds\(/.test(childBody ?? ""));
    assert("and takes the sequence from nextSequence", /nextSequence\(/.test(childBody ?? ""));
    // The defect, as a shape: counting the link array's length is what produced a
    // duplicate, so `.length + 1` must not come back.
    assert(
        "it does not count the link array's length",
        !/\.length\s*\)?\s*\+\s*1/.test(childBody ?? "")
    );
    assert(
        "it asks CHILD_KINDS for the shape rather than defaulting one",
        /childKind\(/.test(childBody ?? "")
    );

    // --- Part 3: every child call site, enumerated ------------------------
    // Fail-closed in authz-structure.mjs's shape: a new child table added later
    // is covered without anyone remembering to register it here. It cannot be a
    // hard-coded list of eight, or the ninth would be invisible.
    log("");
    log("every generateChildId call site under lib/ (enumerated, fail-closed):");

    // A call site names its parent as `TABLES.PURCHASE_REQUESTS`, so the composite
    // key cannot be read straight off the AST. lib/airtable/client.js cannot be
    // imported here — it throws without AIRTABLE_API_KEY, which is the whole
    // reason this tier exists — so TABLES is read from its own object literal
    // instead. That gives the check a second property for free: a call site whose
    // TABLES.X does not exist is caught rather than silently resolving to
    // undefined.
    const client = parseFile("lib/airtable/client.js");
    const TABLE_NAMES = new Map();
    walk(client.ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== "TABLES" || node.init?.type !== "ObjectExpression") return;
        for (const prop of node.init.properties) {
            if (prop.type !== "Property" || prop.value.type !== "Literal") continue;
            TABLE_NAMES.set(prop.key.type === "Identifier" ? prop.key.name : prop.key.value, prop.value.value);
        }
    });
    check("resolved TABLES from client.js's own literal", TABLE_NAMES.size > 0, true);

    /** `TABLES.PR_ITEMS` -> "PR Items", or null if it is not that shape. */
    const resolveTable = (node) => {
        if (node?.type !== "MemberExpression") return null;
        if (node.object?.type !== "Identifier" || node.object.name !== "TABLES") return null;
        const member = node.property?.type === "Identifier" ? node.property.name : null;
        return member && TABLE_NAMES.has(member) ? TABLE_NAMES.get(member) : null;
    };

    const callSites = [];
    const problems = [];
    for (const rel of listJsFiles(repoPath("lib")).map((f) => toPosix(f.slice(REPO_ROOT.length + 1)))) {
        if (rel === "lib/ids.js") continue;
        let parsed;
        try {
            parsed = parseFile(rel);
        } catch (err) {
            problems.push(`${rel}: did not parse — ${err.message}`);
            continue;
        }
        walk(parsed.ast, (node) => {
            if (node.type !== "CallExpression") return;
            if (node.callee?.type !== "Identifier" || node.callee.name !== "generateChildId") return;
            const config = node.arguments[0];
            if (config?.type !== "ObjectExpression") {
                problems.push(`${rel}: generateChildId's first argument is not an object literal`);
                return;
            }
            const props = new Map();
            for (const prop of config.properties) {
                if (prop.type !== "Property") continue;
                const key = prop.key?.type === "Identifier" ? prop.key.name : prop.key?.value;
                props.set(key, prop.value);
            }
            const linkNode = props.get("parentLinkFieldName");
            const link = linkNode?.type === "Literal" ? linkNode.value : null;
            const parent = resolveTable(props.get("parentTableName"));
            const key = parent && link ? childKeyFor(parent, link) : null;
            callSites.push({ rel, key, link });

            if (link === null) {
                problems.push(`${rel}: parentLinkFieldName is not a string literal, so it cannot be checked`);
            }
            if (parent === null) {
                problems.push(`${rel}: parentTableName is not a TABLES.X this check can resolve`);
            }
            if (key !== null && !Object.prototype.hasOwnProperty.call(CHILD_KINDS, key)) {
                problems.push(`${rel}: "${key}" is not registered in CHILD_KINDS (lib/idSequence.js)`);
            }
            if (!props.has("childTableName")) {
                problems.push(`${rel}: no childTableName — the siblings' IDs cannot be fetched`);
            }
            // The shape moved into the registry. A call site still passing one
            // would be silently ignored, which is worse than failing.
            for (const stale of ["padLength", "seqPrefix"]) {
                if (props.has(stale)) {
                    problems.push(`${rel}: still passes ${stale} — that now comes from CHILD_KINDS and is ignored here`);
                }
            }
        });
    }

    log(`found ${callSites.length} call site(s):`);
    for (const site of callSites) log(`    ${site.key ?? `UNRESOLVED (${site.rel})`}`);
    // A check that finds nothing has stopped checking.
    assert("the walk found call sites at all (else this check is inert)", callSites.length > 0);
    check("one per registered child relation", callSites.length, Object.keys(CHILD_KINDS).length);
    assert(
        problems.length === 0 ? "every call site is registered and complete" : `${problems.length} problem(s):`,
        problems.length === 0
    );
    for (const p of problems) log(`    ${p}`);

    // A registry entry no call site uses is a shape nothing creates — either a
    // dead entry or a caller that stopped going through generateChildId.
    const used = new Set(callSites.map((c) => c.key));
    for (const key of Object.keys(CHILD_KINDS)) {
        assert(`"${key}" is still created through generateChildId`, used.has(key));
    }
}

if (isMain(import.meta.url)) standalone(title, run);

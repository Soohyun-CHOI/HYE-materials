// The daily-sequence rule for a top-level ID (#164).
//
// WHY THIS IS ITS OWN MODULE, and not part of lib/ids.js where the generators
// live: ids.js imports lib/airtable/client.js, which throws
// `Missing AIRTABLE_API_KEY` at module load, so a plain `node` check cannot
// import it — the offline harness names lib/ids.js explicitly as excluded for
// that reason. The rule this file holds is the whole of #164's claim, so it has
// to be testable without credentials. Same measured reason lib/airtableFormula.js
// was split out of client.js in #159 and lib/authzWrap.js out of lib/authz.js in
// #147, and the same shape as lib/itemNaming.js: a self-contained naming rule,
// split from the code that writes with it.
//
// This is NOT a second place where IDs are generated. lib/ids.js is still the
// only one: it owns the lock, the query and the create. What lives here is the
// pure part — what the prefix is, which population the sequence is counted over,
// and how the two become an ID.
//
// Imports nothing. Keep it that way: the offline tier runs under plain `node`
// with no loader, so an unresolvable import would put this back out of reach.

/**
 * The four top-level daily-reset ID families.
 *
 * `idField` is here rather than at the call site because WHICH FIELD IS COUNTED
 * is the rule, not an implementation detail of one query — it is precisely what
 * #164 got wrong. A kind naming a date field would be the defect returning, and
 * scripts/tests/offline/id-sequence.mjs asserts that none of them does.
 *
 * Deliberately no table name: TABLES lives in lib/airtable/client.js, and
 * importing it would drag the env fail-fast in here and undo the split above.
 * lib/ids.js pairs each kind with its table.
 *
 * `yearDigits: 4` is PO only — the company's historically-issued PO numbers use a
 * 4-digit year (confirmed from real invoice samples), so generated PO IDs match.
 * Everything else keeps the 2-digit convention.
 */
export const ID_KINDS = {
    PR: { token: "HYE-PR", yearDigits: 2, idField: "PR ID" },
    PO: { token: "HYE-PO", yearDigits: 4, idField: "PO ID" },
    INVOICE: { token: "HYE-INV", yearDigits: 2, idField: "Invoice ID" },
    DELIVERY: { token: "HYE-DL", yearDigits: 2, idField: "Delivery ID" },
};

/** Separator in a CHILD_KINDS key. Two colons, because no field name has one. */
const CHILD_KEY_SEPARATOR = "::";

/** The CHILD_KINDS key for one parent→child relation. */
export function childKeyFor(parentTableName, parentLinkFieldName) {
    return `${parentTableName}${CHILD_KEY_SEPARATOR}${parentLinkFieldName}`;
}

/**
 * The eight child ID shapes, keyed on `Parent Table::Link Field` — the pair the
 * relation actually is, and both halves of which every call site already passes.
 *
 * This is a registry rather than eight sets of arguments because the shape of a
 * child ID is a rule, not a per-call-site parameter: `padLength` and `seqPrefix`
 * used to be passed in, so "a Quotation is {PR ID}-Q##" was stated at the call
 * site and nowhere else, and `idField` — the field the sequence is read from — is
 * the one value a caller must not be able to get wrong, since a wrong field name
 * reads `undefined` off every sibling and silently mints a duplicate.
 *
 * WHY THE KEY IS COMPOSITE, measured against the live base on 2026-08-03 (21
 * tables, 84 `multipleRecordLinks` fields, 50 distinct field names). It was keyed
 * on the link field name alone, on the belief that those names were globally
 * unique. THEY ARE NOT: **7 of the 8 are carried by more than one table.**
 *
 *   PR Items         Purchase Requests*, Quotations
 *   PR Signers       Users, Purchase Requests*
 *   Quotations       Vendors, Purchase Requests*
 *   Edit Log         Users, Purchase Requests*
 *   PO Items         Purchase Orders*, Materials
 *   Invoice Items    Purchase Orders, PO Items, Invoices*
 *   Delivery Items   PO Items, Materials, Deliveries*
 *   (* = the parent the shape is registered for. Only "Correction Requests",
 *    on Purchase Requests alone, is unique. 18 of the base's 50 link-field
 *    names are shared by two or more tables, so this is the norm here, not a
 *    near miss.)
 *
 * Nothing collided only because exactly one table per name is a REGISTERED
 * relation — a property of which call sites exist, not of the schema, and one
 * that a ninth child table could end tomorrow. `Materials."PO Items"` and
 * `PO Items."Delivery Items"` are already there, already named identically to
 * registered keys, and already one `generateChildId` call away from clashing.
 *
 * THE FAILURE IT PREVENTS IS SILENT, which is why the pair is worth the longer
 * key. Two identical keys in an object literal are not an error in JS — the later
 * one wins and the earlier is discarded with no warning, at parse time, so both
 * `Object.keys` and any check that imports this object see one entry and agree
 * with each other. The surviving `idField` would then be wrong for one of the two
 * relations, every sibling of that relation would read `undefined`, the parent
 * would look childless, and the sequence would restart at 1 — a duplicate child
 * ID, which is exactly the defect the two commits before this one closed.
 *
 * Deliberately still no `TABLES` import: the parent table arrives as the string
 * the caller already holds, so importing lib/airtable/client.js — and its
 * module-load throw — is not needed to build a key. Keeping this module
 * import-free is what lets the offline tier pin it (see the header).
 *
 * `generateChildId` THROWS on an unregistered pair, and
 * scripts/tests/offline/id-sequence.mjs enumerates every call site in `lib/`,
 * resolves each `TABLES.X` against client.js's own literal, and fails if a pair is
 * not here — so a ninth child table cannot ship unregistered, cannot ship still
 * passing a shape of its own, and cannot ship as a duplicate key, which that check
 * detects on this object's AST rather than on the collapsed object.
 */
export const CHILD_KINDS = {
    "Purchase Requests::PR Items": { idField: "PR Item ID", padLength: 3 },
    "Purchase Requests::PR Signers": { idField: "PR Signer ID", padLength: 3 },
    // 2 digits and a "Q", so a Quotation reads as a labeled sub-sequence
    // (HYE-PR-260710-07-Q01) rather than as another numbered child.
    "Purchase Requests::Quotations": { idField: "Quotation ID", padLength: 2, seqPrefix: "Q" },
    "Purchase Requests::Correction Requests": { idField: "Correction Request ID", padLength: 3 },
    "Purchase Requests::Edit Log": { idField: "Edit Log ID", padLength: 3 },
    "Purchase Orders::PO Items": { idField: "PO Item ID", padLength: 3 },
    "Invoices::Invoice Items": { idField: "Invoice Item ID", padLength: 3 },
    "Deliveries::Delivery Items": { idField: "Delivery Item ID", padLength: 3 },
};

/** The registered shape for one parent→child relation, or a throw. */
export function childKind(parentTableName, parentLinkFieldName) {
    const key = childKeyFor(parentTableName, parentLinkFieldName);
    const kind = CHILD_KINDS[key];
    if (!kind) {
        throw new Error(
            `idSequence: no child ID shape registered for "${key}" — ` +
                `add it to CHILD_KINDS in lib/idSequence.js`
        );
    }
    return kind;
}

/** Every generated DAILY sequence is zero-padded to this width. See widening below. */
export const SEQ_PAD_LENGTH = 2;

/** The separator between a prefix and the sequence number, in both shapes. */
const SEQ_SEPARATOR = "-";

function pad(n, length) {
    return String(n).padStart(length, "0");
}

/**
 * `YYMMDD` or `YYYYMMDD` for a given moment.
 *
 * LOCAL getters, unchanged from what the two helpers this replaced did — on
 * Vercel the process clock is UTC, so production behavior is identical, and
 * switching to UTC getters would silently move the date on a local dev run and in
 * the demo scripts.
 *
 * The date arrives as an ARGUMENT rather than being read here, which is what lets
 * the offline tier pin a stamp against a fixed day instead of whatever today is.
 *
 * One clock, and that is now the whole story. The counter this replaced compared
 * a JS-derived stamp against Airtable's `TODAY()`, which evaluates in GMT — two
 * clocks that agree on Vercel and need not agree anywhere else. Counting the ID
 * prefix means Airtable is never asked what day it is.
 */
export function dailyStamp(date, yearDigits = 2) {
    const y = yearDigits === 4 ? String(date.getFullYear()) : String(date.getFullYear()).slice(-2);
    const m = pad(date.getMonth() + 1, 2);
    const d = pad(date.getDate(), 2);
    return `${y}${m}${d}`;
}

/** `HYE-INV-260803` — everything an ID has in common with the day's siblings. */
export function dailyIdPrefix(kind, date) {
    return `${kind.token}-${dailyStamp(date, kind.yearDigits)}`;
}

/**
 * `HYE-INV-260803-02`, or with a child shape `HYE-PR-260710-07-001` /
 * `HYE-PR-260710-07-Q01`.
 *
 * One function for both because they are one shape with parameters: prefix,
 * separator, optional label, padded number. `seqPrefix` is what makes a
 * Quotation read as a labeled sub-sequence rather than as another numbered child.
 */
export function formatSequentialId(prefix, seq, { padLength = SEQ_PAD_LENGTH, seqPrefix = "" } = {}) {
    return `${prefix}${SEQ_SEPARATOR}${seqPrefix}${pad(seq, padLength)}`;
}

/**
 * The next sequence number for `prefix`, given the IDs already in the table:
 * HIGHEST EXISTING + 1, not count + 1.
 *
 * WHY MAX AND NOT COUNT (#164). A count is only the next free number while
 * nothing has been deleted, and deletion is normal here — invoices can be deleted
 * (#115) and PR Drafts can. Measured on the live base: `HYE-INV-260716` holds
 * seqs [02, 03] and `HYE-INV-260727` holds [03, 04], so three invoices have been
 * deleted, and in both of those namespaces count + 1 is a number that already
 * exists. A gap is a free number, not a wrong record; stepping over it is
 * cheaper than reusing one.
 *
 * CHILD IDS USE THIS TOO, and that sentence used to say they could not (#164
 * recorded it as a deliberate boundary, on the grounds that a parent's link array
 * holds record ids rather than child IDs). The boundary held only while nobody
 * paid for the second query; the same argument applies unchanged to children, and
 * the gap is produced by an ordinary Draft re-save rather than by a deletion
 * anyone chose. Measured: `HYE-PR-260722-09` holds exactly one PR Item, `-002`,
 * and exactly one Quotation, `-Q02`, so under count + 1 the next child of either
 * kind re-issued a number already on a live row. See generateChildId.
 *
 * THE CALLER'S QUERY NARROWS; THIS FUNCTION DECIDES. The daily path narrows with
 * `prefixMatch` and the child path narrows to the parent's own children, but
 * membership is re-tested here either way, so an over-matching narrowing costs
 * rows and cannot corrupt a number: a hand-typed `HYE-INV-260803X-01` starts with
 * the prefix and is still not a sibling.
 *
 * `seqPrefix` IS WHAT LETS ONE FUNCTION COVER BOTH SHAPES, and it is a
 * separator, not a filter to be lenient about. With `seqPrefix: ""` a
 * `...-07-Q01` is not a sibling of `...-07-001`, and with `seqPrefix: "Q"` the
 * plain `...-07-001` is not a sibling of `...-07-Q01` — two independent sequences
 * under one parent, which is what the live rows show (`HYE-PR-260722-09` carries
 * `-002` and `-Q02`, neither aware of the other).
 *
 * Past the pad width the sequence WIDENS rather than wrapping or colliding
 * (padStart does not truncate). The only `-99` rows on this base are hand-made
 * fixtures on prefixes no generator can produce — `HYE-PR-TESTQA` has no digit
 * date segment, and `HYE-PO-20260715` is in the past.
 */
export function nextSequence(existingIds, prefix, { seqPrefix = "" } = {}) {
    const head = `${prefix}${SEQ_SEPARATOR}${seqPrefix}`;
    let highest = 0;

    for (const id of existingIds || []) {
        if (typeof id !== "string" || !id.startsWith(head)) continue;
        const tail = id.slice(head.length);
        // Digits only, and the whole tail: a grandchild ID like `...-01-001` is
        // not a sibling, and neither is anything hand-typed with a suffix. With
        // no seqPrefix this is also what keeps `-Q01` out of the plain sequence.
        if (!/^\d+$/.test(tail)) continue;
        const seq = Number(tail);
        if (seq > highest) highest = seq;
    }

    return highest + 1;
}

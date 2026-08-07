// Building Airtable filterByFormula strings safely (#159).
//
// WHY THIS IS ITS OWN MODULE, and not part of lib/airtable/client.js where it
// started: client.js throws `Missing AIRTABLE_API_KEY` at module load, so a
// plain `node` check cannot import it, so the offline tier could not pin what
// this function actually DOES — only that call sites appear to call it.
// The escape being correct is the whole of this issue's claim, so it has to be
// testable without credentials. Same measured reason lib/authzWrap.js was split
// out of lib/authz.js in #147 (that one could not be imported without
// next/navigation), and the case CLAUDE.md already recorded as an open
// follow-up under "Pure predicates stuck behind a module-load side effect".
//
// Deliberately NOT re-exported from client.js. Two import paths for one rule is
// the same duplication in another form, and the offline check needs a single
// canonical source to compare call sites against.
//
// Imports nothing. Keep it that way.

/**
 * Escape a value for interpolation inside a DOUBLE-QUOTED Airtable formula
 * string literal — `{Field} = "${formulaString(value)}"`.
 *
 * Not a quoting nicety. An unescaped value is formula INJECTION: measured
 * read-only against this base (#18, #159), a `Vendor Name` of
 * `" & {Vendor Name} & "` turns `{Vendor Name} = "..."` into
 * `{Vendor Name} = {Vendor Name}` — true for every row — and the lookup returns
 * the table's FIRST record instead of the one asked for. On the auth path that
 * meant a crafted `token`, supplied by an unauthenticated caller, selected an
 * arbitrary Auth Tokens row rather than none — reaching the lookup on the public
 * /api/auth/verify then, and on the public /login/confirm page since #203. A
 * plain unescaped `"` merely 422s;
 * that is the benign case, not the interesting one.
 *
 * TWO CHARACTERS ARE THE COMPLETE SET, and that is measured rather than assumed
 * (#159, 17 hostile values against the live parser, each accepted and each
 * matching nothing): backslash and double quote. Inside a double-quoted literal
 * Airtable treats `\` as the escape character and `"` as the terminator, and
 * nothing else is special there — a real newline, a tab, `{Field}`, `'`, `&`,
 * `(`, `)`, `,`, `%`, `^` and non-ASCII all pass through as data once those two
 * are handled. See scripts/tests/verify-formula-escaping-159.mjs, which
 * re-measures it rather than trusting this comment.
 *
 * The backslash MUST be replaced first: doing the quote first would then have
 * its own added backslashes re-escaped, producing `\\"` — a literal backslash
 * followed by an unescaped terminator, i.e. the hole this exists to close.
 *
 * A nullish value becomes "" so an optional field can be passed straight
 * through, matching how the callers treat a blank.
 */
export function formulaString(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// OR-list builders (#19)
//
// A batched read needs `OR(<clause per id>)`, which is a list — so the value that
// gets interpolated at the call site is a joined string, not a single escaped
// value. That shape is invisible to scripts/tests/offline/formula-escaping.mjs:
// it can see `${chunk.map(...).join()}` is not a formulaString() call, and it
// fails closed, correctly, because from the AST there is no way to tell whether
// anything inside was escaped.
//
// The answer is NOT an exemption per call site — that is the weak kind of
// exemption #147 warned about, one that says "trust the code inside". Instead the
// list-building itself becomes an escape boundary that lives here, next to the
// escape, and the check accepts a call to one of these by name and verifies it
// was imported from this module. One audited implementation, two call sites, and
// the builders' own escaping is pinned by that check's behavioural half.
//
// They return a complete `OR(...)` fragment rather than a clause array so there
// is no way to interpolate the pieces and forget the wrapper.

/** Airtable rejects an empty OR(), and an empty id list should match nothing. */
const MATCH_NOTHING = "FALSE()";

/**
 * A `{Field}` reference for a formula.
 *
 * A field name is NOT a string literal in a formula, so formulaString would be
 * the wrong tool — quoting it would break the reference. A field name is always a
 * constant supplied by our own code, never user input, so the right treatment is
 * to REFUSE anything that could close the brace early rather than to escape it:
 * a caller passing a name with a brace in it is a bug, and throwing says so at
 * the call instead of quietly producing a formula that means something else.
 */
function fieldRef(fieldName) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
        throw new Error("airtableFormula: fieldName must be a non-empty string");
    }
    if (/[{}]/.test(fieldName)) {
        throw new Error(`airtableFormula: fieldName must not contain braces: ${fieldName}`);
    }
    return `{${fieldName}}`;
}

/**
 * `OR(RECORD_ID() = "...", ...)` over a record-id list.
 *
 * RECORD_ID() rather than a `_Record ID` formula field because not every table
 * has one (PO Items does not) and adding it is a schema change. This is not the
 * case CLAUDE.md's parent/child rule forbids — that is about matching a LINK
 * field against a record id; this compares a row's own id, which Airtable
 * supports (measured, #19).
 */
export function orByRecordId(ids) {
    const clauses = (ids || [])
        .filter(Boolean)
        .map((id) => `RECORD_ID() = "${formulaString(id)}"`);
    return clauses.length === 0 ? MATCH_NOTHING : `OR(${clauses.join(", ")})`;
}

/**
 * `OR({Field} = "...", ...)` over a value list.
 *
 * The FIELD NAME is not a string literal in the formula — it is a `{...}`
 * reference — so formulaString would be the wrong tool for it and quoting it
 * would break the reference. A field name is always a constant supplied by our
 * own code, never user input, so the right treatment is to refuse anything that
 * could close the brace early rather than to try to escape it: a caller passing
 * a name with `}` or `{` in it is a bug, and a throw says so at the call rather
 * than producing a formula that means something else.
 */
export function orByField(fieldName, values) {
    const ref = fieldRef(fieldName);
    const clauses = (values || [])
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => `${ref} = "${formulaString(v)}"`);
    return clauses.length === 0 ? MATCH_NOTHING : `OR(${clauses.join(", ")})`;
}

/**
 * `AND(SEARCH("a", LOWER({Field})), SEARCH("b", LOWER({Field})))` — every needle
 * must appear somewhere in the field, case-insensitively (#19's search).
 *
 * AND rather than OR because each extra word a user types should NARROW the
 * result; OR would make a longer query return more, which is the opposite of
 * what typing more means. Order-independent as a consequence, which is the point:
 * `2" pipe` and `pipe 2"` are the same query.
 *
 * Needles are expected already lower-cased by the caller (buildSearchTokens does
 * it) since only the haystack is lowered here — LOWER() on both sides would work
 * too but would hide where the case-folding decision lives.
 *
 * No needles matches NOTHING, not everything: an empty search is not a request
 * for the whole table.
 */
export function andSearchAll(fieldName, needles) {
    const ref = fieldRef(fieldName);
    const clauses = (needles || [])
        .filter((n) => n !== null && n !== undefined && n !== "")
        .map((n) => `SEARCH("${formulaString(n)}", LOWER(${ref}))`);
    return clauses.length === 0 ? MATCH_NOTHING : `AND(${clauses.join(", ")})`;
}

/**
 * `FIND("HYE-INV-260803", {Invoice ID}) = 1` — the rows whose field STARTS WITH
 * `prefix` (#164). One whole predicate, built here for the same reason the OR-list
 * builders are: the alternative was a per-call-site exemption saying "trust the
 * code inside", the weak shape #147 warned about.
 *
 * `FIND(needle, haystack)` returns the 1-based position of the first occurrence,
 * so `= 1` is an anchored prefix test, and 0 (not found) fails it. Measured
 * read-only against the live base (#164): 2 of 2 rows on a real Invoice ID prefix,
 * 0 rows on an unused one, and case-sensitive — a lowercased needle matched
 * nothing, which is what a generated uppercase ID wants.
 *
 * NOT `LEFT({Field}, 13) = prefix`, the form #164 was filed with. Measured, that
 * matched 0 rows: the prefix is 14 characters, not 13. A hard-coded length is a
 * per-family magic number (PR 13, PO 15, Invoice 14, Delivery 13) that was already
 * written down wrong twice, and `LEN()` around an interpolated value would mean
 * escaping the same value into the formula twice. FIND takes the anchor from the
 * string itself.
 *
 * An EMPTY prefix would make `FIND("", ...)` match every row — the whole-table
 * answer that MATCH_NOTHING exists to avoid elsewhere — so it is refused. A caller
 * with no prefix has a bug, not a query.
 */
export function prefixMatch(fieldName, prefix) {
    const ref = fieldRef(fieldName);
    if (typeof prefix !== "string" || prefix.length === 0) {
        throw new Error("airtableFormula: prefixMatch needs a non-empty prefix");
    }
    return `FIND("${formulaString(prefix)}", ${ref}) = 1`;
}

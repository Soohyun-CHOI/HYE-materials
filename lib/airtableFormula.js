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
 * meant a crafted `token` query param on the public /api/auth/verify selected an
 * arbitrary Auth Tokens row rather than none. A plain unescaped `"` merely 422s;
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

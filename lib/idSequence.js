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

/** Every generated sequence is zero-padded to this width. See widening below. */
export const SEQ_PAD_LENGTH = 2;

/** The separator between the daily prefix and the sequence number. */
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

/** `HYE-INV-260803-02`. */
export function formatSequentialId(prefix, seq) {
    return `${prefix}${SEQ_SEPARATOR}${pad(seq, SEQ_PAD_LENGTH)}`;
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
 * cheaper than reusing one. This is the same defect CLAUDE.md records for
 * PO Item IDs, which still count — they count the parent's link array, which
 * holds record ids rather than child IDs, so max is not available there without
 * another query. That boundary is deliberate, not an oversight.
 *
 * THE CALLER'S FORMULA NARROWS; THIS FUNCTION DECIDES. `prefixMatch` exists to
 * avoid reading the whole table, but membership is re-tested here, so a formula
 * that over-matches costs rows and cannot corrupt a number: a hand-typed
 * `HYE-INV-260803X-01` starts with the prefix and is still not a sibling.
 *
 * Past 99 the sequence WIDENS to three digits rather than wrapping or colliding
 * (padStart does not truncate). The only `-99` rows on this base are hand-made
 * fixtures on prefixes no generator can produce — `HYE-PR-TESTQA` has no digit
 * date segment, and `HYE-PO-20260715` is in the past.
 */
export function nextSequence(existingIds, prefix) {
    const head = `${prefix}${SEQ_SEPARATOR}`;
    let highest = 0;

    for (const id of existingIds || []) {
        if (typeof id !== "string" || !id.startsWith(head)) continue;
        const tail = id.slice(head.length);
        // Digits only, and the whole tail: a child ID like `...-01-001` is not a
        // sibling, and neither is anything hand-typed with a suffix.
        if (!/^\d+$/.test(tail)) continue;
        const seq = Number(tail);
        if (seq > highest) highest = seq;
    }

    return highest + 1;
}

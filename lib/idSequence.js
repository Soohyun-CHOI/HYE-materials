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
 * The top-level daily-reset ID families.
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
 * EVERY FAMILY WRITES A 2-DIGIT YEAR, AND `PO` WAS THE ONE THAT DID NOT (#313).
 *
 * THE OBSERVATION BEHIND THE OLD WIDTH IS TRUE AND IS KEPT: the company's own
 * purchase order numbers, issued before this app existed, carry a 4-digit year —
 * confirmed from real invoice samples — and the generator was given a `yearDigits: 4`
 * of its own so a generated PO ID would match them.
 *
 * WHAT WAS FALSE IS THAT THE MATCH WAS A CONSTRAINT. A PO ID is a number WE assign
 * and send out; the vendor receives the document and transcribes what is printed on
 * it. Nothing outside this company parses the format, and those vendors already deal
 * with other customers whose numbers look nothing alike — so there is no reader whose
 * expectations the width was satisfying. It was our convention agreeing with our own
 * older convention, which is a preference rather than an external requirement, and it
 * cost the one exception in a base where every other document writes `YYMMDD`.
 *
 * #313 MOVED IT, and rewrote the 37 orders and 39 ordered items already carrying the
 * long form so nothing this app stores is written two ways. Written down here rather
 * than deleted because the invoice samples are still on somebody's desk, and the next
 * person to see one will ask this question again.
 *
 * SO `yearDigits` IS GONE FROM THIS REGISTRY RATHER THAN SET TO 2 SIX TIMES. It was a
 * per-family width with exactly one family turning it, and with that family moved it
 * became a knob nobody turns — which is also how the one exception could be
 * reintroduced by a single character. The stamp has one shape now, and `dailyStamp`
 * takes no width. **If a family ever does need its own, `padLength` two entries below
 * is the mechanism to copy**: declared per family, read through a default, so adding
 * one changes nothing for the families that declare none.
 */
export const ID_KINDS = {
    PR: { token: "HYE-PR", idField: "PR ID" },
    PO: { token: "HYE-PO", idField: "PO ID" },
    INVOICE: { token: "HYE-INV", idField: "Invoice ID" },
    DELIVERY: { token: "HYE-DL", idField: "Delivery ID" },
    // #272 — the fifth, and it takes the rule as it stands rather than bending it.
    // A direct purchase carries the vendor's own `Issue Date`, which is copied off
    // their document and can be months old, so a counter reading a date field
    // would land several rows on one id — #164's defect with a worse input than
    // the one that produced it.
    DIRECT_PURCHASE: { token: "HYE-DP", idField: "Direct Purchase ID" },
    // #335 — THE SIXTH, AND THE FIRST TO CARRY A WIDTH OF ITS OWN. Everything above
    // takes `SEQ_PAD_LENGTH`, which is 2 and stays 2: `padLength` is read through
    // `formatSequentialId`'s default, so a family that does not declare one is
    // untouched by this entry existing. That is the whole mechanism, and it is the
    // same one `CHILD_KINDS` below already uses per relation.
    //
    // 3 BECAUSE ONE REGISTRATION CREATES MANY. Every other family here is a
    // document somebody raises one at a time, and none has needed more than a
    // handful in a day; a tool registration takes a quantity, and the first day of
    // use is a warehouse's whole stock arriving at once. 3 is also not a new number
    // on this base — seven of the nine child relations already pad to it.
    //
    // IT IS NOT A CEILING. `formatSequentialId` pads with `padStart`, which does
    // not truncate, and `nextSequence` parses the whole tail — so the 1000th tool
    // item of one day is `-1000` rather than a collision. The width is a statement
    // about how the common case READS, and getting it wrong would cost a reprint
    // rather than a duplicate.
    TOOL_ITEM: { token: "HYE-TL", idField: "Tool Item ID", padLength: 3 },
};

/** Separator in a CHILD_KINDS key. Two colons, because no field name has one. */
const CHILD_KEY_SEPARATOR = "::";

/** The CHILD_KINDS key for one parent→child relation. */
export function childKeyFor(parentTableName, parentLinkFieldName) {
    return `${parentTableName}${CHILD_KEY_SEPARATOR}${parentLinkFieldName}`;
}

/**
 * The nine child ID shapes, keyed on `Parent Table::Link Field` — the pair the
 * relation actually is, and both halves of which every call site already passes.
 *
 * This is a registry rather than nine sets of arguments because the shape of a
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
 *   PR Edit Log      Users, Purchase Requests*
 *   PO Items         Purchase Orders*, Materials
 *   Invoice Items    Purchase Orders, PO Items, Invoices*
 *   Delivery Items   PO Items, Materials, Deliveries*
 *   (* = the parent the shape is registered for. Only "PR Edit Requests",
 *    on Purchase Requests alone, is unique. 18 of the base's 50 link-field
 *    names are shared by two or more tables, so this is the norm here, not a
 *    near miss. The two names in this census that read `PR Edit` were
 *    `Correction Requests` and `Edit Log` when it was taken; #333 renamed both
 *    tables and their reverse links, which moved the names and no figure.)
 *
 * THE NINTH RELATION ARRIVED ALREADY SHARED, which is the census confirming
 * itself rather than a coincidence (#334, measured on the tables that issue
 * creates). `Tool Log` is carried by THREE tables the moment it exists —
 * `Tool Items."Tool Log"` is the registered parent, and `Users."Tool Log"` and
 * `Jobs."Tool Log"` are the inverses of `Tool Log."Recorded By"` and
 * `Tool Log."Job"`. So the count above reads 8 of 9, and a key of the bare field
 * name would have had three candidates to be wrong about instead of two. The
 * 2026-08-03 base-wide figures are left as measured; three tables and five link
 * fields have been added since.
 *
 * Nothing collided only because exactly one table per name is a REGISTERED
 * relation — a property of which call sites exist, not of the schema, and one
 * that a tenth child table could end tomorrow. `Materials."PO Items"` and
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
 * not here — so a tenth child table cannot ship unregistered, cannot ship still
 * passing a shape of its own, and cannot ship as a duplicate key, which that check
 * detects on this object's AST rather than on the collapsed object.
 */
export const CHILD_KINDS = {
    "Purchase Requests::PR Items": { idField: "PR Item ID", padLength: 3 },
    "Purchase Requests::PR Signers": { idField: "PR Signer ID", padLength: 3 },
    // 2 digits and a "Q", so a Quotation reads as a labeled sub-sequence
    // (HYE-PR-260710-07-Q01) rather than as another numbered child.
    "Purchase Requests::Quotations": { idField: "Quotation ID", padLength: 2, seqPrefix: "Q" },
    "Purchase Requests::PR Edit Requests": { idField: "PR Edit Request ID", padLength: 3 },
    "Purchase Requests::PR Edit Log": { idField: "PR Edit Log ID", padLength: 3 },
    "Purchase Orders::PO Items": { idField: "PO Item ID", padLength: 3 },
    "Invoices::Invoice Items": { idField: "Invoice Item ID", padLength: 3 },
    "Deliveries::Delivery Items": { idField: "Delivery Item ID", padLength: 3 },
    // #334 — the ninth, and it takes the shape the other eight take. Registered in
    // the issue that CREATES the table rather than in the one that first writes a
    // row, because the alternative was stating `{Tool Item ID}-{seq}` in the field
    // description and having the next issue read it back out of Airtable — a shape
    // written twice, in two places neither of which can check the other.
    // lib/airtable/toolLog.js:createToolLogEntry is the call site that makes this
    // entry legal; offline/id-sequence.mjs requires one and does not ask whether
    // anything calls IT.
    "Tool Items::Tool Log": { idField: "Tool Log ID", padLength: 3 },
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
 * `YYMMDD` for a given moment.
 *
 * ONE SHAPE SINCE #313. This took a `yearDigits` and branched on 4 for the one
 * family that wanted a four-digit year; every family writes the same stamp now, so
 * the parameter is gone rather than defaulted — see ID_KINDS for why the width
 * stopped being a per-family property at all.
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
export function dailyStamp(date) {
    const y = String(date.getFullYear()).slice(-2);
    const m = pad(date.getMonth() + 1, 2);
    const d = pad(date.getDate(), 2);
    return `${y}${m}${d}`;
}

/** The digits in a daily stamp: two for the year, two each for month and day. */
const STAMP_DIGITS = 6;

/** `HYE-INV-260803` — everything an ID has in common with the day's siblings. */
export function dailyIdPrefix(kind, date) {
    return `${kind.token}-${dailyStamp(date)}`;
}

/**
 * A fresh `RegExp` matching one family's minted IDs wherever they appear in text.
 *
 * IT EXISTS SO THE ONE READER THAT SCANS FOR IDS TAKES ITS WIDTHS FROM THE FAMILY.
 * `app/api/invoices/detect-po/route.js` reads a vendor's invoice PDF and pulls out
 * the purchase orders it quotes; that regex spelled `HYE-PO-\d{8}-\d{2}` by hand, so
 * #313 moving the year width would have left it matching a form nothing mints and
 * missing every form everything does — a screen that silently stops detecting, with
 * no error to notice.
 *
 * A NEW OBJECT PER CALL, DELIBERATELY. The `g` flag carries `lastIndex` between
 * uses, so a module-level constant shared by two scans starts the second one
 * wherever the first stopped. Building it per call costs nothing at this size and
 * removes the only way to use it wrongly.
 *
 * THE SEQUENCE IS `{n,}` RATHER THAN `{n}`, which corrects the hand-written version
 * rather than reproducing it. `formatSequentialId` pads with `padStart` and
 * `nextSequence` parses the whole tail, so the 100th order of a day is `-100` — and
 * a fixed-width regex would have matched `-10` of it and looked the id up as a
 * different order. Greedy, so it takes the whole run; a child id's own suffix sits
 * behind a separator and is left alone, which is what makes a quoted
 * `HYE-PO-260911-33-001` resolve to the order it belongs to.
 */
export function idPattern(kind) {
    const seq = kind.padLength ?? SEQ_PAD_LENGTH;
    return new RegExp(`${kind.token}${SEQ_SEPARATOR}\\d{${STAMP_DIGITS}}${SEQ_SEPARATOR}\\d{${seq},}`, "g");
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
 * `count` consecutive IDs starting at `startSeq` (#335).
 *
 * WHY THE OFF-BY-ONE LIVES HERE AND NOT AT THE CALL SITE. One tool registration
 * creates many tool items, and the ids have to be contiguous from the sequence
 * the query found — `startSeq` through `startSeq + count - 1`, inclusive at both
 * ends. That is one arithmetic decision, it is the kind that is wrong by one
 * without anything failing, and putting it in the pure module is what lets
 * scripts/tests/offline/id-sequence.mjs pin it against a literal. lib/ids.js
 * holds the lock and the query; this holds what the numbers are.
 *
 * REFUSES A NON-POSITIVE COUNT rather than returning an empty array. A caller
 * asking for zero ids has computed a quantity wrong, and handing it `[]` would
 * let a registration report success having created nothing.
 */
export function formatSequentialIds(prefix, startSeq, count, options = {}) {
    if (!Number.isInteger(count) || count < 1) {
        throw new Error(`idSequence: count must be a positive integer, got ${count}`);
    }
    return Array.from({ length: count }, (_, i) => formatSequentialId(prefix, startSeq + i, options));
}

/**
 * The sequence number `id` carries under `prefix`, or null when it is not one of
 * that prefix's own IDs.
 *
 * THE ONE READING OF A SEQUENCE, AND IT HAS TWO READERS SINCE #40. `nextSequence`
 * below takes the highest of them, and `lib/poQuotations.js` orders a request's
 * quotations by them, because a string sort of `{PR ID}-Q{seq}` is right only while
 * the number fits its padding: `formatSequentialId` pads with `padStart`, which does
 * not truncate, so the hundredth is `-Q100` and sorts ahead of `-Q11`. One parse
 * means the two cannot come to disagree about which string is a sibling.
 *
 * Digits only, and the whole tail: a grandchild ID like `...-01-001` is not a
 * sibling, and neither is anything hand-typed with a suffix. With no `seqPrefix`
 * this is also what keeps `-Q01` out of the plain sequence.
 */
export function sequenceOf(id, prefix, { seqPrefix = "" } = {}) {
    const head = `${prefix}${SEQ_SEPARATOR}${seqPrefix}`;
    if (typeof id !== "string" || !id.startsWith(head)) return null;
    const tail = id.slice(head.length);
    return /^\d+$/.test(tail) ? Number(tail) : null;
}

/**
 * The next sequence number for `prefix`, given the IDs already in the table:
 * HIGHEST EXISTING + 1, not count + 1.
 *
 * WHY MAX AND NOT COUNT (#164). A count is only the next free number while
 * nothing has been deleted, and deletion is normal here — invoices can be deleted
 * (#115) and PR Drafts can. Measured on the live base: `HYE-INV-260716` held
 * seqs [02, 03] and `HYE-INV-260727` held [03, 04], so three invoices had been
 * deleted, and in both of those namespaces count + 1 is a number that already
 * exists. A gap is a free number, not a wrong record; stepping over it is
 * cheaper than reusing one.
 *
 * CHILD IDS USE THIS TOO, and that sentence used to say they could not (#164
 * recorded it as a deliberate boundary, on the grounds that a parent's link array
 * holds record ids rather than child IDs). The boundary held only while nobody
 * paid for the second query; the same argument applies unchanged to children, and
 * the gap is produced by an ordinary Draft re-save rather than by a deletion
 * anyone chose. Measured: `HYE-PR-260722-09` held exactly one PR Item, `-002`,
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
 * under one parent, which is what the live rows showed (`HYE-PR-260722-09` carried
 * `-002` and `-Q02`, neither aware of the other).
 *
 * Past the pad width the sequence WIDENS rather than wrapping or colliding
 * (padStart does not truncate). The only `-99` rows on this base are hand-made
 * fixtures on prefixes no generator can produce — `HYE-PR-TESTQA` has no digit
 * date segment, and `HYE-PO-260715` is in the past.
 */
export function nextSequence(existingIds, prefix, { seqPrefix = "" } = {}) {
    let highest = 0;

    for (const id of existingIds || []) {
        // `sequenceOf` is the membership test as well as the reading — see it.
        const seq = sequenceOf(id, prefix, { seqPrefix });
        if (seq !== null && seq > highest) highest = seq;
    }

    return highest + 1;
}

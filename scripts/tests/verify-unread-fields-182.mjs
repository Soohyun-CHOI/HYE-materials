// Which Airtable fields nothing reads (#182). Credentialed, READ-ONLY.
//
// ONE Metadata call, no record operations, creates nothing, deletes nothing,
// mints no session and consumes no token — so it is the cheapest script in this
// tier by two orders of magnitude and can be run whenever a schema change lands.
// That is the point: inventory adds two tables and several rollups, and a field
// with no reader is cheapest to notice on the day it is created.
//
// WHAT COUNTS AS A READER, and the base half is exact rather than a text scan.
// Airtable hands every formula and rollup its `options.referencedFieldIds`, so
// which fields an expression reads is answered by the platform instead of by
// parsing. That matters here: `airtable-access.md` measured that of 18 formula
// fields the API renders 12 with `{fldXXXXXXXXXXXXXX}` and 6 with `{Field Name}`,
// so a scan of formula TEXT has to handle both spellings and would miss a field
// renamed between the two. The id list has no such seam. #356 established the
// question — whether anything referenced `Materials."Item Name"` before retyping
// it — and this is that question asked for every field at once.
//
//   * a formula or rollup lists the field in `options.referencedFieldIds`
//   * a lookup or rollup reaches it as `options.fieldIdInLinkedTable`
//   * a link field names it as `options.inverseLinkFieldId`
//   * it is its table's `primaryFieldId`
//   * `app/` or `lib/` carries its name as a QUOTED STRING — `record.get("X")`,
//     a `fields:` projection, a `parentLinkFieldName`
//   * `app/` or `lib/` carries it as `{X}` inside a formula template, which is
//     NOT a quoted string and is how `Material Prices."Vendor Record ID"` reads.
//     The first version of this had only the quoted form and reported that field
//     as unread; the brace form is the fix and is why both are listed.
//
// WHAT IT CANNOT ANSWER, AND THE LIST IS SHORTER THAN IT LOOKS BUT NOT EMPTY.
// **The Metadata API returns `id`, `name` and `type` per view and no filter
// configuration at all** — measured, every view on this base is a `grid` — so a
// field read only by a view's filter, sort or grouping is invisible here and
// would be reported as unread. Same for an Airtable automation and for an
// interface. So a finding is a QUESTION for a person with the base open, never a
// verdict, and this script prints it as one. The repo half has the usual limit
// one level down: a name carried in a variable rather than written as a literal
// is not seen, which is the same blindness `airtable-access.md` records for the
// field-rename procedure.
//
// EXIT CODES, per verification.md: 0 when nothing is unread, 1 when something is,
// 2 when a part could not run. There are no fixtures, so there is no leak verdict
// and no `_fixtures.mjs` contract to go through — this script creates nothing.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-unread-fields-182 — which Airtable fields nothing reads (questions, not a verdict)" });

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;

/** Tiers whose mention of a field name counts as a reader. */
const READER_DIRS = [(f) => f.startsWith("app/"), (f) => f.startsWith("lib/")];

async function readSchema() {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Metadata API ${res.status}: ${await res.text()}`);
    return (await res.json()).tables;
}

/** Every field id any other field reaches, with what reaches it. */
function baseSideReaders(tables) {
    const readers = new Map();
    const add = (id, why) => {
        if (!id) return;
        if (!readers.has(id)) readers.set(id, []);
        readers.get(id).push(why);
    };
    for (const t of tables) {
        for (const f of t.fields) {
            const o = f.options || {};
            for (const rid of o.referencedFieldIds || []) add(rid, `${t.name}."${f.name}" (${f.type})`);
            if (o.fieldIdInLinkedTable) add(o.fieldIdInLinkedTable, `${t.name}."${f.name}" (${f.type}, through its link)`);
            if (o.inverseLinkFieldId) add(o.inverseLinkFieldId, `${t.name}."${f.name}" is its inverse`);
        }
    }
    return readers;
}

/** The two repo spellings, over `app/` + `lib/` only. */
function repoReader(name, blob) {
    const quoted = blob.includes(`"${name}"`) || blob.includes(`'${name}'`) || blob.includes("`" + name + "`");
    const braced = blob.includes(`{${name}}`);
    if (quoted && braced) return "a quoted string and a {brace} reference";
    if (quoted) return "a quoted string";
    if (braced) return "a {brace} reference in a formula";
    return null;
}

async function main() {
    if (!BASE_ID || !API_KEY) {
        console.error("Missing AIRTABLE_BASE_ID / AIRTABLE_API_KEY — run with --env-file=.env.local");
        process.exit(2);
    }

    const tables = await readSchema();
    const readers = baseSideReaders(tables);

    const tracked = execSync("git ls-files", { maxBuffer: 1 << 28 }).toString().trim().split("\n");
    const sources = tracked.filter((f) => /\.(js|jsx|mjs)$/.test(f) && READER_DIRS.some((p) => p(f)));
    const blob = sources
        .map((f) => {
            try {
                return readFileSync(f, "utf8");
            } catch {
                return "";
            }
        })
        .join("\n");

    let fieldCount = 0;
    const unread = [];
    const viewCount = tables.reduce((n, t) => n + t.views.length, 0);
    for (const t of tables) {
        for (const f of t.fields) {
            fieldCount += 1;
            if (f.id === t.primaryFieldId) continue;
            if ((readers.get(f.id) || []).length > 0) continue;
            if (repoReader(f.name, blob)) continue;
            unread.push({ table: t.name, field: f.name, type: f.type });
        }
    }

    console.log(`Fields with no reader (#182) — ${tables.length} tables, ${fieldCount} fields, ${sources.length} source files`);
    console.log("");
    if (unread.length === 0) {
        console.log("  none — every field is a primary, is reached by a formula, rollup, lookup or");
        console.log("  inverse link, or is named in app/ or lib/.");
    } else {
        for (const u of unread) console.log(`  ${u.table} -> "${u.field}" (${u.type})`);
    }
    console.log("");
    console.log(`  NOT ASKED: ${viewCount} views. The Metadata API returns id/name/type per view and no`);
    console.log("  filter configuration, so a field read only by a view filter, an automation or an");
    console.log("  interface looks unread here. Each line above is a question for somebody with the");
    console.log("  base open, not a verdict — and nothing in this base is removed as tidying-up.");
    console.log("");
    console.log(`  Airtable operations: 1 Metadata read. Records created: 0. Records deleted: 0.`);

    process.exit(unread.length === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(2);
});

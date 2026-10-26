// Links each catalog row to its category group (issue #539), and keeps a ledger it can be undone by.
//
// WHAT CHANGES. A row of `Asset Categories` names its type and its category as text, `Level 1` and
// `Level 2`, which has to match a row of `Asset Category Groups` (#528) — so a category renamed in
// Airtable was retyped on every item under it, by hand. This makes `Category Group`, a link from
// each catalog row to the group it is filed under, and fills it from the two typed values. Once
// every row is linked, `Level 1` and `Level 2` become lookups through it: a field's type is not
// PATCHable, so that is a hand step in the Airtable UI (docs/notes/airtable-access.md), made on
// both bases after this has run on each, and from then on a category is renamed in one place.
//
// THE FIELD IS THIS RUN'S, AND SO IS ITS FAR SIDE. Creating a link creates its symmetric field on
// the far table, named after the source table; it is kept as `Asset Categories`, and both get
// their descriptions here. A link to one record cannot be asked for through the Metadata API —
// `prefersSingleRecordLink` was refused on create in #334 and #385 — so the create asks for it,
// prints the answer, and on a refusal creates the link without it and prints the hand step.
//
// EACH ROW TAKES THE GROUP ITS PAIR NAMES, `lib/assetCategory.js:categoryGroupOf`, and a row the run
// cannot account for refuses the whole run before anything is written — the plan module's header
// says which and why. A second run finds every row linked and writes nothing.
//
// A LEDGER, COMMITTED, WRITTEN AHEAD OF EVERY REQUEST: the run, the field once made, and each
// row's name, its two typed levels, its link before and after, ten to a request, each line on disk
// before its request leaves. `--revert <ledger>` puts each link back to what the ledger says it
// held, refusing a row linked otherwise since, and keeps a ledger of its own. It refuses while
// `Level 1` and `Level 2` are lookups — emptying a link would empty the levels it reads — so the
// hand step back comes first. It cannot remove the field, which the Metadata API offers no delete
// for: that is a hand step too, and so is the far side the deletion leaves behind as text (#384).
//
// IT WRITES NEITHER TABLE THE SITE'S RECORDS ARE IN (#531). It reads and writes `Asset Categories`
// and `Asset Category Groups` alone, by name, and no field of either that points elsewhere — so
// `scripts/protectedTables.mjs` has nothing here to refuse, and `offline/protected-tables.mjs`
// nothing to classify.
//
// IT TALKS TO THE REST API DIRECTLY, as the catalog's other scripts do: the schema half has no SDK.
// lib/airtableOps.js cannot see these calls, so the run counts them, and paces them a quarter of a
// second apart, under Airtable's five a second.
//
// Usage (from the repo root). Dry run is the DEFAULT, for a run and for a revert:
//   node --env-file=.env.local scripts/import/ran/link_category_groups_539.mjs
//   node --env-file=.env.local scripts/import/ran/link_category_groups_539.mjs --apply
//   node --env-file=.env.local scripts/import/ran/link_category_groups_539.mjs --revert <ledger.jsonl> [--apply]
// The live base is named per command, after Soo has approved its dry run (#534):
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/link_category_groups_539.mjs
//
// No loader flag: this file, its plan and lib/assetCategory.js import only built-ins and files
// whose extension they spell.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 every row is linked to its group by a link to one
// record (or a revert left nothing to put back); 1 something failed or was refused; 2 nothing
// failed but something is still to do — a write a dry run would make, or the hand step.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { ASSET_CATEGORY_FIELDS, CATEGORY_GROUP_FIELD } from "../../../lib/assetCategory.js";
import {
    CATALOG_TABLE,
    GROUPS_TABLE,
    GROUP_LEVEL_FIELDS,
    INVERSE_DESCRIPTION,
    INVERSE_NAME,
    LINK_DESCRIPTION,
    NAME_FIELD,
    SCRIPT,
    SINGLE_LINK_STEP,
    catalogRowOf,
    groupRowOf,
    inChunks,
    linkLine,
    pairOf,
    planLinks,
    planRevert,
    readLedger,
    readLinks,
    schemaState,
    unlinkLine,
} from "../link_category_groups_539_plan.mjs";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;
const LEDGERS = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/** The gap held between the starts of two requests: four a second, under Airtable's five. */
const REQUEST_GAP_MS = 250;

class Airtable {
    constructor(token, baseId) {
        this.baseId = baseId;
        this.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        this.calls = 0;
        this.next = 0;
    }

    /** One request, paced; `answer` hands back a refusal's status and text instead of throwing. */
    async request(method, url, body, { answer = false } = {}) {
        const wait = this.next - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        this.next = Date.now() + REQUEST_GAP_MS;
        this.calls++;
        const response = await fetch(url, { method, headers: this.headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const text = await response.text();
        if (answer) return { status: response.status, ok: response.ok, text, json: text === "" ? null : safeJson(text) };
        if (!response.ok) throw new Error(`${method} ${url.replace(this.baseId, "{base}")} -> ${response.status} ${text}`);
        return text === "" ? null : JSON.parse(text);
    }

    /** Both tables, as the Metadata API returns them, with each view's visible fields. */
    async tables() {
        const { tables } = await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables?include=visibleFieldIds`);
        return { catalog: tables.find((t) => t.name === CATALOG_TABLE) ?? null, groups: tables.find((t) => t.name === GROUPS_TABLE) ?? null };
    }

    createField(tableId, field) {
        return this.request("POST", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields`, field, { answer: true });
    }

    patchField(tableId, fieldId, patch) {
        return this.request("PATCH", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields/${fieldId}`, patch);
    }

    async listRecords(tableId, fields) {
        const out = [];
        let offset;
        do {
            const params = new URLSearchParams({ pageSize: "100" });
            for (const f of fields) params.append("fields[]", f);
            if (offset) params.set("offset", offset);
            const page = await this.request("GET", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
            out.push(...page.records);
            offset = page.offset;
        } while (offset);
        return out;
    }

    /** The batch form, which refuses an id that is not this table's (docs/notes/airtable-access.md). */
    updateRecords(tableId, records) {
        return this.request("PATCH", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }
}

function safeJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function log(message = "") {
    console.log(message);
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} Airtable API call(s). ${verdict}.`);
    return code;
}

/** A ledger, opened with its first line: each later line is appended before the request it records. */
function openLedger(name, first) {
    const path = join(LEDGERS, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const write = (line) => appendFileSync(path, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`, "utf8");
    write(first);
    return { path, write };
}

/** The catalog's rows as this run reads them — the link only once it exists, since a read naming a missing field is refused whole (#507). */
async function readRows(air, catalog, state) {
    const fields = [NAME_FIELD, ...GROUP_LEVEL_FIELDS, ...(state.link ? [CATEGORY_GROUP_FIELD] : [])];
    return (await air.listRecords(catalog.id, fields)).map(catalogRowOf);
}

async function readGroups(air, groups) {
    return (await air.listRecords(groups.id, GROUP_LEVEL_FIELDS)).map(groupRowOf);
}

/** Whether a view shows a field, for the office's look at the base after a field is made. */
function visibility(table, field) {
    if (!table || !field) return [];
    return table.views.filter((view) => Array.isArray(view.visibleFieldIds)).map((view) => `${JSON.stringify(view.name)} ${view.visibleFieldIds.includes(field.id) ? "shows" : "hides"} it`);
}

/** The single-record state of the link and its hand step, said; true while the step is outstanding. */
function singleLinkOutstanding(state) {
    if (!state.link) return false;
    if (state.link.options?.prefersSingleRecordLink === true) {
        log(`  ${CATEGORY_GROUP_FIELD} links one record.`);
        return false;
    }
    log(`  ${CATEGORY_GROUP_FIELD} still allows several records — the hand step: ${SINGLE_LINK_STEP}`);
    return true;
}

function printProblems(problems) {
    log(`  ${problems.length} row(s) the run cannot account for, for the office to settle first:`);
    for (const { row, line, why } of problems) log(`    ${(row ?? line).id}  ${JSON.stringify((row ?? line).itemName)} — ${why}`);
}

async function run(air, apply, baseLabel) {
    let { catalog, groups } = await air.tables();
    let state = schemaState(catalog, groups);
    if (state.problems.length > 0) {
        for (const problem of state.problems) log(`  ${problem}`);
        return finish(air, 1, "the base is not one this recognizes");
    }

    if (state.levels === "looked up") {
        log(`${GROUP_LEVEL_FIELDS.join(" and ")} are lookups through ${CATEGORY_GROUP_FIELD}: the links are the record, and there is nothing to fill.`);
        const { linked, problems } = readLinks(await readRows(air, catalog, state));
        log(`  ${linked.length} row(s) linked to one group.`);
        if (problems.length > 0) {
            printProblems(problems);
            return finish(air, 1, "a row reads no type and no category");
        }
        return finish(air, singleLinkOutstanding(state) ? 2 : 0, "every row is filed under one group");
    }

    const rows = await readRows(air, catalog, state);
    const groupRows = await readGroups(air, groups);
    const p = planLinks(rows, groupRows);
    log(`${rows.length} catalog row(s), ${groupRows.length} group row(s).`);
    log(`  ${p.linked.length} linked to the group their pair names already, ${p.writes.length} to link.`);
    for (const { row, group } of p.respelled) log(`  [SPELLING] ${row.id} reads ${JSON.stringify(pairOf(row))}, its group ${JSON.stringify(pairOf(group))} — the group's once the levels read through the link`);
    if (p.problems.length > 0) {
        printProblems(p.problems);
        return finish(air, 1, "refused before writing anything");
    }

    const inverseDue = state.link && (state.inverse?.name !== INVERSE_NAME || (state.inverse?.description ?? "") !== INVERSE_DESCRIPTION);
    const linkDescriptionDue = state.link && (state.link.description ?? "") !== LINK_DESCRIPTION;
    const due = (state.link ? 0 : 1) + (inverseDue ? 1 : 0) + (linkDescriptionDue ? 1 : 0) + p.writes.length;
    if (!state.link) log(`  [WOULD]  create ${CATALOG_TABLE}.${CATEGORY_GROUP_FIELD}, a link to ${GROUPS_TABLE}, its far side ${INVERSE_NAME}`);
    if (inverseDue) log(`  [WOULD]  name and describe ${GROUPS_TABLE}.${state.inverse?.name ?? "(its far side)"} as ${INVERSE_NAME}`);
    if (linkDescriptionDue) log(`  [WOULD]  update ${CATEGORY_GROUP_FIELD}'s description`);
    for (const { row, group } of p.writes) log(`  [WOULD]  ${row.id}  ${JSON.stringify(row.itemName)} → ${group.id} ${pairOf(group)}`);

    if (!apply) {
        if (due > 0) return finish(air, 2, `dry run — ${due} write(s) due, nothing was written`);
        return finish(air, singleLinkOutstanding(state) ? 2 : 0, "every row is linked to the group its pair names");
    }
    if (due === 0) return finish(air, singleLinkOutstanding(state) ? 2 : 0, "nothing due: every row is linked to the group its pair names");

    const ledger = openLedger(`${SCRIPT}-${baseLabel}`, { type: "run", script: SCRIPT, base: baseLabel });
    log("");
    log(`ledger: ${relative(process.cwd(), ledger.path)}  (commit it)`);
    const namesBefore = new Map(rows.map((row) => [row.id, row.itemName]));

    if (!state.link) {
        const spec = { name: CATEGORY_GROUP_FIELD, type: "multipleRecordLinks", description: LINK_DESCRIPTION, options: { linkedTableId: groups.id } };
        let made = await air.createField(catalog.id, { ...spec, options: { ...spec.options, prefersSingleRecordLink: true } });
        log(`  [CREATE] with prefersSingleRecordLink: ${made.status} ${made.ok ? "" : made.text}`);
        if (!made.ok) {
            made = await air.createField(catalog.id, spec);
            log(`  [CREATE] without it: ${made.status} ${made.ok ? "" : made.text}`);
            if (!made.ok) return finish(air, 1, `${CATEGORY_GROUP_FIELD} was not created`);
        }
        ledger.write({ type: "field", table: CATALOG_TABLE, id: made.json.id, name: made.json.name, inverseId: made.json.options?.inverseLinkFieldId ?? null });
        ({ catalog, groups } = await air.tables());
        state = schemaState(catalog, groups);
        if (state.problems.length > 0 || !state.link) {
            for (const problem of state.problems) log(`  ${problem}`);
            return finish(air, 1, `${CATEGORY_GROUP_FIELD} is not what was asked for — nothing after it was written`);
        }
    }
    if (state.inverse && (state.inverse.name !== INVERSE_NAME || (state.inverse.description ?? "") !== INVERSE_DESCRIPTION)) {
        ledger.write({ type: "inverse", table: GROUPS_TABLE, id: state.inverse.id, before: { name: state.inverse.name, description: state.inverse.description ?? "" }, after: { name: INVERSE_NAME, description: INVERSE_DESCRIPTION } });
        await air.patchField(groups.id, state.inverse.id, { name: INVERSE_NAME, description: INVERSE_DESCRIPTION });
        log(`  [PATCH]  ${GROUPS_TABLE}.${INVERSE_NAME}, the link's far side, named and described`);
    }
    if ((state.link.description ?? "") !== LINK_DESCRIPTION) {
        ledger.write({ type: "description", table: CATALOG_TABLE, id: state.link.id, before: state.link.description ?? "", after: LINK_DESCRIPTION });
        await air.patchField(catalog.id, state.link.id, { description: LINK_DESCRIPTION });
        log(`  [PATCH]  ${CATEGORY_GROUP_FIELD}'s description`);
    }

    for (const chunk of inChunks(p.writes)) {
        for (const { row, group } of chunk) ledger.write(linkLine(row, group));
        await air.updateRecords(catalog.id, chunk.map(({ row, group }) => ({ id: row.id, fields: { [CATEGORY_GROUP_FIELD]: [group.id] } })));
        log(`  [LINK]   ${chunk.length} row(s), through ${chunk[chunk.length - 1].row.id}`);
    }

    return verify(air, namesBefore);
}

/** The base read again after a run's writes: every row linked to its pair's group, every name as it was. */
async function verify(air, namesBefore) {
    log("\nreading it back:");
    const { catalog, groups } = await air.tables();
    const state = schemaState(catalog, groups);
    if (state.problems.length > 0 || !state.link) {
        for (const problem of state.problems) log(`  ${problem}`);
        return finish(air, 1, "the base is not what the run left");
    }
    const rows = await readRows(air, catalog, state);
    const p = planLinks(rows, await readGroups(air, groups));
    const renamed = rows.filter((row) => namesBefore.has(row.id) && namesBefore.get(row.id) !== row.itemName);
    log(`  ${rows.length} row(s): ${p.linked.length} linked to the group their pair names, ${p.writes.length} unlinked.`);
    log(`  every ${NAME_FIELD} read before the writes ${renamed.length === 0 ? "reads the same after them" : `— ${renamed.length} differ`}.`);
    for (const line of [...visibility(catalog, state.link), ...visibility(groups, state.inverse)]) log(`  the view ${line}`);
    if (p.problems.length > 0) printProblems(p.problems);
    if (p.problems.length > 0 || p.writes.length > 0 || renamed.length > 0) return finish(air, 1, "the base does not hold what the run wrote");
    return finish(air, singleLinkOutstanding(state) ? 2 : 0, "every row is linked to the group its pair names");
}

async function revert(air, apply, ledgerPath, baseLabel) {
    const lines = readLedger(readFileSync(ledgerPath, "utf8"));
    const { catalog, groups } = await air.tables();
    const state = schemaState(catalog, groups);
    if (state.problems.length > 0) {
        for (const problem of state.problems) log(`  ${problem}`);
        return finish(air, 1, "the base is not one this recognizes");
    }
    if (state.levels === "looked up") {
        log(`${GROUP_LEVEL_FIELDS.join(" and ")} are lookups through ${CATEGORY_GROUP_FIELD}, so emptying a link would empty them.`);
        log(`  The hand step back first: turn ${ASSET_CATEGORY_FIELDS.level1} into a single select of Equipment and Tool and ${ASSET_CATEGORY_FIELDS.level2} into single line text, then run this again.`);
        return finish(air, 1, "refused before writing anything");
    }
    if (!state.link) {
        log(`${CATALOG_TABLE} has no ${CATEGORY_GROUP_FIELD}: no link of the ledger stands.`);
        return finish(air, 0, "nothing to put back");
    }
    const r = planRevert(lines, await readRows(air, catalog, state));
    log(`${relative(process.cwd(), ledgerPath)}: ${r.writes.length + r.back.length + r.problems.length} link(s); ${r.writes.length} to put back, ${r.back.length} back already.`);
    if (r.problems.length > 0) {
        printProblems(r.problems);
        return finish(air, 1, "refused before writing anything");
    }
    for (const { row, line } of r.writes) log(`  [WOULD]  ${row.id}  ${JSON.stringify(row.itemName)} → ${line.before.join(", ") || "no group"}`);
    const fieldStep = `${CATEGORY_GROUP_FIELD} itself stays: the Metadata API deletes no field, so removing it is a hand step in ${CATALOG_TABLE}, and then its far side ${INVERSE_NAME} in ${GROUPS_TABLE}, which the first deletion leaves behind as text (docs/notes/airtable-access.md, #384).`;
    if (!apply) {
        if (r.writes.length > 0) return finish(air, 2, `dry run — ${r.writes.length} link(s) to put back, nothing was written`);
        log(`  ${fieldStep}`);
        return finish(air, 0, "every link of the ledger is back");
    }
    const ledger = openLedger(`${SCRIPT}-revert-${baseLabel}`, { type: "run", script: SCRIPT, base: baseLabel, revert: relative(process.cwd(), ledgerPath) });
    log("");
    log(`ledger: ${relative(process.cwd(), ledger.path)}  (commit it)`);
    for (const chunk of inChunks(r.writes)) {
        for (const { row, line } of chunk) ledger.write(unlinkLine(row, line));
        await air.updateRecords(catalog.id, chunk.map(({ row, line }) => ({ id: row.id, fields: { [CATEGORY_GROUP_FIELD]: line.before } })));
        log(`  [BACK]   ${chunk.length} row(s), through ${chunk[chunk.length - 1].row.id}`);
    }
    const after = planRevert(lines, await readRows(air, catalog, state));
    if (after.writes.length > 0 || after.problems.length > 0) return finish(air, 1, `${after.writes.length + after.problems.length} link(s) are not back`);
    log(`  ${fieldStep}`);
    return finish(air, 0, `every link of the ledger is back, ${after.back.length} in all`);
}

async function main() {
    const apply = process.argv.includes("--apply");
    const at = process.argv.indexOf("--revert");
    const ledgerPath = at === -1 ? null : process.argv[at + 1];
    let airtable;
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const air = new Airtable(airtable.apiKey, airtable.baseId);
    const baseLabel = airtable.live ? "live" : "test";
    log(`${SCRIPT}${ledgerPath ? "  (REVERT)" : ""} — reaching the ${describeAirtableBase(airtable)}${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);
    if (at !== -1 && !ledgerPath) {
        log("--revert takes the ledger's path");
        return 1;
    }
    if (ledgerPath) return revert(air, apply, ledgerPath, baseLabel);
    return run(air, apply, baseLabel);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);

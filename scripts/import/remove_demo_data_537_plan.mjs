// What removing the demo data from a base judges, apart from the base (#537): which rows are the
// demo's, which real row still points at one, the order rows go and come back in, and whether a row
// put back reads as it did.
//
// WHICH ROWS. The app was built against demo records on the one base there was, and the live base
// kept them beside the site's real ones when #534 made the test base a copy. Soo approved the list
// row by row on 2026-10-21; it is written here as the rules that produce it, so a run reads the
// same answer off the base it reaches rather than a list of record ids. Three things are named:
// the demo's jobs by code — `26-DEMO-NN`, a code `seed_demo_fixtures.mjs` keeps off the company's
// `##-USA-@@` on purpose — the vendors the seeds create, by name, and the accounts the demo and the
// checks signed in as, by address. Everything else follows a link down from those: the discipline
// on a demo job, every request filed under it and the request's own rows, the orders those raised
// and their items, the deliveries on a demo job, every invoice whose items all charge demo orders
// and its items, the materials ordered and delivered only on demo documents and their prices, the addresses only demo rows use, and the sign-in rows of the demo's mailboxes. A
// document on a real job is kept whoever raised it, so a run never removes one because a demo
// account touched it; it refuses instead, below.
//
// WHAT NO RUN REMOVES. The catalogs, the assets and their log (`KEPT_WHOLE`) are read and never
// written, and `Assets` and `Asset Log` are the site's records (#531, `scripts/protectedTables.mjs`).
// A table on the base this file has not classified refuses the run, so a table added later is
// a decision rather than a silence.
//
// A REAL ROW POINTING AT A DEMO ROW REFUSES THE RUN WHOLE. Every link in Airtable is a pair, and
// one side of each pair is the row's own — `Assigned Jobs` on a user, `Job` on an asset — and the
// other is its mirror, filled by Airtable from the far side (`OWNED_LINKS`, one side per pair,
// checked against the schema). Removing a demo row empties its id out of both. A kept row whose
// OWN link holds a demo id would lose a value somebody wrote on it, so the run names each one and
// stops before anything is written; Soo settles them by hand first. A kept row whose MIRROR holds
// one — a real user who signed a demo request — loses nothing of its own, and is printed for the
// record.
//
// THE ORDER. Rows go children first (`REMOVE_ORDER`), as Soo set it: the rows of a document and
// its records, the documents, then the jobs, the vendors, the addresses and the people, and the
// sign-in rows last. They come back the other way, and a link to a row the revert has not made yet
// — a user's assignment to a job, an address's to its job — is written after every row is back.
//
// IMPORTS ONE MODULE, `scripts/protectedTables.mjs`, so the offline tier reads this file under plain
// `node` (`offline/demo-data-removal-537.mjs`).

import { PROTECTED_LINKS, PROTECTED_TABLES } from "../protectedTables.mjs";

export const SCRIPT = "remove_demo_data_537";

/** Airtable's ceiling on the rows one record request writes. */
export const ROWS_PER_REQUEST = 10;

/** A job the demo made: off the company's `##-USA-@@` on purpose (`seed_demo_fixtures.mjs`). */
export const DEMO_JOB_CODE = /^26-DEMO-\d{2}$/;

/** The vendors the demo's seeds create. */
export const DEMO_VENDORS = Object.freeze(["Lone Star Pipe & Supply", "Gulf Coast Valve & Fitting", "Brazos Metals"]);

/** The accounts the demo and the checks signed in as, approved one by one for removal. */
export const DEMO_ACCOUNTS = Object.freeze([
    "authz-fixture@hanyangengusa.com",
    "scoped-fixture@hanyangengusa.com",
    "name-fixture@hanyangengusa.com",
    "soo+code471@hanyangengusa.com",
    "soo+name473@hanyangengusa.com",
    "soohyun.c@hanyangengusa.com",
]);

/**
 * The addresses whose sign-in rows go: the demo's accounts, and the one a walk asked emails for
 * with no account behind it (#148). Matched on `Email` as typed — `Mailbox` cuts the `+` tag, so
 * it reads `soo+code471@` as `soo@`, whose rows stay.
 */
export const DEMO_MAILBOXES = Object.freeze([...DEMO_ACCOUNTS, "soo+limit148@hanyangengusa.com"]);

/** The order rows go in, children first; a revert makes them again from the far end. */
export const REMOVE_ORDER = Object.freeze([
    "Invoice Items",
    "Invoices",
    "Delivery Items",
    "Deliveries",
    "Material Prices",
    "Direct Purchases",
    "PR Edit Log",
    "PR Edit Requests",
    "PR Signers",
    "PR Items",
    "Quotations",
    "PO Items",
    "Materials",
    "Purchase Orders",
    "Purchase Requests",
    "Disciplines",
    "Jobs",
    "Vendors",
    "Addresses",
    "Users",
    "Auth Tokens",
]);

/** The tables read for their links and never written. */
export const KEPT_WHOLE = Object.freeze([...PROTECTED_TABLES, "Asset Categories", "Asset Category Groups", "Material Categories"]);

/**
 * Each table's own side of every link pair it is in — what a row of it carries as its own value,
 * the two tables of the site's records' from the module that holds them. The far side of each is
 * its mirror. `schemaProblems` holds every pair on the base to exactly one
 * owned side, so a link added later is classified here before a run goes ahead.
 */
export const OWNED_LINKS = Object.freeze({
    Users: ["Assigned Jobs"],
    Jobs: ["PIC", "Manager", "Delivery Address"],
    Disciplines: ["Job"],
    Vendors: ["Address"],
    "Purchase Requests": ["Requester", "Vendor", "Discipline", "Delivery Address"],
    "PR Signers": ["PR", "Signer"],
    "PR Items": ["PR", "Quotation", "Category"],
    Quotations: ["Vendor", "PR"],
    "PR Edit Requests": ["PR", "Initiated By", "Sent To"],
    "PR Edit Log": ["PR", "Changed By"],
    "Purchase Orders": ["PR", "Our PIC", "Our Manager", "Sent By", "Delivery Address"],
    "PO Items": ["PO", "Material"],
    Addresses: ["Jobs"],
    Invoices: ["Vendor", "Delivery", "Recorded By"],
    "Invoice Items": ["Invoice", "PO", "PO Item"],
    Materials: ["Category"],
    "Material Prices": ["Material", "Vendor", "Latest PO"],
    "Auth Tokens": [],
    Deliveries: ["Job", "Vendor", "Packing List PO", "Recorded By", "Delivery Address"],
    "Delivery Items": ["Delivery", "PO Item", "Material", "Overage PR", "Former PO Item"],
    "Direct Purchases": ["Vendor", "Job", "Recorded By", "Purchase Request"],
    "Asset Category Groups": [],
    "Asset Categories": ["Category Group"],
    ...PROTECTED_LINKS,
    "Material Categories": [],
});

/** What a revert asks of the base before it writes: a row's name, which no other row may hold. */
const KEY_FIELD = Object.freeze({ Users: "Email" });

/** Field types Airtable computes, which nothing writes and a revert compares nowhere. */
const STAMPED = new Set(["createdTime", "lastModifiedTime", "autoNumber", "createdBy", "lastModifiedBy", "button"]);

/** Field types Airtable computes from other fields, compared after a revert and never written. */
const COMPUTED = new Set(["formula", "rollup", "multipleLookupValues", "count"]);

const LINK = "multipleRecordLinks";
const ATTACHMENTS = "multipleAttachments";

const linksOf = (row, field) => row.fields?.[field] ?? [];

/** The pieces of a list, `size` to a piece. */
export function inChunks(items, size = ROWS_PER_REQUEST) {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/** The name a row is known by, as compared: its table's primary field, or a user's address, in any case. */
export function keyOf(table, row) {
    const value = row.fields?.[KEY_FIELD[table.name] ?? table.fields.find((f) => f.id === table.primaryFieldId)?.name];
    return typeof value === "string" ? value.toLowerCase() : value === undefined ? null : JSON.stringify(value);
}

/** The name a reader sees a row by: `keyOf`'s field as written, and a sign-in row's address rather than its token. */
export function nameOf(table, row) {
    const value = row.fields?.[table.name === "Auth Tokens" ? "Email" : KEY_FIELD[table.name] ?? table.fields.find((f) => f.id === table.primaryFieldId)?.name];
    return value === undefined ? row.id : typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * What about a base's schema stops a run before it reads a row, as sentences: a table this file has
 * not classified or one it names that is missing, a named link that is not a link, a pair with no
 * owned side or two, and a protected or kept table in the order — the last a change to this file.
 */
export function schemaProblems(tables) {
    const problems = [];
    const byName = new Map(tables.map((t) => [t.name, t]));
    const fieldById = new Map(tables.flatMap((t) => t.fields.map((f) => [f.id, { table: t.name, field: f }])));
    for (const name of REMOVE_ORDER) {
        if (KEPT_WHOLE.includes(name)) problems.push(`${name} is in the order and among the tables kept whole`);
        if (PROTECTED_TABLES.includes(name)) problems.push(`${name} holds the site's records and is in the order`);
    }
    for (const name of [...REMOVE_ORDER, ...KEPT_WHOLE]) if (!byName.has(name)) problems.push(`the base has no table ${name}`);
    for (const t of tables) if (!REMOVE_ORDER.includes(t.name) && !KEPT_WHOLE.includes(t.name)) problems.push(`${t.name} is on the base and in neither the order nor the tables kept whole`);
    for (const [name, owned] of Object.entries(OWNED_LINKS)) {
        const table = byName.get(name);
        if (!table) continue;
        for (const fieldName of owned) {
            const field = table.fields.find((f) => f.name === fieldName);
            if (!field) problems.push(`${name} has no field ${fieldName}`);
            else if (field.type !== LINK) problems.push(`${name}.${fieldName} is a ${field.type}, not a link`);
        }
    }
    for (const t of tables) {
        if (!(t.name in OWNED_LINKS)) {
            if (t.fields.some((f) => f.type === LINK)) problems.push(`${t.name}'s links are classified nowhere`);
            continue;
        }
        for (const f of t.fields.filter((field) => field.type === LINK)) {
            const far = fieldById.get(f.options?.inverseLinkFieldId);
            if (!far) {
                problems.push(`${t.name}.${f.name} has no far side on the base`);
                continue;
            }
            if (far.table < t.name || (far.table === t.name && far.field.id < f.id)) continue;
            const sides = [OWNED_LINKS[t.name]?.includes(f.name), OWNED_LINKS[far.table]?.includes(far.field.name)].filter(Boolean).length;
            if (sides !== 1) problems.push(`${t.name}.${f.name} and ${far.table}.${far.field.name} are one link with ${sides} owned sides, not one`);
        }
    }
    return problems;
}

/**
 * Which rows of `rows` (table name -> REST records) are the demo's, and what that leaves pointing
 * at them: `{ remove, why, blocking, mirrored }`. `remove` maps each table of `REMOVE_ORDER` to its
 * rows in the order read; `why` a removed id to the reason; `blocking` every kept row whose own link
 * holds a removed id, `{ table, id, field, ids }`; `mirrored`, per kept table and field, how many
 * kept rows a removal empties of a mirror and of how many links, `{ rows, links }`.
 */
export function planRemoval(rows) {
    const why = new Map();
    const tableOf = new Map();
    for (const [table, records] of Object.entries(rows)) for (const record of records) tableOf.set(record.id, table);
    const gone = (id) => why.has(id);
    const mark = (table, test, reason) => {
        for (const record of rows[table] ?? []) if (!gone(record.id) && test(record)) why.set(record.id, reason);
    };
    const anyGone = (field) => (record) => linksOf(record, field).some(gone);
    const allGone = (...fields) => (record) => {
        const ids = fields.flatMap((field) => linksOf(record, field));
        return ids.length > 0 && ids.every(gone);
    };

    mark("Jobs", (r) => DEMO_JOB_CODE.test(String(r.fields?.["Job Code"] ?? "")), "a demo job's code");
    mark("Disciplines", anyGone("Job"), "on a demo job");
    mark("Purchase Requests", anyGone("Discipline"), "filed under a demo job's discipline");
    for (const table of ["PR Items", "PR Signers", "PR Edit Requests", "PR Edit Log", "Quotations"]) mark(table, anyGone("PR"), "a row of a demo request");
    mark("Purchase Orders", anyGone("PR"), "raised from a demo request");
    mark("PO Items", anyGone("PO"), "an item of a demo order");
    mark("Deliveries", anyGone("Job"), "on a demo job");
    mark("Delivery Items", anyGone("Delivery"), "a row of a demo delivery");
    mark("Direct Purchases", anyGone("Job"), "on a demo job");
    mark("Vendors", (r) => DEMO_VENDORS.includes(r.fields?.["Vendor Name"]), "a vendor the demo's seeds create");
    // An invoice is judged by what its items charge, and an item by its invoice: an item charging a
    // demo order on a real invoice stays, and its own `PO` refuses the run below.
    const invoiceItems = new Map((rows["Invoice Items"] ?? []).map((r) => [r.id, r]));
    const chargesDemo = (item) => linksOf(item, "PO").some(gone) || linksOf(item, "PO Item").some(gone);
    mark(
        "Invoices",
        (r) => {
            const items = linksOf(r, "Invoice Items").map((id) => invoiceItems.get(id));
            return (items.length > 0 && items.every((item) => item && chargesDemo(item))) || anyGone("Vendor")(r);
        },
        "its items all charge demo orders, or its vendor is the demo's"
    );
    mark("Invoice Items", anyGone("Invoice"), "a row of a demo invoice");
    mark("Materials", allGone("PO Items", "Delivery Items"), "ordered and delivered on demo documents alone");
    mark("Material Prices", (r) => anyGone("Material")(r) || anyGone("Vendor")(r), "the price of a demo material or from a demo vendor");
    mark("Addresses", allGone("Jobs", "Jobs (Delivery Address)", "Vendors", "Purchase Requests", "Purchase Orders", "Deliveries"), "used by demo rows alone");
    mark("Users", (r) => DEMO_ACCOUNTS.includes(String(r.fields?.Email ?? "").toLowerCase()), "an account the demo or the checks signed in as");
    mark("Auth Tokens", (r) => DEMO_MAILBOXES.includes(String(r.fields?.Email ?? "").toLowerCase()), "a sign-in row of a demo mailbox");

    const remove = new Map(REMOVE_ORDER.map((table) => [table, (rows[table] ?? []).filter((r) => gone(r.id))]));
    const blocking = [];
    const mirrored = new Map();
    for (const [table, records] of Object.entries(rows)) {
        for (const record of records) {
            if (gone(record.id)) continue;
            for (const [field, value] of Object.entries(record.fields ?? {})) {
                if (!Array.isArray(value)) continue;
                const ids = value.filter((v) => typeof v === "string" && gone(v) && tableOf.has(v));
                if (ids.length === 0) continue;
                if (OWNED_LINKS[table]?.includes(field)) blocking.push({ table, id: record.id, field, ids });
                else {
                    const key = `${table}.${field}`;
                    if (!mirrored.has(key)) mirrored.set(key, { rows: 0, links: 0 });
                    mirrored.get(key).rows += 1;
                    mirrored.get(key).links += ids.length;
                }
            }
        }
    }
    return { remove, why, blocking, mirrored };
}

/** The fields of a table a revert writes: every one a person or the app writes, and a link only on its owned side. */
export function writableFields(table) {
    return table.fields.filter((f) => !STAMPED.has(f.type) && !COMPUTED.has(f.type) && f.type !== ATTACHMENTS && (f.type !== LINK || OWNED_LINKS[table.name]?.includes(f.name)));
}

/** A table's attachment fields, which a revert uploads once the row is made. */
export function attachmentFields(table) {
    return table.fields.filter((f) => f.type === ATTACHMENTS);
}

/** A ledger as written: its lines, a blank line skipped. */
export function readLedger(text) {
    return text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
}

/**
 * What a revert of `lines` would make, judged against the base it reaches: `{ creates, refusals }`.
 * `creates` is the ledger's rows parent first, each `{ line, fields, deferred }` — the fields to
 * create it with, and the owned links naming a row the revert makes later, written once every row is
 * back. A refusal is a sentence: a row whose name the base holds already — a registration or a
 * sign-up since can have taken it — or an owned link to a row neither the ledger nor the base holds.
 */
export function planRevert(lines, tables, rows) {
    const byName = new Map(tables.map((t) => [t.name, t]));
    const refusals = [];
    const ledgerRows = lines.filter((line) => line.type === "row");
    const inLedger = new Set(ledgerRows.map((line) => line.id));
    const onBase = new Set(Object.values(rows).flatMap((records) => records.map((r) => r.id)));
    for (const table of new Set(ledgerRows.map((line) => line.table))) {
        if (!REMOVE_ORDER.includes(table)) refusals.push(`the ledger holds rows of ${table}, which no removal takes`);
    }
    for (const table of REMOVE_ORDER) {
        const schema = byName.get(table);
        const mine = ledgerRows.filter((line) => line.table === table);
        if (!schema || mine.length === 0) continue;
        const taken = new Set((rows[table] ?? []).map((r) => keyOf(schema, r)).filter((key) => key !== null));
        for (const line of mine) if (taken.has(keyOf(schema, line))) refusals.push(`${table} holds ${keyOf(schema, line)} already`);
        for (const line of mine) {
            for (const field of OWNED_LINKS[table] ?? []) {
                const lost = linksOf(line, field).filter((id) => !inLedger.has(id) && !onBase.has(id));
                if (lost.length > 0) refusals.push(`${table} ${keyOf(schema, line)}'s ${field} names ${lost.join(", ")}, on neither the ledger nor the base`);
            }
        }
    }

    const creates = [];
    const made = new Set();
    for (const table of [...REMOVE_ORDER].reverse()) {
        const schema = byName.get(table);
        if (!schema) continue;
        const writes = writableFields(schema);
        const mine = ledgerRows.filter((line) => line.table === table);
        for (const line of mine) {
            const fields = {};
            const deferred = {};
            for (const f of writes) {
                const value = line.fields?.[f.name];
                if (value === undefined) continue;
                if (f.type === LINK && value.some((id) => inLedger.has(id) && !made.has(id))) deferred[f.name] = value;
                else fields[f.name] = value;
            }
            creates.push({ line, fields, deferred });
        }
        for (const line of mine) made.add(line.id);
    }
    return { creates, refusals };
}

/** A value with every record id `map` knows replaced by its image, at any depth. */
export function remapIds(value, map) {
    if (typeof value === "string") return map.get(value) ?? value;
    if (Array.isArray(value)) return value.map((v) => remapIds(v, map));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapIds(v, map)]));
    return value;
}

const isFile = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.filename === "string";

/**
 * A field's value with every attached file reduced to what a ledger may keep of it — its id, name,
 * size and type — at any depth, so a lookup of an attachment loses its address too. Airtable's own
 * addresses die at a wall-clock instant and nothing durable stores one (CLAUDE.md, File uploads).
 */
export function withoutFileAddresses(value) {
    if (isFile(value)) return { id: value.id, filename: value.filename, size: value.size, type: value.type };
    if (Array.isArray(value)) return value.map(withoutFileAddresses);
    return value;
}

/**
 * A value as two readings of one row compare: a file by its name, size and type, which an upload
 * keeps and its id does not, and a lookup of nothing as no value — Airtable answered `[null]` for a
 * lookup of an empty phone on a row the demo made in September and left the field out on the same
 * row made again (2026-10-21).
 */
const comparable = (value) =>
    isFile(value) ? [value.filename, value.size, value.type] : Array.isArray(value) ? (value.length > 0 && value.every((v) => v === null) ? undefined : value.map(comparable)) : value;
const sorted = (value) => (Array.isArray(value) ? [...value].map((v) => JSON.stringify(v)).sort() : value);

/**
 * The fields where a row a revert made reads otherwise than its ledger line, ids mapped: every
 * field but the ones Airtable stamps, a link or a lookup as a set, a file by its name, size and
 * type. An empty list is the row as it was.
 */
export function rowDifferences(table, line, record, map) {
    const out = [];
    for (const f of table.fields) {
        if (STAMPED.has(f.type)) continue;
        const set = f.type === LINK || f.type === "multipleLookupValues";
        const was = comparable(remapIds(line.fields?.[f.name], map));
        const now = comparable(record.fields?.[f.name]);
        const a = set ? sorted(was) : was;
        const b = set ? sorted(now) : now;
        if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push(f.name);
    }
    return out;
}

/** The fields Airtable stamps on a table's rows, which a row made again cannot carry over. */
export function stampedFields(table) {
    return table.fields.filter((f) => STAMPED.has(f.type)).map((f) => f.name);
}

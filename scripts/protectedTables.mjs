// The two tables no script writes on the live base (#531): `Assets` and `Asset Log` hold the
// site's records there.
//
// ON THE LIVE BASE ALONE (#534), JUDGED BY THE BASE'S ID. Every run reaches the test base unless
// it names the live one (`lib/airtableBase.js`), and the test base's two tables are a copy whose
// rows nobody's label points at, so a check's fixtures and an import's run go there unrefused —
// which is what lets `verify-tools-schema-334.mjs` and `verify-tool-item-ids-335.mjs` run again.
// Both questions take the id of the base the run writes to — `baseId`, which a script on the
// client reads off `base.getId()`, the SDK's own answer, and a REST script off the resolution it
// sends with; a description's, the base in the address it is about to send — and refuse when it
// is `LIVE_BASE_ID`, or when no base is named at all, since a run that cannot say where it writes
// is held as though it wrote to the live one. The table and field ids are the same on both bases
// (the test base was made by duplicating the live one), so nothing but the base id tells them apart.
//
// WHY. From 2026-10-15 the assets on the live base are the ones the sites registered and every
// `Asset Log` row is an event somebody performed — a check-out on a job, a check-in, a
// retirement. Nothing in this repository rebuilds them: a label printed for an asset points at
// its row, and an event is true of a moment that is gone. So the app's own screens are their
// one writer but for the one import below (#544), and a script — a credentialed check, an import, a demo seed, a revert — that would
// create, update or delete a row of either, or rename or redescribe either table or its fields,
// asks this module first and stops before its first write — a description alone excepted, below.
// The check for a run's own fixtures
// does not change that: a fixture created in one of these tables is a row on the site's list
// for as long as the run lasts, and a run killed before its cleanup leaves it there.
//
// A TABLE THEY LINK TO IS REACHED THROUGH THEM WHEN IT IS EMPTIED. `Assets."Category"`,
// `Assets."Job"`, `Assets."Owner Job"` (#598), `Asset Log."Job"` and `Asset Log."Recorded By"` point at `Asset Categories`,
// `Jobs` and `Users`, and Airtable empties a link to a deleted row in the row that held it — so
// a run deleting every row of one of those (`wipe_base.mjs`) rewrites the two tables without
// naming them. A run deleting chosen rows of one asks itself whether any asset stands on them,
// as `replace_asset_catalog_528.mjs --remove` already does; a whole table emptied cannot.
// `PROTECTED_LINKS` is those links by table, with `Asset Log."Asset"` between the two, for a run
// that asks it of every row it would delete (`remove_demo_data_537_plan.mjs`, #537).
//
// NO FLAG LETS A RUN PAST IT ON THE LIVE BASE, and that is the point rather than an omission: a
// way round is a write waiting for the run that takes it. Naming the live base (`AIRTABLE_BASE=live`)
// is what brings a run under it, not out from under it. The day these tables stop being the site's
// records is a change to this module, made in its own commit.
//
// A DESCRIPTION ALONE IS NOT A RECORD, AND IS THE ONE THING THAT GOES THROUGH (#531). A table's
// or a field's description says what the column holds and touches no row, so Soo allowed
// `describe_repair_531.mjs` to correct the six that #531 made false. A script that writes one asks
// `refusesBeyondDescriptions` before every request it sends, and that answers true — stop — for
// anything on the live base but a read of its schema or a PATCH of one table or one field
// carrying a `description` and nothing else: a name, a type, options, a row read or a row write
// are each refused before they are sent, as is an address whose base it cannot read.
//
// WHAT IT CANNOT SEE. It answers about the tables a script names to it; a script that writes
// without asking is caught by `offline/protected-tables.mjs`, which finds every script under
// `scripts/` naming either table or a writer of them and requires the question before the
// writes. Source order is not execution order, and that check says so where it holds it.
//
// ONE SCRIPT MAY ADD ROWS THERE, AND TAKE BACK ONLY ITS OWN (#544). `import_site_assets_544.mjs`
// registers the three sites' items from the list Soo reviewed, and Soo allowed it on the live base.
// It is not let past `refusesProtectedWrite`, which refuses it as it refuses every script: it asks
// that question of the catalog's tables alone, and every request it sends to `Assets` or `Asset Log`
// is judged by `refusesBeyondLedger` at the SDK's one funnel, as the request leaves — so what is
// held is what is sent, and not a guard's place in the source. On the live base that answers stop
// for any script but `LEDGERED_IMPORT`, and for it lets through a read, a create of new rows shaped
// exactly as a registration writes them — an asset in stock, its `Created` row on an asset this same
// run created — and, in a revert, a delete of the rows its ledger names and nothing else. No update
// of any row of either table goes through. Ending the exception is deleting `LEDGERED_IMPORT` and
// the function, in a commit of its own.
//
// ONE SCRIPT MAY FILL ONE FIELD OF THE ROWS THERE (#598). `fill_owner_job_598.mjs` gives every asset
// standing before #598 the job it stands on as its `Owner Job`, and Soo allowed it on the live base
// once its read-only plan and its ledger were shown. It is fenced at the same funnel: `refusesBeyondLedger`
// lets `OWNER_JOB_FILL` read `Assets` and send a batch update of `Owner Job` alone, on the rows it read
// with none and with the job it read each on — or in a revert `[]` on the rows its ledger filled — and
// nothing else: no create, no delete, no other field, nothing to `Asset Log`. Ending the exception is
// deleting `OWNER_JOB_FILL` and `beyondOwnerJobFill`, in a commit of its own.
//
// ONE SCRIPT MAY ADD ONE FIELD THERE (#598). `add_owner_job_598.mjs` makes `Assets."Owner Job"`, a
// link to `Jobs`, on both bases by one script so the two hold their fields in one order, and Soo
// allowed it on the live base. `refusesBeyondDescriptions` lets it, and it alone, send beyond a
// schema read and a description: the one create of that link on `Assets`, exactly as specified, and
// the rename of a `Jobs` field — the link's far side — to `OWNER_JOB_FIELD.inverse`. No row of either
// table is reached. Ending the exception is deleting `OWNER_JOB_SCHEMA` and its branch, in a commit of
// its own.
//
// IMPORTS THREE MODULES, `lib/airtableBase.js`, `lib/idSequence.js` and `lib/assetStatus.js`, none
// of which imports anything — so a script run with no loader — `scripts/import/`'s and
// `scripts/demo/`'s REST scripts — can import it, and so can the offline tier. The names are the
// base's, and the check holds them equal to `lib/airtable/client.js:TABLES`.

import { LIVE_BASE_ID } from "../lib/airtableBase.js";
import { ID_KINDS } from "../lib/idSequence.js";
import { ASSET_EVENT, ASSET_STATUS } from "../lib/assetStatus.js";

/** The tables no script writes on the live base: the site's assets and what has happened to them. */
export const PROTECTED_TABLES = Object.freeze(["Assets", "Asset Log"]);

/** The tables a protected row links to, which no script empties of every row. */
export const PROTECTED_LINK_TARGETS = Object.freeze(["Asset Categories", "Jobs", "Users"]);

/** The links a protected row carries as its own value, by table — each pair's far side is a mirror. */
export const PROTECTED_LINKS = Object.freeze({
    Assets: Object.freeze(["Category", "Job", "Owner Job"]),
    "Asset Log": Object.freeze(["Asset", "Job", "Recorded By"]),
});

/**
 * Whether a run must stop before its first write, saying so: `baseId` is the base it writes to,
 * `writes` the tables it would write a row or a schema change to, `wipes` the tables it would
 * empty of every row. True when either reaches a protected table — `wipes` a table one links to
 * as well — on the live base or on no named base, after printing the refusal through `log`; false,
 * saying nothing, otherwise. The caller stops on true.
 */
export function refusesProtectedWrite({ script, baseId, writes = [], wipes = [], log = console.log }) {
    const reached = [
        ...new Set([
            ...writes.filter((table) => PROTECTED_TABLES.includes(table)),
            ...wipes.filter((table) => PROTECTED_TABLES.includes(table) || PROTECTED_LINK_TARGETS.includes(table)),
        ]),
    ];
    if (reached.length === 0) return false;
    const named = typeof baseId === "string" && baseId !== "";
    if (named && baseId !== LIVE_BASE_ID) return false;
    const where = named ? "on the live base" : "on a base it does not name";
    log(`REFUSED, before any write: ${script} would write ${reached.join(" and ")} ${where}.`);
    log(
        "Assets and Asset Log on the live base hold the site's records since #531 — every item registered and " +
            "every event recorded against one — so no script writes, deletes or reshapes either there, or empties a " +
            "table they link to. Nothing was written."
    );
    return true;
}

/** The one script `refusesBeyondLedger` lets add rows to the two tables on the live base (#544). */
export const LEDGERED_IMPORT = "import_site_assets_544";

/**
 * The fields of a row the import may create in each table, exactly — what `createAssets` and
 * `createFirstAssetLogEntries` write; the offline check holds them to those writers' source.
 */
export const LEDGERED_ROW_FIELDS = Object.freeze({
    Assets: Object.freeze(["Asset ID", "Category", "Status", "Job", "Owner Job"]),
    "Asset Log": Object.freeze(["Asset Log ID", "Asset", "Event", "Job", "Recorded By", "Event At"]),
});

/** Airtable's ceiling on the rows one request writes. */
const ROWS_PER_REQUEST = 10;

/** A printed id of the width a day declares, and no wider (`lib/idSequence.js`). */
const ASSET_ID = new RegExp(`^${ID_KINDS.ASSET.token}-\\d{6}-\\d{${ID_KINDS.ASSET.padLength}}$`);

/** A link written as one record id. */
const oneLink = (value) => Array.isArray(value) && value.length === 1 && typeof value[0] === "string" && value[0].startsWith("rec");

/** What one row of a create would write beyond what the import may, or null when nothing. */
function rowBeyond(table, fields, created) {
    if (fields === null || typeof fields !== "object") return "create a row with no fields";
    const keys = Object.keys(fields).sort();
    const allowed = [...LEDGERED_ROW_FIELDS[table]].sort();
    if (keys.join("\n") !== allowed.join("\n")) return `create ${table} with ${keys.join(", ") || "no field"}, not ${allowed.join(", ")}`;
    if (table === "Assets") {
        if (!ASSET_ID.test(String(fields["Asset ID"]))) return `create an asset ${JSON.stringify(fields["Asset ID"])}, not a day's id of ${ID_KINDS.ASSET.padLength} digits`;
        if (fields.Status !== ASSET_STATUS.IN_STOCK) return `create an asset ${JSON.stringify(fields.Status)}, not ${ASSET_STATUS.IN_STOCK}`;
        if (!oneLink(fields.Category) || !oneLink(fields.Job)) return "create an asset without one category and one job";
        // A registration's asset belongs to the job it is put on (#598).
        if (!oneLink(fields["Owner Job"]) || fields["Owner Job"][0] !== fields.Job[0]) return "create an asset whose owner job is not its job";
        return null;
    }
    if (fields.Event !== ASSET_EVENT.CREATED) return `create a ${JSON.stringify(fields.Event)} row, not ${ASSET_EVENT.CREATED}`;
    if (!oneLink(fields.Asset) || !created.has(fields.Asset[0])) return `create a log row on ${JSON.stringify(fields.Asset)}, an asset this run did not create`;
    if (fields["Asset Log ID"] !== `${created.get(fields.Asset[0])}-001`) return `create ${JSON.stringify(fields["Asset Log ID"])}, not ${created.get(fields.Asset[0])}-001`;
    if (!oneLink(fields.Job) || !oneLink(fields["Recorded By"])) return "create a log row without one job and one recorder";
    return null;
}

/** The one script `refusesBeyondLedger` lets update rows of `Assets` on the live base (#598). */
export const OWNER_JOB_FILL = "fill_owner_job_598";

/**
 * What a request of `OWNER_JOB_FILL`'s would do beyond filling `Owner Job`, or null when nothing
 * (#598): a read of `Assets`, or a batch update of one to ten of its rows, each `{ id, fields: {
 * "Owner Job": [...] } }` exactly — the job `fills` holds for the row, which the run read with no
 * owner job, or in a revert `[]` for a row `clears` holds. No create, no delete, no other field or
 * key, and nothing to `Asset Log`.
 */
function beyondOwnerJobFill({ method, path, body }, { fills, clears }) {
    const [, segment = "", rest = ""] = String(path ?? "").split("/");
    const table = decodeURIComponent(segment);
    const verb = String(method ?? "").toLowerCase();
    if (table !== "Assets") return `send ${verb.toUpperCase()} ${path}, and this run reaches Assets alone`;
    if (verb === "get") return null;
    if (verb === "post" && rest === "listRecords") return null;
    if (verb !== "patch" || rest !== "") return `send ${verb.toUpperCase()} ${path}`;
    if (!keyedExactly(body, ["records"])) return "update Assets rows with more than their records";
    const records = body.records;
    if (!Array.isArray(records) || records.length === 0 || records.length > ROWS_PER_REQUEST) return `update Assets rows other than one to ${ROWS_PER_REQUEST} in a batch`;
    for (const record of records) {
        if (!keyedExactly(record, ["id", "fields"]) || !keyedExactly(record.fields, [OWNER_JOB_FIELD.name])) return `update an Assets row with more than its ${OWNER_JOB_FIELD.name}`;
        const value = record.fields[OWNER_JOB_FIELD.name];
        if (!Array.isArray(value)) return `write ${JSON.stringify(value)} to ${OWNER_JOB_FIELD.name}`;
        if (fills.has(record.id)) {
            if (value.length !== 1 || value[0] !== fills.get(record.id)) return `write ${JSON.stringify(value)} to ${record.id}, not the job the run read it on`;
        } else if (clears.has(record.id)) {
            if (value.length !== 0) return `write ${JSON.stringify(value)} to ${record.id}, which a revert clears`;
        } else return `update ${record.id}, which this run did not read with no owner job`;
    }
    return null;
}

/** What a request to one of the two tables would do beyond the import's ledger, or null when nothing. */
function beyondLedger({ method, path, queryParams, body }, { creates, created, deletes }) {
    const [, segment = "", rest = ""] = String(path ?? "").split("/");
    const table = decodeURIComponent(segment);
    const verb = String(method ?? "").toLowerCase();
    if (verb === "get") return null;
    if (verb === "post" && rest === "listRecords") return null;
    if (verb === "post" && rest === "") {
        if (!creates) return `create ${table} rows, which a revert does not`;
        const records = body?.records;
        if (!Array.isArray(records) || records.length === 0 || records.length > ROWS_PER_REQUEST) return `create ${table} rows other than one to ${ROWS_PER_REQUEST} in a batch`;
        const others = Object.keys(body).filter((key) => key !== "records");
        if (others.length > 0) return `create ${table} rows with ${others.join(", ")}`;
        for (const record of records) {
            const beyond = Object.keys(record ?? {}).some((key) => key !== "fields") ? `create a ${table} row carrying more than its fields` : rowBeyond(table, record?.fields, created);
            if (beyond) return beyond;
        }
        return null;
    }
    if (verb === "delete" && rest === "") {
        const ids = queryParams?.records;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > ROWS_PER_REQUEST) return `delete ${table} rows other than one to ${ROWS_PER_REQUEST} in a batch`;
        const foreign = ids.filter((id) => !deletes.has(id));
        if (foreign.length > 0) return `delete ${foreign.join(", ")}, which the ledger did not make`;
        return null;
    }
    return `send ${verb.toUpperCase()} ${path}`;
}

/**
 * Whether a request to `Assets` or `Asset Log` must not be sent, saying so (#544): false, saying
 * nothing, for a request to another table or on a base other than the live one; on the live base,
 * true for every script but `LEDGERED_IMPORT` and `OWNER_JOB_FILL`. For the import, true but for a
 * read, a create of rows shaped exactly as a registration's — `allowed.creates` true, each `Created`
 * row on a record in `allowed.created`, a map of the assets this run created to their printed ids —
 * and a batch delete of ids in `allowed.deletes`, and an update always refused. For the fill (#598),
 * true but for a read of `Assets` and a batch update of `Owner Job` alone — `allowed.fills`, a map of
 * the rows it read with none to the job each stood on, or in a revert `allowed.clears`, a set of the
 * rows its ledger filled (`beyondOwnerJobFill`). `request` is the SDK's funnel's arguments: `method`,
 * `path` (`/Assets/`, `/Asset%20Log/listRecords`), `queryParams` and `body`. The caller stops on
 * true, before the request leaves.
 */
export function refusesBeyondLedger({ script, baseId, request, allowed = {}, log = console.log }) {
    const table = decodeURIComponent(String(request?.path ?? "").split("/")[1] ?? "");
    if (!PROTECTED_TABLES.includes(table)) return false;
    const named = typeof baseId === "string" && baseId !== "";
    if (named && baseId !== LIVE_BASE_ID) return false;
    const where = named ? "on the live base" : "on a base it does not name";
    const beyond =
        script === LEDGERED_IMPORT
            ? beyondLedger(request, { creates: allowed.creates === true, created: allowed.created ?? new Map(), deletes: allowed.deletes ?? new Set() })
            : script === OWNER_JOB_FILL
              ? beyondOwnerJobFill(request, { fills: allowed.fills ?? new Map(), clears: allowed.clears ?? new Set() })
              : `write ${table}, and only ${LEDGERED_IMPORT} and ${OWNER_JOB_FILL} write rows there`;
    if (beyond === null) return false;
    log(`REFUSED, before sending: ${script} would ${beyond} ${where}.`);
    log(
        `Assets and Asset Log on the live base hold the site's records since #531; ${LEDGERED_IMPORT} alone adds rows to them, ` +
            `shaped as a registration writes them, and takes back only the rows its ledger names, and ${OWNER_JOB_FILL} alone fills ` +
            `an asset's ${OWNER_JOB_FIELD.name} with the job it stands on (#598). Nothing was sent.`
    );
    return true;
}

/** The base an address on Airtable's API is about — a row's or a schema's — or null for any other. */
const BASE_IN_ADDRESS = /^https:\/\/api\.airtable\.com\/v0\/(?:meta\/bases\/)?(app[A-Za-z0-9]+)(?:[/?]|$)/;

/** A read of one base's schema, the one GET a description's script sends. */
const SCHEMA_READ = /^https:\/\/api\.airtable\.com\/v0\/meta\/bases\/app[A-Za-z0-9]+\/tables$/;

/** One table, or one field of it, on the Metadata API: what a description is written to. */
const DESCRIBED = /^https:\/\/api\.airtable\.com\/v0\/meta\/bases\/app[A-Za-z0-9]+\/tables\/tbl[A-Za-z0-9]+(?:\/fields\/fld[A-Za-z0-9]+)?$/;

/** The one script `refusesBeyondDescriptions` lets send beyond a description on the live base (#598). */
export const OWNER_JOB_SCHEMA = "add_owner_job_598";

/**
 * The field it may make, and the name its far side may take: `Assets."Owner Job"`, a link to `Jobs`,
 * and `Jobs."Assets (as Owner)"`. The tables by id, which are the same on both bases (#534).
 */
export const OWNER_JOB_FIELD = Object.freeze({
    table: "tblXtmDonSyOyOvV3",
    name: "Owner Job",
    linkedTable: "tblGwgHuhTX6rwF1M",
    inverse: "Assets (as Owner)",
});

/** A field created on the owner job's table, and a field of `Jobs`. */
const OWNER_JOB_CREATE = new RegExp(`^https://api\\.airtable\\.com/v0/meta/bases/app[A-Za-z0-9]+/tables/${OWNER_JOB_FIELD.table}/fields$`);
const JOBS_FIELD = new RegExp(`^https://api\\.airtable\\.com/v0/meta/bases/app[A-Za-z0-9]+/tables/${OWNER_JOB_FIELD.linkedTable}/fields/fld[A-Za-z0-9]+$`);

/** Whether a value is an object whose keys are exactly `keys`, in any order. */
const keyedExactly = (value, keys) =>
    value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");

/**
 * What a request of `OWNER_JOB_SCHEMA`'s would do beyond its field, or null when nothing (#598): the
 * create of `OWNER_JOB_FIELD` on its table — its name, a link to `Jobs`, a description and nothing
 * else in its options — or a `Jobs` field given `OWNER_JOB_FIELD.inverse`, with a description or none.
 * Anything else is `beyondDescriptions`' to answer.
 */
function beyondOwnerJobField({ method, url, body }) {
    if (method === "POST" && OWNER_JOB_CREATE.test(url ?? "")) {
        if (!keyedExactly(body, ["name", "type", "description", "options"])) return "create a field other than the owner job's link";
        if (body.name !== OWNER_JOB_FIELD.name || body.type !== "multipleRecordLinks" || typeof body.description !== "string") return "create a field other than the owner job's link";
        if (!keyedExactly(body.options, ["linkedTableId"]) || body.options.linkedTableId !== OWNER_JOB_FIELD.linkedTable) return "create a link other than one to Jobs";
        return null;
    }
    if (method === "PATCH" && JOBS_FIELD.test(url ?? "") && body !== null && typeof body === "object" && Object.hasOwn(body, "name")) {
        const others = Object.keys(body).filter((key) => key !== "name" && key !== "description");
        if (others.length > 0 || body.name !== OWNER_JOB_FIELD.inverse) return `rename a Jobs field to ${JSON.stringify(body.name)}`;
        if (Object.hasOwn(body, "description") && typeof body.description !== "string") return "send a PATCH with a description that is not text";
        return null;
    }
    return undefined;
}

/** What a request would do beyond a schema read or a description alone, or null when nothing. */
function beyondDescriptions({ method, url, body }) {
    if (typeof url !== "string") return "send a request with no address";
    if (method === "GET") return SCHEMA_READ.test(url) && body === undefined ? null : `send GET ${url}`;
    if (method !== "PATCH") return `send ${method} ${url}`;
    if (!DESCRIBED.test(url)) return `send PATCH ${url}`;
    if (body === null || typeof body !== "object" || Array.isArray(body)) return "send a PATCH with no body";
    const others = Object.keys(body).filter((key) => key !== "description");
    if (others.length > 0) return `send ${others.join(", ")} beside a description`;
    if (typeof body.description !== "string") return "send a PATCH with no description";
    return null;
}

/**
 * Whether a request to Airtable must not be sent, saying so (#531): false, saying nothing, for any
 * request to a base other than the live one (#534), and on the live base for a GET of its schema
 * or a PATCH of one table or one field whose body is `{ description }` alone — and, for
 * `OWNER_JOB_SCHEMA` alone, its one field and its far side's name (#598); true for anything
 * else — a name, a type, options, any row, an address whose base cannot be read — after printing
 * the refusal through `log`. The caller stops on true, before the request leaves.
 */
export function refusesBeyondDescriptions({ script, method, url, body, log = console.log }) {
    const addressed = typeof url === "string" ? url.match(BASE_IN_ADDRESS)?.[1] : undefined;
    if (addressed !== undefined && addressed !== LIVE_BASE_ID) return false;
    const field = script === OWNER_JOB_SCHEMA && addressed !== undefined ? beyondOwnerJobField({ method, url, body }) : undefined;
    const beyond = field !== undefined ? field : beyondDescriptions({ method, url, body });
    if (beyond === null) return false;
    log(`REFUSED, before sending: ${script} would ${beyond}.`);
    log(
        "A script that writes a description of Assets or Asset Log on the live base sends a schema read and descriptions alone " +
            "since #531, and nothing a row holds. Nothing was sent."
    );
    return true;
}

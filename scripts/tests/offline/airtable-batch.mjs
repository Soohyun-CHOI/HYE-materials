// Creating many rows in Airtable's batches — the pure half (#470).
//
// WHAT THIS FILE IS FOR. `lib/airtableBatch.js` decides what a run of creates says
// when one of its requests fails: which rows are on the base, which are not, and where
// the run stops. A registration's landing reports exactly that — how many were not
// written, and which have no first log row — so a wrong answer here is a wrong
// sentence on a screen with nothing failing. And the failures are what the live base
// cannot be made to produce on demand, so this tier is the only place they run: against
// `_fakeBase.mjs`, whose every answer is chosen. What those answers do to a landing is
// `offline/tool-registration.mjs`' section 9, against the same fake.
//
// WHAT IT CANNOT SEE. Whether Airtable behaves as the fake does: that a refused batch
// writes nothing is measured on this base for a destroy (#191) and an update (#444)
// and never for a create, and nothing here depends on it, since a failed request is
// read back either way. That ten is Airtable's ceiling is Airtable's documentation, not
// a measurement. And whether `client.js:createRecords` really hands the module the base
// is read off its source here, beside a planted copy wired wrong, since that module
// cannot be loaded without credentials.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { RECORDS_PER_CREATE, createInBatches } from "../../../lib/airtableBatch.js";
import { callsTo, parseFile, parseSource, resolveFunction } from "./_ast.mjs";
import { fakeBase } from "./_fakeBase.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Creating many rows in Airtable's batches — ten to a request, and a failed one read back (#470)";

const ID = "Row ID";

/** A fake base keyed on this file's id field. */
const baseWith = (options = {}) => fakeBase({ idField: ID, ...options });

/** `count` items, each its own minted id. */
const itemsOf = (count) => Array.from({ length: count }, (_, i) => `R-${String(i + 1).padStart(3, "0")}`);

/** Run a batch writer over `count` items against `base`, and what it answered. */
async function writeRows(count, base, writer = createInBatches) {
    const items = itemsOf(count);
    const result = await writer(items, {
        idField: ID,
        rowOf: (item) => ({ [ID]: item, Name: `row ${item}` }),
        create: base.create,
        readBack: base.readBack,
    });
    return { items, result, inFlightAtReturn: base.state.inFlight };
}

const ids = (list) => list.join(" ");
const writtenIds = (result) => ids(result.written.map(({ item }) => item));
const sizes = (base) => base.state.requests.map((request) => request.length).join("+");

export async function run({ check, log, assert }) {
    // ── 1: the ceiling, and how a run is cut ────────────────────────────────────
    log("ten to a request, in the items' order:");
    check("a request carries at most ten rows — Airtable's ceiling", RECORDS_PER_CREATE, 10);
    for (const [count, expected] of [
        [1, "1"],
        [10, "10"],
        [11, "10+1"],
        [25, "10+10+5"],
    ]) {
        const base = baseWith();
        const { items, result } = await writeRows(count, base);
        check(`  ${count} row(s) go as ${expected}`, sizes(base), expected);
        check(`    every one written, in order`, writtenIds(result), ids(items));
        check(`    none unwritten and no failure`, `${result.unwritten.length} ${result.failure}`, "0 null");
    }
    const none = baseWith();
    const empty = await writeRows(0, none);
    check("  no rows send no request", `${none.state.requests.length} ${empty.result.written.length}`, "0 0");
    {
        const { result } = await writeRows(3, baseWith());
        assert(
            "  each item stands beside the record its own id came back on",
            result.written.every(({ item, record }) => record.get(ID) === item && record.get("Name") === `row ${item}`)
        );
    }

    // ── 2: one request at a time, and nothing in flight when it returns ─────────
    log("");
    log("one request at a time — a caller holding a lock relies on it:");
    {
        const base = baseWith();
        await writeRows(25, base);
        check("never two requests in flight", base.state.maxInFlight, 1);
    }
    {
        // The second request fails; a run that had sent the third alongside it would
        // return with the third still in flight, and the third is the slowest.
        const base = baseWith({ answer: (n) => (n === 1 ? { land: 0 } : null) });
        const { inFlightAtReturn } = await writeRows(25, base);
        check("a failed run returns with nothing still in flight", inFlightAtReturn, 0);
        check("  and never sends the request after the failure", base.state.requests.length, 2);
    }

    // ── 3: a request refused whole ─────────────────────────────────────────────
    log("");
    log("the second of three requests is refused, and nothing of it lands:");
    {
        const base = baseWith({ answer: (n) => (n === 1 ? { land: 0 } : null) });
        const { items, result } = await writeRows(25, base);
        check("what landed before it is written", writtenIds(result), ids(items.slice(0, 10)));
        check("  the refused ten and the five never sent are unwritten", ids(result.unwritten), ids(items.slice(10)));
        check("  the failure is the request's own", result.failure?.message, "request 2 failed");
        check("it is read back once", base.state.readBacks.length, 1);
        check("  by exactly the ten ids that request carried", ids(base.state.readBacks[0]), ids(items.slice(10, 20)));
    }

    // ── 4: an answer lost after the rows landed ────────────────────────────────
    log("");
    log("the second request lands, and its answer is lost:");
    {
        const base = baseWith({ answer: (n, rows) => (n === 1 ? { land: rows.length } : null) });
        const { items, result } = await writeRows(25, base);
        check("every row the base holds is written, in order", writtenIds(result), ids(items.slice(0, 20)));
        check("  only the five never sent are unwritten", ids(result.unwritten), ids(items.slice(20)));
        check("  the run still stops there", base.state.requests.length, 2);
        assert("  and still reports what stopped it", result.failure instanceof Error);
        assert(
            "  each read-back row beside its own item, whatever order the read answered in",
            result.written.every(({ item, record }) => record.get(ID) === item)
        );
    }
    {
        const { items, result } = await writeRows(25, baseWith({ answer: (n) => (n === 1 ? { land: 4 } : null) }));
        check("  four of ten landing is fourteen written", writtenIds(result), ids(items.slice(0, 14)));
        check("    and eleven unwritten", ids(result.unwritten), ids(items.slice(14)));
    }

    // ── 5: the read-back fails as well ─────────────────────────────────────────
    log("");
    log("the read-back fails too — the batch nobody can vouch for:");
    {
        const base = baseWith({ answer: (n, rows) => (n === 1 ? { land: rows.length } : null), readBackFails: true });
        const { items, result } = await writeRows(25, base);
        check("counts the batch as not written", writtenIds(result), ids(items.slice(0, 10)));
        check("  every row from it on unwritten", ids(result.unwritten), ids(items.slice(10)));
        check("  and the failure is the request's, not the read's", result.failure?.message, "request 2 failed");
    }

    // ── 6: an answer in another order ──────────────────────────────────────────
    log("");
    log("an answer is matched by id, so its order decides nothing:");
    {
        const { items, result } = await writeRows(11, baseWith({ reverseAnswer: true }));
        check("written in the items' order", writtenIds(result), ids(items));
        assert(
            "  each beside its own record",
            result.written.every(({ item, record }) => record.get(ID) === item)
        );
    }

    // ── 7: the wiring, off client.js's source ──────────────────────────────────
    log("");
    log("client.js hands the module the base's create and a read by the id field:");
    const wiringFacts = ({ ast, source }) => {
        const fn = resolveFunction(ast, "createRecords");
        if (!fn) return { found: false };
        const [call] = callsTo(fn, "createInBatches");
        const property = (name) => call?.arguments[1]?.properties?.find((p) => p.key?.name === name)?.value;
        const text = (node) => (node ? source.slice(node.start, node.end).replace(/\s+/g, " ") : "none");
        return {
            found: true,
            calls: callsTo(fn, "createInBatches").length,
            items: text(call?.arguments[0]),
            idField: text(property("idField")),
            create: text(property("create")),
            readBack: text(property("readBack")),
        };
    };
    const wiring = wiringFacts(parseFile("lib/airtable/client.js"));
    assert("lib/airtable/client.js declares createRecords", wiring.found);
    check("  which calls the module once", wiring.calls, 1);
    check("  with the caller's items", wiring.items, "items");
    check("  and the caller's id field", wiring.idField, "idField");
    check(
        "  creating through the base, each row as its fields",
        wiring.create,
        "(rows) => base(tableName).create(rows.map((fields) => ({ fields })))"
    );
    check("  and reading back by that id field", wiring.readBack, "(ids) => findByFieldValues(tableName, idField, ids)");

    // ── anti-vacuity ───────────────────────────────────────────────────────────
    // Every scenario above has to be able to tell a wrong writer from this one. So the
    // same fake is run against two that are wrong in the ways this module refuses —
    // batches sent together, and a failure counted rather than read back — and the
    // wiring is read off a planted `createRecords` that is wired wrong.
    log("");
    log("anti-vacuity — a wrong writer is seen to be wrong:");
    const together = async (items, { idField, rowOf, create }) => {
        const batches = [];
        for (let i = 0; i < items.length; i += RECORDS_PER_CREATE) batches.push(items.slice(i, i + RECORDS_PER_CREATE));
        const written = [];
        try {
            const answers = await Promise.all(batches.map((batch) => create(batch.map(rowOf))));
            answers.flat().forEach((record) => written.push({ item: record.get(idField), record }));
        } catch (error) {
            return { written, unwritten: items, failure: error };
        }
        return { written, unwritten: [], failure: null };
    };
    {
        const base = baseWith();
        await writeRows(25, base, together);
        check("  batches sent together are seen in flight together", base.state.maxInFlight, 3);
        const failing = baseWith({ answer: (n) => (n === 1 ? { land: 0 } : null) });
        const { inFlightAtReturn } = await writeRows(25, failing, together);
        check("  and returning with one still in flight is seen", inFlightAtReturn, 1);
    }
    const trusting = async (items, io) => createInBatches(items, { ...io, readBack: async () => [] });
    {
        const base = baseWith({ answer: (n, rows) => (n === 1 ? { land: rows.length } : null) });
        const { items, result } = await writeRows(25, base, trusting);
        check("  a lost answer counted rather than read back is seen", writtenIds(result), ids(items.slice(0, 10)));
    }
    const planted = wiringFacts(
        parseSource(
            "export async function createRecords(tableName, idField, items, rowOf) {\n" +
                "  return createInBatches(items, { idField, rowOf, create: (rows) => base(tableName).create(rows), readBack: async () => [] });\n" +
                "}\n",
            "<planted-wiring>"
        )
    );
    check("  a create that sends bare rows is seen", planted.create, "(rows) => base(tableName).create(rows)");
    check("  and a read-back that reads nothing is seen", planted.readBack, "async () => []");
}

if (isMain(import.meta.url)) standalone(title, run);

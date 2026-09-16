import { base, TABLES, withKeyLock } from "./client";
import { formulaString } from "../airtableFormula";
import { normalizeItemText } from "../itemNaming";
import { addressLabelKey } from "../addressCreation";

/**
 * A place this company ships to. Linked from `Jobs` (a default delivery address,
 * and since #384 every job that uses one), from `Vendors`, and — from #385 on —
 * from the request that says where its material goes.
 *
 * `Address Label` IS HUMAN-TYPED AND STAYS THAT WAY (#384), which makes it the one
 * `X Label` primary on this base that is not composed. The catalog's
 * `Category Label` is a formula because somebody adding one of 777 reference rows
 * by hand would eventually type one wrong; an address is created by the app from
 * #384 on, so the by-hand path that argument is about is the one this issue
 * removes. What a formula would cost is the half of the label that no component
 * carries — which site, which gate, whose yard — and `Formatted Address` is
 * already the composition of the components, so a composed label would be a
 * second formula over one set of inputs. See docs/notes/addresses.md.
 *
 * NO UNIQUE CONSTRAINT BEHIND IT, the same gap `Tools."Tool Name"` and the
 * `Materials` natural key live with, so `createAddressAction` enforces it under a
 * lock — see `getAddressByLabel` below for the comparison.
 */
function recordToAddress(record) {
    return {
        id: record.id,
        addressLabel: record.get("Address Label") || "",
        line1: record.get("Line 1"),
        line2: record.get("Line 2"),
        city: record.get("City"),
        state: record.get("State"),
        zipCode: record.get("Zip Code"),
        // `country` STOOD HERE AND IS GONE (#182). Nothing read it: every surface
        // that prints an address prints `Formatted Address`, which already carries
        // the country, and the `Country` options belong to `lib/addressCreation.js`
        // on the way in. The FIELD is unaffected and still written at creation.
        formattedAddress: record.get("Formatted Address"),
        // #384 — the jobs that use this address. A link field, core link data with
        // no propagation lag (see client.js:getLinkedRecords), so exposing it costs
        // no extra fetch, and `addressesOnJob` reads it beside `Jobs."Delivery
        // Address"` rather than instead of it.
        jobs: record.get("Jobs") || [],
    };
}

/**
 * Find an address by Airtable record ID. First consumer is PO PDF generation
 * (issue #13) — `Jobs."Delivery Address"` and `Vendors."Address"` are both links
 * to this table. Returns null if not found.
 *
 * THE DOC ABOVE NAMED `Jobs."Alternate Delivery Address"` AS A THIRD LINK AND
 * #384 REMOVED IT. A job holds one default address and as many others as it uses,
 * through `Addresses."Jobs"`; the two-slot shape is gone.
 */
export async function getAddressByRecordId(recordId) {
    const record = await base(TABLES.ADDRESSES).find(recordId);
    if (!record) return null;

    return recordToAddress(record);
}

/**
 * Every address, for the create screen at `/addresses/new` (#384).
 *
 * The whole table in one query, `Vendors`- and `Tools`-shaped: the places a
 * company ships to are bounded by its sites and its suppliers rather than by
 * activity, which is tens of rows and not thousands. It is what lets the form
 * preview a label matching an address that already exists at no query cost per
 * keystroke, and what lets it list the addresses a job already uses without
 * asking the base a second question.
 *
 * NO `fields` PROJECTION, so each row arrives carrying its `Jobs` link array —
 * the same saving `getAllJobs` takes for `Disciplines` and `Deliveries`.
 */
export async function getAllAddresses() {
    const records = await base(TABLES.ADDRESSES).select().all();
    return records.map(recordToAddress);
}

/**
 * One address by the label a person typed, or null — #384's duplicate gate.
 *
 * `getToolByName`'S COMPARISON RATHER THAN A SECOND ONE: `LOWER(TRIM(…))` on both
 * sides, over a value `normalizeItemText` has already collapsed the internal
 * whitespace of. Measured in #338 and relied on here: Airtable's `=` on a text
 * field is case-SENSITIVE, so a bare `=` would admit `round rock yard` beside a
 * stored `Round Rock Yard` — two rows for one place, which is the defect this
 * screen exists to prevent. The comparison a formula still cannot make is
 * collapsing an internal run, which is what the write side's normalization is for.
 */
async function getAddressByLabel(addressLabel) {
    const records = await base(TABLES.ADDRESSES)
        .select({
            filterByFormula: `LOWER(TRIM({Address Label})) = LOWER(TRIM("${formulaString(
                normalizeItemText(addressLabel)
            )}"))`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToAddress(records[0]);
}

/**
 * Create an Address record. `Formatted Address` is a formula, never set here.
 *
 * NORMALIZED HERE RATHER THAN AT THE CALL SITE, so no caller can create an
 * unnormalized row — `upsertTool`'s reason, and what makes `getAddressByLabel`'s
 * `LOWER(TRIM(…))` sufficient afterwards.
 *
 * NOT A FIND-OR-CREATE, WHICH IS WHERE THIS DIVERGES FROM `upsertTool` ON PURPOSE.
 * A tool name is the whole of that row's identity, so folding a second submission
 * into the first loses nothing; an address label arrives beside a street and a
 * zip, so folding would discard them silently. The caller holds the lock and
 * refuses — see `createAddressAction`.
 *
 * `jobRecordIds` IS THE JOBS THIS ADDRESS IS FOR (#384) and is optional: a
 * vendor's own address belongs to no job.
 */
export async function createAddress({
    addressLabel,
    line1,
    line2,
    city,
    state,
    zipCode,
    country,
    jobRecordIds,
}) {
    const cleanLabel = normalizeItemText(addressLabel);
    if (!cleanLabel) throw new Error("createAddress: an Address Label is required");

    const record = await base(TABLES.ADDRESSES).create({
        "Address Label": cleanLabel,
        "Line 1": normalizeItemText(line1),
        "Line 2": normalizeItemText(line2),
        City: normalizeItemText(city),
        State: normalizeItemText(state),
        "Zip Code": normalizeItemText(zipCode),
        Country: country || "USA",
        Jobs: jobRecordIds || [],
    });

    return recordToAddress(record);
}

/**
 * Create an address unless its label is already taken (#384) — the read and the
 * write under one lock.
 *
 * `upsertTool`'S SHAPE WITH THE OTHER ENDING. Both tables carry a human-typed
 * natural key Airtable cannot make unique, so both serialize the read-then-write
 * on that key: labels Airtable would call equal have to lock against each other,
 * or two submissions each read "nothing exists yet" and each create a row. What
 * differs is what happens on a match — see `createAddress` above for why an
 * address refuses where a tool folds.
 *
 * Returns `{ address }` or `{ existing }`, never both. The caller turns the second
 * into the refusal, which is one sentence the form has already previewed.
 *
 * `withKeyLock` SERIALIZES WITHIN ONE PROCESS OR INVOCATION ONLY, so two
 * concurrent Vercel invocations remain the residual every family on this base
 * lives with — the form's disable-on-submit is the other half. The repair is
 * cheap here for `Tools`' own reason: an address mints no id, so a duplicate row
 * can be merged by hand with no printed label going wrong.
 */
export async function createAddressIfLabelFree(fields) {
    const cleanLabel = normalizeItemText(fields?.addressLabel);
    if (!cleanLabel) throw new Error("createAddressIfLabelFree: an Address Label is required");

    return withKeyLock(`address::${addressLabelKey(cleanLabel)}`, async () => {
        const existing = await getAddressByLabel(cleanLabel);
        if (existing) return { address: null, existing };
        return { address: await createAddress({ ...fields, addressLabel: cleanLabel }), existing: null };
    });
}

// Every figure an invoice's header carries is held to the cent — credentialed (#405).
//
// WHY THIS EXISTS. The whole of this issue is a set of REFUSALS on write paths, and
// the offline tier cannot execute one: `offline/invoice-header-tolerance.mjs` can say
// that both actions name `headerPrecisionRefusal` and that both service writers guard
// all four figures, and never that a submission carrying `1.005` is turned away with
// nothing written. This runs the write paths.
//
// BOTH INVOICE FORMS RENDER REACT'S NO-JAVASCRIPT `$ACTION_*` FIELDS — measured, one
// `$ACTION_REF_n` plus `$ACTION_KEY` on `/invoices/new` and on
// `/invoices/[invoiceId]/edit` — so BOTH actions are posted from here. That is the
// difference from #308, whose edit turn had to move to a browser because
// `/prs/[prId]` renders none at all: `EditAndContinueForm` submits through
// JavaScript. Nothing about this axis has that shape, so nothing here is deferred to
// a browser except what a browser is the only witness to — that a refused form still
// holds the figure the reader typed, which the pull request carries.
//
//   A — a session, the records this run reuses, and the file the create path requires.
//   B — `createInvoiceAction`, one refusal per figure, then the passing submission.
//       The four refusals must create NOTHING; the passing one must store what it was
//       given, including `8.11`, which is not exactly representable in binary and is
//       why the predicate carries slack instead of comparing exactly.
//   C — `updateInvoiceAction`, the same four figures on a record that already exists.
//   D — THE READER'S SITUATION THIS ISSUE INVENTS, and the reason it is its own
//       section. #308's edit turn refused over a row the person had just typed; here
//       a saved invoice can carry an off-cent `Tariff` from a hand edit, and then an
//       edit that only changes the VENDOR is refused over a box nobody touched. The
//       sentence names `Tariff`, so this asserts the control is on the screen
//       carrying that value — a refusal naming a figure the reader cannot see would
//       be a dead end rather than an instruction.
//
//       AND THE CONTROLS' OWN `step="0.01"` IS NOT A FIRST LINE IN FRONT OF THIS,
//       measured separately and recorded in both screens' briefs. Neither form sets
//       `noValidate` or `step="any"`; what decides it is that no control carries a
//       `min`, so HTML takes the step base from the `value` CONTENT ATTRIBUTE. The
//       create form is React-bound and that attribute follows the typed value, so
//       nothing is ever refused; the edit screen's is whatever the record loaded
//       with, so the constraint measures against the stored figure — and on an
//       invoice storing `1.005` the browser ACCEPTS `1.005` and refuses `1.01`.
//       So the refusals below are the only correct check on either screen, which
//       is also why this section posts rather than types: a Server Action is
//       callable whatever the page rendered.
//   E — the two service writers, both values each, since B, C and D reach them only
//       through the actions that refuse first.
//
// EVERY RECORD IT CREATES CARRIES THE RUN TAG AND IS DELETED IN `finally`. It
// REUSES — never modifies, never deletes — one PO, one PO Item and one Vendor, and
// the ordered item is one no delivery has touched so #231's pairing computes `none`
// and nothing is written on a record this script does not own.
//
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-invoice-header-precision-405.mjs
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed,
// 2 the dev server was unreachable so part of it did not run.

import { put } from "@vercel/blob";
import { TABLES, base } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { createInvoice, getInvoiceById, updateInvoice } from "../../lib/airtable/invoices.js";
import { getPOItemByRecordId } from "../../lib/airtable/poItems.js";
import { createFixtures } from "./_fixtures.mjs";
import { HEADER_PRECISION_COPY, PRECISION_BLOCKED } from "../../lib/variance.js";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-invoice-header-precision-405 — every figure an invoice's header carries, held to the cent" });

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

// The records this run reuses, which are #382's and chosen there for the same
// reason: `HYE-PO-260911-34` is Signed, its one ordered item has nothing invoiced
// against it, and no delivery item names it, so the pairing reaches `none` and this
// script writes on nothing it does not own. Verified in A rather than trusted.
const PO_RECORD_ID = "recFhuh7Rmic2VxXI"; // HYE-PO-260911-34
const PO_ITEM_RECORD_ID = "recNWQmMybRWcCVKY"; // HYE-PO-260911-34-001
const VENDOR_RECORD_ID = "recJMkaWAGnohzn4z"; // Lone Star Pipe & Supply

/** The figures, in `headerPrecisionRefusal`'s own order. */
const FIGURES = [
    ["shippingFee", "Shipping Fee"],
    ["tariff", "Tariff"],
    ["salesTax", "Sales Tax"],
    ["amountDue", "Amount Due"],
];

let pass = true;
let incomplete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};

const fixtures = createFixtures({
    tag: "V405",
    buckets: [
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable — an autoNumber primary and no text field at all.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
    ],
});
const TAG = fixtures.TAG;

/** The smallest thing Airtable will accept as a PDF attachment. */
const MINIMAL_PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
        "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8"
);

/**
 * React's four no-JavaScript fields for ONE action, picked by the action's own id.
 * #308's helper, unchanged — the `:0` field carries the action's spec, so the pairing
 * is exact rather than positional even on a page rendering more than one form.
 */
function actionFieldsFor(html, actionId) {
    const key = html.match(/name="\$ACTION_KEY"\s+value="([^"]+)"/);
    if (!key) return null;
    const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    for (const m of html.matchAll(/name="\$ACTION_REF_(\d+)"/g)) {
        const n = m[1];
        const spec = html.match(new RegExp(`name="\\$ACTION_${n}:0"\\s+value="([^"]+)"`));
        const bound = html.match(new RegExp(`name="\\$ACTION_${n}:1"\\s+value="([^"]+)"`));
        if (!spec || !bound) continue;
        if (!unescape(spec[1]).includes(actionId)) continue;
        return {
            [`$ACTION_REF_${n}`]: "",
            [`$ACTION_${n}:0`]: unescape(spec[1]),
            [`$ACTION_${n}:1`]: unescape(bound[1]),
            $ACTION_KEY: key[1],
        };
    }
    return null;
}

/** The id of a server action a CLIENT component imports, looked up by export name. */
async function serverActionId(cookie, pageUrl, exportName) {
    const html = await (await fetch(pageUrl, { headers: { cookie } })).text();
    const scripts = [...new Set([...html.matchAll(/src="(\/_next\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
    for (const src of scripts) {
        const js = await (await fetch(`${BASE}${src}`, { headers: { cookie } })).text();
        for (const m of js.matchAll(/__next_internal_action_entry_do_not_use__\s*(\[.*?\])\s*\*\//gs)) {
            let parsed;
            try {
                parsed = JSON.parse(m[1]);
            } catch {
                continue;
            }
            for (const [id, meta] of Object.entries(parsed[0] || {})) {
                if (meta?.name === exportName) return id;
            }
        }
    }
    return null;
}

/**
 * Submit a form to one Server Action and return whatever it gave back, as text.
 * The `$ACTION_*` form post rather than the `Next-Action` RPC: both of these take
 * `(prevState, formData)` from `useActionState`, so Next has to decode a form
 * submission and handing it an argument array runs nothing (#308 measured that).
 */
async function postAction(cookie, pageUrl, fields, formData) {
    for (const [name, value] of Object.entries(fields)) formData.set(name, value);
    const res = await fetch(pageUrl, { method: "POST", headers: { cookie }, body: formData, redirect: "manual" });
    const location = res.headers.get("location") || res.headers.get("x-action-redirect") || "";
    return { text: location ? "" : await res.text(), location };
}

async function mintSession() {
    const token = await createAuthToken(ADMIN_EMAIL);
    const tokenValue = typeof token === "string" ? token : token?.token;
    const verified = await fetch(`${BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokenValue }),
        redirect: "manual",
    });
    return (verified.headers.getSetCookie?.() || []).join("; ");
}

/** Run `fn`, returning the error it threw or null. */
async function threw(fn) {
    try {
        await fn();
        return null;
    } catch (err) {
        return err;
    }
}

let blobUrl = null;

try {
    // --- A -----------------------------------------------------------------
    console.log(`\nA — a session, the records reused, and the file (run ${TAG})`);
    let cookie = "";
    try {
        cookie = await mintSession();
        ok("a session cookie was issued", cookie.length > 0);
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    const poItem = await getPOItemByRecordId(PO_ITEM_RECORD_ID);
    ok("the reused ordered item resolves", Boolean(poItem?.itemName), poItem?.itemName || "missing");
    ok(
        "  and no delivery has touched it, so the pairing stays out of this run",
        (poItem?.deliveryItems || []).length === 0,
        `${(poItem?.deliveryItems || []).length} delivery items`
    );

    if (cookie) {
        const uploaded = await put(`${TAG}-invoice.pdf`, MINIMAL_PDF, {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: true,
        });
        blobUrl = uploaded.url;
        ok("a file is in Blob for the create path to hand Airtable", Boolean(blobUrl));
    }

    // --- B -----------------------------------------------------------------
    console.log("\nB — createInvoiceAction, one refusal per figure, then the passing submission");
    // `8.11` in the passing body is the case the predicate's 1e-9 slack exists for:
    // `8.11 * 100` is 810.9999999999999, so an equality test would refuse a whole cent.
    const createBody = (over = {}) => {
        const body = new FormData();
        body.set("vendorId", VENDOR_RECORD_ID);
        body.set("vendorInvoiceCode", TAG);
        body.set("issueDate", "2026-09-18");
        body.set("amountDue", "8.11");
        body.set("shippingFee", "0");
        body.set("invoiceFileUrl", blobUrl || "");
        body.set("invoiceFileFilename", `${TAG}-invoice.pdf`);
        body.set(
            "itemsJson",
            JSON.stringify([
                {
                    itemName: `${TAG} ${poItem?.itemName || "item"}`,
                    size: poItem?.size || "",
                    unit: poItem?.unit || "",
                    qty: "1",
                    unitPrice: "8.11",
                    poRecordId: PO_RECORD_ID,
                    poItemRecordId: PO_ITEM_RECORD_ID,
                },
            ])
        );
        for (const [k, v] of Object.entries(over)) body.set(k, v);
        return body;
    };

    let createFields = null;
    if (cookie && blobUrl) {
        const id = await serverActionId(cookie, `${BASE}/invoices/new`, "createInvoiceAction");
        ok("createInvoiceAction resolves to an action id", Boolean(id));
        const html = await (await fetch(`${BASE}/invoices/new`, { headers: { cookie } })).text();
        createFields = id ? actionFieldsFor(html, id) : null;
        ok("  and to the no-JavaScript fields this page renders", Boolean(createFields));
    }

    const invoicesBefore = (await base(TABLES.INVOICES).select({ fields: ["Invoice ID"] }).all()).length;

    if (createFields) {
        for (const [key, field] of FIGURES) {
            const { text } = await postAction(
                cookie,
                `${BASE}/invoices/new`,
                createFields,
                createBody({ [key]: "1.005" })
            );
            ok(`a sub-cent ${field} is refused`, text.includes(HEADER_PRECISION_COPY[key]), HEADER_PRECISION_COPY[key]);
            ok(
                "  in its own words, not a generic failure",
                !text.includes("Something went wrong creating the invoice")
            );
        }
        const afterRefusals = (await base(TABLES.INVOICES).select({ fields: ["Invoice ID"] }).all()).length;
        ok(
            "the four refusals created no invoice",
            afterRefusals === invoicesBefore,
            `${invoicesBefore} -> ${afterRefusals}`
        );

        const { location } = await postAction(cookie, `${BASE}/invoices/new`, createFields, createBody());
        ok("a whole-cent submission lands on the new invoice", /\/invoices\/HYE-INV-/.test(location), location || "(nothing)");
    } else {
        incomplete = true;
    }

    const mine = await base(TABLES.INVOICES)
        .select({ filterByFormula: `{Vendor Invoice Code} = "${TAG}"` })
        .all();
    if (mine.length) fixtures.track("invoices", mine[0].id);
    const invoiceId = mine[0]?.get("Invoice ID");
    ok("the created invoice is findable by this run's tag", Boolean(invoiceId), invoiceId || "none");
    if (mine.length) {
        ok(
            "  and holds exactly the figure it was given",
            mine[0].get("Amount Due") === 8.11,
            `Amount Due ${mine[0].get("Amount Due")}`
        );
    }

    // --- C -----------------------------------------------------------------
    console.log("\nC — updateInvoiceAction, the same four on a record that exists");
    let editFields = null;
    const editUrl = invoiceId ? `${BASE}/invoices/${invoiceId}/edit` : null;
    let editHtml = "";
    if (cookie && editUrl) {
        const id = await serverActionId(cookie, editUrl, "updateInvoiceAction");
        ok("updateInvoiceAction resolves to an action id", Boolean(id));
        editHtml = await (await fetch(editUrl, { headers: { cookie } })).text();
        editFields = id ? actionFieldsFor(editHtml, id) : null;
        ok("  and to the no-JavaScript fields the edit page renders", Boolean(editFields));
    }

    const items = mine.length
        ? await base(TABLES.INVOICE_ITEMS)
              .select({ filterByFormula: `{Invoice Item ID} != ""`, maxRecords: 100 })
              .all()
        : [];
    const myItems = items.filter((r) => (r.get("Invoice") || []).includes(mine[0]?.id));
    const editBody = (over = {}) => {
        const body = new FormData();
        body.set("invoiceId", invoiceId || "");
        body.set("vendorId", VENDOR_RECORD_ID);
        body.set("vendorInvoiceCode", TAG);
        body.set("issueDate", "2026-09-18");
        body.set("dueDate", "");
        body.set("amountDue", "8.11");
        body.set("shippingFee", "0");
        body.set("tariff", "");
        body.set("salesTax", "");
        body.set(
            "itemsJson",
            JSON.stringify(
                myItems.map((r) => ({
                    id: r.id,
                    itemName: r.get("Item Name"),
                    size: r.get("Size") || "",
                    unit: r.get("Unit") || "",
                    qty: String(r.get("Qty")),
                    unitPrice: String(r.get("Unit Price")),
                    remark: r.get("Remark") || "",
                }))
            )
        );
        for (const [k, v] of Object.entries(over)) body.set(k, v);
        return body;
    };

    if (editFields) {
        for (const [key, field] of FIGURES) {
            const { text } = await postAction(cookie, editUrl, editFields, editBody({ [key]: "1.005" }));
            ok(`a sub-cent ${field} is refused on the edit path`, text.includes(HEADER_PRECISION_COPY[key]));
        }
        const { text } = await postAction(cookie, editUrl, editFields, editBody({ shippingFee: "12.34", salesTax: "0.07" }));
        ok("  and whole-cent figures save", !text.includes("has to be a whole number of cents"));
        const after = await getInvoiceById(invoiceId);
        ok(
            "  storing what they were given",
            after?.shippingFee === 12.34 && after?.salesTax === 0.07,
            `Shipping Fee ${after?.shippingFee}, Sales Tax ${after?.salesTax}`
        );
    } else if (cookie) {
        incomplete = true;
    }

    // --- D -----------------------------------------------------------------
    console.log("\nD — an edit that changes only the vendor, over a Tariff nobody touched");
    // The hand edit in the Airtable UI is the one path that still writes an off-cent
    // figure, so it is reproduced the only way this app cannot: a direct update past
    // the service guard.
    if (mine.length && editFields) {
        await base(TABLES.INVOICES).update(mine[0].id, { Tariff: 1.005 });
        const broken = await getInvoiceById(invoiceId);
        ok("the invoice now carries an off-cent Tariff", broken?.tariff === 1.005, `Tariff ${broken?.tariff}`);

        // THE CONTROL HAS TO BE ON THE SCREEN CARRYING THAT VALUE, or the sentence
        // names a figure its reader cannot reach. `defaultValue` renders as `value`.
        const html = await (await fetch(editUrl, { headers: { cookie } })).text();
        const tariffInput = html.match(/<input[^>]*name="tariff"[^>]*>/);
        ok("the edit screen renders a Tariff control", Boolean(tariffInput), tariffInput?.[0]?.slice(0, 90) || "none");
        ok("  carrying the off-cent value", Boolean(tariffInput && /value="1\.005"/.test(tariffInput[0])));
        ok("  and labelled Tariff, which is the word the refusal uses", /Tariff/.test(html));

        // The edit a person would actually be making: a different vendor, every other
        // control left exactly as the form loaded it.
        const vendors = await base(TABLES.VENDORS).select({ maxRecords: 2, fields: ["Vendor Name"] }).all();
        const otherVendor = vendors.find((v) => v.id !== VENDOR_RECORD_ID) || vendors[0];
        const { text } = await postAction(
            cookie,
            editUrl,
            editFields,
            editBody({ vendorId: otherVendor.id, shippingFee: "12.34", salesTax: "0.07", tariff: "1.005" })
        );
        ok("the vendor-only edit is refused", text.includes(HEADER_PRECISION_COPY.tariff), HEADER_PRECISION_COPY.tariff);
        ok(
            "  naming Tariff rather than the box the reader was changing",
            !text.includes(HEADER_PRECISION_COPY.shippingFee) && !text.includes(HEADER_PRECISION_COPY.amountDue)
        );
        const unchanged = await getInvoiceById(invoiceId);
        ok(
            "  and the refusal wrote nothing, so the vendor is as it was",
            (unchanged?.vendor || [])[0] === VENDOR_RECORD_ID,
            `vendor ${(unchanged?.vendor || [])[0]}`
        );

        // Correcting the named box is what lets the vendor change land, which is what
        // makes the refusal an instruction rather than a dead end.
        const { text: second } = await postAction(
            cookie,
            editUrl,
            editFields,
            editBody({ vendorId: otherVendor.id, shippingFee: "12.34", salesTax: "0.07", tariff: "1.01" })
        );
        ok("  correcting Tariff lets the same edit through", !second.includes("has to be a whole number of cents"));
        const repaired = await getInvoiceById(invoiceId);
        ok(
            "    and the vendor change lands with it",
            (repaired?.vendor || [])[0] === otherVendor.id && repaired?.tariff === 1.01,
            `vendor ${(repaired?.vendor || [])[0]}, Tariff ${repaired?.tariff}`
        );
    } else if (cookie) {
        incomplete = true;
    }

    // --- E -----------------------------------------------------------------
    console.log("\nE — the two service writers, both values each");
    for (const [key, field] of FIGURES) {
        const err = await threw(() =>
            createInvoice({
                vendorId: VENDOR_RECORD_ID,
                vendorInvoiceCode: TAG,
                issueDate: "2026-09-18",
                amountDue: 10,
                shippingFee: 0,
                [key]: 1.005,
            })
        );
        ok(`createInvoice throws on a sub-cent ${field}`, Boolean(err), err?.message?.slice(0, 80) || "did not throw");
        ok("  carrying the precision code", err?.code === PRECISION_BLOCKED, err?.code || "none");
        ok(`  and names ${field}`, Boolean(err?.message?.includes(field)));
    }
    if (mine.length) {
        for (const [key, field] of FIGURES) {
            const err = await threw(() => updateInvoice(mine[0].id, { [key]: 1.005 }));
            ok(`updateInvoice throws on a sub-cent ${field}`, err?.code === PRECISION_BLOCKED, err?.code || "none");
        }
        // The partial callers this guard must not touch: payment and the variance
        // flag pass none of the four, so they are asking about nothing.
        const paidErr = await threw(() => updateInvoice(mine[0].id, { varianceFlag: false }));
        ok("updateInvoice still accepts a call carrying none of the four", paidErr === null, paidErr?.message || "");
        const wholeErr = await threw(() => updateInvoice(mine[0].id, { tariff: 8.11, salesTax: null }));
        ok("  and a whole-cent figure beside a cleared one", wholeErr === null, wholeErr?.message || "");
    }
} finally {
    console.log("\nCleanup");
    // The action's own `after()` deletes the Blob object once Airtable has ingested
    // it, so this is the helper checking rather than deleting — it reports what it
    // finds, which is how a silent ingest failure surfaces.
    if (blobUrl) fixtures.trackBlob(blobUrl);
    const teardown = await fixtures.teardown({ complete: !incomplete });
    console.log(`  ${fixtures.describe(teardown)}`);
    if (teardown.leaked.length > 0) {
        pass = false;
        console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
    }
}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "ALL CLEAR" : code === 2 ? "INCOMPLETE" : "FAILURES"} — run ${TAG}, exit ${code}`);
process.exit(code);

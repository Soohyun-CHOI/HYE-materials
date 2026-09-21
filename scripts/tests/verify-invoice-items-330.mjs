// An invoice with no items — credentialed (#330).
//
// WHY THIS EXISTS AT ALL. Both halves of this feature are out of reach of the
// offline tier: one is a Server Action's refusal and the other is what a page
// renders. And the state itself cannot be produced by any form — the app refuses
// to create an invoice with no rows and never deletes one from a standing
// invoice — so there is nothing on the base to look at either. Counted before
// this was written: 0 of 22 invoices hold no items, with counts running 1 to 3.
//
// SO THE RUN BUILDS THE STATE, AND THAT IS THE ONE THING TO KNOW ABOUT IT. It
// creates a fixture invoice through the real action and then DELETES THAT
// INVOICE'S OWN `Invoice Items` ROW, which is the only way to reach what a hand
// edit in Airtable reaches. Nothing outside this run's own records is touched.
//
// IT BURNS THE REAL ACTIONS, on the machinery `verify-invoice-recorder-382.mjs`
// established one issue earlier: a multipart POST carrying React's `$ACTION_*`
// fields for the two form actions, and the `Next-Action` RPC for the delete,
// which has no form behind it. That file's header and
// `docs/notes/verification.md` carry the mechanism and its traps.
//
//   A — a session, and the create form's own action fields.
//   B — the create refusal, which must fire on its OWN words and create nothing.
//   C — the fixture, made by the real action.
//   D — the state, made by deleting the fixture's item row.
//   E — the screen, BEFORE and AFTER that deletion. A before/after is what makes
//       this a statement about the cause rather than about two absolute absences.
//   F — the update refusal, which must fire on the RECORD's words and write
//       nothing — the header field it was given has to come back unchanged.
//   G — the delete, which must still work on an invoice in this state, because
//       that is the only way out of it. Then the orphan count.
//
// Fixtures: one Invoice, its Invoice Item and its Invoice-PO Link row, created by
// the real action and deleted in this same run — the item by this script to build
// the state, the rest by the app's own delete — with `scripts/tests/_fixtures.mjs`
// as the net behind it. Two Auth Tokens rows are spent. One Vercel Blob object is
// uploaded and the action's own `after()` removes it. Reuses — never modifies,
// never deletes — one PO, one PO Item and one Vendor.
//
// NEEDS A DEV SERVER on http://localhost:3000 (override with BASE_URL). Run from
// the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-invoice-items-330.mjs
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { put } from "@vercel/blob";
import { TABLES, base } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { getInvoiceById } from "../../lib/airtable/invoices.js";
import { getPOItemByRecordId } from "../../lib/airtable/poItems.js";
import { ITEMS_MISSING_COPY } from "../../lib/invoiceItemsMissing.js";
import { createFixtures } from "./_fixtures.mjs";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-invoice-items-330 — an invoice with no items" });

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

// #382's target, and for its reason: this ordered item has nothing delivered
// against it, so the computed pairing reaches `none` and the run writes nothing
// on a record it does not own.
const PO_RECORD_ID = "recFhuh7Rmic2VxXI"; // HYE-PO-260911-34
const PO_ITEM_RECORD_ID = "recNWQmMybRWcCVKY"; // HYE-PO-260911-34-001
const VENDOR_RECORD_ID = "recJMkaWAGnohzn4z"; // Lone Star Pipe & Supply

/** The create path's own refusal, which this issue deliberately leaves alone. */
const SUBMISSION_REFUSAL = "Add at least one item.";

let pass = true;
let incomplete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};

const fixtures = createFixtures({
    tag: "V330",
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

/** The smallest thing Airtable will accept as a PDF attachment. */
const MINIMAL_PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
        "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8"
);

/** React's four no-JavaScript fields for a `<form action>`, read from the page. */
function actionFieldsFrom(html) {
    const ref = html.match(/name="\$ACTION_REF_(\d+)"/);
    const key = html.match(/name="\$ACTION_KEY"\s+value="([^"]+)"/);
    const n = ref?.[1];
    const spec = n && html.match(new RegExp(`name="\\$ACTION_${n}:0"\\s+value="([^"]+)"`));
    const bound = n && html.match(new RegExp(`name="\\$ACTION_${n}:1"\\s+value="([^"]+)"`));
    if (!n || !key || !spec || !bound) return null;
    const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    return {
        [`$ACTION_REF_${n}`]: "",
        [`$ACTION_${n}:0`]: unescape(spec[1]),
        [`$ACTION_${n}:1`]: unescape(bound[1]),
        $ACTION_KEY: key[1],
    };
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

/** Whether one record id still resolves. A gone record throws rather than answering. */
async function stillOnBase(table, recordId) {
    try {
        await base(table).find(recordId);
        return true;
    } catch {
        return false;
    }
}

/** Mint a session for the one Admin with a name — see #382's script for why. */
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

/** How many invoices the base holds, for the create refusal's own proof. */
async function invoiceCount() {
    return (await base(TABLES.INVOICES).select({ fields: ["Invoice ID"] }).all()).length;
}

let blobUrl = null;
let invoiceRecordId = null;
let invoiceId = null;
let childItemIds = [];
let childLinkIds = [];

try {
    // --- A -----------------------------------------------------------------
    console.log("\nA — a session, and the create form's own action fields");
    let cookie = "";
    let createFields = null;
    try {
        cookie = await mintSession();
        ok("a session cookie was issued", cookie.length > 0);
        const html = await (await fetch(`${BASE}/invoices/new`, { headers: { cookie } })).text();
        createFields = actionFieldsFrom(html);
        ok("the create form carries a Server Action reference", Boolean(createFields));
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    if (!createFields) {
        incomplete = true;
    } else {
        const poItem = await getPOItemByRecordId(PO_ITEM_RECORD_ID);
        const uploaded = await put(`${fixtures.TAG}-invoice.pdf`, MINIMAL_PDF, {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: true,
        });
        blobUrl = uploaded.url;

        /** The create form's body, with whatever items the caller wants. */
        const createBody = (itemsJson, code) => {
            const body = new FormData();
            for (const [name, value] of Object.entries(createFields)) body.set(name, value);
            body.set("vendorId", VENDOR_RECORD_ID);
            body.set("vendorInvoiceCode", code);
            body.set("issueDate", "2026-09-17");
            body.set("amountDue", String((poItem.qty || 1) * poItem.unitPrice));
            body.set("shippingFee", "0");
            body.set("invoiceFileUrl", blobUrl);
            body.set("invoiceFileFilename", `${fixtures.TAG}-invoice.pdf`);
            body.set("itemsJson", itemsJson);
            return body;
        };

        // --- B -------------------------------------------------------------
        console.log("\nB — the create refusal, on its own words, creating nothing");
        const before = await invoiceCount();
        const refused = await fetch(`${BASE}/invoices/new`, {
            method: "POST",
            headers: { cookie },
            body: createBody("[]", `${fixtures.TAG}-EMPTY`),
            redirect: "manual",
        });
        const refusedBody = await refused.text();
        ok(
            "an invoice with no rows is refused rather than created",
            !refused.headers.get("location") && !/\/invoices\/HYE-INV-/.test(refusedBody),
            `status ${refused.status}`
        );
        ok(
            `  in the create path's own words (${JSON.stringify(SUBMISSION_REFUSAL)})`,
            refusedBody.includes(SUBMISSION_REFUSAL)
        );
        // THE TWO REFUSALS ARE TWO FACTS. The record's sentence must not appear here:
        // this reader is filling in a form that can add a row.
        ok(
            "  and NOT in the record's words, which are a different fact",
            !refusedBody.includes(ITEMS_MISSING_COPY.absent)
        );
        ok("  and the base holds no more invoices than before", (await invoiceCount()) === before, `${before}`);

        // --- C -------------------------------------------------------------
        console.log("\nC — the fixture, made by the real action");
        const posted = await fetch(`${BASE}/invoices/new`, {
            method: "POST",
            headers: { cookie },
            body: createBody(
                JSON.stringify([
                    {
                        itemName: `${fixtures.TAG} ${poItem.itemName}`,
                        size: poItem.size || "",
                        unit: poItem.unit || "",
                        qty: String(poItem.qty),
                        unitPrice: String(poItem.unitPrice),
                        poRecordId: PO_RECORD_ID,
                        poItemRecordId: PO_ITEM_RECORD_ID,
                    },
                ]),
                fixtures.TAG
            ),
            redirect: "manual",
        });
        const landed = posted.headers.get("location") || "";
        ok("the action redirected to the new invoice", /\/invoices\/HYE-INV-/.test(landed), landed);
        invoiceId = decodeURIComponent((landed.match(/\/invoices\/([^?]+)/) || [])[1] || "");
        const invoice = invoiceId ? await getInvoiceById(invoiceId) : null;
        if (!invoice) {
            ok("the created invoice could be read back", false);
        } else {
            invoiceRecordId = fixtures.track("invoices", invoice.id);
            childItemIds = (invoice.invoiceItems || []).slice();
            childLinkIds = ((await base(TABLES.INVOICES).find(invoice.id)).get("Invoice-PO Link") || []).slice();
            ok("it holds one invoice item", childItemIds.length === 1, `${childItemIds.length}`);

            // --- E, first half ---------------------------------------------
            console.log("\nE — the screen with items, so the after has something to be measured against");
            const withItems = await (
                await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}`, { headers: { cookie } })
            ).text();
            ok("the totals footer is drawn", withItems.includes("Items Subtotal"));
            ok("  and the orders heading", /Purchase Order(s)?<\/h2>/.test(withItems));
            ok("  and the sentence is absent", !withItems.includes(ITEMS_MISSING_COPY.absent));

            // --- D -----------------------------------------------------------
            console.log("\nD — the state, made by deleting this run's own invoice item");
            for (const id of childItemIds) await base(TABLES.INVOICE_ITEMS).destroy(id);
            const emptied = await getInvoiceById(invoiceId);
            ok(
                "the fixture now holds no items, which no form can produce",
                (emptied.invoiceItems || []).length === 0,
                `${(emptied.invoiceItems || []).length}`
            );
            childItemIds = [];

            // --- E, second half --------------------------------------------
            console.log("\nE — and the screen after it");
            const without = await (
                await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}`, { headers: { cookie } })
            ).text();
            ok("the sentence stands where the table was", without.includes(ITEMS_MISSING_COPY.absent));
            ok("  the totals footer is gone", !without.includes("Items Subtotal"));
            ok("  the column heads are gone", !without.includes("Unit Price"));
            ok("  the header-variance box is gone", !without.includes("Check the total"));
            ok("  the orders heading is not drawn over nothing", !/Purchase Order(s)?<\/h2>/.test(without));
            // AND WHAT MUST SURVIVE. `Amount Due` is the vendor's own claim and is what
            // makes this state legible rather than blank.
            ok("  and Amount Due still states the vendor's claim", without.includes("Amount Due"));

            // --- F -----------------------------------------------------------
            console.log("\nF — the update refusal, on the record's words, writing nothing");
            const editHtml = await (
                await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/edit`, { headers: { cookie } })
            ).text();
            const editFields = actionFieldsFrom(editHtml);
            ok("the edit form carries a Server Action reference", Boolean(editFields));
            if (editFields) {
                const beforeEdit = await getInvoiceById(invoiceId);
                const editBody = new FormData();
                for (const [name, value] of Object.entries(editFields)) editBody.set(name, value);
                editBody.set("invoiceId", invoiceId);
                editBody.set("vendorId", VENDOR_RECORD_ID);
                editBody.set("vendorInvoiceCode", `${fixtures.TAG}-EDITED`);
                editBody.set("issueDate", beforeEdit.issueDate);
                editBody.set("amountDue", String(beforeEdit.amountDue));
                editBody.set("shippingFee", "0");
                editBody.set("itemsJson", JSON.stringify([]));
                const edited = await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/edit`, {
                    method: "POST",
                    headers: { cookie },
                    body: editBody,
                    redirect: "manual",
                });
                const editBodyText = await edited.text();
                ok(
                    "the save is refused rather than redirecting",
                    !edited.headers.get("location"),
                    `status ${edited.status}`
                );
                ok("  in the record's words", editBodyText.includes(ITEMS_MISSING_COPY.absent));
                // AND NOT IN THE SUBMISSION'S. The pair is this refusal and the screen.
                ok("  and NOT in the create path's", !editBodyText.includes(SUBMISSION_REFUSAL));
                // THE REFUSAL RAN BEFORE THE FIRST WRITE, which is the placement this
                // issue is about: `updateInvoice` writes the header first, so a count
                // taken any later would already have changed the record.
                const afterEdit = await getInvoiceById(invoiceId);
                ok(
                    "  and nothing was written — the header is what it was",
                    afterEdit.vendorInvoiceCode === beforeEdit.vendorInvoiceCode,
                    `${JSON.stringify(beforeEdit.vendorInvoiceCode)} -> ${JSON.stringify(afterEdit.vendorInvoiceCode)}`
                );
            }
        }
    }
} catch (err) {
    pass = false;
    console.error("\nverify-invoice-items-330 threw:", err);
} finally {
    // --- G -----------------------------------------------------------------
    console.log("\nG — the way out, which must stay open, and the orphan count");

    let deleteRan = false;
    let cleanupCookie = "";
    try {
        cleanupCookie = await mintSession();
    } catch (err) {
        console.log(`  WARN  could not mint a cleanup session — ${err.message}`);
    }

    if (invoiceRecordId && invoiceId && cleanupCookie) {
        const pageUrl = `${BASE}/invoices/${encodeURIComponent(invoiceId)}`;
        const actionId = await serverActionId(cleanupCookie, pageUrl, "deleteInvoiceAction");
        if (!actionId) {
            incomplete = true;
            console.log("  SKIP  the delete action's id is not in the served chunks — the helper below deletes instead");
        } else {
            const res = await fetch(pageUrl, {
                method: "POST",
                headers: { cookie: cleanupCookie, "Next-Action": actionId, "content-type": "text/plain;charset=UTF-8" },
                body: JSON.stringify([invoiceId]),
                redirect: "manual",
            });
            const flight = await res.text();
            // The route tree carries `"error":"$undefined"` on every response; only the
            // action's own object is a refusal (#382 measured this the hard way).
            const refusal = flight.match(/"error":"(?!\$undefined)([^"]*)"/);
            deleteRan = res.status < 400 && !refusal;
            ok(
                "deleteInvoiceAction still works on an invoice with no items",
                deleteRan,
                `status ${res.status}${refusal ? ` — ${refusal[1]}` : ""}`
            );
        }
    }

    if (deleteRan) {
        const survivors = [];
        for (const id of childLinkIds) {
            if (await stillOnBase(TABLES.INVOICE_PO_LINK, id)) survivors.push(`Invoice-PO Link ${id}`);
        }
        ok(
            `no child of the deleted invoice survived it (${childLinkIds.length} checked)`,
            survivors.length === 0,
            survivors.join("; ")
        );
        const parentGone = !(await stillOnBase(TABLES.INVOICES, invoiceRecordId));
        ok("and the invoice itself is gone", parentGone);
        // Untracked only because it is already gone — see #382's script for why the
        // helper has to be told, and why the evidence is these reads and not the census.
        if (parentGone) fixtures.untrack("invoices", invoiceRecordId);
    }

    if (blobUrl) fixtures.trackBlob(blobUrl);

    const teardown = await fixtures.teardown({ complete: !incomplete });
    console.log(`  ${fixtures.describe(teardown)}`);
    if (teardown.leaked.length > 0) {
        pass = false;
        console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
    }
}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "OK" : code === 2 ? "INCOMPLETE" : "FAILED"} — exit ${code}`);
process.exit(code);

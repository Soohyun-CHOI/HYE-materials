// The computed pairing, invoice side — credentialed (#231).
//
// WHY THIS EXISTS AT ALL. The delivery side of #231 computes in the browser, from
// data the page already holds, so a real session shows it working with no writes.
// The INVOICE side computes inside `createInvoiceAction` and writes the link, and
// none of that is reachable from the offline tier or from the in-app browser: the
// form requires a file upload the browser tooling cannot perform. So the half of
// the feature that WRITES had no execution at all, which this closes.
//
// IT BURNS THE REAL ACTION, NOT A REBUILD OF IT. Reproducing the handler's steps
// from a script would exercise the pairing functions and re-implement the thing
// actually under test — the ORDER, and the fact that the pairing write sits
// outside the create-and-roll-back block. So this posts to the Server Action the
// way a browser with no JavaScript does: React's `useActionState` renders
// `$ACTION_REF_n`, `$ACTION_n:0`, `$ACTION_n:1` and `$ACTION_KEY` into the form,
// and a multipart POST carrying those four plus the ordinary fields reaches
// `createInvoiceAction(null, formData)` through the whole Next.js pipeline. The
// action id is read from the live page rather than from a manifest, because a dev
// server and a built server do not agree on it (measured: they differ).
//
//   A — a session for soo@ (Admin), and the action's own fields off /invoices/new.
//   B — a minimal PDF into Vercel Blob, since the file is a required argument and
//       the action refuses without one.
//   C — the POST. The redirect must carry `paired=matched`, which is the outcome
//       key lib/deliveryInvoiceMatch.js computed inside the action.
//   D — the link on BOTH sides: `Invoices."Delivery"` names the shipment, and the
//       shipment's own `Invoices` reverse-link names the bill.
//   E — cleanup, then the residue check the pairing makes necessary: after the
//       invoice is deleted, the delivery's `Invoices` must be back to what it was.
//       A stored link is the one thing this feature adds to a record it does not
//       own, so "the fixture is gone" is not the same claim as "the delivery is
//       unchanged", and only the second one keeps the next measurement honest.
//
// Everything calls production functions; nothing reimplements a rule.
//
// NEEDS A DEV SERVER on http://localhost:3000 (override with BASE_URL). Run from
// the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-invoice-pairing-231.mjs
//
// Fixtures: one Invoice, its Invoice Items and its Invoice-PO Link rows, all
// created by the real action and DELETED in this same run through
// scripts/tests/_fixtures.mjs. One Auth Tokens row is spent to mint the session.
// One Vercel Blob object is uploaded; the action's own `after()` cleanup deletes
// it once Airtable has ingested it, and this script reports what it finds rather
// than assuming. Reuses (never modifies, never deletes) one Delivery, one PO Item
// and one Vendor.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { put } from "@vercel/blob";
import { TABLES } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { getInvoiceById, setInvoiceDelivery } from "../../lib/airtable/invoices.js";
import { getDeliveryByRecordId } from "../../lib/airtable/deliveries.js";
import { getPOItemByRecordId } from "../../lib/airtable/poItems.js";
import { linkedDelivery } from "../../lib/deliveryInvoiceLink.js";
import { createFixtures } from "./_fixtures.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

// The target, chosen because it makes the outcome unambiguous rather than because
// it is convenient: HYE-DL-260804-09 brought exactly one ordered item, nothing has
// billed that ordered item, and no other bill charges it — so `matched` is the only
// outcome the rule can reach, and a `shared-order` or `several` here would be a
// real failure rather than a differently-shaped pass.
const DELIVERY_RECORD_ID = "rec52KJ2RM8Rn5yD2"; // HYE-DL-260804-09
const PO_ITEM_RECORD_ID = "recDougDWinK53O6T"; // HYE-PO-20260804-12-001
const PO_RECORD_ID = "reccbpyDpL27vWU3j";
const VENDOR_RECORD_ID = "rec5jSDWMNlyIbZDK"; // Demo Vendor Co.

let pass = true;
let incomplete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};

const fixtures = createFixtures({
    tag: "V231",
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

let blobUrl = null;
let invoiceRecordId = null;
let deliveryBefore = null;

try {
    // --- A -----------------------------------------------------------------
    console.log("\nA — a session, and the action's own fields off the live page");

    let cookie = "";
    let actionFields = null;
    try {
        const token = await createAuthToken(ADMIN_EMAIL);
        const tokenValue = typeof token === "string" ? token : token?.token;
        const verified = await fetch(`${BASE}/api/auth/verify`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: tokenValue }),
            redirect: "manual",
        });
        cookie = (verified.headers.getSetCookie?.() || []).join("; ");
        ok("a session cookie was issued", cookie.length > 0, `status ${verified.status}`);

        const page = await fetch(`${BASE}/invoices/new`, { headers: { cookie }, redirect: "manual" });
        const html = await page.text();
        ok("/invoices/new renders for that session", page.status === 200 && html.includes("New Invoice"));

        // The four fields React writes for the no-JavaScript path. Read from the
        // page because a dev server and a built server mint different ids.
        const ref = html.match(/name="\$ACTION_REF_(\d+)"/);
        const key = html.match(/name="\$ACTION_KEY"\s+value="([^"]+)"/);
        const n = ref?.[1];
        const spec = n && html.match(new RegExp(`name="\\$ACTION_${n}:0"\\s+value="([^"]+)"`));
        const bound = n && html.match(new RegExp(`name="\\$ACTION_${n}:1"\\s+value="([^"]+)"`));
        if (n && key && spec && bound) {
            const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
            actionFields = {
                [`$ACTION_REF_${n}`]: "",
                [`$ACTION_${n}:0`]: unescape(spec[1]),
                [`$ACTION_${n}:1`]: unescape(bound[1]),
                $ACTION_KEY: key[1],
            };
        }
        ok("the form carries a Server Action reference", Boolean(actionFields));
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    if (!actionFields) {
        incomplete = true;
    } else {
        // --- B -------------------------------------------------------------
        console.log("\nB — the invoice file, which is a required argument");
        const poItem = await getPOItemByRecordId(PO_ITEM_RECORD_ID);
        deliveryBefore = await getDeliveryByRecordId(DELIVERY_RECORD_ID);
        ok(
            "the target shipment starts with no bill naming it",
            (deliveryBefore.invoices || []).length === 0,
            `${(deliveryBefore.invoices || []).length} linked`
        );

        const uploaded = await put(`${fixtures.TAG}-invoice.pdf`, MINIMAL_PDF, {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: true,
        });
        blobUrl = uploaded.url;
        ok("a file is in Blob for the action to hand Airtable", Boolean(blobUrl));

        // --- C -------------------------------------------------------------
        console.log("\nC — the real Server Action, posted the way a form does");
        const body = new FormData();
        for (const [name, value] of Object.entries(actionFields)) body.set(name, value);
        body.set("vendorId", VENDOR_RECORD_ID);
        body.set("vendorInvoiceCode", fixtures.TAG);
        body.set("issueDate", "2026-08-13");
        body.set("amountDue", String((poItem.qty || 1) * poItem.unitPrice));
        body.set("shippingFee", "0");
        body.set("invoiceFileUrl", blobUrl);
        body.set("invoiceFileFilename", `${fixtures.TAG}-invoice.pdf`);
        body.set(
            "itemsJson",
            JSON.stringify([
                {
                    itemName: `${fixtures.TAG} ${poItem.itemName}`,
                    size: poItem.size || "",
                    unit: poItem.unit || "",
                    qty: String(poItem.qty),
                    // The agreed price exactly — the gate is part of the rule, so a
                    // departure here would make the run prove the wrong thing.
                    unitPrice: String(poItem.unitPrice),
                    poRecordId: PO_RECORD_ID,
                    poItemRecordId: PO_ITEM_RECORD_ID,
                },
            ])
        );

        const posted = await fetch(`${BASE}/invoices/new`, {
            method: "POST",
            headers: { cookie },
            body,
            redirect: "manual",
        });
        const location = posted.headers.get("location") || posted.headers.get("x-action-redirect") || "";
        const text = location ? "" : await posted.text();
        const landed = location || (text.match(/\/invoices\/[^"'\\\s]+/) || [""])[0];
        console.log(`        status ${posted.status}, landed on ${landed || "(nothing)"}`);

        ok("the action redirected to the new invoice", /\/invoices\/HYE-INV-/.test(landed));
        ok(
            "and the redirect carries the pairing outcome the action computed",
            landed.includes("paired=matched"),
            landed.includes("paired=") ? landed.slice(landed.indexOf("paired=")) : "no paired parameter"
        );

        // --- D -------------------------------------------------------------
        console.log("\nD — the link, on both sides");
        const invoiceId = (landed.match(/\/invoices\/([^?]+)/) || [])[1];
        const invoice = invoiceId ? await getInvoiceById(decodeURIComponent(invoiceId)) : null;
        if (invoice) {
            invoiceRecordId = fixtures.track("invoices", invoice.id);
            ok(
                "the invoice names the shipment its ordered items place it on",
                linkedDelivery(invoice) === DELIVERY_RECORD_ID,
                linkedDelivery(invoice) || "nothing linked"
            );
            const deliveryAfter = await getDeliveryByRecordId(DELIVERY_RECORD_ID);
            ok(
                "and the shipment's own reverse-link names the bill",
                (deliveryAfter.invoices || []).includes(invoice.id),
                `${(deliveryAfter.invoices || []).length} linked`
            );
        } else {
            ok("the created invoice could be read back", false, "no invoice id in the redirect");
        }
    }
} catch (err) {
    pass = false;
    console.error("\nverify-invoice-pairing-231 threw:", err);
} finally {
    // --- E -----------------------------------------------------------------
    console.log("\nE — cleanup, and the residue this feature makes necessary");

    // Detached through the production write before the delete, so the run does not
    // rest on Airtable's cascade to clear a link it created. The delete would
    // remove it either way; measuring both is what makes the residue check below
    // a statement about the delivery rather than about the invoice.
    if (invoiceRecordId) {
        try {
            await setInvoiceDelivery(invoiceRecordId, null);
            const detached = await getDeliveryByRecordId(DELIVERY_RECORD_ID);
            ok(
                "detaching through the production write clears the shipment's side",
                !(detached.invoices || []).includes(invoiceRecordId)
            );
        } catch (err) {
            pass = false;
            console.log(`  FAIL  detach threw — ${err.message}`);
        }
    }

    // The Blob object is the fixture helper's to judge. The action schedules its
    // own after() cleanup, so the object is normally gone before this runs, and
    // teardown discriminates "not found" from "could not tell" rather than reading
    // both as success — which is exactly the distinction #140's timeout rule needs.
    if (blobUrl) fixtures.trackBlob(blobUrl);

    const teardown = await fixtures.teardown({ complete: !incomplete });
    console.log(`  ${fixtures.describe(teardown)}`);
    if (teardown.leaked.length > 0) {
        pass = false;
        console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
    }

    if (deliveryBefore) {
        const deliveryFinal = await getDeliveryByRecordId(DELIVERY_RECORD_ID);
        ok(
            "the shipment is back to the number of bills it started with",
            (deliveryFinal.invoices || []).length === (deliveryBefore.invoices || []).length,
            `before ${(deliveryBefore.invoices || []).length}, after ${(deliveryFinal.invoices || []).length}`
        );
    }

}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "OK" : code === 2 ? "INCOMPLETE" : "FAILED"} — exit ${code}`);
process.exit(code);

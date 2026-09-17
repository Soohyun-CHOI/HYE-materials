// Who entered an invoice — credentialed (#382).
//
// WHY THIS EXISTS AT ALL. `Invoices."Recorded By"` is written inside
// `createInvoiceAction` and nowhere else, and that action is out of reach of both
// cheaper tiers: the offline tier never opens a page, and the in-app browser
// cannot perform the file upload `/invoices/new` requires. So the half of this
// feature that WRITES has no execution without a script. #231's own verify script
// is the precedent and its header states the same gap; PR #234 named this pattern
// as the way to measure `createDeliveryAction` and did not add one. This is the
// second use of it.
//
// IT BURNS THE REAL ACTIONS, ALL THREE OF THEM. Reproducing a handler's steps from
// a script would exercise the service functions and re-implement the thing under
// test. So this posts to `createInvoiceAction` and `updateInvoiceAction` the way a
// form does, and calls `deleteInvoiceAction` the way the browser does.
//
//   THE DELETE IS A DIFFERENT MECHANISM FROM THE OTHER TWO AND THIS FILE IS THE
//   FIRST PLACE IN THIS TIER TO USE IT. `DeleteInvoiceButton` calls the action as
//   a FUNCTION rather than through `<form action>`, so no `$ACTION_*` fields are
//   rendered and there is nothing on the page to post. What reaches it is the
//   `Next-Action` RPC #147 established: a POST to the page's own URL carrying the
//   action id in that header and the arguments as a JSON array. **The id is read
//   from the client chunk's own `__next_internal_action_entry_do_not_use__`
//   marker, which is a JSON map of id to export NAME** — so the lookup is by name
//   and no position or ordering is assumed. Measured working before this script
//   was written, by calling the action with an invoice id that cannot exist and
//   getting its own `That invoice no longer exists.` back, which reaches the
//   handler and writes nothing.
//
//   A — a session for the one Admin this app can use, and the create form's fields.
//   B — a minimal PDF into Vercel Blob, since the file is a required argument.
//   C — the create. `Recorded By` must hold that session's user and nobody else.
//   D — both rendered states, off the live server with that session: the fixture's
//       page names the person, and an invoice entered before the field existed
//       renders the em dash.
//   E — the edit, which must change what it was given and leave this field alone.
//       Run as a POST rather than asserted from the signature, because "there is
//       no parameter for it" is a claim about a path rather than about a file.
//   F — the list axis, through the production filter functions.
//   G — the delete, through the app's own action, and then the orphan count. The
//       handler destroys its children with `Promise.allSettled` and discards the
//       results, then destroys the parent regardless — so a child delete that
//       failed would be invisible and the row would survive with no parent. Every
//       child id is captured BEFORE the delete and read back after, because a
//       surviving child has an empty link by then and no query for it would find
//       one.
//
// THE ADMIN IS `soo@`, AND THAT IS FORCED RATHER THAN CHOSEN. Creating an invoice
// is Admin-only and both permanent fixture accounts are non-Admin by design —
// `authz-fixture@` exists to fail every gate and `scoped-fixture@` to pass a
// row-scoped one, and widening either would destroy what it is for
// (`docs/notes/verification.md`). Of the base's five Admins, `soo@` is the only
// one with a `First Name`, and since #381 `requireUser()` sends a nameless reader
// to `/login/name` — so the other four cannot hold a session that reaches this
// form at all. No account is created: an Admin fixture would be a sixth Admin on a
// base whose Admin set is the office, and this needs a session rather than a
// person.
//
// NEEDS A DEV SERVER on http://localhost:3000 (override with BASE_URL). Run from
// the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-invoice-recorder-382.mjs
//
// Fixtures: one Invoice, its Invoice Items and its Invoice-PO Link rows, all
// created by the real action and deleted in this same run by the real action, with
// scripts/tests/_fixtures.mjs as the net behind it. One Auth Tokens row is spent to
// mint the session. One Vercel Blob object is uploaded; the action's own `after()`
// cleanup deletes it once Airtable has ingested it, and the helper reports what it
// finds rather than assuming. Reuses — never modifies, never deletes — one PO, one
// PO Item and one Vendor. The ordered item is deliberately one that NO delivery
// has touched, so #231's pairing computes `none` and this run writes nothing at
// all on a record it does not own.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { put } from "@vercel/blob";
import { TABLES, base } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { getInvoiceById } from "../../lib/airtable/invoices.js";
import { getPOItemByRecordId } from "../../lib/airtable/poItems.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { userName } from "../../lib/userName.js";
import { applyFilters, axesFor, emptyFilters, parseFilters } from "../../lib/listFilters.js";
import { createFixtures } from "./_fixtures.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

// The target, chosen so this run's footprint is the smallest one that still
// exercises the whole action: `HYE-PO-260911-34` is Signed, its one ordered item
// has nothing invoiced against it, and NO delivery item names it — so
// `matchDeliveryToInvoice` reaches `none` and no link is written on any record
// this script does not create. Verified in part B rather than trusted.
const PO_RECORD_ID = "recFhuh7Rmic2VxXI"; // HYE-PO-260911-34
const PO_ITEM_RECORD_ID = "recNWQmMybRWcCVKY"; // HYE-PO-260911-34-001
const VENDOR_RECORD_ID = "recJMkaWAGnohzn4z"; // Lone Star Pipe & Supply

let pass = true;
let incomplete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};

const fixtures = createFixtures({
    tag: "V382",
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

/**
 * The four fields React renders for the no-JavaScript path of a `<form action>`.
 *
 * Read from the live page rather than from a manifest, because a dev server and a
 * built server do not agree on the id (#231 measured that they differ).
 */
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

/**
 * The id of a server action a CLIENT component imports, looked up by export name.
 *
 * Turbopack writes `__next_internal_action_entry_do_not_use__ [{id: {name}}, …]`
 * into the chunk that carries the client reference, which is a JSON map — so this
 * asks for a name and never for a position. Returns null rather than guessing,
 * and the caller reports that as incomplete: a production build may not carry the
 * marker, and a run that silently skipped the delete would leave the fixture on
 * the base while reading as a pass.
 */
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

let blobUrl = null;
let invoiceRecordId = null;
let invoiceId = null;
let childItemIds = [];
let childLinkIds = [];

try {
    // --- A -----------------------------------------------------------------
    console.log("\nA — a session for the one Admin this app can use, and the form's fields");

    let cookie = "";
    let createFields = null;
    let admin = null;
    try {
        admin = await getUserByEmail(ADMIN_EMAIL);
        ok("the Admin account this run needs exists", Boolean(admin?.id), admin?.id || "not found");
        ok("  and is an Admin, so the create form is reachable", admin?.isAdmin === true);
        ok(
            "  and has a name, so requireUser does not divert to /login/name",
            Boolean(userName(admin)),
            userName(admin) || "no name"
        );

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
        createFields = actionFieldsFrom(html);
        ok("the form carries a Server Action reference", Boolean(createFields));
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    if (!createFields || !admin) {
        incomplete = true;
    } else {
        // --- B -------------------------------------------------------------
        console.log("\nB — the ordered item this run charges, and the file the action requires");
        const poItem = await getPOItemByRecordId(PO_ITEM_RECORD_ID);
        ok(
            "the ordered item has nothing delivered against it, so the pairing stays out of this run",
            (poItem.deliveryItems || []).length === 0,
            `${(poItem.deliveryItems || []).length} delivery items`
        );

        const uploaded = await put(`${fixtures.TAG}-invoice.pdf`, MINIMAL_PDF, {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: true,
        });
        blobUrl = uploaded.url;
        ok("a file is in Blob for the action to hand Airtable", Boolean(blobUrl));

        // --- C -------------------------------------------------------------
        console.log("\nC — createInvoiceAction, posted the way the form does");
        const body = new FormData();
        for (const [name, value] of Object.entries(createFields)) body.set(name, value);
        body.set("vendorId", VENDOR_RECORD_ID);
        body.set("vendorInvoiceCode", fixtures.TAG);
        body.set("issueDate", "2026-09-17");
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
            "  and computed no pairing, as this ordered item's history predicts",
            !landed.includes("paired="),
            landed.includes("paired=") ? landed.slice(landed.indexOf("paired=")) : "no paired parameter"
        );

        invoiceId = decodeURIComponent((landed.match(/\/invoices\/([^?]+)/) || [])[1] || "");
        const invoice = invoiceId ? await getInvoiceById(invoiceId) : null;
        if (!invoice) {
            ok("the created invoice could be read back", false, "no invoice id in the redirect");
        } else {
            invoiceRecordId = fixtures.track("invoices", invoice.id);
            ok(
                "the invoice names the session's own user and nobody else",
                (invoice.recordedBy || []).length === 1 && invoice.recordedBy[0] === admin.id,
                `recordedBy ${JSON.stringify(invoice.recordedBy || [])}, session user ${admin.id}`
            );

            // THE CHILDREN, CAPTURED NOW AND BY ID. After the delete a survivor has
            // an empty `Invoice` link, so nothing asked from the parent's side would
            // find it — which is exactly why the handler's discarded batch is
            // invisible from inside the app. Both reverse-link arrays are on the
            // record the mapper already read plus one raw read for the join rows,
            // which `recordToInvoice` has no reason to carry.
            childItemIds = (invoice.invoiceItems || []).slice();
            childLinkIds = ((await base(TABLES.INVOICES).find(invoice.id)).get("Invoice-PO Link") || []).slice();
            ok("the action created the invoice item", childItemIds.length > 0, `${childItemIds.length}`);
            ok("  and the Invoice-PO Link row", childLinkIds.length > 0, `${childLinkIds.length}`);
        }

        // --- D -------------------------------------------------------------
        console.log("\nD — both rendered states, off the live server with that session");
        //
        // THE WHOLE ELEMENT IS MATCHED, NOT THE NAME. `Soo` appears elsewhere on this
        // page, so an assertion that only looked for it would pass with the line
        // absent. React renders the text/expression boundary as an empty comment, so
        // the html is flattened first — read off the live server before this was
        // written, rather than predicted.
        const line = (html, value) => html.replace(/<!-- -->/g, "").includes(`<p>Recorded by: ${value}</p>`);
        if (invoiceId) {
            const detail = await (
                await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}`, { headers: { cookie } })
            ).text();
            ok(
                `the fixture's page names the recorder (${userName(admin)})`,
                line(detail, userName(admin)),
                "checked the rendered html"
            );
        }
        // An invoice entered before the field existed, taken from the list rather
        // than named, so this assertion cannot outlive the row it is about.
        const listHtml = await (await fetch(`${BASE}/invoices`, { headers: { cookie } })).text();
        ok("the list's bar carries the reader's-own toggle", listHtml.includes("Recorded by me"));
        const older = [...listHtml.matchAll(/\/invoices\/(HYE-INV-[0-9-]+)/g)]
            .map((m) => m[1])
            .find((id) => id !== invoiceId);
        if (older) {
            const olderHtml = await (await fetch(`${BASE}/invoices/${older}`, { headers: { cookie } })).text();
            ok(
                `an invoice with no recorder renders the em dash (${older})`,
                line(olderHtml, "—"),
                "checked the rendered html"
            );
        } else {
            ok("an older invoice was available to check the empty state", false);
        }

        // --- E -------------------------------------------------------------
        console.log("\nE — updateInvoiceAction, which must change what it was given and nothing else");
        if (invoiceId && invoiceRecordId) {
            const editHtml = await (
                await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/edit`, { headers: { cookie } })
            ).text();
            const editFields = actionFieldsFrom(editHtml);
            ok("the edit form carries a Server Action reference", Boolean(editFields));
            if (editFields) {
                const before = await getInvoiceById(invoiceId);
                const editedCode = `${fixtures.TAG}-EDITED`;
                const editBody = new FormData();
                for (const [name, value] of Object.entries(editFields)) editBody.set(name, value);
                editBody.set("invoiceId", invoiceId);
                editBody.set("vendorId", VENDOR_RECORD_ID);
                editBody.set("vendorInvoiceCode", editedCode);
                editBody.set("issueDate", before.issueDate);
                editBody.set("amountDue", String(before.amountDue));
                editBody.set("shippingFee", "0");
                editBody.set("itemsJson", JSON.stringify([]));
                const edited = await fetch(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/edit`, {
                    method: "POST",
                    headers: { cookie },
                    body: editBody,
                    redirect: "manual",
                });
                console.log(`        status ${edited.status}`);
                const after = await getInvoiceById(invoiceId);
                // BOTH HALVES, because either alone is the vacuous version: a field
                // that did not change proves nothing if the edit never ran.
                ok(
                    "the edit changed the field it was given",
                    after.vendorInvoiceCode === editedCode,
                    `${JSON.stringify(before.vendorInvoiceCode)} -> ${JSON.stringify(after.vendorInvoiceCode)}`
                );
                ok(
                    "  and left the recorder exactly as the create wrote it",
                    JSON.stringify(after.recordedBy || []) === JSON.stringify(before.recordedBy || []),
                    JSON.stringify(after.recordedBy || [])
                );
            }
        }

        // --- F -------------------------------------------------------------
        console.log("\nF — the list axis, through the production filter");
        if (invoiceRecordId) {
            const rows = [
                { invoiceId, isMine: true },
                { invoiceId: "other-1", isMine: false },
                { invoiceId: "other-2", isMine: false },
            ];
            const axes = axesFor("/invoices").map((a) => a.param);
            ok("the invoice list declares a reader's-own axis", axes.includes("mine"), axes.join(" + "));
            const onFilter = parseFilters("/invoices", { mine: "1" }, {});
            const admitted = applyFilters("/invoices", onFilter, rows);
            ok(
                "`?mine=1` admits exactly the row this run's recorder owns",
                admitted.length === 1 && admitted[0].invoiceId === invoiceId,
                `${admitted.length} rows`
            );
            const off = applyFilters("/invoices", emptyFilters("/invoices"), rows);
            ok("  and an unfiltered list admits every row", off.length === rows.length, `${off.length} rows`);
        }
    }
} catch (err) {
    pass = false;
    console.error("\nverify-invoice-recorder-382 threw:", err);
} finally {
    // --- G -----------------------------------------------------------------
    console.log("\nG — the app's own delete, and then the orphan count");

    let deleteRan = false;

    // The session is minted again rather than carried out of the try, so a throw
    // anywhere above still reaches the delete with a working one. It costs one more
    // `Auth Tokens` row, which is the price of the cleanup not depending on how far
    // the body got.
    let cleanupCookie = "";
    try {
        const token = await createAuthToken(ADMIN_EMAIL);
        const tokenValue = typeof token === "string" ? token : token?.token;
        const verified = await fetch(`${BASE}/api/auth/verify`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: tokenValue }),
            redirect: "manual",
        });
        cleanupCookie = (verified.headers.getSetCookie?.() || []).join("; ");
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
            // THE ROUTE TREE CARRIES `"error":"$undefined"` ON EVERY RESPONSE, so a
            // bare search for `"error"` reads a success as a failure — measured, on
            // this script's first run. What a refused delete returns is the action's
            // own object, `{"error":"That invoice no longer exists."}`, which is the
            // shape the mechanism was proved with before any of this was written.
            // The verdict is still the three record reads below rather than this
            // string: a framework payload is a diagnostic, and whether the rows are
            // gone is the claim.
            const refusal = flight.match(/"error":"(?!\$undefined)([^"]*)"/);
            deleteRan = res.status < 400 && !refusal;
            ok(
                "deleteInvoiceAction ran and returned no refusal",
                deleteRan,
                `status ${res.status}${refusal ? ` — ${refusal[1]}` : ""}`
            );
        }
    }

    // THE COUNT, WHICH IS THE POINT OF PART G. `deleteInvoiceHandler` destroys its
    // children with a settled batch whose results it discards and then destroys the
    // parent regardless, so a child that failed to go is invisible from inside the
    // action and has no link left to find it by. Each id is read back on its own.
    if (deleteRan) {
        const survivors = [];
        for (const id of childItemIds) {
            if (await stillOnBase(TABLES.INVOICE_ITEMS, id)) survivors.push(`Invoice Item ${id}`);
        }
        for (const id of childLinkIds) {
            if (await stillOnBase(TABLES.INVOICE_PO_LINK, id)) survivors.push(`Invoice-PO Link ${id}`);
        }
        ok(
            `no child of the deleted invoice survived it (${childItemIds.length + childLinkIds.length} checked)`,
            survivors.length === 0,
            survivors.join("; ")
        );
        const parentGone = !(await stillOnBase(TABLES.INVOICES, invoiceRecordId));
        ok("and the invoice itself is gone", parentGone);
        // UNTRACKED ONLY BECAUSE IT IS ALREADY GONE, and the helper has to be told:
        // its delete loop reads each tracked parent first, and a read that throws is
        // recorded as a leak — which is the right reading when the helper is the
        // deleter and the wrong one here, where the app already did it. The evidence
        // that this run left nothing is the three `stillOnBase` reads above, not the
        // census below; the census is what catches a run that threw before part G.
        if (parentGone) fixtures.untrack("invoices", invoiceRecordId);
    }

    // The Blob object is the fixture helper's to judge. The action schedules its own
    // after() cleanup, so the object is normally gone before this runs, and teardown
    // discriminates "not found" from "could not tell" rather than reading both as
    // success.
    if (blobUrl) fixtures.trackBlob(blobUrl);

    // THE NET, NOT THE DELETER. Everything above has already gone through the app's
    // own path; what this catches is the run that threw before it got there.
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

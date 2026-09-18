// Each charge in the order breakdown carries its ordered quantity — credentialed (#408).
//
// WHY THIS EXISTS, AND IT IS NOT THE ARITHMETIC. `offline/invoice-order-breakdown.mjs`
// pins the denominator over hand-built folds, both mutants included, and that tier is
// where the rule lives. Two things it cannot reach, and both are this file's:
//
//   THE SHAPE THE SUM EXISTS FOR IS REACHABLE THROUGH THE APP, which is what makes
//   the mutant worth running. One folded item can cover TWO `PO Items` rows on ONE
//   order, because `lib/prItemMerge.js:mergeKey` holds `Remark` and the quotation
//   where `lib/invoiceItemFold.js:foldKey` holds neither. That is an argument until
//   something runs it: the merge is asked, its answer is what gets written, and the
//   two ordered items are then read back off the base with one `Materials` row and
//   one price between them. Asserting the end state by hand would be asserting the
//   premise.
//
//   THE PAGE RENDERS IT. The offline tier never opens a page, so `5 of 10 EA` living
//   in a copy constant says nothing about whether the line reaches a reader. This
//   fetches `/invoices/[invoiceId]` with a real session and reads the denominators
//   out of the HTML the server sent.
//
// AND THE FIXTURE IS WHAT THE BASE DOES NOT HOLD. Measured 2026-09-18 over 22
// invoices, 24 invoice items and 39 ordered items: ONE invoice turns the list on
// (`HYE-INV-260911-12`) and every line of it reads `N of N`, so the denominator would
// be invisible against the numerator on the only screen that shows it; no folded item
// anywhere covers two ordered items on one order; and no invoice item has an empty
// `PO Item`. So a partial charge and the summed whole are both states this run has to
// create to look at.
//
//   A — the merge's answer, and the records built FROM it.
//   B — a second order, and the invoice charging the first twice and the second once.
//   C — the production reads, end to end: reconciliation → fold → chargesByOrder.
//   D — the rendered page.
//
// IT CREATES BOTH ORDERS RATHER THAN REUSING ONE, which costs six records and buys
// two things. An existing ordered item charged by a fixture invoice carries this run's
// reverse-link and a moved `Invoiced Qty` for as long as the run lives — reverted at
// teardown, and still a figure changing on a record this script does not own. And
// `verify-invoice-header-precision-405.mjs` has to name three record ids in source and
// re-verify their state every run, which is a dependency on the base staying as it was.
// The only records this REUSES are a Job, a Discipline, a Vendor and a requester, each
// of which gains a reverse-link and nothing else.
//
// NOTHING HERE WAITS FOR A PERSON. The fixtures are created, read, rendered and
// deleted inside one run, so no path through this file can leave rows on the base
// while a human decides something. The page it fetched is written to disk on the way
// past, which is what makes the render readable after the records are gone.
//
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-order-breakdown-408.mjs
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed or a
// fixture leaked, 2 the dev server was unreachable so part D did not run.

import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TABLES, base } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { createInvoice, linkInvoiceToPO, getInvoiceById } from "../../lib/airtable/invoices.js";
import { createInvoiceItem, getItemsByInvoice } from "../../lib/airtable/invoiceItems.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllDisciplines } from "../../lib/airtable/disciplines.js";
import { mergeIdenticalItems } from "../../lib/prItemMerge.js";
import { getInvoiceReconciliation } from "../../lib/deliveryReconciliation.js";
import { foldInvoiceItems } from "../../lib/invoiceItemFold.js";
import { ORDER_BREAKDOWN_COPY, chargesByOrder } from "../../lib/invoiceOrderBreakdown.js";
import { resolveVerifyCategories } from "./_categories.mjs";
import { createFixtures } from "./_fixtures.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

// The one record named in source. A vendor is reused because both orders must share
// one — an invoice charging two vendors is not a document this app has — and it gains
// a reverse-link and nothing else.
const VENDOR_RECORD_ID = "recJMkaWAGnohzn4z"; // Lone Star Pipe & Supply

// What the fixture orders and what it charges. EVERY CHARGE IS UNDER WHAT WAS
// ORDERED, which is the whole reason this fixture exists: a denominator equal to its
// numerator on every line is the state the base already holds, and there the feature
// and its absence render the same page.
const FIRST = { orderedA: 10, orderedB: 5, chargedA: 4, chargedB: 3 };
const SECOND = { ordered: 20, charged: 8 };

let pass = true;
let incomplete = false;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok, detail = "") {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return ok;
}

const fixtures = createFixtures({
    tag: "V408",
    buckets: [
        // NO tagField, AND THAT IS #356's DOING RATHER THAN AN OMISSION. An invoice
        // item's `Item Name` is a frozen copy of the ordered item's, which is written
        // from `Category Label` and typed nowhere — so no tag this run controls can
        // reach it, and declaring the field anyway makes every census read 0 and fall
        // back, which is the partial tag `_fixtures.mjs` refuses. Tracked, so a
        // tracked-id re-read is the residue check. Deleted before the Invoice, which
        // also lists them as children.
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable: an Invoice-PO Link row's primary is an autoNumber and
                // it carries no text at all.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
        // No tagField: written by generatePOForApprovedPR, and this script sets no
        // text field on it. Tracked, so a tracked-id re-read is the residue check.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        // Tagged under the rule's second clause: this script calls createPR, so
        // `notes` is one argument away.
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // FOUND BY TAG, NOT TRACKED — PO generation writes these as a side effect
        // (#18) and this script never holds an id for them. `Item Name` is a lookup
        // since #356, so the tag rides on `Size` and every fixture size carries it.
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            tagField: "Size",
            discoverByTag: true,
            expectAtLeast: 1,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;
// Two categories, so the two orders carry two materials and cannot fold into each
// other — if they did, one folded item would touch both orders, the sets would agree
// and the list this run is here to read would not be drawn at all.
const [CATEGORY, SECOND_CATEGORY] = await resolveVerifyCategories();

/** The sizes the fixture materials are keyed on — tagged, which is what teardown finds. */
const FIXTURE_SIZE = `${TAG} 2"`;
const SECOND_SIZE = `${TAG} 4"`;

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

/**
 * One row in the shape `/prs/new` hands `mergeIdenticalItems`, so what is merged here
 * is what the form merges. `categoryCodes` is the four-level path and only its leaf
 * is read by the key; `quotationIndex` is the slot the form assigns.
 */
const formRow = (remark) => ({
    categoryCodes: [...CATEGORY.codes],
    itemName: CATEGORY.label,
    size: FIXTURE_SIZE,
    unit: "EA",
    qty: "",
    unitPrice: "24",
    remark,
    quotationIndex: 0,
});

try {
    // --- A -----------------------------------------------------------------
    console.log(`\nA — the merge's answer, and the records built from it (run ${TAG})`);

    // THE CONTROL FIRST. Two rows agreeing on everything must collapse to one, or
    // "they stayed two" below says nothing about the remark — it would be a merge
    // that never merges, which is the quiet way this observation goes vacuous.
    const identical = mergeIdenticalItems([formRow("same note"), formRow("same note")]);
    check("two rows agreeing on everything merge to one", identical.length, 1);

    const byRemark = mergeIdenticalItems([formRow("first run"), formRow("second run")]);
    check("two rows differing ONLY in their remark stay two", byRemark.length, 2);
    assert(
        "  and they agree on every other term of the fold key",
        byRemark[0].categoryCodes[3] === byRemark[1].categoryCodes[3] &&
            byRemark[0].size === byRemark[1].size &&
            byRemark[0].unit === byRemark[1].unit &&
            byRemark[0].unitPrice === byRemark[1].unitPrice
    );

    const [requester] = await getActiveUsers();
    const discipline = (await getAllDisciplines())[0];
    assert("a requester and a discipline resolve", Boolean(requester?.id && discipline?.id));

    const pr = await createPR({
        requesterId: requester.id,
        disciplineId: discipline.id,
        vendorId: VENDOR_RECORD_ID,
        notes: `${TAG} two ordered items on one order`,
    });
    track("prs", pr.id);

    // THE MERGE'S OUTPUT IS WHAT GETS WRITTEN, not a hand-made pair that happens to
    // look like it. `createItem` does no merging of its own — the rule lives in
    // `parseFormState` — so writing two rows directly would prove nothing about it.
    const quantities = [FIRST.orderedA, FIRST.orderedB];
    for (const [i, merged] of byRemark.entries()) {
        await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: merged.itemName,
            categoryRecordId: CATEGORY.recordId,
            size: merged.size,
            unit: merged.unit,
            qty: quantities[i],
            unitPrice: Number(merged.unitPrice),
            remark: merged.remark,
        });
    }

    await updatePR(pr.id, { status: "Approved" });
    const generated = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", generated.poRecordId);

    // Sorted on `PO Item ID`, which is `{PO ID}-001`, `-002` in snapshot order, so the
    // two assertions below name a row rather than whichever one came back first.
    const orderedItems = (await getItemsByPO(generated.poRecordId)).sort((a, b) =>
        (a.poItemId || "").localeCompare(b.poItemId || "")
    );
    check("the order snapshots both request items", orderedItems.length, 2);
    assert(
        "  as two distinct ordered items",
        orderedItems[0]?.id !== orderedItems[1]?.id
    );
    check(
        "  sharing one material",
        orderedItems[0]?.material?.[0] === orderedItems[1]?.material?.[0],
        true
    );
    check("  and one unit price", orderedItems[0]?.unitPrice === orderedItems[1]?.unitPrice, true);
    check("  with the quantities the request carried", orderedItems.map((o) => o.qty).join(","), "10,5");
    // The whole this run exists to render, stated before anything computes it.
    check(
        "so one folded charge over both has a whole of 15",
        orderedItems.reduce((sum, o) => sum + (o.qty ?? 0), 0),
        FIRST.orderedA + FIRST.orderedB
    );

    // --- B -----------------------------------------------------------------
    console.log("\nB — a second order, and the invoice charging both");

    // ONE ITEM, A DIFFERENT MATERIAL. What this order is for is the OTHER side of the
    // same-set test: its charge folds on its own, so the invoice's folded items name
    // `{first}` and `{second}` and the list is drawn. One material on both orders
    // would fold them into one item touching both, which is the silent case.
    const secondPR = await createPR({
        requesterId: requester.id,
        disciplineId: discipline.id,
        vendorId: VENDOR_RECORD_ID,
        notes: `${TAG} the second order`,
    });
    track("prs", secondPR.id);
    await createItem({
        prRecordId: secondPR.id,
        prId: secondPR.prId,
        itemName: SECOND_CATEGORY.label,
        categoryRecordId: SECOND_CATEGORY.recordId,
        size: SECOND_SIZE,
        unit: "EA",
        qty: SECOND.ordered,
        unitPrice: 17,
        remark: "",
    });
    await updatePR(secondPR.id, { status: "Approved" });
    const secondGenerated = await generatePOForApprovedPR(await getPRByRecordId(secondPR.id));
    track("pos", secondGenerated.poRecordId);

    const [secondOrderedItem] = await getItemsByPO(secondGenerated.poRecordId);
    assert("the second order carries one ordered item", Boolean(secondOrderedItem?.id));
    check("  for the quantity the request asked for", secondOrderedItem.qty, SECOND.ordered);
    assert(
        "  on a different material from the first order's, so nothing folds across them",
        secondOrderedItem.material?.[0] !== orderedItems[0].material?.[0]
    );

    const invoice = await createInvoice({
        vendorId: VENDOR_RECORD_ID,
        vendorInvoiceCode: `${TAG}-INV`,
        issueDate: "2026-09-18",
        dueDate: "2026-10-18",
        amountDue: 304,
        shippingFee: 0,
    });
    track("invoices", invoice.id);
    await linkInvoiceToPO(invoice.id, generated.poRecordId);
    await linkInvoiceToPO(invoice.id, secondGenerated.poRecordId);

    const charges = [
        { orderedItem: orderedItems[0], po: generated.poRecordId, qty: FIRST.chargedA },
        { orderedItem: orderedItems[1], po: generated.poRecordId, qty: FIRST.chargedB },
        { orderedItem: secondOrderedItem, po: secondGenerated.poRecordId, qty: SECOND.charged },
    ];
    for (const c of charges) {
        const created = await createInvoiceItem({
            invoiceRecordId: invoice.id,
            invoiceId: invoice.invoiceId,
            poRecordId: c.po,
            poItemRecordId: c.orderedItem.id,
            itemName: c.orderedItem.itemName,
            size: c.orderedItem.size,
            unit: c.orderedItem.unit,
            qty: c.qty,
            unitPrice: c.orderedItem.unitPrice,
            remark: "",
        });
        track("invoiceItems", created.id);
    }
    console.log(`  ${invoice.invoiceId} — ${BASE}/invoices/${invoice.invoiceId}`);

    // --- C -----------------------------------------------------------------
    console.log("\nC — the production reads, in the page's own order");

    const items = await getItemsByInvoice(invoice.id);
    check("the invoice holds three item rows", items.length, 3);

    const reconciliation = await getInvoiceReconciliation(items, { linkedDeliveryRecordId: null });
    assert(
        "the reconciliation hands back the ordered quantities it read",
        reconciliation.orderedQtyByOrderedItem instanceof Map
    );
    check(
        "  one entry per ordered item this invoice charges",
        reconciliation.orderedQtyByOrderedItem.size,
        3
    );
    check(
        "  carrying the fixture order's two",
        [orderedItems[0].id, orderedItems[1].id]
            .map((id) => reconciliation.orderedQtyByOrderedItem.get(id))
            .join(","),
        "10,5"
    );

    const materialByOrderedItem = new Map(
        reconciliation.rows.map((r) => [r.invoiceItemId, r.materialRecordId])
    );
    const folded = foldInvoiceItems(
        items.map((it) => ({
            ...it,
            materialRecordId: materialByOrderedItem.get(it.invoiceItemId) ?? null,
        }))
    );
    check("the two charges on one material fold to one row", folded.length, 2);

    const breakdown = chargesByOrder({
        folded,
        items,
        orderedQtyByOrderedItem: reconciliation.orderedQtyByOrderedItem,
    });
    check("the folded items disagree about their orders, so the list is shown", breakdown.shown, true);

    const firstCharges = breakdown.byOrder.get(generated.poRecordId) ?? [];
    const secondCharges = breakdown.byOrder.get(secondGenerated.poRecordId) ?? [];
    check("the first order carries one line", firstCharges.length, 1);
    check("  its quantity is both charges added", firstCharges[0]?.qty, FIRST.chargedA + FIRST.chargedB);
    check("  and its whole is both ORDERED ITEMS added", firstCharges[0]?.orderedQty, FIRST.orderedA + FIRST.orderedB);
    check("the second order carries one line", secondCharges.length, 1);
    check("  charging part of what was ordered", secondCharges[0]?.qty, SECOND.charged);
    check("  against the whole that order asked for", secondCharges[0]?.orderedQty, SECOND.ordered);

    const firstLine = ORDER_BREAKDOWN_COPY.charged(firstCharges[0]).text;
    const secondLine = ORDER_BREAKDOWN_COPY.charged(secondCharges[0]).text;
    console.log(`  the two lines the page must carry:`);
    console.log(`    ${firstLine}`);
    console.log(`    ${secondLine}`);
    assert("the first order's line states 7 of 15", firstLine.includes("— 7 of 15 EA"), firstLine);
    assert("the second order's line states 8 of 20", secondLine.includes("— 8 of 20 EA"), secondLine);

    // --- D -----------------------------------------------------------------
    console.log("\nD — the rendered page");

    let cookie = "";
    try {
        cookie = await mintSession();
        assert("a session cookie was issued", cookie.length > 0);
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    if (cookie) {
        const url = `${BASE}/invoices/${invoice.invoiceId}`;
        const res = await fetch(url, { headers: { cookie } });
        assert("the invoice detail renders", res.ok, `HTTP ${res.status}`);
        const html = await res.text();

        // DECODED ONCE RATHER THAN GUESSED AT PER ENTITY. A category label carries
        // `&` and `>` and a fixture size carries `"`, all of which React escapes in a
        // text node — measured: this line reaches the wire as `2&quot; — 7 of 15 EA`,
        // with the em dash literal and the quote an entity. Matching the escaped form
        // instead would make the assertion a claim about which characters this
        // fixture happens to use.
        const decoded = html
            .replace(/&quot;/g, '"')
            .replace(/&#x27;|&apos;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&#x2014;/g, "—")
            .replace(/&amp;/g, "&");
        const carries = (line) => decoded.includes(line);
        assert("the page carries the first order's line", carries(firstLine), firstLine);
        assert("  and the second order's", carries(secondLine), secondLine);
        // WHAT THIS RULES OUT that the two assertions above do not: a page still
        // rendering the pre-#408 line somewhere as well, which would mean one screen
        // saying the same charge two ways.
        assert(
            "and no line states a bare quantity where a whole was resolved",
            !carries(firstLine.replace(" of 15", "")) && !carries(secondLine.replace(" of 20", ""))
        );

        const out = join(tmpdir(), "hye-408");
        mkdirSync(out, { recursive: true });
        const file = join(out, `${invoice.invoiceId}.html`);
        writeFileSync(file, html, "utf8");
        console.log(`  the rendered page is readable after teardown: ${file}`);
    }

    // The record is read once more so the run's own subject is not the only thing
    // proving the invoice existed at all.
    const reread = await getInvoiceById(invoice.invoiceId);
    assert("the invoice is on the base under its own ID", Boolean(reread?.id));
} catch (err) {
    pass = false;
    console.error(`\nFAILED — ${err.stack || err.message}`);
} finally {
    console.log("\nCleanup");
    const report = await fixtures.teardown({ complete: pass });
    console.log(`  ${fixtures.describe(report)}`);
    const leaked = report.leaked.length > 0;
    console.log(`\n${pass ? "OK" : "SOME CHECKS FAILED"}`);
    process.exit(!pass || leaked ? 1 : incomplete ? 2 : 0);
}

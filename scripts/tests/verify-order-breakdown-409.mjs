// The order breakdown appears when the charges are split differently — credentialed (#409).
//
// WHY THIS EXISTS, AND IT IS NOT THE ARITHMETIC. `offline/invoice-order-breakdown.mjs`
// pins `splitSignature` over hand-built folds, all three mutants included, and that
// tier is where the rule lives. What it cannot reach is whether the PAGE draws the
// list, and this issue is entirely about when it is drawn — a rule that widened
// correctly and a page that drew nothing would pass every assertion in that file.
//
// SO THIS RUNS THREE INVOICES, ONE PER VERDICT, AND THE TWO SILENT ONES ARE NOT
// MAKEWEIGHT. A judgment that only ever widens is indistinguishable from `shown =
// true` until something is seen NOT to be drawn, and each silent case here is one a
// plausible wrong rule turns on:
//
//   1  split differently   A:10 B:3  vs  A:2 B:11   LISTED — the widening
//   2  same proportions    A:2 B:1   vs  A:2 B:1    SILENT — raw quantities list it
//   3  one order           A:1       vs  A:1        SILENT — raw quantities list it
//
// Invoice 2 is the one that proves the reduction does work rather than being decorative:
// its absolute quantities differ on every order (10 and 5 against 20 and 10) and only
// the reduction makes them one answer. Invoice 3 is the case #409's own sentence names.
//
// AND THE BASE CANNOT SHOW ANY OF IT. Measured 2026-09-18 over 22 invoices and 24
// invoice items: one invoice charges more than one order and it is listed already
// because its order SETS differ, so #409 turns nothing new on; no invoice has two
// folded items on one order with different quantities either, so even the raw-versus-
// reduced distinction is unobservable. All three states are created here.
//
// THE FIXTURE IS TWO ORDERS CARRYING THE SAME TWO MATERIALS AT THE SAME PRICES, which
// is what lets one folded item span both orders — `lib/invoiceItemFold.js:foldKey` is
// `Material` plus unit price. Invoice 3 then charges only the first order, so the
// one-order case needs no third order.
//
// IT CREATES BOTH ORDERS RATHER THAN REUSING ONE, for `verify-order-breakdown-408.mjs`'s
// reason: an existing ordered item charged by a fixture invoice carries a moved
// `Invoiced Qty` for as long as the run lives. The only records REUSED are a Job, a
// Discipline, a Vendor and a requester, each of which gains a reverse-link and nothing
// else. The construction is that file's; the fixture is not, so this is its own script.
//
// NOTHING HERE WAITS FOR A PERSON. Created, read, rendered and deleted inside one run.
// The three pages it fetched are written to disk on the way past, which is what makes
// them readable after the records are gone.
//
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-order-breakdown-409.mjs
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed or a
// fixture leaked, 2 the dev server was unreachable so the render did not run.

import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TABLES } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { createInvoice, linkInvoiceToPO } from "../../lib/airtable/invoices.js";
import { createInvoiceItem, getItemsByInvoice } from "../../lib/airtable/invoiceItems.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllDisciplines } from "../../lib/airtable/disciplines.js";
import { getInvoiceReconciliation } from "../../lib/deliveryReconciliation.js";
import { foldInvoiceItems } from "../../lib/invoiceItemFold.js";
import {
    ORDER_BREAKDOWN_COPY,
    chargesByOrder,
    ordersNamedByFoldedItem,
    splitSignature,
} from "../../lib/invoiceOrderBreakdown.js";
import { resolveVerifyCategories } from "./_categories.mjs";
import { createFixtures } from "./_fixtures.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

// Both orders must share a vendor — an invoice charging two vendors is not a document
// this app has. The row gains a reverse-link and nothing else.
const VENDOR_RECORD_ID = "recJMkaWAGnohzn4z"; // Lone Star Pipe & Supply

// Ordered generously so every charge below fits inside what was ordered; the
// denominators are #408's and this issue reads them only as page text.
const ORDERED_QTY = 100;

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
    tag: "V409",
    buckets: [
        // No tagField: an invoice item's `Item Name` is a frozen copy of the ordered
        // item's, written from `Category Label` since #356, so no tag this run
        // controls reaches it. Tracked, so a tracked-id re-read is the residue check.
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable: an autoNumber primary and no text field at all.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // Found by tag, not tracked — PO generation writes these as a side effect
        // (#18). `Item Name` is a lookup since #356, so the tag rides on `Size`.
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
const [FIRST_CATEGORY, SECOND_CATEGORY] = await resolveVerifyCategories();

// TWO MATERIALS, EACH ON BOTH ORDERS AT ONE PRICE. The size carries the tag, which is
// what teardown finds them by, and the price is fixed per material because it is half
// of the fold key — two prices would make four folded items instead of two.
const MATERIALS = [
    { category: FIRST_CATEGORY, size: `${TAG} 2"`, unitPrice: 24 },
    { category: SECOND_CATEGORY, size: `${TAG} 4"`, unitPrice: 17 },
];

async function buildOrder(label, requester, discipline) {
    const pr = await createPR({
        requesterId: requester.id,
        disciplineId: discipline.id,
        vendorId: VENDOR_RECORD_ID,
        notes: `${TAG} ${label}`,
    });
    track("prs", pr.id);
    for (const m of MATERIALS) {
        await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: m.category.label,
            categoryRecordId: m.category.recordId,
            size: m.size,
            unit: "EA",
            qty: ORDERED_QTY,
            unitPrice: m.unitPrice,
            remark: "",
        });
    }
    await updatePR(pr.id, { status: "Approved" });
    const generated = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", generated.poRecordId);
    // Sorted on `PO Item ID`, which is `{PO ID}-001`, `-002` in snapshot order, so
    // index 0 is always the first material.
    const orderedItems = (await getItemsByPO(generated.poRecordId)).sort((a, b) =>
        (a.poItemId || "").localeCompare(b.poItemId || "")
    );
    return { poRecordId: generated.poRecordId, orderedItems };
}

/** One invoice and its charges: `[{ orderedItem, po, qty }]`. */
async function buildInvoice(label, amountDue, charges) {
    const invoice = await createInvoice({
        vendorId: VENDOR_RECORD_ID,
        vendorInvoiceCode: `${TAG}-${label}`,
        issueDate: "2026-09-18",
        dueDate: "2026-10-18",
        amountDue,
        shippingFee: 0,
    });
    track("invoices", invoice.id);
    for (const po of new Set(charges.map((c) => c.po))) await linkInvoiceToPO(invoice.id, po);
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
    return invoice;
}

/** The breakdown the page computes, from the production reads. */
async function readBreakdown(invoice) {
    const items = await getItemsByInvoice(invoice.id);
    const reconciliation = await getInvoiceReconciliation(items, { linkedDeliveryRecordId: null });
    const materialByOrderedItem = new Map(
        reconciliation.rows.map((r) => [r.invoiceItemId, r.materialRecordId])
    );
    const folded = foldInvoiceItems(
        items.map((it) => ({
            ...it,
            materialRecordId: materialByOrderedItem.get(it.invoiceItemId) ?? null,
        }))
    );
    const input = {
        folded,
        items,
        orderedQtyByOrderedItem: reconciliation.orderedQtyByOrderedItem,
    };
    return {
        folded,
        signatures: ordersNamedByFoldedItem(input).map((e) => splitSignature(e)),
        ...chargesByOrder(input),
    };
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

/**
 * The page's own text, entities decoded once. A category label carries `&` and `>`
 * and a fixture size carries `"`, all of which React escapes in a text node — matching
 * the escaped form instead would make an assertion a claim about which characters this
 * fixture happens to use.
 */
function decode(html) {
    return html
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#x2014;/g, "—")
        .replace(/&amp;/g, "&");
}

try {
    // --- A -----------------------------------------------------------------
    console.log(`\nA — two orders, each carrying both materials (run ${TAG})`);

    const [requester] = await getActiveUsers();
    const discipline = (await getAllDisciplines())[0];
    assert("a requester and a discipline resolve", Boolean(requester?.id && discipline?.id));

    const first = await buildOrder("first order", requester, discipline);
    const second = await buildOrder("second order", requester, discipline);
    check("the first order carries both materials", first.orderedItems.length, 2);
    check("the second order carries both materials", second.orderedItems.length, 2);
    assert(
        "the same material is on both orders, which is what lets one item span them",
        first.orderedItems[0].material?.[0] === second.orderedItems[0].material?.[0] &&
            first.orderedItems[1].material?.[0] === second.orderedItems[1].material?.[0]
    );
    assert(
        "  at one price per material, which is the other half of the fold key",
        first.orderedItems[0].unitPrice === second.orderedItems[0].unitPrice &&
            first.orderedItems[1].unitPrice === second.orderedItems[1].unitPrice
    );

    // --- B -----------------------------------------------------------------
    console.log("\nB — three invoices, one per verdict");

    // 1 — the widening. M1 goes 10:3 across the two orders, M2 goes 2:11.
    const splitDifferently = await buildInvoice("DIFF", 533, [
        { orderedItem: first.orderedItems[0], po: first.poRecordId, qty: 10 },
        { orderedItem: second.orderedItems[0], po: second.poRecordId, qty: 3 },
        { orderedItem: first.orderedItems[1], po: first.poRecordId, qty: 2 },
        { orderedItem: second.orderedItems[1], po: second.poRecordId, qty: 11 },
    ]);
    // 2 — same proportions at different scales. M1 goes 10:5, M2 goes 20:10.
    const sameProportions = await buildInvoice("PROP", 870, [
        { orderedItem: first.orderedItems[0], po: first.poRecordId, qty: 10 },
        { orderedItem: second.orderedItems[0], po: second.poRecordId, qty: 5 },
        { orderedItem: first.orderedItems[1], po: first.poRecordId, qty: 20 },
        { orderedItem: second.orderedItems[1], po: second.poRecordId, qty: 10 },
    ]);
    // 3 — one order, two items, different quantities.
    const oneOrder = await buildInvoice("ONE", 389, [
        { orderedItem: first.orderedItems[0], po: first.poRecordId, qty: 7 },
        { orderedItem: first.orderedItems[1], po: first.poRecordId, qty: 13 },
    ]);
    for (const inv of [splitDifferently, sameProportions, oneOrder]) {
        console.log(`  ${inv.invoiceId} — ${BASE}/invoices/${inv.invoiceId}`);
    }

    // --- C -----------------------------------------------------------------
    console.log("\nC — the judgment, from the production reads");

    const diff = await readBreakdown(splitDifferently);
    check("1 — both materials fold to one item each", diff.folded.length, 2);
    check("  each spanning both orders", diff.signatures.every((s) => s.split(" ").length === 2), true);
    check("  and the two divide themselves differently", new Set(diff.signatures).size, 2);
    check("  so the list is SHOWN", diff.shown, true);

    const prop = await readBreakdown(sameProportions);
    check("2 — both materials fold to one item each", prop.folded.length, 2);
    check("  each spanning both orders", prop.signatures.every((s) => s.split(" ").length === 2), true);
    check("  and the two divide themselves alike", new Set(prop.signatures).size, 1);
    assert(
        "  although their quantities differ on every order — 10 and 5 against 20 and 10",
        new Set(
            ordersNamedByFoldedItem({
                folded: prop.folded,
                items: await getItemsByInvoice(sameProportions.id),
            }).map((e) => [...e.orderRecordIds].sort().map((id) => e.qtyByOrder.get(id)).join(":"))
        ).size === 2
    );
    check("  so the list is SILENT", prop.shown, false);

    const one = await readBreakdown(oneOrder);
    check("3 — two folded items on one order", one.folded.length, 2);
    check("  each reducing to 1", new Set(one.signatures).size, 1);
    check("  although they charge 7 and 13", one.folded.map((f) => f.qty).sort((a, b) => a - b).join(","), "7,13");
    check("  so the list is SILENT", one.shown, false);

    // --- D -----------------------------------------------------------------
    console.log("\nD — the rendered pages");

    let cookie = "";
    try {
        cookie = await mintSession();
        assert("a session cookie was issued", cookie.length > 0);
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    if (cookie) {
        const out = join(tmpdir(), "hye-409");
        mkdirSync(out, { recursive: true });

        // The line each case's FIRST order would carry if the list were drawn. For the
        // two silent ones this is what must be absent — computed from the real
        // breakdown so the absence is asserted against the exact string the page would
        // have printed, never against a guess.
        const cases = [
            { invoice: splitDifferently, breakdown: diff, order: first.poRecordId, listed: true },
            { invoice: sameProportions, breakdown: prop, order: first.poRecordId, listed: false },
            { invoice: oneOrder, breakdown: one, order: first.poRecordId, listed: false },
        ];

        for (const c of cases) {
            const res = await fetch(`${BASE}/invoices/${c.invoice.invoiceId}`, { headers: { cookie } });
            assert(`${c.invoice.invoiceId} renders`, res.ok, `HTTP ${res.status}`);
            // THE RAW PAGE IS WHAT GOES TO DISK and the decoded copy is what is read.
            // Decoding `&lt;` in a whole document turns escaped text back into tags,
            // so a saved decoded page is no longer the page that was served.
            const html = await res.text();
            writeFileSync(join(out, `${c.invoice.invoiceId}.html`), html, "utf8");
            const text = decode(html);

            const lines = (c.breakdown.byOrder.get(c.order) ?? []).map(
                (b) => ORDER_BREAKDOWN_COPY.charged(b).text
            );
            assert(`  it has two lines to draw or withhold`, lines.length === 2);
            for (const line of lines) {
                const present = text.includes(line);
                assert(
                    `  ${c.listed ? "carries" : "withholds"} ${line.slice(line.indexOf("—"))}`,
                    present === c.listed
                );
            }
        }

        // THE TWO SILENT PAGES STILL NAME THEIR ORDERS, which is what makes the absence
        // above an absent LIST rather than an absent section — a page that failed to
        // render would satisfy every `withholds` assertion on its own.
        for (const c of cases.filter((x) => !x.listed)) {
            const text = decode(
                await (await fetch(`${BASE}/invoices/${c.invoice.invoiceId}`, { headers: { cookie } })).text()
            );
            assert(
                `  ${c.invoice.invoiceId} still names its orders under the heading`,
                text.includes("Purchase Order") && text.includes(c.invoice.invoiceId)
            );
        }
        console.log(`  the rendered pages are readable after teardown: ${out}`);
    }
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

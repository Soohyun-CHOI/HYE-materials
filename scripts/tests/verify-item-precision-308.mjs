// A request figure the order cannot carry — credentialed (#308).
//
// WHY THIS EXISTS. The whole of this issue is a set of REFUSALS on write paths, and
// the offline tier cannot execute one: it reads source and judges pure functions, so
// it can say that `createPRAction` names `isWholeQty` and never that a submission
// carrying `2.5` is turned away with nothing written. #382 and #330 built the
// machinery for exactly this — a session minted with `createAuthToken`, and React's
// four `$ACTION_*` fields read off the rendered form so a plain POST reaches a Server
// Action — and this runs on top of it.
//
//   A — a session, and the ids a real submission needs.
//   B — `saveDraftAction`, both values, end to end. The blocked one must create
//       nothing; the passing one must reach `createItem` and store what it was given,
//       including `8.11`, which is not exactly representable in binary and is the
//       reason the price predicate carries slack instead of comparing exactly.
//   C — `createPRAction`'s refusal, on a submission that is valid in every other way,
//       so the thing being measured is the figure rather than a missing field.
//   D — a request whose turn this account owns, built for the browser pass. The edit
//       turn's refusal is not posted from here and section D says why.
//   E — THE FREEZE. A `PR Items` row is broken the only way the app cannot break one —
//       a direct write past the service guard, which is what a hand edit in the
//       Airtable UI does — and then the approval's own generation is run against it.
//       It must throw, leave no `Purchase Orders` row behind, and be selected by
//       #176's strip rule; and the Admin retry must answer with the sentence rather
//       than `Please try again.`
//   F — the service writers, both values each, since B and C reach only two of them.
//
// WHAT IT DOES NOT DO. It posts nothing to `editAndContinueAction` — section D has
// the measurement that rules it out — so that action's refusal and the passing path
// through `updateItem` are covered in a browser and in F respectively. And it renders
// nothing: that a refused form keeps the typed figure in the box is a browser fact,
// recorded in the pull request.
//
// `HOLD_FIXTURE=1` keeps section D's request standing for five minutes, which is what
// the browser pass needs to type into it.
//
// EVERY RECORD IT CREATES CARRIES THE RUN TAG AND IS DELETED IN `finally`.
//
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-item-precision-308.mjs
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed,
// 2 the dev server was unreachable so part of it did not run.

import { TABLES, base } from "../../lib/airtable/client.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { createItem, updateItem } from "../../lib/airtable/prItems.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { createPOItem } from "../../lib/airtable/poItems.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createPO } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { selectPRsAwaitingPO } from "../../lib/poListView.js";
import { createFixtures } from "./_fixtures.mjs";
import {
    ITEM_PRECISION_COPY,
    PRECISION_BLOCKED,
    PRECISION_BLOCKED_COPY,
    SHIPPING_FEE_PRECISION_COPY,
} from "../../lib/variance.js";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-item-precision-308 — a request figure the order cannot carry" });

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "soo@hanyangengusa.com";

/**
 * The run's records, in deletion order.
 *
 * ORDERS BEFORE REQUESTS, because a `Purchase Orders` row links to the request it was
 * generated from. Children are discovered through the parent's own link field, so
 * items and signers need no tracking of their own.
 *
 * THE ORDER BUCKET HAS NO `tagField` AND THAT IS A FACT ABOUT THE TABLE. `createPO`
 * takes no free-text field this run could stamp — every string on a `Purchase Orders`
 * row is minted or frozen — so the census cannot search for a stray one. What the
 * helper still guarantees for it is that every id this run tracked is deleted and
 * reported per record.
 */
const fixtures = createFixtures({
    tag: "V308",
    buckets: [
        {
            name: "orders",
            table: TABLES.PURCHASE_ORDERS,
            label: "Purchase Order",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        {
            name: "requests",
            table: TABLES.PURCHASE_REQUESTS,
            label: "Purchase Request",
            tagField: "Notes",
            children: [
                { link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" },
                { link: "PR Signers", table: TABLES.PR_SIGNERS, label: "PR Signer" },
            ],
        },
    ],
});
const TAG = fixtures.TAG;

let pass = true;
let incomplete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};

/**
 * React's four no-JavaScript fields for ONE action, picked by the action's own id.
 *
 * `/prs/new` RENDERS THREE OF THESE AND THAT IS WHY THE ID IS THE KEY. #330's copy of
 * this helper took the first `$ACTION_REF_n` on the page, which is exact on a screen
 * with one form and picks a coin toss on a screen with three — this form has a save,
 * a submit and a draft delete. The `:0` field carries the action's spec, which
 * contains its id, so the pairing is exact rather than positional.
 */
function actionFieldsFor(html, actionId) {
    const key = html.match(/name="\$ACTION_KEY"\s+value="([^"]+)"/);
    if (!key) return null;
    const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    for (const m of html.matchAll(/name="\$ACTION_REF_(\d+)"/g)) {
        const n = m[1];
        // DOUBLED BACKSLASHES BECAUSE THIS IS A TEMPLATE LITERAL, and the first
        // version was not: `\$` inside one is just `$`, which in a regex is
        // end-of-input, so the pattern matched nothing and every lookup came back
        // null. The run reported it as "the page carries no fields for this action".
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
 *
 * THE `$ACTION_*` FORM POST RATHER THAN THE `Next-Action` RPC, and the difference is
 * what the action's parameters are. These three take `(prevState, formData)` from
 * `useActionState`, so Next has to decode a FORM SUBMISSION; the RPC shape
 * `verify-invoice-recorder-382.mjs` uses encodes an argument array instead, and
 * handing it plain fields answers `Connection closed` with nothing run. Measured
 * here before it was fixed.
 */
async function postAction(cookie, pageUrl, fields, formData) {
    for (const [name, value] of Object.entries(fields)) formData.set(name, value);
    const res = await fetch(pageUrl, {
        method: "POST",
        headers: { cookie },
        body: formData,
        redirect: "manual",
    });
    return res.text();
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

try {
    // --- A -----------------------------------------------------------------
    console.log(`\nA — a session and the ids a real submission needs (run ${TAG})`);
    let cookie = "";
    try {
        cookie = await mintSession();
        ok("a session cookie was issued", cookie.length > 0);
    } catch (err) {
        console.log(`  SKIP  the dev server at ${BASE} is not reachable — ${err.message}`);
        incomplete = true;
    }

    const [disciplines, vendors, addresses, categories] = await Promise.all([
        base(TABLES.DISCIPLINES).select({ maxRecords: 1 }).all(),
        base(TABLES.VENDORS).select({ maxRecords: 1 }).all(),
        base(TABLES.ADDRESSES).select({ maxRecords: 1 }).all(),
        base(TABLES.MATERIAL_CATEGORIES).select({ maxRecords: 1 }).all(),
    ]);
    const disciplineId = disciplines[0]?.id;
    const vendorId = vendors[0]?.id;
    const addressId = addresses[0]?.id;
    const leafCode = categories[0]?.get("Level 4 Code");
    const codes = [1, 2, 3, 4].map((n) => categories[0]?.get(`Level ${n} Code`));
    ok("the base has a discipline, a vendor, an address and a category", Boolean(disciplineId && vendorId && addressId && leafCode));

    const itemRow = (qty, unitPrice) =>
        JSON.stringify([
            { categoryCodes: codes, size: "2\"", unit: "EA", qty: String(qty), unitPrice: String(unitPrice), remark: TAG },
        ]);

    // --- B -----------------------------------------------------------------
    console.log("\nB — saveDraftAction, both values, end to end");
    let draftActionId = null;
    let draftFields = null;
    let newHtml = "";
    if (cookie) {
        draftActionId = await serverActionId(cookie, `${BASE}/prs/new`, "saveDraftAction");
        ok("saveDraftAction resolves to an action id", Boolean(draftActionId));
        newHtml = await (await fetch(`${BASE}/prs/new`, { headers: { cookie } })).text();
        draftFields = draftActionId ? actionFieldsFor(newHtml, draftActionId) : null;
        ok("  and to its own form fields among the three on this page", Boolean(draftFields));
    }
    const draftBody = (itemsJson, shippingFee = "0") => {
        const body = new FormData();
        body.set("disciplineId", disciplineId);
        body.set("vendorId", vendorId);
        body.set("deliveryAddressId", addressId);
        body.set("notes", TAG);
        body.set("shippingFee", shippingFee);
        body.set("itemsJson", itemsJson);
        body.set("signersJson", "[]");
        body.set("quotationsJson", "[]");
        return body;
    };
    const prCountBefore = (await base(TABLES.PURCHASE_REQUESTS).select({ fields: ["PR ID"] }).all()).length;

    if (draftFields) {
        for (const [label, itemsJson, fee, wanted] of [
            ["a fractional quantity", itemRow(2.5, 10), "0", ITEM_PRECISION_COPY.qty],
            ["a sub-cent price", itemRow(3, 1.005), "0", ITEM_PRECISION_COPY.unitPrice],
            ["a sub-cent shipping fee", itemRow(3, 10), "1.005", SHIPPING_FEE_PRECISION_COPY],
        ]) {
            const text = await postAction(cookie, `${BASE}/prs/new`, draftFields, draftBody(itemsJson, fee));
            ok(`${label} is refused`, text.includes(wanted), wanted);
            ok("  and in its own words, not a generic failure", !text.includes("Couldn't save the draft"));
        }
        const after = (await base(TABLES.PURCHASE_REQUESTS).select({ fields: ["PR ID"] }).all()).length;
        ok("the three refusals created no request", after === prCountBefore, `${prCountBefore} -> ${after}`);

        // The passing value, through the real writer. `8.11` is the case the price
        // predicate's 1e-9 slack exists for: `8.11 * 100` is 810.9999999999999.
        const text = await postAction(cookie, `${BASE}/prs/new`, draftFields, draftBody(itemRow(3, 8.11), "12.34"));
        ok("a whole quantity at a whole-cent price saves", text.includes("savedDraft"), text.slice(0, 120));
        const saved = await base(TABLES.PURCHASE_REQUESTS)
            .select({ filterByFormula: `{Notes} = "${TAG}"` })
            .all();
        if (saved.length) {
            fixtures.track("requests", saved[0].id);
            const items = await base(TABLES.PR_ITEMS)
                .select({ filterByFormula: `{Remark} = "${TAG}"` })
                .all();
            ok("  and the row holds exactly what was typed", items[0]?.get("Unit Price") === 8.11 && items[0]?.get("Qty") === 3,
                `qty ${items[0]?.get("Qty")}, price ${items[0]?.get("Unit Price")}`);
            ok("  with the shipping fee stored too", saved[0].get("Shipping Fee") === 12.34);
        } else {
            ok("  the saved draft was found", false);
        }
    } else {
        incomplete = true;
    }

    // --- C -----------------------------------------------------------------
    console.log("\nC — createPRAction's refusal, on an otherwise valid submission");
    if (cookie) {
        const submitActionId = await serverActionId(cookie, `${BASE}/prs/new`, "createPRAction");
        const submitFields = submitActionId ? actionFieldsFor(newHtml, submitActionId) : null;
        ok("createPRAction resolves to its own form fields", Boolean(submitFields));
        if (submitFields) {
            const body = draftBody(itemRow(2.5, 10));
            body.set("signersJson", JSON.stringify([{ userId: "recNOBODY", confirmationType: "Approval" }]));
            body.set("quotationsJson", JSON.stringify([{ url: "https://example.invalid/q.pdf", filename: "q.pdf" }]));
            const text = await postAction(cookie, `${BASE}/prs/new`, submitFields, body);
            ok("a fractional quantity is refused", text.includes(ITEM_PRECISION_COPY.qty));
            // The presence check answers first for a blank, which is what keeps the
            // two sentences apart.
            const blank = draftBody(itemRow("", 10));
            blank.set("signersJson", JSON.stringify([{ userId: "recNOBODY", confirmationType: "Approval" }]));
            blank.set("quotationsJson", JSON.stringify([{ url: "https://example.invalid/q.pdf", filename: "q.pdf" }]));
            const blankText = await postAction(cookie, `${BASE}/prs/new`, submitFields, blank);
            ok("  and a blank one gets the sentence about blankness", blankText.includes("Every item needs a quantity and a unit price."));
        }
    }

    // --- D -----------------------------------------------------------------
    //
    // WHAT THIS SECTION BUILDS AND WHAT IT DELIBERATELY DOES NOT POST. The edit turn's
    // refusal cannot be reached from here, and the reason is a property of that form
    // rather than of this run: `/prs/[prId]` renders NO `$ACTION_*` fields at all —
    // measured, 0 of them on a page that does render `Edit and continue` — because
    // `EditAndContinueForm` submits through JavaScript rather than as a
    // progressively-enhanced `<form action>`. The `Next-Action` RPC is the other door
    // and it is shut too: this action takes `(prevState, formData)` from
    // `useActionState`, so the RPC body has to encode an ARGUMENT ARRAY rather than
    // plain fields, and handing it fields answers `Connection closed` with nothing
    // run. So the refusal is a BROWSER fact for this one action, and the pull request
    // carries it.
    //
    // THE FIXTURE IS STILL BUILT HERE, because the browser pass needs a request whose
    // turn this account owns — the base's two in-review requests belong to somebody
    // else's turn, so their page carries no form to type into. It is created, its id
    // is printed for the browser pass, and it is deleted with everything else.
    console.log("\nD — a request whose turn this account owns, for the browser pass");
    if (cookie) {
        const turnPR = await createPR({
            requesterId: null,
            disciplineId,
            vendorId,
            deliveryAddressId: addressId,
            notes: `${TAG}-TURN`,
        });
        fixtures.track("requests", turnPR.id);
        await createItem({
            prRecordId: turnPR.id,
            prId: turnPR.prId,
            itemName: `${TAG} turn`,
            qty: 3,
            unitPrice: 10,
            remark: TAG,
        });
        const signerUser = (
            await base(TABLES.USERS)
                .select({ filterByFormula: `{Email} = "${ADMIN_EMAIL}"`, maxRecords: 1 })
                .all()
        )[0];
        await createSigner({
            prRecordId: turnPR.id,
            prId: turnPR.prId,
            signerUserId: signerUser?.id,
            sequenceOrder: 1,
            confirmationType: "Approval",
        });
        await updatePR(turnPR.id, { status: "In Review", currentSignerStep: 1 });

        const hostUrl = `${BASE}/prs/${turnPR.prId}`;
        const editHtml = await (await fetch(hostUrl, { headers: { cookie } })).text();
        // The turn really is this account's, which is what the browser pass needs and
        // what a borrowed request could not give it.
        ok("the fixture request offers this account the edit turn", editHtml.includes("Edit and continue"));
        // AND THE MEASUREMENT THAT SENDS THE REFUSAL TO THE BROWSER, kept as an
        // assertion rather than as a sentence in the header: a page rendering that
        // control and no action fields is the whole reason this tier stops here.
        ok(
            "  and carries no no-JavaScript action fields, so this tier cannot post to it",
            [...editHtml.matchAll(/\$ACTION_REF_(\d+)/g)].length === 0
        );
        console.log(`  NOTE  drive ${hostUrl} in a browser while this run is paused to see the refusal`);
        if (process.env.HOLD_FIXTURE === "1") {
            console.log("  HOLD  fixture kept for 300s — HOLD_FIXTURE=1");
            await new Promise((r) => setTimeout(r, 300000));
        }
    }

    // --- E -----------------------------------------------------------------
    console.log("\nE — the freeze, against a row the app could not have written");
    const brokenPR = await createPR({
        requesterId: null,
        disciplineId,
        vendorId,
        deliveryAddressId: addressId,
        notes: `${TAG}-FREEZE`,
    });
    fixtures.track("requests", brokenPR.id);
    // PAST THE SERVICE GUARD ON PURPOSE. This is the one state the app cannot produce
    // and the Airtable UI can, which is why the freeze guards at all.
    await base(TABLES.PR_ITEMS).create({
        "PR Item ID": `${brokenPR.prId}-001`,
        PR: [brokenPR.id],
        "Item Name": `${TAG} broken`,
        Qty: 2.5,
        "Unit Price": 10,
        Remark: TAG,
    });
    await updatePR(brokenPR.id, { status: "Approved" });

    const approved = await getPRByRecordId(brokenPR.id);
    const genErr = await threw(() => generatePOForApprovedPR(approved));
    ok("generation throws rather than freezing the figure", genErr !== null);
    ok("  under the code the retry matches on", genErr?.code === PRECISION_BLOCKED, String(genErr?.code));
    const reread = await getPRByRecordId(brokenPR.id);
    ok("  and no purchase order is left behind", (reread.purchaseOrders?.length ?? 0) === 0);
    ok(
        "#176's strip rule selects the request it left",
        selectPRsAwaitingPO([reread]).length === 1
    );
    if (cookie) {
        const retryId = await serverActionId(cookie, `${BASE}/pos`, "generatePOAction");
        if (!retryId) {
            console.log("  SKIP  generatePOAction is not reachable from /pos");
            incomplete = true;
        } else {
            const body = new FormData();
            body.set("prId", reread.prId);
            const posHtml = await (await fetch(`${BASE}/pos`, { headers: { cookie } })).text();
            const retryFields = actionFieldsFor(posHtml, retryId);
            const text = retryFields ? await postAction(cookie, `${BASE}/pos`, retryFields, body) : "";
            ok("the retry control carries its own action fields", Boolean(retryFields));
            ok("the Admin retry says why rather than `try again`", text.includes(PRECISION_BLOCKED_COPY));
            ok("  and does not offer the generic sentence", !text.includes("Please try again."));
        }
    }

    // --- F -----------------------------------------------------------------
    console.log("\nF — every service writer, both values");
    const feePR = await createPR({
        requesterId: null,
        disciplineId,
        vendorId,
        deliveryAddressId: addressId,
        notes: `${TAG}-FEE`,
        shippingFee: 12.34,
    });
    fixtures.track("requests", feePR.id);
    ok("createPR accepts a whole-cent shipping fee", true);
    ok(
        "  and refuses a sub-cent one",
        (await threw(() => createPR({ disciplineId, vendorId, notes: `${TAG}-BAD`, shippingFee: 1.005 })))?.code ===
            PRECISION_BLOCKED
    );
    ok(
        "updatePR refuses a sub-cent shipping fee",
        (await threw(() => updatePR(feePR.id, { shippingFee: 1.005 })))?.code === PRECISION_BLOCKED
    );
    const goodItem = await createItem({
        prRecordId: feePR.id,
        prId: feePR.prId,
        itemName: `${TAG} good`,
        qty: 3,
        unitPrice: 8.11,
        remark: TAG,
    });
    ok("createItem accepts a whole quantity at a whole-cent price", goodItem.qty === 3);
    ok(
        "  and refuses a fractional quantity",
        (await threw(() =>
            createItem({ prRecordId: feePR.id, prId: feePR.prId, itemName: `${TAG} bad`, qty: 2.5, unitPrice: 10 })
        ))?.code === PRECISION_BLOCKED
    );
    ok(
        "updateItem refuses a sub-cent price",
        (await threw(() => updateItem(goodItem.id, { unitPrice: 1.005 })))?.code === PRECISION_BLOCKED
    );
    ok(
        "  and still takes a partial update that names neither figure",
        (await updateItem(goodItem.id, { remark: `${TAG} touched` })).remark === `${TAG} touched`
    );
    const po = await createPO({ prRecordId: feePR.id, shippingFee: 12.34 });
    fixtures.track("orders", po.id);
    ok("createPO accepts a whole-cent shipping fee", true);
    ok(
        "  and refuses a sub-cent one",
        (await threw(() => createPO({ prRecordId: feePR.id, shippingFee: 1.005 })))?.code === PRECISION_BLOCKED
    );
    ok(
        "createPOItem refuses a fractional quantity",
        (await threw(() =>
            createPOItem({ poRecordId: po.id, poId: po.poId, itemName: `${TAG}`, qty: 2.5, unitPrice: 10 })
        ))?.code === PRECISION_BLOCKED
    );
    const goodPOItem = await createPOItem({
        poRecordId: po.id,
        poId: po.poId,
        itemName: `${TAG} good`,
        qty: 3,
        unitPrice: 8.11,
    });
    ok("  and accepts the pair the request stored", goodPOItem.amount === 3 * 8.11);
} finally {
    // THE SHARED CONTRACT RATHER THAN A HAND-WRITTEN SWEEP. The first draft of this
    // block destroyed four levels itself and swallowed every result with
    // `.catch(() => {})`, which is exactly the shape `offline/fixture-cleanup.mjs`
    // exists to refuse: a delete that fails is invisible and the run still says it
    // cleaned up. The helper deletes children through the parent's own link field,
    // reports per record, and censuses the base for anything this run's tag left
    // behind.
    console.log("\nCleanup");
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

// A save, a submit and a delete that name a request ask whose it is first, and an
// edit turn links only the request's own quotations — credentialed (#440).
//
// WHY THIS EXISTS. `offline/owner-before-write.mjs` and `offline/pr-requester.mjs` hold
// the rule by shape and by value: each judgment is asked about the record it read,
// outside every try, before anything is written, and the judgment answers `gone` for
// someone else's request and `submitted` only for the requester's own. Shape is not
// execution (`offline/_ast.mjs`), and what #440 claims is about execution — that a
// refused call writes NOTHING, and that one record answers two callers differently.
//
//   A — the two accounts, the targets, and a probe that the server is running THIS
//       tree: an id that resolves to nothing comes back in #440's words, where the
//       tree before it answered `Couldn't save the draft. Please try again.` Nothing is
//       created until it passes.
//   B — F1, the owner's draft, saved through the app's own path.
//   C — F2, the owner's request in review, planted through the service layer — the
//       fixture is INPUT here, as it was for #250, and the app's path to In Review
//       would mail its first signer.
//   D — F1 against a stranger: save, submit and delete refused as `gone`, F1 read back
//       unchanged each time, and a submit carrying items F2 duplicates answered by the
//       refusal rather than by the duplicate warning — the order #440 put first.
//       Then an id that resolves to nothing and an id of another table, in the same
//       words. Then the owner's identical save, accepted: one record, two callers,
//       opposite answers.
//   E — F2 against its owner (`submitted`) and against the stranger (`gone`, since
//       identity is asked before status), save, submit and delete, F2 unchanged.
//   F — Edit and continue on F2 by its signer, linking another request's quotation and
//       an id that resolves to nothing: refused, and F2's item, history, signer and
//       step read back unchanged, the other quotation untouched.
//   G — the owner deletes F1 through the app, the opposite answer to the stranger's
//       delete in D, and the operations each call cost, read off the dev server's
//       own ledger.
//
// FIXTURES, ALL DELETED IN THIS RUN BY scripts/tests/_fixtures.mjs: F1 (one request,
// one PR Item, one PR Signer — deleted by the app in G) and F2 (the same three rows,
// deleted by the helper); one Vercel Blob object, the submit cases' quotation file,
// which no refused call lets Airtable take. TWO Auth Tokens rows are spent and left, one
// per session, as every script in this tier leaves them. Reads without writing: one
// other request's quotation, `HYE-PR-260915-01`'s, whose file id is compared before and
// after.
//
// NO MAIL IS SENT, AND TWO NETS HOLD THAT IF A REFUSAL DOES NOT. No accepted submit
// and no accepted edit turn is run: the first mails the request's first signer and the
// second mails the next signer or, at the end of a chain, the President. Every submit
// here names a signer id that resolves to nothing, so a refusal that failed to hold
// dies at `createSigner` before the In Review flip and before any notification. The
// edit turn carries a Unit Airtable refuses on the same item, so a refusal that failed
// to hold dies at the item write, before the turn advances or an order is generated.
//
// NEEDS A DEV SERVER on http://localhost:3000 serving this tree (override with
// BASE_URL), started with AIRTABLE_OPS_FILE set so part G can read the ledger. Run
// from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-draft-owner-440.mjs
//
// Exit codes: 0 all clear, 1 something failed or leaked, 2 clean but incomplete.

import { existsSync, readFileSync, statSync } from "node:fs";
import { put } from "@vercel/blob";
import { TABLES, base } from "../../lib/airtable/client.js";
import { createPR, updatePR } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { getAllDisciplines } from "../../lib/airtable/disciplines.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllAddresses } from "../../lib/airtable/addresses.js";
import { categoryItemFields } from "../../lib/materialCategory.js";
import { resolveOpsFile } from "../../lib/airtableOps.js";
import { formulaString, prefixMatch } from "../../lib/airtableFormula.js";
import { needsName } from "../../lib/userName.js";
import { OWN_DRAFT_COPY } from "../../lib/prRequester.js";
import { resolveVerifyCategories } from "./_categories.mjs";
import { createFixtures } from "./_fixtures.mjs";
import { DEFAULT_BASE_URL, callServerAction, serverActionId, sessionCookieFor } from "./_liveApp.mjs";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-draft-owner-440 — a request a caller names is asked whose it is first" });

const BASE = DEFAULT_BASE_URL;
/** The requester of both fixtures. */
const OWNER_EMAIL = "scoped-fixture@hanyangengusa.com";
/** Someone else, and F2's first signer — an Admin, so the office is shown to have no way onto a draft either. */
const STRANGER_EMAIL = "soo@hanyangengusa.com";
/** Another request's quotation, read and compared, never written. */
const OTHER_REQUEST_ID = "HYE-PR-260915-01";
/** Well-formed, and resolves to nothing. */
const NO_RECORD = "recAAAAAAAAAAAAAA";

const REFUSED = {
    gone: OWN_DRAFT_COPY.gone,
    submitted: OWN_DRAFT_COPY.submitted,
    quotation: "One of the quotations picked for an item is not on this PR. Reload the page and try again.",
    oldTree: "Couldn't save the draft. Please try again.",
};

let pass = true;
let incomplete = false;
let complete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};
const show = (label, value) => console.log(`        ${label}: ${JSON.stringify(value)}`);

const REQUEST_CHILDREN = [
    { link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" },
    { link: "PR Signers", table: TABLES.PR_SIGNERS, label: "PR Signer" },
    { link: "Quotations", table: TABLES.QUOTATIONS, label: "Quotation" },
    { link: "PR Edit Log", table: TABLES.PR_EDIT_LOG, label: "PR Edit Log row" },
];
const fixtures = createFixtures({
    tag: "V440",
    buckets: [{ name: "requests", table: TABLES.PURCHASE_REQUESTS, label: "Purchase Request", tagField: "Notes", children: REQUEST_CHILDREN }],
});
const TAG = fixtures.TAG;

/** The smallest thing Airtable accepts as a PDF attachment (#382's). */
const MINIMAL_PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
        "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8"
);

/** Everything a refused write could have moved on a request, as one comparable string. */
async function requestState(recordId) {
    const record = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    const signers = [];
    for (const id of record.get("PR Signers") || []) {
        const signer = await base(TABLES.PR_SIGNERS).find(id);
        signers.push(`${id}:${signer.get("Status") ?? ""}:${(signer.get("Signer") || []).join("")}`);
    }
    const items = [];
    for (const id of record.get("PR Items") || []) {
        const item = await base(TABLES.PR_ITEMS).find(id);
        items.push(`${id}:${item.get("Unit") ?? ""}:${(item.get("Quotation") || []).join("")}:${item.get("Size") ?? ""}`);
    }
    return JSON.stringify({
        status: record.get("Status") ?? null,
        step: record.get("Current Signer Step") ?? null,
        notes: record.get("Notes") ?? "",
        vendor: record.get("Vendor") || [],
        discipline: record.get("Discipline") || [],
        address: record.get("Delivery Address") || [],
        quotations: record.get("Quotations") || [],
        editLog: record.get("PR Edit Log") || [],
        items,
        signers,
    });
}

/**
 * The dev server's ledger lines appended since `mark`, as parsed scope records. The
 * server and this script resolve the file from the same `.env.local`, and only the
 * server's scope lines (`proc: "next"`) are the calls' cost.
 */
function scopesSince(mark) {
    const path = resolveOpsFile();
    if (!path || !existsSync(path)) return null;
    const text = readFileSync(path, "utf8").slice(mark);
    return text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        })
        .filter((r) => r?.kind === "scope" && r.proc === "next");
}
function ledgerMark() {
    const path = resolveOpsFile();
    return path && existsSync(path) ? statSync(path).size : 0;
}
const costs = [];

function formOf(fields) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return body;
}

try {
    // --- A -----------------------------------------------------------------
    console.log("\nA — the two accounts, the targets, and the server");
    const [owner, stranger] = await Promise.all([getUserByEmail(OWNER_EMAIL), getUserByEmail(STRANGER_EMAIL)]);
    ok("both accounts exist", Boolean(owner?.id && stranger?.id));
    ok("  both are named, so requireUser does not divert either (#381)", Boolean(owner && stranger && !needsName(owner) && !needsName(stranger)));
    ok("  and they are two people", owner?.id !== stranger?.id);
    const jobId = owner?.assignedJobs?.[0] ?? null;
    const discipline = (await getAllDisciplines()).find((d) => d.jobId === jobId) ?? null;
    const vendor = (await getAllVendors())[0] ?? null;
    const address = (await getAllAddresses())[0] ?? null;
    const [category] = await resolveVerifyCategories();
    const other = (
        await base(TABLES.PURCHASE_REQUESTS)
            .select({ filterByFormula: `{PR ID} = "${formulaString(OTHER_REQUEST_ID)}"`, fields: ["PR ID", "Quotations"], maxRecords: 1 })
            .firstPage()
    )[0];
    const otherQuotationId = other?.get("Quotations")?.[0] ?? null;
    const otherQuotationFiles = async () =>
        JSON.stringify(((await base(TABLES.QUOTATIONS).find(otherQuotationId)).get("File") || []).map((f) => f.id));
    ok("the owner's job has a discipline", Boolean(discipline));
    ok("  and there is a vendor, an address and a category to fill a request with", Boolean(vendor && address && category));
    ok(`  and ${OTHER_REQUEST_ID} carries a quotation to link across requests`, Boolean(otherQuotationId));
    const targetsHold = pass;

    const [ownerCookie, strangerCookie] = await Promise.all([sessionCookieFor(OWNER_EMAIL), sessionCookieFor(STRANGER_EMAIL)]);
    ok("a session for each", Boolean(ownerCookie && strangerCookie));
    const requestPage = `${BASE}/prs/new`;
    const ids = {
        saveDraftAction: await serverActionId(requestPage, "saveDraftAction", { cookie: ownerCookie }),
        createPRAction: await serverActionId(requestPage, "createPRAction", { cookie: ownerCookie }),
        deleteDraftAction: await serverActionId(requestPage, "deleteDraftAction", { cookie: ownerCookie }),
    };
    for (const [name, id] of Object.entries(ids)) ok(`${name}'s id is in the served chunks`, Boolean(id));

    const leaf = category?.codes?.[3] || null;
    const itemsFor = (size) =>
        JSON.stringify([{ categoryCodes: ["", "", "", leaf ?? ""], size, unit: "EA", qty: "1", unitPrice: "1", remark: "", quotationIndex: 0 }]);
    const requestFields = (overrides) => ({
        disciplineId: discipline?.id ?? "",
        vendorId: vendor?.id ?? "",
        notes: TAG,
        shippingFee: "",
        deliveryAddressId: address?.id ?? "",
        itemsJson: itemsFor(TAG),
        signersJson: JSON.stringify([{ userId: owner?.id ?? "", confirmationType: "Approval" }]),
        quotationsJson: "[]",
        existingDraftRecordId: "",
        confirmed: "",
        ...overrides,
    });
    const call = async (actionName, args, cookie) => {
        const mark = ledgerMark();
        const reply = await callServerAction({ pageUrl: requestPage, actionId: ids[actionName], args, cookie });
        const scope = scopesSince(mark)?.find((s) => s.label === actionName) ?? null;
        return { ...reply, ops: scope ? scope.ops : null };
    };
    const save = (fields, cookie) => call("saveDraftAction", [null, formOf(requestFields(fields))], cookie);
    const submit = (fields, cookie) => call("createPRAction", [null, formOf(requestFields(fields))], cookie);
    const remove = (prId, cookie) => call("deleteDraftAction", [prId], cookie);

    // THE PROBE, before anything exists: #440's words for an id that resolves to nothing.
    const probe = Object.values(ids).every(Boolean) ? await save({ existingDraftRecordId: NO_RECORD }, strangerCookie) : null;
    show("probe", { refusal: probe?.refusal, ops: probe?.ops });
    const liveTree = ok("an id that resolves to nothing is `gone` in #440's words — this tree is what is running", probe?.refusal === REFUSED.gone, probe?.refusal ?? "");
    if (probe?.refusal === REFUSED.oldTree) console.log("        (the server is running the tree from before #440)");
    if (!liveTree || !targetsHold || !leaf) throw new Error("the server is not running this tree, or a target is missing — nothing below may run");
    costs.push(["refused: an id that resolves to nothing (save)", probe.ops]);

    // --- B -----------------------------------------------------------------
    console.log("\nB — F1, the owner's draft, through the app's own path");
    const savedF1 = await save({ notes: `${TAG}-F1` }, ownerCookie);
    ok("the owner's new draft saves", savedF1.refusal === null && savedF1.flight.includes("savedDraft"), savedF1.refusal ?? "");
    const f1Rows = await base(TABLES.PURCHASE_REQUESTS).select({ filterByFormula: prefixMatch("Notes", `${TAG}-F1`), fields: ["PR ID"] }).all();
    for (const r of f1Rows) fixtures.track("requests", r.id);
    ok("  as exactly one request", f1Rows.length === 1, String(f1Rows.length));
    const F1 = f1Rows[0] ? { id: f1Rows[0].id, prId: f1Rows[0].get("PR ID") } : null;
    if (!F1) throw new Error("F1 was not created — nothing below may run");
    costs.push(["accepted: a new draft (save)", savedF1.ops]);

    // --- C -----------------------------------------------------------------
    console.log("\nC — F2, the owner's request in review, planted");
    const f2 = await createPR({
        requesterId: owner.id,
        disciplineId: discipline.id,
        vendorId: vendor.id,
        notes: `${TAG}-F2`,
        deliveryAddressId: address.id,
    });
    fixtures.track("requests", f2.id);
    const f2Item = await createItem({
        prRecordId: f2.id,
        prId: f2.prId,
        ...categoryItemFields(category),
        size: TAG,
        unit: "EA",
        qty: 1,
        unitPrice: 1,
        remark: "",
    });
    await createSigner({ prRecordId: f2.id, prId: f2.prId, signerUserId: stranger.id, sequenceOrder: 1, confirmationType: "Approval" });
    await updatePR(f2.id, { status: "In Review", currentSignerStep: 1 });
    const F2 = { id: f2.id, prId: f2.prId };
    show("planted", { F1: F1.prId, F2: F2.prId });

    // --- D -----------------------------------------------------------------
    console.log("\nD — F1 against a stranger, then against its owner");
    const blob = await put(`${TAG}-q.pdf`, MINIMAL_PDF, { access: "public", contentType: "application/pdf", addRandomSuffix: true });
    fixtures.trackBlob(blob.url);
    const submitFields = (existing) => ({
        existingDraftRecordId: existing,
        notes: `${TAG}-moved`,
        confirmed: "true",
        signersJson: JSON.stringify([{ userId: NO_RECORD, confirmationType: "Approval" }]),
        quotationsJson: JSON.stringify([{ recordId: "", url: blob.url, filename: "q.pdf", vendorQuotationCode: "" }]),
    });
    const f1Before = await requestState(F1.id);
    const refusedOnF1 = [
        ["the stranger's save", () => save({ existingDraftRecordId: F1.id, notes: `${TAG}-moved` }, strangerCookie), REFUSED.gone],
        ["the stranger's submit", () => submit(submitFields(F1.id), strangerCookie), REFUSED.gone],
        // Unconfirmed, with F2's own item: a duplicate check that ran first would answer
        // with a warning naming F2. The refusal has to be what comes back.
        ["the stranger's unconfirmed submit, with an item F2 already carries", () => submit({ ...submitFields(F1.id), confirmed: "", itemsJson: itemsFor(TAG) }, strangerCookie), REFUSED.gone],
        ["the stranger's delete", () => remove(F1.prId, strangerCookie), REFUSED.gone],
    ];
    for (const [label, run, expected] of refusedOnF1) {
        const reply = await run();
        const after = await requestState(F1.id);
        ok(`${label} is refused as \`gone\``, reply.refusal === expected, reply.refusal ?? "no refusal");
        ok("  and F1 reads back exactly as it was", after === f1Before, after === f1Before ? "" : `${f1Before} -> ${after}`);
        if (label.includes("unconfirmed")) ok("  with no duplicate warning in the reply", !reply.flight.includes("duplicateWarning"));
        costs.push([`refused: ${label}`, reply.ops]);
    }
    // The second is not a read that throws: `find` hands back the Users row itself
    // (airtable-access.md), mapped into a request with no Requester, so what refuses
    // it is identity rather than the catch.
    const sameWords = [
        ["an id that resolves to nothing", NO_RECORD],
        ["an id of another table (the stranger's own Users row)", stranger.id],
    ];
    for (const [label, id] of sameWords) {
        const reply = await save({ existingDraftRecordId: id }, strangerCookie);
        ok(`${label} gets the words someone else's draft got`, reply.refusal === REFUSED.gone, reply.refusal ?? "no refusal");
    }
    // THE OTHER HALF: the identical save, only the cookie different.
    const ownSave = await save({ existingDraftRecordId: F1.id, notes: `${TAG}-F1` }, ownerCookie);
    const f1AfterOwner = await base(TABLES.PURCHASE_REQUESTS).find(F1.id);
    ok("the owner's save of F1 is accepted", ownSave.refusal === null && ownSave.flight.includes("savedDraft"), ownSave.refusal ?? "");
    ok("  and is the same draft, still a Draft", f1AfterOwner.get("Status") === "Draft" && ownSave.flight.includes(F1.id));
    costs.push(["accepted: the owner re-saves F1", ownSave.ops]);

    // --- E -----------------------------------------------------------------
    console.log("\nE — F2, submitted: `submitted` to its owner, `gone` to anyone else");
    const f2Before = await requestState(F2.id);
    const onF2 = [
        ["the owner's save", () => save({ existingDraftRecordId: F2.id, notes: `${TAG}-moved` }, ownerCookie), REFUSED.submitted],
        ["the owner's submit", () => submit(submitFields(F2.id), ownerCookie), REFUSED.submitted],
        ["the owner's delete", () => remove(F2.prId, ownerCookie), REFUSED.submitted],
        ["the stranger's save", () => save({ existingDraftRecordId: F2.id, notes: `${TAG}-moved` }, strangerCookie), REFUSED.gone],
        ["the stranger's submit", () => submit(submitFields(F2.id), strangerCookie), REFUSED.gone],
        ["the stranger's delete", () => remove(F2.prId, strangerCookie), REFUSED.gone],
    ];
    for (const [label, run, expected] of onF2) {
        const reply = await run();
        const after = await requestState(F2.id);
        ok(`${label} is refused as \`${expected === REFUSED.gone ? "gone" : "submitted"}\``, reply.refusal === expected, reply.refusal ?? "no refusal");
        ok("  and F2 reads back exactly as it was", after === f2Before, after === f2Before ? "" : `${f2Before} -> ${after}`);
        costs.push([`refused: ${label} of F2`, reply.ops]);
    }

    // --- F -----------------------------------------------------------------
    console.log("\nF — Edit and continue on F2, linking a quotation that is not F2's");
    const prPage = `${BASE}/prs/${encodeURIComponent(F2.prId)}`;
    const editId = await serverActionId(prPage, "editAndContinueAction", { cookie: strangerCookie });
    ok("editAndContinueAction's id is found on F2's page for its signer", Boolean(editId));
    if (editId) {
        const otherBefore = await otherQuotationFiles();
        for (const [label, quotationId] of [
            [`${OTHER_REQUEST_ID}'s quotation`, otherQuotationId],
            ["a quotation id that resolves to nothing", NO_RECORD],
        ]) {
            const before = await requestState(F2.id);
            const mark = ledgerMark();
            const reply = await callServerAction({
                pageUrl: prPage,
                actionId: editId,
                cookie: strangerCookie,
                args: [
                    null,
                    formOf({
                        prId: F2.prId,
                        notes: "",
                        shippingFee: "",
                        newQuotationsJson: "[]",
                        itemsJson: JSON.stringify([
                            {
                                id: f2Item.id,
                                categoryCodes: ["", "", "", leaf],
                                size: TAG,
                                // THE NET: a refusal that failed to hold would die here, at the item write.
                                unit: `${TAG}-NOPE`,
                                qty: "1",
                                unitPrice: "1",
                                remark: "",
                                quotationChoice: `existing:${quotationId}`,
                            },
                        ]),
                    }),
                ],
            });
            const after = await requestState(F2.id);
            const scope = scopesSince(mark)?.find((s) => s.label === "editAndContinueAction") ?? null;
            ok(`linking ${label} is refused`, reply.refusal === REFUSED.quotation, reply.refusal ?? "no refusal");
            ok("  and F2's item, history, signer and step read back as they were", after === before, after === before ? "" : `${before} -> ${after}`);
            costs.push([`refused: edit turn linking ${label}`, scope ? scope.ops : null]);
        }
        ok(`${OTHER_REQUEST_ID}'s quotation still holds the same file`, (await otherQuotationFiles()) === otherBefore);
    } else {
        incomplete = true;
    }

    // --- G -----------------------------------------------------------------
    console.log("\nG — the owner deletes F1 through the app, and what each call cost");
    const deleted = await remove(F1.prId, ownerCookie);
    let f1Gone = false;
    try {
        await base(TABLES.PURCHASE_REQUESTS).find(F1.id);
    } catch {
        f1Gone = true;
    }
    ok("the owner's delete of F1 is accepted", deleted.refusal === null && deleted.flight.includes("deletedPrId"), deleted.refusal ?? "");
    ok("  and F1 is gone from the base", f1Gone);
    if (f1Gone) fixtures.untrack("requests", F1.id);
    costs.push(["accepted: the owner deletes F1", deleted.ops]);
    if (costs.some(([, n]) => n === null)) {
        incomplete = true;
        console.log("  SKIP  some calls have no scope line — is AIRTABLE_OPS_FILE set on the dev server?");
    }
    for (const [label, n] of costs) console.log(`        ${String(n ?? "—").padStart(3)} ops  ${label}`);

    complete = true;
} catch (err) {
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    if (!String(err.message).includes("nothing below may run")) console.error(err.stack);
} finally {
    console.log("\nCleanup");
    const trackedIds = fixtures.ids("requests");
    const teardown = await fixtures.teardown({ complete: complete && !incomplete });
    console.log(`  ${fixtures.describe(teardown)}`);
    if (teardown.leaked.length > 0) {
        pass = false;
        console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
    }
    for (const id of trackedIds) {
        let gone = false;
        try {
            await base(TABLES.PURCHASE_REQUESTS).find(id);
        } catch {
            gone = true;
        }
        ok(`${id} is no longer on the base`, gone);
    }
}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "OK" : code === 2 ? "INCOMPLETE" : "FAILED"} — exit ${code}`);
process.exit(code);

// Does the file route actually refuse? (#331)
//
// WHAT ONLY THIS CAN SAY. `offline/file-route.mjs` compares each axis's declared
// gate against the gate its own opener calls, which is a comparison rather than an
// execution — `verification.md`'s standing caveat applies in full: a gate inside
// `if (false)` satisfies it, and nothing in that tier issues a request. This script
// is the other half: three real sessions, five real axes, real HTTP.
//
// AND THE HALF THAT MATTERS MOST IS NOT THE REFUSAL. Proving that
// `authz-fixture@` is turned away needs one account and one gate; proving the five
// axes are gated SEPARATELY needs an account that ONE of them admits and another
// refuses, and `scoped-fixture@` is exactly that. It is assigned to the demo job, so
// the order document, the invoice file and the packing list photo open for it — and
// the quotation does not, because the request behind that quotation is a Draft and
// `canViewPR`'s first clause admits only its requester. One reader, one route,
// admitted and refused through the same code. A handler with one gate for all five
// cannot produce that pattern.
//
// IT CREATES NOTHING, so there is no fixture bucket and no teardown: every record it
// reads is demo data that `verification.md` says is not to be removed. What it does
// write is three `Auth Tokens` rows, through the production helper, which is what
// every credentialed script that needs a session already does.
//
// Run from the repo root with:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-file-route-331.mjs
//
// NEEDS `npm run dev` up. Override the target with FILE_ROUTE_VERIFY_BASE_URL.
// Exit codes: 0 all clear, 1 something failed, 2 clean but a part could not run.

import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { getAllPOs } from "../../lib/airtable/purchaseOrders.js";
import { getAllInvoices } from "../../lib/airtable/invoices.js";
import { getDeliveriesByJob } from "../../lib/airtable/deliveries.js";
import { getAllJobs } from "../../lib/airtable/jobs.js";
import { getQuotationsByPR } from "../../lib/airtable/quotations.js";
import { getDraftsByRequester, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { FILE_AXIS, fileHref } from "../../lib/fileLinks.js";

const BASE_URL = process.env.FILE_ROUTE_VERIFY_BASE_URL || "http://localhost:3000";

const ADMIN_EMAIL = "soo@hanyangengusa.com";
const SCOPED_EMAIL = "scoped-fixture@hanyangengusa.com";
const REFUSED_EMAIL = "authz-fixture@hanyangengusa.com";

let pass = true;
let incomplete = false;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}

/** A real session, the way the app issues one — see verify-authz.mjs Part E. */
async function sessionCookieFor(email) {
    const { token } = await createAuthToken(email);
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
    });
    const session = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    if (!session) throw new Error(`no session cookie for ${email} (status ${res.status})`);
    return session;
}

async function get(href, cookie) {
    const res = await fetch(`${BASE_URL}${href}`, {
        redirect: "manual",
        headers: cookie ? { cookie } : {},
    });
    return {
        status: res.status,
        type: res.headers.get("content-type"),
        disposition: res.headers.get("content-disposition"),
        cache: res.headers.get("cache-control"),
        nosniff: res.headers.get("x-content-type-options"),
        body: res.status === 200 ? null : (await res.text()).trim(),
    };
}

let serverUp = false;
try {
    await fetch(`${BASE_URL}/login`, { redirect: "manual" });
    serverUp = true;
} catch {
    serverUp = false;
}

if (!serverUp) {
    incomplete = true;
    console.log(`NOT RUN  no server reachable at ${BASE_URL} — start \`npm run dev\` and re-run.`);
    console.log("         This script is the only thing that proves the route refuses, so this run");
    console.log("         is INCOMPLETE (exit 2), not a pass.");
} else {
    // ---------------------------------------------------------------------------
    // Find one live record per axis. Read off the base rather than hard-coded,
    // because a demo re-seed changes every id and a hard-coded one would turn a
    // reseeded base into a failing gate.
    console.log("Finding one record per axis on this base:");

    const [pos, invoices, jobs] = await Promise.all([getAllPOs(), getAllInvoices(), getAllJobs()]);
    const po = pos.find((p) => p.poPdfFile?.[0]);
    const invoice = invoices.find((i) => i.file?.[0]);

    const deliveries = (
        await Promise.all(jobs.map((j) => getDeliveriesByJob(j.id).catch(() => [])))
    ).flat();
    const delivery = deliveries.find((d) => d.packingListFile?.[0]);

    // The quotation is reached through an order's request, so this walks rather
    // than scanning: `Quotations` has no reader that lists them all.
    let quotation = null;
    for (const candidate of pos) {
        if (!candidate.pr?.[0]) continue;
        const pr = await getPRByRecordId(candidate.pr[0]);
        const found = (await getQuotationsByPR(pr.id)).find((q) => q.file?.[0]);
        if (found) {
            quotation = found;
            break;
        }
    }

    const targets = {
        [FILE_AXIS.quotation]: quotation && {
            documentId: quotation.quotationId,
            filename: quotation.file[0].filename,
        },
        [FILE_AXIS.purchaseOrder]: po && { documentId: po.poId, filename: po.poPdfFile[0].filename },
        [FILE_AXIS.invoice]: invoice && { documentId: invoice.invoiceId, filename: invoice.file[0].filename },
        [FILE_AXIS.delivery]: delivery && {
            documentId: delivery.deliveryId,
            filename: delivery.packingListFile[0].filename,
        },
        // A direct purchase with a file may not exist — the table is empty on a
        // freshly seeded base — and its absence is reported rather than skipped
        // silently, because "found nothing" and "the axis is broken" look alike.
        [FILE_AXIS.directPurchase]: null,
    };

    for (const [axis, t] of Object.entries(targets)) {
        console.log(`  ${axis}: ${t ? t.documentId : "NO RECORD WITH A FILE ON THIS BASE"}`);
        if (!t) incomplete = true;
    }

    const found = Object.entries(targets).filter(([, t]) => t);

    // ---------------------------------------------------------------------------
    console.log("\nPart A — no session is sent to the front door rather than refused:");
    // A page cannot reach this state, so what lands here is a forwarded link.
    for (const [axis, t] of found) {
        const r = await get(fileHref({ axis, ...t }), null);
        check(`${axis} — no session redirects to /login`, r.status, 302);
    }

    // ---------------------------------------------------------------------------
    console.log("\nPart B — the account that fails every gate is refused on every axis:");
    const refusedCookie = await sessionCookieFor(REFUSED_EMAIL);
    for (const [axis, t] of found) {
        const r = await get(fileHref({ axis, ...t }), refusedCookie);
        check(`${axis} — non-Admin on no job`, r.status, 404);
        check(`  and the body says only this much`, r.body, "Not found.");
    }

    // ---------------------------------------------------------------------------
    console.log("\nPart C — a refusal and a miss are the same answer:");
    // The URL carries a human document id, so a reader can guess a neighbor of one.
    // What stops that learning anything is that a hit outside scope is byte-identical
    // to a miss — asserted against the SAME account that was refused above, so the
    // comparison is between two answers to one reader.
    const missing = [
        [FILE_AXIS.quotation, { documentId: "HYE-PR-999999-99-Q01", filename: "x.pdf" }],
        [FILE_AXIS.purchaseOrder, { documentId: "HYE-PO-99999999-99", filename: "x.pdf" }],
        [FILE_AXIS.invoice, { documentId: "HYE-INV-999999-99", filename: "x.pdf" }],
        [FILE_AXIS.delivery, { documentId: "HYE-DL-999999-99", filename: "x.png" }],
        [FILE_AXIS.directPurchase, { documentId: "HYE-DP-999999-99", filename: "x.pdf" }],
    ];
    for (const [axis, t] of missing) {
        const r = await get(fileHref({ axis, ...t }), refusedCookie);
        check(`${axis} — an id that does not exist`, `${r.status} ${r.body}`, "404 Not found.");
    }
    const bogus = await get("/api/files/vendor/HYE-PO-20260821-02/x.pdf", refusedCookie);
    check("an axis token that is not one of the five", `${bogus.status} ${bogus.body}`, "404 Not found.");

    // ---------------------------------------------------------------------------
    console.log("\nPart D — the office gets the file, with our headers rather than Airtable's:");
    const adminCookie = await sessionCookieFor(ADMIN_EMAIL);
    for (const [axis, t] of found) {
        const r = await get(fileHref({ axis, ...t }), adminCookie);
        check(`${axis} — Admin`, r.status, 200);
        if (r.status !== 200) continue;
        // `inline` is load-bearing: the viewer frames this response, and
        // `attachment` would make a browser save instead of display.
        check(`  disposition names the record's own file`, r.disposition, `inline; filename="${t.filename}"`);
        // Gated bytes from our own origin, so no shared cache may hold them and
        // Airtable's `max-age=14400, immutable` must not be inherited.
        check(`  and is not cacheable`, r.cache, "private, no-store");
        check(`  and cannot be sniffed into markup`, r.nosniff, "nosniff");
    }

    // ---------------------------------------------------------------------------
    console.log("\nPart E — THE ONE THAT PROVES THE AXES ARE GATED SEPARATELY:");
    console.log("  one reader, two axes, two verdicts.");
    // THE SPLIT HAS TO BE CONSTRUCTED AND NOT FOUND, which the first version of this
    // part got wrong and the run is what said so. It scanned for any quotation with a
    // file, landed on one hanging off a submitted request on the demo job, and watched
    // `scoped-fixture@` be admitted on all four axes — a uniform pass, which is
    // exactly what ONE permissive gate produces. The pattern that discriminates needs
    // two records chosen because the gates disagree about them:
    //
    //   a quotation on a DRAFT request somebody else raised — `canViewPR`'s first
    //   clause admits only the requester, ahead of every other clause including the
    //   Job one, so this reader is refused;
    //   a packing list photo on a job this reader IS assigned to, which
    //   `canAccessJobDeliveries` admits.
    //
    // Neither verdict is reachable by a handler asking one question. Were both axes
    // on `canViewPR`, the delivery record carries no signer or correction link arrays
    // and would be refused or would throw; were both on `canAccessJobDeliveries`, the
    // quotation would be admitted on the Job. So the split rules out a shared gate in
    // both directions — and a base that cannot supply the pair is reported NOT RUN
    // rather than asserted against something weaker.
    const scopedCookie = await sessionCookieFor(SCOPED_EMAIL);
    const users = await getActiveUsers();
    const scopedUser = users.find((u) => u.email === SCOPED_EMAIL);

    let draftQuotation = null;
    for (const u of users) {
        if (u.email === SCOPED_EMAIL) continue;
        for (const draft of await getDraftsByRequester(u.id)) {
            const q = (await getQuotationsByPR(draft.id)).find((x) => x.file?.[0]);
            if (q) {
                draftQuotation = q;
                break;
            }
        }
        if (draftQuotation) break;
    }

    const scopedJobs = scopedUser?.assignedJobs || [];
    const scopedDelivery = deliveries.find(
        (d) => d.packingListFile?.[0] && scopedJobs.includes(d.job?.[0])
    );

    if (!draftQuotation || !scopedDelivery) {
        incomplete = true;
        console.log("  NOT RUN  this base cannot supply the pair:");
        console.log(`           a Draft request with a quotation file, raised by somebody else: ${draftQuotation?.quotationId ?? "none"}`);
        console.log(`           a delivery with a photo on one of that account's jobs: ${scopedDelivery?.deliveryId ?? "none"}`);
        console.log("           Without both, a uniform pass cannot be told from one shared gate, so");
        console.log("           this part asserts nothing rather than asserting something weaker.");
    } else {
        const q = await get(
            fileHref({
                axis: FILE_AXIS.quotation,
                documentId: draftQuotation.quotationId,
                filename: draftQuotation.file[0].filename,
            }),
            scopedCookie
        );
        const d = await get(
            fileHref({
                axis: FILE_AXIS.delivery,
                documentId: scopedDelivery.deliveryId,
                filename: scopedDelivery.packingListFile[0].filename,
            }),
            scopedCookie
        );
        console.log(`  quotation on a Draft somebody else raised (${draftQuotation.quotationId}): ${q.status}`);
        console.log(`  packing list on one of this account's jobs (${scopedDelivery.deliveryId}): ${d.status}`);
        check("  canViewPR's Draft clause refuses this reader", q.status, 404);
        check("  and canAccessJobDeliveries admits the same reader", d.status, 200);
        if (q.status === 404 && d.status === 200) {
            console.log("  PASS  two verdicts for one reader — the five axes do not answer as one gate");
        }
    }
}

// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(56));
console.log("This script created no records beyond the Auth Tokens rows its sessions spend.");
if (!pass) {
    console.log("SOME CHECKS FAILED");
    process.exit(1);
} else if (incomplete) {
    console.log("NO FAILURES, BUT THE RUN WAS INCOMPLETE — see NOT RUN / NO RECORD above");
    process.exit(2);
} else {
    console.log("ALL CHECKS PASS");
    process.exit(0);
}

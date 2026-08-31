// Which job's material an invoice charges for (#314).
//
// THE FOUR DOCUMENT LISTS CARRIED THIS FACT THREE WAYS. `/prs` and `/pos` headed a
// column `Job / Discipline` and folded both into one cell, `/deliveries` carried
// `Job` alone, and `/invoices` carried neither — so the office, which #211 gave
// every invoice on the base, read that list with no way to tell which site the
// material was for. A delivery holds a `Job` link and a request reaches one through
// its discipline; an invoice holds neither, which is why this module exists and the
// other three lists need nothing like it.
//
// THE WALK IS THE GATE'S OWN, AND THIS MODULE DOES NOT MAKE IT. `getVisibleInvoiceIds`
// already goes `Invoice Items` -> `Purchase Orders` -> `Purchase Requests` to reach
// `canViewPR`, and a request carries `Job` as a lookup through its discipline — so the
// answer is in the records that walk resolved and used to throw away.
// `lib/invoiceVisibility.js:resolveInvoiceScope` hands them back (#216's rule: a
// function that reads something and does not hand it back forces the next caller to
// read it again), and this module is the judgment over them.
//
// NO PRIVILEGE INPUT, AND THAT IS THE POINT RATHER THAN AN ECONOMY. #211 split the
// invoice list into two readers — one that walks and one that skips the walk — so a
// job resolved on each side of that split is a fact that can differ by reader on one
// row, with both halves looking right. A function with no `user` parameter cannot
// differ by reader, which is the same shape #309 left `resolveDeleteCopy` in and the
// property `offline/job-column.mjs` reads off the signature. `_shared.md` states the
// standing form of it: no table in this app drops a column by reader, and the fact is
// not what varies.
//
// SO THE COLUMN IS NOT NARROWED TO THE ORDERS THAT ADMITTED THE INVOICE, and under the
// premise below that costs nothing: an invoice charges orders on one job, so a reader
// who may see the invoice may see an order on that job and therefore the job. The
// alternative — resolving only the admitted orders' jobs — buys protection in a state
// the app has decided does not happen, and buys it by making a reader-dependent cell a
// permanent feature of the screen.
//
// ONE INVOICE, ONE JOB — A COROLLARY OF THE ONE-DELIVERY PREMISE, NOT A NEW ASSUMPTION.
// `docs/notes/deliveries-and-invoices.md` opens with it: the material one invoice
// charges arrives on the one delivery that invoice matches. A delivery holds a single
// `Job`, so an invoice spanning two jobs is an invoice split across two deliveries,
// which is the case that premise says does not occur. **Nothing on the write side
// enforces it** — `createInvoiceAction` checks only that no order is withdrawn and the
// PO picker narrows by vendor alone — so the state is reachable by hand, exactly as a
// `Deliveries` row can be linked by hand to an invoice it does not contain. Reading
// code has to survive a violation that writing code merely does not produce.
//
// WHAT THIS DOES WHEN IT IS VIOLATED: it names no job, and it never picks one. A cell
// with no answer is a state `/invoices` already renders and already means — an em
// dash, which `invoices.md` distinguishes from a measurement as "the absence of one" —
// so the honest reading is borrowed rather than invented, and no arbitrary job code
// ever appears under a heading that asserts one. It is the direction
// `getVisibleInvoiceIds` already takes for an order it cannot resolve: refuse rather
// than guess. The same silence covers an invoice whose orders resolve to no job at
// all, which is one hand-emptied link away.
//
// PURE AND IMPORT-FREE, so `offline/job-column.mjs` can CALL it rather than read its
// shape, and no client bundle can reach a credentialed module through it.

/**
 * The job each invoice charges for, as `Map<invoice record id, job record id|null>`.
 *
 * `invoiceItems` are loaded `Invoice Items` carrying their own `invoice` and `po`
 * links; `poById` and `prById` are the orders and requests the walk resolved. The
 * caller supplies all three because the gate holds them already — the same
 * pass-what-you-loaded contract `canViewPR`, `getInvoiceDeliveryStatus` and
 * `getVisibleInvoiceIds` use.
 *
 * AN ENTRY FOR EVERY INVOICE THAT HAS ONE, and none at all for an invoice whose items
 * name nothing this walk resolved — a caller reading a missing key gets `undefined`
 * and renders the same dash a `null` renders, so the two need not be told apart.
 *
 * `null` IS A RESOLVED ANSWER OF "NO SINGLE JOB", which is the premise's boundary
 * above. Two orders on ONE job is not that case and is the ordinary reason an invoice
 * carries two — a correction that split every item across an order and its overage
 * order — so the distinguishing test is the number of distinct JOBS, never the number
 * of orders.
 */
export function jobForInvoices({ invoiceItems, poById, prById } = {}) {
    const orders = poById || new Map();
    const requests = prById || new Map();

    // One pass, gathering the distinct jobs each invoice's orders sit on. A Set per
    // invoice rather than a first-wins scalar, because "did this resolve to exactly
    // one" is the question and a scalar cannot answer it after the fact.
    const jobsByInvoice = new Map();
    for (const item of invoiceItems || []) {
        const invoiceRecordId = item?.invoice?.[0];
        const poRecordId = item?.po?.[0];
        if (!invoiceRecordId || !poRecordId) continue;

        const po = orders.get(poRecordId);
        const pr = po?.pr?.[0] ? requests.get(po.pr[0]) : null;
        // `Job` is a lookup through the request's discipline, so it arrives as an
        // array of one. An order whose request did not resolve contributes nothing
        // rather than a blank job — the same skip the reconciliation walks make for a
        // link emptied by hand.
        const jobRecordId = pr?.job?.[0];
        if (!jobRecordId) continue;

        if (!jobsByInvoice.has(invoiceRecordId)) jobsByInvoice.set(invoiceRecordId, new Set());
        jobsByInvoice.get(invoiceRecordId).add(jobRecordId);
    }

    const out = new Map();
    for (const [invoiceRecordId, jobRecordIds] of jobsByInvoice) {
        out.set(invoiceRecordId, jobRecordIds.size === 1 ? [...jobRecordIds][0] : null);
    }
    return out;
}

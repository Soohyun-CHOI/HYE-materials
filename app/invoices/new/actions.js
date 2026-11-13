"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { withAdminAction, requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createInvoice, getInvoiceByRecordId, updateInvoice } from "@/lib/airtable/invoices";
import { createInvoiceItem, updateInvoiceItem } from "@/lib/airtable/invoiceItems";
import { getPOItemByRecordId, getInvoicedQtyForPOItem } from "@/lib/airtable/poItems";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { isOurBlobUrl } from "@/lib/fileSource";
import { createDirectPurchase } from "@/lib/airtable/directPurchases";
import { DIRECT_PURCHASE_COPY, directPurchaseBlocked } from "@/lib/directPurchase";
import { isPOWithdrawn } from "@/lib/poWithdraw";
import { withOpsLabel } from "@/lib/airtableOps";
import {
    ITEM_PRECISION_COPY,
    checkTotalsDiffer,
    checkPriceVariance,
    checkQuantityVariance,
    headerPrecisionRefusal,
    isWholeCentPrice,
    isWholeQty,
} from "@/lib/variance";

// Server Actions are directly callable regardless of what the page
// rendered, so the Admin check happens here too, not just in the page
// component — same principle as every other admin form in this project.
// Issue #147: the check is now the wrapper, so the handler cannot run
// unauthorized. The handler is passed by name rather than inlined only
// because its body is long; both forms satisfy the structural check in
// scripts/tests/verify-authz-structure.mjs.
export const createInvoiceAction = withAdminAction(
    () => ({ error: "Not authorized." }),
    createInvoiceHandler
);

async function createInvoiceHandler(prevState, formData) {
    // LABELED IN #231, AND THE SCOPE WRAPS THE WHOLE BODY RATHER THAN A CALL TO IT.
    // That issue labeled it for the computed pairing's reads, which #640 removed; the
    // label stays because an unlabeled write path would cost whatever it costs with
    // nothing able to say so — #217 is the precedent, where labeling the signing chain
    // is what found that 14 of its operations were not data.
    //
    // The shape is approveAction's, and it is forced rather than chosen:
    // `offline/source-shape.mjs` resolves this action through its wrapper's last
    // function-ish argument and then walks THAT subtree for six properties it pins
    // here — the Blob cleanup scheduled rather than awaited, its position outside
    // the rollback, and isPOWithdrawn running before the first create. Delegating
    // the body to a sibling function leaves all six true and none of them visible,
    // which is a check losing its teeth to an indentation preference.
    return withOpsLabel("createInvoiceAction", async () => {
        const vendorId = formData.get("vendorId");
        const vendorInvoiceCode = formData.get("vendorInvoiceCode") || "";
        const issueDate = formData.get("issueDate");
        const dueDate = formData.get("dueDate") || null;
        const invoiceTotal = formData.get("invoiceTotal");
        const shippingFee = formData.get("shippingFee") || 0;
        const tariff = formData.get("tariff"); // issue #57 — optional, only present once the header's "+ Add Tariff" was used
        const salesTax = formData.get("salesTax"); // issue #283 — the same, behind "+ Add Sales Tax"
        const items = JSON.parse(formData.get("itemsJson") || "[]");
        const invoiceFileUrl = formData.get("invoiceFileUrl");
        const invoiceFileFilename = formData.get("invoiceFileFilename");

        if (!vendorId) return { error: "Select a Vendor." };
        if (!issueDate) return { error: "Issue Date is required." };
        if (!invoiceTotal) return { error: "Invoice Total is required." };
        // Issue #405 — the rest of `TOTALS_TOLERANCE`'s premise, refused where the
        // reader can fix it. #254 held `Items Subtotal` through the item loop below
        // and left the three terms summed beside it, and the stated total they are
        // compared against, asked by nothing — so a `1.005` in any of the four boxes
        // above put a side of that comparison off the cent. `createInvoice` throws on
        // the same judgment and stays the backstop; this is here for the reason the
        // item refusal is, and more plainly, since every one of these four controls
        // is a box the reader typed into on this screen.
        const headerRefusal = headerPrecisionRefusal({
            shippingFee: parseFloat(shippingFee),
            tariff: tariff ? parseFloat(tariff) : null,
            salesTax: salesTax ? parseFloat(salesTax) : null,
            invoiceTotal: parseFloat(invoiceTotal),
        });
        if (headerRefusal) return { error: headerRefusal };
        // Required, unlike Quotations (#34) — every received vendor invoice
        // must be kept on file. The submit button is already disabled client-
        // side until the upload finishes, but Server Actions are callable
        // directly regardless of what the page rendered, so this is re-checked
        // here too.
        if (!invoiceFileUrl) return { error: "Attach the invoice file." };
        // Issue #438 — and it has to be the file this form uploaded: a url on our
        // Blob store. Airtable fetches and keeps whatever an attachment url points
        // at, so anything else would make this action a fetcher of caller-supplied
        // addresses — the refusal createDirectPurchaseAction makes further down this
        // file. Among the refusals and above the session read, so a submission
        // turned away here still costs nothing (#382); the reader is told what they
        // can act on and the real reason is logged.
        if (!isOurBlobUrl(invoiceFileUrl)) {
            console.error("createInvoiceAction refused an invoice file url that is not on our Blob store");
            return { error: "Attach the invoice file." };
        }
        if (items.length === 0) return { error: "Add at least one item." };
        for (const item of items) {
            if (!item.itemName || !item.qty || !item.unitPrice) {
                return { error: "Every item needs a name, quantity, and unit price." };
            }
            if (!item.poRecordId) {
                return { error: "Every item needs a PO — pick one at the top or per item." };
            }
            // Issue #278 — THE SAME REFUSAL ONE LEVEL DOWN, and the one that makes
            // "every invoice item names an ordered item" a property rather than a
            // habit. `PO Item` was optional here because #96 left a hidden free-text
            // option and its backend path; #278 removed both, and this is what keeps
            // the state closed after them. The form says why a row has nothing to
            // pick before a reader types into it — this is the boundary rather than
            // the message, the same division the PO refusal above already has.
            //
            // Issue #303 — BOTH NOUNS CARRY A MODIFIER, and this sentence is why the
            // rule needed stating: it names a row of two tables and said `item` for
            // one of them, so the same word stood for two things two words apart. It
            // is the one refusal on this screen a reader can actually reach (the
            // ordered-item select carries no `required`), so it is also the one that
            // was read that way. The three neighbours above name one kind each and
            // keep the bare word.
            if (!item.poItemRecordId) {
                return { error: "Every invoice item needs an ordered item from its PO." };
            }
            // Issue #254 — the premise `TOTALS_TOLERANCE` is derived from, refused
            // where the reader can fix it. `createInvoiceItem` throws on the same
            // judgment and stays the backstop; this is here because BOTH STATES ARE
            // REACHABLE FROM THE FORM — measured, the two controls' step validation
            // does not fire, so a typed `2.5` submits — and a throw inside the
            // rollback block reaches a reader as `Something went wrong`, on an
            // input they could correct.
            if (!isWholeQty(parseFloat(item.qty))) {
                return { error: ITEM_PRECISION_COPY.qty };
            }
            if (!isWholeCentPrice(parseFloat(item.unitPrice))) {
                return { error: ITEM_PRECISION_COPY.unitPrice };
            }
        }

        // Issue #138 — the inverse of the withdraw predicate's no-linked-invoice
        // condition, and the reason that condition can be trusted: a withdrawn
        // PO will never receive an invoice, so linking one is refused here.
        // Deliberately only the status check, NOT getPOWithdrawEligibility() —
        // that predicate would also reject a second invoice against a partly
        // invoiced PO, which is routine. The two rules share the status name, not
        // the rule: being un-withdrawable doesn't make a PO un-invoiceable.
        //
        // Placed before the first write, not inside the try below: a refusal
        // must create nothing at all rather than lean on the rollback path.
        // Withdrawn POs are already absent from the picker and from PO detection
        // (getPOsExceptWithdrawn/searchPOs, /api/invoices/detect-po), but a Server
        // Action is directly callable, and a PO can be withdrawn while this form sits
        // open. Withdrawn is now the ONLY status either side excludes (#168), so this
        // check and those queries agree on exactly one condition.
        const distinctPoIds = [...new Set(items.map((item) => item.poRecordId))];
        let linkedPos;
        try {
            linkedPos = await Promise.all(distinctPoIds.map((id) => getPOByRecordId(id)));
        } catch (err) {
            // .find() throws on an id that doesn't resolve. Before this guard
            // existed such an id failed later, inside the rollback-protected
            // block; now it's read up front, so it needs its own clean refusal
            // rather than surfacing as an unhandled action error.
            console.error("createInvoiceAction couldn't resolve a submitted PO", err);
            return { error: "One of the selected POs no longer exists. Reload the form and try again." };
        }
        const withdrawnPos = linkedPos.filter((po) => isPOWithdrawn(po));
        if (withdrawnPos.length > 0) {
            const ids = withdrawnPos.map((po) => po.poId).join(", ");
            return {
                error:
                    withdrawnPos.length === 1
                        ? `${ids} was withdrawn, so an invoice can't be linked to it.`
                        : `${ids} were withdrawn, so an invoice can't be linked to them.`,
            };
        }

        // #382 — THE SESSION, FOR THE `Recorded By` THIS CREATE WRITES. It was read
        // for the delivery pairing's Job scope too, until #640 removed the pairing.
        // `withAdminAction` loads a user to decide the gate and discards it
        // (lib/authzWrap.js:createFlagGuard), so an action needing the person pays one
        // operation for them — #185's question, reported at #193 rather than fixed by
        // changing every wrapper's contract.
        //
        // BELOW THE REFUSALS AND ABOVE THE FIRST WRITE. A submission this action turns
        // away still costs nothing, and nothing is created before the person writing
        // it is known.
        const user = await requireUser();

        let invoice;
        const createdItemIds = [];

        try {
            // The file is written as part of this same create() call, not a
            // separate record the way Quotations are (#34's Quotation record
            // is its own table row) — so there's no intermediate state where
            // the Invoice exists but the file doesn't; either this single
            // write succeeds with both, or it fails and nothing was created at
            // all (the catch block below has nothing to roll back in that case).
            invoice = await createInvoice({
                vendorId,
                vendorInvoiceCode,
                issueDate,
                dueDate,
                invoiceTotal: parseFloat(invoiceTotal),
                shippingFee: parseFloat(shippingFee) || 0,
                tariff: tariff ? parseFloat(tariff) : null,
                // Issue #283 — Tariff's coercion, character for character. It maps
                // a typed `0` to null along with an empty box, so a document
                // stating zero tax is stored as no tax line; the total is the same
                // either way and only the detail's row differs. Diverging on one of
                // the two terms would be two shapes for one rule, and changing both
                // is a change to Tariff's behavior.
                salesTax: salesTax ? parseFloat(salesTax) : null,
                file: [{ url: invoiceFileUrl, filename: invoiceFileFilename || undefined }],
                // #382 — inside the same create() as the file, so an invoice never
                // exists without the person who entered it. The rollback below has
                // nothing extra to undo: this is one field of one record.
                recordedByUserId: user.id,
            });

            const createdItems = [];
            for (const item of items) {
                const created = await createInvoiceItem({
                    invoiceRecordId: invoice.id,
                    invoiceId: invoice.invoiceId,
                    poRecordId: item.poRecordId,
                    // `|| null` until #278 — the coalesce WAS the backend path #96
                    // left standing. The refusal above is what lets this pass the
                    // value through.
                    poItemRecordId: item.poItemRecordId,
                    itemName: item.itemName,
                    size: item.size,
                    maker: item.maker,
                    unit: item.unit,
                    qty: parseFloat(item.qty),
                    unitPrice: parseFloat(item.unitPrice),
                    remark: item.remark || "",
                });
                createdItemIds.push(created.id);
                createdItems.push(created);
            }

            // Variance checking (#15), per the tolerance rules decided in #17. Qty
            // is a creation-time snapshot: it reads the cumulative invoiced Qty
            // (already including this invoice item, since it's linked by now) and is
            // never retroactively recomputed for sibling Invoice Items created
            // earlier against the same PO Item.
            //
            // THE `continue` READS A WRITE THIS FUNCTION JUST MADE, so #278 leaves
            // it: the refusal above guarantees a link went in, and this reads the
            // record back. What it guards against is Airtable having failed to store
            // one, which is not the free-text state and is not something to discover
            // by dereferencing undefined. It said "free-text `Other` invoice items
            // have nothing to compare against" and that is no longer why.
            for (const created of createdItems) {
                const poItemRecordId = created.poItem?.[0];
                if (!poItemRecordId) continue;

                const poItem = await getPOItemByRecordId(poItemRecordId);
                const hasPriceVariance = checkPriceVariance(created.unitPrice, poItem.unitPrice);
                const invoicedQty = await getInvoicedQtyForPOItem(poItemRecordId);
                const hasQuantityVariance = checkQuantityVariance(invoicedQty, poItem.qty);

                // #623 — the two judged and stored apart, where one flag held either.
                if (hasPriceVariance || hasQuantityVariance) {
                    await updateInvoiceItem(created.id, { hasPriceVariance, hasQuantityVariance });
                }
            }

            // Header-level check needs Calculated Total's rollup (Items
            // Subtotal -> Calculated Total) to have caught up, so it's read
            // back fresh rather than trusted from the pre-Items `invoice`.
            const invoiceAfterItems = await getInvoiceByRecordId(invoice.id);
            if (checkTotalsDiffer(invoiceAfterItems.invoiceTotal, invoiceAfterItems.calculatedTotal || 0)) {
                await updateInvoice(invoice.id, { totalsDiffer: true });
            }
        } catch (err) {
            // Same create-then-delete rollback pattern as #5/#10: Airtable has
            // no cross-table transactions, so a failure partway through would
            // otherwise leave a half-built Invoice behind. Reverse creation
            // order — Items, then the Invoice itself.
            if (invoice) {
                await Promise.allSettled(
                    createdItemIds.map((id) => base(TABLES.INVOICE_ITEMS).destroy([id]))
                );
                await base(TABLES.INVOICES).destroy([invoice.id]).catch(() => {});
            }

            console.error("createInvoiceAction failed, rolled back", err);
            return { error: "Something went wrong creating the invoice. Please try again." };
        }

        // #231's COMPUTED PAIRING STOOD HERE AND IS GONE WITH THE LINK IT WROTE (#640).
        // It matched the new invoice to one delivery and stored it on
        // `Invoices."Delivery"`; invoices and deliveries meet only through the ordered
        // items they both name now, so there is nothing to work out at entry and nothing
        // to write after it.

        // Issue #140 — every write above succeeded, so the uploaded object has
        // served its purpose: Airtable holds the invoice file now. Deliberately
        // outside the try above — a rollback must leave the object alive, because
        // the Requester's retry re-submits this same URL from the still-open
        // form. /api/invoices/detect-po already read it (at upload time, long
        // before this point), so nothing else needs it either.
        //
        // Scheduled with after() (see app/prs/new/actions.js) so the Admin isn't
        // held for it, and so the cleanup no longer depends on sitting above the
        // redirect() below.
        after(() =>
            confirmIngestThenDelete([
                {
                    table: TABLES.INVOICES,
                    recordId: invoice.id,
                    field: "File",
                    blobUrl: invoiceFileUrl,
                    attachmentId: invoice.file?.[0]?.id,
                    label: `invoice file ${invoice.invoiceId}`,
                },
            ])
        );

        // Issue #115 — land on the new invoice's detail page (was the
        // new-invoice page, a known follow-up), so the full record is shown
        // straight after creation.
        //
        // #321 AND #640 — WITH NO QUERY STRING AT ALL. #321 took the confirmation off
        // it and left #231's `paired` and `tied`, which said on arrival which delivery
        // the app had matched; the pairing is gone (#640), so the arrival says what it
        // says by being the invoice's own page.
        redirect(`/invoices/${encodeURIComponent(invoice.invoiceId)}`);
    });
}

// Issue #272 — the way out of the dead end this screen can otherwise only sit in:
// the vendor's invoice names no order this app holds, or names one whose ordered
// items are not what it charges for, so there is nothing to record it against.
// The office records what the invoice says as a `Direct Purchases` row and the
// site raises the purchase request from it.
//
// ADMIN, LIKE EVERY OTHER WRITE ON THIS SCREEN, and by the wrapper rather than a
// bare call so the handler cannot run unauthorized (#147). The Job scope that
// decides who may CLAIM the row is the claim action's, not this one's: recording
// is office work and the office reaches every job.
export const createDirectPurchaseAction = withAdminAction(
    () => ({ error: "Not authorized." }),
    createDirectPurchaseHandler
);

async function createDirectPurchaseHandler(prevState, formData) {
    return withOpsLabel("createDirectPurchaseAction", async () => {
        const vendorId = formData.get("vendorId") || "";
        const jobId = formData.get("jobId") || "";
        const jobCode = formData.get("jobCode") || "";
        const fileUrl = formData.get("invoiceFileUrl") || "";
        const filename = formData.get("invoiceFileFilename") || "";
        const vendorInvoiceCode = formData.get("vendorInvoiceCode") || "";
        const issueDate = formData.get("issueDate") || null;
        const notes = formData.get("notes") || "";

        // THE SAME PREDICATE THE MODAL ASKED, and this call is the guarantee: a
        // Server Action is directly callable, so the button's own check proves
        // nothing about what arrives here. One implementation, so the two cannot
        // come to disagree about what counts as blank.
        const blocked = directPurchaseBlocked({ vendorId, fileUrl, jobId });
        if (blocked) return { error: DIRECT_PURCHASE_COPY.blocked[blocked] };

        // A url this app uploaded, and nothing else. Airtable is about to fetch
        // whatever is handed to it, so an arbitrary one would make this action a
        // fetcher of caller-supplied addresses — the restriction CLAUDE.md puts on
        // every route that takes one. The reader is told what they can act on
        // rather than how the check is spelled; the real reason is logged.
        if (!isOurBlobUrl(fileUrl)) {
            console.error("createDirectPurchaseAction refused a foreign file url");
            return { error: DIRECT_PURCHASE_COPY.blocked["no-file"] };
        }

        let record;
        try {
            // Re-read for the same reason createInvoiceHandler does: withAdminAction
            // loads a user to decide the gate and discards it, so an action needing
            // the person pays one operation for them (#185's question, reported at
            // #193 rather than fixed by changing every wrapper's contract).
            const user = await requireUser();
            record = await createDirectPurchase({
                vendorRecordId: vendorId,
                jobRecordId: jobId,
                vendorInvoiceCode,
                issueDate,
                notes,
                recordedByUserId: user.id,
                // The invoice the office attached moments ago: a fresh Blob object
                // nobody has ingested, so it goes to Airtable as it is. The overage
                // request has to re-upload because its source is Airtable's own copy
                // of an invoice (#167, #142); this one does not.
                file: [{ url: fileUrl, filename: filename || undefined }],
            });
        } catch (err) {
            console.error("createDirectPurchaseAction failed", err);
            return { error: "Couldn't record the direct purchase. Please try again." };
        }

        // Issue #140 — the end of this action's transaction. Scheduled rather than
        // awaited, which also survives the redirect below throwing.
        after(() =>
            confirmIngestThenDelete([
                {
                    table: TABLES.DIRECT_PURCHASES,
                    recordId: record.id,
                    field: "File",
                    blobUrl: fileUrl,
                    attachmentId: record.file?.[0]?.id,
                    label: `direct purchase file ${record.directPurchaseId}`,
                },
            ])
        );

        // BACK TO AN EMPTY FORM, WHICH IS THE HONEST DESTINATION. The invoice that
        // started this cannot be entered until the request is approved and its order
        // signed, so there is nothing to return to and the modal said so before the
        // button was pressed. The office's next invoice is the likely next act.
        //
        // The Job's CODE rides along beside the id because the confirmation names
        // it and this action holds only a record id; the client had the code from
        // `GET /api/jobs`. It is display text rather than the fact — #231's rule is
        // that a query string carries keys and never sentences, and the sentence is
        // DIRECT_PURCHASE_COPY's either way.
        const job = jobCode ? `&job=${encodeURIComponent(jobCode)}` : "";
        redirect(`/invoices/new?recorded=${encodeURIComponent(record.directPurchaseId)}${job}`);
    });
}

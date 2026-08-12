// Reading the item axis for #19's two screens.
//
// Both screens assemble rows from five tables — Materials, Material Prices, PO
// Items, Purchase Orders, Purchase Requests — and both have to decide, PER ROW,
// whether the viewer may see document identifiers. That combination is the whole
// reason this module exists rather than the pages querying for themselves.
//
// THE QUERY BUDGET IS CONSTANT IN THE NUMBER OF ROWS. Every step below fetches a
// whole level at once, keyed on record ids gathered from the level above:
//
//   search screen                       history screen
//   1  Materials  (token AND-match)     1  Materials   (.find by id)
//   2  Material Prices (by material)    2  PO Items    (by record id)
//   3  Purchase Orders (by record id)   3  Purchase Orders (by record id)
//   4  PO Items    (by record id)       4  Purchase Requests (by record id)
//   5  Purchase Requests (by record id) 5  Vendors     (all)
//   6  Vendors     (all)                6  Jobs        (all)
//   7  Jobs        (all)
//
// So ~7 queries for a page of any size, plus one extra per 50 ids inside a
// batched step. The alternative — resolving each row's PO, then its PR, to run
// the visibility rule — is one or two round trips PER ROW, which is exactly what
// #143 established should not happen. `canViewPR` is pure and takes an
// already-loaded user and PR, which is the property that makes the batching
// possible at all: the gate needs no query of its own.
//
// WHY THE DATE IS THE PO's `Created Date`. A PO Item carries no date of its own,
// so the date has to come from its parent, and three fields were candidates.
// `Created Date` is the moment the price was frozen onto the document — it is
// what `createPOItem` snapshots against and what `upsertMaterialPrice` already
// stores as `Material Prices."Latest Date"`, so the comparison row and the
// history row cannot disagree about when a price happened. `President Signed At`
// is later and, on an Awaiting Signature PO, absent — using it would leave rows
// undated. `Withdrawn At` describes a different event entirely. The cost is that
// `Created Date` is calendar-only, so several POs on one day tie; the tie-break
// lives in lib/materialPriceView.js:sortHistoryRows.
//
// Credentialed tier: imports lib/airtable/*, so the offline tier cannot load it.

import { getMaterialByRecordId, searchMaterials } from "./airtable/materials";
import { getPricesForMaterials } from "./airtable/materialPrices";
import { getPOItemsByRecordIds } from "./airtable/poItems";
import { getPOsByRecordIds } from "./airtable/purchaseOrders";
import { getPRsByRecordIds } from "./airtable/purchaseRequests";
import { getAllVendors } from "./airtable/vendors";
import { getAllJobs } from "./airtable/jobs";
import { canViewPR } from "./prVisibility";
import { buildSearchTokens, sortHistoryRows, sortVendorRows } from "./materialPriceView";

/**
 * Which document identifiers this viewer may see for one source PO.
 *
 * Prices, vendors, dates and quantities are open to every active user — the
 * point of the screen is that anyone buying materials can see what things cost.
 * The PO ID, the PR ID and the Job are identifiers of a specific document, so
 * they follow the document's own rule (`canViewPR` on the PO's parent PR, the
 * same gate app/pos/[poId] uses). A viewer who fails it still sees the price.
 *
 * A PO whose parent PR could not be loaded is treated as not visible. That is
 * the safe direction here and, unlike inside canViewPR itself, it cannot stall
 * anything: no chain runs through this screen.
 */
function identifierVisibility(user, po, prsById) {
    const prId = po?.pr?.[0];
    const pr = prId ? prsById.get(prId) : null;
    if (!pr) return { visible: false, pr: null };
    return { visible: canViewPR(user, pr), pr };
}

function indexBy(rows) {
    return new Map(rows.map((r) => [r.id, r]));
}

/**
 * The search screen's data: matched materials, each with one row per vendor.
 *
 * Returns `{ tokens, materials, truncated }`. An empty `tokens` is a BROWSE: the
 * screen lists everything under the search bar before anything is typed, so this
 * hands back the whole (capped) list rather than nothing. `tokens.length === 0`
 * is what the caller reads to tell "no match for what you typed" apart from
 * "nothing indexed" — the two remaining empty states.
 */
export async function searchMaterialPrices({ user, query, limit = 25 }) {
    const tokens = buildSearchTokens(query);

    const { materials, truncated } = await searchMaterials(tokens, { limit });
    if (materials.length === 0) return { tokens, materials: [], truncated: false };

    const prices = await getPricesForMaterials(materials.map((m) => m.id));

    // The source POs behind those prices, then exactly those POs' lines — not
    // every line each material ever had.
    const pos = await getPOsByRecordIds(prices.flatMap((p) => p.latestPO));
    const posById = indexBy(pos);

    const [poItems, prs, vendors, jobs] = await Promise.all([
        getPOItemsByRecordIds(pos.flatMap((po) => po.poItems)),
        getPRsByRecordIds(pos.flatMap((po) => po.pr || [])),
        getAllVendors(),
        getAllJobs(),
    ]);

    const prsById = indexBy(prs);
    const vendorsById = indexBy(vendors);
    const jobsById = indexBy(jobs);

    // (po, material) -> the line that priced it. A PO can hold two lines of one
    // material (split quantities), and materialsCache caches the LAST line's
    // price, so the last match is the one that agrees with the cached figure.
    const lineByPoAndMaterial = new Map();
    for (const item of poItems) {
        const key = `${item.po[0]}::${item.material[0]}`;
        lineByPoAndMaterial.set(key, item);
    }

    const groups = materials.map((material) => {
        const rows = prices
            .filter((p) => p.material[0] === material.id)
            .map((price) => {
                const po = price.latestPO[0] ? posById.get(price.latestPO[0]) : null;
                const line = po ? lineByPoAndMaterial.get(`${po.id}::${material.id}`) : null;
                const { visible, pr } = po ? identifierVisibility(user, po, prsById) : { visible: false, pr: null };

                return {
                    id: price.id,
                    vendorName: vendorsById.get(price.vendor[0])?.vendorName ?? "Unknown vendor",
                    unitPrice: price.unitPrice,
                    latestDate: price.latestDate,
                    // The quantity that price was struck at. Blank when the
                    // pricing line cannot be located — see the note below.
                    qty: line?.qty,
                    // Status labels the row; the price is shown either way,
                    // because upsertMaterialPrice writes at PO-generation time
                    // and a withdrawn or unsigned PO can hold the newest price.
                    poStatus: line?.poStatus || po?.status || "",
                    identifiers: visible
                        ? {
                              poId: po?.poId ?? null,
                              poRecordId: po?.id ?? null,
                              prId: pr?.prId ?? null,
                              jobCode: jobsById.get(pr?.job?.[0])?.jobCode ?? null,
                          }
                        : null,
                };
            });

        return { material, rows: sortVendorRows(rows) };
    });

    return { tokens, materials: groups, truncated };
}

/**
 * One material's full purchase history, newest first — every PO line recorded
 * for it, including lines whose PO was withdrawn.
 *
 * Withdrawn lines are INCLUDED and marked rather than filtered out, for the same
 * reason the comparison rows show status: the line is a real thing that happened,
 * and "we ordered this and then canceled" is information a buyer wants. Whether
 * it counts toward the order book is #18's `Committed Qty`, carried on the row
 * and read by lib/poItemQty.js:countsAsOrdered — not re-derived here.
 *
 * Returns null when the material does not exist, so the caller can render the
 * ordinary not-found text.
 */
export async function getMaterialPurchaseHistory({ user, materialRecordId }) {
    let material;
    try {
        material = await getMaterialByRecordId(materialRecordId);
    } catch {
        // A bad or deleted record id — indistinguishable from "no such
        // material" to the viewer, and it must read that way.
        return null;
    }
    if (!material) return null;

    const poItems = await getPOItemsByRecordIds(material.poItems);
    const pos = await getPOsByRecordIds(poItems.flatMap((i) => i.po));
    const posById = indexBy(pos);

    const [prs, vendors, jobs] = await Promise.all([
        getPRsByRecordIds(pos.flatMap((po) => po.pr || [])),
        getAllVendors(),
        getAllJobs(),
    ]);
    const prsById = indexBy(prs);
    const vendorsById = indexBy(vendors);
    const jobsById = indexBy(jobs);

    const rows = poItems.map((item) => {
        const po = item.po[0] ? posById.get(item.po[0]) : null;
        const { visible, pr } = po ? identifierVisibility(user, po, prsById) : { visible: false, pr: null };
        // Vendor is a Lookup on the PO (through its PR), so it is an array of
        // Vendor record ids like every other link field here.
        const vendorRecordId = po?.vendor?.[0];

        return {
            id: item.id,
            date: po?.createdDate ?? null,
            vendorName: vendorsById.get(vendorRecordId)?.vendorName ?? "Unknown vendor",
            qty: item.qty,
            unitPrice: item.unitPrice,
            amount: item.amount,
            poStatus: item.poStatus || po?.status || "",
            committedQty: item.committedQty,
            identifiers: visible
                ? {
                      poId: po?.poId ?? null,
                      poRecordId: po?.id ?? null,
                      prId: pr?.prId ?? null,
                      jobCode: jobsById.get(pr?.job?.[0])?.jobCode ?? null,
                  }
                : null,
            // Sort key only, stripped below. The PO ID is a gated identifier, so
            // it must not survive on the row an ungated caller could render or
            // hand to a Client Component — but the tie-break needs it, since
            // Created Date is calendar-only.
            poId: po?.poId ?? null,
        };
    });

    // Sort while the key is present, then drop it, so no ungated copy of a
    // document identifier leaves this module.
    const sorted = sortHistoryRows(rows).map(({ poId, ...row }) => row);

    return { material, rows: sorted };
}

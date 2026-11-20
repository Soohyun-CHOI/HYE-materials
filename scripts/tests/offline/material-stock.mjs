// A job's material stock is computed from its deliveries and its log, and an issue never takes
// an address below zero (#675).
//
// WHAT IT HOLDS, from `lib/materialStock.js`, the rule both the screens and the writes ask:
//   1. WHO: an Admin on every job, a site manager on their own — and neither an assigned
//      employee who is not a site manager, nor the President by role alone, nor a President
//      who manages a site on a job they are not assigned to: the three the delivery rule
//      (`canAccessJobDeliveries`) admits that this one does not.
//   2. THE FOLD: a delivery's quantity is stock at ITS address, a log row's `Qty` is a change
//      at its own, `Issued` is the negative of its rows, `Ordered` is the job's and counts what
//      `countsAsOrdered` counts — and a delivery or a row naming no address throws rather than
//      vanishing from the count.
//   3. THE VIEW BY ADDRESS is offered at two addresses holding material, not at one, and an
//      address whose stock is back at zero does not count.
//   4. AN ISSUE'S REFUSALS, each a key the copy holds, and a quantity is a whole number above 0.
//   5. A DELIVERY TAKEN OFF ITS ADDRESS — deleted, or its address corrected (#680): one whose
//      quantity has since been issued is named; one that leaves every count at zero or above is
//      not. And after a correction's write, a material left below zero where it stood is found.
//   6. THE WRITE'S SHAPE, by source: the action asks `canAccessJobInventory` before
//      `recordIssue`; `recordIssue` reads the stock again after its write and takes its own row
//      back; `createDelivery` refuses a delivery with no address before it mints an id; and the
//      delete path asks the shortfall before its first destroy.
//
// WHAT IT CANNOT SEE: whether two processes really race as the module header says — that is a
// fact about Airtable and Vercel, and the pull request says what was measured — and anything a
// page renders.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import {
    INVENTORY_COPY,
    MATERIAL_LOG_EVENTS,
    belowZeroAt,
    canAccessJobInventory,
    foldJobInventory,
    inventoryRows,
    issueRefusal,
    materialActivity,
    offersAddressView,
    readQty,
    shortfallWithout,
    stockAt,
} from "../../../lib/materialStock.js";
import { repoPath } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A job's material stock, computed, and an issue never below zero (#675)";

const JOB = "recJOB";
const OTHER_JOB = "recOTHER";
const A = "recADDRA";
const B = "recADDRB";
const PIPE = "recPIPE";
const ELBOW = "recELBOW";

const deliveries = [
    { id: "recDL1", deliveryId: "HYE-DL-261119-01", deliveryAddress: [A], receivedDate: "2026-11-10", createdAt: "2026-11-10T15:00:00.000Z", recordedBy: ["recU1"] },
    { id: "recDL2", deliveryId: "HYE-DL-261119-02", deliveryAddress: [B], receivedDate: "2026-11-12", createdAt: "2026-11-12T15:00:00.000Z", recordedBy: ["recU1"] },
];
const deliveryItems = [
    { id: "recDI1", delivery: ["recDL1"], material: [PIPE], qty: 10 },
    { id: "recDI2", delivery: ["recDL1"], material: [PIPE], qty: 2 },
    { id: "recDI3", delivery: ["recDL2"], material: [PIPE], qty: 5 },
    { id: "recDI4", delivery: ["recDL2"], material: [ELBOW], qty: 4 },
];
const issued = (id, address, material, qty, eventDate = "2026-11-15") => ({
    id,
    materialLogId: id,
    address: [address],
    material: [material],
    event: MATERIAL_LOG_EVENTS.ISSUED,
    qty: -qty,
    eventDate,
    recordedAt: `${eventDate}T18:00:00.000Z`,
    recordedBy: ["recU2"],
});
const logEntries = [issued("recML1", A, PIPE, 3), issued("recML2", B, ELBOW, 4, "2026-11-16")];
const orderedItems = [
    { materialRecordId: PIPE, qty: 20, orderedQty: 20 },
    { materialRecordId: PIPE, qty: 7, orderedQty: 0 },
    { materialRecordId: ELBOW, qty: 4, orderedQty: 4 },
];

const throwsOn = (fn) => {
    try {
        fn();
        return false;
    } catch {
        return true;
    }
};

export function run({ check, assert, log }) {
    log("1. who:");
    const user = (fields) => ({ id: "recU", assignedJobs: [JOB], ...fields });
    check("  an Admin on a job they are not assigned to", canAccessJobInventory(user({ isAdmin: true, assignedJobs: [] }), JOB), true);
    check("  a site manager on their own job", canAccessJobInventory(user({ isSiteManager: true }), JOB), true);
    check("  a site manager on another job", canAccessJobInventory(user({ isSiteManager: true }), OTHER_JOB), false);
    check("  an employee assigned to the job who is no site manager", canAccessJobInventory(user({}), JOB), false);
    check("  the President, by role alone", canAccessJobInventory(user({ role: "President", assignedJobs: [] }), JOB), false);
    check(
        "  a President who manages a site, on a job they are not assigned to",
        canAccessJobInventory(user({ role: "President", isSiteManager: true }), OTHER_JOB),
        false
    );
    check("  no reader", canAccessJobInventory(null, JOB), false);
    check("  no job", canAccessJobInventory(user({ isAdmin: true }), null), false);

    log("2. the fold:");
    const inventory = foldJobInventory({ deliveries, deliveryItems, logEntries, orderedItems });
    const pipe = inventory.get(PIPE);
    check("  pipe ordered, the withdrawn order left out", pipe.ordered, 20);
    check("  pipe delivered at both addresses", pipe.delivered, 17);
    check("  pipe issued, as a positive figure", pipe.issued, 3);
    check("  pipe in stock", pipe.inStock, 14);
    check("  pipe at A: both items of the first delivery, less what was issued there", stockAt(inventory, PIPE, A), 9);
    check("  pipe at B: the second delivery's alone", stockAt(inventory, PIPE, B), 5);
    check("  elbow at B, all of it issued", stockAt(inventory, ELBOW, B), 0);
    check("  elbow at A, where nothing was recorded", stockAt(inventory, ELBOW, A), 0);
    check("  a material only ordered still has its row", foldJobInventory({ orderedItems }).has(ELBOW), true);
    assert(
        "  a delivery naming no address throws",
        throwsOn(() => foldJobInventory({ deliveries: [{ ...deliveries[0], deliveryAddress: [] }], deliveryItems }))
    );
    assert(
        "  a log row naming no address throws",
        throwsOn(() => foldJobInventory({ deliveries, deliveryItems, logEntries: [{ ...logEntries[0], address: [] }] }))
    );
    const counted = foldJobInventory({
        deliveries,
        deliveryItems,
        logEntries: [{ ...issued("recML9", A, PIPE, 1), event: MATERIAL_LOG_EVENTS.COUNT_EDITED, qty: 2 }],
    });
    check("  a row of another event moves the stock and is not counted as issued", `${stockAt(counted, PIPE, A)} ${counted.get(PIPE).issued}`, "14 0");

    log("3. the view by address:");
    check("  two addresses holding material", offersAddressView(inventory), true);
    check(
        "  one address holding material, the other emptied by an issue",
        offersAddressView(foldJobInventory({ deliveries, deliveryItems: deliveryItems.slice(0, 2).concat([deliveryItems[3]]), logEntries: [logEntries[1]] })),
        false
    );
    const { rows, groups } = inventoryRows({
        inventory,
        materialById: new Map([
            [PIPE, { itemName: "Pipe", size: "2\"", unit: "EA" }],
            [ELBOW, { itemName: "Elbow", size: "2\"", unit: "EA" }],
        ]),
        addressLabelById: new Map([
            [A, "Yard"],
            [B, "Gate 3"],
        ]),
    });
    check("  the list by label", rows.map((r) => r.label).join(" | "), 'Elbow 2" | Pipe 2"');
    check("  the groups by label, an address holding material each", groups.map((g) => `${g.label}:${g.rows.length}`).join(" "), "Gate 3:2 Yard:1");

    log("4. an issue's refusals:");
    const ok = { addressRecordId: A, qty: 3, eventDate: "2026-11-19", inStock: 3 };
    check("  all of what is there", issueRefusal(ok), null);
    check("  more than is there", issueRefusal({ ...ok, qty: 4 }), "more-than-stock");
    check("  no address", issueRefusal({ ...ok, addressRecordId: "" }), "no-address");
    check("  zero", issueRefusal({ ...ok, qty: 0 }), "not-a-quantity");
    check("  a fraction", issueRefusal({ ...ok, qty: readQty("1.5") }), "not-a-quantity");
    check("  no date", issueRefusal({ ...ok, eventDate: "" }), "no-date");
    check("  a typed quantity with spaces round it", readQty(" 12 "), 12);
    check("  a typed quantity with a word in it", Number.isNaN(readQty("12 EA")), true);
    const keys = ["no-address", "not-a-quantity", "no-date", "more-than-stock", "not-allowed", "failed"];
    check("  every refusal has its words", keys.filter((k) => !INVENTORY_COPY.refusals[k]).join(" ") || "none", "none");

    log("5. a delivery taken off its address, and what is below zero after:");
    check("  a delivery whose quantity has been issued", JSON.stringify(shortfallWithout({ inventory, delivery: deliveries[0], items: deliveryItems.slice(0, 2) })), JSON.stringify([{ materialRecordId: PIPE, addressRecordId: A, after: -3 }]));
    check("  a delivery whose quantity is still all there", shortfallWithout({ inventory, delivery: deliveries[1], items: [deliveryItems[2]] }).length, 0);
    check(
        "  a delivery of a material issued to zero",
        shortfallWithout({ inventory, delivery: deliveries[1], items: [deliveryItems[3]] }).map((s) => `${s.materialRecordId}:${s.after}`).join(" "),
        `${ELBOW}:-4`
    );
    // #680 — once a correction has moved a delivery, its old address no longer counts it, so the
    // read after the write asks what stands below zero there now, among the delivery's materials.
    const movedOff = foldJobInventory({ deliveries: [deliveries[0], { ...deliveries[1], deliveryAddress: [A] }], deliveryItems, logEntries });
    check(
        "  after a correction: what the address it left holds below zero, among its materials",
        belowZeroAt({ inventory: movedOff, materialRecordIds: [PIPE, ELBOW, ELBOW], addressRecordId: B }).map((s) => `${s.materialRecordId}:${s.after}`).join(" "),
        `${ELBOW}:-4`
    );
    check("  and nothing where every count stands at zero or above", belowZeroAt({ inventory, materialRecordIds: [PIPE, ELBOW], addressRecordId: B }).length, 0);
    check("  nor for a material the delivery does not hold", belowZeroAt({ inventory: movedOff, materialRecordIds: [PIPE], addressRecordId: B }).length, 0);

    log("activity, newest first, quantities unsigned:");
    const activity = materialActivity({ materialRecordId: PIPE, deliveries, deliveryItems, logEntries });
    check("  pipe's three rows", activity.map((r) => `${r.date} ${r.kind} ${r.qty}`).join(" | "), "2026-11-15 Issued 3 | 2026-11-12 delivered 5 | 2026-11-10 delivered 12");

    log("6. the write's shape, by source:");
    const action = readFileSync(repoPath("app/materials/[jobCode]/[materialId]/actions.js"), "utf8");
    const asks = action.indexOf("canAccessJobInventory(user");
    check("  the action asks who before it records", asks > 0 && asks < action.indexOf("recordIssue("), true);
    const server = readFileSync(repoPath("lib/materialStock.server.js"), "utf8");
    const body = server.slice(server.indexOf("export async function recordIssue"));
    const written = body.indexOf("createMaterialLogEntry(");
    check("  the issue reads the stock before its write", body.indexOf("stockNow()") > 0 && body.indexOf("stockNow()") < written, true);
    check("  and again after it", body.indexOf("stockNow()", written) > written, true);
    check("  and takes its own row back when that is below zero", body.indexOf("takeBackMaterialLogEntry(entry.id)", written) > written, true);
    check("  under a lock on the job, the address and the material", /withKeyLock\(`material-stock::\$\{jobRecordId\}::\$\{addressRecordId\}::\$\{materialRecordId\}`/.test(body), true);
    const deliveriesModule = readFileSync(repoPath("lib/airtable/deliveries.js"), "utf8");
    const create = deliveriesModule.slice(deliveriesModule.indexOf("export async function createDelivery"));
    const refuses = create.indexOf("if (!deliveryAddressRecordId) throw");
    check("  createDelivery refuses no address before it mints an id", refuses > 0 && refuses < create.indexOf("generateNextDeliveryId("), true);
    const deleting = readFileSync(repoPath("lib/deliveryDelete.js"), "utf8");
    const del = deleting.slice(deleting.indexOf("export async function deleteDeliveryAsUser"));
    const short = del.indexOf("readShortfallWithout(");
    check("  the delete asks the shortfall before its first destroy", short > 0 && short < del.indexOf(".destroy("), true);
}

if (isMain(import.meta.url)) standalone(title, run);

// A material's count edited at an address, with a reason (#678): what the edit does to the stock,
// what the activity and the form say about it, why one is refused, and the shape of its write.
//
// WHAT IT HOLDS, from `lib/materialStock.js` and the sources that use it:
//   1. THE STOCK: a Count edited row moves its address's stock by its signed `Qty`, either way, and
//      `Count edited` carries that change signed — so a row adds up, delivered + received - issued
//      - sent + count edited, on the job and at each address. The column is drawn once any edit
//      moved anything, at the job or at one address, and not on a job never edited.
//   2. THE ACTIVITY: an edit says the count before — its count less its change — and after, and its
//      reason, and carries its notes; an address below zero reads as it was.
//   3. EACH REFUSAL: no address, a count that is not a whole number of 0 or more, a reason the select
//      does not hold — and, once the stock is read, a stock that is not the figure the page drew, or
//      a count that is the stock already. A count of 0 puts an address below zero right.
//   4. THE FORM'S PREVIEW is the writer's subtraction, said with its sign before the press.
//   5. WHERE: every address the material's stock table draws, at zero and below zero too.
//   6. THE WRITE'S SHAPE, by source: under the stock's lock, the stock read before the write and
//      again after, the change the count less the stock before, and the row taken back unless the
//      address stands at the count; the writer refusing a row carrying the wrong fields for its
//      event; the action asking who before it records and handing today the reader's zone; the form
//      sending the figure it drew and the zone.
//
// WHAT IT CANNOT SEE: whether two processes race as the module header says — that was raced on the
// test base and is in the pull request — and anything a page renders.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import {
    INVENTORY_COPY,
    MATERIAL_LOG_EVENTS,
    MATERIAL_LOG_REASONS,
    activityWords,
    countEditAddresses,
    countEditChange,
    countEditRefusal,
    countWasEdited,
    foldJobInventory,
    inventoryRows,
    materialActivity,
    readFigure,
    readQty,
    showsCountEdits,
    signedQtyText,
    stockAt,
} from "../../../lib/materialStock.js";
import { callsTo, parseFile, repoPath, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A material's count edited at an address, with a reason (#678)";

const E = MATERIAL_LOG_EVENTS;
const JOB = "recJOB";
const A = "recADDRA";
const B = "recADDRB";
const PIPE = "recPIPE";
const VALVE = "recVALVE";
const U = "recU1";

const row = (id, event, qty, address, extra = {}) => ({
    id,
    materialLogId: id.replace("rec", "ML-"),
    event,
    qty,
    job: [JOB],
    address: [address],
    material: [PIPE],
    eventDate: "2026-11-20",
    recordedBy: [U],
    recordedAt: "2026-11-20T15:00:00.000Z",
    destinationJob: [],
    destinationAddress: [],
    send: [],
    settledBy: [],
    reason: null,
    countedQty: null,
    notes: "",
    ...extra,
});

// 20 delivered at A, 2 issued, then counted at 15 — 3 damaged. B had 4 delivered and 6 issued
// (two issues raced), so it stood at -2 until it was counted at 0.
const deliveries = [
    { id: "recDL1", deliveryId: "HYE-DL-261120-01", deliveryAddress: [A], receivedDate: "2026-11-18", createdAt: "2026-11-18T12:00:00.000Z" },
    { id: "recDL2", deliveryId: "HYE-DL-261120-02", deliveryAddress: [B], receivedDate: "2026-11-18", createdAt: "2026-11-18T13:00:00.000Z" },
];
const deliveryItems = [
    { id: "recDI1", delivery: ["recDL1"], material: [PIPE], qty: 20 },
    { id: "recDI2", delivery: ["recDL2"], material: [PIPE], qty: 4 },
];
const I1 = row("recI1", E.ISSUED, -2, A);
const C1 = row("recC1", E.COUNT_EDITED, -3, A, { countedQty: 15, reason: "Damaged or lost", notes: "Three bent in the rack.", recordedAt: "2026-11-20T16:00:00.000Z" });
const I2 = row("recI2", E.ISSUED, -3, B);
const I3 = row("recI3", E.ISSUED, -3, B);
const C2 = row("recC2", E.COUNT_EDITED, 2, B, { countedQty: 0, reason: "Physical count", recordedAt: "2026-11-20T17:00:00.000Z" });

const ADDRESS_LABELS = new Map([
    [A, "Yard"],
    [B, "Annex"],
]);
const label = (id) => ADDRESS_LABELS.get(id) ?? id;

export function run({ check, assert, log }) {
    // ── 1: the stock ─────────────────────────────────────────────────────────
    log("what a count edit does to the stock:");
    const inventory = foldJobInventory({ deliveries, deliveryItems, logEntries: [I1, C1, I2, I3, C2] });
    const pipe = inventory.get(PIPE);
    const at = (address) => pipe.byAddress.get(address);
    check("an edit sets its address to the count", `${stockAt(inventory, PIPE, A)} ${stockAt(inventory, PIPE, B)}`, "15 0");
    check("  and its column carries the change, signed, at each address and on the job", [at(A).countEdited, at(B).countEdited, pipe.countEdited].join(" "), "-3 2 -1");
    const adds = (f) => f.delivered + f.received - f.issued - f.sent + f.countEdited === f.inStock;
    check("so every row adds up: delivered + received - issued - sent + count edited", [adds(pipe), adds(at(A)), adds(at(B))].join(" "), "true true true");
    const listed = inventoryRows({ inventory, materialById: new Map([[PIPE, { id: PIPE, itemName: "Pipe", unit: "EA" }]]), addressLabelById: ADDRESS_LABELS });
    // An address at 0 holds no material and draws no group (#675), so the Annex, counted to 0, has none.
    check("  and the list's rows carry it, on the job and in each group it draws", [listed.rows[0].countEdited, ...listed.groups.map((g) => `${g.label} ${g.rows[0].countEdited}`)].join(" "), "-1 Yard -3");
    check("the column is drawn once a job has an edit", showsCountEdits(inventory), true);
    check("  and not on a job never edited", showsCountEdits(foldJobInventory({ deliveries, deliveryItems, logEntries: [I1, I2] })), false);
    const canceling = foldJobInventory({ deliveries, deliveryItems, logEntries: [row("recC3", E.COUNT_EDITED, 2, A, { countedQty: 22, reason: "Recorded wrong" }), row("recC4", E.COUNT_EDITED, -2, B, { countedQty: 2, reason: "Recorded wrong" })] });
    check("  nor hidden where two edits cancel out on the job but each moved an address", [canceling.get(PIPE).countEdited, countWasEdited(canceling.get(PIPE)), showsCountEdits(canceling)].join(" "), "0 true true");

    // ── 2: the activity ──────────────────────────────────────────────────────
    log("");
    log("what the activity says:");
    const activity = materialActivity({ materialRecordId: PIPE, deliveries, deliveryItems, logEntries: [I1, C1, I2, I3, C2] });
    const edit = activity.find((r) => r.key === "recC1");
    const fromBelow = activity.find((r) => r.key === "recC2");
    check("an edit's count, the count it replaced, its reason and notes", [edit.countedQty, edit.formerQty, edit.reason, edit.notes].join(" | "), "15 | 18 | Damaged or lost | Three bent in the rack.");
    check("  in words", activityWords(edit, "EA"), "Count edited from 18 to 15 EA · Damaged or lost");
    check("  an address below zero reads as it was", activityWords(fromBelow, "EA"), "Count edited from -2 to 0 EA · Physical count");
    check("  a delivery and an issue carry no count or notes", activity.filter((r) => r.kind !== E.COUNT_EDITED).map((r) => `${r.countedQty}/${r.formerQty}/${r.notes}`).join(" "), "null/null/ null/null/ null/null/ null/null/ null/null/");

    // ── 3: each refusal ──────────────────────────────────────────────────────
    log("");
    log("why an edit is refused:");
    const ask = (over) => countEditRefusal({ addressRecordId: A, countedQty: 15, reason: "Physical count", shownQty: 18, ...over });
    check("no address", ask({ addressRecordId: "" }), "no-address");
    check("a count that is not a whole number of 0 or more", [ask({ countedQty: -1 }), ask({ countedQty: 1.5 }), ask({ countedQty: Number.NaN })].join(" "), "not-a-count not-a-count not-a-count");
    check("a reason the select does not hold", [ask({ reason: "" }), ask({ reason: "Stolen" }), ask({ reason: "physical count" })].join(" "), "no-reason no-reason no-reason");
    check("before the stock is read, nothing else", ask({}), null);
    check("a stock that is not the figure the page drew", [ask({ inStock: 17 }), ask({ shownQty: Number.NaN, inStock: 18 })].join(" "), "changed changed");
    check("a count that is the stock already", ask({ countedQty: 18, inStock: 18 }), "same-count");
    check("a count of 0 puts an address below zero right", countEditRefusal({ addressRecordId: B, countedQty: 0, reason: "Physical count", shownQty: -2, inStock: -2 }), null);
    check(
        "every refusal has its sentence",
        ["no-address", "not-a-count", "no-reason", "changed", "same-count", "raced", "not-allowed", "failed"].filter((key) => !INVENTORY_COPY.countEdit.refusals[key]).join(" "),
        ""
    );
    check("the reasons are the select's four, in its order", MATERIAL_LOG_REASONS.join(" | "), "Recorded wrong | Damaged or lost | Returned to the vendor | Physical count");
    check("a figure the page drew is read below zero too, a typed count is not", [readFigure("-2"), readFigure(" 7 "), readQty("-2")].map(String).join(" "), "-2 7 NaN");

    // ── 4: the preview ───────────────────────────────────────────────────────
    log("");
    log("what the form says before the press:");
    check("the change is the count less the stock drawn", [countEditChange({ counted: 15, inStock: 18 }), countEditChange({ counted: 0, inStock: -2 }), countEditChange({ counted: 18, inStock: 18 })].join(" "), "-3 2 0");
    check("  and nothing while there is no address or no count a press takes", [countEditChange({ counted: 15, inStock: undefined }), countEditChange({ counted: Number.NaN, inStock: 18 }), countEditChange({ counted: -1, inStock: 18 })].join(" "), "  ");
    check("  said with its sign", [signedQtyText(-3, "EA"), signedQtyText(2, "EA"), signedQtyText(0, "")].join(" | "), "-3 EA | +2 EA | 0");
    check("  in a sentence", [INVENTORY_COPY.countEdit.change(signedQtyText(-3, "EA")), INVENTORY_COPY.countEdit.noChange].join(" | "), "Change to record: -3 EA | That is the count now. Nothing would change.");

    // ── 5: where ─────────────────────────────────────────────────────────────
    log("");
    log("where a count may be edited:");
    const before = foldJobInventory({ deliveries, deliveryItems, logEntries: [I1, I2, I3] });
    check("every address the stock table draws, below zero too, by label", countEditAddresses(before.get(PIPE), label).map((a) => `${a.label} ${a.inStock}`).join(", "), "Annex -2, Yard 18");
    check("  and none for a material with no address", countEditAddresses({ byAddress: new Map() }, label).length, 0);
    check("  nor for one the job does not hold", countEditAddresses(before.get(VALVE), label).length, 0);

    // ── 6: the write's shape ─────────────────────────────────────────────────
    log("");
    log("the write, by its source:");
    const server = parseFile("lib/materialStock.server.js");
    const text = (node) => (node ? server.source.slice(node.start, node.end) : "");
    const record = text(resolveFunction(server.ast, "recordCountEdit"));
    const written = record.indexOf("createMaterialLogEntry(");
    check("an edit takes the stock's lock", /withKeyLock\(stockLockKey\(jobRecordId, addressRecordId, materialRecordId\)/.test(record), true);
    check("  reads the stock before its write and again after", [record.indexOf("stockNow()") > 0 && record.indexOf("stockNow()") < written, record.indexOf("stockNow()", written) > written].join(" "), "true true");
    check("  asks again under the lock, with the stock read", /countEditRefusal\(\{[^}]*inStock: before \}\)/.test(record), true);
    check("  records the count less the stock before", /qty: countedQty - before,/.test(record), true);
    check("  and stands only where the address is at the count", [/if \(after === countedQty\) return \{ ok: true, entry \}/.test(record), record.indexOf("takeBackMaterialLogEntry(entry.id)", written) > written, /refusal: "raced"/.test(record)].join(" "), "true true true");
    const writer = readFileSync(repoPath("lib/airtable/materialLog.js"), "utf8");
    check(
        "the writer refuses an edit with no count or reason, and any other row carrying one",
        [
            /counted && \(!Number\.isInteger\(countedQty\) \|\| countedQty < 0\)/.test(writer),
            /counted && !MATERIAL_LOG_REASONS\.includes\(reason\)/.test(writer),
            /!counted && \(countedQty !== null \|\| reason !== null \|\| note !== ""\)/.test(writer),
        ].join(" "),
        "true true true"
    );
    check("  and writes the count, the reason and the notes on an edit alone", /\.\.\.\(counted \? \{ "Counted Qty": countedQty, Reason: reason, \.\.\.\(note \? \{ Notes: note \} : \{\}\) \} : \{\}\)/.test(writer), true);
    check("  and reads them back", [/countedQty: record\.get\("Counted Qty"\) \?\? null/.test(writer), /notes: record\.get\("Notes"\) \?\? ""/.test(writer)].join(" "), "true true");

    const actions = parseFile("app/materials/[jobCode]/[materialId]/actions.js");
    const action = resolveFunction(actions.ast, "editCountAction");
    const asks = callsTo(action ?? {}, "canAccessJobInventory")[0];
    const records = callsTo(action ?? {}, "recordCountEdit")[0];
    check("the action asks who before it records", Boolean(asks && records && asks.start < records.start), true);
    check("  hands today the reader's zone", callsTo(action ?? {}, "todayIn").length, 1);
    check("  reads the figure drawn as a figure and the count as a typed one", [callsTo(action ?? {}, "readFigure").length, callsTo(action ?? {}, "readQty").length].join(" "), "1 1");

    const form = readFileSync(repoPath("app/materials/[jobCode]/[materialId]/EditCountForm.js"), "utf8");
    check(
        "the form sends the figure it drew and its zone",
        [/name="shownQty" value=\{at \? String\(at\.inStock\) : ""\}/.test(form), /name="timeZone" value=\{timeZone\}/.test(form), /const timeZone = useReaderTimeZone\(\);/.test(form)].join(" "),
        "true true true"
    );
    check("  and says the change through the writer's subtraction", [/countEditChange\(\{ counted: readQty\(counted\), inStock: at\?\.inStock \}\)/.test(form), /signedQtyText\(change, unit\)/.test(form)].join(" "), "true true");
    const page = readFileSync(repoPath("app/materials/[jobCode]/[materialId]/page.js"), "utf8");
    assert("the page offers it at every address its stock table draws", /addresses=\{countEditAddresses\(stock, label\)\}/.test(page));
}

if (isMain(import.meta.url)) standalone(title, run);

// Material sent between addresses and received there (#677): what is in transit, the stock it
// leaves and reaches, who records each act, and why one is refused.
//
// WHAT IT HOLDS, from `lib/materialTransit.js` and `lib/materialStock.js`'s fold:
//   1. THE STOCK: a Sent row is the address it left giving it up, a Received row the destination
//      taking it in, a Send canceled row the address it left taking it back — and a WRITTEN OFF ROW
//      MOVES NO ADDRESS'S STOCK, nor does a receipt or a cancel whose Sent row is gone. `Received`
//      and `Sent` count as quantities, so a row adds up: delivered + received - issued - sent.
//   2. IN TRANSIT: what was sent less what was received, canceled and written off, read through the
//      Sent row's reverse link; out at the address it left and in at the address it goes to, a send
//      between two of one job's addresses both; and an address holding only what is on its way is
//      an address the view by address shows.
//   3. THE READS' CONTRACT: a settling row the caller never read throws; one asked for and gone (taken
//      back between two reads) counts for nothing.
//   4. WHO: sending and canceling are the sending job's, receiving the destination's, writing off the
//      office's alone.
//   5. WHERE A SEND MAY GO: an open job's address, the sending job's first.
//   6. EACH REFUSAL, and the reader's today in the zone their press sent.
//   7. THE WRITES' SHAPE, by source: a send takes the stock's lock and reads the stock after its
//      write as an issue does; a receipt, a cancel and a write-off take the send's lock, read the send
//      before and after, and take their row back when it is gone or over-settled; the forms send the
//      reader's zone.
//
// WHAT IT CANNOT SEE: whether two processes race as the module headers say — that was measured on
// the test base and is in the pull request — and anything a page renders.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { MATERIAL_LOG_EVENTS, foldJobInventory, inventoryRows, offersAddressView, settlesASend, showsTransit, stockAt } from "../../../lib/materialStock.js";
import {
    TRANSIT_COPY,
    canCancel,
    canReceive,
    canSendFrom,
    canWriteOff,
    cancelRefusal,
    destinationChoices,
    destinationRefusal,
    forgetGone,
    jobSends,
    receiveRefusal,
    sendRefusal,
    sendsOf,
    todayIn,
    transitActivityWords,
    unreadSettlingIds,
    writeOffRefusal,
} from "../../../lib/materialTransit.js";
import { callsTo, parseFile, repoPath, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Material sent between addresses, in transit until received (#677)";

const E = MATERIAL_LOG_EVENTS;
const JOB = "recJOB";
const OTHER = "recOTHER";
const A = "recADDRA"; // JOB's
const B = "recADDRB"; // JOB's
const C = "recADDRC"; // OTHER's
const PIPE = "recPIPE";
const U = "recU1";

const row = (id, event, qty, job, address, extra = {}) => ({
    id,
    materialLogId: id.replace("rec", "ML-"),
    event,
    qty,
    job: [job],
    address: [address],
    material: [PIPE],
    eventDate: "2026-11-18",
    recordedBy: [U],
    recordedAt: "2026-11-18T15:00:00.000Z",
    destinationJob: [],
    destinationAddress: [],
    send: [],
    settledBy: [],
    ...extra,
});

// Sent 10 from A to OTHER's C on the 18th: 6 received there, 1 canceled back, 3 written off.
const S1 = row("recS1", E.SENT, -10, JOB, A, { destinationJob: [OTHER], destinationAddress: [C], settledBy: ["recR1", "recX1", "recW1"] });
const R1 = row("recR1", E.RECEIVED, 6, OTHER, C, { send: ["recS1"], eventDate: "2026-11-19" });
const X1 = row("recX1", E.SEND_CANCELED, 1, JOB, A, { send: ["recS1"] });
const W1 = row("recW1", E.WRITTEN_OFF, -3, JOB, A, { send: ["recS1"] });
// Sent 4 from A to JOB's own B: 1 received, 3 still on the way.
const S2 = row("recS2", E.SENT, -4, JOB, A, { destinationJob: [JOB], destinationAddress: [B], settledBy: ["recR2"], eventDate: "2026-11-19" });
const R2 = row("recR2", E.RECEIVED, 1, JOB, B, { send: ["recS2"] });
const I1 = row("recI1", E.ISSUED, -2, JOB, A);
// A receipt whose Sent row was taken back: its `Send` link emptied with the row.
const ORPHAN = row("recR3", E.RECEIVED, 5, JOB, B);

const deliveries = [{ id: "recDL1", deliveryId: "HYE-DL-261118-01", deliveryAddress: [A] }];
const deliveryItems = [{ id: "recDI1", delivery: ["recDL1"], material: [PIPE], qty: 20 }];
const jobOwn = [S1, X1, W1, S2, R2, I1, ORPHAN];
const otherOwn = [R1];

const siteManagerOn = (jobs) => ({ id: "recSM", isAdmin: false, isSiteManager: true, assignedJobs: jobs });
const ADMIN = { id: "recADMIN", isAdmin: true, isSiteManager: false, assignedJobs: [] };
const PRESIDENT = { id: "recP", role: "President", isAdmin: false, isSiteManager: false, assignedJobs: [JOB] };

export function run({ check, assert, log }) {
    // ── 1-2: the stock and what is in transit ────────────────────────────────
    log("what was sent, received, canceled and written off:");
    const sends = sendsOf([...jobOwn, ...otherOwn]);
    const s1 = sends.find((s) => s.id === "recS1");
    const s2 = sends.find((s) => s.id === "recS2");
    check("a send's figures: sent, received, canceled, written off, left", [s1.qty, s1.received, s1.canceled, s1.writtenOff, s1.remaining].join(" "), "10 6 1 3 0");
    check("  a send between one job's addresses, part received", [s2.qty, s2.received, s2.remaining].join(" "), "4 1 3");
    check("  where each went and came from", [s1.fromJobRecordId, s1.fromAddressRecordId, s1.toJobRecordId, s1.toAddressRecordId].join(" "), `${JOB} ${A} ${OTHER} ${C}`);
    check("  and the day it was sent", s2.sentDate, "2026-11-19");
    check("every settling event and nothing else names a Sent row", Object.values(E).filter(settlesASend).join(" | "), "Received | Send canceled | Written off");

    const { outgoing, incoming } = jobSends(sends, JOB);
    check("the sends leaving a job and coming to it, a send between its own addresses in both", `${outgoing.map((s) => s.id).join(",")} / ${incoming.map((s) => s.id).join(",")}`, "recS1,recS2 / recS2");
    check("  the other job sees what was sent to it", jobSends(sends, OTHER).incoming.map((s) => s.id).join(","), "recS1");

    const inventory = foldJobInventory({ deliveries, deliveryItems, logEntries: jobOwn, outgoing, incoming });
    const at = (address) => inventory.get(PIPE).byAddress.get(address);
    log("");
    log("the stock it leaves and the stock it reaches:");
    check("a write-off moves no address's stock", stockAt(inventory, PIPE, A), 5);
    check("a receipt whose Sent row is gone adds nothing", stockAt(inventory, PIPE, B), 1);
    check(
        "the address it left: delivered, received, issued, sent less taken back, out",
        ["delivered", "received", "issued", "sent", "inTransitOut", "inTransitIn"].map((k) => at(A)[k]).join(" "),
        "20 0 2 13 3 0"
    );
    check("the address it reaches: received, in", ["received", "inTransitIn", "inTransitOut"].map((k) => at(B)[k]).join(" "), "1 3 0");
    const job = inventory.get(PIPE);
    check("the job's row adds up: delivered + received - issued - sent", job.delivered + job.received - job.issued - job.sent, job.inStock);
    check("  and its in-transit figures", `${job.inTransitOut} ${job.inTransitIn}`, "3 3");
    const other = foldJobInventory({ logEntries: otherOwn, ...jobSends(sends, OTHER) });
    check("the receiving job's stock is what it received", `${stockAt(other, PIPE, C)} ${other.get(PIPE).received}`, "6 6");
    const notYet = foldJobInventory({ logEntries: [], incoming: [{ ...s2, toJobRecordId: OTHER, toAddressRecordId: C }] });
    check("a material only on its way to a job is on its list, with none in stock", `${notYet.has(PIPE)} ${stockAt(notYet, PIPE, C)} ${notYet.get(PIPE)?.inTransitIn}`, "true 0 3");
    check("  and its address is one the view by address counts", offersAddressView(foldJobInventory({ deliveries, deliveryItems, logEntries: [], incoming: [{ ...s2, toJobRecordId: JOB }] })), true);
    check("a job that never sent or received draws no transit columns", showsTransit(foldJobInventory({ deliveries, deliveryItems, logEntries: [I1] })), false);
    check("  one that did, does", showsTransit(inventory), true);
    const rows = inventoryRows({ inventory, materialById: new Map(), addressLabelById: new Map() });
    check("a list row carries the transit figures", ["received", "sent", "inTransitOut", "inTransitIn"].map((k) => rows.rows[0][k]).join(" "), "1 13 3 3");

    // ── 3: the reads' contract ───────────────────────────────────────────────
    log("");
    log("a settling row is read, or known to be gone:");
    check("the settling rows still to read, of those a Sent row lists", unreadSettlingIds([S1, S2], ["recS1", "recS2", "recR2"]).join(","), "recR1,recX1,recW1");
    let threw = null;
    try {
        sendsOf([S1, X1, W1]);
    } catch (error) {
        threw = error.message;
    }
    check("a settling row never read throws", Boolean(threw && threw.includes("recR1")), true);
    threw = null;
    try {
        sendsOf([S2, { ...R2, send: ["recS1"] }]);
    } catch (error) {
        threw = error.message;
    }
    check("a row listed under another Sent row throws", Boolean(threw && threw.includes("does not settle")), true);
    let gone = "threw";
    try {
        const s = sendsOf(forgetGone([S1, X1, W1], ["recR1"])).find((x) => x.id === "recS1");
        gone = `${s.received} ${s.remaining}`;
    } catch {
        // a reader that does not forget the gone row throws on it, which is the failure
    }
    check("a row asked for and gone counts for nothing", gone, "0 6");
    check("  and nothing else is dropped", forgetGone([S1, X1], []).length, 2);

    // ── 4: who ───────────────────────────────────────────────────────────────
    log("");
    log("who records each act:");
    check(
        "a site manager on the sending job sends and cancels, on the receiving job receives",
        [canSendFrom(siteManagerOn([JOB]), JOB), canCancel(siteManagerOn([JOB]), s1), canReceive(siteManagerOn([OTHER]), s1)].join(" "),
        "true true true"
    );
    check(
        "  and not the other way round",
        [canSendFrom(siteManagerOn([OTHER]), JOB), canCancel(siteManagerOn([OTHER]), s1), canReceive(siteManagerOn([JOB]), s1)].join(" "),
        "false false false"
    );
    check("an Admin records every act on every job", [canSendFrom(ADMIN, OTHER), canCancel(ADMIN, s1), canReceive(ADMIN, s1), canWriteOff(ADMIN)].join(" "), "true true true true");
    check("a write-off is the office's alone", [canWriteOff(siteManagerOn([JOB])), canWriteOff(PRESIDENT), canWriteOff(null)].join(" "), "false false false");
    check("an assigned President who manages no site records nothing", [canSendFrom(PRESIDENT, JOB), canReceive(PRESIDENT, { ...s1, toJobRecordId: JOB })].join(" "), "false false");

    // ── 5: where a send may go ───────────────────────────────────────────────
    log("");
    log("where a send may go:");
    const jobs = [
        { id: OTHER, jobCode: "26-A", deliveryAddress: [] },
        { id: JOB, jobCode: "26-B", deliveryAddress: [A] },
        { id: "recSHUT", jobCode: "26-C", closedDate: "2026-11-01", deliveryAddress: [] },
        { id: "recBARE", jobCode: "26-D", deliveryAddress: [] },
    ];
    const addresses = [
        { id: A, addressLabel: "Yard A", jobs: [] },
        { id: B, addressLabel: "Yard B", jobs: [JOB] },
        { id: C, addressLabel: "Shop C", jobs: [OTHER] },
        { id: "recADDRD", addressLabel: "Shop D", jobs: ["recSHUT"] },
    ];
    const choices = destinationChoices({ jobs, addresses, fromJobRecordId: JOB });
    check(
        "the open jobs with an address, the sending job first, each with its addresses",
        choices.map((c) => `${c.jobCode}: ${c.addresses.map((a) => a.label).join(", ")}`).join(" | "),
        "26-B: Yard A, Yard B | 26-A: Shop C"
    );
    check("a closed destination is refused", destinationRefusal({ toJob: jobs[2], addresses, toAddressRecordId: "recADDRD" }), "destination-closed");
    check("  one gone from the base", destinationRefusal({ toJob: null, addresses, toAddressRecordId: C }), "destination-gone");
    check("  an address that is not the job's", destinationRefusal({ toJob: jobs[0], addresses, toAddressRecordId: A }), "destination-not-on-job");
    check("  and an open job's own address is not", destinationRefusal({ toJob: jobs[0], addresses, toAddressRecordId: C }), null);

    // ── 6: the refusals ──────────────────────────────────────────────────────
    log("");
    log("why each act is refused:");
    const send = { fromJobRecordId: JOB, fromAddressRecordId: A, toJobRecordId: OTHER, toAddressRecordId: C, qty: 5, sentDate: "2026-11-19", today: "2026-11-20", inStock: 5 };
    check(
        "a send: no address, no destination, the same address, a quantity, a date, a later day, the stock",
        [
            sendRefusal({ ...send, fromAddressRecordId: "" }),
            sendRefusal({ ...send, toAddressRecordId: "" }),
            sendRefusal({ ...send, toJobRecordId: JOB, toAddressRecordId: A }),
            sendRefusal({ ...send, qty: 0 }),
            sendRefusal({ ...send, sentDate: "" }),
            sendRefusal({ ...send, sentDate: "2026-11-21" }),
            sendRefusal({ ...send, qty: 6 }),
        ].join(" "),
        "no-address no-destination same-address not-a-quantity no-date future-date more-than-stock"
    );
    check("  and one that fits, as do the same address on another job and today", [sendRefusal(send), sendRefusal({ ...send, toAddressRecordId: A }), sendRefusal({ ...send, sentDate: "2026-11-20" })].join(" "), "  ");
    const receipt = { qty: 2, receivedDate: "2026-11-19", sentDate: "2026-11-19", today: "2026-11-20", remaining: 3 };
    check(
        "a receipt: a quantity, a date, a later day, a day before the send, more than is left",
        [
            receiveRefusal({ ...receipt, qty: 1.5 }),
            receiveRefusal({ ...receipt, receivedDate: "11/19" }),
            receiveRefusal({ ...receipt, receivedDate: "2026-11-21" }),
            receiveRefusal({ ...receipt, receivedDate: "2026-11-18" }),
            receiveRefusal({ ...receipt, qty: 4 }),
        ].join(" "),
        "not-a-quantity no-date future-date before-sent more-than-in-transit"
    );
    check("  and one that fits, the day it was sent and all that is left", receiveRefusal({ ...receipt, qty: 3 }), null);
    check("a cancel: a quantity, more than is left", [cancelRefusal({ qty: 0, remaining: 3 }), cancelRefusal({ qty: 4, remaining: 3 }), cancelRefusal({ qty: 3, remaining: 3 })].join(" "), "not-a-quantity more-than-in-transit ");
    check(
        "a write-off: nothing left, a remainder moved since it was asked, or all that is left",
        [writeOffRefusal({ remaining: 0, qty: 0 }), writeOffRefusal({ remaining: 3, qty: 2 }), writeOffRefusal({ remaining: 3, qty: 3 })].join(" "),
        "nothing-in-transit changed "
    );
    const said = {
        send: ["no-address", "no-destination", "same-address", "not-a-quantity", "no-date", "future-date", "more-than-stock", "destination-gone", "destination-closed", "destination-not-on-job", "not-allowed", "failed"],
        receive: ["not-a-quantity", "no-date", "future-date", "before-sent", "more-than-in-transit", "send-gone", "raced", "not-allowed", "failed"],
        cancel: ["not-a-quantity", "more-than-in-transit", "send-gone", "raced", "not-allowed", "failed"],
        writeOff: ["nothing-in-transit", "changed", "send-gone", "raced", "not-allowed", "failed"],
    };
    check(
        "every refusal an act can return has its words, and no words wait for none",
        Object.entries(said)
            .map(([act, keys]) => `${act}: ${JSON.stringify(Object.keys(TRANSIT_COPY.refusals[act]).sort()) === JSON.stringify([...keys].sort())}`)
            .join(" "),
        "send: true receive: true cancel: true writeOff: true"
    );
    check("the acts are Send and Receive", `${TRANSIT_COPY.send.submit} | ${TRANSIT_COPY.receive.submit}`, "Send materials | Receive materials");
    check("the wrapper's refusal and the writer's are one sentence", TRANSIT_COPY.writeOff.noAccess === TRANSIT_COPY.refusals.writeOff["not-allowed"], true);

    log("");
    log("the reader's today, in the zone their press sent:");
    const instant = new Date("2026-11-20T23:30:00.000Z");
    check("Chicago's day and Kiritimati's", `${todayIn("America/Chicago", instant)} ${todayIn("Pacific/Kiritimati", instant)}`, "2026-11-20 2026-11-21");
    check("  and a zone it does not know is UTC's", `${todayIn("Not/AZone", instant)} ${todayIn("", instant)}`, "2026-11-20 2026-11-20");

    log("");
    log("what the activity says of each row:");
    const words = (r) =>
        transitActivityWords(
            { kind: r.event, qty: Math.abs(r.qty), destinationJobRecordId: r.destinationJob[0] ?? null, destinationAddressRecordId: r.destinationAddress[0] ?? null, sendRecordId: r.send[0] ?? null },
            "EA",
            {
                sendById: new Map(sends.map((s) => [s.id, s])),
                addressLabel: (id) => ({ [A]: "Yard A", [B]: "Yard B", [C]: "Shop C" })[id],
                jobCode: (id) => ({ [JOB]: "26-B", [OTHER]: "26-A" })[id],
                plain: () => "plain",
            }
        );
    check("a send names where it went", words(S1), "Sent 10 EA to Shop C · 26-A");
    check("a receipt names where it came from and the day it was sent", words(R1), "Received 6 EA from Yard A · 26-B, sent 2026-11-18");
    check("a cancel and a write-off name the send", `${words(X1)} | ${words(W1)}`, "Send canceled 1 EA, sent 2026-11-18 to Shop C · 26-A | Written off 3 EA, sent 2026-11-18 to Shop C · 26-A");
    check("  and a row whose send is gone, or any other, is said plainly", `${words(ORPHAN)} ${words(I1)}`, "plain plain");

    // ── 7: the writes' shape, by source ──────────────────────────────────────
    log("");
    log("the writes' shape:");
    const server = parseFile("lib/materialTransit.server.js");
    const fn = (name) => resolveFunction(server.ast, name) ?? { type: "Program", body: [] };
    const text = (node) => server.source.slice(node.start ?? 0, node.end ?? 0);
    const recordSend = text(fn("recordSend"));
    check("a send takes the issue's lock on the address it leaves", /withKeyLock\(stockLockKey\(fromJobRecordId, fromAddressRecordId, materialRecordId\)/.test(recordSend), true);
    const written = recordSend.indexOf("createMaterialLogEntry(");
    check("  reads the stock before its write and again after", [recordSend.indexOf("stockNow()") > 0 && recordSend.indexOf("stockNow()") < written, recordSend.indexOf("stockNow()", written) > written].join(" "), "true true");
    check("  and takes its own row back when the address is below zero", recordSend.indexOf("takeBack(entry", written) > written, true);
    check("  and asks where it goes before its lock", recordSend.indexOf("destinationRefusal(") > 0 && recordSend.indexOf("destinationRefusal(") < recordSend.indexOf("withKeyLock("), true);
    for (const [name, act] of [
        ["recordReceipt", "a receipt"],
        ["recordSendCancel", "a cancel"],
        ["recordWriteOff", "a write-off"],
    ]) {
        const body = text(fn(name));
        const create = body.indexOf("createMaterialLogEntry(");
        check(`${act} reads the send under its lock, writes, and reads it again`, [/withKeyLock\(sendLockKey\(sentRecordId\)/.test(body), body.indexOf("readSend(") > 0 && body.indexOf("readSend(") < create, body.indexOf("standOrTakeBack(entry, send.id)", create) > create].join(" "), "true true true");
    }
    const writeOff = text(fn("recordWriteOff"));
    const who = writeOff.indexOf("canWriteOff(user)");
    check("a write-off asks who before anything else", who > 0 && who < writeOff.indexOf("withKeyLock("), true);
    const stand = text(fn("standOrTakeBack"));
    check("the read after a write takes the row back when the send is gone or over-settled", [/after && after\.remaining >= 0/.test(stand), stand.indexOf("takeBack(entry") > 0, /after \? "raced" : "send-gone"/.test(stand)].join(" "), "true true true");
    check("one read of a send forgets what was taken back between its two reads", callsTo(fn("readSend"), "forgetGone").length, 1);
    const writer = readFileSync(repoPath("lib/airtable/materialLog.js"), "utf8");
    check(
        "the writer refuses a row naming the wrong links for its event",
        [/settlesASend\(event\) !== Boolean\(sendRecordId\)/.test(writer), /sent !== Boolean\(destinationJobRecordId\) \|\| sent !== Boolean\(destinationAddressRecordId\)/.test(writer)].join(" "),
        "true true"
    );
    const actions = parseFile("app/materials/[jobCode]/[materialId]/actions.js");
    const sendAction = resolveFunction(actions.ast, "sendMaterialsAction");
    const asks = callsTo(sendAction ?? {}, "canAccessJobInventory")[0];
    const records = callsTo(sendAction ?? {}, "recordSend")[0];
    check("the send action asks who before it records", Boolean(asks && records && asks.start < records.start), true);
    check(
        "every transit action hands its reader's zone to today",
        ["sendMaterialsAction", "receiveMaterialsAction", "cancelSendAction", "writeOffMaterialsAction"].map((name) => callsTo(resolveFunction(actions.ast, name) ?? {}, "todayIn").length).join(" "),
        "1 1 1 1"
    );
    const zoneSent = (file) => (readFileSync(repoPath(file), "utf8").match(/name="timeZone" value=\{timeZone\}/g) || []).length;
    const zoneRead = (file) => (readFileSync(repoPath(file), "utf8").match(/const timeZone = useReaderTimeZone\(\);/g) || []).length;
    check(
        "and every form sends the zone its browser is in",
        `${zoneSent("app/materials/[jobCode]/[materialId]/SendForm.js")}/${zoneRead("app/materials/[jobCode]/[materialId]/SendForm.js")} ${zoneSent("app/materials/[jobCode]/[materialId]/InTransitForms.js")}/${zoneRead("app/materials/[jobCode]/[materialId]/InTransitForms.js")}`,
        "1/1 3/3"
    );
    assert("  and the zone it reads is the browser's", /export function useReaderTimeZone\(\) \{\s*return useSyncExternalStore\(noSubscription, readerTimeZone, nothing\);/.test(readFileSync(repoPath("app/materials/[jobCode]/[materialId]/readerDay.js"), "utf8")));
}

if (isMain(import.meta.url)) standalone(title, run);

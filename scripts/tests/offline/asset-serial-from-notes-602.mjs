// The serial numbers moved out of items' notes (#602): where a note holds a number, what it keeps
// without it, which items take theirs and which are left, the ledger a run writes and what a revert
// takes back, on rows of this check's making.
//
// THE SUBJECT IS `scripts/import/serial_from_notes_602_plan.mjs`, the run's judgments apart from the
// base. The script talks to the base, so it is never run here; what is held of it is what it hands
// the fence and where it writes, off its source. The fence itself — `refusesBeyondLedger`, which refuses
// the script every request on the live base since #621 — is `offline/protected-tables.mjs`'s.
//
// NO VALUE A RUN SKIPS IS NAMED HERE OR IN THE SCRIPT. Which notes are left as they are is the run's
// argument, so the fixtures below skip notes of their own making.
//
// WHAT IT CANNOT SEE. What the base's notes hold — the preview's counts are the record of that, and
// they are in the area notes — and what the base answers to a write, which the run reads back.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { join } from "path";
import { REPO_ROOT, calleeName, parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { SERIAL_NUMBER_FIELD } from "../../protectedTables.mjs";
import {
    FIELDS,
    ROWS_PER_REQUEST,
    SCRIPT,
    SHORTEST_NUMBER,
    collectingReads,
    findSerial,
    inBatches,
    moveLine,
    notAsWritten,
    planCounts,
    planDigest,
    planMove,
    planRevert,
    uncertainties,
} from "../../import/serial_from_notes_602_plan.mjs";

export const title = "The serial numbers in items' notes move into Serial Number, by one rule and a ledger (#602)";

const SCRIPT_PATH = "scripts/import/ran/serial_from_notes_602.mjs";

/** `findSerial`'s answer in one line: the number, what the note keeps, and how it was found. */
const found = (note) => {
    const answer = findSerial(note);
    return answer ? `${answer.number} | ${answer.rest} | ${answer.labeled ? "labeled" : answer.alone ? "alone" : "beside"}` : "none";
};

export function run({ check, assert, log }) {
    // ── where a note holds a number ──────────────────────────────────────────
    log("where a note holds a number (findSerial):");
    check("  a note that is one token is that token", found("A1B2C3D4"), "A1B2C3D4 |  | alone");
    check("  digits alone, a leading zero kept", found("0012345"), "0012345 |  | alone");
    check("  letters alone, since a maker may number with letters", found("QXRTPLM"), "QXRTPLM |  | alone");
    check("  hyphens, slashes and dots inside it are its own", found("AB-12/3.4"), "AB-12/3.4 |  | alone");
    check("  read as a note is kept, its spaces tidied", found("  ZK-7781  "), "ZK-7781 |  | alone");
    check("  S/N and an underscore", found("S/N_QM4410"), "QM4410 |  | labeled");
    check("  S/N with nothing between", found("S/NQM4410"), "QM4410 |  | labeled");
    check("  SN and a colon", found("SN: 77120"), "77120 |  | labeled");
    check("  Serial No. and a space", found("Serial No. AB-1234"), "AB-1234 |  | labeled");
    check("  Serial Number and a colon, any case", found("serial number: AB-1234"), "AB-1234 |  | labeled");
    check("  Serial #", found("Serial #A77"), "A77 |  | labeled");
    check("  SN with no separator is the number's own letters", found("SN12345"), "SN12345 |  | alone");
    check("  a label inside brackets empties them", `${found("(S/N 4455)")} / ${found("[SN 99887]")}`, "4455 |  | labeled / 99887 |  | labeled");
    check("  a label among words: the rest is kept, its separator dropped", found("S/N_XY900, spare battery"), "XY900 | spare battery | labeled");
    check("  words after a labeled number in brackets stay", found("Serial No. AB-1234 (blue case)"), "AB-1234 | (blue case) | labeled");
    check("  a separator left doubled between the words is one", found("blue, S/N_XY900, case"), "XY900 | blue, case | labeled");
    check("  a mark before a lone number goes with it, and it reads as beside", found("#A1B2C3"), "A1B2C3 |  | beside");
    check("  several words and no label: the first token holding a digit", found("R7-1 +Q55"), "R7-1 | +Q55 | beside");
    check("  and the words before it stay", found("blue case 7781-A"), "7781-A | blue case | beside");
    check("  several words holding no digit hold no number", found("Blue case"), "none");
    check("  nor several whose digits stand in tokens shorter than four", `${found("van, rack 2")} / ${found("box 12 bay 345")}`, "none / none");
    check("  a short token with a digit is passed over for the next", found("kit 3 R2203-9"), "R2203-9 | kit 3 | beside");
    check("  an empty note holds none, and one of spaces", `${found("")} ${found("   ")} ${found(null)}`, "none none none");

    // ── what is marked, and still written ───────────────────────────────────
    log("");
    log("what is marked (uncertainties):");
    const marks = (note, parts = []) => uncertainties(findSerial(note), parts).join(", ") || "none";
    check("  the shortest unmarked is four characters", SHORTEST_NUMBER, 4);
    check("  three characters are marked short, four are not", `${marks("AB1")} / ${marks("AB12")}`, "short / none");
    check("  letters short of four, as initials are", marks("QZ"), "short");
    check("  a number beside words with no label", marks("blue case 7781-A"), "beside words");
    check("  a labeled one among words is not", marks("S/N_XY900, spare battery"), "none");
    check("  the kind's part number itself", marks("PN-4410", ["PN-4410"]), "part number");
    check("  itself though no piece of it is four", marks("WD-350-PN", ["WD-350-PN"]), "part number");
    check("  and in another case", marks("pn-4410", ["PN-4410"]), "part number");
    check("  a piece of four with a digit shared with it", marks("4410-PW77", ["PN-4410"]), "part number");
    check("  a shared piece with no digit is not", marks("CASE-1234", ["CASE-9"]), "none");
    check("  a shared piece shorter than four is not", marks("AB-123", ["X-123"]), "none");
    check("  no part number marks nothing", marks("PN-4410", []), "none");
    check("  a store listing label's shape", `${marks("X00ABCD123")} / ${marks("x00abcd123")} / ${marks("X00ABCD12")}`, "listing label / listing label / none");
    check("  every mark at once, in order", marks("X00", []), "short");
    check("  marks keep their order", marks("ab 4410", ["PN-4410"]), "beside words, part number");

    // ── which items take theirs ─────────────────────────────────────────────
    log("");
    log("which items take theirs (planMove):");
    const row = (id, note, over = {}) => ({ id, assetId: `HYE-AST-260101-${id.slice(-3)}`, status: "In stock", category: ["recK1"], note, serialNumber: null, ...over });
    const rows = [
        row("rec001", "QM4410"),
        row("rec002", "S/N_QM4411, spare", { status: "Retired" }),
        row("rec003", "AA"),
        row("rec004", "aa"),
        row("rec005", "AA 7781"),
        row("rec006", "DUP-1"),
        row("rec007", "dup-1"),
        row("rec008", "DUP-1", { category: ["recK2"] }),
        row("rec009", "OTHER-1", { serialNumber: "KEPT-9" }),
        row("rec010", "SAME-1 blue", { serialNumber: "same-1" }),
        row("rec011", "TAKEN-1"),
        row("rec012", null, { category: ["recK2"], serialNumber: "TAKEN-1" }),
        row("rec013", "TAKEN-2"),
        row("rec014", null, { serialNumber: "TAKEN-2", status: "Deleted" }),
        row("rec015", "TAKEN-3"),
        row("rec016", null, { serialNumber: "taken-3", status: "Retired" }),
        row("rec017", "GONE-1", { status: "Deleted" }),
        row("rec018", "Blue case"),
        row("rec019", "NOKIND-1", { category: [] }),
        row("rec020", "PN-4410"),
        row("rec021", "   "),
        row("rec022", `LONG-${"9".repeat(50)}`),
        row("rec023", "TWOKIND-1", { category: ["recK1", "recK2"] }),
    ];
    const partNumbersOf = (kind) => (kind === "recK1" ? ["PN-4410"] : []);
    const plan = planMove(rows, { skipNotes: ["AA", "NEVER"], partNumbersOf });
    const ids = (list) => list.map((each) => each.id.slice(-3)).join(" ");
    check("  rows written, a retired one among them", ids(plan.moves), "001 002 005 008 010 011 013 020");
    check("  a note the run skips is left whole, case aside", ids(plan.skipped), "003 004");
    check("  a note holding more than it is not skipped", plan.moves.some((move) => move.id === "rec005"), true);
    check("  a skip note no note holds is named", plan.unmatched.join(), "NEVER");
    check("  no skip notes skip nothing", planMove(rows, { partNumbersOf }).skipped.length, 0);
    check(
        "  rows left, and why",
        plan.held.map((each) => `${each.id.slice(-3)}:${each.why}${each.holder ? `:${each.holder}` : ""}`).join(" "),
        "006:repeats in kind 007:repeats in kind 009:another number 015:repeats in kind:HYE-AST-260101-016 019:no kind 022:too long 023:no kind"
    );
    check("  a note holding no number is said", ids(plan.unfound), "018");
    check("  a deleted item is in none of them, nor a note of spaces", [plan.moves, plan.held, plan.skipped, plan.unfound].flat().some((each) => each.id === "rec017" || each.id === "rec021"), false);
    check("  the same number in another kind is written", plan.moves.find((move) => move.id === "rec008")?.number, "DUP-1");
    check("  a number held in another kind does not stop one", plan.moves.find((move) => move.id === "rec011")?.number, "TAKEN-1");
    check("  nor one held by a deleted item", plan.moves.find((move) => move.id === "rec013")?.number, "TAKEN-2");
    const byId = (id) => plan.moves.find((move) => move.id === id);
    check("  a cleared note is written as null, beside the number", JSON.stringify(byId("rec001").fields), '{"Serial Number":"QM4410","Note":null}');
    check("  and what a note keeps beside it", JSON.stringify(byId("rec002").fields), '{"Serial Number":"QM4411","Note":"spare"}');
    check("  an item holding the number already has its note cleaned alone", JSON.stringify(byId("rec010").fields), '{"Note":"blue"}');
    check("  and is no serial number written", byId("rec010").writesSerial, false);
    check("  before is each written field as read, an empty one null", `${JSON.stringify(byId("rec002").before)} ${JSON.stringify(byId("rec010").before)}`, '{"Serial Number":null,"Note":"S/N_QM4411, spare"} {"Note":"SAME-1 blue"}');
    check("  a note as read is kept raw in before", JSON.stringify(planMove([row("rec900", "  QM  4410  ")]).moves[0].before.Note), '"  QM  4410  "');
    check("  marks ride with the move", `${byId("rec005").marks.join()} | ${byId("rec020").marks.join()} | ${byId("rec001").marks.join()}`, "beside words | part number | ");
    check("  and the skipped pair, unskipped, repeat in their kind", planMove(rows, { partNumbersOf }).held.filter((each) => ["rec003", "rec004"].includes(each.id)).map((each) => each.why).join(), "repeats in kind,repeats in kind");
    check("  the fields are the base's two", `${FIELDS.serialNumber} | ${FIELDS.note}`, "Serial Number | Note");
    check("  and the number's is the field #601 made", FIELDS.serialNumber, SERIAL_NUMBER_FIELD.name);

    // ── what a preview counts ────────────────────────────────────────────────
    log("");
    log("what a preview counts (planCounts):");
    check(
        "  by value",
        JSON.stringify(planCounts(plan)),
        JSON.stringify({
            writes: 8,
            serialWritten: 7,
            noteCleared: 5,
            noteKept: 3,
            held: 7,
            heldWhy: { "repeats in kind": 3, "another number": 1, "no kind": 2, "too long": 1 },
            marked: 3,
            marks: { "beside words": 2, "part number": 1 },
            skipped: 2,
            unfound: 1,
        })
    );

    // ── a write is bound to its preview ──────────────────────────────────────
    log("");
    log("a write is bound to its preview (planDigest):");
    const reversed = planMove([...rows].reverse(), { skipNotes: ["AA", "NEVER"], partNumbersOf });
    check("  the same rows read in another order digest the same", planDigest(reversed), planDigest(plan));
    const changed = planMove(rows.map((each) => (each.id === "rec002" ? { ...each, note: "S/N_QM4412, spare" } : each)), { skipNotes: ["AA", "NEVER"], partNumbersOf });
    check("  a note changed since does not", planDigest(changed) === planDigest(plan), false);
    const unheld = planMove(rows.map((each) => (each.id === "rec009" ? { ...each, serialNumber: null } : each)), { skipNotes: ["AA", "NEVER"], partNumbersOf });
    check("  nor a row that would no longer be left", planDigest(unheld) === planDigest(plan), false);
    const unskipped = planMove(rows, { skipNotes: ["NEVER"], partNumbersOf });
    check("  nor a skip dropped", planDigest(unskipped) === planDigest(plan), false);
    const relabeled = planMove(rows.map((each) => (each.id === "rec002" ? { ...each, note: "SN: QM4411, spare" } : each)), { skipNotes: ["AA", "NEVER"], partNumbersOf });
    check("  nor a note written otherwise that moves the same", `${JSON.stringify(relabeled.moves.find((m) => m.id === "rec002").fields)} ${planDigest(relabeled) === planDigest(plan)}`, '{"Serial Number":"QM4411","Note":"spare"} false');
    const emptied = planMove(rows.map((each) => (each.id === "rec009" ? { ...each, note: "Blue case" } : each)), { skipNotes: ["AA", "NEVER"], partNumbersOf });
    check("  nor a row left that now holds no number", planDigest(emptied) === planDigest(plan), false);
    const moreSkipped = planMove(rows, { skipNotes: ["AA", "NEVER", "blue case"], partNumbersOf });
    check("  nor a note skipped that held no number", planDigest(moreSkipped) === planDigest(plan), false);

    // ── the ledger and a revert ──────────────────────────────────────────────
    log("");
    log("the ledger and a revert:");
    check("  a row's line", JSON.stringify(moveLine(byId("rec002"))), '{"type":"move","id":"rec002","assetId":"HYE-AST-260101-002","before":{"Serial Number":null,"Note":"S/N_QM4411, spare"},"after":{"Serial Number":"QM4411","Note":"spare"}}');
    const lines = [{ type: "run" }, ...plan.moves.map(moveLine)];
    const written = rows.map((each) => {
        const move = plan.moves.find((m) => m.id === each.id);
        return move ? { ...each, serialNumber: move.fields["Serial Number"] ?? each.serialNumber, note: move.fields.Note ?? undefined } : each;
    });
    check("  every row reads back as written", notAsWritten(lines, written).join(), "");
    const drifted = written.map((each) => (each.id === "rec001" ? { ...each, note: "since" } : each)).filter((each) => each.id !== "rec008");
    check("  one changed since and one gone do not", notAsWritten(lines, drifted).join(), "rec001,rec008");
    const back = planRevert(lines, drifted.map((each) => (each.id === "rec011" ? { ...each, serialNumber: "OTHER" } : each)));
    check("  a revert restores the rows still holding what it wrote", ids(back.restores), "002 005 010 013 020");
    check("  and leaves one changed since, by either field, and one gone", back.held.map((each) => `${each.id.slice(-3)}:${each.why}`).join(" "), "001:changed since 008:not on the base 011:changed since");
    const restore = back.restores.find((each) => each.id === "rec002");
    check("  giving back what it held before", JSON.stringify(restore.fields), '{"Serial Number":null,"Note":"S/N_QM4411, spare"}');
    check("  in a line of its own", JSON.stringify(restore.line), '{"type":"restore","id":"rec002","assetId":"HYE-AST-260101-002","before":{"Serial Number":"QM4411","Note":"spare"},"after":{"Serial Number":null,"Note":"S/N_QM4411, spare"}}');
    check("  a note-only row's revert touches the note alone", JSON.stringify(back.restores.find((each) => each.id === "rec010").fields), '{"Note":"SAME-1 blue"}');
    const restored = drifted.map((each) => {
        const r = back.restores.find((x) => x.id === each.id);
        return r ? { ...each, serialNumber: r.fields["Serial Number"] === undefined ? each.serialNumber : r.fields["Serial Number"], note: r.fields.Note } : each;
    });
    check("  and the revert's rows read back as restored", notAsWritten(back.restores.map((each) => each.line), restored).join(), "");
    check("  and one not restored is named", notAsWritten(back.restores.map((each) => each.line), drifted).join(), "rec002,rec005,rec010,rec013,rec020");
    check("  ten rows to a request", `${ROWS_PER_REQUEST} ${inBatches(Array.from({ length: 23 }, (_, i) => i)).map((b) => b.length).join(",")}`, "10 10,10,3");

    // ── the rows this run read, gathered at the funnel ───────────────────────
    log("");
    log("the rows this run read (collectingReads):");
    const answer = (request, error, body) => {
        const into = new Set();
        const seen = [];
        const callback = (...args) => seen.push(args.length);
        const wrapped = collectingReads(request, callback, { table: "Assets", into });
        wrapped(error, {}, body);
        return { ids: [...into].join(), seen: seen.join(), same: wrapped === callback };
    };
    const records = { records: [{ id: "recA" }, { id: "recB" }] };
    check("  a read of the table adds the rows it answered with", answer({ method: "get", path: "/Assets" }, null, records).ids, "recA,recB");
    check("  and hands the answer on whole", answer({ method: "get", path: "/Assets" }, null, records).seen, "3");
    check("  a long read too", answer({ method: "post", path: "/Assets/listRecords" }, null, records).ids, "recA,recB");
    check("  a read that failed adds none", answer({ method: "get", path: "/Assets" }, new Error("x"), records).ids, "");
    check("  another table's read adds none", answer({ method: "get", path: "/Asset%20Categories" }, null, records).ids, "");
    check("  a write's callback is handed back as it is", answer({ method: "patch", path: "/Assets/" }, null, records).same, true);
    check("  and adds none", answer({ method: "patch", path: "/Assets/" }, null, records).ids, "");

    // ── the script, off its source ───────────────────────────────────────────
    log("");
    log("the script, off its source:");
    check("  the plan names the script by its file", SCRIPT, SCRIPT_PATH.replace(/^.*\//, "").replace(/\.mjs$/, ""));
    const { ast, source } = parseFile(SCRIPT_PATH);
    let gathers = false;
    let fenceFills = 0;
    let writesTo = [];
    walk(ast, (node) => {
        if (calleeName(node) === "collectingReads" && node.arguments[2]?.properties?.some((p) => p.key?.name === "into" && p.value?.object?.name === "ledgerFence" && p.value?.property?.name === "read")) gathers = true;
        if (node.type === "CallExpression" && node.callee?.object?.object?.name === "ledgerFence" && node.callee?.object?.property?.name === "writes" && node.callee?.property?.name === "set") fenceFills++;
        if (["appendFileSync", "writeFileSync"].includes(calleeName(node))) writesTo.push(node.arguments[0]?.name ?? node.arguments[0]?.type);
    });
    assert("  the fence gathers the rows its reads answer with into ledgerFence.read", gathers);
    check("  the fence's writes are filled in two places, the move's and the revert's", fenceFills, 2);
    check("  every file it writes is a path it was handed", writesTo.join(" "), "path path");
    assert("  and those paths are under private/", /const PRIVATE = join\(dirname\(fileURLToPath\(import\.meta\.url\)\), "\.\.", "private", SCRIPT\);/.test(source) && !/"ledgers"/.test(source));
    const ignored = readFileSync(join(REPO_ROOT, ".gitignore"), "utf8").split(/\r?\n/);
    assert("  .gitignore keeps scripts/import/private/ out of the repository", ignored.includes("scripts/import/private/"));
}

if (isMain(import.meta.url)) standalone(title, run);

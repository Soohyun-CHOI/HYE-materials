// An item's note (#533): what a typed note becomes, when a press writing one is refused, who
// may write it, and where the screens and the action ask.
//
// BY VALUE, THE RULE. `readNote` and `readNoteSubmission` are pure, so what a note keeps — the
// tidy, the case, the limit measured on what is typed, an empty note a cleared one — and the
// order a press is answered in are asserted on inputs, as are `planTransition`'s `mayWriteNote`
// on every status for a site manager, for somebody else and for a site manager on no job, and
// every word `ASSET_NOTE_COPY` holds.
//
// OFF THE SOURCE, THE WIRING. That the action asks the planner and the rule of what it read,
// under one lock, writes only `Assets."Note"` and appends no `Asset Log` row; that the writer
// clears with null and refuses a note the rule would not keep; that no reader of `Assets` names
// its `fields`, which is what brings the note with every asset read at no cost; that the item's
// page and a category's hand the note on and nothing builds a label from it; and that the
// dialog and the sheet ask the rule before they send. Source order is not execution order
// (`_ast.mjs`), and a browser is where the screens are seen.
//
// WHAT IT CANNOT SEE: whether `Assets."Note"` exists on a base, or is a single line of text —
// that is `scripts/import/describe_note_533.mjs`'s read, and `verify-tools-schema-334.mjs`'s.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { ASSET_NOTE_COPY, NOTE_MAX, keptNote, readNote, readNoteSubmission } from "../../../lib/assetNote.js";
import { ASSET_STATUS, ASSET_STATUS_VALUES } from "../../../lib/assetStatus.js";
import { ASSET_TRANSITION_COPY, planTransition } from "../../../lib/assetTransition.js";
import { parseFile, parseSource, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An item's note: what it keeps, who writes it, and where it is asked (#533)";

const ACTIONS = "app/(assets)/assets/[assetId]/actions.js";
const ASSETS = "lib/airtable/assets.js";
const NOTE_COMPONENT = "app/(assets)/assets/[assetId]/AssetNote.js";
const ITEM_PAGE = "app/(assets)/assets/[assetId]/page.js";
const CATEGORY_PAGE = "app/(assets)/asset-categories/[categoryRecordId]/page.js";

const JOB_A = { id: "recJobA", jobCode: "26-DEMO-01" };
const JOB_B = { id: "recJobB", jobCode: "26-DEMO-02" };
const ALL_JOBS = [JOB_A, JOB_B];
const siteManager = (...jobs) => ({ id: "recUser", isSiteManager: true, assignedJobs: jobs.map((j) => j.id) });
const reader = (...jobs) => ({ id: "recReader", assignedJobs: jobs.map((j) => j.id) });

/**
 * A function's own source, by name — a component's default export among them, which
 * `resolveFunction` does not read — or the empty string when no such function is found.
 */
function functionSource({ ast, source }, name) {
    const exported = ast.body.find((n) => n.type === "ExportDefaultDeclaration" && n.declaration?.id?.name === name)?.declaration;
    const node = exported ?? resolveFunction(ast, name);
    return node ? source.slice(node.start, node.end) : "";
}

/** What the action's handler asks and does, read off its source. */
function actionFacts(handler) {
    const lock = handler.indexOf("withKeyLock(");
    const lockEnd = handler.indexOf("\n        });", lock);
    const locked = lock >= 0 && lockEnd > lock ? handler.slice(lock, lockEnd) : "";
    const after = lockEnd > 0 ? handler.slice(lockEnd) : "";
    return {
        label: /withOpsLabel\("updateAssetNoteAction",/.test(handler),
        lockKey: /withKeyLock\(`asset-note:\$\{normalizeItemText\(asked\)\.toLowerCase\(\)\}`,/.test(handler),
        readsInLock: /const asset = await getAssetByAssetId\(asked\);/.test(locked),
        plansInLock: /planTransition\(\{ user, jobs: await getAllJobs\(\), status: asset\.status \}\)/.test(locked),
        asksRule:
            /readNoteSubmission\(plan, \{\s*typed: String\(formData\.get\("note"\) \?\? ""\),\s*previous: String\(formData\.get\("previous"\) \?\? ""\),\s*stored: asset\.note,\s*\}\)/.test(
                locked
            ),
        writesInLock: /if \(!answer\.unchanged\) await updateAssetNote\(\{ assetRecordId: asset\.id, note: answer\.note \}\);/.test(locked),
        stopsFirst: /if \(answer\.ended \|\| answer\.refusal\) return answer;/.test(locked) && locked.indexOf("return answer;") < locked.indexOf("updateAssetNote("),
        ended: /if \(outcome\.ended\) return refuse\(null\);/.test(after),
        refuses: /if \(outcome\.refusal\) return refuse\(outcome\.refusal\);/.test(after),
        lands: /redirect\(assetPath\(outcome\.landed\)\);/.test(after) && !/redirect\(/.test(locked),
        noEvent: !/createAssetLogEntry|updateAssetCache|writeEvent/.test(handler),
    };
}

export function run({ check, assert, log }) {
    // ── what a typed note keeps ─────────────────────────────────────────────
    log("what a typed note keeps (readNote, keptNote):");
    check("the limit is the design's", NOTE_MAX, 50);
    const kept = (typed) => JSON.stringify(readNote(typed));
    check("nothing typed is a cleared note", kept(""), '{"note":"","refusal":null}');
    check("  and spaces alone tidy to one", kept("   "), '{"note":"","refusal":null}');
    check("its ends trimmed and each run of spaces one", kept("  At the  Riverside   yard "), '{"note":"At the Riverside yard","refusal":null}');
    check("  tabs and line breaks among them", kept("Bay\t2\nshelf"), '{"note":"Bay 2 shelf","refusal":null}');
    check("its case as typed", kept("red TAPE on the Handle"), '{"note":"red TAPE on the Handle","refusal":null}');
    check("fifty characters kept", readNote("x".repeat(50)).note, "x".repeat(50));
    check("fifty-one refused, in the design's words", kept("x".repeat(51)), JSON.stringify({ note: null, refusal: ASSET_NOTE_COPY.tooLong }));
    check("  measured as typed, so a doubled space that tidies to fifty still counts", readNote(`${"x".repeat(24)}  ${"x".repeat(25)}`).refusal, ASSET_NOTE_COPY.tooLong);
    check("  and a note no one typed reads as typed nothing", readNote(undefined).note, "");
    check("a stored note is compared kept", `${keptNote(" a  b ")}|${keptNote(undefined)}|${keptNote(null)}`, "a b||");

    // ── what a press does, in the order it is asked ─────────────────────────
    log("");
    log("what a press writing a note does, in order (readNoteSubmission):");
    const may = { mayWriteNote: true };
    const answer = (plan, input) => JSON.stringify(readNoteSubmission(plan, input));
    check("a reader who may not write is answered first, and told nothing", answer({ mayWriteNote: false }, { typed: "x".repeat(60), previous: "a", stored: "b" }), '{"ended":true}');
    check("  and a plan missing altogether reads the same", answer(undefined, { typed: "x", previous: "", stored: "" }), '{"ended":true}');
    check(
        "a note somebody else changed is refused before the length",
        answer(may, { typed: "x".repeat(60), previous: "Bay 2", stored: "Bay 3" }),
        JSON.stringify({ refusal: ASSET_NOTE_COPY.changedFirst, stale: true })
    );
    check("  and compared kept, so spacing alone is no change", answer(may, { typed: "new", previous: " Bay  2", stored: "Bay 2" }), '{"note":"new"}');
    check("  a note added somebody did not see is a change", answer(may, { typed: "mine", previous: "", stored: "theirs" }), JSON.stringify({ refusal: ASSET_NOTE_COPY.changedFirst, stale: true }));
    check("too much typed is refused", answer(may, { typed: "x".repeat(51), previous: "", stored: "" }), JSON.stringify({ refusal: ASSET_NOTE_COPY.tooLong }));
    check("a note that tidies to the one there writes nothing", answer(may, { typed: " Bay   2 ", previous: "Bay 2", stored: "Bay 2" }), '{"unchanged":true}');
    check("  and nothing over nothing writes nothing", answer(may, { typed: "  ", previous: "", stored: undefined }), '{"unchanged":true}');
    check("a new note is written kept", answer(may, { typed: "  Red tape  ", previous: "", stored: "" }), '{"note":"Red tape"}');
    check("a cleared field clears the note", answer(may, { typed: "", previous: "Bay 2", stored: "Bay 2" }), '{"note":""}');

    // ── who may write it ────────────────────────────────────────────────────
    log("");
    log("who may write it — planTransition's mayWriteNote, status by status:");
    const planOf = (user, status) => planTransition({ user, jobs: ALL_JOBS, status });
    check(
        "a site manager on a job, while the item is in stock or out",
        ASSET_STATUS_VALUES.map((status) => `${status}: ${planOf(siteManager(JOB_A), status).mayWriteNote}`).join(", "),
        "In stock: true, Out: true, In repair: false, Retired: false"
    );
    check(
        "  nobody who is not a site manager, on any status",
        ASSET_STATUS_VALUES.map((status) => planOf(reader(JOB_A, JOB_B), status).mayWriteNote).join(","),
        "false,false,false,false"
    );
    check(
        "  nor a site manager on no job, who is told so as for every act",
        ASSET_STATUS_VALUES.map((status) => `${planOf(siteManager(), status).mayWriteNote}/${planOf(siteManager(), status).refusal}`).join(", "),
        [ASSET_TRANSITION_COPY.noJob, ASSET_TRANSITION_COPY.noJob, ASSET_TRANSITION_COPY.noJob, ASSET_TRANSITION_COPY.noTransition].map((r) => `false/${r}`).join(", ")
    );
    check("  and the plan carries it whatever else it offers", Object.keys(planOf(siteManager(JOB_A), ASSET_STATUS.OUT)).includes("mayWriteNote"), true);

    // ── the words ───────────────────────────────────────────────────────────
    log("");
    log("every word the screens say about a note, by value:");
    check(
        "the openings and the line",
        [ASSET_NOTE_COPY.label, ASSET_NOTE_COPY.addNote, ASSET_NOTE_COPY.editNote, ASSET_NOTE_COPY.edit, ASSET_NOTE_COPY.addANote].join(" | "),
        "Note | Add note | Edit note | Edit | Add a note"
    );
    check(
        "the field, its line and its count",
        [ASSET_NOTE_COPY.placeholder, ASSET_NOTE_COPY.help, ASSET_NOTE_COPY.count(28), ASSET_NOTE_COPY.count(55), ASSET_NOTE_COPY.tooLong].join(" | "),
        "e.g. At the Riverside yard | Up to 50 characters. | 28/50 | 55/50 | Max 50 characters."
    );
    check(
        "the actions and their working words",
        [ASSET_NOTE_COPY.save, ASSET_NOTE_COPY.remove, ASSET_NOTE_COPY.done, ASSET_NOTE_COPY.working.save, ASSET_NOTE_COPY.working.add, ASSET_NOTE_COPY.working.remove].join(" | "),
        "Save | Remove note | Done | Saving… | Adding… | Removing…"
    );
    check("  Cancel and the clear mark the transition's own", `${ASSET_NOTE_COPY.cancel === ASSET_TRANSITION_COPY.cancel} ${ASSET_NOTE_COPY.clear === ASSET_TRANSITION_COPY.clearName}`, "true true");
    check("a note changed first", ASSET_NOTE_COPY.changedFirst, "Nothing was saved. Someone else changed this note first.");

    // ── the action ──────────────────────────────────────────────────────────
    log("");
    log("the action asks the planner and the rule of what it read, under one lock, and writes the note alone:");
    const actions = parseFile(ACTIONS);
    const handler = functionSource(actions, "updateAssetNoteHandler");
    assert("the handler was found", handler !== "");
    assert("  behind the site manager's gate", /export const updateAssetNoteAction = withSiteManagerAction\(updateAssetNoteHandler\);/.test(actions.source));
    const facts = actionFacts(handler);
    check(
        "its scope, its lock keyed by the printed id folded, the read, the plan and the rule inside it",
        [facts.label, facts.lockKey, facts.readsInLock, facts.plansInLock, facts.asksRule].join(" "),
        "true true true true true"
    );
    check("  a refusal stops before the write, and a note left as it was writes nothing", `${facts.stopsFirst} ${facts.writesInLock}`, "true true");
    check("  a reader who may no longer write gets the page alone, a refusal the page and its sentence, through the one helper", `${facts.ended} ${facts.refuses}`, "true true");
    check("  a note written lands on its page, after the lock", facts.lands, true);
    check("  and no Asset Log row, nor the caches an event moves", facts.noEvent, true);
    check(
        "  the one helper answers a refusal the page says on its own with the page and nothing beside it",
        /function refuse\(error, moved = null\) \{\s*refresh\(\);\s*if \(error === null\) return null;\s*return moved \? \{ error, moved \} : \{ error \};/.test(actions.source),
        true
    );

    // ── the writer and the reads ────────────────────────────────────────────
    log("");
    log("the writer, and the reads that bring the note for nothing:");
    const assets = parseFile(ASSETS);
    const writer = functionSource(assets, "updateAssetNote");
    check(
        "the writer: one field, in the batch form, cleared with null",
        [
            /await base\(TABLES\.ASSETS\)\.update\(\[\s*\{\s*id: assetRecordId,\s*fields: \{ Note: note === "" \? null : note \},\s*\},\s*\]\);/.test(writer),
            !/Status|Job/.test(writer.replace(/^[^]*?\{\n/, "").replace(/\/\/.*$/gm, "")),
        ].join(" "),
        "true true"
    );
    check(
        "  refusing a note the rule would not keep",
        /if \(typeof note !== "string" \|\| note !== keptNote\(note\) \|\| note\.length > NOTE_MAX\) \{\s*throw new Error/.test(writer),
        true
    );
    check("the mapper reads the field, and the empty string where it is absent", /note: record\.get\("Note"\) \?\? "",/.test(assets.source), true);
    // The status memory's two reads (#560) name `Status` alone and hand back no asset, only its
    // status (`recordToStatus`) — `offline/asset-status-memory.mjs` holds that — so they are
    // left out of what this asks of every reader that answers a whole asset.
    check(
        "no reader of a whole asset names its fields, so the note comes with every asset read",
        /\bfields\s*:/.test(
            assets.source
                .replace(/\/\*[^]*?\*\//g, "")
                .replace(/\/\/.*$/gm, "")
                .replace(/fields: \{ Note:[^}]*\}/, "")
                .replace(/fields: \{\s*Status:[^}]*\}/, "")
                .replace(/\(assetId\) => \(\{[^]*?\}\)/, "")
                .replace(/createAssetStatusMemory\(\{[^]*?\n\}\);/, "")
        ),
        false
    );
    check("  and a registration writes none", /"Asset ID": assetId,\s*Category: \[categoryRecordId\],\s*Status: ASSET_STATUS\.IN_STOCK,\s*Job: \[jobRecordId\],\s*\}\)/.test(assets.source), true);

    // ── the screens ─────────────────────────────────────────────────────────
    log("");
    log("the screens hand the note on, and ask the rule before they send:");
    const itemPage = parseFile(ITEM_PAGE).source;
    check(
        "the item's page draws it under the status for every reader, writable as the plan says",
        /<AssetNote assetId=\{asset\.assetId\} note=\{asset\.note\} writable=\{transition\.mayWriteNote\} \/>/.test(itemPage),
        true
    );
    check("a category's rows carry it off the read they came from", /note: asset\.note,/.test(parseFile(CATEGORY_PAGE).source), true);
    check(
        "no label is built from it",
        [/buildAssetLabel\(\{\s*origin: `\$\{proto\}:\/\/\$\{headerList\.get\("host"\) \?\? ""\}`,\s*assetId: asset\.assetId,\s*\}\)/.test(itemPage), !/\.note\b/.test(parseFile("lib/assetLabelQR.js").source)].join(" "),
        "true true"
    );
    const component = parseFile(NOTE_COMPONENT);
    const noteLine = functionSource(component, "AssetNote");
    check(
        "the press sends the item, what was typed, and the note the page was drawn with",
        [
            /formData\.set\("assetId", assetId\);\s*formData\.set\("note", typed\);\s*formData\.set\("previous", note\);/.test(noteLine),
            /startTransition\(\(\) => formAction\(formData\)\);/.test(noteLine),
            /useActionState\(updateAssetNoteAction, null\)/.test(noteLine),
        ].join(" "),
        "true true true"
    );
    check("  a reader who may not write meets nothing where there is no note", /if \(!note && !writable\) return null;/.test(noteLine), true);
    check("  the answer said only to the opening that sent it", /const refusal = answer\?\.error && sentFor === opening \? answer\.error : null;/.test(noteLine), true);
    check(
        "  each width's opener is drawn for a writer alone, and opens its own",
        [
            /\{writable && \(\s*<button\s+type="button"\s+aria-label=\{COPY\.editNote\}\s+onClick=\{\(\) => open\("desk"\)\}/.test(noteLine),
            /\{writable && <NoteDialog key=\{opening\} open=\{openOn === "desk"\} \{\.\.\.shared\} \/>\}/.test(noteLine),
            /\{writable && <NoteSheet key=\{opening\} open=\{openOn === "phone"\} \{\.\.\.shared\} \/>\}/.test(noteLine),
            /if \(!writable\) return <p className="flex items-start gap-gap text-mobile-body-sm">\{line\}<\/p>;/.test(functionSource(component, "PhoneNote")),
        ].join(" "),
        "true true true true"
    );
    for (const name of ["NoteDialog", "NoteSheet"]) {
        const body = functionSource(component, name);
        check(
            `  the ${name === "NoteDialog" ? "desk's dialog" : "phone's sheet"} asks the rule of what is typed against the note it opened on, and sends only what it takes`,
            [
                /const answer = readNoteSubmission\(\{ mayWriteNote: true \}, \{ typed: draft, previous: note, stored: note \}\);/.test(body),
                /if \(answer\.refusal\) \{\s*setPressed\(true\);/.test(body),
                /if \(answer\.unchanged\) \{\s*onClose\(\);\s*return;\s*\}\s*onSend\(draft, "submit"\);/.test(body),
                /refusal=\{pressed \? answer\.refusal : null\} count=\{COPY\.count\(draft\.length\)\}/.test(body),
            ].join(" "),
            "true true true true"
        );
    }
    check("  the desk's Remove note sends the note cleared, as an action of its own", /onClick=\{\(\) => onSend\("", "action"\)\}/.test(functionSource(component, "NoteDialog")), true);

    // THE COUNT AT THE LINE'S END IS THE FIELD'S (0a Note): in Red with the field while it refuses,
    // describing the field with the line, and outside the line's live region so it is not read
    // out on every keystroke.
    const field = functionSource(parseFile("app/components/Controls.js"), "Field");
    check(
        "the field's count stands at its line's end, in Red while the field refuses, describing the field",
        [
            /const described = \[said \? messageId : null, count !== undefined \? countId : null\]\.filter\(Boolean\)\.join\(" "\) \|\| undefined;/.test(field),
            /<span id=\{countId\} className=\{`ml-auto shrink-0 tabular-nums \$\{refusal \? "text-danger" : "text-foreground-subtle"\}`\}>\s*\{count\}\s*<\/span>/.test(field),
            /\{count === undefined \? \(\s*message\s*\) : \(\s*<div\s+className=\{`mt-input-message-stack flex items-start gap-field-count-inline/.test(field),
        ].join(" "),
        "true true true"
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the source readers are seen to fail:");
    const wrong = actionFacts(
        "async function updateAssetNoteHandler(prevState, formData) {\n" +
            '    return withOpsLabel("updateAssetNoteAction", async () => {\n' +
            "        const asset = await getAssetByAssetId(asked);\n" +
            "        await updateAssetNote({ assetRecordId: asset.id, note: String(formData.get(\"note\")) });\n" +
            "        await createAssetLogEntry({});\n" +
            "        redirect(assetPath(asset.assetId));\n" +
            "    });\n}\n"
    );
    check(
        "  an action with no lock, no plan, no rule, an event and no refusal is seen so",
        Object.entries(wrong)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(" "),
        "label"
    );
    check("  a function that is not there reads as nothing", functionSource(parseSource("export function a() {}", "<planted>"), "b"), "");
}

if (isMain(import.meta.url)) standalone(title, run);

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
// desk's row and the phone's sheet ask the rule before they send (`ItemDetails.js`, #601). Source order is not execution order
// (`_ast.mjs`), and a browser is where the screens are seen.
//
// WHAT IT CANNOT SEE: whether `Assets."Note"` exists on a base, or is a single line of text —
// that is `scripts/import/ran/describe_note_533.mjs`'s read, and `verify-tools-schema-334.mjs`'s.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { ASSET_NOTE_COPY, NOTE_MAX, keptNote, readNote, readNoteSubmission } from "../../../lib/assetNote.js";
import { ASSET_STATUS, ASSET_STATUS_VALUES } from "../../../lib/assetStatus.js";
import { ASSET_TRANSITION_COPY, planTransition } from "../../../lib/assetTransition.js";
import { parseFile, parseSource, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An item's note: what it keeps, who writes it, and where it is asked (#533, #612)";

const ACTIONS = "app/(assets)/assets/[assetId]/actions.js";
const ASSETS = "lib/airtable/assets.js";
// The note's screens since #601: the desk's Details row and the phone's line and sheet, the serial number's too.
const NOTE_COMPONENT = "app/(assets)/assets/[assetId]/ItemDetails.js";
const PROVIDER = "app/(assets)/assets/[assetId]/AssetTransition.js";
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
        // The item's owner job beside its job since #598, as every plan on the page is asked.
        plansInLock: /planTransition\(\{ user, jobs: await getAllJobs\(\), status: asset\.status, assetJobId: asset\.job\?\.\[0\], ownerJobId: asset\.ownerJob\?\.\[0\] \}\)/.test(locked),
        // Whose item it is now, asked of the plan before the note's own rule (#597), and said.
        asksRecording:
            /const recording = recordingRefusal\(plan, \{ drawnJobId: String\(formData\.get\("drawnJobId"\) \?\? ""\) \}\);\s*if \(recording\) return \{ refusal: recording \};\s*const answer = readNoteSubmission\(/.test(
                locked
            ),
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
    // On JOB_A unless said otherwise, the item's job being what decides since #597.
    const planOf = (user, status, assetJobId = JOB_A.id) => planTransition({ user, jobs: ALL_JOBS, status, assetJobId });
    // IN EVERY STATUS THE APP SHOWS SINCE #612, at its maker and once retired too; a deleted item is
    // drawn nowhere, so nobody meets it to write on.
    check(
        "a site manager on the item's job, in every status the app shows",
        ASSET_STATUS_VALUES.map((status) => `${status}: ${planOf(siteManager(JOB_A), status).mayWriteNote}`).join(", "),
        "In stock: true, Out: true, In repair: true, Retired: true, Deleted: false"
    );
    check(
        "  a retired item takes its note and still says it is retired (#612)",
        [planOf(siteManager(JOB_A), ASSET_STATUS.RETIRED).mayWriteNote, planOf(siteManager(JOB_A), ASSET_STATUS.RETIRED).event, planOf(siteManager(JOB_A), ASSET_STATUS.RETIRED).refusal].join(" | "),
        `true |  | ${ASSET_TRANSITION_COPY.noTransition}`
    );
    check(
        "  nobody who is not a site manager, on any status",
        ASSET_STATUS_VALUES.map((status) => planOf(reader(JOB_A, JOB_B), status).mayWriteNote).join(","),
        "false,false,false,false,false"
    );
    // A SITE MANAGER THE ITEM'S JOB IS NOT ONE OF READS IT AS ANYBODY DOES SINCE #597 — on another
    // job, or on none, where one on none was told to ask for a job until then — so the plan says
    // nothing either, on any status.
    check(
        "  nor a site manager on another job, told nothing (#597)",
        ASSET_STATUS_VALUES.map((status) => `${planOf(siteManager(JOB_B), status).mayWriteNote}/${planOf(siteManager(JOB_B), status).refusal}`).join(", "),
        ["false/null", "false/null", "false/null", "false/null", "false/null"].join(", ")
    );
    check(
        "  nor one on no job, told nothing either (#597)",
        ASSET_STATUS_VALUES.map((status) => `${planOf(siteManager(), status).mayWriteNote}/${planOf(siteManager(), status).refusal}`).join(", "),
        ["false/null", "false/null", "false/null", "false/null", "false/null"].join(", ")
    );
    check("  the item on JOB_B, the same site manager may", planOf(siteManager(JOB_B), ASSET_STATUS.IN_STOCK, JOB_B.id).mayWriteNote, true);
    check("  and the plan carries it whatever else it offers", Object.keys(planOf(siteManager(JOB_A), ASSET_STATUS.OUT)).includes("mayWriteNote"), true);

    // ── the words ───────────────────────────────────────────────────────────
    log("");
    log("every word the screens say about a note, by value:");
    check(
        "the openings and the line",
        [ASSET_NOTE_COPY.label, ASSET_NOTE_COPY.addNote, ASSET_NOTE_COPY.editNote, ASSET_NOTE_COPY.edit, ASSET_NOTE_COPY.addANote, ASSET_NOTE_COPY.add].join(" | "),
        "Note | Add note | Edit note | Edit | Add a note | Add"
    );
    check(
        "the field's line and its count, and no example in the field since the files of 2026-11-04's afternoon (#607)",
        ["placeholder" in ASSET_NOTE_COPY, ASSET_NOTE_COPY.help, ASSET_NOTE_COPY.count(28), ASSET_NOTE_COPY.count(55), ASSET_NOTE_COPY.tooLong].join(" | "),
        "false | Up to 50 characters. | 28/50 | 55/50 | Use 50 characters or fewer."
    );
    check(
        "the actions and their working words",
        [ASSET_NOTE_COPY.save, ASSET_NOTE_COPY.done, ASSET_NOTE_COPY.working.save, ASSET_NOTE_COPY.working.add, ASSET_NOTE_COPY.working.remove].join(" | "),
        "Save | Done | Saving… | Adding… | Removing…"
    );
    check("  Cancel and the clear mark the transition's own", `${ASSET_NOTE_COPY.cancel === ASSET_TRANSITION_COPY.cancel} ${ASSET_NOTE_COPY.clear === ASSET_TRANSITION_COPY.clearName}`, "true true");
    check("a note changed first, what happened and then the press (#612)", ASSET_NOTE_COPY.changedFirst, "Someone else changed this note first. Nothing was saved.");

    // ── the action ──────────────────────────────────────────────────────────
    log("");
    log("the action asks the planner and the rule of what it read, under one lock, and writes the note alone:");
    const actions = parseFile(ACTIONS);
    const handler = functionSource(actions, "updateAssetNoteHandler");
    assert("the handler was found", handler !== "");
    assert("  behind the site manager's gate", /export const updateAssetNoteAction = withSiteManagerAction\(refuseNotASiteManager, updateAssetNoteHandler\);/.test(actions.source));
    const facts = actionFacts(handler);
    check(
        "its scope, its lock keyed by the printed id folded, the read, the plan and the rule inside it",
        [facts.label, facts.lockKey, facts.readsInLock, facts.plansInLock, facts.asksRule].join(" "),
        "true true true true true"
    );
    check("  whose item it is now asked first, and said (#597)", facts.asksRecording, true);
    check("  a refusal stops before the write, and a note left as it was writes nothing", `${facts.stopsFirst} ${facts.writesInLock}`, "true true");
    check("  a reader who may no longer write gets the page alone, a refusal the page and its sentence, through the one helper", `${facts.ended} ${facts.refuses}`, "true true");
    check("  a note written lands on its page, after the lock", facts.lands, true);
    check("  and no Asset Log row, nor the caches an event moves", facts.noEvent, true);
    check(
        "  the one helper answers a refusal the page says on its own with the page and nothing beside it",
        /function refuse\(error, moved = null, takenBy = null\) \{\s*refresh\(\);\s*if \(error === null\) return null;\s*return \{ error, \.\.\.\(moved \? \{ moved \} : \{\}\), \.\.\.\(takenBy \? \{ takenBy \} : \{\}\) \};/.test(actions.source),
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
    // left out of what this asks of every reader that answers a whole asset. So is the third
    // writer's payload, an asset's job and its owner job (#583, #598, `updateAssetJob`), as the
    // other two's are.
    check(
        "no reader of a whole asset names its fields, so the note comes with every asset read",
        /\bfields\s*:/.test(
            assets.source
                .replace(/\/\*[^]*?\*\//g, "")
                .replace(/\/\/.*$/gm, "")
                .replace(/fields: \{ Note:[^}]*\}/, "")
                // The serial number's writer (#601), a write and no read.
                .replace(/fields: \{ \[SERIAL_NUMBER_FIELD\]:[^}]*\}/, "")
                .replace(/fields: \{\s*Status:[^}]*\}/, "")
                .replace(/fields: \{ Job: \[jobRecordId\], "Owner Job": \[jobRecordId\] \}/, "")
                .replace(/\(assetId\) => \(\{[^]*?\}\)/, "")
                .replace(/createAssetStatusMemory\(\{[^]*?\n\}\);/, "")
        ),
        false
    );
    // Its job twice since #598: where the item stands, and the job it belongs to.
    check("  and a registration writes none", /"Asset ID": assetId,\s*Category: \[categoryRecordId\],\s*Status: ASSET_STATUS\.IN_STOCK,\s*Job: \[jobRecordId\],\s*(?:\/\/[^\n]*\s*)?"Owner Job": \[jobRecordId\],\s*\}\)/.test(assets.source), true);

    // ── the screens ─────────────────────────────────────────────────────────
    log("");
    log("the screens hand the note on, and ask the rule before they send:");
    const itemPage = parseFile(ITEM_PAGE).source;
    check(
        "the item's page draws it in Details at a desk and under the status on a phone, for every reader, writable as the plan says",
        [
            /<DetailsBlock serialNumber=\{asset\.serialNumber\} note=\{asset\.note\} mayWriteSerial=\{transition\.mayWriteSerial\} mayWriteNote=\{transition\.mayWriteNote\} \/>/.test(itemPage),
            /<PhoneDetails serialNumber=\{asset\.serialNumber\} note=\{asset\.note\} mayWriteSerial=\{transition\.mayWriteSerial\} mayWriteNote=\{transition\.mayWriteNote\} \/>/.test(itemPage),
        ].join(" "),
        "true true"
    );
    check("a category's rows carry it off the read they came from", /note: asset\.note,/.test(parseFile(CATEGORY_PAGE).source), true);
    check(
        "no label is built from it",
        [/buildAssetLabel\(\{\s*origin: `\$\{proto\}:\/\/\$\{headerList\.get\("host"\) \?\? ""\}`,\s*assetId: asset\.assetId,\s*\}\)/.test(itemPage), !/\.note\b/.test(parseFile("lib/assetLabelQR.js").source)].join(" "),
        "true true"
    );
    // ONE PART DRAWS BOTH DETAILS SINCE #601 (`ItemDetails.js`), the note's rows and sheets the serial
    // number's: the desk edits a row where it stands (1f, the files of 2026-11-04) and a phone opens a
    // sheet. The page's provider sends each and holds its answer (`useDetail`) since #597.
    const component = parseFile(NOTE_COMPONENT);
    const provider = parseFile(PROVIDER).source;
    const slot = functionSource(parseFile(PROVIDER), "useDetail");
    check(
        "the press sends the item, the job the page was drawn on, what was typed, and the note the page was drawn with",
        [
            /formData\.set\("assetId", assetId\);\s*formData\.set\("drawnJobId", drawnJobId \?\? ""\);\s*formData\.set\(field, typed\);\s*formData\.set\("previous", previous\);/.test(slot),
            /startTransition\(\(\) => formAction\(formData\)\);/.test(slot),
            /const \[answer, formAction, pending\] = useActionState\(action, null\);/.test(slot),
            /const note = useDetail\(updateAssetNoteAction, \{ field: "note", assetId, drawnJobId: assetJobRecordId, onSent: \(\) => setLastSent\("note"\) \}\);/.test(provider),
            /control\.send\(\{ typed: draft, previous: value, by: "submit" \}\);/.test(functionSource(component, "RowEditor")),
            /control\.send\(\{ typed: draft, previous: value, by: "submit" \}\);/.test(functionSource(component, "DetailSheet")),
        ].join(" "),
        "true true true true true true"
    );
    check(
        "  a reader who may not write meets nothing where there is no note, but a desk's editor still standing (#614)",
        [
            /\]\.filter\(\(row\) => row\.value \|\| row\.writable \|\| transition\?\.\[row\.kind\]\?\.openOn === "desk"\);\s*if \(rows\.length === 0\) return null;/.test(functionSource(component, "DetailsBlock")),
            /\{\(note \|\| mayWriteNote\) && <PhoneDetail kind="note"/.test(functionSource(component, "PhoneDetails")),
        ].join(" "),
        "true true"
    );
    check(
        "  the answer said only to the opening that sent it, and under the status once the page ended a phone's (#614)",
        [
            /const saidInOpening = sentFor === opening;/.test(slot),
            /refusal: saidInOpening \? sentence : null,/.test(slot),
            /note: note\.saidInOpening \? null : note\.sentence,/.test(provider),
            /if \(note\.openOn === "phone" && !plan\.mayWriteNote\) note\.end\(\);/.test(provider) && !/if \(note\.openOn !== null && !plan\.mayWriteNote\)/.test(provider),
        ].join(" "),
        "true true true true"
    );
    check(
        "  each width's opener is drawn for a writer alone, and opens its own, a desk's editor standing once opened, its Save turned away when the page no longer lets the reader write (#614)",
        [
            /\{writable && \(\s*<button\s+ref=\{openerRef\}\s+type="button"\s+aria-label=\{detail\.editName\}\s+onClick=\{\(\) => control\.start\("desk"\)\}/.test(functionSource(component, "DetailsRow")),
            /const open = control\.openOn === "desk";/.test(functionSource(component, "DetailsRow")) &&
                /<RowEditor key=\{control\.opening\} kind=\{kind\} value=\{value\} available=\{writable\} control=\{control\} onClose=\{close\} \/>/.test(functionSource(component, "DetailsRow")) &&
                /<Button type="submit" size="md" unavailable=\{!available\}/.test(functionSource(component, "RowEditor")),
            /\{writable && <DetailSheet key=\{control\.opening\} kind=\{kind\} value=\{value\} open=\{control\.openOn === "phone"\} control=\{control\} \/>\}/.test(functionSource(component, "PhoneDetail")),
            /\) : \(\s*<p className="flex items-start gap-gap text-mobile-body-sm">\{content\}<\/p>\s*\)\}/.test(functionSource(component, "PhoneDetail")),
        ].join(" "),
        "true true true true"
    );
    check("  the note's detail asks the note's rule", /read: \(input\) => readNoteSubmission\(\{ mayWriteNote: true \}, input\),/.test(component.source), true);
    for (const name of ["RowEditor", "DetailSheet"]) {
        const body = functionSource(component, name);
        check(
            `  the ${name === "RowEditor" ? "desk's row" : "phone's sheet"} asks the rule of what is typed against the value it opened on, and sends only what it takes`,
            [
                /const answer = detail\.read\(\{ typed: draft, previous: value, stored: value \}\);/.test(body),
                /if \(answer\.refusal\) \{\s*setPressed\(true\);/.test(body),
                /if \(answer\.unchanged\) \{\s*(onClose|control\.close)\(\);\s*return;\s*\}\s*control\.send\(\{ typed: draft, previous: value, by: "submit" \}\);/.test(body),
                /refusal=\{\(pressed \? answer\.refusal : null\) \?\? server\.taken\}\s*notice=\{server\.said\}\s*count=\{detail\.count\?\.\(draft\.length\)\}/.test(body),
            ].join(" "),
            "true true true true"
        );
        // WHAT THE SERVER SAID STANDS IN THE LINE'S PLACE, THE COUNT KEPT (1f, 1j-b2, 1j-b3; #614): a
        // value somebody else changed first is the field's `notice`, where the help was, and no line of
        // its own under the field, as the files of 2026-11-05 draw it.
        check(
            `  the ${name === "RowEditor" ? "desk's row" : "phone's sheet"} says the server's answer as the field's notice, and draws no line of its own under it (#614)`,
            [/notice=\{server\.said\}/.test(body), /<Refusal>\{server\.said\}<\/Refusal>/.test(body)].join(" "),
            "true false"
        );
    }
    // THE FIELD'S NOTICE (#614): after a refusal of the value and before a note and the help, at Ink 2
    // behind the 16 info mark, 6 from it, and at the phone's 15 in a sheet, the count staying at the end.
    const fieldSource = functionSource(parseFile("app/components/Controls.js"), "Field");
    check(
        "  the field draws a notice in the line's place at Ink 2 behind the info mark, after a refusal and before a note and the help (#614)",
        [
            /const said = refusal \|\| notice \|\| note \|\| help;/.test(fieldSource),
            /\) : notice \? \(\s*<p role="alert" className="flex items-start gap-refusal-gap text-foreground-muted">\s*<span className=\{`flex h-\[var\(--text-body-sm--line-height\)\] shrink-0 items-center \$\{xl \? "max-sm:h-\[var\(--text-mobile-body-sm--line-height\)\]" : ""\}`\}>\s*<InfoMark size="size-icon" \/>/.test(fieldSource),
            /\{message\}\s*<span id=\{countId\} className=\{`ml-auto shrink-0 tabular-nums/.test(fieldSource),
        ].join(" "),
        "true true true"
    );
    // A CLEARED FIELD SAVED REMOVES IT, AND NO CONTROL OF ITS OWN DOES (1f, since the files of 2026-11-04):
    // the desk's dialog drew `Remove note` from #533, and its `-ing` word is the cleared save's now.
    check(
        "  no Remove note: a cleared field is a removal, said as one",
        [!Object.hasOwn(ASSET_NOTE_COPY, "remove"), !/Remove note|COPY\.remove\b/.test(component.source.replace(/\/\*[^]*?\*\//g, "").replace(/\/\/.*$/gm, "")), /if \(detail\.valueOf\(answer\) === ""\) return "remove";/.test(component.source)].join(" "),
        "true true true"
    );

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

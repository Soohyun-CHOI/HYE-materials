// What the office may do to an asset nothing has happened to (#583): who may change an asset's job,
// to which jobs, what a Save writes and in which order, a change left half done, and where the
// screens and the action ask.
//
// BY VALUE, THE RULE. `planOfficeActs`, `readJobChange` and `startingJob` are pure, so the
// condition — the office, and a history holding its `Created` entry alone, whoever else the reader
// is — the jobs it offers, which are a list's job choice's in its order, the two halves a Save
// writes, a half-done change finished by the next Save, and the order the refusals are asked in
// are asserted on inputs, as is every word `ASSET_OFFICE_COPY` holds.
//
// OFF THE SOURCE, THE WIRING. That the action is the office's wrapper round a handler kept in,
// asks the plan again of what it read, refuses before it writes, writes the entry before the
// asset and catches only the second write, and records no row of its own; that the one writer of
// an `Asset Log` row refuses all but an asset's only `Created` row and writes its `Job` alone;
// that the page asks the plan of reads it already makes; that the menu puts the line after the
// sending and parts it from the acts that end the item with a rule; that the dialog and the sheet
// ask the rule before they send and the sheet's rows save nothing; and that the provider says a
// refusal under the status once no dialog of its own says it. Source order is not execution order
// (`_ast.mjs`), and a browser is where the screens are seen.
//
// WHAT IT CANNOT SEE: a write that fails. The half-done sentence is held by value and the catch
// that says it off the source; the base was never made to refuse the second write.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { ASSET_OFFICE_COPY, planOfficeActs, readJobChange, startingJob } from "../../../lib/assetOfficeActs.js";
import { assetListScope } from "../../../lib/assetListView.js";
import { ASSET_EVENT } from "../../../lib/assetStatus.js";
import { insideTry, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What the office may do to an asset nothing has happened to: its job (#583)";

const OFFICE = "lib/assetOfficeActs.js";
const ACTIONS = "app/(assets)/assets/[assetId]/officeActions.js";
const LOG_WRITER = "lib/airtable/assetLog.js";
const PAGE = "app/(assets)/assets/[assetId]/page.js";
const MENU = "app/(assets)/assets/[assetId]/MoreActions.js";
const DIALOGS = "app/(assets)/assets/[assetId]/JobChange.js";
const PROVIDER = "app/(assets)/assets/[assetId]/AssetTransition.js";
const FRAME = "app/components/DialogFrame.js";

// Three jobs handed over out of their codes' order, as the base hands its table over.
const JOB_C = { id: "recJobC", jobCode: "26-USA-07", jobName: "Third" };
const JOB_A = { id: "recJobA", jobCode: "26-USA-05", jobName: "First" };
const JOB_B = { id: "recJobB", jobCode: "26-USA-06", jobName: "Second" };
const JOBS = [JOB_C, JOB_A, JOB_B];

const created = (job) => ({ id: "recEntry1", event: ASSET_EVENT.CREATED, job: job ? [job.id] : [] });
const event = (name, n) => ({ id: `recEntry${n}`, event: name, job: [JOB_A.id] });
const user = ({ admin, manager, jobs = [] }) => ({ id: "recUser", isAdmin: admin, isSiteManager: manager, assignedJobs: jobs.map((j) => j.id) });

/** A function's own source, by name, or the empty string. */
function functionSource({ ast, source }, name) {
    const node = resolveFunction(ast, name);
    return node ? source.slice(node.start, node.end) : "";
}

/** The first call to `name` in `root`, as a node. */
function firstCall(root, name) {
    let found = null;
    walk(root, (n) => {
        if (found || n.type !== "CallExpression") return;
        const callee = n.callee?.type === "MemberExpression" ? n.callee.property?.name : n.callee?.name;
        if (callee === name) found = n;
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── who may change an asset's job ───────────────────────────────────────
    log("who may change an asset's job (planOfficeActs):");
    const may = (reader, rows) => planOfficeActs({ user: reader, log: rows, jobs: JOBS }).mayChangeJob;
    const readers = [
        ["the office and a site manager", user({ admin: true, manager: true, jobs: [JOB_A] })],
        ["the office and no site manager", user({ admin: true, manager: false })],
        ["a site manager and not the office", user({ admin: false, manager: true, jobs: [JOB_A, JOB_B] })],
        ["neither", user({ admin: false, manager: false, jobs: [JOB_A] })],
    ];
    const histories = [
        ["its Created entry alone", [created(JOB_A)]],
        ["Created and a check-out", [created(JOB_A), event(ASSET_EVENT.CHECKED_OUT, 2)]],
        ["no row at all", []],
        ["one row that is not Created", [event(ASSET_EVENT.CHECKED_OUT, 1)]],
    ];
    check(
        "the office, whoever else it is, while the history holds its Created entry alone, and nobody else",
        readers.map(([who, reader]) => `${who}: ${histories.map(([what, rows]) => `${what} ${may(reader, rows)}`).join(", ")}`).join(" | "),
        [
            "the office and a site manager: its Created entry alone true, Created and a check-out false, no row at all false, one row that is not Created false",
            "the office and no site manager: its Created entry alone true, Created and a check-out false, no row at all false, one row that is not Created false",
            "a site manager and not the office: its Created entry alone false, Created and a check-out false, no row at all false, one row that is not Created false",
            "neither: its Created entry alone false, Created and a check-out false, no row at all false, one row that is not Created false",
        ].join(" | ")
    );
    check("  the flag as true and nothing truthy besides, as a list reads it", may({ isAdmin: "true" }, [created(JOB_A)]), false);
    check("  nor the President, who is not the office here unless marked so", may({ role: "President", isAdmin: false }, [created(JOB_A)]), false);
    check("  and a missing history is no history", planOfficeActs({ user: user({ admin: true }), log: undefined, jobs: JOBS }).mayChangeJob, false);
    const office = planOfficeActs({ user: user({ admin: true, manager: false }), log: [created(JOB_B)], jobs: JOBS });
    check("the jobs are a list's job choice's, by code, each its id and code", JSON.stringify(office.jobs), JSON.stringify([
        { id: "recJobA", jobCode: "26-USA-05" },
        { id: "recJobB", jobCode: "26-USA-06" },
        { id: "recJobC", jobCode: "26-USA-07" },
    ]));
    check(
        "  the very judgment a list stands on, asked of the same reader",
        office.jobs.map((j) => j.id).join(),
        assetListScope(user({ admin: true, manager: false }), JOBS, null).jobs.map((j) => j.id).join()
    );
    check("  which says whether the reader is the office, the flag read there once", `${assetListScope({ isAdmin: true }, JOBS, null).office} ${assetListScope({ isAdmin: false }, JOBS, null).office}`, "true false");
    check("its Created entry, the row and the job it holds", JSON.stringify(office.created), '{"id":"recEntry1","jobRecordId":"recJobB"}');
    check(
        "a reader who may not is handed no entry and no jobs",
        JSON.stringify(planOfficeActs({ user: user({ admin: false, manager: true, jobs: [JOB_A] }), log: [created(JOB_A)], jobs: JOBS })),
        '{"mayChangeJob":false,"created":null,"jobs":[]}'
    );
    check("  nor an item something has happened to", JSON.stringify(planOfficeActs({ user: user({ admin: true }), log: [created(JOB_A), event(ASSET_EVENT.RETIRED, 2)], jobs: JOBS })), '{"mayChangeJob":false,"created":null,"jobs":[]}');

    // ── what a Save writes ──────────────────────────────────────────────────
    log("");
    log("what a Save writes, in the order it is asked (readJobChange, startingJob):");
    const planOn = (entryJob) => planOfficeActs({ user: user({ admin: true }), log: [created(entryJob)], jobs: JOBS });
    const save = (plan, jobId, assetJob) => JSON.stringify(readJobChange(plan, { jobId, assetJobRecordId: assetJob }));
    const writes = (jobId, entry, asset) => `{"jobRecordId":"${jobId}","writesEntry":${entry},"writesAsset":${asset},"unchanged":${!entry && !asset},"refusal":null}`;
    check("another job moves both halves", save(planOn(JOB_A), JOB_B.id, JOB_A.id), writes(JOB_B.id, true, true));
    check("the job both halves hold writes nothing", save(planOn(JOB_A), JOB_A.id, JOB_A.id), writes(JOB_A.id, false, false));
    check("a half-done change, saved again, writes the asset alone", save(planOn(JOB_B), JOB_B.id, JOB_A.id), writes(JOB_B.id, false, true));
    check("  and is no change while the asset holds the old job", JSON.parse(save(planOn(JOB_B), JOB_B.id, JOB_A.id)).unchanged, false);
    check("  and moved back to the asset's own, writes the entry alone", save(planOn(JOB_B), JOB_A.id, JOB_A.id), writes(JOB_A.id, true, false));
    check("an asset holding no job takes one", save(planOn(JOB_A), JOB_A.id, undefined), writes(JOB_A.id, false, true));
    const refused = (refusal) => `{"jobRecordId":null,"writesEntry":false,"writesAsset":false,"unchanged":false,"refusal":${JSON.stringify(refusal)}}`;
    check("a job the list does not offer is refused", save(planOn(JOB_A), "recNotAJob", JOB_A.id), refused(ASSET_OFFICE_COPY.jobNoneChosen));
    check("  and so is none", save(planOn(JOB_A), "", JOB_A.id), refused(ASSET_OFFICE_COPY.jobNoneChosen));
    const ended = planOfficeActs({ user: user({ admin: true }), log: [created(JOB_A), event(ASSET_EVENT.CHECKED_OUT, 2)], jobs: JOBS });
    check("something recorded since ends it, whatever was chosen", save(ended, JOB_B.id, JOB_A.id), refused(ASSET_OFFICE_COPY.recordedSince));
    check("  answered before a job the list does not offer", save(ended, "recNotAJob", JOB_A.id), refused(ASSET_OFFICE_COPY.recordedSince));
    check("a change opens on its entry's job", startingJob(planOn(JOB_B), JOB_A.id), JOB_B.id);
    check("  the asset's own when the entry holds none, and nothing when neither does", `${startingJob(planOn(null), JOB_A.id)}|${startingJob(planOn(null), undefined)}`, `${JOB_A.id}|`);

    // ── every word ──────────────────────────────────────────────────────────
    log("");
    log("every word the office's acts add (ASSET_OFFICE_COPY):");
    check(
        "the line, the title, the label, the commitment, its working word and the way out",
        [ASSET_OFFICE_COPY.changeJob, ASSET_OFFICE_COPY.jobLabel, ASSET_OFFICE_COPY.jobUnchosen, ASSET_OFFICE_COPY.save, ASSET_OFFICE_COPY.saving, ASSET_OFFICE_COPY.cancel].join(" | "),
        "Change job | Job | Choose a job | Save | Saving… | Cancel"
    );
    check("something recorded since", ASSET_OFFICE_COPY.recordedSince, "Something has been recorded on this item, so its job can't be changed.");
    check(
        "a change left half done, naming both jobs",
        ASSET_OFFICE_COPY.halfDone({ from: "26-USA-05", to: "26-USA-06" }),
        "The Created entry is on 26-USA-06 now, but the item is still on 26-USA-05, and the lists will say so. Save again to finish."
    );
    check("a reader who is not the office", ASSET_OFFICE_COPY.noAccess, "Changing an item's job is for Admins.");
    check("a job the list does not offer", ASSET_OFFICE_COPY.jobNoneChosen, "Choose a job.");
    const officeSource = parseFile(OFFICE).source;
    assert("the module reads no flag of its own, asking the list's judgment whether the reader is the office", !/\.isAdmin\b/.test(officeSource) && /const scope = assetListScope\(user, jobs, null\);/.test(officeSource) && /if \(!scope\.office \|\| !created\)/.test(officeSource));

    // ── the one edit Asset Log takes ────────────────────────────────────────
    log("");
    log("the one edit an Asset Log row takes (updateCreatedEntryJob):");
    const writerFile = parseFile(LOG_WRITER);
    const writer = resolveFunction(writerFile.ast, "updateCreatedEntryJob");
    const writerSource = writer ? writerFile.source.slice(writer.start, writer.end) : "";
    assert("  updateCreatedEntryJob was found", writerSource !== "");
    const update = firstCall(writer ?? {}, "update");
    const guards = [
        /if \(!jobRecordId\) throw new Error\(/,
        /if \(entry\?\.event !== ASSET_EVENT\.CREATED\) \{\s*throw new Error\(/,
        /const rows = asset\?\.assetLog \|\| \[\];\s*if \(rows\.length !== 1 \|\| rows\[0\] !== entry\.id\) \{\s*throw new Error\(/,
    ].map((re) => {
        const m = re.exec(writerSource);
        return m && update ? writer.start + m.index < update.start : false;
    });
    check("it refuses no job, a row not Created and a row not its asset's only one, each before the write", guards.join(" "), "true true true");
    check(
        "  and writes the row's Job alone, in the batch form",
        update ? writerFile.source.slice(update.start, update.end) : "none",
        "base(TABLES.ASSET_LOG).update([{ id: entry.id, fields: { Job: [jobRecordId] } }])"
    );
    let logUpdates = 0;
    walk(writerFile.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.property?.name === "update") logUpdates++;
    });
    check("  the one update anywhere in the table's module", logUpdates, 1);
    const assetsFile = parseFile("lib/airtable/assets.js");
    const jobWriter = resolveFunction(assetsFile.ast, "updateAssetJob");
    const jobUpdate = firstCall(jobWriter ?? {}, "update");
    check(
        "the asset's writer refuses no asset and no job, and writes its Job alone",
        `${/if \(!assetRecordId\) throw/.test(functionSource(assetsFile, "updateAssetJob"))} ${/if \(!jobRecordId\) throw/.test(functionSource(assetsFile, "updateAssetJob"))} ${jobUpdate ? assetsFile.source.slice(jobUpdate.start, jobUpdate.end) : "none"}`,
        "true true base(TABLES.ASSETS).update([{ id: assetRecordId, fields: { Job: [jobRecordId] } }])"
    );

    // ── the action ──────────────────────────────────────────────────────────
    log("");
    log("the action asks again, refuses before it writes, and writes the entry first:");
    const actions = parseFile(ACTIONS);
    let wrapped = "none";
    walk(actions.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "changeAssetJobAction") wrapped = actions.source.slice(n.init.start, n.init.end).replace(/\s+/g, " ");
    });
    check(
        "the office's wrapper round the handler, refusing with the page drawn again and its sentence",
        wrapped,
        "withAdminAction(() => { refresh(); return { error: COPY.noAccess }; }, changeAssetJobHandler)"
    );
    const handler = resolveFunction(actions.ast, "changeAssetJobHandler");
    const handlerSource = functionSource(actions, "changeAssetJobHandler");
    const at = (text) => handlerSource.indexOf(text);
    assert("  its scope the action's own name", /withOpsLabel\("changeAssetJobAction",/.test(handlerSource));
    assert("  the asset read by the printed id the form carries", /const asset = await getAssetByAssetId\(String\(formData\.get\("assetId"\) \?\? ""\)\);/.test(handlerSource));
    assert(
        "  its one row read, with the job list, only while it has one — the ids standing for the rows otherwise",
        /rowIds\.length === 1\s*\?\s*await Promise\.all\(\[getAssetLogByAsset\(asset\.id, \{ rowIds \}\), getAllJobs\(\)\]\)\s*:\s*(\/\/[^\n]*\n\s*)?\[rowIds\.map\(\(id\) => \(\{ id \}\)\), \[\]\];/.test(handlerSource)
    );
    assert("  the plan asked of what it read", /const plan = planOfficeActs\(\{ user, log, jobs \}\);/.test(handlerSource));
    assert(
        "  the rule asked of the job sent and the asset's own",
        /readJobChange\(plan, \{\s*jobId: String\(formData\.get\("jobId"\) \?\? ""\),\s*assetJobRecordId: asset\.job\?\.\[0\] \?\? null,\s*\}\)/.test(handlerSource)
    );
    const refusesAt = at("if (answer.refusal) return refuse(answer.refusal);");
    const entryAt = at("await updateCreatedEntryJob({ asset, entry: log[0], jobRecordId: answer.jobRecordId });");
    const assetAt = at("await updateAssetJob({ assetRecordId: asset.id, jobRecordId: answer.jobRecordId });");
    const landsAt = at("redirect(assetPath(asset.assetId));");
    check("  a refusal before either write, the entry before the asset, and the landing last", [refusesAt > 0, refusesAt < entryAt, entryAt < assetAt, assetAt < landsAt].join(" "), "true true true true");
    assert("  each half written only where it differs", /if \(answer\.writesEntry\) \{\s*await updateCreatedEntryJob\(/.test(handlerSource) && /if \(answer\.writesAsset\) \{\s*try \{\s*await updateAssetJob\(/.test(handlerSource));
    check("  the asset's job alone, its status written by no cache write", /updateAssetCache|statusAfterEvent|status:/.test(actions.source), false);
    const entryCall = firstCall(handler ?? {}, "updateCreatedEntryJob");
    const assetCall = firstCall(handler ?? {}, "updateAssetJob");
    const landing = firstCall(handler ?? {}, "redirect");
    check(
        "  the entry's write not caught and the asset's caught, the landing outside both",
        [entryCall && insideTry(handler, entryCall), assetCall && insideTry(handler, assetCall), landing && insideTry(handler, landing)].join(" "),
        "false true false"
    );
    assert(
        "  a failed asset write named on the page with both jobs, never written back",
        /\} catch \(error\) \{[\s\S]*console\.error\([\s\S]*return refuse\(COPY\.halfDone\(\{ from: codeOf\(asset\.job\?\.\[0\]\), to: codeOf\(answer\.jobRecordId\) \}\)\);\s*\}/.test(handlerSource) &&
            (handlerSource.match(/updateAssetJob\(|updateCreatedEntryJob\(/g) ?? []).length === 2
    );
    check("  and no row records the change", /createAssetLogEntry|createFirstAssetLogEntries|writeEvent/.test(actions.source), false);
    check("a refusal draws the page again and says its sentence", functionSource(actions, "refuse").replace(/\s+/g, " "), "function refuse(error) { refresh(); return { error }; }");

    // ── the page ────────────────────────────────────────────────────────────
    log("");
    log("the page asks the plan of what it already read:");
    const page = parseFile(PAGE);
    assert("  of the reader, the history and the job list", /const office = planOfficeActs\(\{ user, log, jobs \}\);/.test(page.source));
    const airtableImports = page.ast.body
        .filter((n) => n.type === "ImportDeclaration" && /lib\/airtable\//.test(n.source.value))
        .map((n) => `${n.source.value}: ${n.specifiers.map((s) => s.imported?.name ?? s.local.name).sort().join(",")}`)
        .sort();
    check(
        "  and reads nothing it did not read before",
        airtableImports.join(" | "),
        [
            "@/lib/airtable/assetCategories: getAssetCategoriesByRecordIds",
            "@/lib/airtable/assetLog: getAssetLogByAsset,getRecentCheckOuts",
            "@/lib/airtable/assets: getAssetByAssetId",
            "@/lib/airtable/jobs: getAllJobs",
            "@/lib/airtable/users: getUsersByRecordIds",
        ].join(" | ")
    );
    assert("  handing the plan and the asset's job to the provider", /office=\{office\}\s*assetJobRecordId=\{asset\.job\?\.\[0\] \?\? null\}/.test(page.source));

    // ── the menu ────────────────────────────────────────────────────────────
    log("");
    log("More actions holds the line after the sending, ruled off from what ends the item:");
    const menu = parseFile(MENU).source;
    assert("  offered where the office's plan says", /const mayChangeJob = Boolean\(transition\?\.office\?\.mayChangeJob\);/.test(menu) && /\.\.\.\(mayChangeJob\s*\?/.test(menu));
    assert(
        "  after the sending among the acts that end nothing, the retirement among those that end the item",
        menu.indexOf('key: "repair"') < menu.indexOf('key: "job"') &&
            menu.indexOf("const acts = [") < menu.indexOf('key: "repair"') &&
            menu.indexOf('key: "job"') < menu.indexOf("const ends = [") &&
            menu.indexOf("const ends = [") < menu.indexOf('key: "retire"')
    );
    assert(
        "  the rule over the first that ends it, only where the office's line stands above it",
        /key: "retire",\s*label: ASSET_TRANSITION_COPY\.retireOpener,\s*tone: "danger",\s*separated: mayChangeJob,/.test(menu) && (menu.match(/separated: /g) ?? []).length === 2
    );
    assert("  the menu's items the acts, the ends and the account, in that order", /items=\{\[\s*\.\.\.acts,\s*\.\.\.ends,\s*\.\.\.\(phone && account/.test(menu));
    assert(
        "  the line the copy's own, in Ink, opening this width's own change with focus on the button",
        /key: "job",\s*label: ASSET_OFFICE_COPY\.changeJob,\s*onSelect: \(\) => \{\s*buttonRef\.current\?\.focus\(\);\s*setOpen\(false\);\s*transition\.jobChange\.start\(phone \? "phone" : "desk"\);/.test(menu) &&
            !/key: "job",[^}]*tone:/.test(menu)
    );
    assert("  each width drawing its own: the sheet on a phone, the dialog at a desk", /\{mayChangeJob && \(phone \? <JobChangeSheet \/> : <JobChangeDialog \/>\)\}/.test(menu));

    // ── the dialog and the sheet ────────────────────────────────────────────
    log("");
    log("the dialog and the sheet ask the rule before they send:");
    const dialogs = parseFile(DIALOGS);
    for (const [name, width] of [
        ["JobChangeForm", "the desk's dialog"],
        ["JobChangeRows", "the phone's sheet"],
    ]) {
        const body = functionSource(dialogs, name);
        assert(`  ${width} opens on the entry's job`, /useState\(\(\) => startingJob\(plan, assetJobRecordId\)\)/.test(body));
        assert(`  ${width} asks readJobChange of the job chosen and the asset's own`, /const answer = readJobChange\(plan, \{ jobId, assetJobRecordId \}\);/.test(body));
        assert(
            `  ${width} sends nothing on a refusal, and closes on no change`,
            /if \(answer\.refusal\) \{\s*setPressed\(true\);[\s\S]*?return;\s*\}\s*if \(answer\.unchanged\) \{\s*onClose\(\);\s*return;\s*\}/.test(body) &&
                body.indexOf("if (answer.unchanged)") < body.indexOf("onSend(")
        );
        assert(`  ${width} titled with the line's words and busy while it sends`, /title=\{COPY\.changeJob\}/.test(body) && /busy=\{pending\}/.test(body));
    }
    const desk = functionSource(dialogs, "JobChangeForm");
    assert("  the desk's choice the field's, posting the job chosen", /<Field label=\{COPY\.jobLabel\} labelAs="span"/.test(desk) && /<Choice name="jobId" options=\{options\} value=\{jobId\} onChange=\{setJobId\}/.test(desk));
    assert("  its commitment Save, saying Saving… while it sends, beside Cancel", /<Button type="submit" busyLabel=\{COPY\.saving\}>\s*\{COPY\.save\}/.test(desk) && /\{COPY\.cancel\}/.test(desk) && /<DialogActions refusal=\{refusal\}>/.test(desk));
    const sheet = functionSource(dialogs, "JobChangeRows");
    assert("  the sheet's Save at its head's end, saying Saving… while it sends", /done=\{\{ label: COPY\.save, onPress: save, busyLabel: COPY\.saving \}\}/.test(sheet) && /\bsheet\b\s*closesOnBackdrop/.test(sheet));
    assert("  its rows move the check and save nothing", /onPress: \(\) => setJobId\(job\.id\),/.test(sheet) && /chosen: job\.id === jobId,/.test(sheet));
    assert("  its Save posting the asset and the job chosen", /formData\.set\("assetId", assetId\);\s*formData\.set\("jobId", jobId\);\s*onSend\(formData\);/.test(sheet));
    assert("  a refusal said under the rows", /<Refusal>\{said\}<\/Refusal>/.test(sheet) && /const said = refusal \?\? \(pressed \? answer\.refusal : null\);/.test(sheet));
    check(
        "each opens at its own width",
        `${/open=\{jobChange\.openOn === "desk"\}/.test(functionSource(dialogs, "JobChangeDialog"))} ${/open=\{jobChange\.openOn === "phone"\}/.test(functionSource(dialogs, "JobChangeSheet"))}`,
        "true true"
    );
    const said = [...dialogs.source.matchAll(/\bCOPY\.(\w+)/g)].map((m) => m[1]);
    check("every word either draws is the copy's", said.filter((key) => !(key in ASSET_OFFICE_COPY)).join(","), "");
    assert("  and the reader of it reads words", said.length >= 6);
    const frame = parseFile(FRAME);
    const rows = functionSource(frame, "SheetRows");
    assert(
        "a sheet's rows lock while it sends: no press, no Wash, their look kept",
        /const locked = Boolean\(useFormBusy\(\)\);/.test(rows) && /aria-disabled=\{locked \|\| undefined\}/.test(rows) && /onClick=\{locked \? undefined : row\.onPress\}/.test(rows) && /not-aria-disabled:active:bg-hover-subtle/.test(rows) && !/[" ]active:bg-hover-subtle/.test(rows)
    );

    // ── where the answer is said ────────────────────────────────────────────
    log("");
    log("where the provider says the answer:");
    const provider = parseFile(PROVIDER).source;
    assert("  it binds the action, so the answer outlives the dialog", /const \[jobAnswer, jobFormAction, jobPending\] = useActionState\(changeAssetJobAction, null\);/.test(provider));
    assert("  a change the plan no longer offers is no longer open", /if \(changingOn !== null && !office\?\.mayChangeJob\) setChangingOn\(null\);/.test(provider));
    assert("  said in the dialog only by the opening that sent it, while open", /const jobSaidInDialog = changingOn !== null && jobSentFor === jobOpening;/.test(provider) && /refusal: jobSaidInDialog \? jobSentence : null,/.test(provider));
    assert(
        "  and under the status otherwise, when it was sent last",
        /statusSentence: lastSent === "job" \? \(jobSaidInDialog \? null : jobSentence\) : open \? null : transitionSentence,/.test(provider)
    );
    assert(
        "  a send recording which opening sent it and that it was last",
        /send: \(formData\) => \{\s*setJobSentFor\(jobOpening\);\s*setLastSent\("job"\);\s*startTransition\(\(\) => jobFormAction\(formData\)\);\s*\},/.test(provider)
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the readers can fail:");
    const planted = parseSource(
        "export async function updateCreatedEntryJob({ entry, jobRecordId }) { await base(TABLES.ASSET_LOG).update([{ id: entry.id, fields: { Job: [jobRecordId], Event: \"Created\" } }]); }\n",
        "<planted-writer>"
    );
    const plantedCall = firstCall(resolveFunction(planted.ast, "updateCreatedEntryJob"), "update");
    check("  a planted writer writing a second field is told apart", planted.source.slice(plantedCall.start, plantedCall.end) === "base(TABLES.ASSET_LOG).update([{ id: entry.id, fields: { Job: [jobRecordId] } }])", false);
    check("  a word no copy holds is seen", ["changeJob", "rename"].filter((key) => !(key in ASSET_OFFICE_COPY)).join(","), "rename");
}

if (isMain(import.meta.url)) standalone(title, run);

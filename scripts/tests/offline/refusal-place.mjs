// Where an item page's refused press is said, as the files of 2026-11-05 draw it (#614).
//
// THREE PLACES, BY WHERE THE PRESS WAS. At a desk a dialog or a question stands until the reader
// closes it and says every answer its press gets above its actions, its commitment `unavailable`
// and described by the sentence once the page drawn again no longer offers the act; a desk's press
// with no dialog says its answer in 0k's toast; on a phone every answer to a sheet or a question
// closes it and the Notice under the status says it. The provider decides all three
// (`AssetTransition.js`), so this reads it and the six dialogs it draws off their sources, beside
// planted providers and dialogs drawn the way #614 replaced.
//
// WHAT IT CANNOT SEE: whether a dialog stays on screen as a page re-renders under it, where focus
// stands, and what a toast looks like — a browser's, measured into the pull request.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { parseSource, parseFile } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { ASSET_COPY } from "../../../lib/assetView.js";
import { ASSET_EVENT, ASSET_STATUS } from "../../../lib/assetStatus.js";
import { planTransition, recordingRefusal } from "../../../lib/assetTransition.js";

export const title = "Where an item page's refused press is said — the dialog, the toast or the Notice (#614)";

const DIR = "app/(assets)/assets/[assetId]/";
const PROVIDER = `${DIR}AssetTransition.js`;
const REFUSAL = `${DIR}TransitionRefusal.js`;

/**
 * Each dialog the provider draws: its component, its file, its live condition, its held content, the
 * answer it says and how it sends.
 */
const DIALOGS = [
    {
        name: "TransitionForm",
        file: "TransitionForm.js",
        gate: "opening > 0",
        available: "plan.records && plan.event === openedFor",
        held: "heldPlan",
        said: "eventSaidInDialog ? transitionSentence : null",
        send: 'onSend={(formData) => send(formData, "dialog")}',
    },
    {
        name: "LendForm",
        file: "LendDialog.js",
        gate: "plan.mayLend || lending.count > 0",
        available: "plan.mayLend",
        held: "heldLendPlan",
        said: "lending.said ? lendSentence : null",
        send: 'onSend={sendFrom(lending, "lend", lendFormAction)}',
    },
    {
        name: "JobChangeForm",
        file: "JobChange.js",
        gate: "office?.mayChangeJob || changing.count > 0",
        available: "Boolean(office?.mayChangeJob)",
        held: "heldOffice",
        said: "changing.said ? jobSentence : null",
        send: 'onSend={sendFrom(changing, "job", jobFormAction)}',
    },
    {
        name: "RetirementConfirm",
        file: "RetirementConfirm.js",
        gate: "plan.mayRetire || retiring.count > 0",
        available: "plan.mayRetire",
        held: null,
        said: "retiring.said ? retireSentence : null",
        send: 'send={sendFrom(retiring, "retire", retireFormAction)}',
    },
    {
        name: "ReturnConfirm",
        file: "ReturnConfirm.js",
        gate: "plan.mayReturn || returning.count > 0",
        available: "plan.mayReturn",
        held: "heldReturnPlan",
        said: "returning.said ? returnSentence : null",
        send: 'send={sendFrom(returning, "return", returnFormAction)}',
    },
    {
        name: "DeleteConfirm",
        file: "DeleteConfirm.js",
        gate: "office?.mayDelete || deleting.count > 0",
        available: "Boolean(office?.mayDelete)",
        held: null,
        said: "deleting.said ? deleteSentence : null",
        send: 'send={sendFrom(deleting, "delete", deleteFormAction)}',
    },
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One element's attributes as the provider writes it, up to its own `/>` — never the next element's. */
export function elementOf(source, name) {
    return new RegExp(`<${name}\\b([\\s\\S]*?)\\n\\s*\\/>`).exec(source)?.[1] ?? "";
}

/** Whether an element's attributes hold what it was opened on, every use of the held value included. */
export function drawsHeld(element, held) {
    const uses = element.match(new RegExp(`\\{${held}(\\.[a-zA-Z]+)?( \\?\\? "")?\\}`, "g")) ?? [];
    return uses.length > 0 && !/\{plan\.|\{office\}|\{plan\}/.test(element.replace(/available=\{[^}]*\}/, ""));
}

/** What the provider's source says of each place, read apart so a planted one can be judged. */
export function providerFacts(source) {
    const opening = source.slice(source.indexOf("function useOpening("), source.indexOf("export default function AssetTransition("));
    return {
        opening: [
            /const said = on !== null && sentFor === count;/.test(opening),
            /answered: said && !pending && answer !== null && answer !== before,/.test(opening),
            /end: \(\) => \{\s*setOn\(null\);\s*setCount\(\(n\) => n \+ 1\);\s*\},/.test(opening),
            /sent: \(\) => \{\s*setSentFor\(count\);\s*setBefore\(answer\);\s*\},/.test(opening),
        ].join(" "),
        held: /export function useHeldWhileOpen\(open, value\) \{\s*const \[held, setHeld\] = useState\(value\);\s*if \(!open && held !== value\) setHeld\(value\);\s*return open \? held : value;\s*\}/.test(source),
        // What each opening holds, as written: a value built in the render differs every render, so the
        // hook sets it again on every one and React gives up (`Too many re-renders`).
        heldValues: [...source.matchAll(/const \w+ = useHeldWhileOpen\([^,]+,\s*([^)]*?)\);/g)].map((match) => match[1]).join(" "),
        // Every `.end()` the page makes is a phone's: five sheets or questions, two details, and the loop.
        phoneEnds: [
            /if \(phone\(retiring\) && \(!plan\.mayRetire \|\| retiring\.answered\)\) retiring\.end\(\);/,
            /if \(phone\(lending\) && \(!plan\.mayLend \|\| lending\.answered\)\) lending\.end\(\);/,
            /if \(phone\(returning\) && \(!plan\.mayReturn \|\| returning\.answered\)\) returning\.end\(\);/,
            /if \(phone\(changing\) && \(!office\?\.mayChangeJob \|\| changing\.answered\)\) changing\.end\(\);/,
            /if \(phone\(deleting\) && \(!office\?\.mayDelete \|\| deleting\.answered\)\) deleting\.end\(\);/,
        ]
            .map((re) => re.test(source))
            .join(" "),
        ends: (source.match(/\.end\(\)/g) ?? []).length,
        guardedEnds: (source.match(/(phone\((retiring|lending|returning|changing|deleting|each)\)[^;\n]*|openOn === "phone"[^;\n]*)\.end\(\)/g) ?? []).length,
        toast: [
            /const toastShown = eventVia === "desk" && lastSent === "event" && !pending && transitionSentence !== null && answer !== dismissed;/.test(source),
            /<Toast\s+shown=\{toastShown\}\s+line=\{transitionSentence\}\s+dismissLabel=\{ASSET_COPY\.dismiss\}\s+onDismiss=\{\(\) => setDismissed\(answer\)\}\s+opener=\{pressedOn\}\s+desk\s*\/>/.test(source),
            (source.match(/if \(via === "desk"\) pressedOn\.current = document\.activeElement instanceof HTMLElement \? document\.activeElement : null;/g) ?? []).length === 2,
        ].join(" "),
        status: /event: eventSaidInDialog \|\| eventVia === "desk" \? null : transitionSentence,/.test(source),
    };
}

/** What a dialog's commitment does once the page drawn again no longer offers its act. */
export function commitmentOf(source) {
    return {
        named: /<DialogActions refusal=\{refusal\} refusalId=\{refusalId\}>/.test(source) && /const refusalId = useId\(\);/.test(source),
        turnedAway: /type="submit" unavailable=\{!available\} describedBy=\{!available && refusal \? refusalId : undefined\}/.test(source),
        disabled: /<Button[^>]*\bdisabled=/.test(source),
    };
}

export function run({ check, assert, log }) {
    const provider = parseFile(PROVIDER);
    // Read over either line ending: a checkout made with `core.autocrlf` holds CRLF, where a planted
    // `\n` below would match nothing.
    provider.source = provider.source.replace(/\r\n/g, "\n");
    const facts = providerFacts(provider.source);
    assert("the provider and its component were found", /export default function AssetTransition\(/.test(provider.source));

    // A READER WHO IS NO LONGER A SITE MANAGER IS TOLD WHOSE ITEM IT IS (#614). The gate turns the press
    // away before any body runs, and the item page's refusal answers with the plan of a reader who
    // records on nothing (`refuseNotASiteManager`), which names the job the item stands on as a site
    // manager off it is told — the owner job of an item on loan is not it. Said in the places below,
    // as every answer is; `offline/site-manager.mjs` holds which refusal each action passes.
    log("a press from a reader who is no longer a site manager names the item's job:");
    const jobs = [
        { id: "recJob7", jobCode: "26-USA-07" },
        { id: "recJob9", jobCode: "26-USA-09" },
    ];
    const asGate = recordingRefusal(planTransition({ user: null, jobs, status: ASSET_STATUS.IN_STOCK, assetJobId: "recJob7", ownerJobId: "recJob9" }), {
        drawnJobId: "recJob7",
        attempted: null,
    });
    const demoted = recordingRefusal(
        planTransition({ user: { isSiteManager: false, assignedJobs: ["recJob7"] }, jobs, status: ASSET_STATUS.OUT, assetJobId: "recJob7", ownerJobId: "recJob7" }),
        { drawnJobId: "recJob7", attempted: ASSET_EVENT.CHECKED_IN }
    );
    check(
        "  the gate's refusal and a body's say one sentence, naming the job the item stands on",
        `${asGate} | ${demoted}`,
        "Only 26-USA-07 can record this item. Nothing was saved. | Only 26-USA-07 can record this item. Nothing was saved."
    );

    log("an opening knows its width, whether it says its answer, and whether that answer has come:");
    check("  said while it stands and sent it; answered once its own answer is back; ended as a new one; sent marking both", facts.opening, "true true true true");
    check("  and holds what it was opened on while it stands", facts.held, true);
    check("  each holding a value the page hands down, which keeps its identity between renders", facts.heldValues, "plan plan plan office");

    log("");
    log("a desk's dialog stands and says its answer, its commitment asking the page as it is:");
    for (const d of DIALOGS) {
        const gated = new RegExp(`\\{\\(?${escape(d.gate)}\\)? && \\(\\s*(<>\\s*)?<${d.name}\\b`);
        const element = elementOf(provider.source, d.name);
        check(
            `  ${d.name} is drawn while the page offers it or once it opened, and told whether it still does`,
            gated.test(provider.source) && element.includes(`available={${d.available}}`),
            true
        );
        if (d.held) check(`  ${d.name} draws what it was opened on`, drawsHeld(element, d.held), true);
        check(
            `  ${d.name} says the answer its own opening sent, while it stands, and sends as that opening (#614)`,
            `${element.includes(`refusal={${d.said}}`)} ${element.includes(d.send)}`,
            "true true"
        );
        const commitment = commitmentOf(parseFile(`${DIR}${d.file}`).source);
        check(`  ${d.name}'s commitment turned away and described by why, nothing disabled`, `${commitment.named} ${commitment.turnedAway} ${commitment.disabled}`, "true true false");
    }
    const controls = parseFile("app/components/Controls.js").source;
    check(
        "  the sentence's line taking the id its commitment names",
        /export function Refusal\(\{ centered = false, role = "alert", id, children \}\) \{\s*return \(\s*<p\s+id=\{id\}/.test(controls),
        true
    );

    log("");
    log("a phone's sheet or question closes on its answer, and the status says it:");
    check("  each of the five ends on the plan or its own answer", facts.phoneEnds, "true true true true true");
    check("  and every end the page makes is a phone's", `${facts.ends} ${facts.guardedEnds}`, "10 10");
    const refusal = parseFile(REFUSAL).source;
    // A PHONE'S SHEET SAYS ITS OWN PRESS'S REFUSAL — no job chosen — and the server's answer closes it,
    // so the lending's rows are handed none; the job change's are read in asset-office-acts.mjs.
    const lend = parseFile(`${DIR}LendDialog.js`).source;
    const lendRows = lend.slice(lend.indexOf("export function LendRows("));
    const lendForm = lend.slice(lend.indexOf("export function LendForm("), lend.indexOf("export function LendRows("));
    check(
        "  the lending's rows and its desk field say their own press's refusal, the rows handed no other (#614)",
        [
            /export function LendRows\(\{ open, onClose, assetId, drawnJobId, plan, pending, onSend \}\)/.test(lendRows),
            /<DialogActions refusal=\{pressed \? answer\.refusal : null\}>/.test(lendRows),
            /refusal=\{pressed \? answer\.refusal : null\}\s*>\s*<Choice\b/.test(lendForm),
        ].join(" "),
        "true true true"
    );
    check(
        "  the status's sentence a phone's Notice alone",
        `${/<div className="mt-mobile-title-alert-stack sm:hidden">\s*<Notice>\{sentence\}<\/Notice>\s*<\/div>/.test(refusal)} ${/<Refusal\b|max-sm:hidden/.test(refusal)}`,
        "true false"
    );

    log("");
    log("a desk's press with no dialog says its answer in the toast:");
    check("  shown for a desk's press until dismissed or the next, hidden on a phone, handing focus back to what was pressed", facts.toast, "true true true");
    check("  and not under the status as well", facts.status, true);
    check("  its × named in the page's word", ASSET_COPY.dismiss, "Dismiss");

    // ANTI-VACUITY: the readers see a provider and a dialog drawn the way #614 replaced.
    log("");
    log("anti-vacuity — the readers fail on what #614 replaced:");
    const planted = providerFacts(
        provider.source
            .replace("if (phone(lending) && (!plan.mayLend || lending.answered)) lending.end();", "if (lending.on !== null && !plan.mayLend) lending.end();")
            .replace('const toastShown = eventVia === "desk"', 'const toastShown = eventVia === "phone"')
            .replace("answered: said && !pending && answer !== null && answer !== before,", "answered: said && answer !== null,")
    );
    check("  a desk's lending ended by the page is seen", `${planted.phoneEnds} ${planted.ends} ${planted.guardedEnds}`, "true false true true true 10 9");
    check("  a toast on a phone's press is seen", planted.toast.startsWith("false"), true);
    check("  an answer counted before it came back is seen", planted.opening, "true false true true");
    const built = providerFacts(
        provider.source.replace("useHeldWhileOpen(returning.on !== null, plan)", "useHeldWhileOpen(returning.on !== null, { ownerJobCode: plan.ownerJobCode })")
    );
    check("  a held value built in the render is seen", built.heldValues, "plan { ownerJobCode: plan.ownerJobCode } plan office");
    const unheld = provider.source.replace("plan={heldLendPlan}\n                        pending={lendPending}\n                        refusal=", "plan={plan}\n                        pending={lendPending}\n                        refusal=");
    check(
        "  a desk's dialog drawn on the page as it is, beside a sheet that still holds it, is seen",
        `${unheld !== provider.source} ${drawsHeld(elementOf(unheld, "LendForm"), "heldLendPlan")} ${drawsHeld(elementOf(unheld, "LendRows"), "heldLendPlan")}`,
        "true false true"
    );
    const disabledDialog = commitmentOf(parseSource('export default function D({ available }) { return <DialogActions refusal={refusal}><Button type="submit" disabled={!available}>Lend</Button></DialogActions>; }\n', "<planted>").source);
    check("  a commitment disabled rather than turned away is seen", `${disabledDialog.named} ${disabledDialog.turnedAway} ${disabledDialog.disabled}`, "false false true");
}

if (isMain(import.meta.url)) standalone(title, run);

// What a failed rollback says, and that no restore can go quiet again (#188).
//
// THE SILENT MUTANT THIS EXISTS FOR is the one this issue's own shape invites: the
// report is reachable only when an Airtable write fails INSIDE a rollback, which no
// form can produce, so a builder that never says anything — or says the retry
// sentence either way — ships having been read by nobody and looks exactly like the
// ordinary day. Every turn that goes wrong still ends with a red box, and the box
// says what it always said.
//
// SO THE FIRST ASSERTION IS THAT THE TWO VOICES DIVERGE AT ALL, before any wording,
// and the second is that ONE failed restore and THREE do not produce the same
// sentence — which is the issue's second decision made checkable rather than
// described. `pr-kind.mjs` and `pr-wait.mjs` open the same way.
//
// THE SECOND MUTANT IS SPECIFIC TO THIS FILE'S SUBJECT: the catch is fixed in one
// place and another site goes on swallowing. That one is structural rather than
// behavioral — `.catch(() => {})` and a `Promise.allSettled` whose results are
// discarded were the two shapes, three sites by the first and four by the second —
// so the last section asserts that neither shape exists anywhere in
// `app/prs/[prId]/actions.js`, and proves the matchers can see them by planting both
// in a source string beside the assertion.

import { readFileSync } from "node:fs";
import {
    RESTORE,
    RESTORE_KEY,
    ROLLBACK_ACT,
    ROLLBACK_COPY,
    createRollbackLog,
    rollbackLogText,
    rollbackMessage,
} from "../../../lib/rollbackReport.js";
import { calleeName, callsTo, parseFile, parseSource, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A rollback that fails reports what it left (#188)";

const ACTIONS = "app/prs/[prId]/actions.js";
const ACTS = Object.keys(ROLLBACK_COPY);
// The two maps have to agree, or a call site can name an act with no copy behind it.
const ACT_KEYS = Object.keys(ROLLBACK_ACT);

/** A log carrying `keys` as failures, without going near Airtable. */
function logWith(...keys) {
    const log = createRollbackLog();
    keys.forEach((key, i) => log.left.push({ key, recordId: `rec${i}`, error: "boom" }));
    return log;
}

const rejects = () => Promise.reject(new Error("Airtable said no"));

/** The two shapes a restore used to go quiet in. Both are matched on the AST. */
function silentCatches(ast) {
    const found = [];
    walk(ast, (n) => {
        if (calleeName(n) !== "catch" || n.arguments.length !== 1) return;
        const arg = n.arguments[0];
        if (arg?.type !== "ArrowFunctionExpression") return;
        if (arg.body?.type === "BlockStatement" && arg.body.body.length === 0) found.push(n);
    });
    return found;
}

function allSettledCalls(ast) {
    const found = [];
    walk(ast, (n) => {
        if (
            n.type === "CallExpression" &&
            n.callee?.type === "MemberExpression" &&
            n.callee.object?.name === "Promise" &&
            n.callee.property?.name === "allSettled"
        ) {
            found.push(n);
        }
    });
    return found;
}

/** Every key handed to the recorder, and whether it came from RESTORE_KEY. */
function restoreKeyArguments(ast) {
    const passed = [];
    walk(ast, (n) => {
        const name = calleeName(n);
        if (name !== "attempt" && name !== "attemptAll" && name !== "keep" && name !== "failed") return;
        const arg = n.arguments[0];
        passed.push({
            call: name,
            fromModule:
                arg?.type === "MemberExpression" && arg.object?.name === "RESTORE_KEY"
                    ? arg.property?.name
                    : null,
            literal: arg?.type === "Literal" ? arg.value : null,
        });
    });
    return passed;
}

export async function run({ check, assert, log }) {
    // ── the mutant, first ───────────────────────────────────────────────────
    log("the two voices diverge, and a report that says one thing either way is the defect:");
    for (const act of ACTS) {
        const clean = rollbackMessage(act, createRollbackLog());
        const incomplete = rollbackMessage(act, logWith(RESTORE_KEY.items));
        assert(`  ${act}: a clean rollback and a failed one do not say the same thing`, clean !== incomplete);
        assert(`  ${act}: the clean voice asks for a retry`, /Please try again\./.test(clean));
        assert(
            `  ${act}: the failed voice never does, and says not to`,
            !/try again/i.test(incomplete) && /^Something went wrong .*\. Do not /.test(incomplete)
        );
    }

    log("");
    log("one failed restore and three are told apart — a count would say how bad, never where:");
    const one = rollbackMessage("edit", logWith(RESTORE_KEY.items));
    const three = rollbackMessage(
        "edit",
        logWith(RESTORE_KEY.items, RESTORE_KEY.shippingFee, RESTORE_KEY.quotation)
    );
    assert("  one and three produce different sentences", one !== three);
    assert("  the one names its restore", one.includes(RESTORE.items));
    assert(
        "  the three name all three, in the order RESTORE declares them",
        three.includes(`${RESTORE.items}, ${RESTORE.shippingFee} and ${RESTORE.quotation}`)
    );
    assert(
        "  and a failure the turn did not have is not named",
        !three.includes(RESTORE.signer) && !one.includes(RESTORE.shippingFee)
    );

    // ── the names, and the record a kept row leaves ─────────────────────────
    log("");
    log("every restore has a name a reader can act on:");
    check("names declared", Object.keys(RESTORE).length, 8);
    assert(
        "  none of them names a table or a field the reader would have to translate",
        Object.values(RESTORE).every((n) => !/Edit Log|PR Signers|Purchase Requests|Quotations/.test(n))
    );
    const kept = createRollbackLog();
    kept.keep(RESTORE_KEY.quotation, "recQ1", "an item whose restore failed still links to it");
    assert(
        "  a record kept on purpose is named on screen exactly as a failed one is",
        rollbackMessage("edit", kept).includes(RESTORE.quotation)
    );
    assert(
        "  and the log tells the two apart, which the screen deliberately does not",
        /kept \(an item whose restore failed/.test(rollbackLogText("editAndContinueAction", "HYE-PR-260827-01", kept))
    );

    // ── the recorder never throws, which is the whole reason it exists ──────
    log("");
    log("the recorder swallows nothing and throws nothing:");
    const failing = createRollbackLog();
    const landed = await failing.attempt(RESTORE_KEY.signer, "recS1", rejects);
    check("  a failed restore reports false rather than throwing", landed, false);
    check("  and is recorded once", failing.left.length, 1);
    check("  with the record id the reader has to open", failing.left[0].recordId, "recS1");
    assert("  and the reason", failing.left[0].error.includes("Airtable said no"));

    const partly = createRollbackLog();
    const landedCount = await partly.attemptAll(RESTORE_KEY.history, ["recE1", "recE2", "recE3"], (id) =>
        id === "recE2" ? rejects() : Promise.resolve()
    );
    check("  attemptAll reports how many landed", landedCount, 2);
    check("  and records only the one that did not", partly.failed(RESTORE_KEY.history).join(), "recE2");
    assert("  the other two are not named", partly.left.length === 1);

    const clean = createRollbackLog();
    await clean.attempt(RESTORE_KEY.items, "recI1", () => Promise.resolve());
    await clean.attemptAll(RESTORE_KEY.quotation, ["recQ1"], () => Promise.resolve());
    check("  a rollback that worked leaves nothing to report", clean.left.length, 0);
    assert("  and gets the retry sentence", rollbackMessage("edit", clean) === ROLLBACK_COPY.edit.clean);

    log("");
    log("the log line carries what the screen cannot:");
    const line = rollbackLogText("editAndContinueAction", "HYE-PR-260827-01", logWith(RESTORE_KEY.items));
    assert("  the request id", line.includes("HYE-PR-260827-01"));
    assert("  the record id", line.includes("rec0"));
    assert("  and says plainly that the rollback did not finish", line.includes("DID NOT FINISH"));
    assert(
        "  a clean rollback's line says the opposite",
        rollbackLogText("editAndContinueAction", "HYE-PR-260827-01", createRollbackLog()).includes(
            "rolled back cleanly"
        )
    );

    // ── the structural half: no site left swallowing ────────────────────────
    log("");
    log(`no restore in ${ACTIONS} can go quiet:`);
    const actions = parseFile(ACTIONS);
    check("  `.catch(() => {})` sites", silentCatches(actions.ast).length, 0);
    check("  `Promise.allSettled` sites", allSettledCalls(actions.ast).length, 0);

    // ANTI-VACUITY. "The shape is absent" and "the matcher sees nothing" are the same
    // result, so both matchers are shown finding what they are looking for. Planted
    // here rather than committed to a file, which is `_ast.mjs:parseSource`'s stated
    // reason for being exported.
    const planted = parseSource(
        `async function f(a, b) {
             await update(a).catch(() => {});
             await Promise.allSettled(b.map((id) => destroy(id)));
             await log.attempt("items", a, () => update(a));
         }`,
        "<planted>"
    );
    check("  the matcher finds a planted silent catch", silentCatches(planted.ast).length, 1);
    check("  and a planted discarded allSettled", allSettledCalls(planted.ast).length, 1);
    assert(
        "  and the key matcher sees a planted string literal",
        restoreKeyArguments(planted.ast).some((k) => k.literal === "items")
    );

    log("");
    log("every restore goes through the recorder, and names its key from the module:");
    const passed = restoreKeyArguments(actions.ast);
    const attempts = passed.filter((k) => k.call === "attempt" || k.call === "attemptAll");
    // Ten sites: two in finishTurn, one in approveAction, five in
    // editAndContinueAction, two in returnForCorrectionAction. The count is the
    // issue's own inventory, so removing a restore has to come back through here.
    check("  restore sites", attempts.length, 10);
    check(
        "  passing a string literal instead of a RESTORE_KEY member",
        passed.filter((k) => k.literal !== null).length,
        0
    );
    const unknown = passed.filter((k) => !k.fromModule || !(k.fromModule in RESTORE)).length;
    check("  naming a key the module does not declare", unknown, 0);

    const used = new Set(passed.map((k) => k.fromModule));
    const unused = Object.keys(RESTORE).filter((k) => !used.has(k));
    check(
        `  restore names the module declares and nothing writes${unused.length ? ` (${unused.join(", ")})` : ""}`,
        unused.length,
        0
    );

    // A RESTORE THAT WRITES NOTHING IS THE FAILURE WITH NO FAILURE IN IT, and the
    // browser run that proved the sentence is what found it: an empty Airtable field
    // reads back as `undefined`, `updateItem` skips an `undefined` field, so restoring
    // a blank left the edited value standing while this report said the rollback was
    // clean. Every field of the item restore has to coalesce to an explicit blank.
    log("");
    log("the item restore can put a field BACK TO EMPTY, which a bare read cannot:");
    const itemRestore = callsTo(actions.ast, "attempt").find(
        (n) => n.arguments[0]?.property?.name === RESTORE_KEY.items
    );
    assert("  the item restore was located", Boolean(itemRestore));
    const restored = [];
    walk(itemRestore, (n) => {
        if (n.type === "Property" && n.value?.type !== "ArrowFunctionExpression") {
            restored.push([n.key?.name, n.value?.type]);
        }
    });
    check("  fields written by the restore", restored.length, 7);
    check(
        "  of those, fields that would skip a blank instead of clearing it",
        restored.filter(([, type]) => type !== "LogicalExpression").map(([name]) => name).join(", "),
        ""
    );

    log("");
    log("all four rollbacks are wired to one report:");
    const source = readFileSync(repoPath(ACTIONS), "utf8");
    check("  logs created", (source.match(/createRollbackLog\(\)/g) || []).length, 3);
    check("  screen messages", (source.match(/rollbackMessage\(/g) || []).length, 3);
    check("  log lines", (source.match(/rollbackLogText\(/g) || []).length, 3);
    assert(
        "  and finishTurn takes the caller's log rather than making its own",
        /async function finishTurn\(\{[^}]*rollback[^}]*\}\)/.test(source)
    );
    for (const act of ACTS) {
        // NAMED FROM THE MODULE, NEVER AS A LITERAL — and this one is not the same
        // rule as the restore keys above. `rollbackMessage(...)` is the value of an
        // `error:` property, which `scripts/screen-strings.mjs` reads as a string the
        // screen renders, so a literal here becomes a fabricated entry in that
        // screen's inventory. It did, until this constant existed.
        assert(
            `  ${act} is the act one of them reports under, named from the module`,
            source.includes(`rollbackMessage(ROLLBACK_ACT.${act}`)
        );
    }
    check(
        "  acts passed to rollbackMessage as a bare string",
        (source.match(/rollbackMessage\(["']/g) || []).length,
        0
    );
    check("  acts a call site can name but no copy answers", ACT_KEYS.filter((k) => !ACTS.includes(k)).length, 0);

    // THE LOG LINE'S CALL SITE, PINNED ON THE AST BECAUSE NOTHING ELSE CAN REACH IT.
    // The screen half of this report was demonstrated in a browser; the server log
    // half cannot be, since the dev server's stdout is not something a session can
    // read back. What a wrong call site would look like is narrow and worth naming:
    // the sentence would still be right while the log said the wrong request, or
    // dropped the cause. So each site is required to hand the builder this turn's own
    // log and this request's own id, and to keep the original error as the second
    // argument — `console.error(line, err)`, never `console.error(line)`.
    const logSites = callsTo(actions.ast, "error").filter(
        (n) => n.callee?.object?.name === "console" && callsTo(n, "rollbackLogText").length === 1
    );
    check("  console.error sites carrying the log text", logSites.length, 3);
    check(
        "  of those, sites passing this turn's log, this request's id and the cause",
        logSites.filter((n) => {
            const built = callsTo(n, "rollbackLogText")[0];
            const [, prId, log] = built.arguments;
            return (
                prId?.object?.name === "pr" &&
                prId?.property?.name === "prId" &&
                log?.name === "rollback" &&
                n.arguments[1]?.name === "err"
            );
        }).length,
        3
    );
}

if (isMain(import.meta.url)) standalone(title, run);

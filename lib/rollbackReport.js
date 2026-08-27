// What a failed rollback says, and to whom (#188).
//
// THE ROLLBACK CANNOT BE MADE TRANSACTIONAL — Airtable has no transaction across
// tables — so this module does not try to guarantee anything. It REPORTS. A restore
// that failed is a fact somebody has to act on, and swallowing it is the one thing
// that makes it unactionable: `app/prs/[prId]/actions.js` had five such restores in
// one rollback and two more in `finishTurn`, three swallowed by `.catch(() => {})`
// and four by a `Promise.allSettled` whose results were discarded.
//
// PURE, AND THAT IS LOAD-BEARING RATHER THAN TIDY. The sentence this file builds is
// reachable only when an Airtable write fails inside a rollback, which no form can
// produce — so a check that cannot CALL the builder cannot see the words at all, and
// the copy would ship having been read by nobody. Same reason `lib/poSend.js` holds
// `SIGNED_NOTICE_COPY` and `lib/poUnsigned.js` holds `AWAITING_SIGNATURE_COPY`. It
// also puts the copy where `offline/line-vocabulary.mjs` walks, which reads `*_COPY`
// constants and nothing else. Nothing here imports anything, and nothing here may
// import `lib/airtable/*`: `attemptAll` takes a function per record id precisely so
// the Airtable call stays at the call site and this file stays callable under plain
// `node`.
//
// NOTHING IS WRITTEN TO AIRTABLE. Recording a failed Airtable write into Airtable is
// not a report, it is a second failure — and `Edit Log."Field"` is a closed list of
// seven options that only a hand edit in the Airtable UI can extend (#181), so the
// row could not be written even where the base was healthy. The report goes to the
// person in front of the screen, who is the only one who knows it happened, and to
// the server log, which is what survives them closing the tab.

/**
 * The restores a rollback in the signing chain can attempt, and what each is called
 * on screen.
 *
 * THESE ARE NAMES, NOT A COUNT, AND THE DIFFERENCE IS THE COST TO A PERSON. One
 * failed restore and three failed restores leave different states in different
 * places; a count says how bad and never says where, so the reader would have to
 * open all seven. Which promise rejected is already known at the moment it rejects,
 * so the names cost nothing to carry.
 *
 * The wording is the reader's, not the schema's — `this turn's history entries`
 * rather than `Edit Log` rows, because the request's own page prints them under
 * `History`. A signer reads this sentence; nobody reaches it holding a base.
 */
export const RESTORE = {
    items: "the items you edited",
    shippingFee: "the Shipping Fee",
    history: "this turn's history entries",
    quotation: "the quotation this turn added",
    signer: "your own signing status",
    correctionResolved: "the correction request this turn resolved",
    correctionCreated: "the correction request this turn created",
    resumedSigner: "the signer this turn resumed",
};

/** The keys of RESTORE, as a call site spells them. No call site passes a literal. */
export const RESTORE_KEY = Object.fromEntries(Object.keys(RESTORE).map((k) => [k, k]));

/**
 * `A`, `A and B`, `A, B and C` — no serial comma, matching the copy modules
 * (`quantity, price and signers`).
 */
function joinNames(names) {
    if (names.length <= 1) return names[0] || "";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The two voices of every rollback in the signing chain, keyed by the act.
 *
 * THE CLEAN VOICE IS THE ONE THAT SHIPPED AND IT IS STILL RIGHT — where the rollback
 * finished, nothing this turn wrote is on the request and a retry is a first attempt.
 * The words are unchanged from the three actions that used to hold them inline; they
 * moved here so the two voices of one event sit together, which is `lib/poSend.js`'s
 * shape for `sendFailed` beside `recordFailed`.
 *
 * THE INCOMPLETE VOICE FOLLOWS `SEND_REFUSAL.recordFailed` DELIBERATELY, because it
 * is the same class of news: a write that partly landed, where the reader's instinct
 * is the wrong move. Three parts, in that order — what happened, do not repeat it and
 * why, ask for the record to be corrected in Airtable. An imperative, per #179's
 * split: this is an instruction rather than a state.
 *
 * `Do not save again` IS THE POINT OF THE WHOLE ISSUE AND IT IS NOT ADVICE. Traced
 * through the code: the form still holds the submitted values, and a second submit
 * re-reads the items — which, when their restore failed, now HOLD the edited values.
 * The diff comes out empty, no `Edit Log` row is written for a change that is
 * nonetheless on the record, and the turn commits. `Please try again.` does not
 * merely fail to describe the state, it completes it.
 */
export const ROLLBACK_COPY = {
    approve: {
        clean: "Something went wrong recording your approval. Please try again.",
        incomplete: (names) =>
            "Something went wrong recording your approval, and undoing it did not finish. " +
            "Do not approve again — part of what this turn wrote is still on the request. " +
            `Ask for these to be corrected in Airtable: ${joinNames(names)}.`,
    },
    edit: {
        clean: "Something went wrong saving your changes. Please try again.",
        incomplete: (names) =>
            "Something went wrong saving your changes, and undoing them did not finish. " +
            "Do not save again — part of what this turn wrote is still on the request. " +
            `Ask for these to be corrected in Airtable: ${joinNames(names)}.`,
    },
    returnForCorrection: {
        clean: "Something went wrong sending this back for correction. Please try again.",
        incomplete: (names) =>
            "Something went wrong sending this back for correction, and undoing it did not " +
            "finish. Do not send it back again — part of what this turn wrote is still on the " +
            `request. Ask for these to be corrected in Airtable: ${joinNames(names)}.`,
    },
};

/**
 * The three acts, as a call site spells them.
 *
 * A CONSTANT RATHER THAN A LITERAL FOR A REASON THE OTHER KEY MAP DOES NOT HAVE:
 * `rollbackMessage(...)` is the value of an `error:` property, and
 * `scripts/screen-strings.mjs` reads a literal in that position as a string the
 * screen renders. Written as `rollbackMessage("returnForCorrection", …)` it put
 * exactly that word into the `/prs/[prId]` inventory, as copy, which is the kind of
 * false entry #288 built that tool to stop producing.
 */
export const ROLLBACK_ACT = Object.fromEntries(Object.keys(ROLLBACK_COPY).map((k) => [k, k]));

/**
 * The one message a rolled-back turn returns, whichever way the rollback went.
 *
 * ONE INSTRUCTION, MANY NAMES. What the reader must DO is the same in all seven
 * cases — stop, and tell the office — so there is one sentence and the list of names
 * is what varies. Five instructions for five restores would be five ways to say
 * "stop".
 */
export function rollbackMessage(act, log) {
    const voice = ROLLBACK_COPY[act];
    if (!voice) throw new Error(`no rollback copy for "${act}"`);
    return log.left.length === 0 ? voice.clean : voice.incomplete(log.names());
}

/**
 * The server-log line, built here rather than at the call site so a check can call it.
 *
 * IT CARRIES THE RECORD IDS AND THE SCREEN DOES NOT. The person at the screen relays
 * a sentence; whoever opens the base needs the rows. The two halves are one fact and
 * they are built next to each other so neither can quietly lose the other.
 */
export function rollbackLogText(act, prId, log) {
    if (log.left.length === 0) return `${act} failed, rolled back cleanly — ${prId}`;
    const detail = log.left
        .map((e) => `${e.key}${e.recordId ? `[${e.recordId}]` : ""}: ${e.kept ? `kept (${e.reason})` : e.error}`)
        .join("; ");
    return `${act} failed AND THE ROLLBACK DID NOT FINISH — ${prId} — left on the record: ${detail}`;
}

/**
 * The collector every rollback in the signing chain writes into.
 *
 * A RESTORE GOES THROUGH `attempt` OR `attemptAll` AND NOWHERE ELSE, which is what
 * makes "no silent site" structural rather than something a reader has to notice:
 * `offline/rollback-report.mjs` asserts that `app/prs/[prId]/actions.js` contains no
 * `.catch(() => {})` and no `Promise.allSettled` at all, and both of those shapes are
 * the ways a restore used to go quiet.
 *
 * NEITHER HELPER EVER THROWS. A rollback is the last thing that runs; there is
 * nothing after it to abort, and a throw here would replace the sentence above with
 * the framework's error page — taking from the reader the only account of what
 * happened. This is where #206's fix to `deleteDeliveryAsUser` stops applying: it
 * throws on a failed child so the parent survives, which is right for a delete
 * because the operation stays retryable, and wrong here for exactly that reason.
 */
export function createRollbackLog() {
    const left = [];

    return {
        left,

        /** One restore. Returns true when it landed. */
        async attempt(key, recordId, run) {
            try {
                await run();
                return true;
            } catch (err) {
                left.push({ key, recordId, error: err?.message || String(err) });
                return false;
            }
        },

        /**
         * One restore per record id, concurrently.
         *
         * STILL CONCURRENT, unlike #206's sequential rewrite of the same shape. The
         * ordering it introduced exists to stop a parent going when a child failed;
         * these ids are independent rows and there is no parent among them, so
         * serializing would only make the failure path slower.
         */
        async attemptAll(key, recordIds, run) {
            const settled = await Promise.allSettled(recordIds.map((id) => run(id)));
            settled.forEach((result, i) => {
                if (result.status === "rejected") {
                    left.push({
                        key,
                        recordId: recordIds[i],
                        error: result.reason?.message || String(result.reason),
                    });
                }
            });
            return settled.filter((r) => r.status === "fulfilled").length;
        },

        /**
         * A record the rollback deliberately did NOT undo.
         *
         * REPORTED THE SAME WAY A FAILURE IS, because to the reader it is the same
         * fact: this is still on the request. The distinction — nothing failed here,
         * something else did — is worth keeping in the log and worth nothing on the
         * screen, where both answers are "go look at it".
         */
        keep(key, recordId, reason) {
            left.push({ key, recordId, kept: true, reason });
        },

        /** Which record ids failed under one key, for a caller that has to branch. */
        failed(key) {
            return left.filter((e) => e.key === key && !e.kept).map((e) => e.recordId);
        },

        /** The screen names, deduplicated, in the order RESTORE declares them. */
        names() {
            const keys = new Set(left.map((e) => e.key));
            return Object.keys(RESTORE)
                .filter((k) => keys.has(k))
                .map((k) => RESTORE[k]);
        },
    };
}

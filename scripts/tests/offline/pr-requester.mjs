// Who raised a request is read in one place, and a draft that is not the reader's
// gets one of two answers (#440).
//
// `lib/prRequester.js` owns the meaning — the first linked user — and the judgment
// every write onto a draft asks. This file holds four things about it.
//
//   1. THE MEANING, by value. The case that decides it is a request naming two users,
//      which the app cannot write: the first is the requester and the second is not.
//      A membership test — what `getDraftsByRequester` did from #248 to #440 — passes
//      every other assertion here and fails that one, which is why it comes first.
//   2. THE JUDGMENT, by value, with identity asked before status: another person's
//      request answers `gone` in every status, which is the whole of what keeps the
//      second answer from telling a stranger anything.
//   3. ONE READER. Nothing under `app/` or `lib/` reads `.requester` off anything
//      except `lib/prRequester.js` — dotted, bracketed or destructured — and nothing
//      reads the `Requester` field off a record except the mapper that fills it. The
//      shape of `offline/user-name.mjs`, and for its reason: two readers of one field
//      are two meanings of it waiting to disagree.
//   4. THE FORM'S TWO ANSWERS. `/prs/new` lets go of the draft it holds on `gone` and
//      on nothing else, for both of its save actions, and letting go releases the
//      quotation entries through `detachQuotations` rather than a copy of it and takes
//      the draft's row off the list of saved drafts, so the notice saying the draft
//      was deleted never stands beside a list still counting it.
//
// WHAT THIS CANNOT SEE: whether the form's two answers look different on a screen,
// and whether a refused save left the base as it was. The first is a browser walk and
// the second is `verify-draft-owner-440.mjs`.

import {
    OWN_DRAFT_COPY,
    OWN_DRAFT_REFUSAL,
    isRequester,
    ownDraftRefusal,
    requesterOf,
} from "../../../lib/prRequester.js";
import { REPO_ROOT, calleeName, listJsFiles, parseFile, parseSource, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Who raised a request is read in one place, and a draft not the reader's gets two answers (#440)";

/** The one module that may read `.requester`, and the one that may read the field. */
const OWNER = "lib/prRequester.js";
const MAPPER = "lib/airtable/purchaseRequests.js";

function jsFilesUnder(dir) {
    const root = toPosix(REPO_ROOT);
    return listJsFiles(`${REPO_ROOT}/${dir}`)
        .map((full) => toPosix(full).slice(root.length + 1))
        .sort();
}

function lineOf(source, node) {
    return source.slice(0, node.start).split("\n").length;
}

/** Every READ of `requester` in a tree: `x.requester`, `x["requester"]`, `{ requester } = x`. */
export function requesterReads(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "MemberExpression") {
            const p = n.property;
            if (!n.computed && p?.type === "Identifier" && p.name === "requester") found.push(n);
            if (n.computed && p?.type === "Literal" && p.value === "requester") found.push(n);
        }
        if (n.type === "ObjectPattern") {
            for (const prop of n.properties) {
                const key = prop.key;
                if (prop.type === "Property" && !prop.computed && (key?.name === "requester" || key?.value === "requester")) {
                    found.push(prop);
                }
            }
        }
    });
    return found;
}

/** Every `.get("Requester")` — a read of the field off an Airtable record. */
function fieldReads(ast) {
    const found = [];
    walk(ast, (n) => {
        if (
            n.type === "CallExpression" &&
            calleeName(n) === "get" &&
            n.arguments[0]?.type === "Literal" &&
            n.arguments[0].value === "Requester"
        ) {
            found.push(n);
        }
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── 1: the meaning ─────────────────────────────────────────────────────────
    log("THE MEANING — the requester is the first linked user:");
    const two = { requester: ["recFirst", "recSecond"] };
    // THE MUTANT, FIRST: membership passes every line below this one and fails here.
    check("A REQUEST NAMING TWO USERS HAS THE FIRST AS ITS REQUESTER", requesterOf(two), "recFirst");
    check("  and the second is not its requester", isRequester({ id: "recSecond" }, two), false);
    check("  while the first is", isRequester({ id: "recFirst" }, two), true);
    check("one linked user is the requester", requesterOf({ requester: ["recA"] }), "recA");
    check("no linked user is no requester", requesterOf({ requester: [] }), null);
    check("  and neither is a missing field", requesterOf({}), null);
    check("  or a missing request", requesterOf(null), null);
    check("nobody is the requester of a request with none", isRequester({ id: "recA" }, { requester: [] }), false);
    // `undefined === undefined` is what an unguarded comparison would answer here.
    check("  including a user with no id", isRequester({}, { requester: [] }), false);
    check("  and no user is anybody's requester", isRequester(null, { requester: ["recA"] }), false);

    // ── 2: the judgment ────────────────────────────────────────────────────────
    log("");
    log("THE JUDGMENT — identity before status, and two answers:");
    const me = { id: "recMe" };
    const mine = (status) => ({ requester: ["recMe"], status });
    const theirs = (status) => ({ requester: ["recThem"], status });
    check("the reader's own draft may be written onto", ownDraftRefusal(me, mine("Draft")), null);
    for (const status of ["In Review", "Approved", "PO Signed", "Withdrawn"]) {
        check(`  their own request in ${status} is submitted`, ownDraftRefusal(me, mine(status)), OWN_DRAFT_REFUSAL.submitted);
    }
    // THE LEAK MUTANT: asking status first answers `submitted` here, which tells a
    // stranger that a request by that id exists and has left Draft.
    for (const status of ["Draft", "In Review", "Approved", "PO Signed", "Withdrawn"]) {
        check(`SOMEONE ELSE'S REQUEST IN ${status.toUpperCase()} IS GONE`, ownDraftRefusal(me, theirs(status)), OWN_DRAFT_REFUSAL.gone);
    }
    check("  as is an id that resolves to nothing", ownDraftRefusal(me, null), OWN_DRAFT_REFUSAL.gone);
    check("  and a request with no requester", ownDraftRefusal(me, { requester: [], status: "Draft" }), OWN_DRAFT_REFUSAL.gone);
    check("  and a reader who is nobody", ownDraftRefusal(null, mine("Draft")), OWN_DRAFT_REFUSAL.gone);
    assert("the two answers are two", OWN_DRAFT_REFUSAL.gone !== OWN_DRAFT_REFUSAL.submitted);
    for (const key of Object.values(OWN_DRAFT_REFUSAL)) {
        assert(`  and each has its sentence (${key})`, typeof OWN_DRAFT_COPY[key] === "string" && OWN_DRAFT_COPY[key].length > 0);
    }
    assert("  and the two sentences differ", OWN_DRAFT_COPY.gone !== OWN_DRAFT_COPY.submitted);
    // THE ORDINARY NOT-FOUND WORDS ARE KEPT, by value, because they are what a stranger
    // and an absent id must share — a reworded one would still be one sentence for both,
    // which is the property, so this pins the wording the screens already said.
    check("  and `gone` is the words a missing draft already got", OWN_DRAFT_COPY.gone, "That draft no longer exists.");
    assert(
        "the notice for a draft let go of says the changes are kept, both ways",
        OWN_DRAFT_COPY.detached.includes("still here") && OWN_DRAFT_COPY.detachedWithoutFiles.includes("still here")
    );
    assert("  and only the second says the files went", !OWN_DRAFT_COPY.detached.includes("quotation files"));

    // ── 3: one reader ──────────────────────────────────────────────────────────
    log("");
    log("ONE READER — `.requester` is read in lib/prRequester.js and nowhere else:");
    const files = [...jsFilesUnder("app"), ...jsFilesUnder("lib")];
    const parsed = new Map(files.map((rel) => [rel, parseFile(rel)]));
    const elsewhere = [];
    let ownReads = 0;
    const fieldElsewhere = [];
    let mapperReads = 0;
    for (const [rel, { ast, source }] of parsed) {
        const reads = requesterReads(ast);
        if (rel === OWNER) ownReads += reads.length;
        else for (const n of reads) elsewhere.push(`${rel}:${lineOf(source, n)}`);
        const fields = fieldReads(ast);
        if (rel === MAPPER) mapperReads += fields.length;
        else for (const n of fields) fieldElsewhere.push(`${rel}:${lineOf(source, n)}`);
    }
    check("no file but lib/prRequester.js reads `.requester`", elsewhere.join(", "), "");
    check("  and no file but the mapper reads the `Requester` field", fieldElsewhere.join(", "), "");
    // ANTI-VACUITY: the finder has to be seen finding reads — in the owner itself, in
    // the mapper, and in the three shapes a new one would take.
    assert("  the finder sees the owner's own read", ownReads > 0);
    check("  and the mapper's", mapperReads, 1);
    const planted = parseSource(
        "const a = pr.requester?.[0] === user.id;\nconst b = pr['requester'];\nconst { requester } = pr;\n" +
            "const c = { requester: ['recX'] };\n",
        "planted.js"
    );
    check("  and all three shapes of a read, but not a key being written", requesterReads(planted.ast).length, 3);

    // ── 4: the form's two answers ──────────────────────────────────────────────
    log("");
    log("THE FORM — /prs/new lets go of its draft on `gone` and on nothing else:");
    const form = parsed.get("app/prs/new/PRForm.js");
    const detachFn = [];
    walk(form.ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name === "detachFromDraft") detachFn.push(n);
    });
    check("one function lets go of a draft", detachFn.length, 1);
    const detach = detachFn[0];
    let callsDetachQuotations = false;
    let clearsDraftId = false;
    let dropsListRow = false;
    if (detach) {
        walk(detach, (n) => {
            if (n.type === "CallExpression" && calleeName(n) === "detachQuotations") callsDetachQuotations = true;
            // The row it drops is the open draft's, so the filter has to name that id.
            if (n.type === "CallExpression" && calleeName(n) === "setDrafts") {
                walk(n, (m) => {
                    if (m.type === "Identifier" && m.name === "openDraftPrId") dropsListRow = true;
                });
            }
            if (
                n.type === "CallExpression" &&
                calleeName(n) === "setDraftRecordId" &&
                n.arguments[0]?.type === "Literal" &&
                n.arguments[0].value === ""
            ) {
                clearsDraftId = true;
            }
        });
    }
    assert("  it releases the quotation entries through detachQuotations", callsDetachQuotations);
    assert("  and lets go of the draft's record id", clearsDraftId);
    assert("  and takes the open draft's row off the list of saved drafts", dropsListRow);
    // Every `if` that asks a save's refusal key and lets go: `gone` only, both saves.
    const keysThatDetach = [];
    const keysThatDoNot = [];
    walk(form.ast, (n) => {
        if (n.type !== "IfStatement") return;
        const keys = [];
        walk(n.test, (m) => {
            if (
                m.type === "MemberExpression" &&
                !m.computed &&
                m.object?.type === "Identifier" &&
                m.object.name === "OWN_DRAFT_REFUSAL"
            ) {
                keys.push(m.property.name);
            }
        });
        if (keys.length === 0) return;
        let detaches = false;
        walk(n.consequent, (m) => {
            if (m.type === "CallExpression" && calleeName(m) === "detachFromDraft") detaches = true;
        });
        (detaches ? keysThatDetach : keysThatDoNot).push(...keys);
    });
    check("  the branches that let go ask `gone`, one per save action", keysThatDetach.sort().join(","), "gone,gone");
    assert("  and none of them asks `submitted`", !keysThatDetach.includes("submitted"));
    // The list's own delete asks too, and a draft already gone leaves the list.
    assert("  the drafts list treats a draft already gone as deleted", keysThatDoNot.includes("gone"));
}

if (isMain(import.meta.url)) standalone(title, run);

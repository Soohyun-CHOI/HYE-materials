// Where a request's material goes (#385).
//
// WHAT THIS FILE HOLDS, and each claim is a different kind of thing.
//
//   1. The picker offers EVERY address, grouped, with the job's own first. The
//      mutant is a filter rather than a grouping — the screen still works, the
//      list is shorter, and a requester who needs a place another job already
//      uses records a second row for it, which is #384's defect one screen over.
//   2. A resumed draft opens on the branch that displays its stored address
//      truthfully. Four states, because the stored link cannot say which branch
//      wrote it and the derivation is the whole of what makes a resume honest.
//   3. The id a submission carries. The mutant here is quiet in both directions:
//      a default branch that sends the picker's value, or a picker that sends the
//      default.
//   4. The refusal is at SUBMIT and not at SAVE, asserted on the AST, plus the
//      inventory that every word the control says comes out of the copy constant.
//
// WHAT IT CANNOT SEE.
//
//   - Whether anything RENDERS. The branch collapsing where a job has no
//     default, the groups appearing in a dropdown, the way out saving before it
//     navigates — all browser work, and all of it was walked.
//   - Whether a job HAS a default. No job on this base does and no screen sets
//     one; the fixtures here supply both states because the base supplies one.
//   - Whether `Purchase Requests."Delivery Address"` exists on the base. No
//     offline check reads the base in either direction
//     (docs/notes/verification.md); `offline/table-field-names.mjs` holds names.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import {
    ADDRESS_CHOICE_COPY,
    ADDRESS_RETURN_COPY,
    addressChoiceFromStored,
    addressOptions,
    chosenAddressId,
    jobDefaultAddressId,
} from "../../../lib/addressChoice.js";
import { addressesOnJob } from "../../../lib/addressCreation.js";
import { parseFile, parseSource, walk, callsBefore, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Where a request's material goes (#385)";

/** Every `OBJ.key` member expression in a file, as `key` strings. */
function memberKeys(parsed, objectName) {
    const keys = new Set();
    walk(parsed.ast, (n) => {
        if (n.type !== "MemberExpression" || n.object?.name !== objectName) return;
        if (n.property?.name) keys.add(n.property.name);
    });
    return keys;
}

const ADDRESSES = [
    { id: "a1", addressLabel: "Round Rock Compressor Station - Site", jobs: ["job1"] },
    { id: "a2", addressLabel: "Cedar Park Shop", jobs: ["job2"] },
    { id: "a3", addressLabel: "Lone Star Pipe & Supply - Main", jobs: [] },
];

const JOB_WITH_DEFAULT = { id: "job1", jobCode: "26-DEMO-01", deliveryAddress: ["a1"] };
const JOB_NO_DEFAULT = { id: "job2", jobCode: "26-DEMO-02", deliveryAddress: [] };

export function run({ check, assert, log }) {
    // ── 1: the picker offers everything, grouped ───────────────────────────
    log("the picker offers every address, with the job's own first:");
    const forJob1 = addressOptions(JOB_WITH_DEFAULT, ADDRESSES);
    check("this job's own", forJob1.onJob.map((a) => a.id).join(), "a1");
    check("  and every other one", forJob1.others.map((a) => a.id).join(), "a2,a3");
    // THE VENDOR'S OWN ADDRESS IS IN THE SECOND GROUP AND NOT FILTERED OUT.
    // `Addresses` holds two kinds of place and hiding one needs a rule no screen
    // states, while removing an answer a requester may want.
    assert("  including one no job uses", forJob1.others.some((a) => a.id === "a3"));
    const forJob2 = addressOptions(JOB_NO_DEFAULT, ADDRESSES);
    check("a job reached only through the address link", forJob2.onJob.map((a) => a.id).join(), "a2");
    // Alphabetical by label rather than by fixture order, which is why `a3`
    // (`Lone Star…`) precedes `a1` (`Round Rock…`) here — the sort is what a
    // reader scans by and the ids say nothing about it.
    check("  and its others, alphabetically", forJob2.others.map((a) => a.id).join(), "a3,a1");
    // NOTHING IS LOST BETWEEN THE GROUPS, which is the claim a filter would break.
    for (const [what, groups] of [["job1", forJob1], ["job2", forJob2]]) {
        check(
            `  ${what}: the two groups are the whole list`,
            groups.onJob.length + groups.others.length,
            ADDRESSES.length
        );
        const ids = new Set([...groups.onJob, ...groups.others].map((a) => a.id));
        check(`  ${what}: and hold no address twice`, ids.size, ADDRESSES.length);
    }
    check("no job at all puts everything in the second group", addressOptions(null, ADDRESSES).others.length, 3);
    check("  and none in the first", addressOptions(null, ADDRESSES).onJob.length, 0);
    // IT CALLS #384's RULE RATHER THAN RE-DERIVING IT. "Which addresses does this
    // job use" is a union of two links and a second implementation would go wrong
    // silently, so the first group has to BE that function's answer.
    check(
        "the first group is `addressesOnJob`'s answer",
        forJob1.onJob.map((a) => a.id).join(),
        addressesOnJob(JOB_WITH_DEFAULT, ADDRESSES).map((a) => a.id).join()
    );
    // And the union's other arm is exercised here too: `a1` is `job1`'s DEFAULT
    // and its own `jobs` array names job1 as well, so this fixture cannot tell
    // the two arms apart — which is why the arm test lives in #384's check and is
    // cited rather than repeated.
    check("the job's default is read as its own", jobDefaultAddressId(JOB_WITH_DEFAULT), "a1");
    check("  and a job without one has none", jobDefaultAddressId(JOB_NO_DEFAULT), null);
    check("  nor does a missing job", jobDefaultAddressId(null), null);

    // ── 2: which branch a resumed draft opens on ───────────────────────────
    log("");
    log("a resumed draft opens on the branch that displays its address truthfully:");
    check(
        "an address that IS the job's default reads as the default branch",
        JSON.stringify(addressChoiceFromStored({ storedAddressId: "a1", defaultAddressId: "a1" })),
        JSON.stringify({ useJobDefault: true, pickedAddressId: "" })
    );
    check(
        "one that is not reads as a pick",
        JSON.stringify(addressChoiceFromStored({ storedAddressId: "a2", defaultAddressId: "a1" })),
        JSON.stringify({ useJobDefault: false, pickedAddressId: "a2" })
    );
    check(
        "nothing stored, with a default to offer, opens on it",
        JSON.stringify(addressChoiceFromStored({ storedAddressId: "", defaultAddressId: "a1" })),
        JSON.stringify({ useJobDefault: true, pickedAddressId: "" })
    );
    check(
        "nothing stored and no default opens the picker",
        JSON.stringify(addressChoiceFromStored({ storedAddressId: "", defaultAddressId: null })),
        JSON.stringify({ useJobDefault: false, pickedAddressId: "" })
    );
    // A stored address on a job that has since lost its default is still a pick,
    // which is right: the request says where its material goes and the job having
    // moved on does not change that.
    check(
        "a stored address survives the job losing its default",
        JSON.stringify(addressChoiceFromStored({ storedAddressId: "a2", defaultAddressId: null })),
        JSON.stringify({ useJobDefault: false, pickedAddressId: "a2" })
    );

    // ── 3: the id a submission carries ─────────────────────────────────────
    log("");
    log("the id the hidden input submits:");
    check(
        "the default branch sends the job's default",
        chosenAddressId({ useJobDefault: true, defaultAddressId: "a1", pickedAddressId: "a2" }),
        "a1"
    );
    check(
        "  and never the picker's leftover",
        chosenAddressId({ useJobDefault: true, defaultAddressId: "a1", pickedAddressId: "a2" }) === "a2",
        false
    );
    check(
        "the picker branch sends the pick",
        chosenAddressId({ useJobDefault: false, defaultAddressId: "a1", pickedAddressId: "a2" }),
        "a2"
    );
    check(
        "  and never the default",
        chosenAddressId({ useJobDefault: false, defaultAddressId: "a1", pickedAddressId: "" }),
        ""
    );
    check(
        "a default branch with no default sends nothing",
        chosenAddressId({ useJobDefault: true, defaultAddressId: null, pickedAddressId: "" }),
        ""
    );

    // ── 4: required at submit, not at save ─────────────────────────────────
    log("");
    log("the address is required at submit and not at save:");
    const actions = parseFile("app/prs/new/actions.js");
    const submit = resolveFunction(actions.ast, "createPRAction");
    const save = resolveFunction(actions.ast, "saveDraftAction");
    assert("createPRAction exists", Boolean(submit));
    assert("saveDraftAction exists", Boolean(save));
    // THE REFUSAL RUNS BEFORE THE WRITE, which is the half a returning action can
    // get wrong without anything failing: a request would be created and then
    // refused. Source order is not execution order (`_ast.mjs`), so what this
    // proves is that nobody wrote the write above the check.
    assert(
        "the submit refuses before it persists",
        callsBefore(submit, "getAllAddresses", "persistPRFromForm")
    );
    const submitSrc = actions.source.slice(submit.start, submit.end);
    const saveSrc = actions.source.slice(save.start, save.end);
    assert("the submit names the required refusal", /ADDRESS_CHOICE_COPY\.required/.test(submitSrc));
    assert("  and the unknown-address one", /ADDRESS_CHOICE_COPY\.unknown/.test(submitSrc));
    // A DRAFT SAVES WITHOUT ONE. This is the assertion that keeps #72's rule — a
    // draft is allowed to be half-finished — from being quietly withdrawn by a
    // later edit that moves the check into the shared parse.
    assert("the draft save refuses nothing about the address", !/ADDRESS_CHOICE_COPY/.test(saveSrc));

    // ── 5: every word the control says comes out of the constant ───────────
    log("");
    log("every word is in the copy constant and the two screens read it:");
    const form = parseFile("app/prs/new/PRForm.js");
    const addressForm = parseFile("app/addresses/new/AddressForm.js");
    const read = new Set([
        ...memberKeys(form, "ADDRESS_COPY"),
        ...memberKeys(actions, "ADDRESS_CHOICE_COPY"),
        ...memberKeys(parseFile("app/prs/[prId]/page.js"), "ADDRESS_CHOICE_COPY"),
    ]);
    const unread = Object.keys(ADDRESS_CHOICE_COPY).filter((k) => !read.has(k));
    check(
        `every key is read by a screen or the action${unread.length ? ` (${unread.join(", ")})` : ""}`,
        unread.length,
        0
    );
    const returnRead = memberKeys(addressForm, "ADDRESS_RETURN_COPY");
    const returnUnread = Object.keys(ADDRESS_RETURN_COPY).filter((k) => !returnRead.has(k));
    check(
        `and every return-copy key too${returnUnread.length ? ` (${returnUnread.join(", ")})` : ""}`,
        returnUnread.length,
        0
    );
    // The constant is carrying a screen rather than being an empty object every
    // clause above passes against.
    assert("the constant holds the control's words", Object.keys(ADDRESS_CHOICE_COPY).length >= 9);
    assert(
        "  and the two branches name a place rather than a word",
        ADDRESS_CHOICE_COPY.jobDefault("Cedar Park Shop").includes("Cedar Park Shop")
    );
    // NO KEY MAY START WITH `use`, and this is a lint rule rather than a wording
    // one: `COPY.useDefault(x)` in a component reads as a conditional HOOK call to
    // `react-hooks/rules-of-hooks` and fails `npx eslint .` outright. Measured on
    // this branch before the keys were renamed.
    //
    // THIS PIN COVERS ONE CONSTANT AND THE RULE IS EVERY COPY CONSTANT'S, which is
    // a gap left open on purpose rather than missed. eslint already fails the
    // whole repository loudly, so a second enforcer here would be one rule written
    // twice — what a later author actually lacks is the EXPLANATION, since the
    // message names a React rule for what is a string builder. That is in
    // docs/notes/naming.md, where anybody naming an identifier is routed.
    const hookish = Object.keys(ADDRESS_CHOICE_COPY).filter((k) => /^use[A-Z]/.test(k));
    check(`no copy key reads as a React hook${hookish.length ? ` (${hookish.join(", ")})` : ""}`, hookish.length, 0);

    // ── 6: the way out saves first, and the way back is the resume path ────
    log("");
    log("the way out saves the draft before it navigates:");
    const formSrc = form.source;
    assert(
        "the form navigates to /addresses/new",
        /router\.push\(`\/addresses\/new\?/.test(formSrc)
    );
    // THE NAVIGATION IS INSIDE THE SAVED-DRAFT BRANCH. A push that ran on any
    // draftState would carry the requester away from a FAILED save, losing the
    // form — the one thing the control's own label promises it will not do.
    const savedGuard = formSrc.indexOf("draftState?.savedDraft?.recordId");
    const push = formSrc.indexOf("router.push(`/addresses/new?");
    assert("  only once the save succeeded", savedGuard !== -1 && push > savedGuard);
    assert("  and it carries the request", /from: draftState\.savedDraft\.prId/.test(formSrc));
    // AND ONLY WHEN THAT SAVE WAS THE FIRST HALF OF LEAVING. The two are separate
    // claims and the second has its own mutant: drop `leavingForAddress` and EVERY
    // draft save carries the requester off to the address screen — the save still
    // works, nothing throws, and the button at the foot of the form silently
    // stops meaning what it says. Asserted on the AST rather than by position,
    // because `if (true)` sits in exactly the same place.
    const leaving = resolveFunction(form.ast, "PRForm");
    let guardedByLeaving = false;
    walk(leaving ?? form.ast, (n) => {
        if (n.type !== "IfStatement" || n.test?.name !== "leavingForAddress") return;
        if (formSrc.slice(n.start, n.end).includes("router.push(`/addresses/new?")) {
            guardedByLeaving = true;
        }
    });
    assert("  and only when the save was the first half of leaving", guardedByLeaving);
    // The modal that offers the PR list is suppressed on that same path, or the
    // requester is interrupted with an answer to a question they did not ask.
    assert(
        "the draft-saved modal stands down while leaving",
        /draftState\?\.savedDraft && !leavingForAddress/.test(formSrc)
    );
    assert(
        "the way back is the draft-resume path",
        /\/prs\/new\?draft=\$\{encodeURIComponent\(fromPrId\)\}/.test(addressForm.source)
    );

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — every matcher is seen to be able to say no:");
    // The grouping has to be seen SPLITTING rather than returning its input
    // twice, or every count in section 1 is what a pass-through reports.
    assert(
        "the grouping puts different addresses in the two groups",
        forJob1.onJob.length > 0 &&
            forJob1.others.length > 0 &&
            !forJob1.onJob.some((a) => forJob1.others.some((b) => b.id === a.id))
    );
    // The key reader has to find keys, or section 5 passes for a file it failed
    // to parse.
    const planted = parseSource(
        "const A = () => <p>{ADDRESS_COPY.label}{ADDRESS_COPY.otherAddress}</p>;\n",
        "<planted-keys>"
    );
    check(
        "a member expression is seen",
        [...memberKeys(planted, "ADDRESS_COPY")].sort().join(),
        "label,otherAddress"
    );
    check(
        "  and a key nothing reads is not invented",
        memberKeys(planted, "ADDRESS_COPY").has("required"),
        false
    );
    // And the branch derivation has to be able to answer BOTH ways, or every
    // equality in section 2 is what a constant reports.
    assert(
        "the derivation answers both branches",
        addressChoiceFromStored({ storedAddressId: "a1", defaultAddressId: "a1" }).useJobDefault !==
            addressChoiceFromStored({ storedAddressId: "a2", defaultAddressId: "a1" }).useJobDefault
    );
}

if (isMain(import.meta.url)) await standalone(title, run);

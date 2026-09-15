// Creating an address in the app (#384).
//
// WHAT THIS FILE HOLDS. Four claims, and each is a different kind of thing.
//
//   1. The label key folds what Airtable's `=` cannot, and is #18's fold rather
//      than a second one. Behavioral.
//   2. `addressesOnJob` takes the UNION of two links. This is the one that needed
//      a check: the mutant is reading only one of them, both halves keep working,
//      and what it costs is that the address a requester is most likely to retype
//      — the job's own default — is the one missing from the list shown to stop
//      them retyping it. Behavioral, and the anti-vacuity is two SEPARATE paths
//      rather than one assertion phrased twice.
//   3. Every word the screen renders comes out of `ADDRESS_CREATION_COPY`.
//      Structural, on the AST: a string written into JSX is invisible to the
//      vocabulary checks and to scripts/screen-strings.mjs, so a screen with copy
//      in its markup cannot be swept.
//   4. The read and the write are under one lock, and the gate runs first.
//      Structural, and source order is not execution order — see below.
//
// WHAT IT CANNOT SEE, and this is most of what the screen does.
//
//   - Whether anything RENDERS. This tier never opens a page, so the job panel
//     appearing when a job is picked, the amber preview line, and the form staying
//     on screen after a create are all browser work.
//   - Whether the lock WORKS. `withKeyLock` serializes within one process; what is
//     asserted here is that the call encloses both the read and the create, which
//     is source shape. Two concurrent Vercel invocations remain the residual every
//     find-or-create family on this base lives with.
//   - Whether `Addresses."Jobs"` exists on the base. No offline check reads the
//     base in either direction (docs/notes/verification.md), so a field renamed in
//     the Airtable UI would empty the panel with every check still green.
//     `offline/table-field-names.mjs` holds the names; only a render says more.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import {
    ADDRESS_CREATION_COPY,
    addressLabelKey,
    addressesOnJob,
    matchExistingAddress,
    readAddressFields,
} from "../../../lib/addressCreation.js";
import { textMatchKey } from "../../../lib/itemNaming.js";
import { parseFile, parseSource, walk, callsBefore, callsFunction, insideCallTo, resolveFunction } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Creating an address in the app (#384)";

/** Every string literal and template chunk rendered inside JSX in one file. */
function jsxText(parsed) {
    const out = [];
    walk(parsed.ast, (n) => {
        if (n.type === "JSXText") {
            const text = n.value.trim();
            if (text) out.push(text);
        }
    });
    return out;
}

/** Whether a file's `withKeyLock` call encloses a call to `name`. */
function lockedCallTo(parsed, fnName, name) {
    const fn = resolveFunction(parsed.ast, fnName);
    if (!fn) return null;
    let enclosed = false;
    walk(fn, (n) => {
        if (n.type !== "CallExpression") return;
        const callee = n.callee?.name ?? n.callee?.property?.name;
        if (callee !== name) return;
        if (insideCallTo(fn, n, "withKeyLock")) enclosed = true;
    });
    return enclosed;
}

const ADDRESSES = [
    { id: "a1", addressLabel: "Round Rock Yard", jobs: [] },
    { id: "a2", addressLabel: "Lone Star Pipe & Supply - Main", jobs: ["job2"] },
    { id: "a3", addressLabel: "Cedar Park Shop", jobs: ["job1", "job2"] },
];

export function run({ check, assert, log }) {
    // ── 1: the label key ───────────────────────────────────────────────────
    log("two typed labels are one address under the same fold as an item's size:");
    check("case is folded", addressLabelKey("ROUND ROCK YARD"), "round rock yard");
    check("the ends are trimmed", addressLabelKey("  Round Rock Yard  "), "round rock yard");
    check("an internal run collapses", addressLabelKey("Round  Rock   Yard"), "round rock yard");
    check("a blank label is an empty key", addressLabelKey("   "), "");
    check("a missing label is an empty key", addressLabelKey(undefined), "");
    // NOT A SECOND IMPLEMENTATION. `textMatchKey` is the composition #376 pulled
    // out of `toolNameKey`; writing the two halves again here would be the third
    // copy of one judgment, which is what CLAUDE.md's own section forbids.
    check(
        "and it is #18's fold rather than a second one",
        addressLabelKey("Round  ROCK Yard"),
        textMatchKey("Round  ROCK Yard")
    );

    // ── 2: the preview's match ─────────────────────────────────────────────
    log("");
    log("the form's preview finds a label already taken, on the list it holds:");
    check(
        "an exact label matches",
        matchExistingAddress("Round Rock Yard", ADDRESSES)?.id,
        "a1"
    );
    check("a differently cased one matches", matchExistingAddress("round rock yard", ADDRESSES)?.id, "a1");
    check("a differently spaced one matches", matchExistingAddress("Round  Rock Yard", ADDRESSES)?.id, "a1");
    check("an unused label matches nothing", matchExistingAddress("Leander Gate", ADDRESSES), null);
    // An empty box must not match the first row, which is what an empty key
    // compared against an empty key would do.
    check("an empty box matches nothing", matchExistingAddress("", ADDRESSES), null);
    check("and a missing list matches nothing", matchExistingAddress("Round Rock Yard", undefined), null);

    // ── 3: the union, which is the claim this file exists for ──────────────
    log("");
    log("the addresses a job uses are BOTH links, never one:");
    const jobWithDefault = { id: "job1", jobCode: "26-DEMO-01", deliveryAddress: ["a1"] };
    const onJob1 = addressesOnJob(jobWithDefault, ADDRESSES);
    check(
        "the default and the linked ones together",
        onJob1.map((a) => a.id).join(),
        "a3,a1"
    );
    // TWO SEPARATE PATHS, WHICH IS WHAT MAKES THE LINE ABOVE AN ASSERTION RATHER
    // THAN A RESTATEMENT. `a1` is reachable ONLY through `Jobs."Delivery Address"`
    // and `a3` ONLY through `Addresses."Jobs"`, so dropping either clause drops a
    // named row — the mutation this section was run against.
    assert(
        "  a1 is reachable only as the default",
        ADDRESSES.find((a) => a.id === "a1").jobs.length === 0 && jobWithDefault.deliveryAddress.includes("a1")
    );
    assert(
        "  and a3 only through the address's own link",
        ADDRESSES.find((a) => a.id === "a3").jobs.includes("job1") &&
            !jobWithDefault.deliveryAddress.includes("a3")
    );
    check("sorted by label, case-insensitively", onJob1.map((a) => a.addressLabel).join(" | "),
        "Cedar Park Shop | Round Rock Yard");
    // A job whose default is ALSO in the set is one row and not two.
    const both = addressesOnJob({ id: "job1", deliveryAddress: ["a3"] }, ADDRESSES);
    check("an address reached both ways appears once", both.length, 1);
    check("a job with neither gets none", addressesOnJob({ id: "job9", deliveryAddress: [] }, ADDRESSES).length, 0);
    check("no job at all gets none", addressesOnJob(null, ADDRESSES).length, 0);
    check("a job with no field at all gets none", addressesOnJob({ id: "job9" }, ADDRESSES).length, 0);
    check(
        "the second job's own two",
        addressesOnJob({ id: "job2", deliveryAddress: [] }, ADDRESSES).map((a) => a.id).sort().join(),
        "a2,a3"
    );

    // ── 4: the required set ────────────────────────────────────────────────
    log("");
    log("what an address needs before it is worth storing:");
    const complete = {
        addressLabel: "Round Rock Yard",
        line1: "4820 Freight Yard Rd",
        city: "Round Rock",
        state: "TX",
        zipCode: "78664",
    };
    check("a complete address is admitted", readAddressFields(complete).refusal, null);
    check("  and comes back trimmed", readAddressFields({ ...complete, city: " Round Rock " }).values.city, "Round Rock");
    for (const field of ["addressLabel", "line1", "city", "state", "zipCode"]) {
        check(
            `  a missing ${field} is refused`,
            readAddressFields({ ...complete, [field]: "" }).refusal,
            ADDRESS_CREATION_COPY.fieldsMissing
        );
        check(`  and yields no values`, readAddressFields({ ...complete, [field]: "" }).values, null);
    }
    // `Line 2` is the one the formula prints conditionally, so it is the one that
    // may be blank — a yard has no suite number.
    check("a missing suite is admitted", readAddressFields({ ...complete, line2: "" }).refusal, null);
    check("a whitespace-only field counts as missing", readAddressFields({ ...complete, state: "   " }).refusal,
        ADDRESS_CREATION_COPY.fieldsMissing);
    check("nothing at all is refused", readAddressFields(undefined).refusal, ADDRESS_CREATION_COPY.fieldsMissing);

    // ── 5: one sentence for the preview and the refusal ────────────────────
    log("");
    log("the collision is one sentence, said in two places:");
    const sentence = ADDRESS_CREATION_COPY.labelTaken("Round Rock Yard");
    assert("it names the address that exists", sentence.includes("Round Rock Yard"));
    assert("  and says what to do rather than what went wrong", /Use that one|give this one a name/.test(sentence));
    // The form and the action must both CALL the builder rather than spell it, or
    // the two could word one collision two ways the first time either is reworded.
    for (const file of ["app/addresses/new/AddressForm.js", "app/addresses/new/actions.js"]) {
        const src = parseFile(file).source;
        assert(`${file} calls the builder`, /labelTaken\(/.test(src));
    }

    // ── 6: no screen word is written into the markup ───────────────────────
    log("");
    log("every word the screen says is in the copy constant and none is in JSX:");
    for (const file of ["app/addresses/new/page.js", "app/addresses/new/AddressForm.js"]) {
        const stray = jsxText(parseFile(file));
        check(`${file} renders no bare text`, stray.length ? stray.join(" / ") : "none", "none");
    }
    // And the constant is actually carrying the screen, rather than being an empty
    // object every clause above passes against.
    assert(
        "the copy constant holds the screen's words",
        Object.keys(ADDRESS_CREATION_COPY).length >= 15
    );
    assert("  including a heading and a submit", Boolean(ADDRESS_CREATION_COPY.heading && ADDRESS_CREATION_COPY.submit));

    // ── 6b: the job grouping is named the same on both screens ─────────────
    log("");
    log("and the job picker's grouping is `/prs/new`'s words, not a second set:");
    // A VALUE PIN ACROSS TWO SCREENS, which is `screen-briefs.mjs`'s TIER_TWO
    // shape and is deliberately the loud failure mode: `/prs/new` spells these
    // into JSX, so nothing else in this tier can see them, and rewording that
    // picker without sweeping this one would leave the app grouping one thing
    // two ways. This fails on that day rather than passing quietly.
    const prFormSrc = parseFile("app/prs/new/PRForm.js").source;
    for (const [what, word] of [
        ["the reader's own", ADDRESS_CREATION_COPY.jobGroupMine],
        ["the rest", ADDRESS_CREATION_COPY.jobGroupRest],
        ["the only group", ADDRESS_CREATION_COPY.jobGroupOnly],
    ]) {
        assert(`  ${what} is still what /prs/new says (${word})`, prFormSrc.includes(`"${word}"`));
    }

    // ── 7: the gate, and the lock around the read-then-write ───────────────
    log("");
    log("the action gates before it writes, and the write path locks:");
    const actions = parseFile("app/addresses/new/actions.js");
    const handler = resolveFunction(actions.ast, "createAddressAction");
    assert("createAddressAction exists", Boolean(handler));
    assert("  it calls requireUser", callsFunction(handler, "requireUser"));
    assert(
        "  before the create",
        callsBefore(handler, "requireUser", "createAddressIfLabelFree")
    );
    // SOURCE ORDER IS NOT EXECUTION ORDER — `_ast.mjs` says so and it is true here
    // too. What this proves is that nobody wrote the write above the gate, not
    // that the gate ran. `offline/authz-structure.mjs` carries the export itself.
    const addresses = parseFile("lib/airtable/addresses.js");
    assert(
        "the read is inside the lock",
        lockedCallTo(addresses, "createAddressIfLabelFree", "getAddressByLabel")
    );
    assert(
        "  and so is the create",
        lockedCallTo(addresses, "createAddressIfLabelFree", "createAddress")
    );

    // ── 8: the pure module stays reachable from the browser ────────────────
    log("");
    log("the copy module imports nothing the browser cannot have:");
    const imported = [];
    walk(parseFile("lib/addressCreation.js").ast, (n) => {
        if (n.type === "ImportDeclaration") imported.push(n.source.value);
    });
    check("lib/addressCreation.js imports", imported.join(), "./itemNaming.js");
    // The extension is spelled out because this tier runs under plain `node` with
    // no loader — the lib/materialPriceView.js precedent (#19).
    assert("  with the extension spelled out", imported.every((s) => s.endsWith(".js")));

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — every matcher is seen to be able to say no:");
    // The JSX walker has to FIND text, or section 6 is what it reports for any
    // file including one it failed to parse.
    const planted = parseSource("const A = () => <div>Created job</div>;\n", "<planted-jsx>");
    check("a bare string in JSX is reported", jsxText(planted).join(), "Created job");
    check("  and an expression container is not", jsxText(parseSource("const A = () => <div>{x}</div>;", "<expr>")).length, 0);
    // The lock reader has to say NO for an unlocked call, or section 7 passes for
    // any function that happens to mention the name.
    const unlocked = parseSource(
        "export async function createAddressIfLabelFree() {\n" +
            "  const existing = await getAddressByLabel('x');\n" +
            "  return createAddress({});\n" +
            "}\n",
        "<unlocked>"
    );
    assert(
        "an unlocked read-then-write is reported",
        lockedCallTo(unlocked, "createAddressIfLabelFree", "getAddressByLabel") === false
    );
    // And the union has to be able to return a SUBSET, or every count above is
    // what a function returning its whole input reports.
    assert(
        "the union discards an address on neither link",
        addressesOnJob({ id: "job1", deliveryAddress: ["a1"] }, ADDRESSES).length < ADDRESSES.length
    );
}

if (isMain(import.meta.url)) await standalone(title, run);

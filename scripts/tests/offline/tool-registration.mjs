// Registering tool items — the pure half (#338).
//
// WHAT THIS FILE IS FOR. `lib/toolRegistration.js` holds one judgment that two
// readers reach independently: the form previews whether a typed name names a
// tool that already exists, and the action decides whether to create a second
// `Tools` row. If those two ever disagree, the screen tells somebody they are
// adding to an existing tool while the write coins a new one — and nothing
// fails, because the two answers are never compared at runtime. So the key is
// one function and this file pins it.
//
// IT ALSO PINS THE ONE PLACE THIS AXIS DELIBERATELY DISAGREES WITH ITS
// NEIGHBOUR. `assignedJobsFor` is not `lib/deliveryAccess.js:accessibleJobs`:
// that predicate admits President and Admin to every job, and this one admits
// nobody who is not assigned. An Admin on no job can record a delivery and
// cannot register a tool item, which reads like a bug until you know that
// `Tool Log."Job"` is the job the event HAPPENED on and the tools track does not
// pass through the office. Assertion 4 holds the disagreement itself, so a later
// pass that "fixes" one of them fails here rather than silently widening a write
// path.
//
// WHAT IT CANNOT SEE. Whether Airtable agrees. The lookup this key stands in for
// is `LOWER(TRIM({Tool Name})) = LOWER(TRIM(…))`, and that comparison lives in a
// credentialed module — this tier never loads `lib/airtable/`. #338 measured the
// live behavior read-only (Airtable's `=` is CASE-SENSITIVE, and neither form
// collapses an internal whitespace run) and that measurement is in
// `docs/notes/tools.md` and in `getToolByName`'s own header. Nothing here can
// re-measure it, and a green run is not evidence that the two halves match.
//
// It also cannot see rendering, which is this tier's standing limit: that the
// preview reaches a browser at all is checked with a real session and recorded
// in the pull request.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { canAccessJobDeliveries } from "../../../lib/deliveryAccess.js";
import { normalizeItemText } from "../../../lib/itemNaming.js";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    TOOL_REGISTRATION_COPY,
    assignedJobsFor,
    canRegisterToolItems,
    matchExistingTool,
    readQuantity,
    toolNameKey,
} from "../../../lib/toolRegistration.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Registering tool items — the pure half (#338)";

/** Every string the copy constant can produce, builders called with real input. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(TOOL_REGISTRATION_COPY)) {
        if (typeof value === "string") out.push(value);
    }
    out.push(TOOL_REGISTRATION_COPY.matchesExisting("Impact Driver"));
    out.push(TOOL_REGISTRATION_COPY.newTool("Impact Driver"));
    out.push(TOOL_REGISTRATION_COPY.quantityTooMany({ requested: 250, limit: 100 }));
    out.push(
        TOOL_REGISTRATION_COPY.registered({
            toolName: "Impact Driver",
            jobCode: "26-DEMO-01",
            toolItemIds: ["HYE-TL-260909-001", "HYE-TL-260909-002"],
        })
    );
    out.push(TOOL_REGISTRATION_COPY.registered({
        toolName: "Impact Driver",
        jobCode: "26-DEMO-01",
        toolItemIds: ["HYE-TL-260909-001"],
    }));
    out.push(TOOL_REGISTRATION_COPY.shortCount({ requested: 6, created: 4 }));
    return out;
}

/**
 * Every `item`/`items` in a string that is NOT part of `tool item`.
 *
 * The tools track's own vocabulary rule: a tool is one `tool item`, never a bare
 * `item`, because four other tables on this base hold item rows and a bare word
 * names a row on all of them. `offline/item-row-nouns.mjs` holds the app-wide
 * rule over screen strings; this holds it inside the one constant, which is where
 * every string on this screen lives.
 */
function bareItemWords(text) {
    return [...String(text).matchAll(/\b(items?)\b/gi)]
        .filter((m) => !/tool\s$/i.test(String(text).slice(0, m.index)))
        .map((m) => m[0]);
}

export function run({ check, assert, log }) {
    // ── 1: two spellings of one name are one key ────────────────────────────
    log("one tool name, however it is typed:");
    const canonical = toolNameKey("Impact Driver");
    for (const [what, typed] of [
        ["the same string", "Impact Driver"],
        ["lowercased", "impact driver"],
        ["uppercased", "IMPACT DRIVER"],
        ["with outer space", "  Impact Driver  "],
        ["with a doubled internal space", "Impact  Driver"],
        ["with a tab inside", "Impact\tDriver"],
        ["all four at once", "  impact \t driver "],
    ])
        check(`  ${what}`, toolNameKey(typed), canonical);

    // The other half of #18's split, and the reason the key is not the stored
    // value: case is fixed in the COMPARISON and never in what is written, because
    // the stored string is the only copy of what somebody typed.
    check(
        "the stored value keeps its case",
        normalizeItemText("  DeWalt  20V   SDS-Max "),
        "DeWalt 20V SDS-Max"
    );
    assert(
        "  so the key and the stored value are not the same string",
        toolNameKey("DeWalt 20V") !== normalizeItemText("DeWalt 20V")
    );

    // ── 2: the preview finds what the write would find ──────────────────────
    log("");
    log("the form's preview and the write reach one verdict:");
    const tools = [
        { id: "recA", toolName: "Impact Driver" },
        { id: "recB", toolName: "Angle Grinder" },
    ];
    check("a differently cased name matches", matchExistingTool("IMPACT driver", tools)?.id, "recA");
    check("  and one with extra spacing", matchExistingTool(" Angle  Grinder ", tools)?.id, "recB");
    check("a name nothing holds matches nothing", matchExistingTool("Rotary Hammer", tools), null);
    check("an empty name matches nothing", matchExistingTool("   ", tools), null);
    check("and no list matches nothing", matchExistingTool("Impact Driver", []), null);

    // ── 3: how many one submission may write ───────────────────────────────
    log("");
    log("the quantity, and the ceiling one invocation can carry:");
    check("a plain 1", readQuantity("1").count, 1);
    check("  and the ceiling itself", readQuantity(String(MAX_TOOL_ITEMS_PER_REGISTRATION)).count, MAX_TOOL_ITEMS_PER_REGISTRATION);
    for (const [what, raw] of [
        ["nothing", ""],
        ["only spaces", "   "],
        ["zero", "0"],
        ["a negative", "-4"],
        ["a fraction", "1.5"],
        ["a word", "six"],
        ["one over the ceiling", String(MAX_TOOL_ITEMS_PER_REGISTRATION + 1)],
    ]) {
        const { count, refusal } = readQuantity(raw);
        assert(`  ${what} is refused and carries no count`, count === null && typeof refusal === "string" && refusal.length > 0);
    }
    // The refusal a person acts on has to name both figures AND the way out,
    // because the way out is repeating the form rather than giving up: the
    // find-or-create path lands the rest under the same tool.
    const tooMany = TOOL_REGISTRATION_COPY.quantityTooMany({ requested: 250, limit: 100 });
    assert("the ceiling refusal names what was asked for", tooMany.includes("250"));
    assert("  and the ceiling", tooMany.includes("100"));
    assert("  and that the rest land under the same tool", tooMany.includes("same tool"));

    // ── 4: the job comes off the actor, with no office clause ───────────────
    log("");
    log("the job is the actor's own assignment, and this axis differs from deliveries:");
    const jobs = [
        { id: "job1", jobCode: "26-DEMO-01" },
        { id: "job2", jobCode: "26-DEMO-02" },
    ];
    const onOne = { assignedJobs: ["job2"], isAdmin: false, role: "Employee" };
    const onNone = { assignedJobs: [], isAdmin: false, role: "Employee" };
    const adminOnNone = { assignedJobs: [], isAdmin: true, role: "Employee" };
    const presidentOnNone = { assignedJobs: [], isAdmin: false, role: "President" };

    check("one assignment yields one job", assignedJobsFor(onOne, jobs).map((j) => j.id).join(), "job2");
    check("no assignment yields none", assignedJobsFor(onNone, jobs).length, 0);
    check("a missing user yields none", assignedJobsFor(undefined, jobs).length, 0);
    check("both assignments yield both", assignedJobsFor({ assignedJobs: ["job1", "job2"] }, jobs).length, 2);
    check("an assignment to a job that is not in the list yields none", assignedJobsFor({ assignedJobs: ["gone"] }, jobs).length, 0);

    check("an Admin on no job may not register", canRegisterToolItems(adminOnNone, jobs), false);
    check("a President on no job may not either", canRegisterToolItems(presidentOnNone, jobs), false);
    check("an Employee on one job may", canRegisterToolItems(onOne, jobs), true);

    // THE DISAGREEMENT ITSELF, held rather than described. These two predicates
    // answer different questions and a later pass that aligns them would widen a
    // write path with nothing failing.
    assert(
        "the delivery predicate admits an Admin on no job",
        canAccessJobDeliveries(adminOnNone, "job1") === true
    );
    assert(
        "  and this one does not, which is the whole reason there are two",
        canRegisterToolItems(adminOnNone, jobs) === false
    );

    // ── 5: the copy ────────────────────────────────────────────────────────
    log("");
    log("every word the screen can say:");
    const strings = copyStrings();
    assert(`the constant yielded ${strings.length} strings`, strings.length > 12);
    check("none is empty", strings.filter((s) => !s || !s.trim()).length, 0);
    check(
        "none renders `undefined` or `NaN` from a builder",
        strings.filter((s) => /undefined|NaN/.test(s)).length,
        0
    );
    const bare = strings.flatMap((s) => bareItemWords(s).map(() => s));
    check(
        `no bare \`item\` where the noun is a tool item${bare.length ? ` (${JSON.stringify(bare[0])})` : ""}`,
        bare.length,
        0
    );
    // The account of what was written names the ids rather than counting them,
    // because a Tool Item ID is printed onto a sticker.
    const account = TOOL_REGISTRATION_COPY.registered({
        toolName: "Impact Driver",
        jobCode: "26-DEMO-01",
        toolItemIds: ["HYE-TL-260909-001", "HYE-TL-260909-002"],
    });
    assert("the account names the tool", account.includes("Impact Driver"));
    assert("  and the job it was filed against", account.includes("26-DEMO-01"));
    assert("  and reads singular at one", TOOL_REGISTRATION_COPY.registered({
        toolName: "T",
        jobCode: "J",
        toolItemIds: ["x"],
    }).includes("1 tool item of"));
    // The one state a tool item can be in with no history: `Tool Items` carries no
    // `Created At`, so nothing else holds the moment it came into existence.
    assert(
        "the unlogged sentence says what is missing rather than what failed",
        TOOL_REGISTRATION_COPY.unlogged.includes("came into existence")
    );

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // Most assertions above are equalities against a canonical value, and a key
    // function that returned a constant would satisfy every one of them.
    assert(
        "the key tells two different tools apart",
        toolNameKey("Impact Driver") !== toolNameKey("Angle Grinder")
    );
    assert(
        "  and does not collapse a name that merely starts the same",
        toolNameKey("Impact Driver") !== toolNameKey("Impact Driver XR")
    );
    assert("the key of nothing is empty", toolNameKey("   ") === "");
    // The refusal detector is seen to refuse and to admit, since "every bad value
    // is refused" is also what a function returning a refusal always would give.
    assert("a good quantity is NOT refused", readQuantity("7").refusal === null);
    // The copy scanner is seen finding a planted bare noun, since zero is also
    // what a broken regex reports.
    assert(
        "the copy scanner finds a planted bare `item`",
        bareItemWords("Every item on this purchase order.").length === 1
    );
    assert(
        "  and does not flag `tool item` or `tool items`",
        bareItemWords("These tool items and that tool item.").length === 0
    );
    assert("the ceiling is a positive whole number", Number.isInteger(MAX_TOOL_ITEMS_PER_REGISTRATION) && MAX_TOOL_ITEMS_PER_REGISTRATION > 0);
}

if (isMain(import.meta.url)) await standalone(title, run);

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
// THE JOB RULE IT USED TO PIN IS `offline/tool-job.mjs`'s SINCE #363, and so is
// the deliberate disagreement with `lib/deliveryAccess.js:accessibleJobs`.
// `assignedJobsFor` left `lib/toolRegistration.js` when the retirement made it
// three write paths' rule rather than this screen's. What section 4 keeps is
// `canRegisterToolItems`, which really is this form's own question.
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
// AND SINCE #449 IT HOLDS WHERE A REGISTRATION LANDS, in the same two halves. What
// the form opens filled with and what a landing's account reads as are pure, held
// by value at their edges. Where the action sends the person — which record, which
// page, which tool items selected and what account beside them — is in a module
// this tier cannot load (the action reaches lib/airtable/), and naming the calls
// would be satisfied by every wrong version of them, so the redirect's ARGUMENTS
// and the form's state are read off the AST, each beside a planted file doing it
// wrong. **What that cannot show is the two failures themselves**: a batch that
// stops short and a log pass that stops are both unreachable without breaking the
// base, so the refusal, the shortfall and the unlogged names are held here as
// source and as words, and never as a run.
//
// AND SINCE #455 THE WORDS ARE THE DESIGN'S, pinned by value — `create` for the act and
// `tool` for what one creates. The scanner that failed a bare `item` here went with the
// rule it held: that rule was the tools area's stricter reading of #303, and the design
// reversed it. What replaces it is the sweep's own claim, that no string in the
// constant says `tool item`. `offline/tool-screen-words.mjs` holds the verb across
// every tools screen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { normalizeItemText } from "../../../lib/itemNaming.js";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    TOOL_REGISTRATION_COPY,
    canRegisterToolItems,
    matchExistingTool,
    readQuantity,
    readRegistrationAccount,
    readRegistrationPrefill,
    toolNameKey,
} from "../../../lib/toolRegistration.js";
import { registerPath, toolPath } from "../../../lib/toolRoutes.js";
import { callsTo, insideTry, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Registering tool items — the pure half, and where a registration lands (#338, #449, #455)";

/** The action whose redirect section 8 reads, and the form whose state it reads. */
const ACTION = "app/(tools)/tools/new/actions.js";
const FORM = "app/(tools)/tools/new/ToolRegistrationForm.js";

/** Every string the copy constant can produce, builders called with real input. */
function copyStrings() {
    const out = [];
    for (const value of Object.values(TOOL_REGISTRATION_COPY)) {
        if (typeof value === "string") out.push(value);
    }
    out.push(TOOL_REGISTRATION_COPY.matchesExisting("Impact Driver"));
    out.push(TOOL_REGISTRATION_COPY.newTool("Impact Driver"));
    out.push(TOOL_REGISTRATION_COPY.quantityTooMany({ requested: 250, limit: 100 }));
    for (const n of [1, 5]) out.push(TOOL_REGISTRATION_COPY.noneWritten(n));
    out.push(TOOL_REGISTRATION_COPY.shortfallHeading({ created: 3, asked: 5 }));
    for (const n of [1, 4]) {
        out.push(TOOL_REGISTRATION_COPY.shortfall(n));
        out.push(TOOL_REGISTRATION_COPY.unloggedHeading(n), TOOL_REGISTRATION_COPY.unlogged(n));
    }
    return out;
}

/** `tool.id` for a member read, the bare name for an identifier, else the node's type. */
function nameOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) return `${nameOf(node.object)}.${node.property.name}`;
    return node?.type ?? "none";
}

/**
 * The noun the design replaced (#455), in any number and case.
 *
 * WHAT IT REPLACED IS THE OPPOSITE RULE. This file failed a bare `item` until #455, as
 * the tools area's reading of #303; the design put `item` on a tool's own page and
 * `tool` in every sentence about one, so what a string here may no longer say is the
 * noun it used to require.
 */
const TOOL_ITEM_NOUN = /\btool items?\b/i;

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

    // ── 4: who may use this form at all ────────────────────────────────────
    // THE JOB RULE ITSELF MOVED TO `offline/tool-job.mjs` IN #363, with the
    // function it is about: three write paths read it now, so a check named for
    // this screen was asserting about a module the other two would not think to
    // look in. What stays here is this form's own question — whether the person
    // in front of it may use it — which is `canRegisterToolItems` and nothing
    // else. The disagreement with `canAccessJobDeliveries` moved with the rule.
    log("");
    log("whether this person may use this form:");
    const jobs = [
        { id: "job1", jobCode: "26-DEMO-01" },
        { id: "job2", jobCode: "26-DEMO-02" },
    ];
    const onOne = { assignedJobs: ["job2"], isAdmin: false, role: "Employee" };
    const adminOnNone = { assignedJobs: [], isAdmin: true, role: "Employee" };
    const presidentOnNone = { assignedJobs: [], isAdmin: false, role: "President" };

    check("an Admin on no job may not register", canRegisterToolItems(adminOnNone, jobs), false);
    check("a President on no job may not either", canRegisterToolItems(presidentOnNone, jobs), false);
    check("an Employee on one job may", canRegisterToolItems(onOne, jobs), true);
    check("and neither may somebody with no user at all", canRegisterToolItems(undefined, jobs), false);

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
    // THE SWEEP'S CLAIM (#455): the design's noun is `tool`, so nothing here says the
    // one it replaced. The whole constant, builders called, rather than a list of keys —
    // a key added later is held without anybody remembering to name it.
    const oldNoun = strings.filter((s) => TOOL_ITEM_NOUN.test(s));
    check(
        `no string says \`tool item\`${oldNoun.length ? ` (${JSON.stringify(oldNoun[0])})` : ""}`,
        oldNoun.length,
        0
    );
    // THE FORM'S OWN ACCOUNT IS GONE (#449): a registration lands on its tool's page,
    // whose selection names every id it wrote, so the words that stated it here went
    // with it and nothing on the form says what was written.
    check(
        "no word is left for the form's own account",
        ["registered", "ids", "shortCount"].filter((key) => key in TOOL_REGISTRATION_COPY).join(", "),
        ""
    );
    // THE DESIGN'S WORDS (#455), BY VALUE. The form's heading is also `/tools`' control,
    // so the two are one string; the submit names what it makes.
    check("the heading, which /tools' control carries", TOOL_REGISTRATION_COPY.heading, "New tools");
    check("  and the submit", TOOL_REGISTRATION_COPY.submit, "Create tools");
    // WHAT A REGISTRATION SAYS WHERE IT LANDS, pinned by value. The fork's two sentences
    // and its two answers, one going on and one stopping — and the notice, whose one
    // control dismisses it and repairs nothing, because nothing repairs what it names.
    check("the fork's first sentence", TOOL_REGISTRATION_COPY.shortfallHeading({ created: 3, asked: 5 }), "3 of 5 tools created");
    check("  its second", TOOL_REGISTRATION_COPY.shortfall(2), "2 couldn't be created");
    check("  at one", TOOL_REGISTRATION_COPY.shortfall(1), "1 couldn't be created");
    check("  the answer that goes on", TOOL_REGISTRATION_COPY.registerOthers, "Create the rest");
    check("  and the one that stops", TOOL_REGISTRATION_COPY.doneRegistering, "Not now");
    // THE CONTROL A TOOL'S OWN PAGE OPENS THE FORM FROM (#451), which begins a
    // registration where the fork's first answer finishes one — so it says `more of this
    // tool` beside `the rest`, and never the heading `/tools` opens the form with.
    check(
        "the control a tool's page opens the form from",
        TOOL_REGISTRATION_COPY.registerMore,
        "Create more of this tool"
    );
    check("the notice", TOOL_REGISTRATION_COPY.unloggedHeading(2), "2 tools have no creation date");
    check("  at one", TOOL_REGISTRATION_COPY.unloggedHeading(1), "1 tool has no creation date");
    check("  what it means", TOOL_REGISTRATION_COPY.unlogged(2), "Only the creation date wasn't saved for these");
    check("  at one", TOOL_REGISTRATION_COPY.unlogged(1), "Only the creation date wasn't saved for this one");
    check("  and the control that takes it away", TOOL_REGISTRATION_COPY.gotIt, "Got it");
    // A batch that wrote nothing stays on the form, and what it says is true whether the
    // tool was found or made just now.
    check(
        "nothing written",
        TOOL_REGISTRATION_COPY.noneWritten(5),
        "None of the 5 asked for were created. Creating them again puts them under the same tool."
    );
    check(
        "  and at one",
        TOOL_REGISTRATION_COPY.noneWritten(1),
        "The one asked for was not created. Creating it again puts it under the same tool."
    );
    // THE SWEEP'S OWN SENTENCES (#455), the ones the design did not draw and the verb and
    // the noun were carried into. The preview names the tool and what joins it, so the
    // second takes `These` rather than a second `tool` meaning something else; and the
    // no-job sentence keeps what the reader can do, which is ask.
    check(
        "the preview for a tool that exists",
        TOOL_REGISTRATION_COPY.matchesExisting("Impact Driver"),
        "Impact Driver is already a tool. These join the ones already under it."
    );
    check("  and for one that does not", TOOL_REGISTRATION_COPY.newTool("Impact Driver"), "Impact Driver is a tool nobody has created yet.");
    check("the count left empty", TOOL_REGISTRATION_COPY.quantityMissing, "Say how many tools to create.");
    check(
        "  and one past the ceiling",
        TOOL_REGISTRATION_COPY.quantityTooMany({ requested: 250, limit: 100 }),
        "250 is more than can be created at once. Create up to 100 at a time and repeat for the rest — they land under the same tool."
    );
    check(
        "a reader on no job",
        TOOL_REGISTRATION_COPY.noJob,
        "You are not assigned to a job, so there is no job to create tools against. Ask for a job assignment first."
    );

    // ── 6: what the form opens with (#449) ──────────────────────────────────
    log("");
    log("the form opens on what its address names, and on nothing its submit would refuse:");
    // THE CEILING IS PINNED FIRST, because the edge below is its: 100 opens as itself and
    // 101 at one only while one submission may write a hundred.
    check("one submission writes at most", MAX_TOOL_ITEMS_PER_REGISTRATION, 100);
    const opens = (sp) => JSON.stringify(readRegistrationPrefill(sp));
    check(
        "a tool and a count",
        opens({ toolName: "  DEMO Angle Grinder ", quantity: "4" }),
        JSON.stringify({ toolName: "DEMO Angle Grinder", quantity: 4 })
    );
    check("  nothing named opens empty, at one", opens({}), JSON.stringify({ toolName: "", quantity: 1 }));
    // A NAME ALONE IS WHAT A TOOL'S OWN PAGE SENDS (#451), and its count starts where the
    // count of an address naming nothing does, and where a count the submit refuses does.
    check(
        "  a tool and no count opens on the tool, at one",
        opens({ toolName: "DEMO Angle Grinder" }),
        JSON.stringify({ toolName: "DEMO Angle Grinder", quantity: 1 })
    );
    check("  the ceiling opens as itself", readRegistrationPrefill({ quantity: "100" }).quantity, 100);
    for (const [raw, why] of [
        ["101", "one over the ceiling"],
        ["0", "zero"],
        ["-3", "a negative"],
        ["2.5", "a fraction"],
        ["four", "a word"],
        [["4", "5"], "a repeated key"],
    ])
        check(`  ${why} opens at one`, readRegistrationPrefill({ quantity: raw }).quantity, 1);
    check("  a repeated name opens empty", readRegistrationPrefill({ toolName: ["A", "B"] }).toolName, "");
    // THE WRITE AND THE READ AGREE, through the browser's own parser, on a name holding the
    // characters a query has to escape.
    const reopened = new URLSearchParams(registerPath({ toolName: "A & B / C+D", quantity: 7 }).split("?")[1]);
    check(
        "  an address registerPath writes opens the form on the same two values",
        opens({ toolName: reopened.get("toolName"), quantity: reopened.get("quantity") }),
        JSON.stringify({ toolName: "A & B / C+D", quantity: 7 })
    );
    // AND THE NAME ALONE, read the way the form's page gets it: a plain object with no
    // `quantity` key at all, which is what an address without one hands the page.
    check(
        "  and one naming the tool alone opens on that name, at one",
        opens(Object.fromEntries(new URLSearchParams(registerPath({ toolName: "A & B / C+D" }).split("?")[1]))),
        JSON.stringify({ toolName: "A & B / C+D", quantity: 1 })
    );

    // ── 7: what a landing's account reads as (#449) ─────────────────────────
    log("");
    log("a registration's landing carries what it could not show, and nothing it cannot have:");
    // A SHORTFALL IS A PAIR SINCE #455: how many were asked for, and how many of those
    // were not written. `1 ≤ unwritten < asked ≤ the ceiling`, read as one value, since
    // `3 of 5 tools created` is false the moment either half is.
    const accountOf = (asked, unwritten) => {
        const account = readRegistrationAccount({ asked, unwritten });
        return `${account.asked}/${account.unwritten}`;
    };
    check("five asked, two not written", accountOf("5", "2"), "5/2");
    check("  the smallest shortfall there is, one of two", accountOf("2", "1"), "2/1");
    check("  and the largest, one written of the most one submission asks for", accountOf("100", "99"), "100/99");
    for (const [asked, unwritten, why] of [
        ["5", "5", "none written, which stays on the form rather than landing,"],
        ["5", "0", "none unwritten, which is no shortfall,"],
        ["5", "6", "more unwritten than asked for"],
        ["101", "100", "more asked for than one submission may write"],
        ["1", "1", "one asked for and not written"],
        [undefined, "2", "a count with nothing asked beside it"],
        ["5", undefined, "an asked with no count"],
        ["5", "1.5", "a fraction"],
        ["five", "2", "a word"],
        [["5"], "2", "a repeated key"],
        ["5", ["2"], "  and a repeated count"],
    ])
        check(`  ${why} offers nothing`, accountOf(asked, unwritten), "0/0");
    check(
        "the unlogged ids read as the selection does, canonical and each once",
        readRegistrationAccount({
            unlogged: ["hye-tl-260928-014", "HYE-TL-260928-014 ", "HYE-TL-260928-015"],
        }).unlogged.join(),
        "HYE-TL-260928-014,HYE-TL-260928-015"
    );
    check("  one as a string", readRegistrationAccount({ unlogged: "HYE-TL-260928-014" }).unlogged.join(), "HYE-TL-260928-014");
    check("  and none as none", readRegistrationAccount({}).unlogged.length, 0);
    // THE WRITE AND THE READ AGREE: what `toolPath` puts on a landing is what this takes
    // off it, and the selection beside it comes through untouched.
    const landed = new URLSearchParams(
        toolPath("recAbc", 2, ["HYE-TL-260928-014", "HYE-TL-260928-015"], {
            asked: 5,
            unwritten: 3,
            unlogged: ["HYE-TL-260928-015"],
        }).split("?")[1]
    );
    const readBack = readRegistrationAccount({
        asked: landed.get("asked"),
        unwritten: landed.get("unwritten"),
        unlogged: landed.getAll("unlogged"),
    });
    check(
        "  a landing toolPath writes reads back as the same account",
        `${readBack.asked} ${readBack.unwritten} ${readBack.unlogged.join()}`,
        "5 3 HYE-TL-260928-015"
    );
    check("  beside the same selection", landed.getAll("id").join(), "HYE-TL-260928-014,HYE-TL-260928-015");

    // ── 8: where the action sends the person, and what the form keeps (#449) ─
    log("");
    log("a registration that wrote anything lands on its tool, and the form holds only a refusal:");
    const landingFacts = (ast) => {
        const facts = { found: false, redirects: 0, returns: [], toolFrom: null, caughtInto: null };
        const action = resolveFunction(ast, "registerToolItemsAction");
        if (!action) return facts;
        facts.found = true;
        walk(action, (n) => {
            // `const { tool } = await upsertTool(…)` — where the record id comes from.
            if (n.type === "VariableDeclarator" && n.id?.type === "ObjectPattern") {
                const init = n.init?.type === "AwaitExpression" ? n.init.argument : n.init;
                if (n.id.properties.some((p) => p.key?.name === "tool")) facts.toolFrom = nameOf(init?.callee ?? {});
            }
            if (n.type === "ReturnStatement" && n.argument?.type === "ObjectExpression")
                facts.returns.push(n.argument.properties.map((p) => p.key?.name).join("+"));
            // Which list the log pass's failures are pushed into.
            if (n.type === "CatchClause")
                walk(n.body, (inner) => {
                    if (inner.type === "CallExpression" && inner.callee?.property?.name === "push" && facts.caughtInto === null)
                        facts.caughtInto = nameOf(inner.callee.object);
                });
        });
        // #455: the event each first log row is written with — the vocabulary's key, read
        // off the call, since a stale key and a spelled string both reach the writer as
        // an argument and only the argument's source tells them from the right one.
        const logCall = callsTo(action, "createToolLogEntry")[0];
        const eventValue = logCall?.arguments[0]?.properties?.find((p) => p.key?.name === "event")?.value;
        facts.event = eventValue?.type === "Literal" ? JSON.stringify(eventValue.value) : nameOf(eventValue ?? {});
        const redirects = callsTo(action, "redirect");
        facts.redirects = redirects.length;
        const call = redirects[0];
        if (!call) return facts;
        facts.inTry = insideTry(action, call);
        const path = call.arguments[0];
        facts.target = nameOf(path?.callee ?? {});
        const [record, page, selected, account] = path?.arguments ?? [];
        facts.record = nameOf(record ?? {});
        facts.page =
            page?.type === "CallExpression" ? `${nameOf(page.callee)}(${nameOf(page.arguments[0] ?? {})})` : nameOf(page ?? {});
        facts.selected =
            selected?.type === "CallExpression" && selected.callee?.property?.name === "map"
                ? `${nameOf(selected.callee.object)} → ${nameOf(selected.arguments[0]?.body ?? {})}`
                : nameOf(selected ?? {});
        const propertyOf = (name) => account?.properties?.find((p) => p.key?.name === name)?.value;
        facts.asked = nameOf(propertyOf("asked") ?? {});
        const unwritten = propertyOf("unwritten");
        facts.unwritten =
            unwritten?.type === "BinaryExpression"
                ? `${nameOf(unwritten.left)} ${unwritten.operator} ${nameOf(unwritten.right)}`
                : nameOf(unwritten ?? {});
        facts.unlogged = nameOf(propertyOf("unlogged") ?? {});
        // THE REFUSAL FOR A BATCH THAT WROTE NOTHING, and that it stands before the
        // redirect in the source — which is not execution order, and is what this tier has.
        facts.guardBefore = false;
        walk(action, (n) => {
            if (n.type !== "IfStatement" || n.start > call.start) return;
            const test = n.test;
            const empty =
                test?.type === "BinaryExpression" &&
                nameOf(test.left) === "created.length" &&
                test.operator === "===" &&
                test.right?.value === 0;
            const refuses =
                n.consequent?.type === "ReturnStatement" &&
                n.consequent.argument?.properties?.map((p) => p.key?.name).join() === "error";
            if (empty && refuses) facts.guardBefore = true;
        });
        return facts;
    };
    const land = landingFacts(parseFile(ACTION).ast);
    assert(`${ACTION} declares registerToolItemsAction`, land.found);
    check("its log pass writes the vocabulary's first event (#455)", land.event, "TOOL_EVENT.CREATED");
    check("it redirects once", land.redirects, 1);
    check("  to a tool's page", land.target, "toolPath");
    check("  the tool upsertTool found or made", `${land.record} from ${land.toolFrom}`, "tool.id from upsertTool");
    check("  on the page holding the first tool item it wrote", land.page, "pageHolding(tool.toolItems.length)");
    check("  selecting every tool item it created, by printed id", land.selected, "created → toolItem.toolItemId");
    check("  carrying as asked what the submission asked for (#455)", land.asked, "count");
    check("  counting as unwritten what was asked for less what was created", land.unwritten, "count - created.length");
    check("  and naming as unlogged the list its log pass fills on a failure", `${land.unlogged} ${land.caughtInto}`, "unlogged unlogged");
    check("the redirect is outside every try", land.inTry, false);
    check("  a batch that wrote nothing refuses before it", land.guardBefore, true);
    check("  and every value the action returns is a refusal", [...new Set(land.returns)].join(", "), "error");
    // ANTI-VACUITY: a planted action doing each of those wrong is seen doing it — the
    // record from another reader and another binding, the page from the count, a
    // selection of the logged tool items, a shortfall of the whole count, the redirect
    // inside the loop's try, the refusal after it, and the old account returned.
    const plantedLanding = landingFacts(
        parseSource(
            "export async function registerToolItemsAction(prevState, formData) {\n" +
                "  return withOpsLabel('registerToolItemsAction', async () => {\n" +
                "    const { tool } = await getToolByName(toolName);\n" +
                "    const { created } = await createToolItems({ toolRecordId: tool.id, jobRecordId: job.id, count });\n" +
                "    const logged = [];\n" +
                "    for (const toolItem of created) {\n" +
                "      try {\n" +
                "        await createToolLogEntry({ event: 'Registered' });\n" +
                "        redirect(toolPath(job.id, pageHolding(count), logged, { asked: created.length, unwritten: count, unlogged: created }));\n" +
                "      } catch { logged.push(toolItem.toolItemId); }\n" +
                "    }\n" +
                "    if (created.length === 0) return { error: 'x' };\n" +
                "    return { toolItemIds: created };\n" +
                "  });\n" +
                "}\n",
            "<planted-landing>"
        ).ast
    );
    check("  an event spelled as a string is seen", plantedLanding.event, '"Registered"');
    check("  a redirect to another record is seen", `${plantedLanding.record} from ${plantedLanding.toolFrom}`, "job.id from getToolByName");
    check("  a page from another figure is seen", plantedLanding.page, "pageHolding(count)");
    check("  a selection of anything but what was created is seen", plantedLanding.selected, "logged");
    check("  an asked figure that is what was created is seen", plantedLanding.asked, "created.length");
    check("  a shortfall of the whole count is seen", plantedLanding.unwritten, "count");
    check("  an unlogged list the failures do not fill is seen", `${plantedLanding.unlogged} ${plantedLanding.caughtInto}`, "created logged");
    check("  a redirect inside a try is seen", plantedLanding.inTry, true);
    check("  a refusal after the redirect is seen", plantedLanding.guardBefore, false);
    check("  and the old account returned is seen", [...new Set(plantedLanding.returns)].join(", "), "error, toolItemIds");

    const formFacts = (ast) => {
        const stateReads = new Set();
        let nameStartsFrom = null;
        let countStartsFrom = null;
        const opens = [];
        let formAttributes = null;
        let prevented = false;
        let dispatched = false;
        walk(ast, (n) => {
            // HOW THE FORM SUBMITS (#449): through `onSubmit`, which prevents the default and
            // hands the fields to the action inside a transition — the path React 19 does not
            // reset — with `action` kept for a press before hydration.
            if (n.type === "JSXOpeningElement" && n.name?.name === "form")
                formAttributes = n.attributes.map((a) => a.name?.name).sort().join(", ");
            if (n.type === "CallExpression" && nameOf(n.callee).endsWith(".preventDefault")) prevented = true;
            if (n.type === "CallExpression" && n.callee?.name === "startTransition")
                walk(n.arguments[0] ?? {}, (inner) => {
                    if (inner.type === "CallExpression" && inner.callee?.name === "formAction") dispatched = true;
                });
            if (n.type === "MemberExpression" && !n.computed && n.object?.type === "Identifier" && n.object.name === "state")
                stateReads.add(n.property.name);
            if (n.type === "CallExpression" && n.callee?.name === "useState") nameStartsFrom = nameOf(n.arguments[0] ?? {});
            if (n.type === "JSXOpeningElement" && n.name?.name === "input") {
                const attribute = (name) => n.attributes.find((a) => a.name?.name === name);
                if (attribute("name")?.value?.value === "quantity") {
                    const value = attribute("defaultValue")?.value;
                    const expression = value?.expression;
                    countStartsFrom =
                        expression?.type === "CallExpression" && expression.callee?.name === "String"
                            ? nameOf(expression.arguments[0])
                            : nameOf(expression ?? value ?? {});
                }
            }
            if (n.type === "CallExpression" && ["toolItemLabelsPath", "toolItemPath", "toolPath"].includes(n.callee?.name))
                opens.push(n.callee.name);
        });
        return {
            stateReads: [...stateReads].sort().join(", "),
            nameStartsFrom,
            countStartsFrom,
            opens: opens.join(", "),
            submits: `${formAttributes} · ${prevented ? "prevents the default" : "lets the default run"} · ${dispatched ? "dispatches in a transition" : "dispatches nothing itself"}`,
        };
    };
    const form = formFacts(parseFile(FORM).ast);
    check("the form reads nothing off its state but the refusal", form.stateReads, "error");
    check("  its name field starts from the page's prefill", form.nameStartsFrom, "prefill.toolName");
    check("  and its count from the prefill's count", form.countStartsFrom, "prefill.quantity");
    check("  and it links to no screen, the account's links gone with the account", form.opens, "");
    // A REFUSAL KEEPS WHAT WAS TYPED (#449), because the batch that wrote nothing tells the
    // reader to register again: measured in a browser, bound through `action` alone a
    // refusal put the count and the job back, and through the handler it keeps all three.
    check(
        "  it submits through a handler that keeps the fields, with the action kept for a press before hydration",
        form.submits,
        "action, onSubmit · prevents the default · dispatches in a transition"
    );
    // ANTI-VACUITY: a planted form reading its old account, starting both fields from
    // literals and linking to the label screen is seen doing all four.
    const plantedForm = formFacts(
        parseSource(
            "function ToolRegistrationForm({ prefill }) {\n" +
                "  const [state] = useActionState(registerToolItemsAction, null);\n" +
                '  const [toolName] = useState("");\n' +
                "  return (<form action={formAction}>{state?.error}{state?.toolItemIds && <Link href={toolItemLabelsPath(state.toolItemIds)} />}\n" +
                '    <input name="quantity" defaultValue="1" /></form>);\n' +
                "}\n",
            "<planted-form>"
        ).ast
    );
    check("  a form reading its old account is seen", plantedForm.stateReads, "error, toolItemIds");
    check("  a name started from nothing is seen", plantedForm.nameStartsFrom, "Literal");
    check("  a count started from a literal is seen", plantedForm.countStartsFrom, "Literal");
    check("  a link to the label screen is seen", plantedForm.opens, "toolItemLabelsPath");
    check("  and a form bound through `action` alone is seen", plantedForm.submits, "action · lets the default run · dispatches nothing itself");
    const plantedHandler = formFacts(
        parseSource(
            "function ToolRegistrationForm({ prefill }) {\n" +
                "  const [state, formAction] = useActionState(registerToolItemsAction, null);\n" +
                "  const submit = (event) => { formAction(new FormData(event.currentTarget)); };\n" +
                "  return <form onSubmit={submit}>{state?.error}</form>;\n" +
                "}\n",
            "<planted-handler>"
        ).ast
    );
    check(
        "  and so is a handler that drops the action and dispatches outside a transition",
        plantedHandler.submits,
        "onSubmit · lets the default run · dispatches nothing itself"
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
    // The noun matcher is seen finding the replaced noun in either number and any case,
    // and passing the design's, since zero is also what a broken regex reports.
    assert("the noun matcher finds `tool items`", TOOL_ITEM_NOUN.test("Say how many tool items to register."));
    assert("  and `Tool item`", TOOL_ITEM_NOUN.test("Tool item not found"));
    assert(
        "  and passes the design's `tools` and `items`",
        !TOOL_ITEM_NOUN.test("Say how many tools to create.") && !TOOL_ITEM_NOUN.test("13 items")
    );
    assert("the ceiling is a positive whole number", Number.isInteger(MAX_TOOL_ITEMS_PER_REGISTRATION) && MAX_TOOL_ITEMS_PER_REGISTRATION > 0);
}

if (isMain(import.meta.url)) await standalone(title, run);

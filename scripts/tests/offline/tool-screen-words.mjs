// The tools screens say `create`, never `register` (#455).
//
// WHAT THIS HOLDS. The design's word for making tools is `create`, and every string the
// tools screens render says it. The code keeps `register` — `registerToolItemsAction`,
// `lib/toolRegistration.js`, `canRegisterToolItems` and the rest — on purpose: `create` is the
// prefix of every single-table writer in lib/airtable/, and this act calls two of them.
// docs/notes/naming.md holds that row. A divergence like that has one hazard, and it is
// the one #227 named: the identifier is what teaches the word to the next string written
// beside it. So the build fails the moment a string on a tools screen says `register`,
// in any form — which is what makes keeping the identifiers safe rather than merely
// cheaper.
//
// SCOPE IS EVERY STRING THE TOOLS SCREENS RENDER, through `scripts/screen-strings.mjs` —
// the one collector, which `offline/item-row-nouns.mjs` already reads the same way —
// over the routes `lib/toolRoutes.js:TOOLS_ROUTES` declares. The route list is ALSO typed
// out here and compared, so a screen added to the axis is covered by being declared, and
// one dropped from the declaration is a failure rather than a screen nobody reads.
//
// WHAT IT CANNOT SEE. `docs/briefs/strings/unfindable.md`'s shapes, which that collector
// cannot see either; and a value the base supplies rather than the code — the history
// prints each row's stored `Event`, which `offline/tool-status.mjs` holds by value. It
// holds the VERB alone: the noun the design replaced, `tool item`, is still the one word
// of the not-found heading on the tool item's page, which the design is rewriting, so a
// ban on it across the axis would fail on a string this issue leaves for the design.
// Each constant the sweep reached holds that noun itself.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { stringsForRoute } from "../../screen-strings.mjs";
import { TOOLS_ROUTES } from "../../../lib/toolRoutes.js";
import { TOOL_REGISTRATION_COPY } from "../../../lib/toolRegistration.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The tools screens say `create`, never `register` (#455)";

/** The verb the design replaced, in every form a sentence takes it. */
const REGISTER = /regist/i;

/** The tools axis's routes, typed out — what this file covers, pinned by value. */
const ROUTES = [
    "/tools",
    "/tools/[toolRecordId]",
    "/tool-items/[toolItemId]",
    "/tool-items/labels",
    "/t/[labelCode]",
];

export function run({ check, assert, log }) {
    // ── 1: the screens it covers ────────────────────────────────────────────
    log("the routes this covers are the axis's, declared and typed out:");
    check("the declared routes", [...TOOLS_ROUTES].sort().join(", "), [...ROUTES].sort().join(", "));

    // ── 2: the verb ─────────────────────────────────────────────────────────
    log("");
    log("no string a tools screen renders says register:");
    let total = 0;
    for (const route of ROUTES) {
        const { strings, errors } = stringsForRoute(route);
        check(`  ${route} parses`, errors.length, 0);
        assert(`  ${route} renders strings (${strings.length})`, strings.length > 0);
        total += strings.length;
        const said = strings.filter((s) => REGISTER.test(s.text));
        const where = said.map((s) => `${s.file}:${s.line} ${JSON.stringify(s.text)}`).join("; ");
        check(`  ${route} says it nowhere${said.length ? ` (${where})` : ""}`, said.length, 0);
    }

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // The matcher, on the strings the screens said until this issue and on the design's.
    for (const planted of [
        "Register tool items",
        "Registering again writes them under the same tool.",
        "These were written, but their registration was not recorded",
        "is a tool nobody has registered yet.",
    ])
        assert(`  the matcher catches ${JSON.stringify(planted)}`, REGISTER.test(planted));
    for (const passed of ["New tools", "Create tools", "Create the rest", "Created"])
        assert(`  and passes ${JSON.stringify(passed)}`, !REGISTER.test(passed));
    // The collector reaches the constant that says the verb most: "nothing says it" is
    // also what a collector reading nothing reports. The registration has no route of
    // its own since #456, so its words are the list's, reached through the dialog the
    // list imports.
    const list = stringsForRoute("/tools").strings.map((s) => s.text);
    assert(
        "  the collector reaches the registration dialog's own words from the list",
        list.includes(TOOL_REGISTRATION_COPY.heading) &&
            list.includes(TOOL_REGISTRATION_COPY.submit) &&
            list.includes(TOOL_REGISTRATION_COPY.newTool)
    );
    const landing = stringsForRoute("/tools/[toolRecordId]").strings.map((s) => s.text);
    assert("  and the pieces of a builder on the page a registration lands on", landing.some((t) => t.includes("couldn't be created")));
    assert(`  ${total} strings read across ${ROUTES.length} screens`, total > 100);
}

if (isMain(import.meta.url)) standalone(title, run);

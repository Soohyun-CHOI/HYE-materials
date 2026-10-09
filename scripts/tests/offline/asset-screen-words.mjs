// The asset screens never say `register`, and say `create` only where it is named (#455, #485).
//
// WHAT THIS HOLDS. Putting assets into stock is `add` on the screen since #485, where it was
// the design's `create` from #455. The code keeps `register` — `registerAssetsAction`,
// `lib/assetRegistration.js`, `canRegisterAssets` and the rest — on purpose: it is the
// code's word for one act across three tables, which has not moved while the screen's word
// moved twice, and `create` is the prefix of every single-table writer in lib/airtable/, two
// of which this act calls. docs/notes/naming.md holds that row. A divergence like that has
// one hazard, and it is the one #227 named: the identifier is what teaches the word to the
// next string written beside it. So the build fails the moment a string on an asset screen
// says `register`, in any form — which is what makes keeping the identifiers safe rather
// than merely cheaper.
//
// AND SINCE #485 EVERY STRING THAT STILL SAYS `create` IS NAMED, WITH WHY. The hazard has a
// second word: `createAssets`, `createAssetLogEntry` and the log's `Created` all carry it,
// and the value pins in `offline/asset-registration.mjs` hold the strings they name and cannot
// see the next one written. So a string an asset screen renders that says `create` in any form
// fails here unless `STILL_CREATE` names it, and an entry no screen renders any more fails
// too, so the list cannot outlive what it is about.
//
// SCOPE IS EVERY STRING THE ASSET SCREENS RENDER, through `scripts/screen-strings.mjs` —
// the one collector, which `offline/item-row-nouns.mjs` already reads the same way —
// over the routes `lib/assetRoutes.js:ASSET_ROUTES` declares. The route list is ALSO typed
// out here and compared, so a screen added to the axis is covered by being declared, and
// one dropped from the declaration is a failure rather than a screen nobody reads.
//
// WHAT IT CANNOT SEE. `docs/briefs/strings/unfindable.md`'s shapes, which that collector
// cannot see either; and a value the base supplies rather than the code — the history
// prints each row's stored `Event`, which `offline/asset-status.mjs` holds by value. It
// holds the two VERBS alone. The noun the design replaced, `tool item`, said its last word
// on a screen in the asset page's not-found heading until #463 made it `Tool not
// found`; each constant the sweep reached holds that noun itself. This said the heading
// still said it, and the design was rewriting it; corrected per #181 by #485.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { stringsForRoute } from "../../screen-strings.mjs";
import { ASSET_ROUTES } from "../../../lib/assetRoutes.js";
import { ASSET_REGISTRATION_COPY } from "../../../lib/assetRegistration.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The asset screens never say `register`, and say `create` only where it is named (#455, #485)";

/** The verb the design replaced, in every form a sentence takes it. */
const REGISTER = /regist/i;

/** The verb #485 replaced for putting assets into stock, in every form a sentence takes it. */
const CREATE = /creat/i;

/**
 * Every string an asset screen renders that says `create`, as the collector reads it — a
 * builder's pieces rather than its sentence — with why each still does. Two kinds, and the
 * difference is what keeps the list short: a string about something other than adding assets,
 * which stays, and one about adding assets that #485 did not reach, which is left for the
 * design and should leave this list when it is reworded. The one of the second kind, a tool's
 * empty list, left it in #495, when the design's final files said `adding` there; and
 * `Creates a new tool`, the preview's second voice under a typed name, left it in #507 with the
 * typed name, since a registration picks a tool of the catalog and coins none.
 */
const STILL_CREATE = new Map([
    ["1 tool has no creation date", "the creation date, the moment the log's first row, `Created`, records"],
    ["tools have no creation date", "the creation date, in the notice's title for several"],
    [
        "Only the creation date wasn't saved for this one, and it can't be added later.",
        "the creation date, in the notice's sentence for one",
    ],
    ["Only the creation date wasn't saved for these", "the creation date, in the notice's sentence for several"],
]);

/** The strings saying `create` that `STILL_CREATE` does not name. */
const unnamedCreate = (strings) => strings.filter((s) => CREATE.test(s.text) && !STILL_CREATE.has(s.text));

/** The entries of `STILL_CREATE` that no rendered string says. */
const staleEntries = (rendered) => [...STILL_CREATE.keys()].filter((text) => !rendered.has(text));

/**
 * The assets axis's screens, typed out — what this file covers, pinned by value. The labels'
 * screen left the list in #457; its words are the dialog's, which the two pages that open
 * it render, so they are covered through those. The address a label prints left it in
 * #478; it draws nothing, so it says nothing.
 */
const ROUTES = [
    "/asset-categories",
    "/asset-categories/[categoryRecordId]",
    "/assets/[assetId]",
];

export function run({ check, assert, log }) {
    // ── 1: the screens it covers ────────────────────────────────────────────
    log("the routes this covers are the axis's, declared and typed out:");
    check("the declared routes", [...ASSET_ROUTES].sort().join(", "), [...ROUTES].sort().join(", "));

    // ── 2: the verbs ────────────────────────────────────────────────────────
    log("");
    log("no string an asset screen renders says register, and every one saying create is named:");
    let total = 0;
    const rendered = new Set();
    for (const route of ROUTES) {
        const { strings, errors } = stringsForRoute(route);
        check(`  ${route} parses`, errors.length, 0);
        assert(`  ${route} renders strings (${strings.length})`, strings.length > 0);
        total += strings.length;
        strings.forEach((s) => rendered.add(s.text));
        const said = strings.filter((s) => REGISTER.test(s.text));
        const where = said.map((s) => `${s.file}:${s.line} ${JSON.stringify(s.text)}`).join("; ");
        check(`  ${route} says it nowhere${said.length ? ` (${where})` : ""}`, said.length, 0);
        // What it says unnamed is the value, so a failure names the string and the label stays one.
        check(
            `  ${route} says create only where the list names it`,
            unnamedCreate(strings)
                .map((s) => `${s.file}:${s.line} ${JSON.stringify(s.text)}`)
                .join("; "),
            ""
        );
    }
    check("  and every string the list names is one an asset screen still renders", staleEntries(rendered).join(" | "), "");

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
    for (const passed of ["Add tools", "Add 5 tools", "Adding…", "Add 2 more", "Created"])
        assert(`  and passes ${JSON.stringify(passed)}`, !REGISTER.test(passed));
    // The second matcher and the list, on what the screens said for the act until #485 — each
    // caught and named nowhere, so each would fail above — and on its words now.
    for (const planted of ["Create tools", "Creating…", "tools created", "couldn't be created.", "Create the rest"])
        assert(`  the create matcher catches ${JSON.stringify(planted)}, which the list does not name`, CREATE.test(planted) && !STILL_CREATE.has(planted));
    for (const passed of ["Add tools", "Add 1 tool", "Adding…", "tools added", "couldn't be added.", "Add 2 more"])
        assert(`  and the create matcher passes ${JSON.stringify(passed)}`, !CREATE.test(passed));
    // The two readers above, on a planted screen and a planted rendering: a string the list
    // does not name is reported and one it names is not, and an entry nothing renders is.
    check(
        "  a planted screen's unnamed create is reported, and a named one is not",
        unnamedCreate([{ text: "Create tools" }, { text: "1 tool has no creation date" }])
            .map((s) => s.text)
            .join(" | "),
        "Create tools"
    );
    check(
        "  and every entry but the one a planted rendering says is reported stale",
        staleEntries(new Set(["1 tool has no creation date"])).length,
        STILL_CREATE.size - 1
    );
    // The collector reaches the constant that says the verb most: "nothing says it" is
    // also what a collector reading nothing reports. The registration has no route of
    // its own since #456, so its words are the list's, reached through the dialog the
    // list imports. The submit is a builder since #469, naming its count, and the collector
    // reads the words it is built of: the act alone, and the act with one. The way back from
    // the dialog's second step is a word only the dialog says (#507), which is what shows the
    // collector reached the dialog and not only the opener's word.
    const list = stringsForRoute("/asset-categories").strings.map((s) => s.text);
    assert(
        "  the collector reaches the registration dialog's own words from the list",
        list.includes(ASSET_REGISTRATION_COPY.heading) &&
            list.includes(ASSET_REGISTRATION_COPY.submit(null)) &&
            list.includes(ASSET_REGISTRATION_COPY.submit(1)) &&
            list.includes(ASSET_REGISTRATION_COPY.working) &&
            list.includes(ASSET_REGISTRATION_COPY.changeTool)
    );
    const landing = stringsForRoute("/asset-categories/[categoryRecordId]").strings.map((s) => s.text);
    assert("  and the pieces of a builder on the page a registration lands on", landing.some((t) => t.includes("couldn't be added")));
    assert(`  ${total} strings read across ${ROUTES.length} screens`, total > 100);
}

if (isMain(import.meta.url)) standalone(title, run);

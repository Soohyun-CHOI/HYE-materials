// The name sheet's list in a space of one height (#589), and the assets axis's name on
// screen, `Equipment & Tools` (#591).
//
// THE SPACE IS ONE ELEMENT WITH ONE CLASS, AND WHAT IT HOLDS IS A JUDGMENT. No check here
// renders the sheet, so what keeps its height the same in every state is read off the source:
// the space is drawn whatever the state, its class is a literal no state reaches, and Tailwind
// resolves that class to the design's 194 — the head's line and its 4 and three 56 rows with
// the Inner rule between them. What it holds — which head, which rows — is `nameListHead`,
// held by value over the five states the issue names: before anything is typed, while what
// is typed matches, when it matches nothing, on a job with no recent names, and before a job
// is chosen. The sentence that stood in the space on a job with none is held gone. And a move
// on the space is judged as #580 judges one anywhere in a sheet: the rows scroll once they
// overflow, and everything else in the space drags (`sheetHold.js:scrollsUnder`).
//
// THE AXIS'S NAME IS ONE STRING, AND THE OLD ONE IS HELD GONE FROM EVERYTHING A SCREEN CAN
// SAY. `ASSET_LIST_COPY.heading` and the way back say `Equipment & Tools` by value, the rail
// reads the heading, and no string literal, template or JSX text under `app/` or `lib/` says
// `Tools & Equipment` — comments are not read, since a comment may cite the design's word.
//
// WHAT IT CANNOT SEE. That a phone draws the space at 194 under its keyboard, or that it gives
// way first on a short screen: the flex arrangement is held here, the boxes were measured in a
// browser and are the phone's to see (docs/notes/design-system.md, #589).
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { ASSET_TRANSITION_COPY, RECENT_NAMES_SHOWN, nameListHead, offeredNames } from "../../../lib/assetTransition.js";
import { ASSET_LIST_COPY } from "../../../lib/assetListView.js";
import { ASSET_COPY } from "../../../lib/assetView.js";
import { NAVIGATION_COPY } from "../../../lib/navigation.js";
import { scrollsUnder } from "../../../app/components/sheetHold.js";
import { dragStarts } from "../../../app/components/sheetDrag.js";
import { listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "The name sheet's list in a space of one height (#589), and the axis's name on screen (#591)";

const NAME_SHEET = "app/(assets)/assets/[assetId]/NameSheet.js";

/** The sentence a job with no recent names said in the space until #589. */
const GONE_SENTENCE = "No items have gone out on this job yet.";

/** The axis's name until #591, which the design's files still say. */
const OLD_NAME = "Tools & Equipment";

const isConditional = (n) => n.type === "ConditionalExpression" || n.type === "LogicalExpression";

/**
 * The list's space in a parsed name sheet: the element carrying `data-name-list`, how many
 * carry it, its class when that is a string literal, and whether a condition stands between
 * it and the component's return.
 */
export function listSpace(parsed) {
    const parents = parentMap(parsed.ast);
    const found = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "JSXElement") return;
        const attributes = n.openingElement.attributes;
        if (!attributes.some((a) => a.name?.name === "data-name-list")) return;
        const className = attributes.find((a) => a.name?.name === "className")?.value;
        let conditional = false;
        for (let at = parents.get(n); at && at.type !== "ReturnStatement"; at = parents.get(at)) {
            if (isConditional(at)) conditional = true;
        }
        found.push({ className: className?.type === "Literal" ? className.value : null, conditional, node: n });
    });
    return { count: found.length, space: found[0] ?? null };
}

/** A stand-in for an element `scrollsUnder` walks: its overflow and, when it scrolls, how far. */
function box({ overflowY = "visible", scrollHeight = 0, clientHeight = 0, parent = null } = {}) {
    return { nodeType: 1, parentElement: parent, scrollHeight, clientHeight, style: { overflowY } };
}
const fakeWindow = { getComputedStyle: (element) => element.style };

/** Every string a file can render: literals, template parts and JSX text, comments aside. */
function renderedStrings(parsed) {
    const out = [];
    walk(parsed.ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        else if (n.type === "TemplateElement") out.push(n.value.cooked ?? "");
        else if (n.type === "JSXText") out.push(n.value);
    });
    return out;
}

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);

export async function run({ check, log }) {
    // ── #589: what the space holds, in the five states ─────────────────────
    log("the name sheet's list says one of three heads, or nothing, by the state (#589):");
    const RECENT = ["Mike R", "Ana Diaz", "Minjae Seo", "Mira Kang", "Sam Ito"];
    const head = (state) => nameListHead(state) ?? "nothing";
    const offered = (typed) => offeredNames(RECENT, typed);
    check(
        "  before anything is typed, the recent names under their head",
        `${head({ jobChosen: true, hasRecent: true, typed: "", offered: offered("") })} | ${offered("").join(", ")}`,
        "Recently at this job | Mike R, Ana Diaz, Minjae Seo"
    );
    check("    and a field of spaces is nothing typed", head({ jobChosen: true, hasRecent: true, typed: "   ", offered: offered("   ") }), "Recently at this job");
    check(
        "  while what is typed matches, every name it matches under `Matching names`, recent first",
        `${head({ jobChosen: true, hasRecent: true, typed: "mi", offered: offered("mi") })} | ${offered("mi").join(", ")}`,
        "Matching names | Mike R, Minjae Seo, Mira Kang"
    );
    check("    past the three shown before typing", offered("a").length, 4);
    check(
        "  when it matches nothing, `No past names match` over no rows",
        `${head({ jobChosen: true, hasRecent: true, typed: "zz", offered: offered("zz") })} | ${offered("zz").length}`,
        "No past names match | 0"
    );
    check(
        "  on a job with no recent names, nothing, whatever is typed",
        `${head({ jobChosen: true, hasRecent: false, typed: "", offered: [] })} | ${head({ jobChosen: true, hasRecent: false, typed: "zz", offered: [] })}`,
        "nothing | nothing"
    );
    check(
        "  before a job is chosen, nothing, whatever is typed",
        `${head({ jobChosen: false, hasRecent: true, typed: "", offered: offered("") })} | ${head({ jobChosen: false, hasRecent: true, typed: "mi", offered: offered("mi") })}`,
        "nothing | nothing"
    );
    check(
        "  the three heads are the design's words",
        [ASSET_TRANSITION_COPY.recentHeading, ASSET_TRANSITION_COPY.matchingHeading, ASSET_TRANSITION_COPY.noMatchHeading].join(" | "),
        "Recently at this job | Matching names | No past names match"
    );

    // ── #589: the space itself ─────────────────────────────────────────────
    log("the list stands in one space of one height under the field, whatever it holds (#589):");
    const sheet = parseFile(NAME_SHEET);
    const { count, space } = listSpace(sheet);
    check("  one space, drawn in every state", `${count} ${space?.conditional}`, "1 false");
    const tokens = String(space?.className ?? "").split(/\s+/);
    check(
        "  its class a literal holding the design's height, giving way and clipping",
        ["h-mobile-name-sheet-list", "min-h-0", "shrink", "overflow-hidden", "flex-col"].map((t) => tokens.includes(t)).join(" "),
        "true true true true true"
    );
    const ds = await loadDesignSystem();
    const rem = (name) => Number.parseFloat(ds.resolveThemeValue(name)) * 16;
    const heightRule = ds.candidatesToCss(["h-mobile-name-sheet-list"])[0] ?? "";
    check("  which Tailwind draws as the name's height", /height: var\(--height-mobile-name-sheet-list\);/.test(heightRule), true);
    const drawn = rem("--height-mobile-name-sheet-list");
    const holds = rem("--text-mobile-heading-sm--line-height") + rem("--spacing-mobile-drawer-heading-stack") + RECENT_NAMES_SHOWN * rem("--height-mobile-drawer-row") + (RECENT_NAMES_SHOWN - 1);
    check("  194, the head's line and its 4 and the recent rows with a rule between each", `${drawn} ${holds}`, "194 194");
    const fieldRow = sheet.source.match(/<div className="([^"]*)">\s*<SheetInput\b/)?.[1] ?? "";
    check("  the field's row never gives way", fieldRow.split(/\s+/).includes("shrink-0"), true);
    check(
        "  the head and the rows are the judgment's, rows only under a head",
        [
            /const head = nameListHead\(\{ jobChosen, hasRecent, typed: value, offered: names \}\);/.test(sheet.source),
            /const rows = head \? names : \[\];/.test(sheet.source),
            /\{head && \(\s*<p className="shrink-0 [^"]*">\s*\{head\}\s*<\/p>\s*\)\}/.test(sheet.source),
        ].join(" "),
        "true true true"
    );
    // Every string `app/` and `lib/` can render, read once for both sweeps below.
    const strings = new Map(listJsFiles(repoPath("app")).concat(listJsFiles(repoPath("lib"))).map((file) => [repoRelative(file), renderedStrings(parseFile(repoRelative(file)))]));
    const saying = (needle) => [...strings].filter(([, said]) => said.some((s) => s.includes(needle))).map(([file]) => file);
    check("  and the sentence a job with none said is said nowhere", `${saying(GONE_SENTENCE).join(" ")}|${"noRecentNames" in ASSET_TRANSITION_COPY}`, "|false");

    // ── #589: a move on the space, as #580 judges one ───────────────────────
    log("a move on the space scrolls its rows once they overflow, and drags the sheet anywhere else (#580):");
    const spaceBox = box({ overflowY: "hidden", scrollHeight: 194, clientHeight: 194 });
    const headBox = box({ parent: spaceBox });
    const longList = box({ overflowY: "auto", scrollHeight: 284, clientHeight: 170, parent: spaceBox });
    const shortList = box({ overflowY: "auto", scrollHeight: 170, clientHeight: 170, parent: spaceBox });
    const shrunkSpace = box({ overflowY: "hidden", scrollHeight: 194, clientHeight: 20 });
    const rowIn = (list) => box({ parent: box({ parent: list }) });
    const judge = (element) => {
        const scrolls = scrollsUnder(element, fakeWindow);
        return `${scrolls ? "scrolls" : "still"}/${dragStarts({ handled: true, laidOut: true, busy: false, behind: false, touches: 1, onField: false, scrolls }) ? "drags" : "stays"}`;
    };
    check(
        "  a row of a list longer than the space, a row of three, the head, a space shrunk under its head",
        [rowIn(longList), rowIn(shortList), headBox, box({ parent: shrunkSpace })].map(judge).join(" "),
        "scrolls/stays still/drags still/drags still/drags"
    );

    // ── #591: the axis's name on screen ────────────────────────────────────
    log("everything a reader sees names the axis `Equipment & Tools` (#591):");
    check("  the heading, the way back and the rail", [ASSET_LIST_COPY.heading, ASSET_COPY.backToTools, NAVIGATION_COPY.sections.assets].join(" | "), "Equipment & Tools | Back to Equipment & Tools | Equipment & Tools");
    check("  and no string under app/ or lib/ says the old name", saying(OLD_NAME).join(" "), "");
    check("  and the new one is spelled in the heading and the way back alone", saying("Equipment & Tools").join(" "), "lib/assetListView.js lib/assetView.js");

    // ANTI-VACUITY: the readers see what they are looking for. A planted sheet whose space stands
    // under a condition and whose class reads a state, a planted screen saying the old name in a
    // literal and in JSX text, and a comment saying it, which is not read.
    const planted = listSpace(
        parseSource(
            'export default function S({ n }) { return <div>{n > 0 && <div data-name-list="" className={n > 3 ? "h-mobile-name-sheet-list" : "h-auto"} />}</div>; }',
            "<planted name sheet>"
        )
    );
    check("  a planted space under a condition, its class a state's, is seen", `${planted.count} ${planted.space?.conditional} ${planted.space?.className}`, "1 true null");
    const plantedScreen = renderedStrings(
        parseSource(`// ${OLD_NAME} in a comment\nconst a = "${OLD_NAME}";\nexport default function P() { return <h1>${OLD_NAME}</h1>; }`, "<planted screen>")
    );
    check("  a planted screen saying the old name is seen twice, its comment not at all", plantedScreen.filter((s) => s.includes(OLD_NAME)).length, 2);
}

if (isMain(import.meta.url)) standalone(title, run);

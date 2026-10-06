// Every stored instant is drawn in the reader's own zone (#374).
//
// WHAT THIS TIER CANNOT SEE IS THE WHOLE POINT OF THE ISSUE. Which zone a time
// actually renders in is a property of the runtime it renders in, so a pinned
// string would pass where it was written and fail in CI — `offline/
// tool-item-view.mjs` recorded exactly that about the options it used to hold.
// Nothing here opens a page either, so the blank before hydration, the warning
// React would emit and the change when a browser's zone changes are all measured
// in a browser and written into the pull request.
//
// WHAT IS STRUCTURAL, AND IT IS ENOUGH TO STOP THE DEFECT COMING BACK. The bug
// was a Server Component calling `toLocaleString`, so what this holds is that no
// such call exists outside the one formatter, and that the formatter is reached
// only from files that run in a browser. Both are read as CALL SITES AND
// ARGUMENTS off the AST rather than as names or counts: this repository has
// measured twice (#351, #353) that an assertion phrased in terms of the constant
// it is checking passes every mutation of that constant.
//
// THE FOUR MUTANTS, run against the tree before this text was written:
//   1. re-inline a `toLocaleString` on any page             -> the inventory fails
//   2. call `formatInstant` from a Server Component          -> the reach fails
//   3. tell the server render it is the browser             -> the paint fails
//   4. make the two resolutions one object                   -> the first assertion fails
//
// The fourth is the anti-vacuity one and is asserted first: two format constants
// that are the same object make every assertion below them true of one
// resolution, and the screen that wanted a day would silently print an hour.

import { join } from "node:path";
import { listJsFiles, parseFile, parseSource, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { DAY_FORMAT, INSTANT_FORMAT, formatInstant, instantParts, instantText, readInstant } from "../../../lib/format.js";

export const title = "Instants render in the reader's own zone (#374)";

const FORMATTER = "lib/format.js";
const COMPONENT = "app/components/Instant.js";
const SPACE = "app/components/Space.js";
const SCAN_ROOTS = ["app", "lib"];

/**
 * What a `Space` renders: its span's classes, the template's own text, and what the span
 * holds, each string child quoted so a space reads as one.
 */
function spaceReading(parsed) {
    let found = "none";
    walk(parsed.ast, (n) => {
        if (found !== "none" || n.type !== "JSXElement" || n.openingElement.name?.name !== "span") return;
        const value = n.openingElement.attributes.find((a) => a.name?.name === "className")?.value;
        const template = value?.type === "JSXExpressionContainer" && value.expression.type === "TemplateLiteral" ? value.expression : null;
        const classes = template ? parsed.source.slice(template.start + 1, template.end - 1) : (value?.value ?? "none");
        const held = n.children.map((c) => {
            if (c.type === "JSXExpressionContainer" && c.expression.type === "Literal") return JSON.stringify(c.expression.value);
            if (c.type === "JSXText") return JSON.stringify(c.value);
            return c.type;
        });
        found = `${classes} | ${held.join(" ")}`;
    });
    return found;
}

/**
 * The one file allowed to resolve an instant outside a browser, and the reason.
 *
 * WHAT EARNS THE EXEMPTION IS CHECKED RATHER THAN TAKEN ON TRUST. A surface with
 * no reader to resolve against must NAME the zone it used — that is the second
 * half of this issue's rule, and the half a list of filenames would not hold. So
 * the assertion is that this file hands the formatter a zone and a zone name,
 * which is the thing that makes its output convertible by whoever reads it. A
 * stale exemption fails too, in `formula-escaping.mjs`'s posture.
 */
const OFF_BROWSER = {
    "lib/poPdf.js": "the order document, whose reader is a vendor and not a browser",
};

/** Every locale-formatting call in a file, as `{ callee, hasOptions }`. */
function localeCalls(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "NewExpression" && n.callee?.object?.name === "Intl") {
            found.push({ callee: `new Intl.${n.callee.property?.name}` });
            return;
        }
        if (n.type !== "CallExpression") return;
        const name = n.callee?.property?.name;
        if (name === "toLocaleString" || name === "toLocaleDateString" || name === "toLocaleTimeString") {
            found.push({ callee: name });
        }
    });
    return found;
}

/** Repo-relative posix paths of every `.js` under the scanned roots. */
function scannedFiles() {
    const root = `${toPosix(REPO_ROOT)}/`;
    return SCAN_ROOTS.flatMap((dir) =>
        listJsFiles(join(REPO_ROOT, dir)).map((abs) => toPosix(abs).slice(root.length))
    );
}

const directivesOf = (ast) =>
    ast.body
        .filter((n) => n.type === "ExpressionStatement" && n.expression?.type === "Literal")
        .map((n) => n.expression.value);

/** Files importing `formatInstant` (or the hook that wraps it), by name. */
function importersOf(names) {
    const found = [];
    for (const rel of scannedFiles()) {
        const { ast } = parseFile(rel);
        let imports = false;
        walk(ast, (n) => {
            if (n.type !== "ImportDeclaration") return;
            for (const s of n.specifiers) {
                if (s.type === "ImportSpecifier" && names.includes(s.imported?.name)) imports = true;
            }
        });
        if (imports) found.push({ rel, client: directivesOf(ast).includes("use client") });
    }
    return found;
}

export function run({ check, log, assert }) {
    // ── the mutant, first ───────────────────────────────────────────────────
    log("the two resolutions are two, and a screen that wants a day gets no hour:");
    assert("  they are not the same object", INSTANT_FORMAT !== DAY_FORMAT);
    check("  the instant carries an hour", "hour" in INSTANT_FORMAT, true);
    check("  the day does not", "hour" in DAY_FORMAT, false);
    check("  and neither carries seconds", "second" in INSTANT_FORMAT || "second" in DAY_FORMAT, false);
    // The five parts `EVENT_AT_FORMAT` and `/prs/[prId]`'s history each wrote out
    // before this issue gathered them. Pinned by value, not by reference to the
    // constant: an assertion over the object it is checking holds for any object.
    // The month and the day are two figures since #463, the design's `09/14/2026`.
    check(
        "  the instant's parts",
        JSON.stringify(INSTANT_FORMAT),
        '{"year":"numeric","month":"2-digit","day":"2-digit","hour":"numeric","minute":"2-digit"}'
    );
    check("  the day's", JSON.stringify(DAY_FORMAT), '{"year":"numeric","month":"2-digit","day":"2-digit"}');

    // ── the design's notation, which a screen draws from parts (#463) ────────
    // Noon UTC, so the day is the same in every zone a runner can be in from UTC-11 to
    // UTC+11 and the figures can be pinned: the zone is the reader's and the notation is
    // the design's, whatever language the runtime speaks.
    log("");
    log("a screen writes the design's notation, in parts, whatever its locale:");
    const noon = "2026-09-04T12:00:00.000Z";
    check("  the date is month, day and year, two figures each but the year", instantParts(noon)?.date.join("/"), "09/04/2026");
    assert("  the time is a twelve-hour clock to the minute", /^\d{1,2}:\d{2} (AM|PM)$/.test(instantParts(noon)?.time ?? ""));
    check("  a day's format carries no time", instantParts(noon, DAY_FORMAT)?.time, null);
    check("  and a sentence takes the same notation as one string", instantText(noon, DAY_FORMAT), "09/04/2026");
    assert("  with the time after a space and no comma", /^09\/04\/2026 \d{1,2}:\d{2} (AM|PM)$/.test(instantText(noon) ?? ""));
    check("  a value that is not an instant has no parts", instantParts("not a date"), null);
    check("  nor any text", instantText(""), null);
    // THE COMPONENT DRAWS THE SLASHES APART, which is the half of the notation a string
    // cannot carry: each is a span reading the design's separator names, so a component
    // printing `instantText` instead would pass every value above and draw them in full.
    const separators = [];
    walk(parseFile(COMPONENT).ast, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== "span") return;
        const cls = n.attributes.find((a) => a.name?.name === "className")?.value?.value ?? "";
        if (/date-separator/.test(cls)) separators.push(cls);
    });
    check("  the component draws each slash in a span of the separator's own", separators.join(" | "), "px-date-separator-inline opacity-date-separator");
    // AND THE TIME AFTER A SPACE THE TEXT HOLDS. Padding set the 9 first, and the text read
    // `10/05/20268:55 AM` — a copy and an assistive reader both — so the 9 is a `Space` of
    // the date-time width, and a `Space` is a real space in a box that keeps it.
    const spaces = [];
    walk(parseFile(COMPONENT).ast, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "Space") spaces.push(n.attributes.find((a) => a.name?.name === "className")?.value?.value ?? "");
    });
    check("  and sets the time after a Space of the date-time width", spaces.join(" | "), "w-date-time-inline max-sm:w-mobile-date-time-inline");
    // INSIDE A SENTENCE THE TIME FOLLOWS A WORD'S SPACE (#495), as the design's final files draw
    // the stale-press sentence's moment: the slashes still dimmed, and no 9 or 8 apart, which
    // is a date and its time standing on their own. Every other caller keeps the Space.
    const componentSource = parseFile(COMPONENT).source;
    check(
        "  but after a word's space when it stands inside a sentence (#495)",
        [
            /export default function Instant\(\{ at, format = INSTANT_FORMAT, sentence = false \}\)/.test(componentSource),
            /\{sentence \? " " : <Space className="w-date-time-inline max-sm:w-mobile-date-time-inline" \/>\}/.test(componentSource),
        ].join(" "),
        "true true"
    );
    check("  a Space being a real space the text keeps, in a box of its caller's width", spaceReading(parseFile(SPACE)), 'inline-block whitespace-pre ${className} | " "');
    // ANTI-VACUITY: the padding this replaced, and a box holding nothing, are read so.
    check(
        "  where an empty box is read as holding nothing",
        spaceReading(parseSource('export default function Space({ className }) {\n    return <span className={`inline-block ${className}`} />;\n}\n', "<planted-space>")),
        "inline-block ${className} | "
    );

    // ── nobody formats a time but the formatter ─────────────────────────────
    log("");
    log("one place builds a locale string, and it takes no exemptions at all:");
    const offenders = [];
    for (const rel of scannedFiles()) {
        if (rel === FORMATTER) continue;
        const calls = localeCalls(parseFile(rel).ast);
        if (calls.length > 0) offenders.push(`${rel} (${calls.map((c) => c.callee).join(", ")})`);
    }
    // THE MUTANT THIS CATCHES is the one the issue is about: a screen writing the
    // options out again and formatting where it renders. Every site did, and any
    // one of them coming back is a failing check rather than a wrong hour nobody
    // sees, since a wrong hour looks exactly like a right one.
    check(
        `  files formatting a time outside ${FORMATTER}${offenders.length ? `: ${offenders.join("; ")}` : ""}`,
        offenders.length,
        0
    );
    // Anti-vacuity for the sweep: the walker has to be seen finding one.
    assert(
        "  the walker does find a locale call where there is one",
        localeCalls(parseFile(FORMATTER).ast).length > 0
    );

    // ── and the formatter is reached only from a browser ────────────────────
    log("");
    log("only a file that runs in a browser resolves an instant against its reader:");
    const readers = importersOf(["formatInstant", "instantParts", "instantText", "useReaderInstant"]);
    assert("  the import walk found readers", readers.length > 0);
    const serverSide = readers.filter((r) => !r.client && !(r.rel in OFF_BROWSER)).map((r) => r.rel);
    // THE DEFECT, STATED AS A CHECK. A Server Component calling this resolves the
    // zone against the render rather than against the reader, which is what every
    // screen did before this issue.
    check(
        `  server-side readers${serverSide.length ? `: ${serverSide.join(", ")}` : ""}`,
        serverSide.length,
        0
    );
    assert(
        `  ${COMPONENT} is a client module`,
        directivesOf(parseFile(COMPONENT).ast).includes("use client")
    );

    log("");
    log("the one surface with no reader names the zone it used:");
    for (const [rel, why] of Object.entries(OFF_BROWSER)) {
        assert(`  ${rel} — ${why}`, readers.some((r) => r.rel === rel && !r.client));
        // READ AS THE ARGUMENT AND NOT AS A NAME. A constant called
        // `DOCUMENT_ZONE` proves nothing about what reaches the formatter; what
        // does is a format object carrying both keys, since a zone with no name
        // beside it renders a converted hour the reader cannot identify.
        const { ast } = parseFile(rel);
        const keys = new Set();
        walk(ast, (n) => {
            if (n.type !== "Property") return;
            const name = n.key?.name ?? n.key?.value;
            if (name === "timeZone" || name === "timeZoneName") keys.add(name);
        });
        assert(`  ${rel} fixes a zone`, keys.has("timeZone"));
        assert(`  ${rel} prints its name beside the time`, keys.has("timeZoneName"));
        // A named zone rather than an offset: daylight saving makes a stored
        // offset right for half the year and wrong in the half nobody checks.
        let zoneValue = null;
        walk(ast, (n) => {
            if (n.type !== "VariableDeclarator") return;
            if (n.id?.name !== "DOCUMENT_ZONE") return;
            zoneValue = n.init?.value ?? null;
        });
        assert(`  ${rel} names a zone rather than an offset`, /^[A-Za-z]+\/[A-Za-z_]+$/.test(zoneValue ?? ""));
    }

    // ── the first paint carries no time, which is the hydration answer ──────
    log("");
    log("nothing is formatted until the render is the browser's:");
    const { ast: component } = parseFile(COMPONENT);
    // READ AS THE ARGUMENTS AND NOT AS A NAME. `useSyncExternalStore` takes a
    // client snapshot and a server snapshot, and which way round they are IS the
    // hydration rule: a server snapshot of `true` formats during the server render
    // and hands React different text to hydrate, which is the defect this issue is
    // about one layer down. A check naming the hook would pass on that.
    let snapshots = null;
    walk(component, (n) => {
        if (n.type !== "CallExpression" || n.callee?.name !== "useSyncExternalStore") return;
        snapshots = n.arguments.map((arg) => arg?.name ?? null);
    });
    assert("  the hydration hook is called with three arguments", snapshots?.length === 3);
    const returnsOf = (name) => {
        let value = null;
        walk(component, (n) => {
            if (n.type !== "VariableDeclarator" || n.id?.name !== name) return;
            if (n.init?.type === "ArrowFunctionExpression") value = n.init.body?.value ?? null;
        });
        return value;
    };
    check("  the client snapshot says this is the browser", returnsOf(snapshots?.[1]), true);
    check("  and the server snapshot says it is not", returnsOf(snapshots?.[2]), false);
    // And the answer has to be what stops the formatting, or the hook is decoration.
    let guarded = false;
    walk(component, (n) => {
        if (n.type !== "IfStatement") return;
        if (n.test?.type !== "UnaryExpression" || n.test.operator !== "!") return;
        guarded = guarded || n.test.argument?.name !== undefined;
    });
    assert("  and nothing is formatted until it says so", guarded);
    // The instant is in the markup either way, so a value the reader cannot see
    // yet is still a value a machine can read.
    let carriesDateTime = false;
    walk(component, (n) => {
        if (n.type === "JSXAttribute" && n.name?.name === "dateTime") carriesDateTime = true;
    });
    assert("  the <time> element carries the stored instant in `dateTime`", carriesDateTime);

    // ── the unreadable value, which every screen inherits ───────────────────
    log("");
    log("a value that is not an instant comes back unchanged, never as Invalid Date:");
    check("  a blank stays blank", formatInstant(""), "");
    check("  a string no parser can read stays itself", formatInstant("not a date"), "not a date");
    check("  a missing value stays missing", formatInstant(undefined), undefined);
    assert("  so no screen ever says Invalid Date", !String(formatInstant("")).includes("Invalid"));
    assert("  and the reader of that rule agrees", readInstant("not a date") === null);
    // Anti-vacuity: it must format the ones it CAN read, or the rule above is the
    // whole behavior.
    assert(
        "  a real instant does render",
        formatInstant("2026-09-14T20:51:25.791Z") !== "2026-09-14T20:51:25.791Z"
    );
}

if (isMain(import.meta.url)) standalone(title, run);

// A serial number is a maker's, set with even figures and never in the portal's id face (0h, #607).
//
// WHY THIS IS A CHECK. #601 set an item's serial number in Fragment Mono, the id's face, on 1a3's
// line, in 1d's column, in 1f's `Details` and its field, and on the phone's line. The files of
// 2026-11-04's afternoon say in 0h that Fragment Mono "carries only the ids the portal gives its
// records; a value from elsewhere, such as a maker's serial number, is set in Instrument Sans", and
// draw each of those with tabular figures. This tier holds:
//
//   1. NO ELEMENT IN THE ID'S FACE HOLDS A SERIAL NUMBER: every element under `app/` whose classes
//      name `font-id` is walked for an expression naming `serialNumber`.
//   2. EACH PLACE ONE IS DRAWN SETS IT WITH EVEN FIGURES: 1a3's line, 1d's column at the row's 14,
//      and the item page's line and field, at both widths, through the detail's face.
//   3. AN ID STAYS IN THE ID'S FACE: the item a serial number taken names, and 1d's printed id.
//
// WHAT IT CANNOT SEE: the face a browser draws. A browser measured each against the files.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A serial number is set with even figures, never in the portal's id face (0h, #607)";

const FOUND = "app/(assets)/asset-categories/FoundItem.js";
const LIST = "app/(assets)/asset-categories/[categoryRecordId]/AssetList.js";
const DETAILS = "app/(assets)/assets/[assetId]/ItemDetails.js";
const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);

/** The classes an element's className spells, as written. */
const classesOf = (opening, source) => {
    const attr = opening.attributes.find((a) => a.name?.name === "className")?.value;
    return attr ? source.slice(attr.start, attr.end) : "";
};

/** Every element in the id's face that holds an expression naming a serial number, by file. */
export function serialsInIdFace(files) {
    const found = [];
    for (const { relPath, ast, source } of files) {
        walk(ast, (n) => {
            if (n.type !== "JSXElement" || !/\bfont-id\b/.test(classesOf(n.openingElement, source))) return;
            let names = false;
            for (const child of n.children) walk(child, (m) => {
                // `serialNumber` alone or off a row: a member's property is an identifier too.
                if (m.type === "Identifier" && m.name === "serialNumber") names = true;
            });
            if (names) found.push(`${relPath}:${source.slice(0, n.start).split("\n").length}`);
        });
    }
    return found;
}

export function run({ check, log }) {
    const files = listJsFiles(repoPath("app")).map((abs) => parseFile(repoRelative(abs)));

    log("no element in the id's face holds a serial number:");
    check("  none, across every file under app/", serialsInIdFace(files).join(" | "), "");

    log("each place one is drawn sets it with even figures:");
    const found = parseFile(FOUND).source;
    const list = parseFile(LIST).source;
    const details = parseFile(DETAILS).source;
    check("  1a3's line, after its name, at the line's 14", /<span className="ml-gap shrink-0 tabular-nums">\{serialNumber\}<\/span>/.test(found), true);
    check(
        "  1d's column, at the row's 14 in Ink 2, cut and shown whole above",
        /<span role="cell" className="min-w-0 text-foreground-muted tabular-nums">\s*<span data-cut="" className="block truncate">\s*\{row\.serialNumber\}/.test(list),
        true
    );
    check(
        "  the item page's serial number, its line and its desk field, through the detail's face",
        [
            /serial: \{[^]*?face: "figures",[^]*?fieldFace: "\[&_input\]:tabular-nums",/.test(details),
            /const VALUE_FACE = \{ figures: "tabular-nums \[overflow-wrap:anywhere\]", text: "text-pretty" \};/.test(details),
            (details.match(/VALUE_FACE\[detail\.face\]/g) ?? []).length,
        ].join(" "),
        "true true 2"
    );

    log("an id stays in the id's face:");
    check(
        "  the item a serial number taken names, and 1d's printed id",
        [/<span className="font-id tracking-id">\{control\.takenBy\}<\/span>/.test(details), /<span role="cell" className="min-w-0 truncate font-id text-body-sm tracking-id">\s*<Link href=\{assetPath\(row\.assetId\)\}/.test(list)].join(" "),
        "true true"
    );

    // Anti-vacuity: a serial number in the id's face, written either way, is seen.
    log("anti-vacuity — this check is seen to be able to fail:");
    const plant = (jsx) => serialsInIdFace([{ ...parseSource(`export function P({ row, serialNumber }) { return ${jsx}; }`, "<planted>"), relPath: "app/planted.js" }]).join(" | ");
    check(
        "  a number in the id's face is seen, by name or off its row, and one in even figures is not",
        [plant('<span className="font-id text-body-sm">{serialNumber}</span>'), plant('<span className="x font-id"><b>{row.serialNumber}</b></span>'), plant('<span className="tabular-nums">{row.serialNumber}</span>')].join(" ; "),
        "app/planted.js:1 ; app/planted.js:1 ; "
    );
}

if (isMain(import.meta.url)) standalone(title, run);

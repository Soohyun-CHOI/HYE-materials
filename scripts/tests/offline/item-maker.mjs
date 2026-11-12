// Wherever an item's size goes, its maker goes too (#629).
//
// WHY A CHECK RATHER THAN A RULE IN A MODULE. A request item's maker is typed beside
// its size and travels every path the size does — into the order and its document,
// the invoice and delivery rows that copy the order, the material that tells items
// apart, the overage request raised from a delivery, the edit turn and its rollback.
// #629 added it to forty-odd places, and none of them is a judgment a module could
// own: each is one more property beside `size` in an object that already carried one.
// So the property that matters is structural — a size that travels without its maker
// is a maker dropped somewhere along the chain, and the screen downstream simply shows
// a blank, which no other check can tell from an item that named no maker.
//
// WHAT IS HELD, in every file under `lib/` and `app/` but the two that use the word for
// something else:
//   1. An object literal or pattern with a `size` key has a `maker` key, and one with
//      a `Size` key — a record write — a `Maker` key.
//   2. A file reading `record.get("Size")` reads `record.get("Maker")` as often.
//   3. An array holding an item's `.size` holds its `.maker` — the subtitle a price
//      screen joins, the fallback key a delivery groups on.
//   4. A screen with a `Size` column head, a `Size` placeholder, the order
//      document's `SIZE` or a JSX expression reading a `.size` has as many for the
//      maker.
//
// WHAT IS LEFT OUT, AND WHY. The assets axis (`lib/asset*`, `lib/airtable/asset*`,
// `app/(assets)/`) has a size and a maker of its own, on a catalog row, and the
// controls under `app/components/` take `size` as a control's size. Neither is an
// item's. What this cannot see is a maker carried under another name, or a value
// right in shape and wrong in content — `maker: row.size` passes the first clause,
// which is why the second compares the reads themselves.
//
// Every count is asserted non-zero and every detector is shown a planted violation,
// so an empty finding cannot be a walk that saw nothing.

import { execFileSync } from "child_process";
import { parseFile, parseSource, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Wherever an item's size goes, its maker goes too (#629)";

/** Not an item's size: the assets axis's catalog and the controls' own size prop. */
const OUT_OF_SCOPE = [/^lib\/(airtable\/)?asset/, /^app\/\(assets\)\//, /^app\/components\//];

function scopedFiles() {
    return execFileSync("git", ["ls-files", "lib", "app"], { cwd: REPO_ROOT, encoding: "utf8" })
        .split("\n")
        .filter((f) => f.endsWith(".js") && !OUT_OF_SCOPE.some((re) => re.test(f)));
}

const keyOf = (p) => p.key?.name ?? p.key?.value;

/** Objects with a size key and no maker key beside it, and how many had a size key at all. */
function objectsMissingMaker(ast) {
    let seen = 0;
    const missing = [];
    walk(ast, (node) => {
        if (node.type !== "ObjectExpression" && node.type !== "ObjectPattern") return;
        const keys = node.properties.filter((p) => p.type === "Property").map(keyOf);
        for (const [size, maker] of [["size", "maker"], ["Size", "Maker"]]) {
            if (!keys.includes(size)) continue;
            seen++;
            if (!keys.includes(maker)) missing.push(`{${keys.join(", ")}}`);
        }
    });
    return { seen, missing };
}

/** `.get("Size")` and `.get("Maker")` calls in one tree. */
function fieldReads(ast) {
    const reads = { Size: 0, Maker: 0 };
    walk(ast, (node) => {
        if (node.type !== "CallExpression" || node.callee?.property?.name !== "get") return;
        const name = node.arguments[0]?.value;
        if (name in reads) reads[name]++;
    });
    return reads;
}

/** Whether a node references a member named `prop` anywhere below it, stopping at a nested array. */
function referencesMember(node, prop) {
    let found = false;
    walk(node, (n) => {
        if (n.type === "MemberExpression" && n.property?.name === prop) found = true;
    });
    return found;
}

/** Arrays holding an element that reads `.size` and none that reads `.maker`, and how many read `.size`. */
function arraysMissingMaker(ast) {
    let seen = 0;
    let missing = 0;
    walk(ast, (node) => {
        if (node.type !== "ArrayExpression") return;
        const elements = node.elements.filter((e) => e && e.type !== "ArrayExpression");
        if (!elements.some((e) => referencesMember(e, "size"))) return;
        seen++;
        if (!elements.some((e) => referencesMember(e, "maker"))) missing++;
    });
    return { seen, missing };
}

/**
 * A screen's size and maker marks: column heads, placeholders, the document's head, and
 * every JSX expression reading one — a table's cell and a field's value — so a head
 * kept with its cell gone is a difference too.
 */
function screenMarks(ast) {
    const marks = { size: 0, maker: 0 };
    walk(ast, (node) => {
        if (node.type === "JSXExpressionContainer" && node.expression) {
            if (referencesMember(node.expression, "size")) marks.size++;
            if (referencesMember(node.expression, "maker")) marks.maker++;
        }
        if (node.type === "JSXText") {
            const text = node.value.trim();
            if (text === "Size" || text === "SIZE") marks.size++;
            if (text === "Maker" || text === "MAKER") marks.maker++;
        }
        if (node.type === "JSXAttribute" && node.name?.name === "placeholder") {
            if (node.value?.value === "Size") marks.size++;
            if (node.value?.value === "Maker") marks.maker++;
        }
    });
    return marks;
}

export function run({ check, assert, log }) {
    const files = scopedFiles();
    assert(`the scope holds files (${files.length})`, files.length > 100);

    let objectsSeen = 0;
    let readsSeen = 0;
    let arraysSeen = 0;
    let marksSeen = 0;
    const objectFaults = [];
    const readFaults = [];
    const arrayFaults = [];
    const markFaults = [];

    for (const file of files) {
        const { ast } = parseFile(file);
        const objects = objectsMissingMaker(ast);
        objectsSeen += objects.seen;
        for (const shape of objects.missing) objectFaults.push(`${file} ${shape}`);

        const reads = fieldReads(ast);
        readsSeen += reads.Size;
        if (reads.Size !== reads.Maker) readFaults.push(`${file} (Size ${reads.Size}, Maker ${reads.Maker})`);

        const arrays = arraysMissingMaker(ast);
        arraysSeen += arrays.seen;
        if (arrays.missing) arrayFaults.push(`${file} (${arrays.missing})`);

        const marks = screenMarks(ast);
        marksSeen += marks.size;
        if (marks.size !== marks.maker) markFaults.push(`${file} (size ${marks.size}, maker ${marks.maker})`);
    }

    log("1. an object carrying a size carries a maker:");
    assert(`  objects with a size key were found (${objectsSeen})`, objectsSeen > 50);
    check("  objects with a size and no maker", objectFaults.join("; ") || "none", "none");
    check(
        "  and the detector finds a planted one",
        objectsMissingMaker(parseSource(`const r = { itemName: a, size: b, unit: c };`, "<planted>").ast).missing.length,
        1
    );
    check(
        "  a record write too",
        objectsMissingMaker(parseSource(`base(T).create({ Size: s, Unit: u });`, "<planted>").ast).missing.length,
        1
    );

    log("");
    log("2. a file reading a row's Size reads its Maker as often:");
    // Seven: one mapper per item table but `PO Items`, which has three projections,
    // and `Materials`' one.
    assert(`  reads of Size were found (${readsSeen})`, readsSeen >= 7);
    check("  files reading one more than the other", readFaults.join("; ") || "none", "none");
    check(
        "  and the counter tells them apart",
        JSON.stringify(fieldReads(parseSource(`x = { size: r.get("Size"), maker: r.get("Size") };`, "<planted>").ast)),
        JSON.stringify({ Size: 2, Maker: 0 })
    );

    log("");
    log("3. an array holding an item's size holds its maker:");
    assert(`  arrays reading a size were found (${arraysSeen})`, arraysSeen > 0);
    check("  arrays with a size and no maker", arrayFaults.join("; ") || "none", "none");
    check(
        "  and the detector finds a planted one",
        arraysMissingMaker(parseSource(`const s = [m.size, m.unit].filter(Boolean).join(" · ");`, "<planted>").ast).missing,
        1
    );

    log("");
    log("4. a screen showing a size shows a maker as often:");
    assert(`  size marks were found (${marksSeen})`, marksSeen >= 6);
    check("  screens with more size marks than maker marks", markFaults.join("; ") || "none", "none");
    check(
        "  and the counter sees a column head, a placeholder and a cell",
        JSON.stringify(screenMarks(parseSource(`x = <><th>Size</th><input placeholder="Size" /><td>{it.size}</td></>;`, "<planted>").ast)),
        JSON.stringify({ size: 3, maker: 0 })
    );
}

if (isMain(import.meta.url)) standalone(title, run);

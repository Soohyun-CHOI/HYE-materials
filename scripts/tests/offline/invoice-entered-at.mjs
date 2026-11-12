// An invoice records when it was entered, and its page says so beside who (#623).
//
// THE QUIET MUTANT IS A WRITE THAT IS NOT THERE. `Invoices."Created At"` is written by
// `createInvoice` alone. Take that line out and every screen still renders — the detail
// draws the name alone, as it does for a row made by hand in Airtable — and nothing in
// this tier, the build or the linter notices, while every invoice entered from then on
// carries no day. So the write is asserted on the function, as a property whose value is
// the moment the function runs, and the edit path is asserted to hold no route to it:
// who typed an invoice in and when do not change when somebody corrects a figure.
//
// THE SECOND IS THE LINE DRAWING ANOTHER MOMENT OR ANOTHER SENTENCE. The design writes
// `Recorded by {name} · {day}`: no colon, a dot the reader's assistive technology skips,
// and the day alone. `Instant` draws a date AND a time unless it is handed `DAY_FORMAT`,
// so a line that drops the format still renders, a little longer, and says a precision
// the design did not ask for. Both halves are read off the page's JSX.
//
// WHAT THIS CANNOT SEE: whether the base holds the field. A run of the app against a base
// without it refuses the create (`UNKNOWN_FIELD_NAME`), loudly, and the order in which the
// live base takes the field is in `docs/notes/deliveries-and-invoices.md`.

import { parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An invoice records when it was entered, shown beside who (#623)";

const SERVICE = "lib/airtable/invoices.js";
const DETAIL = "app/invoices/[invoiceId]/page.js";

const keyName = (property) => (property.key?.type === "Literal" ? property.key.value : property.key?.name);

/** The property keyed `name` anywhere in a function, or null. */
function propertyNamed(fn, name) {
    let found = null;
    walk(fn, (n) => {
        if (!found && n.type === "Property" && keyName(n) === name) found = n;
    });
    return found;
}

/** Whether a function writes the field at all: a property keyed by it, or `fields["X"] = …`. */
function writes(fn, field) {
    if (propertyNamed(fn, field)) return true;
    let found = false;
    walk(fn, (n) => {
        if (found || n.type !== "AssignmentExpression") return;
        const t = n.left;
        if (t?.type === "MemberExpression" && t.computed && t.property?.type === "Literal" && t.property.value === field) found = true;
    });
    return found;
}

/** `new Date().toISOString()` — the moment the call runs, and nothing a caller handed in. */
function isTheMoment(node) {
    return (
        node?.type === "CallExpression" &&
        node.arguments.length === 0 &&
        node.callee?.type === "MemberExpression" &&
        node.callee.property?.name === "toISOString" &&
        node.callee.object?.type === "NewExpression" &&
        node.callee.object.callee?.name === "Date" &&
        node.callee.object.arguments.length === 0
    );
}

/** The names a function's destructured parameter object binds. */
function paramNames(fn) {
    const names = [];
    for (const param of fn?.params ?? []) {
        walk(param, (n) => {
            if (n.type === "Property" && n.value?.type === "Identifier") names.push(n.value.name);
        });
    }
    return names;
}

/** The mapper key that reads `record.get(field)`, or null. */
function keyReading(mapper, field) {
    let key = null;
    walk(mapper, (n) => {
        if (key || n.type !== "Property") return;
        let reads = false;
        walk(n.value, (m) => {
            if (
                m.type === "CallExpression" &&
                m.callee?.property?.name === "get" &&
                m.arguments[0]?.type === "Literal" &&
                m.arguments[0].value === field
            ) {
                reads = true;
            }
        });
        if (reads) key = keyName(n);
    });
    return key;
}

const elementName = (el) => el.openingElement?.name?.name;
const attribute = (el, name) => el.openingElement?.attributes?.find((a) => a.name?.name === name) ?? null;
const source = (expr) =>
    expr?.type === "MemberExpression" ? `${source(expr.object)}.${expr.property?.name}` : expr?.type === "Identifier" ? expr.name : null;

/**
 * What a `Recorded by` line draws: its opening words, the moment its `Instant` is handed
 * and in which format, and whether a dot hidden from assistive technology stands between.
 * `null` when the tree holds no paragraph opening with the words.
 */
function recordedLine(ast) {
    let line = null;
    walk(ast, (n) => {
        if (line || n.type !== "JSXElement" || elementName(n) !== "p") return;
        const first = n.children.find((c) => c.type === "JSXText" && c.value.trim() !== "");
        if (!first || !first.value.trim().startsWith("Recorded by")) return;
        let instant = null;
        let dot = false;
        walk(n, (m) => {
            if (m.type !== "JSXElement") return;
            if (elementName(m) === "Instant") instant = m;
            const hidden = attribute(m, "aria-hidden");
            if (elementName(m) === "span" && hidden?.value?.value === "true" && m.children.some((c) => c.type === "JSXText" && c.value.trim() === "·")) {
                dot = true;
            }
        });
        line = {
            opening: first.value.trim(),
            at: source(attribute(instant ?? {}, "at")?.value?.expression),
            format: source(attribute(instant ?? {}, "format")?.value?.expression),
            dot,
        };
    });
    return line;
}

export function run({ check, assert, log }) {
    const service = parseFile(SERVICE).ast;
    const create = resolveFunction(service, "createInvoice");
    const update = resolveFunction(service, "updateInvoice");
    const mapper = resolveFunction(service, "recordToInvoice");

    log("the service layer writes the moment once and reads it back:");
    assert("createInvoice, updateInvoice and recordToInvoice resolve", Boolean(create && update && mapper));
    const write = propertyNamed(create, "Created At");
    assert("createInvoice writes Created At", Boolean(write));
    assert("  as the moment it runs, not a value a caller hands it", isTheMoment(write?.value));
    assert("updateInvoice writes no Created At", !writes(update, "Created At"));
    assert("  and takes no parameter for it", !paramNames(update).some((n) => /created/i.test(n)));
    // Anti-vacuity for the two above: the edit path's own parameters ARE read, and it
    // does write a field this way, so "absent" is a finding rather than a blind walk.
    assert("  while the walk reads its parameters", paramNames(update).includes("paidDate"));
    assert("  and sees the fields it does write", writes(update, "Paid Date"));
    check("recordToInvoice reads Created At as createdAt", keyReading(mapper, "Created At"), "createdAt");

    log("");
    log("the invoice page draws it in the design's words, the day alone:");
    const line = recordedLine(parseFile(DETAIL).ast);
    assert("the page has a Recorded by line", Boolean(line));
    check("  opening with the design's words, with no colon", line?.opening.replace(/\s+/g, " ").split(" ").slice(0, 2).join(" "), "Recorded by");
    assert("  and never the delivery's colon", !line?.opening.includes(":"));
    check("  the moment it draws is the invoice's own", line?.at, "invoice.createdAt");
    check("  in the day's format, so no time is drawn", line?.format, "DAY_FORMAT");
    assert("  with a dot between that assistive technology skips", line?.dot === true);

    log("");
    log("and the reading can tell a wrong line from a right one:");
    const planted = (body) => recordedLine(parseSource(`const x = <div>${body}</div>;`, "planted.js").ast);
    const right = planted('<p>Recorded by {n}<span aria-hidden="true">·</span><Instant at={invoice.createdAt} format={DAY_FORMAT} /></p>');
    assert("  a right line reads right", right?.format === "DAY_FORMAT" && right?.dot && right?.at === "invoice.createdAt");
    check("  a line handing Instant no format reads none", planted("<p>Recorded by {n} <Instant at={invoice.createdAt} /></p>")?.format, null);
    assert("  a line keeping the colon reads it", planted("<p>Recorded by: {n}</p>")?.opening.includes(":"));
    check("  a line with no paragraph reads nothing", planted("<span>Recorded by: {n}</span>"), null);
}

if (isMain(import.meta.url)) standalone(title, run);

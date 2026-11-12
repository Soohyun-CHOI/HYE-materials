// The list-table width budget has one source (#183).
//
// WHAT THIS HOLDS AND WHAT IT CANNOT. The issue's own test — "a reader can find
// out why the number is what it is without grepping for other occurrences of it"
// — is a claim about a person reading, and no check reaches it. What a check can
// reach is the state that made the test fail: the same figure hand-written at
// five call sites, with the subtraction behind it spelled out twice and cited by
// number nine more times. So this asserts that the class is spelled ONCE, that
// the figure in it is what the page shell actually leaves, and that every screen
// carrying it really is on that shell.
//
// THE SHELL IS THE BOX A SCREEN THE DESIGN HAS NOT DRAWN STANDS IN SINCE #258:
// `app/components/UndrawnPage.js`' `list` measure, which a list's page names where it
// spelled the classes itself until then. So a carrier's page is held to naming that
// measure, and the measure to carrying both classes.
//
// THE THIRD CLAUSE IS THE ONE THAT CATCHES SOMETHING NOBODY WAS ASKING. 52rem is
// `max-w-4xl` minus `p-8` and means nothing on a page built any other way, and
// before this there was no mechanism at all — a `max-w-2xl` page importing the
// shared class would render a table with a min-width half again its container and
// scroll for a reason no comment in the tree explains. `/deliveries/[deliveryId]`
// is the live near-miss: `max-w-3xl`, its own `min-w-[32rem]`, correct, and one
// careless import away from looking like a stale copy of this one.
//
// THE ARITHMETIC IS CHECKED FROM LITERALS, WHICH IS #351's RULE RATHER THAN A
// STYLE. `verification.md` records a check whose every quiet-zone assertion was
// written against the constant it was checking, so mutating the constant moved
// all four together and 47 assertions passed. The same shape here would be to
// compute the budget from `LIST_TABLE_CLASS` and compare it against
// `LIST_TABLE_CLASS`. So Tailwind's published values are typed out below as
// numbers, the class is PARSED for the figure it declares, and the two are
// required to agree — a second path, because one side is Tailwind's scale and the
// other is a string in this repository.
//
// WHAT IT STILL CANNOT SEE, and the list is the usual one for this tier. Whether
// Tailwind's scanner actually emitted a `min-w-[52rem]` rule: that is a build
// output, checked with `npm run build` and recorded in the pull request, and it
// is the failure mode that would change behavior silently. Whether any column
// fits its content, whether a row wraps, whether the sum of a `colgroup` is
// sensible — this tier never renders. And the per-table sums are deliberately not
// asserted: `/pos` declares 58.25rem and scrolls on purpose, so an equality here
// would be false for a table that is correct.

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { LIST_TABLE_CLASS } from "../../../app/components/listTableWidth.js";
import { REPO_ROOT, listJsFiles, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The list-table width budget has one source";

const OWNER = "app/components/listTableWidth.js";
const EXPORT_NAME = "LIST_TABLE_CLASS";
const SCANNED_DIRS = ["app", "lib"];

/**
 * The arbitrary-value class this is all about.
 *
 * NARROWED TO THE OWNER'S OWN FIGURE, which the first version of this file was
 * not — it matched every arbitrary min-width value and reported
 * `/deliveries/[deliveryId]` as a duplicate. That page is `max-w-3xl` and declares
 * its own `min-w-[32rem]`, a DIFFERENT
 * budget that is correct and must not be folded into this one; the assertion below
 * pins it, so the narrowing reads as a decision rather than as a regex that
 * happened to stop matching.
 *
 * Deriving the needle from the constant is not the single-path trap the header
 * warns about: the claim here is "nobody else writes THIS class", whose subject is
 * definitionally the owner's, and a wrong figure in the owner is what the
 * arithmetic clause catches instead.
 */
const MIN_WIDTH_RE = /min-w-\[(\d+(?:\.\d+)?)rem\]/;
const OWNER_TOKEN = (MIN_WIDTH_RE.exec(LIST_TABLE_CLASS) ?? [])[0] ?? "";

/**
 * Tailwind's own published values for the two classes the shell is built from,
 * as NUMBERS typed here rather than derived from anything in this repository.
 * This is the second path; see the header.
 */
const TAILWIND_REM = { "max-w-4xl": 56, "p-8": 2 };
const PX_PER_REM = 16;

/** Every `.js` under app/ + lib/, repo-relative and POSIX-separated. */
function scannedFiles() {
    const root = toPosix(REPO_ROOT);
    return SCANNED_DIRS.flatMap((dir) =>
        listJsFiles(repoPath(dir)).map((abs) => toPosix(abs).slice(root.length + 1))
    );
}

/**
 * Does this AST carry the class token inside a STRING the program evaluates?
 *
 * On the AST rather than on the file's text, and that is load-bearing here: five
 * of the files this walks discuss `min-w-[52rem]` in a comment, correctly, and a
 * text match would report every one of them as a duplicate. Literals, template
 * chunks and JSX attribute values are the three shapes a class name reaches the
 * browser through.
 */
function classTokenInCode(ast) {
    let found = false;
    walk(ast, (n) => {
        if (found) return;
        if (n.type === "Literal" && typeof n.value === "string" && n.value.includes(OWNER_TOKEN)) found = true;
        if (n.type === "TemplateElement" && String(n.value?.raw ?? "").includes(OWNER_TOKEN)) found = true;
    });
    return found;
}

/** Does this file import `EXPORT_NAME` from the owner module? */
function importsTheClass(ast) {
    return ast.body.some(
        (n) =>
            n.type === "ImportDeclaration" &&
            /(^|\/)listTableWidth(\.js)?$/.test(String(n.source.value)) &&
            n.specifiers.some((s) => (s.imported?.name ?? s.local?.name) === EXPORT_NAME)
    );
}

/**
 * The page whose shell decides an importer's width.
 *
 * A `page.js` answers for itself; anything else is a component the page in its own
 * directory renders, which is true of both list clients. A file that resolves to no
 * page is REPORTED rather than skipped — a skip is how a sixth screen would join
 * this class without its shell ever being asked about.
 */
function shellPageFor(relPath) {
    if (relPath.endsWith("/page.js")) return relPath;
    const dir = relPath.slice(0, relPath.lastIndexOf("/"));
    const sibling = `${dir}/page.js`;
    return existsSync(repoPath(sibling)) ? sibling : null;
}

/**
 * The box a page the design has not drawn stands in, and the one measure of it a list's page
 * is (#258). Until then each list page spelled its own `mx-auto w-full max-w-4xl p-8`; the
 * classes are the box's `list` measure since, and a page names the measure.
 */
const BOX = "app/components/UndrawnPage.js";
const LIST_MEASURE = "list";

/** Does a string carry BOTH shell classes? */
const carriesShell = (s) => {
    const classes = String(s ?? "").split(/\s+/);
    return classes.includes("max-w-4xl") && classes.includes("p-8");
};

/** The classes one of the box's measures carries, read off its source. */
function measureOf(ast, kind) {
    let found = null;
    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator" || n.id?.name !== "MEASURES" || n.init?.type !== "ObjectExpression") return;
        const prop = n.init.properties.find((p) => (p.key.name ?? p.key.value) === kind);
        if (prop?.value?.type === "Literal") found = prop.value.value;
    });
    return found;
}

/** Does this page stand in the box's `list` measure? */
function hasShell(ast) {
    let local = null;
    walk(ast, (n) => {
        if (n.type === "ImportDeclaration" && /(^|\/)UndrawnPage(\.js)?$/.test(String(n.source.value)))
            local = n.specifiers.find((s) => s.type === "ImportDefaultSpecifier")?.local.name ?? null;
    });
    let found = false;
    walk(ast, (n) => {
        if (found || !local || n.type !== "JSXElement" || n.openingElement.name?.name !== local) return;
        const measure = n.openingElement.attributes.find((a) => a.name?.name === "measure")?.value;
        if (measure?.type === "Literal" && measure.value === LIST_MEASURE) found = true;
    });
    return found;
}

export async function run({ check, log, assert }) {
    const files = scannedFiles();

    // ── anti-vacuity first ───────────────────────────────────────────────────
    // Every assertion below is "no X" or "these two agree", and an empty walk
    // satisfies both. So the walk is seen to reach the tree and each detector is
    // seen to say YES where the answer is known, before any absence is claimed.
    log("the walk reaches the tree and every detector can say yes:");
    assert(`walked ${files.length} files under ${SCANNED_DIRS.join(" + ")}`, files.length > 100);
    assert(`${OWNER} is in the walk`, files.includes(OWNER));
    assert(`${EXPORT_NAME} declares a min-width, so the needle is not empty`, OWNER_TOKEN !== "");

    const planted = parseSource(`const t = <table className="w-full ${OWNER_TOKEN} table-fixed" />;`, "<planted>");
    assert("  the class detector finds a planted literal", classTokenInCode(planted.ast));
    assert(
        "  and does not fire on a file that only discusses it",
        !classTokenInCode(parseSource(`// ${OWNER_TOKEN} is the budget\nconst x = 1;`, "<comment>").ast)
    );
    // The live near-miss, pinned rather than left to the regex: a table on a
    // different shell declaring its own figure is not a copy of this one.
    assert(
        "  and not on a different budget on a different shell",
        !classTokenInCode(parseSource(`const t = <table className="w-full min-w-[32rem] table-fixed" />;`, "<other>").ast)
    );
    const boxImport = `import Box from "@/app/components/UndrawnPage";\n`;
    const plantedShell = parseSource(`${boxImport}const s = <Box measure="list" />;`, "<shell>");
    assert("  the shell detector finds a page standing in the list box", hasShell(plantedShell.ast));
    assert(
        "  and refuses one standing in a narrower box",
        !hasShell(parseSource(`${boxImport}const s = <Box measure="document" />;`, "<narrow>").ast)
    );
    assert("  and the classes detector finds both classes", carriesShell("mx-auto w-full max-w-4xl p-8") && !carriesShell("mx-auto w-full max-w-2xl p-8"));

    // ── the class is spelled once ────────────────────────────────────────────
    log("");
    log("the class is spelled in exactly one file:");
    const spellers = files.filter((rel) => classTokenInCode(parseFile(rel).ast));
    for (const rel of spellers) log(`  ${rel}`);
    check("the owner spells it", spellers.includes(OWNER), true);
    const strays = spellers.filter((rel) => rel !== OWNER);
    check(
        `no file outside ${OWNER} writes the class by hand`,
        strays.length === 0 ? "none" : strays.join(", "),
        "none"
    );

    // ── the figure is what the shell leaves ──────────────────────────────────
    log("");
    log("the declared figure is what the page shell actually leaves:");
    const declaredRem = Number(MIN_WIDTH_RE.exec(LIST_TABLE_CLASS)[1]);
    const shellRem = TAILWIND_REM["max-w-4xl"] - 2 * TAILWIND_REM["p-8"];
    log(`  max-w-4xl ${TAILWIND_REM["max-w-4xl"]}rem − p-8 ×2 ${2 * TAILWIND_REM["p-8"]}rem = ${shellRem}rem`);
    check("the class declares what the shell leaves", declaredRem, shellRem);
    check("and that is the px figure every measurement was taken at", shellRem * PX_PER_REM, 832);
    // The mutation this pair is here to fail: a shell class changed without the
    // budget, or a budget changed without the shell. Shown on a known input so the
    // equality above is not the only evidence that it CAN disagree.
    assert("  a wider shell would not satisfy it", 57 - 2 * TAILWIND_REM["p-8"] !== declaredRem);

    // ── every carrier is on that shell ───────────────────────────────────────
    log("");
    log("every screen carrying the class is on that shell:");
    const listClasses = measureOf(parseFile(BOX).ast, LIST_MEASURE);
    log(`  the box's ${LIST_MEASURE} measure: ${listClasses}`);
    check("  the box's list measure carries max-w-4xl + p-8", carriesShell(listClasses), true);
    const carriers = files.filter((rel) => importsTheClass(parseFile(rel).ast));
    assert(`${carriers.length} files import ${EXPORT_NAME}`, carriers.length > 0);
    const unshelled = [];
    for (const rel of carriers) {
        const page = shellPageFor(rel);
        if (!page) {
            unshelled.push(`${rel} (no page.js resolves for it)`);
            continue;
        }
        const ok = hasShell(parseFile(page).ast);
        log(`  ${rel} → ${page} ${ok ? "max-w-4xl + p-8" : "SHELL DOES NOT MATCH"}`);
        if (!ok) unshelled.push(`${rel} via ${page}`);
    }
    check(
        "no carrier on a shell other than max-w-4xl + p-8",
        unshelled.length === 0 ? "none" : unshelled.join(", "),
        "none"
    );

    // ── the owner says where the figure came from ────────────────────────────
    log("");
    log("the owner answers the question the call sites no longer do:");
    const ownerSource = readFileSync(repoPath(OWNER), "utf8");
    // Not a prose check: these two tokens are the derivation, and a module that
    // drops them leaves the constant as bare as the five literals it replaced.
    for (const token of ["max-w-4xl", "p-8", "832px"]) {
        check(`  the header names ${token}`, ownerSource.includes(token), true);
    }
}

if (isMain(import.meta.url)) await standalone(title, run);

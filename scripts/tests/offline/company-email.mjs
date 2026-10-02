// The company's address, as the sign-in's email field takes it — one judgment, on the
// screen and on the server, with the domain from one place (#473).
//
// THREE CLAIMS.
//   1. THE JUDGMENT, BY VALUE: what the field keeps of a typed, pasted or filled-in
//      value, when it holds an address at another domain, the address that leaves it,
//      and what the server admits. Typed out here, cases a reader would try first.
//   2. ONE DOMAIN, READ ONCE. `lib/auth.js` reads `ALLOWED_EMAIL_DOMAIN` and asks
//      `isCompanyAddress` of every request with it; `app/login/page.js` hands the same
//      value to the form, and the form asks the field's three questions and words its
//      refusal with the `domain` it is handed. Nothing else under `app/` or `lib/` reads
//      the variable.
//   3. NO DOMAIN IS WRITTEN INTO THE APP. The screen shows the value the server judges
//      against, so the domain this environment holds appears in no file under `app/` or
//      `lib/`, comments included, and no sign-in file holds a string shaped like a
//      domain of its own.
//
// WHAT IT CANNOT SEE: the domain a deployment actually holds — this tier has no
// environment, so claim 3 names the one this base's addresses are at today — and
// whether the field the browser draws shows the suffix the form was handed. That is a
// browser's, and the pull request has it.

import { readFileSync } from "node:fs";
import { COMPANY_EMAIL_COPY, companyAddress, emailFieldValue, isCompanyAddress, namesAnotherDomain } from "../../../lib/companyEmail.js";
import { callsTo, listJsFiles, parseFile, parseSource, repoPath, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { relative } from "node:path";

export const title = "The company's address — one judgment, one domain, on the screen and the server (#473)";

/** The domain the base's addresses are at today, which no file under `app/` or `lib/` may spell. */
const DOMAIN = "hanyangengusa.com";

const AUTH = "lib/auth.js";
const PAGE = "app/login/page.js";
const FORM = "app/login/LoginForm.js";

/** Every string literal and template chunk in a module — never a comment. */
function stringsOf(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        else if (n.type === "TemplateElement") out.push(n.value.cooked ?? n.value.raw);
    });
    return out;
}

/** A string that names a domain of its own: an `@` and then a dotted name. */
const SPELLED_DOMAIN = /@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;

/** Every read of `process.env.ALLOWED_EMAIL_DOMAIN` in a module. */
function envReads(ast) {
    let reads = 0;
    walk(ast, (n) => {
        if (
            n.type === "MemberExpression" &&
            n.property?.name === "ALLOWED_EMAIL_DOMAIN" &&
            n.object?.type === "MemberExpression" &&
            n.object.object?.name === "process" &&
            n.object.property?.name === "env"
        )
            reads += 1;
    });
    return reads;
}

/** The JSX attribute `name` on the first element `tag` in a module, as its expression. */
function attributeOn(ast, tag, name) {
    let found;
    walk(ast, (n) => {
        if (found !== undefined || n.type !== "JSXOpeningElement" || n.name?.name !== tag) return;
        const attribute = n.attributes.find((a) => a.name?.name === name);
        found = attribute?.value?.expression ?? null;
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── 1: the judgment, by value ───────────────────────────────────────────
    log("what the field keeps of what arrives in it:");
    check("  a part before the domain stays as typed", emailFieldValue("minjae.seo", DOMAIN), "minjae.seo");
    check("  a company address loses its domain", emailFieldValue(`minjae.seo@${DOMAIN}`, DOMAIN), "minjae.seo");
    check("  whatever its case", emailFieldValue("Minjae.Seo@HanyangEngUSA.com", DOMAIN), "Minjae.Seo");
    check("  and the spaces a paste brings", emailFieldValue(`  soo+code471@${DOMAIN} \n`, DOMAIN), "soo+code471");
    check("  an address at another domain stays whole", emailFieldValue("minjae.seo@gmail.com", DOMAIN), "minjae.seo@gmail.com");
    check("  and so does a domain that only ends the same way", emailFieldValue(`soo@not${DOMAIN}`, DOMAIN), `soo@not${DOMAIN}`);
    check("  half a domain is still typing", emailFieldValue("soo@hanyang", DOMAIN), "soo@hanyang");
    check("whether the fixed domain steps aside", [namesAnotherDomain("soo"), namesAnotherDomain("soo@gmail.com")].join(" "), "false true");

    log("");
    log("the address that leaves the field, and what refuses it:");
    check("  a part before the domain", companyAddress("minjae.seo", DOMAIN), `minjae.seo@${DOMAIN}`);
    check("  with a subaddress", companyAddress("soo+code471", DOMAIN), `soo+code471@${DOMAIN}`);
    check("  with a hyphen and an underscore", companyAddress("a-b_c", DOMAIN), `a-b_c@${DOMAIN}`);
    check("  the spaces around it dropped", companyAddress("  soo ", DOMAIN), `soo@${DOMAIN}`);
    for (const [label, value] of [
        ["nothing", ""],
        ["only spaces", "   "],
        ["a space inside", "minjae seo"],
        ["an address at another domain", "minjae.seo@gmail.com"],
        ["a comma", "soo,choi"],
    ]) {
        check(`  refused: ${label}`, companyAddress(value, DOMAIN), null);
    }

    log("");
    log("what the server admits — the same question, asked of the whole address:");
    check("  a company address", isCompanyAddress(`soo@${DOMAIN}`, DOMAIN), true);
    check("  whatever the domain's case", isCompanyAddress("soo@HanyangEngUSA.com", DOMAIN), true);
    check("  an address at another domain", isCompanyAddress("soo@gmail.com", DOMAIN), false);
    check("  the domain and nothing before it", isCompanyAddress(`@${DOMAIN}`, DOMAIN), false);
    check("  a part before it the field refuses", isCompanyAddress(`a b@${DOMAIN}`, DOMAIN), false);
    check("  a domain that only ends the same way", isCompanyAddress(`soo@not${DOMAIN}`, DOMAIN), false);
    check("  a value with no @ at all", isCompanyAddress(`soonot${DOMAIN}`, DOMAIN), false);
    check("  something that is not a string", isCompanyAddress(undefined, DOMAIN), false);
    // ONE QUESTION ON BOTH SIDES: whatever the field lets leave, the server admits.
    for (const typed of ["minjae.seo", "soo+code471", "a-b_c"]) {
        check(`  the field's ${typed} is the server's company address`, isCompanyAddress(companyAddress(typed, DOMAIN), DOMAIN), true);
    }

    log("");
    log("the field's one refusal names the domain it is handed:");
    check("  at the domain the briefs show", COMPANY_EMAIL_COPY.otherDomain(DOMAIN), `Use your @${DOMAIN} address.`);
    check("  and at any other", COMPANY_EMAIL_COPY.otherDomain("example.org"), "Use your @example.org address.");

    // ── 2: one domain, read once ────────────────────────────────────────────
    log("");
    log("one domain, read once and handed on:");
    const auth = parseFile(AUTH);
    check(`  ${AUTH} reads the variable`, envReads(auth.ast) > 0, true);
    assert("  and exports what it read", /export const ALLOWED_EMAIL_DOMAIN = process\.env\.ALLOWED_EMAIL_DOMAIN/.test(auth.source));
    const asked = callsTo(auth.ast, "isCompanyAddress");
    check("  every request is asked isCompanyAddress", asked.length, 1);
    check("  with that domain", asked[0]?.arguments[1]?.name, "ALLOWED_EMAIL_DOMAIN");
    const appAndLib = ["app", "lib"].flatMap((d) => listJsFiles(repoPath(d))).map((abs) => toPosix(relative(REPO_ROOT, abs)));
    const readers = appAndLib.filter((rel) => envReads(parseFile(rel).ast) > 0);
    check("  and no other file reads the variable", readers.join(" "), AUTH);

    const page = parseFile(PAGE);
    const handed = attributeOn(page.ast, "LoginForm", "domain");
    check(`  ${PAGE} hands the form that value`, handed?.name, "ALLOWED_EMAIL_DOMAIN");
    assert("  imported from the module that read it", /import \{ ALLOWED_EMAIL_DOMAIN \} from "@\/lib\/auth"/.test(page.source));

    const form = parseFile(FORM);
    for (const question of ["emailFieldValue", "companyAddress", "otherDomain"]) {
        const calls = callsTo(form.ast, question);
        assert(`  ${FORM} asks ${question}`, calls.length > 0);
        check(
            `    with the domain it is handed, every time`,
            calls.filter((call) => call.arguments.at(-1)?.name !== "domain").length,
            0
        );
    }
    assert(`  and asks namesAnotherDomain of the field`, callsTo(form.ast, "namesAnotherDomain").length > 0);

    // ── 3: no domain is written into the app ────────────────────────────────
    log("");
    log("no domain is written into the app:");
    const spelling = appAndLib.filter((rel) => readFileSync(repoPath(rel), "utf8").toLowerCase().includes(DOMAIN));
    check(`  no file under app/ or lib/ spells ${DOMAIN}, comments included`, spelling.join(" "), "");
    const signIn = appAndLib.filter((rel) => rel.startsWith("app/login/") || rel === "lib/companyEmail.js");
    assert(`  read across the ${signIn.length} sign-in files`, signIn.length >= 8);
    const ownDomains = signIn.filter((rel) => stringsOf(parseFile(rel).ast).some((s) => SPELLED_DOMAIN.test(s)));
    check("  and no sign-in file holds a string naming a domain of its own", ownDomains.join(" "), "");

    // ── the detectors, seen finding a planted case ──────────────────────────
    log("");
    log("and the detectors are seen finding what they look for:");
    const planted = parseSource('const SUFFIX = "@acme.example"; const domain = process.env.ALLOWED_EMAIL_DOMAIN;', "<planted>");
    assert("  a string naming a domain is found", stringsOf(planted.ast).some((s) => SPELLED_DOMAIN.test(s)));
    check("  and a read of the variable", envReads(planted.ast), 1);
    const plantedForm = parseSource('export const F = () => <LoginForm domain={"acme.example"} />;', "<planted-form>");
    check("  a form handed a literal is not handed the value", attributeOn(plantedForm.ast, "LoginForm", "domain")?.name, undefined);
}

if (isMain(import.meta.url)) standalone(title, run);

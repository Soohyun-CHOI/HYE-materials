// The US-English rule, executable (#215).
//
// CLAUDE.md's Git workflow rules say this repository writes US English, in code
// comments as much as in user-facing copy. The rule arrived after most of the
// prose it governs, so #215 swept 114 occurrences out of 56 files — and nothing
// stopped the next commit putting one back. A rule that only a person enforces
// is the shape #187 removed for eslint; this is the same move for spelling.
//
// SCOPE IS `app/` + `lib/`, THE SAME BOUNDARY product-name.mjs AND
// formula-escaping.mjs DRAW, and here it does the same second job it does
// there: it is what lets this check have NO EXEMPTION LIST. A British form has
// exactly one legitimate use in this repository — being CITED as the thing not
// to write — and every site that cites one is documentation: CLAUDE.md's own
// rule line spells `whilst` and `@img/colour`, and an issue body quotes the
// list it swept. All of that is outside `app/` + `lib/`, so none of it needs
// excusing. #171 records how fast an exemption list rots. This file is under
// scripts/, so it does not scan itself and the list below needs no
// self-exemption.
//
// WHAT IS DELIBERATELY NOT IN THE LIST: `dialogue`. #215's issue body names it
// as British, and it is not — `dialogue` is standard US English for a
// conversation and `dialog` is the UI element. Both occurrences in this repo
// read "it isn't a correction dialogue", the conversation sense, so flagging
// the word would demand a change that made the prose wrong. A form belongs
// here only when the US spelling is unambiguous.
//
// WHAT THIS CANNOT SEE: CLAUDE.md, docs/notes/, scripts/, commit messages and
// the Airtable base. That is the price of the scope above, and it is a real
// gap rather than a rounding error — 69 of #215's 114 fixes were outside
// `app/` + `lib/`. What the scope does cover is the surface the issue argues
// matters most: the module headers that carry this repo's reasoning, including
// the three `judgement` sites it names by path.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, standalone } from "./_harness.mjs";

export const title = "US English — no British spellings under app/ + lib/ (#215)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCANNED_DIRS = ["app", "lib"];

// British -> US. Spelled out rather than derived from morphology, because
// `-ise` alone matches `advertise`, `comprise` and `otherwise`, and a check
// that cries wolf is one people learn to silence. Every entry is a form where
// the US spelling is not in dispute; CLAUDE.md's rule line names nine of them.
const BRITISH = {
    behaviour: "behavior", behaviours: "behaviors", behavioural: "behavioral",
    behaviourally: "behaviorally", colour: "color", coloured: "colored",
    favour: "favor", favourite: "favorite", honour: "honor", neighbour: "neighbor",
    labour: "labor", rumour: "rumor", humour: "humor", flavour: "flavor",
    normalise: "normalize", normalised: "normalized", normalisation: "normalization",
    organise: "organize", organised: "organized", organisation: "organization",
    organisational: "organizational", recognise: "recognize", recognised: "recognized",
    serialise: "serialize", serialised: "serialized", serialises: "serializes",
    capitalise: "capitalize", capitalisation: "capitalization",
    initialise: "initialize", initialised: "initialized",
    authorise: "authorize", authorised: "authorized", authorisation: "authorization",
    summarise: "summarize", summarised: "summarized", categorise: "categorize",
    prioritise: "prioritize", minimise: "minimize", maximise: "maximize",
    optimise: "optimize", optimised: "optimized", analyse: "analyze",
    analysed: "analyzed", realise: "realize", realised: "realized",
    utilise: "utilize", itemise: "itemize", itemised: "itemized",
    customise: "customize", customised: "customized", localise: "localize",
    unrecognised: "unrecognized", sanitise: "sanitize", sanitised: "sanitized",
    cancelled: "canceled", cancelling: "canceling", labelled: "labeled",
    labelling: "labeling", mislabelling: "mislabeling", mislabelled: "mislabeled",
    unlabelled: "unlabeled", relabelled: "relabeled", modelled: "modeled",
    modelling: "modeling", signalled: "signaled", signalling: "signaling",
    travelled: "traveled", travelling: "traveling", levelled: "leveled",
    fuelled: "fueled", totalled: "totaled",
    fulfil: "fulfill", fulfilment: "fulfillment", enrolment: "enrollment",
    instalment: "installment", skilful: "skillful", wilful: "willful",
    catalogue: "catalog", catalogues: "catalogs", analogue: "analog",
    licence: "license", defence: "defense", offence: "offense", pretence: "pretense",
    judgement: "judgment", judgements: "judgments",
    whilst: "while", amongst: "among", grey: "gray", programme: "program",
    centre: "center", centred: "centered", metre: "meter", fibre: "fiber",
    sceptical: "skeptical", artefact: "artifact", enquiry: "inquiry",
    speciality: "specialty", learnt: "learned", spelt: "spelled",
};

const WORD_RE = new RegExp(`\\b(${Object.keys(BRITISH).join("|")})\\b`, "gi");

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx|mjs)$/.test(entry)) out.push(full);
    }
    return out;
}

export function run({ check, assert, log }) {
    const files = SCANNED_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));
    const sources = new Map(
        files.map((f) => [relative(REPO_ROOT, f).replaceAll("\\", "/"), readFileSync(f, "utf8")])
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // "No British spellings found" and "read no files" print the same result,
    // and client-import-safety.mjs shipped in the second state once — 29 checks
    // passing over zero resolved paths. So the scan proves it can see, and that
    // the matcher can match, before anything is claimed absent.
    log("anti-vacuity — the scan is shown to reach files and to match words:");
    assert(`walked ${sources.size} source files under ${SCANNED_DIRS.join("/ + ")}/`, sources.size > 100);

    // The US counterparts of the two commonest forms #215 swept. If these are
    // found, the corpus is real prose and the word matcher works; if the walk
    // were empty, this fails instead of the check passing for the wrong reason.
    for (const us of ["judgment", "behavior"]) {
        const re = new RegExp(`\\b${us}\\b`, "gi");
        const n = [...sources.values()].reduce((a, s) => a + (s.match(re) || []).length, 0);
        assert(`the US form "${us}" is found ${n} times, so matching works`, n > 3);
    }

    // And the list itself has to be able to fire: run it over a line that is
    // known to contain a British form. This is what a mutation would trip.
    const probe = "// a judgement about the old behaviour, cancelled and mislabelled";
    const probeHits = probe.match(WORD_RE) || [];
    assert(`the word list fires on a planted line (${probeHits.length} forms)`, probeHits.length === 4);

    // ── the sweep holds ─────────────────────────────────────────────────────
    log("");
    log("British spellings under app/ + lib/ — the state #215 left:");
    const offenders = [];
    for (const [path, src] of sources) {
        src.split("\n").forEach((line, i) => {
            WORD_RE.lastIndex = 0;
            let m;
            while ((m = WORD_RE.exec(line))) {
                offenders.push(`${path}:${i + 1} ${m[0]} -> ${BRITISH[m[0].toLowerCase()]}`);
            }
        });
    }
    if (offenders.length) offenders.slice(0, 20).forEach((o) => log(`    ${o}`));
    check(
        `occurrences${offenders.length ? ` (${offenders.length}, first: ${offenders[0]})` : ""}`,
        offenders.length,
        0
    );

    // ── the list is not empty by accident ───────────────────────────────────
    log("");
    log("the list itself:");
    check("forms the list can recognize", Object.keys(BRITISH).length > 80, true);
    assert("`dialogue` is deliberately absent — see this file's header", !("dialogue" in BRITISH));
}

if (isMain(import.meta.url)) standalone(title, run);

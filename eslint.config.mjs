import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

// #426 — `no-undef` under scripts/, and the globals it has to be asked against.
//
// THE RULE IS OFF FOR THE WHOLE REPOSITORY, NOT JUST HERE: eslint-config-next
// configures none of eslint:recommended's 61 rules, and nothing below adds any.
// So a name that resolves to nothing has only ever been found by RUNNING the
// file — which for scripts/tests/verify-*.mjs means a credentialed run costing
// hundreds of Airtable operations, made for some other reason. #191 fixed two
// such names that had been standing for months. This turns them into a failure
// of the lint job, which runs on every push.
//
// THE SET IS NARROWED BECAUSE FLAT CONFIG MERGES GLOBALS RATHER THAN REPLACING
// THEM, which is the trap this section exists to avoid. Adding
// `globals: globals.nodeBuiltin` below would leave all 1,110 browser-only names
// from the config above still defined — measured with
// `ESLint#calculateConfigForFile`, the entry count goes 1,174 -> 1,175 and
// `window`, `document`, `name`, `status` and `alert` stay live. Under that set
// 195 bindings in scripts/ shadow a builtin global, and each is a name whose
// declaration could vanish and resolve silently to a browser global with
// `no-undef` reporting nothing: exactly both of #191's defect shapes. Turning
// every inherited name off and putting Node's own set back takes that 195 to 5
// (all `unescape`, which five scripts rebind on purpose) and leaves `no-undef`
// still reporting 0 — a real 0 rather than one the globals bought.
//
// The measurements, and why one section covers three execution contexts, are in
// docs/notes/verification.md.
const inheritedGlobals = Object.assign(
  {},
  ...nextVitals.map((entry) => entry.languageOptions?.globals ?? {})
);

// DERIVED FROM THE CONFIG ABOVE RATHER THAN TYPED OUT, so the off-list cannot
// drift from what that config defines. The failure mode of deriving it is
// silent — an upstream change of shape returns nothing, the narrowing
// evaporates, and `no-undef` goes on reporting 0 and looking fine, which is the
// very thing this section is about. `window` is the specific name the narrowing
// exists to turn off, so its absence means we are not holding the browser
// globals and the derivation has stopped working. A count threshold would be a
// magic number; this is the property.
if (!("window" in inheritedGlobals)) {
  throw new Error(
    "eslint.config.mjs (#426): derived no globals from eslint-config-next, so " +
      "the scripts/ section would silently leave the browser globals defined. " +
      "Check what `eslint-config-next/core-web-vitals` now exports."
  );
}

// Node's own globals and nothing else. `globals.nodeBuiltin` rather than
// `globals.node`: the latter adds `require`, `__dirname`, `module` and
// `exports`, which an .mjs cannot use — leaving them off is what makes
// `require()` in a script a failing check, the shape scripts/tests/_fixtures.mjs
// carries an incident note about. The set floats with the globals package as
// Node itself gains globals (16.5.0 added `localStorage`), and that float is
// only ever permissive, so it can cost coverage and never raise a false
// failure.
const nodeOnlyGlobals = {
  ...Object.fromEntries(Object.keys(inheritedGlobals).map((name) => [name, "off"])),
  ...globals.nodeBuiltin,
};

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // #187 — the Python virtualenv behind scripts/import/. It is gitignored,
    // but a flat config does not read .gitignore, so `npx eslint .` walked
    // into two vendored urllib3 .js files that exist on a dev machine and
    // never on CI. Both are clean today; what matters is that the local run
    // and the CI run look at the same tree, or the enforced baseline is not
    // the one anybody measured.
    //
    // THIS IS ONE HARD-CODED PATH AND THE DRIFT IT CLOSED IS GENERAL, so a
    // second gitignored directory holding .js brings it back with nothing
    // saying so — the entry below would still be there and still be right.
    // Not observed: #195 measured the current state and `npx eslint .` lints
    // 342 files, none of them untracked. Recorded here rather than guarded,
    // because a check would have to run eslint or reimplement its ignore
    // resolution, and eslint is deliberately a CI job of its own.
    ".venv/**",
  ]),
  {
    // Every extension eslint-config-next itself matches that could plausibly
    // appear here, rather than the one this directory uses today — but the glob
    // is not what holds the coverage. `offline/lint-scope.mjs` enumerates the
    // JS files under scripts/ and asks the RESOLVED config about each one, so a
    // file this pattern fails to reach is a failing check rather than a silent
    // gap.
    name: "scripts/no-undef (#426)",
    files: ["scripts/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: { globals: nodeOnlyGlobals },
    rules: { "no-undef": "error" },
  },
]);

export default eslintConfig;

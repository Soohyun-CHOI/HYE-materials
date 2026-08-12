import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

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
    ".venv/**",
  ]),
]);

export default eslintConfig;

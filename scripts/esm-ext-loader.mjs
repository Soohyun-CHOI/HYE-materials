// Shared tooling, not part of the app itself — lib/**/*.js import siblings
// without file extensions (e.g. "./client"), which is fine under Next.js's
// bundler but fails under plain `node` (native ESM resolution requires
// explicit extensions). This loader retries unresolved relative specifiers
// with ".js" appended so any scripts/**/*.mjs can import the real
// lib/airtable/*.js files directly. Used by scripts/tests/test-phase0.js
// and scripts/demo/*.mjs — do not delete.

export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context);
    } catch (err) {
        if (
            err?.code === "ERR_MODULE_NOT_FOUND" &&
            (specifier.startsWith("./") || specifier.startsWith("../"))
        ) {
            return await nextResolve(`${specifier}.js`, context);
        }
        throw err;
    }
}

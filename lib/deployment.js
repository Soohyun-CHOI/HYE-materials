// Which deployment a run is (#633, #681): the one reading of `VERCEL_ENV` and of
// `VERCEL_GIT_COMMIT_REF` in this repository. `lib/airtableBase.js` asks it to choose a base,
// `lib/mailRedirect.js` to choose who a mail reaches, and `next.config.mjs` whether a build may
// go on.
//
// THE DEPLOYMENT IS NAMED BY VERCEL, NOT BY A VARIABLE SOMEBODY SETS. `VERCEL_ENV` is the system
// variable Vercel puts on every deployment, `production` on that one alone, so production needs
// no setting to forget and a preview none to add (`docs/notes/airtable-access.md`, #534). It was
// read inside `resolveAirtableBase` until #633, when the mail became a second question with the
// same answer; two readings of one variable could part, and the mail's parting would reach a
// real person, so both ask this.
//
// ANYTHING BUT `production` IS NOT PRODUCTION, and that is the direction to be wrong in. An unset
// variable, a local `next dev`, a local `next start`, a script, a preview, `Production` in
// another case: none is the deployment, so none reaches the live base or mails the people the
// base names. A run that names the live base with `AIRTABLE_BASE=live` is still not production
// here — it reaches the live base and its mail is redirected all the same — and a preview
// deployment may not name it at all (below). The values are read trimmed, as
// `resolveAirtableBase` always read them.
//
// THE TEST DEPLOYMENT (#681) IS A PREVIEW OF MAIN AT A FIXED ADDRESS. A preview is built from
// one branch and stays at that branch's code, so `.github/workflows/test-deployment.yml` keeps
// a branch of its own, `TEST_DEPLOYMENT_BRANCH`, one commit past main and holding main's tree,
// and Vercel serves that branch's latest deployment at `test.hyeusa.com`. It is a preview like
// any other — the test base, the materials screens open, mail redirected — and two things here
// keep it one whatever a setting says:
//   - A PRODUCTION BUILD OF ITS BRANCH STOPS. Vercel builds that branch as production only when
//     a setting says so: the Production Branch moved onto it, or one of its previews promoted,
//     which Vercel rebuilds with production's variables. `assertTestBranchNotProduction` throws
//     then, and `next.config.mjs` asks it as the build evaluates that file, so the build fails
//     and production keeps the deployment it had.
//   - A PREVIEW NEVER NAMES THE LIVE BASE. `resolveAirtableBase` refuses `AIRTABLE_BASE=live`
//     where `isPreviewDeployment` holds — every preview, a custom environment's included, since
//     Vercel reports one as a preview — so no variable added to the Preview scope reaches the
//     live base, beside that scope holding no live key (#534).
//
// THE REFUSAL IS ASKED AT BUILD AND AT NO REQUEST. A throw at a request would turn a served
// deployment into an error page on every address, and a build this refuses never becomes a
// deployment to serve. So `isProductionDeployment` answers a production run of that branch
// `true` and never throws; only the build asks the branch.
//
// WHAT IT CANNOT SEE: the address connected to the Production environment instead of the
// branch — Vercel connects a domain it is handed to production until it is told otherwise —
// which serves the production deployment there, and no build is asked. The materials screens
// closed at that address are the tell, and `docs/notes/airtable-access.md` lists every setting
// the test deployment rests on.
//
// THE ENVIRONMENT IS HANDED IN, and defaults to the process's. A check builds its own, so none
// sets a process variable; a caller that has none to hand passes nothing.
//
// IMPORTS NOTHING, so `lib/airtableBase.js` can import it and stay loadable by every script with
// no loader, and the offline tier can call it. `offline/mail-redirect.mjs` holds the answer by
// value and fails any other file that reads either variable; `offline/test-deployment.mjs` holds
// the branch, its refusal and the workflow keeping it.

/** The branch the test deployment is built from (#681), which nobody commits to. */
export const TEST_DEPLOYMENT_BRANCH = "test-deployment";

function read(env, name) {
    const value = env?.[name];
    return typeof value === "string" ? value.trim() : "";
}

/** Whether `env` is the production deployment's: `VERCEL_ENV` is `production`, and nothing else is. */
export function isProductionDeployment(env = process.env) {
    return read(env, "VERCEL_ENV") === "production";
}

/** Whether `env` is a preview deployment's: `VERCEL_ENV` is `preview`, as Vercel reports a custom environment too. */
export function isPreviewDeployment(env = process.env) {
    return read(env, "VERCEL_ENV") === "preview";
}

/**
 * Throws on a production build of the test deployment's branch (#681), so the build fails and
 * production keeps the deployment it had. Asked by `next.config.mjs` alone, as the build
 * evaluates it; a main build, a preview of the branch and a local run go on.
 */
export function assertTestBranchNotProduction(env = process.env) {
    if (isProductionDeployment(env) && read(env, "VERCEL_GIT_COMMIT_REF") === TEST_DEPLOYMENT_BRANCH) {
        throw new Error(
            `A production build of "${TEST_DEPLOYMENT_BRANCH}", the test deployment's branch, is refused (#681), ` +
                "and production keeps the deployment it had — set the Production Branch back to main"
        );
    }
}

// Whether a run is the production deployment (#633): the one reading of `VERCEL_ENV` in this
// repository, which `lib/airtableBase.js` asks to choose a base and `lib/mailRedirect.js` asks
// to choose who a mail reaches.
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
// here — it reaches the live base and its mail is redirected all the same. The value is read
// trimmed, as `resolveAirtableBase` always read it.
//
// THE ENVIRONMENT IS HANDED IN, and defaults to the process's. A check builds its own, so none
// sets a process variable; a caller that has none to hand passes nothing.
//
// IMPORTS NOTHING, so `lib/airtableBase.js` can import it and stay loadable by every script with
// no loader, and the offline tier can call it. `offline/mail-redirect.mjs` holds the answer by
// value and fails any other file that reads `VERCEL_ENV`.

/** Whether `env` is the production deployment's: `VERCEL_ENV` is `production`, and nothing else is. */
export function isProductionDeployment(env = process.env) {
    const value = env?.VERCEL_ENV;
    return typeof value === "string" && value.trim() === "production";
}

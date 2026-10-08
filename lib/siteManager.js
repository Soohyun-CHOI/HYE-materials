// Who records what happens to a tool (#506) — the one reading of `Users."Is Site Manager"`.
//
// A SITE MANAGER ADDS TOOLS, PRINTS THEIR LABELS, CHECKS THEM OUT AND IN, AND RETIRES
// THEM, ON THE JOBS THEY ARE ASSIGNED TO; EVERYBODY ELSE READS. Every tools screen draws
// those controls for a site manager alone and the same screen without them for anyone
// else, and `withSiteManagerAction` (lib/authz.js) refuses the four actions behind them to
// anyone else — so a control a reader does not see is also a request the server turns
// away, and hiding it is never the whole of the rule.
//
// A FLAG OF ITS OWN AND NOT `Is Admin`. `Is Admin` opens the office's screens — invoicing,
// and what the office gets next — across the whole app, and the tools track does not pass
// through the office: a site buys its tools, keeps them and scans them
// (`docs/notes/tools.md`). So the person who records a tool's events is marked for that and
// for nothing else, and an Admin who is not marked records nothing. `soo@` is both.
//
// THIS IS THE ONE READER. The mapper carries the field on the user
// (`lib/airtable/users.js`), and every screen, the server's gate and the account's role
// line ask this function rather than the property, so the screen that draws a control and
// the server that refuses it cannot answer differently. `offline/site-manager.mjs` fails a
// read of `.isSiteManager` anywhere else under app/ and lib/.
//
// IT SAYS NOTHING ABOUT WHICH JOB. A site manager records on the jobs they are assigned
// to, which is `lib/toolJob.js`'s question, asked as before; one assigned to none is told
// to ask the office for a job, and a reader who is not a site manager is told nothing,
// since there is nothing they could ask for.
//
// IT IS SET BY HAND, AS `Is Admin` IS. No screen writes it and `createUser` leaves it off,
// so a first sign-in reads the tools screens and records nothing.
//
// PURE AND OFFLINE-SAFE, IMPORTING NOTHING, so lib/toolTransition.js — which `"use client"`
// files import — and lib/navigation.js can ask it, and the offline tier can call it.

/**
 * Whether this person records what happens to a tool (#506). `true` and nothing else
 * admits, so a missing field, a missing user and any other value read as no.
 */
export function isSiteManager(user) {
    return user?.isSiteManager === true;
}

# Your name

Route: `/login/name`
Design: Sign in 1c and 1g, on Invoices 0o.
Who reaches it: anybody signed in whose `Users` row has no first name, on any page
they open (`lib/authz.js:requireUser`) — in practice every new colleague once, after
their first sign-in. A reader with a name never sees it.
Which width comes first: both, as the two sign-in screens before it: a first-time
scanner comes through all three on a phone.

## What it answers

What should the app call you? Every screen that names a person reads one stored
name (`lib/userName.js`).

**It is deliberately after the token rather than before it.** Asking on the
sign-in screen would take a name from somebody who has not yet shown they control
the address, and the answer would have to survive a mail round trip. Here the
address is proven and the row exists.

## What it always carries

**Two fields, both required, a first name and a last name.** What is typed is
trimmed and its runs of spaces made one; its case is left as typed. Screens name a
person by the first name, and the full name in the four kinds of place below.

**Where the reader was going travels through it** in the address and a hidden
field, never in a sentence, so a person who scanned a label lands on that item.

**What it reads:** 1 operation, the session; a save 2 (`docs/notes/authorization.md`).
The gate that sends a reader here costs nothing — it is a property of the row the
session already read.

## What it carries only sometimes

**While saving:** the press is busy and the fields take no typing
(`USER_NAME_COPY.working`).

**When a name is missing:** `USER_NAME_COPY.refusal.first` or
`USER_NAME_COPY.refusal.last`, under that field — under both when both are empty.

**When a name is too long:** `USER_NAME_COPY.refusal.tooLong`, under that name. The
field takes the longer name and refuses it rather than cutting a paste short; the
ceiling is the module's own, 60 characters.

**When the write fails:** `USER_NAME_COPY.refusal.failed`. The fields keep what was
typed — a person should never type their own name twice to find out why it was
refused.

**There is no success state.** Saving lands the reader on the page they were going
to, or on the job step first when that applies.

## What must agree elsewhere

**Nothing else in the app asks a reader for their own name, and no screen edits
one.** A reader who already has a name and opens this address is sent away rather
than shown the form:
this is a step, not a profile screen. Correcting a typo is an Airtable edit.

**The first name is what every screen naming a person shows**; the full name
appears where a person is chosen from a list (the signer pickers), where somebody
outside the company reads it (the purchase order PDF and the order email), where
a person is named as the one who did something (an asset's history), and where the
reader is named to themselves (the rail's account).

**While a name is blank the app prints the local part of the person's email**,
which is what every screen printed before this step existed, so an account that has
not signed in since reads as it always did.

**The job step comes after it** for a reader with no job who is neither the office
nor the President (`login-jobs.md`): the name, then the jobs, then the page.

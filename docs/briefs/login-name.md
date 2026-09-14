# Your name

Route: `/login/name`
Who reaches it: anybody whose `Users` row has no first name, on the first page
they try to open after signing in. In practice that is every new colleague once,
and — for one transition — every existing account once. Nobody sees it twice.

It is the **third step of the sign-in flow**, so it is used at a phone width as
well as at a monitor, for the same reason the two screens before it are: a QR
label scanned on site can arrive signed out, and a first-time scanner comes
through all three.

## What it answers

What should the app call you? Every screen that names a person reads one stored
name, and until this screen existed that name was whatever came before the at
sign in the person's email address — so a request was waiting on `bsws9803` and
an edit log said `hkahn` changed something.

**It is deliberately after the token rather than before it.** Asking on the
sign-in screen would take a name from somebody who has not yet shown they
control the address, and the answer would then have to survive a mail round
trip. Here the address is proven and the row already exists, so the question is
being asked of a person the app can be sure of.

**Two fields, both required, and the second one needs explaining on screen.**
Screens name a person by their first name; the full name goes where a person is
chosen from a list and onto what a vendor reads. The screen says so, because
otherwise the last name reads as bureaucracy.

## What it always carries

**identity.** The heading `Sign in to HYE USA Portal` — the same line the
sign-in screen and the confirm screen carry, from the same constant, so three
steps of one flow read as one flow.

**evidence.** Two lines. `Before you go on, tell the app what to call you.` and,
smaller under it, `Screens name you by your first name. Your full name goes on
the purchase orders and order emails vendors receive.` The second is the only
place a reader learns why both are asked.

**action.** Two labelled text fields, `First name` and `Last name`, and one
full-width filled button, `Save and continue`.

That is the whole screen. Like the two before it, it is centered in the viewport
and carries no navigation of any kind — there is nowhere else to go from here.

**It also carries one thing it never shows.** Where the reader was going travels
with them into this screen and out the other side, so a person who scanned a
tool label lands on that tool item. It is in the URL and in a hidden field,
never in a sentence — the same silence the two screens before it keep.

## What it carries only sometimes

**While saving:** the button reads `Saving...`, and both fields and the button
are disabled.

**When a name is missing:** one sentence, `Enter your first name.` or
`Enter your last name.` The fields keep what was typed.

**When a name is too long:** `Keep each name under 60 characters.`

**When the write fails:** `That could not be saved. Try again.` The fields keep
what was typed — a person should never be made to type their own name twice to
find out why it was refused.

There is no success state on this screen. Saving lands the reader on the page
they were going to, which is what says the save happened.

## What must agree elsewhere

**The heading is the sign-in screen's and the confirm screen's**, so all three
read as one flow.

**Nothing else in the app asks for a name, and no screen edits one.** A reader
who already has a name and opens this address is sent away rather than shown the
form: this is a step, not a profile screen. Correcting a typo is an Airtable
edit until an issue decides who may change whose name.

**The first name is what every screen naming a person then shows** — the
request list's Requester column, the signing chain, the history timeline,
`Recorded by`, a tool item's log. The full name appears in exactly two kinds of
place: where a person is chosen from a list (the signer pickers), and where
somebody outside this company reads it (the purchase order PDF and the order
email).

**While a name is blank the app prints the local part of the person's email**,
which is what every screen printed before this screen existed. So an account
that has not signed in since is not blank on screen — it reads exactly as it
always did, and improves the moment its owner comes through here.

**This screen is used at a phone width as well as at a monitor**, along with the
two sign-in screens before it, because a scan that arrives signed out comes
through all three.

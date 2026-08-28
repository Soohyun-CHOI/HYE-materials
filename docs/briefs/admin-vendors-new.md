# New vendor

Route: `/admin/vendors/new`
Who reaches it: Admin only.

## What it answers

Nothing — a create form, the third of the three admin creates, and structurally the
plainest.

What it is worth knowing about a vendor record: **vendors have no account and never
touch this app.** Every one of these fields is a note the office keeps about someone
outside the company, and the contact details are plain text rather than links to any
user record for exactly that reason. The vendor never sees a screen; they receive a
purchase order PDF by email, sent by hand, outside the app.

## What it always carries

**identity.** The heading `New Vendor`.

**action.** `Vendor Name`, required, then `PIC Name`, `PIC Phone` and `PIC Email` —
the person the office deals with. A submit control.

Narrow centered column, like its two siblings.

## What it carries only sometimes

**When a vendor has just been created:** a green `Created vendor {name}.` above the
form, which stays ready for the next.

## What must agree elsewhere

**`Vendor Name` is what every other screen means by "vendor"** — the request list's
column, the invoice's, the delivery's, the price list's per-row rows. It appears on
more screens than any other field authored in the admin area, so it is the one worth
getting right at creation.

**`PIC` is used unexpanded** here and on the purchase order detail, which carries
`Our PIC` for the internal counterpart. Two uses of one abbreviation for two sides of
the same relationship, and both are on screen today.

**The contact fields are external notes, not app identities.** No email here ever
receives anything from the app, and nothing validates against the company domain the
way sign-in does. A design should not make them look like invitations.

**A vendor cannot be created from the request form**, though that is where a reader
first needs one — so a missing vendor means leaving the form and coming back. Worth
knowing if a redesign considers an inline create.

**THIS SCREEN HAS NO ERROR SLOT, AND THAT IS STRUCTURAL RATHER THAN AN OMISSION
(#185).** The page is a Server Component that hands its action straight to
`<form action={…}>`, a binding that discards whatever the action returns — so there
is no value for a refusal to arrive in and nothing to render. The action refuses by
throwing instead, and a thrown message reaches no boundary this app owns, so it is
developer-facing text rather than copy. The form has no validation refusal of its own
either: the fields are `required` and the handler creates and redirects. **So a
redesign should not draw room for an error here.** `/admin/disciplines/new` is the
sibling that does have one, because its form goes through `useActionState`; if this
screen ever needs a message, the change is that binding rather than the wording.

**The three admin creates are one pattern**, with the one difference above: the
Disciplines form has an error box and this one has nowhere to put a message.

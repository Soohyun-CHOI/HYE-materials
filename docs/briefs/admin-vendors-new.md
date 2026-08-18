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

**The three admin creates are one pattern.**

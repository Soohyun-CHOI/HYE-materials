# Home

Route: `/`
Who reaches it: anyone, signed in or not.

## What it answers

Who am I signed in as, and where do I go? That is all it does today, and it is
important that a designer knows how little it is: **this screen is a stopgap, not a
designed landing page.**

Its own source says why it exists — the app has no navigation shell, so a new
route is otherwise reachable only by typing its URL. Each of its links was added by
the issue that added the screen behind it, one at a time, for that reason alone.
Before those links, a purchase order was reachable only through the request that
generated it.

**So this is the screen with the most design freedom in the app and the least
existing content to preserve.** The absence of a navigation shell is the largest
single gap a design will find, and this page is where it currently shows.

## What it always carries

Nothing unconditionally except the two states below — the whole page is one branch
on whether there is a session.

## What it carries only sometimes

**When signed in:**

- **identity** — one line: `Signed in as {email}`, with the email in bold,
  followed by the reader's role in parentheses, and `, Admin` appended when they
  are an Admin. This is the only place in the app that states the reader's own role
  back to them, which matters because almost every screen behaves differently by
  role and nothing else says which one you are.
- **action** — `New Purchase Request` as the filled primary button, then three
  outlined links: `Material prices`, `Deliveries`, `Purchase orders`.
- **action** — a sign-out control.

**When not signed in:** the line `Not signed in.` and a single `Sign in` button.

## What must agree elsewhere

**The link labels are screen names and one of them disagrees with its
destination.** `Purchase orders` here, `Purchase Orders` as that screen's own
heading. `Material prices` and `Deliveries` match theirs exactly. Whatever a
redesign does with navigation, these labels and the headings they point at should
be settled together — see the shared brief.

**`New Purchase Request` is the same label as that form's own heading**, and the
request list's button says `New PR` for the same destination. Three surfaces, two
words for one screen.

**The role stated here is the same distinction every gate uses** — President,
Employee, and the Admin flag that means office staff. It is an organizational
distinction rather than a privilege ladder, and this line is the only place a
reader sees their own.

**There is no user-administration screen**, so nothing here leads to one. A Users
record appears as a side effect of a first sign-in and in no other way, and
promotion to Admin is a manual edit in Airtable. A design that adds a "manage
users" affordance would be promising something that does not exist.

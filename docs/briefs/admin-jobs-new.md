# New job

Route: `/admin/jobs/new`
Who reaches it: Admin only, like everything under `/admin`.

## What it answers

Nothing. It is a plain create form and the simplest screen in the app — one of
three that share a single pattern, described at the foot of this brief.

A job is the top of the app's hierarchy: every purchase request names one, every
delivery belongs to one, and job assignment is what gives a site staffer visibility
into anything at all. So this form is where a reader's world begins to exist, even
though nothing on the screen says so.

## What it always carries

**identity.** The heading `New Job`.

**action.** Three required fields: `Job Code`, `Job Name`, and `Business Unit` as a
dropdown with exactly three options — `EPC`, `HT`, `SYS`. A submit control.

The page is narrow — a single centered column at the app's smallest width, unlike
every list and detail screen.

## What it carries only sometimes

**When a job has just been created:** a green line above the form,
`Created job {code}.` The form stays on screen and ready for another rather than
navigating away.

## What must agree elsewhere

**`Job Code` and `Job Name` are the two halves of the `{code} — {name}` pair** that
several screens render as one cell — the delivery detail's job line, the purchase
order detail's. This form is where that pair is authored, so both halves have to be
worth showing. **The four document lists show the CODE alone** in a column headed
`Job`, which is what #314 settled; the pair is a detail screen's shape.

**A job's lines are created on their own screen**, not here, and a request cannot
name a job without a discipline. So creating a job is step one of two and nothing on this
screen says that — worth knowing if a redesign considers joining them.

**`Business Unit`'s three values are a closed set** and are not editable from the
app.

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

**The three admin create screens are one pattern:** narrow centered column, a
heading of the form `New {thing}`, required fields, a submit, and a green
`Created {thing} {name}.` line on success that leaves the form ready for another.
They should stay one pattern — and if a design gives them a shared shell, this
sameness is the argument for it. **The shell has to allow for one difference**: the
Disciplines form carries an error box and these two cannot.

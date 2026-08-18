# New line

Route: `/admin/lines/new`
Who reaches it: Admin only.

## What it answers

Nothing — a create form, and the second of the three admin creates. It is the one
of the three with a real interaction in it.

A line is a subdivision of a job, and it is what a purchase request actually names.
The word is reserved across the whole app: **`line` means a row of this table and
nothing else** — never a row of an items table, which is an *ordered item* in prose
and screen copy everywhere. This screen is where the reserved thing is created, so
it is the clearest place to see what the word means.

## What it always carries

**identity.** The heading `New Line`.

**action — `Job`,** a searchable combobox rather than a plain dropdown, with the
placeholder `Search Jobs by code or name…`. It is a combobox because the job list
grows without bound while the other two admin forms have no such field. It has no
native required state, so the form tracks that itself — a validation detail that a
redesign inherits rather than invents.

**action — `Line Name`,** required, and a submit control.

Narrow centered column, like its two siblings.

## What it carries only sometimes

**When nothing matches the search:** `No matching Jobs.` inside the dropdown.

**When a line has just been created:** a green `Created line {label}.` above the
form, which stays ready for the next one — lines are usually entered several at a
time for one job.

## What must agree elsewhere

**`Line Name` is only half of what the app displays.** The label a reader sees
elsewhere is the job and the line name joined, composed on the data side rather
than typed here. So a line name that reads well alone may read badly in the pair,
and this form shows only the half being typed.

**The job-then-line dependency is the same shape as the request form's**, where
choosing a job filters the lines and changing it clears the choice. That form is
where most readers meet the relationship; this is where it is authored.

**`line` is reserved, and the app has identifiers that break the rule.** Several
code identifiers say `line` for an ordered item, which is recorded as a known
divergence with its own issue rather than a pattern to copy. Nothing a designer
writes should pick the word up from them — on screen, a `line` is what this form
creates.

**The three admin creates are one pattern**, and this one's combobox is the only
place they differ.

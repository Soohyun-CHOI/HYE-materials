# New discipline

Route: `/admin/disciplines/new`
Who reaches it: Admin only.

## What it answers

Nothing — a create form, and the second of the three admin creates. It is the one
of the three with a real interaction in it.

A discipline is a subdivision of a job, and it is what a purchase request actually
names. The site calls it a discipline and until #280 the app called it a line; the
table is `Disciplines` now, so a row of it is a **discipline** and nothing else in
the app borrows the word.

**`line` is reserved against, rather than for, anything here.** This paragraph
used to say `line` meant a row of this table; it means no row of any table now.
Each of the four item tables takes its own table's name in the singular — a
`PR Items` row, a `PO Items` row (`ordered item`, the one that is not its table's
name spelled out), an `Invoice Items` row and a `Delivery Items` row — so there is
no single word for "a row of an items table", and `line` is not one of them
either. What survives of the word is a line of rendered text and the
`Addresses` fields `Line 1` and `Line 2`.

## What it always carries

**identity.** The heading `New Discipline`.

**action — `Job`,** a searchable combobox rather than a plain dropdown, with the
placeholder `Search Jobs by code or name…`. It is a combobox because the job list
grows without bound while the other two admin forms have no such field. It has no
native required state, so the form tracks that itself — a validation detail that a
redesign inherits rather than invents.

**action — `Discipline Name`,** required, and a submit control.

Narrow centered column, like its two siblings.

## What it carries only sometimes

**When the form is refused:** a red box above the fields, carrying one sentence.
Two can land there — `That Job doesn't exist. Pick one from the list.` and, since
#185, the authorization refusal `Not authorized.` **One box, whatever the reason**, so
a redesign draws the slot once and needs no second treatment for a refused role: the
action hands every refusal back the same way and the form renders whichever arrived.
**Neither is reachable by an ordinary reader** — the first needs a forged submit and
the second a direct call or an Admin demoted mid-form — so the box is real and empty
by construction. Draw it anyway; before #185 the authorization one bypassed it for a
framework error page, and having somewhere for it to go is the whole of that change.

**When nothing matches the search:** `No matching Jobs.` inside the dropdown.

**When a discipline has just been created:** a green `Created discipline {label}.`
above the form, which stays ready for another rather than navigating away.

## What must agree elsewhere

**`Discipline Name` is only half of what the app displays.** The label a reader
sees elsewhere is the job and the discipline name joined by an underscore, composed
on the data side rather than typed here. So a name that reads well alone may read
badly in the pair, and this form shows only the half being typed.

**The job-then-discipline dependency is the same shape as the request form's**,
where choosing a job filters the disciplines and changing it clears the choice.
That form is where the relationship is used; this is where it is authored.

**The word and the code agree, and #280 is what closed the gap.** #227 renamed the
identifiers that said `line` for an ordered item — `lineStatus`, `poLineDelivery`,
an allocation row's `line` — and left the ones that meant a row of this table,
because the table was called `Lines`. Those have gone with it: no identifier under
`app/` or `lib/` names a row of this table `line` any more, and
`offline/line-vocabulary.mjs` asserts both halves of that.

**The three admin creates are one pattern**, and this one's combobox is the only
place they differ **on screen**. They differ once more underneath, and a designer
needs it: this form has an error slot and the other two have none. Its action is
bound through `useActionState`, so a refusal comes back as a value the form renders;
theirs are handed straight to `<form action={…}>`, which discards a return, so their
refusals throw and reach no slot at all (#185). **Do not draw an error box on the
Jobs or Vendors form** — nothing can put a sentence in it.

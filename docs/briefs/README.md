# Screen briefs

**What each screen carries, for the design work.** One file per page, plus
`_shared.md` for what is true across the whole app.

This directory exists because the design work runs in a tool that does not read
this repository. The brief pasted into that tool's chat is everything the designer
gets, so **anything not written here is something they will not know**. These files
are that brief.

## What they are, and what they deliberately are not

They record **what survives a redesign**: which facts a screen carries and at what
level, which distinctions the app has to make visible, which words were argued to
their current form, and who reads which screen.

They do **not** describe how the app looks. Nothing about the current appearance
was designed — it was written one class at a time alongside the logic it wraps — so
color, spacing, type, size, shadow, column widths and placement are all open, and
`_shared.md` says so in its first section. A brief that starts describing today's
layout has drifted from its purpose.

This is also why the briefs are not in `docs/notes/`. Those files record *why
something became what it is*; these record *what is there*. Different question,
different audience, different lifetime.

## Handing one over

The design work runs in Claude Design. Paste `_shared.md` once, at the start of the
engagement, then hand over one screen at a time by copying that screen's file
whole. Each file names its own route and states who reaches it, so it stands alone
on top of the shared brief and nothing has to be assembled from two places.

**The repository is deliberately not connected to that tool.** Connecting it would
align the work to the existing styles, which is what the feature is for and the
opposite of what this milestone needs: nothing about the current appearance was
designed, so aligning to it would turn a coding assistant's unconsidered defaults
into the baseline a design has to justify departing from. `_shared.md` opens by
saying this in its own voice, because a designer handed a brief and no code will
otherwise either wonder what they are drawing from or imagine an app that was never
designed.

**Write the reasoning down in the design conversation as decisions are made.** Why
a scale was chosen, what was tried and rejected, which constraint forced a
compromise — recorded in the chat, that becomes the context the implementation
work reads back. It is the habit this repository already keeps in `docs/notes/`,
where a decision's derivation outlives the commit that made it, and the briefs are
what carries the habit across a tool boundary: they take the reasoning out to the
design work, and the design conversation is what brings the new reasoning back.

## The files

`_shared.md` first. Then one per page, named after its route: the leading slash
dropped, `/` replaced by `-`, and brackets stripped from a dynamic segment. So
`/pos/[poId]` is `pos-poId.md` and `/invoices/[invoiceId]/edit` is
`invoices-invoiceId-edit.md`. The home screen at `/` is `root.md`, which is the one
name that is not mechanical.

Every page gets a file. There is no exemption list, and length follows what the
screen carries — the three admin create forms are short because a brief saying
"one form, no distinctions, nothing conditional" is complete for them.

## The string inventory beside them

`strings/` holds one file per screen recording **every string that screen can
render** — the condition on each, the file and line it comes from, which table's
row it names, and whether a brief quotes it or `screen-briefs.mjs` pins it (#288).
`strings/README.md` is its format and its limits.

A brief says what a screen *carries* and an inventory says what it *says*, which
is why they are two documents rather than one: a brief that listed every string
would stop being readable at a sitting, and an inventory that argued about
distinctions would stop being checkable. The inventory is the input to the
vocabulary work and to #258's token layer; the brief is what the designer reads.

**It also reads back on these files.** The first five inventories found a
completeness claim in `login.md` that was false — the screen carries a line the
brief did not list — and that sentence is corrected in the commit that added them.

## Keeping them true

`scripts/tests/offline/screen-briefs.mjs` runs in CI and checks four things: that
the set of briefs matches the app's actual pages both ways, that each brief has its
required structure, that the tone names `_shared.md` lists are exactly the ones the
code can produce, and that the words it quotes are still the words the constants
hold. Its header says what it cannot check, which is most of what a brief asserts.

**A change to what a screen carries updates its brief in the same commit**, the same
obligation a schema change has. Adding or removing a page fails the build until its
brief exists.

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

Paste `_shared.md` once at the start of a design engagement. After that, one screen
is one file — copy it whole. Each file names its own route and states who reaches
it, so it stands alone on top of the shared brief.

## The files

`_shared.md` first. Then one per page, named after its route: the leading slash
dropped, `/` replaced by `-`, and brackets stripped from a dynamic segment. So
`/pos/[poId]` is `pos-poId.md` and `/invoices/[invoiceId]/edit` is
`invoices-invoiceId-edit.md`. The home screen at `/` is `root.md`, which is the one
name that is not mechanical.

Every page gets a file. There is no exemption list, and length follows what the
screen carries — the three admin create forms are short because a brief saying
"one form, no distinctions, nothing conditional" is complete for them.

## Keeping them true

`scripts/tests/offline/screen-briefs.mjs` runs in CI and checks four things: that
the set of briefs matches the app's actual pages both ways, that each brief has its
required structure, that the tone names `_shared.md` lists are exactly the ones the
code can produce, and that the words it quotes are still the words the constants
hold. Its header says what it cannot check, which is most of what a brief asserts.

**A change to what a screen carries updates its brief in the same commit**, the same
obligation a schema change has. Adding or removing a page fails the build until its
brief exists.

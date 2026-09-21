# New category

Route: `/admin/categories/new`
Who reaches it: Admin only, like everything under `/admin`.

## What it answers

**Where does a material that is not in the catalog come from?** HQ maintains a
four-level tree of the paths this company buys — 777 of them — and a request picks a
category from it rather than typing a name. When the site asks for something the
tree does not have, this is where the office adds it.

It is the fourth `/admin` create form and the only one of the four that computes
anything. The other three take what is typed; this one takes a parent and two names
and works out the codes.

**Two facts about the row make this screen matter more than its size suggests.**
Every material's name comes from its category since #416, and those names have to
be distinct — a screen can call a material by one name only if one name picks out
one category. And a category's code has to be unique across the whole table:
`Materials` is keyed on it, and a broken one prints the wrong path on a purchase
order a vendor reads.

## What it always carries

**identity.** The heading `New Category`, and one line under it saying what the
screen is for: `A path the catalog does not have yet, under a level 2 it already
has.`

**action — the parent.** Two dropdowns, `Level 1` and `Level 2`, narrowed from the
catalog: level 2 offers only the children of the level 1 that was picked, and is
disabled until one is. **Both are chosen and neither is typed** — this screen adds
a leaf under a parent that exists, and a new level 1 or level 2 is not something it
can do (the code block it would need does not exist at that depth).

**action — `Level 3`,** a dropdown, disabled until a level 2 is chosen. It offers
three kinds of thing at once: **the level-3 children that parent already has**,
`No division at this level`, and `Add one the catalog does not have`. The last
reveals a text field, `Name the new level 3`.

**action — `Level 4`,** a text field, with a checkbox beside it carrying the same
words as the option above: `No division at this level`. Checking it disables the
field.

**action — `Item Name`,** a text field, **drafted from the levels above and
typed over**. The hint under it says what the field is for:
`What every purchase order, invoice and delivery will call this material.`

**action.** A submit control, `Create Category`, **disabled only while a field is
missing.** Every other objection this screen can raise is advisory: the amber lines
below are what the tree the page loaded implies, and the base is the only thing that
refuses. So a reader can press Create under an amber line and get the server's
answer — see the note on staleness at the foot of this brief.

Narrow centered column, like its three siblings.

## What it carries only sometimes

**While the draft is still the draft:** `Drafted from the levels above. Type over
it.` It goes the moment the reader types in the box, and the box is theirs from
then on. **The draft is right less than half the time and that is expected** — HQ
writes these names with eight different shapes, so no rule produces them, which is
why the field is typed at all.

**When a level 3 that already exists is chosen:** the level-4 names already under
it, as a list — `Already under {name}:` — or, when it has none,
`{name} has nothing under it yet.` The empty case is a sentence rather than a
silence, because an absent list cannot be told apart from one that looked and found
nothing. **It is absent entirely for a level 3 this submission is adding**, which
has no children by construction.

**When a level is marked as having no division below it:** one line,
`A level with no division below it is left out of the path.` It is the same
sentence under the level-3 option and under the level-4 checkbox, because it is one
fact.

**When the four levels and a name are settled — the preview, and it is two lines:**

- `Documents will call it {item name}.`
- `It sits at {composed path}.`

**Both, and in that order, and neither is decoration.** The first is the string that
will be frozen onto every purchase order, invoice and delivery for this material.
The second is the path the row will sit at, **and it reads differently from the four
names that were just chosen** — a level marked as having no division drops out of
it, and so does one repeating the level above. Nothing else on the screen says
where the row is being planted, and this is the only place in the app that plants
one.

**This is the one screen that carries a path on purpose.** No document screen does;
`/materials` searches one and does not show it. A redesign may move these two lines
and may not drop either.

**What the preview does NOT carry is the code**, and that is a decision: the codes
are settled by the server when the row is written, so a line promising one here
would be contradicted the moment two people add a path under one branch.

**When a name is already in use:** one amber line under the name field, naming the
category that holds it. **The same sentence the refusal uses** — said while there
is still time to change the box — and it is suppressed while the refusal is saying
it, so one fact is never stated twice on one screen.

**When the form is refused:** a red box above the fields, carrying one sentence.
Six can land there — fields missing, a level 2 that is not in the catalog, a name
another category already has, a path that already exists, a parent with no code
left in the range this office uses, and a code that was taken between the read and
the write. **One box, whatever the reason.** The authorization refusal
`Not authorized.` lands in the same box: the action hands every refusal back the
same way.

**When a category has just been created:** a green line above the form,
`Created {item name} at {code}. It sits at {path}.` **It names the code where the
preview would not**, because by then it is a fact rather than a forecast, and it is
what somebody looks the row up by in Airtable. The form stays on screen and keeps
the parent and the level-3 choice, so a second leaf under the same branch does not
mean picking it again.

**When the reader is not an Admin:** `Not authorized. This page is Admin-only.` and
nothing else.

## What must agree elsewhere

**The level names are the tree's own words**, shared with the category picker on
`/prs/new` and on the signer's edit form. `Level 1` … `Level 4` are what HQ calls
them and what the Airtable columns are named, so a requester asking the office what
to pick and the office adding a path are looking at the same four words. A redesign
that renames them here renames them on three screens.

**`Item Name` is the same word on the same axis.** It is what the request form's
picker previews once a category is settled, what `/materials` heads its rows with,
and what a vendor reads on a purchase order. The field here is where that string is
authored for every material that will ever be under this path.

**The word `Standard` is what a no-division mark stores and this screen never says
it.** 126 of the existing rows carry it, or `Other`, at level 3 or level 4, and the
path formula drops both. The screen asks for the meaning instead, and the preview's
second line is where the reader sees what the mark did. **A redesign must not
surface the stored word as a choice** — what the person is choosing is that nothing
divides the level.

**A level 3 that already exists is reused rather than duplicated**, and that is
invisible on screen by design: choosing one from the list means the new leaf hangs
off the code that is already there. It matters to a redesign only in this way — the
list of existing children is not a convenience, it is what stops two children of
one parent carrying the same name, which would put two indistinguishable options in
front of every requester.

**A category cannot be created from the request form**, deliberately: a requester
who cannot find a category asks the office, and a requester editing the catalog is a
different job. So a missing path means a request that waits, not a form that grows.

**Nothing in the app links here.** Like the three sibling creates, this screen is
reached by typing its address. The place a link belongs is `/materials`' own miss —
the one sentence in the app that tells a reader the catalog has no path for their
words — and `docs/notes/backlog.md` carries that with its condition.

**EVERY AMBER LINE ON THIS SCREEN IS AN OPINION ABOUT A SNAPSHOT, and a redesign
should not make one look like a verdict.** The page hands the whole catalog to the
browser once, so the duplicate-name line, the existing-path line and the list of
children are all answers from the tree as it was when the page loaded. They go stale
the moment anybody else changes the catalog — **measured by deleting a row out of
band: the screen went on listing it, went on claiming its name was taken, and went
on refusing its path, and a reload cleared all three.** Two things follow that a
design has to keep. The lines stay advisory and the submit stays pressable under
them, because the only thing that can refuse is the base. And the direction is safe:
a stale tree can only make the screen refuse something that would succeed, never
accept something that would fail.

**The four admin creates are one pattern:** narrow centered column, a heading of
the form `New {thing}`, required fields, a submit, and a green line on success that
leaves the form ready for another. **This one has an error box**, like
`/admin/disciplines/new` and unlike the Jobs and Vendors forms — its action is
bound through `useActionState`, so a refusal comes back as a value the form renders.
It also carries the only preview and the only computed value among the four.

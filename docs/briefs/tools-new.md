# Add tools

Opens from: `/asset-categories` and `/asset-categories/[categoryRecordId]`, as a dialog over the page that
opens it — it was the page `/tools/new` until #456.
Who reaches it: a site manager on either page (#506) — nobody else is drawn a
control that opens it — and only one assigned to a job can open it.
Which width comes first: **desktop**, and it is the only one: this dialog is
used at a desk and does not support a phone's width (`_shared.md`).

## What it answers

We bought some tools. Get them onto the system so each one can be labeled.

**It picks a kind from the catalog and creates one tracked object per unit
bought (#507).** The office keeps the catalog of tools in Airtable — every kind
the company buys, named by a category, a tool and a size, and marked with a
class — and this dialog never adds to it: it picks one of its rows and creates
one `Assets` row per unit, each with its own minted id. A kind missing from
the catalog is the office's to add. It created the kind as well until #507,
from a name typed here.

**The two tables are not interchangeable, and the screen keeps them apart
without a second noun (#455).** An `Asset Categories` row is a **tool** — the kind, a row of
the catalog, `DEMO Impact Driver 1/4" Hex`. An `Assets` row — the base's
**asset**, which is what this brief calls it — is one physical drill, the
thing a QR label is stuck to, carrying an id that is printed. **On the screen
both are `tool`, which is the design's word**: the search names the kind, and
`Add 5 tools` makes the units. Six of one drill is one tool and six tools added
under it. **Never `tool item` on screen.**

**Picking a tool the company already has is the ordinary case, and so is
picking one nobody has bought yet**: both are rows of the catalog, and what is
added goes under the row picked. Buying more of a kind later adds assets
under the same row.

## What it always carries

**identity.** The heading, `Add tools` (#485) — the word `/asset-categories` and a tool's
own screen open it with, so the two cannot drift.

**action.** Two steps, and the dialog shows one at a time (#507).

- **The first finds the tool.** A choice of category over a search: the
  category reads `All categories` until one is chosen — as the lists' choice of
  job reads `All jobs` — then each category in the catalog. The search
  lists the catalog's tools under the category chosen, five at most — the first
  of them before anything is typed, and those whose name holds what is typed
  after — each with its category beside it while no category is chosen. One tool name can stand
  under two categories, and those are two tools. **Picking one goes on**; Enter
  takes the one tool the search names.
- **The second takes the rest.** The tool picked and its category on the line
  under the title, and beside them `Change`, which goes back to the first step
  with the tool still in the search — picking it again keeps the size chosen.
  Then the size, among that tool's sizes: a tool held in one size has it
  already chosen, one held in several has none chosen (0l). Then how many, a
  whole number of at least 1, capped at 100 per submission. Then the job.
  **Nobody types one anywhere on this axis.** Somebody on one job gets that job
  without being asked; somebody on several picks from their own.

The submit stands on the second step alone, beside `Cancel`; the first goes on
by a pick. It names what it will add by its count — `Add 1 tool`, `Add 5
tools` — and says `Add tools` while the count is one a submission would refuse
(#469).

**evidence.** On the second step, the class of the kind the tool and the size
make — `Class` over `B` — once the size is chosen. **It is stated, not asked**:
the office sets it in the catalog, `A` for a tool that matters more, usually a
dearer one, and `B` otherwise, and no act reads it. A design may not make it a
choice here.

## What it carries only sometimes

**When the reader is not a site manager (#506):** there is no control that
opens it, on either screen, and the action behind it refuses them — the page
they pressed on, drawn again without the dialog, and nothing said. Adding tools
is a site manager's, and `Is Admin` does not make one: the office's flag opens
the office's screens, and this track does not pass through the office.

**When the site manager is assigned to no job:** the dialog does not open. Every
control that would open it is drawn disabled, with `Ask the office to assign
you to a job` before it on its line (#456). **It says ask, not join (#455)**:
nothing in the app lets a person join a job — the office assigns one in
Airtable — so an instruction to join is one the reader cannot follow, which is
why the design's `Join a job to create tools` went back to the design and this
came back. No opener is hidden from them — on either screen — so a site manager
on a tool's own screen sees exactly what one on `/asset-categories` does.
`Assets."Job"` is required, the job comes from the reader's own assignments
with no exception for the office, so an Admin on no job meets this too.

**When the reader is assigned to exactly one job:** the job is already chosen,
in a choice holding that one job.

**When the reader is assigned to more than one:** a choice among their own jobs,
and no other job is offered.

**When it is opened on a tool (#449, #451, #456):** a tool's own screen opens it
on that tool with its `Add tools`, and after a registration that fell short, its
`Add 2 more` opens it on that tool with the count that was not written — the
count those words name (#485). **It opens at the second step with the size
already the tool's (#507)**: the tool's name is the line under the title, there
is no size to choose and no `Change`, so what is added goes under the tool that
screen is about; another tool is picked from `/asset-categories`. The class is stated as
always. The count starts at the one handed over, and at 1 when none is — where
it starts on `/asset-categories` too — and is the reader's to change. **The dialog says
nothing about why the count is filled**: a line saying so would be a second
account of the registration that fell short, which the tool's screen already
gives, and #321 took such lines off every screen. Opening it writes nothing to
the address, so a reload shows the page it was opened over, and the dialog shut.
The job is never carried, so a reader on several jobs chooses one as always.

**When a registration writes anything, the dialog is left (#449).** The reader
lands on the tool's own screen — the tool the assets were written under — on
the page of its list where they begin, with every one of them selected. That
screen, and not this one, is what says what was written: its list names every
id, a reload keeps the selection, and its print control sends exactly those
labels. **This dialog carries no account of what it wrote.** It carried one until
#449 — a list of the minted ids under the form, the only place they appeared
together — and a design must not bring it back: the landing is the account, and
a second one would say it twice.

**When fewer were written than were asked for, or some of what was written has
no recorded registration:** both are said where the registration lands, each in
a dialog of its own over the selection (#459), and the tool's own screen carries
what each says. Neither is in this dialog. **The rows already written are never
undone** in either case, because their ids are spent and a later registration
would re-issue them onto different tools.

**While a registration is on its way (#469):** the submit keeps its color and
its width and, after a moment, draws a spinner in place of its words, saying
`Adding…` to assistive tech (#495); nothing in the dialog takes a press or a
keystroke, and it does not close. **That is the submit at work and
not a submit that cannot act**, and a design must keep the two apart: one that
cannot act is drawn faded with why before it, and this one keeps its full
color, because the press it is waiting on has happened.

**When nothing was written:** one sentence on the line above the actions —
`Couldn't add the tools. Try again.` The dialog stays, and **everything
chosen and typed stays with it** — the tool, the size, the count and the job —
because what the sentence asks for is the same submit again.

**When the catalog no longer offers the tool picked (#507):** the office has
emptied one of its levels or its class, or a second row names the same path,
since the page was drawn. The submission is refused whole, with one sentence on
the line above the actions — `That tool isn't available any more.` — and the
page is drawn again under the dialog, so the dialog's sizes and class are the
catalog's as it now stands and the size can no longer be the one refused. The
dialog stays open with everything else it held.

**When a refusal fires:** a refusal about one field is said under that field,
in the place its help or its note takes, and rings the field — a search that
names no one tool on Enter (`Choose a tool.`), no size chosen (`Choose a
size.`), a count that is not 1 to 100 (`Enter 1 to 100.`), one over the cap
(`Max 100 at a time.`), and a job not chosen or not the reader's; the one about
the whole dialog — nothing written, or the tool no longer offered — takes the
line above the actions (0l, #456). A field's refusal goes when that field is
changed. Every field keeps what was chosen and typed through any of them.

## What must agree elsewhere

**`Asset Categories` and `Assets` are two tables, and the screens name them the
design's way (#455).** A tool, and the tools under it — `items` where a tool's
own screen counts them. The same words govern `/asset-categories`, the tool's own screen
and the asset's, so a word chosen here is chosen for all of them. **The act
is `add` (#485)**, where it was `create` from #455; the code and these briefs
call it registration, which is the code's word, and no string an asset screen
renders may say that. `create` stays where it names something else: the
creation date where a registration lands.

**The catalog's words are the same on every screen that shows them (#507):**
`Category`, `Tool`, `Size` and `Class` here, the list's `Class` and `Category`
columns, and the line under a tool's name on its own screen and on an asset's
— `Class B · DEMO Power Tools > DEMO Jigsaw > T-Shank`. A tool's name is
its tool and its size, `DEMO Jigsaw T-Shank`, so the category is said beside a
name and never inside one.

**The heading is also the word on the controls that open this dialog** —
`/asset-categories`' and a tool's own screen's — and they come from one constant so they
cannot drift. After a registration that fell short, `Add 2 more` opens it too,
from the same constant, naming the count it opens with. This said "the control
that opens this screen", which stopped being the only one at #449, and a tool's
own screen said `Create more of this tool` until #456 took the design's word for
it.

**The cap of 100 is a fact about one submission, not about a tool.** It was
set from what one server invocation could write when each asset cost three
Airtable operations, and since a registration writes in batches a hundred costs
far fewer (#470); what holds it at 100 is what says it — `Up to 100`, `Max 100
at a time.` and the labels' dialog, which prints the largest registration in one
press. The refusal's `at a time` says the rest can follow in another. A design
that reads it as a limit on how many of a kind the company may own would be
wrong.

**What a registration wrote is said by the tool's own screen, where it lands
(#449).** The ids appear together there as a selection, on a screen somebody can
return to and reload; its print control is how their labels are printed; and what
the registration could not do — write all it was asked for, or record the
registration of every asset it wrote — is said there over them, in dialogs
of their own (#459). This dialog's part is the form.

**An asset's id is printed and glued to a tool.** Two rows sharing one id
means two tools wearing one label, which is why nothing in the app deletes a
asset and why the ids a registration writes are worth reading carefully
where it lands.

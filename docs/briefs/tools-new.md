# New tools

Opens from: `/tools` and `/tools/[toolRecordId]`, as a dialog over the page that
opens it — it was the page `/tools/new` until #456.
Who reaches it: anyone signed in who is on either page, with no Role and no Job
scoping (#337) — but only somebody assigned to a job can open it.
Which width comes first: **desktop**. Both widths must work; this one is
drawn first and the phone is what it folds into.

## What it answers

We bought some tools. Get them onto the system so each one can be labeled.

This is the tools track's first write screen and the first screen in the app
that creates a `Tools` row. **One submission does two things at once**, and a
design that separates them would be separating something the site does in one
motion: it names the KIND of tool (one `Tools` row) and it creates one tracked
object per unit bought (one `Tool Items` row each, each with its own minted id).

**The two tables are not interchangeable, and the screen keeps them apart
without a second noun (#455).** A `Tools` row is a **tool** — the kind, the name
a person typed once, `Impact Driver`. A `Tool Items` row — the base's **tool
item**, which is what this brief calls it — is one physical drill, the thing a
QR label is stuck to, carrying an id that is printed. **On the screen both are
`tool`, which is the design's word**: the name field names the kind, and
`Create tools` makes the units. The one sentence that names both at once, the
preview below, counts the second in `items` — the word a tool's own screen
counts them in — rather than a second `tool` meaning something else. Six of one
drill is one tool and six tools created under it.
**Never `tool item` on screen.**

**Typing the name of a tool the company already owns is the ordinary case, not
an error.** Buying more of the same kind later adds tool items under the
existing tool; a second tool with the same name is never created. Case, leading
and trailing space and internal spacing are all ignored when deciding whether
two typed names are the same tool, so `impact driver` and `Impact  Driver` reach
the one that is already there.

## What it always carries

**identity.** The heading, `New tools` — the word `/tools` and a tool's own
screen open it with, so the two cannot drift.

**action.** Three controls, and the submit `Create tools` beside `Cancel`:

- The tool's name, typed. Any name may be typed — the name is the identity,
  and a person buying a kind nobody has registered has to be able to name it —
  and part of one suggests up to five tools that already exist, each with how
  many items it has (#456); picking one types its spelling.
- How many, a whole number of at least 1, capped at 100 per submission.
- The job. **Nobody types one anywhere on this axis.** Somebody on one job gets
  that job without being asked; somebody on several picks from their own.

**evidence.** Whether the typed name names a tool that already exists, stated
under the name whenever no suggestions stand there, and in two voices — `Adds
to Impact Driver, which already has 13 items`, and `Creates a new tool`. The
count is every item the tool has, the figure its own screen heads its list
with. **This is a
preview and not the verdict**: it is decided against a list loaded when the page
opened, and the write asks the base again.

## What it carries only sometimes

**When the reader is assigned to no job:** the dialog does not open. Every
control that would open it is drawn disabled, with `Ask the office to assign
you to a job` before it on its line (#456). **It says ask, not join (#455)**:
nothing in the app lets a person join a job — the office assigns one in
Airtable — so an instruction to join is one the reader cannot follow, which is
why the design's `Join a job to create tools` went back to the design and this
came back. Nothing is hidden — no opener, on either screen — so a reader on a
tool's own screen sees exactly what one on `/tools` does.
`Tool Items."Job"` is required, the job comes from the reader's own assignments
with no exception for the office, so an Admin on no job meets this too.

**When the reader is assigned to exactly one job:** the job is already chosen,
in a choice holding that one job.

**When the reader is assigned to more than one:** a choice among their own jobs,
and no other job is offered.

**When it is opened on a tool (#449, #451, #456):** a tool's own screen opens it
on that tool with its `New tools`, and after a registration that fell short, its
`Create the rest` opens it on that tool with the count that was not written. The
tool is named on the line under the title and is not a field there, so what is
created goes under the tool that screen is about; another tool is named from
`/tools`. The count starts at the one handed over, and at 1 when none is — where
it starts on `/tools` too — and is the reader's to change. **The dialog says
nothing about why the count is filled**: a line saying so would be a second
account of the registration that fell short, which the tool's screen already
gives, and #321 took such lines off every screen. Opening it writes nothing to
the address, so a reload shows the page it was opened over, and the dialog shut.
The job is never carried, so a reader on several jobs chooses one as always.

**When a registration writes anything, the dialog is left (#449).** The reader
lands on the tool's own screen — the tool the tool items were written under — on
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

**When nothing was written:** one sentence on the line above the actions —
`Couldn't create the tools. Try again.` The dialog stays, and **everything
typed stays with it** — the name, the count and the job — because what the
sentence asks for is the same submit again. The tool may exist by then, since a
registration writes the tool before its tool items, and `/tools` and the tool's
own screen already say so in their own words.

**When a refusal fires:** a refusal about one field is said under that field,
in the place its help or its note takes, and rings the field — an empty name
(`Enter a tool name.`), a count that is not 1 to 100 (`Enter 1 to 100.`), one
over the cap (`Max 100 at a time.`), and a job not chosen or not the reader's;
the one about the whole dialog, nothing written, takes the line above the
actions (0l, #456). A field's refusal goes when that field is changed. Every
field keeps what was typed through any of them.

## What must agree elsewhere

**`Tools` and `Tool Items` are two tables, and the screens name them the
design's way (#455).** A tool, and the tools under it — `items` where a tool's
own screen counts them, and where this dialog does. The same words govern `/tools`, the tool's own screen
and the tool item's, so a word chosen here is chosen for all of them. **The act
is `create` on every screen**; the code and these briefs call it registration,
which is the code's word, and no string a tools screen renders may say that.

**The heading is also the word on the controls that open this dialog** —
`/tools`' and a tool's own screen's — and they come from one constant so they
cannot drift. After a registration that fell short, `Create the rest` opens it
too, from the same constant. This said "the control that opens this screen",
which stopped being the only one at #449, and a tool's own screen said `Create
more of this tool` until #456 took the design's word for it.

**The cap of 100 is a fact about one submission, not about a tool.** It comes
from what one server invocation can write — three Airtable operations per tool
item — and the refusal's `at a time` says the rest can follow in another. A
design that reads it as a limit on how many of a kind the company may own would
be wrong.

**What a registration wrote is said by the tool's own screen, where it lands
(#449).** The ids appear together there as a selection, on a screen somebody can
return to and reload; its print control is how their labels are printed; and what
the registration could not do — write all it was asked for, or record the
registration of every tool item it wrote — is said there over them, in dialogs
of their own (#459). This dialog's part is the form.

**A tool item's id is printed and glued to a tool.** Two rows sharing one id
means two tools wearing one label, which is why nothing in the app deletes a
tool item and why the ids a registration writes are worth reading carefully
where it lands.

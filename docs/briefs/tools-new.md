# Register tool items

Route: `/tools/new`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337) — but
only somebody assigned to a job can use it.
Which width comes first: **desktop**. Both widths must work; this one is
drawn first and the phone is what it folds into.

## What it answers

We bought some tools. Get them onto the system so each one can be labeled.

This is the tools track's first write screen and the first screen in the app
that creates a `Tools` row. **One submission does two things at once**, and a
design that separates them would be separating something the site does in one
motion: it names the KIND of tool (one `Tools` row) and it creates one tracked
object per unit bought (one `Tool Items` row each, each with its own minted id).

**The two nouns are not interchangeable and the screen has to keep them apart.**
A `Tools` row is a **tool** — the kind, the name a person typed once, `Impact
Driver`. A `Tool Items` row is a **tool item** — one physical drill, the thing
a QR label is stuck to, carrying an id that is printed. Six of one drill is one
tool and six tool items. **Never a bare `item`**: four other tables on this
base hold item rows.

**Typing the name of a tool the company already owns is the ordinary case, not
an error.** Buying more of the same kind later adds tool items under the
existing tool; a second tool with the same name is never created. Case, leading
and trailing space and internal spacing are all ignored when deciding whether
two typed names are the same tool, so `impact driver` and `Impact  Driver` reach
the one that is already there.

## What it always carries

**identity.** The heading, `Register tool items`.

**action.** Three controls and a submit:

- The tool's name, typed. There is no dropdown of existing tools — the name is
  the identity, and a person buying a kind nobody has registered has to be able
  to name it.
- How many, a whole number of at least 1, capped at 100 per submission.
- The job. **Nobody types one anywhere on this axis.** Somebody on one job gets
  that job without being asked; somebody on several picks from their own.

**evidence.** Whether the typed name names a tool that already exists, stated as
soon as anything is typed and in two voices — one saying the tool item will join
the ones already under that tool, one saying the tool is new. **This is a
preview and not the verdict**: it is decided against a list loaded when the page
opened, and the write asks the base again.

## What it carries only sometimes

**When the reader is assigned to no job:** the form is not there at all. The
screen is the heading and one sentence saying there is no job to register a tool
item against and to ask for a job assignment. Nothing else — no disabled form,
no empty picker, and nothing an address names, so a reader arriving from a
tool's own screen sees exactly what one arriving from `/tools` does.
`Tool Items."Job"` is required, the job comes from the reader's own assignments
with no exception for the office, so an Admin on no job meets this too.

**When the reader is assigned to exactly one job:** the job is stated rather
than chosen, and there is no control for it.

**When the reader is assigned to more than one:** a choice among their own jobs,
and no other job is offered.

**When the address names a tool (#449, #451):** the name starts filled in, and
so does the count when the address carries one; both are the reader's to change
before anything is written. A tool's own screen opens the form this way. Its
`Register more of this tool` names the tool and no count, so the count starts at
1 — where it starts whenever the address names none, or names one the submit
would refuse. After a registration that fell short, its `Register the other 4`
names both, to write the rest. A copied link is a request to register that tool,
or that many of it. **The screen says nothing about why the fields are filled**:
a line reading the address back would show whoever opens a copied link an
account of somebody else's registration, which is the line #321 took off every
screen. A reload opens the same form with the same suggestion and writes nothing.
The job is never carried, so a reader on several jobs chooses one as always.

**When a registration writes anything, the screen is left (#449).** The reader
lands on the tool's own screen — the tool the tool items were written under — on
the page of its list where they begin, with every one of them selected. That
screen, and not this one, is what says what was written: its list names every
id, a reload keeps the selection, and its print control sends exactly those
labels. **This form carries no account of what it wrote.** It carried one until
#449 — a list of the minted ids under the form, the only place they appeared
together — and a design must not bring it back: the landing is the account, and
a second one would say it twice.

**When fewer were written than were asked for, or some of what was written has
no recorded registration:** both are said where the registration lands, beside
the selection, and the tool's own screen carries what each says. Neither is on
this form. **The rows already written are never undone** in either case, because
their ids are spent and a later registration would re-issue them onto different
tools.

**When nothing was written:** one sentence in the refusal slot, saying none of
them were and that registering again writes them under the same tool — `None of
the 5 asked for were written. Registering again writes them under the same
tool.` The form stays, and **everything typed stays with it** — the name, the
count and the job — because what the sentence asks for is the same submit again.
The tool may exist by then, since a registration writes the tool before
its tool items, and `/tools` and the tool's own screen already say so in their
own words.

**When a refusal fires:** one sentence in the one slot the form has for it. Every
refusal this screen can produce arrives in that same slot — an empty name, a
quantity that is not a whole number, a quantity over the cap, a job that is not
the reader's, and nothing written. **Draw the slot once.** Every field keeps what
was typed through any of them.

## What must agree elsewhere

**`Tools` and `Tool Items` are two tables and the screen words follow them.**
A tool, a tool item. The same pair governs `/tools`, the tool's own screen and
the tool item's, so a word chosen here is chosen for all of them.

**The heading is also the word on `/tools`' control that opens this screen**,
and the two come from one constant so they cannot drift. A tool's own screen
opens it too, with `Register more of this tool` and, after a registration that
fell short, `Register the other 4`; their words come from the same constant and
say what they open it with. This said "the control that opens this screen",
which stopped being the only one at #449.

**The cap of 100 is a fact about one submission, not about a tool.** It comes
from what one server invocation can write — three Airtable operations per tool
item — and the refusal tells the reader to repeat the form. A design that reads
it as a limit on how many of a kind the company may own would be wrong.

**What a registration wrote is said by the tool's own screen, where it lands
(#449).** The ids appear together there as a selection, on a screen somebody can
return to and reload; its print control is how their labels are printed; and what
the registration could not do — write all it was asked for, or record the
registration of every tool item it wrote — is said there beside them. This
screen's part is the form, and the address that opens it filled in.

**A tool item's id is printed and glued to a tool.** Two rows sharing one id
means two tools wearing one label, which is why nothing in the app deletes a
tool item and why the ids a registration writes are worth reading carefully
where it lands.

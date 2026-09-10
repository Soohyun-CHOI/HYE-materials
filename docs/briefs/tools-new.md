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
no empty picker. `Tool Items."Job"` is required, the job comes from the reader's
own assignments with no exception for the office, so an Admin on no job meets
this too.

**When the reader is assigned to exactly one job:** the job is stated rather
than chosen, and there is no control for it.

**When the reader is assigned to more than one:** a choice among their own jobs,
and no other job is offered.

**When a registration succeeds:** an account of what was written, and it names
**every minted tool item id, one per line, rather than counting them** — the id
is what gets printed onto a sticker, so a count cannot be acted on. It also
names the tool the items landed under and the job they were filed against. The
account arrives as the submission's own answer, not through the URL: a reload
does not repeat it and a copied link shows a stranger nothing.

**Each of those ids opens the tool item it names (#340)**, so the account is a
way onward and not only a record.

**And the account carries the control that prints their labels (#353)**, which
is the way onward that matters most: a tool item with no label is a row nothing
can reach, so registering is not finished until the stickers exist. It carries
every id it just listed across to the sheet. **This is the only screen that can
offer it for THESE tool items** — the ids are in the submission's answer and
nowhere else — which is why the control belongs beside them rather than on a
list somebody navigates back to.

**When fewer were written than were asked for:** the account additionally says
how many of how many, that what was written stays, and that the remainder can
be registered again — which lands them under the same tool. **The rows already
written are never undone**, because their ids are spent and a later registration
would re-issue them onto different tools.

**When a tool item was written but its registration was not recorded:** those
ids are named separately, with the fact that nothing holds the moment they came
into existence. `Tool Items` carries no created-at field, so the first row of a
tool item's history is the only place that moment lives. **A design must not
fold these into the list above** — they are a different state from a tool item
that registered cleanly, and there is no repair for them.

**When a refusal fires:** one sentence in the one slot the form has for it. Every
refusal this screen can produce arrives in that same slot — an empty name, a
quantity that is not a whole number, a quantity over the cap, a job that is not
the reader's. **Draw the slot once.**

## What must agree elsewhere

**`Tools` and `Tool Items` are two tables and the screen words follow them.**
A tool, a tool item. The same pair governs `/tools`, the tool's own screen and
the tool item's, so a word chosen here is chosen for all of them.

**The heading is also the word on the control that opens this screen.** `/tools`
carries it, and the two come from one constant so they cannot drift.

**The cap of 100 is a fact about one submission, not about a tool.** It comes
from what one server invocation can write — three Airtable operations per tool
item — and the refusal tells the reader to repeat the form. A design that reads
it as a limit on how many of a kind the company may own would be wrong.

**This screen's answer is the only place those ids appear together**, and since
#353 that is what the label sheet depends on. Leaving the page loses the list;
each row is still reachable, since #339 the tool list opens the tool these
landed under and that screen lists every tool item under it. What does not
survive is which of them this submission wrote — so the control that prints
their labels has to be here, on the answer, rather than on a screen somebody
comes back to. It is also the reason the account names every id instead of
counting.

**A tool item's id is printed and glued to a tool.** Two rows sharing one id
means two tools wearing one label, which is why nothing in the app deletes a
tool item and why the ids on this screen are worth reading carefully.

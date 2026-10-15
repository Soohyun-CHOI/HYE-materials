# Add items

Opens from: `/asset-categories` and `/asset-categories/[categoryRecordId]`, as a dialog over the page that
opens it — it was the page `/tools/new` until #456.
Who reaches it: a site manager on either page (#506) — nobody else is drawn a
control that opens it — and only one assigned to a job can open it.
Which width comes first: **desktop**, and it is the only one: this dialog is
used at a desk and does not support a phone's width (`_shared.md`).

## What it answers

We bought some tools. Get them onto the system so each one can be labeled.

**It picks a kind from the catalog and creates one tracked object per unit
bought (#507).** The office keeps the catalog of tools and equipment, on its
own screen (`asset-catalog.md`, #527) and in Airtable — every kind the company
buys, named by a type (`Equipment` or
`Tool`), a category (a field of work, such as machining or welding) and a name,
then a size, a maker and a part number where those apply (#514), and marked
with a class — and this dialog never adds to it: it picks one of its rows and
creates one `Assets` row per unit, each with its own minted id. A kind missing
from the catalog is the office's to add, and **a kind the office has marked
discontinued is not offered (#527)** — the items already under it stay where
they are on every list and page. It created the kind as well until
#507, from a name typed here. **The type changes nothing an asset does**: a
piece of equipment is labeled, checked out, checked in and retired as a tool
is.

**The two tables are not interchangeable, and the screen keeps them apart
without a second noun (#455).** An `Asset Categories` row is a **category** — the kind, a row of
the catalog, `DEMO Impact Driver 1/4" Hex`. An `Assets` row — the base's
**asset**, which is what this brief calls it — is one physical drill, the
thing a QR label is stuck to, carrying an id that is printed. **On the screen
both are `item`, which is the design's word since #519** (`tool` from #455): the
search names the kind, and `Add 5 items` makes the units. Six of one drill is one
row of the catalog and six items added under it. **Never `tool item` on screen.**

**Picking a kind the company already has is the ordinary case, and so is
picking one nobody has bought yet**: both are rows of the catalog, and what is
added goes under the row picked. Buying more of a kind later adds assets
under the same row.

## What it always carries

**identity.** The heading, `Add items` (#519; `Add tools` from #485) — the word
`/asset-categories` and a category's own screen open it with, so the two cannot drift.

**action.** Two steps, and the dialog shows one at a time (#507). **It is 480
wide, and 490 tall while it picks** (0l, 1b; #520): a dialog that searches a list
and picks from it takes 480, and one whose choices change with what was picked
holds its height, so going between the steps never moves its edges.

- **The first finds the name (1b, #514, #520).** A search across the dialog,
  `Search items`, with two chips at its end, `Type` and `Category`, each
  taking one value and saying it once chosen; the categories offered are the
  chosen type's, and choosing a type clears a category it does not hold.
  Under it, every name the catalog holds under what is chosen — the whole list
  before anything is typed, and those whose name holds what is typed after,
  the part typed set heavier: **the name typed in full first, then names
  beginning with it, then names holding it elsewhere**, each group
  alphabetical, so on #517's catalog `wrench` listed `Wrench` before
  `Adjustable Monkey Wrench`, which #528's holds neither of. Each name says at its end what the second step will ask among —
  `18 sizes`, or `3 models` where it asks one size or none — and nothing
  where it asks neither. **One name can stand in two places, and those are
  two names**: the office's `Band Saw` is `Equipment > Machining` and `Tool >
  Power Tool`, so each of its rows says its category after the name in a
  lighter ink; `Pipe Cutter` is a `Cutter` of both types, so its rows say the
  type and the category, `Equipment · Cutter`. A name in one place says
  neither. **Picking one goes on**, by a press or by Enter, which takes the
  name the arrows moved to, or the one name left — nothing is shaded until an
  arrow moves, as 1b draws a typed search (#522; from #520 the first listed was
  shaded and taken once something was typed). From #514 to #520 the type and the category were two
  choices over a search field, `All types` and `All categories` until chosen,
  and the search offered five names with their places beside them.
- **The second takes the rest.** The name picked on the line under the title —
  with where it stands, after a dot, for a name in two places — and `Back` at
  the actions' left, which goes back to the first step with the search as it
  was left; picking the name again keeps what was chosen. It was `Change`,
  beside the name and its whole place on that line, from #507 to #520. Then
  the size and the model (1b, #520), each a row of chips — 36 tall, as wide
  as their longest option and as many to a line as fit, the one chosen on
  the blue face — under its word, `Size` or `Model`. **The size first, and
  only among several**: a name whose rows give one size, or none, is asked
  none, the name saying it already. Its chips are the sizes in order of
  their figures, the metric ones first — `8 mm` to `27 mm`, then `7/16"` to
  `3/4"` — and `None` last, in a lighter ink, where a row gives no size
  beside rows that do. **Then the model, a maker and a part number
  together**, `Lincoln Electric (TIG 205)` — the maker alone, or the part
  number alone, where the row gives one — offered only once the size is
  settled, since a model belongs to a size, makers alphabetically and `Not
  specified` last, in the lighter ink, for a row giving neither. The model
  is asked wherever a row under the size names one, even alone, chosen
  already: it says who made what is added. **One option is chosen without
  asking, and several start with none**, so leaving a choice alone picks
  nothing and the reader says which (#517). The office's `Battery` is why: a
  DeWalt with no size beside two Milwaukees sized M12 and M18, so a size
  started on its empty option would leave DeWalt the one maker, chosen, for
  somebody adding a Milwaukee who never touched the size; here the size is
  asked among `M12`, `M18` and `None`, and the model waits for it. From
  #514 to #520 the step asked `Size`, `Maker` and `Part #` one by one, each
  a choice with its empty option first — `No size`, `No maker`, `No part
  #` — and drew a level of one option as a choice holding it.
- **The fields it always asks sit on the actions** (0l, 1b): how many, a
  whole number of at least 1, capped at 100 per submission, and the job,
  side by side, with the size and the model scrolling above them when there
  are more than the dialog's height holds. **Nobody types a job anywhere on
  this axis.** Somebody on one job gets that job without being asked;
  somebody on several picks from their own.

The first step has no actions (1b): a pick goes on, and the close and Escape
stop. The submit stands on the second, after `Cancel`, with `Back` at the
line's other end. It names what it will add by its count — `Add 1 item`, `Add
5 items` — and says `Add items` while the count is one a submission would
refuse (#469).

**The class is not said here (1b, #520).** The office sets it in the catalog,
`A` for an item that matters more, usually a dearer one, and `B` otherwise,
and no act reads it; a category's own screen and an asset's say it in their
caption. The second step stated it under the levels from #507 to #520. A
design may not make it a choice here.

## What it carries only sometimes

**When the reader is not a site manager (#506):** there is no control that
opens it, on either screen, and the action behind it refuses them — the page
they pressed on, drawn again without the dialog, and nothing said. Adding items
is a site manager's, and `Is Admin` does not make one: the office's flag opens
the office's screens, and this track does not pass through the office.

**When the site manager is assigned to no job:** the dialog does not open. Every
control that would open it is drawn disabled, with `Ask the office to assign
you to a job` before it on its line (#456). **It says ask, not join (#455)**:
nothing in the app lets a person join a job — the office assigns one in
Airtable — so an instruction to join is one the reader cannot follow, which is
why the design's `Join a job to create tools` went back to the design and this
came back. **Since #522 the category list draws none for a reader whose list
stands on no job**: 1a2's no-job state is the heading and its sentence alone,
where #509 drew the opener there disabled too. A category's own screen, which
the design does not draw for such a reader, still draws it disabled with that
sentence. `Assets."Job"` is required, the job comes from the reader's own
assignments with no exception for the office, so an Admin assigned to no job
meets the disabled opener on both screens, the office's list standing on
every job.

**When the reader is assigned to exactly one job:** the job is already chosen,
in a choice holding that one job.

**When the reader is assigned to more than one:** a choice among their own jobs,
and no other job is offered.

**A job is said by its code and its name** (1b, #519): each option the code at
500 and the job's name after it in Ink 3, cut before the code is, and the field
holding a job the same way. The code is what every list on this axis says and
the name is what tells two codes apart for a reader choosing between them.

**When it is opened on a category (#449, #451, #456):** a category's own screen opens it
on that category with its `Add items`, and after a registration that fell short, its
`Add 2 more` opens it on that category with the count that was not written — the
count those words name (#485). **It opens at the second step with nothing to
choose (#507, #520)**: the category's name is the line under the title, it asks
how many and the job and nothing else, and there is no `Back`, so what is added
goes under the category that screen is about; another is picked from
`/asset-categories`. Until #520 it drew each level the category has as a choice
holding its one value, and stated the class. It is 480 wide, as the dialog
sharing its title is, and as tall as what it holds, since it picks nothing
(#520). The count starts at the one handed over, and at 1 when none is — where
it starts on `/asset-categories` too — and is the reader's to change. **The dialog says
nothing about why the count is filled**: a line saying so would be a second
account of the registration that fell short, which the category's screen already
gives, and #321 took such lines off every screen. Opening it writes nothing to
the address, so a reload shows the page it was opened over, and the dialog shut.
The job is never carried, so a reader on several jobs chooses one as always.

**When a registration writes anything, the dialog is left (#449).** The reader
lands on the category's own screen — the category the assets were written under — on
the page of its list where they begin, with every one of them selected. That
screen, and not this one, is what says what was written: its list names every
id, a reload keeps the selection, and its print control sends exactly those
labels. **This dialog carries no account of what it wrote.** It carried one until
#449 — a list of the minted ids under the form, the only place they appeared
together — and a design must not bring it back: the landing is the account, and
a second one would say it twice.

**When fewer were written than were asked for, or some of what was written has
no recorded registration:** both are said where the registration lands, each in
a dialog of its own over the selection (#459), and the category's own screen carries
what each says. Neither is in this dialog. **The rows already written are never
undone** in either case, because their ids are spent and a later registration
would re-issue them onto different assets.

**While a registration is on its way (#469):** the submit keeps its color and
its width and, after a moment, draws a spinner in place of its words, saying
`Adding…` to assistive tech (#495); nothing in the dialog takes a press or a
keystroke, and it does not close. **That is the submit at work and
not a submit that cannot act**, and a design must keep the two apart: one that
cannot act is drawn faded with why before it, and this one keeps its full
color, because the press it is waiting on has happened.

**When nothing was written:** one sentence on the line above the actions —
`Couldn't add the items. Try again.` The dialog stays, and **everything
chosen and typed stays with it** — the name, its size and model, the count and the job —
because what the sentence asks for is the same submit again.

**When the catalog no longer offers the row picked (#507):** the office has
emptied one of its levels or its class, marked it discontinued (#527), or a
second row names the same path, since the page was drawn. The submission is refused whole, with one sentence on
the line above the actions — `That item isn't available any more.` — and the
page is drawn again under the dialog, so the dialog's names, sizes and models
are the catalog's as it now stands and can no longer make the row refused. The dialog
stays open with everything else it held.

**When nothing the search lists holds what is typed (1b, #520):** in the
list's place, `No item matches saw in any category.` — the words typed in the
names' ink, the rest lighter — naming where it looked: the category chosen, or
else the type in lower case, `in tool`, or else any category. It is not a
refusal: the first step refuses nothing. Until #520 Enter on words naming no
one row of the catalog was refused under the field, `Choose a name.`

**When a refusal fires:** a size or a model with nothing chosen is refused at
the right end of its word's line in red — `Choose a size.`, `Choose a model.`,
1b's, and only while it holds none, and the model only once the size is
settled (0l's chips, #520); a refusal about any other field is said under that
field, in the place its help or its note takes, and rings the field — a count
that is not 1 to 100 (`Enter 1 to 100.`), one over the cap (`Max 100 at a
time.`), and a job not chosen or not the reader's; the one about
the whole dialog — nothing written, or the row no longer offered — takes the
line above the actions (0l, #456). A field's refusal goes when that field is
changed. Every field keeps what was chosen and typed through any of them. A
press the dialog refuses for its fields moves focus to the first one refused
(#522), as 1k-b draws the caret in the field a press was refused for.

## What must agree elsewhere

**`Asset Categories` and `Assets` are two tables, and the screens name them the
design's way (#455, #519).** An item, and the items under it — one word for a row of
the catalog and for each labeled one since #519, where both were `tool` and the units
were `items` only where a category's own screen counted them. The same words govern
`/asset-categories`, the category's own screen and the asset's, so a word chosen here
is chosen for all of them. **The act
is `add` (#485)**, where it was `create` from #455; the code and these briefs
call it registration, which is the code's word, and no string an asset screen
renders may say that. `create` stays where it names something else: the
creation date where a registration lands.

**The catalog's words are the same on every screen that shows them (#507,
#514):** `Type`, `Category`, `Name`, `Size`, `Maker`, `Part #` and `Class`
here, the category beside each name on the list — and since #520 the search's
`Search items` and its chips, which the list's band says too — and the line under a category's
name on its own screen and on an asset's — `Tool · Power tools · Class B` (#519;
the list's `Class`, `Type` and `Category` columns and a line saying the class and
the whole path, `Class A · Tool > DEMO Machining > … > GA4570`, until then). An item's name
is its name and its size, then a comma and its maker, then its part number in
parentheses — `DEMO Angle Grinder 4-1/2", DEMO Makita (GA4570)`, `DEMO Angle
Grinder 4-1/2", DEMO Bosch`, `DEMO Drill Press` — each part left out with what
stands before it when the level is empty, so a part number with no maker
follows the size directly, `Angle Grinder 5" (GA5030)`. The type and the
category are said beside a name and never inside one. **A size can carry
parentheses of its own**, the office writing its metric figure beside it,
`5" (127 mm)`; they come before the comma, which is what parts a size from its
maker. **An empty level is empty**: the catalog holds no `N/A` or `-` for a
level that does not apply, and a row carrying one is not offered.

**The heading is also the word on the controls that open this dialog** —
`/asset-categories`' and a category's own screen's — and they come from one constant so they
cannot drift. After a registration that fell short, `Add 2 more` opens it too,
from the same constant, naming the count it opens with. This said "the control
that opens this screen", which stopped being the only one at #449, and a tool's
own screen said `Create more of this tool` until #456 took the design's word for
it — `New tools`, then `Add tools` (#485) and `Add items` (#519).

**The cap of 100 is a fact about one submission, not about a kind.** It was
set from what one server invocation could write when each asset cost three
Airtable operations, and since a registration writes in batches a hundred costs
far fewer (#470); what holds it at 100 is what says it — `Up to 100`, `Max 100
at a time.` and the labels' dialog, which prints the largest registration in one
press. The refusal's `at a time` says the rest can follow in another. A design
that reads it as a limit on how many of a kind the company may own would be
wrong.

**What a registration wrote is said by the category's own screen, where it lands
(#449).** The ids appear together there as a selection, on a screen somebody can
return to and reload; its print control is how their labels are printed; and what
the registration could not do — write all it was asked for, or record the
registration of every asset it wrote — is said there over them, in dialogs
of their own (#459). This dialog's part is the form.

**An asset's id is printed and glued to a tool or a piece of equipment.** Two rows
sharing one id means two of them wearing one label, which is why nothing in the app deletes an
asset and why the ids a registration writes are worth reading carefully
where it lands.

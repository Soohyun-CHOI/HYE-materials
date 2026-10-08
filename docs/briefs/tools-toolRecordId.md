# Tool detail

Route: `/tools/[toolRecordId]`
Who reaches it: anyone signed in, with no Role and no Job gate (#337). What a
reader DOES here — adding tools, and selecting and printing labels — is a site
manager's (#506); everyone else reads the same screen without those controls.
What the list holds first is the reader's (#509): the office's is every tool
item under the tool, anybody else's those on the jobs they are assigned to.
Which width comes first: **desktop**, and it is the only one: this screen is
used at a desk and does not support a phone's width (`_shared.md`).

## What it answers

Which units of this tool exist, and where is each of them?

**One row per physical object.** A `Tools` row is a `tool` — the kind, the
name somebody typed once — and each row here is one drill with one printed
id stuck to it, a `Tool Items` row, which this brief calls a tool item.
**The screen calls each one an `item`, the design's (#455)**: its head
shows the figure alone, `13`, and says `13 items` to assistive tech (#505),
it heads the column of their codes `Tool ID` (#463), and a
sentence about one elsewhere calls it a `tool`. Six of one drill is one tool and six items on this
screen.

**It is reached from the tool list, and a registration lands on it (#449).**
The tool item's own screen is the one a machine opens; this one is opened by a
person who picked a name off a list, or who has just registered tool items of
this tool and arrives with them selected — on the whole of what they start
from, with no job chosen, since what they wrote is on their own job and may be
off one they had chosen (#509). So the reader is at a desk as often
as on a site — printing labels, checking what the company has of something, or
registering more of it (#451).

**The address is a record id and cannot be read.** `Tools` mints no id, the
way `Vendors` and `Materials` mint none, because nothing prints a tool and
nobody quotes one; the name a person typed is the identity, and a name is
not a path. So the URL carries Airtable's own record id and says nothing a
reader recognizes, which is why the browser tab says only `Tool`.

**It is used at a desk, and the tool item's screen is the one on this axis a
phone shows** (#336). The width container lives in the layout with no width,
no padding, no type and no color of a screen's own. Since #460 it holds the
design's rail, and **since #463 this screen is drawn as 1d**: the breadcrumb
and the list's head held still over a table whose column head holds while the
rows scroll, the pager pinned at the foot and the selection bar floating over
it while anything is selected.

## What it always carries

**identity.** The tool's name as the heading, and no heading word beside
it — the shape the tool item's screen takes with its printed id and the
four document detail screens take with theirs.

**action.** A way back to `/tools`: the breadcrumb's one level, `Tools`
behind a chevron (#460), the word the tool item's screen opens its path with
for the same trip.

**action.** A control that opens the registration dialog on this tool,
`Add tools` (#485) — the design's `New tools` from #456, and
`Create more of this tool` from #451. Buying more of a tool the company already has is the same
registration as buying the first, and the dialog puts them under this tool,
which it names under its title — so somebody who knows which tool they bought
starts here rather than typing its name again. **It carries no count**:
nothing on this screen knows how many were bought, so the dialog asks,
starting where it always starts. **Nor does it carry the selection or the
page**: the boxes are for printing, and it opens the same dialog from every
page of the list. It is on this screen for every tool it finds, the one with
nothing under it included, and for every site manager — one assigned to no job
sees it disabled, with `Ask the office to assign you to a job` before it, as
they would on `/tools`. **A reader who is not a site manager is drawn none**
(#506): being one is not something the office assigns on request the way a job
is, so a disabled control with a reason would send them nowhere.

**It is not one of the answers a registration that fell short offers, and a
design must not draw it as one.** Those two are a pair about the registration
the reader has just made (below); this one begins another. Both open one
dialog — `Add 2 more` with the count that was not written, which it names, this
one with none — and `Not now` takes the pair away with the dialog they stand in and
leaves this standing.

**action.** A box on every entry and one for the page — **for a site manager,
who is the one who prints labels (#506)** — and together they say
**which tool items a label run is for** (#443). An entry's box selects that tool
item or takes it out. The page box selects every entry on this page, or, when
all of them are selected already, takes this page out — and a page partly
selected is completed rather than cleared. **The page box reaches this page and
no further, and its name says so:** `Select this page`, Design's (#463), where
it said `Select all on this page` beside the box until the box moved into the
column head with no words of its own. This screen
reads its tool items a page at a time, so a render holds one page of printed
ids and no more, and selecting the whole tool would need a read of every tool
item under it — the cost the paging exists to avoid. It shows whether **none,
some or all of this page** is selected, and that is this page's answer alone,
whatever is selected on another.

**action.** A control that prints labels for **what is selected** (#353, #443),
`Print labels`, in the selection bar (0b, #463). **It names no range, and that
is the point:** the boxes and the count beside it show what a press sends,
which is what the control's words had to say while it sent the page it was on.
It opens the labels' dialog on the selection, in ascending id — it opened
the label screen with it until #457.

**evidence.** The selection bar's count, saying what a press would send —
`3 selected` — with a way out beside it. The words name no noun for what is
selected; see below.

**action.** A choice of job in the head, before `Add tools` (#509): `All jobs`,
which is the whole of what the reader starts from, then each job they may
narrow to by its code — every job for the office, their own for anybody else,
a job with nothing on it included. Choosing one lists that job's tool items
under this tool, from the first page, and keeps whatever is selected. Design is
drawing the control; it is the choice the registration dialog draws until then.

**evidence.** How many tool items this tool has in the reader's scope, `13`,
on the heading's line (`13 items` to assistive tech) — every one for the office,
those on the reader's jobs for anybody else (#509). #326 names this as the fact every list in this app is missing: without it nothing on
screen says whether a reader is looking at everything or at the beginning
of it. **It is a fact about the list rather than about what the company
holds** — which is why a single figure is right here and deliberately
absent from the tool list, where a total would have to decide whether a
retired tool still counts.

**evidence.** One entry per tool item, **newest first** (1d), each carrying
three facts: its printed `Tool Item ID`, which is the way into that tool
item's own screen; its status, one of `In stock`, `Out` or `Retired`; and
the job it is on. Each carries its box as well, for a site manager; see above.

**Newest first moves every row along at each registration, and that was
accepted (#463).** A registration's tool items go to the top, so a link to a
later page names different tool items after one. The selection is printed ids
and moves with nothing. It read oldest first until #463, for that reason.

**evidence.** Which page of the list this is, and how many there are —
stated whether or not there is a second page, because a position that
appears only once a list is long leaves the short case saying nothing. The
pager says which rows the page shows of how many, `1–25 of 38`, and which page
of how many, `Page 1 of 2` (1d, #463).

## What it carries only sometimes

**When a registration has just written tool items of this tool (#449):** the
reader lands here with every tool item it wrote selected — those and no others
— on the first page, where they begin. A registration makes up to a hundred,
so what it wrote can run past this page; the sentence beside the print control then says
how many are not on it, exactly as it does for any selection, and the steps
carry the selection on. **Nothing here says the registration happened**: the
selection is what says it (#321; `_shared.md`, "The arrival is the
confirmation"). What the registration could not do is said by the next two
entries, and only when it happened; the first of them says where the rest
went as well (#495).

**When the registration wrote fewer than were asked for:** a dialog over the
screen, the design's (#455, #459) — how many were not added as its title,
`2 tools couldn't be added`, the tool's name under it, and where the others
are, `The other 3 were added and are selected on this page.` (#495; it was
`3 of 5 tools added` over `2 couldn't be added.` until then) — and two
controls that answer them, in the act's verb since #485. `Add 2 more` names
how many were not written — `Add 1 more` at one — and puts the dialog away
and opens the registration dialog on this tool,
with that count filled in and still the reader's to change there; canceling
that brings this dialog back, since nothing answered it. `Not now` takes the
dialog away, and so do its close and `Escape`. **The two are a pair, and the
pairing is what says what the choice is about**: one goes on adding and the
other ends it, so neither can be read as being about the entry below. It is a
choice rather than a confirmation — `Not now` acts on nothing in the base. At
one, either way, the title says `1 tool couldn't be added` and the sentence
`The other 1 was added and is selected on this page.`

**When some of what it wrote has no first history entry:** a dialog over the
screen (#459) — `2 tools have no creation date` as its title, the tool's name
under it, and `Only the creation date wasn't saved for these 2, and it can't be
added later.` (`1 tool has no creation date`, `… for this one, and it can't be
added later.` at one) — then their ids, in the dialog's summary, then one
control, `Got it` (#455). **Nothing is offered that repairs them, because
nothing does**: a late history entry would state a time that is not when they
were created. `Got it` takes the notice away and nothing else, and so do its
close and `Escape` — it answers no question, which is what still sets it apart
from the entry above. They are also in the list as ordinary entries, selected
with the rest, because they were written and need labels. **A design must not
fold this notice into the list**,
which would read them as created cleanly, **nor give it the entry above's two
answers**, since there is nothing to choose. It can name a tool on another page
of the list.

**When both happened:** each whole, one dialog at a time and the tools with no
creation date first (#459): `Add 2 more` can end on another landing, which
carries only its own registration's account, so the notice is read before the
shortfall is answered. The counts the first gives do not include the second's
tools, which were written. `Not now` answers the first alone and `Got it` the
second alone, so either can go and leave the other — after `Got it` the
shortfall follows, and a reload between them opens whichever is left.

**A step to the previous page** and **a step to the next**, each acting
when there is a page that way and drawn without acting at its own end — 1d's,
where until #463 each was absent at its end.
**A second page exists only for a tool with more than twenty-five tool
items**, and that number counts every registration of the tool rather than
one: registering more of a tool adds to the same list, and one registration
can make up to a hundred. Both steps carry the selection, so what was
selected on one page is still selected on the next, and the job the list is
narrowed to (#509).

**When a job narrows the list (#509):** the head's figure reads `N of M` — the
document lists' words for the same thing — `M` being what the reader started
from; the rows, the pager and the page box are that job's alone, and the
breadcrumb's `Tools` keeps the job. A job with none of this tool's items on it
draws the head and nothing under it, `0 of 91` and the choice saying it; Design
is drawing what that state says. So does a tool whose items are all off the
reader's jobs, before any job is chosen: `No items under this tool` would be
false there. A tool item off the reader's jobs is left off this list and still
opens from its label or a link. A job in the address the reader may not narrow
to is answered with their whole scope and the choice reading `All jobs`.

**When nothing is selected:** no selection bar, 0b's (#463), where until
then a sentence, `Nothing is selected, so there is nothing to print.`, stood
beside a print control drawn and not acting. Every arrival from the tool list
starts here; a registration's arrival does not, and neither does any other
address carrying a selection. **It does not print the page instead** — that
was the control's behavior until #443, and it is exactly what made its range a
sentence rather than something on the screen. The page is one press of the
page box away, and that press brings the bar.

**When something is selected:** the selection bar, 12 above the pager — its
count, a way to clear it, and `Print labels`. The clear, named and tooltipped
`Clear selection`, empties the selection on every page at once, and so does
`Escape` while no dialog is open. The page box already clears one page; this
is the way out of a selection made on pages the reader is no longer on.

**When some of what is selected is not on this page:** the bar says how many
after its count, `3 selected · 1 not on this page`, and says nothing of it
otherwise. A selection outlives a page turn, so this is what reconciles the
count with a page whose boxes show fewer — and it is the only place those tool
items appear until the labels' dialog draws them.

**When more are selected than one print takes:** the bar counts them,
`101 selected`, and the print control does not act, with
`Up to 100 labels per print.` before it behind an info mark, where it said
`One print takes at most 100.` until #495. The labels' dialog reads a hundred
at most (#457), and the label screen printed the first hundred of a longer
run, so a press here would have printed less than it sent. It needs a tool
with more than a hundred tool items, selected across pages.

**When the tool has no tool items at all:** in place of the entries, a
heading and a sentence, `No items under this tool` and
`If you were adding some, it stopped before any were saved.`, and under them a
second, bordered `Add tools` (1d, #463, #485). The sentence said `creating`
until #495, which gave it the act's verb #485 gave the words its issue named.
**This is reachable and is not an error state**, the same way the tool item screen's
missing history is: nothing rolls back, and the row that stands is sound.
The total, the page position, the boxes and the print control are absent
with it; there is nothing to count, no page to be on and nothing to print.
**The control that registers more of this tool stays, and this is where it
matters most**: it is how the tool items a failed registration did not write
get written, under the name that registration found or made. **For a reader
who is not a site manager the heading stands alone (#506)**: the sentence
speaks to whoever was adding, and the opener under it is theirs. Design is
drawing what that reader's empty state says; until then it says nothing more
than the heading, rather than a sentence nobody has written.

**When the reader is not a site manager (#506):** the same screen, every fact
on it, and none of the controls a site manager uses here — no `Add tools` in
the head or under an empty list, no box on an entry or for the page, no
selection bar and so nothing to print, and neither dialog a registration's
landing tells, which speak to whoever added. The column of boxes goes with
the boxes, so the table is `Tool ID`, `Status` and `Job`, the job taking the
room; Design is drawing that list. A selection carried on the address is not
read for them, so it marks no entry and rides no step. Nothing replaces any of
it with a sentence: the screen is theirs to read, and a control is absent
rather than disabled because being a site manager is not something one asks
the office for the way a job is.

**When no tool carries the record id in the address:** the screen is the
heading `Tool not found` and a way back to `/tools`. Nothing on this axis
is gated by role or job, so unlike the request, order and invoice screens
this refusal answers one state — no such tool — rather than standing in
for two.

## What must agree elsewhere

**A page holds twenty-five tool items, the design's figure for the list as
it drew it (#442), and the design settled how the position is expressed
(#463):** which rows the page shows of how many, which page of how many, and
one step in each direction (1d). This is the first paged list in the app. **Twenty-five is the design's to move again** when
the list is drawn again. It replaced ten, an estimate of a screenful made
before any screen was drawn, and it is a design's figure rather than a
measurement — nobody has yet read this list with a real warehouse in
it. **Two ceilings on it are not the design's.** Anything up
to fifty costs the app exactly the same to fetch, and a fifty-first row is
a second read; and a page is how many one press of the page box selects,
where the print control acts on at most a hundred — what one print takes.

**The selection rides in the address (#443), which is what lets it survive a
page turn, a reload and a copied link.** It was the label screen's own
parameter with its own values — printed ids — until #457, and the print control
hands it to the labels' dialog unchanged, so a copied address is a request to
print those labels again rather than an account of anything. It is kept in
ascending id, whatever order the boxes were pressed in, so the labels print as
their ids count up — the list's own order until #463, which turned the list
newest first and left the selection as it was. **A design must not offer
"select all of this tool"**, for the reason this screen never offered
"print all": it is a read of every tool item under the tool. **A
registration's arrival is such an address (#449)**: it carries what the
registration wrote, which is why what it wrote survives a reload.

**A registration's account rides beside the selection on the address it lands
on, and on no other (#449).** It is the two entries above — how many were asked
for and how many of those were not written, and which have no first history
entry — and none of it is a confirmation: the selection is the confirmation,
and these are what it cannot show, the way the invoice screen says how a
delivery was matched to it (#231). A reload of that address tells again what is
still on it, which is true — nothing repairs a missing entry, and the choice
stands until it is answered — until `Not now` takes the first out of the address
and `Got it` the second. **Every address the list itself writes carries the
selection and the job alone**, and while either dialog stands the list behind it cannot be
pressed, so the account leaves the address by being answered. A copied
address carrying them shows them to whoever opens it, if that reader is a site
manager (#506); anybody else is told neither.

**The label screen asked which labels to print until #457, and that was not a
second selection.** Arriving from here, every tool item this selection named
started included there. Excluding one there trimmed that run and did not reach
back into this screen's selection — it was where the whole run was listed at
once, beside the count of labels it printed, for a last decision about the tape.
It stood beside the start position and the sheet count until #467. The two were
different acts and took different words: `Select` here, `Include` there. The
labels' dialog asks nothing, so the selection here is the run.

**Every control that opens the registration dialog takes its words from that
dialog's constant (#451)**, so none can drift from the dialog it opens — the
arrangement the labels' dialog has with the two pages that open it. Two say
the dialog's heading, because both begin a registration: `/tools`' own, which
opens it on no tool, and this screen's, which opens it on this tool. The
fork's says how many it will add, `Add 2 more`, because it finishes one, and
opens it on this tool at that count (#456, #485).

**No word the selection adds names what is selected** — the way the document
lists' pickers say `N selected`. It was written while `tool item` was decided
against appearing with its replacement not yet chosen; #455 chose it, `item` on
this screen, and the selection's words needed nothing from it.

**The status shown here is the same value the tool list counts.**
`Tool Items."Status"` is maintained by the app rather than computed on
either screen, so this page, the tool list and the tool item's own screen
cannot disagree about where a tool item is.

**All three statuses reach this column.** A check-out, a check-in and a
retirement each write the status it shows (#362, #363), so an entry reads
`In stock`, `Out` or `Retired`, and a design draws for three. This said every
entry would read `In Stock` until a later phase, which stopped being true
when those issues wrote the other two; corrected by #443.

**There is no count per status on this screen, and adding one is not
free.** That question belongs to the tool list one level up. Answering it
here would mean reading every tool item under the tool, which is the cost
the paging exists to avoid — this page reads only the entries it draws,
whatever the tool's size.

**The column over each code is `Tool ID`, beside `Status` and `Job` (#463).**
It was `Item` from #455, the design's word then, and `Tool item` before it.
`Status` and `Job` name one field each and are the words the tool item's own
screen already uses for them.

**Every id here links to `/tool-items/[toolItemId]`, and this is where a
registration's ids are listed (#449).** The registration form listed them
under itself until then, where a reload lost them; it keeps no account of its
own now and sends the reader here, where the list survives a reload.

**A tool's name never appears as a path segment**, here or anywhere. The
segment is Airtable's record id: `Tools` mints none, a typed name can hold
any character, and a rename would move the address. This screen stood one
level deeper until #348, when the tool item's own address moved off the
axis and freed the slot.

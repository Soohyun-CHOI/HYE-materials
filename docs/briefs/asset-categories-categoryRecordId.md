# Item detail

Route: `/asset-categories/[categoryRecordId]`
Who reaches it: anyone signed in, with no Role and no Job gate (#337). What a
reader DOES here — adding items, and selecting and printing labels — is a site
manager's (#506); everyone else reads the same screen without those controls.
The list stands on one of the reader's jobs (#509, #520): any job for the
office, one they are assigned to for anybody else, the first by its code until
they move — or on all of them at once, when a reader with more than one chooses
it (#548).
Which width comes first: **desktop**, and it is the only one: this screen is
used at a desk and does not support a phone's width (`_shared.md`).

## What it answers

Which units of this item exist, and where is each of them?

**One row per physical object.** An `Asset Categories` row is a category — the kind, a row
of the catalog the office keeps (#507) — and each row here is one drill with one printed
id stuck to it, an `Assets` row, which this brief calls an asset.
**The screen calls each one an `item`, the design's (#455)**: its head
shows the figure alone, `13`, and says `13 items` to assistive tech (#505),
it heads the column of their codes `Item ID` (#519; `Tool ID` from #463), and a
sentence about one elsewhere calls it an `item` too since #519, where it was a `tool`.
The category list calls a category an `item` as well (#519), so one drill's row there and
its six here are all items; the screens never set the two side by side in a sentence.

**It is reached from the category list, and a registration lands on it (#449).**
The asset's own screen is the one a machine opens; this one is opened by a
person who picked a name off a list, or who has just registered assets of
this category and arrives with them selected — on the job they wrote to (#520),
where what they wrote is drawn, whatever job or jobs the list stood on before.
From #509 until #520 that was the whole of what they start from, with no job
chosen. So the reader is at a desk as often
as on a site — printing labels, checking what the company has of something, or
registering more of it (#451).

**The address is a record id and cannot be read.** `Asset Categories` mints no id, the
way `Vendors` and `Materials` mint none, because nothing prints a category and
nobody quotes one; its place in the catalog is its identity, and a name is
not a path. So the URL carries Airtable's own record id and says nothing a
reader recognizes, which is why the browser tab says only `Item` (`Tool` until #519).

**It is used at a desk, and the asset's screen is the one on this axis a
phone shows** (#336). The width container lives in the layout with no width,
no padding, no type and no color of a screen's own. Since #460 it holds the
design's rail, and **since #463 this screen is drawn as 1d**: the breadcrumb,
the list's head and a table, the pager pinned at the foot and the selection bar
floating over it while anything is selected. **Since #519 the page is one
scroll** (0i): the breadcrumb holds at the top, the head scrolls away under it
and the column head holds under the bar, and once the head has gone the bar
names the category after the path, as 1d draws it; until then the bar and the
head stood still and the rows scrolled alone.

## What it always carries

**identity.** The category's name as the heading, and no heading word beside
it — the shape the asset's screen takes with its printed id and the
four document detail screens take with theirs.

**identity.** Under the heading, what the item is (1d, #519): its type and its
category, `Tool · Power tools`, the values in a darker ink than the line. **It
says what the name cannot**: a name is the item's name and its size, then a
comma and its maker, then its part number in parentheses, `DEMO Welding
Machine, DEMO Miller (Millermatic 255)`, so it says neither which category nor
which type holds it. The type is information — `Equipment` or `Tool` — and
nothing here acts on it. A part the category lacks is left out, and with none
there is no line. It said the class and the whole path from #507 to #519, `Class
B · Tool > DEMO Carpentry > DEMO Jigsaw > T-Shank`, the record header's line
under its title (0n) until the design drew this one, and the class after the
category until #552 took it off the catalog.

**action.** A way back to `/asset-categories`: the breadcrumb's one level, `Tools & Equipment`
behind a chevron (#460), the word the asset's screen opens its path with
for the same trip. **For a reader on more than one job the breadcrumb is a path
instead, `Tools & Equipment / 26-DEMO-01`**, its second level the job the list
stands on, which opens the choice of job (1d, #519; below) — `Tools & Equipment /
All jobs` on all of them (#548).

**action.** A control that opens the registration dialog on this category,
`Add items` (#519) — `Add tools` from #485, the design's `New tools` from #456, and
`Create more of this tool` from #451. Buying more of a kind the company already has is the same
registration as buying the first, and the dialog puts them under this category,
which it names under its title — so somebody who knows what they bought
starts here rather than finding it in the catalog again: the dialog opens at
its second step, each level already this category's (#507, #514). **It carries no count**:
nothing on this screen knows how many were bought, so the dialog asks,
starting where it always starts. **Nor does it carry the selection or the
page**: the boxes are for printing, and it opens the same dialog from every
page of the list. It is on this screen for every category it finds, the one with
nothing under it included, and for every site manager — one assigned to no job
sees it disabled, with `Ask the office to assign you to a job` before it, as
they would on `/asset-categories`. **A reader who is not a site manager is drawn none**
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
**which assets a label run is for** (#443). An entry's box selects that asset
or takes it out. The page box selects every entry on this page, or, when
all of them are selected already, takes this page out — and a page partly
selected is completed rather than cleared. **The page box reaches this page and
no further, and its name says so:** `Select this page`, Design's (#463), where
it said `Select all on this page` beside the box until the box moved into the
column head with no words of its own. This screen
reads its assets a page at a time, so a render holds one page of printed
ids and no more, and selecting the whole category would need a read of every asset
under it — the cost the paging exists to avoid. It shows whether **none,
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

**action.** For a reader on more than one job, a choice of job as the
breadcrumb's second level (1d, #519; in the head until then): it holds the job the
list stands on and opens on `All jobs` and then each job they may stand on by its
code — every job for the office, their own for anybody else, a job with nothing on
it included. Choosing one lists that job's assets under this category, from the
first page, and keeps whatever is selected; choosing `All jobs` lists its assets on
all of them (#548). A reader on one job is drawn no choice. `All jobs` stood first
from #509 as where every list started, which #520 took away; since #548 it is a
choice and not the start.

**evidence.** How many assets this category has on the job the list stands on,
or on all of them (#548), `13`, on the heading's line (`13 items` to assistive tech) (#509, #520). #326 names this as the fact every list in this app is missing: without it nothing on
screen says whether a reader is looking at everything or at the beginning
of it. **It is a fact about the list rather than about what the company
holds** — which is why a single figure is right here and deliberately
absent from the category list, where a total would have to decide whether a
retired one still counts.

**evidence.** One entry per asset, **newest first** (1d), each carrying
four facts: its printed `Asset ID`, which is the way into that asset's
own screen; its status, one of `In stock`, `Out`, `In repair` (#531) or `Retired`, and after an
`Out` who it was checked out to, `Out · Hyunwoo Kang`; its note (#533), the one
line a site manager keeps on it, in Ink 2 and nothing where it has none; and the day it last
changed, `09/22/2026` — the day of its latest scan, retirement or registration,
in the reader's own zone (1d, #520). Each carries its box as well, for a site
manager; see above. On `All jobs` each also carries the job it is on, after its
id (#548; below).

**The note is one line, cut at its column's end and shown whole above its cell
under the pointer (#533)**, as the catalog shows a cut value (1l): it is at most
50 characters, and a row is one line. **A note changes no day**: it is no event,
so writing one moves nothing in the `Updated` column, which says when the item
itself last moved. The status's column is 240 again beside it, as 1d draws it, where
it took the room left from #520 until #533.

**The day is written with its year, which 0h does not ask for in a table
column** — it says `MM/DD` there — and 1d draws it in full; the year stays
because an item can sit on a shelf from one year to the next, and `09/22`
would not say which. **The job each asset is on stood in the day's place from
#463 until 1d drew the day**: where an asset was last scanned is on its own
screen, and a reader on several jobs sees the one the list is narrowed to in
the breadcrumb. **On `All jobs` it is a column again (1d, #548)**, after the
printed id, the job's code in a lighter ink, since the breadcrumb no longer says
it for every row; the note gives up the room. A selection there may hold items on
several jobs, and one print takes them together.

**Newest first moves every row along at each registration, and that was
accepted (#463).** A registration's assets go to the top, so a link to a
later page names different assets after one. The selection is printed ids
and moves with nothing. It read oldest first until #463, for that reason.

**evidence.** Which rows the page shows of how many, `1–50 of 76`, stated
whether or not there is a second page, because a count that appears only once a
list is long leaves the short case saying nothing — the one figure where a page
shows a single row, `1 of 1` — and past one page which page of how many, `Page 1
of 2`, with its steps (1d, 0b; #463, #519, where the page and its steps stood on
every list until #519).

## What it carries only sometimes

**When a registration has just written assets of this category (#449):** the
reader lands here with every asset it wrote selected — those and no others
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
`2 items couldn't be added` (#519; `tools` until then), the category's name under it, and where the others
are, `The other 3 were added and are selected on this page.` (#495; it was
`3 of 5 tools added` over `2 couldn't be added.` until then) — and two
controls that answer them, in the act's verb since #485. `Add 2 more` names
how many were not written — `Add 1 more` at one — and puts the dialog away
and opens the registration dialog on this category,
with that count filled in and still the reader's to change there; canceling
that brings this dialog back, since nothing answered it. `Not now` takes the
dialog away, and so do its close and `Escape`. **The two are a pair, and the
pairing is what says what the choice is about**: one goes on adding and the
other ends it, so neither can be read as being about the entry below. It is a
choice rather than a confirmation — `Not now` acts on nothing in the base. At
one, either way, the title says `1 item couldn't be added` and the sentence
`The other 1 was added and is selected on this page.`

**When some of what it wrote has no first history entry:** a dialog over the
screen (#459) — `2 items have no creation date` as its title, the category's name
under it, and `Only the creation date wasn't saved for these 2, and it can't be
added later.` (`1 item has no creation date`, `… for this one, and it can't be
added later.` at one) — then their ids, in the dialog's summary, then one
control, `Got it` (#455). **Nothing is offered that repairs them, because
nothing does**: a late history entry would state a time that is not when they
were created. `Got it` takes the notice away and nothing else, and so do its
close and `Escape` — it answers no question, which is what still sets it apart
from the entry above. They are also in the list as ordinary entries, selected
with the rest, because they were written and need labels. **A design must not
fold this notice into the list**,
which would read them as created cleanly, **nor give it the entry above's two
answers**, since there is nothing to choose. It can name an asset on another page
of the list.

**When both happened:** each whole, one dialog at a time and the items with no
creation date first (#459): `Add 2 more` can end on another landing, which
carries only its own registration's account, so the notice is read before the
shortfall is answered. The counts the first gives do not include the second's
items, which were written. `Not now` answers the first alone and `Got it` the
second alone, so either can go and leave the other — after `Got it` the
shortfall follows, and a reload between them opens whichever is left.

**A step to the previous page** and **a step to the next**, past one page, each
acting when there is a page that way and drawn without acting at its own end —
1d's, where until #463 each was absent at its end.
**A second page exists only for a category with more than fifty assets**,
and that number counts every registration under the category rather than
one: registering more of a kind adds to the same list, and one registration
can make up to a hundred. Both steps carry the selection, so what was
selected on one page is still selected on the next, and the job the list
stands on (#509).

**When the job holds none of this category's items (#509, #520):** the head and
nothing under it, `0` and the breadcrumb's job saying it, which the design does not
draw: `Nothing added yet` would be false there. The rows, the pager and the page
box are always the job's alone, and the breadcrumb's `Tools & Equipment` keeps the
job. An asset off the job is left off this list and still opens from its label or a
link. A job in the address the reader may not stand on is answered with the first
of theirs, as no job asked is, and so is `All jobs` for a reader with one job or
none. From #509 a list with no job asked stood on all of the reader's jobs, and
one narrowed to a job counted `N of M`; on `All jobs` since #548 the head counts
the category's assets on all of them, a figure and not `N of M`.

**When nothing is selected:** no selection bar, 0b's (#463), where until
then a sentence, `Nothing is selected, so there is nothing to print.`, stood
beside a print control drawn and not acting. Every arrival from the category list
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
count with a page whose boxes show fewer — and it is the only place those assets
appear until the labels' dialog draws them.

**When more are selected than one print takes:** the bar counts them,
`101 selected`, and the print control does not act, with
`Up to 100 labels per print.` before it behind an info mark, where it said
`One print takes at most 100.` until #495. The labels' dialog reads a hundred
at most (#457), and the label screen printed the first hundred of a longer
run, so a press here would have printed less than it sent. It needs a category
with more than a hundred assets, selected across pages.

**When the category has no assets at all:** in place of the entries, the
heading `Nothing added yet` (#519; `No items under this tool` until then), and under
it who fills it — for a site manager `Items show here once you add them.` over a
second, bordered `Add items` (1d, #463, #485, #519). **Since #507 this is a kind
of the catalog nobody has bought yet**, which no list shows — the screen is
reached by its address. The sentence 1d drew under it until #507, `If you were
adding some, it stopped before any were saved.`, spoke of a registration that
stopped between writing the tool and writing its items, which a registration no
longer can, since it picks the kind rather than creating it. The page position,
the boxes and the print control are absent with it; there is nothing to page and
nothing to print, and the head counts `0`. **The control that registers more of
this category stays, and this is where it matters most**: it is how the kind's
first assets are added. **For a reader who is not a site manager, `Items show here
once a site manager adds them.` and no opener (1d, #506, #519)**: the opener is a
site manager's.

**When the reader is not a site manager (#506):** the same screen, every fact
on it, and none of the controls a site manager uses here — no `Add items` in
the head or under an empty list, no box on an entry or for the page, no
selection bar and so nothing to print, and neither dialog a registration's
landing tells, which speak to whoever added. The column of boxes goes with
the boxes, so the table is `Item ID`, `Status`, `Note` and `Updated`, the note taking
the room, as 1d draws it without the box (#533; the status took it from #520, and
`Job` stood in the day's place until then). A selection carried on the address is not
read for them, so it marks no entry and rides no step. Nothing replaces any of
it with a sentence: the screen is theirs to read, and a control is absent
rather than disabled because being a site manager is not something one asks
the office for the way a job is.

**When no category carries the record id in the address:** the screen is the
heading `Item not found` and a way back to `/asset-categories`. Nothing on this axis
is gated by role or job, so unlike the request, order and invoice screens
this refusal answers one state — no such category — rather than standing in
for two.

## What must agree elsewhere

**A page holds fifty assets (#538), and the design settled how the position
is expressed (#463):** which rows the page shows of how many, which page of
how many, and one step in each direction (1d). This is the first paged list in
the app. **Fifty is #538's figure, not the drawing's**: the drawings
still page every list at twenty-five, the figure the design set for the list
as it drew it (#442), which replaced ten, an estimate of a screenful made
before any screen was drawn. Neither is a measurement — nobody has yet read
this list with a real warehouse in it. **Two ceilings on it are not a
choice.** Anything up to fifty costs the app exactly the same to fetch, and a
fifty-first row is a second read, so fifty is the largest page one read
holds; and a page is how many one press of the page box selects, where the
print control acts on at most a hundred — what one print takes.

**The selection rides in the address (#443), which is what lets it survive a
page turn, a reload and a copied link.** It was the label screen's own
parameter with its own values — printed ids — until #457, and the print control
hands it to the labels' dialog unchanged, so a copied address is a request to
print those labels again rather than an account of anything. It is kept in
ascending id, whatever order the boxes were pressed in, so the labels print as
their ids count up — the list's own order until #463, which turned the list
newest first and left the selection as it was. **A design must not offer
"select all of this category"**, for the reason this screen never offered
"print all": it is a read of every asset under the category. **A
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
second selection.** Arriving from here, every asset this selection named
started included there. Excluding one there trimmed that run and did not reach
back into this screen's selection — it was where the whole run was listed at
once, beside the count of labels it printed, for a last decision about the tape.
It stood beside the start position and the sheet count until #467. The two were
different acts and took different words: `Select` here, `Include` there. The
labels' dialog asks nothing, so the selection here is the run.

**Every control that opens the registration dialog takes its words from that
dialog's constant (#451)**, so none can drift from the dialog it opens — the
arrangement the labels' dialog has with the two pages that open it. Two say
the dialog's heading, because both begin a registration: `/asset-categories`' own, which
opens it on no category, and this screen's, which opens it on this category. The
fork's says how many it will add, `Add 2 more`, because it finishes one, and
opens it on this category at that count (#456, #485).

**No word the selection adds names what is selected** — the way the document
lists' pickers say `N selected`. It was written while `tool item` was decided
against appearing with its replacement not yet chosen; #455 chose it, `item` on
this screen, #519 made it `item` on every screen, and the selection's words needed
nothing from either.

**The status shown here is the same value the category list counts.**
`Assets."Status"` is maintained by the app rather than computed on
either screen, so this page, the category list and the asset's own screen
cannot disagree about where an asset is.

**Every status reaches this column.** A check-out, a check-in, a sending for
repair and a retirement each write the status it shows (#362, #363, #531), so an
entry reads `In stock`, `Out`, `In repair` or `Retired`, and a design draws
for four — `In repair` behind 0g's Away, the dashed ring. This said every
entry would read `In Stock` until a later phase, which stopped being true
when those issues wrote the other two; corrected by #443.

**There is no count per status on this screen, and adding one is not
free.** That question belongs to the category list one level up. Answering it
here would mean reading every asset under the category, which is the cost
the paging exists to avoid — this page reads only the entries it draws,
whatever the category's size.

**The column over each code is `Item ID`, beside `Status`, `Note` and `Updated`
(#519, #520, #533).** `Note` is the field's name on the base, `Assets."Note"`, and
the asset's own screen labels the note's field with it. It was `Tool ID` from #463, `Item` from #455, the design's word then,
and `Tool item` before it. `Status` names one field and is the word the asset's
own screen already uses for it. **`Updated` names no field on `Assets`**: it is
the latest `Asset Log` row's `Event At`, read for each entry on the page in one
batch (#520), and `docs/notes/naming.md` carries the row. It took the place of
`Job`, which stands after `Item ID` again on `All jobs` (#548) — the asset's own
screen's word for `Assets."Job"`, where the asset is now.

**Every id here links to `/assets/[assetId]`, and this is where a
registration's ids are listed (#449).** The registration form listed them
under itself until then, where a reload lost them; it keeps no account of its
own now and sends the reader here, where the list survives a reload.

**A category's name never appears as a path segment**, here or anywhere. The
segment is Airtable's record id: `Asset Categories` mints none, a name can hold any
character, and a rename would move the address. This screen stood one
level deeper until #348, when the asset's own address moved off the
axis and freed the slot.

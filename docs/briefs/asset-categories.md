# Tools & Equipment

Route: `/asset-categories`
Who reaches it: anyone signed in, with no Role and no Job gate (#337).
Adding items from it is a site manager's (#506); everyone else reads the same
list without that control. The list stands on one of the reader's jobs (#509,
#520): any job for the office, one they are assigned to for anybody else, the
first by its code until they move — or on all of them at once, when a reader
with more than one chooses it (#548).
Which width comes first: **desktop**, and it is the only one: this screen is
used at a desk and does not support a phone's width (`_shared.md`).

## What it answers

How many of each item does the company have, and how many of them are out?

**An `Asset Categories` row is a category — the kind of tool or equipment, a row of
the catalog the office keeps (#507) — and an `Assets` row is an asset, one physical
object carrying a printed id.** Those are the base's words and this brief's. **The
screens say `item` for both, the design's word since #519**: a row of this list is
an item, and so is each labeled one — `Add items`, `Retire this item`, `Item ID`.
The design had said `tool` for both from #455, and `item` where a category's own
screen counted what is under it. So six of one drill is one row here, six items on
its own screen, and an item in every sentence about any one of them. This brief said
"tool kinds" before #338, which would have invited `Kind` as a word on the screen;
the word is `item`.

**The question is about the fleet rather than about any one item**, which
is why a row carries a count per status, and since #569 the total of what the
company still holds of it. A reader looking for one
particular unit is looking for its printed id, and that is the asset's
own screen, reached by scanning it, from its category's page one level down,
or since #541 by typing the id into this screen's search, which finds the
unit on the list and opens it from there.

**The asset's screen is the only one on this axis used at a phone
width**, with the sign-in a scan can arrive through, and what that means
for the whole design is the fifth constraint in the shared brief. An item is
added and its labels printed at a desk, so this screen is a desk's; an
asset is scanned on site, on a phone, possibly by someone wearing
gloves. The phone is this axis's problem and no other's.

**The width container for every asset screen lives in the layout, not on
the page**, and no width, no padding, no type, no color was chosen for it,
deliberately (#336). Since #460 it holds the design's rail and still nothing
of a screen's own; **since #463 this screen is drawn as 1a** — the list's head
over a table's column head, and a pager pinned at the foot. **Since #519 the
list is one scroll from the top of the column**, its bar the column's height,
the head and the column head held at the top while only the rows pass under
them (0i); until then the rows scrolled alone between the head and the pager.

## What it always carries

**identity.** The heading `Tools & Equipment`, the axis's name on screen
(#513): the office calls each thing it labels and tracks an asset, and the site
calls the same things tools and equipment, so the screen says the site's words.
It was `Tools`, the table's name, the rule that makes the other list screens
`Purchase Requests`, `Purchase Orders`, `Invoices` and `Deliveries`, until the
axis began holding equipment as well. The rail's section for this screen says
the heading's own string, read from it (#460). Beside it on its
line, how many items there are, the figure alone — `17`, with `items` said to
assistive tech after it (1a, #505; `tools` until #519) — a count of the list,
which says nothing about what any row holds.

**action.** The control that opens the registration dialog over this screen
(#456), carrying that dialog's own heading as its word so the two cannot drift
(#338) — `Add items` (#519), `Add tools` from #485 and the design's `New tools`
from #455 — `add` because most registrations add to a kind the company already
has, and since #507 every one adds to a row of the catalog. Every other list screen in the
app opens its create form the same way, as a screen of its own. It is above
the list rather than inside it, because the reader with no items at all is the
one who needs it most. It is a site manager's: for one whose list stands on no
job it is drawn none, as 1a2 draws that state (#522; #509 drew it disabled), for
an office reader assigned to no job it is drawn disabled, with `Ask the office
to assign you to a job` before it, and **a
reader who is not a site manager is drawn none (#506)** — being one is not
something the office assigns on request the way a job is, so a disabled control
with a reason would send them nowhere. **It carries the job the list stands on
(#565)**, which the dialog's job starts on when it is one of the reader's own;
on `All jobs`, or on a job the office views and is not assigned to, the job
starts unchosen (`tools-new.md`).

**action.** For a reader on more than one job, a choice of job at the start of
the band (#509; 1a's head from #519, its band since #566): a chip saying the job
the list stands on behind a pin, opening on `All jobs` and then each job they may
stand on by its code — every job for the office, their own for anybody else, a
job with nothing on it included (#548). Choosing one moves the list to that job,
from the first page, keeping what the band holds; choosing `All jobs` moves it to
all of them, and the chip then says `All jobs`. A reader on one job is drawn no
choice: their list is that job's.

**action.** For the office, `Catalog` before `Export` (1a, #527), led by a book
and with no outline since #566, bordered until then: the way to the catalog's
own screen, `/asset-catalog`, where the office keeps what a registration picks
from. It is drawn in every
state the head takes and for nobody else — a reader who is not the office is
drawn none, since keeping the catalog is a role and not something asked for.

**action.** `Export`, bordered, between `Catalog` and `Add items`, for every
reader of the list (1a, #553), drawn over a list with rows and in neither empty
state: the list as an Excel file. Its first sheet is the list as it stands —
the job it stands on, or all of them, and whatever the band holds — every row
the band leaves rather than the page shown, with the same four counts and the
same total, headed as the list heads them (#569); its
second is every item those counts are made of, one row each, with its id, the
catalog's six levels, its status, its job, who has one that is out, its note and
the day it last changed, as an item's own list says them. The file is named for
the job, or `All jobs`, and the day. Nothing is read until it is pressed. To
assistive tech it is `Export to Excel`, and while the file is made it is busy,
`Exporting…`. What a reader may export is what their list holds: a job they may
not stand on is answered as the list answers it.

**The list starts on one job (#520), and a design may not make it start on
several.** It starts on the first of the reader's jobs by its code — the
office, `Is Admin`, on the first of every job; anybody else on the first of
theirs — and holds the items with an asset on that job, counted over those
assets alone. **From #509 it started from all of the reader's jobs at once**, with
`All jobs` first in the choice, which the design never drew: a site reads its
list for what is on the job it stands on. **Since #548 all of them is a choice
rather than the start**: a reader on several jobs asking how many of a kind they
hold across their sites chooses `All jobs`, and the list holds every item with an
asset on any of those jobs — every job for the office — each counted over those
assets added up. **An item with nothing on the job is on no
list (#507)**, nor on all of them with nothing on any: a row of the catalog nobody
has bought yet for it. An asset off the job still opens from its label or a link;
the list is what a reader is shown, not what they may see.

**action.** Under the head, a band of controls held at the top with it (1a,
0i): the job's chip for a reader on several jobs (above), then a search, `Search items or item IDs`, over each row's name, its category
and its type — every word typed must be in one of them — or, when what is typed
is an item's id, for that item (#541; `Search items` until then), and two chips, `Type` and
`Category`, each listing the values the job's rows hold with how many rows
each would leave, several taken at once. A third, `Class`, went with the class
in #552, and an address still naming one reads as naming nothing. A chip holding one value says it,
`Category Power tools`, and one holding several says how many, `2 selected`,
each with a × that empties it. The categories offered are those under the
types taken. **On `All jobs` a third chip, `Job`, follows them (1a, #548)**:
the jobs the rows have an asset on, by their codes, each with how many rows it
would leave, several taken at once; it leaves the rows with an asset on a job
taken and counts their assets on those jobs alone, and empties with `Clear job
filter`. The band narrows rows already in the browser, so nothing it does
waits on the base — but for who holds an item its search found that is out
(#541) — and what it holds rides the address: a reload, a copied
link and a step to another page all keep it.

**action.** At the band's end, the order the rows stand in (1a, 1a3, #540):
`Name`, where the list starts, or `Recently updated` — each kind by the latest
event among its items on what the list stands on, one job, all of them, or the
jobs the `Job` chip takes — a scan, a check-in, a sending for repair, a
retirement or a registration. A note is no event and moves nothing. The order
rides the address with the band, so a chip, the search, the job's choice, `Clear
all` and a step to another page keep it, and a list opened afresh starts by name.
The export's first sheet stands in the same order.

**evidence.** One row per item, ordered by name — a run of digits read as a
number, so `DEMO Circular Saw 7-1/4"` comes before `DEMO Circular Saw 10"`
(#507) — fifty to a page
(#538; twenty-five, 0b's page of rows, from #463) with the pager under them:
which rows the page shows of how many, `1–50 of 76` — the one figure where a
page shows a single
row, `1 of 1` — and past one page which page of how many and a step each way
that a page at its end draws and does not act (0b, #519). The name is the row's
identity and the whole row is the way into that item's own screen. An item's
name is its name and its size, then a comma and its maker, then its part
number in parentheses — `DEMO Jigsaw T-Shank`, `DEMO Cordless Drill 18V, DEMO
DeWalt (DCD791)` (#507, #514) — so the name is what tells two rows of one name
and size apart, and a design must give it the room.

**evidence.** Beside each name, its category, the catalog's (#507, #514) —
`Power tools`, in a lighter ink, giving its room up before the name does (1a,
#519). The type and the class stood beside it as columns of their own from #507
and #514; the band's chips filter by the type since #520, and a category's own
screen says the type and the category under its name. The class is no longer
the catalog's (#552).

**verdict.** Four counts on every row: how many of that item are
`In stock`, how many are `Out`, how many are `In repair` — away at their
maker (#531) — and how many are `Retired`. This is what the reader came for.
An item in repair is counted there and not in stock: an item holds one status
at a time.

**All four are always there, a zero included, and a design may not drop
one.** A count of nothing is a measurement — "none out" — and an absent
row would read as "not known", which is the distinction between nothing
and no comparison the shared brief already draws. It also means the four
words appear on every row whatever the base holds.

**verdict.** After them, `Total`: how many of that item the company still
holds — `In stock`, `Out` and `In repair` added up, a retired one not
counted (1a, #569). It is the row's last figure, as wide as the counts and
set heavier than them, a zero in the lighter ink theirs takes. On all of a
reader's jobs it adds up the jobs the `Job` chip takes, as the counts do,
and a row found by an item's id keeps it whole. **It is the one reading of
the two a single figure could be, and the counts stay so the other is
there**: what the company has ever bought is the total and `Retired`
together. There was no total from #339 until the design drew one, on the
ground that one figure would have to choose between those readings.

## What it carries only sometimes

**When the job holds no items:** in place of the rows, a heading and a
sentence, `No items yet` and `Each item shows here with how many are in
stock, out, in repair and retired.` — `in repair` since #531, where the files
of 2026-10-15 still name three — and under them a second, bordered `Add items`
(1a, #463, #519). The control in the head is still there, and both are the way to
make one; so is the job's choice, to move to another job, alone in the band where
the list with rows puts it (#566). No search, chip or pager stands over or under
an empty list. **For a reader who is not a site manager,
`No items yet` and who fills it, `Items show here once a site manager adds
them.` (1a2, #519)**, and no opener: both are a site manager's.

**When the reader is on no job** — anybody but the office, with no assignment:
the head is the heading alone, with no figure, and in place of the rows `No job
yet` and `Items show here once the office assigns you to a job.` (1a2, #519). A
site manager among them is drawn no opener at all, as 1a2 draws that state
(#522).

**The shared brief's three empty states all have a producer here.** "Nothing
exists yet" is a job with no items; "nothing you can see" a reader on no job;
"nothing matching your filters" a band that leaves no row (#520): under the
column head and a Rule, `No items match` and what was typed, set in the id's
face — or `No items match these filters` when only chips narrow — and one
bordered control, `Clear search` when the search is all that narrows and
`Clear all` otherwise (1a). No pager stands under it. It was a job chosen with
nothing on it from #509, which the design did not draw.

**When the search names an item's id (#541):** the id whole, `HYE-AST-261019-430`,
or the code its label prints, `261019-430`, in any case and with spaces round
it; a piece of one — `430`, a day's `261019` — is searched for in the names as
any word is, since it stands in many ids. The item is looked for on the job the
list stands on, or on all of the reader's jobs and among those the `Job` chip
takes, and never on a job the reader may not stand on. Found, its row is the
one row left, with the counts it always has, and under the band, held with it,
one line is the way to the item's own screen: its id in the id's face, its
name, its status with the mark an item's list draws it with and, while it is
out, who holds it — the one fact read from the base for it — a dot between
each, and a chevron at its end (1a). Enter in the search opens it too. **The
line is a way there and narrows nothing**: the list's head, chips and pager
count the row, and `Export` holds that row and every item under it. Not found,
the list says so where the rows stood: `No item has the ID` and the id typed, or
on one job `No item on 23-USA-09 has the ID`, naming the job it looked on (Soo's
words, `design-copy-findings.md`), with `Clear search`, or `Clear all` when a
chip narrows too — a chip that leaves the item's row off says it as well.

**When a press of `Export` makes no file (#553, #566):** 0k's failure toast,
centered at the foot of the content area — `Couldn't export.` led by the alert
mark, then `Try again`, which presses `Export` again, and `Dismiss`, a ×, as 1a
draws it. It stays until one of the two is pressed, `Escape` is, or `Export` is
pressed again, and a press that fails again puts it up again; whatever closes
it hands focus back to `Export`. From #553 until the files of 2026-10-23 drew
the failure, the press said `Couldn't export the list. Try again.` before the
button, on its line.

**When the band narrows the list (#520):** the head's figure reads `N of M`, the
document lists' words for the same thing, `M` being every item on the job — the
job is where the list stands rather than a narrowing of it — or on all of them,
which the `Job` chip narrows like any chip (#548). The pager counts
what the band leaves. The pager's steps, the band's own writes, the job's choice
and every row's way into an item keep the job, `All jobs` included; the rail's
`Tools & Equipment` does not, and a row's way in carries none of the band, which
is the list's — so an item's own list opened from `All jobs` stands on all of
them whatever the `Job` chip held. A job in the address the reader may not
stand on is answered with the first of theirs, as no job asked is — their whole
list from #509 — and so is `All jobs` for a reader with one job or none.

**An item with nothing under it is on no list (#507)**: a row of the catalog
nobody has bought yet, whose own screen answers by address. It read as a row of
three zeros on the office's list until then, left standing by a registration
that had stopped between its two writes — which no registration can do since
it stopped creating the kind.

## What must agree elsewhere

**The heading and the link that leads here are the same word.** The root
screen carries `Tools & Equipment` as its fifth link and this screen's heading
is `Tools & Equipment`. That agreement is worth keeping — `Purchase orders` and
`Purchase Orders` are the pair on the same screen that does not have it,
and the shared brief records the disagreement.

**The counts read the same status the asset's own screen
shows.** `Assets."Status"` is maintained by the app, not computed on
either screen, so this list and `/assets/[assetId]` cannot disagree
about where an asset is.

**`In stock`, `Out`, `In repair` and `Retired` are the four statuses this
axis has (`In repair` since #531), and they are not status tones.** The tones in the shared brief are one
closed vocabulary for how far something has got on an axis; reusing one
here would make a word mean a stage on one screen and a location on
another. The words appear as themselves on this screen, so the count is
never carried by color alone.

**Every count can carry a figure.** A check-out, a check-in, a sending for
repair and a retirement each write the status they show (#362, #363, #531),
so a row can read any mix of them and a design draws for all of them. No item
was in repair when #531 merged, so `In repair` read zero on every row then. This said `Out`
and `Retired` would read zero on every row until a later phase, which
stopped being true when those issues wrote the other two events; corrected
by #449.

**One item's own screen is `/asset-categories/[categoryRecordId]`, one level under this
one.** It held the tool ITEM until #348, because a QR code encodes the
whole address and its length decides the symbol's version; a route of its
own carries that now, so the flat slot came free and one tool took it.
**An item's name never appears as a path segment** — the segment is
Airtable's record id, since `Asset Categories` mints none and a name is not a
path — which is also what kept a row somebody names `new` from
colliding with the registration form's route, until #456 made the form a
dialog.

**An asset's screen is `/assets/[assetId]`, off this axis's own
collection**, and the label prints a third address again. None of this
reaches a reader: what they see is a name on this list and a printed id on
the next screen.

**A physical tool or piece of equipment is an `item` on every screen since #519,
as a row of this list is, and never a `tool item` (#455).** It was an `item` on its
category's own screen and a `tool` in a sentence from #455 to #519. This brief said
it was never a bare `item`, because four other tables on this base have
items of their own — a request's, an order's, an invoice's, a delivery's.
That was stricter than the app's own rule for item rows: the modifier
drops where nothing on the screen offers a second kind of item row, and no
asset screen shows any of those four. No string on these screens says
`tool item` since #463, which rewrote the asset screen's not-found heading, the
last one that did; this said the design still had it to rewrite, corrected per
#181 by #519.

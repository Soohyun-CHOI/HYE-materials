# Item detail

Route: `/asset-categories/[categoryRecordId]`
Design: Tools 1d and 1c, on Invoices 0b and 0i.
Who reaches it: anyone signed in, with no Role and no Job gate. What a reader DOES
here is a site manager's: adding items, on the list's own job or on all jobs, to a
kind neither discontinued nor set aside for a level, and selecting and printing
labels, on the list's own job
alone. Everyone else reads the same screen without those controls — a site manager on
another job's list among them.
Which width comes first: **desktop**, and it is the only one: labels are printed at
a desk, so this screen does not support a phone's width.

## What it answers

Which units of this item exist, and where is each of them?

**One row per asset under one category** — one physical object with one printed id,
an `Assets` row — where the category list counted them. The screens call both an
`item`.

**It is reached from the category list, from an asset's breadcrumb, and by a
registration that lands on it** with what it wrote selected, on the job it wrote to.

**The address is Airtable's record id**, since `Asset Categories` mints none and a
name is not a path; the browser's tab names the kind from the row the page reads,
and an id no row carries is answered as no page (below).

## What it always carries

**Which job the list stands on**, as the category list's (`asset-categories.md`):
the first of the reader's own jobs by its code, all jobs for a reader assigned to
none, or whichever job or all jobs the reader chooses. Choosing keeps the selection
and goes to the first page. A job the address asks for that the list does not offer
is answered where the list starts.

**What the kind is**, its type and category from the catalog row, which its name does
not say; a level the row lacks is left out. The type changes nothing an asset does.

**How many assets the kind has on what the list stands on** — a fact about the list,
counting a retired one and, on one job, the job's own assets on loan elsewhere,
where the category list's total counts what the company still holds. So this figure
reads more than that total by as many as are retired, and on one job by those on loan
too.

**One row per asset**, each with its printed id, which is the way to its own
screen; its serial number, nothing where it has none; its status, and after `Out`
who it went to; its note, nothing where it has none; and the day it last changed —
`Assets."Last Event At"`, the moment of its latest event, in the reader's own zone
with its year, since an asset can sit on a shelf from one year to the next. A note
and a serial number are no events and change no day. On all jobs each row also says
its job.

**The order is the reader's** (`LIST_SORTS.items`): newest change first, where the
page starts and a registration lands, so a registration's assets begin the first
page and a scanned one rises to it; or by printed id, the order a label run prints
in. A change of order goes to the first page; a box, a step and the job's choice
keep it, and a visit afresh starts newest first. The day each row says is the moment
it is ordered by.

**A page holds `ASSET_PAGE_SIZE` assets, 50**, and the page says which rows it
shows of how many and, past one page, which page of how many with a step each way.
**Two limits bound that figure, and neither is a page size.** The holders of a
page's assets that are out are read fifty to a query, so a page of more than fifty
with more than fifty out would cost a second query: fifty is that limit exactly.
And a press of the page box selects the page, while one print takes at most
`MAX_LABELS_PER_REQUEST`, 100, so a page larger than that would leave a press of its
box refusing to print.

**For a site manager on the list's job, a box on each row and one for the page**,
which say which assets a label run is for. A row's box selects that asset or takes
it out; the page box selects every asset on this page that has a box — not one on
loan elsewhere — or takes this page out when all of them are selected, and completes
a page partly selected rather than clearing it.
**It reaches this page and no further**: the page hands the list one page of assets,
so selecting the whole kind would need what the page holds to be every asset, and a
kind may hold more than one print takes. **A design must not offer "select all of
this category".** On all jobs and on another job's list there are no boxes.

**While anything is selected, a bar** with the count (`ASSET_LIST_COPY.selectedCount`),
how many of those are not on this page when some are (`ASSET_LIST_COPY.notOnPage`), a
way to clear the selection on every page at once — `Escape` too, while no dialog is
open — and the print control, which opens the labels' dialog on the selection
(`tool-items-labels.md`). Nothing is drawn while nothing is selected: it does not
print the page instead.

**For a site manager on the list's job, or on all jobs while holding a job, the way
to add more of this kind** (`listRecording`): the registration dialog opened on this kind at its second
step, with no count, since nothing here knows how many were bought, and with the
list's job, which the dialog's job starts on when it is one of the reader's own. It
carries neither the selection nor the page. Drawn for nobody else, and nothing says
why. **Drawn on no kind discontinued or set aside for a level** — one the office
discontinued, or a row the catalog sets aside for a level missing or holding a
placeholder — which the same answer asks of the row the page read, so the screen is
the one a reader who may not add sees: the opener's room in the head and, on an
empty kind, the words for anybody else. The boxes stay, since what already stands
under the kind still takes labels. The catalog's one other reason, a second row on a
path, needs every row to see, so such a row's page draws the way to add and its press
is refused.

**What it reads:** 4 operations a view with rows — the session, the category, the
job list and the kind's assets on the scope, a hundred to a query, read whole so
they can be ordered before the page is cut — and one more when any of the page's
assets is out, for who holds them; 3 for a job's empty list and for a kind no row
carries (`docs/notes/tools.md`). The selection is never fetched: a box costs no
operation, and a step to another page is a view like any other.

## What it carries only sometimes

**When a registration has just written assets of this kind:** the reader lands with
every asset it wrote selected and no other, on the first page, where they begin.
**When it wrote everything** it says so once, `ASSET_REGISTRATION_COPY.added`, read
off a mark the dialog left in the tab's own storage and never off the address — a
reload, a copied link or a box press finds none. Nothing else says it happened: the
selection does.

**When it wrote fewer than were asked for** (`ASSET_REGISTRATION_COPY.shortfallHeading`,
`ASSET_REGISTRATION_COPY.shortfall`): a dialog with a pair of answers, one that goes on
adding — the registration dialog on this kind with the count not written filled in
and the job it wrote to (`ASSET_REGISTRATION_COPY.registerOthers`) — and one that ends
it (`ASSET_REGISTRATION_COPY.doneRegistering`). Canceling the registration brings this
back, since nothing answered it. It acts on nothing in the base.

**When some of what it wrote has no first history entry**
(`ASSET_REGISTRATION_COPY.unloggedHeading`, `ASSET_REGISTRATION_COPY.unlogged`): a
notice naming them, with one way to put it away (`ASSET_REGISTRATION_COPY.gotIt`).
**Nothing repairs them, because nothing can**: a late entry would state a time that
is not when they were created. They are in the list as ordinary rows, selected,
because they need labels. A design must not fold this notice into the list, nor give
it the shortfall's two answers.

**When both happened**, the notice first, then the shortfall, one at a time
(`lib/assetRegistration.js:accountToTell`): the shortfall's way on lands on a new
registration's account, so the notice is read before it is answered.

**The account rides the address it lands on, and no other.** A reload tells again
what is still on it; each answer takes its part off the address. Every address the
list writes carries the page, the selection, the job and the order alone, and while
either dialog stands the list behind it cannot be pressed. A copied address carrying
an account shows it to a reader who may add on that list and to that kind
(`listRecording`), and to anybody else neither.

**When more are selected than one print takes:** the bar counts them and the print
control does not act — it still takes focus and says why
(`ASSET_LIST_COPY.printCap`).

**When the job holds none of this kind and another job does**
(`lib/assetListView.js:kindEmptyState`): `ASSET_LIST_COPY.noItemsOn`, naming the job,
and `ASSET_LIST_COPY.chooseAllJobs`, which names the job choice's own word for all
jobs. The head counts none and still offers the way to add to whoever may add.

**When the kind has no assets anywhere:** `ASSET_LIST_COPY.noAssetsHeading`, and who
fills it — `ASSET_LIST_COPY.untilYouAdd` over a second way to add for whoever may add,
`ASSET_LIST_COPY.untilASiteManagerAdds` for anybody else, a site manager on a kind
discontinued or set aside for a level among them. It is a catalog row nobody has
bought yet, which no list shows; the screen is reached by its address. No boxes, bar
or pager stand with it, and **the way to add stays on any other kind**: it is how the
kind's first assets are added.

**When no category carries the record id:** `ASSET_LIST_COPY.pageNotFound` and the
way back to the list (`ASSET_LIST_COPY.backToTools`), answering one state — no screen
on this axis is gated per record.

**On the owning job's list, its assets on loan elsewhere**: each a row whose status
says `On loan` and the job it stands on, with **no box** — its label is that job's to
print. The job that borrowed it lists it as its own, in its own status. On all jobs
nothing is on loan.

## What must agree elsewhere

**The selection rides the address**, in ascending id whatever order the boxes were
pressed in, which is what lets it survive a page turn, a reload and a copied link,
and the labels print as their ids count up. The print control hands it to the labels'
dialog unchanged, so a copied address is a request to print those labels again.

**Every control that opens the registration takes its words from that dialog's
constant**, `ASSET_REGISTRATION_COPY`: the category list's and this screen's, which
begin one, and the shortfall's, which finishes one at the count it names.

**The status here is the field the category list counts and the asset's screen
shows**, `Assets."Status"`, written by the app on every event and computed on no
screen. Every status a screen shows reaches this column.

**There is no count per status here.** It is the category list's question, and Tools
1d draws none; the statuses are in hand, so one would cost nothing.

**Every id links to `/assets/[assetId]`**, and this is where a registration's ids are
listed together — a screen somebody can return to and reload.

**A category's name never appears as a path segment.** A name can hold any
character, and a rename would move the address.

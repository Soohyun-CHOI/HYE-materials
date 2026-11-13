# Equipment & Tools

Route: `/asset-categories`
Design: Tools 1a, 1a2 and 1a3, on Invoices 0b, 0i and 0k.
Who reaches it: anyone signed in, with no Role and no Job gate. Every reader may
stand the list on any job or on all of them. Adding items from it is a site
manager's, on their own job's list and on all jobs; the catalog's way in and its
screen are the office's (`asset-catalog.md`).
Which width comes first: **desktop**, and it is the only one: items are added and
their labels printed at a desk, so this screen does not support a phone's width.

## What it answers

How many of each item does the company have, and how many of them are out?

**A row is an `Asset Categories` row** — a kind of tool or equipment, a row of the
catalog the office keeps — **counted over its `Assets` rows**, one per physical
object with a printed id. The screens say `item` for both; this brief says
category and asset where the two must be told apart. Six of one drill is one row
here and six assets on its own screen.

**The question is about the fleet, not one unit.** A reader after one unit is after
its printed id, which is the asset's own screen — reached by a scan, from its
category's page, or by typing the id or a serial number into this screen's search.

## What it always carries

**Which job the list stands on** (`lib/assetListView.js:assetListScope`): the first
of the reader's own jobs by its code, or all jobs for a reader assigned to none, or
whatever job the reader chooses — any job, or all of them. A job the address asks
for that the list does not offer is answered where the list starts, as an address
naming no job is, so a list never says whether such a job exists; so is all jobs
where there is one job or none. The rail's link carries no job, and every step
the list writes keeps it.

**One row per category with an asset on what the list stands on.** A category with
nothing there is on no list — on all jobs, one nobody has bought yet — and still
opens from its address. An asset off the job still opens from its label or a link:
the scope is what a reader is shown, not what they may see.

**Four counts on every row, a zero included** — `In stock`, `Out`, `In repair` and
`Retired`, the four of `Assets."Status"`'s five that a screen shows, `Deleted` being
shown nowhere — **and a total**, the first three
added up, a retired asset not counted: what the company still holds of the kind.
**A design may not drop a count**: a zero is a measurement, and an absent column
would read as "not known". Both readings a single figure could have stay
available, since what was ever bought is the total and `Retired` together. A
deleted asset is counted nowhere.

**No count for what a job has lent.** A job's own assets standing on another job are
in no column and outside the total — the job they stand on counts them in its own
status and total — and its kinds' screens list them with that job
(`asset-categories-categoryRecordId.md`). A kind whose every asset is on loan keeps
its row, every count zero, and opens on them. On all jobs every asset is counted
once, where it stands.

**The rows are ordered by name**, a run of digits read as a number, or by **the
latest event among the kind's assets** on what the list stands on — a registration,
a check-out or check-in, a sending for or return from repair, a lending or a return
to the owner, or a retirement.
A note and a serial number are no events and move nothing. The order rides the
address and every step keeps it; a list opened afresh starts by name.

**A band narrows the rows already in the browser** — a search, a type and a
category chosen several at a time, and on all jobs the jobs — so it waits on the base
for nothing but the lookups below, and what it holds rides the address: a reload, a
copied link and a step to another page keep it. The head's figure counts every row
on what the list stands on, and `N of M` while the band narrows.

**The search** (`readCategoryList`, `filterAssetCategoryRows`):
- **words** keep a row whose name, category or type carries every word typed;
- **an item's id** — whole, or the code its label prints, in any case, with spaces
  round it — finds that item: its row is the one left, with its counts whole, and a
  line over the rows is the way to the item's own screen, naming its job, its status
  and, while it is out, who holds it — the one fact read from the base for it. Enter
  opens it too. **The line narrows nothing**: the head, the pager and the export
  count the row and every asset under it;
- **a serial number**, whole, in any case: each kind holding it is a row and each
  asset holding it a line, since one number may stand on assets of different kinds;
- **a piece of an id or a number** is searched for as a word, since it stands in
  many.

**An id the rows do not show is asked of every job at once, and a number no row's
assets hold and no row's name answers once the typing rests half a second**
(`SERIAL_ASK_REST_MS`) or on Enter — whatever kept it out: another job, or the band. Found, its line stands over rows
that stay what the band holds and say, by the job they stand on or the filters, that
none of them holds it (`ASSET_LIST_COPY.noIdMatchOn`,
`ASSET_LIST_COPY.noIdMatchFiltered`, `ASSET_LIST_COPY.noSerialMatchOn`,
`ASSET_LIST_COPY.noSerialMatchFiltered`). Found nowhere, an id says
`ASSET_LIST_COPY.noIdMatch`, and on all jobs at once; a number says what words
finding nothing say, since it may be a name. A deleted asset is found on none.

**For a site manager on the list's job, or on all jobs while holding a job, the way
to add items** (`listRecording`): it opens the registration over this screen
(`tools-new.md`), carrying the job the list stands on, which the dialog's job starts
on when it is one of the reader's own. **It is drawn for nobody else, and nothing
says why** — not on another job's list, where a site manager reads as anybody does,
not for a reader who is not a site manager, since being one is not asked for, and
not for a site manager on no job, whom sign-in already asked for a job.

**For the office, the way to the catalog's screen**, in every state the head takes,
and for nobody else.

**For every reader, `Export`**, over a list with rows: the list as an Excel file
(`lib/assetListExport.js`). Its first sheet is the list as it stands — the job or
all jobs, whatever the band holds, every row it leaves rather than the page shown,
in the list's order, with the same counts and total, and on one job one count the
list does not draw, the job's own assets on loan elsewhere
(`ASSET_LIST_COPY.onLoanLabel`), before `Retired`; its second is every asset those
counts are made of, one row each, with its id, its serial number, the catalog's
levels, its status, its job and its owner job, who has one that is out, its note and
the day it last changed. It is named for the job, or all jobs, and the day. Nothing is
read until the press, and a reader may export what their list holds and nothing
else.

**What it reads:** 4 operations a view — the session, every `Asset Categories` row,
the job list and one question of which assets' statuses changed since the server's
last view — and one more per hundred assets the server has not met or last read ten
minutes ago, read again whole; a server's first view asks no question and reads them
all, 10 for 643 (`lib/assetStatusMemory.js`, `docs/notes/tools.md`). A search the rows
cannot answer asks the base, an action of 2 or 3 operations per question
(`app/(assets)/asset-categories/actions.js`).

## What it carries only sometimes

**When the job holds no items** (`ASSET_LIST_COPY.noItemsHeading`): in place of the
rows, the heading and, for whoever adds there, `ASSET_LIST_COPY.noItems` over a second
way to add; for anybody else, `ASSET_LIST_COPY.untilASiteManagerAdds` and no opener.
The job's choice stays, to move to another job; no search, chip, sort or pager
stands with it, and `Export` is not drawn.

**When the band leaves no row:** `ASSET_LIST_COPY.noneMatch` with what was typed, or
`ASSET_LIST_COPY.noneMatchFilters` when only chips narrow, and one control that clears
the search when the search is all that narrows and everything otherwise
(`emptiedListWords`). No pager stands under it.

**When an `Export` press makes no file:** `ASSET_EXPORT_COPY.failed` with a way to
press again and a way to dismiss it. It stays until one is pressed, `Escape` is, or
`Export` is pressed again; a press that fails again says it again, and whatever
closes it while focus is inside it hands focus back to `Export`. While the file is
made the press is busy
(`ASSET_EXPORT_COPY.working`).

## What must agree elsewhere

**The counts read the status the asset's own screen shows.** `Assets."Status"` is
written by the app on every event, not computed on either screen; this list reads it
through a memory each server keeps between views, which asks the base on every view
what changed and holds nothing longer than ten minutes (`lib/assetStatusMemory.js`,
whose header says how current that makes it). The four statuses are
this axis's own words and not the shared brief's status tones, and each is printed
as itself, so a count is never carried by color alone.

**A category's own screen is `/asset-categories/[categoryRecordId]`**, keyed on
Airtable's record id, since `Asset Categories` mints none and a name is not a path.
An asset's screen is `/assets/[assetId]`, and the label prints a third address
(`l-labelCode.md`). None of these is a word a reader is asked to read.

**A row's way into its kind carries the job and none of the band**, which is the
list's: a kind's list opened from all jobs stands on all of them, whatever the job
chip held.

**The band's chips are the catalog screen's too** (`asset-catalog.md`): one reading
over rows of the same shape (`filterAssetCategoryRows`), with the same chip words;
the search's label and the sentence for an emptied list are each screen's own.

**The heading and the rail's link are one string**, `ASSET_LIST_COPY.heading`, read
by `lib/navigation.js`.

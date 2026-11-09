# Add items

Opens from: `/asset-categories` and `/asset-categories/[categoryRecordId]`, as a dialog over the page that opens it.
Design: Tools 1b and 1c, on Invoices 0l.
Who reaches it: a site manager holding a job, from a list standing on one of their
own jobs or on all jobs (`lib/assetListView.js:listRecording`); nobody else is drawn
a control that opens it — not on another job's list, not a site manager on no job,
and not on the page of a kind discontinued or set aside for a level.
Which width comes first: **desktop**, and it is the only one: items are added at a
desk, so this dialog does not support a phone's width.

## What it answers

We bought some items. Get them onto the system so each one can be labeled.

**It picks a row of the catalog and creates one `Assets` row per unit bought**, each
with its own minted id. The catalog — the office's, on its own screen
(`asset-catalog.md`) and in Airtable — names every kind by a type, a category and a
name, then a size, a maker and a part number where those apply. **This dialog never
adds to it**: a kind missing from it is the office's to add, and **a kind the office
has marked discontinued, or a row the catalog sets aside, is not offered by the
search**. The page of one discontinued, or set aside for a level missing or holding a
placeholder, draws no way to add to it. A row discontinued while the dialog is open,
and a second row on a path — set aside too, but only the whole catalog shows it, so
its page still opens the dialog — are refused at the press with
`ASSET_REGISTRATION_COPY.itemGone`. The items already under such a row stay where
they are.
The type changes nothing an asset does.

Picking a kind the company already has is the ordinary case, and so is one nobody has
bought yet: both are rows of the catalog, and buying more later adds assets under the
same row.

## What it always carries

**Two steps, one at a time.**

**The first finds the name.** A search across the catalog's names under a type and a
category, each chosen one at a time — the categories offered are the chosen type's,
and choosing a type clears a category it does not hold. Before anything is typed it
lists every name; after, **every name with a row holding every word typed, in its
name, type, category, size, maker or part number** (`lib/assetCategory.js`). **The names
holding every word come first** — the name typed in full, then names beginning with
it, then names holding it elsewhere — then names holding some of the words, and last
names found by the other fields alone, ranked the same way by the value that found
them; each rank alphabetical. A name its own words did not find says what did. **One
name can stand in two places, and those are two names**, each saying where it stands.
A name whose rows give several sizes says how many, and one with a single size and
several models how many models (`lib/assetRegistration.js:nameOffers`). A press or
Enter picks one —
Enter takes the name the arrows moved to, or the one name left; nothing is shaded
until an arrow moves.

**The second takes the rest.** The name picked, and a way back to the first step with
the search as it was left. Then the size, **asked only among several**, its options in
order of their figures, the metric ones first, and an empty one last where a row gives
no size beside rows that do; then the model — a maker and a part number together —
**offered only once the size is settled**, since a model belongs to a size, in the
catalog's order (`lib/assetCategory.js`), a row naming neither maker nor part number
among the last. **One option is chosen without asking, and
several start with none**, so leaving a choice alone picks nothing and the reader
says which. **A name the search found by a size or a part number opens with that size
or that model chosen**, unless the words found several; a maker found chooses
nothing, since it says who made a model and not which.

**The fields it always asks, how many and the job:**
- **How many**, a whole number from 1 to `MAX_ASSETS_PER_REGISTRATION`, 100, per
  submission. **The cap is about one submission, not about a kind**: the rest can
  follow in another, and the labels' dialog prints the largest registration in one
  press.
- **The job**, from the reader's own and no other, **never typed**. One job is chosen
  without asking. With several, it starts on the job the page it opens over stands
  on, which is one of the reader's (`lib/assetJob.js`), and on all jobs on none. It is
  a starting
  value and nothing more, and the dialog says nothing about where it came from. A job
  is said by its code and its name, listed by code.

**The submission names what it will add by its count**
(`ASSET_REGISTRATION_COPY.submit`), and the heading while the count is one a
submission would refuse.

**What it reads:** nothing of its own. The catalog it picks from is the category
list's read already in hand, and the jobs are the page's. A registration writes its
rows in batches (`lib/airtableBatch.js`), so a hundred costs far fewer operations than
a hundred one at a time; `docs/notes/tools.md` has the figures.

## What it carries only sometimes

**When it is opened on a category** — from a category's own screen, or by a shortfall's
way on — **it opens at the second step with nothing to choose**: the category is the
name, there is no way back, and it asks the count and the job. The count starts at the
one handed over, or 1. **It says nothing about why the count is filled**: the
category's screen already gives that account. Opening it writes nothing to the
address, so a reload shows the page with the dialog shut.

**When a registration writes anything, the dialog is left.** The reader lands on the
category's own screen, on the job it wrote to, with every asset it wrote selected,
from the first page, where they begin. That screen — not this dialog — says what was written and what could
not be (`asset-categories-categoryRecordId.md`). **This dialog carries no account of
what it wrote**, and a design must not bring one back: the landing is the account.
**Rows already written are never undone**, because their ids are spent and a later
registration would re-issue them onto different assets.

**While a registration is on its way:** the submission is busy
(`ASSET_REGISTRATION_COPY.working`); nothing else takes a press or a keystroke, and the
dialog does not close. It is the submission at work, not one that cannot act.

**When a refusal fires:** about a field, under that field, the field marked — a size or
a model with none chosen (`ASSET_REGISTRATION_COPY.levelNoneChosen`), a count that is
not a whole number of at least 1 (`ASSET_REGISTRATION_COPY.quantityInvalid`) or one
over the cap
(`ASSET_REGISTRATION_COPY.quantityTooMany`), a job not chosen
(`ASSET_REGISTRATION_COPY.jobNoneChosen`) or not the reader's
(`ASSET_REGISTRATION_COPY.jobNotYours`). About the whole dialog, over its actions:
- **nothing was written** (`ASSET_REGISTRATION_COPY.noneWritten`): the dialog stays and
  **everything chosen and typed stays with it**, since what the sentence asks for is
  the same submission again;
- **the catalog does not offer the row picked** — emptied, discontinued or duplicated
  (`ASSET_REGISTRATION_COPY.itemGone`): refused whole, the dialog standing with
  everything else it holds;
- **the reader's last job was taken off while it was open**
  (`ASSET_REGISTRATION_COPY.noJob`), the one place that sentence reaches a screen; the
  dialog stays.
A field's refusal goes when the field changes; every field keeps what was chosen and
typed through any of them; a press the dialog itself refuses moves focus to the first
field refused.

**When a reader who is no longer a site manager presses anyway**, through a page drawn
before that changed, the action refuses them and the page is drawn again without the
dialog, nothing said.

**When nothing the search lists holds what is typed:**
`ASSET_REGISTRATION_COPY.noneMatches`, naming where it looked — the category chosen,
or the type, or any category. It is not a refusal: the first step refuses nothing.

## What must agree elsewhere

**Every control that opens this dialog takes its words from
`ASSET_REGISTRATION_COPY`** — the category list's and a category's own, which begin a
registration, and a shortfall's, which finishes one at the count it names — so none
can drift from the dialog it opens.

**The act is `add` on screen and `register` in the code** (`naming.md`); no string an
asset screen renders says registration.

**The catalog's words are the same on every screen that shows them** — the level
words, `ASSET_CATEGORY_COPY.levelLabel`, here, in the category list's band and on the
catalog's screen. An item's name is its name and its size, then a comma and its maker,
then its part number in parentheses, each part left out with what stands before it
when the level is empty (`lib/assetCategory.js`); the type and the category are said
beside a name and never inside one. **An empty level is empty**: a row holding `N/A`
or `-` for a level is not offered.

**An asset's id is printed and glued to the object.** Two rows sharing one id would be
two objects wearing one label, which is why the ids a registration writes are worth
reading where it lands.

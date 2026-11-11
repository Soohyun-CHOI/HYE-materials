# Asset detail

Route: `/assets/[assetId]`
Design: Tools 1f, 1g, 1j, 1k and 1h, Tools 0a, on Invoices 0n and 0l.
Who reaches it: anyone signed in, with no Role and no Job gate, an asset on any job
included — once the sign-in steps have their name and, unless they are the office or
the President, a job, as on every page. Recording on it — the transitions, a loan, the retirement, its serial
number and note, and printing its label — is a site manager's on the job the item is
on (`lib/assetJob.js:recordsOn`). Changing its job and deleting it are the office's
(`Is Admin`), while its history holds its `Created` entry alone. Everyone else reads
the same screen, at both widths, with none of those controls.
Which width comes first: **phone**. Both widths must work: a scan arrives on a phone,
and the desk is what it opens out into.

## What it answers

Which item is this, where is it, what has happened to it — and **can I take it out
or bring it back, right now?** The usual visit is a scan, a glance at the status, one
press, and the camera again for the next item; everything else is read when that
goes wrong.

**This is the only screen in the app a machine opens.** A QR label carries a short
address of its own (`l-labelCode.md`) that redirects here, so this address may move
and the printed one may not. **A code can also be typed**, off a label whose symbol
has worn: case does not matter, and the page moves itself to the canonical address,
so one asset keeps one address.

## What it always carries

**The printed id, and the label prints the end of it.** The base and this page's
title say `HYE-AST-260909-004`; the label says `260909-004`, since the family token
is on every asset and tells none apart, and the desk's breadcrumb ends on that code,
which is what a reader holds against the sticker. **A design may not close that gap by shortening the id**
— the page names a record, and the base holds the long form — **nor by lengthening
the sticker**.

**The status** (`Assets."Status"`): `In stock`, `Out`, `In repair` or `Retired`, and
after it the one value only that status has — who holds an item that is out, the
day one in repair was sent, the day a retired one was retired — each read off the
latest history entry already in hand.

**The job the item is on, under the title** — and at a desk with jobs to choose
between, the breadcrumb's job level as well — and **while it is on loan, the job that
owns it** (`ASSET_COPY.onLoanFrom`). Both are single values: an asset is one unit of one
category and sits on one job. The ways back to the lists stand on the asset's job,
whatever list it was opened from (`listJobFromAsset`).

**Its two details, the serial number and the note** — a maker's number, and the one
line a site manager keeps on it. Each is read by everybody wherever the item has one,
in every status. **Neither is an event**: writing one adds no history entry, moves no
status and no job, and nothing records who wrote it or when. Neither is on the label.
**A serial number is one item's within its kind**: no other item of the same kind,
retired ones included and deleted ones not, may hold it, compared regardless of case
and of the spaces around it.

**The transition**, for a site manager on the item's job: the one the status allows —
check out from `In stock`, check in from `Out`, return from repair from `In repair`
(`ASSET_TRANSITION_COPY.control`) — recorded on the item's own job, which it leaves
the item on. There is never a choice of transition and never a choice of job. A desk
opens a dialog for a check-out and records a check-in and a return on the press; a
phone asks in the foot bar.

**A check-out asks who the item is going to, and a check-in does not.** The people it
names have no account here, so it is free text. **A check-out cannot be recorded
without one**: the press always acts, and a press with nothing but spaces in the
field is refused under it (`ASSET_TRANSITION_COPY.nameRequired`), focus going to the
field. **The names offered are the item's job's recent ones**, not the reader's —
from its hundred latest check-outs with a name — one per person, compared by
`lib/typedText.js:textMatchKey` (trimmed, each run of spaces one, case folded) and
shown in the most recent spelling, newest first; typing narrows them to every name
holding what is typed anywhere, by the same key. How many show before anything is
typed (`RECENT_NAMES_SHOWN`) is a display choice over that list.

**The confirmation is that arriving does not act.** A scan opens the page and one
press is the transition: there is no confirming dialog and there must not be one —
this happens dozens of times a day, and the next press undoes it. The check-out's
dialog asks for the name and confirms nothing.

**More actions**, for whoever has one there:
- **Send for repair**, from `In stock` alone, for a site manager on the job: it asks
  nothing and records at once, as the return that undoes it does. An item that is out
  is checked in first.
- **A loan**, from `In stock`: lending to another job for a site manager on the job
  that owns an item standing there, and returning it to its owner for one on the job
  it was lent to — never both, and nothing is lent on. The lending asks which job;
  the return asks first. While it is lent, the borrowing job's site managers record on
  it as their own and the owning job's read it.
- **Retire**, from `In stock`, `Out` or `In repair`, for a site manager on the job —
  an item that broke on a site, or one its maker gave up on, is retired from where it
  is, since requiring a check-in or a return first would record an event that did not
  happen. It opens a question naming the item; **it takes no input — no reason and no
  job** — and nothing happens until a press inside it. A retirement records on the
  owner job, so an item retired on loan goes back to its owner as it ends.
- **Change job** and **Delete**, for the office, only while the history holds the
  `Created` entry alone (`lib/assetOfficeActs.js`): the item's job and owner job move
  with that entry, and its number, label, status and the entry's moment and recorder
  stay; a deletion lands on the kind's list on the job it was on, and
  the item is shown nowhere again — no list, count, search, export or label run, and
  its address and label read as no item. Its number is never given to another.

**The history**, one entry per `Asset Log` row, newest first: the event, when, and
who recorded it, named in full. **The event is printed as the base stores it** —
`Created`, `Checked out`, `Checked in`, `Sent for repair`, `Returned from repair`,
`Lent`, `Returned to owner`, `Retired` or `Deleted` — the last one only in a deletion
left half done. **A `Checked out` entry carries a fourth fact, who it went to**, and a
loan's two entries their route, from one job to the other; no other entry carries
either. So the shape is decided by the event and not by whether a value is there,
and a design draws one per event rather than an optional extra on all of them. No
other entry names a job, which the page already says.

**The moment is in the reader's own zone, and names none.** It resolves in the
browser, so it appears a moment after the rest of the entry; a design may not
reserve a placeholder that reads as a value, nor assume the facts arrive together.

**At a desk, the label this item's sticker carries**: the labels' dialog's own page,
the same object built once for both, with its printed size (`ASSET_COPY.printsAt`)
and named to assistive tech (`ASSET_COPY.symbolAlt`). It is here to be matched
against the sticker in a hand, not scanned off the screen. **A phone draws no label.**
For a site manager on the job, printing it opens the labels' dialog on this one
label (`tool-items-labels.md`); the page prints nothing itself.

**What it reads:** 5 operations — the session, the asset, its category, its people
and the job list — plus one per fifty history rows, and one more, the job's recent
names, when it offers a check-out: 7 for an item in stock with a short history and 6
on the other paths (`docs/notes/tools.md`). What the status allows is decided from facts in hand and
costs nothing.

## What it carries only sometimes

**A refused press, said where the press was.** A press missing what a field holds —
a check-out with no name, a lending with no job chosen — is answered under that
field, in the dialog or the sheet, which stays; nothing is sent. Every other refusal
is an action's, which draws the page again as it answers, and the sentence stands:
- **at a desk, in the dialog or question that sent it**, over its actions, until the
  reader closes it; what it shows stays what it was opened on, and its commitment is
  turned away and described by the sentence when the page drawn again no longer offers
  the act — or, for a site manager's act, the item is on another job than the one it
  was opened on;
- **for a desk's press with no dialog** — a check-in, a return from repair, a sending
  for repair from the menu — in a toast at the page's foot, until it is dismissed or the
  next press;
- **for a detail at a desk, in its editor's line**, the editor standing and its save
  turned away when the reader may no longer write it or the item moved;
- **on a phone**, the sheet or question that sent it closes and the Notice under the
  status says it — but a detail's sheet keeps its own refusals (too long, a number
  another item holds, a value somebody else changed) and closes only for one about
  whose item it is.

**Which refusal:**

| Case | Said |
|---|---|
| somebody recorded first; names who and when | `ASSET_TRANSITION_COPY.moved` |
| somebody recorded first, with no entry to name | `ASSET_TRANSITION_COPY.someoneFirst` |
| the item is on another job than the page was drawn on | `ASSET_TRANSITION_COPY.movedTo` |
| the reader no longer records on it — taken off its job, or no longer a site manager | `ASSET_TRANSITION_COPY.noPermission` |
| the status allows nothing — somebody retired it first | `ASSET_TRANSITION_COPY.noTransition` |
| the entry was written and the status was not | `ASSET_TRANSITION_COPY.statusNotUpdated` |
| a lending left half done | `ASSET_TRANSITION_COPY.lendHalfDone` |
| a return to the owner left half done | `ASSET_TRANSITION_COPY.returnHalfDone` |
| a lending with no job chosen | `ASSET_TRANSITION_COPY.lendNoneChosen` |
| a check-out with no name | `ASSET_TRANSITION_COPY.nameRequired` |

The two about whose item it is say the same whatever was pressed — a detail's, a
loan's and the retirement's included — and end on what was not saved, as the two about
who got in front do. **A refused press and one
that worked leave the same screen** — a flipped control, a moved status, one more
entry — so the sentence about who got in front names whose entry it is and when, and
names no status, which is directly above it and was just redrawn. **A half-done act is
the one that means something was written**, and pressing again finishes it.

**The office's two acts refuse** something recorded since the page was drawn
(`ASSET_OFFICE_COPY.recordedSince`, `ASSET_OFFICE_COPY.deleteRecordedSince`), a reader
no longer the office (`ASSET_OFFICE_COPY.noAccess`, `ASSET_OFFICE_COPY.deleteNoAccess`),
a job change with none chosen (`ASSET_OFFICE_COPY.jobNoneChosen`), and say a half-done
one (`ASSET_OFFICE_COPY.halfDone`, `ASSET_OFFICE_COPY.deleteHalfDone`) — where the press
was, as above, the commitment turned away when the page drawn again no longer offers
the act. A half-done deletion shows its `Deleted` entry, and its press stays to finish
it. A Save of the job the entry, the item's job and its owner job already hold writes
nothing.

**While an act is on its way** its control is busy (`ASSET_TRANSITION_COPY.working`,
`ASSET_TRANSITION_COPY.retireWorking`, `ASSET_OFFICE_COPY.deleteWorking`); a dialog, a
question or a sheet takes no other press and does not close. The check-out's and the
lending's commitments never wait for what is missing: the press always acts and is
answered under the field.

**When somebody else retires the item first:** the question stays at a desk, says
`ASSET_TRANSITION_COPY.noTransition` and turns its commitment away, the page behind it
drawn as the end; on a phone it closes and the Notice says it.

**For a site manager on the item's job, in every status, a way to write each
detail** (`lib/assetNote.js`, `lib/assetSerial.js`):
- what is kept is trimmed, each run of spaces one, its case as typed; a value that
  comes out as the one there writes nothing; **a field emptied and saved removes the
  value**, and nothing else does;
- **more than 50 characters is refused, and nothing is cut**
  (`ASSET_NOTE_COPY.tooLong`, `ASSET_SERIAL_COPY.tooLong`), the field keeping what was
  typed;
- **a serial number another item of the kind holds is refused by naming that item**
  (`ASSET_SERIAL_COPY.takenBy`), read again from the base as the press saves; the
  sentence goes once the field no longer holds the number refused;
- **a value somebody else changed while this one was typed** is refused
  (`ASSET_NOTE_COPY.changedFirst`, `ASSET_SERIAL_COPY.changedFirst`), the page drawn again
  with theirs and what was typed still in the field, so a second press writes over it
  knowingly;
- a field's clear empties that field alone; it removes nothing until it is saved.
A reader who may not write meets the values, and nothing where there is none.

**For a reader who records nothing here**, nothing where the controls would be, and
nothing said — no transition, no loan, no retirement, no detail editing and no
printing — a site manager on another job or on none, and anybody who is not a site
manager. The status, the job, who holds an item that is out and the whole history are
theirs as anybody's. A press made on a page drawn while they recorded is refused where
it was pressed, as above — the item moved, or no longer theirs to record — and the
page is drawn again for who they are now, with nothing written. The office still meets
its two acts on an item nothing has happened to.

**When the status allows no event** — `Retired`, which the retirement puts an item
in — a desk draws nothing in the actions' place, and a phone's foot bar says
`ASSET_TRANSITION_COPY.noTransition` to a site manager on the job. It says what the
item is and nothing of what may still be written: its details are writable still.

**A `Checked out` entry written before the app asked for a name shows the fourth fact
empty.** Those rows exist and are not repaired — writing a name onto them now would
state something nobody recorded. A blank fact reads as a defect upstream, shown
rather than hidden.

**When the asset has no history at all:** `ASSET_COPY.noHistory`. **This is reachable
and is not an error**: a registration writes the asset and then its first entry, and
a failure between the two leaves exactly this. Nothing repairs it, since a later entry
would state a time that is not when it was created.

**When no asset carries the code:** `ASSET_COPY.notFoundHeading`. At a desk it names
the code asked for (`ASSET_COPY.notFoundCode`) with the way back to the list
(`ASSET_COPY.backToTools`); on a phone it says `ASSET_COPY.notFoundScanned` and offers
**no way back** — a phone came from a scan, and the next thing it does is scan again.
It answers one state, no such asset: no screen on this axis is gated per record. A
deleted asset reads the same.

**When the host makes the symbol too large for the label stock:** the rail says
`ASSET_COPY.symbolTooLargeNote` in place of the drawing and its size, and the labels'
dialog draws no page for it. **A design that keeps the drawing and drops this
sentence makes the page claim a label nothing prints.**

**There is no such thing as an asset whose label is missing.** A label is a pure
function of the id, so every asset has one; whether a sticker is on the object is
what the person holding it can see, and the app does not record it.

## What must agree elsewhere

**The status here is the value the two lists count**, `Assets."Status"`, written by the
app on every event rather than computed on any screen, so the three cannot disagree;
and it is the value this screen's controls move.

**The job on a history entry is where the asset was after that event**
(`lib/assetStatus.js:JOB_SOURCE_OF_EVENT`): a scan, a repair and a deletion the item's
own job, which they leave it on; a lending the job chosen; a return the owner job; a
retirement the owner job, or the item's own where it has none; a registration the
registering site manager's. It is stored at that moment and never looked up again —
but for the office's job change, which moves a `Created` entry standing alone — so the
column of jobs down a history is the record of where the item was, and nothing stores
a former job.

**The facts on an entry are invariants of the base.** The event is one of the closed
set above; every row has its job; who recorded it is written on every path that
appends one; a `Checked out` row has a place for who it went to and no other row
does, empty only on the rows written before the app asked. A design that hides one is
hiding a defect upstream.

**An action says what it did by arriving.** No banner, no toast and nothing in the
address for a transition that worked: the status has flipped, an entry heads the
history, and the control reads the other way.

**The two tables are not interchangeable.** An `Asset Categories` row is the kind, whose
name heads this page; an `Assets` row is this object with this printed id. Both are an
`item` on screen, and no sentence sets the two side by side.

**Every way in survives a reload**: a scan of the label, through the short route; a
kind's list, whose ids link here; and the category list's search, whose line for an
id or a serial number opens it — straight away when one item is all it finds.

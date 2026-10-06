# Tool item detail

Route: `/tool-items/[toolItemId]`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Which width comes first: **phone**. Both widths must work; this one is
drawn first and the desktop is what it opens out into.

## What it answers

Which tool is this one, where is it, what has happened to it — and **can I take
it out or bring it back, right now?** Since #363 it also answers the last
question anybody asks about a tool: **this one is finished, take it off the
books.**

**That last one is why anybody opens this screen twice a day.** A project
starts with somebody scanning their job's tools out one at a time and ends
with them scanning back what returned, so the visit is: confirm the id
against the sticker, read the status, press once, and open the camera for
the next tool. Everything else on the page is read when that goes wrong.

**This is the only screen in the app a machine opens.** A QR code on a sticker
glued to the tool carries this address, and a phone camera is what will follow
it. Nothing else here is reached that way — every other detail screen is reached
from a list — and two things follow for a design.

**The reader is holding the object.** They are on a site, probably in gloves,
looking at a drill and at a phone. They already know which tool they scanned;
what they came for is where it is supposed to be and what has happened to it.

**The label does not carry this address, and that is what lets this one be
readable.** A QR encodes the whole URL, so the printed address is a short route
of its own, `/t/[labelCode]`, which redirects here and has a brief of its own.
This page took the name its collection gives it once that separation existed
(#348). The printed address is what may not move; this one may.

**A code is also printed in characters a person can read**, for a symbol that
has been scratched or painted over, so the second way here is somebody typing
it. Case does not matter when they do; the page then moves itself to the
canonical form of the address, so one tool item keeps one address.

**It is drawn the design's way since #463**: 0n's record page at a desk (1c,
1d) and 1f's app screen on a phone. What follows says what each width carries
and which decisions in the drawing a later design may not undo.

## What it always carries

**identity.** The tool's name as the heading — the record's name, as 0n and 1f
draw a record page — and the `Tool Item ID` beside it: under the heading at a
desk, set in the id face with the job after it, and in the top bar on a phone,
where the screen opens. A tool item whose tool did not resolve is headed by its
id. It was the `Tool Item ID` as the heading, and nothing else, until #463.

**The id is no longer the same string as the one on the sticker, and the
confirmation still works (#411).** The label prints `260909-004` where the page
reads `HYE-TL-260909-004`, so what a reader matches is the end of the id rather
than the whole of it — and at a desk the breadcrumb above the heading ends on
the printed code itself. That is what the seven dropped characters were worth:
every tool item carries them, so they confirmed nothing, and what is left on the
sticker is exactly the part that tells one tool item from another. **A design
may not close the gap by shortening the id** — this screen names a record and
the base holds the long form — **and it may not close it by lengthening the
sticker**, which is the whole of #411.

**verdict.** Where the tool item is: its status, one of `In stock`, `Out` or
`Retired`, behind the mark 0g gives it — a solid dot, a ring, the ring struck
through. This is what the reader came for. **A value only one state has stands
after it**: who holds a tool that is out — the name its latest entry checked it
out to — at both widths, and at a desk the day a retired one was retired.

**evidence.** The tool it is one of, which is the heading, and the job it is
on, which a desk states under the heading. A phone states it on each history
entry, and its foot bar states the job the next event will be recorded on.
Both are single values, never lists — a tool item is one unit of one tool and
sits on one job.

**action.** The one transition the status allows — `Check out` from `In stock`,
`Check in` from `Out` — and the job the event will be recorded on. There is
never a choice of transition: the status decides which one. **A desk asks it in
the header**, on the right and centered on the heading's line: the press or
the dialog it opens (1c, 1d). **A phone asks it in the foot bar** (1f): the job
as a pill, for a check-out a field for who it goes to, and the press, at the
foot of the screen and riding on the keyboard. **They are one transition in two
drawings**: a phone on its side is wide enough to draw the desk, and a dialog
left open as it turns upright closes, the job and the name it was given
standing in the foot bar (#495).

**A CHECK-OUT ALSO ASKS WHO THE TOOL IS GOING TO, AND A CHECK-IN DOES NOT.**
At a desk the check-out's dialog asks it under the job, in a field labeled
`Checked out to` that reads `e.g. Jane Doe` while it is empty (#458). On a
phone the foot bar's field reads `Checked out to` behind a person's mark. The
people it names have no account here, so it is free text rather than a picker
over a list of users. **A check-out cannot be recorded without one.** The
dialog's `Check out` cannot act until the field holds a name; **the foot bar's
press always acts, and a press with no name is answered under the field**,
`Enter a name to check out.`, as 1g draws it — and a press with no job chosen
is answered under the pill the same way, both at once when both are missing.
Nothing is written either way. A field of nothing but spaces is the same
refusal.

**Below the phone's edge, touching the name field opens a sheet**, titled with
the field's words, with the system keyboard up. A name can be typed there or
picked from the list below it, and both are the same value as the field behind.
It closes by picking, by its own `Done`, by the keyboard's done key, by
`Escape`, on its handle and on what lies behind it, and focus returns to the
field. **Opening it is a press rather than a focus** — returning focus to the
field would otherwise reopen it. **At a desk there is no sheet**: the field is
the one the registration types a name in (1j), and the list opens under it. The
pill opens 1f's job sheet the same way for a person on several jobs; for a
person on one it states the job and opens nothing.

**The list of names is headed `Recently at this job`** while nothing is typed,
and holds the people that job has recently handed tools to, most recent first.
**One entry per person however their name was typed** — `Mike R` and `mike r`
are one, shown in the most recent spelling — and **it is the chosen job's list,
not the reader's**: a person with two assignments sees it change as the job
does. Typing narrows it, matching anywhere inside a name and ignoring case and
spacing, and once a fragment is typed the list is no longer the recent names,
so the head goes and each name shows the part that matched (#495). **A few are
shown before anybody types and the number is a display choice over the whole
list**, so a design may set it: a name below the cut is one keystroke away
rather than absent.

**When that job has handed out nothing yet:** one sentence in place of the
entries in the phone's sheet, `No tools have gone out on this job yet.`, and
at a desk no list under the field. **This is the first handout of a project
rather than an error**, and it is the one screen that fills it. **Before a
job is chosen the list is absent rather than empty** — heading and all —
because it is about a job and there is not one yet, and so is a list a typed
name has narrowed to nothing (#458).

**The confirmation is that arriving does not act.** A scan opens the page, the
page states the id and the status, and one press is the transition. There is no
confirming dialog and there must not be one: this happens dozens of times a day,
and every confirmation in this app that IS a dialog is for something that cannot
be undone — a withdrawal, a deletion. A check-out is undone by the check-in the
same control offers a moment later. **The dialog a desk's check-out opens asks
and does not confirm** (#458): the job and the name are what its row needs, and
a check-in on one job, which needs neither, still records on the press. A
check-in on several jobs opens the same dialog for its job alone, with none
chosen — and on a phone the pill starts with none chosen the same way.

**While the event is on its way the control says so (#469, #463):** the press,
the dialog's commitment or the foot bar's press keeps its color and its width
and, after a moment, draws a spinner in place of its words, saying
`Checking out…` or `Checking in…` to assistive tech — at both widths since
#495 — and nothing beside it takes a press. That is
not the commitment that cannot act yet — drawn faded until the job and the name
are given — and a design must keep the two apart.

**action.** `Retire this tool`, behind `More actions` — at a desk a 32 icon
button beside the transition, named by its tooltip, and on a phone the 48
button at the top bar's right end (1c, 1f). At a desk it is the menu's one
item, in 0f's destructive red, and opens a dialog. **On a phone the menu ends on
the reader's account** — `Sign out` over their email, under a rule — since a
phone has no rail to name the reader in, and where the page offers no
retirement it holds the account alone (Tools 0a, #495). It is offered from
`In stock` and from `Out` alike — a tool that broke on a site is retired from
there, and requiring a check-in first would put an event in the history that
did not happen.

**THE TWO CONTROLS MUST NOT READ AS THE SAME WEIGHT, AND THREE THINGS STOP
THEM.** One of them is pressed dozens of times a day and the other is that
tool item's last. The first is where each is: the transition is the filled
button a desk's header and a phone's foot bar end on, and the retirement is an
item in a menu behind an icon, one press further away (#463). The second is
structural: the transition records on its press or opens the fields of an act
the next scan undoes; the retirement OPENS a question naming the tool, with a
red commitment (#458), so choosing it does nothing until a press inside the
dialog. The third is the wording: `Check out` names no object and `Retire this
tool` does. **A later design may move either and may not undo these** — in
particular it may not make the retirement a one-press submit, and it may not put
the two at a size and prominence that says they are the same kind of act.

**THE DESIGN PUT THE RETIREMENT IN A MENU, AND THIS IS WHAT THAT PLACEMENT IS
FOR.** A mis-press on it was already caught: it opens a dialog instead of acting,
and the dialog states what becomes true before anything happens. **So placement
is the second guard and not the only one**, and the menu adds no third — no
further confirmation, no disclosure inside the dialog. What the menu buys is the
mis-press made less likely in the first place: a phone's foot bar holds only the
act a scan is for, and the top bar's button is where a person goes looking for
the rarer one.

**What the dialog carries**, in this order: a heading that asks with the tool's
name — `Retire DEMO Rotary Hammer?` for that tool — and the tool item's id under
it (#458), an account of what becomes true, and the two ways out, `Retire tool`
and `Cancel` — the confirm names what it retires, as the opener does (#455). The
account is the design's since #458, `It will be removed from inventory, and no
more check-outs or check-ins can be recorded. This can't be undone.`: the tool
item stops counting as something the company holds, nothing more can be
recorded against it, and nothing undoes it. That its row and its whole history
stay, the third fact #363 wrote, is what the page goes on showing once the
status is the end. **That account is the point of the dialog rather than
decoration**: it is the same voice the three deletion confirmations use, and
the shared brief calls it copy doing work a visual cannot.

**It takes no input of any kind — no reason, and no job.** A design must not
add a field to it. It is a sentence and two ways out, and that is the whole of
it.

**It asks for no reason, and that is a decision rather than a gap.** A required
reason on this event was recorded as a rule for a long time and was dropped:
one of its two grounds went when `Lost` left the status vocabulary, and the
other — that the act cannot be undone — is what the dialog itself now bears.
A design must not add a free-text field back; there is no field behind it.

**THE JOB IS NOT ASKED FOR HERE, AND THE SCREEN ASKS IT ONCE.** The transition
has a job choice because a scan is the person handling the tool, so where they
are is where it goes. Retiring moves nothing, so the row records where the tool
item already was. **A design must not put a second job control on this
screen**: the first version of this dialog had one, and one screen asking the
same question twice let the two answers disagree. For the same reason the
dialog does not restate the inherited job either, and it carries no line about
moving the tool item to another job — that sentence says the tool has gone
somewhere, and a retirement is not a move.

**The job is already chosen when the person has one and chosen by them when they
have several, and it is the same control either way** — at a desk a choice
holding that one job, as the registration's is, and on a phone the pill stating
the job with no sheet to open (#458, #463). Nobody types a job anywhere on this
axis, and the two cases must not become two layouts. **If the office takes away
the job a reader chose before they press**, the press is refused and the job
starts again as it started — the one job left already chosen, or none of
several (#469) — in the dialog and in the foot bar alike.

**The transition has no heading.** The two blocks below it name things —
`History`, `Label` — and a heading over the act would have to name it in the
abstract, which is a word the app does not say. The control names itself.

**THE TOUCH TARGETS ARE THE DESIGN'S, AND THEY ARE THE FIRST IN THE APP THAT ARE
FUNCTIONAL RATHER THAN AESTHETIC.** Every other control in this app is clicked
with a mouse at a desk. These are pressed on a phone, on a site, by somebody who
may be wearing gloves, and the design sets them (Tools 0a): the foot bar's press
50 tall and the screen's width, every target at least 48 square — the pill's
reaches up into the bar's room above it — and the menu's row 48. **A target too
small to hit in gloves is not an inelegance** — it is a transition somebody
writes on paper instead, and the app then holds nothing — so a later design may
not shrink these below the phone's Target.

**evidence.** At a desk, the label this tool item's sticker carries, in the
record rail beside the history: the label's own page as the labels' dialog
draws it, at twice its size on the Field ground, with **the print size in
text** under it — `Size`, `11 × 12 mm`, and `Symbol` with the symbol's own
figure — and a control that prints it. **A phone draws no label**: a label is
printed at a desk, and the phone's screen is for the scan.

**Why it is here decides how it is drawn.** It is here so a reader can SEE what a
replacement sticker will carry and match it against the one in their hand — not to
be scanned off the screen. Somebody who typed the id because the sticker had worn
through is already on this page, so a scan of the screen would return them where they
are. **So it has no size of its own**: it is drawn at whatever reads in its place
(0p), which is the dialog's preview scale, and the printed size is a fact the two
figures state rather than a size the drawing keeps. Until #463 the symbol alone was
drawn at its printed size with a line saying so.

**It is named for assistive tech**, `QR label for this tool`, as an image: the
code under the symbol is nothing the heading says, so it takes a name rather than
hiding. The string sat in the page's copy with nothing drawing it from #352 to
#463.

**action.** A control that prints this tool item's label, `Print label`. It opens
the labels' dialog on this one label (#457), rather than printing the page — that
dialog owns the label's page and the print rule, so printing the page would be a
second layout of one label.

**It does not say `reprint`, and the reason is that the screen cannot know.**
Nothing in this base records whether a sticker was ever printed or stuck on, so a
control promising a re-print would state something the app cannot check — and the
two readers are after the same act anyway: one whose label has worn through, and
one printing a label for the first time.

**evidence.** A history, one entry per `Tool Log` row, **the newest first** (1c,
1f) — the latest scan is the one a reader standing over the tool came to check.
It read oldest first until #463. Each entry carries four facts and always all
four — the event, when it happened, the job it happened on, and who recorded it.
**There is no fifth and nothing is ever absent** but on a check-out, below.

**Each width lays an entry out its own way, and neither labels a fact.** At a desk
the event heads the entry and one line under it says when, on which job and
`by` whom. On a phone the event stands alone at 16, each value under it on its
own line — the job behind a pin — and the moment and who recorded it last. Who
recorded it is named in full, first and last name, as a place naming who did
something is (#463).

**The event is printed as the base stores it: `Created`, `Checked out`,
`Checked in` or `Retired`.** Each is the design's word: `Created` was
`Registered` until #455, and the two scans were `Checked Out` and `Checked In`
until #463 took the design's sentence case. The base renamed each value in
place, so every entry says the new word and none says an old one. **The case
is this axis's own** — the materials screens still print theirs in title case,
`In Review`, `Sent to Vendor` — because a status's screen word and its base
value are one string, and an axis takes the design's words when the design
settles them (`naming.md`).

**The instant renders as a date and a time to the minute, in the design's
notation** — `09/14/2026` with its slashes dimmed and the time after it with no
comma, as every screen in the app writes one since #463. What an entry carries
is a moment somebody reads, and seconds are finer than the resolution a tool
moves at.

**It is the reader's own zone, and that is why no zone is named (#374).** The
moment resolves against the phone in the reader's hand rather than against the
server, so there is nothing to convert and nothing to label — the same reason a
phone's own clock carries no zone. **A design may assume the reader's zone here.**

**It appears a moment after the rest of the entry**, because only the browser can
say what zone the reader is in and it cannot say so until the page is
interactive. Until then the entry's other facts are there and this one is
blank. A design may not reserve a placeholder that reads as a value, and it may
not assume the facts arrive together.

## What it carries only sometimes

**A line saying the transition moves the tool item to another job**, under the
dialog's job at a desk. It appears only when the job the event will be recorded
on is not the job the tool item was last scanned on — which is a tool that has
been carried to another site, and is recorded as it happened rather than
refused. **This is the one place two `Job` values meet on the page with
different values under one word**, and the line is what stops that reading as
a mistake. **A phone's foot bar draws no such line** (1f): its pill states the
one job the event goes on.

**A refusal of the press, under the status in the title block** — a phone's
notice and a desk's refusal line (1g) — or above the dialog's actions while a
dialog stands open for it (#458). Those that reach it: someone else has
already recorded something, so the press was not saved; the job submitted is
not one of the reader's; the tool item carries no such id; and the event was
recorded but the tool item's own status was not updated. The last is the only
one that means something was written, and its sentence says so — the reader is
told the event is safe, what everybody else will read until it is fixed, and
that pressing again fixes it. Ordinarily nothing stands there.

**EVERY REFUSAL ARRIVES ON A FRESHLY RENDERED PAGE, AND THAT IS WHAT THE FIRST
SENTENCE IS WRITTEN AGAINST.** The status, the control's direction and the
history are all re-read and re-drawn in the same moment the sentence appears,
so the screen under a refusal is never the screen the reader pressed on. It
also means a refused press and a successful one leave the SAME screen — a
flipped control, a moved status, one more history entry — and the only visible
difference is whose entry it is. So the sentence names the person and the
moment, the design's (1g) since #463: `Jisoo Park already checked this out on
10/05/2026 8:50 AM. Your check-out wasn't saved.` — who recorded the latest
entry, in full, and that entry's own moment in the reader's zone, written as
every date on the screen is. It says `already` since #495, as the design's
final files do. **A design may not treat it as an aside.** It is the one thing
distinguishing two outcomes that otherwise look alike, it is read on a phone in
one hand, and it names no status because the status is stated directly above it
and was just refreshed.

**The retirement's dialog, which is closed until `Retire this tool` is chosen.**
The page behind it stays legible, and it closes by `Cancel`, by `Escape`, by its
close at a desk and on a press behind it as a phone's sheet, with focus returning
to `More actions`; the confirm takes it away with the page's offer, and focus
goes to the page's heading (#458). It does not close while a confirmation is in
flight, and while it is, the commitment keeps its red and its width, a spinner
in place of its words and `Retiring…` said to assistive tech (#495), and
nothing else in it takes a press (#469). It carries a refusal slot of its own, in
case a refusal ever lands while it is open. **What happens today when somebody
else retires the tool item first is that the dialog goes** — the refusal
re-renders the page, the page has nothing to offer a retired tool item, and the
dialog disappears with its menu; what the reader is left looking at is the
status saying it is the end.

**For a reader assigned to no job, a sentence where the controls would be**:
in the header's right at a desk and in the foot bar on a phone. Both controls
are absent, not disabled — a control the action would refuse is a promise the
screen cannot keep. **The status, the job and the history are still shown to
that reader**: what varies is whether they can act, never what they can read.

**A tool item whose status allows nothing** offers nothing. `Retired` is the only
such status, and it is reachable — the retire control is what puts a tool item
there. **A desk draws nothing in the actions' place** (1c); a phone's foot bar
says `Nothing more can be recorded here.` (1f), and the sentence names no status,
since the status stands above it.

**A history entry is four facts, and a `Checked out` entry is five.** The fifth
is who the tool went to: `Checked out to Dana K` at a desk, the `to` in Ink 3,
and on a phone the name on its own line behind a person's mark. **It is decided
by the event and not by whether a value is there**: every `Checked out` entry
carries it and no other entry does, so a design may lay out two fixed shapes and
must not treat the fifth as an optional extra on all of them. There used to be a
genuinely optional note here, usually absent; the field it read is gone, and
this is not it returning.

**A `Checked out` entry written before the app asked for a name shows the
fifth with nothing in it.** Those entries exist on this base and are not
repaired — writing a name onto them now would state something nobody
recorded. A blank in any of the five reads the same way: a defect upstream,
shown rather than hidden.

**When the tool item has no history at all:** one line in place of the entries,
`No history yet`, the design's (1c, 1g). **This is reachable and is not an
error state.** Registration writes the tool item and then its first log row, and
a failure between the two leaves exactly this; the row is sound, with its id,
its status and its job. There is no repair, because a log row written later
would state a time that is not when the tool item was created.

**When no tool item carries the code in the address:** the heading `Tool not
found`, the design's (1l, 1g). At a desk, centered in the column, a sentence
naming the code asked for in the id face — `No tool has the code
HYE-TL-260909-099. Check it against the label.` — and `Back to Tools`. On a
phone, under the top bar naming the code in Ink 3, a mark and one line,
`No tool has this code. Check it against the label and scan again.`, **and no
way back**, as 1g-c draws it: a phone came from a scan, and the next thing it
does is scan again. The top bar's menu holds the reader's account alone there
(#495). Nothing on this axis is scoped by role or job, so
unlike the request, order and invoice screens this answers one state — no such
tool item — rather than standing in for two. **The transition, the label and the
history are all absent here rather than empty**, and there is no state in
between: a label is a pure function of the id, so every tool item that exists
has one.

**When the host makes the symbol too large for the label stock (#453):** the
rail says `The address from this host is long enough that this symbol does not
fit the label stock, so it does not print.` in place of the drawing and its
size. The label keeps no room for a symbol larger than today's, so any host
longer than seventeen characters reaches this, and a Vercel domain is one. The
print control still opens the labels' dialog, which draws no page for it and
says why (#457). **A design that keeps the drawing and its size and drops this
sentence makes the page claim a label nothing prints.**

**There is no such thing as a tool item whose label is missing**, which is worth
saying because it looks like a state and is not. What can be missing is a printed
sticker on the object, and the app does not record whether one was ever printed or
stuck on — so the screen cannot say "no label yet" and must not imply it. Every
tool item's label is always available; whether it is on the drill is what the
person holding it can see.

## What must agree elsewhere

**The facts on a history entry are invariants of the base, not choices.**
The event is one of a closed set of four; the job is on every row and is never
blank; who recorded it is written on every path that appends a row; and who a
tool went to is on every `Checked out` row and on no other. A design that
hides one is hiding a defect upstream rather than simplifying a row.

**A repeated job down the history is the normal reading.** A tool item that has
never left its job carries the same job on every entry. That the column has no
blanks is what makes the previous entry's job readable as the previous job,
which is why nothing stores a former job — collapsing the repetition would take
that away.

**The status shown here is the same value the tool list counts.** It is
maintained by the app rather than computed on this screen, so this page and
the two list screens cannot disagree about where a tool item is.

**And it is the value both of this screen's controls move.** A transition here
changes what `/tools` counts and what the tool's own screen shows in its
`Status` column — the first non-zero `Out` either of them has ever rendered
came from the transition control, and the first non-zero `Retired` from the
other. The verdict and the actions are about one fact, which is why they sit
with the status rather than with the history.

**This screen's dialogs close on `Escape` and hand focus back, and most of the
app's do not.** Every dialog on this axis does since #458, in the design's frame;
the rest close only by their own controls. That is an inconsistency the app has
rather than one this screen introduces, and the shared brief records it beside the
modal-styling constraint — a design pass over modals should settle it for all
of them rather than for this one.

**A history entry appears the moment a transition is confirmed, and that
arrival is the whole confirmation.** No banner, no toast, no line under the
heading, and nothing in the address: the status has flipped, an entry heads the
history, and the control now reads the other way. **A design that adds a success
message here is undoing a decision**, the same one the shared brief records for
every other create and edit in the app.

**The job on a history entry is where the tool item was, and that is not always
the actor's.** A scan takes it from whoever pressed the control, because they
are holding the tool. A retirement takes it from the tool item, because
retiring moves nothing. Either way it is stored at that moment and never looked
up again — so **a check-in on a different job from the check-out before it is a
true record of a tool changing site**, and a retirement always matching the row
before it is what keeps that reading available.

**The two tables are not interchangeable, and the screen names them the
design's way (#455).** A `Tools` row is a tool — the kind, the name somebody
typed once, which heads this page. A `Tool Items` row — this object, with this
printed id, which this brief calls a tool item — is a `tool` in every sentence
about it: `Retire this tool`, `Tool not found`, `This tool was last scanned
on …`. Six of one drill is one tool and six tools under it, counted as items on
the tool's own page. **No sentence on the screen says `tool item` since #463**,
which took the design's `Tool not found` for the last one that did.

**The label in the rail and the label the dialog prints are one object, built
once for both (#457), and drawn alike (#463)**: the rail draws the dialog's own
page at the dialog's preview scale, 19.14 mm for a symbol that prints at 9.57.
Both read one module size, the floor a print proved (#467), and multiply it by
the side count that symbol actually came out at, so a longer address makes a
bigger symbol on both rather than a denser one on either — and the `Symbol`
figure follows it. A design that pins the drawing to a box in pixels breaks the
equality with the printed label, and nothing on screen would show it.

**This screen prints nothing itself.** Its print control opens the labels'
dialog on the label this page built (#457), and it was a link to the label
screen until then. That is what keeps a replacement the same physical object as
the original by construction — there is no second layout to drift from the
dialog's.

**There are two ways in, and both survive a reload.** A scan of the label is the
first, arriving through the short route that redirects here; the second is a
tool's own screen, which lists every tool item under it with a link to this one
(#339) and is reached from the tool list and from a registration, which lands
there with what it wrote selected (#449). **This said three ways, one of them
lost on a reload**: the registration form's own answer linked here too until
#449, and that list was gone once the page was.

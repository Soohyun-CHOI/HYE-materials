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

## What it always carries

**identity.** The `Tool Item ID` as the heading, and nothing else as a heading —
the shape the four document detail screens already take.

**It is no longer the same string as the one on the sticker, and the confirmation
still works (#411).** The label prints `260909-004` where the heading reads
`HYE-TL-260909-004`, so what a reader matches is the end of the heading rather
than the whole of it. That is what the seven dropped characters were worth:
every tool item carries them, so they confirmed nothing, and what is left on the
sticker is exactly the part that tells one tool item from another. **A design
may not close the gap by shortening the heading** — this screen names a record
and the base holds the long form — **and it may not close it by lengthening the
sticker**, which is the whole of #411.

**verdict.** Where the tool item is: its status, one of `In Stock`, `Out` or
`Retired`. This is what the reader came for.

**evidence.** The tool it is one of, and the job it is on. Both are single
values, never lists — a tool item is one unit of one tool and sits on one job.

**action.** The one transition the status allows — `Check out` from `In Stock`,
`Check in` from `Out` — and the job the event will be recorded on. There is
never a choice of transition: the status decides which one.

**A CHECK-OUT ALSO ASKS WHO THE TOOL IS GOING TO, AND A CHECK-IN DOES NOT.**
The check-out's dialog asks it under the job, in a field labeled `Checked out
to` that reads `e.g. Jane Doe` while it is empty (#458). The people it names
have no account here, so it is free text rather than a picker over a list of
users. **A check-out cannot be recorded without one** — the dialog's `Check
out` cannot act until the field holds a name, a submission that arrives
without one anyway is refused with `Enter a name to check out.`, and nothing
is written. A field of nothing but spaces is the same refusal.

**Below the phone's edge, touching the field opens a sheet**, titled with the
same words, with the system keyboard up. A name can be typed there or picked
from the list below it, and both are the same value as the field behind. It
closes by picking, by its own `Done`, by the keyboard's done key, by `Escape`,
on its handle and on what lies behind it, and focus returns to the field.
**Opening it is a press rather than a focus** — returning focus to the field
would otherwise reopen it — and the keyboard opens it as it presses any
button. **It rises from the foot of the screen, as 1f draws it**, in the
design's frame (#458). **At a desk there is no sheet**: the field is the one
the registration types a name in (1j), and the list opens under it.

**The list under it is headed `Recently at this job`** and holds the people
that job has recently handed tools to, most recent first. **One entry per
person however their name was typed** — `Mike R` and `mike r` are one, shown
in the most recent spelling — and **it is the chosen job's list, not the
reader's**: a person with two assignments sees it change as the picker moves.
Typing narrows it, matching anywhere inside a name and ignoring case and
spacing. **A few are shown before anybody types and the number is a display
choice over the whole list**, so a design may set it: a name below the cut is
one keystroke away rather than absent.

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
same control offers a moment later. **The dialog a check-out opens asks and does
not confirm** (#458): the job and the name are what its row needs, and a
check-in on one job, which needs neither, still records on the press. A
check-in on several jobs opens the same dialog for its job alone, with none
chosen.

**While the event is on its way the dialog says so (#469):** its commitment
keeps its color and, after a moment, says `Checking out…` or `Checking in…`,
and nothing in the dialog takes a press. That is not the commitment that cannot
act yet — drawn faded until the job and the name are given — and a design must
keep the two apart.

**action.** `Retire this tool`, which opens a dialog and is the second and
last control on the page. It is offered from `In Stock` and from `Out` alike —
a tool that broke on a site is retired from there, and requiring a check-in
first would put an event in the history that did not happen.

**THE TWO CONTROLS MUST NOT READ AS THE SAME WEIGHT, AND TWO THINGS ALREADY
STOP THEM.** One of them is pressed dozens of times a day and the other is that
tool item's last. The first difference is structural: the transition records on
its press or opens the fields of an act the next scan undoes; this one OPENS a
question naming the tool, with a red commitment (#458), so pressing it does
nothing until a second press inside the dialog. The second is the wording: `Check out`
names no object and `Retire this tool` does. **A design may do anything
else it likes with them and may not undo either of those** — in particular it
may not make the retire control a one-press submit, and it may not put the two
at a size and prominence that says they are the same kind of act.

**WHERE THE TWO SIT RELATIVE TO EACH OTHER IS THE DESIGN'S, AND THIS IS THE
INPUT IT NEEDS TO DECIDE THAT.** This brief does not place them; it says what
placement is for. A mis-press on the retire control is already caught: it opens
a dialog instead of acting, and the dialog states what becomes true before
anything happens. **So placement is the second guard and not the only one**,
and that cuts both ways. A design does not have to bury the control, put it
behind a disclosure, or add a further confirmation in order to make it safe —
the safety is already there, and paying for it twice costs a control that a
person on a site cannot find. Nor may it treat the two sitting close together
as harmless, because the first guard only helps somebody who stops and reads.
What placement is actually for is making the mis-press less likely in the first
place, and that is worth doing on its own terms rather than as a rescue.

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
decoration**: it is the same voice the three deletion
confirmations use, and the shared brief calls it copy doing work a visual
cannot.

**It takes no input of any kind — no reason, and no job.** A design must not
add a field to it. It is a sentence and two ways out, and that is the whole of
it.

**It asks for no reason, and that is a decision rather than a gap.** A required
reason on this event was recorded as a rule for a long time and was dropped:
one of its two grounds went when `Lost` left the status vocabulary, and the
other — that the act cannot be undone — is what the dialog itself now bears.
A design must not add a free-text field back; there is no field behind it.

**THE JOB IS NOT ASKED FOR HERE, AND THE SCREEN ASKS IT ONCE.** The transition's
dialog has a job choice because a scan is the person handling the tool, so
where they are is where it goes. Retiring moves nothing, so the row records
where the tool item already was — the page's header says it and nothing
changes it. **A design must not put a second job control on this screen**: the
first version of this dialog had one, and one screen asking the same question
twice let the two answers disagree. For the same reason the dialog does not
restate the inherited job either, and it carries no line about moving the tool
item to another job — that sentence says the tool has gone somewhere, and a
retirement is not a move.

**The job is already chosen when the person has one and chosen by them when they
have several, and it is the same control either way** — at a desk a choice
holding that one job, as the registration's is, and below the phone's edge the
job stated with no sheet to open (#458). Nobody types a job anywhere on this
axis, and the two cases must not become two layouts. **If the office takes
away the job a reader chose while the dialog is open**, the press is refused
above the actions and the job starts again as the dialog started — the one job
left already chosen, or none of several (#469).

**The section has no heading.** The two below it name things — `Label`,
`History` — and a heading here would have to name the act in the abstract, which
is a word the app does not say. The control names itself.

**THE TOUCH TARGETS ARE NOT DECIDED HERE, AND THEY ARE THE FIRST IN THE APP
THAT ARE FUNCTIONAL RATHER THAN AESTHETIC.** Every other control in this app is
clicked with a mouse at a desk. These are pressed on a phone, on a site, by
somebody who may be wearing gloves — so a minimum tappable area and a minimum
gap between them are things this screen genuinely depends on, in the way the
label's readable id depends on a minimum size because it is the fallback from a
worn symbol. **This screen sets neither value**: the tools screens carry no
size, spacing or type of their own, and the token layer is where both are
chosen. Two things the design needs to know. A target too small to hit in
gloves is not an inelegance — it is a transition somebody writes on paper
instead, and the app then holds nothing. And the GAP matters here more than
anywhere else in the app, because the two controls beside each other are a
dozens-a-day act and an irreversible one.

**The dialogs are the exception to this screen carrying no styling, and they are
the design's** (#458). They open in the design's frame, styled from the names
the design's values are declared under, because an overlay with no positioning
is not an unstyled dialog but an inline paragraph; the page under them is
still #463's to style.

**evidence.** The QR symbol this tool item's label carries, **drawn at the size it
prints at**, with a line saying so.

**Why it is here decides how big it is.** It is here so a reader can SEE what a
replacement sticker will carry and match it against the one in their hand — not to
be scanned off the screen. Somebody who typed the id because the sticker had worn
through is already on this page, so a scan of the screen would return them where they
are; the scan that does work is a later phase's. **So the symbol has no legibility
floor of its own** and no size was invented for it: it is drawn at the printed
size because that is a fact worth carrying, not a style.

**That equality is a distinction rather than a look.** Drawn larger it stops being
a preview of the physical object, which is the whole reason it is on this screen.
A design may change how it is presented and where it sits; if it changes the size,
the line saying it is printed size has to go with it.

**It has no accessible name, and no word for one reaches this screen (#455).** The
census of this page's strings lists `QR label for this tool`, because the page
imports the constant that holds it, but nothing draws it: the symbol is inline
markup with no `alt`, and read in a browser it carries no `role`, no `aria-label`
and no `title`. Whether it should be named by those words or hidden, since the
heading already carries the id, is undecided — so a design must not draw room for
the string, and naming the symbol is a decision about the page rather than a word.

**action.** A control that prints this tool item's label, `Print label`. It opens
the labels' dialog on this one label (#457), rather than printing the page — that
dialog owns the label's page and the print rule, so printing the page would be a
second layout of one label. It led to the label screen carrying this one tool
item until then, and that screen also owned the position on the sheet to start
at until #467 took the sheet, when **printing one label was the archetypal
part-used sheet**; a label is a page of its own now, so nothing is part used.

**It does not say `reprint`, and the reason is that the screen cannot know.**
Nothing in this base records whether a sticker was ever printed or stuck on, so a
control promising a re-print would state something the app cannot check — and the
two readers are after the same act anyway: one whose label has worn through, and
one printing a label for the first time.

**evidence.** A history section, one entry per `Tool Log` row, **oldest first**.
Each entry carries four facts and always all four — the event, when it
happened, the job it happened on, and who recorded it. **There is no fifth and
nothing is ever absent**, so a design does not need a shape for a missing one.

**The event is printed as the base stores it: `Created`, `Checked Out`,
`Checked In` or `Retired` (#455).** The first is the design's word and was
`Registered` until then; the base renamed the value in place, so every entry
that said `Registered` says `Created`, and none says the old word. **The case is
the base's**, which is every select value's on every screen in this app — `In
Stock`, `In Review`, `Sent to Vendor` — so the design's `Checked out` and
`Checked in` read `Checked Out` and `Checked In` here. Setting select values in
sentence case would be a decision for every screen at once, not for this one.

**The instant renders as a date and a time to the minute**, in the same five parts
the request detail's history uses — the only other history in the app. **This was
the one fact on the page with no rendering chosen, and it is chosen now.** The
screen used to print the stored value, a UTC instant to the millisecond, which was
the longest and most machine-shaped string here; what an entry carries is a moment
somebody reads, and seconds are finer than the resolution a tool moves at.

**It is the reader's own zone, and that is why no zone is named (#374).** The
moment resolves against the phone in the reader's hand rather than against the
server, so there is nothing to convert and nothing to label — the same reason a
phone's own clock carries no zone. **A design may assume the reader's zone here**,
which is the opposite of what this brief said while the page rendered the
server's; closing that took a client boundary on this screen, which is what the
gap entry named as one of its two options.

**It appears a moment after the rest of the entry**, because only the browser can
say what zone the reader is in and it cannot say so until the page is
interactive. Until then the entry's other three facts are there and this one is
blank. A design may not reserve a placeholder that reads as a value, and it may
not assume the four facts arrive together.

## What it carries only sometimes

**A line saying the transition moves the tool item to another job.** It appears
only when the job the event will be recorded on is not the job the tool item was
last scanned on — which is a tool that has been carried to another site, and is
recorded as it happened rather than refused. **This is the one place two `Job`
values sit on the page with different values under one word**, and the line is
what stops that reading as a mistake. With a picker it appears and disappears as
the choice changes. The rest of the time nothing stands there.

**A refusal, in one slot, where every refusal this screen can produce arrives**
— or above the dialog's actions while a dialog stands open for it (#458).
Those that reach it: somebody else has already recorded something, so the press
recorded nothing; the job submitted is not one of the reader's; the tool item
carries no such id; and the event was recorded but the tool item's own status was
not updated. The last is the only one that means something was written, and its
sentence says so — the reader is told the event is safe, what everybody else will
read until it is fixed, and that pressing again fixes it. Ordinarily the slot is
empty.

**EVERY REFUSAL ARRIVES ON A FRESHLY RENDERED PAGE, AND THAT IS WHAT THE FIRST
SENTENCE IS WRITTEN AGAINST.** The status, the control's direction and the
history are all re-read and re-drawn in the same moment the sentence appears,
so the screen under a refusal is never the screen the reader pressed on. It
also means a refused press and a successful one leave the SAME screen — a
flipped control, a moved status, one more history entry — and the only visible
difference is whose entry it is, at the foot of the page. So the sentence
carries what that screen cannot: `Nothing was recorded. Somebody else scanned
this first.` **A design may not treat this slot as an aside.** It is the one
thing distinguishing two outcomes that otherwise look alike, it is read on a
phone in one hand, and it names no status because the status is stated directly
above it and was just refreshed.

**The dialog, which is closed until its opener is pressed.** The page behind it
stays legible, and it closes by `Cancel`, by `Escape`, by its close at a desk
and on a press behind it as a phone's sheet, with focus returning to the
control that opened it; the confirm takes it away with the page's offer, and
focus goes to the page's heading (#458). It does not close while a
confirmation is in flight, and while it is, the commitment keeps its red and
says `Retiring…` and nothing else in it takes a press (#469). It carries a
refusal slot of its own, in case a refusal ever lands while it is open.
**What happens today when somebody else
retires the tool item first is that the dialog goes** — the refusal re-renders
the page, the page has no controls to offer a retired tool item, and the dialog
disappears with them; what the reader is left looking at is the sentence saying
the status is the end. There is no refusal about a job here, because the dialog
asks for none.

**A sentence where BOTH controls would be, rather than beside them.** Two
states produce one: a status that allows nothing, and a reader assigned to no
job. In both, both controls are absent, not disabled — a control the action
would refuse is a promise the screen cannot keep. **The status, the job and the
history are still shown to that reader**: what varies is whether they can act,
never what they can read.

**A tool item whose status allows nothing** says so instead of offering
anything. `Retired` is the only such status, and it is reachable now — the
retire control is what puts a tool item there, so this sentence is the first
thing the person who pressed it reads. It names the status rather than the word
`Retired`, because what it is about is a status being the end.

**A history entry is four facts, and a `Checked Out` entry is five.** The
fifth is who the tool went to, last, labeled with the same words the control
that wrote it says. **It is decided by the event and not by whether a value
is there**: every `Checked Out` entry carries the pair and no other entry
does, so a design may lay out two fixed shapes and must not treat the fifth
as an optional extra on all of them. There used to be a genuinely optional
note here, usually absent; the field it read is gone, and this is not it
returning.

**A `Checked Out` entry written before the app asked for a name shows the
label with nothing under it.** Those entries exist on this base and are not
repaired — writing a name onto them now would state something nobody
recorded. A blank in any of the five reads the same way: a defect upstream,
shown rather than hidden.

**When the tool item has no history at all:** one sentence in place of the
entries, `Nothing has been recorded against this tool, so nothing holds when it
was created.` **This is reachable and is not an
error state.** Registration writes the tool item and then its first log row, and
a failure between the two leaves exactly this; the row is sound, with its id,
its status and its job. There is no repair, because a log row written later
would state a time that is not when the tool item was created.

**When no tool item carries the id in the address:** the screen is the heading
`Tool item not found` and a way back to `/tools`. Nothing on this axis is scoped
by role or job, so unlike the request, order and invoice screens this refusal
answers one state — no such tool item — rather than standing in for two. **The
transition, the symbol and the print control are all absent here rather than
empty**, and there is no state in between: a symbol is a pure function of the
id, so every tool item that exists has one.

**When the host makes the symbol too large for the label stock (#453):** the
line under the symbol reads `The address from this host is long enough that
this symbol does not fit the label stock, so it does not print.` in place of the
line saying it is shown at the size it prints. The label keeps no room for a
symbol larger than today's, so any host longer than seventeen characters
reaches this, and a Vercel domain is one. The symbol is still drawn at its own
size and the print control still opens the labels' dialog, which draws no page
for it and says why (#457). **A design that keeps the printed-size line
and drops this one makes the page claim a printed size for a label nothing
prints.**

**There is no such thing as a tool item whose label is missing**, which is worth
saying because it looks like a state and is not. What can be missing is a printed
sticker on the object, and the app does not record whether one was ever printed or
stuck on — so the screen cannot say "no label yet" and must not imply it. Every
tool item's symbol is always available; whether it is on the drill is what the
person holding it can see.

## What must agree elsewhere

**The facts on a history entry are invariants of the base, not choices.**
The event is one of a closed set of four; the job is on every row and is never
blank; who recorded it is written on every path that appends a row; and who a
tool went to is on every `Checked Out` row and on no other. A design that
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

**This dialog closes on `Escape` and hands focus back, and most of the app's
do not.** Every dialog on this axis does since #458, in the design's frame;
the rest close only by their own controls. That is an inconsistency the app has rather than
one this screen introduces, and the shared brief records it beside the
modal-styling constraint — a design pass over modals should settle it for all
of them rather than for this one.

**A history entry appears the moment a transition is confirmed, and that
arrival is the whole confirmation.** No banner, no toast, no line under the
heading, and nothing in the address: the status has flipped, an entry is at
the foot of the history, and the control now reads the other way. **A design
that adds a success message here is undoing a decision**, the same one the
shared brief records for every other create and edit in the app.

**The job on a history entry is where the tool item was, and that is not always
the actor's.** A scan takes it from whoever pressed the control, because they
are holding the tool. A retirement takes it from the tool item, because
retiring moves nothing. Either way it is stored at that moment and never looked
up again — so **a check-in on a different job from the check-out above it is a
true record of a tool changing site**, and a retirement always matching the row
above it is what keeps that reading available.

**The two tables are not interchangeable, and the screen names them the
design's way (#455).** A `Tools` row is a tool — the kind, the name somebody
typed once, which this page labels `Tool`. A `Tool Items` row — this object,
with this printed id, which this brief calls a tool item — is a `tool` in every
sentence about it: `Retire this tool`, `This tool is Retired, …`, `This tool was
last scanned on …`. Six of one drill is one tool and six tools under it, counted
as items on the tool's own page. **The one sentence here that still says `tool
item` is the not-found heading**, which the design is rewriting; the brief quotes
it as it stands.

**The symbol here and the label the dialog prints are one object, built once for
both (#457), and this page draws it at the size it prints at — measured, 9.568 mm
for a symbol drawn 9.57.** The dialog draws the same label at twice that, 19.14
mm, and prints it at its own; the label screen drew it at the same size as this
page until then. Both read one module size, the floor a print proved (#467), and
multiply it by the side count that symbol actually came out at, so a longer
address makes a bigger symbol on both rather than a denser one on either. A
design that pins this one to a box in pixels breaks the equality with the
printed label, and nothing on screen would show it.

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

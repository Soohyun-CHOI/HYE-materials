# Tool item detail

Route: `/tool-items/[toolItemId]`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Which width comes first: **phone**. Both widths must work; this one is
drawn first and the desktop is what it opens out into.

## What it answers

Which tool is this one, where is it, what has happened to it — and, since
#362, **can I take it out or bring it back, right now?**

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
of its own, `/t/[toolItemId]`, which redirects here and has a brief of its own.
This page took the name its collection gives it once that separation existed
(#348). The printed address is what may not move; this one may.

**The id is also printed in characters a person can read**, for a symbol that
has been scratched or painted over, so the second way here is somebody typing
it. Case does not matter when they do; the page then moves itself to the
canonical form of the address, so one tool item keeps one address.

## What it always carries

**identity.** The `Tool Item ID` as the heading, and nothing else as a heading —
the shape the four document detail screens already take. Here it is also the
string printed on the label in the reader's hand, which is what lets them
confirm they scanned the right thing.

**verdict.** Where the tool item is: its status, one of `In Stock`, `Out` or
`Retired`. This is what the reader came for.

**evidence.** The tool it is one of, and the job it is on. Both are single
values, never lists — a tool item is one unit of one tool and sits on one job.

**action.** The one transition the status allows — `Check out` from `In Stock`,
`Check in` from `Out` — and the job the event will be recorded on. There is
never a choice of transition: the status decides which one, and the control is
the only one on the page that changes anything.

**The confirmation is that arriving does not act.** A scan opens the page, the
page states the id and the status, and one press is the transition. There is no
dialog and there must not be one: this happens dozens of times a day, and every
confirmation in this app that IS a dialog is for something that cannot be undone
— a withdrawal, a deletion. A check-out is undone by the check-in the same
control offers a moment later. Retiring a tool item, which is a later screen,
cannot be undone and carries the weight instead.

**The job is stated when the person has one and chosen when they have several,
and it is the same control either way.** Nobody types a job anywhere on this
axis. A person on one assignment must not be shown a picker, and the two cases
must not become two layouts.

**The section has no heading.** The two below it name things — `Label`,
`History` — and a heading here would have to name the act in the abstract, which
is a word the app does not say. The control names itself.

**THE TOUCH TARGET IS NOT DECIDED HERE, AND IT IS THE FIRST ONE IN THE APP THAT
IS FUNCTIONAL RATHER THAN AESTHETIC.** Every other control in this app is
clicked with a mouse at a desk. This one is pressed on a phone, on a site, by
somebody who may be wearing gloves — so a minimum tappable area and a minimum
gap between it and anything else tappable are things this screen genuinely
depends on, in the way the label's readable id depends on a minimum size because
it is the fallback from a worn symbol. **This screen sets neither value**: the
tools screens carry no size, spacing or type of their own, and the token layer
is where both are chosen. What the design needs to know is that a target too
small to hit in gloves is not an inelegance — it is a transition somebody writes
on paper instead, and the app then holds nothing.

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

**action.** A control that prints this tool item's label. It leads to the label
sheet screen carrying this one tool item, rather than printing from here — that
screen owns the sheet layout and the position on the sheet to start at, and
**printing one label is the archetypal part-used sheet**, so printing from here
would mean either losing that control or building a second one.

**It does not say `reprint`, and the reason is that the screen cannot know.**
Nothing in this base records whether a sticker was ever printed or stuck on, so a
control promising a re-print would state something the app cannot check — and the
two readers are after the same act anyway: one whose label has worn through, and
one printing a label for the first time.

**evidence.** A history section, one entry per `Tool Log` row, **oldest first**.
Each entry carries four facts that are always there — the event, when it
happened, the job it happened on, and who recorded it — and a fifth, notes, that
is usually absent.

**The instant renders as a date and a time to the minute**, in the same five parts
the request detail's history uses — the only other history in the app. **This was
the one fact on the page with no rendering chosen, and it is chosen now.** The
screen used to print the stored value, a UTC instant to the millisecond, which was
the longest and most machine-shaped string here; what an entry carries is a moment
somebody reads, and seconds are finer than the resolution a tool moves at.

**Which zone it is in is not stated on the page, and that is a real gap rather
than a detail.** The page renders on the server, so the moment resolves against
wherever that happened — and the stored value used to carry a `Z` while this does
not, so a reader on a site cannot tell from the string which zone they are
reading. Closing it needs either a client boundary on the one screen this axis
draws for a phone, or the zone said out loud beside the time. **A design may not
assume the reader's own zone**; that is not what these strings are.

## What it carries only sometimes

**A line saying the transition moves the tool item to another job.** It appears
only when the job the event will be recorded on is not the job the tool item was
last scanned on — which is a tool that has been carried to another site, and is
recorded as it happened rather than refused. **This is the one place two `Job`
values sit on the page with different values under one word**, and the line is
what stops that reading as a mistake. With a picker it appears and disappears as
the choice changes. The rest of the time nothing stands there.

**A refusal, in one slot, where every refusal this screen can produce arrives.**
Four reach it: the page is out of date because somebody else moved the tool item
since it was opened; the job submitted is not one of the reader's; the tool item
carries no such id; and the event was recorded but the tool item's own status was
not updated. The last is the only one that means something was written, and its
sentence says so — the reader is told the event is safe, what everybody else will
read until it is fixed, and that pressing again fixes it. Ordinarily the slot is
empty.

**A sentence where the control would be, rather than beside it.** Two states
produce one: a status that offers no transition, and a reader assigned to no job.
In both the control is absent, not disabled — a control the action would refuse
is a promise the screen cannot keep. **The status, the job and the history are
still shown to that reader**: what varies is whether they can act, never what
they can read.

**A tool item whose status offers no transition** says so instead of offering
one. `Retired` is the only such status and nothing sets it yet, so this sentence
has no reader until the screen that retires a tool item exists. The sentence
names the status rather than the word `Retired`, because what it is about is a
status offering nothing.

**A note on a history entry.** Absent in the ordinary case: a registration
carries none. It is omitted rather than drawn empty, so a design must not
reserve room for one on every entry.

**When the tool item has no history at all:** one sentence in place of the
entries, opening
`Nothing has been recorded against this tool item` and going on to say that
nothing holds when it came into existence. **This is reachable and is not an
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

**There is no such thing as a tool item whose label is missing**, which is worth
saying because it looks like a state and is not. What can be missing is a printed
sticker on the object, and the app does not record whether one was ever printed or
stuck on — so the screen cannot say "no label yet" and must not imply it. Every
tool item's symbol is always available; whether it is on the drill is what the
person holding it can see.

## What must agree elsewhere

**The four facts on a history entry are invariants of the base, not choices.**
The event is one of a closed set of four; the job is on every row and is never
blank; who recorded it is written on every path that appends a row. A design
that hides one is hiding a defect upstream rather than simplifying a row.

**A repeated job down the history is the normal reading.** A tool item that has
never left its job carries the same job on every entry. That the column has no
blanks is what makes the previous entry's job readable as the previous job,
which is why nothing stores a former job — collapsing the repetition would take
that away.

**The status shown here is the same value the tool list counts.** It is
maintained by the app rather than computed on this screen, so this page and
the two list screens cannot disagree about where a tool item is.

**And it is the value this screen's control moves.** A transition here changes
what `/tools` counts and what the tool's own screen shows in its `Status`
column — the first non-zero `Out` either of them has ever rendered came from
this control. The verdict and the action are about one fact, which is why the
control sits with the status rather than with the history.

**A history entry appears the moment a transition is confirmed, and that
arrival is the whole confirmation.** No banner, no toast, no line under the
heading, and nothing in the address: the status has flipped, an entry is at
the foot of the history, and the control now reads the other way. **A design
that adds a success message here is undoing a decision**, the same one the
shared brief records for every other create and edit in the app.

**The job on a history entry is the actor's, not the tool item's.** It is taken
from whoever pressed the control, at that moment, and never looked up again — so
a check-in on a different job from the check-out above it is a true record of a
tool changing site rather than a discrepancy to reconcile.

**`Tool` and `tool item` are the two nouns, and they are not interchangeable.**
A `Tools` row is a tool — the kind, the name somebody typed once. A `Tool Items`
row is a tool item — this object, with this printed id. Six of one drill is one
tool and six tool items. Never a bare `item`: four other tables on this base
hold item rows.

**The symbol here and a symbol on the sheet are the same object at the same size,
and that is measured rather than intended.** Both screens read one module size
derived from the label stock and multiply it by the side count that symbol
actually came out at, so a longer address makes a bigger symbol on both rather
than a denser one on either. A design that pins this one to a box in pixels
breaks the equality, and nothing on screen would show it.

**This screen prints nothing itself.** Its print control is a link. That is what
keeps a replacement the same physical object as the original by construction —
there is no second layout to drift from the sheet's.

**There are three ways in and only one of them survives a reload.** A scan of the
label is the first, arriving through the short route that redirects here; the
registration form's answer is the second, and each id it names links here, but
that list is gone once the page is; the third is the tool list, where a tool
opens its own screen and that screen lists every tool item under it with a link
to this one (#339).

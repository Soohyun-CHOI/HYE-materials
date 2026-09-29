# Tool detail

Route: `/tools/[toolRecordId]`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Which width comes first: **desktop**. Both widths must work; this one is
drawn first and the phone is what it folds into.

## What it answers

Which units of this tool exist, and where is each of them?

**One row per physical object.** A `Tools` row is a `tool` — the kind, the
name somebody typed once — and each row here is one drill with one printed
id stuck to it, a `Tool Items` row, which this brief calls a tool item.
**The screen calls each one an `item`, the design's (#455)**: it counts
`13 items` and heads their column `Item`, and a sentence about one elsewhere
calls it a `tool`. Six of one drill is one tool and six items on this
screen.

**It is reached from the tool list, and a registration lands on it (#449).**
The tool item's own screen is the one a machine opens; this one is opened by a
person who picked a name off a list, or who has just registered tool items of
this tool and arrives with them selected. So the reader is at a desk as often
as on a site — printing labels, checking what the company has of something, or
registering more of it (#451).

**The address is a record id and cannot be read.** `Tools` mints no id, the
way `Vendors` and `Materials` mint none, because nothing prints a tool and
nobody quotes one; the name a person typed is the identity, and a name is
not a path. So the URL carries Airtable's own record id and says nothing a
reader recognizes, which is why the browser tab says only `Tool`.

**These are the only screens in the app used at a phone width** (#336), and
the width container lives in the layout and is empty — no width, no
padding, no type, no color. The screen renders unstyled.

## What it always carries

**identity.** The tool's name as the heading, and no heading word beside
it — the shape the tool item's screen takes with its printed id and the
four document detail screens take with theirs.

**action.** A way back to `/tools`, carrying the same words the tool item's
screen carries for the same trip.

**action.** A control that opens the registration form with this tool's name
filled in, `Create more of this tool` (#451, #455). Buying more of a tool the
company already has is the same registration as buying the first, and the
form puts them under this tool because the name finds it — so somebody who
knows which tool they bought starts here rather than typing its name again.
**It carries no count**: nothing on this screen knows how many were bought,
so the form asks, starting where it always starts. **Nor does it carry the
selection or the page**: the boxes are for printing, and it opens the same
form from every page of the list. It is on this screen for every tool it
finds, the one with nothing under it included, and for every reader —
somebody assigned to no job reaches the form and meets the sentence that
screen has for them, as they would from `/tools`.

**It is not one of the answers a registration that fell short offers, and a
design must not draw it as one.** Those two are a pair about the registration
the reader has just made (below); this one begins another. When both are on
the screen they open one form — `Create the rest` with the count that was not
written, this one with none — and `Not now` takes the pair away and leaves
this standing.

**action.** A box on every entry and one for the page, and together they say
**which tool items a label run is for** (#443). An entry's box selects that tool
item or takes it out. The page box selects every entry on this page, or, when
all of them are selected already, takes this page out — and a page partly
selected is completed rather than cleared. **The page box reaches this page and
no further, and its own words say so:** `Select all on this page`. This screen
reads its tool items a page at a time, so a render holds one page of printed
ids and no more, and selecting the whole tool would need a read of every tool
item under it — the cost the paging exists to avoid. It shows whether **none,
some or all of this page** is selected, and that is this page's answer alone,
whatever is selected on another.

**action.** A control that prints labels for **what is selected** (#353, #443),
`Print labels`. **It names no range, and that is the point:** the boxes and the
count beside it show what a press sends, which is what the control's words had
to say while it sent the page it was on. It opens the label screen with the
selection, in the list's order.

**evidence.** One sentence standing with the print control, saying what a
press would send: how many are selected — `3 selected` — or, when nothing is,
why the control does not act (below). The words name no noun for what is
selected; see below.

**evidence.** How many tool items this tool has in total, `13 items`. #326 names this
as the fact every list in this app is missing: without it nothing on
screen says whether a reader is looking at everything or at the beginning
of it. **It is a fact about the list rather than about what the company
holds** — which is why a single figure is right here and deliberately
absent from the tool list, where a total would have to decide whether a
retired tool still counts.

**evidence.** One entry per tool item, **oldest first**, each carrying
three facts: its printed `Tool Item ID`, which is the way into that tool
item's own screen; its status, one of `In Stock`, `Out` or `Retired`; and
the job it is on. Each carries its box as well; see above.

**Oldest first is load-bearing rather than a default.** A link array is
creation order and the ids in one registration are contiguous, so oldest
first is also ascending id — the number a person reads off a label.
Newest first would push every row along at each registration, so a link to
a later page would name different tool items tomorrow.

**evidence.** Which page of the list this is, and how many there are —
stated whether or not there is a second page, because a position that
appears only once a list is long leaves the short case saying nothing.

## What it carries only sometimes

**When a registration has just written tool items of this tool (#449):** the
reader lands here with every tool item it wrote selected — those and no others
— on the page where they begin. A registration makes up to a hundred, so what it
wrote can run past this page; the sentence beside the print control then says
how many are not on it, exactly as it does for any selection, and the steps
carry the selection on. **Nothing here says the registration happened**: the
selection is what says it (#321; `_shared.md`, "The arrival is the
confirmation"). What the registration could not do is said by the next two
entries, and only when it happened.

**When the registration wrote fewer than were asked for:** two sentences, the
design's (#455) — how many of how many were created, `3 of 5 tools created`,
and how many were not, `2 couldn't be created` — and two controls that answer
them. `Create the rest` opens the registration form with this tool's name and
the count that was not written filled in, both still the reader's to change
there. `Not now` removes the sentences and both controls. **The two are a pair,
and the pairing is what says what the choice is about**: one goes on creating
and the other ends it, so neither can be read as being about the entry below.
It is a choice rather than a confirmation dialog — `Not now` acts on nothing in
the base. The first sentence always says `tools`: a shortfall has at least one
created and one not, so what was asked for is at least two.

**When some of what it wrote has no first history entry:** two sentences —
`2 tools have no creation date` and `Only the creation date wasn't saved for
these` (`1 tool has no creation date`, `… for this one` at one) — then their
ids, then one control, `Got it` (#455). **Nothing is offered that repairs them,
because nothing does**: a late history entry would state a time that is not when
they were created. `Got it` takes the notice away and nothing else — it answers
no question, which is what still sets it apart from the entry above. They are
also in the list as ordinary entries, selected with the rest, because they were
written and need labels. **A design must not fold this notice into the list**,
which would read them as created cleanly, **nor draw it the way the entry above
is drawn**, since there is nothing to choose. It can name a tool on another page
of the list.

**When both happened:** both stand, each whole. The counts the first gives do
not include the second's tools, which were written. `Not now` answers the first
alone and `Got it` the second alone, so either can go and leave the other.

**A step to the previous page**, when this is not the first one, and **a
step to the next**, when this is not the last. Each is absent at its own
end rather than drawn and dead, so a tool with one page carries neither.
**A second page exists only for a tool with more than twenty-five tool
items**, and that number counts every registration of the tool rather than
one: registering more of a tool adds to the same list, and one registration
can make up to a hundred. Both steps carry the selection, so what was
selected on one page is still selected on the next.

**When nothing is selected:** the sentence is the label screen's own for the
same state, `Nothing is selected, so there is nothing to print.`, and the
print control is drawn but does not act. Every arrival from the tool list
starts here; a registration's arrival does not, and neither does any other
address carrying a selection. **It does not print
the page instead** — that was the control's behavior until #443, and
it is exactly what made its range a sentence rather than something on the
screen. The page is one press of the page box away, and that press shows it.
**The control stays drawn while it does not act**, because it is what tells a
reader what the boxes are for; how an inactive control looks is the design's.

**When something is selected:** a way to clear it, `Clear selection`, which
empties the selection on every page at once. The page box already clears one
page; this is the way out of a selection made on pages the reader is no longer
on. Absent when there is nothing to clear, the way the steps are absent at
their ends.

**When some of what is selected is not on this page:** the sentence says how
many, `3 selected, 1 not on this page`, and says nothing of it otherwise. A
selection outlives a page turn, so this is what reconciles the count with a
page whose boxes show fewer — and it is the only place those tool items appear
until the label screen lists them.

**When more are selected than one print takes:** `101 selected, and one print
takes at most 100.`, and the print control does not act. The label screen
prints a hundred at a time and would print the first hundred of a longer run,
so a press here would print less than it sent. It needs a tool with more than
a hundred tool items, selected across pages.

**When the tool has no tool items at all:** one sentence in place of the
entries, `Nothing is recorded under this tool.` and then why that can
happen — `Creating writes the tool before its items, so one that failed in
between leaves the tool with none.` **This is
reachable and is not an error state**, the same way the tool item screen's
missing history is: nothing rolls back, and the row that stands is sound.
The total, the page position, the boxes and the print control are absent
with it; there is nothing to count, no page to be on and nothing to print.
**The control that registers more of this tool stays, and this is where it
matters most**: it is how the tool items a failed registration did not write
get written, under the name that registration found or made.

**When no tool carries the record id in the address:** the screen is the
heading `Tool not found` and a way back to `/tools`. Nothing on this axis
is scoped by role or job, so unlike the request, order and invoice screens
this refusal answers one state — no such tool — rather than standing in
for two.

## What must agree elsewhere

**A page holds twenty-five tool items, the design's figure for the list as
it drew it (#442), and how the position is expressed is still open.** This
is the first paged list in the app. The screen currently states the
position as a page number out of a count and offers one step in each
direction; whether a reader on a phone is better served by that, by a
count of what is left, or by something else entirely is a decision this
screen has not made. **Twenty-five is the design's to move again** when
the list is drawn again. It replaced ten, an estimate of a screenful made
before any screen was drawn, and it is a design's figure rather than a
measurement — nobody has yet held this list on a phone with a real
warehouse in it. **Two ceilings on it are not the design's.** Anything up
to fifty costs the app exactly the same to fetch, and a fifty-first row is
a second read; and a page is how many one press of the page box selects,
where the print control acts on at most a hundred — what the label screen
prints at once.

**The selection rides in the address (#443), which is what lets it survive a
page turn, a reload and a copied link.** It is the label screen's own
parameter with its own values — printed ids — so the print control hands it
over unchanged, and a copied address is a request to print those labels
again rather than an account of anything. It is kept in the list's order,
whatever order the boxes were pressed in, so a sheet reads the way the list
does. **A design must not offer "select all of this tool"**, for the reason
this screen never offered "print all": it is a read of every tool item under
the tool. **A registration's arrival is such an address (#449)**: it carries
what the registration wrote, which is why what it wrote survives a reload.

**A registration's account rides beside the selection on the address it lands
on, and on no other (#449).** It is the two entries above — how many were asked
for and how many of those were not written, and which have no first history
entry — and none of it is a confirmation: the selection is the confirmation,
and these are what it cannot show, the way the invoice screen says how a
delivery was matched to it (#231). A reload of that address repeats both, which
is true — nothing repairs a missing entry, and the choice stands until it is
answered — until `Not now` takes the first out of the address and `Got it` the
second. **Every address the list itself writes carries the selection alone**,
so the reader's first press of a box or step to another page leaves both
behind; what is on the screen stays until the next page is opened. A copied
address carrying them shows them to whoever opens it.

**The label screen still asks which labels to print, and that is not a second
selection.** Arriving from here, every tool item this selection names starts
included there. Excluding one there trims that sheet and does not reach back
into this screen's selection — it is where the whole run is listed at once,
beside the start position and the sheet count, for a last decision about the
paper. The two are different acts and take different words: `Select` here,
`Include` there.

**Every control that opens the registration form takes its words from that
form's constant (#451)**, so none can drift from the form it opens — the
arrangement the label screen has with the two screens that open it. They say
different things because they open it differently: `/tools`' own carries the
form's heading and opens it on no tool, this screen's opens it on this tool,
and the fork's opens it on this tool and a count.

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
`In Stock`, `Out` or `Retired`, and a design draws for three. This said every
entry would read `In Stock` until a later phase, which stopped being true
when those issues wrote the other two; corrected by #443.

**There is no count per status on this screen, and adding one is not
free.** That question belongs to the tool list one level up. Answering it
here would mean reading every tool item under the tool, which is the cost
the paging exists to avoid — this page reads only the entries it draws,
whatever the tool's size.

**The column over each code is `Item`, beside `Status` and `Job` (#455).** It
said `Tool item` until then, on the ground that four other tables on this base
hold item rows and a bare `item` names four things — stricter than the app's
own rule, under which the modifier drops where nothing on the screen offers a
second kind of item row. No tools screen shows a request's, an order's, an
invoice's or a delivery's. `Status` and `Job` name one field each and are the
words the tool item's own screen already uses for them.

**Every id here links to `/tool-items/[toolItemId]`, and this is where a
registration's ids are listed (#449).** The registration form listed them
under itself until then, where a reload lost them; it keeps no account of its
own now and sends the reader here, where the list survives a reload.

**A tool's name never appears as a path segment**, here or anywhere. The
segment is Airtable's record id: `Tools` mints none, a typed name can hold
any character, and a rename would move the address. This screen stood one
level deeper until #348, when the tool item's own address moved off the
axis and freed the slot.

# Shared brief — HYE USA Portal

Read this once before any screen brief. It carries what is true across the whole
app: the levels every screen brief tags its facts with, the distinctions the app
has to make visible, the words that are already settled, who reads which screen,
and the four constraints that already exist. Each screen brief then says what
that one screen carries and cites this document's vocabulary rather than
restating it.

Everything here was read out of the code, not remembered. Where a statement
rests on a decision that took an issue to reach, the issue number is given so
the argument can be found.

## The current appearance has no authority

These screens exist and are in use, and nothing about how they look was
designed. Color, spacing, size, weight and placement were each chosen while the
logic around them was being written, one class at a time, by a coding assistant
with no brief and no rule to follow. There is no version of it to preserve and
no intent behind it to recover. What is written down here — what a screen
carries, which distinctions it must make visible, and which words are fixed — is
the whole of what carries over. Everything else is open, and a design that
resembles what is there now has taken a resemblance for a requirement.

**Two visual decisions are real, and they are the only two.** The app is
light-only, and modal chrome has a single source. Both were decided on their own
terms with the reasoning recorded — #218 and #126 — and both are in
"Constraints that already exist" at the foot of this document with what they
rest on. Everything in the paragraph above is about the choices nobody made; it
is not a claim that no decision was ever taken.

**The repository is deliberately not connected to the design tool.** Connecting
it would align the work to the existing styles, which is what that feature is
for and exactly the wrong outcome here: it would make a coding assistant's
unconsidered defaults into the thing a design has to justify departing from. So
the brief travels and the code does not, and this document has to say so itself
— otherwise a reader either wonders why they are drawing from nothing or
imagines an app that was never designed.

## What the design is free to change

All of it, except the four things in the next section. Every color, every
spacing value, every type size and weight, every border, radius and shadow,
every column width, the shape of a chip, the shape of a card, where a thing
sits on the page, and whether a page is one column or two.

What is amber today may be green; what has no shadow today may have one; what is
a colored pill today may be a rule, an underline or a dot. Issue #258 is where
the values get named once and the repeated shapes become primitives, and it
draws that set from the design rather than from what the screens do today.

Two consequences worth stating plainly, because they are the ones a reader of
this document is most likely to doubt. The colors named in this file — the
green, the amber, the red, the gray — appear only to say which facts currently
share an appearance and which are deliberately kept apart. Substitute freely, as
long as the distinctions in "What the app must make visible" survive the
substitution. And the current column widths are hand-counted rem values in a
`colgroup`; #179 and #235 both had to reason about them at the pixel, and #258
takes them away. They are not a layout to preserve.

## What the design must not change

1. **The distinctions** in "What the app must make visible". How they are
   rendered is open; that two things read as different is not.
2. **The locked words**. Each one cost an argument, and the argument is not
   recoverable from the word.
3. **What is conditional stays conditional.** A screen brief's
   "What it carries only sometimes" is a list of things that are absent in the
   normal case. Reserving space for one, or drawing it as always present, is the
   most likely way to get a screen wrong.

   **No brief says how often a state occurs, because nobody can yet know.** The
   app is not deployed and every record in the base is dummy data, so a
   frequency taken from it would be a false statement about real work. A
   conditional list says what is *possible*, never what is *frequent*, and its
   order is the order a reader meets things on the screen rather than a ranking.
   Where a design needs to know which state is the common one, that is a
   question to ask rather than to infer from this document.
4. **Color never carries a meaning by itself** — see "Constraints that already
   exist".

## The four levels

Every screen brief tags what it carries with one of four levels. They say what
a fact is *for*, never how large or how bold it should be, which is what lets
them survive a redesign. A level is not a position on the page and not a type
scale; two facts at the same level need not look alike.

**identity** — which record this is. A reader arriving from a list has to be
able to confirm they landed on the right one before reading anything else. On
the four document detail screens the identity is the document ID and the app
currently makes it the page heading.

**verdict** — the answer to the question the screen exists to answer. It is
what the reader came for, and on most screens there is exactly one. A verdict is
often a single word from a closed set.

**evidence** — the figures and rows the verdict rests on. Read when the verdict
is not what the reader expected, and skipped entirely when it is. Most of the
bulk of a detail screen is evidence.

**action** — what can be done here. Buttons, forms, links that change something.

A screen with no verdict is a real shape rather than an oversight: a create form
answers no question about existing data, so its brief tags nothing as verdict.

## What the app must make visible

### Status tones — six names in three groups

`lib/deliveryStatus.js` is the one place in the app where a distinction is
stated apart from its rendering. Every status value it produces carries a `tone`,
which is a semantic name rather than a color, so that two screens cannot drift
into two palettes for one fact. Six names exist — seven until #278. **They are
not one set of six, and treating them as one is the mistake this section exists
to prevent.**

**Group 1 — chip tones.** A closed set of states, each currently a background
plus a text color. A reader learns them once and recognizes them thereafter, the
way an Airtable single select works.

| Tone | What it means | Currently |
|---|---|---|
| `complete` | Nothing is outstanding on this axis. | green |
| `partial` | Some of it is outstanding. A stage, on the way somewhere. | amber |
| `mismatch` | An error. Two figures that should agree do not. | red |
| `none` | Not begun. No judgment implied. | gray |

`mismatch` is amber's near neighbor and must not become amber (#232). `partial`
means a stage and `mismatch` means an error; sharing one color would make that
color say a stage on one list and an error on another, which is the single
property this vocabulary exists to hold still. The current split is that the
chip states the discrepancy in red and the prompt below it asks in amber.

**Group 2 — the verdict tone.** One name, for a line of text rather than a chip,
added by #241. It is deliberately not a chip tone: reusing one would make a
single word mean a chip on one screen and a text color on another.

| Tone | What it means | Currently |
|---|---|---|
| `exception` | A discrepancy a person has to act on. | amber text |

**This group held two until #278, and the second is worth knowing about even
though it is gone.** `unjudged` was gray text for a charge with no ordered item
behind it — "nothing was measured here", not a problem but the absence of one —
and the pair made a distinction the invoice detail drew on purpose: gray said
nothing was compared, amber said something is wrong. #278 removed the charge
itself, so the gray half has no producer and every entry in that list is now an
exception. A design does not have to draw the distinction; it should know the
list was once two things and is now one, because reintroducing a second grade
there would need its own argument.

**Group 3 — `absent`, which is not a chip at all.** It means the comparison was
never made, and it renders as plain text with no color. Making it a chip would
put "we did not measure" into the same set as three values that are
measurements. Its text is an em dash, and the em dash is the copy — see the
locked words. **Since #278 it reaches only the two ORDER axes**: the delivery
axis's dash went with the state behind it, and the invoice axis lost its own in
#210, so neither document axis has one.

**Which tones can meet on one screen.** `complete`, `partial`, `none` and
`absent` appear together anywhere a list column carries a status, and
`/pos/[poId]` puts two such chips on one row since #235 — the delivery axis and
the invoicing axis, deliberately sharing one palette so a reader crossing
between them does not learn a second. `mismatch` reaches only the invoice list
and the invoice detail. `exception` reaches only the invoice detail, where it can
appear alongside chip tones on the same page. What never
happens is two *different* chip vocabularies for one predicate on one screen;
`STATUS_COPY.column.po` records that the two sets sharing three words never meet.

**Which grade demands a person.** Two, and only two: `mismatch` and
`exception`. Both mean a human has to look before money moves, and the app
currently states both alongside a sentence saying what to do. `partial` and
`none` are waits, not problems — nobody is asked to act on them. This is the
distinction most worth keeping legible under a new palette: a redesign in which
"waiting" and "wrong" are equally loud loses the only signal the app has for
"stop".

### Distinctions that are not tones

Five more, each of which the app currently makes visible by wording or
placement rather than by color. A design that collapses any of them produces a
screen that lies.

**Frozen against live.** `PO Items` is a snapshot taken when the purchase order
was generated and never recomputed; `PR Items` and `Invoice Items` carry live
formulas. A purchase order showing a stale price is correct — that is the price
that was agreed. The two must not read as the same kind of number.

**This document's figure against the ordered item's total.** The invoice detail
carried both, under `Billed` for the ordered item's total across every invoice
and `This bill:` for this document's own share. **Neither word is on a screen
any more** — #232 scoped the figure to the invoice being read and deleted the
caption that existed only to say it was not, and #241 folded the entries — so
this paragraph is corrected rather than restated (#181, in #274). The
DISTINCTION survives and is what a redesign inherits: `/invoices/[invoiceId]`
speaks for one document and `/pos/[poId]` for the order across every invoice on
it, so a figure moved between those two pages changes meaning. Anywhere both
scopes appear on one screen, which one a figure belongs to has to be
recoverable without counting.

**A document's own arithmetic against a cross-document variance.** #179 named
these two apart after they had shared one word: `⚠ Order variance` is a charge
that differs from what its order agreed, and `⚠ Check the total` is one
document's stated total not matching its own computed total. Two different
facts, two different remedies, and they can both be on one invoice at once.

**Stored against computed.** A delivery may be attached to an invoice by hand or
matched by the app from the ordered items (#231). The app tells the reader which,
because a computed pairing is a claim the app is making and a stored one is a
claim a person made. `PAIRING_COPY` carries the sentences.

**Nothing against zero.** An em dash means no comparison was possible; a `0`
means a comparison was made and came to zero. They are different facts and the
app already spells them differently.

**The signing chain's four step states.** A fourth vocabulary, on the purchase
request detail only, and not one of the tones above: `done`, `current`, `paused`
— a signer who was passed and then pushed back by a correction — and `not reached
yet`. It is worth stating here because two of the four are currently told apart
**without color at all**: `paused` and `not reached yet` share one fill and one
text color and differ only by a dashed border, on the reasoning that a signer who
is not currently actionable reads the same as one not yet reached, with the dashed
border marking "already touched once". The words for all four exist only in each
step's accessible name. A redesign is free to re-render this, but it inherits the
requirement that four states stay four and that the pair sharing a color keeps
some other difference.

## Locked words

Every string below is on a screen today and was argued to its current form. A
redesign may change where it sits, its type and its color. It may not reword it,
and it may not use one of these words for a second meaning elsewhere.

Three tiers, and the tier matters because it says how much protection a word
has. **Tier 1** words live in an exported constant in `lib/` and are pinned by
`scripts/tests/offline/screen-briefs.mjs`, so a change to one fails CI. **Tier
2** words live in a constant that no offline check can load, because its module
reaches `lib/airtable/` — they are checked only as "this literal still appears
somewhere under `app/`". **Tier 3** words are written straight into JSX; the
same weak check is all they get. #227's vocabulary sweep DID reach tier 3 — the
invoice edit form's standing sentence said `Edit line values … add/remove lines`
about invoice items and now says `item` — but it reached it by reading the files,
not by a check: `offline/line-vocabulary.mjs` bars a barred word inside a
`*_COPY` constant and cannot see a sentence written into JSX. So a tier-3 word is
protected against DELETION and not against REWORDING, which is the gap that
paragraph exists to name.

### The status vocabulary (tier 1, `lib/deliveryStatus.js`)

Four axes. Within an axis the words are a closed set; across axes the same word
is deliberately the same word, because the predicate is the same and only the
denominator differs — the row supplies that, never the chip.

| Axis | Words |
|---|---|
| An invoice against its delivery | `Delivered`, `Mismatch`, `Awaiting delivery` |
| A delivery against its invoices | `Invoiced`, `Partly invoiced`, `Awaiting invoice`, `—` |
| An order against its deliveries | `Delivered`, `Partly delivered`, `Awaiting delivery`, `—` |
| An order against its invoices | `Invoiced`, `Partly invoiced`, `Awaiting invoice`, `—` |

`partly`, never `partially`. One stem across a set: `Invoiced` / `Partly
invoiced` / `Awaiting invoice`, never `Billed` / `Partly billed` alongside them.
`Delivered` and `delivery`, never `arrived` or `arrival` — #166 swept that and
the sweep is the reason the words agree at all.

**The word for what an invoice does, in two forms and no third (#274).** As a
participle or a quantity it is `invoiced`, which is what the base already says
(`Invoiced Qty`, `Uninvoiced Items`) and what every chip above says. As a
transitive verb — an invoice doing something to an order, an ordered item or an
item — it is `charges`, which is what `No invoice charges this order yet.`
already said. Never `billed`, and never `invoices` as a verb: an invoice
invoicing something reads as a plural noun and was tried.

The sentences that go with them, all tier 1:

- `⚠ This invoice charges more than the delivery matched to it delivered — take it up with the vendor, or with whoever received the material, before confirming payment.`
- `N EA more invoiced than the matched delivery delivered`
- `N EA invoiced, none of it delivered by the matched delivery`
- `Against the ordered item: N EA more invoiced, N EA more delivered`
- `Longest wait first. No invoice yet covers what these deliveries brought.`

`Against the ordered item`, not `Against the order`: the comparison is against
one `PO Items` row's quantity, not the order's total.

### Variance (tier 1, `lib/variance.js`)

`⚠ Order variance` — an item-level charge against what its order agreed.
`⚠ Check the total` — a document's stated total against its own computed total.
The pair is #179's and is pinned by `offline/variance-copy.mjs` as well.
`Mismatch` is barred here: it belongs to the delivery axis, and one word on two
axes of one page is exactly the defect #179 removed.

### The order's documents (tier 1, `lib/poDocuments.js`)

Headings `Invoices` and `Deliveries`. Empty states `No invoice charges this
order yet.` and `Nothing has been delivered against this order yet.` Badges
`✓ Paid`, `Not paid`, `Over-delivered`.

### Purchase orders (tier 1, `lib/poListView.js`, `lib/poUnsigned.js`)

- `No purchase orders yet. One is generated automatically when a purchase request is fully approved.`
- `No purchase orders to show. You see a purchase order when you can see the request behind it.`
- `No purchase orders match these filters.`
- `N approved requests have no purchase order`, with two voices under it:
  `Generation failed when the request was approved. Generate the order here.`
  for the office and `… Ask the office to generate it.` for everyone else (#176).
- `unsigned`, lowercase, as a suffix inside a dropdown option label (#198).

### Deliveries and pairing (tier 1)

`lib/deliveryAllocation.js` carries the over-delivery banner (`Over-delivered —
N EA delivered beyond what {order} ordered.`), its unattributable twin, the
`(N over)` table mark, and the refusal `Nothing on this job orders this item
from this vendor, so there is no order to record it against.`

`lib/deliveryInvoiceLink.js` carries `One invoice belongs to one delivery, so
one already attached elsewhere is listed but cannot be picked. A delivery can
carry more than one invoice.` and four refusals, two of which are deliberately
the same sentence — `That invoice no longer exists.` answers both "not found"
and "outside your scope", because telling the two apart would confirm that a
record exists outside someone's scope.

`lib/deliveryInvoiceMatch.js` carries the seven pairing sentences, including the
tie-break. `lib/overage.js` carries the correction's preview, its eight
refusals, its five short strip reasons (`no invoice yet`, `invoice and delivery
disagree`, `spans two invoices`, `invoices differ on price`, `invoice has no
file`) and seven banners. **A sixth read `no ordered item` and went in #278**,
with the state it named: a delivery row whose order link was emptied by hand.
Such a row is refused silently now and the strip does not list it. **Three of those reasons are
#265's and this list named the three it replaced** — corrected in #274, which
was sweeping the word one of them carried.

### Sign-in (tier 1, `lib/authTokenState.js`, `lib/productName.js`)

`HYE USA Portal` is the product name and lives in exactly one module; the
company's legal name is a different constant and belongs on the purchase order
PDF, not on a screen. The five token states:
`Press the button to finish signing in on this device.` / `Confirm sign-in` /
`This sign-in link is not valid.` (twice, deliberately — a missing token and an
unknown one say the same thing) / `This sign-in link has already been used.` /
`This sign-in link has expired. Sign-in links last 15 minutes.`

### Items (tier 1, `lib/prItemMerge.js`, `lib/invoiceOrderBreakdown.js`)

`N items repeat an item above them — each will be saved into that item, with the
quantities added.` (#170) and the per-order breakdown line (#237).

### Withdrawal and deletion (tier 2)

`lib/poWithdraw.js` and `lib/deliveryDelete.js` cannot be loaded by an offline
check because both reach `lib/airtable/`. Their words are the two withdrawal
voices (`Withdrawn — the requester ended the plan to order before this PO was
signed. It can't be signed or invoiced.` and the signed variant) and the three
deletion voices, which differ by whether the delivery's ordered items are
uninvoiced, invoiced, or on a paid invoice. All three end `This cannot be
undone.`

The three deletion bodies are the app's clearest example of copy doing work a
visual cannot: they are not warnings but accurate accounts of what becomes
inconsistent, because deletion here is the only correction mechanism there is
and a recorder fixing a typo is doing the expected thing. Whatever a confirmation
dialog becomes, that voice is the point of it.

### Screen headings (tier 3)

`Purchase Requests`, `Purchase Orders`, `Invoices`, `Deliveries`, `Material
prices`, `New Purchase Request`, `New Invoice`, `Record a delivery`, `New Job`,
`New Line`, `New Vendor`, `Check your email`, `Delivery not found`, and
`Edit {document ID}`. The four document detail screens have no heading word at
all — their heading is the document ID.

### A glyph inside a locked string

Four strings carry a glyph as part of the string rather than as a rendered
decoration: `⚠ Order variance`, `⚠ Check the total`, `✓ Paid`, and the em dash
that is `absent`'s entire text. Replacing one with an icon is a change to a
locked word, not a change to its presentation, and the em dash in particular is
a *value* — the thing the cell says — rather than a placeholder for a missing
one. Any icon has to be added beside these, or the constant has to change and
this document with it.

### Two places the app disagrees with itself

Recorded rather than resolved, because settling either is a copy decision and
this document only writes down what is there.

The purchase order list's own heading is `Purchase Orders` and the link to it
from the root screen says `Purchase orders`. One screen, two casings. Every
other list heading is `Title Case` except `Material prices`, which is sentence
case.

`WITHDRAW_COPY` uses contractions (`hasn't`, `can't`) and `DELETE_COPY` uses
`cannot`, in two modals that a reader can meet in the same week.

## Who reads which screen

Two mechanisms, and the distinction is organizational rather than a trust
ladder. **Role-scoped** means a role reaches the screen at all. **Row-scoped**
means anyone signed in reaches the screen and then sees only the records the
rule admits — and a refusal renders the ordinary not-found text, because
confirming that a record exists outside someone's scope is itself a leak.

Office staff all run as Admin, so gating something to Admin scopes it to the
office. Invoicing is Admin because invoicing is office work.

| Screen | Who |
|---|---|
| `/`, `/login`, `/login/confirm` | anyone, signed in or not |
| `/prs`, `/prs/[prId]`, `/pos`, `/pos/[poId]` | row-scoped by `canViewPR` |
| `/invoices`, `/invoices/[invoiceId]` | row-scoped, reaching `canViewPR` through the orders the invoice charges (#211) |
| `/prs/new` | anyone signed in |
| `/deliveries`, `/deliveries/[deliveryId]`, `/deliveries/[deliveryId]/edit`, `/deliveries/new` | anyone signed in, then Job assignment |
| `/materials`, `/materials/[materialId]` | anyone signed in; document identifiers gated per row (#19) |
| `/invoices/new`, `/invoices/[invoiceId]/edit`, `/admin/**` | Admin only |

`canViewPR`, in order, first match wins: a Draft is visible **only** to its
requester, ahead of everything including the office (#143); then
President or Admin; then the requester; then anyone assigned to the PR's Job;
then a signer on the chain; then the recipient of a correction request.

**Two things the design has to accommodate because of this.** A screen can
render *differently* for two readers, not merely show fewer rows — a whole
column can be absent. The invoice list's `Status` column, which carries the
payment word and the total-mismatch badge stacked under it, exists only for a
President or an Admin; for everyone else the table is one column narrower and no
heading marks where it was. So a table's column count is not a constant, and a
layout that assumes it is will break for one of its two readers.

And the same screen can be reached by a reader who sees no rows at all, which is
why the empty states are worded three ways rather than one: nothing exists yet,
nothing you can see, nothing matching your filters. Those three are different
sentences on purpose and a single "No results" would lose the distinction that
matters most — whether the reader is looking at an empty base or at their own
scope.

## Constraints that already exist

Four, and they are the only design rules the codebase has today. Three are
recorded decisions; the first is this document's own.

**Color never carries a meaning by itself.** Every status must be readable with
color removed. **This is stated as a rule here for the first time** — the
codebase has no accessibility, contrast or color-blindness rule anywhere, and a
search of `app/`, `lib/`, `docs/notes/` and the offline checks finds none. It is
written here because the app already satisfies it structurally and the design
should not be free to undo that by accident. What makes it true today: every
chip is built as a key, a text and a tone together, and the one component that
renders a chip renders its text unconditionally, so a chip cannot exist without
its word; and `absent` renders as text with no color at all.

The principle behind it is already in the code, argued twice in a neighboring
form. `QualifierMarker`'s own documentation says a tooltip "opens on neither
touch nor a keyboard", so the sentence it carries is also its accessible name —
a signal available only on hover is not available. #232 then retired that marker
on the same ground: the chip said `Delivered` and the marker qualified it, so a
reader met the normal word first and had to hover for the one that mattered. It
became a chip value in words. A meaning carried by color alone fails the same
test one step further along, which is why the rule reads the way it does.

**Modal styling has a single source.** `app/components/modalStyles.js` holds the
backdrop and the card, imported at six sites. It is the one shape in the app
that is already a primitive rather than a per-page reassembly, and #258 is where
the rest joins it.

**The app is light-only, deliberately.** #218 removed 343 `dark:` variants and
the `prefers-color-scheme` block, and added `color-scheme: light` so the browser
does not decide for the chrome it paints itself — a scrollbar, a `<select>`
popup, a date picker. `scripts/tests/offline/no-dark-mode.mjs` keeps it that
way, and that file's own header says to **delete it** when dark mode returns
rather than widen it or add an exemption. A second appearance is not forbidden;
it is deferred until there is a token layer to own it, which is #258.

**There is no navigation shell.** The root screen carries four links because a
new route is otherwise reachable only by typing its URL. Every "back" affordance
in the app is a per-page link written by whoever added the page. This is an
absence rather than a decision, and it is the largest single gap a design will
find.

## How a screen brief reads

One file per page, named after its route. Each carries two header lines and four
sections, always in this order:

- `Route:` the URL template, and `Who reaches it:` one line from the table above.
- **What it answers** — the question the reader arrived with.
- **What it always carries** — every fact on the screen, each tagged
  identity / verdict / evidence / action.
- **What it carries only sometimes** — one entry per condition, each stating
  what appears, when, and what stands there the rest of the time. Usually
  nothing does, and that is written out.
- **What must agree elsewhere** — the cross-screen constraints, each naming the
  other screen.

The title of each file is the name a person uses for the screen, not its route,
and it is drawn from the app's own words: a list screen's title is its own
heading verbatim, and a detail screen — whose heading is a document ID — takes
the record word from the list that holds those records. So `Purchase orders`
gives `Purchase order detail`, and no title invents vocabulary the screens do
not already use.

# Addresses — the reasoning

Governs `app/addresses/**` and `lib/address*.js`. **Read this before editing
there** — CLAUDE.md carries only the rules that bind code outside this area; the
derivation, the evidence and the alternatives weighed are here.

`lib/airtable/addresses.js` is NOT governed by this file: it is under
`lib/airtable/**`, which `airtable-access.md` and `naming.md` already govern, and a
third required file for one service module would be a hop nobody makes. What is
here about that module is the reasoning its header points at.

---

### Giving a job as many addresses as it uses (#384)

`Jobs` held `Delivery Address` and `Alternate Delivery Address`, so a job could
name exactly two places to ship to and a third meant adding a field. Addresses
were also created by hand in Airtable while the jobs and vendors linking to them
were created in the app. Both halves are this issue.

**IT IS THE FIRST OF FOUR AND THE OTHER THREE REST ON IT.** #385 puts a
`Delivery Address` on a purchase request, #386 freezes it onto the purchase order
and converts `Purchase Orders."Delivery Address Used"` from a select to a link,
#387 records where a delivery actually arrived — and inventory, after that, is
counted per address. So the field names and the way an address is picked are this
issue's to get right for three issues that have not started.

#### What the base carried, measured before anything was changed

Every figure below was read from the live base on 2026-09-14.

| Fact | Measured |
|---|---|
| `Addresses` rows | **1** — `Lone Star Pipe & Supply - Main`, linked from `Vendors` only |
| `Jobs` rows | 2, and **neither holds a `Delivery Address` or an `Alternate Delivery Address`** |
| `Purchase Orders` rows | 34, and **all 34 hold `Delivery Address Used: Primary`** |
| Code writing `Alternate Delivery Address` | `createJob`'s parameter, with **no caller** — `/admin/jobs/new` does not pass it |
| Code rendering it | one block on the purchase order document, and nothing else |

**SO THE PO DOCUMENT HAS NEVER PRINTED A DELIVERY ADDRESS ON THIS BASE.** With no
job holding one, `fmtAddress(null)` renders `—` under `*Deliver To` and the
alternate block has never rendered at all. That is worth knowing before reading
the change as risky: what it removes is a branch nothing has reached.

**AND THE JOB ADDRESS THE DEMO SEED WRITES IS NOT ON THE BASE.**
`seed_demo_fixtures.mjs` creates `Round Rock Compressor Station - Site` inside the
branch it takes when the Job does not exist, and `26-DEMO-01` already existed the
last time it ran. That is `verification.md`'s own recorded hazard — adding
coverage to a seed does not cover an already-seeded base — reproduced exactly.

**NO BACKFILL, BECAUSE THERE IS NOTHING TO BACK FILL.** No job uses an alternate
address, no job/address pair exists to move into the new link, and no stored
`Delivery Address Used` value is lost. This is the cheapest moment this change
will ever have.

#### The union, and the invariant it removes

A job reaches an address two ways after this issue: `Addresses."Jobs"` names every
job that uses an address, and `Jobs."Delivery Address"` names the one that is the
default. **Neither is a subset of the other and nothing keeps them in step.**

The obvious alternative was to require the default to be a member of the set, and
it was refused on three counts. It is a rule with no schema behind it, in a base
where `prefersSingleRecordLink` being unwritable already leaves one invariant on
the DATA. It has **no writer in this issue** — nothing in the app writes a job's
default address at all, so the code enforcing it would have no caller, which is
the `upsertMaterial` hazard CLAUDE.md names. And its failure mode is silent in the
worst direction: a default missing from the set is exactly the address the create
screen has to show, since the job's own default is the one a requester is most
likely to retype.

`lib/addressCreation.js:addressesOnJob` is the one rule, and it takes the union.
`offline/address-creation.mjs` holds it with two SEPARATE paths rather than one
assertion phrased twice — one fixture address reachable only as the default and
one only through the address's own link — so dropping either clause drops a named
row. Both mutants were run.

**THE DEFAULT IS NOT MARKED ON SCREEN**, and that is a decision rather than an
omission. The list exists so a person does not type a second spelling of a place
that already has a row, and which one is the default does not change that. The
word for the default belongs to #385's form, where a requester chooses between the
default and a different one; coining one here would commit that issue to it.

#### The label stays human-typed

`Address Label` is the primary, a `singleLineText`, and it stays one — which makes
it the one `X Label` primary on this base that is not composed from other fields.

**THE CATALOG'S ARGUMENT DOES NOT REACH IT.** `Material Categories."Category
Label"` is a formula because somebody adding one of 777 reference rows by hand
would eventually type one wrong, and `lib/materialCategory.js` says **nothing here
writes a label**. Addresses are created by the app from this issue on, so the
by-hand path that argument is about is the one this issue removes. The tables are
also different kinds of thing: a catalog row is HQ's, loaded re-runnably from a
committed CSV, and an address is a place somebody at this company decided to ship
to.

**WHAT A COMPOSED LABEL WOULD COST IS THE HALF NO COMPONENT CARRIES.** Which site,
which gate, whose yard. Five addresses in one city all rendering
`910 Industrial Pkwy, Round Rock, TX` in a dropdown is worse than one reading
`Round Rock yard — gate 3`, and the dropdown is what #385 is building.
`Formatted Address` is already the composition of the components, so a composed
label would be a **second formula over one set of inputs** — the duplication
CLAUDE.md's own section refuses.

**AND THE CONVERSION IS NOT FREE, WHICH #381 ALREADY MEASURED.** A field's TYPE
cannot be PATCHed (422, `Changing a field's type or number precision is not
currently supported`), so it is a hand conversion in the UI that drops every
stored value. That issue refused a formula primary for a person's name on exactly
this ground.

**SO THE UNIQUENESS RULE IS THE APP'S**, and it is `Tools."Tool Name"`'s, down to
the lock key: `textMatchKey` folds case and internal whitespace,
`getAddressByLabel` makes the matching `LOWER(TRIM(…))` comparison Airtable's
case-SENSITIVE `=` cannot, and `createAddressIfLabelFree` holds the read and the
write under one `withKeyLock`.

- **IT REFUSES WHERE `upsertTool` FOLDS, AND THE DIFFERENCE IS WHAT ELSE IS
  TYPED.** A tool name is the whole of that row's identity, so a second
  submission under one name is the same tool. An address label arrives beside a
  street, a city and a zip, so folding would silently discard the second person's
  street and leave them believing they had recorded it. The refusal names the
  address that exists, which is the thing they actually wanted.
- **ONE SENTENCE FOR THE PREVIEW AND THE REFUSAL.** The form says it against the
  list the browser loaded and the action says it after asking Airtable under the
  lock. A second wording would be two words for one collision the first time
  either was reworded, so both call the builder and the check asserts the call.

#### Who may create one

**`requireUser()` — any active session — and the three `/admin` create forms are
the contrast rather than the precedent.**

Gating something to Admin scopes it to the OFFICE rather than to a higher trust
tier; CLAUDE.md states that as an operating convention and this is the first issue
to turn it around and ask what it excludes. A job code is an accounting artifact
and a vendor is a commercial relationship — both the office's to author. **A place
is neither, and the person who knows it is the site staffer who talked to the
vendor.** That is #281's own test, one axis over: the act belongs with whoever
holds the fact.

The second half is structural. #385 sends a requester here from the request form
when the address they need has no row yet, so an Admin gate would make this screen
a dead end for the exact reader it was built for.

- **IT IS THE ONE EXEMPTION IN `authz-structure.mjs` WITH NO PER-RECORD
  COMPARISON BEHIND IT, and it says so rather than borrowing a reason.**
  `REQUIRE_USER_AXIS` claims "the actual authorization is the record-by-record
  comparison in the body", which would be untrue of this export and would make the
  list's shortest entry read as its strongest. An `Addresses` row carries no owner,
  no money and no authorization; a session really is the whole gate.
  `SESSION_ONLY_AXIS` is that sentence.
#### The job picker offers every job, and that is a different axis

**`Users."Assigned Jobs"` gates an act that makes a CLAIM, and attaching an address
to a job makes none.** The base has two rules reading that field and both fit that
description. `canAccessJobDeliveries` gates a delivery, which says material arrived
on a job. `assignedJobsFor` gates a `Tool Log` row, and `lib/toolJob.js` says
outright that the job there is "the job the event HAPPENED on" — so an actor filing
against a job they are not on is making a false statement about themselves, which
is why that axis is narrower than the delivery one and has no office clause.

`Addresses."Jobs"` says a place is somewhere a job ships to. No quantity, no money,
no timestamp, no actor; nothing reads it but the screen that writes it. There is no
statement for an unassigned person to falsify, so there is nothing for an
assignment to protect.

**THE DECIDING PRECEDENT IS THE SCREEN THAT SENDS THE READER.** `/prs/new` offers
every job to every requester — its own comment says the assigned ones group first
"without ever hiding the rest" — and a purchase request is far heavier than an
address: it commits money, starts a signing chain and becomes an order. If the app
lets any employee raise a request against any job, an address screen refusing that
same job is a dead end at exactly the hop #385 builds, which is the Admin-gate
argument one level in.

- **`assignedJobsFor` IS DELIBERATELY NOT REACHED FOR, and this is the case
  `naming.md`'s `canAccessJobDeliveries` row is about read the other way.** One
  implementation under a narrow name beats two only when it is the SAME question.
  That function's own module defines it as the tools axis's rule; a fourth caller
  asking a different question would make the next reader of `lib/toolJob.js`
  believe an address is an event filed against a job.
- **WHAT THE ASSIGNMENT DOES IS GROUP, and that much was worth fixing here.** The
  first cut sorted every job by code, so an employee on one job scrolled past the
  rest — fine at two jobs and a defect at forty. The picker takes `/prs/new`'s
  partition and its three labels verbatim (`My Jobs` / `All Jobs`, and `Jobs` when
  the reader has no assignment), because two screens naming one grouping two ways
  is the drift this repository sweeps for. It costs no query: `requireUser()` has
  already returned the record `assignedJobs` sits on. The one difference is that
  those words are a copy constant here and JSX literals there, which is this
  repository's stated direction rather than an inconsistency for an issue about
  addresses to resolve — `offline/address-creation.mjs` pins the three by value
  against `PRForm.js`, so rewording that picker fails here rather than quietly
  leaving the app grouping one thing two ways.
- **`getAllJobs()` IS THEREFORE THE RIGHT CALL** and not a widening: a job's
  identity is not scoped in this app, so a job's code and name are already on
  `/prs/new` for every reader, and a job's address list cannot leak one.

#### What the removal cost on the order axis

`Jobs."Alternate Delivery Address"` had one render and one interim consequence.

**THE DOCUMENT'S SECTION TITLE LOST ITS QUALIFIER.** It read `*Deliver To (Heavy
Load)` over the job's default and `*Alternate Delivery Address (Fedex, UPS etc..)`
over the second slot. `(Heavy Load)` only ever meant "not the parcel address", so
with no parcel address to contrast with it names a distinction the document no
longer draws. It reads `*Deliver To`. **A vendor reads this line**, which is why it
is called out separately rather than folded in with the code change.

**`Purchase Orders."Delivery Address Used"` IS LEFT ON THE BASE AND READ BY
NOTHING.** With no alternate, a Primary/Alternate select names a choice the base
cannot express. The field and all 34 values stay for #386, which converts it to a
link copied off the request — deleting it now would lose the values that
conversion starts from, and the Metadata API has no field DELETE anyway. What #384
does is stop rendering it, because a screen must not state a distinction the data
no longer has.

- **AND THAT TOOK THE PURCHASE ORDER DETAIL'S LAST READ-SIDE PRIVILEGE FLAG.**
  `isOffice` guarded that one line and nothing else once #309 deleted
  `seesPayment`, so it went with the line: every fact `/pos/[poId]` renders is now
  readable by every viewer who can see the order, and only the write controls are
  gated, each on its own action's gate. `offline/source-shape.mjs` chose between
  three flag names for those controls and chooses between two now, with an
  assertion that `isOffice` stays gone — a re-appearance is either that line coming
  back without its issue or a write control being re-gated on the office.
- **#386 PUTS AN ADDRESS BACK IN THAT BLOCK, UNGATED.** Where an order was sent is
  not office-only information, which is the same reading #211 applied to what a
  vendor invoiced and #309 applied to payment.

---

#### One false comment, corrected on sight

`lib/poGeneration.js` said the President could change `Delivery Address Used` on
the signing screen before signing (issue #12). **There is no such control and no
update path** — the value is a parameter of `createPO` and appears nowhere else
that writes, which is also why all 34 rows hold the same value. Corrected per #181
in this issue's own commit rather than filed.

#### What this issue did not do

- **`Jobs."Delivery Address"` has no writer in the app** and did not get one. The
  only paths that set it are `createJob` (the admin form does not pass it) and the
  demo seed. A screen for editing a job's default address is a different issue and
  is what would first need the default-is-in-the-set question answered.
- **No address list and no address detail screen.** The only reader of an address
  outside the create screen is the purchase order document.
- **No verification script for any of this.** The offline tier holds the pure
  rules and a browser walk holds the screen; what neither reaches is the lock
  under concurrency and whether `Addresses."Jobs"` is still named that on the
  base. Both are the standing limits `verification.md` records for this tier
  rather than gaps this issue opened.

---

### Putting the address on the request (#385)

The address was read off the job wherever anybody needed it, so a request that
had to ship somewhere other than the job's usual place could not say so — and the
requester is the only person who knows. `Purchase Requests` gains a
`Delivery Address` link, the form asks for it, and #386 freezes it onto the order.

#### The form asks in two branches, and the branch is not stored

**`Purchase Requests."Delivery Address"` is one link whether the requester took
the job's default or picked another**, so the two branches are a way of PICKING
rather than a distinction the base keeps. Three things follow, and they are the
whole design: the form submits one address id, a resumed draft has to DERIVE
which branch displays it truthfully, and the action validates an id instead of
re-deciding a branch.

- **THE BRANCH EXISTS BECAUSE THE COMMON CASE DESERVES ONE GLANCE.** One picker
  preselected to the job's default would store the same link and make every
  requester scan a list to confirm the answer they already wanted. It is also
  what answers "what narrows the list": a requester on the default never opens
  it.
- **AND IT COLLAPSES WHERE THERE IS NOTHING TO DEFAULT TO, WHICH IS THE ORDINARY
  STATE ON THIS BASE.** No job holds a `Delivery Address` and no screen in this
  app sets one, so a two-way question whose first answer is unreachable would be
  a screen drawing a distinction its data cannot make — #384's reading of
  `Delivery Address Used`, one screen over. With no default the picker is shown
  and the copy says why, naming the JOB rather than the requester: they have done
  nothing wrong.
- **THE ACTION RE-DERIVES NOTHING, AND THAT IS A DECISION.** What arrives is an
  address id; what the action owes is a refusal when it is missing and a check
  that it names a row. Re-deriving the default would make the write depend on the
  job's default as it stands at SUBMIT rather than as the requester saw it, which
  is `Purchase Orders."Sent To"`'s reading — a record of what the app did beats a
  re-read of terms that may have moved.

#### The picker offers every address, and grouping is the narrowing

The issue body says "the addresses already on the base" and that is right.
Offering only `addressesOnJob` would leave a requester who needs a place another
job already uses recording a second row for it — **#384's own defect, one screen
over**, and borrowing a place is the case this whole chain started from.

So the list is every address, the job's own first, in `/prs/new`'s own
`My Jobs` / `All Jobs` shape and #384's. `addressesOnJob` is CALLED rather than
copied, which makes it that function's second caller; the move condition is
written beside it now rather than left to be re-derived.

- **THE VENDOR'S OWN ADDRESS IS IN THE SECOND GROUP AND IS NOT FILTERED OUT.**
  `Addresses` holds two kinds of place — somewhere we ship TO and somewhere a
  vendor IS — and `Lone Star Pipe & Supply - Main` is the second. Hiding it needs
  a rule no screen in this app states, and it would remove an answer a requester
  may want: collecting from a supplier's counter is ordinary here. Nothing is
  hidden and the grouping does the work.
- **THE CONDITION FOR A SEARCHABLE CONTROL IS MEASURABLE**, which is what keeps
  this from being a judgment somebody re-opens: when the second group no longer
  fits a screen — about twenty rows — the shape is
  `app/admin/disciplines/new/JobCombobox.js`. Three addresses today.

#### The way out saves the draft first

A requester whose address has no row yet has to leave a half-filled form. The
control is `Save draft and add an address` and the label is the whole of what
makes it honest: **it saves before it navigates, and a failed save does not
navigate at all.** A plain link there would discard items, quotations, signers
and notes — the one thing somebody sent away to create an address must not lose.

Nothing new was built for it. `saveDraftAction` already RETURNS
`{ savedDraft: { prId, recordId } }` rather than redirecting, `?draft=` already
re-opens a saved draft (#74), and `/addresses/new?job=` already takes a job
(#384). What this issue adds is `?from=`, the request waiting for the address,
which puts a line and a way back on that screen.

- **`?from=` IS JUDGED BY NOTHING, AND THAT IS THE POINT.** It is a `PR ID` and
  not an address, so there is no destination for `lib/loginDestination.js`'s
  predicate to judge — the way back is `/prs/new?draft=<it>`, which this app
  builds. That screen resolves the id against the READER'S OWN drafts, so a
  forged one matches nothing and the form opens empty.
- **THE `Draft saved` MODAL STANDS DOWN ON THAT PATH.** The save is identical;
  what differs is what it was for, and a modal offering the PR list would
  interrupt the one act the requester asked for.
- **A NEW TAB WAS THE ALTERNATIVE AND IS WORSE.** It needs no draft save, and the
  returning tab's address list is the one loaded before the address existed — so
  the requester reloads and loses the form anyway.

#### Required at submit, not at save

Every required field on this form has that shape: a draft saves half-finished
(#72) and `createPRAction` is what refuses. An optional address would leave the
order document printing a dash where a vendor reads the ship-to, which is the
state this chain exists to end, and would hand #386 and #387 a nullable link to
build on.

**The 39 requests on this base are not backfilled**, which is #170's sentence one
field over: "no request carries an address" is not a property of the base. Thirty
are `PO Signed` and one is `Withdrawn`; **six are `Approved` and can still
generate an order**, so #386 will meet an empty link on those — the same empty it
would read off the job today, and that issue's to carry rather than this one's.

#### One measurement, and a second figure for one screen

`/prs/new` costs **14 operations before and 15 after**, measured as
`scoped-fixture@`. The address control adds exactly one `list`: `getAllAddresses`
is the whole table in one query and the job's own default rides free on
`getAllJobs`, which has carried `deliveryAddress` since #384.

**That 14 is not `airtable-access.md`'s 22 gone stale.** This page costs what the
READER's own request history costs, because `getDraftsByRequester` walks every
request its requester ever raised; the 22 was an Admin with 27 of them and this
is a requester with none. Recorded in that file beside its own figure, because
two numbers for one screen with no account beside them is the thing a later
reader cannot resolve. **#248 took that dependency out**: the Drafts cost every
reader the same one query since then, so what an account has filed no longer
moves this page's figure — whether it holds a Draft still does, through the
resume prompt's load.

---

### Freezing it onto the order (#386)

Third of the four. `docs/notes/purchase-orders.md` owns the issue — the field, why
the select was replaced rather than retyped, what an order with no address does,
and the figures. Two things belong here, because they are about the CHAIN rather
than about the order axis.

**THE JOB STOPPED BEING READ FOR AN ADDRESS ANYWHERE, AND THAT WAS THE POINT OF
THE CHAIN.** #384 removed the second slot, #385 put the question on the request,
and this issue removed the last live read: `lib/poPdf.js` resolved
`job.deliveryAddress` on every render, so a job edit moved a ship-to on a document
a vendor had already been emailed. Nothing in the app now reads a job's default
address except the form that offers it as a choice — which is what
`lib/addressChoice.js:jobDefaultAddressId` is for and its only remaining purpose.
**`Jobs."Delivery Address"` is therefore a form default and nothing else**, which
is worth knowing before #387 or a job-address editor reaches for it.

- **`lib/addressChoice.js` WAS READ AND DELIBERATELY NOT USED.** The obvious hop
  is that an order needs the module that knows about addresses; it does not. That
  module is the rule for PICKING one — two branches, a grouped list, a resumed
  draft's derivation — and an order picks nothing, so importing it would make a
  screen about a frozen copy depend on a form's module. What the two screens do
  share is one word, and `PO_ADDRESS_COPY.label` is pinned to
  `ADDRESS_CHOICE_COPY.label` BY VALUE in `offline/po-delivery-address.mjs`, which
  fails if either is reworded alone. Same shape `offline/address-creation.mjs`
  already uses to pin `/addresses/new`'s three group labels against `PRForm.js`.

**THE 39-REQUEST FIGURE IS 40, AND ONE OF THEM CARRIES AN ADDRESS.**
#385's own section says thirty are `PO Signed`, one `Withdrawn` and six `Approved`;
`HYE-PR-260915-01` was raised through the new form afterwards and holds
`Leander Yard - Gate 3`. It is the first and only request on this base with one,
which makes the order generated from it **the first order on this base that
carries a delivery address at all** — and the only row either #386 or #387 can be
looked at against. The six-`Approved` sentence is still right about the status and
wrong about what follows from it; the correction is in `purchase-orders.md`, where
the generation path is.

---
### Recording where it arrived (#387)

Last of the four. `docs/notes/deliveries-and-invoices.md` owns the issue — the
default rule, the four states, the refusals and the figures. Two things belong
here, because they are about the CHAIN rather than about the delivery axis.

**THE CHAIN IS CLOSED, AND WHAT IT BUILT IS A LOCATION.** #384 gave a job as many
addresses as it uses, #385 put the question on the request, #386 froze the answer
onto the order, and this records where the material was actually delivered. Four
issues for one field because each is a different FACT: a job's default is a habit,
a request's is an instruction, an order's is what a vendor was told, and a
delivery's is what happened. The chain exists because inventory is counted per
address, and `Deliveries."Delivery Address"` is the one of the four a quantity on
hand is counted by — which is why it is the only one of the four that is not
editable after it is written.

- **NOTHING IN THE APP READS A JOB'S ADDRESS AS A DOCUMENT'S ANY MORE.**
  `Jobs."Delivery Address"` has exactly one reader left: `/prs/new`, where it is
  the preselected branch of a picker, and `addressesOnJob`, where it is one arm of
  the union that groups a list. It is a FORM DEFAULT and nothing else. #386 removed
  the last live read on the order axis and #387 declined to open a new one on the
  delivery axis — the fallback there costs one token and was refused on the record.
  **That is the sentence to check before a job-address editor is built**, because
  such a screen would change a form's default and nothing else, which is a much
  smaller change than it looks.

**AND THE FOUR ADDRESSES ON THIS BASE ARE NOW REACHED FROM FOUR DIFFERENT PLACES**,
which is worth stating because #384 measured one row reachable from one link.
`Addresses` carries reverse-links from `Vendors`, `Jobs` (twice — the default and
the union), `Purchase Requests`, `Purchase Orders` and `Deliveries`. Every one of
them was created by a script in this chain and named by hand afterwards; the
inverse Airtable auto-creates took the source table's name correctly in all of
them, which is the fifth and sixth confirmation of #334's 5-of-5 measurement.

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

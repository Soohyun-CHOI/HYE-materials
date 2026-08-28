# Strings `screen-strings.mjs` cannot find

**What a re-run of the extractor does not produce, grouped by the SHAPE that hides
it (#288).** Read this before trusting a list the extractor made, and read it again
before writing something shaped like one of these.

The extractor gives a string, the file and line it comes from, and the shape it sits
in, for every screen, in seconds. This file is the rest — and it is grouped by shape
rather than by screen because its reader is someone fixing the extractor or about to
write a new string, and both of those questions arrive per shape. The screens are a
column.

## The test that decides whether a shape can be closed

Five shapes were closed while this file was being written and one was deliberately
left open. What separated them was one question:

> **Did the screen call that string, or did it call something that HAS that
> string?**

A screen that names a string has called it, and the tool can see a name — that is
what closed `label:`, `message:`, a string map or set read through a JSX child
container, and a bare string const the screen imports. A screen that calls a
FUNCTION has called the function, and the string inside belongs to that function's
own purpose: seeing it means entering somebody else's body and dragging their log
lines and thrown messages out with it. `lib/materialPriceView.js:statusTag` is the
worked example below, and it stayed open on that ground — three strings by hand
against an over-reach whose size nobody had measured.

**A closed shape has a cost and the cost is recorded, not hidden.** Reading a
`label:` property also collects `confirmIngestThenDelete`'s cleanup labels, which no
reader sees. That is stated in the extractor's own header and shows up as one
over-reach per screen that uploads a file. An over-reach that is named is cheaper
than seven strings of hand work; an over-reach that is filtered by a list of names
is the thing this whole exercise is against.

## A — A copy constant reached only through a function

**The largest group by far, and the one with a locked word in it.** A screen imports
`describeInvoiceColumn`, not `STATUS_COPY`. The function returns the copy; the
screen never names the constant; no rule that follows names can attribute a word of
it.

**Why it cannot be closed by a name.** The link between the screen and the string is
a return value, so seeing it means dataflow: resolve the function, find which
constant it reads, and decide which member the call site reaches. Each of those is a
different kind of work from looking up an identifier, and the last one cannot be
done at all where the member is chosen at runtime.

**The unit here is the constant, not the string.** A sweep opens
`lib/deliveryStatus.js` and edits `STATUS_COPY`; it does not visit seventeen
sentences one at a time. The piece counts below are string literals and template
chunks, so a concatenated sentence counts more than once.

| Constant | Module | Reached through | Screens | Pieces |
|---|---|---|---|---|
| `STATUS_COPY` | `lib/deliveryStatus.js` | `describeInvoiceColumn`, `describeDeliveryColumn`, `describePOColumn`, `describePOInvoicingColumn` | `/invoices`, `/deliveries`, `/pos`, `/pos/[poId]` | 17 |
| `OVERAGE_COPY` | `lib/overage.js` | `describeOveragePreview`, `describeOverageBanner`, `tieBreakLabel` | `/deliveries/[deliveryId]`, `/deliveries/[deliveryId]/edit`, `/pos/[poId]`, `/prs/[prId]` | 94 |
| `PAIRING_COPY` | `lib/deliveryInvoiceMatch.js` | `describePairing`, `describeTieBreak`, `planPairings` | `/invoices/[invoiceId]`, `/deliveries/new` | 31 |
| `ALLOCATION_COPY` | `lib/deliveryAllocation.js` | `describePlan`, `itemOptionLabel` | `/deliveries/new` | 38 |
| `DELETE_COPY` | `lib/deliveryDelete.js` | `resolveDeleteCopy` | `/deliveries/[deliveryId]` | 22 |
| `LINK_COPY` | `lib/deliveryInvoiceLink.js` | `availableInvoiceOptions` | `/deliveries/new` | 11 |
| `WITHDRAW_COPY` | `lib/poWithdraw.js` | `getWithdrawCopy` | `/pos/[poId]` | 5 |
| `AWAITING_PO_COPY` | `lib/poListView.js` | `awaitingPOCopy` | `/pos`, `/prs/[prId]` | 4 |
| `ROLLBACK_COPY` | `lib/rollbackReport.js` | `rollbackMessage` | `/prs/[prId]` | 15 |
| `RESTORE` | `lib/rollbackReport.js` | `rollbackMessage` | `/prs/[prId]` | 8 |

**#188's two are the group's first entries that were VISIBLE before the issue moved
them.** Three of `ROLLBACK_COPY`'s fifteen pieces are the sentences the three signing
actions used to hold inline, where the extractor read them off the `error:` property.
They went behind a builder because the failed-rollback voice they now pair with is
reachable only when an Airtable write fails inside a rollback — so a check that
cannot CALL it cannot see it at all, which is the worse blindness of the two. Four of
the words are pinned by `offline/screen-briefs.mjs` in exchange, which is more than
this group's other entries have.

**AND THE MOVE PRODUCED A FALSE ENTRY BEFORE IT PRODUCED A MISSING ONE, which is the
part worth carrying.** `rollbackMessage("returnForCorrection", …)` is the value of an
`error:` property, so the extractor read the ACT KEY as a string the screen renders
and put that word into `/prs/[prId]`'s inventory as copy. A missing string is a gap a
reader can be warned about; a fabricated one is believed. The fix is that no builder
called in that position takes a bare string — `ROLLBACK_ACT` exists for it and
`offline/rollback-report.mjs` pins it — and the general form is the entry below: the
`error:` and `label:` rules read a position, so what sits in that position had better
be prose.

**Three of `STATUS_COPY`'s seventeen are words `_shared.md` locks as tier 1**, and
they are the reason this group leads the file. `Delivered`, `Mismatch` and
`Awaiting delivery` reach `/invoices` through `describeInvoiceColumn`, and the same
constant supplies `Invoiced` / `Partly invoiced` / `Awaiting invoice` to
`/deliveries` and `/pos` and `Partly delivered` to the order axis. **A vocabulary
sweep working from the extractor alone would stand on a list with those words
missing from it, on the screens where the delivery axis and the invoicing axis
meet.** The em dash that `absent` renders is in the same constant and equally
invisible.

`DELETE_COPY` and `WITHDRAW_COPY` are doubly out of reach: both modules import
`lib/airtable/`, so no offline check can load them either. The briefs already call
their words tier 2 for that reason.

**THE FIRST VOCABULARY SWEEP TO READ THIS GROUP BY HAND FOUND IT ALREADY RIGHT, and
that is the more useful result (#303).** That issue settled what a row of each of the
four item tables is called, so every one of these constants was a candidate. Six say
`ordered item` and none says a bare `item` for a `PO Items` row: `DELETE_COPY`'s three
deletion voices, all ten of `PAIRING_COPY`'s sentences, and `RESTORE.items`, which is
`the items you edited` about `PR Items` on a request's own page and correct with the
modifier dropped. The two defects the sweep did fix were both in strings the extractor
produces — one written straight into JSX and one an `error:` property — so a sweep
standing on the tool alone would have found them both. **What it would have missed is
the EVIDENCE**: `ordered item` being what the app's least visible, most recently
argued copy already says is half the reason the noun went the way it did, and none of
it is in the extractor's output. Read this file for what a decision rests on, not only
for what a sweep has to edit.

## B — A string literal returned directly by a `lib/` function

`lib/materialPriceView.js:statusTag` returns `PO unsigned`, `PO withdrawn` and
`PO: {status}` as bare literals. There is no constant to attribute. Both
`/materials` and `/materials/[materialId]` render one of them beside every vendor
row.

**Left open on purpose.** The screen imports `statusTag`; it did not name these
words. Collecting them means walking the body of every `lib/` function a screen
imports, which also collects that function's thrown messages and log text — and the
size of that over-reach is unknown until all twenty-one screens are run against it.
Three strings is three lines by hand.

**This is the entry to read before writing another one.** A `lib/` function that
returns prose puts that prose outside every tool in this repository: the extractor
cannot see it, `offline/line-vocabulary.mjs` reads `*_COPY` declarators and not
function bodies, and no brief quotes it. Put a sentence in a `*_COPY` constant and
the function returns a key, or accept that it lives only here.

## C — Another entry point's message

| String | Screen | Authored in |
|---|---|---|
| `Email must be a company address` | `/login` | `lib/auth.js:26`, thrown; serialized by `app/api/auth/request/route.js:18` |
| `Email is required` | `/login` | `app/api/auth/request/route.js:10` |

**Unclosable in principle.** The screen renders `{errorMessage}`; the words are two
files away in a different entry point, and nothing that walks a route's own files
will ever reach them. The second is also the clearest `unreachable` entry in the
other file — the input is `required`, so no reader can produce it.

## D — A string SET passed as a prop, where the members are found and the set is not

`STATUSES` in `app/pos/page.js:41` and in `app/prs/page.js:23` are each a Status
filter's option list, declared on the page and handed to a client component as a
prop. The container rule that catches `CONFIRMATION_TYPES` does not reach them: the
identifier is read in an ATTRIBUTE, and the rule stops at attributes because that is
what keeps every `className` out.

**What is lost is the set, not the words** — and `--check` is what established that,
by reporting `Signed`, `Withdrawn` and `Approved` as strings the extractor produces
after this entry had claimed otherwise. Each appears on its own screen from another
site: a comparison operand in `POListClient.js`, `PO_SENT_STATUS` imported by name,
an `Awaiting Signature` elsewhere. So a reader scanning the output finds every word.

What no output says is that those words are one filter's options — which is a fact
about the screen rather than a string, and it puts this group with E rather than with
A. **The screen did name these strings**, so the test at the top says closable; doing
it means following a prop into the component that renders it, which is dataflow
rather than a name.

Both sets are also Airtable `Status` option values spelled into `app/`.

## E — Composed across files

**Every screen's browser tab, and two more.** A tab title is the route's own
`metadata.title` run through `app/layout.js`'s `%s · …` template with
`lib/productName.js:PRODUCT_NAME` inside it. All three parts are found; the composed
value — `New Invoice · HYE USA Portal` — exists in no file, so nothing can produce
it as a string.

The same shape without a template: `poOptionLabel`'s `{poId}` and `{poId} —
unsigned` on every screen with an order picker, and `{N}d` on the two strips above
`/invoices`.

**Unclosable, and not really a gap.** A reader scanning the extractor's output finds
every part. What is missing is the joining, which is a fact about the screen rather
than a string in a file.

## F — A template that is all interpolation

| String | Screen | Source |
|---|---|---|
| `{Item Name} {Size} — {qty} {unit}` | `/invoices/[invoiceId]` | `lib/invoiceOrderBreakdown.js:169`, `ORDER_BREAKDOWN_COPY.charged` |
| `That item` | `/invoices/[invoiceId]` | `lib/invoiceOrderBreakdown.js:179`, the `||` fallback in `itemLabel` |
| `{itemName}{ — size}{ (Uninvoiced: n)}` | `/invoices/new` | `InvoiceForm.js:1494-1498`, four containers in one `<option>` |
| `Changing the {Vendor\|PO} will clear the items you've entered so far. Continue?` | `/invoices/new` | `InvoiceForm.js:180`, `confirmChangeMessage` |

The first three have no literal run long enough to be worth finding — ` — `,
` (Uninvoiced: ` and a space are what a tool would report. The fallback is group B
one level down. **The fourth is the only helper-returned template of prose in the
whole app** — swept for and found once, at `confirmChangeMessage` — and it is the
one member of this group a rule could plausibly reach, by collecting a template
returned by a lower-case module-level function.

## G — Declared-only closed vocabulary

`info`, `warning`, `no-vendor`, `no-job`, `matched` on `/invoices/new`, and `idle`
on `/login`. Each is declared in an array or an object and never compared with
`===`, so the extractor — which finds a closed vocabulary's compared members and its
`key` properties — sees nothing of it.

**Nobody reads these, and that is exactly why they matter.** #274's `billed-more`,
`order-billed`, `billed-short` and `billed-over` were four uses of a barred word
that `copyStrings` skipped by structure and the identifier walk never visited. Those
four were `key` properties and are covered now. A value that is only ever assigned
is not, and closing it would mean treating every module-level string as a
vocabulary.

## What was closed, and what it cost

Five shapes went during the pass that wrote this file, and #185 NARROWED a sixth
rather than closing one. Each is a rule in `scripts/screen-strings.mjs` and each has
its reason in that file's header.

| Closed | Rule | Yield | Cost |
|---|---|---|---|
| a `label:` property | read the property as the attribute already was | 7 strings | one over-reach per screen that uploads a file |
| a `message:` property | the same, one word wider | 7 strings | none found |
| a string map read through a JSX child container | the signal is the container, not the name | 3 strings | none — `className` is an attribute, so a CSS map cannot enter |
| a string SET read the same way | the array case of the rule above | 2 strings | none found |
| a bare string const the screen imports by name | the signal is the import, not the spelling | 1 string | none — an object or a number cannot enter |
| **narrowed:** a thrown message, when the file is `"use server"` (#185) | the directive, not a list of files | **−9 strings** | a client throw is still collected, and two of the three left are console-only |

**Twelve shapes were met; five closed; seven are above.** The count of strings the
extractor cannot produce on the five screens that had a full hand inventory went
**42 → 26** across the first three fixes, and the last two took the remaining sets
off `/prs/new`, `/pos` and `/prs` before they were ever written down.

**THE NARROWING IS THE OTHER DIRECTION AND IT MATTERS MORE THAN ITS SIZE.** Every row
above added strings the tool could not see; #185's took away nine it should never
have produced, and this file's own warning is why that is the worse defect: *a
missing string is a gap a reader can be warned about; a fabricated one is believed.*
The rule collected `new Error(...)` anywhere, so `PR not found`, `attachment fetch`
and seven more were counted as text a screen renders. **Nothing in this app renders
them** — `app/` has no `error.js` and no `global-error.js`, so a thrown Server Action
message reaches the framework's own default and never becomes copy. The signal is the
`"use server"` directive rather than a list of files, so a new Server Action inherits
it; `unreachable.md` had already had to excuse one of the nine by hand, which is what
a false entry looks like before anyone names the class. A CLIENT throw is still
collected, and correctly: `/login` catches its own and renders `err.message`. Of the
three left, that one is real copy and two are console-only — an over-reach named
here rather than filtered by a list, which is this file's standing trade.

**And the rate is the thing to watch.** Three of the seven above were found on
screens that had already been read twice, and the array case was found on a screen
nobody had inventoried at all. This list is open, not a taxonomy: when the next
string turns out to be invisible, ask the question at the top of this file first.

# New purchase request

Route: `/prs/new`
Who reaches it: anyone signed in. This is the one create screen that is not
office-only, because raising a request is site work.

## What it answers

Nothing — it is a create form, so nothing on it is a verdict about existing data.
What it has to do instead is collect a request that is already settled: the
vendor was chosen and the prices agreed in a conversation outside the app, and the
quotation proving it is in the requester's hand. **The form is transcription, not
decision-making.** A design that shapes it as a wizard for choosing a vendor is
solving a problem that happened before the reader arrived.

It is also the longest form in the app, and the one create form that is not
office-only — so it is filled in wherever the requester is rather than at a desk in
the office. Which devices that means in practice is not something this repository
records.

## What it always carries

**identity.** The heading `New Purchase Request`.

**action — the request's context, three linked dropdowns.** Job, Discipline, Vendor,
all required. Job groups its options under `My Jobs` and `All Jobs` when the
reader has assigned jobs, and offers just `Jobs` otherwise. Discipline is dependent:
until a job is chosen its placeholder reads `Select a Job first`, and changing the
job clears it, because one from the previous job no longer applies.

**action — Quotations,** a section with its own heading and the line
`A Vendor can send more than one quotation — add one entry per quotation
received.` Each entry is a file input plus an optional `Vendor Quotation Code`
text field. At least one entry with a file is required; the last remaining entry
cannot be removed. An `Add` control appends another.

**action — Items,** a repeating row: a category picked through four ordered
levels, size, unit as a dropdown from the canonical 19-value list, quantity,
unit price. Each row shows its own computed amount.

**action — the category, which replaced a typed item name (#355).** Four ordered
choices per row, each narrowing the next: 39 at the first level, and whatever the
branch taken holds at the second, third and fourth. A level whose parent is
unpicked offers nothing and says which level to pick first. Changing a level
clears every level under it, because a deeper choice belongs to the branch it was
made in. **The tree is wide before it is deep and one branch's fourth level can
hold a single choice while another holds dozens**, so the shape has to stay
usable at both ends; that is the design question this screen carries and the
reason its brief changed.

**read — the composed path, beside the four choices that produced it.** It is the
string the purchase order prints for the vendor, and it is **not** the four
choices joined: the rule drops a level reading `Standard` or `Other` and folds
one repeating the level kept before it, so **27% of complete paths read as fewer
than four segments**. The requester is the only person who can catch a wrong pick
before the order is placed, and this is the only place the vendor's version of it
is visible. **It runs from 2 to 146 characters** — the long ones are real and must
not be truncated to something a reader would mistake for the whole path.

**action — `Shipping Fee (optional)`.** Labeled optional in the field name
itself.

**action — Signers,** an ordered list the requester builds. Each signer is a
person plus a confirmation type, `Approval` or `Agreement`, chosen per signer on a
segmented control — two named kinds rather than a sliding toggle, because neither
is the on-state of the other.

**action — `Notes`,** free text.

**action — two final controls, side by side.** `Submit PR` is the filled primary.
`Save as draft` sits beside it as the secondary, and becomes `Save draft` once a
draft exists. Submit is first in the DOM.

## What it carries only sometimes

**When the reader has a saved draft and did not arrive from the draft list:** a
modal asking whether to resume it, before the form is usable.

**When the reader opens a draft from the list instead:** no prompt — the form is
already populated, and the draft's row is marked as being edited.

**When the reader opens the draft list:** a modal listing their saved drafts, each
with a delete control.

**When a draft has just been saved:** a `Draft saved` modal.

**When the draft currently open in the form is deleted:** a notice, and the form
detaches from that record rather than silently re-targeting a new one.

**When a quotation file is uploading or has failed:** per-entry state on that
entry — a filename, a spinner, or the error. A file is required per entry before
the request can be submitted.

**When a row's four levels are not all settled:** no composed path, and the
request cannot be submitted — the refusal names the category rather than the
name, since there is no name field to go and fill in. A draft saves in this state
on purpose; a draft is allowed to be half-finished.

**When a draft row was saved before the catalog existed:** it opens with nothing
picked and shows the name it was saved with, so the person can find the matching
path. Nothing repairs it automatically and nothing is lost by re-picking. One such
row is on this base today.

**A quotation already on the draft and one picked in this session read
differently, and that is the only screen in the app where both kinds of file link
appear at once.** An entry hydrated from a saved draft says `Already attached` and
opens the file over this page in the shared viewer, because there is a record to
open. An entry whose file was picked in this session says `Uploaded` and links out
to the uploaded copy in a new tab, because no record exists yet for the viewer to
show. Replacing the file on a hydrated entry moves it to the second reading. The
first said `Uploaded` too until #331, which was false on a resumed draft — nothing
was uploaded in that session.

**When a picked file is over the size limit:** the same red line as a failed
upload, but immediately and before anything is sent —
`This file is larger than the upload limit`, then the file's own size against the
limit. It needs no room of its own: it reuses the entry's error line. One limit
covers every upload in the app, so this sentence is word for word what
`/invoices/new`, `/deliveries/new`, `/deliveries/[deliveryId]/edit` and
`/prs/[prId]` show.

**When two or more quotations exist:** an extra `Quotation` column on every item
row, so each item can name which quotation its price came from. With zero or one
there is no choice to make and the column is absent.

**When two item rows are identical:** a gray note above the final controls saying
`N items repeat an item above them — each will be saved into that item, with the
quantities added.` It is a **preview of what saving will do**, not an error and not
a blocker — the merge happens on save either way, and this is the form telling the
reader in advance.

**When a matching request already exists for this discipline:** a yellow box after
submitting, naming the earlier request's ID, who submitted it and when, and asking
`Submit this one anyway?` with two controls — dismiss, or `Submit anyway`. This is
a confirm-then-resubmit, so the reader's first Submit does not go through. A
generic error resets it, so the next honest resubmission re-runs the check.

**While either action is pending:** the button's own label changes —
`Submitting...`, `Saving draft...` — and Submit is hidden while the duplicate
warning is open, so the reader cannot bypass the question by clicking behind it.

## What must agree elsewhere

**The unit dropdown is the canonical 19-value list** shared by five tables. It is
not free text anywhere in the app and must not become free text here.

**The merge note's wording is shared with the rule that performs the merge** —
one sentence, authored beside the six-field key that decides what counts as
identical. **The key's first field is the category since #355**, so two rows are
the same item when they picked the same path, and a row that has not settled all
four levels merges with nothing.

**There is no request path for a category the tree does not have.** The site asks
the office and the path is added to the catalog directly, so this screen offers no
`can't find it?` control and nothing here builds one. A screen for adding a path
is its own issue.

**The composed path is the one string a signer and the vendor both read.** Edit
and continue shows it and does not let a signer change it — the name is composed
from the category, so nothing on that screen could change it correctly.

**The items table is the shape the request detail and the purchase order detail
both show.** A reader fills in Item / Size / Unit / Qty / Unit Price here, reads
them back on the detail, and sees them frozen on the order.

**`Discipline` is a `Disciplines` row under a job**, the same word as on the
request detail and the purchase order detail. **It is on no list** — #314 took it
off the two that carried it, because a discipline is how a request is filed rather
than where the material went. The dependent dropdown here is the clearest
statement of that relationship anywhere in the app.

**`Approval` and `Agreement` are two names for two things**, and the signing
chain on the request detail prints the chosen one in each step's accessible name
and uses it to pick the history's verb — `approved` or `agreed`. Renaming either
breaks a word on two other screens.

**Draft is a status, not a local buffer.** A saved draft is a real request record
with `Status: Draft`, visible **only** to its requester — ahead of every other
visibility clause, including the office. Both Save and Submit re-target that same
record, Submit promoting it rather than creating a second one. A design implying
drafts are unsaved local state would contradict where they actually live.

**A draft can arrive already holding a quotation, from two places.** The
over-delivery strip on the request list opens one carrying the excess as its
single item, and the direct-purchase strip opens one carrying the vendor and the
vendor's own invoice as its quotation — and nothing else, because what is missing
is exactly what only the requester knows: the items, the discipline, and the
signers.
Both land here through the ordinary draft-resume path, so this form is what
finishes them. A reader who arrives that way did not fill in what is already
there, and the form should not read as though they did.

**A quotation is required, and that is the workflow rather than a validation
choice.** The vendor and the prices were settled before this form opened, and the
quotation is the evidence. The same requirement appears on the delivery form as
the packing list photo.

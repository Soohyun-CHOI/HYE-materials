# New address

Route: `/addresses/new`
Who reaches it: any signed-in person. **Not Admin-only**, unlike the three create
forms under `/admin` — see the last section.

## What it answers

Where does material go, and what do we call that place?

An address is a row every other screen points at: a job's default delivery
address, a vendor's own address, and — from the issue after this one — the address
a purchase request says its material should go to. Until this screen existed they
were typed into Airtable by hand while the jobs and vendors linking to them were
created in the app, so the one table a requester needs at the moment of raising a
request was the one table they could not reach.

**The screen exists to prevent a second row for a place that already has one.** A
picker with no path to a value that does not exist yet sends the reader to a text
field, and a typed address produces one row per spelling. So this is both a create
form and a small answer to "does it already exist" — which is why it shows things
rather than only collecting them.

## What it always carries

**identity.** The heading `New Address`, and a line under it: `A place this
company ships to, and the name people will know it by.`

**action.** A single form.

- `Address Label`, required, with a hint under it: `What people call this place —
  the site, the gate, the yard.` This is the row's primary field and its identity;
  it is what every picker elsewhere will show, and it is the only thing that tells
  two addresses in one city apart.
- `Street address` and `Suite, unit, floor`. These write the fields `Line 1` and
  `Line 2`; the screen words deliberately differ, because a person filling this in
  front of a gate reads `Street address` and a postal schema calls the same box
  `Line 1`. Only the first is required.
- `City`, `State`, `Zip Code`, all required. Together with `Street address` they
  are what the `Formatted Address` formula prints, which is the form a vendor
  reads on a purchase order — an address missing any of them renders that line
  with a stray comma in it.
- `Country`, a dropdown of exactly two options, `USA` and `Other`, defaulting to
  `USA`. It is the closed set the field already holds and is not editable here.
- `Job`, a dropdown, **optional**, whose empty option reads `No job`. Every job on
  the base is offered, grouped `My Jobs` then `All Jobs` — the reader's own
  assignments first and none hidden, which is the request form's own grouping and
  its three labels (`Jobs` is the heading when the reader has no assignment).
- A submit control, `Create Address`.

The page is a narrow centered column, the same shape as the three `/admin` create
forms.

## What it carries only sometimes

Everything here is absent in the normal case unless the entry says otherwise.

**When a job is chosen:** a panel listing the addresses that job already uses —
`Addresses already on {code}:` and the labels under it. **This is the whole reason
the screen shows anything beyond a form**: somebody sent here because an address
was missing from a picker is one keystroke away from recording a second spelling
of one the job already has. When the job has none it says so —
`No address is recorded on {code} yet.` — rather than rendering nothing, because
an absent list cannot be told apart from one that looked and found nothing.

**Which of those addresses is the job's DEFAULT is not marked**, deliberately. The
list is scanned to avoid a duplicate and that question does not change the
answer; the word for the default belongs to the request form, where a requester
has to choose between the default and a different one.

**When the typed label matches an address that already exists:** an amber line
under the field, `{label} is already an address. Use that one, or give this one a
name that tells the two apart.` It appears while the person is still typing, from
the list the page loaded — so it is honest but not authoritative, and the same
sentence comes back as a refusal if the label was taken in the meantime.

**When the form is refused:** a red line above it. There are two refusals and no
others: the sentence above, and `An address needs a label, a street address, a
city, a state and a zip code.`

**When an address has just been created:** a green line above the form,
`Created {label} on {code}.` — or `Created {label}.` when no job was chosen. The
form stays on screen and ready for another rather than navigating away, like its
three `/admin` siblings. **Nothing about this is in the URL**, unlike those three:
the answer comes back through the form's own state, so a reader who bookmarks or
shares the address never shows a stranger a confirmation for an act they did not
take.

**The screen can also be opened with a job already chosen**, by a link carrying
`?job={code}`. Nothing in the app writes that link yet; the request form is what
will.

## What must agree elsewhere

**`Address Label` is human-typed, and it is the one `X Label` primary on this base
that is not composed from other fields.** The catalog's `Category Label` is a
formula because somebody adding one of hundreds of reference rows by hand would
eventually type one wrong; addresses are created here from now on, so the by-hand
path that argument is about is the one this screen removes. What a composed label
would cost is the half no component carries — which site, which gate, whose yard —
and `Formatted Address` is already the composition.

**The label is enforced unique by the app and not by the schema.** Airtable has no
unique constraint, so two labels that differ only in case or in internal spacing
are one address here, the same rule `Tools."Tool Name"` lives under.

**Who may reach it is the argument, not an oversight.** The three `/admin` create
forms are Admin-only because a job code is an accounting artifact and a vendor is
a commercial relationship — both the office's to author. Gating something to Admin
scopes it to the office rather than to a higher trust tier, and where material has
to be delivered is the site's fact: the person who talked to the vendor is the one
who knows it. An Admin gate would also make this screen a dead end for the reader
it is built for, since the request form sends a requester here.

**Every job is offered, and an assignment GROUPS rather than gates.** The request
form already offers every job to every requester with the assigned ones first and
none hidden, so a job's identity is not scoped in this app and a job's address
list cannot leak one — and narrowing here would refuse a requester the very job
they are about to raise a request against, at the hop that form sends them
through. **What an assignment gates elsewhere is an act that makes a claim**: a
delivery says material arrived on a job, a tool event says it happened on one. An
address attached to a job says neither — it says a place is somewhere that job
ships to, and the person recording it is asserting nothing about themselves. So
the grouping is the whole of what an assignment does on this screen, and a
redesign may reorder it but must not turn it into a filter.

**A job reaches its addresses two ways and the screen reads both.**
`Addresses."Jobs"` names every job that uses an address; `Jobs."Delivery Address"`
names the one that is the default. Neither is a subset of the other and nothing
keeps them in step — taking the union is what removes the invariant rather than
adding one.

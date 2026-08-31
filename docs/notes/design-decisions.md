# Design decisions the code does not record — the rules

Read before you touch a screen's layout, spacing, color, typography or interaction shape. What is here was decided by the design pass, is true of more than the one screen that produced it, and is recoverable from nothing in the repository.

## What this file is, and what it is not

**`docs/briefs/` says what a screen carries; this file says, of how that looks and behaves, what has been decided.** The briefs are the design work's only input and they answer "what is on this screen" — the facts, the distinctions it must show, the words locked on it. They deliberately do not answer "and what should it look like": that was the design pass's question. This file is where the design pass's answers land when they are wider than one page's brief.

**`design-sweep-list.md` is a queue and this is not.** That file holds places where the current code disagrees with something settled; every entry has a consumer and leaves when that consumer implements it, and the file is deleted when the last one goes. **This file has no consumer and does not empty.** A rule stays true after the screen is built, and the reason to keep it is precisely that: somebody implementing later, or redesigning again, can undo it without knowing it was ever decided. Nothing here is waiting to be done.

**It holds judgments and prohibitions, not values.** A number belongs to the token layer, which is #258's — `docs/briefs/_shared.md:48` and `:58` record that the pixel reasoning in #179 and #235 is waiting on it, and `:546` that a decision is deferred until there is a token layer to own it. So a spacing scale, a color and a type ramp are not entries here even after the design fixes them; what is an entry is the judgment that decides where a value goes and the prohibition that says what may not be done with it.

## When something becomes an item

Both halves have to hold.

**The decision is settled.** Not a preference, not a direction the design is leaning. If it is still open it goes nowhere yet, and if it is open *because the code disagrees* it is a `design-sweep-list.md` item instead.

**And it is either true wider than the one screen that produced it, or it is a prohibition a later implementer could undo without knowing.** The identity line below is the first kind: it was decided for the shell and the shell is on every screen. The panel's focus behavior is the second: a later hand could add a panel that opens without moving focus and nothing would fail.

**A single screen's pixel value is not an item.** Neither is a fact one brief already carries. If the sentence would read as an instruction to one page, it belongs in that page's brief.

---

## The identity line

The shell's own line naming the reader. The shell does not exist in the code yet; `app/page.js:19-22` is the stopgap standing where it will go, and `docs/briefs/root.md:18-20` calls the shell's absence `the largest single gap a design will find`.

**It shows the email's local part, not the whole address.** The local part identifies because the domain is the same for every user, and that premise lives in `lib/auth.js`: `:7-8` throws at module load without `ALLOWED_EMAIL_DOMAIN`, `:11` reads it into one lowercased string, and `:14` admits an address with a single `endsWith` against it. One variable, one value, one suffix test. CLAUDE.md states the same restriction twice, under Architecture and under Auth.

**A second admitted domain breaks this and nothing else would say so.** The moment that variable becomes a list, two people can share a local part — `chkim@a` and `chkim@b` — and a line whose only job is saying who you are stops doing it. So a change from one domain to many has to reach this decision. This is the only place that is written down.

**The field is `Users."User Name"`, never a truncation of `Users.Email`.** The repository had already settled how a person is named and `lib/prWait.js:78-83` is where: `` THE NAME IS `Users."User Name"`, which is what every other screen prints for a person `` — the request list's Requester column, the history timeline, the signer chain — and `Inventing a second way to name people here would be the thing to avoid.` A shell is a new surface and inherits that.

The two are the same value today, and only because of one line. `lib/auth.js:61-62` calls `createUser({ userName: email.split("@")[0], … })`, and `"User Name"` is written in exactly one place in the repository, `lib/airtable/users.js:122`, reached only from there — so no in-app path edits it. **That is a property of the signup code and not a guarantee of the schema**, and an Airtable hand edit moves one without the other. Which settles the choice rather than complicating it: `lib/prWait.js:82` records that `a real display name is one edit per row in Airtable and improves every screen at once`, so a shell reading `User Name` inherits that improvement the day somebody makes it, and a shell truncating `Email` would ignore it forever.

**It marks `Admin` and `President`, and says nothing for an Employee.** `Users.Role` has two values and `President` is the signing role held by the company's president, so every other row is `Employee` — a word on every line, marking no exception. `docs/briefs/prs.md:59-66` argues exactly this about the request-kind mark: `Nothing at all on an ordinary request, which is almost all of them — and that silence is a computed answer rather than a missing one`, and `A word on every row would make the exceptional rows ordinary again.` `docs/briefs/_shared.md:236-238` states the general form. Same rule, one surface up.

**`Role` and `Is Admin` are independent, so both marks can appear, and the order is President before Admin.** Four combinations: nothing / `Admin` / `President` / `President, Admin`. The order has to be fixed at all or two people holding the same combination get two different lines; it is fixed *there* because `app/page.js:20-21` already puts the role first and appends Admin after it, so this is the order anyone who has used the app has already seen rather than a new choice.

**`Signed in as` goes; the line is the name and its marks.** The shell's own position says what the phrase says: a line the reader meets in the same place on every screen is read as being about them, and a sentence asserting it spends three words on what the placement already carries. The phrase exists because the current screen is a page rather than a shell, and a page has no position that means `you`.

**It is not a locked word, checked three ways.** It appears in `scripts/tests/offline/screen-briefs.mjs` not at all, so it is in neither `PINNED` nor `TIER_TWO`. It appears nowhere in `docs/briefs/_shared.md`'s `## Locked words` section — that section's Sign-in entry covers `HYE USA Portal`, `Confirm sign-in` and the five token states, and its tier-3 entry covers screen headings. Its only quotation anywhere is `docs/briefs/root.md:31`, which describes what the stopgap carries rather than locking a word. It is a tier-3 string in `_shared.md:264-266`'s sense, but tier 3 is a statement about how little protection a *listed* word has and this one is not listed.

## The panel behind the name

Pressing the name opens the whole email address and sign out. **The design's drawing shows it open and shows nothing else** — not what closes it, not how it is reached without a mouse, not where focus goes. Those are decided here because the drawing cannot carry them and because getting them wrong is invisible until somebody without a mouse tries.

**It is not a modal, and that is a decision rather than an omission.** The app has exactly one overlay pattern and it is the modal: `app/components/modalStyles.js` holds `MODAL_BACKDROP` and `MODAL_CARD`, and every overlay in the app imports both. Those all exist to stop the reader and take an answer — a withdrawal, a deletion, an overage claim. This panel asks nothing; it reveals two things the reader went looking for. **So this is the app's first non-modal overlay**, and the rules below are the whole of what the app knows about that shape. The next one reads them.

*The count of modal sites is not written here on purpose. `_shared.md:536` says six and there are eight importers of `modalStyles.js` today, which is what `backlog.md`'s rule predicts: name what to count, not the count.*

**Three things close it: a click outside, `Escape`, and pressing the name again.** The third is what makes the name a toggle rather than a one-way door, and it is the one a keyboard reader reaches first because they are already on it.

**It opens from the keyboard, because the name is a real button.** `Enter` and `Space` open it, exactly as a mouse press does. **This is the app's standing objection and it has retired a feature over it:** `docs/briefs/_shared.md:527-529` records that `QualifierMarker`'s own documentation said its tooltip `opens on neither touch nor a keyboard`, which is why the sentence it carried had to become its accessible name, and #232 then retired the marker. That judgment is also what the shared brief's color rule stands on — `Color never carries a meaning by itself` is the same argument one step further along. A panel reachable only by pointer would be the same defect a third time.

**Focus moves into the panel on open, to its first focusable item, and returns to the name on close.** Returning matters more than moving: a reader who presses `Escape` and lands at the top of the document has lost their place on the page they were reading, and the shell is on every page.

**Focus is not trapped, which is the line between this and the eight modals.** Tab may leave the panel, and leaving closes it. A modal traps because the answer is required; this panel has no answer to require, and trapping focus in it would make dismissing it the reader's problem.

## Column order on a list screen

Four groups, left to right: **what record this is**, **whose it is**, **the document's own numbers**, then **the verdict**. `/invoices` reads `Invoice ID` · `Vendor` `Job` · `Issue Date` `Due Date` `Amount Due` · `Delivery` `Status`, and `/pos` reads `PO ID` · `Vendor` `Job` · `Total` · `Status` `Delivery` `Invoice` `Payment`. The rule is the grouping, not the column count.

**The verdicts collect at the right end and read in the order the document chain flows.** `/pos` ending `Delivery`, `Invoice`, `Payment` is the example: what arrived, what was charged for it, what was paid. `app/pos/POListClient.js:253-256` says the same thing from the code's side — `the third step of the chain the row already reads left to right`. A verdict placed among the numbers, or the three read in another order, makes the reader assemble the chain instead of scanning it.

**Inside `whose it is`, the more discriminating value comes first.** This is why `/invoices` puts `Vendor` before `Job`. A job code has a fixed shape, `YY-USA-XX`: seven of its nine characters are identical on every row and only the two at each end vary, so an eye running down that column cannot use it to pick a row out. A vendor name differs from its first letter. **The second column from the left is where the eye looks for a row**, so a value with no discriminating power there wastes the one position that was worth something.

**No filter on this list hardens that judgment rather than softening it.** Where a filter exists, its column is also where the reader confirms what the filter did, and that is a reason to put it early even if it scans badly. `/invoices` has no filter bar at all — every reading of it is a scan — so the column earns its place on scanning alone.

**`Job` sits immediately after `Vendor` on `/invoices` because the two are one question.** Who charged for this, and where was it for. Adjacent, they read in one movement; separated, the reader crosses the numbers twice to put them together.

**The four lists do not yet agree on where `Job` goes, and this is not the moment to unify them.** `/invoices` and `/pos` place it third; `/deliveries` puts it last. That may well be right there: that screen is already narrowed by the reader's job assignment, so `Job` is closer to a constant than to a discriminator, and a constant belongs where the eye is not looking. **The decision is what to do with all four in front of you**, which is a pass over the four together rather than a change to one — and `docs/briefs/invoices.md:215-220` is the entry that already binds the four to one heading and one value, so whatever moves has to keep that true.

**A job code is not a value a person composes.** Its shape is fixed, so it is looked up and matched rather than read as words, which is the property behind both rules above — and the reason a width taken from it is a width taken from a template.

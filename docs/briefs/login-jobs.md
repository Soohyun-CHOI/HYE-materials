# Your jobs

Route: `/login/jobs`
Who reaches it: anybody whose `Users` row has a name and no assigned job and who is
neither the office (`Is Admin`) nor the President, on the first page they try to
open — after signing in, and after the name step when that shows. A new colleague
meets it once; an account that signed in before the office assigned it meets it the
next time it opens the app. Nobody who holds a job sees it.

It is a **step of the sign-in flow** (#554), so it is used at a phone width as well
as at a monitor: a QR label scanned on site can arrive signed out, and a first-time
scanner comes through it on the way to the item.

## What it answers

Which jobs do you work on? Every asset list stands on the reader's jobs, and until
this step a person's jobs were set by hand in Airtable, so somebody who signed in
before the office got to it stood on `No job yet` with nothing they could do until
the office was told.

**It is a first assignment and nothing more.** What the reader chooses becomes their
assigned jobs, and from then on their jobs are the office's to change. There is no
way back into this step to change them.

**The office and the President are never asked**: the office stands on every job
already, and neither needs an assignment to work.

## What it always carries

**identity.** The product's name as the wordmark, the same as on every step before
it, the title `Choose your jobs` and the sentence `Pick every job you work on.`

**action.** A search, `Search jobs`, and under it every job there is, one row each:
the job's code and its name, and a box that is ticked when the job is chosen —
several may be. At a desk the box leads the row and the list scrolls in the
column; on a phone the code stands over the name, a round check ends the row, the
page scrolls and the search holds to the top. Then one full-width filled button,
`Continue`, which says how many it saves once any is chosen — `Continue with 1 job`,
`Continue with 3 jobs`.

**It also carries one thing it never shows.** Where the reader was going travels
through this step as it does through the name step, so a person who scanned a tool
label lands on that item, and anybody else on Equipment & Tools.

## What it carries only sometimes

**While nothing is chosen:** at a desk `Continue` cannot be pressed and
`Choose at least one job.` stands over it; on a phone `Continue` stays live, and a
press says `Choose at least one job.` in red over it until a job is chosen.

**While searching:** the rows whose code and name carry every word typed — and above
them, kept in sight, the jobs chosen before the search began.

**When a search finds nothing:** `No jobs match “…”`, the words typed in quotes,
under any chosen job kept at the top.

**While saving:** the button keeps its fill and takes no press, and if the wait
passes a moment it shows a spinner before `Saving…` — on a phone, the spinner alone.
The list and the search keep their look and take no input.

**When the write fails:** `Couldn't save your jobs. Try again.`, where the name step
says its own write did not happen. The choice stays as it was.

**When a job went while the reader was choosing:** it leaves the list, and the rest
of the choice stands; a choice left with nothing in it says
`Choose at least one job.`

There is no success state on this screen. Saving lands the reader on the page they
were going to, which is what says the save happened.

## What must agree elsewhere

**The name step comes first.** A reader with no name is asked for it before this
step, so the two are asked in that order on the way to one page.

**What this writes is the reader's own assigned jobs, and nothing else**, and only
while they hold none — a job the office assigned by hand in the meantime is kept.
Every asset list then stands on these jobs (`asset-categories.md`), and the same
assignment decides which requests the materials screens show a reader.

**`No job yet` stays on the Equipment & Tools list** for the one reader this step
does not ask and the list does not count as the office: a President who is not
marked as the office and holds no job. A site manager on no job who is the office
or the President still meets `Ask the office to assign you to a job` where items
are added.

**The wordmark and the frame are every sign-in step's**, so the four read as one
flow. At a desk this step's column stands nearer the top than the others — 10% of
the window rather than 24% — because its list fills the column down to the same
room above the window's end.

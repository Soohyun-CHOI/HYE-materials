# Your jobs

Route: `/login/jobs`
Design: Sign in 1k and 1l, on Invoices 0o.
Who reaches it: anybody signed in whose `Users` row has a name and no assigned job
and who is neither the office (`Is Admin`) nor the President, on any page they open
(`lib/userJobs.js:needsJobs`) — after a first sign-in in practice, and after the
name step when that shows. Nobody who holds a job sees it.
Which width comes first: both, as every sign-in step: a first-time scanner comes
through it on the way to the item.

## What it answers

Which jobs do you work on? Every asset list starts on the reader's first job, and
before this step a person's jobs were set by hand in Airtable alone.

**It is a first assignment and nothing more.** What the reader chooses becomes their
`Assigned Jobs`; from then on their jobs are the office's to change. The step asks
again only a reader whose assigned jobs the office empties.

**The office and the President are never asked**: neither needs an assignment to
work, and a reader of either kind with no job starts the asset list on all jobs.

## What it always carries

**Every job there is, by its code and name**, several of which may be chosen, and a
search over them: a job stays while its code and name carry every word typed
(`lib/typedText.js`). **While searching, a job chosen before the search began
that the search does not match stays, above the matches** (`jobRows`), so a choice
is never hidden by what was typed.

**The press says how many it saves** once any is chosen
(`USER_JOBS_COPY.action`).

**Where the reader was going travels through it** as it does through the name step:
a person who scanned a label lands on that item, and a reader with no destination,
or one refused, on Equipment & Tools.

**What it reads:** 2 operations; a save 4 — the session, the jobs, the row read
again and the write — and a page sending a reader here 1
(`docs/notes/authorization.md`). Who is asked is a property of the row the session
already read, so asking costs nothing.

## What it carries only sometimes

**While nothing is chosen** (`USER_JOBS_COPY.refusal.none`): at a desk the press does
not act and the sentence stands over it; on a phone the press stays live and says
the sentence when pressed, until a job is chosen.

**When a search finds nothing:** `USER_JOBS_COPY.noneMatch` with the words typed
(`USER_JOBS_COPY.echo`), under any chosen job kept at the top.

**While saving:** the press is busy and the list and the search take no input
(`USER_JOBS_COPY.working`).

**When the write fails:** `USER_JOBS_COPY.refusal.failed`. The choice stays as it
was.

**When a job went while the reader was choosing:** the save leaves it out and the
rest stands; a choice left with nothing in it says `USER_JOBS_COPY.refusal.none`.

**There is no success state.** Saving lands the reader on the page they were going
to.

## What must agree elsewhere

**The name step comes first** (`login-name.md`): a reader with no name is asked for
it before this step.

**It writes the reader's own assigned jobs and nothing else, and only while they hold
none** (`lib/airtable/users.js:assignFirstJobs`): the row is read again before the
write, so a job the office assigned in the meantime is kept. Every asset list then
starts on the first of these jobs by its code (`asset-categories.md`), while any job
may be chosen there; a site manager adds and records on these alone; and the same
assignment decides which requests the materials screens show a reader.

**A site manager on no job who is the office or the President is drawn no opener
anywhere, and nothing says why** — this step is where a job is asked for, and it
does not ask them.

# HYE USA Portal

Hanyang ENG USA's internal web app: one sign-in, two parts.

**Tools & Equipment** is in use at the sites.

- Each tool and piece of equipment is registered under its job and gets a
  printed label whose QR code opens its page.
- A site manager records what happens to it: checked out, checked in, sent
  for repair and returned, retired.
- The office keeps the catalog that registration picks from.
- The list exports to an Excel file.

**Material purchasing** is being prepared: the **purchase request → purchase
order → invoice → delivery** chain in one app, replacing a workflow that lived
in email threads and spreadsheets. The same order sat in a spreadsheet, an email
thread and a vendor's invoice with nothing tying them together, so reconciling
what was ordered against what was invoiced was manual and after the fact. Its
screens are closed until the sites start using them, and `lib/openScreens.js`
is the one switch.

## Stack

- **Next.js** (App Router, JavaScript) with **Tailwind**, deployed on **Vercel**
- **Airtable** as the data store only — all business logic lives in the backend
- **Vercel Blob** for file uploads, which Airtable then ingests as attachments
- **Resend** for the sign-in email (a link and a code) and notification email

## Running it

```bash
npm run dev
```

Needs a `.env.local` — copy `.env.example` and fill it in. Sign-in is by email,
with a link or the code the same email carries, and restricted to the company
email domain. `/` leads to the Tools & Equipment list.

Local development and every script reach the **test base**, a copy of the
live Airtable base, through `AIRTABLE_TEST_API_KEY` and `AIRTABLE_TEST_BASE_ID`.
The live base is the production deployment's: a command reaches it only by
naming it, `AIRTABLE_BASE=live` in front of that one command, and with
`AIRTABLE_API_KEY` set — a machine without that key cannot reach it at all.
The secrets are not in what `vercel env pull` writes, so each machine's
`.env.local` is filled by hand.

## Checks

```bash
npm test
```

```bash
npx eslint .
```

`npm test` runs the offline verification tier — no credentials, no network, no
dev server — and `npx eslint .` is CI's second job. Both are required status
checks on `main`.
Checks that need Airtable live in `scripts/tests/verify-*.mjs` and are run by
hand, because one shared test base means concurrent runs would create and
delete records against each other.

## Where the reasoning is

`CLAUDE.md` is the project's working memory: the rules that bind code across
areas. Read it before changing anything. It carries an index binding each area
to a file under `docs/notes/`, which is where the reasoning behind those rules
lives — read the one for the area you are about to edit. The data model is one
of those files, `docs/notes/data-model.md`.

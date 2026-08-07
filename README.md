# HYE USA Portal

Material purchasing for Hanyang ENG, a construction company: the **purchase
request → purchase order → invoice → delivery** chain in one app, replacing a
workflow that lived in email threads, spreadsheets and paper.

The problem was never any single step — it was that the three were never
connected. The same order sat in a spreadsheet, an email thread and a vendor's
invoice with nothing tying them together, so reconciling what was ordered
against what was billed was manual and after the fact.

## Stack

- **Next.js** (App Router, JavaScript) with **Tailwind**, deployed on **Vercel**
- **Airtable** as the data store only — all business logic lives in the backend
- **Vercel Blob** for file uploads, which Airtable then ingests as attachments
- **Resend** for magic-link sign-in and notification email

## Running it

```bash
npm run dev
```

Needs a `.env.local` with `AIRTABLE_API_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`
and `ALLOWED_EMAIL_DOMAIN`. Sign-in is magic-link only and restricted to the
company email domain.

## Checks

```bash
npm test
```

Runs the offline verification tier — no credentials, no network, no dev server.
It is a required status check on `main`. Checks that need Airtable live in
`scripts/tests/verify-*.mjs` and are run by hand, because one shared base means
concurrent runs would create and delete records against each other.

## Where the reasoning is

`CLAUDE.md` is the project's working memory: the data model, the decisions
behind it, and what each of them cost. Read it before changing anything.
`docs/Build_Plan.md` is the original build plan.

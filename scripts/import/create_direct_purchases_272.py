"""
Creates the `Direct Purchases` table and its ten fields (issue #272), and
corrects two field descriptions on other tables that are false about the
current code.

WHAT THE TABLE IS FOR. A site buys material directly from a vendor with no
order behind it. The vendor's invoice reaches the office, `/invoices/new`
has no order for it to charge, and until now that was a dead end: the
office cannot raise the purchase request either, because a request needs a
Line and only the site knows which one. So the office records what the
invoice says here, the row appears on a strip above `/prs` for its Job, and
the site raises the request from it. The request's KIND is then read from
the `Purchase Request` link on this table -- there is no field on
`Purchase Requests` saying it, deliberately, because a link and a field
would be one fact in two places (the same shape as the overage request,
which is read from `Delivery Items."Overage PR"`).

RUN THIS ONCE. It is idempotent -- an existing table is reported and its
missing fields are added, an existing field is left alone -- but the table
it creates CANNOT be removed through any API: `DELETE` on a table is a 404
with no endpoint behind it (measured, CLAUDE.md). The name has to be right
the first time.

TWO THINGS THE API CANNOT DO, AND ONLY ONE OF THEM NEEDS A HUMAN:

  1. `prefersSingleRecordLink` is refused on both field CREATE and field
     UPDATE (422). Three fields on this base already live with that --
     `Invoices."Delivery"`, `Invoice Items."PO Item"` and
     `Delivery Items."Overage PR"` -- and are single-record by app
     enforcement instead. The two closest analogues to this table's links,
     `Deliveries."Job"` and `Invoices."Vendor"`, DO carry the property
     because they were made in the UI. So this script does not send it, and
     the last thing it prints is the four fields to toggle by hand
     ("Allow linking to multiple records", off) if the base is to enforce
     what the app already does.

  2. A select's option list cannot be written at all. This table has no
     select field, which is not an accident: item quantities and their
     Units are not recorded here (see the issue), so nothing on it needs
     the canonical list and `add_unit_options.py` stays a five-table
     script.

THE SYMMETRIC FIELDS ARE FREE AND WANTED. Creating a link field
auto-creates the inverse on the far table, named after the source table --
so `Vendors`, `Jobs`, `Users` and `Purchase Requests` each gain a
`Direct Purchases` field. All four are the name we would have chosen, and
`Jobs."Direct Purchases"` and `Purchase Requests."Direct Purchases"` are
load-bearing: the first is how the strip finds a job's rows without
filtering a link field in a formula, the second is how the request's kind
is read for free off a record the mapper already holds. None is renamed.

THE TWO DESCRIPTION FIXES ARE NOT SCOPE CREEP. #181's rule is that a line
false about the current code is corrected in whatever commit finds it, and
a field description is where this base keeps its reasoning. Both are false
today: `Invoice Items."PO Item"` still describes the free-text charge #278
removed, and `Delivery Items."Overage PR"` still says Resend is in sandbox
mode, which stopped being true when the domain was verified (the same false
clause was already corrected in `lib/overagePR.js` and in
`docs/notes/verification.md`). A description-only PATCH returns 200 where
one carrying `options.choices` returns 422, so both are free.

Usage (reads AIRTABLE_API_KEY / AIRTABLE_BASE_ID from .env.local at the
repo root, same as add_unit_options.py and import_jobs.py):
    python3 scripts/import/create_direct_purchases_272.py --dry-run
    python3 scripts/import/create_direct_purchases_272.py

Exit codes, per CLAUDE.md's convention for anything that computes a
verdict: 0 the base matches the spec, 1 something failed, 2 nothing failed
but something is incomplete (a dry run, or a description left unfixed).

VERIFICATION IS PART OF THE RUN, not a follow-up. What was asked for and
what exists can differ -- an option silently dropped, an inverse named
something else -- so the last thing this does is re-read the live schema
and print every field and every inverse it finds, then compare that against
the spec. A run that prints a green summary has actually looked.

Airtable PAT scopes: schema.bases:read, schema.bases:write.
"""

import argparse
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

# ----------------------------------------------------------------------------
# Environment
# ----------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if not load_dotenv(PROJECT_ROOT / ".env.local"):
    raise RuntimeError(f"Could not load {PROJECT_ROOT / '.env.local'}")

AIRTABLE_API_KEY = os.environ["AIRTABLE_API_KEY"]
AIRTABLE_BASE_ID = os.environ["AIRTABLE_BASE_ID"]

AIRTABLE_META_ROOT = "https://api.airtable.com/v0/meta"

# ----------------------------------------------------------------------------
# The spec
# ----------------------------------------------------------------------------
TABLE_NAME = "Direct Purchases"

TABLE_DESCRIPTION = (
    "Issue #272 — material a site bought directly from a vendor with no order behind "
    "it. The office records one from the vendor's invoice when /invoices/new has no "
    "order for it to charge; the row appears on a strip above /prs for its Job, and "
    "the site raises the purchase request from it, so the requester is the site staff "
    "who bought the material rather than the office. Carries no items and no total: "
    "the invoice document is attached and the requester types the items into the "
    "request, which is the app's one place a human types an item. The request's kind "
    "is read from the Purchase Request link here and is stored nowhere else."
)

# The two date shapes this base already uses, read off Invoices."Issue Date"
# and Deliveries."Created At" rather than chosen here, so a new table cannot
# introduce a third way to render a date.
DATE_OPTIONS = {"dateFormat": {"name": "local", "format": "l"}}
DATETIME_OPTIONS = {
    "dateFormat": {"name": "local", "format": "l"},
    "timeFormat": {"name": "12hour", "format": "h:mma"},
    "timeZone": "utc",
}

# Table IDs, spelled rather than looked up by name: a link field's options
# take an ID, and resolving a name at runtime would make a renamed table
# fail here instead of at the rename.
TBL_VENDORS = "tblkV0gG1wVW5VR9t"
TBL_JOBS = "tblGwgHuhTX6rwF1M"
TBL_USERS = "tblisLwTKXyKtsTcy"
TBL_PURCHASE_REQUESTS = "tblLKlVEkWaj4As9x"

# THE FIRST ENTRY IS THE PRIMARY FIELD. Airtable takes the first field in a
# create-table payload as the primary one, and a primary field cannot be a
# link, an attachment or a formula-free afterthought — which is the same
# reason every other top-level table here leads with its `X ID`.
FIELDS = [
    {
        "name": "Direct Purchase ID",
        "type": "singleLineText",
        "description": (
            "Issue #272 — format HYE-DP-YYMMDD-##, backend-generated, counter resets "
            "daily (lib/ids.js:mintDailyId). 2-digit year, the convention everywhere "
            "except PO ID. #164 — the daily sequence is counted over the rows whose "
            "Direct Purchase ID carries the same prefix, never over a date field: "
            "Issue Date is copied off the vendor's document and may be months old."
        ),
    },
    {
        "name": "Vendor",
        "type": "multipleRecordLinks",
        "options": {"linkedTableId": TBL_VENDORS},
        "description": (
            "Issue #272 — who sold the material. Taken from the invoice form's own "
            "vendor selection, so it is the vendor the office had already picked when "
            "it found no order to charge. Single-record, app-enforced: the Metadata "
            "API refuses prefersSingleRecordLink on both field CREATE and UPDATE (422), "
            "the same limit Invoices.\"Delivery\" and Invoice Items.\"PO Item\" live with."
        ),
    },
    {
        "name": "Job",
        "type": "multipleRecordLinks",
        "options": {"linkedTableId": TBL_JOBS},
        "description": (
            "Issue #272 — the job the material was bought for. REQUIRED, and it is what "
            "decides which site sees the row: the strip above /prs lists the rows on the "
            "jobs a viewer may reach, so a row with no Job reaches nobody and the app "
            "refuses to create one. The office learns it by telephone — nothing on the "
            "vendor's invoice says it.\n\n"
            "A DIRECT LINK RATHER THAN A LOOKUP, and that is why this table exists at "
            "all: Purchase Requests.\"Job\" is a lookup through Line, and only the site "
            "knows the Line, so a purchase request cannot carry a Job the office knows."
        ),
    },
    {
        "name": "Vendor Invoice Code",
        "type": "singleLineText",
        "description": (
            "Issue #272 — the vendor's own invoice number as printed on their document. "
            "Same fact and same name as Invoices.\"Vendor Invoice Code\", one document "
            "earlier: this row exists precisely because that invoice cannot be entered "
            "yet. Informational only, not guaranteed unique across vendors. Carried onto "
            "the request's Quotation as its Vendor Quotation Code, since the quotation "
            "IS this invoice."
        ),
    },
    {
        "name": "Issue Date",
        "type": "date",
        "options": DATE_OPTIONS,
        "description": (
            "Issue #272 — the date printed on the vendor's invoice. Calendar-only per "
            "the naming convention (*Date vs *At): the document carries a day, not a "
            "time. Same word and same format as Invoices.\"Issue Date\"."
        ),
    },
    {
        "name": "File",
        "type": "multipleAttachments",
        "description": (
            "Issue #272 — the vendor's invoice. Required at creation, app-enforced: the "
            "row is a claim that a purchase happened and this is the evidence, and the "
            "request raised from it quotes this document the way #167's overage request "
            "quotes the invoice that charges the excess.\n\n"
            "Written by createDirectPurchaseAction from a fresh Vercel Blob url and "
            "never rewritten. The claim step does NOT re-submit the url Airtable issues "
            "for this attachment — it fetches the file server-side and uploads a new "
            "Blob object for the Quotation, because re-submitting an expired Airtable "
            "attachment url returns success and silently empties the field (#142)."
        ),
    },
    {
        "name": "Notes",
        "type": "multilineText",
        "description": (
            "Issue #272 — what the office learned on the telephone: who bought it, what "
            "it was for, anything the invoice does not say. Optional, and the only place "
            "the strip row can say what was bought, since this table carries no items — "
            "the requester types those into the request from the invoice attached here. "
            "Plural \"Notes\" and Long text follow the header-record convention "
            "(Purchase Requests, Deliveries, Correction Requests)."
        ),
    },
    {
        "name": "Recorded By",
        "type": "multipleRecordLinks",
        "options": {"linkedTableId": TBL_USERS},
        "description": (
            "Issue #272 — the office staff who recorded it. Same word as "
            "Deliveries.\"Recorded By\" for the same relationship. Audit only: who may "
            "raise the request from this row is decided by the Job, not by this field, "
            "which is the opposite of Deliveries.\"Recorded By\" and deliberate — "
            "deletion is not offered here."
        ),
    },
    {
        "name": "Created At",
        "type": "dateTime",
        "options": DATETIME_OPTIONS,
        "description": (
            "Issue #272 — when the office recorded it, UTC instant, *At convention. "
            "Distinct from Issue Date on purpose: an invoice recorded weeks after it was "
            "issued is normal. This is what the strip orders by, longest wait first, "
            "through the same sort the deliveries and invoices strips use."
        ),
    },
    {
        "name": "Purchase Request",
        "type": "multipleRecordLinks",
        "options": {"linkedTableId": TBL_PURCHASE_REQUESTS},
        "description": (
            "Issue #272 — the request a site raised from this row, written by "
            "claimDirectPurchaseAction in the same transaction that creates it. THE ONLY "
            "PLACE THE REQUEST'S KIND IS STORED: its inverse, Purchase "
            "Requests.\"Direct Purchases\", is what lib/prKind.js reads to mark a "
            "request as a direct purchase, and there is deliberately no field on "
            "Purchase Requests saying the same thing — a link and a field would be one "
            "fact in two places, and nothing would fail if a future write path forgot "
            "the second. The overage request's kind is read the same way, from "
            "Delivery Items.\"Overage PR\".\n\n"
            "WHETHER THE ROW IS STILL WAITING IS READ FROM THIS REQUEST'S Status, NEVER "
            "STORED: empty means nobody has claimed it, Draft means somebody has and has "
            "not submitted it — the strip keeps listing it and stops offering the button "
            "— and In Review or beyond means the fact has a home on /prs and the strip "
            "lets it go. Single-record, app-enforced (422 on prefersSingleRecordLink)."
        ),
    },
]

# ----------------------------------------------------------------------------
# The two false descriptions (#181 — corrected in whatever commit finds them)
# ----------------------------------------------------------------------------
# `find` is what makes each fix idempotent AND self-checking: the false text
# has to still be there, or the script says so and changes nothing rather
# than overwriting whatever replaced it.
DESCRIPTION_FIXES = [
    {
        "table_id": "tblg3coc94b7odikV",
        "table_name": "Invoice Items",
        "field_id": "fldxr03TLagNmvNnK",
        "field_name": "PO Item",
        "find": "Empty means this line doesn't correspond to any PO Item",
        "why": "#278 removed the free-text charge; the link is required by the app now.",
        "text": (
            "Issue #278 — REQUIRED, and by this app rather than by the schema: Airtable "
            "cannot make a link field required. The exact ordered item this charge "
            "reconciles against, single-record in practice (app-enforced).\n\n"
            "EMPTY IS NOT A STATE THIS APP HAS. Only a purchase request takes typed "
            "items; a PO Items row is a snapshot of one and an Invoice Items row is "
            "chosen from those, so a charge with no ordered item behind it is not "
            "something that can be created: createInvoiceAction refuses one and "
            "createInvoiceItem throws. The description here used to say an empty value "
            "meant a charge corresponding to no ordered item (freight, repair charges), "
            "with Item Name as free text — that option was hidden behind a flag from "
            "#96 and removed with its whole backend path in #278. A row found empty "
            "here was emptied by hand."
        ),
    },
    {
        "table_id": "tblPDlaZbd9HDurlJ",
        "table_name": "Delivery Items",
        "field_id": "fldSVy5o3xmS286s8",
        "field_name": "Overage PR",
        # A targeted replacement rather than a rewrite: only the parenthetical
        # is false, and rewording the rest would be improvement rather than
        # maintenance — the boundary CLAUDE.md draws.
        "replace": (
            "(no email: Resend is still in sandbox mode)",
            "(no email is sent either way)",
        ),
        "why": "Resend's domain is verified; mail delivers to any address.",
    },
]

# What a human still has to do afterwards, printed at the end of every real
# run so it cannot be forgotten between the script and the browser.
MANUAL_FOLLOW_UP = [
    "Direct Purchases.Vendor",
    "Direct Purchases.Job",
    "Direct Purchases.Recorded By",
    "Direct Purchases.Purchase Request",
]


# ----------------------------------------------------------------------------
# Airtable API
# ----------------------------------------------------------------------------
class AirtableSchemaClient:
    def __init__(self, token: str, base_id: str):
        self.base_id = base_id
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def fetch_tables(self):
        resp = requests.get(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables", headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()["tables"]

    def create_table(self, name: str, description: str, fields):
        """One call for the table and all ten fields.

        ATOMIC, WHICH IS THE WHOLE REASON IT IS ONE CALL. A create-then-append
        sequence can half-succeed, and what it would leave behind is a table
        with missing fields that no API can delete. Either this returns a
        complete table or it returns an error and the base is untouched.
        """
        payload = {"name": name, "description": description, "fields": fields}
        resp = requests.post(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables",
            headers=self.headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def create_field(self, table_id: str, field):
        """One field on an existing table — the re-run path only."""
        resp = requests.post(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables/{table_id}/fields",
            headers=self.headers,
            json=field,
        )
        resp.raise_for_status()
        return resp.json()

    def update_field_description(self, table_id: str, field_id: str, description: str):
        resp = requests.patch(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables/{table_id}/fields/{field_id}",
            headers=self.headers,
            json={"description": description},
        )
        resp.raise_for_status()
        return resp.json()


def find_table(tables, name: str):
    return next((t for t in tables if t["name"] == name), None)


def find_field(table, name: str):
    return next((f for f in (table or {}).get("fields", []) if f["name"] == name), None)


def field_payload(spec):
    """The spec entry as Airtable's field object — description included."""
    payload = {"name": spec["name"], "type": spec["type"]}
    if spec.get("description"):
        payload["description"] = spec["description"]
    if spec.get("options"):
        payload["options"] = spec["options"]
    return payload


# ----------------------------------------------------------------------------
# Steps
# ----------------------------------------------------------------------------
def plan(tables):
    """What this run would do, decided from the live schema before touching it."""
    table = find_table(tables, TABLE_NAME)
    if table is None:
        return {"create_table": True, "missing_fields": FIELDS, "table": None}
    missing = [f for f in FIELDS if find_field(table, f["name"]) is None]
    return {"create_table": False, "missing_fields": missing, "table": table}


def describe_plan(the_plan):
    if the_plan["create_table"]:
        print(f"  CREATE table `{TABLE_NAME}` with {len(FIELDS)} fields:")
    elif the_plan["missing_fields"]:
        print(f"  table `{TABLE_NAME}` exists; ADD {len(the_plan['missing_fields'])} missing field(s):")
    else:
        print(f"  table `{TABLE_NAME}` exists with all {len(FIELDS)} fields — nothing to create.")
        return

    for spec in the_plan["missing_fields"]:
        linked = spec.get("options", {}).get("linkedTableId")
        suffix = f" -> {linked}" if linked else ""
        primary = "  (primary)" if spec is FIELDS[0] and the_plan["create_table"] else ""
        print(f"    - {spec['name']:<22} {spec['type']}{suffix}{primary}")


def apply_descriptions(client, tables, dry_run: bool):
    """The two #181 fixes. Returns (fixed, unfixed)."""
    fixed, unfixed = 0, []
    for fix in DESCRIPTION_FIXES:
        table = next((t for t in tables if t["id"] == fix["table_id"]), None)
        field = find_field(table, fix["field_name"]) if table else None
        label = f"{fix['table_name']}.\"{fix['field_name']}\""

        if field is None:
            print(f"    ! {label}: field not found — nothing changed")
            unfixed.append(label)
            continue

        current = field.get("description") or ""
        if "replace" in fix:
            needle, replacement = fix["replace"]
            if needle not in current:
                print(f"    · {label}: the false clause is already gone — skipped")
                continue
            new_text = current.replace(needle, replacement)
        else:
            if fix["find"] not in current:
                print(f"    · {label}: the false sentence is already gone — skipped")
                continue
            new_text = fix["text"]

        print(f"    - {label}: {fix['why']}")
        if not dry_run:
            client.update_field_description(fix["table_id"], field["id"], new_text)
        fixed += 1
    return fixed, unfixed


def verify(client):
    """Re-read the live schema and report what is actually there.

    ASKED FOR AND CREATED ARE NOT THE SAME THING. This prints every field the
    base now holds for this table with the type it ended up with, every
    inverse field the four far tables gained, and whether each link carries
    prefersSingleRecordLink — the property the API cannot set, so this is also
    the list of what still needs a human.
    """
    tables = client.fetch_tables()
    table = find_table(tables, TABLE_NAME)
    problems = []

    if table is None:
        print(f"  `{TABLE_NAME}` is not in the base.")
        return ["table missing"], tables

    by_id = {t["id"]: t for t in tables}
    print(f"  `{TABLE_NAME}` ({table['id']}) — {len(table['fields'])} field(s) live:")
    for i, field in enumerate(table["fields"]):
        options = field.get("options") or {}
        extra = ""
        if field["type"] == "multipleRecordLinks":
            far = by_id.get(options.get("linkedTableId"), {})
            inverse_id = options.get("inverseLinkFieldId")
            inverse = next(
                (f for f in far.get("fields", []) if f["id"] == inverse_id), None
            )
            single = options.get("prefersSingleRecordLink", False)
            extra = (
                f" -> {far.get('name', '?')}"
                f" · inverse {far.get('name', '?')}.\"{(inverse or {}).get('name', '—')}\""
                f" · single={single}"
            )
        primary = "  (primary)" if field["id"] == table["primaryFieldId"] else ""
        marker = " " if find_field({"fields": FIELDS}, field["name"]) else "?"
        print(f"   {marker}{i + 1:>2}. {field['name']:<22} {field['type']}{extra}{primary}")

    # The spec, both directions.
    live_names = [f["name"] for f in table["fields"]]
    for spec in FIELDS:
        live = find_field(table, spec["name"])
        if live is None:
            problems.append(f"missing field {spec['name']}")
        elif live["type"] != spec["type"]:
            problems.append(
                f"{spec['name']} is {live['type']}, spec says {spec['type']}"
            )
        elif not (live.get("description") or "").strip():
            problems.append(f"{spec['name']} carries no description")
    for name in live_names:
        if find_field({"fields": FIELDS}, name) is None:
            problems.append(f"unexpected field {name}")
    if table["fields"] and table["fields"][0]["id"] != table["primaryFieldId"]:
        problems.append("the primary field is not the first one")
    primary_field = next(
        (f for f in table["fields"] if f["id"] == table["primaryFieldId"]), None
    )
    if (primary_field or {}).get("name") != FIELDS[0]["name"]:
        problems.append(f"the primary field is {(primary_field or {}).get('name')}")

    # The four inverses, checked on the far tables rather than inferred from
    # this one: the auto-created field is what a later reader will look for.
    print()
    print("  symmetric fields on the far tables:")
    for table_id, source in (
        (TBL_VENDORS, "Vendor"),
        (TBL_JOBS, "Job"),
        (TBL_USERS, "Recorded By"),
        (TBL_PURCHASE_REQUESTS, "Purchase Request"),
    ):
        far = by_id.get(table_id, {})
        inverse = find_field(far, TABLE_NAME)
        if inverse is None:
            print(f"    ! {far.get('name', table_id)}: no `{TABLE_NAME}` field")
            problems.append(f"no inverse on {far.get('name', table_id)}")
        else:
            print(
                f"    · {far.get('name', table_id)}.\"{inverse['name']}\" "
                f"({inverse['type']}) — the inverse of {TABLE_NAME}.\"{source}\""
            )

    # The descriptions this run was also meant to correct.
    print()
    print("  the two corrected descriptions:")
    for fix in DESCRIPTION_FIXES:
        far = by_id.get(fix["table_id"], {})
        field = find_field(far, fix["field_name"])
        current = (field or {}).get("description") or ""
        needle = fix["replace"][0] if "replace" in fix else fix["find"]
        still_false = needle in current
        print(
            f"    {'!' if still_false else '·'} "
            f"{fix['table_name']}.\"{fix['field_name']}\": "
            f"{'THE FALSE TEXT IS STILL THERE' if still_false else 'corrected'}"
        )
        if still_false:
            problems.append(f"{fix['table_name']}.{fix['field_name']} still false")

    return problems, tables


def main():
    parser = argparse.ArgumentParser(
        description="Create the Direct Purchases table (#272) and correct two false field descriptions"
    )
    parser.add_argument("--base-id", default=AIRTABLE_BASE_ID, help="Airtable Base ID")
    parser.add_argument(
        "--dry-run", action="store_true", help="Print the plan without writing anything"
    )
    args = parser.parse_args()

    client = AirtableSchemaClient(AIRTABLE_API_KEY, args.base_id)

    print("=" * 72)
    print(f"create_direct_purchases_272 — base {args.base_id}")
    print("=" * 72)
    print()

    print("Reading the current schema...")
    tables = client.fetch_tables()
    print(f"  {len(tables)} tables")
    print()

    the_plan = plan(tables)
    print("1/3  the table")
    describe_plan(the_plan)
    print()

    print("2/3  the two false field descriptions (#181)")
    # Dry run reports both halves before anything is written; a real run
    # writes the table first, so a failure there costs nothing elsewhere.
    if args.dry_run:
        apply_descriptions(client, tables, dry_run=True)
        print()
        print("=" * 72)
        print("DRY RUN — nothing was written.")
        return 2

    failed = False
    try:
        if the_plan["create_table"]:
            created = client.create_table(
                TABLE_NAME, TABLE_DESCRIPTION, [field_payload(f) for f in FIELDS]
            )
            print(f"     created table {created['id']} with {len(created['fields'])} fields")
        else:
            for spec in the_plan["missing_fields"]:
                client.create_field(the_plan["table"]["id"], field_payload(spec))
                print(f"     added {spec['name']}")
    except requests.HTTPError as err:
        body = err.response.text if err.response is not None else ""
        print(f"     FAILED: {err}\n     {body}")
        failed = True

    fixed, unfixed = apply_descriptions(client, client.fetch_tables(), dry_run=False)
    print(f"     {fixed} description(s) rewritten")
    print()

    print("3/3  verifying against the live schema")
    problems, _ = verify(client)
    print()

    print("=" * 72)
    if failed or problems:
        for problem in problems:
            print(f"  PROBLEM: {problem}")
        if unfixed:
            print(f"  PROBLEM: description not applied: {', '.join(unfixed)}")
        return 1

    print("The base matches the spec: 1 table, 10 fields, 4 symmetric fields.")
    print()
    print("STILL TO DO BY HAND — the Metadata API refuses prefersSingleRecordLink")
    print("(422 on CREATE and on UPDATE), so turn OFF \"Allow linking to multiple")
    print("records\" on these four link fields in the Airtable UI:")
    for name in MANUAL_FOLLOW_UP:
        print(f"  - {name}")
    print()
    print("The app enforces single-record on all four either way; this makes the")
    print("base agree, as Deliveries.\"Job\" and Invoices.\"Vendor\" already do.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

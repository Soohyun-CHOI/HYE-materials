"""
Adds the shared canonical Unit option list as select choices on PR Items,
PO Items, and Invoice Items' Unit fields (issue #83). All three fields are
already singleSelect (manually converted/added in Airtable) with an empty
choice list -- this script only adds options, it never touches or maps
existing record values.

Usage examples (reads AIRTABLE_API_KEY / AIRTABLE_BASE_ID from .env.local
at the repo root automatically, same as import_jobs.py -- no manual
export needed for local dev):
    python3 add_unit_options.py --dry-run
    python3 add_unit_options.py

How it works:
  - Airtable's Metadata API does NOT support editing a select field's
    option list directly (confirmed by direct testing against this same
    base: a PATCH to /meta/bases/{base}/tables/{table}/fields/{field} with
    a populated options.choices consistently returns 422
    INVALID_REQUEST_UNKNOWN, even though the same token can successfully
    PATCH a field's name/description -- so this is a platform limitation,
    not a scope/permission problem, and applies the same way regardless of
    which HTTP client or library makes the call).
  - The only way to add a select choice via the API is the `typecast=True`
    side effect on a normal record write: writing a value that isn't yet a
    choice auto-creates it (same trick as import_jobs.py's Business Unit
    field, and lib/airtable/editLog.js's Field Name select in the Next.js
    app). A select field holds one value per record, so creating all 19
    choices for one field takes 19 sequential writes.
  - To do this without touching real data, each table gets one throwaway
    "scratch" record: created with no fields, cycled through every
    not-yet-existing canonical Unit value (one PATCH per value, each with
    typecast=True), then deleted. If a table's Unit field already has
    every canonical value (e.g. a re-run), no scratch record is created at
    all for that table.
  - Fetches each field's current choices from the Metadata API first (a
    read-only call) so a --dry-run's counts match what a real run would
    do, and so re-running only writes whatever's actually still missing --
    naturally idempotent, matching the "typecast is a no-op for an
    already-existing choice name" behavior.

Requirements:
  - pip install requests python-dotenv (same as import_jobs.py -- no new
    dependencies; this only needs record read/write + schema read, no
    library actually supports editing select options anyway, so there's
    nothing a heavier client like pyairtable would add here).
  - An Airtable Personal Access Token (an existing token can be reused).

Token scopes (an existing token from the Next.js project can be reused):
  - schema.bases:read   (to read each Unit field's current choices)
  - data.records:read   (not otherwise needed, but implied by most tokens)
  - data.records:write  (to create the scratch record, cycle it through
    each missing value via typecast, and delete it)
  - Those scopes plus access to this Base are sufficient.
"""

import argparse
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# ----------------------------------------------------------------------------
# Environment
# ----------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if not load_dotenv(PROJECT_ROOT / ".env.local"):
    raise RuntimeError(f"Could not load {PROJECT_ROOT / '.env.local'}")

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
AIRTABLE_API_KEY = os.environ["AIRTABLE_API_KEY"]
AIRTABLE_BASE_ID = os.environ["AIRTABLE_BASE_ID"]

FIELD_UNIT = "Unit"

# Table name or table ID (tblXXXXXXXX) both work -- table names used here
# for readability, same as import_jobs.py's AIRTABLE_TABLE_NAME.
TARGET_TABLES = ["PR Items", "PO Items", "Invoice Items"]

# Canonical Unit list (issue #83) -- shared across all three tables, and
# with the Next.js app's own copy at lib/units.js (issue #86), which
# renders this same list as the Unit dropdown on the PR forms. A plain
# Python script can't import a JS module, so this list is necessarily
# duplicated -- if it ever changes, update both places.
CANONICAL_UNITS = [
    "EA", "FT", "SET", "LS", "LOT", "M", "ROLL", "PCS", "SHEET", "M/D",
    "FIT", "SQFT", "IN", "Lengths", "KG", "PSI", "TUBES", "PACK", "ST",
]

AIRTABLE_API_ROOT = "https://api.airtable.com/v0"
AIRTABLE_META_ROOT = "https://api.airtable.com/v0/meta"
REQUEST_PAUSE_SEC = 0.25  # stay under Airtable's rate limit (5 req/sec)


# ----------------------------------------------------------------------------
# Airtable API
# ----------------------------------------------------------------------------
class AirtableSchemaClient:
    """Talks to both the Metadata API (schema reads only -- see this file's
    docstring for why option writes aren't possible there) and the regular
    record API (for the scratch-record typecast trick)."""

    def __init__(self, token: str, base_id: str):
        self.base_id = base_id
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def fetch_tables(self):
        resp = requests.get(f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables", headers=self.headers)
        resp.raise_for_status()
        return resp.json()["tables"]

    def find_field(self, tables, table_name: str, field_name: str):
        """Returns (table_id, field_id, current_choice_names) for the given
        table/field name. Raises if either isn't found -- a missing Unit
        field means the manual Airtable setup described in issue #83 hasn't
        actually been done yet, which this script shouldn't silently paper
        over."""
        table = next((t for t in tables if t["name"] == table_name or t["id"] == table_name), None)
        if not table:
            raise ValueError(f"Table '{table_name}' not found in this base.")

        field = next((f for f in table["fields"] if f["name"] == field_name), None)
        if not field:
            raise ValueError(f"Field '{field_name}' not found on table '{table_name}'.")
        if field["type"] != "singleSelect":
            raise ValueError(
                f"'{table_name}'.{field_name} is a {field['type']}, not singleSelect -- "
                "expected it to already be manually converted per issue #83."
            )

        choices = [c["name"] for c in field.get("options", {}).get("choices", [])]
        return table["id"], field["id"], choices

    def create_scratch_record(self, table_id: str) -> str:
        resp = requests.post(
            f"{AIRTABLE_API_ROOT}/{self.base_id}/{table_id}",
            headers=self.headers,
            json={"fields": {}},
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def set_unit_value(self, table_id: str, record_id: str, value: str):
        resp = requests.patch(
            f"{AIRTABLE_API_ROOT}/{self.base_id}/{table_id}/{record_id}",
            headers=self.headers,
            json={"fields": {FIELD_UNIT: value}, "typecast": True},
        )
        resp.raise_for_status()

    def delete_record(self, table_id: str, record_id: str):
        resp = requests.delete(
            f"{AIRTABLE_API_ROOT}/{self.base_id}/{table_id}/{record_id}",
            headers=self.headers,
        )
        resp.raise_for_status()


# ----------------------------------------------------------------------------
# Main logic
# ----------------------------------------------------------------------------
def add_missing_units_to_table(client: AirtableSchemaClient, tables, table_name: str, dry_run: bool):
    table_id, field_id, existing_choices = client.find_field(tables, table_name, FIELD_UNIT)
    existing_set = set(existing_choices)
    missing = [u for u in CANONICAL_UNITS if u not in existing_set]

    print(f"[{table_name}] Unit field has {len(existing_choices)} existing choice(s); "
          f"{len(missing)} missing: {missing if missing else '(none -- already complete)'}")

    if not missing:
        return 0

    if dry_run:
        print(f"  (dry-run) would create 1 scratch record and add: {', '.join(missing)}")
        return len(missing)

    scratch_id = client.create_scratch_record(table_id)
    try:
        for value in missing:
            client.set_unit_value(table_id, scratch_id, value)
            print(f"  added choice: {value}")
            time.sleep(REQUEST_PAUSE_SEC)
    finally:
        # Always clean up the scratch record, even if a write failed
        # partway through -- whatever choices were already created by
        # typecast stay (that's the point), only the throwaway record
        # itself needs to disappear.
        client.delete_record(table_id, scratch_id)
        time.sleep(REQUEST_PAUSE_SEC)

    return len(missing)


def main():
    parser = argparse.ArgumentParser(description="Add canonical Unit select options to PR Items, PO Items, Invoice Items")
    parser.add_argument("--base-id", default=AIRTABLE_BASE_ID, help="Airtable Base ID")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, without writing to Airtable")
    args = parser.parse_args()

    client = AirtableSchemaClient(AIRTABLE_API_KEY, args.base_id)

    print("Fetching current schema...")
    tables = client.fetch_tables()
    print()

    total_added = 0
    for table_name in TARGET_TABLES:
        total_added += add_missing_units_to_table(client, tables, table_name, dry_run=args.dry_run)
        print()

    print("=" * 50)
    verb = "would be added" if args.dry_run else "added"
    print(f"Done: {total_added} choice(s) {verb} across {len(TARGET_TABLES)} table(s).")


if __name__ == "__main__":
    main()

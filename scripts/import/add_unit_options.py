"""
Brings the Unit field of every table in TARGET_TABLES below into line with
the shared canonical option list (issue #83): it creates the field when the
table has none, adds any missing options when it does, and reports the
choice colors either way. It never touches or maps existing record values,
and it never removes an option -- Airtable has no API for that.

TARGET_TABLES IS THE ONLY THING TO EDIT WHEN A TABLE JOINS THE LIST.
Nothing else here names a table or counts them, so a new table costs one
list entry and no other change. Which tables carry the field, and why each
one does, is recorded in CLAUDE.md and in the Airtable field descriptions
rather than restated here, where it would go stale the next time the list
grows.

Where a target table's natural key includes Unit, the select does more
than constrain input: a text variant ("ea" or "EA " against "EA") would
silently become a second row for the same thing rather than merely
mislabelling one. Those tables are written only by the backend, copying a
Unit that is already constrained upstream, so the select is a structural
guarantee rather than a fix -- which is why each is converted while it
still holds zero records.

Usage examples (reads AIRTABLE_API_KEY / AIRTABLE_BASE_ID from .env.local
at the repo root automatically, same as import_jobs.py -- no manual
export needed for local dev):
    python3 add_unit_options.py --dry-run
    python3 add_unit_options.py

Exit codes, per CLAUDE.md's convention for anything that computes a
verdict: 0 everything matches, 1 something failed, 2 nothing failed but
something could not be completed (see the color note below -- that state
is reachable, so it needs a code of its own rather than a printed line a
caller cannot see).

TWO WAYS A FIELD CAN GET ITS OPTIONS, and which one runs decides whether
the CHOICE COLORS come out right:

  1. FIELD DOES NOT EXIST YET -> this script creates it, in one call, with
     every canonical option AND its color (POST to
     /meta/bases/{base}/tables/{table}/fields; per Airtable's field spec a
     choice may carry a color, and colors are auto-assigned when it is
     omitted). This is the path that gets colors right, so it is the
     preferred one: leave the Unit field off a new table and let this
     script add it.
  2. FIELD ALREADY EXISTS -> the only way to add a choice is the
     `typecast=True` side effect on a normal record write: writing a value
     that isn't yet a choice auto-creates it (same trick as
     import_jobs.py's Business Unit field, and lib/airtable/editLog.js's
     Field Name select in the Next.js app). A select field holds one value
     per record, so this costs one sequential write per missing choice.
     TYPECAST GIVES EVERY OPTION IT CREATES THE SAME DEFAULT COLOR, and
     nothing can then recolor it -- see below.

  A field that EXISTS BUT HAS NO OPTIONS is refused rather than filled in,
  because it is exactly where the two paths disagree and it is easy to
  reach by accident: emptying a field's options by hand, or deleting and
  recreating the field to preserve its description, both land there. Path 2
  would give all 19 the default color permanently, so the script says to
  delete the field and re-run -- which takes path 1 and gets the colors
  right -- and exits 2. `--allow-default-colors` overrides it for whoever
  would rather keep the description than the colors. The choice is the
  caller's because the trade is real: deleting a field also deletes its
  description, and this script cannot put that back.

WHY A WRONG COLOR CANNOT BE REPAIRED HERE. Airtable's Metadata API does
not support editing an existing select field's option list at all, colors
included. Measured against this base: a PATCH to
/meta/bases/{base}/tables/{table}/fields/{field} carrying
options.choices returns 422 INVALID_REQUEST_UNKNOWN in every shape tried
-- full list with each choice's own id, id+color only, and both again
with `type` alongside -- while the same token PATCHing only that field's
description on the same request path returns 200. So it is a platform
limitation and specifically NOT a token-scope problem, which the 200
rules out. Consequently this script REPORTS a color mismatch it cannot
fix and exits 2, naming the field and the expected colors. The remedy is
either to recolor by hand in Airtable, or -- only while the field holds
no values worth keeping -- to delete the field there and re-run this
script so path 1 above creates it correctly.

How the option-adding path avoids touching real data: each table gets one
throwaway "scratch" record, created with no fields, cycled through every
not-yet-existing canonical Unit value (one PATCH per value, each with
typecast=True), then deleted. A table whose Unit field already holds every
canonical value gets no scratch record at all. Current choices are read
from the Metadata API first, so a --dry-run's counts match what a real run
would do and a re-run only writes what is actually still missing --
naturally idempotent, matching typecast's own no-op behaviour for a choice
name that already exists.

Requirements:
  - pip install requests python-dotenv (same as import_jobs.py -- no new
    dependencies; this only needs record read/write + schema read/write, no
    library actually supports editing select options anyway, so there's
    nothing a heavier client like pyairtable would add here).
  - An Airtable Personal Access Token (an existing token can be reused).

Token scopes (an existing token from the Next.js project can be reused):
  - schema.bases:read   (to read each Unit field's current choices)
  - schema.bases:write  (to create a missing Unit field -- path 1 above)
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

# EVERY TABLE WHOSE Unit FIELD SHOULD CARRY THE CANONICAL LIST -- the one
# place to edit when another joins. Table name or table ID (tblXXXXXXXX)
# both work; names are used for readability, same as import_jobs.py's
# AIRTABLE_TABLE_NAME. Order is compared by
# scripts/tests/offline/unit-options.mjs, so append rather than reshuffle.
TARGET_TABLES = ["PR Items", "PO Items", "Invoice Items", "Materials", "Delivery Items"]

# Canonical Unit list (issue #83) -- shared across every target table, and
# with the Next.js app's own copy at lib/units.js (issue #86), which
# renders this same list as the Unit dropdown on the PR forms. A plain
# Python script can't import a JS module, so this list is necessarily
# duplicated -- if it ever changes, update both places. That the two agree
# is checked by scripts/tests/offline/unit-options.mjs.
CANONICAL_UNITS = [
    "EA", "FT", "SET", "LS", "LOT", "M", "ROLL", "PCS", "SHEET", "M/D",
    "FIT", "SQFT", "IN", "Lengths", "KG", "PSI", "TUBES", "PACK", "ST",
]

# Choice colors, read off the fields that were colored by hand before this
# script could do it and confirmed identical on all of them: the first
# options walk Airtable's light palette from blue round to purple, and every
# option past the end of that walk is grey.
#
# Expressed as a cycle plus an overflow rather than as one color per unit,
# so that adding a unit to CANONICAL_UNITS needs no edit here: it simply
# takes the next palette color, or grey once the palette is used up. The
# grey tail is not a leftover -- it is what "no color left to distinguish
# this one" looks like, and it matches what a human would get by adding
# options in the Airtable UI.
CHOICE_COLOR_CYCLE = [
    "blueLight2", "cyanLight2", "tealLight2", "greenLight2", "yellowLight2",
    "orangeLight2", "redLight2", "pinkLight2", "purpleLight2",
]
CHOICE_COLOR_OVERFLOW = "grayLight2"


def color_for_index(index: int) -> str:
    """The color the option at this position in CANONICAL_UNITS should carry."""
    if index < len(CHOICE_COLOR_CYCLE):
        return CHOICE_COLOR_CYCLE[index]
    return CHOICE_COLOR_OVERFLOW


def expected_choices():
    """The full choice list, in order, as Airtable's field spec wants it."""
    return [
        {"name": unit, "color": color_for_index(i)}
        for i, unit in enumerate(CANONICAL_UNITS)
    ]


def expected_color_by_name():
    return {unit: color_for_index(i) for i, unit in enumerate(CANONICAL_UNITS)}


AIRTABLE_API_ROOT = "https://api.airtable.com/v0"
AIRTABLE_META_ROOT = "https://api.airtable.com/v0/meta"
REQUEST_PAUSE_SEC = 0.25  # stay under Airtable's rate limit (5 req/sec)


# ----------------------------------------------------------------------------
# Airtable API
# ----------------------------------------------------------------------------
class AirtableSchemaClient:
    """Talks to both the Metadata API (schema reads, plus CREATING a missing
    select field -- see this file's docstring for why an existing field's
    options can't be written there) and the regular record API (for the
    scratch-record typecast trick)."""

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

    def find_table(self, tables, table_name: str):
        """The named table, by name or by id. Raises if it isn't there: a
        table listed in TARGET_TABLES that the base does not have is a real
        mismatch between this script and the base, not something to skip."""
        table = next((t for t in tables if t["name"] == table_name or t["id"] == table_name), None)
        if not table:
            raise ValueError(f"Table '{table_name}' not found in this base.")
        return table

    def find_field(self, table, field_name: str):
        """The named field, or None when the table doesn't have it yet --
        which is not an error but the preferred starting point, since a
        field this script creates gets its choice colors right (see the
        docstring). Raises only if the field exists with the wrong type,
        because then neither path can proceed and silently doing nothing
        would look like success."""
        field = next((f for f in table["fields"] if f["name"] == field_name), None)
        if field is None:
            return None
        if field["type"] != "singleSelect":
            raise ValueError(
                f"'{table['name']}'.{field_name} is a {field['type']}, not singleSelect -- "
                "either convert it by hand in Airtable, or remove it and let this script "
                "create it (issue #83 established the pattern)."
            )
        return field

    def create_select_field(self, table_id: str, field_name: str, choices):
        """Create the select field with every option AND its color in one
        call. This is the only path that can set colors at all.

        No description is sent: the text belongs to the table, not to this
        script, and inventing a generic one would be worse than leaving the
        field undocumented for the moment it takes to paste the real one in.
        """
        payload = {
            "name": field_name,
            "type": "singleSelect",
            "options": {"choices": choices},
        }
        resp = requests.post(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables/{table_id}/fields",
            headers=self.headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

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
def report_colors(field, table_name: str):
    """Compare the field's actual choice colors against what this script
    would have given them, and name every difference.

    Reported rather than repaired because repair is not available: an
    existing field's options cannot be written through the API at all (see
    the docstring's measurement). A mismatch is therefore the "could not be
    completed" state, not a failure -- the options themselves are correct,
    only their colors are not.
    """
    wanted = expected_color_by_name()
    actual = {
        c["name"]: c.get("color")
        for c in field.get("options", {}).get("choices", [])
    }
    if not actual:
        # "all 0 choices match" reads as a pass and is not one.
        print("  no choices to check")
        return 0

    wrong = [
        (name, actual[name], wanted[name])
        for name in CANONICAL_UNITS
        if name in actual and actual[name] != wanted[name]
    ]
    if not wrong:
        print(f"  colors match on all {len(actual)} choice(s)")
        return 0

    # ASCII only in printed output: this runs in terminals whose code page is
    # not UTF-8 (Windows cp949 among them), where an em dash arrives as a
    # replacement character and makes correct output look broken.
    print(f"  COLORS DIFFER on {len(wrong)} choice(s) -- the API cannot change these:")
    for name, got, want in wrong:
        print(f"    {name}: {got} -> should be {want}")
    print(f"  Fix by hand in Airtable, or -- only if '{table_name}'.{FIELD_UNIT} holds no")
    print(f"  values worth keeping -- delete the field there and re-run this script,")
    print(f"  which then creates it with the right colors. NOTE that deleting a field")
    print(f"  also deletes its DESCRIPTION, which this script cannot restore: copy the")
    print(f"  description out of Airtable first and paste it back afterwards.")
    return len(wrong)


def sync_unit_field(client: AirtableSchemaClient, tables, table_name: str, dry_run: bool,
                    allow_default_colors: bool = False):
    """Bring one table's Unit field in line with the canonical list.

    Returns (choices_added, colors_wrong, skipped) so the caller can tell
    "did work" from "could not finish" from "declined to make it worse".
    """
    table = client.find_table(tables, table_name)
    field = client.find_field(table, FIELD_UNIT)

    # --- Path 1: the field does not exist. Create it, colors included.
    if field is None:
        print(f"[{table_name}] no {FIELD_UNIT} field yet -- will create it with all "
              f"{len(CANONICAL_UNITS)} option(s) and their colors")
        if dry_run:
            preview = ", ".join(c["name"] + "/" + c["color"] for c in expected_choices())
            print(f"  (dry-run) would create the field: {preview}")
            return len(CANONICAL_UNITS), 0, False

        created = client.create_select_field(table["id"], FIELD_UNIT, expected_choices())
        time.sleep(REQUEST_PAUSE_SEC)
        print(f"  created field {created.get('id')} with {len(CANONICAL_UNITS)} option(s)")
        # Re-read rather than trust the response: colors are the whole point
        # of taking this path, so whether they actually landed is measured on
        # every run instead of being assumed here.
        fresh = client.find_field(client.find_table(client.fetch_tables(), table_name), FIELD_UNIT)
        return len(CANONICAL_UNITS), report_colors(fresh, table_name), False

    # --- Path 2: the field exists. Options via typecast; colors are fixed.
    existing_choices = [c["name"] for c in field.get("options", {}).get("choices", [])]
    existing_set = set(existing_choices)
    missing = [u for u in CANONICAL_UNITS if u not in existing_set]

    print(f"[{table_name}] {FIELD_UNIT} field has {len(existing_choices)} existing choice(s); "
          f"{len(missing)} missing: {missing if missing else '(none -- already complete)'}")

    # An EMPTY existing field is the one case where filling it in is the wrong
    # move, and it is easy to arrive at by accident: emptying a field's options
    # by hand, or deleting and recreating it to keep its description, both land
    # here. Typecast would then give all of them the default color and NOTHING
    # can change that afterwards -- so the script would quietly cement the
    # outcome this whole path exists to avoid, having been asked to help.
    # Deleting the field and re-running takes path 1 and gets the colors right;
    # the cost is re-pasting the description, which is why this is a refusal to
    # be overridden rather than an automatic decision.
    if not existing_choices and not allow_default_colors:
        print(f"  SKIPPED -- the field exists but has no options, so adding them here would")
        print(f"  give every one Airtable's default color, permanently. Delete")
        print(f"  '{table_name}'.{FIELD_UNIT} in Airtable and re-run: the script then creates")
        print(f"  the field with the right colors. Copy its DESCRIPTION out first, since")
        print(f"  deleting a field deletes that too and this script cannot restore it.")
        print(f"  To add the options anyway and accept the default color, re-run with")
        print(f"  --allow-default-colors.")
        return 0, 0, True

    if dry_run:
        if missing:
            print(f"  (dry-run) would create 1 scratch record and add: {', '.join(missing)}")
            print(f"  (dry-run) note: options added this way all take Airtable's default")
            print(f"  color, and cannot be recolored through the API afterwards")
        return len(missing), report_colors(field, table_name), False

    if missing:
        scratch_id = client.create_scratch_record(table["id"])
        try:
            for value in missing:
                client.set_unit_value(table["id"], scratch_id, value)
                print(f"  added choice: {value}")
                time.sleep(REQUEST_PAUSE_SEC)
        finally:
            # Always clean up the scratch record, even if a write failed
            # partway through -- whatever choices were already created by
            # typecast stay (that's the point), only the throwaway record
            # itself needs to disappear.
            client.delete_record(table["id"], scratch_id)
            time.sleep(REQUEST_PAUSE_SEC)
        # Re-read so the color report below sees the options just created.
        field = client.find_field(client.find_table(client.fetch_tables(), table_name), FIELD_UNIT)

    return len(missing), report_colors(field, table_name), False


def main():
    parser = argparse.ArgumentParser(description="Add the canonical Unit select options to every table in TARGET_TABLES")
    parser.add_argument("--base-id", default=AIRTABLE_BASE_ID, help="Airtable Base ID")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, without writing to Airtable")
    parser.add_argument(
        "--allow-default-colors",
        action="store_true",
        help="Fill in an existing field that has no options, accepting Airtable's "
             "default color for every one of them (permanent -- see the module docstring)",
    )
    args = parser.parse_args()

    client = AirtableSchemaClient(AIRTABLE_API_KEY, args.base_id)

    print("Fetching current schema...")
    tables = client.fetch_tables()
    print()

    total_added = 0
    total_colors_wrong = 0
    skipped = []
    failed = []
    for table_name in TARGET_TABLES:
        try:
            added, colors_wrong, was_skipped = sync_unit_field(
                client, tables, table_name,
                dry_run=args.dry_run,
                allow_default_colors=args.allow_default_colors,
            )
        except Exception as err:  # noqa: BLE001 -- one bad table must not hide the rest
            print(f"[{table_name}] FAILED: {err}")
            failed.append(table_name)
        else:
            total_added += added
            total_colors_wrong += colors_wrong
            if was_skipped:
                skipped.append(table_name)
        print()

    print("=" * 50)
    verb = "would be added" if args.dry_run else "added"
    print(f"Done: {total_added} choice(s) {verb} across {len(TARGET_TABLES)} table(s).")

    # Exit codes per CLAUDE.md: 0 all clear, 1 something failed, 2 nothing
    # failed but something could not be completed. A printed warning that
    # returns 0 makes a problem indistinguishable from success to anything
    # except a human reading the output.
    if failed:
        print(f"FAILED on: {', '.join(failed)}")
        return 1
    if skipped:
        print(f"INCOMPLETE -- skipped (empty field, would force default colors): "
              f"{', '.join(skipped)}; see above.")
        return 2
    if total_colors_wrong:
        print(f"INCOMPLETE -- {total_colors_wrong} choice color(s) the API cannot change; see above.")
        return 2
    if args.dry_run and total_added:
        print("INCOMPLETE -- dry run, nothing written.")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

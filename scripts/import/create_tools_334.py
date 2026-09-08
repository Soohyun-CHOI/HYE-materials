"""
Creates the three tables a tool and its history live in (issue #334):
`Tools`, `Tool Items` and `Tool Log`.

WHAT THEY ARE FOR. The company buys drills, grinders and the like, hands
them out to sites, and gets them back when a project ends -- and none of
that is recorded anywhere today. Each physical tool gets a QR label; a
scan on a phone moves it between `In Stock` and `Out`, and the app can
then answer what is where. A tool is bought BY THE KIND and tracked ONE
AT A TIME, so the kind and the object are separate tables: `Tools` holds
the name a person types, `Tool Items` holds the thing the sticker is
stuck to and carries the printed ID, and `Tool Log` holds what has
happened to one -- because a status field answers where a tool is now and
nothing about the project that just ended.

RUN THIS ONCE. It is idempotent -- an existing table is reported and its
missing fields are added, an existing field is left alone -- but the
tables it creates CANNOT be removed through any API: `DELETE` on a table
is a 404 with no endpoint behind it (measured, docs/notes/airtable-
access.md). The names have to be right the first time, and seven later
issues read them.

ORDER MATTERS AND IS NOT ALPHABETICAL. A link field's options take the
target table's ID, so `Tools` is created first (it links to nothing),
then `Tool Items` (-> Tools, Jobs), then `Tool Log` (-> Tool Items, Jobs,
Users). The two IDs that do not exist yet are read off each create
response rather than being spelled here.

THE TWO SELECT OPTION LISTS ARE THE ONE THING THIS RUN CANNOT UNDO.
Measured and recorded in docs/notes/airtable-access.md: a PATCH carrying
`options.choices` on a singleSelect is refused 422 in every shape tried
-- the message even talks about field types, which gives no hint that the
option list is the part being refused. `typecast` on a record write can
add a choice but gives it a default color nothing can change afterwards,
which is how two `Edit Log` options sat off the palette for two issues
(#181). So both lists, and both sets of COLORS, go in on field CREATE.
`scripts/tests/offline/tool-status.mjs` pins them against
`lib/toolStatus.js` so the two cannot drift.

THE COLOR RULE, stated so it can be checked rather than admired: walk
Airtable's light palette in declaration order skipping red and gray, then
give the negative value red and the terminal value gray. That is what
`Purchase Orders."Status"` already does (blue, cyan, teal, then red for
`Withdrawn`).

NO `Unit` FIELD, AND THAT IS NOT AN OVERSIGHT. A tool item is one object,
not a quantity, so nothing here needs the canonical 19-value list and
`add_unit_options.py` stays a five-table script -- the same note
`create_direct_purchases_272.py` makes for its own table.

THE SYMMETRIC FIELDS ARE FREE AND ALL FIVE ARE THE NAME WE WOULD HAVE
CHOSEN, so none is renamed. Creating a link auto-creates the inverse on
the far table named after the SOURCE TABLE, which is why no `(as X)`
suffix is needed anywhere here: the two links into `Jobs` come from two
different tables, so they land as `Jobs."Tool Items"` and
`Jobs."Tool Log"` already distinct. The `(Initiated)`/`(Sent To)` shape on
`Users` exists for the other case -- two links from ONE table onto one far
table -- and this schema has none.

Usage (reads AIRTABLE_API_KEY / AIRTABLE_BASE_ID from .env.local at the
repo root, same as add_unit_options.py and create_direct_purchases_272.py):
    python3 scripts/import/create_tools_334.py --dry-run
    python3 scripts/import/create_tools_334.py

Exit codes, per docs/notes/verification.md: 0 the base matches the spec,
1 something failed, 2 nothing failed but something is incomplete (a dry
run).

VERIFICATION IS PART OF THE RUN. What was asked for and what exists can
differ -- an option silently dropped, an inverse named something else --
so the last thing this does is re-read the live schema and compare every
field, every choice and every inverse against the spec.

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

# Existing table IDs, spelled rather than looked up by name: a link field's
# options take an ID, and resolving a name at runtime would make a renamed
# table fail here instead of at the rename.
TBL_JOBS = "tblGwgHuhTX6rwF1M"
TBL_USERS = "tblisLwTKXyKtsTcy"

# The datetime shape this base already uses, read off Deliveries."Created At"
# rather than chosen here, so a new table cannot introduce a second way to
# render a timestamp.
DATETIME_OPTIONS = {
    "dateFormat": {"name": "local", "format": "l"},
    "timeFormat": {"name": "12hour", "format": "h:mma"},
    "timeZone": "utc",
}

# ----------------------------------------------------------------------------
# The two closed vocabularies
# ----------------------------------------------------------------------------
# DUPLICATED FROM lib/toolStatus.js BECAUSE PYTHON CANNOT IMPORT JS -- the same
# structural duplication `add_unit_options.py` carries for CANONICAL_UNITS, and
# closed the same way: `scripts/tests/offline/tool-status.mjs` parses these two
# lists out of THIS FILE and asserts they are the JS values, in order, with the
# colors. Editing one without the other fails CI.
TOOL_STATUS_CHOICES = [
    {"name": "In Stock", "color": "blueLight2"},
    {"name": "Out", "color": "cyanLight2"},
    {"name": "In Repair", "color": "tealLight2"},
    {"name": "Lost", "color": "redLight2"},
    {"name": "Retired", "color": "grayLight2"},
]

TOOL_EVENT_CHOICES = [
    {"name": "Checked Out", "color": "blueLight2"},
    {"name": "Checked In", "color": "cyanLight2"},
    {"name": "Sent to Repair", "color": "tealLight2"},
    {"name": "Returned from Repair", "color": "greenLight2"},
    {"name": "Lost", "color": "redLight2"},
    {"name": "Found", "color": "yellowLight2"},
    {"name": "Retired", "color": "grayLight2"},
    {"name": "Job Changed", "color": "orangeLight2"},
]

# ----------------------------------------------------------------------------
# The spec
# ----------------------------------------------------------------------------
# THE FIRST ENTRY IN EACH `fields` LIST IS THE PRIMARY FIELD. Airtable takes the
# first field in a create-table payload as the primary one, and a primary field
# cannot be a link or an attachment.
TOOLS = {
    "name": "Tools",
    # Created by Airtable when Tool Items."Tool" is made, not sent by us.
    "auto_inverses": ["Tool Items"],
    "description": (
        "Issue #334 -- the KIND a tool is bought as, not the object on the shelf. "
        "One row per kind; the physical units are Tool Items, one row each, "
        "because a company buys six of the same drill and then tracks them one at "
        "a time. Takes no minted ID, the way Vendors and Materials do not: nothing "
        "prints a kind and nobody quotes one, so the typed name is the identity. "
        "That uniqueness is app-enforced (Airtable has no unique constraint) -- "
        "createToolAction refuses a second kind with the same name."
    ),
    "fields": [
        {
            "name": "Tool Name",
            "type": "singleLineText",
            "description": (
                "Issue #334 -- what a person calls this kind of tool, typed on the "
                "registration form. The natural key: app-enforced unique, matched "
                "case-insensitively because Airtable's = on a text field is, and "
                "because Impact Driver and impact driver are one kind whose count "
                "must not split in two."
            ),
        },
    ],
}


def tool_items(tools_table_id):
    return {
        "name": "Tool Items",
        # Created by Airtable when Tool Log."Tool Item" is made, not sent by us —
        # and load-bearing: it is the array getToolLogByToolItem walks.
        "auto_inverses": ["Tool Log"],
        "description": (
            "Issue #334 -- one physical tool, the thing a QR label is stuck to. "
            "Status is one axis with five values and is a CACHE of the last Tool "
            "Log row, written by the app and never by an Airtable formula: the two "
            "vocabularies differ (five statuses, eight events) and Job Changed is a "
            "last row that leaves the status alone, so turning an event into a "
            "status is a mapping rather than a copy. lib/toolStatus.js holds it."
        ),
        "fields": [
            {
                "name": "Tool Item ID",
                "type": "singleLineText",
                "description": (
                    "Issue #334 -- format HYE-TL-YYMMDD-###, backend-generated, "
                    "counter resets daily (lib/ids.js:mintDailyId). The sequence is "
                    "counted over the rows whose Tool Item ID carries the same "
                    "prefix, never over a date field (#164).\n\n"
                    "THIS IS THE PRINTED IDENTITY, which is what makes it different "
                    "in kind from every other minted ID here: it is encoded into a "
                    "QR label and glued to a tool. Two rows sharing one means two "
                    "tools wearing the same label and the repair is reprinting both. "
                    "Issue #335 sets the sequence width, which is wider than the "
                    "document families because one registration can create many "
                    "units at once."
                ),
            },
            {
                "name": "Tool",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": tools_table_id},
                "description": (
                    "Issue #334 -- the kind this unit is one of. Single-record, "
                    "app-enforced: the Metadata API refuses prefersSingleRecordLink "
                    "on both field CREATE and UPDATE (422), the same limit "
                    'Invoices."Delivery" and Invoice Items."PO Item" live with.'
                ),
            },
            {
                "name": "Status",
                "type": "singleSelect",
                "options": {"choices": TOOL_STATUS_CHOICES},
                "description": (
                    "Issue #334 -- where this tool is now. In Stock and Out are the "
                    "pair a scan moves between; In Repair, Lost and Retired are set "
                    "from a screen. Lost is NOT terminal (a lost tool turns up -- "
                    "that is the Found event) and Retired is the only end.\n\n"
                    "A DERIVED CACHE OF Tool Log, WRITTEN BY THE APP -- DO NOT EDIT "
                    "IT BY HAND IN THIS UI. It is set in the same operation as the "
                    "Tool Log row that moved it, so a value typed here records no "
                    "event, names nobody, and is silently contradicted by the next "
                    "scan. Where a status really needs changing, the act is the "
                    "event: In Repair comes from Sent to Repair, Lost from Lost, "
                    "Retired from Retired.\n\n"
                    "NOT AN AIRTABLE FORMULA, and that is a design decision rather "
                    "than a limitation worked around. The event vocabulary is eight "
                    "values against this field's five and Job Changed is a last row "
                    "that leaves the status alone, so deriving one from the other is "
                    "a MAPPING and not a copy -- which is workflow logic, which this "
                    "project keeps out of Airtable formulas. "
                    "lib/toolStatus.js:STATUS_AFTER_EVENT holds it; "
                    "docs/notes/tools.md has the two platform reasons underneath."
                ),
            },
            {
                "name": "Job",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": TBL_JOBS},
                "description": (
                    "Issue #334 -- the job this tool belongs to. REQUIRED, and by "
                    "the app rather than by the schema: Airtable cannot make a link "
                    "field required, the same limit Invoice Items.\"PO Item\" lives "
                    "with (#278).\n\n"
                    "THERE IS NO STATE THIS IS EMPTY IN, which is why nothing reads "
                    "it as optional. A tool on this track never passes through the "
                    "office -- a site person buys it, registers it and keeps it -- "
                    "so the row belongs to a job from the moment it exists. In Stock "
                    "means at rest ON its job, not belonging to nobody, and a tool "
                    "in repair, lost or retired still has the job it last belonged "
                    "to. It is changeable (#341), because a tool outlives the "
                    "project it was bought for, which is why Tool Log carries its "
                    "own copy per event.\n\n"
                    "Single-record, app-enforced (422 on prefersSingleRecordLink)."
                ),
            },
        ],
    }


def tool_log(tool_items_table_id):
    return {
        "name": "Tool Log",
        # Nothing links TO Tool Log, so it gains no reverse field of its own.
        "auto_inverses": [],
        "description": (
            "Issue #334 -- what has happened to one tool item. Append-only: a row "
            "records what was true at a moment and a moment does not change, so "
            "there is no update path and correcting a mistaken scan is another row "
            "(the same shape as PR Edit Log). It exists because a status field "
            "answers where a tool is now and nothing about the project that just "
            "ended, and 'which tools went out on that job' is a question about the "
            "past. Tool Items.Status is a cache of the last row here."
        ),
        "fields": [
            {
                "name": "Tool Log ID",
                "type": "singleLineText",
                "description": (
                    "Issue #334 -- format {Tool Item ID}-{seq}, resetting per tool "
                    "item. The ninth child relation, registered as "
                    '"Tool Items::Tool Log" in lib/idSequence.js:CHILD_KINDS and '
                    "minted by lib/airtable/toolLog.js:createToolLogEntry. The "
                    "sequence is the highest existing plus one, never count plus one "
                    "(#164), and it widens past its pad rather than wrapping.\n\n"
                    "3 DIGITS, WHICH IS THE CHILD WIDTH AND NOT Tool Item ID's. "
                    "Every child table on this base pads to 3 -- PR Items, PR "
                    "Signers, PO Items, Invoice Items, Delivery Items, both PR Edit "
                    "tables -- because a child sequence restarts under each parent, "
                    "so the population is one document's rows. Tool Item ID is the "
                    "other kind of sequence, daily across the whole table, and #335 "
                    "widens THAT one because a single registration can create many "
                    "units at once while no document generator has ever needed more "
                    "than a handful in a day. The two widths answer different "
                    "questions and are set in different places."
                ),
            },
            {
                "name": "Tool Item",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": tool_items_table_id},
                "description": (
                    "Issue #334 -- the tool item this happened to. Single-record, "
                    "app-enforced (422 on prefersSingleRecordLink). Its inverse, "
                    'Tool Items."Tool Log", is what getToolLogByToolItem walks -- '
                    "filterByFormula cannot match a link field against a record id, "
                    "so the history is read from the parent's own array."
                ),
            },
            {
                "name": "Event",
                "type": "singleSelect",
                "options": {"choices": TOOL_EVENT_CHOICES},
                "description": (
                    "Issue #334 -- what happened. Eight values against Status's "
                    "five, which is why Tool Items.Status is a mapping of this "
                    "rather than a copy.\n\n"
                    "TWO NAMING SHAPES. A transition a person designates on a screen "
                    "is named for the state it leaves the tool in, so the event and the "
                    "status are the same string: Lost, Retired. A transition that "
                    "happens by SCANNING carries an action name, because the person "
                    "is performing an act rather than declaring a state: Checked "
                    "Out, Checked In. Lost is not 'Marked Lost' because Retired "
                    "already stands as one string on both axes, so prefixing only "
                    "the other one would be an exception dressed as consistency.\n\n"
                    "Written with NO typecast, so a value outside this list fails "
                    "the write rather than minting a ninth choice off the palette. "
                    "The list cannot be repaired through the API afterwards (422, "
                    "measured), which is what makes failing loudly the only recovery "
                    "there is. lib/toolStatus.js:TOOL_EVENT is the source of truth "
                    "and no call site passes a literal."
                ),
            },
            {
                "name": "Job",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": TBL_JOBS},
                "description": (
                    "Issue #334 -- the job this tool item belongs to immediately "
                    "AFTER this event. Filled on every row and never blank, which is "
                    "the property the whole history rests on.\n\n"
                    'ITS OWN COPY, NOT A LOOKUP THROUGH Tool Items."Job". That field '
                    "moves when a tool is reassigned (#341), so it says nothing "
                    "about where the tool was in March -- and the question a site "
                    "asks when a project closes is exactly that.\n\n"
                    "NO 'Former Job' FIELD, DELIBERATELY. Because there are no "
                    "blanks, the PREVIOUS row's Job is unambiguously the previous "
                    "job: a Job Changed row names where the tool went and the row "
                    "before it names where it came from. Storing the pair would be "
                    "one fact in two places, derivable from an ordering the log "
                    "already has. #340 renders the whole history at once and so "
                    "holds both rows. Single-record, app-enforced."
                ),
            },
            {
                "name": "Recorded By",
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": TBL_USERS},
                "description": (
                    "Issue #334 -- who performed the scan or set the status, read "
                    'from the session. Same word as Deliveries."Recorded By" and '
                    'Direct Purchases."Recorded By" for the same relationship. '
                    "Everyone who scans therefore needs an account, which is why "
                    "the tools pages open to every signed-in user (#337). "
                    "Single-record, app-enforced."
                ),
            },
            {
                "name": "Event At",
                "type": "dateTime",
                "options": DATETIME_OPTIONS,
                "description": (
                    "Issue #334 -- when it happened, UTC instant, *At convention. "
                    "Named for the event rather than for the recording because the "
                    "two are one moment here by construction: a scan records what it "
                    "is doing as it does it. There is no second, human-entered date "
                    'to tell this one apart from, unlike Deliveries."Received Date".'
                ),
            },
            {
                "name": "Notes",
                "type": "multilineText",
                "description": (
                    "Issue #334 -- why, for the events a person types rather than "
                    "scans: what broke on a Sent to Repair, where a Lost tool was "
                    "last seen. Plural Notes and Long text follow the header-record "
                    "convention (Purchase Requests, Deliveries, Direct Purchases, "
                    "PR Edit Requests).\n\n"
                    "OPTIONAL TODAY, AND REQUIRED ON TWO EVENTS ONCE A SCREEN WRITES "
                    "THEM. Lost and Retired are both to demand a reason: Lost is a "
                    "record that asks who was responsible, and Retired cannot be "
                    "undone. Neither screen exists yet -- #334 creates the tables "
                    "and nothing here writes a row -- so the rule is recorded rather "
                    "than enforced, and it is enforced by the app rather than by "
                    "this field, since Airtable cannot make a field conditionally "
                    "required. docs/notes/tools.md carries it as open."
                ),
            },
        ],
    }


# What a human still has to do afterwards, printed at the end of every real
# run so it cannot be forgotten between the script and the browser.
MANUAL_FOLLOW_UP = [
    "Tool Items.Tool",
    "Tool Items.Job",
    "Tool Log.Tool Item",
    "Tool Log.Job",
    "Tool Log.Recorded By",
]

# The five inverses, as (our table, our field, far table, the name the inverse
# must end up with).
#
# NONE OF THESE APPEARS IN THE CREATE PAYLOAD, WHICH IS WHY THEY NEED CHECKING
# RATHER THAN READING BACK. Airtable creates the symmetric field itself and names
# it after the SOURCE TABLE, so `Tool Log."Tool Item"` should produce
# `Tool Items."Tool Log"` — should, on the documented behavior, and this run is
# the first time this base has seen it for a table created in the same script as
# its own parent. The far table is resolved from the LIVE field's
# `linkedTableId` rather than from a constant here, so a link pointing at the
# wrong table is caught as well as a mis-named inverse.
#
# A MISMATCH IS REPAIRED RATHER THAN REPORTED. An auto-created inverse name
# PATCHes cleanly (measured, docs/notes/airtable-access.md — #333 ran eleven of
# them), so there is no reason to leave one wrong and every reason not to: the
# inverse is the name `getLinkedRecords` addresses, and a wrong one is the quiet
# failure that file describes, where `record.get()` returns `undefined` and a
# whole child level disappears at HTTP 200.
EXPECTED_INVERSES = [
    ("Tool Items", "Tool", "Tools", "Tool Items"),
    ("Tool Items", "Job", "Jobs", "Tool Items"),
    ("Tool Log", "Tool Item", "Tool Items", "Tool Log"),
    ("Tool Log", "Job", "Jobs", "Tool Log"),
    ("Tool Log", "Recorded By", "Users", "Tool Log"),
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

    def create_table(self, spec):
        """One call for the table and all its fields.

        ATOMIC, WHICH IS THE WHOLE REASON IT IS ONE CALL. A
        create-then-append sequence can half-succeed, and what it would
        leave behind is a table with missing fields that no API can
        delete. Either this returns a complete table or it returns an
        error and the base is untouched.
        """
        resp = requests.post(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables",
            headers=self.headers,
            json=spec,
        )
        resp.raise_for_status()
        return resp.json()

    def rename_field(self, table_id: str, field_id: str, name: str):
        """Rename one field.

        Used only for an auto-created inverse whose name Airtable did not
        give us. A field's `name` PATCHes cleanly -- measured at 200, and
        #333 ran eleven of them in one script.
        """
        resp = requests.patch(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables/{table_id}/fields/{field_id}",
            headers=self.headers,
            json={"name": name},
        )
        resp.raise_for_status()
        return resp.json()

    def create_field(self, table_id: str, field):
        """One field on an existing table -- the re-run path only."""
        resp = requests.post(
            f"{AIRTABLE_META_ROOT}/bases/{self.base_id}/tables/{table_id}/fields",
            headers=self.headers,
            json=field,
        )
        resp.raise_for_status()
        return resp.json()


def find_table(tables, name: str):
    return next((t for t in tables if t["name"] == name), None)


def find_field(table, name: str):
    return next((f for f in (table or {}).get("fields", []) if f["name"] == name), None)


def describe_spec(spec, existing):
    if existing is None:
        print(f"  CREATE table `{spec['name']}` with {len(spec['fields'])} fields:")
        missing = spec["fields"]
    else:
        missing = [f for f in spec["fields"] if find_field(existing, f["name"]) is None]
        if not missing:
            print(f"  table `{spec['name']}` exists with all {len(spec['fields'])} fields — nothing to do.")
            return missing
        print(f"  table `{spec['name']}` exists; ADD {len(missing)} missing field(s):")
    for i, f in enumerate(missing):
        opts = f.get("options") or {}
        if "linkedTableId" in opts:
            suffix = f" -> {opts['linkedTableId']}"
        elif "choices" in opts:
            suffix = " [" + ", ".join(f"{c['name']} ({c['color']})" for c in opts["choices"]) + "]"
        else:
            suffix = ""
        primary = "  (primary)" if existing is None and i == 0 else ""
        print(f"    - {f['name']:<22} {f['type']}{suffix}{primary}")
        # THE DESCRIPTION IS PRINTED, and it is the half of this payload a person
        # most needs to read before it is written. It was omitted here in the
        # first version, which made the dry run unable to answer the one question
        # a dry run is for -- what is about to go in. A description does PATCH
        # cleanly afterwards (200, measured) so it is not irreversible like the
        # option lists above; that is a reason to review it, not a reason to hide
        # it.
        for para in (f.get("description") or "(NO DESCRIPTION)").split("\n\n"):
            for chunk in _wrap(para.strip(), 66):
                print(f"        {chunk}")
            print()
    return missing


def _wrap(text, width):
    """Greedy wrap, so a description is readable in a terminal."""
    out, current = [], ""
    for word in text.split():
        if current and len(current) + 1 + len(word) > width:
            out.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    if current:
        out.append(current)
    return out or [""]


# ----------------------------------------------------------------------------
# Verification
# ----------------------------------------------------------------------------
def verify(client, specs):
    """Re-read the live schema and compare it against the spec.

    ASKED FOR AND CREATED ARE NOT THE SAME THING. This prints every field
    each table now holds with the type it ended up with, every choice on
    the two selects in order with its color, every inverse the far tables
    gained, and whether each link carries prefersSingleRecordLink -- the
    property the API cannot set, so this is also the list of what still
    needs a human.
    """
    tables = client.fetch_tables()
    by_id = {t["id"]: t for t in tables}
    by_name = {t["name"]: t for t in tables}
    problems = []

    for spec in specs:
        table = by_name.get(spec["name"])
        if table is None:
            print(f"  `{spec['name']}` is not in the base.")
            problems.append(f"table {spec['name']} missing")
            continue

        print(f"  `{spec['name']}` ({table['id']}) — {len(table['fields'])} field(s) live:")
        for i, field in enumerate(table["fields"]):
            options = field.get("options") or {}
            extra = ""
            if field["type"] == "multipleRecordLinks":
                far = by_id.get(options.get("linkedTableId"), {})
                inverse_id = options.get("inverseLinkFieldId")
                inverse = next(
                    (f for f in far.get("fields", []) if f["id"] == inverse_id), None
                )
                extra = (
                    f" -> {far.get('name', '?')}"
                    f" · inverse {far.get('name', '?')}.\"{(inverse or {}).get('name', '—')}\""
                    f" · single={options.get('prefersSingleRecordLink', False)}"
                )
            elif field["type"] == "singleSelect":
                extra = " [" + ", ".join(
                    f"{c['name']}/{c.get('color')}" for c in options.get("choices", [])
                ) + "]"
            primary = "  (primary)" if field["id"] == table["primaryFieldId"] else ""
            known = (find_field({"fields": spec["fields"]}, field["name"])
                     or field["name"] in spec.get("auto_inverses", []))
            print(f"   {' ' if known else '?'}{i + 1:>2}. {field['name']:<22} {field['type']}{extra}{primary}")

        # The spec, both directions.
        for wanted in spec["fields"]:
            live = find_field(table, wanted["name"])
            if live is None:
                problems.append(f"{spec['name']}: missing field {wanted['name']}")
                continue
            if live["type"] != wanted["type"]:
                problems.append(
                    f"{spec['name']}.{wanted['name']} is {live['type']}, spec says {wanted['type']}"
                )
            if not (live.get("description") or "").strip():
                problems.append(f"{spec['name']}.{wanted['name']} carries no description")
            wanted_choices = (wanted.get("options") or {}).get("choices")
            if wanted_choices:
                live_choices = (live.get("options") or {}).get("choices", [])
                # Name AND color AND order: the colors are the half that cannot be
                # fixed later, and a silently dropped option is the failure this
                # whole step exists to catch.
                got = [(c["name"], c.get("color")) for c in live_choices]
                want = [(c["name"], c["color"]) for c in wanted_choices]
                if got != want:
                    problems.append(
                        f"{spec['name']}.{wanted['name']} choices are {got}, spec says {want}"
                    )
        # A REVERSE LINK AIRTABLE CREATED ON OUR OWN TABLE IS EXPECTED, NOT
        # UNEXPECTED, and the first run of this script reported both of them as
        # problems and exited 1 with a perfectly correct base. Creating
        # `Tool Items."Tool"` gives `Tools` a `Tool Items` field, and creating
        # `Tool Log."Tool Item"` gives `Tool Items` a `Tool Log` field — neither is
        # in the create payload because neither is ours to send, and both are
        # load-bearing: `Tool Items."Tool Log"` is the array getToolLogByToolItem
        # walks. So they are named here and their ABSENCE is the problem.
        expected_names = {f["name"] for f in spec["fields"]} | set(spec.get("auto_inverses", []))
        for name in spec.get("auto_inverses", []):
            if find_field(table, name) is None:
                problems.append(f"{spec['name']}: no auto-created reverse link `{name}`")
        for live in table["fields"]:
            if live["name"] not in expected_names:
                problems.append(f"{spec['name']}: unexpected field {live['name']}")
        if table["fields"] and table["fields"][0]["id"] != table["primaryFieldId"]:
            problems.append(f"{spec['name']}: the primary field is not the first one")
        primary_field = next(
            (f for f in table["fields"] if f["id"] == table["primaryFieldId"]), None
        )
        if (primary_field or {}).get("name") != spec["fields"][0]["name"]:
            problems.append(
                f"{spec['name']}: the primary field is {(primary_field or {}).get('name')}"
            )
        print()

    # ALL FIVE INVERSES, BY THEIR ACTUAL LIVE NAME. None of them is in the create
    # payload — Airtable names them itself — so this is the first moment anyone can
    # know what they are called, and the name is what getLinkedRecords addresses.
    print("  symmetric fields on the far tables, as they actually landed:")
    renamed = []
    for our_table, our_field, far_expected, inverse_expected in EXPECTED_INVERSES:
        ours = find_field(by_name.get(our_table), our_field)
        if ours is None:
            problems.append(f"{our_table}.{our_field} does not exist, so it has no inverse")
            continue
        opts = ours.get("options") or {}
        far = by_id.get(opts.get("linkedTableId"), {})
        inverse = next(
            (f for f in far.get("fields", []) if f["id"] == opts.get("inverseLinkFieldId")), None
        )
        far_name = far.get("name", "?")
        actual = (inverse or {}).get("name")
        mark = "·" if actual == inverse_expected and far_name == far_expected else "!"
        print(
            f"    {mark} {our_table}.\"{our_field}\" -> {far_name}"
            f"   inverse: {far_name}.\"{actual or '—'}\""
            f"   (expected {far_expected}.\"{inverse_expected}\")"
        )
        if far_name != far_expected:
            problems.append(f"{our_table}.{our_field} links to {far_name}, not {far_expected}")
            continue
        if inverse is None:
            problems.append(f"{our_table}.{our_field} has no inverse field on {far_name}")
            continue
        if actual != inverse_expected:
            # REPAIRED HERE RATHER THAN REPORTED. A field's name PATCHes cleanly,
            # and leaving a wrong inverse standing is the quiet failure
            # airtable-access.md measured in #333: record.get() returns undefined,
            # the mappers' `|| []` turns it into an empty array, and a whole child
            # level disappears at HTTP 200 with nothing thrown and nothing logged.
            print(f"      renaming {far_name}.\"{actual}\" -> \"{inverse_expected}\"")
            try:
                client.rename_field(far["id"], inverse["id"], inverse_expected)
                renamed.append(f'{far_name}."{actual}" -> "{inverse_expected}"')
            except requests.HTTPError as err:
                body = err.response.text if err.response is not None else ""
                print(f"      PATCH FAILED: {err} {body}")
                problems.append(f"{far_name}.{actual} could not be renamed to {inverse_expected}")

    if renamed:
        print()
        print("  MEASUREMENT WORTH RECORDING — Airtable did not name these as expected:")
        for r in renamed:
            print(f"    {r}")
        print("  Put it in docs/notes/airtable-access.md; the auto-created name is")
        print("  documented as the SOURCE TABLE's name and this run says otherwise.")

    return problems


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Create the Tools / Tool Items / Tool Log tables (#334)"
    )
    parser.add_argument("--base-id", default=AIRTABLE_BASE_ID, help="Airtable Base ID")
    parser.add_argument(
        "--dry-run", action="store_true", help="Print the plan without writing anything"
    )
    args = parser.parse_args()

    client = AirtableSchemaClient(AIRTABLE_API_KEY, args.base_id)

    print("=" * 72)
    print(f"create_tools_334 — base {args.base_id}")
    print("=" * 72)
    print()

    print("Reading the current schema...")
    tables = client.fetch_tables()
    print(f"  {len(tables)} tables")
    print()

    existing_tools = find_table(tables, "Tools")
    existing_items = find_table(tables, "Tool Items")
    existing_log = find_table(tables, "Tool Log")

    # The plan is described against placeholder ids where a table does not exist
    # yet; the real ids are read off each create response below.
    tools_id = existing_tools["id"] if existing_tools else "<Tools, created by this run>"
    items_id = existing_items["id"] if existing_items else "<Tool Items, created by this run>"

    print("1/2  the three tables, in dependency order")
    describe_spec(TOOLS, existing_tools)
    print()
    describe_spec(tool_items(tools_id), existing_items)
    print()
    describe_spec(tool_log(items_id), existing_log)
    print()

    if args.dry_run:
        print("=" * 72)
        print("DRY RUN — nothing was written.")
        print()
        print("After a real run these five link fields still need a human, because")
        print("the Metadata API refuses prefersSingleRecordLink (422 on CREATE and")
        print('on UPDATE) — turn OFF "Allow linking to multiple records" on:')
        for name in MANUAL_FOLLOW_UP:
            print(f"  - {name}")
        return 2

    failed = False
    specs = []
    try:
        if existing_tools is None:
            created = client.create_table(TOOLS)
            tools_id = created["id"]
            print(f"     created `Tools` {tools_id} with {len(created['fields'])} fields")
        else:
            tools_id = existing_tools["id"]
            for f in describe_spec(TOOLS, existing_tools):
                client.create_field(tools_id, f)
                print(f"     added Tools.{f['name']}")
        specs.append(TOOLS)

        items_spec = tool_items(tools_id)
        if existing_items is None:
            created = client.create_table(items_spec)
            items_id = created["id"]
            print(f"     created `Tool Items` {items_id} with {len(created['fields'])} fields")
        else:
            items_id = existing_items["id"]
            for f in describe_spec(items_spec, existing_items):
                client.create_field(items_id, f)
                print(f"     added Tool Items.{f['name']}")
        specs.append(items_spec)

        log_spec = tool_log(items_id)
        if existing_log is None:
            created = client.create_table(log_spec)
            print(f"     created `Tool Log` {created['id']} with {len(created['fields'])} fields")
        else:
            for f in describe_spec(log_spec, existing_log):
                client.create_field(existing_log["id"], f)
                print(f"     added Tool Log.{f['name']}")
        specs.append(log_spec)
    except requests.HTTPError as err:
        body = err.response.text if err.response is not None else ""
        print(f"     FAILED: {err}\n     {body}")
        failed = True
        # Verify whatever landed rather than returning blind: a half-applied
        # schema is exactly the state somebody needs a report about.
        if not specs:
            specs = [TOOLS]

    print()
    print("2/2  verifying against the live schema")
    problems = verify(client, specs)
    print()

    print("=" * 72)
    if failed or problems:
        for problem in problems:
            print(f"  PROBLEM: {problem}")
        return 1

    print("The base matches the spec: 3 tables, 12 fields, 5 symmetric fields.")
    print()
    print("STILL TO DO BY HAND — the Metadata API refuses prefersSingleRecordLink")
    print('(422 on CREATE and on UPDATE), so turn OFF "Allow linking to multiple')
    print('records" on these five link fields in the Airtable UI:')
    for name in MANUAL_FOLLOW_UP:
        print(f"  - {name}")
    print()
    print("The app enforces single-record on all five either way; this makes the")
    print('base agree, as Deliveries."Job" and Invoices."Vendor" already do.')
    print('Leave Tools."Tool Items" and Tool Items."Tool Log" multi — they are.')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Which Airtable base a Python import script reaches (#534), asked of lib/airtableBase.js.

The rule lives in one place, `lib/airtableBase.js:resolveAirtableBase`: the test
base (AIRTABLE_TEST_API_KEY + AIRTABLE_TEST_BASE_ID) unless the run names the live
one with AIRTABLE_BASE=live, whose id is a constant in that module and in no other
file. Python cannot import JavaScript, and a second copy of the rule here would be
two answers to one question that could disagree, so this asks `node` for the
answer instead: the four scripts in this directory call `resolve_airtable_base()`
after `load_dotenv`, and `node` inherits the environment they loaded.

`node` hands back the base id and the NAME of the variable holding its key, never
the key itself, so no secret crosses the pipe; the key is read here, by that name.
A refusal — a missing key or id, a test base id that is the live base's, an
AIRTABLE_BASE other than `live` — is raised as a RuntimeError carrying the module's
own sentence.
"""

import json
import os
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

_ASK = (
    "import { resolveAirtableBase, describeAirtableBase } from './lib/airtableBase.js';"
    "try {"
    "  const base = resolveAirtableBase(process.env);"
    "  console.log(JSON.stringify({ baseId: base.baseId, apiKeyVariable: base.apiKeyVariable,"
    "    live: base.live, description: describeAirtableBase(base) }));"
    "} catch (error) { console.log(JSON.stringify({ error: error.message })); }"
)


def resolve_airtable_base():
    """Return (base_id, api_key, description) for the base this run reaches."""
    result = subprocess.run(
        ["node", "--no-warnings", "--input-type=module", "-e", _ASK],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    if result.returncode != 0:
        raise RuntimeError(f"could not ask lib/airtableBase.js which base to reach: {result.stderr.strip()}")
    answer = json.loads(result.stdout)
    if "error" in answer:
        raise RuntimeError(answer["error"])
    return answer["baseId"], os.environ[answer["apiKeyVariable"]], answer["description"]

import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllTools } from "@/lib/airtable/tools";
import { getToolItemsByRecordIds } from "@/lib/airtable/toolItems";
import { TOOL_LIST_COPY as COPY, summarizeTools, toolPagePath } from "@/lib/toolListView";
import { TOOL_REGISTRATION_COPY } from "@/lib/toolRegistration";
import { withOpsLabel } from "@/lib/airtableOps";

// The constant rather than a second spelling of the word: the tab and the
// heading are both the table's name and must not drift apart.
export const metadata = { title: COPY.heading };

/**
 * Every tool the company owns, with a count per status (#339).
 *
 * WHAT IT ANSWERS IS A QUESTION ABOUT THE FLEET rather than about any one tool:
 * how many of each kind of tool there are, and how many of them are out. That is
 * why the row carries three counts and no total — see `summarizeTools` for why a
 * single figure cannot be written without deciding whether a retired tool is
 * still owned.
 *
 * THREE OPERATIONS, AND THE THIRD IS THE ONE THAT GROWS. The session find,
 * `getAllTools` — the whole table in one query, bounded by what the company has
 * bought — and then every tool item those tools name, read in one batch of 50 at
 * a time. `getAllTools` already returns each tool's `Tool Items` link array, so
 * finding the units costs no query per tool (#193), and `getToolItemsByRecordIds`
 * was written for exactly this call.
 *
 * NO PER-STATUS ROLLUP ON `Tools`, WHICH IS A DECISION WITH A MEASURED TRIGGER.
 * The walk is `ceil(total tool items / 50)`, so this page passes ten operations
 * at 401 tool items; at that point the count moves into a rollup and
 * `Purchase Orders."Uninvoiced Items"` (#244) is the worked example of the move.
 * Five rollups nothing reads today would be five fields to keep in step for
 * nothing. docs/notes/tools.md carries the arithmetic.
 *
 * ONE EMPTY STATE, NOT THREE. The shared brief's three empties tell "nothing
 * exists yet" from "nothing you can see" and "nothing matching your filters";
 * nothing on this axis is scoped by role or job (#337) and this list has no
 * filters, so only the first has a producer here.
 *
 * NO WIDTH, NO COLOR, NO SPACING, AND NO TEXT IN THE MARKUP — #336 put this
 * axis's only container in the layout and left it empty, and every string here
 * comes from a constant so a vocabulary sweep can reach it.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so repeated loads aggregate into one row.
export default async function ToolsPage() {
    return withOpsLabel("/tools", () => renderToolsPage());
}

// Every signed-in user, with no Role and no Job scoping (#337): a scan needs an
// account only because it records who performed it, and a tool item moves between
// jobs, so the person scanning one is not always assigned to the job it is on.
async function renderToolsPage() {
    await requireUser();

    const tools = await getAllTools();
    // The link arrays the tools already carry, flattened into one batched read.
    const toolItems = await getToolItemsByRecordIds(tools.flatMap((tool) => tool.toolItems));
    const rows = summarizeTools(tools, toolItems);

    return (
        <div>
            <h1>{COPY.heading}</h1>

            {/* The control that opens the registration form, carrying that
                form's own heading so the two cannot drift (#338). It is above
                the list rather than inside it because a reader with no tools yet
                needs it most. */}
            <Link href="/tools/new">{TOOL_REGISTRATION_COPY.heading}</Link>

            {rows.length === 0 ? (
                <p>{COPY.noTools}</p>
            ) : (
                <ul>
                    {rows.map((row) => (
                        <li key={row.id}>
                            <Link href={toolPagePath(row.id, 1)}>{row.toolName}</Link>
                            {/* All three statuses on every row, a zero included:
                                an absent one would read as "not known" where a
                                `0` reads as "none". The word is the label, so the
                                count is never carried by color alone. */}
                            <dl>
                                {row.counts.map((entry) => (
                                    <div key={entry.status}>
                                        <dt>{entry.status}</dt>
                                        <dd>{entry.count}</dd>
                                    </div>
                                ))}
                            </dl>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

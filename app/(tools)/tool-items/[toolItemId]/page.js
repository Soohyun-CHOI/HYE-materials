import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemByToolItemId } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { getToolLogByToolItem } from "@/lib/airtable/toolLog";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { TOOL_ITEM_COPY as COPY, logRowFacts } from "@/lib/toolItemView";
import { TOOLS_PATH, toolItemPath } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

// The param and no lookup, which is what all four document detail screens do and
// is the reason this page's cost is what the docstring says. The consequence is
// that a tab for an id nothing carries is titled with that id — the same on
// `/pos/[poId]` for an unknown order — and closing that would mean reading the
// tool item twice per render for a string in a tab.
export async function generateMetadata({ params }) {
    const { toolItemId } = await params;
    return { title: decodeURIComponent(toolItemId) };
}

/**
 * One tool item and everything that has happened to it (#340).
 *
 * A SCAN ARRIVES HERE AND THE LABEL DOES NOT CARRY THIS ADDRESS (#348). It used
 * to: the page stood at `/tools/[toolItemId]` because a QR encodes the whole URL
 * and every character pushes the symbol toward a finer grid, so the shortest slot
 * on the axis was spent on it. `/t/[toolItemId]` carries that budget now and
 * redirects here, which frees this page to take the name its collection gives it
 * and frees the flat slot under `/tools` for one tool. Nothing had been printed,
 * so the move cost code and no reprinting; from Phase 2 onward it would cost both.
 * The reader is unchanged — a phone camera reading a sticker glued to a drill,
 * which is what makes this different in kind from every other detail screen here.
 *
 * IT REDIRECTS A NON-CANONICAL ID, and the reason is the second way in: the label
 * prints the id in readable characters beside the QR code, for a symbol that has
 * been scratched or painted over, so somebody types it by hand. The lookup is
 * case-insensitive for that, and this redirect is what stops the concession from
 * turning one printed address into several. `permanentRedirect` rather than
 * `redirect`, because the mapping is stable forever: a `Tool Item ID` is minted
 * once and printed, the app offers no deletion, and `Retired` is what takes a tool
 * out of the count while keeping its row — so nothing reassigns the string a
 * cached redirect names. **`/t/` uses the plain `redirect` and the difference is
 * not an oversight**: this one maps a variant of an address onto that address, and
 * that one maps a printed entry point onto a screen whose address the app may
 * move.
 *
 * A REDIRECT FROM `/t/` NEVER LANDS ON THIS ONE. That route canonicalizes the
 * case before it hands the id over, so a scan and a typed label both reach this
 * page already spelled the way the base spells it, and the printed path costs one
 * hop rather than two. This redirect answers direct traffic.
 *
 * FIVE OPERATIONS PLUS ONE PER 50 LOG ROWS, and the shape matters because this
 * will be the most frequently rendered screen on the axis once a scan opens it.
 * The session find, the tool item lookup, its tool, its people and the job list
 * are each one; only the log walk grows, and it grows in steps of 50 through
 * `findChildRecords` rather than per row. The tool item record already carries
 * its `Tool Log` link array, so the walk skips the parent find (#193). People and
 * jobs are read once for the whole history rather than per row, so a long history
 * adds no cost on either.
 *
 * `Status` AND `Job` ARE READ FROM THE TOOL ITEM. They are caches of the last log
 * row, and this page has that row in hand — but it shows the cached values,
 * because they are what every other tools surface shows and because they are
 * present even when the history is not. See `lib/toolItemView.js` for why nothing
 * here compares the two.
 *
 * NO WIDTH, NO COLOR, NO SPACING, AND NO TEXT IN THE MARKUP — #336 put this
 * axis's only container in the layout and left it empty, and #338 moved every
 * string into a constant. The history is an ordered list of definition lists
 * rather than a table on purpose: five columns overflow a 375px viewport, and the
 * class that would scroll them is a value this axis does not carry.
 */
export default async function ToolItemPage(props) {
    return withOpsLabel("/tool-items/[toolItemId]", () => renderToolItemPage(props));
}

async function renderToolItemPage({ params }) {
    await requireUser();
    const { toolItemId } = await params;
    const asked = decodeURIComponent(toolItemId);

    const toolItem = await getToolItemByToolItemId(asked);
    if (!toolItem) {
        return (
            <div>
                <h1>{COPY.notFoundHeading}</h1>
                <Link href={TOOLS_PATH}>{COPY.backToTools}</Link>
            </div>
        );
    }

    // The canonical form answers directly and every other casing arrives here.
    // After requireUser, so a reader with no session learns nothing about which
    // strings resolve.
    if (toolItem.toolItemId !== asked) {
        permanentRedirect(toolItemPath(toolItem.toolItemId));
    }

    // The link array is already on the record, so the log costs ceil(N/50) and
    // not 1 + ceil(N/50). Oldest first, which is the order findChildRecords
    // returns the link array in — creation order, and for an append-only table
    // that is chronological. `/prs/[prId]`'s history is ascending too, and the
    // first row here is always the registration, so the history begins where the
    // tool item does.
    const [tools, log, jobs] = await Promise.all([
        getToolsByRecordIds(toolItem.tool),
        getToolLogByToolItem(toolItem.id, { rowIds: toolItem.toolLog }),
        getAllJobs(),
    ]);

    const recordedByIds = [...new Set(log.map((row) => row.recordedBy?.[0]).filter(Boolean))];
    const people = await getUsersByRecordIds(recordedByIds);

    const nameById = Object.fromEntries(people.map((person) => [person.id, person.userName]));
    const jobCodeById = Object.fromEntries(jobs.map((job) => [job.id, job.jobCode]));

    const headerFacts = [
        { key: "tool", label: COPY.toolLabel, value: tools[0]?.toolName },
        { key: "status", label: COPY.statusLabel, value: toolItem.status },
        { key: "job", label: COPY.jobLabel, value: jobCodeById[toolItem.job?.[0]] },
    ];

    return (
        <div>
            <h1>{toolItem.toolItemId}</h1>

            <dl>
                {headerFacts.map((fact) => (
                    <div key={fact.key}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                    </div>
                ))}
            </dl>

            <h2>{COPY.historyHeading}</h2>
            {log.length === 0 ? (
                <p>{COPY.noHistory}</p>
            ) : (
                <ol>
                    {log.map((row) => (
                        <li key={row.id}>
                            <dl>
                                {logRowFacts({
                                    event: row.event,
                                    eventAt: row.eventAt,
                                    recordedByName: nameById[row.recordedBy?.[0]],
                                    jobCode: jobCodeById[row.job?.[0]],
                                    notes: row.notes,
                                }).map((fact) => (
                                    <div key={fact.key}>
                                        <dt>{fact.label}</dt>
                                        <dd>{fact.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

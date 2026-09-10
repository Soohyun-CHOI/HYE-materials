import { headers } from "next/headers";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemByToolItemId } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { getToolLogByToolItem } from "@/lib/airtable/toolLog";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { TOOL_ITEM_COPY as COPY, logRowFacts } from "@/lib/toolItemView";
import { QR_SIDE_MODULES, buildToolItemQR } from "@/lib/toolLabelQR";
import { TOOL_LABEL_SHEET_COPY as SHEET_COPY, labelBudget, symbolBox } from "@/lib/toolLabelSheet";
import { TOOLS_PATH, toolItemLabelsPath, toolItemPath } from "@/lib/toolRoutes";
import { planTransition } from "@/lib/toolTransition";
import { withOpsLabel } from "@/lib/airtableOps";
import ToolTransitionForm from "./ToolTransitionForm";

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
 * IT OFFERS THE ONE TRANSITION THAT STATUS ALLOWS (#362), AND FOR NO OPERATIONS
 * AT ALL. The session and the whole job list are already read for the history's
 * names, so `planTransition` decides the offer from facts in hand and the figure
 * above is unchanged — measured. This is where a scan lands, so the read a
 * transition adds is the read that would matter most on this axis; there is none.
 *
 * THE PAGE OFFERS AND THE ACTION DECIDES, WHICH IS NOT A DUPLICATION. Both call
 * `planTransition`, and the action calls it again on a fresh read because a
 * Server Action is reachable without this page and because the status may have
 * moved since this render. One rule, two callers, no second implementation.
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
    const user = await requireUser();
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

    // The transition costs NOTHING here (#362): the session and the whole job
    // list are both already read above, so the offer is decided from facts in
    // hand and this page's five operations plus one per 50 log rows are
    // unchanged. `planTransition` returns either an event to offer or the
    // sentence saying why not — one function for both, so the page cannot render
    // a control without having asked the question that refuses it. The action
    // asks the same function again, because a Server Action is reachable without
    // this page.
    const transition = planTransition({ user, jobs, status: toolItem.status });

    // The host the symbol encodes, from the public host behind Vercel's proxy —
    // the same source both label screens read, so a symbol shown here and a symbol
    // printed there encode the same string. No Airtable operation.
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    const symbol = await buildToolItemQR({
        origin: `${proto}://${headerList.get("host") ?? ""}`,
        toolItemId: toolItem.toolItemId,
    });
    // Derived against today's version plus the stock's headroom, then applied to
    // the side count this symbol actually came out at.
    const { moduleMm } = labelBudget({ sideModules: QR_SIDE_MODULES });
    const { boxMm: symbolMm } = symbolBox({ sideModules: symbol.sideModules, moduleMm });

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

            {/* THE ONE TRANSITION THE STATUS ALLOWS (#362), directly under the
                status it moves and with no heading over it: the two headings on
                this page name things, and a heading here would have to name the
                act generically — `transition` is these notes' explanatory word,
                the way `kind` is, and #338 records how close that one came to
                becoming a column head. The control names itself.

                A REFUSAL STANDS WHERE THE CONTROL WOULD BE, never beside it.
                Retired offers nothing to anybody and somebody on no job can
                record nothing, and in both cases a control would be a promise
                the action refuses. `/tools/new` renders its refusal as the
                screen for the same reason. */}
            {transition.refusal ? (
                <p>{transition.refusal}</p>
            ) : (
                <ToolTransitionForm
                    toolItemId={toolItem.toolItemId}
                    event={transition.event}
                    jobs={transition.jobs}
                    currentJobCode={jobCodeById[toolItem.job?.[0]]}
                />
            )}

            {/* THE SYMBOL, BUILT HERE RATHER THAN FETCHED (#352). #351's endpoint
                served one as an image and expected this page to be its caller;
                inlining costs no Airtable operation at all, because the two the
                endpoint spent were the session and THIS RECORD — both already read
                above — and the second existed to refuse an id with no row, which
                the not-found return has already done. That left the endpoint with
                no caller, so #352 deleted it.

                IT IS DRAWN AT ITS PRINTED SIZE, from the same two functions the
                sheet uses: the module size derived once for the stock, and the box
                from THIS symbol's own side count. Passing `QR_SIDE_MODULES` to the
                box instead would scale a larger version into today's box and thin
                its modules, which is the defect #353 measured in a browser. */}
            <h2>{COPY.labelHeading}</h2>
            <div
                style={{ width: `${symbolMm}mm`, height: `${symbolMm}mm` }}
                dangerouslySetInnerHTML={{ __html: symbol.svg }}
            />
            <p>{COPY.printedSizeNote}</p>
            <p>
                <Link href={toolItemLabelsPath([toolItem.toolItemId])}>
                    {SHEET_COPY.openFromToolItem}
                </Link>
            </p>

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

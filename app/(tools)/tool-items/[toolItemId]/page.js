import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemByToolItemId } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { getRecentCheckOuts, getToolLogByToolItem } from "@/lib/airtable/toolLog";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { DAY_FORMAT } from "@/lib/format";
import { TOOL_ITEM_COPY as COPY, currentHolder, logRowFacts, newestFirst, retiredAt } from "@/lib/toolItemView";
import Breadcrumb from "@/app/components/Breadcrumb";
import { ButtonLink } from "@/app/components/Controls";
import Instant from "@/app/components/Instant";
import Space from "@/app/components/Space";
import TopBar from "@/app/components/TopBar";
import { QR_SIDE_MODULES, buildToolItemLabel } from "@/lib/toolLabelQR";
import { TOOL_LABEL_PAGE_COPY as LABEL_COPY, labelBudget, symbolBox } from "@/lib/toolLabelPage";
import { TOOL_LIST_COPY } from "@/lib/toolListView";
import { TOOLS_PATH, labelCodeFor, toolItemPath, toolPath } from "@/lib/toolRoutes";
import { TOOL_EVENT } from "@/lib/toolStatus";
import { TOOL_TRANSITION_COPY as TRANSITION_COPY, planTransition } from "@/lib/toolTransition";
import { withOpsLabel } from "@/lib/airtableOps";
import { actorName } from "@/lib/userName";
import LabelsDialog, { LabelPreview } from "../LabelsDialog";
import StatusMark from "../../StatusMark";
import MoreActions from "./MoreActions";
import ToolItemTransition from "./ToolItemTransition";
import TransitionBar from "./TransitionBar";
import TransitionDialog from "./TransitionDialog";
import TransitionRefusal from "./TransitionRefusal";

// The param and no lookup, which is what all four document detail screens do and
// is the reason this page's cost is what the docstring says. The consequence is
// that a tab for an id nothing carries is titled with that id — the same on
// `/pos/[poId]` for an unknown order — and closing that would mean reading the
// tool item twice per render for a string in a tab. The heading is the tool's name
// since #463, and the tab keeps the id: the design draws no tab, and the id is what
// tells two tabs of one tool apart.
export async function generateMetadata({ params }) {
    const { toolItemId } = await params;
    return { title: decodeURIComponent(toolItemId) };
}

/**
 * One tool item and everything that has happened to it (#340), in the look the design
 * settled (#463): 0n's record page at a desk (1c, 1d) and 1f's app screen on a phone.
 *
 * A SCAN ARRIVES HERE AND THE LABEL DOES NOT CARRY THIS ADDRESS (#348). It used
 * to: the page stood at `/tools/[toolItemId]` because a QR encodes the whole URL
 * and every character pushes the symbol toward a finer grid, so the shortest slot
 * on the axis was spent on it. `/t/[labelCode]` carries that budget now and
 * redirects here, which frees this page to take the name its collection gives it
 * and frees the flat slot under `/tools` for one tool. Nothing had been printed,
 * so the move cost code and no reprinting; from Phase 2 onward it would cost both.
 * The reader is unchanged — a phone camera reading a sticker glued to a drill,
 * which is what makes this different in kind from every other detail screen here.
 *
 * IT REDIRECTS A NON-CANONICAL ID, and the reason is the second way in: the label
 * prints the tool item's code in readable characters under the QR code, for a
 * symbol that has been scratched or painted over, so somebody types it by hand. The lookup is
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
 * adds no cost on either. #463 added no read: who holds a tool that is out and when
 * a retired one was retired are both on the history's latest row, already in hand.
 *
 * `Status` AND `Job` ARE READ FROM THE TOOL ITEM. They are caches of the last log
 * row, and this page has that row in hand — but it shows the cached values,
 * because they are what every other tools surface shows and because they are
 * present even when the history is not. See `lib/toolItemView.js` for why nothing
 * here compares the two.
 *
 * AND ONE MORE WHEN THE OFFER IS A CHECK-OUT (#376), which is the first read this
 * page has added since #340 and is why the figure above is now two figures. The
 * names a check-out offers are other tool items' history on the reader's own jobs,
 * so nothing already in hand can answer it; `getRecentCheckOuts` is one operation
 * and stays one whatever a job's history grows to. Every other path — a check-in,
 * a retired tool item, a reader with no job — asks nothing and pays nothing.
 *
 * IT OFFERS WHAT THAT STATUS ALLOWS (#362, #363), AND FOR NO OPERATIONS AT ALL.
 * The session and the whole job list are already read for the history's names,
 * so `planTransition` decides both offers from facts in hand and the figure
 * above is unchanged — measured, before #362 and again after #363. This is where
 * a scan lands, so a read added here is the read that would matter most on this
 * axis; there is none.
 *
 * THE PAGE OFFERS AND THE ACTION DECIDES, WHICH IS NOT A DUPLICATION. Both call
 * `planTransition`, and the action calls it again on a fresh read because a
 * Server Action is reachable without this page and because the status may have
 * moved since this render. One rule, two callers, no second implementation.
 *
 * TWO DRAWINGS OF ONE PAGE (#463). A desk draws 0n's record page under the breadcrumb:
 * a header holding the tool's name, its id and job, its status and the actions, the history
 * beside the record rail and its label (1c, 1d). A phone draws 1f: the top bar with the id
 * and `More actions`, the title block, the history, and the transition in a foot bar. What is
 * one fact is one element — the heading, the status, an entry — set at each width's size;
 * what only one width draws is drawn there alone. Every word is a constant and every value a
 * name `app/designValues.css` declares, and the column the page sits in is the layout's
 * (`app/(tools)/layout.js`), which a tools page does not declare a width against: the 1080
 * here is the content's measure inside it, 0b's, not the column's.
 */
export default async function ToolItemPage(props) {
    return withOpsLabel("/tool-items/[toolItemId]", () => renderToolItemPage(props));
}

/**
 * A code no tool item carries (#463): the desk's 1l, centered in the column with the code it
 * asked for and the way back to the list, and the phone's 1g-c, the top bar naming the code
 * in Ink 3 over the mark and two lines — no way back, since a phone arrived here from a scan.
 */
function ToolItemNotFound({ asked }) {
    return (
        <div className="flex min-h-full flex-1 flex-col font-ui text-foreground-default max-sm:min-h-0">
            <TopBar id={asked} muted />
            <div className="flex flex-1 flex-col items-center justify-center px-page-gutter text-center max-sm:px-mobile-empty-inset-x max-sm:pb-mobile-empty-inset-bottom">
                <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="mb-gap size-mobile-empty-icon text-foreground-subtle sm:hidden">
                    <circle cx="17.5" cy="17.5" r="11" stroke="currentColor" strokeWidth="2" />
                    <path d="M25.5 25.5 34 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M13.5 13.5l8 8M21.5 13.5l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <h1 className="text-heading font-semibold max-sm:mt-gap max-sm:text-mobile-heading-lg">{COPY.notFoundHeading}</h1>
                <p className="mt-gap max-w-empty-state text-body-sm text-pretty text-foreground-muted max-sm:hidden">
                    {COPY.notFoundCode.before}
                    <span className="font-id tracking-id text-foreground-default">{asked}</span>
                    {COPY.notFoundCode.after}
                </p>
                <p className="mt-gap max-w-mobile-empty-state text-mobile-body text-pretty text-foreground-subtle sm:hidden">{COPY.notFoundScanned}</p>
                <div className="mt-gap-lg max-sm:hidden">
                    <ButtonLink variant="bordered" href={TOOLS_PATH}>
                        {COPY.backToTools}
                    </ButtonLink>
                </div>
            </div>
        </div>
    );
}

async function renderToolItemPage({ params }) {
    const user = await requireUser();
    const { toolItemId } = await params;
    const asked = decodeURIComponent(toolItemId);

    const toolItem = await getToolItemByToolItemId(asked);
    if (!toolItem) return <ToolItemNotFound asked={asked} />;

    // The canonical form answers directly and every other casing arrives here.
    // After requireUser, so a reader with no session learns nothing about which
    // strings resolve.
    if (toolItem.toolItemId !== asked) {
        permanentRedirect(toolItemPath(toolItem.toolItemId));
    }

    // The link array is already on the record, so the log costs ceil(N/50) and not
    // 1 + ceil(N/50). It arrives oldest first — creation order, which for an
    // append-only table is chronological — and is drawn newest first (#463).
    const [tools, log, jobs] = await Promise.all([
        getToolsByRecordIds(toolItem.tool),
        getToolLogByToolItem(toolItem.id, { rowIds: toolItem.toolLog }),
        getAllJobs(),
    ]);

    const recordedByIds = [...new Set(log.map((row) => row.recordedBy?.[0]).filter(Boolean))];
    const people = await getUsersByRecordIds(recordedByIds);

    // Who recorded an entry is named for what they did, in full (#463, `actorName`).
    const nameById = Object.fromEntries(people.map((person) => [person.id, actorName(person)]));
    const jobCodeById = Object.fromEntries(jobs.map((job) => [job.id, job.jobCode]));
    const jobCode = jobCodeById[toolItem.job?.[0]];
    const history = newestFirst(log);
    const holder = currentHolder(history, toolItem.status);
    const retired = retiredAt(history, toolItem.status);

    // The transition costs NOTHING here (#362): the session and the whole job
    // list are both already read above, so the offer is decided from facts in
    // hand and this page's five operations plus one per 50 log rows are
    // unchanged. `planTransition` returns either an event to offer or the
    // sentence saying why not — one function for both, so the page cannot render
    // a control without having asked the question that refuses it. The action
    // asks the same function again, because a Server Action is reachable without
    // this page.
    const transition = planTransition({ user, jobs, status: toolItem.status });

    // #376 — THE ONE READ THIS PAGE ADDED, AND ONLY WHERE IT IS USED. A check-out
    // asks who the tool is going to and offers the names the reader's own jobs have
    // recently handed tools to; a check-in returns one to stock and asks nobody, a
    // retired tool item offers neither control, and a reader with no job is refused
    // before either. So the query runs only when the offered event is the one that
    // carries a name, which leaves this page at its recorded figure on every other
    // path. One operation when it does run — see `getRecentCheckOuts` for why it is
    // one and stays one.
    const recentRows =
        transition.event === TOOL_EVENT.CHECKED_OUT
            ? await getRecentCheckOuts({ jobCodes: transition.jobs.map((job) => job.jobCode) })
            : [];
    // The reader hands back link arrays; the pure rule takes a job CODE, because
    // the choice narrows by the code its job carries. Mapped from the job list
    // already in hand, so this costs nothing.
    const recentCheckOuts = recentRows.map((row) => ({
        ...row,
        jobCode: jobCodeById[row.job?.[0]],
    }));

    // The host the symbol encodes, from the public host behind Vercel's proxy —
    // the same source the labels' read takes its own from, so a label drawn here and
    // a label printed from a tool's page encode the same string. No Airtable
    // operation. It is this tool item's LABEL that is built (#457) — its symbol and the
    // code it prints — because the labels' dialog this page opens draws its page from
    // the same object the rail's drawing is drawn from, so the two are built once.
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    const label = await buildToolItemLabel({
        origin: `${proto}://${headerList.get("host") ?? ""}`,
        toolItemId: toolItem.toolItemId,
    });
    // Sized for today's version plus the label's headroom, then applied to the side
    // count this symbol actually came out at. Whether it FITS is asked here too
    // (#453): the label absorbs no version step, so a longer host builds a symbol the
    // labels' dialog draws no page for, and the rail has to say that rather than draw
    // a label and its size.
    const budget = labelBudget({ sideModules: QR_SIDE_MODULES });
    const { boxMm: symbolMm, fits: symbolFits } = symbolBox({ sideModules: label.sideModules, budget });

    const tool = tools[0];
    const name = tool?.toolName || toolItem.toolItemId;

    return (
        <ToolItemTransition plan={transition} toolItemId={toolItem.toolItemId} toolName={tool?.toolName}>
            <div className="font-ui text-foreground-default max-sm:flex max-sm:flex-1 max-sm:flex-col">
                {/* THE PHONE'S HEAD (1f): the printed id, and `More actions` when there is
                    something to retire. */}
                <TopBar id={toolItem.toolItemId}>{transition.mayRetire && <MoreActions phone />}</TopBar>
                {/* WHERE THIS TOOL ITEM SITS UNDER ITS TOOL (#460): the list, the tool, and the
                    code its label prints, which is how the design ends the path (1c). The
                    tool is the row read above, so the path costs nothing. A phone draws the
                    top bar in its place. */}
                <Breadcrumb
                    levels={[
                        { label: TOOL_LIST_COPY.heading, href: TOOLS_PATH },
                        ...(tool ? [{ label: tool.toolName, href: toolPath(tool.id) }] : []),
                    ]}
                    current={labelCodeFor(toolItem.toolItemId)}
                    phone={false}
                />
                {/* At a desk 0b's 1080, centered in the column; below the phone's edge the
                    page is a flex column and this its full width, margins and all, since an
                    automatic margin would shrink it to what it holds. */}
                <div className="mx-auto box-content max-w-content px-page-gutter pt-breadcrumb-stack pb-scroll-inset-bottom max-sm:mx-0 max-sm:max-w-none max-sm:px-0 max-sm:pt-0 max-sm:pb-0">
                    {/* 0n's RECORD HEADER: the name, the id and job under it, the status, and
                        on the right what may be recorded, centered on the title's line —
                        24 above and below its Band. On a phone, 1f's title block. */}
                    <header className="flex items-start justify-between gap-record-header-inline border-b border-divider-strong pb-page-header-stack max-sm:border-b-0 max-sm:px-mobile-gutter max-sm:pt-mobile-top-bar-stack max-sm:pb-mobile-title-stack">
                        <div className="flex min-w-0 flex-col gap-subtitle-stack">
                            <div className="flex flex-col gap-title-stack">
                                <h1 className="text-heading-lg max-sm:text-mobile-heading-lg">{name}</h1>
                                <p className="text-body text-foreground-subtle max-sm:hidden">
                                    <span className="font-id tracking-id text-foreground-default">{toolItem.toolItemId}</span>
                                    {jobCode && (
                                        <>
                                            <Dot />
                                            <span className="text-foreground-default">{jobCode}</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            {/* THE STATUS, AND THE VALUE ONLY ONE STATE HAS 14 AFTER IT (0n):
                                who holds a tool that is out, and at a desk when a retired one
                                was retired. */}
                            <div className="flex items-baseline gap-gap-lg">
                                <span className="inline-flex items-baseline gap-gap text-body max-sm:text-mobile-body">
                                    <StatusMark status={toolItem.status} />
                                    {toolItem.status}
                                </span>
                                {holder && <span className="text-body-sm text-foreground-subtle max-sm:text-mobile-body-sm">{holder}</span>}
                                {retired && (
                                    <span className="text-body-sm text-foreground-subtle max-sm:hidden">
                                        <Instant at={retired} format={DAY_FORMAT} />
                                    </span>
                                )}
                            </div>
                            <TransitionRefusal />
                        </div>
                        {/* WHAT MAY BE RECORDED, AT A DESK (#362, #363, #463): the transition and
                            `More actions`, which holds the retirement. A REFUSAL STANDS WHERE
                            BOTH CONTROLS WOULD BE, never beside them — a reader on no job reads
                            why — except a status that allows nothing, where 1c draws nothing at
                            all; a phone's foot bar says that one. The two controls must not read
                            as the same weight: one is pressed dozens of times a day and is the
                            filled button, the other is that tool item's last act and is a menu
                            item behind an icon. Each is asked for separately, because the two
                            answers come from two maps and agree only on today's three
                            statuses. */}
                        {transition.refusal ? (
                            transition.refusal !== TRANSITION_COPY.noTransition && (
                                <p className="max-w-empty-state text-body-sm text-pretty text-foreground-subtle max-sm:hidden">{transition.refusal}</p>
                            )
                        ) : (
                            <div className="-mt-[calc((var(--height-control-lg)-var(--text-heading-lg--line-height))/2)] flex shrink-0 items-center gap-gap max-sm:hidden">
                                {transition.event && <TransitionDialog currentJobCode={jobCode} recentCheckOuts={recentCheckOuts} />}
                                {transition.mayRetire && <MoreActions />}
                            </div>
                        )}
                    </header>
                    <div className="grid grid-cols-[minmax(0,1fr)_var(--width-record-rail)] max-sm:block">
                        <section className="pt-page-header-stack pr-record-rail-inline max-sm:px-mobile-gutter max-sm:pt-[calc(var(--spacing-mobile-stack)-var(--spacing-mobile-title-stack))] max-sm:pb-scroll-inset-bottom">
                            <h2 className="pb-heading-sm-stack text-heading-sm text-foreground-subtle max-sm:text-mobile-heading-sm">{COPY.historyHeading}</h2>
                            {history.length === 0 ? (
                                <p className="text-body text-foreground-subtle max-sm:text-mobile-body">{COPY.noHistory}</p>
                            ) : (
                                <History rows={history} nameById={nameById} jobCodeById={jobCodeById} />
                            )}
                        </section>
                        {/* THE RECORD RAIL AND ITS ONE BLOCK, THE LABEL (0n, 0p). The label is
                            drawn as the labels' dialog draws its page, at twice its size, with
                            the print size in text under it; the control opens that dialog on
                            this one label, handed over as this render built it, so opening it
                            reads nothing. It stands for every status, `Retired` included. A
                            phone draws no label: one is printed at a desk. */}
                        <aside className="border-l border-divider pt-page-header-stack pl-record-rail-inset-left max-sm:hidden">
                            <h2 className="pb-heading-sm-stack text-heading-sm text-foreground-subtle">{COPY.labelHeading}</h2>
                            <div className="flex flex-col gap-label-block-stack">
                                {symbolFits ? (
                                    <>
                                        <div className="flex items-center justify-center rounded-card bg-background-muted px-label-preview-inset-x py-label-preview-inset-y">
                                            <LabelPreview label={label} budget={budget} name={COPY.symbolAlt} />
                                        </div>
                                        <dl className="flex flex-col gap-label-fact-stack text-body-sm">
                                            <div className="grid grid-cols-[var(--width-label-fact-term)_minmax(0,1fr)] items-baseline gap-x-label-fact-inline">
                                                <dt className="text-foreground-subtle">{COPY.sizeLabel}</dt>
                                                <dd className="tabular-nums">{LABEL_COPY.size}</dd>
                                            </div>
                                            <div className="grid grid-cols-[var(--width-label-fact-term)_minmax(0,1fr)] items-baseline gap-x-label-fact-inline">
                                                <dt className="text-foreground-subtle">{COPY.symbolLabel}</dt>
                                                <dd className="tabular-nums">{COPY.symbolSize(symbolMm)}</dd>
                                            </div>
                                        </dl>
                                    </>
                                ) : (
                                    <p className="text-body-sm text-pretty text-foreground-muted">{COPY.symbolTooLargeNote}</p>
                                )}
                                <div>
                                    <LabelsDialog
                                        title={LABEL_COPY.openFromToolItem}
                                        toolName={tool?.toolName}
                                        run={{ sideModules: QR_SIDE_MODULES, labels: [label], missing: [] }}
                                        variant="bordered"
                                    />
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
                <TransitionBar recentCheckOuts={recentCheckOuts} />
            </div>
        </ToolItemTransition>
    );
}

/**
 * The history, newest first (#463) — 0a's Log on a phone and the record page's at a desk: a
 * dot on a rule beside each entry, the rule stopping at the last.
 *
 * AN ENTRY IS ONE ELEMENT SET TWO WAYS. At a desk the event heads it with who a check-out
 * went to after `to`, and one line under it says when, on which job and `by` whom (1c). On a
 * phone the event stands alone, each value under it on its own line — the person and the job
 * behind their marks — and the moment and who recorded it last (1f). The values are
 * `logRowFacts`', so all four are on every entry and a check-out carries the fifth.
 */
function History({ rows, nameById, jobCodeById }) {
    return (
        <ol className="flex flex-col">
            {rows.map((row, index) => {
                const facts = Object.fromEntries(
                    logRowFacts({
                        event: row.event,
                        eventAt: row.eventAt,
                        recordedByName: nameById[row.recordedBy?.[0]],
                        jobCode: jobCodeById[row.job?.[0]],
                        checkedOutTo: row.checkedOutTo,
                    }).map((fact) => [fact.key, fact.value])
                );
                const last = index === rows.length - 1;
                const handedTo = "checkedOutTo" in facts;
                return (
                    <li
                        key={row.id}
                        className="grid grid-cols-[var(--width-log-track)_minmax(0,1fr)] gap-x-gap-lg max-sm:grid-cols-[var(--width-mobile-log-track)_minmax(0,1fr)] max-sm:gap-x-mobile-log-gap"
                    >
                        <div aria-hidden="true" className="relative flex justify-center">
                            {!last && (
                                <span className="absolute top-log-rule-inset-top -bottom-log-rule-overhang w-px bg-divider max-sm:top-mobile-log-rule-inset-top max-sm:-bottom-mobile-log-rule-overhang" />
                            )}
                            <span className="relative mt-log-dot-inset-top size-log-dot rounded-full bg-foreground-faint max-sm:mt-mobile-log-dot-inset-top max-sm:size-mobile-log-dot" />
                        </div>
                        <div className={`flex min-w-0 flex-col gap-log-line-stack ${last ? "" : "pb-log-stack max-sm:pb-mobile-log-stack"}`}>
                            <p className="text-body max-sm:text-mobile-body">
                                <span className="font-medium">{facts.event}</span>
                                {handedTo && (
                                    <span className="max-sm:hidden">
                                        {" "}
                                        <span className="text-foreground-subtle">{COPY.historyTo}</span> {facts.checkedOutTo}
                                    </span>
                                )}
                            </p>
                            {handedTo && (
                                <p className="flex items-center gap-gap text-mobile-body-xs sm:hidden">
                                    <PersonMark />
                                    <span className="min-w-0 text-pretty">{facts.checkedOutTo}</span>
                                </p>
                            )}
                            <p className="flex items-center gap-gap text-mobile-body-xs text-foreground-muted sm:hidden">
                                <PinMark />
                                <span className="min-w-0 text-pretty">{facts.job}</span>
                            </p>
                            <p className="text-body-sm text-foreground-subtle max-sm:text-mobile-body-xs">
                                <span className="text-foreground-muted max-sm:text-foreground-subtle">
                                    <Instant at={facts.eventAt} />
                                </span>
                                <span className="max-sm:hidden">
                                    <Dot />
                                    <span className="text-foreground-muted">{facts.job}</span>
                                </span>
                                <Dot />
                                {COPY.historyBy}{" "}
                                <span className="text-foreground-muted max-sm:text-foreground-subtle">{facts.recordedBy}</span>
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * The dot between two clauses (0e): Ink 4, 9 either side. The 9s are `Space`s, so the two
 * clauses copy and are read apart; the dot itself is not read.
 */
function Dot() {
    return (
        <>
            <Space className="w-separator-inline" />
            <span aria-hidden="true" className="text-foreground-faint">
                {COPY.between}
            </span>
            <Space className="w-separator-inline" />
        </>
    );
}

/** A phone entry's person, 14 in Ink 3 before the name (1f). */
function PersonMark() {
    return (
        <svg viewBox="0 0 16 17" fill="none" aria-hidden="true" className="size-mobile-log-icon shrink-0 text-foreground-subtle">
            <circle cx="8" cy="5" r="3.1" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2.2 15.2c0-3.1 2.6-4.6 5.8-4.6s5.8 1.5 5.8 4.6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
    );
}

/** A phone entry's job, a pin, 14 in Ink 3 before the job (1f). */
function PinMark() {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-mobile-log-icon shrink-0 text-foreground-subtle">
            <path d="M8 14.5s5-4.1 5-7.8A5 5 0 0 0 3 6.7c0 3.7 5 7.8 5 7.8Z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="6.6" r="1.7" fill="currentColor" />
        </svg>
    );
}

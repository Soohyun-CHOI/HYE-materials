import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAssetByAssetId } from "@/lib/airtable/assets";
import { getAssetCategoriesByRecordIds } from "@/lib/airtable/assetCategories";
import { getRecentCheckOuts, getAssetLogByAsset } from "@/lib/airtable/assetLog";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { DAY_FORMAT } from "@/lib/format";
import { ASSET_COPY as COPY, currentHolder, logRowFacts, newestFirst, retiredAt, sentForRepairAt } from "@/lib/assetView";
import Breadcrumb from "@/app/components/Breadcrumb";
import { ButtonLink } from "@/app/components/Controls";
import Icon from "@/app/components/Icon";
import Instant from "@/app/components/Instant";
import Dot from "@/app/components/Dot";
import { KEYBOARD_VIEWPORT } from "@/app/components/keyboardViewport";
import TopBar from "@/app/components/TopBar";
import { QR_SIDE_MODULES, buildAssetLabel } from "@/lib/assetLabelQR";
import { ASSET_LABEL_PAGE_COPY as LABEL_COPY, labelBudget, symbolBox } from "@/lib/assetLabelPage";
import { ASSET_LIST_COPY, assetListScope, listJobFromAsset } from "@/lib/assetListView";
import { ASSET_CATEGORIES_PATH, labelCodeFor, assetPath, assetCategoriesPath, assetCategoryPath } from "@/lib/assetRoutes";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_TRANSITION_COPY as TRANSITION_COPY, planTransition } from "@/lib/assetTransition";
import { planOfficeActs } from "@/lib/assetOfficeActs";
import { withOpsLabel } from "@/lib/airtableOps";
import { isSiteManager } from "@/lib/siteManager";
import { actorName } from "@/lib/userName";
import LabelsDialog, { LabelPreview } from "../LabelsDialog";
import StatusMark from "../../StatusMark";
import CategoryCaption from "../../CategoryCaption";
import JobChoice from "../../JobChoice";
import MoreActions from "./MoreActions";
import AssetNote from "./AssetNote";
import AssetTransition from "./AssetTransition";
import TransitionBar from "./TransitionBar";
import TransitionDialog from "./TransitionDialog";
import TransitionRefusal from "./TransitionRefusal";

// The param and no lookup, which is what all four document detail screens do and
// is the reason this page's cost is what the docstring says. The consequence is
// that a tab for an id nothing carries is titled with that id — the same on
// `/pos/[poId]` for an unknown order — and closing that would mean reading the
// asset twice per render for a string in a tab. The heading is its category's name
// since #463, and the tab keeps the id: the design draws no tab, and the id is what
// tells two tabs of one category apart.
export async function generateMetadata({ params }) {
    const { assetId } = await params;
    return { title: decodeURIComponent(assetId) };
}

// A phone that would cover the page with its keyboard shrinks it instead, as on every screen
// with a foot bar (#495): the name sheet the foot bar opens stands on the keyboard, as 1j
// draws it, rather than under it.
export const viewport = KEYBOARD_VIEWPORT;

// An id set inside a line of Instrument Sans — the line under the title and the not-found
// sentence. ITS OWN LINE HEIGHT IS 1, SO THE LINE STAYS ITS 20 (#505): at the line's 20 the
// id's box and the line's own sat on the baseline with fractional ascents that rounded apart
// on a screen of one device pixel to the CSS pixel, and the line drew 21 — the drawing does
// too at that ratio, and draws 20 at two. At 1 the id's box sits inside the line's, and its
// glyphs draw where they did.
const ID_IN_TEXT = "font-id leading-none tracking-id text-foreground-default";

// The id a phone's title block opens on (0a, #538): 14 in the id face, tabular, in Ink 3, 4 over
// the name — where the top bar held it at 17 until the files of 2026-10-16.
const ID_ON_PHONE = "font-id text-mobile-body-xs tracking-id tabular-nums text-foreground-subtle";

/**
 * One asset and everything that has happened to it (#340), in the look the design
 * settled (#463): 0n's record page at a desk (1f, 1g) and 1j's app screen on a phone.
 *
 * A SCAN ARRIVES HERE AND THE LABEL DOES NOT CARRY THIS ADDRESS (#348). It used
 * to: the page stood at `/tools/[toolItemId]` because a QR encodes the whole URL
 * and every character pushes the symbol toward a finer grid, so the shortest slot
 * on the axis was spent on it. `/l/[labelCode]` carries that budget now and
 * redirects here, which frees this page to take the name its collection gives it
 * and frees the flat slot under `/tools` for one tool. Nothing had been printed,
 * so the move cost code and no reprinting; from Phase 2 onward it would cost both.
 * The reader is unchanged — a phone camera reading a sticker glued to a drill,
 * which is what makes this different in kind from every other detail screen here.
 *
 * IT REDIRECTS A NON-CANONICAL ID, and the reason is the second way in: the label
 * prints the asset's code in readable characters under the QR code, for a
 * symbol that has been scratched or painted over, so somebody types it by hand. The lookup is
 * case-insensitive for that, and this redirect is what stops the concession from
 * turning one printed address into several. `permanentRedirect` rather than
 * `redirect`, because the mapping is stable forever: an `Asset ID` is minted
 * once and printed, and neither way an asset leaves takes its row — `Retired` takes it
 * out of the count, and the office's deletion (#582) out of every screen, a deleted
 * asset's address answering as a code no asset carries — so nothing reassigns the string a
 * cached redirect names. **`/l/` uses the plain `redirect` and the difference is
 * not an oversight**: this one maps a variant of an address onto that address, and
 * that one maps a printed entry point onto a screen whose address the app may
 * move.
 *
 * A REDIRECT FROM `/l/` NEVER LANDS ON THIS ONE. That route canonicalizes the
 * case before it hands the id over, so a scan and a typed label both reach this
 * page already spelled the way the base spells it, and the printed path costs one
 * hop rather than two. This redirect answers direct traffic.
 *
 * FIVE OPERATIONS PLUS ONE PER 50 LOG ROWS, and the shape matters because this
 * will be the most frequently rendered screen on the axis once a scan opens it.
 * The session find, the asset lookup, its category, its people and the job list
 * are each one; only the log walk grows, and it grows in steps of 50 through
 * `findChildRecords` rather than per row. The asset record already carries
 * its `Asset Log` link array, so the walk skips the parent find (#193). People and
 * jobs are read once for the whole history rather than per row, so a long history
 * adds no cost on either. #463 added no read: who holds an asset that is out and when
 * a retired one was retired are both on the history's latest row, already in hand, and so
 * is when one in repair was sent (#531). Nor did the note (#533), a field of the asset's own
 * row, which the lookup reads whole.
 *
 * `Status` AND `Job` ARE READ FROM THE ASSET. They are caches of the last log
 * row, and this page has that row in hand — but it shows the cached values,
 * because they are what every other surface on the axis shows and because they are
 * present even when the history is not. See `lib/assetView.js` for why nothing
 * here compares the two.
 *
 * AND ONE MORE WHEN THE OFFER IS A CHECK-OUT (#376), which is the first read this
 * page has added since #340 and is why the figure above is now two figures. The
 * names a check-out offers are other assets' history on the reader's own jobs,
 * so nothing already in hand can answer it; `getRecentCheckOuts` is one operation
 * and stays one whatever a job's history grows to. Every other path — a check-in,
 * an item in repair, a retired asset, a reader with no job, a reader who is not a site
 * manager (#506) — asks nothing and pays nothing.
 *
 * IT OFFERS WHAT THAT STATUS ALLOWS (#362, #363, #531), AND FOR NO OPERATIONS AT ALL.
 * The session and the whole job list are already read for the history's names,
 * so `planTransition` decides every offer from facts in hand and the figure
 * above is unchanged — measured, before #362 and again after #363. This is where
 * a scan lands, so a read added here is the read that would matter most on this
 * axis; there is none.
 *
 * THE PAGE OFFERS AND THE ACTION DECIDES, WHICH IS NOT A DUPLICATION. Both call
 * `planTransition`, and the action calls it again on a fresh read because a
 * Server Action is reachable without this page and because the status may have
 * moved since this render. One rule, two callers, no second implementation.
 *
 * AND IT OFFERS NOTHING TO A READER WHO IS NOT A SITE MANAGER (#506), who reads the same
 * page without its controls: `planTransition` asks `isSiteManager` first and gives them no
 * event, no retirement and no sentence, so the header's right holds nothing at a desk and
 * a phone draws no foot bar; and `Print label` is drawn under the same question, while
 * the label itself, its size and its symbol stay, since what a label looks like is a fact
 * about the asset. The actions behind the controls ask it too, through
 * `withSiteManagerAction`. **But the office may change the job of an item nothing has happened
 * to (#583)** — an Admin, whether or not a site manager, while the history holds its `Created`
 * entry alone — so for the office such an item's `More actions` holds `Change job`, at a desk and
 * on a phone, and `withAdminAction` is the gate behind it; and since #582 `Delete this item` too,
 * behind the same gate, which leaves the item's address answering as 1h does.
 *
 * TWO DRAWINGS OF ONE PAGE (#463). A desk draws 0n's record page under the breadcrumb:
 * a header holding its category's name, the line under it, its status and the actions, the
 * history beside the record rail and its label (1f, 1g). A phone draws 1j: the top bar with
 * `More actions` and, once the heading has scrolled under it, the name; the title block; the
 * history; and the transition in a foot bar. **The line under the name is the id and the caption
 * since #519** — the id, the type and the category at a desk, and the class too until #552, the
 * id first as it has been since #411; on a phone the id opens the title block over the name and the caption stands
 * alone under it, where the top bar held the id until #538 — off the category row already read,
 * so it costs nothing (`CategoryCaption`). The job left that line with #519, as 1f draws it: every history
 * entry names its job, and wherever there are jobs to choose between the breadcrumb does. What is
 * one fact is one element — the heading, the status, an entry — set at each width's size;
 * what only one width draws is drawn there alone. Every word is a constant and every value a
 * name `app/designValues.css` declares, and the column the page sits in is the layout's
 * (`app/(assets)/layout.js`), which an asset page does not declare a width against: the 1080
 * here is the content's measure inside it, 0b's, not the column's.
 */
export default async function AssetPage(props) {
    return withOpsLabel("/assets/[assetId]", () => renderAssetPage(props));
}

/**
 * A code no asset carries (#463): the desk's 1h, centered in the column with the code it
 * asked for and the way back to the list, and the phone's 1k-c, the mark, then the code in Ink 3
 * over the title, as every phone title block opens on its id (#538), and the sentence — no way
 * back, since a phone arrived here from a scan. Its top bar carries `More actions` with the
 * account alone (#495), as every one does, and no name.
 */
function AssetNotFound({ asked, account }) {
    return (
        <div className="flex min-h-full flex-1 flex-col font-ui text-foreground-default max-sm:min-h-0">
            <TopBar>
                <MoreActions phone account={account} />
            </TopBar>
            <div className="flex flex-1 flex-col items-center justify-center px-page-gutter text-center max-sm:px-mobile-empty-state-inset-x max-sm:pb-mobile-empty-state-inset-bottom">
                <Icon name="search-x" className="mb-gap size-mobile-empty-state-icon text-foreground-subtle sm:hidden" />
                <div className="flex flex-col items-center gap-mobile-title-block-stack max-sm:mt-gap">
                    <p className={`${ID_ON_PHONE} sm:hidden`}>{asked}</p>
                    <h1 className="text-heading font-semibold max-sm:text-mobile-heading-lg">{COPY.notFoundHeading}</h1>
                </div>
                <p className="mt-gap max-w-empty-state text-body-sm text-pretty text-foreground-muted max-sm:hidden">
                    {COPY.notFoundCode.before}
                    <span className={ID_IN_TEXT}>{asked}</span>
                    {COPY.notFoundCode.after}
                </p>
                <p className="mt-gap max-w-mobile-empty-state text-mobile-body text-pretty text-foreground-subtle sm:hidden">{COPY.notFoundScanned}</p>
                <div className="mt-gap-lg max-sm:hidden">
                    <ButtonLink variant="bordered" href={ASSET_CATEGORIES_PATH}>
                        {COPY.backToTools}
                    </ButtonLink>
                </div>
            </div>
        </div>
    );
}

async function renderAssetPage({ params }) {
    const user = await requireUser();
    const { assetId } = await params;
    const asked = decodeURIComponent(assetId);

    // Who is reading, for the account a phone's top bar ends its menu on (#495).
    const account = { email: user.email };

    const asset = await getAssetByAssetId(asked);
    if (!asset) return <AssetNotFound asked={asked} account={account} />;

    // The canonical form answers directly and every other casing arrives here.
    // After requireUser, so a reader with no session learns nothing about which
    // strings resolve.
    if (asset.assetId !== asked) {
        permanentRedirect(assetPath(asset.assetId));
    }

    // The link array is already on the record, so the log costs ceil(N/50) and not
    // 1 + ceil(N/50). It arrives oldest first — creation order, which for an
    // append-only table is chronological — and is drawn newest first (#463).
    const [categories, log, jobs] = await Promise.all([
        getAssetCategoriesByRecordIds(asset.category),
        getAssetLogByAsset(asset.id, { rowIds: asset.assetLog }),
        getAllJobs(),
    ]);

    const recordedByIds = [...new Set(log.map((row) => row.recordedBy?.[0]).filter(Boolean))];
    const people = await getUsersByRecordIds(recordedByIds);

    // Who recorded an entry is named for what they did, in full (#463, `actorName`).
    const nameById = Object.fromEntries(people.map((person) => [person.id, actorName(person)]));
    const jobCodeById = Object.fromEntries(jobs.map((job) => [job.id, job.jobCode]));
    const jobCode = jobCodeById[asset.job?.[0]];
    const history = newestFirst(log);
    const holder = currentHolder(history, asset.status);
    const retired = retiredAt(history, asset.status);
    const sentForRepair = sentForRepairAt(history, asset.status);

    // The transition costs NOTHING here (#362): the session and the whole job
    // list are both already read above, so the offer is decided from facts in
    // hand and this page's five operations plus one per 50 log rows are
    // unchanged. `planTransition` returns either an event to offer or the
    // sentence saying why not — one function for both, so the page cannot render
    // a control without having asked the question that refuses it. The action
    // asks the same function again, because a Server Action is reachable without
    // this page.
    const transition = planTransition({ user, jobs, status: asset.status });
    // WHAT THE OFFICE MAY DO HERE (#583, #582), and for no operations either: the reader, the
    // history and the job list are all in hand. `planOfficeActs` offers `Change job` and `Delete
    // this item` while the history holds its `Created` entry alone, with the jobs a list's choice
    // offers, and each action asks it again on a fresh read.
    const office = planOfficeActs({ user, log, jobs });
    // Whether the office has a line in `More actions` at all — the deletion stands wherever the
    // change does, and alone where a deletion was left half done.
    const officeActs = office.mayChangeJob || office.mayDelete;
    // The jobs this reader's lists hold, the same judgment the lists read by (#509) — every job,
    // for every reader, since #593: with more than one, the breadcrumb names the asset's job as a
    // level they may change (#519), and the list's level and the category's carry it when it is
    // one of them (#581). Nothing a reader records here asks it: `planTransition` above reads
    // their own assignments.
    const scope = assetListScope(user, jobs, null);
    const choosesJob = scope.jobs.length > 1;
    const listJob = listJobFromAsset(scope, asset);
    // Whether this reader prints labels (#506) — the question `planTransition` asked above,
    // asked of the one control outside the transition.
    const recorder = isSiteManager(user);

    // #376 — THE ONE READ THIS PAGE ADDED, AND ONLY WHERE IT IS USED. A check-out
    // asks who the asset is going to and offers the names the reader's own jobs have
    // recently handed assets to; a check-in returns one to stock and asks nobody, a
    // retired asset offers neither control, a reader with no job is refused before
    // either, and one who is not a site manager is offered neither (#506). So the
    // query runs only when the offered event is the one that
    // carries a name, which leaves this page at its recorded figure on every other
    // path. One operation when it does run — see `getRecentCheckOuts` for why it is
    // one and stays one.
    const recentRows =
        transition.event === ASSET_EVENT.CHECKED_OUT
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
    // a label printed from a category's page encode the same string. No Airtable
    // operation. It is this asset's LABEL that is built (#457) — its symbol and the
    // code it prints — because the labels' dialog this page opens draws its page from
    // the same object the rail's drawing is drawn from, so the two are built once.
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    const label = await buildAssetLabel({
        origin: `${proto}://${headerList.get("host") ?? ""}`,
        assetId: asset.assetId,
    });
    // Sized for today's version plus the label's headroom, then applied to the side
    // count this symbol actually came out at. Whether it FITS is asked here too
    // (#453): the label absorbs no version step, so a longer host builds a symbol the
    // labels' dialog draws no page for, and the rail has to say that rather than draw
    // a label and its size.
    const budget = labelBudget({ sideModules: QR_SIDE_MODULES });
    const { boxMm: symbolMm, fits: symbolFits } = symbolBox({ sideModules: label.sideModules, budget });

    const category = categories[0];
    const name = category?.itemName || asset.assetId;

    return (
        <AssetTransition
            plan={transition}
            office={office}
            assetJobRecordId={asset.job?.[0] ?? null}
            assetId={asset.assetId}
            itemName={category?.itemName}
        >
            <div className="font-ui text-foreground-default max-sm:flex max-sm:flex-1 max-sm:flex-col">
                {/* THE PHONE'S HEAD (1j): `More actions`, which holds the retirement when there
                    is something to retire and the account always (#495), and the name once the
                    heading has scrolled under it (#538). */}
                <TopBar name={name}>
                    <MoreActions phone account={account} />
                </TopBar>
                {/* WHERE THIS ASSET SITS UNDER ITS CATEGORY (#460): the list, the category, and the
                    code its label prints, which is how the design ends the path (1f). The
                    category is the row read above, so the path costs nothing. A phone draws the
                    top bar in its place. Wherever there are jobs to choose between the job the asset is on
                    stands between the list and the category (1f, #519), a level that takes them
                    to the category's list on another job, or on `All jobs` (#548) — it holds the
                    asset's job whatever list it was opened from, since the address carries none —
                    and the list's level and the category's carry the asset's job when the reader
                    may narrow to it (#581). */}
                <Breadcrumb
                    levels={[
                        { label: ASSET_LIST_COPY.heading, href: assetCategoriesPath(1, listJob) },
                        ...(category && choosesJob
                            ? [
                                  {
                                      key: "job",
                                      control: (
                                          <JobChoice
                                              look="crumb"
                                              jobs={scope.jobs.map(({ id, jobCode }) => ({ id, jobCode }))}
                                              job={asset.job?.[0] ?? null}
                                              shownAs={jobCode}
                                              categoryRecordId={category.id}
                                          />
                                      ),
                                  },
                              ]
                            : []),
                        ...(category ? [{ label: category.itemName, href: assetCategoryPath(category.id, 1, [], { job: listJob }) }] : []),
                    ]}
                    current={labelCodeFor(asset.assetId)}
                    phone={false}
                />
                {/* At a desk 0b's 1080, centered in the column; below the phone's edge the
                    page is a flex column and this its full width, margins and all, since an
                    automatic margin would shrink it to what it holds. */}
                <div className="mx-auto box-content max-w-content px-page-gutter pt-breadcrumb-stack pb-scroll-inset-bottom max-sm:mx-0 max-sm:max-w-none max-sm:px-0 max-sm:pt-0 max-sm:pb-0">
                    {/* 0n's RECORD HEADER: the name, the id and the caption under it, the status,
                        and on the right what may be recorded, 3 above the title's top as 1f
                        draws it — 24 above and below its Band. On a phone, 1j's title block,
                        4 under the top bar: the id, the name and the caption, 4 apart (#538). The
                        block takes the phone's whole width, where nothing stands on its right, so
                        a note's line reaches 12 past it either side however short the name (#533). */}
                    <header className="flex items-start justify-between gap-record-header-inline border-b border-divider-strong pb-record-header-stack max-sm:border-b-0 max-sm:px-mobile-gutter max-sm:pt-mobile-top-bar-stack max-sm:pb-mobile-title-stack">
                        <div className="flex min-w-0 flex-col gap-subtitle-stack max-sm:flex-1">
                            <div className="flex flex-col gap-title-stack max-sm:gap-mobile-title-block-stack">
                                <p className={`${ID_ON_PHONE} sm:hidden`}>{asset.assetId}</p>
                                <h1 className="text-heading-lg max-sm:text-mobile-heading-lg">{name}</h1>
                                <CategoryCaption
                                    category={category}
                                    lead={<span className={ID_IN_TEXT}>{asset.assetId}</span>}
                                    className="text-body text-foreground-subtle max-sm:hidden"
                                />
                                <CategoryCaption category={category} className="text-mobile-body-xs text-foreground-subtle sm:hidden" />
                            </div>
                            {/* THE STATUS, AND THE VALUE ONLY ONE STATE HAS 14 AFTER IT (0n):
                                who holds an asset that is out, when a retired one was retired
                                and when one in repair was sent, at both widths (#531, #538; 1f,
                                1j-c, 1j-e), the day at the holder's size. The mark sits on the
                                word's baseline at a desk and centered on its line on a phone,
                                as each drawing sets it. */}
                            <div className="flex items-baseline gap-gap-lg">
                                <span className="inline-flex items-baseline gap-gap text-body max-sm:items-center max-sm:text-mobile-body">
                                    <StatusMark status={asset.status} />
                                    {asset.status}
                                </span>
                                {holder && <span className="text-body-sm text-foreground-subtle max-sm:text-mobile-body-sm">{holder}</span>}
                                {retired && (
                                    <span className="text-body-sm text-foreground-subtle max-sm:text-mobile-body-sm">
                                        <Instant at={retired} format={DAY_FORMAT} />
                                    </span>
                                )}
                                {sentForRepair && (
                                    <span className="text-body-sm text-foreground-subtle max-sm:text-mobile-body-sm">
                                        <Instant at={sentForRepair} format={DAY_FORMAT} />
                                    </span>
                                )}
                            </div>
                            <TransitionRefusal />
                            {/* THE NOTE, 12 UNDER THE STATUS AT BOTH WIDTHS (0a Note, 1f, 1j; #533):
                                read by everybody, written by whoever the plan says may — and
                                after a refused press's sentence, which 1k sets right under the
                                status it is about. It arrived with the asset's own read. */}
                            <AssetNote assetId={asset.assetId} note={asset.note} writable={transition.mayWriteNote} />
                        </div>
                        {/* WHAT MAY BE RECORDED, AT A DESK (#362, #363, #463, #531): the press
                            and `More actions`, which holds sending for repair and the
                            retirement. A REFUSAL STANDS WHERE BOTH CONTROLS WOULD BE, never
                            beside them — a reader on no job reads why — except a status that
                            allows nothing, where 1f draws nothing at all; a phone's foot bar
                            says that one. The two controls must not read as the same weight:
                            one is pressed dozens of times a day and is the filled button, the
                            other holds that asset's last act and is a menu behind an icon.
                            Each is asked for separately, because the answers come from three
                            maps (`lib/assetStatus.js`). A READER WHO IS NOT A SITE MANAGER IS
                            OFFERED NONE AND TOLD NOTHING (#506), so the place holds nothing, as
                            it does for a retired asset. THE OFFICE'S `Change job` AND `Delete this
                            item` ARE IN THE SAME MENU (#583, #582), whoever else the reader is, so
                            `More actions` stands for them alone too — and beside a site manager's
                            sentence about having no job, which is about recording and not about
                            this. */}
                        {transition.refusal
                            ? transition.refusal !== TRANSITION_COPY.noTransition && (
                                  <div className="flex shrink-0 items-start gap-gap max-sm:hidden">
                                      <p className="max-w-empty-state text-body-sm text-pretty text-foreground-subtle">{transition.refusal}</p>
                                      {officeActs && (
                                          <div className="-mt-record-header-actions-bleed flex">
                                              <MoreActions />
                                          </div>
                                      )}
                                  </div>
                              )
                            : (transition.event || transition.maySendForRepair || transition.mayRetire || officeActs) && (
                                  <div className="-mt-record-header-actions-bleed flex shrink-0 items-center gap-gap max-sm:hidden">
                                      {transition.event && <TransitionDialog currentJobCode={jobCode} recentCheckOuts={recentCheckOuts} />}
                                      {(transition.maySendForRepair || transition.mayRetire || officeActs) && <MoreActions />}
                                  </div>
                              )}
                    </header>
                    <div className="grid grid-cols-[minmax(0,1fr)_var(--width-record-rail)] max-sm:block">
                        <section className="pt-record-header-stack pr-record-rail-inline max-sm:px-mobile-gutter max-sm:pt-[calc(var(--spacing-mobile-stack)-var(--spacing-mobile-title-stack))] max-sm:pb-scroll-inset-bottom">
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
                            reads nothing. It stands for every status, `Retired` included, and
                            for a site manager alone (#506): anybody else reads the label, its
                            size and its symbol, and has nothing here to print it with. A
                            phone draws no label: one is printed at a desk. THE RAIL HOLDS UNDER
                            THE BREADCRUMB BAR WHILE IT FITS (0i), 24 under it as it stands under
                            the header's Band, and its Rule runs the whole column. */}
                        <aside className="border-l border-divider pl-record-rail-inset-left max-sm:hidden">
                            <div className="sticky top-(--height-breadcrumb) pt-record-header-stack">
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
                                    {recorder && (
                                        <div>
                                            <LabelsDialog
                                                title={LABEL_COPY.openFromAsset}
                                                itemName={category?.itemName}
                                                run={{ sideModules: QR_SIDE_MODULES, labels: [label], missing: [] }}
                                                variant="bordered"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
                <TransitionBar recentCheckOuts={recentCheckOuts} />
            </div>
        </AssetTransition>
    );
}

/**
 * The history, newest first (#463) — 0a's Log on a phone and the record page's at a desk: a
 * dot on a rule beside each entry, the rule stopping at the last.
 *
 * AN ENTRY IS ONE ELEMENT SET TWO WAYS. At a desk the event heads it with who a check-out
 * went to after `to`, and one line under it says when, on which job and `by` whom (1f). On a
 * phone the event stands alone, each value under it on its own line — the person and the job
 * behind their marks — and the moment and who recorded it last (1j). The values are
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
                                    <Icon name="user" className="size-mobile-log-icon shrink-0 text-foreground-subtle" />
                                    <span className="min-w-0 text-pretty">{facts.checkedOutTo}</span>
                                </p>
                            )}
                            <p className="flex items-center gap-gap text-mobile-body-xs text-foreground-muted sm:hidden">
                                <Icon name="map-pin" className="size-mobile-log-icon shrink-0 text-foreground-subtle" />
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

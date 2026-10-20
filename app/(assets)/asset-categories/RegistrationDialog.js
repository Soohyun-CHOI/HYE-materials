"use client";

import { Fragment, startTransition, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, ChipChoice, Choice, Field, FilterChip, NumberField, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogSearch } from "@/app/components/DialogFrame";
import Dot from "@/app/components/Dot";
import { onlyJob } from "@/lib/assetJob";
import { ASSET_CATEGORY_COPY as CATALOG, catalogLevelValues, catalogRowsOf, searchCatalogNames, walkDetails } from "@/lib/assetCategory";
import { ASSET_LIST_COPY } from "@/lib/assetListView";
import {
    MAX_ASSETS_PER_REGISTRATION,
    ASSET_REGISTRATION_COPY as COPY,
    detailRefusals,
    nameOffers,
    openingCount,
    readQuantity,
    readRegistration,
    searchedIn,
} from "@/lib/assetRegistration";
import { matchedPart } from "@/lib/assetTransition";
import { normalizeItemText } from "@/lib/itemNaming";
import { registerAssetsAction } from "./actions";

/**
 * The registration — adding assets to stock (#485) — as a dialog over the page that opens it
 * (#456), and the control that opens it. It was the form at `/tools/new` from #338 to #456.
 *
 * TWO STEPS SINCE #507, BECAUSE A REGISTRATION PICKS A KIND FROM THE CATALOG. The first finds
 * the name — a search over the catalog's names, and since #547 their types, categories, sizes,
 * makers and part numbers, which the type and the category narrow — and picking one goes on to
 * the second, which takes what the catalog holds under that name — its size and its model since
 * #520, the maker and part number together, each only where the rows give a choice, and opened
 * on the size or the model a size or a part number found (#547) — the count and the job, and
 * submits. Nothing here creates a kind: the name typed on this dialog from #338 was found or
 * created as it was written, and the office keeps the catalog now, on its own page (#527) and in
 * Airtable.
 *
 * THE FIRST STEP IS 1b's SINCE #520: the search the dialog is built around (`DialogSearch`,
 * 0f Field), the type and the category as chips taking one value at its row's end, and every
 * name it lists under it in the dialog's body — each with what it leads to at its row's end
 * (`nameOffers`), and after it its place where the catalog holds its words twice and what found
 * it where the name did not (#547) — or the sentence saying nothing matched. The dialog is 480
 * wide, as 0l gives a dialog that searches a list and picks from it, and holds 1b's 490 while it
 * picks, so moving between the steps never moves its edges. On the second the line under the
 * title is the name picked, and `Back` the way to the first, a ghost at the actions' left. Until
 * #520 the search offered five names in a list under a field, the filters were 0l's choices
 * above it, the first step said `Each one gets its own ID and label.` under the title, and the
 * way back was the sign-in steps' `Change` on that line.
 *
 * THE SECOND STEP IS 1b's SINCE #520, AND `walkDetails`' ANSWER, DRAWN. The size and the model
 * are 0l's chips (`ChipChoice`), scrolling in 0i's lane, and the count and the job sit on the
 * actions under them and do not scroll; the class the kind carries is not said, as 1b says none.
 * Which choices it draws, what each offers under the size chosen, the empty option last — `None`,
 * `Not specified` — and which row they make are `lib/assetCategory.js`'s, asked again on every
 * render of what the reader chose; this holds the choices and nothing derived from them, so a
 * model the size chosen since took away is read there as never made, and no effect has to
 * clear it. From #514 to #520 it asked the size, the maker and the part number one by one, each
 * 0l's choice with its empty option first, and stated the class under them.
 *
 * WHERE FOCUS GOES BETWEEN THE TWO IS THE FRAME'S RULE AND NOT A RULE OF ITS OWN. Opening, the
 * caret is in the search, the frame's first field that takes typing. A step that goes takes
 * what held focus with it — the search, or `Back` — and the frame puts focus that falls in
 * an open dialog on the first thing its body holds that can take it (#469): the first chip
 * the second step draws, or the count where it draws none, and back on the first step the
 * search, which keeps what was typed. The filters stand after the search in its row (1b): the
 * results never cover them, since they stand under the row the whole time rather than opening
 * over what is below, which is what stood the filters above the search from #507 to #520.
 *
 * THREE OPENERS, AND EACH HANDS OVER WHAT THE ADDRESS USED TO CARRY. The category list opens
 * it on no kind, so the first step picks one; a kind's own page opens it on that kind; and
 * the offer a registration that fell short makes opens it on that kind with the count it did
 * not write. Opened on a kind, the dialog starts at its second step with nothing to choose —
 * the catalog it is handed is that row alone, so its size and its model are already its own —
 * and asks the count and the job alone (#520), where it drew the kind's levels each holding its
 * one value until then: the kind's name is the line under the title, the design's, and there is
 * no way back, since what is added goes under the kind that page is about — another is picked
 * from the list's opener (#449, #451, #456, #514). Nothing
 * is written to the address to open it, and nothing about where it was opened from is said
 * inside it.
 *
 * THE OFFER'S OPENER STANDS IN A DIALOG OF ITS OWN SINCE #459, so it cannot be this
 * component: the offer puts itself away as the registration opens, and a control inside
 * a dialog that is gone cannot hold the one that replaced it. So the parts are exported —
 * `useRegistrationOpening` for the rule below, `RegistrationOpener` for the gate, and
 * `RegistrationForm` for the dialog — and this default export is them assembled for an
 * opener that stands on a page. Each is one implementation, whichever of the two draws it.
 *
 * AN EMPTY LIST DRAWS A SECOND OPENER, BORDERED, UNDER ITS SENTENCE (1a, 1d; #463) — another
 * of these beside the head's, `variant` its one difference — since a list with nothing in it
 * is where the reader who needs the dialog most is looking.
 *
 * A SITE MANAGER ON NO JOB MEETS EVERY OPENER DRAWN AND DISABLED, WITH WHY BEFORE IT (0f),
 * and the dialog never opens for them. What #451 kept is kept for them: all three ask one
 * predicate, `canRegisterAssets`, which the page asks and hands down as `canRegister`,
 * and the reason is said beside the control that cannot act, rather than on a screen
 * arrived at to be refused, which is also `/invoices`' rule against landing a reader on a
 * refusal. **A reader who is not a site manager meets no opener at all (#506)** — each page
 * draws this only under `isSiteManager` — which is that same rule read for a role: a job
 * assignment is something to ask the office for, and being a site manager is not, so
 * `New invoice`'s shape fits rather than a disabled opener with a reason that would send
 * them nowhere.
 *
 * WHAT A SUBMISSION MAY BE IS ASKED BEFORE IT IS SENT, and asked of the same function the
 * action asks, `readRegistration`, against the same catalog rows: a refusal about a field is
 * said under that field and sends nothing, and only a submission it takes reaches the server.
 * The action asks again with a fresh read of the reader's jobs and of the catalog. A refusal
 * keeps everything chosen and typed — the fields are this component's own state — and a
 * field's refusal goes as soon as that field is changed, where the one about the whole dialog
 * stays until the next press. The first step refuses nothing: Enter takes the name an arrow put
 * visual focus on, or the one name left, and a search that lists nothing says so in the list's
 * place (#522; from #520 to #522 the first listed held visual focus once something was typed). Until #520 Enter with no suggestion under visual focus took the one name
 * typed in full and refused any other, under the field. The second step's refusals are the
 * size or the model still to choose, `detailRefusals`', each at the end of its label's line
 * (0l's chips) beside the reading's.
 *
 * IT SUBMITS THROUGH `submit`, INSIDE A TRANSITION, which React follows with no reset of
 * the form (#449 read that in react-dom). The form carries no `action` prop: #449 kept one
 * for a press landing before hydration, and a dialog cannot be open before hydration —
 * the opener is a button whose press is a script — so there is no such press to catch.
 *
 * ITS COMMITMENT NAMES WHAT IT WILL ADD, AND SAYS SO WHILE IT DOES (#469, #485). The words
 * follow the count as it is typed, through `readQuantity` — the reading the press itself
 * makes — so `Add 5 items` stands only over a count the press would take, and `Add items`
 * over one it would refuse (1b). While the registration is on its way the frame is
 * `busy`: the commitment gives way to `Adding…` after 300ms, every other
 * control locks, and nothing is disabled, so focus stays where the press found it — and
 * stays there through a refusal, since the commitment can act again at once. The first step
 * has no actions at all (1b): picking a name is how it goes on, and the close and Escape how
 * it stops.
 *
 * IT CLOSES WHEN THE PAGE IT WAS OPENED ON MOVES, which is how a registration that lands
 * on the same kind's page — the page it was opened from — takes the dialog away: it is
 * open only while the address is the one it was opened at. Nothing else moves the address
 * while it is open, because a modal dialog leaves the page behind it inert. Each opening
 * starts from what the opener hands over, and not from what the last one was left holding.
 */
export default function RegistrationDialog({ opener, variant, canRegister, jobs, category = null, catalog = [], quantity }) {
    const registration = useRegistrationOpening();

    return (
        <>
            <RegistrationOpener variant={variant} canRegister={canRegister} onOpen={registration.start}>
                {opener}
            </RegistrationOpener>
            {canRegister && (
                <RegistrationForm
                    key={registration.opening}
                    open={registration.open}
                    onClose={registration.close}
                    jobs={jobs}
                    category={category}
                    catalog={catalog}
                    quantity={quantity}
                />
            )}
        </>
    );
}

/**
 * Whether the dialog is open, for whatever opens it (#456, #459): open only while the
 * address is the one it was opened at, and `opening` counts the openings so each one
 * starts the form afresh from what its opener hands it.
 */
export function useRegistrationOpening() {
    const address = useSearchParams().toString();
    const [openedAt, setOpenedAt] = useState(null);
    const [opening, setOpening] = useState(0);
    const open = openedAt !== null && openedAt === address;

    return {
        open,
        opening,
        start: () => {
            setOpening((count) => count + 1);
            setOpenedAt(address);
        },
        close: () => setOpenedAt(null),
    };
}

/**
 * The control that opens the dialog — or, for a reader who may not register, the same
 * control drawn disabled with why before it (0f), and the dialog never opens for them.
 */
export function RegistrationOpener({ variant = "filled", canRegister, onOpen, children }) {
    if (!canRegister) {
        return (
            <Button variant={variant} disabled disabledReason={COPY.noJob}>
                {children}
            </Button>
        );
    }
    return (
        <Button variant={variant} onClick={onOpen}>
            {children}
        </Button>
    );
}

/**
 * The dialog itself, opened by whatever holds its opening.
 *
 * `catalog` is the rows a registration may pick (`registrationCatalog`) — every one on the
 * list's dialog, and on a category's own page that category alone while the catalog offers it.
 * `category` is the row a page opened it on, which skips the first step.
 */
export function RegistrationForm({ open, onClose, jobs, category, catalog = [], quantity }) {
    const [state, formAction, pending] = useActionState(registerAssetsAction, null);
    const focusRefused = useRefusalFocus();
    // What the first step picked last: a name in its place, whose rows the second narrows
    // between. Opened on a category, nothing is picked and the row is the page's. `Back` goes
    // to the first step and keeps it, so a pick can tell the name it had from another.
    const [picked, setPicked] = useState(null);
    const [choosing, setChoosing] = useState(true);
    // The first step's two filters, each a level's key, an empty one no filter (#514).
    const [filters, setFilters] = useState({ level1: "", level2: "" });
    const [typed, setTyped] = useState("");
    // What the reader chose on the second step, `{ size, model }` — an option's value each, ""
    // for a size of `None` — and nothing for a choice not made, which starts where `walkDetails`
    // starts it (#514, #520).
    const [chosen, setChosen] = useState({});
    const [count, setCount] = useState(() => String(openingCount(quantity)));
    // With one job it is already chosen, and with several nothing is (0l) — `onlyJob`, the
    // one spelling of "one assignment" the transition's dialog starts from too (#458).
    const [jobId, setJobId] = useState(onlyJob(jobs)?.id ?? "");
    // The dialog's own refusal of the last press, or null when that press was sent.
    const [guarded, setGuarded] = useState(null);
    // The fields changed since the last press, whose refusals no longer stand.
    const [edited, setEdited] = useState(() => new Set());

    const said = pending ? null : (guarded ?? state);
    const refusalFor = (field) => (edited.has(field) ? undefined : said?.fields?.[field]);
    const edit = (field, set) => (value) => {
        set(value);
        setEdited((was) => (was.has(field) ? was : new Set(was).add(field)));
    };

    const step = category || (picked && !choosing) ? "details" : "name";
    // The filters' values: the types, and the categories under the type chosen. A type chosen
    // takes away a category it does not hold, as 1b does, so the chip never holds one the type
    // left behind and clearing the type brings none back.
    const types = catalogLevelValues(catalog, "level1");
    const categories = catalogLevelValues(catalog, "level2", { level1: filters.level1 });
    const chooseType = ([key = ""]) =>
        setFilters((was) => ({
            level1: key,
            level2: catalogLevelValues(catalog, "level2", { level1: key }).some((each) => each.key === was.level2) ? was.level2 : "",
        }));
    const spelled = (values, key) => values.find((each) => each.key === key)?.value ?? "";
    // The second step: the rows it narrows between — the page's row alone, opened on one — the
    // levels it asks of them, and the row they make, which a page's row is from the start.
    const details = walkDetails(category ? catalog : picked ? catalogRowsOf(catalog, picked.key) : [], chosen);
    const made = category ?? details.category;

    // A name picked starts its levels where the search's words chose them — a size or a model a
    // size or a part number found (#547) — and the rest where `walkDetails` starts them, unless
    // it is the name the second step already held, which keeps what was chosen there under what
    // the words chose. What it is handed is a name the search listed, its place and what it
    // offers with it — so the second step can say where it stands. The search keeps what was
    // typed, so `Back` finds the list as it was left.
    const pick = (name) => {
        setChosen((was) => (name.key === picked?.key ? { ...was, ...name.chosen } : name.chosen));
        setPicked(name);
        setChoosing(false);
        setGuarded(null);
    };
    const back = () => {
        setChoosing(true);
        setGuarded(null);
    };

    const submit = (event) => {
        event.preventDefault();
        // The first step submits nothing: a result picked is how it goes on, and the search
        // takes Enter for itself (`DialogSearch`).
        if (step === "name") return;
        setEdited(new Set());
        const formData = new FormData(event.currentTarget);
        const reading = readRegistration(
            { categoryRecordId: formData.get("categoryRecordId"), quantity: formData.get("quantity"), jobId: formData.get("jobId") },
            jobs,
            catalog
        );
        if (!reading.registration) {
            // No row is made while a level is still to choose, and each such level is said
            // under itself beside whatever else the reading refused.
            setGuarded({ ...reading, fields: { ...reading.fields, ...detailRefusals(details.levels) } });
            focusRefused(event.currentTarget);
            return;
        }
        setGuarded(null);
        startTransition(() => formAction(formData));
    };

    // Where a name stands, when the catalog holds its words in another place too (#520), and in
    // the list what found it (#547): the parts `searchCatalogNames` hands, behind 0e's dot.
    const placeOf = (parts) =>
        parts.length === 0
            ? null
            : parts.map((part, index) => (
                  <Fragment key={index}>
                      {index > 0 && <Dot />}
                      {part}
                  </Fragment>
              ));

    // The line under the title (1b): the kind a page opened it on, or the name the first step
    // picked — with where it stands, for a name in two places (#520) — and none while it picks.
    const subtitle = category ? (
        category.itemName
    ) : step === "details" ? (
        <>
            {picked.level3}
            {picked.place.length > 0 && (
                <>
                    <Dot />
                    {placeOf(picked.place)}
                </>
            )}
        </>
    ) : undefined;

    // The count and the job, which every registration asks (1b): on the actions while the dialog
    // picks, and the whole of what it asks opened on a kind.
    const fields = (
        <div className="grid grid-cols-[var(--width-number-input)_minmax(0,1fr)] gap-dialog-inline">
            <Field label={COPY.quantityLabel} help={COPY.quantityHelp(MAX_ASSETS_PER_REGISTRATION)} refusal={refusalFor("quantity")}>
                <NumberField name="quantity" value={count} onChange={edit("quantity", setCount)} min={1} max={MAX_ASSETS_PER_REGISTRATION} />
            </Field>
            <Field label={COPY.jobLabel} labelAs="span" refusal={refusalFor("jobId")}>
                <Choice
                    name="jobId"
                    options={jobs.map((job) => ({ value: job.id, label: job.jobCode, note: job.jobName }))}
                    value={jobId}
                    onChange={edit("jobId", setJobId)}
                    placeholder={COPY.jobUnchosen}
                />
            </Field>
        </div>
    );

    return (
        <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.heading} subtitle={subtitle} onSubmit={submit} wide fixed={!category}>
            {step === "name" ? (
                <DialogSearch
                    label={COPY.searchLabel}
                    value={typed}
                    onChange={setTyped}
                    clearLabel={CATALOG.clearSearch}
                    filters={
                        <>
                            <FilterChip
                                single
                                fit="end"
                                label={CATALOG.levelLabel.level1}
                                options={types.map(({ key, value }) => ({ value: key, label: value }))}
                                values={filters.level1 ? [filters.level1] : []}
                                onChange={chooseType}
                                clearLabel={CATALOG.clearFilter.level1}
                            />
                            {/* The last chip pulls out by its chevron's side room while it holds
                                nothing, so the chevron's ink meets the edge (1b). */}
                            <div className={filters.level2 ? "flex" : "-mr-filter-chip-inset-right flex"}>
                                <FilterChip
                                    single
                                    fit="end"
                                    label={CATALOG.levelLabel.level2}
                                    options={categories.map(({ key, value }) => ({ value: key, label: value }))}
                                    values={filters.level2 ? [filters.level2] : []}
                                    onChange={([key = ""]) => setFilters((was) => ({ ...was, level2: key }))}
                                    clearLabel={CATALOG.clearFilter.level2}
                                />
                            </div>
                        </>
                    }
                    results={searchCatalogNames(catalog, { filters, typed }).map((name) => ({
                        key: name.key,
                        name,
                        label: name.level3,
                        match: matchedPart(name.level3, name.named),
                        place: placeOf(name.beside),
                        detail: nameOffers(name),
                    }))}
                    resultsLabel={ASSET_LIST_COPY.heading}
                    onPick={(result) => pick(result.name)}
                    empty={
                        normalizeItemText(typed) !== "" && (
                            <p className="px-dialog-result-bleed pt-dialog-results-empty-inset-top text-center text-body-sm text-foreground-subtle">
                                {COPY.noneMatches(
                                    normalizeItemText(typed),
                                    searchedIn({ level1: spelled(types, filters.level1), level2: spelled(categories, filters.level2) })
                                ).map((part) =>
                                    typeof part === "string" ? (
                                        part
                                    ) : (
                                        <span key="typed" className="text-foreground-default">
                                            {part.typed}
                                        </span>
                                    )
                                )}
                            </p>
                        )
                    }
                />
            ) : (
                <>
                    <input type="hidden" name="categoryRecordId" value={made?.id ?? ""} />
                    {/* Opened on a kind there is nothing to choose, so the dialog asks the count
                        and the job alone. Picking, the size and the model scroll in 0i's lane
                        over those two, which sit on the actions (0l, 1b). */}
                    <DialogBody lane={!category} foot={category ? undefined : fields}>
                        {category
                            ? fields
                            : details.levels
                                  .filter(({ asked }) => asked)
                                  .map(({ level, options, value }) => (
                                      // A choice's refusal stands while it holds nothing: a size
                                      // chosen can leave the model one option, chosen without asking.
                                      <ChipChoice
                                          key={level}
                                          label={level === "model" ? CATALOG.modelLabel : CATALOG.levelLabel[level]}
                                          options={options}
                                          value={value}
                                          onChange={edit(level, (key) => setChosen((was) => ({ ...was, [level]: key })))}
                                          refusal={value === null ? refusalFor(level) : undefined}
                                      />
                                  ))}
                    </DialogBody>
                    {/* The way back stands at the actions' left, a ghost (1b) — none for a dialog
                        opened on a kind, which has no first step to go back to. */}
                    <DialogActions
                        refusal={said?.error}
                        secondary={
                            !category && (
                                <Button variant="ghost" size="md" onClick={back}>
                                    {COPY.back}
                                </Button>
                            )
                        }
                    >
                        <Button variant="bordered" onClick={onClose}>
                            {COPY.cancel}
                        </Button>
                        {/* As wide as the two-figure count 1b holds its words at, whatever is typed. */}
                        <Button type="submit" busyLabel={COPY.working} holdWidthOf={COPY.submit(99)}>
                            {COPY.submit(readQuantity(count).count)}
                        </Button>
                    </DialogActions>
                </>
            )}
        </DialogFrame>
    );
}

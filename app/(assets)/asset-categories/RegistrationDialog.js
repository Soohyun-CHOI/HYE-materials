"use client";

import { startTransition, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Choice, Combobox, Field, NumberField } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import Dot from "@/app/components/Dot";
import { onlyJob } from "@/lib/assetJob";
import {
    ASSET_CATEGORY_COPY as CATALOG,
    catalogLevelValues,
    catalogRowsOf,
    findCatalogName,
    pathOf,
    suggestCatalogNames,
    walkDetails,
} from "@/lib/assetCategory";
import {
    MAX_ASSETS_PER_REGISTRATION,
    ASSET_REGISTRATION_COPY as COPY,
    detailRefusals,
    openingCount,
    readQuantity,
    readRegistration,
} from "@/lib/assetRegistration";
import { registerAssetsAction } from "./actions";

/**
 * The registration — adding assets to stock (#485) — as a dialog over the page that opens it
 * (#456), and the control that opens it. It was the form at `/tools/new` from #338 to #456.
 *
 * TWO STEPS SINCE #507, BECAUSE A REGISTRATION PICKS A KIND FROM THE CATALOG. The first finds
 * the name — a search over the catalog's names, which the type and the category narrow — and
 * picking one goes on to the second, which takes the levels the catalog holds under that name
 * (#514) — its size, maker and part number, each only where a row gives it one — the count and
 * the job, says the class of the kind they make, and submits. Design is drawing the two; until
 * then each is the closest the app draws: 0l's fields, the search being the one the tool's
 * name was typed in, the two filters 0l's choice side by side as the quantity and the job
 * stand, and the way back the sign-in steps' `Change` (0o), on the line under the title
 * beside what the first step picked. Nothing here creates a kind: the name typed on this
 * dialog from #338 was found or created as it was written, and the office keeps the catalog
 * in Airtable now.
 *
 * THE SECOND STEP IS `walkDetails`' ANSWER, DRAWN. Which levels it asks, what each offers under
 * the choices before it, which may be left empty — `No maker` first, and the level starting
 * on it — and which row they make are `lib/assetCategory.js`'s, asked again on every render of
 * what the reader chose; this holds the choices and nothing derived from them, so a choice a
 * choice before it took away is read there as never made, and no effect has to clear it.
 *
 * WHERE FOCUS GOES BETWEEN THE TWO IS THE FRAME'S RULE AND NOT A RULE OF ITS OWN. Opening, the
 * caret is in the search, the frame's first field that takes typing. A step that goes takes
 * what held focus with it — the search, or `Change` — and the frame puts focus that falls in
 * an open dialog on the first thing its body holds that can take it (#469): the first level
 * the second step asks, or the count where it asks none, and back on the first step the type.
 * THE FILTERS STAND ABOVE THE SEARCH because the search opens its list as it takes focus,
 * which the dialog's opening gives it: the list drops over whatever stands below, and the
 * filter under it was covered before it could be reached — seen at 1440 on #507's first
 * walk, the list over the whole field.
 *
 * THREE OPENERS, AND EACH HANDS OVER WHAT THE ADDRESS USED TO CARRY. The category list opens
 * it on no kind, so the first step picks one; a kind's own page opens it on that kind; and
 * the offer a registration that fell short makes opens it on that kind with the count it did
 * not write. Opened on a kind, the dialog starts at its second step with that kind's levels
 * already chosen — the catalog it is handed is that row alone, so each level it asks has one
 * value, already chosen (0l) — and nothing to pick: the kind's name is the line under the
 * title, the design's, and there is no way back, since what is added goes under the kind that
 * page is about — another is picked from the list's opener (#449, #451, #456, #514). Nothing
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
 * stays until the next press. The first step's one refusal is its own: Enter in the search,
 * with no suggestion under visual focus, takes the one name the search names and refuses a
 * name that names none or more than one. The second step's are each level still to choose,
 * `detailRefusals`', said under it beside the reading's.
 *
 * IT SUBMITS THROUGH `submit`, INSIDE A TRANSITION, which React follows with no reset of
 * the form (#449 read that in react-dom). The form carries no `action` prop: #449 kept one
 * for a press landing before hydration, and a dialog cannot be open before hydration —
 * the opener is a button whose press is a script — so there is no such press to catch.
 *
 * ITS COMMITMENT NAMES WHAT IT WILL ADD, AND SAYS SO WHILE IT DOES (#469, #485). The words
 * follow the count as it is typed, through `readQuantity` — the reading the press itself
 * makes — so `Add 5 tools` stands only over a count the press would take, and `Add tools`
 * over one it would refuse (1b). While the registration is on its way the frame is
 * `busy`: the commitment gives way to `Adding…` after 300ms, every other
 * control locks, and nothing is disabled, so focus stays where the press found it — and
 * stays there through a refusal, since the commitment can act again at once. The first step
 * has no commitment: picking a name is how it goes on.
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
 * A fact the dialog says rather than asks — the class of the kind the two steps made (#507):
 * a field's label over its value, the closest the app draws to a field with no control until
 * Design draws the step.
 */
function Stated({ label, children }) {
    return (
        <div className="flex min-w-0 flex-col">
            <span className="mb-gap text-body-sm font-medium text-foreground-default">{label}</span>
            <span className="text-body text-foreground-default">{children}</span>
        </div>
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
    // What the first step picked last: a name in its place, whose rows the second narrows
    // between. Opened on a category, nothing is picked and the row is the page's. `Change` goes
    // back to the first step and keeps it, so a pick can tell the name it had from another.
    const [picked, setPicked] = useState(null);
    const [choosing, setChoosing] = useState(true);
    // The first step's two filters, each a level's key, an empty one no filter (#514).
    const [filters, setFilters] = useState({ level1: "", level2: "" });
    const [typed, setTyped] = useState("");
    // What the reader chose on the second step, level by level — a value's key, or "" for a
    // level left empty — and nothing for a level not chosen, which starts where `walkDetails`
    // starts it (#514).
    const [chosen, setChosen] = useState({});
    const [count, setCount] = useState(() => String(openingCount(quantity)));
    // With one job it is already chosen, and with several nothing is (0l) — `onlyJob`, the
    // one spelling of "one assignment" the transition's dialog starts from too (#458).
    const [jobId, setJobId] = useState(onlyJob(jobs)?.id ?? "");
    const [listOpen, setListOpen] = useState(false);
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
    // The filters as they stand: a category the type chosen does not hold reads as none, so
    // changing the type never leaves the search narrowed to nothing it can say.
    const types = catalogLevelValues(catalog, "level1");
    const categories = catalogLevelValues(catalog, "level2", { level1: filters.level1 });
    const narrowing = { level1: filters.level1, level2: categories.some(({ key }) => key === filters.level2) ? filters.level2 : "" };
    // The second step: the rows it narrows between — the page's row alone, opened on one — the
    // levels it asks of them, and the row they make, which a page's row is from the start.
    const details = walkDetails(category ? catalog : picked ? catalogRowsOf(catalog, picked.key) : [], chosen);
    const made = category ?? details.category;

    // A name picked starts its levels afresh where they start (`walkDetails`), unless it is the
    // name the second step already held, which keeps what was chosen there. What it is handed
    // is a catalog name either way: Enter's lookup returns one, and each of the search's
    // suggestions is one, its label and place added for the list — so the second step can say
    // the levels it was picked by.
    const pick = (name) => {
        if (name.key !== picked?.key) setChosen({});
        setPicked(name);
        setChoosing(false);
        setTyped(name.level3);
        setGuarded(null);
    };
    const back = () => {
        setChoosing(true);
        setGuarded(null);
    };

    const submit = (event) => {
        event.preventDefault();
        setEdited(new Set());
        if (step === "name") {
            // Enter in the search with no suggestion under visual focus: the one name the
            // search names, under the filters chosen, or the first step's refusal.
            const found = findCatalogName(catalog, { filters: narrowing, typed });
            if (found) pick(found);
            else setGuarded({ fields: { level3: COPY.levelNoneChosen.level3 } });
            return;
        }
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
            return;
        }
        setGuarded(null);
        startTransition(() => formAction(formData));
    };

    // The line under the title: what the dialog is for while it picks, the kind it was opened
    // on, or the name the first step picked, in its place, with the way back to it (#507, #514).
    const subtitle = category ? (
        category.itemName
    ) : step === "details" ? (
        <>
            {picked.level3}
            <Dot />
            {pathOf({ level1: picked.level1, level2: picked.level2 })}
            <button
                type="button"
                aria-disabled={pending || undefined}
                onClick={pending ? undefined : back}
                className="ml-gap-lg font-semibold text-primary"
            >
                {COPY.changeName}
            </button>
        </>
    ) : (
        COPY.intro
    );

    return (
        <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.heading} subtitle={subtitle} onSubmit={submit}>
            <DialogBody>
                {step === "name" ? (
                    <>
                        <div className="grid grid-cols-2 gap-dialog-inline">
                            <Field label={CATALOG.levelLabel.level1} labelAs="span">
                                <Choice
                                    options={[
                                        { value: "", label: CATALOG.allOf.level1 },
                                        ...types.map(({ key, value }) => ({ value: key, label: value })),
                                    ]}
                                    value={narrowing.level1}
                                    onChange={(key) => setFilters((was) => ({ ...was, level1: key }))}
                                />
                            </Field>
                            <Field label={CATALOG.levelLabel.level2} labelAs="span">
                                <Choice
                                    options={[
                                        { value: "", label: CATALOG.allOf.level2 },
                                        ...categories.map(({ key, value }) => ({ value: key, label: value })),
                                    ]}
                                    value={narrowing.level2}
                                    onChange={(key) => setFilters((was) => ({ ...was, level2: key }))}
                                />
                            </Field>
                        </div>
                        <Field label={CATALOG.levelLabel.level3} refusal={refusalFor("level3")}>
                            <Combobox
                                value={typed}
                                onChange={edit("level3", setTyped)}
                                onPick={pick}
                                suggestions={suggestCatalogNames(catalog, { filters: narrowing, typed }).map((name) => ({
                                    ...name,
                                    label: name.level3,
                                    detail: pathOf({ level1: narrowing.level1 ? "" : name.level1, level2: narrowing.level2 ? "" : name.level2 }) || undefined,
                                }))}
                                placeholder={CATALOG.unchosen.level3}
                                listOpen={listOpen}
                                onListOpenChange={setListOpen}
                            />
                        </Field>
                    </>
                ) : (
                    <>
                        <input type="hidden" name="categoryRecordId" value={made?.id ?? ""} />
                        {details.levels
                            .filter(({ asked }) => asked)
                            .map(({ level, options, value }) => (
                                // A level's refusal stands while it holds nothing: a choice before it
                                // can leave it one value, already chosen, without the reader touching it.
                                <Field key={level} label={CATALOG.levelLabel[level]} labelAs="span" refusal={value === null ? refusalFor(level) : undefined}>
                                    <Choice
                                        options={options}
                                        value={value}
                                        onChange={edit(level, (key) => setChosen((was) => ({ ...was, [level]: key })))}
                                        placeholder={CATALOG.unchosen[level]}
                                    />
                                </Field>
                            ))}
                        {made?.assetClass && <Stated label={CATALOG.classLabel}>{made.assetClass}</Stated>}
                        <div className="grid grid-cols-[var(--width-number-input)_minmax(0,1fr)] gap-dialog-inline">
                            <Field
                                label={COPY.quantityLabel}
                                help={COPY.quantityHelp(MAX_ASSETS_PER_REGISTRATION)}
                                refusal={refusalFor("quantity")}
                            >
                                <NumberField
                                    name="quantity"
                                    value={count}
                                    onChange={edit("quantity", setCount)}
                                    min={1}
                                    max={MAX_ASSETS_PER_REGISTRATION}
                                />
                            </Field>
                            <Field label={COPY.jobLabel} labelAs="span" refusal={refusalFor("jobId")}>
                                <Choice
                                    name="jobId"
                                    options={jobs.map((job) => ({ value: job.id, label: job.jobCode }))}
                                    value={jobId}
                                    onChange={edit("jobId", setJobId)}
                                    placeholder={COPY.jobUnchosen}
                                />
                            </Field>
                        </div>
                    </>
                )}
            </DialogBody>
            <DialogActions refusal={said?.error}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                {step === "details" && (
                    <Button type="submit" busyLabel={COPY.working}>
                        {COPY.submit(readQuantity(count).count)}
                    </Button>
                )}
            </DialogActions>
        </DialogFrame>
    );
}

"use client";

import { startTransition, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Choice, Combobox, Field, NumberField } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import Dot from "@/app/components/Dot";
import { onlyJob } from "@/lib/toolJob";
import {
    TOOL_CATALOG_COPY as CATALOG,
    catalogCategories,
    catalogSizes,
    findCatalogName,
    onlySize,
    suggestCatalogNames,
} from "@/lib/toolCatalog";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    TOOL_REGISTRATION_COPY as COPY,
    openingCount,
    readQuantity,
    readRegistration,
} from "@/lib/toolRegistration";
import { registerToolItemsAction } from "./actions";

/**
 * The registration — adding tools to stock (#485) — as a dialog over the page that opens it
 * (#456), and the control that opens it. It was the form at `/tools/new` from #338 to #456.
 *
 * TWO STEPS SINCE #507, BECAUSE A REGISTRATION PICKS A KIND FROM THE CATALOG. The first finds
 * the tool — a search over the catalog's tools, which the category narrows — and picking one
 * goes on to the second, which takes its size, the count and the job, says the class of the
 * kind they make, and submits. Design is drawing the two; until then each is the closest the
 * app draws: 0l's fields, the search being the one the tool's name was typed in, and the way
 * back the sign-in steps' `Change` (0o), on the line under the title beside what the first
 * step picked. Nothing here creates a kind: the name typed on this dialog from #338 was found
 * or created as it was written, and the office keeps the catalog in Airtable now.
 *
 * WHERE FOCUS GOES BETWEEN THE TWO IS THE FRAME'S RULE AND NOT A RULE OF ITS OWN. Opening, the
 * caret is in the search, the frame's first field that takes typing. A step that goes takes
 * what held focus with it — the search, or `Change` — and the frame puts focus that falls in
 * an open dialog on the first thing its body holds that can take it (#469): the size, and back
 * on the first step the category. THE CATEGORY STANDS ABOVE THE SEARCH because the search
 * opens its list as it takes focus, which the dialog's opening gives it: the list drops over
 * whatever stands below, and the filter under it was covered before it could be reached —
 * seen at 1440 on the first walk, the list over the whole field.
 *
 * THREE OPENERS, AND EACH HANDS OVER WHAT THE ADDRESS USED TO CARRY. The tool list opens
 * it on no kind, so the first step picks one; a kind's own page opens it on that kind; and
 * the offer a registration that fell short makes opens it on that kind with the count it did
 * not write. Opened on a kind, the dialog starts at its second step with the size already the
 * kind's and nothing to pick: the kind's name is the line under the title, the design's, and
 * there is no way back, since what is added goes under the kind that page is about — another
 * is picked from the list's opener (#449, #451, #456). Nothing is written to the address to
 * open it, and nothing about where it was opened from is said inside it.
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
 * predicate, `canRegisterToolItems`, which the page asks and hands down as `canRegister`,
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
 * with no suggestion under visual focus, takes the one tool the name names and refuses a name
 * that names none or more than one.
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
 * has no commitment: picking a tool is how it goes on.
 *
 * IT CLOSES WHEN THE PAGE IT WAS OPENED ON MOVES, which is how a registration that lands
 * on the same kind's page — the page it was opened from — takes the dialog away: it is
 * open only while the address is the one it was opened at. Nothing else moves the address
 * while it is open, because a modal dialog leaves the page behind it inert. Each opening
 * starts from what the opener hands over, and not from what the last one was left holding.
 */
export default function RegistrationDialog({ opener, variant, canRegister, jobs, tool = null, catalog = [], quantity }) {
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
                    tool={tool}
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
 * `catalog` is the rows a registration may pick (`readCatalog`'s `offered`) — every one on
 * the list's dialog, and on a tool's own page that tool alone while the catalog offers it.
 * `tool` is the row a page opened it on, which skips the first step.
 */
export function RegistrationForm({ open, onClose, jobs, tool, catalog = [], quantity }) {
    const [state, formAction, pending] = useActionState(registerToolItemsAction, null);
    // What the first step picked last: a name under its category, whose sizes the second
    // offers. Opened on a tool, nothing is picked and the row is the page's. `Change` goes back
    // to the first step and keeps it, so a pick can tell the name it had from another.
    const [picked, setPicked] = useState(null);
    const [choosing, setChoosing] = useState(true);
    const [categoryKey, setCategoryKey] = useState("");
    const [typed, setTyped] = useState("");
    const [toolRecordId, setToolRecordId] = useState(tool ? tool.id : "");
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

    const step = tool || (picked && !choosing) ? "size" : "tool";
    const sizes = picked ? catalogSizes(catalog, picked.key) : [];
    const chosen = tool ?? sizes.find((candidate) => candidate.id === toolRecordId) ?? null;

    // A name picked starts its size where a choice starts (0l): the one size it is held in,
    // already chosen, or none of several. Picking the name the second step already held keeps
    // the size it was given; another name's sizes are another choice, so the one held goes.
    // What it is handed is a catalog name either way: Enter's lookup returns one, and each of
    // the search's suggestions is one, its label and category added for the list — so the
    // second step can say the levels it was picked by.
    const pick = (name) => {
        if (name.key !== picked?.key) setToolRecordId(onlySize(catalogSizes(catalog, name.key))?.id ?? "");
        setPicked(name);
        setChoosing(false);
        setTyped(name.level2);
        setGuarded(null);
    };
    const back = () => {
        setChoosing(true);
        setGuarded(null);
    };

    const submit = (event) => {
        event.preventDefault();
        setEdited(new Set());
        if (step === "tool") {
            // Enter in the search with no suggestion under visual focus: the one tool the
            // name names, under the category chosen, or the first step's refusal.
            const found = findCatalogName(catalog, { categoryKey, typed });
            if (found) pick(found);
            else setGuarded({ fields: { tool: COPY.toolNoneChosen } });
            return;
        }
        const formData = new FormData(event.currentTarget);
        const reading = readRegistration(
            { toolRecordId: formData.get("toolRecordId"), quantity: formData.get("quantity"), jobId: formData.get("jobId") },
            jobs,
            catalog
        );
        if (!reading.registration) {
            setGuarded(reading);
            return;
        }
        setGuarded(null);
        startTransition(() => formAction(formData));
    };

    // The line under the title: what the dialog is for while it picks, the kind it was opened
    // on, or the tool the first step picked with the way back to it (#507).
    const subtitle = tool ? (
        tool.toolName
    ) : step === "size" ? (
        <>
            {picked.level2}
            <Dot />
            {picked.level1}
            <button
                type="button"
                aria-disabled={pending || undefined}
                onClick={pending ? undefined : back}
                className="ml-gap-lg font-semibold text-primary"
            >
                {COPY.changeTool}
            </button>
        </>
    ) : (
        COPY.intro
    );

    return (
        <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.heading} subtitle={subtitle} onSubmit={submit}>
            <DialogBody>
                {step === "tool" ? (
                    <>
                        <Field label={CATALOG.categoryLabel} labelAs="span">
                            <Choice
                                options={[
                                    { value: "", label: CATALOG.allCategories },
                                    ...catalogCategories(catalog).map((category) => ({ value: category.key, label: category.level1 })),
                                ]}
                                value={categoryKey}
                                onChange={setCategoryKey}
                            />
                        </Field>
                        <Field label={CATALOG.toolLabel} refusal={refusalFor("tool")}>
                            <Combobox
                                value={typed}
                                onChange={edit("tool", setTyped)}
                                onPick={pick}
                                suggestions={suggestCatalogNames(catalog, { categoryKey, typed }).map((name) => ({
                                    ...name,
                                    label: name.level2,
                                    detail: categoryKey ? undefined : name.level1,
                                }))}
                                placeholder={CATALOG.toolUnchosen}
                                listOpen={listOpen}
                                onListOpenChange={setListOpen}
                            />
                        </Field>
                    </>
                ) : (
                    <>
                        {tool ? (
                            <input type="hidden" name="toolRecordId" value={tool.id} />
                        ) : (
                            <Field label={CATALOG.sizeLabel} labelAs="span" refusal={refusalFor("toolRecordId")}>
                                <Choice
                                    name="toolRecordId"
                                    options={sizes.map((size) => ({ value: size.id, label: size.size }))}
                                    value={toolRecordId}
                                    onChange={edit("toolRecordId", setToolRecordId)}
                                    placeholder={CATALOG.sizeUnchosen}
                                />
                            </Field>
                        )}
                        {chosen?.toolClass && <Stated label={CATALOG.classLabel}>{chosen.toolClass}</Stated>}
                        <div className="grid grid-cols-[var(--width-number-input)_minmax(0,1fr)] gap-dialog-inline">
                            <Field
                                label={COPY.quantityLabel}
                                help={COPY.quantityHelp(MAX_TOOL_ITEMS_PER_REGISTRATION)}
                                refusal={refusalFor("quantity")}
                            >
                                <NumberField
                                    name="quantity"
                                    value={count}
                                    onChange={edit("quantity", setCount)}
                                    min={1}
                                    max={MAX_TOOL_ITEMS_PER_REGISTRATION}
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
                {step === "size" && (
                    <Button type="submit" busyLabel={COPY.working}>
                        {COPY.submit(readQuantity(count).count)}
                    </Button>
                )}
            </DialogActions>
        </DialogFrame>
    );
}

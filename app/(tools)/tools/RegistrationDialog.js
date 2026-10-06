"use client";

import { Fragment, startTransition, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Choice, Combobox, Field, NoteEmphasis, NumberField } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import { onlyJob } from "@/lib/toolJob";
import { TOOL_LIST_COPY } from "@/lib/toolListView";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    TOOL_REGISTRATION_COPY as COPY,
    matchExistingTool,
    openingCount,
    readQuantity,
    readRegistration,
    suggestTools,
} from "@/lib/toolRegistration";
import { registerToolItemsAction } from "./actions";

/**
 * The registration — adding tools to stock (#485) — as a dialog over the page that opens it
 * (#456), and the control that opens it. It was the form at `/tools/new` from #338 to #456.
 *
 * THREE OPENERS, AND EACH HANDS OVER WHAT THE ADDRESS USED TO CARRY. The tool list opens
 * it on no tool, so the name is typed; a tool's own page opens it on that tool; and the
 * offer a registration that fell short makes opens it on that tool with the count it did
 * not write. Opened on a tool, the tool is the line under the title rather than a field —
 * the design's — and it is submitted as it stands, so what was a name the reader could
 * change there (#449, #451) is the tool the page is about now; another tool is typed from
 * the list's opener. Nothing is written to the address to open it, and nothing about
 * where it was opened from is said inside it, which is what #449's and #321's rules came
 * to once there is no address: a reload shows the page as it was, closed.
 *
 * THE OFFER'S OPENER STANDS IN A DIALOG OF ITS OWN SINCE #459, so it cannot be this
 * component: the offer puts itself away as the registration opens, and a control inside
 * a dialog that is gone cannot hold the one that replaced it. So the parts are exported —
 * `useRegistrationOpening` for the rule below, `RegistrationOpener` for the gate, and
 * `RegistrationForm` for the dialog — and this default export is them assembled for an
 * opener that stands on a page. Each is one implementation, whichever of the two draws it.
 *
 * AN EMPTY LIST DRAWS A SECOND OPENER, BORDERED, UNDER ITS SENTENCE (1a, 1b; #463) — another
 * of these beside the head's, `variant` its one difference — since a list with nothing in it
 * is where the reader who needs the dialog most is looking.
 *
 * A READER ON NO JOB MEETS EVERY OPENER DRAWN AND DISABLED, WITH WHY BEFORE IT (0f), and
 * the dialog never opens for them. What #451 kept is kept: no opener is hidden, and all
 * three ask one predicate, `canRegisterToolItems`, which the page asks and hands down as
 * `canRegister`. What moved is only where the reason is said — beside the control that
 * cannot act, rather than on a screen arrived at to be refused, which is also
 * `/invoices`' rule against landing a reader on a refusal.
 *
 * WHAT A SUBMISSION MAY BE IS ASKED BEFORE IT IS SENT, and asked of the same function the
 * action asks, `readRegistration`: a refusal about a field is said under that field and
 * sends nothing, and only a submission it takes reaches the server. The action asks again
 * with a fresh read of the reader's jobs. A refusal keeps everything typed — the fields
 * are this component's own state — and a field's refusal goes as soon as that field is
 * changed, where the one about the whole dialog stays until the next press.
 *
 * IT SUBMITS THROUGH `submit`, INSIDE A TRANSITION, which React follows with no reset of
 * the form (#449 read that in react-dom). The form carries no `action` prop: #449 kept one
 * for a press landing before hydration, and a dialog cannot be open before hydration —
 * the opener is a button whose press is a script — so there is no such press to catch.
 *
 * ITS COMMITMENT NAMES WHAT IT WILL ADD, AND SAYS SO WHILE IT DOES (#469, #485). The words
 * follow the count as it is typed, through `readQuantity` — the reading the press itself
 * makes — so `Add 5 tools` stands only over a count the press would take, and `Add tools`
 * over one it would refuse (1j). While the registration is on its way the frame is
 * `busy`: the commitment gives way to `Adding…` after 300ms, every other
 * control locks, and nothing is disabled, so focus stays where the press found it — and
 * stays there through a refusal, since the commitment can act again at once.
 *
 * IT CLOSES WHEN THE PAGE IT WAS OPENED ON MOVES, which is how a registration that lands
 * on the same tool's page — the page it was opened from — takes the dialog away: it is
 * open only while the address is the one it was opened at. Nothing else moves the address
 * while it is open, because a modal dialog leaves the page behind it inert. Each opening
 * starts from what the opener hands over, and not from what the last one was left holding.
 */
export default function RegistrationDialog({ opener, variant, canRegister, jobs, tool = null, quantity, tools = [] }) {
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
                    quantity={quantity}
                    tools={tools}
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

/** The note under a typed name: the preview, with the tool and its count in Ink. */
function preview(existing) {
    if (!existing) return COPY.newTool;
    const parts = COPY.matchesExisting({ toolName: existing.toolName, items: TOOL_LIST_COPY.total(existing.count) });
    return parts.map((part, index) =>
        typeof part === "string" ? <Fragment key={index}>{part}</Fragment> : <NoteEmphasis key={index}>{part.emphasis}</NoteEmphasis>
    );
}

/** The dialog itself, opened by whatever holds its opening. */
export function RegistrationForm({ open, onClose, jobs, tool, quantity, tools = [] }) {
    const [state, formAction, pending] = useActionState(registerToolItemsAction, null);
    const [toolName, setToolName] = useState(tool ? tool.toolName : "");
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

    // The list's suggestions and the note under the name are the list's dialog only: a
    // dialog opened on a tool has no name to type.
    const suggestions = tool ? [] : suggestTools(toolName, tools);
    const typed = toolName.trim();
    const note = tool || !typed || (listOpen && suggestions.length > 0) ? null : preview(matchExistingTool(typed, tools));

    const submit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const reading = readRegistration(
            { toolName: formData.get("toolName"), quantity: formData.get("quantity"), jobId: formData.get("jobId") },
            jobs
        );
        setEdited(new Set());
        if (!reading.registration) {
            setGuarded(reading);
            return;
        }
        setGuarded(null);
        startTransition(() => formAction(formData));
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={pending}
            title={COPY.heading}
            subtitle={tool ? tool.toolName : COPY.intro}
            onSubmit={submit}
        >
            <DialogBody>
                {tool ? (
                    <input type="hidden" name="toolName" value={tool.toolName} />
                ) : (
                    <Field label={COPY.nameLabel} note={note} refusal={refusalFor("toolName")} reserveMessage>
                        <Combobox
                            name="toolName"
                            value={toolName}
                            onChange={edit("toolName", setToolName)}
                            suggestions={suggestions.map((suggestion) => ({
                                label: suggestion.toolName,
                                detail: TOOL_LIST_COPY.total(suggestion.count),
                            }))}
                            placeholder={COPY.namePlaceholder}
                            listOpen={listOpen}
                            onListOpenChange={setListOpen}
                        />
                    </Field>
                )}
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
            </DialogBody>
            <DialogActions refusal={said?.error}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button type="submit" busyLabel={COPY.working}>
                    {COPY.submit(readQuantity(count).count)}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

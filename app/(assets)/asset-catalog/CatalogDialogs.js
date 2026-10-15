"use client";

import { useState, useTransition } from "react";
import { Button, Combobox, Field, SegmentedChoice, TextInput, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage, DialogSummary } from "@/app/components/DialogFrame";
import Dot from "@/app/components/Dot";
import { MenuButton } from "@/app/components/Menu";
import { ASSET_CLASS_VALUES, ASSET_TYPE_VALUES } from "@/lib/assetCategory";
import {
    ASSET_CATALOG_COPY as COPY,
    CATALOG_ENTRY_FIELDS,
    categorySuggestions,
    isNewCategory,
    isNewName,
    nameSuggestions,
    readCatalogEntry,
    readCategoryEntry,
    renamesItems,
    shownName,
} from "@/lib/assetCatalog";
import { addAssetCategoryGroupAction, removeAssetCategoryAction, saveAssetCategoryAction, setAssetCategoryDiscontinuedAction } from "./actions";

/*
 * The catalog's dialogs (1l, #527): one row added or edited, a category added alone, and the
 * question before a row nothing stands under is removed.
 *
 * ONE DIALOG FOR THE THREE ENTRIES, AS 1l DRAWS IT. `Add to catalog`, a row's name and `New
 * category` open the same fields — the type and the class as two segmented rows, the category
 * and the name as fields that suggest what the catalog holds, the size, the maker and the part
 * number a row may leave empty, and what the row shows as — and `New category` asks the type
 * and the category alone. Each opens fresh, its owner mounting it anew for every opening.
 *
 * WHAT A PRESS MAY SAVE IS `lib/assetCatalog.js`'s READING, ASKED HERE FIRST. A press the reading
 * refuses sends nothing and says each refusal under its field, focus going to the first (#522);
 * as 1l draws it, nothing is refused before the first press, and after it each refusal follows
 * what is typed. The action asks the same reading of the base as it is then, and what it refuses
 * by field stands under that field until the field changes.
 *
 * AN EDIT'S `Discontinue` AND `Restore` WRITE THE ROW AS IT STANDS AND CLOSE, as 1l draws them,
 * whatever the fields hold; while one works it says so, and the rest of the dialog locks with
 * it, the submit too (`lib/controls.js:buttonBusyState`). `More actions` stands only on a row
 * nothing stands under, and its one item hands the row to the question.
 *
 * EVERY CALL BINDS WHAT THE ACTION ANSWERS (#185): a refusal of the whole press is said over the
 * actions, and a press that wrote closes the dialog, the page drawn again with what it wrote.
 */

const TYPES = ASSET_TYPE_VALUES.map((value) => ({ value, label: value }));
const CLASSES = ASSET_CLASS_VALUES.map((value) => ({ value, label: value }));

/** What a dialog opens holding: the row's values for an edit, and 1l's first type and class with nothing typed for the other two. */
function openingValues(entry) {
    if (entry.mode === "edit") return Object.fromEntries(CATALOG_ENTRY_FIELDS.map((key) => [key, entry.row[key] ?? ""]));
    return { ...Object.fromEntries(CATALOG_ENTRY_FIELDS.map((key) => [key, ""])), level1: ASSET_TYPE_VALUES[0], assetClass: ASSET_CLASS_VALUES[0] };
}

/**
 * The dialog an entry opens (1l): `entry.mode` is `add`, `edit` — with the `row` it saves over —
 * or `category`. `rows` are the catalog's and `groups` the categories its types hold, which the
 * fields suggest from and the reading asks of; `onRemove` hands a row nothing stands under to
 * the question.
 */
export function EntryDialog({ entry, open, onClose, onRemove, rows, groups }) {
    const { mode, row } = entry;
    const category = mode === "category";
    const editing = mode === "edit" ? row.id : null;
    const [values, setValues] = useState(() => openingValues(entry));
    const [tried, setTried] = useState(false);
    // What the last press was answered: a sentence about the whole press, and refusals by
    // field, each standing until its field changes.
    const [refusal, setRefusal] = useState(null);
    const [answered, setAnswered] = useState({});
    // Which field's suggestions show, if any.
    const [listOpen, setListOpen] = useState(null);
    // What the dialog waits on: its submit, or `discontinue` or `restore`.
    const [working, setWorking] = useState(null);
    const [pending, startTransition] = useTransition();
    const focusRefused = useRefusalFocus();

    const reading = category ? readCategoryEntry(values, groups) : readCatalogEntry(values, { rows, groups, editing });
    const fields = { ...answered, ...(tried ? (reading.fields ?? {}) : {}) };
    const busy = pending ? (working === "submit" ? true : "action") : false;

    const set = (key) => (value) => {
        setValues((was) => ({ ...was, [key]: value }));
        setAnswered((was) => Object.fromEntries(Object.entries(was).filter(([field]) => field !== key)));
    };
    const list = (key) => ({
        listOpen: listOpen === key,
        onListOpenChange: (shown) => setListOpen((was) => (shown ? key : was === key ? null : was)),
    });

    // What the action answered a press: closed once it wrote, or the refusals by field it gave.
    const settle = (answer, form) => {
        if (answer?.done) {
            onClose();
            return;
        }
        if (answer?.fields) {
            setAnswered(answer.fields);
            focusRefused(form);
        }
    };

    const submit = (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setTried(true);
        setRefusal(null);
        setAnswered({});
        if (reading.fields) {
            focusRefused(form);
            return;
        }
        const formData = new FormData(form);
        setWorking("submit");
        startTransition(async () => {
            if (category) {
                const added = await addAssetCategoryGroupAction(null, formData);
                setRefusal(added?.error ?? null);
                settle(added, form);
                return;
            }
            const saved = await saveAssetCategoryAction(null, formData);
            setRefusal(saved?.error ?? null);
            settle(saved, form);
        });
    };

    const markDiscontinued = (discontinued) => {
        setRefusal(null);
        setWorking(discontinued ? "discontinue" : "restore");
        startTransition(async () => {
            const marked = await setAssetCategoryDiscontinuedAction(row.id, discontinued);
            setRefusal(marked?.error ?? null);
            if (marked?.done) onClose();
        });
    };

    // What a press would save once the reading takes it — a name the category holds spelled as
    // it holds it — and what is typed until then, so `Shows as` and the note say what is saved.
    const toSave = reading.entry ?? values;
    const shown = shownName(toSave);
    const newCategory = !fields.level2 && isNewCategory(values, groups);
    const newName = !fields.level3 && isNewName(values, rows);

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={busy}
            title={category ? COPY.newCategoryTitle : editing ? COPY.editTitle : COPY.addTitle}
            // An edit's line under its title: how many items stand under the row, after
            // `Discontinued` and 0e's dot for a row the office no longer buys (1l).
            subtitle={
                editing && (
                    <>
                        {row.discontinued && (
                            <>
                                {COPY.discontinued}
                                <Dot />
                            </>
                        )}
                        {COPY.itemCount(row.assetCount)}
                    </>
                )
            }
            onSubmit={submit}
            menu={
                editing &&
                row.assetCount === 0 && (
                    <MenuButton label={COPY.moreActions} locked={Boolean(busy)} items={[{ key: "remove", label: COPY.remove, tone: "danger", onSelect: () => onRemove(row) }]} />
                )
            }
        >
            {editing && <input type="hidden" name="categoryRecordId" value={row.id} />}
            <DialogBody>
                {/* The type, and beside it the class at 1l's 132 — the type alone for a category. */}
                <div className={`grid gap-dialog-inline ${category ? "" : "grid-cols-[minmax(0,1fr)_var(--width-catalog-class-field)]"}`}>
                    <Field label={COPY.fields.level1} labelAs="span" refusal={fields.level1}>
                        <SegmentedChoice name="level1" options={TYPES} value={values.level1} onChange={set("level1")} />
                    </Field>
                    {!category && (
                        <Field label={COPY.fields.assetClass} labelAs="span" refusal={fields.assetClass}>
                            <SegmentedChoice name="assetClass" options={CLASSES} value={values.assetClass} onChange={set("assetClass")} />
                        </Field>
                    )}
                </div>
                <Field label={COPY.fields.level2} refusal={fields.level2}>
                    <Combobox
                        name="level2"
                        value={values.level2}
                        onChange={set("level2")}
                        suggestions={categorySuggestions(values, groups).map((label) => ({ label }))}
                        placeholder={COPY.placeholders.level2}
                        {...list("level2")}
                        mark={newCategory ? { word: COPY.newMark, said: category ? COPY.newCategoryAlone : COPY.newCategory } : null}
                    />
                </Field>
                {!category && (
                    <>
                        <Field label={COPY.fields.level3} refusal={fields.level3}>
                            <Combobox
                                name="level3"
                                value={values.level3}
                                onChange={set("level3")}
                                suggestions={nameSuggestions(values, rows).map((label) => ({ label }))}
                                placeholder={COPY.placeholders.level3}
                                {...list("level3")}
                                mark={newName ? { word: COPY.newMark, said: COPY.newName } : null}
                            />
                        </Field>
                        <Field label={COPY.fields.size} labelNote={COPY.optional} refusal={fields.size}>
                            <TextInput name="size" autoComplete="off" value={values.size} onChange={set("size")} placeholder={COPY.placeholders.size} />
                        </Field>
                        <div className="grid grid-cols-2 gap-dialog-inline">
                            <Field label={COPY.fields.maker} labelNote={COPY.optional} refusal={fields.maker}>
                                <TextInput name="maker" autoComplete="off" value={values.maker} onChange={set("maker")} placeholder={COPY.placeholders.maker} />
                            </Field>
                            <Field label={COPY.fields.partNumber} labelNote={COPY.optional} refusal={fields.partNumber}>
                                <TextInput
                                    name="partNumber"
                                    autoComplete="off"
                                    value={values.partNumber}
                                    onChange={set("partNumber")}
                                    placeholder={COPY.placeholders.partNumber}
                                />
                            </Field>
                        </div>
                        {/* What the row shows as, the base's rule over what is typed, and Ink 4's
                            `Item name` while no name is (1l). */}
                        <DialogSummary>
                            <p className="flex min-w-0 flex-col gap-catalog-preview-stack">
                                <span className="text-heading-sm text-foreground-subtle">{COPY.showsAs}</span>
                                <span className={`truncate text-body font-semibold ${shown ? "text-foreground-default" : "text-foreground-faint"}`}>{shown || COPY.noName}</span>
                            </p>
                        </DialogSummary>
                    </>
                )}
            </DialogBody>
            <DialogActions
                refusal={refusal}
                note={editing && renamesItems(row, toSave) ? COPY.renames(row.assetCount) : null}
                secondary={
                    editing &&
                    (row.discontinued ? (
                        <Button variant="ghost" busy={pending && working === "restore"} busyLabel={COPY.working.restore} onClick={() => markDiscontinued(false)}>
                            {COPY.restore}
                        </Button>
                    ) : (
                        <Button variant="ghostDanger" busy={pending && working === "discontinue"} busyLabel={COPY.working.discontinue} onClick={() => markDiscontinued(true)}>
                            {COPY.discontinue}
                        </Button>
                    ))
                }
            >
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button type="submit" busyLabel={COPY.working[mode]}>
                    {COPY.submit[mode]}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

/**
 * The question before a row nothing stands under leaves the catalog (1l): its whole name in the
 * title, what removing it ends, and the red commitment. The action reads the row again first,
 * so one an item came to stand under since stays, and the question says why.
 */
export function RemoveDialog({ row, open, onClose }) {
    const [refusal, setRefusal] = useState(null);
    const [pending, startTransition] = useTransition();

    const submit = (event) => {
        event.preventDefault();
        setRefusal(null);
        startTransition(async () => {
            const removed = await removeAssetCategoryAction(row.id);
            setRefusal(removed?.error ?? null);
            if (removed?.done) onClose();
        });
    };

    return (
        <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.removeTitle(row.itemName)} onSubmit={submit}>
            <DialogBody>
                <DialogMessage>{COPY.removeSays}</DialogMessage>
            </DialogBody>
            <DialogActions refusal={refusal}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button variant="danger" type="submit" busyLabel={COPY.working.remove}>
                    {COPY.remove}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

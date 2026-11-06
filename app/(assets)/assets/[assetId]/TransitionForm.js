"use client";

import { useId, useState } from "react";
import { Button, Combobox, Field, SheetField, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import { ASSET_TRANSITION_COPY as COPY, fieldRefusals, matchedPart, namesAreRecent, offeredNames, readSubmission, recentNamesFor } from "@/lib/assetTransition";
import NameSheet from "./NameSheet";

/**
 * The check-out's dialog (1f, 1i; #458): who the asset goes to, and the commitment. The opener is
 * `TransitionDialog.js`'s; the page's provider draws this, so it stands across a page drawn again
 * (#614).
 *
 * IT SHOWS WHAT IT WAS OPENED ON AND ASKS THE PAGE AS IT IS. `plan` is the page the dialog was
 * opened from, held while it stands (`useHeldWhileOpen`), so its title, its event and its names do
 * not change under the reader; `available` is whether the page as it is still offers the event to
 * this reader. A refusal it did not offer — somebody got in front, the item retired, no longer the
 * reader's to record — leaves the commitment drawn, `unavailable` and described by the sentence over
 * the actions, as the files of 2026-11-05 draw the dialog in each (1f); one it still offers — the item
 * moved to another of the reader's jobs, the status left unwritten — leaves it live, and a second
 * press records on the page as it is now. Focus stays on the commitment the press left it on, and
 * whatever closes the dialog hands it back to the opener, or to the page's heading when the page drawn
 * again has taken the opener away (`DialogFrame.js`).
 */
export default function TransitionForm({ open, onClose, plan, available, assetId, drawnJobId, recentCheckOuts, pending, refusal, onSend, onCarry }) {
    const refusalId = useId();
    const [name, setName] = useState("");
    const [listOpen, setListOpen] = useState(false);
    const [naming, setNaming] = useState(false);
    // Which event a press asked for, as the foot bar keeps it: a refusal that flips the status
    // offers the other event, which nobody has pressed for yet.
    const [pressedFor, setPressedFor] = useState(null);
    const focusRefused = useRefusalFocus();

    // WHO THE ITEM'S JOB HAS RECENTLY HANDED ASSETS TO, NARROWED IN THE BROWSER (#376, #597). The
    // page read that job's rows; typing narrows them further.
    const recent = recentNamesFor(recentCheckOuts, { jobCode: plan.jobCode });
    const offered = offeredNames(recent, name);
    const pressed = pressedFor === plan.event;
    const refusals = fieldRefusals(plan, { checkedOutTo: name });

    const submit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const answer = readSubmission(plan, {
            event: String(formData.get("event") ?? ""),
            drawnJobId: String(formData.get("drawnJobId") ?? ""),
            checkedOutTo: String(formData.get("checkedOutTo") ?? ""),
        });
        if (answer.refusal) {
            setPressedFor(plan.event);
            focusRefused(event.currentTarget);
            return;
        }
        onSend(formData);
    };

    return (
        <>
            <DialogFrame
                open={open}
                onClose={onClose}
                onHidden={() => onCarry({ name })}
                busy={pending}
                title={COPY.control[plan.event]}
                onSubmit={submit}
                sheet
            >
                <input type="hidden" name="assetId" value={assetId} />
                <input type="hidden" name="drawnJobId" value={drawnJobId ?? ""} />
                {/* The event the page offered. The action re-derives it from the stored
                    status and compares — it never writes this value. */}
                <input type="hidden" name="event" value={plan.event} />
                <DialogBody>
                    <Field label={COPY.checkedOutToLabel} refusal={pressed ? refusals.nameRefusal : null}>
                        <div className="max-sm:hidden">
                            <Combobox
                                name="checkedOutTo"
                                value={name}
                                onChange={setName}
                                suggestions={offered.map((person) => ({ label: person, match: matchedPart(person, name) }))}
                                heading={namesAreRecent(name) ? COPY.recentHeading : undefined}
                                placeholder={COPY.namePlaceholder}
                                listOpen={listOpen}
                                onListOpenChange={setListOpen}
                            />
                        </div>
                        <SheetField value={name} placeholder={COPY.namePlaceholder} onOpen={() => setNaming(true)} />
                    </Field>
                </DialogBody>
                <DialogActions refusal={refusal} refusalId={refusalId}>
                    <Button variant="bordered" onClick={onClose}>
                        {COPY.cancel}
                    </Button>
                    <Button type="submit" unavailable={!available} describedBy={!available && refusal ? refusalId : undefined} busyLabel={COPY.working[plan.event]}>
                        {COPY.control[plan.event]}
                    </Button>
                </DialogActions>
            </DialogFrame>
            <NameSheet
                open={open && naming}
                onClose={() => setNaming(false)}
                value={name}
                onChange={setName}
                names={offered}
                hasRecent={recent.length > 0}
            />
        </>
    );
}

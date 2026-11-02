"use client";

import { useState } from "react";
import { Button, Combobox, Field, FormBusy, SheetField, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import {
    ASSET_TRANSITION_COPY as COPY,
    asksBeforeRecording,
    fieldRefusals,
    matchedPart,
    namesAreRecent,
    offeredNames,
    readSubmission,
    recentNamesFor,
} from "@/lib/assetTransition";
import NameSheet from "./NameSheet";
import { useRefusalSentence, useAssetTransition } from "./AssetTransition";

/**
 * The one transition this asset's status allows (#362), as a desk asks it: the press or
 * the opener in the page's header, and the dialog it opens when it has something to ask
 * (#458). A phone asks in its foot bar instead (`TransitionBar.js`, #463), and the page draws
 * this from the phone's edge up.
 *
 * A PRESS WHEN THERE IS NOTHING TO ASK, A DIALOG WHEN THERE IS. A check-out records who the
 * asset went to, so it always opens the design's dialog (1f); a check-in and a return from
 * repair record on the press (1g, 1f). `asksBeforeRecording` is the split, and the press and
 * the opener are one button, so a refusal that turns one into the other — it re-renders the
 * page in place (#378) — leaves the reader on the same control, which the frame hands focus
 * back to as the dialog goes.
 *
 * NO JOB SINCE #597 (1f, the files of 2026-11-02). The dialog asked for the job above the name
 * until then — chosen for a person on several jobs, with a sentence under it when the choice
 * would move the item — and a check-in opened a dialog of the job alone for such a person (1i,
 * gone from the files). Every event records on the item's own job now, and only a site manager
 * on that job is drawn this control, so the dialog is the name and the press asks nothing.
 * Each form posts the job the page was drawn on, which the action compares and never writes.
 *
 * A CONFIRMATION THAT IS ARRIVING, NOT ACTING, STILL HOLDS FOR THE PRESS (#362). A scan opens
 * the page, the page states the printed id and the status, and the press is the act — the
 * next scan undoes it, so a second tap on every one of them is friction people route around.
 * The dialog is what the design draws where the act needs an answer first.
 *
 * WHAT A SUBMISSION MAY BE IS `readSubmission`, ASKED BEFORE IT IS SENT AND AGAIN BY THE
 * ACTION. The dialog's commitment always acts (0l: "a commitment stays live while the form is
 * incomplete"), and a press `readSubmission` refuses sends nothing: a missing name says so
 * under its field, by `fieldRefusals` as the phone's foot bar does, and focus goes to it
 * (`useRefusalFocus`). Until #522 the commitment was held at 0f's 40% until the name was
 * given, the empty field the reason.
 *
 * THE ANSWER IS THE PAGE'S, NOT THIS CONTROL'S (#463). The press and the dialog send through
 * `AssetTransition`, which holds the action's answer and whether the dialog is open: a
 * refusal the dialog can stand open for — the status left unwritten — is said above its
 * actions, and every other stands in the page's title block, where the design says a refused
 * press (1k). A page drawn again on another job ends the opening (#597), so a press refused
 * because the item moved is said there too.
 *
 * AN ITEM IN REPAIR OFFERS ITS RETURN AS A PRESS (#531, 1f). While the menu's `Send for repair`
 * is on its way the press locks — its look kept, its press turned away — rather than drawing a
 * wait it is not doing.
 *
 * A PRESS THAT LANDS LEAVES FOCUS ON THE DOCUMENT, as #362's form did: the redirect remounts
 * the page and brings nothing back. A dialog's landing reaches the heading only because the
 * frame's dialog was open as the tree went.
 *
 * TWO WIDTHS IN THE DIALOG, AND EACH ASKS IN ITS OWN DRAWING. At a desk the name is the
 * registration's own combobox (1b), its suggestions the item's job's recent names under
 * `Recently at this job` — the head while nothing is typed, and once somebody types, the names
 * that match with the matching part at 600 and no head (1f, #495). Below the phone's edge the
 * frame is Tools 0a's sheet, and the name is a field that opens 1j's name sheet. One state
 * behind both, so the field behind the sheet and the sheet are one value.
 *
 * ON THIS PAGE THAT SHEET IS NEVER SEEN. The row the press stands in is hidden below the
 * phone's edge, where the foot bar asks instead (#463), and a dialog left open as the window
 * narrows past it went with the row while it stayed modal — measured at 375: `:modal`, and
 * no box. Since #495 the frame closes it there, and the name it was given goes to the foot
 * bar (`AssetTransition.js`), so a phone turned upright mid-check-out keeps it.
 *
 * A SUBMISSION IN FLIGHT IS SAID IN WHAT SENT IT (#469). The frame is `busy` while the
 * dialog's event is on its way, so the commitment keeps its fill and after 300ms gives its
 * label way to `Checking out…`, every other control locks with it, and the frame will not
 * close. **The press says it the same way since #463** — 0f's Working, its fill kept and its
 * event's `-ing` word after the wait — where it was disabled while it sent, which gave focus
 * up to the document before the answer came.
 *
 * EVERY STRING COMES FROM `ASSET_TRANSITION_COPY`, which `offline/asset-list-view.mjs` holds by
 * failing on any JSX text under app/(assets)/.
 */
export default function TransitionDialog({ recentCheckOuts }) {
    const { plan, assetId, drawnJobId, answer, formAction, pending, repairPending, send, sends, open, opening, openDialog, closeDialog, carry } =
        useAssetTransition();
    const refusal = useRefusalSentence(answer);
    const asks = asksBeforeRecording(plan);

    return (
        <>
            <form
                action={asks ? undefined : formAction}
                onSubmit={(event) => {
                    if (!asks) {
                        sends(plan.event);
                        return;
                    }
                    event.preventDefault();
                    openDialog();
                }}
            >
                {/* THE PRESS POSTS WHAT IT RECORDS: the event the page offered, which the action
                    compares and never writes, and the job the page was drawn on, compared the same
                    way (#597). The opener posts nothing — what it opens asks first. */}
                {!asks && (
                    <>
                        <input type="hidden" name="assetId" value={assetId} />
                        <input type="hidden" name="drawnJobId" value={drawnJobId ?? ""} />
                        <input type="hidden" name="event" value={plan.event} />
                    </>
                )}
                <FormBusy busy={repairPending ? "action" : false}>
                    <Button type="submit" busy={!asks && pending} busyLabel={asks ? undefined : COPY.working[plan.event]}>
                        {COPY.control[plan.event]}
                    </Button>
                </FormBusy>
            </form>
            {asks && (
                <TransitionForm
                    key={opening}
                    open={open}
                    onClose={closeDialog}
                    plan={plan}
                    assetId={assetId}
                    drawnJobId={drawnJobId}
                    recentCheckOuts={recentCheckOuts}
                    pending={pending}
                    refusal={open ? refusal : null}
                    onSend={send}
                    onCarry={carry}
                />
            )}
        </>
    );
}

/** The dialog itself: who the asset goes to, and the commitment. */
function TransitionForm({ open, onClose, plan, assetId, drawnJobId, recentCheckOuts, pending, refusal, onSend, onCarry }) {
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
                <DialogActions refusal={refusal}>
                    <Button variant="bordered" onClick={onClose}>
                        {COPY.cancel}
                    </Button>
                    <Button type="submit" busyLabel={COPY.working[plan.event]}>
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

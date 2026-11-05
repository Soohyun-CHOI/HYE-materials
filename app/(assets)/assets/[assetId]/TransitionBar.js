"use client";

import { useState } from "react";
import BottomBar from "@/app/components/BottomBar";
import { Button, Field, FormBusy, SheetField, useRefusalFocus } from "@/app/components/Controls";
import Icon from "@/app/components/Icon";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_TRANSITION_COPY as COPY, fieldRefusals, offeredNames, readSubmission, recentNamesFor } from "@/lib/assetTransition";
import NameSheet from "./NameSheet";
import { useAssetTransition } from "./AssetTransition";

/**
 * The one transition this asset's status allows, as a phone asks it (#463): 1j's foot
 * bar, Tools 0a's, which the sign-in steps drew first (#473) — for a check-out who it goes
 * to, and the press, rows 12 apart at the screen's foot and riding on the keyboard.
 *
 * THE NAME FIELD STAYS ON THE PAGE AND OPENS 1j's NAME SHEET, which #458 built as a part for
 * exactly this: the people the item's job has recently handed assets to under the field a
 * phone types in. A check-in and a return from repair have nothing to ask, so the bar is the
 * press, and the press records.
 *
 * NO JOB SINCE #597 (1j-a, the files of 2026-11-02). The bar led with the job as a pill until
 * then — stated for a person on one job, a sheet to choose from for one on several — because a
 * scan recorded on the reader's job and could move the item to it. Every event records on the
 * item's own job now, and only a site manager on that job is drawn a bar at all, so there is
 * no job to ask: the form posts the one the page was drawn on, for the action to compare.
 *
 * THE PRESS ACTS WHATEVER IS MISSING, AND SAYS WHAT IS (1k). A desk's dialog does the same
 * since #522 (0l); a press with no name is answered under the field, by `fieldRefusals`, the
 * reading `readSubmission` makes, and focus goes to the field (`useRefusalFocus`, 1k-b).
 * Nothing is sent until that refuses nothing, and the action asks again. A refusal stands
 * until the field holds what it asked for, and a refusal of the press itself is said in the
 * title block (`TransitionRefusal.js`), not here.
 *
 * WHILE THE PRESS IS ON ITS WAY THE BAR IS BUSY (#469's rule, here #463's): the press keeps
 * its fill and shows the phone's spinner alone, Tools 0a's Busy, and the field locks — it
 * keeps its look and opens nothing. Nothing is disabled, so focus stays on the press.
 *
 * AN ITEM IN REPAIR IS THE PRESS ALONE (#531, 1j-e): `Return from repair`. While the menu's
 * `Send for repair` is on its way the bar locks, every control in it, rather than drawing
 * a wait it is not doing.
 *
 * WITH NOTHING TO RECORD THE BAR SAYS WHY, in the press's place: a retired asset (1j-c).
 * **Below the phone's edge and nowhere else**, which the bar's own class decides, so the
 * sticky bar is not held inside a wrapper of its own. **A reader who does not record on this
 * item has no bar at all (#506, #597)** — one who is not a site manager, or a site manager on
 * another job or on none, as 1j-d draws it: their plan offers nothing and says nothing, so there
 * is neither a press nor a reason to stand in its place. **A press the re-render takes away
 * leaves focus on the document**, seen for a reader whose mark went while the page stood
 * (#506); a press on an asset another tab retired gives way to the sentence the same way, and
 * was not tried.
 *
 * IT TAKES WHAT A DESK'S DIALOG WAS GIVEN WHEN THE WINDOW CROSSES INTO IT (#495): the name
 * `carried` from the dialog the frame closed, each handing-over taken once. Its own sheet is
 * inside it, so the frame closes one left open as the window widens past the edge and the bar
 * hides — what it held is the bar's already.
 */
export default function TransitionBar({ recentCheckOuts }) {
    const { plan, assetId, drawnJobId, pending, repairPending, send, carried } = useAssetTransition();
    const [name, setName] = useState("");
    const [taken, setTaken] = useState(null);
    if (carried !== taken) {
        setTaken(carried);
        if (carried) setName(carried.name);
    }
    const [naming, setNaming] = useState(false);
    // Which event a press asked for. A refusal that flips the status offers the other event
    // and the field that goes with it, which nobody has pressed for yet.
    const [pressedFor, setPressedFor] = useState(null);
    const focusRefused = useRefusalFocus();

    if (plan.refusal) {
        return (
            <BottomBar stack={null} bleed={false} phoneOnly>
                <p className="text-mobile-body text-pretty text-foreground-subtle">{plan.refusal}</p>
            </BottomBar>
        );
    }
    if (!plan.event) return null;

    const asksName = plan.event === ASSET_EVENT.CHECKED_OUT;
    // The names the item's own job has handed assets to (#376, #597).
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
        send(formData);
    };

    return (
        <BottomBar stack={null} bleed={false} phoneOnly>
            <form onSubmit={submit} className="flex flex-col gap-mobile-bottom-bar-stack">
                <input type="hidden" name="assetId" value={assetId} />
                <input type="hidden" name="drawnJobId" value={drawnJobId ?? ""} />
                <input type="hidden" name="event" value={plan.event} />
                {asksName && <input type="hidden" name="checkedOutTo" value={name} />}
                <FormBusy busy={repairPending ? "action" : pending}>
                    {asksName && (
                        <Field label={COPY.checkedOutToLabel} labelAs="span" labelHidden size="xl" refusal={pressed ? refusals.nameRefusal : null}>
                            <SheetField
                                value={name}
                                placeholder={COPY.checkedOutToLabel}
                                icon={<Icon name="user" className="size-full" />}
                                onOpen={() => setNaming(true)}
                                onClear={() => setName("")}
                                clearLabel={COPY.clearName}
                            />
                        </Field>
                    )}
                    <Button type="submit" size="xl" busyLabel={COPY.working[plan.event]}>
                        {COPY.control[plan.event]}
                    </Button>
                </FormBusy>
            </form>
            {asksName && (
                <NameSheet
                    open={naming}
                    onClose={() => setNaming(false)}
                    value={name}
                    onChange={setName}
                    names={offered}
                    hasRecent={recent.length > 0}
                />
            )}
        </BottomBar>
    );
}

"use client";

import { SheetInput } from "@/app/components/Controls";
import { DialogFrame, SheetRows } from "@/app/components/DialogFrame";
import { textMatchKey } from "@/lib/itemNaming";
import { ASSET_TRANSITION_COPY as COPY, matchedPart, namesAreRecent } from "@/lib/assetTransition";

/**
 * 1j's name sheet (#458) — who an asset goes to, typed or picked, in Tools 0a's Sheet that
 * holds a field: the title `Checked out to` with `Done` at its end, the one field under
 * it, and the people this job has recently handed assets to.
 *
 * A PART, DRAWN AS 1j DRAWS IT AND OPENED BY WHATEVER ASKS FOR A NAME. The check-out's
 * dialog opens it from its name field below the phone's edge, where a desk types into the
 * field and is offered the same names under it; #463's foot bar — 1j's, which takes
 * #473's — opens it from its own name field. It holds no name of its own: `value` is the
 * opener's, and every keystroke and pick is handed back through `onChange`, so the field
 * behind it and this one are one value (#376) and putting the sheet away loses nothing.
 *
 * WHY A SHEET AT ALL ON A PHONE. The keyboard rises over the foot of the screen, so the
 * field a person types into stands at the top of a sheet with the names under it, rather
 * than at the foot of the page under the keyboard. A press opens it, never focus, which
 * #376 found in a browser: closing hands focus back to the opener, and opening on focus
 * reopened it the moment it shut.
 *
 * THE FIELD IS 0a's ONE FIELD IN A SHEET, `SheetInput` since the note sheet typed into it too
 * (#533): filled at Ink 5.5% with no edge, 50 tall, 16 inside, its value at 16 and an Accent
 * caret, and a clear × at its end once it holds a value. The caret is in it as the sheet opens,
 * the frame's rule for the first field that takes typing, so the keyboard is up; the
 * keyboard's `done` key puts the sheet away as `Done` does.
 *
 * THE LIST IS ABOUT A JOB, SO IT IS ABSENT UNTIL ONE IS CHOSEN — not empty, absent, heading
 * and all (#376). A job nothing has gone out on says so in place of the rows. Typing narrows
 * the rows `names` hands in (`offeredNames`), the list a desk is offered under its field, and
 * a name that matches none leaves no list at all, heading and all, as the desk's closes; the
 * row naming the person already typed is checked, on the fold the whole app compares people's
 * names on (`textMatchKey`). The heading names the recent list, so it stands only while
 * nothing is typed, and a typed fragment's match in each row is set at 600 (1j, #495).
 *
 * IT CLOSES ON A PRESS ON WHAT LIES BEHIND IT AND ON ITS HANDLE, both of which 1j draws, and
 * on a drag down — the frame's, for every sheet that draws a handle (#580).
 */
export default function NameSheet({ open, onClose, value, onChange, names, jobChosen, hasRecent }) {
    const typed = textMatchKey(value);

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            title={COPY.checkedOutToLabel}
            sheet
            closesOnBackdrop
            done={{ label: COPY.sheetDone, onPress: onClose }}
        >
            <div className="flex min-h-0 flex-col">
                <div className="shrink-0 px-mobile-gutter pb-mobile-drawer-title-inset-y">
                    <SheetInput
                        value={value}
                        onChange={onChange}
                        onDone={onClose}
                        placeholder={COPY.namePlaceholder}
                        label={COPY.checkedOutToLabel}
                        clearLabel={COPY.clearName}
                    />
                </div>
                {jobChosen && names.length > 0 && (
                    <>
                        {namesAreRecent(value) && (
                            <p className="shrink-0 px-mobile-drawer-row-inset-x pb-mobile-drawer-heading-stack text-mobile-heading-sm text-foreground-subtle">
                                {COPY.recentHeading}
                            </p>
                        )}
                        <SheetRows
                            rows={names.map((name) => ({
                                key: name,
                                label: name,
                                match: matchedPart(name, value),
                                chosen: typed !== "" && textMatchKey(name) === typed,
                                onPress: () => {
                                    onChange(name);
                                    onClose();
                                },
                            }))}
                        />
                    </>
                )}
                {jobChosen && !hasRecent && (
                    <p className="px-mobile-drawer-row-inset-x py-mobile-drawer-row-inset-y text-mobile-body text-foreground-subtle">
                        {COPY.noRecentNames}
                    </p>
                )}
            </div>
        </DialogFrame>
    );
}

"use client";

import { DialogFrame, SheetRows } from "@/app/components/DialogFrame";

/**
 * 1f's job sheet (#458) — Tools 0a's Sheet of the jobs a person may record an event on,
 * the chosen one checked, and a press on a row chooses it and puts the sheet away.
 *
 * A PART, DRAWN AS 1f DRAWS IT AND OPENED BY WHATEVER HOLDS A JOB. The check-out's and the
 * several-job check-in's dialogs open it from their `Job` field below the phone's edge,
 * where a desk opens 0a's list instead; #463's foot bar — 1f's, which takes #473's — opens
 * it from its job pill, and nothing here knows which one did. It asks nothing of its
 * opener but the options, the one chosen and what to do with a choice.
 *
 * IT CLOSES ON A PRESS ON WHAT LIES BEHIND IT, which 1f draws and the frame gives a sheet
 * that says so: a sheet of rows holds nothing a stray press could lose. Escape closes it,
 * as every dialog on the frame does, and focus goes back to the field that opened it.
 *
 * EVERY WORD IS HANDED IN — the title is the field's own label — so this file holds none.
 */
export default function JobSheet({ open, onClose, title, options, value, onChoose }) {
    return (
        <DialogFrame open={open} onClose={onClose} title={title} sheet closesOnBackdrop>
            <SheetRows
                rows={options.map((option) => ({
                    key: option.value,
                    label: option.label,
                    chosen: option.value === value,
                    onPress: () => {
                        onChoose(option.value);
                        onClose();
                    },
                }))}
            />
        </DialogFrame>
    );
}

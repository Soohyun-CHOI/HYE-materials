"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage, DialogSummary } from "@/app/components/DialogFrame";
import { TOOL_REGISTRATION_COPY as COPY, accountToTell } from "@/lib/toolRegistration";

// Which of the tool items a registration wrote have no first log row, said where it
// lands (#449) — and, since #455, dismissed there. A NOTICE AND NOT A FORK: nothing
// repairs these, because a log row written late would state a time that is not when the
// tool was created, so there is nothing to choose and the one control answers nothing.
// `Got it` is the design's, and it takes the notice away and nothing else.
//
// A DIALOG OVER THE PAGE SINCE #459, THE DESIGN'S 1k: the count is its title, the tool
// the line under it, one sentence, and the ids in the dialog's summary, each in the id
// face. It is 0l's dialog that only informs, so its one action is `Got it`, filled, and
// the close and Escape answer it too. When a landing carries the fork as well this is
// told first — `accountToTell` has why — and it is open while the page found these ids
// and `unlogged` is still on the address, which is the fork's reason for reading the
// address rather than keeping a flag, and the header there has it.
//
// THEY ARE ALSO IN THE LIST, SELECTED WITH THE REST, because they were written and need
// labels. This names them so a reader knows which ones they are; it does not fold them
// into the list, which would read them as created cleanly.
//
// THE DISMISSAL EDITS THE CURRENT ADDRESS AND ONE KEY OF IT, for the fork's reason: the
// list's boxes rewrite the address without a render, so an address rebuilt from this
// render would put back a selection the reader has changed. It deletes `unlogged` and
// nothing else, so the fork keeps its own question until that is answered, and opens as
// this closes. `history.replaceState` rather than the router — a navigation renders the
// page again to take away a notice.
//
// NO PRESS OPENED IT, so it is `unprompted` and hands focus to the page's heading as it
// closes (`DialogFrame.js`); the fork, opening as it closes, takes focus as it opens.
//
// EVERY WORD IS `TOOL_REGISTRATION_COPY`'s, as the fork's are.
export default function RegistrationUnlogged({ toolName, account }) {
    const address = useSearchParams();
    const told = accountToTell(account, address) === "unlogged";
    const toolItemIds = account.unlogged;

    const gotIt = () => {
        const current = new URL(window.location.href);
        current.searchParams.delete("unlogged");
        window.history.replaceState(null, "", `${current.pathname}${current.search}`);
    };

    return (
        <DialogFrame
            open={told}
            onClose={gotIt}
            unprompted
            title={COPY.unloggedHeading(toolItemIds.length)}
            subtitle={toolName}
        >
            <DialogBody>
                <DialogMessage>{COPY.unlogged(toolItemIds.length)}</DialogMessage>
                <DialogSummary>
                    <ul className="flex flex-col gap-dialog-summary-stack">
                        {toolItemIds.map((toolItemId) => (
                            <li key={toolItemId} className="font-id text-body tracking-id text-foreground-default">
                                {toolItemId}
                            </li>
                        ))}
                    </ul>
                </DialogSummary>
            </DialogBody>
            <DialogActions>
                <Button onClick={gotIt}>{COPY.gotIt}</Button>
            </DialogActions>
        </DialogFrame>
    );
}

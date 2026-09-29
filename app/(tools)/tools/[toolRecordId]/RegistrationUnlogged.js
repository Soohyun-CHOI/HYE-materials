"use client";

import { useState } from "react";
import { TOOL_REGISTRATION_COPY as COPY } from "@/lib/toolRegistration";

// Which of the tool items a registration wrote have no first log row, said where it
// lands (#449) — and, since #455, dismissed there. A NOTICE AND NOT A FORK: nothing
// repairs these, because a log row written late would state a time that is not when the
// tool was created, so there is nothing to choose and the one control answers nothing.
// `Got it` is the design's, and it takes the notice away and nothing else.
//
// THEY ARE ALSO IN THE LIST, SELECTED WITH THE REST, because they were written and need
// labels. This names them so a reader knows which ones they are; it does not fold them
// into the list, which would read them as created cleanly.
//
// THE DISMISSAL EDITS THE CURRENT ADDRESS AND ONE KEY OF IT, for the fork's reason: the
// list's boxes rewrite the address without a render, so an address rebuilt from this
// render would put back a selection the reader has changed. It deletes `unlogged` and
// nothing else, so the fork beside it keeps its own question until that is answered.
// `history.replaceState` rather than the router — a navigation renders the page again to
// take away a notice.
//
// EVERY WORD IS `TOOL_REGISTRATION_COPY`'s, as the fork's are.
export default function RegistrationUnlogged({ toolItemIds }) {
    const [done, setDone] = useState(false);
    if (done) return null;

    const dismiss = () => {
        const address = new URL(window.location.href);
        address.searchParams.delete("unlogged");
        window.history.replaceState(null, "", `${address.pathname}${address.search}`);
        setDone(true);
    };

    return (
        <div>
            <p>{COPY.unloggedHeading(toolItemIds.length)}</p>
            <p>{COPY.unlogged(toolItemIds.length)}</p>
            <ul>
                {toolItemIds.map((toolItemId) => (
                    <li key={toolItemId}>{toolItemId}</li>
                ))}
            </ul>
            <button type="button" onClick={dismiss}>
                {COPY.gotIt}
            </button>
        </div>
    );
}

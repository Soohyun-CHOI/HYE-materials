"use client";

import Link from "next/link";
import { useState } from "react";
import { TOOL_REGISTRATION_COPY as COPY } from "@/lib/toolRegistration";
import { registerPath } from "@/lib/toolRoutes";

// What a registration that fell short offers where it lands (#449): write the rest, or
// be done. A FORK AND NOT A NOTICE, and the difference is what the markup carries — two
// controls, where the notice beside it, naming tool items with no history, carries
// none, because nothing repairs those.
//
// `Register the other N` OPENS THE FORM WITH THIS TOOL'S NAME AND THE COUNT FILLED IN
// (`registerPath`), both still the person's to change there. `Done registering` IS THE
// OTHER ANSWER, AND IT ENDS THE QUESTION: the fork goes, and so does `unwritten` from
// the address, so a reload does not ask again. The two are a pair on purpose — one
// goes on registering and one stops — which is what says the choice is about the
// shortfall and not about the notice.
//
// THE DISMISSAL EDITS THE CURRENT ADDRESS AND ONE KEY OF IT. The list's boxes rewrite
// the address without a render (`ToolItemList.js`'s header has why), so an address
// built from anything this render was handed would put back a selection the reader has
// since changed. It deletes `unwritten` and nothing else: the page, the selection and
// the notice's `unlogged` stay where they are. `history.replaceState` rather than the
// router, for #443's reason — a navigation renders the page again, four operations to
// take away one sentence.
//
// NOT A MODAL. `Done registering` acts on nothing in the base, and CLAUDE.md keeps a
// modal for an act that cannot be undone.
//
// EVERY WORD IS `TOOL_REGISTRATION_COPY`'s, this axis's rule since #338: they are a
// registration's words wherever they are drawn, which is also why the fork is a file of
// its own rather than part of the list.
export default function RegistrationShortfall({ toolName, unwritten }) {
    const [done, setDone] = useState(false);
    if (done) return null;

    const finish = () => {
        const address = new URL(window.location.href);
        address.searchParams.delete("unwritten");
        window.history.replaceState(null, "", `${address.pathname}${address.search}`);
        setDone(true);
    };

    return (
        <div>
            <p>{COPY.shortfall(unwritten)}</p>
            <Link href={registerPath({ toolName, quantity: unwritten })}>{COPY.registerOthers(unwritten)}</Link>
            <button type="button" onClick={finish}>
                {COPY.doneRegistering}
            </button>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { PassingToast } from "@/app/components/Toast";
import { ASSET_REGISTRATION_COPY as COPY, REGISTRATION_SENT_KEY, addedToTell } from "@/lib/assetRegistration";

/**
 * What a registration that wrote everything says on landing (#617): `5 items added.` for a moment,
 * 12 over the selection bar and centered on the list, as Tools 57 draws 1c's `All written`.
 *
 * IT TAKES THE DIALOG'S MARK, AND NOTHING ON THE ADDRESS. The dialog leaves a mark in the tab's own
 * storage as it sends; each selection this list is drawn with takes the mark away as it reads it,
 * so the toast says one send once, and a reload, a copied link or a press on a box finds none.
 * Whether to say anything, and how many, is `addedToTell`'s; a landing that fell short is told by
 * its dialogs and takes the mark all the same.
 */
export default function RegistrationAdded({ selected, unwritten, unlogged }) {
    const [told, setTold] = useState({ selection: "", count: 0 });
    const selection = selected.join(" ");
    useEffect(() => {
        let sentAt = Number.NaN;
        try {
            const mark = window.sessionStorage.getItem(REGISTRATION_SENT_KEY);
            if (mark !== null) sentAt = Number(mark);
            window.sessionStorage.removeItem(REGISTRATION_SENT_KEY);
        } catch {
            // No storage, as in a private window: no landing is told.
        }
        const count = addedToTell({ sentAt, now: Date.now(), selected: selected.length, unwritten, unlogged });
        // The mark is the browser's alone, so it is read once the list stands, never in the render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTold({ selection, count });
        // `selection` is what a landing differs by; the other two ride with it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selection]);
    if (told.count === 0 || told.selection !== selection) return null;
    return <PassingToast key={selection} line={COPY.added(told.count)} className="absolute bottom-full left-1/2 mb-added-toast-offset -translate-x-1/2" />;
}

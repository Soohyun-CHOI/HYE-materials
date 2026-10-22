"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Refusal } from "@/app/components/Controls";
import { ASSET_EXPORT_COPY as COPY } from "@/lib/assetListExport";
import { readerTimeZone } from "@/lib/format";
import { exportAssetListAction } from "./actions";

/**
 * 1a's `Export` (#553): the list as an Excel file, downloaded where the reader's browser saves.
 *
 * IT SENDS THE ADDRESS THE LIST IS SHOWING, AND THE SERVER ANSWERS IT. The band writes what it
 * holds into the address on every change (`AssetCategoryList.js`), so the address is what the
 * reader sees — the job, the search and the chips — and `useSearchParams` reads it back; the
 * action asks the list's own functions of it (`readCategoryList`). Nothing the browser holds is
 * trusted for what the file contains: the rows are read again on the server, for this reader.
 * The browser's zone goes with it, for the file's days.
 *
 * NOTHING IS READ UNTIL THE PRESS. The list's page draws this and reads nothing for it, so a view
 * costs what it cost (#560); the press is the read.
 *
 * BUSY WHILE THE FILE IS MADE (0f Working): the button keeps its width, turns a second press
 * away, and after 0f's wait shows the spinner over its word with `Exporting…` heard; its name
 * is `Export to Excel` at rest. The file arrives as a download, which says the press worked, so
 * nothing else is said (#321).
 *
 * A PRESS THAT MADE NO FILE SAYS SO BEFORE THE BUTTON, ON ITS LINE (#553): the action's `{ error }`
 * or a request that never came back, in the words the app's other refusals of a press take —
 * `Couldn't export the list. Try again.` — in `Refusal`'s look, where 0f sets a reason for a
 * control. It stays until the next press. The files draw no failure; `design-copy-findings.md`
 * records the line.
 */
export default function ListExport() {
    const params = useSearchParams();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    const press = async () => {
        setBusy(true);
        setFailed(false);
        try {
            const answer = await exportAssetListAction(params.toString(), readerTimeZone());
            if (!answer?.bytes) throw new Error(answer?.error ?? "no file");
            const url = URL.createObjectURL(new Blob([answer.bytes], { type: answer.type }));
            const link = document.createElement("a");
            link.href = url;
            link.download = answer.fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex items-center gap-gap-lg">
            {failed && <Refusal>{COPY.failed}</Refusal>}
            <Button variant="bordered" busy={busy} busyLabel={COPY.working} ariaLabel={busy ? undefined : COPY.exportName} onClick={press}>
                {COPY.export}
            </Button>
        </div>
    );
}

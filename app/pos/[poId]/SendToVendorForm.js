"use client";

import { useActionState } from "react";
import { sendPOToVendorAction } from "./actions";
// Issue #281 — pure and safe for a client bundle: `lib/poSend.js` imports nothing,
// so the words the button and its failures use are the same object the action reads.
import { SEND_COPY } from "@/lib/poSend";

/**
 * Issue #281 — the control that mails the signed order to the vendor.
 *
 * A CONFIRMATION WOULD BELONG HERE AND DELIBERATELY IS NOT. Withdrawal has a modal
 * because it is terminal and irreversible; this is too, in the sense that a mail
 * cannot be recalled, and the address is not on this button. The reason it goes
 * without one is that the address IS on the screen — the page names the vendor's
 * address beside this control, so the reader has already seen where it goes, and a
 * dialog restating it would only ask the same question twice. If the address ever
 * stops being visible next to the button, this decision has to be revisited.
 */
export default function SendToVendorForm({ poId, address }) {
    const [state, formAction, pending] = useActionState(sendPOToVendorAction, null);

    return (
        <form action={formAction} className="space-y-2">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            {/* Issue #281 — a NOTICE and not an error, in its own tone. Two people may
                send, so the second presser's answer is "the vendor already has it",
                which is what they wanted rather than a failure. Red would tell them
                something went wrong when nothing did. */}
            {state?.notice && (
                <p className="rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {state.notice}
                </p>
            )}
            <p className="text-xs text-zinc-500">{address}</p>
            <input type="hidden" name="poId" value={poId} />
            <button
                type="submit"
                disabled={pending}
                className="rounded border border-zinc-300 px-4 py-2 disabled:opacity-50"
            >
                {pending ? SEND_COPY.pending : SEND_COPY.button}
            </button>
        </form>
    );
}

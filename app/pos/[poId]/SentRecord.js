"use client";

import { useReaderInstant } from "@/app/components/Instant";
import { SEND_COPY } from "@/lib/poSend";

/**
 * The record of a send, in the reader's own zone (#374).
 *
 * WHY A COMPONENT RATHER THAN AN `<Instant>` IN THE MARKUP. `SEND_COPY.sent`
 * returns one sentence built around the moment — where it went, when, and who
 * sent it — so there is no element to wrap and no way to hand the builder a
 * value the browser has not resolved yet. So the whole sentence waits: the hook
 * answers `null` until the component has mounted, and until then this renders
 * nothing rather than a sentence with a hole where the time goes.
 *
 * THE SENTENCE STAYS ONE STRING FROM ONE BUILDER, which is what this is for.
 * Splitting it so the time could be its own element would put half of #281's
 * copy on a screen and half in a constant, and `offline/line-vocabulary.mjs`
 * reads the constant.
 *
 * `lib/poSend.js` IS SAFE HERE and was already proved so: it imports nothing but
 * `./format.js`, and `SendToVendorForm.js` beside this file has imported it
 * since #281.
 */
export default function SentRecord({ address, at, by }) {
    const when = useReaderInstant(at);
    if (when === null) return null;

    return <p className="text-zinc-600">{SEND_COPY.sent({ address, when, by })}</p>;
}

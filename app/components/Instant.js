"use client";

import { Fragment, useSyncExternalStore } from "react";
import { INSTANT_FORMAT, formatInstant, instantParts, instantText, readInstant } from "@/lib/format";
import Space from "@/app/components/Space";

/**
 * A stored instant, drawn in the reader's own zone (#374), in the design's notation
 * (#463).
 *
 * WHY THIS CROSSES A CLIENT BOUNDARY AT ALL. Every screen that shows an instant
 * is a Server Component, so `toLocaleString` resolved against wherever the render
 * happened — UTC on Vercel — and nothing on any of those screens said which zone
 * it was. A reader on a site therefore read an hour that was not the hour the
 * thing happened at and had no way to convert it. Only a browser knows the
 * reader's zone, so the formatting has to happen in one. The PAGES stay Server
 * Components, which is #373's arrangement for `/login`: the page keeps its ops
 * scope (#224) and hands a value to a client file beside it.
 *
 * NOTHING IS DRAWN UNTIL THE COMPONENT HAS MOUNTED, AND THAT IS THE WHOLE OF THE
 * HYDRATION ANSWER. A Client Component is server-rendered first, so formatting
 * during render would put the server's zone in the HTML and the reader's zone in
 * the hydration pass — different text for the same node, which React warns about
 * and which `/prs/new`'s resume prompt has been doing since it was written. The
 * first client render returns exactly what the server returned, and the effect
 * that follows it is what fills the time in.
 *
 * WHAT A READER SEES BEFORE THAT IS NOTHING, WHICH IS A CHOICE AND NOT A GAP.
 * Two alternatives were weighed. Rendering the server's own zone under
 * `suppressHydrationWarning` paints a WRONG hour and corrects it a moment later,
 * which is the misreading this issue exists to remove, shown deliberately.
 * Rendering it with its zone named (`… UTC`) is honest but changes the text under
 * the reader and answers the "does a time name its zone" question differently
 * before and after hydration. A brief blank says nothing false at any moment, and
 * `dateTime` carries the instant in the markup throughout.
 *
 * THE DESIGN'S NOTATION ON EVERY SCREEN, AND THIS IS THE ONE PLACE IT IS DRAWN (#463).
 * Every date the Tools and Invoices files draw reads `09/14/2026`, its slashes at 45%
 * with 1.5 of room either side, and a time is set 9 past its date with no comma — 8
 * below the phone's edge — in tabular figures. The 9 is a `Space`, so the date and the
 * time copy and are read as two words. So the materials screens take it from
 * the same commit as the assets axis, which is the decision that issue recorded, and
 * this is the one component `offline/design-values.mjs` lets read the design's names
 * from a file the screens above the assets axis reach. Its ink is the line it stands in;
 * a history draws it at Ink 2, a caption at whatever the caption is.
 *
 * `useReaderInstant` IS EXPORTED BECAUSE SOME INSTANTS ARE INSIDE A SENTENCE.
 * `SEND_COPY.sent` builds a whole sentence around the moment an order went to its
 * vendor, so there is no element to wrap; that caller takes the string and builds
 * its own line, and renders nothing until this hook has one. The string is the same
 * notation with plain slashes, since a sentence is one string.
 *
 * A SENTENCE BUILT AS PARTS DRAWS ITS INSTANT HERE INSTEAD, `sentence` (#495). The
 * design's final files draw the moment inside the asset page's stale-press sentence
 * with its slashes dimmed, and the time a word's space past the date rather than the
 * 9 a date and its time stand apart at elsewhere, so that sentence hands this its moment
 * as a part and nothing else changes for any other screen.
 */

// Whether this render is the browser's. The three arguments ARE the hydration
// rule: React takes the server snapshot while rendering on the server and again
// while hydrating, then switches to the client one — so the markup and the render
// that hydrates it are identical by construction rather than by care. There is
// nothing to subscribe to, since this never changes again after that switch.
//
// A `useState(false)` plus an effect does the same thing and is what this was
// first written as; it trips `react-hooks/set-state-in-effect`, and the rule is
// right — this is the hook React added for the question.
const noSubscription = () => () => {};
const inTheBrowser = () => true;
const onTheServer = () => false;

/** The instant's parts once the browser can say what zone it is in, and `null` until then. */
function useReaderParts(at, format) {
    const hydrated = useSyncExternalStore(noSubscription, inTheBrowser, onTheServer);
    if (!hydrated) return null;
    return instantParts(at, format);
}

/**
 * The formatted instant once the browser can say what zone it is in, and `null`
 * until then. `null` is also the answer for a value that is not an instant, so a
 * caller building a sentence has one test rather than two.
 */
export function useReaderInstant(at, format = INSTANT_FORMAT) {
    const hydrated = useSyncExternalStore(noSubscription, inTheBrowser, onTheServer);
    if (!hydrated) return null;
    return instantText(at, format);
}

export default function Instant({ at, format = INSTANT_FORMAT, sentence = false }) {
    const parts = useReaderParts(at, format);

    // A blank stays blank and a string no parser can read stays itself, which is
    // `formatInstant`'s rule reaching the markup: such a value gets no `<time>`,
    // since the attribute would then carry something no machine can read either.
    if (readInstant(at) === null) return formatInstant(at, format) ?? null;

    return (
        <time dateTime={at} className="tabular-nums">
            {parts && (
                <>
                    {parts.date.map((figures, index) => (
                        <Fragment key={index}>
                            {index > 0 && <span className="px-date-separator-inline opacity-date-separator">/</span>}
                            {figures}
                        </Fragment>
                    ))}
                    {parts.time && (
                        <>
                            {sentence ? " " : <Space className="w-date-time-inline max-sm:w-mobile-date-time-inline" />}
                            {parts.time}
                        </>
                    )}
                </>
            )}
        </time>
    );
}

import { STATUS_MARK } from "@/lib/assetView";

/*
 * The mark an asset's status is drawn with (0g, #463): a solid dot for `In stock`, a ring
 * for `Out`, the ring dashed for `In repair` (#531), the ring struck through for `Retired`
 * — `lib/assetView.js:STATUS_MARK` says which status takes which. 9 at a desk and 10 below
 * the phone's edge, the ring 1.5, all in Ink 3 whatever the status, and it hides from
 * assistive tech, since the word beside it says the status.
 *
 * TWO DRAWINGS RATHER THAN ONE SCALED, because a scaled ring keeps neither figure: the
 * design draws the desk's ring 3.75 around its center and the phone's 4.25, each 1.5 wide,
 * and the slash across each from its own corners. So each width draws its own and shows it
 * alone.
 *
 * THE DASHED RING IS THE INVOICES FILE'S 0g AWAY, and its dashes are its own figures at each
 * width: 2.36 on and 1.57 off around the desk's ring, 2.67 and 1.78 around the phone's, each
 * turned 75° back about its center, as 0g, 1d, 1f and 1j-e draw it. They are the
 * ring's geometry in its own box, as its radius and the slash's corners are, so they are
 * not names in `app/designValues.css`.
 */

const DRAWN = {
    desk: {
        box: 9,
        className: "size-status-indicator max-sm:hidden",
        settled: <circle cx="4.5" cy="4.5" r="4.5" fill="currentColor" />,
        ring: <circle cx="4.5" cy="4.5" r="3.75" fill="none" stroke="currentColor" className="stroke-status-ring" />,
        dashed: (
            <circle
                cx="4.5"
                cy="4.5"
                r="3.75"
                fill="none"
                stroke="currentColor"
                strokeDasharray="2.36 1.57"
                transform="rotate(-75 4.5 4.5)"
                className="stroke-status-ring"
            />
        ),
        slash: <path d="M1.85 7.15 7.15 1.85" stroke="currentColor" className="stroke-status-ring" />,
    },
    phone: {
        box: 10,
        className: "size-mobile-status-indicator sm:hidden",
        settled: <circle cx="5" cy="5" r="5" fill="currentColor" />,
        ring: <circle cx="5" cy="5" r="4.25" fill="none" stroke="currentColor" className="stroke-status-ring" />,
        dashed: (
            <circle
                cx="5"
                cy="5"
                r="4.25"
                fill="none"
                stroke="currentColor"
                strokeDasharray="2.67 1.78"
                transform="rotate(-75 5 5)"
                className="stroke-status-ring"
            />
        ),
        slash: <path d="M2 8 8 2" stroke="currentColor" className="stroke-status-ring" />,
    },
};

/** Which drawing each shape takes: the dot, the ring, the dashed ring, or the ring and its slash. */
const FACE = { settled: "settled", open: "ring", away: "dashed", ended: "ring" };

function Drawn({ width, shape }) {
    const drawn = DRAWN[width];
    return (
        <svg viewBox={`0 0 ${drawn.box} ${drawn.box}`} aria-hidden="true" className={`${drawn.className} shrink-0 self-center text-foreground-subtle`}>
            {drawn[FACE[shape]]}
            {shape === "ended" && drawn.slash}
        </svg>
    );
}

export default function StatusMark({ status }) {
    const shape = STATUS_MARK[status];
    if (!shape) return null;
    return (
        <>
            <Drawn width="desk" shape={shape} />
            <Drawn width="phone" shape={shape} />
        </>
    );
}

import { getSignerChainProgress } from "@/lib/prSigning";

// Issue #81 — linear progress bar replacing the old plain-text Signers
// list: Requester -> each Signer (in order) -> PO Signed. Shows only
// current state; the History timeline below still owns the full log.
// Server Component (no interactivity beyond native `title` tooltips), so
// step positions can be computed analytically from array index rather
// than measured client-side — see CIRCLE/COLUMN/GAP below.
//
// Each step is a circle with its name always visible underneath (rather
// than hover-only) — COLUMN is wider than CIRCLE so short names mostly
// fit without truncating; longer ones still get the full name via
// `title`. Widening the columns means 8 steps (Requester + 6 Signers +
// PO Signed) no longer reliably fits the page width without scrolling —
// the container's overflow-x-auto (already in place) is the intended
// fallback, not a bug.

const CIRCLE = 36;
const COLUMN = 64;
const GAP = 24;
const PITCH = COLUMN + GAP;
const ARC_LANE_HEIGHT = 18;
const ARC_BASE = 14;

// One color scheme per category, shared by the step circle and (for
// "reached"-ness) the connector segment feeding into it. "paused" and
// "not-reached" intentionally share the same fill/text color — the only
// difference is border style (dashed vs solid) — per issue #81's design:
// a signer who passed through but got pushed back by a correction reads
// as "not currently actionable," same neutral color as "not yet
// reached," distinguished only by the dashed border marking "already
// touched once."
const CATEGORY_STYLES = {
    done: "bg-green-600 border-green-600 text-white dark:bg-green-600 dark:border-green-600",
    current: "bg-amber-500 border-amber-500 text-white dark:bg-amber-500 dark:border-amber-500",
    paused:
        "bg-zinc-100 border-zinc-400 border-dashed text-zinc-600 dark:bg-zinc-800 dark:border-zinc-500 dark:text-zinc-300",
    "not-reached":
        "bg-zinc-100 border-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300",
};

function centerX(index) {
    return index * PITCH + COLUMN / 2;
}

function StepCircle({ label, title, category }) {
    return (
        <div
            title={title}
            aria-label={title}
            className={
                "flex shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold " +
                CATEGORY_STYLES[category]
            }
            style={{ width: CIRCLE, height: CIRCLE }}
        >
            {label}
        </div>
    );
}

// Vertically centered on the circle, not the column (the name label
// below the circle adds height only to the column, not to this line) —
// marginTop offsets from the column's top by half the circle, minus half
// the connector's own thickness.
function Connector({ solid }) {
    return (
        <div
            className={
                "shrink-0 " +
                (solid
                    ? "h-0.5 bg-zinc-400 dark:bg-zinc-500"
                    : "h-0 border-t-2 border-dashed border-zinc-300 dark:border-zinc-700")
            }
            style={{ width: GAP, marginTop: CIRCLE / 2 - 1 }}
        />
    );
}

export default function SignerProgressBar({ pr, signers, correctionRequests, po, usersById }) {
    const { steps, arcs } = getSignerChainProgress(pr, signers, correctionRequests);

    // PO Signed is a distinct final step this module doesn't know about
    // (driven by the PO record, not PR Signers/Correction Requests) —
    // appended here rather than in lib/prSigning.js's pure chain logic.
    const poCategory =
        pr.status === "PO Signed" ? "done" : pr.status === "Approved" ? "current" : "not-reached";
    const allSteps = [
        ...steps,
        { type: "po", sequenceOrder: steps.length, category: poCategory },
    ];

    const totalWidth = allSteps.length * PITCH - GAP;
    const svgHeight = arcs.length > 0 ? ARC_BASE + arcs.length * ARC_LANE_HEIGHT : 0;

    return (
        <div className="overflow-x-auto pb-1">
            <div style={{ width: totalWidth, minWidth: totalWidth }}>
                {arcs.length > 0 && (
                    <svg
                        width={totalWidth}
                        height={svgHeight}
                        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
                        className="block"
                    >
                        <defs>
                            <marker
                                id="correction-arrowhead"
                                markerWidth="8"
                                markerHeight="8"
                                refX="6"
                                refY="4"
                                orient="auto"
                            >
                                <path d="M0,0 L8,4 L0,8 Z" className="fill-amber-500" />
                            </marker>
                        </defs>
                        {/* Return for correction: sender -> receiver, always solid --
                            per issue #81, the return itself is a synchronous, already-
                            delivered action, never "in progress." Stacked corrections
                            (a real LIFO, per investigation) get one lane each, widest
                            span outermost so nested arcs don't collide. */}
                        {arcs
                            .slice()
                            .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
                            .map((arc, i) => {
                                const fromX = centerX(arc.from);
                                const toX = centerX(arc.to);
                                const baseY = svgHeight;
                                const peakY = svgHeight - ARC_BASE - i * ARC_LANE_HEIGHT;
                                const midX = (fromX + toX) / 2;
                                return (
                                    <path
                                        key={arc.correctionRequestId}
                                        d={`M ${fromX} ${baseY} Q ${midX} ${peakY} ${toX} ${baseY}`}
                                        fill="none"
                                        strokeWidth="2"
                                        className="stroke-amber-500"
                                        markerEnd="url(#correction-arrowhead)"
                                    />
                                );
                            })}
                    </svg>
                )}

                <div className="flex items-start" role="list" aria-label="Signing chain progress">
                    {allSteps.map((step, i) => {
                        const isRequester = step.type === "requester";
                        const isPO = step.type === "po";
                        const user = !isPO ? usersById[step.userId] : null;
                        const label = isRequester ? "R" : isPO ? "PO" : String(step.sequenceOrder);
                        const name = isPO ? "PO Signed" : user?.userName || "Unknown";
                        const statusWord =
                            step.category === "current"
                                ? "current turn"
                                : step.category === "paused"
                                  ? "paused (returned for correction)"
                                  : step.category === "done"
                                    ? "done"
                                    : "not reached yet";
                        const title = isRequester
                            ? `Requester: ${name} — ${statusWord}`
                            : isPO
                              ? `PO Signed — ${statusWord}`
                              : `Step ${step.sequenceOrder}: ${name} (${step.confirmationType}) — ${statusWord}`;

                        return (
                            <div key={`${step.type}-${step.sequenceOrder}`} className="flex items-start" role="listitem">
                                {i > 0 && <Connector solid={step.category !== "not-reached"} />}
                                <div className="flex flex-col items-center" style={{ width: COLUMN }}>
                                    <StepCircle label={label} title={title} category={step.category} />
                                    <span
                                        title={name}
                                        className="mt-1 max-w-full truncate text-center text-[10px] text-zinc-600 dark:text-zinc-400"
                                    >
                                        {name}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

import { FILE_VIEWER_COPY } from "@/lib/fileLinks";
import { zoomIn, zoomLabel, zoomOut } from "@/lib/fileView";

/**
 * The controls drawn around a file: the viewer's header and the pane's toolbar (#433).
 *
 * THE SHAPE IS THE VIEWER HEADER'S, WHICH EXISTED FIRST. `Download` and `Close` were a
 * bordered, rounded, small-text button each before this issue, and the paging and the
 * zoom are the same button rather than a second visual pattern beside it — the pane
 * takes it too, so the two surfaces that draw a file do not teach two kinds of button.
 *
 * A CONTROL AT ITS LIMIT IS MARKED, NOT DISABLED. A `disabled` button drops the focus
 * it holds, and in an overlay that is the worst place for focus to go: the next `Tab`
 * starts again from the top of the page behind it. So the last page's `Next page` and
 * the top zoom's `Zoom in` keep their focus, say `aria-disabled`, dim, and do nothing.
 */
export const FILE_CONTROL = "rounded border border-zinc-300 px-3 py-1.5 text-sm";

const AT_LIMIT = "cursor-default opacity-40";

/**
 * One control. `symbol` is what it shows when that is not a word — `‹`, `+` — and
 * then `label` is what it is called, to a screen reader and on hover; otherwise the
 * label is the text.
 */
export function FileControlButton({ label, symbol, atLimit, onClick }) {
    return (
        <button
            type="button"
            aria-label={symbol ? label : undefined}
            title={symbol ? label : undefined}
            aria-disabled={atLimit || undefined}
            onClick={atLimit ? undefined : onClick}
            className={atLimit ? `${FILE_CONTROL} ${AT_LIMIT}` : FILE_CONTROL}
        >
            {symbol ?? label}
        </button>
    );
}

/** Out, where it stands, in — on both surfaces, over a picture or a page alike. */
export function ZoomControls({ zoom, onZoom }) {
    return (
        <div className="flex items-center gap-1">
            <FileControlButton
                label={FILE_VIEWER_COPY.zoomOut}
                symbol="−"
                atLimit={zoomOut(zoom) === zoom}
                onClick={() => onZoom(zoomOut(zoom))}
            />
            <span className="w-12 text-center text-sm tabular-nums">{zoomLabel(zoom)}</span>
            <FileControlButton
                label={FILE_VIEWER_COPY.zoomIn}
                symbol="+"
                atLimit={zoomIn(zoom) === zoom}
                onClick={() => onZoom(zoomIn(zoom))}
            />
        </div>
    );
}

/**
 * The viewer's one page at a time. The count is announced as it changes, since the
 * control that changed it stays where it was and says nothing new.
 */
export function PageStepper({ page, pages, onPage }) {
    return (
        <div className="flex items-center gap-1">
            <FileControlButton
                label={FILE_VIEWER_COPY.previousPage}
                symbol="‹"
                atLimit={page <= 1}
                onClick={() => onPage(page - 1)}
            />
            <span className="px-1 text-sm tabular-nums whitespace-nowrap" aria-live="polite">
                {FILE_VIEWER_COPY.pageOf(page, pages)}
            </span>
            <FileControlButton
                label={FILE_VIEWER_COPY.nextPage}
                symbol="›"
                atLimit={page >= pages}
                onClick={() => onPage(page + 1)}
            />
        </div>
    );
}

"use client";

import { useState } from "react";
import FileFrame from "@/app/components/FileFrame";
import { FileControlButton, ZoomControls } from "@/app/components/FileControls";
import { FILE_RENDER, FILE_VIEWER_COPY } from "@/lib/fileLinks";
import { FILE_LAYOUT, nextRotation } from "@/lib/fileView";
import { FILE_PANE_TOOLBAR } from "./filePane";

/**
 * The invoice file in the pane, and the toolbar under it (#433).
 *
 * THE PANE'S CONTROLS ARE NOT THE VIEWER'S, AND THE DIFFERENCE IS WHAT EACH IS FOR.
 * The viewer is opened to look at a stored file and pages it one at a time, beside a
 * title and a way to save it. This column holds a file the reader picked off their own
 * disk a moment ago and is copying figures out of, so it scrolls through the whole
 * document, says which page is in view, opens at the column's width, and turns — a
 * scan or a photograph often arrives on its side. It carries no filename, no size and
 * no download: the file control is directly under it, and there is nothing to save.
 *
 * THE ZOOM AND THE TURN ARE THE SAME ON A PICTURE AS ON A PAGE. A phone photograph of
 * a paper invoice needs its small figures enlarged exactly as a PDF does, and a
 * toolbar that worked on only one of them would be two tools to learn. What a picture
 * lacks is a page count, so the indicator is the one control it does not get.
 *
 * A NEW FILE STARTS OVER. `InvoiceForm` keys this by the file's address, so replacing
 * the file resets the zoom and the turn rather than carrying a sideways setting onto a
 * document that arrived upright.
 */
export default function PaneFile({ href, kind, title }) {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [visiblePage, setVisiblePage] = useState(1);

    return (
        <>
            <FileFrame
                href={href}
                kind={kind}
                title={title}
                layout={FILE_LAYOUT.scroll}
                zoom={zoom}
                rotation={rotation}
                onReady={setPageCount}
                onVisiblePage={setVisiblePage}
            />
            {/* The row is drawn in every state so the file above it keeps one size;
                its controls arrive with the file, as the viewer's do. */}
            <div className={FILE_PANE_TOOLBAR}>
                {pageCount > 0 && (
                    <>
                        <span className="text-sm whitespace-nowrap text-zinc-600 tabular-nums" aria-live="polite">
                            {kind === FILE_RENDER.document ? FILE_VIEWER_COPY.pageOf(visiblePage, pageCount) : null}
                        </span>
                        <div className="flex items-center gap-2">
                            <ZoomControls zoom={zoom} onZoom={setZoom} />
                            <FileControlButton
                                label={FILE_VIEWER_COPY.fitWidth}
                                atLimit={zoom === 1}
                                onClick={() => setZoom(1)}
                            />
                            <FileControlButton
                                label={FILE_VIEWER_COPY.rotate}
                                onClick={() => setRotation(nextRotation)}
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

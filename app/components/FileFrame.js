"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import useColumn from "@/app/components/useColumn";
import { FILE_RENDER, FILE_VIEWER_COPY } from "@/lib/fileLinks";
import { FILE_LAYOUT, drawnWidth, turnedSize } from "@/lib/fileView";

// Loaded only where a PDF is drawn, and never on the server — `PdfPages.js` says why
// both halves matter. Its own `loading` state takes over from this one once it has
// arrived, and they say the same sentence.
const PdfPages = dynamic(() => import("@/app/components/PdfPages"), {
    ssr: false,
    loading: () => (
        <p className="mt-4 text-sm text-zinc-600" aria-live="polite">
            {FILE_VIEWER_COPY.loading}
        </p>
    ),
});

/**
 * How an uploaded file is drawn, on every surface that draws one (#422, #433).
 *
 * Its own module since #422, when `/invoices/new` began drawing the invoice file
 * beside the form it is transcribed into and a second surface needed the viewer's
 * rule. #433 changed what the rule draws a PDF with: the app's own pages
 * (`PdfPages.js`) where a frame handed them to the reader's browser. An image is
 * still an image element, and a type the route will not serve as itself is still a
 * sentence rather than a guess.
 *
 * CONTROLLED BY ITS CALLER. The zoom, the turn and the page belong to the surface —
 * the viewer draws its paging and zoom in its own header, the pane draws a toolbar of
 * its own — so this takes them as props and reports what only it can learn: that the
 * file is drawn and how many pages it has (`onReady`), and in the pane which page is
 * in view (`onVisiblePage`).
 *
 * THE TWO CALLERS SUPPLY DIFFERENT KINDS OF ADDRESS, and both kinds reach both
 * branches: the viewer passes `/api/files/…`, which streams a gated attachment and
 * re-reads the record per request, and the pane passes an `URL.createObjectURL`
 * address for a file the reader picked seconds ago.
 */
function FileFrame({
    href,
    kind,
    title,
    layout = FILE_LAYOUT.page,
    zoom = 1,
    rotation = 0,
    page = 1,
    onReady,
    onVisiblePage,
}) {
    if (kind === FILE_RENDER.unknown) {
        return <p className="mt-4 text-sm text-zinc-600">{FILE_VIEWER_COPY.notViewable}</p>;
    }

    if (kind === FILE_RENDER.image) {
        return <FileImage href={href} title={title} zoom={zoom} rotation={rotation} onReady={onReady} />;
    }

    return (
        <PdfPages
            key={href}
            href={href}
            title={title}
            layout={layout}
            zoom={zoom}
            rotation={rotation}
            page={page}
            onReady={onReady}
            onVisiblePage={onVisiblePage}
        />
    );
}

/**
 * A photograph or a scan saved as one, in an image element.
 *
 * AT THE OPENING ZOOM IT IS DRAWN AS IT WAS: its own width, or the column's if it is
 * wider. The column now reserves its scrollbar's gutter whether or not it scrolls,
 * which is the one difference, and the reason is `PdfPages.js`'s: a width measured
 * off the column would otherwise chase the scrollbar it causes. On a system whose
 * scrollbars overlay the content the gutter is nothing at all.
 *
 * The zoom and the turn are CSS on that same element — the browser
 * already holds every pixel, so nothing is decoded again — and the box around it
 * takes the turned size, so a quarter turn scrolls like the picture it has become
 * rather than overlapping the column.
 *
 * The one kind that reports its own failure, so it is the one kind with that state
 * decided here rather than inside a renderer.
 */
function FileImage({ href, title, zoom, rotation, onReady }) {
    const [failed, setFailed] = useState(false);
    const [natural, setNatural] = useState(null);
    const { ref: columnRef, width: room } = useColumn();

    if (failed) {
        return <p className="mt-4 text-sm text-red-700">{FILE_VIEWER_COPY.loadFailed}</p>;
    }

    // Until the picture has arrived and the column has been measured, it is drawn
    // by the classes it always had.
    let box = null;
    if (natural && room > 0) {
        const turned = turnedSize({ ...natural, rotation });
        const width = drawnWidth({ natural: turned.width, room, zoom, grow: false });
        box = { width, height: (width * turned.height) / turned.width };
    }
    const sideways = rotation % 180 !== 0;

    return (
        <div ref={columnRef} className="mt-4 min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
            <div className="relative mx-auto" style={box ? { width: box.width, height: box.height } : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element -- both addresses
                    this receives are uncacheable by the image optimizer: the route
                    streams a gated attachment and re-reads the record per request, and
                    an object URL exists only in the reader's own tab. */}
                <img
                    src={href}
                    alt={title}
                    onLoad={(e) => {
                        setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                        onReady?.(1);
                    }}
                    onError={() => setFailed(true)}
                    className={box ? "absolute top-1/2 left-1/2 max-w-none" : "mx-auto max-w-full"}
                    style={
                        box
                            ? {
                                  width: sideways ? box.height : box.width,
                                  height: sideways ? box.width : box.height,
                                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                              }
                            : undefined
                    }
                />
            </div>
        </div>
    );
}

// Exported below its declaration since #422, which moved the declaration unchanged.
export default FileFrame;

"use client";

import { useState } from "react";
import { FILE_RENDER, FILE_VIEWER_COPY } from "@/lib/fileLinks";

/**
 * Its own module since #422, because two surfaces draw a file rather than one.
 *
 * MOVED WITHOUT AN EDIT: the body below is byte for byte what `FileViewer.js` held,
 * and the move was diffed rather than eyeballed. Framing a file was the viewer's
 * private business while the viewer was its only caller; `/invoices/new` now draws
 * the invoice file beside the form it is being transcribed into, and the rule is the
 * same one at both sites — an image element for a photo, a frame for a document,
 * neither for a type that would open a download dialog inside a surface that cannot
 * offer one, and a sentence under the frame because nothing can detect that a
 * document failed to render. Leaving it in the viewer's file would have told the next
 * reader that framing is the overlay's business.
 *
 * THE TWO CALLERS SUPPLY DIFFERENT KINDS OF ADDRESS, and the lint exemption in the
 * image branch is written for the first of them: the viewer passes `/api/files/…`,
 * which streams a gated attachment and re-reads the record per request, and the pane
 * passes an `URL.createObjectURL` address for a file the reader picked seconds ago.
 * Neither is something the image optimizer can cache or resize, so that reasoning
 * covers both — it is narrower than the module rather than wrong, and widening the
 * sentence would edit the body this issue moved unchanged.
 *//**
 * The file itself, or the sentence that stands in for it.
 *
 * An image element for a photo, a frame for a document, and neither for a type the
 * route will not serve as itself — that last one becomes `application/octet-stream`
 * upstream, so a frame would offer a download dialog inside an overlay that already
 * has the control.
 */
function FileFrame({ href, kind, title }) {
    const [failed, setFailed] = useState(false);

    if (kind === FILE_RENDER.unknown) {
        return <p className="mt-4 text-sm text-zinc-600">{FILE_VIEWER_COPY.notViewable}</p>;
    }

    if (kind === FILE_RENDER.image) {
        if (failed) {
            return <p className="mt-4 text-sm text-red-700">{FILE_VIEWER_COPY.imageFailed}</p>;
        }
        return (
            <div className="mt-4 min-h-0 flex-1 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element -- the route
                    streams a gated attachment and re-reads the record per request, so
                    there is nothing for the image optimizer to cache or resize. */}
                <img
                    src={href}
                    alt={title}
                    onError={() => setFailed(true)}
                    className="mx-auto max-w-full"
                />
            </div>
        );
    }

    return (
        <>
            <iframe src={href} title={title} className="mt-4 min-h-0 w-full flex-1 border-0" />
            <p className="mt-2 text-xs text-zinc-500">{FILE_VIEWER_COPY.documentHint}</p>
        </>
    );
}

// Exported here rather than on the declaration above, so that the declaration is
// byte for byte the one `FileViewer.js` held.
export default FileFrame;

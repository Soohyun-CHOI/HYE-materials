"use client";

import { useEffect, useState } from "react";

/*
 * Tools 0a's Top bar — a phone screen's head, where a desk has the breadcrumb (#463). The
 * asset page is the one screen drawn at a phone's width (1j, 1k), so it is the one
 * caller; the breadcrumb hides below the phone's edge on that page and this shows there
 * alone.
 *
 * 56 TALL, 16 IN ON THE LEFT AND 4 ON THE RIGHT, THE ID AT 17 (0a): the record's printed id
 * in the id face, and at the right end one 48 icon button whose 24 mark has its ink on the
 * 16 margin — `children` is that button. Every screen with a top bar passes its `More
 * actions`, since the menu ends on the account where nothing else is offered (#495).
 * `muted` sets the id in Ink 3, which 1k-c does for a code no asset carries.
 *
 * STICKY AT THE TOP, DRAWING NO RULE (0a, 0k): white at 0.82 over a blur while the page runs
 * under it, fading out over the 24 below it, and nothing at all with the page at its top.
 * The document scrolls below the phone's edge rather than the rail's column (`Rail.js`), so
 * whether anything runs under it is the window's scroll.
 */
export default function TopBar({ id, muted = false, children }) {
    const [under, setUnder] = useState(false);
    useEffect(() => {
        const measure = () => setUnder(window.scrollY > 0);
        measure();
        window.addEventListener("scroll", measure, { passive: true });
        return () => window.removeEventListener("scroll", measure);
    }, []);

    return (
        <div className="sticky top-0 z-10 isolate flex h-mobile-top-bar shrink-0 items-center justify-between gap-gap pr-mobile-top-bar-inset-right pl-mobile-gutter sm:hidden">
            <span
                aria-hidden="true"
                data-under={under || undefined}
                className="pointer-events-none absolute inset-x-0 top-0 -bottom-mobile-top-bar-bleed -z-10 bg-background-translucent opacity-0 backdrop-blur-sm transition-opacity duration-mobile-top-bar [mask-image:linear-gradient(to_top,transparent,black_var(--spacing-mobile-top-bar-bleed))] data-under:opacity-100"
            />
            <p className={`min-w-0 truncate font-id text-mobile-heading tracking-id tabular-nums ${muted ? "text-foreground-subtle" : "text-foreground-default"}`}>
                {id}
            </p>
            {children}
        </div>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { pageScroll } from "./sheetHold";

/*
 * Tools 0a's Top bar — a phone screen's head, where a desk has the breadcrumb (#463). The
 * asset page is the one screen drawn at a phone's width (1j, 1k), so it is the one
 * caller; the breadcrumb hides below the phone's edge on that page and this shows there
 * alone.
 *
 * 56 TALL, HOLDING ONE 48 ICON BUTTON AT THE RIGHT END (0a), its 24 mark's ink on the 16
 * margin — `children` is that button. Every screen with a top bar passes its `More actions`,
 * since the menu ends on the account where nothing else is offered (#495). The record's id
 * stood in the bar, at 17 in the id face, until the files of 2026-10-16 moved it into the
 * body, 4 under the bar and 4 over the name (#538).
 *
 * `name` IS THE RECORD'S NAME, WHICH FADES IN AT THE BAR'S CENTER ONCE THE NAME HAS SCROLLED
 * UNDER THE BAR (0a): at 17 and 600, clear of 56 at either side, ending in an ellipsis, over
 * 160ms, and gone again as it comes back. The name the bar watches is the page's heading — its
 * one `h1`, as `DialogFrame.js` finds it — measured on every scroll and resize, and it has gone
 * under once its foot is at or above the bar's. 1j's own code brings it in from a scroll of 52,
 * 4 before the foot reaches the bar; the bar takes the spec's sentence and measures it, as
 * `ListFrame` measures 1d's head rather than read a figure. Out, it is hidden from assistive
 * tech, which reads the heading. 1k-c, a code no asset carries, passes no name.
 *
 * STICKY AT THE TOP, DRAWING NO RULE (0a, 0k): white at 0.82 over a blur while the page runs
 * under it, fading out over the 24 below it, and nothing at all with the page at its top.
 * The document scrolls below the phone's edge rather than the rail's column (`Rail.js`), so
 * whether anything runs under it is the window's scroll — the page's, as `sheetHold.js`
 * counts it, since a sheet holding the page leaves the document no scroll of its own (#579).
 */
export default function TopBar({ name, children }) {
    const barRef = useRef(null);
    const [under, setUnder] = useState(false);
    const [named, setNamed] = useState(false);
    useEffect(() => {
        const measure = () => {
            setUnder(pageScroll(window) > 0);
            const bar = barRef.current;
            const heading = name ? document.querySelector("h1") : null;
            setNamed(Boolean(bar && heading && heading.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom));
        };
        measure();
        window.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [name]);

    return (
        <div ref={barRef} className="sticky top-0 z-10 isolate flex h-mobile-top-bar shrink-0 items-center justify-end gap-gap pr-mobile-top-bar-inset-right sm:hidden">
            <span
                aria-hidden="true"
                data-under={under || undefined}
                className="pointer-events-none absolute inset-x-0 top-0 -bottom-mobile-top-bar-bleed -z-10 bg-background-translucent opacity-0 backdrop-blur-sm transition-opacity duration-mobile-top-bar [mask-image:linear-gradient(to_top,transparent,black_var(--spacing-mobile-top-bar-bleed))] data-under:opacity-100"
            />
            {name && (
                <div
                    className={`pointer-events-none absolute inset-y-0 inset-x-mobile-top-bar-title-inset-x flex items-center justify-center transition-[opacity,visibility] duration-mobile-top-bar ease-out ${
                        named ? "visible opacity-100" : "invisible opacity-0"
                    }`}
                >
                    <p className="min-w-0 truncate text-mobile-heading font-semibold text-foreground-default">{name}</p>
                </div>
            )}
            {children}
        </div>
    );
}

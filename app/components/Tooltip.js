"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * 0k's Tooltip — a short line that names what the pointer is on: the Ink ground, white 13 at
 * 500, 3 9 4 inside, the Control radius and Raised without its Edge, after 360ms. One for
 * each surface that asks, placed beside whichever of its targets asked, in the top layer, so
 * nothing a column or a rail clips can clip it; hidden from assistive tech, which has each
 * target's name already.
 *
 * WRITTEN FOR THE RAIL (#460) AND MOVED HERE WHEN THE SECOND ICON BUTTON CAME (#463): the tool
 * item page's `More actions`, whose tooltip stands 6 above it, centered, where the rail's
 * stand 10 beside an icon. `placement` is which of the two; everything else is one drawing.
 * A target's name and its tooltip are one string — the rail's rule for every collapsed icon,
 * and `offline/navigation.mjs` reads it off the rail's call sites.
 *
 * ON HOVER, AND ON KEYBOARD FOCUS, AND GONE ON ESCAPE wherever focus is, which is how a reader
 * dismisses something the pointer opened without moving the pointer. It does not show while
 * `enabled` is false — the rail expanded, with every word on the screen — and a caller whose
 * target opens a menu leaves its target's props off while the menu shows (0k).
 */
export function useTooltip({ enabled = true, placement = "beside" } = {}) {
    const tipRef = useRef(null);
    const [word, setWord] = useState("");

    const hide = useCallback(() => {
        const tip = tipRef.current;
        if (tip?.matches(":popover-open")) tip.hidePopover();
    }, []);

    const show = useCallback(
        (target, text) => {
            const tip = tipRef.current;
            if (!tip || !enabled) return;
            setWord(text);
            const box = target.getBoundingClientRect();
            if (placement === "above") {
                tip.style.top = "auto";
                tip.style.bottom = `${window.innerHeight - box.top}px`;
                tip.style.left = `${box.left + box.width / 2}px`;
            } else {
                tip.style.left = `${box.right}px`;
                tip.style.top = `${box.top + box.height / 2}px`;
            }
            if (!tip.matches(":popover-open")) tip.showPopover();
        },
        [enabled, placement]
    );

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === "Escape") hide();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [hide]);

    useEffect(() => {
        if (!enabled) hide();
    }, [enabled, hide]);

    /** What a target needs to show it: on hover, and on focus from the keyboard. */
    const targetProps = (text) => ({
        onPointerEnter: (event) => show(event.currentTarget, text),
        onPointerLeave: hide,
        onFocus: (event) => {
            if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget, text);
        },
        onBlur: hide,
    });

    const element = (
        <div
            ref={tipRef}
            popover="manual"
            aria-hidden="true"
            className={`pointer-events-none inset-auto whitespace-nowrap rounded-control bg-foreground-default px-tooltip-inset-x pt-tooltip-inset-top pb-tooltip-inset-bottom font-ui text-body-sm font-medium text-white shadow-popover transition-opacity delay-tooltip duration-tooltip starting:open:opacity-0 ${
                placement === "above"
                    ? "mx-0 mt-0 mb-tooltip-offset -translate-x-1/2"
                    : "my-0 mr-0 ml-tooltip-rail-offset -translate-y-1/2"
            }`}
        >
            {word}
        </div>
    );

    return { targetProps, hide, element };
}

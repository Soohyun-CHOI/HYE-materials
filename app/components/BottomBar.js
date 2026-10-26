"use client";

import { useEffect, useRef, useState } from "react";
import useKeyboardCover from "./useKeyboardCover";

/*
 * Tools 0a's Foot bar — where a phone screen's action stands, at the foot of the page —
 * written for the sign-in steps (#473) and shared with the asset page since #463, whose
 * check-out and check-in stand in one (1j).
 *
 * MOVED OUT OF `app/login/SignInParts.js` WHEN THE SECOND SCREEN CAME TO IT, which is the
 * move condition a shared part waits on: the bar's room, its soft edge and the way it rides
 * on the keyboard are one drawing on both, and a copy of it beside the asset page would
 * be two keyboards to keep in step. Both screens are on the design's axes, so it reads the
 * design's names (`offline/design-values.mjs`).
 */

/** Whether the content above the bar runs on under it, which is when its soft edge shows. */
function useRunsUnder(markRef, barRef) {
    const [under, setUnder] = useState(false);
    useEffect(() => {
        const measure = () => {
            const mark = markRef.current?.getBoundingClientRect();
            const bar = barRef.current?.getBoundingClientRect();
            if (mark && bar) setUnder(mark.top > bar.top);
        };
        measure();
        const resize = new ResizeObserver(measure);
        resize.observe(document.body);
        window.addEventListener("scroll", measure, { passive: true });
        window.visualViewport?.addEventListener("resize", measure);
        return () => {
            resize.disconnect();
            window.removeEventListener("scroll", measure);
            window.visualViewport?.removeEventListener("resize", measure);
        };
    }, [markRef, barRef]);
    return under;
}

// The room a sign-in step's action takes under what is above it at a desk (0o), where the
// bar is the next thing in the column; the asset page's bar is a phone's alone.
const BAR_STACK = {
    header: "mt-sign-in-header-stack",
    form: "mt-sign-in-form-stack",
    refusal: "mt-gap-lg",
};

/**
 * Where a screen's action stands. At a desk, on a sign-in step, it is the next thing in the
 * column, `stack` under what is above it: 32 under the header, 24 under a field, 14 under a
 * refusal (0o).
 *
 * ON A PHONE IT IS THE BOTTOM BAR (Tools 0a Foot bar): at the page's foot, sticky, 16 above
 * and either side and 20 below, its rows 12 apart, drawing no rule, no ground and no shadow
 * — and while the content runs on under it, a soft edge, the translucent white over a blur,
 * fading in over the 24 above it. **It rides on the keyboard**, 12 below it rather than 20,
 * so a screen's action and its field are both in sight while somebody types: a browser that
 * shrinks the page for its keyboard keeps a sticky bar above it by itself — every screen that
 * draws this asks for that (`keyboardViewport.js`), the asset page only since #495,
 * though this said both did from #463 — and one that covers the page instead reports how far
 * it covers, which the bar is lifted by (`useKeyboardCover.js`, which a sheet reads too).
 *
 * **A SCROLL THAT MEETS THE PAGE'S END DOES NOT MOVE IT (#568).** Below the phone's edge the
 * document scrolls, and a phone stretches or bounces it past either end; the bar is sticky at
 * the foot of its column, which is the page's end, so the bounce carried it up with the page.
 * While the bar is drawn the page's root takes `overscroll-behavior-y: none`, which WebKit
 * reads as no bounce on its root scroller and Chrome as no stretch — and, in Chrome on
 * Android, no pull-to-refresh either, since the property has no value that keeps one without
 * the other. So it is keyed to the bar rather than to a layout: a screen drawing no bar — a
 * list, the asset page for a reader who records nothing — keeps the root at `auto` and keeps
 * pull-to-refresh. Safari's pull-to-refresh does not answer to the property at all (WebKit
 * bug 275947). `docs/notes/design-system.md` has the sources.
 *
 * `bleed` reaches the bar out over the gutter of a column that has one, which a sign-in
 * step's does; the asset page holds no gutter of its own, so its bar takes the gutter as
 * its own room. `phoneOnly` is a bar a desk does not draw at all — the asset page's, whose
 * desk asks in its header instead — and is the bar's own class rather than a wrapper's, since
 * a wrapper would be what the sticky bar is held inside.
 */
export default function BottomBar({ stack = "form", bleed = true, phoneOnly = false, children }) {
    const markRef = useRef(null);
    const barRef = useRef(null);
    const { cover, keyboard } = useKeyboardCover();
    const under = useRunsUnder(markRef, barRef);
    return (
        <>
            <span ref={markRef} aria-hidden="true" className={`block max-sm:order-last ${phoneOnly ? "sm:hidden" : ""}`} />
            <div
                ref={barRef}
                data-keyboard={keyboard || undefined}
                style={{ "--keyboard-cover": `${cover}px` }}
                className={`${BAR_STACK[stack] ?? ""} ${phoneOnly ? "sm:hidden" : ""} ${bleed ? "max-sm:-mx-mobile-gutter" : ""} max-sm:sticky max-sm:bottom-(--keyboard-cover) max-sm:isolate max-sm:order-last max-sm:mt-auto max-sm:flex max-sm:flex-col max-sm:gap-mobile-bottom-bar-stack max-sm:px-mobile-gutter max-sm:pt-mobile-bottom-bar-inset-top max-sm:pb-mobile-bottom-bar-inset-bottom max-sm:data-keyboard:pb-mobile-bottom-bar-keyboard-inset-bottom max-sm:[:root:has(&)]:overscroll-y-none`}
            >
                <span
                    aria-hidden="true"
                    data-under={under || undefined}
                    className="pointer-events-none absolute inset-x-0 -top-mobile-bottom-bar-bleed bottom-0 -z-10 hidden bg-background-translucent opacity-0 backdrop-blur-sm transition-opacity duration-mobile-bottom-bar [mask-image:linear-gradient(transparent,black_var(--spacing-mobile-bottom-bar-bleed))] data-under:opacity-100 max-sm:block"
                />
                {children}
            </div>
        </>
    );
}

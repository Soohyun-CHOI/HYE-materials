"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The list a field opens (Claude Design's 0a Menu, #456) — the options under a choice, and
 * the suggestions under a typed name.
 *
 * ONE LIST FOR BOTH COMBOBOX PATTERNS, AND IT OWNS NO KEY. `Choice` and `Combobox` in
 * `Controls.js` are the two WAI-ARIA patterns, and each keeps DOM focus on its own control
 * and points at an option through `aria-activedescendant`; so this never takes focus, and
 * what a key does is `lib/controls.js`'s, applied by the control. What differs between the
 * two is what `aria-selected` marks — the chosen option in a choice, the one under visual
 * focus in a list of suggestions, which is what each pattern says — so the control decides
 * it per option and this renders it. #458's check-out job will be a choice too, and reach
 * this through `Choice`.
 *
 * IN THE TOP LAYER, THROUGH THE POPOVER API, SO NO DIALOG CLIPS IT. A dialog's body scrolls
 * when the screen is short (0l), and a list positioned inside it would be cut at the body's
 * edge or would push the dialog's height. `popover="manual"` puts it above the dialog and
 * everything else, with no light dismiss of its own — the control says when it closes —
 * and a popover inside a modal dialog stays interactive, because inertness follows the DOM
 * and the list is inside the dialog there. It is placed under its field from the field's
 * own box, fixed to the viewport, and placed again on any scroll or resize while it shows.
 *
 * THE FIELD'S WIDTH, 6 UNDER IT, 5 INSIDE, ROWS AS TALL AS THE FIELD (0a Menu: "a list
 * that opens from a field takes the field's width"). A menu opened from anything but a
 * field — 140 to 280, its longest item — has no caller on this axis yet, so it is not
 * drawn here; the first screen that opens one draws it.
 *
 * AN OPTION IS PRESSED ON `click` AND ITS `mousedown` IS STOPPED, which is what keeps DOM
 * focus on the control: a blur would close the list before the click arrived, and a
 * choice closes on blur by choosing what is under visual focus (the pattern's rule).
 */
export default function Menu({ id, anchorRef, shown, labelId, options, active, onPick }) {
    const listRef = useRef(null);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return undefined;
        if (!shown) {
            if (list.matches(":popover-open")) list.hidePopover();
            return undefined;
        }
        // Where the field is now, and how much of the viewport is left under it: the
        // list scrolls rather than running off the screen.
        const place = () => {
            const field = anchorRef.current;
            if (!field) return;
            const box = field.getBoundingClientRect();
            const offset = parseFloat(getComputedStyle(list).marginTop) || 0;
            list.style.left = `${box.left}px`;
            list.style.top = `${box.bottom}px`;
            list.style.width = `${box.width}px`;
            list.style.maxHeight = `${Math.max(0, window.innerHeight - box.bottom - offset)}px`;
        };
        place();
        if (!list.matches(":popover-open")) list.showPopover();
        window.addEventListener("resize", place);
        document.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            document.removeEventListener("scroll", place, true);
        };
    }, [shown, anchorRef]);

    // The option under visual focus stays in view in a list long enough to scroll.
    useLayoutEffect(() => {
        if (!shown || active < 0) return;
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [shown, active]);

    return (
        <div
            ref={listRef}
            id={id}
            role="listbox"
            aria-labelledby={labelId}
            popover="manual"
            className="inset-auto mx-0 mt-menu-offset mb-0 flex-col overflow-y-auto rounded-card border border-border bg-white p-menu-inset font-ui text-body text-foreground-default shadow-popover open:flex"
        >
            {options.map((option, index) => (
                <div
                    key={option.key}
                    id={`${id}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={option.selected ? "true" : "false"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onPick(index)}
                    className={`flex h-control-lg shrink-0 cursor-pointer items-center justify-between gap-gap rounded-control px-control-inset-x hover:bg-hover ${
                        index === active ? "bg-hover" : ""
                    }`}
                >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {option.detail && (
                        <span className="shrink-0 text-body-sm text-foreground-subtle tabular-nums">{option.detail}</span>
                    )}
                    {option.checked && (
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm shrink-0 text-primary">
                            <path
                                d="M3.4 8.4 6.5 11.5l6.1-7"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            ))}
        </div>
    );
}

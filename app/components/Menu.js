"use client";

import { useLayoutEffect, useRef } from "react";
import { menuIndex, menuKey, typeaheadIndex } from "@/lib/controls";

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
 * it per option and this renders it. #458's two dialogs reach it at a desk: the job is a
 * `Choice` in both, and the check-out's name a `Combobox` whose suggestions are that job's
 * recent names.
 *
 * A LIST MAY CARRY A HEAD ABOVE ITS OPTIONS, THE CHECK-OUT'S `Recently at this job`
 * (#458), which is what the name sheet a phone types in heads its rows with. It is 0h's
 * Label in Ink 3 at an option's side room, and hidden from a screen reader: the list is
 * already named by its field's label, and a listbox owns options and nothing else.
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
 * field — 140 to 280, its longest item — is `ActionMenu` below, which the account at the
 * rail's foot was the first to open (#478).
 *
 * AN OPTION IS PRESSED ON `click` AND ITS `mousedown` IS STOPPED, which is what keeps DOM
 * focus on the control: a blur would close the list before the click arrived, and a
 * choice closes on blur by choosing what is under visual focus (the pattern's rule).
 */
export default function Menu({ id, anchorRef, shown, labelId, heading, options, active, onPick }) {
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
            {heading && (
                <div aria-hidden="true" className="shrink-0 px-control-inset-x py-menu-inset text-heading-sm text-foreground-subtle">
                    {heading}
                </div>
            )}
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

/**
 * The menu a button opens (0a Menu, #478) — the WAI-ARIA menu button's menu. The account
 * at the rail's foot opens the first one, and its one item is `Sign out`.
 *
 * THE FIELD LIST'S FRAME, AND THE OTHER HALF OF 0a's ROW: "its longest item's width, its
 * items the size of the control that opens it, 6 under it, 5 inside". So this is the
 * same top-layer surface as the list above — the Group corner, the Edge, Raised, 5 inside
 * and 6 from its opener — sized 140 to 280 by its longest item, with items as tall as the
 * Control, the 32 the account's button is when the rail is collapsed.
 *
 * IT TAKES FOCUS, WHICH THE FIELD LIST NEVER DOES. A combobox keeps focus in its field and
 * points at an option; the menu button's pattern moves DOM focus onto an item, so the
 * keys are this component's (`lib/controls.js`) and each item is a button that activates
 * itself. It opens on the item `focusOn` names and closes as focus leaves it — Tab, or a
 * press anywhere else — and on Escape, the one close that hands focus back, which is the
 * opener's to do when `onClose("escape")` reaches it. Escape is marked handled, so a Panel
 * the menu sits in keeps its own Escape for the next press.
 *
 * ABOVE ITS OPENER WHEN `placement` SAYS SO. The account sits at the foot of the rail with
 * no room under it, so 0a's "6 under it" is 6 above, and the upward chevron the expanded
 * row draws says which way it opens.
 */
export function ActionMenu({ id, anchorRef, shown, labelledBy, placement = "below", focusOn = "first", items, onClose }) {
    const listRef = useRef(null);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return undefined;
        if (!shown) {
            if (list.matches(":popover-open")) list.hidePopover();
            return undefined;
        }
        const place = () => {
            const opener = anchorRef.current;
            if (!opener) return;
            const box = opener.getBoundingClientRect();
            list.style.left = `${box.left}px`;
            if (placement === "above") {
                list.style.top = "auto";
                list.style.bottom = `${window.innerHeight - box.top}px`;
            } else {
                list.style.bottom = "auto";
                list.style.top = `${box.bottom}px`;
            }
        };
        place();
        if (!list.matches(":popover-open")) list.showPopover();
        const menuItems = list.querySelectorAll('[role="menuitem"]');
        menuItems[focusOn === "last" ? menuItems.length - 1 : 0]?.focus();
        window.addEventListener("resize", place);
        document.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            document.removeEventListener("scroll", place, true);
        };
    }, [shown, anchorRef, placement, focusOn]);

    const onKeyDown = (event) => {
        const action = menuKey(event);
        if (!action || action === "leave") return;
        event.preventDefault();
        if (action === "close") {
            onClose("escape");
            return;
        }
        const menuItems = [...listRef.current.querySelectorAll('[role="menuitem"]')];
        const current = menuItems.indexOf(document.activeElement);
        const next =
            action === "type"
                ? typeaheadIndex(
                      menuItems.map((item) => item.textContent),
                      event.key,
                      current + 1
                  )
                : menuIndex(current, menuItems.length, action);
        menuItems[next]?.focus();
    };

    // Focus going anywhere but into the menu or back to its opener closes it — which is
    // what Tab does, and a press outside. The opener's own press toggles it shut.
    const onBlur = (event) => {
        const next = event.relatedTarget;
        if (next && (listRef.current?.contains(next) || anchorRef.current?.contains(next))) return;
        onClose("leave");
    };

    return (
        <div
            ref={listRef}
            id={id}
            role="menu"
            aria-labelledby={labelledBy}
            popover="manual"
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className={`inset-auto mx-0 w-max min-w-menu max-w-menu flex-col rounded-card border border-border bg-white p-menu-inset font-ui text-body text-foreground-default shadow-popover open:flex ${
                placement === "above" ? "mt-0 mb-menu-offset" : "mt-menu-offset mb-0"
            }`}
        >
            {items.map((item) => (
                <button
                    key={item.key}
                    type={item.type ?? "button"}
                    form={item.form}
                    role="menuitem"
                    tabIndex={-1}
                    onClick={item.onSelect}
                    className="flex h-control w-full shrink-0 items-center rounded-control px-control-inset-x text-left outline-none hover:bg-hover focus:bg-hover"
                >
                    <span className="min-w-0 truncate">{item.label}</span>
                </button>
            ))}
        </div>
    );
}

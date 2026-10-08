"use client";

import { Fragment, useId, useLayoutEffect, useRef } from "react";
import { menuIndex, menuKey, typeaheadIndex } from "@/lib/controls";
import Icon from "./Icon";

// 0a Menu's head, a line that names what follows and answers no pointer: 12 at Ink 3 and
// 400, 6 above and below, 10 either side (#495). The field list's `Recently at this job` and
// the account menu's email are the two.
const MENU_HEADING = "shrink-0 truncate px-control-inset-x py-menu-heading-inset-y text-heading-sm font-normal text-foreground-subtle";

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
 * (#458), which is what the name sheet a phone types in heads its rows with. It is 0a's head
 * since #495 — 0h's Label at 400 in Ink 3, 6 above and below and an option's side room either
 * side — and hidden from a screen reader: the list is already named by its field's label,
 * and a listbox owns options and nothing else. The caller decides when it stands; the
 * check-out's stands only while nothing is typed, since a narrowed list is no longer the
 * recent one.
 *
 * AN OPTION IS 13 SINCE #495, the Beside size the design's final files set every list a field
 * opens in, where it was the field's own 14. An option may name the part of it a typed value
 * matched (`match`), which stands at 600 inside it (1f, 1i).
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
            className="inset-auto mx-0 mt-menu-offset mb-0 flex-col overflow-y-auto rounded-card border border-border bg-white p-menu-inset font-ui text-body-sm text-foreground-default shadow-popover open:flex"
        >
            {heading && (
                <div aria-hidden="true" className={MENU_HEADING}>
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
                    <span className="min-w-0 truncate">
                        {option.match ? (
                            <>
                                {option.match.before}
                                <span className="font-semibold">{option.match.match}</span>
                                {option.match.after}
                            </>
                        ) : (
                            option.label
                        )}
                    </span>
                    {option.detail && (
                        <span className="shrink-0 text-body-sm text-foreground-subtle tabular-nums">{option.detail}</span>
                    )}
                    {option.checked && <Icon name="check" className="size-icon-sm shrink-0 text-primary" />}
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
 * AN ITEM SHOWS FOCUS ONLY AS `focus-visible` (#501). Opening moves focus onto an item by
 * script, so an item drawn on `:focus` meets the press that opened the menu already shaded,
 * as if pointed at — the account's `Sign out` did until #501. The browser marks a focus a
 * script moves visible after a key and not after a press, so a menu opened from the
 * keyboard, or walked with its keys after a press, still shows where focus is. The field
 * list's shaded option is not focus: it is the option `aria-activedescendant` names — the
 * chosen one as a choice opens, which a native select shows the same way — and it is drawn
 * however the list opened.
 *
 * WHERE IT OPENS IS `placement`. The account sits at the foot of the rail with no room under
 * it, so 0a's "6 under it" is 6 above while the rail is expanded, the menu as wide as the row
 * that opens it and the upward chevron saying which way; while it is collapsed the menu stands
 * 8 beside the button, their bottoms aligned (0m, #495).
 *
 * THE ACCOUNT'S MENU IS 0m's SINCE #495: 224 wide — the expanded rail's inner width, written
 * as that difference — whatever its button, a head naming the reader's email above its one
 * item, and the item at 13 and 400. It grows from 0.98 at its corner by the button over
 * 120ms. The head answers no pointer and is no item, so it describes the menu rather than
 * standing in it.
 *
 * `look="record"` IS THE TOOL ITEM PAGE'S `More actions` (#463, 1f and 1j): set against its
 * opener's right end, since the opener stands at the content's edge, and drawn two ways. At
 * a desk it is this frame with the dots' ink meeting its right edge and items at 13, the
 * Beside size 1f draws them at; below the phone's edge it is Tools 0a's Menu — 232 wide, 12
 * from the screen's right edge and 4 under the top bar, the phone's Radius and no room of its
 * own, rows 48 with 16 inside at 17. An item of `tone: "danger"` is 0f's Destructive: red
 * on red's Face under the pointer at a desk, and red at rest on a phone, which 1j draws
 * taking the Face while held.
 *
 * AN ITEM WITH A `detail` IS THE ACCOUNT A PHONE'S MENU ENDS ON (#495, Tools 0a Menu): at
 * least 56 tall, 8 and 16 inside, its word at 17 in Ink and the detail under it at 13 in Ink 3
 * — `Sign out` over the reader's email. It is named by its word and described by its detail.
 * An item marked `separated` stands under a full-width Inner rule when anything stands above
 * it, and alone, with none, when nothing does.
 */
export function ActionMenu({ id, anchorRef, shown, labelledBy, placement = "below", look = "account", focusOn = "first", heading, items, onClose }) {
    const listRef = useRef(null);
    const headingId = useId();

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
            // A record's menu is set against its opener's right end, the class's margin
            // pulling it in from there; one beside its opener from the opener's right edge;
            // every other from its left.
            if (look === "record") {
                list.style.left = "auto";
                list.style.right = `${document.documentElement.clientWidth - box.right}px`;
            } else {
                list.style.left = `${placement === "beside" ? box.right : box.left}px`;
            }
            // Above its opener the menu's foot is the opener's top; beside it, the opener's
            // foot, so the two stand on one line; under it, its top is the opener's foot.
            if (placement === "above" || placement === "beside") {
                list.style.top = "auto";
                list.style.bottom = `${window.innerHeight - (placement === "above" ? box.top : box.bottom)}px`;
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
    }, [shown, anchorRef, placement, look, focusOn]);

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
            aria-describedby={heading ? headingId : undefined}
            popover="manual"
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className={`inset-auto flex-col border border-border bg-white font-ui text-body text-foreground-default shadow-popover open:flex ${MENU_LOOK[look]} ${PLACEMENT[placement]}`}
        >
            {heading && (
                <div id={headingId} aria-hidden="true" className={MENU_HEADING}>
                    {heading}
                </div>
            )}
            {items.map((item, index) => {
                const labelId = `${id}-${item.key}-label`;
                const detailId = `${id}-${item.key}-detail`;
                return (
                    <Fragment key={item.key}>
                        {item.separated && index > 0 && <div aria-hidden="true" className="h-px shrink-0 bg-divider-subtle" />}
                        <button
                            type={item.type ?? "button"}
                            form={item.form}
                            role="menuitem"
                            tabIndex={-1}
                            onClick={item.onSelect}
                            aria-labelledby={item.detail ? labelId : undefined}
                            aria-describedby={item.detail ? detailId : undefined}
                            className={`flex w-full shrink-0 text-left outline-none ${item.detail ? DETAIL_ITEM : `items-center ${ITEM_LOOK[look]}`} ${
                                item.tone === "danger" ? DANGER_ITEM[look] : item.detail ? "focus-visible:bg-hover active:bg-hover" : "hover:bg-hover focus-visible:bg-hover"
                            }`}
                        >
                            {item.detail ? (
                                <>
                                    <span id={labelId} className="max-w-full truncate text-mobile-heading text-foreground-default">
                                        {item.label}
                                    </span>
                                    <span id={detailId} className="max-w-full truncate text-body-sm text-foreground-subtle">
                                        {item.detail}
                                    </span>
                                </>
                            ) : (
                                <span className="min-w-0 truncate">{item.label}</span>
                            )}
                        </button>
                    </Fragment>
                );
            })}
        </div>
    );
}

// Where each placement sets the menu from its opener: under it at 0a's 6, above it at the
// same 6, or beside the collapsed rail's account at 0m's 8, where the rows run on one line.
const PLACEMENT = {
    below: "mt-menu-offset mb-0",
    above: "mx-0 mt-0 mb-menu-offset",
    beside: "my-0 mr-0 ml-account-menu-offset-x",
};

// The frame each look draws. A record's margins are written as the differences they are: at
// a desk the 8 between its opener's box and the dots' ink, so the menu meets the content's
// edge; on a phone the 12 from the screen's edge less the top bar's 4 on the right, and the 4
// under the top bar plus the 4 between the 48 button and the bar's foot. The account's width
// is the expanded rail's inside — its 248 less the 12 either side — and it grows from the
// corner by its button.
const MENU_LOOK = {
    account:
        "w-[calc(var(--width-rail-expanded)-2*var(--spacing-rail-inset))] rounded-card p-menu-inset origin-bottom-left open:animate-account-menu",
    record:
        "ml-0 w-max min-w-menu max-w-menu rounded-card p-menu-inset mr-[calc((var(--height-control)-var(--size-icon))/2)] " +
        "max-sm:w-mobile-menu max-sm:min-w-0 max-sm:max-w-none max-sm:overflow-hidden max-sm:rounded-mobile-control max-sm:p-0 " +
        "max-sm:mt-[calc(var(--spacing-mobile-menu-offset)+(var(--height-mobile-top-bar)-var(--spacing-mobile-touch-target))/2)] " +
        "max-sm:mr-[calc(var(--spacing-mobile-menu-gutter)-var(--spacing-mobile-top-bar-inset-right))]",
};

// An item at each look: the Control's height and the Group corner at a desk, at 13 and 400,
// and on a phone 0a's 48 row at 17 with nothing rounded, the menu's own corner clipping it.
const ITEM_LOOK = {
    account: "h-control rounded-control px-control-inset-x text-body-sm",
    record:
        "h-control rounded-control px-control-inset-x text-body-sm " +
        "max-sm:h-mobile-touch-target max-sm:rounded-none max-sm:px-mobile-menu-row-inset-x max-sm:text-mobile-heading",
};

// The account a phone's menu ends on (Tools 0a Menu, #495): a row at least 56 tall, 8 above
// and below and 16 either side, its word over its detail. It takes the Hover face while held,
// as the menu's other rows do on a phone.
const DETAIL_ITEM = "min-h-mobile-menu-account flex-col items-start justify-center px-mobile-menu-row-inset-x py-mobile-menu-account-inset-y";

// 0f's Destructive item: red on red's Face under the pointer or the keyboard at a desk, and
// on a phone red at rest, taking the Face while held. The keyboard's is `focus-visible`, as
// every item's is (`ActionMenu`), so a press that opened the menu meets the item at rest, as
// 1f draws it.
const DANGER_ITEM = {
    account: "hover:bg-danger-subtle hover:text-danger focus-visible:bg-danger-subtle focus-visible:text-danger",
    record:
        "hover:bg-danger-subtle hover:text-danger focus-visible:bg-danger-subtle focus-visible:text-danger " +
        "max-sm:text-danger max-sm:hover:bg-transparent max-sm:focus-visible:bg-transparent max-sm:active:bg-danger-subtle",
};

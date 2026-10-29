"use client";

import { Fragment, useId, useLayoutEffect, useRef, useState } from "react";
import { clickFromKeys, menuButtonKey, menuIndex, menuKey, typeaheadIndex } from "@/lib/controls";
import Icon from "./Icon";
import { SCROLL_LANE } from "./scrollLane";

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
 * AN OPTION MAY CARRY A NOTE AFTER ITS LABEL (#519): a job's name after its code, at Ink 3 and
 * 8 on, cut before the code is, as 1b and 1i draw the jobs a dialog offers. A label marked
 * `strong` is set at 500 in even figures, as those lists and 1d's and 1f's draw a job's code.
 * Label and note are two boxes of the row, so assistive tech reads a space between them.
 *
 * A LIST THAT HOLDS ITS CHECK'S ROOM ON EVERY OPTION IS `checkSlot` (#540), the sort's: the check
 * stands 10 past the words in a 14 that every option keeps, so the list is as wide whichever option
 * is chosen, as 1a, 1d and 1l draw it.
 *
 * A LIST THAT TAKES SEVERAL VALUES MARKS EACH OPTION WITH A BOX (0a Menu, #520) — the filter
 * chips over the category list — checked for one taken, 10 before its name as 1a draws it, and
 * says so as `aria-multiselectable`, each option's `aria-selected` then whether it is taken. A
 * `detail` is "a value that helps the choice", at its end at Ink 3 and at least 24 from the name
 * (0a) — a chip's option its count, a suggestion its place.
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
 * rail's foot was the first to open (#478). **A list a chip or a breadcrumb level opens is
 * sized the menu's way (#519)**, since neither is a field: `fit="end"` sets it against the
 * chip's right end at least as wide as the chip, as 1b draws its type's and category's, and
 * `fit="start"` from the control's left, as 1d and 1f draw a level's and 1a the job's chip's
 * since #566; its rows are as tall as what opened it — 32 under an inline level or a 32 chip
 * (`rows="sm"`), "as tall as the control that opens it, and 32 when that control is Inline".
 * `minWidth` is a least width of the drawing's own, held with the control's: 1a's job list is
 * at least 160 and never narrower than its chip.
 *
 * AN OPTION IS PRESSED ON `click` AND ITS `mousedown` IS STOPPED, which is what keeps DOM
 * focus on the control: a blur would close the list before the click arrived, and a
 * choice closes on blur by choosing what is under visual focus (the pattern's rule).
 *
 * THE OPTION UNDER VISUAL FOCUS IS SHADED ONLY WHERE A KEY PUT IT THERE (#522). `active` is the
 * option `aria-activedescendant` names, and `shade` is whether the keyboard brought it there:
 * a list a press opened shows the one chosen by its check alone, as 0a's Menu marks a list you
 * choose one from, and the pointer shades what it is on; until #522 the chosen row took Hover
 * however the list opened (#501), which read as a row the pointer was on. Every figure in a
 * list is tabular (0h), so a column of job codes holds one width. **A list opening with nothing
 * under visual focus shows the option it checks**, scrolled into view (#555): the catalog's
 * fields open on everything they offer with the value they hold checked somewhere in it.
 *
 * A LIST THAT SCROLLS DOES SO IN 0i's BAR, AND STOPS AT ITS END (#555). Every list here scrolls
 * once the room under its control runs out, and until #555 it did so in the browser's own bar —
 * 15 wide with its arrows — since nothing measured off the DOM shows a scrollbar, #538's reading
 * missed it. Each draws `SCROLL_LANE` now, the one string every lane reads, and keeps a scroll past
 * its end from moving what is behind it (0i Chain). **A list drawn as a lane of its own is handed
 * `lane`**, the `max-h-*` class of the height its drawing stops it at, and stands at that height or
 * the room under its control, whichever is less — 1l's band chips at 340 and its dialog's two
 * fields at 228.
 *
 * THE BAR TAKES ITS 8 ONLY WHILE IT SHOWS, IN EVERY LIST (Soo, #555). 1l reserves the 8 on its
 * lanes whether or not the bar shows (0i Gutter), so its two-option `Type` and `Class` stood 8
 * wider on the right than on the left with nothing to scroll; none reserves it here. A list as wide
 * as its options grows by the 8 while its bar shows, and one as wide as its field gives its options
 * the 8 then, so a list that scrolls draws as 1l's does and one that does not as 1a's.
 *
 * WHAT SCROLLS STANDS 5 INSIDE THE EDGE ABOVE AND BELOW, AT REST AND WHILE IT SCROLLS (Soo, #555).
 * The frame holds the Menu's 5 above and below, and the options scroll in a region inside it, so a
 * row passing the top or the foot is cut 5 inside the Edge rather than at it; the region holds the 5
 * either side, and the bar runs its height. 1l pads the scrolling box itself, which leaves a row
 * scrolled to the middle touching the Edge; at rest the two draw alike.
 */
export default function Menu({ id, anchorRef, shown, labelId, heading, options, active, shade = true, onPick, fit = "field", minWidth, rows = "lg", multiselectable = false, checkSlot = false, lane }) {
    const listRef = useRef(null);
    const checkedIndex = options.findIndex((option) => option.checked);

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
            if (fit === "end") {
                list.style.left = "auto";
                list.style.right = `${document.documentElement.clientWidth - box.right}px`;
                list.style.minWidth = `max(var(--min-width-menu), ${box.width}px)`;
            } else {
                list.style.left = `${box.left}px`;
                if (fit === "field") list.style.width = `${box.width}px`;
                if (minWidth) list.style.minWidth = `max(${minWidth}, ${box.width}px)`;
            }
            list.style.top = `${box.bottom}px`;
            // The room under the field, or a lane's own height where that is less: the class
            // gives the second, read with the inline height cleared.
            const room = Math.max(0, window.innerHeight - box.bottom - offset);
            list.style.maxHeight = "";
            const own = parseFloat(getComputedStyle(list).maxHeight);
            list.style.maxHeight = `${Number.isNaN(own) ? room : Math.min(own, room)}px`;
        };
        place();
        if (!list.matches(":popover-open")) list.showPopover();
        window.addEventListener("resize", place);
        document.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            document.removeEventListener("scroll", place, true);
        };
    }, [shown, anchorRef, fit, minWidth]);

    // The option under visual focus stays in view in a list long enough to scroll, and the one
    // it checks while none is.
    useLayoutEffect(() => {
        const index = active >= 0 ? active : checkedIndex;
        if (!shown || index < 0) return;
        listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
    }, [shown, active, checkedIndex]);

    return (
        <div
            ref={listRef}
            id={id}
            role="listbox"
            aria-labelledby={labelId}
            aria-multiselectable={multiselectable || undefined}
            popover="manual"
            className={`inset-auto mx-0 mt-menu-offset mb-0 flex-col rounded-card border border-border bg-white py-menu-inset font-ui text-body-sm text-foreground-default tabular-nums shadow-popover open:flex ${
                fit === "field" ? "" : "w-max min-w-menu max-w-menu"
            } ${lane ?? ""}`}
        >
            <div className={`flex min-h-0 flex-col overflow-y-auto overscroll-contain px-menu-inset ${SCROLL_LANE}`}>
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
                        className={`flex ${rows === "sm" ? "h-control" : "h-control-lg"} shrink-0 cursor-pointer items-center justify-between ${
                            checkSlot ? "gap-sort-check-gap" : "gap-gap"
                        } rounded-control px-control-inset-x hover:bg-hover ${index === active && shade ? "bg-hover" : ""}`}
                    >
                        {multiselectable && (
                            <span
                                aria-hidden="true"
                                className={`mr-[calc(var(--spacing-menu-box-gap)-var(--spacing-gap))] flex size-icon shrink-0 items-center justify-center rounded-badge border ${
                                    option.selected ? "border-primary bg-primary" : "border-checkbox-border bg-white"
                                }`}
                            >
                                {option.selected && <Icon name="check" className="size-checkbox-mark text-white" />}
                            </span>
                        )}
                        <span
                            className={`${option.note ? "shrink-0" : `min-w-0 truncate ${multiselectable || checkSlot ? "flex-1" : ""}`} ${option.strong ? "font-medium tabular-nums" : ""}`}
                        >
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
                        {option.note && <span className="min-w-0 flex-1 truncate text-foreground-subtle">{option.note}</span>}
                        {option.detail !== undefined && option.detail !== null && option.detail !== "" && (
                            <span className="shrink-0 pl-[calc(var(--spacing-menu-value-inline)-var(--spacing-gap))] text-body-sm text-foreground-subtle tabular-nums">
                                {option.detail}
                            </span>
                        )}
                        {checkSlot ? (
                            <span aria-hidden="true" className="flex size-icon-sm shrink-0">
                                {option.checked && <Icon name="check" className="size-icon-sm text-primary" />}
                            </span>
                        ) : (
                            option.checked && <Icon name="check" className="size-icon-sm shrink-0 text-primary" />
                        )}
                    </div>
                ))}
            </div>
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
 * WHAT SHADES AN ITEM FOLLOWS THE HAND, NOT THE WIDTH (#501, #578), and `ITEM_FACE` below is
 * all of it. Opening moves focus onto an item by script. Under a mouse an item shows that
 * focus only as `focus-visible`, so a press that opened the menu meets the item at rest: drawn
 * on `:focus`, the account's `Sign out` met the press shaded until #501. Under a finger the
 * browser's verdict is not one to read: on a phone Safari marked the item a tap opened the menu
 * on `focus-visible`, so the asset page's menu opened on `Send for repair` shaded, and on
 * `Sign out` where it held nothing else (#578). So under a finger — `pointer: coarse`, as a
 * field's 16 is (#568), and not the width, since a phone on its side is past the phone's edge
 * and opens the desk's menu — an item takes its face while held and at no other time, but in a
 * menu a key opened or walked, where it shows focus on `:focus`. `keyed` is the opener's word
 * that its key opened the menu — an arrow, or Enter and Space, which reach it as a click no
 * press is behind (`lib/controls.js:clickFromKeys`) — and every key that moves focus here says
 * the same, which is the app's reading of the hand rather than the browser's, as the field
 * list's shaded option is one since #522 (`Menu`'s `shade`). The size, the type and the red at
 * rest are the phone's frame and follow the width as before.
 *
 * WHY SAFARI SAYS `focus-visible` THERE WAS NOT SETTLED FROM ITS SOURCE. WebKit records a press
 * on a button that takes no focus as a click, and makes a script's focus after one invisible
 * (webkit.org/b/236782, Safari 15.5); whether a tap on iOS reaches that path was not found. A
 * mouse keeps the browser's verdict, since the desk was to be left as it was, and the two
 * readings become one — `in-data-keyed:focus` for the mouse as well — once a desk browser is
 * seen marking an item a press opened the menu on, or the design asks a mouse to read the same.
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
 * `look="record"` IS THE ASSET PAGE'S `More actions` (#463, 1f and 1j): set against its
 * opener's right end, since the opener stands at the content's edge, and drawn two ways. At
 * a desk it is this frame with the dots' ink meeting its right edge and items at 13, the
 * Beside size 1f draws them at, 152 wide (below); below the phone's edge it is Tools 0a's
 * Menu — 232 inside its Edge, 12
 * from the screen's right edge and 4 under the top bar, the phone's Radius and no room of its
 * own, rows 48 with 16 inside at 17. An item of `tone: "danger"` is 0f's Destructive: red
 * on red's Face under the pointer at a desk, and red at rest on a phone, which 1j draws
 * taking the Face while held, as every item takes its face under a finger.
 *
 * AN ITEM WITH A `detail` IS THE ACCOUNT A PHONE'S MENU ENDS ON (#495, Tools 0a Menu): at
 * least 56 tall, 8 and 16 inside, its word at 17 in Ink and the detail under it at 13 in Ink 3
 * — `Sign out` over the reader's email. It is named by its word and described by its detail.
 * An item marked `separated` stands under a full-width Inner rule when anything stands above
 * it, and alone, with none, when nothing does.
 *
 * `look="end"` IS A MENU SET FLUSH AGAINST ITS OPENER'S RIGHT END (1l, #527), at least as wide as
 * the opener and up to 280 inside its room and its Edge — a dialog's `More actions`, whose 28 has
 * no ink to meet the content's edge as the asset page's 32 does. Its items are as tall as the
 * control that opens it, 0a's rule and 1l's drawing: the 28 of a dialog head's close. **Its least
 * width is 1l's**, as #522 took every menu's from its drawing: 140 inside its room and its Edge,
 * as the record's is. The catalog's selection bar opened one above a 36 from #527 until #552,
 * its rows 36 and its 140 counted outside the Edge, and went with `Set class`.
 */
export function ActionMenu({ id, anchorRef, shown, labelledBy, placement = "below", look = "account", focusOn = "first", keyed = false, heading, items, onClose }) {
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
            if (look === "record" || look === "end") {
                list.style.left = "auto";
                list.style.right = `${document.documentElement.clientWidth - box.right}px`;
                if (look === "end") list.style.minWidth = `max(calc(var(--min-width-menu) + 2 * var(--spacing-menu-inset) + 2px), ${box.width}px)`;
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
        // Whether a key opened it, said before focus lands so the item draws right at once.
        list.toggleAttribute("data-keyed", keyed);
        const menuItems = list.querySelectorAll('[role="menuitem"]');
        menuItems[focusOn === "last" ? menuItems.length - 1 : 0]?.focus();
        window.addEventListener("resize", place);
        document.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            document.removeEventListener("scroll", place, true);
        };
    }, [shown, anchorRef, placement, look, focusOn, keyed]);

    const onKeyDown = (event) => {
        const action = menuKey(event);
        if (!action || action === "leave") return;
        event.preventDefault();
        if (action === "close") {
            onClose("escape");
            return;
        }
        // A key moving focus is the keyboard at work, so the menu shows where focus is (#578).
        listRef.current.toggleAttribute("data-keyed", true);
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
                                item.tone === "danger" ? `${ITEM_FACE.danger} ${DANGER_AT_REST[look] ?? ""}` : ITEM_FACE.plain
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

/**
 * A button that opens a menu set flush at its end (1l, #527) — WAI-ARIA's menu button, as the
 * asset page's `More actions` and the rail's account are: it says it opens a menu and whether it
 * is open, Enter, Space and Down open it on its first item and Up on its last, and Escape hands
 * focus back here. Choosing an item hands focus here before the item acts, so whatever the item
 * opens returns it here as the browser's modal dialog does.
 *
 * A DIALOG'S HEAD BUTTON: 28 square at the Control radius, its 14 dots in Ink 3, taking Hover and
 * Ink under the pointer and while its menu is open — 1l's `More actions`, named by `label` alone.
 * `locked` is a busy dialog's (#469): its look kept, no press taken. From #527 until #552 it had
 * a second look, 0a's bordered Commitment with its word and a chevron, for `Set class`.
 */
export function MenuButton({ label, locked = false, items }) {
    const [open, setOpen] = useState(false);
    const [focusOn, setFocusOn] = useState("first");
    const [keyed, setKeyed] = useState(false);
    const buttonRef = useRef(null);
    const id = useId();
    const buttonId = `${id}-button`;
    const menuId = `${id}-menu`;

    const openOn = (where, byKey) => {
        if (locked) return;
        setFocusOn(where);
        setKeyed(byKey);
        setOpen(true);
    };
    const close = (how) => {
        setOpen(false);
        if (how === "escape") buttonRef.current?.focus();
    };

    return (
        <div className="flex">
            <button
                ref={buttonRef}
                id={buttonId}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={label}
                aria-disabled={locked || undefined}
                onClick={(event) => (open ? close("toggle") : openOn("first", clickFromKeys(event)))}
                onKeyDown={(event) => {
                    const where = menuButtonKey(event);
                    if (!where || open) return;
                    event.preventDefault();
                    openOn(where, true);
                }}
                className={MENU_BUTTON_LOOK}
            >
                <Icon name="ellipsis" className="size-icon-sm" />
            </button>
            <ActionMenu
                id={menuId}
                anchorRef={buttonRef}
                shown={open}
                labelledBy={buttonId}
                look="end"
                focusOn={focusOn}
                keyed={keyed}
                items={items.map((item) => ({
                    ...item,
                    onSelect: () => {
                        buttonRef.current?.focus();
                        setOpen(false);
                        item.onSelect();
                    },
                }))}
                onClose={close}
            />
        </div>
    );
}

const MENU_BUTTON_LOOK =
    "flex aspect-square h-dialog-close shrink-0 items-center justify-center rounded-control text-foreground-subtle not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-foreground-default aria-expanded:bg-hover aria-expanded:text-foreground-default";

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
//
// A RECORD'S MENU TAKES 0a's WIDTHS INSIDE ITS ROOM AND ITS EDGE, AS 1f AND 1j DRAW IT (#522):
// at a desk 140 to 280 inside its 5 and its Edge, so 152 on the asset page, and on a phone 232
// inside its Edge, 234 in all. The lists a field or a chip opens hold 140 with both counted,
// as 1a draws them, and the account's 224 is its own.
const MENU_LOOK = {
    account:
        "w-[calc(var(--width-rail-expanded)-2*var(--spacing-rail-inset))] rounded-card p-menu-inset origin-bottom-left open:animate-account-menu",
    record:
        "ml-0 w-max min-w-[calc(var(--min-width-menu)+2*var(--spacing-menu-inset)+2px)] max-w-[calc(var(--max-width-menu)+2*var(--spacing-menu-inset)+2px)] rounded-card p-menu-inset mr-[calc((var(--height-control)-var(--size-icon))/2)] " +
        "max-sm:w-[calc(var(--width-mobile-menu)+2px)] max-sm:min-w-0 max-sm:max-w-none max-sm:overflow-hidden max-sm:rounded-mobile-control max-sm:p-0 " +
        "max-sm:mt-[calc(var(--spacing-mobile-menu-offset)+(var(--height-mobile-top-bar)-var(--spacing-mobile-touch-target))/2)] " +
        "max-sm:mr-[calc(var(--spacing-mobile-menu-gutter)-var(--spacing-mobile-top-bar-inset-right))]",
    end: "mx-0 w-max min-w-[calc(var(--min-width-menu)+2*var(--spacing-menu-inset)+2px)] max-w-[calc(var(--max-width-menu)+2*var(--spacing-menu-inset)+2px)] rounded-card p-menu-inset",
};

// An item at each look: the Control's height and the Group corner at a desk, at 13 and 400,
// and on a phone 0a's 48 row at 17 with nothing rounded, the menu's own corner clipping it.
const ITEM_LOOK = {
    account: "h-control rounded-control px-control-inset-x text-body-sm",
    record:
        "h-control rounded-control px-control-inset-x text-body-sm " +
        "max-sm:h-mobile-touch-target max-sm:rounded-none max-sm:px-mobile-menu-row-inset-x max-sm:text-mobile-heading",
    // A menu set flush at its opener's end has items its opener's height (0a): the close's 28.
    end: "h-dialog-close rounded-control px-control-inset-x text-body-sm whitespace-nowrap",
};

// The account a phone's menu ends on (Tools 0a Menu, #495): a row at least 56 tall, 8 above
// and below and 16 either side, its word over its detail. Its faces are a plain item's.
const DETAIL_ITEM = "min-h-mobile-menu-account flex-col items-start justify-center px-mobile-menu-row-inset-x py-mobile-menu-account-inset-y";

// What shades an item, by its tone and for every look (#578): the Hover face, or 0f's
// Destructive, red on red's Face. Under a mouse the pointer and the keyboard's `focus-visible`
// give it, as they did before; under a finger a row takes it while held, and under focus only
// in a menu a key opened or walked (`ActionMenu`), as 1f and 1j draw a press meeting the item
// at rest.
const ITEM_FACE = {
    plain:
        "not-pointer-coarse:hover:bg-hover not-pointer-coarse:focus-visible:bg-hover " +
        "pointer-coarse:active:bg-hover pointer-coarse:in-data-keyed:focus:bg-hover",
    danger:
        "not-pointer-coarse:hover:bg-danger-subtle not-pointer-coarse:hover:text-danger " +
        "not-pointer-coarse:focus-visible:bg-danger-subtle not-pointer-coarse:focus-visible:text-danger " +
        "pointer-coarse:active:bg-danger-subtle pointer-coarse:active:text-danger " +
        "pointer-coarse:in-data-keyed:focus:bg-danger-subtle pointer-coarse:in-data-keyed:focus:text-danger",
};

// A record's destructive item is red at rest on a phone (1j). That is the phone's frame rather
// than the hand, so it follows the width, as the item's size does.
const DANGER_AT_REST = {
    record: "max-sm:text-danger",
};

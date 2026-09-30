"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import { TOOL_REGISTRATION_COPY as COPY, accountToTell } from "@/lib/toolRegistration";
import { RegistrationForm, RegistrationOpener, useRegistrationOpening } from "../RegistrationDialog";

// What a registration that fell short offers where it lands (#449): write the rest, or
// be done. A FORK AND NOT A NOTICE, and the difference is what the markup carries — two
// answers to one question, where the notice told before it (`RegistrationUnlogged.js`),
// naming tool items with no history, carries one control that answers nothing, because
// nothing repairs those.
//
// A DIALOG OVER THE PAGE SINCE #459, THE DESIGN'S 1k: how many of how many were created
// is its title (#455), the tool is the line under it, and how many were not is its one
// sentence. The first needs `asked`, which the landing's address carries beside
// `unwritten` for exactly this, and what was created is the one less the other. It is
// told after the notice when a landing carries both — `accountToTell` has why — and it
// is open while the page found a shortfall and `unwritten` is still on the address, so
// the address stays the one account of whether the question is asked.
//
// NOT A `done` FLAG, AND THE REASON IS WHAT NEXT KEEPS. The page's state survives a
// landing on this same route at another address — the router keys a page's state on its
// segment without the query (`createRouterCacheKey(…, true)` in the installed 16.2.10's
// `layout-router.js`), which is what kept #456's dialog open over its own landing — so a
// flag one landing's `Not now` set would hide the next landing's question. Not seen for
// this fork: reaching it takes a registration that falls short, which takes the base
// failing. Read off the address, a new landing asks again because it carries the
// question again.
//
// `Create the rest` PUTS THE FORK AWAY AND OPENS THE REGISTRATION DIALOG ON THIS TOOL WITH
// THE COUNT FILLED IN, the count still the person's to change there — 1k's own answer,
// which closes the one before it opens the other rather than stacking them. The
// registration's rule is #456's and is not repeated here: it is open while the address
// is the one it was opened at (`useRegistrationOpening`). Canceling it brings the fork
// back, because nothing answered it — the question stands until `Not now`, and the
// address still carries it, so the screen says what a reload would. A registration that
// lands answers it by moving the address, and the new one carries only its own account.
// For a reader on no job the answer is drawn disabled with the reason before it, as every
// opener is (#456).
//
// `Not now` IS THE OTHER ANSWER, AND IT ENDS THE QUESTION: `asked` and `unwritten` leave
// the address, so a reload does not ask again. The close and Escape answer it too — the
// design sends its close to the same place, and the frame makes Escape the close — so no
// way out of the dialog leaves the question on the address with nothing on the screen.
// The two answers are a pair on purpose — one goes on creating and one stops — which is
// what says the choice is about the shortfall and not about the notice.
//
// THE DISMISSAL EDITS THE CURRENT ADDRESS AND THE FORK'S TWO KEYS OF IT. The list's
// boxes rewrite the address without a render (`ToolItemList.js`'s header has why), so an
// address built from anything this render was handed would put back a selection the
// reader has since changed. It deletes `asked` and `unwritten` and nothing else: the
// page, the selection and the notice's `unlogged` stay where they are.
// `history.replaceState` rather than the router, for #443's reason — a navigation
// renders the page again, four operations to take away one dialog.
//
// NO PRESS OPENED IT, so it is `unprompted` and hands focus to the page's heading as it
// closes (`DialogFrame.js`).
//
// EVERY WORD IS `TOOL_REGISTRATION_COPY`'s, this axis's rule since #338: they are a
// registration's words wherever they are drawn, which is also why the fork is a file of
// its own rather than part of the list.
export default function RegistrationShortfall({ toolName, account, canRegister, jobs }) {
    const address = useSearchParams();
    const registration = useRegistrationOpening();
    const told = accountToTell(account, address) === "shortfall";

    const notNow = () => {
        const current = new URL(window.location.href);
        current.searchParams.delete("asked");
        current.searchParams.delete("unwritten");
        window.history.replaceState(null, "", `${current.pathname}${current.search}`);
    };

    return (
        <>
            <DialogFrame
                open={told && !registration.open}
                onClose={notNow}
                unprompted
                title={COPY.shortfallHeading({ created: account.asked - account.unwritten, asked: account.asked })}
                subtitle={toolName}
            >
                <DialogBody>
                    <DialogMessage>{COPY.shortfall(account.unwritten)}</DialogMessage>
                </DialogBody>
                <DialogActions>
                    <Button variant="bordered" onClick={notNow}>
                        {COPY.doneRegistering}
                    </Button>
                    <RegistrationOpener canRegister={canRegister} onOpen={registration.start}>
                        {COPY.registerOthers}
                    </RegistrationOpener>
                </DialogActions>
            </DialogFrame>
            {canRegister && (
                <RegistrationForm
                    key={registration.opening}
                    open={registration.open}
                    onClose={registration.close}
                    jobs={jobs}
                    tool={{ toolName }}
                    quantity={account.unwritten}
                />
            )}
        </>
    );
}

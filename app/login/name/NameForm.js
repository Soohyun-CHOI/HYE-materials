"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Button, Field, TextInput } from "@/app/components/Controls";
import { DESTINATION_PARAM } from "@/lib/loginDestination";
import { judgeName, USER_NAME_COPY } from "@/lib/userName";
import BottomBar from "@/app/components/BottomBar";
import { PageRefusal, SignInHeader } from "../SignInParts";
import { setUserNameAction } from "./actions";

/**
 * The two fields the name step asks for (#381), drawn as the design draws them (#473, 1c
 * and 1g): the step's own heading, two labeled fields — side by side at a desk, one above
 * the other on a phone — and `Continue`.
 *
 * EVERY WORD COMES FROM `lib/userName.js`, not from this file. A string written into JSX
 * cannot be pinned by `offline/screen-briefs.mjs`, so the copy constant is what keeps the
 * screen's words held.
 *
 * THE DESTINATION RIDES AS A HIDDEN FIELD, the same shape `/login/confirm` uses for the
 * same value. The page has already judged it and the action judges it again, so this
 * component carries it without knowing anything about it — and nothing on the screen says
 * a word about where the reader was going, which is the silence the steps before this one
 * keep.
 *
 * A REFUSAL STANDS UNDER THE NAME IT IS ABOUT, BOTH AT ONCE. `judgeName` is asked here
 * before anything is sent and again by the action, which is reachable without this
 * screen; a write that fails is the step's own refusal, where a refusal of the whole page
 * stands (0o). The action returns rather than throws, which is #185's rule for an action
 * whose call site binds the return — `useActionState` does.
 *
 * THE FIELDS HOLD WHAT WAS TYPED THEMSELVES. They are the screen's state, so a refusal,
 * a failed write and a second try all leave both names where they were, and the action is
 * handed the form rather than taking it, so React's reset of a form after its action has
 * no form to reset.
 */
export default function NameForm({ destination = "" }) {
    const [state, formAction, pending] = useActionState(setUserNameAction, {});
    const [first, setFirst] = useState("");
    const [last, setLast] = useState("");
    const [refusals, setRefusals] = useState({});
    const [answered, setAnswered] = useState(state);
    const lastField = useRef(null);

    // The action's own judgment replaces the screen's whenever it answers — adjusted as the
    // answer is rendered, React's way of following a value from the render before.
    if (state !== answered) {
        setAnswered(state);
        setRefusals(state?.refusals ?? {});
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (pending) return; // a second press while the first is on its way
        const judged = judgeName({ firstName: first, lastName: last });
        if (judged.refusals) {
            setRefusals(judged.refusals);
            return;
        }
        setRefusals({});
        const form = new FormData(event.currentTarget);
        startTransition(() => formAction(form));
    }

    // The keyboard's return key reads `next` while a field follows, and takes the reader
    // there rather than sending the form (Tools 0a Keyboard).
    function nextOnReturn(event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        lastField.current?.focus();
    }

    function typed(setValue, key) {
        return (value) => {
            setValue(value);
            if (refusals[key]) setRefusals((was) => ({ ...was, [key]: undefined }));
        };
    }

    const failed = Boolean(state?.error) && !pending;
    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
            <SignInHeader heading={USER_NAME_COPY.heading} />
            <input type="hidden" name={DESTINATION_PARAM} value={destination} />
            <div className="mt-sign-in-header-stack grid grid-cols-2 items-start gap-sign-in-form-inline max-sm:grid-cols-1 max-sm:gap-mobile-field-stack">
                <Field label={USER_NAME_COPY.firstLabel} size="xl" refusal={refusals.first ?? null}>
                    <TextInput
                        size="xl"
                        name="firstName"
                        value={first}
                        onChange={typed(setFirst, "first")}
                        readOnly={pending}
                        autoComplete="given-name"
                        autoCapitalize="words"
                        spellCheck={false}
                        enterKeyHint="next"
                        onKeyDown={nextOnReturn}
                        autoFocus
                    />
                </Field>
                <Field label={USER_NAME_COPY.lastLabel} size="xl" refusal={refusals.last ?? null}>
                    <TextInput
                        size="xl"
                        inputRef={lastField}
                        name="lastName"
                        value={last}
                        onChange={typed(setLast, "last")}
                        readOnly={pending}
                        autoComplete="family-name"
                        autoCapitalize="words"
                        spellCheck={false}
                        enterKeyHint="done"
                    />
                </Field>
            </div>
            {failed && <PageRefusal>{state.error}</PageRefusal>}
            <BottomBar stack={failed ? "refusal" : "form"}>
                <Button type="submit" size="xl" busy={pending} busyLabel={USER_NAME_COPY.working}>
                    {USER_NAME_COPY.action}
                </Button>
            </BottomBar>
        </form>
    );
}

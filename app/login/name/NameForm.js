"use client";

import { useActionState } from "react";
import { DESTINATION_PARAM } from "@/lib/loginDestination";
import { MAX_NAME_LENGTH, USER_NAME_COPY } from "@/lib/userName";
import { setUserNameAction } from "./actions";

/**
 * The two fields the name step asks for (#381).
 *
 * EVERY WORD COMES FROM `lib/userName.js`, not from this file. A string written
 * into JSX is invisible to `scripts/screen-strings.mjs`, so it is invisible to
 * every vocabulary sweep this repository runs — the copy constant is what keeps
 * the screen's words findable.
 *
 * THE DESTINATION RIDES AS A HIDDEN FIELD, the same shape `/login/confirm` uses
 * for the same value. The page has already judged it and the action judges it
 * again, so this component carries it without knowing anything about it — and
 * nothing on the screen says a word about where the reader was going, which is
 * the silence both screens before this one already keep.
 *
 * ONE ERROR SLOT, because the action returns `{ error }` rather than throwing:
 * `useActionState` binds the return, which is #185's rule for which shape a
 * refusal takes.
 */
export default function NameForm({ destination = "" }) {
    const [state, formAction, pending] = useActionState(setUserNameAction, {});

    return (
        <form action={formAction} className="mt-4 space-y-4">
            <div>
                <p className="text-zinc-600">{USER_NAME_COPY.body}</p>
                <p className="mt-1 text-sm text-zinc-500">{USER_NAME_COPY.note}</p>
            </div>

            <input type="hidden" name={DESTINATION_PARAM} value={destination} />

            <label className="block">
                <span className="text-sm text-zinc-600">{USER_NAME_COPY.firstLabel}</span>
                <input
                    type="text"
                    name="firstName"
                    required
                    autoFocus
                    maxLength={MAX_NAME_LENGTH}
                    defaultValue={state?.typedFirst ?? ""}
                    disabled={pending}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50"
                />
            </label>

            <label className="block">
                <span className="text-sm text-zinc-600">{USER_NAME_COPY.lastLabel}</span>
                <input
                    type="text"
                    name="lastName"
                    required
                    maxLength={MAX_NAME_LENGTH}
                    defaultValue={state?.typedLast ?? ""}
                    disabled={pending}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50"
                />
            </label>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

            <button
                type="submit"
                disabled={pending}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending ? USER_NAME_COPY.saving : USER_NAME_COPY.action}
            </button>
        </form>
    );
}

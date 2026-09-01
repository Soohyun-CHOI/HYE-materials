"use client";

import { useActionState, useState } from "react";
import { updatePaidAction } from "./actions";

// THE WHOLE `Payment` SECTION'S BODY, AND IT WAS `PaidForm` UNTIL #318.
//
// WHAT CHANGED IS THE SHAPE OF THE SECTION RATHER THAN THE WRITE. #309 opened reading
// payment to every reader who reaches the row and left recording it behind
// `withAdminAction`; the screen did not follow. The section branched on `user.isAdmin`
// — an Admin got this form and nobody else got a sentence — so the fact and the
// control for it were ALTERNATIVES, and #316 had to place its own sentence outside
// that branch to reach both readers at all. The fact is now stated once, for
// everybody, and an Admin gets a control beside it. `updatePaidAction` is untouched.
//
// THE FILE IS RENAMED WITH THE SHAPE. `PaidForm` would be a name whose contents
// contradict it — this renders the payment state, #316's lateness sentence and,
// for an Admin, the control — which is `naming.md`'s own test for a file name.
//
// `canEdit` RATHER THAN A PRIVILEGE TEST ON THE PAGE, AND THE REASON IS A CHECK.
// `{user.isAdmin && <PaidForm paid={invoice.paid} …/>}` is a privilege branch whose
// consequent reads payment and whose alternate is nothing, which is exactly what
// `offline/invoice-visibility.mjs`'s third assertion reports — the fact disappearing
// with the control. It would have been a false positive here, since the sentence is
// stated unconditionally two lines up, but the branch is structurally identical to
// the real defect and relaxing that rule to admit this shape is not a trade worth
// making. Passing the answer as a prop removes the branch instead: the page reads
// `user.isAdmin` once, into `canEdit`, and the gate is one boolean the whole way
// down. It is still #185's pair rule — `updatePaidAction` is `withAdminAction` and
// this is the same question — held now by `offline/invoice-visibility.mjs` in its
// inverted form.
//
// THE READ STATE IS OUTSIDE THE OPEN-STATE BRANCH AND MUST STAY THERE. Hiding the
// sentence while the fields are open puts the fact and the control back behind one
// condition, which is the shape this issue removed — with `editing` where
// `user.isAdmin` used to be, and no privilege test for any existing check to see.
// `offline/invoice-visibility.mjs` pins it as a second predicate on the same
// mechanism, and `offline/invoice-overdue.mjs` pins the lateness sentence the same
// way.
//
// THE COMPONENT DOES NOT RESET ITSELF AFTER A SAVE AND DOES NOT NEED TO, WHICH IS A
// MEASUREMENT RATHER THAN A GUESS. `updatePaidAction` ends in a `redirect` to this same
// route, and a redirect from a Server Action replaces the segment rather than
// re-rendering it in place — so this remounts, `editing` is false again, and the fields
// prefill from the record the save just wrote. Read in a browser on a save that changed
// the record and on one that changed nothing; both come back closed. The page carried a
// `key` on the payment values for one revision to force exactly that, and it was removed
// once the behavior turned out not to depend on it. Which is why there is no `useEffect`
// here and no state to keep in step with the props.
export default function PaymentSection({ invoiceId, paid, paidDate, overdue, canEdit }) {
    const [state, formAction, pending] = useActionState(updatePaidAction, null);
    const [editing, setEditing] = useState(false);
    const [checked, setChecked] = useState(paid);
    const [date, setDate] = useState(paidDate || todayIso());

    // `/invoices/new`'s `handleCancelUnitPriceEdit`, one screen over: the values come
    // back from the SOURCE rather than from a copy taken when the control opened. The
    // props are the record, so there is nothing here to go stale against it.
    function cancel() {
        setChecked(paid);
        setDate(paidDate || todayIso());
        setEditing(false);
    }

    return (
        <div>
            {/* THE FACT, FOR EVERY READER, IN EVERY STATE. It is not inside the
                `editing` branch below and not inside a test on `canEdit`: a reader who
                cannot record payment still reads it (#309), and a reader who is
                recording it still sees what is recorded. The second half is what makes
                `Cancel` legible — it says what the fields go back to. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm">
                    {paid ? `Paid on ${paidDate || "—"}` : "Not paid yet."}
                </p>
                {/* `Edit payment` RATHER THAN `Edit`, AND THE COLLISION IS ON THIS
                    SCREEN. `/invoices/new` labels the same act `Edit` because nothing
                    competes with it there; this page already carries an Admin-only
                    `Edit` link beside its heading, which opens `/invoices/[invoiceId]/edit`
                    and edits the document. Two `Edit`s visible at once to exactly the
                    reader who can press either is one word for two acts, so this one
                    names what it acts on. */}
                {canEdit && !editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-sm text-zinc-500 underline"
                    >
                        Edit payment
                    </button>
                )}
            </div>

            {/* #316's SENTENCE, AND IT SITS WITH THE STATE IT QUALIFIES. That issue put
                it after the `isAdmin` ternary because either half of that branch hid it
                from one reader; the branch is gone, so the placement is decided by what
                the sentence is about instead. #316's own stacking rule on `/invoices`
                is the same one: the lateness mark qualifies the payment word, so it
                goes under it. Only an unpaid invoice can be late, so this never appears
                beside `Paid on`. */}
            {overdue && <p className="mt-2 text-sm text-red-700">{overdue.text}</p>}

            {canEdit && editing && (
                <form action={formAction} className="mt-3 space-y-2">
                    {/* Where every refusal this section can produce arrives, and it is
                        inside the control on purpose: the reader who submitted is the
                        only reader who can have caused one. */}
                    {state?.error && (
                        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {state.error}
                        </p>
                    )}
                    <input type="hidden" name="invoiceId" value={invoiceId} />
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            name="paid"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                        />
                        Paid
                    </label>
                    {checked && (
                        <div>
                            <label htmlFor="paidDate" className="block text-sm font-medium">
                                Paid Date
                            </label>
                            <input
                                type="date"
                                id="paidDate"
                                name="paidDate"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-1 text-sm"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={pending}
                            className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
                        >
                            {pending ? "Saving..." : "Save"}
                        </button>
                        {/* The same word for the same act as `/invoices/new`'s, and the
                            same shape: a text button beside the one that commits, which
                            renders only while the fields are open. */}
                        <button
                            type="button"
                            onClick={cancel}
                            disabled={pending}
                            className="text-sm text-zinc-500 underline disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

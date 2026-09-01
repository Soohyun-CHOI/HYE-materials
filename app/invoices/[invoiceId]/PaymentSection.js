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
// `{user.isAdmin && <PaymentSection paidDate={…}/>}` is a privilege branch whose
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
// AND THE CONTROL WRITES ONE FIELD SINCE #318's SECOND HALF. A `Paid` checkbox stood
// above the date and the date appeared only once it was ticked, so two controls wrote
// two fields whose four combinations had two meanings — the form required a date when
// the box was ticked and nothing refused the reverse. `Invoices."Paid"` is gone from
// the base; a `Paid Date` IS the payment, and clearing it is how a payment is
// un-recorded.
//
// THE READ STATE IS OUTSIDE THE OPEN-STATE BRANCH AND MUST STAY THERE. Hiding the
// sentence while the field is open puts the fact and the control back behind one
// condition, which is the shape this issue removed — with `editing` where
// `user.isAdmin` used to be, and no privilege test for any existing check to see.
// `offline/invoice-visibility.mjs` pins it as a second predicate on the same
// mechanism, and `offline/invoice-overdue.mjs` pins the lateness sentence the same
// way.
//
// THE COMPONENT DOES NOT RESET ITSELF AFTER A SAVE AND DOES NOT NEED TO, WHICH IS A
// MEASUREMENT RATHER THAN A GUESS. `updatePaidAction` ends in a `redirect` to this same
// route, and a redirect from a Server Action replaces the segment rather than
// re-rendering it in place — so this remounts, `editing` is false again, and the field
// prefills from the record the save just wrote. Read in a browser on a save that changed
// the record and on one that changed nothing; both come back closed. The page carried a
// `key` on the payment values for one revision to force exactly that, and it was removed
// once the behavior turned out not to depend on it. Which is why there is no `useEffect`
// here and no state to keep in step with the props.
export default function PaymentSection({ invoiceId, paidDate, overdue, canEdit }) {
    const [state, formAction, pending] = useActionState(updatePaidAction, null);
    const [editing, setEditing] = useState(false);
    // THE FIELD OPENS ON THE RECORD AND ON NOTHING ELSE (#318). It used to prefill
    // today the moment the `Paid` box was ticked, which was a convenience while the
    // tick was the deliberate act. With the box gone the date IS the payment, and a
    // field that arrives holding today turns `Edit payment` → `Save` into a payment
    // recorded by two clicks and no typing. An invoice that carries a date opens
    // holding it, or nothing would stop opening the control and saving from moving it.
    const [date, setDate] = useState(paidDate || "");

    // WHAT THE SENTENCE STATES: THE DRAFT WHILE THE CONTROL IS OPEN, THE RECORD
    // OTHERWISE. The sentence stated the RECORD in both states for one revision, on the
    // ground that one place should hold what is stored and another what is about to be
    // written. Reading it that way was worse than the argument: the reader picks a date
    // and the line above it goes on saying `Not paid yet.`, so the screen contradicts
    // the field they are looking at and nothing says the sentence is a step behind.
    // It previews instead — `Save payment` keeps what is shown, `Cancel` puts it back —
    // and the fact is never absent, which is the property `offline/invoice-visibility.mjs`
    // holds. Closed, the two are the same value: `date` is initialized from the record,
    // `cancel` resets it there, and a save remounts this component.
    const statedDate = editing ? date : paidDate;

    // `/invoices/new`'s `handleCancelUnitPriceEdit`, one screen over: the value comes
    // back from the SOURCE rather than from a copy taken when the control opened. The
    // prop is the record, so there is nothing here to go stale against it — and with
    // the sentence previewing the draft, this is what the reader watches it undo.
    function cancel() {
        setDate(paidDate || "");
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
                    {statedDate ? `Paid on ${statedDate}` : "Not paid yet."}
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
                beside `Paid on`.

                AND IT STANDS DOWN WHILE THE DRAFT SAYS PAID, which is what the sentence
                above previewing forced. `overdue` is resolved on the server from the
                RECORD, so a reader who types a date sees `Paid on 2026-08-27` with
                `⚠ Overdue` under it — the screen contradicting itself about the state it
                is showing. `!statedDate` is not a second answer to whether the invoice
                is late: it applies the premise the badge is already built on — only an
                unpaid invoice can be late — to the state being previewed.

                THE PREVIEW IS ONE-WAY, AND THAT IS WORTH KNOWING RATHER THAN HIDDEN.
                Clearing a paid invoice's date previews `Not paid yet.` and does NOT
                bring a lateness sentence with it, because the server resolved `overdue`
                as null for a record that was paid. Suppressing a contradiction is cheap;
                producing the other half would mean handing this component `dueDate` and
                the server's day and letting it call the judgment itself, which is a
                bigger change than the one that made the preview necessary. The sentence
                appears on the next load, as it did before. */}
            {overdue && !statedDate && (
                <p className="mt-2 text-sm text-red-700">{overdue.text}</p>
            )}

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
                    {/* ONE FIELD, AND NOT `required` (#318). A `Paid` checkbox stood
                        above this and the date appeared only once it was ticked, so two
                        controls wrote two fields that could disagree. The date is the
                        whole of the fact now, which means a BLANK one is a value rather
                        than a gap — it records that the invoice is not paid — so the
                        attribute that used to make the empty case impossible has to go
                        with the box. `Paid Date is required when marking as Paid.` went
                        with it: there is no longer a state for it to refuse. */}
                    <div>
                        <label htmlFor="paidDate" className="block text-sm font-medium">
                            Paid Date
                        </label>
                        {/* `Clear` IS A CONTROL OF OUR OWN AND NOT THE PICKER'S. A
                            `type="date"` input carries a clear affordance INSIDE the
                            browser's own calendar popup, which is the shape #232 retired
                            a marker over: a signal a reader has to open something else to
                            find is a signal only some readers have. Un-recording a
                            payment is the second thing this control does, so it is a
                            button beside the field, in the app's own markup, reachable by
                            keyboard and the same in every browser.

                            IT REPLACED A SENTENCE. `Clear the date to record that this
                            invoice is not paid.` stood here while emptying the box was
                            the only way back — copy buying discoverability a control
                            would have bought better. With the button visible and the
                            sentence above previewing what clearing does, the words said
                            what the screen already shows. */}
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                id="paidDate"
                                name="paidDate"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-1 text-sm"
                            />
                            {date && (
                                <button
                                    type="button"
                                    onClick={() => setDate("")}
                                    disabled={pending}
                                    className="text-sm text-zinc-500 underline disabled:opacity-50"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* `Save payment` RATHER THAN `Save`, FOR `Edit payment`'s OWN
                            REASON one control along: the pair opens and commits one
                            fact on a page that has another form on it, and a lone `Save`
                            names no subject. The two now read as one control's two
                            ends. */}
                        <button
                            type="submit"
                            disabled={pending}
                            className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
                        >
                            {pending ? "Saving..." : "Save payment"}
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

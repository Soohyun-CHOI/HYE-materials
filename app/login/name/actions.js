"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { setUserName } from "@/lib/airtable/users";
import { DEFAULT_DESTINATION, DESTINATION_PARAM, safeDestination } from "@/lib/loginDestination";
import { judgeName, USER_NAME_COPY } from "@/lib/userName";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Store the name its owner just typed, and send them where they were going
 * (#381).
 *
 * NOT WRAPPED, AND LISTED AS AN EXEMPTION WITH THAT REASON. `requireUser()` is
 * the whole gate because the record being written is the caller's own session's
 * row — there is no other record this can reach and no role that would fit.
 * Every one of this app's `requireUser()` actions is the same shape: a session
 * plus an ownership that is structural rather than compared.
 *
 * REFUSES BY RETURNING BECAUSE THE CALL SITE BINDS (#185). `NameForm.js` reads
 * this through `useActionState`, so a refusal lands in `state`: `{ refusals }`, a
 * sentence under each name that is wrong, and `{ error }` for a write that did not
 * happen, which the form says where a refusal of the whole step stands (#473).
 *
 * IT JUDGES THE DESTINATION AGAIN, and that is the call that protects anything:
 * a Server Action is reachable without the page that renders the form, so a
 * value judged only there would be judged nowhere. A refused one lands on
 * `DEFAULT_DESTINATION`, exactly as a submission carrying none does.
 *
 * NO REFUSAL FOR A SECOND SUBMISSION, and the reason is that there is nothing to
 * refuse: this writes two fields to one record, so a double submit writes the
 * same two values twice. The page sends a reader who already has a name away
 * before the form is drawn, which is where that case is answered.
 *
 * NOTHING TYPED COMES BACK. The form's fields are its own state since #473, so what
 * the reader typed stays in them through a refusal and a failed write alike; until
 * then they were reset with the form and this handed the typed values back. On
 * success nothing comes back at all — the redirect is the answer, which is #321's
 * rule that an action says what it did by arriving.
 */
export async function setUserNameAction(prevState, formData) {
    const { destination, ...result } = await withOpsLabel("setUserNameAction", async () => {
        const user = await requireUser();

        const judged = judgeName({
            firstName: String(formData.get("firstName") ?? ""),
            lastName: String(formData.get("lastName") ?? ""),
        });
        if (judged.refusals) return { refusals: judged.refusals };

        try {
            await setUserName(user.id, judged);
        } catch (err) {
            console.error("setUserNameAction could not store the name", err);
            return { error: USER_NAME_COPY.refusal.failed };
        }

        return { destination: safeDestination(formData.get(DESTINATION_PARAM)) ?? DEFAULT_DESTINATION };
    });

    // OUTSIDE THE SCOPE ON PURPOSE. `redirect()` throws a digest the framework
    // catches, and throwing it inside `withOpsLabel` would leave the scope to
    // report through its `finally` on an unwind — the label would still be
    // written, but the action's own return would never be seen. Every Airtable
    // call this action makes is already inside.
    if (destination) redirect(destination);
    return result;
}

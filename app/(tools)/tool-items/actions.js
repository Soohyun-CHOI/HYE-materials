"use server";

import { headers } from "next/headers";
import { withSiteManagerAction } from "@/lib/authz";
import { getToolItemsByToolItemIds } from "@/lib/airtable/toolItems";
import { QR_SIDE_MODULES, buildToolItemLabel } from "@/lib/toolLabelQR";
import { MAX_LABELS_PER_REQUEST } from "@/lib/toolLabelPage";
import { namedCode, readToolItemIds } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * The run a tool's page opens the labels' dialog on (#457): the labels for the tool
 * items its list has selected, built here, and the ones no tool item carries.
 *
 * A LABEL IS ITS ID'S AND NOTHING ELSE'S, AND IT STILL CANNOT BE DRAWN FROM THE ID IN
 * THE BROWSER. What a label carries is the printed code and a symbol of the address
 * that code makes — no tool's name since #431 — but the symbol is drawn by
 * `lib/toolLabelQR.js`, which imports `qrcode` and so no `"use client"` file may import
 * (#351, #353), and the ids are the list's selection, which that page reads off its own
 * address and does not ask the base about (#443). An address somebody typed can name a
 * code no tool item carries, and a label drawn for it is a sticker pointing at nothing
 * — the one failure a printed id family exists to prevent. So the ids are read here,
 * and a code the read does not find is named rather than drawn. A tool item's own page
 * needs none of this: it has read its record and built its symbol already, and hands
 * the dialog that label.
 *
 * WHAT IT COSTS IS THE SESSION AND ONE `Tool Items` QUERY PER 50, so two operations
 * for a run of fifty and three for a hundred, where `/tool-items/labels` was three for
 * either — it read the `Tools` the run's tool items belonged to, for a picker naming
 * each by its tool, and the dialog names one tool, the page's own, which that page has
 * in hand. The symbols cost nothing: they are built from the origin and the id.
 *
 * ONLY A SITE MANAGER PRINTS LABELS (#506), AND THE WRAPPER IS THE WHOLE GATE. Until then
 * every signed-in reader could print any label (#337) and the session was the gate; now
 * `withSiteManagerAction` refuses anybody else before this body runs — the tool's page
 * rendered again without its boxes and bar, and `null`, which the dialog opens on nothing
 * for. No tool item is one reader's rather than another's, so there is still no record to
 * compare, and the session is the wrapper's read: this body reads nobody, so the run
 * still costs what it did — the session counted under `authz gate`, where every
 * wrapper's gate is counted (#224), and the `Tool Items` reads under this action.
 *
 * A RUN LONGER THAN ONE PRINT THROWS, AND NOTHING OPENS ONE. A tool's page refuses a
 * selection over `MAX_LABELS_PER_REQUEST` before it calls this (`describeSelection`),
 * so a longer one is a caller with no page, and a throw is a tripwire rather than a
 * state — `/tool-items/labels` took the first hundred and said so, which made a press
 * print less than it sent.
 *
 * THE HOST IS READ FOR THE SYMBOL AND REACHES NOTHING ELSE (#454), from the public host
 * behind Vercel's proxy, the source the tool item's page reads its own from — so the
 * symbol it shows and the label printed for it encode one string.
 */
export const readToolItemLabelsAction = withSiteManagerAction(readToolItemLabelsHandler);

async function readToolItemLabelsHandler(toolItemIds) {
    return withOpsLabel("readToolItemLabelsAction", async () => {
        // Canonical, each once, in the order handed over — the reading the list makes
        // of its own address, so the run read is the run selected.
        const named = readToolItemIds(toolItemIds);
        if (named.length > MAX_LABELS_PER_REQUEST) {
            throw new Error(
                `readToolItemLabelsAction: ${named.length} tool items were named and one print takes at most ${MAX_LABELS_PER_REQUEST}`
            );
        }

        const headerList = await headers();
        const host = headerList.get("host") ?? "";
        const proto = headerList.get("x-forwarded-proto") ?? "http";
        const origin = `${proto}://${host}`;

        const found = new Map(
            (named.length > 0 ? await getToolItemsByToolItemIds(named) : []).map((toolItem) => [
                toolItem.toolItemId,
                toolItem,
            ])
        );

        // In the order named, which for a tool's page is its list's order (#443).
        const labels = [];
        const missing = [];
        for (const toolItemId of named) {
            const toolItem = found.get(toolItemId);
            if (!toolItem) {
                missing.push(namedCode(toolItemId));
                continue;
            }
            labels.push(await buildToolItemLabel({ origin, toolItemId: toolItem.toolItemId }));
        }

        // `sideModules` sizes the label (`labelBudget`) and arrives as data, since the
        // dialog cannot import the module that knows it.
        return { sideModules: QR_SIDE_MODULES, labels, missing };
    });
}

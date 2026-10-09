"use server";

import { headers } from "next/headers";
import { withSiteManagerAction } from "@/lib/authz";
import { getAssetsByAssetIds } from "@/lib/airtable/assets";
import { QR_SIDE_MODULES, buildAssetLabel } from "@/lib/assetLabelQR";
import { MAX_LABELS_PER_REQUEST } from "@/lib/assetLabelPage";
import { namedCode, readAssetIds } from "@/lib/assetRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * The run a category's page opens the labels' dialog on (#457): the labels for the assets
 * its list has selected, built here, and the ones no asset carries.
 *
 * A LABEL IS ITS ID'S AND NOTHING ELSE'S, AND IT STILL CANNOT BE DRAWN FROM THE ID IN
 * THE BROWSER. What a label carries is the printed code and a symbol of the address
 * that code makes — no category's name since #431 — but the symbol is drawn by
 * `lib/assetLabelQR.js`, which imports `qrcode` and so no `"use client"` file may import
 * (#351, #353), and the ids are the list's selection, which that page reads off its own
 * address and does not ask the base about (#443). An address somebody typed can name a
 * code no asset carries, and a label drawn for it is a sticker pointing at nothing
 * — the one failure a printed id family exists to prevent. So the ids are read here,
 * and a code the read does not find is named rather than drawn. An asset's own page
 * needs none of this: it has read its record and built its symbol already, and hands
 * the dialog that label.
 *
 * WHAT IT COSTS IS THE SESSION AND ONE `Assets` QUERY PER 50, so two operations
 * for a run of fifty and three for a hundred, where `/tool-items/labels` was three for
 * either — it read the `Asset Categories` the run's assets belonged to, for a picker naming
 * each by its tool, and the dialog names one category, the page's own, which that page has
 * in hand. The symbols cost nothing: they are built from the origin and the id.
 *
 * ONLY A SITE MANAGER PRINTS LABELS (#506), AND THE WRAPPER IS THE WHOLE GATE. Until then
 * every signed-in reader could print any label (#337) and the session was the gate; now
 * `withSiteManagerAction` refuses anybody else before this body runs — the category's page
 * rendered again without its boxes and bar, and `null`, which the dialog opens on nothing
 * for. No asset is one reader's rather than another's, so there is still no record to
 * compare, and the session is the wrapper's read: this body reads nobody, so the run
 * still costs what it did — the session counted under `authz gate`, where every
 * wrapper's gate is counted (#224), and the `Assets` reads under this action.
 *
 * A RUN LONGER THAN ONE PRINT THROWS, AND NOTHING OPENS ONE. A category's page refuses a
 * selection over `MAX_LABELS_PER_REQUEST` before it calls this (`describeSelection`),
 * so a longer one is a caller with no page, and a throw is a tripwire rather than a
 * state — `/tool-items/labels` took the first hundred and said so, which made a press
 * print less than it sent.
 *
 * THE HOST IS READ FOR THE SYMBOL AND REACHES NOTHING ELSE (#454), from the public host
 * behind Vercel's proxy, the source the asset's page reads its own from — so the
 * symbol it shows and the label printed for it encode one string.
 */
export const readAssetLabelsAction = withSiteManagerAction(readAssetLabelsHandler);

async function readAssetLabelsHandler(assetIds) {
    return withOpsLabel("readAssetLabelsAction", async () => {
        // Canonical, each once, in the order handed over — the reading the list makes
        // of its own address, so the run read is the run selected.
        const named = readAssetIds(assetIds);
        if (named.length > MAX_LABELS_PER_REQUEST) {
            throw new Error(
                `readAssetLabelsAction: ${named.length} assets were named and one print takes at most ${MAX_LABELS_PER_REQUEST}`
            );
        }

        const headerList = await headers();
        const host = headerList.get("host") ?? "";
        const proto = headerList.get("x-forwarded-proto") ?? "http";
        const origin = `${proto}://${host}`;

        const found = new Map(
            (named.length > 0 ? await getAssetsByAssetIds(named) : []).map((asset) => [
                asset.assetId,
                asset,
            ])
        );

        // In the order named, which for a category's page is its list's order (#443).
        const labels = [];
        const missing = [];
        for (const assetId of named) {
            const asset = found.get(assetId);
            if (!asset) {
                missing.push(namedCode(assetId));
                continue;
            }
            labels.push(await buildAssetLabel({ origin, assetId: asset.assetId }));
        }

        // `sideModules` sizes the label (`labelBudget`) and arrives as data, since the
        // dialog cannot import the module that knows it.
        return { sideModules: QR_SIDE_MODULES, labels, missing };
    });
}

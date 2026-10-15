"use server";

import { refresh } from "next/cache";
import { withAdminAction } from "@/lib/authz";
import {
    createAssetCategory,
    getAllAssetCategories,
    getAssetCategoriesByRecordIds,
    removeAssetCategory,
    setAssetCategoriesClass,
    setAssetCategoryDiscontinued,
    updateAssetCategory,
} from "@/lib/airtable/assetCategories";
import { createAssetCategoryGroup, getAllAssetCategoryGroups } from "@/lib/airtable/assetCategoryGroups";
import { ASSET_CATALOG_COPY as COPY, CATALOG_ENTRY_FIELDS, classChanges, readCatalogEntry, readCategoryEntry } from "@/lib/assetCatalog";
import { ASSET_CLASS_VALUES } from "@/lib/assetCategory";
import { withOpsLabel } from "@/lib/airtableOps";

/*
 * What the catalog's page writes (1l, #527): a row added or saved over, a category added on its
 * own, a row discontinued or restored, a row nothing stands under removed, and the class of
 * several rows set at once. The only writers of `Asset Categories` and `Asset Category Groups` in
 * the app; the office's hand edits in Airtable are the other way either changes.
 *
 * THE OFFICE'S, SO `withAdminAction`, AND THE SITE MANAGER'S WRAPPER IS NOT THE GATE HERE. The
 * four acts on an asset are a site manager's (#506) and the catalog is the office's, as the page
 * is (`page.js`): each export is the app's Admin wrapper round a handler nobody can call round it,
 * which `offline/site-manager.mjs` holds file by file — this file's every action the Admin
 * wrapper, the asset acts' the site manager's. A refusal re-renders the page as the reader now
 * reads it, the sentence in the page's place (#378), and returns that sentence for the dialog
 * it may still be drawn under; every call site binds the return (#185,
 * `offline/action-refusal-shape.mjs`). The refusal is written out in each export because that
 * check reads the shape off the thunk handed to the wrapper.
 *
 * WHAT A WRITE MAY BE IS ASKED AGAIN HERE, of the base as it is now. The dialog asks
 * `lib/assetCatalog.js:readCatalogEntry` of the rows the page read; each action reads the catalog
 * and the groups afresh and asks it again, so a path another row has taken since, or a category
 * added since, is answered as the base holds it. Every refusal about one field is `{ fields }`,
 * said under the field; one about the whole press is `{ error }`, said over the actions.
 *
 * A NEW CATEGORY IS WRITTEN BEFORE THE ITEM FILED UNDER IT, AND NOT TAKEN BACK. The group first,
 * under its own lock, then the row under its path's — two locks in sequence, never nested
 * (CLAUDE.md) — because a group with nothing under it is a state the catalog already holds and
 * its check reports as no fault, where an item whose category is no group is what that check
 * fails on. So when the item's write fails after the group's, the group stays, the page is drawn
 * again with it, the field no longer says `New`, and the dialog says the category was added and
 * the item was not: a second press saves the item alone. Taking the group back would be a delete
 * that can fail in its turn, to undo a row nothing is wrong with.
 *
 * NOTHING HERE READS THE OFFICE'S FLAG. The wrapper asks `requireAdmin`, which reads it in
 * `lib/authz.js`; the assets axis reads it once, for what a list stands on (#509).
 */

/** The text the form sends for an entry, by field. */
function entryOf(formData) {
    return Object.fromEntries(CATALOG_ENTRY_FIELDS.map((key) => [key, formData.get(key)]));
}

/**
 * A row added, or saved over when `categoryRecordId` names one (1l) — with the category first
 * when it is new for its type. `{ done: true }` once the row is written, the page drawn again with
 * it.
 */
export const saveAssetCategoryAction = withAdminAction(() => {
    refresh();
    return { error: COPY.noAccess };
}, saveAssetCategoryHandler);

async function saveAssetCategoryHandler(prevState, formData) {
    return withOpsLabel("saveAssetCategoryAction", async () => {
        const editing = typeof formData.get("categoryRecordId") === "string" && formData.get("categoryRecordId") !== "" ? formData.get("categoryRecordId") : null;
        const [rows, groups] = await Promise.all([getAllAssetCategories(), getAllAssetCategoryGroups()]);
        if (editing && !rows.some((row) => row.id === editing)) {
            refresh();
            return { error: COPY.gone };
        }
        const reading = readCatalogEntry(entryOf(formData), { rows, groups, editing });
        if (!reading.entry) return reading;
        const { entry, newCategory } = reading;

        let addedCategory = false;
        if (newCategory) {
            try {
                addedCategory = Boolean((await createAssetCategoryGroup({ level1: entry.level1, level2: entry.level2 })).created);
            } catch {
                return { error: COPY.notSaved };
            }
        }

        let written;
        try {
            written = editing ? await updateAssetCategory(editing, entry) : await createAssetCategory(entry);
        } catch {
            if (addedCategory) refresh();
            return { error: addedCategory ? COPY.categoryOnly : COPY.notSaved };
        }
        if (written.gone) {
            refresh();
            return { error: COPY.gone };
        }
        if (written.exists) {
            refresh();
            return { fields: { level3: COPY.refusal.exists(written.exists.level2) } };
        }
        refresh();
        return { done: true };
    });
}

/** A category added on its own (1l's `New category`) — a group, and nothing in the catalog. */
export const addAssetCategoryGroupAction = withAdminAction(() => {
    refresh();
    return { error: COPY.noAccess };
}, addAssetCategoryGroupHandler);

async function addAssetCategoryGroupHandler(prevState, formData) {
    return withOpsLabel("addAssetCategoryGroupAction", async () => {
        const reading = readCategoryEntry({ level1: formData.get("level1"), level2: formData.get("level2") }, await getAllAssetCategoryGroups());
        if (!reading.group) return reading;
        let added;
        try {
            added = await createAssetCategoryGroup(reading.group);
        } catch {
            return { error: COPY.categoryNotCreated };
        }
        refresh();
        if (added.exists) return { fields: { level2: COPY.refusal.categoryExists } };
        return { done: true };
    });
}

/**
 * A row marked discontinued, or the mark cleared (1l's `Discontinue` and `Restore`) — the one
 * field, whatever else the dialog holds, as 1l closes the dialog on either.
 */
export const setAssetCategoryDiscontinuedAction = withAdminAction(() => {
    refresh();
    return { error: COPY.noAccess };
}, setAssetCategoryDiscontinuedHandler);

async function setAssetCategoryDiscontinuedHandler(categoryRecordId, discontinued) {
    return withOpsLabel("setAssetCategoryDiscontinuedAction", async () => {
        const [row] = await getAssetCategoriesByRecordIds([String(categoryRecordId ?? "")]);
        if (!row) {
            refresh();
            return { error: COPY.gone };
        }
        try {
            await setAssetCategoryDiscontinued(row.id, discontinued === true);
        } catch {
            return { error: COPY.notSaved };
        }
        refresh();
        return { done: true };
    });
}

/** A row nothing stands under, taken out of the catalog (1l's `Remove from catalog`). */
export const removeAssetCategoryAction = withAdminAction(() => {
    refresh();
    return { error: COPY.noAccess };
}, removeAssetCategoryHandler);

async function removeAssetCategoryHandler(categoryRecordId) {
    return withOpsLabel("removeAssetCategoryAction", async () => {
        let removed;
        try {
            removed = await removeAssetCategory(String(categoryRecordId ?? ""));
        } catch {
            return { error: COPY.notRemoved };
        }
        if (removed.gone || removed.hasItems) {
            refresh();
            return { error: removed.gone ? COPY.gone : COPY.hasItems };
        }
        refresh();
        return { done: true };
    });
}

/**
 * The class of the rows selected (1l's `Set class`), written where it differs. A failure part of
 * the way leaves what was set before it set, and the page is drawn again showing which.
 */
export const setAssetCategoriesClassAction = withAdminAction(() => {
    refresh();
    return { error: COPY.noAccess };
}, setAssetCategoriesClassHandler);

async function setAssetCategoriesClassHandler(categoryRecordIds, assetClass) {
    return withOpsLabel("setAssetCategoriesClassAction", async () => {
        if (!ASSET_CLASS_VALUES.includes(assetClass) || !Array.isArray(categoryRecordIds)) return { error: COPY.classNotSet };
        const changes = classChanges(await getAllAssetCategories(), categoryRecordIds, assetClass);
        try {
            await setAssetCategoriesClass(changes, assetClass);
        } catch {
            refresh();
            return { error: COPY.classNotSet };
        }
        refresh();
        return { done: true };
    });
}

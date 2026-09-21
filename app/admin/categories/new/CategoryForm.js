"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pickCategoryLevel } from "@/lib/materialCategory";
import { createCategoryAction } from "./actions";
import {
    CATEGORY_CREATION_COPY as COPY,
    LEVEL_CHOICE,
    draftItemName,
    matchExistingCategoryName,
    narrowParent,
    planCategory,
    resolveCategoryNames,
} from "@/lib/categoryCreation";

/**
 * The form that adds a path to the catalog (#368).
 *
 * IT IMPORTS `lib/categoryCreation.js` AND `lib/materialCategory.js` AND NOTHING
 * ELSE FROM `lib/`, which is #162's rule: an import is an execution, so a
 * `"use client"` file that reaches `lib/airtable/` at any depth crashes in the
 * browser rather than failing a lint rule. Both modules are pure by construction
 * and every word below comes out of the first.
 *
 * THE TREE IS THE PAGE'S, ALREADY LOADED, so narrowing to a parent, listing the
 * level-3 children it has, drafting the item name and warning about a name that is
 * taken all cost no request per keystroke.
 *
 * IT GOES STALE THE MOMENT IT ARRIVES, WHICH IS WHAT MAKES THE PREVIEW A PREVIEW.
 * The action runs the same `planCategory` against rows it reads under a lock, and
 * returns the same sentences. What the browser can say is what the tree it was
 * handed implies — which stops a duplicate name and an existing path before a
 * submit, and never claims to be the base's answer.
 *
 * THE CODE IS NOT PREVIEWED AND THAT IS DELIBERATE — see
 * `CATEGORY_CREATION_COPY.previewName`. The server settles it inside the lock, so a
 * line here promising `…901` would be contradicted by a row landing on `…902`.
 *
 * `codes` IS FOUR LONG AND ITS THIRD ENTRY IS THE LEVEL-3 CHOICE. That keeps the
 * clearing rule `lib/materialCategory.js:pickCategoryLevel`'s — re-picking level 1
 * or level 2 empties everything under it, which is the rule #367 moved out of a
 * form so it would not be spelled twice. `narrowParent` maps a sentinel to a blank
 * on the way in, and the fourth entry is never set: the leaf is typed, not picked.
 *
 * AND A SUCCESSFUL CREATE REFRESHES, for the reason `/addresses/new` found in a
 * browser rather than by reasoning: the action only RETURNS, so nothing re-renders
 * the page that loaded the tree — and the screen would then say it had created a
 * path while the level-3 control still did not offer it and the duplicate-name
 * check still did not know about it. `router.refresh()` carries the returned
 * message AND a fresh tree, where a `redirect()` would drop the message (#378).
 */
export default function CategoryForm({ categories }) {
    const [state, formAction, pending] = useActionState(createCategoryAction, null);
    const [codes, setCodes] = useState(["", "", "", ""]);
    const [level3Name, setLevel3Name] = useState("");
    const [level4NoDivision, setLevel4NoDivision] = useState(false);
    const [level4Name, setLevel4Name] = useState("");
    const [itemName, setItemName] = useState("");
    const [nameTouched, setNameTouched] = useState(false);
    const router = useRouter();
    const formRef = useRef(null);

    // Keyed on the state object rather than on a boolean, so two creates in a row
    // each fire it — `useActionState` hands back a new object per submission. The
    // effect sets no state: clearing the mirrors belongs to the RESET, which is
    // what `onReset` below is for (`react-hooks/set-state-in-effect`).
    useEffect(() => {
        if (!state?.code) return;
        formRef.current?.reset();
        router.refresh();
    }, [state, router]);

    // THE SUBMISSION IS BUILT ONCE AND JUDGED BY THE MODULE, which is what keeps
    // this preview and the action from being two rules. `resolveCategoryNames`
    // answers what the four names are — including which level 3 a typed name lands
    // on, and which placeholder word a mark resolves to — and it takes no item
    // name, because the name is drafted FROM those four.
    const submission = {
        level1Code: codes[0],
        level2Code: codes[1],
        level3Choice: codes[2],
        level3Name,
        level4NoDivision,
        level4Name,
    };
    const resolved = resolveCategoryNames(submission, categories);
    const draft = draftItemName(resolved?.names ?? []);
    const shownName = nameTouched ? itemName : draft;

    // The plan the action will make, against the tree this page loaded. `plan` is
    // what the preview shows and what enables the submit; `refusal` is the same
    // sentence the action would return, said while there is still time to act on
    // it. Both go stale — the base is the authority and asks again under a lock.
    const { plan, refusal } = planCategory({ ...submission, itemName: shownName }, categories);

    // The level-3 code the submission RESOLVED to, so the children of a level 3 a
    // typed name joined are listed too — not only those of one picked from the
    // list. A level 3 being minted has none by construction.
    const level3Code = resolved?.level3?.code ?? "";
    const walk = narrowParent(categories, [codes[0], codes[1], level3Code]);
    const [level1, level2, level3] = walk.levels;
    const level3Choice = codes[2];

    const taken = matchExistingCategoryName(shownName, categories);
    const takenSentence = taken
        ? COPY.nameTaken({ itemName: taken.itemName, label: taken.label })
        : null;

    return (
        <form
            ref={formRef}
            action={formAction}
            // THE PARENT AND THE LEVEL-3 CHOICE SURVIVE A CREATE, the leaf and the
            // name do not. Somebody adding two paths under one branch should not
            // pick it twice — `/addresses/new` keeps its job for the same reason —
            // and a level 3 this submission minted is on the refreshed tree, so
            // keeping the choice lands the next leaf under the same code.
            onReset={() => {
                setLevel4NoDivision(false);
                setLevel4Name("");
                setItemName("");
                setNameTouched(false);
            }}
            className="mt-6 space-y-4"
        >
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            {state?.code && (
                <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {COPY.created({ itemName: state.itemName, code: state.code, label: state.label })}
                </p>
            )}

            {/* The parent: two levels of HQ's tree, narrowed the way every other
                screen narrows it. A code is what narrows and a name is what is
                shown — 25 level-2 names are carried by more than one branch. */}
            {[level1, level2].map((level, depth) => (
                <div key={depth}>
                    <label htmlFor={`level${depth + 1}Code`} className="block text-sm font-medium">
                        {COPY.levels[depth]}
                    </label>
                    <select
                        id={`level${depth + 1}Code`}
                        name={`level${depth + 1}Code`}
                        required
                        value={level.chosen}
                        disabled={level.options.length === 0}
                        onChange={(e) => setCodes(pickCategoryLevel(codes, depth, e.target.value))}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    >
                        <option value="">
                            {level.options.length === 0
                                ? COPY.awaitingParent(depth).text
                                : COPY.levels[depth]}
                        </option>
                        {level.options.map((option) => (
                            <option key={option.code} value={option.code}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>
            ))}

            {/* LEVEL 3 IS A CHOICE AND LEVEL 4 IS NOT, which is the asymmetry this
                screen is built on: an existing child here is what the new leaf
                hangs off, and an existing child there means the path already
                exists. So this control offers the parent's own children — which is
                also what stops a second `Pipe Hangers` beside `Pipe Hanger`. */}
            <div>
                <label htmlFor="level3Choice" className="block text-sm font-medium">
                    {COPY.levels[2]}
                </label>
                <select
                    id="level3Choice"
                    name="level3Choice"
                    required
                    value={level3Choice}
                    disabled={!codes[1]}
                    onChange={(e) => setCodes(pickCategoryLevel(codes, 2, e.target.value))}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                >
                    <option value="">{codes[1] ? COPY.levels[2] : COPY.awaitingParent(2).text}</option>
                    {/* THE TWO CHOICES GO WITH THE CHILDREN RATHER THAN STANDING
                        WITHOUT THEM. The control is disabled until a level 2 is
                        picked, so nothing here was reachable early — but a
                        disabled select still LISTS what it holds, and a screen
                        reader met two options under `Pick level 2 first.` Found in
                        a browser rather than reasoned about. */}
                    {codes[1] && (
                        <>
                            {level3.options.map((option) => (
                                <option key={option.code} value={option.code}>
                                    {option.name}
                                </option>
                            ))}
                            <option value={LEVEL_CHOICE.noDivision}>{COPY.noDivision}</option>
                            <option value={LEVEL_CHOICE.newLevel}>{COPY.level3New}</option>
                        </>
                    )}
                </select>
                {level3Choice === LEVEL_CHOICE.noDivision && (
                    <p className="mt-1 text-xs text-zinc-500">{COPY.noDivisionNote}</p>
                )}
            </div>

            {level3Choice === LEVEL_CHOICE.newLevel && (
                <div>
                    <label htmlFor="level3Name" className="block text-sm font-medium">
                        {COPY.level3NameLabel}
                    </label>
                    <input
                        id="level3Name"
                        name="level3Name"
                        required
                        value={level3Name}
                        onChange={(e) => setLevel3Name(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>
            )}

            <div>
                <label htmlFor="level4Name" className="block text-sm font-medium">
                    {COPY.levels[3]}
                </label>
                <input
                    id="level4Name"
                    name="level4Name"
                    required={!level4NoDivision}
                    disabled={level4NoDivision}
                    value={level4Name}
                    onChange={(e) => setLevel4Name(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:bg-zinc-100"
                />
                {/* The same words the level-3 control offers, for the same meaning.
                    A checkbox rather than an option because nothing here competes
                    with it: level 4 has no existing child to choose instead. */}
                <label htmlFor="level4NoDivision" className="mt-2 flex items-center gap-2 text-sm">
                    <input
                        id="level4NoDivision"
                        name="level4NoDivision"
                        type="checkbox"
                        checked={level4NoDivision}
                        onChange={(e) => setLevel4NoDivision(e.target.checked)}
                    />
                    {COPY.noDivision}
                </label>
                {level4NoDivision && <p className="mt-1 text-xs text-zinc-500">{COPY.noDivisionNote}</p>}
            </div>

            {/* The level-4 names already under the resolved level 3, so nobody
                types one that exists. Only where there is a level 3 to be under: a
                minted one has no children by construction. */}
            {level3Code && (
                <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                    {walk.level4Names.length === 0 ? (
                        <p className="text-zinc-600">{COPY.noneOnLevel3(resolved.level3.name)}</p>
                    ) : (
                        <>
                            <p className="text-zinc-600">{COPY.onLevel3(resolved.level3.name)}</p>
                            <ul className="mt-1 list-disc pl-5">
                                {walk.level4Names.map((name) => (
                                    <li key={name}>{name}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}

            <div>
                <label htmlFor="itemName" className="block text-sm font-medium">
                    {COPY.nameLabel}
                </label>
                <input
                    id="itemName"
                    name="itemName"
                    required
                    value={shownName}
                    onChange={(e) => {
                        setNameTouched(true);
                        setItemName(e.target.value);
                    }}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
                <p className="mt-1 text-xs text-zinc-500">{COPY.nameHint}</p>
                {/* THE DRAFT IS NAMED AS ONE while it is still the draft, so a
                    filled box does not read as a computed value — 430 of the 777
                    committed names are not what any rule produces, which is why
                    this field is typed at all. */}
                {!nameTouched && draft !== "" && (
                    <p className="mt-1 text-xs text-zinc-500">{COPY.nameDrafted}</p>
                )}
                {/* The same sentence the action returns on a real collision, said
                    while there is still time to change the box above it — and
                    suppressed while the refusal is saying it, which is the double
                    statement `/addresses/new` met in a browser. */}
                {takenSentence && state?.error !== takenSentence && (
                    <p className="mt-1 text-xs text-amber-700">{takenSentence}</p>
                )}
            </div>

            {/* The two lines before the save: the name every document will print,
                and the place the row sits. They differ from the four chosen names,
                which is why both are here — see the copy constant. They are the
                PLAN's, so what is previewed is what will be written. */}
            {plan && (
                <div className="rounded border border-zinc-200 px-3 py-2 text-sm">
                    <p>{COPY.previewName(plan.itemName)}</p>
                    <p className="mt-1 text-zinc-600">{COPY.previewPath(plan.label)}</p>
                </div>
            )}

            {/* A refusal the loaded tree can already see — an existing path, a
                parent with no code left. `fieldsMissing` is not one of them: the
                controls are `required` and the submit is disabled, so nagging about
                a box nobody has reached yet would be noise. Suppressed while the
                action's own box is saying the same sentence. */}
            {refusal && refusal !== COPY.fieldsMissing && state?.error !== refusal && (
                <p className="text-sm text-amber-700">{refusal}</p>
            )}

            {/* DISABLED ON AN INCOMPLETE FORM AND ON NOTHING ELSE, which a browser
                found rather than a check. It was `!plan`, so every refusal the
                loaded tree could see also BLOCKED the submit — and the tree goes
                stale: a row deleted out of band left the sibling list showing it,
                the duplicate line claiming its name and the submit refusing a path
                that no longer existed, with no way for the reader to get the base's
                answer. The base is the only thing that can refuse now. The test is
                `planCategory`'s own missing-fields verdict rather than a second
                completeness rule here, and `/addresses/new` is the precedent: its
                taken-label preview leaves the submit pressable too. */}
            <button
                type="submit"
                disabled={pending || refusal === COPY.fieldsMissing}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {COPY.submit}
            </button>
        </form>
    );
}

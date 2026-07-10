"use client";

import { useState } from "react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSignerRow({ id, user, index, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-black"
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none px-1 text-zinc-400"
                aria-label="Drag to reorder"
            >
                ⠿
            </button>
            <span className="w-6 text-sm text-zinc-500">{index + 1}.</span>
            <span className="flex-1">
                {user ? `${user.userName} (${user.role})` : "Unknown user"}
            </span>
            <button type="button" onClick={onRemove} className="text-sm text-red-600">
                Remove
            </button>
        </li>
    );
}

// Ordered signer-assignment list for the PR creation form: pick a person
// from the dropdown to add them to the end of the chain, then drag rows to
// reorder — array order becomes Sequence Order on submit (see
// app/prs/new/actions.js).
export default function SignerList({ users, signerIds, onChange }) {
    const [pickerValue, setPickerValue] = useState("");
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
    const availableUsers = users.filter((u) => !signerIds.includes(u.id));

    function handleAdd() {
        if (!pickerValue) return;
        onChange([...signerIds, pickerValue]);
        setPickerValue("");
    }

    function handleRemove(id) {
        onChange(signerIds.filter((s) => s !== id));
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = signerIds.indexOf(active.id);
        const newIndex = signerIds.indexOf(over.id);
        onChange(arrayMove(signerIds, oldIndex, newIndex));
    }

    return (
        <div className="mt-2 space-y-3">
            {signerIds.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={signerIds} strategy={verticalListSortingStrategy}>
                        <ul className="space-y-2">
                            {signerIds.map((id, i) => (
                                <SortableSignerRow
                                    key={id}
                                    id={id}
                                    user={usersById[id]}
                                    index={i}
                                    onRemove={() => handleRemove(id)}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            )}

            <div className="flex gap-2">
                <select
                    value={pickerValue}
                    onChange={(e) => setPickerValue(e.target.value)}
                    className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                >
                    <option value="">Select a person to add...</option>
                    {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.userName} ({u.role})
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!pickerValue}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                    Add
                </button>
            </div>
        </div>
    );
}

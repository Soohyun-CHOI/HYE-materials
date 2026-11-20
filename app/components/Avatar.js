"use client";

import { useEffect, useSyncExternalStore } from "react";
import Icon from "./Icon";
import { avatarTone, lettersSignedInWith, SIGNED_IN_ADDRESSES_KEY, withAddressSignedIn } from "@/lib/avatar";

/*
 * An avatar, Invoices 0q (#690): a 24 circle in its address's pair holding a person's letters —
 * two at 12 on 16, one at 13, both at 600 (0q.2) — and, for an address this device has not
 * signed in with, a 14 person mark at Ink 3 with no letters on Field (0q.9). It never changes on hover,
 * focus or selection: the control around it does (0q).
 *
 * TWO CALLERS, AND ONLY ONE ASKS THE DEVICE. The rail's account knows its reader and hands the
 * letters in (`Avatar`), and writes the address to the device as it draws (`useRememberAddress`);
 * a sign-in step's address pill knows only an address and asks the device whether it has signed
 * in with it (`AddressAvatar`). What is kept and why is `lib/avatar.js`'s header.
 *
 * BEFORE THE PAGE CAN READ THE DEVICE, THE PILL HOLDS AN EMPTY PLACE. A server renders the
 * confirmation step with no device to ask, so until the page hydrates the pill keeps the
 * avatar's 24 and draws nothing in it — no person mark it might take back a moment later. A
 * step reached from another step reads the device at once.
 */

const AVATAR = "flex size-avatar shrink-0 items-center justify-center rounded-full";
const SIGNED_IN_ADDRESSES_CHANGED = "hye-portal:signed-in-addresses-changed";

const readStored = () => {
    try {
        return window.localStorage.getItem(SIGNED_IN_ADDRESSES_KEY);
    } catch {
        return null;
    }
};

const subscribe = (onChange) => {
    const onStorage = (event) => {
        if (event.key === null || event.key === SIGNED_IN_ADDRESSES_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SIGNED_IN_ADDRESSES_CHANGED, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(SIGNED_IN_ADDRESSES_CHANGED, onChange);
    };
};

/** A person's avatar: their letters on their address's pair (0q.2, 0q.5). */
export function Avatar({ letters, email }) {
    const tone = avatarTone(email);
    const size = [...letters].length > 1 ? "text-heading-sm font-semibold" : "text-body-sm font-semibold";
    return (
        <span aria-hidden="true" data-avatar={tone.name} className={`${AVATAR} ${tone.className} ${size}`}>
            {letters}
        </span>
    );
}

/** An address's avatar on a sign-in step: its letters if this device has signed in with it, else the person mark (0q.9). */
export function AddressAvatar({ email }) {
    const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
    if (stored === undefined) return <span aria-hidden="true" data-avatar="pending" className={`${AVATAR} invisible`} />;
    const letters = lettersSignedInWith(stored, email);
    if (letters) return <Avatar letters={letters} email={email} />;
    return (
        <span aria-hidden="true" data-avatar="unknown" className={`${AVATAR} bg-background-muted`}>
            <Icon name="user" kind="qualifier" className="size-icon-sm" />
        </span>
    );
}

/** Keeps this device's memory that it has signed in with an address, and the letters it draws. */
export function useRememberAddress(email, letters) {
    useEffect(() => {
        if (!email || !letters) return;
        try {
            const was = window.localStorage.getItem(SIGNED_IN_ADDRESSES_KEY);
            const next = withAddressSignedIn(was, email, letters);
            if (next === was) return;
            window.localStorage.setItem(SIGNED_IN_ADDRESSES_KEY, next);
            window.dispatchEvent(new Event(SIGNED_IN_ADDRESSES_CHANGED));
        } catch {
            // A device that refuses storage remembers nothing (lib/avatar.js).
        }
    }, [email, letters]);
}

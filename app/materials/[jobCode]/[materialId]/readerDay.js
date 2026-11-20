"use client";

import { useSyncExternalStore } from "react";
import { dayOf, readerTimeZone } from "@/lib/format";
import { isoDay } from "@/lib/materialStock";

// The reader's own today and zone, for the forms on a material's page (#675, #677). Both are known
// only in their browser, so the server draws them empty and the browser fills them in: a date field
// starts at the reader's today, and every press sends the zone, so the server judges "later than
// today" by the reader's day rather than its own (`lib/materialTransit.js:todayIn`).

const noSubscription = () => () => {};
const readerToday = () => isoDay(dayOf(new Date(), readerTimeZone()));
const nothing = () => "";

/** The reader's today as `YYYY-MM-DD`, or "" while the server draws. */
export function useReaderToday() {
    return useSyncExternalStore(noSubscription, readerToday, nothing);
}

/** The reader's zone by its IANA name, or "" while the server draws. */
export function useReaderTimeZone() {
    return useSyncExternalStore(noSubscription, readerTimeZone, nothing);
}

// Shared display formatters. Keep purely presentational — no business
// logic, no Airtable shapes.

// Currency fields in this app are USD-only (see CLAUDE.md's Materials
// note) and follow a "blank = 0" convention: Total Amount / Shipping Fee
// come back null when unset, and we render those as $0.00 rather than a
// blank cell so PR and PO layouts stay identical. Not reused for the PO
// PDF, which needs its own comma-free "USD 1234.56" format (lib/poPdf.js).
const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

export function formatUSD(value) {
    return usdFormatter.format(Number(value) || 0);
}

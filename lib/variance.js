// Invoice variance tolerance rules (issue #17's decision, implemented in
// #15). Not a single uniform rule — see CLAUDE.md's Phase 3 status entry
// for the reasoning behind each shape.

// Header: Invoice.Amount Due vs Calculated Total. Hybrid — passes if within
// an absolute-dollar floor OR a percentage of Calculated Total, whichever
// is more permissive.
const HEADER_TOLERANCE_ABS = 5;
const HEADER_TOLERANCE_PCT = 0.01;

// Line, Unit Price: Invoice Item vs its linked PO Item. Near-exact — only
// enough absolute tolerance to absorb floating-point/rounding noise.
const UNIT_PRICE_TOLERANCE_ABS = 0.01;

export function checkHeaderVariance(amountDue, calculatedTotal) {
    const tolerance = Math.max(HEADER_TOLERANCE_ABS, calculatedTotal * HEADER_TOLERANCE_PCT);
    return Math.abs(amountDue - calculatedTotal) > tolerance;
}

export function checkUnitPriceVariance(invoiceUnitPrice, poItemUnitPrice) {
    return Math.abs(invoiceUnitPrice - poItemUnitPrice) > UNIT_PRICE_TOLERANCE_ABS;
}

import { INVENTORY_COPY } from "@/lib/materialStock";

/**
 * The `In transit` cell of a job's list and a material's stock table (#677): what is leaving the
 * row's job or address and what is coming to it, a line each, or a dash when neither — so the row
 * says which way its material is moving without a second column.
 */
export default function InTransitCell({ figures, unit }) {
    const list = INVENTORY_COPY.list;
    if (!(figures.inTransitOut > 0) && !(figures.inTransitIn > 0)) return "—";
    return (
        <>
            {figures.inTransitOut > 0 ? <span className="block">{list.inTransitOut(figures.inTransitOut, unit)}</span> : null}
            {figures.inTransitIn > 0 ? <span className="block">{list.inTransitIn(figures.inTransitIn, unit)}</span> : null}
        </>
    );
}

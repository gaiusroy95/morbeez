/** Dispatch rack slots by courier — staff moves packed orders here before pickup. */
export const DISPATCH_RACK_BY_COURIER = {
    delhivery: 'D1',
    dtdc: 'D2',
    xpressbees: 'D3',
    bluedart: 'D4',
    ecom: 'D5',
};
export function suggestDispatchRack(courierName) {
    if (!courierName?.trim())
        return null;
    const key = courierName.trim().toLowerCase();
    for (const [name, rack] of Object.entries(DISPATCH_RACK_BY_COURIER)) {
        if (key.includes(name))
            return rack;
    }
    return 'D0';
}
//# sourceMappingURL=fulfillment-dispatch-racks.js.map
export const MANUAL_COURIER_OPTIONS = [
    'GRL',
    'ST Courier',
    'VRL',
    'Bus transport',
    'Local courier',
    'Customer preferred transport',
];
export function normalizeShippingMethod(value) {
    return value === 'manual' ? 'manual' : 'shiprocket';
}
//# sourceMappingURL=manual-couriers.js.map
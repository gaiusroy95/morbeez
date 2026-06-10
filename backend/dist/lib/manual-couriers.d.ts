export declare const MANUAL_COURIER_OPTIONS: readonly ["GRL", "ST Courier", "VRL", "Bus transport", "Local courier", "Customer preferred transport"];
export type ManualCourierOption = (typeof MANUAL_COURIER_OPTIONS)[number];
export type ShippingMethod = 'shiprocket' | 'manual';
export declare function normalizeShippingMethod(value: unknown): ShippingMethod;
//# sourceMappingURL=manual-couriers.d.ts.map
import type { PackagingSettings } from '../services/oms/packaging-settings.service.js';
/** Standard courier shipment dimensions (Shiprocket, NimbusPost, Delhivery, etc.). */
export type CourierShipmentDimensions = {
    length: number;
    breadth: number;
    height: number;
    weight: number;
    billingWeight: number;
};
export declare function volumetricWeightKg(lengthCm: number, breadthCm: number, heightCm: number, divisor?: number): number;
export declare function billingWeightKg(actualKg: number, lengthCm: number, breadthCm: number, heightCm: number, settings?: Pick<PackagingSettings, 'volumetricDivisorCm' | 'minBillingWeightKg'>): number;
export declare function buildCourierPayload(dimensions: CourierShipmentDimensions, settings?: Pick<PackagingSettings, 'minBillingWeightKg'>): CourierShipmentDimensions;
//# sourceMappingURL=courier-payload.d.ts.map
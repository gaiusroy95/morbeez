import { type ShippingBox } from './shipping-box.service.js';
export type PackageLineInsight = {
    lineId: string;
    productTitle: string;
    sku: string | null;
    qty: number;
    unitWeightKg: number;
    lineWeightKg: number;
    packagingCategoryId: string | null;
    packagingCategoryName: string | null;
    preferredBoxId: string | null;
    isFragile: boolean;
    isLiquid: boolean;
    stackable: boolean;
    weightSource: 'catalog' | 'settings_default';
};
export type PackageEstimate = {
    commerceOrderId: string;
    suggestedBox: ShippingBox;
    packagingCategoryId: string | null;
    packagingCategoryName: string | null;
    matchedRuleId: string | null;
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
    estimatedWeightKg: number;
    packageWeightKg: number;
    billingWeightKg: number;
    volumetricWeightKg: number;
    courierPayload: {
        length: number;
        breadth: number;
        height: number;
        weight: number;
    };
    lines: PackageLineInsight[];
    meta: Record<string, unknown>;
};
export declare const packageRuleEngineService: {
    estimateForOrder(commerceOrderId: string): Promise<PackageEstimate>;
    persistEstimate(commerceOrderId: string, estimate: PackageEstimate): Promise<void>;
    ensureEstimated(commerceOrderId: string): Promise<PackageEstimate>;
    buildEstimateFromOrder(order: Record<string, unknown>): Promise<PackageEstimate>;
    confirmPackage(commerceOrderId: string, actorEmail?: string): Promise<PackageEstimate>;
    overridePackage(commerceOrderId: string, input: {
        boxId?: string;
        lengthCm: number;
        breadthCm: number;
        heightCm: number;
        weightKg: number;
        actorEmail?: string;
    }): Promise<PackageEstimate>;
    resolveCourierDimensions(commerceOrderId: string): Promise<{
        length: number;
        breadth: number;
        height: number;
        weight: number;
        billingWeight: number;
        packageStatus: string;
    }>;
};
//# sourceMappingURL=package-rule-engine.service.d.ts.map
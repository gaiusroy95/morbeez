import type { PackageEstimate } from './package-rule-engine.service.js';
export declare const orderPackageService: {
    upsertFromEstimate(commerceOrderId: string, estimate: PackageEstimate, opts?: {
        status?: string;
        matchedRuleId?: string | null;
        packagingCategoryId?: string | null;
        overrideUsed?: boolean;
        confirmedBy?: string | null;
        confirmedAt?: string | null;
        selectedBoxId?: string | null;
    }): Promise<void>;
    getByOrderId(commerceOrderId: string): Promise<any>;
};
//# sourceMappingURL=order-package.service.d.ts.map
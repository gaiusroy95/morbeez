import type { ShippingBox } from './shipping-box.service.js';
export type PackageRule = {
    id: string;
    packagingCategoryId: string;
    packagingCategoryName: string;
    minWeightKg: number;
    maxWeightKg: number;
    preferredBoxId: string;
    preferredBoxCode: string;
    preferredBoxName: string;
    priority: number;
    active: boolean;
};
export declare const packageRuleService: {
    listAll(): Promise<PackageRule[]>;
    listActiveForCategory(categoryId: string): Promise<PackageRule[]>;
    matchRule(categoryId: string, totalWeightKg: number): Promise<{
        rule: PackageRule;
        box: ShippingBox;
    } | null>;
    create(input: {
        packagingCategoryId: string;
        minWeightKg: number;
        maxWeightKg: number;
        preferredBoxId: string;
        priority?: number;
    }): Promise<PackageRule>;
    update(id: string, patch: Partial<{
        packagingCategoryId: string;
        minWeightKg: number;
        maxWeightKg: number;
        preferredBoxId: string;
        priority: number;
        active: boolean;
    }>): Promise<PackageRule>;
};
//# sourceMappingURL=package-rule.service.d.ts.map
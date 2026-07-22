export type PackagingSettings = {
    defaultUnitWeightKg: number;
    volumetricDivisorCm: number;
    minBillingWeightKg: number;
};
export declare const packagingSettingsService: {
    getSettings(): Promise<PackagingSettings>;
    clearCache(): void;
    listAll(): Promise<{
        key: string;
        value: any;
        description: string | null;
        updatedAt: string | null;
    }[]>;
    update(key: string, value: unknown, description?: string): Promise<{
        key: string;
        value: any;
        description: string | null;
        updatedAt: string | null;
    }>;
};
//# sourceMappingURL=packaging-settings.service.d.ts.map
export declare const partnerSettingsService: {
    get(key: string): Promise<Record<string, unknown>>;
    list(): Promise<any[]>;
    upsert(key: string, value: Record<string, unknown>, updatedBy?: string): Promise<any>;
};
//# sourceMappingURL=partner-settings.service.d.ts.map
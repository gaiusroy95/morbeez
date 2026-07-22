export declare const marketInsightStorageService: {
    storagePath(farmerId: string, insightDate: string): string;
    uploadPng(farmerId: string, insightDate: string, buffer: Buffer): Promise<string | null>;
    publicUrl(storagePath: string): string | null;
};
//# sourceMappingURL=market-insight-storage.service.d.ts.map
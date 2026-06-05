export declare const packService: {
    startSession(pickListId: string, mode?: "barcode" | "manual"): Promise<any>;
    scanBarcode(packSessionId: string, scannedCode: string): Promise<{
        ok: boolean;
        error: string;
        line?: undefined;
        productTitle?: undefined;
        sku?: undefined;
    } | {
        ok: boolean;
        line: any;
        productTitle: any;
        sku: any;
        error?: undefined;
    }>;
    logScan(packSessionId: string, code: string, itemId: string | null, batchId: string | null, result: string, message: string): Promise<void>;
    completePack(pickListId: string, verifiedBy?: string): Promise<any>;
};
//# sourceMappingURL=pack.service.d.ts.map
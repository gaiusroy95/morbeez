export declare const packService: {
    startSession(pickListId: string, mode?: "barcode" | "manual"): Promise<any>;
    scanFulfillment(packSessionId: string, scannedCode: string): Promise<{
        ok: boolean;
        phase: string;
        error: string;
        rack?: undefined;
        message?: undefined;
        productTitle?: undefined;
        scannedQty?: undefined;
        requiredQty?: undefined;
        scanComplete?: undefined;
        printEnabled?: undefined;
    } | {
        ok: boolean;
        phase: string;
        rack: string;
        message: string;
        error?: undefined;
        productTitle?: undefined;
        scannedQty?: undefined;
        requiredQty?: undefined;
        scanComplete?: undefined;
        printEnabled?: undefined;
    } | {
        phase: string;
        ok: boolean;
        line: any;
        productTitle: any;
        sku: any;
        batchCode: any;
        error?: undefined;
        rack?: undefined;
        message?: undefined;
        scannedQty?: undefined;
        requiredQty?: undefined;
        scanComplete?: undefined;
        printEnabled?: undefined;
    } | {
        ok: boolean;
        phase: string;
        productTitle: any;
        scannedQty: number;
        requiredQty: number;
        scanComplete: boolean;
        printEnabled: boolean;
        message: string;
        error?: undefined;
        rack?: undefined;
    }>;
    scanBarcode(packSessionId: string, scannedCode: string): Promise<{
        ok: boolean;
        error: string;
        line?: undefined;
        productTitle?: undefined;
        sku?: undefined;
        batchCode?: undefined;
    } | {
        ok: boolean;
        line: any;
        productTitle: any;
        sku: any;
        batchCode: any;
        error?: undefined;
    }>;
    logScan(packSessionId: string, code: string, itemId: string | null, batchId: string | null, result: string, message: string): Promise<void>;
    completePack(pickListId: string, verifiedBy?: string): Promise<any>;
};
//# sourceMappingURL=pack.service.d.ts.map
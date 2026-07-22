export declare function buildLabelQrPayload(labelId: string, orderName?: string | null): string;
export declare function parseLabelQrPayload(code: string): {
    labelId: string;
    orderName?: string;
} | null;
export declare const employeeBatchService: {
    listWarehouseEmployees(): Promise<{
        id: string;
        fullName: string;
        email: string | null;
        role: string;
    }[]>;
    listAssignableOrders(limit?: number): Promise<{
        id: string;
        orderName: string;
        omsStatus: string;
        courier: string;
        awb: string | null;
        pickListId: string | null;
        createdAt: string;
    }[]>;
    assignOrdersToEmployee(input: {
        employeeId: string;
        employeeName: string;
        orderIds: string[];
        actorEmail?: string;
    }): Promise<{
        batch: any;
        orderIds: string[];
    }>;
    listBatches(opts?: {
        employeeId?: string;
        limit?: number;
    }): Promise<any[]>;
    getBatchDetail(batchId: string): Promise<{
        batch: any;
        labels: any[];
    }>;
    printBatch(batchId: string, actorEmail?: string): Promise<{
        batch: any;
        stack: Record<string, unknown>[];
        trayNote: string;
    }>;
    startPicking(commerceOrderId: string, employeeId?: string): Promise<{
        ok: boolean;
    }>;
    verifyShippingLabel(input: {
        commerceOrderId: string;
        scannedCode: string;
        employeeId?: string;
        employeeName?: string;
        actorEmail?: string;
    }): Promise<{
        ok: boolean;
        matched: boolean;
        error: string;
        alert: "wrong_label";
        expected?: undefined;
        scanned?: undefined;
        alreadyVerified?: undefined;
        message?: undefined;
        orderName?: undefined;
        labelId?: undefined;
    } | {
        ok: boolean;
        matched: boolean;
        error: string;
        alert: "wrong_label";
        expected: {
            orderId: string;
            orderName: {};
            employee?: undefined;
        };
        scanned: {
            labelId: string;
            orderName?: string;
        };
        alreadyVerified?: undefined;
        message?: undefined;
        orderName?: undefined;
        labelId?: undefined;
    } | {
        ok: boolean;
        matched: boolean;
        error: string;
        alert: "wrong_label";
        expected: {
            employee: any;
            orderId?: undefined;
            orderName?: undefined;
        };
        scanned?: undefined;
        alreadyVerified?: undefined;
        message?: undefined;
        orderName?: undefined;
        labelId?: undefined;
    } | {
        ok: boolean;
        matched: boolean;
        alreadyVerified: boolean;
        message: string;
        error?: undefined;
        alert?: undefined;
        expected?: undefined;
        scanned?: undefined;
        orderName?: undefined;
        labelId?: undefined;
    } | {
        ok: boolean;
        matched: boolean;
        message: string;
        orderName: {};
        labelId: string;
        error?: undefined;
        alert?: undefined;
        expected?: undefined;
        scanned?: undefined;
        alreadyVerified?: undefined;
    }>;
};
//# sourceMappingURL=employee-batch.service.d.ts.map
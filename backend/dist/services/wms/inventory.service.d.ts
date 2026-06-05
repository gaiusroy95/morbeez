export type StockSummaryRow = {
    inventoryItemId: string;
    sku: string;
    productTitle: string;
    available: number;
    reserved: number;
    damaged: number;
    returned: number;
    incoming: number;
    batches: Array<{
        id: string;
        batchCode: string;
        qtyOnHand: number;
        qtyReserved: number;
        qtyDamaged: number;
        qtyReturned: number;
        expiryDate: string | null;
        rackLocation: string | null;
    }>;
};
export declare const inventoryService: {
    upsertItemFromSku(input: {
        sku: string;
        productTitle: string;
        shopifyVariantId?: string | null;
        barcode?: string | null;
        hsnCode?: string | null;
        gstPercent?: number;
    }): Promise<any>;
    getStockSummary(opts?: {
        search?: string;
        warehouseId?: string;
    }): Promise<StockSummaryRow[]>;
    createBatchFromGrn(input: {
        inventoryItemId: string;
        warehouseId: string;
        locationId?: string | null;
        supplierId?: string | null;
        goodsReceiptId?: string | null;
        batchCode: string;
        mfgDate?: string | null;
        expiryDate?: string | null;
        qty: number;
        createdBy?: string;
    }): Promise<any>;
    /** FEFO: allocate from earliest expiry batches with available qty */
    reserveStock(input: {
        inventoryItemId: string;
        warehouseId: string;
        qty: number;
        orderLineId: string;
    }): Promise<Record<string, unknown>[]>;
    findByBarcode(code: string): Promise<any>;
    pickAllocation(allocationId: string, qty: number): Promise<any>;
    finalizePack(allocationId: string): Promise<void>;
};
//# sourceMappingURL=inventory.service.d.ts.map
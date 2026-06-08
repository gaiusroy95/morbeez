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
export type InventoryItemRow = {
    id: string;
    sku: string;
    productTitle: string;
};
export declare const inventoryService: {
    listInventoryItems(opts?: {
        search?: string;
    }): Promise<InventoryItemRow[]>;
    updateInventoryItem(id: string, input: {
        sku?: string;
        productTitle?: string;
    }): Promise<InventoryItemRow>;
    deactivateInventoryItem(id: string): Promise<void>;
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
        supplierCost?: number | null;
        freightCost?: number;
        customsCost?: number;
        packagingCost?: number;
        miscCost?: number;
        landedUnitCost?: number | null;
    }): Promise<any>;
    /** FEFO: allocate from earliest expiry batches with available qty */
    reserveStock(input: {
        inventoryItemId: string;
        warehouseId: string;
        qty: number;
        orderLineId: string;
    }): Promise<Record<string, unknown>[]>;
    findByBarcode(code: string): Promise<any>;
    findBatchByCode(batchCode: string, inventoryItemId?: string): Promise<any>;
    releaseOrderAllocations(commerceOrderId: string, actorEmail?: string): Promise<void>;
    processReturnStock(input: {
        commerceOrderId: string;
        stockAction: "resalable" | "damaged" | "quarantine" | "writeoff";
        lines: Array<{
            sku?: string;
            productTitle: string;
            qty: number;
            batchCode?: string;
        }>;
        actorEmail?: string;
    }): Promise<void>;
    adjustBatchStock(input: {
        batchId: string;
        adjustment: number;
        reason: string;
        actorEmail?: string;
    }): Promise<any>;
    setBatchStatus(batchId: string, status: "active" | "quarantine" | "expired" | "depleted"): Promise<any>;
    pickAllocation(allocationId: string, qty: number): Promise<any>;
    finalizePack(allocationId: string): Promise<void>;
    applyCommerceBatchToWarehouse(inventoryItemId: string, warehouseId: string, cb: Record<string, unknown>): Promise<number>;
    loadCommerceBatchesForItem(item: {
        id: string;
        sku: string | null;
        shopify_variant_id: string | null;
    }): Promise<{
        batches: Record<string, unknown>[];
        variantIds: string[];
    }>;
    /**
     * Mirror commerce_stock_batches (and Shopify catalog qty as fallback) into WMS inventory_batches.
     */
    syncCommerceBatchesToWarehouse(inventoryItemId: string): Promise<{
        syncedQty: number;
    }>;
    /** Push all commerce_stock_batches into the default warehouse (one-time / queue repair). */
    syncAllCommerceStockToWarehouse(): Promise<{
        syncedVariants: number;
        syncedQty: number;
        variantCount: number;
    }>;
};
//# sourceMappingURL=inventory.service.d.ts.map
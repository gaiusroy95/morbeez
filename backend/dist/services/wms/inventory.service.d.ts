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
type CatalogVariantRef = {
    id: string;
    sku?: string;
    option1?: string;
    packSize?: string;
    unit?: string;
    title?: string;
    inventory?: number;
};
type CatalogProductRef = {
    id: string;
    title: string;
    sku?: string | null;
    inventory?: number;
    variants?: CatalogVariantRef[];
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
    resolveCanonicalInventoryItemId(inventoryItemId: string): Promise<string>;
    ensureInventoryItemForVariant(variantId: string): Promise<string>;
    repointInventoryItemReferences(fromId: string, toId: string): Promise<void>;
    mergeDuplicateInventoryItem(fromId: string, toId: string): Promise<void>;
    dedupeInventoryItemsByVariant(): Promise<{
        merged: number;
        variantGroups: number;
    }>;
    loadCommerceVariantIds(): Promise<Set<string>>;
    loadCommerceBatchesByVariant(): Promise<Map<string, Array<{
        batchCode: string;
        qty: number;
    }>>>;
    ensureCommerceLinkedItem(variantId: string, catalogEntry?: {
        product: CatalogProductRef;
        variant: CatalogVariantRef;
    } | null): Promise<string>;
    extractVariantIdFromSku(sku: string | null | undefined): string | null;
    listInventoryItemIdsForVariant(variantId: string): Promise<string[]>;
    getAvailableWarehouseQty(inventoryItemId: string, warehouseId: string): Promise<number>;
    /**
     * Order lines often point at VAR-{variantId} items while Add Stock created a second row with the real SKU.
     * Pick the inventory_items row that actually has warehouse stock after commerce sync.
     */
    resolveInventoryItemForOrderLine(line: {
        id: string;
        inventory_item_id: string | null;
        sku: string | null;
        product_title: string;
    }): Promise<{
        inventoryItemId: string;
        available: number;
    }>;
    ensureCommerceStockSynced(force?: boolean): Promise<void>;
    getStockSummary(opts?: {
        search?: string;
        warehouseId?: string;
        sync?: boolean;
        forceSync?: boolean;
    }): Promise<StockSummaryRow[]>;
    getStockItemDetail(inventoryItemId: string, opts?: {
        warehouseId?: string;
    }): Promise<{
        inventoryItemId: string;
        sku: string;
        productTitle: string;
        available: number;
        reserved: number;
        damaged: number;
        returned: number;
        incoming: number;
        batches: {
            id: string;
            batchCode: string;
            qtyOnHand: number;
            qtyReserved: number;
            qtyDamaged: number;
            qtyReturned: number;
            expiryDate: string | null;
            rackLocation: string | null;
        }[];
    }>;
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
    collectLinkedInventoryItemIds(item: {
        id: string;
        sku: string | null;
        shopify_variant_id: string | null;
    }): Promise<string[]>;
    /**
     * Mirror commerce_stock_batches (and Shopify catalog qty as fallback) into WMS inventory_batches.
     * Applies to every inventory_items row sharing the same Shopify variant (fixes VAR-* duplicates).
     */
    syncCommerceBatchesToWarehouse(inventoryItemId: string, opts?: {
        shopifyFallback?: boolean;
    }): Promise<{
        syncedQty: number;
    }>;
    /** Push all commerce_stock_batches into the default warehouse (one-time / queue repair). */
    syncAllCommerceStockToWarehouse(): Promise<{
        syncedVariants: number;
        syncedQty: number;
        variantCount: number;
    }>;
};
export {};
//# sourceMappingURL=inventory.service.d.ts.map
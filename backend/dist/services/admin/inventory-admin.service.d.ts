export interface InventoryListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
}
export interface InventoryRow {
    productId: string;
    variantId: string;
    title: string;
    imageUrl: string | null;
    variant: string;
    batchNo: string;
    expiryDate: string;
    mfgDate: string;
    stock: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
    unitValueInr: number;
}
export interface CommerceStockBatch {
    id: string;
    batchCode: string;
    mfgDate: string | null;
    expiryDate: string | null;
    qty: number;
}
export interface InventoryVariantDetail {
    productId: string;
    variantId: string;
    title: string;
    variant: string;
    sku: string;
    barcode: string | null;
    currentStock: number;
    batches: CommerceStockBatch[];
}
export declare const inventoryAdminService: {
    list(query: InventoryListQuery): Promise<{
        rows: InventoryRow[];
        stats: {
            totalStockValue: number;
            totalStock: number;
            lowStockProducts: number;
            outOfStockProducts: number;
        };
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    lookup(input: {
        sku?: string;
        barcode?: string;
        variantId?: string;
        productId?: string;
    }): Promise<InventoryVariantDetail>;
    addIncomingStock(input: {
        variantId: string;
        batchCode: string;
        mfgDate?: string | null;
        expiryDate?: string | null;
        qty: number;
        actorEmail?: string;
    }): Promise<{
        productId: string;
        variantId: string;
        batchCode: string;
        addedQty: number;
        totalBalance: number;
    }>;
};
//# sourceMappingURL=inventory-admin.service.d.ts.map
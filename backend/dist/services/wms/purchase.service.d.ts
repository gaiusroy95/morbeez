export declare const purchaseService: {
    listSuppliers(): Promise<any[]>;
    createSupplier(input: {
        name: string;
        contactPhone?: string;
        contactEmail?: string;
        gstin?: string;
    }): Promise<any>;
    createPurchaseOrder(input: {
        supplierId?: string;
        warehouseId: string;
        lines: Array<{
            inventoryItemId: string;
            qtyOrdered: number;
            unitCost?: number;
        }>;
        notes?: string;
        createdBy?: string;
    }): Promise<any>;
    receiveGoods(input: {
        purchaseOrderId?: string;
        warehouseId: string;
        supplierId?: string;
        receivedBy?: string;
        lines: Array<{
            inventoryItemId: string;
            batchCode: string;
            qty: number;
            mfgDate?: string;
            expiryDate?: string;
            locationId?: string;
            supplierCost?: number;
            freightCost?: number;
            customsCost?: number;
            packagingCost?: number;
            miscCost?: number;
        }>;
    }): Promise<any>;
    listPurchaseOrders(limit?: number): Promise<any[]>;
    getPurchaseOrder(id: string): Promise<any>;
};
//# sourceMappingURL=purchase.service.d.ts.map
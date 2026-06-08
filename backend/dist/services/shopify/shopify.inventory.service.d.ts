export declare const shopifyInventoryService: {
    setVariantStock(variantId: number, stock: number): Promise<void>;
    /**
     * Apply stock quantities after product wizard save.
     * Matches input rows to saved Shopify variants by variant id, then by index.
     */
    syncWizardVariantStocks(inputVariants: Array<{
        id?: string;
        stock: number;
    }>, savedVariants: Array<{
        id: number;
    }>): Promise<void>;
};
//# sourceMappingURL=shopify.inventory.service.d.ts.map
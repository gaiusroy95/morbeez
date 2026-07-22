export type StoreVariant = {
    id: string;
    title: string;
    option1: string;
    packSize: string;
    unit: string;
    price: string;
    mrp: string;
    inventory: number;
};
export type StoreProduct = {
    id: string;
    title: string;
    handle: string;
    category: string;
    vendor: string;
    bodyHtml: string;
    imageUrl: string | null;
    images: Array<{
        id: string;
        src: string;
        alt: string | null;
    }>;
    price: string | null;
    inventory: number;
    variants: StoreVariant[];
};
export declare const storeCatalogService: {
    list(query: {
        page?: number;
        limit?: number;
        search?: string;
        category?: string;
    }): Promise<{
        products: StoreProduct[];
        categories: string[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    get(id: string): Promise<StoreProduct>;
};
//# sourceMappingURL=store-catalog.service.d.ts.map
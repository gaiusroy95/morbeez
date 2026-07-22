export type ReviewableLineItem = {
    productKey: string;
    title: string;
    quantity: number;
    imageUrl?: string | null;
    shopifyProductId?: string | null;
    shopifyVariantId?: string | null;
    sku?: string | null;
    review?: {
        id: string;
        rating: number;
        reviewText: string | null;
        createdAt: string;
    } | null;
};
declare function productKey(title: string, variantId?: string | null, sku?: string | null): string;
export declare const farmerProductReviewService: {
    productKey: typeof productKey;
    getReviewableLines(farmerId: string, orderId: string): Promise<{
        canReview: boolean;
        orderSource: "commerce" | "crm_manual";
        lines: ReviewableLineItem[];
    }>;
    submitReview(farmerId: string, orderId: string, input: {
        productKey: string;
        rating: number;
        reviewText?: string;
    }): Promise<{
        id: string;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        productKey: string;
        productTitle: string;
    }>;
    aggregateForProduct(shopifyProductId: string): Promise<{
        averageRating: number;
        reviewCount: number;
        reviews: {
            rating: number;
            reviewText: string | null;
            productTitle: string;
            createdAt: string;
        }[];
    }>;
};
export {};
//# sourceMappingURL=farmer-product-review.service.d.ts.map
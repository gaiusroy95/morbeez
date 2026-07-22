/** Shopify expects full country name and valid Indian province names on orders. */
export declare function normalizeShopifyCountry(country?: string | null): string;
export declare function normalizeShopifyProvince(state?: string | null): string;
export declare function normalizeShopifyPincode(zip?: string | null): string;
export declare function normalizeShopifyPhone(phone?: string | null): string;
export declare function parseShopifyErrorBody(text: string): string;
//# sourceMappingURL=shopify-address.d.ts.map
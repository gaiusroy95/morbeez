import { versionLabel, type ChannelPoolSnapshot, type ChannelPoolVersionRow } from './channel-pool.util.js';
export type ChannelPoolVariantView = {
    variantId: string;
    sku: string | null;
    current: ChannelPoolVersionRow | null;
    previous: ChannelPoolVersionRow | null;
    history: ChannelPoolVersionRow[];
};
export declare const channelPoolService: {
    listForProduct(productId: string): Promise<ChannelPoolVariantView[]>;
    resolve(input: {
        variantId?: string | number | null;
        sku?: string | null;
        asOf?: string | Date | null;
    }): Promise<ChannelPoolVersionRow | null>;
    snapshotForLine(input: {
        variantId?: string | number | null;
        sku?: string | null;
        asOf?: string | Date | null;
        salesInr?: number;
        existing?: Partial<ChannelPoolSnapshot> | null;
    }): Promise<ChannelPoolSnapshot>;
    createVersion(input: {
        productId: string;
        variantId: string;
        sku?: string | null;
        poolPct: unknown;
        agronomistMaxPct?: unknown;
        partnerMaxPct?: unknown;
        effectiveFrom: string;
        reason: string;
        adminId: string;
        adminEmail?: string;
    }): Promise<ChannelPoolVersionRow>;
};
export { versionLabel };
//# sourceMappingURL=channel-pool.service.d.ts.map
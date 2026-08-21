/** Date-only Channel Pool helpers (Asia/Kolkata calendar). */
export declare const CHANNEL_POOL_PRESETS: readonly [0, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30];
export type ChannelPoolStatus = 'pending' | 'active' | 'closed';
export type ChannelPoolVersionRow = {
    id: string;
    productId: string;
    variantId: string;
    sku: string | null;
    versionNumber: number;
    poolPct: number;
    agronomistMaxPct: number | null;
    partnerMaxPct: number | null;
    previousPoolPct: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    status: ChannelPoolStatus;
    changeReason: string;
    editedByAdminId: string | null;
    editedByName: string | null;
    editedAt: string;
};
export type ChannelPoolSnapshot = {
    channelPoolPct: number | null;
    channelPoolAgronomistPct: number | null;
    channelPoolPartnerPct: number | null;
    channelPoolVersionId: string | null;
    channelPoolVersionLabel: string | null;
    channelPoolEffectiveFrom: string | null;
    channelPoolAmount: number | null;
    channelPoolAgronomistAmount: number | null;
    channelPoolPartnerAmount: number | null;
};
/** YYYY-MM-DD in India. */
export declare function indiaToday(now?: Date): string;
export declare function versionLabel(versionNumber: number): string;
export declare function addCalendarDays(isoDate: string, days: number): string;
export declare function derivePoolStatus(row: {
    effectiveFrom: string;
    effectiveTo: string | null;
}, asOf: string): ChannelPoolStatus;
export declare function validatePoolPct(raw: unknown): number;
export declare function channelPoolAmount(salesInr: number, poolPct: number | null | undefined): number | null;
export declare function emptyChannelPoolSnapshot(): ChannelPoolSnapshot;
export declare function snapshotFromVersion(version: ChannelPoolVersionRow | null | undefined, salesInr?: number): ChannelPoolSnapshot;
export declare function poolColumnsFromSnapshot(pool: ChannelPoolSnapshot): {
    channel_pool_pct: number | null;
    channel_pool_agronomist_pct: number | null;
    channel_pool_partner_pct: number | null;
    channel_pool_version_id: string | null;
    channel_pool_version_label: string | null;
    channel_pool_effective_from: string | null;
};
/**
 * Version effective on asOf: range contains the date, latest version_number wins
 * (same-day revisions keep historical snapshots on older version ids).
 */
export declare function resolveVersionOnDate(versions: ChannelPoolVersionRow[], asOf: string): ChannelPoolVersionRow | null;
export declare function currentAndPrevious(versions: ChannelPoolVersionRow[], asOf: string): {
    current: ChannelPoolVersionRow | null;
    previous: ChannelPoolVersionRow | null;
};
export declare function isNoOpPoolChange(current: ChannelPoolVersionRow | null, nextPct: number, nextFrom: string, nextAgronomistMaxPct?: number | null, nextPartnerMaxPct?: number | null): boolean;
//# sourceMappingURL=channel-pool.util.d.ts.map
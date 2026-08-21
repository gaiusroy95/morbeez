/** Date-only Channel Pool helpers (Asia/Kolkata calendar). */
import { resolvePoolSplit } from '../../domain/remuneration/pool-split.js';
export const CHANNEL_POOL_PRESETS = [0, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30];
function round2(n) {
    return Math.round(n * 100) / 100;
}
/** YYYY-MM-DD in India. */
export function indiaToday(now = new Date()) {
    return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
export function versionLabel(versionNumber) {
    return `V${versionNumber}`;
}
export function addCalendarDays(isoDate, days) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
    return dt.toISOString().slice(0, 10);
}
export function derivePoolStatus(row, asOf) {
    if (row.effectiveFrom > asOf)
        return 'pending';
    if (row.effectiveTo && row.effectiveTo < asOf)
        return 'closed';
    return 'active';
}
export function validatePoolPct(raw) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error('Channel Pool must be between 0 and 100');
    }
    return round2(n);
}
export function channelPoolAmount(salesInr, poolPct) {
    if (poolPct == null || !Number.isFinite(poolPct))
        return null;
    if (!Number.isFinite(salesInr) || salesInr <= 0)
        return 0;
    return round2((salesInr * poolPct) / 100);
}
export function emptyChannelPoolSnapshot() {
    return {
        channelPoolPct: null,
        channelPoolAgronomistPct: null,
        channelPoolPartnerPct: null,
        channelPoolVersionId: null,
        channelPoolVersionLabel: null,
        channelPoolEffectiveFrom: null,
        channelPoolAmount: null,
        channelPoolAgronomistAmount: null,
        channelPoolPartnerAmount: null,
    };
}
export function snapshotFromVersion(version, salesInr) {
    if (!version)
        return emptyChannelPoolSnapshot();
    const split = resolvePoolSplit({
        poolPct: version.poolPct,
        agronomistMaxPct: version.agronomistMaxPct,
        partnerMaxPct: version.partnerMaxPct,
    });
    const sales = salesInr ?? 0;
    return {
        channelPoolPct: split.poolPct,
        channelPoolAgronomistPct: split.agronomistMaxPct,
        channelPoolPartnerPct: split.partnerMaxPct,
        channelPoolVersionId: version.id,
        channelPoolVersionLabel: versionLabel(version.versionNumber),
        channelPoolEffectiveFrom: version.effectiveFrom,
        channelPoolAmount: channelPoolAmount(sales, split.poolPct),
        channelPoolAgronomistAmount: channelPoolAmount(sales, split.agronomistMaxPct),
        channelPoolPartnerAmount: channelPoolAmount(sales, split.partnerMaxPct),
    };
}
export function poolColumnsFromSnapshot(pool) {
    return {
        channel_pool_pct: pool.channelPoolPct,
        channel_pool_agronomist_pct: pool.channelPoolAgronomistPct,
        channel_pool_partner_pct: pool.channelPoolPartnerPct,
        channel_pool_version_id: pool.channelPoolVersionId,
        channel_pool_version_label: pool.channelPoolVersionLabel,
        channel_pool_effective_from: pool.channelPoolEffectiveFrom,
    };
}
/**
 * Version effective on asOf: range contains the date, latest version_number wins
 * (same-day revisions keep historical snapshots on older version ids).
 */
export function resolveVersionOnDate(versions, asOf) {
    const hits = versions.filter((v) => {
        if (v.effectiveFrom > asOf)
            return false;
        if (v.effectiveTo && v.effectiveTo < asOf)
            return false;
        return true;
    });
    if (!hits.length)
        return null;
    hits.sort((a, b) => b.versionNumber - a.versionNumber);
    return hits[0] ?? null;
}
export function currentAndPrevious(versions, asOf) {
    const current = resolveVersionOnDate(versions, asOf);
    if (!current)
        return { current: null, previous: null };
    const older = versions
        .filter((v) => v.versionNumber < current.versionNumber)
        .sort((a, b) => b.versionNumber - a.versionNumber);
    return { current, previous: older[0] ?? null };
}
export function isNoOpPoolChange(current, nextPct, nextFrom, nextAgronomistMaxPct, nextPartnerMaxPct) {
    if (!current)
        return false;
    if (current.effectiveFrom !== nextFrom)
        return false;
    const currentSplit = resolvePoolSplit({
        poolPct: current.poolPct,
        agronomistMaxPct: current.agronomistMaxPct,
        partnerMaxPct: current.partnerMaxPct,
    });
    const nextSplit = resolvePoolSplit({
        poolPct: nextPct,
        agronomistMaxPct: nextAgronomistMaxPct,
        partnerMaxPct: nextPartnerMaxPct,
    });
    return (currentSplit.poolPct === nextSplit.poolPct &&
        currentSplit.agronomistMaxPct === nextSplit.agronomistMaxPct &&
        currentSplit.partnerMaxPct === nextSplit.partnerMaxPct);
}
//# sourceMappingURL=channel-pool.util.js.map
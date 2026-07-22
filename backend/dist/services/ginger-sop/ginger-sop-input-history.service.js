import { supabase } from '../../lib/supabase.js';
const HISTORY_DAYS = 21;
function sinceDate() {
    const d = new Date();
    d.setDate(d.getDate() - HISTORY_DAYS);
    return d.toISOString().slice(0, 10);
}
function productNames(products) {
    if (!Array.isArray(products))
        return [];
    return products
        .map((p) => {
        if (typeof p === 'string')
            return p;
        if (p && typeof p === 'object') {
            const row = p;
            return String(row.name ?? row.product ?? row.title ?? '').trim();
        }
        return '';
    })
        .filter(Boolean);
}
function analyzeWarnings(entries) {
    const warnings = [];
    const sprays = entries.filter((e) => e.activityType === 'spray_applied');
    const fertigations = entries.filter((e) => e.activityType === 'fertigation');
    if (sprays.length >= 4) {
        warnings.push(`High spray frequency: ${sprays.length} applications in ${HISTORY_DAYS} days`);
    }
    if (fertigations.length >= 5) {
        warnings.push(`High fertigation frequency: ${fertigations.length} events in ${HISTORY_DAYS} days`);
    }
    for (let i = 1; i < sprays.length; i++) {
        const prev = sprays[i - 1];
        const cur = sprays[i];
        const prevDate = new Date(prev.appliedAt).getTime();
        const curDate = new Date(cur.appliedAt).getTime();
        const gapDays = Math.abs(curDate - prevDate) / 86400000;
        if (gapDays < 3 && prev.products.length && cur.products.length) {
            const overlap = prev.products.some((p) => cur.products.some((c) => c.toLowerCase().includes(p.toLowerCase().slice(0, 6))));
            if (overlap) {
                warnings.push(`Possible repeat spray within ${Math.round(gapDays)}d: ${cur.products.join(', ')}`);
            }
        }
    }
    const qoiPattern = /azox|triflox|difenoconazole|tebuconazole|mancozeb/i;
    const qoiSprays = sprays.filter((s) => s.products.some((p) => qoiPattern.test(p)));
    if (qoiSprays.length >= 2) {
        warnings.push('QoI/triazole class used multiple times in 21d — check rotation resistance risk');
    }
    return [...new Set(warnings)].slice(0, 5);
}
export const gingerSopInputHistoryService = {
    async load21Day(farmerId, blockId) {
        const since = sinceDate();
        let q = supabase
            .from('cultivation_activities')
            .select('applied_at, activity_type, products, dosage_notes')
            .eq('farmer_id', farmerId)
            .gte('applied_at', since)
            .order('applied_at', { ascending: false })
            .limit(30);
        if (blockId) {
            q = q.eq('farm_block_id', blockId);
        }
        const { data: rows } = await q;
        const entries = (rows ?? []).map((r) => ({
            appliedAt: String(r.applied_at),
            activityType: String(r.activity_type ?? 'other'),
            products: productNames(r.products),
            dosageNotes: r.dosage_notes ? String(r.dosage_notes) : null,
        }));
        const sprayCount = entries.filter((e) => e.activityType === 'spray_applied').length;
        const fertigationCount = entries.filter((e) => e.activityType === 'fertigation').length;
        const warnings = analyzeWarnings(entries);
        return {
            days: HISTORY_DAYS,
            entries,
            sprayCount,
            fertigationCount,
            warnings,
            hasRecentActivity: entries.length > 0,
        };
    },
};
//# sourceMappingURL=ginger-sop-input-history.service.js.map
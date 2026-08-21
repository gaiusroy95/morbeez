export function amountForEvent(type, comp, extra) {
    if (!comp.incentiveEnabled)
        return 0;
    if (type === 'field_visit')
        return Math.max(0, comp.fieldVisitBonus);
    if (type === 'recommendation_success')
        return Math.max(0, comp.recommendationSuccessBonus);
    if (type === 'escalation_resolved')
        return Math.max(0, comp.escalationBonus);
    if (type === 'retention')
        return Math.max(0, comp.farmerRetentionBonus);
    if (type === 'km_allowance') {
        if (!comp.kmAllowanceEnabled)
            return 0;
        const km = extra?.km ?? 0;
        return Math.round(Math.max(0, km) * Math.max(0, comp.ratePerKm) * 100) / 100;
    }
    return 0;
}
export function periodMonth(at = new Date()) {
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
}
//# sourceMappingURL=agronomist-pay.js.map
export const RULE_STATUSES = [
    'draft',
    'submitted',
    'approved',
    'scheduled',
    'active',
    'expired',
];
export const RULE_TYPES = [
    'partner_kpi_factor',
    'agronomist_sales_slab',
    'settlement_80_20',
    'eligible_sale',
    'farmer_introduction',
    'partner_kpi_weights',
    'agronomist_kpi',
    'qualified_case',
    'diagnosis_qa',
];
const NEXT = {
    draft: ['submitted'],
    submitted: ['approved', 'draft'],
    approved: ['scheduled', 'active'],
    scheduled: ['active', 'expired'],
    active: ['expired'],
    expired: [],
};
export function canTransition(from, to) {
    const allowed = NEXT[from];
    if (!allowed)
        return false;
    return allowed.includes(to);
}
export function assertTransition(from, to) {
    if (from === to)
        return;
    if (!canTransition(from, to)) {
        throw new Error(`Cannot move a ${from} rule to ${to}`);
    }
}
export function isMutableStatus(status) {
    return status === 'draft';
}
export function shouldActivateNow(effectiveFrom, asOf = new Date()) {
    const day = asOf.toISOString().slice(0, 10);
    return effectiveFrom <= day;
}
export function previousMonth(asOf = new Date()) {
    const y = asOf.getUTCFullYear();
    const m = asOf.getUTCMonth();
    const d = new Date(Date.UTC(y, m - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function monthKey(asOf = new Date()) {
    return `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function monthLastDay(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0, 12, 0, 0));
}
export function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return {
        start,
        end,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
    };
}
//# sourceMappingURL=rule-workflow.js.map
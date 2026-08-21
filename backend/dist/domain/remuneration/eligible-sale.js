const TERMINAL_BAD = new Set(['cancelled', 'returned', 'refunded', 'rto', 'lost']);
const DELIVERED = new Set(['delivered', 'completed']);
export function addCalendarDaysIso(fromIso, days) {
    const d = new Date(fromIso);
    if (Number.isNaN(d.getTime())) {
        const [y, m, day] = fromIso.slice(0, 10).split('-').map(Number);
        const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (day ?? 1) + days));
        return dt.toISOString();
    }
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
}
export function evaluateEligibleSale(facts) {
    if (facts.fraud)
        return { status: 'excluded', reason: 'fraud', eligibleAt: null };
    if (facts.excluded) {
        return { status: 'excluded', reason: facts.excludedReason?.trim() || 'excluded_transaction', eligibleAt: null };
    }
    if (facts.cancelled || TERMINAL_BAD.has(String(facts.omsStatus ?? '').toLowerCase())) {
        return { status: 'excluded', reason: 'cancelled', eligibleAt: null };
    }
    if (facts.returned)
        return { status: 'excluded', reason: 'returned', eligibleAt: null };
    if (facts.refunded)
        return { status: 'excluded', reason: 'refunded', eligibleAt: null };
    if (!facts.paid)
        return { status: 'pending_payment', reason: null, eligibleAt: null };
    const delivered = Boolean(facts.deliveredAt) || DELIVERED.has(String(facts.omsStatus ?? '').toLowerCase());
    if (!delivered)
        return { status: 'pending_delivery', reason: null, eligibleAt: null };
    const windowDays = Math.max(0, Math.floor(facts.returnWindowDays || 0));
    const deliveredAt = facts.deliveredAt ?? new Date().toISOString();
    const eligibleAt = addCalendarDaysIso(deliveredAt, windowDays);
    const now = facts.now ?? new Date();
    if (new Date(eligibleAt).getTime() > now.getTime()) {
        return { status: 'pending_return_window', reason: null, eligibleAt };
    }
    return { status: 'eligible', reason: null, eligibleAt };
}
//# sourceMappingURL=eligible-sale.js.map
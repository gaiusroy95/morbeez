export const DEFAULT_SETTLEMENT_RULE = {
    firstPct: 80,
    holdPct: 20,
    firstDelayMonths: 2,
    holdDelayMonths: 3,
};
export function addCalendarMonths(yearMonth, months) {
    const [y, m] = yearMonth.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m ?? 1) - 1 + months, 1));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
export function splitSettlement(grossInr, earningMonth, rule = DEFAULT_SETTLEMENT_RULE) {
    const gross = Math.round(Math.max(0, grossInr) * 100) / 100;
    const firstPct = Math.min(100, Math.max(0, rule.firstPct));
    const eighty = Math.round(gross * (firstPct / 100) * 100) / 100;
    const twenty = Math.round((gross - eighty) * 100) / 100;
    return [
        {
            tranche: 'eighty',
            amountInr: eighty,
            payableOn: addCalendarMonths(earningMonth, rule.firstDelayMonths),
        },
        {
            tranche: 'twenty',
            amountInr: twenty,
            payableOn: addCalendarMonths(earningMonth, rule.holdDelayMonths),
        },
    ];
}
//# sourceMappingURL=settlement-split.js.map
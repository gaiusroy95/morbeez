/** Crop-specific DAP → growth stage rules for farmer portal surfaces. */
const GINGER_CYCLE_DAYS = 270;
const GINGER_STAGES = [
    { maxDap: 30, label: 'Sprouting' },
    { maxDap: 90, label: 'Vegetative' },
    { maxDap: 150, label: 'Tillering' },
    { maxDap: 210, label: 'Bulking' },
    { maxDap: Infinity, label: 'Maturity' },
];
const DEFAULT_STAGES = [
    { maxDap: 30, label: 'Early growth' },
    { maxDap: 60, label: 'Vegetative growth' },
    { maxDap: 120, label: 'Active development' },
    { maxDap: Infinity, label: 'Maturity phase' },
];
function normalizeCrop(crop) {
    return (crop ?? '').trim().toLowerCase();
}
function stageFromTable(dap, table) {
    for (const row of table) {
        if (dap <= row.maxDap)
            return row.label;
    }
    return table[table.length - 1]?.label ?? 'Growing';
}
export function cropCycleDays(crop) {
    const c = normalizeCrop(crop);
    if (c === 'ginger')
        return GINGER_CYCLE_DAYS;
    return 365;
}
export function growthStageFromDap(crop, dap, storedStage) {
    if (storedStage?.trim())
        return storedStage.trim();
    if (dap == null)
        return 'Growing';
    const table = normalizeCrop(crop) === 'ginger' ? GINGER_STAGES : DEFAULT_STAGES;
    return stageFromTable(dap, table);
}
/** @deprecated Use growthStageFromDap */
export function growthStageLabel(crop, stage, dap) {
    return growthStageFromDap(crop, dap, stage);
}
//# sourceMappingURL=crop-stage.service.js.map
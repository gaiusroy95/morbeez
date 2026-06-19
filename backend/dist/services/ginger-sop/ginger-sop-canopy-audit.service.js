/** DAP → expected canopy closure % (SOP Phase 5). */
const DAP_CANOPY_EXPECTATION = [
    { dap: 30, closurePct: 20 },
    { dap: 45, closurePct: 40 },
    { dap: 60, closurePct: 60 },
    { dap: 75, closurePct: 80 },
    { dap: 90, closurePct: 90 },
];
function expectedClosureForDap(dap) {
    if (dap == null || dap < 0)
        return null;
    let best = DAP_CANOPY_EXPECTATION[0];
    for (const row of DAP_CANOPY_EXPECTATION) {
        if (dap >= row.dap)
            best = row;
    }
    return best.closurePct;
}
export const gingerSopCanopyAuditService = {
    build(params) {
        const dapExpected = expectedClosureForDap(params.dap ?? null);
        const closure = params.canopyClosurePct ?? null;
        const canopyGapPct = closure != null && dapExpected != null
            ? Math.round(Math.max(0, dapExpected - closure))
            : null;
        const auditComplete = params.bedFloorVisibilityScore != null ||
            params.weedPressureScore != null ||
            closure != null;
        return {
            bedFloorVisibilityScore: params.bedFloorVisibilityScore ?? null,
            weedPressureScore: params.weedPressureScore ?? null,
            canopyClosurePct: closure,
            dapExpectedClosurePct: dapExpected,
            canopyGapPct,
            auditComplete,
        };
    },
    scoreForModule(audit) {
        if (!audit?.auditComplete)
            return 20;
        let score = 55;
        if (audit.weedPressureScore != null) {
            score += audit.weedPressureScore * 6;
        }
        if (audit.bedFloorVisibilityScore != null) {
            score += audit.bedFloorVisibilityScore * 4;
        }
        if (audit.canopyGapPct != null && audit.canopyGapPct <= 15) {
            score += 10;
        }
        else if (audit.canopyGapPct != null && audit.canopyGapPct > 25) {
            score -= 12;
        }
        return Math.max(15, Math.min(92, Math.round(score)));
    },
};
//# sourceMappingURL=ginger-sop-canopy-audit.service.js.map
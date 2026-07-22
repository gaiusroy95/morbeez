function expectedClosureForDap(dap, expectations) {
    if (dap == null || dap < 0 || !expectations?.length)
        return null;
    let best = expectations[0];
    for (const row of expectations) {
        if (dap >= row.dap)
            best = row;
    }
    return best.closurePct;
}
export const canopyAuditService = {
    build(pack, params) {
        const dapExpected = expectedClosureForDap(params.dap ?? null, pack.canopyExpectations);
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
        if (audit.weedPressureScore != null)
            score += audit.weedPressureScore * 6;
        if (audit.bedFloorVisibilityScore != null)
            score += audit.bedFloorVisibilityScore * 4;
        if (audit.canopyGapPct != null && audit.canopyGapPct <= 15)
            score += 10;
        else if (audit.canopyGapPct != null && audit.canopyGapPct > 25)
            score -= 12;
        return Math.max(15, Math.min(92, Math.round(score)));
    },
};
//# sourceMappingURL=canopy-audit.service.js.map
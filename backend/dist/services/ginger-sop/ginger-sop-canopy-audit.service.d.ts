import type { GingerCanopyAudit } from '../../domain/ginger-sop/types.js';
export declare const gingerSopCanopyAuditService: {
    build(params: {
        bedFloorVisibilityScore?: number | null;
        weedPressureScore?: number | null;
        canopyClosurePct?: number | null;
        dap?: number | null;
    }): GingerCanopyAudit;
    scoreForModule(audit: GingerCanopyAudit | undefined): number;
};
//# sourceMappingURL=ginger-sop-canopy-audit.service.d.ts.map
import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { MaiosCanopyAudit } from '../../domain/case/types.js';
export declare const canopyAuditService: {
    build(pack: CropPackConfig, params: {
        bedFloorVisibilityScore?: number | null;
        weedPressureScore?: number | null;
        canopyClosurePct?: number | null;
        dap?: number | null;
    }): MaiosCanopyAudit;
    scoreForModule(audit: MaiosCanopyAudit | undefined): number;
};
//# sourceMappingURL=canopy-audit.service.d.ts.map
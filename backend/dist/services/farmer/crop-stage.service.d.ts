/** Crop-specific DAP → growth stage rules for farmer portal surfaces. */
export declare function cropCycleDays(crop: string | null | undefined): number;
export declare function growthStageFromDap(crop: string | null | undefined, dap: number | null, storedStage?: string | null): string;
/** @deprecated Use growthStageFromDap */
export declare function growthStageLabel(crop: string | null | undefined, stage: string | null | undefined, dap: number | null): string;
//# sourceMappingURL=crop-stage.service.d.ts.map
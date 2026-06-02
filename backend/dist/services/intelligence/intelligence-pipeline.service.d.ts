import type { FarmerEventType } from './farmer-event.types.js';
/**
 * Orchestrates post-event intelligence: debounced opportunity score refresh.
 * Employee batch scores still run nightly via farmer-opportunity-score.worker.
 */
export declare const intelligencePipelineService: {
    onFarmerEventRecorded(farmerId: string, eventType: FarmerEventType): void;
    /** Immediate full farmer score (admin recalc, tests). */
    refreshFarmerNow(farmerId: string): Promise<void>;
};
//# sourceMappingURL=intelligence-pipeline.service.d.ts.map
import type { FarmerEventRow, FarmerEventType, RecordFarmerEventInput } from './farmer-event.types.js';
/**
 * Phase 0: record + query API for farmer_events.
 * Phase 1 will call record() from WhatsApp, CRM, agronomist, ROI pipelines.
 */
export declare const farmerEventService: {
    record(input: RecordFarmerEventInput): Promise<FarmerEventRow>;
    listForFarmer(farmerId: string, opts?: {
        limit?: number;
        since?: string;
        eventTypes?: FarmerEventType[];
    }): Promise<FarmerEventRow[]>;
};
//# sourceMappingURL=farmer-event.service.d.ts.map
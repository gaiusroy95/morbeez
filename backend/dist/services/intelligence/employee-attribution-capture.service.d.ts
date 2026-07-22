import type { UpsertAttributionInput } from './employee-attribution.types.js';
import type { FarmerEventType } from './farmer-event.types.js';
export declare const ATTRIBUTION_CONVERSION_WINDOW_DAYS = 180;
/**
 * Phase 2: fire-and-forget multi-touch attribution. Never throws to callers.
 */
export declare const employeeAttributionCaptureService: {
    upsertSafe(input: UpsertAttributionInput): Promise<void>;
    trackTelecallerAssigned(farmerId: string, agentEmail: string): Promise<void>;
    trackInboundEngagement(farmerId: string, assigneeEmail: string | null): Promise<void>;
    trackAdvisory(farmerId: string, agentEmail: string, metadata?: Record<string, unknown>): Promise<void>;
    trackReactivation(farmerId: string, employeeEmail: string | null): Promise<void>;
    trackConversionForOrder(farmerId: string, metadata: {
        shopifyOrderId: string;
        orderName?: string | null;
        total?: string | number | null;
    }): Promise<void>;
    /** Map recorded farmer events to attribution side-effects (Phase 0 rules). */
    onFarmerEvent(params: {
        farmerId: string;
        eventType: FarmerEventType;
        employeeEmail?: string | null;
        eventValue?: Record<string, unknown>;
    }): Promise<void>;
};
//# sourceMappingURL=employee-attribution-capture.service.d.ts.map
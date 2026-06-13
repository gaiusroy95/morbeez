import type { PartnerAttributionType } from './partner.types.js';
export declare const partnerAttributionCaptureService: {
    upsertTouch(input: {
        farmerId: string;
        partnerId: string;
        attributionType: PartnerAttributionType;
        weight?: number;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    trackEnrollment(farmerId: string, partnerId: string, source: string): Promise<void>;
    trackVisit(farmerId: string, partnerId: string, findingId?: string): Promise<void>;
    listForFarmer(farmerId: string): Promise<any[]>;
};
//# sourceMappingURL=partner-attribution-capture.service.d.ts.map
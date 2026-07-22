import type { FastifyRequest } from 'fastify';
import { partnerService } from '../services/partner/partner.service.js';
export type PartnerRequest = FastifyRequest & {
    partner: Awaited<ReturnType<typeof partnerService.getById>>;
};
export declare function requirePartner(request: FastifyRequest): Promise<{
    id: string;
    partnerCode: string;
    fullName: string;
    phone: string;
    email: string | null;
    status: import("../services/partner/partner.types.js").PartnerStatus;
    tier: import("../services/partner/partner.types.js").PartnerTier;
    state: string | null;
    district: string | null;
    taluk: string | null;
    village: string | null;
    languages: string[];
    cropsExpertise: string[];
    referralSlug: string | null;
    qrToken: string | null;
    maxActiveFarmers: number;
    currentActiveFarmers: number;
    reliabilityScore: number;
    performanceScore: number;
    leadAllocationWeight: number;
    commissionEligible: boolean;
    referralUrl: string;
}>;
//# sourceMappingURL=require-partner.d.ts.map
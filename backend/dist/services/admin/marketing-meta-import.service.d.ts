import type { LeadChannel } from '../../domain/marketing/lead-attribution.js';
export declare const marketingMetaImportService: {
    importCsv(csvText: string, defaults?: {
        leadChannel?: LeadChannel | string;
        campaignSource?: string;
        marketingOwnerId?: string | null;
        marketingOwnerName?: string | null;
    }): Promise<{
        imported: number;
        skipped: number;
        errors: string[];
    }>;
};
//# sourceMappingURL=marketing-meta-import.service.d.ts.map
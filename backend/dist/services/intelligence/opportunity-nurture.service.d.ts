/**
 * Step 14 — low-opportunity / quiet farmers: CRM tasks + optional WhatsApp education nudge.
 */
export declare const opportunityNurtureService: {
    enqueueLowOpportunityNurture(opts?: {
        limit?: number;
        maxScore?: number;
        silentDays?: number;
    }): Promise<{
        tasksCreated: number;
        whatsappSent: number;
        skipped: number;
    }>;
};
//# sourceMappingURL=opportunity-nurture.service.d.ts.map
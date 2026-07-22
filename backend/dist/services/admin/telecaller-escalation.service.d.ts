/**
 * Create or update agronomist case review from a telecaller operational interaction.
 * Uses a lightweight AI advisory session row (required by agronomist_escalations FK).
 */
export declare const telecallerEscalationService: {
    escalateFromInteraction(params: {
        farmerId: string;
        leadId: string | null;
        interactionLogId: string;
        summary: string;
        interactionType: string;
        blockId?: string;
        cropType?: string;
        agentEmail: string;
    }): Promise<{
        escalationId: string;
        created: boolean;
    }>;
};
//# sourceMappingURL=telecaller-escalation.service.d.ts.map
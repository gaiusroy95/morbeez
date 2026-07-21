export type VisitWizardDraftPhotoRef = {
    storagePath: string;
    photoType: string;
    mimeType: string;
    filename?: string;
};
export type UpsertVisitWizardDraftInput = {
    sessionId: string;
    farmerId: string;
    blockId?: string | null;
    agronomistEmail: string;
    currentStep: string;
    wizardVersion?: string;
    payload: Record<string, unknown>;
    photoRefs?: VisitWizardDraftPhotoRef[];
};
export declare const visitWizardDraftService: {
    upsert(input: UpsertVisitWizardDraftInput): Promise<any>;
    getBySessionId(sessionId: string): Promise<any>;
    listByAgent(agronomistEmail: string, limit?: number): Promise<{
        id: any;
        session_id: any;
        farmer_id: any;
        block_id: any;
        current_step: any;
        wizard_version: any;
        updated_at: any;
        saved_at: any;
        farmers: {
            id: any;
            name: any;
            phone: any;
        }[];
        farm_blocks: {
            id: any;
            name: any;
            crop_type: any;
        }[];
    }[]>;
    markSubmitted(sessionId: string): Promise<void>;
    deleteBySessionId(sessionId: string): Promise<void>;
    assertSessionOwner(sessionId: string, agronomistEmail: string): Promise<{
        id: any;
        agronomist_email: any;
    }>;
};
//# sourceMappingURL=visit-wizard-draft.service.d.ts.map
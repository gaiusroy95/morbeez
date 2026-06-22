import type { DiagnoseInput, DiagnoseResult } from './types.js';
export declare const cropDoctorService: {
    diagnose(input: DiagnoseInput): Promise<DiagnoseResult>;
    scheduleFollowUp(farmerId: string, sessionId: string, language: string): Promise<void>;
    getSession(sessionId: string): Promise<any>;
    requestCallback(sessionId: string, farmerId: string): Promise<void>;
    diagnoseByPhone(params: {
        phone: string;
        name?: string;
        language: DiagnoseInput["language"];
        cropType: string;
        cropStage?: string;
        symptomsText?: string;
        voiceTranscript?: string;
        imageBase64?: string;
        imageMimeType?: string;
        channel: DiagnoseInput["channel"];
    }): Promise<DiagnoseResult>;
};
/** Shared diagnosis integrity surface for visit + WhatsApp convergence (Phase 6). */
export { diagnosisOrchestratorService } from '../diagnosis/diagnosis-orchestrator.service.js';
//# sourceMappingURL=crop-doctor.service.d.ts.map
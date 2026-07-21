import type { DiagnosisPending, SessionContext } from '../scenarios/session-context.types.js';
export type DiagnosisTranscriptRole = 'farmer' | 'assistant' | 'system';
export type DiagnosisTranscriptEntry = {
    role: DiagnosisTranscriptRole;
    text: string;
    at: string;
};
export declare const diagnosisSessionEvidenceService: {
    collectPendingPhotoPaths(ctx: SessionContext): string[];
    rememberPhotoPaths(farmerId: string, paths: string[]): Promise<string[]>;
    appendTranscript(farmerId: string, role: DiagnosisTranscriptRole, text: string): Promise<void>;
    appendQaPair(farmerId: string, question: string, answer: string): Promise<void>;
    /**
     * Persist session id + photos + optional summary onto the active diagnosis thread.
     */
    bindSession(farmerId: string, sessionId: string, options?: {
        photoPaths?: string[];
        summary?: string;
        dosageItems?: DiagnosisPending["dosageItems"];
    }): Promise<void>;
    resolvePhotoPaths(params: {
        farmerId?: string | null;
        sessionId?: string | null;
    }): Promise<string[]>;
    loadImages(params: {
        farmerId?: string | null;
        sessionId?: string | null;
    }): Promise<Array<{
        imageBase64: string;
        mimeType: string;
        path: string;
    }>>;
    formatTranscript(entries: DiagnosisTranscriptEntry[] | undefined | null, max?: number): string;
    getTranscript(farmerId: string): Promise<DiagnosisTranscriptEntry[]>;
    /**
     * Prompt block: photo status + diagnosis-thread chat (intake Q&A, farmer corrections).
     */
    formatEvidenceForPrompt(params: {
        farmerId: string;
        sessionId?: string | null;
    }): Promise<string>;
};
//# sourceMappingURL=diagnosis-session-evidence.service.d.ts.map
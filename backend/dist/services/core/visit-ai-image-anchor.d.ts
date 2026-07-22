import type { VisitImageSignal } from './visit-ai-image.service.js';
type DetectedVisitIssue = {
    category: string;
    issueName: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    observation?: string;
    rootCause: {
        symptoms: string[];
        photoSignals: string[];
        soilSignals: string[];
        weatherSignals: string[];
        conclusion: string;
    };
    evidence: {
        photoSummary: string;
        measurementSummary: string;
        soilSummary: string;
        weatherSummary: string;
        historySummary: string;
    };
};
export declare function visitPhotoTypePriority(photoType?: string | null): number;
export declare function sortVisitPhotosForDiagnosis<T extends {
    photoType?: string | null;
}>(photos: T[]): T[];
export declare function anchorPrimaryIssueToImageSignal(issues: DetectedVisitIssue[], imageSignal: VisitImageSignal | null | undefined, minConfidence?: number): DetectedVisitIssue[];
export {};
//# sourceMappingURL=visit-ai-image-anchor.d.ts.map
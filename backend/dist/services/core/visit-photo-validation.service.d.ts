export type VisitPhotoValidationIssue = 'blur' | 'dark' | 'low_resolution' | 'coverage';
export type VisitPhotoValidationResult = {
    ok: boolean;
    issues: VisitPhotoValidationIssue[];
    retakeRecommended: boolean;
};
export declare function validateVisitPhotoBuffer(buffer: Buffer, mimeType?: string): VisitPhotoValidationResult;
export declare const visitPhotoValidationService: {
    validateBase64(dataBase64: string, mimeType?: string): VisitPhotoValidationResult;
};
//# sourceMappingURL=visit-photo-validation.service.d.ts.map
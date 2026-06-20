declare function isFieldLevelPhotoType(photoType: string): boolean;
declare function isSymptomPhotoType(photoType: string): boolean;
/** Map vision / WhatsApp classifier categories to a visit photo type for a crop. */
export declare function mapClassifierCategoryToVisitPhotoType(category: string, cropType: string, availableTypes: string[]): string;
export { isFieldLevelPhotoType, isSymptomPhotoType };
export type VisitPhotoClassification = {
    photoType: string;
    confidence: number;
    source: 'vision' | 'heuristic';
    label?: string;
};
export declare const visitPhotoClassifierService: {
    classify(params: {
        dataBase64: string;
        mimeType?: string;
        cropType: string;
        availableTypes: string[];
        caption?: string;
    }): Promise<VisitPhotoClassification | null>;
};
//# sourceMappingURL=visit-photo-classifier.service.d.ts.map
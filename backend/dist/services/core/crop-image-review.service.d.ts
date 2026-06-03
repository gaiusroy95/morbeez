import type { ImageReviewStatus } from '../../domain/ai-training/enums.js';
import type { ReviewSeverity } from '../../domain/ai-training/enums.js';
export type CropImageReviewAction = 'confirm_ai' | 'correct_ai' | 'skip' | 'exclude';
export type EnqueueCropImageInput = {
    farmerId: string;
    blockId?: string | null;
    aiSessionId?: string | null;
    fieldFindingId?: string | null;
    interactionLogId?: string | null;
    storagePath?: string | null;
    externalUrl?: string | null;
    source?: 'whatsapp' | 'field_visit' | 'crm' | 'api';
    crop?: string | null;
    dap?: number | null;
    symptoms?: string[];
    gpsRegion?: string | null;
    aiPrediction?: string | null;
    aiConfidence?: number | null;
    metadata?: Record<string, unknown>;
};
export declare const cropImageReviewService: {
    enqueue(input: EnqueueCropImageInput): Promise<string | null>;
    enqueueFromSession(params: {
        sessionId: string;
        farmerId: string;
        storagePath: string;
        cropType: string;
        blockId?: string | null;
        symptoms?: string[];
        aiPrediction?: string | null;
        aiConfidence?: number | null;
    }): Promise<string | null>;
    syncPendingFromExisting(limit?: number): Promise<number>;
    listQueue(params: {
        status?: ImageReviewStatus | "all";
        crop?: string;
        page?: number;
        limit?: number;
        sync?: boolean;
    }): Promise<{
        items: {
            id: string;
            farmerId: string;
            blockId: string | null;
            aiSessionId: string | null;
            fieldFindingId: string | null;
            storagePath: string | null;
            externalUrl: string | null;
            source: string;
            crop: string | null;
            dap: number | null;
            symptoms: string[];
            gpsRegion: string | null;
            aiPrediction: string | null;
            aiConfidence: number | null;
            agronomistLabel: string | null;
            severity: "mild" | "moderate" | "severe" | null;
            reviewStatus: ImageReviewStatus;
            reviewAction: string | null;
            reviewedBy: string | null;
            reviewedAt: string | null;
            reviewNotes: string | null;
            createdAt: string;
            imageUrl: string | null;
            farmer: {
                name: string | null;
                phone: string | null;
                district: string | null;
            } | null;
            block: {
                name: string;
                cropType: string;
            } | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
        pendingCount: number;
    }>;
    getDetail(id: string): Promise<{
        image: {
            id: string;
            farmerId: string;
            blockId: string | null;
            aiSessionId: string | null;
            fieldFindingId: string | null;
            storagePath: string | null;
            externalUrl: string | null;
            source: string;
            crop: string | null;
            dap: number | null;
            symptoms: string[];
            gpsRegion: string | null;
            aiPrediction: string | null;
            aiConfidence: number | null;
            agronomistLabel: string | null;
            severity: "mild" | "moderate" | "severe" | null;
            reviewStatus: ImageReviewStatus;
            reviewAction: string | null;
            reviewedBy: string | null;
            reviewedAt: string | null;
            reviewNotes: string | null;
            createdAt: string;
            imageUrl: string | null;
            farmer: {
                name: string | null;
                phone: string | null;
                district: string | null;
            } | null;
            block: {
                name: string;
                cropType: string;
            } | null;
        };
        weather: Record<string, unknown> | null;
    }>;
    submitReview(id: string, body: {
        action: CropImageReviewAction;
        agronomistLabel?: string;
        severity?: ReviewSeverity;
        reviewNotes?: string;
    }, agentEmail: string): Promise<{
        id: string;
        farmerId: string;
        blockId: string | null;
        aiSessionId: string | null;
        fieldFindingId: string | null;
        storagePath: string | null;
        externalUrl: string | null;
        source: string;
        crop: string | null;
        dap: number | null;
        symptoms: string[];
        gpsRegion: string | null;
        aiPrediction: string | null;
        aiConfidence: number | null;
        agronomistLabel: string | null;
        severity: "mild" | "moderate" | "severe" | null;
        reviewStatus: ImageReviewStatus;
        reviewAction: string | null;
        reviewedBy: string | null;
        reviewedAt: string | null;
        reviewNotes: string | null;
        createdAt: string;
        imageUrl: string | null;
        farmer: {
            name: string | null;
            phone: string | null;
            district: string | null;
        } | null;
        block: {
            name: string;
            cropType: string;
        } | null;
    }>;
};
//# sourceMappingURL=crop-image-review.service.d.ts.map
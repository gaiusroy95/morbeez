import type { AdvisoryLanguage } from '../../ai/types.js';
type BatchSenders = {
    text: (phone: string, text: string) => Promise<void>;
    list?: (params: {
        phone: string;
        header?: string;
        body: string;
        buttonText: string;
        sections: Array<{
            title: string;
            rows: Array<{
                id: string;
                title: string;
                description?: string;
            }>;
        }>;
    }) => Promise<void>;
    buttons?: (params: {
        phone: string;
        body: string;
        buttons: Array<{
            id: string;
            title: string;
        }>;
    }) => Promise<void>;
};
export type BatchedDiagnosisImage = {
    imageBase64: string;
    imageMimeType: string;
    storagePath?: string;
    messageId?: string;
    contentHash: string;
};
export type ImageBatchFlushPayload = {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    isPremium: boolean;
    images: BatchedDiagnosisImage[];
    caption?: string;
    sendText: (phone: string, text: string) => Promise<void>;
    send?: BatchSenders;
};
export declare const WHATSAPP_IMAGE_BATCH_MAX = 4;
export declare function whatsappImageBatchPendingCount(farmerId: string): number;
export declare function cancelImageBatch(farmerId: string): void;
export declare function scheduleImageBatch(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    isPremium: boolean;
    image: BatchedDiagnosisImage;
    caption?: string;
    sendText: (phone: string, text: string) => Promise<void>;
    send?: BatchSenders;
}, onFlush: (batch: ImageBatchFlushPayload) => Promise<void>): void;
export {};
//# sourceMappingURL=whatsapp-image-batch.service.d.ts.map
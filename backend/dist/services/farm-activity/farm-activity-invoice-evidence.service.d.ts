import { type FarmActivityAssistantConfidence, type FarmActivityAssistantExpenseSubEvent, type FarmActivityAssistantPurchaseSubEvent, type FarmActivityAssistantSource, type FarmActivityAssistantSourceMedia, type FarmActivityAssistantUnresolved } from '@morbeez/shared/farm-activity-assistant';
import { openaiStrictJsonSchemaMediaCompletion, type StrictJsonSchema } from '../ai/providers/openai.provider.js';
import type { MediaExtractResult } from '../whatsapp/pipeline/types.js';
export declare const FARM_ACTIVITY_INVOICE_EVIDENCE_SCHEMA: StrictJsonSchema;
export type InvoiceEvidenceMediaKind = 'image' | 'pdf';
export type InvoiceEvidenceMediaInput = {
    kind: InvoiceEvidenceMediaKind;
    buffer: Buffer;
    mimeType: string;
    fileName?: string;
    mediaId?: string;
};
export type InvoiceEvidenceNullableField<T> = {
    value: T | null;
    confidence: FarmActivityAssistantConfidence;
    unresolved: FarmActivityAssistantUnresolved | null;
};
export type InvoiceEvidenceLineItem = {
    description: InvoiceEvidenceNullableField<string>;
    quantity: InvoiceEvidenceNullableField<number>;
    unit: InvoiceEvidenceNullableField<string>;
    unitPrice: InvoiceEvidenceNullableField<number>;
    lineTotal: InvoiceEvidenceNullableField<number>;
};
export type InvoiceEvidenceExtraction = {
    documentKind: 'invoice' | 'receipt' | 'bill' | 'unknown';
    vendorName: InvoiceEvidenceNullableField<string>;
    invoiceDate: InvoiceEvidenceNullableField<string>;
    currency: InvoiceEvidenceNullableField<string>;
    subtotal: InvoiceEvidenceNullableField<number>;
    gstAmount: InvoiceEvidenceNullableField<number>;
    total: InvoiceEvidenceNullableField<number>;
    lineItems: InvoiceEvidenceLineItem[];
    overallConfidence: FarmActivityAssistantConfidence;
    notes: string | null;
    contentHash: string;
    unresolvedFields: Array<{
        field: string;
        reason: FarmActivityAssistantUnresolved['reason'];
        detail: string;
    }>;
};
export type InvoiceDuplicateCandidateRecord = {
    id: string;
    farmerId: string;
    vendorName?: string | null;
    invoiceDate?: string | null;
    totalAmount?: number | null;
    contentHash?: string | null;
};
export type InvoiceDuplicateCandidate = {
    id: string;
    matchReasons: Array<'content_hash' | 'farmer_vendor_date_total'>;
    score: number;
};
export type InvoiceEvidenceDraftBundle = {
    source: FarmActivityAssistantSource;
    purchaseSubEvents: FarmActivityAssistantPurchaseSubEvent[];
    expenseSubEvents: FarmActivityAssistantExpenseSubEvent[];
};
export type InvoiceEvidenceExtractOk = {
    ok: true;
    extraction: InvoiceEvidenceExtraction;
    draftEvidence: InvoiceEvidenceDraftBundle;
    /** Candidates only — never auto-deduped or suppressed. */
    duplicateCandidates: InvoiceDuplicateCandidate[];
};
export type InvoiceEvidenceExtractErr = {
    ok: false;
    code: string;
    message: string;
};
export type InvoiceEvidenceExtractResult = InvoiceEvidenceExtractOk | InvoiceEvidenceExtractErr;
export type InvoiceEvidenceExtractRequest = {
    farmerId: string;
    source: {
        messageId: string;
        channel: FarmActivityAssistantSource['channel'];
        text?: string;
        languageCode?: string;
    };
    media: InvoiceEvidenceMediaInput;
    existingCandidates?: InvoiceDuplicateCandidateRecord[];
};
type ProviderFn = typeof openaiStrictJsonSchemaMediaCompletion;
export declare function classifyInvoiceEvidenceMedia(mimeType: string, fileName?: string): InvoiceEvidenceMediaKind | null;
/** Reuse WhatsApp pipeline document/image buffers without router coupling. */
export declare function mediaFromWhatsAppExtract(media: MediaExtractResult, options?: {
    mediaId?: string;
    fileName?: string;
}): InvoiceEvidenceMediaInput | null;
export declare function hashInvoiceEvidenceContent(buffer: Buffer): string;
/** Flag-only matcher. Never suppresses or merges drafts. */
export declare function findInvoiceDuplicateCandidates(incoming: {
    farmerId: string;
    vendorName: string | null;
    invoiceDate: string | null;
    total: number | null;
    contentHash: string;
}, existing: InvoiceDuplicateCandidateRecord[]): InvoiceDuplicateCandidate[];
export declare function validateInvoiceEvidenceExtraction(value: unknown, contentHash: string): {
    ok: true;
    value: InvoiceEvidenceExtraction;
} | {
    ok: false;
    errors: string[];
};
export declare function buildInvoiceDraftEvidence(params: {
    extraction: InvoiceEvidenceExtraction;
    sourceMeta: InvoiceEvidenceExtractRequest['source'];
    media: FarmActivityAssistantSourceMedia;
}): InvoiceEvidenceDraftBundle;
export declare function extractFarmActivityInvoiceEvidence(input: InvoiceEvidenceExtractRequest, deps?: {
    provider?: ProviderFn;
}): Promise<InvoiceEvidenceExtractResult>;
export declare const farmActivityInvoiceEvidenceService: {
    extract: typeof extractFarmActivityInvoiceEvidence;
    mediaFromWhatsAppExtract: typeof mediaFromWhatsAppExtract;
    findDuplicateCandidates: typeof findInvoiceDuplicateCandidates;
    classifyMedia: typeof classifyInvoiceEvidenceMedia;
    hashContent: typeof hashInvoiceEvidenceContent;
    validateExtraction: typeof validateInvoiceEvidenceExtraction;
    buildDraftEvidence: typeof buildInvoiceDraftEvidence;
};
export {};
//# sourceMappingURL=farm-activity-invoice-evidence.service.d.ts.map
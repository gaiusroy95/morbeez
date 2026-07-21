import { createHash, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { openaiStrictJsonSchemaMediaCompletion, } from '../ai/providers/openai.provider.js';
const SUPPORTED_IMAGE_MIME = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const UNIT_ALIASES = {
    kg: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    g: 'g',
    gram: 'g',
    grams: 'g',
    l: 'litre',
    lt: 'litre',
    litre: 'litre',
    liter: 'litre',
    litres: 'litre',
    liters: 'litre',
    ml: 'ml',
    millilitre: 'ml',
    milliliter: 'ml',
    quintal: 'quintal',
    qtl: 'quintal',
    tonne: 'tonne',
    ton: 'tonne',
    bag: 'bag',
    bags: 'bag',
    piece: 'piece',
    pcs: 'piece',
    pc: 'piece',
    nos: 'piece',
    no: 'piece',
    hour: 'hour',
    hr: 'hour',
    day: 'day',
    acre: 'acre',
};
const text = (maxLength = 2_000) => ({ type: 'string', minLength: 1, maxLength });
const nullableText = (maxLength = 2_000) => ({
    anyOf: [{ type: 'null' }, text(maxLength)],
});
const nullableNumber = {
    anyOf: [{ type: 'null' }, { type: 'number' }],
};
const object = (properties, required = Object.keys(properties)) => ({
    type: 'object',
    additionalProperties: false,
    properties,
    required,
});
const enumString = (values) => ({ type: 'string', enum: [...values] });
const confidenceEnum = enumString(['low', 'medium', 'high']);
const unresolvedReasonEnum = enumString(['missing', 'ambiguous', 'conflicting', 'unsupported']);
const nullableField = object({
    value: nullableText(500),
    confidence: confidenceEnum,
    unresolved: {
        anyOf: [
            { type: 'null' },
            object({
                reason: unresolvedReasonEnum,
                detail: text(500),
            }),
        ],
    },
});
const nullableMoneyField = object({
    value: nullableNumber,
    confidence: confidenceEnum,
    unresolved: {
        anyOf: [
            { type: 'null' },
            object({
                reason: unresolvedReasonEnum,
                detail: text(500),
            }),
        ],
    },
});
const lineItemSchema = object({
    description: nullableField,
    quantity: nullableMoneyField,
    unit: nullableField,
    unitPrice: nullableMoneyField,
    lineTotal: nullableMoneyField,
});
export const FARM_ACTIVITY_INVOICE_EVIDENCE_SCHEMA = object({
    documentKind: enumString(['invoice', 'receipt', 'bill', 'unknown']),
    vendorName: nullableField,
    invoiceDate: nullableField,
    currency: nullableField,
    subtotal: nullableMoneyField,
    gstAmount: nullableMoneyField,
    total: nullableMoneyField,
    lineItems: { type: 'array', maxItems: 40, items: lineItemSchema },
    overallConfidence: confidenceEnum,
    notes: nullableText(1_000),
});
function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function normalizeMime(mimeType) {
    return mimeType.trim().toLowerCase().split(';')[0] ?? '';
}
export function classifyInvoiceEvidenceMedia(mimeType, fileName) {
    const mime = normalizeMime(mimeType);
    const name = fileName?.trim().toLowerCase() ?? '';
    if (mime === 'application/pdf' || mime.includes('pdf') || name.endsWith('.pdf'))
        return 'pdf';
    if (SUPPORTED_IMAGE_MIME.has(mime) || mime.startsWith('image/'))
        return 'image';
    return null;
}
/** Reuse WhatsApp pipeline document/image buffers without router coupling. */
export function mediaFromWhatsAppExtract(media, options) {
    if (media.documentBase64 && media.documentMimeType) {
        const kind = classifyInvoiceEvidenceMedia(media.documentMimeType, options?.fileName);
        if (kind !== 'pdf')
            return null;
        return {
            kind: 'pdf',
            buffer: Buffer.from(media.documentBase64, 'base64'),
            mimeType: 'application/pdf',
            fileName: options?.fileName,
            mediaId: options?.mediaId,
        };
    }
    if (media.imageBase64 && media.imageMimeType) {
        const kind = classifyInvoiceEvidenceMedia(media.imageMimeType, options?.fileName);
        if (kind !== 'image')
            return null;
        return {
            kind: 'image',
            buffer: Buffer.from(media.imageBase64, 'base64'),
            mimeType: normalizeMime(media.imageMimeType),
            fileName: options?.fileName,
            mediaId: options?.mediaId,
        };
    }
    return null;
}
export function hashInvoiceEvidenceContent(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}
function normalizeVendor(value) {
    const trimmed = value?.trim().toLowerCase().replace(/\s+/g, ' ');
    return trimmed || null;
}
function amountsClose(a, b) {
    return Math.abs(a - b) <= 0.05;
}
/** Flag-only matcher. Never suppresses or merges drafts. */
export function findInvoiceDuplicateCandidates(incoming, existing) {
    const vendor = normalizeVendor(incoming.vendorName);
    const out = [];
    for (const row of existing) {
        if (row.farmerId !== incoming.farmerId)
            continue;
        const reasons = [];
        if (row.contentHash && row.contentHash === incoming.contentHash) {
            reasons.push('content_hash');
        }
        const sameVendor = Boolean(vendor && normalizeVendor(row.vendorName) === vendor);
        const sameDate = Boolean(incoming.invoiceDate
            && row.invoiceDate
            && incoming.invoiceDate === row.invoiceDate);
        const sameTotal = incoming.total != null
            && row.totalAmount != null
            && amountsClose(incoming.total, Number(row.totalAmount));
        if (sameVendor && sameDate && sameTotal) {
            reasons.push('farmer_vendor_date_total');
        }
        if (!reasons.length)
            continue;
        out.push({
            id: row.id,
            matchReasons: reasons,
            score: reasons.includes('content_hash') ? 1 : 0.85,
        });
    }
    return out.sort((a, b) => b.score - a.score);
}
function asNullableField(value, fieldName, errors) {
    if (!isRecord(value)) {
        errors.push(`${fieldName} must be an object`);
        return null;
    }
    const confidence = value.confidence;
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
        errors.push(`${fieldName}.confidence invalid`);
        return null;
    }
    const raw = value.value;
    if (raw !== null && typeof raw !== 'string') {
        errors.push(`${fieldName}.value must be string or null`);
        return null;
    }
    const unresolved = value.unresolved;
    if (raw == null) {
        if (!isRecord(unresolved)
            || (unresolved.reason !== 'missing'
                && unresolved.reason !== 'ambiguous'
                && unresolved.reason !== 'conflicting'
                && unresolved.reason !== 'unsupported')
            || typeof unresolved.detail !== 'string'
            || !unresolved.detail.trim()) {
            errors.push(`${fieldName} null value requires unresolved reason/detail`);
            return null;
        }
        return {
            value: null,
            confidence: 'low',
            unresolved: {
                reason: unresolved.reason,
                detail: unresolved.detail.trim().slice(0, 500),
            },
        };
    }
    if (unresolved !== null) {
        errors.push(`${fieldName} resolved value must set unresolved=null`);
        return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        errors.push(`${fieldName}.value empty`);
        return null;
    }
    return { value: trimmed.slice(0, 500), confidence, unresolved: null };
}
function asNullableNumberField(value, fieldName, errors) {
    if (!isRecord(value)) {
        errors.push(`${fieldName} must be an object`);
        return null;
    }
    const confidence = value.confidence;
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
        errors.push(`${fieldName}.confidence invalid`);
        return null;
    }
    const raw = value.value;
    if (raw !== null && typeof raw !== 'number') {
        errors.push(`${fieldName}.value must be number or null`);
        return null;
    }
    if (typeof raw === 'number' && (!Number.isFinite(raw) || raw < 0)) {
        errors.push(`${fieldName}.value must be a finite non-negative number`);
        return null;
    }
    const unresolved = value.unresolved;
    if (raw == null) {
        if (!isRecord(unresolved)
            || (unresolved.reason !== 'missing'
                && unresolved.reason !== 'ambiguous'
                && unresolved.reason !== 'conflicting'
                && unresolved.reason !== 'unsupported')
            || typeof unresolved.detail !== 'string'
            || !unresolved.detail.trim()) {
            errors.push(`${fieldName} null value requires unresolved reason/detail`);
            return null;
        }
        return {
            value: null,
            confidence: 'low',
            unresolved: {
                reason: unresolved.reason,
                detail: unresolved.detail.trim().slice(0, 500),
            },
        };
    }
    if (unresolved !== null) {
        errors.push(`${fieldName} resolved value must set unresolved=null`);
        return null;
    }
    return { value: raw, confidence, unresolved: null };
}
function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}
export function validateInvoiceEvidenceExtraction(value, contentHash) {
    if (!isRecord(value))
        return { ok: false, errors: ['response must be an object'] };
    const errors = [];
    const documentKind = value.documentKind;
    if (documentKind !== 'invoice'
        && documentKind !== 'receipt'
        && documentKind !== 'bill'
        && documentKind !== 'unknown') {
        errors.push('documentKind invalid');
    }
    const overallConfidence = value.overallConfidence;
    if (overallConfidence !== 'low' && overallConfidence !== 'medium' && overallConfidence !== 'high') {
        errors.push('overallConfidence invalid');
    }
    if (!Array.isArray(value.lineItems))
        errors.push('lineItems must be an array');
    const vendorName = asNullableField(value.vendorName, 'vendorName', errors);
    const invoiceDate = asNullableField(value.invoiceDate, 'invoiceDate', errors);
    const currency = asNullableField(value.currency, 'currency', errors);
    const subtotal = asNullableNumberField(value.subtotal, 'subtotal', errors);
    const gstAmount = asNullableNumberField(value.gstAmount, 'gstAmount', errors);
    const total = asNullableNumberField(value.total, 'total', errors);
    if (invoiceDate?.value && !isIsoDate(invoiceDate.value)) {
        errors.push('invoiceDate must be YYYY-MM-DD when present');
    }
    const lineItems = [];
    if (Array.isArray(value.lineItems)) {
        for (const [index, item] of value.lineItems.entries()) {
            if (!isRecord(item)) {
                errors.push(`lineItems[${index}] invalid`);
                continue;
            }
            const description = asNullableField(item.description, `lineItems[${index}].description`, errors);
            const quantity = asNullableNumberField(item.quantity, `lineItems[${index}].quantity`, errors);
            const unit = asNullableField(item.unit, `lineItems[${index}].unit`, errors);
            const unitPrice = asNullableNumberField(item.unitPrice, `lineItems[${index}].unitPrice`, errors);
            const lineTotal = asNullableNumberField(item.lineTotal, `lineItems[${index}].lineTotal`, errors);
            if (description && quantity && unit && unitPrice && lineTotal) {
                lineItems.push({ description, quantity, unit, unitPrice, lineTotal });
            }
        }
    }
    if (errors.length)
        return { ok: false, errors };
    const unresolvedFields = [];
    const collect = (field, extracted) => {
        if (extracted?.value == null && extracted?.unresolved) {
            unresolvedFields.push({
                field,
                reason: extracted.unresolved.reason,
                detail: extracted.unresolved.detail,
            });
        }
    };
    collect('vendorName', vendorName);
    collect('invoiceDate', invoiceDate);
    collect('currency', currency);
    collect('subtotal', subtotal);
    collect('gstAmount', gstAmount);
    collect('total', total);
    lineItems.forEach((item, index) => {
        collect(`lineItems[${index}].description`, item.description);
        collect(`lineItems[${index}].quantity`, item.quantity);
        collect(`lineItems[${index}].unit`, item.unit);
        collect(`lineItems[${index}].unitPrice`, item.unitPrice);
        collect(`lineItems[${index}].lineTotal`, item.lineTotal);
    });
    return {
        ok: true,
        value: {
            documentKind: documentKind,
            vendorName: vendorName,
            invoiceDate: invoiceDate,
            currency: currency,
            subtotal: subtotal,
            gstAmount: gstAmount,
            total: total,
            lineItems,
            overallConfidence: overallConfidence,
            notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 1_000) : null,
            contentHash,
            unresolvedFields,
        },
    };
}
function mapUnit(raw) {
    if (!raw)
        return null;
    const key = raw.trim().toLowerCase();
    return UNIT_ALIASES[key] ?? 'other';
}
function toContractField(extracted, sourceRefs, provenance = ['source_media']) {
    if (extracted.value == null) {
        return {
            value: null,
            confidence: 'low',
            provenance,
            sourceRefs,
            unresolved: extracted.unresolved ?? { reason: 'missing', detail: 'Not visible on invoice' },
        };
    }
    return {
        value: extracted.value,
        confidence: extracted.confidence,
        provenance,
        sourceRefs,
    };
}
function moneyField(amount, confidence, sourceRefs, unresolved) {
    if (amount == null) {
        return {
            value: null,
            confidence: 'low',
            provenance: ['source_media'],
            sourceRefs,
            unresolved: unresolved ?? { reason: 'missing', detail: 'Amount not visible on invoice' },
        };
    }
    return {
        value: { amount, currency: 'INR' },
        confidence,
        provenance: ['source_media'],
        sourceRefs,
    };
}
export function buildInvoiceDraftEvidence(params) {
    const sourceRefs = [params.sourceMeta.messageId, params.media.id];
    const source = {
        messageId: params.sourceMeta.messageId,
        channel: params.sourceMeta.channel,
        text: params.sourceMeta.text,
        language: {
            code: params.sourceMeta.languageCode?.trim() || 'en',
            detected: Boolean(params.sourceMeta.languageCode?.trim()),
            confidence: params.sourceMeta.languageCode?.trim() ? 'medium' : 'low',
        },
        media: [params.media],
        transcript: [],
    };
    const currency = params.extraction.currency.value?.toUpperCase() ?? null;
    const currencySupported = !currency || currency === 'INR' || currency === 'RS' || currency === '₹';
    const purchaseSubEvents = [];
    const expenseSubEvents = [];
    let sequence = 1;
    if (!currencySupported) {
        return { source, purchaseSubEvents, expenseSubEvents };
    }
    const occurredOn = toContractField(params.extraction.invoiceDate, sourceRefs);
    const vendorName = toContractField(params.extraction.vendorName, sourceRefs);
    if (params.extraction.lineItems.length) {
        for (const item of params.extraction.lineItems) {
            const unitMapped = mapUnit(item.unit.value);
            purchaseSubEvents.push({
                id: randomUUID(),
                kind: 'purchase',
                sequence: sequence++,
                sourceRefs,
                occurredOn,
                itemName: toContractField(item.description, sourceRefs),
                vendorName,
                quantity: toContractField(item.quantity, sourceRefs),
                unit: unitMapped == null
                    ? {
                        value: null,
                        confidence: 'low',
                        provenance: ['source_media'],
                        sourceRefs,
                        unresolved: item.unit.unresolved ?? {
                            reason: 'missing',
                            detail: 'Unit not visible on invoice line',
                        },
                    }
                    : {
                        value: unitMapped,
                        confidence: item.unit.confidence,
                        provenance: ['source_media'],
                        sourceRefs,
                    },
                unitPrice: moneyField(item.unitPrice.value, item.unitPrice.confidence, sourceRefs, item.unitPrice.unresolved ?? undefined),
                totalCost: moneyField(item.lineTotal.value, item.lineTotal.confidence, sourceRefs, item.lineTotal.unresolved ?? undefined),
            });
        }
    }
    else if (params.extraction.total.value != null || params.extraction.vendorName.value) {
        purchaseSubEvents.push({
            id: randomUUID(),
            kind: 'purchase',
            sequence: sequence++,
            sourceRefs,
            occurredOn,
            itemName: {
                value: null,
                confidence: 'low',
                provenance: ['source_media'],
                sourceRefs,
                unresolved: { reason: 'missing', detail: 'No line-item description on invoice' },
            },
            vendorName,
            quantity: {
                value: null,
                confidence: 'low',
                provenance: ['source_media'],
                sourceRefs,
                unresolved: { reason: 'missing', detail: 'No line-item quantity on invoice' },
            },
            unit: {
                value: null,
                confidence: 'low',
                provenance: ['source_media'],
                sourceRefs,
                unresolved: { reason: 'missing', detail: 'No line-item unit on invoice' },
            },
            unitPrice: moneyField(null, 'low', sourceRefs, {
                reason: 'missing',
                detail: 'No line-item unit price on invoice',
            }),
            totalCost: moneyField(params.extraction.total.value, params.extraction.total.confidence, sourceRefs, params.extraction.total.unresolved ?? undefined),
        });
    }
    if (params.extraction.gstAmount.value != null && params.extraction.gstAmount.value > 0) {
        expenseSubEvents.push({
            id: randomUUID(),
            kind: 'expense',
            sequence: sequence++,
            sourceRefs,
            occurredOn,
            category: {
                value: 'gst',
                confidence: params.extraction.gstAmount.confidence,
                provenance: ['source_media'],
                sourceRefs,
            },
            description: {
                value: 'GST / tax on invoice',
                confidence: params.extraction.gstAmount.confidence,
                provenance: ['source_media'],
                sourceRefs,
            },
            amount: moneyField(params.extraction.gstAmount.value, params.extraction.gstAmount.confidence, sourceRefs),
            paidTo: vendorName,
        });
    }
    return { source, purchaseSubEvents, expenseSubEvents };
}
function fail(code, message) {
    return { ok: false, code, message };
}
export async function extractFarmActivityInvoiceEvidence(input, deps) {
    if (!env.ENABLE_FARM_ACTIVITY_INVOICE_OCR) {
        return fail('INVOICE_OCR_DISABLED', 'Farm activity invoice OCR is disabled');
    }
    if (!env.OPENAI_API_KEY?.trim() && !deps?.provider) {
        return fail('OPENAI_NOT_CONFIGURED', 'OpenAI is not configured for invoice OCR');
    }
    const kind = classifyInvoiceEvidenceMedia(input.media.mimeType, input.media.fileName);
    if (!kind) {
        return fail('UNSUPPORTED_MEDIA', 'Only invoice images and PDFs are supported');
    }
    if (kind !== input.media.kind) {
        return fail('MEDIA_KIND_MISMATCH', 'Declared media kind does not match mime/file type');
    }
    if (!input.media.buffer?.length) {
        return fail('EMPTY_MEDIA', 'Invoice media buffer is empty');
    }
    if (kind === 'pdf' && normalizeMime(input.media.mimeType) !== 'application/pdf'
        && !normalizeMime(input.media.mimeType).includes('pdf')
        && !(input.media.fileName?.toLowerCase().endsWith('.pdf'))) {
        return fail('UNSUPPORTED_PDF', 'PDF mime/filename required for PDF extraction');
    }
    if (kind === 'image' && !normalizeMime(input.media.mimeType).startsWith('image/')) {
        return fail('UNSUPPORTED_IMAGE', 'Image mime required for image extraction');
    }
    const contentHash = hashInvoiceEvidenceContent(input.media.buffer);
    const mediaId = input.media.mediaId?.trim() || `media:${contentHash.slice(0, 16)}`;
    const mimeType = kind === 'pdf' ? 'application/pdf' : normalizeMime(input.media.mimeType);
    const mediaBase64 = input.media.buffer.toString('base64');
    const provider = deps?.provider ?? openaiStrictJsonSchemaMediaCompletion;
    const systemPrompt = [
        'Extract purchase invoice/receipt evidence for the farm activity assistant.',
        'Use only values visible on the attached image or PDF. Never invent vendor, date, amounts, or line items.',
        'Dates must be YYYY-MM-DD when present. Prefer INR. Mark uncertain values null with unresolved reason/detail.',
        'Populate overallConfidence from readability. documentKind=unknown when the attachment is not a purchase document.',
    ].join(' ');
    const userPrompt = JSON.stringify({
        farmerId: input.farmerId,
        messageId: input.source.messageId,
        channel: input.source.channel,
        caption: input.source.text ?? null,
        mediaKind: kind,
        mimeType,
        fileName: input.media.fileName ?? null,
        contentHash,
    });
    let extraction;
    try {
        extraction = await provider({
            schemaName: 'farm_activity_invoice_evidence_v1',
            schema: FARM_ACTIVITY_INVOICE_EVIDENCE_SCHEMA,
            systemPrompt,
            userPrompt,
            mediaBase64,
            mimeType,
            fileName: input.media.fileName,
            maxTokens: 3_200,
            validate: (candidate) => validateInvoiceEvidenceExtraction(candidate, contentHash),
        });
    }
    catch (error) {
        logger.warn({ err: error, farmerId: input.farmerId, mediaKind: kind }, 'Farm activity invoice OCR failed closed');
        if (error instanceof AppError) {
            return fail(error.code, error.message);
        }
        return fail('INVOICE_OCR_FAILED', 'Invoice evidence extraction failed');
    }
    if (extraction.documentKind === 'unknown') {
        return fail('NOT_INVOICE_EVIDENCE', 'Attachment is not recognizable invoice/receipt evidence');
    }
    const currency = extraction.currency.value?.toUpperCase() ?? null;
    if (currency && currency !== 'INR' && currency !== 'RS' && currency !== '₹') {
        return fail('UNSUPPORTED_CURRENCY', `Unsupported invoice currency: ${currency}`);
    }
    const mediaRef = {
        id: mediaId,
        kind: kind === 'pdf' ? 'document' : 'image',
        mimeType,
        fileName: input.media.fileName,
    };
    const draftEvidence = buildInvoiceDraftEvidence({
        extraction,
        sourceMeta: input.source,
        media: mediaRef,
    });
    if (!draftEvidence.purchaseSubEvents.length && !draftEvidence.expenseSubEvents.length) {
        return fail('INSUFFICIENT_EVIDENCE', 'Invoice OCR produced no purchase/expense draft evidence');
    }
    const duplicateCandidates = findInvoiceDuplicateCandidates({
        farmerId: input.farmerId,
        vendorName: extraction.vendorName.value,
        invoiceDate: extraction.invoiceDate.value,
        total: extraction.total.value,
        contentHash,
    }, input.existingCandidates ?? []);
    return {
        ok: true,
        extraction,
        draftEvidence,
        duplicateCandidates,
    };
}
export const farmActivityInvoiceEvidenceService = {
    extract: extractFarmActivityInvoiceEvidence,
    mediaFromWhatsAppExtract,
    findDuplicateCandidates: findInvoiceDuplicateCandidates,
    classifyMedia: classifyInvoiceEvidenceMedia,
    hashContent: hashInvoiceEvidenceContent,
    validateExtraction: validateInvoiceEvidenceExtraction,
    buildDraftEvidence: buildInvoiceDraftEvidence,
};
//# sourceMappingURL=farm-activity-invoice-evidence.service.js.map
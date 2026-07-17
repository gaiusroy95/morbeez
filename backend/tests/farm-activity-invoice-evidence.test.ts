import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it, type TestContext } from 'node:test';
import { env } from '../src/config/env.js';
import {
  buildInvoiceDraftEvidence,
  extractFarmActivityInvoiceEvidence,
  findInvoiceDuplicateCandidates,
  mediaFromWhatsAppExtract,
  validateInvoiceEvidenceExtraction,
} from '../src/services/farm-activity/farm-activity-invoice-evidence.service.js';

function setEnv(t: TestContext, values: Record<string, unknown>): void {
  const mutableEnv = env as unknown as Record<string, unknown>;
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, mutableEnv[key]])
  );
  Object.assign(mutableEnv, values);
  t.after(() => Object.assign(mutableEnv, previous));
}

function field<T>(value: T, confidence: 'low' | 'medium' | 'high' = 'high') {
  return { value, confidence, unresolved: null as null };
}

function missing(detail: string) {
  return {
    value: null,
    confidence: 'low' as const,
    unresolved: { reason: 'missing' as const, detail },
  };
}

function sampleProviderPayload(overrides: Record<string, unknown> = {}) {
  return {
    documentKind: 'invoice',
    vendorName: field('Agri Mart'),
    invoiceDate: field('2026-07-10'),
    currency: field('INR'),
    subtotal: field(900),
    gstAmount: field(162),
    total: field(1062),
    lineItems: [
      {
        description: field('Urea'),
        quantity: field(2),
        unit: field('bag'),
        unitPrice: field(450),
        lineTotal: field(900),
      },
    ],
    overallConfidence: 'high',
    notes: null,
    ...overrides,
  };
}

describe('farm activity invoice evidence extraction', () => {
  it('fails closed when OCR flag is off', async (t) => {
    setEnv(t, { ENABLE_FARM_ACTIVITY_INVOICE_OCR: false });
    const result = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-1',
      source: { messageId: 'msg-1', channel: 'whatsapp' },
      media: {
        kind: 'image',
        buffer: Buffer.from('invoice-bytes'),
        mimeType: 'image/jpeg',
      },
    }, {
      provider: async () => {
        throw new Error('provider should not be called');
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INVOICE_OCR_DISABLED');
  });

  it('rejects non image/PDF media and empty buffers', async (t) => {
    setEnv(t, { ENABLE_FARM_ACTIVITY_INVOICE_OCR: true });
    const unsupported = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-1',
      source: { messageId: 'msg-1', channel: 'whatsapp' },
      media: {
        kind: 'image',
        buffer: Buffer.from('x'),
        mimeType: 'application/msword',
      },
    });
    assert.equal(unsupported.ok, false);
    if (!unsupported.ok) assert.equal(unsupported.code, 'UNSUPPORTED_MEDIA');

    const empty = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-1',
      source: { messageId: 'msg-1', channel: 'whatsapp' },
      media: {
        kind: 'pdf',
        buffer: Buffer.alloc(0),
        mimeType: 'application/pdf',
        fileName: 'bill.pdf',
      },
    });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.code, 'EMPTY_MEDIA');
  });

  it('extracts purchase/expense draft evidence from mocked PDF provider', async (t) => {
    setEnv(t, { ENABLE_FARM_ACTIVITY_INVOICE_OCR: true });
    const buffer = Buffer.from('%PDF-invoice-1');
    let sawPdf = false;

    const result = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-1',
      source: { messageId: 'msg-pdf', channel: 'whatsapp', text: 'bill' },
      media: {
        kind: 'pdf',
        buffer,
        mimeType: 'application/pdf',
        fileName: 'purchase.pdf',
        mediaId: 'doc-1',
      },
      existingCandidates: [{
        id: 'prior-1',
        farmerId: 'farmer-1',
        vendorName: 'Agri Mart',
        invoiceDate: '2026-07-10',
        totalAmount: 1062,
        contentHash: 'different',
      }],
    }, {
      provider: async (input) => {
        sawPdf = input.mimeType === 'application/pdf';
        assert.equal(input.schemaName, 'farm_activity_invoice_evidence_v1');
        const validated = input.validate(sampleProviderPayload());
        assert.equal(validated.ok, true);
        if (!validated.ok) throw new Error(validated.errors.join('; '));
        return validated.value;
      },
    });

    assert.equal(sawPdf, true);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.extraction.vendorName.value, 'Agri Mart');
    assert.equal(result.extraction.gstAmount.value, 162);
    assert.equal(result.draftEvidence.purchaseSubEvents.length, 1);
    assert.equal(result.draftEvidence.expenseSubEvents.length, 1);
    assert.equal(result.draftEvidence.purchaseSubEvents[0]?.kind, 'purchase');
    assert.equal(result.draftEvidence.purchaseSubEvents[0]?.itemName.value, 'Urea');
    assert.equal(result.draftEvidence.expenseSubEvents[0]?.category.value, 'gst');
    assert.equal(result.duplicateCandidates.length, 1);
    assert.deepEqual(result.duplicateCandidates[0]?.matchReasons, ['farmer_vendor_date_total']);
  });

  it('handles WhatsApp image buffers and flags content-hash duplicates only', async (t) => {
    setEnv(t, { ENABLE_FARM_ACTIVITY_INVOICE_OCR: true });
    const buffer = Buffer.from('jpeg-invoice-bytes');
    const media = mediaFromWhatsAppExtract({
      imageBase64: buffer.toString('base64'),
      imageMimeType: 'image/jpeg',
    }, { mediaId: 'img-1' });
    assert.ok(media);
    assert.equal(media?.kind, 'image');

    const result = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-2',
      source: { messageId: 'msg-img', channel: 'whatsapp' },
      media: media!,
      existingCandidates: [{
        id: 'same-bytes',
        farmerId: 'farmer-2',
        vendorName: 'Other',
        invoiceDate: '2020-01-01',
        totalAmount: 1,
        contentHash: createHash('sha256').update(buffer).digest('hex'),
      }],
    }, {
      provider: async (input) => {
        assert.match(input.mimeType, /^image\//);
        const validated = input.validate(sampleProviderPayload({
          gstAmount: missing('GST not printed'),
          lineItems: [],
          total: field(500),
        }));
        assert.equal(validated.ok, true);
        if (!validated.ok) throw new Error(validated.errors.join('; '));
        return validated.value;
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draftEvidence.purchaseSubEvents.length, 1);
    assert.equal(result.draftEvidence.expenseSubEvents.length, 0);
    assert.equal(result.duplicateCandidates[0]?.id, 'same-bytes');
    assert.deepEqual(result.duplicateCandidates[0]?.matchReasons, ['content_hash']);
  });

  it('fails closed for unknown documents and unsupported currency', async (t) => {
    setEnv(t, { ENABLE_FARM_ACTIVITY_INVOICE_OCR: true });

    const unknown = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-1',
      source: { messageId: 'msg-1', channel: 'app' },
      media: { kind: 'image', buffer: Buffer.from('x'), mimeType: 'image/png' },
    }, {
      provider: async (input) => {
        const validated = input.validate(sampleProviderPayload({ documentKind: 'unknown' }));
        assert.equal(validated.ok, true);
        if (!validated.ok) throw new Error(validated.errors.join('; '));
        return validated.value;
      },
    });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.code, 'NOT_INVOICE_EVIDENCE');

    const currency = await extractFarmActivityInvoiceEvidence({
      farmerId: 'farmer-1',
      source: { messageId: 'msg-2', channel: 'app' },
      media: { kind: 'image', buffer: Buffer.from('y'), mimeType: 'image/png' },
    }, {
      provider: async (input) => {
        const validated = input.validate(sampleProviderPayload({ currency: field('USD') }));
        assert.equal(validated.ok, true);
        if (!validated.ok) throw new Error(validated.errors.join('; '));
        return validated.value;
      },
    });
    assert.equal(currency.ok, false);
    if (!currency.ok) assert.equal(currency.code, 'UNSUPPORTED_CURRENCY');
  });

  it('validates unresolved fields and builds contract-compatible drafts', () => {
    const validated = validateInvoiceEvidenceExtraction(sampleProviderPayload({
      vendorName: missing('Vendor logo unreadable'),
      gstAmount: missing('Tax line blurred'),
    }), 'hash-1');
    assert.equal(validated.ok, true);
    if (!validated.ok) return;

    assert.ok(validated.value.unresolvedFields.some((item) => item.field === 'vendorName'));
    const draft = buildInvoiceDraftEvidence({
      extraction: validated.value,
      sourceMeta: { messageId: 'm1', channel: 'api' },
      media: { id: 'media-1', kind: 'image', mimeType: 'image/jpeg' },
    });
    assert.equal(draft.purchaseSubEvents[0]?.vendorName.value, null);
    assert.equal(draft.purchaseSubEvents[0]?.vendorName.unresolved?.reason, 'missing');
    assert.equal(draft.source.media[0]?.id, 'media-1');
  });

  it('flags duplicate candidates without merging them', () => {
    const matches = findInvoiceDuplicateCandidates({
      farmerId: 'farmer-9',
      vendorName: 'Agri Mart',
      invoiceDate: '2026-07-10',
      total: 100,
      contentHash: 'abc',
    }, [
      {
        id: 'a',
        farmerId: 'farmer-9',
        vendorName: 'agri   mart',
        invoiceDate: '2026-07-10',
        totalAmount: 100.01,
        contentHash: 'zzz',
      },
      {
        id: 'b',
        farmerId: 'other',
        vendorName: 'Agri Mart',
        invoiceDate: '2026-07-10',
        totalAmount: 100,
        contentHash: 'abc',
      },
      {
        id: 'c',
        farmerId: 'farmer-9',
        contentHash: 'abc',
      },
    ]);

    assert.deepEqual(matches.map((item) => item.id).sort(), ['a', 'c']);
    assert.ok(matches.every((item) => item.matchReasons.length > 0));
  });
});

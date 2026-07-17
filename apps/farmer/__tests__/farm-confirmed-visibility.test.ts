import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  farmConfirmedBadgeLabel,
  farmConfirmedHasCorrectionPath,
  farmConfirmedProvenanceSummary,
  resolveFarmConfirmedVisibility,
} from '../../../packages/shared/src/farm-activity-assistant/visibility.ts';
import { defaultFarmConfirmedSupportMessage } from '../lib/farm-confirmed-support.ts';

describe('farm confirmed visibility (farmer app)', () => {
  it('returns no-op for legacy rows without provenance', () => {
    const visibility = resolveFarmConfirmedVisibility({});
    assert.equal(visibility.isWhatsAppConfirmed, false);
    assert.equal(visibility.badge, null);
    assert.equal(farmConfirmedBadgeLabel(visibility.badge), null);
    assert.equal(farmConfirmedProvenanceSummary(visibility), null);
    assert.equal(farmConfirmedHasCorrectionPath(visibility), false);
  });

  it('shows WhatsApp voice badge with confirmation and linked ROI', () => {
    const visibility = resolveFarmConfirmedVisibility({
      provenance: {
        sourceChannel: 'whatsapp',
        inputModality: 'voice',
        confirmedAt: '2026-07-17T10:00:00.000Z',
        confirmedAtLabel: '17 Jul 2026',
        linkedRoiEntryId: 'roi-1',
        linkedRoiLabel: 'Labour ₹500',
      },
    });
    assert.equal(visibility.isWhatsAppConfirmed, true);
    assert.equal(visibility.badge, 'whatsapp_voice');
    assert.equal(farmConfirmedBadgeLabel(visibility.badge), 'WhatsApp · Voice');
    assert.equal(visibility.confirmedAtLabel, '17 Jul 2026');
    assert.equal(
      farmConfirmedProvenanceSummary(visibility),
      'Confirmed 17 Jul 2026 · ROI: Labour ₹500'
    );
  });

  it('prefers correction/undo URLs when API fields exist', () => {
    const correct = resolveFarmConfirmedVisibility({
      provenance: {
        sourceChannel: 'whatsapp',
        canCorrect: true,
        correctionUrl: 'https://example.com/correct/1',
      },
    });
    assert.deepEqual(correct.correctionPath, {
      kind: 'correct',
      url: 'https://example.com/correct/1',
    });

    const undo = resolveFarmConfirmedVisibility({
      sourceChannel: 'whatsapp',
      canUndo: true,
      undoUrl: 'https://example.com/undo/2',
    });
    assert.deepEqual(undo.correctionPath, {
      kind: 'undo',
      url: 'https://example.com/undo/2',
    });
  });

  it('builds a default WhatsApp support correction message', () => {
    assert.match(
      defaultFarmConfirmedSupportMessage({
        kind: 'roi',
        id: 'tx-1',
        label: 'Labour',
      }),
      /ROI entry/
    );
  });
});

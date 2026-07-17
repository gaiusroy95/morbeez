import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  farmConfirmedBadgeLabel,
  farmConfirmedHasCorrectionPath,
  farmConfirmedProvenanceSummary,
  resolveFarmConfirmedVisibility,
} from '../src/farm-activity-assistant/visibility.js';

describe('farm confirmed visibility helpers', () => {
  it('ignores legacy records without provenance', () => {
    const visibility = resolveFarmConfirmedVisibility({});
    assert.equal(visibility.isWhatsAppConfirmed, false);
    assert.equal(visibility.badge, null);
    assert.equal(farmConfirmedBadgeLabel(visibility.badge), null);
    assert.equal(farmConfirmedProvenanceSummary(visibility), null);
    assert.equal(farmConfirmedHasCorrectionPath(visibility), false);
  });

  it('resolves WhatsApp voice badge and linked ROI summary', () => {
    const visibility = resolveFarmConfirmedVisibility({
      provenance: {
        sourceChannel: 'whatsapp',
        inputModality: 'voice',
        confirmedAtLabel: '17 Jul 2026',
        linkedRoiLabel: 'Labour ₹500',
      },
    });
    assert.equal(visibility.isWhatsAppConfirmed, true);
    assert.equal(visibility.badge, 'whatsapp_voice');
    assert.equal(farmConfirmedBadgeLabel(visibility.badge), 'WhatsApp · Voice');
    assert.equal(
      farmConfirmedProvenanceSummary(visibility),
      'Confirmed 17 Jul 2026 · ROI: Labour ₹500'
    );
  });

  it('uses correction URL when canCorrect is true', () => {
    const visibility = resolveFarmConfirmedVisibility({
      sourceChannel: 'whatsapp',
      canCorrect: true,
      correctionUrl: 'https://example.com/correct/1',
    });
    assert.deepEqual(visibility.correctionPath, {
      kind: 'correct',
      url: 'https://example.com/correct/1',
    });
  });
});

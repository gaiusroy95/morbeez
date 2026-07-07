import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function buildScreeningPrefetchKey(screening: {
  farmerId: string;
  blockId: string;
  sessionId?: string | null;
  fieldVoiceNote?: string;
  blockAssessment?: unknown;
  measurements: Record<string, string>;
  gpsLat?: number | null;
  gpsLon?: number | null;
  visitPhotos: Array<{ photoType?: string; dataBase64: string }>;
}): string {
  return JSON.stringify({
    farmerId: screening.farmerId,
    blockId: screening.blockId,
    sessionId: screening.sessionId ?? null,
    fieldVoiceNote: screening.fieldVoiceNote ?? '',
    blockAssessment: screening.blockAssessment,
    measurements: screening.measurements,
    gpsLat: screening.gpsLat ?? null,
    gpsLon: screening.gpsLon ?? null,
    photos: screening.visitPhotos.map((p) => `${p.photoType ?? ''}:${p.dataBase64.length}`),
  });
}

describe('visitScreening prefetch key', () => {
  it('changes when measurements or photo payload changes', () => {
    const base = {
      farmerId: 'f1',
      blockId: 'b1',
      sessionId: 's1',
      fieldVoiceNote: 'note',
      blockAssessment: {
        blockHealth: 'good' as const,
        cropPerformance: 'average' as const,
        soilMoisture: 'adequate' as const,
      },
      measurements: { incidence: '10' },
      visitPhotos: [{ dataBase64: 'abc', mimeType: 'image/jpeg', photoType: 'leaf' }],
    };

    const keyA = buildScreeningPrefetchKey(base);
    const keyB = buildScreeningPrefetchKey({
      ...base,
      measurements: { incidence: '20' },
    });
    const keyC = buildScreeningPrefetchKey({
      ...base,
      visitPhotos: [{ dataBase64: 'abcd', mimeType: 'image/jpeg', photoType: 'leaf' }],
    });

    assert.notEqual(keyA, keyB);
    assert.notEqual(keyA, keyC);
    assert.equal(keyA, buildScreeningPrefetchKey(base));
  });
});

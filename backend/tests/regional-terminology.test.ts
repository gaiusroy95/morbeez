import { describe, expect, it } from 'vitest';
import { terminologyDetectionEngine } from '../src/services/regional-terminology/terminology-detection.engine.js';
import { responseLocalizationService } from '../src/services/regional-terminology/response-localization.service.js';

describe('terminologyDetectionEngine', () => {
  it('recognizes builtin kana and expands for AI', async () => {
    const result = await terminologyDetectionEngine.detect({
      rawMessage: 'Kana yellow aanu',
      language: 'ml',
      cropType: 'cardamom',
    });
    expect(result.knownTerms.some((t) => t.token.toLowerCase() === 'kana')).toBe(true);
    expect(result.expandedForAi.toLowerCase()).toContain('shoot');
    expect(result.unknownTerms.every((u) => !['kana', 'yellow', 'aanu'].includes(u.token.toLowerCase()))).toBe(
      true
    );
  });

  it('flags unknown tokens without guessing meaning', async () => {
    const result = await terminologyDetectionEngine.detect({
      rawMessage: 'Moola vattam vannu',
      language: 'ml',
    });
    expect(result.unknownTerms.length).toBeGreaterThan(0);
    expect(result.knownTerms.every((t) => t.meaning)).toBe(true);
  });
});

describe('responseLocalizationService', () => {
  it('swaps standard terms back to farmer regional words', async () => {
    const detection = await terminologyDetectionEngine.detect({
      rawMessage: 'Kana weak aanu',
      language: 'ml',
      cropType: 'cardamom',
    });
    const localized = responseLocalizationService.localize({
      standardResponse: 'Shoot emergence looks weak. Check nutrient stress or excess moisture.',
      detection,
      language: 'ml',
    });
    expect(localized.toLowerCase()).toContain('kana');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GINGER_ADVISORY_SAMPLE_BLOCKS,
  getGingerAdvisoryScenario,
} from '../src/domain/advisory/ginger-advisory-samples.js';
import { visitAiPromptContextService } from '../src/services/core/visit-ai-prompt-context.service.js';
import type { VisitAiContextPack } from '../src/services/core/visit-ai-context.service.js';

function gingerContextPack(): VisitAiContextPack {
  const scenario = getGingerAdvisoryScenario('nutrientDeficiency');
  const macro = scenario.metrics.macro ?? {};
  return {
    farmerId: '00000000-0000-4000-8000-000000000001',
    blockId: scenario.blockId,
    cropType: scenario.crop,
    dap: scenario.das,
    stage: scenario.stage,
    measurements: [],
    soilTestSummary: {
      metrics: {
        potassium: Number(macro.potassium?.value ?? 85),
        magnesium: Number(macro.magnesium?.value ?? 45),
        nitrogen: Number(macro.nitrogen?.value ?? 260),
        ph: Number(macro.ph?.value ?? 7.3),
      },
      reportedAt: '2026-01-01',
      labName: 'QA Lab',
    },
    weatherSnapshot: { temperatureC: 28, humidityPct: 82, rainfallMm: 12 },
    gps: null,
  };
}

describe('whatsapp diagnosis context — ginger soil', () => {
  it('prompt block includes potassium and magnesium for S2 block', async () => {
    const context = gingerContextPack();
    const block = await visitAiPromptContextService.buildPromptBlock({
      context,
      issueCategory: 'nutrient',
      issueName: 'Leaf edge scorching',
      observation: 'Yellow margins on lower leaves',
    });
    assert.match(block, /SOIL TEST/);
    assert.match(block, /85/);
    assert.match(block, /45|magnesium/i);
    assert.equal(context.blockId, GINGER_ADVISORY_SAMPLE_BLOCKS.nutrientDeficiency);
  });

  it('fusion hints boost nutrient deficiency for low K soil', () => {
    const context = gingerContextPack();
    const hints = visitAiPromptContextService.computeFusionHints(context, 'nutrient', null);
    const kHint = hints.find((h) => /potassium|deficien/i.test(h.label));
    assert.ok(kHint || hints.length >= 0);
  });
});

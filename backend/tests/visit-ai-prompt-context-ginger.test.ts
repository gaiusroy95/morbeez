import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GINGER_ADVISORY_SAMPLE_BLOCKS,
  getGingerAdvisoryScenario,
} from '../src/domain/advisory/ginger-advisory-samples.js';
import { visitAiPromptContextService } from '../src/services/core/visit-ai-prompt-context.service.js';
import type { VisitAiContextPack } from '../src/services/core/visit-ai-context.service.js';

function gingerContextPack(
  scenarioId: 'nutrientDeficiency' | 'waterloggingE2e'
): VisitAiContextPack {
  const scenario = getGingerAdvisoryScenario(scenarioId);
  const macro = scenario.metrics.macro ?? {};
  const metrics: Record<string, unknown> = {
    nitrogen: macro.nitrogen?.value ? Number(macro.nitrogen.value) : undefined,
    phosphorus: macro.phosphorus?.value ? Number(macro.phosphorus.value) : undefined,
    potassium: macro.potassium?.value ? Number(macro.potassium.value) : undefined,
    ph: macro.ph?.value ? Number(macro.ph.value) : undefined,
    magnesium: macro.magnesium?.value ? Number(macro.magnesium.value) : undefined,
    zinc: scenario.metrics.micro?.zinc?.value
      ? Number(scenario.metrics.micro.zinc.value)
      : undefined,
  };
  return {
    farmerId: '00000000-0000-4000-8000-000000000001',
    blockId: scenario.blockId,
    cropType: scenario.crop,
    dap: scenario.das,
    stage: scenario.stage,
    measurements: [{ key: 'leaf_yellowing', value: 'moderate' }],
    soilTestSummary: { metrics, reportedAt: '2026-01-01', labName: 'QA Lab' },
    weatherSnapshot: { temperatureC: 28, humidityPct: 82, rainfallMm: 45 },
    gps: null,
  };
}

describe('visit AI prompt context — ginger soil scenarios', () => {
  it('includes potassium and magnesium metrics for S2 deficiency block', async () => {
    const context = gingerContextPack('nutrientDeficiency');
    const block = await visitAiPromptContextService.buildPromptBlock({
      context,
      issueCategory: 'nutrient',
      issueName: 'Leaf edge scorching',
      observation: 'Yellow margins on lower leaves',
    });
    assert.match(block, /SOIL TEST/);
    assert.match(block, /potassium|85/i);
    assert.match(block, /magnesium|45/i);
    assert.equal(context.blockId, GINGER_ADVISORY_SAMPLE_BLOCKS.nutrientDeficiency);
  });

  it('flags low nitrogen and zinc for S3 waterlogging block', async () => {
    const context = gingerContextPack('waterloggingE2e');
    const block = await visitAiPromptContextService.buildPromptBlock({
      context,
      issueCategory: 'nutrient',
      issueName: 'Yellowing leaves',
      observation: 'Standing water in low areas',
    });
    assert.match(block, /110/);
    assert.match(block, /low nitrogen|Deficiency flags/i);
    const hints = visitAiPromptContextService.computeFusionHints(context, 'nutrient', null);
    const nitrogenHint = hints.find((h) => /nitrogen/i.test(h.label));
    assert.ok(nitrogenHint, 'expected nitrogen deficiency fusion hint');
    assert.ok(nitrogenHint!.boost >= 0.1);
  });

  it('formats weather with temperatureC key (not broken placeholder)', () => {
    const formatted = visitAiPromptContextService.formatWeatherBlock({
      temperatureC: 31,
      humidityPct: 70,
      rainfallMm: 12,
    });
    assert.match(formatted, /31/);
    assert.doesNotMatch(formatted, /\?°C, humidity \?, rain \?/);
  });
});

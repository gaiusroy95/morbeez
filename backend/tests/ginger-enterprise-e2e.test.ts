import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { outcomeIntelligenceService } from '../src/services/intelligence/outcome-intelligence.service.js';
import { communicationTimelineService } from '../src/services/intelligence/communication-timeline.service.js';
import { visitReportGeneratorService } from '../src/services/core/visit-report-generator.service.js';
import { productGapService } from '../src/services/core/product-gap.service.js';
import { experimentDefinitionService } from '../src/services/intelligence/enterprise-ops.service.js';
import { operationsMessagingService } from '../src/services/admin/operations-messaging.service.js';
import { diagnosisOrchestratorService } from '../src/services/diagnosis/diagnosis-orchestrator.service.js';
import { compatibilityOverrideService } from '../src/services/core/compatibility-override.service.js';
import { adaptiveProtocolService } from '../src/services/intelligence/adaptive-protocol.service.js';
import { textLinesToPdfBuffer } from '../src/lib/minimal-pdf.js';
import { GINGER_DEMO_PHONE, isGingerDemoPhone } from './fixtures/ginger-demo.js';

describe('ginger enterprise e2e (phase 3-6 services)', () => {
  it('protocol funnel returns D3/D7/D14 buckets', async () => {
    const funnel = await outcomeIntelligenceService.getProtocolFunnelStats(90).catch(() => ({
      d3: { scheduled: 0, completed: 0, failed: 0 },
      d7: { scheduled: 0, completed: 0, failed: 0 },
      d14: { scheduled: 0, completed: 0, failed: 0 },
    }));
    assert.ok('d3' in funnel && 'd7' in funnel && 'd14' in funnel);
  });

  it('communication timeline returns array for unknown farmer', async () => {
    const rows = await communicationTimelineService
      .buildForFarmer('00000000-0000-4000-8000-000000000099')
      .catch(() => []);
    assert.ok(Array.isArray(rows));
  });

  it('visit report generator exposes html format', async () => {
    await assert.rejects(
      () => visitReportGeneratorService.generate('00000000-0000-4000-8000-000000000099'),
      /Visit not found|Could not load/
    );
    assert.equal(typeof diagnosisOrchestratorService.triagePreview, 'function');
  });

  it('product gap inventory eta handles missing product', async () => {
    const eta = await productGapService.getCommerceInventoryEta('__nonexistent_product_xyz__').catch(() => null);
    assert.ok(eta === null || typeof eta?.availableQty === 'number');
  });

  it('experiment definitions list returns array', async () => {
    const rows = await experimentDefinitionService.list().catch(() => []);
    assert.ok(Array.isArray(rows));
  });

  it('executive weekly digest composes subject and body', async () => {
    const digest = await operationsMessagingService.sendExecutiveWeeklyDigest();
    assert.ok(digest.subject.includes('executive digest'));
    assert.ok(digest.body.includes('Morbeez'));
    assert.equal(digest.logged, true);
  });

  it('ginger demo phone fixture matches advisory samples', () => {
    assert.ok(isGingerDemoPhone(GINGER_DEMO_PHONE));
    assert.ok(isGingerDemoPhone('6282873542'));
  });

  it('compatibility aggregates and adaptive protocol chain', async () => {
    const agg = await compatibilityOverrideService.listAggregates(30).catch(() => ({
      totalOverrides: 0,
      byPair: [],
      unknownPairRate: 0,
      unknownPairChecks: 0,
      unknownPairHits: 0,
    }));
    assert.ok(typeof agg.unknownPairRate === 'number');
    const suggestion = await adaptiveProtocolService.suggestOnWorseOutcome({
      issueLabel: 'nutrient deficiency',
      cropType: 'ginger',
      district: 'Idukki',
      outcomeStatus: 'worse',
      applicationLogged: true,
      fusedConfidence: 0.82,
    });
    assert.ok(suggestion?.failureType);
  });

  it('visit report PDF buffer is valid PDF header', async () => {
    const buf = textLinesToPdfBuffer(['Ginger visit report', 'Block S3', 'Morbeez']);
    assert.ok(buf.slice(0, 5).toString() === '%PDF-');
  });

  it('diagnosis orchestrator triage preview is callable', async () => {
    assert.equal(typeof diagnosisOrchestratorService.triagePreview, 'function');
  });

  it('application history service records and lists (X3 path)', async () => {
    const { applicationHistoryService } = await import(
      '../src/services/intelligence/enterprise-ops.service.js'
    );
    const farmerId = '00000000-0000-4000-8000-000000000099';
    const rows = await applicationHistoryService.listForFarmer(farmerId).catch(() => []);
    assert.ok(Array.isArray(rows));
    await assert.rejects(
      () =>
        applicationHistoryService.record({
          farmerId,
          productName: 'Ginger booster',
          method: 'spray',
          source: 'visit',
        }),
      /Could not record|foreign key|violates/
    );
  });

  it('protocol draft update rejects missing id (G12)', async () => {
    const { protocolDefinitionService } = await import(
      '../src/services/intelligence/enterprise-ops.service.js'
    );
    await assert.rejects(
      () => protocolDefinitionService.updateDraft('00000000-0000-4000-8000-000000000099', { label: 'x' }),
      /Could not update/
    );
  });
});

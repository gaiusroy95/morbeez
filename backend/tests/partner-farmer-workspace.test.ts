import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSuggestedAction,
  partnerFarmerWorkspaceService,
} from '../src/services/partner/partner-farmer-workspace.service.js';
import { sanitizePartnerPayload } from '../src/services/partner/partner-response-sanitizer.js';

describe('partner farmer workspace', () => {
  it('computeSuggestedAction prioritizes pending partner tasks', () => {
    assert.equal(
      computeSuggestedAction({
        pendingPartnerTasks: 2,
        daysSinceLastVisit: 5,
        openIssueCount: 0,
        hasSoilTask: false,
      }),
      'field_visit'
    );
  });

  it('computeSuggestedAction suggests field visit when issues open', () => {
    assert.equal(
      computeSuggestedAction({
        pendingPartnerTasks: 0,
        daysSinceLastVisit: 5,
        openIssueCount: 2,
        hasSoilTask: false,
      }),
      'field_visit'
    );
  });

  it('suggestedActionLabel returns human label', () => {
    assert.equal(partnerFarmerWorkspaceService.suggestedActionLabel('field_visit'), 'Field visit');
  });

  it('sanitizePartnerPayload strips forbidden BI fields', () => {
    const cleaned = sanitizePartnerPayload({
      title: 'Order',
      margin: 12,
      roi: 0.4,
      items: [{ profit: 5, name: 'Urea' }],
    });
    assert.deepEqual(cleaned, {
      title: 'Order',
      items: [{ name: 'Urea' }],
    });
  });
});

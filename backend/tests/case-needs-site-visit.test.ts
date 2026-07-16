import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { caseNeedsSiteVisit } from '../src/services/agronomist/case-needs-site-visit.js';

describe('caseNeedsSiteVisit', () => {
  it('detects MAIOS field_visit route', () => {
    assert.equal(caseNeedsSiteVisit({ maiosRoute: 'field_visit' }), true);
    assert.equal(caseNeedsSiteVisit({ maiosRoute: 'emergency_callback' }), true);
    assert.equal(caseNeedsSiteVisit({ maiosRoute: 'auto_send' }), false);
  });

  it('detects field visit from escalation reason', () => {
    assert.equal(
      caseNeedsSiteVisit({ reason: 'MAIOS v12 route: field_visit (critical)' }),
      true
    );
    assert.equal(caseNeedsSiteVisit({ reason: 'Needs site visit confirmation' }), true);
    assert.equal(
      caseNeedsSiteVisit({ reason: 'Advisory review: Nitrogen deficiency' }),
      false
    );
  });
});

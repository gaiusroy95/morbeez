import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure helpers mirroring the application-check dedupe rules used in
 * recommendation-follow-up.service (kept local so tests do not need Supabase).
 */
function shouldSkipApplicationCheck(params: {
  resolved: boolean;
  diagnosisInFlight: boolean;
  recentForRec: boolean;
  recentForFarmer: boolean;
  isClaimWinner: boolean;
}): boolean {
  if (params.resolved) return true;
  if (params.diagnosisInFlight) return true;
  if (params.recentForRec) return true;
  if (params.recentForFarmer) return true;
  if (!params.isClaimWinner) return true;
  return false;
}

describe('application check dedupe rules', () => {
  it('skips when recommendation already resolved', () => {
    assert.equal(
      shouldSkipApplicationCheck({
        resolved: true,
        diagnosisInFlight: false,
        recentForRec: false,
        recentForFarmer: false,
        isClaimWinner: true,
      }),
      true
    );
  });

  it('skips while photo diagnosis is in flight', () => {
    assert.equal(
      shouldSkipApplicationCheck({
        resolved: false,
        diagnosisInFlight: true,
        recentForRec: false,
        recentForFarmer: false,
        isClaimWinner: true,
      }),
      true
    );
  });

  it('skips when farmer already got a recent identical prompt', () => {
    assert.equal(
      shouldSkipApplicationCheck({
        resolved: false,
        diagnosisInFlight: false,
        recentForRec: false,
        recentForFarmer: true,
        isClaimWinner: true,
      }),
      true
    );
  });

  it('skips losing concurrent claim', () => {
    assert.equal(
      shouldSkipApplicationCheck({
        resolved: false,
        diagnosisInFlight: false,
        recentForRec: false,
        recentForFarmer: false,
        isClaimWinner: false,
      }),
      true
    );
  });

  it('allows a single winning send', () => {
    assert.equal(
      shouldSkipApplicationCheck({
        resolved: false,
        diagnosisInFlight: false,
        recentForRec: false,
        recentForFarmer: false,
        isClaimWinner: true,
      }),
      false
    );
  });
});

import { describe, expect, it } from 'vitest';
import { ATTRIBUTION_TYPES, DEFAULT_ATTRIBUTION_WEIGHTS } from '../src/services/intelligence/employee-attribution.types.js';
import { ATTRIBUTION_CONVERSION_WINDOW_DAYS } from '../src/services/intelligence/employee-attribution-capture.service.js';

describe('opportunity-intelligence phase2 attribution', () => {
  it('defines all attribution types from product rules', () => {
    const required = [
      'telecaller_assigned',
      'first_engagement',
      'relationship_owner',
      'advisory',
      'conversion_assist',
      'reactivation',
    ];
    for (const t of required) {
      expect(ATTRIBUTION_TYPES).toContain(t);
    }
  });

  it('uses 180-day conversion window', () => {
    expect(ATTRIBUTION_CONVERSION_WINDOW_DAYS).toBe(180);
  });

  it('conversion_assist weight is configured', () => {
    expect(DEFAULT_ATTRIBUTION_WEIGHTS.conversion_assist).toBe(0.3);
    expect(DEFAULT_ATTRIBUTION_WEIGHTS.advisory).toBeGreaterThan(
      DEFAULT_ATTRIBUTION_WEIGHTS.telecaller_assigned
    );
  });
});

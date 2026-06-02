import { describe, expect, it } from 'vitest';
import { FARMER_EVENT_TYPES } from '../src/services/intelligence/farmer-event.types.js';
import {
  FARMER_OPPORTUNITY_WEIGHTS,
  EMPLOYEE_PERFORMANCE_WEIGHTS,
} from '../src/services/intelligence/opportunity-intelligence.types.js';
import { DEFAULT_ATTRIBUTION_WEIGHTS } from '../src/services/intelligence/employee-attribution.types.js';

describe('opportunity-intelligence phase0', () => {
  it('farmer opportunity weights sum to 100', () => {
    const sum = Object.values(FARMER_OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('employee performance weights sum to 100', () => {
    const sum = Object.values(EMPLOYEE_PERFORMANCE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('includes required farmer event types from brief', () => {
    const required = [
      'MESSAGE_REPLY',
      'IMAGE_UPLOAD',
      'ROI_ENTRY',
      'RECOMMENDATION_APPLIED',
      'CALLBACK_REQUESTED',
    ];
    for (const t of required) {
      expect(FARMER_EVENT_TYPES).toContain(t);
    }
  });

  it('attribution default weights are between 0 and 1', () => {
    for (const w of Object.values(DEFAULT_ATTRIBUTION_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});

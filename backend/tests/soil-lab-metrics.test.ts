import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSoilMetricsForAi,
  formatSoilMetricsMultiline,
  soilDeficiencyFlags,
  soilMetricsToFlatRecord,
} from '../src/services/soil/soil-lab-metrics.js';

const v2Sample = {
  version: 2,
  macro: {
    ph: { value: '6.8', unit: '' },
    ec: { value: '0.7', unit: 'dS/m' },
    nitrogen: { value: '', unit: 'kg/ha' },
    phosphorus: { value: '', unit: 'kg/ha' },
    potassium: { value: '', unit: 'kg/ha' },
  },
  micro: {},
};

describe('soil lab metrics v2', () => {
  it('reads pH and EC from macro panel', () => {
    const flat = soilMetricsToFlatRecord(v2Sample);
    assert.equal(flat.ph, 6.8);
    assert.equal(flat.ec, 0.7);
  });

  it('formats farmer-facing soil summary from v2 metrics', () => {
    const line = formatSoilMetricsForAi(v2Sample, { reportedAt: '2026-07-08' });
    assert.ok(line);
    assert.match(line!, /pH: 6\.8/);
    assert.match(line!, /EC: 0\.7 dS\/m/);
    assert.match(line!, /2026-07-08/);
  });

  it('builds multiline soil report lines', () => {
    const lines = formatSoilMetricsMultiline(v2Sample, { reportedAt: '2026-07-08' });
    assert.ok(lines.some((l) => l.includes('pH: 6.8')));
    assert.ok(lines.some((l) => l.includes('EC: 0.7 dS/m')));
  });

  it('flags low potassium from flat metrics', () => {
    const flags = soilDeficiencyFlags({
      version: 2,
      macro: {
        potassium: { value: '85', unit: 'kg/ha' },
      },
      micro: {},
    });
    assert.ok(flags.includes('low potassium'));
  });
});

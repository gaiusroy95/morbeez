import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPlotCoordinate } from '../src/services/core/plot-location.service.js';

describe('plot GPS validation', () => {
  it('accepts Kerala coordinates', () => {
    assert.equal(isValidPlotCoordinate(10.5276, 76.2144), true);
  });

  it('rejects coordinates outside India bounds', () => {
    assert.equal(isValidPlotCoordinate(51.5, -0.12), false);
  });
});

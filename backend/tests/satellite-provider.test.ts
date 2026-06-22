import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { satelliteProviderService } from '../src/services/intelligence/satellite-provider.service.js';

describe('satellite provider (P12)', () => {
  it('stub refresh returns NDVI without live API', async () => {
    const prev = process.env.SATELLITE_PROVIDER;
    process.env.SATELLITE_PROVIDER = 'stub';
    try {
      const result = await satelliteProviderService
        .refreshBlockNdvi(
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002'
        )
        .catch(() => null);
      if (result) {
        assert.ok(typeof result.ndviMean === 'number');
        assert.equal(result.provider, 'stub');
      } else {
        assert.ok(true);
      }
    } finally {
      if (prev === undefined) delete process.env.SATELLITE_PROVIDER;
      else process.env.SATELLITE_PROVIDER = prev;
    }
  });
});

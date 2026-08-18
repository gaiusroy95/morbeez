import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { amountForEvent } from '../src/domain/remuneration/agronomist-pay.js';
import {
  dominantCategory,
  isCommercialOrder,
  reliabilityHoldPct,
  resolveCommissionCategory,
} from '../src/domain/remuneration/commission-category.js';
import { haversineKm, kmAllowanceInr } from '../src/domain/remuneration/km.js';

const COMP = {
  incentiveEnabled: true,
  fieldVisitBonus: 200,
  recommendationSuccessBonus: 150,
  escalationBonus: 300,
  farmerRetentionBonus: 100,
  kmAllowanceEnabled: true,
  ratePerKm: 12,
};

describe('agronomist work pay', () => {
  it('pays visit / rec / escalation / retention from HR snapshot', () => {
    assert.equal(amountForEvent('field_visit', COMP), 200);
    assert.equal(amountForEvent('recommendation_success', COMP), 150);
    assert.equal(amountForEvent('escalation_resolved', COMP), 300);
    assert.equal(amountForEvent('retention', COMP), 100);
  });

  it('pays KM from GPS km × rate, never a fake 100 km', () => {
    assert.equal(amountForEvent('km_allowance', COMP, { km: 8.5 }), 102);
    assert.equal(amountForEvent('km_allowance', COMP, { km: 0 }), 0);
    assert.equal(amountForEvent('km_allowance', { ...COMP, kmAllowanceEnabled: false }, { km: 10 }), 0);
  });

  it('pays nothing when incentives are disabled', () => {
    assert.equal(amountForEvent('field_visit', { ...COMP, incentiveEnabled: false }), 0);
  });
});

describe('GPS km', () => {
  it('computes haversine for a short field hop', () => {
    const km = haversineKm({ lat: 12.97, lng: 77.59 }, { lat: 12.99, lng: 77.61 });
    assert.ok(km != null && km > 2 && km < 5);
    assert.equal(kmAllowanceInr(km!, 10) > 20, true);
  });

  it('returns null for missing coordinates or GPS jitter under 50 m', () => {
    assert.equal(haversineKm({ lat: null, lng: 77 }, { lat: 12, lng: 77 }), null);
    assert.equal(
      haversineKm({ lat: 12.97, lng: 77.59 }, { lat: 12.97001, lng: 77.59001 }),
      null
    );
  });
});

describe('partner commission category', () => {
  it('maps biologicals, specialty, and commodity fertilizers from SKU/title', () => {
    assert.equal(resolveCommissionCategory({ sku: 'MTRICHO-1L', title: 'Trichoderma' }), 'biologicals');
    assert.equal(resolveCommissionCategory({ title: 'Zinc EDTA micronutrient' }), 'high_margin_specialty');
    assert.equal(resolveCommissionCategory({ title: 'Urea 45kg' }), 'commodity_fertilizers');
    assert.equal(resolveCommissionCategory({ title: 'Soil test kit' }), 'soil_testing');
    assert.equal(resolveCommissionCategory({ orderKind: 'dealer' }), 'dealer_order');
  });

  it('picks the dominant sales category on mixed orders', () => {
    assert.equal(
      dominantCategory([
        { title: 'Trichoderma', salesInr: 800 },
        { title: 'Urea 45kg', salesInr: 5000 },
      ]),
      'commodity_fertilizers'
    );
  });

  it('flags commercial orders above 30k for lead bonus', () => {
    assert.equal(isCommercialOrder(30000), false);
    assert.equal(isCommercialOrder(30001), true);
  });

  it('holds commission by reliability', () => {
    assert.equal(reliabilityHoldPct(90), 0);
    assert.equal(reliabilityHoldPct(60), 20);
    assert.equal(reliabilityHoldPct(40), 100);
  });
});

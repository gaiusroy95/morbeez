import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  channelPoolAmount,
  currentAndPrevious,
  derivePoolStatus,
  isNoOpPoolChange,
  resolveVersionOnDate,
  snapshotFromVersion,
  validatePoolPct,
  versionLabel,
  type ChannelPoolVersionRow,
} from '../src/services/pricing/channel-pool.util.js';

function version(
  partial: Partial<ChannelPoolVersionRow> & Pick<ChannelPoolVersionRow, 'versionNumber' | 'poolPct' | 'effectiveFrom'>
): ChannelPoolVersionRow {
  return {
    id: `id-${partial.versionNumber}`,
    productId: 'p1',
    variantId: 'v1',
    sku: 'MTRICHO-1L',
    previousPoolPct: null,
    effectiveTo: null,
    status: 'active',
    changeReason: 'test',
    editedByAdminId: null,
    editedByName: 'Admin',
    editedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('channel pool versioning', () => {
  it('labels versions as V1, V2, V3', () => {
    assert.equal(versionLabel(1), 'V1');
    assert.equal(versionLabel(3), 'V3');
  });

  it('picks the version effective on the transaction date', () => {
    const history = [
      version({
        versionNumber: 1,
        poolPct: 10,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-06-30',
        status: 'closed',
      }),
      version({
        versionNumber: 2,
        poolPct: 12,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-07-31',
        status: 'closed',
      }),
      version({
        versionNumber: 3,
        poolPct: 16,
        effectiveFrom: '2026-08-01',
        effectiveTo: null,
        status: 'active',
      }),
    ];

    assert.equal(resolveVersionOnDate(history, '2026-07-20')?.poolPct, 12);
    assert.equal(resolveVersionOnDate(history, '2026-08-20')?.poolPct, 16);
    assert.equal(resolveVersionOnDate(history, '2026-06-15')?.poolPct, 10);
    assert.equal(resolveVersionOnDate(history, '2026-05-01'), null);
  });

  it('same-day revisions keep the highest version number', () => {
    const history = [
      version({
        versionNumber: 4,
        poolPct: 16,
        effectiveFrom: '2026-08-17',
        effectiveTo: '2026-08-17',
        status: 'closed',
      }),
      version({
        versionNumber: 5,
        poolPct: 18,
        effectiveFrom: '2026-08-17',
        effectiveTo: null,
        status: 'active',
      }),
    ];
    assert.equal(resolveVersionOnDate(history, '2026-08-17')?.versionNumber, 5);
    assert.equal(resolveVersionOnDate(history, '2026-08-17')?.poolPct, 18);
  });

  it('does not treat a later current pool as a rewrite of July history', () => {
    const history = [
      version({
        versionNumber: 2,
        poolPct: 12,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-07-31',
      }),
      version({
        versionNumber: 3,
        poolPct: 16,
        effectiveFrom: '2026-08-01',
      }),
    ];
    const july = resolveVersionOnDate(history, '2026-07-20');
    const snap = snapshotFromVersion(july, 10000);
    assert.equal(snap.channelPoolPct, 12);
    assert.equal(snap.channelPoolVersionLabel, 'V2');
    assert.equal(snap.channelPoolAmount, 1200);
    assert.equal(resolveVersionOnDate(history, '2026-08-17')?.poolPct, 16);
  });

  it('derives pending / active / closed from dates', () => {
    assert.equal(
      derivePoolStatus({ effectiveFrom: '2026-09-01', effectiveTo: null }, '2026-08-17'),
      'pending'
    );
    assert.equal(
      derivePoolStatus({ effectiveFrom: '2026-08-01', effectiveTo: null }, '2026-08-17'),
      'active'
    );
    assert.equal(
      derivePoolStatus({ effectiveFrom: '2026-07-01', effectiveTo: '2026-07-31' }, '2026-08-17'),
      'closed'
    );
  });

  it('skips a no-op save of the same % and effective date', () => {
    const current = version({ versionNumber: 3, poolPct: 16, effectiveFrom: '2026-08-01' });
    assert.equal(isNoOpPoolChange(current, 16, '2026-08-01'), true);
    assert.equal(isNoOpPoolChange(current, 18, '2026-08-01'), false);
    assert.equal(isNoOpPoolChange(null, 16, '2026-08-01'), false);
  });

  it('exposes previous pool from history', () => {
    const history = [
      version({ versionNumber: 3, poolPct: 16, effectiveFrom: '2026-08-01' }),
      version({
        versionNumber: 2,
        poolPct: 12,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-07-31',
      }),
    ];
    const { current, previous } = currentAndPrevious(history, '2026-08-17');
    assert.equal(current?.poolPct, 16);
    assert.equal(previous?.poolPct, 12);
  });

  it('computes pool amount and validates percent', () => {
    assert.equal(channelPoolAmount(25000, 16), 4000);
    assert.equal(validatePoolPct(16), 16);
    assert.throws(() => validatePoolPct(101));
    assert.equal(addCalendarDays('2026-08-01', -1), '2026-07-31');
  });
});

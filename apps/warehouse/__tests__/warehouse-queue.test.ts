import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPackQueue,
  isWarehouseManagerRole,
  warehouseModulesForRole,
} from '../../../packages/shared/src/api/warehouse-queue.ts';
import type { QueueOrder } from '../../../packages/shared/src/types/warehouse.ts';

function row(partial: Partial<QueueOrder> & Pick<QueueOrder, 'id' | 'orderName' | 'omsStatus'>): QueueOrder {
  return {
    courier: 'Manual',
    itemCount: 1,
    priority: 'normal',
    awb: null,
    pickListId: null,
    shiprocketError: null,
    ...partial,
  };
}

describe('warehouse mobile queue helpers', () => {
  it('filters pack queue statuses', () => {
    const orders = [
      row({ id: '1', orderName: '#1', omsStatus: 'packing' }),
      row({ id: '2', orderName: '#2', omsStatus: 'ready_dispatch' }),
    ];
    assert.equal(filterPackQueue(orders).length, 1);
  });

  it('gates manager batch UI by role', () => {
    assert.equal(isWarehouseManagerRole('admin'), true);
    assert.equal(warehouseModulesForRole('picker_packer').includes('dispatch'), false);
  });
});

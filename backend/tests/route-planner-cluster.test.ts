import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClusterSummaries,
  nearestNeighborOrder,
  optimizeClusteredRoute,
} from '../../packages/shared/src/route-planner/index.ts';

describe('route-planner clustering', () => {
  it('groups stops by pincode and orders clusters nearest-first', () => {
    const stops = [
      { id: 'a', latitude: 10.0, longitude: 76.0, pincodeId: 'p1', pincode: '682001' },
      { id: 'b', latitude: 10.01, longitude: 76.01, pincodeId: 'p1', pincode: '682001' },
      { id: 'c', latitude: 11.0, longitude: 77.0, pincodeId: 'p2', pincode: '680001' },
    ];
    const { ordered, clusters } = optimizeClusteredRoute(stops, 9.99, 75.99);
    assert.equal(ordered.length, 3);
    assert.equal(clusters.length, 2);
    assert.equal(ordered[0]?.pincode, '682001');
    assert.equal(ordered[ordered.length - 1]?.pincode, '680001');
  });

  it('nearest-neighbor keeps closer stop first within a cluster', () => {
    const stops = [
      { id: 'near', latitude: 10.01, longitude: 76.01, pincodeId: 'p1', pincode: '682001' },
      { id: 'far', latitude: 10.5, longitude: 76.5, pincodeId: 'p1', pincode: '682001' },
    ];
    const { ordered } = nearestNeighborOrder(stops, 10.0, 76.0);
    assert.equal(ordered[0]?.id, 'near');
  });

  it('buildClusterSummaries counts stops per pincode', () => {
    const clusters = buildClusterSummaries([
      { id: '1', latitude: 1, longitude: 1, pincodeId: 'a', pincode: '111111' },
      { id: '2', latitude: 2, longitude: 2, pincodeId: 'a', pincode: '111111' },
      { id: '3', latitude: 3, longitude: 3, pincodeId: 'b', pincode: '222222' },
    ]);
    assert.equal(clusters.length, 2);
    assert.equal(clusters.find((c) => c.pincode === '111111')?.stopCount, 2);
  });
});

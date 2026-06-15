/** Pincode-clustered route optimization (haversine nearest-neighbor). */

import type { PincodeClusterSummary, RouteCoordSource } from '../types/agronomist';

export type { PincodeClusterSummary, RouteCoordSource };

export type RouteStopForOptimize = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  pincodeId?: string | null;
  pincode?: string | null;
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoords<T extends RouteStopForOptimize>(
  s: T
): s is T & { latitude: number; longitude: number } {
  return s.latitude != null && s.longitude != null;
}

function clusterKey(stop: RouteStopForOptimize): string {
  return stop.pincodeId ?? stop.pincode ?? 'unknown';
}

function clusterCentroid(stops: Array<RouteStopForOptimize & { latitude: number; longitude: number }>): {
  lat: number;
  lng: number;
} {
  const lat = stops.reduce((sum, s) => sum + s.latitude, 0) / stops.length;
  const lng = stops.reduce((sum, s) => sum + s.longitude, 0) / stops.length;
  return { lat, lng };
}

/** Greedy nearest-neighbor ordering from an origin point. */
export function nearestNeighborOrder<T extends RouteStopForOptimize>(
  stops: T[],
  originLat: number,
  originLng: number
): { ordered: T[]; distanceKm: number } {
  const withCoords = stops.filter(hasCoords);
  const withoutCoords = stops.filter((s) => !hasCoords(s));
  const remaining = [...withCoords];
  const ordered: T[] = [];
  let curLat = originLat;
  let curLng = originLng;
  let distanceKm = 0;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i]!;
      const d = haversineKm(curLat, curLng, s.latitude, s.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!;
    distanceKm += bestDist === Infinity ? 0 : bestDist;
    curLat = next.latitude;
    curLng = next.longitude;
    ordered.push(next);
  }

  return { ordered: [...ordered, ...withoutCoords], distanceKm };
}

/** Order stops: pincode clusters first, then nearest-neighbor within each cluster. */
export function optimizeClusteredRoute<T extends RouteStopForOptimize>(
  stops: T[],
  originLat: number,
  originLng: number
): { ordered: T[]; distanceKm: number; clusters: PincodeClusterSummary[] } {
  if (stops.length <= 1) {
    return {
      ordered: [...stops],
      distanceKm: 0,
      clusters: buildClusterSummaries(stops),
    };
  }

  const groups = new Map<string, T[]>();
  for (const stop of stops) {
    const key = clusterKey(stop);
    const list = groups.get(key) ?? [];
    list.push(stop);
    groups.set(key, list);
  }

  type ClusterNode = {
    key: string;
    stops: T[];
    lat: number;
    lng: number;
    pincode: string | null;
    pincodeId: string | null;
  };

  const clusterNodes: ClusterNode[] = [];
  for (const [key, group] of groups) {
    const geo = group.filter(hasCoords);
    if (geo.length === 0) {
      clusterNodes.push({
        key,
        stops: group,
        lat: originLat,
        lng: originLng,
        pincode: group[0]?.pincode ?? null,
        pincodeId: group[0]?.pincodeId ?? null,
      });
      continue;
    }
    const c = clusterCentroid(geo);
    clusterNodes.push({
      key,
      stops: group,
      lat: c.lat,
      lng: c.lng,
      pincode: group[0]?.pincode ?? null,
      pincodeId: group[0]?.pincodeId ?? (key !== 'unknown' ? key : null),
    });
  }

  const remainingClusters = [...clusterNodes];
  const orderedClusters: ClusterNode[] = [];
  let curLat = originLat;
  let curLng = originLng;
  let totalKm = 0;

  while (remainingClusters.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remainingClusters.length; i++) {
      const c = remainingClusters[i]!;
      const d = haversineKm(curLat, curLng, c.lat, c.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remainingClusters.splice(bestIdx, 1)[0]!;
    totalKm += bestDist === Infinity ? 0 : bestDist;
    orderedClusters.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }

  const ordered: T[] = [];
  let posLat = originLat;
  let posLng = originLng;
  for (const cluster of orderedClusters) {
    const { ordered: clusterOrdered, distanceKm: clusterKm } = nearestNeighborOrder(cluster.stops, posLat, posLng);
    ordered.push(...clusterOrdered);
    totalKm += clusterKm;
    const lastGeo = [...clusterOrdered].reverse().find(hasCoords);
    if (lastGeo) {
      posLat = lastGeo.latitude;
      posLng = lastGeo.longitude;
    }
  }

  return {
    ordered,
    distanceKm: Math.round(totalKm * 10) / 10,
    clusters: buildClusterSummaries(stops),
  };
}

export function buildClusterSummaries(stops: RouteStopForOptimize[]): PincodeClusterSummary[] {
  const groups = new Map<string, RouteStopForOptimize[]>();
  for (const stop of stops) {
    const key = clusterKey(stop);
    const list = groups.get(key) ?? [];
    list.push(stop);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, group]) => {
    const geo = group.filter(hasCoords);
    const centroid = geo.length ? clusterCentroid(geo as Array<RouteStopForOptimize & { latitude: number; longitude: number }>) : null;
    return {
      pincode: group[0]?.pincode ?? (key !== 'unknown' && !key.includes('-') ? key : null),
      pincodeId: group[0]?.pincodeId ?? null,
      stopCount: group.length,
      centroidLat: centroid?.lat ?? null,
      centroidLng: centroid?.lng ?? null,
    };
  });
}

export function estimateRouteHours(distanceKm: number, stopCount: number): number {
  return Math.round((distanceKm / 25 + stopCount * 0.25) * 10) / 10;
}

export function coordSourceLabel(source: RouteCoordSource): string {
  switch (source) {
    case 'plot_gps':
      return 'Plot GPS';
    case 'pincode':
      return 'Pincode area';
    case 'district':
      return 'District approx';
    default:
      return 'No location';
  }
}

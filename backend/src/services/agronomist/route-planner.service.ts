import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { blockService, blockDisplayName } from '../core/block.service.js';
import { isValidPlotCoordinate } from '../core/plot-location.service.js';
import { resolveCoords } from '../whatsapp/pipeline/weather-fetch.service.js';
import { partnerMobileService } from '../partner/partner-mobile.service.js';

export type RouteAgentContext =
  | { agentType: 'agronomist'; email: string }
  | { agentType: 'partner'; partnerId: string };

export type ResolvedStopLocation = {
  latitude: number | null;
  longitude: number | null;
  coordSource: 'plot_gps' | 'pincode' | 'district' | 'none';
  pincode: string | null;
  pincodeId: string | null;
  blockName: string | null;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type StopForOptimize = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  pincodeId: string | null;
  pincode: string | null;
};

function clusterKey(stop: StopForOptimize): string {
  return stop.pincodeId ?? stop.pincode ?? 'unknown';
}

function hasCoords(
  s: StopForOptimize
): s is StopForOptimize & { latitude: number; longitude: number } {
  return s.latitude != null && s.longitude != null;
}

function nearestNeighborOrder<T extends StopForOptimize>(
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

function optimizeClusteredStops<T extends StopForOptimize>(
  stops: T[],
  originLat: number,
  originLng: number
): { ordered: T[]; distanceKm: number } {
  if (stops.length <= 1) return { ordered: [...stops], distanceKm: 0 };

  const groups = new Map<string, T[]>();
  for (const stop of stops) {
    const key = clusterKey(stop);
    const list = groups.get(key) ?? [];
    list.push(stop);
    groups.set(key, list);
  }

  type ClusterNode = { key: string; stops: T[]; lat: number; lng: number };
  const clusterNodes: ClusterNode[] = [];

  for (const [key, group] of groups) {
    const geo = group.filter(hasCoords);
    if (!geo.length) {
      clusterNodes.push({ key, stops: group, lat: originLat, lng: originLng });
      continue;
    }
    const lat = geo.reduce((s, g) => s + g.latitude, 0) / geo.length;
    const lng = geo.reduce((s, g) => s + g.longitude, 0) / geo.length;
    clusterNodes.push({ key, stops: group, lat, lng });
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
    const { ordered: clusterOrdered, distanceKm: clusterKm } = nearestNeighborOrder(
      cluster.stops,
      posLat,
      posLng
    );
    ordered.push(...clusterOrdered);
    totalKm += clusterKm;
    const lastGeo = [...clusterOrdered].reverse().find(hasCoords);
    if (lastGeo) {
      posLat = lastGeo.latitude;
      posLng = lastGeo.longitude;
    }
  }

  return { ordered, distanceKm: Math.round(totalKm * 10) / 10 };
}

async function resolveStopLocation(
  farmerId: string,
  blockId: string | null | undefined
): Promise<ResolvedStopLocation> {
  let blockName: string | null = null;
  let pincodeId: string | null = null;
  let pincode: string | null = null;

  if (blockId) {
    const blocks = await blockService.listByFarmer(farmerId);
    const block = blocks.find((b) => b.id === blockId);
    if (block) {
      blockName = blockDisplayName(block);
      pincodeId = block.pincode_id;
      if (
        block.latitude != null &&
        block.longitude != null &&
        isValidPlotCoordinate(block.latitude, block.longitude)
      ) {
        let pincode: string | null = null;
        if (block.pincode_id) {
          const { data: pmRow } = await supabase
            .from('pincode_master')
            .select('pincode')
            .eq('id', block.pincode_id)
            .maybeSingle();
          pincode = pmRow?.pincode ? String(pmRow.pincode) : null;
        }
        return {
          latitude: block.latitude,
          longitude: block.longitude,
          coordSource: 'plot_gps',
          pincode,
          pincodeId,
          blockName,
        };
      }
    }
  }

  const { data: farmer, error } = await supabase
    .from('farmers')
    .select('district, pincode_id, pincode_master(pincode, district, latitude, longitude, village)')
    .eq('id', farmerId)
    .maybeSingle();
  throwIfSupabaseError(error, 'Could not load farmer location');

  const pm = farmer?.pincode_master as {
    pincode?: string;
    district?: string;
    latitude?: number;
    longitude?: number;
    village?: string;
  } | null;

  pincodeId = pincodeId ?? (farmer?.pincode_id ? String(farmer.pincode_id) : null);
  pincode = pm?.pincode ?? null;

  const hasPin =
    pm?.latitude != null &&
    pm?.longitude != null &&
    Number.isFinite(Number(pm.latitude)) &&
    Number.isFinite(Number(pm.longitude));

  const coords = resolveCoords({
    district: farmer?.district ? String(farmer.district) : pm?.district,
    pincodeLat: hasPin ? Number(pm!.latitude) : null,
    pincodeLon: hasPin ? Number(pm!.longitude) : null,
    pincodeLabel: pm?.village
      ? `${pm.village}, ${pm?.district ?? ''}`
      : pm?.pincode
        ? `PIN ${pm.pincode}`
        : undefined,
  });

  if (hasPin) {
    return {
      latitude: coords.lat,
      longitude: coords.lon,
      coordSource: 'pincode',
      pincode,
      pincodeId,
      blockName,
    };
  }

  if (coords.lat && coords.lon) {
    return {
      latitude: coords.lat,
      longitude: coords.lon,
      coordSource: 'district',
      pincode,
      pincodeId,
      blockName,
    };
  }

  return {
    latitude: null,
    longitude: null,
    coordSource: 'none',
    pincode,
    pincodeId,
    blockName,
  };
}

function buildPincodeClusters(
  stops: Array<{
    latitude: number | null;
    longitude: number | null;
    pincode: string | null;
    pincodeId: string | null;
  }>
) {
  const groups = new Map<string, typeof stops>();
  for (const stop of stops) {
    const key = stop.pincodeId ?? stop.pincode ?? 'unknown';
    const list = groups.get(key) ?? [];
    list.push(stop);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([, group]) => {
    const geo = group.filter((s) => s.latitude != null && s.longitude != null);
    const centroidLat = geo.length
      ? geo.reduce((sum, s) => sum + (s.latitude ?? 0), 0) / geo.length
      : null;
    const centroidLng = geo.length
      ? geo.reduce((sum, s) => sum + (s.longitude ?? 0), 0) / geo.length
      : null;
    return {
      pincode: group[0]?.pincode ?? null,
      pincodeId: group[0]?.pincodeId ?? null,
      stopCount: group.length,
      centroidLat,
      centroidLng,
    };
  });
}

async function assertRouteAccess(routeId: string, agent: RouteAgentContext) {
  const { data: route, error } = await supabase
    .from('agronomist_routes')
    .select('id, agent_type, agronomist_email, partner_id')
    .eq('id', routeId)
    .single();
  throwIfSupabaseError(error, 'Route not found');
  if (!route) throw new NotFoundError('Route not found');

  if (agent.agentType === 'agronomist') {
    const email = agent.email.trim().toLowerCase();
    if (String(route.agent_type ?? 'agronomist') !== 'agronomist' || String(route.agronomist_email ?? '').toLowerCase() !== email) {
      throw new AppError('Route access denied', 403, 'FORBIDDEN');
    }
    return;
  }

  if (String(route.agent_type) !== 'partner' || String(route.partner_id) !== agent.partnerId) {
    throw new AppError('Route access denied', 403, 'FORBIDDEN');
  }
}

export const routePlannerService = {
  async countRoutesToday(agent: RouteAgentContext): Promise<number> {
    const routeDate = todayIsoDate();
    let q = supabase
      .from('agronomist_routes')
      .select('id', { count: 'exact', head: true })
      .eq('route_date', routeDate);

    if (agent.agentType === 'agronomist') {
      q = q.eq('agent_type', 'agronomist').eq('agronomist_email', agent.email.trim().toLowerCase());
    } else {
      q = q.eq('agent_type', 'partner').eq('partner_id', agent.partnerId);
    }

    const { count, error } = await q;
    throwIfSupabaseError(error, 'Could not count routes');
    return count ?? 0;
  },

  async listRoutes(agent: RouteAgentContext, date?: string) {
    const routeDate = date ?? todayIsoDate();
    let q = supabase
      .from('agronomist_routes')
      .select('*')
      .eq('route_date', routeDate)
      .order('created_at', { ascending: false });

    if (agent.agentType === 'agronomist') {
      q = q.eq('agent_type', 'agronomist').eq('agronomist_email', agent.email.trim().toLowerCase());
    } else {
      q = q.eq('agent_type', 'partner').eq('partner_id', agent.partnerId);
    }

    const { data: routes, error } = await q;
    throwIfSupabaseError(error, 'Could not load routes');

    const summaries = await Promise.all(
      (routes ?? []).map((r) => this.getRouteSummary(String(r.id), agent))
    );
    return summaries;
  },

  async createRoute(agent: RouteAgentContext, routeName: string) {
    const insert =
      agent.agentType === 'agronomist'
        ? {
            agent_type: 'agronomist',
            agronomist_email: agent.email.trim().toLowerCase(),
            partner_id: null,
            route_name: routeName,
            route_date: todayIsoDate(),
            status: 'planned',
          }
        : {
            agent_type: 'partner',
            agronomist_email: null,
            partner_id: agent.partnerId,
            route_name: routeName,
            route_date: todayIsoDate(),
            status: 'planned',
          };

    const { data, error } = await supabase.from('agronomist_routes').insert(insert).select('*').single();
    throwIfSupabaseError(error, 'Could not create route');
    return this.getRouteSummary(String(data.id), agent);
  },

  async addStop(agent: RouteAgentContext, routeId: string, farmerId: string, blockId?: string) {
    await assertRouteAccess(routeId, agent);
    if (agent.agentType === 'partner') {
      await partnerMobileService.assertFarmerAccess(agent.partnerId, farmerId);
    }

    let dupQuery = supabase
      .from('agronomist_route_stops')
      .select('id')
      .eq('route_id', routeId)
      .eq('farmer_id', farmerId);
    dupQuery = blockId ? dupQuery.eq('block_id', blockId) : dupQuery.is('block_id', null);
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      return existing;
    }

    const { count } = await supabase
      .from('agronomist_route_stops')
      .select('id', { count: 'exact', head: true })
      .eq('route_id', routeId);
    const { data, error } = await supabase
      .from('agronomist_route_stops')
      .insert({
        route_id: routeId,
        farmer_id: farmerId,
        block_id: blockId ?? null,
        sort_order: count ?? 0,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not add stop');
    return data;
  },

  async optimizeRoute(agent: RouteAgentContext, routeId: string, originLat?: number, originLng?: number) {
    await assertRouteAccess(routeId, agent);
    const summary = await this.getRouteSummary(routeId, agent);
    if (summary.stops.length < 2) return summary;

    let lat =
      originLat ??
      summary.stops.find((s) => s.latitude != null)?.latitude ??
      summary.pincodeClusters.find((c) => c.centroidLat != null)?.centroidLat ??
      null;
    let lng =
      originLng ??
      summary.stops.find((s) => s.longitude != null)?.longitude ??
      summary.pincodeClusters.find((c) => c.centroidLng != null)?.centroidLng ??
      null;
    if (lat == null || lng == null) return summary;

    const forOptimize: StopForOptimize[] = summary.stops.map((s) => ({
      id: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      pincodeId: s.pincodeId,
      pincode: s.pincode,
    }));

    const { ordered, distanceKm } = optimizeClusteredStops(forOptimize, lat, lng);

    for (let i = 0; i < ordered.length; i++) {
      await supabase
        .from('agronomist_route_stops')
        .update({ sort_order: i })
        .eq('id', ordered[i]!.id);
    }

    const estimatedHours = Math.round((distanceKm / 25 + ordered.length * 0.25) * 10) / 10;
    await supabase
      .from('agronomist_routes')
      .update({
        estimated_distance_km: distanceKm,
        estimated_hours: estimatedHours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', routeId);

    return this.getRouteSummary(routeId, agent);
  },

  async getRouteSummary(routeId: string, agent?: RouteAgentContext) {
    if (agent) await assertRouteAccess(routeId, agent);

    const { data: route, error } = await supabase
      .from('agronomist_routes')
      .select('*')
      .eq('id', routeId)
      .single();
    throwIfSupabaseError(error, 'Route not found');
    if (!route) throw new NotFoundError('Route not found');

    const { data: stops, error: stopErr } = await supabase
      .from('agronomist_route_stops')
      .select('id, farmer_id, block_id, sort_order, farmers(name, phone)')
      .eq('route_id', routeId)
      .order('sort_order', { ascending: true });
    throwIfSupabaseError(stopErr, 'Could not load stops');

    const enriched = await Promise.all(
      (stops ?? []).map(async (s) => {
        const f = s.farmers as { name?: string; phone?: string } | null;
        const blockId = s.block_id ? String(s.block_id) : null;
        const loc = await resolveStopLocation(String(s.farmer_id), blockId);
        return {
          id: String(s.id),
          farmerId: String(s.farmer_id),
          farmerName: f?.name ?? f?.phone ?? 'Farmer',
          blockId,
          blockName: loc.blockName,
          sortOrder: Number(s.sort_order),
          latitude: loc.latitude,
          longitude: loc.longitude,
          coordSource: loc.coordSource,
          pincode: loc.pincode,
          pincodeId: loc.pincodeId,
        };
      })
    );

    return {
      id: String(route.id),
      routeName: String(route.route_name),
      routeDate: String(route.route_date),
      status: String(route.status),
      stopCount: enriched.length,
      estimatedDistanceKm: route.estimated_distance_km != null ? Number(route.estimated_distance_km) : null,
      estimatedHours: route.estimated_hours != null ? Number(route.estimated_hours) : null,
      pincodeClusters: buildPincodeClusters(enriched),
      stops: enriched,
    };
  },

  /** @deprecated Use listRoutes with agent context */
  async listRoutesForEmail(agentEmail: string, date?: string) {
    return this.listRoutes({ agentType: 'agronomist', email: agentEmail }, date);
  },

  async createRouteForEmail(agentEmail: string, routeName: string) {
    return this.createRoute({ agentType: 'agronomist', email: agentEmail }, routeName);
  },
};

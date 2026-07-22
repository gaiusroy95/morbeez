import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { blockService, blockDisplayName } from '../core/block.service.js';
import { isValidPlotCoordinate } from '../core/plot-location.service.js';
import { resolveCoords } from '../whatsapp/pipeline/weather-fetch.service.js';
import { partnerMobileService } from '../partner/partner-mobile.service.js';
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
function haversineKm(lat1, lng1, lat2, lng2) {
    const r = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function clusterKey(stop) {
    return stop.pincodeId ?? stop.pincode ?? 'unknown';
}
function hasCoords(s) {
    return s.latitude != null && s.longitude != null;
}
function nearestNeighborOrder(stops, originLat, originLng) {
    const withCoords = stops.filter(hasCoords);
    const withoutCoords = stops.filter((s) => !hasCoords(s));
    const remaining = [...withCoords];
    const ordered = [];
    let curLat = originLat;
    let curLng = originLng;
    let distanceKm = 0;
    while (remaining.length) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const s = remaining[i];
            const d = haversineKm(curLat, curLng, s.latitude, s.longitude);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        const next = remaining.splice(bestIdx, 1)[0];
        distanceKm += bestDist === Infinity ? 0 : bestDist;
        curLat = next.latitude;
        curLng = next.longitude;
        ordered.push(next);
    }
    return { ordered: [...ordered, ...withoutCoords], distanceKm };
}
function optimizeClusteredStops(stops, originLat, originLng) {
    if (stops.length <= 1)
        return { ordered: [...stops], distanceKm: 0 };
    const groups = new Map();
    for (const stop of stops) {
        const key = clusterKey(stop);
        const list = groups.get(key) ?? [];
        list.push(stop);
        groups.set(key, list);
    }
    const clusterNodes = [];
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
    const orderedClusters = [];
    let curLat = originLat;
    let curLng = originLng;
    let totalKm = 0;
    while (remainingClusters.length) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remainingClusters.length; i++) {
            const c = remainingClusters[i];
            const d = haversineKm(curLat, curLng, c.lat, c.lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        const next = remainingClusters.splice(bestIdx, 1)[0];
        totalKm += bestDist === Infinity ? 0 : bestDist;
        orderedClusters.push(next);
        curLat = next.lat;
        curLng = next.lng;
    }
    const ordered = [];
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
    return { ordered, distanceKm: Math.round(totalKm * 10) / 10 };
}
async function resolveStopLocation(farmerId, blockId) {
    let blockName = null;
    let pincodeId = null;
    let pincode = null;
    if (blockId) {
        const blocks = await blockService.listByFarmer(farmerId);
        const block = blocks.find((b) => b.id === blockId);
        if (block) {
            blockName = blockDisplayName(block);
            pincodeId = block.pincode_id;
            if (block.latitude != null &&
                block.longitude != null &&
                isValidPlotCoordinate(block.latitude, block.longitude)) {
                let pincode = null;
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
    const pm = farmer?.pincode_master;
    pincodeId = pincodeId ?? (farmer?.pincode_id ? String(farmer.pincode_id) : null);
    pincode = pm?.pincode ?? null;
    const hasPin = pm?.latitude != null &&
        pm?.longitude != null &&
        Number.isFinite(Number(pm.latitude)) &&
        Number.isFinite(Number(pm.longitude));
    const coords = resolveCoords({
        district: farmer?.district ? String(farmer.district) : pm?.district,
        pincodeLat: hasPin ? Number(pm.latitude) : null,
        pincodeLon: hasPin ? Number(pm.longitude) : null,
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
function buildPincodeClusters(stops) {
    const groups = new Map();
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
async function assertRouteAccess(routeId, agent) {
    const { data: route, error } = await supabase
        .from('agronomist_routes')
        .select('id, agent_type, agronomist_email, partner_id')
        .eq('id', routeId)
        .single();
    throwIfSupabaseError(error, 'Route not found');
    if (!route)
        throw new NotFoundError('Route not found');
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
    async countRoutesToday(agent) {
        const routeDate = todayIsoDate();
        let q = supabase
            .from('agronomist_routes')
            .select('id', { count: 'exact', head: true })
            .eq('route_date', routeDate);
        if (agent.agentType === 'agronomist') {
            q = q.eq('agent_type', 'agronomist').eq('agronomist_email', agent.email.trim().toLowerCase());
        }
        else {
            q = q.eq('agent_type', 'partner').eq('partner_id', agent.partnerId);
        }
        const { count, error } = await q;
        throwIfSupabaseError(error, 'Could not count routes');
        return count ?? 0;
    },
    async listRoutes(agent, date) {
        const routeDate = date ?? todayIsoDate();
        let q = supabase
            .from('agronomist_routes')
            .select('*')
            .eq('route_date', routeDate)
            .order('created_at', { ascending: false });
        if (agent.agentType === 'agronomist') {
            q = q.eq('agent_type', 'agronomist').eq('agronomist_email', agent.email.trim().toLowerCase());
        }
        else {
            q = q.eq('agent_type', 'partner').eq('partner_id', agent.partnerId);
        }
        const { data: routes, error } = await q;
        throwIfSupabaseError(error, 'Could not load routes');
        const summaries = await Promise.all((routes ?? []).map((r) => this.getRouteSummary(String(r.id), agent)));
        return summaries;
    },
    async createRoute(agent, routeName) {
        const insert = agent.agentType === 'agronomist'
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
        const { data, error } = await supabase
            .from('agronomist_routes')
            .insert(insert)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create route');
        return this.getRouteSummary(String(data.id), agent);
    },
    async addStop(agent, routeId, farmerId, blockId) {
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
    async optimizeRoute(agent, routeId, originLat, originLng) {
        await assertRouteAccess(routeId, agent);
        const summary = await this.getRouteSummary(routeId, agent);
        if (summary.stops.length < 2)
            return summary;
        let lat = originLat ??
            summary.stops.find((s) => s.latitude != null)?.latitude ??
            summary.pincodeClusters.find((c) => c.centroidLat != null)?.centroidLat ??
            null;
        let lng = originLng ??
            summary.stops.find((s) => s.longitude != null)?.longitude ??
            summary.pincodeClusters.find((c) => c.centroidLng != null)?.centroidLng ??
            null;
        if (lat == null || lng == null)
            return summary;
        const forOptimize = summary.stops.map((s) => ({
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
                .eq('id', ordered[i].id);
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
    async getRouteSummary(routeId, agent) {
        if (agent)
            await assertRouteAccess(routeId, agent);
        const { data: route, error } = await supabase
            .from('agronomist_routes')
            .select('*')
            .eq('id', routeId)
            .single();
        throwIfSupabaseError(error, 'Route not found');
        if (!route)
            throw new NotFoundError('Route not found');
        const { data: stops, error: stopErr } = await supabase
            .from('agronomist_route_stops')
            .select('id, farmer_id, block_id, sort_order, farmers(name, phone)')
            .eq('route_id', routeId)
            .order('sort_order', { ascending: true });
        throwIfSupabaseError(stopErr, 'Could not load stops');
        const enriched = await Promise.all((stops ?? []).map(async (s) => {
            const f = s.farmers;
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
        }));
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
    async listRoutesForEmail(agentEmail, date) {
        return this.listRoutes({ agentType: 'agronomist', email: agentEmail }, date);
    },
    async createRouteForEmail(agentEmail, routeName) {
        return this.createRoute({ agentType: 'agronomist', email: agentEmail }, routeName);
    },
};
//# sourceMappingURL=route-planner.service.js.map
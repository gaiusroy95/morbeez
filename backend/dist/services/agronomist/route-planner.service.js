import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { blockService } from '../core/block.service.js';
function haversineKm(lat1, lng1, lat2, lng2) {
    const r = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
export const routePlannerService = {
    async listRoutes(agentEmail, date) {
        const email = agentEmail.trim().toLowerCase();
        const routeDate = date ?? todayIsoDate();
        const { data: routes, error } = await supabase
            .from('agronomist_routes')
            .select('*')
            .eq('agronomist_email', email)
            .eq('route_date', routeDate)
            .order('created_at', { ascending: false });
        throwIfSupabaseError(error, 'Could not load routes');
        const summaries = await Promise.all((routes ?? []).map((r) => this.getRouteSummary(String(r.id))));
        return summaries;
    },
    async createRoute(agentEmail, routeName) {
        const { data, error } = await supabase
            .from('agronomist_routes')
            .insert({
            agronomist_email: agentEmail.trim().toLowerCase(),
            route_name: routeName,
            route_date: todayIsoDate(),
            status: 'planned',
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create route');
        return this.getRouteSummary(String(data.id));
    },
    async addStop(routeId, farmerId, blockId) {
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
    async optimizeRoute(routeId, originLat, originLng) {
        const summary = await this.getRouteSummary(routeId);
        if (summary.stops.length < 2)
            return summary;
        let lat = originLat ?? summary.stops.find((s) => s.latitude != null)?.latitude ?? null;
        let lng = originLng ?? summary.stops.find((s) => s.longitude != null)?.longitude ?? null;
        if (lat == null || lng == null)
            return summary;
        const remaining = [...summary.stops];
        const ordered = [];
        let curLat = lat;
        let curLng = lng;
        let totalKm = 0;
        while (remaining.length) {
            let bestIdx = 0;
            let bestDist = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const s = remaining[i];
                if (s.latitude == null || s.longitude == null)
                    continue;
                const d = haversineKm(curLat, curLng, s.latitude, s.longitude);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                }
            }
            const next = remaining.splice(bestIdx, 1)[0];
            if (next.latitude != null && next.longitude != null) {
                totalKm += haversineKm(curLat, curLng, next.latitude, next.longitude);
                curLat = next.latitude;
                curLng = next.longitude;
            }
            ordered.push(next);
        }
        for (let i = 0; i < ordered.length; i++) {
            await supabase
                .from('agronomist_route_stops')
                .update({ sort_order: i })
                .eq('id', ordered[i].id);
        }
        const estimatedHours = Math.round((totalKm / 25 + ordered.length * 0.25) * 10) / 10;
        await supabase
            .from('agronomist_routes')
            .update({
            estimated_distance_km: Math.round(totalKm * 10) / 10,
            estimated_hours: estimatedHours,
            updated_at: new Date().toISOString(),
        })
            .eq('id', routeId);
        return this.getRouteSummary(routeId);
    },
    async getRouteSummary(routeId) {
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
            let latitude = null;
            let longitude = null;
            if (s.block_id) {
                const blocks = await blockService.listByFarmer(String(s.farmer_id));
                const block = blocks.find((b) => b.id === String(s.block_id));
                latitude = block?.latitude ?? null;
                longitude = block?.longitude ?? null;
            }
            return {
                id: String(s.id),
                farmerId: String(s.farmer_id),
                farmerName: f?.name ?? f?.phone ?? 'Farmer',
                blockId: s.block_id ? String(s.block_id) : null,
                sortOrder: Number(s.sort_order),
                latitude,
                longitude,
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
            stops: enriched,
        };
    },
};
//# sourceMappingURL=route-planner.service.js.map
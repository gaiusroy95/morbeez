import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ValidationError } from '../../lib/errors.js';
import { resolveCoords } from '../whatsapp/pipeline/weather-fetch.service.js';

export type PlotLocationSource = 'field_pwa' | 'telecaller' | 'whatsapp' | 'api';

export type WeatherCoords = {
  lat: number;
  lon: number;
  label: string;
  coordSource: 'plot_gps' | 'pincode' | 'district';
};

/** Rough bounds for India (WGS84). */
export function isValidPlotCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= 6 && lat <= 37.5 && lon >= 68 && lon <= 97.5;
}

export const plotLocationService = {
  async updateBlockLocation(
    blockId: string,
    input: {
      latitude: number;
      longitude: number;
      source: PlotLocationSource;
      farmerId?: string;
    }
  ): Promise<void> {
    const lat = Number(input.latitude);
    const lon = Number(input.longitude);
    if (!isValidPlotCoordinate(lat, lon)) {
      throw new ValidationError('Invalid GPS coordinates for India region');
    }

    let q = supabase.from('farm_blocks').update({
      latitude: lat,
      longitude: lon,
      location_captured_at: new Date().toISOString(),
      location_source: input.source,
      updated_at: new Date().toISOString(),
    }).eq('id', blockId);

    if (input.farmerId) q = q.eq('farmer_id', input.farmerId);

    const { error } = await q;
    throwIfSupabaseError(error, 'Could not save plot GPS');
  },

  async resolveWeatherCoords(
    farmerId: string,
    blockId?: string | null
  ): Promise<WeatherCoords> {
    let plotBlockId = blockId ?? null;
    if (!plotBlockId) {
      const { data: primary } = await supabase
        .from('farm_blocks')
        .select('id')
        .eq('farmer_id', farmerId)
        .is('archived_at', null)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      plotBlockId = primary?.id ?? null;
    }

    if (plotBlockId) {
      const { data: block, error: blockErr } = await supabase
        .from('farm_blocks')
        .select('latitude, longitude, plot_label, name')
        .eq('id', plotBlockId)
        .eq('farmer_id', farmerId)
        .maybeSingle();
      throwIfSupabaseError(blockErr, 'Could not load plot location');

      if (
        block?.latitude != null &&
        block?.longitude != null &&
        isValidPlotCoordinate(Number(block.latitude), Number(block.longitude))
      ) {
        const label = String(block.plot_label ?? block.name ?? 'Plot');
        return {
          lat: Number(block.latitude),
          lon: Number(block.longitude),
          label: `Plot GPS — ${label}`,
          coordSource: 'plot_gps',
        };
      }
    }

    const { data: farmer, error } = await supabase
      .from('farmers')
      .select(
        'district, village, pincode_id, pincode_master(pincode, district, latitude, longitude, village)'
      )
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

    return {
      lat: coords.lat,
      lon: coords.lon,
      label: coords.label,
      coordSource: hasPin ? 'pincode' : 'district',
    };
  },
};

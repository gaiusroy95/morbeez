import { supabase } from '../../lib/supabase.js';
import { NotFoundError } from '../../lib/errors.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { computeDap } from '../whatsapp/broadcasts/dap.service.js';
import { plotLocationService, type PlotLocationSource } from './plot-location.service.js';

export type FarmBlockRow = {
  id: string;
  farmer_id: string;
  name: string;
  crop_type: string;
  crop_name: string | null;
  crop_category: string | null;
  crop_subtype: string | null;
  plot_label: string | null;
  variety_name: string | null;
  planting_date: string | null;
  stage: string | null;
  acreage_decimal: number | null;
  is_primary: boolean;
  pincode_id: string | null;
  irrigation_type: string | null;
  latitude: number | null;
  longitude: number | null;
  location_captured_at: string | null;
  location_source: string | null;
  created_at: string;
};

export type BlockWithDap = FarmBlockRow & { dap: number };

function mapBlock(row: Record<string, unknown>): FarmBlockRow {
  return {
    id: String(row.id),
    farmer_id: String(row.farmer_id),
    name: String(row.name),
    crop_type: String(row.crop_type ?? row.crop_name ?? 'ginger').toLowerCase(),
    crop_name: row.crop_name ? String(row.crop_name) : null,
    crop_category: row.crop_category ? String(row.crop_category) : null,
    crop_subtype: row.crop_subtype ? String(row.crop_subtype) : null,
    plot_label: row.plot_label ? String(row.plot_label) : null,
    variety_name: row.variety_name ? String(row.variety_name) : null,
    planting_date: row.planting_date ? String(row.planting_date).slice(0, 10) : null,
    stage: row.stage ? String(row.stage) : null,
    acreage_decimal: row.acreage_decimal != null ? Number(row.acreage_decimal) : null,
    is_primary: Boolean(row.is_primary),
    pincode_id: row.pincode_id ? String(row.pincode_id) : null,
    irrigation_type: row.irrigation_type ? String(row.irrigation_type) : null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    location_captured_at: row.location_captured_at ? String(row.location_captured_at) : null,
    location_source: row.location_source ? String(row.location_source) : null,
    created_at: String(row.created_at),
  };
}

export function blockDisplayName(block: FarmBlockRow): string {
  return block.plot_label || block.name || block.crop_name || block.crop_type;
}

export const blockService = {
  computeDap(block: Pick<FarmBlockRow, 'planting_date' | 'created_at'>): number {
    return computeDap(block.planting_date, block.created_at);
  },

  withDap(block: FarmBlockRow): BlockWithDap {
    return { ...block, dap: this.computeDap(block) };
  },

  async listByFarmer(farmerId: string): Promise<BlockWithDap[]> {
    const { data, error } = await supabase
      .from('farm_blocks')
      .select('*')
      .eq('farmer_id', farmerId)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throwIfSupabaseError(error, 'Could not list farm blocks');
    return (data ?? []).map((r) => this.withDap(mapBlock(r)));
  },

  async getById(blockId: string, farmerId?: string): Promise<BlockWithDap | null> {
    let q = supabase.from('farm_blocks').select('*').eq('id', blockId);
    if (farmerId) q = q.eq('farmer_id', farmerId);
    const { data, error } = await q.maybeSingle();
    if (error) throwIfSupabaseError(error, 'Could not load farm block');
    if (!data) return null;
    return this.withDap(mapBlock(data));
  },

  async getPrimaryBlock(farmerId: string): Promise<BlockWithDap | null> {
    const { data, error } = await supabase
      .from('farm_blocks')
      .select('*')
      .eq('farmer_id', farmerId)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.withDap(mapBlock(data));
  },

  async ensureDefaultBlock(farmerId: string, cropType = 'ginger'): Promise<BlockWithDap> {
    const existing = await this.getPrimaryBlock(farmerId);
    if (existing) return existing;

    const { data, error } = await supabase
      .from('farm_blocks')
      .insert({
        farmer_id: farmerId,
        name: `${cropType.charAt(0).toUpperCase()}${cropType.slice(1)} Block`,
        crop_name: cropType,
        crop_type: cropType.toLowerCase(),
        is_primary: true,
        planting_date: null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return this.withDap(mapBlock(data));
  },

  async createBlock(
    farmerId: string,
    input: {
      name: string;
      cropType: string;
      cropCategory?: string;
      cropSubtype?: string;
      varietyName?: string;
      plantingDate?: string;
      acreage?: number;
      irrigationType?: string;
      pincodeId?: string;
      plotLabel?: string;
      isPrimary?: boolean;
      stage?: string;
    }
  ): Promise<BlockWithDap> {
    if (input.isPrimary) {
      await supabase
        .from('farm_blocks')
        .update({ is_primary: false })
        .eq('farmer_id', farmerId);
    }

    const { data, error } = await supabase
      .from('farm_blocks')
      .insert({
        farmer_id: farmerId,
        name: input.name,
        crop_name: input.cropType,
        crop_type: input.cropType.toLowerCase(),
        crop_category: input.cropCategory ?? null,
        crop_subtype: input.cropSubtype ?? null,
        variety_name: input.varietyName ?? null,
        planting_date: input.plantingDate ?? new Date().toISOString().slice(0, 10),
        acreage_decimal: input.acreage ?? null,
        irrigation_type: input.irrigationType ?? null,
        pincode_id: input.pincodeId ?? null,
        plot_label: input.plotLabel ?? null,
        is_primary: input.isPrimary ?? false,
        stage: input.stage ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return this.withDap(mapBlock(data));
  },

  async updatePlotLocation(
    blockId: string,
    input: {
      latitude: number;
      longitude: number;
      source: PlotLocationSource;
      farmerId?: string;
    }
  ): Promise<BlockWithDap> {
    await plotLocationService.updateBlockLocation(blockId, {
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source,
      farmerId: input.farmerId,
    });
    const row = input.farmerId
      ? await this.getById(blockId, input.farmerId)
      : await this.getById(blockId);
    if (!row) throw new NotFoundError('Block not found after GPS update');
    return row;
  },

  async updateBlock(
    blockId: string,
    farmerId: string,
    patch: {
      name?: string;
      cropType?: string;
      acreage?: number;
      plantingDate?: string;
      irrigationType?: string;
    }
  ): Promise<BlockWithDap> {
    const existing = await this.getById(blockId, farmerId);
    if (!existing) throw new NotFoundError('Field not found');

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name != null) update.name = patch.name;
    if (patch.cropType != null) {
      update.crop_type = patch.cropType.toLowerCase();
      update.crop_name = patch.cropType;
    }
    if (patch.acreage != null) update.acreage_decimal = patch.acreage;
    if (patch.plantingDate != null) update.planting_date = patch.plantingDate;
    if (patch.irrigationType != null) update.irrigation_type = patch.irrigationType;

    const { data, error } = await supabase
      .from('farm_blocks')
      .update(update)
      .eq('id', blockId)
      .eq('farmer_id', farmerId)
      .select('*')
      .single();
    if (error) throw error;
    return this.withDap(mapBlock(data));
  },
};

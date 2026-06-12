import { supabase } from '../../../lib/supabase.js';
import { computeDap } from './dap.service.js';

export type BroadcastVariableContext = {
  farmerName: string;
  crop: string;
  dap: string;
  village: string;
  farmArea: string;
  district: string;
};

const PLACEHOLDER_RE = /\{\{\s*(FarmerName|Crop|DAP|Village|FarmArea|District)\s*\}\}/gi;

export async function loadFarmerVariableContext(farmerId: string): Promise<BroadcastVariableContext> {
  const [{ data: farmer }, { data: block }] = await Promise.all([
    supabase
      .from('farmers')
      .select('name, first_name, last_name, village, district')
      .eq('id', farmerId)
      .maybeSingle(),
    supabase
      .from('farm_blocks')
      .select('crop_type, planting_date, acreage_decimal, plot_label, name')
      .eq('farmer_id', farmerId)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const name =
    [farmer?.first_name, farmer?.last_name].filter(Boolean).join(' ').trim() ||
    String(farmer?.name ?? '').trim() ||
    'Farmer';

  const crop = String(block?.crop_type ?? 'crop');
  const dap =
    block?.planting_date != null
      ? String(computeDap(String(block.planting_date)))
      : '—';

  return {
    farmerName: name,
    crop,
    dap,
    village: farmer?.village ? String(farmer.village) : '—',
    farmArea: block?.acreage_decimal != null ? String(block.acreage_decimal) : '—',
    district: farmer?.district ? String(farmer.district) : '—',
  };
}

export function renderBroadcastMessage(template: string, ctx: BroadcastVariableContext): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const k = key.toLowerCase();
    if (k === 'farmername') return ctx.farmerName;
    if (k === 'crop') return ctx.crop;
    if (k === 'dap') return ctx.dap;
    if (k === 'village') return ctx.village;
    if (k === 'farmarea') return ctx.farmArea;
    if (k === 'district') return ctx.district;
    return '';
  });
}

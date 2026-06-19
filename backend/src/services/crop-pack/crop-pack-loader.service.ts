import { supabase } from '../../lib/supabase.js';
import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import { GINGER_PACK } from '../../domain/crop-pack/packs/ginger.pack.js';
import { DEFAULT_PACK } from '../../domain/crop-pack/packs/default.pack.js';
import { BANANA_PACK } from '../../domain/crop-pack/packs/banana.pack.js';

const BUILTIN: Record<string, CropPackConfig> = {
  ginger: GINGER_PACK,
  banana: BANANA_PACK,
  _default: DEFAULT_PACK,
};

function normalizeCropKey(cropType: string): string {
  return cropType.toLowerCase().trim().replace(/\s+/g, '_');
}

function matchBuiltin(cropType: string): CropPackConfig | null {
  const key = normalizeCropKey(cropType);
  if (BUILTIN[key]) return BUILTIN[key];
  if (key.includes('ginger')) return BUILTIN.ginger!;
  if (key.includes('banana')) return BUILTIN.banana!;
  return null;
}

export const cropPackLoaderService = {
  normalizeCropKey,

  builtinPacks(): CropPackConfig[] {
    return Object.values(BUILTIN);
  },

  async load(cropType: string): Promise<CropPackConfig> {
    const key = normalizeCropKey(cropType);
    const { data } = await supabase
      .from('crop_packs')
      .select('config')
      .eq('crop_type', key)
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.config && typeof data.config === 'object') {
      return data.config as CropPackConfig;
    }

    return matchBuiltin(cropType) ?? DEFAULT_PACK;
  },

  whatsappSlotOrder(pack: CropPackConfig): string[] {
    return [...pack.photoSlots]
      .sort((a, b) => a.whatsappPriority - b.whatsappPriority)
      .map((s) => s.id);
  },

  nextMissingSlots(pack: CropPackConfig, captured: string[], limit = 3) {
    const have = new Set(captured);
    return pack.photoSlots
      .filter((s) => !have.has(s.id))
      .sort((a, b) => a.whatsappPriority - b.whatsappPriority)
      .slice(0, limit);
  },

  moduleWeights(pack: CropPackConfig): Record<string, number> {
    const defaults = DEFAULT_PACK.moduleWeights ?? {};
    return { ...defaults, ...pack.moduleWeights };
  },
};

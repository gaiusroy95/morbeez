import type { GingerPhotoSlotId } from './types.js';

export type GingerPhotoSlotDef = {
  id: GingerPhotoSlotId;
  group: 'farm' | 'canopy' | 'leaf' | 'root';
  labelEn: string;
  labelMl: string;
  whatsappPriority: number;
};

/** Standardized 12-photo ginger capture protocol (SOP Phase 3). */
export const GINGER_PHOTO_SLOTS: GingerPhotoSlotDef[] = [
  { id: 'field_wide', group: 'farm', labelEn: 'Full field wide', labelMl: 'മുഴുവൻ വയൽ', whatsappPriority: 8 },
  { id: 'affected_zone', group: 'farm', labelEn: 'Affected zone', labelMl: 'ബാധിത ഭാഗം', whatsappPriority: 4 },
  { id: 'healthy_zone', group: 'farm', labelEn: 'Healthy zone', labelMl: 'ആരോഗ്യമുള്ള ഭാഗം', whatsappPriority: 9 },
  { id: 'canopy_top', group: 'canopy', labelEn: 'Top view', labelMl: 'മുകളിൽ നിന്ന്', whatsappPriority: 10 },
  { id: 'canopy_side', group: 'canopy', labelEn: 'Side view', labelMl: 'വശത്ത് നിന്ന്', whatsappPriority: 11 },
  { id: 'bed_bottom', group: 'canopy', labelEn: 'Bed bottom view', labelMl: 'തടി താഴെ', whatsappPriority: 12 },
  { id: 'new_leaf_close', group: 'leaf', labelEn: 'New leaf close-up', labelMl: 'പുതിയ ഇല അടുത്ത്', whatsappPriority: 1 },
  { id: 'old_leaf_close', group: 'leaf', labelEn: 'Old leaf close-up', labelMl: 'പഴയ ഇല അടുത്ത്', whatsappPriority: 2 },
  { id: 'leaf_underside', group: 'leaf', labelEn: 'Leaf underside', labelMl: 'ഇലയുടെ അടിവശം', whatsappPriority: 3 },
  { id: 'root_photo', group: 'root', labelEn: 'Root photo', labelMl: 'വേര് ഫോട്ടോ', whatsappPriority: 5 },
  { id: 'rhizome_outside', group: 'root', labelEn: 'Rhizome outside', labelMl: 'റൈസോം പുറത്ത്', whatsappPriority: 6 },
  { id: 'rhizome_cut', group: 'root', labelEn: 'Rhizome cut open', labelMl: 'റൈസോം മുറിച്ചത്', whatsappPriority: 7 },
];

export const GINGER_MODULE_WEIGHTS: Record<
  import('./types.js').GingerModuleKey,
  number
> = {
  geo: 5,
  photo: 15,
  canopy: 10,
  field: 10,
  root: 25,
  soil: 10,
  water: 10,
  history: 10,
  weather: 5,
};

/** WhatsApp progressive capture order (highest value slots first). */
export function whatsappSlotAssignmentOrder(): GingerPhotoSlotId[] {
  return [...GINGER_PHOTO_SLOTS]
    .sort((a, b) => a.whatsappPriority - b.whatsappPriority)
    .map((s) => s.id);
}

export function nextMissingWhatsappSlots(
  captured: GingerPhotoSlotId[],
  limit = 3
): GingerPhotoSlotDef[] {
  const have = new Set(captured);
  return GINGER_PHOTO_SLOTS.filter((s) => !have.has(s.id))
    .sort((a, b) => a.whatsappPriority - b.whatsappPriority)
    .slice(0, limit);
}

import type { CropPackConfig } from '../types.js';
import { DEFAULT_PACK } from './default.pack.js';

export const BANANA_PACK: CropPackConfig = {
  ...DEFAULT_PACK,
  cropType: 'banana',
  version: '12.0',
  displayName: 'Banana',
  photoSlots: [
    ...DEFAULT_PACK.photoSlots,
    { id: 'pseudostem_close', group: 'leaf', labelEn: 'Pseudostem close-up', labelMl: 'തണ്ട് അടുത്ത്', whatsappPriority: 9, conditional: true },
    { id: 'fruit_bunch', group: 'fruit', labelEn: 'Fruit bunch', labelMl: 'പഴം കുല', whatsappPriority: 10, conditional: true },
  ],
  measurementKeys: ['spad', 'plant_height', 'pseudostem_girth', 'leaf_count'],
  moduleWeights: { ...DEFAULT_PACK.moduleWeights, root: 10, canopy: 12 },
};

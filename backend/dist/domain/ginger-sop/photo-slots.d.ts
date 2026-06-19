import type { GingerPhotoSlotId } from './types.js';
export type GingerPhotoSlotDef = {
    id: GingerPhotoSlotId;
    group: 'farm' | 'canopy' | 'leaf' | 'root';
    labelEn: string;
    labelMl: string;
    whatsappPriority: number;
};
/** Standardized 12-photo ginger capture protocol (SOP Phase 3). */
export declare const GINGER_PHOTO_SLOTS: GingerPhotoSlotDef[];
export declare const GINGER_MODULE_WEIGHTS: Record<import('./types.js').GingerModuleKey, number>;
/** WhatsApp progressive capture order (highest value slots first). */
export declare function whatsappSlotAssignmentOrder(): GingerPhotoSlotId[];
export declare function nextMissingWhatsappSlots(captured: GingerPhotoSlotId[], limit?: number): GingerPhotoSlotDef[];
//# sourceMappingURL=photo-slots.d.ts.map
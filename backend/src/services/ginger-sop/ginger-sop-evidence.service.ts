import type {
  GingerPhotoEvidence,
  GingerPhotoSlotId,
  GingerSopChannel,
} from '../../domain/ginger-sop/types.js';
import {
  GINGER_PHOTO_SLOTS,
  whatsappSlotAssignmentOrder,
} from '../../domain/ginger-sop/photo-slots.js';

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function inferSlotFromCaption(caption: string | undefined): GingerPhotoSlotId | null {
  if (!caption?.trim()) return null;
  const t = caption.toLowerCase();
  if (/root|വേര|வேர்|ಬೇರು|जड़/.test(t)) return 'root_photo';
  if (/rhizome|റൈസോം|राइजोम/.test(t)) return 'rhizome_outside';
  if (/underside|അടിവശ|அடி|नीचे/.test(t)) return 'leaf_underside';
  if (/healthy|ആരോഗ്യ|ஆரோக்கிய|healthy/.test(t)) return 'healthy_zone';
  if (/field|വയൽ|வயல்|खेत/.test(t)) return 'field_wide';
  if (/affected|ബാധ|பாதிப்ப|बाढ़/.test(t)) return 'affected_zone';
  return null;
}

function baseQualityForChannel(channel: GingerSopChannel): number {
  if (channel === 'field_visit') return 85;
  if (channel === 'whatsapp') return 62;
  return 70;
}

export const gingerSopEvidenceService = {
  assignPhotosToSlots(params: {
    photoCount: number;
    channel: GingerSopChannel;
    storagePaths?: string[];
    captions?: string[];
    existingSlots?: GingerPhotoSlotId[];
  }): GingerPhotoEvidence[] {
    const order = whatsappSlotAssignmentOrder();
    const used = new Set<GingerPhotoSlotId>(params.existingSlots ?? []);
    const captured: GingerPhotoEvidence[] = [];

    for (let i = 0; i < params.photoCount; i++) {
      const captionSlot = inferSlotFromCaption(params.captions?.[i]);
      let slot: GingerPhotoSlotId | null = captionSlot;
      if (!slot || used.has(slot)) {
        slot = order.find((s) => !used.has(s)) ?? null;
      }
      if (!slot) break;
      used.add(slot);
      captured.push({
        slot,
        status: 'captured',
        qualityScore: clamp(baseQualityForChannel(params.channel) - i * 2),
        storagePath: params.storagePaths?.[i],
      });
    }

    const allSlots = GINGER_PHOTO_SLOTS.map((def) => {
      const hit = captured.find((c) => c.slot === def.id);
      if (hit) return hit;
      return {
        slot: def.id,
        status: 'missing' as const,
        qualityScore: 0,
      };
    });

    return allSlots;
  },

  completenessPct(photos: GingerPhotoEvidence[]): number {
    const captured = photos.filter((p) => p.status === 'captured');
    if (!captured.length) return 0;
    const weightSum = captured.reduce((sum, p) => sum + p.qualityScore, 0);
    const maxWeight = GINGER_PHOTO_SLOTS.length * 100;
    return clamp(Math.round((weightSum / maxWeight) * 100 + captured.length * 4));
  },

  evidenceTier(
    completenessPct: number,
    hasSoil: boolean,
    hasRootPhoto: boolean,
    hasFieldMetrics: boolean
  ): 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' {
    if (hasFieldMetrics && hasSoil && hasRootPhoto && completenessPct >= 75) return 'T5';
    if (hasSoil && hasRootPhoto && completenessPct >= 50) return 'T4';
    if (hasRootPhoto && completenessPct >= 35) return 'T3';
    if (hasSoil && completenessPct >= 25) return 'T2';
    if (completenessPct >= 15) return 'T1';
    return 'T0';
  },

  missingSlotPrompt(language: string, slots: GingerPhotoSlotId[]): string {
    const defs = GINGER_PHOTO_SLOTS.filter((s) => slots.includes(s.id));
    const lines = defs.map((d) => (language === 'ml' ? d.labelMl : d.labelEn));
    if (language === 'ml') {
      return `കൂടുതൽ വ്യക്തതയ്ക്ക് ഈ ഫോട്ടോകൾ അയയ്ക്കുക:\n• ${lines.join('\n• ')}`;
    }
    return `For a stronger diagnosis, please send:\n• ${lines.join('\n• ')}`;
  },
};

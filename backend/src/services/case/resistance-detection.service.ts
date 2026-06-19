import { supabase } from '../../lib/supabase.js';
import type { MaiosInputHistorySummary } from '../../domain/case/types.js';

const QOI_PATTERN = /azox|triflox|difenoconazole|tebuconazole|mancozeb/i;

export const resistanceDetectionService = {
  async score(params: {
    farmerId: string;
    blockId?: string | null;
    inputHistory?: MaiosInputHistorySummary;
  }): Promise<{ score: number; classes: string[] }> {
    const warnings: string[] = [];
    const sprays = params.inputHistory?.entries.filter((e) => e.activityType === 'spray_applied') ?? [];

    if (sprays.length >= 4) {
      warnings.push('high_spray_frequency');
    }

    const qoiSprays = sprays.filter((s) => s.products.some((p) => QOI_PATTERN.test(p)));
    if (qoiSprays.length >= 2) warnings.push('qoi_rotation_risk');

    const { data: groups } = await supabase
      .from('resistance_rotation_groups')
      .select('mode_of_action, technical_name')
      .eq('crop_type', 'ginger')
      .limit(50);

    const classes = new Set<string>();
    for (const spray of sprays) {
      for (const product of spray.products) {
        const match = (groups ?? []).find(
          (g) =>
            product.toLowerCase().includes(String(g.technical_name).toLowerCase().slice(0, 6)) ||
            String(g.technical_name).toLowerCase().includes(product.toLowerCase().slice(0, 6))
        );
        if (match?.mode_of_action) classes.add(String(match.mode_of_action));
      }
    }

    let score = 15;
    score += Math.min(40, sprays.length * 8);
    score += qoiSprays.length >= 2 ? 25 : 0;
    score += classes.size >= 2 ? 15 : 0;

    return {
      score: Math.min(100, score),
      classes: [...classes, ...warnings],
    };
  },
};

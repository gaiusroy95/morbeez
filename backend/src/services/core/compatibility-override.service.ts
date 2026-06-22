import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export type CompatibilityOverridePair = {
  productA: string;
  productB: string;
  status?: string;
  compatible?: boolean | null;
};

export const compatibilityOverrideService = {
  async logApproval(input: {
    fieldFindingId: string;
    farmerId: string;
    blockId?: string | null;
    approvedBy: string;
    overrideReason: string;
    incompatiblePairs?: CompatibilityOverridePair[];
    materials?: Array<{ technicalName: string }>;
  }): Promise<void> {
    const reason = input.overrideReason.trim();
    if (!reason.length) return;

    const { error } = await supabase.from('compatibility_override_log').insert({
      field_finding_id: input.fieldFindingId,
      farmer_id: input.farmerId,
      block_id: input.blockId ?? null,
      approved_by: input.approvedBy.trim().toLowerCase(),
      override_reason: reason.slice(0, 2000),
      incompatible_pairs: input.incompatiblePairs ?? [],
      materials: input.materials ?? [],
    });
    throwIfSupabaseError(error, 'Could not log compatibility override');
  },

  async listAggregates(days = 90): Promise<{
    totalOverrides: number;
    byPair: Array<{ productA: string; productB: string; count: number }>;
    unknownPairRate: number;
    unknownPairChecks: number;
    unknownPairHits: number;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('compatibility_override_log')
      .select('incompatible_pairs, created_at')
      .gte('created_at', since)
      .limit(500);
    throwIfSupabaseError(error, 'Could not load override log');

    const pairCounts = new Map<string, { productA: string; productB: string; count: number }>();
    let unknownHits = 0;
    let unknownChecks = 0;

    for (const row of data ?? []) {
      const pairs = (row.incompatible_pairs as CompatibilityOverridePair[]) ?? [];
      for (const p of pairs) {
        const key = `${p.productA}::${p.productB}`;
        const prev = pairCounts.get(key) ?? { productA: p.productA, productB: p.productB, count: 0 };
        prev.count++;
        pairCounts.set(key, prev);
        if (p.status === 'unknown' || p.status === 'not_in_database') {
          unknownHits++;
        }
        unknownChecks++;
      }
    }

    const { count: sprayRuleCount } = await supabase
      .from('spray_compatibility_rules')
      .select('id', { count: 'exact', head: true });

    const totalOverrides = data?.length ?? 0;
    const unknownPairRate =
      unknownChecks > 0 ? Math.round((unknownHits / unknownChecks) * 1000) / 10 : 0;

    return {
      totalOverrides,
      byPair: [...pairCounts.values()].sort((a, b) => b.count - a.count).slice(0, 20),
      unknownPairRate,
      unknownPairChecks: unknownChecks,
      unknownPairHits: unknownHits,
      ...(sprayRuleCount != null ? {} : {}),
    };
  },
};

import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { blockService, blockDisplayName } from '../core/block.service.js';
import { cropSeasonService } from './crop-season.service.js';

function growthStageLabel(stage: string | null | undefined, dap: number | null): string {
  if (stage?.trim()) return stage.trim();
  if (dap == null) return 'Growing';
  if (dap < 30) return 'Establishment';
  if (dap < 60) return 'Tillering';
  if (dap < 90) return 'Vegetative';
  if (dap < 120) return 'Maturity';
  return 'Late season';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

export const roiAggregationService = {
  async resolveActiveSeasonIds(
    farmerId: string,
    filter: { crop?: string | null; blockId?: string | null }
  ): Promise<string[]> {
    let q = supabase
      .from('crop_seasons')
      .select('id, block_id, crop')
      .eq('farmer_id', farmerId)
      .eq('season_status', 'active');

    if (filter.blockId) q = q.eq('block_id', filter.blockId);
    if (filter.crop) q = q.ilike('crop', filter.crop);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load active seasons');
    return (data ?? []).map((r) => String(r.id));
  },

  async getSummary(farmerId: string, filter: { crop?: string | null; blockId?: string | null }) {
    const blocks = await blockService.listByFarmer(farmerId).then((rows) =>
      rows.map((b) => ({
        id: b.id,
        name: blockDisplayName(b),
        crop: b.crop_type,
        acreage: b.acreage_decimal,
        plantingDate: b.planting_date,
        stage: b.stage,
      }))
    );
    const crops = [...new Set(blocks.map((b) => b.crop).filter(Boolean))];
    const visibility = {
      showCropFilter: crops.length > 1,
      showBlockFilter: blocks.length > 1,
      showExpenseBook: crops.length > 1 || blocks.length > 1,
    };

    const seasonIds = await this.resolveActiveSeasonIds(farmerId, filter);

    let expenseInr = 0;
    let incomeInr = 0;
    const breakdown: Record<string, { value: number; color: string }> = {};
    const recentRows: Array<{
      id: string;
      date: string;
      entry_type: string;
      amount_inr: number;
      comments: string | null;
      income_subtype: string | null;
      season_id: string | null;
      block_id: string | null;
      category_id: string | null;
      label: string;
    }> = [];

    for (const seasonId of seasonIds) {
      const season = await cropSeasonService.getSeasonForFarmer(farmerId, seasonId);
      expenseInr += season.total_expense;
      incomeInr += season.total_income;

      const { data: entries } = await supabase
        .from('farmer_roi_entries')
        .select(
          'id, entry_date, entry_type, amount_inr, debit_inr, credit_inr, comments, income_subtype, season_id, block_id, category_id, roi_expense_types(expense_name, color), farmer_roi_categories(name, color)'
        )
        .eq('season_id', seasonId)
        .order('entry_date', { ascending: false })
        .limit(20);

      for (const e of entries ?? []) {
        const isIncome = e.entry_type === 'harvest' || e.entry_type === 'income';
        const amt = Number(e.amount_inr ?? 0);
        if (!isIncome) {
          const cat =
            (e.farmer_roi_categories as { name?: string; color?: string } | null) ??
            (e.roi_expense_types as { expense_name?: string; color?: string } | null);
          const label = cat?.name ?? String(e.entry_type);
          const color = cat?.color ?? '#757575';
          breakdown[label] = breakdown[label] ?? { value: 0, color };
          breakdown[label].value += e.debit_inr != null ? Number(e.debit_inr) : amt;
        }
        recentRows.push({
          id: String(e.id),
          date: String(e.entry_date).slice(0, 10),
          entry_type: String(e.entry_type),
          amount_inr: amt,
          comments: e.comments ? String(e.comments) : null,
          income_subtype: e.income_subtype ? String(e.income_subtype) : null,
          season_id: e.season_id ? String(e.season_id) : null,
          block_id: e.block_id ? String(e.block_id) : null,
          category_id: e.category_id ? String(e.category_id) : null,
          label:
            (e.farmer_roi_categories as { name?: string } | null)?.name ??
            (e.roi_expense_types as { expense_name?: string } | null)?.expense_name ??
            String(e.entry_type),
        });
      }
    }

    recentRows.sort((a, b) => b.date.localeCompare(a.date));

    const hasIncome = incomeInr > 0;
    const profitInr = hasIncome ? incomeInr - expenseInr : null;
    const fixedRoi =
      hasIncome && expenseInr > 0 && profitInr != null
        ? Math.round((profitInr / expenseInr) * 100)
        : null;

    let harvestCount = 0;
    let totalQtyKg = 0;
    let totalHarvestIncome = 0;
    const rates: number[] = [];

    if (seasonIds.length) {
      const { data: harvests } = await supabase
        .from('harvest_records')
        .select('yield_kg, selling_price_per_kg, total_income_inr')
        .in('season_id', seasonIds);
      for (const h of harvests ?? []) {
        harvestCount += 1;
        totalQtyKg += Number(h.yield_kg ?? 0);
        totalHarvestIncome += Number(h.total_income_inr ?? 0);
        rates.push(Number(h.selling_price_per_kg ?? 0));
      }
    }

    const primaryBlock = filter.blockId
      ? blocks.find((b) => b.id === filter.blockId)
      : blocks[0];
    const primaryCrop = filter.crop ?? primaryBlock?.crop ?? crops[0] ?? 'Crop';
    const primarySeasonId = seasonIds[0] ?? null;
    let cropStatus = null;
    if (primaryBlock && primarySeasonId) {
      const block = await blockService.getById(primaryBlock.id, farmerId);
      const dap = block ? blockService.computeDap(block) : 0;
      cropStatus = {
        crop: primaryCrop,
        blockId: primaryBlock.id,
        blockName: primaryBlock.name,
        acreage: primaryBlock.acreage,
        plantingDate: primaryBlock.plantingDate,
        dap,
        stageLabel: growthStageLabel(primaryBlock.stage, dap),
        dapMax: 120,
        seasonId: primarySeasonId,
        seasonStatus: 'active',
      };
    }

    return {
      visibility,
      cropCount: crops.length,
      blockCount: blocks.length,
      crops,
      blocks: blocks.map((b) => ({ id: b.id, name: b.name, crop: b.crop })),
      filter: { crop: filter.crop ?? null, blockId: filter.blockId ?? null },
      cropStatus,
      financial: {
        expenseInr,
        incomeInr,
        profitInr,
        roiPercent: fixedRoi,
        hasIncome,
        profitMessage: hasIncome ? null : 'Profit & ROI available after first harvest sale',
      },
      harvestSummary: {
        harvestCount,
        totalQtyKg,
        totalIncomeInr: totalHarvestIncome || incomeInr,
        averageRatePerKg: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
        bestRatePerKg: rates.length ? Math.max(...rates) : null,
        lowestRatePerKg: rates.length ? Math.min(...rates) : null,
      },
      breakdown: Object.entries(breakdown).map(([label, v]) => ({
        label,
        value: v.value,
        color: v.color,
      })),
      recentTransactions: recentRows.slice(0, 15).map((e) => {
        const isIncome = e.entry_type === 'harvest' || e.entry_type === 'income';
        return {
          id: e.id,
          date: e.date,
          dateLabel: formatDate(e.date),
          type: isIncome ? ('income' as const) : ('expense' as const),
          entryType: e.entry_type,
          incomeSubtype: e.income_subtype,
          label: e.label,
          amountInr: e.amount_inr,
          signedAmountInr: isIncome ? e.amount_inr : -e.amount_inr,
          note: e.comments,
          seasonId: e.season_id,
          blockId: e.block_id,
          categoryId: e.category_id,
        };
      }),
      activeSeasonIds: seasonIds,
    };
  },

  async getContext(farmerId: string, filter: { crop?: string | null; blockId?: string | null }) {
    const blocks = await blockService.listByFarmer(farmerId).then((rows) =>
      rows.map((b) => ({
        id: b.id,
        name: blockDisplayName(b),
        crop: b.crop_type,
        acreage: b.acreage_decimal,
        plantingDate: b.planting_date,
        stage: b.stage,
      }))
    );
    const crop = filter.crop ?? (filter.blockId ? blocks.find((b) => b.id === filter.blockId)?.crop : blocks[0]?.crop) ?? '';
    const blocksForCrop = blocks.filter((b) => !crop || b.crop.toLowerCase() === crop.toLowerCase());
    const blockId = filter.blockId ?? blocksForCrop[0]?.id ?? blocks[0]?.id ?? '';
    const blockName = blocks.find((b) => b.id === blockId)?.name ?? '';

    let seasonId: string | null = null;
    if (blockId) {
      const { data } = await supabase
        .from('crop_seasons')
        .select('id')
        .eq('farmer_id', farmerId)
        .eq('block_id', blockId)
        .eq('season_status', 'active')
        .maybeSingle();
      seasonId = data?.id ? String(data.id) : null;
    }

    const categories = await cropSeasonService.listCategories(farmerId);

    return {
      filter: { crop: crop || null, blockId: blockId || null },
      crop,
      blockId,
      blockName,
      seasonId,
      blocksForCrop: blocksForCrop.map((b) => ({ id: b.id, name: b.name, crop: b.crop })),
      categories,
      incomeSubtypes: [
        { id: 'harvest_sale', label: 'Harvest Sale' },
        { id: 'advance', label: 'Advance Payment' },
        { id: 'subsidy', label: 'Subsidy' },
        { id: 'other', label: 'Other Income' },
      ],
    };
  },
};

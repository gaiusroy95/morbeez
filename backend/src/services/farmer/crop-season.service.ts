import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { blockService, blockDisplayName } from '../core/block.service.js';
import { roiFlowService, type RoiEntryType } from '../whatsapp/roi/roi-flow.service.js';

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
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function seasonLabelFromDates(startDate: string, crop: string): string {
  const y = new Date(startDate).getFullYear();
  return `${y} ${crop.charAt(0).toUpperCase()}${crop.slice(1)} Season`;
}

function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

type SeasonRow = {
  id: string;
  farmer_id: string;
  block_id: string;
  crop: string;
  acreage: number | null;
  start_date: string;
  end_date: string | null;
  dap: number | null;
  total_expense: number;
  total_income: number;
  net_profit: number;
  final_yield_kg: number | null;
  expected_income_inr: number | null;
  market_note: string | null;
  season_status: string;
  season_label: string | null;
};

function mapSeason(row: Record<string, unknown>): SeasonRow {
  return {
    id: String(row.id),
    farmer_id: String(row.farmer_id),
    block_id: String(row.block_id),
    crop: String(row.crop),
    acreage: row.acreage != null ? Number(row.acreage) : null,
    start_date: String(row.start_date).slice(0, 10),
    end_date: row.end_date ? String(row.end_date).slice(0, 10) : null,
    dap: row.dap != null ? Number(row.dap) : null,
    total_expense: Number(row.total_expense ?? 0),
    total_income: Number(row.total_income ?? 0),
    net_profit: Number(row.net_profit ?? 0),
    final_yield_kg: row.final_yield_kg != null ? Number(row.final_yield_kg) : null,
    expected_income_inr: row.expected_income_inr != null ? Number(row.expected_income_inr) : null,
    market_note: row.market_note ? String(row.market_note) : null,
    season_status: String(row.season_status),
    season_label: row.season_label ? String(row.season_label) : null,
  };
}

async function sumSeasonEntries(seasonId: string) {
  const { data, error } = await supabase
    .from('farmer_roi_entries')
    .select('amount_inr, debit_inr, credit_inr, entry_type')
    .eq('season_id', seasonId);
  throwIfSupabaseError(error, 'Could not load season entries');

  let expense = 0;
  let income = 0;
  for (const row of data ?? []) {
    const debit = row.debit_inr != null ? Number(row.debit_inr) : null;
    const credit = row.credit_inr != null ? Number(row.credit_inr) : null;
    const amt = Number(row.amount_inr ?? 0);
    if (credit != null && credit > 0) income += credit;
    else if (debit != null && debit > 0) expense += debit;
    else if (row.entry_type === 'harvest' || row.entry_type === 'income') income += amt;
    else expense += amt;
  }
  return { expense, income, profit: income - expense };
}

async function recomputeSeasonTotals(seasonId: string) {
  const totals = await sumSeasonEntries(seasonId);
  await supabase
    .from('crop_seasons')
    .update({
      total_expense: totals.expense,
      total_income: totals.income,
      net_profit: totals.profit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', seasonId);
  return totals;
}

async function backfillOrphanEntries(farmerId: string, seasonId: string) {
  await supabase
    .from('farmer_roi_entries')
    .update({ season_id: seasonId })
    .eq('farmer_id', farmerId)
    .is('season_id', null);
}

export const cropSeasonService = {
  async listExpenseTypes(activeOnly = true) {
    let q = supabase.from('roi_expense_types').select('*').order('sort_order').order('expense_name');
    if (activeOnly) q = q.eq('active_status', true);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load expense types');
    return (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.expense_name),
      icon: r.icon ? String(r.icon) : null,
      color: r.color ? String(r.color) : null,
      ledgerEntryType: String(r.ledger_entry_type) as RoiEntryType,
    }));
  },

  async listLabourTypes(activeOnly = true) {
    let q = supabase.from('roi_labour_types').select('*').order('sort_order').order('labour_name');
    if (activeOnly) q = q.eq('active_status', true);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load labour types');
    return (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.labour_name),
      icon: r.icon ? String(r.icon) : null,
    }));
  },

  async ensureActiveSeason(farmerId: string, blockId?: string): Promise<SeasonRow> {
    const block = blockId
      ? await blockService.getById(blockId, farmerId)
      : await blockService.getPrimaryBlock(farmerId);
    if (!block) throw new NotFoundError('No field found — add a field first');

    const { data: existing } = await supabase
      .from('crop_seasons')
      .select('*')
      .eq('block_id', block.id)
      .eq('season_status', 'active')
      .maybeSingle();

    if (existing) {
      const season = mapSeason(existing);
      await backfillOrphanEntries(farmerId, season.id);
      await recomputeSeasonTotals(season.id);
      return season;
    }

    const dap = blockService.computeDap(block);
    const startDate = block.planting_date ?? todayIst();
    const label = seasonLabelFromDates(startDate, block.crop_type);

    const { data, error } = await supabase
      .from('crop_seasons')
      .insert({
        farmer_id: farmerId,
        block_id: block.id,
        crop: block.crop_type,
        acreage: block.acreage_decimal,
        start_date: startDate,
        dap,
        season_label: label,
        season_status: 'active',
      })
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not create crop season');
    const season = mapSeason(data as Record<string, unknown>);
    await backfillOrphanEntries(farmerId, season.id);
    return season;
  },

  async getActiveDashboard(farmerId: string) {
    const season = await this.ensureActiveSeason(farmerId);
    const block = await blockService.getById(season.block_id, farmerId);
    if (!block) throw new NotFoundError('Field not found');

    const dap = blockService.computeDap(block);
    const stageLabel = growthStageLabel(block.stage, dap);
    const totals = await recomputeSeasonTotals(season.id);

    const { data: recent } = await supabase
      .from('farmer_roi_entries')
      .select('id, entry_date, entry_type, amount_inr, comments, expense_type_id, roi_expense_types(expense_name, icon, color)')
      .eq('season_id', season.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(12);

    const expenseTypes = await this.listExpenseTypes();
    const typeMap = new Map(expenseTypes.map((t) => [t.id, t]));

    const breakdown: Record<string, number> = {};
    const { data: allEntries } = await supabase
      .from('farmer_roi_entries')
      .select('amount_inr, debit_inr, credit_inr, entry_type, expense_type_id')
      .eq('season_id', season.id);

    for (const e of allEntries ?? []) {
      if (e.entry_type === 'harvest' || e.entry_type === 'income') continue;
      const amt = e.debit_inr != null ? Number(e.debit_inr) : Number(e.amount_inr ?? 0);
      const typeId = e.expense_type_id ? String(e.expense_type_id) : 'other';
      const label = typeMap.get(typeId)?.name ?? String(e.entry_type);
      breakdown[label] = (breakdown[label] ?? 0) + amt;
    }

    const breakdownArr = Object.entries(breakdown).map(([label, value]) => ({
      label,
      value,
      color: typeMap.get([...typeMap.entries()].find(([, t]) => t.name === label)?.[0] ?? '')?.color ?? '#757575',
    }));

    let expectedIncome = season.expected_income_inr ?? totals.income;
    let marketNote = season.market_note;
    if (!expectedIncome || expectedIncome <= totals.income) {
      try {
        const { farmerPortalMobileService } = await import('./farmer-portal-mobile.service.js');
        const market = await farmerPortalMobileService.getMarketPrices(farmerId, season.crop);
        const price = market.rows[0]?.pricePerKg;
        const acreage = season.acreage ?? block.acreage_decimal ?? 1;
        const yieldKgPerAcre = 8000;
        if (price) {
          expectedIncome = Math.round(price * yieldKgPerAcre * acreage);
          marketNote = market.summary;
          await supabase
            .from('crop_seasons')
            .update({ expected_income_inr: expectedIncome, market_note: marketNote })
            .eq('id', season.id);
        }
      } catch {
        /* market optional */
      }
    }

    const investment = totals.expense;
    const profit = (expectedIncome || totals.income) - investment;
    const roiPercent = investment > 0 ? Math.round((profit / investment) * 100) : 0;

    return {
      seasonId: season.id,
      blockId: season.block_id,
      blockName: blockDisplayName(block),
      crop: season.crop,
      dap,
      stageLabel,
      acreage: season.acreage ?? block.acreage_decimal,
      seasonLabel: season.season_label ?? seasonLabelFromDates(season.start_date, season.crop),
      seasonStatus: season.season_status,
      spentInr: investment,
      expectedIncomeInr: expectedIncome,
      netProfitInr: profit,
      roiPercent,
      yieldEstimate: season.acreage ? `${season.acreage} acre` : null,
      marketNote,
      breakdown: breakdownArr,
      recentEntries: (recent ?? []).map((e) => {
        const et = e.roi_expense_types as { expense_name?: string; icon?: string } | null;
        return {
          id: String(e.id),
          dateLabel: formatDate(String(e.entry_date)),
          label: et?.expense_name ?? String(e.entry_type),
          icon: et?.icon ?? null,
          amountInr: Number(e.amount_inr),
          type: String(e.entry_type),
          note: e.comments ? String(e.comments) : null,
        };
      }),
    };
  },

  async createQuickExpense(
    farmerId: string,
    input: { seasonId?: string; expenseTypeId: string; amount: number; entryDate?: string; note?: string }
  ) {
    const season = input.seasonId
      ? await this.getSeasonForFarmer(farmerId, input.seasonId)
      : await this.ensureActiveSeason(farmerId);

    const { data: expType, error: typeErr } = await supabase
      .from('roi_expense_types')
      .select('*')
      .eq('id', input.expenseTypeId)
      .eq('active_status', true)
      .maybeSingle();
    throwIfSupabaseError(typeErr, 'Could not load expense type');
    if (!expType) throw new NotFoundError('Expense type not found');

    const entryType = String(expType.ledger_entry_type) as RoiEntryType;
    const entryDate = input.entryDate ?? todayIst();
    const note = input.note?.trim() || String(expType.expense_name);

    const entryId = await roiFlowService.recordEntry({
      farmerId,
      entryType,
      amount: input.amount,
      entryDate,
      comments: note,
      seasonId: season.id,
      blockId: season.block_id,
      expenseTypeId: input.expenseTypeId,
    });

    await recomputeSeasonTotals(season.id);
    return { id: entryId, seasonId: season.id };
  },

  async createLabourExpense(
    farmerId: string,
    input: { seasonId?: string; labourTypeId: string; workers?: number; amount: number; note?: string; entryDate?: string }
  ) {
    const season = input.seasonId
      ? await this.getSeasonForFarmer(farmerId, input.seasonId)
      : await this.ensureActiveSeason(farmerId);

    const { data: labType, error: typeErr } = await supabase
      .from('roi_labour_types')
      .select('*')
      .eq('id', input.labourTypeId)
      .eq('active_status', true)
      .maybeSingle();
    throwIfSupabaseError(typeErr, 'Could not load labour type');
    if (!labType) throw new NotFoundError('Labour type not found');

    const note = [
      String(labType.labour_name),
      input.workers ? `${input.workers} workers` : '',
      input.note?.trim(),
    ]
      .filter(Boolean)
      .join(' · ');

    const entryId = await roiFlowService.recordEntry({
      farmerId,
      entryType: 'labour',
      amount: input.amount,
      entryDate: input.entryDate ?? todayIst(),
      comments: note,
      seasonId: season.id,
      blockId: season.block_id,
      labourTypeId: input.labourTypeId,
      workersCount: input.workers,
    });

    await recomputeSeasonTotals(season.id);
    return { id: entryId, seasonId: season.id };
  },

  async createPurchaseFromOrder(
    farmerId: string,
    input: { orderId: string; amount: number; productSummary: string }
  ) {
    const season = await this.ensureActiveSeason(farmerId);
    const types = await this.listExpenseTypes();
    const purchaseType = types.find((t) => t.name.toLowerCase().includes('misc')) ?? types[0];
    if (!purchaseType) throw new ValidationError('No expense types configured');

    const entryId = await roiFlowService.recordEntry({
      farmerId,
      entryType: 'purchase',
      amount: input.amount,
      entryDate: todayIst(),
      comments: `Shop: ${input.productSummary}`,
      seasonId: season.id,
      blockId: season.block_id,
      expenseTypeId: purchaseType.id,
      commerceOrderId: input.orderId,
    });

    await recomputeSeasonTotals(season.id);
    return { id: entryId };
  },

  async submitHarvest(
    farmerId: string,
    input: { seasonId?: string; harvestDate?: string; yieldKg: number; sellingPricePerKg: number }
  ) {
    const season = input.seasonId
      ? await this.getSeasonForFarmer(farmerId, input.seasonId)
      : await this.ensureActiveSeason(farmerId);

    if (season.season_status !== 'active') {
      throw new ValidationError('Season is already closed');
    }

    const harvestDate = input.harvestDate ?? todayIst();
    const totalIncome = Math.round(input.yieldKg * input.sellingPricePerKg * 100) / 100;

    const entryId = await roiFlowService.recordEntry({
      farmerId,
      entryType: 'harvest',
      amount: totalIncome,
      entryDate: harvestDate,
      comments: `Harvest ${input.yieldKg} kg @ ₹${input.sellingPricePerKg}/kg`,
      seasonId: season.id,
      blockId: season.block_id,
    });

    await supabase.from('harvest_records').insert({
      season_id: season.id,
      farmer_id: farmerId,
      harvest_date: harvestDate,
      yield_kg: input.yieldKg,
      selling_price_per_kg: input.sellingPricePerKg,
      total_income_inr: totalIncome,
      roi_entry_id: entryId,
    });

    const totals = await recomputeSeasonTotals(season.id);
    const roiPercent = totals.expense > 0 ? Math.round((totals.profit / totals.expense) * 100) : 0;

    await supabase
      .from('crop_seasons')
      .update({
        end_date: harvestDate,
        final_yield_kg: input.yieldKg,
        season_status: 'harvested',
        updated_at: new Date().toISOString(),
      })
      .eq('id', season.id);

    await this.archiveSeason(farmerId, season.id);

    return {
      seasonId: season.id,
      totalIncomeInr: totalIncome,
      netProfitInr: totals.profit,
      roiPercent,
      entryId,
    };
  },

  async archiveSeason(farmerId: string, seasonId: string) {
    const season = await this.getSeasonForFarmer(farmerId, seasonId);
    await recomputeSeasonTotals(season.id);
    await supabase
      .from('crop_seasons')
      .update({ season_status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', season.id);

    const block = await blockService.getById(season.block_id, farmerId);
    if (block) {
      const dap = blockService.computeDap(block);
      const startDate = todayIst();
      await supabase.from('crop_seasons').insert({
        farmer_id: farmerId,
        block_id: season.block_id,
        crop: block.crop_type,
        acreage: block.acreage_decimal,
        start_date: startDate,
        dap,
        season_label: seasonLabelFromDates(startDate, block.crop_type),
        season_status: 'active',
      });
    }
  },

  async listHistory(farmerId: string) {
    const { data, error } = await supabase
      .from('crop_seasons')
      .select('*')
      .eq('farmer_id', farmerId)
      .in('season_status', ['harvested', 'archived'])
      .order('end_date', { ascending: false })
      .order('start_date', { ascending: false });
    throwIfSupabaseError(error, 'Could not load crop history');

    return (data ?? []).map((r) => {
      const s = mapSeason(r as Record<string, unknown>);
      return {
        id: s.id,
        crop: s.crop,
        seasonLabel: s.season_label ?? seasonLabelFromDates(s.start_date, s.crop),
        netProfitInr: s.net_profit,
        totalExpenseInr: s.total_expense,
        totalIncomeInr: s.total_income,
        finalYieldKg: s.final_yield_kg,
        status: s.season_status,
        startDate: s.start_date,
        endDate: s.end_date,
      };
    });
  },

  async getHistoryDetail(farmerId: string, seasonId: string) {
    const season = await this.getSeasonForFarmer(farmerId, seasonId);
    const block = await blockService.getById(season.block_id, farmerId);

    const { data: entries } = await supabase
      .from('farmer_roi_entries')
      .select('*, roi_expense_types(expense_name, icon), roi_labour_types(labour_name)')
      .eq('season_id', season.id)
      .order('entry_date', { ascending: false });

    const { data: harvest } = await supabase
      .from('harvest_records')
      .select('*')
      .eq('season_id', season.id)
      .maybeSingle();

    const { data: activities } = await supabase
      .from('cultivation_activities')
      .select('id, activity_label, applied_at, cost_inr, notes')
      .eq('farm_block_id', season.block_id)
      .gte('applied_at', season.start_date)
      .order('applied_at', { ascending: false })
      .limit(30);

    const endDap = season.dap ?? (block ? blockService.computeDap(block) : null);

    return {
      id: season.id,
      crop: season.crop,
      blockName: block ? blockDisplayName(block) : null,
      acreage: season.acreage,
      seasonLabel: season.season_label ?? seasonLabelFromDates(season.start_date, season.crop),
      startDate: season.start_date,
      endDate: season.end_date,
      dapDuration: endDap != null ? `0–${endDap} days` : null,
      totalExpenseInr: season.total_expense,
      totalIncomeInr: season.total_income,
      netProfitInr: season.net_profit,
      roiPercent: season.total_expense > 0 ? Math.round((season.net_profit / season.total_expense) * 100) : 0,
      finalYieldKg: season.final_yield_kg,
      harvest: harvest
        ? {
            harvestDate: String(harvest.harvest_date).slice(0, 10),
            yieldKg: Number(harvest.yield_kg),
            sellingPricePerKg: Number(harvest.selling_price_per_kg),
            totalIncomeInr: Number(harvest.total_income_inr),
          }
        : null,
      entries: (entries ?? []).map((e) => ({
        id: String(e.id),
        dateLabel: formatDate(String(e.entry_date)),
        amountInr: Number(e.amount_inr),
        type: String(e.entry_type),
        label:
          (e.roi_expense_types as { expense_name?: string } | null)?.expense_name ??
          (e.roi_labour_types as { labour_name?: string } | null)?.labour_name ??
          String(e.entry_type),
        note: e.comments ? String(e.comments) : null,
      })),
      activities: (activities ?? []).map((a) => ({
        id: String(a.id),
        label: String(a.activity_label ?? 'Activity'),
        dateLabel: formatDate(String(a.applied_at)),
        costInr: a.cost_inr != null ? Number(a.cost_inr) : null,
        notes: a.notes ? String(a.notes) : null,
      })),
    };
  },

  async listSeasonEntries(farmerId: string, seasonId: string, page = 1, limit = 30) {
    await this.getSeasonForFarmer(farmerId, seasonId);
    const offset = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('farmer_roi_entries')
      .select('*, roi_expense_types(expense_name, icon)', { count: 'exact' })
      .eq('season_id', seasonId)
      .order('entry_date', { ascending: false })
      .range(offset, offset + limit - 1);
    throwIfSupabaseError(error, 'Could not load entries');

    return {
      entries: (data ?? []).map((e) => ({
        id: String(e.id),
        dateLabel: formatDate(String(e.entry_date)),
        amountInr: Number(e.amount_inr),
        type: String(e.entry_type),
        label: (e.roi_expense_types as { expense_name?: string } | null)?.expense_name ?? String(e.entry_type),
        note: e.comments ? String(e.comments) : null,
      })),
      pagination: { page, limit, total: count ?? 0 },
    };
  },

  async getSeasonForFarmer(farmerId: string, seasonId: string): Promise<SeasonRow> {
    const { data, error } = await supabase
      .from('crop_seasons')
      .select('*')
      .eq('id', seasonId)
      .eq('farmer_id', farmerId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load season');
    if (!data) throw new NotFoundError('Season not found');
    return mapSeason(data as Record<string, unknown>);
  },

  async adminListExpenseTypes() {
    const { data, error } = await supabase.from('roi_expense_types').select('*').order('sort_order');
    throwIfSupabaseError(error, 'Could not load expense types');
    return data ?? [];
  },

  async adminCreateExpenseType(input: {
    expenseName: string;
    icon?: string | null;
    color?: string | null;
    ledgerEntryType?: RoiEntryType;
    sortOrder?: number;
  }) {
    const { data, error } = await supabase
      .from('roi_expense_types')
      .insert({
        expense_name: input.expenseName,
        icon: input.icon ?? null,
        color: input.color ?? null,
        ledger_entry_type: input.ledgerEntryType ?? 'misc',
        sort_order: input.sortOrder ?? 100,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create expense type');
    return data;
  },

  async adminUpdateExpenseType(
    id: string,
    patch: Partial<{
      expenseName: string;
      icon: string | null;
      color: string | null;
      ledgerEntryType: RoiEntryType;
      activeStatus: boolean;
      sortOrder: number;
    }>
  ) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.expenseName != null) update.expense_name = patch.expenseName;
    if (patch.icon !== undefined) update.icon = patch.icon;
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.ledgerEntryType != null) update.ledger_entry_type = patch.ledgerEntryType;
    if (patch.activeStatus != null) update.active_status = patch.activeStatus;
    if (patch.sortOrder != null) update.sort_order = patch.sortOrder;

    const { data, error } = await supabase
      .from('roi_expense_types')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update expense type');
    return data;
  },

  async adminDeleteExpenseType(id: string) {
    const { data, error } = await supabase
      .from('roi_expense_types')
      .update({ active_status: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not deactivate expense type');
    return data;
  },

  async adminListLabourTypes() {
    const { data, error } = await supabase.from('roi_labour_types').select('*').order('sort_order');
    throwIfSupabaseError(error, 'Could not load labour types');
    return data ?? [];
  },

  async adminCreateLabourType(input: { labourName: string; icon?: string | null; sortOrder?: number }) {
    const { data, error } = await supabase
      .from('roi_labour_types')
      .insert({
        labour_name: input.labourName,
        icon: input.icon ?? null,
        sort_order: input.sortOrder ?? 100,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create labour type');
    return data;
  },

  async adminUpdateLabourType(
    id: string,
    patch: Partial<{ labourName: string; icon: string | null; activeStatus: boolean; sortOrder: number }>
  ) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.labourName != null) update.labour_name = patch.labourName;
    if (patch.icon !== undefined) update.icon = patch.icon;
    if (patch.activeStatus != null) update.active_status = patch.activeStatus;
    if (patch.sortOrder != null) update.sort_order = patch.sortOrder;

    const { data, error } = await supabase
      .from('roi_labour_types')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update labour type');
    return data;
  },

  async adminDeleteLabourType(id: string) {
    const { data, error } = await supabase
      .from('roi_labour_types')
      .update({ active_status: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not deactivate labour type');
    return data;
  },
};

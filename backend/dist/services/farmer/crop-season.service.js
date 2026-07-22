import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { blockService, blockDisplayName } from '../core/block.service.js';
import { growthStageFromDap } from './crop-stage.service.js';
import { roiFlowService } from '../whatsapp/roi/roi-flow.service.js';
function growthStageLabel(crop, stage, dap) {
    return growthStageFromDap(crop, dap, stage);
}
function formatDate(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    catch {
        return String(iso);
    }
}
function seasonLabelFromDates(startDate, crop) {
    const y = new Date(startDate).getFullYear();
    return `${y} ${crop.charAt(0).toUpperCase()}${crop.slice(1)} Season`;
}
function todayIst() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
function mapSeason(row) {
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
        harvest_count: Number(row.harvest_count ?? 0),
        total_yield_kg: Number(row.total_yield_kg ?? 0),
    };
}
async function sumSeasonEntries(seasonId) {
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
        if (credit != null && credit > 0)
            income += credit;
        else if (debit != null && debit > 0)
            expense += debit;
        else if (row.entry_type === 'harvest' || row.entry_type === 'income')
            income += amt;
        else
            expense += amt;
    }
    return { expense, income, profit: income - expense };
}
async function recomputeSeasonTotals(seasonId) {
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
async function backfillOrphanEntries(farmerId, seasonId) {
    await supabase
        .from('farmer_roi_entries')
        .update({ season_id: seasonId })
        .eq('farmer_id', farmerId)
        .is('season_id', null);
}
export const cropSeasonService = {
    async listExpenseTypes(activeOnly = true) {
        let q = supabase.from('roi_expense_types').select('*').order('sort_order').order('expense_name');
        if (activeOnly)
            q = q.eq('active_status', true);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load expense types');
        return (data ?? []).map((r) => ({
            id: String(r.id),
            name: String(r.expense_name),
            icon: r.icon ? String(r.icon) : null,
            color: r.color ? String(r.color) : null,
            ledgerEntryType: String(r.ledger_entry_type),
        }));
    },
    async listLabourTypes(activeOnly = true) {
        let q = supabase.from('roi_labour_types').select('*').order('sort_order').order('labour_name');
        if (activeOnly)
            q = q.eq('active_status', true);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load labour types');
        return (data ?? []).map((r) => ({
            id: String(r.id),
            name: String(r.labour_name),
            icon: r.icon ? String(r.icon) : null,
        }));
    },
    async ensureActiveSeason(farmerId, blockId) {
        const block = blockId
            ? await blockService.getById(blockId, farmerId)
            : await blockService.getPrimaryBlock(farmerId);
        if (!block)
            throw new NotFoundError('No field found — add a field first');
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
        const season = mapSeason(data);
        await backfillOrphanEntries(farmerId, season.id);
        return season;
    },
    async getActiveDashboard(farmerId, blockId) {
        const season = await this.ensureActiveSeason(farmerId, blockId);
        const block = await blockService.getById(season.block_id, farmerId);
        if (!block)
            throw new NotFoundError('Field not found');
        const dap = blockService.computeDap(block);
        const stageLabel = growthStageLabel(block.crop_type ?? block.crop_name, block.stage, dap);
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
        const breakdown = {};
        const { data: allEntries } = await supabase
            .from('farmer_roi_entries')
            .select('amount_inr, debit_inr, credit_inr, entry_type, expense_type_id')
            .eq('season_id', season.id);
        for (const e of allEntries ?? []) {
            if (e.entry_type === 'harvest' || e.entry_type === 'income')
                continue;
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
            }
            catch {
                /* market optional */
            }
        }
        const investment = totals.expense;
        const hasIncome = totals.income > 0;
        const profit = hasIncome ? totals.income - investment : null;
        const roiPercent = hasIncome && investment > 0 && profit != null ? Math.round((profit / investment) * 100) : null;
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
            netProfitInr: profit ?? 0,
            roiPercent: roiPercent ?? 0,
            hasIncome,
            profitMessage: hasIncome ? null : 'Profit & ROI available after first harvest sale',
            yieldEstimate: season.acreage ? `${season.acreage} acre` : null,
            marketNote,
            breakdown: breakdownArr,
            recentEntries: (recent ?? []).map((e) => {
                const et = e.roi_expense_types;
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
    async createQuickExpense(farmerId, input) {
        const season = input.seasonId
            ? await this.getSeasonForFarmer(farmerId, input.seasonId)
            : await this.ensureActiveSeason(farmerId, input.blockId);
        let categoryId = input.categoryId;
        let expenseTypeId = input.expenseTypeId;
        let entryType = 'misc';
        let note = input.note?.trim() ?? '';
        if (categoryId) {
            const cat = await this.getCategoryForFarmer(farmerId, categoryId);
            entryType = String(cat.ledger_entry_type);
            if (!note)
                note = String(cat.name);
            expenseTypeId = cat.legacy_expense_type_id ? String(cat.legacy_expense_type_id) : undefined;
        }
        else if (expenseTypeId) {
            const { data: expType, error: typeErr } = await supabase
                .from('roi_expense_types')
                .select('*')
                .eq('id', expenseTypeId)
                .eq('active_status', true)
                .maybeSingle();
            throwIfSupabaseError(typeErr, 'Could not load expense type');
            if (!expType)
                throw new NotFoundError('Expense type not found');
            entryType = String(expType.ledger_entry_type);
            if (!note)
                note = String(expType.expense_name);
            const { data: linked } = await supabase
                .from('farmer_roi_categories')
                .select('id')
                .eq('legacy_expense_type_id', expenseTypeId)
                .maybeSingle();
            categoryId = linked?.id ? String(linked.id) : undefined;
        }
        else {
            throw new ValidationError('Category or expense type is required');
        }
        const entryDate = input.entryDate ?? todayIst();
        const entryId = await roiFlowService.recordEntry({
            farmerId,
            entryType,
            amount: input.amount,
            entryDate,
            comments: note,
            seasonId: season.id,
            blockId: season.block_id,
            expenseTypeId,
            categoryId,
        });
        await recomputeSeasonTotals(season.id);
        return { id: entryId, seasonId: season.id };
    },
    async createLabourExpense(farmerId, input) {
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
        if (!labType)
            throw new NotFoundError('Labour type not found');
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
    async createPurchaseFromOrder(farmerId, input) {
        const season = await this.ensureActiveSeason(farmerId);
        const types = await this.listExpenseTypes();
        const purchaseType = types.find((t) => t.name.toLowerCase().includes('misc')) ?? types[0];
        if (!purchaseType)
            throw new ValidationError('No expense types configured');
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
    async recordHarvestSale(farmerId, input) {
        const season = input.seasonId
            ? await this.getSeasonForFarmer(farmerId, input.seasonId)
            : await this.ensureActiveSeason(farmerId, input.blockId);
        if (season.season_status !== 'active') {
            throw new ValidationError('Season is already closed');
        }
        const harvestDate = input.harvestDate ?? todayIst();
        const totalIncome = Math.round(input.yieldKg * input.sellingPricePerKg * 100) / 100;
        const buyerNote = input.buyer?.trim() ? ` · ${input.buyer.trim()}` : '';
        const entryId = await roiFlowService.recordEntry({
            farmerId,
            entryType: 'harvest',
            amount: totalIncome,
            entryDate: harvestDate,
            comments: `Harvest ${input.yieldKg} kg @ ₹${input.sellingPricePerKg}/kg${buyerNote}`,
            seasonId: season.id,
            blockId: season.block_id,
            incomeSubtype: 'harvest_sale',
        });
        await supabase.from('harvest_records').insert({
            season_id: season.id,
            farmer_id: farmerId,
            harvest_date: harvestDate,
            yield_kg: input.yieldKg,
            selling_price_per_kg: input.sellingPricePerKg,
            total_income_inr: totalIncome,
            roi_entry_id: entryId,
            buyer: input.buyer?.trim() || null,
        });
        const newCount = season.harvest_count + 1;
        const newYield = season.total_yield_kg + input.yieldKg;
        const totals = await recomputeSeasonTotals(season.id);
        const roiPercent = totals.expense > 0 ? Math.round((totals.profit / totals.expense) * 100) : 0;
        await supabase
            .from('crop_seasons')
            .update({
            harvest_count: newCount,
            total_yield_kg: newYield,
            final_yield_kg: newYield,
            updated_at: new Date().toISOString(),
        })
            .eq('id', season.id);
        return {
            seasonId: season.id,
            harvestCount: newCount,
            totalIncomeInr: totalIncome,
            netProfitInr: totals.profit,
            roiPercent,
            entryId,
        };
    },
    /** @deprecated Use recordHarvestSale — kept for backward compatibility */
    async submitHarvest(farmerId, input) {
        return this.recordHarvestSale(farmerId, input);
    },
    async recordIncome(farmerId, input) {
        const season = input.seasonId
            ? await this.getSeasonForFarmer(farmerId, input.seasonId)
            : await this.ensureActiveSeason(farmerId, input.blockId);
        const entryId = await roiFlowService.recordEntry({
            farmerId,
            entryType: 'income',
            amount: input.amount,
            entryDate: input.entryDate ?? todayIst(),
            comments: input.note?.trim() || input.incomeSubtype,
            seasonId: season.id,
            blockId: season.block_id,
            incomeSubtype: input.incomeSubtype,
        });
        await recomputeSeasonTotals(season.id);
        return { id: entryId, seasonId: season.id };
    },
    async finishSeason(farmerId, seasonId, opts) {
        const season = await this.getSeasonForFarmer(farmerId, seasonId);
        if (season.season_status !== 'active') {
            throw new ValidationError('Season is already finished');
        }
        if (!opts?.confirmText || opts.confirmText.trim().toUpperCase() !== 'COMPLETE') {
            throw new ValidationError('Type COMPLETE to confirm');
        }
        const { data: farmerRow } = await supabase
            .from('farmers')
            .select('password_hash')
            .eq('id', farmerId)
            .maybeSingle();
        if (farmerRow?.password_hash) {
            if (!opts.password?.trim()) {
                throw new ValidationError('Password is required');
            }
            const { verifyPassword } = await import('../../lib/password.js');
            if (!verifyPassword(opts.password.trim(), String(farmerRow.password_hash))) {
                throw new UnauthorizedError('Invalid password');
            }
        }
        await recomputeSeasonTotals(season.id);
        const endDate = todayIst();
        await supabase
            .from('crop_seasons')
            .update({
            season_status: 'archived',
            end_date: endDate,
            updated_at: new Date().toISOString(),
        })
            .eq('id', season.id);
        const totals = await sumSeasonEntries(season.id);
        const roiPercent = totals.expense > 0 ? Math.round((totals.profit / totals.expense) * 100) : 0;
        return {
            seasonId: season.id,
            netProfitInr: totals.profit,
            totalExpenseInr: totals.expense,
            totalIncomeInr: totals.income,
            roiPercent,
        };
    },
    async startSeason(farmerId, input) {
        const block = await blockService.getById(input.blockId, farmerId);
        if (!block)
            throw new NotFoundError('Field not found');
        const { data: existing } = await supabase
            .from('crop_seasons')
            .select('id')
            .eq('block_id', input.blockId)
            .eq('season_status', 'active')
            .maybeSingle();
        if (existing)
            throw new ValidationError('This field already has an active crop cycle');
        const plantingDate = input.plantingDate ?? todayIst();
        const crop = input.crop.trim().toLowerCase();
        const dap = blockService.computeDap({ planting_date: plantingDate, created_at: block.created_at });
        await supabase
            .from('farm_blocks')
            .update({
            crop_type: crop,
            planting_date: plantingDate,
            acreage_decimal: input.acreage ?? block.acreage_decimal,
            updated_at: new Date().toISOString(),
        })
            .eq('id', input.blockId);
        const { data, error } = await supabase
            .from('crop_seasons')
            .insert({
            farmer_id: farmerId,
            block_id: input.blockId,
            crop,
            acreage: input.acreage ?? block.acreage_decimal,
            start_date: plantingDate,
            dap,
            season_label: seasonLabelFromDates(plantingDate, crop),
            season_status: 'active',
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not start crop cycle');
        return mapSeason(data);
    },
    async archiveSeason(farmerId, seasonId) {
        return this.finishSeason(farmerId, seasonId);
    },
    async listHistory(farmerId) {
        const { data, error } = await supabase
            .from('crop_seasons')
            .select('*')
            .eq('farmer_id', farmerId)
            .in('season_status', ['harvested', 'archived'])
            .order('end_date', { ascending: false })
            .order('start_date', { ascending: false });
        throwIfSupabaseError(error, 'Could not load crop history');
        return (data ?? []).map((r) => {
            const s = mapSeason(r);
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
    async getHistoryDetail(farmerId, seasonId) {
        const season = await this.getSeasonForFarmer(farmerId, seasonId);
        const block = await blockService.getById(season.block_id, farmerId);
        const { data: entries } = await supabase
            .from('farmer_roi_entries')
            .select('*, roi_expense_types(expense_name, icon), roi_labour_types(labour_name)')
            .eq('season_id', season.id)
            .order('entry_date', { ascending: false });
        const { data: harvestRows } = await supabase
            .from('harvest_records')
            .select('*')
            .eq('season_id', season.id)
            .order('harvest_date', { ascending: false });
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
            harvests: (harvestRows ?? []).map((h) => ({
                id: String(h.id),
                harvestDate: String(h.harvest_date).slice(0, 10),
                yieldKg: Number(h.yield_kg),
                sellingPricePerKg: Number(h.selling_price_per_kg),
                totalIncomeInr: Number(h.total_income_inr),
                buyer: h.buyer ? String(h.buyer) : null,
            })),
            harvest: harvestRows?.[0]
                ? {
                    harvestDate: String(harvestRows[0].harvest_date).slice(0, 10),
                    yieldKg: Number(harvestRows[0].yield_kg),
                    sellingPricePerKg: Number(harvestRows[0].selling_price_per_kg),
                    totalIncomeInr: Number(harvestRows[0].total_income_inr),
                }
                : null,
            entries: (entries ?? []).map((e) => ({
                id: String(e.id),
                dateLabel: formatDate(String(e.entry_date)),
                amountInr: Number(e.amount_inr),
                type: String(e.entry_type),
                label: e.roi_expense_types?.expense_name ??
                    e.roi_labour_types?.labour_name ??
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
    async listSeasonEntries(farmerId, seasonId, page = 1, limit = 30) {
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
                label: e.roi_expense_types?.expense_name ?? String(e.entry_type),
                note: e.comments ? String(e.comments) : null,
            })),
            pagination: { page, limit, total: count ?? 0 },
        };
    },
    async listCategories(farmerId) {
        const { data, error } = await supabase
            .from('farmer_roi_categories')
            .select('*')
            .or(`is_system.eq.true,farmer_id.eq.${farmerId}`)
            .eq('active_status', true)
            .order('sort_order')
            .order('name');
        throwIfSupabaseError(error, 'Could not load categories');
        return (data ?? []).map((r) => ({
            id: String(r.id),
            name: String(r.name),
            icon: r.icon ? String(r.icon) : null,
            color: r.color ? String(r.color) : null,
            ledgerEntryType: String(r.ledger_entry_type),
            isSystem: Boolean(r.is_system),
        }));
    },
    async getCategoryForFarmer(farmerId, categoryId) {
        const { data, error } = await supabase
            .from('farmer_roi_categories')
            .select('*')
            .eq('id', categoryId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load category');
        if (!data)
            throw new NotFoundError('Category not found');
        if (!data.is_system && String(data.farmer_id) !== farmerId) {
            throw new NotFoundError('Category not found');
        }
        return data;
    },
    async createFarmerCategory(farmerId, input) {
        const name = input.name.trim();
        if (!name)
            throw new ValidationError('Category name is required');
        const { data, error } = await supabase
            .from('farmer_roi_categories')
            .insert({
            farmer_id: farmerId,
            name,
            icon: input.icon ?? '📦',
            color: input.color ?? '#757575',
            ledger_entry_type: input.ledgerEntryType ?? 'misc',
            is_system: false,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create category');
        return {
            id: String(data.id),
            name: String(data.name),
            icon: data.icon ? String(data.icon) : null,
            color: data.color ? String(data.color) : null,
            ledgerEntryType: String(data.ledger_entry_type),
            isSystem: false,
        };
    },
    async listTransactions(farmerId, opts) {
        const page = opts.page ?? 1;
        const limit = opts.limit ?? 50;
        const offset = (page - 1) * limit;
        let seasonIds = [];
        if (opts.seasonId) {
            seasonIds = [opts.seasonId];
        }
        else {
            const { roiAggregationService } = await import('./roi-aggregation.service.js');
            seasonIds = await roiAggregationService.resolveActiveSeasonIds(farmerId, {
                blockId: opts.blockId,
                crop: opts.crop,
            });
        }
        if (!seasonIds.length) {
            return { transactions: [], pagination: { page, limit, total: 0 } };
        }
        let q = supabase
            .from('farmer_roi_entries')
            .select('*, roi_expense_types(expense_name), farmer_roi_categories(name)', { count: 'exact' })
            .in('season_id', seasonIds)
            .order('entry_date', { ascending: false })
            .range(offset, offset + limit - 1);
        if (opts.from)
            q = q.gte('entry_date', opts.from);
        if (opts.to)
            q = q.lte('entry_date', opts.to);
        if (opts.categoryId)
            q = q.eq('category_id', opts.categoryId);
        const { data, error, count } = await q;
        throwIfSupabaseError(error, 'Could not load transactions');
        const rows = (data ?? []).filter((e) => {
            const isIncome = e.entry_type === 'harvest' || e.entry_type === 'income';
            if (opts.type === 'income')
                return isIncome;
            if (opts.type === 'expense')
                return !isIncome;
            return true;
        });
        return {
            transactions: rows.map((e) => {
                const isIncome = e.entry_type === 'harvest' || e.entry_type === 'income';
                const label = e.farmer_roi_categories?.name ??
                    e.roi_expense_types?.expense_name ??
                    String(e.entry_type);
                const amt = Number(e.amount_inr ?? 0);
                return {
                    id: String(e.id),
                    date: String(e.entry_date).slice(0, 10),
                    dateLabel: formatDate(String(e.entry_date)),
                    type: isIncome ? 'income' : 'expense',
                    entryType: String(e.entry_type),
                    incomeSubtype: e.income_subtype ? String(e.income_subtype) : null,
                    label,
                    amountInr: amt,
                    signedAmountInr: isIncome ? amt : -amt,
                    note: e.comments ? String(e.comments) : null,
                    seasonId: e.season_id ? String(e.season_id) : null,
                    blockId: e.block_id ? String(e.block_id) : null,
                    categoryId: e.category_id ? String(e.category_id) : null,
                };
            }),
            pagination: { page, limit, total: count ?? 0 },
        };
    },
    async getExpenseBook(farmerId, filter) {
        const { roiAggregationService } = await import('./roi-aggregation.service.js');
        const seasonIds = await roiAggregationService.resolveActiveSeasonIds(farmerId, filter);
        if (!seasonIds.length)
            return { groups: [] };
        const { data, error } = await supabase
            .from('farmer_roi_entries')
            .select('id, entry_date, amount_inr, debit_inr, comments, category_id, farmer_roi_categories(name, icon)')
            .in('season_id', seasonIds)
            .not('entry_type', 'in', '("harvest","income")')
            .order('entry_date', { ascending: false });
        throwIfSupabaseError(error, 'Could not load expense book');
        const groups = new Map();
        for (const e of data ?? []) {
            const cat = e.farmer_roi_categories;
            const catId = e.category_id ? String(e.category_id) : 'other';
            const catName = cat?.name ?? 'Other';
            const amt = e.debit_inr != null ? Number(e.debit_inr) : Number(e.amount_inr ?? 0);
            const g = groups.get(catId) ?? {
                categoryId: catId,
                categoryName: catName,
                icon: cat?.icon ?? null,
                totalInr: 0,
                lines: [],
            };
            g.totalInr += amt;
            g.lines.push({
                id: String(e.id),
                dateLabel: formatDate(String(e.entry_date)),
                description: e.comments ? String(e.comments) : catName,
                amountInr: amt,
            });
            groups.set(catId, g);
        }
        return { groups: [...groups.values()].sort((a, b) => b.totalInr - a.totalInr) };
    },
    async getAnalytics(farmerId, filter) {
        const { roiAggregationService } = await import('./roi-aggregation.service.js');
        const summary = await roiAggregationService.getSummary(farmerId, filter);
        const totalExpense = summary.financial.expenseInr;
        const breakdown = summary.breakdown.map((b) => ({
            label: b.label,
            value: b.value,
            percent: totalExpense > 0 ? Math.round((b.value / totalExpense) * 1000) / 10 : 0,
            color: b.color,
        }));
        const top = breakdown.length ? breakdown.reduce((a, b) => (b.value > a.value ? b : a)) : null;
        const seasonIds = summary.activeSeasonIds;
        const monthly = new Map();
        if (seasonIds.length) {
            const { data } = await supabase
                .from('farmer_roi_entries')
                .select('entry_date, amount_inr, debit_inr, entry_type')
                .in('season_id', seasonIds)
                .not('entry_type', 'in', '("harvest","income")');
            for (const e of data ?? []) {
                const d = String(e.entry_date).slice(0, 7);
                const amt = e.debit_inr != null ? Number(e.debit_inr) : Number(e.amount_inr ?? 0);
                monthly.set(d, (monthly.get(d) ?? 0) + amt);
            }
        }
        return {
            breakdown,
            topCategory: top ? { label: top.label, value: top.value } : null,
            monthlyExpenseTrend: [...monthly.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, amountInr]) => ({ month, amountInr })),
            harvest: summary.harvestSummary,
        };
    },
    async listHistoryV2(farmerId) {
        const blocks = await blockService.listByFarmer(farmerId);
        const blockMap = new Map(blocks.map((b) => [b.id, blockDisplayName(b)]));
        const { data: activeRows } = await supabase
            .from('crop_seasons')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('season_status', 'active')
            .order('start_date', { ascending: false });
        const active = (activeRows ?? []).map((r) => {
            const s = mapSeason(r);
            const block = blocks.find((b) => b.id === s.block_id);
            return {
                id: s.id,
                crop: s.crop,
                seasonLabel: s.season_label ?? seasonLabelFromDates(s.start_date, s.crop),
                netProfitInr: s.net_profit,
                totalExpenseInr: s.total_expense,
                totalIncomeInr: s.total_income,
                finalYieldKg: s.total_yield_kg || s.final_yield_kg,
                status: s.season_status,
                startDate: s.start_date,
                endDate: s.end_date,
                blockName: blockMap.get(s.block_id) ?? null,
                dap: block ? blockService.computeDap(block) : s.dap,
                stageLabel: growthStageLabel(block?.crop_name ?? block?.crop_type ?? s.crop, block?.stage, block ? blockService.computeDap(block) : s.dap),
            };
        });
        const completed = await this.listHistory(farmerId);
        return { active, completed };
    },
    async updateTransaction(farmerId, entryId, patch) {
        const { data: existing, error } = await supabase
            .from('farmer_roi_entries')
            .select('*')
            .eq('id', entryId)
            .eq('farmer_id', farmerId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load entry');
        if (!existing)
            throw new NotFoundError('Transaction not found');
        const update = { updated_at: new Date().toISOString() };
        if (patch.amount != null) {
            update.amount_inr = patch.amount;
            const dc = patch.amount;
            const isIncome = existing.entry_type === 'harvest' || existing.entry_type === 'income';
            update.debit_inr = isIncome ? null : dc;
            update.credit_inr = isIncome ? dc : null;
        }
        if (patch.note !== undefined)
            update.comments = patch.note;
        if (patch.entryDate)
            update.entry_date = patch.entryDate;
        await supabase.from('farmer_roi_entries').update(update).eq('id', entryId);
        if (existing.season_id)
            await recomputeSeasonTotals(String(existing.season_id));
        return { id: entryId };
    },
    async deleteTransaction(farmerId, entryId) {
        const { data: existing, error } = await supabase
            .from('farmer_roi_entries')
            .select('*')
            .eq('id', entryId)
            .eq('farmer_id', farmerId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load entry');
        if (!existing)
            throw new NotFoundError('Transaction not found');
        await supabase.from('farmer_roi_audit_log').insert({
            farmer_id: farmerId,
            entry_id: entryId,
            action: 'delete',
            old_amount_inr: Number(existing.amount_inr),
            reason: 'Farmer deleted transaction',
            actor: 'farmer',
        });
        await supabase.from('farmer_roi_entries').delete().eq('id', entryId);
        if (existing.season_id)
            await recomputeSeasonTotals(String(existing.season_id));
        return { id: entryId };
    },
    async getSeasonForFarmer(farmerId, seasonId) {
        const { data, error } = await supabase
            .from('crop_seasons')
            .select('*')
            .eq('id', seasonId)
            .eq('farmer_id', farmerId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load season');
        if (!data)
            throw new NotFoundError('Season not found');
        return mapSeason(data);
    },
    async adminListExpenseTypes() {
        const { data, error } = await supabase.from('roi_expense_types').select('*').order('sort_order');
        throwIfSupabaseError(error, 'Could not load expense types');
        return data ?? [];
    },
    async adminCreateExpenseType(input) {
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
    async adminUpdateExpenseType(id, patch) {
        const update = { updated_at: new Date().toISOString() };
        if (patch.expenseName != null)
            update.expense_name = patch.expenseName;
        if (patch.icon !== undefined)
            update.icon = patch.icon;
        if (patch.color !== undefined)
            update.color = patch.color;
        if (patch.ledgerEntryType != null)
            update.ledger_entry_type = patch.ledgerEntryType;
        if (patch.activeStatus != null)
            update.active_status = patch.activeStatus;
        if (patch.sortOrder != null)
            update.sort_order = patch.sortOrder;
        const { data, error } = await supabase
            .from('roi_expense_types')
            .update(update)
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update expense type');
        return data;
    },
    async adminDeleteExpenseType(id) {
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
    async adminCreateLabourType(input) {
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
    async adminUpdateLabourType(id, patch) {
        const update = { updated_at: new Date().toISOString() };
        if (patch.labourName != null)
            update.labour_name = patch.labourName;
        if (patch.icon !== undefined)
            update.icon = patch.icon;
        if (patch.activeStatus != null)
            update.active_status = patch.activeStatus;
        if (patch.sortOrder != null)
            update.sort_order = patch.sortOrder;
        const { data, error } = await supabase
            .from('roi_labour_types')
            .update(update)
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update labour type');
        return data;
    },
    async adminDeleteLabourType(id) {
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
//# sourceMappingURL=crop-season.service.js.map
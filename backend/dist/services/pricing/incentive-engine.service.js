import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError } from '../../lib/errors.js';
import { pricingConfigService } from './pricing-config.service.js';
import { safePriceEngineService } from './safe-price-engine.service.js';
import { classifyOrderType, computeBulkIncentive, computeRetailIncentive, realizationMultiplier, } from './incentive-formulas.js';
function round2(n) {
    return Math.round(n * 100) / 100;
}
function hintFromRealization(pct) {
    if (pct >= 95)
        return 'excellent';
    if (pct >= 90)
        return 'good';
    if (pct >= 85)
        return 'warning';
    return 'critical';
}
async function getMonthlyMtdSales(employeeProfileId, monthYear) {
    if (!employeeProfileId)
        return 0;
    const [y, m] = monthYear.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString();
    const { data } = await supabase
        .from('employee_sales_ledger')
        .select('final_unit_price, qty')
        .eq('employee_profile_id', employeeProfileId)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .in('status', ['quoted', 'confirmed', 'paid']);
    return (data ?? []).reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
}
function computeLineInternal(input) {
    const { tiers, qty, config } = input;
    const sellingPrice = round2(Number(input.sellingPrice) || 0);
    const listed = tiers.listedPrice || sellingPrice;
    const hardFloor = tiers.hardFloorPrice || 0;
    const safe = tiers.safePrice || 0;
    const realizationPct = listed > 0 ? round2((sellingPrice / listed) * 100) : 100;
    const allowed = hardFloor <= 0 || sellingPrice >= hardFloor;
    const effectiveCost = tiers.effectiveCost || 0;
    const grossProfitPerUnit = round2(sellingPrice - effectiveCost);
    let warningLevel = 'none';
    let warningMessage = null;
    if (!allowed) {
        warningLevel = 'blocked';
        warningMessage = `Cannot sell below hard floor ₹${hardFloor.toLocaleString('en-IN')}`;
    }
    else if (realizationPct < config.realizationWarning) {
        warningLevel = 'critical';
        warningMessage = `Low margin warning — realization ${realizationPct}%`;
    }
    else if (realizationPct < config.realizationGood) {
        warningLevel = 'low_margin';
        warningMessage = `Reduced incentive — realization ${realizationPct}%`;
    }
    else if (sellingPrice < safe) {
        warningLevel = 'low_margin';
        warningMessage = 'Below safe price';
    }
    const lineSales = round2(sellingPrice * qty);
    const lineListedSales = round2(listed * qty);
    return {
        qty,
        listedPrice: listed,
        sellingPrice,
        recommendedPrice: tiers.recommendedPrice,
        safePrice: safe,
        hardFloorPrice: hardFloor,
        realizationPct,
        grossProfitPerUnit,
        grossProfitTotal: round2(grossProfitPerUnit * qty),
        warningLevel,
        warningMessage,
        allowed,
        lineSales,
        lineListedSales,
    };
}
function allocateIncentive(lines, totalIncentive) {
    const orderSales = lines.reduce((s, l) => s + l.lineSales, 0);
    if (orderSales <= 0 || totalIncentive <= 0) {
        return lines.map(() => 0);
    }
    return lines.map((l) => round2((l.lineSales / orderSales) * totalIncentive));
}
export const incentiveEngineService = {
    async previewQuote(input) {
        const config = await pricingConfigService.getConfig();
        let employeeProfileId = null;
        if (input.adminUserId) {
            const { data: profile } = await supabase
                .from('employee_profiles')
                .select('id')
                .eq('admin_user_id', input.adminUserId)
                .maybeSingle();
            employeeProfileId = profile?.id ? String(profile.id) : null;
            if (employeeProfileId) {
                const { data: comp } = await supabase
                    .from('employee_compensation')
                    .select('pricing_access_restricted')
                    .eq('employee_profile_id', employeeProfileId)
                    .maybeSingle();
                if (comp?.pricing_access_restricted) {
                    throw new AppError('Pricing access restricted — contact manager', 403, 'PRICING_RESTRICTED');
                }
            }
        }
        const lineInternals = [];
        for (const line of input.lines) {
            const tiers = await safePriceEngineService.resolveByVariantOrSku({
                variantId: line.variantId,
                sku: line.sku,
                catalogListedPrice: line.catalogListedPrice ?? line.unitPrice,
            });
            lineInternals.push({
                ...computeLineInternal({
                    tiers,
                    sellingPrice: line.unitPrice,
                    qty: line.qty,
                    config,
                }),
                variantId: line.variantId,
                sku: line.sku,
                title: line.title,
            });
        }
        const orderTotal = round2(lineInternals.reduce((s, l) => s + l.lineSales, 0));
        const subtotalGrossProfit = round2(lineInternals.reduce((s, l) => s + l.grossProfitTotal, 0));
        const avgRealizationPct = lineInternals.length > 0
            ? round2(lineInternals.reduce((s, l) => s + l.realizationPct * l.lineSales, 0) /
                Math.max(1, lineInternals.reduce((s, l) => s + l.lineSales, 0)))
            : 100;
        const retailOrBulk = input.orderType === 'bulk' ? 'bulk' : classifyOrderType(orderTotal, config);
        const monthYear = new Date().toISOString().slice(0, 7);
        const mtdSales = await getMonthlyMtdSales(employeeProfileId, monthYear);
        const projectedAchievement = config.monthlySalesTargetInr > 0
            ? ((mtdSales + orderTotal) / config.monthlySalesTargetInr) * 100
            : 100;
        let totalIncentive = 0;
        let basePct = 0;
        let mult = 0;
        let bulkGrossMarginPct = null;
        let needsOwnerReview = false;
        const warnings = lineInternals
            .filter((l) => l.warningMessage)
            .map((l) => l.warningMessage);
        if (retailOrBulk === 'bulk') {
            const bulk = computeBulkIncentive({
                grossProfitInr: subtotalGrossProfit,
                salesInr: orderTotal,
                config,
            });
            totalIncentive = bulk.incentive;
            bulkGrossMarginPct = bulk.grossMarginPct;
            if (!bulk.allowed && bulk.blockReason) {
                warnings.push(bulk.blockReason);
                needsOwnerReview = true;
            }
        }
        else {
            const retail = computeRetailIncentive({
                salesInr: orderTotal,
                avgRealizationPct,
                monthlyAchievementPct: projectedAchievement,
                config,
            });
            totalIncentive = retail.incentive;
            basePct = retail.basePct;
            mult = retail.multiplier;
        }
        const allocations = allocateIncentive(lineInternals, totalIncentive);
        const results = lineInternals.map((l, i) => ({
            variantId: l.variantId,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            listedPrice: l.listedPrice,
            sellingPrice: l.sellingPrice,
            recommendedPrice: l.recommendedPrice,
            safePrice: l.safePrice,
            hardFloorPrice: l.hardFloorPrice,
            realizationPct: l.realizationPct,
            incentivePerUnit: l.qty > 0 ? round2(allocations[i] / l.qty) : 0,
            incentiveTotal: allocations[i],
            grossProfitPerUnit: l.grossProfitPerUnit,
            grossProfitTotal: l.grossProfitTotal,
            warningLevel: l.warningLevel,
            warningMessage: l.warningMessage,
            allowed: l.allowed,
        }));
        if (retailOrBulk === 'retail') {
            mult = realizationMultiplier(avgRealizationPct, config);
        }
        return {
            lines: results,
            retailOrBulk,
            orderTotal,
            subtotalGrossProfit,
            avgRealizationPct,
            totalIncentive,
            baseIncentivePct: basePct,
            realizationMultiplier: mult,
            monthlyAchievementPct: round2(projectedAchievement),
            monthlyMtdSalesInr: round2(mtdSales),
            bulkGrossMarginPct,
            performanceHint: hintFromRealization(avgRealizationPct),
            warnings,
            needsOwnerReview,
            hardFloorBlocked: results.some((l) => !l.allowed),
        };
    },
    async recordQuoteLedger(input) {
        let employeeProfileId = null;
        let farmerId = null;
        if (input.adminUserId) {
            const { data: profile } = await supabase
                .from('employee_profiles')
                .select('id')
                .eq('admin_user_id', input.adminUserId)
                .maybeSingle();
            employeeProfileId = profile?.id ? String(profile.id) : null;
        }
        if (input.leadId) {
            const { data: lead } = await supabase
                .from('leads')
                .select('farmer_id')
                .eq('id', input.leadId)
                .maybeSingle();
            farmerId = lead?.farmer_id ? String(lead.farmer_id) : null;
        }
        await supabase
            .from('employee_sales_ledger')
            .delete()
            .eq('commerce_quote_id', input.quoteId)
            .eq('status', 'quoted');
        const orderValue = input.preview.orderTotal;
        const rows = input.preview.lines.map((line, i) => {
            const src = input.lineItems[i];
            const gp = line.grossProfitTotal;
            return {
                admin_user_id: input.adminUserId ?? null,
                employee_profile_id: employeeProfileId,
                commerce_quote_id: input.quoteId,
                lead_id: input.leadId ?? null,
                farmer_id: farmerId,
                variant_id: src?.variantId ?? line.variantId ?? null,
                sku: src?.sku ?? line.sku ?? null,
                product_title: src?.title ?? line.title ?? null,
                qty: src?.qty ?? line.qty,
                listed_price: line.listedPrice,
                final_unit_price: line.sellingPrice,
                discount_pct: line.listedPrice > 0 ? round2((1 - line.sellingPrice / line.listedPrice) * 100) : 0,
                realization_pct: line.realizationPct,
                effective_cost: round2(line.sellingPrice - line.grossProfitPerUnit),
                incentive_amount: line.incentiveTotal,
                gross_profit: gp,
                net_profit: gp,
                order_type: input.preview.retailOrBulk === 'bulk' ? 'bulk' : 'standard',
                retail_or_bulk: input.preview.retailOrBulk,
                order_value_inr: orderValue,
                gross_margin_pct: orderValue > 0 ? round2((input.preview.subtotalGrossProfit / orderValue) * 100) : 0,
                sales_source: input.salesSource ?? 'telecaller',
                status: 'quoted',
            };
        });
        if (rows.length) {
            const { error } = await supabase.from('employee_sales_ledger').insert(rows);
            throwIfSupabaseError(error, 'Record sales ledger');
        }
        const { error: quoteErr } = await supabase
            .from('commerce_quotes')
            .update({
            pricing_summary: {
                retailOrBulk: input.preview.retailOrBulk,
                avgRealizationPct: input.preview.avgRealizationPct,
                totalIncentive: input.preview.totalIncentive,
                baseIncentivePct: input.preview.baseIncentivePct,
                realizationMultiplier: input.preview.realizationMultiplier,
                monthlyAchievementPct: input.preview.monthlyAchievementPct,
                subtotalGrossProfit: input.preview.subtotalGrossProfit,
                bulkGrossMarginPct: input.preview.bulkGrossMarginPct,
                performanceHint: input.preview.performanceHint,
                warnings: input.preview.warnings,
            },
            total_incentive: input.preview.totalIncentive,
            avg_realization_pct: input.preview.avgRealizationPct,
            order_type: input.preview.retailOrBulk === 'bulk' ? 'bulk' : 'standard',
            updated_at: new Date().toISOString(),
        })
            .eq('id', input.quoteId);
        throwIfSupabaseError(quoteErr, 'Update quote pricing summary');
    },
    validateHardFloors(preview) {
        if (!preview.hardFloorBlocked)
            return;
        const blocked = preview.lines.filter((l) => !l.allowed);
        const msg = blocked.map((l) => l.warningMessage).filter(Boolean).join('; ');
        throw new AppError(msg || 'Price below hard floor', 400, 'HARD_FLOOR');
    },
    validateBulkMargin(preview, opts) {
        if (!preview.needsOwnerReview)
            return;
        if (opts?.approved)
            return;
        if (opts?.requestReview)
            return;
        throw new AppError(preview.warnings.find((w) => w.includes('owner review')) ??
            'Bulk margin below minimum — request owner review before sending', 400, 'BULK_MARGIN_REVIEW');
    },
};
//# sourceMappingURL=incentive-engine.service.js.map
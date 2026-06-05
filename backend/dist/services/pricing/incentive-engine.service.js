import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError } from '../../lib/errors.js';
import { pricingConfigService } from './pricing-config.service.js';
import { safePriceEngineService } from './safe-price-engine.service.js';
function round2(n) {
    return Math.round(n * 100) / 100;
}
function realizationStatus(pct, config) {
    if (pct >= config.realizationExcellent)
        return 'excellent';
    if (pct >= config.realizationGood)
        return 'good';
    if (pct >= config.realizationWarning)
        return 'warning';
    return 'critical';
}
export const incentiveEngineService = {
    computeLine(input) {
        const { tiers, qty, config } = input;
        const sellingPrice = round2(Number(input.sellingPrice) || 0);
        const listed = tiers.listedPrice || sellingPrice;
        const hardFloor = tiers.hardFloorPrice || 0;
        const factor = input.incentiveFactor ?? config.incentiveFactor;
        const realizationPct = listed > 0 ? round2((sellingPrice / listed) * 100) : 100;
        const allowed = hardFloor <= 0 || sellingPrice >= hardFloor;
        let incentivePerUnit = 0;
        if (allowed && sellingPrice > hardFloor) {
            incentivePerUnit = round2(Math.max(0, (sellingPrice - hardFloor) * factor));
        }
        const effectiveCost = tiers.effectiveCost || 0;
        const grossProfitPerUnit = round2(sellingPrice - effectiveCost);
        const platformCost = round2(sellingPrice * (config.platformCostPct / 100));
        const adCost = round2(sellingPrice * (config.adAllocationPct / 100));
        const returnRisk = round2(sellingPrice * (config.returnRiskPct / 100));
        const netProfitPerUnit = round2(grossProfitPerUnit - platformCost - adCost - returnRisk - incentivePerUnit);
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
        else if (sellingPrice < tiers.safePrice) {
            warningLevel = 'low_margin';
            warningMessage = `Below safe price — very low incentive`;
        }
        return {
            qty,
            listedPrice: listed,
            sellingPrice,
            recommendedPrice: tiers.recommendedPrice,
            hardFloorPrice: hardFloor,
            realizationPct,
            incentivePerUnit,
            incentiveTotal: round2(incentivePerUnit * qty),
            grossProfitPerUnit,
            grossProfitTotal: round2(grossProfitPerUnit * qty),
            netProfitPerUnit,
            netProfitTotal: round2(netProfitPerUnit * qty),
            warningLevel,
            warningMessage,
            allowed,
        };
    },
    computeBulkBonus(orderTotal, config) {
        if (orderTotal >= 100_000)
            return config.bulkBonus100k;
        if (orderTotal >= 50_000)
            return config.bulkBonus50k;
        if (orderTotal >= 25_000)
            return config.bulkBonus25k;
        return 0;
    },
    async previewQuote(input) {
        const config = await pricingConfigService.getConfig();
        let employeeFactor;
        if (input.adminUserId) {
            const { data: profile } = await supabase
                .from('employee_profiles')
                .select('id')
                .eq('admin_user_id', input.adminUserId)
                .maybeSingle();
            if (profile?.id) {
                const { data: comp } = await supabase
                    .from('employee_compensation')
                    .select('incentive_factor, pricing_access_restricted')
                    .eq('employee_profile_id', profile.id)
                    .maybeSingle();
                if (comp?.pricing_access_restricted) {
                    throw new AppError('Pricing access restricted — contact manager', 403, 'PRICING_RESTRICTED');
                }
                if (comp?.incentive_factor != null) {
                    employeeFactor = Number(comp.incentive_factor);
                }
            }
        }
        const results = [];
        let orderTotal = 0;
        for (const line of input.lines) {
            const tiers = await safePriceEngineService.resolveByVariantOrSku({
                variantId: line.variantId,
                sku: line.sku,
                catalogListedPrice: line.catalogListedPrice ?? line.unitPrice,
            });
            const computed = this.computeLine({
                tiers,
                sellingPrice: line.unitPrice,
                qty: line.qty,
                incentiveFactor: employeeFactor,
                config,
            });
            results.push({
                ...computed,
                variantId: line.variantId,
                sku: line.sku,
                title: line.title,
            });
            orderTotal += line.unitPrice * line.qty * (1 + 0); // ex-GST line value for bulk bonus uses selling
        }
        // Recalculate order total with GST-neutral subtotal for bulk bonus
        orderTotal = input.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const subtotalIncentive = round2(results.reduce((s, l) => s + l.incentiveTotal, 0));
        const subtotalGrossProfit = round2(results.reduce((s, l) => s + l.grossProfitTotal, 0));
        const subtotalNetProfit = round2(results.reduce((s, l) => s + l.netProfitTotal, 0));
        const avgRealizationPct = results.length > 0
            ? round2(results.reduce((s, l) => s + l.realizationPct, 0) / results.length)
            : 100;
        const bulkOrderBonus = input.orderType === 'bulk' ? this.computeBulkBonus(orderTotal, config) : 0;
        const totalIncentive = round2(subtotalIncentive + bulkOrderBonus);
        const warnings = results
            .filter((l) => l.warningMessage)
            .map((l) => l.warningMessage);
        return {
            lines: results,
            subtotalIncentive,
            subtotalGrossProfit,
            subtotalNetProfit,
            avgRealizationPct,
            bulkOrderBonus,
            totalIncentive,
            orderTotal: round2(orderTotal),
            performanceHint: realizationStatus(avgRealizationPct, config),
            warnings,
        };
    },
    async recordQuoteLedger(input) {
        let employeeProfileId = null;
        if (input.adminUserId) {
            const { data: profile } = await supabase
                .from('employee_profiles')
                .select('id')
                .eq('admin_user_id', input.adminUserId)
                .maybeSingle();
            employeeProfileId = profile?.id ? String(profile.id) : null;
        }
        await supabase
            .from('employee_sales_ledger')
            .delete()
            .eq('commerce_quote_id', input.quoteId)
            .eq('status', 'quoted');
        const rows = input.preview.lines.map((line, i) => {
            const src = input.lineItems[i];
            return {
                admin_user_id: input.adminUserId ?? null,
                employee_profile_id: employeeProfileId,
                commerce_quote_id: input.quoteId,
                lead_id: input.leadId ?? null,
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
                gross_profit: line.grossProfitTotal,
                net_profit: line.netProfitTotal,
                order_type: input.orderType ?? 'standard',
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
                avgRealizationPct: input.preview.avgRealizationPct,
                totalIncentive: input.preview.totalIncentive,
                subtotalGrossProfit: input.preview.subtotalGrossProfit,
                subtotalNetProfit: input.preview.subtotalNetProfit,
                performanceHint: input.preview.performanceHint,
                warnings: input.preview.warnings,
            },
            total_incentive: input.preview.totalIncentive,
            avg_realization_pct: input.preview.avgRealizationPct,
            order_type: input.orderType ?? 'standard',
            updated_at: new Date().toISOString(),
        })
            .eq('id', input.quoteId);
        throwIfSupabaseError(quoteErr, 'Update quote pricing summary');
    },
    validateHardFloors(preview) {
        const blocked = preview.lines.filter((l) => !l.allowed);
        if (blocked.length) {
            const msg = blocked.map((l) => l.warningMessage).filter(Boolean).join('; ');
            throw new AppError(msg || 'Price below hard floor', 400, 'HARD_FLOOR');
        }
    },
};
//# sourceMappingURL=incentive-engine.service.js.map
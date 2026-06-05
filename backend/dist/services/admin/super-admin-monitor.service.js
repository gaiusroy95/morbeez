import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { pricingConfigService } from '../pricing/pricing-config.service.js';
import { inventoryService } from '../wms/inventory.service.js';
import { financeService } from '../oms/finance.service.js';
import { employeeKpiService } from '../pricing/employee-kpi.service.js';
import { marketingSpendService } from './marketing-spend.service.js';
function monthBounds(monthYear) {
    const [y, m] = monthYear.split('-').map(Number);
    return {
        start: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
        end: new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString(),
    };
}
function dayBounds(date) {
    return {
        start: `${date}T00:00:00.000Z`,
        end: `${date}T23:59:59.999Z`,
    };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
function contributionLabel(netContribution, grossProfit) {
    if (grossProfit <= 0)
        return 'Weak';
    const ratio = netContribution / grossProfit;
    if (ratio >= 0.75)
        return 'Strong';
    if (ratio >= 0.5)
        return 'Good';
    if (ratio >= 0.25)
        return 'Moderate';
    return 'Weak';
}
function realizationStatus(pct, config) {
    if (pct >= config.realizationExcellent)
        return 'Healthy';
    if (pct >= config.realizationGood)
        return 'Good';
    if (pct >= config.realizationWarning)
        return 'Watch';
    return 'Risk';
}
function complaintLevel(returnPct) {
    if (returnPct >= 5)
        return 'High';
    if (returnPct >= 2.5)
        return 'Medium';
    return 'Low';
}
async function loadLedger(start, end) {
    const { data, error } = await supabase
        .from('employee_sales_ledger')
        .select('*')
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .in('status', ['quoted', 'confirmed', 'paid', 'returned']);
    throwIfSupabaseError(error, 'Load sales ledger');
    return (data ?? []);
}
export const superAdminMonitorService = {
    async refreshMonitor(opts) {
        const monthYear = opts?.monthYear ?? new Date().toISOString().slice(0, 7);
        await employeeKpiService.recomputeAllForMonth(monthYear);
        return this.getMonitor(opts);
    },
    async getMonitor(opts) {
        const today = opts?.date ?? new Date().toISOString().slice(0, 10);
        const monthYear = opts?.monthYear ?? today.slice(0, 7);
        const { start: dayStart, end: dayEnd } = dayBounds(today);
        const { start: monthStart, end: monthEnd } = monthBounds(monthYear);
        const config = await pricingConfigService.getConfig();
        const [dayLedger, monthLedger, finance, stockSummary, pendingBulkReviews, shipmentExceptions, loggedAdSpend] = await Promise.all([
            loadLedger(dayStart, dayEnd),
            loadLedger(monthStart, monthEnd),
            financeService.getDashboard().catch(() => null),
            inventoryService.getStockSummary().catch(() => []),
            supabase
                .from('bulk_margin_review_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending'),
            supabase
                .from('shipment_exceptions')
                .select('id, commerce_order_id, exception_type, status, created_at')
                .gte('created_at', monthStart)
                .lte('created_at', monthEnd),
            marketingSpendService.getMonthTotal(monthYear).catch(() => 0),
        ]);
        const summarize = (rows) => {
            const sales = rows.reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
            const gp = rows.reduce((s, r) => s + Number(r.gross_profit), 0);
            const weightedRealization = sales > 0
                ? rows.reduce((s, r) => s + Number(r.realization_pct) * Number(r.final_unit_price) * Number(r.qty), 0) /
                    sales
                : 0;
            const quoteIds = new Set(rows.map((r) => r.commerce_quote_id).filter(Boolean));
            const retailSales = rows
                .filter((r) => r.retail_or_bulk !== 'bulk')
                .reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
            const bulkSales = rows
                .filter((r) => r.retail_or_bulk === 'bulk')
                .reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
            const paidSales = rows
                .filter((r) => r.status === 'paid')
                .reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
            return {
                totalSales: round2(sales),
                grossProfit: round2(gp),
                avgRealizationPct: round2(weightedRealization),
                ordersCount: quoteIds.size,
                retailSales: round2(retailSales),
                bulkSales: round2(bulkSales),
                cashCollected: round2(paidSales),
            };
        };
        const dailySummary = summarize(dayLedger);
        const monthSummary = summarize(monthLedger);
        const { data: profiles } = await supabase
            .from('employee_profiles')
            .select('id, full_name, employee_code, admin_user_id')
            .eq('status', 'active');
        const profileMap = new Map((profiles ?? []).map((p) => [String(p.id), { fullName: String(p.full_name), employeeCode: String(p.employee_code ?? '') }]));
        const byEmployee = new Map();
        for (const r of monthLedger) {
            const eid = r.employee_profile_id ? String(r.employee_profile_id) : 'unassigned';
            const cur = byEmployee.get(eid) ?? {
                sales: 0,
                gp: 0,
                incentive: 0,
                returnCost: 0,
                realizationWeighted: 0,
                realizationSales: 0,
                nearFloorOrders: new Set(),
                discountSum: 0,
                discountCount: 0,
                totalLines: 0,
                returnedLines: 0,
            };
            const lineSales = Number(r.final_unit_price) * Number(r.qty);
            cur.sales += lineSales;
            cur.gp += Number(r.gross_profit);
            cur.incentive += Number(r.incentive_amount);
            if (r.status === 'returned') {
                cur.returnedLines += 1;
                cur.returnCost += Math.abs(Number(r.gross_profit));
            }
            cur.realizationWeighted += Number(r.realization_pct) * lineSales;
            cur.realizationSales += lineSales;
            cur.totalLines += 1;
            const discount = Number(r.discount_pct) || 0;
            cur.discountSum += discount;
            cur.discountCount += 1;
            if ((discount >= 12 || Number(r.realization_pct) < config.realizationWarning) &&
                r.commerce_quote_id) {
                cur.nearFloorOrders.add(String(r.commerce_quote_id));
            }
            byEmployee.set(eid, cur);
        }
        const totalMonthSales = monthSummary.totalSales;
        const adSpendTotal = loggedAdSpend > 0 ? round2(loggedAdSpend) : round2(totalMonthSales * 0.02);
        const adSpendSource = loggedAdSpend > 0 ? 'logged' : 'estimated';
        const employeeHeadwise = [...byEmployee.entries()]
            .filter(([id]) => id !== 'unassigned')
            .map(([employeeProfileId, m]) => {
            const prof = profileMap.get(employeeProfileId);
            const avgRealization = m.realizationSales > 0 ? m.realizationWeighted / m.realizationSales : 0;
            const adAllocation = totalMonthSales > 0 ? round2((m.sales / totalMonthSales) * adSpendTotal) : 0;
            const netContribution = round2(m.gp - m.incentive - m.returnCost - adAllocation);
            return {
                employeeProfileId,
                fullName: prof?.fullName ?? 'Unknown',
                employeeCode: prof?.employeeCode ?? '—',
                salesInr: round2(m.sales),
                grossProfitInr: round2(m.gp),
                avgRealizationPct: round2(avgRealization),
                incentiveInr: round2(m.incentive),
                returnCostInr: round2(m.returnCost),
                adAllocationInr: round2(adAllocation),
                netContributionInr: netContribution,
                contributionLabel: contributionLabel(netContribution, m.gp),
                realizationStatus: realizationStatus(avgRealization, config),
            };
        })
            .sort((a, b) => b.netContributionInr - a.netContributionInr);
        const realizationMonitoring = employeeHeadwise.map((e) => ({
            employeeProfileId: e.employeeProfileId,
            fullName: e.fullName,
            avgRealizationPct: e.avgRealizationPct,
            status: e.realizationStatus,
        }));
        const marginLeakage = [...byEmployee.entries()]
            .filter(([id]) => id !== 'unassigned')
            .map(([employeeProfileId, m]) => {
            const prof = profileMap.get(employeeProfileId);
            return {
                employeeProfileId,
                fullName: prof?.fullName ?? 'Unknown',
                ordersNearFloor: m.nearFloorOrders.size,
                avgDiscountPct: round2(m.discountCount > 0 ? m.discountSum / m.discountCount : 0),
                atRisk: m.nearFloorOrders.size >= 10 || (m.discountCount > 0 && m.discountSum / m.discountCount >= 15),
            };
        })
            .sort((a, b) => b.ordersNearFloor - a.ordersNearFloor);
        const bulkByCustomer = new Map();
        const bulkQuoteIds = [
            ...new Set(monthLedger.filter((r) => r.retail_or_bulk === 'bulk' && r.commerce_quote_id).map((r) => String(r.commerce_quote_id))),
        ];
        if (bulkQuoteIds.length) {
            const { data: quotes } = await supabase
                .from('commerce_quotes')
                .select('id, customer_name, farmer_id, total, lead_id')
                .in('id', bulkQuoteIds);
            const quoteMap = new Map((quotes ?? []).map((q) => [String(q.id), q]));
            for (const r of monthLedger.filter((l) => l.retail_or_bulk === 'bulk')) {
                const qid = r.commerce_quote_id ? String(r.commerce_quote_id) : null;
                const quote = qid ? quoteMap.get(qid) : null;
                const customerKey = quote?.farmer_id
                    ? String(quote.farmer_id)
                    : quote?.lead_id
                        ? String(quote.lead_id)
                        : quote?.customer_name
                            ? String(quote.customer_name)
                            : 'unknown';
                const customerName = quote?.customer_name ? String(quote.customer_name) : 'Bulk customer';
                const cur = bulkByCustomer.get(customerKey) ?? { customerKey, customerName, sales: 0, gp: 0 };
                cur.sales += Number(r.final_unit_price) * Number(r.qty);
                cur.gp += Number(r.gross_profit);
                bulkByCustomer.set(customerKey, cur);
            }
        }
        const bulkOrderProfit = [...bulkByCustomer.values()]
            .map((b) => ({
            customerKey: b.customerKey,
            customerName: b.customerName,
            salesInr: round2(b.sales),
            grossProfitInr: round2(b.gp),
            marginPct: b.sales > 0 ? round2((b.gp / b.sales) * 100) : 0,
            atRisk: b.sales > 0 && (b.gp / b.sales) * 100 < config.bulkMinGrossMarginPct,
        }))
            .sort((a, b) => b.salesInr - a.salesInr);
        const returnComplaints = [...byEmployee.entries()]
            .filter(([id]) => id !== 'unassigned')
            .map(([employeeProfileId, m]) => {
            const prof = profileMap.get(employeeProfileId);
            const returnPct = m.totalLines > 0 ? (m.returnedLines / m.totalLines) * 100 : 0;
            return {
                employeeProfileId,
                fullName: prof?.fullName ?? 'Unknown',
                returnPct: round2(returnPct),
                complaintLevel: complaintLevel(returnPct),
            };
        })
            .sort((a, b) => b.returnPct - a.returnPct);
        const kpiDashboard = await employeeKpiService.getDashboard(monthYear);
        const employeePerformance = kpiDashboard.employees.map((e) => ({
            employeeProfileId: e.employeeProfileId,
            fullName: e.fullName,
            kpiScore: e.totalScore,
            grade: e.grade,
            salesVolumeInr: e.salesVolumeInr,
            incentiveEarnedInr: e.incentiveEarnedInr,
        }));
        const stockRows = stockSummary;
        let lowInventory = 0;
        let deadStock = 0;
        let agingStock = 0;
        let fastMoving = 0;
        let stockValue = 0;
        const skuSales = new Map();
        for (const r of monthLedger) {
            if (!r.product_title)
                continue;
            skuSales.set(r.product_title, (skuSales.get(r.product_title) ?? 0) + Number(r.qty));
        }
        const now = Date.now();
        for (const row of stockRows) {
            const avail = Number(row.available) || 0;
            if (avail > 0 && avail <= 10)
                lowInventory += 1;
            const sold = skuSales.get(row.productTitle) ?? 0;
            if (avail > 0 && sold === 0)
                deadStock += 1;
            if (sold >= 20)
                fastMoving += 1;
            for (const b of row.batches ?? []) {
                stockValue += Number(b.qtyOnHand) || 0;
                if (b.expiryDate) {
                    const days = (new Date(b.expiryDate).getTime() - now) / (86400000);
                    if (days >= 0 && days <= 60)
                        agingStock += 1;
                }
            }
        }
        const inventoryHealth = {
            deadStock,
            fastMovingStock: fastMoving,
            lowInventory,
            agingStock,
            stockValueUnits: stockValue,
        };
        const codPending = finance?.pendingCod ?? 0;
        const cashCollected = monthSummary.cashCollected || dailySummary.cashCollected;
        const grossProfitMonth = monthSummary.grossProfit;
        const totalIncentive = employeeHeadwise.reduce((s, e) => s + e.incentiveInr, 0);
        const cashFlow = {
            codPending: round2(codPending),
            receivables: round2(codPending),
            cashCollected: round2(cashCollected),
            adSpend: adSpendTotal,
            adSpendSource,
            profitAfterExpenses: round2(grossProfitMonth - totalIncentive - adSpendTotal),
        };
        const alerts = [];
        for (const e of employeeHeadwise) {
            if (e.avgRealizationPct < config.realizationWarning) {
                alerts.push({
                    id: `realization-${e.employeeProfileId}`,
                    severity: e.avgRealizationPct < 85 ? 'critical' : 'warning',
                    title: 'Low realization',
                    detail: `${e.fullName} at ${e.avgRealizationPct}% (below ${config.realizationWarning}%)`,
                    action: {
                        kind: 'employee',
                        href: `/employees/${e.employeeProfileId}`,
                        employeeProfileId: e.employeeProfileId,
                    },
                });
            }
            if (e.contributionLabel === 'Weak') {
                alerts.push({
                    id: `weak-contrib-${e.employeeProfileId}`,
                    severity: 'critical',
                    title: 'Weak net contribution',
                    detail: `${e.fullName} — high discount/incentive drag on profit`,
                    action: {
                        kind: 'employee',
                        href: `/employees/${e.employeeProfileId}`,
                        employeeProfileId: e.employeeProfileId,
                    },
                });
            }
        }
        for (const b of bulkOrderProfit.filter((x) => x.atRisk)) {
            alerts.push({
                id: `bulk-margin-${b.customerKey}`,
                severity: 'critical',
                title: 'Bulk order below safe margin',
                detail: `${b.customerName}: ${b.marginPct}% margin (min ${config.bulkMinGrossMarginPct}%)`,
                action: { kind: 'employees', href: '/employees#bulk-margin-reviews' },
            });
        }
        for (const r of returnComplaints.filter((x) => x.complaintLevel === 'High')) {
            alerts.push({
                id: `returns-${r.employeeProfileId}`,
                severity: 'warning',
                title: 'Return spike',
                detail: `${r.fullName} return rate ${r.returnPct}%`,
                action: {
                    kind: 'employee',
                    href: `/employees/${r.employeeProfileId}`,
                    employeeProfileId: r.employeeProfileId,
                },
            });
        }
        if (deadStock > 5) {
            alerts.push({
                id: 'dead-stock',
                severity: 'warning',
                title: 'Dead stock increasing',
                detail: `${deadStock} SKUs with stock but no sales this month`,
                action: { kind: 'warehouse', href: '/warehouse' },
            });
        }
        if ((pendingBulkReviews.count ?? 0) > 0) {
            alerts.push({
                id: 'bulk-reviews-pending',
                severity: 'warning',
                title: 'Bulk margin reviews pending',
                detail: `${pendingBulkReviews.count} quote(s) awaiting owner approval`,
                action: { kind: 'employees', href: '/employees#bulk-margin-reviews' },
            });
        }
        if (monthSummary.grossProfit < 0) {
            alerts.push({
                id: 'negative-profit',
                severity: 'critical',
                title: 'Negative profit trend',
                detail: `Month gross profit ${monthSummary.grossProfit}`,
                action: { kind: 'commerce', href: '/commerce' },
            });
        }
        const exceptionCount = (shipmentExceptions.data ?? []).length;
        if (exceptionCount >= 5) {
            alerts.push({
                id: 'shipment-exceptions',
                severity: 'warning',
                title: 'Shipment exceptions elevated',
                detail: `${exceptionCount} NDR/RTO/exception events this month`,
                action: { kind: 'commerce', href: '/commerce' },
            });
        }
        alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
        return {
            asOf: today,
            monthYear,
            dailySummary,
            monthSummary,
            employeeHeadwise,
            realizationMonitoring,
            bulkOrderProfit,
            marginLeakage,
            inventoryHealth,
            returnComplaints,
            employeePerformance,
            cashFlow,
            alerts: alerts.slice(0, 12),
        };
    },
};
//# sourceMappingURL=super-admin-monitor.service.js.map
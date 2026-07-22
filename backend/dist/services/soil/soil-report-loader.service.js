import { supabase } from '../../lib/supabase.js';
import { formatSoilMetricsForAi, formatSoilMetricsMultiline, hasAnyMetricValue, normalizeSoilMetrics, } from './soil-lab-metrics.js';
async function fetchLatestRow(farmerId, blockId) {
    if (blockId) {
        const { data } = await supabase
            .from('crm_soil_reports')
            .select('metrics, reported_at, lab_name, block_id')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .order('reported_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (data?.metrics)
            return data;
    }
    const { data } = await supabase
        .from('crm_soil_reports')
        .select('metrics, reported_at, lab_name, block_id')
        .eq('farmer_id', farmerId)
        .order('reported_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data ?? null;
}
export const soilReportLoaderService = {
    async loadLatestForBlock(farmerId, blockId) {
        const row = await fetchLatestRow(farmerId, blockId);
        if (!row?.metrics)
            return null;
        const metrics = normalizeSoilMetrics(row.metrics);
        if (!hasAnyMetricValue(metrics))
            return null;
        const reportedAt = row.reported_at ? String(row.reported_at) : null;
        const labName = row.lab_name ? String(row.lab_name) : null;
        const summaryLine = formatSoilMetricsForAi(metrics, { reportedAt, labName, maxLines: 8 }) ?? '';
        const reportLines = formatSoilMetricsMultiline(metrics, { reportedAt, labName, maxLines: 8 });
        return {
            reportedAt,
            labName,
            summaryLine,
            reportLines,
            metrics,
        };
    },
};
//# sourceMappingURL=soil-report-loader.service.js.map
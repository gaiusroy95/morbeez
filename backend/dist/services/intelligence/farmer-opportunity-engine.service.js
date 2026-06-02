import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { opportunityScoreStoreService } from './opportunity-score-store.service.js';
import { opportunityIntelligenceConfigService } from './opportunity-intelligence-config.service.js';
import { computeFarmerScoreComponents, computeRetentionRisk, } from './farmer-opportunity-scoring.util.js';
const INBOUND_EVENT_TYPES = new Set([
    'MESSAGE_REPLY',
    'IMAGE_UPLOAD',
    'VOICE_NOTE',
]);
const RICH_MEDIA_TYPES = new Set(['IMAGE_UPLOAD', 'VOICE_NOTE']);
function daysAgoIso(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function daysSince(iso) {
    if (!iso)
        return null;
    const ms = Date.now() - new Date(iso).getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000));
}
async function loadSignals(farmerId) {
    const since30 = daysAgoIso(30);
    const since90 = daysAgoIso(90);
    const since180 = daysAgoIso(180);
    const [farmerRes, blocksRes, leadRes, events30Res, events90Res, attrRes, recRes, ordersRes, roiRes, sessionsRes, lastInboundRes, soilReports90Res, findings90Res,] = await Promise.all([
        supabase
            .from('farmers')
            .select('id, total_acreage, district, state')
            .eq('id', farmerId)
            .maybeSingle(),
        supabase
            .from('farm_blocks')
            .select('crop_type, acreage_decimal, is_primary, soil_health')
            .eq('farmer_id', farmerId)
            .is('archived_at', null),
        supabase
            .from('leads')
            .select('assigned_to, referral_source, campaign_source')
            .eq('farmer_id', farmerId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('farmer_events')
            .select('event_type, occurred_at')
            .eq('farmer_id', farmerId)
            .gte('occurred_at', since30),
        supabase
            .from('farmer_events')
            .select('event_type, occurred_at')
            .eq('farmer_id', farmerId)
            .gte('occurred_at', since90),
        supabase
            .from('employee_farmer_attribution')
            .select('id')
            .eq('farmer_id', farmerId)
            .eq('active', true)
            .gte('last_touch_at', since30),
        supabase
            .from('recommendation_records')
            .select('status, outcome, communicated_at, applied_at')
            .eq('farmer_id', farmerId),
        supabase
            .from('commerce_orders')
            .select('id')
            .eq('farmer_id', farmerId)
            .eq('payment_status', 'paid')
            .gte('updated_at', since180),
        supabase
            .from('farmer_roi_entries')
            .select('id')
            .eq('farmer_id', farmerId)
            .gte('entry_date', since90.slice(0, 10)),
        supabase
            .from('ai_advisory_sessions')
            .select('id')
            .eq('farmer_id', farmerId)
            .gte('created_at', since90),
        supabase
            .from('interaction_logs')
            .select('created_at')
            .eq('farmer_id', farmerId)
            .eq('direction', 'inbound')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('crm_soil_reports')
            .select('id')
            .eq('farmer_id', farmerId)
            .gte('reported_at', since90),
        supabase
            .from('crm_field_findings')
            .select('id')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .gte('visited_at', since90),
    ]);
    const events30 = events30Res.data ?? [];
    const events90 = events90Res.data ?? [];
    const blocks = blocksRes.data ?? [];
    const recs = recRes.data ?? [];
    const blockAcreSum = blocks.reduce((sum, b) => sum + Number(b.acreage_decimal ?? 0), 0);
    const farmerAcreage = farmerRes.data?.total_acreage != null ? Number(farmerRes.data.total_acreage) : null;
    const totalAcreage = farmerAcreage && farmerAcreage > 0 ? farmerAcreage : blockAcreSum > 0 ? blockAcreSum : null;
    const primaryBlock = blocks.find((b) => b.is_primary) ?? blocks[0];
    const primaryCrop = primaryBlock?.crop_type ? String(primaryBlock.crop_type) : null;
    const inbound30 = events30.filter((e) => INBOUND_EVENT_TYPES.has(String(e.event_type)));
    const richMedia30 = events30.filter((e) => RICH_MEDIA_TYPES.has(String(e.event_type)));
    const outbound30 = events30.filter((e) => String(e.event_type) === 'MESSAGE_SENT');
    const engagement = {
        inboundCount30d: inbound30.length,
        richMediaCount30d: richMedia30.length,
        outboundCount30d: outbound30.length,
    };
    const trust = {
        roiEntryCount90d: roiRes.data?.length ?? 0,
        recommendationsApplied90d: events90.filter((e) => e.event_type === 'RECOMMENDATION_APPLIED').length,
        ordersConverted180d: ordersRes.data?.length ?? events90.filter((e) => e.event_type === 'ORDER_CONVERTED').length,
        positiveOutcomes90d: recs.filter((r) => r.outcome === 'better').length,
    };
    const goodBlocks = blocks.filter((b) => String(b.soil_health ?? 'good') === 'good').length;
    const healthyBlockRatio = blocks.length > 0 ? goodBlocks / blocks.length : null;
    const profile = {
        totalAcreage,
        blockCount: blocks.length,
        primaryCrop,
        hasAssignedLead: Boolean(leadRes.data?.assigned_to),
        soilReports90d: soilReports90Res.data?.length ?? 0,
        fieldFindings90d: findings90Res.data?.length ?? 0,
        healthyBlockRatio,
    };
    const relationship = {
        activeAttributionTouches30d: attrRes.data?.length ?? 0,
        crmFollowUps30d: events30.filter((e) => e.event_type === 'FOLLOWUP_COMPLETED').length,
        hasAssignedLead: Boolean(leadRes.data?.assigned_to),
    };
    const advisory = {
        recommendationsCommunicated90d: recs.filter((r) => r.communicated_at).length,
        recommendationsApplied90d: recs.filter((r) => r.applied_at || r.status === 'applied').length,
        advisorySessions90d: sessionsRes.data?.length ?? 0,
    };
    const referral = {
        referralSource: leadRes.data?.referral_source ? String(leadRes.data.referral_source) : null,
        campaignSource: leadRes.data?.campaign_source ? String(leadRes.data.campaign_source) : null,
    };
    const lastInboundAt = inbound30.length > 0
        ? inbound30.sort((a, b) => new Date(String(b.occurred_at)).getTime() - new Date(String(a.occurred_at)).getTime())[0]?.occurred_at
        : lastInboundRes.data?.created_at;
    return {
        engagement,
        trust,
        profile,
        relationship,
        advisory,
        referral,
        daysSinceLastInbound: daysSince(lastInboundAt ? String(lastInboundAt) : null),
    };
}
async function upsertRetention(farmerId, daysSinceLastInbound) {
    const risk = computeRetentionRisk(daysSinceLastInbound);
    const now = new Date().toISOString();
    const { error } = await supabase.from('farmer_retention_tracking').upsert({
        farmer_id: farmerId,
        risk_band: risk.riskBand,
        retention_score: risk.retentionScore,
        signals: risk.signals,
        days_since_last_inbound: daysSinceLastInbound,
        interaction_trend: daysSinceLastInbound == null
            ? 'unknown'
            : daysSinceLastInbound <= 7
                ? 'active'
                : daysSinceLastInbound <= 30
                    ? 'cooling'
                    : 'inactive',
        calculated_at: now,
    }, { onConflict: 'farmer_id' });
    if (error) {
        logger.warn({ err: error, farmerId }, 'farmer_retention_tracking upsert failed');
    }
}
async function recordMetricSnapshots(farmerId, components, daysSinceLastInbound) {
    const periodEnd = new Date().toISOString();
    const periodStart = daysAgoIso(30);
    const rows = [
        {
            farmer_id: farmerId,
            metric_dimension: 'engagement',
            score: Math.round((components.engagement / 20) * 100),
            max_weight: 20,
            evidence: { component: components.engagement },
            period_start: periodStart,
            period_end: periodEnd,
        },
        {
            farmer_id: farmerId,
            metric_dimension: 'trust',
            score: Math.round((components.trust / 15) * 100),
            max_weight: 15,
            evidence: { component: components.trust },
            period_start: periodStart,
            period_end: periodEnd,
        },
        {
            farmer_id: farmerId,
            metric_dimension: 'relationship',
            score: Math.round((components.relationship / 10) * 100),
            max_weight: 10,
            evidence: { component: components.relationship },
            period_start: periodStart,
            period_end: periodEnd,
        },
        {
            farmer_id: farmerId,
            metric_dimension: 'retention',
            score: computeRetentionRisk(daysSinceLastInbound).retentionScore,
            max_weight: 100,
            evidence: { daysSinceLastInbound },
            period_start: periodStart,
            period_end: periodEnd,
        },
    ];
    const { error } = await supabase.from('farmer_metric_history').insert(rows);
    if (error) {
        logger.warn({ err: error, farmerId }, 'farmer_metric_history insert failed');
    }
}
export const farmerOpportunityEngineService = {
    async scoreFarmer(farmerId) {
        const signals = await loadSignals(farmerId);
        const { components: rawComponents, factors } = computeFarmerScoreComponents(signals);
        const config = await opportunityIntelligenceConfigService.get();
        const components = opportunityIntelligenceConfigService.applyFarmerWeightOverrides(rawComponents, config.effectiveFarmerWeights);
        const snapshot = await opportunityScoreStoreService.upsertFarmerScore(farmerId, components, factors);
        await upsertRetention(farmerId, signals.daysSinceLastInbound);
        await recordMetricSnapshots(farmerId, components, signals.daysSinceLastInbound);
        return snapshot;
    },
    async listFarmerIdsForBatch(opts) {
        const limit = Math.min(opts?.limit ?? 500, 2000);
        const activityDays = opts?.activityDays ?? 90;
        const since = daysAgoIso(activityDays);
        const { data: fromEvents, error: evErr } = await supabase
            .from('farmer_events')
            .select('farmer_id')
            .gte('occurred_at', since)
            .order('occurred_at', { ascending: false })
            .limit(limit * 3);
        throwIfSupabaseError(evErr, 'Could not list farmers for scoring');
        const ids = new Set();
        for (const row of fromEvents ?? []) {
            ids.add(String(row.farmer_id));
            if (ids.size >= limit)
                break;
        }
        if (ids.size < limit) {
            const { data: fromScores } = await supabase
                .from('farmer_scores')
                .select('farmer_id, calculated_at')
                .order('calculated_at', { ascending: true })
                .limit(limit - ids.size);
            for (const row of fromScores ?? []) {
                ids.add(String(row.farmer_id));
            }
        }
        return [...ids].slice(0, limit);
    },
    async runBatch(opts) {
        const dryRun = Boolean(opts?.dryRun);
        const farmerIds = opts?.farmerId
            ? [opts.farmerId]
            : await this.listFarmerIdsForBatch({ limit: opts?.limit });
        let scored = 0;
        let skipped = 0;
        let errors = 0;
        for (const farmerId of farmerIds) {
            try {
                if (dryRun) {
                    skipped++;
                    continue;
                }
                await this.scoreFarmer(farmerId);
                scored++;
            }
            catch (err) {
                errors++;
                logger.warn({ err, farmerId }, 'Farmer opportunity score failed');
            }
        }
        return { scored, skipped: dryRun ? farmerIds.length : skipped, errors, dryRun };
    },
};
//# sourceMappingURL=farmer-opportunity-engine.service.js.map
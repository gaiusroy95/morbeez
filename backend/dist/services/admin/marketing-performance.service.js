import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { CONNECTED_CALL_OUTCOMES, INTERESTED_STAGES, PAID_STAGES, STAGE_RANK, } from '../../domain/marketing/lead-attribution.js';
function pct(numerator, denominator) {
    if (!denominator)
        return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
}
function parseDateRange(from, to) {
    const fromIso = new Date(from).toISOString();
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    return { fromIso, toIso: toEnd.toISOString() };
}
function isAttributedLead(row) {
    return Boolean(row.lead_channel && row.campaign_source);
}
function aggregateFunnel(leadIds, flagsByLead) {
    const leads = leadIds.length;
    let connected = 0;
    let interested = 0;
    let booked = 0;
    let paid = 0;
    let revenueInr = 0;
    for (const id of leadIds) {
        const f = flagsByLead.get(id);
        if (!f)
            continue;
        if (f.connected)
            connected += 1;
        if (f.interested)
            interested += 1;
        if (f.booked)
            booked += 1;
        if (f.paid)
            paid += 1;
        revenueInr += f.revenueInr;
    }
    return {
        leads,
        connected,
        interested,
        booked,
        paid,
        revenueInr: Math.round(revenueInr * 100) / 100,
        conversionPct: pct(paid, leads),
    };
}
async function loadIncentiveRule() {
    const { data, error } = await supabase
        .from('marketing_incentive_rules')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    throwIfSupabaseError(error, 'Load marketing incentive rules');
    return data;
}
function suggestedBonus(counts, rule) {
    if (!rule)
        return 0;
    const raw = counts.connected * Number(rule.flat_connected_inr ?? 0) +
        counts.booked * Number(rule.flat_booked_inr ?? 0) +
        counts.paid * Number(rule.flat_paid_inr ?? 0);
    const cap = rule.monthly_cap_inr != null ? Number(rule.monthly_cap_inr) : null;
    const bonus = Math.round(raw * 100) / 100;
    if (cap != null && cap > 0)
        return Math.min(bonus, cap);
    return bonus;
}
async function buildFunnelFlags(leads) {
    const leadIds = leads.map((l) => l.id);
    const farmerIds = [...new Set(leads.map((l) => l.farmer_id))];
    const flags = new Map();
    if (!leadIds.length)
        return flags;
    const chunk = (arr, size) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size)
            out.push(arr.slice(i, i + size));
        return out;
    };
    const callChunks = chunk(leadIds, 200);
    const quoteChunks = chunk(leadIds, 200);
    const ledgerChunks = chunk(leadIds, 200);
    const soilChunks = chunk(farmerIds, 200);
    const calls = [];
    const quotes = [];
    const soilReports = [];
    const ledger = [];
    for (const ids of callChunks) {
        const { data } = await supabase
            .from('crm_call_logs')
            .select('lead_id, farmer_id, direction, outcome')
            .in('lead_id', ids);
        if (data)
            calls.push(...data);
    }
    for (const ids of quoteChunks) {
        const { data } = await supabase.from('commerce_quotes').select('lead_id').in('lead_id', ids);
        if (data)
            quotes.push(...data);
    }
    for (const ids of soilChunks) {
        const { data } = await supabase.from('crm_soil_reports').select('farmer_id').in('farmer_id', ids);
        if (data)
            soilReports.push(...data);
    }
    for (const ids of ledgerChunks) {
        const { data } = await supabase
            .from('employee_sales_ledger')
            .select('lead_id, gross_profit, status, recorded_at')
            .in('lead_id', ids)
            .eq('status', 'paid');
        if (data)
            ledger.push(...data);
    }
    const connectedByLead = new Set();
    for (const call of calls ?? []) {
        const outcome = String(call.outcome ?? '').toLowerCase();
        const direction = String(call.direction ?? '');
        if (CONNECTED_CALL_OUTCOMES.has(outcome) ||
            (direction === 'outbound' && CONNECTED_CALL_OUTCOMES.has(outcome))) {
            if (call.lead_id)
                connectedByLead.add(String(call.lead_id));
        }
    }
    const quotedLeads = new Set((quotes ?? []).map((q) => String(q.lead_id)));
    const soilFarmers = new Set((soilReports ?? []).map((s) => String(s.farmer_id)));
    const revenueByLead = new Map();
    for (const row of ledger) {
        const lid = String(row.lead_id);
        revenueByLead.set(lid, (revenueByLead.get(lid) ?? 0) + Number(row.gross_profit ?? 0));
    }
    for (const lead of leads) {
        const stage = String(lead.stage ?? 'new_lead');
        const stageRank = STAGE_RANK[stage] ?? 1;
        const connected = connectedByLead.has(lead.id) ||
            Boolean(lead.last_interaction_at) ||
            stage !== 'new_lead';
        const interested = INTERESTED_STAGES.has(stage);
        const booked = quotedLeads.has(lead.id) ||
            soilFarmers.has(lead.farmer_id) ||
            stageRank >= (STAGE_RANK.recommendation ?? 4);
        const paid = PAID_STAGES.has(stage) || revenueByLead.has(lead.id);
        const leadCreated = new Date(lead.created_at).getTime();
        const windowEnd = leadCreated + 90 * 86400000;
        const revenueInr = ledger
            .filter((r) => {
            if (String(r.lead_id) !== lead.id)
                return false;
            const t = new Date(String(r.recorded_at)).getTime();
            return t >= leadCreated && t <= windowEnd;
        })
            .reduce((s, r) => s + Number(r.gross_profit ?? 0), 0);
        flags.set(lead.id, {
            connected,
            interested,
            booked,
            paid,
            revenueInr,
        });
    }
    return flags;
}
async function loadLeads(query) {
    const { fromIso, toIso } = parseDateRange(query.from, query.to);
    let q = supabase
        .from('leads')
        .select('id, farmer_id, stage, created_at, last_interaction_at, lead_channel, campaign_source, marketing_owner_id, marketing_owner_name')
        .gte('created_at', fromIso)
        .lte('created_at', toIso);
    if (query.ownerId)
        q = q.eq('marketing_owner_id', query.ownerId);
    if (query.campaign)
        q = q.ilike('campaign_source', `%${query.campaign}%`);
    if (query.channel)
        q = q.eq('lead_channel', query.channel);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(5000);
    throwIfSupabaseError(error, 'Load marketing leads');
    return (data ?? []);
}
async function sumSpend(query) {
    const { fromIso, toIso } = parseDateRange(query.from, query.to);
    let q = supabase
        .from('marketing_spend_entries')
        .select('amount_inr, spend_date, created_at, channel, campaign_name')
        .eq('channel', 'meta');
    if (query.campaign)
        q = q.ilike('campaign_name', `%${query.campaign}%`);
    if (query.ownerId)
        q = q.eq('marketing_owner_id', query.ownerId);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Load marketing spend');
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();
    return (data ?? []).reduce((sum, row) => {
        const dateStr = row.spend_date ?? String(row.created_at).slice(0, 10);
        const t = new Date(dateStr).getTime();
        if (Number.isNaN(t) || t < fromMs || t > toMs)
            return sum;
        return sum + Number(row.amount_inr ?? 0);
    }, 0);
}
export const marketingPerformanceService = {
    async getOverview(query) {
        const leads = await loadLeads(query);
        const attributed = leads.filter(isAttributedLead);
        const flagsByLead = await buildFunnelFlags(attributed);
        const funnel = aggregateFunnel(attributed.map((l) => l.id), flagsByLead);
        const rule = await loadIncentiveRule();
        funnel.suggestedBonusInr = suggestedBonus(funnel, rule);
        funnel.spendInr = Math.round((await sumSpend(query)) * 100) / 100;
        funnel.roi = funnel.spendInr > 0 ? Math.round((funnel.revenueInr / funnel.spendInr) * 100) / 100 : null;
        const unattributedCount = leads.length - attributed.length;
        const { data: waitingMeta } = await supabase
            .from('leads')
            .select('id, created_at')
            .eq('lead_channel', 'meta')
            .eq('stage', 'new_lead')
            .order('created_at', { ascending: true });
        const waiting = waitingMeta ?? [];
        const oldest = waiting[0]?.created_at ? new Date(String(waiting[0].created_at)) : null;
        const oldestHours = oldest
            ? Math.round(((Date.now() - oldest.getTime()) / 3600000) * 10) / 10
            : null;
        return {
            period: { from: query.from, to: query.to },
            funnel,
            unattributedCount,
            queueHealth: {
                newMetaLeadsWaiting: waiting.length,
                oldestWaitingHours: oldestHours,
                slaTargetHours: 24,
            },
            incentiveRule: rule
                ? {
                    ruleName: rule.rule_name,
                    flatConnectedInr: Number(rule.flat_connected_inr ?? 0),
                    flatBookedInr: Number(rule.flat_booked_inr ?? 0),
                    flatPaidInr: Number(rule.flat_paid_inr ?? 0),
                    monthlyCapInr: rule.monthly_cap_inr != null ? Number(rule.monthly_cap_inr) : null,
                }
                : null,
        };
    },
    async getByMarketer(query) {
        const leads = (await loadLeads(query)).filter(isAttributedLead);
        const flagsByLead = await buildFunnelFlags(leads);
        const rule = await loadIncentiveRule();
        const ownerIds = [
            ...new Set(leads.map((l) => l.marketing_owner_id).filter(Boolean)),
        ];
        const ownerNames = new Map();
        if (ownerIds.length) {
            const { data: profiles } = await supabase
                .from('employee_profiles')
                .select('id, full_name')
                .in('id', ownerIds);
            for (const p of profiles ?? []) {
                ownerNames.set(String(p.id), String(p.full_name ?? 'Marketer'));
            }
        }
        const groups = new Map();
        for (const lead of leads) {
            const key = lead.marketing_owner_id
                ? `id:${lead.marketing_owner_id}`
                : lead.marketing_owner_name
                    ? `name:${lead.marketing_owner_name}`
                    : 'unattributed';
            if (key === 'unattributed')
                continue;
            const existing = groups.get(key) ?? {
                marketerKey: key,
                marketerName: lead.marketing_owner_id
                    ? ownerNames.get(String(lead.marketing_owner_id)) ?? 'Marketer'
                    : String(lead.marketing_owner_name),
                marketerId: lead.marketing_owner_id ? String(lead.marketing_owner_id) : null,
                leadIds: [],
            };
            existing.leadIds.push(lead.id);
            groups.set(key, existing);
        }
        return [...groups.values()]
            .map((g) => {
            const funnel = aggregateFunnel(g.leadIds, flagsByLead);
            return {
                marketerId: g.marketerId,
                marketerName: g.marketerName,
                ...funnel,
                suggestedBonusInr: suggestedBonus(funnel, rule),
            };
        })
            .sort((a, b) => b.leads - a.leads);
    },
    async getByCampaign(query) {
        const leads = (await loadLeads(query)).filter(isAttributedLead);
        const flagsByLead = await buildFunnelFlags(leads);
        const rule = await loadIncentiveRule();
        const groups = new Map();
        for (const lead of leads) {
            const campaign = String(lead.campaign_source ?? 'Unknown');
            const channel = lead.lead_channel;
            const key = `${channel ?? 'unknown'}::${campaign}`;
            const existing = groups.get(key) ?? { campaign, channel, leadIds: [] };
            existing.leadIds.push(lead.id);
            groups.set(key, existing);
        }
        const spendRows = await sumSpendByCampaign(query);
        return [...groups.values()]
            .map((g) => {
            const funnel = aggregateFunnel(g.leadIds, flagsByLead);
            const spendInr = spendRows.get(g.campaign.toLowerCase()) ?? 0;
            return {
                campaign: g.campaign,
                channel: g.channel,
                ...funnel,
                spendInr,
                roi: spendInr > 0 ? Math.round((funnel.revenueInr / spendInr) * 100) / 100 : null,
                suggestedBonusInr: suggestedBonus(funnel, rule),
            };
        })
            .sort((a, b) => b.leads - a.leads);
    },
    async getFunnelDrilldown(leadIds) {
        if (!leadIds.length)
            return [];
        const { data, error } = await supabase
            .from('leads')
            .select('id, farmer_id, stage, created_at, last_interaction_at, lead_channel, campaign_source, marketing_owner_id, marketing_owner_name, farmers(phone, name)')
            .in('id', leadIds.slice(0, 200));
        throwIfSupabaseError(error, 'Load lead drilldown');
        const leads = (data ?? []);
        const flagsByLead = await buildFunnelFlags(leads);
        return leads.map((l) => {
            const farmer = l.farmers;
            const flags = flagsByLead.get(l.id);
            return {
                leadId: l.id,
                farmerName: farmer?.name ?? null,
                phone: farmer?.phone ?? null,
                stage: l.stage,
                channel: l.lead_channel,
                campaign: l.campaign_source,
                ...flags,
            };
        });
    },
    async listMarketingOwners() {
        const { data, error } = await supabase
            .from('employee_profiles')
            .select('id, full_name, department, status')
            .eq('status', 'active')
            .order('full_name', { ascending: true })
            .limit(100);
        throwIfSupabaseError(error, 'Load marketing owners');
        return (data ?? []).map((r) => ({
            id: r.id,
            fullName: r.full_name,
            department: r.department,
        }));
    },
};
async function sumSpendByCampaign(query) {
    const { fromIso, toIso } = parseDateRange(query.from, query.to);
    const { data, error } = await supabase
        .from('marketing_spend_entries')
        .select('amount_inr, campaign_name, spend_date, created_at')
        .eq('channel', 'meta');
    throwIfSupabaseError(error, 'Load campaign spend');
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();
    const map = new Map();
    for (const row of data ?? []) {
        const dateStr = row.spend_date ?? String(row.created_at).slice(0, 10);
        const t = new Date(dateStr).getTime();
        if (Number.isNaN(t) || t < fromMs || t > toMs)
            continue;
        const camp = String(row.campaign_name ?? '').toLowerCase();
        if (!camp)
            continue;
        map.set(camp, (map.get(camp) ?? 0) + Number(row.amount_inr ?? 0));
    }
    return map;
}
export function dateRangeFromDays(days) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}
//# sourceMappingURL=marketing-performance.service.js.map
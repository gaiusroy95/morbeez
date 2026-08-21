import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { evaluateQualifiedCase, present, } from '../../domain/remuneration/qualified-case.js';
import { monthLastDay, monthRange } from '../../domain/remuneration/rule-workflow.js';
import { earningRulesService } from './earning-rules.service.js';
const PAGE = 200;
function chunk(items, size = 80) {
    const out = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}
function asObj(value) {
    if (value && typeof value === 'object' && !Array.isArray(value))
        return value;
    return {};
}
function asList(value) {
    return Array.isArray(value) ? value : [];
}
function emailish(value) {
    const s = String(value ?? '').trim().toLowerCase();
    return s.includes('@') ? s : null;
}
function farmerVerified(farmer) {
    if (!farmer)
        return false;
    return (present(farmer.name) &&
        present(farmer.phone) &&
        (present(farmer.village) || present(farmer.district) || present(farmer.state)));
}
function factsFrom(input) {
    return {
        farmerVerified: farmerVerified(input.farmer),
        cropRecorded: present(input.crop),
        cropStageRecorded: present(input.cropStage),
        problemRecorded: present(input.problem),
        diagnosisRecorded: present(input.diagnosis),
        recommendationRecorded: present(input.recommendation),
        evidenceComplete: present(input.evidence),
    };
}
async function loadMap(table, ids, columns) {
    const map = new Map();
    const unique = [...new Set(ids.filter(Boolean))];
    for (const part of chunk(unique)) {
        const { data } = await supabase.from(table).select(columns).in('id', part);
        for (const row of (data ?? [])) {
            const id = String(row.id ?? '');
            if (id)
                map.set(id, row);
        }
    }
    return map;
}
async function upsertCase(row) {
    const { error } = await supabase.from('qualified_cases').upsert({
        ...row,
        evaluated_at: new Date().toISOString(),
    }, { onConflict: 'source_type,source_id' });
    throwIfSupabaseError(error, 'Could not save qualified case');
}
export const qualifiedCaseEngine = {
    async list(month, qualified) {
        let q = supabase
            .from('qualified_cases')
            .select('*')
            .eq('period_month', month)
            .order('evaluated_at', { ascending: false })
            .limit(500);
        if (qualified != null)
            q = q.eq('qualified', qualified);
        const { data } = await q;
        return data ?? [];
    },
    async scanMonth(month, limit = PAGE) {
        const rule = await earningRulesService.qualifiedCaseRule(monthLastDay(month));
        const { startIso, endIso } = monthRange(month);
        const scannedCases = await scanExpertCases(month, startIso, endIso, limit, rule);
        const scannedRecs = await scanRecommendations(month, startIso, endIso, limit, rule);
        return {
            scanned: scannedCases + scannedRecs,
            month,
            ruleVersionId: rule.versionId,
        };
    },
};
async function scanExpertCases(month, startIso, endIso, limit, rule) {
    const { data: cases } = await supabase
        .from('expert_cases')
        .select('id, farmer_id, block_id, crop_type, primary_issue_label, owner_email, close_summary, metadata, opened_at')
        .gte('opened_at', startIso)
        .lte('opened_at', endIso)
        .is('merged_into_case_id', null)
        .order('opened_at', { ascending: false })
        .limit(limit);
    const rows = cases ?? [];
    if (!rows.length)
        return 0;
    const caseIds = rows.map((c) => String(c.id));
    const farmerIds = rows.map((c) => String(c.farmer_id)).filter(Boolean);
    const blockIds = rows.map((c) => (c.block_id ? String(c.block_id) : '')).filter(Boolean);
    const recByCase = new Map();
    for (const part of chunk(caseIds)) {
        const { data: links } = await supabase
            .from('expert_case_links')
            .select('case_id, entity_id')
            .eq('link_type', 'recommendation')
            .in('case_id', part);
        const recIds = (links ?? []).map((l) => String(l.entity_id));
        const recs = recIds.length
            ? (await supabase.from('recommendation_records').select('*').in('id', recIds)).data ?? []
            : [];
        const recMap = new Map(recs.map((r) => [String(r.id), r]));
        for (const link of links ?? []) {
            const rec = recMap.get(String(link.entity_id));
            if (rec)
                recByCase.set(String(link.case_id), rec);
        }
    }
    const farmers = await loadMap('farmers', farmerIds, 'id, name, phone, village, district, state');
    const blocks = await loadMap('farm_blocks', blockIds, 'id, crop_name, growth_stage_id, metadata');
    const cropsByFarmer = await loadCrops(farmerIds);
    const findingsByFarmer = await loadFindings(farmerIds, startIso, endIso);
    for (const row of rows) {
        const rec = recByCase.get(String(row.id)) ?? null;
        const farmer = farmers.get(String(row.farmer_id)) ?? null;
        const block = row.block_id ? blocks.get(String(row.block_id)) ?? null : null;
        const finding = findingsByFarmer.get(String(row.farmer_id)) ?? null;
        const cropRow = cropsByFarmer.get(String(row.farmer_id)) ?? null;
        const meta = { ...asObj(row.metadata), ...asObj(rec?.metadata), ...asObj(row.close_summary) };
        const facts = factsFrom({
            farmer,
            crop: row.crop_type || block?.crop_name || cropRow?.crop_type || meta.crop || finding?.crop_type,
            cropStage: block?.growth_stage_id ||
                cropRow?.stage ||
                meta.crop_stage ||
                meta.growth_stage ||
                meta.cropStage,
            problem: row.primary_issue_label || rec?.issue_detected || finding?.disease_pest || meta.problem,
            diagnosis: meta.diagnosis || meta.primary_diagnosis || finding?.observations,
            recommendation: rec?.recommendation_text ||
                meta.recommendation ||
                meta.recommendation_text ||
                finding?.action_taken,
            evidence: asList(finding?.photo_urls).length ? finding?.photo_urls : meta.photos || meta.evidence,
        });
        const result = evaluateQualifiedCase(facts, rule);
        await upsertCase({
            period_month: month,
            source_type: 'expert_case',
            source_id: String(row.id),
            farmer_id: row.farmer_id ? String(row.farmer_id) : null,
            agronomist_email: emailish(row.owner_email) ?? emailish(rec?.created_by) ?? emailish(rec?.approved_by),
            qualified: result.qualified,
            missing_reasons: result.reasons,
            facts,
            rule_version_id: rule.versionId,
        });
    }
    return rows.length;
}
async function scanRecommendations(month, startIso, endIso, limit, rule) {
    const { data: recs } = await supabase
        .from('recommendation_records')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .neq('status', 'draft')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(limit);
    const rows = recs ?? [];
    if (!rows.length)
        return 0;
    const recIds = rows.map((r) => String(r.id));
    const linked = new Set();
    for (const part of chunk(recIds)) {
        const { data: links } = await supabase
            .from('expert_case_links')
            .select('entity_id')
            .eq('link_type', 'recommendation')
            .in('entity_id', part);
        for (const l of links ?? [])
            linked.add(String(l.entity_id));
    }
    const standalone = rows.filter((r) => !linked.has(String(r.id)));
    if (!standalone.length)
        return 0;
    const farmerIds = standalone.map((r) => String(r.farmer_id)).filter(Boolean);
    const blockIds = standalone.map((r) => (r.block_id ? String(r.block_id) : '')).filter(Boolean);
    const farmers = await loadMap('farmers', farmerIds, 'id, name, phone, village, district, state');
    const blocks = await loadMap('farm_blocks', blockIds, 'id, crop_name, growth_stage_id, metadata');
    const cropsByFarmer = await loadCrops(farmerIds);
    const findingsByFarmer = await loadFindings(farmerIds, startIso, endIso);
    for (const rec of standalone) {
        const farmer = farmers.get(String(rec.farmer_id)) ?? null;
        const block = rec.block_id ? blocks.get(String(rec.block_id)) ?? null : null;
        const finding = findingsByFarmer.get(String(rec.farmer_id)) ?? null;
        const cropRow = cropsByFarmer.get(String(rec.farmer_id)) ?? null;
        const meta = asObj(rec.metadata);
        const facts = factsFrom({
            farmer,
            crop: block?.crop_name || cropRow?.crop_type || meta.crop || finding?.crop_type,
            cropStage: block?.growth_stage_id || cropRow?.stage || meta.crop_stage || meta.growth_stage,
            problem: rec.issue_detected || finding?.disease_pest || meta.problem,
            diagnosis: meta.diagnosis || finding?.observations,
            recommendation: rec.recommendation_text || finding?.action_taken,
            evidence: asList(finding?.photo_urls).length ? finding?.photo_urls : meta.photos || meta.evidence,
        });
        const result = evaluateQualifiedCase(facts, rule);
        await upsertCase({
            period_month: month,
            source_type: 'recommendation',
            source_id: String(rec.id),
            farmer_id: rec.farmer_id ? String(rec.farmer_id) : null,
            agronomist_email: emailish(rec.created_by) ?? emailish(rec.approved_by),
            qualified: result.qualified,
            missing_reasons: result.reasons,
            facts,
            rule_version_id: rule.versionId,
        });
    }
    return standalone.length;
}
async function loadCrops(farmerIds) {
    const map = new Map();
    for (const part of chunk([...new Set(farmerIds)])) {
        const { data } = await supabase
            .from('farmer_crops')
            .select('farmer_id, crop_type, stage, is_primary')
            .in('farmer_id', part)
            .order('is_primary', { ascending: false });
        for (const row of data ?? []) {
            const fid = String(row.farmer_id);
            if (!map.has(fid))
                map.set(fid, row);
        }
    }
    return map;
}
async function loadFindings(farmerIds, startIso, endIso) {
    const map = new Map();
    for (const part of chunk([...new Set(farmerIds)])) {
        const { data } = await supabase
            .from('crm_field_findings')
            .select('farmer_id, crop_type, disease_pest, observations, action_taken, photo_urls, visited_at')
            .in('farmer_id', part)
            .gte('visited_at', startIso)
            .lte('visited_at', endIso)
            .order('visited_at', { ascending: false });
        for (const row of data ?? []) {
            const fid = String(row.farmer_id);
            const existing = map.get(fid);
            const photos = asList(row.photo_urls).length;
            if (!existing || (photos && !asList(existing.photo_urls).length)) {
                map.set(fid, row);
            }
        }
    }
    return map;
}
//# sourceMappingURL=qualified-case.engine.js.map
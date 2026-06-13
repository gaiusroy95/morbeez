import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
export const callQcService = {
    async getActiveRubric() {
        const { data, error } = await supabase
            .from('call_qc_rubric')
            .select('criteria')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        throwIfSupabaseError(error, 'Load QC rubric');
        const criteria = (data?.criteria ?? []);
        if (criteria.length)
            return criteria;
        return [
            { key: 'greeting', label: 'Greeting', maxPoints: 20 },
            { key: 'problem_discovery', label: 'Problem Discovery', maxPoints: 20 },
            { key: 'need_identification', label: 'Need Identification', maxPoints: 20 },
            { key: 'solution_explanation', label: 'Solution Explanation', maxPoints: 20 },
            { key: 'next_action', label: 'Next Action', maxPoints: 20 },
        ];
    },
    async scoreCall(input) {
        const criteria = await this.getActiveRubric();
        const criteriaDesc = criteria
            .map((c) => `${c.key}: ${c.label} (0-${c.maxPoints})`)
            .join('\n');
        const raw = await openaiJsonCompletion('You QC telecaller calls for an Indian agri-input company. Score each rubric 0 to max. Flag if greeting missing, no next action, or rude language.', `Agent: ${input.agentEmail}\n\nRubric:\n${criteriaDesc}\n\nSummary:\n${input.summary}\n\nTranscript excerpt:\n${input.transcript.slice(0, 4000)}\n\nReturn JSON: { scores: { key: number }, notes: { key: string }, flagged: boolean, flagReason: string|null }`);
        const rubric = {};
        let totalScore = 0;
        for (const c of criteria) {
            const score = Math.min(c.maxPoints, Math.max(0, Number(raw.scores?.[c.key] ?? 0)));
            rubric[c.key] = {
                score,
                maxPoints: c.maxPoints,
                note: raw.notes?.[c.key],
            };
            totalScore += score;
        }
        return {
            totalScore,
            flagged: Boolean(raw.flagged) || totalScore < 60,
            flagReason: raw.flagReason ? String(raw.flagReason) : totalScore < 60 ? 'Score below 60' : null,
            rubric,
        };
    },
    async getOverview(days, agentEmail) {
        const since = new Date();
        since.setDate(since.getDate() - days + 1);
        let q = supabase
            .from('crm_call_logs')
            .select('id, agent_email, qc_score, qc_flagged, ai_summary_json, created_at, processing_status')
            .gte('created_at', since.toISOString())
            .in('processing_status', ['completed', 'confirmed']);
        if (agentEmail)
            q = q.eq('agent_email', agentEmail);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Load QC overview');
        const rows = data ?? [];
        const scores = rows.map((r) => Number(r.qc_score ?? 0)).filter((n) => n > 0);
        const avgScore = scores.length
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : 0;
        let interested = 0;
        let soilInterest = 0;
        for (const row of rows) {
            const json = row.ai_summary_json;
            if (json?.interestLevel === 'high' || json?.interestLevel === 'medium')
                interested += 1;
            if (json?.interestedInSoilTest)
                soilInterest += 1;
        }
        return {
            callsToday: rows.filter((r) => {
                const d = new Date(String(r.created_at));
                const now = new Date();
                return d.toDateString() === now.toDateString();
            }).length,
            totalCalls: rows.length,
            averageScore: avgScore,
            interested,
            soilTestInterest: soilInterest,
            flaggedCalls: rows.filter((r) => r.qc_flagged).length,
        };
    },
    async listFlaggedCalls(days, limit = 50) {
        const since = new Date();
        since.setDate(since.getDate() - days + 1);
        const { data, error } = await supabase
            .from('crm_call_logs')
            .select('id, lead_id, farmer_id, agent_email, qc_score, qc_flag_reason, qc_rubric_json, transcript, ai_summary, created_at, farmers(name, phone)')
            .eq('qc_flagged', true)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'List flagged calls');
        return data ?? [];
    },
};
//# sourceMappingURL=call-qc.service.js.map
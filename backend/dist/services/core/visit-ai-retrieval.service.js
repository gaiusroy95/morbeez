import { supabase } from '../../lib/supabase.js';
import { buildSymptomKey } from '../ai/question-reuse-keys.util.js';
export const visitAiRetrievalService = {
    async findTrainingExamples(params) {
        const symptoms = [params.issueName, params.observation ?? ''].filter(Boolean).join(' ');
        const symptomKey = buildSymptomKey(symptoms);
        const crop = params.cropType.toLowerCase();
        const { data: farmer } = await supabase.from('farmers').select('district').eq('id', params.farmerId).maybeSingle();
        const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;
        let q = supabase
            .from('ai_learning_samples')
            .select('symptoms_text, disease_label, expert_label, outcome, review_action, crop_type, district')
            .eq('crop_type', crop)
            .not('expert_label', 'is', null)
            .order('created_at', { ascending: false })
            .limit(params.limit ?? 8);
        const { data: samples } = await q;
        const rows = samples ?? [];
        const scored = rows
            .map((s) => {
            const sym = String(s.symptoms_text ?? '').toLowerCase();
            const label = String(s.disease_label ?? '').toLowerCase();
            let score = 0;
            if (symptomKey && sym.includes(symptomKey.split('|')[0] ?? ''))
                score += 2;
            if (label.includes(params.issueName.toLowerCase().split(' ')[0] ?? ''))
                score += 1;
            if (district && String(s.district ?? '').toLowerCase() === district)
                score += 1;
            return { s, score };
        })
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, params.limit ?? 4);
        return scored.map(({ s }) => ({
            symptoms: String(s.symptoms_text ?? ''),
            aiDiagnosis: String(s.disease_label ?? ''),
            expertDiagnosis: String(s.expert_label ?? s.disease_label ?? ''),
            outcome: s.outcome ? String(s.outcome) : null,
            reviewAction: s.review_action ? String(s.review_action) : null,
        }));
    },
    async findVerifiedCases(params) {
        const { data } = await supabase
            .from('visit_ai_cases')
            .select(`issue_name, final_diagnosis, metadata,
         visit_ai_recommendations(review_action, human_text)`)
            .eq('status', 'submitted')
            .contains('metadata', { cropType: params.cropType })
            .order('created_at', { ascending: false })
            .limit(30);
        const needle = params.issueName.toLowerCase();
        const matches = (data ?? []).filter((r) => {
            const name = String(r.issue_name ?? '').toLowerCase();
            const diag = String(r.final_diagnosis ?? '').toLowerCase();
            return name.includes(needle) || diag.includes(needle) || needle.includes(name.split(' ')[0] ?? '');
        });
        return matches.slice(0, params.limit ?? 5).map((r) => {
            const recs = r.visit_ai_recommendations;
            const rec = recs?.[0];
            const meta = r.metadata ?? {};
            return {
                issueLabel: String(r.final_diagnosis ?? r.issue_name),
                outcome: meta.outcome ? String(meta.outcome) : null,
                expertDiagnosis: rec?.human_text ? String(rec.human_text) : String(r.final_diagnosis ?? r.issue_name),
                reviewAction: rec?.review_action ? String(rec.review_action) : null,
            };
        });
    },
};
//# sourceMappingURL=visit-ai-retrieval.service.js.map
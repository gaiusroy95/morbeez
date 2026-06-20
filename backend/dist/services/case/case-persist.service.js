import { supabase } from '../../lib/supabase.js';
export const casePersistService = {
    async persistToSession(sessionId, maiosCase) {
        const { data: row } = await supabase
            .from('ai_advisory_sessions')
            .select('metadata')
            .eq('id', sessionId)
            .maybeSingle();
        const metadata = row?.metadata ?? {};
        await supabase
            .from('ai_advisory_sessions')
            .update({
            metadata: {
                ...metadata,
                maiosCase,
            },
            confidence_score: maiosCase.diagnostics.fusedConfidence,
            escalation_recommended: maiosCase.route === 'field_visit' ||
                maiosCase.route === 'emergency_callback' ||
                maiosCase.route === 'agronomist_review',
            updated_at: new Date().toISOString(),
        })
            .eq('id', sessionId);
    },
};
//# sourceMappingURL=case-persist.service.js.map
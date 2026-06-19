import { supabase } from '../../lib/supabase.js';
import type { MaiosCase } from '../../domain/case/types.js';

export const casePersistService = {
  async persistToSession(sessionId: string, maiosCase: MaiosCase): Promise<void> {
    const { data: row } = await supabase
      .from('ai_advisory_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .maybeSingle();

    const metadata = (row?.metadata as Record<string, unknown>) ?? {};

    await supabase
      .from('ai_advisory_sessions')
      .update({
        metadata: {
          ...metadata,
          maiosCase,
        },
        confidence_score: maiosCase.diagnostics.fusedConfidence,
        escalation_recommended:
          maiosCase.route === 'field_visit' ||
          maiosCase.route === 'emergency_callback' ||
          maiosCase.route === 'agronomist_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  },
};

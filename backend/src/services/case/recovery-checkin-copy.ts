import type { AdvisoryLanguage } from '../ai/types.js';
import { supabase } from '../../lib/supabase.js';

/** Resolve the farmer-facing condition label for Day 3/7/14 recovery check-ins. */
export async function resolveRecoveryCheckInCondition(params: {
  sessionId?: string | null;
  recommendationRecordId?: string | null;
  issueLabelHint?: string | null;
}): Promise<string | null> {
  const hint = params.issueLabelHint?.trim();
  if (hint) return hint.slice(0, 120);

  if (params.recommendationRecordId) {
    const { data } = await supabase
      .from('recommendation_records')
      .select('issue_detected')
      .eq('id', params.recommendationRecordId)
      .maybeSingle();
    if (data?.issue_detected) return String(data.issue_detected).trim().slice(0, 120);
  }

  if (!params.sessionId) return null;

  const { data: session } = await supabase
    .from('ai_advisory_sessions')
    .select('metadata')
    .eq('id', params.sessionId)
    .maybeSingle();
  const meta = (session?.metadata as Record<string, unknown>) ?? {};
  const maiosCase = meta.maiosCase as { diagnostics?: { primary?: string; secondary?: string } } | undefined;
  const primary = maiosCase?.diagnostics?.primary?.trim();
  if (primary) return primary.slice(0, 120);
  const secondary = maiosCase?.diagnostics?.secondary?.trim();
  if (secondary) return secondary.slice(0, 120);

  const ginger = meta.gingerSopCase as { issueLabel?: string; primaryDiagnosis?: string } | undefined;
  const gingerIssue = ginger?.issueLabel?.trim() || ginger?.primaryDiagnosis?.trim();
  if (gingerIssue) return gingerIssue.slice(0, 120);

  const { data: output } = await supabase
    .from('ai_advisory_outputs')
    .select('probable_issue')
    .eq('session_id', params.sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (output?.probable_issue) return String(output.probable_issue).trim().slice(0, 120);

  const { data: rec } = await supabase
    .from('recommendation_records')
    .select('issue_detected')
    .eq('ai_session_id', params.sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rec?.issue_detected) return String(rec.issue_detected).trim().slice(0, 120);

  return null;
}

export function buildMaiosRecoveryCheckInBody(params: {
  lang: AdvisoryLanguage;
  cropDisplayName: string;
  day: number;
  condition?: string | null;
}): string {
  const crop = params.cropDisplayName || 'Crop';
  const day = params.day;
  const condition = params.condition?.trim();

  if (params.lang === 'ml') {
    if (condition) {
      return `MAIOS (${crop}) — ദിവസം ${day}\nപ്രശ്നം: ${condition}\n\nചികിത്സയ്ക്ക് ശേഷം വിളയുടെ നില എങ്ങനെയാണ്?`;
    }
    return `MAIOS (${crop}) — ദിവസം ${day}: ഇപ്പോൾ വിളയുടെ നില എങ്ങനെയാണ്?`;
  }

  if (condition) {
    return `MAIOS (${crop}) check-in — Day ${day}\nCondition: ${condition}\n\nHow is the crop now after treatment?`;
  }
  return `MAIOS (${crop}) check-in — Day ${day}: How is the crop now?`;
}

export function buildGingerRecoveryCheckInBody(params: {
  lang: AdvisoryLanguage;
  day: number;
  condition?: string | null;
}): string {
  const day = params.day;
  const condition = params.condition?.trim();

  if (params.lang === 'ml') {
    if (condition) {
      return `അദരക് നിർണയം — ദിവസം ${day}\nപ്രശ്നം: ${condition}\n\nചികിത്സയ്ക്ക് ശേഷം വിളയുടെ നില എങ്ങനെയാണ്?\n\nImproved / Same / Worse തിരഞ്ഞെടുക്കുക.`;
    }
    return `അദരക് നിർണയം — ദിവസം ${day}: ഇപ്പോൾ വിളയുടെ നില എങ്ങനെയാണ്?\n\nImproved / Same / Worse തിരഞ്ഞെടുക്കുക.`;
  }

  if (condition) {
    return `Ginger diagnosis check-in — Day ${day}\nCondition: ${condition}\n\nHow is the crop now after treatment?\n\nTap Improved, Same, or Worse.`;
  }
  return `Ginger diagnosis check-in — Day ${day}: How is the crop now?\n\nTap Improved, Same, or Worse.`;
}

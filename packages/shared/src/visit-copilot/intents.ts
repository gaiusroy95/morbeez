import type { VisitCopilotPhase } from './v1.js';

export type VisitCopilotIntent =
  | { kind: 'confirm_send_questions' }
  | { kind: 'approve' }
  | { kind: 'farmer_evidence' }
  | { kind: 'clinical_instruction' }
  | { kind: 'general' };

const YES_RE = /^(yes|y|ok|okay|send|confirm|proceed|go ahead)\.?$/i;
const APPROVE_RE = /^(approve|approved|finalize|commit|save case)\.?$/i;

export function detectVisitCopilotIntent(text: string, phase: VisitCopilotPhase): VisitCopilotIntent {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'general' };

  if (phase === 'awaiting_send_questions' && YES_RE.test(trimmed)) {
    return { kind: 'confirm_send_questions' };
  }
  if (phase === 'awaiting_approval' && APPROVE_RE.test(trimmed)) {
    return { kind: 'approve' };
  }
  if (phase === 'awaiting_farmer_evidence' && trimmed.length >= 8) {
    return { kind: 'farmer_evidence' };
  }
  if (
    trimmed.length >= 40
    || /\b(recommend|drench|spray|ask the farmer|rhizome|diagnos|treatment|monitor)\b/i.test(trimmed)
  ) {
    return { kind: 'clinical_instruction' };
  }
  return { kind: 'general' };
}

export function looksLikeFarmerEvidenceMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 12) return false;
  return (
    /\b(uploaded|brown|ooze|soft|smell|rainfall|affected|plants?|yes|no)\b/i.test(t)
    || t.includes('•')
    || t.includes('\n')
  );
}

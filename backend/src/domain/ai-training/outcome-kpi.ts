/** Structured WhatsApp outcome KPI — farmer-facing follow-up after recommendation */

export const IMPROVEMENT_LEVELS = [
  'fully_improved',
  'slight_improvement',
  'no_improvement',
  'worse',
] as const;

export type ImprovementLevel = (typeof IMPROVEMENT_LEVELS)[number];

export type OutcomeKpiPayload = {
  improvementLevel: ImprovementLevel;
  photoUploaded?: boolean;
  daysAfterSpray?: number | null;
  newSymptoms?: boolean;
  repeatedIssue?: boolean;
  farmerSatisfaction?: 'positive' | 'neutral' | 'negative' | null;
  aiClassification?: 'positive' | 'partial' | 'failed' | 'uncertain';
  aiConfidence?: number;
  collectedAt: string;
  source: 'whatsapp_button' | 'whatsapp_text' | 'whatsapp_ai' | 'agronomist';
  rawSnippet?: string;
};

export type OutcomeKpiButtonId =
  | 'rec.outcome_full'
  | 'rec.outcome_slight'
  | 'rec.outcome_none'
  | 'rec.outcome_worse'
  | 'rec.outcome_yes'
  | 'rec.outcome_no';

const BUTTON_TO_LEVEL: Record<string, ImprovementLevel> = {
  'rec.outcome_full': 'fully_improved',
  'rec.outcome_slight': 'slight_improvement',
  'rec.outcome_none': 'no_improvement',
  'rec.outcome_worse': 'worse',
  'rec.outcome_yes': 'fully_improved',
  'rec.outcome_no': 'no_improvement',
};

export function improvementLevelFromButton(buttonId: string): ImprovementLevel | null {
  return BUTTON_TO_LEVEL[buttonId] ?? null;
}

export function improvementLevelToOutcomeReply(
  level: ImprovementLevel
): 'improved' | 'partial' | 'no_improvement' | 'worsened' {
  if (level === 'fully_improved') return 'improved';
  if (level === 'slight_improvement') return 'partial';
  if (level === 'worse') return 'worsened';
  return 'no_improvement';
}

export function improvementLevelToRecordOutcome(
  level: ImprovementLevel
): 'better' | 'partial' | 'no_improvement' {
  if (level === 'fully_improved') return 'better';
  if (level === 'slight_improvement') return 'partial';
  return 'no_improvement';
}

/** Parse farmer free-text / numeric replies during KPI follow-up */
export function parseImprovementLevelFromText(text: string): {
  level: ImprovementLevel;
  confidence: number;
} | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  if (/^[1１]$|fully|complete|much better|fully improved|പൂർണ|പൂർണ്ണമായി|നന്നായി/i.test(t)) {
    return { level: 'fully_improved', confidence: 0.9 };
  }
  if (/^[2２]$|slight|partial|little better|കുറച്ച്|സ്വല്പം/i.test(t)) {
    return { level: 'slight_improvement', confidence: 0.85 };
  }
  if (/^[4４]$|worse|worsen|bad|കൂടി മോശം|കൂടുതൽ മോശം/i.test(t)) {
    return { level: 'worse', confidence: 0.88 };
  }
  if (/^[3３]$|no improvement|not better|same|no change|മെച്ചപ്പെട്ടില്ല|ഇല്ല/i.test(t)) {
    return { level: 'no_improvement', confidence: 0.85 };
  }
  if (/improved|better|മെച്ചം|സുഖം/i.test(t) && !/no improvement|not better|ഇല്ല/i.test(t)) {
    return { level: 'fully_improved', confidence: 0.75 };
  }
  return null;
}

export function aiClassificationFromLevel(
  level: ImprovementLevel,
  confidence: number
): OutcomeKpiPayload['aiClassification'] {
  if (confidence < 0.55) return 'uncertain';
  if (level === 'fully_improved') return 'positive';
  if (level === 'slight_improvement') return 'partial';
  if (level === 'worse' || level === 'no_improvement') return 'failed';
  return 'uncertain';
}

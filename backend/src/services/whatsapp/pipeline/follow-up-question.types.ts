import type { AdvisoryLanguage } from '../../ai/types.js';

/** Structured follow-up only: yes/no, n-choice, or photo — no free text. */
export type FollowUpQuestionKind = 'yes_no' | 'multiple_choice' | 'photo';

export type FollowUpChoiceOption = {
  id: string;
  labelEn: string;
  labelMl: string;
};

export const YES_NO_CHOICES: FollowUpChoiceOption[] = [
  { id: 'yes', labelEn: 'Yes', labelMl: 'അതെ' },
  { id: 'no', labelEn: 'No', labelMl: 'ഇല്ല' },
];

export const SPRAY_TIMING_CHOICES: FollowUpChoiceOption[] = [
  { id: 'within_7d', labelEn: 'Last 7 days', labelMl: '7 ദിവസം' },
  { id: 'over_14d', labelEn: '14+ days ago', labelMl: '14+ ദിവസം' },
  { id: 'never', labelEn: 'Not yet', labelMl: 'ഇല്ല' },
];

export function normalizeFollowUpKind(raw: unknown): FollowUpQuestionKind {
  const k = String(raw ?? 'yes_no');
  if (k === 'photo') return 'photo';
  if (k === 'multiple_choice' || k === 'spray_timing' || k === 'open_text') return 'multiple_choice';
  return 'yes_no';
}

export function defaultChoicesForKind(kind: FollowUpQuestionKind): FollowUpChoiceOption[] {
  if (kind === 'yes_no') return YES_NO_CHOICES;
  return [];
}

/** EVSI questions often carry `choices: []`; treat empty stored arrays as missing. */
export function resolveFollowUpChoices(params: {
  question: { id: string; kind?: FollowUpQuestionKind; choices?: FollowUpChoiceOption[] };
  storedChoices?: FollowUpChoiceOption[] | null;
}): FollowUpChoiceOption[] {
  if (params.question.choices?.length) return params.question.choices;
  if (params.storedChoices?.length) return params.storedChoices;
  if (!params.question.kind || params.question.kind === 'yes_no') return YES_NO_CHOICES;
  return defaultChoicesForKind(params.question.kind);
}

export function localizeChoice(option: FollowUpChoiceOption, lang: AdvisoryLanguage): string {
  if (lang === 'ml' && option.labelMl.trim()) return option.labelMl.trim();
  return option.labelEn.trim() || option.labelMl.trim();
}

export function normalizeChoiceOptions(
  raw: unknown,
  kind: FollowUpQuestionKind
): FollowUpChoiceOption[] {
  if (kind === 'photo') return [];
  if (kind === 'yes_no') return YES_NO_CHOICES;

  const rows = Array.isArray(raw) ? raw : [];
  const out: FollowUpChoiceOption[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? r.optionId ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .slice(0, 32);
    const labelEn = String(r.labelEn ?? r.label ?? r.title ?? '').trim();
    const labelMl = String(r.labelMl ?? labelEn).trim();
    if (!id || !labelEn || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, labelEn, labelMl });
    if (out.length >= 10) break;
  }

  if (out.length >= 2) return out;
  return [];
}

export function formatChoiceAnswerLabel(
  answerId: string,
  choices: FollowUpChoiceOption[],
  lang: AdvisoryLanguage = 'en'
): string {
  const hit = choices.find((c) => c.id === answerId);
  if (hit) return localizeChoice(hit, lang);
  if (answerId === 'yes') return lang === 'ml' ? 'അതെ' : 'Yes';
  if (answerId === 'no') return lang === 'ml' ? 'ഇല്ല' : 'No';
  if (answerId === 'skip') return lang === 'ml' ? 'Skip' : 'Skipped';
  if (answerId === 'within_7d') return lang === 'ml' ? '7 ദിവസം' : 'Last 7 days';
  if (answerId === 'over_14d') return lang === 'ml' ? '14+ ദിവസം' : '14+ days ago';
  if (answerId === 'never') return lang === 'ml' ? 'ഇല്ല' : 'Not yet';
  return answerId;
}

/** True when finalDiagnosis is a custom value, not one of the AI hypothesis labels. */
export function isManualDiagnosis(
  finalDiagnosis: string | undefined,
  hypotheses?: Array<{ label: string }>
): boolean {
  const dx = finalDiagnosis?.trim() ?? '';
  if (!dx) return false;
  const labels = (hypotheses ?? []).map((h) => h.label.trim());
  return !labels.includes(dx);
}

/** Value to show in the manual diagnosis field (empty when an AI hypothesis is selected). */
export function manualDiagnosisDisplayValue(issue: {
  finalDiagnosis?: string;
  hypotheses?: Array<{ label: string }>;
}): string {
  return isManualDiagnosis(issue.finalDiagnosis, issue.hypotheses) ? issue.finalDiagnosis!.trim() : '';
}

export function applyHypothesisSelection<T extends { finalDiagnosis?: string; selectedHypothesisLabel?: string; hypotheses?: Array<{ label: string; selected?: boolean }> }>(
  issue: T,
  hypothesisLabel: string
): T {
  return {
    ...issue,
    selectedHypothesisLabel: hypothesisLabel,
    finalDiagnosis: hypothesisLabel,
    hypotheses: (issue.hypotheses ?? []).map((h) => ({
      ...h,
      selected: h.label === hypothesisLabel,
    })),
  };
}

export function applyManualDiagnosis<T extends { finalDiagnosis?: string; selectedHypothesisLabel?: string; hypotheses?: Array<{ label: string; selected?: boolean }> }>(
  issue: T,
  text: string
): T {
  const trimmed = text.trim();
  return {
    ...issue,
    finalDiagnosis: text,
    selectedHypothesisLabel: trimmed || undefined,
    hypotheses: (issue.hypotheses ?? []).map((h) => ({ ...h, selected: false })),
  };
}

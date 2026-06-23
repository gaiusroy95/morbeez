export type WhatsappComplianceNoAction = 'escalate' | 'review';

export function defaultComplianceQuestion(issueLabel: string, lang = 'en'): string {
  if (lang === 'ml') {
    return `${issueLabel} ചികിത്സ പൂർത്തിയാക്കിയോ?`;
  }
  return `Have you completed ${issueLabel} treatment?`;
}

/** Strip legacy "reply yes/no" suffix from generated prompt text. */
export function stripComplianceReplyHint(text: string): string {
  return text
    .replace(/\s*Reply\s+Yes\s+or\s+No\.?/gi, '')
    .replace(/\s*Yes\s+അല്ലെങ്കിൽ\s+No.*$/i, '')
    .trim();
}

export function resolveComplianceQuestion(msg: {
  complianceQuestion?: string;
  compliancePrompt?: string;
  issueLabel?: string;
}): string {
  const fromField = msg.complianceQuestion?.trim();
  if (fromField) return fromField;
  const fromPrompt = stripComplianceReplyHint(msg.compliancePrompt ?? '');
  if (fromPrompt) return fromPrompt;
  return defaultComplianceQuestion(msg.issueLabel ?? 'this');
}

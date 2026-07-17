/** Pure helpers for WhatsApp-confirmed entry correction messaging (no RN imports). */

export function defaultFarmConfirmedSupportMessage(params: {
  kind: 'activity' | 'roi';
  id: string;
  label: string;
}): string {
  const noun = params.kind === 'activity' ? 'field activity' : 'ROI entry';
  return `Hi Morbeez, I need to correct or undo a WhatsApp-confirmed ${noun}: ${params.label} (${params.id}).`;
}

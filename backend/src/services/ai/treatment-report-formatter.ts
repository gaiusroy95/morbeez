import type { StructuredAdvisory } from './types.js';

export const CONNECTED_PREVENTION_NONE_MESSAGE =
  'No connected preventive measures are currently recommended because no moderate or high secondary risks were identified.';

/** Farmer-facing "What To Do Now" block — primary treatment + mandatory connected prevention. */
export function buildTreatmentSection(advisory: StructuredAdvisory): string[] {
  const lines: string[] = ['💊 What To Do Now', '', '🎯 Primary Treatment', ''];
  const primary = advisory.dosageGuidance?.slice(0, 3) ?? [];
  if (primary.length) {
    lines.push('Product\tDose\tMethod');
    for (const item of primary) {
      lines.push(`${item.product}\t${item.rate}\t${item.method}`);
    }
  } else if (advisory.treatments?.length) {
    for (const tr of advisory.treatments.slice(0, 3)) {
      lines.push(`• ${tr.action}${tr.timing ? ` (${tr.timing})` : ''}`);
    }
  } else {
    lines.push('No product action recommended yet — more field evidence may be needed.');
  }

  const prevention = (advisory.connectedPrevention ?? []).filter(
    (item) =>
      item.connectedRisk?.trim() &&
      item.preventiveProduct?.trim() &&
      (item.riskLevel === 'moderate' || item.riskLevel === 'high' || !item.riskLevel)
  );

  lines.push('', '🔗 Connected Prevention (Optimized Tank Mix)', '');
  if (prevention.length) {
    lines.push('Connected Risk\tPreventive Product\tDose\tMethod\tReason');
    for (const item of prevention.slice(0, 4)) {
      lines.push(
        `${item.connectedRisk}\t${item.preventiveProduct}\t${item.dose}\t${item.method}\t${item.reason}`
      );
    }
  } else {
    const noneNote =
      advisory.connectedPreventionNoneNote?.trim() || CONNECTED_PREVENTION_NONE_MESSAGE;
    lines.push(`> ${noneNote}`);
  }

  if (prevention.length && advisory.tankMixRecommendation?.trim()) {
    lines.push('', `> ${advisory.tankMixRecommendation.trim()}`);
  } else if (prevention.some((p) => /foliar|spray/i.test(p.method))) {
    lines.push(
      '',
      '> ✅ Recommended Tank Mix: Combine compatible foliar products into a single spray to reduce labour and application cost.'
    );
  }

  if (advisory.separateOperationNote?.trim()) {
    lines.push('', `> ${advisory.separateOperationNote.trim()}`);
  }

  if (advisory.sprayTiming?.trim()) {
    lines.push('', advisory.sprayTiming.trim());
  }

  return lines;
}

/** Compact recommendation text for agronomist visit AI step. */
export function formatVisitRecommendationText(advisory: StructuredAdvisory): string {
  const parts = [...buildTreatmentSection(advisory)];
  if (advisory.recoveryReason?.trim()) {
    parts.push('', '🌱 Recovery', '', advisory.recoveryReason.trim());
  }
  if (advisory.monitorAdvice?.trim()) {
    parts.push('', '⚠ Monitor', '', advisory.monitorAdvice.trim());
  }
  if (advisory.rootCorrection?.trim()) {
    parts.push('', '🚜 Field correction', '', advisory.rootCorrection.trim());
  }
  return parts.join('\n').trim();
}

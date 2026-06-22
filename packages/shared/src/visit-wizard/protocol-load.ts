import type { RecommendationGroupDraft } from '@morbeez/shared';

function newLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Map published protocol_definitions row into visit recommendation group drafts. */
export function protocolToRecommendationGroups(
  protocol: Record<string, unknown>,
  issueLocalId: string
): RecommendationGroupDraft[] {
  const stages = (protocol.stages as Array<Record<string, unknown>>) ?? [];
  const products = (protocol.products as Array<Record<string, unknown>>) ?? [];
  const source =
    stages.length > 0
      ? stages
      : products.map((p) => ({
          day: p.day ?? p.applicationDay ?? 0,
          applicationType: p.method ?? p.applicationType ?? 'foliar_spray',
          materials: [p],
        }));

  return source.map((stage, i) => {
    const materialsRaw = (stage.materials as Array<Record<string, unknown>>) ?? [stage];
    return {
      localId: newLocalId('grp'),
      applicationType: String(stage.applicationType ?? stage.method ?? 'foliar_spray') as RecommendationGroupDraft['applicationType'],
      applicationDay: Number(stage.day ?? stage.applicationDay ?? 0),
      sortOrder: i,
      materials: materialsRaw.map((m) => ({
        localId: newLocalId('mat'),
        issueLocalId,
        technicalName: String(m.technicalName ?? m.name ?? m.product_name ?? ''),
        doseQuantity: String(m.doseQuantity ?? m.dose ?? ''),
        doseBasis: (m.doseBasis as RecommendationGroupDraft['materials'][number]['doseBasis']) ?? undefined,
        doseUnit: (m.doseUnit as RecommendationGroupDraft['materials'][number]['doseUnit']) ?? undefined,
        applicationMode:
          (m.applicationMode as RecommendationGroupDraft['materials'][number]['applicationMode']) ?? undefined,
      })),
    };
  });
}

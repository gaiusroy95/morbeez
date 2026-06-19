import type { Router } from 'expo-router';
import { agronomistClient, type AgronomistRecommendationRow } from '@morbeez/shared';

type OpenCtx = {
  farmerId: string;
  farmerName: string;
  leadId?: string | null;
  router: Pick<Router, 'push'>;
};

export async function openRecommendationVisit(rec: AgronomistRecommendationRow, ctx: OpenCtx): Promise<void> {
  if (rec.fieldFindingId) {
    ctx.router.push(`/visit/${rec.fieldFindingId}`);
    return;
  }

  try {
    const visitCtx = await agronomistClient.getRecommendationVisitContext(rec.id);
    if (visitCtx.blockId) {
      ctx.router.push({
        pathname: '/visit',
        params: {
          farmerId: visitCtx.farmerId,
          farmerName: visitCtx.farmerName ?? ctx.farmerName,
          blockId: visitCtx.blockId,
          blockName: visitCtx.blockName ?? 'Block',
          cropType: visitCtx.cropType ?? '_default',
          recommendationId: rec.id,
          leadId: ctx.leadId ?? '',
          rectification: visitCtx.rectificationMode ? '1' : '',
        },
      });
      return;
    }
  } catch {
    // Fall through to manual recommendation editor.
  }

  ctx.router.push({
    pathname: '/recommendation/add',
    params: {
      farmerId: ctx.farmerId,
      leadId: ctx.leadId ?? '',
      blockId: rec.blockId ?? '',
      recommendationId: rec.id,
    },
  });
}

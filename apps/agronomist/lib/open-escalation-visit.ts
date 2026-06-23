import { useRouter } from 'expo-router';
import { agronomistClient } from '@morbeez/shared';

type OpenCtx = {
  farmerName?: string;
  leadId?: string | null;
  router: Pick<ReturnType<typeof useRouter>, 'push'>;
};

export async function openEscalationVisit(escalationId: string, ctx: OpenCtx): Promise<void> {
  const visitCtx = await agronomistClient.getEscalationVisitContext(escalationId);
  if (!visitCtx.blockId) {
    throw new Error('No farm block found for this farmer. Add a block before starting a visit.');
  }
  ctx.router.push({
    pathname: '/visit',
    params: {
      farmerId: visitCtx.farmerId,
      farmerName: visitCtx.farmerName ?? ctx.farmerName ?? 'Farmer',
      blockId: visitCtx.blockId,
      blockName: visitCtx.blockName ?? 'Block',
      cropType: visitCtx.cropType ?? '_default',
      escalationId,
      recommendationId: visitCtx.recommendationId ?? '',
      leadId: ctx.leadId ?? '',
      rectification: '1',
    },
  });
}

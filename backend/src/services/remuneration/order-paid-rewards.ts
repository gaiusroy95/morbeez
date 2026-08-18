import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { agronomistEarningsTriggers } from './agronomist-earnings-triggers.js';

/** Credit agronomist retention + partner commission for a paid commerce order. Idempotent. */
export async function creditOrderPaidRewards(input: {
  farmerId?: string | null;
  orderId?: string | null;
  grossInr: number;
}): Promise<void> {
  const farmerId = input.farmerId?.trim();
  const orderId = input.orderId?.trim();
  if (!farmerId || !orderId) return;

  agronomistEarningsTriggers.onOrderPaidForAssignedFarmer({ farmerId, orderId });

  if (!env.ENABLE_PARTNER_PROGRAM || !env.ENABLE_PARTNER_COMMISSION) return;
  try {
    const { farmerOwnershipService } = await import('../partner/farmer-ownership.service.js');
    const ownership = await farmerOwnershipService.getOwnership(farmerId);
    const partnerId = ownership?.customerOwnerPartnerId ?? ownership?.assignedPartnerId;
    if (!partnerId) return;
    const { commissionEngineService } = await import('../partner/commission-engine.service.js');
    await commissionEngineService.computeForOrder({
      partnerId,
      farmerId,
      orderId,
      grossInr: Number(input.grossInr) || 0,
    });
  } catch (err) {
    logger.warn({ err, farmerId, orderId }, 'Partner commission on paid order skipped');
  }
}

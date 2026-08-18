import { logger } from '../../lib/logger.js';
import { agronomistEarningsTriggers } from './agronomist-earnings-triggers.js';
import { eligibleSaleEngine } from './eligible-sale.engine.js';

/** Retention on paid; sales incentives wait until eligible. Product wallet consumes on paid purchase. */
export async function creditOrderPaidRewards(input: {
  farmerId?: string | null;
  orderId?: string | null;
  grossInr: number;
}): Promise<void> {
  const farmerId = input.farmerId?.trim();
  const orderId = input.orderId?.trim();
  if (!farmerId || !orderId) return;

  agronomistEarningsTriggers.onOrderPaidForAssignedFarmer({ farmerId, orderId });
  await eligibleSaleEngine.onOrderPaid({
    orderId,
    farmerId,
    grossInr: input.grossInr,
  });
  try {
    const { productRewardService } = await import('./product-reward.service.js');
    await productRewardService.applyToOrder({
      orderId,
      farmerId,
      grossInr: input.grossInr,
    });
  } catch (err) {
    logger.warn({ err, orderId, farmerId }, 'Product reward apply skipped');
  }
}

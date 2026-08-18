/** ₹400 product wallet: consume from purchases, restore on return, never pay leftover as cash. */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function productRewardBalance(maxInr: number, usedInr: number): number {
  return round2(Math.max(0, maxInr) - Math.max(0, usedInr));
}

export function consumeProductReward(input: {
  maxInr: number;
  usedInr: number;
  purchaseInr: number;
}): { consumeInr: number; usedInr: number; balanceInr: number } {
  const max = round2(Math.max(0, input.maxInr));
  const used = round2(Math.max(0, input.usedInr));
  const purchase = round2(Math.max(0, input.purchaseInr));
  const available = productRewardBalance(max, used);
  const consumeInr = round2(Math.min(available, purchase));
  const nextUsed = round2(used + consumeInr);
  return {
    consumeInr,
    usedInr: nextUsed,
    balanceInr: productRewardBalance(max, nextUsed),
  };
}

export function restoreProductReward(input: {
  maxInr: number;
  usedInr: number;
  restoreInr: number;
}): { restoreInr: number; usedInr: number; balanceInr: number } {
  const max = round2(Math.max(0, input.maxInr));
  const used = round2(Math.max(0, input.usedInr));
  const restoreInr = round2(Math.min(used, Math.max(0, input.restoreInr)));
  const nextUsed = round2(used - restoreInr);
  return {
    restoreInr,
    usedInr: nextUsed,
    balanceInr: productRewardBalance(max, nextUsed),
  };
}

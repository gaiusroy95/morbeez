import type { RoiVisibility } from '../types/intel';

export function computeRoiVisibility(cropCount: number, blockCount: number): RoiVisibility {
  return {
    showCropFilter: cropCount > 1,
    showBlockFilter: blockCount > 1,
    showExpenseBook: cropCount > 1 || blockCount > 1,
  };
}

export function honestFinancial(expenseInr: number, incomeInr: number) {
  const hasIncome = incomeInr > 0;
  const profitInr = hasIncome ? incomeInr - expenseInr : null;
  const roiPercent =
    hasIncome && expenseInr > 0 ? Math.round(((incomeInr - expenseInr) / expenseInr) * 100) : null;
  return {
    expenseInr,
    incomeInr,
    profitInr,
    roiPercent,
    hasIncome,
    profitMessage: hasIncome
      ? null
      : 'Profit & ROI available after first harvest sale',
  };
}

/** Mirrors backend finish-season gate: COMPLETE text always; password when account has one. */
export function validateFinishCycleInput(
  opts?: { password?: string; confirmText?: string },
  hasPassword = false
): { ok: true } | { ok: false; error: string } {
  if (!opts?.confirmText || opts.confirmText.trim().toUpperCase() !== 'COMPLETE') {
    return { ok: false, error: 'Type COMPLETE to confirm' };
  }
  if (hasPassword && !opts.password?.trim()) {
    return { ok: false, error: 'Password is required' };
  }
  return { ok: true };
}

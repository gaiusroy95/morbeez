export type PortalNotification = {
  id: string;
  type: string;
  message: string;
  atLabel: string;
  tone: string;
  href?: string | null;
};

export type WeatherIntel = {
  blockId: string | null;
  locationLabel: string | null;
  rainfallMm: number | null;
  rainfallForecastMm: number | null;
  humidityPct: number | null;
  temperatureC: number | null;
  diseaseRiskScore: number | null;
  diseaseAlerts: string[];
  summary: string | null;
};

export type MarketPriceRow = {
  marketName: string;
  pricePerKg: number;
  lastYearPricePerKg: number | null;
  trend: 'up' | 'down' | 'flat' | null;
};

export type MarketIntel = {
  crop: string;
  date: string;
  rows: MarketPriceRow[];
  summary: string | null;
};

export type RoiExpenseType = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  ledgerEntryType?: string;
};

export type RoiLabourType = {
  id: string;
  name: string;
  icon: string | null;
};

export type RoiActivityType = {
  id: string;
  activityName: string;
  icon: string | null;
  category?: string;
};

export type ActiveSeasonDashboard = {
  seasonId: string;
  blockId: string;
  blockName: string;
  crop: string;
  dap: number;
  stageLabel: string;
  acreage: number | null;
  seasonLabel: string;
  seasonStatus: string;
  spentInr: number;
  expectedIncomeInr: number;
  netProfitInr: number;
  roiPercent: number;
  yieldEstimate: string | null;
  marketNote: string | null;
  breakdown: Array<{ label: string; value: number; color: string }>;
  recentEntries: Array<{
    id: string;
    dateLabel: string;
    label: string;
    icon: string | null;
    amountInr: number;
    type: string;
    note: string | null;
  }>;
};

export type CropSeasonSummary = {
  id: string;
  crop: string;
  seasonLabel: string;
  netProfitInr: number;
  totalExpenseInr: number;
  totalIncomeInr: number;
  roiPercent: number | null;
  finalYieldKg: number | null;
  status: string;
  startDate: string;
  endDate: string | null;
};

export type CropSeasonDetail = CropSeasonSummary & {
  blockName: string | null;
  acreage: number | null;
  dapDuration: string | null;
  roiPercent: number;
  harvest: {
    harvestDate: string;
    yieldKg: number;
    sellingPricePerKg: number;
    totalIncomeInr: number;
  } | null;
  harvests: HarvestEntry[];
  entries: Array<{
    id: string;
    dateLabel: string;
    amountInr: number;
    type: string;
    label: string;
    note: string | null;
  }>;
  activities: Array<{
    id: string;
    label: string;
    dateLabel: string;
    costInr: number | null;
    notes: string | null;
  }>;
};

export type RoiFilterState = {
  crop?: string | null;
  blockId?: string | null;
};

export type RoiVisibility = {
  showCropFilter: boolean;
  showBlockFilter: boolean;
  showExpenseBook: boolean;
};

export type RoiFinancialSummary = {
  expenseInr: number;
  incomeInr: number;
  profitInr: number | null;
  roiPercent: number | null;
  hasIncome: boolean;
  profitMessage?: string | null;
};

export type RoiHarvestSummary = {
  harvestCount: number;
  totalQtyKg: number;
  totalIncomeInr: number;
  averageRatePerKg: number | null;
  bestRatePerKg: number | null;
  lowestRatePerKg: number | null;
};

export type RoiCropStatusCard = {
  crop: string;
  blockId: string;
  blockName: string;
  acreage: number | null;
  plantingDate: string | null;
  dap: number;
  stageLabel: string;
  dapMax?: number;
  seasonId: string | null;
  seasonStatus: string;
};

export type FarmerCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  ledgerEntryType: string;
  isSystem: boolean;
};

export type HarvestEntry = {
  id: string;
  harvestDate: string;
  yieldKg: number;
  sellingPricePerKg: number;
  totalIncomeInr: number;
  buyer: string | null;
};

export type TransactionRow = {
  id: string;
  date: string;
  dateLabel: string;
  type: 'expense' | 'income';
  entryType: string;
  incomeSubtype: string | null;
  label: string;
  amountInr: number;
  signedAmountInr: number;
  note: string | null;
  seasonId: string | null;
  blockId: string | null;
  categoryId: string | null;
};

export type ExpenseBookLine = {
  id: string;
  dateLabel: string;
  description: string;
  amountInr: number;
};

export type ExpenseBookGroup = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  totalInr: number;
  lines: ExpenseBookLine[];
};

export type RoiDashboardV2 = {
  visibility: RoiVisibility;
  cropCount: number;
  blockCount: number;
  crops: string[];
  blocks: Array<{ id: string; name: string; crop: string }>;
  filter: RoiFilterState;
  cropStatus: RoiCropStatusCard | null;
  financial: RoiFinancialSummary;
  harvestSummary: RoiHarvestSummary;
  breakdown: Array<{ label: string; value: number; color: string }>;
  recentTransactions: TransactionRow[];
  activeSeasonIds: string[];
};

export type RoiContext = {
  filter: RoiFilterState;
  crop: string;
  blockId: string;
  blockName: string;
  seasonId: string | null;
  blocksForCrop: Array<{ id: string; name: string; crop: string }>;
  categories: FarmerCategory[];
  incomeSubtypes: Array<{ id: string; label: string }>;
};

export type RoiAnalytics = {
  breakdown: Array<{ label: string; value: number; percent: number; color: string }>;
  topCategory: { label: string; value: number } | null;
  monthlyExpenseTrend: Array<{ month: string; amountInr: number }>;
  harvest: RoiHarvestSummary;
};

export type RoiHistoryResponse = {
  active: Array<CropSeasonSummary & { blockName: string | null; dap: number | null; stageLabel: string | null }>;
  completed: CropSeasonSummary[];
};

export type RoiDashboard = {
  seasonId?: string;
  blockName?: string;
  dap?: number;
  stageLabel?: string;
  spentInr?: number;
  expectedIncomeInr?: number;
  netProfitInr?: number;
  investmentInr: number;
  projectedRevenueInr: number;
  profitInr: number;
  roiPercent: number;
  yieldForecast: string | null;
  acreage: number | null;
  marketNote: string | null;
  seasonLabel?: string;
  breakdown?: { inputs: number; labor: number; operations: number; other: number };
  breakdownByType?: Array<{ label: string; value: number; color: string }>;
  recentEntries: Array<{
    id: string;
    dateLabel: string;
    category: string;
    amountInr: number;
    type: string;
    note: string | null;
    icon?: string | null;
  }>;
};

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

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

export type RoiDashboard = {
  investmentInr: number;
  projectedRevenueInr: number;
  profitInr: number;
  roiPercent: number;
  yieldForecast: string | null;
  acreage: number | null;
  marketNote: string | null;
  recentEntries: Array<{
    id: string;
    dateLabel: string;
    category: string;
    amountInr: number;
    type: string;
    note: string | null;
  }>;
};

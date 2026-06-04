export type MarketInsightCropCard = {
  cropType: string;
  label: string;
  pricePerKg: number;
  lastYearPricePerKg: number | null;
  yoyPct: number | null;
  yoyLabel: string;
  trendStatus: 'strong_increase' | 'slight_increase' | 'stable' | 'slight_decrease' | 'strong_decrease';
  statusText: string;
};

export type MarketInsightChartPoint = {
  month: number;
  monthLabel: string;
  currentYear: number | null;
  previousYear: number | null;
};

export type MarketInsightPayload = {
  insightDate: string;
  dateHeader: string;
  marketLabel: string;
  districtLabel: string;
  weather: {
    conditionLabel: string;
    tempC: number;
    humidityPct: number;
    rainMmToday: number;
    locationLabel: string;
  };
  cropCards: MarketInsightCropCard[];
  chart: {
    cropType: string;
    cropLabel: string;
    unit: string;
    points: MarketInsightChartPoint[];
    summary: string;
  };
  insights: {
    weatherImpact: string;
    marketForecast: string;
    advice: string;
  };
  joinCta: string;
};

export type MarketInsightBuildResult = {
  ok: boolean;
  payload?: MarketInsightPayload;
  error?: string;
};

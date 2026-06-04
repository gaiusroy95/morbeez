import { marketInsightAiService } from './market-insight-ai.service.js';
import { marketInsightRegionService } from './market-insight-region.service.js';

export type MarketInsightWeather = {
  conditionLabel: string;
  tempC: number;
  humidityPct: number;
  rainMmToday: number;
  locationLabel: string;
};

/** Weather for market insights — coordinates from farmer PIN code, not plot GPS. */
export const marketInsightWeatherService = {
  async fetchForFarmer(farmerId: string): Promise<MarketInsightWeather> {
    const region = await marketInsightRegionService.resolveForFarmer(farmerId);
    if (region) {
      const verified = await marketInsightAiService.fetchVerifiedWeather(region);
      if (verified) return verified;
    }

    return {
      conditionLabel: 'Partly Cloudy',
      tempC: 28,
      humidityPct: 70,
      rainMmToday: 0,
      locationLabel: region ? `PIN ${region.pincode}` : 'Unknown',
    };
  },
};

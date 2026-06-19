export const predictiveRiskService = {
  async scoreBlock(params: {
    farmerId: string;
    blockId?: string | null;
    contextPack?: {
      weatherRiskScore?: number;
      heavyRainLikely?: boolean;
      highHeatLikely?: boolean;
      highHumidityLikely?: boolean;
      drainageRisk?: 'low' | 'moderate' | 'high';
    };
    riskTagCount?: number;
  }) {
    const w = params.contextPack?.weatherRiskScore ?? 30;
    const base = Math.min(100, Math.max(0, w));
    const disease = Math.min(
      100,
      base + (params.contextPack?.highHumidityLikely ? 20 : 0) + (params.riskTagCount ?? 0) * 5
    );
    const pest = Math.min(100, base * 0.7 + (params.contextPack?.highHeatLikely ? 15 : 0));
    const nutrient = Math.min(100, 35 + (params.riskTagCount ?? 0) * 8);
    const irrigation = Math.min(
      100,
      (params.contextPack?.heavyRainLikely ? 70 : 25) +
        (params.contextPack?.drainageRisk === 'high' ? 25 : 0)
    );
    const weather = base;

    return { disease, pest, nutrient, irrigation, weather };
  },
};

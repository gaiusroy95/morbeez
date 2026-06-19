import { env } from '../../config/env.js';

export const supplyIntelligenceService = {
  enabled(): boolean {
    return env.ENABLE_MAIOS_SUPPLY_INTEL === true;
  },

  async suggestFulfillment(_params: {
    technicalNames: string[];
    farmerId: string;
  }): Promise<{
    stockStatus: 'in_stock' | 'low' | 'out_of_stock';
    substitutes: string[];
    leadTimeDays: number | null;
  }> {
    if (!this.enabled()) {
      return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: null };
    }
    return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: 3 };
  },
};

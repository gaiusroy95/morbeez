import { env } from '../../config/env.js';
export const supplyIntelligenceService = {
    enabled() {
        return env.ENABLE_MAIOS_SUPPLY_INTEL === true;
    },
    async suggestFulfillment(_params) {
        if (!this.enabled()) {
            return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: null };
        }
        return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: 3 };
    },
};
//# sourceMappingURL=supply-intelligence.service.js.map
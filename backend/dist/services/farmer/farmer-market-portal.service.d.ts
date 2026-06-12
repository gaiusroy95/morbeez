export type CropMarketItem = {
    id: string;
    cropName: string;
    icon: string | null;
    displayOrder: number;
};
export type MarketItem = {
    id: string;
    marketName: string;
    district: string | null;
    isPreferred: boolean;
};
export declare const farmerMarketPortalService: {
    listCrops(): Promise<CropMarketItem[]>;
    listMarkets(_farmerId: string, crop: string): Promise<MarketItem[]>;
    getDashboard(farmerId: string, crop?: string, market?: string): Promise<{
        crop: string;
        favoriteCrop: string;
        crops: CropMarketItem[];
        date: string;
        priceIsToday: boolean;
        districtLabel: {};
        selectedMarket: string;
        primaryMarket: string;
        todayPrice: number;
        dailyChangeInr: number | null;
        dailyTrend: string | null;
        weeklyTrendPct: number | null;
        yoyPct: number | null;
        lastYearSameDayPricePerKg: number | null;
        differenceInr: number | null;
        dailyChangePct: number | null;
        trend: "flat" | "up" | "down" | null;
        priceDirection: string;
        rows: {
            marketName: string;
            pricePerKg: number;
            lastYearPricePerKg: number | null;
            trend: "flat" | "up" | "down" | null;
            yoyPct: number | null;
        }[];
    }>;
    getTrends(farmerId: string, crop?: string, range?: string, market?: string): Promise<{
        crop: string;
        marketName: string;
        date: string;
        range: string;
        points: {
            month: number;
            monthLabel: string;
            currentYear: number | null;
            previousYear: number | null;
        }[];
        seasonal: {
            month: string;
            currentYear: number | null;
            previousYear: number | null;
        }[];
        overlayCurrent: {
            label: string;
            value: number;
        }[];
        overlayPrevious: {
            label: string;
            value: number;
        }[];
        insights: string[];
        priceDirection: string;
    }>;
    getMandiComparison(farmerId: string, crop?: string, market?: string): Promise<{
        crop: string;
        date: string;
        preferredMarket: string;
        highestMarket: string;
        rows: {
            isHighest: boolean;
            isPreferred: boolean;
            marketName: string;
            pricePerKg: number;
            lastYearPricePerKg: number | null;
            trend: "flat" | "up" | "down" | null;
            yoyPct: number | null;
        }[];
    }>;
    getMultiCropComparison(farmerId: string, market?: string): Promise<{
        marketName: string;
        date: string;
        favoriteCrop: string | null;
        bestCrop: string;
        crops: ({
            crop: string;
            icon: string | null;
            marketName: string;
            pricePerKg: number | null;
            yoyPct: number | null;
            weeklyTrendPct: number | null;
            trend: "up" | "down" | "flat" | null;
            signal: "neutral";
            date: string;
        } | {
            crop: string;
            icon: string | null;
            marketName: string;
            pricePerKg: number;
            yoyPct: number | null;
            weeklyTrendPct: number | null;
            trend: "flat" | "up" | "down" | null;
            signal: "neutral" | "strong" | "weak";
            date: string;
        })[];
    }>;
    adminListCropMarkets(): Promise<any[]>;
    adminUpsertCropMarket(body: {
        id?: string;
        cropName: string;
        icon?: string | null;
        activeStatus?: boolean;
        displayOrder?: number;
    }): Promise<any>;
    adminArchiveCropMarket(id: string): Promise<void>;
};
//# sourceMappingURL=farmer-market-portal.service.d.ts.map
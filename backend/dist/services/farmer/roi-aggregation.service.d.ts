export declare const roiAggregationService: {
    resolveActiveSeasonIds(farmerId: string, filter: {
        crop?: string | null;
        blockId?: string | null;
    }): Promise<string[]>;
    getSummary(farmerId: string, filter: {
        crop?: string | null;
        blockId?: string | null;
    }): Promise<{
        visibility: {
            showCropFilter: boolean;
            showBlockFilter: boolean;
            showExpenseBook: boolean;
        };
        cropCount: number;
        blockCount: number;
        crops: string[];
        blocks: {
            id: string;
            name: string;
            crop: string;
        }[];
        filter: {
            crop: string | null;
            blockId: string | null;
        };
        cropStatus: {
            crop: string;
            blockId: string;
            blockName: string;
            acreage: number | null;
            plantingDate: string | null;
            dap: number;
            stageLabel: string;
            dapMax: number;
            seasonId: string;
            seasonStatus: string;
        } | null;
        financial: {
            expenseInr: number;
            incomeInr: number;
            profitInr: number | null;
            roiPercent: number | null;
            hasIncome: boolean;
            profitMessage: string | null;
        };
        harvestSummary: {
            harvestCount: number;
            totalQtyKg: number;
            totalIncomeInr: number;
            averageRatePerKg: number | null;
            bestRatePerKg: number | null;
            lowestRatePerKg: number | null;
        };
        breakdown: {
            label: string;
            value: number;
            color: string;
        }[];
        recentTransactions: {
            id: string;
            date: string;
            dateLabel: string;
            type: "income" | "expense";
            entryType: string;
            incomeSubtype: string | null;
            label: string;
            amountInr: number;
            signedAmountInr: number;
            note: string | null;
            seasonId: string | null;
            blockId: string | null;
            categoryId: string | null;
        }[];
        activeSeasonIds: string[];
    }>;
    getContext(farmerId: string, filter: {
        crop?: string | null;
        blockId?: string | null;
    }): Promise<{
        filter: {
            crop: string | null;
            blockId: string | null;
        };
        crop: string;
        blockId: string;
        blockName: string;
        seasonId: string | null;
        blocksForCrop: {
            id: string;
            name: string;
            crop: string;
        }[];
        categories: {
            id: string;
            name: string;
            icon: string | null;
            color: string | null;
            ledgerEntryType: string;
            isSystem: boolean;
        }[];
        incomeSubtypes: {
            id: string;
            label: string;
        }[];
    }>;
};
//# sourceMappingURL=roi-aggregation.service.d.ts.map
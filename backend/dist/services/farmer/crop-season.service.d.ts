import { type RoiEntryType } from '../whatsapp/roi/roi-flow.service.js';
type SeasonRow = {
    id: string;
    farmer_id: string;
    block_id: string;
    crop: string;
    acreage: number | null;
    start_date: string;
    end_date: string | null;
    dap: number | null;
    total_expense: number;
    total_income: number;
    net_profit: number;
    final_yield_kg: number | null;
    expected_income_inr: number | null;
    market_note: string | null;
    season_status: string;
    season_label: string | null;
    harvest_count: number;
    total_yield_kg: number;
};
export declare const cropSeasonService: {
    listExpenseTypes(activeOnly?: boolean): Promise<{
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        ledgerEntryType: RoiEntryType;
    }[]>;
    listLabourTypes(activeOnly?: boolean): Promise<{
        id: string;
        name: string;
        icon: string | null;
    }[]>;
    ensureActiveSeason(farmerId: string, blockId?: string): Promise<SeasonRow>;
    getActiveDashboard(farmerId: string, blockId?: string): Promise<{
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
        hasIncome: boolean;
        profitMessage: string | null;
        yieldEstimate: string | null;
        marketNote: string | null;
        breakdown: {
            label: string;
            value: number;
            color: string;
        }[];
        recentEntries: {
            id: string;
            dateLabel: string;
            label: string;
            icon: string | null;
            amountInr: number;
            type: string;
            note: string | null;
        }[];
    }>;
    createQuickExpense(farmerId: string, input: {
        seasonId?: string;
        blockId?: string;
        expenseTypeId?: string;
        categoryId?: string;
        amount: number;
        entryDate?: string;
        note?: string;
    }): Promise<{
        id: string;
        seasonId: string;
    }>;
    createLabourExpense(farmerId: string, input: {
        seasonId?: string;
        labourTypeId: string;
        workers?: number;
        amount: number;
        note?: string;
        entryDate?: string;
    }): Promise<{
        id: string;
        seasonId: string;
    }>;
    createPurchaseFromOrder(farmerId: string, input: {
        orderId: string;
        amount: number;
        productSummary: string;
    }): Promise<{
        id: string;
    }>;
    recordHarvestSale(farmerId: string, input: {
        seasonId?: string;
        blockId?: string;
        harvestDate?: string;
        yieldKg: number;
        sellingPricePerKg: number;
        buyer?: string;
    }): Promise<{
        seasonId: string;
        harvestCount: number;
        totalIncomeInr: number;
        netProfitInr: number;
        roiPercent: number;
        entryId: string;
    }>;
    /** @deprecated Use recordHarvestSale — kept for backward compatibility */
    submitHarvest(farmerId: string, input: {
        seasonId?: string;
        harvestDate?: string;
        yieldKg: number;
        sellingPricePerKg: number;
    }): Promise<{
        seasonId: string;
        harvestCount: number;
        totalIncomeInr: number;
        netProfitInr: number;
        roiPercent: number;
        entryId: string;
    }>;
    recordIncome(farmerId: string, input: {
        seasonId?: string;
        blockId?: string;
        incomeSubtype: "advance" | "subsidy" | "other";
        amount: number;
        entryDate?: string;
        note?: string;
    }): Promise<{
        id: string;
        seasonId: string;
    }>;
    finishSeason(farmerId: string, seasonId: string, opts?: {
        password?: string;
        confirmText?: string;
    }): Promise<{
        seasonId: string;
        netProfitInr: number;
        totalExpenseInr: number;
        totalIncomeInr: number;
        roiPercent: number;
    }>;
    startSeason(farmerId: string, input: {
        blockId: string;
        crop: string;
        acreage?: number;
        plantingDate?: string;
    }): Promise<SeasonRow>;
    archiveSeason(farmerId: string, seasonId: string): Promise<{
        seasonId: string;
        netProfitInr: number;
        totalExpenseInr: number;
        totalIncomeInr: number;
        roiPercent: number;
    }>;
    listHistory(farmerId: string): Promise<{
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
    }[]>;
    getHistoryDetail(farmerId: string, seasonId: string): Promise<{
        id: string;
        crop: string;
        blockName: string | null;
        acreage: number | null;
        seasonLabel: string;
        startDate: string;
        endDate: string | null;
        dapDuration: string | null;
        totalExpenseInr: number;
        totalIncomeInr: number;
        netProfitInr: number;
        roiPercent: number;
        finalYieldKg: number | null;
        harvests: {
            id: string;
            harvestDate: string;
            yieldKg: number;
            sellingPricePerKg: number;
            totalIncomeInr: number;
            buyer: string | null;
        }[];
        harvest: {
            harvestDate: string;
            yieldKg: number;
            sellingPricePerKg: number;
            totalIncomeInr: number;
        } | null;
        entries: {
            id: string;
            dateLabel: string;
            amountInr: number;
            type: string;
            label: string;
            note: string | null;
        }[];
        activities: {
            id: string;
            label: string;
            dateLabel: string;
            costInr: number | null;
            notes: string | null;
        }[];
    }>;
    listSeasonEntries(farmerId: string, seasonId: string, page?: number, limit?: number): Promise<{
        entries: {
            id: string;
            dateLabel: string;
            amountInr: number;
            type: string;
            label: string;
            note: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    listCategories(farmerId: string): Promise<{
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        ledgerEntryType: string;
        isSystem: boolean;
    }[]>;
    getCategoryForFarmer(farmerId: string, categoryId: string): Promise<Record<string, unknown> & {
        legacy_expense_type_id?: string | null;
    }>;
    createFarmerCategory(farmerId: string, input: {
        name: string;
        icon?: string;
        color?: string;
        ledgerEntryType?: RoiEntryType;
    }): Promise<{
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        ledgerEntryType: string;
        isSystem: boolean;
    }>;
    listTransactions(farmerId: string, opts: {
        seasonId?: string;
        blockId?: string;
        crop?: string;
        type?: "expense" | "income";
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        transactions: {
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
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getExpenseBook(farmerId: string, filter: {
        crop?: string;
        blockId?: string;
    }): Promise<{
        groups: Array<{
            categoryId: string;
            categoryName: string;
            icon: string | null;
            totalInr: number;
            lines: Array<{
                id: string;
                dateLabel: string;
                description: string;
                amountInr: number;
            }>;
        }>;
    }>;
    getAnalytics(farmerId: string, filter: {
        crop?: string;
        blockId?: string;
    }): Promise<{
        breakdown: {
            label: string;
            value: number;
            percent: number;
            color: string;
        }[];
        topCategory: {
            label: string;
            value: number;
        } | null;
        monthlyExpenseTrend: {
            month: string;
            amountInr: number;
        }[];
        harvest: {
            harvestCount: number;
            totalQtyKg: number;
            totalIncomeInr: number;
            averageRatePerKg: number | null;
            bestRatePerKg: number | null;
            lowestRatePerKg: number | null;
        };
    }>;
    listHistoryV2(farmerId: string): Promise<{
        active: {
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
            blockName: string | null;
            dap: number | null;
            stageLabel: string;
        }[];
        completed: {
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
        }[];
    }>;
    updateTransaction(farmerId: string, entryId: string, patch: {
        amount?: number;
        note?: string;
        entryDate?: string;
    }): Promise<{
        id: string;
    }>;
    deleteTransaction(farmerId: string, entryId: string): Promise<{
        id: string;
    }>;
    getSeasonForFarmer(farmerId: string, seasonId: string): Promise<SeasonRow>;
    adminListExpenseTypes(): Promise<any[]>;
    adminCreateExpenseType(input: {
        expenseName: string;
        icon?: string | null;
        color?: string | null;
        ledgerEntryType?: RoiEntryType;
        sortOrder?: number;
    }): Promise<any>;
    adminUpdateExpenseType(id: string, patch: Partial<{
        expenseName: string;
        icon: string | null;
        color: string | null;
        ledgerEntryType: RoiEntryType;
        activeStatus: boolean;
        sortOrder: number;
    }>): Promise<any>;
    adminDeleteExpenseType(id: string): Promise<any>;
    adminListLabourTypes(): Promise<any[]>;
    adminCreateLabourType(input: {
        labourName: string;
        icon?: string | null;
        sortOrder?: number;
    }): Promise<any>;
    adminUpdateLabourType(id: string, patch: Partial<{
        labourName: string;
        icon: string | null;
        activeStatus: boolean;
        sortOrder: number;
    }>): Promise<any>;
    adminDeleteLabourType(id: string): Promise<any>;
};
export {};
//# sourceMappingURL=crop-season.service.d.ts.map
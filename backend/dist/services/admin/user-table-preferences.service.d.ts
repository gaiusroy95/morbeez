export type UserTablePreferencesRow = {
    userEmail: string;
    tableName: string;
    viewName: string;
    visibleColumns: string[];
    columnOrder: string[];
    columnWidths: Record<string, number>;
    filterState: Record<string, unknown>;
    updatedAt: string;
};
export declare const userTablePreferencesService: {
    get(userEmail: string, tableName: string, viewName?: string): Promise<UserTablePreferencesRow | null>;
    listViews(userEmail: string, tableName: string): Promise<{
        viewName: string;
        updatedAt: string;
    }[]>;
    upsert(userEmail: string, tableName: string, input: {
        viewName?: string;
        visibleColumns?: string[];
        columnOrder?: string[];
        columnWidths?: Record<string, number>;
        filterState?: Record<string, unknown>;
    }): Promise<UserTablePreferencesRow>;
    deleteView(userEmail: string, tableName: string, viewName: string): Promise<void>;
};
//# sourceMappingURL=user-table-preferences.service.d.ts.map
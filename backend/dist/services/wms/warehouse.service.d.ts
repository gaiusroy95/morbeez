export declare const warehouseService: {
    listWarehouses(): Promise<any[]>;
    getDefaultWarehouse(): Promise<any>;
    listLocations(warehouseId: string): Promise<any[]>;
    createLocation(input: {
        warehouseId: string;
        zone?: string;
        rack: string;
        shelf?: string;
        bin?: string;
    }): Promise<any>;
    formatLocationDisplay(loc: {
        zone?: string | null;
        rack?: string | null;
        shelf?: string | null;
        bin?: string | null;
        location_code?: string | null;
    }): string;
};
//# sourceMappingURL=warehouse.service.d.ts.map
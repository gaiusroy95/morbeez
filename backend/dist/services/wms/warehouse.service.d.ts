export declare const warehouseService: {
    listWarehouses(): Promise<any[]>;
    getDefaultWarehouse(): Promise<any>;
    listLocations(warehouseId: string): Promise<any[]>;
    createWarehouse(input: {
        code: string;
        name: string;
        state?: string;
    }): Promise<any>;
    updateWarehouse(id: string, input: {
        code?: string;
        name?: string;
    }): Promise<any>;
    deactivateWarehouse(id: string): Promise<void>;
    createLocation(input: {
        warehouseId: string;
        zone?: string;
        rack: string;
        shelf?: string;
        bin?: string;
    }): Promise<any>;
    updateLocation(id: string, input: {
        rack?: string;
        shelf?: string;
        bin?: string;
        zone?: string;
    }): Promise<any>;
    deactivateLocation(id: string): Promise<void>;
    renameRack(warehouseId: string, oldRack: string, newRack: string): Promise<void>;
    deactivateRack(warehouseId: string, rack: string): Promise<void>;
    formatLocationDisplay(loc: {
        zone?: string | null;
        rack?: string | null;
        shelf?: string | null;
        bin?: string | null;
        location_code?: string | null;
    }): string;
};
//# sourceMappingURL=warehouse.service.d.ts.map
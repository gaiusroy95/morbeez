import { type PlotLocationSource } from './plot-location.service.js';
export type FarmBlockRow = {
    id: string;
    farmer_id: string;
    name: string;
    crop_type: string;
    crop_name: string | null;
    crop_category: string | null;
    crop_subtype: string | null;
    plot_label: string | null;
    variety_name: string | null;
    planting_date: string | null;
    stage: string | null;
    acreage_decimal: number | null;
    is_primary: boolean;
    pincode_id: string | null;
    irrigation_type: string | null;
    latitude: number | null;
    longitude: number | null;
    location_captured_at: string | null;
    location_source: string | null;
    created_at: string;
};
export type BlockWithDap = FarmBlockRow & {
    dap: number;
};
export declare function blockDisplayName(block: FarmBlockRow): string;
export declare const blockService: {
    computeDap(block: Pick<FarmBlockRow, "planting_date" | "created_at">): number;
    withDap(block: FarmBlockRow): BlockWithDap;
    listByFarmer(farmerId: string): Promise<BlockWithDap[]>;
    getById(blockId: string, farmerId?: string): Promise<BlockWithDap | null>;
    getPrimaryBlock(farmerId: string): Promise<BlockWithDap | null>;
    ensureDefaultBlock(farmerId: string, cropType?: string): Promise<BlockWithDap>;
    createBlock(farmerId: string, input: {
        name: string;
        cropType: string;
        cropCategory?: string;
        cropSubtype?: string;
        varietyName?: string;
        plantingDate?: string;
        acreage?: number;
        irrigationType?: string;
        pincodeId?: string;
        plotLabel?: string;
        isPrimary?: boolean;
        stage?: string;
    }): Promise<BlockWithDap>;
    updatePlotLocation(blockId: string, input: {
        latitude: number;
        longitude: number;
        source: PlotLocationSource;
        farmerId?: string;
    }): Promise<BlockWithDap>;
    updateBlock(blockId: string, farmerId: string, patch: {
        name?: string;
        cropType?: string;
        acreage?: number;
        plantingDate?: string;
        irrigationType?: string;
    }): Promise<BlockWithDap>;
};
//# sourceMappingURL=block.service.d.ts.map
export type PlotLocationSource = 'field_pwa' | 'telecaller' | 'whatsapp' | 'api';
export type WeatherCoords = {
    lat: number;
    lon: number;
    label: string;
    coordSource: 'plot_gps' | 'pincode' | 'district';
};
/** Rough bounds for India (WGS84). */
export declare function isValidPlotCoordinate(lat: number, lon: number): boolean;
export declare const plotLocationService: {
    updateBlockLocation(blockId: string, input: {
        latitude: number;
        longitude: number;
        source: PlotLocationSource;
        farmerId?: string;
    }): Promise<void>;
    resolveWeatherCoords(farmerId: string, blockId?: string | null): Promise<WeatherCoords>;
};
//# sourceMappingURL=plot-location.service.d.ts.map
export declare const routePlannerService: {
    listRoutes(agentEmail: string, date?: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
        }[];
    }[]>;
    createRoute(agentEmail: string, routeName: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
        }[];
    }>;
    addStop(routeId: string, farmerId: string, blockId?: string): Promise<any>;
    optimizeRoute(routeId: string, originLat?: number, originLng?: number): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
        }[];
    }>;
    getRouteSummary(routeId: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
        }[];
    }>;
};
//# sourceMappingURL=route-planner.service.d.ts.map
export type RouteAgentContext = {
    agentType: 'agronomist';
    email: string;
} | {
    agentType: 'partner';
    partnerId: string;
};
export type ResolvedStopLocation = {
    latitude: number | null;
    longitude: number | null;
    coordSource: 'plot_gps' | 'pincode' | 'district' | 'none';
    pincode: string | null;
    pincodeId: string | null;
    blockName: string | null;
};
export declare const routePlannerService: {
    countRoutesToday(agent: RouteAgentContext): Promise<number>;
    listRoutes(agent: RouteAgentContext, date?: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        pincodeClusters: {
            pincode: string | null;
            pincodeId: string | null;
            stopCount: number;
            centroidLat: number | null;
            centroidLng: number | null;
        }[];
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            blockName: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
            coordSource: "district" | "plot_gps" | "pincode" | "none";
            pincode: string | null;
            pincodeId: string | null;
        }[];
    }[]>;
    createRoute(agent: RouteAgentContext, routeName: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        pincodeClusters: {
            pincode: string | null;
            pincodeId: string | null;
            stopCount: number;
            centroidLat: number | null;
            centroidLng: number | null;
        }[];
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            blockName: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
            coordSource: "district" | "plot_gps" | "pincode" | "none";
            pincode: string | null;
            pincodeId: string | null;
        }[];
    }>;
    addStop(agent: RouteAgentContext, routeId: string, farmerId: string, blockId?: string): Promise<any>;
    optimizeRoute(agent: RouteAgentContext, routeId: string, originLat?: number, originLng?: number): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        pincodeClusters: {
            pincode: string | null;
            pincodeId: string | null;
            stopCount: number;
            centroidLat: number | null;
            centroidLng: number | null;
        }[];
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            blockName: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
            coordSource: "district" | "plot_gps" | "pincode" | "none";
            pincode: string | null;
            pincodeId: string | null;
        }[];
    }>;
    getRouteSummary(routeId: string, agent?: RouteAgentContext): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        pincodeClusters: {
            pincode: string | null;
            pincodeId: string | null;
            stopCount: number;
            centroidLat: number | null;
            centroidLng: number | null;
        }[];
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            blockName: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
            coordSource: "district" | "plot_gps" | "pincode" | "none";
            pincode: string | null;
            pincodeId: string | null;
        }[];
    }>;
    /** @deprecated Use listRoutes with agent context */
    listRoutesForEmail(agentEmail: string, date?: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        pincodeClusters: {
            pincode: string | null;
            pincodeId: string | null;
            stopCount: number;
            centroidLat: number | null;
            centroidLng: number | null;
        }[];
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            blockName: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
            coordSource: "district" | "plot_gps" | "pincode" | "none";
            pincode: string | null;
            pincodeId: string | null;
        }[];
    }[]>;
    createRouteForEmail(agentEmail: string, routeName: string): Promise<{
        id: string;
        routeName: string;
        routeDate: string;
        status: string;
        stopCount: number;
        estimatedDistanceKm: number | null;
        estimatedHours: number | null;
        pincodeClusters: {
            pincode: string | null;
            pincodeId: string | null;
            stopCount: number;
            centroidLat: number | null;
            centroidLng: number | null;
        }[];
        stops: {
            id: string;
            farmerId: string;
            farmerName: string;
            blockId: string | null;
            blockName: string | null;
            sortOrder: number;
            latitude: number | null;
            longitude: number | null;
            coordSource: "district" | "plot_gps" | "pincode" | "none";
            pincode: string | null;
            pincodeId: string | null;
        }[];
    }>;
};
//# sourceMappingURL=route-planner.service.d.ts.map
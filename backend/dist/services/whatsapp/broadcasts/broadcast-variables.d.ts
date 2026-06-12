export type BroadcastVariableContext = {
    farmerName: string;
    crop: string;
    dap: string;
    village: string;
    farmArea: string;
    district: string;
};
export declare function loadFarmerVariableContext(farmerId: string): Promise<BroadcastVariableContext>;
export declare function renderBroadcastMessage(template: string, ctx: BroadcastVariableContext): string;
//# sourceMappingURL=broadcast-variables.d.ts.map
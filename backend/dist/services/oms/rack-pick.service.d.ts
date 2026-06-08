export type RackSessionContext = {
    session: Record<string, unknown> & {
        id: string;
        pick_lists?: {
            commerce_order_id?: string;
            pick_list_lines?: RackPickLine[];
        };
    };
    lines: RackPickLine[];
    counts: Record<string, number>;
    completed: string[];
    currentRack: string | null;
    stage: 'picking' | 'print';
    racks: Array<{
        rack: string;
        lineCount: number;
        totalQty: number;
        pickedQty: number;
        complete: boolean;
        active: boolean;
    }>;
    currentRackLines: Array<{
        row: number;
        id: string;
        productTitle: string;
        sku: string | null;
        batchCode: string | null;
        qtyRequired: number;
        qtyPicked: number;
        remaining: number;
        complete: boolean;
    }>;
    printEnabled: boolean;
};
export type RackPickLine = {
    id: string;
    rack_location: string | null;
    product_title: string;
    sku: string | null;
    batch_code: string | null;
    qty_required: number;
    qty_picked: number;
    manually_verified: boolean;
    inventory_item_id: string;
    allocation_id: string | null;
};
declare function normalizeRack(rack: string | null | undefined): string;
declare function buildWorkflowPayload(ctx: RackSessionContext): {
    stage: "picking" | "print";
    step: number;
    currentRack: string | null;
    racks: {
        rack: string;
        lineCount: number;
        totalQty: number;
        pickedQty: number;
        complete: boolean;
        active: boolean;
    }[];
    currentRackLines: {
        row: number;
        id: string;
        productTitle: string;
        sku: string | null;
        batchCode: string | null;
        qtyRequired: number;
        qtyPicked: number;
        remaining: number;
        complete: boolean;
    }[];
    printEnabled: boolean;
};
declare function loadSessionContext(packSessionId: string): Promise<RackSessionContext>;
declare function initSessionRack(packSessionId: string): Promise<RackSessionContext>;
declare function lookupBarcode(packSessionId: string, scannedCode: string): Promise<{
    ok: boolean;
    error: string;
    lineId?: undefined;
    productTitle?: undefined;
    sku?: undefined;
    batchCode?: undefined;
    qtyRequired?: undefined;
    qtyPicked?: undefined;
    remaining?: undefined;
    defaultQty?: undefined;
} | {
    ok: boolean;
    lineId: string;
    productTitle: string;
    sku: string | null;
    batchCode: any;
    qtyRequired: number;
    qtyPicked: number;
    remaining: number;
    defaultQty: number;
    error?: undefined;
}>;
declare function confirmPick(packSessionId: string, lineId: string, qty: number): Promise<{
    ok: boolean;
    lineComplete: boolean;
    rackComplete: boolean;
    advancedToRack: string | null;
    stage: "picking" | "print";
    printEnabled: boolean;
    workflow: {
        stage: "picking" | "print";
        step: number;
        currentRack: string | null;
        racks: {
            rack: string;
            lineCount: number;
            totalQty: number;
            pickedQty: number;
            complete: boolean;
            active: boolean;
        }[];
        currentRackLines: {
            row: number;
            id: string;
            productTitle: string;
            sku: string | null;
            batchCode: string | null;
            qtyRequired: number;
            qtyPicked: number;
            remaining: number;
            complete: boolean;
        }[];
        printEnabled: boolean;
    };
    message: string;
}>;
export declare const rackPickService: {
    normalizeRack: typeof normalizeRack;
    loadSessionContext: typeof loadSessionContext;
    initSessionRack: typeof initSessionRack;
    buildWorkflowPayload: typeof buildWorkflowPayload;
    lookupBarcode: typeof lookupBarcode;
    confirmPick: typeof confirmPick;
};
export {};
//# sourceMappingURL=rack-pick.service.d.ts.map
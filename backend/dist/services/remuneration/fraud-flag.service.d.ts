import { type FraudFlagType } from '../../domain/remuneration/fraud-hold.js';
export declare const fraudFlagService: {
    list(filter?: {
        status?: string;
        partyType?: string;
        partyId?: string;
    }): Promise<any[]>;
    open(input: {
        partyType: "partner" | "employee";
        partyId: string;
        flagType: FraudFlagType;
        reason: string;
        earningSource?: string | null;
        earningId?: string | null;
        orderId?: string | null;
        farmerId?: string | null;
        evidence?: Record<string, unknown>;
        openedBy?: string | null;
    }): Promise<any>;
    setStatus(id: string, status: "confirmed" | "cleared", actor?: string): Promise<any>;
    scan(limit?: number): Promise<{
        scanned: number;
        opened: number;
    }>;
};
//# sourceMappingURL=fraud-flag.service.d.ts.map
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';
export declare const settlementService: {
    createForEarning(input: {
        partyType: "partner" | "employee";
        partyId: string;
        earningSource: "partner_ledger" | "agronomist_ledger";
        earningId: string;
        earningMonth: string;
        earningType: string;
        grossInr: number;
    }): Promise<void>;
    dueForParty(partyType: "partner" | "employee", partyId: string, asOf?: Date): Promise<any[]>;
    dueTotalInr(partyType: "partner" | "employee", partyId: string, asOf?: Date): Promise<number>;
    markPaid(ids: string[], paymentReference?: string): Promise<void>;
    applyReturnRecovery(earningSource: "partner_ledger" | "agronomist_ledger", earningId: string, recoverInr: number): Promise<{
        recovered: number;
        futureRecovery: number;
    } | undefined>;
    resyncPending(input: {
        partyType: "partner" | "employee";
        partyId: string;
        earningSource: "partner_ledger" | "agronomist_ledger";
        earningId: string;
        earningMonth: string;
        earningType: string;
        grossInr: number;
    }): Promise<void>;
    attachPayoutBatch(ids: string[], batchId: string): Promise<void>;
    attachPayrollEntry(ids: string[], payrollEntryId: string): Promise<void>;
    dueUnattached(partyType: "partner" | "employee", asOf?: Date): Promise<any[]>;
    currentMonthKey: typeof periodMonth;
};
//# sourceMappingURL=settlement.service.d.ts.map